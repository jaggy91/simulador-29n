// Panel de fuentes: cada noticia, dato oficial y encuesta que alimenta el resultado,
// como tarjeta con su origen, lo que modifica, su efecto y un interruptor.
const TYPE = {
  noticia: 'Noticia', analisis: 'Análisis', oficial: 'Oficial', contexto: 'Contexto',
  base: 'Base del modelo', encuesta: 'Encuesta', cis: 'Reestimación CIS', 'cis-oficial': 'CIS oficial',
};
const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const num = (x, d = 1) => x.toLocaleString('es-ES', { maximumFractionDigits: d });
const signed = (x, d = 1) => `${x > 0 ? '+' : '−'}${num(Math.abs(x), d)}`;

function Effect({ impact }) {
  if (!impact) return null;
  const parts = [];
  if (Math.abs(impact.derecha) >= 0.1) parts.push(`Congreso, derecha ${signed(impact.derecha)} escaños de media`);
  if (impact.senado) parts.push(`Senado, derecha ${signed(impact.senado, 0)}`);
  if (Math.abs(impact.pMayoria) >= 0.005) parts.push(`P(mayoría) ${signed(100 * impact.pMayoria, 1)} pts`);
  return <p className="src-eff">{parts.length ? `Efecto: ${parts.join(' · ')}` : 'Efecto: sin cambio apreciable'}</p>;
}

// De dónde sale la cifra de una encuesta: el índice (Wikipedia) y, si se pudo, el canal
// en el que el sistema la comprobó por su cuenta.
function Check({ c }) {
  return (
    <>
      <CheckLine c={c} />
      {c.edited && (
        <p className="src-check">
          <span className="ver no">editada en Wikipedia</span> {fmtDate(c.edited.detected)}: {c.edited.change}
          {c.edited.revisions?.[0] ? ` (${c.edited.revisions[0].user}${c.edited.revisions[0].comment ? `: «${c.edited.revisions[0].comment.slice(0, 80)}»` : ''})` : ''}
        </p>
      )}
    </>
  );
}

function CheckLine({ c }) {
  const k = c.check;
  if (k?.status === 'verificada') {
    return (
      <p className="src-check">
        <span className="ver yes">✓ verificada</span> en {k.url ? <a href={k.url} target="_blank" rel="noreferrer">{k.channel}</a> : k.channel}
        {c.index && !/^PDF oficial/.test(k.channel) ? <span className="muted"> · índice: {c.index.split(':')[0]}</span> : null}
      </p>
    );
  }
  return (
    <p className="src-check">
      <span className="ver no">sin verificar</span> cifra tomada del índice ({c.index?.split(':')[0] || 'Wikipedia'}); no se pudo comprobar por otro canal
    </p>
  );
}

function Switch({ on, disabled, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
      <span className="knob" />
      <span className="txt">{on ? 'Activa' : 'Inactiva'}</span>
    </button>
  );
}

