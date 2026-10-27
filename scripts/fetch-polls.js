// Lee las encuestas de en.wikipedia ("Opinion polling for the 2026 Spanish general
// election") y calcula dos fuentes:
//  - media: media ponderada (recencia y muestra) de la última encuesta de cada empresa
//    en los últimos 21 días, sin CIS ni encuestas encargadas por partidos.
//  - cis: media de las reestimaciones independientes de los datos brutos del último
//    barómetro del CIS (Opina 360, Ateneo del Dato, Target Point…), que es lo que el
//    vídeo de referencia llama "datos brutos del CIS".
// Uso: node scripts/fetch-polls.js [--cache]
import fs from 'node:fs';
import { fetchWikitext, extractTable } from './lib/wiki.js';
import { parseGrid } from './lib/grid.js';
import { normalizeParty } from './lib/parties-map.js';

const WINDOW_DAYS = 21;
const HALF_LIFE_DAYS = 7;
const PARTY_POLLS = /^(PSOE|PP|Vox|Sumar|Podemos|FA)$/i;
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// Dos tablas: desde que el Frente Amplio tiene nombre (FA y FV por separado) y la
// anterior, donde "Sumar" equivale a FA+FV juntos.
const SECTIONS = ['=====2026 (with Broad Front)=====', '=====2026 (before Broad Front)====='];
const FIRST_PARTY_COL = 4; // empresa, fecha, muestra, participación
const JOINT_COLUMNS = { SUMAR: ['FA', 'FV'] };

const clean = (s) => s
  .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  .replace(/\{\{efn[^}]*\}\}/g, '').replace(/\{\{smaller\|([^}]*)\}\}/g, '$1')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''/g, '').trim();
const pct = (v) => {
  const m = clean(v).split('<br')[0].match(/^\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
function endDate(s) {
  const last = clean(s).split(/[–-]/).pop().trim();
  const m = last.match(/^(\d{1,2})\s+([A-Z][a-z]{2})(?:\s+(\d{4}))?/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3] || 2026), MONTHS[m[2]], Number(m[1])));
}
const round = (x) => Math.round(x * 100) / 100;
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

function parseTable(table, title) {
  // Columnas de partido: los {{party color|X}} de la segunda fila de cabecera.
  const header = table.slice(0, table.indexOf('\n|-\n|'));
  const colors = [...header.matchAll(/^!.*party color\|([^}]+)\}\}/gm)].map((m) => normalizeParty({ key: m[1].trim() }));
  const rows = [];
  for (const grid of parseGrid(table)) {
    if (grid.length < FIRST_PARTY_COL + colors.length) continue;
    const firm = clean(grid[0].value);
    const date = endDate(grid[1].value);
    if (!firm || !date) continue;
    const values = {};
    const joint = [];
    for (let c = 0; c < colors.length; c++) {
      const cell = grid[FIRST_PARTY_COL + c];
      const v = pct(cell.value);
      if (cell.colspan > 1) {
        // Cifra conjunta de dos columnas (p. ej. FA+FV): se guarda una sola vez.
        if (grid[FIRST_PARTY_COL + c - 1] !== cell && v != null) joint.push({ parties: colors.slice(c, c + cell.colspan), value: v });
        continue;
      }
      if (v == null) continue;
      if (JOINT_COLUMNS[colors[c]]) joint.push({ parties: JOINT_COLUMNS[colors[c]], value: v });
      else values[colors[c]] = v;
    }
    // La tabla nueva da PP+UPN juntos; la vieja, por separado: se unifica como PP+UPN.
    if (values.UPN != null) {
      values.PP = round((values.PP || 0) + values.UPN);
      delete values.UPN;
    }
    const sample = Number(clean(grid[2].value).replace(/,/g, '')) || null;
    rows.push({ firm, date: date.toISOString().slice(0, 10), sample, values, joint, table: title.replace(/=/g, '') });
  }
  return rows;
}

