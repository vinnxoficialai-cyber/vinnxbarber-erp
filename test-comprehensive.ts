// COMPREHENSIVE SYSTEM AUDIT - All Patterns Test Suite (FIXED)
// Tests: Auth, Session, Data Persistence, Edge Cases, Error Handling
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

interface TestResult {
    category: string;
    test: string;
    passed: boolean;
    details?: string;
}

const results: TestResult[] = [];

function log(msg: string) {
    console.log(msg);
}

function uuid(): string {
    return crypto.randomUUID();
}

function now(): string {
    return new Date().toISOString();
}

// ============ 1. AUTHENTICATION TESTS ============
async function testAuthFlow() {
    log('\n🔐 AUTHENTICATION TESTS');

    // Test 1: Create user and verify role mapping
    const testEmail = `test_auth_${Date.now()}@test.com`;
    const userId = uuid();

    const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        email: testEmail,
        name: 'Test Auth User',
        role: 'ADMIN',
        password: 'test123',
        updatedAt: now()
    });

    if (insertError) {
        results.push({ category: 'Auth', test: 'Create user', passed: false, details: insertError.message });
        return;
    }

    results.push({ category: 'Auth', test: 'Create user', passed: true });

    // Test 2: Verify role is correctly stored and retrieved
    const { data: userData } = await supabase.from('users').select('role').eq('id', userId).single();
    const roleCorrect = userData?.role === 'ADMIN';
    results.push({
        category: 'Auth',
        test: 'Role storage matches',
        passed: roleCorrect,
        details: roleCorrect ? undefined : `Expected ADMIN, got ${userData?.role}`
    });

    // Cleanup
    await supabase.from('users').delete().eq('id', userId);
}

// ============ 2. DATA PERSISTENCE TESTS ============
async function testDataPersistence() {
    log('\n💾 DATA PERSISTENCE TESTS');

    // Test Date Format Handling
    const clientId = uuid();
    const testBirthday = '1990-06-15';

    const { error: clientError } = await supabase.from('clients').insert({
        id: clientId,
        name: 'Date Test',
        company: 'Date Corp',
        email: `date_${Date.now()}@test.com`,
        phone: '0',
        status: 'ACTIVE',
        birthday: testBirthday,
        monthlyValue: 0,
        setupValue: 0,
        totalValue: 0,
        monthsActive: 0,
        updatedAt: now()
    });

    if (clientError) {
        results.push({ category: 'Data', test: 'Birthday date format', passed: false, details: clientError.message });
    } else {
        const { data: loadedClient } = await supabase.from('clients').select('birthday').eq('id', clientId).single();
        const dateNormalized = loadedClient?.birthday?.split('T')[0] === testBirthday;
        results.push({
            category: 'Data',
            test: 'Birthday date format',
            passed: dateNormalized,
            details: dateNormalized ? undefined : `Expected ${testBirthday}, got ${loadedClient?.birthday}`
        });
        await supabase.from('clients').delete().eq('id', clientId);
    }

    // Test Decimal Precision
    const txId = uuid();
    const testAmount = 1234.56;

    const { error: txError } = await supabase.from('transactions').insert({
        id: txId,
        description: 'Decimal Test',
        amount: testAmount,
        type: 'INCOME',
        date: new Date().toISOString().split('T')[0],
        status: 'COMPLETED',
        updatedAt: now()
    });

    if (txError) {
        results.push({ category: 'Data', test: 'Decimal precision', passed: false, details: txError.message });
    } else {
        const { data: tx } = await supabase.from('transactions').select('amount').eq('id', txId).single();
        const decimalCorrect = Math.abs(Number(tx?.amount) - testAmount) < 0.01;
        results.push({
            category: 'Data',
            test: 'Decimal precision',
            passed: decimalCorrect,
            details: decimalCorrect ? undefined : `Expected ${testAmount}, got ${tx?.amount}`
        });
        await supabase.from('transactions').delete().eq('id', txId);
    }

    // Test Boolean Handling
    const bankId = uuid();

    const { error: bankError } = await supabase.from('bank_accounts').insert({
        id: bankId,
        name: 'Bool Test',
        type: 'Checking',
        balance: 0,
        color: '#000',
        isDefault: true,
        archived: false,
        updatedAt: now()
    });

    if (bankError) {
        results.push({ category: 'Data', test: 'Boolean handling', passed: false, details: bankError.message });
    } else {
        const { data: bank } = await supabase.from('bank_accounts').select('isDefault, archived').eq('id', bankId).single();
        const boolCorrect = bank?.isDefault === true && bank?.archived === false;
        results.push({
            category: 'Data',
            test: 'Boolean handling',
            passed: boolCorrect,
            details: boolCorrect ? undefined : `Expected true/false, got ${bank?.isDefault}/${bank?.archived}`
        });
        await supabase.from('bank_accounts').delete().eq('id', bankId);
    }

    // Test JSON Fields
    const { data: existingSettings } = await supabase.from('app_settings').select('id').limit(1);
    if (existingSettings && existingSettings.length > 0) {
        const settingsId = existingSettings[0].id;
        const testCompany = { name: 'JSON Test Corp', cnpj: '00.000.000/0001-00' };

        await supabase.from('app_settings').update({ company: testCompany, updatedAt: now() }).eq('id', settingsId);

        const { data: loaded } = await supabase.from('app_settings').select('company').eq('id', settingsId).single();
        const jsonCorrect = loaded?.company?.name === testCompany.name;
        results.push({
            category: 'Data',
            test: 'JSON field storage',
            passed: jsonCorrect,
            details: jsonCorrect ? undefined : `Expected ${testCompany.name}, got ${loaded?.company?.name}`
        });
    } else {
        results.push({ category: 'Data', test: 'JSON field storage', passed: false, details: 'No settings record found' });
    }
}

