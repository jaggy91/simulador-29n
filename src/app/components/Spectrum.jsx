import { Hemicycle } from './Hemicycle.jsx';
import { BlocBar } from './BlocBar.jsx';
import { MAJORITY } from '../../engine/blocs.js';

// Espectro izquierda ↔ derecha: 2·N+1 posiciones (−N…+N) precalculadas en spectrum.json.
// Cada paso hacia un lado activa un escenario más favorable a ese bloque.
const pct = (x) => {
  const v = 100 * x;
  if (v > 0 && v < 100 && (v < 1 || v > 99)) return `${(v > 99 ? Math.min(99.9, Math.floor(v * 10) / 10) : Math.max(0.1, Math.ceil(v * 10) / 10)).toLocaleString('es-ES')} %`;
  return `${Math.round(v)} %`;
};
const signed = (x) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x).toLocaleString('es-ES', { maximumFractionDigits: 1 })}`;

function tipText(t) {
  const out = [];
  if (t.derechaPierde != null && t.derechaPierde !== 0) out.push({ at: t.derechaPierde, text: 'La derecha pierde la mayoría' });
  if (t.investiduraConJunts != null) out.push({ at: t.investiduraConJunts, text: 'Investidura + Junts suman 176' });
  if (t.investiduraSola != null) out.push({ at: t.investiduraSola, text: 'La investidura suma 176 sola' });
  if (t.derechaGana != null && t.derechaGana !== 0) out.push({ at: t.derechaGana, text: 'La derecha logra la mayoría' });
  return out;
}

// Resumen de los puntos de vuelco de una fuente, para la tarjeta de la portada.
export function tippingSummary(src) {
  const t = src.tipping;
  if (t.derechaPierde == null) return 'ni con todos los escenarios a favor de la izquierda pierde la derecha la mayoría.';
  if (t.derechaPierde === 0) return 'la derecha no tiene hoy la mayoría en más de la mitad de las simulaciones.';
  const steps = (n) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'paso' : 'pasos'} hacia la izquierda`;
  const junts = t.investiduraConJunts != null ? `; la investidura + Junts suma 176 a ${steps(t.investiduraConJunts)}` : '';
  return `la derecha pierde la mayoría a ${steps(t.derechaPierde)}${junts}.`;
}

