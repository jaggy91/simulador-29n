// Modelo completo: base 2023 → partidos 2026 → proyección con encuesta → escenarios →
// Congreso y Senado. Funciones puras sobre un objeto `data` con los JSON de /data,
// para usarlas igual en Node (cron) y en el navegador.
import { remap2023to2026 } from './remap.js';
import { project } from './projection.js';
import { congress } from './congress.js';
import { senateSeats, senateSeatsByCandidate } from './senate.js';
import { withdraw, transfer, smallProvinces, optimizeExtraVotes } from './scenarios.js';
import { BLOCS } from './blocs.js';

export const RIGHT = ['PP', 'VOX', 'UPN'];
// Provincias de ≤5 escaños en CyL, Extremadura y CLM: la "decena larga" del rumor.
const DECENA_CCAA = ['CYL', 'EXT', 'CLM'];

export function prepare(data) {
  const congressBase = remap2023to2026(data.congreso.provinces, {
    europeas: data.europeas.provinces,
    andaluzas: data.andaluzas.provinces,
    seats: data.seats.seats,
  });
  const ccaaOf = Object.fromEntries(data.congreso.provinces.map((p) => [p.id, p.ccaa]));
  // Senado: mismo remapeo de Sumar sobre los votos de partido de 2023. Las islas usan
  // el reparto Sumar/Podemos de su provincia. Formentera se separa de Ibiza en 2026.
  const senateRemapped = remap2023to2026(
    data.senado.constituencies.map((c) => ({ id: c.prov, name: c.name, ccaa: ccaaOf[c.prov], votes: c.votes, blank: 0, seats: c.seats })),
    { europeas: data.europeas.provinces, andaluzas: [] },
  ).map((r, i) => {
    const c = data.senado.constituencies[i];
    return { id: c.id, prov: c.prov, name: c.name, ccaa: ccaaOf[c.prov], seats: c.seats, maxVotes: c.maxVotes, votes: r.votes };
  });
  const senateBase = splitFormentera(senateRemapped);
  const designated = data.designados.total;
  return { congressBase, senateBase, designated, cera: data.cera || null, small5: smallProvinces(congressBase), decena: congressBase.filter((p) => p.seats <= 5 && DECENA_CCAA.includes(p.ccaa)).map((p) => p.id) };
}

// Formentera (≈7 % del voto de Pitiusas) elige su propio senador desde 2026. Sin
// resultados propios de 2023, se le asigna el mismo reparto que a Ibiza-Formentera.
const FORMENTERA_SHARE = 0.07;
function splitFormentera(list) {
  return list.flatMap((c) => {
    if (c.id !== 'IBIZA') return [c];
    const part = (f) => Object.fromEntries(Object.entries(c.votes).map(([k, v]) => [k, Math.round(v * f)]));
    return [
      { ...c, name: 'Ibiza', votes: part(1 - FORMENTERA_SHARE) },
      { ...c, id: 'FORMENTERA', name: 'Formentera', votes: part(FORMENTERA_SHARE), estimated: true },
    ];
  });
}

const whereIds = (where, prep) => (Array.isArray(where) ? where : prep[where] || []);

// Aplica a la proyección del Congreso los escenarios activos de tipo withdraw /
// transfer (voto útil) / extra-votes.
export function applyCongressScenarios(provinces, active, prep) {
  let out = provinces;
  for (const s of active) {
    if (s.kind === 'withdraw') {
      out = withdraw(out, { from: s.params.from, to: s.params.to, ids: whereIds(s.params.where, prep), share: s.params.share });
    } else if (s.kind === 'transfer') {
      out = transfer(out, { from: s.params.from, to: s.params.to, ids: whereIds(s.params.where, prep), fraction: s.params.fraction });
    } else if (s.kind === 'extra-votes' && s.params.mode === 'techo') {
      out = optimizeExtraVotes(out, { party: s.params.party, budget: s.params.budget, allies: BLOCS.investidura, unit: s.params.unit ?? 10 }).provinces;
    } else if (s.kind === 'extra-votes' && s.params.mode === 'realista') {
      out = applyRealisticExterior(out, s.params, prep);
    } else if (s.kind === 'extra-votes' && s.params.extra) {
      out = out.map((p) => (s.params.extra[p.id] ? { ...p, votes: { ...p.votes, [s.params.party]: (p.votes[s.params.party] || 0) + s.params.extra[p.id] } } : p));
    }
  }
  return out;
}

// Voto exterior realista: `universe` nacionalizados (por defecto los 163.020 con el voto
// suspendido por el Supremo) repartidos por provincia según el crecimiento del censo
// CERA en Latinoamérica 2023→2026, × fracción que puede votar × participación. El
// reparto por partido `split` es un parámetro (no hay encuestas de este electorado);
// sin él, cada provincia los reparte como su propia proyección (efecto neutro).
export const EXTERIOR_DEFAULTS = { universe: 163020, canVote: 1, turnout: 0.10, split: null };
function applyRealisticExterior(provinces, params, prep) {
  const { universe, canVote, turnout, split } = { ...EXTERIOR_DEFAULTS, ...params };
  const growth = prep.cera ? Object.fromEntries(prep.cera.provinces.map((p) => [p.id, Math.max(0, p.latamGrowth)])) : {};
  const totalGrowth = Object.values(growth).reduce((a, b) => a + b, 0);
  if (!totalGrowth) return provinces;
  return provinces.map((p) => {
    const n = (universe * (growth[p.id] || 0) / totalGrowth) * canVote * turnout;
    if (n < 1) return p;
    const weights = split || p.votes;
    const w = Object.values(weights).reduce((a, b) => a + b, 0);
    const votes = { ...p.votes };
    for (const [k, x] of Object.entries(weights)) votes[k] = (votes[k] || 0) + Math.round((n * x) / w);
    return { ...p, votes };
  });
}

