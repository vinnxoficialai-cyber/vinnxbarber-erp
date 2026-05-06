/**
 * api/send-fiscal-email.js — Envio de email com DANFE após autorização da NFS-e
 *
 * Chamado por: api/focusnfe-webhook.js quando autoSendEmail=true e nota autorizada.
 *
 * Requer uma das variáveis de ambiente:
 *   RESEND_API_KEY — usa Resend (preferido)
 *   SENDGRID_API_KEY — usa SendGrid (alternativo)
 *
 * Se nenhuma variável estiver configurada, loga aviso e retorna 200 (não bloqueia o webhook).
 */

const FROM_EMAIL = process.env.FISCAL_EMAIL_FROM || 'noreply@vinnxbarber.com.br';
const FROM_NAME  = process.env.FISCAL_EMAIL_FROM_NAME || 'VinnxBarber';

// ─── Resend ───
async function sendViaResend(apiKey, { to, name, danfeUrl, amount, fromName }) {
  const body = buildEmailBody(name, danfeUrl, amount);
  const senderName = fromName || FROM_NAME;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `${senderName} <${FROM_EMAIL}>`,
      to: [to],
      subject: 'Sua Nota Fiscal está disponível',
      html: body,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return await res.json();
}

// ─── SendGrid ───
async function sendViaSendGrid(apiKey, { to, name, danfeUrl, amount, fromName }) {
  const body = buildEmailBody(name, danfeUrl, amount);
  const senderName = fromName || FROM_NAME;
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, name }] }],
      from: { email: FROM_EMAIL, name: senderName },
      subject: 'Sua Nota Fiscal está disponível',
      content: [{ type: 'text/html', value: body }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${err}`);
  }
}

// ─── Template HTML mínimo ───
function buildEmailBody(name, danfeUrl, amount) {
  const amountFormatted = amount
    ? `R$ ${Number(amount).toFixed(2).replace('.', ',')}`
    : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Nota Fiscal</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a1a">Sua Nota Fiscal está disponível</h2>
  <p>Olá${name ? `, <strong>${name}</strong>` : ''}!</p>
  <p>Seu serviço${amountFormatted ? ` no valor de <strong>${amountFormatted}</strong>` : ''} foi registrado e a Nota Fiscal foi emitida com sucesso.</p>
  <p style="margin:24px 0">
    <a href="${danfeUrl}"
       style="background:#1a1a1a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
      Visualizar Nota Fiscal (DANFE)
    </a>
  </p>
  <p style="font-size:12px;color:#666">
    Este é um email automático. Em caso de dúvidas, entre em contato diretamente com o estabelecimento.
  </p>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, danfeUrl, amount, unitName } = req.body || {};

  if (!email || !danfeUrl) {
    return res.status(400).json({ error: 'email e danfeUrl são obrigatórios' });
  }

  // Use unit name for email branding if provided
  const fromName = unitName || process.env.FISCAL_EMAIL_FROM_NAME || 'VinnxBarber';

  const resendKey    = process.env.RESEND_API_KEY;
  const sendgridKey  = process.env.SENDGRID_API_KEY;

  if (!resendKey && !sendgridKey) {
    console.warn('[send-fiscal-email] Nenhum provedor de email configurado (RESEND_API_KEY ou SENDGRID_API_KEY).');
    return res.status(200).json({ status: 'skipped', reason: 'no_provider' });
  }

  try {
    if (resendKey) {
      await sendViaResend(resendKey, { to: email, name, danfeUrl, amount, fromName });
    } else {
      await sendViaSendGrid(sendgridKey, { to: email, name, danfeUrl, amount, fromName });
    }
    console.log(`[send-fiscal-email] Email enviado para ${email}`);
    return res.status(200).json({ status: 'sent' });
  } catch (err) {
    console.error('[send-fiscal-email] Erro ao enviar:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
