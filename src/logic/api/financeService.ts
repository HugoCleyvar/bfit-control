import { supabase, fetchAllRows } from './supabase';
import type { Payment, Shift, Expense, CashCount } from '../../domain/types';
import { calculateNominalExpiration, startOfLocalDay, endOfLocalDay } from '../../domain/dateUtils';

export interface PaymentWithDetails extends Payment {
    member?: { nombre: string; apellido: string; telefono?: string };
    plan?: { nombre: string; duracion_dias: number };
}

export async function getPayments(limit = 50): Promise<PaymentWithDetails[]> {
    const { data, error } = await supabase
        .from('payments')
        .select(`
            *,
            member:members (
                nombre,
                apellido,
                telefono
            ),
            plan:plans (
                nombre,
                duracion_dias
            )
        `)
        .order('fecha_pago', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error getting payments:', error);
        return [];
    }
    return data as PaymentWithDetails[];
}

export async function getMemberPayments(memberId: string, limit = 5): Promise<PaymentWithDetails[]> {
    const { data, error } = await supabase
        .from('payments')
        .select(`
            *,
            member:members (
                nombre,
                apellido,
                telefono
            ),
            plan:plans (
                nombre,
                duracion_dias
            )
        `)
        .eq('usuario_id', memberId)
        .order('fecha_pago', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error getting member payments:', error);
        return [];
    }
    return data as PaymentWithDetails[];
}


export interface IncomeSummary {
    total: number;
    byMethod: Record<string, number>;
}

// Full historical income summary (no row limit, unlike getPayments which is paginated for lists)
export async function getIncomeSummary(): Promise<IncomeSummary> {
    const rows = await fetchAllRows<{ total: number; metodo_pago: string }>((from, to) =>
        supabase.from('payments').select('total, metodo_pago').range(from, to)
    );

    const byMethod: Record<string, number> = {};
    let total = 0;
    rows.forEach((p) => {
        total += p.total;
        byMethod[p.metodo_pago] = (byMethod[p.metodo_pago] || 0) + p.total;
    });

    return { total, byMethod };
}

export async function getTodayIncome(): Promise<number> {
    // Local-day boundary, not UTC: at this file's UTC offset, deriving "today" from
    // toISOString() rolls over hours before/after local midnight, which was silently
    // folding part of the previous evening's (or missing part of today's) payments in.
    const now = new Date();
    const { data, error } = await supabase
        .from('payments')
        .select('total')
        .gte('fecha_pago', startOfLocalDay(now).toISOString())
        .lte('fecha_pago', endOfLocalDay(now).toISOString());

    if (error || !data) return 0;

    // Sum purely on client side for now, safer execution
    return data.reduce((sum, p) => sum + p.total, 0);
}

// New Admin function to see ALL open shifts
export async function getActiveShifts(): Promise<(Shift & { profiles: { nombre: string } })[]> {
    const { data, error } = await supabase
        .from('shifts')
        .select('*, profiles(nombre)')
        .eq('estatus', 'abierto');

    if (error) {
        console.error('Error getting active shifts:', error);
        return [];
    }
    return (data || []) as (Shift & { profiles: { nombre: string } })[];
}

export interface ShiftHistoryRow extends Shift {
    profiles?: { nombre: string };
    // Theoretical cash total at close time, rebuilt from payments/expenses tied to this shift
    // (shift.total_efectivo gets overwritten with the physically counted amount on close, so it
    // can no longer be used as the "expected" side of the cash-count difference).
    total_teorico: number;
}

