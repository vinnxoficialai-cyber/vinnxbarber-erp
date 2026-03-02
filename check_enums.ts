import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
    // Try to get a user to see the role, or just list types if possible via RPC (unlikely)
    // We will try an insert with a wrong value to get the list of allowed values from the error message
    const { error } = await supabase.from('users').insert({
        email: 'temp@test.com',
        role: 'SUPPORT' // Trying SUPPORT
    });
    if (error) console.log(error.message);
}
check();
