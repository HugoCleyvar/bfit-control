
import { createClient } from '@supabase/supabase-js';

// Manual Env Setup since we run with tsx directly
const supabaseUrl = 'https://bpsbwwnxonesjtsmuzjb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwc2J3d254b25lc2p0c211empiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjg0NjksImV4cCI6MjA4NTQwNDQ2OX0.TB0fvfn2FDr9-OPPWWr9kVfFTUEMC4LEtnrUcWuPe-o';

// Polyfill global import for env vars
(global as any).import = { meta: { env: { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: supabaseKey } } };
process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_ANON_KEY = supabaseKey;

async function runTest() {
    // Dynamic import to allow polyfill if we had one, but we are changing the source code instead.
    const { registerCheckIn } = await import('./src/logic/api/attendanceService');
    const { supabase } = await import('./src/logic/api/supabase');

    const USER_ID = '80c3122f-9e4e-43c1-a258-0d88a0f52805';

    console.log("0. Authenticating as New Test User...");
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `bfit_test_${Date.now()}@gmail.com`,
        password: 'password123'
    });

    if (authError) {
        console.error("Auth Register Failed:", authError);
        // Fallback: Try sign in if it says user already exists?
        // But we used a unique email.
        return;
    }
    console.log("   Auth Success as:", authData.user?.email);

    const sb = supabase;
    console.log("1. Setting up Test State for User:", USER_ID);

    // 1. Manually set tickets to 0 and Last Visit to TODAY
    const today = new Date().toISOString();
    await sb.from('members').update({
        visitas_disponibles: 0,
        ultima_visita: today
    }).eq('id', USER_ID);

    console.log("   - Tickets set to 0");
    console.log("   - Last Check-in set to NOW (Same Day)");

    // 3. ATTEMPT CHECK IN
    console.log("\n2. Executing registerCheckIn()...");
    const result = await registerCheckIn(USER_ID);

    console.log("\n3. Result:");
    console.log("   Success:", result.success);
    console.log("   Message:", result.message);

    if (result.success && result.message.includes('Reingreso')) {
        console.log("\n✅ TEST PASSED: Access granted as RE-ENTRY with 0 tickets.");
    } else {
        console.error("\n❌ TEST FAILED: Verification failed.");
    }
}

runTest().catch(console.error);