// New Admin function to see Shift History
export async function getShiftHistory(limit = 20): Promise<ShiftHistoryRow[]> {
    const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*, profiles(nombre)')
        .eq('estatus', 'cerrado')
        .order('hora_cierre', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error getting shift history:', error);
        return [];
    }
    if (!shifts || shifts.length === 0) return [];

    const shiftIds = shifts.map((s: { id: string }) => s.id);

    const [cashPayments, expensesData] = await Promise.all([
        fetchAllRows<{ turno_id: string; total: number }>((from, to) =>
            supabase.from('payments').select('turno_id, total').eq('metodo_pago', 'efectivo').in('turno_id', shiftIds).range(from, to)
        ),
        fetchAllRows<{ turno_id: string; monto: number }>((from, to) =>
            supabase.from('expenses').select('turno_id, monto').in('turno_id', shiftIds).range(from, to)
        )
    ]);

    const cashByShift: Record<string, number> = {};
    cashPayments.forEach((p) => {
        cashByShift[p.turno_id] = (cashByShift[p.turno_id] || 0) + p.total;
    });

    const expensesByShift: Record<string, number> = {};
    expensesData.forEach((e) => {
        expensesByShift[e.turno_id] = (expensesByShift[e.turno_id] || 0) + e.monto;
    });

    return (shifts as (Shift & { profiles?: { nombre: string } })[]).map((s) => ({
        ...s,
        total_teorico: Number(s.monto_inicial || 0) + (cashByShift[s.id] || 0) - (expensesByShift[s.id] || 0)
    }));
}

export async function getShiftExpenses(shiftId: string): Promise<Expense[]> {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('turno_id', shiftId)
        .order('fecha_hora', { ascending: false });

    if (error) return [];
    return data as Expense[];
}

export async function registerExpense(shiftId: string, amount: number, concept: string, userId: string): Promise<boolean> {
    // 1. Create Expense Record
    const { error: expError } = await supabase
        .from('expenses')
        .insert({
            turno_id: shiftId,
            monto: amount,
            concepto: concept,
            usuario_id: userId
        });

    if (expError) return false;

    // 2. Update Shift (Increase withdrawals, Decrease total cash in hand)
    const { data: shift } = await supabase.from('shifts').select('retiros, total_efectivo').eq('id', shiftId).single();

    if (!shift) return false;

    const newRetiros = (shift.retiros || 0) + amount;
    const newTotal = (shift.total_efectivo || 0) - amount;

    const { error: shiftError } = await supabase
        .from('shifts')
        .update({
            retiros: newRetiros,
            total_efectivo: newTotal
        })
        .eq('id', shiftId);

    return !shiftError;
}

export async function openShift(userId: string, initialCash: number): Promise<boolean> {
    const hour = new Date().getHours();
    const horario = hour < 14 ? 'matutino' : 'vespertino';

    const { error } = await supabase.from('shifts').insert({
        colaborador_id: userId,
        horario: horario,
        hora_inicio: new Date().toISOString(),
        total_efectivo: initialCash, // Starts with initial fund
        monto_inicial: initialCash,
        retiros: 0,
        estatus: 'abierto'
    });

    if (error) {
        console.error('Error opening shift:', error);
        return false;
    }
    return true;
}

// Lets an admin run the "Arqueo de Caja" close-out for a collaborator's shift by id, for when
// they had to leave before doing it themselves - same close as shiftContext.tsx's closeShift,
// just not tied to the logged-in user's own shift.
export async function closeShiftAsAdmin(
    shiftId: string,
    cashCount: CashCount,
    totalDeclared: number,
    nextFundCashCount: CashCount,
    nextFundTotal: number
): Promise<{ success: boolean; difference?: number; message?: string }> {
    const { data: shift, error: fetchError } = await supabase
        .from('shifts')
        .select('total_efectivo, estatus')
        .eq('id', shiftId)
        .single();

    if (fetchError || !shift) {
        return { success: false, message: 'No se encontró el turno.' };
    }
    if (shift.estatus !== 'abierto') {
        return { success: false, message: 'Este turno ya está cerrado.' };
    }

    const difference = totalDeclared - (shift.total_efectivo || 0);

    const { error } = await supabase
        .from('shifts')
        .update({
            estatus: 'cerrado',
            hora_cierre: new Date().toISOString(),
            total_efectivo: totalDeclared,
            desglose_cierre: cashCount,
            fondo_siguiente_turno: nextFundTotal,
            desglose_fondo_siguiente: nextFundCashCount
        })
        .eq('id', shiftId);

    if (error) {
        console.error('Error closing shift as admin', error);
        return { success: false, message: 'Error al cerrar el turno.' };
    }

    return { success: true, difference };
}

