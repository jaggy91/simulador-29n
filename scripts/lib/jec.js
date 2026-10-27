// Resultados oficiales del Congreso (Junta Electoral Central, publicados en el BOE)
// leídos del PDF: Cuadro I (resumen por circunscripción) y Cuadros II y III (votos
// y escaños de cada candidatura). Sirve para convocatorias cuyo HTML trae las tablas
// como imagen (p. ej. noviembre de 2019).
import { provinceId, num } from './boe.js';

const isNum = (t) => /^[\d.]+$/.test(t) && /\d/.test(t);

// Cuadro I: filas con el nombre y 6 cifras (electores, votantes, válidos, a
// candidaturas, en blanco, nulos), por orden de columna.
export function cuadroI(rows) {
  const out = {};
  for (const r of rows.filter((x) => x.page <= 3 && x.cells.length === 7)) {
    const name = r.cells.find((c) => !isNum(c.text))?.text;
    const nums = r.cells.filter((c) => isNum(c.text)).sort((a, b) => a.x - b.x).map((c) => num(c.text));
    const id = name && provinceId(name);
    if (!id || nums.length !== 6) continue;
    const [electores, votantes, valid, candidaturas, blank, nulos] = nums;
    out[id] = { electores, votantes, valid, candidaturas, blank, nulos };
  }
  return out;
}

// Cuadros II y III: la fila "Votos (Escaños)…" marca las columnas. Cada columna "Votos"
// abarca un bloque horizontal hasta la siguiente; el nombre del partido es todo el texto
// de cabecera que cae en ese bloque (nombre completo y siglas, aunque ocupen varias
// líneas). Cada cifra se asigna a la columna de cabecera más cercana.
export function cuadrosVotos(rows) {
  const out = {};
  const pages = [...new Set(rows.map((r) => r.page))];
  for (const page of pages) {
    const pr = rows.filter((r) => r.page === page);
    const title = pr.map((r) => r.cells.map((c) => c.text).join(' ')).join(' ');
    if (!/CUADRO II/.test(title) || /SENADO/.test(title)) continue;
    // Fila de subcabecera: solo "Votos" y "Escaños" (una página puede tener una sola columna).
    const hi = pr.findIndex((r) => r.cells.some((c) => c.text === 'Votos') && r.cells.every((c) => c.text === 'Votos' || c.text === 'Escaños'));
    if (hi < 1) continue;
    const sub = pr[hi].cells.filter((c) => c.text === 'Votos' || c.text === 'Escaños');
    const votosCols = sub.filter((c) => c.text === 'Votos');
    // Cabecera: desde la línea "Relación de votos…" (o el título del cuadro en las
    // páginas de continuación) hasta la fila "Votos".
    const rel = pr.findIndex((r) => /^Relación de votos/.test(r.cells[0].text));
    const top = rel >= 0 ? rel : pr.findIndex((r) => /CUADRO II/.test(r.cells.map((c) => c.text).join(' ')));
    const header = pr.slice(top + 1, hi);
    const MARGIN = 25;
    const partyOf = (i) => {
      const from = votosCols[i].x - MARGIN;
      const to = votosCols[i + 1] ? votosCols[i + 1].x - MARGIN : Infinity;
      return header.flatMap((r) => r.cells).filter((c) => c.x >= from && c.x < to).map((c) => c.text).join(' ');
    };
    const cols = sub.map((c) => ({ x: c.x, kind: c.text, party: partyOf(votosCols.indexOf(c.text === 'Votos' ? c : votosCols.filter((v) => v.x < c.x).pop())) }));
    for (const r of pr.slice(hi + 1)) {
      const id = provinceId(r.cells[0].text);
      if (!id) continue;
      const rec = (out[id] ||= { votes: {}, elected: {}, seats: null });
      // Primera cifra tras el nombre en los Cuadros II: total de escaños.
      const cells = r.cells.slice(1);
      const first = cells[0];
      const leftmost = Math.min(...cols.map((c) => c.x));
      if (first && isNum(first.text) && first.x < leftmost - 5) rec.seats = num(first.text);
      for (const c of cells) {
        if (!isNum(c.text) || (c === first && c.x < leftmost - 5)) continue;
        // Cifras alineadas a la derecha: la columna es la última que empieza a su
        // izquierda (con un margen para números anchos).
        const col = cols.filter((h) => h.x <= c.x + 12).pop() || cols[0];
        const v = num(c.text);
        if (col.kind === 'Votos') rec.votes[col.party] = (rec.votes[col.party] || 0) + v;
        else if (v) rec.elected[col.party] = (rec.elected[col.party] || 0) + v;
      }
    }
  }
  return out;
}
