# windmane_knight — Fırtına Şövalyesi (lane F design)

TOPRAK / Savaşçı · Sv7 (2 kurban) · 2300/2100 · ★ As (cut-in) · effect `summonTurnAtk500`
Card text: "Normal çağrıldığı tur saldırırken ATK +500." Draft: 2026-10-31. Status: design only (no code yet).

One line: **a heavy foot-knight who carries a sand storm in his helm's mane. On the turn he arrives
the storm is his weapon; on every other turn it is only wind.** Whatever moves on him (mane,
pennon, dust) shows the game state: a quiet stream means normal, a stream with grit and gold static
means +500, and dead stillness means death.

---

## 0. What the engine gives us (exact event flow)

Verified in `src/engine/rules.ts`, `src/engine/query.ts:228-232` and `tests/engine/monsters1.test.ts:107-155`.

- `summonTurnBonus` gives +500 only when the slot has `normalSummoned`, it is in attack position,
  `enteredTurn === s.turn`, it is the controller's turn, and the phase is `battle`. `normalSummoned`
  is set only by `summonFromHandBody` (normal or tribute summon, `rules.ts:1129`). A Set+flip or a
  soul_recall revive gives no bonus.
- **There is no `activate` event.** The bonus shows up only as `statChange` events, emitted by
  `withStats` diffs:

```
main:   tribute ×2 → summon{method:'tribute', from:'hand'}                     (ATK 2300, no stat event)
battle: enterBattle → phaseChange('battle') → statChange{uid:knight, prevAtk:2300, atk:2800}
        attack → attackDeclare → [trap window] → battle{attackerAtk:2800 (− titan 500 if it applies)} → damage/destroy…
end:    endTurn → phaseChange('end') → statChange{uid:knight, prevAtk:2800, atk:2300}   (only if the knight is still alive)
```

- The game has no Main Phase 2: battle goes straight to end. The knight cannot change position in
  battle, so these two statChanges are the only edges of the bonus.
- **Today's placeholder:** `flow/stats.ts` `statChangeV3` plays the generic green ▲ chevrons and rolls
  the badge on entering battle and again at end phase. The strike is the generic default, art is
  `_placeholder-new.ts` ('blade' totem, 80 class), the summon is the default cut-in, death is
  `DEATH_PRESETS` `'stone'` (reserved, must change).
- **Hook kinds we use:** `summon`, `attackDeclare`, the strike (`registerStrike`), `statChange`,
  `destroyed`, plus `registerObserver` for the aura's lifetime.
- **Deciding "storm on" inside the strike:**
  `summonTurnBonus(ctx.state, CARDS.windmane_knight, player, slot) > 0`, read from `engine/query`.
  `spells/_blade_v3.ts` already imports engine/query. Never derive it from `attackerAtk − 2300`:
  equips, the field spell and the titan's −500 change that number.

## 1. Concept and silhouette

- **Concept.** He is not mounted. He is a tall, heavy foot-knight in bright storm-steel plate. A great
  helm with a barred grille hides the face, and two small gold eye-points glow behind the bars. From the
  helm's crest a **huge tawny horsehair mane** streams back like a comet tail. He holds a heavy **lance**
  grounded upright, and a swallow-tail **pennon** near its tip streams the same way as the mane.
- **Reading.** Two parallel streamers (mane at head height, pennon at the lance tip) read as "wind" at
  1×, even with no effects. The mane is the identity, the storm and the effect meter at the same time.
- **Box.** Frame **104×96**, anchor (AX 46, GY 91), hover 0, `weight: 'heavy'`, `p2: 'relight'`.
- **Idle f0 bbox ≈ 64×82.** That is the body plus helm ≈ 40×66 (class 80, like magma_titan 58×64).
  The lance tip adds height and the mane adds about 22 px behind. Margins are ≥ 2 on every frame. The
  charged lunge (special f6–f8) reaches the right edge −3 with the lance couched.
- **Why it reads at 1×:**
  - A bright plate body (mist/steel) sits against a dark arena.
  - A warm, high-value mane makes a complementary orange-against-blue split, so the mane pops off the armour.
  - The vertical lance sets him apart from every other humanoid. stone_sentinel has a tower shield and
    is a blocky golem in grey stone. steel_silencer is a squat bronze/night mech with a violet slit.
    shield_titan is a wall.
  - Avoid on purpose: no glowing horizontal visor slit (both sentinel and silencer have one) and no
    bronze plate (silencer).
- **Budget (KK-13, `--class large` 5 MB).** 104×96×4 = 39,936 B per frame × **127 frames** =
  5.07 MB ≤ 5.24 MB. Frame counts:

