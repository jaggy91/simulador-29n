// Comparación final: el resultado real frente a la última proyección publicada antes de
// la veda. Comprueba si el resultado cae dentro de los intervalos del Monte Carlo y mide
// el error de cada fuente de encuestas.
//  - Proyección: data/projection-final.json. Si no existe, se toma del historial de git
//    el data/state.json vigente al empezar la veda (src/veda.js) y se guarda.
//  - Resultado: el escrutinio definitivo (data/congreso-2026.json y senado-2026.json,
//    del BOE) o, con --provisional, el escrutinio provisional (data/results.json).
// Escribe data/final-comparison.json. Uso: node scripts/compare-final.js [--provisional]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { VEDA } from '../src/veda.js';
import { BLOCS } from '../src/engine/blocs.js';

const PROVISIONAL = process.argv.includes('--provisional');
const read = (f) => JSON.parse(fs.readFileSync(`data/${f}.json`, 'utf8'));
const sum = (o, ks) => ks.reduce((a, k) => a + (o[k] || 0), 0);

export function snapshot() {
  if (fs.existsSync('data/projection-final.json')) return read('projection-final');
  const commit = execSync(`git log -1 --before="${VEDA.start}" --format=%H -- data/state.json`).toString().trim();
  if (!commit) throw new Error('No hay ningún data/state.json anterior a la veda en el historial');
  const state = JSON.parse(execSync(`git show ${commit}:data/state.json`, { maxBuffer: 64e6 }).toString());
  const snap = { commit, takenBefore: VEDA.start, ...state };
  fs.writeFileSync('data/projection-final.json', JSON.stringify(snap, null, 1));
  console.log(`Proyección previa a la veda: commit ${commit.slice(0, 7)} (${state.updated})`);
  return snap;
}

function real() {
  if (PROVISIONAL) {
    const r = read('results');
    const seats = Object.fromEntries(Object.entries(r.national).map(([k, v]) => [k, v.seats]));
    const shares = Object.fromEntries(Object.entries(r.national).map(([k, v]) => [k, v.pct]));
    return { kind: `provisional (${r.escrutado} % escrutado)`, source: r.source, seats, shares, senateRight: null };
  }
  const c = read('congreso-2026');
  const s = read('senado-2026');
  const seats = {};
  const votes = {};
  let valid = 0;
  for (const p of c.provinces) {
    for (const [k, n] of Object.entries(p.elected)) seats[k] = (seats[k] || 0) + n;
    for (const [k, n] of Object.entries(p.votes)) votes[k] = (votes[k] || 0) + n;
    valid += p.valid;
  }
  const shares = Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, Math.round((1e4 * v) / valid) / 100]));
  shares.PP = Math.round(100 * ((shares.PP || 0) + (shares.UPN || 0))) / 100; // las encuestas dan PP+UPN
  const elected = {};
  for (const x of s.constituencies) for (const [k, n] of Object.entries(x.elected)) elected[k] = (elected[k] || 0) + n;
  return { kind: 'definitivo', source: c.source, seats, shares, senateElectedRight: sum(elected, BLOCS.derecha) };
}

const proj = snapshot();
const r = real();
const realBlocs = Object.fromEntries(Object.entries(BLOCS).map(([b, ps]) => [b, sum(r.seats, ps)]));
const inside = (x, iv) => (iv ? x >= iv.p05 && x <= iv.p95 : null);
const sources = Object.fromEntries(Object.entries(proj.results).map(([k, res]) => {
  const mc = res.montecarlo;
  const parties = Object.fromEntries(Object.entries(mc.seatIntervals).map(([p, iv]) => [p, { real: r.seats[p] || 0, central: res.central.congress[p] || 0, p05: iv.p05, p95: iv.p95, dentro: inside(r.seats[p] || 0, iv) }]));
  const pollError = Object.fromEntries(Object.entries(res.poll).filter(([p]) => r.shares[p] != null).map(([p, v]) => [p, Math.round(100 * (v - r.shares[p])) / 100]));
  return [k, {
    label: res.label,
    derecha: { real: realBlocs.derecha, central: res.central.blocs.derecha, p05: mc.blocs.derecha.p05, p95: mc.blocs.derecha.p95, dentro: inside(realBlocs.derecha, mc.blocs.derecha), pMayoria: mc.prob.mayoriaDerecha },
    investidura: { real: realBlocs.investidura, central: res.central.blocs.investidura, p05: mc.blocs.investidura.p05, p95: mc.blocs.investidura.p95, dentro: inside(realBlocs.investidura, mc.blocs.investidura) },
    partidos: parties,
    errorEncuesta: pollError, // encuesta − real (pp)
  }];
}));
const out = { updated: new Date().toISOString(), result: r.kind, resultSource: r.source, projection: { commit: proj.commit, updated: proj.updated, latestPoll: proj.latestPoll }, real: { seats: r.seats, blocs: realBlocs, shares: r.shares }, sources };
fs.writeFileSync('data/final-comparison.json', JSON.stringify(out, null, 1));
for (const [k, s] of Object.entries(sources)) console.log(`${s.label}: derecha real ${s.derecha.real} · central ${s.derecha.central} · 90 % ${s.derecha.p05}–${s.derecha.p95} ${s.derecha.dentro ? 'dentro' : 'FUERA'}`);
console.log('→ data/final-comparison.json');
