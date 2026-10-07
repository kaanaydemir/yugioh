// Damage / LP presentation.
//
//   damage   the number pops where the blow landed (hints.at: over the struck monster, over the
//            attacker for recoil, at the duelist for direct hits) — or over the LP panel for
//            plain effect damage; a few red sparks stream from the number into the LP panel while
//            the counter rolls down with ticks, the panel flashes red and shakes, the duelist
//            flinches ('hurt' + jolt). Undelivered effect damage keeps the default fireball.
//   lpGain   the default heal stream + number; the duelist raises its arm.

import { PAL } from '../../art/palette';
import { DEPTH, type XY } from '../../view/layout';
import { wait } from '../../vfx/core';
import { damageNumber } from '../../vfx/numbers';
import { Sparks } from '../../vfx/setpieces';
import { fx, registerEvent } from '../api';
import { ADD, all, duelist, rnd, rr } from './_kit';

registerEvent(
  'damage',
  async (ctx) => {
    const ev = ctx.ev;
    const at = ctx.hints.at as XY | undefined;
    // effect damage without a delivery: the default flies a fireball from the source first
    if (!at && ev.source === 'effect' && !ctx.hints.delivered) return ctx.base();
    const sc = ctx.scene;
    const hud = ctx.views.hud;
    const lp = fx.lpPoint(ctx, ev.player);
    const size: 1 | 2 = ev.amount >= 1000 ? 2 : 1;
    const jobs: Promise<unknown>[] = [];
    if (at) {
      const p = { x: Math.round(at.x), y: Math.round(at.y) };
      jobs.push(damageNumber(sc, p.x, p.y, ev.amount, 'damage', { size, depth: DEPTH.FX_TOP + 50 }));
      // the hurt travels: red sparks stream from the number into the LP panel
      const panel = ctx.views.camera.worldPoint(lp.x, lp.y);
      const sp = new Sparks(sc, DEPTH.FX_TOP + 40, ADD);
      const n = Math.min(9, 3 + Math.round(ev.amount / 400));
      for (let i = 0; i < n; i++) {
        sp.add({
          x: p.x + rr(-6, 6),
          y: p.y + rr(-4, 4),
          vx: rr(-40, 40),
          vy: rr(-60, -20),
          delay: 140 + i * 26,
          life: 520,
          home: { x: panel.x, y: panel.y, k: 0.22 },
          ramp: [PAL.white, PAL.crim4, PAL.crim3, PAL.crim2],
          tex: rnd() < 0.3 ? 'fx:px2' : 'fx:px1',
          trail: true,
        });
      }
      sp.close();
    } else {
      jobs.push(damageNumber(sc, lp.x, lp.y + (ev.player === 0 ? -30 : 26), ev.amount, 'damage', { size, depth: DEPTH.HUD + 20 }));
    }
    const d = duelist(ctx, ev.player);
    if (d) jobs.push(d.play('hurt'), d.jolt());
    // the LP counter: ticks, red flash, panel shake (HudView.setLp); starts as the sparks arrive
    jobs.push((at ? wait(sc, 120) : Promise.resolve()).then(() => hud.setLp(ev.player, ev.lpAfter, true)));
    if (ev.amount >= 1500) void wait(sc, 160).then(() => hud.shake(ev.player, 5, 420));
    if (ev.lpAfter <= 1000) ctx.music.setIntensity(1);
    await all(jobs);
  },
  { name: 'tb:damage' },
);

registerEvent(
  'lpGain',
  async (ctx) => {
    void duelist(ctx, ctx.ev.player)?.play('command');
    await ctx.base();
  },
  { name: 'tb:lpGain' },
);
