// Volkan Arenası (volcano_arena) — "Saha dönüşür: sarsıntı, karo aralarında lav ışığı, kor
// kırmızısı gökyüzü, süzülen kül ve korlar. ATEŞ canavarlara alev aurası (+500, yeşil), SU
// canavarlara buhar (−300, kırmızı). Etki kalıcıdır."
//
//   0       common opening (field spells always come from the hand); a heat shimmer starts in
//           the card's aura
//   [old]   a field spell already in play is struck first: a fire-teal arc leaps from the card
//           to the old field card, which cracks white and burns away into its owner's graveyard
//   +0      the card slams onto the caster's field zone …
//   +~80    … ERUPTION ('field' hook): the field tile blows white-hot, a fire burst, lava cracks
//           race out across the whole platform (BoardView.setTheme), the sky turns ember red,
//           ash and embers drift in (setVolcanoAmbience) — the camera punches in, then pulls
//           back to show the whole arena
//   front   as the lava front reaches each monster: FIRE monsters erupt in flame (fire burst,
//           orange glow, roar, flame aura) with a green +500; WATER monsters hiss into steam
//           (steam burst, grey flash, steam aura) with a red −300; their badges roll
//
// The 'field' hook also plays the reverse when a volcano leaves the field (Uçurum Büyücüsü):
// the arena cools, flames gutter out in smoke, steam stops, the badges roll back.

import Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { ARENA_V2, DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightDimFor } from '../../view/light';
import { TEX, flash, shake, wait } from '../../vfx/core';
import { damageNumber } from '../../vfx/numbers';
import { Raster, Sparks, addGlow, boltPath, explosion, floorRing, glowStroke, onFrame, rr, run, setVolcanoAmbience, spriteBox } from '../../vfx/setpieces';
import { flameAura, steamAura } from '../../duel/auras';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { bg, evAt, idxOf, relax, spellOpening, SHOW_FLOOR, fs, lightBeam, lightFlash } from './_kit';
// ---- the v3 look (lane A5-A, V3_A5_A; see the section at the end of the file)
import type { AnyMonsterAnim } from '../../art/types';
import { hasMonsterArtV3 } from '../../art/monsters';
import { ERUPTION_GOB_STEP, ERUPTION_STEPS, ERUPTION_TOP, crackPath, paintEruption } from '../../art/spellmotifs-v3';
import { V3_A5_A } from '../../view/v3flags';
import { dropArcs, embers, fxCount, numberUnderBar, rimClimb, shards, silhouetteOf, steamThreads, untilCardCracks } from '../_v3/spellfx';
import { panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { impactNumber } from '../_v3/number';
import { cardLeaves } from '../_v3/card';
import { FRONT_SPREAD_MS, beatTimes, frontArrivalMs, frontSchedule, volcanoAmbienceOnV3, volcanoAmbienceV3 } from './_volcano_v3';

const ADD = Phaser.BlendModes.ADD;
const FIRE_FX = [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;

type AnyCtx = CinematicContext<GameEvent>;
type StatEv = Extract<GameEvent, { type: 'statChange' }>;

/** The contiguous statChange events right after ctx.index (consumed). */
function takeStatChanges(ctx: AnyCtx): StatEv[] {
  const out: StatEv[] = [];
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type !== 'statChange') break;
    if (ctx.isConsumed(i)) continue;
    ctx.consumeAt(i);
    out.push(e);
  }
  return out;
}

/**
 * When the lava front (BoardView crack spread, ~0.9 s Sine.Out) reaches a point `d` px away.
 * v2: the bigger platform's crack network spreads over the same ~0.9 s, so the front moves
 * faster in px (tuned against films of the v2 board).
 */
function frontDelay(d: number): number {
  if (ARENA_V2) return Math.round(Math.min(860, 90 + d * 1.55));
  return Math.round(Math.min(760, 110 + d * 2.1));
}

/** A FIRE monster flares up / a WATER monster steams as the volcano takes hold. */
async function heatUp(ctx: AnyCtx, u: MonsterUnit, e: StatEv, delay: number): Promise<void> {
  const sc = ctx.scene;
  await wait(sc, delay);
  if (u.retired || !u.sprite.active) {
    return;
  }
  const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
  const feet = u.home;
  const top = u.worldPoint('top');
  const fire = u.attribute === 'FIRE' || (u.attribute !== 'WATER' && up);
  const jobs: Promise<unknown>[] = [];
  if (fire) {
    ctx.sfx('fireBurst', { volume: 0.6 });
    bg(explosion(sc, feet.x, feet.y - 3, RAMPS.fire, 0.8, unitDepth(feet.y) + 2));
    bg(floorRing(sc, feet.x, feet.y, { r0: 6, r1: fs(34), ms: 360, ramp: FIRE_FX }));
    // (v2) the monster bursts into flame: firelight over its tile
    void lightFlash(sc, feet.x, feet.y - 14, PAL.fire3, fs(40), 560, { floorY: feet.y, ring: true, intensity: 1.1 });
    jobs.push(addGlow(sc, u.sprite, PAL.fire3, 480, 0.85));
    if (!u.hasAura('volcano')) u.setAura('volcano', flameAura(sc, u));
    if (u.position === 'attack') void u.play('roar');
  } else {
    ctx.sfx('burn', { volume: 0.55, pitch: 1.5 });
    ctx.sfx('waterSplash', { volume: 0.3, pitch: 0.6 });
    const b = spriteBox(sc, u.sprite);
    const puffs = new Sparks(sc, unitDepth(feet.y) + 2);
    puffs.burst(16, (i) => ({
      x: b.cx + rr(-b.w * 0.45, b.w * 0.45),
      y: b.bottom - rr(0, b.h * 0.7),
      vx: rr(-16, 16),
      vy: rr(-46, -20),
      drag: 1.4,
      wobble: 8,
      life: rr(500, 820),
      ramp: [PAL.white, PAL.mist, PAL.steel, PAL.night4],
      tex: i % 3 === 0 ? TEX.dot5 : TEX.px2,
      delay: i * 12,
    }));
    puffs.close();
    void lightFlash(sc, b.cx, b.cy, PAL.mist, fs(28), 420, { floorY: feet.y, intensity: 0.5 });
    jobs.push(addGlow(sc, u.sprite, PAL.mist, 420, 0.7));
    if (!u.hasAura('volcano')) u.setAura('volcano', steamAura(sc, u));
  }
  const delta = Math.abs(e.atk - e.prevAtk) || Math.abs(e.def - e.prevDef);
  if (delta > 0) jobs.push(damageNumber(sc, top.x, top.y - 4, delta, up ? 'buff' : 'debuff'));
  ctx.sfx(up ? 'lpUp' : 'lpDown', { volume: 0.3 });
  jobs.push(u.setStats(e.atk, e.def, true));
  await fx.all(jobs);
}

