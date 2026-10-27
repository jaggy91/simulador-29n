// Entradas del modelo a partir de las tarjetas de fuentes (Node): catálogo de
// escenarios, noticias, encuestas y el conjunto de tarjetas activas por defecto.
import { readJSON } from './load-data.js';
import { defaultActive, modelInputs, hasEffect } from '../../src/engine/evidence.js';

export function loadInputs() {
  const catalog = readJSON('scenarios').scenarios;
  const news = readJSON('news').cards;
  const polls = readJSON('polls');
  const pollCards = [
    ...polls.sources.media.items.map((i) => ({ ...i, type: 'encuesta', source: 'media' })),
    ...polls.sources.cis.items.map((i) => ({ ...i, type: 'cis', source: 'cis' })),
  ];
  const active = new Set([...defaultActive(catalog, news), ...pollCards.map((c) => c.id)]);
  const toggleable = [...news.filter(hasEffect).map((c) => c.id), ...pollCards.map((c) => c.id)];
  return { catalog, news, polls, pollCards, active, toggleable, inputs: (set = active) => modelInputs(catalog, news, polls.sources, set) };
}
