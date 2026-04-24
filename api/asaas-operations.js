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
        
        const customer = await asaasRequest(config, '/customers', 'POST', {
          name,
          cpfCnpj: cpfCnpj.replace(/\D/g, ''),
          email: email || undefined,
          mobilePhone: phone?.replace(/\D/g, '') || undefined,
          externalReference: clientId,
          notificationDisabled: !config.sendNotifications,
        });
        
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

      // ═══ Create Subscription in ASAAS ═══
      case 'createSubscription': {
        const config = await getConfig();
        if (!config) return res.status(400).json({ error: 'Gateway não configurado' });
        
        const { customerId, subscriptionId, value, billingType, nextDueDate, description, cycle } = data;
        if (!customerId || !value) {
          return res.status(400).json({ error: 'customerId e value são obrigatórios' });
        }
        
        const asaasSub = await asaasRequest(config, '/subscriptions', 'POST', {
          customer: customerId,
          billingType: billingType || 'CREDIT_CARD',
          value,
          nextDueDate: nextDueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          cycle: cycle || 'MONTHLY',
          description: description || 'Plano de assinatura',
          externalReference: subscriptionId,
          fine: { value: config.finePercent || 0 },
          interest: { value: config.interestPercent || 0 },
        });
        
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
        
        return res.status(200).json({ success: true, asaasSubscriptionId: asaasSub.id });
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

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[asaas-ops] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
