// Damage / LP presentation.
//
//   damage   the number pops where the blow landed (hints.at: over the struck monster, over the
//            attacker for recoil, at the duelist for direct hits) — or over the LP panel for
//            plain effect damage; a few red sparks stream from the number into the LP panel while
//            the counter rolls down with ticks, the panel flashes red and shakes, the duelist
//            flinches ('hurt' + jolt). Undelivered effect damage keeps the default fireball.
//   lpGain   the default heal stream + number; the duelist raises its arm.
// v3 look: the battle handler pops the number on the contact frame (hints.at, no delay) as an
// impact number (_v3/number.ts: visible on that frame, through the hit-stop, whole-pixel pop) and
// the LP roll is capped at 400 ms (plan §5; _v3/budget.ts); the handler resolves when the roll
// ends (the duelist's 'hurt' flinch is not waited for).

import { PAL } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { wait } from '../../vfx/core';
import { damageNumber } from '../../vfx/numbers';
import { Sparks } from '../../vfx/setpieces';
import { fx, registerEvent } from '../api';
import { LP_ROLL_MAX_MS } from '../_v3/budget';
import { impactNumber } from '../_v3/number';
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
      jobs.push(LOOK_V3 ? impactNumber(sc, p.x, p.y, ev.amount, { size, depth: DEPTH.FX_TOP + 50 }) : damageNumber(sc, p.x, p.y, ev.amount, 'damage', { size, depth: DEPTH.FX_TOP + 50 }));
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
          delay: LOOK_V3 ? 40 + i * 22 : 140 + i * 26,
          life: 520,
          home: { x: panel.x, y: panel.y, k: 0.22 },
          ramp: [PAL.white, PAL.crim4, PAL.crim3, PAL.crim2],
          tex: rnd() < 0.3 ? 'fx:px2' : 'fx:px1',
          trail: true,
        });
      }
      sp.close();
    } else {
      const ny = lp.y + (ev.player === 0 ? -30 : 26);
      jobs.push(LOOK_V3 ? impactNumber(sc, lp.x, ny, ev.amount, { size, depth: DEPTH.HUD + 20 }) : damageNumber(sc, lp.x, ny, ev.amount, 'damage', { size, depth: DEPTH.HUD + 20 }));
    }
    const d = duelist(ctx, ev.player);
    // v3: the duelist's flinch plays on, but the handler ends with the LP roll (≈ 0.5 s after the
    // pop) — waiting on the 'hurt' anim (and its safety net) held every battle ~0.3 s longer
    if (d && LOOK_V3) {
      void d.play('hurt');
      void d.jolt();
    } else if (d) jobs.push(d.play('hurt'), d.jolt());
    // the LP counter: ticks, red flash, panel shake (HudView.setLp); starts as the sparks arrive.
    // v3: the first sparks reach the panel sooner, and the handler ends with the roll itself (the
    // digits' landing punch plays on)
    if (LOOK_V3) {
      const lpRoll = (at ? wait(sc, 60) : Promise.resolve()).then(() => {
        const roll = hud.setLp(ev.player, ev.lpAfter, true, { maxMs: LP_ROLL_MAX_MS });
        return Promise.race([roll, wait(sc, LP_ROLL_MAX_MS + 20)]);
      });
      jobs.push(lpRoll);
    } else jobs.push((at ? wait(sc, 120) : Promise.resolve()).then(() => hud.setLp(ev.player, ev.lpAfter, true)));
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
