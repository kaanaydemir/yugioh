# hourglass_imp — Kum Saati Cücesi: v3 design (lane F)

**Card:** LIGHT / Büyücü, Lv2, ATK 500 / DEF 400, not an ace, size class 48 (small).
**Effect `summonFreezeAttack`:** when it is summoned, its controller picks one opposing monster (a face-down one is allowed). That monster cannot attack on its controller's next turn.
**Design note** (KART_TASLAGI_CANAVAR #17): "a dwarf with a big hourglass and a pointed hat". **Sand belongs to this card alone** (YENI_KARTLAR C2: "Kum yok (kum `hourglass_imp`'in)").

**Status:** sprite rig + card art BUILT and registered (Build-art stage, see §12). Cinematics (summon, strike, effect + seal manager, death), sounds and scenarios are not built yet.
**Evidence** (gitignored): `shots/v3/kart-f/hourglass_imp/`
- `draft/`, `draft-p2/`: the rejected draft's sheets and gate output.
- `draft/same/`: the draft's sameness run.
- `today/m1Freeze.png`: today's placeholder presentation.
- `ref/roster.png`: the v3 roster at 1×.

One line: **a stubby desert imp who hugs an hourglass taller than his own body. He was poured into the world as sand, and he can pour a monster's next turn away.**

---

## 0. What the engine gives us (exact event flow)

The effect lives in `engine/rules.ts`:
- `summonTriggers` case `summonFreezeAttack` (≈1196)
- `chooseTarget` (≈1703)
- `query.ts plateLock` (≈296)
- `legal.ts` (≈142)

**Batch 1** (the summon). Any summon method triggers it: normal, `special` (soul_recall revive) and `flip` (flip summon). Tribute never happens at Lv2.

```
summon{method} → [summonWindow: trapResponse decision → … ] → decision{pending:{kind:'chooseTarget', player, sourceUid: imp, candidates: every opposing monster incl. face-down}}
```

- **No opposing monster:** there is no pending decision and nothing is activated. The summon simply ends.
- **The imp dies in the summon window** (chasm_trap / toppling_tower / auger_lance): `summonTriggers` returns early. There is no effect.

**Batch 2** (after the action `{type:'chooseTarget', player, target}`):

```
activate{player, uid: imp, cardId:'hourglass_imp', kind:'monsterEffect', from:'monster', zone}
→ target{player, sourceUid: imp, targets:[{player: opp, zone:'monster', index}]}
```

That is all.
- **State only:** `slot.noAttackTurn = s.turn + 1`, which is the opponent's next turn.
- **No "freeze", "attack refused" or "thaw" event exists.**
- `legal.ts` simply never offers the frozen monster an attack on turn `noAttackTurn`.
- The lock follows the slot: through a control change, a flip and a position change. It is lost only when the monster leaves the field.

**Lifetime on screen**, for a summon on turn T:

| when | what |
|---|---|
| rest of turn T | already "frozen" (`plateLock` = 'freeze') |
| turn T+1 (opponent's turn) | **the bite**: the monster is not offered an attack |
| `turnStart` of T+2 | expired |

**Today's v3 presentation** (`today/m1Freeze.png`):
- The crystal-totem placeholder with a generic gold light pillar.
- Generic activate sparks plus the lock-on corners (`v3small/target.ts`).
- The only lasting sign is the **5×7 cyan "ice hourglass" icon on the stat plate** (`StatBadge.paintLockIcon`, shared, not ours). It is driven by `FieldView.sync → u.setLock(plateLock(...))`.
- `plateLock` returns null for a **face-down** target, so a frozen face-down card shows **nothing** at all today.

**Hooks we can use:**

| moment | hook |
|---|---|
| summon | `registerCardHook('hourglass_imp','summon')` (runSummon) |
| effect | `registerCardHook('hourglass_imp','effect')`: consume the `target` event, `ctx.findType('target', e => e.sourceUid === ev.uid)` |
| attack | `registerStrike` |
| death | `registerCardHook(…,'destroyed')` |
| the bite and the thaw (no events of their own) | `registerEvent('turnStart', …, {priority:20})` and `registerEvent('phaseChange', …, {priority:20})`. They start our beat in the background (`bg`) and return `ctx.base()` at once. Observers are "not for animation" (`_core/registry.ts:201`), so they are not used for this. |

---

## 0.9 Design critique, round 1 (verdict needs-work): what changed

These decisions **override** the sections below wherever they disagree. The affected lines below are edited in place, or carry a "(rev. 1)" pointer.

| # | finding | decision |
|---|---|---|
| 1 | The effect's sand arc repeats the attack jet; the aim hold repeats the attack's 90° shoulder | **Accepted.** The effect has **no projectile**. He flips the glass overhead and his upper bulb drains. In sync, a brass top cap pops in above the TARGET in steps, and the target's cage fills at the rate his own bulb empties: a "paired hourglass". The only link is an optional dotted **time line** of 1-px grains hanging still along the line and lighting up one by one; nothing moves along it. **The aim hold is a new pose**: he holds the glass up **at eye level, upright (0°)**, and squints at the target THROUGH the lower bulb (sprite `special` f1). It is no longer the shouldered 90°. |
| 2 | The sand collar collides with mudgrasp_spirit's persistent mud ring | **Accepted.** No earth collar. The sand stays INSIDE the emblem. The floor sign is at most a thin `gold1`/`gold2` 2:1 hairline ellipse with two 1-px brass studs (the cage's bottom cap left behind), plus the emblem's light pool. The bite and strain beats play on the emblem: its neck grains strain down and are refused, and its caps clamp. `ksBoard5` films a mud-pinned neighbour beside the sealed target. |
| 3 | The concept overlaps C2 dial_jester (small LIGHT Büyücü Lv2, pointed hat, curled shoes, a held object, time) | **Accepted.** The difference from C2 is written down. **C2** = a jester holding a DISC (clock dial, coin) in front of himself; two jester hat points; curled shoes; his time theme is *rewind*. **hourglass_imp** = a desert imp standing beside a VERTICAL X (the hourglass) that stands on the floor at his side; ONE soft felt cone that flops backward (no jester points, no bells); flat wrapped **desert sandals** (no curled toes); his time theme is *stop*. **hitMagic is "sand freezes mid-air, then drops in a lump"**, not "runs backwards". The "roster has no small figure plus a large object" claim is withdrawn (C2 is planned). dial_jester is in the §7 table and on the sameness watch list as a *concept* pair. |
| 4 | Bite and strain ignore control change and position | **Accepted** (cinematics stage). The bite is gated on `ctx.locate(uid,'next').player === turnStart.player && turn === noAttackTurn`. The strain is gated on: the phaseChange player is that controller, face-up, `position==='attack'`, `attacksThisTurn===0`, `!attackLocked`. While the sealed monster is borrowed on turn T, its emblem is **dormant** (gold2 dash, no bob) and re-lights on `controlChange` 'return'. New scenarios: `ksFreezeSteal`, `ksFreezeDef`. |
| 5 | The seal manager is event-driven only, so a staged or restored board shows no emblem | **Accepted** (cinematics stage). The manager **reconciles from state** on every observer pass (turnStart, phaseChange, controlChange, destroy, flip, summon, positionChange). It scans `stateNext` on both sides for `noAttackTurn >= turn`, pops in missing emblems with no cinematic, and disposes stale ones. A staged face-down scenario with `noAttackTurn` preset checks it. |
| 6 | Summon plus effect is longer than an ace tribute summon | **Accepted.** Target: **summon + effect ≤ 2.6 s scene** when a target exists. Entrance about 1.1 s: a 500 ms pour, and no hug/giggle beat when a chooseTarget follows (the plant goes straight into the aim pose). Effect about 1.2 s. The full 1.40 s entrance plays only with no target (`ksNoTarget`). A `ksSummon` measure row goes into the §10 Budgets gate. |
| 7 | The game meaning is under-read (cyan plate icon, generic UI text, the emblem could read as a timer, gold shared with dawn/chains) | **Accepted as an orchestrator package** (§11): (a) recolour the 'freeze' plate icon to sand and show it face-down too; (b) an `attackReason` branch: `Kum Saati Cücesi zamanını durdurdu: bu tur saldıramaz`. In our cinematic, at THE STOP, the existing number/label style pops "SALDIRAMAZ" above the emblem for about 500 ms. The emblem keeps `earth4` sand and **dark wood caps with brass rims**, so it is not a pure gold glyph. |
| 8 | Pausing and driving another card's anims | **Accepted.** The stop uses `holdFrame` on the current frame, restored in a `finally` and on retire. The strain never drives the other card's attack frames: only OUR emblem and caps animate, plus at most a whole-pixel 1-px nudge of the target sprite. |
| 9 | No victory animation | **Accepted.** §5.10 Victory, 10 f: he flips the glass and **balances it upside down on one fingertip** while the sand runs "up" for a beat, then catches it and holds a cheeky grin pose. Budget recomputed: 135 frames × 60×64×4 = **2.07 MB** ≤ 2.2 MB. |
| 10 | The seal's silence is inaudible under music | **Accepted** (sound stage). `hgiSeal` uses the duck at its maximum (or a dedicated 120 ms music duck to about −24 dB). The clip.mjs WAV check: RMS in the 60 ms window ≥ 30 dB below the trickle. R2 grim_warden's glass lantern is added to the collision table, and its roles to the LSD set. |
| 11 | The overhead glass overlaps the hat; the falling fx glass to sprite handover can pop | **Accepted.** In the overhead poses the glass is held **to the far (left-rear) side above the far shoulder** with the hat pushed back, so the cone never crosses the glass. The summon's falling fx glass uses the SAME glass painter as the sprite (`hourglass_imp-glass.ts` exports `paintGlass`), ending exactly on sprite summon f9's glass. Contact zoom f8–f10 is a gate. |
| 12 | The thaw on T+2 can read as "ran out early" | **Accepted.** The thaw plays at the END phase of T+1 (phaseChange → end, by the frozen monster's controller): "the stolen turn is spent". The T+2 turnStart only cleans up silently. The manager is keyed by uid, so a new monster in the same zone gets no emblem (asserted by a test). |
| 13 | P2 specifics are thin | **Accepted.** See §5.11 (P2 and crowded board). |
| 14 | The death's rivulet leans toward C10 / C1 | **Accepted.** The end is about the GLASS: the rivulet is ≤ 8 px and glows gold; the last grain falls INSIDE the lying glass's neck, and the glass goes dark ("the clock stops"). The card is born from the empty glass. §5.2 row: "Kum Saati Cücesi \| kendi kum saatine akar; saat yan yatar, cam çatlar, son tane düşer, saat söner". |

No finding was rejected.

## 1. The earlier v3 draft: diagnosis and decision

**How it was checked:**
- Rendered with `npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/hourglass_imp.ts --look v3 --anims all --scale 3 --points --out shots/v3/kart-f/hourglass_imp/draft`, plus `--p2` into `draft-p2/`.
- `--art` works on the excluded file.
- I looked at `hourglass_imp-file-all.png`, `-idle.png`, `-attack.png` and the card art (`draft/cardart-big.png`, `cardart-small.png`).
- `npx vitest run tests/art/hourglass_imp.test.ts`: 8 pass, 1 fails.
- `monster-gates --class small --ref none`: 14 ok, **7 FAIL**.
- `sameness --art … --against all`.

| # | Finding | Evidence |
|---|---|---|
| 1 | **The concept reads as a generic old wizard, not a dwarf/imp.** A sky-blue robe, a star-spangled blue wizard hat, a long white beard and an hourglass on a staff. It is the third "robed caster with a staff in front" after abyss_magus and the retired dusk_sorcerer. At 1× it is a blue Merlin with a lantern-on-a-stick. | `draft/hourglass_imp-file-idle.png`, `ref/roster.png` |
| 2 | **Palette in another card's family.** The `water` ramp robe is tide_golem's and coral_serpent's blue. The hourglass's glass interior is filled **water-blue**, so the sand (1–2 px gold) disappears against it. At 1× and on the 16×12 mini card the glass reads as "blue lamp", not "sand". | idle, `cardart-small.png` |
| 3 | **The hourglass is too small to carry the card.** 13×23 px on a stick, with a 1-px stream. It is the card's whole identity, yet it is less than 25 % of the silhouette and moves only at its stream. | idle f0 |
| 4 | **Animations are shared and flat.** Attack is a staff poke plus sprinkle. `special` is almost the same as attack. hit, hitHeavy and hitMagic are nearly one pose. Roar and victory are the staff waved overhead with the glass turned sideways. Nothing is unique per moment. | `draft/hourglass_imp-file-all.png` |
| 5 | **Gates: 7 FAILs.** See the list after this table. | `monster-gates` output (this session) |
| 6 | **Sameness:** MOTsig 0.77 × crystal_wyrm, 0.785 × coral_serpent, 0.78 × ember_wolf (generic swing rhythm); MOTloop 0.93 × shade_assassin; guard MOT 0.95. The many MOTloop "!" lines against placeholder totems (other lanes) are not meaningful, but the real-card ones are. | `draft/same/sameness.txt` |
| 7 | **The death is a sand heap with the staff left standing.** A heap is R1's ash-heap language (§5.2), and C1 already ends "buried in sand". | `draft/hourglass_imp-file-death.png` |
| 8 | **The test fails only on registration.** `hasMonsterArtV3('hourglass_imp')` is false because of the exclusion entry. The other 8 tests (validateArt, relight, sand falls, HA-9, death/summon/revive shape, muzzle, determinism) pass. **The rejection was a review verdict on art and distinctness, not a code fault.** | `npx vitest run tests/art/hourglass_imp.test.ts` |
| 9 | The card art is the same bearded wizard bust with a blue-filled glass in a big gold sun disc. It is generic, and the brightest point is the disc, not the sand. | `draft/cardart-big.png` |

The 7 gate FAILs from row 5:

| gate | value | limit / notes |
|---|---|---|
| Sİ-2 | margin 1 (special f4) | ≥ 2 |
| HA-15 | pop-in attack 4.52, roar 3.54, special 4.42 | ≤ 2.0; the glass jumps between orientations |
| IŞ-10 idle noise | P2 mean 10.3 % | ≤ 10; loose sand grains |
| IŞ-10 effect noise | 20.1 % | ≤ 20 |
| HA-21 | hit 52.8 % / 58.3 %; phase 70–74 % | < 50; the whole figure shifts on contact |
| HA-9 | feet move in toGuard / fromGuard | |
| KK-13 | 2.20 MB | the class limit exactly: a wasteful 67×64 frame |

**Decision: rebuild from scratch** as a hand-built rig (not `bodyplans/biped`). Items 1–4, 7 and 9 are concept problems: the character, the palette and the hourglass's size and role.

**What carries over (ideas and code patterns only, no art):**
- The draft's `-glass.ts` idea: the hourglass is a **rigid part** drawn in a few hand-made orientations, while the sand is computed in **screen space** (gravity always points down, whatever the glass's angle) with a stream that marches 1 px per frame.
- The test file's structure (validateArt, relight silhouette, sand-falls check, determinism).
- `p2:'relight'`, the `light` weight, and the rule that the final death frame is low.

**Removal:**
- The draft's files go in the same change that renames `_hourglass_imp.ts` → `hourglass_imp.ts`: `hourglass_imp.ts`, `-anims.ts`, `-build.ts`, `-glass.ts`, `-kit.ts`, `-parts.ts`.
- `cardart-v3/hourglass_imp.ts` and `tests/art/hourglass_imp.test.ts` are rewritten in that change.

---

## 2. Concept and silhouette

**"Kum Cücesi" (the sand imp).** A stubby imp-dwarf. His head is as big as his torso, with a big round nose, two long pointed ears and gold pin-point eyes. He wears a **tall maroon felt cone hat** whose tip droops backwards and ends in a sand-coloured tassel.
- He wears a short indigo night-coat with a brass buckle and flat **wrapped desert sandals** (rev. 1: no curled toes, which are C2's). He has no beard (that was the draft's old-man read). The hat is ONE soft felt cone that flops backward (no jester points).
- He stands **hugging an hourglass that is taller than his body**. It stands on the tile at his front (right), and his near arm is wrapped round it with his cheek against the glass.
- The hourglass has dark wooden end-caps with brass rims, two turned posts, and clear glass whose dark interior makes the **glowing sand** read.
- Sand always trickles through the neck: the card's heartbeat.

**Frame and anchors:**

| item | value |
|---|---|
| Frame | **60 × 64** |
| Anchor | **(24, 60)**, hover 0, walker |
| `weight` | `'light'` |
| `p2` | `'relight'` |
| Size class | small (48) |
| Budget | 60×64×4×135 frames = **2.07 MB** ≤ 2.2 MB (`--class small`; rev. 1 adds victory) |

**Body box at idle f0:**

| part | x | y | notes |
|---|---|---|---|
| Sandals (flat, wrapped) | 14–28 | 57–60 | feet fixed in idle and guard |
| Coat | 15–28 | 46–57 | |
| Head | 15–27 | 37–46 | ears stick out 4 px left and back |
| Hat | brim y 36; cone to y 25 | | the tip droops back to (8, 27), tassel 2×3 |
| **Hourglass** | **29–44** (16 wide) | **34–60** (27 tall) | standing on the tile |

- **Bbox** ≈ 37 × 36, about 820 opaque px. That is inside the 48 class: lumen 533, thorn 929.
- **Glass parts:** end-caps 16×3 each; bulbs 12 wide with a 10-px interior; the neck is 2 px.
- **Every pose keeps ≥ 2 px of margin.** The overhead flip holds the glass at y 4–30, and the shouldered "cannon" spans x 20–50.

**Why it reads at 1×.** There are two shapes no other card has:
- A **maroon cone with a drooping tip** (upper left).
- A big **"X" of glowing sand inside a dark-capped frame** (right), as tall as the body.

The face sits between them, lit warm by the sand. On the 16×12 mini card that becomes a red triangle, a gold X and a skin dot.

**The roster has no:**
- maroon (abyss_magus is violet, the seals are void)
- cone hat
- hourglass X
- ~~"small figure plus a large object"~~ (rev. 1: withdrawn; C2 dial_jester is planned with a held disc. Our structural difference: a VERTICAL X standing on the floor beside him, not a disc held in front.)

Lumen_sprite (gold fairy) and volt_lizard (gold lizard) share only the warm light, not the shapes.

**Rig:** hand-built, after the crystal_wyrm / abyss_magus / steel_silencer split.

| part | how it is drawn |
|---|---|
| **The hourglass** | A **rigid part** in whole pixels. Hand-drawn orientations: 0°, 20°, 45°, 70°, 90° (on the shoulder, neck pointing right), 135° and 180° (upside down), each with a P1 and a P2 light map. **No rotation by code**, and adjacent orientations are used in consecutive frames so HA-15 pop-in stays ≤ 2.0. |
| **The sand** | Computed per frame in screen space: top-bulb level, stream, bottom heap. |
| **The imp** | Posed parts: hat (cone + tip with 2-frame lag), head (ears with 1-frame lag), torso/coat, near arm (hugs the glass or holds it), far arm, legs. A `joints()` export for the sameness tool. |

---

## 3. Palette (PAL / RAMPS only; ≤ 20 body colours per frame)

| material | tones | bands |
|---|---|---|
| Hat felt (maroon) | `fire0` shadow, `fire1` mid, `fire2` lit plane (no `fire3`, so it never reads as shield_titan's bright copper) | 3 |
| Hat band, buckle, glass rims (brass) | `gold1`, `gold2` | 2; never `gold3`/`gold4`, which are emissive only |
| Skin | `skin1`, `skin2`, `skin3`, plus a `skin4` nose glint (the anim's one twinkle) | 3 + glint |
| Coat (night indigo) | `night2`, `night3`, `night4` | 3 |
| Boots, belt, hourglass caps and posts (dark wood/leather) | `earth0`, `earth1`, `earth2` | 3 |
| Glass | interior `night1` (a dark, see-through bulb, so the sand reads); 1-px edge `mist` on the lit side only | |
| Sand at rest (heap, top bulb) | `earth3` body, `earth4` top band | 2 |
| Tassel | `earth3`, `earth4` | |
| Outline | `ink` | |
| **Emissive** (light pass, never outlined): the falling stream through the neck, the topmost heap grain, the eyes | `gold3` stream body, `gold4` stream head and eyes | |

- **Count:** 18 body tones plus 2 emissive.
- **Forbidden:** no `cyan`, `crim`, `teal`, `mag` or `water` (water was the draft's mistake).
- **Light (IŞ-2):** decided per part from `lightOf(o)`. The glass's `mist` edge sits on the lit side, so the P2 relight moves it. Emissive pixels are identical in P1 and P2.
- **`MONSTER_GLOW`** (`src/view/light/profiles.ts`, our own line):

  ```ts
  hourglass_imp: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.6)], spill: PAL.gold3, halo: 0.5, pool: 0.8 }
  ```

  Today's line lists `white`, which floods the glass edge and body highlights; remove it. A small warm pool of sand-light sits on the tile in front of the glass.

---

## 4. Idle: living details (16 f, ≈ 1.92 s, loop; feet and glass fixed)

| frames | detail |
|---|---|
| all | **The stream** marches 1 px per frame down the neck as a gold3 dash with a gold4 head. Each dash is a 2–3 px run (no single grains, IŞ-10 ≤ 10 %). The top-bulb surface shows a 1-px funnel dip that walks left↔right over 8 f. The heap top has one gold4 "landing" pixel that hops between 2 positions. |
| 0–7 / 8–15 | Breathing: the shoulders and coat rise 1 px over 4 frames and fall back. The head follows 1 frame later. |
| 0–15 | Hat tip sway: the tassel lags the head by 2 frames and swings ±1 px. |
| 6 | Blink: the gold eyes close to a skin line for 1 frame. |
| 9–10 | Ear twitch: the far ear flicks 1 px up and back. |
| 12–13 | **Time check:** his free (far) hand's finger taps the glass twice (1-px finger extend). On each tap the stream dash brightens to gold4 for 1 frame. This is the "is it still running?" gesture: it reads as character and as the card's theme. |

**Gate notes:**
- The glass is ≈ 40 % of the opaque pixels and never moves in idle. That keeps HA-21 (hit and death f0 vs every idle frame) well under 50 %.
- HA-17 / HA-18 come from the body breathing and the hat.
- **Idle SFX:** none. There is no infrastructure for it (HANDBOOK §7.3); a faint trickle per unit would be an orchestrator question.

---

## 5. Storyboards (scene ms; game ≈ ×1.35; budgets = REHBER §5)

### 5.1 Summon: "Dökülüş" (poured into being)

- **Sprite:** summon 14 f, land @9, ≈ 1.24 s.
- **Cinematic entrance:** ≈ 1.40 s after the card slam.
- **Wiring:** `runSummon` with a v3 entrance, normal summon. It is not an ace, so there is no cut-in.

This is the only entrance in the game in which a body is **poured** from above and **sculpted from a heap**. It is not "climbing out of the ground" (R2/C10), not a sky dive (storm_hawk), and not a light pillar or hologram.

| ms | picture | sound |
|---|---|---|
| 0 | Card slam on the tile (runSummon). The tile flash is replaced by a one-step `earth3` dust ring (2:1, one ring). | (slam: kit default) |
| 60–260 | 38 px above the tile, **his hourglass hangs upside down** in mid-air (fx raster; 180° orientation). It pops in with a one-frame `gold4` 1-px outline, then a full-tone body. | `hgiPour` start (pan = tile x) |
| 120–760 | **A stream of glowing sand pours** from its neck straight down onto the tile: a 2-px gold3 column with a gold4 head, with whole-pixel grains flicking off its sides. A **cone of sand grows** on the tile. The cone is sprite summon f0–f5, `earth3`/`earth4` bands with a gold3 crest; it grows from 4 px to the imp's full height. The light pool on the tile warms in two quarter steps (EF-6). | (sustained) |
| 760–940 | f6–f7, **the sculpt:** the hat tip pokes out of the cone's crest first, then sand **slides off him in bands, top → bottom**. Hat, then face (the gold eyes open first), then coat, so his real colours appear from the top down while the remaining sand still forms the base. Body in real colours ≥ 50 % of the time (EF-11). | `hgiShed` (two soft slides) |
| 940 | The stream runs dry. The empty hourglass drops (90 ms fall, whole pixels). | `hgiPour` stop(60) |
| 1030 | **land, f9:** he catches it one-handed, **flips it upright with a twirl** (the 135° → 45° → 0° orientation frames f9–f10) and **plants it** on the tile beside him. Plant thud: one dust puff on each side of the base and a 1-px shake. The trickle starts. | `hgiCatch` (brass tink + soft thud) |
| 1030–1240 | f11–f13: he hugs the glass, cheek to it, and grins: an ear twitch and the tassel settling. Ends on idle f0. | `hgiGiggle` (short, at f12, volume 0.6) |
| 1400 | `S.finale()`. The light pool settles to its idle size. | |

- **Total** ≈ 1.40 s entrance + slam. It is well inside a normal summon and below the ace 2.5–3.0 s.
- **Not a heap ending.** Unlike R1's ash heap, the cone here is a *building* shape that resolves into the character; nothing is left lying.
- **Followed by the effect** (§5.6) when the opponent has a monster. A decision sits between them; see "the aim hold" below.

**The aim hold** (between batch 1 and batch 2, while the summoner picks):
- At the summon's end, if the batch ended with `decision{chooseTarget}` and the source is this imp, he plays special f0–f1. He **shoulders the hourglass like a spyglass** and squints along it toward the opposing row.
- The pose is held with `holdFrame(u,'special',1)`, and a 2-frame stream flicker keeps it alive. The handle is `ctx.keep('ks:aim', …)`, so it survives into batch 2 because `pending` is set.
- No sound loops during the human's pick.

---

### 5.2 Attack: "Kum Topu" (the sand cannon)

- **Sprite:** attack 13 f: charge @1, release = impact @6, contact @7, recover @9; f12 = idle f0.
- **Cinematic:** on a monster ≈ 1.72 s including the declaration (budget 1.6–2.2 s).

| ms | frames | picture | sound |
|---|---|---|---|
| 0–230 | (declaration) | The kit's declaration. He looks at the target and the hat tip snaps forward. | `charge` = `hgiFlip` (via `holdCharge`) |
| 230–520 | f1–f3 | **Heave:** he tips the hourglass over onto his shoulder in the 20° → 45° → 70° orientations and braces with a wide stance (the feet may move in attack). The sand inside **slides with gravity** into the end now lowest: screen-space sand. | `hgiFlip` (2 brass tinks) |
| 520–700 | f4–f5 (f4 holds 180 ms, the longest frame = anticipation, HA-3) | At 90°, **the neck points at the target.** He pulls the top cap's little brass stopper with his teeth: a 2-frame bite. The glass shudders 1 px and grains gather at the neck. | `hgiCork` (a tiny "pop") |
| 700 | **release f6** (≤ 70 ms) | **The jet:** a **parabolic stream of grains** fires from the neck (`muzzle`). It leaves flat and **falls with gravity** along its arc, a hose of sand rather than a beam. It is 2–3 px wide: a gold3 core with gold4 head grains and earth4 flecks. The recoil pushes him back 2 px. | `hgiJet` start (sustained hiss, pan follows) |
| 700–820 | | Travel 120 ms along the arc (P1 target is upper right; the arc's apex is 10 px above the line). | |
| 820 | **contact f7** (held 60–90 ms) | **The scour:** the jet hits the target body. Sand **sprays back off the silhouette** in a fan of whole-pixel grains, plus a light flash in stepped bands (≤ 34 % cover, EF-3). The target's struck-material sound plays. Hit-stop `light`, plus the number at contact. The stream **thins** after contact, 3 px → 2 → 1 (EF-13). | `hgiScour` + struck material |
| 820–1100 | f7 held, then f8 | He keeps spraying for 2 more dashes. The grains around the target fall to its feet and form a **brief sand ring on the tile** that fades in palette steps in 300 ms. | `hgiJet` stop(120) at f8 |
| 1100–1500 | f9–f11 | **Re-cork and right:** the stopper goes back with a thumb press, the glass turns back 70° → 20° → 0° and **thunks** down. The sand runs back into the top bulb in two jumps, and the trickle resumes. | `hgiRight` |
| 1500–1720 | f12 = idle f0 | He wipes his nose and the hat tip settles. Death of the target, when it dies, plays in parallel (SÜ-2). | |

**Direct attack** (≈ 1.50 s):
- The arc is longer (a 200 ms flight) and lands on `fx.lpPoint(ctx, opponent)`.
- On contact the grains **pile into a little dune against the LP panel's edge** (6 px tall, whole pixels). The LP flow plays under it; then the dune **slides off** the panel's bottom and blinks out in 3 steps.
- Sound: `hgiJetLp` replaces `hgiScour`: a softer dull splash plus a glass hum.

**Blocked** (DEF ≥ 500: most defenders; for example `ksBlocked` vs stone_sentinel DEF 2100):
- The jet hits the guard and **fans off it**: a symmetric splash of grains, but no ring at the feet.
- The kit's guard reaction plays on the defender.
- **Comic backlash:** the recoil is doubled. He skids back 3 px, the glass wobbles out of his grip for one frame (an 80° frame), and he **catches it with both arms, eyes squeezed shut**. That is special attack-recover frame f9b; the table stays the same length by swapping f9.
- Sound: `hgiSplash` (the jet's hiss cut by a dull "fff").

**Attacker loses** (ATK target > 500, e.g. `ksBacklash` vs ember_wolf):
- The counter-blow comes back along the jet's arc, same frame (EF-13 / `clash.ts backlash`).
- The jet **reverses**: the grains rush back into his neck, and the glass hits him in the face. Then the death (§5.5).

---

### 5.3 Hit reactions (sprite; the reactions are played by the default battle handler)

The glass stays planted in every hit f0, so the contact frame is local (HA-21 < 50 %).

**hit (6 f, ≈ 0.50 s):**
- f0: he hugs the glass tighter, the body shifts 2 px back, eyes squeezed.
- f1: the hat tip whips forward (lag). The stream breaks into 3 short drops.
- f2–f5: recover, with the tassel overshoot.

**hitHeavy (8 f, ≈ 0.70 s): "Şapka gözüne"**
- f0: the impact.
- f1–f2: he lets go of the glass and staggers 3 px. **His hat brim slides down over his eyes**: only the nose is visible under the cone.
- f3: the glass tips to its 20° frame. He gropes blindly for it.
- f4: he catches it.
- f5–f6: he pushes the hat back up with one finger.
- f7: settle.

**hitMagic (8 f, ≈ 0.68 s): "Zaman donar" (rev. 1; rewind belongs to C2)**
- f0: he stiffens. Two-pixel gold4 spark ticks show on the hat cone.
- f1–f4: **the sand in his glass freezes mid-air**: the stream stops as a still dash, the top surface flat. His ears stand straight up, eyes wide.
- f5: the frozen sand **drops in one lump** into the lower bulb (a 3-px gold4 clump lands on the heap).
- f6–f7: he shakes his head and the tassel spins; the trickle resumes.
- This is unique: magic disturbs his time.

---

### 5.4 Guard: "Camın ardı" (behind the glass)

**guard (6 f, ≈ 0.95 s loop):**
- He **crouches behind the hourglass**, which stands in front of him toward the enemy. Only the hat cone and his two gold eyes peek over his near shoulder, beside the upper bulb.
- The glass is his shield. The stream keeps falling, and on f3 he peeks one pixel higher.
- The crouch bends his knees *above* the bottom 6 rows, so boots and hem stay put (HA-9; the draft failed this).
- Guard Δ is 0.3–0.8 × idleΔ (HA-19).

**toGuard / fromGuard:**
- 5 f each, ≤ 380 ms.
- Middle frame: the hat tip sweeps (overlap). The head stays visible under it (HA-29).
- They end on guard f0 and idle f0 respectively.

**Guard hit** (the defender in DEF):
- The kit's `reactGuard` uses these poses.
- Extra (ours, a sprite detail only): the glass **rings**. A 1-px `mist` crack-free shimmer runs down its lit edge for 2 frames.

---

### 5.5 Death: "Kendi kum saatine akar" (he pours into his own hourglass)

- **Sprite:** death 10 f, dissolve @4, ≈ 0.86 s.
- **Cinematic:** ≈ 1.26 s in total (≤ 1.4 s), option (b) bookkeeping (HANDBOOK §6.3).
- **Final material (new, not in §5.2):** *"the imp's body runs as sand INTO his own hourglass. The hourglass topples onto its side on the tile, its glass cracks, and the sand bleeds out along the tile diagonal, down to the last grain."*
  - R1 = an ash heap
  - C1 = withdraws into the shell, buried in sand
  - C2 = springs and gears
  - C10 = liquid flowing into the tile
- **Proposed §5.2 row:** "Kum Saati Cücesi | kendi kum saatine akar; saat yan yatar, cam çatlar, kum karo köşegeni boyunca son tanesine dek akar".

| ms | frames | picture | sound |
|---|---|---|---|
| 0 | f0 (contact) | The hit pose, glass planted. | struck material |
| 60–230 | f1–f2 | He staggers. Knees buckle, and he **clings to the glass** with both arms. The hat slips back. | `deathStart` (none) |
| 230–330 | f3 | His colours **dry to sand** from the hat down: the parts recolour to `earth3`/`earth4` in bands over 2 frames (palette steps, no tint wash). | |
| 330 | **dissolve f4** | **The pour:** his sand body **streams into the top cap** as a 2–3 px ribbon of grains, curling into the glass. The hat is the last to go: it **falls onto the cap**. The upper bulb fills to the top; the stream through the neck turns gold4 and fast. | `dissolve` = `hgiDrain` start |
| 330–620 | f5–f7 | The upper bulb is full. He is gone, and the glass stands alone with the hat on its cap. | |
| 620–760 | f8–f9 | **The topple:** the glass, now top-heavy, **tips over** (20° → 70° → lying on the 2:1 tile diagonal, the 90° frame). The hat rolls off. The final frame is low: the glass lies at ≤ 14 px tall and the hat beside it. | `hgiDrain` stop(40) + `hgiTopple` (thud + glass crack) |
| 760–1100 | cinematic | **The bleed:** a 1-px crack line forms on the lower bulb (`mist`). The sand **runs out of the crack along the tile diagonal**: a thin 1-px gold3 → earth3 rivulet, 18 px long, whole pixels. The glass **empties in 4 visible steps** while the last grains glow gold4. | `hgiBleed` (a thinning trickle that slows) |
| 1100 | | **The last grain falls.** One gold4 pixel drops from the crack. In the 150 ms generic pixel dissolve of the empty glass, hat and rivulet, the **card is born** on the break frame (EF-12). | `burst` = `hgiLastGrain` (one dry tick plus a tiny glass ping, then silence) |
| 1100–1260 | | `cardLeaves` to the graveyard (200–360 ms flight, overlapping). | |

**Defense death:** same, but it starts from the guard pose. He is already behind the glass; the f1 "cling" is shorter.

**Hook:** `registerCardHook('hourglass_imp','destroyed', …)` at priority 20, `LOOK_V3`-gated, with the `sourceOwnsDeath` guard.

**`DEATH_PRESETS`:** keep `{ material:'light', accent:'light' }`. It is only the fallback when our hook bails (non-monster location), and it is not the reserved stone/ash.

---

### 5.6 Signature EFFECT: "Kum Mührü" (the sand seal)

The effect hook consumes the `target` event.

**Budget:** ≤ 1.6 s scene (2.32 s game). The plan is ≈ 1.52 s.

**What must read:**
1. **Who did it:** the imp's flipped hourglass.
2. **Who is affected:** one opposing monster, encased in a sand-glass and then wearing a persistent emblem.
3. **What it means:** this monster's time is stopped, so *it cannot attack next turn*.

The Turkish log line already says it ("…bir sonraki turunda saldıramayacak…"). The card's emblem and the plate icon say it after the cinematic.

**Sprite:** `special` 12 f: charge @1, release = impact @5, contact @6, recover @8; f11 = idle f0.

| ms | frames | picture | sound |
|---|---|---|---|
| (pick) | special f1 held | **The aim hold** from §5.1: the glass is shouldered like a spyglass. When `ctx.take('ks:aim')` returns it, we continue from f1, so there is no restart. | |
| 0–240 | f2–f4 | **The flip:** he lifts the hourglass overhead (the 45° and 135° frames) and **turns it upside down** (180°). The sand in it now falls the other way, a heavy gold3 stream. | `hgiFlip` (brass tink-clunk, then a bass "turn") |
| 240 | **release f5** | **The thread:** one ribbon of glowing sand **leaves the (now upper) neck** and arcs high over the field toward the target. It is 1–2 px wide: a gold3 core, gold4 head grains and earth4 flecks drifting off the arc. The apex is 50 px above the midpoint. The ribbon is drawn whole-pixel along a stepped parabola. | `hgiThread` start (pan follows the head) |
| 240–620 | f6 held (the glass overhead pours) | Travel 380 ms. The imp's own glass **pours in sync** with the thread: his upper bulb visibly drains as the thread lengthens, which ties source to target. | |
| 620–700 | | **Above the target**, the thread's head **stops and spreads** into a **brass top cap** (16–24 px wide, gold1/gold2 with an ink outline, sized to the target's bbox + 8) floating 6 px above its head. The thread now **pours straight down** from that cap onto the target. | `hgiThread` stop(40) + `hgiCage` (glass build) |
| 700–900 | | **The glass grows around it:** the 1-px `mist` outlines of two bulbs step outward from the stream in 3 whole-pixel steps, and a matching bottom cap ring is set on the tile around its feet. **The target now stands inside a giant hourglass.** The pattern lets the target show through (EF-2: no fill over the body). | (in `hgiCage`) |
| 900–1000 | | **The sand fills the lower bulb** around its feet in 3 steps, covering paws, feet or the card's lower third: `earth3`/`earth4` bands with a gold3 top line. | `hgiFill` (short trickle swell) |
| 1000 | | **THE STOP ("Zaman durdu"):** every grain of the stream inside the cage **hangs still in mid-air**, and so does the imp's own pour on his side. The target's sprite **pauses on its current frame** (`sprite.anims.pause()`); a frozen idle is the clearest "cannot act". It gets a 1-px `gold3` rim outside its silhouette (a light rim, not a recolour, EF-3). The cage outline flashes 1 frame `white`, then `mist`. | `hgiSeal`: the trickle cuts dead, 60 ms of total silence, a dry "tık", then a held glass tone that stops without decay |
| 1000–1300 | | **Condense:** the giant hourglass **collapses into its emblem.** The bulb outlines step inward and upward in 4 whole-pixel steps to a **7×11 hourglass emblem** floating 4 px above the target's head. The frozen grains are pulled with it, so the emblem's top bulb is full and its stream is frozen mid-neck. The lower-bulb sand stays on the tile as the **sand collar**: a 2:1 ring 2–3 px high around its base. The sprite resumes (`anims.resume()`) and the rim blinks out in 2 steps. | `hgiCondense` (a tight glass "zip" upward) |
| 1300–1520 | f7–f11 | The imp **turns his glass back upright** (180° → 135° → 45° → 0°), **thunks** it down and dusts off his hands. The trickle resumes. | `hgiRight` |

**Face-down target** (`ksFreezeSet`):
- The same beats around the **set card on the tile**, which has no MonsterUnit (`FieldView` builds units for face-up slots only).
- The cage is sized to the card (24×12 iso) plus 8, and the "pause" beat becomes the card's edge rim.
- The emblem floats 10 px above the card's centre and the collar rings the card.
- The plate has no lock icon for a face-down slot (`plateLock` null), so **our emblem is the only sign**. That is why it must exist.

**The persistent state:** a module-level seal manager, `kart-f/hourglass_imp-seal.ts`, keyed by uid. It is not a unit aura, because face-down cards have no unit and units rebuilt by `sync` lose their custom auras.

| element | look |
|---|---|
| **Emblem** (7×11) | Brass caps `gold2`, `mist` glass edge, `night1` interior. The top bulb is full of `earth4`. The neck holds a gold3 stream that is **frozen**: its dash never moves. That frozen dash is the readable sign that "time stopped here". It bobs 1 px every 640 ms. On a 2.4 s cycle one grain **twitches** (tries to fall, 1 px down and back), which keeps it alive (golden rule 1) without letting it run. |
| **Collar** | A 2:1 ring of `earth3`/`earth4` grains 2–3 px high on the tile around the monster's base, with a single gold3 glint walking round it every 1.2 s. |
| **Light** | A small gold3 stepped light pool under the emblem (EF-6). |
| **Depth** | Collar behind and in front of the body (two rasters, as `flameAuraV3`); emblem above the body. |
| **Follows** | Each frame the manager reads `field.unit(uid)` (face-up) or the tile (face-down) through `ctx.locate`. It follows flips, position changes (the collar turns to the side-card shape), control changes (`puppet_string`) and lane moves. |

**The bite** (turn T+1, the frozen monster's controller's turn; no engine event, two presentation beats):

1. **`turnStart` (turn = noAttackTurn):**
   - In the turn wave, the frozen monster **does not wake up**. Its emblem flashes gold4 once.
   - The **collar tightens**: it steps 1 px inward and 1 px higher.
   - A grain in the emblem twitches and is refused.
   - 360 ms, in the background (`bg`, timed to the wave reaching its tile). The turn's length is unchanged.
   - Sound: `hgiBite` (a muffled "tık" plus a short refused trickle).
2. **`phaseChange` → battle** by that player on that turn:
   - **The strain:** the monster plays its own `attack` frames 0–2 at half speed, rising to step forward.
   - The **collar clamps**: grains climb 3 px up its legs (or the card edge) and hold for 160 ms.
   - The monster sinks back to idle and the emblem ticks.
   - 480 ms, in the background under the phase banner. Sound: `hgiStrain`.
   - The UI already offers it no attack (legal), so this beat is the **visible "it tried and could not"**.

**The thaw** (`turnStart` with turn > noAttackTurn, i.e. T+2):
- **"Kum akar"** (the sand runs): the emblem's frozen dash **drops**, and the stream runs. The top bulb **empties in 4 visible steps** (240 ms) into the lower one.
- The emblem then **pops** into 6 whole-pixel grains that fall to the collar.
- The collar is **blown off** along the tile diagonal as a short grain spray (whole pixels) and fades in palette steps.
- The monster gets one frame of a 1-px gold3 rim, and is free.
- ≈ 560 ms in the background during the turn banner. Sound: `hgiThaw` (a quick trickle that runs out, plus a light glass "ting").

**Early removal:**
- **The monster leaves the field** (destroy, tribute, banish, bounce) while sealed: the emblem **falls** with it (8 px drop, 120 ms) and the collar grains scatter in 2 steps.
- Removal is triggered from the `registerEvent` handlers of turnStart and phaseChange, plus a small sync check every frame in the manager: if `ctx.locate(uid,'next')` is gone, the elements are disposed.

**Other cases:**
- Two imps sealing two targets is supported (keyed by uid).
- If the **imp itself dies**, the seal stays: the engine lock is on the target slot.
- **Determinism:** all grain randomness is seeded per target uid, with no module streams to reset.

**Plate icon** (shared `StatBadge`, not ours): it is an ice-blue (`cyan`) hourglass that contradicts the sand identity. Proposal for the orchestrator: recolour it to a sand-gold hourglass (`gold2` caps, `earth4` sand, a `gold4` neck dot). See §11.

---

### 5.7 Revive (soul_recall): "Kum geri akar" (the sand runs back)

- **Sprite:** revive 12 f, land @8, ≈ 1.25 s.
- **Cinematic:** ≈ 1.55 s. The freeze effect then follows, because a special summon triggers it.

The revive is the exact reverse of the death (HA-28):
1. A rivulet of sand on the tile **runs back uphill** into a lying, cracked hourglass. The crack line retreats.
2. The glass **rights itself** (90° → 45° → 0°).
3. The sand climbs **up through the neck into the top cap** and spills out of it as a ribbon that **winds back into his shape**, hat last. The hat jumps from the floor onto his head.
4. **land f8:** the boots plant. Then he takes a first breath, sneezes out a puff of sand (f9–f10) and returns to idle f0.

The entrance set-piece (the hanging, pouring glass) does not replay.

Sounds: `reviveGather` = `hgiReviveGather` (the trickle reversed in pitch contour, rising), `reviveLand` = `hgiReviveLand` (boot plant plus the sneeze "pff").

---

### 5.8 Roar (10 f, ≈ 1.05 s): "Kıkır" (the giggle)

- He **spins the hourglass on its base like a top**, using the 0° / side-on narrow / 0° orientation frames: whole pixels, a width change only.
- He giggles with three shoulder bobs; the hat tip flops on each.
- On f6 he slaps it still and the sand inside sloshes.
- Used by the kit where a roar plays. It is not an ace, so there is no cut-in.
- Sound: `roar` = `hgiGiggle`.

### 5.9 Flip and position change

- **Flip** (set → face-up): the kit's flip. On reveal, the sprite starts at guard f0 (behind the glass) and pops up from behind it via fromGuard.
- **Position change:** toGuard / fromGuard.

---

### 5.10 Victory (10 f, rev. 1): "Parmak ucunda"

f0 idle → f1 he lifts the glass → f2 flips it (135°) → f3 **balances it upside down on one fingertip**, the hat pushed back so the cone never touches the glass → f4–f5 it wobbles (176° / 184°) while the sand runs "the wrong way up" → f6 settles → f7 tossed (90°) → f8 caught and hugged (dust puff) → f9 **the wink**, held 600 ms (eye 4, grin, nose glint). Victory is exempt from HA-14.

### 5.11 P2 and the crowded board (rev. 1 #13)

- Every arc (attack jet, effect time line) is computed in **world space** from the sprite's `muzzle` to the target, after flipX: a P2 imp's apex sits above the line in screen space, never mirrored below it.
- Sand is drawn **post-flip in screen space**: gravity always points down; the stream never mirrors its 1-px offset.
- Death: the glass topples toward the imp's own back edge for both players (in the sprite it falls left = backward; P2's flipX makes that screen-right, i.e. still toward the owner's back edge). The cinematic's ≤ 8 px rivulet follows the same direction.
- Emblem y is clamped below the HUD band and anchored over the unit's `head` box, not the plate.
- Scenarios to add: `ksBoard5` (5 v 5, two imps sealing two targets, one face-down, a wing_lady and a mud-pinned neighbour), `ksDeathP2`, `ksDirectP2`.

## 6. Card art (`src/art/cardart-v3/hourglass_imp.ts`; native redraw in the crystal_wyrm.ts pattern)

**Big (88×68), backdrop `DARK`, horizon at y 52:**
- **Subject:** the imp **peeking from behind a giant hourglass** in the foreground right.
  - The glass fills x 44–80, y 4–66 and bleeds off the bottom.
  - The neck sits at (60, 33).
  - The upper bulb is two-thirds full; a thick stream falls through the neck; a heap with a gold3 crest sits in the lower bulb.
- **The imp:** he leans in from the left (x 10–46). Cheek against the glass, one hand on it, ear tips, a big nose, and the **gold eyes lit by the sand** (warm `skin3` on the right side of his face, `skin1` on the left: the light comes from the glass).
  - The maroon cone hat rises into the upper left and its tip droops over the frame's top-left corner.
- **Brightest point (focus):** the stream in the neck, `gold4` (`focus: [60, 33]`, inside x 12–75 / y 8–53).
  - Light layer: one stepped `gold3` spill onto his face and the glass's caps. It is not a sun disc (the draft's mistake).
- **Backdrop:** a night desert. Three dune bands in `night1`/`night2` and a thin crescent moon (`mist`) in the upper right behind the glass, which gives the hourglass's dark frame a rim. A direction gap opens to the left.
- **Budgets:** subject fill 0.6–0.75, isolated ≤ 0.1, ≤ 20 colours, backdrop ≤ 6.
- **Forbidden:** dither, gradients, `mix()` and `Math.random`.

**Small (44×34), hand-made:**
- The glass's X dominates the right half: brass caps, a 2-px gold3/gold4 neck stream, earth3/4 sand masses.
- On the left: a maroon cone (3 bands) over a skin face with **one gold eye pixel and one nose pixel**.
- Nothing important sits on columns 0 and 43 or rows 0 and 33.
- **16×12 check:** a red triangle upper left, a gold X right, and a skin dot.

**Living frames (optional):** `frames: 4, holdMs: 180`. The neck stream marches and a grain lands on the heap. This is judged in renders only; the game reads `smallPx` f0.

**Wiring:** `portrait(p) { p.blit(renderArt(card, 0).smallPx, 0, 0); }` in `monsters-v3/hourglass_imp.ts`.

---

## 7. Sound identity (checked against YENI_KARTLAR §5.1)

| | value |
|---|---|
| **Main pitch / colour** | **B♭4 (466 Hz) "glass bulb" hum**: a sine plus a weak 2nd partial with a slow 0.3 Hz wobble, like blowing across a bottle. Fifth F5 698 Hz for the big beats. |
| **Signature material** | **Fine sand INSIDE glass**: an aperiodic granular trickle (`v.crackle`, random gaps, n 30–120 per second, white noise) through two narrow resonances, bandpass q 6 at 1.4 kHz and q 4 at 2.8 kHz (the bulb's cavity), plus a high-pass at 1.2 kHz. Grains in glass, not outdoor sand. |
| **Distinctive layer** | **"Zaman mührü" (the time-seal stop).** The trickle **cuts dead** (0 ms release), then 60 ms of **total silence** (`hush` of our own voices), then one dry "tık" (a 1-ms filtered click at 4 kHz), then a **held B♭4 glass tone that does not decay and is then cut off abruptly** after 380 ms. "Time stopped" is heard as sound stopping. |
| **Imp voice** | A tiny nasal giggle: 3 square-wave blips through formants 700 / 1100 Hz, gliding up 760 → 1020 Hz. Short, playful, never a growl. |

**Collision check (§5.1 and lane F):**

| card | theirs | ours |
|---|---|---|
| C2 dial_jester | periodic 3.2 / 2.6 kHz tick-tock, ratchet, rewinding tape | no periodic ticks (grains are aperiodic), no ratchet, no tape rewind; our single "tık" is one click, not a pair |
| crystal_wyrm | E-major pentatonic glass bells with bar modes (`glassBell`, `glassRain`) | a pure bulb hum in B♭, no bar-mode bells, no glass rain; `glassBell` at most as a quiet B♭/F one-shot (`hgiCatch` tink) |
| R2 grim_warden | `glassReverse` | never used |
| windmane_knight (lane F) | sand wall: 300→900→500 Hz pink sweep with 3 kHz grain ticks, outdoor and broadband, panned | narrow resonant bands at 1.4 / 2.8 kHz inside glass, no pink sweep. LSD ≥ 10 dB to be verified on WAVs. |
| C1 tide_harpooner | death sand "şşş" (broadband hiss) | our sand always has the glass resonance and is never a broad hiss |
| S5 winnow_sieve | 6 Hz rhythmic shaking | our trickle is not rhythmic |
| C6 hollow_ogre | wood "tok" 300–600 Hz ring | our base thud is a dull sine ≤ 150 Hz plus a brass tink, never a hollow wood ring |
| abyss_magus | FM 1.41 clank at 470–760 Hz | brass tink: `clank` f 1180 Hz, ratio 2.0 (harmonic) |
| shield_titan / windmane | 2.76 ratio | brass tink: ratio 2.0 |

**Proposed §5.1 row:** "Kum Saati Cücesi | B♭4 466 Hz cam fanus uğultusu | cam içinde ince kum (1,4 / 2,8 kHz rezonanslı düzensiz tane) | 'zaman mührü': akış ölü kesilir → 60 ms sessizlik → tık → sönümsüz B♭ aniden kesilir".

### 7.1 Recipes (`src/audio/v3/hourglass_imp.ts`, `HOURGLASS_IMP_RECIPES`; prefix `hgi`)

Built from `./kit` blocks (`thump`, `puff`, `sweep`, `clank`, `crack`, `glassBell`) and Voice primitives (`tone`, `noise`, `filt`, `crackle`, `bursts`, `wander`). There is no new DSP (SE-3).

| recipe | role / beat | recipe sketch | duck |
|---|---|---|---|
| `hgiPour` | `arrive` (sustained; summon pour) | crackle n 90/s through the bulb bands + B♭4 hum swell; start()/stop() | 0.3 |
| `hgiShed` | summon sculpt | two `sweep` slides 2.4k→1.2k, q 3, 120 ms each, 70 ms apart | 0.2 |
| `hgiCatch` | `land` (catch + plant) | `clank` 1180 Hz ratio 2.0 dec 0.18 + `thump` 140→80 Hz 0.12 + `puff` lp 900 | 0.45 |
| `hgiGiggle` | `roar` | 3 square blips via formants 700/1100, glide 760→1020, 70 ms apart | 0.35 |
| `hgiFlip` | `charge` (declaration, via `holdCharge`) and the effect's flip | 2 brass tinks (1180 / 1324 Hz) + sand sliding inside (crackle burst 140 ms) + a low "turn" `thump` 110→70 | 0.35 |
| `hgiCork` | attack f4 | tiny pop: tone sine 900→300 Hz 25 ms + `crack` hp 3k n 1 | 0.15 |
| `hgiJet` | `release` (sustained jet) | dense crackle n 220/s bp 2.8k q 2 + noise hp 1.5k hiss, slight pitch-up wander; pan follows | 0.4 |
| `hgiScour` | `impact` (our accent on the struck body) | sand-blast "fssh-t": `bursts` 4 grains + `sweep` 3k→1.5k 160 ms + B♭4 hum blip | 0.5 |
| `hgiSplash` | blocked contact | `hgiScour` without the hum, with a dull `puff` lp 600 cut short | 0.4 |
| `hgiJetLp` | direct contact at the LP panel | soft dune "fff" `puff` pink lp 1.4k + F5 hum 200 ms | 0.5 |
| `hgiRight` | attack/effect right + thunk | `clank` 1180 r2.0 quiet + `thump` 120→80 + 2-step trickle restart | 0.25 |
| `hgiThread` | effect thread (sustained) | thin crackle n 60/s bp 2.8k q 6 + rising B♭4→F5 hum; pan follows head | 0.35 |
| `hgiCage` | glass builds around target | 3 stepped glass "tings" B♭5 / D6 / F6 (sine, 60 ms decay, no bar modes) + crackle pour | 0.4 |
| `hgiFill` | sand fills lower bulb | crackle swell 120 ms, bp 1.4k | 0.2 |
| **`hgiSeal`** | **the stop** (signature) | dead cut; 60 ms silence (`hush` around it); click 4 kHz 1 ms; sine B♭4 + F5 at 0.3, held 380 ms flat, **hard cut** (2 ms) | 0.7 |
| `hgiCondense` | cage → emblem | `sweep` 1.2k→4k q 5 180 ms ("zip") + tiny `clank` 2360 Hz | 0.3 |
| `hgiBite` | turnStart pulse on the frozen | muffled click lp 2k + 80 ms refused trickle that stops dead | 0.15 |
| `hgiStrain` | battle-phase strain | grain clamp `bursts` ×3 rising + choked B♭ hum 150 ms cut | 0.2 |
| `hgiThaw` | expiry | trickle 240 ms that thins and runs out + glass "ting" F6 | 0.25 |
| `hgiDrain` | `dissolve` (death; sustained) | fast inward trickle crackle n 160/s + hum glide B♭4→F4 (downward, "draining") | 0.45 |
| `hgiTopple` | death topple | wood-free dull `thump` 130→70 + glass `crack` hp 4k n 3 gap 0.006 | 0.55 |
| `hgiBleed` | death bleed | crackle thinning from n 80/s → 4/s over 330 ms, bp 1.4k | 0.2 |
| `hgiLastGrain` | `burst` | one click 3.5k + glass ping B♭6 30 ms decay, then nothing | 0.3 |
| `hgiReviveGather` | `reviveGather` | `hgiDrain` contour inverted (hum F4→B♭4 rising), crackle rising | 0.4 |
| `hgiReviveLand` | `reviveLand` | boot plant `thump` 160→90 + sneeze "pff" `puff` white lp 3k 60 ms | 0.45 |

**Voice** (`HOURGLASS_IMP_VOICE`, set in the same change that ships the strike and death cinematics, per the lane F rule):

```ts
{ roar:'hgiGiggle', arrive:'hgiPour', land:'hgiCatch', charge:'hgiFlip', release:'hgiJet', impact:'hgiScour',
  dissolve:'hgiDrain', burst:'hgiLastGrain', reviveGather:'hgiReviveGather', reviveLand:'hgiReviveLand' }
```

**Recipe settings:**
- `cap ≥ 6, gap 0.008` for `hgiBite`, `hgiStrain` and `hgiCage` (repeatable micro-beats).
- The sustained sounds (`hgiPour`, `hgiJet`, `hgiThread`, `hgiDrain`) are written 30 % longer than the picture and `stop()`ped on their end mark (SE-2).

**Offline checks** (agents cannot hear):
- `?dev=audio&page=one&name=<hgi…>&log=1` (check the title, because an unknown name falls back to roarBig).
- `node tools/clip.mjs "?dev=duel&s=ksSummon&look=v3" --music off --out shots/v3/kart-f/hourglass_imp/clips/ksSummon.mp4`: peak ≤ −1 dBFS, 0 clipped.
- A numpy 1/3-octave LSD against crystal_wyrm, windmane_knight, dial_jester (when built) and C1 on the same roles: median ≥ 15 dB, minimum ≥ 10 dB.
- MP4s go to the user.

---

## 8. Files

| purpose | path | owner |
|---|---|---|
| Sprite shell (drafted as `_hourglass_imp.ts`, renamed when the gates pass; it replaces the draft's `hourglass_imp.ts`) | `src/art/monsters-v3/hourglass_imp.ts` | ours |
| Rig: W 60, H 64, AX 24, GY 60; Pose, part painters, `drawImp` | `src/art/monsters-v3/hourglass_imp-rig.ts` | ours (new) |
| Hourglass orientations + screen-space sand | `src/art/monsters-v3/hourglass_imp-sand.ts` | ours (new; replaces the draft's `-glass.ts`) |
| Hand maps (`_L`/`_R`: hat, face, glass orientations) | `src/art/monsters-v3/hourglass_imp-maps.ts` | ours (new) |
| Anim tables, IMPACT, MUZZLE, `framePose`, `framePoints`, `joints` | `src/art/monsters-v3/hourglass_imp-frames.ts` | ours (new; replaces the draft's `-anims.ts`) |
| Draft files deleted at the rename | `hourglass_imp-anims.ts`, `-build.ts`, `-glass.ts`, `-kit.ts`, `-parts.ts` | ours |
| Card art (rewrite) | `src/art/cardart-v3/hourglass_imp.ts` | ours |
| Cinematics: summon + aim hold, strike, effect, death | `src/cinematics/kart-f/hourglass_imp.ts` | ours |
| Seal manager + turnStart / phaseChange handlers | `src/cinematics/kart-f/hourglass_imp-seal.ts` | ours |
| FX painters (sand stream, thread, cage, emblem, collar, dune; exports only) | `src/cinematics/kart-f/hourglass_imp-fx.ts` | ours |
| Sounds (fill the scaffold) | `src/audio/v3/hourglass_imp.ts` | ours (already wired through `kart-f.ts`) |
| Scenarios | `src/duel/scenarios/hourglass_imp.ts` | ours (new) |
| Test (rewrite) | `tests/art/hourglass_imp.test.ts` | ours |

**Shared one-liners (re-read each file right before the edit; small additive edits):**
- `src/art/monsters/index.ts`: delete only `'!../monsters-v3/hourglass_imp.ts'` from the exclusion line, in the same change as the rename.
- `src/view/light/profiles.ts`: replace our `MONSTER_GLOW` line (§3).
- `src/cinematics/_v3/presets.ts`: keep `hourglass_imp: { material:'light', accent:'light' }`; no edit needed.
- **Not touched:**
  - `StatBadge.ts` (the icon colour is an orchestrator question, §11)
  - `kart-f.ts`, `sfx.ts`, `sounds.ts`, `_v3/sound.ts` (already wired)

**All cinematic registrations:**
- gated `if (LOOK_V3)`
- priority 20
- names `kart-f:hourglass_imp:summon|strike|effect|death|seal-turn|seal-phase`

---

## 9. Scenarios (prefix `ks`, `src/duel/scenarios/hourglass_imp.ts`; P2 twins `…P2` swap the sides)

| key | stage → steps | shows |
|---|---|---|
| `ksSummon` / `ksSummonP2` | main; hand `hourglass_imp`; opponent `ember_wolf`, `volt_lizard` → summon zone 1, chooseTarget ember_wolf | pour entrance, aim hold, seal, emblem |
| `ksFreezeSet` | opponent `{shade_assassin, faceUp:false}` + ember_wolf → summon, target the set card | cage around a set card, emblem on the tile |
| `ksNoTarget` | opponent field empty → summon | entrance only; no aim hold, no effect |
| `ksFreezeTurn` | `ksSummon` + `endTurn` (P0) → turn T+1: `enterBattle` (P1) → `endTurn` (P1) → turn T+2 | the bite (turnStart pulse), the strain (battle phase), the thaw |
| `ksFreezeFlip` | `ksFreezeSet` + `endTurn` → P1 `flipSummon` zone → `enterBattle` | the emblem follows the flip; the strain on the flipped monster |
| `ksFreezeDies` | P0 also has crystal_wyrm; summon imp, target ember_wolf → `enterBattle` → wyrm attacks ember_wolf | the emblem falls with the dying target |
| `ksRevive` | hand `soul_recall`, graveyard `hourglass_imp`, opponent ember_wolf → activate soul_recall (toZone 1) → chooseTarget | revive (§5.7), then the seal |
| `ksAttack` / `ksAttackP2` | battle; imp vs `lumen_sprite` ATK 400 → attack | sand cannon, target dies |
| `ksAttackDef` | imp vs `{shade_assassin, position:'defense'}` (DEF 400) → attack | scour on a defender (dies) |
| `ksBlocked` | imp vs `{stone_sentinel, position:'defense'}` → attack | splash plus the comic catch |
| `ksBacklash` | imp vs ember_wolf ATK → attack | jet reverses, the imp dies (death §5.5) |
| `ksDirect` / `ksDirectP2` | imp, opponent empty → attack direct | arc to the LP panel and the dune |
| `ksKill` / `ksKillP2` | ember_wolf attacks the imp in ATK | death in full |
| `ksGuard` | `wisp_imp` (300) attacks the imp in DEF (400) | guard reaction, survives |
| `ksGuardDie` | ember_wolf attacks the imp in DEF | defense death from the guard pose |
| `m1Freeze` (existing) | unchanged; filmed as the regression | |

Films use `node tools/shot.mjs "?dev=duel&s=<key>&look=v3" --fresh --film N --every MS --cols C --out shots/v3/kart-f/hourglass_imp/<key>.png`, plus contact zooms with `--clip … --scale 3`. Every PNG is READ.

---

## 10. Gates (HANDBOOK §9)

| gate | command / check | pass |
|---|---|---|
| Sprite sheets | `npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/_hourglass_imp.ts --look v3 --anims all --scale 3 --points --out shots/v3/kart-f/hourglass_imp/sheet` (+ `--p2`) | LOOK at every strip |
| Sprite gates | `npx vite-node tools/monster-gates.ts <p1.json> <p2.json> --class small --ref none` | exit 0. The draft's 7 FAILs are designed out: margin ≥ 2 (overhead glass at y ≥ 4); pop-in ≤ 2.0 (adjacent glass orientations); idle noise ≤ 10 % (2–3 px dashes only); HA-21 < 50 % (glass planted in hit/death f0); HA-9 (crouch above the bottom 6 rows); bytes 1.92 MB |
| validateArt | in the test: `validateArt(art,'normal')` | no errors; marks per §5 |
| Test | `tests/art/hourglass_imp.test.ts` (rewritten) | registered v3, hand-built, `weight:'light'`, idle f0 palette ≤ 20 colours, no cyan/crim/teal/mag/water; P2 relight keeps the silhouette; the stream marches in idle; it reverses in hitMagic; the glass is fixed in idle and every hit f0; the death's last frame is low (top row ≥ GY − 16, the glass lying); card art budgets and small art hand-made; determinism |
| Sameness | `npx vite-node tools/sameness.ts --look v3 --ids hourglass_imp --against all` | KEY < 0.62, MOTsig < 0.55, MOTloop < 0.65, MOTavg < 0.45, SI < 0.35. The real-card pairs to watch: lumen_sprite, wisp_imp, dial_jester, abyss_magus. UYARIs against placeholder totems get a distinction comment. |
| Types / tests | `npm run typecheck`, `npm test` | ours clean; no new failures |
| v1 identical | `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` and `--set a6v1 --base shots/v3/a56/baseline/a6v1films` | 17/17 and 26/26 IDENTICAL |
| Camera | `node tools/measure.mjs --look v3 --scenarios 'ks*,m1Freeze' --camera-gate shots/v3/kart-f/camera-base.json` | zoom 1, no close-ups, `focusCalls` equal to the base. We never call `ctx.focus`. Re-base the new `ks*` keys on the placeholder before the cinematics land. |
| Budgets | measure JSON by hand (game clock = scene × 1.45) | effect ≤ 2.32 s; attack ≤ 3.19 s; direct ≤ 2.32 s; death ≤ 2.03 s; revive ≤ 2.9 s; number vs contact ±17 ms; bite / strain / thaw add **0 ms** to the turn (background) |
| Palette | `node tools/palcheck.mjs <frames> --every 17` on `ksSummon`, `ksAttack` | a5 rules (white ≤ 1.5 %, rowWhite ≤ 60 %) |
| Contact | `node tools/contact-probe.mjs --scenarios ksAttack,ksKill` | screen ≤ sheet + 5 |
| Card hash | `card-hash --look v1 --compare` identical; `--look v3 --compare --allow hourglass_imp` | deterministic |
| Card face | `npx vitest run tests/art/cardface-v3.test.ts`; `node tools/shot.mjs "?dev=hatcard&id=hourglass_imp&look=v3" --scale 3` | pass; look at the 1× and 16×12 versions |
| Audio | `?dev=audio&page=one&name=hgi…&log=1` for all 25 recipes; clips for `ksSummon`, `ksAttack`, `ksFreezeTurn`, `ksKill` | peak ≤ −1 dBFS, 0 clipped; LSD vs neighbours (§7) |
| Critique | ≥ 3 rounds per moment (summon, attack, effect + bite/thaw, death), independent critic agents | |

---

## 11. Open issues / orchestrator questions

1. **Sand ownership conflict, lane F internal.**
   - `docs/v3/oturum-f/windmane_knight.md` builds its whole identity on sand: a haboob sand-wall summon, a sand-wall storm strike, earth-tone grit and a `wmkSandWall` sound.
   - YENI_KARTLAR says "kum `hourglass_imp`'in", and the brief repeats that sand belongs only to this card.
   - **Ask:** windmane should move to wind/dust-free storm material (rain, static, wind ribbons), or the owner should accept a split: "sand inside glass" (ours) versus "outdoor dust storm" (theirs).
   - Until decided, our sand is always *granular gold, glowing, gravity-bound, in or from glass*, and our sound is always glass-resonant.
2. **The plate icon** (`StatBadge.paintLockIcon` 'freeze') is a cyan "ice" hourglass. Proposal: recolour it to sand (`gold2` caps, `earth4` sand, `gold4` neck dot) so the plate and our emblem agree. This is a shared file; we will not edit it.
3. **The face-down freeze has no plate icon** (`plateLock` null when face-down). Our emblem covers it. If the orchestrator prefers the icon to show for face-down too, that is a one-line engine/view change outside our files.
4. **Pausing the target's sprite** for the 300 ms stop beat (`anims.pause` / `resume`) touches another card's unit. It is restored in a `finally`, and also on retire. If the orchestrator forbids pausing other units, the fallback is to hold its current frame with `holdFrame`.
5. **Idle SFX** (a faint trickle) has no infrastructure. It is not planned.


---

## 12. Build log — sprite rig + card art (Build-art stage, lane F)

**What was built** (the draft's `-build.ts` and `-parts.ts` are deleted; `-kit.ts`, `-glass.ts`, `-anims.ts` and the shell are rewritten in place; the §8 names `-frames.ts` / `-sand.ts` / `-maps.ts` were not used — the glass is one texture over local (u, v) coordinates, so no hand maps were needed):

| file | content |
|---|---|
| `src/art/monsters-v3/hourglass_imp.ts` | shell: 60×64, anchor (24, 60), `weight:'light'`, `p2:'relight'`, `joints()`, `portrait()` → card art small. Header carries the C2 / lumen / volt distinction note. |
| `src/art/monsters-v3/hourglass_imp-rig.ts` | `Pose`, `NEUTRAL`, `pose()`, `skeleton()`, part painters (feet + flat wrapped sandals, coat, arms, head with nose / ear / two gold eyes, the ONE floppy felt cone with brass band and sand tassel), the sand cone / heap (summon), dry-sand recolour (summon sculpt, death drying), light pass (eyes, stream, pour, ribbon, sparks, puffs, sneeze, grains), `drawImp()`, `rigPoints()` |
| `src/art/monsters-v3/hourglass_imp-glass.ts` | **`paintGlass()` (exported for the cinematics, critique #11)**: the rigid hourglass as one texture through O + u·U + v·V·sx (identity upright, any angle, a spin squash for the roar), screen-space sand (drain funnel / landing cone, gravity-correct at any angle), the stream (flow / frozen / drops / lump; dash period `per` divides each loop's frame count, so loops have no hitch), the stopper hole and the attack jet, the death crack, `dark` (clock stopped). Tilted frames (> 12° off an axis) use single-tone posts and a wider brass row (IŞ-10 noise). |
| `src/art/monsters-v3/hourglass_imp-kit.ts` | `Comp`, `planes`, `bands`, tone sets, `TO_SAND`, `hash2` |
| `src/art/monsters-v3/hourglass_imp-anims.ts` | 14 anims, **135 frames = 2.07 MB** (small class): idle 16 · guard 6 · toGuard 5 · fromGuard 5 · attack 13 (charge 1, release = impact 6, contact 7, recover 9) · roar 10 · hit 6 · hitHeavy 8 · hitMagic 8 · summon 14 (land 9) · death 10 (dissolve 4) · revive 12 (land 8) · special 12 (charge 1 = the eye-level aim, release 5, contact 6, recover 8) · victory 10. `framePose`, `framePoints` (muzzle = stopper hole on every frame), `frameJoints`. |
| `src/art/cardart-v3/hourglass_imp.ts` | sprite-crop + EPX big (88×68), hand-corrected 1× small (44×34; eye catch-light), a custom night-desert backdrop (moon ring behind the glass, no sun disc), 4 living frames (the stream marches), focus = the neck stream |
| `tests/art/hourglass_imp.test.ts` | 12 tests: registration (no exclusion), hand-built, budget; validateArt normal clean; marks; points; palette (no cyan / crim / teal / mag / water, ≤ 20 body colours, gold3/4 as light only); P2 relight silhouette; stream marches / freezes / lump; planted feet + glass and local hit f0s; death ending (glass lying, imp gone) + revive start; summon cone → land catch → idle f0; determinism; card art budgets + portrait |

**Shared one-liners:** `src/art/monsters/index.ts` — removed only `'!../monsters-v3/hourglass_imp.ts'` from the exclusion line. `src/view/light/profiles.ts` — our `MONSTER_GLOW` line: `{ emissive: [gold4 1, gold3 0.6], spill: gold3, halo 0.5, pool 0.8 }` (`white` removed).

**How the anims realise the revised design:** idle = the stream marches every frame + breath (chest, head a frame later) alternating with a rock toward the glass, hat tip lagging, blink, ear twitch, the double tap on the glass (the stream glows on the tap). Guard = crouched behind the planted glass (the glass drawn over him), eyes over the post, the peek leans OUT past the post. Attack = the glass tipped 20/45/70/90° to the hip as a cannon, stopper flicked off, recoil, a 2-px hose with grain flecks, re-cork, thunk. Roar = the glass spun like a top (width squash, the front post's brass bead jumps sides), slapped still, sand sloshes. hit = clutch + hat tip whip + the stream breaks into drops; hitHeavy = the hat slides over his eyes, the glass tips, blind grope, catch, finger pushes the hat up; hitMagic = sparks on the hat, ears up, the stream FREEZES (rev. 1), then drops as a lump. Summon = a pour from above builds a sand cone, the hat pokes out first, colour returns top-down, arms up, the glass caught (135°), twirled (45°), planted (puff), cheek to the glass. Death = clutch, hat slips back, dries to sand top-down, pours as a ribbon into the top cap, the hat lands on the cap, the glass topples backward and lies cracked, the hat rolls off. Revive = the death backwards (the hat hops back onto the cap, then onto his head), a sand sneeze. Special = eye-level aim THROUGH the lower bulb (rev. 1 #1), lifted to the front-right with the hat pushed back (rev. 1 #11), flipped 180°, the (now upper) bulb drains glowing, turned back, thunk, dusts hands.

**Iterations (looked at every PNG):**
1. b1/b2: first render. Fixed: tilted-glass noise (IŞ-10 effect 22 %), idle too still (HA-18 9.2 %), overhead / victory glass crossing the hat, hip-held glass hiding the face (HIP 51 → 53), face features too faint (darker brows + eye sockets).
2. b3–b5: idle rhythm re-authored (one big move per transition) → liveliness 15.2 %, max Δ 1.56×, seam 1.30×; death / revive hat no longer overlaps the glass (the hat hops back onto the cap in revive); body palette ≤ 20 (skin0 → earth0); stream period made loop-exact; thicker jet with flecks; guard peek made forward (MOTloop vs grim_warden). Card art moved from the DARK eclipse to a night recipe sharing the subject's tones (colours 27 → 19).

**Gates (final, `shots/v3/kart-f/hourglass_imp/final/`):**
- `monster-gates --class small --ref none`: **21 ok, 0 FAIL** (`final/gates.txt`). Margin 2, HA-14 out 0, HA-15 in ≤ 0.7, HA-16 seam 1.30, HA-17 1.56, HA-18 15.2 %, HA-19 0.43, HA-21 < 50 % (every idle phase), HA-9 feet + glass fixed in 32/32 frames, IŞ-10 all classes, IŞ-1 both views, KK-13 135 frames / 2.07 MB / ~0.8 ms per frame.
- `npx vitest run tests/art/hourglass_imp.test.ts`: 12/12 pass. `npm run typecheck`: clean.
- Sameness (`final/same/sameness.txt`): no KALIR; KEY ≤ 0.61, SI ≤ 0.10 everywhere. UYARI (7): MOTloop (the guard loop) vs shade_assassin / tide_harpooner / kite_fencer / steppe_spiralhorn (all placeholder-totem proxies) and grim_warden (0.68, lane B's rig); MOTsig vs windmane_knight 0.63 and wing_lady 0.56 (both lane F works in progress). The guard is a different picture (hiding behind a planted hourglass); recorded here as the distinction note; blind test still to do.

**Evidence:** `final/p1/hourglass_imp-file-*.png` + `final/p2/hourglass_imp-file-p2-*.png` (every anim strip, P1 / P2), `final/gates.txt`, `final/board.png` (1× / 2× tiles), `final/card/cardart-big-small-16x12.png` (big ×4, small ×8, small ×2, 16×12 mini), `final/card/hatcard.png` (in-game faces), `b5/m1Freeze-film.png` + `b5/m1Freeze-zoom.png` (the sprite in a duel under the light layer; the summon there is still the default pillar), `b1`–`b6` for the iterations.

**Known weaknesses / open:**
- No cinematics yet: in the game the summon, attack, effect and death still fall to the defaults (pillar summon, generic strike). The sprite's summon assumes the cinematic draws the hanging glass with `paintGlass()` and hands over on summon f9.
- At hip (attack f4–f8) the 90° glass covers most of his coat; the read is "imp behind a sand cannon", the face stays visible above it.
- The near hand in idle is a small 2-px-fingered mitt; the double tap reads only at 2×.
- Victory f3–f6: the fingertip touches the knob only approximately (the stubby arm is at full reach).
- Sameness UYARIs above need a blind test once windmane_knight / wing_lady settle.

---

## 13. Build log — cinematics + sound + scenarios (Build-cinematics stage, lane F)

**Files (ours):**

| file | content |
|---|---|
| `src/cinematics/kart-f/hourglass_imp.ts` | every registration (LOOK_V3-gated, priority 20, `kart-f:hourglass_imp:summon / effect / strike / death / seal-turn / seal-phase` + one reconcile observer): the "Dökülüş" v3 entrance, the aim hold, "Kum Mührü", "Kum Topu", "Kendi kum saatine akar" (option b) |
| `src/cinematics/kart-f/hourglass_imp-seal.ts` | exports only: cage / time-line / emblem / floor-hairline painters and the per-uid seal manager (follow, bite, strain, thaw, drop, reconcile from state) |
| `src/audio/v3/hourglass_imp.ts` | 26 recipes (`hgi*`, kit blocks + Voice primitives only) and `HOURGLASS_IMP_VOICE` (every required role incl. the revive pair) |
| `src/duel/scenarios/hourglass_imp.ts` | 20 scenarios `ks*` (summon P1/P2, no target, face-down seal, the seal across turns, seal + dies, revive, attack P1/P2, attack a defender, blocked P1/P2, backlash, direct P1/P2, kill P1/P2, guard, guard death, position swap) |

`DEATH_PRESETS` (light/light) and `MONSTER_GLOW` (gold4/gold3) were already right for this card; no shared edit was needed.

**How it plays (as built):**
- **Summon** (`runSummon` + own v3 entrance, no hologram): the hanging glass is the sprite's own `paintGlass` at 180° on an `ImpLayer` (a raster laid over the sprite's frame space with 48 px headroom, flipped / origin-matched like the sprite), one gold4-outline frame, then a 130 ms stream falls to the tile; the sprite's summon takes the pour over at frame y 2 (same column pattern), the hanging glass drains (sA 0.9 → 0.12) until summon f8, then falls (180 → 160 → 145°, 100 ms) into the f9 catch. hgiPour (start/stop), hgiShed f6, hgiCatch on land, plant puffs + 1-px shake + badge pop on f11, hgiGiggle f12 only without a target. With `after.pending = chooseTarget(source = imp)` the summon stops on f11 and, after `runSummon` heals the unit, `startAim` holds special f1 (a gold4 grain glints at the neck) and `ctx.keep('ks:aim')`. Revive / flip: the kit's own entrance (`ctx.base()`), then the same aim.
- **Effect**: consumes the `target` event; `ctx.take('ks:aim')` continues from special f2 (no restart); hgiFlip; at release (f5) a time line of still 1-px grains (gold3 with earth3 drop, gold4 2-px head) lights from the glass to the target in 240 ms (hgiThread) while the brass cap pops in over it in 3 steps; cage walls step out (3 × 66 ms, hgiCage), lower bulb fills (3 steps, hgiFill); THE STOP (thread cut dead, hgiSeal, the target's frame held with `pose`, a gold3 rim from its frame silhouette, one white cage frame, "SALDIRAMAZ"); condense in 4 × 60 ms (hgiCondense) → `addSeal`. The imp rights the glass in the background (hgiRight f9). Face-down: the cage round the set card, the emblem 10 px over it.
- **Seal**: emblem (9 × 13 with outline) follows the unit's idle-head top or the tile; bob 640 ms, refused twitch every 2.4 s; floor hairline with a walking glint + a small gold3 light pool. Bite at `turnStart` (turn = noAttackTurn, controller's turn), strain at `phaseChange → battle` (face-up ATK only; 1-px nudge, we never drive its frames), thaw at `phaseChange → end` of that turn; a seal whose anchor disappears drops (hgiEmblemDrop). Reconcile observer pops in emblems for staged/restored states and silently clears expired ones.
- **Strike**: attack f0→release at timeScale 1.25 (the anticipation was 0.55 s of dead air), hgiCork, a whole-px parabolic jet (apex 10, direct 26) drawn over 120 / 150 ms, `s.impact` on arrival, hgiScour / hgiSplash / hgiJetLp, sand fan + settling grains; blocked = 3-px skid; direct = 6-px dune that slides off (hgiDune); losing = the jet retracts into the neck and the death hook takes over.
- **Death**: own bookkeeping (toGraveyard claimed, `v3:dying` / `v3:dead`, planned-entry / guard-break joins as `posedDeath`), hgiDrain f4 → hgiTopple f8 → 1-px shake + dust on the lying frame; then the sprite is hidden and the ImpLayer bleeds: 4 × 55 ms emptying steps + a mist crack + an 8-px rivulet (world raster, gold3 head / earth body), the glass goes dark, the last grain falls (hgiLastGrain), the card is born, a 3-step hashed pixel dissolve.

**Evidence** (`shots/v3/kart-f/hourglass_imp/`): `camera-base.json` (placeholder base, measured BEFORE the cinematics), `r1/` (first round: ksSummon, -zoom, -effect, -cage, -imp, ksAttack, ksKill, ksKill-b, sheet/special), `r2/` (second round: ksKill-b, ksBlocked, ksDirect, ksSummonP2, ksFreezeSet, ksFreezeTurn, ksRevive, ksFreezeDies, ksGuardDie), `r3/` (third), `audio/hgi*.png`, `clips/ksSummon|ksAttack|ksKill.{mp4,wav,json}`, `measure-r2.json`, `measure-r3.json`.

**Iterations:**
1. r1: everything ran end to end. Fixed: the death never showed its bleed (rivulet painted under the glass's own outline in frame space → moved to a world raster below the crack; the emptying now visible); the time line was invisible (gold2 1-px dots) → gold3 + earth3 drop, 2-px gold4 head; "SALDIRAMAZ" lingered → removed at condense step 3. (Note: the flip itself is correct — an upside-down hourglass is symmetric, so f4–f6 read mainly by the overhead lift and the brass knob.)
2. r2: P2, face-down, turn beats, revive, guard death checked. Sound: grain gains de-spiked (raw peak 1.20 → 0.84), 9 kHz top, hgiLastGrain +11 dB (it was −35 dB), hgiScour louder, hgiSeal reverb 0, hgiRight thunk moved to f11 (0.21 s). Strike anticipation ×1.25; direct travel 150 ms, keep 90 ms; bleed steps 55 ms.

**Gates:** `npm run typecheck` clean for our files. `npx vitest run`: 1339 pass, 2 fail — `cardface-v3` G1 (scrap_raiders 0.69) and `dusk_ashen` validateArt, neither ours. Camera gate `measure --camera-gate camera-base.json`: 21 ok, 0 FAIL. v1 films: `filmdiff --set v1` 17/17 IDENTICAL. Clips: peak −1.9 dBFS, 0 clipped (ksSummon, ksAttack, ksKill).

**Budgets (measure, game ms):** effect 1850 (revive path 2150) ≤ 2320; attack battle 2150 (+ declare 316) ≤ 3190; blocked 2117; direct battle 2167 ≤ 2320 (2483 incl. the declaration); death 1966 / backlash 2016 ≤ 2030; summon (pour) 1983, no-target 2433; turn beats add 0 ms (turnStart 617 / phaseChange 150 as the base).

**Known weaknesses / open:**
- The flip (special f2–f6) reads weakly in the duel: the glass is symmetric and the overhead lift can be hidden behind a neighbour's stat plate on a crowded row.
- The death's rivulet is small (8 px by design) and partly hidden by the glass foot from some angles; the "dune" of the direct attack is faint at 1×.
- The jet keeps spraying while the lumen_sprite death plays (by design, but busy).
- Not built: dormant emblem while the sealed monster is borrowed (`controlChange`), `ksBoard5`, `ksFreezeSteal/Def/Flip` scenarios; the strain is a 1-px nudge + hairline clamp only. LSD sound separation vs windmane_knight / crystal_wyrm not measured. Critique by independent agents not run in this stage.

### 13.1 Round 3 (Build-cinematics re-run)
- **Looked at:** `r3/ksSummon.png`, `r3/ksSummon-zoom.png`, `r3/ksSummon-pour.png` → `-pour2.png`, `r3/ksSummon-effect.png`, `-effect2.png`, `r3/ksAttackP2.png`, `r3/ksKillP2.png` / `-zoom.png`, `r3/ksFreezeFlip.png`.
- **Fixed:** the hanging glass of the summon hung ≈ 90 px over the tile, beside the opposing back-row monster (read as "their" object). `HANG.oy` −32 → −10: it now hangs ≈ 42 px over the tile (design §5.1: 38 px), its mouth just above the cone's crest, so the pour reads as one short column from his own glass.
- **Added scenarios:** `ksFreezeFlip` (sealed set card flip-summoned next turn: the emblem follows the flip and the plate shows the lock), `ksFreezeDef` (sealed monster in defense: bite, no strain). Both filmed / measured.
- **Gates:** typecheck clean; `tests/art/hourglass_imp.test.ts` 12/12; camera gate `measure-r4.json` 21 ok + 2 NOBASE (the two new keys), 0 FAIL; `filmdiff --set v1` 17/17 IDENTICAL. Budgets unchanged (summon 1983, effect 1850, death 1966, attack battle 2150, direct 2167 game ms).
- **Still open:** the overhead flip (special f2–f6) is partly hidden behind a back-row neighbour's stat plate when one stands right above (ksSummon: volt_lizard); dormant emblem on `controlChange`, `ksBoard5`, `ksFreezeSteal` not built; LSD sound separation not measured; independent critique agents not run.

---

## Round 1 (Fix round 1/3, lens craft)

The critic's verdict was needs-work, with 5 high, 7 medium and 1 low findings. I fixed all 13. Evidence is under `shots/v3/kart-f/hourglass_imp/fix1/`:
- `p1/`, `p2/`: every anim strip.
- `s2/`, `s3/`, `s3z/`: the iteration strips.
- `film/`: the in-game films.
- `card/`: the card art.
- `gates.txt`, `same/sameness.txt`, `measure.txt`.

I looked at every PNG.

| # | sev | finding | what I did | evidence |
|---|---|---|---|---|
| 1 | high | The body was static in attack, special, victory and roar | Every action frame now has whole-body keys. **Attack:** the brace and lean back come first, and the back foot steps back 2 px (f1–f3). The deepest load at f4–f5 is crouch 3, with the head tucked and the hat tip lagging forward. The recoil at f6 is bx −3, with a head bob and the hat tip whipping back. f7–f8 shake 1 px, and f9–f11 settle while the tassel overshoots. **Special:** he rises (by −1), leans back under the glass and swings the far arm out for balance. **Victory:** the body sways under the balanced glass (bx −1/+1 with lean). **Roar:** the twist winds up (crouch and lean), then the body sways and the slap crouches. | `fix1/s2/hourglass_imp-v3-attack.png`, `fix1/p1/*-special.png`, `*-victory.png`, `*-roar.png` |
| 2 | high | The rigid-glass rendering broke the pixel language | `hourglass_imp-glass.ts` has two changes. (a) `snapGlass`: a tilt within 10° of an axis is no longer rotated. It snaps to the axis and shifts by whole pixels, so the hitHeavy and victory wobbles, the attack thunk and the death rock have no doubled or jagged posts. (b) A tipped or lying glass keeps only the screen-lower post (2 px, wood), so the open side shows the bulbs' curved pinch in the silhouette. It no longer reads as a picture frame or a crate, and the brass row is 1.25 px (the wood dominates). The cannon is now held forward at chest height, so the glass spans x ≈ 27–55. His face and coat stay visible, and the far hand is pinned to the back cap. **Partly rejected:** I did not hand-draw separate 20/45/70/90/135° textures. The cinematics share the one parametric `paintGlass` (the summon hand-over, the death bleed and the blocked catch), and with (a) and (b) the tilted frames read cleanly at 1× and 3×. | `fix1/s1` (before) vs `fix1/s2/*-attack.png`, `fix1/p1/*-hitHeavy.png`, `film/ksAttack-zoom.png` |
| 3 | high | The death pour was a one-frame pop | The death is 14 frames, with dissolve on f4. The order is: hit, then crouch, then dry, then the pour begins. On f5–f6 the dry body is eaten top-down (new `cut` pose field) while a thick 3-px ribbon curls into the cap. The upper bulb rises a step per frame (sB 0.66 → 0.74 → 0.82 → 0.9 → 1). The hat stays dry sand (new `hatDry`), flies in an arc from the head to the apex and then to the cap, and is re-coloured only when it lands (f7). The heap at his feet shrinks. f8 is full and rocks 1 px top-heavy. The topple runs −20 / −45 / −70 / −90°, with a 1-px bounce on landing and then the lying frame. The cinematic's topple sound and landing shake follow `DEATH_TOPPLE` and frame n−2. | `fix1/p1/hourglass_imp-v3-death.png`, `film/ksKill-death.png` |
| 4 | high | The flip was hidden behind the back-row neighbour's plate | (a) The flip now stays at chest and head height in front of him (20 / 45 / 90 / 135 / 180°, centre y ≈ 34 instead of 25). (b) From the start of the flip until THE STOP, the effect raises the imp's sprite depth above every stat plate (`BADGE_DEPTH + 1`). It is restored at the stop and also in `finally`. | `film/ksSummon-flip.png` (the glass turns over the volt_lizard 1500/1200 plate), `film/ksSummon-effect.png` |
| 5 | high | The card art was the idle sprite EPX-upscaled | `cardart-v3/hourglass_imp.ts` is a native 88×68 composition on one pixel grid. A giant hourglass sits at x 41–81 and bleeds off the bottom. It has a dark wooden cap with a brass row, a mist glass wall, the upper funnel and the lower heap. The imp leans in from the left with his cheek and nose against the left post. His face is lit warm on the glass side, his eyes are gold, and the felt cone flops off the top-left with a sand tassel. The focus is a 3-px gold4 / gold3 neck stream that marches over the 4 living frames. Behind him are a crescent moon and night2 / night3 dune bands. The small art is the big one reduced 2:1, plus hand dots for the eyes and the stream. The art has 20 colours and passes the test. | `card/hatcard3.png` |
| 6 | med | The summon cone was flat and the sculpt was a pop | The cone is now lumpy and stepped: hashed 1-px flank jitter, shelf lines every 3 rows, a walking gold3 crest with a gold4 landing pixel, and a grain rolling down each flank 2 px per frame. The summon is 16 frames, with land at 11. f6: the hat tip breaks the crest (the cone is drawn over the dry body). f7: the shoulders bulge into a head and arms. f8–f10: the sand bands slide down 7 px per frame. The cinematic's hanging glass follows `LAND`. | `fix1/s3/hourglass_imp-v3-summon.png` |
| 7 | med | The jet was a thin static line | `paintJet` now draws a 3-px hose: gold4 glints along the top, a gold3 core and an earth4 underside, with a 2-px gold4 head. Grains peel off the underside and fall 1 px a frame on a 4-frame life, so the hose visibly moves even while it is held. It is drawn 3 px wide during travel too. A new `footPile` raises a sand pile at the struck monster's feet in 3 steps, then it sinks. The ring circles in the critic's film belong to lumen_sprite's own death preset, not this card. The white starburst is the shared `s.impact`, which we must call for the number timing. | `film/ksAttack-zoom.png` #2–#11 |
| 8 | med | Blocked had no comic backlash | `BLOCKED_CATCH` adds 4 runtime poses drawn by the rig on an `ImpLayer`, so the sprite frame budget is not used. The splash knocks the cannon out of his grip nose-up and it tumbles. He lunges with both arms and his eyes squeezed shut, catches it against his chest (hgiCatch) and settles sheepishly with his ears drooped. The sprite resumes on the attack's thunk frame. | `film/ksBlocked-zoom.png` #12–#19 |
| 9 | med | The death bleed was unreadable | The rivulet is drawn above the sprite and card depth and runs off the glass foot onto the bare tile. It grows in 4 steps of 3 px to 12 px, with an earth2 bank row under it and a gold3 / gold4 head. The crack is a 7-px mist zig-zag with a white glint on the bulb's lit (upper) face. | `film/ksKill-bleed.png` #4–#11 |
| 10 | med | The cage sand read as a slab | The sand is clipped to the bulb curve. The surface is mounded (highest under the stream, sloping 3 px to the glass), with a gold4 / gold3 crest per column, an earth4 band and sparse grains. The bulb walls are 2 px (steel) on the lit side at the widest rows. The cap is sized to the cage (`R` instead of `R + 2`) and has dark wooden end blocks. | `film/ksSummon-cage.png` |
| 11 | med | hit and hitMagic were too close to idle | **hit:** f0 is a crouch with a lean back, the head snapping back and the hat tip whipping 4 px. f1 squashes 2 px with a head snap. **hitMagic:** the ears stand 3 px taller, straight up. The eyes are 2×2 gold (wide), the body is lifted and rigid, and the hat tip stands up. **hitHeavy:** the brim drops 4 px over the eyes and tilts −12°. The glass stays planted, and HA-21 holds (< 50 % in every idle phase). | `fix1/s3/hits-guard.png` |
| 12 | med | The glass floated in the aim and the flip | New pose fields `pinN` / `pinF` pin the hand to the nearest grip point on the glass (posts and cap ends) on every frame. They are used in the aim, flip, pour and recover frames, in victory f1–f2, in the attack and in the catch. The flip has 45° and 90° in-betweens, so special is 14 frames (release 7, contact 8, recover 10, thunk `SPECIAL_THUNK` 11). In the aim, the lower bulb is in front of his eye: the glass is held so the gold eye shines through the clear part of the bulb. | `fix1/s3z/top.png`, `fix1/p1/*-special.png` |
| 13 | low | The guard was not taking cover | The body moves 5 px over behind the glass (`gFront`). Only the hat cone and the gold eyes show over the post, and both hands clamp the post. toGuard and fromGuard step there (bx 2 → 4 → 5). | `fix1/p1/*-guard.png`, `*-toGuard.png` |

**Frame budget:** death +4, special +2 and summon +2 are paid for by roar −2 (spin frames merged; the body now sways) and revive −1 (the crack-off frame), for a total of **140 frames / 2.15 MB**. The test's frame cap moved to 150; the bytes rule is unchanged.

**Gates:**
- `monster-gates --class small --ref none`: **21 ok, 0 FAIL** (`fix1/gates.txt`).
- `tests/art/hourglass_imp.test.ts`: 12/12.
- `npm run typecheck`: 0 errors.
- `cardface-v3`: 21/22. The one failure is G1 on scrap_raiders, which is not ours.
- Sameness (`fix1/same/sameness.txt`): 0 KALIR and 3 UYARI, down from 7.
  - lumen_sprite: MOTsig 0.554, a proxy.
  - shade_assassin: MOTloop 0.685, a placeholder proxy.
  - wing_lady: attack rhythm, lane F WIP.

- Camera gate: `measure --camera-gate camera-base.json` on 7 `ks*` keys gives 7 ok and 0 FAIL (`fix1/measure.txt`).
- Budgets (game ms, `fix1/measure.json`, `measure-death.json`): all within budget.

| moment | before → after | budget |
|---|---|---|
| effect | 1850 → 1933 | ≤ 2320 |
| attack battle | 2150 → 2134 | ≤ 3190 |
| blocked | 2117 → 2350 (the catch) | ≤ 3190 |
| direct | 2167 → 2150 | ≤ 2320 |
| death | 1966 → 1900 | ≤ 2030 |
| backlash death | 2016 → 2016 | ≤ 2030 |
| revive | 2150 → 2250 | ≤ 2900 |
| summon | 1983 → 2083 | — |

To fit the new death frames in the budget, I made the death holds tighter and cut the wait before the bleed from 90 ms to 30 ms.

**Still open:**
- The −1600 number of the blocked attack covers the imp during the catch. That is generic number placement, not ours.
- The card art's face could take one more value pass: a warmer glass-side light, and the posts show only beside the bulb.

---

## Round 2 (Fix round 2/3, lens unique)

The critic's verdict was needs-work: 3 high, 4 medium and 4 low findings. I fixed all three highs. #2 is fixed except for one shared-engine limit (see below). I fixed the mediums. Of the lows I fixed #9 and #11, partly fixed #8, and handed #10 to the orchestrator.

- **Evidence:** `shots/v3/kart-f/hourglass_imp/fix2/` (gitignored).
  - `s1/` and `s2/`: the special iterations.
  - `p1/` and `p2/`: every anim strip.
  - `film/`: the in-game films.
  - `audio/`: the per-recipe pages and `contact.png`.
  - `clips/`: `ksSummon`, `ksSummon-music`, `ksKill` and `ksFreezeTurn`, each as `.mp4`, `.wav` and `.json`.
  - Gate output: `gates.txt`, `measure.txt` / `measure.json`, `measure-death.json`, `same/sameness.txt`.
- I looked at every PNG.

| # | sev | finding | what I did | evidence |
|---|---|---|---|---|
| 1 | high | The effect's flip copied the attack's cannon pose and its charge sound | I re-authored special f2–f8, still 14 frames and 140 in total. From the eye-level aim (f1), the glass goes UP and BACK over his far shoulder (−25°), behind his head (−135°), and is held INVERTED OVERHEAD behind the hat (−180°). It never passes the attack's 45° or 90° chest frames, and its neck never points at the target. A new rig field `gBack` draws the glass behind him, with its light clipped to the visible glass. A new glass field `glowUp` makes the now-upper bulb's sand glow (a gold4 surface over gold3) on the release, so the frame cannot be read as idle. The way back reverses the arc (−120° → −30°), then thunk and dust. Marks: charge 1, release 5, contact 6, recover 9; `SPECIAL_THUNK` 11; new `SPECIAL_DRAIN = [6, 7, 8]`. Sound: the effect now opens with its own recipe, **`hgiInvert`**: a brown-noise wooden "turn" with no tinks, a sand slosh whose band falls and then rises (bulb to bulb), and a low B♭3 swell. `hgiFlip` is now the attack's alone. | `fix2/s2/hourglass_imp-v3-special.png`, `fix2/p2/hourglass_imp-v3-p2-special.png` (P2), `fix2/film/ksSummon-effect.png` #14–#29, `fix2/audio/hgiInvert.png` |
| 2 | high | The seal's silence could not be heard, and its tone was a sine beep | (a) `hgiFill` is now a sustained `start()` at its peak rate, and `hgiThread` (now a whistle) stays loud. Both are cut with `stop(0)` in the same frame as `hgiSeal`. `hgiThread`, `hgiCage`, `hgiFill` and `hgiSeal` are now dry (verb 0), so no tail fills the gap. The gap is now 80 ms. **Music off:** about −20 dB right up to 3840 ms, then −61 dB from 3860 to 3920 ms. That is a dead cut and about 40 dB down. (b) A silent recipe, `hgiHush` (duck 1), fires at `hgiFill`, about 220 ms before the cut. **Music on:** the gap now reads −26 dB against −20 dB. **Not reached:** the 30 dB target with music on. The shared `applyDuck` (`src/audio/engine.ts`) floors every duck at 0.5 gain, which is −6 dB at most, and no API in our files can go deeper. **Orchestrator ask:** a deeper "hold" duck (for example `music.hold(depthDb, ms)` or a recipe `duckDepth`), on the order of −24 dB for about 150 ms. (c) The held tone is now FROZEN GLASS: the trickle as a static noise band through the same bulb resonances (1.4 and 2.8 kHz, q 12, no modulation), a quieter B♭4 sine and a faint 3rd partial. The F5 sine and the octave sine are gone. The tone sits about 5 dB lower than before (−21 dB RMS in the clip, was −16 dB), and the 2 ms hard cut is kept. | `fix2/clips/ksSummon.wav` and `ksSummon-music.wav` (10 ms RMS 3740–4000), `fix2/audio/hgiSeal.png` |
| 3 | high | The emblem was unreadable and sat under the wall brazier | New `headOf(u)`: the unit's `head` point. For a v1 art on a long body, it takes the column just behind the muzzle (not the back flames). The emblem sits on the silhouette top of that column, plus 3 px. For ember_wolf the emblem now floats over the head, clear of the brazier. The condense step now flies to that spot. The emblem has a 1-px gold halo outside its ink (gold3 on the lit side, gold2 on the other), a gold4 frozen dash, and a brighter light pool (0.7). **Bite:** a two-beat gold4 flash on the emblem and the floor ring, and the ring steps in 2 px. **Strain:** sand grains climb 3 px up the legs at 7 columns, hold, and slide back, with a gold4 flash. I re-filmed at `--every 60`. | `fix2/film/ksSummon-emblem.png`, `ksFreezeTurn-bite.png` (#3–#5 flash), `ksFreezeTurn-strain.png` (#3–#5), `ksFreezeTurn-strain2.png` (#1–#5 the grain climb, #9–#11 the thaw) |
| 4 | med | Pour, thread, drain and revive sounded the same | The grains stay as the shared material, and each moment gets its own layer. **Pour:** a hollow falling-column "thrum" (pink noise, band 500 → 900 Hz rising, 7 Hz wobble) plus a low aperiodic patter of landing knocks. **Thread:** no flowing grains. A bowed-glass whistle (a narrow band at F5, q 30, slow swell) plus one `hgiLitTick` (5.2 kHz) per two lit grains. **Drain:** a sucking inward crackle through a closing band (3.2 → 0.9 kHz, a reversed swell that cuts) plus the imp's descending "eep". **Revive:** the suck reversed (an opening band) plus three giggle blips rising. | `fix2/audio/contact.png` (Pour, Thread, Drain, ReviveGather, Fill, Invert: now visibly different) |
| 5 | med | The death sound was thin and the imp had no voice | New **`hgiEep`** at death f2 (the clutch). New **`hgiCreak`** at the rocking full glass (f8). **`hgiTopple`** now plays on the landing frame (n−2) instead of the tip start: the thud, the crack, a 150 ms ring on harmonic partials only (B♭5 ×1/2/3), and a slosh (a grain burst with a falling rate and band). New **`hgiBounce`** on the bounce frame (n−1), 66 ms later and about 7 dB under the topple. `hgiLastGrain` is louder (−17 dB loud, was −23.8 dB) and its ping now decays over 120 ms. | `fix2/clips/ksKill.json` (Eep 1233, Drain 1417, Creak 1733, Topple 2017, Bounce 2083, Bleed 2133, LastGrain 2467), `fix2/audio/hgiTopple.png` |
| 6 | med | Several beats were close to inaudible | **hgiCondense:** −30.2 → −20.5 dB (a stronger sweep, the hum glide, grains, and a brass double clink when the emblem snaps shut). **hgiEmblemDrop:** −31.6 → −23.5 dB. **hgiDune:** −29.1 → −22.9 dB (+6; raw peak 1.04 at the limit, so I stopped there). **hgiBite:** −24.7 → −19.6 dB, with a 3 kHz identity click and a brass tick. It now plays 300 ms after `turnStart`, after the turn's card slide: in the clip the slide is at 4967 ms and the bite at 5100 ms, about −17 dB over the slide's tail. | the `fix2/audio/*.png` stats, `fix2/clips/ksFreezeTurn.wav` |
| 7 | med | The paired-hourglass link did not read | The imp is held on his drain frames: release f5 during the line and cap, f6 when the cage walls step out, then f6 → f7 → f8 with each of the cage's three fill steps. His upper bulb empties a step as the target's lower bulb fills a step. The time line is now STRAIGHT (`timeLine(…, 0)`), from his glowing upper bulb to the cap, so it cannot read as a projectile or as the jet's parabola. | `fix2/film/ksSummon-effect2.png` #4–#14 |
| 8 | low | The summon opened with the shared cyan tile flash | **Partly.** The cyan comes from the shared card slam (`fx.slamToZone` → `TileCard.slamIn`): it is P1's player colour, used by every v3 card's summon (crystal_wyrm's too), not this monster's body. Removing it means changing the shared `runSummon`, which is an orchestrator ask. Over it I added our own landing mark, `dustRing`: a 2:1 earth3/earth4 ring with a gold3 rim that steps out 7 → 16 px in 5 × 50 ms and settles to earth1. The attack's `impactHeavy` is the kit's quietened body blow (volume 0.3 in `_v3/react.ts`), about 10 dB under `hgiScour` at volume 1. I accepted it as the critic allowed. | `fix2/film/ksSummon.png` |
| 9 | low | `hgiRight` played across the turn boundary | A module `phaseSeq` is bumped on every `phaseChange` / `turnStart` in our observer. The background thunk plays only if no phase change has happened since the seal, and its `maxMs` is now 1500. ksSummon: `hgiRight` 4717 ms (same turn). ksFreezeTurn: dropped. | `fix2/clips/ksSummon.json`, `fix2/clips/ksFreezeTurn.json` |
| 10 | low | The §5.1 and §5.2 rows were missing from YENI_KARTLAR | **Orchestrator ask** (shared doc, not ours). **§5.1 row:** "Kum Saati Cücesi \| sand INSIDE glass: aperiodic grains through 1.4 / 2.8 kHz bulb resonances, a B♭4 bulb hum, the time-seal stop (dead cut, silence, 4 kHz tık, frozen-glass band) \| no periodic tick-tock, no bar-mode bells, no glassReverse, no broadband hiss". **§5.2 row:** "Kum Saati Cücesi \| kendi kum saatine akar; saat yan yatar, çatlar, kum karodan dışarı akar, son tane düşer, saat söner". **Sand ownership note:** v1 `sandstorm` (`src/data/cards.ts`, `src/art/cardart/sandstorm.ts`) must use wind or dust without the glass resonance or gold grains when it gets a v3 presentation. | — |
| 11 | low | The death's bleed and ending were weak | The rivulet is 20 grains over about 29 px on the 2:1 diagonal. It runs OFF the card's front corner onto the bare tile, down-screen on both sides: on P2, up-screen it would be hidden behind the lying glass, which I tried and filmed. It has an earth2 bank row and a gold3/gold4 head, and grows in 5 steps. The last grain is a gold4 pixel at the rivulet's head: it falls 3 px, then blinks twice. Our own dissolve of the empty glass now steps ink → gold3, then earth3, then earth2. The white outline at the break is the shared `cardLeaves` card birth, not ours. | `fix2/film/ksKill-bleed.png`, `ksKill-bleed2.png`, `ksKill.png` |

**Gates:**
- `npx tsc --noEmit`: 0 errors.
- `npx vitest run tests/art/hourglass_imp.test.ts`: 12/12. One HA-3 recovery-hold fix was needed along the way.
- `monster-gates --class small --ref none`: 21 ok, 0 FAIL (`fix2/gates.txt`). 140 frames, 2.15 MB.
- Sameness: 0 KALIR and 2 UYARI, the same two placeholder proxies as before: lumen_sprite (MOTsig 0.554) and shade_assassin (MOTloop 0.685).
- Camera gate (`measure --camera-gate camera-base.json`, 8 `ks*` keys): 8 ok, 0 FAIL.
- Clips: peak −1.9 to −2.1 dBFS, 0 clipped samples (ksSummon, ksSummon-music, ksKill, ksFreezeTurn).

**Budgets** (game ms, `fix2/measure.json`, `measure-death.json`):

| moment | now | budget |
|---|---|---|
| summon | 2083 | — |
| effect | 1833 | ≤ 2320 |
| revive effect | 2150 | ≤ 2320 |
| attack battle | 2134 | ≤ 3190 |
| direct | 2150 | ≤ 2320 |
| death | 1850 | ≤ 2030 |
| backlash death | 1966 | ≤ 2030 |

To keep the death inside its budget with the longer rivulet and the grain blink, I tightened the bleed steps to 36 ms, the grain steps to 22/18 ms, the dissolve steps to 40 ms and the pre-bleed wait to 20 ms.

**Still open:**
- **Music-on silence depth:** blocked by the shared duck floor (#2b, orchestrator ask).
- **The cyan card-slam flash:** a shared-kit change (#8).
- **The YENI_KARTLAR rows:** #10.
- **The overhead special:** the hat partly covers the glass's lower bulb, by design: the glass is behind him. His hands reach only to the glass's lower posts, because the arms are stubby, so the hold reads as "held up behind his head" rather than at full arm's length.

---

## Round 3 (Fix round 3/3, lens integration)

The critic's verdict was needs-work: 2 high, 3 medium and 4 low findings. I fixed all nine. Three of the fixes touch shared files. Each of those edits is a small additive line scoped to this card's mechanic, and I flag them below for the orchestrator.

- **Evidence:** `shots/v3/kart-f/hourglass_imp/fix3/` (gitignored).
  - `measure-a.json`: the first pass on 8 keys.
  - `measure.json` / `measure.txt`: all `ks*` keys plus the camera gate.
- I looked at every PNG listed below.

| # | sev | finding | what I did | evidence |
|---|---|---|---|---|
| 1 | high | The red "attackers-to-be" ring flared on the frozen monster | **Shared edit (orchestrator: please review)** in `src/cinematics/v3small/turn.ts` `battleStartV3`. The ready set now skips a unit whose engine slot has `noAttackTurn === stateNext.turn`. This affects v3 only: v3small is the v3 battle beat. On the bite turn our gold strain is now the only beat on the frozen monster. Neighbours still get their ring, and a flip-summoned sealed card is covered by the same rule. **Not done:** (a) the v1 `flow/turn.ts` equivalent, because v1 has no seal presentation and its look must not move (KK-9); (b) the full legal-attackers query, because it would also drop the ring for dawn_swords / `attackLocked`, which changes other lanes' films (worth doing as an orchestrator change). | `fix3/ksFreezeTurn-zoom.png` #3–#6 (ring round volt_lizard only; the wolf gets the gold clamp), `fix3/ksFreezeTurnP2.png` #10–#12 (P1 side, same) |
| 2 | high | The refusal hint and the plate icon were generic | **Shared edits (orchestrator: please review).** (a) `src/duel/HumanInput.ts` `attackReason`: a `noAttackTurn === s.turn` branch returns "Kum Saati Cücesi zamanını durdurdu: bu tur saldıramaz". The text is Turkish because the English switch has not landed yet (YOL_HARITASI). (b) `src/duel/StatBadge.ts` `paintLockIcon('freeze')` is recoloured to match the emblem: brass gold2 caps with a gold3 lit end, earth4 sand in the top bulb, a gold3 / gold4 grain frozen mid-neck, a night2 empty neck and an earth3 heap with a gold3 crest. The cyan is gone. **Rejected:** showing the icon on face-down slots. A face-down card has no unit and so no plate (`FieldView` sets the lock on the unit). The sealed set card already carries the emblem on its tile, and changing `plateLock` means changing the engine query. | `fix3/ksSummon-plateicon.png` (8×), `fix3/ksFreezeTurn-zoom.png` (icon beside 1700/1000) |
| 3 | med | The emblem's fall was hidden under the damage number | New `crackSeal(uid)` in `hourglass_imp-seal.ts`. The observer arms a one-shot `v3:contact` listener when a `battle` will destroy a sealed target (or a sealed attacker), and calls `crackSeal` at any `destroy` of a sealed uid. At contact the emblem flashes WHITE with an ink crack through its top bulb, and this frame holds through the hit-stop above the number. It then falls (ease-in, whole px, about 150 ms) to the FLOOR ring, below the number's band, spilling sand as it goes. It bursts into 12 grains that scatter both ways along the hairline, while the ring flashes gold4 and fades in 4 palette steps. `hgiEmblemDrop` now plays at contact (5633 = contact 5633). | `fix3/ksFreezeDies-crack2.png` #1–#7 (white cracked emblem above the −1100), #9–#12 (on the floor beside the wolf's feet, grains on the ring) |
| 4 | med | The revive skipped the aim hold | The cause was that the v3 `recallV3` consumes the summon event, so our summon hook never runs. New `watchAim()`: when a batch ends on this imp's `chooseTarget` without our summon hook running, the observer waits until the revived body is at rest in idle (no claim, no pose) and then calls `startAim`. An `aiming` / `sealing` set prevents a double aim or a late aim. The revive now holds the eye-level aim through the pick, and `sealV3` continues from f2. hgiInvert → hgiThread is now **300 ms** (was 616), the same as ksSummon. The revive effect is 1833 ms (was 2150). | `fix3/ksRevive-aim.png` #3–#6 (2600–2900: the aim), `fix3/ksRevive-pick.png`, `fix3/measure-a.json` ksRevive (Invert 2967, Thread 3267) |
| 5 | med | ksBoard5, ksFreezeSteal and ksFreezeTurnP2 were missing, and there was no dormant emblem | **Scenarios:** `ksBoard5` (5+5: P2's Kor Kurdu is mud-pinned by Çamur Pençe Ruhu, then the imp seals its neighbour volt_lizard; bite, strain and thaw), `ksFreezeSteal` (seal, then Kukla İpi takes the wolf; the thief attacks with it on turn T; controlChange 'return' at the end phase; bite, strain and thaw on T+1), `ksFreezeTurnP2`. **Dormant look:** `reconcileSeals` derives the player whose turn `noAttackTurn` names. While the slot's controller differs from that player, the seal is dormant: gold1 halo, gold2 / gold1 dash, no bob, no twitch, no light pool, and a gold1 / earth1 hairline with no glint. It re-lights on the 'return' reconcile. While a control change briefly removes the unit, the seal now **hides** instead of dropping (`onFieldNow`). | `fix3/ksFreezeSteal.png`, `-key.png`, `-dormant.png` (dim, no bob, 7600–8800), `-relit.png` (re-lit, bite flash 17100), `fix3/ksBoard5-seal.png`, `-turn.png`, `-emblem.png`, `fix3/ksFreezeTurnP2.png` |
| 6 | low | The thaw ran under the next turn's slide | In `phaseBeats`, the end phase now calls `thawSeal(uid, 0)` and holds about 300 ms (`ctx.wait(300)`, then `ctx.base()`). The run-out and the pop land in the sealed player's own end phase. The grain fall and the hairline fade finish in the background. ksFreezeTurn: hgiThaw 6283, turnStart 6833 (before: thaw 6600 against slide 6633). | `fix3/ksFreezeTurn-zoom.png` #8–#14, `measure-a.json` |
| 7 | low | "SALDIRAMAZ5": the label touched the deck count tag | New `placeLabel()`. If the label's box comes within 3 px of any deck or graveyard tag (`pileTagAnchor` / `tagLeft`), it slides to the far side of the cage's centre line, away from the tag, and is clamped on screen. | `fix3/ksSummonP2-label.png` (the label ends clear of the "5") |
| 8 | low | The emblem floated in front of a left-facing face | `headOf()`: the anchor moves 3 px toward the body in frame space (`framePoint` mirrors it for flipX) and takes the silhouette top over that column ±4 px, so the emblem sits over the back of the skull. | `fix3/ksSummon-emblem.png`, `fix3/ksFreezeSteal-dormant.png` (right-facing), `-relit.png` (left-facing) |
| 9 | low | The summon plus effect was long | With `aimPending`, summon f0–f5 (the pour and the cone's build) play at timeScale 1.5. The sculpt, catch and plant keep full timing, and ksNoTarget keeps the full pour. Summon 2083 → **1866** game ms. Summon plus effect is 3700 ms, down from 3916. | `fix3/measure-a.json` ksSummon |

**Still open:**
- **ksBoard5:** on the crowded 5+5 board, the sealed back-row lizard's emblem sits over its head but overlaps the back-row Işık Perisi (gold on gold) behind it (`fix3/ksBoard5-emblem.png`). The floor hairline and the sand plate icon carry the ownership. A per-board emblem dodge was not attempted.
- **v1 ready ring and legal-attackers query:** see #1. These are orchestrator calls.
