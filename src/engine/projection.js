// Proyección provincial a partir de una encuesta nacional: swing proporcional con
// ajuste iterativo (IPF). Cada partido se escala por un factor nacional, cada provincia
// se renormaliza a sus votos válidos de 2023 (participación constante) y los factores
// se corrigen hasta que el total nacional coincide con la encuesta.
//
// poll: {partido: % sobre válidos}. Lo que la encuesta no asigna (100 − suma) cubre a
// los partidos sin dato en ella ("otros": regionales pequeños) y al voto en blanco.
// Regla por defecto (`othersCap`): los "otros" no crecen por encima de su cuota de
// 2023. Si la encuesta deja más, el excedente no tiene dueño conocido (el CIS, por
// ejemplo, estima «otros partidos» sin repartirlos) y va con el blanco a un grupo sin
// escaño; si deja menos, otros y blanco bajan en la misma proporción. Escalarlo todo
// junto concentraría ese excedente en los regionalistas y les daría escaños sin dato.
// groups: claves de encuesta que agrupan varios partidos con el mismo factor
// (las encuestas dan PP+UPN juntos).
export const POLL_GROUPS = { PP: ['PP', 'UPN'] };

// La base se compila una vez a matrices (provincia × partido) para el Monte Carlo.
const compiled = new WeakMap();
function compile(base) {
  if (compiled.has(base)) return compiled.get(base);
  const parties = [...new Set(base.flatMap((p) => Object.keys(p.votes)))];
  const idx = Object.fromEntries(parties.map((p, i) => [p, i]));
  const K = parties.length;
  const votes = new Float64Array(base.length * K);
  const blank = new Float64Array(base.length);
  const valid = new Float64Array(base.length);
  base.forEach((p, i) => {
    for (const [k, v] of Object.entries(p.votes)) votes[i * K + idx[k]] = v;
    blank[i] = p.blank || 0;
    valid[i] = Object.values(p.votes).reduce((a, b) => a + b, 0) + blank[i];
  });
  const present = new Set(parties.filter((p, k) => base.some((_, i) => votes[i * K + k] > 0)));
  const c = { parties, present, K, votes, blank, valid, totalValid: valid.reduce((a, b) => a + b, 0) };
  compiled.set(base, c);
  return c;
}

// opts.noise: Float64Array opcional (provincia × partido) de multiplicadores aleatorios.
export function project(base, poll, { groups = POLL_GROUPS, iterations = 30, noise = null, othersCap = true } = {}) {
  const { parties, present, K, votes, blank, valid, totalValid } = compile(base);
  const N = base.length;
  // Un partido al 0 % es un objetivo (queda sin votos), no parte de "otros". Una clave
  // sin votos en la base (p. ej. una columna de encuesta sin mapear) no se puede
  // alcanzar: su porcentaje pasa a lo no asignado.
  const keys = Object.keys(poll).filter((k) => poll[k] >= 0 && (groups[k] || [k]).some((p) => present.has(p)));
  const G = keys.length + 2;
  const OTHERS = keys.length; // partidos sin dato en la encuesta
  const BLANK = keys.length + 1; // voto en blanco (y, con othersCap, el excedente sin escaño)
  const groupOfKey = {};
  keys.forEach((k, g) => { for (const p of groups[k] || [k]) groupOfKey[p] = g; });
  const group = Int32Array.from(parties, (p) => groupOfKey[p] ?? OTHERS);
  const target = new Float64Array(G);
  keys.forEach((k, g) => { target[g] = poll[k] / 100; });

  const v0 = noise ? votes.map((v, j) => v * noise[j]) : votes;
  const factor = new Float64Array(G);
  const share = new Float64Array(G);
  groupShares(v0, blank, share);
  const rest = Math.max(0.005, 1 - target.reduce((a, b) => a + b, 0));
  const baseRest = share[OTHERS] + share[BLANK];
  if (othersCap && rest >= baseRest) {
    target[OTHERS] = share[OTHERS];
    target[BLANK] = rest - share[OTHERS];
  } else {
    target[OTHERS] = baseRest > 0 ? (share[OTHERS] * rest) / baseRest : 0;
    target[BLANK] = baseRest > 0 ? (share[BLANK] * rest) / baseRest : rest;
  }
  // Factor inicial: objetivo / cuota base.
  for (let g = 0; g < G; g++) factor[g] = share[g] > 0 ? target[g] / share[g] : 0;

  const cur = new Float64Array(N * K);
  const curBlank = new Float64Array(N);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < N; i++) {
      let sum = blank[i] * factor[BLANK];
      for (let k = 0; k < K; k++) {
        const x = v0[i * K + k] * factor[group[k]];
        cur[i * K + k] = x;
        sum += x;
      }
      const s = sum > 0 ? valid[i] / sum : 0;
      for (let k = 0; k < K; k++) cur[i * K + k] *= s;
      curBlank[i] = blank[i] * factor[BLANK] * s;
    }
    groupShares(cur, curBlank, share);
    let maxErr = 0;
    for (let g = 0; g < G; g++) {
      if (!share[g]) continue;
      maxErr = Math.max(maxErr, Math.abs(share[g] - target[g]));
      factor[g] *= target[g] / share[g];
    }
    if (maxErr < 1e-6) break;
  }

  return base.map((p, i) => {
    const out = {};
    for (let k = 0; k < K; k++) {
      const v = Math.round(cur[i * K + k]);
      if (v > 0) out[parties[k]] = v;
    }
    return { ...p, votes: out, blank: Math.round(curBlank[i]) };
  });

  function groupShares(m, b, acc) {
    acc.fill(0);
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < K; k++) acc[group[k]] += m[i * K + k];
      acc[BLANK] += b[i];
    }
    for (let g = 0; g < G; g++) acc[g] /= totalValid;
  }
}

// Tamaño de la matriz de ruido para `project(..., {noise})`.
export function noiseSize(base) {
  const c = compile(base);
  return base.length * c.K;
}

// Cuotas nacionales (% sobre válidos) de un conjunto de provincias.
export function nationalShares(provinces) {
  const acc = {};
  let total = 0;
  for (const p of provinces) {
    for (const [k, v] of Object.entries(p.votes)) acc[k] = (acc[k] || 0) + v;
    total += Object.values(p.votes).reduce((a, b) => a + b, 0) + (p.blank || 0);
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, (100 * v) / total]));
}
