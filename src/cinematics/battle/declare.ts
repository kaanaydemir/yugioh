// Attack declaration, the trap-window decision cue, the decline and the generic attack negation.
//
//   attackDeclare     duelist commands, the attacker coils (squash + power ring + rising sparks),
//                     the arrow arcs to the target, the reticle snaps, the target braces (defense:
//                     hex glint; attack: flinch), the camera leans in between them. The pose, arrow
//                     and reticle are kept as an AttackHold ('attack') — across a trap decision too.
//   decision          trapResponse: the defender's set cards breathe magenta ('trapPulse' kept).
//   responseDeclined  the set cards cool down and a small "Geç" pops over the defender's row.
//   attackNegated     the arrow shatters, the attacker is shoved back with a clang, "SAVAŞ BİTTİ".
// Plus an observer that installs the guard-pose rule (guardRemap) on every unit.

import { PAL, PLAYER_COLOR, PLAYER_RAMP } from '../../art/palette';
import { pixelText } from '../../ui/text';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { tween, wait } from '../../vfx/core';
import { attackArrow, blockClang, lockOn } from '../../vfx/combat';
import { Sparks, addGlow, floorRing, onFrame } from '../../vfx/setpieces';
import { banner, type BannerOpts } from '../../vfx/banners';
import { fx, registerEvent, registerObserver } from '../api';
import {
  ADD,
  TAU,
  type AttackHold,
  duelist,
  guardRemap,
  guardRemapAll,
  hexGlint,
  isSetPulse,
  lerpXY,
  live,
  norm,
  other,
  rnd,
  rr,
  seed,
  setCardPulse,
  sub,
  takeAttack,
} from './_kit';

// every unit gets the guard-pose rule before anything can hit it
registerObserver((_ev, ctx) => guardRemapAll(ctx.views));

// ================================================================ attackDeclare

