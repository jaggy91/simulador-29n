// Monte Carlo: incertidumbre de encuesta (bloque, partido, provincia) y escenarios
// activados al azar según su probabilidad.
import { project, noiseSize } from './projection.js';
import { congress } from './congress.js';
import { applyCongressScenarios, projectSenate, RIGHT } from './model.js';
import { optimizeExtraVotes } from './scenarios.js';
import { BLOCS, MAJORITY } from './blocs.js';

// σ en puntos porcentuales. sigmaBloc: error común que traslada voto entre derecha e
// izquierda (el error típico de las encuestas). sigmaParty: error propio de cada
// partido, escalado por √(cuota/10). sigmaProv: error relativo provincia × partido.
// VIDEO_NOISE: dispersión de ±9 escaños (1σ) en la derecha, la que implica el vídeo de
// referencia; reproduce sus cifras del Senado (media: P(3/5) ≈ 6 %; CIS: 0 %).
// HISTORICAL_NOISE (por defecto): validado con el backtest 2019→2023
// (scripts/backtest-2023.js): con él, el resultado real de la derecha en 2023 cae
// dentro del intervalo del 90 % a 33 días, en la última semana y con encuesta
// perfecta; con VIDEO_NOISE queda en el borde. Ninguno cubre el fallo de las
// encuestas con el PSOE a 33 días (−5,3 pp), un evento de cola.
export const VIDEO_NOISE = { sigmaBloc: 1.5, sigmaParty: 0.75, sigmaProv: 0.06 };
export const HISTORICAL_NOISE = { sigmaBloc: 2.0, sigmaParty: 1.0, sigmaProv: 0.08 };
export const DEFAULT_NOISE = HISTORICAL_NOISE;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const LEFT = BLOCS.investidura;

export function noisyPoll(poll, rng, { sigmaBloc, sigmaParty }) {
  const out = {};
  const sum = (ps) => ps.reduce((a, p) => a + (poll[p] || 0), 0);
  const tr = sum(RIGHT);
  const tl = sum(LEFT);
  const swing = gaussian(rng) * sigmaBloc;
  for (const [p, v] of Object.entries(poll)) {
    let x = v + gaussian(rng) * sigmaParty * Math.sqrt(v / 10);
    if (RIGHT.includes(p) && tr) x += (swing * v) / tr;
    if (LEFT.includes(p) && tl) x -= (swing * v) / tl;
    out[p] = Math.max(0.05, x);
  }
  return out;
}


// scenarios: [{...escenario, prob}] (prob 1 = siempre; 0 = nunca).
// exterior: 'techo' = los votos extra se recolocan de forma óptima en cada iteración
// (información perfecta, el supuesto del vídeo); 'fijo' = se colocan una vez sobre la
// proyección central, como haría alguien antes de conocer el resultado.
export function simulate(prep, poll, scenarios, { n = 5000, seed = 29112026, noise = DEFAULT_NOISE, iterations = 10, exterior = 'techo' } = {}) {
  const rng = mulberry32(seed);
  const live = scenarios.filter((s) => s.prob > 0 && s.kind !== 'base');
  const central = exterior === 'fijo' ? project(prep.congressBase, poll) : null;
  const fixed = live.map((s) => {
    if (s.kind !== 'extra-votes' || s.params.mode !== 'techo') return s;
    if (exterior === 'techo') return { ...s, params: { ...s.params, unit: 100 } };
    const { extra } = optimizeExtraVotes(central, { party: s.params.party, budget: s.params.budget, allies: BLOCS.investidura });
    return { ...s, params: { ...s.params, mode: 'fijo', extra } };
  });

  const provNoise = new Float64Array(noiseSize(prep.congressBase));
  const seatSum = {};
  const partyHist = {};
  const seatHist = { derecha: [], investidura: [], senadoDerecha: [] };
  let rightMaj = 0, juntsKey = 0, senateMaj = 0, senate35 = 0;
  const activeCount = Object.fromEntries(fixed.map((s) => [s.id, 0]));
  for (let i = 0; i < n; i++) {
    const active = fixed.filter((s) => s.prob >= 1 || rng() < s.prob);
    for (const s of active) activeCount[s.id]++;
    if (noise.sigmaProv) for (let j = 0; j < provNoise.length; j++) provNoise[j] = Math.exp(gaussian(rng) * noise.sigmaProv);
    const projected = project(prep.congressBase, noisyPoll(poll, rng, noise), { iterations, noise: noise.sigmaProv ? provNoise : null });
    const provinces = applyCongressScenarios(projected, active, prep);
    const c = congress(provinces);
    // El Senado se mueve con la proyección (incluido el ruido provincial) frente a la
    // base limpia, antes de las retiradas de listas, que son solo del Congreso.
    const s = projectSenate(prep, projected, active);
    for (const [k, v] of Object.entries(c.national)) seatSum[k] = (seatSum[k] || 0) + v;
    for (const k of Object.keys(seatSum)) (partyHist[k] ||= new Array(i).fill(0)).push(c.national[k] || 0);
    seatHist.derecha.push(c.blocs.derecha);
    seatHist.investidura.push(c.blocs.investidura);
    seatHist.senadoDerecha.push(s.right);
    if (c.blocs.derecha >= MAJORITY) rightMaj++;
    // Junts decisivo: ni la derecha ni la investidura suman 176 solas, pero sí con Junts.
    else if (c.blocs.investidura < MAJORITY && c.blocs.investidura + c.blocs.junts >= MAJORITY) juntsKey++;
    if (s.right >= s.majority) senateMaj++;
    if (s.right >= s.threeFifths) senate35++;
  }
  const mean = Object.fromEntries(Object.entries(seatSum).map(([k, v]) => [k, Math.round((10 * v) / n) / 10]));
  return {
    n,
    seats: mean,
    seatIntervals: Object.fromEntries(Object.entries(partyHist).filter(([k]) => seatSum[k] / n >= 0.5).map(([k, xs]) => [k, summary(xs)])),
    blocs: { derecha: summary(seatHist.derecha), investidura: summary(seatHist.investidura), senadoDerecha: summary(seatHist.senadoDerecha) },
    prob: { mayoriaDerecha: rightMaj / n, juntsDecisivo: juntsKey / n, senadoMayoriaDerecha: senateMaj / n, senado35Derecha: senate35 / n },
    scenarioFrequency: Object.fromEntries(Object.entries(activeCount).map(([k, v]) => [k, v / n])),
  };
}

function summary(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { mean: Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10, p05: q(0.05), p50: q(0.5), p95: q(0.95) };
}
