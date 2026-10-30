// Genera data/andaluzas-2026.json: % por provincia de las autonómicas andaluzas del
// 17-may-2026. Es la base territorial de Adelante Andalucía, que en 2023 solo se
// presentó en Cádiz.
// Fuente oficial: resolución de la Junta Electoral de Andalucía publicada en el BOJA
// núm. 108, de 8-jun-2026 (Cuadro I: válidos; Cuadro II: votos y escaños de las
// formaciones con escaño), con la corrección de errores del BOJA núm. 115, de 17-jun
// (Granada: +3 votos válidos y a candidaturas). Los PDF están en la web de la Junta
// Electoral de Andalucía. Caché local en .cache/jea.
import fs from 'node:fs';
import path from 'node:path';
import { PROVINCES } from './lib/provinces.js';
import { pdfRows, provinceId, num } from './lib/boe.js';

const BASE = 'https://juntaelectoral.parlamentodeandalucia.es';
const DOC = '/documents/20117/74639/2026-0608-Resultados-electorales-BOJA.pdf/471bdb4c-47c9-d0bf-a944-46a46265b9ef';
const CORRECTION = { '18': { valid: 480678, candidaturas: 476345 } }; // BOJA núm. 115, 17-jun-2026
const UA = 'simulador-29n/1.0 (+https://github.com/jaggy91/simulador-29n)';
// Columnas del Cuadro II, en el orden del BOJA.
const PARTIES = ['PP', 'PSOE', 'VOX', 'AA', 'FA']; // FA = Por Andalucía (IU, Podemos, Sumar…)

const file = path.resolve('.cache/jea/2026-0608-Resultados-electorales-BOJA.pdf');
if (!fs.existsSync(file)) {
  const res = await fetch(BASE + DOC, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Junta Electoral de Andalucía ${res.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
const rows = await pdfRows(fs.readFileSync(file));
const lines = rows.map((r) => r.cells.map((c) => c.text));
const at = (title) => lines.findIndex((l) => l.join(' ').startsWith(title));
const i1 = at('CUADRO I. RESUMEN GENERAL');
const i2 = at('CUADRO II.');
const i3 = at('CUADRO III.');

const prov = {};
for (const l of lines.slice(i1, i2)) {
  const id = provinceId(l[0]);
  if (!id || l.length !== 7) continue;
  const [, , , valid, candidaturas, blank] = l.map(num);
  prov[id] = { valid, candidaturas, blank, ...CORRECTION[id] };
}
for (const l of lines.slice(i2, i3)) {
  const id = provinceId(l[0]);
  if (!id || l.length !== 2 + 2 * PARTIES.length) continue;
  const seats = num(l[1]);
  const votes = {};
  let won = 0;
  PARTIES.forEach((p, k) => { won += num(l[2 + 2 * k]); votes[p] = num(l[3 + 2 * k]); });
  if (won !== seats) throw new Error(`${l[0]}: escaños ${won} ≠ ${seats}`);
  Object.assign(prov[id], { seats, votes });
}

const out = PROVINCES.filter((p) => prov[p.id]).map((p) => {
  const x = prov[p.id];
  if (!x.votes) throw new Error(`${p.name}: sin Cuadro II`);
  if (x.candidaturas + x.blank !== x.valid) throw new Error(`${p.name}: candidaturas + blanco ≠ válidos`);
  return { id: p.id, name: p.name, valid: x.valid, pct: Object.fromEntries(PARTIES.map((k) => [k, Math.round((1e4 * x.votes[k]) / x.valid) / 100])) };
});
if (out.length !== 8) throw new Error(`Se esperaban 8 provincias y hay ${out.length}`);
fs.writeFileSync('data/andaluzas-2026.json', JSON.stringify({
  source: 'Junta Electoral de Andalucía, BOJA núm. 108 (8-jun-2026), con la corrección del BOJA núm. 115 (17-jun-2026)',
  unit: '% sobre válidos (candidaturas + blanco), 2 decimales',
  provinces: out,
}, null, 1));
for (const p of out) console.log(p.name, JSON.stringify(p.pct));
console.log('→ data/andaluzas-2026.json');
