// Vercel Serverless Function — Cron dispatcher
// Called by pg_cron via pg_net every hour (hourly) and daily at 9h BRT
// Auth: x-push-secret

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = 'https://vinnxbarber-erp.vercel.app';

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
  return res.ok ? await res.json() : [];
}

async function sendPush(clientId, title, body, tag, image) {
  return fetch(`${API_BASE}/api/push-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-push-secret': process.env.PUSH_API_SECRET,
    },
    body: JSON.stringify({ clientId, title, body, tag, image }),
  });
}

async function getConfig(id) {
  const configs = await sbQuery(`push_automation_config?id=eq.${id}&select=*&limit=1`);
  return configs?.[0] || null;
}

// ══════════════════════════════════════
// FLOW 1: REMINDERS (hourly)
// ══════════════════════════════════════
async function processReminders() {
  const config = await getConfig('reminder');
  if (!config?.enabled) return { flow: 'reminder', skipped: true };

  const hours = config.config?.hoursBeforeAppointment || 2;

  // Find events in the next N hours that haven't been reminded
  // date is TIMESTAMPTZ, startTime is TEXT like "08:30"
  const todayISO = new Date().toISOString().split('T')[0] + 'T00:00:00';
  const events = await sbQuery(
    `calendar_events?select=id,"clientId","serviceName","startTime",date` +
    `&status=eq.confirmed&"reminderSent"=eq.false` +
    `&date=gte.${todayISO}` +
    `&order=date.asc&limit=50`
  );

  let sent = 0;
  const now = new Date();
  const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000);

  for (const ev of events) {
    // Combine date + startTime to get actual datetime
    const datePart = new Date(ev.date).toISOString().split('T')[0]; // "2026-04-30"
    const eventTime = new Date(`${datePart}T${ev.startTime}:00-03:00`); // BRT

    if (eventTime > now && eventTime <= cutoff) {
      const template = config.messageTemplate || 'Lembrete: {servico} às {hora}';
      const body = template
        .replace('{servico}', ev.serviceName || 'Serviço')
        .replace('{hora}', ev.startTime);

      await sendPush(ev.clientId, '⏰ Lembrete', body, `reminder-${ev.id}`, config.imageUrl);

      // Mark as reminded
      await sbFetch(`calendar_events?id=eq.${ev.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ reminderSent: true }),
        headers: { Prefer: 'return=minimal' },
      });
      sent++;
    }
  }

  return { flow: 'reminder', sent };
}

// ══════════════════════════════════════
// FLOW 2: REVIEW REQUESTS (hourly)
// ══════════════════════════════════════
async function processReviews() {
  const config = await getConfig('review');
  if (!config?.enabled) return { flow: 'review', skipped: true };

  const hours = config.config?.hoursAfterCompletion || 3;
  const cutoffISO = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const events = await sbQuery(
    `calendar_events?select=id,"clientId","serviceName"` +
    `&status=eq.completed&rating=is.null&"ratingRequested"=eq.false` +
    `&"updatedAt"=lt.${cutoffISO}` +
    `&limit=50`
  );

  let sent = 0;
  for (const ev of events) {
    const template = config.messageTemplate || 'Como foi seu {servico}? Avalie! ⭐';
    const body = template.replace('{servico}', ev.serviceName || 'serviço');

    await sendPush(ev.clientId, '⭐ Avalie seu atendimento', body, `review-${ev.id}`, config.imageUrl);

    await sbFetch(`calendar_events?id=eq.${ev.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ratingRequested: true }),
      headers: { Prefer: 'return=minimal' },
    });
    sent++;
  }

  return { flow: 'review', sent };
}

// ══════════════════════════════════════
// FLOW 3: INCOMPLETE PROFILE (daily)
// ══════════════════════════════════════
async function processIncompleteProfiles() {
  const config = await getConfig('incomplete');
  if (!config?.enabled) return { flow: 'incomplete', skipped: true };

  const intervalDays = config.config?.intervalDays || 7;
  const maxAttempts = config.config?.maxAttempts || 3;
  const cutoffISO = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000).toISOString();

  // Get clients with auth and push subscriptions who have incomplete profiles
  const clients = await sbQuery(
    `clients?select=id,name,birthday,gender,phone,"profileNudgeCount","lastProfileNudge"` +
    `&"authUserId"=not.is.null` +
    `&"profileNudgeCount"=lt.${maxAttempts}` +
    `&or=(birthday.is.null,gender.is.null,phone.is.null)` +
    `&limit=50`
  );

  let sent = 0;
  for (const client of clients) {
    // Check interval
    if (client.lastProfileNudge && new Date(client.lastProfileNudge) > new Date(cutoffISO)) {
      continue;
    }

    // Check if client has a push subscription
    const subs = await sbQuery(`push_subscriptions?"clientId"=eq.${client.id}&select=id&limit=1`);
    if (!subs?.length) continue;

    // Build missing fields list
    const missing = [];
    if (!client.birthday) missing.push('data de nascimento');
    if (!client.gender) missing.push('gênero');
    if (!client.phone) missing.push('telefone');

    const body = (config.messageTemplate || 'Complete seu perfil! 🎁')
      + (missing.length ? ` Faltam: ${missing.join(', ')}` : '');

    await sendPush(client.id, '📝 Complete seu perfil', body, `incomplete-${client.id}`, config.imageUrl);

    // Update nudge tracking
    await sbFetch(`clients?id=eq.${client.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        profileNudgeCount: (client.profileNudgeCount || 0) + 1,
        lastProfileNudge: new Date().toISOString(),
      }),
      headers: { Prefer: 'return=minimal' },
    });
    sent++;
  }

  return { flow: 'incomplete', sent };
}

