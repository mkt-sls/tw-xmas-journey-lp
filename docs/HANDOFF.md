# Top Win Christmas Journey — handoff 2026-11-26 (page code ac94285)

For the next session (possibly on another PC). What is live, what is half done, what the owner still has to decide.

## Read this first
- **TW is a redesign of the Jackpot page** `christmas_journey_lp` (on the old PC: `D:\.claude\JP\christmas_journey_lp`; GitHub repo of the same name under the same org — check with `gh repo list mkt-sls`). Same files, same logic; TW has its own Figma look, art and texts. TW was copied from JP commit `c77ebc4` (2026-11-18). **Before fixing anything, check whether JP already fixed it** (`git log` in JP) and port it, keeping TW's own art numbers. The owner's rule: check JP before asking the owner.
- Work rules of the owner: questions get answers; code changes only after the owner says "start"; pushes only after "push". Never run python in this repo.
- **Show before you ask** (owner 2026-11-26): every visual choice goes to the owner as before/after pictures FIRST, then the question. The owner cannot decide from text; a text-only question was rejected. Format the owner asked to keep: real-browser screenshots with phone emulation (390 and 320, every market), the option applied only in the browser DOM (repo untouched), options numbered side by side on one local HTML page, opened in the owner's browser; blur the focused element before the shot (the card close button keeps a focus ring after a click). After implementing: the same page again, with `main` vs the branch from the real code.

