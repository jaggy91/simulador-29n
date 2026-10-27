import { BLOC_LABEL } from '../parties.js';
import { useTooltip, TipRows } from './Tooltip.jsx';

// Barra de bloques: derecha desde la izquierda, investidura desde la derecha, Junts
// junto a la investidura (es quien decide) y otros en medio. Marcas de umbral
// (mayoría; en el Senado también 3/5). En HTML para que el texto tenga tamaño real.
const ORDER = ['derecha', 'otros', 'junts', 'investidura'];

export function BlocBar({ blocs, total, markers, interval }) {
  const tip = useTooltip();
  const values = { ...blocs, otros: total - blocs.derecha - blocs.investidura - blocs.junts };
  const segs = ORDER.filter((b) => values[b] > 0);
  const label = `Derecha ${values.derecha}, investidura ${values.investidura}, Junts ${values.junts}, otros ${values.otros}; ${markers.map((m) => m.label).join(', ')}`;

  return (
    <figure className={`blocbar${markers.length > 1 ? ' two' : ''}`} style={{ margin: '8px 0 0' }} aria-label={label} role="img">
      <div className="track">
        {segs.map((b) => (
          <div
            key={b}
            className="bseg"
            style={{ flex: `${values[b]} 0 0`, background: `var(--b-${b})`, color: b === 'otros' ? '#0b0b0b' : '#fff' }}
            onPointerMove={(e) => tip.show(e, <TipRows value={`${values[b]} escaños`} label={BLOC_LABEL[b]} color={`var(--b-${b})`} extra={interval?.[b] ? `90 % de las simulaciones: ${interval[b].p05}–${interval[b].p95}` : null} />)}
            onPointerLeave={tip.hide}
          >
            {values[b] / total > 0.07 ? values[b] : ''}
          </div>
        ))}
      </div>
      {markers.map((m, i) => (
        <div key={m.at} className={`marker ${i % 2 ? 'below' : 'above'}`} style={{ left: `${(100 * m.at) / total}%` }}>
          <span>{m.label}</span>
        </div>
      ))}
      <div className="legend">
        {segs.map((b) => (
          <span key={b} className="key">
            <span className="swatch" style={{ background: `var(--b-${b})` }} />
            {BLOC_LABEL[b]} <strong className="num" style={{ color: 'var(--ink)' }}>{values[b]}</strong>
          </span>
        ))}
      </div>
      {tip.node}
    </figure>
  );
}
