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

    // ═══ SUBSCRIPTION_* events have different payload structure ═══
    if (event?.startsWith('SUBSCRIPTION_')) {
      const subData = payload.subscription;
      if (!subData?.id) {
        return res.status(200).json({ status: 'ignored', reason: 'no_subscription_data' });
      }
      console.log(`[asaas-webhook] Subscription event: ${event}, Sub: ${subData.id}, Status: ${subData.status}`);

      // Find local subscription by gateway ID
      const subRes = await sbQuery(
        `subscriptions?gatewaySubscriptionId=eq.${subData.id}&select=*&limit=1`,
        { headers: { Prefer: 'return=representation' } }
      );
      const subs = await subRes.json();
      const localSub = subs?.[0];
      if (!localSub) {
        console.warn(`[asaas-webhook] No local subscription for ASAAS sub ${subData.id}`);
        return res.status(200).json({ status: 'no_local_sub' });
      }

      const subUpdates = { lastWebhookAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

      switch (event) {
        case 'SUBSCRIPTION_DELETED':
        case 'SUBSCRIPTION_INACTIVATED':
          // Only cancel if not already cancelled (avoid re-processing)
          if (localSub.status !== 'cancelled') {
            subUpdates.status = 'cancelled';
            subUpdates.cancelledAt = new Date().toISOString();
            // Set endDate to end of current billing cycle if not already set
            if (!localSub.endDate && localSub.nextPaymentDate) {
              subUpdates.endDate = localSub.nextPaymentDate;
            }
            console.log(`[asaas-webhook] Subscription ${localSub.id} cancelled via ASAAS panel`);
          }
          break;
        case 'SUBSCRIPTION_UPDATED':
          // Sync changes from ASAAS panel
          // Note: price lives on subscription_plans, not subscriptions — value changes are logged only
          if (subData.value) {
            console.log(`[asaas-webhook] SUBSCRIPTION_UPDATED: ASAAS value=${subData.value} for sub ${localSub.id} (price lives on plan, not synced here)`);
          }
          if (subData.nextDueDate) {
            subUpdates.nextPaymentDate = subData.nextDueDate;
          }
          break;
      }

      if (Object.keys(subUpdates).length > 2) { // more than just lastWebhookAt + updatedAt
        await sbQuery(`subscriptions?id=eq.${localSub.id}`, {
          method: 'PATCH',
          body: JSON.stringify(subUpdates),
        });
        console.log(`[asaas-webhook] Subscription ${localSub.id} updated:`, Object.keys(subUpdates));
      }

      return res.status(200).json({ status: 'processed_subscription_event' });
    }

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
    const baseEvent = {
      id: eventId,
      subscriptionId: subscription?.id || null,
      clientId: subscription?.clientId || payment.customer || null,
      asaasPaymentId: payment.id,
      event: event,
      status: payment.status,
      amount: payment.value ?? null,
      billingType: payment.billingType || null,
      dueDate: payment.dueDate || null,
      paymentDate: payment.paymentDate || null,
      invoiceUrl: payment.invoiceUrl || null,
      bankSlipUrl: payment.bankSlipUrl || null,
      pixQrCode: payment.pixQrCodePayload ? `https://api.asaas.com/v3/payments/${payment.id}/pixQrCode` : null,
      raw: payload,
      processedAt: new Date().toISOString(),
    };
    // Financial fields (F4) — may not exist if SQL migration hasn't run
    const extendedEvent = {
      ...baseEvent,
      netValue: payment.netValue ?? null,
      transactionReceiptUrl: payment.transactionReceiptUrl || null,
      creditDate: payment.creditDate || null,
      confirmedDate: payment.confirmedDate || null,
      invoiceNumber: payment.invoiceNumber || null,
    };

    try {
      await sbQuery('billing_events', {
        method: 'POST',
        body: JSON.stringify(extendedEvent),
      });
    } catch (insertErr) {
      // Fallback: retry without new columns (migration not yet applied)
      console.warn('[asaas-webhook] Extended INSERT failed, retrying base-only:', insertErr.message);
      await sbQuery('billing_events', {
        method: 'POST',
        body: JSON.stringify(baseEvent),
      });
    }

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
          // Apply pending plan change if scheduled date has passed
          if (subscription.pendingPlanId && subscription.planChangeScheduledAt) {
            const scheduled = new Date(subscription.planChangeScheduledAt);
            if (scheduled <= new Date()) {
              updates.planId = subscription.pendingPlanId;
              updates.pendingPlanId = null;
              updates.pendingPlanName = null;
              updates.planChangeScheduledAt = null;
              updates.usesThisMonth = 0;
              console.log(`[asaas-webhook] Applied pending plan change for sub ${subscription.id}`);
            }
          }
          // Calculate next payment date proactively (avoids stale date between CONFIRMED and next CREATED)
          if (payment.dueDate) {
            try {
              const planId = updates.planId || subscription.planId;
              const planRes = await sbQuery(
                `subscription_plans?id=eq.${planId}&select=recurrence&limit=1`,
                { headers: { Prefer: 'return=representation' } }
              );
              const plans = await planRes.json();
              const recurrence = plans?.[0]?.recurrence || 'monthly';
              const nextDate = new Date(payment.dueDate);
              switch (recurrence) {
                case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
                case 'semiannual': nextDate.setMonth(nextDate.getMonth() + 6); break;
                case 'annual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
                default: nextDate.setMonth(nextDate.getMonth() + 1); // monthly
              }
              updates.nextPaymentDate = nextDate.toISOString().split('T')[0];
            } catch (e) {
              console.warn('[asaas-webhook] Could not calculate next payment date:', e.message);
            }
          }
          break;

        case 'PAYMENT_OVERDUE':
          updates.status = 'overdue';
          updates.failedAttempts = (subscription.failedAttempts || 0) + 1;

          // ── Push notification for failed payment ──
          if (subscription.clientId) {
            try {
              const pushRes = await sbQuery(
                `push_subscriptions?clientId=eq.${subscription.clientId}&select=endpoint,keys&limit=5`,
                { headers: { Prefer: 'return=representation' } }
              );
              const pushSubs = await pushRes.json();
              if (pushSubs?.length > 0) {
                const VAPID_PUBLIC = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
                const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
                if (VAPID_PUBLIC && VAPID_PRIVATE) {
                  const webpush = await import('web-push');
                  webpush.default.setVapidDetails('mailto:noreply@vinnxbarber.com', VAPID_PUBLIC, VAPID_PRIVATE);
                  const amount = Number(payment.value || 0).toFixed(2);
                  const notifPayload = JSON.stringify({
                    title: '⚠️ Pagamento recusado',
                    body: `Sua cobrança de R$ ${amount} não foi processada. Atualize seu cartão para manter seus benefícios.`,
                    icon: '/pwa-192x192.png',
                    tag: `overdue-${payment.id}`,
                  });
                  for (const ps of pushSubs) {
                    try {
                      await webpush.default.sendNotification({ endpoint: ps.endpoint, keys: ps.keys }, notifPayload);
                    } catch (pushErr) {
                      console.warn('[asaas-webhook] Overdue push failed:', pushErr.statusCode || pushErr.message);
                    }
                  }
                  console.log(`[asaas-webhook] Overdue notification sent to ${pushSubs.length} devices`);
                }
              }
            } catch (notifErr) {
              console.warn('[asaas-webhook] Overdue notification error (non-fatal):', notifErr.message);
            }
          }

          // ── Auto-cancel after 3 consecutive failures (S3) ──
          if (updates.failedAttempts >= 3) {
            console.log(`[asaas-webhook] Auto-cancelling subscription ${subscription.id} after ${updates.failedAttempts} failed attempts`);
            updates.status = 'cancelled';
            updates.cancelledAt = new Date().toISOString();
            updates.cancellationReason = 'Cancelado automaticamente por inadimplência (3 tentativas de pagamento falharam)';
            // Cancel in ASAAS gateway
            if (subscription.gatewaySubscriptionId) {
              try {
                const configs = await sbQuery(
                  `billing_gateway_config?active=eq.true&select=apiKey,environment&limit=1`,
                  { headers: { Prefer: 'return=representation' } }
                );
                const config = (await configs.json())?.[0];
                if (config) {
                  const baseUrl = config.environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
                  await fetch(`${baseUrl}/subscriptions/${subscription.gatewaySubscriptionId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', 'access_token': config.apiKey },
                  });
                  console.log(`[asaas-webhook] ASAAS subscription ${subscription.gatewaySubscriptionId} auto-cancelled`);
                }
              } catch (gwErr) {
                console.warn('[asaas-webhook] ASAAS auto-cancel failed (non-fatal):', gwErr.message);
              }
            }
          }
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
          // F6: Only update nextPaymentDate if the new date is AFTER the current one
          // Prevents PAYMENT_CREATED from overwriting a correct future date set by PAYMENT_CONFIRMED
          if (payment.dueDate) {
            const newDue = new Date(payment.dueDate);
            const currentNext = subscription.nextPaymentDate ? new Date(subscription.nextPaymentDate) : null;
            if (!currentNext || newDue > currentNext) {
              updates.nextPaymentDate = payment.dueDate;
            }
          }

          // ── F2: Push notification for upcoming payment ──
          if (event === 'PAYMENT_CREATED' && payment.dueDate && subscription.clientId) {
            try {
              const dueDate = new Date(payment.dueDate);
              const now = new Date();
              const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
              if (daysUntilDue >= 0 && daysUntilDue <= 3) {
                // Fetch client push subscriptions
                const pushRes = await sbQuery(
                  `push_subscriptions?clientId=eq.${subscription.clientId}&select=endpoint,keys&limit=5`,
                  { headers: { Prefer: 'return=representation' } }
                );
                const pushSubs = await pushRes.json();
                if (pushSubs?.length > 0) {
                  const VAPID_PUBLIC = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
                  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
                  if (VAPID_PUBLIC && VAPID_PRIVATE) {
                    const webpush = await import('web-push');
                    webpush.default.setVapidDetails('mailto:noreply@vinnxbarber.com', VAPID_PUBLIC, VAPID_PRIVATE);
                    const amount = Number(payment.value || 0).toFixed(2);
                    const dayLabel = daysUntilDue === 0 ? 'hoje' : daysUntilDue === 1 ? 'amanhã' : `em ${daysUntilDue} dias`;
                    const notifPayload = JSON.stringify({
                      title: '💳 Cobrança próxima',
                      body: `Sua assinatura de R$ ${amount} será cobrada ${dayLabel}.`,
                      icon: '/pwa-192x192.png',
                      tag: `payment-${payment.id}`,
                    });
                    for (const ps of pushSubs) {
                      try {
                        await webpush.default.sendNotification({ endpoint: ps.endpoint, keys: ps.keys }, notifPayload);
                      } catch (pushErr) {
                        console.warn('[asaas-webhook] Push failed:', pushErr.statusCode || pushErr.message);
                      }
                    }
                    console.log(`[asaas-webhook] Payment reminder sent to ${pushSubs.length} devices (due ${dayLabel})`);
                  }
                }
              }
            } catch (notifErr) {
              console.warn('[asaas-webhook] Notification error (non-fatal):', notifErr.message);
            }
          }
          break;

        case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
          updates.status = 'overdue';
          updates.failedAttempts = (subscription.failedAttempts || 0) + 1;
          break;

        case 'PAYMENT_RESTORED':
          // Cobrança restaurada após remoção — reativar
          // Guard: não reativar subs já canceladas (auto-cancel por inadimplência)
          if (subscription.status !== 'cancelled') {
            updates.status = 'active';
            updates.failedAttempts = 0;
          } else {
            console.log(`[asaas-webhook] PAYMENT_RESTORED ignored — subscription ${subscription.id} is cancelled`);
          }
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
