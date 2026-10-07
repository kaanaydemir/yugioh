// The shared trap opening (GAME_DESIGN §7 "Ortak açılış") and the trap's exit, used by the three
// trap hooks in this folder. No registrations here.
//
//   const op = await trapOpening(ctx);   // card snaps upright, magenta burst, slow-mo, "TUZAK!"
//   ... the set piece (the banner is still leaving while it starts) ...
//   await trapExit(ctx, op);             // the spent card burns out, its ghost arcs to the graveyard
//
// Beats (real time, speed 1): 0 the card presses and swings upright, the duelist points ·
// 60 burst: white cross glint, magenta impact lines, floor rings, energy column, flash, 2 px
// shake, a 50 ms freeze · 110 slow-mo ×0.35 easing back over ~0.3 s while the card finishes
// standing (white pulse, magenta aura) · ~400 "TUZAK!" slams (the band dims the stage) ·
// ~760 the set piece starts while the band switches off.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { flash, shake, wait } from '../../vfx/core';
import { stopTime } from '../../vfx/combat';
import { E, Raster, Sparks, floorRing, onFrame, run, seg, tileFlash } from '../../vfx/setpieces';
import { banner, type BannerOpts } from '../../vfx/banners';
import { fx } from '../api';
import { ADD, TAU, type Ctx, duelist, isSetPulse, rnd, rr } from '../battle/_kit';

type ActCtx = Ctx<'activate'>;

export const TRAP_RAMP = [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1] as const;

export interface Opening {
  /** The trap's TileCard (standing upright now), or null if it was not on screen. */
  tile: TileCard | null;
  /** Floor point of the trap's zone. */
  at: XY;
  /** Point on the standing card's face (where chains / beams leave the card). */
  face: XY;
  /** Resolves when the "TUZAK!" banner has fully left the screen. */
  banner: Promise<void>;
  /** Stop the card's magenta aura (trapExit does it). */
  stopAura(): void;
}

/**
 * Magenta trap burst at a tile (~600 ms, fire-and-forget): white cross glint, anime impact lines,
 * twin floor rings, tile flash, a thin energy column and spark spray. Adapted from
 * setpieces.trapSpring without its floating word (the banner says it).
 */
export function trapBurst(scene: Phaser.Scene, x: number, y: number): Promise<void> {
  x = Math.round(x);
  y = Math.round(y);
  const cy = y - 24;
  void tileFlash(scene, x, y, [...TRAP_RAMP], 420);
  void floorRing(scene, x, y, { r0: 8, r1: 74, ms: 480, ramp: [...TRAP_RAMP], depth: DEPTH.SHADOW - 1 });
  void floorRing(scene, x, y, { r0: 4, r1: 42, ms: 340, ramp: [PAL.mag4, PAL.mag3, PAL.mag2], depth: DEPTH.SHADOW - 1 });
  const burst = Raster.around(scene, x, cy, 220, 170, DEPTH.FX + 6);
  const column = new Raster(scene, x - 8, cy - 130, 16, 140, DEPTH.FX + 5, ADD);
  const sparks = new Sparks(scene, DEPTH.FX + 7);
  const lines = Array.from({ length: 20 }, (_, i) => ({ a: (i / 20) * TAU + rr(-0.12, 0.12), len: rr(0.6, 1), w: rnd() < 0.3 ? 2 : 1 }));
  sparks.burst(26, () => {
    const a = rr(0, TAU);
    const sp = rr(60, 170);
    return { x, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 30, drag: 3, ay: -10, life: rr(320, 600), ramp: [...TRAP_RAMP], tex: rnd() < 0.35 ? 'fx:plus' : 'fx:px1', trail: rnd() < 0.4 };
  });
  return run(scene, 600, (t) => {
    burst.draw((g) => {
      const k = E.outExpo(seg(t, 0, 0.35));
      const k2 = E.inQuad(seg(t, 0.18, 0.75));
      for (const l of lines) {
        const r0 = 10 + k2 * 76 * l.len;
        const r1 = 16 + k * 86 * l.len;
        if (r1 <= r0) continue;
        const ca = Math.cos(l.a);
        const sa = Math.sin(l.a) * 0.62;
        const col = t < 0.15 ? PAL.white : t < 0.4 ? PAL.mag4 : PAL.mag3;
        g.line(x + ca * r0, cy + sa * r0, x + ca * r1, cy + sa * r1, col, 1, l.w);
      }
      if (t < 0.45) {
        const q = 1 - t / 0.45;
        const hw = Math.round(52 * E.outCubic(seg(t, 0, 0.12)) * q + 2);
        const hh = Math.round(30 * E.outCubic(seg(t, 0, 0.12)) * q + 1);
        g.rect(x - hw, cy, hw * 2 + 1, 1, PAL.white);
        g.rect(x - Math.round(hw * 0.6), cy - 1, Math.round(hw * 1.2) + 1, 3, PAL.mag4, 0.6);
        g.rect(x, cy - hh, 1, hh * 2 + 1, PAL.white);
        g.disc(x + 0.5, cy + 0.5, 4 * q + 1, PAL.white);
        g.ring(x + 0.5, cy + 0.5, 6 + 26 * (1 - q), 4 + 16 * (1 - q), PAL.mag3, q);
      }
    });
    column.draw((g) => {
      const q = 1 - seg(t, 0.2, 0.8);
      const h = 130 * E.outExpo(seg(t, 0, 0.25));
      const hw = 3 * q;
      if (hw < 0.3) return;
      g.rect(x - hw, cy - h, hw * 2 + 1, h, PAL.mag2, 0.8);
      g.rect(x - hw / 3, cy - h, (hw * 2) / 3 + 1, h, PAL.mag4, 1);
    });
    if (t > 0.15 && t < 0.8 && rnd() < 0.6) sparks.add({ x: x + rr(-16, 16), y: cy + rr(-4, 10), vy: rr(-90, -50), life: rr(200, 380), ramp: [PAL.mag4, PAL.mag3, PAL.mag2], tex: 'fx:px1', trail: true });
  }).then(() => {
    burst.destroy();
    column.destroy();
    sparks.close();
  });
}

