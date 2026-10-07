# API notes from the build agents

Auto-collected `apiNotes` returned by each agent (exact exported APIs, sync points, colors).
When two sections cover the same files, the LATER section is newer. Read the source when in doubt.

## src/engine/rules.ts, src/engine/query.ts, src/engine/legal.ts, src/engine/rng.ts

Files: src/engine/rules.ts, src/engine/query.ts, src/engine/legal.ts, src/engine/rng.ts, src/engine/bot.ts, src/engine/describe.ts, src/engine/index.ts, tests/engine/helpers.ts, tests/engine/flow.test.ts, tests/engine/summon.test.ts, tests/engine/battle.test.ts, tests/engine/effects.test.ts, tests/engine/fuzz.test.ts, tests/engine/describe.test.ts

IMPORT: everything from 'src/engine' (index.ts). Contract API unchanged. Additive exports:
- chooseAction(state: GameState, seed = 0): Action. Always returns an element of legalActions(state), for actingPlayer(state). Throws if the game is over. `seed` only varies tie-breaking; it is deterministic for (state, seed).
- describeEvent(state, ev, batch?: readonly GameEvent[]): string | null. Pass the events array of the same apply() as `batch` so hidden cards are not spoiled. `state` may be the before or the after state.
- describeEvents(state, events): string[]. Same lines with nulls dropped and look-ahead applied. Use this for the battle log.
- describePending(state, pending): string. Turkish prompt, e.g. "Oyuncu 2: Tuzak kartı açmak ister misin?", "Dikenli Pusucu'nun etkisi: yok edilecek canavarı seç.", "Oyuncu 1: El sınırı 6. Elinden 1 kart at."
- cardName(id, case?), playerName(p, case?), inflect(name, case, possessive?). Cases: 'nom'|'acc'|'dat'|'gen'|'loc'|'abl'.
- isLegal(state, action): boolean.
- Helpers in src/engine/query.ts: findMonster, uidAt, spellTrapRefs, monsterRefs, volcanoActive, equipBonus. In src/engine/rng.ts: makeRng(seed).

ACTION SHAPES the UI must send (exactly as listed by legalActions; uid lists may be in any order):
- normalSummon / setMonster: {uid, zone, tributes: uid[]}. `zone` may be a zone freed by a tribute.
- activateSpell:
  - Normal spell (hand or set): {uid, target?}.
  - Equip from hand: {uid, zone: free S/T zone, target: {kind:'monster', ref: own face-up}}.
  - Equip already set: {uid, target}.
  - Field spell: {uid}.
  - judgment_bolt: target {kind:'monster', ref: opponent zone}.
  - soul_recall: target {kind:'graveyard', uid, toZone}.
- attack: {attackerZone, targetZone | null}.
- respond: {uid | null}.
- chooseTarget: {target: ZoneRef}.
- discard: {uids}.

EVENT SEQUENCES (P = acting player; [..] = optional; ┃ = the batch ends and the next apply continues):
- newGame: gameStart{firstPlayer, seed} → shuffle(0) → shuffle(1) → 8× draw{initial:true} alternating, first player first → turnStart{turn:1} → phaseChange(draw) → phaseChange(main). There is no draw on turn 1.
- Turn start (after endTurn): phaseChange(end) → [decision(discard) ┃ discard → toGraveyard(from:'hand', zone:null) ×count] → turnStart{player, turn} → phaseChange(draw) → draw{initial:false} | (deckOut → gameOver{reason:'deckout'}) → phaseChange(main).
- Normal summon: summon{method:'normal', from:'hand', position:'attack', sourceUid:null}.
  - If the defender has a ready chasm_trap and current ATK ≥ 1000: → decision(trapResponse) ┃ then see "chasm" below.
  - Then on-summon effects: lumen_sprite: activate{kind:'monsterEffect', from:'monster', zone} → lpGain(500).
- Tribute summon (ace): per tribute, in zone order: tribute{uid, zone, forUid} → toGraveyard{from:'monster', zone} → [if it carried an equip: destroy{location:'spellTrap', reason:'rule', sourceUid: tributed uid} → toGraveyard{from:'spellTrap'}]. Then summon{method:'tribute'} → [chasm window] → triggers:
  - magma_titan: activate(monsterEffect) → damage{player: opponent, 500, source:'effect'} → [gameOver].
  - abyss_magus (only if the opponent has any S/T or field card): decision(chooseTarget{player: summoner, candidates: opp spellTrap/field refs}) ┃ activate{monsterEffect, from:'monster'} → target{targets:[ref]} → destroy{location:'spellTrap'|'field', reason:'effect'} → toGraveyard{from:'spellTrap'|'field'} → [fieldSpell{active:false}] → [statChange…].
  - The cut-in is decided by CARDS[cardId].ace.
