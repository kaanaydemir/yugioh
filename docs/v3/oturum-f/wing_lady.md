# wing_lady — Kanat Hanımı (lane F design)

RÜZGAR / Kanatlı · Sv4 · 1300/1400 · normal (no cut-in) · effect `windAura300`
Card text: "Sahandaki diğer RÜZGAR canavarlarının ATK'si +300." Draft: 2026-10-31. Status: **art built** (§12) and **cinematics + SFX + scenarios built** (§13; critique rounds pending).

> **Read §11 first.** The design critique (round D1, verdict needs-work) was folded in on 2026-10-31; §11 supersedes the sections it names (the persistent marker is now a wing-shaped floor LIGHT, not a shadow; the death is "the falling cape"; the guard is asymmetric; the summon opener, the revive and several sounds changed).

One line: **a falcon-winged swordswoman who sings, and whose wings cast a shadow over her allies.**
The effect gets one visual word and one sound word, and both are hers alone:

- **Visual: the wing shadow.** Every WIND ally she lifts carries a wing-shaped shadow on its tile
  that beats in time with her wings, plus a small wing crest on its ATK badge.
- **Sound: the chord.** She sings a root note, and every buffed ally adds one harmony voice. One ally
  makes a dyad, two make a triad. You can **hear how many allies are buffed**.

When she leaves, the shadows peel off the allies' tiles and fly back to her. The card's death is the
same idea at full scale: she folds into her own shadow, and the shadow flies away as a bird.

Evidence for this design (looked at): `shots/v3/kart-f/wing_lady/design/roster.png` (the v3 roster at 1×)
and `shots/v3/kart-f/wing_lady/design/m1Aura-placeholder.png` (today's placeholder: a generic green
summon column, then generic green chevrons and a "+300" over the hawk; after the beat, nothing marks the hawk as buffed).

---

## 0. What the engine gives us (exact event flow)

Verified in `src/engine/query.ts:218-226` (`auraBonus`) and `rules.ts:518-545` (`withStats` diff), and
with a throw-away probe run through `tests/engine/helpers` (deleted afterwards):

- **Rule as coded.** `auraBonus(s, uid, def, controller)` adds +300 for each **other** face-up monster
  with effect `windAura300` on the same controller's field, provided `def.attribute === 'WIND'`.
  - A face-down lady gives nothing.
  - A lady in defense still gives the bonus.
  - Two ladies buff each other, +300 each.
  - WIND monsters in the roster: `storm_hawk`, `cloud_hatchling`, `kite_fencer`, `steppe_spiralhorn`
    and `wing_lady`. windmane_knight is EARTH.
- **There is no `activate` event.** The aura appears only as `statChange` events, from the `withStats` diff.
  `withStats` emits a change only for monsters that were face-up **both before and after**.

```
summon lady (hand)          summon{wing_lady, from:'hand'} → statChange{hawk 1000>1300} (one per face-up WIND ally)
flip lady                   flip → summon{from:'field', method:'flip'} → statChange{hawk 1000>1300}
set lady                    setMonster                                  (nothing)
2nd lady summoned           summon{wing_lady} → statChange{OLD lady 1300>1600}   (the new one arrives at 1600: no event)
ally summoned next to her   summon{storm_hawk}                          (NO statChange: it arrives already at 1300)
ally flipped next to her    flip → summon{from:'field'}                 (NO statChange)
lady destroyed (spell)      activate(bolt) → target → destroy{lady} → toGraveyard{lady} → statChange{hawk 1300>1000} → toGraveyard{bolt}
lady destroyed (battle)     attackDeclare → battle → damage → destroy{lady} → toGraveyard{lady} → statChange{hawk 1300>1000} → …
buffed ally attacks         attackDeclare → battle{attackerAtk:1300} → …   (no aura event at all)
lady tributed / stolen / revived   tribute… → statChange(−300) / controlChange → statChange(−300 old side, +300 new side) /
                            soul_recall run: summon{from:'graveyard'} → statChange(+300) (played by soul_recall's playRun)
```

- **Hook kinds.**
  - A `statChange` card hook is keyed on the card **whose stat changes** (the hawk), not on wing_lady
    (`Director.ts:439`). So the aura beats are an event-level handler,
    `registerEvent('statChange', …, {priority: 25})`. It claims only the events where the aura caused the change:

    ```ts
    const def = CARDS[ctx.cardId(e.uid)];
    const ctl = (s) => locate(s, e.uid).player;
    const caused = auraBonus(ctx.stateAt(i), e.uid, def, ctl(ctx.stateAt(i)))
                 !== auraBonus(ctx.stateAt(i + 1), e.uid, def, ctl(ctx.stateAt(i + 1)));
    // also require atk − prevAtk === ±300·k and def === prevDef
    ```

    Any other event goes to `ctx.base()`: windmane's +500 storm, equips and the volcano all stay with
    their owners. The handler consumes the following consecutive aura-caused events itself, so
    `flow:statChange` never groups them away.
  - **Ally arrivals produce no event**, so a second handler wraps the summon:
    `registerEvent('summon', …, {priority: 30})`. It runs `await ctx.base()` (the arriving card's own
    entrance, whatever it is) and then plays the **arrival bless** (§4.4), but only if, in `ctx.stateNext`,
    the summoned unit is face-up WIND with `auraBonus > 0`. This also covers a second lady.
    The tribute flow's `ctx.play(summonIdx, {tribute, noCard})` goes through the same chain, so the wrapper still runs.
  - **The persistent aura** (`setAura('khWing', …)`) is reconciled by a `registerObserver`:
    - It **removes** the aura from any unit whose `auraBonus` in `ctx.stateNext` is 0.
    - It **re-adds** the aura only where the bonus was already > 0 **before** the event (steady state,
      for example after a `FieldView.sync` rebuild, which drops custom aura keys; HANDBOOK §6.5).
    - The aura is never *born* by the observer. It is born only by a bless beat, so it never appears
      before the moment that explains it.
    - A module set `khBusy` (uids an animation currently owns) makes the observer keep its hands off
      during a beat. The set is cleared in `src/duel/seeds.ts`-style `onDuelStart` from our own file.
      If the `onDuelStart` registry is not exported, clear the set on the `newGame` batch instead.
- **Deciding "buffed" anywhere** uses `auraBonus(...)` imported from `engine/query`. It is never derived
  from `atk − baseAtk`, because equips, the field spell and the knight's +500 also change that number.
- **Today's placeholder.**
  - Art: `_placeholder-new.ts` 'wings' totem, 48 class.
  - Summon: the default (green hologram column).
  - Effect: the generic `statChangeV3` (green ▲ chevrons and a badge roll on the hawk). After that beat,
    **nothing persistent** shows that the hawk is buffed, or by whom.
  - Death: `DEATH_PRESETS` `{material:'light', accent:'plant'}` (leaf accent = storm_hawk's feather/leaf
    flavour; must change).
  - `MONSTER_GLOW` lists `teal4`, `white` and `teal3`. teal is a forbidden body colour and white would be a body tone.

## 1. Concept and silhouette

- **Concept.** A lean young warrior woman, standing (a walker, `hover: 0`), with **large falcon wings**
  growing from her shoulder blades.
  - The wings are rufous-cream with dark barring and slate primary tips, like a kestrel. At rest they
    are half-raised in a "V" above her shoulders.
  - A **short sword** (a leaf-shaped blade about 12 px long, gold-wire guard) hangs low in her front
    hand, tip down.
  - She wears a green, close-fitting flight bodice and leggings with gold trim.
  - A **short white sash** at her waist streams back (her windsock: it shows the air around her).
  - A long blue-black braid also streams back.
  - On her brow is a thin gold circlet with one **green jewel**, the brightest point and the
    "voice" light that flares when she sings.
- **Behaviour signature (kestrel).** When she hovers, her **head stays perfectly still** while the
  wings beat around it. Every hover in every anim keeps the head pixels identical. It is a real
  falcon detail, it is readable, and no other card has it.
- **Box.** Frame **84×72**, anchor **AX 36, GY 68**, hover 0, `weight: 'mediumLight'` (40–60 ms
  contact stop; REHBER §4.4), `p2: 'relight'`.
- **Idle f0 bbox ≈ 44×52.**
  - The body is ≈ 20×44, from heels to circlet.
  - The wing V rises ≈ 8 px above the head and spreads ≈ 12 px behind and 8 px in front.
  - Opaque area ≈ 1050 px, which sits between the 48 and 64 classes. That matches a Lv4 humanoid
    next to shade_assassin (953) and stone_sentinel (1806).
  - The largest pose is the summon brake-flare, wings fully up: span ≈ 72 px. It stays ≥ 3 px from
    both edges (x 4..77).
- **Why she reads at 1×.**
  1. **The V of raised wings over a human figure.** No roster biped has wings. crystal_wyrm is a dragon,
     storm_hawk is a whole bird, and lumen_sprite is a tiny floating fairy with insect wings.
  2. **Value split.** Warm, light wings (earth4/earth3) behind a dark green body and a dark head, with a
     white sash flick at waist height as the one cool accent.
  3. **One green jewel** is the brightest pixel, on the head.
  4. **A vertical blade at her side, tip down**, so she never reads as kite_fencer's forward rapier.
