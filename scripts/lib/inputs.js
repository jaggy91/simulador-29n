// Entradas del modelo a partir de las tarjetas de fuentes (Node): catálogo de
// escenarios, noticias, encuestas y el conjunto de tarjetas activas por defecto.
import { readJSON } from './load-data.js';
import { defaultActive, modelInputs, hasEffect } from '../../src/engine/evidence.js';

export function loadInputs() {
  const catalog = readJSON('scenarios').scenarios;
  const news = readJSON('news').cards;
  const polls = readJSON('polls');
  // Tarjetas de encuesta de cada fuente (media, CIS oficial, reestimaciones del CIS).
  const TYPE = { media: 'encuesta', cisOficial: 'cis-oficial', cis: 'cis' };
  const pollCards = Object.entries(polls.sources).flatMap(([key, src]) => src.items.map((it) => ({ ...it, type: TYPE[key] || 'encuesta', source: key })));
  const active = new Set([...defaultActive(catalog, news), ...pollCards.map((c) => c.id)]);
  const toggleable = [...news.filter(hasEffect).map((c) => c.id), ...pollCards.map((c) => c.id)];
  return { catalog, news, polls, pollCards, active, toggleable, inputs: (set = active) => modelInputs(catalog, news, polls.sources, set) };
}
