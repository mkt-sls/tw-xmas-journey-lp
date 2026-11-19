# Top Win Christmas Journey — handoff 2026-11-19

This page is for the next session or person picking up the Top Win Christmas Journey landing page. It says what is live, where the content comes from, what the owner decided, what is still broken, and which checks have not been run yet.

## Live and repo state

- Live URL: https://mkt-sls.github.io/tw-xmas-journey-lp/
- Live build = `main` commit `0fc7114` ("Step 8: card open/close no longer moves the page"). Steps 1 to 8 are done.
- Live was compared with the repo: 51 files identical.
- Repo: `main`, clean at handoff. Deploy: GitHub Pages runs on every push to `main`.
- Stack: Vite, vanilla JS, Vitest for `npm test`. Run `npm ci` once, then `npm run dev`, `npm test` or `npm run build`.

## Sources

- **Texts and place names.** Google Sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY`, title "Переводы EUTop-Win" (last modified 2026-11-19 10:39 UTC).
  - Tabs DE, NL, EN, RO hold the cards (A1:D27).
  - Tab UI ELEMENT (A1:F52) holds the UI strings (A1:D19) and the LOCATION table.
  - LOCATION table: title in A24, header in row 26 (`День | Русский (RU) | Română (RO) | English (EN) | Deutsch (DE) | Nederlands (NL)`), days 1 to 26 in rows 27 to 52. RU is not used.
  - Each day's `location` (cards JSON and `ui/*.json` `locations`) is the place name in that language.
  - Wagering and "valid until" are still missing from the sheet, so those rows stay hidden.
- **Numbers and links.** Links sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab **TW EUROPE only**. Tab **JP** belongs to Jackpot: never use it. Where texts and links disagree, the numbers follow TW EUROPE.
- **Importer overrides** (`scripts/import-sheet.mjs`, all listed in `data/ISSUES.md`):
  - Day 12 free spins 75 changed to 78 (from the links sheet). Client to confirm 75 or 78.
  - How-it-works step 1 "1–25 December" changed to "1–26" in all four languages.
  - Day 21 RO minimum deposit was missing; set to 300 MDL (links side table showed 22 changed to 300).
- **Figma.** File `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`.

## Owner decisions

From `docs/PLAN.md` and the owner's notes:

- 26 days, 1 to 26 December 2026.
- Markets: DE (EUR, de), NL (EUR, nl), EN_GBP (GBP, en), RO_MDL (MDL, ro). Fallback market: EN_GBP.
- One deposit link per day on `tw-de.icu`, with that day's promo code, for all markets.
- LOG IN, REGISTER and T&C all use that same day link.
- No mini-game on this page (it lives in a separate repo).
- Footer text: "18+ · Play responsibly", without BeGambleAware.
- Text rules: only Figma and sheet text is shown; no tracking strings; no "campaign ended" message.

## Open problems to fix

Each fix needs the owner's "start" before work begins. Numbers are from measurements in the checks named in the list.

1. **Santa (route and today pill).**
   - Dec 1, widths 808 to 1023: Santa covers the TODAY pill (8).
   - Nov 25 and Dec 1, widths 1024 to 1216: Santa is clipped (7 each).
   - Dec 2, widths 1632 to 3840: the board sits 4.01 to 4.74 px off the route. Limit is 4 px; 71 widths fail.
2. **320 px and small phones.**
   - RO how-it-works title "DEPUNE ȘI / REVENDICĂ": the two lines touch (-1.6 px).
   - DE terms link line gap is 2.6 px (limit 3 px), on 26 days.
   - Header to label gap is 7.7 px (limit 8 px).
   - Today button still wraps to 2 lines: DE days 16, 17, 22, 26; NL day 20; RO days 17, 20, 22. Seen at 320 and 360.
3. **Figma desktop differences.**
   - Golden ring around the today pedestal is missing.
   - Header buttons' margin is about 15 px narrower than Figma.
   - Footer is shorter than Figma (expected, because of the text rules).
   - A legend pill was added and is not in Figma.

## Passed so far

- Cards at 1440 px: all 4 markets, all 28 dates (checked on day 12: 78 free spins; day 21 RO: 300 MDL; no wagering or valid-until shown).
- Every link goes to `tw-de.icu` with the day code.
- Console clean on desktop.
- No jackpot content on the page.

## Checks not run yet

- Text fit, ink, header, pulse and jump checks at widths 375 to 1920.
- Cards at 390 px.
- Mobile console check.
- Figma review on mobile and in the sheet.

## How to re-import and run the checks

Run everything from the repo root. Never run python in this repo.

Re-import from the sheets (the texts sheet is downloaded as xlsx first, the links sheet is saved as text by hand; see `docs/PLAN.md` for the download steps):

```
node scripts/extract-sheet.mjs data/source/texts-sheet.xlsx   # -> data/source/sheet.json
node scripts/import-sheet.mjs                                 # -> data/cards/*.json, data/ui/*.json
node scripts/import-links.mjs                                 # -> data/links.json, data/source/links-diff.md, data/ISSUES.md
npm test
npm run build
```

After the import, read `data/source/links-diff.md` (target: only the known gaps) and `data/ISSUES.md`, then commit `data/`. `import-links.mjs` must run after `import-sheet.mjs`. `data/markets.json` and `data/browser-map.json` are edited by hand. UI wording that is not in the texts sheet lives in the `OWN` table at the top of `scripts/import-sheet.mjs`.

Numeric check scripts in `scripts/` (they start their own Vite server; Playwright is not a project dependency, so point `PLAYWRIGHT_MODULE` and `CHROME` at a local install as the script headers describe):

```
node scripts/check-santa.mjs                       # all dates x 390, 768, 1366, 1920
node scripts/check-santa.mjs --sweep --fails-only  # desktop and mobile width sweep
node scripts/check-header.mjs [--labels]           # mobile header (and today labels)
node scripts/check-headline.mjs [--shots]          # card headline gradient
node scripts/check-line-ink.mjs                    # line-to-line ink overlap
node scripts/check-modal-jump.mjs                  # card open/close must not move the page
node scripts/check-pulse.mjs                       # today pulse ring
node scripts/check-texts.mjs --widths=390          # every visible text, one width per run
node scripts/shots-step7.mjs <outDir>              # owner screenshots
```

`scripts/check-texts.mjs` takes about 6 minutes per width, so run one width per process.
