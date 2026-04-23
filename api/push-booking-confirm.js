// Vercel Serverless — Send booking confirmation push
// No auth needed — validates event age (60s window) to prevent abuse

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = 'https://vinnxbarber-erp.vercel.app';

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return res;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    // Fetch event
    const evRes = await sbFetch(
      `calendar_events?id=eq.${encodeURIComponent(eventId)}&select=id,"clientId","serviceName","startTime","barberName","createdAt"&limit=1`
    );
    const events = await evRes.json();
    const event = events?.[0];

    if (!event?.clientId) {
      return res.status(200).json({ sent: 0, message: 'No client on event' });
    }

    // Security: only allow events created in the last 2 minutes
    const createdAt = event.createdAt ? new Date(event.createdAt).getTime() : 0;
    const age = Date.now() - createdAt;
    if (age > 120000) {
      return res.status(200).json({ sent: 0, message: 'Event too old for confirmation push' });
    }

    // Send push via internal push-send API
    const sendRes = await fetch(`${API_BASE}/api/push-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': process.env.PUSH_API_SECRET,
      },
      body: JSON.stringify({
        clientId: event.clientId,
        title: '✅ Agendamento Confirmado',
        body: `${event.serviceName || 'Serviço'} às ${event.startTime}${event.barberName ? ` com ${event.barberName}` : ''}`,
        tag: `booking-${eventId}`,
        url: '/#/site',
      }),
    });

    const result = await sendRes.json();
    return res.status(200).json(result);
  } catch (error) {
    console.error('[push-booking-confirm] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
