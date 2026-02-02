import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Supabase credentials missing. Check .env');
} else {
    console.log('✅ Supabase Config Loaded');
    console.log('   URL:', supabaseUrl);
    console.log('   KEY:', supabaseKey ? '******' + supabaseKey.slice(-4) : 'MISSING');
}

// ... (existing code)

export const isConfigured = supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder');

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
