// The QUICK-SPELL RESPONSE REVEAL (lane E; docs/v3/YENI_KARTLAR.md §2.1 M11, §7 S7 / S9) — a reusable skeleton,
// no registrations. A set quick spell (Burgu Mızrağı, Saman Korkuluklar) answers the opponent's attack declaration
// or summon: its card SNAPS upright on its own tile with a turquoise zig-zag flash and a short, punchy
// "HIZLI BÜYÜ!" plate — the spell's own answer to the trap's magenta "TUZAK!" (traps/_opening.ts), never the same
// shape, colour or sound:
//
//   const q = await quickReveal(ctx);           // card standing, the word stamped, ~0.36 s of scene time
//   ... the card's own signature (or q.prime(ctx) when its target is chosen in a later batch) ...
//   q.stopAura();
//
// Beats (scene ms, v3 look only; tempo 1.35 in game time):
//   0     the duelist commands; the face-down tile kicks (1 px dip) — anticipation
//   40    SNAP: the card springs upright (140 ms, faster than a trap's 220) — e_quickReveal (FM zig-zag zap + snap +
//         "ready!" arpeggio); a turquoise ZIG-ZAG bolt shoots up out of the tile (3 strokes, a white core, 1-px
//         forks), horizontal speed lines whip past the card, a teal floor ring + the stepped light, 1 px shake,
//         a 40 ms freeze
//   ~180  the card stands: a zig-zag spark crawls round its edge, teal motes rise beside it (aura, until stopped)
//   ~190  "HIZLI BÜYÜ!": the plate cuts open from its two chevron ends, the letters slide in from the right one by
//         one (teal4 → white), held, then whip out to the left
//   ~360  resolves (the word is still leaving: `word`)
//
// prime(): when the card's target is picked in a LATER batch (a human chooses after the reveal), the card cannot
// stay standing across the batch (the field's sync lays a standing tile flat in one frame), so it lies back down
// itself, COCKED: a turquoise pulse runs round its tile and a zig-zag spark ticks on it until the next batch
// takes the handle (ctx.keep / ctx.take with the returned key).

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { FLAT_H, FLAT_W, STAND_H, STAND_W, cardMip, isoProject, poseAxes, qSlerp, renderCard, restQuat, standQuat, type Quat } from '../../art/cards';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, LANE_MID, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { pixelLetters } from '../../ui/text';
import { shake, wait } from '../../vfx/core';
import { Sparks as PxSparks, stopTime } from '../../vfx/combat';
import { E, Raster, floorRing, onFrame, run, seg, tileFlash } from '../../vfx/setpieces';
import { cardLeaves } from '../_v3/card';
import { dropAllCharges, play as playV3 } from '../_v3/sound';
import { fxRng } from '../_v3/spellfx';
import type { CinematicContext } from '../api';

type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;
type AnyCtx = CinematicContext<GameEvent>;

/** The quick spell's turquoise: teal with a cyan-white core (the spell family colour, never the trap's magenta). */
export const QUICK_RAMP = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1] as const;

export interface QuickReveal {
  /** The quick spell's TileCard (standing now), or null if it was not on screen. */
  tile: TileCard | null;
  /** Floor point of its zone. */
  at: XY;
  /** The standing card's face centre. */
  face: XY;
  /** Resolves when the "HIZLI BÜYÜ!" plate has fully left. */
  word: Promise<void>;
  /** Resolves on the frame the plate starts leaving (the card may lie down WITH it, never after). */
  leaving?: Promise<void>;
  /** Stop the card's aura (motes, edge spark, light). */
  stopAura(): void;
}

/** Where a standing TileCard's face is (its centre, TileCard.standUp pose at scale 1). */
export function standFaceOf(t: { home: XY }): XY {
  const [, py] = isoProject([0, 0, STAND_H / 2 + 2]);
  return { x: Math.round(t.home.x), y: Math.round(t.home.y + py) };
}

