// Proyección provincial a partir de una encuesta nacional: swing proporcional con
// ajuste iterativo (IPF). Cada partido se escala por un factor nacional, cada provincia
// se renormaliza a sus votos válidos de 2023 (participación constante) y los factores
// se corrigen hasta que el total nacional coincide con la encuesta.
//
// poll: {partido: % sobre válidos}. Los partidos sin dato en la encuesta (regionales
// pequeños, blanco) forman "otros" y se escalan juntos para cubrir el resto hasta 100.
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
  const c = { parties, K, votes, blank, valid, totalValid: valid.reduce((a, b) => a + b, 0) };
  compiled.set(base, c);
  return c;
}

// opts.noise: Float64Array opcional (provincia × partido) de multiplicadores aleatorios.
export function project(base, poll, { groups = POLL_GROUPS, iterations = 30, noise = null } = {}) {
  const { parties, K, votes, blank, valid, totalValid } = compile(base);
  const N = base.length;
  const keys = Object.keys(poll).filter((k) => poll[k] > 0);
  const G = keys.length + 1; // último grupo = otros + blanco
  const OTHERS = keys.length;
  const groupOfKey = {};
  keys.forEach((k, g) => { for (const p of groups[k] || [k]) groupOfKey[p] = g; });
  const group = Int32Array.from(parties, (p) => groupOfKey[p] ?? OTHERS);
  const target = new Float64Array(G);
  keys.forEach((k, g) => { target[g] = poll[k] / 100; });
  target[OTHERS] = Math.max(0.005, 1 - target.reduce((a, b) => a + b, 0));

  const v0 = noise ? votes.map((v, j) => v * noise[j]) : votes;
  const factor = new Float64Array(G);
  const share = new Float64Array(G);
  // Factor inicial: objetivo / cuota base.
  groupShares(v0, blank, share);
  for (let g = 0; g < G; g++) factor[g] = share[g] > 0 ? target[g] / share[g] : 0;

  const cur = new Float64Array(N * K);
  const curBlank = new Float64Array(N);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < N; i++) {
      let sum = blank[i] * factor[OTHERS];
      for (let k = 0; k < K; k++) {
        const x = v0[i * K + k] * factor[group[k]];
        cur[i * K + k] = x;
        sum += x;
      }
      const s = sum > 0 ? valid[i] / sum : 0;
      for (let k = 0; k < K; k++) cur[i * K + k] *= s;
      curBlank[i] = blank[i] * factor[OTHERS] * s;
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
      acc[OTHERS] += b[i];
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