/** The volcano goes out for a monster: flames gutter into smoke / the steam stops; badge rolls back. */
async function coolDown(ctx: AnyCtx, u: MonsterUnit, e: StatEv, delay: number): Promise<void> {
  const sc = ctx.scene;
  await wait(sc, delay);
  if (u.retired || !u.sprite.active) return;
  const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
  const top = u.worldPoint('top');
  const b = spriteBox(sc, u.sprite);
  const smoke = new Sparks(sc, unitDepth(u.home.y) + 2);
  smoke.burst(10, (i) => ({
    x: b.cx + rr(-b.w * 0.4, b.w * 0.4),
    y: b.top + rr(0, b.h * 0.5),
    vx: rr(-10, 10),
    vy: rr(-30, -14),
    wobble: 6,
    life: rr(500, 800),
    ramp: [PAL.stone3, PAL.stone2, PAL.night3, PAL.night2],
    tex: i % 2 ? TEX.dot5 : TEX.px2,
    delay: i * 15,
  }));
  smoke.close();
  ctx.sfx('burn', { volume: 0.35, pitch: 0.8 });
  u.setAura('volcano', null);
  const jobs: Promise<unknown>[] = [u.setStats(e.atk, e.def, true)];
  const delta = Math.abs(e.atk - e.prevAtk) || Math.abs(e.def - e.prevDef);
  if (delta > 0) jobs.push(damageNumber(sc, top.x, top.y - 4, delta, up ? 'buff' : 'debuff'));
  await fx.all(jobs);
}

/** The old field spell is struck by the new card and burns away (destroy + toGraveyard events). */
async function breakOldField(ctx: AnyCtx, from: XY, di: number): Promise<void> {
  const sc = ctx.scene;
  const d = evAt(ctx, di, 'destroy');
  if (!d) return;
  ctx.consumeAt(di);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === d.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
  const g = evAt(ctx, gi, 'toGraveyard');
  if (gi >= 0) ctx.consumeAt(gi);
  const field = ctx.views.field;
  const { tile } = field.release(d.uid);
  const at = tile ? tile.home : zoneXY(d.player, 'field', 0);
  const hit = { x: at.x, y: at.y - 4 };
  // a fire-teal arc leaps from the hovering card to the old field card
  const ras = new Raster(sc, Math.min(from.x, hit.x) - 30, Math.min(from.y, hit.y) - 30, Math.abs(from.x - hit.x) + 60, Math.abs(from.y - hit.y) + 60, DEPTH.FX_TOP + 6, ADD);
  ctx.sfx('lightning', { volume: 0.6, pitch: 1.3 });
  bg(lightBeam(sc, from, hit, PAL.fire3, 300, { width: 10, intensity: 1, shimmer: 0.8, floor: { from: { x: from.x, y: SHOW_FLOOR }, to: at } }).done);
  await run(sc, 110, (t) => {
    const pts = boltPath(from, hit, 18, 5);
    ras.draw((gr) => glowStroke(gr, pts.slice(0, Math.max(2, Math.ceil(pts.length * Math.min(1, t * 1.6)))), [PAL.fire1, PAL.fire3, PAL.teal4, PAL.white], 1, 1));
  });
  // crack: white flash, sparks, burn away
  void lightFlash(sc, hit.x, hit.y, PAL.fire4, fs(36), 420, { floorY: at.y, ring: true, intensity: 1 });
  ctx.sfx('shatter', { volume: 0.8, pitch: 1.1 });
  ctx.sfx('groundCrack', { volume: 0.5 });
  bg(explosion(sc, hit.x, hit.y, RAMPS.fire, 0.7, DEPTH.FX + 4));
  bg(
    (async () => {
      const pattern = [1, 0.4, 0.9, 0.2, 0];
      for (const v of pattern) {
        const pts = boltPath(from, hit, 16, 5);
        ras.draw((gr) => {
          if (v > 0) glowStroke(gr, pts, [PAL.fire1, PAL.fire3, PAL.teal4, PAL.white], 1, v);
        });
        await wait(sc, 34);
      }
      ras.destroy();
    })(),
  );
  if (tile && tile.active) {
    bg(tile.pulse(PAL.white, 160));
    await wait(sc, 60);
    // the new card starts down while the old one is still burning
    bg(tile.dissolve(380).then(() => tile.destroy()));
    await wait(sc, 140);
  } else await wait(sc, 220);
  field.forget(d.uid);
  if (g) bg(fx.cardToGraveyard(ctx, { owner: g.owner, cardId: d.cardId, from: { x: at.x, y: at.y - 4 } }));
}

