// Ejecuta el motor completo en segundo plano para el modo "qué pasaría si".
import { prepare, run } from '../engine/model.js';
import { simulate } from '../engine/montecarlo.js';
import { marginalSeats } from '../engine/scenarios.js';
import { loadJSON, MODEL_FILES, MODEL_KEYS } from './data.js';

let prepPromise = null;
function getPrep(root) {
  prepPromise ||= Promise.all(MODEL_FILES.map((f) => loadJSON(f, root))).then((files) => {
    const data = {};
    MODEL_FILES.forEach((f, i) => { data[MODEL_KEYS[f]] = files[i]; });
    return prepare(data);
  });
  return prepPromise;
}

self.onmessage = async ({ data: { id, root, poll, scenarios, n } }) => {
  try {
    const prep = await getPrep(root);
    const certain = scenarios.filter((s) => s.prob >= 1 && s.kind !== 'base');
    const central = run(prep, poll, certain);
    const mc = simulate(prep, poll, scenarios, { n });
    self.postMessage({
      id,
      result: {
        central: {
          congress: central.congress.national,
          blocs: central.congress.blocs,
          senate: { elected: central.senate.elected, total: central.senate.total, right: central.senate.right, size: central.senate.size, majority: central.senate.majority, threeFifths: central.senate.threeFifths },
          byProvince: central.congress.byProvince,
        },
        montecarlo: mc,
        seatsInPlay: marginalSeats(central.provinces, { limit: 25 }),
      },
    });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
