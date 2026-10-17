// Position change (GAME_DESIGN §6 positionChange):
//   attack → defense (≈0.5 s): the monster crouches (squash on its feet), drops into its guard
//     loop while the tile card turns 90°, and a blue hexagonal shield flashes in front of it
//     (white first frame, honeycomb cells, stepped fade) with a soft clink.
//   defense → attack (≈0.9 s): a quick crouch, it rises with a stretch and a little hop, the card
//     turns upright, and a short roar — roar SFX + a player-coloured floor ring on the roar's
//     climax frame.
// A face-down monster (no unit) only turns its card.
//
// v3 look (?look=v3; docs/v3/A0_ENVANTER.md §6.2 item 6, plan §5 "pozisyon değişimi 0,4 sn"):
// positionV3 below — the body never slides, squashes or roars. With the art's `toGuard` /
// `fromGuard` pose the monster plays it on the spot (feet planted: the sprite does not move) while
// the card turns under it; without one (the old monsters) it changes pose on the beat the card
// is half-way round, under the hex shield (to defense) or a small player-coloured floor ring (to
// attack). Whole thing ≤ 0.4 s; the badge flips with the card.

import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { shockwave } from '../../vfx/summon';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerEvent } from '../api';
import { ADD, E, bg, capped, facing, hexPts, liveLayer, loop, roarPeak, run, whenFrame, fs, lightFlash, type AnyCtx } from './_kit';

const BLUE: Ramp = RAMPS.water;

/** Scale the sprite about its feet (origin = art anchor) through sx/sy over ms. */
function squash(ctx: AnyCtx, u: MonsterUnit, sx: number, sy: number, ms: number, dy = 0): Promise<void> {
  const s = u.sprite;
  const r0 = u.rest0;
  const x0 = s.scaleX;
  const y0 = s.scaleY;
  const p0 = s.y;
  return run(ctx.scene, ms, (t) => {
    if (!s.active) return;
    const k = E.outQ(t);
    s.setScale(x0 + (sx - x0) * k, y0 + (sy - y0) * k);
    s.y = Math.round(p0 + (r0.y + dy - p0) * k);
  });
}

/** Spring back to scale 1 at rest. */
function unsquash(ctx: AnyCtx, u: MonsterUnit, ms: number): Promise<void> {
  const s = u.sprite;
  const r0 = u.rest0;
  const x0 = s.scaleX;
  const y0 = s.scaleY;
  const p0 = s.y;
  return run(ctx.scene, ms, (t) => {
    if (!s.active) return;
    const k = 1 - E.spring(t);
    s.setScale(x0 + (1 - x0) * k, y0 + (1 - y0) * k);
    s.y = Math.round(p0 + (r0.y - p0) * E.outQ(t));
  }).then(() => {
    if (s.active) s.setScale(1).setPosition(r0.x, r0.y);
  });
}

/** Hexagonal guard flash (blue): white first frame, honeycomb cells, a touch of expansion, stepped fade. */
function hexGuard(ctx: AnyCtx, at: XY, size: number, ms = 420): Promise<void> {
  const W = size;
  const H = Math.round(size * 1.18);
  const layer = liveLayer(ctx.scene, at.x, at.y, W * 3, H * 3, DEPTH.FX + 2, () => undefined, ADD);
  return run(ctx.scene, ms, (t) => {
    layer.r.draw((r) => {
      const g = 0.8 + 0.25 * E.outBack(Math.min(1, t / 0.3), 2);
      // colour steps instead of alpha (additive: darker = fainter)
      const step = t < 0.1 ? 0 : t < 0.4 ? 1 : t < 0.7 ? 2 : 3;
      const edge = [PAL.white, BLUE[4], BLUE[3], BLUE[2]][step];
      const cell = [BLUE[4], BLUE[3], BLUE[2], BLUE[1]][step];
      const fill = [BLUE[3], BLUE[2], BLUE[1], BLUE[1]][step];
      const outer = hexPts(at.x, at.y, W * g, H * g);
      r.poly(outer, fill, step === 0 ? 0.5 : 0.28);
      // honeycomb cells
      const cw = W * g * 0.3;
      const ch = H * g * 0.3;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const cx = i === 6 ? at.x : at.x + Math.cos(a) * W * g * 0.52;
        const cy = i === 6 ? at.y : at.y + Math.sin(a) * H * g * 0.52;
        loop(r, hexPts(cx, cy, cw, ch), i === Math.floor(t * 16) % 7 ? PAL.white : cell);
      }
      loop(r, outer, edge);
      if (step < 2) loop(r, hexPts(at.x, at.y, W * g + 1, H * g + 1), cell);
      if (step === 0) for (const q of outer) r.px(q.x, q.y, PAL.white);
    });
  }).then(() => layer.stop());
}

/** v3: the card's quarter turn (ms) and the whole change's ceiling (plan §5: 0.4 s). */
const TURN_V3 = 240;
const POS_MAX_V3 = 400;

