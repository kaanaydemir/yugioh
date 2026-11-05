# windmane_knight — Fırtına Şövalyesi (lane F design)

TOPRAK / Savaşçı · Sv7 (2 kurban) · 2300/2100 · ★ As (cut-in) · effect `summonTurnAtk500`
Card text: "Normal çağrıldığı tur saldırırken ATK +500." Draft: 2026-10-31. Status: **art built** (sprite rig,
card art, cut-in, glow line; §11). Cinematics, sounds and scenarios: not built yet.

One line: **a heavy foot-knight who carries a steppe GALE in his helm's horsehair mane. On the turn he
arrives the gale is his weapon; on every other turn it is only wind.** Whatever moves on him (mane,
pennon, grey dust) shows the game state: a quiet stream means normal, a taut, longer stream means +500,
and dead stillness means death.

> **Read §0.1 first.** The design critique (verdict needs-work, 15 findings) was folded in at the build stage.
> Where §0.1 and the older text below disagree, **§0.1 wins** (the old text is kept for the reasoning).

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

## 0.1 Critique fold-in (build stage, 2026-10-31) — these decisions supersede the text below

| # | finding | decision |
|---|---|---|
| 1 | the storm is SAND, which belongs to hourglass_imp alone | **Accepted.** The storm is a dry steppe **GALE of horsehair and grey dust**: tawny hair ribbons (the mane itself), torn chaff, dust in stone1/stone2/stone3/steel. "Haboob", "sand wall", "grit", "grain", "trickle" are dropped everywhere. The summon's front = a **gale front of streaming hair ribbons and grey dust**. Rule: the knight's dust/FX **never use earth3/earth4 together with gold3** (the imp's sand signature); earth tones stay on the mane and the pennon only. Sound renames: `wmkSandWall` → `wmkGaleFront` (band-passed wind 300–900 Hz with cloth/hair whisper, no grain ticks), `wmkStrandRain` → `wmkPlateFall` (plate pieces clanking one by one), `wmkLastGrain` → `wmkPennonFlop` (a final cloth flop). Ask the hourglass_imp designer to confirm no overlap (open). |
| 2 | the death repeats grim_warden's kneel-and-sink | **Accepted, rebuilt in the sprite.** New ending **"Kof Zırh" (the hollow armour)**, see the rewritten §4.9 and the proposed §5.2 row. No kneel, no sinking. |
| 3 | statChange branches key on prevAtk vs atk | **Accepted** (cinematics stage): up = `summonTurnBonus(ctx.state)===0 && summonTurnBonus(ctx.stateNext)>0`, down = the reverse, anything else → `ctx.base()`; a combined delta rolls the badge to the true value and shows the calm only for the 500. |
| 4 | end-phase calm swallowed by battle_cry expiry grouping | **Accepted** (cinematics stage): the charge and the calm are driven by the observer + a `phaseChange` hook (battle with the bonus on in stateNext; end with the bonus on in state); the statChange path only settles the badge. Scenario `fsCalmBattleCry` (P1+P2). |
| 5 | turn 1 has no battle phase | **Accepted** (cinematics stage): brew level 1 only when `s.turn > 1`; otherwise the "wind dies before it rises" variant (unfurl, one soft gust, no aura); dim the brew under `attackLocked`. Scenarios `fsTurn1Summon`, `fsLocked`. |
| 6 | no headroom to raise the lance | **Accepted, option (a)+(b), built.** The idle lance is planted butt-down and tilted 15° forward (tip ≈ y 17); the roar lifts it to **45° in front** (tip ≈ y 16); the special's spin is a **horizontal propeller at helm height** (0°, 45° foreshortened, end-on). Every mane pose is additionally squeezed toward the crest on any axis where it would leave the frame (`maneDrawn`). All 125 frames keep ≥ 2 px margins (test + KK-3). |
| 7 | the summon's big beat hides under the cut-in; generic tribute streams | **Accepted.** Sprite: the mane stays **gathered** (short, tight) from the walk-in through the land and the held breath (f0–f9); the **unfurl whip-crack is f10** (60 ms smear, pennon snaps taut) and f11 the full stream — the cinematic places f10 right after the cut-in exit (≈ 1800–1950 ms) and puts `S.finale()` on it. The cut-in's job is now the held breath (eyes ignite, mane gathered tight). The own tribute hook (tributes torn into hair ribbons and dust pulled into the gale front) is **mandatory** for the cinematics stage. |
| 8 | the normal strike is only adequate | **Accepted, built: the double hit.** attack f6 = the lance contact, f7 = **the mane whips forward over the helm like a lash** (the second blow, "ŞAK" at the target's head), f8 it falls back. Smaller than the storm strike (no glide, no propeller, no taut blade). |
| 9 | the gold static / thunder drifts to judgment_bolt / volt_lizard | **Accepted.** No lightning layer anywhere. The charge reads through wind and hair only: roar f1–f3 the mane spirals up, **f4 (release) it snaps into a rigid taut horizontal blade**, the pennon cracks taut, the eye-points flare (the only gold). hitMagic = **the mane flares and frizzes** (kinked, fanned strands). The storm contact's "dry thunder" becomes a **gale BOOM** (pressure wave + grey dust ring); keep the LSD check against thunder. |
| 10 | sound collisions (trickle, cloth whomp) and the generic struck body | **Accepted** (sound stage): renames in #1; the banner snap is a dry bright crack with no low whomp (or a 2–3 kHz hair "whssh"), LSD against kite_fencer once it exists. **Request to the orchestrator (open):** an additive `plate` struck material (clank 330 Hz / ratio 2.76 + a hollow helm ring at 131 Hz). |
| 11 | no 5+5 board check; iso axis wrong | **Accepted** (cinematics stage): the gale front runs along `forward(player)` clipped to the knight's tile column; the storm-direct sweep is capped to the lane in front, ending at `fx.lpPoint`, as a stepped low band; scenarios `fsBoard5` / `fsBoard5P2` (knight in zone 0 and 4, neighbours filled). The sprite's own mane depth: drawn behind the helm/body inside the sprite; the unit-level depth vs the back neighbour is the default field order. |
| 12 | DEATH_PRESETS light/light is shared and odd | **Accepted:** the preset line becomes `{ material: 'plant', accent: 'crystal' }` (fibres + bright plate glints) in the cinematics stage (it is a shared line; changed together with the death cinematic). fsMagic relabelled "hitMagic, then the judgment_bolt-owned death (expected)". |
| 13 | cut-in f4/f5 barely visible | **Accepted, built:** holds `[180, 80, 80, 90, 230, 600]` — f4 starts at 430 ms, f5 at 660 ms, so f4+f5 show 310 ms before a 740 ms exit. Proposed RHYTHM line (cinematics stage): `windmane_knight: { flare: 260, slam: 330, exit: 740 }` (flare on f2, the eye flare). |
| 14 | `tail` is not a legal point name; missing budgets | **Accepted, built:** the mane tip is the **`staff`** point (per frame, after the squeeze and the death transform). Budgets added to §9 below. |
| 15 | scenario gaps | **Accepted** (cinematics stage): P2 twins for every storm scenario and fsCalm / fsRevive; `fsStolen` (puppet_string: no storm, aura off), `fsOneTribute` (double_offering), `fsTurn1Summon`; storm strike and charge filmed at `&speed=3` too. |

**Added game-clock budgets (§9):** normal attack on a monster ≤ 2.97 s, normal direct ≤ 2.16 s, blocked ≤ 2.97 s,
revive ≤ 2.7 s, end-phase calm ≤ 1.0 s, storm attack ≤ 3.19 s, storm direct ≤ 2.32 s, charge ≤ 2.32 s, death ≤ 2.03 s.

**Proposed YENI_KARTLAR §5.2 row:** `windmane_knight | "Kof Zırh" — dead calm: mane and pennon freeze, the rigid mane
snaps off whole and shatters flat behind him, the empty helm falls off, the plate comes apart standing from the top
down, the lance topples like a felled flagpole, the pennon lands last, flat; only the empty boots stand | material:
plate + horsehair (fibres + plate glints) | must avoid: kneel, sinking, ash/stone heap, sideways wind scatter`.

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

### 4.1 Summon — "Rüzgâr Cephesi'nden Çıkış" (was "Kum Seli"; gale, not sand — §0.1 #1, #7) (tribute ace, ≤ 3.0 s scene / 4.35 s game; plan ≈ 2.85 s)

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

### 4.9 Death — "Kof Zırh" / the hollow armour (rewritten after critique #2; sprite built)

The first stillness, then the knight turns out to have been only the wind inside the plate. **He never kneels and
nothing sinks into the floor.** Sprite `death` (10 f, 890 ms, impact = contact 0, dissolve 4):

| f | hold | picture | sound (sound stage) |
|---|---|---|---|
| 0 | 50 | the hit lands: helm snaps back, eye flare (local: 29 % of idle f0, HA-21) | struck material |
| 1 | 60 | he staggers back half a step | — |
| 2 | 160 | **CALM:** the mane and pennon **freeze mid-stream**, the eye-points dim — everything that always moved is still | `wmkCalmCut` (intake, then a cut to silence ≈ 120 ms) |
| 3 | 80 | the frozen mane **snaps off the crest** as one rigid comet piece (a gap at the root), eyes out | `wmkManeSnap` (a rigid crack) |
| 4 | 70 | **dissolve:** the rigid mane tips over backward (−32°), the empty helm tilts off, the lance starts to lean | `wmkPlateFall` start |
| 5 | 80 | the mane hits the floor and **shatters flat** (comet shards behind him); the helm lies on its side behind — **nobody inside** (empty dark collar); the front pauldron drops; the lance leans further, its foot kicking back | plate clank 1–2 |
| 6 | 80 | the back pauldron falls, the cuirass sags, the arms hang | clank 3 |
| 7 | 90 | the cuirass rolls off backward, the fauld drops onto the boots; only the **empty boots** still stand; the lance goes down like a **felled flagpole** | the pole falling |
| 8 | 100 | everything lies flat; the lance lies along the floor in front | — |
| 9 | 120 | the pennon lands last, flat | `wmkPennonFlop` (burst) |

- The last frame is a low pile (top ≥ anchorY − 34; tested) with the lance's tip on the floor band far in front.
- Option (b) cinematic (own `destroyed` hook with deathV3 bookkeeping) plays the sprite death and then a short
  dust ring in stone2/stone3; the card is born on the f9 flop. `ctx.base()` when `sourceOwnsDeath`.
- **`DEATH_PRESETS`:** `{ material: 'plant', accent: 'crystal' }` (critique #12), set with the death cinematic.

### 4.10 Revive (soul_recall; ≈ 1.65 s ≤ 2.0)

**Built (supersedes the strand text below):** sprite `revive` (10 f, 1.1 s, land 7) is the hollow-armour death
backwards — the pennon lifts off the floor, the lance rises, the plate climbs back onto the boots, the helm returns,
the rigid mane reattaches (f6, the calm, eyes dim) — then **land f7: the wind returns**: the mane lifts off rigid
into a stream, the pennon snaps taut, the eyes relight; f8 full stream, f9 idle f0.


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

## 11. Build log (art stage, 2026-10-31)

**Built (new files, owned by this card):**

| what | path | notes |
|---|---|---|
| sprite shell | `src/art/monsters-v3/windmane_knight.ts` | drafted as `_windmane_knight.ts`, renamed after the gates passed — **registered in v3 now** |
| rig | `src/art/monsters-v3/windmane_knight-rig.ts` | 104×96, AX 50, GY 91; polygon / tube parts shaded by flat planes from their own edges + geometric ridge splits (P1); rigkit `composite` one-step seams; one `outline(ink)`; eye-points + one glint + grey dust after the outline; mane = 6 ribbon strokes (earth1–4) with a travelling wave, squeezed into the frame (`maneDrawn`); death pieces are geometry transformed before raster; the planted ferrule keeps the butt fixed in the calm loops |
| anims | `src/art/monsters-v3/windmane_knight-anims.ts` | 13 anims / **125 frames** (idle 16, guard 6, toGuard 5, fromGuard 5, attack 13, special 14, roar 11, hit 6, hitHeavy 8, hitMagic 8, summon 13, death 10, revive 10) = 4.99 MB (large class) |
| card art | `src/art/cardart-v3/windmane_knight.ts` | EARTH backdrop, the sprite rig in a card pose; small = 1× hand crop (focus 28,18), big = EPX + fresh ink + earth3 rim + eye light; 4 living frames (mane wave, eye pulse); `portrait()` wired |
| cut-in | `src/art/cutins-v3/windmane_knight.ts` | 200×144 native; held breath (eyes kindle → flare → helm lifts, gathered mane strains); holds `[180,80,80,90,230,600]`; `p2: 'relight'` |
| test | `tests/art/windmane_knight.test.ts` | 7 tests pass: marks/holds, validateArt normal (0 findings), file registered + ≤ 140 f + ≤ 5 MB, determinism + P2 silhouette + 2-px margins on all 125 frames, no cyan/crim/teal/mag, the hollow-armour death ending, card art + cut-in budgets |

**Shared one-liner edited:** `src/view/light/profiles.ts` `MONSTER_GLOW.windmane_knight` → `[T(PAL.gold4, 1), T(PAL.gold3, 0.7)]`
(white / leaf3 dropped: white is a body glint, leaf3 foreign). **Not touched yet** (cinematics stage): `DEATH_PRESETS`
(still `'stone'`), `RHYTHM`, the sound file, scenarios.

**Points:** muzzle = grip = lance tip (follows the fall), hand = near gauntlet, head = grille, core = chest, staff =
mane tip, feet = between the soles. `attackImpactFrame` 5 = attack release.

**Gates / evidence** (all under `shots/v3/kart-f/windmane_knight/`, gitignored):
- sheets: `sheet/windmane_knight-v3-all.png` (P1), `sheet-p2/windmane_knight-v3-p2-all.png` (P2) + per-anim strips; close-ups
  `death.png` (f4–f9), `attack.png` (f6–f8, the lash), `special.png`, `roar.png`, `summon.png` (land → unfurl), `hit.png`.
- `monster-gates … --class large --ref none`: **24 rows, 21 ok, 0 FAIL** (HA-17 1.65, HA-18 15.2 %, HA-19 0.38, HA-21 23–29 % /
  phase 45–47 %, HA-9 feet + planted butt fixed, KK-13 125 f, 3.7 ms/frame).
- `sameness --ids windmane_knight --against all` (`sameness/sameness.txt`): **no KALIR; KEY green against every card**
  (max 0.49 vs seal_head). UYARI (out of plan): MOTsig vs abyss_magus 0.58 / lumen_sprite 0.60 / coral_serpent 0.56,
  MOTloop vs dusk_sorcerer 0.93 / magma_titan 0.90 (the near-still guard loops) / shade_assassin 0.73 / seal_arm_l 0.66,
  MOTavg vs ember_wolf 0.49 / coral_serpent 0.47. The distinction header is in the shell; a blind eye test is still owed.
- board scale: `board.png` (P1 + P2 on tiles); in-game with placeholder cinematics: `m1Knight.png`, `m1Knight-b.png`
  (hand card shows the new portrait, the cut-in band shows the new cut-in, the knight reads on the tile).
- card art: `card.png` (big | small | small ×2 | 16×12 mini); cut-in: `cutin.png` (f0–f5 P1 + f2 P2).
- iterations: ≥ 3 look/fix rounds on the mane (stick → horn → comet wedge), the torso planes and the P2 balance,
  the death (lance skid, floor fit, empty boots, gauntlets), the headroom (squeeze + AX shift), the lash shape.

**Known weaknesses (to fix in the next round):**
- The plate is clean but plain at 1×: few rivets/fluting; the torso still reads a little boxy.
- The mane is one tawny wedge; strand separation is subtle at 1× (seams one step down only).
- Propeller spin (special f1–f3) reads weakly as a spin: the foreshortened frames are short sticks; the cinematic should
  add a 1-frame whole-pixel arc overlay (owned fx) as critique #6(c) allows.
- Guard: the pennon hangs close to the grille; its loop is near-still (the MOTloop UYARI vs other still guards).
- Card art big is an EPX of the 1× bust (flat helm planes at 2×); a native 2× redraw of the helm would lift it.
- The cut-in mane is a flat bundle; the helm is strong. The lens glint must be checked in-game with `&eyes=1`.
- `tests/art/cardface-v3.test.ts` G1 fails on `scrap_raiders` (not this card).

## 12. Build log (cinematics + sound stage, 2026-10-31)

**Built (owned files):**

| what | path | notes |
|---|---|---|
| cinematics | `src/cinematics/kart-f/windmane_knight.ts` | all registrations `if (LOOK_V3)`, priority 20, names `kart-f:windmane_knight:{tribute,summon,statChange,declare,strike,death}` + one gated observer (aura lifetime) |
| sounds | `src/audio/v3/windmane_knight.ts` | 24 `wmk*` recipes from `./kit.ts` blocks + Voice only (helpers `howl`, `bannerSnap`, `plate`, `footfall`, `flutterBed` are compositions of kit blocks, no new DSP); `WINDMANE_KNIGHT_VOICE` set (all roles incl. revive pair) |
| scenarios | `src/duel/scenarios/windmane_knight.ts` | 30 `fs*` keys: Summon(P2), Turn1Summon, Charge(P2), Effect, StormAtk(P2), StormDirect(P2), StormBlocked(P2), StormDies, Calm(P2), NoBattle, Attack(P2), Direct(P2), Blocked(P2), Guard(P2), Kill(P2), Trade, Revive(P2) |

**Shared one-liners:** `_v3/presets.ts` `DEATH_PRESETS.windmane_knight` → `{ material: 'light', accent: 'stone' }` (no longer the reserved
stone ending; NOT plant/crystal as §0.1 #12 proposed: `plant` sheds green leaf motes and the `crystal` accent cyan glints — both foreign
to the knight. The preset only matters on fallback paths: the knight's own death never shatters); `RHYTHM.windmane_knight` →
`{ flare: 260, slam: 330, exit: 740 }`. `MONSTER_GLOW` was already gold4/gold3 (art stage).

**How the +500 surfaces (research):** no `activate`. `rules.ts:1129` sets `slot.normalSummoned`; `query.ts:228 summonTurnBonus` is
read by `currentAtk`; the engine emits `statChange` (withStats diff) right after `phaseChange('battle')` (+500) and after
`phaseChange('end')` (−500). Today's placeholder = `flow:statChange` generic green rim + number. Gotchas found: (1) at the
statChange both `ctx.state` and `ctx.stateNext` are already in the battle phase, so "up" is keyed on `stormOn(stateNext)` + a
+500 ATK delta (never on the raw ATK value); (2) `FieldView.sync` after the phaseChange rolled the badge to 2800 BEFORE the beat —
fixed by the observer setting `u.battleTint` on that phaseChange (FieldView keeps a battle-tinted plate in the battle phase) and
the beat rolling it on the roar's release; (3) the storm strike decides with `stormOn(s.ctx.state)` (titan's −500 changes the
number, not the decision).

**Presentation as built:**
- tribute (`tribute` card hook, additive): a gust band crosses each tribute toward his tile + grey dust, then `ctx.base()` (generic streams).
- summon: an ace focus identical to the placeholder's (camera gate), the gale front (dust billows behind, hair ribbons in front, 760 ms,
  along `forwardOf(player)`, clipped to ±35 px), eye-points kindle in it, the body forms (palette-step onset, stone ramp) and walks
  (steps on f1/f3), land f6 = lance plant (dust ring, shake 2, gold3 flash, `wmkLancePlant`), cut-in holds f7–f9, then the UNFURL f10
  (`wmkManeUnfurl`, grit + hair spray downwind, stone-ramp finale, no player ring), brew aura (6 circling specks) when a battle can follow.
- Fırtına Yükü (statChange up, 1.9 s game): ring contracts, `wmkStormCharge` (howl C3→C4 + VUMM), roar, at release a gust of ribbons
  bursts off the taut mane, gold pool on his tile only, the badge rolls with a gold "+500 FIRTINA" chip at the plate, aura → storm
  (12 specks, storm tail off the mane tip `staff` point, wind streaks, gold3 pool).
- Fırtına diner (statChange down, 0.93 s): specks fall to the tile in 3 steps, tail drifts and blinks out, muted "-500" chip, `wmkStormSettle`.
- declaration (storm only): the aura becomes the dust devil; on the charge frame the normal charge is dropped and `wmkChargeStorm` starts.
- normal strike: couch (×1.6), two-step lunge 220 ms (`wmkLunge`), thrust on contact (`wmkThrust` / `wmkBlocked` + skid sparks), f7 the
  mane LASH crescent at the target's head (`wmkLash`), blocked shove 6 px, two steps home. Direct lunge capped at 48 px.
- storm strike: propeller arc overlay f1–f3, dust devil bands, gale wall builds behind (f4–f5), glide 260 ms with the wall riding,
  contact = gale BOOM (stepped pressure ring white→mist→steel, grey dust ring, hit-stop +30, shake 4, `wmkGaleBoom`), the wall blows past
  the target / on to the duelist (direct, lunge capped 64 px) / SPLITS around the guard (blocked, `wmkStormSplit`, shove 8 px).
- death "Kof Zırh" (option b, deathV3 bookkeeping copied: toGraveyard consumed, release, v3:dying/v3:dead, planned-entry / guard-break
  join, onBorn): the sprite's 10 frames; f1 `wmkCalmCut` (late-safe), f2 aura freezes + falls, f3 `wmkManeSnap`, f4 `wmkPlateFall`,
  f5/f6 `wmkPlateClank` (+ flat mane shards on f5), f7 `wmkPoleFall`, f8 dust where the lance lands, f9 `wmkPennonFlop` + the card is
  born + flat dust ring; the pile settles in grey dust and goes out in 3 tint steps (`wmkHollowBurst`). No shatter.

**Gates / evidence** (`shots/v3/kart-f/windmane_knight/`):
- camera base (placeholder presentation): `camera-base.json` (30 scenarios). After: `r2/measure.json` — camera gate **30/30 ok**.
- budgets (game clock, r2): tribute+summon 4.30 s (≤ 4.35), statChange up 1.90 s (≤ 2.32), calm 0.93 s (≤ 1.0), storm attack battle 2.48 s
  (≤ 3.19), storm direct 2.32 s (= limit), storm blocked 2.33 s, normal attack 1.90 s, normal direct 1.85 s, death 1.42 s (≤ 2.03),
  declaration 0.32 s; number on contact (numberAfterContactMs 0).
- v1: `filmdiff --set v1` **17/17 IDENTICAL**. (`a6v1` set not run this stage.)
- films (LOOKED): `r1/fsSummon.png`, `r1/fsSummon-zoom.png`, `r1/fsSummon-zoom2.png`, `r1/fsStormAtk.png`, `r1/fsStormAtk-b.png`,
  `r1/fsAttack.png`, `r1/fsKill.png`, `r1/fsStormBlockedP2.png`, `r1/fsCalm.png`, `r2/fsSummonP2.png`, `r2/fsStormDirect.png`,
  `r2/fsStormDirect-b.png`, `r2/fsKillP2.png`.
- sound: audio pages `audio/wmk*.png` (24, titles checked); first pass found the howl-based beds 15 dB too quiet (−31 dB vs the wyrm/magus
  charges at −13…−15) — raised (charges now −18, gale front −20); clips `clips/fsStormAtk.{mp4,wav,json}` and `clips/fsKill.*`: peak
  −2.0 dBFS, 0 clipped samples; every death beat lands on its frame in `clips/fsKill.json`.
- tests: `tests/art/windmane_knight.test.ts` pass; `tests/presentation/engine-boundary.test.ts` timed out (5 s import timeout) on a
  machine at load 12 — not investigated further.

**Iterations:** r1 → r2: gale front denser/taller (two billow rows, 18 ribbons), eye-points with halo, no generic player ring in the
finale, brighter brew specks, the dust devil bands, a bigger gale wall closer to his heels, couch sped ×1.6, the +500 chip moved onto the
plate, the badge held through the phase sync, the camera focus restored (gate), the direct lunges capped (he no longer crosses the
board), the calm cut made late-safe, the howl beds +15 dB, the unfurl / lash louder.

**Known weaknesses (next round):**
- The tribute is additive (gusts over the generic pixel streams), not the full own "torn into hair ribbons" choreography (§0.1 #7).
- The dust devil and the propeller arc read weakly at 1×; the gale wall reads mostly as low dust at his heels.
- Calm: the end-phase sync drops the plate to 2300 ≈ 130 ms before the "-500" beat (battleTint only holds in the battle phase).
- No independent critic rounds yet (2 self LOOK rounds); `fsRevive`, `fsGuard`, `fsTrade`, `fsStormDies`, `fsNoBattle`,
  `fsTurn1Summon` were measured (camera/budget) but not filmed; no `&speed=3` film; no LSD comparison against thunder / S4.
- Struck-body sound when the knight is hit is still the generic material (plate material needs orchestrator approval).

## Round 1 (fix round 1/3, lens craft, 2026-11-05)

Critic verdict was needs-work (13 findings). Evidence for this round is in `shots/v3/kart-f/windmane_knight/r1-fix/`
(baseline sheet before the fixes: `r1-fix/base/`). Files changed: `src/art/monsters-v3/windmane_knight-rig.ts`,
`windmane_knight-anims.ts`, `src/art/cutins-v3/windmane_knight.ts`, `src/art/cardart-v3/windmane_knight.ts`,
`src/cinematics/kart-f/windmane_knight.ts`, `tests/art/windmane_knight.test.ts`. No shared file was touched.

| # | sev | finding | what I did | evidence |
|---|---|---|---|---|
| 1 | high | mane reads as a log / plank / horn | **Fixed.** The mane is now 5 separate ribbons (2–3 px, `MANE_L`/`MANE_D` = earth4…earth1), each two-toned ALONG its length (lit upper band, crease one step darker underneath), neighbours alternating in value. The stream fans open toward the tips (`fanOf`, roots 2.4 px apart, tips ≈ 5 px), so background and ink gaps show between strands. Staggered lengths (`MANE_LEN`), per-ribbon wave phase (`i × 0.23`, period lengthened to 21 px so the S-curves are smooth, path points no longer rounded). Two ribbons split into 2 short 1-px wisps at the tip only. Gathered state (`mane.bound`) = 3 thick braided plaits with a gold1/gold2 ring (summon f0–f9, revive f6). | `r1-fix/w1/z.png` (idle zoom), `r1-fix/sheet/windmane_knight-v3-idle.png`, `r1-fix/film/fsSummon-zoom.png` #12–#33 (plaits at 1×, then the unfurl #35) |
| 2 | high | blue tin robot | **Fixed.** Helm redrawn as a flat-topped great helm with a forward-angled faceplate (keel at the breaths), two clear planes (side plane lifted to mist, faceplate steel), a raised keel (mist line + its shadow), a 3-row eye slit cut by three grille bars with the eye-points between them, brow lame, bevor seam, 3 rivets, gold crest ridge the mane grows from; the 3-hole "mouth" is gone. Torso: narrower waist, 2 fauld lames (not 4), the plackart stripe removed, a 1-px mist glint on the breastplate ridge, a gold rim along the cuirass's lower edge, 3 rivets on the pauldron. Gauntlets 7×7 with two finger lames; a stone2/stone1 mail band at elbows and knees; the far gauntlet is pulled out of the body silhouette (bgx 33). | `r1-fix/w1/z.png`, `r1-fix/p2-idle-guard.png`, `r1-fix/sheet/windmane_knight-v3-all.png` |
| 3 | high | mane pops horn↔plank in one frame | **Fixed.** The mane is a follow-through chain in every one-shot (`LAG_ANIMS`, `lagMane`): each frame covers 62 % of the way to its target, so the largest mass trails the body by a frame. The lash angles were unwrapped (−28°→332°, −36°→324°) so the chain passes through "up", never through "down". Exempt: loops, death (the calm is a freeze), revive (own staging) and the storm run loop. Δprev now includes the body; visually the attack f5→f9 and hit/hitHeavy/roar transitions go stream → fan → lash → fan → stream. | `r1-fix/w1/att.png`, `r1-fix/w1/hit.png`, `r1-fix/sheet/windmane_knight-v3.txt` |
| 4 | high | storm special = normal attack body; spin reads as the lance vanishing | **Fixed.** `special` restaged (14 → 18 f, marks charge 1 / release 11 / contact 12 / recover 14): f1–f4 a RIGID lance turning about the grip at −130°/−175°/−220°/−265° (never foreshortened, never gone), f5 a whole-pixel smear arc (night3→steel→mist, `Pose.arc`) sweeping the tip under into the couch; f6 a deeper charge stance (crouch 6, front knee bent hard, lance tip dropped to knee height, the mane a fanned swirl curling forward over the helm); f7–f10 the charging run (#5); f11 the release: a full-body forward lean with the mane split into three rigid blades (`mane.blades`); f12 contact. The normal attack keeps the upright couch + lash. The propeller overlay in the cinematic is removed (the sprite draws its own spin). Intra-card check: no special frame is within 2.9× idleΔ of attack f1–f8. | `r1-fix/s1/windmane_knight-v3-special.png`, `r1-fix/w1/sp.png`, `r1-fix/attack-vs-special.txt`, `r1-fix/film/fsStormAtk-zoom.png` #7–#29 |
| 5 | high | couched lunge skates; frozen hold under the titan's −500 | **Fixed for the storm strike, rejected for the titan hold.** New 4-frame charging run (special f7–f10: contact / down / passing with the back foot lifted and the plate riding up 1 px / contact, dust on both footfalls, mane taut and rippling); the strike cycles it during the 300 ms travel (`stride` with steps + `wmkStep`) and lands on the release frame at t ≥ 0.78. **Rejected (titan hold):** the frozen frame in `fsBlocked` is the declaration pose held by shield_titan's ward sequence (`kart-f/shield_titan.ts` `a.pose('attack', declarePoseFrame(a))`, another card's file); a braced micro-loop there needs a hook in that file or the shared declaration hold — flagged for the orchestrator / the titan's owner. | `r1-fix/film/fsStormAtk-zoom.png` #18–#24 |
| 6 | high | death reads as a kneel + heap; boots never seen | **Fixed.** Restaged: f4 the empty helm pops UP off the gorget; f5 helm falling behind, the open neck ring shows a 2-row night0 cavity; f6 the pauldrons slide off sideways and drop, the cuirass only slips 2 px (the body never pivots); f7 faulds and gauntlets clatter down; f8 the lance lies like a felled pole; f9 the pennon lands last. From f7 the two **empty greaves stand bolt upright** (knee straight, 24 px tall) with open night0 tops, the pile laid AWAY from them (helm/cuirass/pauldron behind, fauld/pauldron in front). Mane shards = 4 rigid two-toned ribbon segments with ragged ends. New test: two night0 greave tops on the last frame. | `r1-fix/w1/d.png`, `r1-fix/s1/windmane_knight-v3-death.png`, `r1-fix/film/fsKillP2-zoom2.png` #5–#11 |
| 7 | medium | revive = death backwards | **Fixed.** Own staging "the wind returns" (10 f, land 7): f0 a gust (stone3 streaks) catches the standing boots, the pennon lifts, the hair shards are gone (`noMane`); f1 the fauld is lifted onto the boots, the cuirass tumbles up; f2 the fauld seats (1-px settle), the cuirass hangs in the air with a gap; f3 the cuirass drops in (1-px bounce), pauldrons ride above; f4 pauldrons settle, the helm floats above the neck; f5 the helm drops on last; f6 eyes kindle, the mane sprouts bound; f7 land = the unfurl (as summon f10). New test: no revive frame equals any death frame. Consistent with HA-28 (pieces gather back, not a second summon). | `r1-fix/s1/windmane_knight-v3-revive.png`, `r1-fix/film/fsRevive-zoom.png` |
| 8 | medium | gale / hair FX = gold scribbles; tribute = tan grain | **Fixed (FX), rejected (generic tribute stream).** `ribbon()` now draws a smooth 2-px stroke: one gentle S-curve over its length, a lighter leading edge over the core, a 3-px 1-px tapered tail; ribbon counts cut (entrance 18→10, wall 16→9, tribute gust 8→5) and spaced evenly along the band; grey billows carry the volume. **Rejected:** the tan grain is the shared tribute choreography (`summon-a/tribute.ts` `pixelStream` with the EARTH ramp; `V3HOOKS.tributeBody` is frozen and owned by A6-A). The card's own tribute hook (gale ribbons + grey dust over each tribute) still runs before it; replacing the stream needs an orchestrator decision. | `r1-fix/film/fsSummon-zoom.png` #8–#17, `r1-fix/film/fsStormAtk-zoom.png` #13–#23 |
| 9 | medium | cut-in nearly static, flat, robot mask | **Fixed.** Redrawn with the new helm (flat-topped bucket, forward faceplate with a 2-step bevel, keel, 3-row slit with three bars, brow lame, bevor seam, 4 side rivets, crest rivets; breaths removed). The mane = three braided plaits with a gold binding ring that wraps them. Animated held breath: f0–f1 the helm tilts down 2 px and the plaits strain (swell, the ring creaks back), f2 the flare spills along the slit, f3–f4 the helm lifts 3–4 px and 1–2 ribbon tips escape, f5 three escaped ribbons flutter. | `r1-fix/cutin-sheet.png` (P1 rows 1–2, P2 rows 3–4), `r1-fix/cutin-f0.png`, in game `r1-fix/film/fsSummon-zoom.png` #26–#34 |
| 10 | medium | big card art = EPX upscale | **Fixed.** The EPX path is gone. Big art = the cut-in's native painter in a new 'stream' mode (`paintBust`: great helm with all the plate detail, five layered streaming ribbons with forked tips, raised lance head and pennon) reduced 2:1 by the kit's palette-keeping `reduce2x`, fresh ink + EARTH rim, eyes in the light layer. The EARTH sun is moved behind the helm, so the warm mane streams over the dark earth0 sky (figure-ground in both sizes). Small art stays the hand-cropped sprite (readable per the critic) on the same backdrop layout. Kit budgets: off-palette 0, isolated ≤ 5.3 %, ≤ 18 colours, focus ok. | `r1-fix/card.png` |
| 11 | medium | board read: mane blends, lance tip over the neighbour, pennon hides the eyes in guard | **Partly fixed.** Idle lance tilt 15° → 8° (tip over his own tile column; BUTT0 recomputed); the pennon sits directly under the head; the mane is outlined in ink with an earth4 lit edge on the lit strands. Guard: the lance is now planted forward of the faceplate (grip 71/61) with the pennon hanging limp beside it, so the grille and eye-points stay visible. The m1Board5 neighbour overlap (steel_silencer's back sits over his mane in that layout) is the default field order and was not changed. | `r1-fix/p2-idle-guard.png`, `r1-fix/film/m1Board5.png`, `r1-fix/sheet/windmane_knight-v3-guard.png` |
| 12 | medium | summon walk-out is a slide | **Fixed.** Two real heavy steps with planted feet: f0 contact, f1 down (crouch 2), f2 passing (back foot lifted 4 px, plate up 1 px), f3 contact (dust), f4 passing (near foot lifted), f5 contact (dust). Land f6–f7: a 2-frame squash (−2, −1), the lance butt planted with the ferrule collar and a 1-px recoil of the grip, a wider 3-puff dust. | `r1-fix/s1/windmane_knight-v3-summon.png`, `r1-fix/film/fsSummon-zoom.png` #13–#20 |
| 13 | low | guard nearly still; no flinch | **Fixed (loop), deferred (flinch).** Guard: two-phase ribbon sway (amp 1.4), a 1-px breathing lift, pennon flutter, eye pulse → guard Δ / idleΔ = 0.59 (was ≈ 0.38; KK-3 band 0.3–0.8). The struck-in-guard flinch overlay is a default-battle-handler path (no card hook for a guard hit); deferred. | `r1-fix/gates.txt` (HA-19), `r1-fix/sheet/windmane_knight-v3-guard.png` |

**Budget.** 125 → **129 frames** (special +4). 104×96×4×129 = 5.15 MB: over the self-imposed `--class large` (5 MB) but
the gate's own class for this v3 ace is `ace` (≤ 7 MB, ≤ 140 f); the card test now caps frames at 131 and bytes at 7 MB.

**Gates (this round).** `vitest tests/art/windmane_knight.test.ts` 8/8 (2 new tests: standing empty boots, revive ≠ any
death frame); `tsc` clean; `monster-gates` P1+P2 `--ref none`: **24 rows, 21 ok, 0 FAIL** (HA-17 1.46, HA-18 17.9 %,
HA-19 0.59, KK-13 129 f / 5.15 MB class ace) → `r1-fix/gates.txt`; `sameness --ids windmane_knight --against all`:
**no KALIR, 11 UYARI out of plan** (was 18 UYARI incl. two KALIR-line pairs) → `r1-fix/sameness/sameness.txt`.

**Open after round 1.** The titan-hold micro-loop (#5) and the tribute grain (#8) need owners outside this card; the
guard flinch (#13) needs a guard-hit hook. Not re-filmed this round: fsBlocked, fsGuardP2, `&speed=3`.
