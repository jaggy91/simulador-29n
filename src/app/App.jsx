import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { loadJSON, dataRoot } from './data.js';
import { Hero, Chambers } from './components/Result.jsx';
import { PollEditor, pollProblem } from './components/PollEditor.jsx';
import { Timeline } from './components/Timeline.jsx';
import { Scenarios } from './components/Scenarios.jsx';
import { SeatsInPlay, ProvinceTable, PollTable } from './components/Tables.jsx';
import { Spectrum, tippingSummary } from './components/Spectrum.jsx';
import { Sources } from './components/Sources.jsx';
import { LiveResults } from './components/LiveResults.jsx';
import { openNotice } from './components/Notice.jsx';
const Methodology = lazy(() => import('./components/Methodology.jsx'));
import { modelInputs } from '../engine/evidence.js';
import { swingPoll } from '../engine/spectrum.js';

const fmtDate = (t) => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const WHATIF_N = 1500;
// Etiquetas cortas de las fuentes para el selector (la larga va en el título).
const SHORT = { media: 'Media de encuestas', cisOficial: 'CIS oficial', cis: 'CIS reestimado' };
// Nombre de la fuente dentro de una frase: "media de encuestas", pero "CIS (…)" en mayúsculas.
const inText = (label) => (label.startsWith('CIS') ? label : label.charAt(0).toLowerCase() + label.slice(1));

// Pestañas con dirección propia: #que-pasaria-si y #espectro.
const HASHES = { whatif: '#que-pasaria-si', espectro: '#espectro', metodologia: '#metodologia' };
const viewFromHash = () => Object.keys(HASHES).find((v) => HASHES[v] === window.location.hash) || 'proyeccion';
// Tinte máximo del fondo en los extremos del espectro (página / tarjetas), en %.
const TINT_PAGE = 30;
const TINT_SURFACE = 9;

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};


