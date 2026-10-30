// Resumen (probabilidades) y hemiciclos de un resultado: la proyección con las fuentes
// activas o una simulación con los porcentajes del usuario.
import { BLOCS, MAJORITY } from '../../engine/blocs.js';
import { Hemicycle } from './Hemicycle.jsx';
import { BlocBar } from './BlocBar.jsx';

// Porcentaje en formato español. Nunca muestra 0 % o 100 % si no es exacto: cerca de
// los extremos usa un decimal y lo acota (99,9 % / 0,1 %).
export const pct = (x) => {
  const v = 100 * x;
  if (v > 0 && v < 100 && (v < 1 || v > 99)) {
    const c = v > 99 ? Math.min(99.9, Math.floor(v * 10) / 10) : Math.max(0.1, Math.ceil(v * 10) / 10);
    return `${c.toLocaleString('es-ES', { minimumFractionDigits: 1 })} %`;
  }
  return `${Math.round(v).toLocaleString('es-ES')} %`;
};
const sumOf = (seats, ps) => ps.reduce((a, p) => a + (seats[p] || 0), 0);
const blocsOf = (seats) => ({ derecha: sumOf(seats, BLOCS.derecha), investidura: sumOf(seats, BLOCS.investidura), junts: sumOf(seats, BLOCS.junts) });

export function Hero({ r, caption }) {
  const mc = r.montecarlo;
  const senate = r.central.senate;
  return (
    <section className="hero" aria-label="Resumen">
      <div className="card hero-figure">
        <p className="small ink-2" style={{ marginBottom: 4 }}>{caption}</p>
        <h2>¿Mayoría absoluta de PP + Vox + UPN?</h2>
        <div className="value">{pct(mc.prob.mayoriaDerecha)}</div>
        <p className="small ink-2">
          Probabilidad de que la derecha sume 176 o más. Escaños: {mc.blocs.derecha.mean.toLocaleString('es-ES')} de media
          (90 % de las simulaciones entre {mc.blocs.derecha.p05} y {mc.blocs.derecha.p95}).
          {mc.prob.mayoriaDerechaConCC != null && <> Con Coalición Canaria, que en 2023 votó a Feijóo y a Sánchez: {pct(mc.prob.mayoriaDerechaConCC)}.</>}
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
  );
}

export function Chambers({ r, congressSub }) {
  const senate = r.central.senate;
  return (
    <section className="grid cols-2">
      <div className="card">
        <h2>Congreso</h2>
        <p className="sub">{congressSub}</p>
        <Hemicycle seats={r.central.congress} majority={MAJORITY} title="Congreso de los Diputados" ariaLabel="Hemiciclo del Congreso por partidos" />
        <BlocBar blocs={r.central.blocs} total={350} markers={[{ at: MAJORITY, label: `Mayoría ${MAJORITY}` }]} interval={r.montecarlo.blocs} />
      </div>
      <div className="card">
        <h2>Senado</h2>
        <p className="sub">{senate.size - 58} electos + 58 designados por los parlamentos autonómicos.</p>
        <Hemicycle seats={senate.total} majority={senate.majority} title="Senado" ariaLabel="Hemiciclo del Senado por partidos" />
        <BlocBar blocs={blocsOf(senate.total)} total={senate.size} markers={[{ at: senate.majority, label: `Mayoría ${senate.majority}` }, { at: senate.threeFifths, label: `3/5: ${senate.threeFifths}` }]} />
      </div>
    </section>
  );
}
