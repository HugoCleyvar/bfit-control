import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Profile } from '../domain/types';
import { loginWithEmail, logout as apiLogout } from './api/authService';

interface AuthContextType {
    user: Profile | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<string | null>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { supabase } from './api/supabase';

// ... (imports)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initialize Session
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                    setUser(data);
                }
            } catch (error) {
                console.error('Auth Init Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        // Safety timeout in case Supabase hangs
        const timeout = setTimeout(() => {
            setIsLoading((prev) => {
                if (prev) console.warn('Auth timeout - Forcing app load');
                return false;
            });
        }, 5000);

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setUser(data);
            } else {
                setUser(null);
            }
            setIsLoading(false);
        });

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        const { user: profile, error } = await loginWithEmail(email, password);

        if (error) {
            setIsLoading(false);
            return error;
        }

        if (profile) {
            setUser(profile);
            // We set loading false here so the UI can proceed immediately
            // The onAuthStateChange might fire later, which is fine (it will just set the same user)
            setIsLoading(false);
        }

        return null;
    };

    const logout = () => {
        apiLogout(); // Triggers onAuthStateChange(SIGNED_OUT) -> sets user null
    };

    // ... return


    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
