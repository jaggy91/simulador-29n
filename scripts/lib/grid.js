// Parser genérico de tablas wiki con colspan/rowspan: devuelve una matriz de celdas
// por fila. Una celda que ocupa varias columnas o filas es el mismo objeto en todas
// sus posiciones (así se detectan, p. ej., cifras conjuntas de dos partidos).

// Separa `atributos| valor` respetando {{plantillas}} y [[enlaces]].
export function splitCell(raw) {
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const two = raw.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; i++; continue; }
    if (raw[i] === '|' && depth === 0) return { attrs: raw.slice(0, i), value: raw.slice(i + 1).trim() };
  }
  return { attrs: '', value: raw.trim() };
}

export function parseGrid(table) {
  const rows = table.split(/\n\|-[^\n]*/).slice(1);
  const pending = [];
  const out = [];
  let uid = 0;
  for (const row of rows) {
    const lines = row.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|}') && !l.startsWith('|+'));
    const cells = lines.flatMap((l) => l.slice(1).split('||'));
    if (!cells.length) continue;
    const grid = [];
    let col = 0;
    let ci = 0;
    for (;;) {
      const p = pending[col];
      if (p && p.left > 0) {
        grid[col] = p.cell;
        p.left--;
        col++;
        continue;
      }
      if (ci >= cells.length) break;
      const { attrs, value } = splitCell(cells[ci++]);
      const colspan = Number(attrs.match(/colspan="?(\d+)/)?.[1] || 1);
      const rowspan = Number(attrs.match(/rowspan="?(\d+)/)?.[1] || 1);
      const cell = { id: uid++, attrs, value, colspan };
      for (let k = 0; k < colspan; k++) {
        grid[col + k] = cell;
        if (rowspan > 1) pending[col + k] = { cell, left: rowspan - 1 };
      }
      col += colspan;
    }
    out.push(grid);
  }
  return out;
}
