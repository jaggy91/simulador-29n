// Resultados provisionales de la noche electoral: el escrutinio provisional del
// Ministerio del Interior, tal como lo publica RTVE en ficheros JSON
// (resultados-elecciones.rtve.es), con el total nacional contrastado con Público.
// infoelectoral no responde fuera de España; RTVE recibe los mismos datos por el canal
// de Interior para medios. El escrutinio definitivo llega después en el BOE.
// Escribe data/results.json. No hace nada durante la veda.
// Uso: node scripts/fetch-results.js [--year 2026] [--month 11]
import fs from 'node:fs';
import { inVeda } from '../src/veda.js';

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const YEAR = arg('--year', '2026');
const UA = 'simulador-29n/1.0 (+https://github.com/jaggy91/simulador-29n)';
const BASE = 'https://resultados-elecciones.rtve.es';
const SLUGS = JSON.parse(fs.readFileSync('data/rtve-provincias.json', 'utf8')).provinces;

if (YEAR === '2026' && inVeda()) {
  console.log('Veda electoral: no se publican resultados hasta el cierre de las urnas');
  process.exit(0);
}

async function get(url, json = true) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return json ? res.json() : res.text();
}

// El segmento del mes en la ruta (julio de 2023 → /7/) se lee de la página de RTVE.
async function month() {
  if (arg('--month')) return arg('--month');
  try {
    const html = await get(`${BASE}/generales/${YEAR}/congreso/`, false);
    return html.match(new RegExp(`datos/congreso/${YEAR}/(\\d+)/resultados/`))?.[1] || '11';
  } catch {
    return '11';
  }
}

// Siglas de RTVE → ids del modelo (las no reconocidas conservan sus siglas).
const MAP = [
  [/^(PP|UPN-PP)$/i, 'PP'], [/^(PSOE|PSC|PSC-PSOE|PSIB-PSOE|PSN-PSOE|PSE-EE|PSDEG)/i, 'PSOE'], [/^VOX$/i, 'VOX'],
  [/FRENTE AMPLIO|^FA$/i, 'FA'], [/COMPROM/i, 'FV'], [/^PODEMOS/i, 'PODEMOS'], [/SALF|SE ACAB/i, 'SALF'],
  [/^SUMAR/i, 'SUMAR'], [/^ERC/i, 'ERC'], [/JUNTS|JXCAT/i, 'JUNTS'], [/BILDU/i, 'BILDU'], [/PNV/i, 'PNV'],
  [/^BNG/i, 'BNG'], [/^CC|COALICI.N CANARIA/i, 'CC'], [/^UPN$/i, 'UPN'], [/ADELANTE/i, 'AA'],
];
const idOf = (siglas) => { const s = siglas.replace(/\./g, ''); return MAP.find(([re]) => re.test(s))?.[1] || s; };
function parties(r) {
  const out = {};
  for (const p of r.partidos || []) {
    const k = idOf(p.siglas);
    const o = (out[k] ||= { votes: 0, pct: 0, seats: 0, siglas: [] });
    o.votes += p.votos; o.pct = Math.round(100 * (o.pct + p.porcentaje)) / 100; o.seats += p.escanos || 0; o.siglas.push(p.siglas);
  }
  return out;
}

const m = await month();
const url = (path) => `${BASE}/datos/congreso/${YEAR}/${m}/resultados/${path}`;
let nat;
try {
  nat = (await get(url(`${YEAR}-resultados.json`))).resultados;
} catch (e) {
  console.log(`RTVE aún no publica resultados de ${YEAR} (${e.message})`);
  process.exit(0);
}

const provinces = {};
const missing = [];
for (const [id, slug] of Object.entries(SLUGS)) {
  try {
    const r = (await get(url(`${slug}/${YEAR}-resultados-${slug.replace('/', '-')}.json`))).resultados;
    provinces[id] = { escrutado: r.escrutado, participacion: r.participacion, seats: r.escanos_total, parties: parties(r), updated: r.lastModifiedTime };
  } catch {
    missing.push(id);
  }
}

// Contraste: el total nacional de Público (datos estructurados de su página).
let crosscheck = null;
try {
  const html = await get(`https://www.publico.es/resultados-elecciones/generales/${YEAR}/`, false);
  const votos = Object.fromEntries([...html.matchAll(/"name":"Votos ([^"]+)","value":"(\d+)"/g)].map((x) => [idOf(x[1]), +x[2]]));
  const nationalVotes = parties(nat);
  const keys = ['PP', 'PSOE', 'VOX'].filter((k) => votos[k] != null && nationalVotes[k]);
  const diffs = Object.fromEntries(keys.map((k) => [k, votos[k] - nationalVotes[k].votes]));
  crosscheck = { source: 'Público', keys, diffs, matches: keys.length === 3 && keys.every((k) => Math.abs(diffs[k]) <= 0.002 * nationalVotes[k].votes) };
} catch (e) {
  crosscheck = { source: 'Público', error: e.message };
}

const out = {
  updated: new Date().toISOString(),
  year: +YEAR,
  source: 'Ministerio del Interior, escrutinio provisional, vía RTVE (resultados-elecciones.rtve.es)',
  official: false, // el escrutinio definitivo lo publica la Junta Electoral Central en el BOE
  escrutado: nat.escrutado,
  participacion: nat.participacion,
  sourceUpdated: nat.lastModifiedTime,
  national: parties(nat),
  provinces,
  missing,
  crosscheck,
};
fs.writeFileSync('data/results.json', JSON.stringify(out, null, 1));
const s = Object.entries(out.national).filter(([, v]) => v.seats).sort((a, b) => b[1].seats - a[1].seats).map(([k, v]) => `${k} ${v.seats}`).join(' · ');
console.log(`Escrutado ${out.escrutado} %, ${Object.keys(provinces).length}/52 provincias${missing.length ? ` (faltan ${missing.join(', ')})` : ''}: ${s}`);
console.log(`Contraste con Público: ${crosscheck.matches ? 'coincide' : JSON.stringify(crosscheck)}`);
console.log('→ data/results.json');
