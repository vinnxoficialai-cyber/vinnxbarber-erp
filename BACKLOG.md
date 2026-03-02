# VINNX ERP — Feature Backlog 🚀

> Funcionalidades planejadas para implementação futura.
> Prioridade: 🔴 Alta | 🟡 Média | 🟢 Baixa

---

## 🔴 Alta Prioridade

### Edge Functions — Cobrança Recorrente de Assinaturas
- **O quê:** Supabase Edge Function que processa cobranças automáticas dos planos de assinatura
- **Por quê:** O sistema enterprise gerencia assinaturas — precisa cobrar automaticamente via gateway (Asaas/Stripe)
- **Escopo:**
  - Cron job diário que verifica assinaturas com `paymentDay` = hoje
  - Gera cobrança no gateway (boleto ou cartão conforme `boletoEnabled`/`creditEnabled`)
  - Atualiza status para `overdue` se não pagar em X dias
  - Webhook para receber confirmação de pagamento e atualizar status para `active`
- **Dependências:** Escolher gateway de pagamento, configurar conta

### Edge Functions — Notificações WhatsApp/Email
- **O quê:** Envio automático de lembretes e notificações
- **Escopo:**
  - Lembrete de agendamento (24h antes)
  - Aviso de cobrança próxima (assinatura)
  - Confirmação de pagamento recebido
  - Parabéns de aniversário (fidelização)
- **Dependências:** API WhatsApp (Evolution API ou Z-API) e/ou Resend/SendGrid para email

---

## 🟡 Média Prioridade

### Edge Functions — Geração de PDF
- Contratos, recibos, relatórios financeiros
- Usar `jsPDF` ou `Puppeteer` no servidor

### Edge Functions — Relatório Automático Semanal
- Resumo de faturamento, agendamentos, churn
- Enviado por email para o dono da barbearia toda segunda

---

## 🟢 Baixa Prioridade

### Realtime Avançado — Notificações Push In-App
- Toast/bell notification quando um novo agendamento é criado
- Hoje já temos Realtime básico (refresh silencioso)

### Edge Functions — Integração com Calendário Google
- Sincronizar agenda do barbeiro com Google Calendar
- Two-way sync

---

## ✅ Implementado

| Feature | Data | Detalhes |
|---------|------|----------|
| **Supabase Auth** | — | Login, registro, sessão, RLS |
| **Supabase Storage** | — | Upload de imagens de produto/perfil |
| **Supabase RPC** | — | Queries complexas |
| **Supabase Realtime** | 2026-02-25 | Channel `vinnx-realtime` em 16 tabelas com debounce 1.5s |