export async function registerPayment(payment: Omit<Payment, 'id'> & { force?: boolean }): Promise<{ success: boolean; message?: string }> {
    // 0. Double Payment Protection (5 min rule)
    if (!payment.force) {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: duplicates } = await supabase
            .from('payments')
            .select('id')
            .eq('usuario_id', payment.usuario_id)
            .eq('total', payment.total)
            .gte('fecha_pago', fiveMinsAgo);

        if (duplicates && duplicates.length > 0) {
            // Updated: Return detailed message
            return { success: false, message: 'DUPLICADO: Ya existe un pago idéntico registrado para este miembro hace menos de 5 minutos.' };
        }
    }

    // 1. Attribute to the shift the caller already resolved for this collaborator
    // (payment.turno_id, from their own open shift - see shiftContext.tsx). This used to
    // be re-derived here via getCurrentShift(), an UNFILTERED "any open shift" lookup with
    // .single(): with more than one shift open at once (e.g. a shift handoff where the
    // previous one wasn't closed yet), .single() errors on 2+ rows, so shiftId silently
    // came back undefined and the cash payment's total never made it into total_efectivo -
    // the payment itself still saved, so it wasn't visibly lost, but "En Caja (Teórico)"
    // stayed short by that amount for the shift it actually belonged to.
    const shiftId = payment.turno_id;

    // 2. Insert Payment
    // Destructure force away so it doesn't hit the DB
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { force, ...paymentData } = payment;

    const { error: insertError } = await supabase
        .from('payments')
        .insert(paymentData);

    if (insertError) {
        console.error('Error inserting payment', insertError);
        return { success: false, message: 'Error al registrar el pago en base de datos.' };
    }

    let warningMessage = '';

    // 3. Update Subscription if Plan/User present (Membership Payment)
    if (payment.usuario_id && payment.plan_id) {
        try {
            // Get Plan Duration
            const { data: plan } = await supabase.from('plans').select('nombre, duracion_dias').eq('id', payment.plan_id).single();

            if (plan) {
                // TICKET LOGIC: Check if plan is a "Pack" or "Visit"
                const normName = plan.nombre.toLowerCase();
                if (normName.includes('visita') || normName.includes('paquete')) {
                    let ticketsToAdd = 1;
                    const match = normName.match(/(\d+)\s*visita/); // Match "10 visitas", "5 visita" etc.
                    if (match) {
                        ticketsToAdd = parseInt(match[1]);
                    }

                    if (ticketsToAdd > 0) {
                        const { data: member } = await supabase.from('members').select('visitas_disponibles').eq('id', payment.usuario_id).single();
                        const newCount = (member?.visitas_disponibles || 0) + ticketsToAdd;
                        const { error: ticketError } = await supabase.from('members').update({ visitas_disponibles: newCount }).eq('id', payment.usuario_id);
                        if (ticketError) {
                            console.error('CRITICAL: Failed to update tickets after payment', ticketError);
                            warningMessage = 'Pago registrado, pero ERROR al asignar visitas. Verificar manualmente.';
                        }
                    }
                }

                // Get Latest Sub to decide: Extend or New
                const { data: subs } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('usuario_id', payment.usuario_id)
                    .order('fecha_vencimiento', { ascending: false })
                    .limit(1);

                const latestSub = subs?.[0];
                const now = new Date();

                let isExtension = false;

                // Check if active (not expired)
                if (latestSub) {
                    const expiry = new Date(latestSub.fecha_vencimiento);
                    if (expiry > now) {
                        isExtension = true;
                    }
                }

                // DATE LOGIC: Date-to-Date (Month + 1 - 1 Day)
                // Base date is either Now (New) or Expiry (Extension)
                let baseDate = isExtension && latestSub ? new Date(latestSub.fecha_vencimiento) : now;

                // Use the nominal expiration logic for plans of 28+ days (monthly approx)
                let newEnd: Date;
                if (plan.duracion_dias >= 28) {
                    const monthsToAdd = Math.round(plan.duracion_dias / 30);
                    newEnd = calculateNominalExpiration(baseDate, monthsToAdd);
                } else {
                    // Short term plans - add days
                    newEnd = new Date(baseDate.getTime() + (plan.duracion_dias * 24 * 60 * 60 * 1000));
                }

                // Safety: Ensure newEnd is effectively in the future
                if (newEnd <= baseDate) {
                    newEnd = new Date(baseDate.getTime() + (plan.duracion_dias * 24 * 60 * 60 * 1000));
                }


                if (isExtension && latestSub) {
                    // EXTEND existing
                    const { error: subError } = await supabase.from('subscriptions').update({
                        fecha_vencimiento: newEnd.toISOString(),
                        estatus: 'activa', // Ensure active
                        plan_id: payment.plan_id // Switch plan if changed
                    }).eq('id', latestSub.id);

                    if (subError) throw subError;

                } else {
                    // NEW Subscription
                    const startDate = now;
                    // If new, start now, end at calculated date
                    // Note: If Base was 'Now', newEnd is already correct relative to now.

                    const { error: subError } = await supabase.from('subscriptions').insert({
                        usuario_id: payment.usuario_id,
                        plan_id: payment.plan_id,
                        fecha_inicio: startDate.toISOString(),
                        fecha_vencimiento: newEnd.toISOString(),
                        estatus: 'activa'
                    });

                    if (subError) throw subError;
                }
            } else {
                warningMessage = 'Pago registrado, pero NO se encontró el plan para actualizar la suscripción.';
            }
        } catch (e) {
            console.error('Error updating subscription logic', e);
            warningMessage = 'Pago registrado EXITOSAMENTE, pero hubo un error al actualizar la membresía. Por favor actualiza la fecha manualmente.';
        }
    }

    // 4. Update Shift Cash if needed - read this specific shift's live total right before
    // writing, rather than reusing a value read back in step 1 before the insert above.
    if (shiftId && payment.metodo_pago === 'efectivo') {
        const { data: shift } = await supabase.from('shifts').select('total_efectivo').eq('id', shiftId).single();
        if (shift) {
            const newTotal = (shift.total_efectivo || 0) + payment.total;
            const { error: shiftError } = await supabase.from('shifts').update({ total_efectivo: newTotal }).eq('id', shiftId);
            if (shiftError) {
                console.error('Error updating shift cash', shiftError);
                // We don't fail the whole operation since payment matches, but audit log would be nice
            }
        }
    }

    if (warningMessage) {
        return { success: true, message: warningMessage };
    }

    return { success: true };
}

