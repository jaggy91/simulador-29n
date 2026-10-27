// Descarga y parseo de wikitext de Wikipedia (tablas "Summary of ... election results").
import fs from 'node:fs';
import path from 'node:path';

const CACHE = path.resolve('.cache/wiki');
const UA = 'simulador-29n/0.1 (https://github.com/; datos electorales)';

export async function fetchWikitext(title, { lang = 'en', cache = true } = {}) {
  const file = path.join(CACHE, lang, encodeURIComponent(title) + '.wiki');
  if (cache && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const url = `https://${lang}.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&action=raw&redirect=yes`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} al descargar ${title}`);
  let text = await res.text();
  const redirect = text.match(/^#REDIRECT\s*\[\[([^\]#|]+)/i);
  if (redirect) text = await fetchWikitext(redirect[1], { lang, cache });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return text;
}

const num = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/'''/g, '').match(/-?[\d,.]+/);
  return m ? Number(m[0].replace(/,/g, '')) : null;
};

// Quita la parte de atributos de una celda: `style="..."| valor` → `valor`.
const cellValue = (c) => {
  const i = c.indexOf('|');
  return (i >= 0 && /=/.test(c.slice(0, i)) ? c.slice(i + 1) : c).trim();
};

// Extrae el primer bloque {| ... |} que empieza tras `fromIndex`.
export function extractTable(text, fromIndex = 0) {
  const start = text.indexOf('{|', fromIndex);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '|') depth++;
    else if (text[i] === '|' && text[i + 1] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 2);
    }
  }
  return null;
}

// Parsea una tabla de resultados del Senado (una fila por candidato).
export function parseSenateTable(table) {
  const out = [];
  for (const row of table.split(/\n\|-[^\n]*/).slice(1)) {
    const cells = row
      .split('\n')
      .filter((l) => l.startsWith('|') && !l.startsWith('|}') && !l.startsWith('|+'))
      .flatMap((l) => l.slice(1).split('||'));
    const color = cells.join(' ').match(/party color\|([^}]+)\}\}/);
    const left = cells.map((c, i) => [c, i]).filter(([c]) => /align="left"/.test(c));
    if (left.length < 2) continue;
    const [candCell] = left[0];
    const [partyCell, partyIdx] = left[1];
    const votes = num(cellValue(cells[partyIdx + 1] || ''));
    if (votes == null) continue;
    const abbr = cellValue(partyCell).replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/<sup>.*?<\/sup>/g, '').trim();
    out.push({
      candidate: cellValue(candCell).replace(/\{\{tick[^}]*\}\}|•/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').trim(),
      elected: /\{\{tick/.test(candCell),
      key: color ? color[1].trim() : null,
      abbr,
      label: abbr,
      votes,
    });
  }
  return out;
}

// Parsea una tabla de resultados al estilo de Wikipedia en inglés.
export function parseResultsTable(table) {
  const out = { parties: [], blank: 0, valid: null, invalid: null, cast: null, electorate: null };
  const rows = table.split(/\n\|-[^\n]*/).slice(1);
  for (const row of rows) {
    const cells = row
      .split('\n')
      .filter((l) => l.startsWith('|') && !l.startsWith('|}') && !l.startsWith('|+'))
      .flatMap((l) => l.slice(1).split('||'));
    const text = cells.join(' ');
    const labelIdx = cells.findIndex((c) => /align="left"/.test(c));
    if (labelIdx < 0) continue;
    const label = cellValue(cells[labelIdx]);
    const after = cells.slice(labelIdx + 1).map(cellValue);
    if (/^Blank ballots/i.test(label)) out.blank = num(after[0]);
    else if (/^Valid votes/i.test(label)) out.valid = num(after[0]);
    else if (/^Invalid votes/i.test(label)) out.invalid = num(after[0]);
    else if (/^Votes cast/i.test(label)) out.cast = num(after[0]);
    else if (/^Registered voters/i.test(label)) out.electorate = num(after[0]);
    else if (/^(Total|Abstentions|Sources)/i.test(label)) continue;
    else {
      const votes = num(after[0]);
      if (votes == null) continue;
      const color = text.match(/party color\|([^}]+)\}\}/);
      const abbr = label.match(/\(([^()]+)\)(?:<sup>[^<]*<\/sup>)?\s*$/);
      out.parties.push({
        key: color ? color[1].trim() : null,
        abbr: abbr ? abbr[1].trim() : null,
        label: label.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/<sup>.*?<\/sup>/g, '').trim(),
        votes,
        seats: num(after[3]) ?? 0,
      });
    }
  }
  return out;
}

// Parsea una tabla "Summary of constituency results" (una fila por circunscripción,
// dos celdas % y escaños por partido, celdas grises con colspan/rowspan donde el
// partido no se presenta). Las columnas salen de los {{party color|X}} de la cabecera.
// Devuelve [{label, values: {claveParty: {pct, seats}}}].
export function parseConstituencyGrid(table) {
  const [head, ...rows] = table.split(/\n\|-[^\n]*/);
  const headerRows = [head, ...rows].filter((r) => /^\s*!/m.test(r));
  const colorRow = headerRows.find((r) => /!\s*colspan="2"\s*style="background:\{\{party color\|/.test(r));
  const columns = [...colorRow.matchAll(/party color\|([^}]+)\}\}/g)].map((m) => m[1].trim());
  const span = new Array(columns.length).fill(0);
  const out = [];
  for (const row of rows) {
    const cells = row.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|}')).map((l) => l.slice(1));
    const label = cells[0]?.match(/align="left"\|\s*\[\[[^|\]]*\|([^\]]+)\]\]/)?.[1]
      ?? cells[0]?.match(/align="left"\|\s*([^[\]|]+)$/)?.[1]?.trim();
    if (!label) continue;
    const values = {};
    let i = 1;
    for (let c = 0; c < columns.length; c++) {
      if (span[c] > 0) { span[c]--; continue; }
      const cell = cells[i] || '';
      if (/colspan="2"/.test(cell)) {
        span[c] = Number(cell.match(/rowspan="(\d+)"/)?.[1] || 1) - 1;
        i += 1;
        continue;
      }
      // El ganador lleva `style="background:{{party color|X}}; ..."| 43.2`.
      const v = cell.split('|').pop().trim();
      values[columns[c]] = { pct: v === '−' || v === '' ? 0 : Number(v), seats: num(cells[i + 1]) ?? 0 };
      i += 2;
    }
    out.push({ label, values });
  }
  return { columns, rows: out };
}
