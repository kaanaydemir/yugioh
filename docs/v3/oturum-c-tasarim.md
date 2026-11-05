# Lane C — distinctness bible (art and sound direction)

> **Status: BINDING** for lane C (`claude/kart-c`): tide_harpooner (C1), reed_heron (C8), crag_axeman (C7),
> kite_fencer (C9), steppe_spiralhorn (C11). Written by the lane-C art and sound director on 2026-10-31,
> working from base 684e290 plus the lane-C status doc.
> Order of authority: CLAUDE.md golden rules > this file (for lane C) > `docs/v3/YENI_KARTLAR.md` §6 storyboards >
> `docs/v3/REHBER.md`. Places where this file deliberately changes YENI_KARTLAR are listed in §0.4. Rule ids
> (IŞ, MA, Sİ, HA, SÜ, EF, SE, KK) are REHBER's.
> Sources: YENI_KARTLAR (all 30 cards, §5–§5.2, owner decisions), REHBER, GAME_DESIGN §5/§7, PARALEL_OTURUMLAR,
> TEMPO, and the code:
> - `src/cinematics/strikes-a|b`, `summon-a|b`
> - `_v3/sound.ts`, `_v3/presets.ts`
> - `audio/v3/kit.ts`, `voices.ts`, `materials.ts`
> - `presentation/cards/*`, `art/monsters-v3/*`
> - `view/light/profiles.ts`, `engine/query.ts`
>
> I also looked at screenshots and films. The roster sheet is `?dev=monsters&look=v3`. Board shots:
> `steel_silencer`, `seal_arm_r` and the lane-C placeholder totem. Film: `saGolemAtk`, 12 frames.

---

## 0. How to use this file

### 0.1 Time convention (read first)
- YENI_KARTLAR's seconds were written *before* the v3 tempo (×1.35) existed. If they were played as scene time, the
  in-game durations would break the gate: game time ≤ REHBER §5 × 1.45. For example, a 2.6 s attack × 1.35 = 3.5 s,
  which is more than the 3.19 s limit.
- **Rule:** the code (scene clock) total = YENI_KARTLAR seconds ÷ 1.25. The tempo then supplies the lengthening the
  spec asked for. Game time comes out at about spec × 1.08, which stays inside every gate.
- Every beat time in this file is in **scene ms** (the values you write in code).
- **Hit-stop values are the spec's code ms.** The tempo multiplies them in real time by about 1.55 on its own; do not
  pre-scale them.

| Moment | Spec | **Scene target** | Scene budget (REHBER §5) |
|---|---|---|---|
| C1 attack | 2.6 s | **2.05 s** (incl. declare) | 1.6–2.2 |
| C1 tribute summon (tribute stream + entrance + cut-in) | 2.4 s entrance | **≈ 2.8 s total** (entrance after slam ≈ 1.9 s) | 2.5–3.0 |
| C8 attack / summon | 2.4 / 2.3 | **1.90 / 1.80** | 1.6–2.2 / ≤ 1.8 (GAME_DESIGN normal summon) |
| C7 attack / summon | 2.6 / 2.2 | **2.05 / 1.75** | |
| C9 attack 1 / attack 2 / summon | 1.8 / 2.2 / 2.2 | **1.45 / 1.75 / 1.75** | |
| C11 attack / summon | 2.5 / 2.3 | **2.00 / 1.75** | |
| Any destruction (death anim ≤ 0.9 + card in graveyard) | — | **≤ 1.40** | ≤ 1.4 |
| Direct attacks | — | **≤ 1.65** | ~1.6 |

### 0.2 Lane-wide bans (the "shared tricks" that are already owned elsewhere)
Treat any use of these in a signature beat (summon, attack, impact, death, effect) as a failed critique.

**VFX**
- Wind rings or rings on the floor beyond the one EF-7 allows. storm_hawk and C3 already own them.
- Whirlpool, geyser or water spout. coral_serpent and tide_golem own them.
- Lava, ember or fire-coloured cracks. magma_titan and S10 own them.
- Star fissures lit by gold rune light. stone_sentinel owns them.
- Orbiting rocks.
- Hologram scan-builds longer than 300 ms (EF-11).
- Afterimage ghosts. ember_wolf and storm_hawk own them.
- Dives from the sky. storm_hawk owns them (§5).
- Climbing out of the ground. R2 and C10 own it (§5).
- Rubble, crumble or ash endings. R1 and stone_sentinel own them (§5.2).
- Foam-melt deaths (`rigkit/passes/foam`). The serpent and the golem own them.
- Glass shatter. The wyrm and C4 own it.
- Feather bursts. storm_hawk, R3 and C3 own them.
- `setScale` / `setAngle`, full-screen flashes, and any camera change (EF-8).

**SFX**
- The v1 shared recipes `whoosh`, `slash`, `bite`, `waterSplash`, `windGust`, `earthQuake`, `groundCrack`,
  `fireBurst`, `impactLight/Heavy`, `holyChime`, `roarBig/Small`. Every old monster uses them, so lane C does not use
  them at all, not even as a quiet fill.
- `glassBell` / `glassRain`. The wyrm, C2, C3 and C4 own them.
- `glassReverse`. R2 owns it.
- A single "pof". R3 owns it.
- A `drone` with a tritone. The magus owns it.
- A double low heartbeat. R1 owns it.
- The `rumble` voice palette. stone_sentinel owns it.
- `link` chain pings as an identity layer. S6, S8, R2 and the seals own them.
- Pentatonic note runs. S12 and the wyrm own them.

**Palette**
- `cyan*` / `crim*` never appear in a body, a VFX body or a light profile (they are the player colours).
- `teal*` (spell) and `mag*` (trap) are not used at all in lane C.
- The base lane-C light profiles (`src/view/light/profiles.ts`, own lines only) carry `cyan4` for C1/C8 and an
  identical leaf profile for C9/C11. They must be replaced as stated in each sheet (§2.x "Light").

### 0.3 One-line identities (the elevator test: a critic must be able to say these after one viewing)
| Card | Motif (owns it in the lane) | Body shape | Rhythm word |
|---|---|---|---|
| C1 Kabuk Zıpkıncı | spiral house + **rope** + **the pull**; beach (sand, foam, salt) | big round spiral with a mast in front | *twirl – throw – haul* |
| C8 Sazlık Balıkçılı | **stillness**, **mist**, dark still water, the **triple** | tall thin "?" with a long horizontal blade | *still … still … ta-ta-TAK* |
| C7 Kaya Baltacı | **the clean line** (Yarık): boulder cut, floor seam, own split | broad triangle with a half-moon on the shoulder | *spin – stomp-stomp-STOMP – CHOP* |
| C9 Uçurtma Eskrimci | **two different attacks**, **kite cloth** panels, **string**, lightness | small upright figure with a diamond behind | *flick!* / *rise … swiiing – cut* |
| C11 Bozkır Boynuzlusu | **spiral horns that sing**, grass wake, **seeds**, airborne threes | box on stilts with two corkscrews | *rear – bound, bound, BOUND – toss* |

### 0.4 Deliberate changes to YENI_KARTLAR (owner can veto)
1. **C11:** "her kalkışta … rüzgar halkası" becomes a **grass-wake fan** on the floor plus a **spiral horn-tip curl**
   in the air. Reason: wind rings belong to storm_hawk (summon and attack) and to C3 (its whole attack). See §3.3.
2. **C1:** the 220 Hz identity stays, but the rope tone always **glides** (196 → 247 Hz with friction). Only the conch
   rests on 220. Reason: polar_needle's idle is a steady 220 Hz hum (§5.1). See §3.3.
3. **C8 summon** darkens its own tile by one light step. It is the only entrance in the game that lowers light.
4. **C9 suit** is unbleached linen (`earth3/4`), not white. Reason: white or mist plumage is C8's.
5. **Time convention** of §0.1.
6. **Light profiles** as above.

---

## 1. Inventory — what is already taken

### 1.1 Monsters in the game today (code and screen; base 684e290)
"v1 art" means the old sprite with v3 signature cinematics (`strikes-a/b`, `summon-a/b`). "v3" means the redrawn rig
is registered. WIP or placeholder entries carry *planned* identities from the drafts; they still count for collisions.

| Card | State | Body plan / silhouette | Dominant palette | Entrance | Attack path | Impact | Death finale | Signature sound |
|---|---|---|---|---|---|---|---|---|
| crystal_wyrm ★ | v3 | winged dragon, biped, 96 | white hide, cyan glass, gold horns | prism shaft from the sky; descends wrapped in its wings | stationary **beam** from the mouth | crystal shards, prism ring, glare | freezes; glowing cracks; light drains; **glass shatter** (split / cracks / drain passes) | glass bar modes in E pentatonic, `glassRain`, deep formant roar |
| abyss_magus ★ | v3 | hovering robed caster with staff, hover 6 | void, night, mag eye | floor **tears into a void rift**; rises out of it | **orb projectile** with violet trail | vortex sucks in, then void burst | void pool opens; sinks; sucked down | D1/D2 detuned saw **drone + tritone**, pink breath, FM armour clank |
| magma_titan ★ | v1 (v3 WIP) | heavy humanoid, 80 | basalt + lava fire | floor splits, **lava gash**, bursts up | stomp, then lumbers forward leaving molten **footprints**, fist | lava explosion; **glowing cracks under the target** | veins cool; **rubble** | earthQuake, fireBurst, groundCrack, roarBig |
| coral_serpent ★ | v1 | coiled sea serpent | water blue, mag crest | flooded pool, **whirlpool, geyser**, water ribbon coils | stationary **water jet beam**, pierces | splash crown; droplets turn to puddles | turns to **sea foam**, spray | waterSplash, impactHeavy |
| ember_wolf | v1 | low quadruped, flame mane | grey + fire | ring of fire; runs around it; **leaps** into the centre | crouch, then **flaming arc leap with afterimages**, bite | flame fan, embers | flames gutter; ash-grey pixels | fireBurst, whoosh, roarSmall |
| tide_golem | v1 | heavy water humanoid | water + steel | inward ripples; **water spout** forms the golem | floor slam; **rolling wave** across the tiles | **foam crash**, wet patch | slumps into a **puddle** | waterSplash, whoosh |
| storm_hawk | v1 | small bird, 48, hover 10 | leaf green / white | **dives from the sky** down a wind spiral | climb, **corkscrew dive** (arc over the field for direct) | **three white-teal wind cuts**, feathers, **wind ring** | feathers explode; tumbles | windGust, slash, whoosh |
| stone_sentinel | v3 (A3 pilot, biped heavy) | stone golem with tower shield, moss | stone, gold4 runes, moss | **star of fissures**, rocks **orbit** and assemble | tears a **boulder** out of the floor; parabola throw | boulder chunks, dust, **cracks under the target** | cracks, runes gutter, **crumble to rubble** (stone-end owner) | `rumble` palette: brown noise + gravel |
| lumen_sprite | v1 | tiny fairy floater | gold / white | light shaft; a star spirals down; bloom | pirouette; **3 sparkles** on curved paths | star pops, rising chimes | light gutters; fireflies | holyChime |
| shade_assassin | v1 | crouched ninja biped | void, night | shadow pool; eyes; **rises from the pool** | sinks; **pool glides along the floor**; rises behind the target; **X cuts** | violet X, ink | drinks into its pool | slash, darkPulse |
| volt_lizard | v1 | quadruped lizard | gold, electric white | lightning strike, it is inside the bolt | crest charge wave; **zig-zag bolt** | electrified; scorch ring | shorts out; static ball | lightning, thunder |
| thorn_lurker | v1 | plant pod, 48 | leaf + mag thorns | floor bulges; vines erupt; pod bursts | **vines race along the floor**, whip | leaf slash, thorns | wilts into the soil; spores | bite, slash, groundCrack |
| steel_silencer | v3 | WIDE LOW **siege walker**, pile-driver arm + hex shield | copper (earth), steel, violet slit | "boot": folded, assembles from the feet up, stands | servo wind-up; **pile-driver punch** | metal (generic kit) | overload; knees give; plates shed | default kit + metal FM |
| seal_head / arm_r / arm_l / leg_r / leg_l | v3 | obsidian colossus parts (floating head; arms and legs out of a cracked floor) | basalt, obsidian, bronze, mag seal light | unsealing / **erupting from a cracked floor** | head: chain-snap lunge bite; arm_r: rising uppercut; arm_l: grasp and squeeze; leg_r: **rising stomp + hop**; leg_l: knee-ram sweep with drag chain | seal-light **shock ring**, floor cracks, rubble | the seal gives out; plates fall; the part sinks | chains (`link`), default kit |
| dusk_sorcerer | retired | — | — | — | — | — | — | — |
| hourglass_imp | WIP (excluded) | dwarf with a big hourglass | gold / light | — | — | **freeze** | — | owns **sand** (YENI_KARTLAR C2 note) |
| shield_titan | WIP (excluded) | giant behind a tower shield | stone | — | — | — | — | — |
| windmane_knight ★ | placeholder totem | heavy maned-helm knight, 80, EARTH | stone | (planned) | (planned) heavy charge | — | — | — |
| wing_lady | placeholder totem | **bird-winged lady with a short sword**, 48, WIND | — | — | — | — | — | — (**risk for C9**, §3.2) |

