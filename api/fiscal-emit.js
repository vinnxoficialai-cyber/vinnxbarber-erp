/**
 * api/fiscal-emit.js — Orquestrador de Emissão Fiscal (SERVER-SIDE)
 *
 * SEGURANÇA: Esta função roda exclusivamente no servidor (Vercel serverless).
 * A chave da Focus NFe e o service_role do Supabase NUNCA chegam ao browser.
 *
 * Chamado por:
 *   - fiscalService.ts (frontend) via POST /api/fiscal-emit
 *   - dataService.closeComanda() via fire-and-forget
 *   - asaas-webhook.js após PAYMENT_CONFIRMED
 */

const { createClient } = require('@supabase/supabase-js');

// ─── Supabase com service_role (lê apiKey, certificatePassword sem RLS) ───
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  return createClient(url, key);
}

// ─── Base URLs Focus NFe ───
const FOCUS_URLS = {
  sandbox:    'https://homologacao.focusnfe.com.br/v2',
  production: 'https://api.focusnfe.com.br/v2',
};

// ─── Autenticação Focus NFe: HTTP Basic com token como usuário, senha vazia ───
function focusAuth(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

// ─── Mapeia método de pagamento da comanda para código Focus NFe ───
function mapPaymentMethod(method) {
  const map = {
    credit:  '03',
    debit:   '04',
    pix:     '17',
    cash:    '01',
    voucher: '05',
  };
  return map[method] || '99'; // 99 = outros
}

// ─── Regime tributário → código Focus NFe ───
function mapTaxRegime(regime) {
  const map = { mei: 1, simples: 1, presumido: 3, real: 3 };
  return map[regime] || 1;
}

// ─── Resolve settings + emitter por unitId (com fallback global) ───
// Suporta N unidades: unit-specific → global fallback
async function resolveUnitContext(supabase, { unitId, comandaId, invoiceId, subscriptionId }) {
  // 1. Resolver unitId da origem
  if (!unitId && comandaId) {
    const { data } = await supabase.from('comandas').select('unitId').eq('id', comandaId).single();
    unitId = data?.unitId || null;
  }
  if (!unitId && subscriptionId) {
    const { data } = await supabase.from('subscriptions').select('unitId').eq('id', subscriptionId).single();
    unitId = data?.unitId || null;
  }
  if (!unitId && invoiceId) {
    const { data } = await supabase.from('invoices').select('unitId').eq('id', invoiceId).single();
    unitId = data?.unitId || null;
  }

  // 2. Resolver settings (unit → fallback global)
  let settings = null;
  if (unitId) {
    const { data } = await supabase.from('fiscal_settings').select('*')
      .eq('unitId', unitId).maybeSingle();
    settings = data;
  }
  if (!settings) {
    const { data } = await supabase.from('fiscal_settings').select('*')
      .is('unitId', null).limit(1).maybeSingle();
    settings = data;
  }

  // 3. Resolver emitter (unit → fallback global)
  let emitter = null;
  if (unitId) {
    const { data } = await supabase.from('invoice_emitters').select('*')
      .eq('unitId', unitId).eq('active', true).eq('type', 'company').maybeSingle();
    emitter = data;
  }
  if (!emitter) {
    const { data } = await supabase.from('invoice_emitters').select('*')
      .eq('active', true).eq('type', 'company').is('unitId', null).limit(1).maybeSingle();
    emitter = data;
  }

  // 4. API Key: settings.apiKey → emitter.focusNfeToken → null
  const apiKey = settings?.apiKey || emitter?.focusNfeToken || null;

  return { unitId, settings, emitter, apiKey };
}

// ─── Constrói payload NFS-e completo para Focus NFe ───
function buildNfsePayload(invoice, emitter) {
  // Sigiss (Nova Serrana-MG) rejeita caracteres: $ / | \ ? ° ª % & " ' =
  function sanitize(str) {
    if (!str) return '';
    return str.replace(/[$\/|\\?°ª%&"'=<>]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const discriminacao = sanitize(
    invoice.items
      .filter(i => i.type === 'service')
      .map(i => `${i.description} - ${i.quantity}x R$ ${Number(i.unitPrice).toFixed(2)}`)
      .join('; ') || 'Servicos de barbearia'
  );

  const valorServicos = Number(invoice.totalServices || invoice.totalAmount || 0);
  // Focus NFe espera alíquota como percentual inteiro (ex: 5 para 5%), NÃO fração decimal
  const issRate = Number(emitter.nfseIssRate || 5);
  if (issRate < 2 || issRate > 5) {
    throw new Error(`Alíquota ISS inválida: ${issRate}%. A LC 116/2003 exige entre 2% e 5%.`);
  }
  const valorIss = Number((valorServicos * issRate / 100).toFixed(2));

  // Monta tomador com CPF/CNPJ dinâmico
  const tomador = {
    razao_social: sanitize(invoice.clientName) || 'Consumidor Final',
  };
  if (invoice.clientCpfCnpj) {
    const digits = invoice.clientCpfCnpj.replace(/\D/g, '');
    // Focus NFe aceita tanto 'cpf' (11 dígitos) quanto 'cnpj' (14 dígitos)
    if (digits.length <= 11) {
      tomador.cpf = digits;
    } else {
      tomador.cnpj = digits;
    }
  }
  if (invoice.clientEmail) {
    tomador.email = invoice.clientEmail;
  }
  if (invoice.clientPhone) {
    tomador.telefone = invoice.clientPhone.replace(/\D/g, '');
  }

  // Sigiss (Nova Serrana-MG) EXIGE endereço completo do tomador
  // Serviços de barbearia são presenciais — endereço do tomador = endereço da unidade/emitente
  // Isso é legalmente correto: local da prestação é o estabelecimento (CNAE 9602-5/01)
  const emitterAddrParts = (emitter.address || '').split(',').map(s => s.trim());
  tomador.endereco = {
    logradouro: sanitize(emitterAddrParts[0]) || 'Nao informado',
    numero: emitterAddrParts[1] || 'S/N',
    bairro: sanitize(emitter.bairro || emitterAddrParts[2]) || 'Centro',
    codigo_municipio: emitter.ibgeMunicipio || '3145208', // Nova Serrana-MG
    uf: emitter.state?.toUpperCase() || 'MG',
    cep: (emitter.zip || '').replace(/\D/g, '') || '',
  };

  // Item lista serviço: Nova Serrana LC 066/2025 classifica barbearia no item 6.01
  // (Cabeleireiros, manicuros, pedicuros e congêneres), NÃO 14.01
  const itemListaServico = emitter.defaultServiceCode || '6.01';

  return {
    data_emissao: new Date().toISOString(),
    // natureza_operacao: 1 = Tributação no município (obrigatório para NFS-e municipal)
    natureza_operacao: 1,
    prestador: {
      cnpj: emitter.cnpj.replace(/\D/g, ''),
      inscricao_municipal: emitter.municipalRegistration,
      codigo_municipio: emitter.ibgeMunicipio || '3145208',
      ...(emitter.address && { logradouro: sanitize(emitter.address.split(',')[0]?.trim()) }),
      ...(emitter.city && { municipio: sanitize(emitter.city) }),
      ...(emitter.state && { uf: emitter.state.toUpperCase() }),
    },
    tomador,
    servico: {
      aliquota: issRate,             // Percentual inteiro (ex: 5 para 5%) — conforme doc Focus NFe
      discriminacao,
      iss_retido: 'false',            // String obrigatória — NÃO boolean (conforme doc Focus NFe)
      item_lista_servico: itemListaServico,
      valor_servicos: valorServicos,
      valor_iss: valorIss,
      base_calculo: valorServicos,
      valor_liquido: valorServicos,   // Valor líquido = valor bruto (sem retenção ISS)
    },
  };
}


// ─── Constrói payload NFC-e completo para Focus NFe ───
function buildNfcePayload(invoice, emitter, paymentMethod) {
  const productItems = invoice.items.filter(i => i.type === 'product');

  // Decompõe endereço do emitente
  const addressParts = (emitter.address || '').split(',');
  const logradouro = addressParts[0]?.trim() || 'Endereço não informado';
  const numero = addressParts[1]?.trim() || 'S/N';

  const totalProductsValue = productItems.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
  const discountTotal = Number(invoice.discountAmount || 0);

  return {
    cnpj_emitente: emitter.cnpj.replace(/\D/g, ''),
    regime_tributario_emitente: mapTaxRegime(emitter.taxRegime),
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    tipo_documento: 1,
    finalidade_emissao: 1,
    consumidor_final: 1,
    presenca_comprador: 1,
    emitente: {
      logradouro,
      numero,
      bairro: emitter.bairro || emitter.neighborhood || addressParts[2]?.trim() || 'Centro',
      municipio: emitter.ibgeMunicipio,
      uf: emitter.state?.toUpperCase(),
      cep: (emitter.zip || '').replace(/\D/g, ''),
    },
    items: productItems.map((item, i) => {
      const itemTotalPrice = Number(item.totalPrice || 0);
      const itemDiscount = discountTotal > 0 && totalProductsValue > 0
        ? Number((discountTotal * itemTotalPrice / totalProductsValue).toFixed(2))
        : 0;
      return {
        numero_item: i + 1,
        codigo_produto: (item.sourceId || item.itemId || String(i + 1)).slice(0, 60),
        codigo_ncm: item.ncm || '96020000',
        cfop: '5102',
        unidade_comercial: 'UN',
        descricao: item.description || item.name || 'Produto',
        quantidade_comercial: item.quantity,
        valor_unitario_comercial: Number(item.unitPrice || item.price || 0),
        valor_bruto: itemTotalPrice,
        ...(itemDiscount > 0 && { valor_desconto: itemDiscount }),
        icms_situacao_tributaria: '400',
        icms_modalidade_base_calculo: 3,
        pis_situacao_tributaria: '07',
        cofins_situacao_tributaria: '07',
      };
    }),
    forma_pagamento: [{
      tipo_pagamento: mapPaymentMethod(paymentMethod),
      valor: invoice.totalAmount,
    }],
  };
}

// ─── Verifica se já existe nota com esta ref na Focus NFe (idempotência) ───
async function checkExistingOnFocus(ref, docType, baseUrl, apiKey) {
  try {
    const endpoint = docType === 'nfse' ? 'nfse' : 'nfce';
    const res = await fetch(`${baseUrl}/${endpoint}/${ref}`, {
      headers: { Authorization: focusAuth(apiKey) },
    });
    if (res.status === 200) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Atualiza invoice via service_role ───
async function updateInvoiceStatus(supabase, invoiceId, updates) {
  const { error } = await supabase.from('invoices').update({
    ...updates,
    updatedAt: new Date().toISOString(),
  }).eq('id', invoiceId);
  if (error) console.error('[fiscal-emit] updateInvoiceStatus error:', error.message);
}

// ─── Baixa XML da Focus NFe e salva no Supabase Storage (bucket privado) ───
async function downloadAndStoreXml(supabase, xmlPath, ref) {
  if (!xmlPath) return null;
  try {
    const focusRes = await fetch(xmlPath);
    if (!focusRes.ok) return null;
    const xmlText = await focusRes.text();
    const xmlBlob = Buffer.from(xmlText, 'utf-8');
    const filePath = `xmls/${ref}.xml`;
    const { error } = await supabase.storage
      .from('fiscal-xmls')
      .upload(filePath, xmlBlob, { contentType: 'application/xml', upsert: true });
    if (error) {
      console.warn('[fiscal-emit] XML storage error (non-fatal):', error.message);
      return null;
    }
    // Gera URL assinada (1 ano = 31536000 segundos) em vez de URL pública
    const { data } = await supabase.storage
      .from('fiscal-xmls')
      .createSignedUrl(filePath, 31536000);
    return data?.signedUrl || filePath;
  } catch (e) {
    console.warn('[fiscal-emit] XML download error (non-fatal):', e.message);
    return null;
  }
}

// ─── Cria invoice draft a partir de items de comanda ───
function buildInvoiceFromComandaItems(comandaItems, comanda, docType, filterType, fiscalSettings) {
  const items = comandaItems
    .filter(item => filterType === 'all' || item.type === filterType)
    .map(item => ({
      id: crypto.randomUUID(),
      type: item.type || 'service',
      sourceId: item.itemId || item.serviceId || item.productId || '',
      description: item.name || item.description || 'Item',
      quantity: item.quantity || 1,
      unitPrice: Number(item.unitPrice || item.price || 0),
      totalPrice: Number(item.totalPrice || 0),
    }));

  const totalServices = items.filter(i => i.type === 'service').reduce((s, i) => s + i.totalPrice, 0);
  const totalProducts = items.filter(i => i.type === 'product').reduce((s, i) => s + i.totalPrice, 0);

  return {
    id: crypto.randomUUID(),
    docType,
    status: 'queued',
    comandaId: comanda.id,
    unitId: comanda.unitId || null,
    emitterId: fiscalSettings?.defaultEmitterId || null,
    clientName: comanda.clientName || 'Consumidor Final',
    clientCpfCnpj: comanda.clientCpfCnpj || null,
    clientEmail: comanda.clientEmail || null,
    clientPhone: comanda.clientPhone || null,
    professionalId: comanda.barberId || null,
    professionalName: comanda.barberName || null,
    items: JSON.stringify(items),
    totalServices,
    totalProducts,
    totalAmount: docType === 'nfse' ? totalServices : totalProducts,
    discountAmount: filterType === 'all' ? (comanda.discountAmount || 0) : 0,
    events: JSON.stringify([{
      id: crypto.randomUUID(),
      type: 'queued',
      description: `Auto-emissão ${docType.toUpperCase()} ao fechar comanda`,
      timestamp: new Date().toISOString(),
    }]),
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Handler principal ───
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { invoiceId, comandaId, subscriptionId, period, type, action, reason } = req.body;

    // ── Cancellation action ──
    if (action === 'cancel' && invoiceId) {
      if (!reason || reason.trim().length < 15) {
        return res.status(400).json({ success: false, error: 'Justificativa de cancelamento deve ter mínimo 15 caracteres (exigência SEFAZ).' });
      }
      // Buscar invoice + settings (unit-aware)
      const { data: inv } = await supabase.from('invoices').select('focusNfeRef, docType, unitId').eq('id', invoiceId).single();
      const ctx = await resolveUnitContext(supabase, { unitId: inv?.unitId, invoiceId });
      const fiscalSettings = ctx.settings;
      const cancelApiKey = ctx.apiKey;
      if (!inv?.focusNfeRef || !cancelApiKey) {
        return res.status(400).json({ success: false, error: 'Nota sem referência ou API não configurada' });
      }
      const baseUrl = FOCUS_URLS[fiscalSettings?.apiEnvironment || 'sandbox'];
      const endpoint = inv.docType === 'nfse' ? 'nfse' : 'nfce';
      const cancelRes = await fetch(`${baseUrl}/${endpoint}/${inv.focusNfeRef}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: focusAuth(cancelApiKey),
        },
        body: JSON.stringify({ justificativa: reason || 'Cancelamento solicitado pelo usuário' }),
      });
      const cancelData = await cancelRes.json();
      if (cancelRes.ok) {
        await updateInvoiceStatus(supabase, invoiceId, {
          status: 'cancelled',
          cancellationReason: reason,
        });
        return res.status(200).json({ success: true });
      }
      return res.status(200).json({ success: false, error: cancelData.mensagem || 'Erro no cancelamento' });
    }

    // ── Check status action ──
    if (action === 'check_status' && invoiceId) {
      const { data: inv } = await supabase.from('invoices').select('focusNfeRef, docType, unitId').eq('id', invoiceId).single();
      const ctx = await resolveUnitContext(supabase, { unitId: inv?.unitId, invoiceId });
      const fiscalSettings = ctx.settings;
      const statusApiKey = ctx.apiKey;
      if (!inv?.focusNfeRef || !statusApiKey) {
        return res.status(200).json({ success: false, error: 'Sem referência ou API' });
      }
      const existing = await checkExistingOnFocus(inv.focusNfeRef, inv.docType, FOCUS_URLS[fiscalSettings?.apiEnvironment || 'sandbox'], statusApiKey);
      return res.status(200).json({ success: true, data: existing });
    }

    // ── Determina o invoice a emitir ──
    let invoice = null;

    if (invoiceId && !action) {
      // Emissão manual: invoice já criado pelo frontend
      const { data } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
      if (data) {
        invoice = { ...data, items: JSON.parse(data.items || '[]'), events: JSON.parse(data.events || '[]') };
      }
    } else if (comandaId && (type === 'auto_close' || type === 'auto_close_nfse' || type === 'auto_close_nfce')) {
      // Auto-emissão ao fechar comanda: buscar comanda COM items e dados do cliente
      const { data: comanda } = await supabase
        .from('comandas')
        .select('*, comanda_items(*)')
        .eq('id', comandaId)
        .single();
      if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada' });

      // Enriquecer com dados do cliente (cpfCnpj, email e phone ficam na tabela clients)
      if (comanda.clientId) {
        const { data: client } = await supabase
          .from('clients')
          .select('cpfCnpj, email, phone')
          .eq('id', comanda.clientId)
          .single();
        if (client) {
          comanda.clientCpfCnpj = client.cpfCnpj || null;
          comanda.clientEmail = client.email || null;
          comanda.clientPhone = client.phone || null;
        }
      }

      const comandaItems = comanda.comanda_items || [];
      const ctxComanda = await resolveUnitContext(supabase, { unitId: comanda.unitId, comandaId });
      const fiscalSettings = ctxComanda.settings;
      const hasServices = comandaItems.some(i => i.type === 'service');
      const hasProducts = comandaItems.some(i => i.type === 'product');

      if (type === 'auto_close' && hasServices && hasProducts && fiscalSettings?.splitMixedComanda) {
        // Comanda mista: despachar 2 chamadas separadas
        const selfUrl = process.env.VINNX_APP_URL
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const splitUnitId = comanda.unitId || null;
        fetch(`${selfUrl}/api/fiscal-emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comandaId, type: 'auto_close_nfse', unitId: splitUnitId }),
        }).catch(e => console.warn('[fiscal-emit] split nfse dispatch failed:', e.message));
        fetch(`${selfUrl}/api/fiscal-emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comandaId, type: 'auto_close_nfce', unitId: splitUnitId }),
        }).catch(e => console.warn('[fiscal-emit] split nfce dispatch failed:', e.message));
        return res.status(202).json({ status: 'split_dispatched' });
      }

      // Determinar tipo e filtro baseado no type
      let docType, filterType;
      if (type === 'auto_close_nfse') {
        docType = 'nfse'; filterType = 'service';
      } else if (type === 'auto_close_nfce') {
        docType = 'nfce'; filterType = 'product';
      } else {
        docType = hasProducts && !hasServices ? 'nfce' : 'nfse';
        filterType = 'all';
      }

      const newInvoice = buildInvoiceFromComandaItems(comandaItems, comanda, docType, filterType, fiscalSettings);
      await supabase.from('invoices').insert(newInvoice);
      invoice = { ...newInvoice, items: JSON.parse(newInvoice.items), events: JSON.parse(newInvoice.events) };

    } else if (subscriptionId && type === 'nfse_subscription' && period) {
      // Auto-emissão NFS-e de assinatura
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('id', subscriptionId)
        .single();
      if (!sub) return res.status(404).json({ error: 'Assinatura não encontrada' });

      const plan = sub.subscription_plans;
      const description = `Assinatura ${plan?.name || 'Plano'} — ${period}`;
      const amount = plan?.price || 0;
      const ctxSub = await resolveUnitContext(supabase, { unitId: sub.unitId, subscriptionId });
      const fiscalSettings = ctxSub.settings;

      const newInvoice = {
        id: crypto.randomUUID(),
        docType: 'nfse',
        status: 'queued',
        unitId: sub.unitId || null,
        emitterId: fiscalSettings?.defaultEmitterId || null,
        appointmentId: subscriptionId,
        clientName: sub.clientName || 'Assinante',
        clientEmail: sub.billingEmail || null,
        items: JSON.stringify([{
          id: crypto.randomUUID(), type: 'service',
          sourceId: plan?.id || 'plan', description,
          quantity: 1, unitPrice: amount, totalPrice: amount,
        }]),
        totalServices: amount,
        totalProducts: 0,
        totalAmount: amount,
        discountAmount: 0,
        events: JSON.stringify([{
          id: crypto.randomUUID(), type: 'queued',
          description: `Auto-emissão assinatura ${period}`,
          timestamp: new Date().toISOString(),
        }]),
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await supabase.from('invoices').insert(newInvoice);
      invoice = { ...newInvoice, items: JSON.parse(newInvoice.items), events: JSON.parse(newInvoice.events) };
    }

    if (!invoice) {
      return res.status(400).json({ error: 'Parâmetros inválidos: forneça invoiceId, comandaId ou subscriptionId+period' });
    }

    // ── Buscar settings e emitter por unidade (com fallback global) ──
    const ctx = await resolveUnitContext(supabase, {
      unitId: req.body.unitId || invoice.unitId,
      comandaId: invoice.comandaId,
      invoiceId: invoice.id,
    });
    const fiscalSettings = ctx.settings;
    const apiKey = ctx.apiKey;

    if (!fiscalSettings?.apiProvider || fiscalSettings.apiProvider === 'none' || !apiKey) {
      return res.status(400).json({ error: 'Provedor fiscal não configurado. Acesse Configurações → Integração API.' });
    }
    if (fiscalSettings.apiProvider !== 'focus_nfe') {
      return res.status(400).json({ error: `Provedor '${fiscalSettings.apiProvider}' não suportado. Use 'focus_nfe'.` });
    }

    const environment = fiscalSettings.apiEnvironment || 'sandbox';
    const baseUrl = FOCUS_URLS[environment];

    // ── Emitter: usar do context (já resolvido por unitId) ou buscar por emitterId específico ──
    let emitter = ctx.emitter;
    if (!emitter && invoice.emitterId) {
      const { data } = await supabase.from('invoice_emitters').select('*').eq('id', invoice.emitterId).single();
      emitter = data;
    }
    if (!emitter) {
      return res.status(400).json({ error: 'Nenhum emitente configurado para esta unidade. Acesse Configurações → Dados do Emitente.' });
    }

    // ── Validações obrigatórias ──
    const errors = [];
    if (!emitter.cnpj) errors.push('CNPJ do emitente não preenchido');
    if (invoice.docType === 'nfse' && !emitter.municipalRegistration) errors.push('Inscrição Municipal obrigatória para NFS-e');
    if (invoice.docType === 'nfse' && !emitter.ibgeMunicipio) errors.push('Código IBGE do município obrigatório para NFS-e');
    if (environment === 'production' && emitter.certificateStatus !== 'valid') errors.push('Certificado digital inválido ou ausente (obrigatório em produção)');
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

    // ── Gerar ref determinística (idempotência) ──
    let ref;
    if (invoice.comandaId) {
      ref = `${invoice.docType}-${invoice.comandaId.slice(0, 20)}`;
    } else if (invoice.appointmentId && period) {
      const cleanPeriod = String(period).replace(/\D/g, '').slice(0, 6);
      ref = `nfse-sub-${invoice.appointmentId.slice(0, 16)}-${cleanPeriod}`;
    } else {
      ref = `${invoice.docType}-${invoice.id.slice(0, 24)}`;
    }
    ref = ref.replace(/[^a-zA-Z0-9\-_]/g, '-').slice(0, 50);

    // ── Verificar idempotência ──
    const existing = await checkExistingOnFocus(ref, invoice.docType, baseUrl, apiKey);
    if (existing && ['autorizado', 'processando_autorizacao'].includes(existing.status)) {
      console.log(`[fiscal-emit] Ref ${ref} já existe com status ${existing.status}`);
      const statusMap = { autorizado: 'authorized', processando_autorizacao: 'processing' };
      await updateInvoiceStatus(supabase, invoice.id, {
        status: statusMap[existing.status],
        focusNfeRef: ref,
        focusNfeChave: existing.chave_nfe || existing.numero,
        pdfUrl: existing.caminho_danfe || null,
        xmlUrl: existing.caminho_xml_nota_fiscal || null,
      });
      return res.status(200).json({ status: 'already_exists', focusNfeRef: ref });
    }

    // ── Construir payload ──
    const payload = invoice.docType === 'nfse'
      ? buildNfsePayload(invoice, emitter)
      : buildNfcePayload(invoice, emitter, invoice.paymentMethod);

    // ── Salvar ref antes de chamar a API ──
    await updateInvoiceStatus(supabase, invoice.id, { status: 'processing', focusNfeRef: ref });

    // ── Chamar Focus NFe API ──
    const focusEndpoint = invoice.docType === 'nfse' ? 'nfse' : 'nfce';
    const focusRes = await fetch(`${baseUrl}/${focusEndpoint}?ref=${ref}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: focusAuth(apiKey),
      },
      body: JSON.stringify(payload),
    });

    const focusData = await focusRes.json();
    console.log(`[fiscal-emit] Focus NFe response (${focusRes.status}):`, JSON.stringify(focusData).slice(0, 500));

    // ── NFC-e SÍNCRONA: HTTP 201 = autorizada ──
    if (focusRes.status === 201 && invoice.docType === 'nfce') {
      const xmlUrl = await downloadAndStoreXml(supabase, focusData.caminho_xml_nota_fiscal, ref);
      await updateInvoiceStatus(supabase, invoice.id, {
        status: 'authorized',
        focusNfeRef: ref,
        focusNfeChave: focusData.chave_nfe,
        pdfUrl: focusData.caminho_danfe || null,
        danfeUrl: focusData.caminho_danfe || null,
        xmlUrl,
        protocolNumber: focusData.numero,
        authorizationDate: new Date().toISOString(),
        events: JSON.stringify([
          ...(invoice.events || []),
          { id: crypto.randomUUID(), type: 'authorized', description: `NFC-e autorizada. Chave: ${focusData.chave_nfe}`, timestamp: new Date().toISOString() },
        ]),
      });
      return res.status(200).json({ success: true, status: 'authorized', focusNfeRef: ref, chave: focusData.chave_nfe });
    }

    // ── NFS-e ASSÍNCRONA: HTTP 202 = processando ──
    if (focusRes.status === 202 && invoice.docType === 'nfse') {
      await updateInvoiceStatus(supabase, invoice.id, {
        status: 'processing',
        focusNfeRef: ref,
        events: JSON.stringify([
          ...(invoice.events || []),
          { id: crypto.randomUUID(), type: 'queued', description: 'NFS-e enviada para processamento na Focus NFe', timestamp: new Date().toISOString() },
        ]),
      });
      return res.status(202).json({ success: true, status: 'processing', focusNfeRef: ref, message: 'NFS-e em processamento. Aguardando webhook.' });
    }

    // ── Erro da Focus NFe ──
    const errorMsg = focusData.mensagem || focusData.erros?.[0]?.mensagem || `Erro HTTP ${focusRes.status}`;
    await updateInvoiceStatus(supabase, invoice.id, {
      status: 'rejected',
      rejectionReason: errorMsg,
      events: JSON.stringify([
        ...(invoice.events || []),
        { id: crypto.randomUUID(), type: 'rejected', description: `Rejeição: ${errorMsg}`, timestamp: new Date().toISOString() },
      ]),
    });
    return res.status(200).json({ success: false, error: errorMsg });

  } catch (err) {
    console.error('[fiscal-emit] Erro interno:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor fiscal' });
  }
};
