// Carga de los JSON publicados junto a la web (dist/data). `root` es la URL absoluta
// de la carpeta data/ (el worker la recibe de la página, porque vive en /assets/).
export const dataRoot = () => new URL('data/', document.baseURI).href;

export async function loadJSON(name, root = dataRoot()) {
  const res = await fetch(`${root}${name}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar ${name}.json (${res.status})`);
  return res.json();
}

export const MODEL_FILES = ['congreso-2023', 'senado-2023', 'europeas-2024', 'andaluzas-2026', 'seats-2026', 'senado-designados', 'cera'];
export const MODEL_KEYS = {
  'congreso-2023': 'congreso',
  'senado-2023': 'senado',
  'europeas-2024': 'europeas',
  'andaluzas-2026': 'andaluzas',
  'seats-2026': 'seats',
  'senado-designados': 'designados',
  cera: 'cera',
};
