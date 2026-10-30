// Calcula tres fuentes de intención de voto:
//  - media: media ponderada (recencia y muestra) de la última encuesta de cada empresa
//    en los últimos 21 días, sin CIS ni encuestas encargadas por partidos. Índice: la
//    tabla de en.wikipedia "Opinion polling for the 2026 Spanish general election";
//    cada encuesta enlaza a su publicación original.
//  - cisOficial: estimación de voto oficial del último barómetro del CIS, leída del
//    PDF que publica el CIS (cis.es).
//  - cis: media de las reestimaciones independientes de los datos brutos de ese mismo
//    barómetro (Opina 360, Ateneo del Dato, Target Point…).
// Uso: node scripts/fetch-polls.js [--cache]
import fs from 'node:fs';
import { fetchWikitext, extractTable } from './lib/wiki.js';
import { parseTable, pollAverage, resolveJoint, average } from './lib/polls.js';
import { cisEstimate } from './lib/cis.js';
import { verifyPolls, publicCheck, checkKey } from './lib/verify-polls.js';

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

// --- CIS oficial (PDF de cis.es) ------------------------------------------------
const official = rows.filter((r) => r.firm === 'CIS').sort((a, b) => b.date.localeCompare(a.date))[0];
// El enlace del barómetro lleva el número de estudio: …/es3582mar_a-pdf → 3582.
const study = official?.url?.match(/es(\d{4})/)?.[1];
if (!study) throw new Error('No encuentro el último barómetro del CIS');
const est = await cisEstimate(study);
const estValues = resolveJoint({ values: est.values, joint: est.joint }, rows);
const cisOficial = { ...Object.fromEntries(Object.entries(media).filter(([p]) => !(p in estValues))), ...estValues };
const cisOficialItems = [{ id: `cis-oficial:${study}`, firm: `CIS · estimación oficial (estudio ${study})`, date: official.date, sample: official.sample, url: est.url, weight: 1, values: estValues }];

// --- Verificación por otro canal ------------------------------------------------
// El índice es Wikipedia; cada encuesta de las fuentes se intenta comprobar en su
// publicación original (texto o gráficos Datawrapper) o en el RSS del medio.
const INDEX = 'Wikipedia: Opinion polling for the 2026 Spanish general election';
const cache = fs.existsSync('data/poll-checks.json') ? JSON.parse(fs.readFileSync('data/poll-checks.json', 'utf8')) : {};
const checks = await verifyPolls([...used, ...cisRows], cache);
fs.writeFileSync('data/poll-checks.json', JSON.stringify(checks, null, 1));
const withCheck = (items, rowsFor) => items.forEach((it, i) => { it.index = INDEX; it.check = publicCheck(checks[checkKey(rowsFor[i])]); });
withCheck(mediaItems, used);
withCheck(cisItems, cisRows);
// La estimación oficial del CIS se lee directamente de su PDF: es la fuente original.
cisOficialItems[0].index = INDEX;
cisOficialItems[0].check = { status: 'verificada', channel: 'PDF oficial del CIS (cis.es)', url: est.url, checked: new Date().toISOString() };
const nv = Object.values(checks).filter((c) => c.status === 'verificada').length;
console.log(`Verificación: ${nv} de ${Object.keys(checks).length} encuestas verificadas por otro canal`);

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
    cisOficial: {
      label: 'CIS · estimación oficial',
      method: `estimación de voto del CIS (estudio ${study}, campo hasta ${official.date}), leída de cis.es; partidos que no da, de la media`,
      polls: [`CIS, estudio ${study}`],
      items: cisOficialItems,
      values: cisOficial,
    },
    cis: {
      label: 'CIS · reestimaciones independientes',
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
