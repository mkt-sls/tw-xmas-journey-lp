import { esc, escNb } from './util.js';

export function renderHowItWorks({ ui }) {
  const steps = [1, 2, 3]
    .map(
      (n) => `
      <li class="step">
        <span class="step__num" aria-hidden="true">${n}</span>
        <div class="step__text"><h3>${esc(ui[`step${n}_title`])}</h3><p>${escNb(ui[`step${n}_body`])}</p></div>
      </li>`,
    )
    .join('');
  return `
  <section class="how" aria-labelledby="how-title">
    <h2 class="how__title" id="how-title">${esc(ui.how_it_works)}</h2>
    <ol class="how__steps">${steps}</ol>
  </section>`;
}
