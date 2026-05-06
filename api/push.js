// api/push.js — Handler unificado de Push Notifications
// Consolida push-subscribe, push-send e push-broadcast em uma única função
// Roteamento por query param: ?action=subscribe | send | broadcast

import webpush from 'web-push';

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

webpush.setVapidDetails(
  'mailto:vinnxoficialai@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// ── Supabase helpers ──────────────────────────────────────────
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

async function sbQuery(path) {
  const res = await sbFetch(path);
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res.ok ? await res.json() : [];
}

// ── Auth helpers ──────────────────────────────────────────────
function verifySecret(req) {
  const secret = req.headers['x-push-secret'];
  return secret && secret === process.env.PUSH_API_SECRET;
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
  const staff = await sbQuery(`users?email=eq.${encodeURIComponent(user.email)}&select=id&limit=1`);
  return Array.isArray(staff) && staff.length > 0;
}

// ── ACTION: subscribe ─────────────────────────────────────────
// POST  → save subscription (clientId required)
// DELETE → remove subscription by endpoint
async function handleSubscribe(req, res) {
  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    const deleteRes = await sbFetch(
      `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
    return deleteRes.ok
      ? res.status(200).json({ ok: true })
      : res.status(500).json({ error: 'Failed to delete subscription' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { clientId, authUserId, endpoint, keys, userAgent } = req.body;

    if (!endpoint || !keys) return res.status(400).json({ error: 'endpoint and keys are required' });
    if (!clientId || clientId === 'anonymous') return res.status(400).json({ error: 'Valid clientId is required (login first)' });

    const upsertRes = await sbFetch('push_subscriptions', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
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
      console.error('[push/subscribe] Supabase error:', errText);
      return res.status(500).json({ error: 'Failed to save subscription', detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[push/subscribe] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ── ACTION: send ──────────────────────────────────────────────
// POST → send push to a single client (by clientId)
// Auth: x-push-secret OR staff JWT
async function handleSend(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const isSecret = verifySecret(req);
  if (!isSecret) {
    const isStaff = await verifyStaffJWT(req);
    if (!isStaff) return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { clientId, title, body, tag, image, url, actions } = req.body;
    if (!clientId || !title) return res.status(400).json({ error: 'clientId and title are required' });

    const subscriptions = await sbQuery(
      `push_subscriptions?select=id,endpoint,keys&"clientId"=eq.${encodeURIComponent(clientId)}`
    );

    if (!subscriptions?.length) return res.status(200).json({ sent: 0, message: 'No subscriptions found' });

    const payload = JSON.stringify({
      title,
      body: body || '',
      tag: tag || 'vinnx-' + Date.now(),
      image: image || undefined,
      url: url || '/#/site',
      actions: actions || [],
    });

    let sent = 0, failed = 0;
    const errors = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        sent++;
      } catch (err) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await sbFetch(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' });
        }
        errors.push({ endpoint: sub.endpoint?.substring(0, 40), status: err?.statusCode });
      }
    }

    // Log (non-blocking)
    try {
      await sbFetch('push_log', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          clientId,
          type: tag?.startsWith('booking-') || tag?.startsWith('cancel-') || tag?.startsWith('reschedule-')
            ? 'transactional' : 'manual',
          title,
          body: body || '',
          status: failed === subscriptions.length ? 'failed' : 'sent',
          errorDetail: errors.length ? JSON.stringify(errors) : null,
        }),
      });
    } catch (logErr) {
      console.error('[push/send] Log insert failed:', logErr.message);
    }

    return res.status(200).json({ sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('[push/send] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ── ACTION: broadcast ─────────────────────────────────────────
// POST → broadcast push to all subscribers (or filtered segment)
// Auth: x-push-secret OR staff JWT
async function handleBroadcast(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const isSecret = verifySecret(req);
  if (!isSecret) {
    const isStaff = await verifyStaffJWT(req);
    if (!isStaff) return res.status(401).json({ error: 'Unauthorized — staff only' });
  }

  try {
    const { title, body, image, url, campaignId, filterCriteria } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    let subsQuery = 'push_subscriptions?select=id,endpoint,keys,"clientId"';

    if (filterCriteria) {
      let clientQuery = 'clients?select=id&"authUserId"=not.is.null';
      const VALID_GENDERS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];
      if (filterCriteria.gender && VALID_GENDERS.includes(filterCriteria.gender))
        clientQuery += `&gender=eq.${encodeURIComponent(filterCriteria.gender)}`;
      if (filterCriteria.minVisits)
        clientQuery += `&"totalVisits"=gte.${parseInt(filterCriteria.minVisits, 10) || 0}`;

      const clients = await sbQuery(clientQuery);
      const targetClientIds = clients?.map(c => c.id) || [];
      if (targetClientIds.length === 0) return res.status(200).json({ sent: 0, message: 'No matching clients' });
      subsQuery += `&"clientId"=in.(${targetClientIds.join(',')})`;
    }

    const subscriptions = await sbQuery(subsQuery);
    if (!subscriptions?.length) return res.status(200).json({ sent: 0, message: 'No subscriptions found' });

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

    if (campaignId) {
      await sbFetch(`push_campaigns?id=eq.${campaignId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          sentCount: sent,
          failedCount: failed,
          sentAt: new Date().toISOString(),
          status: 'sent',
        }),
      });
    }

    // Log (non-blocking)
    try {
      await sbFetch('push_log', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          campaignId: campaignId || null,
          type: 'broadcast',
          title,
          body: body || '',
          status: failed === subscriptions.length ? 'failed' : 'sent',
        }),
      });
    } catch (logErr) {
      console.error('[push/broadcast] Log insert failed:', logErr.message);
    }

    return res.status(200).json({ sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('[push/broadcast] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ── Main router ───────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action;

  try {
    if (action === 'subscribe') return await handleSubscribe(req, res);
    if (action === 'send')      return await handleSend(req, res);
    if (action === 'broadcast') return await handleBroadcast(req, res);
    return res.status(400).json({
      error: 'Missing or invalid ?action= parameter',
      valid: ['subscribe', 'send', 'broadcast'],
    });
  } catch (error) {
    console.error(`[push/${action}] Unhandled error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
