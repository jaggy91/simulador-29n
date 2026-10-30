// Ficheros oficiales de resultados del Ministerio del Interior (área de descargas de
// infoelectoral): un ZIP por proceso con ficheros .DAT de ancho fijo, descritos en el
// FICHEROS.rtf que va dentro. Caché local en .cache/interior.
// infoelectoral solo responde desde España: la descarga es puntual y el ZIP queda en
// caché; el resultado se versiona en data/.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CACHE = path.resolve('.cache/interior');
const UA = 'simulador-29n/1.0 (+https://github.com/jaggy91/simulador-29n)';
// tipo: 02 Congreso, 03 Senado, 07 Parlamento Europeo. TOTA = totales por ámbito.
export const zipUrl = (tipo, anyo, mes) => `https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/${tipo}${anyo}${mes}_TOTA.zip`;

export async function interiorZip(tipo, anyo, mes) {
  const file = path.join(CACHE, `${tipo}${anyo}${mes}_TOTA.zip`);
  if (!fs.existsSync(file)) {
    const res = await fetch(zipUrl(tipo, anyo, mes), { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Interior ${res.status}: ${zipUrl(tipo, anyo, mes)}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return unzip(fs.readFileSync(file));
}

// Lector mínimo de ZIP (directorio central + deflate), sin dependencias.
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('ZIP sin directorio central');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('latin1', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const lines = (b) => b.toString('latin1').split(/\r?\n/).filter((l) => l.length > 10);

// 03xxaamm.DAT: candidaturas. 9–14 código, 15–64 siglas, 65–214 denominación.
export function candidaturas(files) {
  const f = Object.entries(files).find(([n]) => /^03\d+\.DAT$/i.test(n))[1];
  return Object.fromEntries(lines(f).map((l) => [l.slice(8, 14), { siglas: l.slice(14, 64).trim(), nombre: l.slice(64, 214).trim() }]));
}

// 07xxaamm.DAT: datos comunes de ámbito superior al municipio. Total provincial:
// distrito 9 y provincia ≠ 99. Columnas 126–133 blancos, 142–149 votos a candidaturas.
export function totalesProvinciales(files) {
  const f = Object.entries(files).find(([n]) => /^07\d+\.DAT$/i.test(n))[1];
  const out = {};
  for (const l of lines(f)) {
    const prov = l.slice(11, 13);
    if (prov === '99' || l[13] !== '9') continue;
    out[prov] = { nombre: l.slice(14, 64).trim(), blancos: +l.slice(125, 133), candidaturas: +l.slice(141, 149), nulos: +l.slice(133, 141) };
  }
  return out;
}

// 08xxaamm.DAT: votos por candidatura en ámbito superior al municipio (15–20 código,
// 21–28 votos). Total provincial: distrito 9 y provincia ≠ 99.
export function votosProvinciales(files) {
  const f = Object.entries(files).find(([n]) => /^08\d+\.DAT$/i.test(n))[1];
  const out = {};
  for (const l of lines(f)) {
    const prov = l.slice(11, 13);
    if (prov === '99' || l[13] !== '9') continue;
    const c = l.slice(14, 20);
    (out[prov] ||= {})[c] = (out[prov][c] || 0) + +l.slice(20, 28);
  }
  return out;
}
