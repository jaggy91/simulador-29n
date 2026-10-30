// Versión de la web durante la veda electoral (LOREG, art. 69.7): nada que salga de
// encuestas. Simulador con los porcentajes que escribe el usuario (de partida, el
// resultado real de 2023), noticias sin sondeos, escenarios y metodología sin cifras de
// encuestas. Solo lee los datos de VEDA_FILES.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { loadJSON, dataRoot } from './data.js';
import { VEDA, inVeda } from '../veda.js';
import { resolveEvidence } from '../engine/evidence.js';
import { Hero, Chambers } from './components/Result.jsx';
import { Scenarios } from './components/Scenarios.jsx';
import { Sources } from './components/Sources.jsx';
import { SeatsInPlay, ProvinceTable } from './components/Tables.jsx';
import { PollEditor, pollProblem } from './components/PollEditor.jsx';
import { openNotice } from './components/Notice.jsx';
const Methodology = lazy(() => import('./components/Methodology.jsx'));

const N = 1500;
const BUILD = typeof __VEDA_BUILD__ !== 'undefined' && __VEDA_BUILD__;

// Veda activa: por la hora, porque la versión publicada es la de veda (sin datos de
// encuestas) o forzada con ?veda para probarla. Se vuelve a mirar cada minuto, así que
// una pestaña abierta cambia sola a las 00:00.
export function useVeda() {
  const forced = BUILD || new URLSearchParams(window.location.search).has('veda');
  const [now, setNow] = useState(() => inVeda());
  useEffect(() => {
    const t = setInterval(() => setNow(inVeda()), 60e3);
    return () => clearInterval(t);
  }, []);
  return forced || now;
}

const viewFromHash = () => (window.location.hash === '#metodologia' ? 'metodologia' : 'simulador');

