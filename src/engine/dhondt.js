// Reparto D'Hondt de una circunscripción (LOREG art. 163).
// votes: {partido: votos}, valid: votos válidos (candidaturas + blanco).
// Devuelve {partido: escaños} solo con los partidos que obtienen escaño.
export function dhondt(votes, seats, valid, threshold = 0.03) {
  const min = valid * threshold;
  const names = [];
  const vs = [];
  for (const p in votes) {
    const v = votes[p];
    if (v > 0 && v >= min) { names.push(p); vs.push(v); }
  }
  // Escaño a escaño al mayor cociente v/(escaños+1). Equivale a ordenar todos los
  // cocientes; empate de cocientes: gana el partido con más votos totales.
  const won = new Array(names.length).fill(0);
  for (let s = 0; s < seats && names.length; s++) {
    let best = 0;
    let bq = -1;
    for (let i = 0; i < names.length; i++) {
      const q = vs[i] / (won[i] + 1);
      if (q > bq || (q === bq && vs[i] > vs[best])) { bq = q; best = i; }
    }
    won[best]++;
  }
  const result = {};
  for (let i = 0; i < names.length; i++) if (won[i]) result[names[i]] = won[i];
  return result;
}

// Votos que necesita `party` (añadidos a su total) para ganar un escaño más,
// y a quién se lo quitaría. Infinity si ya tiene todos los escaños.
export function votesToNextSeat(votes, seats, valid, party, threshold = 0.03) {
  const current = dhondt(votes, seats, valid, threshold);
  const have = current[party] || 0;
  if (have >= seats) return { need: Infinity, from: null };
  const min = valid * threshold;
  // Último cociente que entra entre los demás partidos.
  const others = [];
  for (const [p, v] of Object.entries(votes)) {
    if (p === party || v < min) continue;
    for (let d = 1; d <= seats; d++) others.push([p, v / d]);
  }
  others.sort((a, b) => b[1] - a[1]);
  // Con have+1 escaños propios, los demás conservan seats-have-1: el cociente a superar
  // es el (seats-have)-ésimo de los demás.
  const target = others[seats - have - 1];
  if (!target) return { need: Infinity, from: null };
  const v = votes[party] || 0;
  let need = Math.floor(target[1] * (have + 1) - v) + 1;
  // El umbral crece con los votos añadidos: v+x >= 0.03*(valid+x).
  const thr = Math.ceil((threshold * valid - v) / (1 - threshold));
  need = Math.max(need, thr, 1);
  return { need, from: target[0] };
}
