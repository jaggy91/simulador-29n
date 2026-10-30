// Captura automática de noticias (F4): cada hora lee los RSS de varios medios, filtra
// los titulares que pueden tocar un escenario del catálogo y pide a la IA (GitHub Models)
// que diga a cuál y con qué estado. Proveedor configurable, compatible con la API de
// OpenAI: NEWS_AI_URL (…/chat/completions), NEWS_AI_KEY y NEWS_AI_MODEL (secretos del
// repositorio). Sin clave, el paso se salta. (GitHub Models se retiró el 30-jul-2026.) La IA no decide cifras: solo escenario + estado, con
// una cita literal que tiene que aparecer en el texto del medio.
// Reglas (opción C):
//  - rumor o negociación: se activa sola si la cuentan al menos dos medios distintos;
//  - confirmado o descartado: queda pendiente de revisión (inactiva) y se avisa;
//  - si coincide con el estado vigente del escenario, no se crea nada.
// Las tarjetas aprobadas a mano (verified: true) no se tocan.
// Uso: NEWS_AI_URL=… NEWS_AI_KEY=… NEWS_AI_MODEL=… node scripts/fetch-news.js [--dry]
import fs from 'node:fs';
import { readJSON, writeJSON } from './lib/load-data.js';
import { resolveEvidence, defaultActive } from '../src/engine/evidence.js';

