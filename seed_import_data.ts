/**
 * VINNX Barber ERP — Seed Import Data Script
 * Importa barbeiros, serviços, planos e 740 clientes da planilha
 *
 * EXECUÇÃO: npx tsx seed_import_data.ts
 * PRÉ-REQUISITO: migration_rpc.sql já executado no Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

// ============ CONFIG ============

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuanlmbHp0dnlvbXJsemRkYXZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg5MTYwOSwiZXhwIjoyMDg3NDY3NjA5fQ.DVuY-JST3nwdiOh1iVBFisB8-mEkb97cfa8__ROIqx8';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const LAGOA_UNIT_ID = '5dfb17a6-d052-469d-8ee9-7b30dcd60477';
const DEFAULT_PASSWORD = 'barbearia2026';
const NOW = new Date().toISOString();

// Barbeiro IDs (existentes no Supabase)
const BARBER_IDS: Record<string, string> = {
  'welison goncalves': 'dd232538-6a5a-43e2-935d-8af2c287bb0e',
  'nicolas braga': '40e6603b-7f86-483f-8e30-8535d463f067',
  'matheus nogueira': '4e56a260-0c85-451f-9a0b-9e24939710b3',
  // Estes serão preenchidos na etapa 2.1
  'fidelis barber': '',
  'júlia lopes': '',
  'julia lopes': '',
};

// ============ HELPERS ============

function normalizePhone(raw: any): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2);
  return d;
}

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  const s = String(val);
  // DD/MM/YYYY
  if (s.includes('/')) {
    const [d, m, y] = s.split('/');
    if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`;
  }
  // Excel serial number
  if (!isNaN(Number(val))) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + Number(val) * 86400000);
    return d.toISOString();
  }
  return null;
}

function mapBarber(name: string | undefined): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  for (const [pattern, id] of Object.entries(BARBER_IDS)) {
    if (key.includes(pattern) || pattern.includes(key)) return id || null;
  }
  return null;
}

function generateReferralCode(name: string, phone: string): string {
  const prefix = name.split(' ')[0].toUpperCase().slice(0, 4);
  const suffix = phone.slice(-4);
  return `${prefix}${suffix}`;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ MAIN ============

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VINNX Barber ERP — Importação de Dados');
  console.log('═══════════════════════════════════════════════════════\n');

  // ════════════════════════════════════════════
  // ETAPA 2.1 — Criar Barbeiros (Fidélis + Júlia)
  // ════════════════════════════════════════════
  console.log('━━━ ETAPA 2.1: Criar Barbeiros ━━━');

  const NEW_BARBERS = [
    { name: 'Fidélis Barber', email: 'fidelis@barbearia.com', mapKey: 'fidelis barber' },
    { name: 'Júlia Lopes', email: 'julia@barbearia.com', mapKey: 'júlia lopes' },
  ];

  for (const barber of NEW_BARBERS) {
    // Check if already exists
    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const exists = existingAuth?.users.find((u: any) => u.email === barber.email);

    if (exists) {
      console.log(`  ⏭️  ${barber.name} já existe (${exists.id})`);
      BARBER_IDS[barber.mapKey] = exists.id;
      if (barber.mapKey === 'júlia lopes') BARBER_IDS['julia lopes'] = exists.id;
      continue;
    }

    // 1. Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: barber.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: barber.name, role: 'BARBER' },
    });
    if (authErr) { console.error(`  ❌ Auth error (${barber.name}):`, authErr.message); continue; }
    const userId = authData.user.id;
    console.log(`  ✅ Auth: ${barber.name} → ${userId}`);

    // 2. users table
    const { error: userErr } = await supabase.from('users').insert({
      id: userId, email: barber.email, name: barber.name, role: 'BARBER',
      updatedAt: NOW,
    });
    if (userErr) console.error(`  ⚠️ Users insert:`, userErr.message);
    else console.log(`  ✅ Users: ${barber.name}`);

    // 3. team_members
    const { error: tmErr } = await supabase.from('team_members').insert({
      id: crypto.randomUUID(), userId, baseSalary: 0, commissionRate: 0.50,
      joinDate: NOW, updatedAt: NOW,
    });
    if (tmErr) console.error(`  ⚠️ team_members:`, tmErr.message);

    // 4. unit_members (LAGOA)
    const { error: umErr } = await supabase.from('unit_members').insert({
      id: crypto.randomUUID(), unitId: LAGOA_UNIT_ID, userId,
      role: 'member', isPrimary: true,
    });
    if (umErr) console.error(`  ⚠️ unit_members:`, umErr.message);

    BARBER_IDS[barber.mapKey] = userId;
    if (barber.mapKey === 'júlia lopes') BARBER_IDS['julia lopes'] = userId;
    await delay(200);
  }

  // ════════════════════════════════════════════
  // ETAPA 2.2 — Deletar dados de teste
  // ════════════════════════════════════════════
  console.log('\n━━━ ETAPA 2.2: Deletar dados de teste ━━━');

  // Deletar subscription antes (FK)
  const { error: delSubErr } = await supabase.from('subscriptions').delete().eq('id', '5562f281-7cfd-475e-a575-31e87c50d983');
  if (delSubErr) console.log(`  ⚠️ Subscription: ${delSubErr.message}`);
  else console.log('  ✅ Subscription teste deletada');

  // Deletar plano teste
  const { error: delPlanErr } = await supabase.from('subscription_plans').delete().eq('id', '5e2b3114-25c2-4ac5-87f0-a021948849f6');
  if (delPlanErr) console.log(`  ⚠️ Plan: ${delPlanErr.message}`);
  else console.log('  ✅ Plano teste deletado');

  // Deletar serviço teste
  const { error: delSvcErr } = await supabase.from('services').delete().eq('id', '000ec767-4954-44bb-b6a9-5a0cb359c568');
  if (delSvcErr) console.log(`  ⚠️ Service: ${delSvcErr.message}`);
  else console.log('  ✅ Serviço teste deletado');

  // ════════════════════════════════════════════
  // ETAPA 2.3 — 21 Serviços Reais
  // ════════════════════════════════════════════
  console.log('\n━━━ ETAPA 2.3: 21 Serviços Reais ━━━');

  const SERVICES = [
    { name: 'Corte de Cabelo', price: 50, category: 'corte', duration: 30 },
    { name: 'Corte + Barba', price: 80, category: 'combo', duration: 50 },
    { name: 'Só Barba', price: 50, category: 'barba', duration: 20 },
    { name: 'Barboterapia', price: 10, category: 'barba', duration: 30 },
    { name: 'Sobrancelha', price: 10, category: 'acabamento', duration: 10 },
    { name: 'Pezinho', price: 10, category: 'acabamento', duration: 15 },
    { name: 'Cavanhaque', price: 10, category: 'barba', duration: 15 },
    { name: 'Hidratação Cabelo', price: 10, category: 'tratamento', duration: 30 },
    { name: 'Hidratação Barba', price: 10, category: 'tratamento', duration: 20 },
    { name: 'Pigmentação Barba', price: 10, category: 'coloração', duration: 40 },
    { name: 'Pigmentação Cabelo', price: 10, category: 'coloração', duration: 40 },
    { name: 'Platinado', price: 10, category: 'coloração', duration: 60 },
    { name: 'Luzes', price: 10, category: 'coloração', duration: 60 },
    { name: 'Selagem', price: 10, category: 'tratamento', duration: 45 },
    { name: 'Relaxamento', price: 10, category: 'tratamento', duration: 45 },
    { name: 'Desondulação', price: 10, category: 'tratamento', duration: 45 },
    { name: 'Limpeza de Pele', price: 10, category: 'estética', duration: 30 },
    { name: 'Cera Nariz', price: 10, category: 'acabamento', duration: 5 },
    { name: 'Cera Ouvido', price: 10, category: 'acabamento', duration: 5 },
    { name: 'Risquinho', price: 10, category: 'acabamento', duration: 10 },
    { name: 'Análise Visagista', price: 10, category: 'consultoria', duration: 30 },
  ];

  const serviceIds: Record<string, string> = {};

  for (const svc of SERVICES) {
    // Idempotent: check if exists
    const { data: existing } = await supabase.from('services').select('id').eq('name', svc.name).single();
    if (existing) {
      console.log(`  ⏭️  ${svc.name} já existe`);
      serviceIds[svc.name] = existing.id;
      continue;
    }

    const id = crypto.randomUUID();
    const { error } = await supabase.from('services').insert({
      id, name: svc.name, price: svc.price, cost: 0,
      type: 'RECURRING', active: true,
      duration: svc.duration, category: svc.category,
      commission: 50, assistantCommission: 0,
      priceVaries: false, returnForecast: 30,
      allowsOnlineBooking: true, registerAllProfessionals: true,
      unitId: LAGOA_UNIT_ID, updatedAt: NOW,
    });
    if (error) console.error(`  ❌ ${svc.name}:`, error.message);
    else { console.log(`  ✅ ${svc.name} (R$${svc.price})`); serviceIds[svc.name] = id; }
  }

  // ════════════════════════════════════════════
  // ETAPA 2.4 — 5 Planos de Assinatura
  // ════════════════════════════════════════════
  console.log('\n━━━ ETAPA 2.4: 5 Planos de Assinatura ━━━');

  const PLANS = [
    { name: 'Corte ilimitado', price: 119.90, serviceMatch: 'Corte de Cabelo', maxUses: null },
    { name: 'Corte + Barba ilimitado', price: 199.90, serviceMatch: 'Corte + Barba', maxUses: null },
    { name: 'Corte 2x/mês', price: 69.90, serviceMatch: 'Corte de Cabelo', maxUses: 2 },
    { name: 'Barba 2x/mês', price: 139.90, serviceMatch: 'Só Barba', maxUses: 2 },
    { name: 'Corte 1x/mês', price: 44.90, serviceMatch: 'Corte de Cabelo', maxUses: 1 },
  ];

  for (const plan of PLANS) {
    // Idempotent
    const { data: existing } = await supabase.from('subscription_plans').select('id').eq('name', plan.name).single();
    if (existing) { console.log(`  ⏭️  ${plan.name} já existe`); continue; }

    // Get service ID
    let svcId = serviceIds[plan.serviceMatch];
    if (!svcId) {
      const { data: svc } = await supabase.from('services').select('id').eq('name', plan.serviceMatch).single();
      svcId = svc?.id;
    }
    if (!svcId) { console.error(`  ❌ Serviço "${plan.serviceMatch}" não encontrado`); continue; }

    const { error } = await supabase.from('subscription_plans').insert({
      id: crypto.randomUUID(),
      name: plan.name, price: plan.price,
      description: plan.name,
      maxUsesPerMonth: plan.maxUses, durationDays: 30,
      active: true, recurrence: 'monthly',
      availableForSale: true, creditEnabled: true,
      benefits: ['10% desc. produtos', '10% desc. química', 'Sem fidelidade'],
      planServices: JSON.stringify([{
        serviceId: svcId, discount: 100,
        monthlyLimit: plan.maxUses, commissionType: 'default',
      }]),
      servicesIncluded: [],
      unitScope: 'specific',
      allowedUnitIds: [LAGOA_UNIT_ID],
      updatedAt: NOW,
    });
    if (error) console.error(`  ❌ ${plan.name}:`, error.message);
    else console.log(`  ✅ ${plan.name} (R$${plan.price})`);
  }

  // ════════════════════════════════════════════
  // ETAPA 2.5 — 728 Clientes (com merge de duplicatas)
  // ════════════════════════════════════════════
  console.log('\n━━━ ETAPA 2.5: Clientes (XLSX → Supabase) ━━━');

  const wb = xlsx.readFile('./1783549f-95e3-4194-b354-8e9beaae3b16.xlsx');
  const rows: any[] = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`  Linhas na planilha: ${rows.length}`);

  // Merge duplicatas: para cada phone, keep o registro com mais finalizados
  const phoneMap = new Map<string, any>();
  for (const r of rows) {
    const phone = normalizePhone(r['Telefone']);
    if (!phone || phone.length !== 11) continue;

    const finalizados = Number(r['Total de agendamentos finalizados']) || 0;

    if (!phoneMap.has(phone)) {
      phoneMap.set(phone, r);
    } else {
      const existing = phoneMap.get(phone);
      const existingFin = Number(existing['Total de agendamentos finalizados']) || 0;
      if (finalizados > existingFin) {
        // Keep com mais finalizados, mas somar os totais
        r['_mergedFinalizados'] = finalizados + existingFin;
        phoneMap.set(phone, r);
      } else {
        existing['_mergedFinalizados'] = (existing['_mergedFinializados'] || existingFin) + finalizados;
      }
    }
  }

  console.log(`  Telefones únicos: ${phoneMap.size} (${rows.length - phoneMap.size} duplicatas merged)`);

  // Check existing phones in DB
  const { data: existingClients } = await supabase.from('clients').select('phone');
  const existingPhones = new Set((existingClients || []).map((c: any) => c.phone).filter(Boolean));

  // Build batch
  const clientBatch: any[] = [];
  let skipped = 0;

  for (const [phone, r] of phoneMap.entries()) {
    if (existingPhones.has(phone)) { skipped++; continue; }

    const name = String(r['Nome do cliente'] || '').trim();
    if (!name) { skipped++; continue; }

    const finalizados = r['_mergedFinalizados'] || Number(r['Total de agendamentos finalizados']) || 0;

    clientBatch.push({
      id: crypto.randomUUID(),
      name,
      email: `${phone}@migrado.local`,
      phone,
      company: '',
      status: 'ACTIVE',
      totalVisits: finalizados,
      lastVisit: parseExcelDate(r['Último agendamento']),
      preferredBarberId: mapBarber(r['Barbeiro do último agendamento']),
      unitId: LAGOA_UNIT_ID,
      monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
      authUserId: null,
      referralCode: generateReferralCode(name, phone),
      referralCredits: 0, referralsMade: 0,
      updatedAt: NOW,
    });
  }

  console.log(`  Clientes a inserir: ${clientBatch.length} (${skipped} skipped)`);

  // Batch insert em lotes de 50
  let inserted = 0, errors = 0;
  for (let i = 0; i < clientBatch.length; i += 50) {
    const batch = clientBatch.slice(i, i + 50);
    const { error } = await supabase.from('clients').insert(batch);
    if (error) {
      console.error(`  ❌ Batch ${i}-${i + batch.length}: ${error.message}`);
      errors++;
      // Try individual inserts for this batch
      for (const client of batch) {
        const { error: singleErr } = await supabase.from('clients').insert(client);
        if (singleErr) console.error(`    ❌ ${client.name} (${client.phone}): ${singleErr.message}`);
        else inserted++;
      }
    } else {
      inserted += batch.length;
      console.log(`  ✅ Batch ${i + 1}-${Math.min(i + 50, clientBatch.length)} OK`);
    }
  }
  console.log(`  Total inseridos: ${inserted} | Erros: ${errors}`);

  // ════════════════════════════════════════════
  // ETAPA 2.6 — Calendar Events
  // ════════════════════════════════════════════
  console.log('\n━━━ ETAPA 2.6: Calendar Events (último agendamento) ━━━');

  const eventBatch: any[] = [];
  for (const client of clientBatch) {
    const row = phoneMap.get(client.phone);
    if (!row || !row['Último agendamento']) continue;

    const lastDate = parseExcelDate(row['Último agendamento']);
    if (!lastDate) continue;

    const serviceName = String(row['Serviços do último agendamento'] || 'Corte de Cabelo').split(',')[0].trim();
    const barberName = String(row['Barbeiro do último agendamento'] || 'Desconhecido');

    eventBatch.push({
      id: crypto.randomUUID(),
      title: `${client.name} — ${serviceName}`,
      type: 'APPOINTMENT',
      startTime: '10:00',
      endTime: '10:30',
      date: lastDate,
      clientId: client.id,
      clientName: client.name,
      barberId: mapBarber(barberName),
      barberName,
      serviceId: null,
      serviceName,
      duration: 30,
      source: 'import',
      status: 'completed',
      unitId: LAGOA_UNIT_ID,
      updatedAt: NOW,
    });
  }

  console.log(`  Events a inserir: ${eventBatch.length}`);

  let evtInserted = 0;
  for (let i = 0; i < eventBatch.length; i += 50) {
    const batch = eventBatch.slice(i, i + 50);
    const { error } = await supabase.from('calendar_events').insert(batch);
    if (error) {
      console.error(`  ❌ Events batch ${i}-${i + batch.length}: ${error.message}`);
    } else {
      evtInserted += batch.length;
    }
  }
  console.log(`  Events inseridos: ${evtInserted}`);

  // ════════════════════════════════════════════
  // RESULTADO FINAL
  // ════════════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log('  VERIFICAÇÃO PÓS-IMPORT');
  console.log('═'.repeat(55));

  for (const table of ['users', 'services', 'subscription_plans', 'clients', 'calendar_events']) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count} rows`);
  }

  const { count: legacyCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).is('authUserId', null);
  console.log(`  clients sem authUserId (legados): ${legacyCount}`);

  const { count: importEvents } = await supabase.from('calendar_events').select('*', { count: 'exact', head: true }).eq('source', 'import');
  console.log(`  calendar_events source=import: ${importEvents}`);

  console.log('\n  🎉 IMPORTAÇÃO COMPLETA!\n');
}

main().catch(console.error);