/** A zig-zag polyline from `from` going up `h` px: `n` strokes alternating left / right by `amp` (whole pixels). */
function zigzag(from: XY, h: number, n: number, amp: number, lean = 0): XY[] {
  const pts: XY[] = [{ x: from.x, y: from.y }];
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const side = i === n ? 0 : i % 2 ? 1 : -1;
    pts.push({ x: Math.round(from.x + side * amp + lean * k), y: Math.round(from.y - h * k) });
  }
  return pts;
}

/** The turquoise zig-zag flash at a quick spell's tile (~380 ms, fire-and-forget): crisp pixels + stepped light. */
export function quickFlash(scene: Phaser.Scene, at: XY, face: XY, seed = 7): void {
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  const rnd = fxRng(seed);
  void tileFlash(scene, x, y, [...QUICK_RAMP], 300);
  void floorRing(scene, x, y, { r0: 6, r1: 46, ms: 340, ramp: [...QUICK_RAMP], depth: DEPTH.SHADOW - 1 });
  void lightFlash(scene, x, y, PAL.teal3, 40, 420, { floorY: y, ring: true, intensity: 1.15 });
  void lightFlash(scene, x, face.y - 30, PAL.teal4, 26, 300, { floorY: y, air: 0.7, intensity: 0.8 });
  const H = 92;
  const ras = new Raster(scene, x - 40, y - H - 12, 80, H + 16, DEPTH.FX + 6);
  // two bolts: the main one (3 strokes, 1-px white core in a 3-px teal4 body) and a thin teal3 echo, mirrored
  const main = zigzag({ x, y: y - 2 }, H, 5, 7, 0);
  const echo = zigzag({ x: x + 1, y: y - 4 }, Math.round(H * 0.72), 4, -5, 2);
  // forks off the main bolt's kinks
  const forks = [1, 3].map((i) => {
    const p = main[i];
    const dir = i % 2 ? 1 : -1;
    return [p, { x: p.x + dir * 6, y: p.y - 3 }, { x: p.x + dir * 9, y: p.y - 8 }];
  });
  // speed lines: horizontal streaks whipping past the card's face (its "quick" motion), right → left
  const lines = Array.from({ length: 7 }, (_, i) => ({ y: face.y - 22 + i * 7 + Math.round(rnd() * 3), len: 10 + Math.round(rnd() * 12), off: Math.round(rnd() * 10) }));
  const sp = new PxSparks(scene, DEPTH.FX + 7);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const v = 50 + rnd() * 90;
    sp.add({ x, y: face.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 20, drag: 3, life: 200 + rnd() * 200, colors: [...QUICK_RAMP], shape: i % 4 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sp.release();
  const lineSeg = (g: Raster, pts: readonly XY[], n: number, c: number, w: number) => {
    for (let i = 1; i < Math.min(pts.length, n + 1); i++) g.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, c, 1, w);
  };
  void run(scene, 380, (t) => {
    ras.draw((g) => {
      // the bolt shoots up stroke by stroke (≈ 70 ms), holds two flickers, then breaks up from the bottom
      const grow = Math.ceil(E.outCubic(seg(t, 0, 0.2)) * 5);
      const gone = Math.floor(seg(t, 0.45, 0.95) * 6);
      if (t < 0.95) {
        const vis = main.slice(gone);
        const flick = Math.floor(t * 20) % 3 !== 1;
        lineSeg(g, vis, grow - gone, PAL.teal3, 3);
        lineSeg(g, vis, grow - gone, flick ? PAL.white : PAL.teal4, 1);
        if (t > 0.08 && t < 0.6) lineSeg(g, echo, Math.min(4, grow), PAL.teal2, 1);
        if (t > 0.12 && t < 0.5 && gone < 2) for (const f of forks) lineSeg(g, f, 2, Math.floor(t * 30) % 2 ? PAL.teal4 : PAL.teal3, 1);
        // the tip star while it is still climbing
        const tip = main[Math.min(main.length - 1, grow)];
        if (t < 0.35) {
          g.px(tip.x, tip.y, PAL.white);
          g.px(tip.x - 1, tip.y, PAL.teal4);
          g.px(tip.x + 1, tip.y, PAL.teal4);
          g.px(tip.x, tip.y - 1, PAL.teal4);
        }
      }
      // speed lines streak right → left past the face
      const k = seg(t, 0.05, 0.6);
      if (k > 0 && k < 1)
        for (const l of lines) {
          const x1 = Math.round(x + 34 - k * 70 - l.off);
          const len = Math.round(l.len * (1 - k * 0.5));
          g.rect(x1, l.y, len, 1, k < 0.4 ? PAL.teal4 : PAL.teal2);
          g.px(x1, l.y, PAL.white);
        }
    });
  }).then(() => ras.destroy());
}

/** A zig-zag spark that crawls round a standing card's edge + teal motes rising beside it (until stopped). */
function quickAura(scene: Phaser.Scene, tile: TileCard, seed = 11): () => void {
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, DEPTH.FX - 3);
  const glow = lightPool(scene, tile.home.x, tile.home.y, { color: PAL.teal3, radius: 26, floorY: tile.home.y, intensity: 0.8, anim: 'flicker', fadeIn: 0 });
  const face = standFaceOf(tile);
  const W = 36;
  const H = 52;
  const ras = Raster.around(scene, face.x, face.y, W + 8, H + 8, tile.depth + 0.02);
  let stopped = false;
  let acc = 0;
  const per = 2 * (W + H);
  const at = (d: number): XY => {
    d = ((d % per) + per) % per;
    const l = face.x - W / 2;
    const tp = face.y - H / 2;
    if (d < W) return { x: l + d, y: tp };
    d -= W;
    if (d < H) return { x: l + W, y: tp + d };
    d -= H;
    if (d < W) return { x: l + W - d, y: tp + H };
    d -= W;
    return { x: l, y: tp + H - d };
  };
  const stop = onFrame(scene, (dt, el) => {
    if (stopped || !tile.active || !tile.visible) {
      ras.destroy();
      return false;
    }
    acc += dt;
    if (acc >= 60) {
      acc = 0;
      const side = rnd() < 0.5 ? -1 : 1;
      sp.add({ x: Math.round(tile.home.x + side * (12 + rnd() * 10)), y: Math.round(tile.home.y - 4 - rnd() * 46), vy: -14 - rnd() * 16, vx: side * (2 + rnd() * 6), life: 240 + rnd() * 200, colors: [PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1], shape: rnd() < 0.2 ? 'plus' : 'px', fadeAt: 1 });
    }
    ras.draw((g) => {
      // the crawling spark: a 6-px zig-zag tail chasing round the card's edge
      const head = Math.floor(el * 0.22);
      for (let k = 0; k < 7; k++) {
        const p = at(head - k * 2);
        const j = k % 2 ? 1 : -1;
        const onSide = p.x === Math.round(face.x - W / 2) || p.x === Math.round(face.x + W / 2);
        g.px(Math.round(p.x + (onSide ? j : 0)), Math.round(p.y + (onSide ? 0 : j)), k === 0 ? PAL.white : k < 3 ? PAL.teal4 : PAL.teal3);
      }
    });
    return true;
  });
  return () => {
    if (stopped) return;
    stopped = true;
    stop();
    ras.destroy();
    sp.release();
    void glow.fadeOut(220);
  };
}

