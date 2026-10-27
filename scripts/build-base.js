// Genera data/congreso-2023.json a partir de los artículos de cada circunscripción
// en en.wikipedia. Uso: node scripts/build-base.js [--explore]
import fs from 'node:fs';
import { PROVINCES } from './lib/provinces.js';
import { fetchWikitext, extractTable, parseResultsTable } from './lib/wiki.js';
import { normalizeParty } from './lib/parties-map.js';

const explore = process.argv.includes('--explore');

async function congressProvince(p) {
  const text = await fetchWikitext(`${p.wiki} (Congress of Deputies constituency)`);
  const sec = text.search(/\n===\s*2023\s*===/);
  if (sec < 0) throw new Error(`${p.name}: sin sección 2023`);
  return parseResultsTable(extractTable(text, sec));
}

const out = [];
const unknown = new Map();
for (const p of PROVINCES) {
  const r = await congressProvince(p);
  const votes = {};
  let seats = 0;
  const elected = {};
  for (const party of r.parties) {
    const k = normalizeParty(party);
    if (k.startsWith('x:')) unknown.set(k, (unknown.get(k) || '') + p.name + ' ');
    votes[k] = (votes[k] || 0) + party.votes;
    if (party.seats) elected[k] = (elected[k] || 0) + party.seats;
    seats += party.seats;
  }
  const candidaturas = Object.values(votes).reduce((a, b) => a + b, 0);
  // Los válidos se calculan siempre: Wikipedia tiene erratas (Cáceres: +40.000).
  const valid = candidaturas + r.blank;
  if (r.valid != null && r.valid !== valid)
    console.warn(`! ${p.name}: válidos en Wikipedia=${r.valid}, calculados=${valid} (se usan los calculados)`);
  out.push({ id: p.id, name: p.name, ccaa: p.ccaa, seats, votes, blank: r.blank, valid, elected });
  if (explore) console.log(p.name, seats, JSON.stringify(r.parties.map((x) => [x.abbr, x.votes, x.seats])));
}

if (unknown.size && explore) {
  console.log('\nPartidos sin mapear (van a OTROS):');
  for (const [k, v] of unknown) console.log(' ', k, '→', v);
}

const tot = (f) => out.reduce((a, p) => a + f(p), 0);
const nat = {};
for (const p of out) for (const [k, v] of Object.entries(p.elected)) nat[k] = (nat[k] || 0) + v;
console.log(`\nEscaños: ${tot((p) => p.seats)} · Válidos: ${tot((p) => p.valid).toLocaleString('es')}`);
console.log('Electos:', JSON.stringify(nat));

if (!explore) {
  fs.writeFileSync('data/congreso-2023.json', JSON.stringify({ source: 'en.wikipedia (constituency articles)', provinces: out }, null, 1));
  console.log('→ data/congreso-2023.json');
}
