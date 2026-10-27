// Reasigna los votos de 2023 (por provincia) a la oferta de partidos de 2026.
// Supuestos (documentados en plan-v2.md §4.3):
//  - Sumar 2023 se divide entre su parte Podemos y el resto según la proporción
//    Sumar/Podemos de cada provincia en las europeas de 2024.
//  - Cataluña: la parte Podemos pasa a ERC (Podemos apoya a ERC) y el resto a FA (Comuns).
//  - C. Valenciana: Compromís–Front Valencià (FV) = Compromís + Podemos. FV recibe la
//    parte Podemos y una fracción `compromisShare` del resto; FA, lo que queda.
//  - Canarias: FA y Podemos van juntos al Congreso → todo a FA.
//  - Resto de España: parte Podemos → PODEMOS, resto → FA.
//  - SALF y Adelante Andalucía no tienen voto en 2023: se siembran con su % por
//    provincia en las europeas de 2024 (SALF) y en las andaluzas de 2026 (AA). Solo
//    importa su distribución territorial; el nivel lo fija luego la encuesta.
export const DEFAULT_REMAP = { compromisShare: 0.85 };

export function remap2023to2026(base, { europeas, andaluzas, seats }, opts = DEFAULT_REMAP) {
  const eu = Object.fromEntries(europeas.map((p) => [p.id, p.pct]));
  const and = Object.fromEntries(andaluzas.map((p) => [p.id, p.pct]));
  return base.map((p) => {
    const votes = { ...p.votes };
    const valid = Object.values(votes).reduce((a, b) => a + b, 0) + (p.blank || 0);
    const sumar = votes.SUMAR || 0;
    delete votes.SUMAR;
    const e = eu[p.id] || {};
    const podShare = e.SUMAR + e.PODEMOS > 0 ? e.PODEMOS / (e.SUMAR + e.PODEMOS) : 0;
    const pod = sumar * podShare;
    const rest = sumar - pod;
    const add = (k, v) => { if (v > 0) votes[k] = (votes[k] || 0) + Math.round(v); };
    if (p.ccaa === 'CAT') {
      add('ERC', pod);
      add('FA', rest);
    } else if (p.ccaa === 'CAN') {
      // Canarias: el FA y Podemos van juntos al Congreso (Infobae, 17-oct-2026).
      add('FA', pod + rest);
    } else if (p.ccaa === 'VAL') {
      add('FV', pod + rest * opts.compromisShare);
      add('FA', rest * (1 - opts.compromisShare));
    } else {
      add('PODEMOS', pod);
      add('FA', rest);
    }
    add('SALF', (valid * (e.SALF || 0)) / 100);
    if (and[p.id]) {
      // La semilla sustituye al voto de AA en 2023 (solo se presentó en Cádiz).
      delete votes.AA;
      add('AA', (valid * (and[p.id].AA || 0)) / 100);
    }
    return { id: p.id, name: p.name, ccaa: p.ccaa, seats: seats?.[p.id] ?? p.seats, votes, blank: p.blank };
  });
}
