# shield_titan — Kalkan Devi: v3 design (lane F)

**Card:** EARTH / Savaşçı, Lv4, ATK 100 / DEF 2600, not an ace. Its effect is `defenseAtkDebuff500`: while it is face-up in DEFENSE and attacked, the attacker fights that battle with −500 ATK.

**Design note:** "a giant with a tower shield taller than himself". The card is a pure wall, and its guard is its hero pose.

**Status:** design revised by the design critique (§12 supersedes the sections it names). Build-art stage: rig + card art + test (§13 log). Cinematics and SFX are the next stage.

**Evidence:** `shots/v3/kart-f/shield_titan/` (gitignored).
- `draft/` holds the rejected draft's sheet.
- `ref/` holds the reference sheets of stone_sentinel and steel_silencer.

---

## 0. The earlier v3 draft: diagnosis and decision

**What was rendered.** I rendered the draft with:

```
npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/shield_titan.ts --look v3 --anims all --scale 3 --points --out shots/v3/kart-f/shield_titan/draft
```

`--art` works on the excluded file. I looked at `shield_titan-file-all.png`, `-idle.png`, `-attack.png` and `-death.png`. I also ran `npx vitest run tests/art/shield_titan.test.ts`: 11 tests pass and 1 fails.

| # | Finding | Evidence |
|---|---|---|
| 1 | **There is no giant.** The silhouette is a brown wardrobe or door with a small dark-navy lump behind it. The giant's head, hands and body never read. At 1× it looks like a crate. | `draft/shield_titan-file-idle.png` |
| 2 | **The shield is the face.** The eye slot is cut into the shield (`points.head` sits in the "sight slot"). The slab reads as a robot head, not as a shield a person holds. | idle, every anim |
| 3 | **Palette collision with steel_silencer.** The draft is bronze/tan `earth` plus navy `night`/`steel` iron with gold rivets. That is exactly steel_silencer's body palette (`ref/steel_silencer-v3-all.png`). It also uses **crim** in the body (`CRIM` in `-kit.ts:22`, crest "gold tower on crimson" in `-shield.ts:30`, red plume), which HANDBOOK §4.4 forbids. | `grep crim src/art/monsters-v3/shield_titan-*.ts` (11 hits) |
| 4 | **Every animation looks the same at 1×.** Idle changes only the eye-slot colour; the giant behind the slab does nothing visible. Guard f0 is pixel-different (3.87× idleΔ) but reads as idle: there is no hero pose. Hit, hitHeavy and hitMagic are the same slab with a white line. Roar and victory are the slab twitching. | `draft/shield_titan-file-all.png` |
| 5 | **The death is the reserved stone/rubble ending, and too tall.** The slab breaks into a heap of plates (stone_sentinel's rubble language, §5.2). The test fails: the heap's top row is 41, above the required `anchorY − 24 = 48`. `DEATH_PRESETS` is `'stone'/'stone'`. | test: "the death ends in a low heap… expected 41 ≥ 48"; `draft/shield_titan-file-death.png` |
| 6 | **Body plan → sameness risk.** The draft is a `bodyplans/biped` member, so it is gated in-plan against stone_sentinel, which is also a shield-carrying stone knight. | `shield_titan.ts:1-5` |
| 7 | **The card art and cut-in inherit the failure.** The card art is a 1:1 crop of the sprite; the cut-in is a bust of the same slab. Neither survives a redesign. | `cardart-v3/shield_titan.ts:1,21`, `cutins-v3/shield_titan.ts:5` |

**Decision: rebuild from scratch.** All of these are concept-level problems, not polish:
- No visible giant.
- The shield is the face.
- The palette is another card's.
- Crim in the body.
- A reserved ending.

Nothing in the draft's art is kept.

**What carries over:**
- Lessons: `weight: 'heavy'`, the test file's structure as a template, `p2: 'relight'`.
- The hard rule the draft broke: the final death frame must be low.

**Removal:** the draft's files (`shield_titan.ts` and `-build/-parts/-shield/-maps/-kit/-fx/-anims`) are deleted in the same change that renames the new `_shield_titan.ts`. The draft's card art and cut-in are rewritten or removed in that change too (§10).

---

## 1. Concept and silhouette

**"Sur" (the rampart).** An old, bald, white-bearded giant in leather and bare skin stands behind a **copper tower shield that is a head taller than he is**.
- He does not wear armour; **the shield is his armour**.
- One huge hand hooks its four fingers over the shield's top rim.
- His head and white beard show past the shield's back (left) edge.
- The shield's single feature is a round **sunstone boss** (gold light). It is the card's brightest point and the source of the ward.

**Why this is unlike the roster:**

| card | look | shield_titan's difference |
|---|---|---|
| stone_sentinel | grey stone knight with a small slab shield | flesh and copper, not stone |
| steel_silencer | bronze/navy mech | no metal body; warm skin, white beard, red-copper slab |
| hollow_ogre | bark giant | |
| crag_axeman | stone and fur | |

**Frame:**

| item | value |
|---|---|
| Size | **80 × 84** (W × H) |
| Anchor | **(36, 78)**, hover 0, walker |
| Weight | `heavy` |
| Light | `p2: 'relight'` |
| Size class | medium (the totem placeholder class is 64) |

**Body box (idle f0):**

| part | x | y | notes |
|---|---|---|---|
| Shield | 38–62 (~25 px wide) | 16–78 (63 px tall) | foot sits on the ground line; top rim is the highest point |
| Giant | 12–44 | 25–78 | **~54 px tall**: head top y 25, i.e. 9 px below the shield top, so "taller than himself" holds |
| Fingers over the rim | 44–52 | 14–17 | |

The bbox is about 51 × 64. The margin is ≥ 2 px in every frame: the summon and death slabs lie flat inside x 8–74, and the attack's raised slab stays at y ≥ 4.

**Why it reads at 1×.** There are three value masses, each with a distinct hue family:
1. A tall **red-copper rectangle** (fire1/fire2 with a gold2 binding) on the right.
2. A **white beard and bald head** mass (stone4/mist) on the left at shoulder height.
3. A **warm-skin** arm and legs below.

The one bright gold point (the sunstone) sits in the middle of the copper. At the 16 × 12 mini-card downsample this is a copper bar, a gold dot and a white blob, which no other card has. The shield never carries a face: eyes belong only to the giant.

**Rig:** hand-built (not `bodyplans/biped`), following the crystal_wyrm / abyss_magus / steel_silencer split.
- The shield is a **rigid part**. It moves by whole pixels and has its own hinge angles for the drawbridge rise and fall, drawn as hand-made iso slabs at 0° / 25° / 55° / 80° / 90°, not rotated.
- The giant is posed parts: head+beard, torso, near arm (hand on the face), far arm (fingers on the rim), legs.
- `joints()` is supplied for the sameness tool.

---

## 2. Palette (PAL/RAMPS only)

| material | tones | bands |
|---|---|---|
| Copper shield face | `fire0` core shadow, `fire1` shade, `fire2` lit face, `fire3` 1–2 px lit-edge band | 3 bands + edge |
| Bronze binding, rim, rivets | `gold1`, `gold2` | 2 |
| Giant skin | `skin0` … `skin3` | 3–4 |
| Beard, braid, brows (old white) | `stone3`, `stone4`, `mist` | 3 |
| Leather (straps, kilt, wraps) | `earth0`, `earth1`, `earth2` | 3 |
| Iron (knee guards, bracers; small) | `stone1`, `stone2` | 2 |
| Outline | `ink` | |
| Glint (one per anim, `twinkle`) | `fire4` on the copper's lit corner | |
| **Emissive** (light pass, not outlined): sunstone boss, rune seam, ward | `gold3`, `gold4` | |

**Colour count:** 19 body colours plus 2 emissive, within the ≤ 20 body colours per frame rule.

**Forbidden tones:** no cyan, crim, teal or mag in the body. `gold3`/`gold4` never appear as body tones: the rim and rivets stop at `gold2`, so the glow does not flood.

**Light layer (`MONSTER_GLOW`).** Replace the line with:

```
shield_titan: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.7)], halo: 0.5, pool: 0.85 }
```

- `white` is removed from the list (white is not in the body).
- The spill is gold3 if the profile takes one.
- The light pool falls on the floor in front of the shield.

---

## 3. Idle: living details (16 f, 1960 ms, loop)

**Holds:** `[140,120,110,120,130,110,120,140,130,110,120,110,130,120,110,140]` ms.

**The shield is rigid and still in idle (IŞ-12).** Life comes from the giant behind it and from the boss.

- **Breath.** The shoulders, head and beard rise 1 px over f0–f3, hold, and settle over f8–f11 (an 8-frame breath; the head lags the shoulders by 1 frame).
- **Beard.** The beard tip and braid swing 1 px with a 2-frame lag behind the head (overlap). On the exhale (f9) the whole beard settles.
- **Fingers.** The four fingers on the rim re-grip in a ripple, little finger to index finger: f5 lifts the little finger 1 px, f6 the ring finger, f7 the middle finger and the little finger drops, f8 all are down. This is the "impatient wall" tell.
- **Blink.** One blink at f12 (a 2-frame lid).
- **Sunstone breath.** A stepped emissive pulse: gold3 core → gold4 for 2 frames (f4–f5 and f12–f13).
- **Strap.** A leather strap end hanging from the shield's back edge swings 1 px at a period of 4 frames (a different period from the breath, so the loop never looks mechanical).
- **Feet.** The feet are fixed (HA-9). Liveliness ≥ 15 %. HA-17 max Δ ≤ 1.8 × idleΔ.
- **Dust.** One loose dust speck slides off the shield foot every loop (f14, 1 px, earth2).

---

## 4. Storyboards

All times are **scene ms** (before the 1.35× tempo; game clock ≈ × 1.35–1.45). Each budget is REHBER §5. Sprite holds obey HA-2 to HA-5 and HA-29.

### 4.1 Guard: the hero pose "Sur Duruşu" (guard 8 f, 1260 ms; toGuard / fromGuard 6 f, ≤ 400 ms)

**Guard pose:**
- The giant drops 4 px into a crouch.
- His far shoulder jams into the shield's back; his near palm presses flat on the back edge of its face.
- The shield's foot sinks 1 px into the floor with a 1-px dirt lip (earth1) on its front.
- He peers past the shield's back edge with one eye under a white brow (the head moves out of the shield's line).
- The rune seam (a vertical gold3 line from the boss down to the foot) is faintly lit, and the sunstone breathes on a slower guard rhythm (2 frames in 8).

**Guard loop holds:** `[180,150,140,160,180,150,140,160]`.
- Heavy breath shows in the shoulders only (1 px).
- The beard sways.
- The shield and feet are fixed.
- HA-19: guard Δ is 0.3–0.8 × idleΔ.

**toGuard: the "DUNK" plant.** Holds `[50,60,70,60,60,80]` = 380 ms.

| frame | pose |
|---|---|
| f0 | idle |
| f1 | he lifts the shield 2 px (sweep in-between frame) |
| f2 | the shield is up, he crouches under it |
| f3 | **plant**: the foot drives 1 px into the floor, dirt lip |
| f4 | the shoulder comes in |
| f5 | guard f0 |

- **Sound:** `kdPlant` fires on f3 (also on `positionChange` to defense).
- `MonsterUnit.brace(power)` replays these frames backwards on a guarded blow, so f2–f3 also read as "the shield absorbs and is re-planted".

**fromGuard:** holds `[60,60,60,70,70,70]` = 390 ms. The shoulder comes off, the shield lifts 1 px out of its rut, he straightens, and it ends on idle f0.

### 4.2 Summon: "Kalkan Kapısı Kalkar" (the drawbridge rises), sprite summon 14 f, land @ 8, 1170 ms

**Flow:** `runSummon` → v3 entrance (`S.pose`). The total is ≈ 1.5 s scene including the card slam. The body is real from frame 0; there is no hologram beyond a ≤ 150 ms bottom-up build of the flat slab (EF-11).

| f | ms | picture | sound |
|---|---|---|---|
| 0 | 70 | The copper slab lies **flat on the tile** (an iso parallelogram, boss up, ~10 px tall). The light pool gives one gold step under the boss. | `kdDrawbridgeCreak` `start()` |
| 1 | 70 | The slab rises **25°**, hinged on its far edge. Dust slides off its face (cinematic: 6–8 earth2/earth3 px fall). Two leather straps pull taut from behind (the giant, unseen, is hauling). | |
| 2 | 70 | 55°; the strap pixels stretch. | |
| 3 | 80 | 80° | |
| 4 | 90 | **Upright**, rocking 1 px. **Four fingers curl over the top rim**: the giant's first appearance is his hand. | creak `stop(80)` |
| 5 | 70 | The bald crown rises past the back edge. | |
| 6 | 80 | Eyes and brow appear; the white beard spills out. | |
| 7 | 70 | The shoulder and near arm come in; he lifts the shield 2 px. | `kdHeave` (short) |
| **8 land** | 60 | **He slams the foot into the floor.** | `kdPlant` + `S.roar()` → see below |
| 9 | 80 | The beard swings out 2 px; the boss holds its flare. | |
| 10 | 90 | The beard swings back 1 px. | |
| 11 | 100 | He straightens and exhales. | |
| 12 | 110 | Settle. | |
| 13 | 130 | Idle f0. | |

**Land beat (f8) in the cinematic:**
- A stepped crack line runs along the tile's front edge.
- A dust spray goes sideways (whole-pixel).
- Shake 2 px.
- The sunstone flares, and the rune seam sweeps top to bottom (light pass, 120 ms).

**Distinct from:** every other entrance. It does not climb from the ground (R2, C10), dive from the sky (storm_hawk) or rise as a light column. The inanimate shield stands up first; the giant comes after.

### 4.3 Attack: "Kale Kapısı Düşer" (the gate falls), attack 12 f

**Marks:** charge @3, release @6, contact @7, recover @9. `attackImpactFrame` = 6.

**Holds:** `[70,80,100,190,110,70,60,80,90,100,120,140]` = 1210 ms.
- HA-3: the longest hold is in anticipation (f3); the release frame is 60 ms; contact is 80 ms; the recovery holds never shorten.

