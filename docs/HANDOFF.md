# Top Win Christmas Journey — handoff 2026-11-23

For the next session (possibly on another PC). What is live, what is half done, what the owner still has to decide.

## Read this first
- **TW is a redesign of the Jackpot page** `christmas_journey_lp` (on the old PC: `D:\.claude\JP\christmas_journey_lp`; GitHub repo of the same name under the same org — check with `gh repo list mkt-sls`). Same files, same logic; TW has its own Figma look, art and texts. TW was copied from JP commit `c77ebc4` (2026-11-18). **Before fixing anything, check whether JP already fixed it** (`git log` in JP) and port it, keeping TW's own art numbers.
- Work rules of the owner: questions get answers; code changes only after the owner says "start"; pushes only after "push". Never run python in this repo.

## Live and repo state (2026-11-23 evening)
- Live = main `9b43678` (Actions run 45225894937 ok, live assets index-DKeHWclv.js / index-DPQ0m5Gu.css match dist). GitHub Pages deploys on every push to `main`.
- Live URL: https://mkt-sls.github.io/tw-xmas-journey-lp/ .
- Done and live 2026-11-23:
  - `c1cfc71` merge of tw-layout-width: layoutWidth() port (page width without the classic scrollbar), Santa shrinks further below f 0.738, `check-texts --mobile`.
  - `6ea05f9` merge of tw-mobile-gap: route legend removed on desktop and mobile (owner); How it works 46 px under the route on desktop (Figma 58:511), on mobile ~5.5 px under the last route dots (Figma mobile frame 58:875). legend_* strings kept unused in data.
  - `9b43678` merge of tw-label-centre: mobile route labels centred on their own gifts like JP (38af0f5 / 5ec1c40), TW gift middles measured (today -13.69, past/future -10.44 stage px); JP past-label exceptions kept; today's label exactly centred and Santa unchanged — owner accepted that Santa's board touches today's label on Dec 1, Dec 26 DE and some long names (60 cases, reported as "accepted (owner 2026-11-23, like JP)" by check-santa / check-label-centre). Past labels (yesterday, campaign over) anchored by their bottom edge so 2-line names grow upwards: every past/future label >= 1.67 px from Santa in all markets. New `scripts/check-label-centre.mjs` (--mobile, --ended), `check-santa --markets` (all markets), check-texts ignores today's label over its own invisible gift hit-area (JP 1085537).
- Check results on 9b43678: npm test 95/95, check-santa 112/112, --markets 446/448, --sweep 3136/3136, check-label-centre --mobile 0 fails, check-header --labels 648 pass, --resize 0 differences, check-pulse 30/30, check-modal-jump 0 jumps. Known pre-existing text fails: 320/390 --mobile 4x intro title box overlap (letters >= 3.67 px apart, measured), 1366 .label__tag over the active gift's transparent glow.
- Known, not fixed: NL Dec 1 Santa touches the TODAY pill "VANDAAG" at 320-414 (pre-existing). Jackpot also has Santa on today's label for long names Dec 2-25 (62/360 market-days, e.g. BG Dec 4) — owner: leave JP alone.
- The machine was low on memory (Figma desktop app ~10 GB): long checks were killed; run them one at a time, narrow with `--markets` / `--widths`.
- Untracked files `texts-failures-w1366.json` and `texts-failures-w390.json` in the repo root are check outputs, not part of the project: do not add or commit them.

## Owner decisions still open
(none from the old list: labels = centred like JP, legend = removed, day 12 = 78 FS stays as decided)

## Next tasks
1. D: Figma desktop differences: golden ring around the today pedestal missing; header buttons' margin ~15 px narrower than Figma; footer shorter (expected).
2. Figma review on mobile (not done yet).

## Known non-issues (measured, do not re-chase)
- Two-part title boxes overlap at 375-768 but glyphs never touch (gap 5-12 px).
- Desktop label tag "HEUTIGER HALT" overlaps only the transparent glow of the gift button.
- DE title "Weihnachts" 1 px cut at 320 appears only with a 15 px desktop scrollbar; same on old live build.
- Pulse 1440 Dec 26 old fail was a threshold flake; fixed in check-pulse.

## Sources (unchanged)
- Texts and place names: Google Sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` (tabs DE, NL, EN, RO; UI ELEMENT with LOCATION table rows 27-52).
- Numbers and links: sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab **TW EUROPE** only (tab JP = Jackpot, never).
- Figma: file `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`.
- Markets: DE (EUR), NL (EUR), EN_GBP (GBP), RO_MDL (MDL). 26 days, 1-26 December 2026. One deposit link per day on `tw-de.icu` with the day code (LOG IN and REGISTER use it too; T&C on the card = https://top-win-uk.top/en/bonus-policy on every market and day, new tab, owner 2026-11-24). Footer "18+ · Play responsibly". Only Figma and sheet text is shown.

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

`check-texts --mobile` emulates a real phone (isMobile, hasTouch, overlay scrollbars) for widths up to 768. Without it headless Chrome keeps a 15 px classic scrollbar gutter, which shows up as a 1 px cut of the DE "Weihnachts" at 320 that a real phone does not have. Run on 2026-11-23 at 320: the only fails left are the line-box overlap of the title spans (day 1); ink measured by pixel diff (320/360/375, DE/EN_GBP/NL/RO_MDL) has a gap of at least 3.67 px and no shared pixels.
