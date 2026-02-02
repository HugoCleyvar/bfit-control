
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bpsbwwnxonesjtsmuzjb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwc2J3d254b25lc2p0c211empiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjg0NjksImV4cCI6MjA4NTQwNDQ2OX0.TB0fvfn2FDr9-OPPWWr9kVfFTUEMC4LEtnrUcWuPe-o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAdmin() {
    console.log('Attempting SignUp...');

    // 1. Try to Register
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'admin_final@bfit.com',
        password: 'admin123', // Min 6 chars
    });

    let user = signUpData.user;

    if (signUpError) {
        console.log('SignUp result:', signUpError.message);
        // If user already exists, try login
        console.log('User might exist, trying login...');
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: 'admin_final@bfit.com',
            password: 'admin123'
        });

        if (loginError) {
            console.error('Login also failed:', loginError.message);
            return;
        }
        user = loginData.user;
    }

    if (!user) {
        console.error('Could not get user user.');
        return;
    }

    console.log('Auth Success! User ID:', user.id);

    // 2. Check/Create Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (profile) {
        console.log('Profile exists:', profile);
        // Ensure role is admin
        if (profile.rol !== 'admin') {
            console.log('Updating role to admin...');
            await supabase.from('profiles').update({ rol: 'admin' }).eq('id', user.id);
        }
    } else {
        console.log('Profile missing! Creating one...');
        // Note: 'email' might not be in profiles table, removing it just in case to avoid error
        const { error: insertError } = await supabase.from('profiles').insert({
            id: user.id,
            nombre: 'Admin Principal',
            rol: 'colaborador',
            activo: true
        });

        if (insertError) {
            console.error('Error creating profile:', insertError);
        } else {
            console.log('Profile created as Colaborador! Promoting to Admin...');
            const { error: updateError } = await supabase.from('profiles').update({ rol: 'admin' }).eq('id', user.id);
            if (updateError) {
                console.error('Error promoting to admin:', updateError);
            } else {
                console.log('Successfully promoted to Admin!');
            }
        }
    }
}

fixAdmin();
