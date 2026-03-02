// Comprehensive table check
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

// All tables from schema.prisma
const tablesToCheck = [
    'users',
    'team_members',
    'clients',
    'contracts',
    'projects',
    'tasks',
    'transactions',
    'calendar_events',
    'vacations',
    'time_entries',
    'evaluations',
    'service_credentials',
    'goals',
    'bank_accounts',
    'budgets',
    'commissions',
    'withdrawals',
    'pipeline_stages',
    'client_interactions',
    'app_settings',
    'role_permissions',
    'system_notifications',
    'personal_tasks',
];

async function checkAllTables() {
    console.log('\n=== DATABASE TABLE CHECK ===\n');

    const results: { table: string; status: string }[] = [];

    for (const table of tablesToCheck) {
        try {
            const { error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                results.push({ table, status: `❌ ERROR: ${error.message}` });
            } else {
                results.push({ table, status: '✅ OK' });
            }
        } catch (err) {
            results.push({ table, status: `❌ EXCEPTION: ${err}` });
        }
    }

    // Print results
    const okTables = results.filter(r => r.status.includes('OK'));
    const errorTables = results.filter(r => !r.status.includes('OK'));

    console.log('=== TABLES OK ===');
    okTables.forEach(r => console.log(`  ${r.table}: ${r.status}`));

    console.log('\n=== TABLES WITH ERRORS ===');
    if (errorTables.length === 0) {
        console.log('  None! All tables are accessible.');
    } else {
        errorTables.forEach(r => console.log(`  ${r.table}: ${r.status}`));
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`  OK: ${okTables.length}/${tablesToCheck.length}`);
    console.log(`  ERRORS: ${errorTables.length}/${tablesToCheck.length}`);

    // Return missing tables for script use
    return errorTables.map(r => r.table);
}

checkAllTables().then(missing => {
    if (missing.length > 0) {
        console.log('\n=== ACTION REQUIRED ===');
        console.log('The following tables need to be created in Supabase:');
        missing.forEach(t => console.log(`  - ${t}`));
        console.log('\nRun: npx prisma db push');
    }
}).catch(console.error);
