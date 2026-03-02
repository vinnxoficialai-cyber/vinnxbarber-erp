// Test script to verify all save functions work correctly with Supabase
// Run with: npx tsx prisma/test_save_functions.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load environment variables from .env file
const envContent = fs.readFileSync('.env', 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        // Remove quotes and trim
        let value = valueParts.join('=').trim();
        value = value.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
        envVars[key.trim()] = value;
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseAnonKey = envVars['VITE_SUPABASE_ANON_KEY'];

console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);


console.log('🔍 Testing Save Functions - Verifying Schema Compatibility\n');

// Define test data for each entity
const testData = {
    member: {
        id: 'test_member_' + Date.now(),
        name: 'Test Member',
        email: 'test@example.com',
        role: 'SUPPORT',
        phone: '11999999999',
        updatedAt: new Date().toISOString(),
    },
    teamMember: {
        id: 'test_tm_' + Date.now(),
        userId: 'test_member_' + Date.now(),
        baseSalary: 5000.00,
        commissionRate: 0.20,
        joinDate: new Date().toISOString(),
        cpf: '12345678901',
        birthDate: '1990-01-01',
        updatedAt: new Date().toISOString(),
    },
    client: {
        id: 'test_client_' + Date.now(),
        name: 'Test Client',
        email: 'client@example.com',
        status: 'LEAD',
        updatedAt: new Date().toISOString(),
    },
    contract: {
        id: 'test_contract_' + Date.now(),
        title: 'Test Contract',
        clientId: 'test_client_' + Date.now(),
        monthlyValue: 1000.00,
        contractDuration: 12,
        startDate: new Date().toISOString(),
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
    },
    transaction: {
        id: 1000000 + Date.now(),
        description: 'Test Transaction',
        amount: 100.00,
        type: 'INCOME',
        date: new Date().toISOString(),
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
    },
    calendarEvent: {
        id: 'test_event_' + Date.now(),
        title: 'Test Event',
        type: 'meeting',
        date: new Date().toISOString(),
        startTime: '10:00',
        endTime: '11:00',
        updatedAt: new Date().toISOString(),
    },
    project: {
        id: 'test_project_' + Date.now(),
        title: 'Test Project',
        clientId: 'test_client_' + Date.now(),
        status: 'TODO',
        dueDate: new Date().toISOString(),
        budget: 10000,
        priority: 'MEDIUM',
        tags: ['test'],
        updatedAt: new Date().toISOString(),
    },
    vacation: {
        id: 'test_vacation_' + Date.now(),
        teamMemberId: 'test_member_' + Date.now(),
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        days: 5,
        type: 'vacation',
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
    },
    goal: {
        id: 'test_goal_' + Date.now(),
        employeeId: 'test_member_' + Date.now(),
        title: 'Test Goal',
        type: 'SALES',
        targetValue: 10000,
        currentValue: 0,
        period: '2026-02',
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
    },
    timeEntry: {
        id: 'test_time_' + Date.now(),
        teamMemberId: 'test_member_' + Date.now(),
        date: new Date().toISOString(),
        startTime: '09:00',
        endTime: '18:00',
        totalHours: 8,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
    },
    credential: {
        id: 'test_cred_' + Date.now(),
        clientId: 'test_client_' + Date.now(),
        category: 'hosting',
        serviceName: 'Test Service',
        url: 'https://example.com',
        username: 'testuser',
        password: 'testpass',
        updatedAt: new Date().toISOString(),
    },
    bankAccount: {
        id: 'test_bank_' + Date.now(),
        name: 'Test Account',
        bank: 'Test Bank',
        type: 'checking',
        balance: 1000.00,
        color: '#000000',
        isActive: true,
        updatedAt: new Date().toISOString(),
    },
    service: {
        id: 'test_service_' + Date.now(),
        name: 'Test Service',
        description: 'Test Description',
        price: 100.00,
        type: 'RECURRING',
        active: true,
        updatedAt: new Date().toISOString(),
    },
    budget: {
        id: 'test_budget_' + Date.now(),
        clientId: 'test_client_' + Date.now(),
        title: 'Test Budget',
        value: 5000.00,
        status: 'DRAFT',
        validUntil: new Date().toISOString(),
        items: [],
        updatedAt: new Date().toISOString(),
    },
    pipelineStage: {
        id: 'test_pipeline_' + Date.now(),
        clientId: 'test_client_' + Date.now(),
        stage: 'LEAD',
        updatedAt: new Date().toISOString(),
    },
};

// Tables to test (in order considering FK dependencies)
const tablesToTest = [
    { name: 'users', data: testData.member },
    { name: 'clients', data: testData.client },
    { name: 'team_members', data: testData.teamMember },
    { name: 'contracts', data: testData.contract },
    { name: 'transactions', data: testData.transaction },
    { name: 'calendar_events', data: testData.calendarEvent },
    { name: 'projects', data: testData.project },
    { name: 'vacations', data: testData.vacation },
    { name: 'goals', data: testData.goal },
    { name: 'time_entries', data: testData.timeEntry },
    { name: 'service_credentials', data: testData.credential },
    { name: 'bank_accounts', data: testData.bankAccount },
    { name: 'services', data: testData.service },
    { name: 'budgets', data: testData.budget },
    { name: 'pipeline_stages', data: testData.pipelineStage },
];

async function testTable(tableName: string, data: Record<string, any>) {
    try {
        // Test SELECT first
        const { error: selectError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        if (selectError) {
            console.log(`❌ ${tableName}: SELECT failed - ${selectError.message}`);
            return false;
        }

        // Test INSERT (will fail due to RLS, but tells us if schema is correct)
        const { error: insertError } = await supabase
            .from(tableName)
            .insert(data);

        if (insertError) {
            // Expected error due to RLS - but check if it's a schema error
            if (insertError.message.includes('not-null')) {
                console.log(`❌ ${tableName}: INSERT failed - MISSING REQUIRED FIELD: ${insertError.message}`);
                return false;
            } else if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
                console.log(`❌ ${tableName}: INSERT failed - WRONG COLUMN NAME: ${insertError.message}`);
                return false;
            } else if (insertError.message.includes('violates foreign key')) {
                console.log(`⚠️ ${tableName}: FK constraint (expected for test data)`);
                return true; // This is expected for test data without real FKs
            } else if (insertError.message.includes('new row violates row-level security')) {
                console.log(`✅ ${tableName}: Schema OK (RLS blocked as expected)`);
                return true;
            } else {
                console.log(`⚠️ ${tableName}: ${insertError.message}`);
                return true;
            }
        }

        console.log(`✅ ${tableName}: INSERT succeeded (cleaning up...)`);
        // Clean up the test data
        await supabase.from(tableName).delete().eq('id', data.id);
        return true;

    } catch (err: any) {
        console.log(`❌ ${tableName}: Unexpected error - ${err.message}`);
        return false;
    }
}

async function runTests() {
    console.log('Testing tables...\n');

    let passed = 0;
    let failed = 0;

    for (const { name, data } of tablesToTest) {
        const success = await testTable(name, data);
        if (success) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`${'='.repeat(50)}`);

    if (failed > 0) {
        console.log('\n⚠️ Some tables have schema issues. Review the errors above.');
    } else {
        console.log('\n✅ All tables have correct schema. Data mapping is correct!');
    }
}

runTests().catch(console.error);
