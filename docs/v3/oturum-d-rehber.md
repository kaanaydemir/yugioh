# Lane D build handbook (oturum-d-rehber)

For the builder agents of lane D (`claude/kart-d`): `dial_jester`, `reflection_archer`, `scrap_raiders`,
`polar_needle`, `polar_anvil`, `polar_coil`, `polar_sovereign`, `straw_decoy_token`.
Written by the handbook scout from the code at HEAD 03c3abc (2026-10-31). Every path, name and command below
was read or run in this tree. Read first: `docs/v3/PARALEL_OTURUMLAR.md` (lane rules), `docs/v3/YENI_KARTLAR.md`
§5, §5.1, §5.2, your card's section, C12–C15, "Sahip kararları"; `docs/v3/REHBER.md` §4.1, §4.9, §5, §6, §7, §8.1;
`docs/v3/TEMPO.md`; `docs/v3/KART_RESIMLERI.md` §1, §2, §10.

**Owner decisions that change the spec:** Dial Jester = max 1 copy in a deck, effect max once per TURN (the card
text in `cards.ts` already says "Turda 1 kez"; YENI_KARTLAR §C2 still says "düelloda 1 kez" — ignore that).
EF-8 beats the storyboards: C15 step 1 says "kamera merkeze çekilir" — **the camera never moves** (no
`ctx.focus`, no `closeUp`, no zoom); fake the push-in with light, dimming and the iron-dust rose.

---------------------------------------------------------------------------------------------------------------

## 0. Where the lane stands today (placeholder routes)

| Piece | Today | Replace with (new files, lane D owns them) |
|---|---|---|
| Sprite | `src/art/monsters/index.ts` `placeholderFor(id)`: `straw_decoy_token` → `_placeholder-token.ts` (straw scarecrow 48 px), the other 7 → `_placeholder-new.ts` `placeholderTotem` (crystal totem) | `src/art/monsters-v3/<id>.ts` (+ `<id>-rig.ts`, `<id>-anims.ts`, …) |
| Card art | totem crop / `placeholderPortrait` | `src/art/cardart-v3/<id>.ts` + `portrait()` in the v3 art |
| Cut-in | `placeholderCutin` (idle ×2 bust) | `src/art/cutins-v3/polar_sovereign.ts` (the only lane-D ace) |
| Event cinematics | `src/cinematics/b2/placeholders.ts`: `coinToss`, `massDestroy`, `tokenVanish` (+ others not ours) | `src/cinematics/d/<id>*.ts` registering at priority > 0 |
| Card cinematics | generic defaults (`_defaults/*`, `summon-b` poseEntrance, `_v3/death.ts`) | per-card hooks (§4) |
| Sounds | generic (`impactHeavy`, `uiClick` …) | `src/audio/v3/<card>.ts` (§5) |
| Death / glow tables | placeholder rows exist in `_v3/presets.ts DEATH_PRESETS` and `view/light/profiles.ts MONSTER_GLOW` | prefer the recipe (`src/presentation/cards/<id>.ts`): it overrides both in v3 only, no shared edit |

**Bridge rule (A3 §6.4):** everything v3 (recipe, voice, glow, death preset, material hits) is read only when
`LOOK_V3` **and** `hasMonsterArtV3(id)`. A v3 file in `src/art/monsters-v3/` is the switch. v1 keeps the
placeholders: never add a file under `src/art/monsters/` (it would change v1 and the v1 film gates).

## 1. The sprite: MonsterArt contract and a hand-made v3 rig

### 1.1 Contract (`src/art/types.ts`, shared — do not edit)
```ts
interface MonsterArt {
  id; w; h; anchorX; anchorY;   // ground point between the feet, frame px
  hover;                        // px above ground (floaters), 0 for walkers
  muzzle; core;                 // fallback points
  anims: Record<'idle'|'roar'|'attack'|'hit'|'guard', AnimSpec>;
  attackImpactFrame;
  draw(p, anim, frame, o?: DrawOpts);           // o.lightFrom 'left' (P1) | 'right' (P2 relit sheet)
  extraAnims?: Partial<Record<'summon'|'death'|'revive'|'special'|'hitHeavy'|'hitMagic'|'victory'|'toGuard'|'fromGuard', AnimSpec>>;
  drawExtra?(p, anim, frame, o?);
  weight?: 'heavy'|'mediumHeavy'|'medium'|'mediumLight'|'light'|'floater'|'caster';
  points?(anim, frame): { muzzle?, core?, head?, hand?, staff?, claw?, feet?, grip? };
  p2?: 'mirror'|'relight';      // lane D: always 'relight'
  portrait?(p);                 // the 44×34 card art (v3: blit the cardart-v3 small)
  knock?: 'sprite'|'pose'; poseKnockPx?; bodyPlan?; joints?;
}
interface AnimSpec { frames; fps; loop; holds?: number[] /* ms, length = frames */; marks?: Partial<Record<AnimMark, number>> }
```
Monsters face RIGHT; P2 = flipX of the sheet drawn with `{ lightFrom: 'right' }` when `p2: 'relight'`.

