# Top Win Christmas Journey — handoff 2026-11-24

For the next session (possibly on another PC). What is live, what is half done, what the owner still has to decide.

## Read this first
- **TW is a redesign of the Jackpot page** `christmas_journey_lp` (on the old PC: `D:\.claude\JP\christmas_journey_lp`; GitHub repo of the same name under the same org — check with `gh repo list mkt-sls`). Same files, same logic; TW has its own Figma look, art and texts. TW was copied from JP commit `c77ebc4` (2026-11-18). **Before fixing anything, check whether JP already fixed it** (`git log` in JP) and port it, keeping TW's own art numbers. The owner's rule: check JP before asking the owner.
- Work rules of the owner: questions get answers; code changes only after the owner says "start"; pushes only after "push". Never run python in this repo.

## Live and repo state (2026-11-24)
- Live = main `322dcc1` (Actions run 45370386402 ok, live assets `index-DKIRXiO-.js` / `index-BTB5yx5J.css`). The commit that adds this handoff comes after `322dcc1` and changes docs only; the page code stays at `322dcc1`. GitHub Pages deploys on every push to `main`.
- Live URL: https://mkt-sls.github.io/tw-xmas-journey-lp/ .
- Done and live 2026-11-24:
  - `128cb09` / merge `1ba8b72`: card "Full terms & conditions" opens https://top-win-uk.top/en/bonus-policy on every market and every day, in a new tab. The owner chose the `/en/` URL for all markets. The de/nl/ro paths answer 200; their translation was not checked.
  - `f32576c` / merge `67d68c2`: header like Jackpot, logo + market selector only (details in the Header section below).
  - `322dcc1`: comment fix in the docs (header desktop padding comment now matches the CSS).
