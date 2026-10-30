// Resultados provisionales de la noche electoral (data/results.json): el escrutinio
// provisional de Interior vía RTVE, frente a la proyección con las fuentes activas.
import { BLOCS, MAJORITY } from '../../engine/blocs.js';
import { Hemicycle } from './Hemicycle.jsx';

const num = (x, d = 0) => x.toLocaleString('es-ES', { maximumFractionDigits: d });
const time = (t) => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
const bloc = (seats, parties) => parties.reduce((a, p) => a + (seats[p] || 0), 0);

export function LiveResults({ results, projection }) {
  const seats = Object.fromEntries(Object.entries(results.national).filter(([, v]) => v.seats).map(([k, v]) => [k, v.seats]));
  const rows = Object.entries(results.national)
    .filter(([k, v]) => v.seats || projection[k])
    .sort((a, b) => b[1].seats - a[1].seats || b[1].votes - a[1].votes);
  const cc = results.crosscheck;
  return (
    <section className="card" style={{ marginTop: 16 }} aria-label="Resultados provisionales">
      <h2>Resultados provisionales · escrutado {num(results.escrutado, 2)} %</h2>
      <p className="sub">
        {results.source}. Actualizado: {time(results.sourceUpdated || results.updated)} (hora peninsular). Participación {num(results.participacion, 2)} %.
        {' '}{cc?.matches ? 'Contrastado con Público: coincide.' : cc?.error ? 'Sin contraste con Público.' : 'El contraste con Público no coincide todavía (pueden estar en momentos distintos del escrutinio).'}
        {results.missing?.length ? ` Faltan ${results.missing.length} provincias.` : ''}
        {' '}No es el resultado oficial: el escrutinio definitivo lo publica la Junta Electoral Central en el BOE.
      </p>
      <div className="grid cols-2">
        <Hemicycle seats={seats} majority={MAJORITY} title="Congreso: escrutinio provisional" ariaLabel="Hemiciclo del Congreso con el escrutinio provisional" />
        <div className="table-wrap"><table>
          <caption className="small ink-2">Escaños: escrutinio provisional frente a la proyección central con las fuentes activas</caption>
          <thead><tr><th>Partido</th><th>Votos</th><th>%</th><th>Escaños</th><th>Proyección</th></tr></thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{num(v.votes)}</td><td>{num(v.pct, 2)}</td><td>{v.seats}</td><td>{projection[k] || 0}</td></tr>
            ))}
            <tr><td><strong>Derecha (PP + Vox + UPN)</strong></td><td /><td /><td><strong>{bloc(seats, BLOCS.derecha)}</strong></td><td>{bloc(projection, BLOCS.derecha)}</td></tr>
            <tr><td><strong>Investidura sin Junts</strong></td><td /><td /><td><strong>{bloc(seats, BLOCS.investidura)}</strong></td><td>{bloc(projection, BLOCS.investidura)}</td></tr>
          </tbody>
        </table></div>
      </div>
    </section>
  );
}
