// Datos base de 2023 desde la fuente oficial: resultados de la Junta Electoral Central
// publicados en el BOE (BOE-A-2023-18907, con la corrección BOE-A-2023-19537).
//  - Congreso: Cuadro I (válidos, blancos…) del PDF; Cuadros II y III (votos y escaños
//    de cada candidatura por circunscripción) de las tablas HTML.
//  - Senado: relación de candidatos electos y no electos con sus votos (PDF).
// Escribe data/congreso-2023.json y data/senado-2023.json (mismo formato que antes) y
// compara con los datos anteriores. Uso: node scripts/build-oficial-2023.js
import fs from 'node:fs';
import { PROVINCES, SENATE } from './lib/provinces.js';
import { boeHtml, boePdf, htmlTables, pdfRows, provinceId, num } from './lib/boe.js';

const BOE_ID = 'BOE-A-2023-18907';
const SOURCE = `BOE ${BOE_ID} (Junta Electoral Central, escrutinio general), con la corrección BOE-A-2023-19537`;
// BOE-A-2023-19537: Senado, Madrid, «Don Santiago Llorente Gutiérrez … 1.007.32» → 1.007.322.
const CORRECTIONS = [{ constituency: '28', candidate: 'Santiago Llorente Gutiérrez', votes: 1007322 }];

// Candidaturas al Congreso por las siglas del BOE (último paréntesis del nombre).
const CONGRESO_IDS = {
  PP: 'PP', PSOE: 'PSOE', PSC: 'PSOE', VOX: 'VOX', SUMAR: 'SUMAR', ERC: 'ERC', JUNTS: 'JUNTS',
  'EH Bildu': 'BILDU', 'EAJ-PNV': 'PNV', BNG: 'BNG', CCa: 'CC', UPN: 'UPN', PACMA: 'PACMA',
  'CUP-PR': 'CUP', 'NC-bc': 'NC', EXISTE: 'EXISTE', UPL: 'UPL', GBAI: 'GBAI', XAV: 'XAV', 'SORIA ¡YA!': 'SY', SY: 'SY',
  'ADELANTE ANDALUCÍA': 'AA',
};
const congresoId = (header) => {
  // Algunas cabeceras terminan en punto: "Geroa Bai (GBAI)."
  const abbr = header.replace(/\.\s*$/, '').match(/\(([^()]+)\)\s*$/)?.[1]?.trim() ?? header;
  return CONGRESO_IDS[abbr] || `x:${abbr}`;
};

// Candidaturas al Senado por el nombre del BOE. Se compara sin tildes ni espacios: el
// PDF trae "UNI Ó N DEL PUEBLO NAVARRO" o "AGRUPACION" sin tilde.
const SENADO_IDS = [
  [/^(PARTIDOPOPULAR|PARTITPOPULAR)/, 'PP'],
  [/PARTIDOSOCIALISTA|SOCIALISTES|PSOE/, 'PSOE'],
  [/^EIVISSAIFORMENTERAALSENAT/, 'PSOE'], // lista conjunta de izquierda encabezada por el PSOE
  [/^VOX/, 'VOX'],
  [/SUMAR|SUMEM/, 'SUMAR'],
  [/ESQUERRAREPUBLICANA/, 'ERC'],
  [/^JUNTS/, 'JUNTS'],
  [/EUSKALHERRIABILDU/, 'BILDU'],
  [/EUZKOALDERDIJELTZALEA|NACIONALISTAVASCO/, 'PNV'],
  [/BLOQUENACIONALISTAGALEGO/, 'BNG'],
  [/^COALICIONCANARIA/, 'CC'],
  [/^UNIONDELPUEBLONAVARRO/, 'UPN'],
  [/AGRUPACIONSOCIALISTAGOMERA/, 'ASG'],
  [/AGRUPACIONHERRENAINDEPENDIENTE/, 'AHI'],
  [/^NUEVACANARIAS/, 'NC'],
  [/EXISTE/, 'EXISTE'],
  [/ANIMALISTA/, 'PACMA'],
  [/UNIONDELPUEBLOLEONES/, 'UPL'],
  [/GEROABAI/, 'GBAI'],
  [/UNITATPOPULAR/, 'CUP'],
  [/^PORAVILA/, 'XAV'],
  [/^SORIAYA/, 'SY'],
];
const squash = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const senadoId = (name) => (SENADO_IDS.find(([re]) => re.test(squash(name)))?.[1]) || `x:${name.replace(/\s+/g, ' ')}`;

