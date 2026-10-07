// Ruh Çağrısı (soul_recall) — "Seçilen mezarlık parlar. Canavarın yarı saydam ruhu yükselir ve
// hedef karoya süzülür. Cyan bir sütun onu tam bir çağırmaya dönüştürür (hologram belirme)."
//
//   0       common opening (hand / set tile)
//   +0      release: the card's energy dives into the chosen graveyard (either player's)
//   +~300   the graveyard bursts open in cyan: a ring, spirit flames, the pile loses its card;
//           the translucent cyan ghost of the monster rises out of the pile (cropped by the floor)
//   +~560   it floats along an arc (afterimages, ectoplasm) to the destination tile, where a cyan
//           summoning circle has opened
//   +~980   arrival: a CYAN pillar slams up through the ghost; the ghost melts into it and the
//           real monster materializes inside it (hologram scan, cyan palette), the pillar
//           collapses, the monster roars, cyan shockwave, the ATK/DEF badge pops
//   then    the spent card drops into its owner's graveyard; on-summon effects (Magma Titanı's
//           burn) follow as their own events
//
// The special summon event is owned here (a revived monster always re-materializes in cyan).

import Phaser from 'phaser';
import { CARDS, isMonster, type CardId, type MonsterId } from '../../data/cards';
import { currentAtk, currentDef } from '../../engine';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import { TEX, flash, shake, wait } from '../../vfx/core';
import { E, Raster, Sparks, floorRing, ghostTexture, onFrame, qbez, rnd, rr, run } from '../../vfx/setpieces';
import { createMagicCircle, createPillar, landingDust, shockwave } from '../../vfx/summon';
import { materialize } from '../../vfx/hologram';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { CYAN_FX, bg, evAt, idxOf, relax, sendResolved, setTileOf, spellOpening } from './_kit';

const ADD = Phaser.BlendModes.ADD;
const TAU = Math.PI * 2;
const CYAN = RAMPS.cyan;

type AnyCtx = CinematicContext<GameEvent>;

interface Ghost {
  /** Melt down into the pillar (white, fading). */
  melt(ms?: number): Promise<void>;
}

/**
 * The graveyard glows; the monster's cyan ghost rises out of the pile and floats to `to`.
 * Resolves when it hovers over the tile. `onLeave` fires the moment it leaves the pile.
 */
