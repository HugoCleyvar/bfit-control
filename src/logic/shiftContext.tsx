import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './api/supabase';
import { useAuth } from './authContext';
import type { Shift, CashCount } from '../domain/types';

interface ShiftContextType {
    currentShift: Shift | null;
    isLoadingShift: boolean;
    openShift: (initialAmount: number) => Promise<{ success: boolean; error?: unknown }>;
    closeShift: (cashCount: CashCount, totalDeclared: number) => Promise<{ success: boolean; difference?: number; error?: unknown }>;
    refreshShift: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [isLoadingShift, setIsLoadingShift] = useState(false);

    const fetchOpenShift = useCallback(async () => {
        // Only fetch if authenticated and (strictly speaking) if user might have shifts. 
        // Admins might not *have* shifts but might want to see? 
        // Logic currently: eq('colaborador_id', user.id). So only their own shifts.
        if (!isAuthenticated || !user) {
            setCurrentShift(null);
            return;
        }

        setIsLoadingShift(true);
        try {
            const { data, error } = await supabase
                .from('shifts')
                .select('*')
                .eq('colaborador_id', user.id)
                .eq('estatus', 'abierto')
                .maybeSingle();

            if (error) throw error;
            setCurrentShift(data as Shift);
        } catch (err) {
            console.error('Error fetching shift:', err);
        } finally {
            setIsLoadingShift(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        fetchOpenShift();
    }, [fetchOpenShift]);

    const openShift = async (initialAmount: number) => {
        if (!user) return { success: false, error: 'No user' };

        try {
            const { data, error } = await supabase
                .from('shifts')
                .insert({
                    colaborador_id: user.id,
                    monto_inicial: initialAmount,
                    // 'hora_inicio' matches DB schema
                    hora_inicio: new Date().toISOString(),
                    estatus: 'abierto',
                    horario: new Date().getHours() < 14 ? 'matutino' : 'vespertino',
                    total_efectivo: 0,
                    retiros: 0
                })
                .select()
                .single();

            if (error) throw error;
            setCurrentShift(data as Shift);
            return { success: true };
        } catch (err) {
            console.error('Error opening shift:', err);
            return { success: false, error: err };
        }
    };

    const closeShift = async (cashCount: CashCount, totalDeclared: number) => {
        if (!currentShift) return { success: false, error: 'No active shift' };

        try {
            const difference = totalDeclared - currentShift.total_efectivo;

            const { error } = await supabase
                .from('shifts')
                .update({
                    estatus: 'cerrado',
                    hora_cierre: new Date().toISOString(),
                    total_efectivo: totalDeclared,
                    desglose_cierre: cashCount // Store breakdown
                })
                .eq('id', currentShift.id);

            if (error) throw error;
            setCurrentShift(null);
            return { success: true, difference };
        } catch (err) {
            console.error('Error closing shift:', err);
            return { success: false, error: err };
        }
    };

    return (
        <ShiftContext.Provider value={{
            currentShift,
            isLoadingShift,
            openShift,
            closeShift,
            refreshShift: fetchOpenShift
        }}>
            {children}
        </ShiftContext.Provider>
    );
}

export function useShift() {
    const context = useContext(ShiftContext);
    if (context === undefined) {
        throw new Error('useShift must be used within a ShiftProvider');
    }
    return context;
}