const ISLANDS = {
  MALLORCA: 'MALLORCA', MENORCA: 'MENORCA', 'EIVISSA - FORMENTERA': 'IBIZA', 'EIVISSA-FORMENTERA': 'IBIZA',
  'GRAN CANARIA': 'GCANARIA', LANZAROTE: 'LANZAROTE', FUERTEVENTURA: 'FUERTEV',
  TENERIFE: 'TENERIFE', 'LA PALMA': 'LAPALMA', 'LA GOMERA': 'GOMERA', 'EL HIERRO': 'HIERRO',
};
function senateId(heading) {
  const m = heading.match(/^(.+?):\s*(.+)$/);
  if (m) return ISLANDS[m[2].replace(/\s+/g, ' ').trim()] || null;
  return provinceId(heading);
}

const html = await boeHtml(BOE_ID);
const rows = await pdfRows(await boePdf(BOE_ID));

// --- Congreso -----------------------------------------------------------------
const tables = htmlTables(html);
const prov = Object.fromEntries(PROVINCES.map((p) => [p.id, { id: p.id, name: p.name, ccaa: p.ccaa, seats: 0, votes: {}, elected: {} }]));
for (const t of tables) {
  // Cabecera: celdas de partido (las de colspan 2 traen votos y escaños).
  const head = t.head[0].slice(t.head[0][1]?.text === 'Total escaños' ? 2 : 1);
  const withSeats = head[0]?.colspan === 2;
  for (const r of t.rows) {
    const id = provinceId(r[0]);
    if (!id) continue; // "Total estatal"
    let c = withSeats ? 2 : 1;
    if (withSeats) prov[id].seats = num(r[1]);
    for (const h of head) {
      const v = num(r[c]);
      const s = withSeats ? num(r[c + 1]) : 0;
      c += withSeats ? 2 : 1;
      if (!v) continue;
      const party = congresoId(h.text);
      prov[id].votes[party] = (prov[id].votes[party] || 0) + v;
      if (s) prov[id].elected[party] = (prov[id].elected[party] || 0) + s;
    }
  }
}
// Cuadro I (PDF): electores, votantes, válidos, a candidaturas, en blanco, nulos.
const cuadroI = rows.filter((r) => r.page <= 3 && r.cells.length === 7 && r.cells.slice(1).every((c) => /^[\d.]+$/.test(c.text)));
for (const r of cuadroI) {
  const name = r.cells.find((c) => !/^[\d.]+$/.test(c.text))?.text;
  const id = name && provinceId(name);
  if (!id) continue;
  const [electores, votantes, validos, candidaturas, blanco, nulos] = r.cells.filter((c) => /^[\d.]+$/.test(c.text)).sort((a, b) => a.x - b.x).map((c) => num(c.text));
  Object.assign(prov[id], { electores, votantes, valid: validos, candidaturas, blank: blanco, nulos });
}
const congreso = Object.values(prov);
for (const p of congreso) {
  const sum = Object.values(p.votes).reduce((a, b) => a + b, 0);
  if (sum !== p.candidaturas) throw new Error(`${p.name}: suma de candidaturas ${sum} ≠ Cuadro I ${p.candidaturas}`);
  if (p.candidaturas + p.blank !== p.valid) throw new Error(`${p.name}: candidaturas + blanco ≠ válidos`);
  const seats = Object.values(p.elected).reduce((a, b) => a + b, 0);
  if (seats !== p.seats) throw new Error(`${p.name}: escaños ${seats} ≠ ${p.seats}`);
}

