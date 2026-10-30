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
import { STAND_H, isoProject } from '../../art/cards';
import type { TileCard } from '../../view/TileCard';
import { LANE_MID, DEPTH, LOOK_V3, UI, type XY, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { flash, shake, wait } from '../../vfx/core';
import { Sparks as PxSparks, stopTime } from '../../vfx/combat';
import { E, Raster, Sparks, floorRing, onFrame, run, seg, sleep, tileFlash } from '../../vfx/setpieces';
import { banner, type BannerOpts } from '../../vfx/banners';
import { measureText, pixelLetters, pixelText, upper } from '../../ui/text';
import { cardLeaves } from '../_v3/card';
import { chainRattle } from './_chains';
import { dropAllCharges, play as playV3 } from '../_v3/sound';
import { fx } from '../api';
import { ADD, TAU, TK, type Ctx, arenaDim, duelist, isSetPulse, rnd, rr } from '../battle/_kit';
// lane A5-A (A5_PLAN §3.3): Ayna Kalkanı's accent in the v3 scene language, behind V3_A5_A only
import { V3_A5_A } from '../../view/v3flags';

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
  void floorRing(scene, x, y, { r0: 8, r1: 74 * TK, ms: 480, ramp: [...TRAP_RAMP], depth: DEPTH.SHADOW - 1 });
  void floorRing(scene, x, y, { r0: 4, r1: 42 * TK, ms: 340, ramp: [PAL.mag4, PAL.mag3, PAL.mag2], depth: DEPTH.SHADOW - 1 });
  // arena v2: the burst floods the marble magenta (a pool + shock ring, a bloom up the column)
  void lightFlash(scene, x, cy, PAL.mag3, 70, 650, { floorY: y, ring: true, intensity: 1.2 });
  void lightFlash(scene, x, cy - 50, PAL.mag4, 34, 420, { floorY: y, air: 0.7, intensity: 0.8 });
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
  // arena v2: the standing card glows on the floor around it
  const glow = lightPool(scene, tile.home.x, tile.home.y - 26, { color: PAL.mag3, spill: PAL.mag2, radius: 34, floorY: tile.home.y, air: 0.45, airRadius: 22, intensity: 0.85, anim: 'breathe', fadeIn: 200 });
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
    void glow.fadeOut(300);
  };
}

/**
 * The common trap opening. Resolves when the set piece should begin (~0.75 s at speed 1); the
 * banner's exit keeps playing in the background (`op.banner`).
 */
