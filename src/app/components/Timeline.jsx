import { useState } from 'react';

// Evolución de dos probabilidades (una sola escala 0–100 %). Cruceta que se ajusta
// al punto más cercano y una lectura con ambas series.
const SERIES = [
  { key: 'pMayoriaDerecha', label: 'Mayoría absoluta de la derecha', color: 'var(--b-derecha)' },
  { key: 'pJunts', label: 'Junts decisivo', color: 'var(--b-junts)' },
];
const fmtDate = (t) => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function Timeline({ history, source }) {
  const [hi, setHi] = useState(null);
  const pts = history.filter((h) => h[source]);
  if (pts.length === 0) return <p className="muted small">Aún no hay historial.</p>;
  const W = 640, H = 220, L = 40, R = 16, T = 12, B = 28;
  const t0 = Date.parse(pts[0].t);
  const t1 = Math.max(Date.parse(pts[pts.length - 1].t), t0 + 3600e3);
  const x = (t) => L + ((Date.parse(t) - t0) / (t1 - t0)) * (W - L - R);
  const y = (p) => T + (1 - p) * (H - T - B);
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(pts[best].t) - px)) best = i; });
    setHi(best);
  };
  const cur = hi != null ? pts[hi] : pts[pts.length - 1];

  return (
    <figure style={{ margin: 0 }}>
      <div className="small" style={{ minHeight: 40 }}>
        <div className="ink-2">{fmtDate(cur.t)}{hi == null ? ' · último' : ''}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {SERIES.map((s) => (
            <span key={s.key} className="row" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="line-key" style={{ background: s.color }} />
              <strong className="num">{(100 * cur[source][s.key]).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</strong>
              <span className="ink-2">{s.label}</span>
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }} onPointerMove={onMove} onPointerLeave={() => setHi(null)} role="img" aria-label="Evolución de las probabilidades">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--grid)" strokeWidth="1" />
            <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" className="num">{g * 100}%</text>
          </g>
        ))}
        <text x={L} y={H - 8} fontSize="11" fill="var(--muted)">{fmtDate(pts[0].t)}</text>
        <text x={W - R} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="end">{fmtDate(pts[pts.length - 1].t)}</text>
        {SERIES.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts.map((p) => `${x(p.t)},${y(p[source][s.key])}`).join(' ')} />
            <circle cx={x(cur.t)} cy={y(cur[source][s.key])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
          </g>
        ))}
        {hi != null && <line x1={x(cur.t)} x2={x(cur.t)} y1={T} y2={H - B} stroke="var(--axis)" strokeWidth="1" />}
      </svg>
    </figure>
  );
}
