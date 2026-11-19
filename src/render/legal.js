import { linkFor } from '../config.js';
import { esc } from './util.js';

export function renderLegal({ ui, market }) {
  return `
  <footer class="legal">
    <p>${esc(ui.responsible)} · <a href="${esc(linkFor('campaignTerms', market.id))}" data-track="campaign_terms">${esc(ui.campaign_terms)}</a></p>
  </footer>`;
}
