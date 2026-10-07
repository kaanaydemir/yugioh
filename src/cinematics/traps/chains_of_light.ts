// Işık Zincirleri (chains_of_light) — GAME_DESIGN §7: glowing chains shoot out of the card, wrap
// the attacker mid-lunge, drag it back to its own tile and lock with a clank; "SAVAŞ BİTTİ", and
// the turn ends.
//
// activate: the common trap opening, then (owning the whole resolution run)
//   · the coiled attacker launches itself anyway (attack anim, afterimages, a lunge that is still
//     travelling when the chains arrive)
//   · three gold chains with magenta halos shoot from the standing card, coil around it in the
//     air (it struggles), lock (padlock sigil, hit-stop) and haul it back home (./_chains lightChains)
//   · home: the chains snap taut with a second clank — white flash, gold sparks, a small shake
//   · the attackNegated event plays through the 'negate' hook below ("SAVAŞ BİTTİ"), the spent
//     trap burns out to the graveyard; the engine's end-phase / next-turn events follow.
// negate: with hints.bound the activation already bound the attacker → only the "SAVAŞ BİTTİ"
//   banner and the log line; otherwise the generic attackNegated presentation (battle/declare).

import { PAL, PLAYER_COLOR } from '../../art/palette';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { shake, tween, wait } from '../../vfx/core';
import { afterimages, stopTime, whiteFlash } from '../../vfx/combat';
import { Sparks } from '../../vfx/setpieces';
import { lightChains } from './_chains';
import { banner, type BannerOpts } from '../../vfx/banners';
import { fx, registerCardHook } from '../api';
import { TAU, type EvOf, all, holdFrame, lerpXY, live, other, rnd, rr, seed, takeAttack } from '../battle/_kit';
import { trapExit, trapOpening } from './_opening';

registerCardHook(
  'chains_of_light',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const sc = ctx.scene;
    seed(ev.uid * 19 + 11);
    const runIdx = fx.resolutionRun(ctx);
    const ni = runIdx.find((i) => ctx.events[i].type === 'attackNegated') ?? -1;
    const nEv = ni >= 0 ? (ctx.events[ni] as EvOf<'attackNegated'>) : null;
    const pend = ctx.before.pending;
    const trig = pend && pend.kind === 'trapResponse' && pend.trigger.kind === 'attackDeclared' ? pend.trigger : null;
    const attackerUid = nEv?.attackerUid ?? trig?.attackerUid ?? null;
    const attacker = attackerUid !== null ? live(ctx.unit(attackerUid)) : null;
    const trapPt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
    const aCore = attacker ? attacker.core() : zoneXY(other(ev.player), 'monster', 1);
    const op = await trapOpening(ctx, { focus: lerpXY({ x: trapPt.x, y: trapPt.y - 30 }, aCore, 0.45) });
    const { hold, other: kept } = takeAttack(ctx);
    kept?.destroy();

    if (attacker) {
      // where it was going: the declared target, else the defending duelist
      const tUid = hold?.targetUid ?? trig?.targetUid ?? null;
      const tu = tUid !== null ? live(ctx.unit(tUid)) : null;
      const aim: XY = tu ? tu.home : hold ? { x: hold.to.x, y: hold.to.y + 18 } : fx.duelistPoint(ctx, ev.player);
      void ctx.focus(lerpXY(aCore, { x: op.face.x, y: op.face.y }, 0.4), { zoom: 1.06, ms: 360, pan: 0.32 });
      // the chains rattle awake in the card (the sfx's lock "tak" lands on the lock below)
      ctx.sfx('chains', { volume: 1 });
      hold?.dropMarks();
      await hold?.release(50);
      const s = attacker.sprite;
      const home = attacker.rest0;
      const dash = { x: Math.round(home.x + (aim.x - attacker.home.x) * 0.42), y: Math.round(home.y + (aim.y - attacker.home.y) * 0.42) };
      attacker.posed = true;
      // anticipation: it crouches for the leap
      await tween(sc, { targets: s, scaleY: 0.9, scaleX: 1.06, duration: 120, ease: 'Quad.Out' });
      // ---- it launches itself anyway
      void attacker.play('attack');
      ctx.sfx('whoosh', { volume: 0.6, pitch: 1.1 });
      void afterimages(sc, s, 260, PLAYER_COLOR[attacker.player], { every: 40, alpha: 0.45 });
      void tween(sc, { targets: s, scaleY: 1, scaleX: 1, duration: 160, ease: 'Back.Out' });
      let bound = false;
      const lunge = tween(sc, { targets: s, x: dash.x, y: dash.y, duration: 320, ease: 'Quad.Out' }).then(() => {
        // caught: it hangs in the chains, struggling on its attack frame
        if (s.active && !bound) holdFrame(attacker, 'attack', attacker.art.attackImpactFrame);
      });
      await wait(sc, 70);
      // ---- the chains shoot from the standing card and bind it
      const struggle = (async () => {
        await lunge;
        while (!bound && s.active) {
          s.x = dash.x + (rnd() < 0.5 ? -1 : 1);
          await wait(sc, 50);
          if (!bound && s.active) s.x = dash.x;
          await wait(sc, 40);
        }
      })();
      await lightChains(sc, op.face, attacker, {
        home,
        onLock: () => {
          bound = true;
          sc.tweens.killTweensOf(s);
        },
      });
      bound = true;
      await struggle;
      // ---- home: the chains snap taut — a second clank
      if (s.active) {
        s.setPosition(home.x, home.y).setScale(1);
        ctx.sfx('chains', { volume: 0.7, pitch: 0.6 });
        ctx.sfx('shieldBlock', { volume: 0.5, pitch: 0.7 });
        void whiteFlash(sc, s, 1);
        void shake(sc, 140, 2);
        const c = attacker.core();
        const sp = new Sparks(sc, DEPTH.FX + 4);
        sp.burst(16, () => {
          const a = rr(0, TAU);
          const v = rr(50, 130);
          return { x: c.x, y: c.y + rr(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, ay: 320, drag: 2, life: rr(220, 420), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.mag3], tex: rnd() < 0.3 ? 'fx:plus' : 'fx:px1', trail: true };
        });
        sp.close();
        await stopTime(sc, 40);
        void attacker.play('hit');
      }
      attacker.posed = false;
    } else {
      hold?.destroy();
    }
    // ---- "SAVAŞ BİTTİ" (the negate hook), the spent trap leaves
    const exit = wait(sc, 80).then(() => trapExit(ctx, op));
    if (ni >= 0 && !ctx.isConsumed(ni)) await ctx.play(ni, { bound: true });
    await all([exit, op.banner]);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
  },
  { name: 'tb:chains_of_light:activate' },
);

registerCardHook(
  'chains_of_light',
  'negate',
  async (ctx) => {
    if (!ctx.hints.bound) return ctx.base();
    ctx.log('Saldırı geçersiz kılındı!', PAL.mag3);
    void ctx.unfocus(300);
    const o: BannerOpts & { stagger: number } = { style: 'trap', hold: 120, stagger: 18 };
    await banner(ctx.scene, 'SAVAŞ BİTTİ', o);
  },
  { name: 'tb:chains_of_light:negate' },
);