export interface QuickWordOpts {
  /** A subtitle under the plate (the card's name), typed on in teal on its own thin plate. */
  sub?: string;
  /** Extra hold (ms) once every letter is in (default 0; the base hold is 90 ms). */
  hold?: number;
  /** Called on the frame the word starts whipping out (the card may lie down with it). */
  onOut?: () => void;
}

/**
 * "HIZLI BÜYÜ!" (v3): stamped over the standing card on a small dark plate with turquoise chevron ends; the
 * letters slide in from the right (speed), held a beat, then whip out to the left. World space, ≈ 0.4 s.
 */
export function quickWord(scene: Phaser.Scene, at: XY, text = 'HIZLI BÜYÜ!', o: QuickWordOpts = {}): Promise<void> {
  const cx = Math.round(at.x);
  const cy = Math.round(at.y);
  const L = pixelLetters(scene, cx, cy, text, { size: 'lg', color: PAL.white, originX: 0.5, originY: 0.5, shadow: 1 });
  const letters = L.letters;
  for (const l of letters) l.obj.setDepth(DEPTH.FX_TOP + 21).setVisible(false).setPosition(Math.round(l.x), Math.round(l.y));
  const W = Math.round(L.w) + 16;
  const H = 18;
  const plate = new Raster(scene, cx - W / 2 - 10, cy - H / 2 - 2, W + 20, H + 4, DEPTH.FX_TOP + 20);
  let open = 0;
  let streak = 0;
  const drawPlate = () =>
    plate.draw((g) => {
      const w = Math.round(W * open);
      if (w < 2) return;
      const l = cx - Math.floor(w / 2);
      const r = l + w - 1;
      const t = cy - H / 2;
      // body + rails (teal3 top, teal1 under it; teal2 foot rail)
      g.rect(l, t + 1, w, H - 2, PAL.ink);
      g.rect(l, t, w, 1, PAL.teal3);
      g.rect(l + 1, t + 2, w - 2, 1, PAL.teal1);
      g.rect(l, t + H - 1, w, 1, PAL.teal2);
      // chevron ends ">" on both sides (pointing right: the direction of the slide), 1-px turquoise
      for (let k = 0; k < H / 2; k++) {
        const dx = Math.floor(k / 2);
        g.px(l - 2 - (Math.floor(H / 4) - dx), t + k, PAL.teal3);
        g.px(l - 2 - (Math.floor(H / 4) - dx), t + H - 1 - k, PAL.teal3);
        g.px(r + 2 + dx, t + k, PAL.teal4);
        g.px(r + 2 + dx, t + H - 1 - k, PAL.teal4);
      }
      // a white glint runs along the top rail once
      if (streak > 0 && streak < 1) {
        const gx = Math.round(l + w * streak);
        g.rect(gx - 3, t, 6, 1, PAL.white);
        g.px(gx, t + 1, PAL.teal4);
      }
    });
  // the subtitle (the card's name): a thin ink plate hanging under the main one, letters typed on left → right
  const SL = o.sub ? pixelLetters(scene, cx, cy + H / 2 + 7, o.sub, { size: 'sm', color: PAL.teal4, originX: 0.5, originY: 0.5, shadow: 1 }) : null;
  const subL = SL ? SL.letters : [];
  for (const l of subL) l.obj.setDepth(DEPTH.FX_TOP + 21).setVisible(false).setPosition(Math.round(l.x), Math.round(l.y));
  const SW = SL ? Math.round(SL.w) + 10 : 0;
  const SH = 11;
  const subPlate = SL ? new Raster(scene, cx - SW / 2 - 2, cy + H / 2, SW + 4, SH + 2, DEPTH.FX_TOP + 20) : null;
  let subOpen = 0;
  const drawSub = () =>
    subPlate?.draw((g) => {
      const w = Math.round(SW * subOpen);
      if (w < 2) return;
      const l = cx - Math.floor(w / 2);
      const t = cy + H / 2;
      g.rect(l, t, w, SH, PAL.ink);
      g.rect(l, t + SH - 1, w, 1, PAL.teal1);
      g.px(l, t + SH - 1, PAL.teal3);
      g.px(l + w - 1, t + SH - 1, PAL.teal3);
    });
  const STAG = 13;
  return (async () => {
    // the plate cuts open from the centre (3 steps)
    await run(scene, 45, (t) => {
      open = Math.min(1, Math.ceil(t * 3) / 3);
      drawPlate();
    });
    open = 1;
    drawPlate();
    // letters slide in from 8 px right, one by one: teal4 frame, then white, landing with a 1-px overshoot
    await run(scene, STAG * letters.length + 70, (_t, el) => {
      streak = Math.min(1, el / (STAG * letters.length + 70));
      drawPlate();
      letters.forEach((l, i) => {
        const lt = el - i * STAG;
        if (lt < 0 || !l.obj.active) return;
        l.obj.setVisible(true);
        const dx = lt < 14 ? 8 - Math.round(lt / 2) : lt < 28 ? -1 : 0;
        l.obj.setX(Math.round(l.x) + Math.max(-1, dx));
        l.obj.setTint(lt < 28 ? PAL.teal4 : PAL.white);
      });
    });
    streak = 0;
    drawPlate();
    if (SL) {
      // the name drops in under the word: its plate unrolls from the centre, the letters type on (5 ms apart)
      await run(scene, 40 + subL.length * 5, (_t, el) => {
        subOpen = Math.min(1, Math.ceil((el / 40) * 3) / 3);
        drawSub();
        subL.forEach((l, i) => {
          const lt = el - 20 - i * 5;
          if (lt < 0 || !l.obj.active) return;
          l.obj.setVisible(true).setTint(lt < 20 ? PAL.white : PAL.teal4);
        });
      });
      for (const l of subL) if (l.obj.active) l.obj.setVisible(true).setTint(PAL.teal4);
    }
    await wait(scene, 90 + (o.hold ?? 0));
    try {
      o.onOut?.();
    } catch (e) {
      console.error('[quick] onOut', e);
    }
    // out: the letters whip to the left (first ones first), the plate closes in steps
    await run(scene, 80, (t, el) => {
      letters.forEach((l, i) => {
        if (!l.obj.active) return;
        const lt = el - i * 4;
        if (lt > 0) l.obj.setX(Math.round(l.x) - Math.round(lt * 0.5)).setTint(PAL.teal3);
        l.obj.setVisible(lt < 40);
      });
      subL.forEach((l, i) => {
        if (!l.obj.active) return;
        const lt = el - i * 3;
        if (lt > 0) l.obj.setX(Math.round(l.x) - Math.round(lt * 0.6)).setTint(PAL.teal2);
        l.obj.setVisible(lt < 36);
      });
      open = Math.max(0, 1 - Math.ceil(t * 3) / 3);
      subOpen = open;
      drawPlate();
      drawSub();
    });
    for (const l of letters) l.obj.destroy();
    for (const l of subL) l.obj.destroy();
    plate.destroy();
    subPlate?.destroy();
  })();
}

