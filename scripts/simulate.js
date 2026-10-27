// Corre el modelo con las encuestas y escenarios vigentes y escribe:
//  - data/state.json: proyección central, Monte Carlo y escaños en el aire por fuente.
//  - data/history.json: un punto por ejecución si algo ha cambiado.
// Uso: node scripts/simulate.js [--n 5000]
import { loadModelData, readJSON, writeJSON } from './lib/load-data.js';
import { prepare, run } from '../src/engine/model.js';
import { simulate } from '../src/engine/montecarlo.js';
import { marginalSeats } from '../src/engine/scenarios.js';

const n = Number(process.argv[process.argv.indexOf('--n') + 1]) || 5000;
const prep = prepare(loadModelData());
const polls = readJSON('polls');
const { scenarios } = readJSON('scenarios');
// Los escenarios con prob 1 entran siempre en la proyección central; el resto solo
// en el Monte Carlo según su probabilidad.
const certain = scenarios.filter((s) => s.prob >= 1 && s.kind !== 'base');

const results = {};
for (const [key, src] of Object.entries(polls.sources)) {
  const central = run(prep, src.values, certain);
  const mc = simulate(prep, src.values, scenarios, { n });
  results[key] = {
    label: src.label,
    poll: src.values,
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

const now = new Date().toISOString();
const state = {
  updated: now,
  latestPoll: polls.latestPoll,
  scenarios: scenarios.map(({ id, label, status, prob }) => ({ id, label, status, prob })),
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
  scenarios: Object.fromEntries(scenarios.map((s) => [s.id, s.prob])),
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
console.log('→ data/state.json');
