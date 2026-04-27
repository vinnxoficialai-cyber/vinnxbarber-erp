// Vercel Serverless Function — Send push notification to a single client
// Auth: x-push-secret (trigger/cron) OR JWT (admin panel)

import webpush from 'web-push';

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

webpush.setVapidDetails(
  'mailto:vinnxoficialai@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

async function sbQuery(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

async function verifyAuth(req) {
  // Method 1: x-push-secret (trigger/cron)
  const secret = req.headers['x-push-secret'];
  if (secret && secret === process.env.PUSH_API_SECRET) {
    return { type: 'secret', valid: true };
  }

  // Method 2: JWT (admin panel)
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (verifyRes.ok) {
      const user = await verifyRes.json();
      // Check if user is staff
      const staffRes = await sbQuery(`users?email=eq.${encodeURIComponent(user.email)}&select=id&limit=1`);
      const staff = await staffRes.json();
      if (staff?.length > 0) {
        return { type: 'jwt', valid: true, email: user.email };
      }
    }
  }

  return { valid: false };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await verifyAuth(req);
    if (!auth.valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { clientId, title, body, tag, image, url, actions } = req.body;

    if (!clientId || !title) {
      return res.status(400).json({ error: 'clientId and title are required' });
    }

    // Fetch all subscriptions for this client (supports multiple devices)
    const subsRes = await sbQuery(
      `push_subscriptions?select=id,endpoint,keys&"clientId"=eq.${encodeURIComponent(clientId)}`
    );
    const subscriptions = await subsRes.json();

    if (!subscriptions?.length) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      tag: tag || 'vinnx-' + Date.now(),
      image: image || undefined,
      url: url || '/#/site',
      actions: actions || [],
    });

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        sent++;
      } catch (err) {
        failed++;
        const statusCode = err?.statusCode;
        // 410 Gone or 404 = subscription expired → delete
        if (statusCode === 410 || statusCode === 404) {
          await sbQuery(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' });
        }
        errors.push({ endpoint: sub.endpoint?.substring(0, 40), status: statusCode });
      }
    }

    // Log the push
    await sbQuery('push_log', {
      method: 'POST',
      body: JSON.stringify({
        clientId,
        type: tag?.startsWith('booking-') ? 'transactional' :
              tag?.startsWith('cancel-') ? 'transactional' :
              tag?.startsWith('reschedule-') ? 'transactional' : 'manual',
        title,
        body: body || '',
        status: failed === subscriptions.length ? 'failed' : 'sent',
        errorDetail: errors.length ? JSON.stringify(errors) : null,
      }),
    });

    return res.status(200).json({ sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('[push-send] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
