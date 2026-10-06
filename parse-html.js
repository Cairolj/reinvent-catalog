import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalogHtml, deduplicateById } from './lib/parseCatalogHtml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const inputPath = process.argv[2] || path.join(__dirname, 'data', 'html', 'Event catalog.html');
const outputPath = path.join(__dirname, 'data', 'sessions.json');

if (!fs.existsSync(inputPath)) {
  console.error(`No se encontró el archivo de entrada: ${inputPath}`);
  process.exit(1);
}

const html = fs.readFileSync(inputPath, 'utf-8');
const rawSessions = parseCatalogHtml(html);
const sessions = deduplicateById(rawSessions);

fs.writeFileSync(outputPath, JSON.stringify(sessions, null, 2));
console.log(`Se parsearon ${sessions.length} sesiones (de ${rawSessions.length} encontradas) y se guardaron en ${outputPath}`);
