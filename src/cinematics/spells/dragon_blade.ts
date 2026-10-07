// Ejder Kılıcı (dragon_blade) — "Canavarın üstünde altın rünlerden bir kılıç belirir, döner ve
// iner. Canavar altın parlar, kalıcı altın aura kazanır, ATK rozeti akarak artar."
//
//   0       common opening (hand / set tile), then the card dives back down onto its spell zone
//           and slams there face-up (it stays on the field)
//   +0      eight gold runes burst out of the landed card and arc up over the monster, where a
//           gold rune circle opens; they orbit, then converge into a vertical spine
//   +~420   the blade draws itself top → bottom in white light, cools to gold, a glint runs down
//   +~500   it spins (1.5 turns) while rising, hangs a beat (anticipation, tip glint) …
//   +~880   … and PLUNGES into the monster: hit-stop, white → gold silhouette, gold ring burst,
//           sparks, shake; the ATK badge rolls up green (+700) right on the impact
//   then    the blade sinks into the body in a column of light; the persistent gold aura starts
//
// 'destroyed' (the equip leaves the field — its monster died, or it was destroyed itself): the
// card shatters in gold and, when its monster is still standing, the aura bursts off it.

import Phaser from 'phaser';
import type { GameEvent, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { TEX, shake, wait } from '../../vfx/core';
import { E, Raster, Sparks, addGlow, floorRing, freeze, goldAura, lerp, onFrame, qbez, rnd, rr, run, spriteBox } from '../../vfx/setpieces';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { fx, registerCardHook, registerObserver, type CinematicContext } from '../api';
import { GOLD_FX, bg, idxOf, relax, setTileOf, spellOpening } from './_kit';

const ADD = Phaser.BlendModes.ADD;
const TAU = Math.PI * 2;

type AnyCtx = CinematicContext<GameEvent>;

/**
 * The rune-forged sword over `u` (see the header). `from` is where the runes come from (the
 * equip card). onImpact fires on the plunge frame. Resolves when the blade has sunk in.
 */
async function forge(ctx: AnyCtx, u: MonsterUnit, from: XY, o: { onImpact?: () => void } = {}): Promise<void> {
  const sc = ctx.scene;
  const target = u.sprite;
  const b0 = spriteBox(sc, target);
  const ax = Math.round(b0.cx);
  const SW = 15;
  // The rune circle hovers right above the head like a halo; the blade forms above it (hilt up)
  // and plunges THROUGH it. Integer magnification keeps the blade crisp: ×2 for medium+ monsters
  // when there is head room under the top of the screen (P2's back row may not have it).
  const circleY = Math.max(22, Math.round(b0.top - 8));
  const layout = (ss: number) => {
    const sh = 46 * ss;
    const hy = Math.max(Math.round(sh / 2) + 16, circleY - Math.round(sh / 2) - 4);
    return { sh, hy, travel: Math.round(b0.top + b0.h * 0.5 - sh / 2) - hy };
  };
  let SS = b0.h >= 40 ? 2 : 1;
  if (SS === 2 && layout(2).travel < 30) SS = 1;
  const SH = 46 * SS;
  const hoverY = layout(SS).hy;
  const CR = 22 + SS * 8;
  const NR = 8;
  const sparks = new Sparks(sc, DEPTH.FX + 3, ADD);
  const halo = Raster.around(sc, ax, circleY, CR * 2 + 30, CR + 30, DEPTH.FX + 1, ADD);
  const sword = sc.add.image(ax, hoverY, 'set:sword').setDepth(DEPTH.FX + 2).setScale(SS).setVisible(false);
  const glint = Raster.around(sc, ax, hoverY, 40, SH + 24, DEPTH.FX + 3, ADD);
  let circleOn = 0;
  let glintT = -1;
  const stopDraw = onFrame(sc, (_dt, el) => {
    halo.draw((g) => {
      if (circleOn <= 0.01) return;
      const r = CR + (1 - circleOn) * 10;
      g.ring(ax, circleY, r, r * 0.32, PAL.gold3, circleOn);
      g.ring(ax, circleY, r - 4, r * 0.32 - 1.3, PAL.gold1, circleOn * 0.8);
      g.ring(ax, circleY, r + 6, r * 0.32 + 2, PAL.gold2, circleOn * 0.45);
      for (let i = 0; i < 12; i++) {
        const a = el * 0.002 + (i / 12) * TAU;
        g.px(ax + Math.cos(a) * (r + 3), circleY + Math.sin(a) * (r * 0.32 + 1), PAL.gold4, circleOn);
      }
    });
    glint.moveTo(sword.x - 20, sword.y - SH / 2 - 12);
    glint.draw((g) => {
      if (glintT < 0 || glintT > 1 || !sword.visible) return;
      const yy = sword.y - SH / 2 + glintT * (SH + 8);
      for (let i = -3 * SS; i <= 3 * SS; i++) g.px(sword.x + i, yy + i * 0.5 - 2, Math.abs(i) <= SS - 1 ? PAL.white : PAL.gold4, Math.abs(i) <= SS - 1 ? 1 : 0.6);
    });
  });
  const slot = (i: number, el: number): XY => {
    const a = el * 0.0034 + (i / NR) * TAU;
    return { x: ax + Math.cos(a) * CR, y: circleY + Math.sin(a) * CR * 0.32 - 3 };
  };

  // ---- 0–330: runes burst out of the card and arc up into the ring
  ctx.sfx('equip', { volume: 0.55, pitch: 0.8 });
  const runes: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < NR; i++) runes.push(sc.add.image(from.x, from.y, 'set:rune', `r${i}`).setDepth(DEPTH.FX + 2).setVisible(false));
  sparks.burst(10, () => ({ x: from.x + rr(-6, 6), y: from.y, vx: rr(-40, 40), vy: rr(-90, -30), ay: 200, life: rr(200, 360), ramp: GOLD_FX, tex: TEX.px1 }));
  let el0 = 0;
  const fly = run(sc, 250, (_t, el) => {
    el0 = el;
    runes.forEach((r, i) => {
      const t0 = i * 12;
      const k = Math.max(0, Math.min(1, (el - t0) / 160));
      if (k <= 0) return;
      const end = slot(i, el);
      const ctrl = { x: lerp(from.x, end.x, 0.3) + (i % 2 ? -18 : 18), y: Math.min(from.y, end.y) - 26 };
      const p = qbez(from, ctrl, end, E.outCubic(k));
      if (!r.visible) r.setVisible(true).setTintFill(PAL.white);
      else if (k > 0.3) r.clearTint();
      r.setPosition(Math.round(p.x), Math.round(p.y));
      if (k < 1 && rnd() < 0.6) sparks.add({ x: p.x, y: p.y, life: rr(120, 220), ramp: [PAL.gold4, PAL.gold3, PAL.gold2], fade: 0.5 });
      if (k >= 1 && !r.getData('in')) {
        r.setData('in', true);
        ctx.sfx('holyChime', { volume: 0.15, pitch: 1 + i * 0.07 });
      }
    });
  });
  bg(wait(sc, 70).then(() => run(sc, 170, (t) => (circleOn = E.outCubic(t)))));
  await fly;
  // orbit one beat in the ring
  await run(sc, 40, (_t, el) => {
    runes.forEach((r, i) => {
      const p = slot(i, el0 + el);
      r.setPosition(Math.round(p.x), Math.round(p.y));
      r.setDepth(Math.sin((el0 + el) * 0.0034 + (i / NR) * TAU) > 0 ? DEPTH.FX + 2 : DEPTH.FX);
    });
  });

  // ---- converge into the blade's spine
  const spine = (i: number): XY => ({ x: ax, y: hoverY - SH / 2 + 4 * SS + (i / (NR - 1)) * (SH - 10 * SS) });
  const starts = runes.map((r) => ({ x: r.x, y: r.y }));
  await run(sc, 100, (t) => {
    const k = E.inCubic(t);
    runes.forEach((r, i) => {
      const p = spine(i);
      r.setPosition(Math.round(lerp(starts[i].x, p.x, k)), Math.round(lerp(starts[i].y, p.y, k)));
    });
  });
  runes.forEach((r) => r.destroy());
  ctx.sfx('summonBurst', { volume: 0.4, pitch: 1.3 });

  // ---- the blade draws itself top → bottom in white light, then cools to gold
  sword.setVisible(true).setTintFill(PAL.white);
  await run(sc, 70, (t) => sword.setCrop(0, 0, SW, Math.ceil(46 * t)));
  sword.setCrop();
  sparks.burst(16, (i) => {
    const yy = hoverY - SH / 2 + rnd() * SH;
    return { x: ax + rr(-3, 3), y: yy, vx: rr(-70, 70), vy: rr(-40, 20), drag: 4, life: rr(240, 420), ramp: GOLD_FX, tex: i % 4 === 0 ? TEX.plus : TEX.px1 };
  });
  sword.setTintFill(PAL.gold4);
  await wait(sc, 34);
  sword.clearTint();
  glintT = 0;
  bg(run(sc, 200, (t) => (glintT = t)).then(() => (glintT = -1)));

  // ---- spin 1.5 turns while rising
  ctx.sfx('whoosh', { volume: 0.35, pitch: 1.4 });
  await run(sc, 210, (t) => {
    const spin = E.outCubic(t) * TAU * 1.5 + Math.PI; // ends edge-on → face-on
    const c = Math.cos(spin);
    sword.setScale(Math.max(0.14, Math.abs(c)) * SS, SS).setFlipX(c < 0);
    if (Math.abs(c) < 0.3) sword.setTintFill(PAL.gold4);
    else sword.clearTint();
    sword.setY(Math.round(hoverY - E.outQuad(t) * 8));
    if (rnd() < 0.5) sparks.add({ x: ax + rr(-6, 6), y: sword.y + rr(-20, 20), vy: rr(10, 30), life: 300, ramp: [PAL.gold4, PAL.gold3, PAL.gold2], flicker: true });
  });
  sword.setScale(SS).setFlipX(false).clearTint();
  bg(run(sc, 200, (t) => (circleOn = 1 - t)));

  // ---- anticipation: hang, tip glint
  const topY = sword.y;
  await run(sc, 60, (t) => sword.setY(Math.round(topY - E.outQuad(t) * 5)));
  sparks.add({ x: ax, y: sword.y + SH / 2 - 1, life: 140, ramp: [PAL.white, PAL.gold4], tex: TEX.spark, scale: 2 });

  // ---- plunge
  const b = spriteBox(sc, target);
  const stabY = Math.round(b.top + b.h * 0.5 - SH / 2);
  const fromY = sword.y;
  ctx.sfx('whoosh', { volume: 0.6, pitch: 1.8 });
  await run(sc, 70, (t) => sword.setY(Math.round(lerp(fromY, stabY, E.inQuad(t)))));
  // ---- IMPACT
  ctx.sfx('equip', { volume: 1 });
  ctx.sfx('impactLight', { volume: 0.6, pitch: 1.2 });
  if (target.active) target.setTintFill(PAL.white);
  try {
    o.onImpact?.();
  } catch (e) {
    console.error('[spells] blade impact', e);
  }
  bg(floorRing(sc, u.home.x, u.home.y, { r0: 8, r1: 62, ms: 460, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], depth: DEPTH.SHADOW - 1 }));
  sparks.burst(26, () => {
    const a = rr(0, TAU);
    const sp = rr(60, 170);
    return { x: ax, y: stabY + SH / 2 - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40, ay: 260, drag: 1.5, life: rr(300, 600), ramp: GOLD_FX, trail: true };
  });
  void shake(sc, 160, 2);
  await freeze(sc, 70);
  // the monster drinks the gold: white frame → gold silhouette → additive gold glow fading out
  bg(
    (async () => {
      await wait(sc, 34);
      if (target.active) target.setTintFill(PAL.gold4);
      await wait(sc, 34);
      if (target.active) target.clearTint();
      await addGlow(sc, target, PAL.gold3, 520, 0.9);
    })(),
  );
  // the blade sinks into the body and vanishes in a column of light
  const column = Raster.around(sc, ax, b.top + b.h / 2 - 20, 30, Math.ceil(b.h) + 60, DEPTH.FX + 1, ADD);
  await run(sc, 230, (t) => {
    sword.setY(Math.round(stabY + t * 10 * SS));
    sword.setAlpha(t < 0.4 ? 1 : t < 0.7 ? 0.6 : 0.25);
    column.draw((g) => {
      const hw = 5 * (1 - t);
      g.rect(ax - hw, column.y, hw * 2, column.h, PAL.gold2, 1 - t);
      g.rect(ax - hw / 3, column.y, (hw * 2) / 3, column.h, PAL.gold4, 1 - t);
    });
  });
  column.destroy();
  sword.destroy();
  stopDraw();
  halo.destroy();
  glint.destroy();
  sparks.close();
}

