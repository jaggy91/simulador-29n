// Senado: voto mayoritario limitado (LOREG art. 166). Con votos de partido
// (media por candidato), cada partido presenta `maxVotes` candidatos con el mismo
// voto, así que el primero se lleva maxVotes escaños y los restantes pasan al
// siguiente: 3+1 en provincias, 2+1 en islas mayores, 2+0 en Ceuta y Melilla.
// No capta el voto personal cruzado: en carreras muy igualadas el resultado real
// puede ser 2+2 (2023: Badajoz, Cáceres, Huelva, Valencia).
export function senateSeats(votes, seats, maxVotes) {
  const ranked = Object.entries(votes).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const result = {};
  let left = seats;
  for (const [party] of ranked) {
    if (left <= 0) break;
    const n = Math.min(maxVotes, left);
    result[party] = n;
    left -= n;
  }
  return result;
}

// Variante por candidatos: lists = {partido: [votos cand.1, votos cand.2, …]}. Ganan
// los `seats` candidatos más votados (empate: orden de la lista).
export function senateSeatsByCandidate(lists, seats) {
  const cands = [];
  for (const [party, vs] of Object.entries(lists)) for (const v of vs) if (v > 0) cands.push([party, v]);
  cands.sort((a, b) => b[1] - a[1]);
  const result = {};
  for (const [party] of cands.slice(0, seats)) result[party] = (result[party] || 0) + 1;
  return result;
}

// Fusiona listas conjuntas: merges = [{into, from: [...], share?, only?: [ids]}].
// `share` = fracción del voto de `from` que retiene la lista conjunta (1 por defecto).
export function applyMerges(constituency, merges = []) {
  const votes = { ...constituency.votes };
  for (const m of merges) {
    if (m.only && !m.only.includes(constituency.id)) continue;
    for (const f of m.from) {
      if (!votes[f]) continue;
      votes[m.into] = (votes[m.into] || 0) + votes[f] * (m.share ?? 1);
      delete votes[f];
    }
  }
  return votes;
}

export function senate(constituencies, merges = []) {
  const byConstituency = {};
  const national = {};
  for (const c of constituencies) {
    const r = senateSeats(applyMerges(c, merges), c.seats, c.maxVotes);
    byConstituency[c.id] = r;
    for (const [p, n] of Object.entries(r)) national[p] = (national[p] || 0) + n;
  }
  return { byConstituency, national };
}
