import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseCatalogHtml, deduplicateById } from './lib/parseCatalogHtml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CATALOG_URL = 'https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog';
const OUTPUT_PATH = path.join(__dirname, 'data', 'sessions.json');

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function expandAllSessions(page) {
  let previousCount = -1;
  let currentCount = await page.locator('li.catalog-result.session-result').count();

  while (currentCount !== previousCount) {
    previousCount = currentCount;

    const showMoreButton = page.getByText('Show More', { exact: false });
    const isVisible = await showMoreButton.isVisible().catch(() => false);

    if (!isVisible) break;

    await showMoreButton.click();
    await page.waitForTimeout(1500);

    currentCount = await page.locator('li.catalog-result.session-result').count();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(CATALOG_URL);

  await waitForEnter(
    '\nLog in manually (including MFA) and navigate until the session catalog is visible.\nPress Enter here when you\'re ready to continue...\n'
  );

  console.log('Expanding the full list of sessions (clicking "Show More")...');
  await expandAllSessions(page);

  console.log('Extracting session data...');
  const html = await page.content();
  const rawSessions = parseCatalogHtml(html);
  const sessions = deduplicateById(rawSessions);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sessions, null, 2));
  console.log(`Saved ${sessions.length} sessions to ${OUTPUT_PATH}`);

  await browser.close();
}

main().catch((error) => {
  console.error('Error during scraping:', error);
  process.exit(1);
});
