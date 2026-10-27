// Genera data/senado-designados.json: senadores designados por los parlamentos
// autonómicos. Convención habitual: reparto proporcional (D'Hondt) sobre los escaños
// del parlamento vigente. Se valida contra la tabla de Wikipedia en las comunidades
// que no han votado desde que se hizo esa tabla.
import fs from 'node:fs';
import { fetchWikitext, extractTable, parseResultsTable } from './lib/wiki.js';
import { normalizeParty } from './lib/parties-map.js';
import { dhondt } from '../src/engine/dhondt.js';

// Comunidad: designados (Wikipedia, "Senate of Spain") y última autonómica.
const CCAA = [
  ['Andalucía', 'Andalusia', 9, '2026 Andalusian regional election'],
  ['Aragón', 'Aragon', 2, '2026 Aragonese regional election'],
  ['Asturias', 'Asturias', 2, '2023 Asturian regional election'],
  ['Baleares', 'Balearic Islands', 2, '2023 Balearic regional election'],
  ['País Vasco', 'Basque Country', 3, '2024 Basque regional election'],
  ['Canarias', 'Canary Islands', 3, '2023 Canarian regional election'],
  ['Cantabria', 'Cantabria', 1, '2023 Cantabrian regional election'],
  ['Castilla y León', 'Castile and León', 3, '2026 Castilian-Leonese regional election'],
  ['Castilla-La Mancha', 'Castilla–La Mancha', 3, '2023 Castilian-Manchegan regional election'],
  ['Cataluña', 'Catalonia', 8, '2024 Catalan regional election'],
  ['Extremadura', 'Extremadura', 2, '2025 Extremaduran regional election'],
  ['Galicia', 'Galicia', 3, '2024 Galician regional election'],
  ['La Rioja', 'La Rioja', 1, '2023 Riojan regional election'],
  ['Madrid', 'Madrid', 7, '2023 Madrilenian regional election'],
  ['Murcia', 'Murcia', 2, '2023 Murcian regional election'],
  ['Navarra', 'Navarre', 1, '2023 Navarrese regional election'],
  ['Comunidad Valenciana', 'Valencian Community', 6, '2023 Valencian regional election'],
];

// Reparto actual según la tabla de Wikipedia (para validar).
const senate = await fetchWikitext('Senate of Spain', { cache: false });
const sec = senate.slice(senate.indexOf('===Regional legislatures-appointed members==='));
const wikiDist = {};
for (const block of sec.split(/\n\|-\n\| align=left\| /).slice(1)) {
  const name = block.match(/^\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/)?.[1];
  const election = block.match(/\[\[(\d{4}) [^|]*regional election\|/)?.[1];
  const dist = {};
  for (const m of block.matchAll(/party color\|([^}]+)\}\};[^|]*\|\s*(\d+)/g)) {
    const p = normalizeParty({ key: m[1].trim() });
    dist[p] = (dist[p] || 0) + Number(m[2]);
  }
  wikiDist[name] = { election, dist };
}

const out = [];
for (const [name, wiki, count, title] of CCAA) {
  const text = await fetchWikitext(title);
  // Primera tabla tras "==Results==" (algunas páginas no tienen subsección "Overall").
  const at = text.search(/\n==\s*Results\s*==/);
  const r = parseResultsTable(extractTable(text, at));
  const seats = {};
  for (const p of r.parties) if (p.seats) {
    const id = normalizeParty(p);
    seats[id] = (seats[id] || 0) + p.seats;
  }
  const total = Object.values(seats).reduce((a, b) => a + b, 0);
  // D'Hondt sobre escaños, sin umbral.
  const estimate = dhondt(seats, count, total, 0);
  const w = wikiDist[wiki];
  const sameElection = w && title.startsWith(w.election);
  const match = sameElection ? JSON.stringify(sort(estimate)) === JSON.stringify(sort(w.dist)) : null;
  // Donde no ha habido elecciones desde la tabla de Wikipedia, se usa el reparto real
  // (algunos parlamentos no siguen D'Hondt: País Vasco, C. Valenciana). Si no, la estimación.
  const designated = sameElection ? w.dist : estimate;
  out.push({ ccaa: name, count, election: title, parliament: seats, designated, source: sameElection ? 'real' : "estimación D'Hondt", dhondt: estimate, dhondtMatchesReal: match });
  console.log(`${name.padEnd(22)} ${String(count).padStart(2)}  ${JSON.stringify(designated).padEnd(42)} ${sameElection ? 'real' + (match ? '' : ` (D'Hondt daría ${JSON.stringify(estimate)})`) : "estimación D'Hondt · " + JSON.stringify(seats)}`);
}

const nat = {};
for (const c of out) for (const [p, n] of Object.entries(c.designated)) nat[p] = (nat[p] || 0) + n;
console.log('\nTotal', out.reduce((a, c) => a + c.count, 0), JSON.stringify(nat));
fs.writeFileSync('data/senado-designados.json', JSON.stringify({ method: "D'Hondt sobre escaños del parlamento autonómico vigente", ccaa: out, total: nat }, null, 1));
console.log('→ data/senado-designados.json');

function sort(o) { return Object.fromEntries(Object.entries(o).sort()); }
