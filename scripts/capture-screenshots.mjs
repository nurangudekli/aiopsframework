/**
 * Capture screenshots of the GenAI Ops Framework UI pages.
 * Usage: node scripts/capture-screenshots.mjs
 * Requires: puppeteer (npm install --save-dev puppeteer)
 * Prerequisites: frontend dev server on http://localhost:5173
 */

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, '..', 'docs', 'screenshots');
const BASE = 'http://localhost:5173';

const PAGES = [
  { name: '01-home',             path: '/',                title: 'Home / Dashboard' },
  { name: '02-model-endpoints',  path: '/model-endpoints', title: 'Model Endpoints' },
  { name: '03-testing',          path: '/testing',         title: 'A/B & Shadow Testing' },
  { name: '04-prompts',          path: '/prompts',         title: 'Prompt Engineering' },
  { name: '05-evaluation',       path: '/evaluation',      title: 'Evaluation Hub' },
  { name: '06-migration',        path: '/migration',       title: 'Migration & Pipeline' },
  { name: '07-rag',              path: '/rag',             title: 'RAG Pipeline' },
  { name: '08-monitoring',       path: '/monitoring',      title: 'Monitoring' },
  { name: '09-about',            path: '/about',           title: 'About' },
];

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  for (const { name, path, title } of PAGES) {
    const url = `${BASE}${path}`;
    console.log(`📸 Capturing: ${title} (${url})`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit for any animations / lazy data to settle
    await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

    const filePath = resolve(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`   ✅ Saved: ${filePath}`);
  }

  await browser.close();
  console.log('\n🎉 All screenshots captured!');
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
