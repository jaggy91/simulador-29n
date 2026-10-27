// Espectro izquierda ↔ derecha: 5 niveles por lado. Cada nivel añade un escenario
// favorable a ese bloque, de más plausible a menos (acumulativo). El nivel 0 es la
// proyección oficial. Es un laboratorio: no entra en la proyección ni en el historial.
import { BLOCS } from './blocs.js';

// Error de las encuestas de 2023 a 33 días de la votación (real − encuesta, pp):
// backtest 2019→2023 (data/backtest-2023.json). Sumar 2023 → FA.
export const ERROR_2023 = { PSOE: 5.31, PP: -0.29, VOX: -1.86, FA: -0.85 };

export const LEVERS = {
  izquierda: [
    {
      id: 'ENC_PSOE_40', level: 1,
      label: 'Las encuestas infravaloran al PSOE como en 2023 (40 % de aquel fallo)',
      detail: 'PSOE +2,1 pts; Vox −0,7; FA −0,3; PP −0,1. El resto de partidos cede lo que falta en proporción a su voto.',
      ops: [{ op: 'poll-error', vector: ERROR_2023, scale: 0.4 }],
    },
    {
      id: 'UTIL_FA_PSOE', level: 2,
      label: 'Voto útil: el 30 % del voto del Frente Amplio va al PSOE en las 29 provincias de 5 escaños o menos',
      detail: 'Sustituye a la retirada de listas, que ya no es posible tras el cierre de candidaturas.',
      ops: [{ op: 'scenario', scenario: { id: 'VOTO_UTIL_IZQ', kind: 'transfer', prob: 1, params: { from: 'FA', to: 'PSOE', where: 'small5', fraction: 0.3 } } }],
    },
    {
      id: 'PACTO_FLOJO', level: 3,
      label: 'El pacto PP–Vox del Senado funciona mal: solo el 60 % de sus votantes sigue la consigna',
      detail: 'Afecta solo al Senado (85 % en la proyección oficial).',
      ops: [{ op: 'pact-share', share: 0.6 }],
    },
    {
      id: 'ENC_PSOE_100', level: 4, replaces: 'ENC_PSOE_40',
      label: 'Se repite el fallo completo de las encuestas de 2023',
      detail: 'PSOE +5,3 pts; Vox −1,9; FA −0,9; PP −0,3 (sustituye al nivel 1).',
      ops: [{ op: 'poll-error', vector: ERROR_2023, scale: 1 }],
    },
    {
      id: 'EXTERIOR_TECHO', level: 5, hypothetical: true,
      label: 'Hipotético: 37.000 votos exteriores extra al PSOE colocados donde más escaños mueven',
      detail: 'Supuesto del vídeo ("tormenta perfecta"). Con el reparto real del censo exterior, ese volumen apenas mueve escaños; el Supremo mantiene suspendido el voto de 163.020 nacionalizados.',
      ops: [{ op: 'scenario', scenario: { id: 'VOTO_EXTERIOR', kind: 'extra-votes', prob: 1, params: { mode: 'techo', party: 'PSOE', budget: 37000 } } }],
    },
  ],
  derecha: [
    {
      id: 'ENC_DCHA_2', level: 1,
      label: 'Las encuestas infravaloran a la derecha: +2 pts de la investidura a PP + Vox',
      detail: 'Traslado proporcional entre bloques (es el tamaño típico del error de bloque).',
      ops: [{ op: 'bloc-swing', pts: 2 }],
    },
    {
      id: 'UTIL_VOX_PP', level: 2,
      label: 'Voto útil: el 30 % del voto de Vox va al PP en las 29 provincias de 5 escaños o menos',
      detail: 'Concentra el voto de la derecha donde un escaño se decide por pocos votos.',
      ops: [{ op: 'scenario', scenario: { id: 'VOTO_UTIL_DCHA', kind: 'transfer', prob: 1, params: { from: 'VOX', to: 'PP', where: 'small5', fraction: 0.3 } } }],
    },
    {
      id: 'PACTO_PLENO_SALF', level: 3,
      label: 'El pacto PP–Vox funciona al 100 % y SALF se hunde a favor de Vox y PP',
      detail: 'Consigna seguida por todos (Senado); el 50 % del voto de SALF va a Vox, el 30 % al PP y el resto se abstiene.',
      ops: [{ op: 'pact-share', share: 1 }, { op: 'move', from: 'SALF', to: { VOX: 0.5, PP: 0.3 } }],
    },
    {
      id: 'DESMOV_IZQ', level: 4,
      label: 'Desmovilización a la izquierda del PSOE: FA, FV y Podemos pierden un 25 % de su voto',
      detail: 'Ese voto se va a la abstención.',
      ops: [{ op: 'scale', parties: ['FA', 'FV', 'PODEMOS'], factor: 0.75 }],
    },
    {
      id: 'ENC_DCHA_4', level: 5, replaces: 'ENC_DCHA_2',
      label: 'Error grande de las encuestas a favor de la derecha: +4 pts',
      detail: 'Sustituye al nivel 1.',
      ops: [{ op: 'bloc-swing', pts: 4 }],
    },
  ],
};

