import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { join } from 'path';
// import 'dotenv/config'; // Removed to avoid dependency

// ------------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------------
// Manually Load Env (or rely on dotenv)
// We will assume the user runs this with `node --env-file=.env migrate_data.js` or generic setup
// For safety, let's read the .env file ourselves if process.env is empty
import { readFileSync } from 'fs';
let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    try {
        const envConfig = readFileSync('.env', 'utf-8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key === 'VITE_SUPABASE_URL') supabaseUrl = value?.trim();
            if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value?.trim();
        });
    } catch (e) {
        console.error('Could not read .env file');
    }
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BASE_PATH = '/home/hugorosalesing/GIC Gym internal control/';
const FILES = {
    users: 'usuarios_bfit_30-01-2026.xlsx',
    payments: 'pagos_bfit_30-01-2026.xlsx',
    attendance: 'asistencias_bfit_30-01-2026.xlsx'
};

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------
function parseDate(dateStr: string | number): string {
    if (!dateStr) return new Date().toISOString();

    // If Excel serial number
    if (typeof dateStr === 'number') {
        // Excel base date is 1899-12-30
        const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
        return date.toISOString();
    }

    // If String DD/MM/YYYY
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const [day, month, year] = dateStr.trim().split('/');
        // Handle time if present "20:10:38"
        // But headers show "Fecha" and "Hora" separate in attendance, combined?
        // Sample: "29/01/2026"
        return new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString();
    }

    return new Date().toISOString();
}

function parseTime(dateStr: string, timeStr: string): string {
    // Combine Date and Time
    // Date: 29/01/2026, Time: 20:10:38
    try {
        const [day, month, year] = dateStr.trim().split('/');
        return new Date(`${year}-${month}-${day}T${timeStr}Z`).toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}

// ------------------------------------------------------------------
// MAIN
// ------------------------------------------------------------------
async function migrate() {
    console.log('🚀 Starting Migration...');

    console.log('🔑 Authenticating as Admin...');
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'hugo.rosales.ing@gmail.com',
        password: '80clientes'
    });
    if (authError) {
        console.error('Auth Failed:', authError.message);
        process.exit(1);
    }

    // 1. MAPS
    const legacyIdToUuid = new Map<number, string>();
    const planMap = new Map<string, string>(); // 'Visita' -> plan_id

    // 2. CREATE DEFAULT PLANS (If not exist)
    // We need plans to link subscriptions. Let's fetch or create them.
    // MVP: Create 'Visita', 'Mensualidad', 'Semana', 'Quincena'
    const planNames = ['Visita', 'Semana', 'Quincena', 'Mensualidad'];
    for (const name of planNames) {
        const { data: existing } = await supabase.from('plans').select('id').eq('nombre', name).single();
        if (existing) {
            planMap.set(name, existing.id);
        } else {
            const { data: created } = await supabase.from('plans').insert({
                nombre: name,
                precio: 0, // Unknown from Excel, set 0
                duracion_dias: name === 'Visita' ? 1 : name === 'Semana' ? 7 : name === 'Quincena' ? 15 : 30,
                activo: true
            }).select('id').single();
            if (created) planMap.set(name, created.id);
        }
    }
    console.log('✅ Plans Synced');

    // 3. READ USERS
    console.log('📖 Reading Users...');
    const usersWorkbook = XLSX.readFile(join(BASE_PATH, FILES.users));
    const usersSheet = usersWorkbook.Sheets[usersWorkbook.SheetNames[0]];
    const usersData: any[] = XLSX.utils.sheet_to_json(usersSheet);

    console.log(`Found ${usersData.length} users to import.`);

    let userCount = 0;
    for (const row of usersData) {
        // Headers: ID, Nombre, Apellido, Teléfono, Tipo Membresía, Fecha Pago, Fecha Vencimiento, Estado
        const legacyID = row['ID'];
        const nombre = row['Nombre'] || 'Unknown';
        const apellido = row['Apellido'] || '';
        const telefono = row['Teléfono'] ? String(row['Teléfono']) : null;

        // Insert Member
        const { data: member, error } = await supabase.from('members').insert({
            nombre,
            apellido,
            telefono,
            estatus: row['Estado'] === 'Vencido' ? 'activo' : 'activo', // Keep active profile, sub status handles access
            fecha_registro: parseDate(row['Fecha Pago']) // Approx
        }).select('id').single();

        if (error) {
            console.error(`Error inserting user ${nombre}:`, error.message);
            continue;
        }

        if (member) {
            legacyIdToUuid.set(legacyID, member.id);
            userCount++;

            // Create Subscription
            const planType = row['Tipo Membresía'];
            let planId = planMap.get(planType);
            if (!planId) planId = planMap.get('Mensualidad'); // Fallback

            if (planId) {
                const fechaInicio = parseDate(row['Fecha Pago']);
                const fechaVencimiento = parseDate(row['Fecha Vencimiento']);

                // Determine raw status
                let subStatus = 'activa';
                if (row['Estado'] === 'Vencido' || new Date(fechaVencimiento) < new Date()) {
                    subStatus = 'vencida';
                }

                await supabase.from('subscriptions').insert({
                    usuario_id: member.id,
                    plan_id: planId,
                    fecha_inicio: fechaInicio,
                    fecha_vencimiento: fechaVencimiento,
                    estatus: subStatus
                });
            }
        }
    }
    console.log(`✅ Imported ${userCount} users.`);

    // 4. READ PAYMENTS
    console.log('📖 Reading Payments...');
    const payWorkbook = XLSX.readFile(join(BASE_PATH, FILES.payments));
    const payData: any[] = XLSX.utils.sheet_to_json(payWorkbook.Sheets[payWorkbook.SheetNames[0]]);

    let payCount = 0;
    // We need a fake collaborator ID for history
    const { data: adminUser } = await supabase.from('profiles').select('id').eq('rol', 'admin').limit(1).single();
    const adminId = adminUser?.id;

    if (adminId) {
        for (const row of payData) {
            // Headers: Usuario ID, Monto, Fecha Pago, Tipo Membresía
            const userId = legacyIdToUuid.get(row['Usuario ID']);
            if (userId) {
                await supabase.from('payments').insert({
                    usuario_id: userId,
                    total: row['Monto'] || 0,
                    metodo_pago: 'efectivo', // Default
                    fecha_pago: parseDate(row['Fecha Pago']),
                    colaborador_id: adminId,
                    // plan_id could be linked but optional
                });
                payCount++;
            }
        }
        console.log(`✅ Imported ${payCount} payments.`);
    } else {
        console.warn('⚠️ No admin found to assign payments to.');
    }

    // 5. READ ATTENDANCE
    console.log('📖 Reading Attendance...');
    const attWorkbook = XLSX.readFile(join(BASE_PATH, FILES.attendance));
    const attData: any[] = XLSX.utils.sheet_to_json(attWorkbook.Sheets[attWorkbook.SheetNames[0]]);

    let attCount = 0;
    for (const row of attData) {
        // Headers: Usuario ID, Fecha, Hora
        const userId = legacyIdToUuid.get(row['Usuario ID']);
        if (userId) {
            await supabase.from('attendance').insert({
                usuario_id: userId,
                fecha_hora: parseTime(row['Fecha'], row['Hora']),
                permitido: true // Assume historic logs were permitted
            });
            attCount++;
        }
    }
    console.log(`✅ Imported ${attCount} attendance records.`);

    console.log('🎉 Migration Complete!');
}

migrate();