export function VedaApp() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [view, setViewState] = useState(viewFromHash);
  const [active, setActiveSet] = useState(null);
  const [ownPoll, setOwnPoll] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const worker = useRef(null);
  const reqId = useRef(0);

  const setView = (v) => {
    if (v === view) return;
    window.history.pushState(null, '', v === 'metodologia' ? '#metodologia' : window.location.pathname + window.location.search);
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

  useEffect(() => {
    Promise.all(['veda', 'scenarios', 'congreso-2023'].map((n) => loadJSON(n)))
      .then(([veda, scenarios, congreso]) => {
        const defaults = new Set(veda.cards.filter((c) => c.defaultActive && c.toggleable).map((c) => c.id));
        setD({ base: veda.base2023, cards: veda.cards, catalog: scenarios.scenarios, provinces: congreso.provinces, defaults });
        setActiveSet(new Set(defaults));
      })
      .catch((e) => setError(e.message));
  }, []);

  const resolved = useMemo(() => d && active && resolveEvidence(d.catalog, d.cards, active), [d, active]);
  const effective = useMemo(() => resolved?.scenarios.map((s) => {
    const o = overrides[s.id] || {};
    const prob = o.mode === 'si' ? 1 : o.mode === 'no' ? 0 : s.prob;
    return { ...s, prob, ...(s.params && { params: { ...s.params, ...o.params } }) };
  }), [resolved, overrides]);
  const poll = ownPoll || d?.base;
  const valid = poll && !pollProblem(poll);

  useEffect(() => {
    if (!effective || !valid) { setBusy(false); return; }
    setBusy(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      worker.current ||= new Worker(new URL('./whatif.worker.js', import.meta.url), { type: 'module' });
      worker.current.onmessage = ({ data }) => {
        if (data.id !== reqId.current) return;
        setBusy(false);
        if (data.error) setError(data.error);
        else setResult(data.result);
      };
      worker.current.postMessage({ id, root: dataRoot(), poll, scenarios: effective, n: N });
    }, 350);
    return () => clearTimeout(t);
  }, [effective, poll, valid]);

  if (error) return <div className="wrap"><p style={{ marginTop: 24 }}>Error: {error}</p></div>;
  if (!d || !active) return <div className="wrap"><p className="muted" style={{ marginTop: 24 }}>Cargando…</p></div>;

  const ended = Date.now() >= Date.parse(VEDA.end);
  const setActive = (id, on) => setActiveSet((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const sourcesChanged = active.size !== d.defaults.size || [...active].some((id) => !d.defaults.has(id));
  const changed = ownPoll || sourcesChanged || Object.values(overrides).some((o) => (o.mode && o.mode !== 'oficial') || o.params);
  const reset = () => { setOwnPoll(null); setOverrides({}); setActiveSet(new Set(d.defaults)); };
  const setOverride = (id, patch) => setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
  const cardTitle = Object.fromEntries(d.cards.map((c) => [c.id, c.title]));

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div>
            <h1>Simulador 29-N</h1>
            <p className="small muted">Veda electoral: del 24 de noviembre al cierre de las urnas del 29-N</p>
          </div>
          <div className="filters">
            <nav className="seg" aria-label="Secciones">
              <button aria-pressed={view === 'simulador'} onClick={() => setView('simulador')}>Simulador</button>
              <button aria-pressed={view === 'metodologia'} onClick={() => setView('metodologia')}>Metodología</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="banner veda" role="note">
          <span>
            {ended
              ? 'La veda electoral ha terminado. La proyección con encuestas vuelve con la próxima actualización de la web.'
              : 'Veda electoral. La ley (LOREG, art. 69.7) prohíbe publicar, difundir o reproducir sondeos en los cinco días anteriores a la votación. Hasta el cierre de las urnas el 29-N (20:00 en Canarias, 21:00 en la península), esta web no muestra nada basado en encuestas. Puedes simular el reparto con tus propios porcentajes.'}
          </span>
        </div>

        {view === 'metodologia' ? (
          <Suspense fallback={<p className="muted" style={{ marginTop: 24 }}>Cargando la metodología…</p>}>
            <Methodology veda />
          </Suspense>
        ) : (
          <>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>Tus porcentajes</h2>
              <p className="sub">
                % sobre voto válido. De partida, el resultado real de las generales de 2023, con el voto de Sumar repartido según la
                oferta de 2026 (Frente Amplio, Compromís–Front Valencià, Podemos y, en Cataluña, ERC). No es una encuesta.
              </p>
              <PollEditor value={ownPoll} base={d.base} baseLabel="el resultado de 2023" onChange={setOwnPoll} onReset={() => setOwnPoll(null)} />
            </section>

            {changed && (
              <div className="banner" role="status">
                <span>Simulación con tus ajustes.</span>
                <button className="btn" onClick={reset}>Quitar ajustes</button>
              </div>
            )}

            {result ? (
              <div className={busy ? 'busy' : ''}>
                <Hero r={result} caption={`Simulación con tus porcentajes (${N.toLocaleString('es-ES')} iteraciones) · no es una encuesta ni una predicción`} />
                <Chambers r={result} congressSub="Resultado central con tus porcentajes. 350 escaños." />
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 16 }}>{valid ? 'Calculando…' : 'Corrige los porcentajes para simular.'}</p>
            )}

            <section className="card" style={{ marginTop: 16 }} id="fuentes">
              <h2>Noticias y datos que alimentan los escenarios</h2>
              <p className="sub">Sin sondeos durante la veda. Desactiva las que no te convenzan y el resultado se recalcula.</p>
              <Sources cards={d.cards} active={active} setActive={setActive} catalog={d.catalog} overriddenBy={resolved.overriddenBy} />
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <h2>Escenarios</h2>
              <p className="sub">Movimientos de candidaturas que cambian escaños con los mismos votos. Puedes forzarlos y ajustar sus parámetros.</p>
              <Scenarios scenarios={resolved.scenarios} overrides={overrides} setOverride={setOverride} whatIf cardTitle={cardTitle} />
            </section>

            {result && (
              <section className="grid cols-2">
                <div className="card">
                  <h2>Escaños en el aire</h2>
                  <p className="sub">Los escaños que cambian de manos con menos votos en tu simulación.</p>
                  <SeatsInPlay rows={result.seatsInPlay.slice(0, 12)} />
                </div>
                <div className="card">
                  <h2>Escaños por provincia</h2>
                  <p className="sub">Vista de tabla de tu simulación del Congreso.</p>
                  <details>
                    <summary>Ver las 52 circunscripciones</summary>
                    <ProvinceTable byProvince={result.central.byProvince} provinces={d.provinces} />
                  </details>
                </div>
              </section>
            )}
          </>
        )}

        <footer>
          <p>Simulador 29-N · código y datos abiertos.</p>
          <p><button className="linkish" onClick={openNotice}>Aviso: objetivo, método y fuentes</button></p>
        </footer>
      </main>
    </>
  );
}
