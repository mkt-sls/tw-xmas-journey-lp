# Top Win Christmas Journey — handoff 2026-11-24 (page code efd79be; later commits are docs only)

For the next session (possibly on another PC). What is live, what is half done, what the owner still has to decide.

## Read this first
- **TW is a redesign of the Jackpot page** `christmas_journey_lp` (on the old PC: `D:\.claude\JP\christmas_journey_lp`; GitHub repo of the same name under the same org — check with `gh repo list mkt-sls`). Same files, same logic; TW has its own Figma look, art and texts. TW was copied from JP commit `c77ebc4` (2026-11-18). **Before fixing anything, check whether JP already fixed it** (`git log` in JP) and port it, keeping TW's own art numbers. The owner's rule: check JP before asking the owner.
- Work rules of the owner: questions get answers; code changes only after the owner says "start"; pushes only after "push". Never run python in this repo.

## Live and repo state (2026-11-24)
- Live page code = `efd79be` (merge of `tw-logo`). Later commits on main are docs only. GitHub Actions run 45405161613 succeeded on 2026-11-24. GitHub Pages deploys on every push to `main`.
- Live URL: https://mkt-sls.github.io/tw-xmas-journey-lp/ .
- Recent deploys, newest first (all green, checked with `gh run list` on 2026-11-24):
  - `efd79be` / `665fdc3`, run 45405161613: header logo centred on every layout and linked to https://top-win.global in a new tab (details in the Header section).
  - `5b7aaac`, run 45394740693: favicon is now `favicon.ico` (16, 32, 48 px).
  - `b4c589c`, run 45394239178: locked day card button and Dec 1 mobile Santa (details below).
  - `a9350f5`: merge `tw-nl-santa`, commit subject "keep Santa clear of the TODAY pill on the NL route". Earlier this was listed as an open issue; the commit subject says it is fixed.
  - Earlier on 2026-11-24: `128cb09` / merge `1ba8b72` (card "Full terms & conditions" opens https://top-win-uk.top/en/bonus-policy on every market and every day, in a new tab; the owner chose the `/en/` URL for all markets; de/nl/ro paths answer 200, their translation was not checked); `f32576c` / merge `67d68c2` (header like Jackpot, logo + market selector only); `322dcc1` (comment fix in the docs, header desktop padding comment now matches the CSS, Actions run 45370386402).
- Earlier, live since 2026-11-23 (`9b43678`): layout width port (page width without the classic scrollbar), Santa shrinks further below f 0.738, route legend removed on desktop and mobile, "How it works" gap to the route, mobile route labels centred on their own gifts like JP, past labels (yesterday, campaign over) kept clear of Santa, new label check script.

### Dec 1 mobile Santa and locked card button (`b4c589c`, 2026-11-24)
- Dec 1 on mobile: Santa moved. `SANTA_SPOT.mobile.today[0]` changed `t` from 0.32 to 0.28 in `src/render/route.js`. Only Dec 1, all markets. The NL glove now clears the VANDAAG pill. The value 0.27 breaks the 4 px board-to-line limit, so 0.28 was chosen.
- Measured: `check-santa` 448/448 (4 markets x 4 widths x 28 dates). Before the change it was 446/448.
- Not established: the exact gap in px. Two measurements disagree, so no number is written here.
- Locked day card: the button shows only `ui.locked` (the word "Locked"). The date shows only in the title. Data and cards are untouched. An import would bring the date back into `lines[4]`, but the button no longer uses it. Test: `src/card.test.js`.

### Header logo link (`665fdc3` / `efd79be`, 2026-11-24)
- Logo centred on all layouts (desktop and mobile). `links.logo` in `src/config.js` = https://top-win.global, opens in a new tab (owner confirmed).
- https://top-win.global is the link the owner was given. Owner closed the question (2026-11-24): where it lands per country is not our task. (From this PC it redirected to https://top-win-uk.top/uk/casino.)
- Test: `src/render/header.test.js`.

### Favicon (`5b7aaac`, 2026-11-24)
- `favicon.ico`, multi-size 16, 32, 48 px. Taken unchanged from topwin-bet.icu, the same file as the main site.

### Check results on efd79be (2026-11-24)
- `npm test` 100/100.
- `check-texts` on b4c589c (header before the logo was centred): widths 360/390/430/768/1024/1366/1920 gave 16 failures, all overlap-text on `.intro__title-a` (4 per market). On the merged-earlier code 322dcc1 (page code, not efd79be) 320 and 1440 were also run.
- `check-texts` on the logo branch 665fdc3: only 390 `--mobile` (the 4 known title-a / title-b box overlaps; ink gap 4.3–6.7 px, 0 shared pixels) and 1366 (0 fails).
- `check-texts` on the centred-logo page code (`efd79be`, 2026-11-24): 320/360/375/430/768 with `--mobile`, and 768/1024/1440/1920 desktop, 4 markets, days 1-26: 0 new fails. 4 known `.intro__title-a` box overlaps (one per market, day 1) at each width of 768 or less; 0 at 1024 or more. Glyph gap not re-measured. Stop rule used: stop when under 3 GB free RAM.
- Figma mobile review of the parts not covered before, on live `efd79be` (2026-11-24): Figma has only EN Dec 7, so there is no frame for Dec 1, Dec 26, the ended state, DE/NL/RO or 320; no motion; JP at 320 not checked. Page scroll width equals the viewport in 15 of 15 runs; logo centred at 390 and 320. 4 differences: step 3 body absent and wagering / valid-until rows hidden (both decided before); short month on the cards vs long month in Figma; RO_MDL title on 3 lines (see open item B).
- `check-modal-jump`: 300/300 on `b4c589c` (EN_GBP and RO_MDL); 60/60 on the logo branch (4 markets x 5 widths).
- Check runs were done per market and width. On this low-memory machine the full matrix crashes.

### Earlier check results
- On `322dcc1`: `npm test` 95/95, build ok, check-pulse 30/30, check-header all pass.
- On `f32576c` (header change): check-santa 112/112, check-modal-jump 0 jumps, check-label-centre --mobile 0 fails, check-header 36 + 648 label + 416 resize all pass.

- The machine was low on memory (Figma desktop app ~10 GB): long checks were killed; run them one at a time, narrow with `--markets` / `--widths`.
- Deleted 2026-11-24: the untracked `texts-failures-w1366.json` and `texts-failures-w390.json` in the repo root. They were check outputs, not part of the project.

## Header (owner 2026-11-24, on main since `67d68c2`; logo link since `efd79be`)
- Header = logo + market selector only, like Jackpot (ported from JP `8811313`, `777a0e5`, `6fe54f0`). No LOG IN, no REGISTER, on desktop and mobile. Deposit links unchanged.
- Logo: centred on the full header width on every layout, and links to https://top-win.global (new tab). Selector on the right. Selector button at 80% size; its tap area stays 44 px.
- Styled scrollbars in TW colours: page scrollbar 8 px, was the classic 15 px. `layoutWidth()` reads the real page width, so layouts get 7 px more width on desktop with a mouse.
- Removed from the code: `fitHeader`, the `data-fit` levels, `.btn-outline`, `.btn-register`, the login and register links.
- The ui strings `login` / `register` stay in `data/ui` and in the importer (like Jackpot); the page no longer renders them.

## Figma review
- Desktop (Task D): closed, no change. The 15 px header gap was only the classic scrollbar. Today's golden ring exists at the Figma position but fades from 0.6 to 0 with the pulse, and is hidden under `prefers-reduced-motion`. Owner chose to keep it.
- Mobile: review done on `1ba8b72`, before the header change; owner then asked to follow Jackpot. Compared by reading the code (not by screenshot): card docked at the bottom, TODAY pill visible, footer colour lighter than Figma for contrast, 56 px header plus 1 px line, step line-height 1.4 — same as or the same idea as JP. Kept on purpose: Santa scale 0.8 in TW vs 0.62 in JP; footer gap 96 px vs 74 px in JP; button text from the TW data.
- Not reviewed on mobile: anything Figma has no frame for (Dec 1, Dec 26, the ended state, DE/NL/RO, 320 px), motion, and JP at 320. The part that could be compared was reviewed on `efd79be` (see Check results). Dec 1 mobile Santa changed in `b4c589c`; no Figma frame exists for it.

## Owner decisions still open
- None that block. Two items below (A, B) are open but NOT STARTED in code: each waits for the owner's "start", and publishing waits for "push".

## Open, not started
### A. Card texts (owner's words)
- Locked card title with the long month, not in caps ("Opens: 8 December"). Master's proposal: keep day and month together with a no-break space; NL/RO month in lowercase; DE/NL/RO titles on 2 lines is normal.
- Day pill shows only the day ("DAY 7"), no date. The master understood this for all card states and markets, caps kept; not confirmed by the owner.
- The short month is data: `data/cards/<market>.json` raw lines, imported by `scripts/import-sheet.mjs`, rendered in `src/render/card.js` lines 45, 47, 48, 79. The change must survive a re-import.
- Measured with caps and an unkept date: at 320 the NL locked title takes 3 lines (now 2, card +32 px); at 390 DE and RO take 2 lines (now 1), EN 1. The no-caps version, and whether the date still shows on available and missed cards, is being measured / not yet measured.

### B. RO_MDL title
- 3 lines at widths 320-366 ("CĂLĂTORIA DE" is 335 px in a 288 px box at 320, font 46 px).
- Proposal: smaller font only when the first part wraps, 39.5 px at 320 (margins 16.2 px), 2 lines, route 57 px higher. Other markets unchanged. JP has no fit (30 px font).
- After the change re-run check-santa, check-label-centre, check-header and check-texts for RO.
- The owner sent the proposal picture without words: probably likes it, not confirmed.

### Way of working
- Owner wants before/after pictures for every visual choice. Pictures are on one PC only: `/c/Users/grosu.b/.claude/projects/D---claude-TW-tw-xmas-journey-lp/memory/xmas-before-after` (A1-A5, B1-B2 and worker specs; not in the repo).

## Next tasks
1. A and B above, one at a time, each only after the owner says "start".

## Known non-issues (measured, do not re-chase)
- Two-part title boxes overlap at 375–768 px but glyphs never touch (gap 5–12 px). At 390 the ink gap is 4.3–6.7 px, 0 shared pixels.
- Desktop label tag "HEUTIGER HALT" overlaps only the transparent glow of the gift button.
- DE title "Weihnachts": known and left by owner choice. It is cut by 1 px only when the viewport is 315 px or narrower (content 307 px or less).
- Desktop header gap of 15 px was only the classic scrollbar (closed 2026-11-24).
- Today's golden ring fades with the pulse and is hidden under reduced motion — by owner choice.
- Pulse 1440 Dec 26 old fail was a threshold flake; fixed in check-pulse.
- Jackpot also has Santa on today's label for long names Dec 2–25 (62 of 360 market-days, e.g. BG Dec 4) — owner: leave JP alone.

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
node scripts/check-modal-jump.mjs                     # low memory: one market and width per process
node scripts/check-line-ink.mjs
node scripts/check-label-centre.mjs [--mobile] [--ended]
node scripts/check-texts.mjs --widths=390             # ~6 min per width, one width per process
```
Run ONE check at a time: several Vite servers together hit an EPERM on node_modules/.vite/deps, and parallel checks ran the PC out of memory (2026-11-20 and again 2026-11-23).

`check-texts --mobile` emulates a real phone (isMobile, hasTouch, overlay scrollbars) for widths up to 768. Without it headless Chrome keeps a 15 px classic scrollbar gutter, which shows up as a 1 px cut of the DE "Weihnachts" at 320 that a real phone does not have. Last run (2026-11-24, on `efd79be`) at 320 and 390: the only fails left are the line-box overlap of the title spans (day 1); the 320 ink gap was not re-measured on `efd79be` (the 3.67 px figure is from 2026-11-23, before the header change).