const sum = (o, ks) => ks.reduce((a, k) => a + (o[k] || 0), 0);
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// Traslada `pts` puntos de la investidura a la derecha (negativo: al revés), en
// proporción al peso de cada partido dentro de su bloque.
export function swingPoll(poll, pts) {
  if (!pts) return poll;
  const tr = sum(poll, BLOCS.derecha);
  const tl = sum(poll, BLOCS.investidura);
  return Object.fromEntries(Object.entries(poll).map(([p, v]) => [p,
    BLOCS.derecha.includes(p) ? v + (pts * v) / tr : BLOCS.investidura.includes(p) ? Math.max(0.05, v - (pts * v) / tl) : v]));
}

// Mantiene la suma de la encuesta: lo que sale a la abstención sube a todos en proporción.
function rescale(poll, target) {
  const t = total(poll);
  return Object.fromEntries(Object.entries(poll).map(([k, v]) => [k, (v * target) / t]));
}

function applyPollOp(poll, op) {
  const T = total(poll);
  if (op.op === 'bloc-swing') return swingPoll(poll, op.pts);
  if (op.op === 'poll-error') {
    const out = { ...poll };
    let delta = 0;
    for (const [k, e] of Object.entries(op.vector)) {
      const next = Math.max(0.05, (out[k] || 0) + e * op.scale);
      delta += next - (out[k] || 0);
      out[k] = next;
    }
    const rest = Object.keys(out).filter((k) => !(k in op.vector));
    const tr = sum(out, rest);
    for (const k of rest) out[k] = Math.max(0.05, out[k] - (delta * out[k]) / tr);
    return out;
  }
  if (op.op === 'scale') {
    const out = { ...poll };
    for (const k of op.parties) if (out[k] != null) out[k] *= op.factor;
    return rescale(out, T);
  }
  if (op.op === 'move') {
    const out = { ...poll };
    const v = out[op.from] || 0;
    for (const [k, f] of Object.entries(op.to)) out[k] = (out[k] || 0) + v * f;
    out[op.from] = 0.05;
    return rescale(out, T);
  }
  return poll;
}

// Escenarios activos en un nivel (−5…+5), con los sustituidos ya descartados.
export function activeLevers(level) {
  if (!level) return [];
  const side = level < 0 ? 'izquierda' : 'derecha';
  const list = LEVERS[side].filter((l) => l.level <= Math.abs(level));
  const replaced = new Set(list.map((l) => l.replaces).filter(Boolean));
  return list.filter((l) => !replaced.has(l.id));
}

// Encuesta y escenarios para un nivel, a partir de los oficiales.
export function levelInputs(level, poll, scenarios) {
  let p = { ...poll };
  let sc = scenarios.map((s) => (s.params ? { ...s, params: { ...s.params } } : { ...s }));
  const levers = activeLevers(level);
  for (const l of levers) {
    for (const op of l.ops) {
      if (op.op === 'scenario') {
        sc = sc.filter((s) => s.id !== op.scenario.id).concat({ ...op.scenario, params: { ...op.scenario.params } });
      } else if (op.op === 'pact-share') {
        sc = sc.map((s) => (s.kind === 'senate-pact' ? { ...s, params: { ...s.params, share: op.share } } : s));
      } else {
        p = applyPollOp(p, op);
      }
    }
  }
  return { poll: p, scenarios: sc, active: levers.map((l) => l.id) };
}

// Puntos de vuelco: primer nivel, desde el centro, en que un resultado pasa a ser más
// probable que su contrario (probabilidad del Monte Carlo ≥ 50 %). Se usan
// probabilidades y no la proyección central porque D'Hondt hace que la central salte a
// escalones: un escaño ganado por pocos votos en varias provincias la aleja de la media.
// levels: [{level, montecarlo: {prob}}] de −5 a +5. null = no ocurre ni en el extremo.
export function tippingPoints(levels) {
  const prob = (l) => levels.find((x) => x.level === l)?.montecarlo.prob;
  const first = (dir, test) => {
    for (let i = 0; i <= 5; i++) if (test(prob(dir * i))) return dir * i;
    return null;
  };
  return {
    derechaPierde: first(-1, (p) => p.mayoriaDerecha < 0.5),
    derechaGana: first(1, (p) => p.mayoriaDerecha >= 0.5),
    investiduraSola: first(-1, (p) => p.investiduraSola >= 0.5),
    investiduraConJunts: first(-1, (p) => p.investiduraConJunts >= 0.5),
  };
}