// --- Senado ---------------------------------------------------------------------
const SKIP = /^(BOLETÍN OFICIAL|cve:|Verificable|Votos$|SENADO$|Elecciones Generales|Relación de|Núm\.)/;
const NAME_X = 230;
const VOTES_X = 460;
const cands = [];
let section = null;
let heading = null;
let last = null;
for (const r of rows) {
  const text = r.cells.map((c) => c.text).join(' ');
  if (/SENADO Relación de Senadores proclamados electos/.test(text) || (r.page > 3 && /^Relación de Senadores proclamados electos$/.test(text))) { section = 'electo'; continue; }
  if (/Relación de candidatos que no han obtenido escaño/.test(text)) { section = 'no electo'; continue; }
  if (!section || SKIP.test(r.cells[0].text)) continue;
  const nameCells = r.cells.filter((c) => c.x < NAME_X);
  const partyCells = r.cells.filter((c) => c.x >= NAME_X && c.x < VOTES_X);
  const voteCells = r.cells.filter((c) => c.x >= VOTES_X && /^[\d.]+$/.test(c.text));
  const nameText = nameCells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
  // Notas a pie ("(proclamado electo tras la renuncia anticipada del" / "Senador electo D. … )").
  if (/^\(|^Senador[a]? electo|renuncia anticipada/.test(nameText)) continue;
  if (/^(Don|Doña)\b/.test(nameText)) {
    last = { constituency: heading, candidate: nameText.replace(/^(Don|Doña)\s+/, ''), party: partyCells.map((c) => c.text).join(' '), votes: voteCells.length ? num(voteCells[0].text) : null, elected: section === 'electo' };
    cands.push(last);
  } else if (!nameCells.length && last && (partyCells.length || voteCells.length)) {
    // Partido en dos líneas o votos desplazados a la fila siguiente.
    if (partyCells.length) last.party = `${last.party} ${partyCells.map((c) => c.text).join(' ')}`.trim();
    if (voteCells.length && last.votes == null) last.votes = num(voteCells[0].text);
  } else if (nameCells.length && !partyCells.length && !voteCells.length) {
    const id = senateId(nameText);
    if (id) heading = id;
    // Nombre largo partido en dos líneas ("… Escañuela Álvarez" / "Sotomayor").
    else if (last) last.candidate = `${last.candidate}${last.candidate.endsWith('-') ? '' : ' '}${nameText}`;
    else throw new Error(`Encabezado del Senado no reconocido: «${nameText}»`);
  }
}
for (const fix of CORRECTIONS) {
  const c = cands.find((x) => x.constituency === fix.constituency && x.candidate.includes(fix.candidate));
  if (!c) throw new Error(`Corrección no aplicada: ${fix.candidate}`);
  c.votes = fix.votes;
}
const missing = cands.filter((c) => c.votes == null);
if (missing.length) throw new Error(`Candidatos sin votos: ${missing.slice(0, 3).map((c) => c.candidate).join(', ')}`);

const senado = SENATE.map((s) => {
  const list = cands.filter((c) => c.constituency === s.id).map((c) => ({ ...c, party: senadoId(c.party.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ')) }));
  const won = list.filter((c) => c.elected);
  if (won.length !== s.seats) throw new Error(`${s.name}: ${won.length} electos, esperados ${s.seats}`);
  // Voto de partido = media de sus candidatos (hasta el máximo de marcas por elector).
  const byParty = {};
  for (const c of list) (byParty[c.party] ||= []).push(c.votes);
  const votes = Object.fromEntries(Object.entries(byParty).map(([p, vs]) => {
    const top = vs.sort((a, b) => b - a).slice(0, s.maxVotes);
    return [p, Math.round(top.reduce((a, b) => a + b, 0) / top.length)];
  }));
  const elected = {};
  for (const c of won) elected[c.party] = (elected[c.party] || 0) + 1;
  return {
    id: s.id, name: s.name, prov: s.prov, ccaa: s.ccaa, seats: s.seats, maxVotes: s.maxVotes, votes, elected,
    candidates: list.map(({ candidate, party, votes, elected }) => ({ candidate, party, votes, elected })),
  };
});

// --- Comparación con los datos anteriores y escritura -----------------------------
const old = (f) => (fs.existsSync(`data/${f}.json`) ? JSON.parse(fs.readFileSync(`data/${f}.json`, 'utf8')) : null);
const oldC = old('congreso-2023');
const oldS = old('senado-2023');
if (oldC?.source && !oldC.source.startsWith('BOE')) {
  let diffs = 0;
  for (const p of congreso) {
    const o = oldC.provinces.find((x) => x.id === p.id);
    for (const k of ['PP', 'PSOE', 'VOX', 'SUMAR']) if ((o.votes[k] || 0) !== (p.votes[k] || 0)) diffs++;
    if (o.valid !== p.valid) console.log(`  Congreso ${p.name}: válidos Wikipedia ${o.valid} → BOE ${p.valid}`);
    if (JSON.stringify(o.elected) !== JSON.stringify(Object.fromEntries(Object.entries(p.elected).sort((a, b) => Object.keys(o.elected).indexOf(a[0]) - Object.keys(o.elected).indexOf(b[0]))))) console.log(`  Congreso ${p.name}: escaños distintos`, JSON.stringify(o.elected), JSON.stringify(p.elected));
  }
  console.log(`Congreso: ${diffs} cifras de PP/PSOE/Vox/Sumar distintas de Wikipedia`);
}
if (oldS?.source && !oldS.source.startsWith('BOE')) {
  for (const s of senado) {
    const o = oldS.constituencies.find((x) => x.id === s.id);
    const a = JSON.stringify(Object.entries(o.elected).sort());
    const b = JSON.stringify(Object.entries(s.elected).sort());
    if (a !== b) console.log(`  Senado ${s.name}: electos Wikipedia ${a} → BOE ${b}`);
  }
}
const nat = (list, k) => list.reduce((acc, p) => { for (const [x, n] of Object.entries(p[k])) acc[x] = (acc[x] || 0) + n; return acc; }, {});
console.log('Congreso electos:', JSON.stringify(nat(congreso, 'elected')));
console.log('Senado electos:', JSON.stringify(nat(senado, 'elected')), '· candidatos', cands.length);
fs.writeFileSync('data/congreso-2023.json', JSON.stringify({ source: SOURCE, provinces: congreso }, null, 1));
fs.writeFileSync('data/senado-2023.json', JSON.stringify({ source: SOURCE, constituencies: senado }, null, 1));
console.log('→ data/congreso-2023.json, data/senado-2023.json');
