// Vercel Serverless Function — ASAAS Webhook Handler
// Auth: x-asaas-access-token (configured in billing_gateway_config)
// Receives payment events from ASAAS and reconciles with local subscriptions

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sbQuery(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=minimal',
      ...options.headers,
    },
  });
  if (!res.ok && res.status !== 404 && res.status !== 406) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

// Verify webhook authenticity via stored secret
async function verifyWebhookSecret(req) {
  const token = req.headers['asaas-access-token'] || req.headers['x-asaas-access-token'];
  if (!token) return false;

  const res = await sbQuery(
    `billing_gateway_config?active=eq.true&select=webhookSecret&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const configs = await res.json();
  if (!configs?.length) return false;
  return configs[0].webhookSecret === token;
}

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook secret
    const isValid = await verifyWebhookSecret(req);
    if (!isValid) {
      console.warn('[asaas-webhook] Invalid webhook secret — event ignored');
      // Return 200 to avoid ASAAS pausing the webhook queue (they count non-200 as failures)
      return res.status(200).json({ status: 'ignored', reason: 'invalid_secret' });
    }

    const payload = req.body;
    const { event, payment } = payload;

    if (!event || !payment) {
      return res.status(400).json({ error: 'Invalid payload: missing event or payment' });
    }

    console.log(`[asaas-webhook] Event: ${event}, Payment: ${payment.id}, Status: ${payment.status}`);

    // Idempotency check — skip if already processed
    const existingRes = await sbQuery(
      `billing_events?asaasPaymentId=eq.${payment.id}&event=eq.${event}&select=id&limit=1`,
      { headers: { Prefer: 'return=representation' } }
    );
    const existing = await existingRes.json();
    if (existing?.length > 0) {
      console.log('[asaas-webhook] Event already processed, skipping');
      return res.status(200).json({ status: 'already_processed' });
    }

    // Find subscription by gatewaySubscriptionId or gatewayCustomerId
    let subscription = null;
    if (payment.subscription) {
      const subRes = await sbQuery(
        `subscriptions?gatewaySubscriptionId=eq.${payment.subscription}&select=*&limit=1`,
        { headers: { Prefer: 'return=representation' } }
      );
      const subs = await subRes.json();
      subscription = subs?.[0] || null;
    }
    if (!subscription && payment.customer) {
      // Search for any non-cancelled subscription for this customer (not just active)
      const subRes = await sbQuery(
        `subscriptions?gatewayCustomerId=eq.${payment.customer}&status=neq.cancelled&select=*&order=createdAt.desc&limit=1`,
        { headers: { Prefer: 'return=representation' } }
      );
      const subs = await subRes.json();
      subscription = subs?.[0] || null;
    }

    // Log the billing event
    const eventId = crypto.randomUUID();
    await sbQuery('billing_events', {
      method: 'POST',
      body: JSON.stringify({
        id: eventId,
        subscriptionId: subscription?.id || null,
        clientId: subscription?.clientId || payment.customer || null,
        asaasPaymentId: payment.id,
        event: event,
        status: payment.status,
        amount: payment.value || null,
        billingType: payment.billingType || null,
        dueDate: payment.dueDate || null,
        paymentDate: payment.paymentDate || null,
        invoiceUrl: payment.invoiceUrl || null,
        bankSlipUrl: payment.bankSlipUrl || null,
        pixQrCode: payment.pixQrCodePayload ? `https://api.asaas.com/v3/payments/${payment.id}/pixQrCode` : null,
        raw: payload,
        processedAt: new Date().toISOString(),
      }),
    });

    // Update subscription based on event type
    if (subscription) {
      const updates = {};
      updates.lastWebhookAt = new Date().toISOString();

      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
          updates.status = 'active';
          updates.lastPaymentDate = payment.paymentDate || new Date().toISOString();
          updates.failedAttempts = 0;
          updates.currentInvoiceUrl = payment.invoiceUrl || subscription.currentInvoiceUrl;
          break;

        case 'PAYMENT_OVERDUE':
          updates.status = 'overdue';
          updates.failedAttempts = (subscription.failedAttempts || 0) + 1;
          break;

        case 'PAYMENT_DELETED':
        case 'PAYMENT_REFUNDED':
        case 'PAYMENT_CHARGEBACK_REQUESTED':
          // Don't auto-cancel, just log
          break;

        case 'PAYMENT_CREATED':
        case 'PAYMENT_UPDATED':
          updates.currentInvoiceUrl = payment.invoiceUrl || subscription.currentInvoiceUrl;
          updates.currentBankSlipUrl = payment.bankSlipUrl || subscription.currentBankSlipUrl;
          if (payment.dueDate) updates.nextPaymentDate = payment.dueDate;
          break;

        case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
          updates.status = 'overdue';
          updates.failedAttempts = (subscription.failedAttempts || 0) + 1;
          break;

        default:
          console.log(`[asaas-webhook] Unhandled event: ${event}`);
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        await sbQuery(`subscriptions?id=eq.${subscription.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        console.log(`[asaas-webhook] Subscription ${subscription.id} updated:`, Object.keys(updates));
      }
    } else {
      console.warn(`[asaas-webhook] No matching subscription for payment ${payment.id}`);
    }

    return res.status(200).json({ status: 'processed', eventId });
  } catch (error) {
    console.error('[asaas-webhook] Error:', error);
    // CRITICAL: Always return 200 to ASAAS even on internal errors
    // ASAAS pauses the webhook queue after 15 consecutive non-200 responses
    return res.status(200).json({ status: 'error', error: error.message || 'Internal server error' });
  }
}