function Card({ c, on, setOn, source, scenarioLabel, byId, overriddenBy, lockLast }) {
  const impact = c.impact?.[source];
  const links = c.url ? [c.url] : c.sources || [];
  return (
    <article className={`src${on ? ' on' : ''}${overriddenBy ? ' over' : ''}`}>
      <div className="src-head">
        <span className={`chip ${c.type}`}>{TYPE[c.type] || c.type}</span>
        {!c.source && (
          <span className={`ver ${c.verified ? 'yes' : 'no'}`}>{c.verified ? '✓ verificada' : 'sin verificar'}</span>
        )}
        {c.captured === 'auto' && <span className="ver auto">captura automática</span>}
        <span className="src-meta">{c.outlet || c.firm} · {fmtDate(c.date)}</span>
      </div>
      <h3>{c.title || c.firm}</h3>
      {c.detail && <p className="src-det">{c.detail}</p>}
      {c.source && (
        <p className="src-det num">
          PP+UPN {num(c.values.PP)} · PSOE {num(c.values.PSOE)} · Vox {num(c.values.VOX)}{c.values.FA != null ? ` · FA ${num(c.values.FA)}` : ''}
          {c.sample ? ` · ${c.sample.toLocaleString('es-ES')} entrevistas` : ''}{c.weight < 1 ? ` · peso ${num(100 * c.weight, 1)} %` : ''}
        </p>
      )}
      {c.source && <Check c={c} />}
      {c.effects?.length > 0 && (
        <p className="src-mod">Modifica: {c.effects.map((e) => `${scenarioLabel(e.scenario)} → ${e.status}${e.prob != null ? ` (${Math.round(100 * e.prob)} %)` : ''}`).join(' · ')}</p>
      )}
      {overriddenBy && on && <p className="src-over">Sin efecto: la supera «{byId[overriddenBy]?.title}». Desactiva esa para aplicar esta.</p>}
      {overriddenBy && !on && <p className="src-over">Superada por «{byId[overriddenBy]?.title}» (más reciente o de mayor rango).</p>}
      <Effect impact={impact} />
      <div className="src-foot">
        <span className="src-links">
          {links.slice(0, 3).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{host(u)} ↗</a>)}
          {!links.length && <span className="muted">sin enlace</span>}
        </span>
        {c.toggleable && <Switch on={on} disabled={lockLast && on} onChange={setOn} label={`${on ? 'Desactivar' : 'Activar'}: ${c.title || c.firm}`} />}
      </div>
    </article>
  );
}

export function Sources({ cards, active, setActive, source, catalog, overriddenBy }) {
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const label = (id) => catalog.find((s) => s.id === id)?.label ?? id;
  const set = (id) => (on) => setActive(id, on);
  // Primero las que mandan (más recientes arriba); las superadas, al final.
  const superseded = (c) => Boolean(overriddenBy[c.id] || (!active.has(c.id) && c.overriddenBy));
  const news = cards.filter((c) => c.toggleable && !c.source)
    .sort((a, b) => superseded(a) - superseded(b) || b.date.localeCompare(a.date));
  const polls = cards.filter((c) => c.source === source);
  const activePolls = polls.filter((c) => active.has(c.id)).length;
  const fixed = cards.filter((c) => !c.toggleable).sort((a, b) => b.date.localeCompare(a.date));
  const common = { source, scenarioLabel: label, byId };

  return (
    <div className="sources">
      <h3 className="src-group">Noticias y datos que modifican el resultado ({news.filter((c) => active.has(c.id)).length} de {news.length} activas)</h3>
      <div className="src-grid">
        {news.map((c) => <Card key={c.id} c={c} on={active.has(c.id)} setOn={set(c.id)} overriddenBy={overriddenBy[c.id] || (!active.has(c.id) && c.overriddenBy)} {...common} />)}
      </div>

      {/* Sin fuente de encuestas (veda electoral) no hay bloque de encuestas. */}
      {source && (
        <>
          <h3 className="src-group">
            {{ media: 'Encuestas de la media', cisOficial: 'Estimación oficial del CIS', cis: 'Reestimaciones independientes del último barómetro del CIS' }[source] || 'Encuestas'} ({activePolls} de {polls.length} activas)
          </h3>
          {source !== 'media' && <p className="small ink-2" style={{ margin: '0 0 8px' }}>Los partidos que esta fuente no da se toman de la media de encuestas activa.</p>}
          <div className="src-grid polls">
            {polls.map((c) => <Card key={c.id} c={c} on={active.has(c.id)} setOn={set(c.id)} lockLast={activePolls <= 1} {...common} />)}
          </div>
        </>
      )}

      <details>
        <summary>Contexto y base del modelo ({fixed.length}): fijos, no se desactivan</summary>
        <div className="src-grid" style={{ marginTop: 8 }}>
          {fixed.map((c) => <Card key={c.id} c={c} on {...common} />)}
        </div>
      </details>
    </div>
  );
}