registerCardHook('dragon_blade', 'activate', async (ctx) => {
  const ev = ctx.ev;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const ei = idxOf(ctx, run0, (e) => e.type === 'equip' && e.spellUid === ev.uid);
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 400 });
  if (ev.zone === null) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  const tile = await op.land({ spot: 'spellTrap', index: ev.zone });
  if (ti >= 0) ctx.consumeAt(ti);
  if (ei >= 0) await ctx.play(ei, { from: { x: tile.home.x, y: tile.home.y - 6 } });
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 360);
});

/** The forge itself (also when someone else plays the equip event). */
registerCardHook('dragon_blade', 'equip', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const u = ctx.unit(ev.targetUid);
  const ci = ctx.findType('statChange', (e) => e.uid === ev.targetUid, { until: (e) => e.type !== 'statChange' });
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible) {
    if (ci >= 0) await ctx.play(ci);
    return;
  }
  const tile = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.spellZone);
  const from = (ctx.hints.from as XY | undefined) ?? (tile ? { x: tile.home.x, y: tile.home.y - 6 } : zoneXY(ev.player, 'spellTrap', ev.spellZone));
  const c = u.core();
  bg(ctx.focus({ x: c.x, y: c.y - 20 }, { zoom: 1.06, ms: 420, pan: 0.3 }));
  let stat: Promise<void> = Promise.resolve();
  await forge(ctx, u, from, {
    onImpact: () => {
      if (ci >= 0) stat = ctx.play(ci);
    },
  });
  if (u.sprite.active && !u.retired) u.setAura('equip', goldAura(sc, u.sprite));
  // the badge keeps rolling (its target value is already set, so a sync will not snap it)
  await Promise.race([stat, wait(sc, 160)]);
});