// Chart Data: Revenue last 7 days
export async function getWeeklyRevenue(): Promise<{ date: string; total: number }[]> {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Include today

    // Fetch payments since 7 local days ago (local-day boundary, not UTC - see getTodayIncome)
    const { data, error } = await supabase
        .from('payments')
        .select('fecha_pago, total')
        .gte('fecha_pago', startOfLocalDay(sevenDaysAgo).toISOString());

    if (error) {
        console.error('Error fetching weekly revenue:', error);
        return [];
    }

    // YYYY-MM-DD from local date parts, so a payment lands on the same calendar day a
    // person would name it - toISOString() here would bucket by UTC day instead.
    const dateKeyOf = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Initialize map with 0 for last 7 days to show empty days
    const revenueMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(sevenDaysAgo.getDate() + i);
        // Format nicer: "Mon 01" or just "DD/MM" - keeping ISO key for sorting, formatting in UI
        revenueMap[dateKeyOf(d)] = 0;
    }

    // Sum totals
    data.forEach((p: { fecha_pago: string; total: number }) => {
        const dateKey = dateKeyOf(new Date(p.fecha_pago));
        if (revenueMap[dateKey] !== undefined) {
            revenueMap[dateKey] += p.total;
        }
    });

    // Convert to array
    return Object.entries(revenueMap).map(([date, total]) => ({
        date, // YYYY-MM-DD
        total
    }));
}

