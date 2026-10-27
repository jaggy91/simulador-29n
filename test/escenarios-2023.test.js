import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { congress } from '../src/engine/congress.js';
import { withdraw, split, smallProvinces, optimizeExtraVotes } from '../src/engine/scenarios.js';

const base = JSON.parse(fs.readFileSync('data/congreso-2023.json', 'utf8')).provinces;
import { BLOCS } from '../src/engine/blocs.js';

const near = (x, target, tol = 2) => expect(Math.abs(x - target), `${x} vs ${target}`).toBeLessThanOrEqual(tol);

describe('Escenarios sobre votos de 2023', () => {
  const small = smallProvinces(base);

  it('hay 29 provincias de ≤5 escaños y Sumar no sacó escaño en ninguna', () => {
    expect(small).toHaveLength(29);
    for (const p of base.filter((p) => small.includes(p.id))) expect(p.elected.SUMAR || 0, p.name).toBe(0);
  });

  it('T2 · Sumar y Podemos separados (proporción de las europeas 2024): extrema izq. 17, PSOE 129, PP 142, derecha 176', () => {
    const eu = JSON.parse(fs.readFileSync('data/europeas-2024.json', 'utf8')).provinces;
    const weights = Object.fromEntries(eu.map((p) => [p.id, { SUMAR: p.pct.SUMAR, PODEMOS: p.pct.PODEMOS }]));
    const r = congress(split(base, { from: 'SUMAR', weights }));
    expect(r.national.SUMAR + r.national.PODEMOS).toBe(17);
    expect(r.national.PSOE).toBe(129);
    expect(r.national.PP).toBe(142);
    expect(r.blocs.derecha).toBe(176);
  });

  it('T3 ·Sumar fuera de las pequeñas, 100 % al PSOE: PSOE 131, PP 132, investidura 181, derecha 162', () => {
    const r = congress(withdraw(base, { from: 'SUMAR', to: 'PSOE', ids: small, share: 1 }));
    expect(r.national.PSOE).toBe(131);
    expect(r.national.PP).toBe(132);
    expect(r.blocs.investidura).toBe(181);
    expect(r.blocs.derecha).toBe(162);
  });

  it('T4 · ídem con trasvase del 70 %: investidura 179', () => {
    const r = congress(withdraw(base, { from: 'SUMAR', to: 'PSOE', ids: small, share: 0.7 }));
    expect(r.blocs.investidura).toBe(179);
  });

  it('T8 · 14.000 votos al PSOE colocados de forma óptima: PSOE +7, investidura 179, derecha 166', () => {
    const { provinces, extra } = optimizeExtraVotes(base, { party: 'PSOE', budget: 14000, allies: BLOCS.investidura });
    const r = congress(provinces);
    expect(r.national.PSOE - 121).toBe(7);
    expect(r.blocs).toEqual({ derecha: 166, investidura: 179, junts: 5 });
    // El vídeo menciona Cuenca, Málaga, Ceuta y Salamanca.
    expect(Object.keys(extra)).toEqual(expect.arrayContaining(['16', '29', '51', '37']));
  });
});
