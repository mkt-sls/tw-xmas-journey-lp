# Top Win Christmas Journey LP: plan

Skeleton copied from the Jackpot Christmas Journey LP and re-labelled for Top Win. Steps: 1 skeleton (this repo), 2 import Top Win texts and links, 3 Top Win design from Figma.

## Owner decisions
- 26 days, 1–26 December 2026.
- Markets: DE (EUR, de), NL (EUR, nl), EN_GBP (GBP, en), RO_MDL (MDL, ro). Fallback market: EN_GBP.
- One deposit link per day on `tw-de.icu`, with that day's promo code, for all markets.
- LOG IN, REGISTER and T&C use that same day link.
- No mini-game here (separate repo).
- Footer: "18+ · Play responsibly", without BeGambleAware.

## Sources
- Texts sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` (title "ПЕреводы Top-Win", tabs DE, NL, EN, RO, UI ELEMENT): not final, the client will send a corrected one (wagering, valid until).
- Links sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab "TW EUROPE". Tab "JP" is Jackpot: never use it.
- Figma file `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`.

## Current state
Step 2 done: `data/` holds the real Top Win texts (4 markets) and the 26 day links; open client questions are in `data/ISSUES.md`. No art in `public/assets` yet (only de/nl/gb/md flags): step 3.

## How to re-import
Run from the repo root. Never run python.

1. Texts sheet: download it as xlsx. With the Google Drive MCP: `download_file_content` with `fileId` `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` and `exportMimeType` `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; copy the saved file to `data/source/texts-sheet.xlsx`. (Browser: File > Download > Microsoft Excel works too.)
2. Links sheet: the Drive connector cannot see `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`. Open tab "TW EUROPE" in Chrome (never tab "JP"), read the table text and save it as `data/source/links-sheet.txt` in the same format as the current file (header lines, then one line per day: `<n> December <weekday> <bonus name> <CODE> <link> <EUR block> <GBP block> <MDL block>`).
3. Commands:
```
node scripts/extract-sheet.mjs data/source/texts-sheet.xlsx   # -> data/source/sheet.json
node scripts/import-sheet.mjs                                 # -> data/cards/*.json, data/ui/*.json
node scripts/import-links.mjs                                 # -> data/links.json, data/source/links-diff.md, data/ISSUES.md
npm test
npm run build
```
4. Read `data/source/links-diff.md` (target: only the known gaps) and `data/ISSUES.md`, then commit `data/`.

Notes: `import-links.mjs` must run after `import-sheet.mjs` (it reads the cards and `data/source/sheet-findings.json`). `data/markets.json` and `data/browser-map.json` are edited by hand. UI wording that is not in the texts sheet (how-it-works step 3, countdown, legend, campaign ended, ...) lives in the `OWN` table at the top of `scripts/import-sheet.mjs`.
