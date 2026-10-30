// Comprueba que una compilación de la web es apta para la veda electoral: solo publica
// los datos de VEDA_FILES y el código no contiene nombres de empresas de sondeos (señal
// de que se ha colado una tarjeta o una cifra de encuestas).
// Uso: node scripts/check-veda.js <carpeta de la compilación>
import fs from 'node:fs';
import path from 'node:path';
import { VEDA_FILES } from '../src/veda.js';

const dir = process.argv[2] || 'dist';
const problems = [];

for (const f of fs.readdirSync(path.join(dir, 'data'))) {
  if (!VEDA_FILES.includes(f.replace(/\.json$/, ''))) problems.push(`dato no permitido: data/${f}`);
}

// Empresas del índice de encuestas ("Empresa/Medio" o "CIS (Empresa)"). Fuera quedan los
// nombres que aparecen por otros motivos: partidos que encargan encuestas, el CIS como
// organismo y Demócrata, también medio enlazado en las noticias. Los de menos de 4
// letras darían falsos positivos en el código minificado.
const NOT_FIRMS = new Set(['CIS', 'PSOE', 'Sumar', 'Demócrata']);
const rows = JSON.parse(fs.readFileSync('data/polls.json', 'utf8')).rows;
const firms = [...new Set(rows.map((r) => (r.firm.match(/^CIS \((.+)\)$/)?.[1] ?? r.firm.split('/')[0]).trim()))]
  .filter((f) => f.length >= 4 && !NOT_FIRMS.has(f));
// Encuestas sobre escenarios (tarjetas `sondeo` de news.json): ni su empresa (`firm`)
// ni los medios que la publican pueden aparecer.
const surveys = JSON.parse(fs.readFileSync('data/news.json', 'utf8')).cards.filter((c) => c.sondeo);
for (const c of surveys) {
  for (const name of [c.firm, ...(c.outlet || '').split('/')]) {
    const n = name?.trim();
    if (n && n.length >= 4 && !firms.includes(n)) firms.push(n);
  }
}

const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === 'data' && d === dir ? [] : files(p);
  return /\.(html|js|css|json)$/.test(e.name) ? [p] : [];
});
for (const f of files(dir)) {
  const text = fs.readFileSync(f, 'utf8');
  for (const firm of firms) if (text.includes(firm)) problems.push(`${path.relative(dir, f)} menciona «${firm}»`);
}

if (problems.length) {
  console.error(`La versión de veda NO es apta:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Versión de veda apta: ${fs.readdirSync(path.join(dir, 'data')).length} archivos de datos permitidos; ninguna de ${firms.length} empresas de sondeos en el código.`);