export async function deletePaymentAdmin(paymentId: string): Promise<{ success: boolean; message?: string }> {
    // 1. Fetch the payment
    const { data: payment } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!payment) return { success: false, message: 'Pago no encontrado.' };

    // 2. Fetch the plan
    if (payment.plan_id && payment.usuario_id) {
        const { data: plan } = await supabase.from('plans').select('*').eq('id', payment.plan_id).single();
        if (plan) {
            const normName = plan.nombre.toLowerCase();
            // Revert tickets
            if (normName.includes('visita') || normName.includes('paquete')) {
                let ticketsToSub = 1;
                const match = normName.match(/(\d+)\s*visita/);
                if (match) {
                    ticketsToSub = parseInt(match[1]);
                }
                if (ticketsToSub > 0) {
                    const { data: member } = await supabase.from('members').select('visitas_disponibles').eq('id', payment.usuario_id).single();
                    const newCount = Math.max(0, (member?.visitas_disponibles || 0) - ticketsToSub);
                    await supabase.from('members').update({ visitas_disponibles: newCount }).eq('id', payment.usuario_id);
                }
            } else {
                // Revert date
                const { data: subs } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('usuario_id', payment.usuario_id)
                    .order('fecha_vencimiento', { ascending: false })
                    .limit(1);

                const latestSub = subs?.[0];
                if (latestSub) {
                    let oldEnd = new Date(latestSub.fecha_vencimiento);
                    if (plan.duracion_dias >= 28) {
                        const monthsToSub = Math.round(plan.duracion_dias / 30);
                        let year = oldEnd.getFullYear();
                        let month = oldEnd.getMonth() - monthsToSub;
                        while (month < 0) {
                            year--;
                            month += 12;
                        }
                        oldEnd.setFullYear(year);
                        oldEnd.setMonth(month);
                    } else {
                        oldEnd = new Date(oldEnd.getTime() - (plan.duracion_dias * 24 * 60 * 60 * 1000));
                    }
                    await supabase.from('subscriptions').update({ fecha_vencimiento: oldEnd.toISOString() }).eq('id', latestSub.id);
                }
            }
        }
    }

    // 3. Subtract from its shift's cash total, but only while that shift is still open -
    // once closed, total_efectivo holds the physically-counted amount (see getShiftHistory),
    // which a deleted payment shouldn't retroactively change.
    if (payment.turno_id && payment.metodo_pago === 'efectivo') {
        const { data: shift } = await supabase.from('shifts').select('total_efectivo, estatus').eq('id', payment.turno_id).single();
        if (shift && shift.estatus === 'abierto') {
            const newTotal = Math.max(0, (shift.total_efectivo || 0) - payment.total);
            await supabase.from('shifts').update({ total_efectivo: newTotal }).eq('id', payment.turno_id);
        }
    }

    // 4. Delete the payment
    const { error: delError } = await supabase.from('payments').delete().eq('id', paymentId);
    if (delError) return { success: false, message: 'Error eliminando el registro de pago.' };

    return { success: true, message: 'Pago eliminado y vigencia/visitas revertida correctamente.' };
}

export interface DailyReportRow {
    date: string;
    attendeesMorning: number;
    attendeesEvening: number;
    totalAttendees: number;
    paymentsByPlan: Record<string, number>; // count of payments per plan
    revenueByPlan: Record<string, number>; // $ revenue per plan - pure sum of payments.total, never net of expenses/retiros
    totalRevenue: number;
    totalShiftReturns: number; // total handed over to admin from closed shifts
}