## Machine (since 2026-11-26)
- Work moved to the owner's Mac. The old Windows PC is gone, and so are the A1-A5 / B1-B2 pictures named in earlier handoffs.
- Repo: `~/Documents/GitHub/tw/tw-xmas-journey-lp`. Jackpot reference clone: `~/Documents/GitHub/tw/christmas_journey_lp`.
- Playwright for the check scripts lives outside the repo, in `~/Documents/GitHub/tw/.tools`. Before any check:
  `export PLAYWRIGHT_MODULE=$HOME/Documents/GitHub/tw/.tools/node_modules/playwright/index.mjs CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
- A baseline of `main` in a git worktree needs a real copy of `node_modules`, not a symlink: with a symlink Vite refuses the web fonts and every measurement runs on the fallback font (happened 2026-11-26, the first baseline was wrong).

## Live and repo state (2026-11-26)
- Live page code = `ac94285` (merge of `tw-locked-text`). GitHub Pages deploys on every push to `main` (run 45830893254 for ac94285, success).
- Live URL: https://mkt-sls.github.io/tw-xmas-journey-lp/ .
- Recent deploys, newest first:
  - `7b79036` / merge `ac94285` (2026-11-26, run 45830893254): locked card names the day for gifts 2+ days away. Details in the next section.
  - `7b1d944` / merge `306eb7a` (2026-11-26, run 45829614578): cards show wagering and valid-until from the client's updated texts sheet. Details in the next section.
  - `86656b2` / merge `2d3c896` (2026-11-26): items A and B, details in the next section.
  - `efd79be` / `665fdc3`, run 45405161613: header logo centred on every layout and linked to https://top-win.global in a new tab (details in the Header section).
  - `5b7aaac`, run 45394740693: favicon is now `favicon.ico` (16, 32, 48 px).
  - `b4c589c`, run 45394239178: locked day card button and Dec 1 mobile Santa (details below).
  - `a9350f5`: merge `tw-nl-santa`, commit subject "keep Santa clear of the TODAY pill on the NL route". Earlier this was listed as an open issue; the commit subject says it is fixed.
  - Earlier on 2026-11-24: `128cb09` / merge `1ba8b72` (card "Full terms & conditions" opens https://top-win-uk.top/en/bonus-policy on every market and every day, in a new tab; the owner chose the `/en/` URL for all markets; de/nl/ro paths answer 200, their translation was not checked); `f32576c` / merge `67d68c2` (header like Jackpot, logo + market selector only); `322dcc1` (comment fix in the docs, header desktop padding comment now matches the CSS, Actions run 45370386402).
- Earlier, live since 2026-11-23 (`9b43678`): layout width port (page width without the classic scrollbar), Santa shrinks further below f 0.738, route legend removed on desktop and mobile, "How it works" gap to the route, mobile route labels centred on their own gifts like JP, past labels (yesterday, campaign over) kept clear of Santa, new label check script.

### Client texts sheet update: wagering and valid-until (`7b1d944` / `306eb7a`, 2026-11-26)
- The client (sheet owner) edited the texts sheet on 2026-11-26 12:50 UTC. Compared cell by cell with the previous import: every card cell (26 days x 3 states x 4 languages) got two rows after the min deposit, "Wagering: x20" and "Valid until: 23:59, <day> Dec" (DE "Umsatzanforderung" / "Gültig bis", NL "Inzetvereiste" / "Geldig tot", RO "Cerință de rulaj" / "Valabil până la"); day 12 is now 78 free spins (was 75); "How it works" step 1 says 1–26 (was 1–25). Locked cards, step 3 and everything else unchanged. New tab PL (Polish): not our market, ignored.
- Re-import: `texts-sheet.xlsx` -> `extract-sheet.mjs` -> `import-sheet.mjs` -> `import-links.mjs`. `import-sheet.mjs` now expects 9 / 8 active lines (free spins / bonus), checks the wagering row (ends in "x<n>") and that the valid-until row names the card's own day, and fills `wagering` / `validUntil`. The card already drew every row between the min deposit and the CTA from `raw`, so `card.js` did not change for this.
- Day 21 RO still has no min-deposit line in the texts sheet: the importer still inserts "Depunere minimă: 300 MDL" (owner confirmed 300 on 2026-11-26). 81 free spins for MDL is now in the texts sheet.
- Card height +72 px. At 390 x 844 and 1366 x 900 everything fits. At 320 x 568 the deposit button is cut in half at the bottom of the card (the card scrolls; before, only the T&C link was below the edge). Owner chose to keep it (option 2) over a shorter card art on short screens (option 3: art 190 -> 130 px below 700 px height, shown and rejected). Jackpot has the same 3 rows and the same card CSS.
- Tests changed: `cards.test.js` expects the two rows, `texts.test.js` allows "23:59" only in the valid-until row. 104/104 then.
- `data/ISSUES.md` now lists 2 items, both for the record: day 21 RO 300 MDL (owner confirmed) and our translations (owner approved). The day 3 name item went away after the client fixed the links sheet. Removed as closed: wagering, step 1, step 3 (owner: stays title-only, the client need not change the sheet), header / T&C link (owner decision), locked card text (we changed it). login / register / legend strings are no longer listed (the page does not show them).
- Not run on this change: check-texts, check-modal-jump.

### Locked card "come back" line (`7b79036` / `ac94285`, 2026-11-26)
- Tomorrow's locked card keeps the sheet line "Come back tomorrow to unlock this gift". A gift 2 or more days away says "Come back on 9 December to unlock this gift" / "Komm am 9. Dezember wieder und schalte dieses Geschenk frei" / "Kom op 9 december terug om dit cadeau te ontgrendelen" / "Revino pe 9 decembrie pentru a debloca acest cadou". Owner chose option 2 from pictures (option 3, drop the line, was recommended and not chosen).
- `ui.come_back_on` (our wording, in `OWN` of `import-sheet.mjs`, listed in ISSUES.md); `comeBack()` in `src/render/card.js`, long month with a no-break space. Test: `src/card.test.js` ("locked card come-back line"). 108/108.
- Where it shows: on phones only on Dec 1 (the Dec 3 gift; phones show 3 gifts); on desktop every day, on the gift 2 days away.

### Card dates and RO title (`86656b2` / `2d3c896`, 2026-11-26)
Owner chose each part from before/after pictures.
- A1, locked card title with the long month, not in caps: "Opens: 8 December", "Verfügbar ab: 8. Dezember", "Beschikbaar vanaf: 8 december", "Disponibil din: 8 decembrie". `opensLong()` in `src/render/card.js` keeps the sheet's prefix up to the colon and adds `longDate()` from `src/i18n.js`, with a no-break space so day and month never split. On phones the DE/NL/RO titles take 2 lines (NL at 320: 3). `renderCard` now takes `uiLang` (passed from `main.js`).
- A2, the card pill shows only the day ("DAY 8", "TAG 8", "DAG 8", "ZIUA 8") on every card state: active, missed and locked (`dayOnly()` in card.js).
- A1 and A2 are render-time only: `data/cards` stays as imported, so a re-import keeps them.
- B, RO_MDL title on mobile: `fitTitle()` in `src/render/intro.js`, called from `fitStage()` and after the fonts load. When `.intro__title-a` wraps, the title goes down 0.5 px at a time (min 30) until it is one line: 320 = 39.5 px (2 lines instead of 3, route about 57 px higher), 360 = 45 px. EN/DE/NL and RO at 375 or more keep 46 px. Desktop: no fit.
- B side fix: the mobile accent rule `.intro__title[data-accent] span + span` margin is now `calc(-0.087em - 0.2em + 0.19em)` (was `-4px` fixed; -0.087em = -4px at 46 px). With the fixed -4px the Ă breve was under 3 px from line 1 at 39.5 px (check-line-ink failed).
- Not changed: the route labels ("IERI · 6 DEC.") keep the short month. Owner decision 2026-11-26, see "Owner decisions closed".
- Checks on the branch (2026-11-26, Mac): `npm test` 104/104, build ok; check-santa 4 markets x 320/360/390/768/1366 560/560, the same 6 accepted rows as `main` (RO re-run after the em fix: 112/112); check-label-centre --mobile 0 fails, 90 accepted touches (same as `main`); check-line-ink 320/360/375/390 all markets 0 fails; check-texts --mobile RO 320/360/390: only the known `.intro__title-a` box overlap (1 per width), same as `main` at 320; check-modal-jump RO and DE at 320/390 0 jumps; check-header all pass.
- Not run after the em fix: check-header, check-modal-jump. Not run at all: check-modal-jump on EN and NL; check-texts on EN, DE and NL; a `main` baseline of check-texts RO at 360 and 390.

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
- Figma mobile review of the parts not covered before, on live `efd79be` (2026-11-24): Figma has only EN Dec 7, so there is no frame for Dec 1, Dec 26, the ended state, DE/NL/RO or 320; no motion; JP at 320 not checked. Page scroll width equals the viewport in 15 of 15 runs; logo centred at 390 and 320. 4 differences: step 3 body absent and wagering / valid-until rows hidden (both decided before; wagering and valid-until shown since `306eb7a`); short month on the cards vs long month in Figma; RO_MDL title on 3 lines (see open item B).
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
- None.

## Owner decisions closed
- Route labels keep the short month ("IERI · 6 DEC.", "TODAY’S STOP · DEC 8"). Owner chose option 1 on 2026-11-26 from before/after pictures (4 markets, Dec 8 and Dec 24, 390 / 320 / 1366). The options shown were: 1 short month (live); 2 long month on every label; 3 long month, with today's mobile tag on 2 lines. What the pictures measured, in case the question comes back: with option 2 the NL today tag "STOP VAN VANDAAG · 24 DECEMBER" overflows its label at 390 and 320. With options 2 and 3 the NL desktop far label "OVER 2 DAGEN · 26 DECEMBER" overflows its 190 px max width (the far label was checked only on NL). Jackpot also uses the short month. Do not re-ask.
- Day 21 RO min deposit 300 MDL: owner confirmed 2026-11-26.
- Day 12 = 78 free spins: owner confirmed again 2026-11-26 (the texts sheet now says 78 too).
- "How it works" step 3 stays title-only; the client need not change the sheet (owner 2026-11-26).
- Header and T&C link: owner decision, not a client question (2026-11-26).
- Our DE/NL/RO translations (incl. `come_back_on`): approved by the owner, not sent to the client (2026-11-26).
- "Valid until 23:59" = local time of each geo (owner 2026-11-26). The page already opens and closes gifts by the visitor's local day, so nothing changes in code. Only a visitor outside the market's country (travel, VPN) sees their own device day.
- Links sheet day 3 "Bonus Day 2 Dec": corrected by the client to "Bonus Day 3 Dec" (read in Chrome 2026-11-26; local copy updated in `data/source/links-sheet.txt`). The bonus name is not shown on the page.
- Cards: wagering and valid-until shown, no smaller card art on short phones (option 2). Locked card: "Come back on <date>" for gifts 2+ days away (option 2).

## Client message (2026-11-26)
No open question is left for the client. The owner may send a short thank-you in Russian (drafted in the session): wagering, valid-until, dates 1–26 and the day 3 fix are on the page.
- Links sheet re-read in Chrome on 2026-11-26 (account with access, tab TW EUROPE, via `/gviz/tq?tqx=out:html&gid=524100056` + get_page_text): compared row by row with `data/source/links-sheet.txt`. Only change: day 3 Bonus Name. Codes, links, EUR/GBP/MDL amounts and min deposits identical. Day 21 MDL still empty (page: 300 MDL, owner confirmed). New PLN column: not our market.

## Next tasks
1. Nothing started and nothing waiting on the client. If either sheet changes again, re-import as in docs/PLAN.md and compare cell by cell first.
2. Optional, for completeness: check-texts and check-modal-jump on `ac94285` (the cards are 72 px taller since `306eb7a`), and the checks listed as not run in the card-dates section.

## Known non-issues (measured, do not re-chase)
- Two-part title boxes overlap at 375–768 px but glyphs never touch (gap 5–12 px). At 390 the ink gap is 4.3–6.7 px, 0 shared pixels.
- Desktop label tag "HEUTIGER HALT" overlaps only the transparent glow of the gift button.
- DE title "Weihnachts": known and left by owner choice. It is cut by 1 px only when the viewport is 315 px or narrower (content 307 px or less).
- Desktop header gap of 15 px was only the classic scrollbar (closed 2026-11-24).
- Today's golden ring fades with the pulse and is hidden under reduced motion — by owner choice.
- Pulse 1440 Dec 26 old fail was a threshold flake; fixed in check-pulse.
- Jackpot also has Santa on today's label for long names Dec 2–25 (62 of 360 market-days, e.g. BG Dec 4) — owner: leave JP alone.

## Sources
- Texts and place names: Google Sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` (tabs DE, NL, EN, RO; UI ELEMENT with LOCATION table rows 27–52; tab PL not used). Last changed by the client 2026-11-26 12:50 UTC; imported in `7b1d944`.
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
