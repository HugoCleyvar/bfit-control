import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './api/supabase';
import { useAuth } from './authContext';
import type { Shift, CashCount } from '../domain/types';

interface ShiftContextType {
    currentShift: Shift | null;
    isLoadingShift: boolean;
    openShift: (initialAmount: number, breakdown?: CashCount, inventarioApertura?: Record<string, any>) => Promise<{ success: boolean; error?: unknown }>;
    closeShift: (cashCount: CashCount, totalDeclared: number, nextFundCashCount?: CashCount, nextFundTotal?: number, inventarioCierre?: Record<string, any>) => Promise<{ success: boolean; difference?: number; error?: unknown }>;
    refreshShift: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [isLoadingShift, setIsLoadingShift] = useState(false);

    const fetchOpenShift = useCallback(async () => {
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
                .order('hora_inicio', { ascending: false })
                .limit(1);

            if (error) throw error;
            setCurrentShift(data && data.length > 0 ? (data[0] as Shift) : null);
        } catch (err) {
            console.error('Error fetching shift:', err);
        } finally {
            setIsLoadingShift(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        fetchOpenShift();
    }, [fetchOpenShift]);

    const openShift = async (initialAmount: number, breakdown?: CashCount, inventarioApertura?: Record<string, any>) => {
        if (!user) return { success: false, error: 'No user authenticated' };

        try {
            const payload: any = {
                colaborador_id: user.id,
                monto_inicial: initialAmount,
                desglose_apertura: breakdown,
                hora_inicio: new Date().toISOString(),
                estatus: 'abierto',
                horario: new Date().getHours() < 14 ? 'matutino' : 'vespertino',
                total_efectivo: initialAmount,
                retiros: 0
            };

            if (inventarioApertura && Object.keys(inventarioApertura).length > 0) {
                payload.inventario_apertura = inventarioApertura;
            }

            let { data, error } = await supabase
                .from('shifts')
                .insert(payload)
                .select()
                .single();

            // Graceful fallback if database column does not exist yet
            if (error && error.message && error.message.includes('inventario_apertura')) {
                console.warn('DB column inventario_apertura missing in Supabase, retrying without it...');
                delete payload.inventario_apertura;
                const retry = await supabase.from('shifts').insert(payload).select().single();
                data = retry.data;
                error = retry.error;
            }

            if (error) throw error;
            setCurrentShift(data as Shift);
            return { success: true };
        } catch (err) {
            console.error('Error opening shift:', err);
            return { success: false, error: err };
        }
    };

    const closeShift = async (
        cashCount: CashCount,
        totalDeclared: number,
        nextFundCashCount?: CashCount,
        nextFundTotal?: number,
        inventarioCierre?: Record<string, any>
    ) => {
        if (!currentShift) return { success: false, error: 'No active shift' };

        try {
            const difference = totalDeclared - (currentShift.total_efectivo || 0);

            const payload: any = {
                estatus: 'cerrado',
                hora_cierre: new Date().toISOString(),
                total_efectivo: totalDeclared,
                desglose_cierre: cashCount,
                fondo_siguiente_turno: nextFundTotal,
                desglose_fondo_siguiente: nextFundCashCount
            };

            if (inventarioCierre && Object.keys(inventarioCierre).length > 0) {
                payload.inventario_cierre = inventarioCierre;
            }

            let { error } = await supabase
                .from('shifts')
                .update(payload)
                .eq('id', currentShift.id);

            // Graceful fallback if database column does not exist yet
            if (error && error.message && error.message.includes('inventario_cierre')) {
                console.warn('DB column inventario_cierre missing in Supabase, retrying without it...');
                delete payload.inventario_cierre;
                const retry = await supabase.from('shifts').update(payload).eq('id', currentShift.id);
                error = retry.error;
            }

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
