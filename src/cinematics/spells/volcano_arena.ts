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
import { TEX, flash, wait } from '../../vfx/core';
import { damageNumber } from '../../vfx/numbers';
import { Raster, Sparks, addGlow, boltPath, explosion, floorRing, glowStroke, onFrame, rr, run, setVolcanoAmbience, spriteBox } from '../../vfx/setpieces';
import { flameAura, steamAura } from '../../duel/auras';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { bg, evAt, idxOf, relax, spellOpening, SHOW_FLOOR, fs, lightBeam, lightFlash } from './_kit';
// ---- the v3 look (lane A5-A, V3_A5_A; see the section at the end of the file)
import type { AnyMonsterAnim } from '../../art/types';
import { hasMonsterArtV3 } from '../../art/monsters';
import { crackPath } from '../../art/spellmotifs-v3';
import { V3_A5_A } from '../../view/v3flags';
import { dropArcs, embers, rimClimb, shards, silhouetteOf, steamThreads, steppedColumn } from '../_v3/spellfx';
import { panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { impactNumber } from '../_v3/number';
import { cardLeaves } from '../_v3/card';
import { FRONT_SPREAD_MS, beatTimes, frontArrivalMs, volcanoAmbienceOnV3, volcanoAmbienceV3 } from './_volcano_v3';

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
//   +0       ERUPT (the 'field' hook): a stepped lava column on the pad (8 px, 3 frames up, 3 down,
//            fire1–fire4 bands, white core, no outline), 6–10 lava gobs on ≤ 30-px arcs, a two-ring
//            stepped shock on the pad, a fire light flash then a faint lasting pool (the ambience's).
//            The calm arena's lava starts from this pad (board.setTheme, unchanged). Today's camera
//            lean at this beat is KEPT (user decision): the same ctx.focus call, target and timing.
//            volcanoErupt (duck 0.6) + lavaCreep (sustained), mark `erupt`
//   front    as the lava front reaches a FIRE / WATER monster's zone (frontArrivalMs: the calm
//            arena's own crack field), its beat — by distance, ≥ 150 ms apart (beatTimes), mark
//            `front:<uid>`: FIRE — a 1-px fire2 → fire3 → fire4 edge climbs its outline in three
//            steps (rimClimb: only the pixels just outside the body), 4–6 embers, "+500" on the
//            edge's top frame, the badge rolls, then the flame tongues (auras-v3) — heatFlare;
//            WATER — 3–4 steam threads off its top edge, "−300", the badge drops, then the steam
//            aura — steamHiss. Each pad lights one tone. v3 art plays a short pose (roar 0-1-2-1-0,
//            hit 0-1-0); the old art is never posed, tinted, scaled or moved.
//   end      when the spread has covered the board (erupt + 900 ms, FRONT_SPREAD_MS) and the last
//            beat + 120 ms: lavaCreep stops in 120 ms, the input comes back
// COOL ('field' inactive: Uçurum Büyücüsü swallows the arena): volcanoCool; the lava cools on the
// calm arena (unchanged); from its first visible step on (COOL_FIRST), by distance, ≥ 150 ms apart,
// each monster's flames shrink to smoke / its steam stops (the auras' own end) and its badge rolls
// back with a single number.
// Nothing here adds a full-screen flash, a dim, a whole-sprite tint or a camera move.

const ASH_FX = [PAL.night2, PAL.stone1, PAL.stone2, PAL.stone3] as const;
/** The replace beat (the old card cracks and leaves) before the new card may land. */
const REPLACE_MS = 300;
/** After the last front beat the creep sound and the scene run this much longer. */
const AFTER_LAST_BEAT = 120;
/**
 * The first cooling beat (ms after the cooling starts): with the calm arena's own first visible cooling
 * step — its neon trims cool at 250 ms, its lava then steps down at ≈ 400 / 570 / 700 / 800 ms
 * (BoardViewCalm: Quad.In, 900 ms) — so the flames gutter out as the arena cools, not before it; the
 * last badge roll (520 + 180 ms) still ends inside today's cooling time.
 */
const COOL_FIRST = 250;

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

/**
 * Where a beat's number goes: its monster's top, moved sideways when it would land on a number of
 * this scene already up (two neighbours' "+500" / "−300" side by side, never on top of each other;
 * a 4-glyph number is ≈ 23 px wide, 9 px high). Records the spot.
 */
function numberSpot(spots: XY[], x: number, y: number): XY {
  const p = { x: Math.round(x), y: Math.round(y) };
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const q of spots) {
      if (Math.abs(p.x - q.x) < 24 && Math.abs(p.y - q.y) < 10) {
        p.x = q.x + (p.x >= q.x ? 24 : -24);
        moved = true;
      }
    }
    if (!moved) break;
  }
  p.x = Math.max(16, Math.min(624, p.x));
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

