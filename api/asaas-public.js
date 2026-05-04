// Vercel Serverless Function — ASAAS Public Operations (Client Self-Service)
// Auth: JWT (any authenticated user via Supabase Auth)
// Actions: createSubscription, getMySubscription, cancelMySubscription, pauseMySubscription,
//          getMyPaymentHistory, updatePaymentMethod, reactivateSubscription, changePlan

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sbQuery(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok && res.status !== 404 && res.status !== 406) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

// Verify JWT — returns client record (not admin check)
async function verifyClient(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');

  // Verify token with Supabase Auth
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!verifyRes.ok) return null;
  const user = await verifyRes.json();
  if (!user?.id) return null;

  // Find the client record linked to this auth user
  const clientRes = await sbQuery(
    `clients?authUserId=eq.${user.id}&select=*&limit=1`
  );
  const clients = await clientRes.json();
  if (!clients?.length) {
    // Try by email as fallback
    if (user.email) {
      const clientByEmail = await sbQuery(
        `clients?email=eq.${encodeURIComponent(user.email)}&select=*&limit=1`
      );
      const byEmail = await clientByEmail.json();
      if (byEmail?.length) {
        // Auto-link authUserId to prevent future ambiguity
        await sbQuery(`clients?id=eq.${byEmail[0].id}`, {
          method: 'PATCH',
          body: JSON.stringify({ authUserId: user.id, updatedAt: new Date().toISOString() }),
          prefer: 'return=minimal',
        });
        console.log(`[asaas-public] Auto-linked authUserId ${user.id} to client ${byEmail[0].id} via email fallback`);
        return byEmail[0];
      }
    }
    return null;
  }
  return clients[0];
}

// Get active billing config
async function getConfig() {
  const res = await sbQuery(`billing_gateway_config?active=eq.true&select=*&limit=1`);
  const configs = await res.json();
  return configs?.[0] || null;
}

// Cancel pending charges for a subscription (F11)
// ASAAS does NOT auto-cancel pending charges when a subscription is deleted
async function cancelPendingCharges(config, gatewaySubId) {
  try {
    const payments = await asaasRequest(config, `/subscriptions/${gatewaySubId}/payments?status=PENDING&limit=50`);
    let cancelled = 0;
    for (const p of (payments.data || [])) {
      try {
        await asaasRequest(config, `/payments/${p.id}`, 'DELETE');
        cancelled++;
      } catch (e) {
        console.warn(`[asaas-public] Failed to cancel payment ${p.id}:`, e.message);
      }
    }
    if (cancelled > 0) console.log(`[asaas-public] Cancelled ${cancelled} pending charge(s) for sub ${gatewaySubId}`);
    return cancelled;
  } catch (e) {
    console.warn('[asaas-public] cancelPendingCharges failed:', e.message);
    return 0;
  }
}

