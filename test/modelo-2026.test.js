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

  it('Teruel sin FA: el FA no tiene votos en Teruel y el PSOE gana el 70 %', () => {
    const plain = run(prep, polls.media.values, []).provinces.find((p) => p.id === '44');
    const r = run(prep, polls.media.values, [byId.TERUEL_sin_FA_CHA]).provinces.find((p) => p.id === '44');
    expect(r.votes.FA).toBeUndefined();
    expect(Math.abs(r.votes.PSOE - plain.votes.PSOE - 0.7 * plain.votes.FA)).toBeLessThanOrEqual(1);
  });

  it('Vox fuera del Senado sube a la derecha en el Senado y no toca el Congreso', () => {
    const a = run(prep, polls.media.values, [byId.SENADO_PROGRESO]);
    const b = run(prep, polls.media.values, [byId.SENADO_PROGRESO, { ...byId.VOX_retira_senado, prob: 1 }]);
    expect(b.senate.right).toBeGreaterThan(a.senate.right);
    expect(b.congress.national).toEqual(a.congress.national);
  });
});

describe('Monte Carlo', () => {
  it('es reproducible con la misma semilla', () => {
    const a = simulate(prep, polls.media.values, scenarios, { n: 40, seed: 7 });
    const b = simulate(prep, polls.media.values, scenarios, { n: 40, seed: 7 });
    expect(a).toEqual(b);
  });

  // Contraste con las cifras del vídeo (media de encuestas): Senado de Progreso con PP y
  // Vox por separado → la derecha llega a 3/5 en ~6 % de los casos; con Vox retirado, ~95 %.
  it('Senado (media): P(3/5) baja sin coordinación y alta con Vox retirado', () => {
    const only = scenarios.filter((s) => ['SENADO_PROGRESO', 'TERUEL_sin_FA_CHA'].includes(s.id));
    const sep = simulate(prep, polls.media.values, only, { n: 400 });
    const coord = simulate(prep, polls.media.values, [...only, { ...byId.VOX_retira_senado, prob: 1 }], { n: 400 });
    expect(sep.prob.senado35Derecha).toBeLessThan(0.2);
    // 95 % en el vídeo con su incertidumbre (VIDEO_NOISE); con la histórica por defecto, algo menos.
    expect(coord.prob.senado35Derecha).toBeGreaterThan(0.8);
    // (hipótesis del vídeo: retirada casi total de Vox)
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
  // mueven escaños; colocados de forma óptima (supuesto del vídeo) mueven ~7.
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
