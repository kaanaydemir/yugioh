# Bulut Yavrusu (`cloud_hatchling`): design and build plan (lane A, C3)

RÜZGAR / Ejderha · Sv3 · 1100/900 · size class 48, the grown form spills into 64 · NOT an ace (no cut-in) ·
effect `jesterAging`. Sources: YENI_KARTLAR §5, §5.1 (C3 row), §5.2 (C3 row), §6 C3, the owner decisions;
REHBER §1–§8; TEMPO.md; PARALEL_OTURUMLAR.md. Every path, function and API named below was read in the
tree on 2026-10-31. The evidence renders are in the scratch dir `kart-a/ch/` (`board.png`, `sheet.png`,
`gallery.png`, `board-*.png`).

**Pitch.** A chubby mint baby dragon. Its head is bigger than its body. A cloud cowlick sits on its
head, and half of its eggshell rides on its tail tip like a helmet. It hiccups little wind rings. It
attacks by sneezing a whistling ring of air, and it dies by curling into a ball while its egg re-knits
around it and floats away on a cloud. When a Dial Jester's coin is called right, a clock dial is cast
over it, and its hands race forward. The baby grows up in six frames, and its squeak cracks down two
octaves into a real roar. From then on it is a grown cloud dragon for good, with a slowly orbiting
cloud ring. **One card, two bodies:** the grown body is a second, complete sheet. It plays every
moment (idle, guard, attack, hits, death) in its own form, on both sides of the board, and it survives
every re-sync.

---

## 0. Why the current version fails

`?dev=monster&id=cloud_hatchling&look=v3` shows `placeholderTotem` (`src/art/monsters/_placeholder-new.ts`,
picked by `placeholderFor` in `src/art/monsters/index.ts` because `MONSTER_IDS` index ≥ 12). Problems:
- It is a green crystal totem: no dragon, no baby, no egg, no cloud. Nothing reads as C3.
- 4-frame idle / roar / attack, 2-frame hit and guard. No summon, death, revive or special poses, so
  the kits fall back to hologram and shatter (REHBER §4.9: hit / hitHeavy / hitMagic / summon / death
  / revive are mandatory).
- Its green (leaf2/leaf3) is the same green as `storm_hawk` and `thorn_lurker` (gallery).
- The v1 light row `cloud_hatchling: { emissive: [leaf4, white, leaf3] … }` (`src/view/light/profiles.ts:91`)
  would make a pale body glow all over.
- There is no grown form at all. Today the growth is only a number change, and the default
  `activate`/monsterEffect handler (`src/cinematics/_defaults/battle.ts:485`, roar + `sparkleBurst`) plays.

---

## 1. Identity and silhouette

### 1.1 What reads at 1× (in a 84×78 frame)
**Baby (idle f0 bbox ≈ 32×37, opaque ≈ 600–680 px, like `storm_hawk` 38×35 / 743 and `lumen_sprite` 33×36 / 533):**
1. **The head is bigger than the body** (head ellipse ≈ 20×18, pear body ≈ 16×16). It sits upright on its haunches like a chick.
2. **A cloud cowlick**: a 3-lobe white puff (≈ 7×5) on the crown, leaning back.
3. **The eggshell helmet on the tail tip**: a half shell (≈ 6×5) with a zigzag rim, on a short tail curling left and back. Its jagged rim is the second-strongest shape.
4. A huge round eye (4×5) with a gold iris ring and a 1-px `white` catch-light, the **brightest point** of the sprite.
5. Stubby wing nubs (≈ 6×5) that never manage a full flap, and a cream belly.
6. Pastel mint is the only mint on the board: `storm_hawk`, `thorn_lurker` and `venom_drake` are mid-to-dark leaf.

**Grown (idle f0 bbox ≈ 52×61, opaque ≈ 1550–1750 px, like `tide_golem` 54×54 / 1706 and `ember_wolf` 58×51):**
1. An upright seated dragon with an **S-neck** rising to a long-snouted head.
2. **Ram-curl horns** (an ivory spiral, a callback to the ring) and a **cloud mane** streaming back from the crown to the shoulders. It is the cowlick grown up.
3. Half-open leaf-green wings with cloud tufts on the finger tips.
4. A **permanent cloud ring** orbits the waist: an iso ellipse (≈ 48×12) of **12 identical, evenly spaced puffs** (one per hour of the dial it came from, §5.6), with its back half behind the body and its front half in front. It is baked into the grown sprite frames. The puffs step 1/24 turn per idle frame, so the ring's pixel pattern repeats every 2 frames (HA-21 phase gate, §4.1).
5. **The eggshell rim stays on the tail tip** as a band (continuity: "it was this baby").
6. Against `crystal_wyrm` (white hide, cyan crystal wings, gold crescent horns): no cyan, no crystal, and ivory spiral horns, not gold crescents. Against the lane-mates (`venom_drake` dark leaf serpent, `ashen_drake` grey vulture): a light value, a round body, and the ring.

### 1.2 Frame, anchor, hover, weight
| | Baby | Grown |
|---|---|---|
| Frame (shared, REQUIRED equal) | **84×78** | **84×78** |
| Anchor (shared) | (40, 74) | (40, 74) |
| Hover | 0 (walker) | 0 |
| `weight` | `mediumLight` (hit-stop 40–60, shake 1–2, guard push 2/3/3) | `mediumHeavy` (80–110, 3 px, 1/1/2) |
| Feet (HA-9 rows) | y 74, x 34..46 | y 74, x 30..52 |
| Bottom margin | 3 rows (Sİ-2 ≥ 2) | 3 rows |

Why the frame is shared: the grown sheet is shown by swapping the texture under the baby's anim keys (§3.3). The sprite's size and origin come from the baby art, so `w`, `h`, `anchorX`, `anchorY` and `hover` must be identical.