// ══════════════════════════════════════
// FLOW 4: BIRTHDAY (daily)
// ══════════════════════════════════════
async function processBirthdays() {
  const config = await getConfig('birthday');
  if (!config?.enabled) return { flow: 'birthday', skipped: true };

  // Get all clients with push subscriptions
  // Birthday matching is done in JS since PostgREST doesn't support EXTRACT
  const clients = await sbQuery(
    `clients?select=id,name,birthday` +
    `&birthday=not.is.null&"authUserId"=not.is.null&limit=500`
  );

  // Use BRT (UTC-3) for date comparison since cron runs in UTC
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayMonth = brt.getUTCMonth() + 1;
  const todayDay = brt.getUTCDate();

  let sent = 0;
  for (const client of clients) {
    const bday = new Date(client.birthday);
    if (bday.getMonth() + 1 !== todayMonth || bday.getDate() !== todayDay) continue;

    // Check if already sent today
    const todayISO = now.toISOString().split('T')[0];
    const logs = await sbQuery(
      `push_log?type=eq.birthday&"clientId"=eq.${client.id}` +
      `&"createdAt"=gte.${todayISO}T00:00:00&select=id&limit=1`
    );
    if (logs?.length) continue;

    // Check if has subscription
    const subs = await sbQuery(`push_subscriptions?"clientId"=eq.${client.id}&select=id&limit=1`);
    if (!subs?.length) continue;

    const discount = config.config?.discountPercent || 15;
    const body = (config.messageTemplate || 'Feliz aniversário! 🎂')
      .replace('{nome}', client.name || 'Cliente')
      .replace('{desconto}', String(discount));

    await sendPush(client.id, '🎂 Feliz Aniversário!', body, `birthday-${client.id}`, config.imageUrl);

    // Log birthday specifically
    await sbFetch('push_log', {
      method: 'POST',
      body: JSON.stringify({
        clientId: client.id,
        type: 'birthday',
        title: '🎂 Feliz Aniversário!',
        body,
        status: 'sent',
      }),
    });
    sent++;
  }

  return { flow: 'birthday', sent };
}