export async function trapOpening(ctx: ActCtx, o: { focus?: XY } = {}): Promise<Opening> {
  if (LOOK_V3) return trapOpeningV3(ctx, o);
  const sc = ctx.scene;
  const ev = ctx.ev;
  // the trap window closes: the breathing set cards stop
  const pulse = ctx.take('trapPulse');
  if (isSetPulse(pulse)) pulse.destroy();
  else pulse?.destroy();
  const tile = ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null;
  const at = tile ? { ...tile.home } : ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', LANE_MID);
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
  // arena v2: the stadium darkens around the sprung trap (trapExit brings the floodlights back)
  void arenaDim(sc, 0.5, 260);
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
  if (LOOK_V3) return trapExitV3(ctx, op);
  const ev = ctx.ev;
  op.stopAura();
  void arenaDim(ctx.scene, 0, 480);
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


// ================================================================ the v3 look (?look=v3)
//
// A0 §6.2 item 10 (plan §4–§5): the trap opening reaches its set piece in ≤ 0.6 s and stays LOCAL —
// no full-screen flash, no dimmed stage, no slow motion, no full-width banner:
//   0      the trap window closes; the card presses and springs upright on its own tile (3D raster)
//   40     burst on the tile: magenta floor ring + tile flash, a thin column, short impact lines,
//          pixel sparks, the stepped magenta light on the pad, a 1-px world shake, a 40 ms breath
//   ~260   standing: the card's own accent (Işık Zincirleri: gold chain links rattle out of its
//          edges; Ayna Kalkanı: a glint sweeps its face; Yer Yarığı: the floor cracks round its tile)
//          and ONE short local "TUZAK!" stamped over the card (≤ 0.35 s, world space, not a banner)
//   ~360   resolves: the set piece starts while the word is still leaving (op.banner)
// trapExitV3: the spent card lies back down on its tile and is born from there into its graveyard
// flight (_v3/card cardLeaves) — never dissolved and re-spawned.
// resultPlate(): the short result ("SAVAŞ BİTTİ") as a compact plate dropping out from under the
// HUD's phase bar — the battle phase ends there — instead of a full-width band.

/** Where a standing TileCard's face is (its centre, TileCard.standUp pose at scale 1). */
function standFace(t: TileCard): XY {
  const [, py] = isoProject([0, 0, STAND_H / 2 + 2]);
  return { x: Math.round(t.home.x), y: Math.round(t.home.y + py) };
}

/** The v3 burst at a trap's tile (~360 ms, fire-and-forget): crisp pixels only, the stepped light on its pad. */
function trapBurstV3(scene: Phaser.Scene, at: XY, face: XY): void {
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  void tileFlash(scene, x, y, [...TRAP_RAMP], 320);
  void floorRing(scene, x, y, { r0: 6, r1: 48 * TK, ms: 380, ramp: [...TRAP_RAMP], depth: DEPTH.SHADOW - 1 });
  void lightFlash(scene, x, y, PAL.mag3, 40, 460, { floorY: y, ring: true, intensity: 1.1 });
  const cy = face.y;
  const ras = Raster.around(scene, x, cy - 20, 120, 130, DEPTH.FX + 6);
  const lines = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * TAU + rr(-0.15, 0.15), len: rr(0.6, 1) }));
  const sp = new PxSparks(scene, DEPTH.FX + 7);
  for (let i = 0; i < 16; i++) {
    const a = rr(0, TAU);
    const v = rr(50, 130);
    sp.add({ x, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 20, drag: 3, life: rr(220, 420), colors: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], shape: i % 4 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sp.release();
  void run(scene, 360, (t) => {
    ras.draw((g) => {
      // impact lines out of the card's face
      const k = E.outExpo(seg(t, 0, 0.4));
      const k2 = E.inQuad(seg(t, 0.2, 0.8));
      for (const l of lines) {
        const r0 = 12 + k2 * 34 * l.len;
        const r1 = 16 + k * 40 * l.len;
        if (r1 <= r0) continue;
        const ca = Math.cos(l.a);
        const sa = Math.sin(l.a) * 0.62;
        g.line(x + ca * r0, cy + sa * r0, x + ca * r1, cy + sa * r1, t < 0.2 ? PAL.white : PAL.mag4, 1);
      }
      // a thin column up out of the tile, gone in a third of a second
      const h = Math.round(70 * E.outExpo(seg(t, 0, 0.3)));
      const lv = 1 - seg(t, 0.3, 1);
      if (lv > 0.05 && h > 0) {
        g.rect(x - 1, y - h, 3, h, PAL.mag3, lv);
        g.rect(x, y - h, 1, h, t < 0.3 ? PAL.white : PAL.mag4, lv);
      }
    });
  }).then(() => ras.destroy());
}

/** Pixel motes rising beside the standing trap card and its magenta stepped light (until stopped). */
function cardAuraV3(scene: Phaser.Scene, tile: TileCard): () => void {
  const sp = new PxSparks(scene, DEPTH.FX - 3);
  const glow = lightPool(scene, tile.home.x, tile.home.y, { color: PAL.mag3, radius: 26, floorY: tile.home.y, intensity: 0.8, anim: 'breathe', fadeIn: 0 });
  let stopped = false;
  let acc = 0;
  const stop = onFrame(scene, (dt) => {
    if (stopped || !tile.active || !tile.visible) return false;
    acc += dt;
    if (acc >= 50) {
      acc = 0;
      const side = rnd() < 0.5 ? -1 : 1;
      sp.add({ x: Math.round(tile.home.x + side * rr(13, 22)), y: Math.round(tile.home.y - rr(4, 50)), vy: rr(-30, -14), vx: side * rr(2, 8), life: rr(260, 460), colors: [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], shape: rnd() < 0.2 ? 'plus' : 'px', fadeAt: 1 });
    }
    return true;
  });
  return () => {
    if (stopped) return;
    stopped = true;
    stop();
    sp.release();
    void glow.fadeOut(240);
  };
}

/** Ayna Kalkanı's accent: a white glint sweeps the standing card's face (≈ 200 ms). */
function mirrorGlint(scene: Phaser.Scene, face: XY): void {
  const ras = Raster.around(scene, face.x, face.y, 44, 60, DEPTH.FX + 6);
  void run(scene, 220, (t) => {
    ras.draw((g) => {
      const gx = Math.round(face.x - 22 + 44 * E.inOutSine(t));
      for (let k = -24; k <= 24; k++) {
        const xx = gx + Math.round(k * 0.45);
        g.px(xx, face.y + k, PAL.white);
        g.px(xx + 1, face.y + k, PAL.cyan4);
      }
    });
  }).then(() => ras.destroy());
}

/**
 * Ayna Kalkanı's accent, lane A5-A (V3_A5_A; A5_PLAN §3.3): the glint sweeps the standing card like
 * light over glass — a 2-px white band with a 1-px mist edge on each side, only over the card's own
 * pixels (never past its edges), in the mirror's tones (no cyan), ≈ 200 ms, whole pixels.
 */
function mirrorGlintV3(scene: Phaser.Scene, tile: TileCard): void {
  const cp = tile.currentPixels();
  const W = cp.px.w;
  const H = cp.px.h;
  // just over the card itself — a body standing in front of the card stays in front of its glint
  const ras = new Raster(scene, cp.x, cp.y, W, H, tile.depth + 0.01);
  const slope = 0.45;
  const span = W + Math.ceil(H * slope) + 4;
  void run(scene, 220, (t) => {
    const gx = Math.round(-Math.ceil(H * slope) - 2 + span * E.inOutSine(t));
    ras.begin();
    for (let y = 0; y < H; y++) {
      const x0 = gx + Math.round(y * slope);
      for (let d = -1; d <= 2; d++) {
        const x = x0 + d;
        if (x < 0 || x >= W || cp.px.alpha(x, y) === 0) continue;
        ras.px(cp.x + x, cp.y + y, d === 0 || d === 1 ? PAL.white : PAL.mist);
      }
    }
    ras.end();
  }).then(() => ras.destroy());
}

/** Yer Yarığı's accent: hairline cracks race out over the floor round the tile, a little dust (≈ 300 ms). */
function floorCracks(scene: Phaser.Scene, at: XY): void {
  const ras = Raster.around(scene, at.x, at.y, 110, 56, DEPTH.SHADOW - 1);
  const cracks = [0.3, 2.2, 3.6, 5.1].map((a) => ({ a: a + rr(-0.2, 0.2), len: rr(22, 40) }));
  const sp = new PxSparks(scene, DEPTH.FX - 2);
  void run(scene, 320, (t) => {
    const k = E.outCubic(seg(t, 0, 0.5));
    ras.draw((g) => {
      for (const c of cracks) {
        const L = c.len * k;
        let px = at.x;
        let py = at.y;
        for (let s = 0; s < L; s += 4) {
          const nx = at.x + Math.cos(c.a + Math.sin(s * 0.7) * 0.25) * s;
          const ny = at.y + Math.sin(c.a + Math.sin(s * 0.7) * 0.25) * s * 0.5;
          g.line(px, py, nx, ny, t < 0.6 ? PAL.mag3 : PAL.mag2, 1 - seg(t, 0.6, 1));
          px = nx;
          py = ny;
        }
      }
    });
    if (rnd() < 0.3) sp.add({ x: Math.round(at.x + rr(-24, 24)), y: Math.round(at.y + rr(-6, 6)), vy: rr(-24, -10), life: rr(260, 420), size: rr(1.5, 2.5), shape: 'puff', colors: [PAL.night4, PAL.night3, PAL.night2], fadeAt: 1 });
  }).then(() => {
    ras.destroy();
    sp.release();
  });
}

/**
 * The single short "TUZAK!" accent (v3): stamped letter by letter over the standing card on a small
 * magenta plate, held a beat, gone — world space, ≈ 0.32 s, never a full-width band. Resolves when gone.
 */
export function trapWord(scene: Phaser.Scene, at: XY, text = 'TUZAK!'): Promise<void> {
  const cx = Math.round(at.x);
  const cy = Math.round(at.y);
  const L = pixelLetters(scene, cx, cy, text, { size: 'lg', color: PAL.white, originX: 0.5, originY: 0.5, shadow: 1 });
  const letters = L.letters;
  for (const l of letters) l.obj.setDepth(DEPTH.FX_TOP + 21).setVisible(false).setPosition(Math.round(l.x), Math.round(l.y));
  const W = Math.round(L.w) + 14;
  const H = 18;
  const plate = new Raster(scene, cx - W / 2 - 4, cy - H / 2 - 2, W + 8, H + 4, DEPTH.FX_TOP + 20);
  let open = 0;
  const drawPlate = () =>
    plate.draw((g) => {
      const w = Math.round(W * open);
      if (w < 2) return;
      const l = cx - Math.floor(w / 2);
      const t = cy - H / 2;
      g.rect(l, t + 1, w, H - 2, PAL.ink);
      g.rect(l, t, w, 1, PAL.mag3);
      g.rect(l, t + H - 1, w, 1, PAL.mag3);
      g.rect(l + 1, t + 2, w - 2, 1, PAL.mag1);
      g.px(l - 2, cy, PAL.mag4);
      g.px(l + w + 1, cy, PAL.mag4);
    });
  const STAG = 14;
  return (async () => {
    // the plate snaps open (3 steps), the letters stamp in: a magenta frame, then white
    await run(scene, 40, (t) => {
      open = Math.min(1, Math.ceil(t * 3) / 3);
      drawPlate();
    });
    open = 1;
    drawPlate();
    await run(scene, STAG * letters.length + 60, (_t, el) => {
      letters.forEach((l, i) => {
        const lt = el - i * STAG;
        if (lt < 0 || !l.obj.active) return;
        l.obj.setVisible(true);
        l.obj.setTint(lt < 34 ? PAL.mag4 : PAL.white);
        l.obj.setY(Math.round(l.y) - (lt < 17 ? 2 : lt < 34 ? 1 : 0));
      });
    });
    await sleep(scene, 70);
    // out: the letters go right → left, the plate closes in steps
    await run(scene, 60, (t) => {
      const n = Math.ceil(letters.length * (1 - t));
      letters.forEach((l, i) => l.obj.active && l.obj.setVisible(i < n));
      open = Math.max(0, 1 - Math.ceil(t * 3) / 3);
      drawPlate();
    });
    for (const l of letters) l.obj.destroy();
    plate.destroy();
  })();
}

/**
 * The short result of a negated attack (v3): a compact plate that drops out from under the HUD's
 * phase bar (under its SAVAŞ segment — that is where the battle phase ends), holds, and folds back
 * up. Screen space (the HUD camera), ≈ 0.5 s; never a full-width band. Resolves when gone.
 */
export function resultPlate(scene: Phaser.Scene, text: string, color: number = PAL.mag3): Promise<void> {
  const bar = UI.phaseBar;
  const cx = Math.round(bar.x + bar.w * 0.62);
  const tm = measureText(text, 'md');
  const W = Math.round(tm.w) + 20;
  const H = 15;
  const top = bar.y + bar.h + 1;
  const D = DEPTH.HUD + 40;
  const ras = new Raster(scene, cx - W / 2 - 4, top, W + 8, H + 2, D);
  ras.img.setScrollFactor(0);
  const txt = pixelText(scene, cx, top + Math.round(H / 2), upper(text), { size: 'md', color: PAL.white, originX: 0.5, originY: 0.5 }).setDepth(D + 1).setScrollFactor(0).setVisible(false);
  const ramp = [PAL.ink, color, PAL.white] as const;
  let drop = 0;
  const draw = () =>
    ras.draw((g) => {
      const h = Math.round(H * drop);
      if (h < 1) return;
      const l = cx - Math.floor(W / 2);
      // the plate hangs from the bar: its body slides down, the rail at its foot
      g.rect(l, top, W, h, ramp[0]);
      g.rect(l, top + h - 1, W, 1, ramp[1]);
      g.rect(l, top, 1, h, ramp[1]);
      g.rect(l + W - 1, top, 1, h, ramp[1]);
      if (h >= H) {
        g.px(l + 2, top + h - 3, ramp[2]);
        g.px(l + W - 3, top + h - 3, ramp[2]);
      }
    });
  return (async () => {
    await run(scene, 80, (t) => {
      drop = Math.min(1, Math.ceil(t * 4) / 4);
      draw();
      txt.setVisible(drop >= 1);
      txt.setY(top + Math.round(H / 2) - Math.round((1 - drop) * H));
    });
    drop = 1;
    draw();
    txt.setVisible(true).setY(top + Math.round(H / 2));
    // a colour step runs over the word, then it rests
    await run(scene, 100, (t) => txt.active && txt.setTint(t < 0.5 ? color : PAL.white));
    await sleep(scene, 250);
    await run(scene, 80, (t) => {
      drop = Math.max(0, 1 - Math.ceil(t * 4) / 4);
      draw();
      txt.setVisible(drop >= 0.75);
    });
    txt.destroy();
    ras.destroy();
  })();
}

/** The v3 trap opening (see the section header). */
async function trapOpeningV3(ctx: ActCtx, o: { focus?: XY } = {}): Promise<Opening> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const pulse = ctx.take('trapPulse');
  if (isSetPulse(pulse)) pulse.destroy();
  else pulse?.destroy();
  const tile = ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null;
  const live = tile && tile.active ? tile : null;
  const at = live ? { x: Math.round(live.home.x), y: Math.round(live.home.y) } : ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', LANE_MID);
  if (live) live.setCard(ev.cardId);
  void ctx.focus(o.focus ?? { x: at.x, y: at.y - 30 }, { ms: 240, pan: 0.25 });
  void duelist(ctx, ev.player)?.play('command');
  const stand = live ? live.standUp(220, { reveal: true }) : Promise.resolve();
  await wait(sc, 40);
  // the v3 trap accent: a short snap + stab (src/audio/v3/slice.ts trapOpen), on the burst frame;
  // an attacker's held charge sound (the declaration's, _v3/sound.ts) gives the beat to the trap
  dropAllCharges(140);
  playV3('trapOpen', { volume: 1 });
  const face0 = live ? standFace(live) : { x: at.x, y: at.y - 36 };
  trapBurstV3(sc, at, face0);
  void shake(sc, 140, 1);
  await stopTime(sc, 40);
  await stand;
  const face = live && live.active ? standFace(live) : face0;
  let stopAura = () => undefined as void;
  if (live && live.active) stopAura = cardAuraV3(sc, live);
  // the card's own accent
  if (ev.cardId === 'chains_of_light') {
    playV3('chainRattle', { volume: 0.85 });
    void chainRattle(sc, face);
  } else if (ev.cardId === 'mirror_barrier') {
    if (V3_A5_A && live && live.active) mirrorGlintV3(sc, live);
    else mirrorGlint(sc, face);
  }
  // (A5-A, V3_A5_A: Yer Yarığı's crack root is drawn by its scene — traps/_chasm_v3.ts — not as a separate accent)
  else if (ev.cardId === 'chasm_trap' && !V3_A5_A) floorCracks(sc, at);
  // ONE short local "TUZAK!" over the card
  const word = trapWord(sc, { x: at.x, y: face.y - 36 });
  await wait(sc, 100);
  return { tile: live, at, face, banner: word, stopAura };
}

/** The v3 trap exit: the spent card lies back down on its tile and leaves for the graveyard from there. */
async function trapExitV3(ctx: ActCtx, op: Opening): Promise<void> {
  const ev = ctx.ev;
  op.stopAura();
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
  if (gi < 0) return;
  const gEv = ctx.events[gi] as Extract<typeof ctx.events[number], { type: 'toGraveyard' }>;
  ctx.consumeAt(gi);
  const { tile } = ctx.views.field.release(ev.uid);
  if (tile && tile.active) {
    if (tile.standing) await tile.layDown(180);
    return cardLeaves(ctx, { owner: gEv.owner, cardId: ev.cardId, from: { x: Math.round(tile.home.x), y: Math.round(tile.home.y) }, tile });
  }
  return cardLeaves(ctx, { owner: gEv.owner, cardId: ev.cardId, from: { x: Math.round(op.at.x), y: Math.round(op.at.y) } });
}
