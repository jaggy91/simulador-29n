import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { senate } from '../src/engine/senate.js';

const base = JSON.parse(fs.readFileSync('data/senado-2023.json', 'utf8')).constituencies;
const LEFT = ['PSOE', 'SUMAR'];
const RIGHT = ['PP', 'VOX', 'UPN'];
const sum = (nat, ps) => ps.reduce((a, p) => a + (nat[p] || 0), 0);

describe('Senado 2023', () => {
  it('los datos suman 208 electos', () => {
    expect(base.reduce((a, c) => a + c.seats, 0)).toBe(208);
  });

  it('T5 · datos reales: PP 120 de 208', () => {
    const real = {};
    for (const c of base) for (const [p, n] of Object.entries(c.elected)) real[p] = (real[p] || 0) + n;
    expect(real.PP).toBe(120);
  });

  it('T5 · el modelo solo falla en carreras igualadas (voto cruzado 2+2)', () => {
    const r = senate(base);
    const diffs = base.filter((c) => JSON.stringify(sortObj(r.byConstituency[c.id])) !== JSON.stringify(sortObj(c.elected)));
    expect(diffs.map((c) => c.name).sort()).toEqual(['Badajoz', 'Cáceres', 'Huelva', 'Valencia']);
    for (const c of diffs) {
      const [a, b] = Object.values(c.votes).sort((x, y) => y - x);
      expect((a - b) / a, c.name).toBeLessThan(0.035);
    }
  });

  // T6 y T7 dependen de supuestos del vídeo que no conocemos: margen ±2 (plan §5).
  // Resultado actual del modelo: T6 → PP 82 / izq 114; T7 → dcha 124 / izq 76.
  // El vídeo cuadra exacto en T6 si Ceuta y Melilla se reparten 1+1, pero los
  // votos de 2023 muestran que allí cada elector marca 2 candidatos (2+0).
  it('T6 · PSOE+Sumar en lista conjunta: PP 80, izquierda 116 (±2)', () => {
    const r = senate(base, [{ into: 'PSOE', from: ['SUMAR'] }]);
    expect(Math.abs(r.national.PP - 80)).toBeLessThanOrEqual(2);
    expect(Math.abs(sum(r.national, LEFT) - 116)).toBeLessThanOrEqual(2);
  });

  it('T7 · ambas listas conjuntas: derecha 126, izquierda 75 (±2)', () => {
    const r = senate(base, [
      { into: 'PSOE', from: ['SUMAR'] },
      { into: 'PP', from: ['VOX', 'UPN'] },
    ]);
    expect(Math.abs(sum(r.national, RIGHT) - 126)).toBeLessThanOrEqual(2);
    expect(Math.abs(sum(r.national, LEFT) - 75)).toBeLessThanOrEqual(2);
  });
});

function sortObj(o) {
  return Object.fromEntries(Object.entries(o).sort());
}