async function soulRise(ctx: AnyCtx, from: XY, to: XY, id: MonsterId, player: PlayerId, onLeave: () => void): Promise<Ghost> {
  const sc = ctx.scene;
  const flip = player === 1;
  const gx = Math.round(from.x);
  const gy = Math.round(from.y);
  const tex = ghostTexture(sc, id);
  const grave = Raster.around(sc, gx, gy, 80, 44, DEPTH.SHADOW - 1, ADD);
  const flames = new Sparks(sc, unitDepth(gy) - 1, ADD);
  const mist = new Sparks(sc, DEPTH.FX + 1, ADD);
  let graveOn = 0;
  let burst = 0;
  let alive = true;
  const stopGrave = onFrame(sc, (dt, el) => {
    if (!alive) return false;
    burst = Math.max(0, burst - dt / 260);
    grave.draw((g) => {
      if (graveOn <= 0.01) return;
      const r = 18 + Math.sin(el * 0.012) * 1.2 + burst * 10;
      g.ell(gx, gy, r, r / 2, PAL.cyan1, 0.5 * graveOn);
      g.ring(gx, gy, r, r / 2, burst > 0.5 ? PAL.white : PAL.cyan3, graveOn);
      g.ring(gx, gy, r * 0.62, r * 0.31, PAL.cyan4, graveOn * 0.8);
      for (let i = 0; i < 6; i++) {
        const a = el * 0.004 + (i / 6) * TAU;
        g.disc(gx + Math.cos(a) * r * 0.82, gy + Math.sin(a) * r * 0.41, 1, PAL.white, graveOn);
      }
    });
    if (dt > 0 && graveOn > 0.3 && rnd() < dt / 22)
      flames.add({ x: gx + rr(-13, 13), y: gy + rr(-3, 3), vy: rr(-46, -24), wobble: 9, life: rr(320, 560), ramp: [PAL.cyan4, PAL.cyan3, PAL.cyan2, PAL.cyan1], tex: rnd() < 0.3 ? TEX.px2 : TEX.px1 });
    return true;
  });
  // the grave bursts open
  graveOn = 1;
  burst = 1;
  ctx.sfx('revive', { volume: 0.9 });
  bg(floorRing(sc, gx, gy, { r0: 6, r1: 42, ms: 360, ramp: CYAN_FX, depth: DEPTH.SHADOW - 1 }));

  // ghost sprites (body + additive glow copy)
  let ghost: Phaser.GameObjects.Sprite | null = null;
  let glow: Phaser.GameObjects.Sprite | null = null;
  const fh = tex?.art.h ?? 48;
  if (tex) {
    const ox = (flip ? tex.art.w - tex.art.anchorX : tex.art.anchorX) / tex.art.w;
    const oy = tex.art.anchorY / tex.art.h;
    ghost = sc.add.sprite(gx, gy + fh, tex.key, 'g0').setOrigin(ox, oy).setFlipX(flip).setAlpha(0.82).setDepth(DEPTH.FX);
    glow = sc.add.sprite(gx, gy + fh, tex.key, 'g0').setOrigin(ox, oy).setFlipX(flip).setAlpha(0.25).setDepth(DEPTH.FX + 0.5).setBlendMode(ADD);
    ghost.play(tex.key);
    glow.play(tex.key);
  }
  const place = (x: number, y: number, ground: number | null) => {
    for (const s of [ghost, glow]) {
      if (!s || !tex) continue;
      s.setPosition(Math.round(x), Math.round(y));
      if (ground !== null) {
        const keep = Math.round(tex.art.anchorY - (y - ground));
        s.setCrop(0, 0, tex.art.w, Math.max(0, keep));
        s.setVisible(keep > 0);
      } else s.setCrop();
    }
  };
  // destination circle opens while the ghost travels
  const dest = createMagicCircle(sc, to.x, to.y, { attribute: 'LIGHT', player, ramp: CYAN, appearMs: 240 });

  // ---- rise out of the pile (crop at the floor line)
  const lift = 20;
  await run(sc, 200, (t, el) => {
    const k = E.outCubic(t);
    place(gx + Math.sin(el * 0.02) * 1.2, gy + (1 - k) * fh * 0.95 - k * lift, gy);
    if (rnd() < 0.6) mist.add({ x: gx + rr(-10, 10), y: gy - rr(0, 4), vy: rr(-34, -12), life: rr(260, 420), ramp: [PAL.white, PAL.cyan4, PAL.cyan3], flicker: true });
  });
  place(gx, gy - lift, null);
  onLeave();

  // ---- float along an arc to the tile, afterimages trailing
  const start = { x: gx, y: gy - lift };
  const end = { x: to.x, y: to.y - 16 };
  const ctrl = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 46 };
  ctx.sfx('whoosh', { volume: 0.4, pitch: 0.7 });
  let lastEcho = -999;
  await run(sc, 320, (t, el) => {
    const p = qbez(start, ctrl, end, E.inOutSine(t));
    place(p.x, p.y + Math.sin(el * 0.02) * 1.5, null);
    if (ghost && el - lastEcho > 45) {
      lastEcho = el;
      const echo = sc.add
        .image(ghost.x, ghost.y, ghost.texture.key, ghost.frame.name)
        .setOrigin(ghost.originX, ghost.originY)
        .setFlipX(flip)
        .setAlpha(0.4)
        .setTint(PAL.cyan2)
        .setDepth(DEPTH.FX - 1)
        .setBlendMode(ADD);
      bg(run(sc, 220, (u) => echo.setAlpha(u < 0.4 ? 0.4 : u < 0.75 ? 0.22 : 0.1)).then(() => echo.destroy()));
    }
    mist.add({ x: p.x + rr(-8, 8), y: p.y - rr(0, fh * 0.5), vx: rr(-10, 10), vy: rr(-12, 6), life: rr(260, 440), ramp: [PAL.cyan4, PAL.cyan3, PAL.cyan2], flicker: true });
  });
  graveOn = 0;
  // ---- settle over the tile
  await run(sc, 60, (t) => place(end.x, end.y + Math.sin(Math.PI * t) * 2, null));

  return {
    async melt(ms = 220) {
      dest.pulse(120);
      await run(sc, ms, (t) => {
        const a = t < 0.3 ? 0.9 : t < 0.6 ? 0.55 : 0.2;
        for (const s of [ghost, glow]) {
          if (!s) continue;
          s.setTintFill(PAL.white).setAlpha(s === glow ? a * 0.5 : a);
          s.setY(Math.round(end.y + E.inQuad(t) * 10));
          s.setScale(1 + t * 0.15, 1 - t * 0.1);
        }
      });
      ghost?.destroy();
      glow?.destroy();
      alive = false;
      stopGrave();
      grave.destroy();
      flames.close();
      mist.close();
      bg(dest.dismiss(320));
    },
  };
}

/** Stats of the revived monster right after its summon event. */
function statsAt(s: GameState, uid: Uid, id: CardId): { atk: number; def: number } {
  const d = CARDS[id];
  const base = isMonster(d) ? { atk: d.atk, def: d.def } : { atk: 0, def: 0 };
  try {
    return { atk: currentAtk(s, uid), def: currentDef(s, uid) };
  } catch {
    return base;
  }
}