| anim | f | ms | marks |
|---|---|---|---|
| idle (loop) | 16 | ≈1920 (holds 100–150, varied) | — |
| guard (loop) | 6 | ≈960 | — |
| toGuard / fromGuard | 6 / 5 | 360 / 330 | — |
| attack (normal "Kargı Hamlesi") | 13 | 1380 `[90,110,130,200,90,60,70,80,90,100,110,120,130]` | charge 1, release=impact 5, contact 6, recover 8 |
| special (storm "Fırtına Hücumu") | 14 | 1580 `[80,100,120,140,200,110,60,80,90,100,110,120,130,140]` | charge 1, release=impact 6, contact 7, recover 9 |
| roar ("Fırtına Çağrısı") | 11 | 1280 `[80,100,120,180,60,90,110,120,130,140,150]` | charge 1, release=impact 4, recover 6 |
| hit | 6 | 570 `[50,60,130,90,110,130]` | impact=contact 0, recover 3 (starts 240) |
| hitHeavy | 8 | 740 `[50,60,120,100,80,90,110,130]` | recover 4 (330) |
| hitMagic | 8 | 730 `[50,60,110,100,80,100,110,120]` | recover 4 (320) |
| summon | 13 | ≈1250 | land 6 |
| death | 10 | 870 `[50,60,150,70,70,80,80,90,100,120]` | impact=contact 0, dissolve 4 (330) |
| revive | 11 | ≈1200 | land 8 |

- One-shots end on idle f0 (HA-14; death exempt). `attackImpactFrame` = attack release (5).
- The special anim is the second attack. The strike chooses `attack` or `special`. Both anims carry the
  full strike marks (HA-1).
