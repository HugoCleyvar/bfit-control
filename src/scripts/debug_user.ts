import { findMemberForCheckIn } from '../logic/api/memberService';
import { supabase } from '../logic/api/supabase';

async function debugUser() {
    console.log("Searching for Gibran Gael Sanchez...");
    const member = await findMemberForCheckIn("Gibran Gael Sanchez"); // or partial name

    if (!member) {
        console.log("❌ Member not found via findMemberForCheckIn");
        // Try raw search to be sure
        const { data } = await supabase.from('members').select('*').ilike('nombre', '%Gibran%');
        console.log("Raw search results:", data);
        return;
    }

    console.log("--- Member Details ---");
    console.log(`ID: ${member.id}`);
    console.log(`Name: ${member.nombre} ${member.apellido}`);
    console.log(`Plan Name: ${member.currentPlanName}`);
    console.log(`Status (computed): ${member.subscriptionStatus}`);
    console.log(`Tickets (visitas_disponibles): ${member.visitas_disponibles}`);
    console.log(`Last Visit: ${member.ultima_visita}`);

    // Check raw subscription
    const { data: subs } = await supabase
        .from('subscriptions')
        .select(`*, plan:plans(*)`)
        .eq('usuario_id', member.id);

    console.log("\n--- Raw Subscriptions ---");
    console.log(JSON.stringify(subs, null, 2));

    // Simulate Check-in Logic from attendanceService
    const planName = member.currentPlanName?.toLowerCase() || '';
    const isPackPlan = planName.includes('visita') || planName.includes('paquete');
    const canAccess = member.subscriptionStatus === 'activa' && !isPackPlan;

    console.log("\n--- Check-in Logic Simulation ---");
    console.log(`isPackPlan: ${isPackPlan} (Plan Name: "${planName}")`);
    console.log(`subscriptionStatus === 'activa': ${member.subscriptionStatus === 'activa'}`);
    console.log(`Initial canAccess: ${canAccess}`);

    if (isPackPlan) {
        const hasTickets = (member.visitas_disponibles ?? 0) > 0;
        console.log(`Has Tickets (>0): ${hasTickets}`);
    }
}

debugUser();
