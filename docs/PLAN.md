# Top Win Christmas Journey LP: plan

Skeleton copied from the Jackpot Christmas Journey LP and re-labelled for Top Win. Steps: 1 skeleton (this repo), 2 import Top Win texts and links, 3 Top Win design from Figma.

## Owner decisions
- 26 days, 1–26 December 2026.
- Markets: DE (EUR, de), NL (EUR, nl), EN_GBP (GBP, en), PL (PLN, pl; added 2026-11-26), RO_MDL (MDL, ro; off since 2026-11-26). Fallback market: EN_GBP.
- One deposit link per day on `tw-de.icu`, with that day's promo code, for all markets.
- Header: only the logo and the market selector, no LOG IN and no REGISTER, desktop and mobile (owner 2026-11-24). The day link stays on the card deposit button. T&C ("Full terms & conditions" on the card) opens https://top-win-uk.top/en/bonus-policy on every market and day, in a new tab (owner 2026-11-24). No T&C link in the footer.
- No mini-game here (separate repo).
- Footer: "18+ · Play responsibly", without BeGambleAware.

## Sources
- Texts and place names: Google Sheet `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY`, title "Переводы EUTop-Win" (modified 2026-11-26 12:50 UTC, imported in `7b1d944`). Tabs DE, NL, EN, RO, PL (cards, A1:D27) and UI ELEMENT (A1:F52). UI ELEMENT holds the UI strings (A1:D19) and, new, the LOCATION table: title in A24, header in row 26 (`День | Русский (RU) | Română (RO) | English (EN) | Deutsch (DE) | Nederlands (NL)`), days 1–26 in rows 27–52; RU is not used. Each day's `location` (cards JSON, `ui/*.json` `locations`) is the place name of that language. Since 2026-11-26 every card has "Wagering: x20" and "Valid until: 23:59, <day>"; the cards show them. Tab PL (since 2026-11-26) is written differently: `normalisePl()` in the importer adds the colons and the game lines and fixes the plural; UI ELEMENT has no PL column, so Polish UI strings and place names are ours (`PL_UI`, `PL_LOCATIONS`, `OWN`).
- Numbers and links: links sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab "TW EUROPE" only. Tab "JP" is Jackpot: never use it. Where texts and links disagree the numbers follow TW EUROPE.
- Overrides in the importer (`scripts/import-sheet.mjs`, all listed in `data/ISSUES.md`): day 12 free spins 75 -> 78 and "How it works" step 1 "1–25" -> "1–26" (both kept in the importer, no longer needed: the sheet was corrected on 2026-11-26); day 21 RO minimum deposit missing -> 300 MDL (links side table 22 -> 300).
- Figma file `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`.

## Zip for IT
`node scripts/package.mjs` -> `TopWin-ChristmasJourney.zip` (client build without `?date=`, `status.json`, `image.jpg`). Details in docs/HANDOFF.md.

## How to re-import
Run from the repo root. Never run python.

1. Texts sheet: download it as xlsx. With the Google Drive MCP: `download_file_content` with `fileId` `1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY` and `exportMimeType` `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; copy the saved file to `data/source/texts-sheet.xlsx`. (Browser: File > Download > Microsoft Excel works too.)
2. Links sheet: the Drive connector cannot see `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`. Open tab "TW EUROPE" in Chrome (never tab "JP"), read the table text and save it as `data/source/links-sheet.txt` in the same format as the current file (header lines, then one line per day: `<n> December <weekday> <bonus name> <CODE> <link> <EUR block> <GBP block> <MDL block> <PLN block>`).
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
