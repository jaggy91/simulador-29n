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
import { parseTable, pollAverage, resolveJoint, average } from './lib/polls.js';

const WINDOW_DAYS = 21;
const HALF_LIFE_DAYS = 7;
// Dos tablas: desde que el Frente Amplio tiene nombre (FA y FV por separado) y la
// anterior, donde "Sumar" equivale a FA+FV juntos.
const SECTIONS = ['=====2026 (with Broad Front)=====', '=====2026 (before Broad Front)====='];
const JOINT_COLUMNS = { SUMAR: ['FA', 'FV'] };

const text = await fetchWikitext('Opinion polling for the 2026 Spanish general election', { cache: process.argv.includes('--cache') });
const rows = SECTIONS.flatMap((title) => {
  const at = text.indexOf(title);
  if (at < 0) throw new Error(`No encuentro la sección ${title}`);
  return parseTable(extractTable(text, at), title, { year: 2026, jointColumns: JOINT_COLUMNS });
});
const latest = rows.reduce((d, r) => (r.date > d ? r.date : d), '');

// --- Media de encuestas -----------------------------------------------------
const hasLeft = (r) => r.values.FA != null || r.joint.some((j) => j.parties.includes('FA'));
const { used, items: mediaItems, values: media } = pollAverage(rows, { asOf: latest, windowDays: WINDOW_DAYS, halfLife: HALF_LIFE_DAYS, include: hasLeft });

// --- CIS (reestimaciones de datos brutos) ------------------------------------
const alt = rows.filter((r) => /^CIS \(/.test(r.firm));
const lastCIS = alt.reduce((d, r) => (r.date > d ? r.date : d), '');
const cisRows = alt.filter((r) => r.date === lastCIS);
const cisResolved = cisRows.map((r) => resolveJoint(r, rows));
const cisAvg = average(cisResolved, cisRows.map(() => 1));
const cisItems = cisRows.map((r, i) => ({ id: `cis:${r.firm}|${r.date}`, firm: r.firm, date: r.date, sample: r.sample, url: r.url, weight: Math.round(1e4 / cisRows.length) / 1e4, values: cisResolved[i] }));
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
      items: mediaItems,
      values: media,
    },
    cis: {
      label: 'CIS (datos brutos reestimados)',
      method: `media de reestimaciones independientes del barómetro con campo hasta ${lastCIS}; partidos que no dan, de la media`,
      polls: cisRows.map((r) => r.firm),
      items: cisItems,
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
