// Corre el modelo con las fuentes activas por defecto y escribe:
//  - data/state.json: resultado central, Monte Carlo y escaños en el aire por fuente.
//  - data/sources.json: las tarjetas de fuentes (noticias, datos oficiales y encuestas)
//    con su estado por defecto y su efecto (resultado con y sin cada tarjeta).
//  - data/history.json: un punto por ejecución si algo ha cambiado.
// Uso: node scripts/simulate.js [--n 5000] [--impact-n 1000]
import { loadModelData, readJSON, writeJSON } from './lib/load-data.js';
import { loadInputs } from './lib/inputs.js';
import { prepare, run } from '../src/engine/model.js';
import { simulate } from '../src/engine/montecarlo.js';
import { marginalSeats } from '../src/engine/scenarios.js';

const arg = (k, d) => (process.argv.includes(k) ? Number(process.argv[process.argv.indexOf(k) + 1]) : d);
const n = arg('--n', 5000);
const impactN = arg('--impact-n', 1000);
const prep = prepare(loadModelData());
const { catalog, news, polls, pollCards, active, toggleable, inputs } = loadInputs();
const base = inputs();
// Los escenarios con prob 1 entran siempre en el resultado central; el resto solo
// en el Monte Carlo según su probabilidad.
const certain = (sc) => sc.filter((s) => s.prob >= 1 && s.kind !== 'base');

const results = {};
for (const [key, src] of Object.entries(polls.sources)) {
  const poll = base.polls[key];
  const central = run(prep, poll, certain(base.scenarios));
  const mc = simulate(prep, poll, base.scenarios, { n });
  results[key] = {
    label: src.label,
    poll,
    central: {
      congress: central.congress.national,
      blocs: central.congress.blocs,
      senate: { elected: central.senate.elected, total: central.senate.total, right: central.senate.right, size: central.senate.size, majority: central.senate.majority, threeFifths: central.senate.threeFifths },
      byProvince: central.congress.byProvince,
    },
    montecarlo: mc,
    seatsInPlay: marginalSeats(central.provinces, { limit: 25 }),
  };
  console.log(`${src.label}: derecha ${central.congress.blocs.derecha} (MC ${mc.blocs.derecha.mean}), P(mayoría) ${(100 * mc.prob.mayoriaDerecha).toFixed(1)} %, Senado 3/5 ${(100 * mc.prob.senado35Derecha).toFixed(1)} %`);
}

// --- Efecto de cada tarjeta: con el resto por defecto, se activa o desactiva solo esa.
// Misma semilla en ambos cálculos, para que la diferencia sea el efecto y no ruido.
function summary(input, key) {
  const poll = input.polls[key];
  const c = run(prep, poll, certain(input.scenarios));
  const mc = simulate(prep, poll, input.scenarios, { n: impactN });
  return { derecha: mc.blocs.derecha.mean, pMayoria: mc.prob.mayoriaDerecha, senado: c.senate.right };
}
const keys = Object.keys(polls.sources);
const ref = Object.fromEntries(keys.map((k) => [k, summary(base, k)]));
const impact = {};
for (const id of toggleable) {
  const alt = new Set(active);
  if (alt.has(id)) alt.delete(id); else alt.add(id);
  const altIn = inputs(alt);
  impact[id] = {};
  for (const k of keys) {
    const s = summary(altIn, k);
    // Signo: efecto de que la tarjeta esté ACTIVA frente a no estarlo.
    const sign = active.has(id) ? -1 : 1;
    impact[id][k] = {
      derecha: Math.round(10 * sign * (s.derecha - ref[k].derecha)) / 10,
      pMayoria: Math.round(1000 * sign * (s.pMayoria - ref[k].pMayoria)) / 1000,
      senado: sign * (s.senado - ref[k].senado),
    };
  }
}

const cards = [
  ...news.map((c) => ({
    ...c,
    toggleable: toggleable.includes(c.id),
    defaultActive: active.has(c.id),
    overriddenBy: base.overriddenBy[c.id] ?? (active.has(c.id) ? null : inputs(new Set([...active, c.id])).overriddenBy[c.id] ?? null),
    impact: impact[c.id] ?? null,
  })),
  ...pollCards.map((c) => ({ ...c, toggleable: true, defaultActive: true, overriddenBy: null, impact: impact[c.id] })),
];
writeJSON('sources', { updated: new Date().toISOString(), impactN, cards });
for (const c of cards.filter((c) => c.impact)) {
  const m = c.impact.media;
  console.log(`  ${c.defaultActive ? '●' : '○'} ${(c.title || c.firm).slice(0, 70).padEnd(70)} dcha ${m.derecha >= 0 ? '+' : ''}${m.derecha} · Senado ${m.senado >= 0 ? '+' : ''}${m.senado}`);
}

const now = new Date().toISOString();
const state = {
  updated: now,
  latestPoll: polls.latestPoll,
  scenarios: base.scenarios.map(({ id, label, status, prob, appliedBy }) => ({ id, label, status, prob, appliedBy })),
  results,
};
writeJSON('state', state);

// Historial: solo si cambia algún resultado resumido.
const history = readJSON('history', []);
const point = {
  t: now,
  latestPoll: polls.latestPoll,
  ...Object.fromEntries(Object.entries(results).map(([k, r]) => [k, {
    derecha: r.montecarlo.blocs.derecha.mean,
    investidura: r.montecarlo.blocs.investidura.mean,
    pMayoriaDerecha: r.montecarlo.prob.mayoriaDerecha,
    pJunts: r.montecarlo.prob.juntsDecisivo,
    pSenado35: r.montecarlo.prob.senado35Derecha,
  }])),
  scenarios: Object.fromEntries(base.scenarios.map((s) => [s.id, s.prob])),
  sources: [...active].sort(),
};
const last = history[history.length - 1];
const strip = ({ t, ...rest }) => JSON.stringify(rest);
if (!last || strip(last) !== strip(point)) {
  history.push(point);
  writeJSON('history', history);
  console.log(`history.json: ${history.length} puntos`);
} else {
  console.log('Sin cambios: history.json no se toca');
}
console.log('→ data/state.json, data/sources.json');