/** The quick-spell reveal (see the header). v3 look only; the caller checks LOOK_V3. */
export async function quickReveal(ctx: ActCtx, o: { word?: string; focus?: XY; sub?: string; hold?: number } = {}): Promise<QuickReveal> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const tile = ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null;
  const live = tile && tile.active ? tile : null;
  const at = live ? { x: Math.round(live.home.x), y: Math.round(live.home.y) } : ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', LANE_MID);
  if (live) live.setCard(ev.cardId);
  // (the camera never moves: no focus)
  void ctx.views.duelists?.get(ev.player)?.play('command');
  // anticipation: the face-down tile dips one pixel and flashes teal once
  if (live) {
    live.y = live.home.y + 1;
    live.tileFlash(PAL.teal2, 120);
  }
  await wait(sc, 40);
  if (live && live.active) live.y = live.home.y;
  // SNAP
  dropAllCharges(120);
  playV3('e_quickReveal', { volume: 1 });
  const stand = live ? live.standUp(140, { reveal: true }) : Promise.resolve();
  const face0 = live ? standFaceOf(live) : { x: at.x, y: at.y - 36 };
  quickFlash(sc, at, face0, 7 + ev.uid);
  void shake(sc, 120, 1);
  await stopTime(sc, 40);
  await stand;
  const face = live && live.active ? standFaceOf(live) : face0;
  const stopAura = live && live.active ? quickAura(sc, live, 11 + ev.uid) : () => undefined;
  let onOut: () => void = () => undefined;
  const leaving = new Promise<void>((res) => (onOut = res));
  const word = quickWord(sc, { x: at.x, y: face.y - 38 }, o.word, { sub: o.sub, hold: o.hold, onOut: () => onOut() });
  void word.then(() => onOut());
  // the reveal holds so the card and its word read before the signature
  await wait(sc, 170);
  return { tile: live, at, face, word, leaving, stopAura };
}

