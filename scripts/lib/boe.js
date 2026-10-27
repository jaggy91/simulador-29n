// Lectura de publicaciones oficiales del BOE: tablas HTML (txt.php) y texto del PDF por
// filas (pdfjs), con caché local en .cache/boe.
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PROVINCES } from './provinces.js';

const CACHE = path.resolve('.cache/boe');

async function cached(file, url, binary) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BOE ${res.status}: ${url}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(p, binary ? Buffer.from(await res.arrayBuffer()) : await res.text());
  }
  return binary ? fs.readFileSync(p) : fs.readFileSync(p, 'utf8');
}

export const boeHtml = (id) => cached(`${id}.html`, `https://www.boe.es/diario_boe/txt.php?id=${id}`, false);
export async function boePdf(id) {
  const html = await boeHtml(id);
  const href = html.match(/href="([^"]+\.pdf)"/)?.[1];
  if (!href) throw new Error(`${id}: sin PDF`);
  return cached(`${id}.pdf`, new URL(href, 'https://www.boe.es').href, true);
}

const clean = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export const num = (s) => (s && /\d/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : null);

// Tablas HTML: [{ head: [[celdas de cada fila de cabecera]], rows: [[celdas]] }].
export function htmlTables(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map(([t]) => {
    const rowsOf = (part) => [...part.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(([r]) =>
      [...r.matchAll(/<(t[hd])([^>]*)>([\s\S]*?)<\/t[hd]>/g)].map((m) => ({
        text: clean(m[3]), colspan: Number(m[2].match(/colspan="(\d+)"/)?.[1] || 1),
      })));
    const thead = t.match(/<thead[\s\S]*?<\/thead>/)?.[0] || '';
    const tbody = t.match(/<tbody[\s\S]*?<\/tbody>/)?.[0] || t;
    return { head: rowsOf(thead), rows: rowsOf(tbody).map((r) => r.map((c) => c.text)) };
  });
}

// Texto del PDF agrupado en filas (misma altura), con las piezas ordenadas por x.
// Devuelve [{page, y, cells: [{x, text}]}] en orden de lectura.
export async function pdfRows(buffer) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const items = (await (await doc.getPage(n)).getTextContent()).items.filter((i) => i.str.trim());
    const rows = [];
    for (const it of items) {
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 2);
      if (!row) rows.push((row = { page: n, y, cells: [] }));
      row.cells.push({ x, text: it.str.trim() });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
    out.push(...rows);
  }
  return out;
}

// Nombre de circunscripción del BOE → id de provincia ("Coruña (A)", "Alicante/Alacant"…).
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.$/, '').trim();
const ALIAS = { 'balears (illes)': '07', 'illes balears': '07', 'araba/alava': '01', 'alava': '01' };
const byName = Object.fromEntries(PROVINCES.map((p) => [norm(p.name), p.id]));
export function provinceId(name) {
  const n = norm(name);
  if (ALIAS[n]) return ALIAS[n];
  if (byName[n]) return byName[n];
  const paren = n.match(/^(.+?) \((.+)\)$/); // "coruna (a)" → "a coruna"
  if (paren && byName[`${paren[2]} ${paren[1]}`]) return byName[`${paren[2]} ${paren[1]}`];
  for (const part of n.split('/')) if (byName[part.trim()]) return byName[part.trim()];
  return null;
}
