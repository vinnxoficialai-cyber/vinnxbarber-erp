// Comprehensive CRUD operation test with proper UUIDs
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

interface TestResult {
    operation: string;
    table: string;
    status: 'OK' | 'FAIL';
    error?: string;
}

const results: TestResult[] = [];

async function testRead(table: string) {
    const { error } = await supabase.from(table).select('*').limit(1);
    results.push({
        operation: 'READ',
        table,
        status: error ? 'FAIL' : 'OK',
        error: error?.message
    });
    return !error;
}

async function testInsertDelete(table: string, testData: any, idField = 'id') {
    const { data, error: insertError } = await supabase
        .from(table)
        .insert(testData)
        .select()
        .single();

    if (insertError) {
        results.push({
            operation: 'INSERT',
            table,
            status: 'FAIL',
            error: insertError.message
        });
        return false;
    }

    results.push({
        operation: 'INSERT',
        table,
        status: 'OK'
    });

    const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq(idField, data[idField]);

    if (deleteError) {
        results.push({
            operation: 'DELETE',
            table,
            status: 'FAIL',
            error: deleteError.message
        });
        return false;
    }

    results.push({
        operation: 'DELETE',
        table,
        status: 'OK'
    });

    return true;
}

async function runTests() {
    console.log('\n=== COMPREHENSIVE CRUD TEST ===\n');

    // Test READ on all tables
    const tables = [
        'users', 'team_members', 'clients', 'contracts', 'projects',
        'tasks', 'transactions', 'calendar_events', 'budgets',
        'bank_accounts', 'personal_tasks', 'system_notifications',
        'goals', 'vacations', 'time_entries', 'evaluations',
        'commissions', 'withdrawals', 'service_credentials',
        'pipeline_stages', 'client_interactions', 'app_settings', 'role_permissions'
    ];

    console.log('Testing READ operations on ALL tables...');
    for (const table of tables) {
        await testRead(table);
    }

    console.log('Testing INSERT/DELETE operations...');

    // Test personal_tasks (auto-increment ID)
    await testInsertDelete('personal_tasks', {
        text: 'Test task',
        scope: 'day',
        completed: false,
        assigneeId: 'test-user-id'
    });

    // Test calendar_events (requires UUID)
    await testInsertDelete('calendar_events', {
        id: randomUUID(),
        title: 'Test Event',
        type: 'MEETING',
        startTime: '09:00',
        endTime: '10:00',
        date: new Date().toISOString()
    });

    // Test bank_accounts (requires UUID)
    await testInsertDelete('bank_accounts', {
        id: randomUUID(),
        name: 'Test Account',
        type: 'checking',
        balance: 0
    });

    // Test transactions (requires UUID)
    await testInsertDelete('transactions', {
        id: randomUUID(),
        description: 'Test transaction',
        amount: 100,
        type: 'INCOME',
        date: new Date().toISOString(),
        status: 'PENDING'
    });

    // Test system_notifications (requires UUID)
    await testInsertDelete('system_notifications', {
        id: randomUUID(),
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
        read: false
    });

    // Test goals (requires UUID)
    await testInsertDelete('goals', {
        id: randomUUID(),
        type: 'sales',
        title: 'Test Goal',
        targetValue: 1000,
        period: 'monthly',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        assignedTo: []
    });

    // Print results
    console.log('\n=== RESULTS ===\n');

    const passed = results.filter(r => r.status === 'OK');
    const failed = results.filter(r => r.status === 'FAIL');

    console.log(`PASSED (${passed.length}):`);
    passed.forEach(r => console.log(`  ✅ ${r.operation} ${r.table}`));

    if (failed.length > 0) {
        console.log(`\nFAILED (${failed.length}):`);
        failed.forEach(r => console.log(`  ❌ ${r.operation} ${r.table}: ${r.error}`));
    }

    console.log(`\n=== SUMMARY: ${passed.length}/${results.length} passed ===\n`);

    return failed.length === 0;
}

runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