/** The cyan pillar turns the ghost into a full special summon (hologram reveal, roar, badge). */
async function rematerialize(ctx: AnyCtx, ev: Extract<GameEvent, { type: 'summon' }>, ghost: Ghost, stats: { atk: number; def: number }): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const home = zoneXY(ev.player, 'monster', ev.zone);
  const tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, true, 'up');
  tile.tileFlash(PAL.cyan3, 380);
  tile.ringBurst(PAL.cyan4, 380);
  const unit: MonsterUnit | null = field.addUnit(ev.uid, { hidden: true, atk: stats.atk, def: stats.def, position: 'attack' });
  // the pillar slams up through the ghost
  ctx.sfx('summonBurst', { volume: 0.9 });
  const pillar = createPillar(sc, home.x, home.y, { attribute: 'LIGHT', ramp: CYAN, style: 'beam', height: 150, width: 20, riseMs: 100 });
  bg(shockwave(sc, home.x, home.y, { ramp: CYAN, radius: 44, ms: 360 }));
  void shake(sc, 120, 1);
  bg(ghost.melt(200));
  await wait(sc, 90);
  if (!unit) {
    await pillar.collapse(140);
    return;
  }
  unit.sprite.setPosition(unit.rest0.x, unit.rest0.y);
  // the reveal reaches the top → roar + impact (shockwave, dust, badge pop)
  let landed = false;
  const impact = () => {
    if (landed) return;
    landed = true;
    void unit.play('roar');
    ctx.sfx(fx.isAce(ev.cardId) ? 'roarBig' : 'roarSmall', { volume: 0.85 });
    bg(shockwave(sc, home.x, home.y, { ramp: CYAN, radius: 60, ms: 420, thickness: 7 }));
    bg(landingDust(sc, home.x, home.y, PAL.cyan3, { count: 8 }));
    void shake(sc, 150, 2);
    ctx.sfx('impactHeavy', { volume: 0.4 });
    if (fx.isAce(ev.cardId)) bg(flash(sc, 100, PAL.cyan4, 0.22));
    bg(unit.badge.pop());
  };
  ctx.sfx('materialize', { volume: 0.8 });
  const mat = materialize(sc, unit.sprite, { ramp: CYAN, ms: 420, onRevealed: impact });
  unit.showSprite();
  // the column pinches out as the scan reaches the top of the body
  await wait(sc, 280);
  pillar.pulse(80);
  bg(pillar.collapse(110));
  await mat;
  impact();
  unit.show();
}

registerCardHook('soul_recall', 'activate', async (ctx) => {
  const ev = ctx.ev;
  const field = ctx.views.field;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const tEv = evAt(ctx, ti, 'target');
  const si = idxOf(ctx, run0, (e) => e.type === 'summon' && e.from === 'graveyard');
  const sEv = evAt(ctx, si, 'summon');
  const gi = idxOf(ctx, run0, (e) => e.type === 'toGraveyard' && e.from === 'resolved' && e.uid === ev.uid);
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 380 });
  const gUid = tEv?.graveyardUid;
  if (!tEv || !sEv || gUid === undefined || !isMonster(CARDS[sEv.cardId])) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  ctx.consumeAt(ti);
  ctx.consumeAt(si);
  const owner = ctx.owner(gUid);
  const pile = field.pile(owner, 'graveyard');
  const gyAt = pile.topXY();
  const dest = zoneXY(sEv.player, 'monster', sEv.zone);
  const stats = statsAt(ctx.stateAt(si + 1), sEv.uid, sEv.cardId);
  bg(ctx.focus({ x: (gyAt.x + dest.x) / 2, y: Math.min(gyAt.y, dest.y) - 10 }, { zoom: 1.04, ms: 520, pan: 0.25 }));
  // the grave bursts open just as the orb dives in
  const DIVE = 200;
  let risen!: (g: { g: Promise<Ghost> }) => void;
  const ghostP = new Promise<{ g: Promise<Ghost> }>((r) => (risen = r));
  const rise = () =>
    risen({
      g: soulRise(ctx, gyAt, dest, sEv.cardId as MonsterId, sEv.player, () => {
        // the card leaves the pile as the ghost tears free
        const g = ctx.stateAt(si + 1).players[owner].graveyard;
        pile.set(g.length, g.length ? ctx.stateAt(si + 1).cards[g[g.length - 1]].cardId : null);
        pile.bump();
      }),
    });
  await op.release({ x: gyAt.x, y: gyAt.y - 4 }, { path: 'dive', lift: 30, ms: DIVE, ramp: CYAN_FX, onLaunch: () => bg(wait(ctx.scene, DIVE - 40).then(rise)) });
  bg(pile.flash(PAL.cyan4));
  const ghost = await (await ghostP).g;
  // the spent card heads for its graveyard while the pillar rises
  const send = sendResolved(ctx, gi, { x: dest.x, y: dest.y - 70 }, 200);
  await rematerialize(ctx, sEv, ghost, stats);
  relax(ctx, 360);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  await send;
});
