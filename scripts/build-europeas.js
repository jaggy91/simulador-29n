// Genera data/europeas-2024.json: % por provincia de las europeas de 2024
// (tabla "Summary of constituency results" de en.wikipedia). Se usa para dividir
// el voto de Sumar 2023 entre Sumar y Podemos y como base de SALF.
import fs from 'node:fs';
import { PROVINCES } from './lib/provinces.js';
import { fetchWikitext, extractTable, parseConstituencyGrid } from './lib/wiki.js';
import { normalizeParty } from './lib/parties-map.js';

const byWiki = Object.fromEntries(PROVINCES.map((p) => [p.wiki, p]));

const text = await fetchWikitext('Results of the 2024 European Parliament election in Spain');
const at = text.indexOf('Summary of constituency results in the 9 June 2024');
const { rows } = parseConstituencyGrid(extractTable(text, text.lastIndexOf('{|', at)));

const out = rows
  .filter((r) => byWiki[r.label]) // descarta filas de comunidades autónomas
  .map((r) => ({
    id: byWiki[r.label].id,
    name: byWiki[r.label].name,
    pct: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [normalizeParty({ key: k }), v.pct])),
  }));

if (out.length !== 52) throw new Error(`Se esperaban 52 provincias y hay ${out.length}`);
fs.writeFileSync('data/europeas-2024.json', JSON.stringify({ source: 'en.wikipedia (Results of the 2024 European Parliament election in Spain)', unit: '% sobre válidos, 1 decimal', provinces: out }, null, 1));
for (const p of out.filter((p) => ['28', '08', '44'].includes(p.id))) console.log(p.name, JSON.stringify(p.pct));
console.log('→ data/europeas-2024.json');
