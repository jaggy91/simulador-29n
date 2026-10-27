// Lectura y promedio de tablas de encuestas de en.wikipedia ("Opinion polling for the
// … Spanish general election"). Lo usan fetch-polls.js (2026) y backtest-2023.js.
import { parseGrid } from './grid.js';
import { normalizeParty } from './parties-map.js';

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const FIRST_PARTY_COL = 4; // empresa, fecha, muestra, participación
export const PARTY_POLLS = /^(PSOE|PP|Vox|Sumar|Podemos|FA)$/i;

export const round = (x) => Math.round(x * 100) / 100;
export const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

export const clean = (s) => s
  .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  .replace(/\{\{efn[^}]*\}\}/g, '').replace(/\{\{smaller\|([^}]*)\}\}/g, '$1')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''/g, '').trim();
const pct = (v) => {
  const m = clean(v).split('<br')[0].match(/^\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
function endDate(s, year) {
  const last = clean(s).split(/[–-]/).pop().trim();
  const m = last.match(/^(\d{1,2})\s+([A-Z][a-z]{2})(?:\s+(\d{4}))?/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3] || year), MONTHS[m[2]], Number(m[1])));
}

// jointColumns: columnas que equivalen a varios partidos (p. ej. SUMAR → FA+FV).
export function parseTable(table, title, { year, jointColumns = {} }) {
  // Columnas de partido: los {{party color|X}} de la segunda fila de cabecera.
  const header = table.slice(0, table.indexOf('\n|-\n|'));
  const colors = [...header.matchAll(/^!.*party color\|([^}]+)\}\}/gm)].map((m) => normalizeParty({ key: m[1].trim() }));
  const rows = [];
  for (const grid of parseGrid(table)) {
    if (grid.length < FIRST_PARTY_COL + colors.length) continue;
    const firm = clean(grid[0].value);
    const date = endDate(grid[1].value, year);
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
      if (jointColumns[colors[c]]) joint.push({ parties: jointColumns[colors[c]], value: v });
      else values[colors[c]] = v;
    }
    // Unas tablas dan PP+UPN juntos y otras por separado: se unifica como PP+UPN.
    if (values.UPN != null) {
      values.PP = round((values.PP || 0) + values.UPN);
      delete values.UPN;
    }
    const sample = Number(clean(grid[2].value).replace(/,/g, '')) || null;
    // Enlace a la encuesta: la primera referencia de la celda de la empresa.
    const url = grid[0].value.match(/url=\s*([^\s|}]+)/)?.[1] || null;
    rows.push({ firm, date: date.toISOString().slice(0, 10), sample, url, values, joint, table: title.replace(/=/g, '') });
  }
  return rows;
}

// Reparte una cifra conjunta según la proporción media en las encuestas que la separan.
export function resolveJoint(r, ref) {
  const values = { ...r.values };
  for (const j of r.joint) {
    const sep = ref.filter((x) => j.parties.every((p) => x.values[p] != null));
    const sums = j.parties.map((p) => sep.reduce((a, x) => a + x.values[p], 0));
    const total = sums.reduce((a, b) => a + b, 0);
    j.parties.forEach((p, i) => { values[p] = round(j.value * (total ? sums[i] / total : 1 / j.parties.length)); });
  }
  return values;
}

export function average(list, w) {
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

// Media de encuestas a fecha `asOf`: última encuesta de cada empresa en `windowDays`,
// peso = recencia (vida media `halfLife` días) × √muestra (tope 3.000; 1.000 si no
// consta). `include` filtra filas (sin CIS ni encuestas de partido por defecto).
export function pollAverage(rows, { asOf, windowDays = 21, halfLife = 7, include = () => true }) {
  const candidates = rows.filter((r) => r.date <= asOf && days(r.date, asOf) <= windowDays
    && !/^CIS\b/.test(r.firm) && !PARTY_POLLS.test(r.firm) && include(r));
  const byFirm = new Map();
  for (const r of candidates) {
    const key = r.firm.split('/')[0].trim();
    if (!byFirm.has(key) || byFirm.get(key).date < r.date) byFirm.set(key, r);
  }
  const used = [...byFirm.values()];
  const weights = used.map((r) => Math.pow(0.5, days(r.date, asOf) / halfLife) * Math.sqrt(Math.min(r.sample || 1000, 3000)));
  const resolved = used.map((r) => resolveJoint(r, rows));
  const W = weights.reduce((a, b) => a + b, 0);
  // items: una tarjeta por encuesta, con su peso normalizado y sus cifras resueltas.
  const items = used.map((r, i) => ({ id: `encuesta:${r.firm}|${r.date}`, firm: r.firm, date: r.date, sample: r.sample, url: r.url, weight: Math.round((1e4 * weights[i]) / W) / 1e4, values: resolved[i] }));
  return { used, items, values: average(resolved, weights) };
}
