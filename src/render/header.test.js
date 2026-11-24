import { describe, expect, it } from 'vitest';
import markets from '../../data/markets.json';
import { links } from '../config.js';
import { renderHeader } from './header.js';

const logoAnchor = (html) => html.match(/<a class="header__logo"[^>]*>/)[0];

describe('header logo link', () => {
  it('points at the configured logo URL, in a new tab, on every market', () => {
    expect(links.logo).toBe('https://top-win.global');
    for (const market of markets) {
      const a = logoAnchor(renderHeader({ ui: { brand: 'TopWin' }, market }));
      expect(a, market.id).toContain(`href="${links.logo}"`);
      expect(a, market.id).toContain('target="_blank"');
      expect(a, market.id).toContain('rel="noopener"');
      expect(a, market.id).toContain('aria-label="TopWin"');
      expect(a, market.id).not.toContain('href="./"');
    }
  });
});
