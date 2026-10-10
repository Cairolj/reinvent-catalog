import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalogHtml, deduplicateById } from './lib/parseCatalogHtml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const inputPath = process.argv[2] || path.join(__dirname, 'data', 'html', 'Event catalog.html');
const outputPath = path.join(__dirname, 'data', 'sessions.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const html = fs.readFileSync(inputPath, 'utf-8');
const rawSessions = parseCatalogHtml(html);
const sessions = deduplicateById(rawSessions);

fs.writeFileSync(outputPath, JSON.stringify(sessions, null, 2));
console.log(`Parsed ${sessions.length} sessions (of ${rawSessions.length} found) and saved to ${outputPath}`);
