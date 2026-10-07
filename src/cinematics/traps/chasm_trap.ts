// Yer Yarığı (chasm_trap) — GAME_DESIGN §7: the ground under the freshly summoned monster splits
// into a glowing abyss, the monster drops into it, rocks tumble after it and the crack slams shut.
//
// activate  the common trap opening (card snaps upright, magenta burst, slow-mo, "TUZAK!"), then
//           it owns its whole resolution run: the destroy (→ 'destroys' below), the victim's
//           graveyard flight, the spent trap's exit.
// destroys  a glowing fissure races along the floor from the trap card to the victim's tile, the
//           monster flinches, the floor opens (setpieces.chasm), it falls in, the crack closes
//           with dust and a shake, its card rises out of the scar and arcs to the graveyard.
//           (Monster death flavours step aside for this source — they check for a 'destroys'
//           hook of the destroying card.)

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { shake, wait } from '../../vfx/core';
import { Raster, Sparks, boltPath, chasm, floorRing, onFrame, run } from '../../vfx/setpieces';
import { fx, registerCardHook } from '../api';
import { type EvOf, all, guardRemap, lerpXY, live, rnd, rr, seed } from '../battle/_kit';
import { trapExit, trapOpening } from './_opening';

/**
 * A glowing fissure races along the floor from `from` to `to` (~280 ms), branches crackle off it,
 * debris spits up at its head; it keeps smouldering and cools down on its own (fire-and-forget
 * tail). Resolves when the head arrives.
 */
function fissure(scene: Phaser.Scene, from: XY, to: XY, ms = 280): Promise<void> {
  const main = boltPath(from, to, Math.max(6, Math.hypot(to.x - from.x, to.y - from.y) * 0.08), 4);
  const branches = Array.from({ length: 4 }, (_, i) => {
    const k = 0.2 + i * 0.18 + rr(-0.05, 0.05);
    const at = main[Math.min(main.length - 1, Math.floor(k * (main.length - 1)))];
    const a = rr(0, Math.PI * 2);
    const l = rr(6, 13);
    return { k, pts: boltPath(at, { x: at.x + Math.cos(a) * l, y: at.y + Math.sin(a) * l * 0.5 }, 2, 2) };
  });
  const xs = main.map((p) => p.x);
  const ys = main.map((p) => p.y);
  const x0 = Math.min(...xs) - 20;
  const y0 = Math.min(...ys) - 20;
  const ras = new Raster(scene, x0, y0, Math.max(...xs) - x0 + 20, Math.max(...ys) - y0 + 20, DEPTH.SHADOW - 2);
  const dust = new Sparks(scene, DEPTH.FX - 4);
  let head = 0;
  let glow = 1;
  const draw = () =>
    ras.draw((g) => {
      const n = Math.max(2, Math.round(head * (main.length - 1)) + 1);
      const pts = main.slice(0, n);
      // dithered magenta halo, a dark split, a glowing lip above it and a hot core line
      if (glow > 0.05) g.path(pts, PAL.mag1, glow * 0.6, 5);
      g.path(pts, PAL.ink, 1, 2);
      g.path(
        pts.map((p) => ({ x: p.x, y: p.y - 1 })),
        glow > 0.5 ? PAL.mag3 : PAL.mag2,
        glow,
        1,
      );
      if (glow > 0.6)
        g.path(
          pts.map((p) => ({ x: p.x, y: p.y + 1 })),
          PAL.mag4,
          (glow - 0.6) * 2.5,
        );
      for (const b of branches) if (head > b.k) g.path(b.pts, glow > 0.4 ? PAL.mag2 : PAL.mag1, glow);
      if (head < 1) {
        const h = pts[pts.length - 1];
        g.disc(h.x, h.y, 2.5, PAL.mag4);
        g.disc(h.x, h.y, 1.2, PAL.white);
      }
    });
  const stop = onFrame(scene, () => draw());
  const arrive = run(scene, ms, (t, _el, dt) => {
    head = t * t * (3 - 2 * t);
    const n = Math.max(1, Math.round(head * (main.length - 1)));
    const h = main[n];
    if (dt > 0 && rnd() < 0.7)
      dust.add({ x: h.x + rr(-2, 2), y: h.y, vx: rr(-30, 30), vy: rr(-70, -30), ay: 300, life: rr(220, 380), ramp: rnd() < 0.5 ? [PAL.mag4, PAL.mag3, PAL.mag2] : [PAL.earth3, PAL.earth2, PAL.earth1], tex: 'fx:px1' });
  });
  void arrive.then(async () => {
    head = 1;
    await wait(scene, 500);
    await run(scene, 600, (t) => (glow = 1 - t));
    stop();
    ras.destroy();
    dust.close();
  });
  return arrive;
}

