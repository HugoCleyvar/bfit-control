import { supabase } from './supabase';
import type { Profile } from '../../domain/types';

export async function loginWithEmail(email: string, password: string): Promise<{ user: Profile | null; error: string | null }> {
    try {
        console.log('authService: Starting login...');
        const startTime = Date.now();

        // 1. Auth with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

        console.log(`authService: signInWithPassword took ${Date.now() - startTime}ms`);

        if (authError) return { user: null, error: authError.message };
        if (!authData?.session) return { user: null, error: 'No se pudo iniciar sesión' };

        console.log('authService: Fetching profile for user:', authData.user.id);

        // 2. Fetch Profile with retry logic (handles network latency and race conditions)
        const profileStartTime = Date.now();
        let profileData: Profile | null = null;
        let lastError: string | null = null;

        // Try up to 3 times with short delays (handles slow profile creation triggers)
        for (let attempt = 1; attempt <= 3; attempt++) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (!error && data) {
                profileData = data as Profile;
                break;
            }

            lastError = error?.message || 'Perfil no encontrado';
            console.log(`authService: Profile fetch attempt ${attempt} failed:`, lastError);

            // Wait 200ms before retry (except on last attempt)
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log(`authService: Profile fetch took ${Date.now() - profileStartTime}ms`);

        if (!profileData) {
            console.error('authService: Profile not found after retries');
            return { user: null, error: 'Perfil de usuario no encontrado. ' + (lastError || 'Intenta nuevamente.') };
        }

        console.log(`authService: Login successful in ${Date.now() - startTime}ms total`);
        return { user: profileData, error: null };
    } catch (e: unknown) {
        console.error('authService: Unexpected error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Error inesperado';
        return { user: null, error: errorMessage };
    }
}

export async function logout(): Promise<void> {
    await supabase.auth.signOut();
}

import { createClient } from '@supabase/supabase-js';

// Admin helper to create users without logging out the admin
export async function createCollaborator(email: string, password: string, nombre: string): Promise<{ success: boolean; error?: string }> {
    const soupUrl = import.meta.env.VITE_SUPABASE_URL;
    const soupKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!soupUrl || !soupKey) return { success: false, error: 'Configuración faltante' };

    // Create a temporary client not to affect global auth state (for signUp only)
    const tempClient = createClient(soupUrl, soupKey, {
        auth: {
            persistSession: false, // Critical: Don't overwrite admin session
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    const { data, error } = await tempClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                nombre: nombre,
                role: 'colaborador',
                rol: 'colaborador'
            }
        }
    });

    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: 'No se pudo crear el usuario' };

    // Use the MAIN supabase client (with admin session) to insert the profile
    // The tempClient has no session so RLS blocks its inserts
    const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email: email,
        nombre: nombre,
        rol: 'colaborador',
        role: 'colaborador',
        activo: true,
        is_active: true
    });

    if (profileError) {
        // If duplicate key, trigger already created it - that's fine
        if (!profileError.message.includes('duplicate')) {
            console.error('Profile creation failed:', profileError);
            return { success: false, error: 'Usuario creado pero perfil no se pudo guardar. Contacta al administrador.' };
        }
    }

    console.log('Collaborator created successfully:', email);
    return { success: true };
}
