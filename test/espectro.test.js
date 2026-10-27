import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadModelData } from '../scripts/lib/load-data.js';
import { prepare, run } from '../src/engine/model.js';
import { LEVERS, levelInputs, activeLevers, swingPoll } from '../src/engine/spectrum.js';
import { transfer } from '../src/engine/scenarios.js';

const prep = prepare(loadModelData());
const polls = JSON.parse(fs.readFileSync('data/polls.json', 'utf8')).sources;
const { scenarios } = JSON.parse(fs.readFileSync('data/scenarios.json', 'utf8'));
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const certain = (sc) => sc.filter((s) => s.prob >= 1 && s.kind !== 'base');

describe('Espectro izquierda ↔ derecha', () => {
  it('5 escenarios por lado y el nivel 0 es la proyección oficial', () => {
    expect(LEVERS.izquierda).toHaveLength(5);
    expect(LEVERS.derecha).toHaveLength(5);
    const zero = levelInputs(0, polls.media.values, scenarios);
    expect(zero.poll).toEqual(polls.media.values);
    expect(zero.scenarios).toEqual(scenarios);
    expect(zero.active).toEqual([]);
  });

  it('los niveles son acumulativos y los sustituidos se descartan', () => {
    expect(activeLevers(-3).map((l) => l.id)).toEqual(['ENC_PSOE_40', 'UTIL_FA_PSOE', 'PACTO_FLOJO']);
    expect(activeLevers(-4).map((l) => l.id)).toEqual(['UTIL_FA_PSOE', 'PACTO_FLOJO', 'ENC_PSOE_100']);
    expect(activeLevers(5).map((l) => l.id)).toEqual(['UTIL_VOX_PP', 'PACTO_PLENO_SALF', 'DESMOV_IZQ', 'ENC_DCHA_4']);
  });

  it('las modificaciones de encuesta conservan la suma', () => {
    for (let l = -5; l <= 5; l++) {
      const { poll } = levelInputs(l, polls.media.values, scenarios);
      expect(Math.abs(total(poll) - total(polls.media.values)), `nivel ${l}`).toBeLessThan(0.05);
    }
  });

  it('el fallo de 2023 completo sube al PSOE 5,31 puntos', () => {
    const { poll } = levelInputs(-4, polls.media.values, scenarios);
    expect(poll.PSOE - polls.media.values.PSOE).toBeCloseTo(5.31, 2);
  });

  it('la derecha baja hacia la izquierda y sube hacia la derecha (proyección central)', () => {
    const right = (l) => {
      const i = levelInputs(l, polls.media.values, scenarios);
      return run(prep, i.poll, certain(i.scenarios)).congress.blocs.derecha;
    };
    expect(right(-5)).toBeLessThan(right(0));
    expect(right(5)).toBeGreaterThan(right(0));
  });

  it('voto útil: traslada la fracción sin retirar al partido', () => {
    const [p] = transfer([{ id: '05', votes: { FA: 1000, PSOE: 5000 } }], { from: 'FA', to: 'PSOE', ids: ['05'], fraction: 0.3 });
    expect(p.votes).toEqual({ FA: 700, PSOE: 5300 });
  });

  it('swingPoll traslada puntos entre bloques sin cambiar la suma', () => {
    const s = swingPoll(polls.media.values, 2);
    expect(Math.abs(total(s) - total(polls.media.values))).toBeLessThan(1e-9);
    expect(s.PP + s.VOX - polls.media.values.PP - polls.media.values.VOX).toBeCloseTo(2, 5);
  });
});
