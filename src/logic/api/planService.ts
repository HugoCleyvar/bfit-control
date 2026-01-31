import { supabase } from './supabase';
import type { UUID } from '../../domain/types';

export interface Plan {
    id: UUID;
    nombre: string;
    precio: number;
    duracion_dias: number;
    activo: boolean;
}

export async function getPlans(): Promise<Plan[]> {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('precio', { ascending: true });

    if (error) {
        console.error('Error fetching plans:', error);
        return [];
    }
    return data || [];
}

export async function createPlan(plan: Omit<Plan, 'id' | 'activo'>): Promise<boolean> {
    const { error } = await supabase
        .from('plans')
        .insert({
            ...plan,
            activo: true
        });

    if (error) {
        console.error('Error creating plan:', error);
        return false;
    }
    return true;
}

export async function updatePlan(id: string, updates: Partial<Plan>): Promise<boolean> {
    const { error } = await supabase
        .from('plans')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('Error updating plan:', error);
        return false;
    }
    return true;
}

export async function togglePlanStatus(id: string, currentStatus: boolean): Promise<boolean> {
    return updatePlan(id, { activo: !currentStatus });
}
