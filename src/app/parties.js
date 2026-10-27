// Nombres, color y orden en el hemiciclo (izquierda → derecha). Solo ocho partidos
// llevan color propio (paleta validada); el resto comparte el gris "otros" y se
// identifica por leyenda, tooltip y tabla. El orden deja siempre un partido gris entre
// ERC y PSOE y entre PSOE y Junts, cuyos colores no deben tocarse (validación CVD).
export const PARTIES = {
  PODEMOS: { name: 'Podemos', color: 'PODEMOS' },
  FA: { name: 'Frente Amplio', color: 'FA' },
  FV: { name: 'Compromís–Front Valencià' },
  AA: { name: 'Adelante Andalucía' },
  CUP: { name: 'CUP' },
  ERC: { name: 'ERC', color: 'ERC' },
  BILDU: { name: 'EH Bildu' },
  BNG: { name: 'BNG' },
  PSOE: { name: 'PSOE', color: 'PSOE' },
  NC: { name: 'Nueva Canarias' },
  PNV: { name: 'PNV' },
  GBAI: { name: 'Geroa Bai' },
  CC: { name: 'Coalición Canaria' },
  ASG: { name: 'ASG' },
  AHI: { name: 'AHI' },
  EXISTE: { name: 'Existe' },
  SY: { name: 'Soria ¡Ya!' },
  UPL: { name: 'UPL' },
  XAV: { name: 'Por Ávila' },
  JUNTS: { name: 'Junts', color: 'JUNTS' },
  UPN: { name: 'UPN' },
  PP: { name: 'PP', color: 'PP' },
  VOX: { name: 'Vox', color: 'VOX' },
  SALF: { name: 'SALF' },
};
const ORDER = Object.keys(PARTIES);

export const partyName = (id) => PARTIES[id]?.name ?? id.replace(/^x:/, '');
export const partyColor = (id) => `var(--p-${PARTIES[id]?.color ?? 'OTROS'})`;
export const hasOwnColor = (id) => Boolean(PARTIES[id]?.color);
const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.indexOf('JUNTS') - 0.5);
export const byHemicycle = (a, b) => rank(a) - rank(b);

export const BLOC_LABEL = {
  derecha: 'PP + Vox + UPN',
  investidura: 'Investidura sin Junts',
  junts: 'Junts',
  otros: 'Otros',
};
