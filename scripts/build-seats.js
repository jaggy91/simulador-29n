// Genera data/seats-2026.json desde el anexo del Real Decreto 806/2026 (BOE-A-2026-20742).
import fs from 'node:fs';
import { PROVINCES } from './lib/provinces.js';

const BOE_ID = 'BOE-A-2026-20742';
const res = await fetch(`https://www.boe.es/diario_boe/txt.php?id=${BOE_ID}`);
if (!res.ok) throw new Error(`BOE ${res.status}`);
const text = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const HEADER = 'ANEXO Circunscripción Diputados';
const annex = text.slice(text.lastIndexOf(HEADER) + HEADER.length);

const UNITS = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const WORDS = {
  ...UNITS, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciséis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
};
const toNumber = (w) => {
  w = w.toLowerCase().trim();
  if (WORDS[w]) return WORDS[w];
  if (w.startsWith('veinti')) return 20 + UNITS[w.slice(6)];
  const m = w.match(/^(treinta|cuarenta) y (\w+)$/);
  if (m) return { treinta: 30, cuarenta: 40 }[m[1]] + UNITS[m[2]];
  if (w === 'treinta') return 30;
  throw new Error(`Número no reconocido: ${w}`);
};

// Nombre en el BOE → id de provincia.
const ALIAS = {
  'Alicante/Alacant': '03', 'Araba/Álava': '01', 'Balears (Illes)': '07', 'Castellón/Castelló': '12',
  'Coruña (A)': '15', 'Palmas (Las)': '35', 'Rioja (La)': '26', 'Valencia/València': '46',
};
const byName = Object.fromEntries(PROVINCES.map((p) => [p.name, p.id]));

const seats = {};
for (const m of annex.matchAll(/([A-ZÁÉÍÓÚÑ][^.]*?)\. ((?:[A-Za-zéí]+)(?: y [a-z]+)?)\./g)) {
  const name = m[1].trim();
  const id = ALIAS[name] || byName[name];
  if (!id) continue;
  seats[id] = toNumber(m[2]);
}
const total = Object.values(seats).reduce((a, b) => a + b, 0);
if (Object.keys(seats).length !== 52 || total !== 350) throw new Error(`Anexo incompleto: ${Object.keys(seats).length} circ., ${total} escaños`);

fs.writeFileSync('data/seats-2026.json', JSON.stringify({ source: `${BOE_ID} (Real Decreto 806/2026)`, seats }, null, 1));
const base = JSON.parse(fs.readFileSync('data/congreso-2023.json', 'utf8')).provinces;
for (const p of base) if (p.seats !== seats[p.id]) console.log(`${p.name}: ${p.seats} → ${seats[p.id]}`);
console.log('→ data/seats-2026.json');
