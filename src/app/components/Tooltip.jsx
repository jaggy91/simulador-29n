import { useState, useCallback } from 'react';

// Tooltip flotante: el valor primero (fuerte), la etiqueta después. Se muestra con
// hover y con foco de teclado; nunca es la única vía al dato (hay tablas).
export function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = useCallback((e, content) => {
    const r = e.currentTarget?.getBoundingClientRect?.();
    const x = e.clientX ?? (r ? r.left + r.width / 2 : 0);
    const y = e.clientY ?? (r ? r.top : 0);
    setTip({ x, y, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const node = tip && (
    <div className="tip" role="status" style={{ left: Math.min(tip.x + 14, window.innerWidth - 220), top: tip.y + 14 }}>
      {tip.content}
    </div>
  );
  return { show, hide, node };
}

export function TipRows({ value, label, color, extra }) {
  return (
    <>
      <div className="v">{value}</div>
      <div className="row ink-2">
        {color && <span className="line-key" style={{ background: color }} />}
        {label}
      </div>
      {extra && <div className="muted small">{extra}</div>}
    </>
  );
}