/** The kept-handle key of a primed quick spell (see prime). */
export function primeKey(uid: number): string {
  return `quickPrimed:${uid}`;
}

/** What prime() keeps under primeKey(uid) (ctx.take returns it; destroy() stops the cocked loop). */
export interface PrimedHandle {
  destroy(): void;
  /** The cocked card's tile (null when it was not on screen). */
  tile: TileCard | null;
  /** Floor point of its zone. */
  at: XY;
}

/**
 * The target is picked in a later batch: the revealed card lies back down on its tile WITH the word leaving
 * (never after it), COCKED — e_quickPrime (a cocking click + a low teal hum tick) on the lie-down frame, a
 * turquoise pulse loops round the tile, a zig-zag spark ticks on it — until the next batch takes the handle
 * (ctx.take(primeKey(uid)), then quickFire) or the Director drops it. Resolves when the card lies flat.
 */
export async function prime(ctx: AnyCtx, q: QuickReveal, uid: number): Promise<void> {
  const sc = ctx.scene;
  // the card lies down as the word starts whipping out (the plate is gone 80 ms later, the card flat at 140)
  if (q.leaving) await q.leaving;
  else await q.word;
  q.stopAura();
  const t = q.tile;
  if (t && t.active && t.standing) {
    void wait(sc, 95).then(() => playV3('e_quickPrime', { volume: 0.8 }));
    await t.layDown(140);
  }
  const at = q.at;
  const ras = Raster.around(sc, at.x, at.y, 64, 36, DEPTH.SHADOW - 1);
  const glow = lightPool(sc, at.x, at.y, { color: PAL.teal2, radius: 20, floorY: at.y, intensity: 0.55, anim: 'breathe', fadeIn: 120 });
  let dead = false;
  const stop = onFrame(sc, (_dt, el) => {
    if (dead) return false;
    ras.draw((g) => {
      // a ring of 4 chevrons orbiting the tile (iso ellipse), and a tick of zig-zag every 420 ms
      const a0 = el * 0.004;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 2;
        const px = Math.round(at.x + Math.cos(a) * 26);
        const py = Math.round(at.y + Math.sin(a) * 13);
        g.px(px, py, PAL.teal3);
        g.px(px - 1, py, PAL.teal2);
        g.px(px + 1, py, PAL.teal2);
      }
      const ph = el % 420;
      if (ph < 60) {
        const z = zigzag({ x: at.x, y: at.y - 2 }, 14, 3, 2);
        for (let i = 1; i < z.length; i++) g.line(z[i - 1].x, z[i - 1].y, z[i].x, z[i].y, ph < 30 ? PAL.white : PAL.teal4);
      }
    });
    return true;
  });
  const handle: PrimedHandle = {
    tile: t && t.active ? t : null,
    at,
    destroy() {
      if (dead) return;
      dead = true;
      stop();
      ras.destroy();
      void glow.fadeOut(160);
    },
  };
  ctx.keep(primeKey(uid), handle);
}