// ============ 3. EDGE CASE TESTS ============
async function testEdgeCases() {
    log('\n⚠️ EDGE CASE TESTS');

    // Test Empty String vs Null
    const clientId = uuid();

    const { error: emptyError } = await supabase.from('clients').insert({
        id: clientId,
        name: 'Edge Test',
        company: '',
        email: `edge_${Date.now()}@test.com`,
        phone: '0',
        status: 'ACTIVE',
        origin: null,
        monthlyValue: 0,
        setupValue: 0,
        totalValue: 0,
        monthsActive: 0,
        updatedAt: now()
    });

    if (emptyError) {
        results.push({ category: 'Edge', test: 'Empty string vs null', passed: false, details: emptyError.message });
    } else {
        const { data: client } = await supabase.from('clients').select('company, origin').eq('id', clientId).single();
        const emptyVsNull = client?.company === '' && client?.origin === null;
        results.push({
            category: 'Edge',
            test: 'Empty string vs null distinction',
            passed: emptyVsNull,
            details: emptyVsNull ? undefined : `company: "${client?.company}", origin: ${client?.origin}`
        });
        await supabase.from('clients').delete().eq('id', clientId);
    }

    // Test Zero Values
    const txId = uuid();

    const { error: zeroError } = await supabase.from('transactions').insert({
        id: txId,
        description: 'Zero Test',
        amount: 0,
        type: 'INCOME',
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        updatedAt: now()
    });

    if (zeroError) {
        results.push({ category: 'Edge', test: 'Zero value handling', passed: false, details: zeroError.message });
    } else {
        const { data: tx } = await supabase.from('transactions').select('amount').eq('id', txId).single();
        const zeroCorrect = Number(tx?.amount) === 0;
        results.push({
            category: 'Edge',
            test: 'Zero value handling',
            passed: zeroCorrect,
            details: zeroCorrect ? undefined : `Expected 0, got ${tx?.amount}`
        });
        await supabase.from('transactions').delete().eq('id', txId);
    }

    // Test Special Characters
    const specialName = "Test O'Brien & Sons (Pty) Ltd.";
    const client2Id = uuid();

    const { error: specError } = await supabase.from('clients').insert({
        id: client2Id,
        name: specialName,
        company: 'Normal',
        email: `special_${Date.now()}@test.com`,
        phone: '0',
        status: 'ACTIVE',
        monthlyValue: 0,
        setupValue: 0,
        totalValue: 0,
        monthsActive: 0,
        updatedAt: now()
    });

    if (specError) {
        results.push({ category: 'Edge', test: 'Special characters', passed: false, details: specError.message });
    } else {
        const { data: specClient } = await supabase.from('clients').select('name').eq('id', client2Id).single();
        const specialCorrect = specClient?.name === specialName;
        results.push({
            category: 'Edge',
            test: 'Special characters in text',
            passed: specialCorrect,
            details: specialCorrect ? undefined : `Expected "${specialName}", got "${specClient?.name}"`
        });
        await supabase.from('clients').delete().eq('id', client2Id);
    }

    // Test Very Long Text
    const longText = 'A'.repeat(255);
    const client3Id = uuid();

    const { error: longError } = await supabase.from('clients').insert({
        id: client3Id,
        name: longText,
        company: 'Long Test',
        email: `long_${Date.now()}@test.com`,
        phone: '0',
        status: 'ACTIVE',
        monthlyValue: 0,
        setupValue: 0,
        totalValue: 0,
        monthsActive: 0,
        updatedAt: now()
    });

    const longPassed = !longError;
    results.push({
        category: 'Edge',
        test: 'Long text handling (255 chars)',
        passed: longPassed,
        details: longPassed ? undefined : longError?.message
    });

    await supabase.from('clients').delete().eq('id', client3Id);
}