/** A two-ring stepped shock on the pad: tile-shaped 1-px rings stepping out and down the fire ramp. */
function padShock(scene: Phaser.Scene, at: XY): Promise<void> {
  const ras = Raster.around(scene, at.x, at.y, 64, 34, DEPTH.TILE_FX + 3);
  const rings = [
    { start: 0, hw: [6, 12, 18, 24], tone: [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2] },
    { start: 2, hw: [4, 9, 14, 19], tone: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] },
  ];
  let frame = 0;
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      if (dt > 0) frame++;
      ras.begin();
      let live = false;
      for (const r of rings) {
        // two rendered frames per step (one step per frame at most at any speed)
        const k = Math.floor((frame - r.start) / 2);
        if (k < 0) {
          live = true;
          continue;
        }
        if (k >= r.hw.length) continue;
        live = true;
        const hw = r.hw[k];
        const hh = Math.round(hw / 2);
        const c = r.tone[k];
        ras.line(at.x - hw, at.y, at.x, at.y - hh, c);
        ras.line(at.x, at.y - hh, at.x + hw, at.y, c);
        ras.line(at.x + hw, at.y, at.x, at.y + hh, c);
        ras.line(at.x, at.y + hh, at.x - hw, at.y, c);
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

/** The eruption on the pad: the stepped lava column, the gobs, the shock. Resolves when the column is down. */
async function eruptOnPad(scene: Phaser.Scene, pad: XY, seed: number): Promise<void> {
  const col = steppedColumn(scene, { kind: 'lava', at: { x: pad.x, y: pad.y + 2 }, rise: [8, 16, 24], stepMs: 17, flowMs: 34, depth: unitDepth(pad.y) + 1 });
  bg(padShock(scene, pad));
  await col.risen;
  // the gobs leave the crown on the top frame and land round the pad (≤ 30 px)
  const targets: XY[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const r = 12 + ((i * 7) % 5) * 4;
    targets.push({ x: Math.round(pad.x + Math.cos(a) * r), y: Math.round(pad.y + Math.sin(a) * r * 0.5) });
  }
  bg(dropArcs(scene, { from: { x: pad.x, y: pad.y - 22 }, to: targets, n: 8, kind: 'lava', apex: 10, ms: 220, gap: 14, depth: unitDepth(pad.y) + 2, seed }));
  await renderedFrames(scene, 2);
  await col.collapse([16, 8, 0], 17);
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

/** One monster's beat as the lava front reaches it (see the section header). */
async function frontBeatV3(ctx: AnyCtx, u: MonsterUnit, e: StatEv, spots: XY[]): Promise<void> {
  const sc = ctx.scene;
  const { up, delta } = statDelta(e);
  const fire = u.attribute === 'FIRE' || (u.attribute !== 'WATER' && up);
  const water = !fire && (u.attribute === 'WATER' || !up);
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
    let peaked = false;
    const peak = () => {
      if (peaked) return;
      peaked = true;
      const t = u.worldPoint('top');
      const n = numberSpot(spots, t.x, t.y - 4);
      bg(impactNumber(sc, n.x, n.y, delta, { kind: up ? 'heal' : 'damage' }));
      void u.setStats(e.atk, e.def, true);
      if (!u.retired && !u.hasAura('volcano')) u.setAura('volcano', flameAura(sc, u));
    };
    // the edge climbs feet → head in three 50-ms steps; the number on its top frame
    await Promise.race([rimClimb(sc, u.sprite, { ramp: [PAL.fire2, PAL.fire3, PAL.fire4], stepMs: 50, holdMs: 120, fadeMs: 120, depth: u.sprite.depth + 0.6, onPeak: peak }), wait(sc, 240).then(peak)]);
    peak();
    return;
  }
  if (water) {
    playV3('steamHiss', { volume: 0.85, pan });
    bg(steamThreads(sc, u.sprite, { n: 4, life: 420, seed: u.uid * 29 + 3 }));
    if (v3art) bg(poseRun(u, 'hit', [0, 1, 0]));
    const t = u.worldPoint('top');
    const n = numberSpot(spots, t.x, t.y - 4);
    bg(impactNumber(sc, n.x, n.y, delta, { kind: up ? 'heal' : 'damage' }));
    void u.setStats(e.atk, e.def, true);
    if (!u.retired && !u.hasAura('volcano')) u.setAura('volcano', steamAura(sc, u));
  }
}

/** One monster as the arena cools: its aura ends (flames → smoke, steam stops), its badge rolls back. */
function coolBeatV3(ctx: AnyCtx, u: MonsterUnit, e: StatEv, spots: XY[]): Promise<void> {
  const sc = ctx.scene;
  const { up, delta } = statDelta(e);
  u.setAura('volcano', null);
  if (u.retired || !u.sprite.active || !u.sprite.visible) return u.setStats(e.atk, e.def, false);
  const t = u.worldPoint('top');
  if (delta > 0) {
    const n = numberSpot(spots, t.x, t.y - 4);
    bg(impactNumber(sc, n.x, n.y, delta, { kind: up ? 'heal' : 'damage' }));
  }
  return u.setStats(e.atk, e.def, true);
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
    playV3('volcanoCool', { volume: 0.9, pan: panAt(pad.x) });
    void lightFlash(sc, pad.x, pad.y, PAL.stone3, fs(26), 380, { floorY: pad.y, intensity: 0.45 });
    bg(volcanoAmbienceV3(sc, false));
    const jobs: Promise<unknown>[] = [board.setTheme('normal', true)];
    const items = stats.map((e) => ({ e, u: ctx.unit(e.uid) }));
    const times = beatTimes(items.map((x) => (x.u ? Math.round(frontArrivalMs(ev.player, x.u.player, x.u.zone) / 2) : 0)));
    const spots: XY[] = [];
    items.forEach((x, i) => jobs.push(x.u ? wait(sc, COOL_FIRST + times[i]).then(() => coolBeatV3(ctx, x.u!, x.e, spots)) : Promise.resolve()));
    await fx.all(jobs);
    return;
  }
  const stats = takeStatChanges(ctx);
  // ---- ERUPT (mark `erupt`)
  playV3('volcanoErupt', { volume: 1, pan: panAt(pad.x) });
  const creep = startV3('lavaCreep', { volume: 0.8, pan: panAt(pad.x) });
  void lightFlash(sc, pad.x, pad.y - 10, PAL.fire4, fs(44), 460, { floorY: pad.y, intensity: 1.1 });
  // today's lean at this beat (kept by the user's decision: same call, same target, same timing)
  bg(ctx.focus(origin, { zoom: 1.05, ms: 140, pan: 0.2 }).then(() => wait(sc, 120)).then(() => ctx.unfocus(700)));
  const theme = board.setTheme('volcano', true, ev.player);
  bg(theme);
  // the ambience (embers off the seams, ash, the pad's lasting light) once the lava has spread
  bg(volcanoAmbienceV3(sc, true, { pad: ev.player, delayMs: 600 }));
  bg(eruptOnPad(sc, pad, ev.uid * 17 + 5));
  // ---- the front: each FIRE / WATER monster's beat as the lava reaches its zone
  const items = stats.map((e) => ({ e, u: ctx.unit(e.uid) }));
  const times = beatTimes(items.map((x) => (x.u ? frontArrivalMs(ev.player, x.u.player, x.u.zone) : 0)));
  const spots: XY[] = [];
  const beats = items.map((x, i) => (x.u ? wait(sc, times[i]).then(() => frontBeatV3(ctx, x.u!, x.e, spots)) : Promise.resolve()));
  const last = items.length ? Math.max(...times) : 0;
  await wait(sc, Math.max(FRONT_SPREAD_MS, last + AFTER_LAST_BEAT));
  creep.stop(120);
  await fx.all(beats);
}