**Declaration** (`battle/declare.ts`): plays f0–f3 and holds the **charge pose** with the voice charge `kdHeave` running (`holdCharge`).
- The giant is hunched under the shield, which is lifted 4 px off the floor in both hands.
- His beard is pressed against its back.

**Strike** (`registerStrike('shield_titan', …)`, from `strikeStartFrame`). This is a melee strike.

| f | picture |
|---|---|
| 4 (110) | **One heavy stride.** The sprite tweens from home to 18 px short of the target's contact point (whole px, 180 ms over f4–f5). A foot-thud dust puff is played on f4 (`kdStep`). |
| 5 (70) | The shield is raised high and tips forward over the target like a falling tower; the giant is at full stretch. |
| **6 release** (60) | It swings down edge-first. `kdSlabSwing`. A 1-px air smear in stone3 trails the top edge (not white). |
| **7 contact** (80) | **SLAM.** The bottom rim crashes onto the target; `s.impact()` fires **once**. In the cinematic, a short stepped dust wall (2 rows) jumps up along the slab's edge line, the floor cracks 6 px under the rim, and the boss flares. `kdSlabSlam`. |
| 8 (90) | He hauls the shield back up. |
| 9 recover (100) | He steps back; the sprite returns home over 300 ms. |
| 10 (120) | Small `kdPlant` (volume 0.5) on the re-plant. |
| 11 (140) | Idle f0. |

**Blocked variant.** The usual case, since ATK is 100:
- At contact the slab **rebounds**: a 1-px vertical jolt, then a 120 ms **"plate shiver"**. The sprite steps ±1 px horizontally on 3 frames, and `kdPlateShiver` (the copper wobble) plays.
- He slides back 3 px along the lane with heel dust, then walks home. He is not hurt: he is heavy and does not wince.
- The recoil number pops over him (battleV3).

**Attacker-loses variant** (titan in ATK position vs a stronger ATK monster): the counter-hit claims him at contact and §4.6's death starts from there.

**Direct variant: "Yer Sarsıntısı" (ground shock).** He does not walk to the duelist.

| beat | ms | picture | sound |
|---|---|---|---|
| f4–f5 | | He heaves the shield overhead in place. | |
| f6 | | He drops it **flat** onto the floor in front of his own tile (the slab hits face-down, boss up). | |
| shock | | A stepped crack line plus 1-px rock chips popping up every 8 px races along the lane to the opponent's duelist point (whole-pixel). **Contact = arrival**: `s.impact(arrivalPoint)` fires at the duelist, and 100 damage. | `kdShockRun` (gravel run) → `kdSlabSlam` (volume 0.6) at arrival |
| return | | f8–f11 are played as he lifts it back. | |

**Totals:**
- Direct: ≤ 1.5 s scene (≤ 2.32 s game).
- Attack on a monster: ≈ 1.75 s scene including the reaction (≤ 3.19 s game).

### 4.4 Hit reactions (from attack position; in defense, `guardHit` uses guard/toGuard)

**hit (6 f):** holds `[50,60,130,100,120,130]`, recover @3 (starts at 240 ms).
- f0: the shield is shoved 2 px into him (the slab takes it, not him).
- f1: his head bobs back 1 px; the top rim wobbles 1 px (copper flex).
- f2: the fingers re-grip.
- f3–f5: settle back to idle f0.

**hitHeavy (8 f):** holds `[50,70,90,100,110,120,130,140]`, recover @4 (310 ms).
- f0–f1: the shield is **knocked aside**. The slab steps out to 1 iso step (8°) away from him and his bare chest and beard are exposed for 2 frames.
- f2: he staggers half a step (the feet stay planted; the hips shift).
- f3: he hauls the shield back.
- f4–f7: plant and settle.

**hitMagic (8 f):** holds `[50,60,80,90,100,110,120,130]`, recover @4 (280 ms). **The copper conducts.**
- f0–f2: the rune seam and rim crackle. Light-pass 1-px gold3 zigzags run along the rim (≤ 20 % noise; they are effect pixels).
- f1–f3: his beard **bristles outward** (static), the braid lifts, and he jerks his rim hand off for one frame and shakes it.
- f4+: he re-grips and the beard falls back.

**Common rules:**
- f0 differs from every idle frame by < 50 % (KK-4): only the shield and one limb move on f0.
- Hit-stop is `heavy`.

### 4.5 Signature EFFECT: "Sur Kalkanı" (the rampart ward saps the attacker)

**Engine flow** (`rules.ts:1712-1815`, `query.ts:276`), in one batch after the trap window:

```
attackDeclare → [decision(trapResponse) | responseDeclined] → [flip(titan, cause:'attacked') if it was face-down]
→ activate{kind:'monsterEffect', uid: titan, player: titan's controller, from:'monster'}
→ battle{attackerAtk = ATK − 500 (min 0), targetPosition:'defense', targetValue: 2600, result}
→ [damage(attacker's controller, recoil) | damage(pierce)] → [destroy(titan) → toGraveyard]
```

**When there is no activation:**
- The titan is in ATK position.
- The attack is direct.
- The attacker's ATK is 0.
- The attack was negated (`attackNegated`).
- The attacker died in the trap window.

**Hook:** `registerCardHook('shield_titan', 'effect', wardV3, { priority: 20, name: 'kart-f:shield_titan:effect' })`, gated on `LOOK_V3`.
- Find the attacker: the next `battle` with `targetUid === ctx.ev.uid`. Take `attackerUid` and the debuffed `attackerAtk`.
- `const hold = ctx.take('attack')`, then `dropCharge(attacker, 120)`.
- At the end, call `holdFrame(attacker, 'attack', declarePoseFrame(attacker))` and `ctx.keep('attack', hold)`, so the strike starts from the charge pose and not from frame 0. This is the grim_warden pattern from HANDBOOK §6.4.

**Sprite `special`** (12 f, marks charge @2, release @4, recover @9):
- Holds `[80,110,170,60,70,90,90,90,100,110,120,140]`.
- The body is guard-based. f9 equals guard f0, and f10–f11 bridge to idle f0 to satisfy HA-14.
- **The hook plays f0–f9 only**, then calls `u.rest()`, which returns to the guard loop seamlessly.

**Timeline** (scene ms; target **1150 ms**, budget ≤ 1600 ms scene / 2.32 s game):

| t | titan (special f) | ward / attacker | plate | sound |
|---|---|---|---|---|
| 0 | f0–f1: weight into the shield; heels dig in (1-px dust) | arena dims to 0.2 (existing `arenaDim`) | — | `kdWardWake` `start()` (sustained) |
| 80–260 | f2 (charge, 170): the **sunstone opens**: 3 stepped iris rings on the boss (gold2 → gold3 → gold4); the rune seam lights top to bottom (1 px gold3, 4 steps) | gold floor-light pool in front of the shield (stepped) | — | |
| 260 | **f3–f4 release**: he drives his shoulder in | **RAMPART WALL.** From the titan's tile edge that faces the attacker, an iso **vertical plane of light** rises in 4 whole-pixel steps (0 → 36 px over 120 ms). It is drawn as **brick courses** (rampart masonry): gold3 1-px mortar lines every 6 px, staggered vertical joints, a gold4 top edge and crenellations (merlons, 3 px, every 6 px). The interior is empty, so the titan stays visible (EF-2). It is not a hex: the generic guard glint is hex, so ours is masonry. | — | `kdWardWake` `stop(60)` → `kdWardWall` |
| 380–880 | f5–f8: a shoulder shove on each pulse (90 ms each, alternating shove and hold) | **Five SAP pulses**, one every 100 ms. Each is a **chevron wave** (3 stepped 1-px gold lines bowed toward the attacker) that leaves the wall and travels along the lane line to the attacker's front face in 120 ms (whole px). On arrival: the attacker is shoved **1 px** back along the lane (3 px max, springing home after pulse 5). **4–6 pixels of the attacker's own attribute-ramp colour** are peeled off its struck face and blown backward, fading in 2 palette steps (its strength stripped). One stepped floor-light dip under the attacker. | ATK rolls **−100 per pulse**: 1900 → 1800 → 1700 → 1600 → 1500 → 1400 (crimson battle tint) | `kdSapStep` × 5 on each arrival, a descending copper gong (G2 → F2 → D2 → C2 → A♭1); `kdSapDrain` once on the last (attacker pan) |
| 880–1000 | f9 ≈ guard f0 | The wall **settles into a 1-px rampart line**: the merlon top edge in gold2/gold3, flat on the tile's front edge. It stays as `setAura('kdWard', …)` until contact (§4.5.1). A small tag **"−500"** in the battle-debuff crimson, Turkish UI font, pops over the attacker's plate and lives 600 ms (`src/ui/text.ts`). | 1400 holds | |
| 1000–1150 | `u.rest()` → guard loop | The attacker is held in its declaration charge pose (`holdFrame`); arena dim stays for the strike | — | |

**How the game meaning is made readable:**

| question | answer on screen |
|---|---|
| **Who acts** | Everything comes out of the titan's sunstone and the rampart on the titan's own tile edge. |
| **Who is affected** | The chevrons point at the attacker and only the attacker is shoved and stripped. |
| **How much** | The number visibly falls in five equal steps, one per pulse and one gong each, ending on "−500". |
| **For how long** | The rampart line stays until the blow lands, then it is spent (§4.5.1): the debuff is for this battle only. |

**Plate timing: a shared-file coordination request.**
- Today `battle/declare.ts:374` → `showBattlePlates` already shows 1400 at the **declaration**, before the trap window.
- Worse, for a **face-down** titan, `battlePlates` counts face-down as defense, so the plate drops before the flip and **leaks the hidden card's identity**.
- **Preferred fix:** a small coordinated change in `battle/plates.ts` (orchestrator approval; lane B wants the same for grim). At declaration, skip the attacker debuff when `attackerDebuffBy` is set. The ward hook then rolls the plate through `showBattlePlates` (so `tinted` and rollback stay correct), with the five steps paced by intermediate `u.setStats` calls before the final `showBattlePlates`.
- **Fallback if refused:** the plate is already at 1400. Each pulse instead **pops the badge** (no number change) and the last pulse stamps the "−500" tag, so the ward visually "justifies" the drop. The face-down leak is then logged as an open issue.

#### 4.5.1 Defend layer (the blocked contact): "Geri Tepme" (the repel)

`registerCardHook('shield_titan', 'defend', …, { priority: 20 })` subscribes **once** to the scene's `v3:contact` event (emitted by battleV3 on the contact frame), then `await ctx.base()`. battleV3 still owns the reaction, number, deaths and timing. No new focus or zoom.

**On the contact frame, if blocked:**
- The rampart line **flashes back up** to a full wall for 2 frames on the struck side (white top edge, gold3 bricks).
- **One** stepped 1-px ring shock spreads from the boss (EF-7: at most one ring).
- A gold push chevron slams into the attacker, adding 2 px to the generic recoil.
- `kdRepel` (copper strike + wobble, panned to the clash).
- The wall then **spalls**: its bricks drop as 6–10 gold2/earth3 pixels that fall 4 px and blink out over 200 ms (stepped).
- The aura is cleared.

**If not blocked** (the wall is broken, e.g. 2900 vs 2600):
- The bricks **crack diagonally** and burst outward with the blow.
- `kdWallBreak`.
- The death (§4.6) follows from the guard break.

**Expiry safety:** an observer clears `kdWard` on `attackNegated`, `phaseChange`, `turnStart`, `destroy` and `gameOver` (pattern: HANDBOOK §6.5).

**Known generic overlap:** `MonsterUnit.guardHit` still draws its small blue hex glint (`guardGlint`). Ours sits over it at contact. A per-art opt-out (e.g. `art.guardGlint: false`) would be a shared change; it is raised in open issues and is not done unilaterally.

### 4.6 Death: "Kapak Kapanır" (the gate slams shut), death 11 f, dissolve @5, 840 ms

**Holds:** `[50,70,90,80,70,60,50,50,110,90,120]` ms. The death runs through `deathV3` (option a).

| f | picture | sound |
|---|---|---|
| 0 impact/contact | The struck pose continues from the reaction: shield shoved, giant's head snapped back. | (the blow's own) |
| 1 | He staggers; the shield is shoved 2 px. | `deathStart`: `kdKneel` |
| 2 | **His knees buckle**; the giant drops 3 px; the shield tilts 5° forward. | |
| 3 | He kneels; his fingers slip down the rim. | |
| 4 | He slumps against the shield's back; the shield is at 15°. | |
| **5 dissolve** | **The shield tips over**, hinged on its front-bottom edge, to 35°. His hand slides off and he falls forward behind it. | `dissolve`: `kdTopple` |
| 6 | 60° | |
| 7 | **SLAM flat.** The slab lies on the tile face-down over him, like a gate or tomb lid. Only the white beard tip and one hand show at its back edge. Cinematic: a **rectangular dust ring** traced along the slab's 4 edges (stepped, whole-px, 2 rows). Shake 2 px. | afterDissolve `[2, 'kdLidSlam', 1.0]` |
| 8 | The slab bounces 1 px. | |
| 9 | **The copper tarnishes**: band by band from the far edge to the near edge, fire2 → fire1 → fire0 (3 stepped frames inside f9–f10, cinematic overlay on the slab). | |
| 10 (final) | Dark slab; the sunstone gives **one last gold pulse**. **Final height ≈ 10 px**: top row ≥ anchorY − 14, so the test's ≥ anchorY − 24 passes. | |

**Burst (the last ~150 ms, EF-12):**
- The slab breaks as **`light`** material: its pixels rise as motes, the ward's light leaving the dead copper.
- The card is born on that frame.
- Sound: `burst` = `kdWardRise`.

**Totals:** the whole death is ≈ 1.1 s scene (≤ 1.4 s; ≤ 2.03 s game).

**Final material (unique, checked against §5.2):** the drawbridge or gate that **closes over** its bearer, the **copper tarnishing dark**, and the **ward light rising out** of it.
- It is not ash or rubble (R1 / stone_sentinel).
- It is not returning into the tile (C6 / C10).
- It is not splitting (C7) or a collapsing shroud (R2).

**Coherence:** the summon raises the gate, and the death drops it.

