import { partyColor, partyName, byHemicycle } from '../parties.js';

const fmt = (n) => n.toLocaleString('es-ES');

function Party({ id }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="swatch" style={{ background: partyColor(id) }} />
      {partyName(id)}
    </span>
  );
}

// Escaños que cambian de manos con menos votos (proyección central).
export function SeatsInPlay({ rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Provincia</th><th>Lo gana</th><th>Lo pierde</th><th className="r">Votos</th><th className="r">% válidos</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name} <span className="muted">({r.seats})</span></td>
              <td><Party id={r.gains} /></td>
              <td><Party id={r.loses} /></td>
              <td className="r">{fmt(r.need)}</td>
              <td className="r">{r.pctOfValid.toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tabla de escaños por provincia: la vista accesible del hemiciclo.
export function ProvinceTable({ byProvince, provinces }) {
  const parties = [...new Set(Object.values(byProvince).flatMap((p) => Object.keys(p)))].sort(byHemicycle);
  const total = Object.fromEntries(parties.map((p) => [p, Object.values(byProvince).reduce((a, x) => a + (x[p] || 0), 0)]));
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Provincia</th>
            {parties.map((p) => <th key={p} className="r"><span className="swatch" style={{ background: partyColor(p), marginRight: 4 }} />{partyName(p)}</th>)}
          </tr>
        </thead>
        <tbody>
          {provinces.map((pr) => (
            <tr key={pr.id}>
              <td>{pr.name}</td>
              {parties.map((p) => <td key={p} className="r">{byProvince[pr.id]?.[p] || ''}</td>)}
            </tr>
          ))}
          <tr>
            <th>Total</th>
            {parties.map((p) => <th key={p} className="r">{total[p]}</th>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Tabla de la encuesta usada (vista accesible y transparencia de la fuente).
export function PollTable({ poll }) {
  const rows = Object.entries(poll).sort((a, b) => b[1] - a[1]);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Partido</th><th className="r">% voto</th></tr></thead>
        <tbody>
          {rows.map(([p, v]) => <tr key={p}><td><Party id={p} /></td><td className="r">{v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
