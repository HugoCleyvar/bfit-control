import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './api/supabase';
import { useAuth } from './authContext';
import type { Shift, CashCount } from '../domain/types';

interface ShiftContextType {
    currentShift: Shift | null;
    isLoadingShift: boolean;
    // True for admin/entrenador: they own a shift's opening/closing and cash cutoff.
    // A recepcionista supports an entrenador's shift but never opens/closes it herself.
    canManageShift: boolean;
    // Open shifts a recepcionista can attach to (empty/unused for admin/entrenador),
    // each carrying colaborador_nombre so the picker can show whose shift it is.
    openableShifts: Shift[];
    joinShift: (shiftId: string) => void;
    leaveShift: () => void;
    openShift: (initialAmount: number, breakdown?: CashCount, inventarioApertura?: Record<string, any>) => Promise<{ success: boolean; error?: unknown }>;
    closeShift: (cashCount: CashCount, totalDeclared: number, nextFundCashCount?: CashCount, nextFundTotal?: number, inventarioCierre?: Record<string, any>) => Promise<{ success: boolean; difference?: number; error?: unknown }>;
    refreshShift: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

// Per-device memory of which shift a recepcionista attached to, so a page refresh doesn't
// drop her back into "pick a shift" - keyed by user id since a device may be shared.
function recepcionistaShiftKey(userId: string) {
    return `bfit_turno_recepcionista_${userId}`;
}

export function ShiftProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isAdmin, isEntrenador } = useAuth();
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [openableShifts, setOpenableShifts] = useState<Shift[]>([]);
    const [isLoadingShift, setIsLoadingShift] = useState(false);

    const canManageShift = isAdmin || isEntrenador;

    const fetchOpenShift = useCallback(async () => {
        if (!isAuthenticated || !user) {
            setCurrentShift(null);
            setOpenableShifts([]);
            return;
        }

        setIsLoadingShift(true);
        try {
            if (user.rol === 'recepcionista') {
                // She doesn't own a shift - she attaches to whichever entrenador has one open.
                const { data, error } = await supabase
                    .from('shifts')
                    .select('*, profiles(nombre)')
                    .eq('estatus', 'abierto')
                    .order('hora_inicio', { ascending: false });

                if (error) throw error;
                const rows = data as (Shift & { profiles?: { nombre: string } | null })[] | null;
                const shifts: Shift[] = (rows || []).map((row) => ({
                    ...row,
                    colaborador_nombre: row.profiles?.nombre
                }));
                setOpenableShifts(shifts);

                const storageKey = recepcionistaShiftKey(user.id);
                let savedId: string | null = null;
                try { savedId = localStorage.getItem(storageKey); } catch { /* private mode / blocked storage */ }

                const saved = savedId ? shifts.find(s => s.id === savedId) : undefined;
                if (saved) {
                    setCurrentShift(saved);
                } else if (shifts.length === 1) {
                    // Only one shift open right now - nothing to choose, attach automatically.
                    setCurrentShift(shifts[0]);
                    try { localStorage.setItem(storageKey, shifts[0].id); } catch { /* ignore */ }
                } else {
                    setCurrentShift(null);
                    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
                }
            } else {
                setOpenableShifts([]);
                const { data, error } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('colaborador_id', user.id)
                    .eq('estatus', 'abierto')
                    .order('hora_inicio', { ascending: false })
                    .limit(1);

                if (error) throw error;
                setCurrentShift(data && data.length > 0 ? (data[0] as Shift) : null);
            }
        } catch (err) {
            console.error('Error fetching shift:', err);
        } finally {
            setIsLoadingShift(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        fetchOpenShift();
    }, [fetchOpenShift]);

    const joinShift = useCallback((shiftId: string) => {
        if (!user) return;
        const shift = openableShifts.find(s => s.id === shiftId);
        if (!shift) return;
        setCurrentShift(shift);
        try { localStorage.setItem(recepcionistaShiftKey(user.id), shiftId); } catch { /* ignore */ }
    }, [user, openableShifts]);

    const leaveShift = useCallback(() => {
        if (user) {
            try { localStorage.removeItem(recepcionistaShiftKey(user.id)); } catch { /* ignore */ }
        }
        setCurrentShift(null);
    }, [user]);

    const openShift = async (initialAmount: number, breakdown?: CashCount, inventarioApertura?: Record<string, any>) => {
        if (!user) return { success: false, error: 'No user authenticated' };
        if (!canManageShift) return { success: false, error: 'Tu rol no puede abrir turno. Únete al turno abierto de tu entrenador responsable.' };

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
        if (!canManageShift) return { success: false, error: 'Tu rol no puede cerrar turno. Pide a tu entrenador responsable que haga el corte de caja.' };

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
            canManageShift,
            openableShifts,
            joinShift,
            leaveShift,
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
