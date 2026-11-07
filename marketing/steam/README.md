# Prism Duel: Steam store visuals

Everything here is the game's own pixel art: arena, monster sheets, logo tubes and UI. Each image is an integer
nearest-neighbour upscale of a 640×360 render, so 1 art pixel is always a k×k block. There are no smooth
gradients or blurred upscales. Capsule compositions come from the dev preview `src/dev/previews/steam.ts`
(`?dev=steam`), and the screenshots are real game frames from the frozen, stepped clock in `tools/shot.mjs`.

## Screenshots (1920×1080, 3× of 640×360, `?look=v3`)

| File | Shows | Query / time |
|---|---|---|
| `screenshot_01_title.png` | Title screen with the lit PRISM DUEL logo. The prism pass is crossing the M, and a hologram card is landing on the board | `?dev=title&at=attract`, freeze + 2500 ms, `logo.prismSweep()`, +420 ms |
| `screenshot_02_board.png` | Busy mid-duel 5+5 board: 8 monsters, set cards, a full 5-card hand, HUD, LP 2650 vs 3100 | `?dev=steam&s=stBoard --fresh --step 1500` |
| `screenshot_03_crystal_wyrm_summon.png` | Crystal Wyrm tribute summon: the summon circle and the gold "CRYSTAL WYRM!" cut-in | `?dev=duel&s=suWyrm --fresh --step 3080` |
| `screenshot_04_ashen_drake_attack.png` | Ashen Drake's attack lands. Stone Sentinel burns and −1900 pops | `?dev=duel&s=kaAdAtk --fresh --step 1590` |
| `screenshot_05_mirror_barrier.png` | Mirror Barrier trap: the magenta hex dome reflects Ember Wolf's attack | `?dev=duel&s=tbMirror --fresh --step 1660` |
| `screenshot_06_void_eye.png` | Void Eye spell: the giant eye opens over the arena and the world dims | `?dev=duel&s=b2WipeAuto --fresh --step 1800` |
| `screenshot_07_judgment_bolt.png` | Judgment Bolt: a storm cloud strikes the Crystal Wyrm and the spell card flies in | `?dev=duel&s=spBoltAce --fresh --step 780` |
| `screenshot_08_crystal_shatter.png` | Crystal Wyrm is destroyed and shatters into crystal shards (Polar Sovereign wins) | `?dev=duel&s=psTrade --fresh --step 2890` |
| `screenshot_09_deck_builder.png` | Deck builder: pool sorted by level, a 40-card legal deck, the curve chart and the Crystal Wyrm detail | `?dev=deck&fill=legal&sort=level&cursor=1` |
| `screenshot_10_card_gallery.png` | Card gallery: Polar Sovereign card, its text and its idle animation on the hologram pedestal | `?dev=title&at=gallery&card=polar_sovereign`, film frame t=2800 |
| `screenshot_11_ashen_drake_cutin.png` | Ashen Drake tribute summon: the violet "ASHEN DRAKE!" cut-in | `?dev=duel&s=kaAdSummon --fresh --step 3300` |

## Capsules

Key art: Crystal Wyrm (P1, cyan) and Ashen Drake (P2, crimson) are both in their roar pose with neon
back-light halos and floor light pools. Their breath beams meet in a prism crystal, and the light leaves it
as a hard-edged spectrum fan that rises into the logo. They stand on the real v3 arena, which is staged
empty, with HUD, duelist figurines and decks hidden and a stepped night vignette.

| File | Size | Built as |
|---|---|---|
| `header_capsule_920x430.png` | 920×430 | `cap=header`, 460×215 ×2 (art and logo on the same pixel grid) |
| `small_capsule_462x174.png` | 462×174 | `cap=small`, 462×174 ×1. The logo dominates (78 % of the width) on a dimmed arena, with the monsters at the edges |
| `main_capsule_1232x706.png` | 1232×706 | `cap=main`, 616×353 ×2. The arena and monsters are at 2× zoom (4 px per art pixel) and the logo at 1× (2 px) |
| `vertical_capsule_748x896.png` | 748×896 | `cap=vertical`, 187×224 art ×4, plus the stacked PRISM/DUEL logo ×2 |
| `library_capsule_600x900.png` | 600×900 | `cap=library`, 200×300 art ×3, plus the stacked logo ×2 |
| `library_hero_3840x1240.png` | 3840×1240 | `cap=hero`, 480×155 ×8. No logo or text; the clash sits centred |
| `library_logo_1280x720.png` | 1280×720 RGBA | Single-line logo ×3 (1152×234), centred on a transparent background |
| `community_icon_184x184.png` | 184×184 | `cap=icon`, 92×92 ×2: the logo's neon P with the prism pass crossing it, on a cut-corner badge trimmed cyan/crimson |

Notes:
- **Mixed pixel scales.** The stacked logo (186 px wide) does not fit a 187- or 200-px base, so the vertical
  and library capsules put a ×2 logo over ×4 / ×3 art. Both scales are integer and nearest-neighbour. The
  main capsule does the same in-engine: art camera at zoom 2, logo camera at 1.
- **Transparent logo.** The logo is rendered on black and on white, and the alpha is recovered exactly by
  difference matting (`build/compose.py`). The additive glow becomes straight alpha, and the edges stay
  stepped and crisp.
- **Halo.** The logo uses its own stepped halo (`logoAt` in `steam.ts`). The title screen's glow texture
  clips to a visible rectangle on flat backgrounds.

## Rebuild

```
bash marketing/steam/build/capture_layers.sh   # 1× layers → marketing/steam/build/layers/
python3 marketing/steam/build/compose.py        # → the capsule PNGs (integer upscales + logo matte)
bash marketing/steam/build/screenshots.sh       # → the 11 screenshots
```
