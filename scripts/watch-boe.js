// Vigilante del BOE: busca en el sumario diario (API de datos abiertos) las candidaturas
// proclamadas para las elecciones del 29-N (Real Decreto 806/2026). Cuando salen:
//  1. lee las listas al Senado de cada circunscripción (lib/proclamacion.js);
//  2. comprueba que están todas y tienen sentido;
//  3. si todo cuadra, crea o actualiza en data/news.json una tarjeta oficial con las
//     circunscripciones reales de Senado de Progreso y del pacto PP–Vox. Al ser
//     oficial, supera a la prensa en esos parámetros (§4.10).
// Si algo no cuadra, no aplica nada: lo deja escrito en data/candidaturas-2026.json
// (`problems`) para que el workflow abra un aviso.
// Desde el 1-dic busca además el escrutinio definitivo de la Junta Electoral Central:
// cuando sale, genera data/congreso-2026.json y senado-2026.json (build-oficial-2023.js)
// y la comparación final con la proyección (compare-final.js).
// Uso: node scripts/watch-boe.js [--decree 806/2026] [--from 2026-10-28] [--date AAAA-MM-DD] [--dry]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { boePdf } from './lib/boe.js';
import { loadModelData, readJSON, writeJSON } from './lib/load-data.js';
import { parseProclamacion, scenarioParams, problems } from './lib/proclamacion.js';
import { prepare } from '../src/engine/model.js';

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const DECREE = arg('--decree', '806/2026');
const FROM = arg('--from', '2026-10-28');
const DRY = process.argv.includes('--dry');
const OUT = 'data/candidaturas-2026.json';
const CARD = 'boe-candidaturas-2026';
const UA = 'simulador-29n/1.0 (+https://github.com/jaggy91/simulador-29n)';

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
async function sumario(day) {
  const res = await fetch(`https://www.boe.es/datosabiertos/api/boe/sumario/${ymd(day)}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return null; // sin BOE ese día (domingos) o aún no publicado
  return (await res.json()).data;
}
const isProclamacion = (t) => /candidaturas proclamadas/i.test(t) && /Senado/.test(t) && t.includes(DECREE);
const isEscrutinio = (t) => /resumen de los resultados de las elecciones al Congreso de los Diputados y al Senado/i.test(t) && t.includes(DECREE);
function find(data, test = isProclamacion) {
  const items = [];
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (o.identificador && test(o.titulo || '')) items.push(o);
      Object.values(o).forEach(walk);
    }
  };
  walk(data);
  return items[0] || null;
}
const flag = (k) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=si
`);

// --- Escrutinio definitivo (desde el 1-dic, hasta que se publique) -----------------
const RESULTS_FROM = '2026-12-01';
if (!arg('--date') && !DRY && new Date() >= new Date(`${RESULTS_FROM}T00:00:00Z`) && !fs.existsSync('data/congreso-2026.json')) {
  const watch = readJSON('boe-watch', { checked: [] });
  const today = new Date();
  let found = null;
  for (let d = new Date(`${RESULTS_FROM}T12:00:00Z`); d <= today && !found; d = new Date(d.getTime() + 864e5)) {
    const day = d.toISOString().slice(0, 10);
    if (watch.checked.includes(day)) continue;
    const item = find(await sumario(d), isEscrutinio);
    if (item) found = item;
    else if ((today - d) / 864e5 > 2) watch.checked.push(day); // días cerrados sin nada
  }
  writeJSON('boe-watch', watch);
  if (!found) console.log('BOE: aún no hay escrutinio definitivo');
  else {
    console.log(`BOE: escrutinio definitivo ${found.identificador}`);
    try {
      execSync(`node scripts/build-oficial-2023.js --boe ${found.identificador} --year 2026`, { stdio: 'inherit' });
      execSync('node scripts/compare-final.js', { stdio: 'inherit' });
    } catch (e) {
      console.log(`No se pudo leer o comparar el escrutinio: ${e.message}`);
      for (const f of ['congreso-2026', 'senado-2026']) fs.rmSync(`data/${f}.json`, { force: true });
      flag('problemas_escrutinio');
    }
  }
}

// --- Candidaturas proclamadas -------------------------------------------------------
const prev = readJSON('candidaturas-2026', null);
if (prev?.applied && !arg('--date')) {
  console.log(`Candidaturas ya aplicadas: ${prev.boe} (${prev.date})`);
  process.exit(0);
}

const days = [];
if (arg('--date')) days.push(new Date(`${arg('--date')}T12:00:00Z`));
else for (let d = new Date(`${FROM}T12:00:00Z`); d <= new Date(); d = new Date(d.getTime() + 864e5)) days.push(d);

let hit = null;
for (const d of days.reverse()) {
  const item = find(await sumario(d));
  if (item) { hit = { ...item, date: d.toISOString().slice(0, 10) }; break; }
}
if (!hit) {
  console.log(`BOE: aún no hay candidaturas proclamadas (Real Decreto ${DECREE}) desde el ${FROM}`);
  process.exit(0);
}

const url = hit.url_pdf?.texto || hit.url_pdf;
console.log(`BOE: ${hit.identificador} (${hit.date}) — ${hit.titulo}`);
const { senateBase } = prepare(loadModelData());
const lists = await parseProclamacion(await boePdf(hit.identificador));
const params = scenarioParams(lists, senateBase);
const issues = problems(lists, senateBase);
// Plausibilidad de lo que se va a aplicar (si no, mejor revisarlo a mano).
if (params.senadoProgreso.length < 30) issues.push(`Senado de Progreso solo en ${params.senadoProgreso.length} circunscripciones (la prensa decía 47)`);
if (params.voxWithdraws.length > 25) issues.push(`Vox sin lista en ${params.voxWithdraws.length} circunscripciones: demasiadas`);

const record = {
  boe: hit.identificador, date: hit.date, url, title: hit.titulo, checked: new Date().toISOString(),
  params, problems: issues, applied: !issues.length && !DRY,
  lists: Object.fromEntries(Object.entries(lists).map(([k, ls]) => [k, ls.map(({ name, siglas, candidates }) => ({ name, siglas, candidates }))])),
};
console.log('Senado de Progreso en', params.senadoProgreso.length, '· Vox se retira en', params.voxWithdraws.length, '· PP se retira en', params.ppWithdraws.length, '· Vox con candidato único en', params.voxSingle.length);
if (issues.length) console.log(`No se aplica: ${issues.length} problemas\n- ${issues.join('\n- ')}`);

if (!DRY) {
  writeJSON('candidaturas-2026', record);
  if (!issues.length) {
    const news = readJSON('news');
    const card = {
      id: CARD, type: 'oficial', date: hit.date,
      title: `BOE: candidaturas proclamadas al Senado (${hit.identificador})`,
      detail: `Listas reales por circunscripción. Senado de Progreso en ${params.senadoProgreso.length}; Vox sin lista en ${params.voxWithdraws.length}, PP sin lista en ${params.ppWithdraws.length}, Vox con candidato único en ${params.voxSingle.length}. Leído y comprobado automáticamente (data/candidaturas-2026.json).`,
      outlet: 'BOE', sources: [url], verified: true, captured: 'auto-oficial',
      effects: [
        { scenario: 'SENADO_PROGRESO', params: { ids: params.senadoProgreso } },
        { scenario: 'PACTO_PP_VOX_SENADO', params: { voxWithdraws: params.voxWithdraws, ppWithdraws: params.ppWithdraws, voxSingle: params.voxSingle } },
      ],
    };
    news.cards = [...news.cards.filter((c) => c.id !== CARD), card];
    writeJSON('news', news);
    console.log(`→ tarjeta oficial «${CARD}» en data/news.json`);
  }
  console.log(`→ ${OUT}`);
}
if (issues.length && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'problemas=si\n');
