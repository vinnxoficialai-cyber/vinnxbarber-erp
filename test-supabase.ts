// Diagnostic script to test Supabase connection
// Run with: npx tsx test-supabase.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n=== SUPABASE DIAGNOSTIC ===\n');
console.log('1. Checking environment variables...');
console.log(`   VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Found' : '❌ Missing'}`);
console.log(`   VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Found' : '❌ Missing'}`);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('\n❌ Cannot proceed without environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runDiagnostics() {
    // Test 1: Basic connection
    console.log('\n2. Testing basic Supabase connection...');
    try {
        const start = Date.now();
        const { data, error } = await supabase.from('users').select('count').limit(1);
        const elapsed = Date.now() - start;

        if (error) {
            console.log(`   ❌ Connection failed: ${error.message}`);
            console.log(`   Error code: ${error.code}`);
            console.log(`   Details: ${JSON.stringify(error.details)}`);
        } else {
            console.log(`   ✅ Connection successful (${elapsed}ms)`);
        }
    } catch (err) {
        console.log(`   ❌ Exception: ${err}`);
    }

    // Test 2: Auth service health
    console.log('\n3. Testing auth service...');
    try {
        const start = Date.now();
        const { data: { session }, error } = await supabase.auth.getSession();
        const elapsed = Date.now() - start;

        if (error) {
            console.log(`   ❌ Auth service error: ${error.message}`);
        } else {
            console.log(`   ✅ Auth service responding (${elapsed}ms)`);
            console.log(`   Current session: ${session ? 'Active' : 'None'}`);
        }
    } catch (err) {
        console.log(`   ❌ Exception: ${err}`);
    }

    // Test 3: Check if test user exists
    const testEmail = 'vinnxoficialai@gmail.com';
    console.log(`\n4. Checking if user "${testEmail}" exists in public.users...`);
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, name, role')
            .eq('email', testEmail)
            .single();

        if (error) {
            console.log(`   ⚠️  User not found in users table: ${error.message}`);
        } else {
            console.log(`   ✅ User found:`);
            console.log(`      ID: ${data.id}`);
            console.log(`      Name: ${data.name}`);
            console.log(`      Role: ${data.role}`);
        }
    } catch (err) {
        console.log(`   ❌ Exception: ${err}`);
    }

    // Test 4: Test login
    console.log('\n5. Testing login with test credentials...');
    try {
        const start = Date.now();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: 'test123456' // Placeholder - real password needed
        });
        const elapsed = Date.now() - start;

        if (error) {
            console.log(`   ⚠️  Login failed (${elapsed}ms): ${error.message}`);
            console.log(`   (This is expected if password is wrong or user doesn't exist in auth.users)`);
        } else {
            console.log(`   ✅ Login successful (${elapsed}ms)`);
            console.log(`   User ID: ${data.user?.id}`);
        }
    } catch (err) {
        console.log(`   ❌ Exception: ${err}`);
    }

    // Test 5: List all users in public.users table
    console.log('\n6. Listing all users in public.users table...');
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, name, role')
            .limit(10);

        if (error) {
            console.log(`   ❌ Query failed: ${error.message}`);
        } else if (!data || data.length === 0) {
            console.log(`   ⚠️  No users found in public.users table`);
        } else {
            console.log(`   ✅ Found ${data.length} users:`);
            data.forEach((u, i) => {
                console.log(`      ${i + 1}. ${u.email} (${u.role}) - ID: ${u.id?.substring(0, 8)}...`);
            });
        }
    } catch (err) {
        console.log(`   ❌ Exception: ${err}`);
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
}

runDiagnostics().catch(console.error);
