// Estimación de voto oficial del CIS, leída del PDF que publica el CIS para cada
// barómetro (https://www.cis.es/documents/d/cis/<estudio>_estimacion-pdf).
import fs from 'node:fs';
import path from 'node:path';
import { pdfRows } from './boe.js';

const CACHE = path.resolve('.cache/cis');
export const estimateUrl = (study) => `https://www.cis.es/documents/d/cis/${study}_estimacion-pdf`;

// Filas de la tabla → ids del modelo. "SUMAR / Frente Amplio" agrupa la coalición
// salvo Podemos (nota del propio CIS): equivale a FA + FV.
const NAMES = [
  [/^PSOE/, 'PSOE'], [/^PP$/, 'PP'], [/^VOX/, 'VOX'], [/^SUMAR/, 'FA+FV'], [/^Podemos/, 'PODEMOS'],
  [/^ERC/, 'ERC'], [/^Se Acab/, 'SALF'], [/^EH Bildu/, 'BILDU'], [/^Junts/, 'JUNTS'], [/^BNG/, 'BNG'],
  [/^EAJ/, 'PNV'], [/^CCa/, 'CC'], [/^UPN/, 'UPN'],
];

export async function cisEstimate(study) {
  const file = path.join(CACHE, `${study}_estimacion.pdf`);
  if (!fs.existsSync(file)) {
    const res = await fetch(estimateUrl(study));
    if (!res.ok) throw new Error(`CIS ${res.status}: ${estimateUrl(study)}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const rows = await pdfRows(fs.readFileSync(file));
  // Columnas por posición: nombre | voto directo | margen de error | estimación.
  const head = rows.find((r) => r.cells.some((c) => /Estimación de/.test(c.text)));
  const estX = head.cells.find((c) => /Estimación de/.test(c.text)).x - 10;
  const values = {};
  let joint = null;
  for (const r of rows.filter((x) => x.page === head.page && x.y < head.y)) {
    const name = r.cells.filter((c) => c.x < 240).map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
    const id = NAMES.find(([re]) => re.test(name.replace(/\s*\*+$/, '')))?.[1];
    if (!id) continue;
    const est = r.cells.filter((c) => c.x >= estX).map((c) => c.text).join('').replace(/\s/g, '');
    const v = Number(est.replace(',', '.'));
    if (!Number.isFinite(v)) throw new Error(`CIS ${study}: no leo la estimación de ${name} («${est}»)`);
    if (id === 'FA+FV') joint = { parties: ['FA', 'FV'], value: v };
    else values[id] = v;
  }
  // Como en el resto de encuestas, PP incluye a UPN.
  if (values.UPN != null) { values.PP = Math.round(((values.PP || 0) + values.UPN) * 100) / 100; delete values.UPN; }
  if (!values.PSOE || !values.PP || !joint) throw new Error(`CIS ${study}: tabla incompleta`);
  return { study, url: estimateUrl(study), values, joint: [joint] };
}
