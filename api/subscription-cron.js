// Vercel Serverless Function — Subscription Daily Cron
// 1. Applies pending plan changes when scheduled date has passed
// 2. Resets usesThisMonth to 0 on the 1st of each month
// Auth: Vercel CRON_SECRET (Authorization: Bearer) or x-push-secret header

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check — accepts Vercel CRON_SECRET or PUSH_API_SECRET
  const bearerToken = req.headers['authorization']?.replace('Bearer ', '');
  const pushSecret = req.headers['x-push-secret'];
  const validSecret = bearerToken === process.env.CRON_SECRET
    || bearerToken === process.env.PUSH_API_SECRET
    || pushSecret === process.env.PUSH_API_SECRET;
  if (!validSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // ── Step 1: Apply pending plan changes (DAILY) ──
    let planChanges = 0;
    const now = new Date().toISOString();
    const pendingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?pendingPlanId=not.is.null&planChangeScheduledAt=lte.${encodeURIComponent(now)}&status=in.(active,pending_payment)&select=id,pendingPlanId,pendingPlanName`,
      { headers: { ...headers, Prefer: 'return=representation' } }
    );
    if (pendingRes.ok) {
      const pendingSubs = await pendingRes.json();
      for (const ps of (pendingSubs || [])) {
        await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${ps.id}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({
            planId: ps.pendingPlanId,
            pendingPlanId: null,
            pendingPlanName: null,
            planChangeScheduledAt: null,
            usesThisMonth: 0,
            updatedAt: now,
          }),
        });
        planChanges++;
        console.log(`[subscription-cron] Applied plan change: sub ${ps.id} → plan ${ps.pendingPlanId}`);
      }
    }

    // ── Step 2: Reset usesThisMonth (ONLY on the 1st of the month) ──
    let resetCount = 0;
    const today = new Date();
    if (today.getUTCDate() === 1) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/subscriptions?status=in.(active,pending_payment,overdue)`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            usesThisMonth: 0,
            updatedAt: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('[subscription-cron] Supabase reset error:', text);
      } else {
        const updated = await response.json();
        resetCount = Array.isArray(updated) ? updated.length : 0;
      }
    }

    console.log(`[subscription-cron] Plan changes: ${planChanges}, Resets: ${resetCount} (day=${today.getUTCDate()})`);

    // ── Step 3 (N3): Auto-retry overdue subscriptions (DAILY) ──
    let retryCount = 0;
    try {
      // Get billing config for ASAAS API calls
      const configRes = await fetch(
        `${SUPABASE_URL}/rest/v1/billing_gateway_config?active=eq.true&select=apiKey,environment&limit=1`,
        { headers: { ...headers, Prefer: 'return=representation' } }
      );
      const configs = configRes.ok ? await configRes.json() : [];
      const config = configs?.[0];

      if (config) {
        const baseUrl = config.environment === 'production'
          ? 'https://api.asaas.com/v3'
          : 'https://api-sandbox.asaas.com/v3';

        // Find overdue subs with few failed attempts and a gateway ID
        const overdueRes = await fetch(
          `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.overdue&failedAttempts=lte.2&gatewaySubscriptionId=not.is.null&select=id,gatewaySubscriptionId,failedAttempts,clientName`,
          { headers: { ...headers, Prefer: 'return=representation' } }
        );
        if (overdueRes.ok) {
          const overdueSubs = await overdueRes.json();
          for (const sub of (overdueSubs || [])) {
            try {
              // Trigger ASAAS to retry by updating subscription (forces new charge cycle evaluation)
              await fetch(`${baseUrl}/subscriptions/${sub.gatewaySubscriptionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'access_token': config.apiKey },
                body: JSON.stringify({ updatePendingPayments: true }),
              });
              // Note: Do NOT increment failedAttempts here — the webhook PAYMENT_OVERDUE handler
              // is the source of truth. Incrementing here would cause double-counting.
              // Just mark the subscription as touched for audit trail via updatedAt
              await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${sub.id}`, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=minimal' },
                body: JSON.stringify({
                  updatedAt: new Date().toISOString(),
                }),
              });
              retryCount++;
              console.log(`[subscription-cron] Auto-retry triggered: ${sub.id} (${sub.clientName || 'unknown'}) current failedAttempts=${sub.failedAttempts || 0}`);
              await new Promise(r => setTimeout(r, 200));
            } catch (e) {
              console.warn(`[subscription-cron] Retry failed for ${sub.id}:`, e.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[subscription-cron] Auto-retry step failed:', e.message);
    }

    // ── Step 4 (N4): Pre-dunning push notifications (3d and 1d before) ──
    let pushCount = 0;
    try {
      const API_BASE = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://vinnxbarber-erp.vercel.app';

      // Find active subs with nextPaymentDate 3 or 1 days away
      const activeSubs = await fetch(
        `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.active&nextPaymentDate=not.is.null&select=id,clientId,nextPaymentDate,clientName`,
        { headers: { ...headers, Prefer: 'return=representation' } }
      );
      if (activeSubs.ok) {
        const subs = await activeSubs.json();
        const nowMs = Date.now();
        for (const sub of (subs || [])) {
          if (!sub.clientId || !sub.nextPaymentDate) continue;
          const dueMs = new Date(sub.nextPaymentDate).getTime();
          const daysUntil = Math.ceil((dueMs - nowMs) / (1000 * 60 * 60 * 24));

          if (daysUntil === 3 || daysUntil === 1) {
            try {
              await fetch(`${API_BASE}/api/push-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-push-secret': process.env.PUSH_API_SECRET },
                body: JSON.stringify({
                  clientId: sub.clientId,
                  title: '💳 Cobrança próxima',
                  body: daysUntil === 1
                    ? 'Sua assinatura será cobrada amanhã. Verifique seus dados de pagamento.'
                    : 'Sua assinatura será cobrada em 3 dias.',
                  tag: `predunning-${sub.id}-${daysUntil}d`,
                }),
              });
              pushCount++;
            } catch (e) {
              console.warn(`[subscription-cron] Push failed for ${sub.clientId}:`, e.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[subscription-cron] Pre-dunning step failed:', e.message);
    }

    console.log(`[subscription-cron] Retries: ${retryCount}, Pre-dunning pushes: ${pushCount}`);

    return res.status(200).json({
      success: true,
      planChanges,
      resetCount,
      retryCount,
      pushCount,
      isFirstOfMonth: today.getUTCDate() === 1,
      runAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[subscription-cron] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
