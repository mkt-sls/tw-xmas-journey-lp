import { esc, escNb } from './util.js';

export function renderIntro({ ui, over }) {
  return `
  <div class="intro">
    <p class="intro__eyebrow">${escNb(ui.campaign_dates)}</p>
    <h1 class="intro__title">${esc(ui.campaign_title)}</h1>
    <p class="intro__sub">${escNb(ui.subtitle)}</p>
    ${over ? `<p class="intro__ended" role="status">${esc(ui.campaign_ended)}</p>` : ''}
  </div>`;
}