### 1.2 Other lanes' planned cards (YENI_KARTLAR §6–§8; collisions are checked against these too)
| Card (lane) | Silhouette / palette | Entrance | Attack path | Impact | Death finale | Signature sound (§5.1) |
|---|---|---|---|---|---|---|
| R1 ashen_drake (A) | vulture-perched ash drake; void / stone / fire | ash pile ignites; ash whirlwind builds it | **ash cone rolling along the floor** | delayed mass ignition | **ash pile** | 50 Hz double heartbeat; delayed "VUF" |
| venom_drake (A) | full redesign (TBD) | — | — | — | — | — |
| C3 cloud_hatchling (A) | chubby baby dragon; leaf / mist / gold / earth | egg drops from a cloud and hatches | two hops, then a **sneezed wind ring** | ring squeezes and breaks with "tıng" | re-knit into an egg; floats away | **rising whistle** 2→5 kHz, `glassBell` short |
| R2 grim_warden (B) | tall lantern ghost, "L" shape; void / steel / leaf3-4 | **grave mound**; climbs out | lantern full circle; shroud glides; smash + glaive | green burst | lantern breaks; empty shroud collapses | pendulum chain; **`glassReverse` siphon** |
| R3 wisp_imp (B) | feather-sheet ghost, 48; mist / white | **a feather pendulum falls**; feather fountain | homing feather darts; **6 micro pokes** | feathers stick | **feather pillow** at the LP panel | 5 kHz feather; **"pof"** |
| C10 mudgrasp_spirit (B) | half-buried clay spirit; earth / stone / void | **hands grip the tile edge** and pull up | thrown mud blob, arc | "şlap" | liquefies back into the tile | 600 Hz suction; moan |
| C6 hollow_ogre (B) | hollow-log giant; earth / leaf / void | **log drops vertically**; **bark splits open like a door from inside** | lift club, **two heavy steps**, **top-down smash** (hit-stop 100) | splinters, leaves, **purple pollen** | roots withdraw; one sprout wilts | 180 Hz wood creak; hollow "tok" |
| C2 dial_jester (D) | clock-dial jester; gold / mist | dial; pops out on a spring | wind-up somersault | coin edge; everything freezes | springs and gears | **3.2 / 2.6 kHz tick-tock**, brass |
| C4 reflection_archer (D) | archer + upside-down reflection; gold / mist / night / water | drop of light; mirror pool | twin arrows, above and below the floor | vertical line + mirror flash | reflection breaks; glass | 660 Hz plus a delayed octave |
| C5 scrap_raiders (D) | cart-tank with three goblins; stone / earth / leaf / fire | scrap heap falls; 3 hammer blows | bouncing charge; a goblin falls off | ram; bolts | the cart collapses; goblins flee | 70 Hz engine |
| C12–C15 polar (D) | magnetite tool-warriors; stone / steel / fire / water / gold | compass spin / anvils clamp / wire winds | field-line brackets / push waves / orbiting spikes / compass rose | **3 KLAKs** | pulled apart | **110/111 Hz beating; needle 220 Hz, anvil 82 Hz**, coil 147 Hz |
| S4 sweeping_gale (E) | — | — | green-white **broom sweep** of wind | cards fall off the platform | — | L→R wide noise |
| S5 winnow_sieve (E) | straw sieve | — | — | **grain**, **straw** blown away | — | 6 Hz shaking |
| S9 straw_decoys + token (E / D) | stakes, **straw**, crow | stakes drop from above | — | — | straw binding loosens | stake "tok", crow |
| S10 spite_axe (E) | **black iron axe**, ember cracks, **chains** | drops from the sky and **sticks in the floor** next to the monster | — | — | — | low beating drone; **chain**; wrenching creak |
| S2 / S8 | puppet strings; leash and shadow | — | **3 puppet hops** / walk | — | — | 5 string "tsing" / leather + chain |

---

## 2. Design sheets

Shared requirements for all five:
- Every anim is drawn for P1 and P2. P2 is drawn with `lightFrom: 'right'` and then `flipX` (IŞ-1/2).
- Hand maps come in `_L` / `_R` pairs.
- Outline is 1 px `PAL.ink`; light is never outlined (IŞ-9).
- No dither inside the body.
- KK-1: the reference idle f0 is drawn and approved before any anim.
- Mandatory marks: charge / release / contact / recover / land / dissolve (HA-1).
- `points().muzzle` must sit on the true source every frame (HA-25): harpoon head, beak tip, axe edge, rapier tip,
  horn tips.
- Frame budget ≤ 140 frames per card (KK-13).
- Each card writes its own `src/presentation/cards/<id>.ts` with tier and custom parts (all five need custom
  `strike`, `summon` and `death`), its own SFX file(s), and its own cut-in where it applies (C1 only).
- Never reuse the lane mates' set pieces.

### 2.1 C1 · tide_harpooner — Kabuk Zıpkıncı (★ ace, Sv5, size class 80)

**Identity:** an old hermit crab living in a giant spiral **conch** and fishing with a **rope harpoon**. It is the only
monster in the game that **does not travel to attack** and the only one that **pulls** its target.

**Silhouette and value plan**
- The conch is about 55 % of the bounding box: up and back, the apex pointing up-left.
- The crab's front comes out of the aperture facing right: two independent eye stalks, a big claw holding the
  harpoon, a small claw holding a rope coil.
- In idle the harpoon stands **planted upright** in front of him. Read: "a round spiral mass + one vertical mast".
- At release the harpoon is horizontal.
- Bbox target is about 60×66, roughly 2300 opaque px.
- Values: the nacre lip of the aperture and the harpoon tip are the brightest (card art: the harpoon tip is the
  brightest point). The aperture interior is the darkest well, and the eyes glow from inside it. The shell exterior
  is mid tone.

**Palette by material** (palette.ts only)
| Material | Tones | Rule |
|---|---|---|
| Conch exterior | `earth1` / `earth2` / `earth3`, lit `earth4` | whorl seams 1 px `earth1`; flat bands per whorl (IŞ-3); 2–3 growth-line notches only in mid / shadow (MA-2) |
| Nacre lip | `water3` / `water4` / `white` | three flat bands along the lip; this is the "iridescence" (no gradients) |
| Aperture interior | `night0` / `water0` | MA-4 depth |
| Mussels and barnacles | `night2` / `night3` / `water0` | ≤ 3 clusters, each ≥ 2×2; one mussel opens and closes in idle |
| Crab limbs and claws | `earth2` / `earth3`, lit `earth4` | `fire1` / `fire2` bands at joints and claw tips. **Accent cap: fire ≤ 8 % of opaque px** |
| Coral sprigs at the lip | `fire2` / `fire3` | counted in the same 8 % fire budget |
| Eyes | `gold4` 1 px + ink | the only gold in the body |
| Harpoon | shaft `earth1` / `earth2` (driftwood); head `stone2` / `stone3` / `stone4`; 2-px barbs | one `white` glint (IŞ-8) |
| Rope | lit `earth4` / underside `earth1`, a 2-px line, **not outlined** | after a throw the last 12 px are wet `earth2`, drying back over one idle loop |
| Foam and bubbles | `white` / `water4` | clusters ≥ 2 px |

**Frame and rig**
- Frame 120×104 (Sİ-1/2). Margins: ≥ 30 px right for the release pose and the rope; ≥ 14 px top for the overhead
  twirl. Anchor between the walking legs on the floor; hover 0.
- **Bespoke ace rig** ("shell carrier"). No body plan fits: biped is wrong, and the quadruped is not a plan.
- Reuse rigkit `maps` / `composite` / `edges` / `light`.
- The conch is a **rigid stamped map** in four orientations: upright, tipped 45°, on its side, half-buried
  (IŞ-12: never rotated by fractions).
- Crab: 2 claws, 4 visible legs (the far pair drawn with HIDE_FAR), 2 eye stalks with **different periods**. Harpoon
  and rope are drawn per pose (the rope is a sag polyline).
- Weight class: **mediumHeavy** (hit-stop 90 is in its 80–110 range; shake 2–3 px).
- Anims (frames): idle 16 · guard 6 · toGuard / fromGuard 5 / 5 · attack 14 · **special 12** (Bay shroud) ·
  roar 10 · hit 6 · hitHeavy 8 · hitMagic 8 · summon 14 · death 10 · revive 12.
- Cut-in (`src/art/cutins-v3/tide_harpooner.ts`): darkness of the aperture, two glowing eye stalks, nacre lip, the
  harpoon tip crossing the band. Rhythm: flare 300 / slam 420 / exit 720.

**Idle (16 f, about 1.9 s, holds 100–140)**
- Breath: the shell rises 1 px on f4–7, carried by flexing legs; claws follow 1 frame late.
- Left eye stalk swivels with a period of 8; right eye stalk with a period of 16, phase +5 (HA-6: ≥ 3 phases,
  ≥ 2 periods).
- Rope loop sways with a period of 16, 2 frames behind the claw.
- A mussel opens on f6–8 and another on f12–14.
- **Bubbles** leave the aperture on f4 and f12, rise 6–8 px and pop 3 frames later. Each pop opens a **1-px light
  ring on the floor** under the aperture: `water4`, stepped, ≤ 7 px wide, 2 frames. This is the spec, and the only
  ring this card owns.

**Summon (tribute ace; entrance after the card slam ≈ 1.9 s; the shared tribute stream comes before it)**
| Scene ms | Beat |
|---|---|
| 0–300 | **Tide in:** a thin sheet of water (`water2`/`water3`, a `white` leading edge) slides across the tile from the back-left corner; the tile becomes wet sand (stepped `earth1/2` overlay, Bayer 2×2 only on the floor). |
| 300–600 | **Tide out:** the sheet recedes and **uncovers** the conch apex (half-buried map). Sand clods (`earth3`, 2 px) slide off. A foam line stays on the edge. *This is uncovering, not climbing (§5 rule): no limbs pull.* |
| 600 | Climax: **cut-in** (≤ 900 ms band, passing **under** the tile, EF-10). |
| 600–1100 (under the band) | The shell heaves out of the sand in two jerks (`land`) and tips onto its side; sand spills. |
| 1100–1450 | Legs come out of the aperture (4 frames), then the claws; the eye stalks pop up with a 1-frame overshoot. The crab heaves the shell onto its back and stands (side → 45° → upright maps). |
| 1450–1750 | **Roar** (the conch "sounds"): the crab rears, claws wide, eye stalks up, and a puff of vapour (`white`/`water4`, 2-px clusters) vents from the shell apex. Then the harpoon is spun once in the claw (4 drawn frames) and **planted** in the sand: sand spray, wet ring on the floor, 2 px shake. |
| 1750–1900 | Settle; the rope loop swings; idle f0. |

Light: the wet tile gets a stepped `water4` pool spreading with the sheet. After that the nacre aperture is the
emissive point. At the plant, a `white` stepped flash pool at the harpoon's foot.

**Attack "Zıpkın Atışı" (scene 2.05 s; the crab NEVER leaves its tile)**
| Phase | Anim frames / scene ms | Picture |
|---|---|---|
| Declare (≤ 300) | charge pose | the rope claw lifts the coil; the harpoon is pulled from the sand |
| Charge (f1–f6, 560 ms) | holds 70 90 90 80 70 **160** | rope and harpoon **twirl 1.5 turns overhead** on an iso ellipse, drawn as harpoon positions (back, top, front, back, top, aim). At each front pass, foam beads (2-px `white`) fling off and land as dots. f6: full wind-up, harpoon cocked behind, body leaning on the rear legs, shell tipped one map back |
| Release (f7, 60) | smear 2 px (HA-12) | the throw; the harpoon leaves `muzzle` |
| Flight (280) | projectile | straight with a 3 px gravity sag. The rope pays out behind it (2-tone line, claw → harpoon tail), going from slack to taut |
| **Contact** | **hit-stop 90**, shake 2 px | the harpoon **pierces through** the target's core. **Exit spray:** a narrow fan of 3–4 streaks (`water4`/`white`) bursts out of the **far side** of the target along the throw direction, and 3 droplets land as wet 1-px dots. EF-3 flash power 2, contact zone only. *Not a splash crown (serpent) or a foam crash (golem).* |
| **Pull** (signature, f9–f11, 480) | | **Haul 1** (+120): rear legs plant, both claws haul; the rope snaps straight and 1 px brighter; the target is knocked **3 px toward the crab**. This is the knock API with the direction reversed; the total stays ≤ 4 px (HA-11). **Haul 2** (+300): the harpoon rips out with a small spray and is **reeled back** along the rope to the claw; the rope coils with a slack wobble |
| Recover (f12–f13, 120 / 140) | | the coil settles on the claw; the harpoon is re-planted ("tok") |

- **Blocked:** the harpoon bites the guard and does not go in. The rope goes taut; haul 1 moves the guard only 1 px;
  the harpoon pops free with a "tang" and is reeled in. It reads as "the pull failed".
