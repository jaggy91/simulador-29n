// Prueba de estrés y análisis de sensibilidad de METODOLOGIA.md (§0, §6 y §7), para que
// cada cifra se pueda reproducir. Parte de las fuentes activas por defecto y cambia un
// solo supuesto o parámetro cada vez. Escribe data/sensitivity.json (usa encuestas: no
// se publica durante la veda).
// Uso: node scripts/sensitivity.js [--n 2000]
import { loadModelData, writeJSON } from './lib/load-data.js';
import { loadInputs } from './lib/inputs.js';
import { prepare, run } from '../src/engine/model.js';
import { DEFAULT_REMAP } from '../src/engine/remap.js';
import { simulate, VIDEO_NOISE } from '../src/engine/montecarlo.js';
import { LEVERS, levelInputs } from '../src/engine/spectrum.js';

const n = Number(process.argv[process.argv.indexOf('--n') + 1]) || 2000;
const data = loadModelData();
const prep = prepare(data);
const { polls, inputs } = loadInputs();
const base = inputs();
const certain = (sc) => sc.filter((s) => s.prob >= 1 && s.kind !== 'base');
const sources = Object.keys(polls.sources);
const RIGHT = ['PP', 'VOX', 'UPN'];
const right = (seats) => RIGHT.reduce((a, p) => a + (seats?.[p] || 0), 0);
const summary = (r) => ({ derecha: r.congress.blocs.derecha, investidura: r.congress.blocs.investidura, senado: r.senate.right });
const withParams = (id, params) => base.scenarios.map((s) => (s.id === id ? { ...s, params: { ...s.params, ...params } } : s));
const central = (sc, key, p = prep, opts) => summary(run(p, base.polls[key], certain(sc), opts));
const bySource = (f) => Object.fromEntries(sources.map((k) => [k, f(k)]));

// --- Prueba de estrés: el error de la media de encuestas de 2023 a 33 días, solo ----
const errorLever = LEVERS.izquierda.find((l) => l.id === 'ENC_PSOE_100');
const stress = bySource((k) => {
  const saved = LEVERS.izquierda.splice(0, LEVERS.izquierda.length, { ...errorLever, level: 1, replaces: undefined });
  const inp = levelInputs(-1, base.polls[k], base.scenarios);
  LEVERS.izquierda.splice(0, LEVERS.izquierda.length, ...saved);
  return { base: central(base.scenarios, k), error2023: summary(run(prep, inp.poll, certain(inp.scenarios))) };
});

// --- Supuestos y parámetros, uno a uno ----------------------------------------------
const rows = [];
const row = (id, label, value, alternatives) => rows.push({ id, label, value, alternatives });

row('compromisShare', 'Fracción del resto de Sumar 2023 que va a Compromís–FV', 0.85,
  [0.5, 1].map((v) => {
    DEFAULT_REMAP.compromisShare = v;
    const p = prepare(data);
    DEFAULT_REMAP.compromisShare = 0.85;
    return { value: v, result: bySource((k) => central(base.scenarios, k, p)) };
  }));
row('teruelShare', 'Voto del FA en Teruel que va al PSOE', 0.5,
  [0, 1].map((v) => ({ value: v, result: bySource((k) => central(withParams('TERUEL_sin_FA_CHA', { share: v }), k)) })));
row('othersCap', 'Partidos sin dato en la encuesta: tope en su cuota de 2023', 'tope',
  [{ value: 'proporcional', result: bySource((k) => central(base.scenarios, k, prep, { othersCap: false })) }]);
row('nonFollowers', 'Quien no apoya una lista conjunta al Senado', 'propios',
  [{ value: 'abstencion', result: bySource((k) => central(withParams('SENADO_PROGRESO', { nonFollowers: 'abstencion' }).map((s) => (s.id === 'PACTO_PP_VOX_SENADO' ? { ...s, params: { ...s.params, nonFollowers: 'abstencion' } } : s)), k)) }]);
row('partnerCandidates', 'Candidatos del socio en las listas de Senado de Progreso', 1,
  [{ value: 0, result: bySource((k) => central(withParams('SENADO_PROGRESO', { partnerCandidates: 0 }), k)) }]);
row('data10', 'Seguimiento de las listas conjuntas (Data 10)', 'Data 10',
  [{ value: '100 %', result: bySource((k) => central(withParams('SENADO_PROGRESO', { intoShare: 1, share: 1 }).map((s) => (s.id === 'PACTO_PP_VOX_SENADO' ? { ...s, params: { ...s.params, sharePP: 1, shareVox: 1 } } : s)), k)) }]);
row('senadoProgreso60', 'Circunscripciones de Senado de Progreso', '50 posibles',
  [{ value: 'las 60', result: bySource((k) => central(withParams('SENADO_PROGRESO', { excludeCcaa: [], includeIds: [] }), k)) }]);

// Las 3 circunscripciones de las 50 posibles que faltan para las 47 de las fuentes: el
// reparto del Senado es independiente por circunscripción, así que basta con el efecto
// de quitar la lista conjunta en cada una y sumar los 3 menores o los 3 mayores.
const mergeRange = bySource((k) => {
  const sc = certain(base.scenarios);
  const merge = sc.find((s) => s.kind === 'senate-merge');
  const a = run(prep, base.polls[k], sc).senate.byConstituency;
  const b = run(prep, base.polls[k], sc.filter((s) => s !== merge)).senate.byConstituency;
  const p = merge.params;
  const eligible = prep.senateBase.filter((c) => !(p.excludeCcaa.includes(c.ccaa) && !p.includeIds.includes(c.id)));
  const d = eligible.map((c) => right(b[c.id]) - right(a[c.id])).sort((x, y) => x - y);
  return { eligible: eligible.length, min: d.slice(0, 3).reduce((x, y) => x + y, 0), max: d.slice(-3).reduce((x, y) => x + y, 0) };
});

// Ruido del Monte Carlo y Coalición Canaria (probabilidades, n simulaciones).
const noise = bySource((k) => {
  const h = simulate(prep, base.polls[k], base.scenarios, { n });
  const v = simulate(prep, base.polls[k], base.scenarios, { n, noise: VIDEO_NOISE });
  return { historico: h.prob.mayoriaDerecha, video: v.prob.mayoriaDerecha, conCC: h.prob.mayoriaDerechaConCC };
});

writeJSON('sensitivity', { updated: new Date().toISOString(), latestPoll: polls.latestPoll, n, base: bySource((k) => central(base.scenarios, k)), stress, rows, mergeRange, noise });

const fmt = (r) => `${r.derecha}/${r.senado}`;
console.log('Base (derecha Congreso/Senado):', sources.map((k) => `${k} ${fmt(stress[k].base)}`).join(' · '));
console.log('Estrés (error 2023):', sources.map((k) => `${k} ${fmt(stress[k].error2023)} inv ${stress[k].error2023.investidura}`).join(' · '));
for (const r of rows) for (const a of r.alternatives) console.log(`${r.id} = ${a.value}:`, sources.map((k) => `${k} ${fmt(a.result[k])}`).join(' · '));
console.log('Senado de Progreso, 3 menos:', JSON.stringify(mergeRange));
console.log('Ruido y CC:', JSON.stringify(noise));
console.log('→ data/sensitivity.json');