// level (−5…+5) lo controla la página, que tiñe el fondo según la posición.
export function Spectrum({ spectrum, source, level, onLevel }) {
  const setLevel = (v) => onLevel(typeof v === 'function' ? v(level) : v);
  const N = spectrum.maxLevel ?? 5;
  const LEVELS = Array.from({ length: 2 * N + 1 }, (_, i) => i - N);
  const pos = (l) => `${((l + N) / (2 * N)) * 100}%`;
  const src = spectrum.sources[source];
  if (!src) return null;
  const byLevel = Object.fromEntries(src.levels.map((l) => [l.level, l]));
  const cur = byLevel[level];
  const mc = cur.montecarlo;
  const tips = tipText(src.tipping);
  const meanR = (l) => byLevel[l].montecarlo.blocs.derecha.mean;

  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setLevel((l) => Math.max(-N, l - 1)); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setLevel((l) => Math.min(N, l + 1)); }
    if (e.key === 'Home') setLevel(-N);
    if (e.key === 'End') setLevel(N);
  };

  const Side = ({ side, dir }) => (
    <div className="spec-side">
      <h3>{dir < 0 ? 'A favor de la izquierda' : 'A favor de la derecha'}</h3>
      <ol>
        {spectrum.levers[side].map((l) => {
          const lv = dir * l.level;
          const on = Math.sign(level) === dir && Math.abs(level) >= l.level;
          const replacedBy = spectrum.levers[side].find((x) => x.replaces === l.id);
          const superseded = on && replacedBy && Math.abs(level) >= replacedBy.level;
          const delta = meanR(lv) - meanR(lv - dir);
          return (
            <li key={l.id} className={`lever${on ? ' on' : ''}${superseded ? ' superseded' : ''}`}>
              <button className="lever-btn" onClick={() => setLevel(lv)} aria-label={`Ir al nivel ${l.level} ${dir < 0 ? 'izquierda' : 'derecha'}`}>
                <span className="check" aria-hidden="true">{on ? (superseded ? '↻' : '✓') : ''}</span>
                <span>
                  <span className="lv">Nivel {l.level}</span>
                  {l.hypothetical && <span className="badge hipotético" style={{ marginLeft: 6 }}>Hipotético</span>}
                  <span className="lbl">{l.label}</span>
                  <span className="det">{superseded ? `Sustituido por el nivel ${replacedBy.level}. ` : ''}{l.detail}</span>
                  <span className="eff">Derecha {signed(Math.round(delta * 10) / 10)} escaños de media</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <>
      <div className="spec">
        <div className="spec-ends small">
          <span>◀ <span className="long">Todo a favor de la izquierda</span><span className="short">Izquierda</span></span>
          <span><span className="long">Todo a favor de la derecha</span><span className="short">Derecha</span> ▶</span>
        </div>
        <div className="spec-track" role="radiogroup" aria-label="Posición en el espectro" onKeyDown={onKey}>
          <div className="spec-gradient" aria-hidden="true" />
          {LEVELS.map((l) => {
            const p = byLevel[l].montecarlo.prob.mayoriaDerecha;
            return (
              <button
                key={l}
                role="radio"
                aria-checked={level === l}
                tabIndex={level === l ? 0 : -1}
                className={`spec-stop${level === l ? ' sel' : ''}${l === 0 ? ' zero' : ''}`}
                style={{ left: pos(l) }}
                onClick={() => setLevel(l)}
                title={`Nivel ${l}: P(mayoría derecha) ${pct(p)}`}
              >
                <span className="sr">{l === 0 ? 'Proyección oficial' : `Nivel ${Math.abs(l)} ${l < 0 ? 'izquierda' : 'derecha'}`}</span>
              </button>
            );
          })}
          {[...new Set(tips.map((t) => t.at))].map((at) => (
            <span key={at} className="spec-mark" style={{ left: pos(at) }} aria-hidden="true" />
          ))}
        </div>
        <div className="spec-scale small muted" aria-hidden="true">
          {LEVELS.map((l) => <span key={l} style={{ left: pos(l) }}>{l === 0 ? 'Hoy' : Math.abs(l)}</span>)}
        </div>
        {tips.length > 0 && (
          <ul className="spec-milestones small">
            {[...new Set(tips.map((t) => t.at))].sort((a, b) => Math.abs(a) - Math.abs(b)).map((at) => (
              <li key={at}>
                <button className="btn" onClick={() => setLevel(at)}>
                  <span className="spec-mark inline" aria-hidden="true" />
                  Nivel {Math.abs(at)} {at < 0 ? 'a la izquierda' : 'a la derecha'}: {tips.filter((t) => t.at === at).map((t) => t.text).join(' · ')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {src.tipping.derechaPierde == null && (
          <p className="small ink-2" style={{ marginTop: 8 }}>
            Ni con todos los escenarios a favor de la izquierda pierde la derecha la mayoría en más de la mitad de las simulaciones
            (en el extremo: {pct(byLevel[-N].montecarlo.prob.mayoriaDerecha)} de mayoría de la derecha).
          </p>
        )}
      </div>

      <div className="spec-now" aria-live="polite">
        <strong>{level === 0 ? 'Hoy: proyección oficial' : `${Math.abs(level)} ${Math.abs(level) === 1 ? 'paso' : 'pasos'} hacia la ${level < 0 ? 'izquierda' : 'derecha'}`}</strong>
        <span className="small ink-2">
          {level === 0 ? 'Sin escenarios añadidos.' : `${cur.active.length} ${cur.active.length === 1 ? 'escenario activo' : 'escenarios activos'} a favor de la ${level < 0 ? 'izquierda' : 'derecha'}.`}
        </span>
      </div>

      <div className="tiles" style={{ marginTop: 12 }}>
        <div className="tile"><div className="label">PP + Vox + UPN</div><div className="value">{mc.blocs.derecha.p50}</div><div className="note">90 %: {mc.blocs.derecha.p05}–{mc.blocs.derecha.p95} · mayoría {pct(mc.prob.mayoriaDerecha)}</div></div>
        <div className="tile"><div className="label">Investidura sin Junts</div><div className="value">{mc.blocs.investidura.p50}</div><div className="note">suma 176 sola: {pct(mc.prob.investiduraSola)}</div></div>
        <div className="tile"><div className="label">Investidura + Junts</div><div className="value">{pct(mc.prob.investiduraConJunts)}</div><div className="note">probabilidad de llegar a 176</div></div>
        <div className="tile"><div className="label">Senado: derecha</div><div className="value">{cur.central.senate.right}</div><div className="note">mayoría {pct(mc.prob.senadoMayoriaDerecha)} · 3/5 {pct(mc.prob.senado35Derecha)}</div></div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div>
          <p className="small ink-2" style={{ marginBottom: 8 }}>Congreso, proyección central del nivel {level === 0 ? 'oficial' : `${Math.abs(level)} ${level < 0 ? 'izquierda' : 'derecha'}`}.</p>
          <Hemicycle seats={cur.central.congress} majority={MAJORITY} title="Congreso en este nivel" ariaLabel="Hemiciclo del Congreso en el nivel elegido" />
          <BlocBar blocs={cur.central.blocs} total={350} markers={[{ at: MAJORITY, label: `Mayoría ${MAJORITY}` }]} interval={mc.blocs} />
        </div>
        <div className="spec-levers">
          {/* Primero, el lado hacia el que se avanza. */}
          {level > 0 ? <><Side side="derecha" dir={1} /><Side side="izquierda" dir={-1} /></> : <><Side side="izquierda" dir={-1} /><Side side="derecha" dir={1} /></>}
        </div>
      </div>
    </>
  );
}
