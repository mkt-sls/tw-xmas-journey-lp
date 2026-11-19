import { esc } from './util.js';

// Footer: "18+ · Play responsibly" only (owner decision: no BeGambleAware, no campaign-terms link here)
export function renderLegal({ ui }) {
  return `
  <footer class="legal">
    <p>${esc(ui.responsible)}</p>
  </footer>`;
}
