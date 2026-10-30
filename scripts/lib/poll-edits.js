// Ediciones en Wikipedia de encuestas ya publicadas: cada hora se comparan las filas del
// índice con las de la descarga anterior (data/polls.json). Si cambian las cifras de una
// encuesta, o desaparece, se registra en data/poll-edits.json con las revisiones de
// Wikipedia de ese intervalo (fecha, editor y comentario), y la tarjeta lo indica.

const UA = 'simulador-29n/1.0 (+https://github.com/jaggy91/simulador-29n)';
const TITLE = 'Opinion polling for the 2026 Spanish general election';

// Identificador de fila: empresa|fecha y, si se repite (dos estudios el mismo día),
// |2, |3… por orden de aparición.
export function withUids(rows) {
  const seen = {};
  return rows.map((r) => {
    const k = `${r.firm}|${r.date}`;
    seen[k] = (seen[k] || 0) + 1;
    return { ...r, uid: seen[k] === 1 ? k : `${k}|${seen[k]}` };
  });
}

const sig = (r) => JSON.stringify([r.values, r.joint, r.sample, r.upn ?? null]);

async function revisions(since) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(TITLE)}&rvlimit=20&rvprop=timestamp|user|comment&rvend=${since}&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const page = Object.values((await res.json()).query.pages)[0];
    return (page.revisions || []).map((r) => ({ at: r.timestamp, user: r.user, comment: r.comment || '' }));
  } catch {
    return [];
  }
}

// prev: data/polls.json anterior (o null). Devuelve las ediciones nuevas.
export async function detectEdits(rows, prev) {
  if (!prev?.rows) return [];
  const old = new Map(withUids(prev.rows).map((r) => [r.uid, r]));
  const now = new Map(rows.map((r) => [r.uid, r]));
  const edits = [];
  for (const r of rows) {
    const o = old.get(r.uid);
    if (o && sig(o) !== sig(r)) edits.push({ uid: r.uid, firm: r.firm, date: r.date, kind: 'cambio', before: { values: o.values, joint: o.joint, sample: o.sample }, after: { values: r.values, joint: r.joint, sample: r.sample } });
  }
  for (const [uid, o] of old) if (!now.has(uid)) edits.push({ uid, firm: o.firm, date: o.date, kind: 'eliminada', before: { values: o.values, joint: o.joint, sample: o.sample } });
  if (!edits.length) return [];
  const revs = await revisions(prev.fetched);
  const detected = new Date().toISOString();
  return edits.map((e) => ({ ...e, detected, since: prev.fetched, revisions: revs }));
}

// Cambios legibles: «PP 32,5→32,3».
export function describe(e) {
  if (e.kind === 'eliminada') return 'eliminada del índice';
  const b = e.before.values;
  const a = e.after.values;
  const parts = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]).map((k) => `${k} ${b[k] ?? '—'}→${a[k] ?? '—'}`);
  if (e.before.sample !== e.after.sample) parts.push(`muestra ${e.before.sample ?? '—'}→${e.after.sample ?? '—'}`);
  return parts.join(', ') || 'cifras conjuntas cambiadas';
}
