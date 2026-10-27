// Bloques según la votación de investidura del 16-nov-2023 (179 sí, 171 no).
export const BLOCS = {
  derecha: ['PP', 'VOX', 'UPN'],
  // Partidos que invistieron a Sánchez en 2023 (sin Junts). FA, FV y Podemos vienen de Sumar.
  investidura: ['PSOE', 'SUMAR', 'FA', 'FV', 'PODEMOS', 'ERC', 'BILDU', 'PNV', 'BNG', 'CC'],
  junts: ['JUNTS'],
};
export const MAJORITY = 176;

export function sumParties(seats) {
  const nat = {};
  for (const prov of Object.values(seats)) for (const [p, n] of Object.entries(prov)) nat[p] = (nat[p] || 0) + n;
  return nat;
}

export function blocTotals(nat) {
  const out = {};
  for (const [b, parties] of Object.entries(BLOCS)) out[b] = parties.reduce((a, p) => a + (nat[p] || 0), 0);
  return out;
}
