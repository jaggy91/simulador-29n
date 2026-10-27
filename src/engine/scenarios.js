// Escenarios como transformaciones puras sobre [{id, seats, votes, blank}].
import { dhondt, votesToNextSeat } from './dhondt.js';

const clone = (provinces) => provinces.map((p) => ({ ...p, votes: { ...p.votes } }));

// Provincias que eligen `max` diputados o menos.
export const smallProvinces = (provinces, max = 5) => provinces.filter((p) => p.seats <= max).map((p) => p.id);

// `from` no se presenta en `ids`; `share` de su voto pasa a `to`, el resto se abstiene.
export function withdraw(provinces, { from, to, ids, share = 1 }) {
  return clone(provinces).map((p) => {
    if (!ids.includes(p.id) || !p.votes[from]) return p;
    const v = p.votes[from];
    delete p.votes[from];
    p.votes[to] = (p.votes[to] || 0) + Math.round(v * share);
    return p;
  });
}

// Divide el voto de `from` entre varios partidos según pesos por provincia:
// weights = {provId: {partido: peso}}. Sin pesos para una provincia, no cambia.
export function split(provinces, { from, weights }) {
  return clone(provinces).map((p) => {
    const w = weights[p.id];
    const v = p.votes[from];
    if (!w || !v) return p;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    if (!total) return p;
    delete p.votes[from];
    for (const [party, x] of Object.entries(w)) p.votes[party] = (p.votes[party] || 0) + Math.round((v * x) / total);
    return p;
  });
}

// Votos extra a `party` por provincia: extra = {provId: n}.
export function addVotes(provinces, { party, extra }) {
  return clone(provinces).map((p) => {
    if (!extra[p.id]) return p;
    p.votes[party] = (p.votes[party] || 0) + extra[p.id];
    return p;
  });
}

const validOf = (p) => Object.values(p.votes).reduce((a, b) => a + b, 0) + (p.blank || 0);

// Para cada provincia: votos que necesita `party` para ganar el siguiente escaño.
export function seatsInPlay(provinces, party) {
  return provinces
    .map((p) => ({ id: p.id, name: p.name, ...votesToNextSeat(p.votes, p.seats, validOf(p), party) }))
    .filter((x) => Number.isFinite(x.need))
    .sort((a, b) => a.need - b.need);
}

// "Escaños en el aire": en cada provincia, el partido que antes arrebataría un escaño
// y cuántos votos le faltan. Ordenado de menor a mayor.
export function marginalSeats(provinces, { limit = 30 } = {}) {
  const out = [];
  for (const p of provinces) {
    const valid = validOf(p);
    let best = null;
    for (const party of Object.keys(p.votes)) {
      const r = votesToNextSeat(p.votes, p.seats, valid, party);
      if (Number.isFinite(r.need) && r.from && r.from !== party && (!best || r.need < best.need)) best = { party, ...r };
    }
    if (best) out.push({ id: p.id, name: p.name, seats: p.seats, gains: best.party, loses: best.from, need: best.need, pctOfValid: (100 * best.need) / valid });
  }
  return out.sort((a, b) => a.need - b.need).slice(0, limit);
}

// Escalera de costes por provincia: votos acumulados para que `party` gane
// 1, 2… escaños más, y cuántos de ellos se quitan a partidos fuera de `allies`.
function seatLadder(p, party, allies, maxSteps, budget) {
  const steps = [];
  let cur = { ...p, votes: { ...p.votes } };
  let cost = 0;
  let gain = 0;
  for (let k = 0; k < maxSteps; k++) {
    const { need, from } = votesToNextSeat(cur.votes, cur.seats, validOf(cur), party);
    if (!Number.isFinite(need) || cost + need > budget) break;
    cost += need;
    if (!allies.includes(from)) gain++;
    cur.votes[party] += need;
    steps.push({ cost, gain });
  }
  return steps;
}

// Reparto óptimo (mochila exacta) de `budget` votos extra a `party` para
// maximizar los escaños que gana a costa de partidos fuera de `allies`.
export function optimizeExtraVotes(provinces, { party, budget, allies = [party], maxSteps = 3, unit = 10 }) {
  const B = Math.floor(budget / unit);
  const ladders = provinces.map((p) => seatLadder(p, party, allies, maxSteps, budget)
    .map((s) => ({ ...s, units: Math.ceil(s.cost / unit) })));
  // best[b] = máxima ganancia con b unidades; choice[i][b] = escalón elegido en la provincia i.
  let best = new Array(B + 1).fill(0);
  const choice = [];
  for (const ladder of ladders) {
    const next = best.slice();
    const pick = new Array(B + 1).fill(-1);
    for (let b = 0; b <= B; b++) {
      for (let s = 0; s < ladder.length; s++) {
        const { units, gain } = ladder[s];
        if (units > b) break;
        const v = best[b - units] + gain;
        if (v > next[b]) { next[b] = v; pick[b] = s; }
      }
    }
    choice.push(pick);
    best = next;
  }
  // Reconstrucción.
  const extra = {};
  let b = B;
  for (let i = provinces.length - 1; i >= 0; i--) {
    const s = choice[i][b];
    if (s < 0) continue;
    extra[provinces[i].id] = ladders[i][s].cost;
    b -= ladders[i][s].units;
  }
  const spent = Object.values(extra).reduce((a, x) => a + x, 0);
  return { extra, spent, provinces: addVotes(provinces, { party, extra }) };
}

export { dhondt };
