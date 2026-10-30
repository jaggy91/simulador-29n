import { describe, it, expect } from 'vitest';
import { resolveEvidence, defaultActive, pollFromCards, modelInputs } from '../src/engine/evidence.js';
import { loadInputs } from '../scripts/lib/inputs.js';
import fs from 'node:fs';

const catalog = [
  { id: 'A', label: 'A', status: 'sin datos', prob: 0, kind: 'withdraw', params: { share: 0.7 } },
  { id: 'B', label: 'B', status: 'sin datos', prob: 0, kind: 'senate-pact', params: { share: 0.85 } },
];
const card = (id, type, date, effects, verified = true) => ({ id, type, date, verified, effects });

describe('Resolución de fuentes', () => {
  const rumor = card('rumor', 'analisis', '2026-10-20', [{ scenario: 'A', prob: 0.15, status: 'rumor' }], false);
  const desmentido = card('desm', 'noticia', '2026-10-26', [{ scenario: 'A', prob: 0, status: 'descartado' }]);
  const boe = card('boe', 'oficial', '2026-10-01', [{ scenario: 'A', prob: 1, status: 'confirmado' }]);

  it('sin fuentes, cada escenario queda en "sin datos"', () => {
    const r = resolveEvidence(catalog, [], new Set());
    expect(r.scenarios.map((s) => [s.status, s.prob])).toEqual([['sin datos', 0], ['sin datos', 0]]);
  });

  it('manda la más reciente a igual rango y la de mayor rango sobre la más reciente', () => {
    expect(resolveEvidence(catalog, [rumor, desmentido], new Set(['rumor', 'desm'])).scenarios[0].status).toBe('descartado');
    // El BOE (oficial) es anterior pero de mayor rango.
    expect(resolveEvidence(catalog, [desmentido, boe], new Set(['desm', 'boe'])).scenarios[0].status).toBe('confirmado');
  });

  it('las superadas no están activas por defecto y desactivar la que manda devuelve la anterior', () => {
    const cards = [rumor, desmentido];
    const def = defaultActive(catalog, cards);
    expect([...def]).toEqual(['desm']);
    expect(resolveEvidence(catalog, cards, new Set(['rumor'])).scenarios[0]).toMatchObject({ status: 'rumor', prob: 0.15, appliedBy: 'rumor' });
  });

  it('una tarjeta activa pero superada queda marcada sin efecto', () => {
    const r = resolveEvidence(catalog, [rumor, desmentido], new Set(['rumor', 'desm']));
    expect(r.overriddenBy).toEqual({ rumor: 'desm' });
  });

  it('la media de encuestas se recalcula solo con las tarjetas activas', () => {
    const items = [
      { id: 'p1', weight: 0.75, values: { PP: 30, PSOE: 28 } },
      { id: 'p2', weight: 0.25, values: { PP: 34, PSOE: 24 } },
    ];
    expect(pollFromCards(items, new Set(['p1', 'p2']))).toEqual({ PP: 31, PSOE: 27 });
    expect(pollFromCards(items, new Set(['p2']))).toEqual({ PP: 34, PSOE: 24 });
  });
});

describe('Fuentes reales (data/news.json, data/polls.json)', () => {
  const { catalog: cat, news, polls, active, inputs } = loadInputs();
  const base = inputs();
  const sc = Object.fromEntries(base.scenarios.map((s) => [s.id, s]));

  it('por defecto: pacto PP–Vox y Senado de Progreso confirmados; retirada del FA descartada', () => {
    expect(sc.PACTO_PP_VOX_SENADO).toMatchObject({ status: 'confirmado', prob: 1, appliedBy: 'pacto-pp-vox-senado' });
    expect(sc.SENADO_PROGRESO).toMatchObject({ status: 'confirmado', prob: 1 });
    expect(sc.FA_retira_pequenas).toMatchObject({ status: 'descartado', prob: 0, appliedBy: 'fa-51-de-52' });
    // La oferta de Abascal (negociación) y la frase de Delgado (rumor) quedan superadas.
    expect(active.has('abascal-senado')).toBe(false);
    expect(active.has('delgado-optimizar')).toBe(false);
    // La encuesta Data 10 fija el seguimiento de ambas listas conjuntas y no queda superada.
    expect(active.has('data10-seguimiento-listas')).toBe(true);
    expect(sc.PACTO_PP_VOX_SENADO.params).toMatchObject({ sharePP: 0.94, shareVox: 0.86 });
    expect(sc.SENADO_PROGRESO.params).toMatchObject({ intoShare: 0.92, share: 0.95 });
  });

  it('ninguna fuente remite al vídeo de referencia y todas las que modifican el resultado tienen enlace', () => {
    expect(JSON.stringify(news)).not.toMatch(/Vídeo de referencia|transcripción/i);
    for (const c of news.filter((c) => c.effects?.length)) expect(c.sources.length, c.id).toBeGreaterThan(0);
  });

  it('con todas las encuestas activas, la media coincide con la de fetch-polls', () => {
    for (const k of Object.keys(polls.sources)) {
      for (const [p, v] of Object.entries(polls.sources[k].values)) expect(Math.abs(base.polls[k][p] - v), `${k} ${p}`).toBeLessThan(0.02);
    }
  });

  it('sin la noticia del pacto, el escenario vuelve a "sin datos"', () => {
    const alt = new Set(active);
    alt.delete('pacto-pp-vox-senado');
    const r = modelInputs(cat, news, polls.sources, alt);
    expect(r.scenarios.find((s) => s.id === 'PACTO_PP_VOX_SENADO')).toMatchObject({ status: 'sin datos', prob: 0 });
  });

  it('sources.json: cada tarjeta con efecto tiene su impacto calculado', () => {
    const { cards } = JSON.parse(fs.readFileSync('data/sources.json', 'utf8'));
    for (const c of cards.filter((c) => c.toggleable)) expect(c.impact?.media, c.id).toBeDefined();
  });
});

describe('Captura automática (F4)', () => {
  it('una tarjeta capturada sin verificar no está activa por defecto', () => {
    const auto = { id: 'auto', type: 'noticia', date: '2026-11-01', verified: false, captured: 'auto', effects: [{ scenario: 'A', prob: 0.15, status: 'rumor' }] };
    expect(defaultActive(catalog, [auto]).has('auto')).toBe(false);
    expect(defaultActive(catalog, [{ ...auto, verified: true }]).has('auto')).toBe(true);
  });
});