// Reparte una cifra conjunta según la proporción media en las encuestas que la separan.
function resolveJoint(r, ref) {
  const values = { ...r.values };
  for (const j of r.joint) {
    const sep = ref.filter((x) => j.parties.every((p) => x.values[p] != null));
    const sums = j.parties.map((p) => sep.reduce((a, x) => a + x.values[p], 0));
    const total = sums.reduce((a, b) => a + b, 0);
    j.parties.forEach((p, i) => { values[p] = round(j.value * (total ? sums[i] / total : 1 / j.parties.length)); });
  }
  return values;
}

function average(list, w) {
  const acc = {};
  const wsum = {};
  list.forEach((vals, i) => {
    for (const [p, v] of Object.entries(vals)) {
      acc[p] = (acc[p] || 0) + v * w[i];
      wsum[p] = (wsum[p] || 0) + w[i];
    }
  });
  return Object.fromEntries(Object.keys(acc).map((p) => [p, round(acc[p] / wsum[p])]));
}

const text = await fetchWikitext('Opinion polling for the 2026 Spanish general election', { cache: process.argv.includes('--cache') });
const rows = SECTIONS.flatMap((title) => {
  const at = text.indexOf(title);
  if (at < 0) throw new Error(`No encuentro la sección ${title}`);
  return parseTable(extractTable(text, at), title);
});
const latest = rows.reduce((d, r) => (r.date > d ? r.date : d), '');

// --- Media de encuestas -----------------------------------------------------
const isCIS = (r) => /^CIS\b/.test(r.firm);
const hasLeft = (r) => r.values.FA != null || r.joint.some((j) => j.parties.includes('FA'));
const candidates = rows.filter((r) => !isCIS(r) && !PARTY_POLLS.test(r.firm) && days(r.date, latest) <= WINDOW_DAYS && hasLeft(r));
const byFirm = new Map();
for (const r of candidates) {
  const key = r.firm.split('/')[0].trim();
  if (!byFirm.has(key) || byFirm.get(key).date < r.date) byFirm.set(key, r);
}
const used = [...byFirm.values()];
const weights = used.map((r) => Math.pow(0.5, days(r.date, latest) / HALF_LIFE_DAYS) * Math.sqrt(Math.min(r.sample || 1000, 3000)));
const media = average(used.map((r) => resolveJoint(r, rows)), weights);

// --- CIS (reestimaciones de datos brutos) ------------------------------------
const alt = rows.filter((r) => /^CIS \(/.test(r.firm));
const lastCIS = alt.reduce((d, r) => (r.date > d ? r.date : d), '');
const cisRows = alt.filter((r) => r.date === lastCIS);
const cisAvg = average(cisRows.map((r) => resolveJoint(r, rows)), cisRows.map(() => 1));
// Las reestimaciones no suelen dar partidos regionales: se completan con la media.
const cis = { ...Object.fromEntries(Object.entries(media).filter(([p]) => !(p in cisAvg))), ...cisAvg };

const out = {
  source: 'en.wikipedia: Opinion polling for the 2026 Spanish general election',
  fetched: new Date().toISOString(),
  latestPoll: latest,
  sources: {
    media: {
      label: 'Media de encuestas',
      method: `última encuesta por empresa, ${WINDOW_DAYS} días, peso recencia (vida media ${HALF_LIFE_DAYS} d) × √muestra; sin CIS ni encuestas de partido`,
      polls: used.map((r) => `${r.firm} (${r.date})`),
      values: media,
    },
    cis: {
      label: 'CIS (datos brutos reestimados)',
      method: `media de reestimaciones independientes del barómetro con campo hasta ${lastCIS}; partidos que no dan, de la media`,
      polls: cisRows.map((r) => r.firm),
      values: cis,
    },
  },
  rows,
};
fs.writeFileSync('data/polls.json', JSON.stringify(out, null, 1));
console.log(`${rows.length} encuestas leídas; última ${latest}`);
for (const s of Object.values(out.sources)) {
  console.log(`\n${s.label} (${s.polls.length}): ${s.polls.join(', ')}`);
  console.log(' ', Object.entries(s.values).map(([p, v]) => `${p} ${v}`).join(' · '));
}
console.log('→ data/polls.json');