- Earlier, live since 2026-11-23 (`9b43678`): layout width port (page width without the classic scrollbar), Santa shrinks further below f 0.738, route legend removed on desktop and mobile, "How it works" gap to the route, mobile route labels centred on their own gifts like JP, past labels (yesterday, campaign over) kept clear of Santa, new label check script.
- Check results on `322dcc1`: `npm test` 95/95, build ok, check-pulse 30/30, check-header all pass.
- Check results on `f32576c` (header change): check-santa 112/112, check-modal-jump 0 jumps, check-label-centre --mobile 0 fails, check-header 36 + 648 label + 416 resize all pass.
- **check-texts has NOT been run since the header change.** Last measured state (`9b43678`): known pre-existing text fails at 320/390 `--mobile` (4x intro title box overlap, letters at least 3.67 px apart, measured) and at 1366 (`.label__tag` over the active gift's transparent glow).
- Known, not fixed: NL Dec 1 Santa touches the TODAY pill "VANDAAG" at 320–414 px (pre-existing). Jackpot also has Santa on today's label for long names Dec 2–25 (62 of 360 market-days, e.g. BG Dec 4) — owner: leave JP alone.
- The machine was low on memory (Figma desktop app ~10 GB): long checks were killed; run them one at a time, narrow with `--markets` / `--widths`.
- Untracked files `texts-failures-w1366.json` and `texts-failures-w390.json` in the repo root are check outputs, not part of the project: do not add or commit them.

## Header (owner 2026-11-24, on main since `67d68c2`)
- Header = logo + market selector only, like Jackpot (ported from JP `8811313`, `777a0e5`, `6fe54f0`). No LOG IN, no REGISTER, on desktop and mobile. Deposit links unchanged.
- Mobile (below 1024 px): logo centred on the full header width, selector on the right. Selector button at 80% size; its tap area stays 44 px.
- Styled scrollbars in TW colours: page scrollbar 8 px, was the classic 15 px. `layoutWidth()` reads the real page width, so layouts get 7 px more width on desktop with a mouse.
- Removed from the code: `fitHeader`, the `data-fit` levels, `.btn-outline`, `.btn-register`, the login and register links.
- The ui strings `login` / `register` stay in `data/ui` and in the importer (like Jackpot); the page no longer renders them.

## Figma review
- Desktop (Task D): closed, no change. The 15 px header gap was only the classic scrollbar. Today's golden ring exists at the Figma position but fades from 0.6 to 0 with the pulse, and is hidden under `prefers-reduced-motion`. Owner chose to keep it.
- Mobile: review done on `1ba8b72`, before the header change; owner then asked to follow Jackpot. Compared by reading the code (not by screenshot): card docked at the bottom, TODAY pill visible, footer colour lighter than Figma for contrast, 56 px header plus 1 px line, step line-height 1.4 — same as or the same idea as JP. Kept on purpose: Santa scale 0.8 in TW vs 0.62 in JP; footer gap 96 px vs 74 px in JP; button text from the TW data.
- Not reviewed on mobile yet: Dec 1, Dec 26, the ended state, the DE/NL/RO cards, 320 px, animations.

## Owner decisions still open
- None. Nothing is decided that waits on the owner.

## Next tasks (none decided)
1. Run check-texts (`--mobile`) after the header change, one width per process.
2. Figma mobile review of the items listed above, if the owner asks for it.

## Known non-issues (measured, do not re-chase)
- Two-part title boxes overlap at 375–768 px but glyphs never touch (gap 5–12 px).
- Desktop label tag "HEUTIGER HALT" overlaps only the transparent glow of the gift button.
- DE title "Weihnachts" 1 px cut at 320 px appears only with a 15 px desktop scrollbar; same on the old live build.
- Desktop header gap of 15 px was only the classic scrollbar (closed 2026-11-24).
- Today's golden ring fades with the pulse and is hidden under reduced motion — by owner choice.
- Pulse 1440 Dec 26 old fail was a threshold flake; fixed in check-pulse.

## Sources (unchanged)
- Texts and place names: Google Sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` (tabs DE, NL, EN, RO; UI ELEMENT with LOCATION table rows 27–52).
- Numbers and links: sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab **TW EUROPE** only (tab JP = Jackpot, never).
- Figma: file `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`.
- Markets: DE (EUR), NL (EUR), EN_GBP (GBP), RO_MDL (MDL). 26 days, 1–26 December 2026. One deposit link per day on `tw-de.icu` with the day code (on the card deposit button). T&C on the card = https://top-win-uk.top/en/bonus-policy on every market and day, new tab (owner 2026-11-24). Footer "18+ · Play responsibly". Only Figma and sheet text is shown.

## How to run
`npm ci`, then `npm run dev`, `npm test`, `npm run build`. Re-import steps: `docs/PLAN.md`.
Check scripts need a local Playwright + Chrome: set `PLAYWRIGHT_MODULE` and `CHROME` as each script header says (Playwright is not a project dependency).
```
node scripts/check-santa.mjs [--sweep --fails-only]
node scripts/check-header.mjs [--labels] [--resize]   # fresh load per width (~8 min with --labels)
node scripts/check-pulse.mjs
node scripts/check-modal-jump.mjs
node scripts/check-line-ink.mjs
node scripts/check-label-centre.mjs [--mobile] [--ended]
node scripts/check-texts.mjs --widths=390             # ~6 min per width, one width per process
```
Run ONE check at a time: several Vite servers together hit an EPERM on node_modules/.vite/deps, and parallel checks ran the PC out of memory (2026-11-20 and again 2026-11-23).

`check-texts --mobile` emulates a real phone (isMobile, hasTouch, overlay scrollbars) for widths up to 768. Without it headless Chrome keeps a 15 px classic scrollbar gutter, which shows up as a 1 px cut of the DE "Weihnachts" at 320 that a real phone does not have. Last run (2026-11-23, before the header change) at 320: the only fails left are the line-box overlap of the title spans (day 1); ink measured by pixel diff (320/360/375, DE/EN_GBP/NL/RO_MDL) has a gap of at least 3.67 px and no shared pixels.
