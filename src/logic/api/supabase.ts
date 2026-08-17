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

// Supabase/PostgREST caps any unranged .select() at a server-configured row limit
// (1000 by default). Report aggregates need every row, so this pages through with
// .range() until an empty page comes back, instead of trusting a single request.
export async function fetchAllRows<T>(
    build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
    const pageSize = 1000;
    let offset = 0;
    const rows: T[] = [];

    while (true) {
        const { data, error } = await build(offset, offset + pageSize - 1);
        if (error) {
            console.error('Error paginating rows:', error);
            break;
        }
        if (!data || data.length === 0) break;

        rows.push(...data);
        offset += data.length;
    }

    return rows;
}
