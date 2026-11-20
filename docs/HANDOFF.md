# Top Win Christmas Journey — handoff 2026-11-20

For the next session (possibly on another PC). What is live, what is half done, what the owner still has to decide.

## Read this first
- **TW is a redesign of the Jackpot page** `christmas_journey_lp` (on the old PC: `D:\.claude\JP\christmas_journey_lp`; GitHub repo of the same name under the same org — check with `gh repo list mkt-sls`). Same files, same logic; TW has its own Figma look, art and texts. TW was copied from JP commit `c77ebc4` (2026-11-18). **Before fixing anything, check whether JP already fixed it** (`git log` in JP) and port it, keeping TW's own art numbers.
- Work rules of the owner: questions get answers; code changes only after the owner says "start"; pushes only after "push". Never run python in this repo.

## Live and repo state (2026-11-20 ~18:00)
- Live URL: https://mkt-sls.github.io/tw-xmas-journey-lp/ . GitHub Pages deploys on every push to `main`.
- Live code = `a31f6d5` (page code). This handoff is a docs-only commit on top.
- Done and live today:
  - `1dee17d` check scripts: `check-header` loads the page fresh per width (old version gave false alarms), new `check-header --resize`, `check-pulse` counts the whole ring.
  - `c21419b` + `254d680` small phones: today button on one line on every market/day/width, also after resize/rotation (fit was measured mid "breathing" animation); RO card button "DEPUNE ȘI / REVENDICĂ" and DE terms link no longer touch; today label keeps >= 8 px from the screen edge.
  - `c31fac8`, `1322328`, `a31f6d5` Santa: not clipped at 1024-1216 (before campaign, Dec 1); off the TODAY pill on Dec 1 at 808-1023; board on the route on wide screens. check-santa 112/112, sweep 0 fails.
- **Half done, NOT on main:** branch `design-mkt-1/tw-layout-width` (pushed to origin if the worker made it in time; it may be a "WIP:" commit — read its commit message for which checks passed / failed / did not run):
  - Item 2: port of JP's `layoutWidth()` (page width without the classic 15 px scrollbar). Measured before: on desktops with a classic scrollbar the stage was fitted 15 px too wide at every width 1024-1920; on Dec 26 at 1024/1100 a label stuck out ~2 px. Port fixes that, but made Santa sit over a gift on Dec 26 at 1024 (route squeezed more than ever tested). Owner decision (a): keep the port and let Santa shrink a bit more only for that extra squeeze (f < ~0.738), every other case unchanged. Then run the remaining checks one at a time and push only when all pass.
  - Item 4: `check-texts --mobile` flag ported from JP (phone emulation, avoids false "Weihnachts clipped 1 px at 320" that only happens with a 15 px desktop scrollbar). May not be done yet.
  - That branch also edits this HANDOFF.md (a note about `--mobile`): expect a small merge conflict here; keep both.

## Owner decisions still open
1. Mobile route labels: keep the TW Figma positions (master's recommendation) or centre them on their gifts like JP (`38af0f5`, `5ec1c40`; JP's gift-art numbers would need re-measuring on TW art)?
2. Legend pill (not in Figma, added by us): keep or remove? Blocks task D.
3. Day 12 free spins = 78 (confirmed by owner 2026-11-19; texts sheet says 75).

## Next tasks
1. Finish branch `design-mkt-1/tw-layout-width` (above), then push to main after owner says "push".
2. D: Figma desktop differences: golden ring around the today pedestal missing; header buttons' margin ~15 px narrower than Figma; footer shorter (expected); legend pill (decision 2).
3. Not done yet: Figma review on mobile.

## Known non-issues (measured, do not re-chase)
- Two-part title boxes overlap at 375-768 but glyphs never touch (gap 5-12 px).
- Desktop label tag "HEUTIGER HALT" overlaps only the transparent glow of the gift button.
- DE title "Weihnachts" 1 px cut at 320 appears only with a 15 px desktop scrollbar; same on old live build.
- Pulse 1440 Dec 26 old fail was a threshold flake; fixed in check-pulse.

## Sources (unchanged)
- Texts and place names: Google Sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` (tabs DE, NL, EN, RO; UI ELEMENT with LOCATION table rows 27-52).
- Numbers and links: sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab **TW EUROPE** only (tab JP = Jackpot, never).
- Figma: file `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`.
- Markets: DE (EUR), NL (EUR), EN_GBP (GBP), RO_MDL (MDL). 26 days, 1-26 December 2026. One deposit link per day on `tw-de.icu` with the day code (LOG IN, REGISTER, T&C use it too). Footer "18+ · Play responsibly". Only Figma and sheet text is shown.

## How to run
`npm ci`, then `npm run dev`, `npm test`, `npm run build`. Re-import steps: `docs/PLAN.md`.
Check scripts need a local Playwright + Chrome: set `PLAYWRIGHT_MODULE` and `CHROME` as each script header says (Playwright is not a project dependency).
```
node scripts/check-santa.mjs [--sweep --fails-only]
node scripts/check-header.mjs [--labels] [--resize]   # fresh load per width (~8 min with --labels)
node scripts/check-pulse.mjs
node scripts/check-modal-jump.mjs
node scripts/check-line-ink.mjs
node scripts/check-texts.mjs --widths=390             # ~6 min per width, one width per process
```
Run ONE check at a time: several Vite servers together hit an EPERM on node_modules/.vite/deps, and on 2026-11-20 parallel checks ran the PC out of memory.
