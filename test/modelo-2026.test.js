import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadModelData } from '../scripts/lib/load-data.js';
import { loadInputs } from '../scripts/lib/inputs.js';
import { prepare, run, projectSenate } from '../src/engine/model.js';
import { project, nationalShares } from '../src/engine/projection.js';
import { simulate } from '../src/engine/montecarlo.js';

const prep = prepare(loadModelData());
const polls = JSON.parse(fs.readFileSync('data/polls.json', 'utf8')).sources;
// Escenarios resueltos por las tarjetas de fuentes activas por defecto (como la web).
const scenarios = loadInputs().inputs().scenarios;
const byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

describe('Base 2026', () => {
  it('el remapeo conserva los votos válidos de cada provincia salvo las semillas de SALF y AA', () => {
    const c23 = loadModelData().congreso.provinces;
    for (const [i, p] of prep.congressBase.entries()) {
      const before = total(c23[i].votes) - (c23[i].votes.AA || 0);
      const after = total(p.votes) - (p.votes.SALF || 0) - (p.votes.AA || 0);
      expect(Math.abs(after - before), p.name).toBeLessThanOrEqual(3);
    }
  });

  it('escaños 2026 del BOE: 350, Madrid 38, Cádiz 8', () => {
    expect(prep.congressBase.reduce((a, p) => a + p.seats, 0)).toBe(350);
    expect(prep.congressBase.find((p) => p.id === '28').seats).toBe(38);
    expect(prep.congressBase.find((p) => p.id === '11').seats).toBe(8);
  });

  it('Senado 2026: 60 circunscripciones, 209 electos + 58 designados', () => {
    expect(prep.senateBase).toHaveLength(60);
    expect(prep.senateBase.reduce((a, c) => a + c.seats, 0)).toBe(209);
    expect(total(prep.designated)).toBe(58);
  });
});

describe('Proyección', () => {
  for (const src of ['media', 'cis']) {
    it(`${src}: las cuotas nacionales coinciden con la encuesta`, () => {
      const poll = polls[src].values;
      const sh = nationalShares(project(prep.congressBase, poll));
      for (const [k, v] of Object.entries(poll)) {
        const got = k === 'PP' ? sh.PP + (sh.UPN || 0) : sh[k] || 0;
        expect(Math.abs(got - v), k).toBeLessThan(0.05);
      }
    });
  }

  it('reparte 350 escaños y el Senado tiene 267 miembros', () => {
    const r = run(prep, polls.media.values, []);
    expect(total(r.congress.national)).toBe(350);
    expect(r.senate.size).toBe(267);
    expect(r.senate.majority).toBe(134);
    expect(r.senate.threeFifths).toBe(161);
  });

  it('Teruel sin FA: el FA no tiene votos en Teruel y el PSOE gana la fracción del supuesto', () => {
    const share = byId.TERUEL_sin_FA_CHA.params.share;
    const plain = run(prep, polls.media.values, []).provinces.find((p) => p.id === '44');
    const r = run(prep, polls.media.values, [byId.TERUEL_sin_FA_CHA]).provinces.find((p) => p.id === '44');
    expect(r.votes.FA).toBeUndefined();
    expect(Math.abs(r.votes.PSOE - plain.votes.PSOE - share * plain.votes.FA)).toBeLessThanOrEqual(1);
  });

  it('las listas conjuntas aplican el seguimiento de la encuesta (menos seguimiento, menos escaños)', () => {
    const pleno = { ...byId.PACTO_PP_VOX_SENADO, params: { ...byId.PACTO_PP_VOX_SENADO.params, sharePP: 1, shareVox: 1 } };
    const real = run(prep, polls.media.values, [byId.SENADO_PROGRESO, byId.PACTO_PP_VOX_SENADO]);
    const total = run(prep, polls.media.values, [byId.SENADO_PROGRESO, pleno]);
    expect(byId.PACTO_PP_VOX_SENADO.params).toMatchObject({ sharePP: 0.94, shareVox: 0.86 });
    expect(total.senate.right).toBeGreaterThanOrEqual(real.senate.right);
  });
});