**`DEATH_PRESETS` line:** `shield_titan: { material: 'light', accent: 'light' }`.
- `material` gives the mote burst on the last frame.
- `accent: 'light'` at dissolve stays subtle (a few motes from the boss) under our own tarnish layer.
- Stone is removed.

**Hook:** `registerCardHook('shield_titan', 'destroyed', …)`. It calls `deathV3(ctx, { fallback, onBurst })` unless `ctx.ev.location !== 'monster'` or `sourceOwnsDeath(ctx)`. The dust ring and the tarnish run as `atMark` / `atFrame` layers.

### 4.7 Revive (soul_recall): "Kapağı Kaldırır" (he lifts the lid), revive 12 f, land @7, 1050 ms

**Holds:** `[100,80,70,70,60,70,80,60,90,110,120,140]`.

This is the reverse of the death, and it is **not** the summon. In the summon the shield rises alone and the giant appears after. Here **the giant lifts the slab from underneath**.

| f | picture | sound |
|---|---|---|
| 0 | The dark slab lies flat (the death's last frame). Gold motes descend into the sunstone (cinematic gather). | `kdWardReturn` `start()` |
| 1 | The copper re-brightens band by band, near → far (the tarnish reversed). | |
| 2 | The near edge lifts 10°; **his fingers** appear under it. | |
| 3 | 30°; his back and shoulder come out under the slab. | |
| 4 | 55°; he is kneeling and pushing it up. | |
| 5 | 80°; he rises on one knee. | |
| 6 | Standing; the shield is upright. | `kdWardReturn` `stop(80)` |
| **7 land** | **Plant.** | `kdReviveHeave` (hup + plant) |
| 8 | First breath: chest out, beard lifts. | |
| 9–11 | Settle to idle f0. | |

Total ≈ 1.05 s + soul_recall's own frame (≤ 2.0 s).

### 4.8 Roar (10 f, 1060 ms): "Kalkan Davulu" (the shield drum)

**Marks:** charge @1, release @3, recover @6. **Holds:** `[90,140,170,50,70,80,100,110,120,130]`.

He beats the shield's back twice with his fist (a war drum):
- f1–f2: wind-up.
- **f3**: bang 1.
- f5: bang 2.
- The sunstone flares on each bang.

Sound: `kdFistBang` on f3 and f5. Roar is used by the generic activate fallback and any `roar` call. It is not used for the ward.

### 4.9 Flip and position change

- **Flip** (face-down titan attacked): the generic v3 flip, then the guard loop, then §4.5 follows.
- **Position change** to defense: `toGuard` with `kdPlant` on f3. Both use the generic handlers; no new handler is planned.

---

## 5. Card art (`src/art/cardart-v3/shield_titan.ts`, rewritten natively in the crystal_wyrm.ts pattern)

**Big (88 × 68):**
- **Backdrop:** `paintBackdrop(EARTH, horizon 48)`.
- **Composition:** a low camera looking up.
  - The **tower shield fills x 30–80** and bleeds off the bottom.
  - The **sunstone boss is at (54, 30)**. It is the focus (`focus: [54, 30]`): a gold4 core in the light layer and the brightest point.
  - The faint rune seam runs down from the boss.
  - The **giant's head and white beard** peek from behind the shield's left edge (x 14–34, y 14–42), with one eye catching the light.
  - His **four fingers hook over the top rim** (x 40–56, y 6–10): the instantly-readable "huge hand" cue.
- **Edges:** rim light earth3 on the shadow side; a single `fire4` glint on the shield's upper-left corner.
- **Budgets:** subject fill 0.6–0.75; colours ≤ 20; backdrop ≤ 6; no dither, gradients or alpha.

**Small (44 × 34), hand-drawn:**
- Shield at x 15–40, boss 3 × 3 at (27, 15), the beard/head mass at x 6–16, the fingers as a 1-px skin row on the rim.
- Nothing on columns 0 / 43 or rows 0 / 33.
- **The 16 × 12 downsample must still show:** a copper bar, a gold dot and a white blob.

**Wiring:** `portrait()` on the shell blits `renderArt(card, 0).smallPx`.

---

## 6. Cut-in: decision

**Drop it.** Delete `src/art/cutins-v3/shield_titan.ts`.
- The card is Lv4, normal-summoned and not an ace, so `S.climax()` never fires the band (`ace && tribute`). The cut-in would never play.
- The existing file is a bust of the rejected slab-with-eyes design and imports its rig.

The signature moment is the ward (§4.5), not a portrait.

---

## 7. Sound identity (checked against YENI_KARTLAR §5.1)

| | shield_titan |
|---|---|
| **Main pitch / colour** | **G2 98 Hz copper plate ring**: FM `v.bell` with inharmonic ratio 2.76, index ~2.5, with a 196 Hz partial. Warm and low-mid; the A-weighted centre is aimed at ~500–900 Hz. |
| **Signature material** | A **copper tower plate + leather straps + bare-foot thuds**. Sources: plate rings, strap creak (brown-noise band 120–400 Hz), low `thump` with drive. |
| **Distinguishing layer** | **"Thunder-sheet" plate wobble**: every plate ring is amplitude- and pitch-fluttered at 6–8 Hz (`v.flutter`, `v.lfo` on the bell frequency, ±12 cents), decaying with the ring ("wub-wub-wub"). The ward adds the **five descending gong steps** (−100 each). |
| **Giant's voice** | A short chest "HUP" (brown `puff` + a 150 → 320 Hz `sweep` formant). **No `growl`**, which C10 owns. |

**Collision check against §5.1:**

| owner | their sound | why ours does not collide |
|---|---|---|
| C12–C15 | steady 110/111 Hz beating hum | Ours is a struck, decaying ring; the flutter dies with the ring; there is no sustained beat. |
| C15 | 35 Hz iron gong | Ours sits 1.5 octaves higher, is copper and is short (≤ 1.2 s). |
| abyss_magus | FM 1.41 armour clank at 470–760 Hz | Ours uses ratio 2.76 at 98–196 Hz. `clank()` is used only with `ratio: 2.76`. |
| S10 | low beating drone | We have no drone. |
| C6 | 180 Hz wood creak | Our creak is leather noise, not a tonal wood creak. |
| R2 | `glassReverse` | We use no `glassReverse`. |
| crystal_wyrm | `glassBell` / `glassRain` | We use none. |
| stone_sentinel | stone grind | We have no grinding rumble. |
| C2 | 3.2 kHz tick-tock | Our steps are low gongs. |
| windmane_knight (lane F) | `plate()`: an FM 2.76 "plate clank" on 330 Hz | Round 2: the titan's copper moved to FM ratio **3.11** (2.76 is theirs and the wyrm's); ours is a 98 Hz ring with the wub tail, theirs a dry 330 Hz clank. |
| crystal_wyrm | the 2.76 bar-mode ratio of its glass (`slice.ts`) | Round 2: ratio 3.11 for every titan plate / bell layer; no glass partials. |
| S11 | "kitap kapanması PAT" (a bright 1–3 kHz book-close slap) | The lid slam's slap is low-mid only (pink band at 480 Hz, no 1–3 kHz crack since round 2) and always carries the 98 Hz wub tail. kdTarnish's cooling ticks sit at 1.6–2.1 kHz, irregular (not C2's 3.2 kHz tick-tock). |

SE-4 is checked offline by LSD against stone_sentinel, steel_silencer, polar_anvil and hollow_ogre, the nearest families.

### 7.1 Recipes (`src/audio/v3/shield_titan.ts`, `SHIELD_TITAN_RECIPES`) and beats

| recipe | where / when | recipe sketch | duck |
|---|---|---|---|
| `kdDrawbridgeCreak` | summon f0 → f4 (`start` / `stop`) | leather-strap creak: brown band-pass 120→400 Hz, slow `wander`; 1.2 s long | 0.25 |
| `kdHeave` | voice `charge` (declaration, sustained); summon f7 | chest "hup" + strap creak loop, 1.5 s | 0.3 |
| `kdStep` | strike f4 | bare-foot thud: `thump` 70→45 Hz + low puff | 0.3 |
| `kdSlabSwing` | voice `release` (strike f6) | big-surface air push: pink `sweep` 200→900→150 Hz, 0.25 s | 0.35 |
| `kdSlabSlam` | voice `impact` (contact) | flat slap: low `puff` + `thump` 80→40 Hz drive + 98 Hz plate ring with wobble + gravel `crack` | 0.6 |
| `kdPlateShiver` | blocked strike, after contact | the plate ring alone, fast flutter 9 Hz, 0.5 s | 0.3 |
| `kdShockRun` | direct: shock line travel | gravel `crackle` run, panned L→R along the lane, 0.4 s | 0.4 |
| `kdPlant` | voice `land`; toGuard f3; strike f10 (vol 0.5) | "DUNK": `thump` 55→38 Hz drive + short crack + 98 Hz ring, short wobble | 0.55 |
| `kdFistBang` | voice `roar`; roar f3, f5 (cap 4, gap 0.02) | fist on copper: 98 + 196 Hz ring, strong wobble, knuckle click | 0.55 |
| `kdWardWake` | effect t0 (sustained, stop at the wall) | 49 Hz sine swell + slow-attack 98 Hz ring; flutter rate rising 3→9 Hz | 0.4 |
| `kdWardWall` | effect release (wall rises) | G2 copper strike + pink `sweep` up 300→2500 Hz ("ZHUNG") | 0.6 |
| `kdSapStep` | effect, ×5 on each pulse arrival (cap 6, gap 0.008); `pitch` per call: 1, 0.891, 0.749, 0.667, 0.561 (G2 F2 D2 C2 A♭1) | short copper gong step + soft push "thup" | 0.3 |
| `kdSapDrain` | effect, last pulse (attacker pan) | low-passed noise "fwoomp" falling 900→120 Hz (not a glass reverse) | 0.35 |
| `kdRepel` | defend layer, blocked contact | copper strike + wobble + reversed-envelope push puff toward the attacker | 0.55 |
| `kdWallBreak` | defend layer, wall broken | gravel `crack` n=6 + 98 Hz ring cut short (damped) | 0.55 |
| `kdKneel` | voice `deathStart` | two soft knee thumps + strap creak | 0.3 |
| `kdTopple` | voice `dissolve` | creak rising + air `sweep` down 1200→200 Hz | 0.4 |
| `kdLidSlam` | voice `afterDissolve [2, …, 1.0]` | huge flat SLAP: low puff + `thump` 60→32 Hz drive + 98 Hz ring with "wub-wub-wub" decaying flutter + dust puff | 0.7 |
| `kdWardRise` | voice `burst` | three warm `v.bell` partials on G (196, 294, 392 Hz, ratio 2.0) rising and fading + fading wobble | 0.4 |
| `kdWardReturn` | voice `reviveGather` (sustained) | the same partials gathering downward + rising flutter | 0.35 |
| `kdReviveHeave` | voice `reviveLand` | "hup" + `kdPlant` body in one recipe | 0.55 |

**Voice:**

```
SHIELD_TITAN_VOICE = { roar:'kdFistBang', arrive:'kdDrawbridgeCreak', land:'kdPlant', charge:'kdHeave',
  release:'kdSlabSwing', impact:'kdSlabSlam', deathStart:'kdKneel', dissolve:'kdTopple',
  afterDissolve:[[2,'kdLidSlam',1.0]], burst:'kdWardRise', reviveGather:'kdWardReturn', reviveLand:'kdReviveHeave' }
```

- It is set **only** in the same change that ships the strike and death cinematics (HANDBOOK §7.3).
- Struck-body hits on the titan fall back to the generic material sound (`GENERATED_HIT_MATERIALS` = stone only). The defend layer's `kdRepel` carries the identity on blocks. A "copper/metal" struck material is an orchestrator question.
- Peaks ≤ −1 dBFS. Verify with `?dev=audio&page=one&name=<sfx>&log=1` and `tools/clip.mjs`, and send the MP4.

---

## 8. Files

**New or rewritten (owned):**

| path | notes |
|---|---|
| `src/art/monsters-v3/_shield_titan.ts` | Drafted here, renamed to `shield_titan.ts` once the sprite gates pass. Shell: `MonsterArt`, `portrait()`, `weight:'heavy'`, `p2:'relight'`, `points()`, `joints()`. |
| `src/art/monsters-v3/shield_titan-rig.ts` | `W=80, H=84, AX=36, GY=78`; `Pose`; part painters; hand-drawn iso shield slabs at 0/25/55/80/90°. |
| `src/art/monsters-v3/shield_titan-anims.ts` | `ANIMS`, `EXTRA_ANIMS`, `IMPACT=6`, `MUZZLE`; cached `framePose` / `framePoints`. |
| `src/art/monsters-v3/shield_titan-maps.ts` | Hand, head/beard, fingers; `_L`/`_R` pairs. |
| Delete | The draft's `shield_titan-build/-parts/-shield/-kit/-fx/-maps(old)/-anims(old).ts` and old `shield_titan.ts`. |
| `src/art/cardart-v3/shield_titan.ts` | Rewritten (§5). |
| `src/art/cutins-v3/shield_titan.ts` | **Deleted** (§6). |
| `src/cinematics/kart-f/shield_titan.ts` | Every registration gated on `LOOK_V3`, priority 20, names `kart-f:shield_titan:<part>`: `summon` hook (`runSummon` + v3 entrance), `registerStrike` (bash / blocked shiver / direct shock), `effect` hook (ward), `defend` hook (repel layer), `destroyed` hook (`deathV3` + dust ring + tarnish), the `kdWard` aura observer. Seeds are per uid. |
| `src/cinematics/kart-f/_kit.ts` | Only if a shared helper is needed: exports only, no side effects. |
| `src/audio/v3/shield_titan.ts` | Recipes and voice (§7). |
| `src/duel/scenarios/shield_titan.ts` | Scenarios (§9). |
| `tests/art/shield_titan.test.ts` | Rewritten: validateArt normal; anims and marks; palette (no cyan/crim/teal/mag; gold3/gold4 only in the light pass); margins; points; idle liveliness; KK-4; P2 relight; **death final top ≥ anchorY − 24**; summon f0 is a flat slab; card art at both sizes. |

**Shared one-liners** (re-read right before each edit; small additive Edit calls):

| file | edit |
|---|---|
| `src/art/monsters/index.ts:35` | Delete only `'!../monsters-v3/shield_titan.ts'` when the card passes its gates. |
| `src/cinematics/_v3/presets.ts:54` | `shield_titan: { material: 'light', accent: 'light' },` |
| `src/view/light/profiles.ts:86` | `shield_titan: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.7)], halo: 0.5, pool: 0.85 },` |
| `src/audio/v3/kart-f.ts`, `sfx.ts`, `sounds.ts`, `_v3/sound.ts` | Already wired; no edit. |
| `src/cinematics/battle/plates.ts` (+ `declare.ts:374`) | Only with orchestrator approval (§4.5): skip the attacker debuff at declaration. Otherwise use the fallback. |

---

## 9. Scenarios (prefix `kd`, `src/duel/scenarios/shield_titan.ts`)

| key | stage → steps | shows |
|---|---|---|
| `kdSummon`, `kdSummonP2` | titan in hand, an opposing monster present → `normalSummon` zone 1 | drawbridge summon (P1 / P2 relight) |
| `kdGuard` | titan in ATK, `enteredTurn` earlier → `changePosition` | toGuard "DUNK" + guard hero loop |
| `kdWall`, `kdWallP2` | shade_assassin (1900) vs DEF titan → attack | **ward**: 1900 → 1400 in 5 pulses, blocked, repel, 1200 recoil |
| `kdWallFlip` | titan face-down → shade_assassin attacks | flip → ward → blocked; no plate leak (with the plates fix) |
| `kdWallRanged` | crystal_wyrm (2800 → 2300) vs DEF titan | ward vs breath; blocked (backlash) |
| `kdWallBreak`, `kdWallBreakP2` | coral_serpent + 2× dragon_blade (3400 → 2900) vs DEF titan | ward, wall breaks, death "Kapak Kapanır", pierce 300 |
| `kdAttackBlocked`, `kdAttackBlockedP2` | titan (ATK 100) attacks stone_sentinel in DEF (2100) | gate-fall bash, rebound and plate shiver, 2000 recoil |
| `kdAttackDie` | titan attacks ember_wolf (ATK 1700) | bash, counter-hit, death at contact |
| `kdDirect`, `kdDirectP2` | titan with an empty opposing field → direct | ground-shock line, 100 damage |
| `kdKill` | ember_wolf attacks titan in **ATK** position | no ward (no activate), hitHeavy → death |
| `kdNegated` | shade_assassin attacks DEF titan, defender has `chains_of_light` set | no ward (negated) |
| `kdRevive` | titan in graveyard, `soul_recall` in hand → activate | revive "Kapağı Kaldırır" |

Every key gets filmed with `--fresh &look=v3` and LOOKED at.

---

## 10. Gates (HANDBOOK §9)

**Static checks:**
- `npm run typecheck` is clean for owned files.
- `npm test` has no new failures; `tests/art/shield_titan.test.ts` passes.
- Sprite sheets:
  - `npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/_shield_titan.ts --look v3 --anims all --scale 3 --points --out shots/v3/kart-f/shield_titan/sheet` (plus `--p2`)
  - `npx vite-node tools/monster-gates.ts <p1.json> <p2.json> --class medium --ref none` (exit 0)
- **KK-13 budget:** 80 × 84 × 4 B × **129 frames** = 3.47 MB ≤ 3.6 MB medium, ≤ 140 frames.
  - idle 16, guard 8, toGuard 6, fromGuard 6, attack 12, roar 10, hit 6, hitHeavy 8, hitMagic 8, summon 14, death 11, revive 12, special 12.
  - No victory anim.
- **Sameness:** `npx vite-node tools/sameness.ts --look v3 --art src/art/monsters-v3/_shield_titan.ts --against all`. Below the KEY / MOT / SI thresholds; watch stone_sentinel, steel_silencer, hollow_ogre, crag_axeman and windmane_knight.
- Palette over the film frames: `node tools/palcheck.mjs`.
- `npx vitest run tests/art/cardface-v3.test.ts`.

**v1 and camera:**
- `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` gives 17/17 IDENTICAL; `--set a6v1` gives 26/26 IDENTICAL.
- `node tools/measure.mjs --look v3 --scenarios 'kd*,m1Shield' --camera-gate shots/v3/kart-f/camera-base.json`: zoom 1, closeUps 0, focusCalls equal to the base (no new `ctx.focus`).

**Timing budgets** (`measure`, game clock):

| moment | limit |
|---|---|
| effect | ≤ 2.32 s (target ≈ 1.55 s) |
| attack on monster | ≤ 3.19 s |
| direct | ≤ 2.32 s |
| death | ≤ 2.03 s |
| revive | ≤ 2.9 s |
| number − contact | ±17 ms |

**Sound:** marks in sync (`sfx[]` × `anims[]` d ≤ 1 frame at 1× and 3×); clips peak ≤ −1 dBFS, 0 clipped; MP4 of `kdWall` and `kdWallBreak` sent to the user.

**Card hash:** `card-hash --look v1 --compare` identical; v3 `--allow shield_titan`.

**Critique:** ≥ 3 rounds (film → LOOK → independent critic → fix). Per-round notes are appended to this doc.

---

## 11. Open issues / orchestrator questions

1. **`plates.ts` declaration debuff.** It shows −500 before the ward and leaks a face-down titan's identity. Proposed: skip `attackerDebuffBy` at declaration (one guarded line, shared with grim's `targetDebuffBy` request from lane B).
2. **Generic hex `guardGlint`** in `MonsterUnit.guardHit` draws over the titan's masonry ward on blocks. Proposed: a per-art opt-out flag (shared file).
3. **Struck-body material** for copper/metal does not exist (`GENERATED_HIT_MATERIALS` = stone). Blocks are carried by `kdRepel`.
4. **Gold emissive** is also used by hourglass_imp (lane F, LIGHT sand). They are kept apart by shape (masonry wall and chevrons vs sand) and by the copper body. Re-check in the blind sameness test.

