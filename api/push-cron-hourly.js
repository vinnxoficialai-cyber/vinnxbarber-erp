// Vercel Cron Wrapper — Push Hourly (reminders, reviews, scheduled campaigns)
// Auth: Vercel CRON_SECRET (auto-injected via Authorization header)
// Delegates to /api/push-cron?type=hourly

const API_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://vinnxbarber-erp.vercel.app';

export default async function handler(req, res) {
  // Verify Vercel Cron auth
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await fetch(`${API_BASE}/api/push-cron?type=hourly`, {
      method: 'GET',
      headers: { 'x-push-secret': process.env.PUSH_API_SECRET },
    });

    const data = await result.json();
    return res.status(result.status).json(data);
  } catch (error) {
    console.error('[push-cron-hourly] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