registerCardHook(
  'chasm_trap',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    seed(ev.uid * 13 + 5);
    const runIdx = fx.resolutionRun(ctx);
    const di = runIdx.find((i) => {
      const e = ctx.events[i];
      return e.type === 'destroy' && e.location === 'monster' && e.sourceUid === ev.uid;
    });
    const dEv = di !== undefined ? (ctx.events[di] as EvOf<'destroy'>) : null;
    const victim = dEv ? live(ctx.unit(dEv.uid)) : null;
    const trapAt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
    const vAt = dEv ? zoneXY(dEv.player, 'monster', dEv.zone) : trapAt;
    if (victim) guardRemap(victim);
    const op = await trapOpening(ctx, { focus: lerpXY({ x: trapAt.x, y: trapAt.y - 30 }, { x: vAt.x, y: vAt.y - 20 }, 0.35) });
    for (const i of runIdx) {
      if (ctx.isConsumed(i)) continue;
      const e = ctx.events[i];
      if (e.type === 'toGraveyard' && e.uid === ev.uid) continue; // trapExit
      await ctx.play(i, i === di ? { from: { x: op.at.x, y: op.at.y }, owned: true } : {});
    }
    await all([trapExit(ctx, op), op.banner]);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    await ctx.unfocus(320);
  },
  { name: 'tb:chasm_trap:activate' },
);

registerCardHook(
  'chasm_trap',
  'destroys',
  async (ctx) => {
    const ev = ctx.ev;
    if (ev.location !== 'monster') return ctx.base();
    const sc = ctx.scene;
    const field = ctx.views.field;
    const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
    const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
    if (gi >= 0) ctx.consumeAt(gi);
    // where the crack comes from: the trap card (hint), else its zone
    let from = ctx.hints.from as XY | undefined;
    if (!from && ev.sourceUid !== null) {
      const loc = ctx.locate(ev.sourceUid);
      if (loc) from = zoneXY(loc.player, loc.zone === 'field' ? 'field' : loc.zone, loc.index);
    }
    const { tile, unit } = field.release(ev.uid);
    const home = tile ? { ...tile.home } : zoneXY(ev.player, 'monster', ev.zone);
    const u = live(unit);
    void ctx.focus({ x: home.x, y: home.y - 18 }, { zoom: 1.07, ms: 320, pan: 0.36 });
    if (u) u.badge.setVisible(false);
    if (from) {
      ctx.sfx('groundCrack', { volume: 0.55, pitch: 1.3 });
      void shake(sc, 260, 1);
      await fissure(sc, { x: from.x, y: from.y + 2 }, home);
    }
    // the monster flinches as the ground under it gives way
    if (u) {
      if (u.position === 'attack') void u.play('hit', { hold: true });
      u.posed = true;
    }
    const sinkTile = (t: TileCard | null) => {
      if (!t || !t.active) return;
      void (async () => {
        await wait(sc, 300);
        if (t.active) await t.fadeOut(180);
        if (t.active) t.destroy();
      })();
    };
    sinkTile(tile);
    if (u) {
      await chasm(sc, home.x, home.y, u.sprite);
      u.posed = false;
      u.retire();
    } else {
      void floorRing(sc, home.x, home.y, { r0: 6, r1: 40, ms: 420, ramp: [PAL.mag4, PAL.mag3, PAL.mag2] });
      await wait(sc, 500);
    }
    field.forget(ev.uid);
    // the lost card rises out of the scar and arcs to the graveyard
    if (gEv) await fx.cardToGraveyard(ctx, { owner: gEv.owner, cardId: ev.cardId, from: { x: home.x, y: home.y - 6 }, ms: 420 });
  },
  { name: 'tb:chasm_trap:destroys' },
);