### 1.2 File layout of a hand-made rig (copy `steel_silencer`: 13 + 801 + 336 + 91 lines)
- `src/art/monsters-v3/<id>.ts` — 10-line shell, the registry entry (default export):
```ts
const art: MonsterArt = {
  id: 'polar_anvil', w: W, h: H, anchorX: RX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: RX + 4, y: GY - 30 },
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'heavy', p2: 'relight',
  draw(p, anim, f, o) { drawAnvil(p, framePose(anim, f), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p, anim, f, o) { drawAnvil(p, framePose(anim, f), o?.lightFrom ?? 'left'); },
  points(anim, f) { return framePoints(anim, f); },
  portrait(p) { p.blit(renderArt(card, 0).smallPx, 0, 0); },   // card = cardart-v3/<id>.ts (§2)
};
export default art;
```
- `<id>-rig.ts` — `interface Pose` (numbers: px offsets, light levels, fx phases) and `draw<Name>(p, pose, light)`:
  flat polygons/tubes with value planes measured from their own edges (`lightOf`, `run`, `ik2` from
  `src/art/rigkit`), whole-pixel moves, NO sprite rotation/scale, 1-px `PAL.ink` outline, light (eyes, cores,
  sparks) painted after the outline and never outlined (IŞ-9). Mirror the planes for `light === 'right'`.
- `<id>-anims.ts` — pose tables per anim (`idlePose(f)`, `attackPose(f)` …, keys as `Partial<Pose>` deltas over
  idle f0, `snap()` to whole px), `HOLDS` arrays, `ANIMS` / `EXTRA_ANIMS` with marks, a `framePose` cache and
  `framePoints(anim, f)` returning `muzzle/hand/core/head/feet` from the rig skeleton.
- `<id>-kit.ts` — shared shading helpers (steel_silencer's `planes()`), reused by the cut-in and card art.
- Other references: `abyss_magus-{rig,anims,maps}.ts` (caster, marks on every anim, cloth), `crystal_wyrm-
  {gbuf,rig,anims}.ts` (ace, g-buffer raster, relit P2, crumb pass), `_magma_titan.ts` / `_coral_serpent.ts`
  (body-plan path `planArt(biped, MEMBER)`; NOTE the leading `_`: **not registered** — the glob skips `_*.ts`.
  Use the `_` prefix yourself for a WIP rig you do not want in the game yet; render it with `--art`).
- The registry (`src/art/monsters/index.ts`) globs `../monsters-v3/*.ts` except `_*.ts` and four excluded WIP
  files. **No edit needed** to register: create `monsters-v3/<id>.ts` and it is live under `?look=v3`.

### 1.3 Required anims, marks, points (REHBER §4.1, §4.9, HA-1; `tools/lib/framelib.ts REQUIRED_MARKS`)
| Anim | Normal tier (lane D pieces, jester, archer, raiders) | Ace (sovereign) | Marks (required) |
|---|---|---|---|
| idle loop | ≥ 12 f, 1.6–2.0 s | 20 f ~2 s | — |
| guard loop | ≥ 6 f | 8 f | — |
| toGuard / fromGuard | ≥ 5 f, ≤ 0.4 s (end on guard f0 / idle f0) | 7 f | — |
| attack | ≥ 10 f | 13 f | charge, release (or impact), recover; contact for melee |
| roar | ≥ 9 f | 12 f | charge, release, recover |
| hit / hitHeavy / hitMagic | 5–6 / ≥ 7 / ≥ 7 f (all three mandatory) | 6/8/9 | impact = contact = 0, recover |
| summon | ≥ 10 f | 15 f | land |
| death | ≥ 8 f, ≤ 0.9 s | 10 f | impact = contact = 0, dissolve (~300 ms) |
| revive | ≥ 10 f | 13 f | land |
| special | ≥ 10 f if the card has an on-field effect (jester coin, sovereign split) | — | charge, release, recover |
| victory | optional | | |
Holds 40–200 ms (HA-2). Every one-shot ends on idle f0 (out ≤ 1.2). Contact frame local < 50 % (HA-21).
Points: `muzzle` on the source every frame (HA-25), `core`, `head`, `hand`, `feet`.

### 1.4 Per-card rig notes (from YENI_KARTLAR; 64 px class unless noted)
- **straw_decoy_token** (48 px): needs idle (arms sway, hat slides, crow silhouette), guard (tokens are always
  defense), hit*, death = the vanish poses (rope unties, straw spills, stake topples, §5.2 "S9 jeton"), summon
  = stake planted → straw wraps → jacket/sack head → button eyes (S9 storyboard; see §4.6 ownership).
- **polar_* pieces**: each needs a pose that the sovereign's fusion/split can reuse (rise, dock, fly out and land
  in defense). Draw the sovereign so the three pieces are READABLE in it (anvil = hips/base, coil = chest,
  needle = arms + compass spear) — pick frame sizes so a piece sprite can sit exactly on its sovereign region.
- **scrap_raiders** (64 wide): "tired guard" is its guard loop (sweat, smoke) and the lock is visible
  (a goblin repairing the wheel) — guard must still pass HA-19 (0.3–0.8 × idleΔ).

## 2. Card art (`src/art/cardart-v3/`)

- Contract `src/art/cardart-v3/_types.ts` `CardArtV3 { id, focus: [x,y] (BIG px), focusSmall?, frames?, holdMs?,
  big(l, f), small?(l, f, big) }`, layers `backdrop → subject (ink outline) → light`. Sizes **big 88×68**
  (2× density, inspect panel) and **small 44×34** (= `CARD_ART_W×CARD_ART_H`, the 1× face). Small = the same
  picture closer (a 1:1 tighter crop of the sprite is best), never a blind `autoSmall` (draft only).
