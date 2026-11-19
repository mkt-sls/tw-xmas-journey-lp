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
- Texts sheet `1OfbBN6dQ...`: not final, the client will send the correct one.
- Links sheet `1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo`, tab "TW EUROPE". Tab "JP" is Jackpot: never use it.
- Figma file `s2CqwGqe0O0FcALhBNlTRe`, canvas `58:332`.

## Current state
Placeholder data ("TBD") in `data/`, no art in `public/assets` (only de/nl/gb/md flags). `scripts/import-*.mjs` are still the Jackpot importers; step 2 rewrites them.
