import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// Markets that are off ("enabled": false in data/markets.json) stay in the repo (import scripts and
// tests still cover their data) but leave no trace in the build (owner 2026-11-26: RO_MDL off, not in
// the final archive):
// - their entries are dropped from markets.json and their languages from browser-map.json;
// - their flags are deleted from dist (public/ is copied as a whole), unless a market that is on uses it;
// - their card and UI files are excluded by the glob list in src/i18n.js.
// Build only: dev and vitest see every market, and src/market.js filters at run time.
function dropDisabledMarkets() {
  const markets = JSON.parse(fs.readFileSync(new URL('./data/markets.json', import.meta.url), 'utf8'));
  const on = markets.filter((m) => m.enabled !== false);
  const onIds = new Set(on.map((m) => m.id));
  const keepIds = (obj) => Object.fromEntries(Object.entries(obj).filter(([, id]) => onIds.has(id)));
  let outDir;
  return {
    name: 'drop-disabled-markets',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/');
      if (file.endsWith('/data/markets.json')) return { code: JSON.stringify(on), map: null };
      if (file.endsWith('/data/browser-map.json')) {
        const map = JSON.parse(code);
        return { code: JSON.stringify({ ...map, exact: keepIds(map.exact), language: keepIds(map.language) }), map: null };
      }
      return null;
    },
    closeBundle() {
      const used = new Set(on.map((m) => m.flag));
      for (const m of markets) {
        if (m.enabled !== false || used.has(m.flag)) continue;
        fs.rmSync(path.join(outDir, 'assets', 'flags', `${m.flag}.svg`), { force: true });
      }
    },
  };
}

// base './' keeps asset URLs relative, so the page works on a GitHub Pages subpath.
export default defineConfig({
  base: './',
  plugins: [dropDisabledMarkets()],
});