- Kit `src/art/cardart-v3/_kit.ts`: `paintBackdrop(l.backdrop, 'EARTH'|'LIGHT'|'FIRE'…, { focus, horizon })`,
  `renderArt(card, f) → { big, small, bigPx, smallPx, auto }`, `artStats(layers, px, focus, true)`, `ink`, `rim`,
  `litEdge`, `reduceSubject`, `patch`, `asciiMap`. Example: `cardart-v3/steel_silencer.ts` (sprite crop on the
  DARK backdrop, 4 living frames 0/3/6/9).
- **How the game shows it:** for monsters the face uses `MonsterArt.portrait` (`src/art/cards.ts
  monsterArtCanvas`) — so wire it in your v3 art: `portrait(p) { p.blit(renderArt(card, 0).smallPx, 0, 0); }`
  (pattern `monsters-v3/seal_head.ts`). `cardface-v3/index.ts ART` is the spell route (dawn_swords, magic_hat) —
  lane D does not touch it. Nothing to edit in `src/data/cards.ts` (it has no art lines).
- Acceptance (KART_RESIMLERI §10): off-palette 0, isolated ≤ 10 %, ≤ 20 tones (backdrop ≤ 6), subject fill
  60–75 % (big), focus in `focusBox`, small not auto. Check it in a per-card test (copy `tests/art/seal_head.test.ts`
  "card picture" block) and look at it: `node tools/shot.mjs "?dev=cards&mode=x3&page=N&look=v3" --scale 1`
  or `?dev=cards3&page=inspect&look=v3`. The A5 render script referenced in KART_RESIMLERI §9 lived in another
  session's scratchpad and **is not in the repo**.
- **G1 trap (tests/art/cardface-v3.test.ts "G1 (auxiliary)")**: ≥ 70 % of a face's FRAME pixels (outside the
  44×34 window x 2..45, y 17..50) must differ between the v3 face and the `&a5=off` face. Today `scrap_raiders`
  = 0.6922 (dial_jester 0.703, reflection_archer 0.705, polar_anvil 0.711). Measured by the scout: the shared
  pixels are in the name plate (rows 3–6) and the text box (rows 54–64: ATK 2000 / DEF 0 digits and the
  greeked lines, both seeded by the card id) — **the art window is excluded, so a real card picture does NOT
  change G1.** PARALEL_OTURUMLAR's "fix it by giving the card its real art" does not work; the fix is in
  `src/art/cardface-v3/frame.ts` (lane A5-B code) or the test, neither ours. Report it to the orchestrator; do
  not hack the card data.

## 3. Cut-in (polar_sovereign only — the lane's one ace)

- Portrait `src/art/cutins-v3/polar_sovereign.ts`: `export default` a `CutinFactory` `(kit) => CutinArt`
  (200×144, facing right, `frames`, `holds` (played once, last held), `accent`, `accentDark`, `p2: 'relight'`,
  `draw(p, f, o)` honouring `o.lightFrom`). Auto-registered under v3 (`src/art/cutins/index.ts` glob
  `../cutins-v3/*.ts`). Template: `cutins-v3/steel_silencer.ts` (6 frames, 3× density, flat planes).
- Runtime `src/cinematics/_v3/cutin.ts cutInV3(scene, { monsterId, name, attribute, player, clear })` — a band,
  ≤ 900 ms (`CUTIN_V3_MAX_MS`), under the summoned tile; the summon kit plays it from `Stage.climax()`.
- Rhythm: in the recipe `cutIn: { rhythm: { flare, slam, exit } }` (read by `presets.ts cutInRhythm` through the
  bridge) — no edit of the `RHYTHM` table. Text "KUTUP HÜKÜMDARI!" comes from the card name (Turkish upper).
- The C15 split background (turuncu/mavi) = `accent` / `accentDark` + your portrait's own halves.
- Look: `node tools/shot.mjs "?dev=cutin&id=polar_sovereign&look=v3&sheet=1" --scale 2 --out …` and `&player=2`.

## 4. Cinematics

### 4.1 Registry (`src/cinematics/api.ts`, `_core/registry.ts`)
- Any `.ts` under `src/cinematics/` (except `_core/`, `_defaults/`, `api.ts`, `index.ts`) is imported at load in
  sorted path order; `_`-prefixed files ARE loaded (they just should register nothing). Put lane D files in a new
  folder, e.g. `src/cinematics/d/dial_jester.ts`, `d/polar_fusion.ts`, `d/straw_token.ts`.
- `registerCardHook(cardId, kind, handler, { priority, name })` — kinds: `summon flip tribute(keyed by forUid's
  card) tributed attackDeclare attack defend activate effect(monsterEffect activate) target destroyed destroys
  toGraveyard equip field statChange damage lpGain discard negate`. **No `positionChange`, `coinToss`,
  `massDestroy`, `tokenVanish` hook kinds** → use `registerEvent(type, h, { priority: 20 })` and filter:
  `if (!LOOK_V3 || ctx.cardId(ev.sourceUid) !== 'dial_jester') return ctx.base();`.
- `registerStrike(id, async (s) => { …; s.impact(at); … })` — only the attack motion; the battle handler does
  outcome, numbers, LP, death. `s.base?.()` runs the next strike (recipe strike, then the generic one).
- Chain order: higher priority first; equal priority: card hook before event handler, later registration first.
  Defaults are −100, old per-card files 0, `b2/placeholders.ts` 0, **recipe parts 10**. A lane-D hook must be
  at priority ≥ 20 if a recipe of the same card leaves that part non-custom, or mark the part `custom`.