registerCardHook('volcano_arena', 'activate', async (ctx) => {
  if (V3_A5_A) return activateV3(ctx); // A5-A (A5_PLAN §3.2): the v3 scene, end of this file
  const ev = ctx.ev;
  const run0 = fx.resolutionRun(ctx);
  const oldDi = idxOf(ctx, run0, (e) => e.type === 'destroy' && e.location === 'field');
  const oldFi = idxOf(ctx, run0, (e) => e.type === 'fieldSpell' && !e.active && e.uid !== ev.uid);
  const fi = idxOf(ctx, run0, (e) => e.type === 'fieldSpell' && e.active && e.uid === ev.uid);
  // replacing a field spell: the strike on the old card is part of the showcase, so it hovers less
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: 'hand', zone: null, hold: oldDi >= 0 ? 200 : 320 });
  if (oldDi >= 0) {
    await breakOldField(ctx, op.center, oldDi);
    // the arena stays hot (a volcano replaces a volcano): its cooling is skipped; anything else
    // plays through the normal chain
    const oldF = evAt(ctx, oldFi, 'fieldSpell');
    if (oldF && oldF.cardId === 'volcano_arena') ctx.consumeAt(oldFi);
    else if (oldFi >= 0) await ctx.play(oldFi);
  }
  await op.land({ spot: 'field', index: 0 });
  if (fi >= 0) await ctx.play(fi);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 400);
});

/** The arena transforms (active) or cools back (inactive). Owns the statChanges that follow. */
registerCardHook('volcano_arena', 'field', async (ctx) => {
  if (V3_A5_A) return fieldV3(ctx); // A5-A
  const ev = ctx.ev;
  const sc = ctx.scene;
  const board = ctx.views.board;
  if (!ev.active) {
    // only cool down if no other volcano took its place in this batch
    const stillHot = ctx.after.players.some((p) => p.fieldSpell && ctx.after.cards[p.fieldSpell.uid].cardId === 'volcano_arena');
    if (stillHot) return;
    const stats = takeStatChanges(ctx);
    ctx.sfx('fieldChange', { volume: 0.5, pitch: 1.2 });
    const origin = zoneXY(ev.player, 'field', 0);
    void lightFlash(sc, origin.x, origin.y, PAL.steel, fs(40), 600, { intensity: 0.5 });
    const jobs: Promise<unknown>[] = [board.setTheme('normal', true), setVolcanoAmbience(sc, false), wait(sc, 600)];
    for (const e of stats) {
      const u = ctx.unit(e.uid);
      if (!u) continue;
      jobs.push(coolDown(ctx, u, e, 120 + Math.round(Math.hypot(u.home.x - origin.x, u.home.y - origin.y) * 1.2)));
    }
    await fx.all(jobs);
    return;
  }
  const origin = zoneXY(ev.player, 'field', 0);
  const stats = takeStatChanges(ctx);
  // ERUPTION at the field tile
  ctx.sfx('fieldChange', { volume: 0.95 });
  ctx.sfx('earthQuake', { volume: 0.55 });
  ctx.sfx('fireBurst', { volume: 0.8, pitch: 0.8 });
  const tile = ctx.views.field.tileAt(ev.player, 'field', 0);
  if (tile) bg(tile.pulse(PAL.fire4, 420));
  bg(explosion(sc, origin.x, origin.y - 4, RAMPS.fire, 1.3, unitDepth(origin.y) + 2));
  bg(flash(sc, 110, PAL.fire4, 0.28));
  // (v2) the eruption blasts firelight over the arena; the floodlights duck under the red sky
  void lightFlash(sc, origin.x, origin.y - 20, PAL.fire4, fs(84), 900, { floorY: origin.y, ring: true, intensity: 1.2, air: 0.5 });
  void lightDimFor(sc, 0.35, 500, 200, 700);
  bg(ctx.focus(origin, { zoom: 1.05, ms: 140, pan: 0.2 }).then(() => wait(sc, 120)).then(() => ctx.unfocus(700)));
  const theme = board.setTheme('volcano', true, ev.player);
  bg(setVolcanoAmbience(sc, true));
  // the lava front reaches each monster in turn
  const flares: Promise<unknown>[] = [];
  for (const e of stats) {
    const u = ctx.unit(e.uid);
    if (!u) continue;
    const d = Math.hypot(u.home.x - origin.x, u.home.y - origin.y);
    flares.push(heatUp(ctx, u, e, frontDelay(d)));
  }
  await fx.all([theme, ...flares, wait(sc, 900)]);
});