- chasm_trap response: respond(uid) ┃ activate{kind:'trap', from:'spellTrap', zone} → destroy{monster, reason:'effect', sourceUid: trap} → toGraveyard(monster) → toGraveyard(trap, from:'spellTrap'). The summon's own triggers then do NOT resolve.
- Declining any trap window: respond(null) ┃ responseDeclined{player} → the flow continues.
- Set: setMonster{player, uid, zone} (no cardId; tributes come first as above). setSpellTrap{player, uid, zone}.
- Flip summon: flip{cause:'flipSummon'} → summon{method:'flip', from:'field', position:'attack'}. Treat the pair as ONE animation: the card flips, then the hologram rises. Then triggers: magma burn, or thorn_lurker: decision(chooseTarget{candidates: opponent monster refs}) ┃ activate{from:'monster'} → target → destroy{reason:'effect'} → toGraveyard.
- Position change: positionChange{uid, zone, position}.
- enterBattle: phaseChange(battle).
- Attack: attackDeclare{attackerUid, attackerZone, targetUid|null, targetZone|null}.
  - [If the defender has a ready mirror/chains trap: → decision(trapResponse{trigger:{kind:'attackDeclared'}}) ┃ responseDeclined | trap sequence.]
  - Then: [flip{cause:'attacked'} if the target was face-down; it stays in defense] → battle{attackerAtk, targetPosition, targetValue, result} → [damage{source:'battle'}] → [destroy{reason:'battle'} → toGraveyard (+ equip rule destroy) for the target, then for the attacker] → triggers in order: volt_lizard (activate{from:'graveyard', zone:null} → damage 500) → ember_wolf (activate{from:'monster'} → damage 300) → tide_golem (activate → damage 300 to the attacker) → thorn_lurker flip effect (decision(chooseTarget) for the DEFENDER ┃ activate{from:'graveyard' or 'monster'} → target → destroy → toGraveyard).
  - Battle results:
    - direct: battle{result:'direct', targetUid:null, targetPosition:null, targetValue:null} → damage(defender, ATK).
    - targetDestroyed (ATK vs ATK): damage(defender, diff) → destroy target.
    - targetDestroyed (vs DEF): no damage, unless the attacker is coral_serpent (piercing damage first).
    - attackerDestroyed: damage(attacker's player, diff) → destroy attacker.
    - bothDestroyed: no damage → destroy target → destroy attacker.
    - noDestroy vs DEF: damage(attacker's player, DEF−ATK) if DEF > ATK; nothing if equal.
  - The damage event's sourceUid is the monster that dealt the damage.
- mirror_barrier: activate{kind:'trap', from:'spellTrap', zone} → for each face-up attack-position attacker-side monster, in zone order: destroy{reason:'effect'} → toGraveyard → [its equip: destroy(rule) → toGraveyard] → toGraveyard(trap). The attack does not happen; the battle phase continues.
- chains_of_light: activate(trap) → attackNegated{player: ATTACKING player, attackerUid, byUid: trap} → toGraveyard(trap) → phaseChange(end) → [discard decision] → turnStart(next)… (the turn passes inside the same batch).
- judgment_bolt: activate{kind:'spell', from:'hand', zone:null | from:'spellTrap', zone} → target{targets:[ref]} → destroy{reason:'effect'} → toGraveyard → [equip rule destroy] → toGraveyard(spell, from:'resolved', zone: S/T index if it was set, else null).
- healing_spring: activate → lpGain(1000) → toGraveyard(resolved).
- soul_recall: activate → target{targets:[own destination zone], graveyardUid} → summon{method:'special', from:'graveyard', sourceUid: soul_recall} → toGraveyard(soul_recall, resolved) → [magma burn].
  - The revived card keeps its owner; when it leaves, toGraveyard.owner is the owner.
- dragon_blade: activate{from:'hand', zone: destination S/T | from:'spellTrap', zone} → target → equip{spellUid, spellZone, targetUid} → statChange{uid, atk, def, prevAtk, prevDef}.
- volcano_arena: activate{from:'hand', zone:null} → [old field spell: destroy{location:'field', zone:0, reason:'rule'} → toGraveyard{from:'field'} → fieldSpell{old, active:false}] → fieldSpell{new, active:true} → statChange per face-up monster whose NET value changed (FIRE +500, WATER −300). Replacing volcano with volcano produces no statChange.
- Surrender: gameOver{winner: other, reason:'surrender'}.
- LP: the damage event carries the requested amount; lpAfter is clamped at 0. gameOver{reason:'lp'} follows the step that reached 0.

Timing: the engine has no durations. Each apply() batch should be played in order. When a 'decision' event arrives, show the prompt, using state.pending (also cloned in the event) for the options.

Open issues reported by the agent:
- Balance note for the designer: in bot-vs-bot games the second player wins about 59% (238 of 400). The first player cannot attack on turn 1 and skips the draw, and Speed Duel has no second main phase.
- Ruling choices made where the docs were silent:
- A single field spell for the whole field, so a new one replaces the opponent's too.
- Field spells cannot be Set.
- Normal spells from hand need no free S/T zone.
- Kor Kurdu also burns when it wins as a defender.
- FLIP effects fire even if the monster is destroyed in that battle.
- attackNegated.player is the attacking player.
- Abyss Magus and Thorn Lurker emit 'activate' after the target is chosen, not before the decision. The 'decision' event is the cue.
If the designer wants any of these changed, each is a small, localised change in rules.ts or legal.ts.
- The 0-ATK-vs-0-ATK battle rule and the 'both players reach 0 LP together → turn player wins' rule are implemented but cannot occur with the current 20 cards. The first is only covered by code; the second only by a synthetic test.
- The bot plays reasonably but simply. It reads no hand or graveyard information beyond its own cards, guesses an unknown face-down monster's DEF as about 1200, and does not plan multi-turn lethal or reorder attacks around enemy traps.
- src/engine/index.ts gained additive re-exports only: chooseAction, describeEvent, describeEvents, describePending, cardName, playerName, inflect, isLegal. No existing names changed. types.ts is untouched.

## src/ui/text.ts, src/art/font.ts, src/boot/10-fonts.ts, src/dev/previews/font.ts

Files: src/ui/text.ts, src/art/font.ts, src/boot/10-fonts.ts, src/dev/previews/font.ts

All exports from src/ui/text.ts. The contract names are unchanged; everything else is additive.
- type TextSize = 'sm'|'md'|'lg'|'xl'. TEXT_SIZES is the readonly list of these.
- interface TextOpts { size?='sm'; color?=PAL.white; outline?=true; align?='left'|'center'|'right'; maxWidth? (game px); originX?=0; originY?=0; shadow?: number (NEW: PAL.ink drop shadow, in FONT px, so 1 = 3 game px at xl); lineSpacing?: number (NEW: font px added to the line spacing, negative = tighter, default 0) }
- registerFonts(scene): void. Safe to call more than once. Boot step 10 calls it, and pixelText calls it lazily. Textures and bitmap-font keys: 'font:sm', 'font:sm:plain', 'font:md', 'font:md:plain'. fontKey(size, outline=true) returns the key.
- pixelText(scene, x, y, text, opts?): Phaser.GameObjects.BitmapText.
  - x and y are rounded to integers.
  - lg and xl use fontSize 14 and 21, so setScale(…) tweens stack on top of that and keep the origin.
  - The returned object's setText (and its `text` setter) is replaced: it sanitises and re-wraps like the original call did, and also accepts numbers. t.text contains '\n' at wrap points.
  - Do NOT call setLetterSpacing, setLineSpacing or setMaxWidth on these objects. The exact metrics depend on the internal −1/+1 spacing.
- measureText(text, size='sm', maxWidth?, outline=true, lineSpacing=0): {w, h}. It is exact and equals t.width/t.height. Examples: 'LP 4000' at lg is 92×30. The card text at sm in a 92 px box is 4 lines, 92×45.
- textMetrics(size='sm', outline=true): {scale, lineHeight, height, capTop, capHeight, xTop, baseline}, in game px measured from the box top. lineHeight is the distance from one line's top to the next; height is a one-line box. With outline:
  - sm: {1, 11, 12, 4, 5, 5, 9}
  - md: {1, 14, 15, 4, 7, 6, 11}
  - lg: {2, 28, 30, 8, 14, 12, 22}
  - xl: {3, 42, 45, 12, 21, 18, 33}
  - The box includes the accent rows above the caps, so use capTop to line up cap tops. md/lg/xl capitals are exactly centred in the box (originY 0.5 centres caps). sm capitals sit 0.5 px low.
- wrapText(text, size='sm', maxWidth?, outline=true): string[] (sanitised lines). sanitizeText(text): string. upper(s) and lower(s) do Turkish-aware case (i ↔ İ, ı ↔ I). Use upper() instead of toUpperCase().
- pixelLetters(scene, x, y, text, opts?): {letters: {obj: BitmapText, ch, x, y, line, index}[], left, top, w, h}. Each letter has origin (0.5, 0.5); (x, y) is its resting position. Letter positions match pixelText(...) with the same opts exactly; spaces are skipped. Use it for per-letter DÜELLO!/TUZAK! drops: tween each obj from y-70, squash on landing, then setScale(1) to settle.
- revealText(t, count): number. Shows the first `count` non-space characters with no layout movement and returns the total number of characters. typeText(scene, t, cps=45, onChar?(ch, i)): Promise<void>. It runs on scene time, so it follows the global speed; onChar is the hook for typing sounds. setTextMaxWidth(t, maxWidth) re-wraps the text.
- Colour tricks:
  - t.setTint(top, top, bottom, bottom) gives a vertical gradient per glyph (e.g. gold4→gold2 titles).
  - t.setTintFill(PAL.white) gives a solid white silhouette for impact flash frames. Restore with t.setTint(color), since clearTint goes to white.
  - setCharacterTint(start, len, false, color) highlights a word.
- src/art/font.ts exports FONT_DEFS, getFont(id), fontCharset(), hasGlyph(ch), glyphCanvas(), buildFontAtlas(), bitmapFontData() and phantomCode(), in case another module wants glyph pixels, for example to shatter letters into particles.

Open issues reported by the agent:
- No kerning, on purpose. Phaser 3.90 GetBitmapTextSize carries a stale kerningOffset across '\n', which would break exact metrics and could make outlines overlap. SNES-style proportional fonts don't kern either.
- sm capitals sit 0.5 px below the centre of the text box, because the cell has 3 accent rows above and 2 descender rows below. md, lg and xl are exactly symmetric. For pixel-exact vertical placement of sm labels, use textMetrics('sm').capTop.
- Additive contract changes in src/ui/text.ts: new TextOpts fields `shadow` and `lineSpacing`, optional 4th and 5th parameters on measureText (outline=true, lineSpacing=0), and new exports (upper, lower, sanitizeText, wrapText, textMetrics, fontKey, TEXT_SIZES, pixelLetters, revealText, typeText, setTextMaxWidth). Existing names and signatures are unchanged.
- While typeText/revealText is partway through, t.text contains private-use invisible characters (U+E000 and up). Call t.setText(...) or revealText(t, Infinity) to restore the plain text.
- Tooling: tools/shot.mjs at --scale 5 or higher timed out on page.goto under the shared CPU load, because swiftshader struggles with a 3840×2160 viewport. I captured at --scale 1 and upscaled with PIL (nearest neighbour) instead. Other agents may hit the same thing.
- A note for other agents: the Write tool decoded \uXXXX escapes in file content into the literal characters. I fixed my files so they use escape sequences again.

## src/vfx/combat.ts, src/vfx/shatter.ts, src/vfx/numbers.ts, src/boot/13-vfx-combat.ts

Files: src/vfx/combat.ts, src/vfx/shatter.ts, src/vfx/numbers.ts, src/boot/13-vfx-combat.ts, src/dev/previews/vfx-combat.ts

All coordinates are SCREEN/world px (camera scroll 0). Every function is safe to fire-and-forget (self-cleaning); awaiting resolves at the end of the main beat. Clock = scene time × scene.tweens.timeScale (setSpeed fast-forwards, freezes stop it).

=== src/vfx/combat.ts ===
Utilities:
- seedCombatFx(seed:number) — repeatable randomness. setCombatSfx(enabled:boolean) — effects call sfx.play(...) themselves (attackDeclare, lockOn, beamCharge, beamFire, impactLight/Heavy, shieldBlock, directHit, darkPulse, whoosh, fireBurst, waterSplash, holyChime, earthQuake, slash, bite, windGust, cardSlide, lightning, thunder, shatter). Default ON.
- onFrame(scene, fn(dt,el)=>boolean|void, onEnd?) → cancel(); animate(scene, ms, fn(t,el,dt)) → Promise; sleep(scene, ms) → Promise; E = easings {lin,inQ,outQ,inC,outC,inOutQ,inOutC,outBack(t,s),outExpo,inExpo}.
- stopTime(scene, ms) → Promise — NESTING-SAFE hit-stop (freezes tweens/timers/anims for ms REAL time; overlapping calls extend one freeze). Prefer over core.hitStop when several hits can overlap.
- framePointToWorld(sprite, fx, fy): XY — frame pixel → world (origin, flipX, scale, rotation, containers). Use for art.muzzle / art.core / per-frame mouth tables (crystal_wyrm: CRYSTAL_WYRM_MOUTH[frame]).
- whiteFlash(scene, sprite, frames=2, color=PAL.white) — tintFill for N real frames (works during freeze), restores previous tint.
- Px (pixel rasterizer on a Graphics), Sparks(scene, depth=DEPTH.FX, blend?) particle layer {add(p), release(), destroy()}, Particle, PShape, rampOf(color): Ramp, buildCombatTextures(scene).
Targeting:
- attackArrow(scene, from, to, player:PlayerId, {depth=FX_TOP, height?}) → {done, destroy()}. Grows in 300 ms (done resolves then); keeps flowing until destroy() (140 ms fade).
- lockOn(scene, x, y, {color=PAL.crim3, size=30, depth=FX_TOP}) → {done, destroy()}. Snaps at 230 ms (done); destroy() expands + fades in 150 ms.
Beams:
- beam(scene, from: XY | (()=>XY), to, style:'prism'|'water'|'dark', {chargeMs, fireMs, width, onFire, onImpact, through?:XY, onPierce, depth=FX}) → Promise (resolves at chargeMs+fireMs, after the fade).
  Defaults: prism charge 500 / fire 420 / width 11; water 380/440/9; dark 420/420/10. `from` as a function is re-evaluated every charge frame (tracks the mouth); the muzzle is locked at fire time.
  Timeline: onFire at chargeMs; head reaches `to` after EXT = clamp(0.9·dist, 55, 110) ms → onImpact; with `through`, the beam punches on at EXT+130 and onPierce fires at EXT+220. The last 150 ms thin out.
Projectiles:
- projectile(scene, from: XY|(()=>XY), to, kind, {onImpact, onLaunch, ms, chargeMs, arc, depth}) → Promise (after the impact beat).
  darkOrb: charge 380 (orb + 3 runes at `from`), flight clamp(3.4·dist, 280, 480) ms, implode 230 → onImpact → burst 360.
  fireball | water: ignition 140, lobbed flight clamp(2.6·dist, 300, 620), arc clamp(0.28·dist, 12, 70); onImpact on landing; burst 320. Use fireball to a panel for burn damage (Magma −500, Kor Kurdu −300) and water for the Gelgit Golemi counter.
  spark: charge 160, 3 sparkles staggered 85 ms, flight clamp(4·dist, 340, 520); onImpact on the LAST arrival.
  boulder: pass the throw point (hands) as `from`; the rock tears out of the ground 22 px below it over chargeMs = 320, flight clamp(4.2·dist, 380, 620) on arc clamp(0.5·dist, 26, 72); onImpact on landing; resolves ~260 ms later.
  wave: `from`/`to` are GROUND points (anchors). Rise 180 → roll clamp(6.5·dist, 380, 720) → crash 300 (onImpact ~100 ms into the crash) → +120. Drawn in the unit depth band (sorted by y).
Melee:
- lunge(scene, sprite, to /*the point the sprite ORIGIN (feet) heads for*/, {distance=14 (stops short), ms=120 (dash), anticipation=180, pullback=7, hold=170, returnMs=280, hop=5, trail=PAL.white|null (afterimage tint), onDash, onImpact}) → Promise after the return. onDash at `anticipation`; onImpact at anticipation+ms (do impact()/slash() there). Restores position and scale exactly.
- afterimages(scene, sprite, ms, color=white, {every=32, alpha=0.7, life=180}) → Promise (additive ghosts).
- slash(scene, x, y, {color | ramp, angle=-0.5 (rad, direction of travel), size=20, flip, ms=210, depth, sound=true}) → Promise(ms).
- xSlash(scene, x, y, {color|ramp (default void), size=22, ms=200, gap=90}) → Promise (~gap + 0.4·ms + 220).
- bite(scene, x, y, color=PAL.fire3, {size=13, snapAt=135, onSnap, depth}) → Promise (snapAt + 230). For a lunge: onDash: () => bite(..., {snapAt: dashMs}).
- shadowPuddle(scene, x, y, {rx=15, ry=6, openMs=200, depth=TILE_FX+3}) → Puddle {x, y, setPosition(x,y), opened:Promise, close(ms=160):Promise, destroy()}.
- puddleTravel(scene, from, to, {ms=360, puddle?}) → Promise<Puddle> (left open at `to`).
- sinkInto(scene, sprite, {ms=220, reverse?:boolean, tint=PAL.void3}) → sinking crops the sprite below its ground line and ends with sprite.visible = false; reverse emerges (set visible and place it at its ground spot first). Crop and tint are cleared at the end.
- diveSpiral(from, to, t, {rise=58, radius=22, turns=1.25}): XY; diveSpiralPath(from, to, n=40, opts): XY[]; dive(scene, sprite, to, {ms=640, returnMs=380, onImpact, ramp=leaf, rise}) → Promise (moves and tilts the sprite; onImpact at the end of the dive, then 2 wind slashes, then an arc home; position and angle restored).
- vineWhip(scene, from /*ground where vines emerge*/, to /*strike point*/, {onImpact, count=2, lift=18, depth}) → Promise (~680 ms; onImpact at 350 ms).
Lightning:
- lightning(scene, from, to, {color|ramp (default gold-white), branches=3, ms=380, width=3, flash=0.3, onImpact, depth}) → Promise(ms). onImpact fires immediately (the strike is frame 0).
- skyBolt(scene, x, y, {color|ramp, ms=560, width=3, onImpact, depth}) → stepped leader 110 ms, then strike (onImpact, white flash, 4 px shake), re-strikes, resolves at ms.
Impacts:
- impact(scene, x, y, {power:1|2|3 = 2, ramp (spark colors, default gold-white), sprite (white flash + jitter while frozen), dir?:XY (directional sparks), noStop?:boolean, depth=FX}) → stopTime 60/80/100 ms, shake 1.5/3/5 px for 140/220/320 ms. Power 3 adds an anime impact frame: the stage goes dark for 3 real frames (rectangle at DEPTH.SHADOW+1, so units and FX stay bright), then one white flash. Resolves after the freeze + 115/140/165 ms.
- blockClang(scene, x, y, {from?:XY attacker, color=cyan, depth}) → 50 ms freeze, resolves ~210 ms later.
- directHit(scene, player /*the duelist being hit*/, {at?:XY default duelistXY(player)}) → 110 ms freeze, then a ~520 ms red vignette double pulse.

=== src/vfx/shatter.ts ===
- shatter(scene, sprite, {monsterId, attribute, anim?, frame? (default: parsed from the sprite frame name "<anim>:<i>"), glitchMs=150, push?:XY (bias, e.g. the attack direction), stopMs=40, depth}) → Promise (~1 s). Hides the sprite (setVisible(false)), never destroys it — re-show it when reusing. Builds texture `shatter:<id>:<anim>:<frame>` on demand.

=== src/vfx/numbers.ts ===
- damageNumber(scene, x, y, amount, kind:'damage'|'heal'|'buff'|'debuff', {size:1|2 = 1, depth=FX_TOP+50, rise=18}) → Promise after the pop (~0.3–0.45 s); total life 1.25 s, self-cleaning. Sign is automatic ('-' for damage/debuff). Damage shows white for the first ~50 ms, then red, with a horizontal jolt.
- statPop(scene, x, y, from, to, {depth, size}) → Promise after roll + pop (~0.75 s); life 1.3 s. Up = green, down = red; spawns the delta number and ▲/▼ arrows.
- buildNumberTextures(scene) — sheets `fx:num:<damage|heal|buff|debuff|flash|stat>`, frames '0'-'9', '+', '-', '^', 'v'.

=== boot ===
src/boot/13-vfx-combat.ts (order 13) builds the digit sheets, boulder frames 'fx:boulder' (26 px × 8 rotations) and 'fx:vignette-red'. All of these are also built lazily on first use.

=== preview ===
?dev=vfx-combat (clickable menu) &fx=arrow|impact1|impact2|impact3|clang|prism|water|dark|darkOrb|fireball|spark|boulder|wave|waterball|lunge|melee|slash|xslash|bite|dive|vine|lightning|skybolt|shatter|shatter2|numbers|statpop|combo|multi|direct  &a=<id> &b=<id> &swap=1 &sync=1 (start on film freeze) &zoom=N. The `combo` stage is a full choreography reference (declare → lock → prism beam → impact → number → shatter); `xslash` is the full Gölge Adımı choreography.

Open issues reported by the agent:
- src/vfx/core.ts hitStop is NOT nesting-safe: it saves and restores the time scale, so two overlapping calls (e.g. Ayna Kalkanı destroying several monsters, each with an impact) can restore 0 and freeze the game forever. My effects all use combat.stopTime (it merges overlapping freezes). Recommend core.hitStop adopt the same approach, or that cinematics call stopTime.
- Only crystal_wyrm exports a per-frame mouth table (CRYSTAL_WYRM_MOUTH). For the other monsters the charge must start at the attack impact frame with a short charge (~1 animation frame), because the muzzle position during the wind-up is unknown. Monster-art owners could export <ID>_MOUTH tables so beam/projectile charges can track mouths, staffs and hands; `from` already accepts a function.
- Phaser 3.60+ tweens time themselves with Date.now(), so frozen-and-stepped films are only deterministic with a virtual clock. My preview installs the same shim as cardfx.ts (same __virtualClock flag); the integration step may want this in main.ts's test hooks instead of per preview.
- Several monsters (lumen_sprite, stone_sentinel, storm_hawk, volt_lizard, thorn_lurker) were still placeholders while I verified. Effects take explicit coordinates, so they don't depend on the art, but final framing (e.g. boulder hand position = core + (6,−14) in the preview) should be re-checked once the real sprites land.
- sinkInto relies on Sprite.setCrop; shatter and whiteFlash use sprite tint. If MonsterView wraps sprites in containers with scale, or the hologram pipeline overrides tint, re-verify shadow step, shatter and whiteFlash with the real MonsterView.
- impact() power 3 darkens everything below the unit depth band (rectangle at DEPTH.SHADOW+1) for 3 frames: the board and cards on tiles go dark, units and effects stay bright. If the board/HUD layering changes, keep that rectangle under DEPTH.UNIT.

## src/vfx/hologram.ts, src/vfx/summon.ts, src/vfx/particles.ts, src/boot/12-vfx-summon.ts

Files: src/vfx/hologram.ts, src/vfx/summon.ts, src/vfx/particles.ts, src/boot/12-vfx-summon.ts, src/dev/previews/vfx-summon.ts

Boot: src/boot/12-vfx-summon.ts (order 12) runs registerHologram(game), buildParticleTextures(scene) and buildSummonTextures(scene). Nothing else is required.

== src/vfx/summon.ts ==
attributeSummon(scene, o: SummonOpts): Promise<void>
  SummonOpts = { x, y: number /*tile center = floor point*/; attribute: Attribute; player: PlayerId; sprite: Sprite|Image /*already placed at (x,y), origin on art anchor, depth unitDepth(y); hidden by the call until its beat*/; monsterId?: MonsterId /*plays 'roar' then chains 'idle'*/; big?: boolean; onBeat?: (b: SummonBeat) => void }
  SummonBeat = 'circle'|'pillar'|'reveal'|'roar'|'impact'|'end'
  Measured beats (ms from call), normal: circle 0, pillar 267, reveal 400, roar ~817, impact ~1017, end/resolve 1250.
  Big: 0 / 383 / 567 / ~1167 / ~1450 / 1850.
  Use onBeat('impact') for the ATK/DEF badge pop and the impact sound; onBeat('reveal'/'roar') for the hologram and roar sounds.
  Run this after the card has landed on the tile (the storyboard's 0–300 ms card flight is the cinematic's). Restores sprite.y; the sprite is left visible, with no pipeline, playing idle.
tributeStream(scene, fromSprite, toXY: {x,y}, { attribute, ms?=650 }): Promise<void>
  ≈1.15 s total: white flash 70 + shiver 180 + stream. Hides fromSprite (does not destroy it). Follow with attributeSummon({ ..., big: true }).
flipBurst(scene, x, y, attribute): Promise<void>
  Resolves at the burst peak (~200 ms). Then call materialize(scene, sprite, { attribute, ms: 420 }) and play roar. The column and debris finish over ~0.4 s on their own.
magicCircle(scene, x, y, { attribute, player?, size?: 'normal'|'big', ms?=1100|1500, appearMs?=260, depth?, ramp? }): Promise<void>
createMagicCircle(scene, x, y, sameOpts): { ready: Promise; pulse(ms?); spin(k); dismiss(ms?=320): Promise }
lightPillar(scene, x, y, { attribute, height?=140, width?=18, ms?=900, riseMs?=150, style?: 'beam'|'flame'|'water'|'shadow' /*default by attribute*/, depth?=unitDepth(y)-1, sparks?=true, ramp? }): Promise<void>
createPillar(scene, x, y, sameOpts): { ready; collapse(ms?=170): Promise; pulse(ms?) }
shockwave(scene, x, y, { color? | ramp?, radius?=48 /*floor radius → ellipse r × r/2*/, from?=6, ms?=420, thickness?=6, depth?=TILE_FX+2 }): Promise<void>
setPulse(scene, x, y, color=PAL.cyan3, { ms?=420, count?=2, grow?=12 }): Promise<void>  // iso diamond pulses for set cards
sparkleBurst(scene, x, y, { ramp?, count?=14, depth?, speed? }): Promise<void>  // resolves ~370 ms
landingDust(scene, x, y, color?, { count?, radius?, big? }): Promise<void>  // resolves ~320 ms
STEX (hex7, hex11, boulder), buildSummonTextures(scene).

== src/vfx/hologram.ts ==
HOLOGRAM = 'Hologram'; HologramPipeline; registerHologram(game).
HologramParams = { reveal, scan, glitch, tint, ramp, tintMix, gain, flicker, alpha, white: 0..1 numbers; clipY: worldY|null; span: {top,bottom} rel. to sprite.y | null }
setHologram(sprite, Partial<HologramParams>): HologramParams  // attaches + boots; returns the LIVE params object (mutate it per frame)
clearHologram(sprite); getHologram(sprite); defaultHologram(); holoRamp(ramp)
materialize(scene, sprite, { attribute?|ramp?, ms?=650, converge?=true, keep?=false, onRevealed?() }): Promise<void>  // shows the sprite; removes the pipeline at the end
dematerialize(scene, sprite, ms=520, { attribute?|ramp?, hide?=true }): Promise<void>  // destroy/gameOver collapse
glitch(scene, sprite, ms=300, intensity=1, { attribute?|ramp? }): Promise<void>  // restores the previous state
whiteFlash(scene, sprite, ms=70): Promise<void>  // impact silhouette frame
framePixels(sprite) / opaqueBox(sprite) / opaquePoints(sprite, n) / pixelToWorld(sprite, fx, fy)  // for shatter-into-own-pixels effects
Chasm Trap sink: setHologram(spr, { clipY: tileY }), then tween spr.y downward.

== src/vfx/particles.ts ==
Presets (scene, x, y, FxOpts) → ParticleEmitter (auto-destroyed): embers, smokePuffs, bubbles, bubblesSmall, droplets, leaves, feathers, dust, sparkles, glints, shadowWisps, motes, rocks({chips?}).
  FxOpts = { depth?=DEPTH.FX, count?, duration? /*continuous ms; omit = one burst*/, frequency?, ramp?, w?, h?, radius? /*iso floor ellipse*/, speed?, life?, add?, frames? }
Primitives: onTick(scene, (dt, elapsed) => stop?): disposer; animate(scene, ms, (t, dt) => void, ease?): Promise; LiveRaster(scene, w, h, x, y, ox, oy, depth) with .draw(p => …) and .destroy(); ringPixels(rx, ry); bayer(x, y); Swarm(scene, depth, blend) with .add({ … }) and .done(); rnd/seedFx/rrange/pick; rampFrom(color); rampTint/steppedFade/steppedScale; PTEX/PANIM keys.

Preview: ?dev=vfx-summon&attr=&monster=&big=1&player=1|2&fx=summon|circle|pillar|tribute|materialize|shockwave|flip|set|glitch&all=1&arena=0&period=MS. In &test mode it waits for the shot tool's freeze, so films start ~150 ms after --start. window.__neon.vfxBeats holds the beat timestamps.

Open issues reported by the agent:
- core.hitStop (src/vfx/core.ts, not mine) is not re-entrant: a second call during an active stop saves timeScale 0 and restores 0, freezing the scene forever. I guard my own calls (safeHitStop in summon.ts); cinematics that overlap hitStops can still hit it. Fix belongs in core.ts (e.g. a depth counter).
- tools/shot.mjs (not mine): __neon.step(ms) runs every frame synchronously inside one page.evaluate, so promise continuations (await wait/tween) only advance at --start/--every boundaries. Films of async cinematics are therefore stretched/distorted. My private copy shots/vfx-summon/_shot.mjs steps frame-by-frame with a setTimeout(0) yield between frames (stepFaithful) and also has a 180 s page.goto timeout for the loaded machine; recommend adopting both in tools/shot.mjs.
- Phaser boots post pipelines lazily inside postBatch, so a freshly attached PostFX draws its object unprocessed for one frame. setHologram boots eagerly via bootFX(); any other agent attaching their own per-sprite PostFX should do the same. Also pipelines.getPostPipeline(name) instantiates a new pipeline: don't use it as an existence check.
- Several monster sprites were still placeholders while I worked (e.g. stone_sentinel, storm_hawk, lumen_sprite). All effects size themselves from the sprite's opaque bounds and pixels, so they adapt to the real art automatically; worth a final film per real sprite once those land.
- Sound, the ATK/DEF badge and the card-flight/landing beat (storyboard 0–300 ms) are not played by attributeSummon; cinematics should hook them via onBeat ('reveal', 'roar', 'impact').
- The shared session scratchpad is used by several agents (my shot.sh there was overwritten by someone else); my helpers live under shots/vfx-summon/ (gitignored).

## src/art/cards.ts, src/art/cardart/index.ts, src/art/cardart/judgment_bolt.ts, src/art/cardart/healing_spring.ts

Files: src/art/cards.ts, src/art/cardart/index.ts, src/art/cardart/judgment_bolt.ts, src/art/cardart/healing_spring.ts, src/art/cardart/soul_recall.ts, src/art/cardart/dragon_blade.ts, src/art/cardart/volcano_arena.ts, src/art/cardart/mirror_barrier.ts, src/art/cardart/chains_of_light.ts, src/art/cardart/chasm_trap.ts, src/boot/30-cards.ts, src/view/CardSprite.ts, src/view/TileCard.ts, src/dev/previews/cards.ts, src/dev/previews/cardfx.ts

TEXTURE KEYS (built at boot by src/boot/30-cards.ts → buildCardTextures(scene), order 30):
- cardFaceKey(id) → 'card:face:<id>' (48×68 upright face). CARD_BACK = 'card:back' (48×68).
- cardArtKey(id) → 'card:art:<id>' (44×34 artwork; use for the inspect panel or a spell-activation close-up).
- cardIsoKey(id | 'back', 'up' | 'side', player: PlayerId = 0) → 'card:iso:<id>:<o>[:p2]'. Size ISO_TEX_W×ISO_TEX_H = 50×30; the tile center is at (ISO_CX, ISO_CY) = (25, 15). Place it with setOrigin(ISO_CX/ISO_TEX_W, ISO_CY/ISO_TEX_H) at zoneXY(...). Player 2's variant is rotated 180° (its top faces player 1). The third param is an additive extra.
- Overlays: CARD_SIL 'card:sil' (white card silhouette); CARD_GLOW 'card:glow' frame 'g:0' (54×74 ring, GLOW_PAD=3); CARD_GLOW_RUN + anim ANIM_GLOW_RUN; CARD_SHEEN/ANIM_SHEEN; CARD_FOIL/ANIM_FOIL.
- Iso overlays: cardIsoSilKey(o), cardIsoGlowKey(o) (frames 'g:0' and 'run:<i>', pad ISO_GLOW_PAD=2), animIsoGlowRun(o), cardIsoSheenKey(o) with animIsoSheen(o).

PIXEL / COLOR HELPERS (src/art/cards.ts):
- cardFaceCanvas(id), cardBackCanvas(), cardArtCanvas(id), isoCanvas(id|'back', o, player): PixelCanvas (cached). Useful for shatter-style effects.
- cardAccent(id): number. Attribute color for monsters, teal for spells, magenta for traps (glows, trails, embers).
- cardAccentRamp(id), kindRamp(kind), drawAttributeOrb(p, x, y, attr|'SPELL'|'TRAP'), drawAttributeBackdrop(p, attr, seed).
- drawDigits(p, x, y, '2800', color, shadow?), digitsWidth(s): the 3×5 digit font (reusable for ATK badges).
- monsterCropArt(id).
- 3D pose math: isoProject, qAxis, qMul, qRot, qSlerp, qFromBasis, restQuat(player, o, faceUp), standQuat(), poseAxes, renderCard(dst, cx, cy, ex, ey, n, frontMip, backMip, {light, tint, tintAmt, glint, solid, outline, thickness}), cardMip(id|'back'). Size constants: FLAT_W/FLAT_H = 18/26 board units; STAND_W/STAND_H project to exactly 48×68 px.
- Card art registry (src/art/cardart/index.ts): cardArtwork(id), hasCardArtwork(id), plus artVGrad/artRGrad/artGlow/artSparkle/artBolt/artRng paint helpers.

class CardSprite extends Phaser.GameObjects.Container (src/view/CardSprite.ts):
- constructor(scene, x, y, cardId: CardId | null, opts?: { faceUp?: boolean (default cardId !== null); player?: PlayerId }). Adds itself to the scene, centered on (x, y), setSize(48, 68) so setInteractive() works. Set depth yourself (e.g. DEPTH.HAND). The caller owns this.x/y/scale/rotation; the card's own effects animate the child container `inner`.
- Properties: cardId, faceUp, readonly inner, getters textureKey and pixels.
- setCard(id|null), setFaceUp(b), setHighlight(color|null), setPlayerTint(player|null), setTrail(on).
- hoverLift(on): Promise.
- flip(toFaceUp, ms = 260): Promise. Needs a cardId to reveal; ends with a sweep and a sparkle burst.
- flyTo(x, y, { ms = 420, arc = 40, scale, rotation (radians, default 0), ease, anticipate = ms >= 200, spin = 0, land = true, reveal = false }): Promise. reveal flips face-up mid-flight (the draw animation).
- punch(amount = 0.12, ms = 180): Promise; pulse(color = white, ms = 320): Promise; playSweep(foil = false); burst(color, n = 12).
- dissolve(ms = 650): Promise. Burns away into embers and leaves the sprite invisible (not destroyed).
- Exported helpers: burnAway(scene, image, pixels, ms, emberColor, { keep, depth, seed }) and rootDepth(go).

class TileCard extends Phaser.GameObjects.Container (src/view/TileCard.ts):
- constructor(scene, player, spot: BoardSpot, index, cardId | null, faceUp, orientation: 'up' | 'side' = 'up'). Placed at zoneXY(player, spot, index), depth DEPTH.CARD_ON_TILE; it raises its own depth while lifted, standing or flying.
- Properties: player, spot, index, cardId, faceUp, orientation, standing, home (XY).
- sync(cardId, faceUp, orientation?): instant; cancels standing and restores visibility and alpha (use this from views.sync). Also setCard, setFaceUp, setOrientation.
- slamIn(fromXY, ms = 480, { fromScale = 1, arc = 34 px, shake = 0, trail = true, impact = true }): Promise. Impact lands at 74% of ms; pass ms ≈ 340 for the 250 ms summon beat. Starts as an upright card matching a scale-1 CardSprite at fromXY, so you can destroy the hand CardSprite and call slamIn from the same spot in the same tick.
- flipUp(ms = 480), flipDown(ms = 420), rotateTo(o, ms = 340), layDown(ms = 380): Promise.
- standUp(ms = 460, { reveal = true, scale = 1 }): Promise. Ends as a crisp full-size 48×68 face hovering about 2px above the tile (half size with scale 0.5). flipUp works while standing (vertical spin).
- pulse(color, ms = 420): Promise; setHighlight(color|null); setSheen(on); playSheen().
- fadeOut(ms = 320), dissolve(ms = 600): Promise. Both hide the card; neither destroys it.
- dust(n, power), tileFlash(color, ms), ringBurst(color, ms).
- Each TileCard owns one 128×128 canvas texture, released on destroy().

All animations run on Phaser tweens and scene timers, so they respect hitStop and setSpeed.

PREVIEWS:
- ?dev=cards: default overview; &mode=big&page=0..3; &mode=art (&only=st | mon | crop); &mode=iso.
- ?dev=cardfx&fx=all | flip | hover | fly | slam | flipup | rotate | sheen | stand | dissolve | highlight | tableau. &arena=1 stages on the real BoardView (guarded dynamic import). &sync=1 makes film t=0 the stage start.

Open issues reported by the agent:
- SHARED HARNESS BUG (src/main.ts, not mine): Phaser 3.60+ TweenManager times itself with Date.now() (see getDelta in node_modules/phaser/src/tweens/TweenManager.js), so `tools/shot.mjs --film` / `--step` advance every tween by wall-clock time instead of the stepped game time. Tween-driven cinematics film at the wrong speed and non-deterministically for every agent. Fix in main.ts: while frozen, make Date.now() return the virtual clock and advance it by dt in step(). Reference implementation: installVirtualClock() in src/dev/previews/cardfx.ts.
- SHARED HARNESS BUG (src/main.ts): __neon.step(ms) runs all frames inside one synchronous JS task, so `await` continuations of async cinematics cannot run until the whole step ends. Chains stall during --start and large --every values (films look delayed). Fix: make step async and yield a macrotask (await new Promise(r => setTimeout(r, 0))) between frames; shot.mjs already awaits page.evaluate. The same reference implementation is in src/dev/previews/cardfx.ts.
- The scratchpad directory is shared between agents: my /scratchpad/shot.sh was overwritten by another agent. I moved my helper scripts to scratchpad/cards-agent/.
- Monster card art: monsters with portrait() use it, and the crop fallback is verified on real sprites. It frames head and shoulders on human-sized figures; on very wide winged sprites like the 96px crystal_wyrm it lands on wing and neck instead (moot there, since crystal_wyrm has a portrait). Card art is generated at boot, so new monster art is picked up automatically on reload.
- Integration note: CardSprite.flip and the flyTo landing squash both animate the inner container. Do not call flip() manually during the last ~25% of a flyTo; use flyTo's { reveal: true } option instead, which times the flip safely.
- Integration note: the default slamIn of 480ms puts impact at about 355ms; the §6 storyboard wants impact at 250ms, so cinematics should pass ms ≈ 340. A standing card from standUp is 68px tall and sits at depth unitDepth(tileY) - 1, so it overlaps monsters behind it during trap reveals (intended).

## src/art/arena.ts, src/view/BoardView.ts, src/boot/15-arena.ts, src/dev/previews/board.ts

Files: src/art/arena.ts, src/view/BoardView.ts, src/boot/15-arena.ts, src/dev/previews/board.ts

**Construction**

`import { BoardView } from 'src/view/BoardView'`

`new BoardView(scene: Phaser.Scene, opts?: { theme?: 'normal'|'volcano'; active?: PlayerId|null; lights?: boolean /*default true*/; volcanoFrom?: PlayerId|null })`

- Builds every layer at once. It calls `buildArenaTextures()` lazily if the boot step has not run.
- Registers `scene.events` UPDATE and auto-destroys on scene SHUTDOWN.

**Properties**
- `board.scene`
- `board.theme: 'normal'|'volcano'` (getter)
- `board.activePlayer: PlayerId|null` (getter)

**Methods**
- `zoneAt(x: number, y: number): { player: PlayerId; spot: BoardSpot; index: number } | null`
  - Pass world coordinates (`pointer.worldX/worldY`).
  - Pixel-accurate to the drawn diamonds, including the seam ring, with no dead zones.
  - Returns null for the middle row (row 2) and outside the grid.
  - Returns `spot 'banish'` for the decorative corner tiles.
  - Verified exhaustively: 20480 pixels inside the tiles, 0 mismatches.
- `highlightZone(player, spot, index, color: number | null): void`
  - Animated target outline: fill pulse, glowing outline, marching dashes, four corner chevrons that lock on from 8px out and then breathe 0–2px, plus rising sparkles.
  - Calling it again with a different color retints it; `null` fades it out over about 140ms.
  - Depths TILE_FX..TILE_FX+3.
- `clearHighlights(): void` (additive)
- `flashTile(player, spot, index, color: number, ms = 320): Promise<void>`
  - Additive white-to-color diamond flash, a crisp 1px tile outline growing 12px, a glyph glow boost and 6 rising sparks.
  - Resolves when the flash has faded.
- `pulseSide(player): Promise<void>`
  - Turn-start pulse, about 760ms.
  - A 2px iso shockwave ring expands from that player's podium (`duelistXY`), the tiles light in a radial wave, the side's trim flashes and sparks burst off the trim.
- `setActivePlayer(player: PlayerId|null, animate = true): void`
  - Active side's trim goes to full brightness with a pulsing additive glow, tiles pulse more, and a light-runner comet travels the trim.
  - The inactive side drops to 50%.
- `setTheme(theme: 'normal'|'volcano', animate = true, from: PlayerId|null = null): Promise<void>`
  - **volcano, animated (about 1.2s):**
    - The origin field tile (`zoneCell(from, 'field')`, or the board center when null) flashes white-hot.
    - Two fire shockwave rings roll out and lava cracks spread from the origin in about 0.9s with a white-hot front.
    - The sky and stadium fade to ember red from 120ms to 1170ms. The trim sputters to orange from 330ms. Embers burst from the crack front.
    - **Includes `shake(scene, 1150, 2)` — cinematics should not add a second rumble.**
  - **volcano, steady state:** lava flow pulses, rising embers, falling ash.
  - **normal, animated (about 1s):** the lava cools to stone and fades, and the night returns.
  - **Re-calling volcano** with another origin re-erupts from that origin.
- `setLights(on: boolean, animate = true): Promise<void>` (additive, for the gameStart "stadium lights come on" beat, about 1.6s)
  - Towers ignite one by one, outside-in: flicker, then on, with a gold glow pop. Searchlights and rim light come up; the stadium is darkened while off.
  - Construct with `{ lights: false }` and then `await board.setLights(true)`.
- `tileImage(player, spot, index): Phaser.GameObjects.Image | null` (additive) — the zone's tile image, for cinematics such as `chasm_trap` that shake, hide or tint a tile.
- `destroy(): void`

**Depth usage (inside the layout bands)**

| Band | What BoardView draws there |
|---|---|
| SKY 0..5 | sky (+0.5 hot sky), smoke 1, aurora 1.5, stars 2, beams 5 |
| STADIUM 9..16 | haze 9, stadium 10 (+0.5 hot), rim light 11, darkness overlay 11.5, crowd 12, flashes 12.5, LED 13, lamps 13.5, far fog 15, far motes 16 |
| PLATFORM 15..26 | low fog 15, underglow 16, rings 17, shafts/core beam 18, slab 20, trim 21, trim glow 22, runner 23, core 24, near fog 26 |
| TILE 30..34 | tiles and bridge 30, bridge flow 31, tile glyph glow (additive, player-tinted) 32, lava 33, lava glow 34 |
| TILE_FX 40..48 | highlights 40..43, flashes and shockwaves 45..46, motes / embers / ash 48 |

Everything stays below CARD_ON_TILE (50) and UNIT (100+).

**Camera**
- Platform and tiles use scrollFactor 1. Background layers use 0.2 / 0.5 / 0.6 / 1.15 parallax.
- Layers are padded so shake, zoom up to about 1.1 and pans of about ±60px reveal no edges.
- Camera `scrollY` down to about -400 shows the stadium and sky (good opening shot for the gameStart camera descent).

**arena.ts exports**
- Layer keys and geometry:
  - `AK` (texture keys; e.g. `AK.glow` is a 48px white soft glow and `AK.dot` a 9px dot, both good for additive VFX)
  - `CORE_XY` (world position of the energy crystal under the platform)
  - `THRUSTERS`
  - `TOWERS`
  - `SKY_RECT`, `STADIUM_RECT`, `SLAB_RECT`, `BRIDGE_RECT`
- Stadium and trim geometry: `rimY(x)`, `standsBottomY(x)`, `trimPath(player)`
- Zone and lava helpers: `cellZone(col,row)`, `tileDV(i,j)`, `buildCrackField`, `paintCracks`
- Build helpers: `texOrigin(key)`, `ARENA_BUILD_MS` (per-step boot timing), `buildArenaTextures(scene)` (idempotent; boot step order 15)
- Types: `type ArenaTheme`, `type ZoneHit`

No shared contracts were changed.

Open issues reported by the agent:
- PROJECT-WIDE: Phaser 3.90's TweenManager.getDelta() uses Date.now(), so tweens from `vfx/core` `tween()`/`tweenValue()` do not follow `window.__neon.step()`. Their progress in `--film` and `--step` captures follows real wall-clock time, so films are not deterministic and depend on CPU load. Measured: after 1500ms of stepped time a 900ms tween was only about 4% done. BoardView works around this with its own tick-driven animator. Suggested fix for the owner of src/main.ts: while frozen, have freeze()/step() patch Date.now (and performance.now) to return the virtual clock.
- The tools/shot.mjs page.goto timeout is hardcoded at 30s. With several agents running Chromium/swiftshader at once (load average 12–17 on 4 cores), shots often fail with TimeoutError and need retries; this is environment flakiness, not a page error.
- The hull spike and energy core (y about 266–308) sit behind the UI.hand region (y≥284), so in game the underside glow is mostly visible on either side of the hand. Expected given the layout; it fills in nicely when the hand is low.
- Two light towers (x=494, 582) are behind the UI.p2Panel region; their beams come out from behind the panel.
- `setTheme('volcano', true)` includes its own camera shake (1150ms, 2px). The volcano_arena cinematic should not add another rumble, or should call `setTheme(..., false)` and do its own.
- Arena boot takes about 1.3s in headless swiftshader. Real GPU uploads should be far faster; per-step timings are in `ARENA_BUILD_MS` if it needs to be split or deferred later.

## src/art/monsters/crystal_wyrm.ts

Files: src/art/monsters/crystal_wyrm.ts

crystal_wyrm (src/art/monsters/crystal_wyrm.ts, default export MonsterArt)

**Placement:**
- frame 96×96, faces right (P2 flipX).
- anchorX 50, anchorY 91: the ground line under the claws, centered under the body mass.
- hover 0 (walker).
- muzzle {x:89, y:41}: the center of the open mouth in impact frame 5. It is computed from the rig.
- core {x:48, y:58}: the torso center.
- attackImpactFrame 5.

**Animations (frames @ fps, total time):**
- idle 8 @ 7, loop, ~1.14 s cycle.
- roar 10 @ 10, 1.0 s.
- attack 10 @ 10, 1.0 s.
- hit 4 @ 10, 0.4 s.
- guard 4 @ 4, loop.

**Extra named export:** `CRYSTAL_WYRM_MOUTH`, the mouth position for every attack frame: [f0 89,27] [f1 85,20] [f2 77,13] [f3 75,10] [f4 73,9] [f5 89,41] [f6 88,39] [f7 87,38] [f8 90,34] [f9 89,28]. Charge particles can converge on these during frames 1–4.

**Sync points for cinematics and VFX:**
- **Attack charge:**
  - Frames 1–4 are the 400 ms charge. Wing veins turn white at frame 3; the frame-0→1 change at 100 ms is the natural start for the doc's 500 ms charge.
  - A light orb is drawn at the mouth from frame 2 and is largest at frame 4 (~7 px star). Ground glow and particles should peak at 300–500 ms.
- **Attack beam:**
  - The beam fires at frame 5 (500 ms). The jaw is fully open in frames 5–7 (500–800 ms) and the mouth interior blazes white/cyan there.
  - Frame 8 (800 ms) is half-closed with dim light. Frame 9 is the recovery.
  - This fits the doc's 400 ms fire window (frames 5–8). Spawn the beam at `muzzle` on frame 5; the mouth drifts ≤2 px over frames 6–7 (see the table above).
- **Roar:**
  - Crouch on frames 1–2 (100–300 ms).
  - Burst and rear on frame 3 (300 ms). This is the best moment for the shock ring or screen shake.
  - Jaw wide and trembling on frames 3–7 (300–800 ms). Put the roar SFX peak at ~300–400 ms.
  - Release at frame 8, settled by frame 9.
- **Hit:** biggest recoil on frame 0 (body −3 px, head thrown back, eyes shut). This is where the white flash goes.
- **Guard:** the shield glint sweeps on frames 1–3; frame 0 is quiet.

**Colors for matching VFX:**
- Body: white 0xf4f7ff / mist 0xa3b1da, shadows steel 0x6578b4 / night3 0x28356f, cyan2 0x0f9db5 rim light.
- Wing glass: cyan1–cyan4 (0x08627a, 0x0f9db5, 0x3fe0ea, 0xb6fbff), white rims, veins cyan4 → white when charged.
- Crystals: cyan2 dark facet / cyan4 lit facet (glow lifts them to cyan3/white).
- Horns: gold2–gold4 (0xcf971d, 0xffd447, 0xfff4b5).
- Eyes and beam: white core, cyan4 / cyan3 edges. Matches "çekirdeği beyaz, kenarları cyan".

**Card art:** `portrait()` is implemented (44×34, gold LIGHT backdrop), so the card renderer uses it instead of the idle crop.

Open issues reported by the agent:
- The neck's crystal ridge is mostly hidden behind the near wing and the cheek horn in idle; it shows clearly in the roar and the attack wind-up.
- The far wing is a dark background element in idle and is fully spread (out to the right) only in the roar; it is mostly hidden behind the neck in the other animations.
- Guard: the near wing's finger bones hang down the right edge of the shield like icicles. They read as crystal ribs but make the silhouette slightly lumpy.
- Boot cost is about 350 ms for all 36 frames, measured in Node under heavy machine load; it should be lower in an idle browser. If boot time becomes an issue, the frames could be built lazily.
- ?dev=cards in default and big modes timed out while loading during my checks (another agent's work in progress, not my file); I checked the portrait with &mode=art instead.
- Extra named export CRYSTAL_WYRM_MOUTH is additive and optional. Nothing depends on it unless the cinematics agent chooses to use it.

## src/art/monsters/abyss_magus.ts, src/art/monsters/shade_assassin.ts

Files: src/art/monsters/abyss_magus.ts, src/art/monsters/shade_assassin.ts

ABYSS_MAGUS (abyss_magus.ts)
- Frame 80×80. anchor (39,77) is the shadow/ground point. hover 6: robe hem tips sit at y≈71.
- muzzle (70,22) is the orb centre in the impact frame. It is computed in code from the impact pose (orbCenter), so it stays correct if the pose is edited.
- core (40,40). attackImpactFrame 5.
- Animations:
  - idle: 8 frames @ 8fps, loop
  - roar: 10 @ 10fps
  - attack: 10 @ 10fps
  - hit: 4 @ 10fps
  - guard: 4 @ 5fps, loop
- Colours for VFX:
  - Orb: void2 rim, void3 body, void4 core, white specular.
  - Robe/cape: void0–void3, cape outer night1–4.
  - Armour: night1–4 plus steel/mist.
  - Eyes and throat gem: mag2–mag4 + white.
  - Runes: void2–void4.
- Attack timeline (100ms per frame):
  - f1–3 wind-up: staff swings back over the shoulder, orb grows to about 1.45× its size, motes spiral into it, visor flares.
  - f4: smear arc (orb path).
  - f5 IMPACT: staff thrust up-forward about 45°, orb at the muzzle with a white/void4 release ring and star rays. Launch the 'Uçurum Küresi' projectile here.
  - f6: the orb is spent (tiny), as if just fired.
  - f7–9: orb regrows to normal.
- Roar timeline:
  - f1–2 gather: sinks, orb drawn in, runes ignite.
  - f3 BURST (≈300ms): staff raised, cape flares, visor glint, aura ring and speed lines appear. Sync the summon flash/shake here.
  - f4–6: aura ring expands from radius 14 to 29, fading.
  - f7–9: settle.
- Hit: f0 knock-back 4px, visor squints shut, orb dims, cape and robe whip forward.
- Guard: staff held diagonally across the body, cape wrapped around the robe, a faint dotted ward arc in front with a crest sliding along it.
- For the B/T-destroy effect, roar f3–5 (staff raised) is the best pose to 'point' from.

SHADE_ASSASSIN (shade_assassin.ts)
- Frame 64×64. anchor (24,60). hover 0.
- muzzle (60,37) is the midpoint of the two dagger tips in the impact frame (computed in code).
- core (28,38). attackImpactFrame 5.
- Animations:
  - idle: 8 @ 8fps, loop
  - roar: 10 @ 12fps
  - attack: 9 @ 12fps
  - hit: 4 @ 10fps
  - guard: 4 @ 5fps, loop
- Colours for VFX:
  - Scarf/mask: crim1–crim4.
  - Blades and slashes: void3/void4/white.
  - Afterimages: void0–void3.
  - Hood/cloak: night1–4 + steel.
  - Bodysuit/legs: night1 with void2/void3 highlights.
  - Eyes: void3/void4/white.
- Attack timeline (83ms per frame):
  - f1–2: coil low (anticipation).
  - f3: launch; the body explodes forward with daggers cocked over the shoulders, plus a violet afterimage.
  - f4: diagonal crescent slash smear plus two afterimages.
  - f5 IMPACT: arms fully extended. A white/void4 X-slash spans x 50–62, y 23–46 with the daggers on top of it, plus one afterimage.
  - f6: X fades to void2/void3, scarf whips over.
  - f7–8: hop back to neutral.
- Note: the hip moves 23→33 px inside the frame during f3–6, so the sprite already lunges about 10px forward on its own. A cinematic can add its own travel on top. The 'Gölge Adımı' shadow-pool sink and slide are not in the sprite; the cinematic handles them and should play the attack animation when the assassin emerges behind the target.
- Roar timeline:
  - f1: daggers crossed (anticipation).
  - f2–5 (≈170–420ms): both daggers spin with void arc smears while the scarf whips upward.
  - f6–7 (≈500–580ms): flourish, arms spread wide, eyes flare with a glint trail. This is the best sync point.
  - f8–9: settle.
- Hit: f0–1 snapped upright, eyes shut, scarf flicks upward. f2–3 recover.
- Guard: daggers crossed in an X in front of the chest, with the back hand brought in front. Calm.

Both: idle frame 0 equals the neutral pose. The last frame of roar, attack and hit returns to (or very near) neutral, so playing idle afterwards does not pop. No shared contract files were touched.

Open issues reported by the agent:
- Both sprites are deliberately dark (DARK attribute) and rely on rim lights plus glowing accents. On the dark board they read at 1×, but are less bright than crystal_wyrm. If the runtime adds the planned rim-light shader they will pop more.
- tools/shot.mjs page.goto has a fixed 30s timeout. Under heavy concurrent load (many agents taking screenshots) it times out. I worked around this with a private copy in my scratchpad; consider making the timeout follow --timeout in the shared tool.
- The scratchpad directory is shared between parallel agents: another agent overwrote my scratch render.mjs. I moved my helpers into scratchpad/art-dark/. Other agents may want their own subfolders too.
- The magus helm and pauldrons are rigid stamps, so head tilts are translations only, e.g. the head rising in the roar. A tilted 'roar head' stamp could be added later if a cut-in wants more.

## src/art/monsters/coral_serpent.ts, src/art/monsters/tide_golem.ts

Files: src/art/monsters/coral_serpent.ts, src/art/monsters/tide_golem.ts

CORAL_SERPENT (coral_serpent): frame 80×80, anchorX 30, anchorY 76 (bottom of the ground coil), hover 0, muzzle {x:73, y:35}, core {x:38, y:46} (mid-neck), attackImpactFrame 5.
Animations:
- idle: 8 frames @ 8fps, loops. A sway wave travels up the body; head lags behind.
- roar: 10 frames @ 10fps.
- attack: 10 frames @ 12fps.
- hit: 4 frames @ 10fps.
- guard: 4 frames @ 4fps, loops.
Attack ("Gelgit Mızrağı"):
- Frames 1–3: neck coils back into an S, crown flares.
- Water orb charges in the mouth on frame 2 (half size) and frame 3 (full size). Cyan2/3/4 with white, about 1.7–2.7 px radius, near the snout.
- Frame 4: snap forward, with a pale afterimage of the head.
- Frame 5 = IMPACT (5/12 s ≈ 417 ms): jaws fully open, water burst drawn at the muzzle (water3/water4/white).
- Jaws stay fully open on frames 5–7 (~250 ms). Fire and hold the jet then. Burst is drawn on frames 5–6.
- Frames 8–9: recovery.
- Mouth aims about 0.1–0.35 rad below horizontal. A jet aimed straight at the target reads fine.
Roar:
- Frame 1: dip.
- Frame 2: rise.
- Frames 3–6 (300–700 ms): jaws fully open, crown flared, eye glows white with a cyan streak behind it. Best moment for a roar ring or shake.
- Frames 4–7: spray drops fly off.
- Frames 8–9: settle.
Hit: frame 0 is the snap-back (eye squeezed shut, coil squashes). Recovers by frame 3.
Colors (for VFX matching):
- Body: PAL.water1/2/3 (water0 shadow, water4 highlight).
- Belly: mist / steel / water4.
- Crown and fins: mag1–mag4, crim3 polyps.
- Eyes and glowing dots: cyan3, cyan4, white.
- Mouth: crim0–crim2.
- Jet: water3, water4, white core.

TIDE_GOLEM (tide_golem): frame 64×64, anchorX 30, anchorY 60 (bottom of the foam ring), hover 0, muzzle {x:53, y:57} (fists hitting the ground in front: start the floor wave here and roll it right along the ground), core {x:31, y:30} (glowing chest core), attackImpactFrame 5.
Animations:
- idle: 8 frames @ 8fps, loops. Bob, currents, foam, waterspout spin, drips.
- roar: 10 frames @ 10fps.
- attack: 10 frames @ 12fps.
- hit: 4 frames @ 10fps.
- guard: 4 frames @ 5fps, loops.
Attack ("Dalga Darbesi"):
- Frame 1: crouch.
- Frames 2–3: both arms heave overhead, body leans back, core goes white-hot on frame 3, mask eyes and mouth blaze (frames 3–5).
- Frame 4: swing, with a swoosh arc over the head.
- Frame 5 = IMPACT (~417 ms): fists slam the ground at the muzzle, splash drawn there.
- Frame 6: follow-through splash plus drops.
- Frames 7–8: recover.
- Frame 9: neutral.
Roar:
- Frame 1: crouch.
- Frames 2–6: arms up. Geysers from both fists on frames 3–6, tallest on frame 4.
- Mask mouth glows cyan on frames 2–6.
- Spray arcs on frames 3–6.
- Frames 7–9: settle.
Hit: frames 0–1 knock the body back with loose water blobs and drops flying right.
Guard: a water ring spins around the waist (center ≈ (31,46), radius ≈ 19×5.5); forearms crossed over the core. Its front edge (≈ (44,48)) is a natural origin for the on-defense "−300" splash-back. The core (31,30) also works.
Colors:
- Water: water0–water4, white foam.
- Stone: stone0–stone4.
- Coral: mag1–mag4, crim3.
- Core, eyes, runes: cyan1–cyan4, white.

Shared contracts: no changes. I only touched my two monster files and scratch files under shots/art-water/.

Open issues reported by the agent:
- Golem guard: the crossed forearms and their stone bracelets partly hide the mask. One glowing eye and the coral stay visible, but the X of the arms is a bit busy at 1×.
- The serpent's lunge afterimage (attack frame 4) is mostly hidden behind the coral crown. The jump from frame 3 to 5 still reads, but the frame-4 afterimage adds little.
- The repo's tools/shot.mjs times out on page load when the machine is busy (30 s Playwright default for page.goto). I used a copy with a 240 s timeout in shots/art-water/shot-slow.mjs. The tool owner may want to raise that default.

## src/art/monsters/magma_titan.ts, src/art/monsters/ember_wolf.ts

Files: src/art/monsters/magma_titan.ts, src/art/monsters/ember_wolf.ts

MAGMA TITAN (magma_titan)
- Frame 80×80; anchor (39,77); hover 0.
- Muzzle (74,38) = the knuckles of the extended near fist in the impact frame; the magma burst is centred there.
- Core (39,41) = molten chest core in the neutral pose; it moves with the torso lean during roar and attack.
- attackImpactFrame 5.
- Anims: idle 8f @7fps loop; roar 10f @10fps; attack 10f @12fps; hit 4f @10fps; guard 4f @4fps loop.
- Colors: basalt stone0 #1d1c26, stone1 #393846, stone2 #5d5c6e, stone3 #8b8a9c; lava fire1 #8a1c09 → fire2 #d83f0e → fire3 #ff8a1e → fire4 #ffda66 → gold4 #fff4b5. The core heart flashes white.
- Roar sync points:
  - Frame 1: hunches and gathers; core dims.
  - Frames 2–4: fists thrown up; vents erupt, peaking at frame 4 (good moment for a rumble or 1–2 px shake).
  - Chest beats with an impact star and core flash: frame 5 near fist (star ~(34,41)), frame 6 far fist (star ~(45,38)), frame 7 near fist again. Each one is a thud or small shake.
  - Frames 8–9: settle into idle.
- Burn-500 fireball: launch it from the core (39,41) near the end of the roar (frames 6–8).
- Attack sync points:
  - Frame 1: lean back.
  - Frames 2–3: wind-up. The fist is cocked above the near shoulder at ~(11,24), knuckles heating, core at full charge.
  - Frame 4: swing smear, and the far foot stomps at ~(54,77) with a lava splash (stomp shake).
  - Frame 5: IMPACT. Arm fully extended, fist swollen and white-hot, burst at the muzzle.
  - Frame 6: hold. Frame 7: follow-through (fist drops). Frames 8–9: back to neutral.
  - The arm stays extended over frames 5–6, so hit-stop can start at frame 5.
- Hit: frame 0 is the recoil peak (seams flash, core dims, eyes shut); rock shards and embers fly up-right from ~(60–77, 13–41) over frames 0–2.
- Guard: lowered ~2 px; the core glow leaks between the crossed forearms.

EMBER WOLF (ember_wolf)
- Frame 64×64; anchor (28,59); hover 0.
- Muzzle (60,29) = between the open jaws, front teeth, in the impact frame.
- Core (28,40) = torso centre.
- attackImpactFrame 5.
- Anims: idle 8f @8fps loop; roar 10f @10fps; attack 10f @12fps; hit 4f @10fps; guard 4f @5fps loop.
- Colors: fur stone1 #393846 (lit stone2/stone3); shadows night1 #12163a, night0 #0b0d1f; flames fire1 #8a1c09 → fire2 #d83f0e → fire3 #ff8a1e → fire4 #ffda66 with gold4 #fff4b5 cores; eyes gold3/gold4/white; mouth interior fire2–gold4.
- Flames are drawn unoutlined, so the bright tones will bloom.
- Attack sync points:
  - Frame 1: crouch back, snarl.
  - Frames 2–3: coiled; at frame 3 the flames flare and the eyes blaze.
  - Frame 4: launch (push-off from the hind paws, mane streams back, the ground fire trail starts behind the hind paws at y≈58).
  - Frame 5: IMPACT. Airborne lunge, jaws FULLY open (this frame only), two flame-outline afterimages behind, trail at its longest.
  - Frame 6: jaws snap shut, the bite (a good moment for a second bite flash or hit-stop).
  - Frame 7: lands (paws plant, dust). Frames 8–9: recover.
- Roar (also the post-kill howl): frame 1 dips the head. Frames 3–6 are the howl hold, with the muzzle pointing up ~55° at about (40–47,15–22) and jaws open 0.8–0.9; the mane and tail flare to max at frame 4. Settles over 7–9.
- Battle-destroy burn ("alev ruhu panele −300"): launch the flame spirit from the mane, ~(30,26), during howl frames 4–5.
- Hit: frame 0 yelp (head flung up, eyes shut, flames down to ~50%, front paw lifted); recovered by frame 3.
- Guard: ~4 px lower, snarling with teeth showing, flames at ~55%.

Both monsters face right (P2 gets flipX), and the first and last frames of roar, attack and hit are near-neutral, so they blend into idle.

Open issues reported by the agent:
- tools/shot.mjs often hits its fixed 30 s page.goto timeout while other agents run Vite servers at the same time; retrying 1–3 times always worked.
- The wolf is fully procedural. At 1× it reads well, but under heavy zoom its fur and legs are simpler than the hand-tuned detail of crystal_wyrm. Hand-pixelled head stamps per pitch would be the next upgrade if time allows.
- The titan face is a 12×10 stamp, which limits how much menace it can carry. It reads as an angry gargoyle at 1×.
- At the wolf's attack frame 5 the fire trail and the tail flame tips taper out within about 1 px of the left frame edge. This is by design (they fade), but a cinematic that moves the sprite might show a slight cut there.
- shots/art-fire/magma_titan-film.png predates the last minor titan tweaks; the sheet PNGs are current.

## src/art/monsters/stone_sentinel.ts, src/art/monsters/thorn_lurker.ts

Files: src/art/monsters/stone_sentinel.ts, src/art/monsters/thorn_lurker.ts

STONE_SENTINEL (src/art/monsters/stone_sentinel.ts)
- Frame and points:
  - Frame 64×64, anchor (30,60), hover 0.
  - Muzzle (52,13): the throwing hand's fingertips in the IMPACT frame.
  - Core (31,36), the chest center. The chest rune center is at about (33,30) in the neutral pose.
  - attackImpactFrame = 6.
- Anims:
  - idle: 8 frames @ 6 fps, loop. Inhale (1px lift) on frames 1–4, the rune pulses, the eye dims on frame 5.
  - roar: 10 frames @ 10 fps.
  - attack: 10 frames @ 12 fps; impact at 500 ms.
  - hit: 4 frames @ 10 fps.
  - guard: 4 frames @ 4 fps, loop.
- Colors:
  - Body: stone0–4.
  - Moss: leaf1–3.
  - Runes and eye: gold2→gold4 (gold4 at full glow).
  - Boulder: earth1–4 with a leaf moss cap.
  - Dust: earth2/3/4.
  - Swing smear: stone3/stone4.
- Eye slit: row y≈20, x 28–36 in idle; the brightest part is x 34–36.
- Attack timeline:
  - f1 (83 ms): hand digs into the ground at (13,56), dirt and dust at (11–17,59).
  - f2: boulder ripped up, held at (13,38).
  - f3–4: boulder overhead at about (12,11); max wind-up on f4 with an eye glint.
  - f5: swing smear, boulder over the head at (31,9).
  - f6 IMPACT: the release. The sprite stops drawing the boulder from f6 on, and dirt clods fly right of the hand.
  - f7: follow-through, hand at (50,33), dust at the feet.
  - f8–9: recover.
- Boulder projectile: spawn the projectile('boulder') at the muzzle on f6 with chargeMs≈0. The sprite already shows the rip-up and the heft, so the VFX's own ground-rise would show a second rock. The sprite's boulder is about 13px in earth2 base, which matches fx:boulder.
- Roar sync:
  - f1 (100 ms): shield heaved up.
  - f2 (200 ms): SLAM. The shield is driven into the ground at x≈47, rock spikes and dust billows burst on both sides, chips fly. Sync a 2–3 px shake and a thud.
  - f3–6 (300–600 ms): fist raised to about (15,9), rune and eye blaze, eye star-glint on f3–4, gold sparks rise off the chest, pebbles hop.
  - f7–9: settle.
- Hit: f0 knocks him back 3px; stone chips and a dust puff burst off the shield face at x 54–60, y 23–49.
- Guard: shield center (41,47), bottom buried. Shield rune center ≈ (42,44), pulsing gold3/gold4. Chest rune off. Free fist planted at (14,56). Suggested defense-hex flash center: ≈ (41,44).

THORN_LURKER (src/art/monsters/thorn_lurker.ts)
- Frame and points:
  - Frame 48×48, anchor (23,44) (center of the soil mound), hover 0.
  - Muzzle (44,24): the whip-vine tip in the IMPACT frame, where a white/leaf4 whip-crack star is drawn.
  - Core (23,33): the pod center.
  - attackImpactFrame = 4.
- Anims:
  - idle: 8 frames @ 8 fps, loop. The lid breathes and the maw shows red on frames 1–3, the vines sway with lag, a nectar drip (mag3) falls on frames 3–7, a blink on frame 6.
  - roar: 9 frames @ 10 fps.
  - attack: 9 frames @ 12 fps; impact at 333 ms.
  - hit: 4 frames @ 10 fps.
  - guard: 4 frames @ 4 fps, loop.
- Colors:
  - Body, vines and leaves: leaf0–4.
  - Thorns: mag2/mag3.
  - Lips and maw: crim0–2; tongue mag2/mag3.
  - Teeth: white/mist.
  - Eyes: gold2–4 (white at peak).
  - Soil: earth0–4.
  - Spores: leaf4/gold4.
- Eye spots: about (23,27) and (27,28) in idle.
- Roar sync:
  - f1 (100 ms): clench and sink (anticipation).
  - f2 (200 ms): the pod BURSTS open and the vines fling out. A good point for the roar SFX.
  - f3–5 (300–500 ms): maw fully open with a jaw tremble on f3/f5; spores spray up and right from about (30,20).
  - f6: closing.
  - f7 (700 ms): SNAP shut. A good point for a chomp SFX.
  - Usable as the flip reveal ("sarmaşıklar fışkırır").
- Attack:
  - f1–2: the vine rears up and arches back over the pod, the maw snarls.
  - f3: lash with a smear.
  - f4 IMPACT: vine extended up and to the right, tip (44,24), crack star, thorn shards flung.
  - f5: overshoot down, tip about (44,36).
  - f6–8: retract.
- vineWhip VFX: launch it at the impact frame (333 ms after A.play('attack')), from about the muzzle or ground (36,41). The vine root in the soil is at (36,41).
- Hit: f0 knocks the pod 3px left and the lid clamps, the eyes shut, leaf bits fly right.
- Guard: lid closed, the pod 2px deeper, vines crossed in an X over the mouth, eyes dim.

No shared contracts were changed.

Open issues reported by the agent:
- Integration (not my files): fx.projectile('boulder') currently raises its own rock from the ground under `from` over 320 ms. If it is combined with the sentinel's attack anim, call it at attackImpactFrame (6 @ 12 fps = 500 ms) from the muzzle with chargeMs ≈ 0. Otherwise two rocks appear. The vfx-combat 'boulder' bench does not call A.play('attack') yet.
- Integration: the vfx-combat 'vine' bench starts fx.vineWhip at the same moment as A.play('attack'). To line the VFX whip up with the sprite's lash, delay it by about 333 ms (attackImpactFrame 4 @ 12 fps).
- The sentinel's slam spikes, dust and dirt clods, and the lurker's soil mound, sit up to 2px below the anchor row. They are meant to rest on the tile; a drop shadow should go under the anchor as usual.
- The lurker's roar-open and the vines-burst look are suited to the flip-summon reveal (§6 flip). The cinematic layer decides whether to play roar there.

## src/art/monsters/storm_hawk.ts, src/art/monsters/lumen_sprite.ts, src/art/monsters/volt_lizard.ts

Files: src/art/monsters/storm_hawk.ts, src/art/monsters/lumen_sprite.ts, src/art/monsters/volt_lizard.ts

All three face RIGHT (player 2 uses flipX). For fliers, the anchor is the bottom of the body (talons or feet); the game lifts the sprite by `hover` (as vfx-combat does: ground.y - hover).

STORM_HAWK — 48×48, anchor (24,37) = talons, hover 10, core (25,26), muzzle (42,34) = spread gold talons in impact frame 5, attackImpactFrame 5.
- idle 8f @12fps loop: wings top at f0, downstroke f2–4 with wind curls under the wings f2–5.
- roar 10f @12 one-shot: f1–2 gather; f3–6 wings flung wide, beak open (screech f3–6) and a shockwave ring of wind dashes expanding f3→f6; f7–8 big downbeat.
- attack 10f @12: f1 climb beat; f2 wings swing up and fold (anticipation); f3–4 tucked dive (body moves about +5 px right/down in frame, speed lines); f5 IMPACT: body upright, wings flared, talons thrust, three white→teal claw-slash arcs in front of the feet; f6 talons clench, slash fading; f7–9 return.
- hit 4f @10: ruffled feathers and loose feathers tumbling up and back.
- guard 4f @5 loop: closed-wing cloak, 1-px bob.
- Colours: leaf0–3 body/wings, teal2/teal3 tips, mist/white breast, gold3/gold4 beak and talons. Wind VFX should use white / teal4 / teal3 / teal2.
- Cinematic sync: tween the sprite toward the target over attack frames 3–5; hit-stop on f5.

LUMEN_SPRITE — 48×48, anchor (24,38) = feet, hover 12, core (24,24), muzzle (35,21) = white flash between her outstretched hands in impact frame 5, attackImpactFrame 5.
- idle 8f @10fps loop: two wing flutters per loop, 1–2 px bob, blink f5, fairy dust.
- roar 10f @12: f1 crouch; f2 front view; f3 facing left (mirrored); f4 back view; f5 facing right with arms up in a V, shining eyes, open mouth; sparkle burst ring f5→f8 (big star flash at f5).
- attack 9f @12: f1–3 hands at the hip, gold charge orb grows (biggest at f3); f4 thrust with a gold light trail; f5 IMPACT big 4-point flash at the hands plus 3 small cyan stars to the right — spawn the "Işık Kıvılcımı" sparkles at the muzzle here; f6 smaller flash; f7–8 settle.
- hit 4f @10: eyes squeezed (><), wings crumpled, sparkles knocked loose.
- guard 4f @4 loop: wing cocoon in front of her, eyes closed, rising aura motes pulse.
- Colours: gold3/gold4/white glow, cyan3/cyan4 upper wings, gold4 lower wings, skin3/skin4.
- "+500" LP-gain sparkles can reuse white / gold4 / cyan4.

VOLT_LIZARD — 64×64, anchor (35,59) = ground under the body, hover 0, core (35,45), muzzle (59,51) = between the open jaws in impact frame 5 (lightning starts here), attackImpactFrame 5.
- idle 8f @8fps loop: tongue flick f3–4, blink f6, tail flick wave, random crest crackle.
- roar 10f @10: f1 dip; f2 rising; f3–5 reared on the hind legs, jaws wide, crest blazing white, arcs and spark spray (burst f3–6); f6–8 dropping back down.
- attack 10f @12: f1–4 crouch while a charge wave climbs the crest from the tail tip (f1) to the crown (f4); mouth glow builds f3–4. f5 IMPACT: head thrust, jaws fully open (f5–6), mouth white-hot, first bolt fork leaves the jaws, speed lines; f6 discharge hold (fire the zig-zag bolt to the target on f5–6); f7 recoil; f8–9 settle.
- hit 4f @10: crest shorts out (dark f0, flares f1, dim f2) with a spark spray.
- guard 4f @5 loop: belly low, tail coiled, crest pulsing dim.
- Colours: gold1–gold4 body; crest and electricity cyan2 / cyan3 / cyan4 / white; eye cyan4/white.
- The −500 effect bolt should match the cyan4/white zig-zag style (bolt core white, edges cyan4/cyan3).

Portraits (44×34): hawk = screeching, wings spread, teal halo with wind bands; fairy = arms raised on warm gold rays; lizard = blazing crest and open jaws on an electric-blue halo with a cyan bolt.

No shared contracts were changed.

Open issues reported by the agent:
- Browser shots were flaky under the shared machine load: page.goto has a hard-coded 30 s timeout in tools/shot.mjs. Retries succeeded; this is not a bug in my files.
- The `?dev=monster` / `?dev=monsters` previews do not apply `hover`, so in those previews the hawk and fairy sit on the tile. vfx-combat does lift them by hover, which is the intended convention: anchor = bottom of the body, game lifts by hover.
- Storm hawk is small-class (48 px) and reads smaller than the 64 px monsters, especially when the lineup captures a downstroke frame. That is intended for level 3, but VFX and cinematics may want a slightly bigger wind aura around it.
- The hawk's attack moves the body only about 5–6 px forward inside the frame. The 'Kasırga Dalışı' travel to the target (and the arc over defenders for a direct attack) must come from the cinematic tween.

## src/view/HudView.ts, src/view/HandView.ts, src/view/InspectPanel.ts, src/view/ActionMenu.ts

Files: src/view/HudView.ts, src/view/HandView.ts, src/view/InspectPanel.ts, src/view/ActionMenu.ts, src/view/Prompt.ts, src/view/Button.ts, src/view/LogView.ts, src/view/ui-textures.ts, src/boot/40-ui.ts, src/dev/previews/hud.ts

All existing exports and signatures are unchanged; the additions below are additive only.

Additive API:
- ui-textures.ts:
  - `pushUiKeys(handler: (e: KeyboardEvent) => boolean): () => void` puts a handler on a shared keyboard-focus stack and returns the remover. One capture-phase window listener offers each key only to the most recently pushed handler; when it returns true the key gets `preventDefault` + `stopImmediatePropagation`.
  - `uiKeysActive(): boolean` is true while a menu or prompt holds keys (game hotkeys can stand down).
  - `type UiKeyHandler`.
  - `crownTex(scene, player)` → 'ui:crown:<p>' (25×20, full colour, do not tint).
  - `ICON.replay` ('ui:icon:replay').
  - The `ICON.log` art changed to a list glyph; same key.
- HudView.ts: `export type HudCountKind = 'deck' | 'hand' | 'grave'` (the parameter type of `countXY`).

Behaviour changes inside the existing API:
- ActionMenu and Prompt handle keys through `pushUiKeys`, so the keys they use (Esc / Enter / Space / arrows / 1–9 while a menu is open; Enter / Space / Esc / 1–9 in prompts) no longer reach other window keydown listeners. A Space fast-forward hotkey will not fire while a menu or modal is open; check `uiKeysActive()` if needed.
- `Prompt.trapResponse(p, [])` resolves null at once.
- `Prompt.passDevice`: errors in `onCovered` are caught and logged.
- The `gameOver` button label is now 'TEKRAR OYNA' (still resolves on click or Enter).
- `HudView.setLp` loss/gain chip: the panel emblem flips away while the chip shows (cosmetic only).

Reference for integration (exact current API):
- **HudView**: `new HudView(scene, {lp?, active?, phase?, turn?, speed?})`.
  - Callbacks: `onBattle`, `onEndTurn`, `onSpeed(k: 1|2|3)`, `onSound(muted)`, `onLog`.
  - `setLp(p, v, animate=true): Promise`, `getLp(p)`, `setCounts(p, {deck?, hand?, grave?}, animate=true)`.
  - `setActive(p, animate=true)`, `setPhase(phase, p=active, animate=true): Promise`, `currentPhase`, `setTurn(n, animate=true)`.
  - `setButtons({battle?, endTurn?, attention?: 'battle'|'endTurn'|null})`, `setLocked(b)`, `setSpeed(k)`, `speedLevel`.
  - Anchors and effects: `lpXY(p)`, `panelXY(p)`, `countXY(p, kind)`, `flashPanel(p, color, alpha=0.7, ms=320): Promise`, `shake(p, px=3, ms=320)`.
  - `setVisible(b)`, `destroy()`, `battleButton`, `endTurnButton` (Button).
- **HandView**: `new HandView(scene, {owner?, faceDown?})`. Callbacks: `onHover(uid|null)`, `onSelect(uid)`. Getters: `owner`, `isFaceDown`, `uids`.
  - `sprite(uid)`, `cardXY(uid)`, `nextSlotXY()`, `miniXY(p, i?)`.
  - `setHover(uid|null)`, `setEnabled(b)`, `setCards(list, player=owner)`, `setOpponentCount(p, n, animate=true)`, `setPlayable(uids)`, `setSelected(uid|null)`.
  - `addCard(uid, cardId, from?, player=owner): Promise`, `takeCard(uid): CardSprite|null`, `removeCard(uid, 'dissolve'|'fade'): Promise`.
  - `setFaceDown(b): Promise`, `setOwner(p, faceDown=false): Promise`, `destroy()`.
- **InspectPanel**: `show(cardId|null, {atk?, def?})`, `hide(immediate=false)`, `visible`, `destroy()`.
- **ActionMenu**: `open(x, y, [{id, label, enabled?}], {style?, title?, cancelRow?=true}): Promise<string|null>`, `close()`, `isOpen`, `destroy()`.
- **Prompt**:
  - `passDevice(p, onCovered?): Promise<void>`.
  - `trapResponse(p, [{uid, cardId}]): Promise<uid|null>`.
  - `instruction(text, {cancel?=true, style?}) → {close(), cancelled: Promise<void>, setText(s)}`.
  - `confirm(text, {yes?, no?, style?}): Promise<boolean>`.
  - `gameOver(winner, reason?): Promise<void>`.
- **LogView**: `add(text, PlayerId|color)`, `clear()`, `toggle()`, `setOpen(b)`, `open`.

Depth and camera: everything these views create, including short-lived sparks and chips, uses depth ≥ DEPTH.HUD−1 and scrollFactor 0 (mini-hand at HUD−1, hand input zone at HAND−1). A separate HUD camera can therefore route objects by depth ≥ DEPTH.HUD−1.

Open issues reported by the agent:
- Integration note: DuelViews says the HUD will live on a separate un-zoomed camera. My views add short-lived objects (sparks, LP chips, toasts, fireworks) at runtime, so routing objects to the HUD camera must work for later-added objects, not only those that exist at startup — for example, route by depth ≥ DEPTH.HUD−1 on each added object. HandView.addCard flies from the deck tile's screen position, which only lines up while the world camera is at zoom 1 with no pan.
- The keyboard focus stack (pushUiKeys) consumes the keys menus and prompts use. If the DuelController binds Space for 3× fast-forward, it will not fire while an ActionMenu or modal is open; use uiKeysActive() to stand down hotkeys, or push your own handler with pushUiKeys.
- The LogView panel (x 488–636, y 96–292) overlaps the board's right edge by about 12px while open. It is a toggle, so this was left as is.
- The trap prompt only highlights the trap cards inside the prompt. The doc's 'savunan oyuncunun kapalı kartları macenta nabız atar' (the defender's set cards on the board pulse magenta) is board-side work: Director + BoardView.highlightZone / TileCard.pulse.
- The game-over sunburst rays are vector Graphics triangles, so their edges step slightly while rotating. It is acceptable at this alpha, but a pre-rendered dithered ray texture would be crisper.

## src/audio/sfx.ts, src/audio/engine.ts, src/audio/synth.ts, src/audio/sounds.ts

Files: src/audio/sfx.ts, src/audio/engine.ts, src/audio/synth.ts, src/audio/sounds.ts, src/audio/music.ts, src/audio/analyze.ts, src/dev/previews/audio.ts

src/audio/sfx.ts — existing API unchanged (signatures and export names are the same). Everything below is additive.

Original API:
- type SfxName (59 names, unchanged), SfxOpts { volume?: 0..1; pitch?: playback-rate multiplier, clamped 0.25–4; pan?: -1..1 }, type MusicTrack = 'title' | 'duel' | 'victory'
- sfx.play(name, opts?), sfx.unlock(), sfx.setMuted(m), sfx.isMuted()
- music.play(track), music.stop(fadeMs = 600), music.setIntensity(v 0..1)

Extras added by the previous agent (unchanged):
- sfx.setVolume(v 0..1): sfx volume only. sfx.isRunning(): true once the AudioContext is running.
- music.setVolume(v 0..1, default 0.45). music.current(): MusicTrack | null.
- SFX_NAMES: SfxName[]
- renderSfx(name, { seconds?=3.5, chain?=true, opts?, sampleRate?=44100, seed?=1234 }): Promise<AudioBuffer | null> (offline render).

New exports (additive):
- interface SfxCue { at: number /* s */; name: SfxName; opts?: SfxOpts }
- renderScene(cues: readonly SfxCue[], o: { seconds: number; music?: MusicTrack; musicAt?: number; intensity?: number; intensityAt?: [s, v][]; startStep?: number; sampleRate?: number; seed?: number }): Promise<AudioBuffer | null>. Offline mix with the same ducking and victory logic as live play.
- music.ts: renderMusic(track, seconds, { intensity?, intensityAt?, startStep?, sampleRate? }) — the options are a superset of the old ones. Also new: scheduleMusic(chain, track, start, seconds, opts), startPlan(track, now, stingEnd), VICTORY_STING_SEC = 1.8, musicVolume(), interface MusicRenderOpts, and musicEngine.sting(at, pitch?) / musicEngine.fanfarePlaying().
- engine.ts: applyDuck(chain, amount, at). Chain.tap?: AudioNode is the last node before the destination (post-limiter), for level meters.

Behaviour notes for integrators:
- Every call is a silent no-op without WebAudio, before unlock, or when autoplay is blocked. Verified: nothing throws. Calls made before unlock are remembered: music.play / setIntensity / setVolume apply once audio unlocks.
- Gesture listeners (pointerdown, keydown, touchend, capture phase) unlock audio automatically, and also resume it if the browser suspends it later. Calling sfx.unlock() in your own input handler is still fine.
- Each sound has a voice cap and a minimum gap between triggers (lpTick: cap 3, gap 35 ms). Two calls of the same sound within its gap play only once (e.g. attackDeclare from both the attack-declare cinematic in battle.ts and combat.ts attackArrow).
- Big sounds duck the music by up to −6 dB for about 1 s.
- Timing changes: trapActivate now hits at about 5 ms (was about 200 ms after a riser). attackDeclare's hit is at about 220 ms (lands with lockOn's 230 ms snap). chains: rattle 0–0.5 s, wrap 0.56–0.67 s, lock "tak" at 0.78 s.
- Loudness changes: lpTick is louder (meant for the HUD's volume 0.35). Panned sounds now keep the same loudness as unpanned ones (they used to drop 3 dB).
- music.setIntensity: the hot layer (drums, saw bass, lead) glides in over about 1 s. A jump of at least +0.3 to a value of at least 0.5 adds a drum fill and a crash on the next downbeat; calling it at track start does not trigger a fill.
- Duel loop: 512 steps at 136 bpm (about 56.5 s). Title loop about 45.7 s. Victory: 8 s fanfare then a 16 s calm loop.
- Victory coordination: music.play('victory') within 0.4 s after the end of an sfx 'victory' sting starts when the sting ends and goes straight into the calm loop (no second fanfare). sfx.play('victory') while the victory track's own fanfare is playing is skipped. Either call order is safe.
- Track switch = 0.5 s crossfade. music.stop(ms) fades out the dry signal and the reverb send.
- Preview: ?dev=audio[&page=grid|spec&p=0..3|one&name=<sfx>|music|mix|score][&log=1]. The music page has live buttons and an output meter.

Open issues reported by the agent:
- Sound quality was checked only through waveforms, spectrograms, level stats and similarity metrics, never by ear. A human should listen to ?dev=audio (click tiles), ?dev=audio&page=mix and the live buttons on page=music.
- No caller plays music.play('victory') yet: the gameOver cinematic stops the music, and Prompt.ts / banners.ts play only the victory sting. To get the victory track after the sting, call music.play('victory') at or after the sting; the two are coordinated automatically.
- A stereo-source sound panned hard to one side (whoosh, shatter, windGust, chains with pan ±1) gets about +3 dB on that side, because the stereo panner folds both channels together. Small pans are unaffected.
- tools/shot.mjs has a fixed 30 s page-load timeout, and at --scale 4 the audio preview pages sometimes timed out while the machine was heavily loaded. Scales 2 and 3 worked. (That tool is not owned by this task.)
- music.ts reverb sends go to the shared reverb, whose return is not ducked, so during big sounds only the dry music is ducked. This is minor and intentional.

## src/vfx/setpieces.ts, src/vfx/cutin.ts, src/vfx/banners.ts, src/boot/14-vfx-set.ts

Files: src/vfx/setpieces.ts, src/vfx/cutin.ts, src/vfx/banners.ts, src/boot/14-vfx-set.ts, src/dev/previews/vfx-set.ts

All exports and signatures from before are unchanged. Additions:

src/vfx/banners.ts
- type BannerStyle = 'turn'|'phase'|'trap'|'spell'|'big'
- BannerOpts { style?='big'; color? (snaps to its palette ramp; defaults: turn cyan, phase night, spell teal, trap magenta, big gold); sub?: string; NEW hold?: ms; NEW dir?: 1|-1 (sweep direction, 1 = band enters from the left); NEW textColor? }
- banner(scene, text, o): Promise<void>. Resolves after the banner has left the screen. Text is upper-cased Turkish-aware. Rough lengths at speed 1: turn ≈1.0 s, phase ≈0.9 s, spell ≈1.2 s, trap ≈1.2 s, big ≈1.5 s.
- turnBanner(scene, player, turn): "OYUNCU n · TUR t", sweeps in from that player's side in their colour, plays the turnStart sound.
- phaseBanner(scene, phase): ÇEKME AŞAMASI / ANA AŞAMA / SAVAŞ AŞAMASI / BİTİŞ AŞAMASI. The battle phase uses a crimson band plus edgePulse.
- trapBanner(scene): "TUZAK!" letter drop.
- duelStart(scene): "DÜELLO!" gold punch-in, ×2 letters, 5 px shake.
- victory(scene, player, { hold?=1200 }): resolves once the title has landed plus `hold`. The screen (dim, rays, fireworks) STAYS until clearBanners(scene) or scene shutdown.
- NEW clearBanners(scene, ms=300): fades out the persistent victory screen; ms 0 = instant; safe when nothing is up.
- NEW edgePulse(scene, color=PAL.crim2, ms=700): Promise. Two stepped vignette pulses.
- Everything is at DEPTH.BANNER with scrollFactor 0 and cleans itself up.
- When banner({ style: 'big', color: X }) uses a non-gold colour, the letters are white (as in 'DESTE BİTTİ!').

src/vfx/setpieces.ts (additions)
- NEW freeze(scene, ms): Promise. Nesting-safe hit-stop (= combat.stopTime). All set pieces use it.
- NEW MirrorOpts.source?: XY (where the incoming attack streak starts; default attackers[0]) and MirrorOpts.attackColor?: number (default: the attacking player's PLAYER_COLOR). Pass the declared attacker's core as `source` when it is not among the attack-position kills.
- setVolcanoAmbience(scene, on): repeated calls with the state already reached resolve immediately (they used to hang). Scene shutdown tears it down and resolves any waiters.
- panelGlow(scene, player, ramp, ms) now takes its rectangle from layout.panelRect(player).

Behaviour notes for integrators:
- stormStrike: onImpact fires on the strike frame. The target flashes white or dark during the re-strikes and its tint is cleared at the end; the target is never hidden.
- chasm: resolves with the sprite HIDDEN, unmasked, tint cleared, back at its original x/y.
- vineBurst: the target's scale and tint are restored before it resolves.
- swordForge: the blade is ×2 when the target's opaque height is 40 px or more; resolves with goldAura(target).
- Boot step 14 builds the textures 'set:sword', 'set:rune' (frames r0..r7) and 'set:rock' (frames k0..k3). Banners create 'set:vignette:<hex>' on first use.

src/vfx/cutin.ts: cutIn(scene, { monsterId, name, attribute, player }) is unchanged, about 1.55 s. It uses the 'cutin:<id>' texture (frame 'f0', anim 'cutin:<id>') when it exists, otherwise the monster's idle animation at ×3.

Preview: ?dev=vfx-set&fx=storm|fountain|ghost|sword|volcano(&board=0)|trap|mirror|chains|chasm|fireball|wisp|bolt|heal|tendril|vines|cutin(&id=)|turn|phase|trapbanner|spellbanner|battleover|deckout|duel|victory, plus &player=1|2, &once=1, &period=MS, &arena=0. With no fx it shows a clickable menu.

Open issues reported by the agent:
- tools/shot.mjs and src/main.ts are not mine. __neon.step(ms) still runs every frame in one synchronous call, so await chains only move forward at film-frame boundaries. My wrapper (shots/vfx-set/shot.sh) fixes this by patching step through --eval to yield between frames. I recommend adding that yield to main.ts.
- No 'cutin:<id>' portrait textures exist yet (src/art/cutins is empty), so the cut-in was only checked with the fallback (the monster's idle animation ×3, cropped by the band). When the portrait agent's textures arrive, check the framing (scale = floor((138+40)/h)) and eye detection again.
- src/vfx/core.ts hitStop still cannot handle overlapping calls. My files and combat.ts avoid it, but other callers should use setpieces.freeze or combat.stopTime.
- Cinematics in src/cinematics/_defaults/cards.ts call mirrorDome with only the attack-position kills, so the incoming streak starts at the first kill. Passing { source: attackerCore } (new option) would start it from the attacker that actually declared the attack.
- Run while the machine was heavily loaded by other agents: some shot.mjs page loads timed out and were retried. The player-2 smoke runs of volcano, deckout and victory never loaded after 3 tries, so those three were only checked as player 1.

## src/scenes/TitleScene.ts, src/scenes/title/logo.ts, src/scenes/title/camera.ts, src/scenes/title/showcase.ts

Files: src/scenes/TitleScene.ts, src/scenes/title/logo.ts, src/scenes/title/camera.ts, src/scenes/title/showcase.ts, src/scenes/title/ambient.ts, src/scenes/title/prompt.ts, src/scenes/title/icons.ts, src/scenes/title/menu.ts, src/scenes/title/overlay.ts, src/scenes/title/settings.ts, src/scenes/title/gallery.ts, src/scenes/title/howto.ts, src/scenes/title/transition.ts, src/dev/previews/title.ts

SCENE: key 'Title' (src/scenes/TitleScene.ts, class TitleScene). init data TitleData = { at?: 'attract'|'menu'|'howto'|'gallery'|'settings'; page?: number; card?: string; sync?: boolean; logoOnly?: boolean; dev?: boolean; from?: 'duel' }.
- From a finished duel: this.scene.start('Title', { from: 'duel' }). The DuelScene already does this. It skips the click gate, goes straight to the menu with the logo lit, and resumes audio per settings (music.play('title')).
- Plain start (no data): full intro (sky tilt-down, sign power-up, floodlights), then attract mode ('BAŞLAMAK İÇİN TIKLA'). The first click or key calls sfx.unlock() and applies the audio settings.
- Launch: scene.start('Duel', { mode: 'hotseat' | 'vsBot' | 'demo' }). Only `mode` is set; seed, first player and botPlayer are left at their defaults. window.__neon.titleLaunch holds the last DuelLaunch. If 'Duel' is not registered, the title shows a message and wipes back to the menu.
- When booted normally, TitleScene sets window.__neon.ready = true itself. URL QA options without ?dev: ?holdIntro=1 (start on the shot tool's freeze), ?title=menu|howto|gallery|settings&page=N&card=<cardId>.

DEV PREVIEW: ?dev=title&at=attract|menu|howto|gallery|settings&page=0..5&card=<id>&sync=1&logo=1&from=duel.
- sync=1 starts the intro on the shot tool's freeze, so films are deterministic.
- QA hooks (dev only), via window.__neon.title (the scene):
  - .qaKey('ArrowDown')
  - .qaKeys([[2500, 'Digit5'], [5200, 'Escape']]) schedules presses on GAME time
  - .qaScreen reads the current screen ('attract'|'menu'|'howto'|'gallery'|'settings'|'busy'|'launch'|'intro')
- Film recipe for async chains: pass --eval "const o=window.__neon.step; window.__neon.step=async(ms)=>{const n=Math.max(1,Math.round(ms/(1000/60)));for(let i=0;i<n;i++){o(1000/60);await new Promise(r=>setTimeout(r,0));}};" so await continuations advance every frame. My helper script is scratchpad/title/film.sh.
  Example: EXTRA_EVAL="window.__neon.title.qaKeys([[2400,'ArrowDown'],[2700,'Enter']]);" film.sh "?dev=title&sync=1&at=menu" out.png --film 16 --start 2300 --every 90

REUSABLE EXPORTS:
- src/scenes/title/settings.ts
  - applyAudioSettings(s: Settings, track: 'title'|'duel'|null = 'title'). Sound off = sfx.setVolume(0); music off = music.stop(); it un-mutes sfx if either is on. The duel can call applyAudioSettings(loadSettings(), 'duel').
  - SettingsOverlay(scene, settings) with .onChange(settings).
- src/scenes/title/transition.ts
  - wipeOut(scene, ms=560): Promise<Graphics> — cyan bands from the left and crimson from the right interlock into ink, then a seam flash. The cover stays (depth DEPTH.TRANSITION).
  - wipeIn(scene, cover, ms=520) reverses it.
- src/scenes/title/logo.ts
  - buildLogo(scene): LogoLayout (w 431 × h 56; textures 'title:logo:<ch>:<word>:on|off|glow|sil', sheen 'title:logo:sheen').
  - new TitleLogo(scene, x, y, {depth=2000, seed, sound}) with: reveal(), ignite(), showLit(), startIdle(), stopIdle(), sweep(ms), flickerRandom(), glitch(power), flashAll(ms, amount), powerDown(ms), sparkAt(i, n), root (container, scrollFactor 0).
- src/scenes/title/camera.ts
  - new TitleCamera(scene) re-routes cameras.main.shake into scroll offsets, so VFX shakes move only scrollFactor≠0 objects. Props: base {x, y}, drift (0..1), shakeScale. Methods: moveTo(x, y, ms, ease), snapTo(x, y).
- src/scenes/title/showcase.ts
  - new Showcase(scene, {seed, max=4, period=2.9, volume(), cutins()}) with start(firstDelay), stop(), clear(ms), summon(id, slot), clash(a, b).
- src/scenes/title/overlay.ts
  - abstract Overlay(scene, w, h, title, style): open(), close(), onKey(e), onClose.
  - Depths: OV_DIM 36 < OV_BG 38 < OV_FLOOR 39 < floor VFX 40–57 < units / VFX 100–1100 < OV_UI (DEPTH.MENU). This lets world-space VFX play inside panels while the camera rests at scroll (0,0).
  - Helpers: hitZone(), keyHint().
- Other classes:
  - HowToOverlay(scene, page) and HOWTO_PAGES = 6 (src/scenes/title/howto.ts)
  - GalleryOverlay(scene, cardId?) (src/scenes/title/gallery.ts)
  - MainMenu(scene, x, y, entries, {w, depth, title}) with .onSelect, move(d), select(i, sound), activate(), show(), hide(), setEnabled() (src/scenes/title/menu.ts)
  - StartPrompt (src/scenes/title/prompt.ts); Motes and Tagline (src/scenes/title/ambient.ts)
  - Icon textures: TICON.duo|bot|eye|book|cards|gear|left|right|key|mouse, built by buildTitleIcons(scene) (src/scenes/title/icons.ts)
- No shared contracts were modified.

Open issues reported by the agent:
- tools/shot.mjs and main.ts: __neon.step runs all frames in one synchronous task, so films of async (await-chained) choreography are distorted. My films patch step through --eval to yield every frame (recipe in apiNotes). Adopting that in main.ts would help every agent. Under heavy machine load a long faithful-step film (30 s of game time) exceeded 10 minutes, and some shots needed retries after page.screenshot timeouts.
- Showcase clashes use the shared combat VFX, which play their own sfx at fixed volume, and impact() hit-stops, which briefly (about 80–100 ms) freeze all title tweens, including menu animations. This is intended impact feel. setCombatSfx is global, so I did not touch it.
- If the player opens a sub-screen exactly while a showcase clash is mid-beam, beam or impact residue can flash over the unfolding panel for under 300 ms. It is cosmetic and threw no errors in testing.
- How-to page 3: the big Kristal Ejder summon pillar (210 px tall) rises above the illustration frame into the panel header. I left it as intentional 'bursting out' drama; lower the pillar height if a tidier frame is preferred.
- Settings semantics: 'Ses efektleri' maps to sfx.setVolume(0/1), not sfx.setMuted (which would also mute music); 'Müzik' starts and stops the track. The Duel scene should honour loadSettings().speed and .curtain, and can reuse applyAudioSettings(settings, 'duel').
- The launch passes only { mode }. vsBot relies on the DuelLaunch default botPlayer = 1 and the duel picks its own seed.
- In the gallery, spell and trap stages are fairly static compared with monsters (floating 3× art, rune circle, periodic element effects). Signature mini set-pieces per spell (for example from src/vfx/setpieces.ts) could be added later.

## src/scenes/DuelScene.ts, src/scenes/registry.ts, src/scenes/BootScene.ts, src/dev/previews/duel.ts

Files: src/scenes/DuelScene.ts, src/scenes/registry.ts, src/scenes/BootScene.ts, src/dev/previews/duel.ts, src/cinematics/index.ts, src/cinematics/api.ts, src/cinematics/_core/registry.ts, src/cinematics/_core/types.ts, src/cinematics/_core/Director.ts, src/cinematics/_core/project.ts, src/cinematics/_core/helpers.ts, src/cinematics/_defaults/index.ts, src/cinematics/_defaults/flow.ts, src/cinematics/_defaults/summon.ts, src/cinematics/_defaults/battle.ts, src/cinematics/_defaults/strikes.ts, src/cinematics/_defaults/cards.ts, src/duel/types.ts, src/duel/MonsterUnit.ts, src/duel/StatBadge.ts, src/duel/FieldView.ts, src/duel/PileView.ts, src/duel/auras.ts, src/duel/CameraRig.ts, src/duel/speed.ts, src/duel/viewer.ts, src/duel/DuelistView.ts, src/duel/HumanInput.ts, src/duel/DuelController.ts, src/duel/CardPicker.ts, src/duel/scenario.ts, src/duel/scenarios.ts, src/duel/testClock.ts

CINEMATIC REGISTRY. Import everything from `src/cinematics/api.ts` (`./api` from a top-level cinematics file).

Loading:
- Put a file anywhere under `src/cinematics/` except `_core/`, `_defaults/`, `api.ts` and `index.ts`, and register at module top level.
- `loadCinematics()` installs the defaults first (priority `DEFAULT_PRIORITY = -100`). It then imports the other files lazily, one at a time, in path order.
- A file that throws while loading is logged and skipped; the game keeps going.

Registration functions (each returns an unregister function; `opts = { priority?: number (default 0), name?: string }`):
- `registerEvent(type, handler, opts?)`
- `registerCardHook(cardId, kind, handler, opts?)`
- `registerStrike(monsterId, (s: StrikeArgs) => Promise<void>, opts?)`. This replaces only the attack motion. The default battle handler still clears the arrow and does the outcome, damage and shattering. The strike must call `s.impact(at?)` once at contact and resolve when the attacker is back home.

Other exports:
- `registerObserver(fn(ev, ctx))`: called for every event when it starts.
- `strikeFor(id)`, `listHandlers()`, `HOOK_KEYS`.
- `fx`: the helpers in `_core/helpers.ts`.

A handler is `(ctx) => void | Promise`. Resolve only when the visuals of every event you handled are final; decorative tails may keep running.

Chain order for one event:
1. Higher priority first.
2. At equal priority, card hooks before event-type handlers.
3. Then the later registration first.

`ctx.base()` runs the next handler in the chain (middleware style). So a new file registered at priority 0 always overrides the defaults, whatever the import order.

Card hook kinds (`CardHookEvents`), with the card each one is keyed by:

| Kind | Event | Keyed by |
|---|---|---|
| summon | summon | the summoned card (normal / tribute / special; a flip summon arrives as 'flip') |
| flip | flip | the flipped card. With cause flipSummon the default consumes the paired summon. |
| tribute | tribute | the monster being Tribute Summoned (forUid) |
| tributed | tribute | the tributed monster |
| attackDeclare | attackDeclare | the attacker |
| attack | battle | the attacker. The default consumes the battle damage and battle destroys and plays them with ctx.play. |
| defend | battle | the attacked monster |
| activate | activate | the spell or trap |
| effect | activate (kind monsterEffect) | the monster |
| target | target | the source card |
| destroyed | destroy | the destroyed card |
| destroys | destroy | sourceUid's card (e.g. chasm_trap) |
| toGraveyard | toGraveyard | the card |
| equip | equip | the equip spell |
| field | fieldSpell | the field spell |
| statChange | statChange | the monster |
| damage | damage | the source card |
| lpGain | lpGain | the source card |
| discard | discard | the card |
| negate | attackNegated | byUid's card |

setMonster, setSpellTrap and draw have no card hooks (the card is hidden).

CinematicContext (`_core/types.ts`):
- Scene and event:
  - `scene`, `views`, `ev`, `index`, `events`.
  - `before` / `after`: the engine state at the start / end of the batch.
  - `state`: the projected state just before this event. `stateNext`: just after it. `stateAt(i)`.
  - `hints`: data passed by `ctx.play`.
- Players and settings: `mode`, `viewer`, `canSee(p)`, `isHuman(p)`, `skipIntro`, `settings`.
- Lookups:
  - `cardId`, `card`, `monster`, `owner`.
  - `atk(uid, when?)` and `def(uid, when?)` include equips and the field spell. `when` is 'now' | 'next' | 'after' | 'before'.
  - `locate(uid, when?)`, `unit(uid)`, `tile(uid)`.
- Event queue:
  - `peek(n)`.
  - `find(pred, { from, until, includeConsumed })` and `findType(type, pred?, opts?)` return an index or -1.
  - `consume(n)`, `consumeAt(i)`, `isConsumed(i)`.
  - `play(i, hints?)` runs a later event's full handler chain now and marks it consumed. Await it.
  - `base()`.
- Effects and timing:
  - `sfx(name, opts)`, `music`, `wait(ms)`, `tween(cfg)`, `safe(p)`.
  - `focus(xy, { zoom, ms, pan })` / `unfocus(ms)`: world camera only.
  - `keep(key, handle)` / `take(key)`: kept handles survive across a pending decision. The attack arrow is kept as 'attack'.
  - `log(text, color)`.
  - `userWait(p)`: pauses the watchdog.

Hint conventions:
- damage: `{ at: XY, battle, delivered }`. `delivered` means the number and LP roll only, no fireball.
- lpGain: `{ delivered, at }`.
- destroy: `{ push: XY, hit: boolean }`.
- summon: `{ noCard, ghost }`. `noCard` means no card flight.

StrikeArgs: `{ ctx, scene, attacker: MonsterUnit, target: MonsterUnit|null, to, toGround, direct, blocked, power: 1|2|3, impact(at?), impacted }`.

fx helpers:
- Cards: `takeHandCard`, `slamToZone`, `cardToGraveyard`, `tileToGraveyard`.
- Monsters: `summonEntrance(ctx, unit, { big, cutIn })`, `shatterUnit`, `hitReact`, `hexShield`.
- Spells and traps: `spellShowcase(ctx, { uid, cardId, player, from: 'hand'|TileCard|CardSprite, hold, kind })` returns `{ card, release(to), land({ player, spot, index, uid, cardId }), close() }`. `energyBolt`, `trapReveal`.
- Damage and LP: `presentDamage`, `presentHeal`.
- Resolution runs: `resolutionRun(ctx)` gives the indices of the activation's own resolution events. `playRun(ctx, indices, hints?)` plays them in order. Use these so an activation owns its whole resolution and the board is never re-synced half-way.
- Points and colours: `lpPoint`, `duelistPoint`, `dim`, `attrRamp`, `isAce`, `zoneCenter`.

Defaults: `_defaults/flow`, `summon`, `battle`, `strikes` and `cards` cover all 28 event types.
- Card hooks:
  - Spells (activate): judgment_bolt, healing_spring, soul_recall, dragon_blade, volcano_arena.
  - Traps: chasm_trap (activate and destroys), mirror_barrier and chains_of_light (activate).
  - Monster effects (effect): magma_titan, ember_wolf, volt_lizard, tide_golem, lumen_sprite, abyss_magus, thorn_lurker.
- Strikes for all 12 monsters:
  - prism beam (wyrm), dark orb (magus), heavy lunge with stomp (titan), water jet that pierces (coral)
  - lunge and bite (wolf), wave (golem), spiral dive (hawk), boulder (sentinel), sparks (lumen)
  - shadow step and X-slash (shade), lightning (volt), vine whip (thorn)

FIELDVIEW (`src/duel/FieldView.ts`):
- `sync(state)`: instant reconcile, including auras (equip gold aura; volcano flame for FIRE, steam for WATER).
- Lookups: `entry(p, spot, i)`, `entryOf(uid)`, `unit(uid)` (also finds units that are still fading out), `unitAt(p, zone)`, `units()`, `tileOf(uid)`, `tileAt(p, spot, i)`, `tiles()`.
- `pile(p, 'deck'|'graveyard')` returns a PileView: `count`, `topCard`, `topXY()`, `set(n, topId)`, `bump()`, `flash(color)`.
- Building visuals before the state catches up:
  - `placeCard(p, spot, i, uid, cardId, faceUp, orientation)`
  - `placeMonster(p, zone, uid, cardId, { position, faceUp, hidden, atk, def })`
  - `addUnit(uid, { hidden, atk, def, position })`
  - `release(uid)`: detaches the objects; the caller owns them.
  - `remove(uid, { fade })`, `forget(uid)`.

MONSTERUNIT (`src/duel/MonsterUnit.ts`):
- Fields: `uid`, `cardId`, `card`, `art`, `attribute`.
- `sprite` is a plain top-level Sprite, not inside a container, so every VFX helper accepts it. Its origin is the art anchor (mirrored for P2, who uses flipX). It is lifted by `hover` and its depth is unitDepth(ground y).
- `shadow` scales with hover. `badge` is a StatBadge (3×5 card digits; green when raised, red when lowered; rolls on change).
- State: `player`, `zone`, `position`, `tile`, `lift`, `posed`, `retired`.
- Points: `home`, `rest0`, `flipX`, `frameInfo()`, `framePoint(fx, fy)`, `worldPoint('muzzle'|'core'|'anchor'|'feet'|'top')`, `core()`, `muzzle()`.
- Animation:
  - `play(anim, { hold })`: one-shots resolve on complete, then return to idle/guard.
  - `playToFrame(anim, f)`, `attackToImpact()`, `impactMs`, `rest()`.
- Stats and position: `setStats(atk, def, animate)`, `setPosition(pos, animate)` (also rotates the tile), `setController(p, zone)`.
- Auras: `setAura(key, handle|null)`, `aura(key)`, `hasAura(key)`.
- Visibility: `hide()`, `show()`, `showSprite()`, `settle()`, `displaced`, `retire(ms)`, `destroy()`.
- Set `lift` while the sprite is in the air so the shadow stays on the floor. Set `posed = true` to hold a pose across syncs.

Other views:
- `DuelViews = { board, field, hud, hand, inspect, prompt, menu, log, camera: CameraRig, duelists: DuelistViews|null, info: ViewerPolicy, speed: SpeedControl }`.
- `CameraRig`: `focus(xy, { zoom, ms, pan })`, `unfocus()`, `descend(ms, from)`, `worldPoint(sx, sy)`, `reset()`.
- `SpeedControl`: `base`, `value`, `setBase(k)`, `slowMo(k, ms)`.
- `ViewerPolicy`: `viewer`, `canSee(p)`, `isHuman(p)`, `ensureViewer(p)` (shows the curtain in hot-seat).
- `DuelistViews.get(p)`: `play('command'|'hurt'|'defeat'|'victory')`, `jolt()`, `chest()`.

QA:
- URL: `?mode=hotseat|vsBot|demo&seed=N&first=0|1&skipIntro=1&speed=N&curtain=0&loop=1&holdIntro=1`. `holdIntro` reports ready at once and starts the opening on the first freeze, for films. Also `?dev=duel&s=<scenario>`.
- `window.__neon.duel`:
  - `state()`, `legal()`, `busy()`, `lastEvents()`, `idle()`, `uid(cardId, owner?)`.
  - `dispatch(action)`: `player` may be omitted. Validates the action, plays its cinematics and resolves after the sync.
  - `dispatchOnFreeze(action)`, `auto(on)`.
  - `restart(opts: NewGameOptions & { mode, skipIntro, stage, state, curtain, speed, auto, loop })`: resolves when the new duel waits for its first action.
  - `scenario(name, { film })`, `scenarios()`, `errors()`, `handlers()`, `views`, `launch`.
- `window.__neon.ready` becomes true once the duel is interactive, including when the curtain waits for a click.

Recipe for staging any scenario:
```
node tools/shot.mjs "?mode=hotseat&seed=1&skipIntro=1&curtain=0" --eval "await __neon.duel.restart({mode:'hotseat',curtain:false,stage:{phase:'battle',p0:{monsters:[null,'crystal_wyrm']},p1:{monsters:[null,'abyss_magus'],spellTraps:['mirror_barrier']}}}); const D=__neon.duel; D.dispatchOnFreeze({type:'attack',player:0,attackerZone:1,targetZone:1});" --film 24 --every 120
```
- To answer the trap, dispatch `{ type:'respond', player:1, uid: D.uid('mirror_barrier',1) }` after the attack resolves.
- Simpler: add an entry to `src/duel/scenarios.ts` and run `node tools/shot.mjs "?dev=duel&s=<name>" --film 30 --every 150`.
- StageSpec: `{ p0/p1: { hand, deck, graveyard, monsters: [id | { id, position, faceUp, ... } | null], spellTraps: [id | { id, faceUp, equippedTo: zoneIndex }], field, lp }, phase, active, turn }`.

Defaults that are most basic and most need signature versions (most needed first):
1. Summons: every monster gets the generic attributeSummon by attribute and the cut-in for aces. No monster has its own entrance yet (e.g. the wyrm's wing spread, the titan's ground split).
2. Impacts: every strike's impact uses only attribute-coloured sparks. The bible's per-card impacts are missing: crystal shards (wyrm), lava splash (titan), implosion (magus, partly), water spray (coral).
3. Spells: one common showcase for all five; no per-card intro (e.g. the sky darkening for Yıldırım Hükmü).
4. Traps: trapReveal and the "TUZAK!" banner are shared.
5. Destroy: the same generic shatter for every monster. Şimşek Kertenkelesi's remains and the ace deaths need flavour.
6. Draw, turn and phase: basic.
7. Game over: the losers' holograms collapse, then Prompt.gameOver. banners.victory is not used.
8. Duelist reactions are wired (command, hurt, defeat, victory) but the duelist art does not exist yet.

Open issues reported by the agent:
- setpieces.goldAura (and the same pattern elsewhere) throws a TDZ ReferenceError ('kill' before initialization) when its first onFrame tick sees an inactive target or a scene that is not running yet, e.g. when created inside a scene's create(). FieldView now only creates auras on a running scene (and retries on the first UPDATE), but the setpieces owner should declare kill/stop before onFrame.
- src/art/duelists.ts does not exist yet. createDuelists() returns null and every duelist beat is skipped; direct hits and battle damage numbers fall back to a point behind the back row. The export names are guessed: duelistTextureKey(p), duelistAnimKey(p, anim), DUELIST_W/H, and either DUELIST_ANCHOR {x,y} or DUELIST_ANCHOR_X/Y (default bottom-centre). Re-check the placement once the art lands.
- Prompt.gameOver only offers 'Tekrar Oyna'. DuelScene adds its own 'Ana Menü' button under it (plus Esc), which goes to scene 'Title' with { from: 'duel' }. If the UI agent adds a back-to-title choice, remove mine in DuelScene.gameOver.
- The ATK/DEF badge uses the 3×5 card digit font (drawDigits) on a small plate rather than pixelText, for a compact, crisp 1× badge. Swapping it is local to StatBadge.ts.
- CameraRig assigns every top-level object to a camera by depth each frame: depth ≥ DEPTH.HUD−10 goes to the un-zoomed UI camera, everything else to the main camera that zooms and shakes. Screen-space effects drawn below HUD depth with scrollFactor 0 still zoom with the world during focus(). core.shake only moves the world, never the HUD.
- Under the shared machine load, headless swiftshader runs well behind real time (the suite took 146–344 s at speed 3). Films are deterministic (testClock yields each frame), but real-time waits in Playwright scripts need generous margins. The curtain test presses Enter until the curtain is gone.
- Prompt.passDevice ignores input until its letters have landed, so QA tools that start a hot-seat duel with the curtain on must click or press Enter later, or pass curtain:false / &curtain=0.
- In demo mode the hand view follows the active player (spectator); in vsBot it stays on the human. Set cards are never revealed on screen except the viewer's own in the inspect panel.
- BootScene.ts got the minimal edit allowed by the task (it now uses firstScene(params)). FIRST_SCENE = 'Title' is still exported.
