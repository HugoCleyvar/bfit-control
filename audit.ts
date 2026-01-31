
// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load Env Vars Manually
console.log('--- 🔍 STARTING SYSTEM AUDIT ---');
const envPath = path.resolve(process.cwd(), '.env');
let SUPABASE_URL = '';
let SUPABASE_KEY = '';

try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            if (key.trim() === 'VITE_SUPABASE_URL') SUPABASE_URL = value.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY') SUPABASE_KEY = value.trim();
        }
    });
    console.log('✅ Environment Loaded');
    console.log(`   URL: ${SUPABASE_URL}`);
    console.log(`   KEY: ${SUPABASE_KEY ? '******' + SUPABASE_KEY.slice(-4) : 'MISSING'}`);
} catch (e) {
    console.error('❌ Failed to load .env file');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runAudit() {
    // 2. Test Connection
    console.log('\n--- 📡 TESTING CONNECTION ---');
    const { error: healthError } = await supabase.from('profiles').select('count').limit(1);
    // Note: This might fail RLS if anon, but checks connection.
    if (healthError && healthError.code !== 'PGRST116' && healthError.message !== 'JSON object requested, multiple (or no) rows returned') {
        // It's okay if it fails RLS, as long as it reachable.
        // Actually, let's assume it works if we get ANY response, even 401.
        console.log('   Connection Status:', healthError.message);
    } else {
        console.log('✅ Connection Successful (Public Access)');
    }

    // 3. Test Authentication
    console.log('\n--- 🔐 TESTING LOGIN (REDACTED_EMAIL) ---');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'REDACTED_EMAIL',
        password: 'REDACTED_PASSWORD'
    });

    if (authError) {
        console.error('❌ Login FAILED:', authError.message);
        process.exit(1);
    } else {
        console.log('✅ Login SUCCESS');
        console.log('   User ID:', authData.user.id);
    }

    // 4. Test Profile Access (Role Check)
    console.log('\n--- 👤 TESTING PROFILE ACCESS ---');
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileError) {
        console.error('❌ Profile Fetch FAILED:', profileError.message);
    } else {
        console.log('✅ Profile Found');
        console.log('   Role:', profile.rol);
        if (profile.rol === 'admin') {
            console.log('   Start Access: GRANTED');
        } else {
            console.warn('   ⚠️ Role is NOT admin. Access might be limited.');
        }
    }

    // 5. Test Data Access (RLS)
    console.log('\n--- 📂 TESTING DATA ACCESS (RLS) ---');

    // Members
    const { count: memberCount, error: memberError } = await supabase.from('members').select('*', { count: 'exact', head: true });
    if (memberError) console.error('❌ Members Read: FAILED', memberError.message);
    else console.log(`✅ Members Read: SUCCESS (${memberCount} records)`);

    // Plans
    const { data: plans, error: planError } = await supabase.from('plans').select('*');
    if (planError) console.error('❌ Plans Read: FAILED', planError.message);
    else console.log(`✅ Plans Read: SUCCESS (${plans.length} records)`);

    console.log('\n--- 🏁 AUDIT COMPLETE ---');
}

runAudit();