### 1.3 Ramps and materials (palette only: `src/art/palette.ts`)
| Part | Tones (light → dark) | Notes |
|---|---|---|
| Hide, near side (`hatchhide`) | `leaf4` (big calm lit plane), `leaf3`, `leaf2`, crease `leaf1` | `leaf4` stays the dominant lit plane on BOTH forms (the grown body must not drift toward the `storm_hawk` / `thorn_lurker` / `venom_drake` greens). Only the grown wing membrane is more saturated (row below). |
| Hide, far side | `leaf3`, `leaf2`, `leaf1`, crease `leaf0` | `farShift: 1` |
| Hide rim light (IŞ-7) | `water4` (the sky's reflection) | The only rim colour on the hide. |
| Belly scutes | `earth4`, `earth3`, seams `earth2` | Seams only on the shadow plane (MA-2). |
| Cloud (cowlick, chest tuft, mane, ring, idle hiccup ring) | `white`, `mist`, `steel`, deepest `night4` | Puffs are ≥ 2×2 clusters, flat lobes, never dithered. |
| Eggshell | `skin4` (lit), `earth4` (mid), `earth3` (shadow), speckles `earth2` (2-px clusters on the shadow plane only), inner shell `skin3` | Hand-placed plates with `_L` / `_R` maps (IŞ-2). |
| Eyes | Baby: `night0` pupil, `gold3` iris ring, `white` 1-px catch-light. Grown: `gold3`/`gold4` eye, `night0` slit | Light pixels drawn after the outline (IŞ-9). |
| Mouth / tongue | `skin1`, `skin2` | No `crim` (player colour). |
| Claws, horn nubs | `skin3`, `skin4` | |
| Grown horns | ivory bands `skin4` / `earth4` / `earth3`, groove `earth2` | The spiral bands come from the normal (3 tones). |
| Grown wing membrane | `leaf3` lit, `leaf2`, `leaf1` far; fingers `leaf3` | The only more-saturated plane of the grown form. It stays lighter than `venom_drake`'s leaf0–leaf2. Gate: on grown idle f0, `leaf4` ≥ 40 % of the hide pixels (counted in the art test). |

- ≤ 20 colours per frame (IŞ-11), ≤ 5 tones per material.
- No `cyan` / `crim` / `teal` / `mag` in the body.
- **One glint per anim** (IŞ-8): a `white` 1→3→1 px glint on the eggshell rim's lit corner. The eye catch-light is a light pixel, not a glint.

### 1.4 P2 relight
- `p2: 'relight'` on both arts (the `toMonsterArt` default). The rig lights from `lightOf({ lightFrom: 'right' })`.
- Hand maps (shell plates, horn grooves) get `_L` / `_R` versions.
- The self-lit pixels (catch-light, idle hiccup ring) are identical in both versions.
- The cloud ring's front / back split is mirrored by flipX: it is drawn facing right, so nothing changes.
- The grown P2 sheet is its own key (§3.3).

### 1.5 Card light
- **Phase 1:** the recipe's glow is `emissive: []`, `halo: 0`, `pool: 0.8`, `spill: PAL.leaf2`.
  - Why: `src/view/light/glow.ts` builds the emissive halo sheet per card id from `monsterFrame(id, …)` (baby frames). An emissive colour would float a halo where the baby's eye was, on a grown body.
  - The cinematics carry the light themselves with stepped pools (§5).
- **Phase 2 (needs the orchestrator):** a variant-aware glow (§10 R4). Then emissive `[[PAL.white, 1]]` on the catch-light only.

---

## 2. Distinction card (the `DISTINCTION` doc block exported from `cloud_hatchling.ts`)

```ts
export const DISTINCTION = {
  silhouette: 'baby: an upright chick-shaped dragon whose round head is bigger than its pear body, a white cloud cowlick, a half eggshell riding the curled tail tip like a helmet, stubby wing nubs; grown: an S-necked seated cloud dragon with ivory ram-curl horns, a streaming cloud mane, half-open wings, the shell band still on the tail and a cloud ring orbiting its waist',
  rhythm: 'comic hold-and-burst: a weeble wobble, long "ha… ha…" holds, then a 50 ms snap; the hits bounce and plop (it sits on its tail); grown keeps the very same holds but every beat lands heavy',
  idle: 'it wobbles like a weeble (one sway per loop), taps its shell on the floor twice, tries three quick wing flaps that fail, blinks, and every loop hiccups a tiny wind ring that drifts 4 px and pops; grown: the ring orbits, the mane drifts, the tail thumps, a nostril snort replaces the hiccup',
  guard: 'baby: crouched, wing nubs over the face, peeking with one eye, the shell-helmeted tail curled in front as a tiny shield; grown: wings wrapped, the cloud ring rises into a wall around it',
  signaturePart: 'the eggshell on the tail tip (and the cloud ring of the grown form)',
  material: 'pastel mint hide (leaf4 calm plane), white / mist / steel cloud lobes, cream speckled eggshell, a water4 sky rim',
  signatureMove: 'Hıçkırık Halkası: cheeks puff, two hops, "ha… ha…", a sneeze that fires a whistling hollow ring of wind which squeezes the target and snaps with a ting',
};
```

**Nearest cards and how this differs**
| Card | What is near | Difference |
|---|---|---|
| `storm_hawk` (RÜZGAR, 48, light) | wind, small, green | no feathers, no dive (the sky-dive is the hawk's alone, YENI §5): ours sits, hops and sneezes; mint vs hawk green |
| `crystal_wyrm` (dragon, white, gold horns) | dragon, pale body (grown) | no crystal, no beam, no cyan; ivory spirals; a ring projectile, not a breath beam |
| `venom_drake` / `ashen_drake` (lane-mates) | dragons | light value and round mass vs dark / gaunt; the ring vs spit / ash cone; death: egg vs bone / ash heap |
| `wisp_imp` R3 (feathers, the only "pof") | soft white puffs | we never use the "pof" cushion sound; cloud lobes are flat 3-tone, not feather layers |
| C11 `steppe_spiralhorn` (wind, spiral horn flute) | spiral horns, wind note | our whistle is a rising glide ≤ 0.3 s, never a held flute note; ivory ram curl vs a straight spiral |
| C2 `dial_jester` (clock, gear ratchet, rewinding) | the dial in our growth (same batch, right after their coin) | ours is a **sky dial**, not a clockwork one: its rim is 12 cloud puffs (`white` / `mist`), the ticks are `water4`, the two hands are wind streaks, and gold appears only on the 12 pip. It runs forward and **empties itself** (the hour-puffs fall onto the body, §5.6). **No ratchet, no click train:** our growth sound is air "fwip" pulses circling the stereo field (§6.2 `hatchGrowFwip`). The gear ratchet stays C2's alone (YENI §5.1) |

---

## 3. Rig approach

### 3.1 Choice: hand rig on the rigkit core, ONE compiled pose table, TWO shells
- **No body plan fits.** `src/art/bodyplans/` has only `biped` (humanoid). The serpent plan (`coral_serpent-plan.ts`, used by `venom_drake`) is a coil. A chick-shaped baby dragon is neither, and it needs an `age` parameter that changes proportions.
- **Follow `crystal_wyrm`'s craft on the shared core** (REHBER §1, A3: new monsters use the shared modules):
  - `Raster` (`src/art/rigkit/raster.ts`) with its primitives: `ell` (head, cheeks, body, cloud lobes), `tube` (neck, tail, limbs), `facet` (shell plates, horn bands) and `shard` (shell fragments).
  - `materialTable`, `despeckle`, the composite creases (`src/art/rigkit/composite.ts`), `edgePaint` / rim and `cracksOn` (`passes/cracks.ts`, with an own `CrackStyle` for the shell).
  - Not `dissolvePass`: it is an art-time pass on a rig `PartComp` (`rigkit/passes/dissolve.ts:36`), not a runtime effect. The float's final scatter is our own raster in `cloud_hatchling-fx.ts` (§5.5).
- **Motion:** `definePose` (`src/art/rigkit/pose.ts`) → `compileAnims` (`src/art/rigkit/anim.ts`) → `toMonsterArt(compiled, shell)`.
  - Marks come from the beat names (`charge`, `release`, `contact`, `recover`, `land`, `dissolve`, `struck`). The compiler enforces out = 0 (HA-14), the struck-region rule (HA-21), the follow lag (HA-6) and the phase wrap (HA-7).
- **The key trick:** compile the anims ONCE, then call `toMonsterArt` twice, with a baby shell and a grown shell.
  - Every anim of the grown art has **the same `AnimSpec` (frames, holds, marks)** as the baby's, by construction.
  - That is what the texture swap of §3.3 needs: the unit keeps playing the baby's anim keys `mon:cloud_hatchling:<anim>`, and only the texture under them changes.
  - The pose type carries `grow` (0 … 1). The shell's draw uses `age = shell.age ?? pose.grow`. The baby shell (`age` undefined) draws the growth special frame by frame from `pose.grow`; the grown shell (`age = 1`) always draws the adult.
  - So the baby `special` ends on a frame that is **pixel-identical** to grown idle f0, and the swap is seamless.

### 3.2 Pose fields (`HatchPose`, sketch)
- **Body:** `hip [x, y]`, `squash` (−1 stretch … 1 squash: the hops / plops, drawn in pose, never `setScale`), `sway` (weeble lean, ±2 px at the head), `lift` (hop height in pose, px).
- **Head:** `head [dx, dy]` (relative to the chest, a follower), `headTilt`, `cheeks` (0 … 1 puff), `jaw` (0 … 1), `eye` (0 open / 1 squeezed / 2 X / 3 white-hot / 4 swirl), `blink`.
- **Cloud:** `cowlick` (sway phase), `tuft` (chest fluff bristle 0 … 1).
- **Wings and tail:** `wingN` / `wingF` `{ open, flap }`, `tailCurl`, `tailTap` (the shell knocks the floor), `shellTilt`.
- **Effects in the body:** `hiccup` (0 … 1: the jolt + the tiny ring in the frame), `ring` (the grown waist-ring orbit phase 0 … 1, `phase` field: it wraps per one-shot, HA-7).
- **Story fields:** `grow` (0 … 1), `egg` (summon / death / revive: 0 = no shell … 1 = closed egg), `knit` (0 … 1, the death's knit lines), `burst` (the summon's shell pop), `tumble` (0 … 1, the somersault), `smearFrom` (release only).
- **Regions** (`REGION_IDS`): `head` = head + cowlick + jaw + horns, `chest` = body + belly + tuft, `wingN` / `wingF`, `lower` = legs / feet, `hips`, `tail` = tail + shell, `extra` = cloud ring + hiccup ring.

### 3.3 Showing the grown form permanently (the variant mechanism, additive)
**How the sheet machinery works today (read):**
- `MonsterUnit` (`src/duel/MonsterUnit.ts`) shows a `UnitSprite`. The anim keys are `mon:<id>:<anim>`, and every anim frame is set on the anim's own sheet `p1Key = mon:<id>` first.
- `UnitSprite.syncSheet()` (`MonsterUnit.ts:186`) then swaps the texture to `unit.sheetKey`, keeping the frame name. It returns early unless the current texture is `p1Key` or `p2Key` (line 188), and when the target sheet lacks the frame name (`if (!tex.has(name)) return`).
- That is how the P2 relight sheet `mon:<id>:p2` works (`applyFacing`, line 1197 → `monsterSheetKey`).
- `UnitSprite.setFrame(name)` calls Phaser's `setFrame` on the CURRENT texture first. A name missing there makes Phaser `Texture.get` return the `__BASE` frame, which is the whole sheet.
- `prepareMonsterSheet(scene, art, { key, draw }, boot)` (`src/art/textures.ts:894`) can register ANY MonsterArt under ANY key, lazily painted. `warmMonsterSheet(key, anims)` paints it in background slices.
- A non-registry art gets its own frame cache (`cacheOf` → `otherCaches`) and a grid sheet, because `cropsArt` needs registry identity (`textures.ts:96`). The registry's trimmed frames keep `realWidth / realHeight` = the full 84×78 (`Frame.setTrim`, `textures.ts:697`), so a cropped baby frame and a grid grown frame of the same name place identically. The Δ = 0 swap test (§4.10) and the swap film prove it.

**The plan.** It is additive: v1 and every unit without a variant take today's code path.
1. **`src/art/variants.ts` (new, generic, art-side only):**
   ```ts
   export interface MonsterVariant { name: string; art(): MonsterArt; when(slot: MonsterSlot): boolean }
   export function registerMonsterVariant(id: MonsterId, v: MonsterVariant): void
   export function slotVariant(id: MonsterId, slot: MonsterSlot): string | null   // null unless LOOK_V3
   export function variantArt(id: MonsterId, name: string): MonsterArt | null
   export function isVariantArt(art: MonsterArt): boolean
   export function variantSheetKey(id: MonsterId, name: string, player: PlayerId): string // `mon:<id>:<name>` / `mon:<id>:<name>:p2`
   export function ensureVariantSheet(scene: Phaser.Scene, id: MonsterId, name: string, player: PlayerId): string
   //   prepareMonsterSheet(scene, art, { key, draw: player === 1 && art.p2 === 'relight' ? { lightFrom: 'right' } : undefined })
   //   once per key, then warmMonsterSheet(key, every anim of the variant)
   export interface RewindStep { anim: MonsterAnim; reverse: true }
   export function rewindAnims(id: MonsterId, variant: string | null): RewindStep[] // the cross-lane contract, see 5.
   ```
   - The registration lives in `src/art/monsters-v3/cloud_hatchling-grown.ts`: `registerMonsterVariant('cloud_hatchling', { name: 'grown', art: () => cloudHatchlingGrown, when: (s) => s.permAtk !== undefined })`.
   - The `monsters-v3` glob imports that file eagerly in both looks. That is harmless because `slotVariant` returns null unless `LOOK_V3`.
2. **`src/duel/unit-variant.ts` (new, owned by this card, generic):** everything that is not a hook in `MonsterUnit`.
   - `variantOf(u): string | null`: a `WeakMap<MonsterUnit, string>`. Cinematics test `variantOf(u) === 'grown'`.
   - `setUnitVariant(u, name)`: upgrade-only (a unit that has a variant is never set back to null; the variant is permanent until the unit retires). It calls `ensureVariantSheet` for the unit's player, stores the name, then `u.setArt(variantArt(...))`.
   - Installs `MonsterUnit.sheetFor = (u) => { const v = variantOf(u); return v ? ensureVariantSheet(u.scene, u.cardId, v, u.player) : null; }` at module load, inside `if (LOOK_V3)`.
   - `unitFrame(u, anim, f)`: `artFrame(u.art, anim, f, u.sheetKey === u.p2Key || u.sheetKey.endsWith(':p2') ? { lightFrom: 'right' } : undefined)`. It is the one helper every "read the unit's current pixels" site should use (step 6). For a unit without a variant it returns exactly `monsterFrame(u.cardId, anim, f, opts)`, because `u.art === monsterArt(id)` and `cacheOf` returns the same cache.
3. **`src/duel/MonsterUnit.ts`: the minimal hooks (≈ 12 lines, all no-ops for a unit without a variant):**
   - `static sheetFor?: (u: MonsterUnit) => string | null;` and in `applyFacing`: `const key = MonsterUnit.sheetFor?.(this) ?? monsterSheetKey(this.cardId, this.player);`. Also store `this.baseKey` (the non-variant key `monsterSheetKey(...)`, existence-checked like today).
   - `setArt(art: MonsterArt)`: `art` loses `readonly`; `setArt` assigns it, re-keys the drop shadow from the new idle 0 bounds (`this.shadow.setTexture(shadowKey(scene, rx))`; `shadowKey` stays module-private), then `applyFacing()`. Then `u.art.points`, `u.art.weight` (hit-stop / shake / guard push via `motion.ts`), `animSpec(u.art, …)` (identical by construction) and `u.art.muzzle` / `core` follow the grown body.
   - `ownsKey(k)`: `k === this.p1Key || k === this.p2Key || k === this.baseKey || k === this.sheetKey`.
   - `UnitSprite.syncSheet`: the guard becomes `!u.ownsKey(cur)`. On a held pose (no anim ticking), a control change then moves the sprite from the P1-lit grown sheet to the P2-lit grown sheet. When `sheetKey` lacks the frame name, it falls back to `u.baseKey` (the player's baby sheet) instead of staying on `p1Key`. So the baby-only frames (`special`, `summon`, `revive`) keep the correct P2 lighting even on a grown unit, which the rewind needs.
   - `UnitSprite.setFrame(name)`: when the current texture lacks `name` and `u.ownsKey(cur)`, switch the texture to `u.p1Key` before `super.setFrame`. `syncSheet` then moves it to the right sheet. This removes the `__BASE` whole-sheet frame.
   - `worldPoint('top')` (line 512): `artFrame(this.art, 'idle', 0).bounds()` instead of `monsterFrame(this.cardId, …)` (identical for every other unit, by the `cacheOf` reason).
4. **`src/duel/FieldView.ts` `sync` (one line, after `const u = e.unit!;`):**
   `if (LOOK_V3) { const vn = slotVariant(cardId as MonsterId, slot); if (vn && variantOf(u) !== vn) setUnitVariant(u, vn); }`
   - A unit created by a sync (a control change, a resync after a cinematic forgot a unit, a reload of the board) is grown at once.
   - An existing grown unit is never downgraded.
5. **`src/cinematics/_core/project.ts` `applyEvent` (a PRECONDITION, not optional; ask the orchestrator):** in `case 'activate'`, before the `monsterEffect` early return, when the activating card's effect is `jesterAging` and its slot is face up without `permAtk`, set `permAtk = 1200` and `permDef = 800` on the slot. This mirrors `rules.ts:982-985`, which is the reducer's stated job.
   - Why it is required: `applyEvent` ignores `activate`/`monsterEffect` (`project.ts:115`) and `statChange` (`project.ts:132`), and nothing sets `permAtk`. After every top-level event, `Director.syncFrontier` (`Director.ts:170-176`) syncs the projected snapshot. Today that snapshot says "no permAtk": `FieldView.sync` would call `setStats(1100)` (the badge rolls back after our stat beat), `slotVariant` would be null for the whole batch, and `stateDiff` would log "projection drift" on every growth.
   - With the fix, the frontier sync after our hook re-asserts the grown look and 2300. The upgrade-only rule in `setUnitVariant` becomes a safety net.
6. **One sweep over the call sites that still read baby pixels by card id** (ask the orchestrator to swap them all in one pass to `unitFrame(u, anim, f)`; each swap is byte-identical for every other unit):

   | Call site | When it matters |
   |---|---|
   | `src/cinematics/strikes-a/_kit.ts:232,235` `currentPixels` | lane-A strikes that overlay the TARGET's current pixels (freeze, cool, crack) |
   | `src/cinematics/strikes-b/_kit.ts:164,188,213` `framePixelsOf`, `glintPoint`, `worldBox` | lanes B and C use them on targets |
   | `src/cinematics/traps/_chains.ts:364,400` | Işık Zincirleri binding a grown attacker |
   | `src/vfx/shatter.ts:105,116,136` (+ the P2 test at 138 / 484 by `monsterP2TextureKey`) | any kit death that shatters a grown unit (lane D's, a spell's). Its cache key is `shatter:<id>:…`; it needs a variant suffix |
   | `src/cinematics/_v3/death.ts:110` `bodyPixels`, `breakBody` | the kit death; our own death never calls it (§5.5), but `sourceOwnsDeath` hands some deaths to other code |
   | `src/duel/warm.ts:82-92` | warms the baby shatter only; harmless, a grown unit's shatter is made on use (~0.3 ms) |
   | `src/view/light/glow.ts:98`, `LightLayer.ts:856,1009` | halo sheet / pool radius from baby idle 0. Phase 1: no emissive (§1.5); the pool is a little small for the grown body |
   | `src/cinematics/_v3/summon.ts:69`, `_v3/card.ts:201`, `duel/auras-v3.ts:277` | summons are always baby; auras are rare (equip on a grown unit) |

   Until the sweep lands, these are films that must be checked: `kaChGrownChains`, `kaChGrownEquip`, and the `venom_drake` / `ashen_drake` strikes on a grown target (§8.5).
7. **The cross-lane rewind contract (lane D, through the orchestrator).** Lane D's "bildi / bilemedi" rewinds every destroyed monster by playing its own summon in reverse (YENI C2 §4–5). An opponent's jester win destroys OUR grown hatchling, and a grown unit's `u.art` has no `summon`. The contract: lane D calls `rewindAnims(u.cardId, variantOf(u))` and plays the steps in order with `UnitSprite.setFrame` (step 3 makes baby-only frames valid on a grown unit):
   - no variant: `[{ anim: 'summon', reverse: true }]` (today's behaviour);
   - `grown`: `[{ anim: 'special', reverse: true }, { anim: 'summon', reverse: true }]`. The special reversed is the un-aging: grown → baby. Its f15 = grown idle f0, so the first frame does not pop. Then the baby folds back into the egg.
   - An optional sound hint in the same contract: `rewindSfx(id, variant)` returns `'hatchVoiceCrackRev'` for a grown hatchling (§6.2: the roar climbing back up into a squeak). Lane D plays it if it wants a per-victim voice; nothing breaks if it does not.
8. **The growth cinematic** calls `setUnitVariant(u, 'grown')` itself, at the special's last frame (§5.6).

### 3.4 Files
| File | Role |
|---|---|
| `src/art/monsters-v3/cloud_hatchling.ts` | default export: the baby `MonsterArt` (`toMonsterArt(HATCH_ANIMS, babyShell)`), `weight: 'mediumLight'`, `p2: 'relight'`, consts `W = 84, H = 78, AX = 40, GY = 74`, the `DISTINCTION` block, re-exports for card art / cinematics (`HATCH_MOUTH`, `framePose`) |
| `src/art/monsters-v3/cloud_hatchling-rig.ts` | skeleton + `drawHatch(p, pose, light, at, age)`: the shared draw for both shells (body, head, cheeks, limbs IK to the fixed feet `ik2`, tail chain `chain`, wings, eyes) |
| `src/art/monsters-v3/cloud_hatchling-parts.ts` | hand pieces: eggshell plates `_L` / `_R`, the zigzag rim, the shell `CrackStyle` + crack lists (summon wobble cracks, death knit lines), cloud lobe primitive (`cloudLobes(r, cx, cy, n, phase)`), horn spiral bands, the grown waist ring (`ringPuffs(phase)`: the 12 puff centres, back / front halves; exported so the growth's falling hour-puffs land on exactly these pixels), the tiny hiccup ring |
| `src/art/monsters-v3/cloud_hatchling-anims.ts` | `definePose` kit, every `LoopDef` / `AnimDef` (§4), `compileAnims` → `HATCH_ANIMS`, `points()`, `joints()` (sameness) |
| `src/art/monsters-v3/cloud_hatchling-grown.ts` | **named export only** `cloudHatchlingGrown` (no default: the registry glob skips modules without `default.id`). It is `toMonsterArt(HATCH_ANIMS, grownShell)` with `extraAnims` minus `summon` / `revive` / `special`, `weight: 'mediumHeavy'`, plus `registerMonsterVariant(...)` |
| `src/art/monsters-v3/_cloud_hatchling_grown.ts` | `export default cloudHatchlingGrown`: for `monster-sheet --art` / `sameness --art` only (the `!_*.ts` glob keeps it out of the registry) |
| `src/art/variants.ts` | the variant registry + `rewindAnims` / `rewindSfx` contract (§3.3) |
| `src/duel/unit-variant.ts` | `variantOf`, `setUnitVariant`, `unitFrame`, the `MonsterUnit.sheetFor` install (§3.3) |
| `src/art/materials/defs/hatchhide.ts` | MaterialDef `hatchhide` (status draft, firstUser `cloud_hatchling`): leaf ramp (§1.3), `rim: PAL.water4`, `texture: { kind: 'scales', density: 4 }` (on mid / shadow only), `hit.sparks [mist, white, leaf4]`, `death { shatter: 'plant', accent: 'light' }` (unused by our own death; it keeps the tables honest), `sound: { same: 'cloth' }` (phase 1, §6.5) |
| `src/art/cardart-v3/cloud_hatchling.ts` | card art (§7) |
| `src/presentation/cards/cloud_hatchling.ts` | the recipe (§8.2) |
| `src/cinematics/strikes-a/cloud_hatchling.ts` | `registerStrike` (Hıçkırık Halkası, all outcomes, baby / grown) + `registerCardHook('destroyed')` (egg float) |
| `src/cinematics/strikes-a/cloud_hatchling-grow.ts` | `registerCardHook('effect')` (the growth) + `registerObserver` (warm the grown sheet when a coin call opens; the look-up reaction on `coinToss`, §5.6) |
| `src/cinematics/strikes-a/cloud_hatchling-fx.ts` | drawing helpers (no top-level registration): `windRing` (hand-tabled sizes), `ringShards`, `dustDashes`, `cloudPuff`, `eggFloat`, `eggScatter` (the float's final break-up from `unitFrame(u, 'death', 9)`), `skyDial` (puff rim, wind-streak hands, falling hour-puffs), `spiralMotes` |
| `src/cinematics/summon-a/cloud_hatchling.ts` | `signatureSummon('cloud_hatchling', …, { v3: eggDropV3 })` |
| `src/audio/v3/hatchling.ts` | `V3_HATCH_RECIPES`, `HatchSfxName`, `HATCH_SUSTAINED` (§6) |
| `src/duel/scenarios/kart_a_cloud_hatchling.ts` | filming scenarios (§8.5) |
| `src/dev/previews/hatchling.ts` | `?dev=hatchling[&mode=sheet\|board\|swap\|rewind][&p2=1]`: both forms side by side; `swap` plays special → `setUnitVariant` → idle on a live unit; `rewind` plays `rewindAnims` on a grown unit (the lane-D contract) |
| `tests/art/cloud_hatchling.test.ts`, `tests/art/variants.test.ts` | §9.4 |

---

## 4. Animations

Every one-shot ends on idle f0 (guard f0 for toGuard). `compileAnims` appends that end frame to EVERY one-shot whose `end !== 'hold'` (`rigkit/anim.ts:172,190`), and its hold is `endMs` (default: the last beat's hold). `death` and `special` are `end: 'hold'`, so nothing is appended to them.
- **Every frame count below includes the appended end frame** ("beats + end").
- Holds are 40–200 ms (HA-2). The release is ≤ 70 ms. The longest wind-up frame comes right before the swing (HA-3), and recoveries lengthen.
- The reactions set `endMs` 70–80, so the hit family stays inside the REHBER §4.9 references (hit 0.50–0.59 s, hitHeavy ≈ 0.68–0.74 s, hitMagic ≈ 0.61–0.66 s).
- Totals: **baby 131 frames** (≤ 140, KK-13): 84 × 78 × 4 × 131 = **3.43 MB per side**. **Grown 90 frames** (no summon / revive / special): **2.36 MB per side**.
- Gate class: `--class medium` (3.6 MB), justified by the 64 spill (YENI C3). Four sheets in total ≈ 11.6 MB (well under the 64 MB pair cap).
- Tier: **normal** (REHBER §4.9). Every count meets or exceeds the normal column.

| Anim | Frames (beats + end) | ms (incl. end) | Marks | Grown form (same holds) |
|---|---|---|---|---|
| idle (loop) | 18 (loop) | 1890 | — | ring orbit, snort |
| guard (loop) | 8 (loop) | 1200 | — | ring wall |
| toGuard / fromGuard | 4 + 1 / 4 + 1 | 370 / 370 | — | |
| attack | 13 + 1 | 1240 | charge 1, release 8, recover 10 | stomps, big ring |
| roar | 9 + 1 | 1090 | charge 1, release 4, recover 6 | full roar |
| hit | 5 + 1 | 500 | impact = contact 0, recover 3 | |
| hitHeavy | 6 + 1 | 610 | impact = contact 0, recover 4 | |
| hitMagic | 6 + 1 | 590 | impact = contact 0, recover 4 | |
| summon | 13 + 1 | 1390 | land 2 | — (baby only) |
| death | 10 (hold) | 850 | impact = contact 0, dissolve 4 | big egg |
| revive | 10 + 1 | 1110 | land 5 | — (baby only) |
| special (growth) | 16 (hold) | 1760 | charge 1, release 6, impact 13, recover 15 | — (baby only; it draws the growth) |
| victory | — | — | — | not drawn (nothing plays it, REHBER §10.4) |
| **total** | **131** (grown 90) | | | |

### 4.1 idle: 18 f, 1890 ms (YENI: 18 f; wobble, shell taps, flap attempts, hiccup ≈ every 3 s)
Holds: `130 120 110 110 120 90 80 80 90 140 70 120 110 70 60 90 120 130` (1890 ms, inside the REHBER normal 1.6–2.0 s). It lingers at the ends of the sway; the blink and hiccup frames are short.
- **Sway (body, period 18):** weeble lean right f0–f4, centre f5–f8, left f9–f12, back to centre f13–f17. The head lean is ±2 px, the hips stay put. The feet are fixed (HA-9).
- **Followers (HA-6):** the head is +1 frame behind the body, the cowlick +2, the chest tuft +2, the far wing nub +1 behind the near one.
- **Tail tap (period 9):** the shell knocks the floor on f2 and f11, each with a 1-frame 1-px rebound.
- **Flap attempt (once per loop):** three quick nub flaps f5–f7 (each 1 px up), then the nubs droop on f8.
- **Blink:** f10 (1 frame, 70 ms).
- **Hiccup:** f13 is the jolt (whole body 1 px up, eyes wide). On f14 a tiny wind ring (3×5, `mist` rim + `white` lead, light pixels) leaves the mouth. On f15–f16 it drifts 2 + 2 px forward and pops (1 px dots).
- **Grown, same frames:**
  - the sway becomes a slow weight shift of the chest;
  - the tail tap becomes a heavy tail thump (f2, f11);
  - the flaps become one wing stretch over f5–f8;
  - the hiccup becomes a nostril snort with a ring (f13–f16, 5×9);
  - the **cloud ring advances 1/24 turn per frame** (18 frames = 3/4 turn = 9 puff spacings, so the loop wraps exactly, HA-7). The 12 puffs are identical, so the ring's pixels repeat every 2 frames: any idle phase differs from f0 by at most one half-step of the ring (HA-21 phase gate). One-shots move the ring only in whole-puff steps (1/12 turn), or not at all. The mane drifts with a +2 lag.
- **Sheet checks:** HA-18 ≥ 15 % (target ≈ 18 %); HA-17 ≤ 1.8 (the hiccup jolt is a 1-px whole-body shift, so keep it to ONE frame); seam ≤ 1.4; IŞ-10 noise idle mean ≤ 10 % (the cloud lobes are the risk, keep them ≥ 2×2).

### 4.2 guard: 8 f, 1200 ms
Holds: `170 150 140 150 170 150 130 140`. Each frame moves ONE part, in this cycle: breath (chest 1 px) → the peeking eye blinks → the tail shell shifts 1 px → the nubs twitch → back.
- Baby: crouched low, nubs over the face, one eye peeking between them, the tail curled in front with the shell held like a tiny shield.
- Grown: wings wrapped around the body. The cloud ring rises from the waist to the shoulders and thickens into a puff wall (two puff rows); the head peeks over it. Guard Δ / idleΔ target 0.45 (HA-19 0.3–0.8).

### 4.3 toGuard / fromGuard: 4 beats + end each, 370 ms (holds `60 70 80 90`, `endMs` 70)
- toGuard: duck → nubs come up (in-between at the half lift, HA-13) → tail swings in front → shell set → (end) guard f0.
- fromGuard is the reverse, ending on idle f0.
- Feet fixed, `dx = 0`. HA-20 will probably trigger (the guard differs a lot from idle), so the transitions are mandatory.

### 4.4 attack "Hıçkırık Halkası": 13 beats + end, 1240 ms (1140 + `endMs` 100)
| f | ms | Beat | Pose (baby) | Pose (grown) |
|---|---|---|---|---|
| 0 | 80 | — | leans toward the target, eyes on it | head lowers, eyes narrow |
| 1 | 90 | **charge** | cheeks puffed big (the declaration holds THIS frame: `declarePoseFrame`), chest up | chest swells, mane bristles |
| 2 | 70 | — | hop 1 up (4 px lift in pose, feet tucked) | stomp 1: near foot up |
| 3 | 60 | — | hop 1 land, squash | stomp 1 down (1-px squash) |
| 4 | 70 | — | hop 2 up | stomp 2: far foot up |
| 5 | 60 | — | hop 2 land | stomp 2 down |
| 6 | **160** | — | "ha… ha…": head thrown back, eyes squeezed, nostrils flare (the longest wind-up frame, HA-3) | head back, the jaw opening, the ring's air visible at the lips |
| 7 | 50 | swing | head snaps forward (no smear) | |
| 8 | 60 | **release** | "CHOO!": mouth wide, the ring leaves `muzzle`; 2-px smear behind the head (HA-12) | |
| 9 | 80 | follow | blown back by its own sneeze, sits on its tail ("plop") | rocks back on its haunches |
| 10 | 100 | **recover** | dazed: swirl eyes, cowlick bounced | shakes its head |
| 11 | 120 | — | shakes its head, nose twitch | settles the wings |
| 12 | 140 | — | gets up | breath |
| end | 100 | — | idle f0 | |

- charge → release = 560 ms. That is near the slice's 460–500; the hops are in it, which is the comic point.
- In-pose motion only (HA-11). The forward travel of the hops is the cinematic's, in whole px (§5.2).

### 4.5 roar: 9 beats + end, 1090 ms ("Cıyak": the baby's squeak; used by the position change / generic beats)
- Holds: `80 120 110 160 90 120 100 110 120`, `endMs` 80; charge 1, release 4, recover 6.
- Baby: inhale, wing nubs up → on tiptoe with nubs spread (f3, 160) → beak-wide squeak with a tiny air puff (f4) → loses its balance, wobbles (f6–f8) → settles.
- Grown: rears up, wings half-spread, roar with the jaw open, the ring flaring outward 2 px on f4–f5.

### 4.6 hit (5 + end), hitHeavy (6 + end), hitMagic (6 + end); `endMs` 80 on all three
- **hit:** holds `50 60 80 100 130` + end 80 = 500 ms (reference 0.50–0.59 s). f0: the head snaps back, eyes squeezed. Only the head and chest move (HA-21 < 50 %, target ≈ 38 %). f1 is the in-between (HA-22). The cowlick flips +1 frame late.
- **hitHeavy:** holds `50 60 80 100 110 130` + end 80 = 610 ms.
  - Baby: knocked onto its bottom, rolls back half a turn in pose (the feet leave the floor, HA-9 allows it while airborne), rocks up.
  - Grown: a step back, its knees take the load, a step forward.
  - `knock: 'pose'`, `poseKnockPx [1, 2, 3]`.
- **hitMagic:** holds `50 50 70 90 110 140` + end 80 = 590 ms. Static: every cloud lobe stands on end (the tuft, the cowlick), the eyes go white, the body goes stiff with a 1-px tremble (wings 1 frame late), then the fluff falls flat.
- All three exist in both forms.

### 4.7 summon: 13 beats + end, 1390 ms (`land` 2), baby only, `hologram: false`
Holds: `70 70 80 150 150 150 80 60 70 80 130 110 110`, `endMs` 80 (HA-2 ≤ 200; the wobbles were 200 each, cut to 150 for the budget, §5.1).
| f | Pose |
|---|---|
| 0, 1 | the egg alone (11×14, shell plates + speckles), tilted L / R: it is falling; the cinematic moves the sprite down during these two frames |
| 2 | **land**: egg squash (in pose, 1 px wider, 1 px lower) |
| 3, 4, 5 | three wobbles L / R / L, each with a crack that grows (`cracksOn` with the shell `CrackStyle`, `progress` 0.3 / 0.6 / 0.9; lit lip `skin4`, dark `earth2`) |
| 6 | tremble (1 px), the top plate lifts 1 px |
| 7 | **burst**: the top shell pops up 6 px, side shards fly out (in-frame, 3 shards), the curled baby shows in the bottom half |
| 8, 9 | somersault out (tumble 0.5 / 1: a ball rolling forward, then upside-down with feet up) |
| 10 | it sits up; the top shell lands on its head (helmet on the head) |
| 11 | blink while the shell slides down its back (the two merged into one frame) |
| 12 | the shell lands on the tail tip ("kuyruğuna kayar"); shake out: the cowlick and tuft puff up |
| end | idle f0 |

### 4.8 death: 10 f, 850 ms (`impact` = `contact` 0, `dissolve` 4)
Holds: `50 60 80 90 90 90 90 90 100 110`.
| f | Pose |
|---|---|
| 0 | struck (continues hit f0 / hitHeavy f0 / hitMagic f0 per `posematch`) |
| 1 | recoil |
| 2 | tumbles back |
| 3 | curls into a ball (the tail wraps, the head tucks) |
| 4 | **dissolve**: the ball rocks; shell plates rise from the floor around it and the knit lines start (`knit` 0.25: 1-px `mist` stitch lines between the plates) |
| 5 | knit 0.5 |
| 6 | knit 0.75 |
| 7 | the egg closes |
| 8 | the seams vanish and the shell rim glint shows (the anim's one glint) |
| 9 | the egg lifts 1 px (it is the lift-off anticipation): this is the last frame the sprite shows |

- Grown: the big dragon curls into a ball and the shell knits a BIG egg (≈ 22×28). The cloud ring flattens into the cloud under it on f7–f9.
- The last frame is low and compact (HA-27).

### 4.9 revive: 10 beats + end, 1110 ms (`land` 5), the death reversed (HA-28), built for `recallV3`
`recallV3` (`src/cinematics/spells/soul_recall.ts:1145`) consumes the summon event itself (line 1149): our summon hook never sees `from: 'graveyard'`. Its cyan ghost (`setpieces.ghostTexture`, made from baby idle frames) glides to the tile and "breaks into the body" on revive f0, then the art's revive pose plays. So revive f0 must be a shape the idle-shaped ghost can melt into.
- Holds: `100 90 90 90 100 80 120 110 120 130`, `endMs` 80.
- f0 **bridge**: the curled ball (the ghost's mass collapses into it), with the egg's shell plates lying loose around it, seams showing (the death's f6, "knit 0.75", unpicked).
- f1–f3: the knit lines unstitch in the REVERSE of the death's order, the plates fall open outward, one per frame (each with a 1-px `skin4` glint on its lit edge; one glint per anim, IŞ-8: only f2's is white).
- f4: the ball uncurls halfway (the head peeks out).
- f5 **land**: the feet come down, the plates lie flat on the floor.
- f6: first breath (chest up 1 px).
- f7: a tiny sneeze (no ring).
- f8: the shell plates hop onto the tail tip as the helmet (the one plate that survives; the rest have blinked out in-frame on f6–f7).
- f9: shake out → (end) idle f0.
- A later `land` shortens recallV3's glide (`REVIVE_LAND_REF`, line 67–75), so the revive stays ≤ 2.1 s scene. Only `reviveGather` and `reviveLand` (§6.4) reach this card from recallV3.

### 4.10 special "Büyüme" (the growth): 16 f, 1760 ms, `end: 'hold'` (ends on the GROWN idle f0)
Holds: `90 120 110 100 100 160 | 85 85 120 85 85 120 | 80 180 110 130`. The six growth frames get 85 ms each (≈ 115 ms game) and the two big changes, f8 (the neck) and f11 (the mane and the ring), get 120 ms, so the growth reads as six steps at 1×, never a pop. The time comes from f12 and f14.
| f | `grow` | Pose |
|---|---|---|
| 0 | 0 | startled: eyes wide, cowlick up, looks up at the dial |
| 1 | 0 | **charge**: stares, mouth open |
| 2 | 0 | a hiccup shudder |
| 3, 4 | 0 | tremble L / R (1 px) |
| 5 | 0 | hunched, every cloud lobe bristling (the longest hold) |
| 6–11 | ⅙ … 1 | **the six growth frames** (**release** = 6), one part each: f6 the body swells, f7 the legs lengthen, f8 the neck extends (S), f9 the horns sprout and curl, f10 the wings unfurl from the nubs, f11 the mane bursts out of the cowlick + the waist ring is complete. The sprite frames f6–f10 have NO ring: its puffs arrive as the cinematic's falling hour-puffs (§5.6), and f11's baked ring sits on exactly their pixels (`ringPuffs(0)`) |
| 12 | 1 | head rises (roar charge) |
| 13 | 1 | **impact**: the ROAR peak, jaw wide, wings spread |
| 14 | 1 | roar hold |
| 15 | 1 | **recover**: settles to **exactly** the grown idle f0 pose |

- Gate exception (record it in the art file and the critique notes): out(special) is measured against the BABY idle f0 and is large by design.
- Replacement rule: **Δ(baby special f15, grown idle f0) = 0 pixels**, P1 and P2 (a unit test).
- HA-13: every growth frame is a real in-between of `grow`. No frame may copy its neighbour.

### 4.11 points() (HA-25) and joints()
| Point | Where | Used by |
|---|---|---|
| `muzzle` | the mouth centre (baby ≈ (52, 53) at rest, the release frame at the lips; grown at the snout tip) | the ring's spawn on `release`, the hiccup ring, the roar's air blast |
| `core` | the belly centre | hit sparks, the dial centre, the stat beat, the egg centre in death |
| `head` | the crown (baby: the cowlick root) | stat number placement, the startle "!"-free reaction (no text: the look is in the pose) |
| `feet` | the anchor (40, 74) | floor marks, dust, the cloud under the egg |
| `grip` | the tail-shell tip | the eggshell glint, the summon's shell slide, the death knit's first plate |

- `joints()`: `head`, `hips`, `tail`, `footN`, `footF`, `wingN` (sameness MOT traces, the hit kit's hip travel).
- The grown shell returns its own points and joints. They reach the cinematics via the swapped `u.art`.

---

## 5. Cinematic storyboards

All times are **scene ms** (code durations). Game time ≈ ×1.35 (the hit-stop ≈ ×1.55). Measured limit = REHBER §5 × 1.45 (TEMPO.md).
- The light layer is stepped only (EF-6): `lightPool` / `lightFlash` / `lightDim` from `src/view/light` (re-exported by `summon-a/_kit.ts`).
- No zoom and no new camera moves (EF-8). Shake is whole px through the existing `shake`.
- No `setScale` / `setAngle` on sprites. Raster FX are drawn at integer px (EF-7). At most one ring per effect (EF-7): the wind ring IS the one ring.

### 5.1 Summon "Bulut Yumurtası" (normal summon): target ≈ 2.0 s scene / ≈ 2.8 s game, limit ≤ 3.34 s game
`signatureSummon` → `runSummon` (`summon-a/_kit.ts:620`): the hand card is taken and slammed (`fx.slamToZone`, 340 ms, **awaited**, line 643), then the hidden unit is added, then our `eggDropV3(S)` runs (only when `unit.has('summon')`; `ev.from === 'field'` falls back to `ctx.base()`).
- **The cloud is off the critical path.** An observer in `summon-a/cloud_hatchling.ts` (`registerObserver`, inside `if (LOOK_V3)`) sees the `summon` event of a `cloud_hatchling` from the hand at its START (observers run before the chain, `Director.ts:206`) and starts the cloud drifting in at once, during the hand take and the slam. The handle is stored per uid; `eggDropV3` picks it up (if it is missing, e.g. `?test` replay, `eggDropV3` spawns the cloud already in place).
- `eggDropV3` then only has the sag, the fall and the hatch. Times below are from `eggDropV3`'s start (= the slam's end).

| ms | Picture | Light / floor | Sound |
|---|---|---|---|
| −340 … 0 (during the slam) | A small cloud (raster: 3 lobes 22×10, `white` top, `mist` body, `steel` belly, 1-px `night4` underside line) **drifts in level from the upper left** (no dive: the dive is `storm_hawk`'s, YENI §5) and stops 46 px above the tile, 200 ms of travel | `lightDim` under the cloud (1 step darker, an ellipse 26×8), following it | `hatchCloudDrift` (from the observer) |
| 0–60 | The cloud sags (its lobes compress 1 px) and lets go: summon f0 (the egg) appears under it | — | — |
| 60–200 | The egg falls (f0 / f1, 70 + 70, Quad.In, whole px) | the dim pool shrinks | `hatchEggDrop` (a falling whistle) |
| 200 | **land** (f2): 1-px shake, 6 dust dashes (2-px) pushed out in a crescent | a stepped `leaf4` pool, 1 step, 160 ms | `hatchEggLand` |
| 280–730 | Three wobbles (f3–f5, 150 ms each), the crack growing; the cloud above bobs ±1 px in time | — | `hatchCrack` × 3 (pitch 1 / 1.12 / 1.26) on each wobble frame |
| 730 | Tremble (f6) | — | — |
| 810 | **Burst** (f7): the top shell pops; 5 raster shell shards (2–3 px plates in shell tones) fly out and lie 500 ms on the floor, then blink out in steps | `lightFlash` `skin4` on the tile, 100 ms, core 2 steps | `hatchShellBurst` |
| 870–1020 | Somersault out (f8 / f9) | — | — |
| 1020 | Sits; the shell lands on its head (f10) | — | `hatchCheep` (the first squeak) |
| 1020–1370 | The cloud above breaks into 4 puffs that fly down into the baby's chest (each puff ≤ 4×3, stepped `mist` → `white`), merging as the chest tuft on f12 | — | `hatchHiccup` on f12 |
| 1150–1370 | Blink + the shell slides to the tail (f11), shake-out (f12) | — | — |
| 1450 | idle f0, the badge pops | — | — |

- Total ≈ hand take + 340 + 1450 ≈ 2.0 s scene ≈ 2.8 s game. **Measure `kaChSummon` first** (the hand take varies); if it is over 3.2 s game, cut the wobbles to 130 ms.
- The body is real from the first frame (no hologram, EF-11).
- P2 is mirrored (the cloud enters from the upper right).
- A revive never comes here: `recallV3` consumes the summon event (§4.9, §5.7).

### 5.2 Attack vs a monster (it wins): budget 1.6–2.2 s scene incl. the target's death → ≤ 3.19 s game
`registerStrike('cloud_hatchling', hatchRingV3)`. `const grown = variantOf(s.attacker) === 'grown'`. Baby values first, grown values in [ ].
| ms (from strike start; declaration ≈ 233 before) | Picture | Light / floor | Sound |
|---|---|---|---|
| 0 | The declaration held f1 (cheeks puffed). The strike plays on from f1 | — | `takeCharge(u, …)`: the declaration's `holdCharge` already started the right inhale (`hatchInhale` [`hatchGrownInhale`]) through `soundsOfUnit(u)` (§6.4, a ship requirement) |
| 90–350 | Hops f2–f5: the sprite moves **8 px** [6 px] toward the target on each "up" frame, whole px, only while the hop pose plays (HA-11) | 2 dust dashes per landing | `hatchHop` ×2 [`hatchGrownStomp` ×2 + 1-px shake each] |
| 350–510 | "ha…" f6 (160 ms), the stillest frame | — | — |
| 560 | **release** f8: the ring is born at `muzzle` | a stepped `mist` pool under the muzzle, 1 step | charge `stop(40)`; `hatchSneeze` [`hatchGrownSneeze`] + `start('hatchRingWhistle')` [`hatchGrownWhistle`] |
| 560–800 | **The ring flies** (240 ms, `Sine.In` then constant): a hollow ring whose plane is perpendicular to the (mostly screen-x) travel. In this view such a ring is seen nearly edge-on, and the iso tilt opens it to an **apparent aspect of w : h = 1 : 2**. It grows through four **hand-tabled** ellipses (not rasterised at runtime), one step per 60 ms: baby 6×12 → 8×16 → 10×20 → 12×24 [grown 10×20 → 14×28 → 16×32 → 20×40]. The 2-px band holds two tones only: a `white` lead pixel row on the outer edge, `mist` inside it. A 1-px `steel` partial arc rides only the trailing back half (the half that will sit behind the target's depth). Three 1-px whistle streaks trail 6–10 px behind it and flicker | a `mist` floor pool travels under the ring (stepped, 1 step); dust dashes are pushed outward under its path ("it lays the grass flat") | the whistle rises (its pitch is in the recipe) |
| 800 | **Contact** = `s.impact(at core)`: the ring is 1 frame around the target's torso (back half with its `steel` arc behind the target's depth, front half in front), then **squeezes** (12×24 → 10×20 → 8×16, the same hand table run backward, over 2 frames) | — | `hatchRingSqueeze` 50 ms before contact; on contact `hatchRingTing` [`hatchGrownRingBoom`]; the target's material hit by the kit |
| 800 + hit-stop | hit-stop 60 [100] ms (attacker class), shake 1 px [3 px]; the kit's contact flash on the target (EF-3) | `lightFlash` `mist` on the target tile 120 ms | — |
| 860 | **Snap**: the ring breaks into 8 arc shards (1-px arcs 3–5 px long) flying outward on the iso plane, blinking out over 180 ms | — | — |
| 860–1300 | The attacker plays follow / recover f9–f12 (it plops on its tail) and **hops home** in two whole-px hops during f11–f12 | — | `hatchPlop` on f9 |
| ~1950–2150 | The target's death (its own kit) runs in parallel (SÜ-2); input returns | — | — |

- Contact is ≈ 233 + 800 = 1030 ms after the declaration. With a ≈ 1.1 s target death that gives ≈ 2.15 s scene. **Measure it.** If it is over, shorten the flight to 200 ms and the hops to 7 px.
- `s.power` 3 (a big margin): baby shake 2 px, an extra ring of dust dashes.

### 5.3 Direct attack: ~1.6 s scene → ≤ 2.32 s game
- Same as §5.2 up to the release. The ring flies to `s.to` (the duelist point) over 260 ms, rising 10 px along an arc. It squeezes nothing: it breaks ("tıng") into the 8 arcs above the opponent's podium, with a gust of dust at `s.toGround`.
- The kit's direct-hit LP number comes from `s.impact(at)`.
- The hatchling's recovery overlaps the LP flow.
- Grown: one bigger ring, the "BOOM-tıng", shake 3.

### 5.4 Blocked and losing
- **Blocked** (DEF ≥ ATK, the defender survives in guard):
  - the ring squeezes but cannot close: it stalls 2 frames, then **rebounds** back along its path, shrinking (12×24 → 6×10);
  - it bonks the hatchling's face: the attacker plays `hit` (light), then sits on its tail;
  - the battle damage number is the kit's;
  - sounds: `hatchRingRebound` at the stall, the bonk inside it;
  - recipe `attack.blocked: 'rebound'`.
- **Losing** (the attacker is destroyed):
  - the ring fizzles on contact ("pıt": it pops into 4 dots, no squeeze), with `hatchRingFizzle`;
  - the target's counter is the kit's backlash along the attack line (`src/cinematics/_v3/clash.ts` backlash, EF-13);
  - the hatchling takes hitHeavy, and our death (§5.5) follows from its continuing frame (`posematch`).
- **Tie:** the snap + the backlash; both die.

### 5.5 Death "Yumurtaya Dönüş": ≈ 1.15 s scene (limit ≤ 1.4 s) → ≤ 2.03 s game. Final material (YENI §5.2 C3): knitted back into its egg, floats away on a cloud
`registerCardHook('cloud_hatchling', 'destroyed', hatchDeathV3)`:
- Non-monster destroys and `sourceOwnsDeath(ctx)` (`src/cinematics/strikes-b/_kit.ts:383`) → `ctx.base()`. This lets lane D's coin wipe ("geri sarılma") and any card that registers a `destroys` hook own the death.
- The body is built from exported pieces only, so `_v3/death.ts` is not edited:
  - `takePlannedEntry` / `deathStartFrom` (`_v3/posematch.ts`);
  - `planGuardBreak` / `runGuardBreak` / `showsGuard` (`_v3/guardbreak.ts`): the death from guard breaks open, it never stands up;
  - `contactFlash` (`_v3/flash.ts`);
  - `cardLeaves` + `behindBodies` (`_v3/card.ts`);
  - `atFrame` / `play` (`_v3/sound.ts`).
- The toGraveyard event is consumed as in `deathV3`: `ctx.findType('toGraveyard', …)` + `ctx.consumeAt`.
- **It never calls `shatter`**: its cache key is the card id (`shatter:<id>:…`) and it detects P2 by `monsterP2TextureKey` (`vfx/shatter.ts:138`), so it would paint baby pixels lit the wrong way on a grown or P2-grown body.

| ms | Picture | Light | Sound |
|---|---|---|---|
| 0 | death f0 (contact flash if `hints.hit`) | — | the blow's own |
| 60 | f1 recoil | — | `hatchCurl` (deathStart) |
| 200–380 | curl into a ball (f2–f3) | — | — |
| 290 | **dissolve** f4: plates rise, knit lines start | a stepped `skin4` pool, 1 step, grows with the knit | `hatchKnit` (dissolve) |
| 380–650 | knit f5–f7; the egg closes | — | `hatchLullaby` on f7 (afterDissolve +3) |
| 650–850 | seams vanish (f8), lift-off frame (f9) | — | — |
| 850 | **Lift-off = the burst frame**: a cloud (raster, as in the summon, 22×10 [30×12 grown]) forms under the egg out of 4 puffs; the card is born on the tile now (`cardLeaves`, EF-12: 2 frames 1-px white frame + 1 frame owner tone, then a 200–360 ms arc to the graveyard) | the pool starts to step down | `hatchFloat` (burst) |
| 850–1150 | The egg rides the cloud **up 14 px** in whole-px steps with a 1-px bob every 90 ms (300 ms). The sprite is held on death f9 and moved; the cloud's lobes cycle, so the picture is moving (HA-11) | `lightDim` cloud shadow on the floor, shrinking | — |
| 1050–1150 | The last 100 ms of the float: the pixel break-up (YENI §5), our own `eggScatter` in `cloud_hatchling-fx.ts`. It reads `unitFrame(u, 'death', 9)` (the grown art and the P2 relight when the unit is grown / on P2's sheet), hides the sprite, and scatters its pixels as whole-px 2×2 clusters drifting upward with the cloud's puffs; each cluster blinks out on a stepped schedule (no alpha fades). Then `retire` | — | — |

- Total ≈ 1150 ms scene: 250 ms of margin under the 1.4 s limit.
- Death from guard: `runGuardBreak` opens the guard into death f0, then the same flow.
- Spell destroys (`judgment_bolt`) take the same flow, with `hit: false` → no flash.

### 5.6 The signature moment: the growth (`effect`, ≈ 2.45 s scene ≈ 3.3 s game; limit ≤ 4.06 s game)
**Sequencing (read in code and confirmed by running the engine).** `callCoin` win (`rules.ts:977-987`) emits, in order:
`coinToss → massDestroy → destroy / toGraveyard (× opponents) → activate{kind:'monsterEffect', uid: hatchling} (× each) → statChange (× each, from `withStats`)`.
- The Director runs them one by one (`Director.playBatch`): our hook starts only when lane D's coinToss / massDestroy / destroy handlers have resolved.
- `hookKeys` maps `activate` + `monsterEffect` → card hook `effect` (`Director.ts:421`). At priority 0 it runs before the default `activate` (priority −100).
- After each top-level event the Director syncs the projected frontier (`Director.ts:125, 170-176`). With the `project.ts` precondition (§3.3 step 5), that snapshot carries `permAtk` once our `activate` has run.

**Cause before effect: the look-up (an observer, no dependency on lane D).** `registerObserver` in `cloud_hatchling-grow.ts` sees the `coinToss` event at its start, in parallel with lane D's coin:
- For each face-up `cloud_hatchling` of `ev.player` without `permAtk` (read from `ctx.state`) whose unit is visible, not guarding and not `locked`: at +250 ms it plays the idle hiccup frames (f13–f16; the tiny ring puffs up toward the coin) with `hatchHiccup` at 0.5, then holds **special f0** (startled, eyes wide, cowlick up, looking up at the coin).
- `ev.win === false`: it returns to idle after 600 ms (lane D's rewind takes it next).
- `ev.win === true`: it keeps holding special f0. Our hook starts on that very frame, so the growth opens without a cut. A 6 s safety timeout returns it to idle if the hook never comes.
- It only sets frames on our own unit and draws nothing; it never waits on lane D's timings. A cowlick that stands up on lane D's "BİLDİ" reveal was considered and rejected: it needs lane D's internal reveal time.

`registerCardHook('cloud_hatchling', 'effect', hatchGrowV3, { name: 'strikes-a:cloud_hatchling:grow' })`:
- **Siblings:** collect every later `activate` monsterEffect of a `cloud_hatchling` uid in the same run and `ctx.consumeAt` **only those `activate` events**. Grow them together, staggered 150 ms.
- **The stat beat:** every `statChange` stays UNconsumed. `ctx.play(i)` returns at once for a started event (`Director.ts:322-324`), and `consumeAt` sets exactly that flag, so a consumed statChange would never animate. The hook finds the first one (`ctx.findType('statChange', e => uids.includes(e.uid))`) and calls `ctx.play(firstStatIdx)` on the roar mark. The `statChange` handler (`flow/stats.ts:71-78`) already groups the following consecutive `statChange` events, so one `play` covers `kaChGrowTwo`. The hook awaits that promise together with its own tail before it resolves.
- **Not visible** (`!u || !u.sprite.visible`): `setUnitVariant(u, 'grown')`, then `ctx.play(firstStatIdx)` at once (only if no visible sibling will play it), return.
- **In defense:** `fromGuard` plays DURING the dial build (0–370 ms, in place of the f0 hold), and `toGuard` plays on the grown sheet during the idle tail after the roar. Net cost ≈ +100 ms (≈ 2.55 s scene ≈ 3.45 s game). **Measure `kaChGrowDef` in the first build round.**
- **Every dial beat is driven by `atFrame` / `atMark` on the special** (SE-1), never by absolute ms; the times below are the expected values at 1×.
- **No dependency on lane D:** the dial is our own raster, and the only inputs are our event and the board.

**The sky dial ("the ring is made of years").** A hollow clock face behind the hatchling (depth −1, centred on `core` − 6 px, radius 22, capped for adjacent tiles, R10):
- **Rim:** 12 cloud puffs at the hours (each a 3×3 `white` / `mist` lobe with a `steel` underside pixel). These are the same 12 puffs as the grown waist ring.
- **Ticks:** four 2-px `water4` ticks at 12 / 3 / 6 / 9 inside the rim.
- **Hands:** two wind streaks (long 18 px, short 11 px): a `white` 1-px head with a `mist` trailing streak of the last two positions (the motion blur, in whole px).
- **Gold:** only a 2×1 `gold3` pip just outside the 12 o'clock puff.
- **The years fall:** the long hand makes six revolutions; each one ends exactly on a growth frame (f6 … f11). The short hand advances two hours per revolution, and **the two hour-puffs it has just swept drop off the rim** and fall in whole-px steps (≈ 80 ms) to their slots on the waist ring (`ringPuffs(0)` from `cloud_hatchling-parts.ts`; back-half slots behind the sprite's depth, front-half slots in front). The dial empties as the body grows. On f11 the last two (11 and 12) land, the falling puffs vanish on that very frame, and the sprite's baked ring sits on exactly their pixels.
- This keeps one ring per effect (EF-7): the dial rim IS the waist ring, moving. The motes therefore do not orbit on a closed ellipse: they rise on an **open spiral** (below).

| ms (expected, 1×) | Driven by | Picture | Light / floor | Sound |
|---|---|---|---|---|
| 0 | hook start | special f0 is already held (the observer); `warmMonsterSheet` on the grown key (queued since the coin call) | — | `start('hatchGrowWind')` (circling air) |
| 0–360 | special f0 held 360 ms (`setFrame`; defense: `fromGuard` instead) | **The dial builds**: (1) the 12 puffs pop in clockwise from 12, 25 ms apart; (2) the ticks; (3) the hands, at 12. Hollow: rim + ticks + hands only, so the body stays readable (EF-2) | a `water4` stepped floor pool on the tile, 1 step | each puff a tiny `puff` inside `hatchGrowWind` |
| 360–950 | `playFrom(u, 'special', 1, { hold: true })` (`strikes-a/_kit.ts:200`) | special f1–f5 (stare, hiccup shudder, trembles, the hunch). **Revolution 1**, slow (590 ms, Quad.In). Eight dust motes rise from the floor on an open spiral around the tile (radius 18 → 8, rising 0 → 30 px, whole px), speeding up with the hand | — | — |
| 950 (f6, release) | `atFrame(f6)` | growth frame 1; rev 1 ends; hour-puffs 1–2 fall | `leaf4` floor pulse, 1 step | `hatchGrowFwipA` (pan −0.6) + `hatchGrowCreak` (pitch 1) |
| 1035 (f7) | `atFrame(f7)` | growth 2; rev 2 ends; puffs 3–4 fall | pulse | `hatchGrowFwipB` (pan 0.2, + shell creak) + `hatchGrowCreak` (0.9) |
| 1120 (f8, 120 ms) | `atFrame(f8)` | growth 3 (the neck); rev 3; puffs 5–6; shake 1 px | pulse | `hatchGrowFwipA` (pan 0.6) + `hatchGrowCreak` (0.82) |
| 1240 (f9) | `atFrame(f9)` | growth 4 (horns); rev 4; puffs 7–8 | pulse | `hatchGrowFwipB` (pan −0.2) + `hatchGrowCreak` (0.75) |
| 1325 (f10) | `atFrame(f10)` | growth 5 (wings); rev 5; puffs 9–10 | pulse | `hatchGrowFwipA` (pan −0.6) + `hatchGrowCreak` (0.68) |
| 1410 (f11, 120 ms) | `atFrame(f11)` | growth 6 (mane + the ring complete); both hands reach **12**; puffs 11–12 land; the gold pip flashes `gold4` 1 frame; the hands and ticks blink out in 3 stepped frames ("the dial clicks shut"); shake 2 px | the `water4` pool steps out | `hatchGrowFwipB` (pan 0.2) + `hatchGrowCreak` (0.62) + `hatchGrowChime`; `hatchGrowWind.stop(80)` |
| 1530 | f12 | head rises | — | — |
| 1610 | **`atMark('impact')`** (f13) | **ROAR**: the motes blast outward radially, then blink out; shake 3 px 220 ms | `lightFlash` `white` on the tile 100 ms (EF-4: ≤ 1.5 % white) | **`hatchVoiceCrack`** (the squeak cracks two octaves down into the roar), duck 0.7 |
| 1610 | same mark | `ctx.play(firstStatIdx)`: the generic v3 stat beat (`flow/stats.ts` `statChangeV3`: the rim climb + "2300"), in parallel with the roar | — | its own |
| 1790–2030 | f14–f15 | settle; at the end of f15's hold **`setUnitVariant(u, 'grown')`** (invisible: Δ = 0), then `u.play('idle')` (defense: `toGuard`) | — | — |
| 2030–2450 | grown idle | the waist ring begins its orbit | — | — |
| ≈ 2450 | stat beat + tail resolved | resolve | — | — |

- Expected 2.45 s scene ≈ 3.3 s game (limit 4.06); defense ≈ 3.45 s game. **Measure it at 1× and `&speed=3`** (the marks must stay on their frames).
- **Warm-up:** `registerObserver` on `decision` events with `pending.kind === 'coinCall'`. If the deciding player has a face-up `cloud_hatchling` without `permAtk`, call `ensureVariantSheet` + `warmMonsterSheet` for that unit's side. That gives 3+ s of background painting before the swap. With `?test` the sheet paints synchronously on first use (deterministic films).
- **Permanence afterwards:**
  - the frontier sync right after our hook and every later batch see `permAtk`, so `FieldView.sync` → `setUnitVariant('grown')` on any rebuilt unit, and the plate keeps 2300;
  - a control change re-faces through `setController` → `applyFacing` → `MonsterUnit.sheetFor` (the grown P2 key), and `syncSheet` follows even on a held pose (§3.3 step 3);
  - leaving the field retires the unit. A revive or re-summon is a new slot without `permAtk`, so it is a baby again (correct by the rules: M14).
- **Un-aging (the reverse, owned by lane D's rewind through the §3.3 step 7 contract):** when an opponent's jester wins against a grown hatchling, the rewind plays our special backward (grown → baby; the roar climbs back up into a squeak with `hatchVoiceCrackRev`), then the summon backward (baby → egg). Scenario `kaChGrownRewound`.

### 5.7 Revive (soul_recall), flip, position
- **Revive** (≤ 2.1 s scene → ≤ 3.05 s game): `recallV3` owns the whole spell and consumes the summon event (`soul_recall.ts:1149`); our summon hook never runs for it. The card's part is the art only: recallV3's cyan ghost of baby idle melts into **revive f0, the curled-ball bridge frame** (§4.9), and the revive pose plays (the plates unstitch and fall open, the ball uncurls, `land` on f5). Our sounds reach it only through `CHARACTER_SOUNDS`: `reviveGather` (`hatchReviveGather`) and `reviveLand` (`hatchReviveLand`). Scenario `kaChRevive`.
- **Flip:** the recipe flip (`flip: { accent: 'mist', ramp: 'leaf' }`, priority 10, v3 only).
- **Position:** generic (toGuard / fromGuard). The roar is used where the kit asks for it.

### 5.8 Struck as a defender (surviving) and EF checklist for the critic
- In guard, the kit's guard reaction plays: the shell pushes, guard push 2/3/3 for the baby, 1/1/2 for the grown.
- EF checklist:
  - contact flash ≤ 34/40/45 % in the struck region;
  - no full-screen wash;
  - the white share ≤ 1.5 %;
  - one ring per effect;
  - the silhouette is never covered > 50 % for > 2 frames (the dial is hollow; the ring is 2 px);
  - the number appears on the contact frame;
  - no empty frame between the death and the card;
  - no zoom.

---

## 6. SFX design: `src/audio/v3/hatchling.ts`

Built only from `src/audio/v3/kit.ts` blocks (`thump`, `crack`, `puff`, `sweep`, `glassBell`, `growl`; `glassReverse` is never used: R2's sole identity) and the `Voice` primitives (`tone`, `bell`, `noise`, `filt`, `lfo`, `panner`), like `src/audio/v3/dawn.ts`.

### 6.1 Identity (the YENI §5.1 C3 row, made concrete)
| Pitch / colour | Signature material | Distinguishing layer |
|---|---|---|
| **Key D.** Baby voice D6 (1175 Hz FM chirp). The growth roar cracks to D4 (294 Hz, two octaves) over a D3 growl body (147 ≈ 150 Hz) | eggshell (dry high crack + a short "tok" 420 → 180 Hz) | **the ring whistle:** a tonal sine glide D7 → D8 (2349 → 4699 Hz) with a 6 Hz flutter over a band-passed noise breath rising 2 → 5 kHz, panned along the flight; the grown whistle is one octave lower |

### 6.2 Recipes (`play(v)` bodies; levels pre-chain; `cap` / `gap` / `verb` / `duck` as in `dawn.ts`)
| Name (role) | Recipe |
|---|---|
| `hatchHiccup` | `v.tone('sine', [[0,1175],[0.04,1400,'e']], g perc 0.06/0.05)`; `puff(v,0,0.03,0.03,4000,{kind:'white'})`; whistle `v.tone('sine', [[0.05,3520],[0.17,4699,'e']], g 0.02)` |
| `hatchCloudDrift` (arrive) | `sweep(v,0,0.5,[600,1400,800],0.06,{kind:'pink',q:0.9,pan:[-0.4,0]})`; a pad `v.tone('sine',587)` + `880`, swell 0.35 s, g 0.012 |
| `hatchEggDrop` | `sweep(v,0,0.18,[2400,1500,900],0.07,{kind:'white',q:2,peakAt:0.2})` |
| `hatchEggLand` (land) | `thump(v,0,420,180,0.35,0.09)`; `crack(v,0.004,0.04,{hp:2500,lp:7000})`; `puff(v,0.01,0.05,0.12,1200,{kind:'brown'})` |
| `hatchCrack` (×3, `pitch` from the scene) | `crack(v,0,0.09,{hp:3000,lp:9000,n:2,gap:0.014})`; creak `v.tone('sine',[[0,2637],[0.03,2349,'e']], g 0.03)`; `thump(v,0,900,600,0.08,0.03)` |
| `hatchShellBurst` | `crack(v,0,0.14,{hp:2000,n:4,gap:0.009})`; 5 shell tinks `v.tone('sine', 3000–5000 random, dec 0.04)` (no bar modes: shell, not glass); `puff(v,0,0.08,0.1,2500)` |
| `hatchCheep` (roar, baby) | FM chirp `v.bell(1175,{ratio:2,index:1.2,dec:0.15,g:0.06})` + `v.tone('sine',[[0,1175],[0.06,1568,'e'],[0.16,1175,'e']])` with `v.lfo` 18 Hz ±40 c; a second chirp at 0.2 s (1319 → 1760); duck 0.25 |
| `hatchInhale` (charge, **sustained**) | `sweep(v,0,0.8,[800,2600,1800],0.07,{kind:'pink',peakAt:0.85})`; 2 nose sniffs `puff(v,t,0.03,0.04,5000,{kind:'white'})` at 0, 0.12 |
| `hatchHop` (swing) | `thump(v,0,300,160,0.12,0.05)`; a shell rattle `crack(v,0.01,0.02,{hp:4000})` |
| `hatchSneeze` (release) | `sweep(v,0,0.15,[3000,5500,2000],0.2,{q:2.5})`; `puff(v,0,0.25,0.12,6000,{kind:'white'})`; `thump(v,0,520,260,0.15,0.1)`; a "tchoo" `v.tone('sine',[[0,880],[0.03,660,'e']])` |
| `hatchRingWhistle` (**sustained**; `…L` / `…R` pan variants) | `v.tone('sine',[[0,2349],[0.3,4699,'e']], g 0.035)` + `v.lfo(detune, 6 Hz, 25 c)`; breath `sweep(v,0,0.3,[2000,3500,5000],0.08,{q:4,pan:[-0.5,0.5]})` |
| `hatchRingSqueeze` | `sweep(v,0,0.08,[1200,900,600],0.06,{q:3})`; a rubbery `v.tone('sine',[[0,700],[0.05,1400,'e']], g 0.03)` |
| `hatchRingTing` (impact) | `glassBell(v,2349,0,0.12,0.06,{modes:2})` (D7: not in the wyrm's E pentatonic, 60 ms, no rain); an air pop `puff(v,0,0.08,0.05,3000,{kind:'white'})` |
| `hatchPlop` | `thump(v,0,260,120,0.2,0.08)` + a shell tick |
| `hatchRingRebound` | a falling whistle `v.tone('sine',[[0,4699],[0.22,2349,'e']])`; bonk `thump(v,0.2,600,300,0.25,0.06)`; a short cheep 1568 |
| `hatchRingFizzle` | `puff(v,0,0.06,0.06,2000,{kind:'white'})`; deflate `v.tone('sine',[[0,2349],[0.1,1175,'e']], g 0.03)` |
| `hatchCurl` (deathStart) | a whimper `v.tone('sine',[[0,1175],[0.2,880,'e']])` + vibrato; a soft rustle `sweep(v,0,0.2,[900,1600,700],0.03,{kind:'pink'})` |
| `hatchKnit` (dissolve) | 8 stitch ticks over 0.42 s, irregular spacing 45–70 ms, rising: `crack(v,t,0.02→0.06,{hp:3500,dec:0.005})` + `v.tone('sine', 2093→2794)` 15 ms each (a knitting run, not a clock) |
| `hatchLullaby` (afterDissolve +3, 0.8) | music box G6 E6 D6 (1568 / 1319 / 1175) at 0 / 0.22 / 0.44: `v.bell(f,{ratio:5.4,index:0.35,dec:0.6,g:0.05})` + `v.tone('sine', 2f, g 0.01)`; verb 0.5, duck 0.3 |
| `hatchFloat` (burst) | `sweep(v,0,0.6,[500,1200,2400],0.07,{kind:'pink',peakAt:0.6})`; a rising glide `v.tone('sine',[[0,1175],[0.5,2349,'e']], g 0.015)` |
| `hatchReviveGather` (**sustained**) | a falling air `sweep(v,0,0.9,[2400,1200,600],0.06,{kind:'pink'})` + a D5 / A5 pad |
| `hatchReviveLand` | `hatchEggLand` + 3 descending unstitch ticks + a short cheep |
| `hatchGrowWind` (**sustained**, 1.2 s) | `sweep` pink, centre 600 → 2400, through `v.panner` with L↔R points accelerating (0.4 → 0.12 s per swing): the air circles |
| `hatchGrowFwipA` (one per hand revolution, `pan` from the scene: the six pulses go round the stereo field −0.6 → 0.2 → 0.6 → −0.2 → −0.6 → 0.2) | an air pulse, no click: `sweep(v,0,0.09,[700,2600,1200],0.09,{kind:'pink',q:1.4,peakAt:0.35})` + a soft low swell `v.tone('sine',[[0,294],[0.08,330,'e']], g perc 0.01/0.07, 0.02)`. Each call is a little brighter (`pitch` 1 → 1.25 from the scene), so the years accelerate |
| `hatchGrowFwipB` | `hatchGrowFwipA` + a shell creak on top: `crack(v,0.03,0.04,{hp:2200,lp:6000,n:2,gap:0.02})` + `v.tone('sine',[[0.03,1760],[0.07,1568,'e']], g 0.012)`. A and B alternate, so the shell creaks on every second pulse. No click train, no ratchet (C2's distinguishing layer, YENI §5.1) |
| `hatchGrowCreak` (×6, `pitch` 1 → 0.62) | `thump(v,0,220,110,0.25,0.12,{drive:1.5})`; a hide stretch `sweep(v,0,0.12,[180,320,140],0.05,{kind:'brown',q:6})`; one shell pop `crack(v,0.02,0.03,{hp:2500})` |
| `hatchGrowChime` | `v.bell(587,{ratio:2,index:0.8,dec:0.9,g:0.06})` + `v.tone('sine',1175, g 0.02)` (soft, low, not brass; the dial "clicks shut" with an air pop `puff(v,0,0.04,0.05,2500,{kind:'white'})`, not a click) |
| **`hatchVoiceCrack`** (the signature) | 0–0.28 s the baby squeak 1175 → 1319 (sine + FM `v.bell` colour, vibrato 18 Hz); 0.28–0.36 s the break, glide 1319 → 587; at 0.36 s `growl(v,0.36,{d:1.1,f:[294,262,196,165,147],formants:[520,1250,2600],g:0.9,grit:4.5,rasp:30})` + **the ring whistle sung inside the roar**: `v.tone('sine',[[0.36,1175],[0.9,2349,'e']], g at −12 dB under the growl)` with the 4 Hz flutter + `thump(v,0.36,140,55,0.5,0.4,{drive:2})` + `puff(v,0.36,0.2,0.5,900,{kind:'brown'})`; duck 0.7, verb 0.4 |
| `hatchVoiceCrackRev` (the un-aging hint for lane D's rewind, §3.3 step 7) | `hatchVoiceCrack` built backward, not a reversed buffer: the growl 147 → 294 (formants [520,1250,2600], d 0.6) climbs, breaks upward 587 → 1319 over 0.08 s, and ends on a tiny squeak 1319 → 1175 (0.18 s); a short `sweep` pink inhale under it (the air sucked back in). Rising, never C2's tape whirr |
| `hatchGrownRoar` | `growl(v,0,{d:1.0,f:[196,220,165,147,110],formants:[520,1250,2600],g:0.85,grit:4,rasp:30})` + the same sung whistle layer (1175 → 2349 Hz, −12 dB) + `thump(v,0,120,50,0.4,0.3)` |
| `hatchGrownInhale` (**sustained**) | `sweep(v,0,0.8,[300,1100,700],0.09,{kind:'pink',peakAt:0.85})` + a low `growl` d 0.8, g 0.25 |
| `hatchGrownStomp` | `thump(v,0,160,60,0.35,0.12,{drive:1.4})` + a shell tick |
| `hatchGrownSneeze` | `thump(v,0,180,70,0.4,0.15,{drive:2})`; `puff(v,0,0.35,0.2,4000,{kind:'white'})`; `sweep(v,0,0.2,[1500,3200,900],0.2)`; a short `growl` d 0.3 |
| `hatchGrownWhistle` (**sustained**) | the baby whistle one octave down (1175 → 2349), flutter 4 Hz, breath `[1000,2000,3200]` |
| `hatchGrownRingBoom` | `glassBell(v,1175,0,0.14,0.1,{modes:3})`; `thump(v,0,120,50,0.5,0.2,{drive:2})`; `puff(v,0,0.3,0.2,1500,{kind:'brown'})`; duck 0.55 |

- `HATCH_SUSTAINED = ['hatchInhale','hatchRingWhistle','hatchRingWhistleL','hatchRingWhistleR','hatchGrownInhale','hatchGrownWhistle','hatchGrowWind','hatchReviveGather']`.
- Every sustained sound is `start()`ed and `stop(ms)`ed on the mark that ends its picture (SE-2).

### 6.3 Distinctness (SE-4) against every §5.1 identity and the aces
| Neighbour | Risk | Why ours differs |
|---|---|---|
| `crystal_wyrm` (E-pentatonic glass bar modes, `glassRain`) | the "tıng" | one 60 ms bell on D7 (not in E pentatonic), 2 modes, no rain, always paired with an air pop |
| S7 `auger_lance` (1 → 8 kHz whistle + a 120 Hz saw rotor) | whistle | ours is a narrow 2 → 5 kHz glide with a 6 Hz flutter, ≤ 0.3 s, no rotor, no saw |
| C11 `steppe_spiralhorn` (a 3 kHz horn flute, a held wind note) | wind note | ours always glides and never holds a pitch |
| C2 `dial_jester` (3.2 / 2.6 kHz tick-tock, brass gear ratchet, rewinding tape) | the growth sits right after their coin in the same batch | we have no ratchet and no click train at all: air "fwip" pulses (pink noise 0.7–2.6 kHz) circling the stereo field, a shell creak on every second one, a low soft chime (D5, not brass). No tick-tock pair, no tape. `hatchVoiceCrackRev` rises (a voice), never a tape whirr |
| `ashenRoar` (R1 lane-mate plan, `growl` formants 260 / 540 / 1350, f 36–74 Hz) | both lane-A dragons `growl` | ours sits a register higher (f 147–294 Hz) with brighter formants 520 / 1250 / 2600 and the sung whistle layer; the ashen roar is hollow-ribbed and ember-tailed. Measure the pair |
| `wyrmRoar` (`slice.ts:128`, formants 330 / 760 / 1950, f 42–96 Hz) | a dragon roar | as above: higher fundamental, brighter formants, the whistle layer; no glass. Measure the pair |
| R3 `wisp_imp` (the only "pof", a 300 Hz "uu" formant) | puffs | our puffs are white / brown noise, high-passed > 900 Hz or dull thuds, never formant-shaped |
| C8 `reed_heron` (2.4 kHz beak "tak") | the shell crack | ours is a broadband multi-crack + a low "tok", never a single tonal click |
| C9 `kite_fencer` (4 kHz "tsst") | high hiss | ours is never a steady hiss |
| R1 `ashen_drake` (50 Hz double heartbeat, a broadband VUF) | the grown thumps | ours are single, ≥ 55 Hz, with a shell tick on top |
| `abyss_magus` (D drone) | same key D | no saw drone; our D lives at D6 / D7 (voice, whistle) and D3 / D4 only in the growl |
| `storm_hawk` (v1 generic) | wind | the generic sounds are not character sounds |

- Measure every role offline: the 1/3-octave A-weighted LSD vs `crystal_wyrm`, `abyss_magus`, `stone_sentinel`'s generated voice and the lane-mates' roles (when they exist). Median ≥ 15 dB, min ≥ 10 dB.

### 6.4 Registration (additive)
- `src/audio/sounds.ts`: `import { V3_HATCH_RECIPES } from './v3/hatchling';` and `...V3_HATCH_RECIPES, // Bulut Yavrusu (./v3/hatchling.ts)` next to `...V3_DAWN_RECIPES` (line 1092).
- `src/audio/sfx.ts`: `import type { HatchSfxName } from './v3/hatchling';` and `| HatchSfxName` next to `| DawnSfxName` (line 62).
- `src/cinematics/_v3/sound.ts` `CHARACTER_SOUNDS`, one entry after `abyss_magus`:
  ```ts
  cloud_hatchling: { roar: 'hatchCheep', arrive: 'hatchCloudDrift', land: 'hatchEggLand', charge: 'hatchInhale', swing: 'hatchHop', release: 'hatchSneeze', impact: 'hatchRingTing', deathStart: 'hatchCurl', dissolve: 'hatchKnit', afterDissolve: [[3, 'hatchLullaby', 0.8]], burst: 'hatchFloat', reviveGather: 'hatchReviveGather', reviveLand: 'hatchReviveLand' },
  ```
- **Grown voice (a ship requirement, not phase 2):** `CHARACTER_SOUNDS` is keyed by card id. Add, additively in `_v3/sound.ts`:
  - `VARIANT_SOUNDS: Record<string, Partial<CharacterSounds>>` with `'cloud_hatchling:grown': { roar: 'hatchGrownRoar', charge: 'hatchGrownInhale', swing: 'hatchGrownStomp', release: 'hatchGrownSneeze', impact: 'hatchGrownRingBoom' }`;
  - `soundsOfUnit(u)`: `{ ...soundsOf(u.cardId), ...VARIANT_SOUNDS[`${u.cardId}:${variantOf(u)}`] }`;
  - `holdCharge(u)` (`_v3/sound.ts:250-251`) uses `soundsOfUnit(u)` instead of `soundsOf(u.cardId)` (one line). Without it the declaration plays the baby sniff for ≈ 233 ms under a grown dragon.
  - Our own cinematics use `soundsOfUnit(u)` too.

### 6.5 The struck body (SE-5)
- **Phase 1:** `hatchhide.sound = { same: 'cloth' }`: soft, no ring, sanctioned as "soft body".
- **Phase 2 (ask):** an own `hatchhide` generated hit (`GENERATED_HIT_MATERIALS` + the pinned test `tests/art/materials.test.ts`), with a soft rubbery thump and a shell tick. Same procedure as the ashen plan's Q2.

---

## 7. Card art: `src/art/cardart-v3/cloud_hatchling.ts` (`CardArtV3`, docs/v3/KART_RESIMLERI.md)

**big 88×68: "Hapşırık".**
- **Backdrop:** the WIND sky with the kit's `paintBackdrop`: 2–3 flat bands, `night3` top, `night4`, then `steel` at the horizon. The light shape is a `steppedDisc` centred 3 px behind the ring.
- **Floor:** no floor. A puffy **cloud bank** fills the lower third (its top contour at y ≈ 46: `white` lit tops, `mist`, `steel` underside lobes).
- **Subject:** the bottom half of a cracked egg sits in the cloud at the left centre (x 16–44, zigzag rim, speckles on the shadow plane). The baby sits in it, its big head at the left third line (head centre ≈ (32, 26)), mid-sneeze: eyes squeezed, cheeks deflating, the cowlick blown back.
- **The ring (the focus and brightest point):** a hollow ring of wind flies toward the upper-right third at ≈ (62, 20): a 12×22 ellipse, `white` leading inner edge, `mist` band, three 1-px whistle streaks trailing back to the mouth. It sits inside the focus box with ≥ 4 px of air.
- **Gag:** the top shell cap tumbles in the air above the head (≈ (30, 9), ≥ 4 px from the top).
- **Rim:** `water4` (one rim colour).
- **Layers:** backdrop → subject (ink outline) → light (the ring's lead edge, the eye squeeze line, the streaks; never outlined).
- **Living frames (6, f0 = the reduced-motion frame):** the ring advances 1 px and its streaks alternate; one cloud lobe edge cycles (≤ 2 px motion, palette steps only).

**small 44×34 (hand-tuned, KART_RESIMLERI §1 preference 1: a tighter crop):**
- head + ring only: the head at (15, 19), the ring at (32, 10) as 6×11, the egg rim cut by the bottom edge;
- `reduceSubject` → ASCII map → `patch`; never a blind `autoSmall`;
- judge it at 1× and ×6, and in hand (`?dev=cards3`).

**Registration:**
- `src/art/cardface-v3/index.ts`: `import cloudHatchling from '../cardart-v3/cloud_hatchling';` + `cloud_hatchling: (p) => { p.blit(renderArt(cloudHatchling, 0).smallPx, 0, 0); },` in `ART`, only once the v3 sprite is registered.
- The render script of KART_RESIMLERI §9 lived in an old scratch dir that no longer exists. Builders use `?dev=cards3` / `?dev=art-lab` and a fresh scratch copy of that script; the numbers in §10 of that doc are the gate.

No cut-in (not an ace).

---

## 8. Integration plan (exact registration points; v1 stays byte-identical)

### 8.1 Why v1 is safe
- `cloud_hatchling` has no v1 art (`placeholderTotem`), and the v3 art is read only under `LOOK_V3` (`monsterArt`). The recipe is read only through the v3 bridge.
- `slotVariant` returns null without `LOOK_V3`. The `FieldView` line is inside `if (LOOK_V3)`. `MonsterUnit.sheetFor` is installed only under `LOOK_V3`, and it returns null for a unit without a variant, so `applyFacing` takes today's key. `ownsKey` accepts today's `p1Key` / `p2Key` exactly as the old guard did; the extra keys exist only for a variant unit.
- The `artFrame(this.art, …)` / `unitFrame` swaps are byte-identical, because `cacheOf(monsterArt(id))` is the same cache.
- The `project.ts` change acts only on a `jesterAging` card's `activate`; no v1 scenario has one (the v1 film sets do not include `b2*`).
- **Every cinematic registration and the observer sit inside `if (LOOK_V3) { … }`.**
- The new `MonSpec` fields are unused by the existing scenarios.
- Prove it: filmdiff v1 17/17, a6v1 26/26 (§9).

### 8.2 The recipe: `src/presentation/cards/cloud_hatchling.ts` (new, auto-discovered by `src/presentation/registry.ts`)
```ts
import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';
export default {
  id: 'cloud_hatchling',
  tier: 'normal',
  body: { physical: 'hatchhide' },
  attack: { type: 'projectile', blow: 'physical', from: 'muzzle', vfx: 'windRing', tone: PAL.mist, ranged: true, blocked: 'rebound' },
  summon: { style: 'bloom', matter: 'light', roarPeak: 4, shake: 1 },
  death: { material: 'plant', accent: 'light' },
  flip: { accent: 'mist', ramp: 'leaf' },
  voice: { custom: 'cloud_hatchling' },
  light: { glow: { emissive: [], halo: 0, pool: 0.8, spill: PAL.leaf2 }, strike: PAL.mist },
  custom: { strike: true, summon: true, death: true, effect: true },
} satisfies PresentationRecipe;
```
- `custom` keeps `src/cinematics/recipe/install.ts` from registering its priority-10 defaults (strike / summon / death). Flip stays the recipe's.
- No edit to `src/cinematics/_v3/presets.ts:59` or `src/view/light/profiles.ts:91`. Their rows stay as v1 data, and the recipe answers in v3.

### 8.3 Cinematic hooks (all inside `if (LOOK_V3)`)
| File | Call | Event |
|---|---|---|
| `src/cinematics/strikes-a/cloud_hatchling.ts` | `registerStrike('cloud_hatchling', hatchRingV3, { name: 'strikes-a:cloud_hatchling' })` | battle strike (`s.direct`, `s.blocked`, `s.ctx.ev.result`, `s.attacker.variant`) |
| same | `registerCardHook('cloud_hatchling', 'destroyed', hatchDeathV3, { name: 'strikes-a:cloud_hatchling:death' })` | `destroy` (`location !== 'monster'` or `sourceOwnsDeath` → `ctx.base()`) |
| `src/cinematics/strikes-a/cloud_hatchling-grow.ts` | `registerCardHook('cloud_hatchling', 'effect', hatchGrowV3, { name: 'strikes-a:cloud_hatchling:grow' })` | `activate` kind `monsterEffect` |
| same | `registerObserver(warmGrownOnCoinCall)` | `decision` (`coinCall`) |
| same | `registerObserver(lookUpAtCoin)` | `coinToss` (the look-up, §5.6) |
| `src/cinematics/summon-a/cloud_hatchling.ts` | `signatureSummon('cloud_hatchling', (S) => S.ctx.base(), { v3: eggDropV3 })` | `summon` (hand → egg drop; `from: 'field'` → base; a revive never arrives here, `recallV3` consumes it) |
| same | `registerObserver(cloudInOnSummon)` | `summon` from the hand: starts the cloud drift during the slam (§5.1) |

- The loader imports every `src/cinematics/**/*.ts` (`src/cinematics/index.ts`). The `-fx.ts` file has no top-level effects.

### 8.4 Other one-line edits (shared files; additive, each next to related lines)
| File | Edit |
|---|---|
| `src/duel/MonsterUnit.ts` | ≈ 12 lines (§3.3 step 3): `static sheetFor?`, `baseKey`, `setArt()`, `art` not readonly, `ownsKey()`, the `syncSheet` guard + base-key fallback, the `setFrame` texture fallback, `top` via `artFrame(this.art…)`. The variant state and logic live in the new `src/duel/unit-variant.ts` |
| `src/duel/FieldView.ts` | the one `LOOK_V3` line in `sync` (§3.3 step 4) |
| `src/cinematics/_core/project.ts` | **precondition:** `permAtk` / `permDef` on a `jesterAging` `activate` (§3.3 step 5) |
| the pixel-read sites of §3.3 step 6 | one orchestrator pass: `monsterFrame(u.cardId, …)` → `unitFrame(u, …)`; `shatter` gets a variant-aware cache key |
| `src/art/textures.ts:96` (optional) | `cropsArt(art)`: `|| isVariantArt(art)`, so the grown sheets are cropped atlases too (memory). Without it they stay uncropped grids (≈ 2.36 MB each, already in budget) |
| `src/duel/scenario.ts` | `MonSpec` += `permAtk?: number; permDef?: number` and in the slot build (~line 113): `...(m.permAtk !== undefined ? { permAtk: m.permAtk, permDef: m.permDef ?? 0 } : {})` (stages a grown hatchling for films) |
| `src/audio/sounds.ts`, `src/audio/sfx.ts`, `src/cinematics/_v3/sound.ts` | §6.4 |
| `src/art/cardface-v3/index.ts` | §7 |
| new auto-discovered files | `src/art/materials/defs/hatchhide.ts`, `src/presentation/cards/cloud_hatchling.ts`, `src/dev/previews/hatchling.ts` (no registry edit) |
| **not touched** | `src/data/cards.ts` (rules final), `src/engine/**`, `src/art/types.ts` (the variant registry lives in the new `src/art/variants.ts`), `src/view/layout.ts`, `src/cinematics/b2/placeholders.ts` (lane D's) |

### 8.5 Scenarios: `src/duel/scenarios/kart_a_cloud_hatchling.ts` (new; keys `kaCh*`)
- Auto-discovered by `src/duel/scenarios.ts` (`import.meta.glob('./scenarios/*.ts', { eager: true })`, merged into `SCENARIOS`).
- Use `zones: 5` and the `five()` helper of `b2.ts`.
- Stage rng 12345 → the next coin is `'tails'` (YAZI), so `callCoin 'tails'` wins (b2.ts header).
- Grown = `{ id: 'cloud_hatchling', permAtk: 1200, permDef: 800 }` (needs §8.4).

| Key | Stage / steps | Films |
|---|---|---|
| `kaChSummon` / `kaChSummonP2` | hand `cloud_hatchling` (P2: `active: 1`); `normalSummon` zone 2 | the egg drop |
| `kaChFlip` | `{ id, faceUp: false, position: 'defense' }`; `flipSummon` | the recipe flip |
| `kaChAtk` / `kaChAtkP2` | battle; vs `storm_hawk` (1000) in attack | the ring wins (power 1) |
| `kaChAtkWeak` | vs `wisp_imp` (300) in attack | power 3 |
| `kaChDefWin` | vs `wisp_imp` in defense (200) | the target dies in defense |
| `kaChDirect` / `kaChDirectP2` | the opponent has no monster; `attack(…, null)` | direct |
| `kaChBlocked` | vs `stone_sentinel` in defense (2100) | rebound + bonk + LP |
| `kaChLose` / `kaChLoseP2` | vs `crag_axeman` (1600) in attack | fizzle, backlash, the egg death in attack |
| `kaChTie` | vs `tide_golem` (1100) in attack | both die |
| `kaChHit` | the hatchling in defense (900), attacked by `wisp_imp` (300) | the guard holds |
| `kaChKill` / `kaChKillP2` | the hatchling in attack, attacked by `crystal_wyrm` (beam) | hitMagic → egg death |
| `kaChKillPhys` | attacked by `magma_titan` (2100) | hitHeavy → egg death |
| `kaChGuardKill` | in defense, attacked by `crag_axeman` | guard break → egg death |
| `kaChBolt` | `judgment_bolt` destroys it (the activate step shape of `b2.ts` `act`) | spell death, `hit: false` |
| `kaChRevive` | in the graveyard; `soul_recall` | recallV3's ghost → revive f0 bridge (the curled ball) → the revive pose |
| `kaChPos` | `changePosition` | to / from guard |
| **`kaChGrow`** / **`kaChGrowP2`** | jester + hatchling, **and at least one opponent monster** (`magma_titan`: `coinWipe` is legal only then, `legal.ts:123`) (P2: `active: 1, turn: 2`); `activateMonster` + `callCoin 'tails'` | the look-up at the coin (lane D placeholder today) → the growth |
| `kaChGrowFast` | `kaChGrow` with `&speed=3` in the film URL | the dial beats stay on their frames (SE-1) |
| `kaChGrowDef` | the hatchling in defense | the growth from guard (fromGuard under the dial build); **measured in the first build round** |
| `kaChGrowTwo` | two face-up hatchlings + one face-down | staggered growth; one stat beat for both; the face-down one stays |
| `kaChGrowLose` | `callCoin 'heads'` (wrong) | the look-up, then the hatchling dies by the jester (lane D owns it via `sourceOwnsDeath`; else our egg) |
| `kaChGrowBorrowed` | P2 owns the hatchling; P1 `puppet_string` takes it, P1's jester wins (an opponent monster stays on P2's side), `endTurn` returns it | the growth on the borrower's side, then the variant survives the P1 → P2 sheet swap |
| `kaChRewound` | P2's jester wins against P1's BABY hatchling | lane D's rewind: summon reversed (today's contract) |
| `kaChGrownRewound` | P2's jester wins against P1's GROWN hatchling | the un-aging: special reversed, then summon reversed, no `__BASE` frame, `hatchVoiceCrackRev` if lane D plays it |
| `kaChGrownIdle` / `kaChGrownIdleP2` | staged grown, no steps | the permanent grown idle + ring, P1 / P2 |
| `kaChGrownAtk` / `kaChGrownAtkP2` | grown vs `magma_titan` (2100) | the big ring |
| `kaChGrownDirect` | grown, empty opponent | |
| `kaChGrownBlocked` | grown vs `crystal_wyrm` in DEFENSE (2300 = 2300) | rebound |
| `kaChGrownLose` | grown vs `crystal_wyrm` in attack (2800) | the BIG egg death in attack |
| `kaChGrownKill` | grown attacked by `crystal_wyrm` | hitMagic → big egg |
| `kaChGrownGuardKill` | grown in defense (1700), attacked by `magma_titan` | guard break in the grown form |
| `kaChGrownHit` | grown in defense, attacked by `crag_axeman` (1600) | the grown guard holds |
| `kaChGrownPos` | grown `changePosition` | grown to / from guard |
| `kaChGrownControl` | grown on P2's side; P1 `puppet_string` takes it, then `endTurn` returns it | the re-sync: grown on both sides, P1 and P2 sheets |
| `kaChGrownResync` | grow (coin), then `endTurn`, `endTurn` | grown after several batches (permanence) |
| `kaChGrownChains` | grown attacks; P2 has `chains_of_light` set | the chains bind a grown body (no baby-shaped overlay) |
| `kaChGrownEquip` | grown; P1 equips `dragon_blade` | the aura on a grown body |
| `kaChGrownVenomHit` / `kaChGrownAshenHit` | grown in defense, attacked by `venom_drake` / `ashen_drake` | lane-mate strikes on a grown target (`currentPixels`) |
| (existing, lane D's `b2.ts`) `b2CoinWinAuto` / `b2CoinLoseAuto` | both stage a `cloud_hatchling` next to the jester | film both every round: the growth after their coin, and the hatchling in their "bilemedi" rewind |

---

## 9. Verification plan

```sh
B=/tmp/claude-0/-home-user-yugioh/0bb2f57e-e830-54e9-b1e3-c08756cc3a08/scratchpad
export PLAYWRIGHT_BROWSERS_PATH=$B/pwb
O=$B/kart-a/ch
```

### 9.1 Sheets and gates (every round, both forms, P1 and P2)
```sh
npx vite-node tools/monster-sheet.ts --id cloud_hatchling --look v3 --anims all --scale 3 --points --out $O/sheet
npx vite-node tools/monster-sheet.ts --id cloud_hatchling --look v3 --anims all --scale 3 --points --p2 --out $O/sheet-p2
npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/_cloud_hatchling_grown.ts --look v3 --anims all --scale 3 --points --out $O/grown
npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/_cloud_hatchling_grown.ts --look v3 --anims all --scale 3 --points --p2 --out $O/grown-p2
npx vite-node tools/monster-gates.ts $O/sheet/cloud_hatchling-v3.json $O/sheet-p2/cloud_hatchling-v3-p2.json --class medium --ref none
npx vite-node tools/monster-gates.ts $O/grown/<json> $O/grown-p2/<json> --class medium --ref none
node tools/shot.mjs "?dev=monster&id=cloud_hatchling&look=v3&mode=board" --out $O/board.png
node tools/shot.mjs "?dev=hatchling&mode=board" --out $O/board-both.png          # both forms at 1× on the floor
node tools/shot.mjs "?dev=hatchling&mode=swap" --film 24 --every 70 --cols 6 --scale 3 --out $O/swap.png
```
- **Thresholds** (P1 and P2, both forms):
  - Sİ-2: margin ≥ 2, 0 edge px.
  - HA-14 out ≤ 1.2 (special is the declared exception, replaced by the Δ = 0 swap test).
  - HA-15 ≤ 2.0. HA-16 ≤ 1.4. HA-17 ≤ 1.8. HA-18 ≥ 15 %. HA-19 0.3–0.8.
  - HA-20 transitions ≤ 400 ms.
  - HA-21 < 50 % on the sheet and in every idle phase.
  - IŞ-10: idle mean ≤ 10 %, body frames ≤ 15 %, effect frames (attack release, special growth, summon burst, death knit) ≤ 20 %.
  - HA-9: the feet rows are fixed in idle / guard / transitions.
  - HA-1 marks. HA-25 muzzle on every frame.
  - IŞ-1 litBias > 0.
  - KK-13: ≤ 140 frames, ≤ 8 ms per frame, ≤ 3.6 MB per side.
  - ≤ 20 colours per frame.
- **KK-1 reference gate:** draw baby idle f0 and grown idle f0 FIRST.
  - Show them ×3 and at 1× on the board next to `storm_hawk`, `crystal_wyrm`, `venom_drake`, `ashen_drake`.
  - A critic approves both BEFORE any anim is drawn.
  - The 1× read test: "baby dragon with an egg on its tail" and "grown cloud dragon with a ring", with no labels.

### 9.2 Films (LOOK at every PNG)
```sh
for s in kaChSummon kaChSummonP2 kaChRevive; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 24 --every 100 --start 200 --cols 6 --out $O/$s.png; done
for s in kaChAtk kaChAtkP2 kaChAtkWeak kaChDefWin kaChDirect kaChDirectP2 kaChBlocked kaChLose kaChLoseP2 kaChTie \
         kaChGrownAtk kaChGrownAtkP2 kaChGrownDirect kaChGrownBlocked kaChGrownLose; do
  node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 20 --every 100 --start 200 --cols 5 --out $O/$s.png; done
for s in kaChHit kaChKill kaChKillP2 kaChKillPhys kaChGuardKill kaChBolt kaChPos kaChFlip \
         kaChGrownKill kaChGrownGuardKill kaChGrownHit kaChGrownPos kaChGrownIdle kaChGrownIdleP2; do
  node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 16 --every 100 --start 200 --cols 4 --out $O/$s.png; done
for s in kaChGrow kaChGrowP2 kaChGrowDef kaChGrowTwo kaChGrowLose kaChGrownControl kaChGrownResync; do
  node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 40 --every 120 --start 0 --cols 8 --out $O/$s.png; done
# the signature beats frame by frame at 3x (find the times with measure first):
node tools/shot.mjs "?dev=duel&s=kaChAtk&look=v3" --fresh --film 24 --every 17 --start <contactMs-250> --clip 260,90,260,150 --scale 3 --cols 6 --out $O/ring-x3.png
node tools/shot.mjs "?dev=duel&s=kaChGrow&look=v3" --fresh --film 48 --every 34 --start <growStart> --clip 200,80,240,170 --scale 3 --cols 8 --out $O/grow-x3.png
node tools/shot.mjs "?dev=duel&s=kaChKill&look=v3" --fresh --film 60 --every 17 --frames $O/killframes --out $O/kill-all.png
```
- **Must see:**
  - the ring is hollow and 2 px, and one ring at a time;
  - the dial is hollow and runs clockwise;
  - six distinct growth frames;
  - **no pop on the swap frame**;
  - the grown form in every later frame of `kaChGrownResync` / `kaChGrownControl` (both sides, lit from the screen's top left);
  - the egg float has no empty frame before the card appears;
  - no baby pixels on a grown body anywhere (overlays, chains, shatter).

### 9.3 Timing, palette, white, sound, camera
```sh
node tools/measure.mjs --scenarios 'kaCh*' --look v3 --jobs 2 --out $O/measure-v3.json
node tools/contact-probe.mjs --scenarios kaChHit,kaChKill,kaChKillPhys,kaChGrownKill,kaChGrownHit --png $O/probe
node tools/shot.mjs "?dev=duel&s=kaChAtk&look=v3" --fresh --film 120 --every 17 --frames $O/atkframes --out $O/atk-all.png
node tools/shot.mjs "?dev=duel&s=kaChGrow&look=v3" --fresh --film 300 --every 17 --frames $O/growframes --out $O/grow-all.png
node tools/palcheck.mjs $O/atkframes --clip 120,40,400,230       # also growframes, killframes, summon frames
node tools/clip.mjs "?dev=duel&s=kaChAtk&look=v3" --music off --marker hatchRingTing --out $O/clips/kaChAtk.mp4
node tools/clip.mjs "?dev=duel&s=kaChGrow&look=v3" --music off --marker hatchVoiceCrack --out $O/clips/kaChGrow.mp4
node tools/clip.mjs "?dev=duel&s=kaChSummon&look=v3" --out $O/clips/kaChSummon.mp4      # with music (ducking)
node tools/clip.mjs "?dev=duel&s=kaChKill&look=v3" --music off --marker hatchLullaby --out $O/clips/kaChKill.mp4
node tools/clip.mjs "?dev=duel&s=kaChGrownAtk&look=v3" --music off --marker hatchGrownRingBoom --out $O/clips/kaChGrownAtk.mp4
```
| Moment (game ms at 1×, action → input return) | Limit | Target |
|---|---|---|
| summon (normal) | ≤ 3340 (YENI 2.3 s × 1.45) | ≈ 3000 |
| attack vs monster (+ target death) | ≤ 3190 | ≈ 2900 |
| direct | ≤ 2320 | ≈ 2150 |
| declaration | ≤ 435 | |
| destroy (our egg death) | ≤ 2030 | ≈ 1850 |
| growth (the hatchling's `activate` event, start → end) | ≤ 4060 (YENI 2.8 s × 1.45) | ≈ 3600 |
| revive | ≤ 3050 | |
| position | ≤ 580 | |
| flip | ≤ 870 | |
| LP flow | ≤ 400 | |

- The number appears at contact ±17 ms.
- `palcheck`: off-palette Δ ≤ 1 pt vs frame 0, white ≤ 1.5 %, no row > 60 % white.
- Clips: true peak ≤ −1 dBFS, 0 clipped samples. The marker box is on the matching frame (SE-1, also at `&speed=3`).
- SE-4 LSD as in §6.3.
- **Badge check** (§10 R2): after `kaChGrow`, the plate never shows 1100 again, frame by frame across the batch end.
- **Camera:** `measure` → `zoom.max` = 1 and `fracScrollFrames` 0 for every `kaCh*`. Also `node tools/measure.mjs --camera-gate <base.json> <now.json>` on the repo's existing scenario set, to prove nothing else moved.

### 9.4 Repo gates (before every push)
```sh
npm run typecheck && npm test        # known failures only: dusk_ashen, hourglass_imp, shield_titan (+ lane D's scrap_raiders G1)
node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films          # 17/17 IDENTICAL
node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films     # 26/26 IDENTICAL
grep -n "setScale\|setAngle" src/cinematics/strikes-a/cloud_hatchling*.ts src/cinematics/summon-a/cloud_hatchling.ts   # empty
npx vite-node tools/sameness.ts --look v3 --ids cloud_hatchling,storm_hawk,crystal_wyrm,venom_drake,ashen_drake --against all
npx vite-node tools/sameness.ts --look v3 --art src/art/monsters-v3/_cloud_hatchling_grown.ts --ids crystal_wyrm,venom_drake,ashen_drake,tide_golem
```
- **`tests/art/cloud_hatchling.test.ts`:**
  - every anim of §4 exists with its holds and marks;
  - `validateArt(art, { tier: 'normal' })` is clean for both arts (special out documented);
  - drawing is deterministic;
  - the grown art has exactly the baby's `AnimSpec` for every anim it has, and none for summon / revive / special;
  - identical `w` / `h` / anchor / hover;
  - **Δ(baby special last frame, grown idle 0) = 0, P1 and P2**;
  - the head is taller than the body (the baby idle f0 head-ellipse rows > body rows);
  - the feet rows are fixed;
  - margins on every frame;
  - one glint per anim;
  - bytes within `--class medium`;
  - the card art (both sizes) within the KART_RESIMLERI §10 numbers.
- **`tests/art/variants.test.ts`:**
  - `slotVariant` is null without `LOOK_V3`, `'grown'` with `permAtk`, null without it;
  - `variantSheetKey` P1 / P2 names;
  - registering does not add `cloud_hatchling` twice to `REGISTRY_V3`.
- `tests/presentation/recipes.test.ts` covers the recipe automatically.

### 9.5 Critique rounds (≥ 3, independent critics, findings with rule ids)
- **Round 1:** the two idle f0 references + the idle / guard sheets of both forms.
- **Round 2:** every sheet ×3, P1 / P2, plus the attack, summon and growth films.
- **Round 3:** every film + the clips + the gates + a blind 1× read by an outside critic.
- Log the evidence paths in `docs/v3/oturum-a.md`.

---

## 10. Risks and open questions

### Risks
1. **R1: shared-file edits for the variant.** `MonsterUnit.ts` (~25 lines), `FieldView.ts` (1 line) and `scenario.ts` (2 lines) are shared, not owned by this card.
   - They are additive and no-ops for every other unit. filmdiff proves v1.
   - **Orchestrator approval is needed before the build.** The fallback, if refused, is much weaker: an aura image over the unit showing grown frames while the baby sprite is hidden. Every kit would then fight the hidden sprite, so it is not recommended.
2. **R2: badge flicker at the batch end.** The projection (`_core/project.ts`) does not apply `permAtk`. After our stat beat shows 2300, the frontier sync may roll the plate back to 1100 for one beat before the final `sync(after)`.
   - Verify on film (§9.3).
   - Fix if it shows (ask): in `applyEvent` `case 'statChange'`, when the card's effect is `jesterAging` and `ev.atk − ev.prevAtk === 1200`, set `permAtk = 1200` / `permDef = 800` on the slot. This mirrors rules.ts, which is the reducer's stated job.
3. **R3: other cards' strikes read baby pixels.**
   - `strikes-a/_kit.ts` `currentPixels`, `traps/_chains.ts`, `_v3/summon.ts`, `_v3/card.ts` and `auras-v3.ts` call `monsterFrame(u.cardId, …)`. A grown target could get a baby-shaped overlay (a freeze, a crack, chains).
   - Mitigation: the `artFrame(u.art, …)` swap at those call sites (provably byte-identical for everyone else), proposed to the orchestrator.
   - Film `kaChGrownKill` (crystal_wyrm), `kaChGrownGuardKill` (magma_titan) and a chains_of_light case before deciding.
4. **R4: the light layer.** The glow sheet and the pool radius are per card id (`view/light/glow.ts`, `LightLayer.ts`). Phase 1 uses no emissive (§1.5). Phase 2 adds a variant-aware `glowSheet(scene, id, art = monsterArt(id), key = id)`: additive, ask.
5. **R5: lane D sequencing.**
   - Our growth needs lane D's final coinToss / massDestroy handlers to either leave the hatchling's `activate` + `statChange` events to the Director, or play them via `ctx.play(i)` (`playRun`). Consuming them without playing would skip the growth.
   - Lane D's "bilemedi" rewind of their own monsters must register a `destroys` hook keyed by `dial_jester`, so that our death steps aside (`sourceOwnsDeath`).
   - **Send both lines to lane D** through the orchestrator.
6. **R6: the sheet budget.** 133 baby frames at 84×78 are 3.49 MB, which is under 3.6 only with `--class medium`. If the gate insists on `small` (2.2 MB), cut the idle to 16 f and the special to 14 f and narrow the frame to 80×76, or ask for the class.
7. **R7: noise.** Cloud lobes and shell speckles push IŞ-10. Keep lobes ≥ 2×2, speckles only on the shadow plane, the waist ring at ≤ 10 puffs.
8. **R8: comic timing vs budget.** The attack's "ha… ha…" and two hops must fit 2.2 s with the target's death. Measure first; trim the flight and hops, never the 160-ms "ha…" frame.
9. **R9: the special's out exception** must be accepted by the critic and `validateArt`. If `validateArt` refuses `end: 'hold'` on a special, patch the last frame through `AnimDef.frames` and document it.
10. **R10: two hatchlings at once** (`kaChGrowTwo`): two dials overlapping on adjacent tiles. Cap the dial radius at 22 px (tiles are 64 wide). The staggered start keeps the sounds apart.

### Open questions (orchestrator / owner)
- **Q1.** Approve the variant mechanism edits: `MonsterUnit.ts`, `FieldView.ts`, `scenario.ts` `MonSpec` (R1)?
- **Q2.** Approve the optional fixes: projection `permAtk` (R2), `monsterFrame` → `artFrame(u.art…)` at the listed call sites (R3), the variant-aware glow (R4), `VARIANT_SOUNDS` / `soundsOfUnit` in `holdCharge` (§6.4)?
- **Q3.** Size class: may the baby sheet be gated as `medium` (3.6 MB) because the card spills to 64 (R6)?
- **Q4.** Idle hiccup sound: the R1 plan asked the same. There is no ambient idle-sound system, so the hiccup is heard only at the beats where a cinematic plays it (summon end, growth start). Is an ambient tick wanted?
- **Q5.** Own struck-body sound `hatchhide` (§6.5 phase 2)?
- **Q6.** A grown hatchling returned to the hand or deck and summoned again is a baby (the slot's `permAtk` ends with the slot, M14). Confirm that this is the intended reading of "kalıcı" (permanent while on the field).