- **Avoid on purpose.**
  - Gold wings (lumen_sprite).
  - Mist/white wing bodies (reed_heron's feathers; crystal_wyrm).
  - A green overall body tone (storm_hawk is green: her green is the bodice only, framed by warm wings).
  - Loose-feather FX anywhere (storm_hawk's death is a feather storm, wisp_imp owns feathers and the pillow).
  - Cloth panels or strings (kite_fencer).
  - Any ring around a tile (cloud_hatchling's wind ring).
  - A dive from above (storm_hawk).
- **Budget (KK-13, `--class medium`, 3.6 MiB).** 84×72×4 = 24,192 B per frame × **121 frames** =
  2.93 MB. Frame counts:

| anim | f | ms (holds) | marks |
|---|---|---|---|
| idle (loop) | 16 | 1920 `[110,120,130,140,120,110,100,120,130,140,120,110,100,120,130,120]` | — |
| guard (loop) | 6 | 960 `[180,150,160,180,150,140]` | — |
| toGuard / fromGuard | 6 / 5 | 370 / 330 | — |
| attack ("Kerkenez Hamlesi") | 12 | 1170 `[70,100,70,170,60,50,70,90,110,120,120,140]` | charge 1, release=impact 5, contact 6, recover 8 |
| special ("Kanat Selamı", the bless) | 12 | 1300 `[80,100,120,160,60,90,110,120,130,140,140,50]` | charge 1, release=impact 4, recover 8 |
| roar ("Çağrı", head back, singing) | 10 | 1100 `[80,110,160,70,110,120,120,110,110,110]` | charge 1, release=impact 3, recover 5 |
| hit | 6 | 560 `[50,60,120,100,110,120]` | impact=contact 0, recover 3 (230→ adjust to ≥240) |
| hitHeavy | 7 | 700 `[50,60,130,110,100,120,130]` | recover 4 (350) |
| hitMagic | 7 | 680 `[50,60,120,110,100,110,130]` | recover 4 (340) |
| summon | 13 | 1250 (cinematic holds the glide frames longer) | land 7 |
| death | 10 | 860 `[50,60,150,80,70,80,90,90,90,100]` | impact=contact 0, dissolve 4 (340) |
| revive | 11 | 1180 | land 7 |

- **Holds.**
  - One-shots end on idle f0 (HA-14). Hand-built tables append that frame. Death is exempt.
  - `attackImpactFrame` = attack release = 5.
  - hit: set the holds to `[50,60,130,100,110,120]` so that recover starts at 240 (HA-4).
- **Points.**
  - `muzzle` / `grip` = sword tip.
  - `hand` = sword hand.
  - `head` = the jewel. **This point never moves during hover frames.**
  - `core` = chest (36, 44).
  - The wingtips `wingL` / `wingR` are used if `MonsterPoints` allows extra names. Otherwise they
    are constants per frame in `wing_lady-fx.ts`, as in windmane's `tail` fallback.
  - Points are clamped above the ground (`Math.min(GY, …)`) during the flatten death.

## 2. Palette (`PAL`/`RAMPS` only; ≤ 20 colours per frame)

| part | tones (dark→light) | notes |
|---|---|---|
| wings: coverts and secondaries | earth2 · earth3 · earth4 | 3 bands of ≥ 2 px. The lit upper edge is earth4. Crease bands sit one step down (earth2), never ink. |
| wings: bars and primary tips | night2 · night3 | 2–3 short 1-px bars per wing (the only 1-px detail on the wings). Primaries are slate-tipped. |
| bodice and leggings | leaf0 · leaf1 · leaf2 | The dark green body. leaf3 is the lit edge only. |
| trim (circlet, bracers, belt, guard) | gold1 · gold2 | Never gold3/gold4 in the body. |
| sash (windsock) | mist · white | A 2-px ribbon, ≤ 5 % of the silhouette. |
| skin | skin2 · skin3 · skin4 | Face, arms. |
| hair (braid) | night1 · night2 | Blue-black; the braid is a 2-px ribbon that streams. |
| blade | steel · mist (+ one white glint per anim) | Leaf-shaped. |
| **emissive** (after `outline`, never outlined) | **leaf4** jewel core, **gold4** jewel setting (2 px) | Flares to a 3-px cross on the song beats. |

- **Count:** ink + 3 + 2 + 3 + 2 + 2 + 3 + 2 + 2 + 2 = 22 candidates. Merges: earth2 also serves as the
  wing bar's light half, and leaf3 appears only on 2–3 lit-edge pixels. Drop `night1` from the braid
  where `night2` + ink suffice. Target ≤ 20 per frame, checked by `monster-gates`.
- **Never** cyan, crim, teal or mag. That includes the FX drawn *on* her.
- **`MONSTER_GLOW`** (my own line in `src/view/light/profiles.ts`): replace the placeholder with
  `wing_lady: { emissive: [T(PAL.leaf4, 1), T(PAL.gold4, 0.6)], halo: 0.5, pool: 0.8, spill: PAL.leaf3 }`.
  Neither tone is a body tone. Use the `spill` field only if the profile type has it. Otherwise drop it.
- **Effect FX palette** (aura, currents, crest; never on the body):
  - Air currents: gold3 head, gold2 body, gold1 tail.
  - Wing shadow: ink core, night0 edge band.
  - Crest: gold3 with a gold4 top row and an ink outline.
  - Gold is the "lift" colour. It is not the generic stat green (leaf), so the generic chevrons and her
    bless can never be confused.

## 3. Idle: living details (16 f, 1920 ms, feet fixed)

- **Wing breath (the aura clock).**
  - f6–f9: both wings open 2 px wider and lift 1 px (one slow "taste of the air"). f10–f12: they settle.
  - The primaries lag the coverts by 1 frame (overlap).
  - **This breath is the beat that every buffed ally's wing shadow copies** (§4.5): the aura reads her
    sprite's current idle frame and beats when she reaches f7.
- **Covert ripple.** On f2–f3 and f12–f13, the lower edge of the coverts shifts 1 px in a row-wave from
  shoulder to tip (wind passing). These are whole-pixel row shifts, with no noise.
- **Braid and sash.** Both stream back.
  - The braid swings on a 2-crest travelling wave over the loop.
  - The sash flicks up 1 px at f5 and f13, half a loop out of phase with the braid, so it never reads as one sine.
- **Head (kestrel).** At f11–f12 the head **tilts 1 px** as if listening, then snaps back on f13.
  Nothing else moves in that frame pair, so the twitch reads.
- **Sword.** Tip down at her side. The blade glint (`twinkle`, white, the anim's single glint) runs
  down the lit edge on f8–f9.
- **Jewel.** leaf4 core on f0–f9. On f10–f15 the core dims to leaf3 with the gold4 setting kept (a slow pulse).
- **Breathing.** Chest up 1 px on f0–f7, down on f8–f15. The head lags 1 frame.
- **Light layer.** A small leaf3 spill from the jewel. No ground pool at rest.

## 4. Storyboards (scene ms; game ≈ ×1.35; limits = REHBER §5 × 1.45 game clock)

### 4.1 Summon: "Gölge Önden Gelir" (her shadow arrives first) (≈ 1.60 s entrance)

The idea: the board sees her shadow before it sees her. The glide is **horizontal and low**, along
her own row. That is not storm_hawk's vertical spiral dive, not steppe's leap and not kite_fencer's
falling kite. The whole move is a flight from behind her own back (P1 from the left, P2 mirrored
from the right) that ends in a brake-flare.

Wiring: `if (LOOK_V3) registerCardHook('wing_lady','summon', …, {priority:20, name:'kart-f:wing_lady:summon'})`.

| from | handling |
|---|---|
| `'hand'` | `runSummon(ctx, fallback, glideInV3)` |
| `'field'` (flip) | `ctx.base()`, the generic flip |
| `'graveyard'` | soul_recall consumes it in v3, so it does not reach this hook. Return `ctx.base()` for safety. |

| ms | picture | sprite | sound |
|---|---|---|---|
| 0 | The card slams onto the tile (kit). | hidden | (kit card slam) |
| 0–260 | **Her shadow comes first.** A wing-shaped floor shadow (ink core, night0 rim; 34×8 px, 2:1 flattened) slides in along the floor from 110 px behind the tile. It starts small and soft-edged (2 steps) and grows and sharpens as it nears, as if something is descending from behind the camera. It slides under any allies on the way, which foreshadows the aura. | — | `khGlideIn` start (an approaching air rush, panned from her back side) |
| 180 | She appears 90 px behind the tile and 30 px up: summon f0 (glide: wings fully spread flat, body horizontal, braid and sash straight back, sword tucked along the forearm). The hologram build runs during the glide (≤ 260 ms, EF-11). | f0 held | — |
| 180–600 | **The glide.** A straight, shallow descending line to 14 px above the tile (`Sine.Out`). Her shadow locks under her and tracks her exactly. A 1-px gold2 slipstream line trails each wingtip (8 px, 3 palette steps). While airborne she is at FX depth, so she passes over the heads of allies. | f0→f1 (the wings tilt as she banks level) | rush peaks as she passes centre |
| 600 | **Brake-flare.** f2–f3: the wings swing forward and **up into a tall "W"** (full span ≈ 72 px, her biggest silhouette). The body rotates upright and the feet swing forward. | f2, f3 | `khGlideIn` stop(120) |
| 640 / 760 / 900 | **Three backwing beats** (f4 / f5 / f6, slowing down). Each downstroke pushes a short gold air crescent (1-px arc, 10 px wide, gold3→gold1 in 3 steps) down and forward onto the floor in front of the tile. The shadow under her darkens and shrinks with each beat as she sinks to 6, then 2, then 0 px. | f4–f6 | `khBackwing` (one recipe, three beats at 0 / 0.12 / 0.26 s) |
| 960 (land, f7) | Toes touch. A **two-step run-out**: f7 front toe, f8 back foot, a 3-px skid forward and back. No dust (she is light). The floor light settles on her tile (stepped, 1 level). | f7, f8 | two light footfall ticks inside `khBackwing` |
| 1100–1250 | f9–f10: the wings **snap-fold** into the half-raised V in 2 frames. The sword comes up. | f9, f10 | — |
| 1250 | **Salute** (f11): the flat of the blade to her brow. The **jewel flares** (3-px leaf4 cross for 2 frames, light layer leaf3 pool on her tile for 160 ms). She **sings the first note**. The badge pops. | f11 | `khSong` (the root A4, breathy onset) |
| 1250–1600 | f12 → idle f0. The sword lowers and the hum tails off. | f12 | — |

- **Resolve ≈ 1.60 s.** If there are WIND allies, the statChange run follows immediately and our
  handler plays **Kanat Selamı** (§4.3). The song's tail overlaps its onset, so the two read as one
  continuous moment.
- **P2.** Everything is mirrored (she comes from the right side behind her). The flipX sprite uses the
  P2 relit sheet, and the shadow and crescent geometry are mirrored. The light stays top-left.

### 4.2 Flip summon (face-down lady flipped)

- The generic flip runs (`ctx.base()`, ≤ 0.6 s), then **Kanat Selamı** plays from the statChange run.
- No glide: a flip is a reveal, not an arrival. The only flip-specific accent: on the reveal frame
  the folded wings snap open to the V (toGuard-style intermediate pose from roar f1). That pose is drawn
  by the effect beat's charge, not by a separate anim.

### 4.3 Signature EFFECT: "Kanat Selamı" (wing salute; the aura switches on)

Played by `kart-f:wing_lady:aura` (`registerEvent('statChange', …, {priority:25})`) for an
aura-caused **gain** run. k = number of allies in the run, sorted nearest-first by tile distance from her.

**How the meaning is made readable (who, and how):**

- **A wing current from her to each ally.** A wing current travels from her to each buffed ally,
  **and to nobody else**. A non-WIND neighbour (ember_wolf in `khSummon`) is visibly skipped: the
  current curves around its tile.
- **On each buffed ally, three things happen together:**
  1. A **wing shadow** opens under its feet.
  2. A **wing crest** blooms beside its ATK number.
  3. The badge rolls +300.
- **Afterwards, the shadows and crests stay** (§4.5), so at any later moment the board answers the question "who is buffed?".
- **Sound counts the allies.** Each ally adds one harmony voice to her chord.

| ms | picture | sound |
|---|---|---|
| 0–240 | special f0–f3 (charge): the wings lift to half-span, the sword rises overhead tip-up, the jewel brightens step by step (leaf3 → leaf4). Her own tile gets a stepped leaf3 light pool, level 1. | `khSong` sustain (root A4 hum continues, or starts here on flip/revive paths) |
| 240 (release f4) | **One full downstroke** of both wings. From the wingtip **on the side of each ally** (allies left of her get the rear wing, allies right of her the front wing; for P2 the same by screen side), a **gold air current** leaves at floor level: a 1-px line with 2-px dashes travelling along it (gold3 head, gold2 body, gold1 tail, 3-step fade). | `khCurrent` per ally (cap 6, gap 0.01), panned to the ally |
| 240 → 240+T | The current follows a shallow 2:1 iso arc across the floor to the ally's anchor. T = 200 + distance × 0.9 ms (≤ 360). Allies are staggered by 120 ms. The arc is lifted 4 px over any tile it crosses that holds a non-buffed monster (the visible skip). | — |
| arrival (≈ 500 for ally 1) | **The lift.** 1) The current spreads into the ally's **wing shadow**, which unfolds from a line to full spread in 3 frames (50 ms each; 30×7 px, centred at the anchor, under the sprite at `DEPTH.SHADOW`). 2) The ally sprite rises **1 px for 2 frames** and settles (a whole-pixel buoyancy; the only time we move another card's sprite, restored exactly). 3) The **crest** unfolds at the badge's right end in 3 frames (dot → half wings → full 9×5 wings). 4) The badge rolls +300 (`u.setStats(e.atk, e.def, true)`) and a small gold "+300" pops above the badge and drifts up 4 px over 500 ms (an existing number style; no new text style). | `khBless1..4` (the ally's harmony voice: C#5, E5, A5, C#6) + `khCrest` (a small A6 "ting") |
| last arrival + 250 | All shadows (and hers, if she has one from a second lady) **beat once together**: 1-px spread out and back. This first synchronised beat teaches the player that they belong together. | the chord holds 0.4 s, then releases |
| … | special f8–f11 → idle f0: the sword lowers into the salute's end, the wings settle. | — |

- **Durations.** k=1: ≈ 1.05 s. k=2: 1.17 s. k=4 (5-zone): ≈ 1.41 s. All are ≤ 1.6 s scene, the
  monster-effect budget (≤ 2.32 s game).
- **Robustness.**
  - If her unit is missing or hidden (a revive path where soul_recall still owns her sprite), the
    beat runs without her special anim: the currents start from her tile's anchor at shoulder height.
  - If an ally unit is missing, that ally gets the generic `u.setStats` only.
  - `khBusy` holds the uids for the duration of the beat.
- **EF-2.** The shadow lies **under** the sprite, and the crest sits outside the sprite box. Nothing covers a silhouette.

### 4.4 Arrival bless (an ally arrives next to her: no event; ≈ 0.6 s)

`kart-f:wing_lady:arrive` (`registerEvent('summon', …, {priority:30})`): `await ctx.base()`, then if
the new unit is face-up WIND with `auraBonus(ctx.stateNext…) > 0`:

| ms | picture | sound |
|---|---|---|
| 0 | `u.setStats(atk − bonus, def, false)` resets the badge silently, so the roll can be seen. The nearest lady (or each lady, staggered, for two ladies) plays **roar** in the background (non-blocking): head up, one wing lifts toward the newcomer. | `khBless{k}` where k = the newcomer's index among the buffed allies (it completes the chord) |
| 80 | One current from her near wingtip to the newcomer (as in §4.3, T by distance). | `khCurrent` |
| arrival | Shadow unfolds, 1-px lift, crest blooms, badge rolls +300 per lady. | `khCrest` |
| +150 | All shadows beat once together. | — |

- **Covers:** a WIND normal/tribute/special summon, an ally's flip (`summon{from:'field'}`), a second
  lady arriving (she arrives buffed by the first), and a soul_recall revive of a WIND ally.
- **Ends ≈ 0.55–0.65 s after the arriving card's own entrance.** This adds no time when no lady is present.

### 4.5 The persistent aura `khWing` (file `kart-f/wing_lady-aura.ts`)

`setAura('khWing', khWingAura(scene, allyUnit, ladyUid))` on each buffed unit. It follows the
`flameAuraV3` pattern: an `onFrame` loop, whole pixels, palette steps, no alpha, and the sprite itself is never touched.

| part | look | behaviour |
|---|---|---|
| **Wing shadow** | A soaring-bird shadow seen from below, 30×7 px, 2:1 flattened (two swept wings, a 4-px body notch), ink core with a night0 rim, at `DEPTH.SHADOW − 1`. On the grey arena floor it reads as a crisp dark wing pair (looked at: the tile floor around the monster row is mid-grey stone). | **Beats with her.** When the lady's sprite reaches idle f7 (her wing breath), the shadow spreads 1 px on each side for 2 frames. Several allies beat in the same frame. If she is not idling (attacking, hit), the beat waits. It hides with the ally's sprite and rides the ally's anchor (not the lunge: a shadow is cast from above, so it stays on the tile while the ally attacks, which reads as "her shelter is here"). |
| **Wing crest** | 9×5 px: two tiny stepped wings, gold3 with a gold4 top row and an ink outline. Pinned 1 px right of the badge image's right edge, vertically centred. Depth `BADGE_DEPTH + 1`. The plate's own lock slot is on the **left**, so it never collides with hourglass_imp's freeze or kneel markers. | It hides with the badge. **Two ladies** (the ally gets +600): the crest shows a **second pair** stacked 2 px higher (one pair per lady). This is the honest count. |
| **Declaration flare** | `kart-f:wing_lady:declare`: a `registerEvent('attackDeclare', …, {priority:25})` that starts the flare in the background and returns `ctx.base()`, so the declaration gets no longer. | When a buffed ally declares an attack, its crest flashes gold4 for 2 frames and its shadow beats once. `khCrest` at 0.35 volume. It shows that the extra 300 is in play. |
| Lady's own marker | none | She is not buffed by herself. With a second lady, she gets the aura like any ally. |

- **Lifecycle.** Bless and unbless beats set and clear the aura. The observer (§0) only removes
  stale auras and restores steady-state ones after a rebuild.
- **Off when:**
  - the ally leaves or is flipped face-down;
  - the ally changes controller;
  - the lady leaves, is stolen, or is set face-down.
- **Determinism.** No random numbers. Beat phases come from her sprite frame, so `--fresh` films are stable.

### 4.6 Unbless: "Kanatlar Döner" (the aura switches off; she survives or the death hook does not own it)

`kart-f:wing_lady:aura`, the loss branch (aura-caused statChange with atk < prevAtk).
**Origin:** her unit if it is still on the board (stolen: her new tile). Otherwise her last tile
(`ctx.locate(uid)` on `ctx.state`) or her owner's graveyard pile (`field.pile(owner,'graveyard').topXY()`).

| ms | picture | sound |
|---|---|---|
| 0 | On each losing ally: the crest **folds** (the bloom in reverse, 3 frames), and the wing shadow **peels off** the tile. It folds its wings to half-span and lifts 2 px. | `khUnbless` start (the chord voices drop out one by one, each bending down a semitone) |
| 100 (+80 per ally) | Each shadow **glides like a small bird** along the floor toward the origin (her new tile, her empty tile or her graveyard), shrinking 1 px every 60 ms and fading ink → night0 → gone. | `khShadowPeel` per ally (cap 6, gap 0.01), panned |
| 150 | The badge rolls down −300 (`u.setStats(…, true)`). No red drain and no ▼ chevrons: this is a parting, not a wound. | — |
| ≈ 550 + 80·(k−1) | End. If she is still on the board (stolen), the gain run for her new side follows immediately as §4.3, with the shadows arriving from her. | — |

### 4.7 Attack: "Kerkenez Hamlesi" (kestrel strike) (attack anim; on a monster ≈ 1.50 s ≤ 2.2 s)

`registerStrike('wing_lady', (s) => LOOK_V3 ? kestrelV3(s) : (s.base ? s.base() : Promise.resolve()), {name:'kart-f:wing_lady:strike'})`.
wing_lady has no v1 strike today, so the v1 branch is `s.base`, which leaves v1 unchanged.

**The idea.** She **hovers in place** like a kestrel: the wings beat, the **head is locked dead still**,
she takes aim. Then she makes a short, flat, sword-first stoop. At contact her wings **clap** forward
around the target. She returns **backwards on her wings**, still facing the enemy.

| ms | picture | sprite | sound |
|---|---|---|---|
| 0 | `strikeStartFrame` = the declaration hold, attack f1: a crouch, wings lifting, sword drawn back along the forearm. | f1 | `khHover` (the voice charge, held from the declaration) continues |
| 0–100 | f2: one big downstroke, and she **rises 14 px** above her tile (`Quad.Out`). Her wing shadow stays on the floor. | f2 | — |
| 100–340 | **Hover.** The cinematic alternates f2 / f3 (wings down / up) every 60 ms, 4 beats. **The head, jewel and sword pixels are identical in f2 and f3.** Only the wings and sash move. 1-px gold1 "beat arcs" flick off the wingtips on each downstroke (3 px long, 1 frame). | f2/f3 ×2 | the hover thrum swells |
| 340 | f4: the wings **fold back** into a swept "V" behind her and the sword points forward. A tiny drop of 2 px (the stoop begins). | f4 (60) | `khStoop` (release) |
| 400 (release f5) | **Stoop.** A straight, shallow line from the hover point to the target's `core` (≤ 20° below horizontal; never from above), 200 ms `Quad.In`. Two 1-px gold slipstream lines trail from her folded wingtips (10 px, 3 steps). Her shadow races along the floor beneath her and grows toward the target. | f5 | — |
| 600 (contact f6) | `s.impact()` (once). **The wing clap:** both wings snap forward. Two 1-px gold3 arcs (her wing edges, 16 px tall) close around the target's silhouette edge, front and back, like a pair of brackets, for 1 frame. Next frame they break into 6 short gold2 dashes flying outward and fading in 3 steps. The thrust is centred on the core. Hit-stop is the class contact stop (mediumLight 40–60 ms; she is the striker, so `contactStopMs` applies). | f6 (70) | `khClap` (impact: double air "PAH" + bright blade "çink" + small body thump) |
| 670–900 | f7: she **rebounds off the clap**: 8 px back and 4 px up, wings open. | f7 | — |
| 900–1330 | f8–f9: **backflap home.** Two strong back-beats carry her backwards along a shallow arc to 2 px above her tile, still facing the enemy. The shadow slides home under her. | f8, f9 (recover) | `khBackwing` at 0.6 volume (two of its three beats are audible before stop(80)) |
| 1330–1500 | f10: touch down. f11 = idle f0, wings fold. Resolve when she is home. | f10, f11 | — |

- **Budget.** Declaration (≤ 0.3) + 1.50 s ≈ 1.8 s scene, ≤ 2.2 s. The target's death starts 150 ms
  after contact (`battleV3`) and runs in parallel with her return.
- **Overlay.** If the lady herself is buffed (a second lady), her crest flares at contact. That is
  the only change.

**Direct attack** (≈ 1.30 s ≤ 1.6 s): the same hover, cut to 3 beats (180 ms). Then a **long, flat, low
glide** straight to the LP point `to` (no arc over monsters, which is storm_hawk's). The flight takes
280 ms (`Quad.In`). Contact at the panel point: `s.impact()`, and a smaller clap (arcs 10 px tall)
around the point. Then she **bursts up** off the clap (f7) and is **carried back by the wind**: a high
backward arc of 22 px peak, 420 ms, wings spread in the glide frame (summon f0 reused through the
cinematic hold). She lands with f10 and f11. Sound: `khClap` plus `khDirectCry`, a short sung "ha!" on E5, the song's fifth.

**Blocked** (the target defends and survives; ≈ 1.55 s):

| ms | picture | sound |
|---|---|---|
| 600 | Contact on the guard. The sword **skids**: a 1-px white spark line runs along the guard's edge (2 frames). The clap arcs **shatter on the same frame** (dashes fall down rather than out). | `khSkid` (a short scrape) + the defender's material hit (the system's) |
| 620–900 | She is flung **up and back**: hitHeavy f0–f2 with the wings flailing asymmetrically. Cinematic arc 16 px up and 12 px back. | `khFlail` (the wingbeat thrum stumbling, falling AM rate) |
| 900–1400 | Two **recovery flaps** (attack f8/f9) bring her home. She lands 3 px short and steps in with f10. | — |
| 1400–1550 | idle f0. The recoil number comes from the system at contact. | — |

### 4.8 Hit, heavy, magic, guard (sprite poses; reactions by the default battle handler)

| anim | pose story (f0 = the hit continues the contact, KK-4 < 50 % from every idle frame) |
|---|---|
| **hit** (6) | f0: the wings **jolt up** 3 px and the head snaps back 1 px. f1: a half step back, the sash whips forward. f2–f5: the wings come down in two beats and the head returns (the kestrel re-locks). |
| **hitHeavy** (7) | f0: she is knocked back 3 px with **asymmetric wings** (the rear one flung high, the front one dropped). f1: knee bends, sword arm thrown wide. f2: the front wing braces down to the floor like a crutch (a unique beat). f3–f6: she pushes up off the wing and refolds. |
| **hitMagic** (7) | f0: the wings **snap shut around her** by instinct (a half guard). The jewel flickers out for 1 frame (leaf3 → gold4 setting only). f1–f2: a shudder (1 px left/right). f3–f6: the wings reopen and the jewel relights in steps. |
| **guard** (6, loop) | **"Kanat Kalkanı"** (wing shield). Both wings wrap **forward around her** and cross in front of her torso, primaries overlapping at belt height, like a feathered cloak. The sword stands upright between the wing edges, tip up. The head and jewel stay visible above the wrap (HA-29). Loop: the wing edges tremble 1 px (f2, f4) and the sash peeks out once. Δ is about 0.5 × idleΔ (HA-19). |
| **toGuard** (6, 370 ms) | Wings rise, then sweep forward (an intermediate frame with the wings high and forward, HA-29), wrap and cross. Ends at guard f0. |
| **fromGuard** (5, 330 ms) | The wings uncross, open to the side and rise to the V; the sword lowers. Ends at idle f0. |

- **Struck-body sound.** The generic material plays (`GENERATED_HIT_MATERIALS` is stone-only). There
  is no feather/cloth struck material. Raise it with the orchestrator rather than adding one.

### 4.9 Death: "Gölge Kuş" (the shadow bird) (a unique ending; ≈ 1.36 s ≤ 1.4 s)

**Final material (new, not in §5.2):** she wraps herself in her wings, then **flattens into her own
floor shadow**. The shadow **takes the shape of a bird and glides away** along the floor, following
her card to the graveyard. When it departs, it takes the allies' wing shadows with it.

- **Not** a feather burst (storm_hawk), a pillow or wind scatter (R3, C11), a cloak flying away (C9),
  a shadow pool sinking (shade_assassin: ours does not sink, it *leaves*), a falling strand rain
  (windmane_knight), or an empty shroud (R2).
- **Option (b).** Our own `destroyed` hook with deathV3-style bookkeeping (`_v3/death.ts:282`;
  HANDBOOK §6.3). It consumes the `toGraveyard` and the **following aura-caused statChange run**,
  so the allies' unbless is part of the death.
- Fallback to `ctx.base()` when `sourceOwnsDeath(ctx)`. In that case the statChange handler plays §4.6 on its own.

| ms | picture | sprite | sound |
|---|---|---|---|
| 0 | death f0 = the hit continues (by type: hitHeavy-like asymmetric wings) | f0 | the struck material (system) |
| 50–110 | f1: she staggers back. The **song breaks off** mid-note. | f1 | `khSongBreak` (deathStart: a vibrato note slides down a fourth and cuts to breath) |
| 110 (f2, hold 150) | She **wraps her wings around herself** (the guard wrap, but closed over the head too). The jewel goes dark. | f2 | — |
| 260–340 | f3: she drops to one knee inside the closed **wing bud** (a tall, closed teardrop of feathers on the tile). | f3 | `khFold` (afterDissolve −80: a dry feather rustle at 2–3 kHz, not R3's 5 kHz) |
| 340 (dissolve f4) | **The allies' shadows let go** (only if the statChange run is present). Each buffed ally's crest folds and its wing shadow peels off and glides to **her** tile, converging under the bud (staggered 60 ms). The badges roll −300. | f4 | `khShadowPeel` ×k, `khUnbless` (the chord collapses into her root) |
| 340–820 | f5–f9: **the bud flattens.** Row by row it compresses toward the floor (whole-pixel rows removed from the middle, the top keeps its outline). The last frame is a 6-px-high wing-bud slab. Under it, the gathered shadows have merged into one dark pool shaped like her folded wings. | f5–f9 | `khFlatten` (dissolve: a soft descending air "hhmm" plus a low cloth-soft thump at the end) |
| 820–970 | **The body becomes the shadow.** The sprite is hidden on the frame the shadow takes its place (EF-12 continuity: the first shadow frame matches the slab's outline exactly, in ink/night0). Over 3 frames (50 ms each) the shadow **opens into a bird**: wings spread from the folded shape to a 36×8 soaring silhouette. | hidden | — |
| 970 | **Lift-off = break frame.** The card is born on her tile (two frames of a 1-px white frame, one frame in the owner's tone) and flies to the graveyard (`cardLeaves`, 200–360 ms arc). | — | `khShadowFlight` (burst: a receding whoosh plus her last sung note far away, A5 with echo) |
| 970–1360 | The **shadow bird glides along the floor under the card's path** to the graveyard pile: 2:1 projected, shrinking 1 px every 50 ms, fading ink → night0 → night1 → gone, with one 2-frame wingbeat (span −4 px, then back) halfway. It reaches the pile just after the card lands and vanishes into it. | — | (tail of `khShadowFlight`) |

- **No generic pixel break.** The ending is the shadow leaving.
- **Bookkeeping order.**
  1. `field.release(uid)`, hide the badge, `unit.posed = true`, emit `v3:dying`.
  2. Run the anim.
  3. `cardLeaves(...)` at 970.
  4. `unit.retire()`, `field.forget()`, emit `v3:dead`.
  5. Call `hints.onBorn` on the birth frame.
- **`DEATH_PRESETS`** (my own line): `wing_lady: { material: 'light', accent: 'light' }`. The custom
  death owns the picture. The preset only feeds `matterRamp` (gold: hologram onset, revive motes) and the
  source-owned fallback. The leaf/plant accent (storm_hawk's flavour) is removed.

### 4.10 Revive (soul_recall; ≈ 1.55 s ≤ 2.0 s)

The reverse of the death (HA-28). soul_recall plays the `revive` pose and the voice pair. The
statChange run that follows gets **Kanat Selamı** from our handler.

- **0–420.** The **shadow bird glides back** from the graveyard along the floor to her tile and lands
  there as the folded-wing pool. revive f0 holds the flat slab, hidden until the shadow arrives. Sound: `khReviveGather` start.
- **420–900.** revive f1–f5: the slab **unflattens** into the wing bud, row by row (death f9 → f4).
  The jewel relights in two steps inside the bud.
  - This is a death reversed, not an entrance. The "climbing from the ground" entrance reserved for
    R2/C10 is the summon; our summon is the glide. Noted for the critics.
- **900–1050.** f6–f7 (land at f7): the **wings burst open** to the V and she stands. Sound: `khReviveLand` (her first note plus one backwing beat).
- **1050–1550.** f8–f10 → idle f0.

### 4.11 Roar "Çağrı" (10 f)

- She throws her head back and **sings**. The wings open wide (span about 60) on release f3 and the jewel flares (3-px cross).
- Played by the arrival bless (background) and as `voice.roar`.
- It is never on a cut-in: she is not an ace, so no cut-in exists or is needed.

## 5. Card art (`src/art/cardart-v3/wing_lady.ts`; native redraw, crystal_wyrm pattern)

- **Backdrop: RÜZGÂR.** night0/leaf0 sky bands, night0 ground with a leaf1 horizon, and the
  wind light shape: two stepped arcs (leaf1, leaf2) wrapping the focus, open to the right. Rim leaf3.
- **Big 88×68.**
  - She is shown from mid-thigh up in 3/4 view, facing right, in the **salute**: the blade's flat rises
    diagonally across in front of her brow.
  - The wings are **raised high in a V that fills the upper width** (tips at x ≈ 10 and x ≈ 80, both
    kept ≥ 4 px from the frame). The rear wing is cut by the left edge only if that reads as a decisive overflow.
  - The **green jewel** is the focus at ≈ (47, 21): the brightest point (leaf4 in the light layer, gold4 setting).
  - The braid and sash stream left.
  - **On the ground band, a long wing-shaped shadow** (ink/night0) stretches from her feet to the
    right edge: the card's tell for the effect.
  - Subject fill ≈ 0.66. No dither, no gradients, no `mix()`.
- **Small 44×34 (hand-made).**
  - A tighter crop: head and jewel, the sword cross, the inner halves of both wings, and a stub of the shadow at the bottom.
  - Done with a hand map plus `patch`, not autoSmall. Nothing on x 0/43 or rows 0/33.
- **16×12 check:**
  - a warm, light V across the top;
  - a dark head dot with **one green pixel** in it;
  - a dark green body block;
  - a dark streak at the bottom right.
  - It must not read as storm_hawk's all-green bird.
- **Wiring.** `portrait(p) { p.blit(renderArt(card, 0).smallPx, 0, 0); }` on the MonsterArt (`seal_head.ts:35` pattern).

## 6. Sound identity (checked against YENI_KARTLAR §5.1)

| | |
|---|---|
| **Main pitch / colour** | **A sung "aa" vowel in A major.** The root is **A4, 440 Hz**: a saw/triangle source through band-pass formants at ≈ 800 / 1150 / 2900 Hz, with a 5.5 Hz vibrato (depth 0.6 %) and breath noise on the onset. A woman's wordless song. |
| **Signature material** | **The flight feathers' hover thrum ("trrr")**: band-passed noise at 900 Hz, q 3, amplitude-modulated at 20–24 Hz (fast wingbeats). Plus a short **bronze-steel blade "çink"** (`clank` 1.9 kHz, ratio 2.4, decay 0.12). |
| **Distinctive layer** | **The chord count.** Each buffed ally adds a harmony voice, C#5 → E5 → A5 → C#6, so 1 ally makes a dyad, 2 a triad, and so on. Unbless drops the voices one by one, each bending down a semitone. **The wing-clap "PAH"** at contact is two hp-1.2 kHz white puffs 12 ms apart over a small thump. |
| **Must avoid** | R3's formant "uu" at 300 Hz and its pillow pof (ours is "aa", ≥ 440 Hz, and never a soft pillow puff). C1's conch "uuu" at 220 Hz (a conical breath, not a vowel). C11's horn flute (a breathy sine, not a formant voice). C8's single wing "fuff" (our wings are a thrum or triple brake beats, never one soft puff). C9's 4 kHz "tsst" and string buzz (our blade sits at 1.9 kHz, and the thrum is noise, not a tonal wire). C3's rising ring whistle (our currents are low-q 600 Hz → 1.8 kHz air, never whistled). crystal_wyrm's glass bells (no `glassBell` anywhere; the crest "ting" is a soft triangle pluck on A6). windmane's C3 howl and banner snap and sand wall. storm_hawk's `windGust` and screech (no bird cry: she sings). |

**Proposed §5.1 row** (lane F cards are not in the table; to add when the orchestrator merges):
`Kanat Hanımı | A4 "aa" şarkısı (formant) | uçuş tüyü titreşimi + bronz kılıç | müttefik başına bir armoni sesi (akor sayar) + kanat çırpması "PAH"`.
**Proposed §5.2 row:** `Kanat Hanımı | kanatlarına sarılıp kendi gölgesine yassılır; gölge kuş olup kartının ardından mezarlığa süzülür`.

### 6.1 Recipes (`src/audio/v3/wing_lady.ts`, prefix `kh`, kit blocks plus Voice primitives only)

| recipe | role / beat | build | duck |
|---|---|---|---|
| `khGlideIn` | arrive (sustained, start/stop) | `sweep` pink 1.2 k→800→600 Hz (doppler fall), q 1.6, pan from her back side to centre, 1.2 s; quiet hover AM (22 Hz) fades in during the last 0.3 s | 0.3 |
| `khBackwing` | land | three wing beats at 0 / 0.12 / 0.26 s: `thump` 110→70 Hz (g 0.35, dec 0.08) plus `puff` pink lp 600 Hz (dec 0.1), gains 1 / 0.8 / 0.6; two footfall ticks at 0.36 / 0.44 s (`crack` n 1, lp 2 k, tiny) | 0.45 |
| `khSong` | roar (summon salute, roar anim) | formant "aa" voice A4 → E5 → A4 slur over 0.9 s, vibrato 5.5 Hz, breath `puff` white hp 3 k on the onset, `echo` 0.18 s fb 0.2 | 0.55 |
| `khBless1` / `2` / `3` / `4` | per buffed ally (cap 6, gap 0.01) | the same formant voice, held 0.7 s, on C#5 / E5 / A5 / C#6, softer (g 0.18) with a slow attack (40 ms) so it *joins* the chord | 0.25 |
| `khCurrent` | each air current (cap 6, gap 0.01) | `sweep` pink 600→1.8 k Hz, q 1.2, 0.3 s, `peakAt` 0.7; pan set by the caller (`panAt(allyX)`) | 0.15 |
| `khCrest` | crest bloom / declaration flare | triangle pluck A6 (1760 Hz) `perc(0.12, 0.09)` plus a 1-ms click; no bell modes | 0.1 |
| `khUnbless` | aura loss (sustained, stop at end) | 2–3 formant voices from the chord, entering together and each gliding down a semitone and dropping out at 0.15 s intervals, leaving the root which fades | 0.25 |
| `khShadowPeel` | each shadow leaving (cap 6, gap 0.01) | `sweep` pink 900→300 Hz, q 1, 0.35 s, pan toward the origin | 0.1 |
| `khHover` | charge (declare `holdCharge`; sustained) | the hover thrum (band noise 900 Hz q 3, AM 22 Hz through gain steps) plus a held breathy hum A3 (220 Hz formant "mm", g 0.08) | 0.3 |
| `khStoop` | release | a quick fold "fwip" (`puff` white hp 2 k, dec 0.04) then `sweep` pink 500→1.6 k Hz 0.22 s | 0.35 |
| `khClap` | impact | the **PAH** (two `puff` white hp 1.2 k, dec 0.035, 12 ms apart) + `clank` 1900 Hz ratio 2.4 dec 0.12 + `thump` 140→70 g 0.3 dec 0.08 | 0.55 |
| `khDirectCry` | direct contact accent | formant "a!" on E5, 0.18 s, sharp attack + `khClap` | 0.6 |
| `khSkid` | blocked contact | `sweep` white 2.5→5 k q 8 0.15 s + a short damped `clank` 1900 ratio 2.4 | 0.45 |
| `khFlail` | blocked fling | thrum AM falling 24→8 Hz over 0.4 s, lp closing 1.2 k→500 | 0.3 |
| `khSongBreak` | deathStart | a formant note on A4 sliding down to E4 over 0.12 s, then hard cut to a 0.2 s breath (`puff` white lp 2 k) | 0.45 |
| `khFold` | afterDissolve (−80 ms) | a dry rustle at 2–3 kHz (`crack` n 8, hp 1.8 k, lp 3.2 k, gap 0.015, very low) | 0.2 |
| `khFlatten` | dissolve | `sweep` brown 400→150 Hz 0.45 s + `thump` 70→50 g 0.25 at the end | 0.35 |
| `khShadowFlight` | burst | `sweep` pink 1.4 k→300 Hz, lp closing, 0.4 s, pan toward the graveyard + her last note A5 (formant, g 0.12) through `echo` 0.22 s fb 0.35 | 0.5 |
| `khReviveGather` | reviveGather (sustained) | the reverse of `khShadowFlight`: approaching pink sweep 300→1.2 k with a rising hum A3→A4 | 0.3 |
| `khReviveLand` | reviveLand | `khSong`'s first note (A4, short) + one backwing beat | 0.5 |

**`WING_LADY_VOICE`** (set only in the same change that ships the strike and the death, per the HANDBOOK):

```ts
{ roar: 'khSong', arrive: 'khGlideIn', land: 'khBackwing', charge: 'khHover', release: 'khStoop',
  impact: 'khClap', deathStart: 'khSongBreak', dissolve: 'khFlatten', afterDissolve: [[-80, 'khFold', 0.8]],
  burst: 'khShadowFlight', reviveGather: 'khReviveGather', reviveLand: 'khReviveLand' }
```

- **Who plays what.**
  - The death is option (b), so our hook fires `deathStart` / `dissolve` / `afterDissolve` / `burst` itself, on the marks.
  - The bless and unbless recipes are fired by the aura handler.
  - `charge` is played by `declare.ts holdCharge`. It runs on into the hover. If the hover's AM sounds
    wrong, `takeCharge(u, 'khHover')` within 320 ms.
- **Sync.** Every beat is fired from `atFrame` / `atMark` or from the beat's own scene clock (SE-1).
  Sustained sounds (`khGlideIn`, `khHover`, `khUnbless`, `khReviveGather`) are written longer than
  the picture and are stopped on the end mark (SE-2).
- **No idle SFX** (no infrastructure; HANDBOOK §7.3).
- **Offline checks.**
  - `?dev=audio&page=one&name=kh…&log=1` for every recipe; check that the page title is the recipe and not the roarBig fallback.
  - `tools/clip.mjs` on `khSummon`, `khArrive`, `khKill` and `khAttack`: peak ≤ −1 dBFS, 0 clipped.
  - A numpy 1/3-octave LSD in the scratchpad, `khSong` / `khBless*` against `windGust`, the R3 "bö"
    when it exists, the C1/C11 recipes when they exist, and the wmk set; `khClap` against `wmkThrust`
    and the hawk strike. Target ≥ 10 dB min.
  - Send the user the MP4s (SE-8).

## 7. Files

**New (owned by this card):**

| purpose | path |
|---|---|
| Sprite shell (drafted with the `_` prefix until the gates pass, then renamed) | `src/art/monsters-v3/_wing_lady.ts` → `wing_lady.ts` |
| Rig, anims, maps, fx | `src/art/monsters-v3/wing_lady-rig.ts` (W 84, H 72, AX 36, GY 68, `Pose`, `drawWingLady`), `-anims.ts` (tables, marks, cached `framePose` / `framePoints`), `-maps.ts` (face/hand `_L/_R` maps), `-fx.ts` (wing feather painter: bands + bars, braid/sash ribbons, the flatten row-compressor, wing shadow and shadow-bird painters shared with the aura) |
| Card art | `src/art/cardart-v3/wing_lady.ts` |
| Cinematics | `src/cinematics/kart-f/wing_lady.ts`: the summon hook, the arrival wrapper (summon at priority 30), the aura statChange handler (25), the declaration flare (attackDeclare at 25), the strike (monster / direct / blocked), the destroyed hook, and the observer. Every registration is `if (LOOK_V3)`, with names `kart-f:wing_lady:<part>`. |
| Aura and FX | `src/cinematics/kart-f/wing_lady-aura.ts`: exports only (`khWingAura`, `blessBeat`, `unblessBeat`, `currentPath`, crest painter, `khBusy`); no side effects (subfolder `_`-free files are imported, which is fine because it only exports) |
| Sounds | `src/audio/v3/wing_lady.ts` (already exists and is empty): fill `WING_LADY_RECIPES` and the voice |
| Scenarios | `src/duel/scenarios/wing_lady.ts` |
| Tests | `tests/art/wing_lady.test.ts`: validateArt `'normal'`, extras present, marks, `attackImpactFrame`, relight, palette, determinism, **hover-frame head identity** (attack f2 vs f3: the head bbox pixels are equal), card-art stats. Also `tests/cinematics/wing_lady-aura.test.ts` (pure): the aura-caused detector over the probe event lists in §0, including two ladies and the windmane +500 case (must be **not** aura). |

**Shared one-liners** (re-read the file right before each edit; additive; my own line only):

- `src/cinematics/_v3/presets.ts` `DEATH_PRESETS`: `wing_lady: { material: 'light', accent: 'light' },`
- `src/view/light/profiles.ts` `MONSTER_GLOW`: the wing_lady line becomes leaf4 / gold4 (§2).
- `src/audio/v3/kart-f.ts`: nothing to change (it already spreads `WING_LADY_RECIPES` and the voice).
- `docs/v3/oturum-f.md`: our status row and log lines.
- **Not touched:**
  - `src/art/monsters/index.ts`: wing_lady has no exclusion; the renamed file registers by itself, so use `--art` until then.
  - `StatBadge.ts`: the crest is our own image next to the badge.
  - `FieldView.ts`: the observer handles rebuilds.
  - `flow/stats.ts`: we take our events at a higher priority.
  - `monsters1.ts`: `m1Aura` / `m1AuraAttack` stay as regressions.

## 8. Scenarios (prefix `kh`, `src/duel/scenarios/wing_lady.ts`; `…P2` twins where marked)

| key | stage → steps | shows |
|---|---|---|
| `khSummon` (P2) | `zones:5`; p0 monsters `[storm_hawk, ember_wolf, null, storm_hawk, null]`, hand lady → summon zone 2 | glide entrance + Kanat Selamı to **two** hawks; the wolf is visibly skipped |
| `khSummonAlone` | no allies → summon | entrance only, no chord (the song stays a single voice) |
| `khSummon4` | `zones:5`; hawk, steppe_spiralhorn, null, kite_fencer, cloud_hatchling → summon zone 2 | 4-voice chord, 1.41 s budget check |
| `khArrive` (P2) | lady + `[null]`; hand storm_hawk → summon | arrival bless (badge 1000 → 1300 seen rolling) |
| `khArriveLady` | lady on field + lady in hand → summon | two ladies: arrival bless and statChange bless, double crests |
| `khFlip` | lady face-down DEF + hawk → `flipSummon` | flip, then Kanat Selamı |
| `khFlipAlly` | lady + face-down hawk → `flipSummon` | arrival bless on a flip |
| `khAttack` (P2) | battle; lady vs p1 storm_hawk (ATK) | kestrel strike, kill |
| `khDirect` | battle; lady vs empty field | flat glide to the LP point, carried back |
| `khBlocked` | battle; lady vs stone_sentinel DEF (2100) | skid, fling, recovery flaps |
| `khBuffAtk` | battle; hawk + lady vs tide_golem ATK | the declaration crest flare; hawk 1300 wins |
| `khGuard` | p1 hawk (1000) attacks lady in DEF (1400) | wing shield, attacker recoil |
| `khKill` (P2) | battle; p0 ember_wolf attacks p1 lady (ATK) with p1 hawk beside | hit → **Gölge Kuş** + the allies' shadows gathered by the death |
| `khBolt` | p1 judgment_bolt on lady + hawk | hitMagic / effect death; unbless (§4.6 if the bolt owns the death) |
| `khTribute` | lady + stone_sentinel + hawk; hand windmane_knight → tribute both | lady leaves by tribute: unbless toward the graveyard |
| `khSteal` | p1 puppet_string on p0's lady; p0 hawk, p1 hawk | unbless on the old side, then bless on the new side (shadows fly across) |
| `khRevive` | graveyard lady + hawk; soul_recall | shadow bird returns, revive, Kanat Selamı |
| `khBoard5` | `zones:5`, both sides with a lady and WIND allies, idle | the persistent aura on both sides at 1×, beating in sync per side |

- **Base before the first cinematic:**
  `measure --look v3 --scenarios 'kh*,m1Aura,m1AuraAttack' --out shots/v3/kart-f/wing_lady/camera-base-kh.json`
  (on the placeholders), merged into the lane camera base check.
- **Mid-art availability.** The kite_fencer, cloud_hatchling and steppe stand-ins are lane C/A
  placeholders. The design works with any sprite because it reads only silhouettes and anchors.

## 9. Gates (HANDBOOK §9; evidence in `shots/v3/kart-f/wing_lady/`)

- **Types and tests.** `npm run typecheck` clean (ignore others' files). `npm test` with no new
  failures, including `tests/art/wing_lady.test.ts`, the aura test and `cardface-v3`.
- **Sprite.**
  - `monster-sheet --art src/art/monsters-v3/_wing_lady.ts --look v3 --anims all --scale 3 --points` (P1 and `--p2`).
  - `monster-gates … --class medium --ref none` exit 0 (KK-3…KK-13: margins ≥ 2, HA-14/15/16/17/18/19/20,
    KK-4 phase < 50 %, KK-5 feet, KK-6 marks, IŞ-1, IŞ-10 noise; 121 frames, 2.93 MB ≤ 3.6 MiB).
  - Board mode at 1×: `?dev=monster&id=wing_lady&look=v3&mode=board`, after the rename.
- **Sameness.** `sameness --art … --ids wing_lady --against all` below KEY 0.62 / MOTsig 0.55 /
  MOTloop 0.65 / MOTavg 0.45 / SI 0.35. Watch lumen_sprite, storm_hawk, shade_assassin, reed_heron and kite_fencer (when they land).
- **v1.** `filmdiff` v1 17/17 and a6v1 26/26 IDENTICAL; `card-hash --look v1` identical. Every
  registration is gated, the strike's v1 branch is `s.base`, and the wrappers return `ctx.base()` untouched in v1.
- **Camera.** `measure --camera-gate shots/v3/kart-f/camera-base.json`: zoom 1, no close-ups, `focusCalls` equal to the base. There is no `ctx.focus` anywhere.
- **Palette.** `palcheck` on frame dumps of `khSummon`, `khKill` and `khBoard5`.
- **Contact.** `contact-probe` on `khAttack`, `khBlocked` and `khKill`.
- **Budgets** (game clock from measure; ≤ REHBER §5 × 1.45):

| scenario | budget (game) | plan (scene) |
|---|---|---|
| `khSummon` entrance | (normal summon: keep ≤ 2.3 s) | 1.60 s |
| Kanat Selamı (`khSummon`, `khSummon4`) | ≤ 2.32 s (monster effect) | 1.05–1.41 s |
| arrival bless | ≤ 0.9 s added | 0.6 s |
| attack on a monster | ≤ 3.19 s | 1.8 s incl. declaration |
| direct | ≤ 2.32 s | 1.3 s |
| death (`khKill`) | ≤ 2.03 s | 1.36 s |
| revive | ≤ 3.0 s | 1.55 s |
| declaration (with flare) | ≤ 0.435 s, unchanged length | — |
| number vs contact | ±17 ms | — |

  Check `&speed=3` too (SÜ-3: marks and sounds stay on their frames, and the shadow beats stay in sync).
- **Readability gate (own).** Film `khBoard5` and `khSummon` at 1× with no scale, and LOOK. With one
  glance at a still frame, a critic must be able to name **which** monsters are buffed (shadow + crest)
  and **by whom** (which side's lady). Run it as a blind test with an independent critic agent.
- **Sound.** Every recipe page title checked, clips ≤ −1 dBFS with 0 clipped, and the LSD notes in §6.
- **Critique.** At least 3 rounds with independent critics. Film every scenario P1/P2 and READ every PNG.

## 10. Open risks

- **`ctx.stateAt(i)` controller lookup for the aura detector.** The engine snapshot happens after the
  whole `withStats` block, so for a destroyed lady the projection at the statChange index already lacks
  her. That is fine: her bonus is in `stateAt(i)` only if the projector applies `toGraveyard` before. Verify with
  the unit test on the `khBolt` and `khKill` event lists. If it is wrong, fall back to the batch's `ctx.before`.
- **Silent badge reset in the arrival bless** (`setStats(base, false)` → roll). If `FieldView.sync`
  runs between events and re-sets the badge, the roll is cut. The fallback: no reset, and the crest
  bloom plus the "+300" pop carry the meaning.
- **The 1-px lift of another card's sprite.** It must restore the exact y. If an ally is mid-anim
  (summon finale), skip the lift (check `unit.posed` / `unit.busy`).
- **The crest beside the badge** must not overflow the screen at the board's right edge for P2 zone 4.
  If it would, place it on top of the badge instead (2 px above, centred).
- **The death converge plus the flatten fit in 1.36 s with little slack.** If measure is over, shorten
  the bird glide (390 → 300 ms) before cutting the convergence.
- **The flatten "row removal"** must stay whole-pixel and outline-clean in every frame. Draw it in
  the rig (death f5–f9 as real frames), not as a sprite scale.
- **Second-lady double beats** (arrival bless plus statChange bless) are rare and acceptable. Log them if seen.


---

## 11. Design critique fold-in (round D1, verdict needs-work) — supersedes the named sections

Accepted unless marked. The sprite-side items are already built (§12); the rest binds the cinematics stage.

| # | finding | decision |
|---|---|---|
| 1 | **[blocker]** the §0 aura detector compares `stateAt(i)` with `stateAt(i+1)` at the statChange, but the projector treats `statChange` as a no-op, so it never fires | **Accepted.** Δ is computed over the engine's `withStats` block: walk back from i to the first event after the previous statChange run (or the batch start, `ctx.before`) = `jStart`; Δ = `auraBonus(stateAt(i))` − `auraBonus(stateAt(jStart))` with the controller of each state. Claim only when Δ ≠ 0, `atk − prevAtk === Δ`, `def === prevDef`. Cross-check with a ledger `khShown: Map<uid, number>` (the crest's current count): `ledger + Δ === new bonus`. `tests/cinematics/wing_lady-aura.test.ts` runs on **recorded Director projections** (summon, battle death, bolt death, tribute, steal, two ladies, windmane +500 = not aura). The §10 "open risk" note was wrong (a destroyed lady is gone in both states) and is withdrawn. |
| 2 | arrival bless misses flipped / revived allies (the flip and soul_recall handlers `consumeAt` the paired summon) | **Accepted.** Add `registerEvent('flip', …, {priority:30})`: `await ctx.base()`, then for cause `flipSummon` the arrival bless when the unit is face-up WIND with `auraBonus > 0`. Cause `attacked`: attach the aura **silently** (3-frame crest bloom, no current, battle tempo unchanged). soul_recall: an observer fallback — a WIND unit added from the graveyard with `auraBonus > 0` and no `khWing` aura gets a non-blocking "late bless" (one current + crest bloom, ≤ 400 ms) at batch end. Scenarios `khFlipAlly`, `khReviveAlly`, `khAttackedFlip`. |
| 3 | the 30×7 ink wing shadow hides under the 29×13 drop shadow; the floor is dark slate, not grey stone | **Accepted (light, not shadow).** The persistent marker is a **wing-shaped floor LIGHT**: stepped gold2/gold3, 36×9 px (wider than the drop shadow so both wingtips clearly pass it), a gold4 1-px leading edge on the top-left side, in the light layer under the unit; it beats with her idle f7 (the sprite's breath peak is built at f7, §12). Verify with a 1× clip of `khBoard5` with a WIND unit next to shade_assassin's dark card. |
| 4 | the travelling floor shadow is in four moments (shade_assassin's language); the closed feather teardrop + glide-away is close to C3 | **Accepted.** The travelling shape appears **once**, in the death, and it is light-rimmed and airborne. Summon opener: a sunlit wing-shaped gap of floor LIGHT sweeps in ahead of her (no "shadow first"). Attack: no racing shadow (the normal drop shadow suffices). Unbless: the floor lights fold and fade on the spot toward her (no gliding shadows). **Death = "Düşen Pelerin" (the falling cape)**: struck, both wings drop over her like a falling cape, she falls forward flat (built: death f2–f9). On the break frame her outline lifts off as a **gold-rimmed bird silhouette** (gold2 rim, night0 fill) that flies **up and back** to the graveyard pile at hover height — never along the floor. **Proposed §5.2 row:** `Kanat Hanımı \| kanatları pelerin gibi üstüne düşer, yüzüstü yere kapanır; altın kenarlı bir kuş silüeti üstünden kalkıp mezarlığa uçar`. |
| 5 | summon path ambiguous / off-board on the iso grid | **Accepted.** Start = `isoToScreen(col − 2.5, row)` lifted 30 px (P2: `col + 2.5`), i.e. along her own lane row from its low-index end, clamped to the platform's inner edge (zone 0: start at the board corner). Film `khSummon` for zones 0 / 2 / 4, P1 and P2, to confirm she never crosses the HUD. |
| 6 | crest beside the DEF number | **Accepted.** Crest 9×5 directly **above the ATK digits**, 1 px above the plate, centred on the ATK half; a second lady stacks a second pair 2 px higher. Lock / freeze slot stays on the left edge. Checked against P2 zone 4 and hourglass_imp's marker on the same unit. |
| 7 | summon + bless ≈ 2.8 s scene, over an ace tribute | **Accepted.** The salute (summon f11, built) *is* the special's charge: when the bless directly follows her own summon, skip special f0–f3 and launch the currents from the salute's jewel flare (≈ 1250 ms). Two backwing beats in the cinematic, not three. Target ≤ 2.4 s scene for summon + bless with k = 2; measure row `khSummon total`. The invented "normal summon ≤ 2.3 s" line is withdrawn. |
| 8 | revive duplicates soul_recall's graveyard trip and overruns 2.1 s | **Accepted (built).** No graveyard glide. revive f0 = the fallen cape lying on the tile (soul_recall's ghost melts into it), f1–f4 rise, **land at f5 ≈ 450 ms**, wings burst to the V. `khReviveGather` rides the ghost's descent. Revive total incl. a bless ≤ 2.1 s scene. |
| 9 | the 4-px "skip" lift over a non-WIND tile reads as touching it | **Accepted.** Currents run along the **back edge of the lane row** at `DEPTH.TILE_FX` (under every unit), behind any sprite they pass, and surface only at the buffed ally's tile, curling forward into the marker. The skipped monster gets a 1-frame "nothing" cue. |
| 10 | sound overlaps (magusCall formant chord; khFold vs C11 3 kHz; E5 = C4's 660 Hz; khSkid between C9 / R3) | **Accepted.** magusCall and the C4 / C11 recipes join the LSD gate. Her voices stay ≥ an octave above the magus with a bright "aa" formant (F2 ≥ 1150 Hz). `khFold` → a low feather fold "fwump" (pink lp 900 Hz, 60 ms). `khSkid` → a 1.9 kHz blade scrape matching her clank. `khDirectCry` on **C#5**. (`khFold` now plays on the cape drop, death f2.) |
| 11 | blocked attack = storm_hawk's beat | **Accepted.** The clap brackets fail to close (bend outward on the guard); she **perches** for one beat on top of the defender (feet on its top edge, wings up), then kicks off backwards (the recoil; the defender gets a 1-px push down) and flaps home. Sound `khSkid` + a talon "tok". Poses reuse attack f7 (wings up) and f8 (back-flap); a perch pose is a cinematic hold of attack f7 with the feet planted. |
| 12 | guard and death wrap repeat crystal_wyrm's wing-wrap | **Accepted (built).** Guard "Kanat Kalkanı" is **asymmetric**: the near wing swung forward over the shoulder as a buckler (primaries fanned down in front of the chest), the sword in parry across the body in front of it, the far wing still up in the V. The death has no wrap (finding 4). |
| 13 | event-flow notes | **Accepted.** (1) No `'field'` branch in the summon hook; a flip accent, if wanted, is a `'flip'` card hook. (2) On flip / revive paths `khSong` starts only in the bless, and `voice.roar` is muted when a bless follows (check `ctx.events` for a following aura statChange). (3) Inside a battle (a `battle` before i) the bless is compact: no special anim, a 3-frame crest bloom, one chord voice, ≤ 300 ms. (4) No silent badge reset; the bless is carried by the crest, the "+300" pop and the chord. |
| 14 | missing scenarios / marker interplay | **Accepted.** Add `khFreezeMix` (p1 hourglass freezes a buffed p0 hawk: floor light, crest, lock and collar on one unit at 1×), `khChasm` (bless then death and unbless), `khDefAlly` (WIND ally in DEF: the crest still sits on ATK), `khSweep` (mass removal of lady + ally; both auras dispose). The "+300" pop is a **white** number in the existing style plus the gold crest — never gold text (windmane's chip is gold). |

**Rejected:** none. **Doc sections superseded:** §0 detector code and the summon wrapper coverage (→ 1, 2), §4.1 opener and path (→ 4, 5, 7), §4.3 current routing and durations (→ 7, 9), §4.4 reset (→ 13), §4.5 wing shadow and crest position (→ 3, 6), §4.6 gliding shadows (→ 4), §4.7 racing shadow and blocked table (→ 4, 11), §4.8 guard (→ 12), §4.9 death (→ 4), §4.10 revive (→ 8), §6.1 khFold / khSkid / khDirectCry (→ 10), §8 scenario list (→ 2, 14), §10 first bullet (→ 1).

## 12. Build log (art stage, 2026-10-31)

**Built (new files, owned by this card):**

| what | path | notes |
|---|---|---|
| sprite shell | `src/art/monsters-v3/wing_lady.ts` | drafted as `_wing_lady.ts`, renamed after the gates passed — **registered in v3 now** (no exclusion entry needed). Distinction header in the shell. |
| rig | `src/art/monsters-v3/wing_lady-rig.ts` | 84×72, AX 36, GY 68, hover 0. Body-local parts moved (bx, by) and rotated (rot about the hips or the feet) as geometry before raster. Wings: a parametric span (root → wrist → pointed kestrel tip) with flat chord bands (lesser coverts earth4, greater coverts earth3, flight feathers earth2, slate primaries night3 / night2), whole-pixel serrated trailing edge, two 4-connected slate bars, a 3-px lit plane toward the key light and a 2-px shade plane away from it. Legs / torso / sword: tubes and polygons with flat planes from their own edges; arms flat (skin2 in P1, skin3 in P2: the near arm faces away from the light). Head: four hand maps (calm, sing, struck, closed), whole-pixel rotated only with the body. Braid (night1 plait with night2 links, gold tie), two-tailed sash knot (mist / steel, white lit top). One `outline(ink)`; jewel (leaf4 core, gold4 setting, 3-px cross on flare) and one blade glint after it. A floor cut erases anything rotated below the sole line; `cleanCrumbs` + a one-pass despeckle keep IŞ-10 noise ≈ 6 %. |
| anims | `src/art/monsters-v3/wing_lady-anims.ts` | 13 anims / **121 frames** (idle 16, guard 6, toGuard 6, fromGuard 5, attack 12, special 12, roar 10, hit 6, hitHeavy 7, hitMagic 7, summon 13, death 10, revive 11) = 2.93 MB (medium class). Marks: attack charge 1 / release = impact 5 / contact 6 / recover 8; special 1 / 4 / 4 / 8; roar 1 / 3 / 3 / 5; summon land 7; revive land 5 (≈ 450 ms); death impact = contact 0, dissolve 4. Holds follow §1 except: attack `[70,110,100,200,130,50,60,80,110,120,130,150]` (a longer kestrel hover hold; also breaks a rhythm match with seal_arm_l / shield_titan), hit `[50,70,150,110,120,130]`, roar / special recovery made non-shortening (HA-3). |
| card art | `src/art/cardart-v3/wing_lady.ts` | WIND backdrop (gust arcs over the head); the rig in a salute pose (wings high in a V, the blade rising in front of the brow); small = 1× hand crop (14, 3, 44×34; focus 25,18 = the jewel); big = EPX of the same crop + fresh ink + leaf3 rim + jewel in the light layer; 4 living frames × 160 ms (braid / sash travel, wings breathe one step). Stats: big 19 colours, isolated 0.9 %, fill 0.71; small 19 colours, isolated 3.7 %, fill 0.73, focus ok. `portrait()` wired. The critique's floor-light tell (finding 3) is not painted in the card (the gust arcs are the light shape; one light per card). |
| test | `tests/art/wing_lady.test.ts` | 9 tests pass: marks / holds, validateArt normal (0 errors), registered + ≤ 140 f + ≤ 3.6 MB, determinism + P2 silhouette + 2-px margins on all 121 frames, no cyan / crim / teal / mag and ≤ 20 colours on every frame, **hover head lock** (attack f2 vs f3 head block pixel-identical), one lit jewel at rest / dark in death, the falling-cape ending (flat ≤ 14 px tall, head forward, wing tones over the body, the cape below the head on f2), card art budgets. |

**Shared one-liner edited:** `src/view/light/profiles.ts` `MONSTER_GLOW.wing_lady` → `{ emissive: [T(PAL.leaf4, 1), T(PAL.gold4, 0.6)], halo: 0.5, pool: 0.8, spill: PAL.leaf3 }` (teal and white removed: teal is forbidden, white is the sash / glint). **Not touched yet** (cinematics stage): `DEATH_PRESETS` (still `{material:'light', accent:'plant'}` → `{ material: 'light', accent: 'light' }`), the sound file, scenarios, cinematics.

**Pose story as built** (frame numbers for the cinematics):
- idle: wing breath peaks at **f7** (the aura's beat), primaries lag a frame, coverts ripple twice, braid / sash half a loop apart, head drops 1 px f11–f12, blade glint f8–f10, jewel dims f10–f15.
- attack: f1 crouch, wings lifted, blade drawn back · **f2 / f3 hover** (wings down / up, body 5 px up, head pixel-identical) · f4 swept-back fold, blade forward · f5 stoop (rot 34°) · f6 the **clap**: near wing forward-low, far wing forward-high, curling toward each other like brackets, blade thrust · f7 rebound, wings wide · f8–f9 back-flaps · f10 touch down.
- special: f1–f3 wings up, blade overhead tip-up, jewel to flare · **f4 full downstroke** (release) · f5 · f6–f7 salute (blade flat at the brow, singing face) · settle.
- roar: f1–f2 gather (eyes shut, chin down) · **f3** head back singing, near wing flung wide back, far wing tall, jewel cross · settle.
- summon: f0–f1 horizontal glide (head level, wings spread, sword tucked) · f2–f3 brake-flare (tall W, body upright) · f4–f6 backwing beats · **f7 land** (front toe) · f8 back foot · f9 wings snap-fold · f10 blade up · **f11 salute** (jewel flare; the special's charge when the bless follows, critique 7).
- guard: asymmetric buckler (critique 12); toGuard raises the near wing straight up behind the head, then sweeps it forward over the shoulder.
- hit / hitHeavy / hitMagic: f0 kept local (KK-4); hitHeavy f2 the near wing braces down to the floor like a crutch; hitMagic f1–f2 the wings snap shut, jewel blinks out.
- death "Düşen Pelerin": f0 struck · f1 staggers back, wings flung · **f2 both wings fall over her like a cape**, jewel dark · f3 the knees go · f4 (dissolve) tips forward · f5–f7 falls flat forward (pivot on the feet) · f8–f9 the cape settles over her. The bird outline lift-off is cinematic work (critique 4).
- revive: f0 = the fallen cape on the tile · f1–f3 the fall reversed · f4 kneels up · **f5 land**: the wings burst to a wide V, jewel cross · settle.

**Points:** muzzle = grip = sword tip, hand = sword hand, head = jewel, core = chest, staff = near wingtip, claw = far wingtip, feet = between the soles. `attackImpactFrame` 5 = attack release.

**Gates / evidence** (all under `shots/v3/kart-f/wing_lady/build/`, gitignored):
- sheets: `sheet/wing_lady-file-all.png` (P1) and `sheet-p2/wing_lady-file-p2-all.png` (P2 relight) + per-anim strips; close-ups from the iteration rounds in `s1/` (base figure), `s2/` (first full pass: `attack-a/b`, `summon-a/b`, `death-a/b`, `guard-a`, `hits`, `rs`), `s3/` (death fix, clap fix, `iso.png` noise map), `p1p2.png` (idle / attack / guard / death key frames, P1 and P2).
- `gates.txt` — `monster-gates … --class medium --ref none`: **24 rows, 21 ok, 0 FAIL** (Sİ-2 margin 2; HA-14 out 0.00; HA-15 in ≤ 1.0; HA-16 idle 0.54 / guard 0.84; HA-17 1.69; HA-18 16.6 % P1 / 15.5 % P2; HA-19 0.51; HA-20 toGuard 390 ms / fromGuard 330 ms; IŞ-10 idle 5.8 %, body ≤ 10.3 %, effect ≤ 8.8 %; HA-21 local 24–44 %, phase ≤ 49 %; HA-9 feet fixed in 33/33 frames; IŞ-1 P1 idle +34, P2 relight > mirror on all keys; KK-13 121 f, 2.0 ms/frame, 2.93 MB).
- `sameness/sameness.txt` — **KEY green against every card** (max 0.43 vs mudgrasp). No KALIR verdict. UYARI (all out of plan): MOTloop vs shade_assassin 0.90 (idle loop proxy, "KALIR line reached out of plan → blind eye test"); MOTsig vs abyss_magus 0.71 (attack points), steel_silencer 0.68, shield_titan 0.63, seal_leg_l 0.61 and several 0.55–0.59; RHYTHM same in attack vs seal_head / seal_arm_r / hourglass_imp and in idle vs ashen_drake / steel_silencer / seal_leg_l. The distinction header is in the shell; a blind eye test is owed.
- board scale: `board.png` (`?dev=monster&mode=board`, P1 + P2 on tiles); in game with placeholder cinematics: `m1Aura.png` (film) and `m1Aura-clip.png` (×3 clip at the end: she reads beside the hawk and the wolf, the hawk at 1300).
- card art: `card.png` (big ×4 | small ×8 | small ×1 | 16×12 mini ×6); in-game faces `card-face.png` (hand card, inspect card, field minis).
- iterations (look → fix): sash read as a second blade → two-tailed knot; far wing read as a hood → kept behind / tall, never forward; jewel erased by crumb cleanup → repainted by position; 1-px tube shading and diagonal bars → 2-px planes, 4-connected bars, despeckle (noise 13.6 % → 5.8 %); P1 light bias −8 → +34 (deeper wing lit plane, the near arm in shade); idle liveliness 13 % → 16.6 % with HA-17 ≤ 1.7; hit / death f0 kept local (HA-21 phase 99 % → ≤ 49 %); the prone death cleaned (sash / braid on the floor, arms along the body, floor cut); neck shortened 1 px after the board-scale look.

**Known weaknesses (next round):**
- The wings are flat paddles at 3×: the band structure (coverts / flights / slate primaries) reads, but there is no separate primary "fingering" and the wrist bend is subtle; at 1× they read as a warm V, which is what matters most.
- The face is a 8×9 map: profile, eye, circlet and jewel read; at 1× the head is small next to the wings.
- Attack f6 (the clap) reads as two curved wing shapes ahead of her, but the "brackets" are only clear at ×3; the cinematic's gold arcs must carry it at 1×.
- The guard's buckler wing covers the bodice as a beige mass; the sword in parry shows only its tip above the wing.
- Death f4–f5 (tipping forward under the cape) are busy; the prone end frames read as a low warm mound with a dark head at the front.
- MOTloop UYARI vs shade_assassin (idle) needs the blind eye test; MOTsig vs abyss_magus (attack) 0.71.
- `tests/art/cardface-v3.test.ts` G1 fails on `scrap_raiders` (not this card).

## 13. Build log (cinematics + sound stage, 2026-11-01 → 2026-11-05)

**Files (owned by this card):** `src/cinematics/kart-f/wing_lady.ts` (summon hook p20, the aura `statChange`
handler p25, the arrival `summon` wrapper p30, the `flip` wrapper p30, the `attackDeclare` crest flare p25, the strike,
the `destroyed` hook p20, the aura observer — every registration `if (LOOK_V3)`, names `kart-f:wing_lady:<part>`),
`kart-f/wing_lady-aura.ts` (exports only: floor-light + crest painters, `wingAura`), `kart-f/wing_lady-rules.ts`
(pure engine reading: `auraDelta` over the `withStats` block, critique #1), `src/audio/v3/wing_lady.ts` (27 recipes,
`WING_LADY_VOICE` set with every required role incl. the revive pair), `src/duel/scenarios/wing_lady.ts` (29 `kh*`
keys), `tests/cinematics/wing_lady-aura.test.ts`. Shared one-liners: `DEATH_PRESETS.wing_lady = {material:'light',
accent:'light'}` (the plant accent is gone), `MONSTER_GLOW.wing_lady` leaf4/gold4 (art stage).

**How the effect surfaces (no activate event):** the +300s are `statChange` events in the engine's `withStats` diff.
`auraDelta` reads Δ`auraBonus` across the block (projection-safe) and only aura-caused events are claimed; anything else
(the knight's +500, equips) goes to `ctx.base()`. Her own summon plays **Kanat Selamı** inside the summon hook (no
sync between); a flip plays it from the `flip` wrapper; an ally arriving buffed (no event) gets the **arrival bless**
from the `summon` / `flip` wrappers; the loss (**Kanatlar Döner**) folds the lights toward her tile / her graveyard;
her own death takes the loss run into the falling cape (f4). The persistent aura `khWing` (gold wing floor light +
crest pair over ATK, one pair per lady) is born only by a bless beat; the observer removes stale auras and restores
steady state after a rebuild.

**Camera base:** `shots/v3/kart-f/wing_lady/camera-base.json` (measured on the placeholder presentation, 27 keys).

**Rounds r1–r4 (2026-11-01, before the pause):** films in `shots/v3/kart-f/wing_lady/r1..r4/`; v1 filmdiff 17/17 and
a6v1 26/26 IDENTICAL then (`gates/filmdiff-*.txt`); clips `clips/khSummon|khKill|khAttack`.

**Round r5 (2026-11-05, after the main merge; arena readability):** evidence `shots/v3/kart-f/wing_lady/r5/`.
- Filmed every scenario P1 + P2 (`khSummon[P2|Alone|Edge]`, `khEffect[P2]`, `khArrive[P2]`, `khFlip`, `khAttack[P2]`,
  `khAttackLose` (new), `khDirect[P2]`, `khBlocked[P2]`, `khBuffAtk`, `khGuard[P2]`, `khKill[P2|Alone]`, `khBolt`,
  `khTribute`, `khRevive[P2]`, `khBoard5`) and looked at each; close-ups `khSummon-clip/-late/-b`, `khKill-bird/-lift/-lift2`,
  `khBlocked-perch`, `khBoard5-zoom/-zoom2`.
- Fixes from the look:
  1. **Death bird hidden under her own card** (it opened on the tile while the card was born there): the bird layer now
     sits above the card (FX+40), opens 5 px/frame higher; the silhouette was a thin 47-px gold line → a chunky kestrel
     (5-px inner wing, wrist bend, three primary fingers, body, head, fanned tail; night1 fill, gold rim), 35 px span;
     flight 460 → 400 ms (`khKill-lift2.png`).
  2. **Attacker-loses** (new `khAttackLose`): she used to snap home from the contact point before dying; now she falls
     where she struck (a save sends her home 900 ms later) and the bird lifts from her body, not her tile.
  3. **Perch hovered ~8 px above the defender** (idle-top vs guard-top + her f7 soles 4 px above the anchor): +10 px,
     she now stands on the sentinel's head (`khBlocked-perch.png`).
  4. **Floor light murky at 1×** under the 50 % drop shadow: aura floor layer moved to `DEPTH.SHADOW + 1` (still under
     every body) — the gold wing now reads under every buffed ally (`khBoard5-zoom2.png`).
  5. **Budgets:** direct was 2450 ms game (> 2.32 s): stoop 280 → 240, the carried-back arc 420 → 340 → **2283**.
     Summon + bless 3333 → **3083** game (brake at timeScale 1.25, run-out/fold at 1.6 after the land frame).
- **Measure** `r5/measure-final.json`, camera gate vs the base: **28 ok, 1 NOBASE (khAttackLose), 0 FAIL**; zoom 1,
  0 close-ups, focusCalls = base everywhere. Game-clock: attack 2600 (≤ 3190), direct 2283 (≤ 2320), blocked 2700,
  death 1750 (≤ 2030), summon+bless k=2 3083 (≈ 2.28 s scene ≤ 2.4), alone 2200, Kanat Selamı on revive 1600 (≤ 2320),
  arrival 2483 incl. the hawk's own entrance, number-after-contact 0 ms, 0 errors.
- **Sound:** clips `r5/clips/{khSummon,khKill,khAttack,khBlocked,khDirect,khRevive}.{mp4,wav,json}`: peaks −1.83 …
  −4.9 dBFS, 0 clipped; every beat fires on its frame (the sfx lists: glide/3 wing beats/land/toe/song/currents/bless
  chord; songBreak/fold/flatten/unbless/peel/fallThud/birdFlight; hover/stoop/clap|skid+perch+kickOff|directCry/
  back-flaps/toe). Audio pages `r5/audio-khBirdFlight.png`, `r5/audio-khUnbless.png` (+ r1 `audio/`): titles correct.
- tsc clean; `tests/art/wing_lady.test.ts` + `tests/cinematics/wing_lady-aura.test.ts` 14/14.
- v1 safety: `filmdiff --set v1` **17/17 IDENTICAL** after r5 (`r5/filmdiff-v1.txt`); a6v1 not re-run in r5 (26/26 in r4).

**Known weaknesses (for the critique rounds):**
- `khSummon` stages her at zone 2 right in front of the big ember_wolf: her body is half hidden by the wolf during the
  salute (scenario staging; the 3-zone `khEffect` reads cleanly).
- The arrival bless keeps the ally's badge on its already-buffed number (critique #13: no silent reset); the "+300"
  chip, the crest bloom and the chord voice carry it, but there is no visible roll.
- The bird reaches the pile ~200 ms after her card lands (by design, but it reads as trailing).
- `khBirdFlight` is quiet (−21 dB peak on its page); `khRevive` replays `khSong` in the bless (her song after the
  revive's own land note) — acceptable, but the ear hears two onsets.
- The guard buckler and the hit poses are unchanged from the art stage (see §12 weaknesses).
- No numpy LSD separation run yet (§6 offline checks); no independent critic round yet (0/3).

## Round 1 (craft fix, 2026-11-05) — critic r1-craft (verdict needs-work)

Evidence: `shots/v3/kart-f/wing_lady/fix1/` (gitignored). Sprite close-ups were rendered with a scratch frame viewer
(`v-idle.png`, `v-att.png`, `v-g.png`, `v-s.png`, `v-h.png`, `v-d.png`); sheets `s2/` (P1) and `s2-p2/` (P2 relight);
in-game films are named after the scenario. Everything listed was looked at.

| # | sev | finding | what I did | evidence |
|---|---|---|---|---|
| 1 | high | attack: clap → upright rebound in one frame with a 10–20 px jump | Attack 12 → **14 frames**: two recoil in-betweens after the clap, **f7 "open"** (the brackets spring outward, the torso unrolls head-first, the blade still out) and **f8 "sweep"** (wings level and spread, tips separate, body upright). The rebound is old f7, now f9; the back-flaps are f10–f11 and the touch-down is f12. Marks: contact 6, recover 8 → **10**. Holds `[70,110,100,200,130,50,60,50,50,80,110,120,130,150]`. In `kestrel()` the rebound offset (8 back, 4 up) is now a 170 ms Quad.Out tween **from the contact frame**, and the pose steps open → sweep → rebound inside the same tween, so position and pose change together. The direct attack's burst uses the same chain inside its arc. | `khAttack-contact.png` (17-ms steps: clap 1254–1390, open 1407–1424, sweep and rebound moving 1441–1475), `khAttackP2.png`, `khDirect.png` (#9 → #11) |
| 2 | high | blocked: teleport back, a static hold, then a hop | The back-snap came from the **battle's generic attacker recoil**. `battle.ts recoilAfterStop` claims her animation on the contact frame and plays `hit`, and her `hit` body sits about 10 px behind the clap frame's body. On the contact frame a **stand-in image of her own frames** now carries the beat while the claimed sprite plays the recoil hidden underneath (the kite_fencer pattern). The stand-in stays on the guard in the **open** pose (the brackets bend outward) with a 1-px shiver for 3 frames, dips 2 px (sweep), and rises along a short arc from the contact point onto the defender's head (rebound pose from 35 % of the arc). She plants with a **1-px squash frame**, perches 90 ms, then the sprite is hers again (unclaim) for the kick-off and the flap home. | `khBlocked-contact.png` (no jump at 1310 → 1330: the clap holds, then the open pose stays in contact), `khBlocked-late.png` (dip, arc, perch on the head) |
| 3 | high | the clap frame does not read (sack + hat; blade not visible) | f6 redrawn. Both wings are drawn **behind the torso** (new `Pose.nearBack`), so the body stays clear. The **far wing arcs high** ahead of her face and curls down; the **near wing arcs low** under the sword arm and curls up. The tips are separate and end ahead of the body, with background between each wing and the arm or torso. The blade is a **straight thrust ahead of the chest** with the white point and the cross glint. | `v-att.png` (f6), `khAttack-contact.png` |
| 4 | high | the sash reads as a second blade; the sword reads as a leg stripe | Sash: two **1-px tails** (mist long, steel short) with a 1-px knot. They taper and curl (curl ±30–40°, wave amplitude +0.8). The **one white highlight** is on the long tail. Sword: idle `sa` 96 → **56** and `gx` 42 → 44, so it angles forward away from the thigh with a **1-px background gap**. The leaf blade is wider (half-width 2) in mist with a steel shade edge; the fuller line is gone. A **white point pixel** is added after despeckle, so it survives at 1×. | `v-idle.png`, `khBoard5.png` (2×) |
| 5 | high | guard: the generic cyan hex shield; no flinch | New `'defend'` card hook (p20, `kart-f:wing_lady:guard`, defense only). On `v3:contact` it **hides the shared hex glint** (the ADD raster at body depth + 0.5) and the **blockClang hex plate** (graphics at `DEPTH.FX + 0.1/0.2`, the reed_heron precedent). It then draws her own **gold feather-edge spark** along the buckler's leading edge (gold4 → gold3 → gold2 over 3 frames, plus 3 dashes thrown back). Pose answer: `MonsterUnit.brace` plays toGuard f4 → f3 → f4 → guard on a blocked blow, so **toGuard f3 is now the buckler bending under the blow** (shoulders rocked back, knees give) and **f4 is the buckler flaring** (primaries fanned 2 px wider), then guard. The feet stay fixed (HA-9). The buckler itself is redrawn: the near wing's arm lies across the waist with its hand dropping forward, and the primaries fan down as **separate points**. The **parry blade crosses in front with its whole length clear** (up-forward from the fist, `sa` −62). | `v-g.png`, `khGuard.png`, `khGuard-contact.png` |
| 6 | high | the card art is a small crop on an empty field | **Rewritten as a native close portrait.** The small art (44×34) is hand-painted at card density: a profile face map (≈ 16 px, hair with a lit crown, gold circlet, the eye, brow, nose, lips, chin). It also has a raised kestrel wing with a wrist peak, banded coverts, a slate hand with finger gaps and barring dashes, sweeping out of the top-left; the far wing out of the top; the braid; the bodice with gold trim; and the leaf blade upright in front of her face (white point) over a gold guard and fist. There is no rectangle: a painted dusk ground (stepped night1 / night2 / leaf0 / leaf1 bands, a low gold1 sun behind her shoulder, three thick 2-px leaf2 wind swooshes open toward her gaze, 6 backdrop colours), a gold2 sunlit rim on the upper shadow-side edges, and the jewel in the light layer. Big = EPX of the small, re-inked. Test change (my file): `subjectFill ≤ 0.75` → `subjectCover ≤ 0.85` (a portrait that bleeds off two edges, like crystal_wyrm whose fill is 0.93 / 0.88). | `card-art.png` (big ×4, small ×8, ×2, ×1, the 16×12 mini), `card-face.png` (`?dev=hatcard` ×3: hand card, inspect card, field minis) |
| 7 | high | summon beats are a two-pose flipbook | Summon 13 → **16 frames**: three beats over six frames (f4–f9: mid, down, mid, up, mid, down). The **mid** in-betweens show both wings level and spread with the far wing a separate higher tip. On the downstroke the far wing curls up behind as a separate slate tip. The **body bobs** (by −6 → −8 on the down, −5 → −3 sinking on the up). The braid and sash answer a frame late (th / flick). The brake-flare wings are moved back (wn −112, wf −86 with the tips swept back) so the face stays clear. Land mark 7 → **10**; the cinematic reads the land mark and puts the salute at land + 4. Six per-frame floor lifts (10, 8, 6, 5, 3, 1). Beat sounds on the two downstrokes (0.8 / 0.6) and the upstroke (0.55); crescents on the downstrokes. | `v-s.png`, `khSummon.png` |
| 8 | high | summon depth pop over a neighbour | The glide already keeps her at `DEPTH.FX − 6` until the land frame, then hands her to the unit depth on the land contact. The pop was a **staging** problem: the big wolf stood in the lane in front of her. `khSummon` / `khSummonP2` restaged: the lane in front of her is empty, and the FIRE wolf now stands **behind** her, under her glide-in, so she lands in front of it. The current still passes the wolf to reach the hawk. | `khSummon.png` (she lands and salutes in front of everything) |
| 9 | medium | death cape = a turtle shell; static prone; body cut; flat bird | Cape frames f2–f5: two **long, narrow wings draped over the shoulders** (the near one over her side, the far one trailing behind), with the primaries reaching the floor as separate slate points. Prone hold: one last **jewel flicker** (leaf3, 2 frames on f8), and the sprite's prone frames already settle the primaries. Lift-off: the bird now **rises off her back while the body darkens into the floor** in palette steps (tint night2 → night1 → night0 → gone over 4 frames, no cut). The **card is born only on the bird's 3rd frame**, so the bird leaves the body, not the card. The bird has a **two-tone body** (a night2 band along the lit top edge over the night1 fill) and 4 flap poses in flight. | `v-d.png`, `khKill.png`, `khKill-lift.png` |
| 10 | medium | flat paddle wings, blotchy bars, bright bodice, stick arm, wing-only idle | Wing raster: **3 primary fingers** cut as 1-px gaps from the trailing edge; the primaries' trailing edge is smooth (no serration on them); a lit **alula** corner at the wrist; the barring is now **two staggered rows of short slate dashes along the feathers' run**, evenly spaced and all the same length (no blobs). Bodice: **leaf1 front, leaf2 plane, leaf0 shade, leaf3 only as a 1-px lit edge on the bust**. Near arm: a **3-px forearm** with lit and shade planes and a 1-step darker elbow. Idle: the **chest rises 1 px** through the breath (f4–f10, the head lagging a frame each way), the 1-px "listening" dip at f13, braid amplitude 2 → 2.4. idleΔ 151 → **174** (HA-17 1.53, HA-18 17.9 %). | `v-idle.png`, `s2/wing_lady-v3-idle.png`, `gates.txt` |
| 11 | medium | the hit barely reacts; the hitHeavy blade goes forward | hit f1–f2: the torso snaps **2–3 px back from the hips**, the head tips back (hr −8 / −10), the **eyes close**, and the wings flare (len +2, chord +1). f3 overshoots forward (lean +1) and the wings come down. The feet stay planted. f0 stays local (HA-21 phase 38 %). hitHeavy f1–f2: the sword arm is **pulled back and down** (a defensive flinch), eyes shut. | `v-h.png`, `gates.txt` |
| 12 | medium | the stoop is a broken hip; blade down; hollow braid | f5 is now one **streamlined line**: rot 64° with the legs trailing straight behind (ankles together) and the head up along the flight line (hr −50). The **blade points ahead** (screen angle ≈ 12°), with the arm reaching forward. The wings are swept back flat (wn 140, wf 132). The braid is now a **solid 2-px night2 plait with night1 links** in every anim (no hollow outline against the floor). | `v-att.png` (f5), `khAttack.png` #4–#8 |
| 13 | low | dithered gold materialisation | `holoOnset` (the scan / dither hologram) replaced with her own `goldOnset`: the glide frame appears as a **solid gold silhouette** (`setTintFill`) stepping gold4 → gold3 → gold2, one palette step per 50 ms, then her own colours. | `khSummon.png` #1–#3 |

**Gates after the fix:**
- `monster-gates --class medium --ref none`: **24 rows, 21 ok, 0 FAIL** (`fix1/gates.txt`). 126 frames, 3.05 MB. HA-14 out 0.00. HA-17 1.53. HA-18 17.9 % / 17.4 %. HA-19 0.47. HA-21 local ≤ 36.5 %, phase ≤ 49.2 % (hitMagic f0 retuned: chest −1, wings toward the idle mid). IŞ-10 idle 6.9 %, body ≤ 10.6 %, effect ≤ 9.7 %.
- Sameness (`fix1/sameness.txt`): **KEY green against every card**. Worst UYARI, the same class as before, and no KALIR. MOTloop vs shade_assassin is 0.865, down from 0.90. Out-of-plan MOTloop vs windmane_knight is 0.91. Several MOTsig values are between 0.59 and 0.67. The blind eye test is still owed.
- Tests: `tests/art/wing_lady.test.ts` + `tests/cinematics/wing_lady-aura.test.ts` **14/14**. The test now pins attack recover 10 and summon land 10, and checks the card subject cover. tsc is clean on this card's files.

- Measure + camera gate (`fix1/measure.json`, `fix1/measure-direct.json`) against `camera-base.json`: **10 ok, 1 NOBASE (khAttackLose), 0 FAIL**. zoom 1, no close-ups, focusCalls = base, 0 errors. Game clock:
  - attack 2600 (≤ 3190)
  - blocked 2933, up from 2700: the brackets-fail beat, the dip and the squash (≤ 3190)
  - direct **2283** (≤ 2320). The burst arc went 400 → 340 ms after the first measure read 2350.
  - guard 2550
  - summon + bless k = 2 3116, up from 3083: the three six-frame beats
  - revive 3250
  - number-after-contact 0 ms
- v1 safety: every new registration (the `'defend'` hook) is `if (LOOK_V3)`. Every other change is in v3-only art or in v3-gated cinematics. filmdiff was not re-run this round.

**Shared touches:** none. Every change is in this card's own files: rig, anims, card art, cinematics, scenarios, test.

**Still open (next rounds):**
- The big card art is EPX of the hand-painted small. It is not a native 88×68 redraw like crystal_wyrm.
- The face has a single skin plane.
- The guard spark and hex suppression rely on the shared kits' depths. The reed_heron precedent does the same.
- After the perch, the flap home still starts from just above the head (unchanged).
