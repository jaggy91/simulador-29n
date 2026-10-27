// Voto de los españoles residentes en el extranjero (CERA) en las generales de 2023,
// por provincia y partido, desde la fuente oficial: Junta Electoral Central,
// "Resultados por provincias de la votación de los residentes ausentes en el
// extranjero" (Resolución de 24 de octubre de 2023). Escribe data/cera-voto-2023.json.
import fs from 'node:fs';
import path from 'node:path';
import { pdfRows, provinceId, num } from './lib/boe.js';

const URL = 'https://www.juntaelectoralcentral.es/cs/jec/documentos/GENERALES_2023_ResultadosVotoCERAcongreso.pdf';
const FILE = path.resolve('.cache/jec/GENERALES_2023_ResultadosVotoCERAcongreso.pdf');
if (!fs.existsSync(FILE)) {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`JEC ${res.status}`);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, Buffer.from(await res.arrayBuffer()));
}

// Comunidades de una sola provincia: el PDF solo da la fila autonómica.
const SINGLE = { ASTURIAS: '33', CANTABRIA: '39', 'ILLES BALEARS': '07', 'C. DE MADRID': '28', 'R. DE MURCIA': '30', 'C. F. DE NAVARRA': '31', 'LA RIOJA': '26', 'C. A. DE CEUTA': '51', 'C. A. DE MELILLA': '52' };
const FIELDS = { 'Electores CERA': 'electores', Votantes: 'votantes', 'Votos nulos': 'nulos', 'Votos en blanco': 'blanco' };
const PARTY = { PP: 'PP', PSOE: 'PSOE', PSC: 'PSOE', SUMAR: 'SUMAR', VOX: 'VOX', 'ERC-SOBIRANISTES': 'ERC', 'J x CAT-JUNTS': 'JUNTS', 'EH Bildu': 'BILDU', Cca: 'CC', CCa: 'CC', BNG: 'BNG', 'EAJ-PNV': 'PNV', 'CUP-PR': 'CUP', PACMA: 'PACMA', UPN: 'UPN' };

const rows = await pdfRows(fs.readFileSync(FILE));
const out = {};
let total = null;
for (const page of [...new Set(rows.map((r) => r.page))]) {
  const pr = rows.filter((r) => r.page === page);
  const head = pr.find((r) => r.cells[0]?.text === 'Provincia');
  if (!head) continue;
  const cols = head.cells.slice(1);
  for (const r of pr.filter((x) => x.y < head.y)) {
    const name = r.cells[0].text;
    const isTotal = /^TOTAL ESTATAL/.test(name);
    const id = SINGLE[name] || (!/^[A-ZÁÉÍÓÚÑ .-]+$/.test(name) ? provinceId(name) : null);
    if (!id && !isTotal) continue; // totales de comunidades con varias provincias
    const rec = isTotal ? (total ||= { votes: {} }) : (out[id] ||= { id, votes: {} });
    for (const c of r.cells.slice(1)) {
      if (!/^[\d.]+$/.test(c.text)) continue;
      // Números alineados a la derecha: la columna de cabecera más cercana.
      const col = cols.reduce((best, h) => (Math.abs(h.x - c.x) < Math.abs(best.x - c.x) ? h : best));
      const v = num(c.text);
      if (FIELDS[col.text]) rec[FIELDS[col.text]] = v;
      else {
        const p = PARTY[col.text] || `x:${col.text}`;
        rec.votes[p] = (rec.votes[p] || 0) + v;
      }
    }
  }
}

const provinces = Object.values(out).sort((a, b) => a.id.localeCompare(b.id));
if (provinces.length !== 52) throw new Error(`Se esperaban 52 provincias y hay ${provinces.length}`);

// El PDF oficial tiene errores de agregación (la fila "PAÍS VASCO" incluye La Rioja,
// "C. VALENCIANA" incluye Ceuta y Melilla, y el "TOTAL ESTATAL" de electores no cuadra)
// y una errata en los electores de Albacete (862 con 860 votantes). Se usan las filas
// provinciales, los electores del censo del INE (data/cera.json) y se anotan los descuadres.
const ine = JSON.parse(fs.readFileSync('data/cera.json', 'utf8')).provinces;
const notes = [];
for (const p of provinces) {
  const e = ine.find((x) => x.id === p.id)?.cera2023;
  if (e && p.electores !== e) {
    if (Math.abs(p.electores - e) / e > 0.05) notes.push(`${p.id}: electores en el PDF ${p.electores}, INE ${e} (se usa el INE)`);
    p.electoresPdf = p.electores;
    p.electores = e;
  }
}
const sum = (f) => provinces.reduce((a, p) => a + (f(p) || 0), 0);
for (const k of ['votantes', 'nulos', 'blanco']) if (sum((p) => p[k]) !== total[k]) notes.push(`${k}: suma de provincias ${sum((p) => p[k])}, total estatal del PDF ${total[k]}`);
for (const [p, v] of Object.entries(total.votes)) if (sum((x) => x.votes[p]) !== v) notes.push(`${p}: suma de provincias ${sum((x) => x.votes[p])}, total estatal del PDF ${v}`);
notes.push(`electores: suma de provincias (INE) ${sum((p) => p.electores)}, total estatal del PDF ${total.electores}`);

// Totales nacionales recalculados desde las provincias.
const votes = {};
for (const p of provinces) for (const [k, v] of Object.entries(p.votes)) votes[k] = (votes[k] || 0) + v;
const nat = { electores: sum((p) => p.electores), votantes: sum((p) => p.votantes), nulos: sum((p) => p.nulos), blanco: sum((p) => p.blanco), votes };
const valid = Object.values(votes).reduce((a, b) => a + b, 0) + nat.blanco;
const share = Object.fromEntries(Object.entries(votes).sort((a, b) => b[1] - a[1]).map(([p, v]) => [p, Math.round((1000 * v) / valid) / 10]));
fs.writeFileSync('data/cera-voto-2023.json', JSON.stringify({ source: `Junta Electoral Central: ${URL}`, notes, total: { ...nat, valid, share }, provinces }, null, 1));
for (const n of notes) console.log('  nota:', n);
console.log(`CERA 2023: ${nat.votantes.toLocaleString('es-ES')} votantes de ${nat.electores.toLocaleString('es-ES')} electores (${((100 * nat.votantes) / nat.electores).toFixed(2)} %)`);
console.log('Reparto nacional (% sobre válidos):', Object.entries(share).slice(0, 10).map(([p, v]) => `${p} ${v}`).join(' · '));
console.log('→ data/cera-voto-2023.json');
