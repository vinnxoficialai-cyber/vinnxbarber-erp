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

    return res.status(200).json({
      success: true,
      planChanges,
      resetCount,
      isFirstOfMonth: today.getUTCDate() === 1,
      runAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[subscription-cron] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
