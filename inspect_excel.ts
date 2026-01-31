import XLSX from 'xlsx';

// Files provided by user
const files = [
    'usuarios_bfit_30-01-2026.xlsx',
    'pagos_bfit_30-01-2026.xlsx',
    'asistencias_bfit_30-01-2026.xlsx'
];

const basePath = '/home/hugorosalesing/GIC Gym internal control/';

console.log('--- INSPECTING EXCEL HEADERS ---');

files.forEach(file => {
    try {
        const path = basePath + file;
        const workbook = XLSX.readFile(path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON (Header row only)
        const data = XLSX.utils.sheet_to_json(sheet) as any[];

        if (data.length > 0) {
            console.log(`\nFILE: ${file}`);
            console.log('HEADERS:', Object.keys(data[0]).join(', '));
            console.log('SAMPLE ROW:', JSON.stringify(data[0]));
        } else {
            console.log(`\nFILE: ${file} is empty or unreadable.`);
        }
    } catch (err: any) {
        console.error(`Error reading ${file}:`, err.message);
    }
});