/** A primed (cocked) quick spell firing in the batch that brings its target (see quickFire). */
export interface QuickFire {
  /** The quick spell's tile (hidden under the leaning proxy; null when it was not on screen). */
  tile: TileCard | null;
  /** Floor point of its zone. */
  at: XY;
  /** The leaning card's top edge: where the spell's orb leaves it. */
  top: XY;
  /** The effect has taken over: the card lies back down, dimmed (≈ 120 ms), so the eye goes to the target. */
  settle(): Promise<void>;
  /** The spent card goes to its owner's graveyard from its tile (consumes toGraveyard `gi`; −1: it just fades). */
  leave(gi: number): Promise<void>;
  /** Nothing to resolve: the card dissolves on its tile. */
  close(): Promise<void>;
}

/** The lean of a fired quick card: ~60° up off its tile (slerp share of the stand-up), never a full re-reveal. */
const LEAN = 0.5;
const LEAN_SCALE = 0.64;

/** A whole-pixel proxy of the quick card hinging up off its tile (the cock-and-release pose). */
class LeanCard {
  private readonly ras: Raster;
  private readonly front;
  private readonly back;
  private readonly rest: Quat;
  constructor(
    readonly scene: Phaser.Scene,
    readonly at: XY,
    cardId: CardId,
    player: PlayerId,
    depth: number,
  ) {
    this.ras = new Raster(scene, at.x - 48, at.y - 64, 96, 96, depth);
    this.front = cardMip(cardId, player);
    this.back = cardMip('back', player);
    this.rest = restQuat(player, 'up', true);
  }
  /** Draw at lean k (0 flat … 1 standing); returns the card's top-edge midpoint on screen. */
  draw(k: number, o: { dip?: number; squash?: number; light?: number; glint?: number; tint?: number; tintAmt?: number } = {}): XY {
    const kk = Math.max(0, Math.min(1.1, k));
    const q = qSlerp(this.rest, standQuat(), kk);
    const s = o.squash ?? 1;
    const w = (FLAT_W + (STAND_W * LEAN_SCALE - FLAT_W) * Math.min(1, kk)) * s;
    const h = (FLAT_H + (STAND_H * LEAN_SCALE - FLAT_H) * Math.min(1, kk)) * s;
    const z = (h / 2) * Math.sin((Math.min(1, kk) * Math.PI) / 2);
    const [, py] = isoProject([0, 0, z]);
    const cy = Math.round(this.at.y + py) + (o.dip ?? 0);
    if (!this.ras.alive) return { x: this.at.x, y: cy };
    this.ras.moveTo(this.at.x - 48, cy - 64);
    this.ras.begin();
    const { ex, ey, n } = poseAxes(q, w, h);
    renderCard(this.ras.pc, 48, 64, ex, ey, n, this.front, this.back, { light: o.light, glint: o.glint, tint: o.tint, tintAmt: o.tintAmt });
    this.ras.end();
    return { x: Math.round(this.at.x - ey[0] / 2), y: Math.round(cy - ey[1] / 2) };
  }
  destroy(): void {
    this.ras.destroy();
  }
}