- **Points.**
  - `muzzle`/`grip` = lance tip.
  - `hand` = front gauntlet.
  - `head` = grille.
  - `core` = chest (46, 52).
  - New point name `tail` for the mane tip (the aura's strands leave from there). It is only valid if
    `MonsterPoints` allows extra names. Otherwise `muzzle`-relative constants in the fx file.

## 2. Palette (only `PAL`/`RAMPS`; ≤ 20 colours per frame)

| part | tones (dark→light) | notes |
|---|---|---|
| plate (helm, pauldrons, cuirass, greaves) | night2 · night3 · steel · mist | 4 bands. One white glint per anim (pauldron edge, light side). |
| mail / gambeson under plate | stone1 · stone2 | Seams one step darker, never ink. |
| mane (horsehair) | earth1 · earth2 · earth3 · earth4 | Tips earth4. Crease bands earth1. The strands are 2-px ribbons, never single-pixel noise. |
| trim (crest ridge, pauldron rims, gauntlet cuffs) | gold1 · gold2 | Never gold3/gold4 in the body. |
| lance | earth0 · earth1 shaft; steel · mist head | |
| pennon | earth3 · earth4 field, night2 stripe | Swallow tail. |
| **emissive** | gold3 rim, gold4 core (eye-points behind the grille) | Lights are drawn after `outline`, not outlined. |
| storm FX (aura and strikes only, not body) | gold4/white static, earth2–earth4 grit, earth1–earth3 sand wall | |

- **Never use** cyan, crim, teal or mag.
- **`MONSTER_GLOW` (shared one-liner, my own line).** Replace today's
  `[gold4, gold3, white, leaf3]` with `[T(PAL.gold4,1), T(PAL.gold3,0.7)]` and keep `halo 0.6`/`pool 0.9`.
  white is a body glint and leaf3 is foreign.

## 3. Idle — living details (16 f, ≈1.92 s, feet fixed)

- **Mane.** A travelling wave runs from the crest to the tip: 3 crests, whole-pixel, period = loop.
  - The tip ribbons flick up 1–2 px on f5 and f13 (two gust pulses, so it never looks like one sine).
  - On f9 one grit pair (earth4, 2 px) peels off the tip and drifts back, fading by palette steps over
    3 frames (drawn in the rig, inside the margin).
- **Pennon.** The swallow-tail halves alternate (overlap: one frame behind the mane wave).
- **Body.** Chest rises 1 px f0–f7, falls f8–f15. The helm lags the chest by 1 frame.
  - The front gauntlet re-grips the lance on f11–f12: knuckle shift 1 px. Rigid parts move only by
    whole pixels (IŞ-12).
- **Eyes.** The eye-points breathe: f0–f3 gold4 core, f4–f6 gold3 only (a slow blink in the storm).
- **Light layer.** A small gold3 spill under the grille. No ground pool in calm idle.
- **Storm-state overlays** (cinematic aura, not sprite) are in §4.4.

## 4. Storyboards (scene ms; game ≈ ×1.35; limits = REHBER §5)

### 4.1 Summon — "Kum Seli'nden Çıkış" (tribute ace, ≤ 3.0 s scene / 4.35 s game; plan ≈ 2.85 s)

Generic tribute streams `summon-a/tribute.ts` ≈ 600 ms first. Then `runSummon` with a v3 entrance (`noCard` from the tribute flow).

| ms | picture | sound |
|---|---|---|
| 0–600 | A **haboob front** (stepped sand wall, about 28 px tall, earth1/earth2/earth3 billows rolling whole-pixel, grit specks earth4) crosses the knight's tile from the enemy side toward his back (P1: screen right → left; P2 mirrored). It covers only the tile ±1 tile width and never makes a full-width band. | `wmkSandWall` start(), pan follows the front |
| 120–420 | Inside the wall: first the **two gold eye-points** (gold4, light layer), then the dark silhouette. Hologram ≤ 300 ms: the body is built bottom→top in its night/earth tones, already moving (summon f0–f3: walking out of the storm, one step, mane streaming at half length). | — |
| 600 | The wall has passed. Trailing grit (12 specks) blows past downwind and blinks out. | `wmkSandWall` stop(220) |
| 600–860 | summon f4–f5: the second step. The lance swings up from a carry to vertical. | — |
| 860 (land, f6) | The **lance butt is driven into the tile.** A stepped 2:1 dust ring (earth3→earth2, one ring) opens. Shake 2 px. A gold3 light pool flashes on the tile for 120 ms. | `wmkLancePlant` |
| 900–1800 | **Cut-in** band under the tile (rhythm below). On the knight, summon f7–f9: the head lifts and the mane hangs half-gathered (wind held). | cut-in eye flare plays voice.roar = `wmkStormHowl` |
| 1640 | Before the band closes (exit), summon f10–f11, **the big beat:** the mane **unfurls in one gust** from half length to full length, whip-cracks once (2-frame smear ribbon), and the pennon snaps taut. A spray of 10 grit specks flies downwind. | `wmkManeUnfurl` ("ŞAK") |
| 1800–2250 | summon f12 → idle f0. The **brew aura** starts (§4.4, level 1). | — |

- **Ending.** S.climax() fires on land for the cut-in; S.finale() at 2250.
- **Total** ≈ 600 + 2250 = **2.85 s scene**.
- **Unique.**
  - The only entrance through a horizontal sand front. Gökten dalış belongs to storm_hawk, "yerden
    tırmanma" to R2 and C10, the ash tornado to R1.
  - The eyes appear before the body.
- **Optional** (stretch, only if the total budget allows): our own `tribute` hook in which the two
  tributes are scoured into sand streams pulled into the wall, instead of the generic streams.

### 4.2 Cut-in (`src/art/cutins-v3/windmane_knight.ts`)

- **Format.** 200×144, k = 1. 6 frames, holds `[240,110,90,110,150,600]`, `p2:'relight'`,
  accent gold3, accentDark earth1.
- **Composition.** A 3/4 profile of the great helm facing right, filling the right 60 %. The barred
  grille and the two gold eye-points sit at about (150, 52), which is the `findEye` winner. f0 must hold
  the only white/gold4 pixels in the top 45 % / right 60 % (the mane has no white).
- **Frames.**
  - f0: the mane is gathered behind the crest.
  - f1–f3: the mane streams out across the whole band to the left edge in 4 ribbon layers
    (earth1–earth4), carrying grit.
  - f2: the eye flare.
  - f4: full storm, with 3 short gold4 static zigzags in the mane.
  - f5 (hold): the mane keeps streaming. Its tip ribbons alternate, rendered by hold, not by new frames.
- **Rhythm** (shared `RHYTHM` additive line in `_v3/presets.ts`): `windmane_knight: { flare: 340, slam: 410, exit: 740 }`.
  - The flare is later than the default: the mane has to sweep first, then the eyes ignite.
  - Clamps OK (exit ≤ 780, slam ≤ exit−200, flare ≤ slam−40).

### 4.3 Signature effect — "Fırtına Yükü" (the statChange 2300→2800 on entering battle; ≈ 1.44 s ≤ 1.6 s)

`registerCardHook('windmane_knight','statChange', …, {priority:20})`, only when
`ev.prevAtk < ev.atk` **and** the bonus is now on (`summonTurnBonus(stateNext…) > 0`). Otherwise
`ctx.base()`.

- **Who is affected.** Only this knight. No other unit lights or tints.
- **How it is read.**
  - The storm visibly concentrates on him.
  - His own badge rolls 2300→2800.
  - A gold "+500" chip rises from that badge with the label **"FIRTINA"** (Turkish UI text via
    `src/ui/text.ts`).

| ms | picture | sound |
|---|---|---|
| 0–160 | The brew dust ring at his feet speeds up and **contracts** toward the anchor. 1-px earth4 wind streaks start to pass behind him downwind. | `wmkStormCharge` start() (howl C3 rising) |
| 160 | roar f1–f3 (charge): the lance lifts out of the ground and rises overhead, tip to the sky. The mane **rises into a vertical spiral** around the crest (2 frames), unlike its usual horizontal stream. | — |
| 640 (roar release f4) | A **dry static bolt**: a 1-px gold4/white zigzag climbs from the dust ring up the lance to the pennon tip in 3 frames (bottom→top, whole pixels). The pennon snaps taut. The light layer flashes a gold3 pool on his tile only (stepped, 2 levels, 180 ms). | `wmkStatic` ×3 (gap 0.008), `wmkManeUnfurl` at 0.6 vol |
| 700 | Badge roll 2300→2800 (`u.setStats(…, true)`). The "+500 FIRTINA" chip (gold3 text, earth1 shadow) pops 6 px above the badge and drifts up 4 px for 600 ms. | low "VUMM" inside `wmkStormCharge` (stop 200 at 760) |
| 760–1440 | roar f5–f10 → idle f0. The mane falls back to horizontal but **longer** (the aura adds the storm tail). The aura switches to level 2. | — |

- **What it replaces.** The handler consumes nothing else. It replaces the generic chevrons for this
  event only. A grouped statChange of another monster in the same batch still goes to `flow:statChange`.
- **Robustness.** Aura state is also set by the observer (§4.4), so a skipped beat never leaves the
  wrong storm on screen.

**End phase — "Fırtına diner"** (statChange 2800→2300, same hook, down branch, ≈ 560 ms):

- The circling grit loses speed and **falls** to the tile (gravity, 3 steps).
- The streaks stop and the storm-tail strands drift off downwind and blink out.
- The badge rolls 2800→2300 in a muted earth3 flash. It is not the red debuff drain: this is a calm, not a loss.
- Sound: `wmkStormSettle`.

### 4.4 Storm aura (`setAura('fsStorm', …)`, file `kart-f/windmane_knight-storm.ts`)

| level | when | overlay (whole-pixel, palette steps, no alpha ramps) |
|---|---|---|
| 1 "brew" | summon turn, main phase (from the summon finale) | 6 grit specks (earth3/earth4) circle the tile on a 2:1 ellipse r = 22 px, period 1.6 s. Every 1.2 s one 3-px gold4 static tick flickers on the mane (1 frame). |
| 2 "storm" | battle phase of the summon turn (bonus on) | 12 specks on a tighter, faster ellipse (r 18, 0.9 s). The **storm tail**: 3–4 two-px strands extending the mane tip about 10 px further downwind, rippling. 1-px wind streaks (earth4, 6–10 px long) pass behind him every 300 ms. A static zigzag runs on the mane every 450 ms. Light layer: a stepped gold3 pool, level 1, on his tile. |
| off | end phase, turnStart, destroy/retire, control change, face-down | — |

- **Lifecycle.** A `registerObserver` reconciles the level from `ctx.stateNext` on summon / phaseChange /
  statChange / turnStart / destroy / controlChange / flip. It also re-applies after a `FieldView.sync`
  rebuild, because custom aura keys are lost on rebuild (HANDBOOK §6.5).
- **Determinism.** Speck phases are seeded from `uid*31 + turn`, so there is no module-level RNG
  (seeds.ts stays untouched).
- **EF-2.** The aura never covers more than 15 % of his silhouette.

### 4.5 Attack declaration (≤ 0.3 s scene, unchanged length)

- `attackDeclare` hook. It runs `ctx.base()` (the hold, plates, charge sound) and adds a background flare.
- **Storm on:**
  - The badge number flashes gold3 for 2 frames.
  - The aura's specks snap into a tight ring.
  - The charge sound is taken over within 320 ms by `takeCharge(u,'wmkChargeStorm')`.
- **Storm off:** no extra. The voice `charge` = `wmkCharge` is played by `declare.ts`.

### 4.6 Normal strike — "Kargı Hamlesi" (attack anim; on a monster ≈ 1.75 s ≤ 2.2 s)

| ms | picture | sound |
|---|---|---|
| 0 | `strikeStartFrame` (declaration hold = attack f3: lance couched, back foot planted, mane pulled taut) | charge continues |
| 0–200 | f3 hold → f4: the weight shifts forward | — |
| 290 (release f5) | **Lunge:** two heavy foot-steps toward the target (a dust puff on each footfall, earth2/earth3, 3 px). The body travels in 220 ms, with a short mane-smear ribbon behind. | `wmkLunge` (stop charge) |
| 510 (contact f6) | The lance tip hits the target core. The pennon wraps forward around the shaft (inertia). Heavy hit-stop (≈110 ms). Number on contact. | `wmkThrust` + struck material |
| 620–1000 | f7–f8: he pulls the lance back and the pennon unwraps. Target reaction / death +150 ms in parallel. | — |
| 1000–1380 | f9–f12: he walks back home (two steps) → idle f0 | — |

- **Direct** (≈ 1.35 s ≤ 1.6): the same, aimed at `toGround` near the podium.
  - The thrust ends in the floor point, with a dust burst and LP shake through the default.
  - The return starts 80 ms sooner.
- **Blocked** (DEF ≥ ATK):
  - On contact the lance **bows** for 1 frame (drawn as a fx overlay of the shaft).
  - Steel sparks (mist/white, 4 px) skid along the defender's guard.
  - The pennon snaps forward and he is shoved back 6 px.
  - Hit-stop 90 ms. Sound: `wmkBlocked`.

### 4.7 Storm strike — "Fırtına Hücumu" (special anim; on a monster ≈ 2.05 s ≤ 2.2 s; summon turn only)

| ms | picture | sound |
|---|---|---|
| 0 | Start from the declaration hold mapped to special f1 (the same couch silhouette) | `wmkChargeStorm` (held) |
| 0–440 | f1–f3: **the lance spins once overhead** (3 whole-pixel angles). The mane explodes upward into a spiral. The aura ring tightens into a knee-high dust devil (12 specks → 2 whirling bands). | — |
| 440–640 (f4 hold 200) | Couched, body low, the mane streams **double length**: the aura tail plus a sprite ribbon, so the silhouette doubles. A static bolt runs along the lance (gold4). Behind him a **sand wall** forms, the same billows as the summon, 26 px tall. | `wmkStatic` ×2 |
| 750 (release f6) | **Launch:** he is carried by the storm. The sand wall rides behind him and overtakes him at contact. There are no footfalls (he glides 2 px above the floor line, his feet trailing). Travel 260 ms. | `wmkStormRelease` (stop charge) |
| 1010 (contact f7) | Lance strike inside a **dust explosion + dry thunder**: one stepped gold4→gold3 ring (≤ 45 % cover, EF-3), then an earth ring. The sand engulfs the target for 2 frames, then blows **past** it downwind in streaks (300 ms) and dies. Hit-stop 130 ms (heavy + `stopTime` 30). Shake 4 px. Number 2800 on contact. | `wmkDryThunder` + struck material |
| 1140–1650 | f8–f10: the storm detaches from him, the dust devil collapses, and he recovers upright | — |
| 1650–2050 | f11–f13: he walks back. The aura stays at level 2 (still the battle phase). | — |

- **Storm direct** (≈ 1.55 s ≤ 1.6): the thrust ends at the podium.
  - The sand wall sweeps **on** across the opponent's half of the field to the LP panel (`fx.lpPoint`),
    where its last billow breaks.
  - The anticipation spin is shortened to 2 angles.
- **Storm blocked** (e.g. vs a defending shield_titan: 2800−500 = 2300 < 2600):
  - The wall **splits around the defender** into two plumes.
  - The knight is shoved back inside his own dust (8 px).
  - Static sparks scatter off the guard. Sound: `wmkStormSplit`.
  - This is the only place two cards' effects meet visibly: the titan's −500 eats exactly the storm.
    That makes a good scenario (`fsStormBlocked`).
- **Readability:** the normal and storm strikes differ in every phase:

| phase | normal | storm |
|---|---|---|
| anticipation | a lance couch | a spin plus a vertical mane |
| travel | walking | gliding inside a sand wall |
| contact | thrust | thunder dust explosion |
| aftermath | clean | dust blows past the target |

### 4.8 Hit, heavy, magic, guard (sprite poses; reactions by the default battle handler)

- **hit (6 f).** The helm snaps back 2 px. **The mane whips forward over the helm for 1 frame** (inertia;
  a unique read), then falls back. The lance wobbles 1 px. f5 = idle f0.
- **hitHeavy (8 f).** A half-step stagger with a knee bend. The lance butt skids (dust puff in the fx).
  The mane jolts **straight up** (shock) for 2 frames and crashes back.
- **hitMagic (8 f).** He becomes a **lightning rod**: 1-px gold static runs over the plate edges, down
  the lance and into the ground. A small gold crack appears under the butt (fx overlay in the strike's
  defender path is the default's; the sprite carries the static on f1–f4).
- **guard (6 f loop).** The lance is planted diagonally in front as a barrier, the front pauldron is
  forward and the head is down. The mane drapes over the back like a cape and ripples slowly.
- **toGuard (6 f)** has an intermediate mane-sweep frame. **fromGuard (5 f)** ends on idle f0. Feet fixed.

### 4.9 Death — "Durgun Hava" / dead calm (a unique ending; ≈ 1.25 s ≤ 1.4 s)

**Final material (new, not in §5.2):** the wind stops, the knight kneels at his planted lance, and he
comes apart into **fibres and slivers that fall straight down** into his tile in dead calm.

- The scatter is exactly the opposite of every wind ending (C9, C11, R3 scatter sideways).
- It is not a heap: the strands sink through the floor line, so no ash or stone pile is left.
- It uses option (b), our own `destroyed` hook with deathV3-style bookkeeping. Fall back to
  `ctx.base()` when `sourceOwnsDeath`.

| ms | picture | sound |
|---|---|---|
| 0 | death f0 = the hit continues | struck material |
| 50–110 | f1: he staggers back | — |
| 110 (f2, hold 150) | **CALM:** the mane and pennon **freeze mid-stream**, the first time anything on him is still. The aura is killed in the same frame (streaks and specks gone). | `wmkCalmCut` (deathStart: a short intake, then the bed **cuts to silence** for ≈120 ms) |
| 260–330 | f3: he drops to one knee and plants the lance upright with his front hand | `wmkKneel` (afterDissolve −70) |
| 330 (dissolve f4) | The mane **goes limp**: it slides down off the crest and hangs straight down his back like a lowered banner. The pennon droops. | `wmkStrandRain` start (dissolve) |
| 400–870 | f5–f9: his head bows and the limp mane covers the helm. Last frame: a low kneeling figure, everything hanging vertical. | — |
| 870–1170 | **Strand rain:** the whole sprite is cut into 1–2 px vertical strands (earth tones from the mane, night/steel slivers from the plate, the lance as 2 px segments). Each falls straight down with gravity and vanishes on the tile line, staggered from the lance (front) to the mane tip (back) over 180 ms. **Zero sideways drift.** | trickle continues |
| 1100–1250 | The last 150 ms: whole-pixel break of the remaining strands. **One last earth4 grain** drops after them. The card is born on the break frame (EF-12) and flies to the graveyard. | `wmkLastGrain` (burst) |

- **`DEATH_PRESETS`** (shared one-liner, my own line): `windmane_knight: { material: 'light', accent: 'light' }`.
  - The custom death owns the picture.
  - The preset only feeds `matterRamp` (gold: hologram onset, revive motes) and the
    source-owned-death fallback.
  - It is no longer stone.

### 4.10 Revive (soul_recall; ≈ 1.65 s ≤ 2.0)

The revive is the reverse of the death (HA-28). The anim runs from the death last frame to idle f0. The `reviveGather`/`reviveLand` voice comes from soul_recall.

- **0–400:** the strands **rise straight up** out of the tile and knit into the kneeling, limp-maned
  figure. revive f0–f3. `wmkReviveGather` start.
- **400–1000:** f4–f7. He stands and lifts the lance.
- **1000 (land f8): the wind returns.** The mane lifts off his back and starts to stream again, which is
  his first breath. A soft pennon snap. `wmkReviveLand`.
- **1000–1650:** f9–f10 → idle f0.
- **There is no storm aura on a revive** (no bonus). The calm mane length is the visible difference.

## 5. Card art (`src/art/cardart-v3/windmane_knight.ts`)

- **Backdrop.** TOPRAK: an earth0 sky, a stone0 ground with earth1, a stepped mesa ridge, and a low
  dusty sun behind the ridge (earth2/earth3). Rim earth3.
- **Big 88×68, native redraw.**
  - A 3/4 bust plus a raised lance, facing right.
  - The helm's grille and gold eye-points are the focus, at about (52, 24) (the brightest point; gold4 in
    the light layer).
  - The mane streams left across the sky band, crossing the sun disc, so its upper edge gets the earth3
    rim and reads as backlit sand.
  - The lance runs on a diagonal from the bottom-right to the top. The pennon streams left at the top
    third (x 58, y 10).
  - 3–4 grit specks in the light layer, no gradients.
  - Subject fill 0.65.
- **Small 44×34, hand-made.**
  - Tighter crop: helm, grille eyes, the first half of the mane, and the lance tip with the pennon.
  - Hand map plus `patch`, not autoSmall. Nothing on x 0/43, rows 0/33.
  - **16×12 check:** a blue-white helm blob, an orange mane wedge to the left, and one gold dot.

## 6. Sound identity (checked against §5.1)

| | |
|---|---|
| Main pitch / colour | **C3 visor howl**: band-passed noise, two resonances at 131 / 196 Hz (C3 + G3, q ≈ 8), centre slowly swaying (0.6 Hz). Low, hollow, wind-through-a-grille. Not tonal (the polar family's 110/111 Hz hum is tonal sine beating), not rising treble (C3 hatchling ring 1.2 kHz, C11 horn flute), not 4–5 kHz (C9 tsst, R3 feathers). |
| Signature material | bright plate (clank f 330 Hz, ratio 2.76; away from the magus's 1.41 at 470–760) + horsehair/pennon + sand grit |
| **Distinctive layer** | **banner snap "ŞAK"**: a flag cracking in a gale. A single hard broadband `crack` (hp 1.5 k) plus a low cloth whomp (`thump` 90→55, 60 ms). One snap, not a flutter: C8 owns the wing "fuff", C9 the string buzz. In the storm state it gains **dry static ticks** (`crack` n 3, hp 6 k, tiny gain) and the storm strike ends in a **dry thunder roll** (see below). |
| Must avoid | S4's wide L→R broadband sweep (our sand wall is band-limited 300–900 Hz with grain ticks, panned with the wall); S10's "embedding in the ground + pull-out creak" (our lance plant is a dirt thump with no creak); boltStrike / v1 `thunder` (our thunder has no bright pre-crack, it is a 38–70 Hz rolling brown body with a sand hiss tail; check LSD ≥ 10 dB); R1's double 50 Hz heartbeat (our low beats are single). |

**Recipes** (`src/audio/v3/windmane_knight.ts`, kit blocks + Voice only, prefix `wmk`):

| recipe | role / beat | build (kit) | duck |
|---|---|---|---|
| `wmkSandWall` | arrive (sustained, start/stop) | `sweep` 300→900→500 Hz pink, q 2, pan R→L (mirrored for P2 via pan) + `crack` n 14, hp 3 k, gap 0.04, very low | 0.3 |
| `wmkLancePlant` | land | `thump` 120→55 drive 0.3 + `puff` brown lp 900 + small `crack` n 2 | 0.55 |
| `wmkStormHowl` | roar (cut-in flare) | two `sweep` resonances 131→196 / 196→262 Hz q 8, 0.9 s, + banner snap at 0.75 s | 0.6 |
| `wmkManeUnfurl` | summon big beat | **banner snap** + `puff` pink lp 4 k grit spray 0.25 s | 0.55 |
| `wmkCharge` | charge (normal; declare holdCharge) | howl bed 131 Hz q 6 + pennon flutter (pink noise, 12 Hz AM via gain steps), sustained | 0.3 |
| `wmkChargeStorm` | storm declaration (takeCharge) | howl bed rising 131→262 over 1.2 s + `wmkStatic`-style ticks every 0.15 s | 0.4 |
| `wmkLunge` | release (normal) | short `sweep` 400→1.2 k + two footfall `thump` 80→50 | 0.35 |
| `wmkThrust` | impact (normal) | `thump` 140→60 + `clank` 330 ratio 2.76 dec 0.25 + `puff` | 0.55 |
| `wmkStormCharge` | statChange storm charge (sustained) | howl C3→C4 rising, grit whirl `crack` n 12 quiet, low "VUMM" `thump` 70→45 at 0.7 s | 0.5 |
| `wmkStatic` | static micro-ticks | `crack` n 3, hp 6 k, dec 0.02; cap 6, gap 0.008 | 0.1 |
| `wmkStormRelease` | storm release | `puff` brown lp 1.2 k 0.4 s + `sweep` 200→1.2 k pan along path | 0.6 |
| `wmkDryThunder` | storm impact | `thump` 70→38 drive 0.5 dec 0.6 + `crack` n 6, gap 0.06, lp 2 k (rolling) + `puff` pink lp 3 k hiss tail 0.5 s | 0.75 |
| `wmkBlocked` | normal blocked | `clank` 330 ratio 2.76 short + `sweep` 3→6 k q 6 scrape 0.15 s | 0.45 |
| `wmkStormSplit` | storm blocked | two `sweep` 500→1.5 k panned −0.6 / +0.6 + `thump` | 0.55 |
| `wmkStormSettle` | end-phase calm | howl 196→98 falling 0.5 s + 4 falling grit ticks | 0.25 |
| `wmkCalmCut` | deathStart | a short intake `sweep` 800→300 0.12 s, then nothing (the silence is the sound) | 0.4 |
| `wmkKneel` | death beat | knee plate `clank` 330 low gain + dirt `thump` 90→50 | 0.3 |
| `wmkStrandRain` | dissolve | grain trickle `crack` n 20, lp falling 4 k→1 k over 0.6 s, no wind | 0.3 |
| `wmkLastGrain` | burst | one tiny tick + soft `thump` 60→45 | 0.4 |
| `wmkReviveGather` | reviveGather (sustained) | trickle with lp rising 1 k→4 k (reverse of `wmkStrandRain`) | 0.3 |
| `wmkReviveLand` | reviveLand | howl fade-in 131 Hz + small banner snap | 0.5 |

**`WINDMANE_KNIGHT_VOICE`** (set only in the same change as strike + death):

```ts
{ roar: 'wmkStormHowl', arrive: 'wmkSandWall', land: 'wmkLancePlant', charge: 'wmkCharge',
  release: 'wmkLunge', impact: 'wmkThrust', deathStart: 'wmkCalmCut', dissolve: 'wmkStrandRain',
  afterDissolve: [[-70, 'wmkKneel', 0.8]], burst: 'wmkLastGrain',
  reviveGather: 'wmkReviveGather', reviveLand: 'wmkReviveLand' }
```

- In the storm strike, `wmkStormRelease` / `wmkDryThunder` are played by the strike itself (the voice's
  `impact` is not used on that path).
- **Struck-body sound.** When the knight is hit, the generic material plays: no plate material exists,
  and `GENERATED_HIT_MATERIALS` is stone-only. Ask the orchestrator before adding one.
- **No idle SFX** (no infrastructure).
- **Offline checks:**
  - `?dev=audio&page=one&name=wmk…&log=1` for every recipe.
  - `tools/clip.mjs` on `fsStormAtk` and `fsKill` (peak ≤ −1 dBFS, 0 clipped).
  - A numpy 1/3-octave LSD check against boltStrike/thunder, `windGust`, the shield_titan and
    stone_sentinel voices, and S4.

## 7. Files

**New (owned by this card):**

| Purpose | Path(s) |
|---|---|
| Sprite (draft `_` prefix until the sprite gates pass) | `src/art/monsters-v3/_windmane_knight.ts` → `windmane_knight.ts` |
| Rig, anims, maps, fx | `windmane_knight-rig.ts`, `-anims.ts`, `-maps.ts` (grille/gauntlet `_L/_R` maps), `-fx.ts` (mane ribbon painter, grit) |
| Card art | `src/art/cardart-v3/windmane_knight.ts` |
| Cut-in | `src/art/cutins-v3/windmane_knight.ts` |
| Cinematics | `src/cinematics/kart-f/windmane_knight.ts` (summon v3 entrance, attackDeclare flare, strike: normal + storm × monster/direct/blocked, statChange up/down, death; every registration `if (LOOK_V3)`, priority 20, names `kart-f:windmane_knight:<part>`) |
| Storm aura | `src/cinematics/kart-f/windmane_knight-storm.ts` (aura + sand wall + static painters; exports only, plus the gated observer) |
| Sounds | `src/audio/v3/windmane_knight.ts` (exists, empty: fill recipes + voice) |
| Scenarios | `src/duel/scenarios/windmane_knight.ts` |
| Tests | `tests/art/windmane_knight.test.ts`: validateArt, extras present, marks, relight, palette, determinism, card art stats, cut-in holds/frames |

**Shared one-liners (re-read the file right before each edit; additive):**

- `src/cinematics/_v3/presets.ts`: our `DEATH_PRESETS` line → `{ material: 'light', accent: 'light' }`; add
  `windmane_knight: { flare: 340, slam: 410, exit: 740 },` to `RHYTHM`.
- `src/view/light/profiles.ts`: our `MONSTER_GLOW` line → gold4/gold3 only.
- `docs/v3/oturum-f.md`: our status row and log.
- Nothing in `src/art/monsters/index.ts`: windmane_knight has no exclusion entry, so the renamed file
  registers by itself. Until then, use `--art` for sheets.

## 8. Scenarios (prefix `fs`, each with a P2 twin `…P2` where marked)

| key | stage → steps | shows |
|---|---|---|
| `fsSummon` (P2) | main; hand knight, monsters [stone_sentinel, ember_wolf] → tribute summon zone 1 | sand-wall entrance, cut-in, brew aura |
| `fsCharge` (P2) | same + `enterBattle` | **Fırtına Yükü**, badge 2300→2800 |
| `fsStormAtk` (P2) | same + attack vs shade_assassin (ATK) | storm strike, kill |
| `fsStormDirect` | same, opponent empty, direct | sand wall to the LP panel |
| `fsStormBlocked` | same vs shield_titan in DEF | titan −500 cancels the storm; split plumes |
| `fsCalm` | summon + battle + `endTurn` | end-phase settle, 2800→2300 |
| `fsNoBattle` | summon + `endTurn` (no battle) | brew aura clears, no stat event |
| `fsAttack` (P2) | battle; knight on field (last turn) vs ember_wolf | normal strike |
| `fsDirect` | battle; knight vs empty field | normal direct |
| `fsBlocked` | battle; knight vs shield_titan DEF | normal blocked |
| `fsFlip` | knight face-down → flipSummon + enterBattle | no storm (no event) |
| `fsRevive` | graveyard knight + soul_recall + enterBattle | revive, calm mane, no storm |
| `fsGuard` | ember_wolf attacks knight in DEF | guard poses |
| `fsKill` (P2) | crystal_wyrm attacks knight (ATK) | hitHeavy → **dead calm** death |
| `fsTrade` | abyss_magus 2300 vs knight 2300 | both die |
| `fsStormDies` | storm knight attacks crystal_wyrm (2800 vs 2800) | death during the storm: aura killed at CALM |
| `fsMagic` | judgment_bolt on the knight | hitMagic (lightning rod) / effect death |

Keep the existing `m1Knight` and `mart_ashen_drake` knight scenarios as regressions. Before the first
cinematic, add the new keys to the camera base (`measure --scenarios 'fs*,m1Knight'`).

## 9. Gates (HANDBOOK §9; evidence in `shots/v3/kart-f/windmane_knight/`)

- `npm run typecheck` clean (ignore others' files); `npm test` with no new failures, plus the new
  `tests/art/windmane_knight.test.ts` and `cardface-v3`.
- Sprite: `monster-sheet --art … --anims all --points` (P1 + `--p2`), then
  `monster-gates … --class large --ref none` exit 0 (KK-3…KK-13). Frames ≤ 140 and ≤ 5 MB.
- Sameness: `sameness --ids windmane_knight --against all` below the thresholds. Watch
  stone_sentinel, steel_silencer, shield_titan, crag_axeman (when it lands) and grim_warden.
- v1: `filmdiff` v1 17/17 and a6v1 26/26 IDENTICAL. `card-hash --look v1` identical.
- Camera: `measure --camera-gate shots/v3/kart-f/camera-base.json` (zoom 1, no close-ups, focusCalls = base).
- `palcheck` on frame dumps of `fsStormAtk`, `fsCharge` and `fsKill`.
- `contact-probe` on `fsAttack`, `fsStormAtk` and `fsKill`.
- **Budgets (game clock, measure):**

| scenario | budget |
|---|---|
| summon (`fsSummon`) | ≤ 4.35 s |
| storm attack | ≤ 3.19 s |
| storm direct | ≤ 2.32 s |
| statChange beat | ≤ 2.32 s |
| death | ≤ 2.03 s |
| declaration | ≤ 0.435 s |
| cut-in | ≤ 0.9 s scene |

  Number vs contact must be ±17 ms. Check `&speed=3` too (SÜ-3: marks and sounds stay on their frames).
- Sound: every recipe page title checked, clips ≤ −1 dBFS with 0 clipped, LSD notes as in §6.
- At least 3 critique rounds with independent critics. Film every scenario P1/P2 and READ every PNG.

## 10. Open risks

- **The storm strike's 2.05 s scene is close to the 2.2 s budget.** If measure exceeds it, shorten
  the spin (3→2 angles) before cutting the sand wall.
- **Hidden statChange.** If another monster's statChange comes first in the same batch,
  `flow:statChange` consumes the knight's event and our beat is skipped. The observer still sets the
  aura, so the state stays right and only the flourish is lost. Acceptable; log it if seen.
- **The "+500 FIRTINA" chip** needs a text style from `src/ui/text.ts` (API is shared). Use an existing
  style; do not add one without checking.
- **The `tail` point** may not be allowed by `MonsterPoints`. Fall back to constants in `-fx.ts`.
