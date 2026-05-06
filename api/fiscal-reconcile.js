/**
 * api/fiscal-reconcile.js — Reconciliação de NFS-e presas em 'processing'
 *
 * Cron: diariamente às 06:00 UTC (configurado em vercel.json)
 *
 * Problema que resolve:
 *   NFS-e são assíncronas — a Focus NFe retorna HTTP 202 e depois chama o webhook.
 *   Se o webhook falhar (downtime, erro de rede), a nota fica presa em 'processing' indefinidamente.
 *   Este job consulta o status de notas presas há mais de 2h e as atualiza.
 *
 * Limite: processa no máximo 50 notas por execução para respeitar timeout Vercel (60s).
 */

const { createClient } = require('@supabase/supabase-js');

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials missing');
  return createClient(url, key);
}

const FOCUS_URLS = {
  sandbox:    'https://homologacao.focusnfe.com.br/v2',
  production: 'https://api.focusnfe.com.br/v2',
};

function focusAuth(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

// Mapa de status Focus NFe → status interno (igual ao webhook)
const STATUS_MAP = {
  autorizado:              'authorized',
  processando_autorizacao: 'processing',
  erro_autorizacao:        'rejected',
  cancelado:               'cancelled',
  cancelado_dentro_prazo:  'cancelled',
  cancelado_fora_prazo:    'cancelled',
};

async function reconcileInvoice(supabase, invoice, baseUrl, apiKey) {
  try {
    const endpoint = invoice.docType === 'nfse' ? 'nfse' : 'nfce';
    const res = await fetch(`${baseUrl}/${endpoint}/${invoice.focusNfeRef}`, {
      headers: { Authorization: focusAuth(apiKey) },
    });

    if (!res.ok) {
      console.warn(`[fiscal-reconcile] Focus NFe retornou ${res.status} para ref=${invoice.focusNfeRef}`);
      return 'skipped';
    }

    const data = await res.json();
    const newStatus = STATUS_MAP[data.status];

    if (!newStatus || newStatus === 'processing') {
      return 'still_processing';
    }

    const updates = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    if (newStatus === 'authorized') {
      updates.focusNfeChave  = data.chave_nfe || null;
      updates.protocolNumber = data.numero    || data.chave_nfe || null;
      updates.authorizationDate = new Date().toISOString();
      if (data.caminho_danfe) {
        updates.danfeUrl = data.caminho_danfe;
        updates.pdfUrl   = data.caminho_danfe;
      }
    }

    if (newStatus === 'rejected') {
      updates.rejectionReason = data.mensagem_sefaz || data.mensagem || 'Erro na autorização';
    }

    // Append evento ao histórico
    let events = [];
    try { events = JSON.parse(invoice.events || '[]'); } catch { events = []; }
    events.push({
      id: crypto.randomUUID(),
      type: newStatus,
      description: `Reconciliação automática: ${data.status}`,
      timestamp: new Date().toISOString(),
    });
    updates.events = JSON.stringify(events);

    await supabase.from('invoices').update(updates).eq('id', invoice.id);
    console.log(`[fiscal-reconcile] ${invoice.id} → ${newStatus}`);
    return newStatus;

  } catch (err) {
    console.warn(`[fiscal-reconcile] Erro ao reconciliar ${invoice.id}:`, err.message);
    return 'error';
  }
}

module.exports = async function handler(req, res) {
  // Aceita GET (cron Vercel) e POST (disparo manual)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Buscar notas presas em 'processing' há mais de 2 horas (inclui unitId)
    const { data: stuckInvoices, error } = await supabase
      .from('invoices')
      .select('id, docType, focusNfeRef, events, unitId')
      .eq('status', 'processing')
      .not('focusNfeRef', 'is', null)
      .lt('updatedAt', twoHoursAgo)
      .limit(50);

    if (error) {
      console.error('[fiscal-reconcile] Query error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!stuckInvoices || stuckInvoices.length === 0) {
      console.log('[fiscal-reconcile] Nenhuma nota presa encontrada.');
      return res.status(200).json({ status: 'ok', processed: 0 });
    }

    console.log(`[fiscal-reconcile] Reconciliando ${stuckInvoices.length} notas presas...`);

    // Agrupar invoices por unitId para resolver settings/apiKey de cada unidade
    const groups = {};
    for (const inv of stuckInvoices) {
      const key = inv.unitId || '__global__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(inv);
    }

    const results = { authorized: 0, rejected: 0, cancelled: 0, still_processing: 0, skipped: 0, error: 0 };

    for (const [unitKey, invoices] of Object.entries(groups)) {
      // Resolver settings para este grupo de unidade
      let settings = null;
      if (unitKey !== '__global__') {
        const { data } = await supabase.from('fiscal_settings').select('apiKey, apiEnvironment, apiProvider')
          .eq('unitId', unitKey).maybeSingle();
        settings = data;
      }
      if (!settings) {
        const { data } = await supabase.from('fiscal_settings').select('apiKey, apiEnvironment, apiProvider')
          .is('unitId', null).limit(1).maybeSingle();
        settings = data;
      }

      if (!settings?.apiKey || settings.apiProvider !== 'focus_nfe') {
        console.warn(`[fiscal-reconcile] Unit ${unitKey}: focus_nfe not configured, skipping ${invoices.length} invoices`);
        results.skipped += invoices.length;
        continue;
      }

      const baseUrl = FOCUS_URLS[settings.apiEnvironment || 'sandbox'];

      for (const invoice of invoices) {
        const outcome = await reconcileInvoice(supabase, invoice, baseUrl, settings.apiKey);
        results[outcome] = (results[outcome] || 0) + 1;
      }
    }

    console.log('[fiscal-reconcile] Resultado:', results);
    return res.status(200).json({ status: 'ok', processed: stuckInvoices.length, results });

  } catch (err) {
    console.error('[fiscal-reconcile] Erro interno:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