/** v3 position change (see the header). */
async function positionV3(ctx: AnyCtx, ev: { uid: number; position: 'attack' | 'defense' }): Promise<void> {
  const unit = ctx.unit(ev.uid);
  const tile = ctx.tile(ev.uid);
  const toDef = ev.position === 'defense';
  const o = toDef ? 'side' : 'up';
  if (!unit || unit.retired || !unit.sprite.visible) {
    if (tile) await capped(ctx.scene, tile.rotateTo(o, TURN_V3), POS_MAX_V3);
    return;
  }
  const s = unit.sprite;
  const sc = ctx.scene;
  const pose = toDef ? 'toGuard' : 'fromGuard';
  unit.posed = true;
  try {
    ctx.sfx('cardSlide', { volume: 0.55 });
    const jobs: Promise<unknown>[] = [];
    if (tile && tile.orientation !== o) jobs.push(tile.rotateTo(o, TURN_V3));
    // the unit's position is the rules' now (badge + rest loop follow it); the pose bridges the two
    unit.position = ev.position;
    unit.badge.setPosition(ev.position);
    const landed = () => {
      const c = unit.core();
      if (toDef) {
        const size = Math.max(10, Math.min(18, Math.round(unit.art.w * 0.24)));
        const at = { x: Math.round(c.x + facing(unit) * size * 0.7), y: Math.round(c.y) };
        ctx.sfx('shieldBlock', { volume: 0.4, pitch: 1.25 });
        bg(hexGuard(ctx, at, size, 300));
        void lightFlash(sc, at.x, at.y, BLUE[3], fs(24), 300, { floorY: unit.home.y, intensity: 0.7 });
      } else {
        const home = unit.home;
        void shockwave(sc, home.x, home.y, { ramp: PLAYER_RAMP[unit.player], radius: fs(30), ms: 300, thickness: 2 });
        void lightFlash(sc, home.x, home.y, PLAYER_RAMP[unit.player][3], fs(24), 280, { ring: true, intensity: 0.6 });
        void unit.badge.pop();
      }
    };
    if (unit.has(pose)) {
      // the transition pose on the spot (it ends on guard 0 / idle 0), then the loop
      const n = unit.frameCount(pose);
      const land = unit.markFrame(pose, 'land', n - 1);
      jobs.push(unit.playRange(pose, 0, undefined, { hold: true }).then(() => unit.rest()));
      jobs.push(unit.playToFrame(pose, land).then(landed));
    } else {
      // no transition pose: the body changes pose as the card is half-way round
      jobs.push(
        ctx.wait(Math.round(TURN_V3 * 0.45)).then(() => {
          unit.rest();
          landed();
        }),
      );
    }
    await capped(sc, Promise.all(jobs), POS_MAX_V3);
  } finally {
    unit.posed = false;
    if (s.active && !unit.retired) {
      s.setScale(1).setPosition(unit.rest0.x, unit.rest0.y);
      const want = unit.position === 'defense' ? 'guard' : 'idle';
      const cur = unit.frameInfo().anim;
      if (cur !== want || !s.anims.isPlaying) unit.rest();
    }
  }
}

registerEvent(
  'positionChange',
  async (ctx) => {
    const ev = ctx.ev;
    if (LOOK_V3) return positionV3(ctx, ev);
    const unit = ctx.unit(ev.uid);
    const tile = ctx.tile(ev.uid);
    if (!unit || unit.retired || !unit.sprite.visible) {
      if (tile) await tile.rotateTo(ev.position === 'defense' ? 'side' : 'up');
      return;
    }
    void ctx.views.camera.unfocus(120);
    const s = unit.sprite;
    unit.posed = true;
    try {
      if (ev.position === 'defense') {
        // crouch → guard, the card turns, the hex shield flashes
        ctx.sfx('cardSlide', { volume: 0.55 });
        await squash(ctx, unit, 1.08, 0.86, 90);
        const turn = unit.setPosition('defense', true);
        bg(unsquash(ctx, unit, 160));
        await ctx.wait(70);
        const c = unit.core();
        const b = unit.art;
        const size = Math.max(10, Math.min(18, Math.round(b.w * 0.24)));
        ctx.sfx('shieldBlock', { volume: 0.45, pitch: 1.2 });
        bg(hexGuard(ctx, { x: Math.round(c.x + facing(unit) * size * 0.7), y: Math.round(c.y) }, size));
        // (v2) the shield's blue flash on the marble
        void lightFlash(ctx.scene, Math.round(c.x + facing(unit) * size * 0.7), Math.round(c.y), BLUE[3], fs(24), 360, { floorY: unit.home.y, intensity: 0.7 });
        await capped(ctx.scene, turn, 500);
        await ctx.wait(160);
      } else {
        // crouch → rise with a hop, the card turns upright, a short roar
        ctx.sfx('cardSlide', { volume: 0.55 });
        await squash(ctx, unit, 1.07, 0.88, 80);
        bg(squash(ctx, unit, 0.93, 1.1, 110, -3).then(() => unsquash(ctx, unit, 160)));
        const turn = unit.setPosition('attack', true);
        const pk = roarPeak(unit);
        await capped(ctx.scene, whenFrame(unit, 'roar', pk), 900);
        ctx.sfx('roarSmall', { volume: 0.65 });
        const home = unit.home;
        void shockwave(ctx.scene, home.x, home.y, { ramp: PLAYER_RAMP[unit.player], radius: fs(38), ms: 360, thickness: 3 });
        void lightFlash(ctx.scene, home.x, home.y, PLAYER_RAMP[unit.player][3], fs(26), 320, { ring: true, intensity: 0.6 });
        void unit.badge.pop();
        await capped(ctx.scene, turn, 700);
      }
    } finally {
      unit.posed = false;
      if (s.active && !unit.retired) s.setScale(1).setPosition(unit.rest0.x, unit.rest0.y);
    }
  },
  { name: 'summon-b:positionChange' },
);
