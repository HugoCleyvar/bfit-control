import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Profile } from '../domain/types';
import { loginWithEmail, logout as apiLogout } from './api/authService';

export interface AuthContextType {
    user: Profile | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<string | null>;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isCollaborator: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { supabase } from './api/supabase';

// ... (imports)

// Profile cache to avoid redundant fetches during login
let cachedProfile: Profile | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initialize Session - optimized for speed
        const initAuth = async () => {
            const startTime = Date.now();
            try {
                const { data: { session } } = await supabase.auth.getSession();
                console.log(`Auth: getSession took ${Date.now() - startTime}ms`);

                if (session?.user) {
                    // Use cached profile if available (from recent login)
                    if (cachedProfile && cachedProfile.id === session.user.id) {
                        console.log('Auth: Using cached profile');
                        setUser(cachedProfile);
                        setIsLoading(false);
                        return;
                    }

                    const profileStart = Date.now();
                    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                    console.log(`Auth: Profile fetch took ${Date.now() - profileStart}ms`);

                    if (data) {
                        cachedProfile = data;
                        setUser(data);
                    }
                }
            } catch (error) {
                console.error('Auth Init Error:', error);
            } finally {
                console.log(`Auth: Total init took ${Date.now() - startTime}ms`);
                setIsLoading(false);
            }
        };

        initAuth();

        // Reduced timeout (3s instead of 5s) - if Supabase doesn't respond, let user try
        const timeout = setTimeout(() => {
            setIsLoading((prev) => {
                if (prev) console.warn('Auth timeout - Forcing app load');
                return false;
            });
        }, 3000);

        // Listen for changes (logout only - login is handled by login function)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Only handle signout events here - login is handled in login() function
            if (event === 'SIGNED_OUT' || !session) {
                cachedProfile = null;
                setUser(null);
                setIsLoading(false);
            }
            // For TOKEN_REFRESHED or other events, don't re-fetch profile (already have it)
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
            // Cache the profile to avoid re-fetch on page reload
            cachedProfile = profile;
            setUser(profile);
            setIsLoading(false);
        }

        return null;
    };

    const logout = () => {
        apiLogout();
    };


    const isAdmin = user?.rol === 'admin';
    const isCollaborator = user?.rol === 'colaborador';

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            login,
            logout,
            isAuthenticated: !!user,
            isAdmin,
            isCollaborator
        }}>
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
