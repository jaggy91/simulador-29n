// Veda electoral.
//  node scripts/veda.js           → data/veda.json: lo único que la web necesita durante la
//                                   veda, sin nada que salga de encuestas.
//  node scripts/veda.js --estado  → imprime "si" o "no" (para GitHub Actions), con el margen
//                                   de despliegue antes del inicio.
import { loadModelData, readJSON, writeJSON } from './lib/load-data.js';
import { prepare } from '../src/engine/model.js';
import { defaultActive, hasEffect } from '../src/engine/evidence.js';
import { VEDA, inVeda, DEPLOY_MARGIN_HOURS } from '../src/veda.js';

if (process.argv.includes('--estado')) {
  console.log(inVeda(Date.now(), { marginHours: DEPLOY_MARGIN_HOURS }) ? 'si' : 'no');
  process.exit(0);
}

// Partidos con porcentaje propio en el simulador (los mismos que dan las encuestas; el
// resto, con el voto en blanco, forma "otros").
const PARTIES = ['PP', 'PSOE', 'VOX', 'FA', 'FV', 'PODEMOS', 'SALF', 'ERC', 'JUNTS', 'BILDU', 'PNV', 'BNG', 'CC', 'AA'];

// Punto de partida: el resultado real de las generales de 2023, con el voto de Sumar
// repartido según la oferta de 2026 (FA, FV, Podemos; ERC en Cataluña). No es una
// encuesta. Sin las semillas territoriales de SALF (no se presentó: 0 %) ni de
// Adelante Andalucía (su voto real de 2023).
const data = loadModelData();
const real = data.congreso.provinces;
const valid = real.reduce((a, p) => a + Object.values(p.votes).reduce((x, y) => x + y, 0) + (p.blank || 0), 0);
const votes = {};
for (const p of prepare(data).congressBase) {
  for (const [k, v] of Object.entries(p.votes)) if (k !== 'SALF' && k !== 'AA') votes[k] = (votes[k] || 0) + v;
}
votes.AA = real.reduce((a, p) => a + (p.votes.AA || 0), 0);
const share = (k) => (100 * (votes[k] || 0)) / valid;
const base2023 = Object.fromEntries(PARTIES.map((p) => [p, Math.round(100 * (share(p) + (p === 'PP' ? share('UPN') : 0))) / 100]));

// Tarjetas: todas las noticias y datos salvo las que informan de un sondeo.
const catalog = readJSON('scenarios').scenarios;
const cards = readJSON('news').cards.filter((c) => !c.sondeo);
const active = defaultActive(catalog, cards);

writeJSON('veda', {
  window: VEDA,
  base2023,
  cards: cards.map((c) => ({ ...c, toggleable: hasEffect(c), defaultActive: active.has(c.id) })),
});
console.log('Resultado 2023 en la oferta de 2026:', Object.entries(base2023).map(([p, v]) => `${p} ${v}`).join(' · '));
console.log(`${cards.length} tarjetas sin sondeos → data/veda.json`);
