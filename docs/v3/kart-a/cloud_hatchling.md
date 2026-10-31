# Bulut Yavrusu (`cloud_hatchling`): design and build plan (lane A, C3)

RÜZGAR / Ejderha · Sv3 · 1100/900 · size class 48, the grown form spills into 64 · NOT an ace (no cut-in) ·
effect `jesterAging`. Sources: YENI_KARTLAR §5, §5.1 (C3 row), §5.2 (C3 row), §6 C3, the owner decisions;
REHBER §1–§8; TEMPO.md; PARALEL_OTURUMLAR.md. Every path, function and API named below was read in the
tree on 2026-10-31. The evidence renders are in the scratch dir `kart-a/ch/` (`board.png`, `sheet.png`,
`gallery.png`, `board-*.png`). **Revision 3** (after the round-2 critique; round 1 → revision 2): see the
Critique logs at the end. Revision 3 also re-checked every hold table against `src/art/rigkit/validate.ts`
(HA-1 special `impact = release`, HA-3 special release ≤ 70 ms and non-shortening recoveries, HA-4 hit
recover start 240–370 ms), which revision 2 violated in five places.

**Pitch.** A chubby mint baby dragon. Its head is bigger than its body. A cloud cowlick sits on its
head, and half of its eggshell rides on its tail tip like a helmet. It hiccups little wind rings. It
attacks by sneezing a whistling ring of air, and it dies by curling into a ball while its egg re-knits
around it and floats away on a cloud. When a Dial Jester's coin is in the air, the baby looks up at it
and hiccups. When the call is right, a sky dial made of twelve cloud puffs is cast behind it and its
wind-streak hands race forward; every revolution sweeps two hour-puffs off the dial, and they fall to
its waist while the baby grows up in six frames; with each frame its hiccup drops a step lower, until
the last one breaks two octaves down into a real roar on the roar frame. From then on it is a grown
cloud dragon for good: a round, seated, four-legged cloud lion-dragon whose huge cloud mane is its main
mass, and the fallen years orbit its waist as a cloud ring. It still hiccups once a loop, now a fat ring
from a big jaw. **One card, two bodies:** the grown body is a second, complete sheet with the full anim
list and its own (heavier) timing. It plays every moment (idle, guard, attack, hits, death, victory) in
its own form, on both sides of the board, from the first frame of any unit built for it, and it survives
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

### 1.1 What reads at 1× (in an 82×78 frame)
**Baby (idle f0 bbox ≈ 32×37, opaque ≈ 600–680 px, like `storm_hawk` 38×35 / 743 and `lumen_sprite` 33×36 / 533):**
1. **The head is bigger than the body** (head ellipse ≈ 20×18, pear body ≈ 16×16). It sits upright on its haunches like a chick.
2. **A cloud cowlick**: a 3-lobe white puff (≈ 7×5) on the crown, leaning back.
3. **The eggshell helmet on the tail tip**: a half shell (≈ 6×5) with a zigzag rim, on a short tail curling left and back. Its jagged rim is the second-strongest shape.
4. A huge round eye (4×5) with a gold iris ring and a 1-px `white` catch-light, the **brightest point** of the sprite.
5. Stubby wing nubs (≈ 6×5) that never manage a full flap, and a cream belly.
6. Pastel mint is the only mint on the board: `storm_hawk`, `thorn_lurker` and `venom_drake` are mid-to-dark leaf.