export async function getDailyPerformanceSummary(from: Date, to: Date): Promise<DailyReportRow[]> {
    const startBoundary = from.toISOString();
    const endBoundary = to.toISOString();

    // Fetch Attendance (paginated - without .range(), Supabase silently caps at its default
    // row limit with no guaranteed order, which can drop entire recent days/months from a
    // report without any error. See fetchAllRows in supabase.ts.)
    const attendanceData = await fetchAllRows<{ fecha_hora: string }>((rangeFrom, rangeTo) =>
        supabase.from('attendance').select('fecha_hora').gte('fecha_hora', startBoundary).lte('fecha_hora', endBoundary).range(rangeFrom, rangeTo)
    );

    // Fetch Payments with Plans to group by membership type
    const paymentData = await fetchAllRows<any>((rangeFrom, rangeTo) =>
        supabase
            .from('payments')
            .select(`
                fecha_pago,
                total,
                plan:plans(nombre)
            `)
            .gte('fecha_pago', startBoundary)
            .lte('fecha_pago', endBoundary)
            .range(rangeFrom, rangeTo)
    );

    // Fetch Shifts to get closed cash differences (Corte entregado)
    const shiftData = await fetchAllRows<any>((rangeFrom, rangeTo) =>
        supabase
            .from('shifts')
            .select('hora_cierre, total_efectivo, desglose_cierre, fondo_siguiente_turno')
            .eq('estatus', 'cerrado')
            .gte('hora_cierre', startBoundary)
            .lte('hora_cierre', endBoundary)
            .range(rangeFrom, rangeTo)
    );

    const reportMap: Record<string, DailyReportRow> = {};
    const startDate = startOfLocalDay(from);
    const dayCount = Math.round((startOfLocalDay(to).getTime() - startDate.getTime()) / 86400000) + 1;

    for (let i = 0; i < dayCount; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${day}`;
        reportMap[dateKey] = {
            date: dateKey,
            attendeesMorning: 0,
            attendeesEvening: 0,
            totalAttendees: 0,
            paymentsByPlan: {},
            revenueByPlan: {},
            totalRevenue: 0,
            totalShiftReturns: 0
        };
    }

    // Aggregate Attendance
    attendanceData.forEach((a) => {
        const d = new Date(a.fecha_hora);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${day}`;
        if (reportMap[dateKey]) {
            reportMap[dateKey].totalAttendees++;
            if (d.getHours() < 14) {
                reportMap[dateKey].attendeesMorning++;
            } else {
                reportMap[dateKey].attendeesEvening++;
            }
        }
    });

    // Aggregate Payments (count AND revenue per plan - revenue is a pure sum of payments.total,
    // it never touches expenses/retiros, so cash withdrawals during a shift don't affect it)
    paymentData.forEach((p: any) => {
        const d = new Date(p.fecha_pago);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${day}`;
        if (reportMap[dateKey]) {
            const planName = p.plan?.nombre || 'Productos';
            reportMap[dateKey].paymentsByPlan[planName] = (reportMap[dateKey].paymentsByPlan[planName] || 0) + 1;
            reportMap[dateKey].revenueByPlan[planName] = (reportMap[dateKey].revenueByPlan[planName] || 0) + p.total;
            reportMap[dateKey].totalRevenue += p.total;
        }
    });

    // Aggregate Shift Cut (Corte de caja)
    shiftData.forEach((s: any) => {
        if (!s.hora_cierre) return;
        const d = new Date(s.hora_cierre);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${day}`;
        if (reportMap[dateKey]) {
            // total_efectivo already reflects the counted/handed-over cash once the shift is
            // closed (see closeShift in shiftContext.tsx), so it doesn't need re-deriving.
            const collectedInDrawer = s.total_efectivo || 0;
            const leftInDrawer = s.fondo_siguiente_turno ? Number(s.fondo_siguiente_turno) : 0;
            const handedToAdmin = Math.max(0, collectedInDrawer - leftInDrawer);
            
            reportMap[dateKey].totalShiftReturns += handedToAdmin;
        }
    });

    return Object.values(reportMap).sort((a, b) => b.date.localeCompare(a.date));
}

