import { dhondt } from './dhondt.js';
import { sumParties, blocTotals } from './blocs.js';

// provinces: [{id, seats, votes, blank}] → {byProvince, national, blocs}
export function congress(provinces) {
  const byProvince = {};
  for (const p of provinces) {
    const valid = Object.values(p.votes).reduce((a, b) => a + b, 0) + (p.blank || 0);
    byProvince[p.id] = dhondt(p.votes, p.seats, valid);
  }
  const national = sumParties(byProvince);
  return { byProvince, national, blocs: blocTotals(national) };
}
