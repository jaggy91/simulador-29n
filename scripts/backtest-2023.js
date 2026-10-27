// Backtest: el mismo método (base provincial de la elección anterior + swing
// proporcional IPF + D'Hondt + Monte Carlo), aplicado a 2023 desde la base de
// noviembre de 2019. Mide:
//  A) error del modelo: con el resultado nacional real de 2023 como "encuesta perfecta";
//  B) error total a 33 días de la elección (como hoy, 27-oct, respecto al 29-N);
//  C) error total con las últimas encuestas publicables (veda desde el 18-jul-2023).
// Escribe data/backtest-2023.json. Uso: node scripts/backtest-2023.js [--n 2000]
import fs from 'node:fs';
import { PROVINCES } from './lib/provinces.js';
import { fetchWikitext, extractTable, parseResultsTable } from './lib/wiki.js';
import { normalizeParty } from './lib/parties-map.js';
import { parseTable, pollAverage, round } from './lib/polls.js';
import { project, noiseSize } from '../src/engine/projection.js';
import { congress } from '../src/engine/congress.js';
import { noisyPoll, mulberry32, VIDEO_NOISE, HISTORICAL_NOISE } from '../src/engine/montecarlo.js';

// Candidato: error de partido mayor (el PSOE falló 5,3 pp a 33 días en 2023).
const NOISES = { video: VIDEO_NOISE, historico: HISTORICAL_NOISE, candidato: { sigmaBloc: 2.0, sigmaParty: 1.5, sigmaProv: 0.08 } };

const N = Number(process.argv[process.argv.indexOf('--n') + 1]) || 2000;
const ELECTION = '2023-07-23';
const CUTOFFS = { B: '2023-06-20', C: '2023-07-17' };

// Oferta de 2019 → 2023.
const MAP_2019 = [
  [/^(Unidas Podemos|En Comú Podem|En Común|Elkarrekin Podemos|Más País|Més Compromís)/, 'SUMAR'],
  [/^Republican Left of Catalonia/, 'ERC'],
  [/^Together for Catalonia/, 'JUNTS'],
  [/^EH Bildu/, 'BILDU'],
  [/^Citizens \(Spanish political party\)/, 'CS'],
  [/^Navarra Suma/, 'UPN'],
  [/^Canarian Coalition/, 'CC'],
  [/^Regionalist Party of Cantabria/, 'PRC'],
];
const map2019 = (x) => {
  for (const [re, id] of MAP_2019) if (x.key && re.test(x.key)) return id;
  const id = normalizeParty(x);
  return id === 'FV' ? 'SUMAR' : id;
};

// --- Base: noviembre de 2019 con los escaños de 2023 -------------------------
const actual = JSON.parse(fs.readFileSync('data/congreso-2023.json', 'utf8')).provinces;
const seats23 = Object.fromEntries(actual.map((p) => [p.id, p.seats]));
const base = [];
for (const p of PROVINCES) {
  const text = await fetchWikitext(`${p.wiki} (Congress of Deputies constituency)`);
  const r = parseResultsTable(extractTable(text, text.search(/\n===\s*November 2019\s*===/)));
  const votes = {};
  for (const x of r.parties) { const id = map2019(x); votes[id] = (votes[id] || 0) + x.votes; }
  base.push({ id: p.id, name: p.name, ccaa: p.ccaa, seats: seats23[p.id], votes, blank: r.blank });
}

// --- Resultado real de 2023 --------------------------------------------------
const realSeats = {};
const realVotes = {};
let realValid = 0;
for (const p of actual) {
  for (const [k, v] of Object.entries(p.elected)) realSeats[k] = (realSeats[k] || 0) + v;
  for (const [k, v] of Object.entries(p.votes)) realVotes[k] = (realVotes[k] || 0) + v;
  realValid += p.valid;
}
const KEYS = ['PP', 'PSOE', 'VOX', 'SUMAR', 'ERC', 'JUNTS', 'BILDU', 'PNV', 'BNG', 'CC', 'CUP'];
const realPoll = Object.fromEntries(KEYS.map((k) => [k, (100 * (realVotes[k] || 0)) / realValid]));
realPoll.PP += (100 * realVotes.UPN) / realValid; // las encuestas dan PP+UPN
realPoll.CS = 0.01; // Cs no se presentó en 2023

// --- Encuestas de 2023 ---------------------------------------------------------
const ptext = await fetchWikitext('Opinion polling for the 2023 Spanish general election');
const sections = ['=====2023 (Podemos', '=====2023 (with Sumar)====='];
const rows = sections.flatMap((s) => parseTable(extractTable(ptext, ptext.indexOf(s)), s, { year: 2023 }))
  .filter((r) => !/general election|exit poll/i.test(r.firm))
  .map((r) => {
    // Antes de la coalición, Podemos aparece aparte: se suma a Sumar.
    const values = { ...r.values };
    if (values.PODEMOS != null) { values.SUMAR = round((values.SUMAR || 0) + values.PODEMOS); delete values.PODEMOS; }
    values.CS = values.CS ?? 0.01;
    return { ...r, values };
  });
