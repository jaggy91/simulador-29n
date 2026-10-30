import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { inVeda, VEDA_FILES, stripVeda, DEPLOY_MARGIN_HOURS } from '../src/veda.js';
import { loadModelData } from '../scripts/lib/load-data.js';
import { prepare, run } from '../src/engine/model.js';

const veda = JSON.parse(fs.readFileSync('data/veda.json', 'utf8'));
const metodologia = fs.readFileSync('METODOLOGIA.md', 'utf8');
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

describe('Veda electoral (LOREG, art. 69.7)', () => {
  it('del 24-nov a las 00:00 peninsulares al cierre de las urnas en Canarias el 29-N', () => {
    expect(inVeda('2026-11-23T22:59:59Z')).toBe(false); // 23:59:59 en Madrid
    expect(inVeda('2026-11-23T23:00:00Z')).toBe(true); // 00:00 del 24 en Madrid
    expect(inVeda('2026-11-29T19:59:59Z')).toBe(true); // 19:59:59 en Canarias
    expect(inVeda('2026-11-29T20:00:00Z')).toBe(false); // cierre de las urnas en Canarias
  });

  it('el despliegue de la versión de veda empieza antes, con margen', () => {
    const before = Date.parse('2026-11-23T23:00:00Z') - (DEPLOY_MARGIN_HOURS - 1) * 3600e3;
    expect(inVeda(before)).toBe(false);
    expect(inVeda(before, { marginHours: DEPLOY_MARGIN_HOURS })).toBe(true);
  });

  it('la versión de veda no publica ningún dato de encuestas', () => {
    for (const f of ['state', 'polls', 'history', 'sources', 'spectrum', 'news', 'backtest-2023']) expect(VEDA_FILES).not.toContain(f);
    for (const f of VEDA_FILES) expect(fs.existsSync(`data/${f}.json`), f).toBe(true);
  });

  it('veda.json: tarjetas sin sondeos y el resultado real de 2023 como punto de partida', () => {
    expect(veda.cards.some((c) => c.sondeo)).toBe(false);
    expect(veda.cards.map((c) => c.id)).not.toContain('data10-seguimiento-listas');
    expect(JSON.stringify(veda)).not.toMatch(/Data 10|encuesta/i);
    // Generales 2023 (% sobre válidos): PP 33,05 + UPN 0,21; PSOE 31,70; Vox 12,39.
    expect(veda.base2023.PP).toBeCloseTo(33.26, 1);
    expect(veda.base2023.PSOE).toBeCloseTo(31.7, 1);
    expect(veda.base2023.VOX).toBeCloseTo(12.39, 1);
    expect(veda.base2023.SALF).toBe(0);
    expect(total(veda.base2023)).toBeLessThan(99.5);
  });

  // Con la izquierda dividida como en 2026, el voto de 2023 da a la derecha lo mismo que
  // T2 (Sumar y Podemos por separado: 176), con los escaños de 2026 y la oferta de 2026.
  it('con el resultado de 2023 de partida, la derecha queda como en T2 (izquierda dividida)', () => {
    const r = run(prepare(loadModelData()), veda.base2023, []);
    expect(r.congress.national.SALF).toBeUndefined();
    expect(Math.abs(r.congress.blocs.derecha - 176)).toBeLessThanOrEqual(2);
  });

  it('la metodología de la veda no contiene cifras ni empresas de encuestas', () => {
    expect(metodologia.match(/<!-- veda -->/g).length).toBe(metodologia.match(/<!-- \/veda -->/g).length);
    const text = stripVeda(metodologia);
    expect(text).not.toMatch(/<!-- \/?veda -->/);
    // Cifras del corte del 27-oct (modelo del 27 y del 28-oct): encuestas, probabilidades, seguimiento y nombre de la encuesta de seguimiento.
    for (const s of ['31,30', '26,76', '22,30', '34,00', '28,15', '97,2 %', '67,7 %', '2,5 %', '94 %', '86 %', '92 %', '95 %', 'Opina 360', 'Ateneo del Dato', '31,4', '97,9 %', '74,0 %', '4,6 %', 'Data 10', 'OKDiario']) {
      expect(text, s).not.toContain(s);
    }
    // El método sigue ahí.
    expect(text).toContain("### 4.3 Congreso: D'Hondt");
    expect(text).toContain('### 5.3 Backtest 2019 → 2023');
  });
});