/** A soft magenta aura breathing behind a standing trap card (until stopped). */
function cardAura(scene: Phaser.Scene, tile: TileCard): () => void {
  const sp = new Sparks(scene, DEPTH.FX - 3, ADD);
  let stopped = false;
  const stop = onFrame(scene, (dt) => {
    if (stopped || !tile.active || !tile.visible) {
      sp.close();
      return false;
    }
    if (dt > 0 && rnd() < dt / 45) {
      const side = rnd() < 0.5 ? -1 : 1;
      sp.add({ x: tile.home.x + side * rr(14, 26), y: tile.home.y - rr(4, 60), vy: rr(-30, -14), vx: side * rr(2, 8), life: rr(300, 560), ramp: [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], tex: rnd() < 0.2 ? 'fx:plus' : 'fx:px1' });
    }
    return true;
  });
  return () => {
    stopped = true;
    stop();
    sp.close();
  };
}

/**
 * The common trap opening. Resolves when the set piece should begin (~0.75 s at speed 1); the
 * banner's exit keeps playing in the background (`op.banner`).
 */
export async function trapOpening(ctx: ActCtx, o: { focus?: XY } = {}): Promise<Opening> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  // the trap window closes: the breathing set cards stop
  const pulse = ctx.take('trapPulse');
  if (isSetPulse(pulse)) pulse.destroy();
  else pulse?.destroy();
  const tile = ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null;
  const at = tile ? { ...tile.home } : ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
  const face = { x: at.x, y: at.y - 36 };
  if (tile) tile.setCard(ev.cardId);
  const stopAuraRef = { fn: () => undefined as void };
  void ctx.focus(o.focus ?? { x: at.x, y: at.y - 30 }, { zoom: 1.06, ms: 260, pan: 0.3 });
  void duelist(ctx, ev.player)?.play('command');
  // the card presses, then snaps upright — in slow motion once the burst goes off
  const stand = tile && tile.active ? tile.standUp(250, { reveal: true }) : Promise.resolve();
  await wait(sc, 60);
  ctx.sfx('trapActivate', { volume: 1 });
  void trapBurst(sc, at.x, at.y);
  void flash(sc, 90, PAL.mag3, 0.22, DEPTH.FX_TOP + 40);
  void shake(sc, 180, 2);
  await stopTime(sc, 50);
  ctx.views.speed.slowMo(0.35, 280);
  await stand;
  if (tile && tile.active) {
    stopAuraRef.fn = cardAura(sc, tile);
    void tile.pulse(PAL.white, 200);
  }
  // then "TUZAK!" slams (the letters drop faster than the default trap banner)
  const opts: BannerOpts & { stagger: number } = { style: 'trap', hold: 40, stagger: 24 };
  const ban = banner(sc, 'TUZAK!', opts);
  // the set piece starts as the letters have landed (the band is still on its way out)
  await Promise.race([ban, wait(sc, 350)]);
  const stopAura = () => stopAuraRef.fn();
  return { tile, at, face, banner: ban, stopAura };
}

/**
 * The spent trap leaves: its standing card flares, burns out into magenta embers and a small
 * copy arcs into the owner's graveyard (consumes the trap's own toGraveyard event).
 */
export async function trapExit(ctx: ActCtx, op: Opening): Promise<void> {
  const ev = ctx.ev;
  op.stopAura();
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
  if (gi < 0) return;
  const gEv = ctx.events[gi] as Extract<typeof ctx.events[number], { type: 'toGraveyard' }>;
  ctx.consumeAt(gi);
  const field = ctx.views.field;
  const { tile } = field.release(ev.uid);
  const from = tile ? { x: tile.home.x, y: tile.home.y - (tile.standing ? 36 : 4) } : { x: op.at.x, y: op.at.y - 4 };
  const jobs: Promise<unknown>[] = [];
  if (tile && tile.active) {
    jobs.push(
      (async () => {
        void tile.pulse(PAL.white, 220);
        await wait(ctx.scene, 90);
        await tile.dissolve(420);
        tile.destroy();
      })(),
    );
  }
  jobs.push(wait(ctx.scene, 160).then(() => fx.cardToGraveyard(ctx, { owner: gEv.owner, cardId: ev.cardId, from, scale: 0.5 })));
  await fx.all(jobs);
}