export interface MonthlyReportRow {
    monthStr: string; // YYYY-MM
    attendeesMorning: number;
    attendeesEvening: number;
    totalAttendees: number;
    paymentsByPlan: Record<string, number>; // count of payments per plan
    revenueByPlan: Record<string, number>; // $ revenue per plan - pure sum of payments.total, never net of expenses/retiros
    totalRevenue: number;
    totalShiftReturns: number;
}

export async function getMonthlyPerformanceSummary(months = 6): Promise<MonthlyReportRow[]> {
    const today = new Date();
    // Start date N months ago (1st day of the month, local midnight)
    const startDate = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
    const startBoundary = startDate.toISOString();

    // Fetch Attendance (paginated - see the comment in getDailyPerformanceSummary for why:
    // without .range(), Supabase silently caps at its default row limit with no guaranteed
    // order, which was dropping recent months - the most data-heavy ones - from this report)
    const attendanceData = await fetchAllRows<{ fecha_hora: string }>((rangeFrom, rangeTo) =>
        supabase.from('attendance').select('fecha_hora').gte('fecha_hora', startBoundary).range(rangeFrom, rangeTo)
    );

    // Fetch Payments with Plans to group by membership type
    const paymentData = await fetchAllRows<any>((rangeFrom, rangeTo) =>
        supabase
            .from('payments')
            .select(`
                fecha_pago,
                total,
                plan:plans(nombre)
            `)
            .gte('fecha_pago', startBoundary)
            .range(rangeFrom, rangeTo)
    );

    // Fetch Shifts to get closed cash differences
    const shiftData = await fetchAllRows<any>((rangeFrom, rangeTo) =>
        supabase
            .from('shifts')
            .select('hora_cierre, total_efectivo, desglose_cierre, fondo_siguiente_turno')
            .eq('estatus', 'cerrado')
            .gte('hora_cierre', startBoundary)
            .range(rangeFrom, rangeTo)
    );

    const reportMap: Record<string, MonthlyReportRow> = {};

    for (let i = 0; i < months; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${y}-${m}`;
        reportMap[monthKey] = {
            monthStr: monthKey,
            attendeesMorning: 0,
            attendeesEvening: 0,
            totalAttendees: 0,
            paymentsByPlan: {},
            revenueByPlan: {},
            totalRevenue: 0,
            totalShiftReturns: 0
        };
    }

    // Aggregate Attendance
    attendanceData.forEach((a) => {
        const d = new Date(a.fecha_hora);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${y}-${m}`;
        if (reportMap[monthKey]) {
            reportMap[monthKey].totalAttendees++;
            if (d.getHours() < 14) {
                reportMap[monthKey].attendeesMorning++;
            } else {
                reportMap[monthKey].attendeesEvening++;
            }
        }
    });

    // Aggregate Payments (count AND revenue per plan - revenue is a pure sum of payments.total,
    // it never touches expenses/retiros, so cash withdrawals during a shift don't affect it)
    paymentData.forEach((p: any) => {
        const d = new Date(p.fecha_pago);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${y}-${m}`;
        if (reportMap[monthKey]) {
            const planName = p.plan?.nombre || 'Productos';
            reportMap[monthKey].paymentsByPlan[planName] = (reportMap[monthKey].paymentsByPlan[planName] || 0) + 1;
            reportMap[monthKey].revenueByPlan[planName] = (reportMap[monthKey].revenueByPlan[planName] || 0) + p.total;
            reportMap[monthKey].totalRevenue += p.total;
        }
    });

    // Aggregate Shift Cut (Corte de caja)
    shiftData.forEach((s: any) => {
        if (!s.hora_cierre) return;
        const d = new Date(s.hora_cierre);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${y}-${m}`;
        if (reportMap[monthKey]) {
            // total_efectivo already reflects the counted/handed-over cash once the shift is
            // closed (see closeShift in shiftContext.tsx), so it doesn't need re-deriving.
            const collectedInDrawer = s.total_efectivo || 0;
            const leftInDrawer = s.fondo_siguiente_turno ? Number(s.fondo_siguiente_turno) : 0;
            const handedToAdmin = Math.max(0, collectedInDrawer - leftInDrawer);

            reportMap[monthKey].totalShiftReturns += handedToAdmin;
        }
    });

    // Sort descending by month
    return Object.values(reportMap).sort((a, b) => b.monthStr.localeCompare(a.monthStr));
}