/**
 * The cocked card FIRES — a small COCK-AND-RELEASE, a follow-through of the reveal, never a second one (≈ 120 ms
 * scene): the flat card kicks a pixel down into its tile (the cock, e_quickFire's snap), then hinges up to a
 * ~60° lean with a tiny overshoot while ONE teal spark ticks off its top edge; the caller launches its effect
 * from `top` at once, then calls settle() when the effect lands (the card lies back down, dimmed). The card
 * leaves the field's bookkeeping here (the spell owns it until leave()).
 */
export async function quickFire(ctx: AnyCtx, o: { uid: Uid; cardId: CardId; player: PlayerId; zone: number | null }): Promise<QuickFire> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const kept = ctx.take(primeKey(o.uid)) as PrimedHandle | null;
  kept?.destroy();
  const t0 = o.zone !== null ? field.tileAt(o.player, 'spellTrap', o.zone) : null;
  const tile = t0 && t0.active ? t0 : null;
  const at = tile ? { x: Math.round(tile.home.x), y: Math.round(tile.home.y) } : kept ? kept.at : zoneXY(o.player, 'spellTrap', o.zone ?? LANE_MID);
  void ctx.views.duelists?.get(o.player)?.play('command');
  playV3('e_quickFire', { volume: 0.95 });
  let lean: LeanCard | null = null;
  if (tile) {
    tile.setCard(o.cardId);
    lean = new LeanCard(sc, at, o.cardId, o.player, unitDepth(at.y) - 1);
    lean.draw(0);
    tile.setVisible(false);
    field.release(o.uid);
  }
  // the cock: the card dips a pixel into its tile, squashed, darker; a tile tick in the quick teal
  void tileFlash(sc, at.x, at.y, [PAL.teal3, PAL.teal2, PAL.teal1], 140);
  await run(sc, 35, () => lean?.draw(0, { dip: 1, squash: 0.94, light: -0.2 }));
  // the release: it hinges up to its lean with a small overshoot; ONE spark ticks off the top edge
  void floorRing(sc, at.x, at.y, { r0: 5, r1: 20, ms: 160, ramp: [PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1], depth: DEPTH.SHADOW - 1 });
  void lightFlash(sc, at.x, at.y, PAL.teal3, 22, 200, { floorY: at.y, intensity: 0.7 });
  let top: XY = { x: at.x, y: at.y - 30 };
  const spark = new Raster(sc, at.x - 20, at.y - 90, 40, 94, DEPTH.FX + 6);
  await run(sc, 85, (t) => {
    const k = LEAN * (1 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * E.outCubic(Math.min(1, t * 1.25));
    top = lean ? lean.draw(k, { light: t < 0.5 ? 0.18 : 0.05 }) : top;
    spark.draw((g) => {
      if (t < 0.35 || t > 0.9) return;
      // the tick: a 3-stroke zig-zag spark, 12 px, standing off the top edge (white core, teal4 ends)
      const z = zigzag({ x: top.x, y: top.y - 2 }, 12, 3, 2);
      for (let i = 1; i < z.length; i++) g.line(z[i - 1].x, z[i - 1].y, z[i].x, z[i].y, t < 0.6 ? PAL.white : PAL.teal4);
      g.px(z[z.length - 1].x, z[z.length - 1].y - 1, PAL.teal3);
    });
  });
  spark.destroy();
  if (lean) top = lean.draw(LEAN, { light: 0.05 });
  let settled: Promise<void> | null = null;
  const settle = (): Promise<void> => {
    if (settled) return settled;
    const l = lean;
    settled = l
      ? run(sc, 120, (t) => {
          const e = E.inQuad(t);
          l.draw(LEAN * (1 - e), { light: -0.25 * t });
        }).then(() => {
          l.draw(0, { light: -0.25 });
        })
      : Promise.resolve();
    return settled;
  };
  return {
    tile,
    at,
    top,
    settle,
    async leave(gi) {
      await settle();
      const g = gi >= 0 && !ctx.isConsumed(gi) ? ctx.events[gi] : null;
      if (!g || g.type !== 'toGraveyard') {
        await close();
        return;
      }
      ctx.consumeAt(gi);
      // born from the flat proxy on the same frame (the same pose, no re-raise)
      const p = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: at, tile });
      lean?.destroy();
      return p;
    },
    close,
  };
  async function close(): Promise<void> {
    const l = lean;
    if (l) {
      await run(sc, 240, (t) => l.draw(0, { light: -0.25, tint: PAL.teal1, tintAmt: t }));
      l.destroy();
    }
    if (tile && tile.active) tile.destroy();
  }
}
