// Vercel Serverless Function — Broadcast push to segment or all subscribers
// Auth: JWT only (admin panel)

import webpush from 'web-push';

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

webpush.setVapidDetails(
  'mailto:vinnxoficialai@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res;
}

async function verifyStaffJWT(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.replace('Bearer ', '');
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!verifyRes.ok) return false;

  const user = await verifyRes.json();
  const staffRes = await sbFetch(`users?email=eq.${encodeURIComponent(user.email)}&select=id&limit=1`);
  const staff = await staffRes.json();
  return staff?.length > 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Also allow x-push-secret for cron-initiated broadcasts
  const secret = req.headers['x-push-secret'];
  const isSecretAuth = secret && secret === process.env.PUSH_API_SECRET;
  
  if (!isSecretAuth) {
    const isStaff = await verifyStaffJWT(req);
    if (!isStaff) return res.status(401).json({ error: 'Unauthorized — staff only' });
  }

  try {
    const { title, body, image, url, campaignId, filterCriteria } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    // Build subscription query
    let subsQuery = 'push_subscriptions?select=id,endpoint,keys,"clientId"';

    // If filterCriteria provided, get filtered client IDs first
    let targetClientIds = null;
    if (filterCriteria) {
      let clientQuery = 'clients?select=id&"authUserId"=not.is.null';
      const VALID_GENDERS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];
      if (filterCriteria.gender && VALID_GENDERS.includes(filterCriteria.gender)) {
        clientQuery += `&gender=eq.${encodeURIComponent(filterCriteria.gender)}`;
      }
      if (filterCriteria.minVisits) clientQuery += `&"totalVisits"=gte.${parseInt(filterCriteria.minVisits, 10) || 0}`;
      
      const clientsRes = await sbFetch(clientQuery);
      const clients = await clientsRes.json();
      targetClientIds = clients?.map(c => c.id) || [];

      if (targetClientIds.length === 0) {
        return res.status(200).json({ sent: 0, message: 'No matching clients' });
      }

      subsQuery += `&"clientId"=in.(${targetClientIds.join(',')})`;
    }

    const subsRes = await sbFetch(subsQuery);
    const subscriptions = await subsRes.json();

    if (!subscriptions?.length) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      tag: 'broadcast-' + Date.now(),
      image: image || undefined,
      url: url || '/#/site',
    });

    let sent = 0, failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        sent++;
      } catch (err) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await sbFetch(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' });
        }
      }
    }

    // Update campaign if campaignId provided
    if (campaignId) {
      await sbFetch(`push_campaigns?id=eq.${campaignId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sentCount: sent,
          failedCount: failed,
          sentAt: new Date().toISOString(),
          status: 'sent',
        }),
        headers: { Prefer: 'return=minimal' },
      });
    }

    // Log
    await sbFetch('push_log', {
      method: 'POST',
      body: JSON.stringify({
        campaignId: campaignId || null,
        type: 'broadcast',
        title,
        body: body || '',
        status: failed === subscriptions.length ? 'failed' : 'sent',
      }),
    });

    return res.status(200).json({ sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('[push-broadcast] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
