// Verificación de encuestas: el índice es Wikipedia; cada encuesta se intenta comprobar
// en un canal distinto (su publicación original, los gráficos Datawrapper de esa
// publicación o el RSS del medio). Queda "verificada" si sus cifras aparecen allí, con
// el canal usado; si no, "no verificada" y su cifra sigue siendo la del índice.
// Solo canales abiertos: se respeta cualquier bloqueo (403, robots) y no se insiste.
// Las comprobaciones se guardan en data/poll-checks.json para no repetirlas cada hora.
import { setTimeout as sleep } from 'node:timers/promises';

const UA = 'simulador-29n/1.0 (+https://github.com/jaggy91/simulador-29n)';
const RECHECK_HOURS = 24; // reintento de las no verificadas
const MAX_FETCHES = 40; // por ejecución
// Canales RSS por medio (abiertos y pensados para programas). Solo sirven mientras el
// artículo está en el feed, así que se prueban en cuanto la encuesta aparece.
const RSS = {
  'elpais.com': ['https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada'],
};

let fetches = 0;
async function get(url) {
  if (fetches >= MAX_FETCHES) return { status: 'límite', text: '' };
  fetches++;
  await sleep(1000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml,text/csv,*/*' }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
    return { status: res.status, text: res.ok ? await res.text() : '' };
  } catch (e) {
    return { status: e.name, text: '' };
  }
}

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x?([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, /x/i.test(m) ? 16 : 10))).replace(/&amp;/g, '&');
const plain = (html) => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
// Datos que la propia página incrusta para sus gráficos y tablas (JSON en <script>).
const embedded = (html) => decode([...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join(' '));

// ¿Aparece la cifra v en el texto? Con decimales, "32,4" o "32.4"; un entero exige el
// signo % (o ",0") para no confundirse con fechas o escaños. En tablas (CSV) basta la celda.
export function hasNumber(text, v, { table = false } = {}) {
  const [i, d] = String(v).split('.');
  const re = d
    ? new RegExp(`(?<![\\d.,])${i}[.,]${d}0?(?!\\d)`)
    : table
      ? new RegExp(`(?<!\\d)(?<!\\d[.,])${i}(?:[.,]0)?(?!\\d|[.,]\\d)`) // la coma separa columnas
      : new RegExp(`(?<![\\d.,])${i}(?:[.,]0)?\\s?%`);
  return re.test(text);
}

// Cifras de una encuesta tal como las da el índice: partidos con 1 % o más, y las
// cifras conjuntas (p. ej. Sumar = FA + FV) tal cual, sin el reparto del modelo.
// El PP vale como PP+UPN (lo que da el índice) o como PP solo, si la fuente da UPN aparte.
export function targets(row) {
  const t = Object.entries(row.values).filter(([, v]) => v >= 1).map(([k, v]) => ({ k, vs: [v] }));
  const pp = t.find((x) => x.k === 'PP');
  if (pp && row.upn != null) pp.vs.push(Math.round(100 * (pp.vs[0] - row.upn)) / 100);
  for (const j of row.joint || []) t.push({ k: j.parties.join('+'), vs: [j.value] });
  return t;
}

// Verificada si PP, PSOE y Vox aparecen y, en total, al menos el 70 % de las cifras.
function score(row, text, opts) {
  const t = targets(row);
  const matched = t.filter((x) => x.vs.some((v) => hasNumber(text, v, opts))).map((x) => x.k);
  const core = ['PP', 'PSOE', 'VOX'].filter((k) => row.values[k] != null);
  const ok = core.length === 3 && core.every((k) => matched.includes(k)) && matched.length >= 0.7 * t.length;
  return { ok, matched, missing: t.map((x) => x.k).filter((k) => !matched.includes(k)) };
}

async function datawrapper(html) {
  const ids = [...new Set([...html.matchAll(/datawrapper(?:\.dwcdn\.net\/|-chart-|\/\?id=)([A-Za-z0-9]{5})/g)].map((m) => m[1]))].slice(0, 4);
  const out = [];
  for (const id of ids) {
    const js = await get(`https://datawrapper.dwcdn.net/${id}/embed.js`);
    const v = js.text.match(new RegExp(`${id}/(\\d+)`))?.[1];
    if (!v) continue;
    const csv = await get(`https://datawrapper.dwcdn.net/${id}/${v}/dataset.csv`);
    if (csv.text) out.push({ id, url: `https://datawrapper.dwcdn.net/${id}/${v}/`, text: csv.text });
  }
  return out;
}

async function verifyRow(row) {
  const tried = [];
  if (!row.url || /(^|\.)(x|twitter)\.com$/.test(host(row.url))) {
    tried.push(row.url ? 'X no es un canal abierto' : 'sin enlace en el índice');
  } else {
    const page = await get(row.url);
    if (page.text) {
      const s = score(row, plain(page.text));
      if (s.ok) return { status: 'verificada', channel: `publicación original (${host(row.url)})`, url: row.url, ...s };
      const e = score(row, embedded(page.text));
      if (e.ok) return { status: 'verificada', channel: `datos de gráficos de la publicación original (${host(row.url)})`, url: row.url, ...e };
      for (const dw of await datawrapper(page.text)) {
        const d = score(row, dw.text, { table: true });
        if (d.ok) return { status: 'verificada', channel: `gráfico Datawrapper de la publicación original (${host(row.url)})`, url: dw.url, ...d };
      }
      tried.push(`publicación original: faltan ${s.missing.join(', ')}`);
    } else {
      tried.push(`publicación original: ${page.status}`);
    }
    for (const feed of RSS[host(row.url)] || []) {
      const rss = await get(feed);
      const item = rss.text.split('<item>').find((it) => it.includes(row.url.split('?')[0]));
      if (!item) { tried.push(`RSS de ${host(row.url)}: el artículo ya no está en el feed`); continue; }
      const s = score(row, plain(decode(item)));
      if (s.ok) return { status: 'verificada', channel: `RSS de ${host(row.url)}`, url: feed, ...s };
      tried.push(`RSS de ${host(row.url)}: faltan ${s.missing.join(', ')}`);
    }
  }
  return { status: 'no verificada', channel: null, url: null, tried };
}

const keyOf = (row) => row.uid ?? `${row.firm}|${row.date}`;
const hashOf = (row) => JSON.stringify([row.values, row.joint]);

// rows: filas del índice que entran en alguna fuente. Devuelve {clave: comprobación}.
export async function verifyPolls(rows, cache = {}, now = new Date()) {
  const out = {};
  for (const row of rows) {
    const k = keyOf(row);
    const prev = cache[k];
    const fresh = prev && prev.hash === hashOf(row)
      && (prev.status === 'verificada' || (now - new Date(prev.checked)) / 36e5 < RECHECK_HOURS);
    out[k] = fresh ? prev : { ...(await verifyRow(row)), hash: hashOf(row), checked: now.toISOString() };
  }
  return out;
}

// Comprobación que se publica con cada tarjeta de encuesta.
export function publicCheck(c) {
  return c ? { status: c.status, channel: c.channel, url: c.url, checked: c.checked, matched: c.matched, missing: c.missing, tried: c.tried } : null;
}
export { keyOf as checkKey };
