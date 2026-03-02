// COMPLETE CRUD TEST - Testing EVERY operation in the ERP
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

interface TestResult {
    category: string;
    operation: string;
    status: 'PASS' | 'FAIL';
    error?: string;
}

const results: TestResult[] = [];

function logResult(category: string, operation: string, passed: boolean, error?: string) {
    results.push({
        category,
        operation,
        status: passed ? 'PASS' : 'FAIL',
        error
    });
    console.log(`  ${passed ? '✅' : '❌'} ${operation}${error ? ': ' + error : ''}`);
}

async function testTableCRUD(
    tableName: string,
    insertData: any,
    updateField: string,
    updateValue: any,
    idField = 'id'
) {
    const category = tableName.toUpperCase();

    // CREATE
    const { data: created, error: createError } = await supabase
        .from(tableName)
        .insert(insertData)
        .select()
        .single();

    if (createError) {
        logResult(category, 'CREATE', false, createError.message);
        return;
    }
    logResult(category, 'CREATE', true);

    const id = created[idField];

    // READ
    const { error: readError } = await supabase
        .from(tableName)
        .select('*')
        .eq(idField, id)
        .single();

    logResult(category, 'READ', !readError, readError?.message);

    // UPDATE
    const { data: updated, error: updateError } = await supabase
        .from(tableName)
        .update({ [updateField]: updateValue })
        .eq(idField, id)
        .select();

    if (updateError) {
        logResult(category, 'UPDATE', false, updateError.message);
    } else if (!updated || updated.length === 0) {
        logResult(category, 'UPDATE', false, 'No rows returned (RLS issue?)');
    } else {
        logResult(category, 'UPDATE', true);
    }

    // DELETE
    const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq(idField, id);

    logResult(category, 'DELETE', !deleteError, deleteError?.message);
}