- Every new handler starts with `if (!LOOK_V3) return ctx.base();` (v1 must stay byte-identical).
- Context (`_core/types.ts`): `ctx.ev, ctx.events, ctx.index, ctx.find/findType, ctx.consumeAt(i), ctx.play(i,
  hints), ctx.base(), ctx.unit(uid), ctx.tile(uid), ctx.locate(uid), ctx.atk/def(uid,'next'), ctx.views.field
  (addUnit, release, forget, placeCard, tileOf, sync), ctx.sfx, ctx.wait`. Helpers: `fx` (`_core/helpers.ts`:
  `takeHandCard, slamToZone, cardToGraveyard, resolutionRun, playRun, isAce …`). **Do not use `ctx.focus`.**

### 4.2 Summon (normal / special / tribute)
- Default v3 path for a card with a `summon` pose and no hook: `_defaults/summon.ts` → `summonEntrance` →
  `summon-b/_kit.ts entrance` → `_v3/summon.ts poseEntrance` (light column, hologram ≤ 300 ms, finale on land).
- Own entrance: `signatureSummon(id, legacyEntrance, { v3: myEntranceV3 })` from `summon-a/_kit.ts` (it wraps
  `runSummon`: card slam / tile, hidden unit, `warmPoses`, Stage, heal). In `myEntranceV3(S)`: `S.openCircle()`,
  `const p = S.pose({ ramp, onLand })` (plays the art's `summon` with the short hologram), `atMark(S.unit,
  'summon', 'land', …)`, `await untilFrame(S.unit, 'summon', F)`, `S.finale({ ring, ramp, freezeMs, sfx })`,
  aces `await S.climax()` (cut-in once) — model: `summon-a/crystal_wyrm.ts prismLandingV3` (lines 340–404).
  `S.special` = no card flight (graveyard / token / split), `S.tribute`, `S.cutIn`, `S.big`, `S.dir` (±1).
- Event flows (run by the scout with the engine, `b2*Auto` scenarios):
```
fusion (b2FusionAuto):  tribute(needle, forUid=sov) toGraveyard, tribute(anvil) toGraveyard, tribute(coil) toGraveyard,
                        summon{ sovereign, method:'special', from:'hand', zone 2, sourceUid:null }
split (b2SplitAuto):    activate(void_eye spell) massDestroy destroy(sovereign) toGraveyard(sov) toGraveyard(void_eye),
                        activate{ polar_sovereign, kind:'monsterEffect', from:'graveyard', zone:null },
                        summon{ needle|anvil|coil, method:'special', from:'graveyard', position:'defense', sourceUid: sov } ×3
                        (zones = the first free ones, NOT the old zones)
coin win:   activate(jester monsterEffect) decision(coinCall) | coinToss{call,result,win:true} massDestroy{refs: opp}
            destroy+toGraveyard per monster, activate(cloud_hatchling monsterEffect)   ← lane A's growth
coin lose:  … coinToss{win:false} massDestroy{refs: own} destroy+toGraveyard (jester too) damage{amount: ΣATK/2, sourceUid: jester}
raiders:    attack … battle … ; at endTurn (End Phase): positionChange{uid, position:'defense'} (lockPositionTurn = turn+2)
tokens:     activate(straw_decoys) summon{ straw_decoy_token, special, from:'token', defense, sourceUid: spell } ×N
            leaving: tokenVanish{ cause:'battle'|'effect'|'rule' } (no destroy, no graveyard)
