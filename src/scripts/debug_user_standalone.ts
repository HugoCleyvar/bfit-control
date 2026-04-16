
import { createClient } from '@supabase/supabase-js';

// Hardcoded for debug purposes (from .env)
const SUPABASE_URL = 'https://bpsbwwnxonesjtsmuzjb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwc2J3d254b25lc2p0c211empiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjg0NjksImV4cCI6MjA4NTQwNDQ2OX0.TB0fvfn2FDr9-OPPWWr9kVfFTUEMC4LEtnrUcWuPe-o';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Member {
    id: string;
    nombre: string;
    apellido: string;
    foto_url?: string;
    telefono?: string;
    fecha_nacimiento?: string;
    estatus: string;
    fecha_registro: string;
    visitas_disponibles?: number;
    ultima_visita?: string;
    subscriptions?: any[];
}

async function findMemberForCheckIn(query: string): Promise<any | null> {
    // 1. Try by ID (exact match)
    const { data: byId } = await supabase
        .from('members')
        .select(`*, subscriptions (*, plan:plans(nombre))`)
        .eq('id', query)
        .maybeSingle();

    if (byId) return mapMember(byId);

    // 2. Try by Name (Partial match)
    const { data: byName } = await supabase
        .from('members')
        .select(`*, subscriptions (*, plan:plans(nombre))`)
        .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%`)
        .limit(1);

    if (byName && byName.length > 0) return mapMember(byName[0]);

    return null;
}

function mapMember(member: any) {
    const today = new Date();
    const subs = (member.subscriptions || [])
        .sort((a: any, b: any) => new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime());

    const validActiveSub = subs.find((s: any) =>
        s.estatus === 'activa' && new Date(s.fecha_vencimiento) > today
    );

    const latestSub = subs[0];
    const targetSub = validActiveSub || latestSub;

    let status = 'sin_suscripcion';
    let daysResult = 0;

    if (targetSub) {
        // MATCHING THE FIX WE JUST APPLIED
        const dateOnly = targetSub.fecha_vencimiento.split('T')[0];
        const [y, m, d] = dateOnly.split('-').map(Number);
        const expirationDate = new Date(y, m - 1, d, 23, 59, 59, 999);

        console.log(`Debug Expiration Calculation:`);
        console.log(`  Target Sub ID: ${targetSub.id}`);
        console.log(`  Raw Vencimiento: ${targetSub.fecha_vencimiento}`);
        console.log(`  Parsed DateOnly: ${dateOnly}`);
        console.log(`  Computed Expiration: ${expirationDate.toLocaleString()}`);
        console.log(`  vs Today: ${today.toLocaleString()}`);

        if (expirationDate < today) {
            status = 'vencida';
        } else {
            status = targetSub.estatus;
        }
    }

    return {
        ...member,
        subscriptionStatus: status,
        currentPlanName: targetSub?.plan?.nombre
    };
}



async function debugUser() {
    console.log("Checking DB Access...");

    // Check Count
    const { count, error: countError } = await supabase.from('members').select('*', { count: 'exact', head: true });
    if (countError) {
        console.error("Count Error:", countError);
    } else {
        console.log(`Total Members in DB: ${count}`);
    }

    const { data: searchResults } = await supabase
        .from('members')
        .select(`*, subscriptions (*, plan:plans(nombre))`)
        .ilike('nombre', '%Gibran%');

    if (!searchResults || searchResults.length === 0) {
        console.log("❌ No members found with name containing 'Gibran'");
        // Debug: List all members (limit 5) to verify connection
        const { data: allMembers, error } = await supabase.from('members').select('id, nombre, apellido').limit(5);
        console.log("DB Sample:", allMembers?.map(m => `${m.nombre} ${m.apellido}`));
        return;
    }

    console.log(`Found ${searchResults.length} matches.`);
    searchResults.forEach(m => console.log(` - ${m.nombre} ${m.apellido} (${m.id})`));

    const memberData = searchResults[0]; // Take first match
    const member = mapMember(memberData);


    console.log("\n--- Member Details ---");
    console.log(`ID: ${member.id}`);
    console.log(`Name: ${member.nombre} ${member.apellido}`);
    console.log(`Plan Name: ${member.currentPlanName}`);
    console.log(`Status (computed): ${member.subscriptionStatus}`);
    console.log(`Tickets: ${member.visitas_disponibles}`);
    console.log(`Last Visit: ${member.ultima_visita}`);

    // Simulate Check-in Logic
    const planName = member.currentPlanName?.toLowerCase() || '';
    const isPackPlan = planName.includes('visita') || planName.includes('paquete');
    const canAccess = member.subscriptionStatus === 'activa' && !isPackPlan;

    console.log("\n--- Check-in Logic Simulation ---");
    console.log(`isPackPlan: ${isPackPlan}`);
    console.log(`canAccess: ${canAccess}`);

    if (!canAccess) {
        console.log("WHY ACCESS DENIED?");
        if (member.subscriptionStatus !== 'activa') console.log(`  -> Status is '${member.subscriptionStatus}'`);
        if (isPackPlan) console.log(`  -> Plan is detected as a PACK/VISIT plan`);
    }
}

debugUser();
