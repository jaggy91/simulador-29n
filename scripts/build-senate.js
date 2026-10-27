// Genera data/senado-2023.json (votos por candidato y por partido en cada
// circunscripción del Senado) a partir de en.wikipedia.
import fs from 'node:fs';
import { SENATE } from './lib/provinces.js';
import { fetchWikitext, extractTable, parseSenateTable, parseResultsTable } from './lib/wiki.js';
import { normalizeParty } from './lib/parties-map.js';

const out = [];
const elected = {};
for (const c of SENATE) {
  const text = await fetchWikitext(`${c.wiki} (Senate constituency)`);
  const sec = text.search(/\n===\s*2023\s*===/);
  if (sec < 0) throw new Error(`${c.name}: sin sección 2023`);
  const table = extractTable(text, sec);
  // Voto de partido = media de sus candidatos (hasta maxVotes), que es lo que
  // usa el modelo cuando proyecta con votos de partido.
  const votes = {};
  const e = {};
  let candidates = null;
  if (/Candidates/.test(table.slice(0, 600))) {
    // Formato A: una fila por candidato, con {{tick}} en los electos.
    const cands = parseSenateTable(table).map((x) => ({ ...x, party: normalizeParty(x) }));
    const byParty = {};
    for (const x of cands) (byParty[x.party] ||= []).push(x.votes);
    for (const [p, vs] of Object.entries(byParty)) {
      const top = vs.sort((a, b) => b - a).slice(0, c.maxVotes);
      votes[p] = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
    }
    for (const x of cands.filter((x) => x.elected)) e[x.party] = (e[x.party] || 0) + 1;
    candidates = cands.map(({ candidate, party, votes, elected }) => ({ candidate, party, votes, elected }));
  } else {
    // Formato B: resumen por partido; los votos son la suma de sus candidatos.
    // Se asume que cada partido presenta maxVotes candidatos.
    for (const x of parseResultsTable(table).parties) {
      const p = normalizeParty(x);
      votes[p] = (votes[p] || 0) + Math.round(x.votes / c.maxVotes);
      if (x.seats) e[p] = (e[p] || 0) + x.seats;
    }
  }
  const won = Object.values(e).reduce((a, b) => a + b, 0);
  if (won !== c.seats) console.warn(`! ${c.name}: ${won} electos, esperados ${c.seats}`);
  for (const [p, n] of Object.entries(e)) elected[p] = (elected[p] || 0) + n;
  out.push({
    id: c.id, name: c.name, prov: c.prov, ccaa: c.ccaa, seats: c.seats, maxVotes: c.maxVotes,
    votes, elected: e, ...(candidates && { candidates }),
  });
}

const total = Object.values(elected).reduce((a, b) => a + b, 0);
console.log(`Senadores electos: ${total}`, JSON.stringify(elected));
fs.writeFileSync('data/senado-2023.json', JSON.stringify({ source: 'en.wikipedia (Senate constituency articles)', constituencies: out }, null, 1));
console.log('→ data/senado-2023.json');
