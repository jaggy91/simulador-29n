// Genera data/andaluzas-2026.json: % por provincia de las autonómicas andaluzas
// del 17-may-2026. Es la base territorial de Adelante Andalucía, que en 2023 solo
// se presentó en Cádiz.
import fs from 'node:fs';
import { PROVINCES } from './lib/provinces.js';
import { fetchWikitext, extractTable, parseConstituencyGrid } from './lib/wiki.js';
import { normalizeParty } from './lib/parties-map.js';

const byWiki = Object.fromEntries(PROVINCES.map((p) => [p.wiki, p]));
const text = await fetchWikitext('2026 Andalusian regional election');
const { rows } = parseConstituencyGrid(extractTable(text, text.indexOf('===Distribution by constituency===')));
const out = rows.filter((r) => byWiki[r.label]).map((r) => ({
  id: byWiki[r.label].id,
  name: byWiki[r.label].name,
  pct: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [normalizeParty({ key: k }), v.pct])),
}));
if (out.length !== 8) throw new Error(`Se esperaban 8 provincias y hay ${out.length}`);
fs.writeFileSync('data/andaluzas-2026.json', JSON.stringify({ source: 'en.wikipedia (2026 Andalusian regional election)', unit: '% sobre válidos, 1 decimal', provinces: out }, null, 1));
for (const p of out) console.log(p.name, JSON.stringify(p.pct));
console.log('→ data/andaluzas-2026.json');
