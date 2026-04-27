// Vercel Serverless Function — Save push subscription (bypasses RLS)
// No auth required — anyone can subscribe to push notifications

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // DELETE: Remove subscription (bypasses RLS using service_role)
  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    const deleteRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
      }
    );
    return deleteRes.ok
      ? res.status(200).json({ ok: true })
      : res.status(500).json({ error: 'Failed to delete subscription' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { clientId, authUserId, endpoint, keys, userAgent } = req.body;

    if (!endpoint || !keys) {
      return res.status(400).json({ error: 'endpoint and keys are required' });
    }

    if (!clientId || clientId === 'anonymous') {
      return res.status(400).json({ error: 'Valid clientId is required (login first)' });
    }

    // Upsert subscription using service_role (bypasses RLS)
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        clientId,
        authUserId: authUserId || 'anonymous',
        endpoint,
        keys,
        userAgent: userAgent || null,
        updatedAt: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      console.error('[push-subscribe] Supabase error:', errText);
      return res.status(500).json({ error: 'Failed to save subscription', detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[push-subscribe] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
