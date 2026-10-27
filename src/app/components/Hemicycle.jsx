import { useMemo, useState } from 'react';
import { partyColor, partyName, byHemicycle } from '../parties.js';
import { useTooltip, TipRows } from './Tooltip.jsx';

// Posiciones de escaños en semicírculo: filas concéntricas con escaños proporcionales
// al radio; se ordenan por ángulo (izquierda → derecha) y se asignan por partido, de
// modo que cada partido ocupa una cuña.
function layout(total) {
  const rows = Math.max(4, Math.round(Math.sqrt(total / 2.5)));
  const r0 = 0.4;
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((1 - r0) * i) / (rows - 1));
  const sumR = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.floor((total * r) / sumR));
  for (let left = total - counts.reduce((a, b) => a + b, 0), i = rows - 1; left > 0; left--, i = (i - 1 + rows) % rows) counts[i]++;
  const seats = [];
  radii.forEach((r, i) => {
    const k = counts[i];
    for (let j = 0; j < k; j++) {
      const a = Math.PI * (1 - (k === 1 ? 0.5 : j / (k - 1)));
      seats.push({ x: r * Math.cos(a), y: r * Math.sin(a), a, r });
    }
  });
  seats.sort((p, q) => q.a - p.a || p.r - q.r);
  const outerK = counts[rows - 1];
  const dot = 0.42 * Math.min((1 - r0) / (rows - 1), Math.PI / (outerK - 1));
  return { seats, dot };
}

// seats: {partido: escaños}; designated: {partido: escaños designados} (Senado).
export function Hemicycle({ seats, majority, title, ariaLabel, extraLines = [] }) {
  const [hover, setHover] = useState(null);
  const tip = useTooltip();
  const parties = useMemo(() => Object.keys(seats).filter((p) => seats[p] > 0).sort(byHemicycle), [seats]);
  const total = parties.reduce((a, p) => a + seats[p], 0);
  const { seats: pos, dot } = useMemo(() => layout(total), [total]);

  let k = 0;
  const assigned = [];
  for (const p of parties) for (let i = 0; i < seats[p]; i++) assigned.push({ ...pos[k++], party: p });

  const W = 2.06;
  const H = 1.06;
  const sx = (x) => x + W / 2;
  const sy = (y) => H - 0.02 - y;
  const show = (e, p) => {
    setHover(p);
    tip.show(e, <TipRows value={`${seats[p]} escaños`} label={partyName(p)} color={partyColor(p)} extra={extraLines.find((l) => l.party === p)?.text} />);
  };
  const hide = () => { setHover(null); tip.hide(); };

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <title>{title}</title>
        {assigned.map((s, i) => (
          <circle
            key={i}
            cx={sx(s.x)}
            cy={sy(s.y)}
            r={dot}
            fill={partyColor(s.party)}
            opacity={hover && hover !== s.party ? 0.35 : 1}
            onPointerMove={(e) => show(e, s.party)}
            onPointerLeave={hide}
          />
        ))}
        <text x={W / 2} y={H - 0.2} textAnchor="middle" fontSize="0.13" fontWeight="650" fill="var(--ink)">{total}</text>
        <text x={W / 2} y={H - 0.08} textAnchor="middle" fontSize="0.06" fill="var(--ink-2)">mayoría: {majority}</text>
      </svg>
      <div className="legend" role="list">
        {parties.map((p) => (
          <button
            key={p}
            role="listitem"
            className="key"
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'default' }}
            onFocus={(e) => show(e, p)}
            onBlur={hide}
            onPointerEnter={(e) => show(e, p)}
            onPointerLeave={hide}
          >
            <span className="swatch" style={{ background: partyColor(p) }} />
            {partyName(p)} <span className="num" style={{ color: 'var(--ink)' }}>{seats[p]}</span>
          </button>
        ))}
      </div>
      {tip.node}
    </figure>
  );
}