// ============ 4. RLS POLICY TESTS ============
async function testRLSPolicies() {
    log('\n🔒 RLS POLICY TESTS');

    const tables = [
        { name: 'clients', data: { id: uuid(), name: 'RLS Test', company: 'Test', email: `rls_${Date.now()}@test.com`, phone: '0', status: 'ACTIVE', monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0, updatedAt: now() } },
        { name: 'transactions', data: { id: uuid(), description: 'RLS Test', amount: 100, type: 'INCOME', date: new Date().toISOString().split('T')[0], status: 'PENDING', updatedAt: now() } },
        { name: 'calendar_events', data: { id: uuid(), title: 'RLS Test', type: 'MEETING', startTime: '09:00', endTime: '10:00', date: new Date().toISOString().split('T')[0], updatedAt: now() } },
        { name: 'bank_accounts', data: { id: uuid(), name: 'RLS Test', type: 'Checking', balance: 0, color: '#000', updatedAt: now() } },
        { name: 'goals', data: { id: uuid(), type: 'revenue', title: 'RLS Test', targetValue: 100, currentValue: 0, period: 'monthly', startDate: '2026-01-01', endDate: '2026-12-31', assignedTo: [], updatedAt: now() } },
        { name: 'services', data: { id: uuid(), name: 'RLS Test', price: 100, cost: 50, type: 'One-Time', active: true, updatedAt: now() } },
    ];

    for (const table of tables) {
        const { error: insertError } = await supabase.from(table.name).insert(table.data);
        const passed = !insertError;
        results.push({
            category: 'RLS',
            test: `INSERT ${table.name}`,
            passed,
            details: passed ? undefined : insertError?.message
        });

        await supabase.from(table.name).delete().eq('id', (table.data as any).id);
    }
}