async function runComprehensiveTests() {
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║     COMPREHENSIVE ERP CRUD TESTS              ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    const now = new Date().toISOString();
    const testUUID = randomUUID();

    // ============================================
    // PERSONAL TASKS (Auto-increment ID)
    // ============================================
    console.log('\n📋 PERSONAL TASKS');
    await testTableCRUD(
        'personal_tasks',
        { text: 'Test Task', scope: 'day', completed: false, assigneeId: testUUID },
        'completed',
        true
    );

    // ============================================
    // CALENDAR EVENTS
    // ============================================
    console.log('\n📅 CALENDAR EVENTS');
    await testTableCRUD(
        'calendar_events',
        { id: randomUUID(), title: 'Test Event', type: 'MEETING', startTime: '09:00', endTime: '10:00', date: now, updatedAt: now },
        'title',
        'Updated Event'
    );

    // ============================================
    // BANK ACCOUNTS
    // ============================================
    console.log('\n🏦 BANK ACCOUNTS');
    await testTableCRUD(
        'bank_accounts',
        { id: randomUUID(), name: 'Test Account', type: 'checking', balance: 0, updatedAt: now },
        'balance',
        1000
    );

    // ============================================
    // TRANSACTIONS
    // ============================================
    console.log('\n💰 TRANSACTIONS');
    await testTableCRUD(
        'transactions',
        { id: randomUUID(), description: 'Test Transaction', amount: 100, type: 'INCOME', date: now, status: 'PENDING', updatedAt: now },
        'amount',
        200
    );

    // ============================================
    // GOALS
    // ============================================
    console.log('\n🎯 GOALS');
    await testTableCRUD(
        'goals',
        { id: randomUUID(), type: 'sales', title: 'Test Goal', targetValue: 1000, period: 'monthly', startDate: now, endDate: now, assignedTo: [], updatedAt: now },
        'targetValue',
        2000
    );

    // ============================================
    // SYSTEM NOTIFICATIONS
    // ============================================
    console.log('\n🔔 SYSTEM NOTIFICATIONS');
    await testTableCRUD(
        'system_notifications',
        { id: randomUUID(), type: 'info', title: 'Test Notification', message: 'Test message', read: false },
        'read',
        true
    );

    // ============================================
    // VACATIONS
    // ============================================
    console.log('\n🏖️ VACATIONS');
    // First get a team member ID
    const { data: teamMembers } = await supabase.from('team_members').select('id').limit(1);
    if (teamMembers && teamMembers.length > 0) {
        await testTableCRUD(
            'vacations',
            { id: randomUUID(), teamMemberId: teamMembers[0].id, startDate: now, endDate: now, days: 5, type: 'vacation', status: 'PENDING', updatedAt: now },
            'days',
            10
        );
    } else {
        logResult('VACATIONS', 'SKIP', false, 'No team members found');
    }

    // ============================================
    // TIME ENTRIES
    // ============================================
    console.log('\n⏰ TIME ENTRIES');
    if (teamMembers && teamMembers.length > 0) {
        await testTableCRUD(
            'time_entries',
            { id: randomUUID(), teamMemberId: teamMembers[0].id, date: now, clockIn: '09:00', clockOut: '18:00', totalMinutes: 540, type: 'regular', updatedAt: now },
            'totalMinutes',
            600
        );
    } else {
        logResult('TIME_ENTRIES', 'SKIP', false, 'No team members found');
    }

    // ============================================
    // COMMISSIONS
    // ============================================
    console.log('\n💵 COMMISSIONS');
    await testTableCRUD(
        'commissions',
        { id: randomUUID(), employeeId: testUUID, amount: 500, source: 'sales', period: '2026-02', status: 'pending' },
        'status',
        'approved'
    );

    // ============================================
    // WITHDRAWALS
    // ============================================
    console.log('\n💸 WITHDRAWALS');
    await testTableCRUD(
        'withdrawals',
        { id: randomUUID(), employeeId: testUUID, amount: 200, reason: 'advance', date: now, status: 'pending' },
        'status',
        'approved'
    );

    // ============================================
    // BUDGETS (requires client)
    // ============================================
    console.log('\n📊 BUDGETS');
    const { data: clients } = await supabase.from('clients').select('id').limit(1);
    if (clients && clients.length > 0) {
        await testTableCRUD(
            'budgets',
            { id: randomUUID(), clientId: clients[0].id, title: 'Test Budget', status: 'Draft', items: [], totalValue: 1000, discount: 0, validUntil: now, updatedAt: now },
            'status',
            'Approved'
        );
    } else {
        logResult('BUDGETS', 'SKIP', false, 'No clients found');
    }

    // ============================================
    // PROJECTS (requires client)
    // ============================================
    console.log('\n📁 PROJECTS');
    if (clients && clients.length > 0) {
        await testTableCRUD(
            'projects',
            { id: randomUUID(), title: 'Test Project', clientId: clients[0].id, status: 'TODO', priority: 'MEDIUM', progress: 0, startDate: now, tags: [], updatedAt: now },
            'progress',
            50
        );
    } else {
        logResult('PROJECTS', 'SKIP', false, 'No clients found');
    }

    // ============================================
    // TASKS (standalone, not project tasks)
    // ============================================
    console.log('\n✅ TASKS');
    await testTableCRUD(
        'tasks',
        { id: randomUUID(), title: 'Test Task', status: 'TODO', priority: 'MEDIUM', updatedAt: now },
        'status',
        'IN_PROGRESS'
    );

    // ============================================
    // CLIENT INTERACTIONS (requires client)
    // ============================================
    console.log('\n🤝 CLIENT INTERACTIONS');
    if (clients && clients.length > 0) {
        await testTableCRUD(
            'client_interactions',
            { id: randomUUID(), clientId: clients[0].id, type: 'call', title: 'Test Call', date: now, userId: testUUID },
            'title',
            'Updated Call'
        );
    } else {
        logResult('CLIENT_INTERACTIONS', 'SKIP', false, 'No clients found');
    }

    // ============================================
    // SERVICE CREDENTIALS (requires client)
    // ============================================
    console.log('\n🔐 SERVICE CREDENTIALS');
    if (clients && clients.length > 0) {
        await testTableCRUD(
            'service_credentials',
            { id: randomUUID(), clientId: clients[0].id, serviceName: 'Test Service', category: 'other', password: 'test123', updatedAt: now },
            'serviceName',
            'Updated Service'
        );
    } else {
        logResult('SERVICE_CREDENTIALS', 'SKIP', false, 'No clients found');
    }

    // ============================================
    // EVALUATIONS (requires team member)
    // ============================================
    console.log('\n📝 EVALUATIONS');
    if (teamMembers && teamMembers.length > 0) {
        await testTableCRUD(
            'evaluations',
            { id: randomUUID(), teamMemberId: teamMembers[0].id, reviewerId: testUUID, direction: 'manager', type: 'monthly', period: '2026-02', criteria: {}, overallScore: 4.5 },
            'overallScore',
            5.0
        );
    } else {
        logResult('EVALUATIONS', 'SKIP', false, 'No team members found');
    }

    // ============================================
    // TEAM MEMBERS - Birthday Update Test
    // ============================================
    console.log('\n👥 TEAM MEMBERS - Birthday Update');
    if (teamMembers && teamMembers.length > 0) {
        const { data: updated, error } = await supabase
            .from('team_members')
            .update({ birthDate: '1990-05-15', updatedAt: now })
            .eq('id', teamMembers[0].id)
            .select();

        if (error) {
            logResult('TEAM_MEMBERS', 'UPDATE_BIRTHDAY', false, error.message);
        } else if (!updated || updated.length === 0) {
            logResult('TEAM_MEMBERS', 'UPDATE_BIRTHDAY', false, 'No rows returned (RLS?)');
        } else {
            logResult('TEAM_MEMBERS', 'UPDATE_BIRTHDAY', true);
        }
    }

    // ============================================
    // APP SETTINGS
    // ============================================
    console.log('\n⚙️ APP SETTINGS');
    const { data: settings } = await supabase.from('app_settings').select('id').limit(1);
    if (settings && settings.length > 0) {
        const { data: updated, error } = await supabase
            .from('app_settings')
            .update({ company: { name: 'Test Company' }, updatedAt: now })
            .eq('id', settings[0].id)
            .select();

        logResult('APP_SETTINGS', 'UPDATE', !error && updated && updated.length > 0, error?.message);
    } else {
        // Create settings if none exist
        const { error } = await supabase.from('app_settings').insert({ id: randomUUID(), company: {}, updatedAt: now });
        logResult('APP_SETTINGS', 'CREATE', !error, error?.message);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║                   SUMMARY                     ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.status === 'PASS');
    const failed = results.filter(r => r.status === 'FAIL');

    console.log(`Total: ${results.length} tests`);
    console.log(`✅ Passed: ${passed.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (failed.length > 0) {
        console.log('\n❌ FAILED OPERATIONS:');
        failed.forEach(r => {
            console.log(`  ${r.category} - ${r.operation}: ${r.error || 'Unknown error'}`);
        });
    }

    console.log('\n');
    return failed.length === 0;
}

runComprehensiveTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