**Grown (idle f0 bbox ≈ 58×54, opaque ≈ 1650–1850 px, like `tide_golem` 54×54 / 1706 and `ember_wolf` 58×51):**
The revision-2 grown form (upright, S-necked, half-open wings) read as a small `crystal_wyrm` at 1×
(critique 2, #13). The adult is now **round and cloud-like**, a guardian lion-dragon ("foo-dog"):
1. **A seated pose on four legs**: haunches down, two straight forelegs planted in front, the chest
   broad. The outline is a wide, low dome, wider than tall, the opposite of the wyrm's tall upright
   wedge. No visible neck: the head sits forward in the mane.
2. **A huge cloud mane is the main mass** (≈ 40 % of the opaque pixels): `white` / `mist` / `steel`
   lobes from the crown down over the shoulders and the back, the cowlick grown up. The outline is
   lobed cloud, never a smooth hide curve.
3. **A short, broad round muzzle** (a lion's, not a wyrm's long snout) with a wide jaw, `gold3` eyes
   under heavy cloud brows, and **small ivory ram-curl horns** half buried in the mane (a callback to
   the ring; they never break the dome's outline by more than 3 px).
4. **The wings are folded into the mane**: only two leaf-green wing tips (≈ 6×8) show above the
   back lobes. No wing membrane is visible in idle (the wyrm's half-open wings are its second read).
5. A **permanent cloud ring** orbits the waist: an iso ellipse (≈ 48×12) of **12 identical, evenly
   spaced puffs** (one per hour of the dial it came from, §5.6), its back half behind the body and its
   front half in front. It is baked into the grown sprite frames. The puffs step 1/36 turn per idle
   frame (§4.1, HA-21 phase gate). With the mane, the cloud mass now dominates the outline.
6. **The eggshell rim stays on the tail tip** as a band (continuity: "it was this baby"); the tail
   curls round the haunch in front like a cat's.
7. Against `crystal_wyrm` (a pale, upright, seated dragon with half-open crystal wings, gold crescent
   horns): a low, wide dome on four legs vs a tall wedge; a cloud mane vs a smooth hide; folded vs
   half-open wings; no cyan, no crystal; ivory curls hidden in the mane vs gold crescents on top.
   **KK-1 gate (explicit):** a 1× side-by-side of grown idle f0 next to `crystal_wyrm` idle f0 on the
   board, read blind by a critic who has not seen this doc: "a cloud lion / round cloud dragon", never
   "a small crystal wyrm" (§9.1). Against the lane-mates (`venom_drake` dark leaf serpent,
   `ashen_drake` grey vulture): a light value, a round body, and the ring.

### 1.2 Frame, anchor, hover, weight
| | Baby | Grown |
|---|---|---|
| Frame (shared, REQUIRED equal) | **82×78** | **82×78** |
| Anchor (shared) | (40, 74) | (40, 74) |
| Hover | 0 (walker) | 0 |
| `weight` | `mediumLight` (hit-stop 40–60, shake 1–2, guard push 2/3/3) | `mediumHeavy` (80–110, 3 px, 1/1/2) |
| Feet (HA-9 rows) | y 74, x 34..46 | y 74, x 24..56 (four paws: hind 24..34, fore 44..56) |
| Bottom margin | 3 rows (Sİ-2 ≥ 2) | 3 rows |

- **Why the frame is shared:** the special's last frame is handed from the baby sheet to the grown sheet under the same frame name (§3.3). The sprite's size and origin come from the art, so `w`, `h`, `anchorX`, `anchorY` and `hover` must be identical for that hand-off to be Δ = 0.
- **Why 82 wide (revision 3):** 139 frames (§4) × 82 × 78 × 4 = 3.56 MB per side stays under the 3.6 MB `medium` cap; 84 wide would be 3.64 MB. The grown dome (≈ 58 wide, ring 48) leaves ≥ 4 px each side.

### 1.3 Ramps and materials (palette only: `src/art/palette.ts`)
| Part | Tones (light → dark) | Notes |
|---|---|---|
| Hide, near side (`hatchhide`) | `leaf4` (big calm lit plane), `leaf3`, `leaf2`, crease `leaf1` | `leaf4` stays the dominant lit plane on BOTH forms (the grown body must not drift toward the `storm_hawk` / `thorn_lurker` / `venom_drake` greens). Only the grown wing tips are more saturated (row below). |
| Hide, far side | `leaf3`, `leaf2`, `leaf1`, crease `leaf0` | `farShift: 1` |
| Hide rim light (IŞ-7) | `water4` (the sky's reflection) | The only rim colour on the hide. |
| Belly scutes | `earth4`, `earth3`, seams `earth2` | Seams only on the shadow plane (MA-2). |
| Cloud (cowlick, chest tuft, mane, ring, idle hiccup ring) | `white`, `mist`, `steel`, deepest `night4` | Puffs are ≥ 2×2 clusters, flat lobes, never dithered. |
| Eggshell | `skin4` (lit), `earth4` (mid), `earth3` (shadow), speckles `earth2` (2-px clusters on the shadow plane only), inner shell `skin3` | Hand-placed plates with `_L` / `_R` maps (IŞ-2). |
| Eyes | Baby: `night0` pupil, `gold3` iris ring, `white` 1-px catch-light. Grown: `gold3`/`gold4` eye, `night0` slit | Light pixels drawn after the outline (IŞ-9). |
| Mouth / tongue | `skin1`, `skin2` | No `crim` (player colour). |
| Claws, horn nubs | `skin3`, `skin4` | |
| Grown horns | ivory bands `skin4` / `earth4` / `earth3`, groove `earth2` | The spiral bands come from the normal (3 tones). |
| Grown wing tips (folded into the mane; opened only in roar / attack release / guard) | `leaf3` lit, `leaf2`, `leaf1` far; fingers `leaf3` | The only more-saturated plane of the grown form. It stays lighter than `venom_drake`'s leaf0–leaf2. Gate: on grown idle f0, `leaf4` ≥ 40 % of the hide pixels and the cloud tones (`white` / `mist` / `steel`) ≥ 35 % of all opaque pixels (counted in the art test). |

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
  silhouette: 'baby: an upright chick-shaped dragon whose round head is bigger than its pear body, a white cloud cowlick, a half eggshell riding the curled tail tip like a helmet, stubby wing nubs; grown: a low, wide, seated four-legged cloud lion-dragon whose huge cloud mane is its main mass, a short round muzzle, small ivory ram curls buried in the mane, wing tips folded into it, the shell band on the tail curled round its haunch and a cloud ring orbiting its waist',
  rhythm: 'comic hold-and-burst: a weeble wobble, long "ha… ha…" holds, then a 50 ms snap; the hits bounce and plop (it sits on its tail); grown: the same frame beats on its own, longer holds (stomps 80–90 ms, a 180 ms "ha…"), every landing heavy',
  idle: 'it wobbles like a weeble (one sway per loop), taps its shell on the floor twice, tries three quick wing flaps that fail, blinks, and every loop hiccups a tiny wind ring that drifts 4 px and pops; grown: the ring orbits, the mane drifts, the tail thumps, and it still hiccups once a loop: a fat ring escapes its big jaw (the one baby habit it kept)',
  guard: 'baby: crouched, wing nubs over the face, peeking with one eye, the shell-helmeted tail curled in front as a tiny shield; grown: lies down like a sphinx, the mane bristles, the cloud ring rises into a two-row puff wall around it',
  signaturePart: 'the eggshell on the tail tip (and the cloud ring of the grown form)',
  material: 'pastel mint hide (leaf4 calm plane), white / mist / steel cloud lobes, cream speckled eggshell, a water4 sky rim',
  signatureMove: 'Hıçkırık Halkası: cheeks puff, two hops, "ha… ha…", a sneeze that fires a whistling hollow ring of wind which squeezes the target and snaps with a ting',
};
```

**Nearest cards and how this differs**
| Card | What is near | Difference |
|---|---|---|
| `storm_hawk` (RÜZGAR, 48, light) | wind, small, green | no feathers, no dive (the sky-dive is the hawk's alone, YENI §5): ours sits, hops and sneezes; mint vs hawk green |
| `crystal_wyrm` (a pale, upright, seated dragon, half-open crystal wings, gold horns) | dragon, pale body (grown) | grown is a low wide dome on four legs with a cloud mane as the main mass and folded wings, not an upright wedge with open wings; no crystal, no beam, no cyan; ivory curls buried in the mane; a ring projectile, not a breath beam. Explicit 1× blind side-by-side gate (§1.1 item 7, §9.1) |
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
- **The key trick:** ONE pose table (`HatchPose` keyframes per anim), compiled twice with two hold tables, drawn by two shells.
  - **Frame counts and mark indices are identical** in both arts, by construction (one `AnimDef` list, one beat list; only the hold numbers differ). So every `atFrame(anim, f)` / `atMark` a cinematic uses means the same pose in both forms.
  - **Holds are per form** (critique 2, #9): `compileAnims(HATCH_DEFS, BABY_HOLDS)` and `compileAnims(HATCH_DEFS, GROWN_HOLDS)` (§4 gives both tables). The grown dragon does not keep the comic 60–70 ms hops; it stomps.
  - **The grown art has the full anim list** (critique 2, #2): its `drawExtra` for `summon`, `revive` and `special` calls the baby shell's draw (with the `DrawOpts` lighting passed through), and those three anims keep the baby holds. So `validateArt` sees every mandatory anim in both arts, `u.has('summon')` / `u.rangeMs('summon')` / `markFrame` work on a grown unit (the lane-D rewind needs them), and the grown sheet holds every frame name a grown unit can ever show.
  - The pose type carries `grow` (0 … 1). The shell's draw uses `age = shell.age ?? pose.grow`. The baby shell (`age` undefined) draws the growth special frame by frame from `pose.grow`; the grown shell (`age = 1`) draws the adult everywhere except in the three delegated anims.
  - So `special` f15 (in both arts: it is the same drawing) is **pixel-identical** to grown idle f0, and the hand-off is seamless.

### 3.2 Pose fields (`HatchPose`, sketch)
- **Body:** `hip [x, y]`, `squash` (−1 stretch … 1 squash: the hops / plops, drawn in pose, never `setScale`), `sway` (weeble lean, ±2 px at the head), `lift` (hop height in pose, px).
- **Head:** `head [dx, dy]` (relative to the chest, a follower), `headTilt`, `cheeks` (0 … 1 puff), `jaw` (0 … 1), `eye` (0 open / 1 squeezed / 2 X / 3 white-hot / 4 swirl), `blink`.
- **Cloud:** `cowlick` (sway phase), `tuft` (chest fluff bristle 0 … 1).
- **Wings and tail:** `wingN` / `wingF` `{ open, flap }`, `tailCurl`, `tailTap` (the shell knocks the floor), `shellTilt`.
- **Effects in the body:** `hiccup` (0 … 1: the jolt + the tiny ring in the frame), `ring` (the grown waist-ring orbit phase 0 … 1, `phase` field: it wraps per one-shot, HA-7).
- **Grown-only fields** (ignored by the baby shell): `mane` (bristle 0 … 1, drift phase), `foreN` / `foreF` (the planted forelegs: stomp lift in px), `wingTips` (0 folded … 1 opened out of the mane).
- **Story fields:** `grow` (0 … 1), `unAge` (0 … 1, the grown death's shrink back to the baby, §4.8; the grown shell draws `age = 1 − unAge`), `egg` (summon / death / revive: 0 = no shell … 1 = closed egg), `knit` (0 … 1, the death's knit lines), `float` (death f10–f12: the egg's rock ±1 px, the rim glint's position, the cloud lip's lobe phase), `burst` (the summon's shell pop), `tumble` (0 … 1, the somersault), `smearFrom` (release only).
- **Regions** (`REGION_IDS`): `head` = head + cowlick + jaw + horns, `chest` = body + belly + tuft, `wingN` / `wingF`, `lower` = legs / feet, `hips`, `tail` = tail + shell, `extra` = cloud ring + hiccup ring.

### 3.3 Showing the grown form permanently (the variant mechanism, additive)
**How the sheet machinery works today (read):**
- `MonsterUnit` (`src/duel/MonsterUnit.ts`) shows a `UnitSprite`. The anim keys are `mon:<id>:<anim>` (`monsterAnimKey`, used at 7 sites: lines 533, 551, 596, 667, 807, 820, 911), and every frame of those anims lives on the anim's own sheet `p1Key = mon:<id>`.
- `UnitSprite.syncSheet()` (`MonsterUnit.ts:186`) then swaps the texture to `unit.sheetKey`, keeping the frame name. It returns early unless the current texture is `p1Key` or `p2Key` (line 188), and when the target sheet lacks the frame name.
- That is how the P2 relight sheet `mon:<id>:p2` works (`applyFacing` → `monsterSheetKey`).
- `prepareMonsterSheet(scene, art, { key, draw }, boot)` (`src/art/textures.ts:894`) can register ANY MonsterArt under ANY key, lazily painted, and `createSheetAnims` (`textures.ts:362`) creates that key's own anim keys `<key>:<anim>` with the art's own holds. So `mon:cloud_hatchling:grown:<anim>` exists as soon as the grown sheet is prepared, with the grown holds.
- A non-registry art gets its own frame cache (`cacheOf` → `otherCaches`, a `WeakMap` per art object, `textures.ts:105-120`) and a grid sheet, because `cropsArt` needs registry identity (`textures.ts:96`). The pinned / LRU maps keyed by `frameKey = ${art.id}|anim|frame` (`textures.ts:141`) are used only for cropped arts, so a grown art with id `cloud_hatchling` never collides with the baby's frames **as long as it stays a grid art**. The registry's trimmed frames keep `realWidth / realHeight` = the full frame (`Frame.setTrim`), so a cropped baby frame and a grid grown frame of the same name place identically (the Δ = 0 film proves it).
- `textures.get(sheetKey)` runs `finishBase` for a pending sheet (`textures.ts:971-983`): it paints every base anim of that sheet on the spot. Any first touch of an unwarmed grown sheet is a synchronous paint (a freeze), so warming is part of the design (step 6).

**The plan.** It is additive: v1 and every unit without a variant take today's code path.
1. **`src/art/variants.ts` (new, generic, art-side only):**
   ```ts
   export interface MonsterVariant { name: string; art(): MonsterArt; when(slot: MonsterSlot): boolean }
   export function registerMonsterVariant(id: MonsterId, v: MonsterVariant): void
   export function slotVariant(id: MonsterId, slot: MonsterSlot): string | null   // null unless LOOK_V3
   export function variantArt(id: MonsterId, name: string): MonsterArt | null
   export function variantSheetKey(id: MonsterId, name: string, player: PlayerId): string // `mon:<id>:<name>` / `mon:<id>:<name>:p2`
   export function ensureVariantSheet(scene: Phaser.Scene, id: MonsterId, name: string, player: PlayerId): string
   //   prepareMonsterSheet(scene, art, { key, draw: player === 1 && art.p2 === 'relight' ? { lightFrom: 'right' } : undefined })
   //   once per key; returns the key (no paint here)
   export function warmVariant(scene: Phaser.Scene, id: MonsterId, name: string): void
   //   ensureVariantSheet for BOTH players, then warmMonsterSheet(key, every anim) on both keys, in background slices
   export interface RewindStep { anim: MonsterAnim; reverse: true }
   export function rewindAnims(id: MonsterId, variant: string | null): RewindStep[] // the cross-lane contract, step 8
   export function rewindSfx(id: MonsterId, variant: string | null): SfxName | null
   ```
   - The registration lives in `src/art/monsters-v3/cloud_hatchling-grown.ts`: `registerMonsterVariant('cloud_hatchling', { name: 'grown', art: () => cloudHatchlingGrown, when: (s) => monsterDef('cloud_hatchling').effect === 'jesterAging' && s.permAtk !== undefined })`. The `when` is keyed on the card's effect (critique 2, #19): today only `jesterAging` writes `permAtk` (`rules.ts:982-985`; `grep permAtk src/engine` finds no other writer), and the effect check keeps a future generic `permAtk` writer from growing the hatchling by accident.
   - The `monsters-v3` glob imports that file eagerly in both looks. That is harmless because `slotVariant` returns null unless `LOOK_V3`.
2. **`src/duel/unit-variant.ts` (new, owned by this card, generic):** everything that is not a hook in `MonsterUnit`.
   - `variantOf(u): string | null`: a `WeakMap<MonsterUnit, string>`. Cinematics test `variantOf(u) === 'grown'`.
   - **`uidVariants`: a `WeakMap<Phaser.Scene, Map<Uid, string>>`** (critique 2, #3: the variant must be known when a unit is BUILT, not at the next sync). It is written by `FieldView.sync` (step 5) from the state it syncs, and by the growth hook just before the swap. A rematch on the same scene is safe because every sync rewrites the map from its state first.
   - `setUnitVariant(u, name)`: upgrade-only (a unit that has a variant is never set back to null; the variant is permanent until the unit retires). It records the uid, calls `warmVariant`, stores the name, then `u.setArt(variantArt(...))`.
   - Installs, inside `if (LOOK_V3)`, at module load:
     - `MonsterUnit.sheetFor = (u) => { const v = variantOf(u); return v ? ensureVariantSheet(u.scene, u.cardId, v, u.player) : null; }`
     - `MonsterUnit.animKeyFor = (u, anim) => { const v = variantOf(u); return v ? sheetAnimKey(variantSheetKey(u.cardId, v, 0), anim) : null; }` (the P1-lit grown sheet's anim keys; `syncSheet` moves the texture to the P2 grown sheet like today)
     - `MonsterUnit.onBuilt = (u) => { const v = uidVariants.get(u.scene)?.get(u.uid); if (v) setUnitVariant(u, v); }`
   - `unitFrame(u, anim, f)`: `artFrame(u.art, anim, f, u.sheetKey.endsWith(':p2') ? { lightFrom: 'right' } : undefined)`. The one helper every "read the unit's current pixels" site should use (step 7). For a unit without a variant it returns exactly `monsterFrame(u.cardId, anim, f, opts)`, because `u.art === monsterArt(id)` and `cacheOf` returns the same cache.
   - `unitSheetKey(u)`: `u.sheetKey` (exported for the warm sweep, step 6).
3. **`src/duel/MonsterUnit.ts`: the minimal hooks (≈ 14 lines, all no-ops for a unit without a variant):**
   - `static sheetFor?: (u: MonsterUnit) => string | null;` and in `applyFacing`: `const key = MonsterUnit.sheetFor?.(this) ?? monsterSheetKey(this.cardId, this.player);`.
   - `static animKeyFor?: (u: MonsterUnit, anim: AnyMonsterAnim) => string | null;` and a private `animKey(anim)` = `MonsterUnit.animKeyFor?.(this, anim) ?? monsterAnimKey(this.cardId, anim)`, used at the 7 `monsterAnimKey(this.cardId, …)` sites (play, pose, `has` checks, `hitAnimOfKey`). The grown unit then plays its own anim keys with the grown holds (critique 2, #9).
   - `static onBuilt?: (u: MonsterUnit) => void;` called once as the last line of the constructor (after the first `applyFacing`). Every construction path (`FieldView.addUnit` from a flip / a hat reveal / a recipe, `placeMonster`, `sync`) then shows the grown form from its first frame (critique 2, #3).
   - `setArt(art: MonsterArt)`: `art` loses `readonly`; `setArt` assigns it, re-keys the drop shadow from the new idle 0 bounds (`this.shadow.setTexture(shadowKey(scene, rx))`; `shadowKey` stays module-private), then `applyFacing()`. Then `u.art.points`, `u.art.weight` (hit-stop / shake / guard push via `motion.ts`), `animSpec(u.art, …)` (the grown holds), `rangeMs`, `markFrame` and `u.art.muzzle` / `core` follow the grown body.
   - `ownsKey(k)`: `k === this.p1Key || k === this.p2Key || k === this.sheetKey || k === this.animSheetKey`, where `animSheetKey` is the texture the unit's anim keys point at (the grown P1 key for a grown unit, `p1Key` otherwise).
   - `UnitSprite.syncSheet`: the guard becomes `!u.ownsKey(cur)`. On a held pose (no anim ticking), a control change then moves the sprite from the P1-lit grown sheet to the P2-lit grown sheet.
   - **No fallbacks are needed any more** (revision 2 had a `syncSheet` base-key fallback and a `setFrame` switch to `p1Key`; both are dropped): the grown sheets hold every frame name, and the hand-off frame `special_15` exists on all four sheets.
   - `worldPoint('top')` (line 512): `artFrame(this.art, 'idle', 0).bounds()` instead of `monsterFrame(this.cardId, …)` (identical for every other unit, by the `cacheOf` reason). The stat beat's number then sits on the grown crown.
4. **Why not a texture swap under the baby's anim keys (revision 2's plan):** it forced identical holds (a re-skinned baby), a grown art without `summon` / `revive` / `special` (fails `validateArt`, breaks `u.has()` for the rewind), and the two fallbacks above. Own anim keys cost one hook (`animKeyFor`) and remove all three problems.
5. **`src/duel/FieldView.ts` `sync` (two lines):**
   - at the top: `if (LOOK_V3) syncUidVariants(this.scene, state);` (rewrites the uid map: every face-up monster slot with a `slotVariant` → its name; every other uid is dropped, so a re-summoned / revived hatchling, a new slot without `permAtk`, is a baby again);
   - after `const u = e.unit!;`: `if (LOOK_V3) { const vn = slotVariant(cardId as MonsterId, slot); if (vn && variantOf(u) !== vn) setUnitVariant(u, vn); }` (upgrades a unit that existed before the growth, e.g. when the growth hook was skipped).
   - A unit created later by a cinematic in the same batch (a `magic_hat` reveal of a grown slot: `hideBehindHats` keeps the slot object and its `permAtk`, `rules.ts:632-640`; the reveal goes through `summon-b/flip.ts:191` / `_defaults/summon.ts:186` → `FieldView.addUnit`) reads the uid map in `onBuilt`: it is grown on its very first frame. Scenario `kaChGrownHat`.
6. **Warming (critique 2, #11; every grown sheet is painted in the background before anything shows it):**
   - `warmVariant` warms BOTH players' grown sheets (a later control change by `puppet_string` shows the other one) at three moments: the coin call (§5.6 observer), the growth hook's start, and `setUnitVariant` (for a unit grown by a sync after a reload).
   - The existing warmers `src/cinematics/_v3/warm.ts:26` (`warmPoses`) and `src/cinematics/spells/_blade_v3.ts:371` (`warmBond`) warm `monsterSheetKey(id, player)`, the baby sheet. They join the step-7 sweep: `unitSheetKey(u)` instead (identical for every other unit).
   - Checked without `?test`, where sheets paint lazily: `sheetPaintStats()` after `kaChGrownControl` / `kaChGrownResync` / `kaChGrownHat` shows no synchronous base paint of a grown key during a cinematic (§9.3).
7. **`src/cinematics/_core/project.ts` `applyEvent` (a PRECONDITION, not optional; ask the orchestrator):** in `case 'activate'`, before the `monsterEffect` early return (`project.ts:115`), when the activating card's effect is `jesterAging` and its slot is face up without `permAtk`, set `permAtk = 1200` and `permDef = 800` on the slot. This mirrors `rules.ts:982-985`, which is the reducer's stated job.
   - Why it is required: `applyEvent` ignores `activate`/`monsterEffect` and `statChange` (`project.ts:132`), and nothing sets `permAtk`. After every top-level event `Director.syncFrontier` (`Director.ts:125`) syncs the projected snapshot. Without the fix that snapshot says "no permAtk": `FieldView.sync` calls `setStats(1100)` (the badge rolls back after our stat beat) and the uid map loses `grown` for the rest of the batch (a hat reveal or a rebuilt unit later in the batch would be a baby).
   - **`stateDiff` does not compare `permAtk` / `permDef` / `boostAtk`** (`project.ts:321-344`: lp, hand, deck, graveyard, monster uids, faceUp / position, spell-traps, field, phase, turn, active, winner). So the missing projection never shows as "projection drift" in the console, and a "stateDiff is empty" test proves nothing (critique 2, #14). The test asserts the projected slot directly (§9.4), and the film checks the badge (§9.3).
   - Lane B's `hollow_ogre` (`boostAtk`) has the same projection gap. Ask the orchestrator for ONE `project.ts` change covering both, optionally with `permAtk` / `permDef` / `boostAtk` added to `stateDiff` (debug only).
8. **One sweep over the call sites that still read baby pixels or the baby voice by card id** (ask the orchestrator to swap them all in one pass; each swap is byte-identical for every other unit):

   | Call site | Swap | When it matters |
   |---|---|---|
   | `src/cinematics/strikes-a/_kit.ts:232,235` `currentPixels` | `unitFrame` | lane-A strikes that overlay the TARGET's current pixels (freeze, cool, crack) |
   | `src/cinematics/strikes-b/_kit.ts:164,188,213` `framePixelsOf`, `glintPoint`, `worldBox` | `unitFrame` | lanes B and C use them on targets |
   | `src/cinematics/traps/_chains.ts:364,400` | `unitFrame` | Işık Zincirleri binding a grown attacker |
   | `src/vfx/shatter.ts:105,116,136` (+ the P2 test at 138 / 484 by `monsterP2TextureKey`) | `unitFrame` + a variant suffix on the `shatter:<id>:…` cache key | any kit death that shatters a grown unit (lane D's, a spell's) |
   | `src/cinematics/_v3/death.ts:110` `bodyPixels`, `breakBody` | `unitFrame` | the kit death; our own death never calls it (§5.5), but `sourceOwnsDeath` hands some deaths to other code |
   | `src/cinematics/_v3/warm.ts:26`, `src/cinematics/spells/_blade_v3.ts:371` | `unitSheetKey(u)` | warming the sheet the unit really shows (step 6) |
   | `src/cinematics/traps/_mirror_v3.ts:1574`, `src/cinematics/traps/chains_of_light.ts:560` `soundsOf(u.cardId).charge` | `soundsOfUnit(u)` | a grown attacker intercepted by Mirror Force / the chains: `takeCharge` stops a held sound whose name differs (`_v3/sound.ts:267`), so the baby sniff would replace the held grown inhale |
   | `src/cinematics/_v3/death.ts:347,416` `soundsOf(u.cardId)` | `soundsOfUnit(u)` | kit deaths of a grown unit (lane D's wipe) use the grown death voice (§6.2) |
   | `src/cinematics/_v3/sound.ts:250-251` `holdCharge` | `soundsOfUnit(u)` | the declaration's held inhale |
   | `src/duel/warm.ts:82-92` | none | warms the baby shatter only; a grown unit's shatter is made on use (~0.3 ms) |
   | `src/view/light/glow.ts:98`, `LightLayer.ts:856,1009` | none (phase 1) | halo sheet / pool radius from baby idle 0. Phase 1: no emissive (§1.5); the pool is a little small for the grown body |
   | `src/cinematics/_v3/summon.ts:69`, `_v3/card.ts:201`, `duel/auras-v3.ts:277` | `unitFrame` | summons are always baby; auras are rare (equip on a grown unit) |

   Until the sweep lands, these films must be checked: `kaChGrownChains`, `kaChGrownMirror`, `kaChGrownEquip`, `kaChGrownVoid`, and the `venom_drake` strike on a grown target (§8.5).
9. **The cross-lane rewind contract (lane D, through the orchestrator).** Lane D's "bildi / bilemedi" rewinds every destroyed monster by playing its own summon in reverse (YENI C2 §4–5). An opponent's jester win destroys OUR grown hatchling. The contract: lane D calls `rewindAnims(u.cardId, variantOf(u))` and plays the steps in order **on the unit's own anim keys** (`u.pose(anim, f)` going backward, which goes through `animKeyFor`):
   - no variant: `[{ anim: 'summon', reverse: true }]` (today's behaviour);
   - `grown`: `[{ anim: 'special', reverse: true }, { anim: 'summon', reverse: true }]`. Both anims exist on the grown sheet (step 3: the full anim list), so `u.has()` / `u.rangeMs()` / `u.frameCount()` work. The special reversed is the un-aging: grown → baby; its f15 = grown idle f0, so the first frame does not pop. Then the baby folds back into the egg.
   - `rewindSfx(id, variant)` returns `'hatchVoiceCrackRev'` for a grown hatchling (§6.2: the roar climbing back up into a squeak). Lane D plays it if it wants a per-victim voice; nothing breaks if it does not.
10. **The growth cinematic** calls `setUnitVariant(u, 'grown')` itself, at the end of special f15 (§5.6).

### 3.4 Files
| File | Role |
|---|---|
| `src/art/monsters-v3/cloud_hatchling.ts` | default export: the baby `MonsterArt` (`toMonsterArt(compileAnims(HATCH_DEFS, BABY_HOLDS), babyShell)`), `weight: 'mediumLight'`, `p2: 'relight'`, consts `W = 82, H = 78, AX = 40, GY = 74`, the `DISTINCTION` block, re-exports for card art / cinematics (`HATCH_MOUTH`, `framePose`) |
| `src/art/monsters-v3/cloud_hatchling-rig.ts` | skeleton + `drawHatch(p, pose, light, at, age)`: the shared draw for both shells (body, head, cheeks, limbs IK to the fixed feet `ik2`, tail chain `chain`, wings, eyes) |
| `src/art/monsters-v3/cloud_hatchling-parts.ts` | hand pieces: eggshell plates `_L` / `_R`, the zigzag rim, the shell `CrackStyle` + crack lists (summon wobble cracks, death knit lines), cloud lobe primitive (`cloudLobes(r, cx, cy, n, phase)`), horn spiral bands, the grown waist ring (`ringPuffs(phase)`: the 12 puff centres, back / front halves; exported so the growth's falling hour-puffs land on exactly these pixels), the tiny hiccup ring |
| `src/art/monsters-v3/cloud_hatchling-anims.ts` | `definePose` kit, every `LoopDef` / `AnimDef` (§4, one list for both forms), `BABY_HOLDS` / `GROWN_HOLDS` (§4 tables; a unit test asserts equal frame counts and marks), `points()`, `joints()` (sameness) |
| `src/art/monsters-v3/cloud_hatchling-grown.ts` | **named export only** `cloudHatchlingGrown` (no default: the registry glob skips modules without `default.id`). It is `toMonsterArt(compileAnims(HATCH_DEFS, GROWN_HOLDS), grownShell)` with the FULL anim list (its `drawExtra` delegates `summon` / `revive` / `special` to the baby shell, lighting passed through), `weight: 'mediumHeavy'`, plus `registerMonsterVariant(...)` |
| `src/art/monsters-v3/_cloud_hatchling_grown.ts` | `export default cloudHatchlingGrown`: for `monster-sheet --art` / `sameness --art` only (the `!_*.ts` glob keeps it out of the registry) |
| `src/art/variants.ts` | the variant registry + `rewindAnims` / `rewindSfx` contract (§3.3) |
| `src/duel/unit-variant.ts` | `variantOf`, `setUnitVariant`, `uidVariants` + `syncUidVariants`, `unitFrame`, `unitSheetKey`, the `MonsterUnit.sheetFor` / `animKeyFor` / `onBuilt` installs (§3.3) |
| `src/art/materials/defs/hatchhide.ts` | MaterialDef `hatchhide` (status draft, firstUser `cloud_hatchling`): leaf ramp (§1.3), `rim: PAL.water4`, `texture: { kind: 'scales', density: 4 }` (on mid / shadow only), `hit.sparks [mist, white, leaf4]`, `death { shatter: 'plant', accent: 'light' }` (unused by our own death; it keeps the tables honest), `sound: { same: 'cloth' }` (phase 1, §6.5) |
| `src/art/cardart-v3/cloud_hatchling.ts` | card art (§7) |
| `src/presentation/cards/cloud_hatchling.ts` | the recipe (§8.2) |
| `src/cinematics/strikes-a/cloud_hatchling.ts` | `registerStrike` (Hıçkırık Halkası, all outcomes, baby / grown) + `registerCardHook('destroyed')` (egg float) |
| `src/cinematics/strikes-a/cloud_hatchling-grow.ts` | `registerCardHook('effect')` (the growth) + `registerObserver` (warm both grown sheets when a coin call opens; the staring loop on `coinToss`, §5.6) |
| `src/cinematics/strikes-a/cloud_hatchling-fx.ts` | drawing helpers (no top-level registration): `windRing` (iso-derived point tables, P1 + mirrored P2, §5.2), `ringShards`, `dustDashes`, `grassPatch` (the flattened-grass annuli, §5.2), `cloudPuff`, `cloudShadow` (an ink 2×2-dither ellipse raster at `DEPTH.SHADOW`, the `MonsterUnit.shadowKey` algorithm, resized in whole px), `eggFloat`, `eggScatter` (the float's final break-up from `unitFrame(u, 'death', 12)`), `skyDial` (puff rim, wind-streak hands, the stepped `mist` sweep wedge, falling hour-puffs), `spiralMotes` |
| `src/cinematics/summon-a/cloud_hatchling.ts` | `signatureSummon('cloud_hatchling', …, { v3: eggDropV3 })` |
| `src/audio/v3/hatchling.ts` | `V3_HATCH_RECIPES`, `HatchSfxName`, `HATCH_SUSTAINED` (§6) |
| `src/duel/scenarios/kart_a_cloud_hatchling.ts` | filming scenarios (§8.5) |
| `src/dev/previews/hatchling.ts` | `?dev=hatchling[&mode=sheet\|board\|swap\|rewind][&p2=1]`: both forms side by side; `swap` plays special → `setUnitVariant` → idle on a live unit; `rewind` plays `rewindAnims` on a grown unit (the lane-D contract); `wyrm` puts grown idle f0 next to `crystal_wyrm` idle f0 at 1× (the KK-1 blind gate) |
| `tests/art/cloud_hatchling.test.ts`, `tests/art/variants.test.ts` | §9.4 |

---

## 4. Animations

Every one-shot ends on idle f0 (guard f0 for toGuard). `compileAnims` appends that end frame to EVERY one-shot whose `end !== 'hold'` (`rigkit/anim.ts:172,190`), and its hold is `endMs` (default: the last beat's hold). `death`, `special` and `victory` are `end: 'hold'`, so nothing is appended to them.
- **Every frame count below includes the appended end frame** ("beats + end").
- **Two hold tables, one frame structure** (§3.1): every anim has the same frame count and the same mark indices in both forms; the grown column gives its own holds. `summon`, `revive` and `special` are drawn by the baby shell in both arts and keep the baby holds.
- Every table was checked against `src/art/rigkit/validate.ts`: HA-2 (40–200 ms; only victory's held last frame longer), HA-1 (attack / roar / special: charge < release = impact < recover; hits and death: impact = contact = f0; death: dissolve), HA-3 (attack: the longest frame is an anticipation frame; attack / special release ≤ 70 ms; attack / roar / special recoveries never shorten, end frame included), HA-4 (hits: f0 40–60, f1 40–70, recover starting at 240–370 ms, recovery holds 70–150), HA-29 (transitions 5–7 frames, ≤ 400 ms), §4.9 normal tier (death ≤ 900 ms).
- The hit family stays inside the REHBER §4.9 references (hit 0.50–0.59 s, hitHeavy ≈ 0.68–0.74 s, hitMagic ≈ 0.61–0.66 s) in the grown form; the baby's hitHeavy / hitMagic are a little quicker (a light body), still inside HA-4.
- Totals: **139 frames per form** (≤ 140, KK-13): 82 × 78 × 4 × 139 = **3.56 MB per side**. Four sheets ≈ 14.2 MB (well under the 64 MB pair cap; the grown sheets are grid sheets, `cropsArt` stays registry-only, §3.3).
- Gate class: `--class medium` (3.6 MB), justified by the 64 spill (YENI C3).
- Tier: **normal** (REHBER §4.9). Every count meets or exceeds the normal column.

| Anim | Frames (beats + end) | Baby ms | Grown ms | Marks | Grown pose |
|---|---|---|---|---|---|
| idle (loop) | 18 (loop) | 1890 | 1990 | — | ring orbit, mane drift, the fat-ring hiccup |
| guard (loop) | 8 (loop) | 1200 | 1360 | — | sphinx crouch, ring wall |
| toGuard / fromGuard | 4 + 1 / 4 + 1 | 370 / 370 | 400 / 400 | — | |
| attack | 13 + 1 | 1200 | 1470 | charge 1, release = impact 8, recover 10 | forepaw stomps, big ring |
| roar | 9 + 1 | 1100 | 1210 | charge 1, release = impact 4, recover 6 | full roar, wing tips out |
| hit | 5 + 1 | 530 | 570 | impact = contact 0, recover 3 | |
| hitHeavy | 6 + 1 | 610 | 700 | impact = contact 0, recover 4 | |
| hitMagic | 6 + 1 | 590 | 660 | impact = contact 0, recover 4 | |
| summon | 13 + 1 | 1390 | (= baby) | land 2 | delegated to the baby shell (rewind, §3.3 step 9) |
| death | 13 (hold) | 890 | 900 | impact = contact 0, dissolve 4 | un-ages into the baby's ball, the SAME small egg (§4.8) |
| revive | 10 + 1 | 1110 | (= baby) | land 5 | delegated to the baby shell |
| special (growth) | 16 (hold) | 1770 | (= baby) | charge 1, release = impact 13, recover 15 | delegated (it draws the growth) |
| victory | 5 (hold) | 830 | 910 | — | §4.11 (played by `_blade_v3.ts:351` bond pose and `v3small/end.ts:780`) |
| **total** | **139** per form | | | | |

**Hold tables** (ms per frame, end frame last):
| Anim | Baby | Grown |
|---|---|---|
| idle | `130 120 110 110 120 90 80 80 90 140 70 120 110 70 60 90 120 130` | `140 130 130 120 120 100 100 100 100 140 80 130 110 80 70 90 120 130` |
| guard | `170 150 140 150 170 150 130 140` | `190 170 160 170 190 170 150 160` |
| toGuard, fromGuard | `60 70 80 90` + 70 | `70 80 90 100` + 60 |
| attack | `80 90 70 60 70 60 160 50 60 80 90 100 110` + 120 | `100 120 90 80 90 80 180 60 70 100 110 120 130` + 140 |
| roar | `80 120 110 160 90 120 90 100 110` + 120 | `100 130 120 180 90 130 100 110 120` + 130 |
| hit | `50 70 120 100 110` + 80 | `50 70 130 110 120` + 90 |
| hitHeavy | `50 60 80 100 110 130` + 80 | `60 70 100 110 120 140` + 100 |
| hitMagic | `50 50 70 90 110 140` + 80 | `60 60 90 110 120 140` + 80 |
| death | `50 60 90 100 · 70 70 70 70 70 80 · 50 60 50` | `60 70 80 100 · 70 70 70 70 80 80 · 50 50 50` |
| victory | `90 100 110 130 400` | `110 120 130 150 400` |
| summon, revive, special | §4.7, §4.9, §4.10 | same as baby |

### 4.1 idle: 18 f, 1890 ms (YENI: 18 f; wobble, shell taps, flap attempts, hiccup ≈ every 3 s)
Holds: `130 120 110 110 120 90 80 80 90 140 70 120 110 70 60 90 120 130` (1890 ms, inside the REHBER normal 1.6–2.0 s). It lingers at the ends of the sway; the blink and hiccup frames are short.
- **Sway (body, period 18):** weeble lean right f0–f4, centre f5–f8, left f9–f12, back to centre f13–f17. The head lean is ±2 px, the hips stay put. The feet are fixed (HA-9).
- **Followers (HA-6):** the head is +1 frame behind the body, the cowlick +2, the chest tuft +2, the far wing nub +1 behind the near one.
- **Tail tap (period 9):** the shell knocks the floor on f2 and f11, each with a 1-frame 1-px rebound.
- **Flap attempt (once per loop):** three quick nub flaps f5–f7 (each 1 px up), then the nubs droop on f8.
- **Blink:** f10 (1 frame, 70 ms).
- **Hiccup:** f13 is the jolt (whole body 1 px up, eyes wide). On f14 a tiny wind ring (**4×6**, so its hole is 2 px and reads at 1×; `mist` rim + `white` lead, light pixels) leaves the mouth. On f15–f16 it drifts 2 + 2 px forward and pops (1 px dots).
- **Grown, same frames, own holds:**
  - the sway becomes a slow weight shift of the chest over the planted forelegs;
  - the tail tap becomes a heavy tail thump (f2, f11) against the haunch;
  - the flaps become one mane ruffle over f5–f8: the folded wing tips lift 1 px out of the back lobes and settle;
  - **the baby habit it kept (bold idea):** f13 is the same hiccup jolt (the whole body 1 px, the cheeks puff), and on f14 a **fat ring** (6×10, 2-px band, hole 2×6) escapes the big jaw and drifts 3 + 3 px on f15–f16 before it pops into four 2-px puffs. It costs no extra frame: the grown hiccup is drawn on the frames the baby hiccups on;
  - the **cloud ring advances 1/36 turn per frame** (critique 2, #7). The 12 puffs are identical and 3 frames apart, so the ring's pixel pattern repeats every 3 frames, the motion direction is unambiguous (each puff moves ⅓ spacing, ≈ 4 px on the near side, per frame), and the 18-frame loop wraps exactly (½ turn = 6 spacings, HA-7). The worst deviation from f0 is ⅓ spacing (HA-21 phase gate). One-shots move the ring only in whole-puff steps (1/12 turn), or not at all. The mane drifts with a +2 lag. **Check the direction on a ×3 strip** (§9.1) before any other anim is drawn.
- **Sheet checks:** HA-18 ≥ 15 % (target ≈ 18 %); HA-17 ≤ 1.8 (the hiccup jolt is a 1-px whole-body shift, so keep it to ONE frame); seam ≤ 1.4; IŞ-10 noise idle mean ≤ 10 % (the cloud lobes are the risk, keep them ≥ 2×2).

### 4.2 guard: 8 f, 1200 ms
Holds: `170 150 140 150 170 150 130 140`. Each frame moves ONE part, in this cycle: breath (chest 1 px) → the peeking eye blinks → the tail shell shifts 1 px → the nubs twitch → back.
- Baby: crouched low, nubs over the face, one eye peeking between them, the tail curled in front with the shell held like a tiny shield.
- Grown: lies down like a sphinx, forelegs forward, the mane bristling. The cloud ring rises from the waist to the shoulders and thickens into a puff wall (two puff rows); the muzzle peeks over it. Guard Δ / idleΔ target 0.45 (HA-19 0.3–0.8).

### 4.3 toGuard / fromGuard: 4 beats + end each, 370 ms baby (`60 70 80 90` + 70) / 400 ms grown (`70 80 90 100` + 60)
- toGuard: duck → nubs come up (in-between at the half lift, HA-13) → tail swings in front → shell set → (end) guard f0.
- fromGuard is the reverse, ending on idle f0.
- Feet fixed, `dx = 0`. HA-20 will probably trigger (the guard differs a lot from idle), so the transitions are mandatory.

### 4.4 attack "Hıçkırık Halkası": 13 beats + end, 1200 ms baby / 1470 ms grown
| f | ms baby / grown | Beat | Pose (baby) | Pose (grown) |
|---|---|---|---|---|
| 0 | 80 / 100 | — | leans toward the target, eyes on it | head lowers into the mane, eyes narrow |
| 1 | 90 / 120 | **charge** | cheeks puffed big (the declaration holds THIS frame: `declarePoseFrame`), chest up | chest swells, mane bristles |
| 2 | 70 / 90 | — | hop 1 up (4 px lift in pose, feet tucked) | stomp 1: near forepaw up |
| 3 | 60 / 80 | — | hop 1 land, squash | stomp 1 down (1-px squash, the mane lobes bounce +1 frame late) |
| 4 | 70 / 90 | — | hop 2 up | stomp 2: far forepaw up |
| 5 | 60 / 80 | — | hop 2 land | stomp 2 down |
| 6 | **160 / 180** | — | "ha… ha…": head thrown back, eyes squeezed, nostrils flare (the longest wind-up frame, HA-3) | head back, the jaw opening, the ring's air visible at the lips, wing tips lift out of the mane |
| 7 | 50 / 60 | swing | head snaps forward (no smear) | |
| 8 | 60 / 70 | **release = impact** | "CHOO!": mouth wide, the ring leaves `muzzle`; 2-px smear behind the head (HA-12) | the same, the wing tips flare |
| 9 | 80 / 100 | follow | blown back by its own sneeze, sits on its tail ("plop") | rocks back on its haunches |
| 10 | 90 / 110 | **recover** | dazed: swirl eyes, cowlick bounced | shakes its mane (the lobes lag +1) |
| 11 | 100 / 120 | — | shakes its head, nose twitch | the wing tips fold back |
| 12 | 110 / 130 | — | gets up | breath |
| end | 120 / 140 | — | idle f0 | |

- charge → release: baby 560 ms, grown 700 ms. The hops / stomps are in it, which is the comic (baby) and the weight (grown) point. The grown attack is longer; §5.2 shows it still fits.
- In-pose motion only (HA-11). The forward travel of the hops / stomps is the cinematic's, in whole px (§5.2).
- `validateArt(art, { tier: 'normal', attack: 'projectile' })`: the contact belongs to the cinematic, so no `contact` mark.

### 4.5 roar: 9 beats + end, 1100 ms baby / 1210 ms grown ("Cıyak": the baby's squeak; used by the position change / generic beats)
- Holds: §4 table; charge 1, release = impact 4, recover 6; the recovery lengthens to the end frame (HA-3).
- Baby: inhale, wing nubs up → on tiptoe with nubs spread (f3, 160) → beak-wide squeak with a tiny air puff (f4) → loses its balance, wobbles (f6–f8) → settles.
- Grown: rises onto its forelegs, the mane flares, the wing tips come out of it, a roar with the jaw wide, the ring flaring outward 2 px on f4–f5.

### 4.6 hit (5 + end), hitHeavy (6 + end), hitMagic (6 + end); holds in the §4 table
- **hit:** 530 ms baby / 570 ms grown (reference 0.50–0.59 s); the recover (f3) starts at 240 / 250 ms (HA-4: revision 2 had 190 ms). f0: the head snaps back, eyes squeezed. Only the head and chest move (HA-21 < 50 %, target ≈ 38 %). f1 is the in-between (HA-22). The cowlick flips +1 frame late.
- **hitHeavy:** 610 ms baby / 700 ms grown; recover f4 at 290 / 340 ms.
  - Baby: knocked onto its bottom, rolls back half a turn in pose (the feet leave the floor, HA-9 allows it while airborne), rocks up.
  - Grown: the forepaws skid back 1 px in pose, the haunches take the load, the mane lobes swing +1 frame late, a step forward.
  - `knock: 'pose'`, `poseKnockPx [1, 2, 3]`.
- **hitMagic:** 590 ms baby / 660 ms grown; recover f4 at 260 / 320 ms. Static: every cloud lobe stands on end (the tuft, the cowlick), the eyes go white, the body goes stiff with a 1-px tremble (wings 1 frame late), then the fluff falls flat.
- All three exist in both forms. Grown: the whole mane stands on end in hitMagic (the biggest cloud read of the card).

### 4.7 summon: 13 beats + end, 1390 ms (`land` 2), drawn by the baby shell in both arts, `hologram: false`
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

### 4.8 death: 13 f (hold), 890 ms baby / 900 ms grown (`impact` = `contact` 0, `dissolve` 4 at 300 / 310 ms)
Holds: §4 table. Frames f10–f12 are the **float frames** (critique 2, #6): the cinematic translates the sprite only while they play (HA-11), so the float is never a held frame being moved.
| f | Pose (baby) | Pose (grown: "it was always the baby", bold idea) |
|---|---|---|
| 0 | struck (continues hit f0 / hitHeavy f0 / hitMagic f0 per `posematch`) | struck (grown) |
| 1 | recoil | recoil |
| 2 | tumbles back | curls into a big ball, the mane wrapping it |
| 3 | curls into a ball (the tail wraps, the head tucks) | **un-age 1** (`unAge` ⅓): the mane and the waist ring peel off as loose cloud lobes that sink to the floor; the ball shrinks a third |
| 4 | **dissolve**: the ball rocks; shell plates rise from the floor around it and the knit lines start (`knit` 0.25: 1-px `mist` stitch lines between the plates) | **un-age 2** (⅔) + dissolve: the ball shrinks again, the horn curls draw in; the plates rise, knit 0.25 |
| 5 | knit 0.5 | **un-age 3** (1): the baby's curled ball, exactly the baby's f5; knit 0.5. The loose cloud lobes gather under it |
| 6 | knit 0.75 | knit 0.75 (from here the baby frames, plus the gathered cloud under the egg) |
| 7 | the egg closes | the SMALL original egg closes |
| 8 | the seams vanish and the shell rim glint shows (the anim's one glint) | same |
| 9 | the egg lifts 1 px (the lift-off anticipation) | same; the gathered cloud is the float cloud (the years carry it away) |
| 10 | **float A**: the egg rocks −1 px, the rim glint slides 1 px along the rim, the in-frame cloud lip's lobes shift a phase | same |
| 11 | **float B**: the egg upright, the glint at the rim's top, lobes phase 2 | same |
| 12 | **float C**: the egg rocks +1 px, the glint fades to `skin4`, lobes phase 3: the last frame the sprite shows | same |

- The float frames are played by the cinematic as a ping-pong cycle (f10 → f11 → f12 → f11 → f10 → f11, about 50 ms each) while the sprite rises (§5.5). Each step is a real pose change (the egg rock, the glint, the lobes), so the translation never moves a still picture.
- The grown death no longer knits a BIG egg (revision 2): the dragon un-ages back into the baby over three frames and the small original egg knits shut. The loose mane / ring cloud becomes the cloud that carries it off, so the grown death adds a story beat instead of a bigger copy.
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

### 4.10 special "Büyüme" (the growth): 16 f, 1770 ms, `end: 'hold'` (ends on the GROWN idle f0)
Holds: `120 120 120 100 100 160 | 85 85 120 85 85 120 | 90 70 180 130`. Marks: charge 1, **release = impact 13** (the roar peak, 70 ms), recover 15.
- Revision 2 put `release` on f6 (85 ms) and `impact` on f13. `validateArt` refuses both: HA-1 needs `impact = release` for a special, and HA-3 needs the special's release ≤ 70 ms. The growth frames are therefore not marks; the cinematic drives them with `atFrame(special, 6 … 11)` (SE-1 holds the same way).
- f0–f2 form the **staring cycle** (critique 2, #1): three poses that loop cleanly as f0 → f1 → f2 → f1 → f0 at ≈ 120 ms each, used by the coin observer and the dial build (§5.6), so the hatchling is never a held still frame while it waits.
- The six growth frames get 85 ms each (≈ 115 ms game) and the two big changes, f8 (the muzzle and chest) and f11 (the mane and the ring), get 120 ms, so the growth reads as six steps at 1×, never a pop.

| f | `grow` | Pose |
|---|---|---|
| 0 | 0 | stare A: looks up, eyes wide, cowlick up, mouth closed |
| 1 | 0 | **charge**, stare B: the eyes track 1 px, the cowlick bobs up 1 px, the mouth opens a crack |
| 2 | 0 | stare C: a blink half-closed + a 1-px hiccup jolt of the chest |
| 3, 4 | 0 | tremble L / R (1 px) |
| 5 | 0 | hunched, every cloud lobe bristling (the longest pre-growth hold) |
| 6–11 | ⅙ … 1 | **the six growth frames**, one part each: f6 the body swells and widens, f7 the legs lengthen and the forelegs plant (it drops onto four legs), f8 the muzzle broadens and the chest deepens, f9 the horns sprout and curl, f10 the wing nubs grow into wing tips and fold into the back, f11 the mane bursts out of the cowlick over the shoulders + the waist ring is complete. The sprite frames f6–f10 have NO ring: its puffs arrive as the cinematic's falling hour-puffs (§5.6), and f11's baked ring sits on exactly their pixels (`ringPuffs(0)` at the grown body's `framePoint`s) |
| 12 | 1 | head rises out of the mane (roar charge) |
| 13 | 1 | **release = impact**: the ROAR peak, jaw wide, the wing tips flare, the mane stands out (70 ms) |
| 14 | 1 | roar hold (180 ms) |
| 15 | 1 | **recover**: settles to **exactly** the grown idle f0 pose |

- Gate exception (record it in the art file and the critique notes): out(special) is measured against the BABY idle f0 and is large by design.
- Replacement rule: **Δ(special f15, grown idle f0) = 0 pixels**, P1 and P2, in BOTH arts (they share the drawing) (a unit test).
- HA-13: every growth frame is a real in-between of `grow`. No frame may copy its neighbour.

### 4.11 victory: 5 f (hold), 830 ms baby / 910 ms grown
Not skipped any more (critique 2, #16): `_blade_v3.ts:351` plays `victory` as the Ejder Kılıcı bond pose whenever `u.has('victory')` (the hatchling is a Dragon), and `v3small/end.ts:780` plays it for the winners.
- Baby: f0 puffs its chest, f1 a hop (4 px lift in pose), f2 lands with the nubs up in a "V", f3 a proud cheep with a tiny hiccup ring, f4 (held 400 ms) beaming, cowlick up, the shell helmet tipped jauntily.
- Grown: f0 the mane swells, f1 rises onto its forelegs, f2 the wing tips spread out of the mane, f3 a roar with a fat ring, f4 (held) a proud guardian pose, chin up, the ring puffs bright.
- The bond's peak frame: `VICTORY_PEAK.cloud_hatchling = 3` (lane-owner note to the blade file's owner; the default `floor(n × 0.4)` = 2 also works).

### 4.12 points() (HA-25) and joints()
| Point | Where | Used by |
|---|---|---|
| `muzzle` | the mouth centre (baby ≈ (52, 53) at rest, the release frame at the lips; grown at the snout tip) | the ring's spawn on `release`, the hiccup ring, the roar's air blast |
| `core` | the belly centre | hit sparks, the dial centre, the stat beat, the egg centre in death |
| `head` | the crown (baby: the cowlick root) | stat number placement, the startle "!"-free reaction (no text: the look is in the pose) |
| `feet` | the anchor (40, 74) | floor marks, dust, the cloud under the egg |
| `grip` | the tail-shell tip | the eggshell glint, the summon's shell slide, the death knit's first plate |

- `joints()`: `head`, `hips`, `tail`, `footN`, `footF`, `wingN` (sameness MOT traces, the hit kit's hip travel).
- The grown shell returns its own points and joints. They reach the cinematics via the swapped `u.art`.
- `ringPuffs(phase)` returns the 12 puff centres in FRAME pixels; every cinematic converts them with `u.framePoint(x, y)` (`MonsterUnit.ts:489`), which applies the P2 flip and the anchor, so the falling hour-puffs land on the baked ring on both sides (critique 2, #19).

---

## 5. Cinematic storyboards

All times are **scene ms** (code durations). Game time ≈ ×1.35 (the hit-stop ≈ ×1.55). Measured limit = REHBER §5 × 1.45 (TEMPO.md).
- The light layer is stepped only (EF-6): `lightPool` / `lightFlash` from `src/view/light` (re-exported by `summon-a/_kit.ts`). **`lightDim` is never used**: it is a whole-arena dim to ≈ 45 % eased over `ms` (`view/light/index.ts:166`), not a local shadow (critique 2, #5). Every cloud shadow in this card is the `cloudShadow` raster of `cloud_hatchling-fx.ts`: an ink 2×2-dither ellipse at `DEPTH.SHADOW` (solid core, dithered rim: the `MonsterUnit.shadowKey` algorithm, `MonsterUnit.ts:71-90`), regenerated at each whole-px size step, never scaled.
- No zoom and no new camera moves (EF-8). Shake is whole px through the existing `shake`.
- No `setScale` / `setAngle` on sprites. Raster FX are drawn at integer px (EF-7). At most one ring per effect (EF-7): the wind ring IS the one ring.

### 5.1 Summon "Bulut Yumurtası" (normal summon): target ≈ 2.0 s scene / ≈ 2.8 s game, limit ≤ 3.34 s game
`signatureSummon` → `runSummon` (`summon-a/_kit.ts:620`): the hand card is taken and slammed (`fx.slamToZone`, 340 ms, **awaited**, line 643), then the hidden unit is added, then our `eggDropV3(S)` runs (only when `unit.has('summon')`; `ev.from === 'field'` falls back to `ctx.base()`).
- **The cloud is off the critical path.** An observer in `summon-a/cloud_hatchling.ts` (`registerObserver`, inside `if (LOOK_V3)`) sees the `summon` event of a `cloud_hatchling` from the hand at its START (observers run before the chain, `Director.ts:206`) and starts the cloud drifting in at once, during the hand take and the slam. The handle is stored per uid; `eggDropV3` picks it up (if it is missing, e.g. `?test` replay, `eggDropV3` spawns the cloud already in place).
- `eggDropV3` then only has the sag, the fall and the hatch. Times below are from `eggDropV3`'s start (= the slam's end).

| ms | Picture | Light / floor | Sound |
|---|---|---|---|
| −340 … 0 (during the slam) | A small cloud (raster: 3 lobes 22×10, `white` top, `mist` body, `steel` belly, 1-px `night4` underside line) **drifts in level from the upper left** (no dive: the dive is `storm_hawk`'s, YENI §5) and stops 46 px above the tile, 200 ms of travel | `cloudShadow` 26×8 on the floor under the cloud, following it in whole px | `hatchCloudDrift` (from the observer) |
| 0–60 | The cloud sags (its lobes compress 1 px) and lets go: summon f0 (the egg) appears under it | — | — |
| 60–200 | The egg falls (f0 / f1, 70 + 70, Quad.In, whole px) | the cloud shadow stays; the egg's own drop shadow grows 4 → 8 px in whole-px steps | `hatchEggDrop` (a falling whistle) |
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
`registerStrike('cloud_hatchling', hatchRingV3)`. `const grown = variantOf(s.attacker) === 'grown'`. Baby values first, grown values in [ ]. Every beat is driven by `atFrame` / `atMark` on the attack (SE-1); the times are the expected values from the §4 hold tables, from strike start (= f1, the declaration's held frame).

**The ring's shape comes from the board's geometry (critique 2, #8).** The duel axis runs lower-left → upper-right (`layout.ts:25-42`): an opposite-lane target is (+64, −32) px away, so the ring travels diagonally along the iso row direction, not along screen-x. A ring at right angles to that travel lies in the plane spanned by the vertical and the iso column direction (32, 16) (the 2:1 slope down-right). Projected, a ring of diameter D (equal screen length along both conjugate diameters) is an **open ellipse of axes ≈ 1.2 D × 0.74 D whose major axis leans ≈ 32° from vertical, top to the left ("\")**, not an upright 1 : 2 sliver.
- `windRing(D, travel)` rasterises the ellipse from those two conjugate diameters at whole px and caches it by (D, travel sector): the opposite-lane case (both players: the column direction is the same for P1 and P2, only the trailing side swaps) and 16 sectors for cross-lane / direct paths, the P1 and P2 sectors mirrored. No runtime scaling, no `setAngle`.
- Diameters: baby **D = 8 → 10 → 12 → 14** (axes ≈ 10×6 → 12×7 → 14×9 → 17×10) [grown **12 → 16 → 20 → 24**, axes ≈ 14×9 → 19×12 → 24×15 → 29×18], one step per 60 ms of flight.
- The 2-px band holds two tones only: a `white` lead pixel row on the outer edge, `mist` inside it. A 1-px `steel` partial arc rides only the half that is farther from the camera (it will sit behind the target's depth). Three 1-px whistle streaks trail 6–10 px behind it along the travel line and flicker.
- **The ground remembers the sneeze (bold idea):** on every floor tile the ring crosses, a flattened-grass annulus is left on the floor plane (a 2:1 iso ellipse, 14×7 baby [20×10 grown], 1 px wide, in the tile's next-darker floor tone from `RAMPS`, drawn at the tile-FX depth). Each patch blinks out in three palette steps over ≈ 1 s after the ring has passed (golden rule 2: a small living detail that outlasts the beat). One patch per tile, so it never reads as a second ring in the air.

| ms baby [grown] | Picture | Light / floor | Sound |
|---|---|---|---|
| 0 | The declaration held f1 (cheeks puffed [chest swells]). The strike plays on from f1 | — | `takeCharge(u, …)`: the declaration's `holdCharge` already started the right inhale (`hatchInhale` [`hatchGrownInhale`]) through `soundsOfUnit(u)` (§6.4) |
| 90–350 [120–460] | Hops f2–f5 [forepaw stomps]: the sprite moves **8 px** [6 px] toward the target (along the travel vector, whole px) on each "up" frame, only while that pose plays (HA-11) | 2 dust dashes per landing | `hatchHop` ×2 [`hatchGrownStomp` ×2 + 1-px shake each] |
| 350–510 [460–640] | "ha…" f6 (160 [180] ms), the stillest frame | — | — |
| 560 [700] | **release** f8: the ring is born at `muzzle` (D 8 [12]) | a stepped `mist` pool under the muzzle, 1 step | charge `stop(40)`; `hatchSneeze` [`hatchGrownSneeze`] + `start('hatchRingWhistle')` [`hatchGrownWhistle`] |
| 560–800 [700–960] | **The ring flies** (240 [260] ms, `Sine.In` then constant) through its four diameters | a `mist` floor pool travels under the ring (stepped, 1 step); the grass patches appear tile by tile | the whistle rises (its pitch is in the recipe), panned along the flight |
| 800 [960] | **Contact** = `s.impact(at core)`: the ring is 1 frame around the target's torso (far half with its `steel` arc behind the target's depth, near half in front), then **squeezes** (D 14 → 12 → 10 [24 → 20 → 16], the same table run backward, over 2 frames) | — | `hatchRingSqueeze` 50 ms before contact; on contact `hatchRingTing` [`hatchGrownRingBoom`]; whistle `stop(30)`; the target's material hit by the kit |
| contact + hit-stop | hit-stop 60 [100] ms (attacker class), shake 1 px [3 px]; the kit's contact flash on the target (EF-3) | `lightFlash` `mist` on the target tile 120 ms | — |
| contact + 60 | **Snap**: the ring breaks into 8 arc shards (1-px arcs 3–5 px long) flying outward in the ring's own plane, blinking out over 180 ms | — | — |
| 620–1120 [770–1470] | The attacker plays follow / recover f9–f12 + end (it plops on its tail [rocks on its haunches]) and **hops [walks] home** in two whole-px steps during f11–f12 | the grass patches step out | `hatchPlop` on f9 [`hatchGrownStomp` at 0.6 on f9] |
| ≈ 1950–2150 [≈ 2100–2300] | The target's death (its own kit) runs in parallel (SÜ-2); input returns | — | — |

- Contact is ≈ 233 + 800 = 1030 ms [233 + 960 = 1190 ms] after the declaration. With a ≈ 1.1 s target death that gives ≈ 2.15 s [≈ 2.3 s] scene ≈ 2.9 s [≈ 3.1 s] game, under 3.19. **Measure both** (`kaChAtk`, `kaChGrownAtk`). If the grown is over, the flight goes to 220 ms and the grown "ha…" to 160 ms (never the stomps' weight).
- `s.power` 3 (a big margin): baby shake 2 px, an extra ring of dust dashes.

### 5.3 Direct attack: ~1.6 s scene → ≤ 2.32 s game
- Same as §5.2 up to the release. The ring flies to `s.to` (the duelist point) over 260 ms, rising 10 px along an arc. It squeezes nothing: it breaks ("tıng") into the 8 arcs above the opponent's podium, with a gust of dust at `s.toGround`.
- The kit's direct-hit LP number comes from `s.impact(at)`.
- The hatchling's recovery overlaps the LP flow.
- Grown: one bigger ring, the "BOOM-tıng", shake 3.

### 5.4 Blocked and losing
- **Blocked** (DEF ≥ ATK, the defender survives in guard):
  - the ring squeezes but cannot close: it stalls 2 frames, then **rebounds** back along its path, shrinking through the diameter table backward (D 14 → 8 [24 → 12]);
  - it bonks the hatchling's face: the attacker plays `hit` (light), then sits on its tail;
  - the battle damage number is the kit's;
  - sounds: `hatchRingRebound` at the stall, the bonk inside it;
  - recipe `attack.blocked: 'rebound'`.
- **Losing** (the attacker is destroyed):
  - the ring fizzles on contact ("pıt": it pops into 4 dots, no squeeze), with `hatchRingFizzle`;
  - the target's counter is the kit's backlash along the attack line (`src/cinematics/_v3/clash.ts` backlash, EF-13);
  - the hatchling takes hitHeavy, and our death (§5.5) follows from its continuing frame (`posematch`).
- **Tie:** the snap + the backlash; both die.

### 5.5 Death "Yumurtaya Dönüş": ≈ 1.05 s scene (limit ≤ 1.4 s) → ≤ 2.03 s game. Final material (YENI §5.2 C3): knitted back into its egg, floats away on a cloud
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

| ms baby [grown] | Picture | Light | Sound (through `soundsOfUnit(u)`) |
|---|---|---|---|
| 0 | death f0 (contact flash if `hints.hit`) | — | the blow's own |
| 50 [60] | f1 recoil | — | `hatchCurl` [`hatchGrownCurl`] (deathStart) |
| 110–300 [130–310] | tumble, curl into a ball (f2–f3) [f2 the big ball; **f3 un-age 1**: the mane and ring peel off as loose lobes] | — | [`hatchUnAge` on f3: the voice climbing back toward the baby's] |
| 300 [310] | **dissolve** f4: plates rise, knit lines start [un-age 2] | a stepped `skin4` pool, 1 step, grows with the knit | `hatchKnit` (dissolve) |
| 370–580 [380–590] | knit f5–f7 [f5 = the baby's ball]; the small egg closes | — | `hatchLullaby` on f7 (afterDissolve +3) |
| 580–730 [590–750] | seams vanish (f8), lift-off anticipation (f9) | — | — |
| 730 [750] | **Lift-off = the burst frame**: a cloud (raster, as in the summon, 22×10) forms under the egg out of 4 puffs [out of the loose mane / ring lobes gathered on f5–f9]; the card is born on the tile now (`cardLeaves`, EF-12: 2 frames 1-px white frame + 1 frame owner tone, then a 200–360 ms arc to the graveyard) | the pool starts to step down | `hatchFloat` (burst) |
| 730–1030 [750–1050] | The egg rides the cloud **up 14 px**. The float frames play as a ping-pong (f10 → f11 → f12 → f11 → f10 → f11, 50 ms each); each frame change carries a 2–3 px whole-px rise, and the sprite is never moved between frame changes (HA-11). The raster cloud's lobes cycle with them | `cloudShadow` on the floor, 26×8 → 20×6 → 14×4 in whole-px steps (never `lightDim`) | — |
| 930–1030 [950–1050] | The last 100 ms of the float: the pixel break-up (YENI §5), our own `eggScatter` in `cloud_hatchling-fx.ts`. It reads `unitFrame(u, 'death', f)` for the float frame on screen (the grown art and the P2 relight when the unit is grown / on P2's sheet), hides the sprite, and scatters its pixels as whole-px 2×2 clusters drifting upward with the cloud's puffs; each cluster blinks out on a stepped schedule (no alpha fades). Then `retire` | the cloud shadow blinks out | — |

- Total ≈ 1030 [1050] ms scene: ≈ 350 ms of margin under the 1.4 s limit.
- Death from guard: `runGuardBreak` opens the guard into death f0, then the same flow.
- Spell destroys (`judgment_bolt`) take the same flow, with `hit: false` → no flash.

### 5.6 The signature moment: the growth (`effect`, ≈ 2.42 s scene ≈ 3.3 s game; limit ≤ 4.06 s game)
**Sequencing (read in code and confirmed by running the engine).** `callCoin` win (`rules.ts:977-987`) emits, in order:
`coinToss → massDestroy → destroy / toGraveyard (× opponents) → activate{kind:'monsterEffect', uid: hatchling} (× each) → statChange (× each, from `withStats`)`.
- The Director runs them one by one (`Director.playBatch`, `Director.ts:120-126`): our hook starts only when lane D's coinToss / massDestroy / destroy handlers have resolved. Between the coin's start and our hook there are the coin (≈ 2.7 s in today's placeholder, 3.2–3.8 s in the YENI C2 spec), `massDestroy` (≈ 420 ms) and ≈ 1 s per destroyed opponent: **4–7 s of scene time** (critique 2, #1).
- `hookKeys` maps `activate` + `monsterEffect` → card hook `effect` (`Director.ts:421`). At priority 0 it runs before the default `activate` (priority −100).
- After each top-level event the Director syncs the projected frontier (`Director.ts:125, 170-176`). With the `project.ts` precondition (§3.3 step 7), that snapshot carries `permAtk` once our `activate` has run.

**Cause before effect: the staring loop (an observer, no dependency on lane D).** `registerObserver` in `cloud_hatchling-grow.ts` sees the `coinToss` event at its start, in parallel with lane D's coin (observers get the full context, `Director.ts:206-211`):
- For each face-up `cloud_hatchling` of `ev.player` without `permAtk` (read from `ctx.state`) whose unit is visible, in attack position and not `locked`: at +250 ms it plays the idle hiccup frames (f13–f16; the tiny ring puffs up toward the coin) with `hatchHiccup` at 0.5, then runs **the staring loop**: special f0 → f1 → f2 → f1 → … with `u.pose('special', f)` at ≈ 120 ms per step (f0–f2 are drawn as a loopable cycle, §4.10: the eyes track the coin, the cowlick bobs, a half-blink with a 1-px hiccup jolt). Nothing is ever held longer than HA-2's 200 ms, however long lane D's coin and the wipe take.
- **How long it loops** (no timer guesses): the observer looks up its own activate in the batch, `const ai = ctx.findType('activate', e => e.kind === 'monsterEffect' && e.uid === u.uid)`.
  - `ai < 0` (the coin was lost, or the hatchling does not grow): one cycle (≈ 600 ms), then back to idle; lane D's rewind takes it next.
  - `ai ≥ 0`: it loops until our hook claims the unit (a per-uid `claimed` flag set on the hook's first line) or until `ctx.isConsumed(ai)` turns true without a claim (someone else consumed our activate: back to idle at once). It also stops on `u.retired` / `u.locked` / the sprite going invisible. A 20 s hard cap is the last-resort guard against a stuck batch; it is not a timing.
- It only poses our own unit and draws nothing; it never waits on lane D's timings. A cowlick that stands up on lane D's "BİLDİ" reveal was considered and rejected: it needs lane D's internal reveal time.

`registerCardHook('cloud_hatchling', 'effect', hatchGrowV3, { name: 'strikes-a:cloud_hatchling:grow' })`:
- **Siblings:** collect every later `activate` monsterEffect of a `cloud_hatchling` uid in the same run and `ctx.consumeAt` **only those `activate` events**. Grow them together, staggered 150 ms.
- **The stat beat comes after the swap** (critique 2, #12): every `statChange` stays UNconsumed. `ctx.play(i)` returns at once for a started event (`Director.ts:322-324`), and `consumeAt` sets exactly that flag, so a consumed statChange would never animate. The hook finds the first one (`ctx.findType('statChange', e => uids.includes(e.uid))`) and calls `ctx.play(firstStatIdx)` **right after the last sibling's `setUnitVariant`** (the end of special f15), inside the grown idle tail. Then:
  - the number sits on the grown crown (`statBeatV3` reads `u.worldPoint('top')`, `flow/stats.ts:206`, which follows `u.art` after §3.3 step 3);
  - the `rimClimb` leaf rim climbs the grown silhouette and never overlaps the roar's white flash, motes and shake;
  - the number shown is the delta **"+1200"** (a heal-kind `impactNumber`), and the badge rolls 1100 → 2300.
  - The `statChange` handler (`flow/stats.ts:71-78`) groups the following consecutive `statChange` events, so one `play` covers `kaChGrowTwo`. The hook awaits that promise together with its own tail before it resolves.
- **Not visible** (`!u || !u.sprite.visible`): `setUnitVariant(u, 'grown')`, then `ctx.play(firstStatIdx)` at once (only if no visible sibling will play it), return.
- **In defense:** `fromGuard` plays DURING the dial build (0–370 ms, in place of the staring loop), and `toGuard` plays on the grown sheet in parallel with the stat beat. Net cost ≈ +10 ms. **Measure `kaChGrowDef` in the first build round.**
- **Every dial beat is driven by `atFrame` / `atMark` on the special** (SE-1), never by absolute ms; the times below are the expected values at 1×.
- **No dependency on lane D:** the dial is our own raster, and the only inputs are our event and the board.

**The sky dial ("the ring is made of years").** A hollow clock face behind the hatchling (depth −1, centred on `core` − 6 px, radius 22, capped for adjacent tiles, R10):
- **Rim:** 12 cloud puffs at the hours (each a 3×3 `white` / `mist` lobe with a `steel` underside pixel). These are the same 12 puffs as the grown waist ring.
- **Ticks:** four 2-px `water4` ticks at 12 / 3 / 6 / 9 inside the rim.
- **Hands:** two wind streaks (long 18 px, short 11 px): a `white` 1-px head with a `mist` trailing streak of the last two positions (the motion blur, in whole px).
- **Fast revolutions read as a sweep, not a jumping hand** (critique 2, #19): revolutions 2–6 last 85–120 ms scene (≈ 7 display frames), so a drawn hand would jump ≈ 50° per frame. For them the long hand is drawn as a **stepped `mist` sweep wedge** behind its `white` head: a filled sector from the hand's position two display frames ago to now (1-px rim of `white` on the leading edge, `mist` body, `steel` at the trailing edge, whole-px raster), so each display frame shows where the hand has swept. Revolution 1 (360 ms) uses the plain hand + 2-position streak.
- **Gold:** only a 2×1 `gold3` pip just outside the 12 o'clock puff.
- **The years fall:** the long hand makes six revolutions; each one ends exactly on a growth frame (f6 … f11). The short hand advances two hours per revolution, and **the two hour-puffs it has just swept drop off the rim** and fall in whole-px steps (≈ 80 ms) to their slots on the waist ring (`ringPuffs(0)` through `u.framePoint`, so the slots mirror for P2; back-half slots behind the sprite's depth, front-half slots in front). The dial empties as the body grows. On f11 the last two (11 and 12) land, the falling puffs vanish on that very frame, and the sprite's baked ring sits on exactly their pixels.
- This keeps one ring per effect (EF-7): the dial rim IS the waist ring, moving. The motes therefore do not orbit on a closed ellipse: they rise on an **open spiral** (below).

**The voice breaks in steps (bold idea, critique 2, #4).** Each growth frame carries one hiccup a step lower: f6 D6, f7 B5, f8 G5, f9 E5, f10 D5, f11 A4 (`hatchGrowHic` with `pitch` = 1, 0.841, 0.667, 0.561, 0.5, 0.375). f12 is a sharp gasp, and the voice breaks into the D4 / D3 roar **exactly on f13**: `hatchVoiceDrop` starts its growl onset at t = 0 (the break is a 40 ms glide from A4 under the onset, not a pre-roll), and it is fired with `atMark('impact')` = f13. The two-octave drop becomes a journey you hear frame by frame; nothing lands 360 ms late (revision 2's `hatchVoiceCrack` put the growl at +0.36 s of a sound fired on f13).

| ms (expected, 1×) | Driven by | Picture | Light / floor | Sound |
|---|---|---|---|---|
| 0 | hook start (sets `claimed`) | the staring loop is running (the observer); `warmVariant` (both players' grown sheets, queued since the coin call) | — | `start('hatchGrowWind')` (circling air) |
| 0–360 | the staring loop continues: three steps ending on f2 (`u.pose`, ≈ 120 ms each; defense: `fromGuard` instead) | **The dial builds**: (1) the 12 puffs pop in clockwise from 12, 25 ms apart; (2) the ticks; (3) the hands, at 12. Hollow: rim + ticks + hands only, so the body stays readable (EF-2) | a `water4` stepped floor pool on the tile, 1 step | each puff a tiny `puff` inside `hatchGrowWind` |
| 360–720 | `playFrom(u, 'special', 3, { hold: true })` (`strikes-a/_kit.ts:200`) | special f3–f5 (trembles, the hunch). **Revolution 1**, slow (360 ms, Quad.In). Eight dust motes rise from the floor on an open spiral around the tile (radius 18 → 8, rising 0 → 30 px, whole px), speeding up with the hand | — | — |
| 720 (f6) | `atFrame(special, 6)` | growth 1 (the body swells); rev 1 ends; hour-puffs 1–2 fall | `leaf4` floor pulse, 1 step | `hatchGrowFwipA` (pan −0.6) + `hatchGrowHic` (D6) |
| 805 (f7) | `atFrame(7)` | growth 2 (four legs); rev 2 (sweep wedge); puffs 3–4 fall | pulse | `hatchGrowFwipB` (pan 0.2, + shell creak) + `hatchGrowHic` (B5) |
| 890 (f8, 120 ms) | `atFrame(8)` | growth 3 (muzzle + chest); rev 3; puffs 5–6; shake 1 px | pulse | `hatchGrowFwipA` (pan 0.6) + `hatchGrowHic` (G5) |
| 1010 (f9) | `atFrame(9)` | growth 4 (horns); rev 4; puffs 7–8 | pulse | `hatchGrowFwipB` (pan −0.2) + `hatchGrowHic` (E5) |
| 1095 (f10) | `atFrame(10)` | growth 5 (wing tips fold into the back); rev 5; puffs 9–10 | pulse | `hatchGrowFwipA` (pan −0.6) + `hatchGrowHic` (D5) |
| 1180 (f11, 120 ms) | `atFrame(11)` | growth 6 (mane + the ring complete); both hands reach **12**; puffs 11–12 land; the gold pip flashes `gold4` 1 frame; the hands and ticks blink out in 3 stepped frames ("the dial clicks shut"); shake 2 px | the `water4` pool steps out | `hatchGrowFwipB` (pan 0.2) + `hatchGrowHic` (A4) + `hatchGrowChime`; `hatchGrowWind.stop(80)` |
| 1300 (f12) | `atFrame(12)` | head rises out of the mane | — | `hatchGrowGasp` |
| 1390 | **`atMark('impact')`** (f13, 70 ms) | **ROAR**: the motes blast outward radially, then blink out; shake 3 px 220 ms | `lightFlash` `white` on the tile 100 ms (EF-4: ≤ 1.5 % white) | **`hatchVoiceDrop`** (the voice breaks into the roar on this frame), duck 0.7 |
| 1460–1770 | f14 (roar hold, 180) – f15 (130) | settle; at the end of f15's hold **`setUnitVariant(u, 'grown')`** (invisible: Δ = 0), then `u.play('idle')` on the grown anim keys (defense: `toGuard`) | — | — |
| 1770 | after the last sibling's swap | `ctx.play(firstStatIdx)`: the generic v3 stat beat on the grown body (leaf rim climb from the feet, "+1200", the badge rolls to 2300) | its own `leaf3` flash | its own (`lpUp`) |
| 1770–2420 | grown idle | the waist ring begins its orbit | — | — |
| ≈ 2420 | stat beat + tail resolved | resolve | — | — |

- Expected ≈ 2.42 s scene ≈ 3.3 s game (limit 4.06); defense about the same. **Measure it at 1× and `&speed=3`** (the marks must stay on their frames).
- **Warm-up:** `registerObserver` on `decision` events with `pending.kind === 'coinCall'`. If the deciding player has a face-up `cloud_hatchling` without `permAtk`, call `warmVariant` (BOTH players' grown sheets: a later `puppet_string` shows the other one). That gives the coin's whole length of background painting before the swap. With `?test` the sheet paints synchronously on first use (deterministic films); without `?test`, `sheetPaintStats()` must show no synchronous grown-sheet paint inside a cinematic (§9.3).
- **Permanence afterwards:**
  - the frontier sync right after our hook and every later batch see `permAtk`, so `FieldView.sync` keeps the uid map and upgrades any rebuilt unit, and the plate keeps 2300;
  - any unit built for that uid later (a `magic_hat` reveal, a recipe flip, a resync) is grown from its first frame through `MonsterUnit.onBuilt` (§3.3 steps 3, 5);
  - a control change re-faces through `setController` → `applyFacing` → `MonsterUnit.sheetFor` (the grown P2 key), and `syncSheet` follows even on a held pose (§3.3 step 3);
  - leaving the field retires the unit and drops the uid from the map at the next sync. A revive or re-summon is a new slot without `permAtk`, so it is a baby again (correct by the rules: M14).
- **Un-aging (the reverse, owned by lane D's rewind through the §3.3 step 9 contract):** when an opponent's jester wins against a grown hatchling, the rewind plays our special backward on the grown unit's own anim keys (grown → baby; the roar climbs back up into a squeak with `hatchVoiceCrackRev`), then the summon backward (baby → egg). Scenario `kaChGrownRewound`.

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
| **Key D.** Baby voice D6 (1175 Hz FM chirp). The growth hiccups step down D6 B5 G5 E5 D5 A4, and the roar breaks to D4 (294 Hz, two octaves below D6) over a D3 growl body (147 Hz) | eggshell (dry high crack + a short "tok" 420 → 180 Hz) | **the ring whistle:** a tonal sine glide D7 → D8 (2349 → 4699 Hz) with a 6 Hz flutter over a band-passed noise breath rising 2 → 5 kHz, panned along the flight; the grown whistle is one octave lower |

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
| `hatchLullaby` (afterDissolve +3, 0.8) | music box G6 E6 D6 (1568 / 1319 / 1175) at 0 / 0.16 / 0.32: `v.bell(f,{ratio:5.4,index:0.35,dec:0.35,g:0.05})` + `v.tone('sine', 2f, g 0.01)`; verb 0.35, duck 0.3. **≈ 0.7 s total** (revision 2's ≈ 1.04 s ran past the float into the next event; critique 2, #18) |
| `hatchFloat` (burst) | `sweep(v,0,0.6,[500,1200,2400],0.07,{kind:'pink',peakAt:0.6})`; a rising glide `v.tone('sine',[[0,1175],[0.5,2349,'e']], g 0.015)` |
| `hatchReviveGather` (**sustained**) | a falling air `sweep(v,0,0.9,[2400,1200,600],0.06,{kind:'pink'})` + a D5 / A5 pad |
| `hatchReviveLand` | `hatchEggLand` + 3 descending unstitch ticks + a short cheep |
| `hatchGrowWind` (**sustained**, built 1.6 s; stopped on f11 at ≈ 1.18 s, `stop(80)`) | `sweep` pink, centre 600 → 2400, through `v.panner` with L↔R points accelerating (0.4 → 0.12 s per swing): the air circles. 1.6 s leaves ≈ 0.4 s of headroom at `&speed` < 1 or a slow frame; it never runs out before its stop mark |
| `hatchGrowFwipA` (one per hand revolution, `pan` from the scene: the six pulses go round the stereo field −0.6 → 0.2 → 0.6 → −0.2 → −0.6 → 0.2) | an air pulse, no click: `sweep(v,0,0.09,[700,2600,1200],0.09,{kind:'pink',q:1.4,peakAt:0.35})` + a soft low swell `v.tone('sine',[[0,294],[0.08,330,'e']], g perc 0.01/0.07, 0.02)`. Each call is a little brighter (`pitch` 1 → 1.25 from the scene), so the years accelerate |
| `hatchGrowFwipB` | `hatchGrowFwipA` + a shell creak on top: `crack(v,0.03,0.04,{hp:2200,lp:6000,n:2,gap:0.02})` + `v.tone('sine',[[0.03,1760],[0.07,1568,'e']], g 0.012)`. A and B alternate, so the shell creaks on every second pulse. No click train, no ratchet (C2's distinguishing layer, YENI §5.1) |
| `hatchGrowHic` (×6, one per growth frame; `pitch` 1 / 0.841 / 0.667 / 0.561 / 0.5 / 0.375 = D6 B5 G5 E5 D5 A4) | the baby hiccup voice getting heavier: `v.tone('sine', [[0,1175],[0.04,1400,'e']], g perc 0.06/0.05)` + an FM colour `v.bell(1175,{ratio:2,index:0.6+0.25·step,dec:0.07,g:0.03})` (the voice roughens as it drops); the body under it: `thump(v,0,220,110,0.25,0.06+0.015·step,{drive:1.5})` + a hide stretch `sweep(v,0,0.12,[180,320,140],0.05,{kind:'brown',q:6})`. Every frequency scales with `pitch`, so the voice AND the body drop together |
| `hatchGrowGasp` (f12) | a sharp intake `sweep(v,0,0.08,[900,2400,1600],0.08,{kind:'pink',peakAt:0.8})` + a 1-cycle vocal catch `v.tone('sine',[[0,440],[0.06,494,'e']], g 0.02)`: the breath before the roar |
| `hatchGrowChime` | `v.bell(587,{ratio:2,index:0.8,dec:0.9,g:0.06})` + `v.tone('sine',1175, g 0.02)` (soft, low, not brass; the dial "clicks shut" with an air pop `puff(v,0,0.04,0.05,2500,{kind:'white'})`, not a click) |
| **`hatchVoiceDrop`** (the signature; fired on f13 = `atMark('impact')`) | **the onset is at t = 0**: a vocal break glide `v.tone('sine',[[0,440],[0.04,294,'e']], g 0.05)` with FM grit under `growl(v,0,{d:0.7,f:[294,262,196,165,147],formants:[520,1250,2600],g:0.9,grit:4.5,rasp:30})` + **the ring whistle sung inside the roar**: `v.tone('sine',[[0.02,1175],[0.5,2349,'e']], g at −12 dB under the growl)` with the 4 Hz flutter + `thump(v,0,140,55,0.5,0.4,{drive:2})` + `puff(v,0,0.2,0.5,900,{kind:'brown'})`; duck 0.7, verb 0.4. **0.7 s** total (revision 2's 1.1 s tail ran past the hook's end into the stat beat; critique 2, #18). It replaces revision 2's `hatchVoiceCrack`, whose growl started 0.36 s after the f13 trigger (critique 2, #4) |
| `hatchVoiceCrackRev` (the un-aging hint for lane D's rewind, §3.3 step 9) | the old two-part voice crack built backward (not a reversed buffer): the growl 147 → 294 (formants [520,1250,2600], d 0.6) climbs, breaks upward 587 → 1319 over 0.08 s, and ends on a tiny squeak 1319 → 1175 (0.18 s); a short `sweep` pink inhale under it (the air sucked back in). Rising, never C2's tape whirr |
| `hatchGrownRoar` | `growl(v,0,{d:1.0,f:[196,220,165,147,110],formants:[520,1250,2600],g:0.85,grit:4,rasp:30})` + the same sung whistle layer (1175 → 2349 Hz, −12 dB) + `thump(v,0,120,50,0.4,0.3)` |
| `hatchGrownInhale` (**sustained**) | `sweep(v,0,0.8,[300,1100,700],0.09,{kind:'pink',peakAt:0.85})` + a low `growl` d 0.8, g 0.25 |
| `hatchGrownStomp` | `thump(v,0,160,60,0.35,0.12,{drive:1.4})` + a shell tick |
| `hatchGrownSneeze` | `thump(v,0,180,70,0.4,0.15,{drive:2})`; `puff(v,0,0.35,0.2,4000,{kind:'white'})`; `sweep(v,0,0.2,[1500,3200,900],0.2)`; a short `growl` d 0.3 |
| `hatchGrownWhistle` (**sustained**) | the baby whistle one octave down (1175 → 2349), flutter 4 Hz, breath `[1000,2000,3200]` |
| `hatchGrownRingBoom` | `glassBell(v,1175,0,0.14,0.1,{modes:3})`; `thump(v,0,120,50,0.5,0.2,{drive:2})`; `puff(v,0,0.3,0.2,1500,{kind:'brown'})`; duck 0.55 |
| `hatchGrownCurl` (grown deathStart) | a low whimper that climbs: `growl(v,0,{d:0.25,f:[196,233,294],formants:[520,1250,2600],g:0.35,grit:2})` handing over to `v.tone('sine',[[0.2,587],[0.4,880,'e']])` + vibrato: the big voice already sliding back toward the baby's |
| `hatchUnAge` (grown death f3) | `hatchVoiceCrackRev` shortened to 0.3 s and softer (g × 0.5): the growl climbs, breaks upward, ends on a tiny squeak; plus three reversed shell ticks |

- **Grown death voice (critique 2, #10):** the grown deathStart is its own (`hatchGrownCurl`) and f3 adds `hatchUnAge`; `dissolve` (`hatchKnit`), `afterDissolve` (`hatchLullaby`) and `burst` (`hatchFloat`) stay the baby's **on purpose**: from f5 on the grown death IS the baby in its small egg (§4.8), so the lullaby is the baby's.
- `HATCH_SUSTAINED = ['hatchInhale','hatchRingWhistle','hatchRingWhistleL','hatchRingWhistleR','hatchGrownInhale','hatchGrownWhistle','hatchGrowWind','hatchReviveGather']`.
- Every sustained sound is `start()`ed and `stop(ms)`ed on the mark that ends its picture (SE-2).

### 6.3 Distinctness (SE-4) against every §5.1 identity and the aces
| Neighbour | Risk | Why ours differs |
|---|---|---|
| `crystal_wyrm` (E-pentatonic glass bar modes, `glassRain`) | the "tıng" | one 60 ms bell on D7 (not in E pentatonic), 2 modes, no rain, always paired with an air pop |
| S7 `auger_lance` (1 → 8 kHz whistle + a 120 Hz saw rotor) | whistle | ours is a narrow 2 → 5 kHz glide with a 6 Hz flutter, ≤ 0.3 s, no rotor, no saw |
| C11 `steppe_spiralhorn` (a 3 kHz horn flute, a held wind note) | wind note | ours always glides and never holds a pitch |
| C2 `dial_jester` (3.2 / 2.6 kHz tick-tock, brass gear ratchet, rewinding tape) | the growth sits right after their coin in the same batch | we have no ratchet and no click train at all: air "fwip" pulses (pink noise 0.7–2.6 kHz) circling the stereo field, a shell creak on every second one, the stepped hiccup voice, a low soft chime (D5, not brass). No tick-tock pair, no tape. `hatchVoiceCrackRev` rises (a voice), never a tape whirr. This drops YENI §5.1 C3's "ileri cırcır" (forward ratchet) for the growth: a deviation from the card spec, put to the owner as **Q8** |
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
  - `VARIANT_SOUNDS: Record<string, Partial<CharacterSounds>>` with `'cloud_hatchling:grown': { roar: 'hatchGrownRoar', charge: 'hatchGrownInhale', swing: 'hatchGrownStomp', release: 'hatchGrownSneeze', impact: 'hatchGrownRingBoom', deathStart: 'hatchGrownCurl' }`;
  - `soundsOfUnit(u)`: `{ ...soundsOf(u.cardId), ...VARIANT_SOUNDS[`${u.cardId}:${variantOf(u)}`] }`;
  - `holdCharge(u)` (`_v3/sound.ts:250-251`) uses `soundsOfUnit(u)` instead of `soundsOf(u.cardId)` (one line). Without it the declaration plays the baby sniff for ≈ 233 ms under a grown dragon.
  - Our own cinematics use `soundsOfUnit(u)` too.
  - **The other sites that read a unit's voice by card id** join the §3.3 step 8 sweep (critique 2, #10): `traps/_mirror_v3.ts:1574` and `traps/chains_of_light.ts:560` (`soundsOf(u.cardId).charge` passed to `takeCharge`, which stops the held sound when the names differ, `_v3/sound.ts:267`: a grown attacker caught by Mirror Force or the chains would swap its held grown inhale for the baby sniff), and `_v3/death.ts:347,416` (kit deaths). Each becomes `soundsOfUnit(u)`, byte-identical for every other unit.

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
- `slotVariant` returns null without `LOOK_V3`. The two `FieldView` lines are inside `if (LOOK_V3)`. `MonsterUnit.sheetFor` / `animKeyFor` / `onBuilt` are installed only under `LOOK_V3`; for a unit without a variant they return null / do nothing, so `applyFacing` takes today's key and `animKey(anim)` returns today's `monsterAnimKey(id, anim)`. `ownsKey` accepts today's `p1Key` / `p2Key` exactly as the old guard did; the extra keys exist only for a variant unit.
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
| `src/cinematics/strikes-a/cloud_hatchling.ts` | `registerStrike('cloud_hatchling', hatchRingV3, { name: 'strikes-a:cloud_hatchling' })` | battle strike (`s.direct`, `s.blocked`, `s.ctx.ev.result`, `variantOf(s.attacker)`) |
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
| `src/duel/MonsterUnit.ts` | ≈ 14 lines (§3.3 step 3): `static sheetFor?` / `animKeyFor?` / `onBuilt?`, a private `animKey(anim)` at the 7 `monsterAnimKey(this.cardId, …)` sites, `setArt()`, `art` not readonly, `ownsKey()`, the `syncSheet` guard, `top` via `artFrame(this.art…)`. No frame fallbacks (revision 2's are dropped). The variant state and logic live in the new `src/duel/unit-variant.ts` |
| `src/duel/FieldView.ts` | the two `LOOK_V3` lines in `sync` (§3.3 step 5) |
| `src/cinematics/_core/project.ts` | **precondition:** `permAtk` / `permDef` on a `jesterAging` `activate` (§3.3 step 7); one change with lane B's `boostAtk` gap; optionally the three fields in `stateDiff` |
| the call sites of §3.3 step 8 | one orchestrator pass: `monsterFrame(u.cardId, …)` → `unitFrame(u, …)`, `monsterSheetKey(id, player)` → `unitSheetKey(u)` in the two warmers, `soundsOf(u.cardId)` → `soundsOfUnit(u)` at the four voice sites; `shatter` gets a variant-aware cache key |
| `src/art/textures.ts` | **not touched.** Revision 2's optional `cropsArt || isVariantArt` is dropped (critique 2, #15): `frameKey` is `${art.id}|anim|frame` and the pinned / LRU maps are global, so a cropped grown art with id `cloud_hatchling` would collide with the baby's frames. The grown sheets stay grid sheets (3.56 MB each, in budget) |
| `src/duel/scenario.ts` | `MonSpec` += `permAtk?: number; permDef?: number` and in the slot build (~line 113): `...(m.permAtk !== undefined ? { permAtk: m.permAtk, permDef: m.permDef ?? 0 } : {})` (stages a grown hatchling for films) |
| `src/audio/sounds.ts`, `src/audio/sfx.ts`, `src/cinematics/_v3/sound.ts` | §6.4 |
| `src/art/cardface-v3/index.ts` | §7 |
| `src/cinematics/spells/_blade_v3.ts` (owner's call) | `VICTORY_PEAK.cloud_hatchling = 3` (optional; the default works, §4.11) |
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
| `kaChGrowTwo` | two face-up hatchlings + one face-down | staggered growth; one stat beat after the second swap; the face-down one stays |
| `kaChGrowWipe3` | `kaChGrow` with THREE opponent monsters | the staring loop runs through the coin, `massDestroy` and three destroys (≈ 6–7 s) without a held frame, and the hook takes over from the loop (critique 2, #1) |
| `kaChGrowLose` | `callCoin 'heads'` (wrong) | the look-up, then the hatchling dies by the jester (lane D owns it via `sourceOwnsDeath`; else our egg) |
| `kaChGrowBorrowed` | P2 owns the hatchling; P1 `puppet_string` takes it, P1's jester wins (an opponent monster stays on P2's side), `endTurn` returns it | the growth on the borrower's side, then the variant survives the P1 → P2 sheet swap |
| `kaChRewound` | P2's jester wins against P1's BABY hatchling | lane D's rewind: summon reversed (today's contract) |
| `kaChGrownRewound` | P2's jester wins against P1's GROWN hatchling | the un-aging: special reversed, then summon reversed, no `__BASE` frame, `hatchVoiceCrackRev` if lane D plays it |
| `kaChGrownIdle` / `kaChGrownIdleP2` | staged grown, no steps | the permanent grown idle + ring, P1 / P2 |
| `kaChGrownAtk` / `kaChGrownAtkP2` | grown vs `magma_titan` (2100) | the big ring |
| `kaChGrownDirect` | grown, empty opponent | |
| `kaChGrownBlocked` | grown vs `crystal_wyrm` in DEFENSE (2300 = 2300) | rebound |
| `kaChGrownLose` | grown vs `crystal_wyrm` in attack (2800) | the un-aging egg death in attack |
| `kaChGrownKill` | grown attacked by `crystal_wyrm` | hitMagic → un-aging → the small egg |
| `kaChGrownGuardKill` | grown in defense (1700), attacked by `magma_titan` | guard break in the grown form |
| `kaChGrownHit` | grown in defense, attacked by `crag_axeman` (1600) | the grown guard holds |
| `kaChGrownPos` | grown `changePosition` | grown to / from guard |
| `kaChGrownControl` | grown on P2's side; P1 `puppet_string` takes it, then `endTurn` returns it | the re-sync: grown on both sides, P1 and P2 sheets; also film a held pose (the swap happens while no anim ticks, `syncSheet` `ownsKey`) |
| `kaChGrownResync` | grow (coin), then `endTurn`, `endTurn` | grown after several batches (permanence) |
| `kaChGrownChains` | grown attacks; P2 has `chains_of_light` set | the chains bind a grown body (no baby-shaped overlay) |
| `kaChGrownEquip` | grown; P1 equips `dragon_blade` | the aura on a grown body |
| `kaChGrownVenomHit` | grown in ATTACK (2300), attacked by `venom_drake` (2000): the target survives, the attacker dies (critique 2, #17: in defense, DEF 1700 died to both lane-mates) | a lane-mate strike's overlay on a SURVIVING grown target (`currentPixels`), then the grown hit reaction |
| `kaChGrownAshenKill` | grown in attack (2300), attacked by `ashen_drake` (2400) | a lane-mate kill on a grown target, then the un-aging egg death |
| `kaChGrownHat` | grown (staged) on P2's side; P1 attacks it, P2 answers with `magic_hat` (the slot goes face down behind the hats, `permAtk` kept); P1's attack then reveals it | the grown unit is built by the reveal (`FieldView.addUnit`) and is grown on its first frame (`onBuilt`), never a baby that pops (critique 2, #3) |
| `kaChGrownBounce` | grown attacks; P2 answers with `homecoming` (`attackBounceAttacker`) | the grown unit returns to the hand; re-summoned next turn it is a baby (new slot, uid map dropped) |
| `kaChGrownVoid` | grown on P1's side; P2 plays `void_eye` (`destroyAllMonsters`) | a mass destroy of a grown unit (kit / spell death path through `sourceOwnsDeath` or our egg death) |
| `kaChGrownMirror` | grown attacks; P2 has `mirror_barrier` set | the trap's intercept keeps the grown inhale (`soundsOfUnit` at `_mirror_v3.ts:1574`) and destroys a grown body |
| `kaChGrownBond` | grown in attack; P1 equips `dragon_blade` | the Ejder Kılıcı bond plays the grown `victory` (§4.11) |
| `kaChWinBaby` / `kaChWinGrown` | the opponent at 1000 LP; the hatchling (baby / grown) attacks directly for the win | `victory` from `v3small/end.ts` in both forms |
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
node tools/shot.mjs "?dev=hatchling&mode=wyrm" --out $O/kk1-wyrm.png                 # grown vs crystal_wyrm at 1×, no labels
node tools/shot.mjs "?dev=hatchling&mode=board" --film 18 --every 110 --cols 6 --clip 250,100,120,90 --scale 3 --out $O/ring-orbit-x3.png   # the waist ring's direction
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
  - The 1× read test: "baby dragon with an egg on its tail" and "grown cloud dragon / cloud lion with a ring", with no labels.
  - **The wyrm gate (critique 2, #13):** `kk1-wyrm.png` shown blind to a critic who has not read this doc. It fails if the grown form is described as "a small crystal wyrm", "a white dragon" or "the same dragon". Redraw before anything else if it fails.
  - **The ring orbit gate (critique 2, #7):** on `ring-orbit-x3.png` the puffs visibly advance one way (⅓ spacing per frame), never flicker between two states.

### 9.2 Films (LOOK at every PNG)
```sh
for s in kaChSummon kaChSummonP2 kaChRevive; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 24 --every 100 --start 200 --cols 6 --out $O/$s.png; done
for s in kaChAtk kaChAtkP2 kaChAtkWeak kaChDefWin kaChDirect kaChDirectP2 kaChBlocked kaChLose kaChLoseP2 kaChTie \
         kaChGrownAtk kaChGrownAtkP2 kaChGrownDirect kaChGrownBlocked kaChGrownLose; do
  node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 20 --every 100 --start 200 --cols 5 --out $O/$s.png; done
for s in kaChHit kaChKill kaChKillP2 kaChKillPhys kaChGuardKill kaChBolt kaChPos kaChFlip \
         kaChGrownKill kaChGrownGuardKill kaChGrownHit kaChGrownPos kaChGrownIdle kaChGrownIdleP2; do
  node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 16 --every 100 --start 200 --cols 4 --out $O/$s.png; done
for s in kaChGrow kaChGrowP2 kaChGrowDef kaChGrowTwo kaChGrowLose kaChGrowBorrowed kaChRewound kaChGrownRewound \
         kaChGrownControl kaChGrownResync kaChGrownChains kaChGrownEquip kaChGrownVenomHit kaChGrownAshenKill \
         kaChGrowWipe3 kaChGrownHat kaChGrownBounce kaChGrownVoid kaChGrownMirror kaChGrownBond kaChWinBaby kaChWinGrown b2CoinWinAuto b2CoinLoseAuto; do
  node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 40 --every 120 --start 0 --cols 8 --out $O/$s.png; done
node tools/shot.mjs "?dev=duel&s=kaChGrow&look=v3&speed=3" --fresh --film 40 --every 40 --start 0 --cols 8 --out $O/kaChGrowFast.png
# the signature beats frame by frame at 3x (find the times with measure first):
node tools/shot.mjs "?dev=duel&s=kaChAtk&look=v3" --fresh --film 24 --every 17 --start <contactMs-250> --clip 260,90,260,150 --scale 3 --cols 6 --out $O/ring-x3.png
node tools/shot.mjs "?dev=duel&s=kaChGrow&look=v3" --fresh --film 48 --every 34 --start <growStart> --clip 200,80,240,170 --scale 3 --cols 8 --out $O/grow-x3.png
node tools/shot.mjs "?dev=duel&s=kaChKill&look=v3" --fresh --film 60 --every 17 --frames $O/killframes --out $O/kill-all.png
```
- **Must see:**
  - the ring is hollow and 2 px, and one ring at a time;
  - the dial is hollow, made of cloud (gold only on the 12 pip) and runs clockwise; two hour-puffs fall on each growth frame and land on the baked ring's pixels at f11;
  - the motes rise on an open spiral (never a second closed ring);
  - six distinct growth frames, readable at 1×;
  - the stat beat plays right after the swap, on the grown body: the delta number **"+1200"** (heal kind) pops at the grown crown, the badge rolls 1100 → 2300, and the plate never shows 1100 again (the number is the delta, not "2300"; critique 2, #12);
  - the staring loop never holds one frame > 200 ms through the coin, the wipe and the hook's dial build (`kaChGrowWipe3`);
  - the six hiccup steps land on f6–f11 and the roar on f13 (`kaChGrow-steps.mp4`, `kaChGrow.mp4`, `kaChGrow-x3.mp4`);
  - the cloud shadows (summon, float) are local dithered ellipses: the rest of the arena never darkens;
  - the wind ring is a leaning open ellipse that matches the travel diagonal, and the grass patches blink out tile by tile;
  - the egg float never moves a still frame (the float frames change with every rise step);
  - **no pop on the swap frame**;
  - the grown form in every later frame of `kaChGrownResync` / `kaChGrownControl` / `kaChGrownHat` (both sides, lit from the screen's top left), including the first frame of every unit a cinematic builds;
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
node tools/clip.mjs "?dev=duel&s=kaChGrow&look=v3" --music off --marker hatchVoiceDrop --out $O/clips/kaChGrow.mp4
node tools/clip.mjs "?dev=duel&s=kaChGrow&look=v3&speed=3" --music off --marker hatchVoiceDrop --out $O/clips/kaChGrow-x3.mp4   # the marker box on special f13 at 1× and 3×
node tools/clip.mjs "?dev=duel&s=kaChGrow&look=v3" --music off --marker hatchGrowHic --out $O/clips/kaChGrow-steps.mp4   # the six steps on f6–f11
node tools/clip.mjs "?dev=duel&s=kaChSummon&look=v3" --out $O/clips/kaChSummon.mp4      # with music (ducking)
node tools/clip.mjs "?dev=duel&s=kaChKill&look=v3" --music off --marker hatchLullaby --out $O/clips/kaChKill.mp4
node tools/clip.mjs "?dev=duel&s=kaChGrownAtk&look=v3" --music off --marker hatchGrownRingBoom --out $O/clips/kaChGrownAtk.mp4
```
| Moment (game ms at 1×, action → input return) | Limit | Target |
|---|---|---|
| summon (normal) | ≤ 3340 (YENI 2.3 s × 1.45) | ≈ 2800 |
| attack vs monster (+ target death) | ≤ 3190 | ≈ 2900 |
| direct | ≤ 2320 | ≈ 2150 |
| declaration | ≤ 435 | |
| destroy (our egg death) | ≤ 2030 | ≈ 1600 |
| growth (the hatchling's `activate` event, start → end) | ≤ 4060 (YENI 2.8 s × 1.45) | ≈ 3300 (defense ≈ 3450) |
| revive | ≤ 3050 | |
| position | ≤ 580 | |
| flip | ≤ 870 | |
| LP flow | ≤ 400 | |

- The number appears at contact ±17 ms.
- `palcheck`: off-palette Δ ≤ 1 pt vs frame 0, white ≤ 1.5 %, no row > 60 % white.
- Clips: true peak ≤ −1 dBFS, 0 clipped samples. The marker box is on the matching frame (SE-1, also at `&speed=3`).
- SE-4 LSD as in §6.3.
- **Badge check** (§10 R2): after `kaChGrow`, the plate never shows 1100 again, frame by frame across the batch end. (The console's "projection drift" line cannot catch this: `stateDiff` does not compare `permAtk`, `project.ts:321-344`.)
- **Lazy paint check** (§3.3 step 6): `kaChGrow`, `kaChGrownControl`, `kaChGrownHat`, `kaChGrownResync` WITHOUT `?test`: `sheetPaintStats()` / `frameCacheStats()` read through `--eval` show the grown keys painted in background slices before their first use, and no frame-time spike > 8 ms on the swap, the control change or the reveal.
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
  - `validateArt(art, { tier: 'normal', attack: 'projectile' })` is clean for BOTH arts, including §4.9's mandatory `summon` / `revive` on the grown art (special out documented);
  - drawing is deterministic;
  - both arts have the same anim list, and for every anim the same frame count and the same marks; the holds equal the §4 tables (grown ≠ baby except summon / revive / special, which are equal);
  - grown `summon` / `revive` / `special` frames are pixel-identical to the baby's (the delegated draw), P1 and P2;
  - the grown death f5 … f9 pixels equal the baby death f5 … f9 apart from the gathered cloud lobes (the un-aging lands on the baby);
  - the special f0–f2 staring cycle: f0 ≠ f1 ≠ f2 and Δ(f2, f0) small (≤ 0.5 idleΔ), so the ping-pong loops without a jump;
  - identical `w` / `h` / anchor / hover;
  - **Δ(baby special last frame, grown idle 0) = 0, P1 and P2**;
  - the head is taller than the body (the baby idle f0 head-ellipse rows > body rows);
  - grown idle f0: `leaf4` ≥ 40 % of the hide pixels (no drift toward the other greens);
  - the grown waist ring: 12 identical puffs; grown idle f(n) and f(n+3) have identical ring pixels and f(n), f(n+1) do not; `ringPuffs(0)` equals the ring pixels of special f11;
  - revive f0 is the curled ball (no closed egg);
  - the feet rows are fixed;
  - margins on every frame;
  - one glint per anim;
  - bytes within `--class medium`;
  - the card art (both sizes) within the KART_RESIMLERI §10 numbers.
- **`tests/art/variants.test.ts`:**
  - `slotVariant` is null without `LOOK_V3`, `'grown'` with `permAtk`, null without it. `LOOK_V3` is a module-level constant, so each case uses `vi.mock('../../src/view/layout', …)` with `vi.resetModules()` and a dynamic import;
  - `variantSheetKey` P1 / P2 names;
  - `rewindAnims`: `[summon↺]` without a variant, `[special↺, summon↺]` for `grown`;
  - registering does not add `cloud_hatchling` twice to `REGISTRY_V3`.
- **`tests/cinematics/project-jester.test.ts`** (with the `project.ts` change): `projectBatch` over a real `callCoin` win batch: `snaps[n]` has `permAtk` 1200 / `permDef` 800 on exactly the growing slots and the same `permAtk` / `permDef` as `after` on every slot (asserted directly: `stateDiff` does not compare them, critique 2, #14).
- **`tests/duel/unit-variant.test.ts`**: `syncUidVariants` writes / drops the uid entries from a state; `onBuilt` grows a unit built for a mapped uid; `animKeyFor` returns `mon:cloud_hatchling:grown:<anim>` only for a grown unit; `setUnitVariant` is upgrade-only.
- `tests/presentation/recipes.test.ts` covers the recipe automatically.

### 9.5 Critique rounds (≥ 3, independent critics, findings with rule ids)
- **Round 1:** the two idle f0 references + the idle / guard sheets of both forms.
- **Round 2:** every sheet ×3, P1 / P2, plus the attack, summon and growth films.
- **Round 3:** every film + the clips + the gates + a blind 1× read by an outside critic.
- Log the evidence paths in `docs/v3/oturum-a.md`.

---

## 10. Risks and open questions

### Risks
1. **R1: shared-file edits for the variant.** `MonsterUnit.ts` (≈ 14 lines), `FieldView.ts` (2 lines), `project.ts` (≈ 5 lines) and `scenario.ts` (2 lines) are shared, not owned by this card. Five lanes merge `MonsterUnit.ts`, so the logic lives in the new `src/duel/unit-variant.ts` and only hooks go into the shared file.
   - They are additive and no-ops for every other unit. filmdiff proves v1.
   - **Orchestrator approval is needed before the build.** The fallback, if refused, is much weaker: an aura image over the unit showing grown frames while the baby sprite is hidden. Every kit would then fight the hidden sprite, so it is not recommended.
2. **R2: the badge rollback.** Without the `project.ts` precondition it WILL happen (not "may"): the frontier sync after our hook calls `setStats(1100)` and drops the uid from the variant map for the rest of the batch. The precondition is part of Q1, not optional. Verify on film (§9.3) and with the direct `snaps[n]` test; the console's drift log cannot see it (`stateDiff` ignores `permAtk`).
3. **R3: other cards read baby pixels, the baby sheet key or the baby voice.** The full list is §3.3 step 8. Mitigation: one orchestrator pass (`unitFrame`, `unitSheetKey`, `soundsOfUnit`; byte-identical for everyone else) and a variant-aware `shatter` cache key. Film `kaChGrownKill`, `kaChGrownGuardKill`, `kaChGrownChains`, `kaChGrownMirror`, `kaChGrownEquip`, `kaChGrownVoid`, `kaChGrownVenomHit`, `kaChGrownAshenKill` before and after.
4. **R4: the light layer.** The glow sheet and the pool radius are per card id (`view/light/glow.ts`, `LightLayer.ts`). Phase 1 uses no emissive (§1.5). Phase 2 adds a variant-aware `glowSheet(scene, id, art = monsterArt(id), key = id)`: additive, ask.
5. **R5: lane D sequencing and the rewind contract.** Send these lines to lane D through the orchestrator:
   - their final coinToss / massDestroy handlers must leave the hatchling's `activate` + `statChange` events to the Director (or play them via `ctx.play(i)`); consuming them without playing would skip the growth;
   - their "bilemedi" rewind of their own monsters registers a `destroys` hook keyed by `dial_jester`, so our death steps aside (`sourceOwnsDeath`);
   - their rewind of any victim calls `rewindAnims(u.cardId, variantOf(u))` (§3.3 step 9), plays the steps with `u.pose` on the unit's own anim keys, and may play `rewindSfx(...)`;
   - their final coinToss / massDestroy / destroy chain may take as long as it likes: our staring loop follows our own `activate` (§5.6), not their timings;
   - our `coinToss` observer only sets frames on a visible, unlocked hatchling and never draws; if their coin claims or locks our unit, the observer does nothing.
6. **R6: the sheet budget.** 139 frames per form at 82×78 are 3.56 MB, under 3.6 only with `--class medium`, and 139 is one under the 140-frame cap. Anything that grows a count must take a frame elsewhere (first candidate: merge revive f6 / f7). If the gate insists on `small` (2.2 MB), cut the special to 14 f, the summon to 12 f, victory to 4 f and narrow the frame to 80×76, or ask for the class.
7. **R7: noise.** Cloud lobes and shell speckles push IŞ-10. Keep lobes ≥ 2×2 and speckles only on the shadow plane. The waist ring has exactly 12 identical puffs (this replaces the earlier "≤ 10 puffs": 12 is needed for the hour symbolism and the 2-frame repeat, §4.1); if IŞ-10 fails, make each puff 3×2 instead of 3×3, never fewer puffs.
8. **R8: comic timing vs budget.** The attack's "ha… ha…" and two hops must fit 2.2 s with the target's death. Measure first; trim the flight and hops, never the 160-ms "ha…" frame.
9. **R9: the special's out exception** must be accepted by the critic and `validateArt`. If `validateArt` refuses `end: 'hold'` on a special, patch the last frame through `AnimDef.frames` and document it. The special's marks now pass HA-1 / HA-3 (release = impact = f13, 70 ms); the growth frames are driven by `atFrame`.
10. **R10: two hatchlings at once** (`kaChGrowTwo`): two dials on adjacent tiles. Cap the dial radius at 22 px (tiles are 64 wide). The staggered start keeps the sounds apart; the second dial's fwips are panned with its tile.
11. **R11: the observers.** The `coinToss` staring loop and the summon cloud are fire-and-forget. Each one checks `u.retired` / `u.locked` on every step. The staring loop ends on its own activate's state (claimed by our hook, or consumed by someone else), never on a guessed timer; its 20 s cap and the summon cloud's 6 s cleanup are last-resort guards, so a replay or a lane-D change can never leave a held frame or a stray cloud.
12. **R12: the grown art is a grid sheet with id `cloud_hatchling`.** Safe only while `cropsArt` stays registry-identity (`textures.ts:96`). If anyone later makes non-registry arts cropped, `frameKey` must first gain a variant tag (`textures.ts:141`), or the grown frames collide with the baby's in the global pinned / LRU maps. A unit test pins `cropsArt(cloudHatchlingGrown) === false`.

### Open questions (orchestrator / owner)
- **Q1.** Approve the variant mechanism edits: `MonsterUnit.ts` hooks (`sheetFor`, `animKeyFor`, `onBuilt`, `setArt`, `ownsKey`), `FieldView.ts` (2 lines), `project.ts` (a precondition, shared with lane B's `boostAtk`), `scenario.ts` `MonSpec` (R1, R2)?
- **Q2.** Approve the one-pass sweep of §3.3 step 8 (`unitFrame`, `unitSheetKey` in the two warmers, `soundsOfUnit` at `holdCharge`, `_mirror_v3.ts:1574`, `chains_of_light.ts:560`, `_v3/death.ts:347,416`) and the variant-aware `shatter` key (R3); `VARIANT_SOUNDS` (§6.4, a ship requirement); optionally the variant-aware glow (R4)?
- **Q3.** Size class: may both sheets be gated as `medium` (3.6 MB) because the card spills to 64 (R6)?
- **Q4.** Idle hiccup sound: the R1 plan asked the same. There is no ambient idle-sound system, so the hiccup is heard only at the beats where a cinematic plays it (summon end, the coin look-up). Is an ambient tick wanted?
- **Q5.** Own struck-body sound `hatchhide` (§6.5 phase 2)?
- **Q6.** A grown hatchling returned to the hand or deck and summoned again is a baby (the slot's `permAtk` ends with the slot, M14). Confirm that this is the intended reading of "kalıcı" (permanent while on the field).
- **Q7.** Forward the rewind contract (R5) to lane D, now played on the unit's own anim keys (§3.3 step 9).
- **Q8 (owner).** YENI §5.1's C3 row hears the growth as an "ileri cırcır" (a forward ratchet). This design drops it: a ratchet is C2 `dial_jester`'s distinguishing layer, and the growth plays in the same batch right after their coin, so two ratchets back to back would blur both cards (SE-4). In its place: circling air pulses, a shell creak on every second one and the stepped hiccup voice (§6.2). Sign off the deviation, or name the forward sound you want.

---

## Critique log (round 1, independent critic)

(Section and step numbers in this table are revision 2's: §3.3 steps were renumbered in revision 3.)

Every claim was checked against the tree before acting on it.

| # | Sev. | Finding | Verified | Resolution |
|---|---|---|---|---|
| 1 | BLOCKER | consumed `statChange` never plays | Yes: `consumeAt` sets `started` (`Director.ts:318-320`), `play` returns on `started` (`:322-324`) | §5.6: only sibling `activate`s are consumed; `ctx.play(firstStatIdx)` on the roar mark, awaited with the tail; the stats handler groups the rest (`flow/stats.ts:71-78`) |
| 2 | BLOCKER | frame / byte budget (end frames) | Yes: `appended = def.end !== 'hold'` (`rigkit/anim.ts:172,190`) | §4 restated as "beats + end"; idle 22 → 18 f (1890 ms); `endMs` 70–80 on the reactions; hit 500 ms; toGuard / fromGuard / roar / summon cut by one beat. Total 131 f, 3.43 MB (grown 90 f, 2.36 MB) |
| 3 | MAJOR | badge rollback is certain | Yes: `project.ts:115` returns on `monsterEffect`, `:132` ignores `statChange`; `syncFrontier` after every event (`Director.ts:125`) | §3.3 step 5: the `project.ts` `permAtk` / `permDef` change is a precondition; test added (§9.4); R2 rewritten |
| 4 | MAJOR | sheet-swap claims partly wrong | Yes: the guard at `MonsterUnit.ts:188`; Phaser `setFrame` on a missing name gives `__BASE` | §3.3 step 3: `ownsKey` guard, base-key fallback in `syncSheet`, `setFrame` switches to `p1Key` first |
| 5 | MAJOR | grown hatchling rewound by an opponent's jester | Yes: YENI C2 §4 rewinds every destroyed opponent monster via its summon reversed | §3.3 step 7: `rewindAnims` / `rewindSfx` contract for lane D; scenarios `kaChRewound`, `kaChGrownRewound`; preview `mode=rewind` |
| 6 | MAJOR | growth timeline contradicts the holds | Yes (the old table ran f6 at 800 vs 680 from the holds) | §5.6 rebuilt from the holds: f0 held 360 ms for the dial build, `playFrom(…, 1)`; every beat via `atFrame` / `atMark`; f6 950, f11 1410, roar 1610, swap 2030 |
| 7 | MAJOR | growth from defense over budget | Yes (≈ 4.3–4.6 s game) | fromGuard under the dial build, toGuard in the idle tail: ≈ 3.45 s game; `kaChGrowDef` measured in round 1 of the build |
| 8 | MAJOR | summon over budget | Yes: `slamToZone` 340 ms is awaited before the v3 entrance (`summon-a/_kit.ts:643-665`) | §5.1: the cloud drift moves to a `summon` observer (runs during the slam); sag 60 ms; wobbles 150; summon 1390 ms; ≈ 2.8 s game |
| 9 | MAJOR | the revive path does not exist in v3 | Yes: `recallV3` consumes the summon (`soul_recall.ts:1149`) | §5.7 path removed; §4.9 revive redesigned with a curled-ball bridge f0 for recallV3's ghost; only `reviveGather` / `reviveLand` reach the card |
| 10 | MAJOR | `dissolvePass` is the wrong API; `shatter` paints baby pixels | Yes: `rigkit/passes/dissolve.ts:36` takes a `PartComp`; `shatter` keys by id and tests `monsterP2TextureKey` | §5.5: own `eggScatter` from `unitFrame(u, 'death', 9)`, whole-px clusters, stepped blink; §3.1 note |
| 11 | MAJOR | dial + ratchet collide with C2 | Yes: YENI §5.1 C2 row "dişli cırcırı, geri sarılan saat" | sky dial (cloud-puff rim, `water4` ticks, wind-streak hands, gold only on the 12 pip); `hatchGrowRatchet` removed → `hatchGrowFwipA/B` circling air pulses, shell creak every second one |
| 12 | MAJOR | incomplete list of baby-pixel readers | Yes: `strikes-b/_kit.ts:164,188,213`, `vfx/shatter.ts:105,138`, `duel/warm.ts:82-92` | §3.3 step 6: full table, one `unitFrame(u, anim, f)` helper and one orchestrator pass; scenarios `kaChGrownChains`, `kaChGrownEquip`, `kaChGrownVenomHit`, `kaChGrownAshenHit` |
| 13 | MINOR | shrink the `MonsterUnit.ts` edit | Agreed | ≈ 12 lines of hooks (`sheetFor`, `setArt`, `ownsKey`, fallbacks); the state lives in `src/duel/unit-variant.ts` (`WeakMap`) |
| 14 | MINOR | two rings in the growth | Yes | the motes rise on an open spiral; the dial rim IS the waist ring (bold idea 2), so one ring |
| 15 | MINOR | 3-tone 2-px ring band | Yes | `white` lead + `mist` in the band; `steel` only as a 1-px trailing back-half arc; four hand-tabled sizes; apparent aspect 1 : 2 stated |
| 16 | MINOR | waist ring vs the HA-21 phase gate | Yes | identical evenly spaced puffs, 1/24 turn per frame (repeat every 2 frames), whole-puff steps in one-shots. Changed to **12** puffs instead of 11: 12 = the dial's hours (bold idea 2), and the 18-f loop still wraps (18/24 turn = 9 puff spacings) |
| 17 | MINOR | growth frames too short | Agreed | 85 ms each, f8 and f11 at 120 ms; time taken from f12 / f14 |
| 18 | MINOR | SE-4 misses the growl roars | `wyrmRoar` verified (`slice.ts:128,136`); `ashenRoar` is in the lane-mate plan (`ashen_drake.md:492`), not yet in the tree | SE-4 rows added (measure both pairs); `hatchVoiceCrack` / `hatchGrownRoar` formants → [520, 1250, 2600] + the sung whistle layer (1175 → 2349 Hz, −12 dB) |
| 19 | MINOR | grown palette drift | Agreed | `leaf4` stays the dominant lit plane on the grown form; only the wing membrane is more saturated; a ≥ 40 % `leaf4` test |
| 20 | MINOR | death has no margin | Yes (0–1380 vs 1.4 s) | float 300 ms, scatter on its last 100 ms: ≈ 1150 ms |
| 21 | MINOR | grown inhale under `holdCharge` | Yes: `holdCharge` reads `soundsOf(u.cardId)` (`_v3/sound.ts:250-251`) | `VARIANT_SOUNDS` + `soundsOfUnit(u)` is now a ship requirement (§6.4, Q2) |
| 22 | MINOR | scenarios | Yes: `coinWipe` is legal only with an opponent monster (`legal.ts:123`); `b2CoinWinAuto` / `b2CoinLoseAuto` stage this card (`b2.ts:107-115`) | `kaChGrow` stages `magma_titan`; `kaChGrowBorrowed`, `kaChGrowFast` (`&speed=3`), and both `b2Coin*Auto` films added |
| 23 | MINOR | tests and memory | Agreed | `vi.mock` + `resetModules` for `LOOK_V3`; optional `cropsArt || isVariantArt` listed in §8.4 / Q2 |

**Bold ideas**
- **Un-aging (adopted):** the rewind contract plays the special backward, then the summon backward; `hatchVoiceCrackRev` is offered to lane D as the per-victim voice (§3.3 step 7, §5.6, §6.2).
- **The ring is made of years (adopted, adapted):** not a ring per revolution (that would break EF-7's one ring per effect), but a dial whose rim IS 12 hour-puffs; each of the six revolutions sweeps two of them down to the waist, landing on the baked ring's exact pixels at f11 (§5.6).
- **Cause before effect (adopted in part):** a `coinToss` observer makes the baby look up and hiccup at the coin and hold special f0, so our growth opens on the same frame. The cowlick that stands up exactly on lane D's "BİLDİ" reveal was rejected: it needs lane D's internal reveal time, which breaks "no dependency on lane D".


## Critique log (round 2, independent critic → revision 3)

Every claim was re-checked in the tree before acting on it. All 19 findings were valid; none was rejected outright (#15 was resolved by dropping the option it criticised).

| # | Sev. | Finding | Verified | Resolution |
|---|---|---|---|---|
| 1 | BLOCKER | the observer / hook hold special f0 for seconds; the 6 s timer can fire first | Yes: events run one at a time (`Director.ts:120-126`); HA-2 ≤ 200 ms (`REHBER.md:207`); observers get the full ctx incl. `findType` / `isConsumed` (`Director.ts:206-211, 300-310`) | special f0–f2 redrawn as a loopable staring cycle (§4.10); the observer loops it at ≈ 120 ms per step and exits on its own `activate`'s state (claimed by our hook / consumed by someone else), no timer; the hook continues the loop through the dial build; `kaChGrowWipe3` (§5.6, §8.5) |
| 2 | BLOCKER | the grown art without summon / revive fails `validateArt` and forces the risky fallbacks | Yes: `MANDATORY` incl. `summon`, `revive` in every tier (`rigkit/validate.ts:49,100`) | the grown art has the full anim list; `summon` / `revive` / `special` delegate to the baby shell's draw (§3.1); the `syncSheet` base-key fallback and the `setFrame` switch are dropped; `rewindAnims` is played on the unit's own anim keys (§3.3 steps 3, 9) |
| 3 | BLOCKER | cinematics build units through `FieldView.addUnit` before the next sync | Yes: `FieldView.ts:140-163`; `hideBehindHats` keeps the slot and its `permAtk` (`rules.ts:632-640`); the flips call `addUnit` (`summon-b/flip.ts:191`, `_defaults/summon.ts:186`) | a scene-scoped `uidVariants` map written by every sync (and by the growth hook) + `MonsterUnit.onBuilt` at the end of the constructor: every construction path is grown on its first frame (§3.3 steps 2, 3, 5); `kaChGrownHat` |
| 4 | BLOCKER | `hatchVoiceCrack`'s roar arrives 360 ms after f13 | Yes (growl at +0.36 s of a sound fired on f13) | adopted the bold idea "voice breaking in steps": `hatchGrowHic` on f6–f11 (D6 B5 G5 E5 D5 A4), `hatchGrowGasp` on f12, `hatchVoiceDrop` with its onset at t = 0 fired on f13 (§5.6, §6.2); clip markers at 1× and 3× (§9.3) |
| 5 | MAJOR | `lightDim` is a whole-arena dim | Yes: `view/light/index.ts:160-170` | `lightDim` is never used; `cloudShadow` = an ink 2×2-dither ellipse raster at `DEPTH.SHADOW` (the `shadowKey` algorithm, `MonsterUnit.ts:71-90`), resized in whole px (§5 intro, §5.1, §5.5) |
| 6 | MAJOR | the egg float moves a held frame (HA-11) | Yes: `REHBER.md:298` | death 10 → 13 frames: three float frames (egg rock, travelling glint, cloud lip phase) played as a ping-pong; the sprite rises only on their frame changes. Holds re-cut so death stays ≤ 900 ms with dissolve at 300 / 310 ms (§4.8, §5.5) |
| 7 | MAJOR | 1/24 turn per frame flickers between two states | Yes (a half-spacing alternation) | 1/36 turn per frame: repeats every 3 frames, 18 frames = ½ turn, worst deviation ⅓ spacing; a ×3 direction strip gate (§4.1, §9.1) |
| 8 | MAJOR | the wind ring's shape ignores the iso duel axis | Yes: opposite lane = (+64, −32) px (`layout.ts:25-42`) | the ring lies in span(vertical, column direction (32, 16)): an open ellipse ≈ 1.2 D × 0.74 D leaning ≈ 32° from vertical; rasterised per (D, travel sector), P1 / P2 sectors mirrored; squeeze and rebound use the same table (§5.2, §5.4). My derivation gives ≈ 32° off vertical for the major axis rather than the critic's 26.6° (which is the column slope itself); the build checks it on a ×3 strip |
| 9 | MAJOR | one shared `AnimSpec` makes the grown a re-skinned baby | Yes: 7 `monsterAnimKey(this.cardId, …)` sites in `MonsterUnit.ts` (533, 551, 596, 667, 807, 820, 911); `createSheetAnims` already makes `<key>:<anim>` per sheet (`textures.ts:362-378`) | same frame counts and marks, own hold tables (§4); `MonsterUnit.animKeyFor` hook plays `mon:cloud_hatchling:grown:<anim>` (§3.3 step 3) |
| 10 | MAJOR | the grown voice misses the trap and kit-death sites | Yes: `_mirror_v3.ts:1574`, `chains_of_light.ts:560`, `_v3/death.ts:347,416`; `takeCharge` swaps on a name change (`_v3/sound.ts:267`) | all four join the `soundsOfUnit(u)` sweep (§3.3 step 8, §6.4); grown `deathStart` `hatchGrownCurl` + `hatchUnAge`; the knit / lullaby / float stay the baby's on purpose (the grown death un-ages into the baby, §4.8, §6.2); `kaChGrownMirror` |
| 11 | MAJOR | grown sheets are warmed only for one side and only at the coin call | Yes: `finishBase` on `textures.get` (`textures.ts:971-983`); `warmPoses` / `warmBond` warm `monsterSheetKey` (`_v3/warm.ts:26`, `spells/_blade_v3.ts:371`) | `warmVariant` warms both players' grown sheets at the coin call, the hook start and `setUnitVariant`; `unitSheetKey(u)` in both warmers (sweep); a lazy-paint check without `?test` (§3.3 step 6, §9.3) |
| 12 | MAJOR | the stat beat on the roar frame lands mid-neck and crowds the roar; the number is the delta | Yes: `statBeatV3` uses `u.worldPoint('top')` (`flow/stats.ts:206`) and `impactNumber(…, delta, { kind: 'heal' })` | `ctx.play(firstStatIdx)` right after the last sibling's swap (end of f15); §9.2 now says "+1200", badge 1100 → 2300 (§5.6) |
| 13 | MAJOR | the grown silhouette is too close to `crystal_wyrm` | Agreed (an upright, S-necked, pale seated dragon with half-open wings is the wyrm's read) | the adult is a low, wide, seated four-legged cloud lion-dragon; a huge cloud mane is the main mass, wings folded into it, short round muzzle, horns buried; explicit blind 1× wyrm gate (§1.1, §2, §9.1); growth frames re-planned (§4.10) |
| 14 | MINOR | `stateDiff` ignores `permAtk` | Yes: `project.ts:321-344` | the "projection drift" claims removed; the test asserts `snaps[n]` slots directly; one `project.ts` change shared with lane B's `boostAtk` (§3.3 step 7, §9.3, §9.4) |
| 15 | MINOR | optional `cropsArt || isVariantArt` collides in `frameKey` | Yes: `frameKey` = `${art.id}|anim|frame` (`textures.ts:141`); pinned / LRU are cropped-only and global | option dropped; R12 + a unit test pin the grown art as a grid art (§8.4, §10) |
| 16 | MINOR | `victory` is played | Yes: `_blade_v3.ts:351` (bond pose) and `v3small/end.ts:780` | a 5-frame victory in both forms (139 frames ≤ 140); `kaChGrownBond`, `kaChWinBaby`, `kaChWinGrown` (§4.11) |
| 17 | MINOR | the VenomHit / AshenHit scenarios kill the target | Yes: `venom_drake` 2000, `ashen_drake` 2400 vs grown DEF 1700 | `kaChGrownVenomHit` stages the grown in attack (2300 > 2000: the target survives); `kaChGrownAshenKill`; added `kaChGrownHat`, `kaChGrownBounce` (`homecoming`), `kaChGrownVoid` (`void_eye`) (§8.5) |
| 18 | MINOR | sounds overrun their pictures; the ratchet deviation is unrecorded | Yes | `hatchGrowWind` built 1.6 s; `hatchVoiceDrop` 0.7 s; `hatchLullaby` ≈ 0.7 s; the dropped "ileri cırcır" is **Q8** for the owner (§6.2, §6.3, §10) |
| 19 | MINOR | hiccup ring hole, fast hand jumps, P2 puff slots, `when` key | Yes | hiccup ring 4×6; a stepped `mist` sweep wedge for revolutions 2–6; `ringPuffs` through `u.framePoint`; `when` keyed on `jesterAging` (§4.1, §5.6, §4.12, §3.3 step 1) |

**Also fixed while re-checking `validate.ts` (not in the critique):** revision 2's special had `release` f6 ≠ `impact` f13 (HA-1) and an 85 ms release (HA-3): now release = impact = f13 at 70 ms; the attack and roar end frames were shorter than their last recovery frames (HA-3): recoveries now lengthen to the end; hit's recover started at 190 ms (HA-4 needs 240–370): now 240. The frame is narrowed to 82 wide so 139 frames fit 3.6 MB.

**Bold ideas**
- **Voice breaking in steps (adopted):** six hiccups a step lower on the six growth frames, the break on f13 (§5.6, §6.2). It also solves finding 4.
- **Grown keeps one baby habit (adopted):** the grown idle's f13–f16 hiccup with a fat ring from the big jaw, no extra frames (§4.1). Its sound follows Q4 (no ambient idle sound system today).
- **The ground remembers the sneeze (adopted):** flattened-grass annuli per crossed tile, blinking out in three palette steps over ≈ 1 s (§5.2).
- **"It was always the baby" (adopted):** the grown death un-ages over f3–f5 into the baby's ball, and the SMALL original egg knits shut; the shed mane / ring cloud becomes the float cloud (§4.8, §5.5). It replaces revision 2's big egg.

## Build log
- 2026-10-31 — shared-infrastructure step (one agent, before the builders): the approved shared hooks for this
  card are in; see `docs/v3/oturum-a.md` → "Shared infrastructure (lane A)" for the exact API, the files and the
  gate results. Placeholders the builder now owns and tunes are listed there (material defs, the
  `ash` / `acid` shatter and accent values). No card art, cinematic or sound was made in this step.
  - Deviations: `MonsterUnit` also has `static animSheetFor?` + field `animSheetKey` (for `ownsKey`); `unitSheetKey(u)`
    returns `monsterSheetKey(id, player)` for a unit without a variant (keeps its lazy-P2 side effect byte-identical);
    `warmPoses` stays id-based for summons, the declaration uses the new `warmUnitPoses(u, …)`. The variant's rewind
    steps / voice are data on `registerMonsterVariant` (`rewind`, `rewindSfx`). `hatchhide` is in
    `GENERATED_HIT_MATERIALS` already; with `sound: { same: 'cloth' }` it plays cloth until its own sound is set.
