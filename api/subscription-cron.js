// Vercel Serverless Function — Subscription Monthly Reset Cron
// Resets usesThisMonth to 0 for all active/pending subscriptions
// Should be called on the 1st of each month via Vercel Cron or external scheduler
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

  // Auth check — accepts Vercel CRON_SECRET or PUSH_SECRET
  const bearerToken = req.headers['authorization']?.replace('Bearer ', '');
  const pushSecret = req.headers['x-push-secret'];
  const validSecret = bearerToken === process.env.CRON_SECRET
    || bearerToken === process.env.PUSH_SECRET
    || pushSecret === process.env.PUSH_SECRET;
  if (!validSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Reset usesThisMonth for active, pending_payment, and overdue subscriptions
    // Overdue included because when they pay mid-month, counter should be fresh
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?status=in.(active,pending_payment,overdue)`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          usesThisMonth: 0,
          updatedAt: new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[subscription-cron] Supabase error:', text);
      return res.status(500).json({ error: `Supabase error: ${response.status}` });
    }

    const updated = await response.json();
    const count = Array.isArray(updated) ? updated.length : 0;

    console.log(`[subscription-cron] Reset usesThisMonth for ${count} subscriptions`);

    return res.status(200).json({
      success: true,
      message: `Reset ${count} subscriptions`,
      resetAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[subscription-cron] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
