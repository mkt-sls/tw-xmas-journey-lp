import { esc } from './util.js';

// Route legend (Figma "Legend" 58:808): only the day states this page has (no credit tracking, so no "Collected").
// Texts come from the UI strings; an item without a text is left out.
export function renderLegend({ ui }) {
  const items = [
    ['active', ui.legend_available],
    ['missed', ui.legend_missed],
    ['locked', ui.legend_locked ?? ui.locked],
  ].filter(([, text]) => text);
  if (items.length < 2) return ''; // a lone item is not a legend
  return `
  <ul class="legend" aria-label="${esc(ui.campaign_title)}">
    ${items.map(([kind, text]) => `<li class="legend__item"><span class="legend__dot legend__dot--${kind}" aria-hidden="true"></span>${esc(text)}</li>`).join('')}
  </ul>`;
}
