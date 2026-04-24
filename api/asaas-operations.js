// Vercel Serverless Function — ASAAS Admin Operations
// Auth: JWT (admin panel user) — must be authenticated staff
// Actions: testConnection, saveConfig, createCustomer, createSubscription, cancelSubscription, getPayments

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

// Verify JWT user is staff
async function verifyAdmin(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '');
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!verifyRes.ok) return false;
  const user = await verifyRes.json();
  const staffRes = await sbQuery(`users?email=eq.${encodeURIComponent(user.email)}&select=id,role&limit=1`);
  const staff = await staffRes.json();
  return staff?.length > 0 && staff[0].role === 'ADMIN';
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
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth check
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { action, data } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    console.log(`[asaas-ops] Action: ${action}`);

    switch (action) {
      // ═══ Test Connection ═══
      case 'testConnection': {
        const config = data?.apiKey
          ? { apiKey: data.apiKey, environment: data.environment || 'sandbox' }
          : await getConfig();
        if (!config) return res.status(400).json({ error: 'Nenhuma configuração encontrada' });
        
        const result = await asaasRequest(config, '/finance/balance');
        return res.status(200).json({
          success: true,
          balance: result.balance,
          environment: config.environment,
        });
      }

      // ═══ Create Customer in ASAAS ═══
      case 'createCustomer': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { clientId, name, cpfCnpj, email, phone } = data;
        if (!name || !cpfCnpj) {
          return res.status(400).json({ error: 'Nome e CPF/CNPJ são obrigatórios' });
        }
        
        const cleanCpf = cpfCnpj.replace(/\D/g, '');
        
        // First, try to find existing customer by CPF
        let customer;
        try {
          const existing = await asaasRequest(config, `/customers?cpfCnpj=${cleanCpf}`, 'GET');
          if (existing?.data?.length > 0) {
            // Found existing — use it (pick the first non-deleted one)
            customer = existing.data.find(c => !c.deleted) || existing.data[0];
            console.log(`[asaas-ops] Reusing existing customer: ${customer.id}`);
          }
        } catch (e) {
          console.log('[asaas-ops] Customer search failed, will create new:', e.message);
        }

        // If no existing customer found, create a new one
        if (!customer) {
          customer = await asaasRequest(config, '/customers', 'POST', {
            name,
            cpfCnpj: cleanCpf,
            email: email || undefined,
            mobilePhone: phone?.replace(/\D/g, '') || undefined,
            externalReference: clientId,
            notificationDisabled: !config.sendNotifications,
          });
        }
        
        // Update client with asaasCustomerId
        if (clientId) {
          await sbQuery(`clients?id=eq.${clientId}`, {
            method: 'PATCH',
            body: JSON.stringify({ asaasCustomerId: customer.id }),
            prefer: 'return=minimal',
          });
        }
        
        return res.status(200).json({ success: true, customerId: customer.id });
      }

      // ═══ Tokenize Credit Card (validate before subscription) ═══
      case 'tokenizeCreditCard': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { customerId, creditCard: cc, creditCardHolderInfo: hi } = data;
        if (!customerId || !cc?.number) {
          return res.status(400).json({ error: 'customerId e dados do cartão são obrigatórios' });
        }
        
        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
        
        try {
          const token = await asaasRequest(config, '/creditCard/tokenize', 'POST', {
            customer: customerId,
            creditCard: cc,
            creditCardHolderInfo: hi || {},
            remoteIp,
          });
          return res.status(200).json({ 
            success: true, 
            creditCardToken: token.creditCardToken,
            creditCardNumber: token.creditCardNumber,
            creditCardBrand: token.creditCardBrand,
          });
        } catch (e) {
          // Return specific error for card issues
          return res.status(400).json({ 
            success: false, 
            error: e.message,
            errorCode: 'CARD_VALIDATION_FAILED',
          });
        }
      }

      // ═══ Create Subscription in ASAAS ═══
      case 'createSubscription': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { customerId, subscriptionId, value, billingType, nextDueDate, description, cycle, creditCard, creditCardHolderInfo, creditCardToken } = data;
        if (!customerId || !value) {
          return res.status(400).json({ error: 'customerId e value são obrigatórios' });
        }
        
        const payload = {
          customer: customerId,
          billingType: billingType || 'CREDIT_CARD',
          value,
          nextDueDate: nextDueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          cycle: cycle || 'MONTHLY',
          description: description || 'Plano de assinatura',
          externalReference: subscriptionId,
          fine: { value: config.finePercent || 0 },
          interest: { value: config.interestPercent || 0 },
          notifyPaymentCreatedImmediately: true,
        };

        // Use token if available, otherwise raw card data
        if (creditCardToken) {
          payload.creditCardToken = creditCardToken;
          payload.remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
        } else if (creditCard && creditCard.number) {
          payload.creditCard = creditCard;
          payload.creditCardHolderInfo = creditCardHolderInfo || {};
          payload.remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
        }

        const asaasSub = await asaasRequest(config, '/subscriptions', 'POST', payload);
        
        // Update local subscription with gateway IDs
        if (subscriptionId) {
          await sbQuery(`subscriptions?id=eq.${subscriptionId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              gatewaySubscriptionId: asaasSub.id,
              gatewayCustomerId: customerId,
              updatedAt: new Date().toISOString(),
            }),
            prefer: 'return=minimal',
          });
        }
        
        // Check first payment status (for immediate charge validation)
        let firstPaymentStatus = null;
        try {
          const payments = await asaasRequest(config, `/subscriptions/${asaasSub.id}/payments?limit=1`, 'GET');
          if (payments?.data?.length > 0) {
            firstPaymentStatus = payments.data[0].status;
          }
        } catch (e) {
          console.log('[asaas-ops] Could not fetch first payment status:', e.message);
        }
        
        return res.status(200).json({ 
          success: true, 
          asaasSubscriptionId: asaasSub.id,
          firstPaymentStatus,
        });
      }

      // ═══ Update Subscription value in ASAAS ═══
      case 'updateSubscription': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { gatewaySubscriptionId, value, description } = data;
        if (!gatewaySubscriptionId) {
          return res.status(400).json({ error: 'gatewaySubscriptionId obrigatório' });
        }
        
        const updatePayload = {};
        if (value !== undefined) updatePayload.value = value;
        if (description) updatePayload.description = description;
        updatePayload.updatePendingPayments = true;
        
        const updated = await asaasRequest(config, `/subscriptions/${gatewaySubscriptionId}`, 'PUT', updatePayload);
        return res.status(200).json({ success: true, value: updated.value });
      }

      // ═══ Cancel Subscription in ASAAS ═══
      case 'cancelSubscription': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { gatewaySubscriptionId, subscriptionId } = data;
        if (!gatewaySubscriptionId) {
          return res.status(400).json({ error: 'gatewaySubscriptionId obrigatório' });
        }
        
        await asaasRequest(config, `/subscriptions/${gatewaySubscriptionId}`, 'DELETE');
        
        if (subscriptionId) {
          await sbQuery(`subscriptions?id=eq.${subscriptionId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
            prefer: 'return=minimal',
          });
        }
        
        return res.status(200).json({ success: true });
      }

      // ═══ Get Payment History ═══
      case 'getPayments': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { customerId, limit } = data;
        const path = customerId
          ? `/payments?customer=${customerId}&limit=${limit || 20}`
          : `/payments?limit=${limit || 20}`;
        
        const result = await asaasRequest(config, path);
        return res.status(200).json({ success: true, payments: result.data || [] });
      }

      // ═══ Configure Webhook in ASAAS ═══
      case 'configureWebhook': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { appUrl } = data;
        if (!appUrl) return res.status(400).json({ error: 'appUrl obrigatório' });
        
        const webhookUrl = `${appUrl}/api/asaas-webhook`;
        const events = [
          'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED',
          'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED',
          'PAYMENT_DELETED',
        ];
        
        // Generate secure authToken (ASAAS rules: 32-255 chars, no 4+ repeated, no numeric sequences, no spaces)
        const crypto = await import('crypto');
        function generateAsaasToken() {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          const bytes = crypto.randomBytes(48);
          let token = '';
          for (let i = 0; i < 48; i++) token += chars[bytes[i] % chars.length];
          // Validate: no 4+ repeated chars
          if (/(.)\1{3,}/.test(token)) return generateAsaasToken();
          // Validate: no numeric sequences like 12345
          if (/01234|12345|23456|34567|45678|56789/.test(token)) return generateAsaasToken();
          return token;
        }
        const authToken = generateAsaasToken();
        
        // Check if webhook already exists (avoid duplicates)
        let existingWebhook = null;
        try {
          const existing = await asaasRequest(config, '/webhooks', 'GET');
          if (existing?.data?.length > 0) {
            existingWebhook = existing.data.find(w => w.url === webhookUrl);
          }
        } catch (e) {
          console.log('[asaas-ops] No existing webhooks found');
        }
        
        let webhook;
        if (existingWebhook) {
          // Update existing webhook
          webhook = await asaasRequest(config, `/webhooks/${existingWebhook.id}`, 'PUT', {
            url: webhookUrl,
            email: data.email || undefined,
            sendType: 'SEQUENTIALLY',
            enabled: true,
            interrupted: false,
            authToken,
            events,
          });
          console.log(`[asaas-ops] Webhook updated: ${existingWebhook.id}`);
        } else {
          // Create new webhook
          webhook = await asaasRequest(config, '/webhooks', 'POST', {
            name: 'VINNX ERP Webhook',
            url: webhookUrl,
            email: data.email || undefined,
            sendType: 'SEQUENTIALLY',
            enabled: true,
            interrupted: false,
            apiVersion: 3,
            authToken,
            events,
          });
          console.log(`[asaas-ops] Webhook created: ${webhook.id}`);
        }
        
        // Save webhookSecret and webhookUrl to billing_gateway_config
        await sbQuery(`billing_gateway_config?id=eq.${config.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            webhookSecret: authToken,
            webhookUrl: webhookUrl,
            updatedAt: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });
        
        return res.status(200).json({
          success: true,
          webhookSecret: authToken,
          webhookUrl: webhookUrl,
          webhookId: webhook.id,
        });
      }

      // ═══ Get Webhook Status from ASAAS ═══
      case 'getWebhookStatus': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        try {
          const result = await asaasRequest(config, '/webhooks', 'GET');
          const webhooks = result?.data || [];
          const ours = webhooks.find(w => w.url?.includes('/api/asaas-webhook'));
          
          if (ours) {
            return res.status(200).json({
              configured: true,
              url: ours.url,
              enabled: ours.enabled,
              interrupted: ours.interrupted || false,
              webhookId: ours.id,
            });
          }
          return res.status(200).json({ configured: false });
        } catch (e) {
          return res.status(200).json({ configured: false, error: e.message });
        }
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[asaas-ops] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