describe('Monte Carlo', () => {
  it('es reproducible con la misma semilla', () => {
    const a = simulate(prep, polls.media.values, scenarios, { n: 40, seed: 7 });
    const b = simulate(prep, polls.media.values, scenarios, { n: 40, seed: 7 });
    expect(a).toEqual(b);
  });

  // Media de encuestas: con Senado de Progreso y sin pacto PP–Vox, la derecha rara vez
  // llega a 3/5 del Senado; el pacto real (con el seguimiento de Data 10) lo cambia.
  it('Senado (media): P(3/5) baja sin pacto y sube claramente con el pacto PP–Vox', () => {
    const only = scenarios.filter((s) => ['SENADO_PROGRESO', 'TERUEL_sin_FA_CHA'].includes(s.id));
    const sep = simulate(prep, polls.media.values, only, { n: 400 });
    const pacto = simulate(prep, polls.media.values, [...only, byId.PACTO_PP_VOX_SENADO], { n: 400 });
    expect(sep.prob.senado35Derecha).toBeLessThan(0.2);
    expect(pacto.prob.senado35Derecha - sep.prob.senado35Derecha).toBeGreaterThan(0.15);
  });
});

describe('Voto exterior', () => {
  const ext = (params) => ({ id: 'VOTO_EXTERIOR', kind: 'extra-votes', prob: 1, params });
  const only = scenarios.filter((s) => ['SENADO_PROGRESO', 'TERUEL_sin_FA_CHA'].includes(s.id));

  it('el censo CERA de 2026 suma 2.769.645 electores y crece 444.335 desde 2023', () => {
    expect(prep.cera.totals.cera2026).toBe(2769645);
    expect(prep.cera.totals.growth).toBe(444335);
  });

  // Los mismos 37.000 votos al PSOE: repartidos según dónde creció el censo apenas
  // mueven escaños; colocados de forma óptima (cota teórica) mueven ~7.
  it('modo realista ≪ techo estratégico con el mismo volumen de votos', () => {
    const base = simulate(prep, polls.cis.values, only, { n: 300 });
    const real = simulate(prep, polls.cis.values, [...only, ext({ mode: 'realista', split: { PSOE: 1 }, turnout: 0.227 })], { n: 300 });
    const techo = simulate(prep, polls.cis.values, [...only, ext({ mode: 'techo', party: 'PSOE', budget: 37000 })], { n: 300 });
    expect(base.blocs.derecha.mean - real.blocs.derecha.mean).toBeLessThan(1.5);
    expect(base.blocs.derecha.mean - techo.blocs.derecha.mean).toBeGreaterThan(5);
  });
});

describe('Pacto PP–Vox al Senado (26-oct)', () => {
  it('candidato único de Vox: sus votantes empujan a los dos primeros del PP', () => {
    // 4 escaños, voto a 3: izquierda conjunta 100 > PP 90; Vox 30 con un candidato.
    // Sin pacto: izq 3 + PP 1. Con candidato único (85 % sigue la consigna): PP 90+25,5
    // en sus dos primeros candidatos → 2 + 2.
    const c = { prov: 'X', seats: 4, maxVotes: 3 };
    const pact = { kind: 'senate-pact', params: { share: 0.85, voxSingle: ['X'] } };
    const prepX = { ...prep, congressBase: [{ id: 'X', votes: { PSOE: 1, PP: 1, VOX: 1 }, blank: 0 }], senateBase: [{ ...c, id: 'X', votes: { PSOE: 100, PP: 90, VOX: 30 } }], designated: {} };
    const projected = prepX.congressBase;
    expect(projectSenate(prepX, projected, []).elected).toEqual({ PSOE: 3, PP: 1 });
    expect(projectSenate(prepX, projected, [pact]).elected).toEqual({ PSOE: 2, PP: 2 });
  });

  for (const src of ['media', 'cis']) {
    it(`${src}: el pacto sube a la derecha en el Senado sin tocar el Congreso`, () => {
      const a = run(prep, polls[src].values, [byId.SENADO_PROGRESO]);
      const b = run(prep, polls[src].values, [byId.SENADO_PROGRESO, byId.PACTO_PP_VOX_SENADO]);
      expect(b.senate.right).toBeGreaterThan(a.senate.right + 10);
      expect(b.congress.national).toEqual(a.congress.national);
    });
  }
});

