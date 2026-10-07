// Position change (GAME_DESIGN §6 positionChange):
//   attack → defense (≈0.5 s): the monster crouches (squash on its feet), drops into its guard
//     loop while the tile card turns 90°, and a blue hexagonal shield flashes in front of it
//     (white first frame, honeycomb cells, stepped fade) with a soft clink.
//   defense → attack (≈0.9 s): a quick crouch, it rises with a stretch and a little hop, the card
//     turns upright, and a short roar — roar SFX + a player-coloured floor ring on the roar's
//     climax frame.
// A face-down monster (no unit) only turns its card.

import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, type XY } from '../../view/layout';
import { shockwave } from '../../vfx/summon';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerEvent } from '../api';
import { ADD, E, bg, capped, facing, hexPts, liveLayer, loop, roarPeak, run, whenFrame, type AnyCtx } from './_kit';

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

registerEvent(
  'positionChange',
  async (ctx) => {
    const ev = ctx.ev;
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
        void shockwave(ctx.scene, home.x, home.y, { ramp: PLAYER_RAMP[unit.player], radius: 38, ms: 360, thickness: 3 });
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
