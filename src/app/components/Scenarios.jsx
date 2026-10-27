// Tarjetas de escenario: estado, probabilidad, fuentes y, en modo "qué pasaría si",
// controles para forzarlo (sí/no) y ajustar sus parámetros.
const pct = (x) => `${Math.round(x * 100)} %`;
const STATUS = { confirmado: 'Confirmado', rumor: 'Rumor', negociación: 'En negociación', hipotético: 'Hipotético', descartado: 'Descartado', superado: 'Superado', 'sin datos': 'Sin datos' };

const SPLITS = {
  cera2023: { label: 'Como votó el exterior en 2023 en cada provincia (dato oficial)', split: 'cera2023' },
  neutral: { label: 'Como vota cada provincia en la proyección', split: null },
  psoe: { label: 'Todo al PSOE (techo)', split: { PSOE: 1 } },
  mix: { label: 'Hipótesis: 45 % PSOE, 30 % PP, 10 % Vox, 10 % FA, 5 % Podemos', split: { PSOE: 45, PP: 30, VOX: 10, FA: 10, PODEMOS: 5 } },
};

function Slider({ label, value, min, max, step, fmt, onChange }) {
  return (
    <label className="control">
      <span className="row"><span>{label}</span><strong className="num" style={{ color: 'var(--ink)' }}>{fmt(value)}</strong></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Params({ s, params, set }) {
  const p = params;
  switch (s.kind) {
    case 'withdraw':
      return (
        <>
          <Slider label="Trasvase de su voto al PSOE" value={p.share} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => set({ share: v })} />
          {s.options?.where && (
            <label className="control">
              <span>Provincias</span>
              <select value={p.where} onChange={(e) => set({ where: e.target.value })}>
                {Object.entries(s.options.where).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
        </>
      );
    case 'senate-pact':
      return (
        <>
          <Slider label="Votantes del PP que apoyan la lista resultante" value={p.sharePP ?? 1} min={0.5} max={1} step={0.01} fmt={pct} onChange={(v) => set({ sharePP: v })} />
          <Slider label="Votantes de Vox que siguen la consigna" value={p.shareVox ?? 1} min={0.5} max={1} step={0.01} fmt={pct} onChange={(v) => set({ shareVox: v })} />
        </>
      );
    case 'senate-merge':
      return (
        <>
          <Slider label="Votantes del PSOE que apoyan la lista conjunta" value={p.intoShare ?? 1} min={0.5} max={1} step={0.01} fmt={pct} onChange={(v) => set({ intoShare: v })} />
          <Slider label="Votantes del socio que apoyan la lista conjunta" value={p.share ?? 1} min={0.5} max={1} step={0.01} fmt={pct} onChange={(v) => set({ share: v })} />
        </>
      );
    case 'extra-votes':
      return (
        <>
          <div className="seg" role="group" aria-label="Modo del voto exterior">
            {[['techo', 'Techo estratégico'], ['realista', 'Realista (censo INE)']].map(([k, l]) => (
              <button key={k} aria-pressed={p.mode === k} onClick={() => set({ mode: k })}>{l}</button>
            ))}
          </div>
          {p.mode === 'techo' ? (
            <Slider label="Votos extra al PSOE, colocados donde más escaños mueven" value={p.budget} min={0} max={60000} step={1000} fmt={(v) => v.toLocaleString('es-ES')} onChange={(v) => set({ budget: v })} />
          ) : (
            <>
              <Slider label="Nacionalizados que pueden votar (de 163.020)" value={p.canVote ?? 1} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => set({ canVote: v })} />
              <Slider label="Participación" value={p.turnout ?? 0.1} min={0} max={0.5} step={0.01} fmt={pct} onChange={(v) => set({ turnout: v })} />
              <label className="control">
                <span>Reparto por partido (no hay encuestas de este electorado)</span>
                <select value={p.splitKey ?? 'cera2023'} onChange={(e) => set({ splitKey: e.target.value, split: SPLITS[e.target.value].split })}>
                  {Object.entries(SPLITS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </>
          )}
        </>
      );
    default:
      return null;
  }
}

export function Scenarios({ scenarios, overrides, setOverride, whatIf, cardTitle = {} }) {
  return (
    <div className="scenarios">
      {scenarios.map((s) => {
        const o = overrides[s.id] || {};
        const mode = o.mode || 'oficial';
        const params = { ...s.params, ...o.params };
        return (
          <article key={s.id} className="scn">
            <div className="head">
              <h3>{s.label}</h3>
              <span className={`badge ${s.status}`}>{STATUS[s.status] || s.status}</span>
            </div>
            <p className="small ink-2">{s.detail}</p>
            <p className="small">
              Probabilidad según las fuentes activas: <strong className="num">{pct(s.prob)}</strong>
              {s.kind === 'base' && <span className="muted"> · incluido en la base de partidos</span>}
            </p>
            {s.appliedBy && <p className="applied">Según: <a href="#fuentes">«{cardTitle[s.appliedBy]}»</a></p>}
            {[...new Set(Object.values(s.paramsBy || {}))].filter((id) => id !== s.appliedBy).map((id) => (
              <p key={id} className="applied">Parámetros según: <a href="#fuentes">«{cardTitle[id]}»</a></p>
            ))}
            {s.assumptions && Object.values(s.assumptions).map((t) => <p key={t} className="applied">Supuesto: {t}</p>)}
            {s.data && Object.values(s.data).map((t) => <p key={t} className="applied">Dato: {t}</p>)}
            {!s.appliedBy && s.kind !== 'base' && s.kind !== 'extra-votes' && <p className="applied">Ninguna fuente activa lo menciona.</p>}
            {s.sources?.length > 0 && (
              <p className="small muted">
                Fuentes:{' '}
                {s.sources.map((u, i) => (
                  <span key={u}>{i > 0 && ' · '}<a href={u} target="_blank" rel="noreferrer">{new URL(u).hostname.replace(/^www\./, '')}</a></span>
                ))}
              </p>
            )}
            {whatIf && s.kind !== 'base' && (
              <>
                <div className="seg" role="group" aria-label={`Forzar ${s.label}`}>
                  {[['oficial', `Según fuentes (${pct(s.prob)})`], ['si', 'Sí'], ['no', 'No']].map(([k, l]) => (
                    <button key={k} aria-pressed={mode === k} onClick={() => setOverride(s.id, { mode: k })}>{l}</button>
                  ))}
                </div>
                {mode !== 'no' && <Params s={s} params={params} set={(p) => setOverride(s.id, { params: { ...o.params, ...p } })} />}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