registerEvent(
  'attackDeclare',
  async (ctx) => {
    const ev = ctx.ev;
    const sc = ctx.scene;
    seed(ev.attackerUid * 31 + (ev.targetUid ?? 7));
    // a stale hold (should not happen) goes first
    ctx.take('attack')?.destroy();
    const attacker = live(ctx.unit(ev.attackerUid));
    const target = ev.targetUid !== null ? live(ctx.unit(ev.targetUid)) : null;
    const tTile = ev.targetUid !== null ? ctx.tile(ev.targetUid) : null;
    const defender = other(ev.player);
    const ramp = PLAYER_RAMP[ev.player];
    const home = zoneXY(ev.player, 'monster', ev.attackerZone);
    const from: XY = attacker ? attacker.core() : { x: home.x, y: home.y - 12 };
    const to: XY = target ? target.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 8 } : fx.duelistPoint(ctx, defender);
    if (target) guardRemap(target);

    // camera leans in between attacker and target
    void ctx.focus(lerpXY(from, to, 0.5), { zoom: 1.05, ms: 380, pan: 0.32 });
    void duelist(ctx, ev.player)?.play('command');
    ctx.sfx('attackDeclare', { volume: 0.85 });

    // ---- wind-up: the attacker coils back toward its own side, squashes, powers up
    let tremble: (() => void) | null = null;
    let coil: Promise<void> = Promise.resolve();
    const back = norm(sub(from, to));
    const coilXY = attacker ? { x: Math.round(attacker.rest0.x + back.x * 2), y: Math.round(attacker.rest0.y + back.y * 2) } : null;
    if (attacker && coilXY) {
      const s = attacker.sprite;
      attacker.posed = true;
      sc.tweens.killTweensOf(s);
      coil = tween(sc, { targets: s, x: coilXY.x, y: coilXY.y, scaleY: 0.93, scaleX: 1.05, duration: 210, ease: 'Quad.Out' });
      void addGlow(sc, s, ramp[3], 380, 0.55);
      void floorRing(sc, attacker.home.x, attacker.home.y, { r0: 4, r1: 30, ms: 420, ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], depth: DEPTH.SHADOW - 1 });
      const motes = new Sparks(sc, DEPTH.FX - 1, ADD);
      const h = attacker.home;
      void fx.all([
        new Promise<void>((done) => {
          onFrame(sc, (dt, el) => {
            if (el > 520) {
              motes.close();
              done();
              return false;
            }
            if (dt > 0 && rnd() < dt / 26) {
              const a = rr(0, TAU);
              motes.add({ x: h.x + Math.cos(a) * rr(8, 16), y: h.y + Math.sin(a) * rr(3, 7), vy: rr(-70, -40), drag: 1, life: rr(240, 420), ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], tex: rnd() < 0.25 ? 'fx:plus' : 'fx:px1' });
            }
            return true;
          });
        }),
      ]);
    }

    // ---- the arrow arcs out, the reticle snaps onto the target
    await wait(sc, 70);
    const arrow = attackArrow(sc, from, to, ev.player);
    const size = target ? Math.max(24, Math.round(target.art.w * 0.42)) : tTile ? 26 : 30;
    const lock = lockOn(sc, to.x, to.y, { color: PLAYER_COLOR[ev.player], size });
    // the target braces as the reticle lands
    void wait(sc, 230).then(() => {
      if (target && target.sprite.active) {
        if (target.position === 'defense') {
          void hexGlint(sc, to.x + back.x * 8, to.y + back.y * 8 - 2, back.x, PAL.water3, 340);
        } else {
          const s = target.sprite;
          const r = target.rest0;
          const away = norm(sub(to, from));
          if (!target.posed) {
            sc.tweens.killTweensOf(s);
            void tween(sc, { targets: s, x: Math.round(r.x + away.x * 1.5), y: Math.round(r.y + away.y), duration: 70, ease: 'Quad.Out', yoyo: true, hold: 60 }).then(() => {
              if (s.active && !target.posed) s.setPosition(r.x, r.y);
            });
          }
        }
      } else if (tTile && tTile.active && !tTile.faceUp) void tTile.pulse(PLAYER_COLOR[ev.player], 320);
      else if (ev.targetUid === null) void duelist(ctx, defender)?.jolt();
    });
    await coil;
    // a held breath: the coiled attacker trembles while the attack hangs (and through a decision)
    if (attacker && coilXY) {
      const s = attacker.sprite;
      tremble = onFrame(sc, (_dt, el) => {
        if (!s.active) return false;
        const j = Math.floor(el / 90) % 4;
        s.x = coilXY.x + (j === 1 ? 1 : j === 3 ? -1 : 0) * 0.5;
        return true;
      });
    }

    let marksGone = false;
    const dropMarks = () => {
      if (marksGone) return;
      marksGone = true;
      arrow.destroy();
      lock.destroy();
    };
    let released = false;
    const restore = () => {
      tremble?.();
      tremble = null;
      if (!attacker) return;
      const s = attacker.sprite;
      if (!s.active) return;
      sc.tweens.killTweensOf(s);
      const r = attacker.rest0;
      s.setPosition(r.x, r.y).setScale(1);
      attacker.posed = false;
    };
    const hold: AttackHold = {
      kind: 'attackHold',
      attackerUid: ev.attackerUid,
      targetUid: ev.targetUid,
      player: ev.player,
      from,
      to,
      dropMarks,
      shatterMarks() {
        if (marksGone) return;
        // the arrow breaks apart along its arc, the reticle bursts
        const sp = new Sparks(sc, DEPTH.FX_TOP + 1);
        const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - Math.min(46, Math.max(14, Math.hypot(to.x - from.x, to.y - from.y) * 0.32)) };
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const u = 1 - t;
          const p = { x: u * u * from.x + 2 * u * t * mid.x + t * t * to.x, y: u * u * from.y + 2 * u * t * mid.y + t * t * to.y };
          sp.add({ x: p.x, y: p.y, vx: rr(-40, 40), vy: rr(-50, 10), ay: 240, drag: 1.5, life: rr(220, 420), ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], tex: rnd() < 0.3 ? 'fx:px2' : 'fx:px1' });
        }
        sp.burst(10, () => {
          const a = rr(0, TAU);
          return { x: to.x, y: to.y, vx: Math.cos(a) * rr(50, 110), vy: Math.sin(a) * rr(50, 110), drag: 3, life: rr(200, 360), ramp: [PAL.white, ramp[4], ramp[3]], tex: 'fx:plus' };
        });
        sp.close();
        dropMarks();
      },
      async release(ms = 80) {
        if (released) return;
        released = true;
        tremble?.();
        tremble = null;
        if (!attacker || !attacker.sprite.active) return;
        const s = attacker.sprite;
        const r = attacker.rest0;
        sc.tweens.killTweensOf(s);
        await tween(sc, { targets: s, x: r.x, y: r.y, scaleX: 1, scaleY: 1, duration: ms, ease: 'Quad.Out' });
        if (s.active) s.setPosition(r.x, r.y).setScale(1);
        attacker.posed = false;
      },
      destroy() {
        dropMarks();
        if (!released) {
          released = true;
          restore();
        }
      },
    };
    ctx.keep('attack', hold);
    await arrow.done;
    await lock.done;
    await wait(sc, 140);
  },
  { name: 'tb:attackDeclare' },
);

