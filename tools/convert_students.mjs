import xlsx from 'xlsx';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const excelPath = resolve('assets/studentlists/Students List.xlsx');
const jsonPath = resolve('assets/studentlists/students.json');

if (!existsSync(excelPath)) {
    console.error(`File not found: ${excelPath}`);
    process.exit(1);
}

const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet);

// Ensure directory exists
const dir = dirname(jsonPath);
if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
}

writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Successfully converted ${excelPath} to ${jsonPath}`);
console.log(`Total students: ${data.length}`);
console.log('Sample data:', data[0]);
