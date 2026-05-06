/**
 * api/focusnfe-webhook.js — Receptor de Callbacks da Focus NFe
 *
 * A Focus NFe chama este endpoint quando o status de uma NFS-e muda:
 * - processando_autorizacao → autorizado / erro_autorizacao / cancelado
 *
 * CRÍTICO: Sempre retornar HTTP 200.
 * A Focus NFe para de enviar webhooks após 15 falhas consecutivas (non-200).
 *
 * Configurar na Focus NFe:
 *   URL: https://vinnxbarber-erp.vercel.app/api/focusnfe-webhook
 *   Eventos: autorizado, erro_autorizacao, cancelado
 */

const { createClient } = require('@supabase/supabase-js');

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials missing');
  return createClient(url, key);
}

// Mapa de status Focus NFe → status interno
const STATUS_MAP = {
  autorizado:                'authorized',
  processando_autorizacao:   'processing',
  erro_autorizacao:          'rejected',
  cancelado:                 'cancelled',
  cancelado_dentro_prazo:    'cancelled',
  cancelado_fora_prazo:      'cancelled',
};

// Baixa XML da Focus NFe e salva no Supabase Storage (bucket privado)
async function storeXml(supabase, xmlPath, ref) {
  if (!xmlPath) return null;
  try {
    const res = await fetch(xmlPath);
    if (!res.ok) return null;
    const xml = await res.text();
    const path = `xmls/${ref}.xml`;
    await supabase.storage
      .from('fiscal-xmls')
      .upload(path, Buffer.from(xml, 'utf-8'), {
        contentType: 'application/xml',
        upsert: true,
      });
    // URL assinada (1 ano) — bucket privado
    const { data } = await supabase.storage
      .from('fiscal-xmls')
      .createSignedUrl(path, 31536000);
    return data?.signedUrl || path;
  } catch (e) {
    console.warn('[focusnfe-webhook] XML store failed (non-fatal):', e.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  // Focus NFe envia GET para verificar disponibilidade do endpoint
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'vinnxbarber-fiscal-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ignored' }); // Sempre 200
  }

  // Verificar token secreto (configurado no painel Focus NFe como header customizado)
  const webhookSecret = process.env.FOCUSNFE_WEBHOOK_SECRET;
  if (webhookSecret && req.headers['x-focusnfe-secret'] !== webhookSecret) {
    console.warn('[focusnfe-webhook] Unauthorized: invalid or missing X-FocusNFe-Secret');
    return res.status(200).json({ status: 'unauthorized' }); // Sempre 200
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[focusnfe-webhook] Admin init failed:', e.message);
    return res.status(200).json({ status: 'config_error' }); // Sempre 200
  }

  try {
    const body = req.body || {};
    const {
      ref,
      status,
      chave_nfe,
      numero,
      caminho_xml_nota_fiscal,
      caminho_danfe,
      mensagem_sefaz,
    } = body;

    console.log(`[focusnfe-webhook] Received: ref=${ref}, status=${status}`);

    if (!ref || !status) {
      console.warn('[focusnfe-webhook] Missing ref or status');
      return res.status(200).json({ status: 'missing_fields' });
    }

    // Buscar invoice pelo focusNfeRef (inclui events para append)
    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, status, events, docType, unitId')
      .eq('focusNfeRef', ref)
      .limit(1)
      .single();

    if (fetchErr || !invoice) {
      console.warn(`[focusnfe-webhook] Invoice not found for ref: ${ref}`);
      return res.status(200).json({ status: 'ref_not_found' }); // Sempre 200
    }

    // Idempotência: já está no status final?
    if (['authorized', 'cancelled'].includes(invoice.status) && STATUS_MAP[status] === invoice.status) {
      console.log(`[focusnfe-webhook] Already in final status ${invoice.status}, skipping`);
      return res.status(200).json({ status: 'already_processed' });
    }

    const newStatus = STATUS_MAP[status] || 'processing';
    const now = new Date().toISOString();

    // Montar updates
    const updates = {
      status: newStatus,
      updatedAt: now,
    };

    // Autorizado
    if (newStatus === 'authorized') {
      updates.focusNfeChave = chave_nfe || null;
      updates.protocolNumber = numero || chave_nfe || null;
      updates.authorizationDate = now;
      if (caminho_danfe) {
        updates.danfeUrl = caminho_danfe;
        updates.pdfUrl = caminho_danfe;
      }
      // XML → Supabase Storage
      const xmlStoredUrl = await storeXml(supabase, caminho_xml_nota_fiscal, ref);
      if (xmlStoredUrl) updates.xmlUrl = xmlStoredUrl;
    }

    // Rejeitado
    if (newStatus === 'rejected') {
      updates.rejectionReason = mensagem_sefaz || 'Erro na autorização pela SEFAZ';
    }

    // Cancelado
    if (newStatus === 'cancelled') {
      updates.cancellationReason = mensagem_sefaz || 'Cancelada via Focus NFe';
    }

    // Adicionar evento ao histórico (usa events da query acima, sem query extra)
    let events = [];
    try {
      events = JSON.parse(invoice.events || '[]');
    } catch { events = []; }

    const eventDescriptions = {
      authorized: `NFS-e autorizada pela SEFAZ. Chave: ${chave_nfe || 'N/A'}`,
      rejected:   `Rejeição SEFAZ: ${mensagem_sefaz || 'Erro desconhecido'}`,
      cancelled:  `Cancelada: ${mensagem_sefaz || 'Cancelamento registrado'}`,
      processing: 'Em processamento na SEFAZ',
    };

    events.push({
      id: crypto.randomUUID(),
      type: newStatus === 'authorized' ? 'authorized'
          : newStatus === 'rejected' ? 'rejected'
          : newStatus === 'cancelled' ? 'cancelled'
          : 'queued',
      description: eventDescriptions[newStatus] || `Status atualizado: ${status}`,
      timestamp: now,
    });
    updates.events = JSON.stringify(events);

    // Persistir
    const { error: updateErr } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoice.id);

    if (updateErr) {
      console.error('[focusnfe-webhook] Update error:', updateErr.message);
    } else {
      console.log(`[focusnfe-webhook] Invoice ${invoice.id} updated → ${newStatus}`);
    }

    // Enviar email automático se autorizada e autoSendEmail está ativo (unit-aware)
    if (newStatus === 'authorized') {
      try {
        // Resolver fiscal_settings pela unitId da invoice (com fallback global)
        let fs = null;
        if (invoice.unitId) {
          const { data } = await supabase.from('fiscal_settings').select('autoSendEmail')
            .eq('unitId', invoice.unitId).maybeSingle();
          fs = data;
        }
        if (!fs) {
          const { data } = await supabase.from('fiscal_settings').select('autoSendEmail')
            .is('unitId', null).limit(1).maybeSingle();
          fs = data;
        }
        if (fs?.autoSendEmail && updates.danfeUrl) {
          const { data: inv } = await supabase.from('invoices').select('clientEmail, clientName, totalAmount, unitId').eq('id', invoice.id).single();
          if (inv?.clientEmail) {
            // Buscar nome da unidade para personalizar email
            let unitName = 'VinnxBarber';
            if (inv.unitId) {
              const { data: unit } = await supabase.from('units').select('name').eq('id', inv.unitId).single();
              unitName = unit?.name || unitName;
            }
            const emailUrl = `${process.env.VINNX_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://vinnxbarber-erp.vercel.app')}/api/send-fiscal-email`;
            fetch(emailUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: inv.clientEmail,
                name: inv.clientName,
                danfeUrl: updates.danfeUrl,
                amount: inv.totalAmount,
                unitName,
              }),
            }).catch(e => console.warn('[focusnfe-webhook] Email dispatch failed:', e.message));
          }
        }
      } catch (e) {
        console.warn('[focusnfe-webhook] Auto-email error (non-fatal):', e.message);
      }
    }

    // SEMPRE retornar 200
    return res.status(200).json({ status: 'processed', invoiceId: invoice.id, newStatus });

  } catch (err) {
    console.error('[focusnfe-webhook] Unhandled error:', err);
    // SEMPRE 200 — Focus NFe para o webhook após 15 falhas
    return res.status(200).json({ status: 'internal_error', error: err.message });
  }
};
