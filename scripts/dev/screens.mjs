// Capturas y comprobaciones de la web con Edge/Chrome instalado (puppeteer-core).
// Uso: node scripts/dev/screens.mjs <url> <carpeta-salida>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [url = 'http://localhost:4173/', out = '.'] = process.argv.slice(2);
const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run'] });

async function shot(name, { width, height, scheme, action }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('header nav');
  if (action) await action(page);
  const overflow = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const bad = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > W + 1 && !el.closest('.table-wrap'))
      .slice(0, 8)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} → ${Math.round(el.getBoundingClientRect().right)}px`);
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: W, bad };
  });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(name, JSON.stringify(overflow), errors.length ? `ERRORES: ${errors.join(' | ')}` : 'sin errores');
  await page.close();
}

await shot('desk-dark', { width: 1280, height: 900, scheme: 'dark' });
await shot('desk-light', { width: 1280, height: 900, scheme: 'light' });
await shot('mobile', { width: 390, height: 844, scheme: 'light' });
await shot('whatif', {
  width: 1280, height: 900, scheme: 'light',
  action: async (page) => {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Qué pasaría si').click());
    // Fuerza "Sí" en el voto exterior y espera al worker.
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.scn')].find((c) => c.textContent.includes('Votos exteriores'));
      [...card.querySelectorAll('button')].find((b) => b.textContent === 'Sí').click();
    });
    await page.waitForFunction(() => document.querySelector('.banner')?.textContent.includes('Simulación personalizada'), { timeout: 60000 });
    const hero = await page.$eval('.hero-figure .value', (e) => e.textContent);
    console.log('  qué pasaría si (exterior 14.000 techo): P(mayoría) =', hero);
  },
});
await shot('espectro-izq5', {
  width: 1280, height: 900, scheme: 'light',
  action: async (page) => {
    await page.evaluate(() => [...document.querySelectorAll('header nav button')].find((b) => b.textContent === 'Espectro').click());
    await page.waitForSelector('.spec-track');
    await page.evaluate(() => document.querySelectorAll('.spec-stop')[0].click());
    console.log('  espectro nivel −5: fondo', await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  },
});
await browser.close();
