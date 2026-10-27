// Carga los JSON de /data que necesita el modelo (Node).
import fs from 'node:fs';

const J = (f) => JSON.parse(fs.readFileSync(`data/${f}.json`, 'utf8'));

export function loadModelData() {
  return {
    congreso: J('congreso-2023'),
    senado: J('senado-2023'),
    europeas: J('europeas-2024'),
    andaluzas: J('andaluzas-2026'),
    seats: J('seats-2026'),
    designados: J('senado-designados'),
    cera: fs.existsSync('data/cera.json') ? J('cera') : null,
    ceraVoto: fs.existsSync('data/cera-voto-2023.json') ? J('cera-voto-2023') : null,
  };
}

export const readJSON = (f, fallback) => (fs.existsSync(`data/${f}.json`) ? J(f) : fallback);
export const writeJSON = (f, obj) => fs.writeFileSync(`data/${f}.json`, JSON.stringify(obj, null, 1));