const DRY = process.argv.includes('--dry');
const AI_URL = process.env.NEWS_AI_URL;
const TOKEN = process.env.NEWS_AI_KEY;
const MODEL = process.env.NEWS_AI_MODEL;
const UA = 'simulador-29n/1.0 (+https://github.com/jaggy91/simulador-29n)';
const WINDOW_H = 72;
const MAX_CALLS = 10; // por ejecución horaria: dentro del cupo diario de los planes gratuitos
const PROB = { rumor: 0.15, negociación: 0.5, confirmado: 1, descartado: 0 };
const FEEDS = [
  ['El País', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada'],
  ['elDiario.es', 'https://www.eldiario.es/rss/politica/'],
  ['El Mundo', 'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml'],
  ['Europa Press', 'https://www.europapress.es/rss/rss.aspx?ch=00066'],
  ['20minutos', 'https://www.20minutos.es/rss/nacional/'],
  ['ABC', 'https://www.abc.es/rss/2.0/espana/'],
  ['RTVE', 'https://www.rtve.es/api/tematicas/1031301/noticias.rss'],
  ['La Vanguardia', 'https://www.lavanguardia.com/rss/politica.xml'],
  ['infoLibre', 'https://www.infolibre.es/rss/'],
  ['Libertad Digital', 'https://www.libertaddigital.com/rss/nacional.xml'],
];
// Filtro previo, amplio: la IA decide después si de verdad toca un escenario.
const TOPIC = /senado|lista(s)? conjunta|senado de progreso|pacto|retir|candidatur|frente amplio|podemos|comprom[ií]s|nietos|voto exterior|nacionalizad|teruel|chunta|\bcha\b/i;

const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#x?([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, /x/i.test(m) ? 16 : 10))).replace(/&amp;/g, '&');
const text = (s) => decode(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (it, t) => it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] || '';
const norm = (s) => s.normalize('NFC').replace(/[«»“”"'‘’]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

async function feed([outlet, url]) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    const xml = await res.text();
    return xml.split(/<item[\s>]/).slice(1).map((it) => ({
      outlet,
      title: text(tag(it, 'title')),
      link: text(tag(it, 'link')) || text(tag(it, 'guid')),
      date: new Date(text(tag(it, 'pubDate')) || Date.now()).toISOString(),
      body: text(tag(it, 'description')) + ' ' + text(tag(it, 'content:encoded')).slice(0, 1500),
    }));
  } catch {
    return [];
  }
}

// NEWS_AI_MODEL admite varios modelos separados por comas: si uno falla por saturación
// o porque el proveedor lo retira, se prueba el siguiente.
async function classify(item, catalog) {
  const errors = [];
  for (const model of MODEL.split(',').map((m) => m.trim()).filter(Boolean)) {
    try { return await classifyWith(model, item, catalog); } catch (e) { errors.push(e.message); }
  }
  throw new Error(errors.join(' | '));
}

async function classifyWith(model, item, catalog) {
  const scenarios = catalog.filter((s) => s.kind !== 'base').map((s) => `- ${s.id}: ${s.label}. ${s.detail || ''}`).join('\n');
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `Clasificas noticias sobre las elecciones generales españolas del 29-N de 2026. Solo respondes JSON.
Escenarios posibles:
${scenarios}
Estados: "rumor" (se habla de ello sin acuerdo ni fuente que lo afirme), "negociación" (hay conversaciones reconocidas por las partes), "confirmado" (anunciado o firmado oficialmente), "descartado" (desmentido o ya imposible).
Responde {"relevante": bool, "escenario": id o null, "estado": uno de los estados o null, "cita": frase copiada literalmente del texto que lo justifica}.
Si la noticia no cambia el estado de ninguno de esos escenarios, o trata de una encuesta, responde relevante=false. No deduzcas: la cita debe decirlo.` },
        { role: 'user', content: `Medio: ${item.outlet}\nTítulo: ${item.title}\nTexto: ${item.body.slice(0, 2500)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`IA ${res.status} (${model}): ${(await res.text()).slice(0, 160).replace(/\s+/g, ' ')}`);
  const body = await res.text();
  let content;
  try { content = JSON.parse(body).choices[0].message.content; } catch { throw new Error(`respuesta no válida del proveedor: ${body.slice(0, 60)}`); }
  // Algunos modelos envuelven el JSON en texto: se toma el primer objeto.
  return JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || 'null');
}

if (!AI_URL || !TOKEN || !MODEL) { console.log('Sin proveedor de IA configurado (NEWS_AI_URL, NEWS_AI_KEY, NEWS_AI_MODEL): no se capturan noticias'); process.exit(0); }
const catalog = readJSON('scenarios').scenarios;
const news = readJSON('news');
const seen = readJSON('news-seen', {});
const found = readJSON('news-candidates', []);
const now = Date.now();
const fresh = (d) => (now - Date.parse(d)) / 36e5 < WINDOW_H;

const items = (await Promise.all(FEEDS.map(feed))).flat()
  .filter((it) => it.link && fresh(it.date) && !seen[it.link] && TOPIC.test(`${it.title} ${it.body}`));
console.log(`RSS: ${items.length} titulares nuevos sobre los escenarios`);

let calls = 0;
for (const it of items) {
  if (calls >= MAX_CALLS) break;
  calls++;
  seen[it.link] = new Date().toISOString();
  let r;
  try { r = await classify(it, catalog); } catch (e) { console.log(`IA: ${e.message}`); delete seen[it.link]; break; }
  const ok = r?.relevante && catalog.some((s) => s.id === r.escenario && s.kind !== 'base') && r.estado in PROB
    && typeof r.cita === 'string' && r.cita.length >= 20 && norm(`${it.title} ${it.body}`).includes(norm(r.cita));
  if (r?.relevante && !ok) console.log(`  descartada (cita o datos no válidos): ${it.title.slice(0, 80)}`);
  if (ok) {
    found.push({ ...it, body: undefined, scenario: r.escenario, status: r.estado, quote: r.cita, at: new Date().toISOString() });
    console.log(`  ${r.escenario} → ${r.estado} (${it.outlet}): ${it.title.slice(0, 80)}`);
  }
}

// Tarjetas: una por escenario + estado, con todos los medios que lo cuentan.
const recent = found.filter((f) => fresh(f.date));
const state = resolveEvidence(catalog, news.cards, defaultActive(catalog, news.cards)).scenarios;
const groups = {};
for (const f of recent) (groups[`${f.scenario}|${f.status}`] ||= []).push(f);
const approved = news.cards.filter((c) => c.captured === 'auto' && c.verified);
const cards = [];
const review = [];
for (const [k, fs_] of Object.entries(groups)) {
  const [scenario, status] = k.split('|');
  if (state.find((s) => s.id === scenario)?.status === status) continue; // nada nuevo
  const id = `auto-${scenario}-${status}`;
  if (approved.some((c) => c.id === id)) continue;
  const outlets = [...new Set(fs_.map((f) => f.outlet))];
  const strong = status === 'confirmado' || status === 'descartado';
  const first = fs_.sort((a, b) => a.date.localeCompare(b.date))[0];
  cards.push({
    id, type: 'noticia', date: fs_.at(-1).date.slice(0, 10),
    title: first.title,
    detail: `Captura automática (IA): ${catalog.find((s) => s.id === scenario).label} → ${status}, en ${outlets.length} ${outlets.length === 1 ? 'medio' : 'medios'} (${outlets.join(', ')}). Cita: «${first.quote}»`,
    outlet: outlets.join(' / '), sources: [...new Set(fs_.map((f) => f.link))].slice(0, 4),
    verified: false, captured: 'auto', autoActive: !strong && outlets.length >= 2,
    effects: [{ scenario, status, prob: PROB[status] }],
  });
  if (strong) review.push(`${scenario} → ${status} (${outlets.join(', ')})`);
}
console.log(`Tarjetas automáticas: ${cards.length} (${cards.filter((c) => c.autoActive).length} activas solas, ${review.length} pendientes de revisión)`);

if (!DRY) {
  news.cards = [...news.cards.filter((c) => !(c.captured === 'auto' && !c.verified)), ...cards];
  writeJSON('news', news);
  writeJSON('news-seen', Object.fromEntries(Object.entries(seen).filter(([, t]) => (now - Date.parse(t)) / 864e5 < 14)));
  writeJSON('news-candidates', found.filter((f) => (now - Date.parse(f.at)) / 864e5 < 14));
}
if (review.length && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `revisar=si\nlista=${review.join('; ')}\n`);