/** The gold aura bursts off a still-standing monster in gold shards (idempotent). */
function burstAura(ctx: AnyCtx, u: MonsterUnit): Promise<void> {
  if (u.retired || !u.sprite.active || !u.sprite.visible || !u.hasAura('equip')) return Promise.resolve();
  const sc = ctx.scene;
  u.setAura('equip', null);
  const b = spriteBox(sc, u.sprite);
  const sp = new Sparks(sc, DEPTH.FX + 3, ADD);
  sp.burst(22, () => {
    const a = rr(0, TAU);
    const v = rr(50, 140);
    return { x: b.cx + rr(-4, 4), y: b.cy + rr(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 30, ay: 300, drag: 1.2, life: rr(300, 560), ramp: GOLD_FX, trail: true, tex: rnd() < 0.3 ? TEX.px2 : TEX.px1 };
  });
  sp.close();
  ctx.sfx('shatter', { volume: 0.6, pitch: 1.6 });
  return addGlow(sc, u.sprite, PAL.gold3, 260, 0.7);
}

/**
 * Whatever animates the equip's destruction (another card's hook may consume the destroy event),
 * the ATK roll-back of a monster that just lost its blade bursts the gold aura off it.
 */
registerObserver((ev, ctx) => {
  if (ev.type !== 'statChange') return;
  const u = ctx.unit(ev.uid);
  if (!u || u.retired || !u.hasAura('equip')) return;
  const still = ctx.stateNext.players.some((p) => p.spellTraps.some((st) => st && st.equippedTo === ev.uid));
  if (!still) bg(burstAura(ctx, u));
});

/** The equip leaves the field: its card shatters in gold; a still-standing monster loses the aura. */
registerCardHook('dragon_blade', 'destroyed', async (ctx) => {
  const ev = ctx.ev;
  if (ev.location !== 'spellTrap') return ctx.base();
  const field = ctx.views.field;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'statChange' });
  const gEv = gi >= 0 ? (ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  // the monster it was attached to (rule destroys name it as the source)
  const slot = ctx.state.players[ev.player].spellTraps[ev.zone];
  const holder: Uid | null = slot?.equippedTo ?? (ev.reason === 'rule' ? ev.sourceUid : null);
  const u = holder !== null ? ctx.unit(holder) : null;
  const jobs: Promise<unknown>[] = [];
  if (u) jobs.push(burstAura(ctx, u));
  const { tile } = field.release(ev.uid);
  const home = tile ? tile.home : zoneXY(ev.player, 'spellTrap', ev.zone);
  if (tile && tile.active) {
    if (!tile.faceUp) {
      tile.setCard(ev.cardId);
      await tile.flipUp(200);
    }
    bg(tile.pulse(PAL.gold4, 200));
    if (ev.reason !== 'rule' || !u) ctx.sfx('shatter', { volume: 0.5, pitch: 1.4 });
    await tile.dissolve(ev.reason === 'rule' ? 380 : 480);
    tile.destroy();
  }
  if (gEv) jobs.push(fx.cardToGraveyard(ctx, { owner: gEv.owner, cardId: ev.cardId, from: { x: home.x, y: home.y - 4 } }));
  await fx.all(jobs);
});