// ================================================================ the trap window

registerEvent(
  'decision',
  async (ctx) => {
    const pd = ctx.ev.pending;
    if (pd.kind !== 'trapResponse') return ctx.base();
    ctx.take('trapPulse')?.destroy();
    const pulse = setCardPulse(ctx, pd.player);
    ctx.keep('trapPulse', pulse);
    ctx.sfx('lockOn', { volume: 0.45, pitch: 0.7 });
    // a magenta shimmer runs along the defender's spell/trap row once
    for (let i = 0; i < 3; i++) {
      const p = zoneXY(pd.player, 'spellTrap', i);
      void wait(ctx.scene, i * 70).then(() => floorRing(ctx.scene, p.x, p.y, { r0: 6, r1: 26, ms: 360, ramp: [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], depth: DEPTH.TILE_FX + 2 }));
    }
    await ctx.wait(300);
  },
  { name: 'tb:decision' },
);

registerEvent(
  'responseDeclined',
  async (ctx) => {
    const sc = ctx.scene;
    const p = ctx.ev.player;
    const h = ctx.take('trapPulse');
    if (isSetPulse(h)) h.settle(PAL.night4);
    else h?.destroy();
    // small "Geç" over the defender's spell/trap row
    const row = zoneXY(p, 'spellTrap', 1);
    const at = { x: row.x, y: row.y - 22 };
    const t = pixelText(sc, at.x, at.y, 'Geç', { size: 'md', color: PAL.mist, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.FX_TOP + 5);
    t.setScale(1.4, 0.7);
    ctx.sfx('uiBack', { volume: 0.5, pitch: 0.9 });
    void (async () => {
      await tween(sc, { targets: t, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.Out' });
      await wait(sc, 260);
      await tween(sc, { targets: t, y: at.y - 8, alpha: 0, duration: 260, ease: 'Quad.In' });
      t.destroy();
    })();
    await wait(sc, 300);
  },
  { name: 'tb:responseDeclined' },
);

// ================================================================ attackNegated (generic)

/**
 * A negated attack without its own card hook: the arrow shatters, the attacker is shoved back
 * with a clang and recoils, the camera eases out and "SAVAŞ BİTTİ" slams.
 */
registerEvent(
  'attackNegated',
  async (ctx) => {
    const ev = ctx.ev;
    const sc = ctx.scene;
    const { hold, other: kept } = takeAttack(ctx);
    kept?.destroy();
    hold?.shatterMarks();
    const u = live(ctx.unit(ev.attackerUid));
    if (u) {
      await hold?.release(60);
      const c = u.core();
      const s = u.sprite;
      const r = u.rest0;
      const back = u.player === 0 ? { x: -1, y: 0.5 } : { x: 1, y: -0.5 };
      void blockClang(sc, Math.round(c.x - back.x * 8), Math.round(c.y - back.y * 8), { from: { x: c.x - back.x * 30, y: c.y - back.y * 30 }, color: PAL.mag3 });
      void u.play('hit');
      u.posed = true;
      await tween(sc, { targets: s, x: Math.round(r.x + back.x * 4), y: Math.round(r.y + back.y * 2), duration: 70, ease: 'Quad.Out' });
      await tween(sc, { targets: s, x: r.x, y: r.y, duration: 260, ease: 'Back.Out' });
      u.posed = false;
    } else hold?.destroy();
    void ctx.unfocus(260);
    ctx.log('Saldırı geçersiz kılındı!', PAL.mag3);
    const o: BannerOpts & { stagger: number } = { style: 'trap', hold: 140, stagger: 18 };
    await banner(sc, 'SAVAŞ BİTTİ', o);
  },
  { name: 'tb:attackNegated' },
);
