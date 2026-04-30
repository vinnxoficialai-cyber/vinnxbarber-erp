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
    // 1. Get billing config
    const configRes = await sbQuery('billing_gateway_config?active=eq.true&select=apiKey,environment&limit=1');
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
        await fetch(`${baseUrl}/subscriptions/${orphan.id}`, {
          method: 'DELETE',
          headers: { 'access_token': config.apiKey },
        });
        cancelled.push({
          id: orphan.id,
          customer: orphan.customer,
          value: orphan.value,
          description: orphan.description,
          dateCreated: orphan.dateCreated,
          reason: localGatewayIds.has(orphan.id) ? 'local_cancelled' : 'no_local_record',
        });
        console.log(`[reconcile] Cancelled orphan: ${orphan.id} (${orphan.description}, R$${orphan.value})`);
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

    return res.status(200).json({
      success: true,
      totalAsaas: allAsaasSubs.length,
      totalLocal: localGatewayIds.size,
      orphansFound: orphans.length,
      orphansCancelled: cancelled.length,
      errors: errors.length,
      cancelled,
      runAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[reconcile] Error:', error);
    return res.status(500).json({ error: error.message || 'Reconciliation failed' });
  }
}
