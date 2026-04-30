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
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=neq.cancelled&select=*,subscription_plans(*)&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0] || null;
        return res.status(200).json({ success: true, subscription: sub });
      }

      // ═══ Cancel My Subscription ═══
      case 'cancelMySubscription': {
        const { reason } = data || {};
        // Find active subscription for this client
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(active,pending_payment,paused,overdue)&select=*&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub) return res.status(400).json({ error: 'Nenhuma assinatura encontrada.' });

        // Cancel in ASAAS if has gateway ID (MUST succeed before local update)
        if (sub.gatewaySubscriptionId) {
          const config = await getConfig();
          if (config) {
            try {
              await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}`, 'DELETE');
              console.log(`[asaas-public] ASAAS subscription ${sub.gatewaySubscriptionId} cancelled`);
            } catch (e) {
              console.error('[asaas-public] ASAAS cancel FAILED:', e.message);
              // Only ignore if already deleted/not found
              if (!e.message?.includes('not_found') && !e.message?.includes('404')) {
                return res.status(400).json({
                  error: 'Não foi possível cancelar a assinatura no gateway de pagamento. Tente novamente ou entre em contato com o suporte.',
                  errorCode: 'GATEWAY_CANCEL_FAILED',
                });
              }
            }
          }
        }

        // Calculate when benefits expire (end of current paid period)
        // Only grant benefit period if there was at least one confirmed payment
        const hadSuccessfulPayment = !!sub.lastPaymentDate;
        const endDate = hadSuccessfulPayment
          ? (sub.nextPaymentDate || sub.endDate || new Date().toISOString())
          : new Date().toISOString(); // Never paid → no benefit period

        // Update local
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

      // ═══ Pause My Subscription ═══
      case 'pauseMySubscription': {
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=eq.active&select=*&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub) return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada.' });

        // ASAAS has no "pause" — cancel the subscription to stop charges
        if (sub.gatewaySubscriptionId) {
          const config = await getConfig();
          if (config) {
            try {
              await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}`, 'DELETE');
              console.log(`[asaas-public] ASAAS subscription ${sub.gatewaySubscriptionId} cancelled (pause)`);
            } catch (e) {
              console.error('[asaas-public] ASAAS pause-cancel FAILED:', e.message);
              if (!e.message?.includes('not_found') && !e.message?.includes('404')) {
                return res.status(400).json({
                  error: 'Não foi possível pausar a assinatura. Tente novamente.',
                  errorCode: 'GATEWAY_PAUSE_FAILED',
                });
              }
            }
          }
        }

        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'paused',
            pausedAt: new Date().toISOString(),
            pendingPlanId: null, pendingPlanName: null, planChangeScheduledAt: null,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({ success: true });
      }

      // ═══ Get My Payment History (F4) ═══
      case 'getMyPaymentHistory': {
        const eventsRes = await sbQuery(
          `billing_events?clientId=eq.${client.id}&select=id,event,status,amount,billingType,dueDate,paymentDate,invoiceUrl,bankSlipUrl,processedAt&order=processedAt.desc&limit=30`,
          { headers: { Prefer: 'return=representation' } }
        );
        const events = await eventsRes.json();
        return res.status(200).json({ success: true, events: events || [] });
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

        // Cancel old ASAAS subscription if exists (prevents duplicates)
        // For paused/cancelled subs, gateway may already be cancelled — 404 is expected and silenced
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
              // updatePendingPayments NOT set (default false) — only future bills affected
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

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[asaas-public] Error:', error);
    return res.status(500).json({ error: error.message || 'Erro interno. Tente novamente.' });
  }
}