const polls = Object.fromEntries(Object.entries(CUTOFFS).map(([k, asOf]) => {
  const { used, values } = pollAverage(rows, { asOf, include: (r) => r.values.SUMAR != null && r.values.PSOE != null });
  return [k, { asOf, n: used.length, values }];
}));

// --- Proyección central y Monte Carlo ------------------------------------------
const BLOC = ['PP', 'VOX', 'UPN'];
const right = (s) => BLOC.reduce((a, p) => a + (s[p] || 0), 0);
function gaussian(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
function mc(poll, noise) {
  const rng = mulberry32(2023);
  const nm = new Float64Array(noiseSize(base));
  const xs = [];
  const party = Object.fromEntries(KEYS.map((k) => [k, []]));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < nm.length; j++) nm[j] = Math.exp(gaussian(rng) * noise.sigmaProv);
    const s = congress(project(base, noisyPoll(poll, rng, noise), { iterations: 10, noise: nm })).national;
    xs.push(right(s));
    for (const k of KEYS) party[k].push(s[k] || 0);
  }
  const q = (arr, f) => [...arr].sort((a, b) => a - b)[Math.floor(f * arr.length)];
  const cover = (arr, v) => q(arr, 0.05) <= v && v <= q(arr, 0.95);
  const r = right(realSeats);
  return {
    derecha: { mean: round(xs.reduce((a, b) => a + b, 0) / N), p05: q(xs, 0.05), p95: q(xs, 0.95), real: r, covered: cover(xs, r), pMajority: xs.filter((x) => x >= 176).length / N },
    partyCoverage: Object.fromEntries(KEYS.map((k) => [k, { p05: q(party[k], 0.05), p95: q(party[k], 0.95), real: realSeats[k] || 0, covered: cover(party[k], realSeats[k] || 0) }])),
  };
}

function evaluate(label, poll) {
  const central = congress(project(base, poll)).national;
  const err = KEYS.map((k) => (central[k] || 0) - (realSeats[k] || 0));
  const out = {
    label,
    poll: Object.fromEntries(Object.entries(poll).map(([k, v]) => [k, round(v)])),
    pollError: Object.fromEntries(['PP', 'PSOE', 'VOX', 'SUMAR'].map((k) => [k, round((poll[k] || 0) - realPoll[k])])),
    central: Object.fromEntries(KEYS.map((k) => [k, central[k] || 0])),
    seatError: Object.fromEntries(KEYS.map((k, i) => [k, err[i]])),
    mae: round(err.reduce((a, e) => a + Math.abs(e), 0) / KEYS.length),
    derecha: { central: right(central), real: right(realSeats), error: right(central) - right(realSeats) },
    montecarlo: Object.fromEntries(Object.entries(NOISES).map(([k, nz]) => [k, mc(poll, nz)])),
  };
  console.log(`\n${label}`);
  console.log('  encuesta − real (pp):', JSON.stringify(out.pollError));
  console.log('  escaños central:', JSON.stringify(out.central));
  console.log('  error por partido:', JSON.stringify(out.seatError), `· error medio absoluto ${out.mae}`);
  console.log(`  derecha: central ${out.derecha.central} vs real ${out.derecha.real} (${out.derecha.error >= 0 ? '+' : ''}${out.derecha.error})`);
  const miss = (m) => Object.entries(m.partyCoverage).filter(([, v]) => !v.covered).map(([k, v]) => `${k} (${v.p05}–${v.p95}, real ${v.real})`);
  for (const [k, m] of Object.entries(out.montecarlo)) {
    const d = m.derecha;
    console.log(`  MC ${k.padEnd(10)} derecha 90 % ${d.p05}–${d.p95}, P(≥176) ${(100 * d.pMajority).toFixed(0)} %, real dentro: ${d.covered ? 'sí' : 'NO'} · partidos fuera del 90 %: ${miss(m).join(', ') || 'ninguno'}`);
  }
  return out;
}

const result = {
  method: 'Base nov-2019 por provincia → oferta 2023 (UP+Más País+Compromís = Sumar; Cs desaparece; NA+ = UPN) → swing proporcional IPF a la encuesta → D\'Hondt con escaños de 2023.',
  election: ELECTION,
  real: { seats: Object.fromEntries(KEYS.map((k) => [k, realSeats[k] || 0])), derecha: right(realSeats), poll: Object.fromEntries(Object.entries(realPoll).map(([k, v]) => [k, round(v)])) },
  A: evaluate('A · Encuesta perfecta (resultado nacional real de 2023): error del modelo', realPoll),
  B: evaluate(`B · Media de encuestas a ${CUTOFFS.B} (33 días antes, ${polls.B.n} empresas): error total "si fuera hoy"`, polls.B.values),
  C: evaluate(`C · Media de encuestas a ${CUTOFFS.C} (últimas publicables, ${polls.C.n} empresas)`, polls.C.values),
};
fs.writeFileSync('data/backtest-2023.json', JSON.stringify(result, null, 1));
console.log('\n→ data/backtest-2023.json');