// ══════════════════════════════════════
// FLOW 5: SCHEDULED CAMPAIGNS (hourly)
// ══════════════════════════════════════
async function processScheduledCampaigns() {
  const nowISO = new Date().toISOString();

  // One-time scheduled campaigns
  const scheduled = await sbQuery(
    `push_campaigns?status=eq.scheduled&"scheduledAt"=lte.${nowISO}&enabled=eq.true&select=*`
  );

  // Recurring campaigns
  const recurring = await sbQuery(
    `push_campaigns?status=eq.recurring&enabled=eq.true&select=*`
  );

  let sent = 0;

  // Process one-time campaigns
  for (const c of scheduled) {
    await fetch(`${API_BASE}/api/push-broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': process.env.PUSH_API_SECRET,
      },
      body: JSON.stringify({
        title: c.title,
        body: c.body,
        image: c.imageUrl,
        url: c.targetUrl,
        campaignId: c.id,
        filterCriteria: c.filterCriteria,
      }),
    });
    sent++;
  }

  // Process recurring campaigns
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun, 4=Thu
  const dom = now.getUTCDate();

  for (const c of recurring) {
    if (!c.recurrence) continue;

    const [type, value] = c.recurrence.split(':');
    let shouldSend = false;

    if (type === 'weekly' && parseInt(value) === dow) shouldSend = true;
    if (type === 'monthly' && parseInt(value) === dom) shouldSend = true;

    if (!shouldSend) continue;

    // Check if already sent today
    const todayISO = now.toISOString().split('T')[0];
    const logs = await sbQuery(
      `push_log?"campaignId"=eq.${c.id}&"createdAt"=gte.${todayISO}T00:00:00&select=id&limit=1`
    );
    if (logs?.length) continue;

    await fetch(`${API_BASE}/api/push-broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': process.env.PUSH_API_SECRET,
      },
      body: JSON.stringify({
        title: c.title,
        body: c.body,
        image: c.imageUrl,
        url: c.targetUrl,
        campaignId: c.id,
        filterCriteria: c.filterCriteria,
      }),
    });
    sent++;
  }

  return { flow: 'campaigns', sent };
}

// ══════════════════════════════════════
// FLOW 6: INACTIVE CLIENTS (daily)
// ══════════════════════════════════════
async function processInactiveClients() {
  const config = await getConfig('inactive');
  if (!config?.enabled) return { flow: 'inactive', skipped: true };

  const inactiveDays = config.config?.inactiveDays || 30;
  const maxNudgesPerMonth = config.config?.maxNudgesPerMonth || 1;

  // Find clients with push subscriptions who haven't had a completed event recently
  const cutoffISO = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get all clients with push subscriptions
  const subs = await sbQuery(`push_subscriptions?select="clientId"&"clientId"=not.eq.anonymous`);
  if (!subs?.length) return { flow: 'inactive', sent: 0 };

  const clientIds = [...new Set(subs.map(s => s.clientId))];
  let sent = 0;

  for (const clientId of clientIds) {
    // Check last completed event for this client
    const recentEvents = await sbQuery(
      `calendar_events?"clientId"=eq.${clientId}&status=eq.completed&order=date.desc&limit=1&select=date`
    );

    // If they have recent events, skip
    if (recentEvents?.length) {
      const lastDate = new Date(recentEvents[0].date);
      if (lastDate > new Date(cutoffISO)) continue;
    }

    // Check if already nudged this month
    const recentNudges = await sbQuery(
      `push_log?type=eq.inactive&"clientId"=eq.${clientId}&"createdAt"=gte.${monthAgo}&select=id`
    );
    if (recentNudges?.length >= maxNudgesPerMonth) continue;

    const body = config.messageTemplate || 'Faz tempo que não te vemos! 💈 Agende seu horário';
    await sendPush(clientId, '💈 Sentimos sua falta!', body, `inactive-${clientId}`, config.imageUrl);

    // Log
    await sbFetch('push_log', {
      method: 'POST',
      body: JSON.stringify({
        clientId,
        type: 'inactive',
        title: '💈 Sentimos sua falta!',
        body,
        status: 'sent',
      }),
    });
    sent++;
  }

  return { flow: 'inactive', sent };
}

// ══════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════
export default async function handler(req, res) {
  // Accept GET (for pg_cron/Vercel cron) and POST (for direct calls)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: x-push-secret from header or query param
  const secret = req.headers['x-push-secret'] || req.query?.secret;
  if (!secret || secret !== process.env.PUSH_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.body?.type || req.query?.type;
  const results = [];

  try {
    if (type === 'hourly') {
      results.push(await processReminders());
      results.push(await processReviews());
      results.push(await processScheduledCampaigns());
    } else if (type === 'daily') {
      results.push(await processIncompleteProfiles());
      results.push(await processBirthdays());
      results.push(await processInactiveClients());
    } else {
      return res.status(400).json({ error: 'Invalid type. Use hourly or daily.' });
    }

    return res.status(200).json({ type, results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[push-cron] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