- **Direct:** the harpoon flies over the field and sticks in the opponent's **LP panel** (spec). One haul jolts the
  panel 2 px toward the crab, then the harpoon is reeled back.
- **Lethal:** the target's own death starts on haul 1, after the 3-px drag.

**Hit and guard**
- **Guard:** the crab **withdraws into the shell** and the big claw shuts the aperture like a door. Only the shell
  and the claw are visible, which makes it the most distinctive guard in the lane.
- **hit:** the shell rocks back 1 px; the eye stalks pull in.
- **hitHeavy:** the crab ducks fully into the shell for 2 frames, then pops out.
- **hitMagic:** the nacre lip flashes `white`; the eye stalks go rigid.

**Death (§5.2: draws into the shell; the shell is buried in sand)**
- f0 is the reaction frame (HA-24).
- f1–2: the eye stalks fold and the legs retract into the aperture.
- f3: the claws pull in. The harpoon is released **standing planted**: it becomes a separate VFX object at the tile
  front.
- f4 (`dissolve`, about 320 ms): the shell tips onto its side and rolls a quarter turn (2 roll maps).
- f5–f8: the tile goes wet again (the summon's wash, receding) and the shell **sinks**, clipped at the floor line,
  with sand piling over its edges.
- The last 150 ms: only the apex shows, and it dissolves in the generic pixels (`earth` / `water` tones).
- Then the planted harpoon stays **0.5 s** (in parallel with the card flight) and splinters into 6 driftwood bits
  (`earth1/2`) plus the stone head. They fall flat and blink out in palette steps.
- The `foam` melt pass is banned.

**Signature — Körfez shroud (`special`; engine `shrouded(s, uid)` in `src/engine/query.ts`)**
- **A. Raise** (fieldSpell event that turns `tidal_bay` face-up while a face-up harpooner exists, either side):
  - `special` anim (about 1.3 s): the crab plants the harpoon and raises the rope claw; the nacre brightens one step.
  - A **standing wave wall** rises around the tile ellipse (iso 64×32). It grows from 0 to 4 px over 400 ms, then
    settles at 2 px.
  - The back half is drawn behind the sprite and the front half in front.
  - Tones: `water2`/`water3`, top edge `water4`.
  - One **foam crest** (`white`, 3 px) runs around the ring once (600 ms).
  - If the harpooner is summoned or flipped while the Bay is already up, a 600 ms version plays after `land`.
- **B. Aura** (while `shrouded`):
  - A 2 px front arc and a 1 px back arc.
  - The foam crest circles every 2.4 s on the ambient clock (it never freezes).
  - Front arc coverage of the silhouette ≤ 8 % (feet only, EF-2).
  - Floor light: a stepped `water4` ring pool at 0.5.
- **C. Deflect** (UI layer, not tempo'd, never blocks input, ≤ 600 ms, debounced 800 ms):
  - When the opponent's attack-target or spell-target selection puts the reticle or pointer on the shrouded crab
    (for a CPU opponent: once, when its target choice begins), the reticle corners close in.
  - They hit the wall, which **curls up to 10 px** at that point.
  - The reticle **skids 12 px along the ellipse** and is flung off, fading in 2 steps.
  - A **"KORUNUYOR"** plate pops above the crab: `water1` fill, 1 px `water4` border, `white` UI font. It is one
    size bigger for 34 ms (EF-9 style), holds 500 ms, then **slides down 3 px and sinks**, fading in 2 steps.
  - It must differ from R3's "0 · KORUNDU": that is a number on a pillow with a bell; this is a wave plate with a
    "şlup".
- **D. Drop** (the Bay leaves): the wall collapses into a splash ring that soaks into the tile (400 ms).

**Light (profile line)**
- Replace `cyan4` with: emissive `water4` 0.8 (nacre and bubbles), `white` 0.8 (harpoon tip), `gold4` 0.4 (eyes);
  halo 0.6; pool 0.9.

**SOUND — §5.1 identity**
- Main pitch: **A3 220 Hz** (conch). The rope glides 196 ↔ 247 and is never steady on 220.
- Signature material: **wet rope + seashell**.
- Distinguishing layer: the **conch horn "uuu"**, a conical breath.
- Everything is wet and mid-low. Nothing glassy, no metal ring.

| Moment (mark) | Layers (kit / Voice) | Envelope / level |
|---|---|---|
| Idle: bubble pop (the pop frame) | sine chirp 700→1500 Hz in 18 ms ("plip"); in 30 % of loops a second one +40 ms at 1.2×. Mussel: `crack` hp 3000, dec 4 ms | ≤ −28 dB; at most one event per 4 s (§0.5) |
| Summon: tide in / out (`arrive`, sustained; stopped on `land`) | `sweep` pink [400, 1400, 600] d 0.6, pan L→R; then `sweep` pink [300, 900, 250] d 0.5, R→L. Foam fizz: `crackle` n 40, f 6.5 kHz, q 0.6 over 0.5 s | −14 dB, then fading |
| Shell heaves ×2, roll | `puff` brown lp 500 dec 0.25 (sand) + `thump` 120→70 dec 0.18. **Shell "tok":** a click into `filt` bandpass **620 Hz Q 12** + 1.24 kHz Q 10, dec 0.12 (hollow ceramic resonance) | |
| Roar / cut-in flare (`roar`) | **Conch:** `tone` saw **196→220 Hz scoop in 120 ms**, held to 1.1 s, `filt` lp 900; plus `tone` triangle 440 at 0.3; plus pink breath through `filt` bp **520 Hz Q 3** and **1150 Hz Q 4** (formants); vibrato 4.5 Hz ±6 cents after 400 ms; `echo` 0.18 s fb 0.25 wet 0.2 | att 120 ms, rel 300 ms 'e'; duck 0.6. No tritone, no second voice a fifth up |
| Harpoon plant (`land`) | `thump` 150→60 dec 0.14 + wet squelch (pink bp 900→400, 60 ms) + `crack` hp 2 kHz n 2 gap 9 ms (grains) | |
| Charge: twirl (`charge`, sustained to `release`) | 3 × `sweep` pink [500, 1100, 600] d 0.19, pan swinging L↔R each pass (in front of / behind the body), +8 % pitch per pulse. Under it, rope tension: `tone` triangle **196→233 Hz** rising over the charge, `flutter` 30 Hz depth 0.4 (friction). Bead flicks: tiny `crackle` at each front pass | tension −24 dB, sweeps −16 dB |
| Release | **Rope twang:** `tone` triangle 220→196 Hz, perc dec 0.35 + `v.bell` 440 ratio 1.5 index 1 dec 0.2 (fibrous, not metal). Flight: `sweep` white [2000, 3500, 2500] d 0.28 panned to the target, with `flutter` 60 Hz (rope paying out) | |
| Contact | **Wet "tok":** `thump` 180→90 dec 0.09 drive 1.4 + click into bp 1100 Q 5. **Puncture jet:** white noise hp 1.5 kHz, att 5 ms, dec 0.35, through bp 3 kHz→1.2 kHz. Three droplet plips (sine 900→1800, 15 ms) at +120 / +190 / +260 ms. (The struck body adds its own material.) | duck 0.45 |
| Pull: haul 1 / haul 2 / reel | **Creak:** pink through bp **420 Hz Q 6** with `flutter` 22 Hz (stick-slip), d 0.18 per haul. Tension tone glides 220→247 on haul 1 (taut), 247→196 on the slack. Rip-out "şlk": noise bp 2 kHz→700, dec 0.12. Reel: `sweep` [1800, 2600, 1200] d 0.22 toward the crab. Re-plant: `thump` 200→120 dec 0.06 + sand click | haul 1 −12 dB (the second-loudest beat) |
| Struck body = shell (new material) | Light: the shell "tok" (620 / 1240 Hz rings, dec 0.12) + slosh inside (pink lp 700, dec 0.2). Heavy: rings at 520 Hz + 2 glugs (sine 300→180, 40 ms). Magic: rings an octave up + the kit's sizzle | SE-5: LSD ≥ 9 dB against stone / hide / cloth |
| Guard (withdraw) | "shuck": noise bp 1.2 kHz→500 dec 0.09 + claw clack (`crack` hp 3 kHz n 2 gap 14 ms) | |
| Death | Retract: `sweep` pink [900, 500, 250] d 0.35 + muffled tok. Roll: two toks at 620 then 520 Hz, 120 ms apart. **Burial "şşş":** pink lp 1800→400 d 0.6 + `crackle` grains n 25 at 5 kHz, thinning. Last breath: a breathy 220→196 sine whisper, 0.4 s at −26 dB. Harpoon splinter (+0.5 s): `crack` hp 1.8 kHz n 3 gap 15 ms + a small thud | |
| Signature: raise (A) | Rotating water: `drone` **110 Hz, tritone 0**, beat 0.4, lp [200, 900, 300], with an `lfo` of 0.42 Hz on the lp and a panner circling at 0.42 Hz (the crest period), 2.4 s. Plus bubble plips | −18 dB. *Not the magus: no tritone, A not D, sloshing AM, circling pan* |
| Signature: aura (B) | silence, except one soft lap (pink lp 600, 0.42 Hz swell) every 4 crest cycles | −32 dB |
| Signature: deflect (C) | **Oily "şlup":** sine 900→260 Hz in 90 ms through lp 1500. Skid: noise bp 2.5 kHz→1.2 kHz, 80 ms, panned along the skid. Stamp: sine 330 Hz perc dec 0.12 + a conch hint (triangle 220, 0.15 s) | UI level, no duck |
| Signature: drop (D) | `sweep` pink [1200, 600, 200] d 0.4 + fizz | |

### 2.2 C8 · reed_heron — Sazlık Balıkçılı (normal, Sv4, size class 64)

**Identity:** a heron **swordmaster** standing on one leg in night-marsh **mist** over **dark still water**. Absolute
stillness, then three strikes faster than the eye. It is the quietest card in the game.

**Silhouette and value plan**
- Tall and thin: one planted leg (2 px), a teardrop body at 60 % height, an S-neck, and a **long horizontal beak
  blade** pointing right (about 16 px; its distal two-thirds are steel).
- A straw cloak (the wingtips) hangs low at the back. Two `ink` crown plumes trail back.
- Read: a tall "?" with a needle.
- Bbox about 38×60: taller and with fewer opaque px (about 1100) than any other 64-class card. Sİ-4 is checked
  against the 64 class.
- Values: the plumage is the **largest, brightest plane** (`white`/`mist`). It sits on the **darkest floor patch in
  the game** (the still water).

**Palette**
| Material | Tones |
|---|---|
| Plumage | lit `white`, mid `mist`, shadow `steel`; far wing `night4` |
| Crown stripe and plumes | `ink` / `night1` |
| Beak base (proximal third) | `gold2` / `gold3` |
| Beak blade | `stone2` / `stone3` / `stone4`, one `white` glint |
| Eye | `gold4` 1 px + ink |
| Leg | `earth1` / `earth2` (+ a `gold1` lit edge) |
| Straw cloak | `earth3` / `earth4` woven bands, `earth1` shadow; ≥ 2 px teeth (MA-2) |
| Reeds (a floor prop layer that is part of the sprite frame) | `leaf0` / `leaf1` / `leaf2` stems; `earth2` seed heads |
| Still water patch | `night0` / `night1` / `water0`, `water1` ripple lines; one **`white` moon streak** (1×6 px) |
| Mist | `steel` / `mist` / `night4` horizontal stepped bands; partial cover only as 2×2 Bayer, **never alpha** (MA-4) |

**Frame and rig**
- Frame 108×92: the beak at release reaches +26 px right; the neck coils back. Anchor at the planted foot.
- Bespoke "wader" rig:
  - one planted foot (the second leg tucked; it unfolds only to walk);
  - body;
  - a 3-segment neck chain (positions keyed per pose and rasterized; nothing is rotated as a sprite);
  - head plus a beak raster line;
  - a straw cloak using `rigkit/cloth` planes + `widenTeeth`;
  - reeds and water as a ground layer inside the frame (they count for HA-18 liveliness).
- Weight class: **medium** (the final hit-stop of 80 is in the 60–80 range).
- Anims (frames): idle 16 · guard 6 · toGuard / fromGuard 5 / 5 · attack 14 · roar 9 (wings open once) · hit 6 ·
  hitHeavy 8 · hitMagic 8 · summon 10 · death 10 · revive 10.

**Idle (16 f, holds 130–170: the slowest idle in the lane)**
- The body is near-still: a 1 px chest breath (period 16).
- HA-18 liveliness (≥ 15 %) comes from the surroundings, not the body. Tell critics this is intended. Moving parts:
  - straw fringe sways (period 16);
  - crown plumes wave (period 8, +2 frames lag);
  - throat feathers ruffle (phase +5);
  - reeds sway (period 16, a different phase);
  - water ripple lines crawl;
  - a slow **S-neck** curl once per loop (f8–12).
- f13: a **single drop** falls from the beak tip and opens one 1-px ripple ellipse (3 frames).
- Ambient mist bands drift 1 px every 400 ms on the ambient clock (VFX layer, at most 4 px past the tile).

**Summon (normal, scene 1.8 s)**
| Scene ms | Beat |
|---|---|
| 0–220 | card slam (kit) |
| 220–700 | Mist rolls in from both sides (two band layers, one behind and one in front). The tile turns into **still dark water**, and the moon streak appears. Reeds pop up 6 px, staggered. **Tile light drops one step** (§0.4.3). |
| 700–950 | In the mist, **one eye glint** at head height (IŞ-8: 1 px → 3 px cross → 1 px), held 200 ms. |
| 950–1250 | The mist **parts** (the bands slide 10 px apart). The heron **is simply there**, still and in full colour. No hologram, no build, no rising. |
| 1250–1600 | Roar: the straw cloak fans open once (3 frames up, hold 120, 3 frames down). The downdraft pushes the mist bands out 4 px and flattens the reeds for 1 frame. `land` on the close. |
| 1600–1800 | settle → idle f0 |

**Attack "Gaga Hamlesi" (scene 1.9 s)**
| Phase | Frames / scene ms | Picture |
|---|---|---|
| Declare | | the neck begins to coil |
| Charge (f1–f4, 440) | holds 70 80 90 **200** | the neck folds into a tight S (head back over the shoulders, beak level, aiming); the body leans back. **f4 is held 200 ms of dead stillness, and the mist layer freezes too** (the only freeze cue in the lane) |
| Travel (420) | f5–f6 walk frames | **two long gliding strides** with **no vertical bob**. Mist streaks trail behind as horizontal bands. Each foot leaves one 1-px ripple dot. It stops a beak's length short: the body never touches the target |
| Release (f7, 50) | smear 2 px | the neck uncoils in one frame |
| **Triple contact** (f8, f9, f10) | **micro hit-stops 40 / 40 / 80** | three thrusts at **three points** of a 6-px vertical triangle on the target's core (top, bottom, centre), so they read as three. Each thrust draws a 1-frame 1-px `white` needle line along the beak (light, not outlined) and flicks 2 droplets (`water4`/`white`). Shake 1 / 1 / 2 px. The **`contact` mark, the damage number and the EF-3 flash (power 2) are on the third**; the first two are jabs with their own micro stop and sound |
| Recover (f11–f13) | 110 / 130 / 150 | the neck re-coils into an S; a **single backward glide** home on a back-step pose; the leg folds up to the one-leg stance; mist closes around the ankle |

- **Blocked:** "tak-tak-TING". On the third, the beak deflects upward and the heron hops back one stride.
- **Direct:** it glides to the duelist plate; the triple lands on the duelist.

**Hit and guard**
- **hit:** the neck snaps into an S like a spring and the plumage ruffles for 2 frames. The spring neck is C8's reaction
  read.
- **hitHeavy:** a hop back on the one leg; it lands on the same foot (HA-9).
- **hitMagic:** the plumage edges light up and the neck goes rigid and straight.
- **Guard:** the wings close forward as a cloak, head down, beak pointing down (a sheathed sword).

**Death (§5.2: steps back into the mist; only the reeds remain)**
- f0 is the reaction frame.
- f1: the wings close around the body.
- f2–f4: **one step back** (a drawn back-step; the foot lands 4 px back).
- The mist bands roll in front of and behind him. From `dissolve` (f4, about 320 ms) they cover the body **from the
  bottom up**: under each band the body pixels step toward the mist tones (`white`→`mist`→`steel`→`night4`).
- The last 150 ms: the head and beak tip dissolve into mist motes, using the generic dissolve with custom tones
  [`night4`, `steel`, `mist`, `white`]. No shatter burst; the shatter material is `water` only for the API.
- The mist then thins and leaves **only the reeds**. They sway for 600 ms more (in parallel with the card flight)
  next to **one ripple ring** on the water. Then the water patch and the reeds fade in steps.

**Signature (vanilla card):** **"The Triple"** together with the stillness. The beat that must be unmistakable is:
200 ms dead freeze → two strides → ta-ta-TAK.

**Light (profile line)**
- Replace `cyan4` with: emissive `gold4` 1.0 (eye) and `white` 0.5 (beak glint); halo 0.3; pool 0.4.
- C8 is the **dimmest presence** on the board. Its tile carries a negative pool (the still water is one step darker)
  with a 1-px moon streak.
- Each thrust gives a 1-frame light line; contact gives a small stepped `white` pool on the target.

**SOUND — §5.1 identity**
- Main pitch: **2.4 kHz beak "tak"**.
- Signature material: **reed + mist**.
- Distinguishing layer: a **double wing "fuff"** over a **frog-chorus bed**.
- **Silence is an instrument:** the bed cuts out at the eye glint and at the charge freeze.

| Moment | Layers | Envelope / level |
|---|---|---|
| Idle bed | **Frogs:** 3 voices, sine 380 / 460 / 520 Hz, gated by 24–30 Hz pulses (`lfo` on gain), 3–5 pulses per croak, spaced 0.6–2.5 s at random, pans −0.7 / 0 / 0.7, lp 1.4 kHz (distance). **Reeds:** pink bp 2.8 kHz Q 1 with a slow `wander`, swelling with the sway. **Drop** (f13): sine 1200→2400 in 15 ms, then a ripple sine 600→420, 80 ms | frogs −34 dB, reeds −36 dB (§0.5) |
| Summon | Mist "fşş": pink bp 900→600, att 300 / sus 500 / rel 400, two panners converging (−0.8→−0.2 and +0.8→+0.2). **At the eye glint the frogs stop dead.** Mist part: a rising pink swell, 250 ms, cut at the top. **Wing "fuff fuff":** two pink bursts hp 250, lp 1800→900, 70 ms each, 90 ms apart, the second at −4 dB, plus `flutter` 48 Hz on bp 1.4 kHz, 120 ms. **No thump, no "pof".** | −16 dB |
| Charge | Bow tension "without creak": sine 300→600 Hz with a little breath, over f1–f3. **`stop(20)` at the start of the freeze, so the hold is SILENT** | −28 dB |
| Travel | Two water slips: noise bp 1.1 kHz→700, dec 0.12, one per stride. Mist trail: `sweep` pink [600, 1200, 500] d 0.42 panned to the target. No thud, no gravel | slips −24, trail −26 |
| Release | "fwip": `sweep` white [3000, 6000, 4000] d 0.05 | |
| Contact ×3 | **Tak:** white burst through bp **2.4 kHz Q 9**, dec 6 ms + sine at the same pitch, perc dec 25 ms + a wood body (bp 900, dec 15 ms). Pitches **2.40 / 2.54 / 2.14 kHz**; the third is +3 dB. After the third only, a **blade ring**: `v.bell` 2140 ratio 3.53 index 1.1 dec 0.6 at −20 dB, plus 2 droplet plips | duck 0.2 / 0.2 / 0.45 |
| Recover | the mist closes: pink swell 300 ms | −30 dB |
| Struck body = feather (new material; REHBER §2.3 "soft, high flutter") | `flutter` 60 Hz on bp 3.2 kHz, 90 ms + a low slosh (pink lp 600, dec 0.15). Heavy adds a "plash" (bp 1.5 kHz, dec 0.1). Never a single lp puff ("pof" is R3's) | |
| Guard | one "fuff" + a reed rustle | |
| Death | Wing-close fuff; back-step slip; mist swell (pink, rising and falling, 600 ms). **The single ring:** sine **520→390 Hz** glide, dec 0.5, `echo` 0.12 fb 0.3 at −20 dB. Then **the frogs come back** with two quiet croaks: the marsh goes on without him | |

### 2.3 C7 · crag_axeman — Kaya Baltacı (normal, Sv4, size class 64)

**Identity:** a mountain barbarian whose **single** stone-axe stroke leaves a **glowing seam** in the world, and who
dies split along his own seam. The lane motif is **the clean line**:
- **summon:** a boulder is cut in two along a light seam;
- **attack:** the floor seam runs to the target and climbs it;
- **death:** he splits along his own seam.

**Silhouette and value plan**
- A broad triangle: wide shoulders, narrow hips, short thick legs set wide, a small head with a braided stone-bead
  beard.
- The **crescent single-bit axe head rests on the right shoulder** as a second mass above and behind the head.
  Read: "a man with a half-moon on his shoulder".
- Bbox about 50×54, about 1600 px.
- Values: the axe's cutting edge is the brightest line (one glint); the skin of the arms and face is the lit mass;
  the fur cloak is mid-dark.

**Palette**
| Material | Tones |
|---|---|
| Skin (arms, face) | `skin1` / `skin2` / `skin3`, lit `skin4`. **The only skin user in the lane** |
| Fur cloak | `earth0` / `earth1` / `earth2`, `earth3` lit tufts; ≥ 2 px teeth (MA-2; REHBER fur) |
| Belt and wraps | `earth1` |
| Beard | `stone1` / `stone2` braids, `stone3` / `stone4` beads (2×2) |
| Axe head | `stone1`–`stone4` flat carved facets; ≤ 3 chip notches; the edge line `stone4` with one `white` glint |
| Haft | `earth1` / `earth2`, vine wrap `leaf1` / `leaf2` (3 bands) |
| War paint | two 1×4 px forehead stripes in `fire2` (accent only) |
| Eyes | `white` 1 px |
| **Yarık light** | 1 px `white` core, `earth4` lips, `gold4` only at the running head. **No `fire`** (lava is the titan's, embers are S10's) and **no gold rune plates** (the sentinel's) |

**Frame and rig**
- Frame 100×96: spin poses reach ±30 px; the axe goes overhead.
- **The biped body plan** (`src/art/bodyplans/biped`, the sentinel's) fits the standing, walking and hit poses.
- Bespoke parts:
  - **the spin:** 6 hand-drawn facing poses (3/4 right → side → back 3/4 → back → front 3/4 → front), done as a
    plan L3 escape (`drawAnim`);
  - the axe as a **rigid stamped map in 6 angles** (IŞ-12);
  - beard beads as followers;
  - the fur cloak with `rigkit/cloth` bands;
  - death via `rigkit/passes/split.ts` with **one straight vertical line**. The halves are re-rasterized from the
    rig on tilting skeletons; never sprite-rotated.
- `split.ts` is the wyrm's crystal pass. C7 uses only its *line*: no `cracks`, no `drain`, no glass shards.
- Sameness (KK-15) is checked against stone_sentinel, steel_silencer and later windmane / shield_titan / C6:
  wide stance, short legs, and the shoulder mass must keep the IoU under the KEY threshold.
- Weight class: **heavy** (hit-stop 110 is in 100–130; shake 3–4 px; settle 450).
- Anims (frames): idle 16 · guard 6 · toGuard / fromGuard 5 / 5 · attack 16 · roar 10 (**nara**) · hit 6 ·
  hitHeavy 8 · hitMagic 8 · summon 12 · death 12 · revive 12.

**Idle (16 f, holds 100–140)**
- The axe rests on the shoulder; chest breath 1 px (period 8).
- Neck roll on f5–8 (head tilts right, then left; 2 drawn positions).
- f10–11: he lifts the axe and **taps its head on the floor**. On f11 a 1-px dust puff and a 1-px `white` spark at
  the contact point: it foreshadows the Yarık.
- f12–14: back to the shoulder.
- Beard beads swing 1–2 frames behind (period 8); the fur hem teeth sway (period 16).

**Summon (normal, scene 1.75 s)**
| Scene ms | Beat |
|---|---|
| 0–220 | slam |
| 220–620 | A **boulder** (about 28 px, `stone` ramp, lit top) **rolls in horizontally** from off the back-left tile edge along the iso axis. It bounces twice (1 px shake on the second), stops, and rocks 1 px twice. The roll is a 4-frame drawn cycle, not `setAngle`. *Different from C6's vertical log drop and from the sentinel's orbiting rocks.* |
| 620–820 | **A still beat** (the rock is silent). |
| 820 | The **axe blade punches out** through the boulder's front: 6 `stone` chips of 2 px, a `white` spark. |
| 820–1050 | **One straight vertical light seam** runs up the boulder face from the blade (Yarık colours, 3 frames). The boulder **splits clean** and the halves fall left and right (3 drawn frames). They lie as floor props and sink in palette steps over 600 ms. *C6's bark opens like hinged doors with splinters; this cut is clean, single and lit.* |
| 1050–1400 | He steps out (`land` on the foot plant, 2 px shake). **Nara** (the roar, peak about 1250): chest out, axe raised one-handed overhead. An 8-px Yarık opens on the floor where the boulder was split. |
| 1400–1750 | The axe goes back to the shoulder; idle f0. The floor seam fades in 3 steps. |

**Attack "Dağ Yaran" (scene 2.05 s)**
| Phase | Frames / scene ms | Picture |
|---|---|---|
| Declare | | both hands on the haft; the axe lowers |
| Charge = **the spin** (f1–f6, 480 + hold) | holds **110 90 80 70 60 60**, then f7 **160** | **one full 360° turn in place, accelerating** (centrifugal). The axe is held at arm's length and its head sweeps a flat circle. On the two fastest frames only: a 2-px arc smear of the axe head (`stone4`/`white`). Earth clods spiral up off the feet. **No wind ring, no wind streaks.** It ends with the axe swung up overhead, cocked (f7 is the longest frame) |
| Travel (520) | 3 step frames | **three heavy steps with an ACCELERATING cadence: 220 / 170 / 130 ms** (a run-up). The upper body is locked in the cocked pose. Each plant: shake **1 / 1 / 2 px**, a dust puff, a pebble hop |
| Release (f9, 60) | smear 2 px | the vertical chop comes down |
| **Contact** (f10) | **hit-stop 110**, shake **4 px** | The axe **bites the floor just in front of the target**, its head buried 4 px. The **Yarık** runs from the axe head along the attack axis **under** the target: a 2:1 iso line, 1 px `white` core with `earth4` lips, 2 px wide, reaching the feet in 60 ms. It then **climbs up through the target as a vertical light seam** (2 frames; a 1-px light line over the target sprite, not outlined). The hit-stop, the number and the EF-3 flash (confined to the seam band) all land when the seam **arrives**. Stone chips burst from the bite back toward the attacker |
| Follow-through (f11–f13) | 140 / 110 / 120 | a big **heave** to free the axe (chip spray, a dirt clod), then onto the shoulder |
| Recover | | walks back home in 3 plain steps (no shake) |
| **Yarık persists 1.5 s** (scene) | floor decal | Breathing glow (`white` ↔ `earth4` swap every 200 ms). One spark (`gold4`, 1 px) runs along it **from the attacker toward the target**: this is the visual of the "crackle run". Then it fades in 3 palette steps |

- **Blocked:** the seam reaches the guard and **stops at its front edge**, forking into a tiny "Y" and dying. The axe
  bounces in the floor and he staggers back one step.
- **Direct:** the seam runs off the board edge toward the duelist plate. A vertical light seam flashes over the
  duelist; the axe bites the board edge.
- **Killed targets use their own death.** Only C7 ever splits; the target must not.

**Hit and guard**
- **hit:** the head snaps back; the beard beads swing.
- **hitHeavy:** one foot steps back, the haft dragging.
- **hitMagic:** the war-paint stripes flash; the body goes rigid.
- **Guard:** the haft is held **horizontal across the chest** as a bar; crouched, feet wider.

**Death (§5.2: splits in two along his own seam; no turning to stone)**
- f0 is the reaction frame.
- f1: he staggers. The axe slips and drops **head-first into the floor** in front of him with the haft upright. It
  bites, and a short Yarık opens from it toward his feet (2 frames).
- f2–f3: the seam reaches his feet and **climbs his body's centre line** from groin to crown (`white` core, `earth4`
  lips, light pouring out).
- `dissolve` f4 (about 320 ms): the halves separate 1 px, then 2 px.
- f5–f8: the left half tilts left and the right half tilts right, in 3 steps.
- The last 150 ms: a **seam-burn**. Starting at the cut edge, the light eats into each half in ≥ 2-px clusters
  (`white`→`earth4`→gone).
- **No rubble, no bounce, no dust cloud, no stone crumble** (R1 and the sentinel own those).
- The axe stays planted 400 ms (in parallel with the card flight). Then its seam closes and it tips flat with a "tok"
  and blinks out.

**Signature "Yarık"**
- Every contact (attack, blocked, direct) plus the summon seam and the death leave the line.
- The floor part is drawn at floor-decal depth; the climbing part at the target unit's depth +1.

**Light (profile line)**
- emissive `white` 0.6 (axe edge and eye); halo 0.4; pool 0.6.
- The real light source is the **Yarık set piece**: a floor pool **along the line**. It must be white-stepped
  (`night1`→`night2`→`night3`; 2 steps at the core). The pilot showed that warm or earth light on the night floor
  turns into mud (EF-6), so the floor pool is white while the crack pixels themselves are `earth4`/`white`.
- One axe-edge glint at the spin's apex (IŞ-8: one per anim).

**SOUND — §5.1 identity**
- Main pitch: **90 Hz gravel crunch**.
- Signature material: **stone + fur**.
- Distinguishing layer: the **crack "crackle run"**, panned along the seam.
- Plus the only **human baritone shout** in the lane.
- Not the sentinel's `rumble` palette. No brown-noise bed under everything: C7 is percussive and dry, with silences
  between blows.

| Moment | Layers | Envelope / level |
|---|---|---|
| Idle: axe tap (f11) | stone-on-stone "tok": `thump` 300→180 dec 0.05 + `crack` hp 2 kHz dec 8 ms + 2 pebble clicks. Beads: two `crack` hp 4 kHz ticks at the swing extreme | −26 dB |
| Summon: roll | brown noise lp 300, AM by an `lfo` on gain at **6→3 Hz** (slowing) + `crackle` gravel n 30 at 3 kHz. Bounces: `thump` 70→45 dec 0.12 ×2, the second louder | |
| Summon: silence → punch | 200 ms nothing. Punch: `crack` hp 1.5 kHz n 3 + `thump` 120→60 | |
| Summon: seam + split | Seam: `crackle` n 20, 4→6 kHz, rising, 230 ms + "tsss" (white hp 6 kHz, 150 ms, the light pouring). Halves land: two `thump` 90→55 + brown `puff`, panned ±0.5, 60 ms apart | |
| Roar = **nara** | `growl` d 0.9, f [140, 165, 150, 120, 100], formants **[700, 1150, 2600]** (a human "HAA"), grit 4, rasp 30 | duck 0.6. *Not R1's drake, not C5's goblins, not the wyrm* |
| Charge: spin | `sweep` pink [180, 420, 220] d 0.48 with a panner making **one full circle**, accelerating ([0, −.7], [.2, .7], [.36, −.7], [.48, .7]); two loudness peaks as the axe passes the front. Feet scuff: `crackle` n 12 at 3 kHz | −14 dB |
| Travel ×3 | **Gravel crunch:** `thump` 110→80 dec 0.09 drive 1.6 (about 90 Hz) + `crackle` n 10, 2.8 kHz, q 0.7, dec 4 ms. **Level −18 / −15 / −12 dB, pitch 90 / 95 / 100 Hz** (the run-up) | |
| Release | `sweep` white [800, 2200, 600] d 0.07 (short and downward; *not* the v1 whoosh) | |
| Contact | `thump` **40→28** dec 0.35 drive 2.2 + `crack` hp 1.8 kHz n 2 gap 10 ms + brown `puff` lp 700 dec 0.4. **Crackle run:** `crackle` n 26 at 3.5→5 kHz over 0.25 s, **panned from the attacker to the target** (follows the screen direction, so P2 is mirrored). Seam climbing the target: "tsss" (white hp 5 kHz, 100 ms, rising) | duck 0.7 (the lane's loudest blow) |
| Follow-through | stone grind: brown bp 220 Q 4 dec 0.25 + a clod puff; the shoulder: a soft fur thud | |
| Yarık fade | 4 faint crackle ticks, one every 200 ms; the last is a dry "tik" | −30 dB |
| Struck body = hide / fur (`materials/defs/hide.ts` if its ring reads as fur; otherwise a fur variant) | pink lp 900 dec 0.08 + `thump` 110→60 dec 0.07 + leather slap (bp 1.2 kHz, 20 ms). Heavy adds a grunt (`growl` d 0.25, f 130→100, low). Magic: the kit's | must differ from C11's hide by ≥ 9 dB LSD (C11 adds horn) |
| Guard | haft slap: `thump` 160→110 dec 0.05 + wood knock (bp 700) | |
| Death | Axe drop + bite: `thump` 60 + `crack`. Seam climbs: a rising "tsss", 300 ms (hp 4 kHz). **One long tearing crack:** `crackle` n 40, **descending 2.5→1.2 kHz** over 0.45 s + `crack` n 6 gap 30 ms. **Two separate falls:** `thump` 85→50 dec 0.2 panned −0.4, then +140 ms `thump` 75→45 panned +0.4, each with a fur flop. The axe "tok" +400 ms | |

### 2.4 C9 · kite_fencer — Uçurtma Eskrimci (normal, Sv3, size class 48)

**Identity:** a slim fencer wearing a **kite as a cloak**:
- attack 1 is a needle-quick **straight lunge**;
- attack 2 is the kite **lifting him** for a **swinging lateral cut**.

Two attacks that share nothing but the rapier. The lit **cloak panel** shows that a second attack is available.

**Silhouette and value plan**
- A small upright figure in fencing stance, side-on: front knee bent, rapier arm forward, rear arm raised behind.
- A **diamond kite cloak** behind him, bigger than the torso, with crossed bamboo spars; its top point is above his
  head.
- A long **string** trails from the cloak's tail to the floor and curls into an S.
- Read: "a diamond with a needle".
- Bbox about 34×42.
- Values: the rapier is the **thinnest and brightest** line; the panels carry the saturated light tones; the linen
  suit is mid; the mask slits are ink.

**Palette**
| Material | Tones |
|---|---|
| Suit and mask (unbleached linen, §0.4.4) | lit `earth4`, `earth3`, shadow `earth2`, creases `earth1`; mask eye slit 2 px `ink` |
| Mask ribbons | `fire2` / `fire3` |
| Kite panels (4 diamonds, 2 tones each) | top-left and bottom-right `gold3` / `gold2`; top-right and bottom-left `fire3` / `fire2`. A thin, "translucent" cloth: the spar shadow shows through as a darker `earth1` band under the panel (MA-4) |
| Bamboo spars | `earth2` / `earth3` |
| Rapier | bell `stone3` with a `gold2` rim; blade `stone4` with a 1 px `mist` underside; one `white` glint |
| String | 1 px `earth4`; tail bows `gold2` / `fire2` |

**Frame and rig**
- Frame 88×84: attack 2 rises 20 px; the open cloak is wide.
- **Biped plan** at the light end of the range.
- Bespoke cloak:
  - 4 panels with spars, drawn as **stamped maps in 4 states** (folded along the spine / half / open / billowed),
    shaded with `rigkit/cloth` `planes()`;
  - the string is a polyline per pose, with a **pin point at the home tile** during attack 2 (the pendulum pivot).
- Weight class: **mediumLight** (hit-stop 60; attack 2 uses 80 as a per-strike override in its cinematic).
- Anims (frames): idle 16 · guard 6 · toGuard / fromGuard 5 / 5 · attack 10 (lunge) · **special 14 (attack 2)** ·
  roar 9 (salute) · hit 6 · hitHeavy 8 · hitMagic 8 · summon 12 · death 10 · revive 10.

**Idle (16 f, holds 80–110: the quickest idle in the lane)**
- Fencing footwork: 2 micro-bounces per loop (period 8). The **heels lift and the toes stay planted**, so the foot's
  bottom row does not move (HA-9).
- The rapier tip circles in a 2-px loop (period 16, phase +3).
- The cloak **fills over 3 frames and sags over 3 frames** once per loop (phase +6).
- The floor string flips S → reverse S (2 frames behind the cloak).
- Mask ribbons flutter with a period of 4.

**Summon (normal, scene 1.75 s)**
| Scene ms | Beat |
|---|---|
| 0–220 | slam |
| 220–900 | An **empty kite** (only the cloak) **drifts down like a leaf** from above the screen: 3 pendulum sways of 12 px alternating, slow, its string trailing above it, using 3 drawn tilt maps. **Not a dive** (storm_hawk owns dives) and not a vertical drop (C6, S9). It lands **flat** on the tile as an iso diamond, with a cloth flop. Each panel throws a 1-frame coloured stepped pool. |
| 900–1150 | A bump rises under the cloth (2 frames); the cloth tents. |
| 1150–1450 | The fencer **stands up under the kite**. The cloth slides onto his shoulders and becomes the cloak (4 frames); the string uncoils on the floor. |
| 1450–1750 | **Salute** (roar): the rapier goes up vertical to the mask (`land` / peak, a 1-frame tip glint), then snaps down to guard. Idle f0. |

**Attack 1 "Pike" (scene 1.45 s; `attack` anim)**
| Phase | Frames / ms | Picture |
|---|---|---|
| Charge (f1–f3, 240) | holds 60 60 **120** | weight drops onto the back leg; the rapier is drawn back 4 px; the cloak sags. **The shortest charge in the lane** |
| Travel (160) | f4 release, smear 2 px | **a fleche:** one perfectly straight dash from home to the target, Expo.Out. **The fastest travel in the lane.** Behind it, a **needle line**: a 1-px straight line at blade height that steps `white`→`mist`→`steel`→gone over 3 frames. The cloak streams back flat. **No afterimages** |
| **Contact** (f5) | **hit-stop 60**, shake 1 px | the tip hits the core: a 3-px `white` cross star at the tip and 2 hair-thin sparks. EF-3 power 1 |
| Recover (f6–f9) | 100 / 120 / 110 / 130 | two small back-hops home. **On landing, the indicator panel lights** |

- **Blocked:** the blade **bows** (2 drawn frames) and springs back; he skids back.
- **Direct:** a fleche to the duelist (direct is only allowed on the first attack).

**Attack 2 "Uçurtma Süzülüşü" (only against a monster; scene 1.75 s; `special` anim; branch on the slot's
`attacksThisTurn === 1` at declaration)**
| Phase | Frames / ms | Picture |
|---|---|---|
| Charge (f1–f4, 360) | 70 90 90 110 | the indicator panel flares; the rear arm is flung up and the **cloak spreads fully open** and billows; the **string goes from slack to taut**, pinned at the home tile |
| Rise (f5–f6, 300) | | he **lifts off**, 18 px up and slightly back, hanging under the kite, legs trailing |
| Pendulum swing (420) | f7–f9 | a **circular arc** whose pivot is above the target: from above and behind home down to its lowest point **beside** the target at body height. The rapier is held low and horizontal; a 1-px **curved** trail follows the blade |
| **Contact** (lowest point of the arc) | **hit-stop 80**, shake 2 px | a **lateral cut across** the target's body, perpendicular to attack 1's axis, so it reads as a **cut, not a stab**: a curved 1-px `white` slit and 1-px `earth4` fibre threads |
| Exit (f10–f14) | | the arc continues up past the target (+12 px), the wind spills and the cloak collapses; a short braking glide home with the cloak half open; a knee dip on landing. **The panel goes out:** `gold4`→`gold3`→off over 3 frames, and a tiny thread drifts off |

If the battle phase ends without a second attack, the lit panel dims out quietly in 2 steps on the phase change.

**Signature: the cloak-panel indicator**
- It is the **upper leading panel**: top-right in P1's sprite. P2 is mirrored by `flipX`, so it stays the leading
  panel on screen.
- Emissive `gold4` core (3×3) with a 1-px `fire4` rim, and a 2-step pulse on a 1.2 s period (ambient clock).
- A small stepped `gold4` pool (0.3) under that side of the body.
- Visible only when: face-up, attack position, `attacksThisTurn === 1`, battle phase.

**Hit and guard**
- **hit:** the cloak flaps forward over him; he bends at the waist.
- **hitHeavy:** knocked back; the cloak billows up.
- **hitMagic:** all panels flash.
- **Guard:** the cloak wraps forward into a closed diamond shield; the rapier is vertical behind it.

**Death (§5.2: the kite string pulls taut and snaps; the cloak flies off screen)**
- f0 is the reaction frame.
- f1: the **string goes taut**: a straight bright line from the cloak to the floor, vibrating 1 px.
- f2: **SNAP** at the middle. The two ends whip back as curling 1-px lines.
- f3: the rapier drops.
- f3–f5: the cloak catches the wind, **tears off his shoulders**, and flies **up and off screen** (top-right for P1).
  It is a VFX object: 600 ms, swaying, 4 tilt maps.
- `dissolve` f4: without the cloak the fencer **thins**. Over 3 drawn frames the body narrows to a vertical sliver,
  like cloth that has lost its frame, and folds onto the floor as a limp **linen scrap** (6×4 px, `earth3`/`earth4`).
- The last 150 ms: the scrap dissolves (generic).
- The **rapier clatters**: it bounces 2 px, then 1 px, lies on the tile, and blinks out with the card flight.

**Light (profile line)**
- Replace the shared leaf profile with: emissive `gold4` 1.0 (the indicator, only when lit), `white` 0.6 (rapier
  tip); halo 0.5; pool 0.6.
- No leaf tones: those are C11's.

**SOUND — §5.1 identity**
- Main pitch: **4 kHz thin "tsst"**.
- Signature material: **steel needle + kite cloth**.
- Distinguishing layer: the **string buzz** (a taut wire in wind).
- Also the lane's unique **shoe squeak** (fencing footwork) and the **plucked-string** indicator.

| Moment | Layers | Envelope / level |
|---|---|---|
| Idle | Cloth flutter on the billow: `flutter` 70 Hz on bp 1.6 kHz, white, 0.15 s. String hum on the billow: saw 880 Hz → bp 3.5 kHz Q 6, `flutter` 90 Hz depth 0.4 | −30 / −34 dB |
| Summon | Falling kite: 3 × `sweep` pink [1200, 2200, 1400] d 0.24, pans alternating L/R, slowing. Flat landing: pink lp 1400 dec 0.08 + bamboo click (`crack` bp 3 kHz dec 4 ms n 2 gap 6 ms). Tenting: a soft rustle. Cloak settles: a **taut-cloth snap** (noise bp 1.8 kHz Q 3, dec 18 ms). Salute "tsing": sine 4000 + 6900 Hz, perc dec 0.25 + noise hp 6 kHz dec 10 ms. **No `glassBell`** | salute −18 dB |
| Attack 1: charge | a short rising pink breath (80 ms) + **shoe squeak** (sine 2.2→2.8 kHz chirp, 30 ms) | |
| Attack 1: travel | "fsst": white bp sweep **6→4 kHz** Q 4, d 0.12 | |
| Attack 1: contact | **"tsst":** `crack` hp 5 kHz dec 6 ms + sine **4000 Hz** perc dec 0.18 + **4720 Hz** partial (the "çın") | −16 dB, duck 0.25 |
| Attack 1: recover | two squeaks. **Panel ON:** "fwump" (pink lp 900, att 40 ms, dec 120) + **one plucked string:** triangle **1320 Hz** perc dec 0.4 ("one attack left") | pluck −22 dB |
| Attack 2: charge | Wind fills the cloak, **"vump":** pink lp 700, att 60, dec 0.3 + `thump` 90→70 (cloth drum). **String tension:** saw **660→1320 Hz** through a bp tracking 2×f, `flutter` 80 Hz, crescendo through the rise | |
| Attack 2: swing | `sweep` pink [400, 1600, 500] d 0.42, pan following the arc; the string pitch peaks at the low point (1320→1480) | |
| Attack 2: contact | curved cut "sşhk": white bp **3.2→1.8 kHz**, 90 ms + a short 4 kHz sine + a fibre tick | duck 0.35 |
| Attack 2: exit | wind spill "fffh" (pink, lp falling). **Panel OUT:** the same pluck muted and lower (880 Hz, dec 0.15). Landing: soft thud + squeak | |
| Struck body = kite cloth (new material) | a **drum-like snap** of stretched fabric (bp 1.8 kHz, 15 ms) + a bamboo click at 3 kHz + tiny rapier rattle ticks at 4 kHz. **No pink exhale and no low flutter** (that is the magus' `hitCloth`) | |
| Guard | wrap snap (taut cloth) | |
| Death | Tension: saw 880→1760 in 150 ms. **SNAP "tın":** triangle 1760 perc dec 0.05 + `crack` hp 3 kHz; two whip swishes. The cloak flies: a receding flutter (60 Hz on bp 1.6 kHz→900, level fading over 0.6 s, panned to the screen edge, lp closing = distance). Collapse: a soft cloth flop. **Rapier clatter:** `v.bell` 3600 / 3300 / 3100 Hz, ratio 2.4, index 0.8, dec 0.08, at 0 / 90 / 150 ms + a final rest tick | |

### 2.5 C11 · steppe_spiralhorn — Bozkır Boynuzlusu (normal, Sv4, size class 64)

**Identity:** a **saiga** antelope whose two long **spiral horns sing** in the steppe wind. Three soaring bounds, a
**horn toss**, and a cloud of **feather-grass seeds**. Lane motifs: airborne threes, spirals, grass, seeds, flute.

**Silhouette and value plan**
- A quadruped with **long thin legs**, a heavy barrel body and a thick neck.
- The **big drooping saiga nose** is the unique profile.
- **Two very tall upright spiral horns** (about 14 px, slightly back-swept).
- Read: "a box on stilts with two corkscrews". It is the opposite of ember_wolf, which is low and horizontal with a
  pointed muzzle.
- Bbox about 54×52.
- Values: the white belly, rump and throat patches are the lit flash; the coat is mid tan; the mane is darker green;
  the horn tips are the brightest (`gold4`).

**Palette**
| Material | Tones |
|---|---|
| Coat | lit `earth4`, `earth3`, `earth2`, shadow `earth1` |
| Belly, rump, throat | `white` / `mist` |
| Nose | `earth1` / `earth2` (nostril `earth0`) |
| Hooves | `stone1` / `stone2` |
| Horns | `earth3` / `earth4` with 1-px `earth2` ridge dashes along the spiral; tips `gold3` / `gold4` |
| Grass mane and tail tuft | `leaf1` / `leaf2` / `leaf3` (≥ 2-px teeth) |
| Eye | `ink` + 1 px `white` catchlight |
| **Seeds** (Stipa feather-grass) | shaft `earth3` (2 px) + `white` / `mist` plume (2–3 px). **Not purple pollen** (C6), **not straw or grain** (S5, S9), **not leaves** (storm_hawk, thorn) |
| Grass wake | `leaf2` / `leaf3` blades, `leaf4` lit tips, `white` seedheads |

**Frame and rig**
- Frame 104×92: the tucked jump poses and the rear-up need height.
- **Bespoke quadruped rig** (ember_wolf is v1 only; there is no quadruped plan):
  - 4 legs with 2-joint IK; barrel; neck; head plus nose;
  - **horns as rigid stamped maps in 4 head angles** (a spiral can never be rotated by fractions, IŞ-12);
  - a mane follower chain; a tail tuft.
- Weight class: **medium** (hit-stop 80, shake 2).
- Anims (frames): idle **18** · guard 6 (head low, horns forward like a pike fence) · toGuard / fromGuard 5 / 5 ·
  attack 14 · roar 9 (rear + honk) · hit 6 · hitHeavy 8 · hitMagic 8 · summon 12 · death 12 · revive 12.

**Idle (18 f, holds 100–130)**
- Ear flicks: 2 per loop, 2 frames each, left and right offset.
- The **nose sniffs**: nostril flare plus a 1-px nose wobble (period 6).
- The mane ripples (period 9, lagging); the tail flicks (period 18, phase 11).
- A cocked hind hoof on f6–10. The planted hooves keep their bottom row (HA-9).
- **f12–15: the breeze.** Two tiny **horn-tip curls** peel off the horn tips: 1-px spiral hooks of 3×3 px,
  `leaf4`→`leaf3`, drifting back. This is the visual "whistle", synced to the flute note.

**Summon (normal, scene 1.75 s)**
| Scene ms | Beat |
|---|---|
| 0–220 | slam |
| 220–600 | A gust sweeps across the tile from his entry side. **Grass grows in a travelling wave** (blades rise behind a wave front, 3 heights, `white` seedheads). |
| 600–1150 | He enters from **off screen** (P1 from the left edge, P2 from the right) in **one long high bound**: a big arc with its apex about 40 px above the tile, legs tucked (drawn jump frames), 2–3 seeds trailing. **No afterimages, no fire trail** (ember_wolf). |
| 1150–1350 | He lands **on the hoof tips** (`land`). The grass flattens outward in a **crescent fan** and springs back. 1 px shake. |
| 1350–1750 | Roar: a light rear, the horns tilt to the sky, the **flute note** sounds, seeds lift off the grass. Settle to idle f0. The tile grass recedes in 3 steps over about 1 s. |

**Attack "Bozkır Sıçrayışı" (scene 2.0 s)**
| Phase | Frames / ms | Picture |
|---|---|---|
| Charge (f1–f3, 300) | 80 100 120 | **rears up** on the hind legs; the front hooves paw the air once; the nostrils flare; horn-tip curls |
| Travel: **three bounds** (780) | drawn tuck / extend frames | **Airborne and rising**, with lengthening cadence: bound 1 is 10 px high and 220 ms; bound 2 is 16 px and 260 ms; **bound 3 is 26 px and 300 ms**. At each take-off a **grass-wake fan** springs out of the floor (4–6 blades bending away from the hooves, then springing back and shrinking over 3 frames). At each apex a **two-turn spiral curl** peels off the horn tips (1 px `leaf4`) and trails back. Bounds 1–2 land on the hoof tips with a 2-px dust tick. **No rings** (§0.4.1) |
| **Contact** (from the third apex) | **hit-stop 80**, shake 2 px | he drops head-low and drives the horns **UP and through**: a **horn toss**. The path ends **rising**, unlike C7's downward chop and the horizontal thrusts of C8 and C9. Horn crack, EF-3 power 2. **SEED BURST:** about 14 feather-grass seeds spray **up and out** from the contact point, then **glide down slowly** with a wind drift away from the attacker. Their plumes spin (2 drawn states). They drift for 900 ms after contact, land, and blink out in steps |
| Follow-through | | he **rebounds** backward in one high back-bound off the target, then one low bound home; lands and shakes his head |

- **Blocked:** the horns lock against the guard with a clack. He is shoved back 4 px, sliding on his hooves. No seeds,
  only 3 blades.
- **Direct:** three bounds across the field and a toss at the duelist plate.

**Hit and guard**
- **hit:** the head is tossed back; the ears go flat.
- **hitHeavy:** the hind legs buckle; he skitters back.
- **hitMagic:** both horn tips glint and ring; the coat goes rigid.
- **Guard:** head lowered, horns forward as a pike fence, legs braced.

**Death (§5.2: graceful collapse; the body becomes a seed and grass cloud carried by the wind)**
- f0 is the reaction frame.
- f1: a weak rear.
- f2–f3: the **forelegs fold first** (a kneel), then the hind legs. He lies down in a curl, head last, the horns
  lowered gently to the floor.
- `dissolve` f4–f5: from the hooves up, the coat **turns into grass**: pixels step `earth`→`leaf3`→`leaf2` in bands,
  and blades poke out of the outline. The body becomes a grass mound with his shape.
- f6–f9: **the wind takes it**. The mound blows apart **from the windward side** into a **curving stream** of seeds
  and 2-px blades drifting leeward and climbing slightly. It is a stream, not an outward burst.
- The last 150 ms: the generic dissolve on the remaining stub.
- **The horns go last:** they lie on the grass for 200 ms, then become **two long seed plumes** that lift and drift
  away.
- No feathers (R3), no ash (R1), no purple pollen (C6).

**Light (profile line)**
- Replace the shared leaf profile with: emissive `gold4` 1.0 (horn tips), `leaf4` 0.5 (wind curls and grass tips);
  halo 0.5; pool 0.7.
- During the burst a few seeds catch 1-px `gold4` glints that step out.
- Contact floor light: a small stepped `white` pool.
- Test the summon grass's floor tint in a film: leaf on night may turn to mud (EF-6). If it does, use no tint and only
  the blades.

**SOUND — §5.1 identity**
- Main pitch: **3 kHz grass hiss**.
- Signature material: **horn + hoof**.
- Distinguishing layer: the **spiral-horn flute**, an open-fifth steppe mode **A5 880 / D6 1175 Hz**, breathy, with
  delayed vibrato. Never a pentatonic run (S12), never a noise whistle (C3), never a buzz (C9).

| Moment | Layers | Envelope / level |
|---|---|---|
| Idle | Grass: white bp **3 kHz** Q 1.2 with a `wander`, 0.4 s swells. **Flute** (on the horn curl, every other loop): sine **1175 Hz**, sliding in from 1046 Hz over 80 ms, 6 Hz vibrato starting at +120 ms + breath (noise bp 1175 Q 12) + an octave below (587) at 0.25; dec 0.7 s; panned with the head. Sniff: two pink bursts bp 1.2 kHz, 40 ms | grass −32, flute −24 dB |
| Summon | Gust: `sweep` pink [600, 2600, 900] d 0.38 from the entry side; grass growth: soft `crackle` + a rising rustle. Leap: a long low `sweep` [300, 900, 400] d 0.5 + **the flute at the apex** (A5→D6, a rising fifth, 0.5 s). **Landing: 4 hoof ticks** (`crack` bp 2.2 kHz dec 5 ms + `thump` 220→160 dec 0.03), 25 ms apart (four tiptoes) | |
| Roar | **saiga honk:** `growl` d 0.55, f [210, 240, 220, 180, 160], **nasal formants [450, 1300, 2400]**, grit 2 + the flute after it | duck 0.5. *Not a howl (wolf), not a goblin, not a drake* |
| Charge | snort (pink bp 900 dec 0.12 + bp 2.4 kHz) + 2 pawing hoof clicks | |
| Travel ×3 | Each take-off: hoof tick + grass "shhk" (white bp 3→2 kHz, 80 ms) + breeze (`sweep` pink [700, 1800, 900], d = the bound's length, panned along). Each apex: a soft flute fragment **rising per bound: 880 / 988 / 1175 Hz**, so bound 3 arrives on D6 just before contact. Landing ticks | flute −26 dB |
| Contact | **Horn crack:** `crack` bp 1.5→3.5 kHz dec 10 ms n 2 gap 8 ms (keratin) + `thump` 140→80 dec 0.1. **Seed burst:** soft `crackle` n 30 at 5 kHz dec 3 ms spread over 0.5 s + a release "fwoosh" (`sweep` pink [3000, 1500, 600] d 0.4) | duck 0.45 |
| Rebound | hoof ticks + grass | |
| Struck body = hide + horn (new variant) | pink thump (lp 1 kHz, dec 0.07) + a **keratin tick** at 900 Hz (bp Q 6, dec 25 ms). Must keep ≥ 9 dB LSD from C7's fur | |
| Guard | horn clack: two `crack` hits (hp 1.2 kHz, bp 2 kHz), 20 ms apart | |
| Death | Two falling pink exhales. Folding: two soft hide thuds (front, then hind). Grass transform: a rising rustle. The wind takes it: `sweep` [500, 2200, 700] d 0.9 panned leeward. **The last flute:** D6 **gliding down to A5** over 1.2 s with vibrato, decaying, `echo` 0.25 fb 0.35 | |

### 0.5 (applies to all sheets) Idle sounds
- Idle sounds are **ambient ticks**: at most one per 4 s per card, ≤ −28 dB, and never during another card's cinematic
  contact.
- If the codebase has no ambient-idle hook for monsters, the lane files an open issue in `docs/v3/oturum-c.md`. It
  does **not** invent a shared system in a shared file. Idle sounds are then demonstrated in the per-card dev preview
  and the MP4 only.

---

## 3. Cross-check matrix

### 3.1 The five lane-C cards against each other
| Pair | Silhouette | Motion path | Rhythm | Palette | Impact | Death | Sound | Risk → resolution |
|---|---|---|---|---|---|---|---|---|
| **C1 / C8** (both WATER) | round spiral + mast vs tall thin "?" with a horizontal blade | **stays home and throws** vs **two gliding strides, stab** | long twirl – throw – 2 hauls vs freeze – 2 strides – ta-ta-TAK | warm: earth shell, nacre `water3/4`, fire accent vs cool monochrome: `white`/`mist`/`steel` on `night`/`water0` | puncture exit spray on the far side + **pull** vs 3 needle jabs + a few droplets | shell buried in **sand** (the tile goes wet) vs steps back into **mist**; reeds and one ripple remain | wet, splashy, 220 Hz conch, rope creak vs near-silent, dry 2.4 kHz tak, frogs, fuff | **HIGH (two water cards).** Split the elements: **C1 = sea: salt, sand, foam, splash. C8 = marsh: mist, still black water, silence.** C1 never uses mist. C8 never splashes: its contact sound is dry, and its only water sounds are slips and the single ring. C1's floor brightens (wet sheen); C8's darkens. Bubbles belong to C1; the moon streak belongs to C8 |
| **C9 / C11** (both WIND) | small upright figure + diamond vs big quadruped + corkscrews | straight fleche / pendulum arc vs three **rising** bounds + an upward toss | fastest (240 charge, 160 travel) vs mid (300 charge, 780 travel) | warm linen + saturated gold / fire panels vs tan coat + green mane + gold horn tips | needle star / lateral slit vs horn toss + **seed burst** | the cloak flies **off screen**, the body thins to a rag, the rapier clatters vs graceful kneel → grass → seed stream | 4 kHz steel tsst + **string buzz** + shoe squeak vs 3 kHz grass hiss + **flute** + hoof ticks | **HIGH (two wind cards).** Wind is shown differently: C9's wind lives **in the cloth** (billow, lift, spill); C11's lives **in the grass and the horns** (wake fans, spiral curls). Neither draws wind streaks or rings. C9's light is gold / fire; C11's is leaf / gold horn tips (the shared profile is fixed) |
| C1 / C7 | spiral vs triangle with a half-moon | ranged and stationary vs spin + steps + chop | slow twirl vs accelerating run-up | sea vs mountain | pierce + pull vs seam climbs the target | buried vs split | wet, conch vs dry gravel, human shout | low |
| C1 / C9 | heavy round vs light slim | both have a **line** (rope / string) | | | | | rope creak 420 Hz + 196–247 Hz glide vs 880–1760 Hz buzz | **MEDIUM (line motif):** C1's rope is thick (2 px), wet, **sagging then taut, pulling toward the owner**. C9's string is 1 px, dry, **trailing, a pivot**. Rope sounds are low friction; string sounds are high buzz and pluck. Only C9's line **snaps** (death); C1's never snaps |
| C1 / C11 | both have a "spiral" | stationary vs airborne | | | | | | low: the spiral is a *house* (one huge mass) vs two thin *horns* |
| C8 / C7 | thin vertical vs broad triangle | glide vs heavy steps | freeze vs accelerate | cool vs warm | 3 pinpoints vs 1 seam | mist vs split | quiet vs loudest | low |
| C8 / C9 | both slim; both have a horizontal steel point | glide-stab vs fleche | ta-ta-TAK vs single flick | `mist`/`white` vs `earth`/gold / fire | **three** points vs **one** point | mist vs cloak flies off | 2.4 kHz wood + steel vs 4 kHz pure steel | **HIGH (thrusts)** → §3.4 |
| C8 / C11 | thin bird vs quadruped | glide vs bounds | | | | | | low; both "triple": ta-ta-TAK (stabs on one spot) vs bound-bound-BOUND (travel) |
| C7 / C9 | broad vs slim | ground-bound vs light and aerial | | | | | | low |
| C7 / C11 | both use **threes** | **ground steps, accelerating 220/170/130, downward chop** vs **airborne bounds, lengthening 220/260/300, upward toss** | | | | | steps rise in level (90→100 Hz) vs flute rises in pitch (880→1175) | **MEDIUM (three-beat travel):** opposite in every axis: contact with the ground vs air, quicker vs slower, chop down vs toss up, loudness vs pitch |

### 3.2 Against the nearest existing and other-lane cards ("En yakın kart" plus what the code inventory adds)
| Lane-C card | Nearest | What separates them | Residual risk → resolution |
|---|---|---|---|
| C1 | coral_serpent (water jet) | stationary **projectile on a rope** + pull vs stationary **beam**; whirlpool / geyser entrance vs **tide washing sand off**; foam death vs **burial** | Entrance: never spiral the water; the tide is a flat sheet in and out |
| C1 | tide_golem (wave) | single-point harpoon vs rolling wave; foam crash vs **exit spray on the far side**; puddle death vs sand burial | none |
| C1 | S8 soul_leash | S8: "no pull"; C1 is the game's only pull | keep C1's pull ≤ 3 px and rope-driven |
| C1 | R3 "KORUNDU" | wave plate + "şlup" vs pillow + number + bell | wording differs (KORUNUYOR); shape and sound differ |
| C1 | polar_needle 220 Hz | glide + friction + conch breath vs a steady beating sine | measure SE-4 LSD for C1 roar / charge vs needle idle; it must be ≥ 10 dB |
| C8 | storm_hawk (bird) | grounded, no flight, no dive; mist; one leg | C8's wings open **once** in the summon only; no flapping travel |
| C8 | shade_assassin (pool glide) | mist **above** the floor, legs stride vs sinking into a pool; the death **steps back** vs sinks | the death must never clip at the floor line (that is the assassin's sink) |
| C8 | R3 wisp_imp (6 micro pokes, "pof", white / mist) | 3 pokes with a 40/40/80 hit-stop rhythm on one target vs 6 homing darts; double "fuff" vs single "pof" | count the pokes: exactly 3; the wing sound is always a pair, hp 250 |
| C8 | R2 grim_warden mist | low horizontal grey mist bands vs green soul fire / skull mist | no `leaf3/4` in the mist, no shapes in it |
| C7 | C6 hollow_ogre (2 heavy steps + top-down smash, hit-stop 100, log split from inside) | **3 accelerating steps after a spin**; the axe **bites the floor** and the **seam** delivers the blow vs the club crushes the body; boulder **rolls in sideways and is cut clean along a light line** vs a log **drops** and bark opens **like doors** with splinters | **HIGH:** keep the floor bite + seam (never hit the target's head directly), and keep the cut clean (no splinters) |
| C7 | magma_titan (lumbering, glowing cracks under the target) | white / earth4 **single straight line** that climbs the target vs branching orange lava network | never use `fire` for the seam; never branch, except the "Y" in the blocked case |
| C7 | stone_sentinel (stone, ground cracks, crumble) | skin / fur barbarian; seam; **split** death vs rubble | never use stone crumble, rubble or a dust cloud on C7's death |
| C7 | S10 spite_axe (axe stuck in the floor, cracks, embers, chains) | carved **stone** single-bit axe with a vine haft; no chains, no embers; the seam is white | death planting: haft upright, white seam closes, "tok"; no chain sound, no drone |
| C7 | crystal_wyrm (split pass) | one straight vertical cut with the halves falling apart vs glass cracks and a shatter | do not run `cracks` / `drain` / glass shards |
| C7 | windmane_knight / shield_titan / steel_silencer (biped heavies) | spin + shoulder axe mass + wide short stance | run KK-15 sameness (silhouette IoU vs the biped members) |
| C9 | storm_hawk (dive) | the kite **drifts like a leaf** (summon) and **lifts and swings like a pendulum** (attack 2) | no vertical dive frames, no feathers |
| C9 | wing_lady (planned: bird-winged lady with a short sword) | no wings, no feathers: a **diamond kite cloak with spars**, a rapier not a short sword | when wing_lady gets art, check against C9 (note for the orchestrator) |
| C9 | R3 (feather pendulum entrance) | **cloth** diamond with a trailing string vs a single feather | the sway must show the spars (a rigid diamond), not a curling feather |
| C9 | S2 puppet_string ("tsing" ×5) | one plucked triangle note (the indicator) vs 5 stereo string pings | C9 never stacks plucks: only 1 on and 1 off |
| C11 | ember_wolf (quadruped, leap entrance) | tall stilts + corkscrews vs low wolf; one long bound **from off screen** onto the hoof tips vs a leap from a fire ring; no afterimages | none |
| C11 | C3 cloud_hatchling (wind ring, rising whistle) | **no rings**; pitched flute (A5 / D6) vs a noise whistle 2→5 kHz | §0.4.1 deviation |
| C11 | storm_hawk (wind ring, leaves) | grass-wake fans + horn spirals | no leaf debris; only blades rooted in the floor |
| C11 | C6 (purple pollen) / S5 (grain, straw) / S9 (straw) | white-plumed feather-grass seeds that **glide** | seeds must glide slowly (≥ 900 ms); no purple, no yellow grain |
| C11 | S12 (pentatonic notes) | two-note open fifth, breathy, with vibrato | never more than 3 flute notes in a moment |

### 3.3 Sound-collision watch list (SE-4: measure LSD; median ≥ 15 dB, minimum ≥ 10 dB)
| Pair | Why it is close | Required separation |
|---|---|---|
| C8 tak 2.4 kHz / C2 tick-tock 3.2 / 2.6 kHz | both high dry clicks | C8: wood body + steel ring, 40/40/80 rhythm, falling third. C2: brass, metronomic |
| C9 tsst 4 kHz / C11 grass 3 kHz / R3 feather 5 kHz | neighbouring high bands | C9 is tonal (4000 / 4720 partials); C11 is broadband sustained noise; R3 is a filtered flutter |
| C9 string buzz / C3 whistle / S7 rotor 120 Hz | "wind instruments" | C9: buzzing saw 660–1760 with flutter. C3: rising band-pass noise. S7: low saw |
| C11 flute / C3 whistle / C4 660 Hz | tonal highs | C11 is breathy sine on A5 / D6 with vibrato; it never sweeps continuously |
| C1 220 Hz / polar_needle 220 Hz | the same number | §0.4.2 glide and timbre |
| C7 90 Hz / polar_anvil 82 Hz / sentinel rumble (G1) | low earth | C7 is percussive (thump + gravel) with silence between; the anvil is a steady hum; the sentinel is a brown-noise grind |
| C8 fuff / R3 pof | soft wing noise | C8 is a **pair**, hp 250, no low thump; R3 is a single lp puff with a thump |
| C1 drone (raise) / magus drone | the `drone` block | A2 110 Hz, tritone 0, sloshing 0.42 Hz AM, circling pan vs D1/D2 with a tritone |

### 3.4 The three thrust-type attacks (C1 harpoon, C8 beak, C9 lunge) must read completely differently
| | C1 Zıpkın Atışı | C8 Gaga Hamlesi | C9 Pike (attack 1) |
|---|---|---|---|
| Who travels | **only the harpoon**; the crab stays home | the **body glides** two strides; the beak stops short and the **neck** delivers | the **whole body** dashes (fleche) |
| Path | the harpoon flies the full lane on a straight line with a 3 px sag, then **comes back along the rope** | a horizontal glide, then 3 short pistons hitting **three points** of a vertical triangle | **one perfectly straight** horizontal line home → target |
| Count | 1 hit + 2 hauls | **3** | **1** |
| Charge | the longest: 560 ms circular **twirl** overhead | 440 ms coil with a **200 ms dead freeze** | the shortest: 240 ms drop-back |
| Hit-stop | 90 | 40 / 40 / 80 | 60 |
| After contact | **pull** (target 3 px toward the crab) | a still re-coil and a backward glide | back-hops; the **panel lights** |
| Trail | the rope (2 px, two tones) | mist streaks | 1-px needle line |
| Sound | low, wet: twang, "tok", spray, creak | dry and quiet: tak tak TAK + blade ring | high and clean: squeak, fsst, tsst-çın |

**Test:** shown as silhouettes with the sound muted, a critic must name the card from the attack's path and rhythm
alone.

### 3.5 Shared "three" beats in the game (so lane C's threes stay distinguishable)
- **Elsewhere:** lumen_sprite has 3 sparkles; storm_hawk 3 wind cuts; S2 3 puppet hops; C14 3 spikes; C15 3 KLAKs.
- **Lane C:**
  - C7: 3 grounded, accelerating steps;
  - C11: 3 airborne, lengthening bounds;
  - C8: 3 instantaneous stabs on one spot.
- Each is anchored to its own pitch contour:
  - C7 rises in level;
  - C11's flute rises in pitch;
  - C8 goes up, then down.

### 3.6 What each lane-C card OWNS (lane mates must not use it)
| Card | Owns |
|---|---|
| C1 | rope, the pull, foam beads, sand / tide sheet, exit-spray puncture, standing wave wall, the conch, shell "tok", bubbles with floor ring dots |
| C8 | mist bands, still black water, moon streak, the freeze / silence, frog chorus, the double "fuff", the single ripple ring, the 40/40/80 triple |
| C7 | the straight light seam (Yarık), the spin, the accelerating ground steps, the human shout, the split, the boulder roll, skin tones |
| C9 | kite cloth panels and the indicator, string buzz, needle line, fleche, pendulum flight, shoe squeak, the plucked-string note, the off-screen cloak flight |
| C11 | grass growth and wake fans, horn spiral curls, airborne bounds, feather-grass seeds, the flute, quad hoof ticks, the saiga honk |

---

## 4. Critic checklists (yes / no; any "no" sends the card back)

Common to all five (check first):
- [ ] KK-3 sheet numbers pass.
- [ ] HA-21 contact < 50 % (sheet, every idle phase, on screen).
- [ ] No `setScale` / `setAngle`; no camera change; no full-screen white (EF-4).
- [ ] palcheck clean; no cyan / crim / teal / mag in the body or the VFX body.
- [ ] Every timing is within §0.1 measured with `measure --look v3`; destruction ≤ 1.4 s scene.
- [ ] Sound marks are synced to ≤ 1 frame at 1× and 3×; peak ≤ −1 dBFS; sustained sounds end with their picture.
- [ ] No banned shared SFX from §0.2 is heard (grep the card's files for `'whoosh'`, `'slash'`, `'waterSplash'`,
  `'windGust'`, `'groundCrack'`, `'earthQuake'`, `glassBell`, `glassRain`, `glassReverse`).
- [ ] P2 films are correct (relit, mirrored, pans mirrored).
- [ ] An MP4 with sound (`clip.mjs`) has been produced.
- [ ] v1 filmdiff 17/17 + a6v1 26/26 IDENTICAL; camera gate passes.

**C1 Kabuk Zıpkıncı**
- [ ] At 1× the silhouette reads "round spiral shell + upright harpoon"; the harpoon tip is the brightest point.
- [ ] Fire tones ≤ 8 % of opaque px; the only gold is the eyes.
- [ ] Idle: the eye stalks move on different periods; bubbles pop into 1-px floor rings.
- [ ] Summon: the tide **uncovers** the shell (no climbing, no whirlpool, no geyser); the cut-in band passes under
  the tile; the roar vents vapour from the apex; the harpoon is planted.
- [ ] Attack: **the crab never leaves its tile**; the twirl is 1.5 turns; the spray exits from the **far** side; the
  **pull drags the target 3 px toward the crab**; the harpoon is reeled back along the rope.
- [ ] Blocked shows the failed pull; direct sticks in the LP panel.
- [ ] Guard is withdrawal into the shell.
- [ ] Death: shell rolls and sinks in wet sand; the harpoon stands 0.5 s, then splinters; no foam melt.
- [ ] Shroud: the wave wall rises on Bay activation, idles subtly (feet only), and drops when the Bay leaves.
- [ ] Deflect: the reticle **skids along the wall** and the "KORUNUYOR" plate sinks; input is never blocked.
- [ ] Sound: the conch scoops 196→220; the rope always glides; the shell "tok" is the struck body; "şlup" on deflect;
  LSD vs polar_needle ≥ 10 dB.

**C8 Sazlık Balıkçılı**
- [ ] It is the tallest and thinnest 64-class silhouette; the beak blade reads at 1×.
- [ ] The water patch is the darkest tile on the board; there is a moon streak.
- [ ] Idle: the body is nearly still while plumes, straw, reeds and water move (HA-18 still passes); one drop and one
  ripple per loop.
- [ ] Summon: mist in, tile darker, eye glint, mist parts, **already there** (no build); one wing open.
- [ ] Attack: a visible **200 ms freeze** (the mist freezes too) → two bob-less strides → **exactly three** stabs on
  three distinct points with 40/40/80 stops; the number lands on the third; the body never touches the target.
- [ ] Hit reads as the S-neck spring; guard is the cloak with the beak down.
- [ ] Death: a back-step; mist covers him bottom-up; **only the reeds and one ripple remain**; no floor-line sink, no
  shatter.
- [ ] Sound: the frog bed stops at the glint; the charge is silent during the freeze; the taks are 2.40 / 2.54 /
  2.14 kHz with a blade ring after the third; "fuff" comes in pairs; the death ring is followed by the frogs
  returning. It is the quietest card in the A/B test.

**C7 Kaya Baltacı**
- [ ] The silhouette reads "half-moon on the shoulder"; skin, fur and stone are distinct planes; fire only in the
  war paint.
- [ ] Idle: the axe tap makes a 1-px spark on the floor.
- [ ] Summon: the boulder **rolls in sideways** → silence → the blade punches through → **one straight light seam** →
  a clean split → nara.
- [ ] Attack: the 360° spin uses drawn facing poses and **accelerates**; three steps **accelerate** (220/170/130);
  the axe **bites the floor in front of** the target; the seam runs under the target and **climbs it**; the hit-stop
  lands on the seam's arrival; the seam persists about 1.5 s with one spark run and fades in steps.
- [ ] The seam is white / earth4 (no orange, no gold plates, never branching except the blocked "Y").
- [ ] Killed targets use their own death.
- [ ] Death: the axe drops and bites; the seam climbs his centre line; the halves fall apart; a seam-burn dissolve;
  **no rubble, dust or crumble**; the axe stands 400 ms.
- [ ] Sound: the gravel steps rise 90→100 Hz in level; the crackle run is panned attacker → target; there is a
  human-formant nara; one long descending tear + two separate falls; nothing from the `rumble` palette.

**C9 Uçurtma Eskrimci**
- [ ] The diamond cloak with spars reads at 1× at 48 px; linen suit (not white); the rapier is the brightest line.
- [ ] Idle: toes planted during the bounces; the cloak fills and sags once; ribbons flutter fast.
- [ ] Summon: the empty kite **sways down like a leaf** (no dive), lands flat, he rises under it, salute.
- [ ] Attack 1: the shortest charge; a **straight fleche**; a 1-px needle line (no afterimages); 60 ms; back-hops;
  **the indicator panel lights**.
- [ ] Attack 2 (monster only): the cloak opens, **he lifts off**, a **pendulum arc**, a **lateral curved cut** (not
  a stab), 80 ms, overshoot and glide home; **the panel goes out**.
- [ ] The two attacks share no path, timing or trail.
- [ ] The panel is shown only under the four conditions; it dims at phase end.
- [ ] Death: the string goes taut and **snaps**, the cloak flies **off screen**, the body thins to a linen scrap, the
  rapier bounces twice.
- [ ] Sound: shoe squeaks; fsst + 4 kHz tsst-çın; "vump" + rising string buzz for attack 2; one pluck on, one muted
  pluck off; a "tın" snap + receding flutter + rapier ticks; kite-cloth struck sound ≠ the magus' cloth.

**C11 Bozkır Boynuzlusu**
- [ ] The saiga nose and two tall corkscrew horns read at 1×; horns are rigid maps (no fractional rotation); tips
  `gold4`.
- [ ] Idle (18 f): ears, nose sniff, mane, tail, horn-tip curls with the flute.
- [ ] Summon: the grass grows in a wave; **one long bound from off screen**; tiptoe landing with a grass fan; honk +
  flute.
- [ ] Attack: rear-up; **three airborne bounds, each higher and longer**; grass fans at take-off and horn spirals at
  each apex; **no rings**; an **upward** horn toss; 80 ms; the seed burst **glides** for about 900 ms; rebound home.
- [ ] Blocked: horn clack + slide, no seeds.
- [ ] Death: forelegs fold first; the body turns to grass from the hooves up; the wind carries it off as a **stream**;
  the horns become two seed plumes last; no feathers, ash or pollen.
- [ ] Sound: 3 kHz grass hiss; breathy A5 / D6 flute with delayed vibrato (never a sweep or arpeggio); flute
  fragments rise 880 / 988 / 1175 over the bounds; 4-tick hoof landing; nasal honk; the death flute glides D6→A5;
  LSD vs C9 and C3 ≥ 10 dB.