export interface CollaboratorSales {
    colaboradorId: string;
    nombre: string;
    totalVentas: number;
    numPagos: number;
}

// Sales per collaborator for a period - pure sum of payments.total per colaborador_id,
// same "never net against expenses" rule as the rest of the income reports.
export async function getSalesByCollaborator(from: Date, to: Date): Promise<CollaboratorSales[]> {
    const [payments, { data: profiles }] = await Promise.all([
        fetchAllRows<{ colaborador_id: string | null; total: number }>((rangeFrom, rangeTo) =>
            supabase
                .from('payments')
                .select('colaborador_id, total')
                .gte('fecha_pago', from.toISOString())
                .lte('fecha_pago', to.toISOString())
                .range(rangeFrom, rangeTo)
        ),
        supabase.from('profiles').select('id, nombre')
    ]);

    const nameById = new Map((profiles || []).map((p: { id: string; nombre: string }) => [p.id, p.nombre]));

    const byCollaborator: Record<string, { totalVentas: number; numPagos: number }> = {};
    payments.forEach(p => {
        if (!p.colaborador_id) return;
        const entry = byCollaborator[p.colaborador_id] || { totalVentas: 0, numPagos: 0 };
        entry.totalVentas += p.total;
        entry.numPagos += 1;
        byCollaborator[p.colaborador_id] = entry;
    });

    return Object.entries(byCollaborator)
        .map(([colaboradorId, stats]) => ({
            colaboradorId,
            nombre: nameById.get(colaboradorId) || 'Desconocido',
            ...stats
        }))
        .sort((a, b) => b.totalVentas - a.totalVentas);
}

export interface ShiftTypeRevenue {
    matutino: number;
    vespertino: number;
}

// Revenue split by which shift was open when each payment was made (payments.turno_id ->
// shifts.horario). Pure sum of payments.total, same "never net of expenses" rule as the rest.
export async function getRevenueByShiftType(from: Date, to: Date): Promise<ShiftTypeRevenue> {
    const payments = await fetchAllRows<{ turno_id: string | null; total: number }>((rangeFrom, rangeTo) =>
        supabase
            .from('payments')
            .select('turno_id, total')
            .gte('fecha_pago', from.toISOString())
            .lte('fecha_pago', to.toISOString())
            .range(rangeFrom, rangeTo)
    );

    const turnoIds = Array.from(new Set(payments.map(p => p.turno_id).filter((id): id is string => !!id)));

    const horarioById = new Map<string, string>();
    if (turnoIds.length > 0) {
        const shifts = await fetchAllRows<{ id: string; horario: string }>((rangeFrom, rangeTo) =>
            supabase.from('shifts').select('id, horario').in('id', turnoIds).range(rangeFrom, rangeTo)
        );
        shifts.forEach(s => horarioById.set(s.id, s.horario));
    }

    const result: ShiftTypeRevenue = { matutino: 0, vespertino: 0 };
    payments.forEach(p => {
        if (!p.turno_id) return;
        const horario = horarioById.get(p.turno_id);
        if (horario === 'matutino') result.matutino += p.total;
        else if (horario === 'vespertino') result.vespertino += p.total;
    });

    return result;
}