// ================================================================ the v3 look (V3_A5_A)
//
// Lane A5-A step A-3 (docs/v3/A5_PLAN.md §3.2: "zemin kontrollü dönüşür, güç iki yöne değişir").
// Behind V3_A5_A only (the two hooks above hand over on their first line); v1 and the plain v3 look
// run the code above unchanged.
//
//   0        the A2 opening (spellOpeningV3; a field spell always comes from the hand), hold 100
//   [old]    REPLACE: the old field card cracks white for two frames on its tile, ash pixels crumble
//            off it and the card itself leaves for its owner's graveyard (cardLeaves); the new card
//            lands only after that (+≈300 ms) — volcanoCool (short), mark `replace`
//   +0       LAND (landV3): no rotation — the card stands on its field pad and lies down; the pad
//            burns three steps of the fire ramp (board.flashTile) — volcanoSlam, mark `land`
//   +0       ERUPT (the 'field' hook; fix round 1, A5A-C1-01: at v1's footprint): the lava jet bursts out
//            of the pad in whole steps (spellmotifs-v3 ERUPTION_STEPS: 3 up, 4 held, 3 down, the pool
//            cools) — flaring 13 → 37 px wide and 55 px tall, fire1–fire4 bands, a white core, no
//            outline, a splash-finger crown and spray leaning outward; 12 big gobs in four groups on
//            arcs up to 40 px out, landing as cooling embers; a two-ring stepped floor shock to 93 × 47;
//            a fire light flash (2 frames bright) then a faint lasting pool (the ambience's).
//            The calm arena's lava starts from this pad (board.setTheme, unchanged). Today's camera
//            lean at this beat is KEPT (user decision): the same ctx.focus call, target and timing.
//            volcanoErupt (duck 0.6) + lavaCreep (sustained), mark `erupt`
//   front    as the lava front reaches a FIRE / WATER monster's zone (frontArrivalMs: the calm
//            arena's own crack field), its beat — by distance, mark `front:<uid>`: FIRE — a 1-px
//            fire2 → fire3 → fire4 edge climbs its outline in three steps (rimClimb: only the pixels
//            just outside the body), 4–6 embers, "+500" on the edge's top frame (FIRE_LEAD after the
//            start), the badge rolls, then the flame tongues (auras-v3) — heatFlare; WATER — 3–4 steam
//            threads off its top edge, "−300" at once, the badge drops, then the steam aura —
//            steamHiss. Fix round 2 (A5A-C2-01): spaced by what the player sees (frontSchedule): the
//            NUMBERS ≥ 150 ms apart, the beat sounds ≥ 100 ms apart, the first beat ≥ 150 ms after the
//            eruption; each number's spot keeps its slam clear of the numbers already up (numberSpot).
//            Each pad lights one tone. v3 art plays a short pose (roar 0-1-2-1-0, hit 0-1-0); the old
//            art is never posed, tinted, scaled or moved.
//   end      when the spread has covered the board (erupt + 900 ms, FRONT_SPREAD_MS) and the last
//            number + 120 ms: lavaCreep stops in 120 ms, the input comes back
// REPLACE (a volcano replacing a volcano; fix round 2, A5A-C2-03): the arena stays hot — its lava is set
//            to the new origin without the spread (no cold frame, no re-ignition); the eruption, the
//            board's own 1150-ms shake (kept: same call, same beat) and a fire flare on the new pad play.
// COOL ('field' inactive: Uçurum Büyücüsü swallows the arena) — fix round 1, A5A-C1-04: nothing plays
// before its cause; from the frame the field card cracks under the tendril (untilCardCracks: its tile's
// jolt, capped at 1.5 s): volcanoCool; the lava cools on the calm arena (its theme change not waited for);
// from COOL_FIRST on, by distance, ≥ 150 ms apart, each monster's flames shrink to smoke / its steam stops
// (the auras' own end) and its badge rolls back with a single number (not waited for: the input comes
// back as the cracked card lands — spVolcanoCool 1.52 s).
// Nothing here adds a full-screen flash, a dim, a whole-sprite tint or a camera move.

const ASH_FX = [PAL.night2, PAL.stone1, PAL.stone2, PAL.stone3] as const;
/** The replace beat (the old card cracks and leaves) before the new card may land. */
const REPLACE_MS = 300;
/** After the last front beat the creep sound and the scene run this much longer. */
const AFTER_LAST_BEAT = 120;
/**
 * A FIRE beat's number comes on its edge's top frame: rimClimb's three 50-ms steps reach the top step 100 ms in,
 * shown on the 7th–8th rendered frame (measured: heatFlare → "+500" 133 ms). A WATER beat's number shows at once.
 */
const FIRE_LEAD = 133;
/**
 * The numbers' spacing as scheduled: A5 §3.2's 150 ms plus one frame, as every beat's start lands on the
 * first frame at or after its time (measured, the numbers stay ≥ 150 ms apart).
 */
const NUMBER_GAP = 167;
/** The first front beat starts at least this long after the eruption (its sounds never stack on volcanoErupt). */
const ERUPT_CLEAR = 150;
/** The board's own shake on an animated volcano theme (BoardViewCalm.setTheme): kept on a replace. */
const THEME_SHAKE = { ms: 1150, px: 2 } as const;
/**
 * The first cooling beat (ms after the cooling starts — fix round 1: the moment the field card cracks, not
 * the Magus' lock-on): with the calm arena's own first visible cooling step (its neon trims cool at 250 ms,
 * its lava then steps down at ≈ 400 / 570 / 700 / 800 ms; BoardViewCalm: Quad.In, 900 ms), so the flames
 * gutter out as the arena cools; the beats follow by distance (a quarter of the front's spread), ≥ 150 ms
 * apart, and the badges roll on while the cracked card flies (≈ 600 ms after the crack).
 */
const COOL_FIRST = 200;
/** The cooling waits for its field card's crack at most this long (a destroy with no crack still cools). */
const COOL_WAIT_CAP = 1500;

