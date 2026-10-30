// Precalcula el espectro izquierda ↔ derecha (niveles −4…+4) para cada fuente de
// encuesta y lo escribe en data/spectrum.json. Separado de la proyección oficial:
// no toca state.json ni history.json. Uso: node scripts/spectrum.js [--n 2000]
import { loadModelData, writeJSON } from './lib/load-data.js';
import { loadInputs } from './lib/inputs.js';
import { prepare, run } from '../src/engine/model.js';
import { simulate } from '../src/engine/montecarlo.js';
import { LEVERS, MAX_LEVEL, levelInputs, tippingPoints } from '../src/engine/spectrum.js';

const n = Number(process.argv[process.argv.indexOf('--n') + 1]) || 2000;
const prep = prepare(loadModelData());
// Parte del resultado con las fuentes activas por defecto.
const { polls, inputs } = loadInputs();
const base = inputs();
const scenarios = base.scenarios;

const sources = {};
for (const [key, src] of Object.entries(polls.sources)) {
  const poll = base.polls[key];
  const levels = [];
  for (let level = -MAX_LEVEL; level <= MAX_LEVEL; level++) {
    const input = levelInputs(level, poll, scenarios);
    const certain = input.scenarios.filter((s) => s.prob >= 1 && s.kind !== 'base');
    const c = run(prep, input.poll, certain);
    const mc = simulate(prep, input.poll, input.scenarios, { n });
    levels.push({
      level,
      active: input.active,
      skipped: input.skipped,
      poll: Object.fromEntries(Object.entries(input.poll).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      central: {
        congress: c.congress.national,
        blocs: c.congress.blocs,
        senate: { total: c.senate.total, right: c.senate.right, size: c.senate.size, majority: c.senate.majority, threeFifths: c.senate.threeFifths },
      },
      montecarlo: { blocs: mc.blocs, prob: mc.prob },
    });
    const b = c.congress.blocs;
    console.log(`${src.label.padEnd(32)} ${String(level).padStart(3)}  dcha ${b.derecha} inv ${b.investidura} junts ${b.junts} · P(dcha) ${(100 * mc.prob.mayoriaDerecha).toFixed(1)} % · Senado dcha ${c.senate.right}`);
  }
  // Un nivel que, en esta fuente, perjudica al lado que dice favorecer (D'Hondt puede
  // hacerlo): P(mayoría de la derecha) se mueve al revés más de 1 punto respecto al
  // nivel anterior hacia el centro.
  for (const l of levels) {
    if (!l.level) continue;
    const prev = levels.find((x) => x.level === l.level - Math.sign(l.level));
    const d = l.montecarlo.prob.mayoriaDerecha - prev.montecarlo.prob.mayoriaDerecha;
    l.contrary = Math.sign(l.level) * d < -0.01;
  }
  sources[key] = { label: src.label, levels, tipping: tippingPoints(levels) };
  console.log('  vuelco:', JSON.stringify(sources[key].tipping));
}

writeJSON('spectrum', {
  updated: new Date().toISOString(),
  latestPoll: polls.latestPoll,
  note: 'Laboratorio: escenarios acumulativos favorables a cada bloque. No forma parte de la proyección oficial.',
  maxLevel: MAX_LEVEL,
  levers: LEVERS,
  sources,
});
console.log('→ data/spectrum.json');