describe('Auditoría 28-oct', () => {
  const NO_POLL = ['CUP', 'UPL', 'NC', 'SY', 'EXISTE'];
  // El tope es del grupo: dentro de él cada partido se mueve un poco con la
  // renormalización de su provincia.
  it('los partidos sin dato en la encuesta no crecen por encima de su cuota de 2023', () => {
    const base = nationalShares(prep.congressBase);
    const polled = new Set([...Object.keys(polls.media.values), 'UPN']);
    const others = (sh) => Object.entries(sh).filter(([k]) => !polled.has(k)).reduce((a, [, v]) => a + v, 0);
    for (const src of ['media', 'cisOficial', 'cis']) {
      const sh = nationalShares(project(prep.congressBase, polls[src].values));
      expect(others(sh), src).toBeLessThanOrEqual(others(base) + 1e-3);
      for (const k of NO_POLL) expect(sh[k] || 0, `${src} ${k}`).toBeLessThanOrEqual(1.1 * (base[k] || 0));
    }
  });

  it('CIS oficial: ningún escaño para partidos que la encuesta no estima', () => {
    const r = run(prep, polls.cisOficial.values, scenarios.filter((s) => s.prob >= 1 && s.kind !== 'base'));
    for (const k of NO_POLL) expect(r.congress.national[k] || 0, k).toBe(0);
  });

  it('una clave de encuesta sin votos en la base no desplaza a las demás', () => {
    const poll = { ...polls.media.values, 'x:Sin base': 2 };
    const sh = nationalShares(project(prep.congressBase, poll));
    expect(Math.abs(sh.PSOE - poll.PSOE)).toBeLessThan(0.05);
  });

  it('el ruido de encuesta conserva la suma', async () => {
    const { noisyPoll, mulberry32, HISTORICAL_NOISE } = await import('../src/engine/montecarlo.js');
    const rng = mulberry32(3);
    const S = total(polls.media.values);
    for (let i = 0; i < 50; i++) expect(Math.abs(total(noisyPoll(polls.media.values, rng, HISTORICAL_NOISE)) - S)).toBeLessThan(1e-9);
  });

  it('lista conjunta por candidatos: quien no la apoya vota a los de su partido', () => {
    // 4 escaños, 3 marcas. PSOE 100 + FA 20 (92 % y 95 % la apoyan) frente a PP 105.
    // Abstención: todos 92+19 = 111 > 105 → 3+1. Propios: PSOE 100+19 = 119, FA 92+20 = 112 → 3+1.
    // Con PP 115: abstención 111 < 115 → PP 3 + izq 1; propios: 119, 119 > 115 > 112 → 2+2.
    const c = { prov: 'X', seats: 4, maxVotes: 3 };
    const merge = (nf) => ({ kind: 'senate-merge', params: { into: 'PSOE', from: ['FA'], where: 'all', intoShare: 0.92, share: 0.95, nonFollowers: nf } });
    const prepX = { ...prep, congressBase: [{ id: 'X', votes: { PSOE: 1, PP: 1, FA: 1 }, blank: 0 }], senateBase: [{ ...c, id: 'X', votes: { PSOE: 100, FA: 20, PP: 115 } }], designated: {} };
    expect(projectSenate(prepX, prepX.congressBase, [merge('abstencion')]).elected).toEqual({ PP: 3, PSOE: 1 });
    expect(projectSenate(prepX, prepX.congressBase, [merge('propios')]).elected).toEqual({ PSOE: 2, PP: 2 });
  });

  it('con seguimiento del 100 % la lista conjunta equivale a sumar los votos', () => {
    const full = scenarios.map((s) => (s.kind === 'senate-merge' || s.kind === 'senate-pact' ? { ...s, params: { ...s.params, intoShare: 1, share: 1, sharePP: 1, shareVox: 1 } } : s)).filter((s) => s.prob >= 1 && s.kind !== 'base');
    const a = run(prep, polls.media.values, full).senate;
    const b = run(prep, polls.media.values, full.map((s) => (s.params ? { ...s, params: { ...s.params, nonFollowers: 'abstencion' } } : s))).senate;
    expect(a.right).toBe(b.right);
  });
});