export default function App() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [source, setSourceState] = useState(() => store.get('source', 'media'));
  const [view, setViewState] = useState(viewFromHash);
  const [specLevel, setSpecLevel] = useState(0);
  const whatIf = view === 'whatif';
  const [overrides, setOverrides] = useState({});
  // Tarjetas de fuentes activas (por defecto, todas salvo las superadas).
  const [active, setActiveSet] = useState(null);
  const [swing, setSwing] = useState(0);
  // Porcentajes escritos por el usuario en "qué pasaría si" (null = los de la fuente).
  const [ownPoll, setOwnPoll] = useState(null);
  const [custom, setCustom] = useState(null);
  const [busy, setBusy] = useState(false);
  const worker = useRef(null);
  const reqId = useRef(0);

  const setSource = (s) => { setSourceState(s); store.set('source', s); };
  const setView = (v) => {
    if (v === view) return;
    window.history.pushState(null, '', HASHES[v] || window.location.pathname + window.location.search);
    // pushState no avisa a nadie: el aviso inicial necesita saber en qué sección estamos.
    window.dispatchEvent(new PopStateEvent('popstate'));
    setViewState(v);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const sync = () => setViewState(viewFromHash());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);

  // En la pestaña del espectro, el fondo se tiñe del color del bloque hacia el que se avanza.
  useEffect(() => {
    const root = document.documentElement.style;
    if (view === 'espectro' && specLevel !== 0) {
      const f = Math.abs(specLevel) / (d?.spectrum?.maxLevel ?? 5);
      root.setProperty('--tint-color', specLevel < 0 ? 'var(--b-investidura)' : 'var(--b-derecha)');
      root.setProperty('--tint', `${(f * TINT_PAGE).toFixed(1)}%`);
      root.setProperty('--tint-soft', `${(f * TINT_SURFACE).toFixed(1)}%`);
    } else {
      ['--tint-color', '--tint', '--tint-soft'].forEach((p) => root.removeProperty(p));
    }
  }, [view, specLevel]);

  useEffect(() => {
    Promise.all(['state', 'polls', 'scenarios', 'history', 'congreso-2023', 'sources'].map((n) => loadJSON(n)))
      .then(([state, polls, scenarios, history, congreso, sources]) => {
        const cards = sources.cards;
        setD({
          state, polls, catalog: scenarios.scenarios, history, provinces: congreso.provinces, cards,
          news: cards.filter((c) => !c.source),
          // Tarjetas de encuesta agrupadas por fuente (media, CIS oficial, reestimaciones del CIS).
          pollItems: Object.fromEntries(Object.keys(polls.sources).map((k) => [k, { items: cards.filter((c) => c.source === k) }])),
          defaults: new Set(cards.filter((c) => c.defaultActive && c.toggleable).map((c) => c.id)),
        });
        setActiveSet(new Set(cards.filter((c) => c.defaultActive && c.toggleable).map((c) => c.id)));
      })
      .then(() => loadJSON('spectrum').then((spectrum) => setD((x) => ({ ...x, spectrum }))).catch(() => {}))
      // Resultados provisionales: solo existen desde el cierre de las urnas del 29-N.
      .then(() => loadJSON('results').then((results) => setD((x) => ({ ...x, results }))).catch(() => {}))
      .catch((e) => setError(e.message));
  }, []);

  // Entradas del modelo según las tarjetas activas: escenarios resueltos y medias.
  const fromSources = useMemo(() => d && active && modelInputs(d.catalog, d.news, d.pollItems, active), [d, active]);
  const sourcesChanged = useMemo(() => d && active && (active.size !== d.defaults.size || [...active].some((id) => !d.defaults.has(id))), [d, active]);
  // Sobre lo que dicen las fuentes, los ajustes de "qué pasaría si".
  const effective = useMemo(() => fromSources?.scenarios.map((s) => {
    const o = (whatIf && overrides[s.id]) || {};
    const prob = o.mode === 'si' ? 1 : o.mode === 'no' ? 0 : s.prob;
    return { ...s, prob, ...(s.params && { params: { ...s.params, ...o.params } }) };
  }), [fromSources, overrides, whatIf]);
  const whatIfChanged = whatIf && (swing !== 0 || ownPoll || Object.values(overrides).some((o) => (o.mode && o.mode !== 'oficial') || o.params));
  const customized = Boolean(sourcesChanged || whatIfChanged);
  // Memorizada: un objeto nuevo en cada render relanzaría el cálculo del worker en bucle.
  // null si los porcentajes propios no son válidos (se conserva el último resultado).
  const inputPoll = useMemo(() => {
    if (!fromSources) return null;
    const p = whatIf && ownPoll ? ownPoll : fromSources.polls[source];
    return pollProblem(p) ? null : swingPoll(p, whatIf ? swing : 0);
  }, [fromSources, source, whatIf, swing, ownPoll]);

  useEffect(() => {
    if (!customized || !d) { setCustom(null); setBusy(false); return; }
    if (!inputPoll) { setBusy(false); return; }
    setBusy(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      worker.current ||= new Worker(new URL('./whatif.worker.js', import.meta.url), { type: 'module' });
      worker.current.onmessage = ({ data }) => {
        if (data.id !== reqId.current) return;
        setBusy(false);
        if (data.error) setError(data.error);
        else setCustom({ ...data.result, poll: inputPoll });
      };
      worker.current.postMessage({ id, root: dataRoot(), poll: inputPoll, scenarios: effective, n: WHATIF_N });
    }, 350);
    return () => clearTimeout(t);
  }, [customized, effective, inputPoll, d]);

  if (error) return <div className="wrap"><p style={{ marginTop: 24 }}>Error: {error}</p></div>;
  if (!d || !active) return <div className="wrap"><p className="muted" style={{ marginTop: 24 }}>Cargando…</p></div>;

  const official = d.state.results[source];
  const r = customized && custom ? custom : official;
  const poll = customized && custom ? custom.poll : official.poll;
  const setOverride = (id, patch) => setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
  const reset = () => { setOverrides({}); setSwing(0); setOwnPoll(null); };
  const resetSources = () => setActiveSet(new Set(d.defaults));
  const setActive = (id, on) => setActiveSet((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const off = [...d.defaults].filter((id) => !active.has(id)).length;
  const added = [...active].filter((id) => !d.defaults.has(id)).length;
  const cardTitle = Object.fromEntries(d.cards.map((c) => [c.id, c.title || c.firm]));

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div>
            <h1>Simulador 29-N</h1>
            <p className="small muted">Actualizado {fmtDate(d.state.updated)} · última encuesta {new Date(d.state.latestPoll).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })}</p>
          </div>
          <div className="filters">
            <div className="seg" role="group" aria-label="Fuente de la encuesta">
              {Object.entries(d.state.results).map(([k, v]) => (
                <button key={k} aria-pressed={source === k} onClick={() => setSource(k)} title={v.label}>{SHORT[k] || v.label}</button>
              ))}
            </div>
            <nav className="seg" aria-label="Secciones">
              <button aria-pressed={view === 'proyeccion'} onClick={() => setView('proyeccion')}>Proyección</button>
              <button aria-pressed={whatIf} onClick={() => setView('whatif')}>Qué pasaría si</button>
              {d.spectrum && <button aria-pressed={view === 'espectro'} onClick={() => setView('espectro')}>Espectro</button>}
              <button aria-pressed={view === 'metodologia'} onClick={() => setView('metodologia')}>Metodología</button>
            </nav>
          </div>
        </div>
      </header>

      {view === 'metodologia' ? (
        <main className="wrap">
          <Suspense fallback={<p className="muted" style={{ marginTop: 24 }}>Cargando la metodología…</p>}>
            <Methodology />
          </Suspense>
          <footer>
            <p><button className="linkish" onClick={openNotice}>Aviso: objetivo, método y fuentes</button></p>
          </footer>
        </main>
      ) : view === 'espectro' && d.spectrum ? (
        <main className="wrap">
          <section className="card" style={{ marginTop: 16 }}>
            <h2>¿Qué tiene que pasar para que gane cada bloque?</h2>
            <p className="sub">
              Laboratorio, aparte de la proyección oficial. Cada paso hacia un lado activa un escenario más favorable a ese bloque,
              de más a menos plausible, y la pantalla se tiñe de su color. Calculado con {inText(d.polls.sources[source].label)} del {new Date(d.spectrum.latestPoll).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })}.
            </p>
            <Spectrum spectrum={d.spectrum} source={source} level={specLevel} onLevel={setSpecLevel} />
          </section>
          <footer>
            <p>Los niveles se recalculan con cada actualización de las encuestas. Detalle de cada escenario y del cálculo en la metodología (§4.9).</p>
            <p><button className="linkish" onClick={openNotice}>Aviso: objetivo, método y fuentes</button></p>
          </footer>
        </main>
      ) : (
      <main className="wrap">
        {sourcesChanged && (
          <div className="banner" role="status">
            <span>
              {busy ? 'Recalculando…' : `Resultado con tu selección de fuentes: ${off ? `${off} desactivada${off === 1 ? '' : 's'}` : ''}${off && added ? ' y ' : ''}${added ? `${added} activada${added === 1 ? '' : 's'} a mano` : ''}. No es el resultado por defecto.`}
            </span>
            <button className="btn" onClick={resetSources}>Restablecer fuentes</button>
          </div>
        )}
        {whatIf && (
          <div className="banner" role="status">
            <span>
              {whatIfChanged
                ? busy ? 'Calculando tu simulación…' : `Simulación personalizada (${WHATIF_N.toLocaleString('es-ES')} iteraciones) sobre las fuentes activas.`
                : 'Modo "qué pasaría si": fuerza escenarios o mueve la encuesta más abajo; la web recalcula al momento.'}
            </span>
            {whatIfChanged && <button className="btn" onClick={reset}>Quitar ajustes</button>}
          </div>
        )}

        <div className={busy ? 'busy' : ''}>
          {d.results?.escrutado > 0 && <LiveResults results={d.results} projection={r.central.congress} />}
          <Hero r={r} caption={`Resultado con las fuentes activas (${active.size})${ownPoll ? ' y tus porcentajes' : ''} · no es una predicción`} />
          <Chambers r={r} congressSub={`Resultado central con las fuentes activas (${ownPoll ? 'tus porcentajes' : inText(d.polls.sources[source].label)}). 350 escaños.`} />

          <section className="card" style={{ marginTop: 16 }} id="fuentes">
            <h2>Fuentes que alimentan el resultado</h2>
            <p className="sub">
              Cada noticia, dato oficial y encuesta es una tarjeta. Por defecto todas cuentan (salvo las superadas por otra más reciente u oficial);
              desactiva las que no te convenzan y el resultado se recalcula. El efecto indicado es el de cada tarjeta con el resto por defecto.
            </p>
            <Sources cards={d.cards} active={active} setActive={setActive} source={source} catalog={d.catalog} overriddenBy={fromSources.overriddenBy} />
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2>Escenarios</h2>
            <p className="sub">Movimientos de candidaturas que cambian escaños con los mismos votos. Su estado y su probabilidad los fijan las fuentes activas.</p>
            {whatIf && (
              <div className="scn" style={{ marginBottom: 12 }}>
                <h3>¿Y si se mueve la encuesta?</h3>
                <label className="control">
                  <span className="row"><span>Puntos de la investidura a la derecha (negativo: al revés)</span><strong className="num" style={{ color: 'var(--ink)' }}>{swing > 0 ? '+' : ''}{swing.toFixed(1)}</strong></span>
                  <input type="range" min={-6} max={6} step={0.5} value={swing} onChange={(e) => setSwing(Number(e.target.value))} />
                </label>
                <details open={Boolean(ownPoll)}>
                  <summary>O escribe tus propios porcentajes</summary>
                  <div style={{ marginTop: 8 }}>
                    <PollEditor value={ownPoll} base={fromSources.polls[source]} baseLabel={inText(d.polls.sources[source].label)} onChange={setOwnPoll} onReset={() => setOwnPoll(null)} />
                  </div>
                </details>
              </div>
            )}
            <Scenarios scenarios={fromSources.scenarios} overrides={overrides} setOverride={setOverride} whatIf={whatIf} cardTitle={cardTitle} />
          </section>

          {d.spectrum?.sources[source] && (
            <section className="card teaser" style={{ marginTop: 16 }}>
              <div>
                <h2>¿Qué tiene que pasar para que gane cada bloque?</h2>
                <p className="sub" style={{ margin: '4px 0 0' }}>Con {inText(d.polls.sources[source].label)}, {tippingSummary(d.spectrum.sources[source])}</p>
              </div>
              <button className="btn" onClick={() => setView('espectro')}>Abrir el espectro →</button>
            </section>
          )}

          <section className="grid cols-2">
            <div className="card">
              <h2>Escaños en el aire</h2>
              <p className="sub">Los escaños que cambian de manos con menos votos en la proyección central.</p>
              <SeatsInPlay rows={r.seatsInPlay.slice(0, 12)} />
            </div>
            <div className="card">
              <h2>Evolución</h2>
              <p className="sub">Proyección oficial, {inText(d.polls.sources[source].label)}. Un punto por cada cambio.</p>
              <Timeline history={d.history} source={source} />
            </div>
          </section>

          <section className="grid cols-2">
            <div className="card">
              <h2>{whatIf && ownPoll ? 'Tus porcentajes' : 'Media resultante'}</h2>
              <p className="sub">{whatIf && ownPoll ? 'Los que has escrito en "qué pasaría si", con el traslado entre bloques si lo has movido.' : `${d.polls.sources[source].method}.`}</p>
              <PollTable poll={poll} />
              <details>
                <summary>Encuestas incluidas ({d.polls.sources[source].polls.length})</summary>
                <ul className="small ink-2">{d.polls.sources[source].polls.map((p) => <li key={p}>{p}</li>)}</ul>
              </details>
            </div>
            <div className="card">
              <h2>Escaños por provincia</h2>
              <p className="sub">Vista de tabla de la proyección central del Congreso.</p>
              <details>
                <summary>Ver las 52 circunscripciones</summary>
                <ProvinceTable byProvince={r.central.byProvince} provinces={d.provinces} />
              </details>
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2>Cómo funciona</h2>
            <div className="small ink-2" style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <p>Se parte de los votos de 2023 en cada provincia (Congreso y Senado), se reasignan a la oferta de partidos de 2026 y se escalan hasta que el total nacional coincide con la encuesta elegida. Los escaños salen de la ley electoral: D'Hondt con umbral del 3 % en el Congreso y voto limitado en el Senado.</p>
              <p>La incertidumbre se mide con {official.montecarlo.n.toLocaleString('es-ES')} simulaciones que mueven la encuesta (error de bloque, de partido y de provincia) y activan cada escenario según su probabilidad.</p>
              <p>El motor reproduce exactamente el reparto oficial de 2023. Fuentes: BOE y Junta Electoral Central (resultados de 2023, escaños de 2026, voto exterior), CIS (estimación oficial), encuestas publicadas (cada una con su enlace), INE (censo exterior) y la prensa enlazada en cada tarjeta. Lo que no tiene dato publicado aparece como «Supuesto».</p>
              <p>Es un modelo, no una predicción: depende de las encuestas y de supuestos documentados. El voto exterior extra es una hipótesis para "qué pasaría si", nunca un hecho.</p>
            </div>
          </section>
        </div>

        <footer>
          <p>Simulador 29-N · código y datos abiertos. Las probabilidades se recalculan cada vez que cambian las encuestas o los escenarios.</p>
          <p><button className="linkish" onClick={openNotice}>Aviso: objetivo, método y fuentes</button></p>
        </footer>
      </main>
      )}
    </>
  );
}
