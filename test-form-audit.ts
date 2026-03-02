// FIXED Comprehensive Form Field Audit - Tests all data persistence across the ERP system
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

interface TestResult {
    table: string;
    field: string;
    testValue: any;
    savedValue: any;
    loadedValue: any;
    passed: boolean;
    issue?: string;
}

const results: TestResult[] = [];

// Helper to generate UUID
function uuid(): string {
    return crypto.randomUUID();
}

// Helper to run field test
async function testField(
    table: string,
    idField: string,
    idValue: string | number,
    field: string,
    testValue: any,
    skipUpdatedAt: boolean = false
): Promise<TestResult> {
    try {
        // Build update data
        const updateData: any = { [field]: testValue };
        if (!skipUpdatedAt) {
            updateData.updatedAt = new Date().toISOString();
        }

        // Update the field
        const { data: updateResult, error: updateError } = await supabase
            .from(table)
            .update(updateData)
            .eq(idField, idValue)
            .select();

        if (updateError) {
            return { table, field, testValue, savedValue: null, loadedValue: null, passed: false, issue: `UPDATE: ${updateError.message}` };
        }

        if (!updateResult || updateResult.length === 0) {
            return { table, field, testValue, savedValue: null, loadedValue: null, passed: false, issue: `UPDATE: No rows updated (record not found or RLS)` };
        }

        const savedValue = updateResult?.[0]?.[field];

        // Load fresh
        const { data: loadResult, error: loadError } = await supabase
            .from(table)
            .select('*')
            .eq(idField, idValue)
            .maybeSingle();

        if (loadError) {
            return { table, field, testValue, savedValue, loadedValue: null, passed: false, issue: `LOAD: ${loadError.message}` };
        }

        if (!loadResult) {
            return { table, field, testValue, savedValue, loadedValue: null, passed: false, issue: `LOAD: Record not found` };
        }

        const loadedValue = loadResult?.[field];

        // Check if values match (handle date format differences)
        let passed = false;
        if (testValue === loadedValue) {
            passed = true;
        } else if (typeof testValue === 'string' && typeof loadedValue === 'string') {
            // Date format comparison
            const normalizedTest = testValue.split('T')[0];
            const normalizedLoad = loadedValue.split('T')[0];
            passed = normalizedTest === normalizedLoad;
        } else if (typeof testValue === 'number' && typeof loadedValue === 'number') {
            passed = Math.abs(testValue - loadedValue) < 0.01;
        } else if (typeof testValue === 'boolean' && typeof loadedValue === 'boolean') {
            passed = testValue === loadedValue;
        }

        return {
            table,
            field,
            testValue,
            savedValue,
            loadedValue,
            passed,
            issue: passed ? undefined : `Value mismatch: sent ${JSON.stringify(testValue)}, got ${JSON.stringify(loadedValue)}`
        };
    } catch (err: any) {
        return { table, field, testValue, savedValue: null, loadedValue: null, passed: false, issue: err.message };
    }
}