```
- The fusion's three `tribute` events go to `summon-a/tribute.ts` (event handler, priority 0) which consumes the
  group + toGraveyards and then `ctx.play(summonIdx, { tribute: true, noCard: true })`. Own it with
  `registerCardHook('polar_sovereign', 'tribute', h, { priority: 20 })` (keyed by `forUid`'s card); collect the
  group like tribute.ts lines 52–68, then play the summon with `{ tribute: true, noCard: true, cutIn: true }`.
  Budget: the fusion is 6.0–6.5 s by spec (REHBER suWyrm budget 2.5–3.0 s ×1.45 does not apply — note it in
  the evidence, the owner set the length).
- Split: `registerCardHook('polar_sovereign', 'effect', …)` sees the graveyard activate; look ahead with
  `ctx.find(e => e.type === 'summon' && e.sourceUid === ev.uid)` and play/consume the three summons yourself
  (or hook `summon` of each piece and branch on `ev.from === 'graveyard' && cardId(ev.sourceUid) ===
  'polar_sovereign'`). The sovereign's own `destroyed` hook runs earlier (split cracks start there).
- Who destroys: `void_eye` (lane E) owns its `activate` and may consume the `massDestroy` / `destroy`s; your
  `destroyed` hook only runs if it plays them via `ctx.play`. Check with a film, coordinate via the orchestrator.

### 4.3 Strike
`registerStrike(id, s => …)` in `src/cinematics/d/<id>.ts`, v3-only. Pattern (`strikes/seal_leg_r.ts`,
`strikes-a/abyss_magus.ts strikeV3`): `void u.play('attack')`; sound on marks (`atMark(u,'attack','charge',…)`,
`takeCharge(u, 'xCharge')` continues the declaration's held charge); move the sprite with whole-px `animate`;
call `s.impact(point)` once on the contact frame (it fires hit-stop, number, reaction, material hit); resolve when
home. `s.impact()` takes its hit-stop from the ATTACKER's `weight` (`src/duel/motion.ts contactStopMs`, by power:
heavy 100–130, mediumHeavy 80–110, medium 60–80, caster 60, mediumLight 40–60 ms). Spec: jester 70 (medium),
archer 90 / needle 80 / anvil 90 / coil 90 (mediumHeavy), raiders 110 (mediumHeavy/heavy), sovereign 140 (heavy +
an extra `stopTime` of your own). Read the real value in `measure` events. Raiders' "goblin falls off and runs
behind" is strike FX (a separate sprite/raster), not the rig.

### 4.4 Death (`_v3/death.ts deathV3`)
`deathV3(ctx, { fallback: () => ctx.base(), onBurst: (u, at) => … })` plays the `death` pose from where the blow
left it, accent at `dissolve`, breaks as the material on the last frame, card born on the burst frame and flown
to the graveyard (≤ 1.4 s). Materials are only `crystal stone light shadow plant fire water` (`vfx/shatter.ts`) —
none is metal/brass/straw, so each card's §5.2 FINAL material (gears rolling, iron plates falling, wire spool,
straw bundle) is your own `onBurst` debris + the last death frames. Own the whole death with
`registerCardHook(id, 'destroyed', ctx => ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx) ? ctx.base() :
deathV3(ctx, {...}), { priority: 20 })` (`sourceOwnsDeath` from `strikes-b/_kit.ts`). Material/accent defaults:
recipe `death: { material: 'stone', accent: 'crystal' }`.
Coin-result "rewind" (C2: targets fold back INTO their cards, no erosion) is NOT a death: in your `massDestroy`
handler (source dial_jester) consume each `destroy` + `toGraveyard` and play the rewind yourself (play the unit's
`summon` backwards with `u.pose('summon', f)` per frame, fold to a card, fly to the grave / LP panel). Tokens in
the refs come as `tokenVanish` events — leave those to the token's handler (`ctx.play(i)`).

### 4.5 Effect / position
- Effect: `registerCardHook(id, 'effect', …)` gets `activate kind 'monsterEffect'` (jester before the coin
  decision; the sovereign's split from the graveyard). Use the art's `special` pose. The coin-toss set piece is
  a `registerEvent('coinToss', …, { priority: 20 })` (the `decision` coinCall UI is `src/duel/HumanInput.ts`
  `views.prompt.choose` with labels YAZI / TURA — 'tails' = YAZI, 'heads' = TURA; not ours).
- Position: `summon-b/position.ts` registers `positionChange` (generic v3 toGuard/fromGuard). Raiders' tired
  turn: `registerEvent('positionChange', h, { priority: 20 })` filtered on `ctx.cardId(ev.uid)`. The lock plate is
  `StatBadge` 'kneel' (`engine/query.ts plateLock`).

### 4.6 Presentation recipe (`src/presentation/cards/<id>.ts`, new file per card, pure data)
Recipes give v3-only body material (struck sound), death preset, glow, cut-in rhythm, voice. The recipe layer
only builds `throw` strikes and `assemble` summons — mark everything you write yourself custom:
```ts
export default {
  id: 'polar_anvil', tier: 'normal',
  body: { physical: 'metal' },                      // material lib: basalt bone cloth crystal hide lava metal moss runeGold scale shadow stone water
  attack: { type: 'slam', blow: 'physical', from: 'muzzle', vfx: 'pushWave', tone: PAL.water4 },
  summon: { style: 'assemble', matter: 'stone' },
  death: { material: 'stone', accent: 'crystal' },
  voice: { custom: 'polar_anvil' },                 // needs a CHARACTER_SOUNDS entry (tests/presentation/recipes.test.ts)
  light: { glow: { emissive: [[PAL.water4, 1], [PAL.fire4, 1], [PAL.gold4, 0.6]], halo: 0.6, pool: 0.9 }, strike: PAL.water4 },
  custom: { strike: true, summon: true, death: true, flip: true, effect: true },
} satisfies PresentationRecipe;
```
`tests/presentation/recipes.test.ts` checks: palette colours, custom voice exists, `attack.from` is a point of the
release frame, set pieces exist. Material hits that exist as sounds: crystal, metal, cloth (slice) and stone
(generated); others fall to their sound root.
Token ownership: the S9 stakes entrance belongs to `straw_decoys` (lane E). Lane D draws the token's `summon`
pose to that storyboard and registers `registerCardHook('straw_decoy_token', 'summon', …)` for `from: 'token'`;
agree with lane E (orchestrator) who plays it — whoever handles `activate straw_decoys` may consume the summons.

## 5. Sound

### 5.1 A per-card sound file (pattern `src/audio/v3/dawn.ts`)
```ts
// src/audio/v3/polar.ts
import type { Recipe } from '../sounds';
import { midiHz } from '../synth';
import { clank, crack, drone, glassRain, link, puff, sweep, thump } from './kit';
export const V3_POLAR_RECIPES = {
  polarAnvilKlak: { cap: 2, gap: 0.02, verb: 0.3, duck: 0.35, play(v) { clank(v, 410, 0, 0.3, 0.5, { ratio: 1.41, index: 2.4, click: 0.8 }); thump(v, 0, 120, 45, 0.5, 0.2, { drive: 1.4 }); } },
} satisfies Record<string, Recipe>;
export type PolarSfxName = keyof typeof V3_POLAR_RECIPES;
```
Then three ONE-LINE additive edits (re-read the file first; other lane-D agents edit the same lines):
`src/audio/sfx.ts`: `import type { PolarSfxName } from './v3/polar';` next to the DawnSfxName import, and
`| PolarSfxName` after `| DawnSfxName`; `src/audio/sounds.ts`: `import { V3_POLAR_RECIPES } from './v3/polar';`
and `...V3_POLAR_RECIPES,` after `...V3_DAWN_RECIPES,`. Spreads override silently → **prefix every name**:
`jester* archer* raiders* polar* (pieces) sovereign* straw*`. One file per card family is fine
(`v3/jester.ts`, `v3/archer.ts`, `v3/raiders.ts`, `v3/polar.ts`, `v3/straw.ts`).
- Recipe fields: `verb` (0..1), `cap` (voices), `gap` (s), `duck` (music duck 0..1: ≥ 0.55 big moments, ≤ 0.3
  small, SE-7), `vary`, `play(v: Voice)`. Kit blocks (`src/audio/v3/kit.ts`): `glassBell glassReverse glassRain
  crack thump puff sweep clank link drone growl` + Voice primitives `v.tone, v.bell, v.filt, v.bursts, v.r`.
  `glassReverse` is R2's identity (filler only). Pitches/identities: YENI_KARTLAR §5.1 (jester 3.2 kHz tick +
  brass coin + spring; archer 660 Hz + 80 ms-late lower octave; raiders 70 Hz engine + tin; polar 110/111 Hz
  beat + iron-dust `glassRain`, needle 220 / anvil 82 / coil 147, sovereign chord + 35 Hz gong).
### 5.2 Character roles and sync
- `src/cinematics/_v3/sound.ts CHARACTER_SOUNDS` (shared; add ONE entry per card next to the others):
  `roar arrive land charge [swing] release impact [deathStart] dissolve [afterDissolve] burst reviveGather
  reviveLand` (SE-3). The kits (summon, declare, battle, death, soul_recall) play these by role once
  `soundsOf(id)` resolves (recipe `voice: { custom: id }`).
- Sync to frames, never to timers: `atMark(u, anim, 'release', () => play('x'))`, `atFrame(u, anim, f, cb)`;
  sustained: `const h = start('xCharge'); … h.stop(80)` (SE-2). `play/start/fade/hush/panAt` from `_v3/sound.ts`.
- Struck body = material hit (`hitSoundFor` via recipe `body`) — do not also play a generic `impactHeavy`.
### 5.3 Verify (agents cannot hear)
- Offline thumbnails: `node tools/shot.mjs "?dev=audio&page=one&name=<sfx>" --wait 1500 --out …png` (waveform,
  RMS, spectrogram, peak); grid `&page=grid`, mix `&page=mix`. Analysis helpers `src/audio/analyze.ts`
  (`stats`, `columns`, `spectrogram`).
- MP4 with sound for the owner: `node tools/clip.mjs "?dev=duel&s=<key>&look=v3" --music off --marker <sfx> --out
  shots/v3/d/<id>/<key>.mp4` (+ `.wav`, `.json`: read the level line — peak ≤ −1 dBFS, 0 clipped).

## 6. Lights and death presets
- Glow: recipe `light.glow` (`MonsterGlow`: `emissive [[colour, weight]]`, `halo`, `pool`, `spill`, `near`) — the
  placeholder rows in `src/view/light/profiles.ts MONSTER_GLOW` stay (they are what v1 shows). Floor light in
  cinematics: `lightFlash / lightPool / lightBeam / lightDim` from `src/view/light` (stepped, EF-6).
- Death preset: recipe `death` (bridge in `_v3/presets.ts deathPreset`); placeholder rows in `DEATH_PRESETS`
  stay. `matterRamp(id)` gives the matter tones for holograms/motes.

## 7. Tools (all run by the scout in this tree; one heavy tool at a time, use `timeout`)
Scout evidence: `shots/v3/d/_handbook/`. Times are on this 4-CPU container.
A worktree of the lane start commit exists for base runs: **`/home/user/yugioh-base6178`** (detached 6178b55,
`node_modules` symlinked). Never edit it. Recreate if gone:
`git worktree add --detach /home/user/yugioh-base6178 6178b55 && ln -s /home/user/yugioh/node_modules /home/user/yugioh-base6178/node_modules`.

**7.1 monster-sheet** (≈ 6 s per side) — sheets ×3, marks/holds in headers, `.txt/.json` numbers:
```sh
npx vite-node tools/monster-sheet.ts --id polar_anvil --look v3 --anims all --scale 3 --points --out shots/v3/d/polar_anvil/sheet
npx vite-node tools/monster-sheet.ts --id polar_anvil --look v3 --anims all --scale 3 --points --p2 --out shots/v3/d/polar_anvil/sheet
npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/_polar_anvil.ts --anims all --scale 3 --out …   # unregistered WIP
```
Files `<id>-v3-<anim>.png`, `<id>-v3-all.png`, `<id>-v3.json`, `<id>-v3-p2*.png/json`. Without a v3 file it
silently draws the placeholder ("v1 art (no v3 file)").
**7.2 monster-gates** (≈ 15 s): `npx vite-node tools/monster-gates.ts DIR/<id>-v3.json DIR/<id>-v3-p2.json
--ref none --out DIR/gates.txt` → table KK-3/4/5/6, IŞ-1, KK-13; exit 0 = all ok, 2 = a FAIL. Use **`--ref
none`** in lane D: the default `--ref v1` compares idle-f0 noise with the v1 art = the placeholder totem (it made
steel_silencer's run fail IŞ-10 ref, the only FAIL of 24 rows). `--class medium|large|ace` for the byte budget.
**7.3 shot film of a duel** (≈ 30 s): `node tools/shot.mjs "?dev=duel&s=b2CoinWinAuto&look=v3" --fresh --film 16
--every 200 --cols 4 --out …png`; zoom on a beat: `--start 2400 --every 17 --film 8 --clip 200,80,240,160 --scale 3`;
all frames: `--frames DIR`. The 5+5 board is the v3 default. Placeholder coin film: the coin lands ~2.2 s, the
"YAZI — BİLDİ!" word at 3.0 s, the wipe after it (film ≥ 5 s).
**Lane-D scenarios in `src/duel/scenarios/b2.ts`** (rng 12345: the next coin is YAZI = 'tails', next die 6):
`b2CoinWinAuto` (call tails), `b2CoinLoseAuto` (call heads), `b2Coin` (manual, with guardian_charm),
`b2FusionAuto`, `b2Fusion` (manual, P2 holds void_eye), `b2SplitAuto` (void_eye splits the sovereign),
`b2Tokens`, `b2QuickDecoy`, `b2QuickOwn` (token flows; spell is lane E), `b2Control` (raiders + anvil as
targets), `b2QuickDecoy` (archer + crag axeman attack, P2 answers with decoys). **Add your own** as `src/duel/scenarios/d_<id>.ts` (auto-globbed,
`export default { key: { desc, stage, steps } }`; template `scenarios/steel_silencer.ts`; keys must be globally
unique — prefix `dj* ra* sr* pn* pa* pc* ps* st*`). Stage with `zones: 5` and explicit indices, or 3-zone stages
are shifted one lane right. Needed per card: summon P1/P2, attack (monster / direct / blocked), killed, guard
hit, + card moments (coin win/lose P1/P2, fusion P2, split partial-fail, raiders end-turn lock, token vanish
battle/effect). Events of a scenario without a browser: a vite-node script calling `buildStage` + `apply`
(`src/duel/scenario.ts`, `src/engine`) — that is how §4.2's flows were printed.
**7.4 ?dev previews**: `node tools/shot.mjs "?dev=monster&id=polar_needle&look=v3&mode=live" --scale 2 --out …`
(also `mode=sheet|board`, `&anim=attack`); `?dev=cutin&id=<id>&look=v3&sheet=1` (+`&player=2`);
`?dev=audio&page=one&name=<sfx>` with `--wait 2500` (waveform, chain peak, spectrogram — looked at for
dawnPlant: 120 ms, chain peak 0.63); `?dev=cards&mode=big&page=11|13&look=v3` (jester 56, archer 58, raiders 59 →
page 11; polar 66–69 → page 13).
**7.5 measure --look v3** (≈ 20 s per pair, `--norender` for timing only):
`node tools/measure.mjs --scenarios b2CoinWinAuto,b2FusionAuto,b2SplitAuto --look v3 --jobs 2 --norender --out …json`
Today (placeholders): fusion input-ready 4367 ms, coin win 8183, split 9633; 0 errors, zoom 1.
**7.6 camera gate** — no `measure-v3-a56-0.json` exists here; make the base from the worktree with `--root`:
```sh
node tools/measure.mjs --root /home/user/yugioh-base6178 --scenarios <keys> --look v3 --jobs 2 --norender --out shots/v3/d/<id>/m-base.json
node tools/measure.mjs --scenarios <keys> --look v3 --jobs 2 --norender --out shots/v3/d/<id>/m-now.json --camera-gate shots/v3/d/<id>/m-base.json
```
(exit 0; 3 = FAIL). It demands `focusCalls` EQUAL to the base: today `b2FusionAuto` has focus 1 / maxScroll
10 px (the generic ace summon), so your custom fusion must keep that one existing focus — not add, not drop —
or it fails. New keys are NOBASE (only zoom = 1 and closeUps = 0 checked); never add camera calls anyway.
**7.7 filmdiff v1 gates** (≈ 10 + 13 min with `--jobs 2`; run only before a commit):
```sh
node tools/filmdiff.mjs --set v1   --base shots/v3/a3/baseline/v1films     # → all 17 film(s) IDENTICAL, exit 0
node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films  # → all 26 film(s) IDENTICAL, exit 0
```
Both base dirs were MISSING; the scout wrote them from 6178b55 (`cd /home/user/yugioh-base6178 && node
tools/filmdiff.mjs --set v1 --base /home/user/yugioh/shots/v3/a3/baseline/v1films --write --jobs 2`, same for
a6v1) and compared HEAD 03c3abc: **v1 17/17 IDENTICAL, a6v1 26/26 IDENTICAL**.
**7.8 contact-probe** (≈ 40 s): `node tools/contact-probe.mjs --scenarios <yourKill>,<yourHit> --out
shots/v3/d/<id>/probe.json --png shots/v3/d/<id>/probe --jobs 2` → "resting contacts failing: 0" (ssKill
steel_silencer: screen 7.2 % PASS). A scenario with no battle prints "(no contact found)".
**7.9 palcheck** on film frames: `node tools/palcheck.mjs <frames dir> --every 100 --rules a6 --vs <base frames
dir>`. ALWAYS with `--vs`: the v3 5-lane arena alone is at 1.7–2.0 % white, so the plain limit (1.5 %) fails
even the placeholder coin film (scout run: FAIL white 2.01 %). Base frames: run the same `shot.mjs --frames` in
the worktree (`cd /home/user/yugioh-base6178 && node tools/shot.mjs … --frames /home/user/yugioh/shots/v3/d/<id>/base-frames`).
**7.10 clip.mjs** (≈ 60 s for 9 s): `node tools/clip.mjs "?dev=duel&s=b2CoinLoseAuto&look=v3" --music off --marker
uiError --out shots/v3/d/<id>/x.mp4` → `.mp4 .wav .json`; read "levels: peak −2.0 dBFS … clipped samples 0" and
"markers: uiError@2833ms→frame 85". Music on (ducking check): drop `--music off`.
**7.11** `npm run typecheck` (≈ 30 s, clean at 03c3abc), `npx vitest run tests/art/<id>.test.ts`, `npm test`
(known failures: dusk_ashen, hourglass_imp, shield_titan, cardface-v3 G1 scrap_raiders — see §2).

## 8. Lane D definition of done (per card) and pitfalls
### 8.1 Definition of done (tick every box, evidence in `shots/v3/d/<id>/`, status in `docs/v3/oturum-d.md`)
1. **Rig** `src/art/monsters-v3/<id>.ts` (+ rig/anims/kit files), `p2: 'relight'`, every anim of §1.3 with holds
   and marks; `monster-sheet` P1 + P2 ×3 looked at in ≥ 3 critique rounds (art / motion / technique, findings by
   rule id); `monster-gates` all PASS (KK-3…KK-6, IŞ-1, KK-13).
2. **Card art** `src/art/cardart-v3/<id>.ts` big + hand-made small, `portrait()` wired; budgets pass in a test.
3. **Cut-in** (sovereign only) with relit P2, rhythm in the recipe, ≤ 0.9 s.
4. **Recipe** `src/presentation/cards/<id>.ts` (body, death, glow, voice custom, custom parts) —
   `tests/presentation/recipes.test.ts` green.
5. **Cinematics**, all v3-gated, unique per card: summon (normal; sovereign: fusion + split; pieces: their own
   entrance AND the split landing in defense), strike (monster + direct + blocked), death (own final material,
   §5.2), effect (jester coin with win/lose rewind; sovereign split), position (raiders tired guard + lock),
   token vanish. P1 and P2 filmed.
6. **Sound** file with prefixed names, CHARACTER_SOUNDS entry, every beat on a mark; `?dev=audio&page=one`
   looked at for each new sound; one `clip.mjs` MP4 per moment, peak ≤ −1 dBFS, 0 clipped (SE-6).
7. **Budgets** (`measure --look v3`): attack 1.6–2.2 s ×1.45, death ≤ 1.4 s ×1.45, number = contact ±17 ms,
   declare ≤ 0.3 s; fusion/coin per the storyboard length (document it).
8. **Per-card test** `tests/art/<id>.test.ts` (copy seal_head.test.ts) + scenario file
   `src/duel/scenarios/d_<id>.ts`.
9. **Gates**: `npm run typecheck` clean in your files; `npm test` no new failures; filmdiff v1 17/17 and a6v1
   26/26 IDENTICAL; `measure --camera-gate` exit 0; `palcheck` exit 0 on your films; contact-probe PASS on
   your struck units.
10. Commit + push to `claude/kart-d` only when your instructions say so (the commit step usually does it).

### 8.2 Pitfalls found while writing this
- **Baselines are not in the repo** (`shots/` is gitignored). `shots/v3/a3/baseline/v1films` and
  `shots/v3/a56/baseline/a6v1films` were missing in this container; the scout regenerated them from the lane's
  start commit 6178b55 (§7.7). Do not `--write` over them; if they vanish, regenerate the same way.
- The `_`-prefix rule differs: `monsters-v3/_x.ts` and `cutins-v3/_x.ts` are NOT registered; `cinematics/**/_x.ts`
  IS loaded (keep it side-effect free).
- A recipe that leaves a part non-custom installs it at priority 10 and silently beats your priority-0 hook.
- `massDestroy` is shared with lane E (`void_eye`, `sweeping_gale`): always filter on the source card and
  `ctx.base()` otherwise; same for `positionChange` (every card) and `summon` from `token`.
- `coinToss` in `b2/placeholders.ts` draws text with `pixelText` and uses `scaleX` flips: fine for a placeholder,
  but EF-7 forbids fractional scale in v3 — draw the coin's spin as pixel frames.
- Split pieces land in the first free zones (0, 1, 2…), not where they were tributed from.
- Jester lose: the damage event carries `sourceUid = jester` after the jester is already destroyed — the card
  must still fly from the LP-panel line, so do not look the unit up for it.
- Cloud hatchling's growth `activate` (lane A) follows the jester's win in the same batch; leave it to its hook.
- `?dev=cards&mode=x3` only pages the first 20 cards (page clamped 0–4); lane-D faces are on `&mode=big&page=11`
  (jester, archer, raiders) and `&page=13` (polar ×4). The token is not in `ALL_CARD_IDS`.
- Hourglass/shield/venom/wisp v3 files exist but are excluded in the registry — not a precedent to edit that list.
- Several agents share the container: run one heavy tool at a time; a filmdiff of both sets takes ≈ 25–30 min
  with `--jobs 2`.
