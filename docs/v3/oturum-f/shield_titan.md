# shield_titan — Kalkan Devi: v3 design (lane F)

**Card:** EARTH / Savaşçı, Lv4, ATK 100 / DEF 2600, not an ace. Its effect is `defenseAtkDebuff500`: while it is face-up in DEFENSE and attacked, the attacker fights that battle with −500 ATK.

**Design note:** "a giant with a tower shield taller than himself". The card is a pure wall, and its guard is its hero pose.

**Status:** design only (this doc). Rig, art, cinematics and SFX are not built yet.

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