/** Resolve after `n` rendered frames (never fewer, at any speed). */
function renderedFrames(scene: Phaser.Scene, n: number): Promise<void> {
  return new Promise((resolve) => {
    let k = 0;
    onFrame(scene, (dt) => {
      if (dt > 0) k++;
      if (k >= n) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** A short pose on v3 art: show `frames` of `anim` one after another (each for its own hold), then rest. */
async function poseRun(u: MonsterUnit, anim: AnyMonsterAnim, frames: readonly number[]): Promise<void> {
  const sc = u.scene;
  if (!u.has(anim)) return;
  u.posed = true;
  for (const f of frames) {
    if (u.retired || !u.sprite.active) return;
    if (!u.pose(anim, f)) break;
    await wait(sc, Math.max(34, u.rangeMs(anim, f, f + 1)));
  }
  if (u.retired || !u.sprite.active) return;
  u.posed = false;
  u.settle();
}

/** A number of this scene already up: its spot (impactNumber's centre) and its resting width. */
export interface NumberSpot extends XY {
  w: number;
}
/** impactNumber's glyph widths (vfx/numbers GLYPHS: '+' 6, '−' 5, '1' 6, other digits 7). */
function glyphW(ch: string): number {
  return ch === '-' ? 5 : ch === '+' || ch === '1' ? 6 : 7;
}
/** A size-1 impactNumber's resting box: its glyphs, 1-px gaps and the outline / shadow (+3); 14 px high. */
export function numberBox(text: string): { w: number; h: number } {
  const chars = [...text];
  return { w: chars.reduce((a, ch) => a + glyphW(ch), 0) + (chars.length - 1) + 3, h: 14 };
}
/** How far a number has jumped up by the time the next beat's number slams in (impactNumber: 7 px in 140 ms). */
const NUMBER_JUMP = 7;
/**
 * Does number `p` clash with `q` (already up)? Its slam — one size up, (2w × 28), for two frames — must stay
 * clear of q's resting box risen by its jump, and its own resting box of q's (fix round 2, A5A-C2-01: the
 * old check knew neither box, so a "−300" slammed over the "+500" next to it).
 */
export function numbersClash(p: NumberSpot, q: NumberSpot): boolean {
  const H = 14;
  // (q has jumped up by the time p shows: the beats' numbers are ≥ 150 ms apart; both rise alike after)
  const dy = Math.abs(p.y - (q.y - NUMBER_JUMP));
  const slam = Math.abs(p.x - q.x) < (2 * p.w + q.w) / 2 + 1 && dy < (2 * H + H) / 2 + 1;
  const rest = Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 1 && dy < H + 1;
  return slam || rest;
}
/** A number may sit at most this much lower than its spot (it starts 4 px over the head: no lower than its top). */
const NUMBER_DOWN_MAX = 6;
/**
 * Where a beat's number goes: its monster's top, moved the least it takes (a few px down, sideways away
 * from the number it would meet, up, or the other way) so that neither its slam nor its resting box covers
 * a number of this scene already up (numbersClash). Records the spot.
 */
export function numberSpot(spots: NumberSpot[], x: number, y: number, text: string): XY {
  const w = numberBox(text).w;
  const p0 = { x: Math.round(x), y: Math.round(y), w };
  const clear = (p: NumberSpot) => p.x >= 16 && p.x <= 624 && spots.every((q) => !numbersClash(p, q));
  let best: NumberSpot = p0;
  const hit = spots.find((q) => numbersClash(p0, q));
  if (hit) {
    const side = p0.x >= hit.x ? 1 : -1;
    best = p0;
    for (let d = 1; d <= 72; d++) {
      const tries: NumberSpot[] = [
        ...(d <= NUMBER_DOWN_MAX ? [{ x: p0.x, y: p0.y + d, w }] : []),
        { x: p0.x + side * d, y: p0.y, w },
        { x: p0.x, y: p0.y - d, w },
        { x: p0.x - side * d, y: p0.y, w },
      ];
      const ok = tries.find(clear);
      if (ok) {
        best = ok;
        break;
      }
    }
  }
  const p = { x: Math.max(16, Math.min(624, best.x)), y: best.y, w };
  spots.push(p);
  return p;
}

/** The direction and size of a stat change. */
function statDelta(e: StatEv): { up: boolean; delta: number } {
  const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
  return { up, delta: Math.abs(e.atk - e.prevAtk) || Math.abs(e.def - e.prevDef) };
}

/** Points along the top edge of a sprite's silhouette (for embers), or its 'top' point. */
function topEdge(u: MonsterUnit, n: number): XY[] {
  const sil = silhouetteOf(u.sprite);
  if (!sil) return [u.worldPoint('top')];
  const out: XY[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(sil.left + ((i + 0.5) / n) * (sil.right - sil.left));
    const y = sil.topAt(x);
    if (y !== null) out.push({ x, y: y - 1 });
  }
  return out.length ? out : [u.worldPoint('top')];
}

/**
 * The shock of the eruption on the floor (fix round 1: ≥ 90 × 44 px, as wide as the old ring): two 1-px
 * iso rings (2:1) stepping out over the pad two rendered frames a step, down the fire ramp as they go —
 * the first one 2 px thick for its first two steps (fire4 over fire2), the second one a step behind.
 */
export const SHOCK_RINGS: readonly { start: number; rx: readonly number[]; tone: readonly number[] }[] = [
  { start: 0, rx: [16, 26, 36, 46], tone: [PAL.fire4, PAL.fire3, PAL.fire3, PAL.fire2] },
  { start: 1, rx: [12, 22, 32, 40], tone: [PAL.fire3, PAL.fire2, PAL.fire2, PAL.fire1] },
];
function padShock(scene: Phaser.Scene, at: XY): Promise<void> {
  const R = Math.max(...SHOCK_RINGS.map((r) => Math.max(...r.rx)));
  const ras = Raster.around(scene, at.x, at.y, R * 2 + 6, R + 6, DEPTH.TILE_FX + 3);
  const lx = at.x - ras.x + 0.5;
  const ly = at.y - ras.y + 0.5;
  let frame = 0;
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      if (dt > 0) frame++;
      ras.begin();
      let live = false;
      for (const r of SHOCK_RINGS) {
        // two rendered frames per step (one step per frame at most at any speed)
        const k = Math.floor(frame / 2) - r.start;
        if (k < 0) {
          live = true;
          continue;
        }
        if (k >= r.rx.length) continue;
        live = true;
        const rx = r.rx[k];
        ras.pc.ellipseRing(lx, ly, rx, rx / 2, r.tone[k]);
        if (r.start === 0 && k < 2) ras.pc.ellipseRing(lx, ly, rx - 1, (rx - 1) / 2, PAL.fire2);
      }
      ras.end();
      if (!live) {
        ras.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
}

/**
 * The gobs of the eruption (≤ 40 px out, 12 in all; reduced motion halves them): four groups of three
 * leave the crown's two sides on the same frame — a high, far pair of groups and a low, near pair — so
 * they burst out as a spray, never as a string of beads.
 */
export const ERUPT_GOB_GROUPS: readonly { side: -1 | 1; apex: number; ms: number; reach: readonly number[]; a0: number }[] = [
  { side: -1, apex: 20, ms: 340, reach: [40, 34, 37], a0: 2.2 },
  { side: 1, apex: 20, ms: 340, reach: [38, 40, 32], a0: -0.9 },
  { side: -1, apex: 9, ms: 250, reach: [24, 19, 27], a0: 1.6 },
  { side: 1, apex: 9, ms: 250, reach: [22, 28, 18], a0: -0.2 },
];
export const ERUPT_GOBS = ERUPT_GOB_GROUPS.reduce((n, g) => n + g.reach.length, 0);

/**
 * The eruption on the pad (fix round 1, A5 §3.2 PATLAMA at the old footprint): the lava jet bursting out of
 * the pad step by step (spellmotifs-v3 ERUPTION_STEPS: 3 up, 4 held, 3 down, the pool cooling) — at most
 * one new step per rendered frame at any speed —, the two-ring floor shock, and on the first held step
 * 12 big gobs leave its crown on arcs up to 40 px out round the pad, landing as cooling embers.
 * Resolves when the pool has cooled.
 */
async function eruptOnPad(scene: Phaser.Scene, pad: XY, seed: number): Promise<void> {
  const W = 84;
  const ras = new Raster(scene, pad.x - W / 2, pad.y - ERUPTION_TOP - 4, W, ERUPTION_TOP + 18, unitDepth(pad.y) + 1);
  const cx = pad.x - ras.x;
  const by = pad.y - ras.y;
  bg(padShock(scene, pad));
  let shown = -1;
  let gobs = false;
  // each step's end (ms after the blast, 1×)
  const ends: number[] = [];
  let acc = 0;
  for (const s of ERUPTION_STEPS) ends.push((acc += s.ms));
  await new Promise<void>((resolve) => {
    onFrame(scene, (dt, el) => {
      // the step due now, but never more than one new step per rendered frame (SÜ-3)
      let due = ends.findIndex((t) => el < t);
      if (due < 0) due = ERUPTION_STEPS.length;
      if (due > shown && (dt > 0 || shown < 0)) shown = Math.min(due, shown + 1);
      if (shown >= ERUPTION_STEPS.length) {
        ras.destroy();
        resolve();
        return false;
      }
      ras.begin();
      paintEruption(ras.pc, cx, by, shown, { phase: Math.floor(el / 34) });
      ras.end();
      if (!gobs && shown >= ERUPTION_GOB_STEP) {
        gobs = true;
        ERUPT_GOB_GROUPS.forEach((g, gi) => {
          const n = fxCount(g.reach.length);
          // each group's landings spread over a half turn on its own side of the pad (iso 2:1)
          const to = g.reach.slice(0, n).map((r, i) => {
            const a = g.a0 + i * 0.75;
            return { x: Math.round(pad.x + Math.cos(a) * r), y: Math.round(pad.y + Math.sin(a) * r * 0.5) };
          });
          bg(dropArcs(scene, { from: { x: pad.x + g.side * 8, y: pad.y - 56 }, to, n, kind: 'lava', gob: 'big', apex: g.apex, ms: g.ms, gap: 17, depth: unitDepth(pad.y) + 2, seed: seed + gi * 7 }));
        });
      }
      return true;
    });
  });
}

/** The old field card cracks, crumbles and leaves for its owner's graveyard (A5 §3.2 [Değiştirme]). */
async function replaceOldV3(ctx: AnyCtx, di: number): Promise<void> {
  const sc = ctx.scene;
  const d = evAt(ctx, di, 'destroy');
  if (!d) return;
  ctx.consumeAt(di);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === d.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
  const g = evAt(ctx, gi, 'toGraveyard');
  if (gi >= 0) ctx.consumeAt(gi);
  const field = ctx.views.field;
  const { tile } = field.release(d.uid);
  const home = tile ? { x: Math.round(tile.home.x), y: Math.round(tile.home.y) } : zoneXY(d.player, 'field', 0);
  playV3('volcanoCool', { volume: 0.7, pan: panAt(home.x) }); // mark `replace`
  // two frames of a white crack across the lying card's face
  const depth = tile && tile.active ? tile.depth + 0.5 : DEPTH.CARD_ON_TILE + 1;
  const crack = Raster.around(sc, home.x, home.y, 48, 28, depth);
  const path = crackPath({ x: home.x - 15, y: home.y + 1 }, { x: home.x + 15, y: home.y - 2 }, d.uid * 7 + 3, 2);
  crack.begin();
  for (const q of path) crack.px(q.x, q.y, PAL.white);
  // one short branch off the middle, down toward the near edge
  const mid = path[Math.floor(path.length / 2)];
  for (const q of crackPath(mid, { x: mid.x + 3, y: mid.y + 6 }, d.uid * 7 + 9, 1)) crack.px(q.x, q.y, PAL.white);
  crack.end();
  await renderedFrames(sc, 2);
  crack.destroy();
  // ash crumbles off it: the card's own pixels (its rim and a sprinkle) in ash tones, falling
  if (tile && tile.active) {
    const cp = tile.currentPixels();
    const pts: { x: number; y: number; c: number }[] = [];
    let k = 0;
    for (let y = 0; y < cp.px.h; y++)
      for (let x = 0; x < cp.px.w; x++) {
        if (cp.px.alpha(x, y) === 0) continue;
        const edge = cp.px.alpha(x - 1, y) === 0 || cp.px.alpha(x + 1, y) === 0 || cp.px.alpha(x, y - 1) === 0 || cp.px.alpha(x, y + 1) === 0;
        if (!(edge ? k % 5 === 0 : k % 41 === 0)) {
          k++;
          continue;
        }
        k++;
        const c = cp.px.get(x, y) ?? PAL.stone2;
        const lum = ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
        pts.push({ x: cp.x + x, y: cp.y + y, c: lum > 150 ? PAL.stone3 : lum > 70 ? PAL.stone2 : PAL.stone1 });
      }
    bg(shards(sc, { from: pts.slice(0, 28), ramp: ASH_FX, mode: 'fall', floor: home.y + 7, restMs: 60, depth: DEPTH.CARD_ON_TILE + 9, seed: d.uid * 13 + 1 }));
  }
  // the card leaves for its owner's graveyard (card continuity; born on its tile); an old volcano's pad
  // stops glowing with it (the ambience itself stays: the new volcano keeps the arena hot)
  const leaving = g ? cardLeaves(ctx, { owner: g.owner, cardId: d.cardId, from: home, tile }) : Promise.resolve();
  if (d.cardId === 'volcano_arena' && volcanoAmbienceOnV3(sc)) bg(volcanoAmbienceV3(sc, true, { pad: null }));
  if (!g && tile && tile.active) tile.destroy();
  field.forget(d.uid);
  await wait(sc, REPLACE_MS - 34);
  // the two landings stay ≥ 150 ms apart: the new card's lie-down ends ≥ 180 ms after this one lands
  await leaving;
}

/** activate, the v3 look. */
async function activateV3(ctx: CinematicContext<Extract<GameEvent, { type: 'activate' }>>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const oldDi = idxOf(ctx, run0, (e) => e.type === 'destroy' && e.location === 'field');
  const oldFi = idxOf(ctx, run0, (e) => e.type === 'fieldSpell' && !e.active && e.uid !== ev.uid);
  const fi = idxOf(ctx, run0, (e) => e.type === 'fieldSpell' && e.active && e.uid === ev.uid);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: 'hand', zone: null, hold: 100 });
  if (oldDi >= 0) {
    await replaceOldV3(ctx, oldDi);
    // a volcano replacing a volcano: the arena stays hot (its cooling is skipped)
    const oldF = evAt(ctx, oldFi, 'fieldSpell');
    if (oldF && oldF.cardId === 'volcano_arena') ctx.consumeAt(oldFi);
    else if (oldFi >= 0) await ctx.play(oldFi);
  }
  const pad = zoneXY(ev.player, 'field', 0);
  const land = () => {
    // the pad burns three steps of the fire ramp under the card lying down
    playV3('volcanoSlam', { volume: 0.85, pan: panAt(pad.x) }); // mark `land`
    bg(ctx.views.board.flashTile(ev.player, 'field', 0, PAL.fire3, 150));
  };
  if (op.landV3) await op.landV3({ spot: 'field', index: 0, ms: 90, lieMs: 90, onLand: land });
  else await op.land({ spot: 'field', index: 0 });
  if (fi >= 0) await ctx.play(fi);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 400);
}

/** A FIRE beat (the edge climbs, its number on the climb's top frame) — else a WATER one (steam, the number at once). */
function fireBeat(u: MonsterUnit, e: StatEv): boolean {
  return u.attribute === 'FIRE' || (u.attribute !== 'WATER' && statDelta(e).up);
}

/**
 * One monster's beat as the lava front reaches it (see the section header). `lead`: when its number shows,
 * after the start (frontSchedule spaced the numbers by it: a FIRE beat's number never comes before it).
 */
async function frontBeatV3(ctx: AnyCtx, u: MonsterUnit, e: StatEv, spots: NumberSpot[], lead: number): Promise<void> {
  const sc = ctx.scene;
  const { up, delta } = statDelta(e);
  const fire = fireBeat(u, e);
  const water = !fire && (u.attribute === 'WATER' || !up);
  const text = (up ? '+' : '-') + delta;
  const shown = !u.retired && u.sprite.active && u.sprite.visible && u.sprite.alpha > 0.3;
  if (!shown) {
    await u.setStats(e.atk, e.def, false);
    if (!u.retired && !u.hasAura('volcano') && (u.attribute === 'FIRE' || u.attribute === 'WATER')) u.setAura('volcano', u.attribute === 'FIRE' ? flameAura(sc, u) : steamAura(sc, u));
    return;
  }
  const pan = panAt(u.home.x);
  const v3art = hasMonsterArtV3(u.cardId) && u.position === 'attack';
  // the monster's pad lights one tone (mark `front:<uid>`)
  void lightFlash(sc, u.home.x, u.home.y, fire ? PAL.fire3 : PAL.mist, fs(22), 420, { floorY: u.home.y, intensity: 0.6 });
  if (fire) {
    playV3('heatFlare', { volume: 0.85, pan });
    embers(sc, topEdge(u, 5), { n: 5, up: 74, spread: 22, depth: u.sprite.depth + 1, seed: u.uid * 31 + 7 });
    if (v3art) bg(poseRun(u, 'roar', [0, 1, 2, 1, 0]));
    // the edge climbs feet → head in three 50-ms steps; the number on its top frame — and never before
    // `lead` (the schedule's spacing: fix round 2, A5A-C2-01)
    let topFrame!: () => void;
    const top = new Promise<void>((r) => (topFrame = r));
    bg(rimClimb(sc, u.sprite, { ramp: [PAL.fire2, PAL.fire3, PAL.fire4], stepMs: 50, holdMs: 120, fadeMs: 120, depth: u.sprite.depth + 0.6, onPeak: () => topFrame() }));
    await Promise.race([Promise.all([top, wait(sc, lead)]), wait(sc, lead + 50)]);
    if (u.retired || !u.sprite.active) return;
    const t = u.worldPoint('top');
    const n = numberSpot(spots, t.x, numberUnderBar(t.y - 4).y, text);
    bg(impactNumber(sc, n.x, n.y, delta, { kind: up ? 'heal' : 'damage', rise: numberUnderBar(n.y).rise }));
    void u.setStats(e.atk, e.def, true);
    if (!u.retired && !u.hasAura('volcano')) u.setAura('volcano', flameAura(sc, u));
    return;
  }
  if (water) {
    playV3('steamHiss', { volume: 0.85, pan });
    bg(steamThreads(sc, u.sprite, { n: 4, life: 420, seed: u.uid * 29 + 3 }));
    if (v3art) bg(poseRun(u, 'hit', [0, 1, 0]));
    if (lead > 0) await wait(sc, lead);
    const t = u.worldPoint('top');
    const n = numberSpot(spots, t.x, numberUnderBar(t.y - 4).y, text);
    bg(impactNumber(sc, n.x, n.y, delta, { kind: up ? 'heal' : 'damage', rise: numberUnderBar(n.y).rise }));
    void u.setStats(e.atk, e.def, true);
    if (!u.retired && !u.hasAura('volcano')) u.setAura('volcano', steamAura(sc, u));
  }
}

/** One monster as the arena cools: its aura ends (flames → smoke, steam stops), its badge rolls back. */
function coolBeatV3(ctx: AnyCtx, u: MonsterUnit, e: StatEv, spots: NumberSpot[]): Promise<void> {
  const sc = ctx.scene;
  const { up, delta } = statDelta(e);
  u.setAura('volcano', null);
  if (u.retired || !u.sprite.active || !u.sprite.visible) return u.setStats(e.atk, e.def, false);
  const t = u.worldPoint('top');
  if (delta > 0) {
    const n = numberSpot(spots, t.x, numberUnderBar(t.y - 4).y, (up ? '+' : '-') + delta);
    bg(impactNumber(sc, n.x, n.y, delta, { kind: up ? 'heal' : 'damage', rise: numberUnderBar(n.y).rise }));
  }
  // the badge rolls from this beat (its 520-ms roll is not waited for: the arena's own cooling and the
  // destroyed card's flight carry the scene meanwhile, as the eruption's beats do)
  void u.setStats(e.atk, e.def, true);
  return Promise.resolve();
}

/** The 'field' hook, the v3 look: ERUPT + the front (active), or the cooling (inactive). */
async function fieldV3(ctx: CinematicContext<Extract<GameEvent, { type: 'fieldSpell' }>>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const board = ctx.views.board;
  const origin = zoneXY(ev.player, 'field', 0);
  const pad = { x: Math.round(origin.x), y: Math.round(origin.y) };
  if (!ev.active) {
    // only cool down if no other volcano took its place in this batch
    const stillHot = ctx.after.players.some((p) => p.fieldSpell && ctx.after.cards[p.fieldSpell.uid].cardId === 'volcano_arena');
    if (stillHot) return;
    const stats = takeStatChanges(ctx);
    // fix round 1 (C1-04): the effect after its cause — Uçurum Büyücüsü plays this the moment its mark locks
    // on the card (strikes-a/abyss_magus.ts), so the arena waits for its card to crack under the tendril
    // (the tile's jolt) before it cools; the board's own 900-ms cooling then runs on by itself
    await untilCardCracks(sc, ctx.views.field.tileAt(ev.player, 'field', 0), COOL_WAIT_CAP);
    playV3('volcanoCool', { volume: 0.9, pan: panAt(pad.x) });
    void lightFlash(sc, pad.x, pad.y, PAL.stone3, fs(26), 380, { floorY: pad.y, intensity: 0.45 });
    bg(volcanoAmbienceV3(sc, false));
    bg(board.setTheme('normal', true));
    const jobs: Promise<unknown>[] = [];
    const items = stats.map((e) => ({ e, u: ctx.unit(e.uid) }));
    const times = beatTimes(items.map((x) => (x.u ? Math.round(frontArrivalMs(ev.player, x.u.player, x.u.zone) / 4) : 0)));
    const spots: NumberSpot[] = [];
    items.forEach((x, i) => jobs.push(x.u ? wait(sc, COOL_FIRST + times[i]).then(() => coolBeatV3(ctx, x.u!, x.e, spots)) : Promise.resolve()));
    await fx.all(jobs);
    return;
  }
  const stats = takeStatChanges(ctx);
  // ---- ERUPT (mark `erupt`)
  playV3('volcanoErupt', { volume: 1, pan: panAt(pad.x) });
  const creep = startV3('lavaCreep', { volume: 0.8, pan: panAt(pad.x) });
  // the fire's light on the pad: a short hot flash as wide as the old one's, then the ambience's lasting pool
  void lightFlash(sc, pad.x, pad.y - 10, PAL.fire4, fs(64), 380, { floorY: pad.y, intensity: 1.35, ring: true });
  // today's lean at this beat (kept by the user's decision: same call, same target, same timing)
  bg(ctx.focus(origin, { zoom: 1.05, ms: 140, pan: 0.2 }).then(() => wait(sc, 120)).then(() => ctx.unfocus(700)));
  if (board.theme === 'volcano') {
    // REPLACE (fix round 2, A5A-C2-03): a volcano replaced a volcano — the arena is already hot and stays hot:
    // its lava takes the new origin at once (no spread from cold: no cold frame, no re-ignition); the board's
    // own shake of the eruption is kept (the same call, the same beat) and the new pad flares like the board's
    // own pad flash of an animated theme
    bg(board.setTheme('volcano', false, ev.player));
    bg(shake(sc, THEME_SHAKE.ms, THEME_SHAKE.px));
    bg(board.flashTile(ev.player, 'field', 0, PAL.fire3, 380));
  } else bg(board.setTheme('volcano', true, ev.player));
  // the ambience (embers off the seams, ash, the pad's lasting light) once the lava has spread
  bg(volcanoAmbienceV3(sc, true, { pad: ev.player, delayMs: 600 }));
  bg(eruptOnPad(sc, pad, ev.uid * 17 + 5));
  // ---- the front: each FIRE / WATER monster's beat as the lava reaches its zone, spaced by what the player
  // sees (frontSchedule: the numbers ≥ 150 ms apart, the sounds ≥ 100 ms, the first ≥ 150 ms after the eruption)
  const items = stats.map((e) => ({ e, u: ctx.unit(e.uid) })).filter((x): x is { e: StatEv; u: MonsterUnit } => !!x.u);
  const sched = frontSchedule(items.map((x) => ({ arrival: frontArrivalMs(ev.player, x.u.player, x.u.zone), lead: fireBeat(x.u, x.e) ? FIRE_LEAD : 0 })), { first: ERUPT_CLEAR, gap: NUMBER_GAP });
  const spots: NumberSpot[] = [];
  const beats = items.map((x, i) => wait(sc, sched[i].start).then(() => frontBeatV3(ctx, x.u, x.e, spots, sched[i].show - sched[i].start)));
  const last = sched.length ? Math.max(...sched.map((b) => b.show)) : 0;
  await wait(sc, Math.max(FRONT_SPREAD_MS, last + AFTER_LAST_BEAT));
  creep.stop(120);
  await fx.all(beats);
}
