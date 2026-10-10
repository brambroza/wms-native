// Captures the README screenshots from a running build in demo mode.
// Usage: npm run build && npm run start -w apps/web -- -p 3100
//        node scripts/screenshots.mjs http://localhost:3100 [path/to/playwright/package.json] [chrome path]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:3100';
const req = createRequire(process.argv[3] ?? import.meta.url);
const { chromium } = req('playwright');
const out = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const sample = fileURLToPath(new URL('../docs/samples/packing-plan-sample.csv', import.meta.url));

const browser = await chromium.launch({ executablePath: process.argv[4], args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function shot(path, name, { width = 1440, height = 900, full = false, action } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  if (action) await action(page);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: full });
  await page.close();
  console.log('saved', name);
}

const tab = (name) => async (p) => {
  await p.getByRole('tab', { name }).click();
  await p.waitForTimeout(2500);
};

await shot('/', '01-dashboard');
await shot('/plans', '02-plans');
await shot('/plans/import', '03-import', {
  full: true,
  action: async (p) => {
    await p.setInputFiles('input[type=file]', sample);
    await p.waitForTimeout(1500);
  },
});
await shot('/plans/pp-1', '04-plan-detail');
await shot('/stock', '05-stock-2d');
await shot('/stock', '06-stock-3d', { action: tab('3D') });
await shot('/loading/ct-1', '07-loading');
await shot('/loading/ct-1', '08-loading-3d', { action: tab('3D แผนการจัด') });
await shot('/m', '09-staff-home', { width: 390, height: 844 });
await shot('/m/pick/ct-5', '10-staff-pick', { width: 390, height: 844 });
await shot('/m/load/ct-1', '11-staff-load', {
  width: 390,
  height: 844,
  action: async (p) => {
    const serial = (await p.locator('main b.text-\\[34px\\]').first().textContent())?.trim() ?? '';
    await p.fill('#manual-scan', serial);
    await p.press('#manual-scan', 'Enter');
    await p.waitForTimeout(800);
  },
});
await browser.close();
