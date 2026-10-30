// Fuentes como tarjetas: cada noticia, encuesta o dato oficial modifica escenarios del
// catálogo (su estado, su probabilidad o sus parámetros); cada encuesta de intención
// de voto entra en la media de su fuente. Por defecto todas las tarjetas están activas
// salvo las superadas; el usuario puede activar o desactivar cualquiera.

// Rango de cada tipo de fuente: cuando varias fijan el mismo dato manda la de mayor
// rango; a igualdad, la verificada; a igualdad, la más reciente.
export const RANK = { oficial: 3, noticia: 2, analisis: 1 };
export const hasEffect = (c) => (c.effects || []).length > 0;
const order = (a, b) =>
  (RANK[a.type] || 0) - (RANK[b.type] || 0)
  || (a.verified ? 1 : 0) - (b.verified ? 1 : 0)
  || a.date.localeCompare(b.date)
  || a.id.localeCompare(b.id);

// Campos que fija un efecto: estado/probabilidad y cada parámetro por separado. Así una
// encuesta que solo aporta un parámetro (p. ej. el % que sigue un pacto) no queda
// superada por la noticia que confirma el pacto.
const fieldsOf = (e) => [
  ...(e.prob != null || e.status ? [`${e.scenario}:estado`] : []),
  ...Object.keys(e.params || {}).map((k) => `${e.scenario}:${k}`),
];

// Aplica las tarjetas activas, de menor a mayor prioridad, sobre el catálogo.
// Devuelve los escenarios resueltos, qué tarjeta fija el estado de cada escenario y
// qué tarjetas activas quedan sin efecto porque otras de más prioridad fijan todo lo suyo.
export function resolveEvidence(catalog, cards, active) {
  const state = Object.fromEntries(catalog.map((s) => [s.id, { ...s, ...(s.params && { params: { ...s.params } }), appliedBy: null, paramsBy: {} }]));
  const winner = {};
  const applied = cards.filter((c) => hasEffect(c) && active.has(c.id)).sort(order);
  for (const c of applied) {
    for (const e of c.effects) {
      const s = state[e.scenario];
      if (!s) continue;
      if (e.prob != null) s.prob = e.prob;
      if (e.status) s.status = e.status;
      if (e.prob != null || e.status) s.appliedBy = c.id;
      if (e.params) {
        s.params = { ...s.params, ...e.params };
        for (const k of Object.keys(e.params)) s.paramsBy[k] = c.id;
      }
      for (const f of fieldsOf(e)) winner[f] = c.id;
    }
  }
  const overriddenBy = {};
  for (const c of applied) {
    const fields = c.effects.flatMap(fieldsOf);
    const lost = fields.filter((f) => winner[f] !== c.id);
    if (fields.length && lost.length === fields.length) overriddenBy[c.id] = winner[lost[0]];
  }
  return { scenarios: catalog.map((s) => state[s.id]), winner, overriddenBy };
}

// Activas por defecto: todas las que tienen efecto, menos las superadas cuando todas
// están activas y las capturadas automáticamente sin verificar (F4): no cambian el
// resultado por defecto hasta que alguien las revisa. Todas siguen visibles y se
// pueden activar.
// Excepción (opción C): un rumor o una negociación que cuentan al menos dos medios se
// activa solo (`autoActive`, lo decide scripts/fetch-news.js).
export const pendingReview = (c) => c.captured === 'auto' && !c.verified && !c.autoActive;
export function defaultActive(catalog, cards) {
  const all = new Set(cards.filter((c) => hasEffect(c) && !pendingReview(c)).map((c) => c.id));
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

// Fuentes del CIS: media de sus tarjetas activas; los partidos que no dan, de la media.
export function cisFromCards(items, active, media) {
  const own = pollFromCards(items, active);
  return { ...Object.fromEntries(Object.entries(media).filter(([p]) => !(p in own))), ...own };
}

// Todas las entradas del modelo para un conjunto de tarjetas activas.
// polls: {media: {items}, <otras fuentes>: {items}} (data/polls.json → sources).
export function modelInputs(catalog, cards, polls, active) {
  const { scenarios, winner, overriddenBy } = resolveEvidence(catalog, cards, active);
  const media = pollFromCards(polls.media.items, active);
  const out = { media };
  for (const [key, src] of Object.entries(polls)) {
    if (key === 'media') continue;
    out[key] = src.items.some((it) => active.has(it.id)) ? cisFromCards(src.items, active, media) : media;
  }
  return { scenarios, winner, overriddenBy, polls: out };
}
