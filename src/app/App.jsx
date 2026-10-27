import { useEffect, useMemo, useRef, useState } from 'react';
import { loadJSON, dataRoot } from './data.js';
import { BLOCS, MAJORITY } from '../engine/blocs.js';
import { Hemicycle } from './components/Hemicycle.jsx';
import { BlocBar } from './components/BlocBar.jsx';
import { Timeline } from './components/Timeline.jsx';
import { Scenarios } from './components/Scenarios.jsx';
import { SeatsInPlay, ProvinceTable, PollTable } from './components/Tables.jsx';

// Porcentaje en formato español. Nunca muestra 0 % o 100 % si no es exacto: cerca de
// los extremos usa un decimal y lo acota (99,9 % / 0,1 %).
const pct = (x) => {
  const v = 100 * x;
  if (v > 0 && v < 100 && (v < 1 || v > 99)) {
    const c = v > 99 ? Math.min(99.9, Math.floor(v * 10) / 10) : Math.max(0.1, Math.ceil(v * 10) / 10);
    return `${c.toLocaleString('es-ES', { minimumFractionDigits: 1 })} %`;
  }
  return `${Math.round(v).toLocaleString('es-ES')} %`;
};
const fmtDate = (t) => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const sumOf = (seats, ps) => ps.reduce((a, p) => a + (seats[p] || 0), 0);
const blocsOf = (seats) => ({ derecha: sumOf(seats, BLOCS.derecha), investidura: sumOf(seats, BLOCS.investidura), junts: sumOf(seats, BLOCS.junts) });
const WHATIF_N = 1500;

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};

// Traslada `pts` puntos de la investidura a la derecha, en proporción al peso de cada partido.
function swingPoll(poll, pts) {
  if (!pts) return poll;
  const tr = sumOf(poll, BLOCS.derecha);
  const tl = sumOf(poll, BLOCS.investidura);
  return Object.fromEntries(Object.entries(poll).map(([p, v]) => [p,
    BLOCS.derecha.includes(p) ? v + (pts * v) / tr : BLOCS.investidura.includes(p) ? Math.max(0.05, v - (pts * v) / tl) : v]));
}

