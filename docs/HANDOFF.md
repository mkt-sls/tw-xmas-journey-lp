# Top Win Christmas Journey — handoff 2026-11-26 (page code ac94285)

For the next session. What is live, how the page behaves, what the owner decided.

## Read this first
- **TW is a redesign of the Jackpot page** `christmas_journey_lp` (GitHub repo of the same name under `mkt-sls`; local clone below). Same files, same logic; TW has its own Figma look, art and texts. TW was copied from JP commit `c77ebc4` (2026-11-18). **Before fixing anything, check whether JP already fixed it** (`git log` in JP) and port it, keeping TW's own art numbers. The owner's rule: check JP before asking the owner.
- Work rules of the owner: questions get answers; code changes only after the owner says "start"; pushes only after "push". Never run python in this repo.
- **Show before you ask** (owner 2026-11-26): every visual choice goes to the owner as before/after pictures FIRST, then the question. The owner cannot decide from text; a text-only question was rejected. Format: real-browser screenshots with phone emulation (390 and 320, every market), the option applied only in the browser DOM (repo untouched), options numbered side by side on one local HTML page, opened in the owner's browser; blur the focused element before the shot (the card close button keeps a focus ring after a click). After implementing: the same page again, with `main` vs the branch from the real code.

## Machine (Mac, since 2026-11-26)
- Repo: `~/Documents/GitHub/tw/tw-xmas-journey-lp`. Jackpot reference clone: `~/Documents/GitHub/tw/christmas_journey_lp`.
- Playwright for the check scripts lives outside the repo, in `~/Documents/GitHub/tw/.tools`. Before any check:
  `export PLAYWRIGHT_MODULE=$HOME/Documents/GitHub/tw/.tools/node_modules/playwright/index.mjs CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
- A baseline of `main` in a git worktree needs a real copy of `node_modules`, not a symlink: with a symlink Vite refuses the web fonts and every measurement runs on the fallback font.

## Live state
- Live URL: https://mkt-sls.github.io/tw-xmas-journey-lp/ . GitHub Pages deploys on every push to `main`.
- Live page code = `ac94285` (later commits on `main` are docs only).

## How the page behaves (owner decisions, with the code that does it)
- **Moldova (RO_MDL) is off** (owner 2026-11-26). `"enabled": false` in `data/markets.json`: not in the selector; `?market=RO_MDL`, a saved RO_MDL choice and a Romanian browser all get EN_GBP (`src/market.js`). Not in the build: the plugin in `vite.config.js` drops the market entry, its browser-map languages and its flag; the glob list in `src/i18n.js` excludes `data/cards/RO_MDL.json` and `data/ui/RO_MD.json`. Its data stays in the repo and the import scripts and tests still cover it. To turn it back on: remove `"enabled": false` and the two `!` patterns in `src/i18n.js`, update `src/market.test.js` and the `ro-MD` row in `src/date.test.js`. The locale tables in `src/i18n.js` / `src/market.js` still name `ro-MD` (generic language tables, like TR or IT).
- **Header**: logo + market selector only, like Jackpot. No LOG IN, no REGISTER. Logo centred on every layout, links to https://top-win.global in a new tab (`links.logo` in `src/config.js`; where it lands per country is not our task). Selector button at 80% size, tap area 44 px. Styled scrollbars, page scrollbar 8 px. The ui strings `login` / `register` stay in `data/ui` but are not rendered.
- **Favicon**: `favicon.ico` (16, 32, 48 px), the same file as topwin-bet.icu.
- **Card T&C link**: "Full terms & conditions" opens https://top-win-uk.top/en/bonus-policy on every market and day, new tab.
- **Card rows**: every row between the min deposit and the CTA comes from the sheet (`raw`), incl. "Wagering: x20" and "Valid until: 23:59, <day> Dec". At 320 x 568 the deposit button is cut at the bottom of the card (the card scrolls); owner chose to keep it over a shorter card art.
- **Card dates** (render-time only, `data/cards` stays as imported):
  - Pill shows only the day ("DAY 8", "TAG 8", "DAG 8", "ZIUA 8") on every state (`dayOnly()` in `src/render/card.js`).
  - Locked title with the long month: "Opens: 8 December" (`opensLong()` + `longDate()` from `src/i18n.js`, no-break space).
  - Locked button shows only `ui.locked`.
  - Locked "come back" line: tomorrow keeps the sheet line; 2+ days away says "Come back on 9 December to unlock this gift" (`ui.come_back_on`, `comeBack()`). On phones only on Dec 1; on desktop every day.
- **Route labels** keep the short month ("IERI · 6 DEC.", "TODAY’S STOP · DEC 8"). Long month overflowed NL labels. Do not re-ask.
- **RO_MDL title on mobile**: `fitTitle()` in `src/render/intro.js` shrinks the title 0.5 px at a time (min 30) until `.intro__title-a` is one line (320 = 39.5 px, 360 = 45 px). Accent margin is in em (`calc(-0.087em - 0.2em + 0.19em)`) so the Ă breve stays clear of line 1.
- **Dec 1 mobile Santa**: `SANTA_SPOT.mobile.today[0]` = `[0, 0.28]` in `src/render/route.js` (0.27 breaks the 4 px board-to-line limit). Keeps the NL glove clear of the VANDAAG pill.
- **Valid until 23:59** = local time of each geo. Gifts open and close by the visitor's local day; nothing to change.
- **Data overrides** (kept in the importer, listed in `data/ISSUES.md`): day 21 RO min deposit 300 MDL (owner confirmed); day 12 = 78 free spins and step 1 "1–26" (the sheet now says the same). "How it works" step 3 stays title-only.
- **Our DE/NL/RO/PL translations** (strings not in the sheet, incl. `come_back_on`): approved by the owner, not sent to the client. Table in `data/ISSUES.md`.
- **Poland (PL, PLN)**, added 2026-11-26 (owner): cards from tab PL of the texts sheet, numbers checked against the PLN column of TW EUROPE (0 differences). UI ELEMENT has no PL column, so the UI strings (`PL_UI`, `OWN`) and the 26 place names (`PL_LOCATIONS`) in `scripts/import-sheet.mjs` are ours (owner approved; days 8 and 17 shortened to "Zimowa Latarnia" and "Piekarnia Mikołaja"). `normalisePl()` fixes tab PL on import (owner: use the client's text with these fixes): the plural after 2-4 ("83 DARMOWE SPINY", not "DARMOWYCH SPINÓW", 6 cards), the missing game line ("na <game>", from tab EN), and the missing colon after "Min. depozyt", "Wymagany obrót", "Ważne do" (without it the card drops those rows). Locked title keeps the client's "Otwiera się 8 grudnia" (no colon; `opensLong()` handles it). Short date without a dot ("8 GRU"), like tab PL. Selector: "Polski", after English; browser language `pl` picks PL.
- Kept on purpose vs Jackpot / Figma: Santa scale 0.8 (JP 0.62); footer gap 96 px (JP 74); footer colour lighter than Figma for contrast; today's golden ring fades with the pulse and is hidden under reduced motion.

## Client
- Nothing open. The owner sent a thank-you in Russian (2026-11-26).
- Last sheet reads 2026-11-26: texts sheet edited by the client 12:50 UTC, imported in `7b1d944`; links sheet tab TW EUROPE re-read in Chrome (via `/gviz/tq?tqx=out:html&gid=524100056` + get_page_text), only change was the day 3 bonus name (not shown on the page). Tab PL and the PLN column are used since 2026-11-26 (Poland added).

## Next tasks
1. Nothing started and nothing waiting on the client. If either sheet changes again, re-import as in docs/PLAN.md and compare cell by cell first.
2. Optional, for completeness (cards are 72 px taller since `306eb7a`): check-texts and check-modal-jump on `ac94285`, all markets. Last full results: `npm test` 108/108; check-santa, check-label-centre --mobile, check-line-ink, check-header all pass on the card-dates branch.

## Known non-issues (measured, do not re-chase)
- PL title: check-line-ink reports "ŚWIĄTECZNA" / "PODRÓŻ" gap -7 px at every width (18 pairs at 320 + 390). It compares whole lines: the Ą tail (left) and the Ż dot (right) are in different columns. Measured on screenshots: about 6 px from the Ą tail to "D" at 320, the Ż dot clear of "N". Not a touch.
- PL card amounts with "SPINÓW" get `data-accent` (line-height 1.12, `src/styles/components.css`): at 1.05 the Ó accent came 1.4 px under line 1. Only PL has marks in amounts (RO_MDL too, but it is off).
- Two-part title boxes (`.intro__title-a` / `-b`) overlap at 375–768 px but glyphs never touch (gap 5–12 px; at 390: 4.3–6.7 px, 0 shared pixels). check-texts reports it as 1 overlap per market at widths 768 or less.
- Desktop label tag "HEUTIGER HALT" overlaps only the transparent glow of the gift button.
- DE title "Weihnachts" is cut by 1 px only at viewport 315 px or narrower. Owner choice.
- Without `--mobile`, check-texts keeps a 15 px scrollbar gutter and shows a 1 px DE cut at 320 that a real phone does not have.
- Jackpot also has Santa on today's label for long names Dec 2–25 — owner: leave JP alone.
- Figma has frames only for EN Dec 7 (desktop and mobile 390). No frame for Dec 1, Dec 26, the ended state, DE/NL/RO or 320.

## Sources
- Texts and place names: Google Sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` (tabs DE, NL, EN, RO, PL; UI ELEMENT with LOCATION table rows 27–52, no PL column).
- Numbers and links: sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab **TW EUROPE** only (tab JP = Jackpot, never).
- Figma: file `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`. Asset map: `public/assets/README.md`.
- Markets: DE (EUR), NL (EUR), EN_GBP (GBP), PL (PLN), RO_MDL (MDL, off). 26 days, 1–26 December 2026. One deposit link per day on `tw-de.icu` with the day code (card deposit button). Footer "18+ · Play responsibly".

## How to run
`npm ci`, then `npm run dev`, `npm test`, `npm run build`. Re-import steps: `docs/PLAN.md`.
Check scripts need the Playwright + Chrome exports from the Machine section.
```
node scripts/check-santa.mjs [--sweep --fails-only]
node scripts/check-header.mjs [--labels] [--resize]   # fresh load per width (~8 min with --labels)
node scripts/check-pulse.mjs
node scripts/check-modal-jump.mjs                     # one market and width per process if memory is low
node scripts/check-line-ink.mjs
node scripts/check-label-centre.mjs [--mobile] [--ended]
node scripts/check-texts.mjs --widths=390 --mobile    # ~6 min per width, one width per process
```
Run ONE check at a time: several Vite servers together hit an EPERM on node_modules/.vite/deps. Narrow long runs with `--markets` / `--widths`.
