import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { congress } from '../src/engine/congress.js';

const base = JSON.parse(fs.readFileSync('data/congreso-2023.json', 'utf8')).provinces;

describe('T1 · Congreso 2023 real', () => {
  const r = congress(base);

  it('reproduce el reparto nacional oficial', () => {
    expect(r.national).toEqual({
      PP: 137, PSOE: 121, VOX: 33, SUMAR: 31, ERC: 7, JUNTS: 7,
      BILDU: 6, PNV: 5, BNG: 1, CC: 1, UPN: 1,
    });
  });

  it('reproduce cada provincia', () => {
    for (const p of base) expect(r.byProvince[p.id], p.name).toEqual(p.elected);
  });

  it('bloques de la investidura de 2023: derecha 171, investidura sin Junts 172', () => {
    expect(r.blocs).toEqual({ derecha: 171, investidura: 172, junts: 7 });
  });
});