// Proyecta el Senado: cada partido se mueve en su circunscripción con el mismo factor
// que en la provincia del Congreso (cuota proyectada / cuota base). Partidos sin voto
// al Senado en 2023 (SALF, AA…) entran con su cuota proyectada en el Congreso.
// Cuotas de la base del Congreso y totales de cada circunscripción del Senado (fijos).
const senateCache = new WeakMap();
function senateConstants(prep) {
  if (senateCache.has(prep.congressBase)) return senateCache.get(prep.congressBase);
  const baseShare = {};
  for (const b of prep.congressBase) {
    const tb = total(b.votes) + (b.blank || 0);
    baseShare[b.id] = {};
    for (const k in b.votes) baseShare[b.id][k] = b.votes[k] / tb;
  }
  const c = { baseShare, totals: prep.senateBase.map((s) => total(s.votes)) };
  senateCache.set(prep.congressBase, c);
  return c;
}

export function projectSenate(prep, projected, active) {
  const { baseShare, totals } = senateConstants(prep);
  const share = {};
  for (const pr of projected) {
    const tp = total(pr.votes) + (pr.blank || 0);
    const s = (share[pr.id] = {});
    for (const k in pr.votes) s[k] = pr.votes[k] / tp;
  }
  const merges = active.filter((s) => s.kind === 'senate-merge');
  const pact = active.find((s) => s.kind === 'senate-pact');
  const byConstituency = {};
  const national = {};
  prep.senateBase.forEach((c, ci) => {
    const t = totals[ci];
    const ps = share[c.prov];
    const bs = baseShare[c.prov];
    const votes = {};
    for (const k in c.votes) votes[k] = bs[k] > 0 && ps[k] != null ? (c.votes[k] * ps[k]) / bs[k] : c.votes[k];
    for (const k in ps) if (!(k in c.votes)) votes[k] = ps[k] * t;
    for (const m of merges) {
      const p = m.params;
      if (p.where === 'provincial4' && c.seats !== 4) continue;
      if (p.except?.includes(c.prov)) continue;
      // Exclusiones por comunidad o por circunscripción (p. ej. Senado de Progreso:
      // ni Cataluña ni Canarias salvo La Gomera).
      if (p.excludeCcaa?.includes(c.ccaa) && !p.includeIds?.includes(c.id)) continue;
      for (const f of p.from) {
        if (!votes[f]) continue;
        votes[p.into] = (votes[p.into] || 0) + votes[f] * (p.share ?? 1);
        delete votes[f];
      }
    }
    const r = pact ? pactSeats(votes, c, pact.params) : senateSeats(votes, c.seats, c.maxVotes);
    byConstituency[c.id] = r;
    for (const k in r) national[k] = (national[k] || 0) + r[k];
  });
  const elected = Object.values(national).reduce((a, b) => a + b, 0);
  const withDesignated = { ...national };
  for (const [k, n] of Object.entries(prep.designated)) withDesignated[k] = (withDesignated[k] || 0) + n;
  const totalSeats = elected + Object.values(prep.designated).reduce((a, b) => a + b, 0);
  return {
    byConstituency, elected: national, total: withDesignated, size: totalSeats,
    majority: Math.floor(totalSeats / 2) + 1, threeFifths: Math.ceil(totalSeats * 0.6),
    right: RIGHT.reduce((a, p) => a + (withDesignated[p] || 0), 0),
  };
}

// Pacto PP–Vox al Senado (26-oct-2026), por provincia:
//  - voxWithdraws: Vox no se presenta; el PP lleva un independiente de Vox y recibe
//    `share` del voto de Vox (lista conjunta de facto).
//  - ppWithdraws: el PP no se presenta; Vox recibe `share` del voto del PP.
//  - voxSingle: Vox presenta un solo candidato; sus votantes pueden dar sus otros
//    maxVotes−1 votos a candidatos del PP (fracción `share`), que suman a los primeros.
// Las islas siguen a su provincia (Las Palmas, S. C. de Tenerife, Baleares).
function pactSeats(votes, c, p) {
  const share = p.share ?? 0.85;
  const v = { ...votes };
  if (p.voxWithdraws?.includes(c.prov) && v.VOX) { v.PP = (v.PP || 0) + v.VOX * share; delete v.VOX; }
  if (p.ppWithdraws?.includes(c.prov) && v.PP) { v.VOX = (v.VOX || 0) + v.PP * share; delete v.PP; }
  if (!(p.voxSingle?.includes(c.prov) && v.VOX && v.PP)) return senateSeats(v, c.seats, c.maxVotes);
  const lists = {};
  for (const [k, x] of Object.entries(v)) lists[k] = new Array(c.maxVotes).fill(x);
  lists.VOX = [v.VOX];
  for (let i = 0; i < c.maxVotes - 1; i++) lists.PP[i] += v.VOX * share;
  return senateSeatsByCandidate(lists, c.seats);
}

// Un escenario concreto (sin incertidumbre): encuesta + escenarios activos.
export function run(prep, poll, active = []) {
  const projected = project(prep.congressBase, poll);
  const withScenarios = applyCongressScenarios(projected, active, prep);
  // Las retiradas de listas son del Congreso: el Senado sale de la proyección previa.
  return { congress: congress(withScenarios), senate: projectSenate(prep, projected, active), provinces: withScenarios };
}

const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
