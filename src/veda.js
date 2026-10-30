// Veda electoral (LOREG, art. 69.7): durante los cinco días anteriores al de la votación
// no se pueden publicar, difundir ni reproducir sondeos. Para el 29-N: del 24-nov a las
// 00:00 (hora peninsular) hasta el cierre de las últimas urnas el 29-N (Canarias, 20:00
// locales). Mientras dure, la web no muestra ni publica nada basado en encuestas: solo
// el simulador con los porcentajes que escribe el usuario, la metodología sin cifras de
// encuestas y los datos oficiales de base.
import { MODEL_FILES } from './app/data.js';

export const VEDA = { start: '2026-11-23T23:00:00Z', end: '2026-11-29T20:00:00Z' };

// El despliegue es horario y puede retrasarse: la versión sin encuestas se publica con
// este margen antes del inicio, para que a las 00:00 ya esté en línea.
export const DEPLOY_MARGIN_HOURS = 4;

export function inVeda(t = Date.now(), { marginHours = 0 } = {}) {
  const now = typeof t === 'number' ? t : new Date(t).getTime();
  return now >= Date.parse(VEDA.start) - marginHours * 3600e3 && now < Date.parse(VEDA.end);
}

// Únicos datos que se publican durante la veda (lista blanca): la base oficial, el
// catálogo de escenarios y veda.json (noticias sin sondeos y el resultado real de 2023).
export const VEDA_FILES = [...MODEL_FILES, 'scenarios', 'veda'];

// Bloques de METODOLOGIA.md con cifras de encuestas, marcados <!-- veda --> … <!-- /veda -->.
export const VEDA_NOTE = '> *Cifras basadas en encuestas: no se muestran durante la veda electoral (del 24 de noviembre al cierre de las urnas el 29-N).*';
export const stripVeda = (md) => md.replace(/<!-- veda -->[\s\S]*?<!-- \/veda -->/g, VEDA_NOTE);
