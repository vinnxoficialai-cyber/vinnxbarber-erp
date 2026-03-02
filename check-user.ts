// Quick diagnostic for specific user
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

const testEmail = 'vinicius@vinnx.com.br';

async function check() {
    console.log(`\nChecking user: ${testEmail}\n`);

    // Check public.users
    console.log('1. Checking public.users table...');
    const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('email', testEmail)
        .single();

    if (publicError) {
        console.log(`   ❌ NOT in public.users: ${publicError.message}`);
    } else {
        console.log(`   ✅ Found in public.users:`);
        console.log(`      ID: ${publicUser.id}`);
        console.log(`      Name: ${publicUser.name}`);
        console.log(`      Role: ${publicUser.role}`);
    }

    // Test login (will fail if not in auth.users)
    console.log('\n2. Testing login (will fail if not in auth.users)...');
    const start = Date.now();
    const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'test123' // Placeholder
    });
    const elapsed = Date.now() - start;

    if (error) {
        console.log(`   ⚠️  Login test failed (${elapsed}ms): ${error.message}`);
        if (error.message.includes('Invalid login credentials')) {
            console.log(`   → Isso significa: usuário NÃO existe em auth.users OU senha errada`);
        }
    } else {
        console.log(`   ✅ Login OK (${elapsed}ms) - User ID: ${data.user?.id}`);
    }

    // List all users
    console.log('\n3. All users in public.users:');
    const { data: allUsers } = await supabase.from('users').select('email, id');
    allUsers?.forEach((u, i) => console.log(`   ${i + 1}. ${u.email} (${u.id?.substring(0, 8)}...)`));
}

check().catch(console.error);
