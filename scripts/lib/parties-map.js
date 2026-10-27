// Mapea partidos de Wikipedia (clave de {{party color|...}} o siglas) a ids internos.
// Los partidos no listados conservan sus siglas como id (cuentan para votos válidos
// y pueden superar el 3 % en su provincia, p. ej. Existe en Teruel).
const BY_KEY = {
  "People's Party (Spain)": 'PP',
  "Spanish Socialist Workers' Party": 'PSOE',
  "Socialists' Party of Catalonia": 'PSOE',
  "Socialists' Party of Galicia": 'PSOE',
  'Socialist Party of the Balearic Islands': 'PSOE',
  'Socialist Party of Navarre': 'PSOE',
  'Socialist Party of the Basque Country–Basque Country Left': 'PSOE',
  'Vox (political party)': 'VOX',
  'Sumar (electoral alliance)': 'SUMAR',
  'Sumem per Guanyar': 'SUMAR',
  'Sumar Més': 'SUMAR',
  'Republican Left of Catalonia': 'ERC',
  'Together for Catalonia (2020)': 'JUNTS',
  'EH Bildu (2023)': 'BILDU',
  'Basque Nationalist Party': 'PNV',
  'Galician Nationalist Bloc': 'BNG',
  'Canarian Coalition': 'CC',
  "Navarrese People's Union": 'UPN',
  'New Canaries': 'NC',
  'Popular Unity Candidacy': 'CUP',
  'Teruel Existe': 'EXISTE',
  'Aragón Existe': 'EXISTE',
  'Geroa Bai': 'GBAI',
  "Leonese People's Union": 'UPL',
  'Soria ¡Ya!': 'SY',
  'For Ávila': 'XAV',
  'Animalist Party with the Environment': 'PACMA',
  // Partidos y alianzas de 2024-2026.
  'Se Acabó La Fiesta': 'SALF',
  'Podemos (Spanish political party, 2022)': 'PODEMOS',
  'Podemos (Spanish political party)': 'PODEMOS',
  'Broad Front (Spain)': 'FA',
  'Valencian Front': 'FV',
  'Adelante Andalucía (2021)': 'AA',
  "People's Party of Andalusia": 'PP',
  "Spanish Socialist Workers' Party of Andalusia": 'PSOE',
  'Por Andalucía': 'FA',
};

// Por siglas o etiqueta, para listas sin {{party color}} propio.
const BY_LABEL = [
  // Senado 2023, Ibiza-Formentera: lista conjunta encabezada por el PSOE.
  [/PSOE–SMR–EU/, 'PSOE'],
  [/^ASG$/, 'ASG'],
  [/^AHI$/, 'AHI'],
];

// Federaciones regionales y partidos autonómicos, por patrón de la clave.
const KEY_PATTERNS = [
  [/^People's Party/, 'PP'],
  [/^(Socialists' Party of|Socialist Party of (?!Majorca|Menorca)|Spanish Socialist Workers' Party|Socialist Workers' Party|Asturian Socialist Federation)/, 'PSOE'],
  [/^Más Madrid|^Comuns|^Catalonia in Common|^Catalunya en Comú/, 'FA'],
  [/Compromís/, 'FV'],
  [/^Gomera Socialist Group/, 'ASG'],
  [/^Catalan Alliance|^Aliança Catalana/, 'AC'],
];

export function normalizeParty(party) {
  if (party.key && BY_KEY[party.key]) return BY_KEY[party.key];
  if (party.key) for (const [re, id] of KEY_PATTERNS) if (re.test(party.key)) return id;
  const label = party.abbr || party.label || '';
  for (const [re, id] of BY_LABEL) if (re.test(label)) return id;
  const abbr = (party.abbr || party.label || party.key || 'OTRO').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
  return 'x:' + abbr;
}