---

## 12. Design critique fold-in (round D1, verdict needs-work) — supersedes the named sections

Every finding was checked against the code; decisions below. Where a row says *accepted*, the
earlier section is superseded by the text here.

### 12.1 Frame, geometry and axes (findings 1, 13) — accepted, approach (b) with the side-view convention

| item | value |
|---|---|
| Frame | **84 × 82**, anchor **(34, 77)** (`GY` 77), hover 0, walker, `heavy`, `p2:'relight'` |
| Frames | idle 16, guard 8, toGuard 6, fromGuard 6, attack 12, roar 10, hit 6, hitHeavy 8, hitMagic 8, summon 14, death 11, revive 12, special 12 = **129** → 84×82×4×129 = **3.55 MB ≤ 3.6 MB** (medium) |
| Shield | face 22 × 56 (u = length, v = width), 2-px back edge + 1-px top edge visible, top rim y 22, foot on GY; the giant's crown is at y 29 (**7 px under the rim in idle; ≥ 5 px in every standing pose**) |
| Rendering | the shield is ONE texture `tex(u, v)` drawn through a 2-D affine map `O + u·U + v·V` (+ thickness vector T): every slab state (upright, tilted, lying, rising) is the same hand-authored texture, so bands, boss and rivets stay coherent and whole-pixel in the upright / idle state (identity map, IŞ-12) |
| **Lying-away (summon f0–f3)** | the slab lies face-up **into the screen** along the tile's vertical diagonal: `U = (0, −0.5)` (iso depth is half scale), `V = (1, 0)`. Projected face 22 × 28 px + a 2-px front (near) edge; the boss is an oval 9 × 5. Rising to upright is the projection `top = L·(0.5 cos θ + sin θ)` at θ 0/25/55/80/90° (28 → 49 → 62 → 60 → 56 px). Fits: top ≥ y 15. |
| **Lying-back (death f8–f10, revive f0–f1)** | the lid lies face-up **along screen-x** (the tile's horizontal diagonal, the side-view convention every v3 death uses for a prone body): `U = (−1, 0)`, `V = (0, 0.5)` → face 56 × 11 px + 3-px front edge, x 8–63, **top row y 64 = GY − 13** (the ≥ GY − 24 low-death test passes with 11 px to spare). The foot skids from x 36 to x 64 while the top falls back (a slab falling onto a body kicks its foot out), which is what makes 56 px fit in 84. |
| P2 | all of the above is P1 geometry; P2 is the same silhouette relit (`lightFrom 'right'`) and flipped by the game, so every axis mirrors automatically (lying-back runs right→left on screen for P2, the summon rise is symmetric). |
| Attack reach | the bash tilts the slab forward at most **16°** about its front-bottom corner, lifted ≤ 8 px: the top-front rim reaches x ≤ 78 (margin ≥ 2). `points().muzzle` on every attack frame IS the rim corner, so the strike's stride is derived from `framePoints('attack', contact).muzzle` (finding 13), not from a fixed 18 px. |

### 12.2 Death direction (findings 2, 11) — accepted

The blow shoves the shield **back**; he buckles and folds forward onto his knees and face behind it;
the shield **teeters upright alone for 2 frames** (the weight is felt: 1° forward, then back); then it
falls **backward onto him like a tomb lid, hinged on its back-bottom edge, boss UP**, the foot skidding
out. Final: the lid with the boss visible, the white beard tip and three fingers peeking from under its
near edge, the last gold pulse in the boss; the tarnish runs far → near (screen top → bottom; P2 the same
after the flip). This is "the gate closes OVER its bearer" — not hourglass_imp's sideways topple of a
held prop along the tile diagonal (coordinate with that author; noted for §5.2).

| f | ms | picture |
|---|---|---|
| 0 | 50 | struck: shield shoved 2 px into him, head snapped back (impact = contact = 0) |
| 1 | 70 | stagger; the shield leans back 4°, fingers slip off the rim |
| 2 | 90 | knees buckle, he drops 6 px |
| 3 | 80 | he folds forward, face down on his knees behind the shield |
| 4 | 70 | **teeter**: the shield stands alone, rocks 3° forward |
| 5 | 60 | teeter back to 0° (upright, alone) |
| 6 | 50 | **dissolve**: it tips backward, 30° (foot starts to skid) |
| 7 | 50 | 65° |
| 8 | 110 | **SLAM** flat (lying-back state) — dust ring is the cinematic's |
| 9 | 90 | bounce 1 px; tarnish starts at the far edge |
| 10 | 120 | tarnished dark copper, the boss's last pulse, beard tip + fingers under the near edge |

Total 840 ms (≤ 900). `DEATH_PRESETS` stays as planned (`light`/`light`).

### 12.3 Silhouette and accent vs stone_sentinel (finding 3) — accepted

- **No vertical seam anywhere.** The emissive lives only in (a) the sunstone core and **iris rings**
  (concentric, around the boss) and (b) **horizontal bronze courses** across the face (three 2-px bands
  with rivets, like masonry) whose top rows light **course by course** (`courses` 1–3) in guard, special,
  roar and summon land.
- The shield is clearly taller than the head in every standing pose (≥ 5 px) and the **four fingers over
  the rim** are visible in idle, guard, roar, hit, special and summon land.
- The 1× side-by-side vs stone_sentinel is part of every critique round (`shots/v3/kart-f/shield_titan/build/vs-sentinel-1x.png`).

### 12.4 Direct attack (finding 4) — accepted: "Kalkan Kızağı" (the shield sledge)

He drops the slab face-down flat, kicks it, it **skids along the lane on its boss** like a sledge throwing a
whole-pixel dust wake and slams into the duelist (contact = arrival); he hauls it back by its leather
strap (a stepped 1-px strap line across the lane). Sound: copper scrape (band-passed noise riding the
98 Hz ring with wobble) + strap creak on the haul. **No floor crack line, no gravel crackle run.**
`kdShockRun` is renamed `kdSledScrape` (+ `kdStrapHaul`). The sprite contributes attack f4–f6 (heave and
drop) and the cinematic draws the sliding slab as an overlay (lying-back texture, P2 mirrored via `forward(player)`).

### 12.5 Effect hook robustness (findings 5, 6, 7, 8, 9, 10, 15, 16, 17) — accepted, cinematic stage

- **Contact fallback (5):** the defend hook subscribes to `v3:contact` AND arms a fallback (the first
  `destroy`/`damage` of this battle played, or a timer from the strike's contact estimate) behind a `once`
  guard; the aura is cleared in a `finally` after `await ctx.base()`. Scenarios `kdWallBreakPierce`
  (coral_serpent) and `kdWallBreak` (shade_assassin + dragon_blade ×2) film both paths.
- **Weak attackers (6):** `pre = currentAtk(stateBefore, attacker)`, `drop = pre − ev.attackerAtk`;
  pulses = clamp(ceil(drop / 100), 1, 5), each −100, the last takes the remainder; gongs from the top of the
  descending list; the tag shows `−${drop}`. Scenario `kdWallWeak` (wisp_imp 300 → 0).
- **Timeline from the holds (7):** special holds `[80,110,170,60,70,140,140,140,140,140,140,150]`
  (marks charge 2, release 3, recover 9 → HA-3 longest 170 is the charge frame). f0–f1 0–190; f2 charge
  190–360 (iris rings, `kdWardWake`); f3 release 360 (wall, `kdWardWall`); f4 420; **five shove frames
  f5–f9 = five pulses** departing 490 / 630 / 770 / 910 / 1050 (140 ms spacing); f10 bridge 1190; ≈ 1.35 s scene,
  ≈ 1.85 s game (≤ 2.32).
- **Gong spacing (8):** 140 ms, each gong choked by the next; `kdSapStep` flutter 8–9 Hz with ≥ 1 cycle; pitch
  carried on the 196 Hz and 2.76× partials (A♭1 step audible through a 300 Hz high-pass); `kdWardWake` drops the
  49 Hz sine for the 98 Hz ring swell + strap creak (clear of R1 and S10).
- **Pulse shape (9):** each pulse is a **crenellation profile** (⊓⊓⊓ merlon outline, 1-px gold3, 3-px merlons)
  sliding off the wall like a shove of masonry, flexing 1 px as it travels. **No ▼/▲/V shapes anywhere** in this card.
- **Travel (10):** constant ≈ 1.3 px/ms, travel clamped 90–200 ms, quantized ≤ 8 px per frame; the next pulse's
  launch shifts, not its arrival. Scenario `kdWallRanged` on the 5+5 board, far lane.
- **Outcomes (15):** tie → the wall holds, both shiver, a "stalemate" spall, no recoil number (`kdWallTie`);
  guardian_charm → the wall cracks diagonally, then the guard re-plant ("DUNK") instead of the death, and the
  charm's break plays (`kdWallCharm`). §4.3 reworded: the titan attacking (ATK 100) usually **loses**; blocked
  happens only vs DEF monsters.
- **P2 / 5-lane (16):** wall length = tile edge − 4 px; depth = titan depth + 0.5 (under row+1 sprites); every
  overlay direction from `forward(player)` / `facesLeft`; tarnish far→near after the flip. Scenario `kdWall5`.
- **Plates (17):** the shared `plates.ts` request is raised with the orchestrator together with lane B's; if it is
  refused, the fallback at least skips the debuff when the target is face-down (one line), and that change is a
  blocker for `kdWallFlip`.

### 12.6 Summon / revive (finding 14) — accepted

Summon f0: the giant is **real from frame 0**, a crouched mass to the left of the slab's hinge, both fists hauling
two taut leather straps tied to the slab's far (top) edge; the slab lies face-up into the screen (§12.1). f1–f4 the
slab rises toward him as he hauls and straightens (θ 25/55/80/90°); f5–f7 he steps into the grip, fingers over the
rim; **f8 land**: the plant. Revive starts with **no giant visible**: the tarnished lid (death final) re-brightens
first (f1), then the lid lifts from its near edge with his back under it (f2–f5) — a different axis (lying-back →
upright) from the summon's (lying-away → upright). The 1× check of summon f1–f3 vs revive f2–f4 is in the build log.

### 12.7 Hit sound (finding 12) — accepted for the SFX stage

A `defend` hook on every battle where the titan is the target layers `kdPlateHit` (98/196 Hz, 2.76 FM, 0.3 s
flutter, ≈ 0.6) under the generic stone material; `kdRepel` stays for warded blocks. The copper struck-material
request is raised with the orchestrator (§11 item 3).

### 12.8 Rejected or changed

- **Finding 1, approach (a)** (prone slab as a tile overlay only) is rejected for the sprite: the death and revive
  must be self-contained sprite anims (`deathV3` plays them in every context, also soul_recall). The overlay is
  used only for the direct-attack sledge, which leaves the sprite.
- The doc's "~10 px tall" lying slab is replaced by the measured numbers in §12.1 (lying-back 14 px with its edge).
- §4.2's crack line on the summon land is dropped (it echoed C7's crack): the land beat is the plant, a
  sideways whole-pixel dust spray and the courses lighting bottom → top.

---

## 13. Build log — stage "Build art" (rig, card art, test)

### 13.1 What was built

| file | content |
|---|---|
| `src/art/monsters-v3/shield_titan.ts` | shell: hand-built `MonsterArt`, 84×82, anchor (34, 77), `heavy`, `p2:'relight'`, `points()`, `joints()`, `portrait()` → `renderArt(card,0).smallPx`; distinction header vs stone_sentinel |
| `src/art/monsters-v3/shield_titan-rig.ts` | `Pose` / `NEUTRAL`, skeleton (IK arms + legs), part painters (legs with leather wraps + iron knee guards, kilt with belt + buckle, torso + bandolier, arms + bracers + fists, bald head + brow + eye, white beard with combed strands + braid, hanging strap, four fingers over the rim, summon haul straps, death peek), and **the shield as one texture `tex(u,v)` through an affine map** (upright / tilted / lying-away / lying-back) with a thickness sweep, arched top, convex copper profile (fire0–fire3), bronze rims with studs, three bronze courses (the middle one runs through the boss), the boss; light pass after the outline: sunstone core (3 levels), iris rings, lit courses (+ white-hot top course), rim crackle, plus the dim bronze ripple and the copper glint |
| `src/art/monsters-v3/shield_titan-anims.ts` | 13 anims / **129 frames**: idle 16, guard 8, toGuard 6, fromGuard 6, attack 12, roar 10, hit 6, hitHeavy 8, hitMagic 8, summon 14, death 11, revive 12, special 12; marks per §4/§12; `framePoints` (attack muzzle = the rim corner, else the boss; core = the face centre) |
| `src/art/monsters-v3/shield_titan-kit.ts` | bbox `planes` / `Comp`, flat `bands`, tone sets |
| `src/art/cardart-v3/shield_titan.ts` | rewritten: the bust of the ward waking (rig pose: boss open, iris ring, bottom course lit), small = sprite crop + hand patch (eye / brow), big = EPX of the same crop with a fresh outline, light repainted after the outline; 2 living frames (260 ms); colours merged to ≤ 20 |
| `tests/art/shield_titan.test.ts` | rewritten (13 tests): registration (no exclusion, no draft / cut-in file), validateArt normal = [], marks, 129-frame budget, palette (no cyan/crim/teal/mag) + margin in both lights, points, HA-18/17/19 both lights, KK-4 phase + HA-9 feet band, P2 silhouette, gold3/gold4 only as light, bash reach + contact flare, the lid death (low, long, last pulse, peek, teeter) + revive from it, summon (slab low + giant real from f0; ≠ revive f2–f4), card art budgets + portrait wiring |
| deleted | the draft `-build/-fx/-parts/-shield/-maps` files and `src/art/cutins-v3/shield_titan.ts` (§6) |
| shared one-liners | `src/art/monsters/index.ts`: **only** the `shield_titan` exclusion removed (gates green); `src/view/light/profiles.ts`: `emissive [gold4 1, gold3 0.7], halo 0.5, pool 0.85` (white removed); `src/cinematics/_v3/presets.ts`: `material 'light', accent 'light'` (stone removed) |

Changes against §12 found while building: the death is `dissolve @ 6` (f6 is the tip-over); the lying-back
map turns the width axis UP (front edge far) so the face never mirrors mid-fall (det = cos² + ½ sin² > 0);
special `recover @ 10` (five shove frames f5–f9, f10 = guard f0, f11 = idle f0). The idle's liveliness comes from
an alternating one-thing-per-frame schedule (chest → head → the shield settling 1 px into its rut / hefted → beard
tip), a dim bronze ripple stepping out from the boss (the sleeping ward) and a copper sheen drift; feet and the
shield's foot never leave the feet band.

### 13.2 Iterations (looked at every PNG)

1. **r1** — first render: read as a door / ladder (flat copper, three even bands), a lidded block of a hand on top,
   the lying-back fall collapsed to a line at 55° (degenerate map), liveliness 5 %.
   Fixes: arched top + convex sheen + studded rims; middle course through the boss; four distinct fingertips with
   gaps over a knuckle hump; rotation-consistent lying-back map; idle schedule rebuilt.
2. **r2** — gates: Sİ-2 (roar f1 elbow at the edge), HA-9 (idle dust speck + toGuard dust outside the feet band);
   liveliness 7.7 → 15.2 %; KK-4 phase 0.57 → 0.40 (the shove moved from hit/death f0 to f1). Fixed.
3. **r3** — knee guards shrunk (they read as grey blobs when the knee bends far forward in revive). All gates green.

### 13.3 Gates and evidence (`shots/v3/kart-f/shield_titan/build/`)

| gate | result | evidence |
|---|---|---|
| `monster-gates --class medium --ref none` (P1 + P2) | **21 ok, 0 FAIL** (HA-18 15.2 / 15.4 %, HA-17 1.27, HA-19 0.45, KK-4 phase ≤ 42.6 %, KK-13 3.55 MB / 129 f / 2.8 ms) | `gates-r3.txt`, sheets `r3/`, `r3-p2/` (`r1/`, `r2*` earlier rounds) |
| `validateArt(normal, melee)` | `[]` | test |
| `tests/art/shield_titan.test.ts` | 13/13 | — |
| full `vitest run` | 3 failures, none ours: dusk_ashen, hourglass_imp (known), cardface-v3 G1 `scrap_raiders` 0.692 (not this card) | — |
| typecheck | clean for owned files | — |
| sameness `--against all` | UYARI only (no KALIR in plan). Closest: **stone_sentinel** (KEY 0.677, MOTloop 0.745, MOTavg 0.561, SIL0 0.75), windmane_knight MOTsig 0.839 (that rig is mid-build by the other lane-F agent; re-run when it lands), steel_silencer KEY 0.628 / MOTsig 0.559. The roster baseline is similar (stone_sentinel itself has 44 UYARI rows). Distinction header in the shell; blind 1× side-by-side | `same/sameness.txt`, `same/shield_titan__stone_sentinel.png`, `vs-sentinel.png` / `vs-sentinel-1x.png` |
| 1× vs stone_sentinel | copper + flesh vs grey stone; the shield a head taller than the giant (sentinel's stops at the shoulder); fingers over the rim; boss with rings and horizontal courses (no vertical rune seam) | `vs-sentinel-1x.png` |
| summon f1–f3 vs revive f2–f4 | different axes (slab rising into view with the haul straps vs the lid lifted from under it) — also asserted in the test (Δ > 50 %) | `vs-sentinel.png` row 2 |
| zooms | idle / guard P1 + P2, attack + roar, summon / death / revive, P2 key frames | `z-idle.png`, `z-attack.png`, `z-sd.png`, `z-dr.png`, `z-roar.png`, `z-p2.png` |
| board / in duel | `?dev=monster&mode=board`; `m1Shield` (P2 titan in DEF vs shade_assassin, guard + blocked with today's generic cinematics) | `board.png`, `m1Shield-film.png`, `m1Shield-clip.png` |
| card art | big 88×68 (2 frames) + small 44×34 + 16×12 read (copper bar, gold dot, white blob); colours 20 / 20, focusOk, lead 5 / 2 | `card.png` |

### 13.4 Known weaknesses / open for the next stages

- **Sameness vs stone_sentinel stays UYARI** (KEY / MOTloop / SIL0): both are a figure left of a slab with a calm
  breathing idle. The 1× read is clearly distinct (colour, height, hand on the rim); a blind critic round should
  confirm. The guard loop is quiet (ripple + breath) like sentinel's.
- **The idle reaches HA-18 by a thin margin (15.2 %)**: the shield's 1-px settle/heft on 4 of 16 frames and the dim
  ripple carry much of it. Any idle edit must re-run the gates.
- **The summon's mid-rise frames (θ 25–55°) project taller than the upright slab** (correct for the projection, but it
  can read as stretching); the cinematic's dust + strap creak must sell the rotation.
- **The face is small**: at 1× the eye is 1 px under the white brow; the bald dome + beard carry the read.
- **Card art is the sprite's bust** (pattern B: crop + EPX + hand patch), not a native painting with the low camera
  of §5; it passes the budgets and the 16×12 read but is a candidate for a native redraw.
- The **death lid** reads as a long low slab; its dust ring, tarnish sweep timing and the boss's last pulse are left
  to the cinematic (`deathV3` + `atFrame` layers). `DEATH_PRESETS` is now `light/light`; the death plays through
  the generic v3 death until the lane's cinematic lands.
- Not in this stage: cinematics (summon, strike incl. the sledge direct, ward, defend layer, death), sounds and the
  `SHIELD_TITAN_VOICE`, scenarios `kd*`, camera / v1 film gates.

---

## 14. Build log — stage "Cinematics + sound"

### 14.1 What was built

| file | content |
|---|---|
| `src/cinematics/kart-f/shield_titan.ts` | every registration gated on `LOOK_V3`, priority 20, names `kart-f:shield_titan:<part>`: `summon` (runSummon + "Kalkan Kapısı Kalkar"), `attackDeclare` layer (event, see 14.2), `effect` (the ward "Sur Kalkanı"), `defend` (the repel / wall-break layer + the plate ring), strike (the gate fall + the direct "Kalkan Kızağı" sledge), `destroyed` (deathV3 + layers), `positionChange` layer (kdPlant on toGuard f3, kdFistBang on roar f3/f5), the ward expiry observer. Seeded per uid, reset on `onDuelStart`. |
| `src/audio/v3/shield_titan.ts` | 23 recipes from `./kit` blocks + Voice primitives only (a local `plate()` helper = FM 2.76 ring on G2 + 196 Hz partial + body, through an LFO "thunder-sheet" wobble that dies with the ring; `creak()` leather; `hup()` chest grunt). `SHIELD_TITAN_VOICE` set (roar, arrive, land, charge, release, impact, dissolve, afterDissolve [2, kdLidSlam], burst, reviveGather, reviveLand). `deathStart` is left out on purpose: a lethal recoil usually hands over to the death past f1, so the death layer fires `kdKneel` itself on f2 (late-tolerant, only before the dissolve). |
| `src/duel/scenarios/shield_titan.ts` | 22 keys: kdSummon(P2), kdGuard, kdWall(P2), kdWallFlip, kdWallRanged, kdWallWeak, kdWallBreak(P2), kdWallPierce, kdNegated, kdAttack(P2), kdAttackDie, kdDirect(P2), kdKill(P2), kdRevive(P2) |
| rig (own files) | `Pose.bare` (additive, NEUTRAL 0: the giant without the shield); the shell exposes `titanSled(p, kind, lightFrom)` (cinematic-only frames: `kick`, `reach`, `haul`, the lying slab `sled` / `sledHot`) — read by the strike through `u.art`, so the v1 look never imports v3 art. Sprite sheets / gates untouched (no new anim frames). |
| shared one-liners | none new in this stage (DEATH_PRESETS `light/light` and MONSTER_GLOW gold were set in the art stage). `plates.ts` is NOT edited: see 14.2. |

### 14.2 Decisions

- **The declaration's early −500 (open issue §11.1) solved without a shared edit:** an `attackDeclare` event layer
  (priority 20, acts only when the target is shield_titan and `battleNumbers().attackerDebuffBy` is it) runs the
  declaration and in the same tick puts the attacker's plate back to its real ATK (`setStats(..., false)`, the
  badge's pop tween killed). The unit stays in plates.ts' `tinted` set, so the battle's roll-back is unchanged. The
  ward then rolls the plate −100 per pulse (1900 → 1853 → … → 1400 visibly stepping). This also stops the face-down
  identity leak (kdWallFlip). If the orchestrator later lands lane B's `holdDrain`-style change in plates.ts for
  the attacker side, this layer can be deleted.
- **Ward timeline** from the special holds: wake f0 (kdWardWake sustained), iris f2, release f3 → the rampart rises in
  4 whole-pixel steps (30 ms each, 36 px, depth titan + 0.5), one crenellation pulse launched per shove frame f5…
  (≈1.3 px/ms, 90–200 ms), on arrival kdSapStep with the G2 F2 D2 C2 A♭1 ladder (weak attackers start lower on the
  ladder so the last step is always A♭1), attacker shoved 1 px/pulse (≤ 3, springs home), 4–6 pixels of its
  attribute ramp peeled off, plate −100; last pulse kdSapDrain + the "-500" tag (crimson, `pixelText`, 600 ms,
  2-step rise + blink); the wall settles in 3 steps into the 1-px rampart line (aura `kdWard`) kept until contact.
- **Direct "Kalkan Kızağı"**: implemented as designed: the sprite is hidden after the heave (attack ≤ release) and two
  cinematic frames take over at the sprite's exact origin / flip (the bare giant; the lying slab as the sledge,
  boss up — the face-down back side has no texture, so it rides boss-up, glowing), the strap is a stepped 2-tone
  leather line with a sag, the wake is whole-pixel dust every 8 px. P2 mirrors through flipX + `lightFrom 'right'`.
- **Blocked strike**: battleV3 claims the melee survivor's animation for its recoil on the contact frame, so the
  cinematic's own beat is positional (1 px jolt, ±1 px shiver, 3 px heel-dust slide) + kdPlateShiver; the walk home
  and the f10 re-plant follow.

### 14.3 Evidence (`shots/v3/kart-f/shield_titan/`)

| what | file |
|---|---|
| camera base (placeholder presentation, before any cinematic) | `camera-base.json` |
| measure + camera gate after (22 ok, 0 FAIL) | `measure-r1.json`, `measure-r1.txt` |
| films (LOOKED at) | `cin/kdWall-r1.png` (overview), `cin/kdWall-r1z.png` (ward, zoom), `cin/kdWall-r1c.png` (contact + repel), `cin/kdWallP2-r1.png`, `cin/kdWallBreak-r1.png`, `cin/kdAttack-r1.png`, `cin/kdDirect-r1.png`, `cin/kdDirectP2-r1.png`, `cin/kdSummon-r1.png`, `cin/kdSummon-land-r1.png`, `cin/kdKill-r1.png`, `cin/kdRevive-r1.png`, round 2: `cin/*-r2*.png` |
| clips (MP4 + WAV + JSON, music off) | `clips/kdWall.mp4`, `clips/kdWallBreak.mp4`, `clips/kdDirect.mp4`, `clips/kdKill.mp4` — peaks −1.8…−1.9 dBFS, 0 clipped; every beat present in the sfx timeline |
| audio pages | `clips/a-kdLidSlam.png` (the wobble visible as AM in the waveform), `clips/a-kdSapStep.png` |
| v1 | `filmdiff-v1.txt` (17/17 IDENTICAL), `filmdiff-a6v1.txt` |

**Timings (measure, game clock):** ward `activate` 1.77 s (≤ 2.32), attack on a monster `battle` 1.58 s (≤ 3.19),
direct `battle` 2.02 s (≤ 2.32), death `destroy` 1.48 s (≤ 2.03), revive 2.2 s (≤ 2.9), summon 2.07 s total incl.
the card slam. Number = contact on every battle.

### 14.4 Iterations

1. **r1** — everything filmed P1 + P2. Fixes: the repel's last crenellation aimed at the attacker's HOME (shade
   assassin strikes from behind the titan) → aims at where the attacker stands now; the sledge's dust wake spawned
   ahead of the slab (sign error) → behind it; `deathStart` never fired (the death joins past f1) → kdKneel on f2
   from the layer; kdLidSlam raw peak 1.08 → trimmed; kdSapStep too dull → +gain, more 196 Hz partial.
2. **r2** — the summon's land beat was not legible at 1× (the boss flare only) → the plant now also flashes the
   rampart line on the tile's front edge (white → gold → dim, stepped, 360 ms; it foreshadows the ward) and the
   sideways dust spray is denser and higher.

### 14.5 Known weaknesses / open

- The lying slab (sledge, death lid) is 56 × 11 px: at 1× it reads as a copper bar with a gold dot rather than a
  door-sized slab. The geometry is the rig's (§12.1); a fatter lying view would need a rig change.
- The ward wall is drawn in FRONT of the titan on P1 too (the far tile edge), overlaying his shield; it reads as an
  energy rampart, not as iso-correct masonry behind him.
- The generic hex `guardGlint` / water-blue `blockClang` of battleV3 still plays under the repel (§11.2 unchanged).
- The death's ending keeps the generic `light` material burst (a yellow ring + sparkles) after our tarnish and last
  pulse; our own gold motes rise with it.
- No dedicated revive cinematic: soul_recall's own frame + the sprite's revive + the voice pair (kdWardReturn /
  kdReviveHeave) carry it.
- Critique rounds were done by me (LOOK), not by independent critic agents.

---

## 15. Round 1 (fix round 1/3, lens craft): the critic's findings and what was done

The critic's evidence is in `shots/v3/kart-f/shield_titan/r1-craft/`. My evidence is in `shots/v3/kart-f/shield_titan/r1-fix/` (gitignored), and I looked at every PNG in it. The films were made with `--fresh` and `&look=v3`. Zooms of single poses were made with a scratch renderer (`z-*.png`, ×3–×6).

| # | sev | finding | what I did | evidence (`r1-fix/`) |
|---|---|---|---|---|
| 1 | high | The blocked strike pops from the contact tilt to idle in one frame. | battleV3 claims a blocked melee survivor on the contact frame and plays a generic `hit` after the hit-stop (its f0 is upright). The strike now registers an `onFrame` right after `s.impact()`, in the same tick as battleV3's `recoilAfterStop`. On the first frame where time runs again, it plays attack f8…f11 as the claimant (`u.asClaimant`): the slab is re-lifted to 18°, then 7°, 0°, and the re-plant. The contact frame holds through the hit-stop (≈ 100 ms). No frame jumps to idle. | `f-kdAttack-contact.png` (#6–#11 contact held, #12+ haul-back f8 → f9 → f10 → idle) |
| 2 | high | The direct sledge has hard pops and odd posing. | **(1)** The fall has cinematic in-betweens pivoting on the slab's foot: `tip40` (45 ms), then `tip70` (40 ms), then a `slap` frame (1-px squashed edge, a 2-sided dust puff, a 1 px shake, kdPlant). **(2)** The lift mirrors it: `tip60`, then `tip30`, with the giant in a `heave` pose, into the sprite's haul-back frame (attack f8 at 18°). **(3)** The kick is animated: `windup` (arm back, leg cocked), `kick` (leg out), `follow` (lean in), then `reach`. It changes pose during the skid and never holds one pose. **(4)** The reaching hand is drawn open, with a palm and four fingers (`Pose.nopen`). **(5)** The sledge is a new rig state, `skid`: the slab lies with its long axis ALONG the lane, using the lane's sprite-space slope `lk` (det > 0 for both slopes). It skids head-on, top end first. `titanSled` returns the foot, top and hand frame points, and `SledFrame.pin` places them in the world. | `f-kdDirect-drop.png` (release → tip40 → tip70 → slap → lane-lying sledge), `f-kdDirect-back.png` (haul, heave), `f-kdDirect.png`, `f-kdDirectP2.png` (P2 skids down-left), `z-sled.png`, `z-sled2.png` |
| 3 | high | Attack anticipation and arc are weak. | The attack table is rewritten. f1–f3 sink 2 → 3 → **5 px** into a hunch while the slab rises 3 → **7 px** and tips **back** 2 → 5°. f4 is the stride (lift 9). f5 is high at full stretch (lift 11, 12°, chin up). f6 is the release smear at **30°** with a 9-px trailing ghost. f7 is the contact squash at 26° (the giant compresses 2 px, the slab foot drops 1 px). f8 is the haul-back at 18°. The body is shifted back in the frame (sx −6) so the lean stays inside the 2-px margin. The strike already derives its stride from the contact frame's rim corner, so the reach on screen is kept. | `z-attack.png`, `z-attack2.png`, `sheet/shield_titan-v3-attack.png` |
| 4 | high | Guard and special are headless and static. | Guard: the head sits behind the shield's back edge but outside its line (`hx −2`), so the bald dome, white brow, eye, nose and beard show. toGuard and fromGuard are re-posed to match. Special f2–f10 alternate a **shove** and an **ease**: the shoulder +2 px, the slab +1 px, the beard lagging, the mouth open on the shove. No two consecutive frames are equal (Δ ≈ 1170 px each; the bbox now changes). The cinematic also nudges the whole sprite 1 px toward the attacker on every pulse launch (70 ms), so each of the five pulses has its own shove. | `z-guard.png`, `z-special.png`, `sheet/shield_titan-v3-guard.png`, `sheet/shield_titan-v3-special.png`, `sheet/shield_titan-v3.txt` |
| 5 | high | The summon geometry stretches, and the land is weak. | The rise map's projected length is now `0.22 + 0.78·sin θ`. It rises monotonically from a **12-px flat plate** with a 3-px near edge to the upright 56, so it never passes the upright top. Land f8: the giant drops 2 px and the slab foot 1 px (plant squash), with courses 3 hot. f9 rebounds. Cinematic land: the plant dust is two stepped whole-pixel clouds (earth4 core, earth3 rim) rolling out sideways in 5 steps, raised above the plate badge so they read at 1×. | `z-summon.png`, `z-summon0.png`, `f-kdSummon.png`, `f-kdSummon-land.png` |
| 6 | high | Hit reactions miss their designs. | hitHeavy f1–f2: the slab is **knocked aside outward** (+9° then +6°, sx +3), exposing the chest and beard. The rim hand is torn off and up, and the hips stagger 2 px. f3 hauls it back (−2°). hitMagic f1–f3: the beard **bristles** into a jagged crown of spikes past the outline, the braid lifts 3 px, the rim hand is jerked off **above** the rim and shakes ±1 px over f1–f3, the body jolts ±1 px, and the rim crackle stays a light pass. The back-edge "bulge" came from the inward (negative) tilt and its thickness sweep. With the outward tilt the edge is a straight 2-px band. | `z-hits.png`, `z-hm.png`, `sheet/shield_titan-v3-hitHeavy.png`, `sheet/shield_titan-v3-hitMagic.png` |
| 7 | medium | The death is generic and hard to read. | **(1)** Fold f3–f5: the head is bowed but visible left of the shield, with beard and hands (`FOLD` cx 1, hx −3). **(2)** The peek is a 5-px white beard tuft spilling over the lid's near edge plus three outlined fingertips, the middle one longer. **(3)** The lid is deeper (face 13 px) with a **4-px riveted front edge**. **(4)** The slam has a **stepped rectangular dust ring**: dust clumps traced around the lid, blowing out in 4 steps. **(5)** The generic ending is gone. The death is now its own hook (`lidDeathV3`, deathV3's bookkeeping: planned entry, guard break, toGraveyard, card birth, v3:dying/dead) **without** the material shatter and the `light` accent's white '+' sparkles. On the last hold, ≤ 16 whole-pixel gold motes rise from the boss only (gone in ≤ 150 ms), the lid darkens in two tint steps and is gone, and the card is born on that beat. The voice roles (kdTopple, kdLidSlam, kdWardRise) are played by the hook. Not done: a separate 3-band cinematic tarnish sweep. The sprite's 2-step tarnish (f9 partial far → near, f10 full) carries it. | `z-death.png`, `z-lid.png`, `f-kdKill.png`, `f-kdKill-z.png` (P2: ring, peek, dark lid, card) |
| 8 | medium | Ward readability: the wall muddies the shield, and the plate counts continuously. | **(1)** The wall is drawn **under** the titan's sprite and 4 px out past the tile edge. P1: the far edge, behind him in iso depth. P2: masked by his body. The copper, boss and courses are never covered. **(2)** Masonry: the course lines are 2 px (mortar plus a shade row), with short 2-px head joints every 6 px staggered by 3, crenellations, and empty bricks. **(3)** The plate **steps** −100 on each gong with `setStats(…, false)` and a badge pop: 1900 → 1800 → 1700 → 1600 → 1500 → 1400. Remaining weakness: on P2 the near-edge wall is mostly hidden behind him, and on P1 the far-edge wall is seen nearly edge-on, so it reads as a narrow rampart strip. | `f-kdWall-z.png` (P2 titan), `f-kdWallP2-z.png` (P1 titan: the plate steps) |
| 9 | medium | The repel is on the wrong side vs attackers from behind. | `repel()` now reads the attacker's feet against the titan's facing. If the attacker is behind him (shade_assassin's teleport), the masonry flash and the spall use the tile's **back** edge line and draw over him, between the blow and the giant. Not done: a sprite pivot (it would need new frames, and the budget is 3.55 / 3.6 MB). | `f-kdWall-contact.png` (#3–#7: the rampart flashes up on the giant's back side) |
| 10 | medium | Sprite craft of the giant. | **Hand:** four rounded fingertips with 1-px gaps (the shield shade shows through), the middle two longer, a low knuckle ridge instead of a block, and a skin1 knuckle bend under the rim. I tried a thumb pad on the back edge and removed it: it merged with the far wrist into the "second lump". **Head:** the double bump was the far forearm rising behind the dome next to the hand. Without the thumb pad it now reads as one dome, with the ear moved lower. **Beard:** it starts 1 px lower, under the nose, with the moustache below it, so nose, eye and brow show. **Near arm:** a deltoid mass with a crease and an elbow knob. | `z-idle0.png` (idle, guard, P2 light), `z-head.png` |
| 11 | medium | Card art is far below crystal_wyrm's. | The big art is now **natively painted** at 88×68 (no EPX). It uses an EARTH backdrop with horizon 48 and a low camera. The shield fills x 30–80 and bleeds off the bottom, with an arched rim, studs, two riveted courses and the course through the boss. The boss at (54, 30) is the focus, with a white-hot core and iris rings in the light layer (living: the core grows and a second ring steps out). Four rounded knuckles and fingertips hook over the rim. The head, white brow, lit eye and white beard are fully inside the frame on the left, and the shoulder mass bleeds off the lower left. Stats: colours 20, backdrop 5, isolated 0.8 %, checker 7, focusOk. The small art is still the sprite crop at 1× (it inherits the new face and fingers) plus the eye patch. A hand-painted small is not done. | `card.png` (big f0, small, big f1) |
| 12 | low | The generic contact flash sits over the boss. | **Partly rejected.** The white blob on the contact frame is battleV3's COUNTER_FLASH on the blocked attacker, anchored on `art.core` (static, `MonsterUnit.worldPoint('core')`). That is shared code, and core must stay on the shield face because that is where blows on him land. Our own impact point (`s.impact(at)`) moved 6 px past the rim corner onto the target's face, so the contact light and the block clang sit on the target. With the new 26° contact the boss is lower and is no longer under the blob's centre. | `f-kdAttack-contact2.png` |

### 15.1 Gates after round 1

| gate | result | evidence |
|---|---|---|
| `monster-gates --class medium --ref none` (P1 + P2) | 21 ok, 0 FAIL: HA-18 15.5 / 15.6 %, HA-17 1.27, HA-19 0.45, KK-4 phase ≤ 42.9 %, Sİ-2 margin 2 (hitHeavy f2), KK-13 3.55 MB / 129 frames | `gates.txt`, `sheet/`, `sheet-p2/` |
| `tests/art/shield_titan.test.ts` | 13 / 13 | — |
| `tests/art/cardface-v3.test.ts` | 1 failure, already known and not ours: G1 `scrap_raiders` 0.692 | — |
| typecheck | clean (0 errors in the tree) | — |
| sameness `--against all` | UYARI only, no KALIR (34 UYARI rows; before: 38). stone_sentinel: KEY 0.689, MOTsig 0.622, MOTloop 0.745 → **0.569 G**, MOTavg 0.561 → 0.544 | `same/sameness.txt` |
| measure + camera gate (9 kd scenarios) | 9 ok, 0 FAIL. Direct battle 2.30 s (≤ 2.32; was 2.02: the fall / kick / lift frames, tight), death destroy 1.43 s (≤ 2.03), ward activate 1.77 s, attack battle 1.58 s, summon 2.07 s; number = contact everywhere | `measure.json`, `measure.txt` |
| v1 films | not re-run this round. Only v3 files changed; every registration is still behind `LOOK_V3` | — |

### 15.2 Open after round 1

- The ward wall is now iso-correct and never covers the shield, but it reads as a thin strip: edge-on on P1, mostly occluded on P2.
- The direct attack is at 2.30 / 2.32 s. Any further beat must be paid for elsewhere.
- The small card art is still the sprite crop.
- The card art's `brightOff` is ≈ 26 px on f0: the white beard competes with the boss.
- The death's tarnish is the sprite's 2 steps; there is no separate 3-band overlay.
- The behind-the-back block has no sprite pivot.

---

## 16. Round 2 (fix round 2/3, lens unique): the critic's findings and what was done

The critic's evidence is in `shots/v3/kart-f/shield_titan/r2-unique/`. My evidence is in `shots/v3/kart-f/shield_titan/r2-fix/` (gitignored). I looked at every PNG in it. Films use `--fresh` and `&look=v3`. Clips use `tools/clip.mjs --music off` (`clips/*.mp4|wav|json`). The band and RMS numbers come from a numpy FFT over the clip WAVs (scratch script). Files changed: `src/audio/v3/shield_titan.ts`, `src/cinematics/kart-f/shield_titan.ts`, `src/art/monsters-v3/shield_titan-anims.ts` (timing only), and this doc. No shared file was touched.

| # | sev | finding | what I did | evidence (`r2-fix/`) |
|---|---|---|---|---|
| 1 | high | The ward's gong ladder is inaudible on small speakers. | `kdSapStep` now carries the pitch on a **struck copper bell at G5 with G4 under it** (FM ratio 3.11, short decay). It scales with `pitch`, so the steps fall 784 → 700 → 587 → 520 → 440 Hz. The 98 Hz plate stays under it as weight. The steps **grow** in volume (0.74 + 0.06·i, so the last is loudest). `kdSapDrain` ends the ladder on a low driven **thud**. Measured on `kdWall.wav` (peak 300–2000 Hz per step): **787 / 700 / 587 / 520 / 440 Hz**, descending; before: 379 / 341 / 318 / 492. Energy above 300 Hz is now −1.7 to −4.6 dB of the total (before: −20 to −27), about +20 dB through a 300 Hz high-pass. | `clips/kdWall.wav`, `audio/kdSapStep.png` (clear 400–800 Hz lines) |
| 2 | high | Generic battle sounds play over the signature contacts. | **Warded block:** in the defend layer's `v3:contact` handler, `setCombatSfx(false)` covers the synchronous battle call, which `queueMicrotask` re-enables, followed by `fade(['shieldBlock','impactLight','impactHeavy'], 12)` (the kite_fencer precedent). `hideGenericGuard()` hides the hex `guardGlint` and the `blockClang` hex graphics for 420 ms (the wing_lady / reed_heron precedent), so the masonry is the only shield on screen. **Titan's strike:** `hush(['shieldBlock','impactLight','impactHeavy'], () => s.impact(at))`. The struck body's material sound (`hitStoneLight` on stone_sentinel) stays. **Direct:** `impactHeavy` and `impactLight` are hushed, and kdSlabSlam is raised from 0.6 to 0.85. **Guard change:** for the event, `positionLayer` wraps `ctx.sfx` to skip `shieldBlock`, so the DUNK is the guard's only sound. The clip logs show `shieldBlock` and `impactLight` @933 and `impactHeavy` @1350 as dropped, and no `shieldBlock` in kdWall or kdGuard. | `clips/kdWall.json`, `kdAttack.log`, `kdDirect.log`, `kdGuard.json`, `kdWall-contact.png` (no hex glint or clang) |
| 3 | high | The lid-slam "dust ring" reads as a dashed selection box. | `lidDust()` is rewritten with no closed outline. **Whole-pixel dust clumps** (2–4 px wide, an earth4/earth3 lit top, an earth2 body, an earth1 shadow row on the floor) puff out from the lid's two **long edges** along iso floor axes (vy = ±0.35–0.65 · dist). They rise 2–4 px and fall back over 380 ms in 38 ms steps. There are 12 at the near edge, densest and biggest in the middle and thinner at the ends, and 5 at the far edge drawn behind the lid. The lid **thuds 1 px into the floor** for 60 ms, and 6 chips fly off the near edge. Not done: re-drawing the lying lid fatter (a rig change, open since §15.2). | `kdKill-lid.png` (#1–#11), `z-lid.png` |
| 4 | medium | The blocked attack loses its recovery sound, and the rebound has no beat of its own. | `kdPlateShiver` now plays on the **first frame after the hit-stop** (inside the `dt > 0` claimant hand-off): slam at 933, shiver at 1017. The re-plant `kdPlant` is registered in the same tick the haul-back claimant starts (the claim restarts the anim, which cancelled the old mark); it now fires at 1283. The walk home has **two bare-foot kdStep** (0.5, then 0.42 at pitch 0.94) at 1500 and 1733. RMS at 1.28 / 1.5 / 1.75 s: −11.0 / −16.2 / −17.5 dB (before: −30.6 / −34.1 / −49.9). | `clips/kdAttack.json`, `kdAttack.wav` |
| 5 | medium | The summon's sound is thin and generic. | The summon has its own arc. New **`kdHinge`**, a stick-slip hinge groan plus straps plus a notch knock, plays on f1 / f2 / f3 with pitch 1 / 1.12 / 1.26 (25° / 55° / 80°). New **`kdPlateBloom`** plays on f4: the ring swells in and two settling knocks follow. `kdDrawbridgeCreak` is about 4 dB hotter (−15.4 dB loudest), and `kdHeave` plays at 0.95. On land, the new summon-only **`kdGateBoom`** plays over kdPlant: a deep driven boom, a 2 s slow 4.5 Hz wub tail, a G4/D5 bloom and one arena echo, so the DUNK is no longer the climax. RMS 0.7 / 0.9 / 1.1 / 1.6 s: −16.0 / −18.5 / −21.0 / −18.0 dB (before: −26.1 / −30.6 / −55.8 / −48.0). | `clips/kdSummon.json`, `kdSummon.wav`, `audio/kdHinge.png`, `kdPlateBloom.png`, `kdGateBoom.png` |
| 6 | medium | The impact family is one template. | Each beat has its own front end and register. The wobble stays as the family trait. **Slam:** a broadband pink SLAP at 2–6 kHz plus a 650 Hz body before the ring; the crack is removed. **Plant:** sub thump 54 → 28 Hz plus dirt grit (low crackle and a brown band) with the ring at −10 dB; no crack. **Repel:** a low push, then a **reversed swell** (500 → 2600 Hz, 70 ms) into a **bright G3 strike** (index 4.5) on 70 ms, where the last crenellation slams the attacker. A push whoosh follows, panned between the wall and the attacker. **FistBang:** a hollow 600–900 Hz knuckle knock (wood-on-metal) and a **dry, choked** ring (0.32 s). **ReviveHeave:** the hup, a rising grit band, and the ring gliding up a semitone into tune before the sub plant. **WardWall:** four stone knocks locking (one per rise step) and a G4 + D5 bloom. The spectrograms now differ: a full-height slap column, a sub blob, a gap-then-strike, a short mid band, a rising wedge, a sweep with stacked lines. | `audio/m-plates.png` |
| 7 | medium | At 1× the ward looks like a small gold ladder. | The rampart has a **face**. **(1)** **Solid bricks**, staggered, in two tones (gold1 / earth3), with lit 2-px mortar courses, so it is no longer a lattice of rungs. **(2)** **Thickness**: the crest and merlon tops are drawn 1–2 px back toward the titan (`WallLine.n`). **(3)** **Solid 3 × 3 merlon blocks** with a lit top. **(4)** It stands **9 px** out from the tile edge (was 4) and runs 2 px past both ends, so the whole face is on camera in front of him. **(5)** It is **42 px** tall (was 36). **(6)** Each pulse is a **6 × 6 merlon block** with a lit top and leading edge and a 2-px top face. On arrival the attacker's **silhouette flashes white, then gold** (one frame each). The peel is now **2 × 2 clumps**. Not done: an arena dim. The design has none (EF-8, no camera or stage moves of its own), and the critic only noted it was "not visible". | `kdWall-ward-z.png`, `z-wall.png`, `wallP2-full.png` (P1 titan: the wall behind him on the far edge), `kdWall-pulse.png` (white → gold flash) |
| 8 | medium | The death's sound is weak around the lid slam. | **`kdTopple`** is now a 420 ms creaking **groan**: creak, a stick-slip saw rising 55 → 82 Hz, the ring swelling on a quickening wobble, and a reversed **suck** cut at the slam. It is scheduled from the death's real frame starts, so it **ends on the slam** (played 1317, slam 1733), and it is louder (−15.5 dB loudest, was −20.2). **`kdTarnish`**: the ring falls audibly G3 → E3 with its octave, plus a hiss and five irregular **cooling ticks** at 1.6–2.1 kHz (−12.9 dB, was −25.1). **`kdWardRise`** is a clear rising **G–D–G** bell arpeggio (392 / 587 / 784) at −10.9 dB (was −17.9). kdKill RMS 1.45 / 1.6 / 1.883 / 2.17 s: −17.8 / −17.7 / −13.6 / −15.5 dB (before: −27.9 / −27.1 / −16.2 / −21.7). | `clips/kdKill.json`, `kdKill.wav`, `audio/kdTopple.png`, `kdTarnish.png`, `kdWardRise.png`, `audio/stats.txt` |
| 9 | low | Sameness: hit timings SAME as stone_sentinel's; idle SAME as ashen_drake's. | All changes stay inside the HA-2 / HA-4 gates (f0/f1 40–70 ms, recover start 240–370, hold ≤ 200; the critic's 180 ms f1 and 420 ms recover break HA-4, so the long hold moved to f2). **hit** `[50,70,190,140,120,130]`: the copper flex hold is on f2, recover 310 / 700 (was 240 / 590). **hitHeavy** `[50,70,110,130,140,…]`: the exposed chest is held, recover 360 / 890. **hitMagic** `[45,50,80,120,…]`: fast shakes, then a static hold, 295 / 795. **Idle** is 2240 ms (was 1960) and the **strap swings once per loop** (16-frame pendulum); guard is 1400 ms. Sameness: hit, hitHeavy and hitMagic all read **diff** vs stone_sentinel. **ashen_drake → GEÇER**. Rows ending UYARI: 15 → 14, no KALIR. stone_sentinel is still UYARI on KEY 0.689, MOTsig 0.622, MOTavg 0.544 and SIL0 0.765. Those are the static keyframe and silhouette (a big shield-bearing biped); changing them is a rig redesign, out of scope for a uniqueness fix round. | `sameness.txt` |
| 10 | low | Material overlap with lane-mates is not listed. | Three rows were added to the §7 collision table: windmane_knight's 2.76 plate clank, crystal_wyrm's 2.76 bar ratio, and S11's book-close PAT. The titan's copper **FM ratio is now 3.11** everywhere: `plate()`, the bell layers, the shiver ticks. The lid slam's bright crack (1.4–5 kHz) is replaced by a **low-mid 480 Hz slap**, and the wub tail is kept. kdTarnish's ticks sit at 1.6–2.1 kHz and are irregular, away from C2's 3.2 kHz tick-tock. | §7 table, `src/audio/v3/shield_titan.ts` |

### 16.1 Gates after round 2

| gate | result | evidence |
|---|---|---|
| `tests/art/shield_titan.test.ts` | 13 / 13 (validateArt clean after the timing fit to HA-2 / HA-4) | — |
| typecheck | clean (0 errors in the tree) | — |
| `monster-gates --class medium --ref none` (P1 + P2) | 21 ok, 0 FAIL | `gates.txt`, `sheet/`, `sheet-p2/` |
| sameness `--against all` | no KALIR. Rows ending UYARI: 14 (was 15). ashen_drake GEÇER. stone_sentinel hits diff, UYARI on the static KEY / SIL | `sameness.txt` |
| measure + camera gate (9 kd scenarios) | 9 ok, 0 FAIL. Every contact, number and end time is identical to round 1 (the direct attack is still 2.30 s) | `measure.txt`, `measure.json` |
| clip levels (kdWall, kdAttack, kdDirect, kdGuard, kdSummon, kdKill) | peak −1.9 to −2.5 dBFS, 0 clipped samples | `clips/*.log` |
| v1 | every cinematic change is behind `LOOK_V3`. The new recipes are only played by v3 code. The rig timing is in the v3 art | — |

### 16.2 Open after round 2

- stone_sentinel is still the nearest card on the static KEY and silhouette (a large shield-bearing biped). Only a rig redesign moves those numbers.
- The lying lid is still 56 × 11 (a rig change).
- On P2 the near-edge rampart is partly covered by the shield where they overlap (it is drawn under him by design).
- The struck attacker's white → gold flash uses `setTintFill`, so it clears any tint the attacker had at that moment (none in today's cards).

---

## 17. Round 3 (fix round 3/3, lens integration): the critic's findings and what was done

The critic's evidence is in `shots/v3/kart-f/shield_titan/r3-integration/`. My evidence is in `shots/v3/kart-f/shield_titan/r3-fix/` (gitignored). I looked at every PNG in it. Films use `--fresh` and `&look=v3` on the 5+5 board. Files changed: `src/cinematics/kart-f/shield_titan.ts`, `src/art/monsters-v3/shield_titan-anims.ts` (the `special` holds only), and this doc. No shared file was edited. One new damage layer is registered (`kart-f:shield_titan:recoilNumber`, behind `LOOK_V3`).

| # | sev | finding | what I did | evidence (`r3-fix/`) |
|---|---|---|---|---|
| 1 | high | The five sap pulses strobe the whole attacker as a white/gold `setTintFill` silhouette. | The full-body tint is gone. `struckFlash` now uses the shared band flash (`_v3/flash contactFlash`): an overlay that lights only the attacker's struck FRONT (the pixels nearest the rampart, along the pulse's lane) and never touches the sprite's tint. Pulses 1–4 use a gold3 core with a gold2 band, 22 % coverage, 2 real frames (≈ 33 ms). The last pulse alone has a white core with a gold band, 36 %, 3 frames, landing with `kdSapDrain` as one accent. The shove is now a visible jolt: the attacker goes 2 px further back for 40 ms, then settles at its cumulative 1–3 px shove. The peel clumps are 3 px (4 px on the 5th pulse), fly 6–8 px back (vx 36–48, drag 3, 280–360 ms) and step down two attribute tones. On crystal_wyrm the dragon no longer turns into a white blob; only a gold patch on its struck neck and chest flashes. | `kdWall-ward-z.png` (#2, #5, #9, #13, #17), `kdWallBreak-ward.png` |
| 2 | high | The ATK plate squashes into garbled digits on every step. | The extra `badge.pop()` (scale 0.2 → 1.35 → 1) is removed. `plateStep()` sets the value with `setStats(…, false)`, kills any tween on the plate and sets scale 1 (as `declareLayer` does). The step is an integer-pixel bounce, the plate's y going −2 → −1 → 0 over two 34 ms steps. The digits show the badge's own white flash frame for one step, then their crimson battle tint. The badge keeps its flash state private, so it is reached through a cast with a feature check: the same white-digit frame its `pop()` draws. The attacker flash is an overlay on the sprite, so it never covers the plate. Every frame now reads 1900 → 1800 → 1700 → 1600 → 1500 → 1400. | `kdWall-ward-z.png` (plate legible in all 20 frames) |
| 3 | medium | Tempo: the ward costs about 1.77 s, with a static wake and pulses about 175 ms apart. | `special` holds `[45,55,90,50,60,95,95,95,95,95,110,150]` (was `[80,110,170,60,70,140×6,150]`). The wake is now 267 ms of game time (333 → 600; was 500). The wall's rise (4 × 25 ms) runs un-awaited, so the shove marks are armed at once and the first pulse launches on f5. Each flight has its own raster, so two can overlap. All five flights share one travel time of 80–120 ms. Measured: activate **333–1583 = 1.25 s** (was 1.77). kdSapStep lands at 867 / 983 / 1117 / 1250 / 1383, which is 116–134 ms apart. A defended attack ends at 4.08 s (was 4.60), and 4.43 s with the flip (was 4.95). Number = contact in every kd scenario. | `measure.json`, `measure-ward.json` |
| 4 | medium | The recoil number sits on the titan's repel flash and ring. | battleV3 places the number on the contact frame, and I kept that frame because number = contact is the house rule. A new `damage` layer (priority 20, before a6:block / tb:damage) is armed by `repel()` with the wall line it actually flashed (front edge, or the back edge for an attacker at his back). For that recoil it moves `hints.at` on the same frame, away from the wall and tile and toward the attacker's side (the side of the player who pays). The number's centre is ≥ 40 px past the wall's end, and the number is never below the crest. The wall flash-up and the ring now read uncovered. Passing kdAttack's "over the attacker" is consistent: battleV3 already places the recoil over the attacker. In kdWall the attacker stands at the titan's back, which is why it looked like the titan's number. | `kdWall-number.png`, `kdWallP2-contact.png`, `kdWallWeak-contact.png` |
| 5 | low | Generic SFX pile on at contact. | **Blocked ward contact:** the reaction kit's `play('impactLight')` is not gated by `setCombatSfx`. In the `v3:contact` listener, `skipSfx()` wraps `sfx.play` for the rest of the synchronous contact call and skips `shieldBlock`, `impactLight` and `impactHeavy`. It is undone in a microtask, and only our own wrapper is restored. kdWallWeak at contact now has kdRepel plus wisp_imp's own wiImpact only (clip.mjs: nothing else in 2150–2400). **kdAttackDie:** partly a false positive. measure.mjs logs `sfx.play` before the game's hush check. clip.mjs reports `shieldBlock@933, impactLight@933, impactHeavy@933` as **dropped by the game's own rules**, which is the round 2 `hush`. They were already silent. | `clips/kdWallWeak.json`, `clips/kdAttackDie.mp4` (+ log line), `clips/kdWall.json` |
| 6 | low | Blue arcs together with the gold ring at the blocked contact. | The arcs were not the hex `guardGlint`, which was already hidden. They were the guard reaction's water-blue impact burst (`vfx/combat impact` via `_v3/react guardReact`): a star and rings at body depth −0.3, with sparks at −0.2 and −0.1. `hideGenericGuard` now also hides Graphics created on the contact at those relative depths. The gold ring is 2 px larger (8 + 5·step). It cannot start earlier, because it is created on the contact frame itself. The per-art `guardGlint: false` opt-out is still an orchestrator item. A faint tan arc that remains belongs to the attacker's own effect. | `kdWallWeak-arcs.png` (×3: no blue rings, gold ring only) |
| 7 | low | Camera gate FAIL on kdWallWeak. | **Rejected as not this card's.** The gate still FAILs, the same as the critic's run, with maxScroll 14 → 17 and lean #0 −12 → −16. The lean is wisp_imp's strike (lane B, in progress). The other 20 are ok, with focus calls unchanged. I did not overwrite `camera-base.json`, because that would hide another lane's drift. The current run is stored as `camera-base-r3.json` for use once wisp_imp is final. | `measure.json`, `../camera-base-r3.json` |
| 8 | low | On the P2 blocked contact the full flash-up wall hides the giant. | When the wall is drawn OVER him (an attacker at his back, which is the kdWallP2 / kdWall shade_assassin case), the flash-up paints only the courses, joints and merlons, an empty face per EF-2. The giant, beard and shield read through it. The solid face stays only when the wall is drawn under him. | `kdWallP2-contact.png` (#1–#4), `kdWall-number.png` |

### 17.1 Gates after round 3

| gate | result | evidence |
|---|---|---|
| `tests/art/shield_titan.test.ts` | 13 / 13 | — |
| engine + cinematics + audio suites | 601 / 601 | — |
| typecheck | clean (0 errors) | — |
| `monster-gates --class medium --ref none` (P1 + P2) | 21 ok, 0 FAIL (special 12 f 1035 ms, HA-15 in ≤ 1.10) | `gates.txt`, `sheet/`, `sheet-p2/` |
| sameness `--against all` | no KALIR. 14 rows end UYARI (unchanged from round 2) | `same/sameness.txt` |
| measure (21 kd scenarios) | 0 errors. zoom 1. Number = contact everywhere (pierce: number after the pierce contact, as before). Ward 1.25 s | `measure.json` |
| camera gate vs `camera-base.json` | 20 ok, 1 FAIL (kdWallWeak, wisp_imp's lean; see #7) | — |
| v1 | the new damage layer is registered inside the `LOOK_V3` block. All other changes are v3 cinematic / v3 rig code | — |

### 17.2 Open after round 3

- The camera base for kdWallWeak needs a refresh once wisp_imp's strike is final (`camera-base-r3.json` is ready).
- Shared-code items that are still orchestrator requests: the per-art `guardGlint: false` opt-out, and battleV3's COUNTER_FLASH white blob on the blocked attacker at the contact frame.
- `plateStep` reaches StatBadge's private flash state through a cast. A public `flashDigits()` on StatBadge would make that a contract.

## 18. Gate fix (after the adversarial verifier, 2026-11-06)

The verifier did not ship the card because of three failures. Each was traced to its root cause. Evidence is in
`shots/v3/kart-f/shield_titan/gatefix/`.

### 18.1 `tests/v3/a6-flow.test.ts` B4 registration: `a6:block` must be first on `damage` (this card's bug, fixed)

- **Cause.** The recoil-number layer (`recoilNumberLayer`, round 3 #4) was registered as a global `damage` handler at
  **priority 20**. That put it ahead of lane B's block wrapper `a6:block (p10)`, but §6.4 requires the block wrapper
  to run first on `damage`. Round 3's "601/601" did not include this suite, so the failure was missed.
- **Fix.** The layer is now registered at **priority 5**, below `a6:block (p10)` and above `tb:damage (p0)`, which
  pops the number. The layer only rewrites `hints.at` and then calls `base()`. `blockV3` neither reads nor writes
  `hints.at`, and it also hands straight to `base()`. So the new position changes nothing on screen: the number is
  still moved before `tb:damage` places it.
- **Check.** The damage chain is now `a6:block (p10)`, then `kart-f:shield_titan:recoilNumber (p5)`, then
  `tb:damage (p0)`. Running `tests/v3/a6-flow.test.ts` and `tests/art/shield_titan.test.ts` together gives 80/80.
  measure (kd* + m1Shield): the number still lands on the contact frame everywhere (kdWall / m1Shield 2750 = 2750).

### 18.2 The camera "drift" in m1Shield (lane base) and kdWallWeak (card base) is rig geometry, not a cinematic

Lean #0 is battle/declare.ts:394, `ctx.focus(lerpXY(attacker.core(), target.core(), 0.5), pan 0.32)`. It fires at
t = 17 ms, before any hook of this card runs. maxScrollPx follows the later battle lean (battle.ts:388) toward the
same target core. The live cores were read in the page (`--eval`, `gatefix/*-t0.png` runs):

| unit (now) | core | core − anchor |
|---|---|---|
| shield_titan, P2 DEF, v3 rig | (339, 117) | (−13, −27). stone_sentinel is (3, −30), so this is house-consistent: the face, where blows land |
| shade_assassin | (292, 154) | — |
| wisp_imp, lane B v3 rig | (289, 143) | (1, −27) |
| placeholder totem shield_titan / wisp_imp | — | (0, −15) / (0, −10) |

- **m1Shield vs the lane base.** The base (3eb974a, 2026-10-31 20:14) had `shield_titan.ts` **excluded** in
  `src/art/monsters/index.ts`, so the titan was the placeholder totem with its core at (352, 129). The midpoint with
  shade_assassin is (322, 141.5), which gives lean (1, −12) and maxScroll 13, exactly the base. With the card's own
  rig the midpoint is (316, 136), giving lean (−1, −14) and 16, exactly the current run.
- **kdWallWeak vs the card base.** The base (a3092ae + this card's WIP, 2026-10-31 22:36) still had `wisp_imp.ts`
  excluded, so wisp_imp was a placeholder with its core at (288, 166). The midpoint with the titan is (314, 142),
  giving (−2, −12) and 14, exactly the base. Lane B's wisp_imp v3 rig has since been merged and lifts its core by
  23 px. The midpoint is now (314, 130), giving (−2, −16) and 17, exactly the current run. The titan's core did not
  move between that base and now: m1Shield lean #0 is (316, 136) in both.
- **A/B proof that this card's cinematics add no camera motion.** The same tree was measured with every
  registration of this card switched off by a temporary query guard (`&stAB=off`, now reverted). Cinematics off and
  on give **identical** camera records: m1Shield 3 focus calls, leans (−1, −14) (0, −16) (−2, −14), maxScroll 16;
  kdWallWeak 2 focus calls, (−2, −16) (0, −17), maxScroll 17; kdWall the same as m1Shield. The "off" run is really
  off: the contact moves (2933 vs 2750). See `gatefix/measure-cinematics-off.json` and `gatefix/measure.json`.
- **Not moving the core instead.** Moving the titan's core down to the old placeholder's 15 px would put hit sparks
  and lock-ons at his knees, only to match a base that sampled a totem. The base is wrong, not the rig.

### 18.3 New camera base (current rigs, this card's cinematics off) and the gate against it

Following HANDBOOK-lane-B §9 ("re-base on the placeholder cinematics"), `shots/v3/kart-f/shield_titan/camera-base-v2.json`
was measured over kd* + m1Shield + m1Board5. It uses the current tree with this card's registrations off (generic
cinematics), so it holds today's rigs and none of this card's presentation. The old bases are kept unchanged, so the
history of the drift stays visible. The gate of the current run (cinematics on) against it is in 18.4.