async function runFullAudit() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     COMPREHENSIVE FORM FIELD AUDIT - ALL TABLES (FIXED)      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Get a real team member ID for FK constraints
    const { data: existingTM } = await supabase.from('team_members').select('id').limit(1);
    const realTeamMemberId = existingTM?.[0]?.id || 'no-team-member';

    // Get a real client ID for FK constraints
    const { data: existingClient } = await supabase.from('clients').select('id').limit(1);
    const realClientId = existingClient?.[0]?.id;

    // ============ 1. CLIENTS ============
    console.log('📋 CLIENTS (Clientes)');
    const clientId = uuid();

    await supabase.from('clients').insert({
        id: clientId, name: 'Initial', company: 'Initial', email: `${clientId}@test.com`,
        phone: '0', status: 'LEAD', monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
        updatedAt: new Date().toISOString()
    });

    const clientTests = [
        { field: 'name', value: 'Test Client Audit' },
        { field: 'company', value: 'Test Company' },
        { field: 'email', value: `audit_${Date.now()}@test.com` },
        { field: 'phone', value: '11999998888' },
        { field: 'status', value: 'ACTIVE' },
        { field: 'monthlyValue', value: 1500.50 },
        { field: 'setupValue', value: 500 },
        { field: 'totalValue', value: 2000 },
        { field: 'monthsActive', value: 12 },
        { field: 'origin', value: 'Indicação' },
        { field: 'segment', value: 'E-commerce' },
        { field: 'birthday', value: '1990-05-15' },
        { field: 'lastContact', value: '2026-02-08' },
    ];

    for (const test of clientTests) {
        const result = await testField('clients', 'id', clientId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }
    await supabase.from('clients').delete().eq('id', clientId);

    // ============ 2. TEAM MEMBERS ============
    console.log('\n👥 TEAM MEMBERS (Equipe)');
    const userId = uuid();

    await supabase.from('users').insert({
        id: userId, name: 'Test User Audit', email: `audit_${Date.now()}@test.com`,
        password: 'test123', role: 'SUPPORT', updatedAt: new Date().toISOString()
    });

    const userTests = [
        { field: 'name', value: 'Updated Name' },
        { field: 'email', value: `updated_${Date.now()}@test.com` },
        { field: 'phone', value: '11888887777' },
        { field: 'role', value: 'SALES' },
        { field: 'avatar', value: 'https://example.com/avatar.jpg' },
    ];

    for (const test of userTests) {
        const result = await testField('users', 'id', userId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} users.${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    const tmId = `${userId}_tm`;
    await supabase.from('team_members').insert({
        id: tmId, userId: userId, baseSalary: 0, commissionRate: 0.2,
        joinDate: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    const tmTests = [
        { field: 'baseSalary', value: 5000 },
        { field: 'commissionRate', value: 0.25 },
        { field: 'joinDate', value: '2025-01-15' },
        { field: 'birthDate', value: '1992-08-20' },
        { field: 'cpf', value: '123.456.789-00' },
        { field: 'department', value: 'Vendas' },
    ];

    for (const test of tmTests) {
        const result = await testField('team_members', 'userId', userId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} team_members.${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    // ============ 3. CONTRACTS ============
    console.log('\n📝 CONTRACTS (Contratos)');
    const contractId = uuid();
    const tempClientId = uuid();

    await supabase.from('clients').insert({
        id: tempClientId, name: 'Temp', company: 'Temp', email: `temp_${Date.now()}@t.com`,
        phone: '0', status: 'ACTIVE', monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
        updatedAt: new Date().toISOString()
    });

    await supabase.from('contracts').insert({
        id: contractId, clientId: tempClientId, title: 'Test Contract',
        monthlyValue: 1000, setupValue: 500, contractDuration: 12,
        startDate: new Date().toISOString(), status: 'ACTIVE', updatedAt: new Date().toISOString()
    });

    const contractTests = [
        { field: 'title', value: 'Updated Contract Title' },
        { field: 'monthlyValue', value: 2500.75 },
        { field: 'setupValue', value: 1000 },
        { field: 'contractDuration', value: 24 },
        { field: 'startDate', value: '2025-03-01' },
        { field: 'endDate', value: '2027-02-28' },
        { field: 'status', value: 'PENDING' },
    ];

    for (const test of contractTests) {
        const result = await testField('contracts', 'id', contractId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('contracts').delete().eq('id', contractId);
    await supabase.from('clients').delete().eq('id', tempClientId);

    // ============ 4. TRANSACTIONS ============
    console.log('\n💰 TRANSACTIONS (Transações)');
    const txId = uuid();

    await supabase.from('transactions').insert({
        id: txId, description: 'Test Transaction', amount: 100, type: 'INCOME',
        date: new Date().toISOString().split('T')[0], status: 'PENDING', updatedAt: new Date().toISOString()
    });

    const txTests = [
        { field: 'description', value: 'Updated Description' },
        { field: 'amount', value: 2500.99 },
        { field: 'type', value: 'EXPENSE' },
        { field: 'date', value: '2026-03-15' },
        { field: 'category', value: 'Operacional' },
        { field: 'status', value: 'COMPLETED' },
    ];

    for (const test of txTests) {
        const result = await testField('transactions', 'id', txId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('transactions').delete().eq('id', txId);

    // ============ 5. CALENDAR EVENTS ============
    console.log('\n📅 CALENDAR EVENTS (Agenda)');
    const eventId = uuid();

    await supabase.from('calendar_events').insert({
        id: eventId, title: 'Test Event', type: 'MEETING', startTime: '09:00', endTime: '10:00',
        date: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString()
    });

    const eventTests = [
        { field: 'title', value: 'Updated Event Title' },
        { field: 'type', value: 'CALL' },
        { field: 'startTime', value: '14:00' },
        { field: 'endTime', value: '15:30' },
        { field: 'date', value: '2026-04-01' },
        { field: 'clientName', value: 'Cliente ABC' },
        { field: 'observation', value: 'Alguma observação importante' },
        { field: 'color', value: '#FF5733' },
    ];

    for (const test of eventTests) {
        const result = await testField('calendar_events', 'id', eventId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('calendar_events').delete().eq('id', eventId);

    // ============ 6. BANK ACCOUNTS ============
    console.log('\n🏦 BANK ACCOUNTS (Contas Bancárias)');
    const bankId = uuid();

    await supabase.from('bank_accounts').insert({
        id: bankId, name: 'Test Bank', type: 'Checking', balance: 0,
        color: '#000000', updatedAt: new Date().toISOString()
    });

    const bankTests = [
        { field: 'name', value: 'Conta Principal' },
        { field: 'institution', value: 'Itaú' },
        { field: 'type', value: 'Savings' },
        { field: 'balance', value: 15000.50 },
        { field: 'limit', value: 5000 },
        { field: 'dueDate', value: 15 },
        { field: 'color', value: '#1E88E5' },
        { field: 'archived', value: true },
        { field: 'isDefault', value: true },
    ];

    for (const test of bankTests) {
        const result = await testField('bank_accounts', 'id', bankId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('bank_accounts').delete().eq('id', bankId);

    // ============ 7. BUDGETS ============
    console.log('\n📊 BUDGETS (Orçamentos)');
    const budgetId = uuid();
    const budgetClientId = uuid();

    await supabase.from('clients').insert({
        id: budgetClientId, name: 'Budget Client', company: 'BC', email: `bc_${Date.now()}@t.com`,
        phone: '0', status: 'ACTIVE', monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
        updatedAt: new Date().toISOString()
    });

    await supabase.from('budgets').insert({
        id: budgetId, clientId: budgetClientId, title: 'Test Budget', status: 'Draft',
        items: [], totalValue: 0, validUntil: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
    });

    const budgetTests = [
        { field: 'title', value: 'Proposta Comercial XYZ' },
        { field: 'status', value: 'Sent' },
        { field: 'totalValue', value: 25000.00 },
        { field: 'discount', value: 500 },
        { field: 'validUntil', value: '2026-06-30' },
        { field: 'notes', value: 'Notas do orçamento' },
    ];

    for (const test of budgetTests) {
        const result = await testField('budgets', 'id', budgetId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('budgets').delete().eq('id', budgetId);
    await supabase.from('clients').delete().eq('id', budgetClientId);

    // ============ 8. PROJECTS ============
    console.log('\n📁 PROJECTS (Projetos)');
    const projectId = uuid();
    const projClientId = uuid();

    await supabase.from('clients').insert({
        id: projClientId, name: 'Project Client', company: 'PC', email: `pc_${Date.now()}@t.com`,
        phone: '0', status: 'ACTIVE', monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
        updatedAt: new Date().toISOString()
    });

    await supabase.from('projects').insert({
        id: projectId, clientId: projClientId, title: 'Test Project', status: 'TODO',
        dueDate: new Date().toISOString().split('T')[0], budget: 0, priority: 'MEDIUM',
        updatedAt: new Date().toISOString()
    });

    const projectTests = [
        { field: 'title', value: 'Projeto Website Completo' },
        { field: 'status', value: 'IN_PROGRESS' },
        { field: 'dueDate', value: '2026-08-15' },
        { field: 'budget', value: 50000.00 },
        { field: 'priority', value: 'HIGH' },
    ];

    for (const test of projectTests) {
        const result = await testField('projects', 'id', projectId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('projects').delete().eq('id', projectId);
    await supabase.from('clients').delete().eq('id', projClientId);

    // ============ 9. SERVICES ============
    console.log('\n🛠️ SERVICES (Serviços)');
    const serviceId = uuid();

    await supabase.from('services').insert({
        id: serviceId, name: 'Test Service', description: 'Desc', price: 100, cost: 50,
        type: 'One-Time', active: true, updatedAt: new Date().toISOString()
    });

    const serviceTests = [
        { field: 'name', value: 'Serviço Premium' },
        { field: 'description', value: 'Descrição detalhada do serviço' },
        { field: 'price', value: 2500.00 },
        { field: 'cost', value: 800.00 },
        { field: 'type', value: 'Recurring' },
        { field: 'active', value: false },
    ];

    for (const test of serviceTests) {
        const result = await testField('services', 'id', serviceId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('services').delete().eq('id', serviceId);

    // ============ 10. PERSONAL TASKS - FIXED ID TYPE ============
    console.log('\n✅ PERSONAL TASKS (Tarefas Pessoais)');

    // Insert and get the auto-generated ID
    const { data: insertedTask, error: insertTaskErr } = await supabase.from('personal_tasks').insert({
        text: 'Test Task', scope: 'day', completed: false, assigneeId: 'system'
    }).select().single();

    if (insertTaskErr || !insertedTask) {
        console.log(`  ❌ Could not create test task: ${insertTaskErr?.message}`);
        results.push({ table: 'personal_tasks', field: 'ALL', testValue: null, savedValue: null, loadedValue: null, passed: false, issue: insertTaskErr?.message });
    } else {
        const taskId = insertedTask.id;

        const personalTaskTests = [
            { field: 'text', value: 'Tarefa atualizada com descrição' },
            { field: 'scope', value: 'week' },
            { field: 'completed', value: true },
            { field: 'completedAt', value: '2026-02-08T15:00:00' },
        ];

        for (const test of personalTaskTests) {
            const result = await testField('personal_tasks', 'id', taskId, test.field, test.value, true);
            results.push(result);
            console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
        }

        await supabase.from('personal_tasks').delete().eq('id', taskId);
    }

    // ============ 11. VACATIONS - FIXED: uses teamMemberId ============
    console.log('\n🏖️ VACATIONS (Férias)');
    const vacationId = uuid();

    await supabase.from('vacations').insert({
        id: vacationId, teamMemberId: tmId, startDate: '2026-01-01', endDate: '2026-01-15',
        days: 15, type: 'vacation', status: 'PENDING', updatedAt: new Date().toISOString()
    });

    const vacationTests = [
        { field: 'startDate', value: '2026-07-01' },
        { field: 'endDate', value: '2026-07-15' },
        { field: 'type', value: 'pecuniary' },
        { field: 'status', value: 'APPROVED' },
        { field: 'notes', value: 'Observações sobre as férias' },
        { field: 'approvedBy', value: 'admin-user-id' },
        { field: 'approvedAt', value: '2026-06-15T10:00:00' },
    ];

    for (const test of vacationTests) {
        const result = await testField('vacations', 'id', vacationId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('vacations').delete().eq('id', vacationId);

    // ============ 12. TIME ENTRIES - FIXED: uses teamMemberId ============
    console.log('\n⏰ TIME ENTRIES (Banco de Horas)');
    const timeId = uuid();

    await supabase.from('time_entries').insert({
        id: timeId, teamMemberId: tmId, date: '2026-02-08', type: 'regular',
        updatedAt: new Date().toISOString()
    });

    const timeTests = [
        { field: 'date', value: '2026-02-15' },
        { field: 'clockIn', value: '08:00' },
        { field: 'clockOut', value: '17:00' },
        { field: 'breakMinutes', value: 60 },
        { field: 'totalMinutes', value: 480 },
        { field: 'type', value: 'overtime' },
        { field: 'notes', value: 'Notas do registro' },
    ];

    for (const test of timeTests) {
        const result = await testField('time_entries', 'id', timeId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('time_entries').delete().eq('id', timeId);

    // ============ 13. EVALUATIONS - FIXED: uses teamMemberId ============
    console.log('\n📝 EVALUATIONS (Avaliações)');
    const evalId = uuid();

    await supabase.from('evaluations').insert({
        id: evalId, teamMemberId: tmId, reviewerId: 'system', direction: 'self',
        type: 'monthly', period: '2026-02', criteria: [], overallScore: 3,
        updatedAt: new Date().toISOString()
    });

    const evalTests = [
        { field: 'direction', value: 'manager' },
        { field: 'type', value: 'quarterly' },
        { field: 'period', value: '2026-Q1' },
        { field: 'overallScore', value: 4.5 },
        { field: 'positives', value: 'Pontos positivos do colaborador' },
        { field: 'improvements', value: 'Pontos a melhorar' },
        { field: 'goals', value: 'Metas para próximo período' },
    ];

    for (const test of evalTests) {
        const result = await testField('evaluations', 'id', evalId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('evaluations').delete().eq('id', evalId);

    // ============ 14. GOALS ============
    console.log('\n🎯 GOALS (Metas)');
    const goalId = uuid();

    await supabase.from('goals').insert({
        id: goalId, type: 'revenue', title: 'Test Goal', targetValue: 100000,
        currentValue: 0, period: 'monthly', startDate: '2026-01-01', endDate: '2026-12-31',
        assignedTo: [], updatedAt: new Date().toISOString()
    });

    const goalTests = [
        { field: 'title', value: 'Meta de Vendas Q1 2026' },
        { field: 'type', value: 'mrr' },
        { field: 'targetValue', value: 500000.00 },
        { field: 'currentValue', value: 150000.00 },
        { field: 'period', value: 'quarterly' },
        { field: 'startDate', value: '2026-01-01' },
        { field: 'endDate', value: '2026-03-31' },
    ];

    for (const test of goalTests) {
        const result = await testField('goals', 'id', goalId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('goals').delete().eq('id', goalId);

    // ============ 15. COMMISSIONS ============
    console.log('\n💵 COMMISSIONS (Comissões)');
    const commId = uuid();

    await supabase.from('commissions').insert({
        id: commId, employeeId: 'system', amount: 1000, source: 'Contract #123',
        period: '2026-02', status: 'pending', updatedAt: new Date().toISOString()
    });

    const commTests = [
        { field: 'amount', value: 2500.50 },
        { field: 'source', value: 'Contrato Cliente ABC' },
        { field: 'period', value: '2026-03' },
        { field: 'status', value: 'paid' },
    ];

    for (const test of commTests) {
        const result = await testField('commissions', 'id', commId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('commissions').delete().eq('id', commId);

    // ============ 16. WITHDRAWALS ============
    console.log('\n💸 WITHDRAWALS (Saques/Adiantamentos)');
    const wdId = uuid();

    await supabase.from('withdrawals').insert({
        id: wdId, employeeId: 'system', amount: 500, reason: 'advance',
        date: '2026-02-08', status: 'pending', updatedAt: new Date().toISOString()
    });

    const wdTests = [
        { field: 'amount', value: 1500.00 },
        { field: 'reason', value: 'loan' },
        { field: 'description', value: 'Adiantamento de salário' },
        { field: 'date', value: '2026-02-15' },
        { field: 'status', value: 'approved' },
    ];

    for (const test of wdTests) {
        const result = await testField('withdrawals', 'id', wdId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('withdrawals').delete().eq('id', wdId);

    // ============ 17. SERVICE CREDENTIALS ============
    console.log('\n🔐 SERVICE CREDENTIALS (Credenciais)');
    const credId = uuid();
    const credClientId = uuid();

    await supabase.from('clients').insert({
        id: credClientId, name: 'Cred Client', company: 'CC', email: `cc_${Date.now()}@t.com`,
        phone: '0', status: 'ACTIVE', monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
        updatedAt: new Date().toISOString()
    });

    await supabase.from('service_credentials').insert({
        id: credId, clientId: credClientId, serviceName: 'Test Service',
        category: 'hosting', password: 'initial123', updatedAt: new Date().toISOString()
    });

    const credTests = [
        { field: 'serviceName', value: 'AWS Console' },
        { field: 'category', value: 'api' },
        { field: 'url', value: 'https://console.aws.amazon.com' },
        { field: 'username', value: 'admin@empresa.com' },
        { field: 'password', value: 'SenhaSegura123!' },
        { field: 'notes', value: 'Credenciais de acesso ao console AWS' },
    ];

    for (const test of credTests) {
        const result = await testField('service_credentials', 'id', credId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('service_credentials').delete().eq('id', credId);
    await supabase.from('clients').delete().eq('id', credClientId);

    // ============ 18. CLIENT INTERACTIONS ============
    console.log('\n🤝 CLIENT INTERACTIONS (Interações)');
    const intId = uuid();
    const intClientId = uuid();

    await supabase.from('clients').insert({
        id: intClientId, name: 'Int Client', company: 'IC', email: `ic_${Date.now()}@t.com`,
        phone: '0', status: 'ACTIVE', monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
        updatedAt: new Date().toISOString()
    });

    await supabase.from('client_interactions').insert({
        id: intId, clientId: intClientId, type: 'call', title: 'Test Interaction',
        date: '2026-02-08', userId: 'system', updatedAt: new Date().toISOString()
    });

    const intTests = [
        { field: 'title', value: 'Reunião de alinhamento' },
        { field: 'type', value: 'meeting' },
        { field: 'description', value: 'Detalhes da reunião com o cliente' },
        { field: 'date', value: '2026-02-20' },
    ];

    for (const test of intTests) {
        const result = await testField('client_interactions', 'id', intId, test.field, test.value);
        results.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.field}${result.issue ? ` - ${result.issue}` : ''}`);
    }

    await supabase.from('client_interactions').delete().eq('id', intId);
    await supabase.from('clients').delete().eq('id', intClientId);

    // ============ 19. APP SETTINGS ============
    console.log('\n⚙️ APP SETTINGS (Configurações)');

    const { data: existingSettings } = await supabase.from('app_settings').select('id').limit(1);

    if (existingSettings && existingSettings.length > 0) {
        const settingsId = existingSettings[0].id;
        const testCompany = { name: 'Nova Empresa', cnpj: '12.345.678/0001-00' };

        const { data: updateResult } = await supabase
            .from('app_settings')
            .update({ company: testCompany, updatedAt: new Date().toISOString() })
            .eq('id', settingsId)
            .select();

        const { data: loadResult } = await supabase
            .from('app_settings')
            .select('company')
            .eq('id', settingsId)
            .single();

        const passed = loadResult?.company?.name === testCompany.name;
        results.push({ table: 'app_settings', field: 'company', testValue: testCompany, savedValue: updateResult?.[0]?.company, loadedValue: loadResult?.company, passed, issue: passed ? undefined : 'JSON comparison' });
        console.log(`  ${passed ? '✅' : '❌'} company (JSON)`);
    } else {
        console.log('  ⚠️ No settings record found to test');
    }

    // Cleanup team member and user at the end
    await supabase.from('team_members').delete().eq('userId', userId);
    await supabase.from('users').delete().eq('id', userId);

    // ============ SUMMARY ============
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      AUDIT SUMMARY                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total Fields Tested: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\n❌ FAILED FIELDS:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   ${r.table}.${r.field}: ${r.issue}`);
        });
    }
}

runFullAudit().catch(console.error);
