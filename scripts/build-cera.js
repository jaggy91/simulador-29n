// Genera data/cera.json: electores residentes en el extranjero (CERA) por provincia en
// las generales de 2023 y de 2026 (INE, Oficina del Censo Electoral, censo de consulta),
// con el desglose de los residentes en Latinoamérica, donde se concentran los
// nacionalizados por la Ley de Memoria Democrática ("Ley de Nietos").
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const YEARS = [2023, 2026];
const CACHE = path.resolve('.cache/ine');
// Fuera de "Latinoamérica" dentro del continente americano.
const NOT_LATAM = /ESTADOS UNIDOS|CANAD/;

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
// Clave de provincia que iguala "Coruña (A)" y "CORUÑA, A", "Balears (Illes)" y "BALEARS, ILLES".
const ARTICLES = new Set(['A', 'LA', 'LAS', 'LOS', 'EL', 'ILLES']);
const provKey = (s) => norm(s).replace(/[(),]/g, ' ').split(/[\s/]+/).filter((w) => w && !ARTICLES.has(w)).sort().join(' ');
// Códigos de país del INE: 3xx = América (verificado con las filas de continente de 2026).
const isAmerica = (code) => String(code).startsWith('3');

async function sheet(year, tab) {
  const file = path.join(CACHE, `${year}_tab${tab}.xlsx`);
  if (!fs.existsSync(file)) {
    const url = `https://ine.es/oficina_censo/elecgen${year}/Elecgral_${year}_cc_tab${tab}.xlsx`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`INE ${res.status}: ${url}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const wb = XLSX.readFile(file);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
}

const byYear = {};
for (const year of YEARS) {
  // Tabla 3: [código, provincia, residentes en España, en el extranjero, total].
  const t3 = await sheet(year, 3);
  const provinces = {};
  const codeByName = {};
  for (const r of t3) {
    if (!/^\d{2}$/.test(String(r[0]))) continue;
    provinces[r[0]] = { name: r[1], cera: r[3], total: r[4], latam: 0, america: 0, check: 0 };
    codeByName[provKey(r[1])] = r[0];
  }
  // Tabla 8: bloques por provincia ("ALBACETE", null, total) seguidos de filas de país
  // [código, país, electores]; en 2026 hay además filas de continente.
  const t8 = await sheet(year, 8);
  let code = null;
  for (const r of t8) {
    if (typeof r[0] === 'string' && r[1] == null && typeof r[2] === 'number') {
      if (r[0] === 'Total general') continue;
      code = codeByName[provKey(r[0])];
      if (!code) throw new Error(`${year}: provincia no reconocida en tabla 8: ${r[0]}`);
      if (r[2] !== provinces[code].cera) throw new Error(`${year} ${r[0]}: tabla 8 (${r[2]}) ≠ tabla 3 (${provinces[code].cera})`);
    } else if (code && /^\d{3}$/.test(String(r[0])) && typeof r[2] === 'number') {
      provinces[code].check += r[2];
      if (!isAmerica(r[0])) continue;
      provinces[code].america += r[2];
      if (!NOT_LATAM.test(norm(r[1]))) provinces[code].latam += r[2];
    }
  }
  for (const p of Object.values(provinces)) if (p.check !== p.cera) throw new Error(`${year} ${p.name}: países suman ${p.check}, total ${p.cera}`);
  byYear[year] = provinces;
}

const out = Object.keys(byYear[2026]).sort().map((id) => {
  const a = byYear[2023][id];
  const b = byYear[2026][id];
  return { id, name: b.name, cera2023: a.cera, cera2026: b.cera, latam2023: a.latam, latam2026: b.latam, growth: b.cera - a.cera, latamGrowth: b.latam - a.latam };
});
const sum = (k) => out.reduce((s, p) => s + p[k], 0);
const totals = Object.fromEntries(['cera2023', 'cera2026', 'latam2023', 'latam2026', 'growth', 'latamGrowth'].map((k) => [k, sum(k)]));
fs.writeFileSync('data/cera.json', JSON.stringify({ source: 'INE, Oficina del Censo Electoral: censo de consulta, generales 2023 y 2026 (tablas 3 y 8)', totals, provinces: out }, null, 1));
console.log(JSON.stringify(totals));
for (const p of [...out].sort((a, b) => b.latamGrowth - a.latamGrowth).slice(0, 10)) console.log(`${p.name.padEnd(24)} CERA ${p.cera2023} → ${p.cera2026}  (Latam +${p.latamGrowth})`);
console.log('→ data/cera.json');
