# LP assets (exported from Figma)

Source: Figma file `s2CqwGqe0O0FcALhBNlTRe` (canvas `58:332` "Xmas Journey": Desktop 1920 `58:511` / `58:672`, Mobile 390 `58:875` / `58:1004`, UI kit `58:1148`).
The owner confirmed the images (landscape, Santa, gifts, card art) are final: they are exported as they are.
Raster = WebP @2x. Vectors = SVG. Node id -> file:

| file | figma node id | size px | format | notes |
|---|---|---|---|---|
| landscape-desktop@2x.webp | 58:1617 (Placeholder · Landscape) | 3840x1080 (1920x540 @2x) | WebP q72, opaque | Village art, already darkened/blurred in Figma. The export carries 22/10 px of shadow bleed per side: it is cropped back to the 1920x540 symbol. The Main frame shows it at 1920x564 (58:533), so the page scales/covers it to 564 |
| landscape-mobile@2x.webp | 58:1675 (UK · image) | 780x1526 (390x763 @2x) | WebP q74, opaque | Mobile village background with the baked bottom fade |
| hero-santa-desktop@2x.webp | 58:1681 (Hero · Desk 220) | 440x327 | WebP q88, alpha | Santa cut-out = the node's source image (4096x3044 PNG with alpha), resized. In the 220x220 hero box the image sits at (-27, 17.5), 265 wide. Same art as the Jackpot page, so the board anchors in `route.js` carry over (re-measured with `scripts/check-santa.mjs`) |
| hero-santa-mobile@2x.webp | 58:1683 (Hero · Mob 163) | 326x242 | WebP q88, alpha | Same source image |
| hero-sparkles-desktop.svg / hero-sparkles-mobile.svg | 58:542 / 58:902 (Hero sparkles) | 221x220 / 120x116 | SVG | A few stars around Santa, drawn from the top-left of his box |
| gift-today@2x.webp | 58:1226 (Gift · Available) layers 58:1228 Podium + 58:1233 Beam + 58:1234 Gift icon | 629x659 (box 170x178) | WebP q90, alpha | Rebuilt from the per-layer Figma SVGs (+ the beam as a blurred CSS gradient), rasterised with Chromium at 3.7x on a transparent page. **Without** the TODAY tag (58:1251, drawn as HTML) and **without** the Pulse ring (58:1227, drawn as the animated CSS ring in `anim.css`). Box in the 120x126 gift node coordinates: left -25, top -40, 170x178 |
| gift-today-present@2x.webp | 58:1234 (Gift icon) | 629x659 (same box) | WebP lossless, alpha | The present alone in the same box, drawn above the art so the ring never crosses it (`.gift__front`) |
| gift-locked@2x.webp | 58:1199 (Gift · Locked) | 268x274 (box 134x137) | WebP q90, alpha | Podium 58:1200 + gift icon 58:1205 + badge 58:1222/58:1223, rasterised the same way at 2x |
| gift-expired@2x.webp | 58:1278 (Gift · Expired) | 268x274 | WebP q90, alpha | Podium 58:1279 + gift icon 58:1284 + badge 58:1301/58:1302 |
| card-illustration@2x.webp | 58:1374 (image in Bonus card · Available) | 840x624 (420x313 @2x) | WebP q88, opaque | The orbit art (gift, ring, crystal, ornament, chest, candy). Opaque on the plum plate `#1f1121`; the plate is the card art background |
| card-gift-locked.svg / card-gift-expired.svg | 58:1591 / 58:1527 (FX gift) | 118 wide | SVG | The grey gift on the locked / expired card art |
| logo-topwin.svg | 58:517 (Logo · TOP WIN) | 150.6x30 | SVG | Header logo (the mobile Figma logo 58:989 is the same artwork at 110x22) |
| favicon.svg | derived from 58:517 | 32x32 | SVG | The logo on a rounded `#0B1530` square |
| decor-desktop.svg | 58:512 (Brand slash decor) | 1920x1049 | SVG | Two diagonal bands + soft glow behind header and intro. Used as the page background on desktop. Mobile has the same node (58:876) but it sits under the opaque mobile image, so it is not used |
| route-desktop.svg | 58:538 (Route) | 2110x140 | SVG | Dotted route, 2080x110 + shadow bleed. Figma position x -80, y 190 in the route-map frame |
| route-mobile.svg | 58:882 (Route) | 181x630 | SVG | Figma position x 80, y -60 in the route-map frame (= stage x 80, y -31) |
| route-desktop-gold.svg / route-mobile-gold.svg | derived from route-desktop.svg / route-mobile.svg | same | SVG | The route with the travelled colour (`#FFD14D`, stroke 7 / 6, as in 58:539 / 58:883). The page clips it up to today's stop; the glow is added in CSS |
| snow-cap.svg | 58:618 (today label, 220x29) | 226x29 | SVG | Stretchable. Small variant for missed labels: snow-cap-sm.svg (58:551, 119x20) |
| holly.svg | 58:620 (today label, 52x39) | 52x39 | SVG | Scaled for the other sizes (58:553 is 32x24, 58:946 is 28x21) |
| card-snow-cap.svg / card-holly.svg | 58:1400 / 58:1401 | 420x~14 / 56x42 | SVG | Along the top edge of today's bonus card |
| flags/*.svg | not in Figma (the switcher shows a UK flag raster) | 4:3 | SVG | gb de nl md from flag-icons 7.6.0 (MIT, see `flags/LICENSE-flag-icons.txt`) |

## Garland (CSS, not exported)
Node 58:585 (desktop) / 58:920 (mobile). A rounded wire (stroke `#14301F`) with bulbs red, gold, green, blue in that order (`#FF4D5E`, `#FFD66B`, `#4ADE80`, `#5EC4FF`), drawn in `drawGarlands()` (`render/route.js`): a bulb about every 18px (desktop) / 12.5px (mobile).

## Figma states not exported
"Gift · Completed" (58:1253, green with a check) and "Bonus card · Completed" (58:1409) are not used: the page does not track whether a bonus was credited, so every day before today uses the Expired visuals.