// ASAAS API call
async function asaasRequest(config, path, method = 'GET', body = null) {
  const baseUrl = config.environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': config.apiKey,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${baseUrl}${path}`, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.errors?.[0]?.description || `ASAAS ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export default async function handler(req, res) {
  // CORS — restrict to known origins
  const allowedOrigins = [
    process.env.PUBLIC_SITE_URL,
    'http://localhost:5173',
    'http://localhost:4173',
  ].filter(Boolean);
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.length === 0) {
    // Fallback: if no PUBLIC_SITE_URL is configured, allow all (dev mode)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth check — any authenticated client (not admin)
    const client = await verifyClient(req);
    if (!client) {
      return res.status(401).json({ error: 'Autenticação necessária. Faça login para continuar.' });
    }

    const { action, data } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    console.log(`[asaas-public] Action: ${action}, Client: ${client.name} (${client.id})`);

    switch (action) {
      // ═══ Create Subscription (combined flow) ═══
      case 'createSubscription': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Sistema de pagamento não configurado. Entre em contato com o estabelecimento.' });

        const { planId, creditCard, holderInfo, unitId } = data;
        if (!planId) return res.status(400).json({ error: 'Plano não selecionado.' });
        if (!creditCard?.number) return res.status(400).json({ error: 'Dados do cartão obrigatórios.' });

        // 1. Get plan details
        const planRes = await sbQuery(`subscription_plans?id=eq.${planId}&select=*&limit=1`);
        const plans = await planRes.json();
        const plan = plans?.[0];
        if (!plan) return res.status(400).json({ error: 'Plano não encontrado.' });
        if (!plan.active) return res.status(400).json({ error: 'Este plano não está mais disponível.' });

        // 2. Resolve unitId early (needed for duplicate and overdue checks)
        let resolvedUnitId = unitId || null;
        if (!resolvedUnitId && plan.allowedUnitIds) {
          try {
            const parsedUnits = typeof plan.allowedUnitIds === 'string' ? JSON.parse(plan.allowedUnitIds) : plan.allowedUnitIds;
            if (Array.isArray(parsedUnits) && parsedUnits.length > 0) resolvedUnitId = parsedUnits[0];
          } catch (_) {}
        }

        // 2b. Check for existing active subscription in same unit
        const existingSubRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(active,pending_payment)${resolvedUnitId ? `&unitId=eq.${resolvedUnitId}` : ''}&select=id&limit=1`
        );
        const existingSubs = await existingSubRes.json();
        if (existingSubs?.length > 0) {
          return res.status(400).json({ error: 'Você já possui uma assinatura ativa. Cancele a atual antes de assinar um novo plano.' });
        }

        // 2c. Check for existing overdue/cancelled subscription to reuse (same pattern as admin)
        let reuseSubId = null;
        let oldGatewaySubId = null;
        let oldSubStatus = null;
        const overdueRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(overdue,cancelled)${resolvedUnitId ? `&unitId=eq.${resolvedUnitId}` : ''}&select=id,status,gatewaySubscriptionId&order=createdAt.desc&limit=1`
        );
        const overdueSubs = await overdueRes.json();
        if (overdueSubs?.length > 0) {
          reuseSubId = overdueSubs[0].id;
          oldGatewaySubId = overdueSubs[0].gatewaySubscriptionId || null;
          oldSubStatus = overdueSubs[0].status;
        }

        // 3. Get/save CPF
        const cpfCnpj = (holderInfo?.cpfCnpj || client.cpfCnpj || client.cpf || '').replace(/\D/g, '');
        if (!cpfCnpj || cpfCnpj.length < 11) {
          return res.status(400).json({ error: 'CPF/CNPJ obrigatório para cobrança.' });
        }

        // Save CPF to client if not already set
        if (!client.cpfCnpj && !client.cpf) {
          await sbQuery(`clients?id=eq.${client.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ cpfCnpj: holderInfo.cpfCnpj || cpfCnpj }),
            prefer: 'return=minimal',
          });
        }

        // 4. Create/find ASAAS customer
        let customerId;
        try {
          const existing = await asaasRequest(config, `/customers?cpfCnpj=${cpfCnpj}`, 'GET');
          if (existing?.data?.length > 0) {
            customerId = (existing.data.find(c => !c.deleted) || existing.data[0]).id;
            console.log(`[asaas-public] Reusing customer: ${customerId}`);
          }
        } catch (e) {
          console.log('[asaas-public] Customer search failed:', e.message);
        }

        if (!customerId) {
          const customer = await asaasRequest(config, '/customers', 'POST', {
            name: client.name,
            cpfCnpj,
            email: holderInfo?.email || client.email || undefined,
            mobilePhone: (holderInfo?.phone || client.phone || '').replace(/\D/g, '') || undefined,
            externalReference: client.id,
            notificationDisabled: !config.sendNotifications,
          });
          customerId = customer.id;
        }

        // Update client with asaasCustomerId
        await sbQuery(`clients?id=eq.${client.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ asaasCustomerId: customerId }),
          prefer: 'return=minimal',
        });

        // 5. Create or reuse local subscription record (pending_payment)
        const subscriptionId = reuseSubId || crypto.randomUUID();
        const now = new Date().toISOString();
        const today = now.split('T')[0];

        const subRecord = {
            id: subscriptionId,
            planId,
            clientId: client.id,
            clientName: client.name,
            status: 'pending_payment',
            startDate: today,
            usesThisMonth: 0,
            paymentDay: new Date().getDate(),
            paymentMethod: 'credit',
            gatewayCustomerId: customerId,
            billingEmail: holderInfo?.email || client.email || null,
            autoRenew: true,
            unitId: resolvedUnitId,
            saleChannel: 'site',
            // Clear stale fields from previous subscription lifecycle
            cancelledAt: null,
            endDate: null,
            cancellationReason: null,
            failedAttempts: 0,
            lastPaymentDate: null,
            nextPaymentDate: null,
            pausedAt: null,
            lastWebhookAt: null,
            updatedAt: now,
        };

        if (reuseSubId) {
          // Reuse existing overdue subscription
          await sbQuery(`subscriptions?id=eq.${reuseSubId}`, {
            method: 'PATCH',
            body: JSON.stringify(subRecord),
            prefer: 'return=minimal',
          });
        } else {
          // Create new subscription
          await sbQuery('subscriptions', {
            method: 'POST',
            body: JSON.stringify({ ...subRecord, createdAt: now }),
            prefer: 'return=minimal',
          });
        }

        // 5b. Cancel old ASAAS subscription if reusing (prevents duplicate charges)
        if (reuseSubId && oldGatewaySubId) {
          try {
            await asaasRequest(config, `/subscriptions/${oldGatewaySubId}`, 'DELETE');
            console.log(`[asaas-public] Cancelled old ASAAS sub: ${oldGatewaySubId}`);
          } catch (e) {
            console.warn('[asaas-public] Old ASAAS sub cancel failed (may already be cancelled):', e.message);
          }
        }

        // 6. Tokenize credit card
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
        let creditCardToken;
        let tokenBrand = '';
        let tokenLast4 = '';

        const cardData = {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\s/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        };
        const holderData = {
          name: creditCard.holderName || client.name,
          email: holderInfo?.email || client.email,
          cpfCnpj,
          postalCode: (holderInfo?.postalCode || '').replace(/\D/g, ''),
          addressNumber: holderInfo?.addressNumber || '',
          phone: (holderInfo?.phone || client.phone || '').replace(/\D/g, ''),
        };

        try {
          const tokenResult = await asaasRequest(config, '/creditCard/tokenize', 'POST', {
            customer: customerId,
            creditCard: cardData,
            creditCardHolderInfo: holderData,
            remoteIp,
          });
          creditCardToken = tokenResult.creditCardToken;
          tokenBrand = tokenResult.creditCardBrand || '';
          tokenLast4 = tokenResult.creditCardNumber || '';
          console.log(`[asaas-public] Card tokenized: ${tokenBrand} ${tokenLast4}`);
        } catch (tokenErr) {
          const isPermissionError = tokenErr.message?.includes('permissão') || tokenErr.message?.includes('permission');
          if (!isPermissionError) {
            // Card error — revert subscription and return error
            if (reuseSubId) {
              // Revert reused sub back to original status (don't delete existing record)
              await sbQuery(`subscriptions?id=eq.${subscriptionId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: oldSubStatus || 'overdue',
                  cancelledAt: oldSubStatus === 'cancelled' ? new Date().toISOString() : null,
                  updatedAt: new Date().toISOString(),
                }),
                prefer: 'return=minimal',
              });
            } else {
              // Delete newly created sub
              await sbQuery(`subscriptions?id=eq.${subscriptionId}`, { method: 'DELETE' });
            }
            return res.status(400).json({
              success: false,
              error: tokenErr.message || 'Cartão recusado. Verifique os dados e tente novamente.',
              errorCode: 'CARD_VALIDATION_FAILED',
            });
          }
          // Tokenization not available on this account — use raw card data
          console.log('[asaas-public] Tokenization not available, using raw card data');
        }

        // 7. Create ASAAS subscription
        const recurrenceMap = { monthly: 'MONTHLY', quarterly: 'QUARTERLY', semiannual: 'SEMIANNUALLY', annual: 'YEARLY' };
        const planPrice = Number(plan.creditPrice) || Number(plan.price) || 0;

        const subPayload = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: planPrice,
          nextDueDate: today,
          cycle: recurrenceMap[plan.recurrence] || 'MONTHLY',
          description: `Plano ${plan.name}`,
          externalReference: subscriptionId,
          fine: { value: config.finePercent || 0 },
          interest: { value: config.interestPercent || 0 },
          notifyPaymentCreatedImmediately: true,
        };

        if (creditCardToken) {
          subPayload.creditCardToken = creditCardToken;
          subPayload.remoteIp = remoteIp;
        } else {
          subPayload.creditCard = cardData;
          subPayload.creditCardHolderInfo = holderData;
          subPayload.remoteIp = remoteIp;
        }

        let asaasSub;
        try {
          asaasSub = await asaasRequest(config, '/subscriptions', 'POST', subPayload);
        } catch (subErr) {
          // Subscription creation failed — revert to original status
          await sbQuery(`subscriptions?id=eq.${subscriptionId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: reuseSubId ? (oldSubStatus || 'overdue') : 'overdue',
              cancelledAt: (reuseSubId && oldSubStatus === 'cancelled') ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            }),
            prefer: 'return=minimal',
          });
          return res.status(400).json({
            success: false,
            error: subErr.message || 'Não foi possível criar a assinatura. Tente novamente.',
            errorCode: 'SUBSCRIPTION_CREATION_FAILED',
          });
        }

        // 8. Update local subscription with gateway IDs
        const updateData = {
          gatewaySubscriptionId: asaasSub.id,
          gatewayCustomerId: customerId,
          cardBrand: tokenBrand || null,
          cardLast4: tokenLast4 || null,
          creditCardToken: creditCardToken || null,
          updatedAt: new Date().toISOString(),
        };

        // Check first payment status
        let firstPaymentStatus = null;
        try {
          const payments = await asaasRequest(config, `/subscriptions/${asaasSub.id}/payments?limit=1`, 'GET');
          if (payments?.data?.length > 0) {
            firstPaymentStatus = payments.data[0].status;
          }
        } catch (e) {
          console.log('[asaas-public] Could not fetch first payment:', e.message);
        }

        // Set subscription status based on payment result
        if (firstPaymentStatus === 'CONFIRMED' || firstPaymentStatus === 'RECEIVED') {
          updateData.status = 'active';
          updateData.lastPaymentDate = new Date().toISOString();
        } else if (firstPaymentStatus === 'REFUSED' || firstPaymentStatus === 'OVERDUE') {
          updateData.status = 'overdue';
        }
        // else: stays as 'pending_payment' — webhook will update

        await sbQuery(`subscriptions?id=eq.${subscriptionId}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
          prefer: 'return=minimal',
        });

        return res.status(200).json({
          success: true,
          subscriptionId,
          paymentStatus: firstPaymentStatus || 'PENDING',
          finalStatus: updateData.status || 'pending_payment',
          cardBrand: tokenBrand,
          cardLast4: tokenLast4,
          planName: plan.name,
          planPrice,
        });
      }

      // ═══ Get My Subscription ═══
      case 'getMySubscription': {
        // F12: Include cancelled subs that still have active benefits (endDate > now)
        const now = new Date().toISOString();
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&select=*,subscription_plans(*)&order=createdAt.desc&limit=1&or=(status.neq.cancelled,and(status.eq.cancelled,endDate.gt.${now}))`
        );
        const subs = await subRes.json();
        const sub = subs?.[0] || null;
        return res.status(200).json({ success: true, subscription: sub });
      }

      // ═══ Cancel My Subscription (SOFT CANCEL) ═══
      case 'cancelMySubscription': {
        const { reason } = data || {};
        // Find active subscription for this client
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(active,pending_payment,paused,overdue)&select=*&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub) return res.status(400).json({ error: 'Nenhuma assinatura encontrada.' });

        // Calculate when benefits expire (end of current paid period)
        // Only grant benefit period if there was at least one confirmed payment
        const hadSuccessfulPayment = !!sub.lastPaymentDate;
        const endDate = hadSuccessfulPayment
          ? (sub.nextPaymentDate || sub.endDate || new Date().toISOString())
          : new Date().toISOString(); // Never paid → no benefit period

        // SOFT CANCEL: keep ASAAS subscription alive for zero-cost reactivation
        // Only cancel pending charges to prevent next billing cycle charge
        // Hard cancel (DELETE) only if client never paid — no benefit period to preserve
        if (sub.gatewaySubscriptionId) {
          const config = await getConfig();
          if (config) {
            if (!hadSuccessfulPayment) {
              // Never paid → hard cancel immediately (no benefit period, no reactivation value)
              try {
                await cancelPendingCharges(config, sub.gatewaySubscriptionId);
                await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}`, 'DELETE');
                console.log(`[asaas-public] Hard cancel (never paid): ${sub.gatewaySubscriptionId}`);
              } catch (e) {
                console.error('[asaas-public] ASAAS hard cancel FAILED:', e.message);
                if (!e.message?.includes('not_found') && !e.message?.includes('404')) {
                  return res.status(400).json({
                    error: 'Não foi possível cancelar a assinatura no gateway de pagamento. Tente novamente ou entre em contato com o suporte.',
                    errorCode: 'GATEWAY_CANCEL_FAILED',
                  });
                }
              }
            } else {
              // Paid → SOFT CANCEL: cancel pending charges but keep Asaas sub alive
              // The daily hard-cancel cron will DELETE the Asaas sub when endDate arrives
              try {
                const cleared = await cancelPendingCharges(config, sub.gatewaySubscriptionId);
                console.log(`[asaas-public] Soft cancel: ${cleared} pending charge(s) cleared for ${sub.gatewaySubscriptionId}, Asaas sub kept alive`);
              } catch (e) {
                // Non-fatal: charges may already be cleared or sub may be in a state without charges
                console.warn('[asaas-public] Soft cancel charge cleanup warning:', e.message);
              }
            }
          }
        }

        // Update local — gatewaySubscriptionId preserved for soft cancel (enables zero-cost reactivation)
        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            endDate: endDate,
            cancellationReason: reason || 'Cancelado pelo cliente via site',
            pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({ success: true, endDate });
      }

      // ═══ Pause My Subscription (SOFT PAUSE) ═══
      case 'pauseMySubscription': {
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=eq.active&select=*&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub) return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada.' });

        // SOFT PAUSE: cancel pending charges but keep Asaas subscription alive
        // This allows frictionless reactivation without re-creating the Asaas subscription
        if (sub.gatewaySubscriptionId) {
          const config = await getConfig();
          if (config) {
            try {
              const cleared = await cancelPendingCharges(config, sub.gatewaySubscriptionId);
              console.log(`[asaas-public] Soft pause: ${cleared} pending charge(s) cleared for ${sub.gatewaySubscriptionId}, Asaas sub kept alive`);
            } catch (e) {
              console.warn('[asaas-public] Soft pause charge cleanup warning:', e.message);
              // Non-fatal: proceed with local pause even if charge cleanup fails
            }
          }
        }

        // Calculate pause endDate: when benefits expire (for hard cancel cron)
        // Use nextPaymentDate if available, otherwise 60-day max pause window
        const pauseEndDate = sub.nextPaymentDate
          || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'paused',
            pausedAt: new Date().toISOString(),
            endDate: pauseEndDate,
            pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({ success: true });
      }

      // ═══ Get My Payment History (F4) ═══
      case 'getMyPaymentHistory': {
        // N2: Try ASAAS live data first (has netValue, receipt URLs, real-time status)
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&gatewaySubscriptionId=not.is.null&select=gatewaySubscriptionId&limit=1`,
          { headers: { Prefer: 'return=representation' } }
        );
        const subs = await subRes.json();

        if (subs?.[0]?.gatewaySubscriptionId) {
          const config = await getConfig();
          if (config) {
            try {
              const payments = await asaasRequest(config,
                `/subscriptions/${subs[0].gatewaySubscriptionId}/payments?limit=20&sort=dueDate&order=desc`);
              return res.status(200).json({
                success: true,
                events: (payments.data || []).map(p => ({
                  event: `PAYMENT_${p.status}`,
                  status: p.status,
                  amount: p.value,
                  netValue: p.netValue,
                  dueDate: p.dueDate,
                  paymentDate: p.confirmedDate || p.paymentDate,
                  invoiceUrl: p.invoiceUrl,
                  transactionReceiptUrl: p.transactionReceiptUrl,
                  billingType: p.billingType,
                  creditDate: p.creditDate,
                  processedAt: p.dateCreated,
                })),
                source: 'asaas_live',
              });
            } catch (e) {
              console.warn('[asaas-public] Live payment fetch failed, falling back to local:', e.message);
            }
          }
        }

        // Fallback: local billing_events
        let events = [];
        try {
          const eventsRes = await sbQuery(
            `billing_events?clientId=eq.${client.id}&select=id,event,status,amount,netValue,billingType,dueDate,paymentDate,invoiceUrl,bankSlipUrl,transactionReceiptUrl,creditDate,processedAt&order=processedAt.desc&limit=30`,
            { headers: { Prefer: 'return=representation' } }
          );
          events = await eventsRes.json();
        } catch {
          // Fallback without extended columns (migration not yet applied)
          const eventsRes = await sbQuery(
            `billing_events?clientId=eq.${client.id}&select=id,event,status,amount,billingType,dueDate,paymentDate,invoiceUrl,bankSlipUrl,processedAt&order=processedAt.desc&limit=30`,
            { headers: { Prefer: 'return=representation' } }
          );
          events = await eventsRes.json();
        }
        return res.status(200).json({ success: true, events: events || [], source: 'local' });
      }

      // ═══ Update Payment Method / Change Card (F3) ═══
      case 'updatePaymentMethod': {
        const { creditCard, holderInfo } = data || {};
        if (!creditCard || !holderInfo?.cpfCnpj) {
          return res.status(400).json({ error: 'Dados do cartão e CPF são obrigatórios.' });
        }

        // Find active subscription
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(active,pending_payment)&select=*&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub || !sub.gatewaySubscriptionId || !sub.gatewayCustomerId) {
          return res.status(400).json({ error: 'Nenhuma assinatura ativa com cobrança encontrada.' });
        }

        const config = await getConfig();
        if (!config) return res.status(500).json({ error: 'Gateway não configurado.' });

        // Resolve remoteIp before tokenization (required by ASAAS)
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '127.0.0.1';

        // 1. Tokenize new card
        const tokenPayload = {
          customer: sub.gatewayCustomerId,
          creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number.replace(/\D/g, ''),
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv,
          },
          creditCardHolderInfo: {
            name: creditCard.holderName,
            cpfCnpj: holderInfo.cpfCnpj.replace(/\D/g, ''),
            email: holderInfo.email || client.email,
            phone: holderInfo.phone?.replace(/\D/g, '') || client.phone?.replace(/\D/g, ''),
            postalCode: holderInfo.postalCode?.replace(/\D/g, '') || '00000000',
            addressNumber: holderInfo.addressNumber || '0',
          },
          remoteIp,
        };

        let token;
        try {
          token = await asaasRequest(config, '/creditCard/tokenize', 'POST', tokenPayload);
        } catch (tokErr) {
          return res.status(400).json({
            error: tokErr.message || 'Erro ao processar cartão. Verifique os dados.',
            errorCode: 'TOKENIZATION_FAILED',
          });
        }

        // 2. Update subscription credit card via dedicated endpoint
        const updateCardPayload = {
          creditCardToken: token.creditCardToken,
          remoteIp,
        };

        try {
          await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}/creditCard`, 'PUT', updateCardPayload);
        } catch (cardErr) {
          return res.status(400).json({
            error: cardErr.message || 'Erro ao atualizar cartão na assinatura.',
            errorCode: 'CARD_UPDATE_FAILED',
          });
        }

        // 3. Update local record
        const brand = token.creditCardBrand || (creditCard.number?.replace(/\D/g, '').substring(0, 1) === '4' ? 'VISA' : 'MASTERCARD');
        const last4 = creditCard.number?.replace(/\D/g, '').slice(-4) || '';
        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            cardBrand: token.creditCardBrand || brand,
            cardLast4: last4,
            creditCardToken: token.creditCardToken || null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({
          success: true,
          cardBrand: token.creditCardBrand || brand,
          cardLast4: last4,
        });
      }

      // ═══ Reactivate Paused/Overdue Subscription (F1) ═══
      case 'reactivateSubscription': {
        const { creditCard, holderInfo } = data || {};
        if (!creditCard || !holderInfo?.cpfCnpj) {
          return res.status(400).json({ error: 'Dados do cartão são obrigatórios para reativar.' });
        }

        // Find paused, overdue, or cancelled subscription
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(paused,overdue,cancelled)&select=*,subscription_plans(*)&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub) return res.status(400).json({ error: 'Nenhuma assinatura encontrada para reativar.' });

        const plan = sub.subscription_plans;
        if (!plan) return res.status(400).json({ error: 'Plano da assinatura não encontrado.' });

        const config = await getConfig();
        if (!config) return res.status(500).json({ error: 'Gateway não configurado.' });

        // Ensure customer exists
        let customerId = sub.gatewayCustomerId;
        if (!customerId) {
          // Create customer
          const customerPayload = {
            name: client.name,
            email: client.email || holderInfo.email,
            cpfCnpj: holderInfo.cpfCnpj.replace(/\D/g, ''),
            mobilePhone: holderInfo.phone?.replace(/\D/g, '') || client.phone?.replace(/\D/g, ''),
          };
          const asaasCustomer = await asaasRequest(config, '/customers', 'POST', customerPayload);
          customerId = asaasCustomer.id;
        }

        // Resolve remoteIp BEFORE tokenization (required by ASAAS)
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '127.0.0.1';

        // Prepare card data (used for tokenize and as fallback for raw card)
        const cardData = {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\D/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        };
        const holderData = {
          name: creditCard.holderName,
          cpfCnpj: holderInfo.cpfCnpj.replace(/\D/g, ''),
          email: holderInfo.email || client.email,
          phone: holderInfo.phone?.replace(/\D/g, '') || client.phone?.replace(/\D/g, ''),
          postalCode: holderInfo.postalCode?.replace(/\D/g, '') || '00000000',
          addressNumber: holderInfo.addressNumber || '0',
        };

        // Tokenize card (with permission error fallback)
        let creditCardToken;
        let tokenBrand = '';
        let tokenLast4 = '';

        try {
          const tokenResult = await asaasRequest(config, '/creditCard/tokenize', 'POST', {
            customer: customerId,
            creditCard: cardData,
            creditCardHolderInfo: holderData,
            remoteIp,
          });
          creditCardToken = tokenResult.creditCardToken;
          tokenBrand = tokenResult.creditCardBrand || '';
          tokenLast4 = tokenResult.creditCardNumber || '';
          console.log(`[asaas-public] Card tokenized for reactivation: ${tokenBrand} ${tokenLast4}`);
        } catch (tokErr) {
          const isPermissionError = tokErr.message?.toLowerCase()?.includes('permiss')
            || tokErr.message?.toLowerCase()?.includes('permission');
          if (!isPermissionError) {
            return res.status(400).json({
              error: tokErr.message || 'Erro ao processar cartão.',
              errorCode: 'TOKENIZATION_FAILED',
            });
          }
          console.log('[asaas-public] Tokenization not available for reactivation, using raw card data');
        }

        // ── SOFT CANCEL: Update card on existing Asaas subscription ──
        // If gateway sub is still alive (soft cancelled/paused), just update the card
        // This prevents duplicate charges from creating a new subscription
        if (sub.gatewaySubscriptionId && (sub.status === 'cancelled' || sub.status === 'paused')) {
          try {
            const updateCardPayload = { remoteIp };
            if (creditCardToken) {
              updateCardPayload.creditCardToken = creditCardToken;
            } else {
              updateCardPayload.creditCard = cardData;
              updateCardPayload.creditCardHolderInfo = holderData;
            }
            await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}/creditCard`, 'PUT', updateCardPayload);
            console.log(`[asaas-public] Updated card on existing Asaas sub ${sub.gatewaySubscriptionId}`);
          } catch (cardErr) {
            return res.status(400).json({
              error: cardErr.message || 'Erro ao atualizar cartão na assinatura existente.',
              errorCode: 'CARD_UPDATE_FAILED',
            });
          }

          // Flip local status to active
          const last4 = creditCard.number?.replace(/\D/g, '').slice(-4) || '';
          const finalBrand = tokenBrand || (creditCard.number?.replace(/\D/g, '').substring(0, 1) === '4' ? 'VISA' : 'MASTERCARD');
          await sbQuery(`subscriptions?id=eq.${sub.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'active',
              cardBrand: finalBrand,
              cardLast4: last4,
              creditCardToken: creditCardToken || null,
              cancelledAt: null,
              endDate: null,
              cancellationReason: null,
              pausedAt: null,
              failedAttempts: 0,
              pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
              updatedAt: new Date().toISOString(),
            }),
            prefer: 'return=minimal',
          });

          console.log(`[asaas-public] Reactivation (new card, soft cancel): sub ${sub.id} flipped to active`);
          return res.status(200).json({
            success: true,
            subscriptionId: sub.id,
            paymentStatus: 'ACTIVE',
            finalStatus: 'active',
            cardBrand: finalBrand,
            cardLast4: last4,
            planName: plan.name,
            planPrice: Number(plan.creditPrice) || Number(plan.price) || 0,
          });
        }

        // ── HARD CANCEL: Delete old sub + create new ──
        // Gateway sub already deleted or never existed — need to create fresh
        if (sub.gatewaySubscriptionId) {
          try {
            await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}`, 'DELETE');
            console.log(`[asaas-public] Old gateway sub ${sub.gatewaySubscriptionId} cancelled`);
          } catch (delErr) {
            if (!delErr.message?.includes('not_found') && !delErr.message?.includes('404')) {
              console.warn('[asaas-public] Old sub cancel failed (non-fatal):', delErr.message);
            }
          }
        }

        // Create new subscription in ASAAS
        const planPrice = Number(plan.creditPrice) || Number(plan.price) || 0;
        const recurrenceMap = { monthly: 'MONTHLY', quarterly: 'QUARTERLY', semiannual: 'SEMIANNUALLY', annual: 'YEARLY' };
        const subPayload = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: planPrice,
          nextDueDate: new Date().toISOString().split('T')[0],
          cycle: recurrenceMap[plan.recurrence] || 'MONTHLY',
          description: `Assinatura ${plan.name} (reativada)`,
          externalReference: sub.id,
          // F8: Include fine/interest (was missing in reactivation, present in creation)
          fine: { value: config.finePercent || 0, type: 'PERCENTAGE' },
          interest: { value: config.interestPercent || 0, type: 'PERCENTAGE' },
        };

        // Use token if available, otherwise raw card data
        if (creditCardToken) {
          subPayload.creditCardToken = creditCardToken;
          subPayload.remoteIp = remoteIp;
        } else {
          subPayload.creditCard = cardData;
          subPayload.creditCardHolderInfo = holderData;
          subPayload.remoteIp = remoteIp;
        }

        let asaasSub;
        try {
          asaasSub = await asaasRequest(config, '/subscriptions', 'POST', subPayload);
        } catch (subErr) {
          return res.status(400).json({
            error: subErr.message || 'Não foi possível reativar a assinatura.',
            errorCode: 'REACTIVATION_FAILED',
          });
        }

        // Check first payment status (align with createSubscription flow)
        let firstPaymentStatus = null;
        try {
          const payments = await asaasRequest(config, `/subscriptions/${asaasSub.id}/payments?limit=1`, 'GET');
          if (payments?.data?.length > 0) {
            firstPaymentStatus = payments.data[0].status;
          }
        } catch (e) {
          console.log('[asaas-public] Could not fetch reactivation payment:', e.message);
        }

        let reactivatedStatus = 'pending_payment';
        let reactivatedLastPayment = null;
        if (firstPaymentStatus === 'CONFIRMED' || firstPaymentStatus === 'RECEIVED') {
          reactivatedStatus = 'active';
          reactivatedLastPayment = new Date().toISOString();
        } else if (firstPaymentStatus === 'REFUSED' || firstPaymentStatus === 'OVERDUE') {
          reactivatedStatus = 'overdue';
        }

        // Update local subscription
        const last4 = creditCard.number?.replace(/\D/g, '').slice(-4) || '';
        const finalBrand = tokenBrand || (creditCard.number?.replace(/\D/g, '').substring(0, 1) === '4' ? 'VISA' : 'MASTERCARD');
        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: reactivatedStatus,
            gatewaySubscriptionId: asaasSub.id,
            gatewayCustomerId: customerId,
            cardBrand: finalBrand,
            cardLast4: last4,
            creditCardToken: creditCardToken || null,
            // Clear stale cancellation/pause fields
            cancelledAt: null,
            endDate: null,
            cancellationReason: null,
            pausedAt: null,
            lastPaymentDate: reactivatedLastPayment,
            failedAttempts: 0,
            usesThisMonth: 0,
            startDate: new Date().toISOString(),
            pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({
          success: true,
          subscriptionId: sub.id,
          paymentStatus: firstPaymentStatus || 'PENDING',
          finalStatus: reactivatedStatus,
          cardBrand: finalBrand,
          cardLast4: last4,
          planName: plan.name,
          planPrice,
        });
      }

      // ═══ Reactivate with Saved Card Token (no card data required) ═══
      case 'reactivateWithSavedCard': {
        // Find cancelled/paused/overdue subscription with saved token
        const scSubRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(paused,overdue,cancelled)&select=*,subscription_plans(*)&order=createdAt.desc&limit=1`
        );
        const scSubs = await scSubRes.json();
        const scSub = scSubs?.[0];
        if (!scSub) return res.status(400).json({ error: 'Nenhuma assinatura encontrada para reativar.' });
        if (!scSub.creditCardToken) {
          return res.status(400).json({ error: 'Nenhum cartão salvo encontrado. Use a opção de cadastrar novo cartão.', errorCode: 'NO_SAVED_CARD' });
        }

        const scPlan = scSub.subscription_plans;
        if (!scPlan) return res.status(400).json({ error: 'Plano da assinatura não encontrado.' });

        const scConfig = await getConfig();
        if (!scConfig) return res.status(500).json({ error: 'Gateway não configurado.' });

        // ── SOFT CANCEL ZERO-COST REACTIVATION ──
        // If Asaas subscription is still alive (soft cancelled), just flip local status
        // No API calls, no new charges — instant reactivation
        if (scSub.gatewaySubscriptionId) {
          await sbQuery(`subscriptions?id=eq.${scSub.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'active',
              cancelledAt: null,
              endDate: null,
              cancellationReason: null,
              pausedAt: null,
              failedAttempts: 0,
              pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
              updatedAt: new Date().toISOString(),
            }),
            prefer: 'return=minimal',
          });

          console.log(`[asaas-public] Zero-cost reactivation: sub ${scSub.id} flipped to active (Asaas sub ${scSub.gatewaySubscriptionId} still alive)`);

          return res.status(200).json({
            success: true,
            subscriptionId: scSub.id,
            paymentStatus: 'ACTIVE',
            finalStatus: 'active',
            cardBrand: scSub.cardBrand,
            cardLast4: scSub.cardLast4,
            planName: scPlan.name,
            planPrice: Number(scPlan.creditPrice) || Number(scPlan.price) || 0,
          });
        }

        // ── HARD CANCEL REACTIVATION (Asaas sub deleted, must create new) ──
        let scCustomerId = scSub.gatewayCustomerId;
        if (!scCustomerId) {
          return res.status(400).json({ error: 'Dados do cliente no gateway não encontrados. Use a opção de cadastrar novo cartão.', errorCode: 'NO_CUSTOMER' });
        }

        // Create new subscription using saved token
        const scRemoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '127.0.0.1';
        const scPlanPrice = Number(scPlan.creditPrice) || Number(scPlan.price) || 0;
        const scRecMap = { monthly: 'MONTHLY', quarterly: 'QUARTERLY', semiannual: 'SEMIANNUALLY', annual: 'YEARLY' };

        let scAsaasSub;
        try {
          scAsaasSub = await asaasRequest(scConfig, '/subscriptions', 'POST', {
            customer: scCustomerId,
            billingType: 'CREDIT_CARD',
            value: scPlanPrice,
            nextDueDate: new Date().toISOString().split('T')[0],
            cycle: scRecMap[scPlan.recurrence] || 'MONTHLY',
            description: `Assinatura ${scPlan.name} (reassinada)`,
            externalReference: scSub.id,
            creditCardToken: scSub.creditCardToken,
            remoteIp: scRemoteIp,
            fine: { value: scConfig.finePercent || 0, type: 'PERCENTAGE' },
            interest: { value: scConfig.interestPercent || 0, type: 'PERCENTAGE' },
          });
        } catch (scSubErr) {
          // Token may be expired/invalid — tell frontend to use full card flow
          return res.status(400).json({
            error: scSubErr.message || 'Não foi possível reativar com o cartão salvo. Tente cadastrar um novo cartão.',
            errorCode: 'SAVED_CARD_FAILED',
          });
        }

        // Check first payment status
        let scPaymentStatus = null;
        try {
          const scPayments = await asaasRequest(scConfig, `/subscriptions/${scAsaasSub.id}/payments?limit=1`, 'GET');
          if (scPayments?.data?.length > 0) scPaymentStatus = scPayments.data[0].status;
        } catch (e) {
          console.log('[asaas-public] Could not fetch saved-card reactivation payment:', e.message);
        }

        let scFinalStatus = 'pending_payment';
        let scLastPayment = null;
        if (scPaymentStatus === 'CONFIRMED' || scPaymentStatus === 'RECEIVED') {
          scFinalStatus = 'active';
          scLastPayment = new Date().toISOString();
        } else if (scPaymentStatus === 'REFUSED' || scPaymentStatus === 'OVERDUE') {
          scFinalStatus = 'overdue';
        }

        // Update local subscription
        await sbQuery(`subscriptions?id=eq.${scSub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: scFinalStatus,
            gatewaySubscriptionId: scAsaasSub.id,
            cancelledAt: null,
            endDate: null,
            cancellationReason: null,
            pausedAt: null,
            lastPaymentDate: scLastPayment,
            failedAttempts: 0,
            usesThisMonth: 0,
            startDate: new Date().toISOString(),
            pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        console.log(`[asaas-public] Subscription ${scSub.id} reactivated with saved card. Status: ${scFinalStatus}`);

        return res.status(200).json({
          success: true,
          subscriptionId: scSub.id,
          paymentStatus: scPaymentStatus || 'PENDING',
          finalStatus: scFinalStatus,
          cardBrand: scSub.cardBrand,
          cardLast4: scSub.cardLast4,
          planName: scPlan.name,
          planPrice: scPlanPrice,
        });
      }

      // ═══ Retry Payment (refresh overdue charges) ═══
      case 'retryPayment': {
        const rpSubRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(overdue,pending_payment)&select=id,gatewaySubscriptionId,planId&order=createdAt.desc&limit=1`
        );
        const rpSubs = await rpSubRes.json();
        const rpSub = rpSubs?.[0];
        if (!rpSub) return res.status(400).json({ error: 'Nenhuma assinatura pendente encontrada.' });
        if (!rpSub.gatewaySubscriptionId) {
          return res.status(400).json({ error: 'Assinatura sem cobrança automática configurada.' });
        }

        const rpConfig = await getConfig();
        if (!rpConfig) return res.status(500).json({ error: 'Gateway não configurado.' });

        try {
          // Get current ASAAS subscription to resend billingType
          const asaasSub = await asaasRequest(rpConfig, `/subscriptions/${rpSub.gatewaySubscriptionId}`, 'GET');
          // Refresh subscription — forces ASAAS to update pending/overdue charges
          await asaasRequest(rpConfig, `/subscriptions/${rpSub.gatewaySubscriptionId}`, 'PUT', {
            billingType: asaasSub.billingType || 'CREDIT_CARD',
            updatePendingPayments: true,
          });
        } catch (e) {
          return res.status(400).json({
            error: e.message || 'Erro ao solicitar nova tentativa de cobrança.',
            errorCode: 'RETRY_FAILED',
          });
        }

        return res.status(200).json({ success: true });
      }

      // ═══ Change Plan / Upgrade-Downgrade (SCHEDULED) ═══
      case 'changePlan': {
        const { newPlanId } = data || {};
        if (!newPlanId) return res.status(400).json({ error: 'ID do novo plano é obrigatório.' });

        // Find active subscription
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(active,pending_payment)&select=*&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub) {
          return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada.' });
        }

        // Get new plan (must be active + available for sale)
        const planRes = await sbQuery(`subscription_plans?id=eq.${newPlanId}&active=eq.true&availableForSale=eq.true&select=*&limit=1`);
        const plans = await planRes.json();
        const newPlan = plans?.[0];
        if (!newPlan) return res.status(400).json({ error: 'Plano não encontrado ou inativo.' });

        if (sub.planId === newPlanId) {
          return res.status(400).json({ error: 'Você já está neste plano.' });
        }

        // Check if already scheduling change to same plan
        if (sub.pendingPlanId === newPlanId) {
          return res.status(400).json({ error: 'Troca para este plano já está agendada.' });
        }

        // Calculate scheduled date (next billing cycle)
        let scheduledDate;
        if (sub.nextPaymentDate) {
          scheduledDate = sub.nextPaymentDate;
        } else {
          // Manual subs: calculate from startDate + plan recurrence
          const currentPlanRes = await sbQuery(
            `subscription_plans?id=eq.${sub.planId}&select=recurrence&limit=1`
          );
          const currentPlans = await currentPlanRes.json();
          const currentPlan = currentPlans?.[0];
          const daysMap = { monthly: 30, quarterly: 90, semiannual: 180, yearly: 365 };
          const days = daysMap[currentPlan?.recurrence] || 30;
          const start = new Date(sub.startDate || sub.createdAt || new Date().toISOString());
          const now = new Date();
          // Find next cycle boundary after today
          while (start <= now) start.setDate(start.getDate() + days);
          scheduledDate = start.toISOString();
        }

        // Update ASAAS value immediately (safe: only affects future payments)
        const newPrice = Number(newPlan.creditPrice) || Number(newPlan.price) || 0;
        const config = await getConfig();
        if (sub.gatewaySubscriptionId && config) {
          try {
            await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}`, 'PUT', {
              value: newPrice,
              description: `Assinatura ${newPlan.name}`,
              // F9: Include fine/interest to prevent them from being zeroed out
              fine: { value: config.finePercent || 0, type: 'PERCENTAGE' },
              interest: { value: config.interestPercent || 0, type: 'PERCENTAGE' },
            });
          } catch (asaasErr) {
            console.warn('[asaas-public] ASAAS value update failed (non-fatal):', asaasErr.message);
          }
        }

        // Store pending change (NOT applying planId yet — user keeps current benefits until cycle ends)
        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            pendingPlanId: newPlanId,
            pendingPlanName: newPlan.name,
            planChangeScheduledAt: scheduledDate,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({
          success: true,
          scheduled: true,
          scheduledDate,
          oldPlanId: sub.planId,
          newPlanId,
          newPlanName: newPlan.name,
        });
      }

      // ═══ Cancel Pending Plan Change ═══
      case 'cancelPendingPlanChange': {
        const cpSubRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(active,pending_payment)&pendingPlanId=not.is.null&select=id,planId,gatewaySubscriptionId&limit=1`
        );
        const cpSubs = await cpSubRes.json();
        if (!cpSubs?.length) return res.status(400).json({ error: 'Nenhuma troca pendente.' });
        const cpSub = cpSubs[0];

        // Revert ASAAS value to current plan price
        if (cpSub.gatewaySubscriptionId) {
          const cpConfig = await getConfig();
          if (cpConfig) {
            const curPlanRes = await sbQuery(
              `subscription_plans?id=eq.${cpSub.planId}&select=name,price,creditPrice&limit=1`
            );
            const curPlans = await curPlanRes.json();
            const curPlan = curPlans?.[0];
            if (curPlan) {
              const curPrice = Number(curPlan.creditPrice) || Number(curPlan.price) || 0;
              try {
                await asaasRequest(cpConfig, `/subscriptions/${cpSub.gatewaySubscriptionId}`, 'PUT', {
                  value: curPrice,
                  description: `Assinatura ${curPlan.name}`,
                  updatePendingPayments: true, // Also fix any pending invoices with wrong value
                });
              } catch (e) {
                console.warn('[asaas-public] ASAAS revert failed (non-fatal):', e.message);
              }
            }
          }
        }

        // Clear pending fields
        await sbQuery(`subscriptions?id=eq.${cpSub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });
        return res.status(200).json({ success: true });
      }

      // ═══ N1: Sync Customer Data to ASAAS ═══
      case 'syncCustomerData': {
        const { name, email, phone } = data || {};
        if (!client.asaasCustomerId) {
          return res.status(200).json({ success: true, skipped: true, reason: 'no_gateway_customer' });
        }
        const config = await getConfig();
        if (!config) return res.status(200).json({ success: true, skipped: true, reason: 'no_config' });

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.mobilePhone = phone.replace(/\D/g, '');

        if (Object.keys(updateData).length === 0) {
          return res.status(200).json({ success: true, skipped: true, reason: 'no_changes' });
        }

        try {
          await asaasRequest(config, `/customers/${client.asaasCustomerId}`, 'PUT', updateData);
          console.log(`[asaas-public] Customer ${client.asaasCustomerId} synced:`, Object.keys(updateData));
          return res.status(200).json({ success: true, synced: Object.keys(updateData) });
        } catch (e) {
          console.warn('[asaas-public] Customer sync failed (non-fatal):', e.message);
          return res.status(200).json({ success: true, skipped: true, reason: e.message });
        }
      }
      // ═══ Update Auth Profile (Supabase Auth) ═══
      // Syncs email + user_metadata (name, phone) in Supabase Auth so login
      // works with new email and metadata stays fresh for auto-create fallback.
      case 'updateAuthEmail': {
        const { newEmail, name, phone } = data || {};

        // Get the authUserId linked to this client
        if (!client.authUserId) {
          return res.status(400).json({ error: 'Conta sem autenticação vinculada' });
        }

        // Build the update payload
        const authPayload = {};

        // ── Email change ──
        if (newEmail?.trim()) {
          const normalizedEmail = newEmail.trim().toLowerCase();

          // Validate email format
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Formato de email inválido' });
          }

          authPayload.email = normalizedEmail;
          authPayload.email_confirm = true; // Skip verification — admin-initiated
        }

        // ── User metadata (name, phone) ──
        const metadataUpdates = {};
        if (name?.trim()) metadataUpdates.name = name.trim();
        if (phone?.trim()) metadataUpdates.phone = phone.trim().replace(/\D/g, '');

        if (Object.keys(metadataUpdates).length > 0) {
          authPayload.user_metadata = metadataUpdates;
        }

        // Nothing to update
        if (Object.keys(authPayload).length === 0) {
          return res.status(200).json({ success: true, skipped: true, reason: 'no_changes' });
        }

        // Update Supabase Auth via Admin API
        // Supabase natively rejects duplicate emails with 422 — no need for pre-check
        const authUpdateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${client.authUserId}`, {
          method: 'PUT',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(authPayload),
        });

        if (!authUpdateRes.ok) {
          const errBody = await authUpdateRes.text();
          console.error('[asaas-public] Auth profile update failed:', errBody);
          // Parse Supabase error for user-friendly message
          const isDuplicate = errBody.includes('already been registered') || errBody.includes('duplicate') || errBody.includes('unique');
          if (isDuplicate) {
            return res.status(409).json({ error: 'Este email já está em uso por outra conta' });
          }
          return res.status(500).json({ error: 'Falha ao atualizar dados de autenticação. Tente novamente.' });
        }

        const updated = Object.keys(authPayload).filter(k => k !== 'email_confirm');
        console.log(`[asaas-public] Auth profile updated for user ${client.authUserId}:`, updated);
        return res.status(200).json({ success: true, updated });
      }

      // ═══ Change Unit (Automated Transfer) ═══
      case 'changeUnit': {
        const { newUnitId } = data || {};
        if (!newUnitId) return res.status(400).json({ error: 'Nova unidade não selecionada.' });

        // Find current active subscription
        const cuSubRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(active,pending_payment)&select=*,subscription_plans(*)&order=createdAt.desc&limit=1`
        );
        const cuSubs = await cuSubRes.json();
        const cuSub = cuSubs?.[0];
        if (!cuSub) return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada.' });

        // Can't transfer to same unit
        if (cuSub.unitId === newUnitId) {
          return res.status(400).json({ error: 'Você já está nesta unidade.' });
        }

        const cuPlan = cuSub.subscription_plans;
        if (!cuPlan) return res.status(400).json({ error: 'Plano da assinatura não encontrado.' });

        // Validate unit scope — plan must be allowed at new unit
        const allowedUnits = Array.isArray(cuPlan.allowedUnitIds) ? cuPlan.allowedUnitIds : [];
        if (cuPlan.unitScope === 'specific' && allowedUnits.length > 0 && !allowedUnits.includes(newUnitId)) {
          return res.status(400).json({
            error: 'Seu plano não está disponível nesta unidade. Entre em contato com o suporte.',
            errorCode: 'UNIT_NOT_ALLOWED',
          });
        }

        // Check for existing active subscription at new unit
        const existingRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&unitId=eq.${newUnitId}&status=in.(active,pending_payment)&select=id&limit=1`
        );
        const existingSubs = await existingRes.json();
        if (existingSubs?.length > 0) {
          return res.status(400).json({ error: 'Você já possui uma assinatura ativa nesta unidade.' });
        }

        // Calculate benefit period
        const hadPayment = !!cuSub.lastPaymentDate;
        const endDate = hadPayment
          ? (cuSub.nextPaymentDate || cuSub.endDate || new Date().toISOString())
          : new Date().toISOString();
        const benefitsRemaining = new Date(endDate) > new Date();

        // Step 1: Soft cancel current subscription
        if (cuSub.gatewaySubscriptionId) {
          const config = await getConfig();
          if (config) {
            try {
              await cancelPendingCharges(config, cuSub.gatewaySubscriptionId);
              console.log(`[asaas-public] changeUnit: cleared charges for ${cuSub.gatewaySubscriptionId}`);
            } catch (e) {
              console.warn('[asaas-public] changeUnit: charge cleanup warning:', e.message);
            }
          }
        }

        await sbQuery(`subscriptions?id=eq.${cuSub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            endDate: endDate,
            cancellationReason: `Transferência para unidade ${newUnitId}`,
            pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        // Step 2: Create new subscription at the new unit
        const cuConfig = await getConfig();
        if (!cuConfig) return res.status(500).json({ error: 'Gateway não configurado.' });

        const cuPlanPrice = Number(cuPlan.creditPrice) || Number(cuPlan.price) || 0;
        const cuRecMap = { monthly: 'MONTHLY', quarterly: 'QUARTERLY', semiannual: 'SEMIANNUALLY', annual: 'YEARLY' };
        const cuRemoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '127.0.0.1';

        // If benefits remaining: schedule first charge for endDate (no immediate charge)
        // If no benefits: charge immediately (today)
        const nextDueDate = benefitsRemaining
          ? new Date(endDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const newSubId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Create local subscription record
        await sbQuery('subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            id: newSubId,
            planId: cuSub.planId,
            clientId: client.id,
            clientName: client.name,
            status: benefitsRemaining ? 'pending_payment' : 'pending_payment',
            startDate: benefitsRemaining ? endDate : now,
            usesThisMonth: 0,
            paymentDay: new Date(nextDueDate).getDate(),
            paymentMethod: 'credit',
            gatewayCustomerId: cuSub.gatewayCustomerId,
            billingEmail: cuSub.billingEmail || client.email || null,
            autoRenew: true,
            unitId: newUnitId,
            saleChannel: 'site',
            cancelledAt: null, endDate: null, cancellationReason: null,
            failedAttempts: 0, lastPaymentDate: null, nextPaymentDate: null,
            pausedAt: null, lastWebhookAt: null,
            createdAt: now, updatedAt: now,
          }),
          prefer: 'return=minimal',
        });

        // Create Asaas subscription with scheduled charge
        if (cuSub.creditCardToken && cuSub.gatewayCustomerId) {
          try {
            const asaasSub = await asaasRequest(cuConfig, '/subscriptions', 'POST', {
              customer: cuSub.gatewayCustomerId,
              billingType: 'CREDIT_CARD',
              value: cuPlanPrice,
              nextDueDate: nextDueDate,
              cycle: cuRecMap[cuPlan.recurrence] || 'MONTHLY',
              description: `Plano ${cuPlan.name} (transferência de unidade)`,
              externalReference: newSubId,
              creditCardToken: cuSub.creditCardToken,
              remoteIp: cuRemoteIp,
              fine: { value: cuConfig.finePercent || 0, type: 'PERCENTAGE' },
              interest: { value: cuConfig.interestPercent || 0, type: 'PERCENTAGE' },
            });

            // Update local with gateway ID
            await sbQuery(`subscriptions?id=eq.${newSubId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                gatewaySubscriptionId: asaasSub.id,
                gatewayCustomerId: cuSub.gatewayCustomerId,
                cardBrand: cuSub.cardBrand,
                cardLast4: cuSub.cardLast4,
                creditCardToken: cuSub.creditCardToken,
                updatedAt: new Date().toISOString(),
              }),
              prefer: 'return=minimal',
            });

            // If not deferred, check payment status
            if (!benefitsRemaining) {
              try {
                const payments = await asaasRequest(cuConfig, `/subscriptions/${asaasSub.id}/payments?limit=1`);
                if (payments?.data?.[0]?.status === 'CONFIRMED' || payments?.data?.[0]?.status === 'RECEIVED') {
                  await sbQuery(`subscriptions?id=eq.${newSubId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'active', lastPaymentDate: now, updatedAt: now }),
                    prefer: 'return=minimal',
                  });
                }
              } catch {}
            }

            console.log(`[asaas-public] changeUnit: new sub ${newSubId} created at unit ${newUnitId}, dueDate=${nextDueDate}`);
          } catch (asaasErr) {
            console.error('[asaas-public] changeUnit: Asaas create failed:', asaasErr.message);
            // Local sub was created, but Asaas failed — mark it
            await sbQuery(`subscriptions?id=eq.${newSubId}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'overdue', updatedAt: now }),
              prefer: 'return=minimal',
            });
            return res.status(400).json({
              error: 'Assinatura transferida localmente, mas falhou no gateway. Entre em contato com o suporte.',
              errorCode: 'GATEWAY_CREATE_FAILED',
            });
          }
        } else {
          console.log(`[asaas-public] changeUnit: local-only sub ${newSubId} (no token/customer for Asaas)`);
        }

        return res.status(200).json({
          success: true,
          newSubscriptionId: newSubId,
          oldSubscriptionId: cuSub.id,
          benefitsRemaining,
          benefitsEndDate: benefitsRemaining ? endDate : null,
          nextChargeDate: nextDueDate,
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[asaas-public] Error:', error);
    return res.status(500).json({ error: error.message || 'Erro interno. Tente novamente.' });
  }
}