export default function App() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [source, setSourceState] = useState(() => store.get('source', 'media'));
  const [whatIf, setWhatIf] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [swing, setSwing] = useState(0);
  const [custom, setCustom] = useState(null);
  const [busy, setBusy] = useState(false);
  const worker = useRef(null);
  const reqId = useRef(0);

  const setSource = (s) => { setSourceState(s); store.set('source', s); };

  useEffect(() => {
    Promise.all(['state', 'polls', 'scenarios', 'history', 'congreso-2023'].map((n) => loadJSON(n)))
      .then(([state, polls, scenarios, history, congreso]) => setD({ state, polls, scenarios: scenarios.scenarios, history, provinces: congreso.provinces }))
      .catch((e) => setError(e.message));
  }, []);

  const effective = useMemo(() => d?.scenarios.map((s) => {
    const o = overrides[s.id] || {};
    const prob = o.mode === 'si' ? 1 : o.mode === 'no' ? 0 : s.prob;
    return { ...s, prob, params: { ...s.params, ...o.params } };
  }), [d, overrides]);
  const customized = whatIf && (swing !== 0 || Object.values(overrides).some((o) => (o.mode && o.mode !== 'oficial') || o.params));

  useEffect(() => {
    if (!customized || !d) { setCustom(null); setBusy(false); return; }
    setBusy(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      worker.current ||= new Worker(new URL('./whatif.worker.js', import.meta.url), { type: 'module' });
      worker.current.onmessage = ({ data }) => {
        if (data.id !== reqId.current) return;
        setBusy(false);
        if (data.error) setError(data.error);
        else setCustom({ ...data.result, poll: swingPoll(d.polls.sources[source].values, swing) });
      };
      worker.current.postMessage({ id, root: dataRoot(), poll: swingPoll(d.polls.sources[source].values, swing), scenarios: effective, n: WHATIF_N });
    }, 350);
    return () => clearTimeout(t);
  }, [customized, effective, swing, source, d]);

  if (error) return <div className="wrap"><p style={{ marginTop: 24 }}>Error: {error}</p></div>;
  if (!d) return <div className="wrap"><p className="muted" style={{ marginTop: 24 }}>Cargando…</p></div>;

  const official = d.state.results[source];
  const r = customized && custom ? custom : official;
  const poll = customized && custom ? custom.poll : official.poll;
  const mc = r.montecarlo;
  const congress = r.central.congress;
  const senate = r.central.senate;
  const sBlocs = blocsOf(senate.total);
  const setOverride = (id, patch) => setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
  const reset = () => { setOverrides({}); setSwing(0); };

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div>
            <h1>Simulador 29-N</h1>
            <p className="small muted">Actualizado {fmtDate(d.state.updated)} · última encuesta {new Date(d.state.latestPoll).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="filters">
            <div className="seg" role="group" aria-label="Fuente de la encuesta">
              {Object.entries(d.state.results).map(([k, v]) => (
                <button key={k} aria-pressed={source === k} onClick={() => setSource(k)}>{v.label}</button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Modo">
              <button aria-pressed={!whatIf} onClick={() => setWhatIf(false)}>Proyección</button>
              <button aria-pressed={whatIf} onClick={() => setWhatIf(true)}>Qué pasaría si</button>
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        {whatIf && (
          <div className="banner" role="status">
            <span>
              {customized
                ? busy ? 'Calculando tu simulación…' : `Simulación personalizada (${WHATIF_N.toLocaleString('es-ES')} iteraciones). No es la proyección oficial.`
                : 'Modo "qué pasaría si": fuerza escenarios o mueve la encuesta más abajo; la web recalcula al momento.'}
            </span>
            {customized && <button className="btn" onClick={reset}>Volver a la oficial</button>}
          </div>
        )}

        <div className={busy ? 'busy' : ''}>
          <section className="hero" aria-label="Resumen">
            <div className="card hero-figure">
              <h2>¿Mayoría absoluta de PP + Vox + UPN?</h2>
              <div className="value">{pct(mc.prob.mayoriaDerecha)}</div>
              <p className="small ink-2">
                Probabilidad de que la derecha sume 176 o más. Escaños: {mc.blocs.derecha.mean.toLocaleString('es-ES')} de media
                (90 % de las simulaciones entre {mc.blocs.derecha.p05} y {mc.blocs.derecha.p95}).
              </p>
            </div>
            <div className="tiles">
              <div className="tile"><div className="label">Investidura sin Junts</div><div className="value">{Math.round(mc.blocs.investidura.mean)}</div><div className="note">{mc.blocs.investidura.p05}–{mc.blocs.investidura.p95} escaños</div></div>
              <div className="tile"><div className="label">Junts decisivo</div><div className="value">{pct(mc.prob.juntsDecisivo)}</div><div className="note">ni derecha ni investidura llegan solas</div></div>
              <div className="tile"><div className="label">Ningún bloque suma</div><div className="value">{pct(Math.max(0, 1 - mc.prob.mayoriaDerecha - mc.prob.juntsDecisivo))}</div><div className="note">sin mayoría clara de bloques</div></div>
              <div className="tile"><div className="label">Senado: mayoría derecha</div><div className="value">{pct(mc.prob.senadoMayoriaDerecha)}</div><div className="note">{senate.majority} de {senate.size}</div></div>
              <div className="tile"><div className="label">Senado: 3/5 derecha</div><div className="value">{pct(mc.prob.senado35Derecha)}</div><div className="note">{senate.threeFifths} de {senate.size}</div></div>
              <div className="tile"><div className="label">Senado: derecha (central)</div><div className="value">{senate.right}</div><div className="note">electos + designados</div></div>
            </div>
          </section>

          <section className="grid cols-2">
            <div className="card">
              <h2>Congreso</h2>
              <p className="sub">Proyección central ({d.polls.sources[source].label.toLowerCase()} y escenarios confirmados). 350 escaños.</p>
              <Hemicycle seats={congress} majority={MAJORITY} title="Congreso de los Diputados" ariaLabel="Hemiciclo del Congreso por partidos" />
              <BlocBar blocs={r.central.blocs} total={350} markers={[{ at: MAJORITY, label: `Mayoría ${MAJORITY}` }]} interval={mc.blocs} />
            </div>
            <div className="card">
              <h2>Senado</h2>
              <p className="sub">{senate.size - 58} electos + 58 designados por los parlamentos autonómicos.</p>
              <Hemicycle seats={senate.total} majority={senate.majority} title="Senado" ariaLabel="Hemiciclo del Senado por partidos" />
              <BlocBar blocs={sBlocs} total={senate.size} markers={[{ at: senate.majority, label: `Mayoría ${senate.majority}` }, { at: senate.threeFifths, label: `3/5: ${senate.threeFifths}` }]} />
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2>Escenarios</h2>
            <p className="sub">Movimientos de candidaturas que cambian escaños con los mismos votos. La proyección oficial los pondera por su probabilidad.</p>
            {whatIf && (
              <div className="scn" style={{ marginBottom: 12 }}>
                <h3>¿Y si se mueve la encuesta?</h3>
                <label className="control">
                  <span className="row"><span>Puntos de la investidura a la derecha (negativo: al revés)</span><strong className="num" style={{ color: 'var(--ink)' }}>{swing > 0 ? '+' : ''}{swing.toFixed(1)}</strong></span>
                  <input type="range" min={-6} max={6} step={0.5} value={swing} onChange={(e) => setSwing(Number(e.target.value))} />
                </label>
              </div>
            )}
            <Scenarios scenarios={d.scenarios} overrides={overrides} setOverride={setOverride} whatIf={whatIf} />
          </section>

          <section className="grid cols-2">
            <div className="card">
              <h2>Escaños en el aire</h2>
              <p className="sub">Los escaños que cambian de manos con menos votos en la proyección central.</p>
              <SeatsInPlay rows={r.seatsInPlay.slice(0, 12)} />
            </div>
            <div className="card">
              <h2>Evolución</h2>
              <p className="sub">Proyección oficial, {d.polls.sources[source].label.toLowerCase()}. Un punto por cada cambio.</p>
              <Timeline history={d.history} source={source} />
            </div>
          </section>

          <section className="grid cols-2">
            <div className="card">
              <h2>Encuesta usada</h2>
              <p className="sub">{d.polls.sources[source].method}.</p>
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
              <p>El motor reproduce exactamente el reparto de 2023 y las simulaciones del vídeo de referencia sobre esos votos. Fuentes: Wikipedia (resultados y encuestas), BOE (escaños 2026), INE (censo exterior).</p>
              <p>Es un modelo, no una predicción: depende de las encuestas y de supuestos documentados. El voto exterior extra es una hipótesis para "qué pasaría si", nunca un hecho.</p>
            </div>
          </section>
        </div>

        <footer>
          <p>Simulador 29-N · código y datos abiertos. Las probabilidades se recalculan cada vez que cambian las encuestas o los escenarios.</p>
        </footer>
      </main>
    </>
  );
}
