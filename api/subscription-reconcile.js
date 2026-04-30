// Vercel Serverless Function — Subscription Reconciliation Cron
// Detects and cancels orphaned ASAAS subscriptions that have no matching local record
// Auth: Vercel CRON_SECRET or PUSH_API_SECRET
// Schedule: Daily (configured in vercel.json)

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sbQuery(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok && res.status !== 404 && res.status !== 406) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  const bearerToken = req.headers['authorization']?.replace('Bearer ', '');
  const pushSecret = req.headers['x-push-secret'];
  const validSecret = bearerToken === process.env.CRON_SECRET
    || bearerToken === process.env.PUSH_API_SECRET
    || pushSecret === process.env.PUSH_API_SECRET;
  if (!validSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Get billing config (include id for saving report)
    const configRes = await sbQuery('billing_gateway_config?active=eq.true&select=id,apiKey,environment&limit=1');
    const configs = await configRes.json();
    const config = configs?.[0];
    if (!config) {
      return res.status(200).json({ success: true, skipped: true, reason: 'No active billing config' });
    }

    const baseUrl = config.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';

    // 2. Fetch ALL active subscriptions from ASAAS (paginated)
    let allAsaasSubs = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const asaasRes = await fetch(`${baseUrl}/subscriptions?status=ACTIVE&limit=100&offset=${offset}`, {
        headers: { 'access_token': config.apiKey },
      });
      if (!asaasRes.ok) {
        const errText = await asaasRes.text();
        throw new Error(`ASAAS ${asaasRes.status}: ${errText}`);
      }
      const data = await asaasRes.json();
      allAsaasSubs = allAsaasSubs.concat(data.data || []);
      hasMore = data.hasMore === true;
      offset += 100;
    }

    console.log(`[reconcile] Found ${allAsaasSubs.length} ACTIVE subscriptions in ASAAS`);

    // 3. Fetch ALL local subscriptions with gateway IDs (non-cancelled)
    const localRes = await sbQuery(
      'subscriptions?gatewaySubscriptionId=not.is.null&select=gatewaySubscriptionId,status'
    );
    const localSubs = await localRes.json();
    const localGatewayIds = new Set((localSubs || []).map(s => s.gatewaySubscriptionId));

    // Also collect IDs where local status is cancelled (these should be cancelled in ASAAS too)
    const cancelledLocalIds = new Set(
      (localSubs || []).filter(s => s.status === 'cancelled').map(s => s.gatewaySubscriptionId)
    );

    console.log(`[reconcile] Local gateway IDs: ${localGatewayIds.size}, Cancelled: ${cancelledLocalIds.size}`);

    // 4. Find orphans: ASAAS subscriptions that either:
    //    a) Have no matching local record at all (orphaned)
    //    b) Have a local record but it's cancelled (should be cancelled in ASAAS too)
    const orphans = allAsaasSubs.filter(s => {
      const gatewayId = s.id;
      // No local record → orphan
      if (!localGatewayIds.has(gatewayId)) return true;
      // Local record is cancelled but ASAAS is still active → stale
      if (cancelledLocalIds.has(gatewayId)) return true;
      return false;
    });

    console.log(`[reconcile] Found ${orphans.length} orphaned/stale ASAAS subscriptions`);

    // 5. Cancel orphans in ASAAS
    const cancelled = [];
    const errors = [];
    for (const orphan of orphans) {
      try {
        // F10: Validate DELETE response
        const delRes = await fetch(`${baseUrl}/subscriptions/${orphan.id}`, {
          method: 'DELETE',
          headers: { 'access_token': config.apiKey },
        });
        if (!delRes.ok) {
          const errText = await delRes.text();
          throw new Error(`HTTP ${delRes.status}: ${errText}`);
        }
        cancelled.push({
          id: orphan.id,
          customer: orphan.customer,
          value: orphan.value,
          description: orphan.description,
          dateCreated: orphan.dateCreated,
          reason: localGatewayIds.has(orphan.id) ? 'local_cancelled' : 'no_local_record',
        });
        console.log(`[reconcile] Cancelled orphan: ${orphan.id} (${orphan.description}, R$${orphan.value})`);
        // F10: Rate limiting — 200ms delay between DELETEs to avoid ASAAS throttling
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        errors.push({ id: orphan.id, error: err.message });
        console.error(`[reconcile] Failed to cancel ${orphan.id}:`, err.message);
      }
    }

    // 6. Log reconciliation event
    if (cancelled.length > 0 || errors.length > 0) {
      await sbQuery('billing_events', {
        method: 'POST',
        body: JSON.stringify({
          id: crypto.randomUUID(),
          event: 'RECONCILIATION',
          status: errors.length > 0 ? 'partial' : 'success',
          raw: { cancelled, errors, totalAsaas: allAsaasSubs.length, totalLocal: localGatewayIds.size },
          processedAt: new Date().toISOString(),
        }),
        prefer: 'return=minimal',
      });
    }

    // F13: Detect status divergence (ASAAS ACTIVE but local overdue = lost webhook)
    const divergences = [];
    for (const asaasSub of allAsaasSubs) {
      if (localGatewayIds.has(asaasSub.id) && !cancelledLocalIds.has(asaasSub.id)) {
        const localSub = (localSubs || []).find(s => s.gatewaySubscriptionId === asaasSub.id);
        if (localSub && localSub.status === 'overdue' && asaasSub.status === 'ACTIVE') {
          divergences.push({ gatewayId: asaasSub.id, asaasStatus: 'ACTIVE', localStatus: 'overdue' });
          console.warn(`[reconcile] DIVERGENCE: ${asaasSub.id} — ASAAS=ACTIVE, local=overdue (possible lost webhook)`);
        }
      }
    }
    if (divergences.length > 0) {
      console.warn(`[reconcile] ${divergences.length} status divergence(s) detected`);
    }

    // N8: Health Monitor — check webhook status
    let webhookHealth = null;
    try {
      const whRes = await fetch(`${baseUrl}/webhooks`, {
        headers: { 'access_token': config.apiKey },
      });
      if (whRes.ok) {
        const whData = await whRes.json();
        const ours = (whData.data || []).find(w => w.url?.includes('/api/asaas-webhook'));
        if (ours) {
          webhookHealth = {
            enabled: ours.enabled,
            interrupted: ours.interrupted || false,
            penalizedRequestsCount: ours.penalizedRequestsCount || 0,
            eventsCount: ours.events?.length || 0,
          };
          if (ours.interrupted) {
            console.error('[reconcile] ⚠️ WEBHOOK INTERRUPTED — ASAAS stopped sending events!');
          }
        }
      }
    } catch (e) {
      console.warn('[reconcile] Health check failed:', e.message);
    }

    // N5: Weekly customer cleanup (Sundays only)
    let customersCleanedUp = 0;
    if (new Date().getUTCDay() === 0) {
      try {
        const custRes = await fetch(`${baseUrl}/customers?limit=100`, {
          headers: { 'access_token': config.apiKey },
        });
        if (custRes.ok) {
          const custData = await custRes.json();
          for (const cust of (custData.data || [])) {
            if (!cust.canDelete || cust.deleted) continue;
            // Check if customer has any active subscriptions in ASAAS
            const custSubRes = await fetch(`${baseUrl}/subscriptions?customer=${cust.id}&status=ACTIVE&limit=1`, {
              headers: { 'access_token': config.apiKey },
            });
            if (custSubRes.ok) {
              const custSubData = await custSubRes.json();
              if (custSubData.totalCount === 0) {
                // No active subs — check if there's a local record
                const localCustRes = await sbQuery(
                  `clients?asaasCustomerId=eq.${cust.id}&select=id&limit=1`
                );
                const localCust = await localCustRes.json();
                if (!localCust?.length) {
                  // No local client either — orphaned customer, safe to delete
                  const delRes = await fetch(`${baseUrl}/customers/${cust.id}`, {
                    method: 'DELETE',
                    headers: { 'access_token': config.apiKey },
                  });
                  if (delRes.ok) {
                    customersCleanedUp++;
                    console.log(`[reconcile] Cleaned up orphaned customer: ${cust.id} (${cust.name})`);
                  }
                  await new Promise(r => setTimeout(r, 200));
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[reconcile] Customer cleanup failed:', e.message);
      }
    }

    // Build reconcile report
    const report = {
      runAt: new Date().toISOString(),
      totalAsaas: allAsaasSubs.length,
      totalLocal: localGatewayIds.size,
      orphansFound: orphans.length,
      orphansCancelled: cancelled.length,
      divergences: divergences.length,
      customersCleanedUp,
      webhookHealth,
      errors: errors.length,
    };

    // Save report to config (N8)
    if (config.id) {
      await sbQuery(`billing_gateway_config?id=eq.${config.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lastReconcileReport: report, updatedAt: new Date().toISOString() }),
        prefer: 'return=minimal',
      });
    }

    return res.status(200).json({
      success: true,
      ...report,
      cancelled,
      divergences,
    });

  } catch (error) {
    console.error('[reconcile] Error:', error);
    return res.status(500).json({ error: error.message || 'Reconciliation failed' });
  }
}
