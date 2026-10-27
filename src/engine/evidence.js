// Fuentes como tarjetas: cada noticia, análisis o dato oficial modifica escenarios del
// catálogo; cada encuesta entra en la media. Por defecto todas las tarjetas están
// activas salvo las superadas; el usuario puede activar o desactivar cualquiera.

// Rango de cada tipo de fuente: cuando varias tocan el mismo escenario manda la de mayor
// rango; a igualdad, la verificada; a igualdad, la más reciente.
export const RANK = { oficial: 3, noticia: 2, analisis: 1 };
export const hasEffect = (c) => (c.effects || []).length > 0;
const order = (a, b) =>
  (RANK[a.type] || 0) - (RANK[b.type] || 0)
  || (a.verified ? 1 : 0) - (b.verified ? 1 : 0)
  || a.date.localeCompare(b.date)
  || a.id.localeCompare(b.id);

// Aplica las tarjetas activas, de menor a mayor prioridad, sobre el catálogo.
// Devuelve los escenarios resueltos, qué tarjeta fija cada escenario y qué tarjetas
// activas quedan sin efecto porque otra de más prioridad toca lo mismo.
export function resolveEvidence(catalog, cards, active) {
  const state = Object.fromEntries(catalog.map((s) => [s.id, { ...s, ...(s.params && { params: { ...s.params } }), appliedBy: null }]));
  const winner = {};
  const applied = cards.filter((c) => hasEffect(c) && active.has(c.id)).sort(order);
  for (const c of applied) {
    for (const e of c.effects) {
      const s = state[e.scenario];
      if (!s) continue;
      if (e.prob != null) s.prob = e.prob;
      if (e.status) s.status = e.status;
      if (e.params) s.params = { ...s.params, ...e.params };
      s.appliedBy = c.id;
      winner[e.scenario] = c.id;
    }
  }
  const overriddenBy = {};
  for (const c of applied) {
    const lost = c.effects.filter((e) => winner[e.scenario] && winner[e.scenario] !== c.id);
    if (lost.length === c.effects.length) overriddenBy[c.id] = winner[lost[0].scenario];
  }
  return { scenarios: catalog.map((s) => state[s.id]), winner, overriddenBy };
}

// Activas por defecto: todas las que tienen efecto, menos las superadas cuando todas
// están activas (siguen visibles y se pueden reactivar).
export function defaultActive(catalog, cards) {
  const all = new Set(cards.filter(hasEffect).map((c) => c.id));
  const { overriddenBy } = resolveEvidence(catalog, cards, all);
  return new Set([...all].filter((id) => !overriddenBy[id]));
}

// Media de encuestas con las tarjetas activas: cada tarjeta lleva su peso y sus cifras
// (ya con las cifras conjuntas repartidas). Los pesos se renormalizan por partido.
export function pollFromCards(items, active) {
  const acc = {};
  const wsum = {};
  for (const it of items) {
    if (!active.has(it.id)) continue;
    for (const [p, v] of Object.entries(it.values)) {
      acc[p] = (acc[p] || 0) + v * it.weight;
      wsum[p] = (wsum[p] || 0) + it.weight;
    }
  }
  return Object.fromEntries(Object.keys(acc).map((p) => [p, Math.round((100 * acc[p]) / wsum[p]) / 100]));
}

// Fuente CIS: media de las reestimaciones activas; los partidos que no dan, de la media.
export function cisFromCards(items, active, media) {
  const own = pollFromCards(items, active);
  return { ...Object.fromEntries(Object.entries(media).filter(([p]) => !(p in own))), ...own };
}

// Todas las entradas del modelo para un conjunto de tarjetas activas.
// polls: {media: {items}, cis: {items}} (data/polls.json → sources).
export function modelInputs(catalog, cards, polls, active) {
  const { scenarios, winner, overriddenBy } = resolveEvidence(catalog, cards, active);
  const media = pollFromCards(polls.media.items, active);
  const cis = polls.cis.items.some((it) => active.has(it.id)) ? cisFromCards(polls.cis.items, active, media) : media;
  return { scenarios, winner, overriddenBy, polls: { media, cis } };
}
