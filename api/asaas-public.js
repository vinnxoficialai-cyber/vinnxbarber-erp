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

        // 2c. Check for existing overdue subscription to reuse (same pattern as admin)
        let reuseSubId = null;
        let oldGatewaySubId = null;
        const overdueRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=eq.overdue${resolvedUnitId ? `&unitId=eq.${resolvedUnitId}` : ''}&select=id,gatewaySubscriptionId&order=createdAt.desc&limit=1`
        );
        const overdueSubs = await overdueRes.json();
        if (overdueSubs?.length > 0) {
          reuseSubId = overdueSubs[0].id;
          oldGatewaySubId = overdueSubs[0].gatewaySubscriptionId || null;
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
              // Revert reused sub back to overdue (don't delete existing record)
              await sbQuery(`subscriptions?id=eq.${subscriptionId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'overdue', updatedAt: new Date().toISOString() }),
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
          // Subscription creation failed — mark as overdue
          await sbQuery(`subscriptions?id=eq.${subscriptionId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'overdue', updatedAt: new Date().toISOString() }),
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

        // Update local
        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancellationReason: reason || 'Cancelado pelo cliente via site',
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({ success: true });
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
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '127.0.0.1';
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

        // Find paused or overdue subscription
        const subRes = await sbQuery(
          `subscriptions?clientId=eq.${client.id}&status=in.(paused,overdue)&select=*,subscription_plans(*)&order=createdAt.desc&limit=1`
        );
        const subs = await subRes.json();
        const sub = subs?.[0];
        if (!sub) return res.status(400).json({ error: 'Nenhuma assinatura pausada ou inadimplente encontrada.' });

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

        // Tokenize card
        const tokenPayload = {
          customer: customerId,
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
        };

        let token;
        try {
          token = await asaasRequest(config, '/creditCard/tokenize', 'POST', tokenPayload);
        } catch (tokErr) {
          return res.status(400).json({
            error: tokErr.message || 'Erro ao processar cartão.',
            errorCode: 'TOKENIZATION_FAILED',
          });
        }

        // Cancel old ASAAS subscription if exists (prevents duplicates)
        // For paused subs, gateway was already cancelled — 404 is expected and silenced
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
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '127.0.0.1';
        const recurrenceMap = { monthly: 'MONTHLY', quarterly: 'QUARTERLY', semiannual: 'SEMIANNUALLY', annual: 'YEARLY' };
        const subPayload = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: planPrice,
          nextDueDate: new Date().toISOString().split('T')[0],
          cycle: recurrenceMap[plan.recurrence] || 'MONTHLY',
          description: `Assinatura ${plan.name} (reativada)`,
          creditCardToken: token.creditCardToken,
          remoteIp,
          externalReference: sub.id,
        };

        let asaasSub;
        try {
          asaasSub = await asaasRequest(config, '/subscriptions', 'POST', subPayload);
        } catch (subErr) {
          return res.status(400).json({
            error: subErr.message || 'Não foi possível reativar a assinatura.',
            errorCode: 'REACTIVATION_FAILED',
          });
        }

        // Update local subscription
        const last4 = creditCard.number?.replace(/\D/g, '').slice(-4) || '';
        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'active',
            gatewaySubscriptionId: asaasSub.id,
            gatewayCustomerId: customerId,
            cardBrand: token.creditCardBrand || (creditCard.number?.replace(/\D/g, '').substring(0, 1) === '4' ? 'VISA' : 'MASTERCARD'),
            cardLast4: last4,
            pausedAt: null,
            failedAttempts: 0,
            usesThisMonth: 0,
            startDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        const finalBrand = token.creditCardBrand || (creditCard.number?.replace(/\D/g, '').substring(0, 1) === '4' ? 'VISA' : 'MASTERCARD');
        return res.status(200).json({
          success: true,
          subscriptionId: sub.id,
          paymentStatus: 'CONFIRMED',
          finalStatus: 'active',
          cardBrand: finalBrand,
          cardLast4: last4,
          planName: plan.name,
          planPrice,
        });
      }

      // ═══ Change Plan / Upgrade-Downgrade (F6) ═══
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

        // Get new plan
        const planRes = await sbQuery(`subscription_plans?id=eq.${newPlanId}&active=eq.true&availableForSale=eq.true&select=*&limit=1`);
        const plans = await planRes.json();
        const newPlan = plans?.[0];
        if (!newPlan) return res.status(400).json({ error: 'Plano não encontrado ou inativo.' });

        if (sub.planId === newPlanId) {
          return res.status(400).json({ error: 'Você já está neste plano.' });
        }

        const config = await getConfig();
        if (!config) return res.status(500).json({ error: 'Gateway não configurado.' });

        // Update subscription value in ASAAS (only if we have a gateway subscription)
        const newPrice = Number(newPlan.creditPrice) || Number(newPlan.price) || 0;
        if (sub.gatewaySubscriptionId) {
          try {
            await asaasRequest(config, `/subscriptions/${sub.gatewaySubscriptionId}`, 'PUT', {
              value: newPrice,
              description: `Assinatura ${newPlan.name}`,
              updatePendingPayments: true,
            });
          } catch (asaasErr) {
            return res.status(400).json({
              error: asaasErr.message || 'Erro ao atualizar plano no gateway.',
              errorCode: 'PLAN_CHANGE_FAILED',
            });
          }
        }

        // Update local subscription
        await sbQuery(`subscriptions?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            planId: newPlanId,
            usesThisMonth: 0,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });

        return res.status(200).json({
          success: true,
          oldPlanId: sub.planId,
          newPlanId,
          newPlanName: newPlan.name,
          newPrice,
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
