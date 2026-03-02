import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('ATENÇÃO: As variáveis de ambiente do Supabase não foram encontradas no arquivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
