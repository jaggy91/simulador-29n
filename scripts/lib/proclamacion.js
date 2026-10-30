// Candidaturas proclamadas (BOE): una disposición con un bloque por junta electoral
// provincial («JUNTA ELECTORAL DE …»), cada uno con «CONGRESO DE LOS DIPUTADOS» y
// «SENADO». En Baleares y Canarias el Senado se divide en «Circunscripción electoral: X».
// Cada candidatura va numerada y en mayúsculas («4. PARTIDO POPULAR (PP)»), seguida de
// sus candidatos («1. Nombre.») y suplentes.
import { pdfRows, provinceId } from './boe.js';

// Islas → ids de las circunscripciones del Senado del modelo.
const ISLANDS = {
  mallorca: 'MALLORCA', menorca: 'MENORCA', eivissa: 'IBIZA', ibiza: 'IBIZA', formentera: 'FORMENTERA',
  'eivissa-formentera': 'IBIZA', 'ibiza-formentera': 'IBIZA', 'gran canaria': 'GCANARIA', fuerteventura: 'FUERTEV',
  lanzarote: 'LANZAROTE', tenerife: 'TENERIFE', 'la palma': 'LAPALMA', 'la gomera': 'GOMERA', gomera: 'GOMERA',
  'el hierro': 'HIERRO', hierro: 'HIERRO',
};
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const NOISE = /^(cve:|BOLETÍN OFICIAL DEL ESTADO|Núm\. \d+|Verificable en)/;

// Una línea de candidatura: número + nombre que acaba en siglas entre paréntesis o va
// casi todo en mayúsculas («9. TERUEL EXISTE-Coalición EXISTE (EXISTE)»). Un candidato
// acaba en punto («1. Nombre Apellido.», «… (Independiente).»).
function isListHeader(l) {
  const m = l.match(/^(\d+)\.\s+(.+)$/);
  if (!m || /\.$/.test(m[2])) return null;
  const letters = m[2].replace(/[^A-Za-zÀ-ÿ]/g, '');
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '').length / (letters.length || 1);
  return letters.length >= 2 && (upper >= 0.7 || /\([^()]+\)$/.test(m[2])) ? { n: +m[1], text: m[2] } : null;
}

// Devuelve {constituencyId: [{n, name, siglas, candidates}]} para el Senado.
export async function parseProclamacion(pdf) {
  const rows = await pdfRows(pdf);
  const lines = rows.map((r) => r.cells.map((c) => c.text).join(' ').trim()).filter((l) => l && !NOISE.test(l));
  const out = {};
  const all = {};
  let prov = null;
  let inSenate = false;
  let cid = null;
  let cur = null;
  const close = () => { cur = null; };
  for (let k = 0; k < lines.length; k++) {
    const l = lines[k];
    const junta = l.match(/^JUNTA ELECTORAL (?:PROVINCIAL )?DE (.+)$/);
    if (junta) { prov = provinceId(junta[1]); inSenate = false; cid = null; close(); continue; }
    if (/^CONGRESO DE LOS DIPUTADOS$/.test(l)) { inSenate = false; close(); continue; }
    if (/^SENADO$/.test(l)) { inSenate = true; cid = ['07', '35', '38'].includes(prov) ? null : prov; close(); continue; }
    if (!inSenate) continue;
    const island = l.match(/^Circunscripción electoral:\s*(.+)$/i);
    if (island) { cid = ISLANDS[norm(island[1])] || `?${island[1]}`; close(); continue; }
    if (!cid) continue;
    const h = isListHeader(l);
    if (h && h.n === (cur?.n || 0) + 1) {
      // El nombre puede seguir en la línea siguiente si también va en mayúsculas.
      let text = h.text;
      while (lines[k + 1] && !/^\d+\./.test(lines[k + 1]) && !/^(Suplente|No proclamada)/.test(lines[k + 1]) && lines[k + 1] === lines[k + 1].toUpperCase()) text += ` ${lines[++k]}`;
      cur = { n: h.n, name: text.replace(/\s+/g, ' ').trim(), siglas: text.match(/\(([^()]+)\)\s*$/)?.[1]?.trim() || null, candidates: 0, proclaimed: true };
      (all[cid] ||= []).push(cur);
      continue;
    }
    if (cur && /^No proclamada/i.test(l)) { cur.proclaimed = false; continue; }
    if (cur && /^\d+\.\s/.test(l)) cur.candidates++;
  }
  // Solo las proclamadas.
  for (const [k, ls] of Object.entries(all)) out[k] = ls.filter((x) => x.proclaimed && x.candidates > 0);
  return out;
}

// Parámetros de los escenarios a partir de las listas al Senado proclamadas.
//  - Senado de Progreso: circunscripciones con una lista cuyo nombre lo incluye.
//  - Pacto PP–Vox: sin lista de Vox (y con la del PP) → retirada de Vox; sin lista del PP
//    (y con la de Vox) → retirada del PP; Vox con un solo candidato donde se vota a más
//    de uno → candidato único.
const isVox = (l) => /^VOX$/i.test(l.siglas || '') || /^VOX\b/.test(l.name);
const isPP = (l) => /^PP$/i.test(l.siglas || '') || /^PARTIDO POPULAR\b/.test(l.name);
export function scenarioParams(lists, senateBase) {
  const ids = (f) => senateBase.filter((c) => lists[c.id] && f(lists[c.id], c)).map((c) => c.id);
  return {
    senadoProgreso: ids((ls) => ls.some((l) => /SENADO DE PROGRESO/i.test(l.name))),
    voxWithdraws: ids((ls) => ls.some(isPP) && !ls.some(isVox)),
    ppWithdraws: ids((ls) => ls.some(isVox) && !ls.some(isPP)),
    voxSingle: ids((ls, c) => c.maxVotes > 1 && ls.some((l) => isVox(l) && l.candidates === 1)),
  };
}

// Comprobaciones antes de aplicar nada: todas las circunscripciones y listas con sentido.
export function problems(lists, senateBase) {
  const p = [];
  for (const c of senateBase) {
    const ls = lists[c.id];
    if (!ls?.length) { p.push(`${c.name}: sin listas al Senado`); continue; }
    if (ls.length < 2) p.push(`${c.name}: solo ${ls.length} lista`);
    // Una lista puede llevar hasta tantos candidatos como escaños (no como votos por elector).
    const over = ls.filter((l) => l.candidates > c.seats);
    if (over.length) p.push(`${c.name}: ${over.map((l) => l.name).join(', ')} con más candidatos que escaños (${c.seats})`);
  }
  for (const k of Object.keys(lists)) if (!senateBase.some((c) => c.id === k)) p.push(`circunscripción no reconocida: ${k}`);
  return p;
}