// ============ 5. REQUIRED FIELD TESTS ============
async function testRequiredFields() {
    log('\n📋 REQUIRED FIELD TESTS');

    // Test that required fields reject null/missing values
    const { error: noNameError } = await supabase.from('clients').insert({
        id: uuid(),
        // name is missing
        company: 'Test',
        email: `req_${Date.now()}@test.com`,
        phone: '0',
        status: 'ACTIVE',
        monthlyValue: 0,
        setupValue: 0,
        totalValue: 0,
        monthsActive: 0,
        updatedAt: now()
    });

    results.push({
        category: 'Required',
        test: 'Client requires name',
        passed: !!noNameError,
        details: noNameError ? 'Correctly rejected' : 'Should have rejected missing name'
    });

    // Test default values
    const bankId = uuid();
    const { error: bankError } = await supabase.from('bank_accounts').insert({
        id: bankId,
        name: 'Default Test',
        type: 'Checking',
        balance: 0,
        color: '#000',
        updatedAt: now()
        // isDefault, archived should default
    });

    if (!bankError) {
        const { data: bank } = await supabase.from('bank_accounts').select('isDefault, archived, isActive').eq('id', bankId).single();
        const defaultsWork = bank?.isDefault === false && bank?.archived === false && bank?.isActive === true;
        results.push({
            category: 'Required',
            test: 'Default values applied',
            passed: defaultsWork,
            details: defaultsWork ? undefined : `isDefault: ${bank?.isDefault}, archived: ${bank?.archived}, isActive: ${bank?.isActive}`
        });
        await supabase.from('bank_accounts').delete().eq('id', bankId);
    } else {
        results.push({ category: 'Required', test: 'Default values applied', passed: false, details: bankError.message });
    }
}

// ============ 6. FOREIGN KEY TESTS ============
async function testForeignKeys() {
    log('\n🔗 FOREIGN KEY TESTS');

    // Test cascade delete
    const clientId = uuid();
    await supabase.from('clients').insert({
        id: clientId,
        name: 'FK Test',
        company: 'FK Corp',
        email: `fk_${Date.now()}@test.com`,
        phone: '0',
        status: 'ACTIVE',
        monthlyValue: 0,
        setupValue: 0,
        totalValue: 0,
        monthsActive: 0,
        updatedAt: now()
    });

    const contractId = uuid();
    await supabase.from('contracts').insert({
        id: contractId,
        clientId: clientId,
        title: 'FK Contract',
        monthlyValue: 1000,
        setupValue: 500,
        contractDuration: 12,
        startDate: new Date().toISOString(),
        status: 'ACTIVE',
        updatedAt: now()
    });

    // Delete client - contract should be cascade deleted
    await supabase.from('clients').delete().eq('id', clientId);

    const { data: orphanContract } = await supabase.from('contracts').select('id').eq('id', contractId).maybeSingle();
    results.push({
        category: 'FK',
        test: 'Cascade delete (client->contract)',
        passed: orphanContract === null,
        details: orphanContract ? 'Contract was not cascade deleted' : undefined
    });

    // Test FK constraint violation
    const { error: fkError } = await supabase.from('contracts').insert({
        id: uuid(),
        clientId: 'non-existent-client-id',
        title: 'Invalid FK',
        monthlyValue: 100,
        setupValue: 50,
        contractDuration: 6,
        startDate: new Date().toISOString(),
        status: 'ACTIVE',
        updatedAt: now()
    });

    results.push({
        category: 'FK',
        test: 'FK constraint enforced',
        passed: !!fkError,
        details: fkError ? 'Correctly rejected' : 'Should have rejected invalid FK'
    });
}

// ============ RUN ALL TESTS ============
async function runAudit() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║         COMPREHENSIVE SYSTEM AUDIT (FIXED)                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    await testAuthFlow();
    await testDataPersistence();
    await testEdgeCases();
    await testRLSPolicies();
    await testRequiredFields();
    await testForeignKeys();

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      AUDIT SUMMARY                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    // Group by category
    const categories = [...new Set(results.map(r => r.category))];
    console.log('\n📊 BY CATEGORY:');
    for (const cat of categories) {
        const catResults = results.filter(r => r.category === cat);
        const catPassed = catResults.filter(r => r.passed).length;
        const status = catPassed === catResults.length ? '✅' : catPassed > 0 ? '⚠️' : '❌';
        console.log(`   ${status} ${cat}: ${catPassed}/${catResults.length} passed`);
    }

    if (failed > 0) {
        console.log('\n❌ FAILED TESTS:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   [${r.category}] ${r.test}: ${r.details || 'No details'}`);
        });
    }
}

runAudit().catch(console.error);
