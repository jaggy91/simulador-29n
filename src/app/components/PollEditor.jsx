// Porcentajes de voto escritos por el usuario (% sobre voto válido). Lo que no se asigna
// va a "otros" (partidos pequeños y voto en blanco).
import { useEffect, useState } from 'react';
import { partyColor, partyName } from '../parties.js';

const ORDER = ['PP', 'PSOE', 'VOX', 'FA', 'FV', 'PODEMOS', 'SALF', 'ERC', 'JUNTS', 'BILDU', 'PNV', 'BNG', 'CC', 'AA'];
const fmt = (x) => (Number.isFinite(x) ? x.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '');
const sum = (p) => Object.values(p).reduce((a, b) => a + b, 0);
const parse = (text) => (text.trim() === '' ? NaN : Number(text.trim().replace(',', '.')));

// Motivo por el que unos porcentajes no se pueden simular (null si son válidos).
export function pollProblem(p) {
  if (Object.values(p).some((v) => !(v >= 0) || v > 100)) return 'Hay un porcentaje vacío o fuera de 0–100.';
  if (sum(p) > 99.5) return `Suman ${fmt(sum(p))} %: tienen que dejar algo para otros partidos y el voto en blanco.`;
  return null;
}

// value: porcentajes propios (null = los de base). onChange recibe el objeto completo.
export function PollEditor({ value, base, baseLabel, onChange, onReset }) {
  const cur = value || base;
  // Texto tal como se escribe (admite coma decimal y campos a medio escribir).
  const [drafts, setDrafts] = useState({});
  useEffect(() => { if (!value) setDrafts({}); }, [value]);
  const parties = [...ORDER.filter((p) => p in base), ...Object.keys(base).filter((p) => !ORDER.includes(p))];
  const problem = pollProblem(cur);
  const set = (p, text) => {
    setDrafts((d) => ({ ...d, [p]: text }));
    onChange({ ...cur, [p]: parse(text) });
  };

  return (
    <div className="pe">
      <div className="pe-grid">
        {parties.map((p) => (
          <label key={p} className="pe-row">
            <span className="pe-name"><span className="swatch" style={{ background: partyColor(p) }} />{p === 'PP' ? 'PP (con UPN)' : partyName(p)}</span>
            <span className="pe-field">
              <input type="text" inputMode="decimal" value={drafts[p] ?? fmt(cur[p])} onChange={(e) => set(p, e.target.value)} />
              <span aria-hidden="true">%</span>
            </span>
          </label>
        ))}
      </div>
      <div className="pe-foot">
        <p className={problem ? 'small pe-error' : 'small ink-2'} role="status">
          {problem || `Suman ${fmt(sum(cur))} %. Otros partidos y voto en blanco: ${fmt(100 - sum(cur))} %.`}
        </p>
        {value && <button className="btn" onClick={onReset}>Volver a {baseLabel}</button>}
      </div>
    </div>
  );
}
