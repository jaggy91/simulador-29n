// Genera data/europeas-2024.json: % por provincia de las europeas de 2024, desde los
// ficheros oficiales del Ministerio del Interior (07202406_TOTA.zip). Se usa para
// dividir el voto de Sumar 2023 entre Sumar y Podemos y como base de SALF.
// infoelectoral solo responde desde España: con el ZIP en .cache/interior no hace falta
// volver a descargarlo.
import fs from 'node:fs';
import { PROVINCES } from './lib/provinces.js';
import { interiorZip, zipUrl, candidaturas, totalesProvinciales, votosProvinciales } from './lib/interior.js';

// Siglas de 2024 → ids del modelo. Sumar concurrió con varias marcas territoriales.
const MAP = [
  [/^PP$/, 'PP'], [/^(PSOE|PSC)/, 'PSOE'], [/^VOX$/, 'VOX'], [/SUMAR/, 'SUMAR'],
  [/^PODEMOS/, 'PODEMOS'], [/SE ACAB/, 'SALF'],
];

const files = await interiorZip('07', '2024', '06');
const cand = candidaturas(files);
const tot = totalesProvinciales(files);
const votos = votosProvinciales(files);
const idOf = (c) => MAP.find(([re]) => re.test(cand[c]?.siglas || ''))?.[1];

const out = PROVINCES.map((p) => {
  const t = tot[p.id];
  const v = votos[p.id];
  if (!t || !v) throw new Error(`Sin datos de Interior para ${p.name}`);
  const sum = Object.values(v).reduce((a, b) => a + b, 0);
  if (sum !== t.candidaturas) throw new Error(`${p.name}: votos de candidaturas ${sum} ≠ total ${t.candidaturas}`);
  const valid = t.candidaturas + t.blancos;
  const acc = {};
  for (const [c, n] of Object.entries(v)) {
    const id = idOf(c);
    if (id) acc[id] = (acc[id] || 0) + n;
  }
  return { id: p.id, name: p.name, valid, pct: Object.fromEntries(Object.entries(acc).map(([k, n]) => [k, Math.round((1e4 * n) / valid) / 100])) };
});

fs.writeFileSync('data/europeas-2024.json', JSON.stringify({
  source: `Ministerio del Interior, resultados oficiales (${zipUrl('07', '2024', '06')})`,
  unit: '% sobre válidos (candidaturas + blanco), 2 decimales',
  provinces: out,
}, null, 1));
for (const p of out.filter((p) => ['28', '08', '44'].includes(p.id))) console.log(p.name, JSON.stringify(p.pct));
console.log('→ data/europeas-2024.json');
