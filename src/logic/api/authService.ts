import { supabase } from './supabase';
import type { Profile } from '../../domain/types';

const timeoutPromise = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms));

export async function loginWithEmail(email: string, password: string): Promise<{ user: Profile | null; error: string | null }> {
    try {
        // 1. Auth with Supabase (Race with 20s timeout)
        const { data: authData, error: authError } = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            timeoutPromise(20000) as any
        ]) as any;

        if (authError) return { user: null, error: authError.message };
        if (!authData?.session) return { user: null, error: 'No se pudo iniciar sesión' };

        // 2. Fetch Profile details
        const { data: profileData, error: profileError } = await Promise.race([
            supabase.from('profiles').select('*').eq('id', authData.user.id).single(),
            timeoutPromise(5000) as any
        ]) as any;

        if (profileError || !profileData) {
            return { user: null, error: 'Perfil de usuario no encontrado.' };
        }

        return { user: profileData as Profile, error: null };
    } catch (e: any) {
        return { user: null, error: e.message || 'Error inesperado' };
    }
}

export async function logout(): Promise<void> {
    await supabase.auth.signOut();
}
