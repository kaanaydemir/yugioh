// HD trial cine — the summon card: an HD card face (64×90, gold ace frame, the HD monster's own head as artwork,
// level stars, stats) that drops in upright, tips flat into the iso floor plane (inverse-bilinear warped frames,
// nearest sampled, so it stays crisp) and slams onto its tile.

import Phaser from 'phaser';
import { PAL, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { drawAttributeOrb, drawDigits, digitsWidth } from '../../art/cards';
import type { Attribute } from '../../data/cards';
import { DEPTH } from '../../view/layout';
import type { HDMonsterArt } from '../contracts';
import { drawText, textWidth } from './_hud';
import { E, GOLD, Sparks, lerp, type Cine, type XY } from './_kit';

export const CARD_W = 64;
export const CARD_H = 90;

const STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
const STAR_SH = ['..a..', '.aab.', 'aabbc', '.bbc.', '.c.c.'];

export interface CardSpec {
  name: string;
  attribute: Attribute;
  level: number;
  atk: number;
  def: number;
  art: HDMonsterArt;
  /** Crop centre of the artwork in the monster's idle frame 0 (frame pixels). */
  focus: XY;
  /** Frame ramp (dark → light). */
  frame: Ramp;
}

/** The HD card face. */
export function cardFace(s: CardSpec): PixelCanvas {
  const W = CARD_W;
  const H = CARD_H;
  const p = new PixelCanvas(W, H);
  const F = s.frame;
  // body + bevelled metal frame (lit from the top-left)
  p.rect(1, 0, W - 2, H, PAL.ink).rect(0, 1, W, H - 2, PAL.ink);
  p.rect(1, 1, W - 2, H - 2, F[2]);
  p.hline(2, W - 3, 1, F[4]).vline(1, 2, H - 3, F[3]);
  p.hline(2, W - 2, H - 2, F[0]).vline(W - 2, 2, H - 3, F[1]);
  p.rect(3, 3, W - 6, H - 6, F[1]);
  p.rect(4, 4, W - 8, H - 8, PAL.night0);
  // name plate
  p.rect(5, 5, W - 10, 11, PAL.ink).rect(6, 6, W - 12, 9, PAL.night2);
  p.hline(6, W - 7, 6, PAL.night3);
  const nw = textWidth(s.name);
  drawText(p, Math.floor((W - nw) / 2), 4, s.name, PAL.white);
  // level stars + attribute orb
  for (let i = 0; i < s.level; i++) p.stamp(STAR_SH, { a: PAL.gold4, b: PAL.gold3, c: PAL.fire3 }, W - 11 - i * 6, 18);
  void STAR;
  drawAttributeOrb(p, 5, 16, s.attribute);
  // artwork window: a soft attribute backdrop and the monster's own HD head (1:1 pixels)
  const ax = 6;
  const ay = 27;
  const aw = W - 12;
  const ah = 38;
  p.rect(ax - 1, ay - 1, aw + 2, ah + 2, PAL.ink);
  for (let y = 0; y < ah; y++)
    for (let x = 0; x < aw; x++) {
      const d = Math.hypot((x - aw * 0.62) / aw, (y - ah * 0.45) / ah);
      const c = d < 0.18 ? PAL.gold4 : d < 0.32 ? PAL.gold3 : d < 0.48 ? PAL.gold2 : d < 0.66 ? PAL.night3 : PAL.night2;
      p.set(ax + x, ay + y, c);
    }
  // light rays in the backdrop
  for (let k = 0; k < 7; k++) {
    const a = -2.6 + k * 0.55;
    for (let r = 6; r < 40; r++) {
      const x = Math.round(ax + aw * 0.62 + Math.cos(a) * r);
      const y = Math.round(ay + ah * 0.45 + Math.sin(a) * r * 0.9);
      if (x > ax && y > ay && x < ax + aw - 1 && y < ay + ah - 1 && (r & 1) === 0) p.set(x, y, r < 18 ? PAL.gold4 : PAL.gold2);
    }
  }
  const src = s.art.render('idle', 0).color;
  const sx = Math.round(s.focus.x - aw / 2);
  const sy = Math.round(s.focus.y - ah / 2);
  for (let y = 0; y < ah; y++)
    for (let x = 0; x < aw; x++) {
      const c = src.get(sx + x, sy + y);
      if (c !== null) p.set(ax + x, ay + y, c);
    }
  // inner window shading: a 1 px dark top-left, lit bottom-right bevel
  p.hline(ax, ax + aw - 1, ay, PAL.night1);
  p.vline(ax, ay, ay + ah - 1, PAL.night1);
  // text box: type line + stats
  const ty = ay + ah + 2;
  p.rect(5, ty, W - 10, H - ty - 5, PAL.ink).rect(6, ty + 1, W - 12, H - ty - 7, PAL.night1);
  for (let x = 8; x < W - 8; x += 2) p.set(x, ty + 4, PAL.night3);
  for (let x = 8; x < W - 14; x += 2) p.set(x, ty + 7, PAL.night3);
  const a = `ATK ${s.atk}`;
  void a;
  const atk = String(s.atk);
  const def = String(s.def);
  const sy2 = H - 12;
  p.hline(7, W - 8, sy2 - 2, PAL.night3);
  drawDigits(p, W - 8 - digitsWidth(def), sy2, def, PAL.mist);
  p.set(W - 10 - digitsWidth(def), sy2 + 2, PAL.steel).set(W - 11 - digitsWidth(def), sy2 + 3, PAL.steel);
  drawDigits(p, W - 13 - digitsWidth(def) - digitsWidth(atk), sy2, atk, PAL.white);
  // foil sheen: a diagonal band of lighter frame
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = x + y * 0.55;
      if (k > 26 && k < 30) {
        const c = p.get(x, y);
        if (c === F[2]) p.set(x, y, F[3]);
        else if (c === F[1]) p.set(x, y, F[2]);
      }
    }
  return p;
}

// ---------------------------------------------------------------- warping

type V = [number, number];

/** Inverse bilinear: the (u, v) of point p inside quad a(0,0) b(1,0) c(1,1) d(0,1), or null. (Inigo Quilez.) */
function invBilinear(p: V, a: V, b: V, c: V, d: V): V | null {
  const e: V = [b[0] - a[0], b[1] - a[1]];
  const f: V = [d[0] - a[0], d[1] - a[1]];
  const g: V = [a[0] - b[0] + c[0] - d[0], a[1] - b[1] + c[1] - d[1]];
  const h: V = [p[0] - a[0], p[1] - a[1]];
  const cross = (x: V, y: V) => x[0] * y[1] - x[1] * y[0];
  const k2 = cross(g, f);
  const k1 = cross(e, f) + cross(h, g);
  const k0 = cross(h, e);
  let u: number;
  let v: number;
  if (Math.abs(k2) < 1e-6) {
    v = -k0 / k1;
    u = (h[0] - f[0] * v) / (e[0] + g[0] * v);
    if (!Number.isFinite(u)) u = (h[1] - f[1] * v) / (e[1] + g[1] * v);
  } else {
    let w = k1 * k1 - 4 * k0 * k2;
    if (w < 0) return null;
    w = Math.sqrt(w);
    const ik2 = 0.5 / k2;
    v = (-k1 - w) * ik2;
    u = (h[0] - f[0] * v) / (e[0] + g[0] * v);
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      v = (-k1 + w) * ik2;
      u = (h[0] - f[0] * v) / (e[0] + g[0] * v);
    }
  }
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  return [u, v];
}

/** Warp `src` onto the quad tl,tr,br,bl (relative to the returned origin). Nearest sampling. */
function warp(src: PixelCanvas, q: [V, V, V, V]): { pc: PixelCanvas; ox: number; oy: number } {
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const x1 = Math.ceil(Math.max(...xs));
  const y1 = Math.ceil(Math.max(...ys));
  const pc = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const uv = invBilinear([x + 0.5, y + 0.5], q[0], q[1], q[2], q[3]);
      if (!uv) continue;
      const sx = Math.min(src.w - 1, Math.floor(uv[0] * src.w));
      const sy = Math.min(src.h - 1, Math.floor(uv[1] * src.h));
      const i = (sy * src.w + sx) * 4;
      if (src.data[i + 3] === 0) continue;
      pc.set(x - x0, y - y0, (src.data[i] << 16) | (src.data[i + 1] << 8) | src.data[i + 2]);
    }
  return { pc, ox: -x0, oy: -y0 };
}

/**
 * Card quad relative to its ground anchor: k = 0 upright (bottom edge on the anchor), k = 1 lying flat in the iso
 * floor plane, top toward the opponent (P1: up-right). Tile units: 0.56 × 0.8 of a 96×48 tile.
 */
function quad(k: number): [V, V, V, V] {
  const iso = (c: number, r: number): V => [48 * (c - r), 24 * (c + r)];
  const cw = 0.28;
  const rh = 0.4;
  const flat: [V, V, V, V] = [iso(-cw, -rh), iso(cw, -rh), iso(cw, rh), iso(-cw, rh)];
  const up: [V, V, V, V] = [
    [-CARD_W / 2, -CARD_H],
    [CARD_W / 2, -CARD_H],
    [CARD_W / 2, 0],
    [-CARD_W / 2, 0],
  ];
  // the flat card sits centred on the anchor; the standing card stands on it
  return up.map((u, i) => [lerp(u[0], flat[i][0], k), lerp(u[1], flat[i][1], k)] as V) as [V, V, V, V];
}

let cardSeq = 0;

/** Pre-warped tilt frames (k = 0 … 1) as textures; frame name = index. Returns key + per-frame origin. */
function cardFrames(c: Cine, face: PixelCanvas, steps: number): { key: string; origins: V[] } {
  const key = `hd:cine:card:${++cardSeq}`;
  const frames = Array.from({ length: steps }, (_, i) => {
    const k = E.inQ(i / (steps - 1));
    return i === 0 ? { pc: face, ox: CARD_W / 2, oy: CARD_H } : warp(face, quad(k));
  });
  const W = frames.reduce((n, f) => n + f.pc.w + 2, 0);
  const H = Math.max(...frames.map((f) => f.pc.h));
  const sheet = new PixelCanvas(W, H);
  let x = 0;
  const rects: [number, number, number][] = [];
  for (const f of frames) {
    sheet.blit(f.pc, x, 0);
    rects.push([x, f.pc.w, f.pc.h]);
    x += f.pc.w + 2;
  }
  const tex = c.scene.textures.addCanvas(key, sheet.toCanvas())!;
  rects.forEach(([fx, w, h], i) => tex.add(String(i), 0, fx, 0, w, h));
  c.own(() => {
    if (c.scene.textures.exists(key)) c.scene.textures.remove(key);
  });
  return { key, origins: frames.map((f) => [f.ox / f.pc.w, f.oy / f.pc.h] as V) };
}

export interface SlammedCard {
  img: Phaser.GameObjects.Image;
  /** Dissolve the lying card into rising light pixels. */
  dissolve(ms: number): Promise<void>;
}

/**
 * Drop the card onto `at` (tile centre): it hangs upright above the tile with a gold glint, falls, tips flat in the
 * last stretch and slams (squash, dust ring, sparks). Resolves on contact (+ squash), returning the lying card.
 */
export async function slamCard(c: Cine, at: XY, spec: CardSpec, onContact: () => void): Promise<SlammedCard> {
  const face = cardFace(spec);
  const STEPS = 7;
  const { key, origins } = cardFrames(c, face, STEPS);
  const img = c.scene.add.image(at.x, at.y - 150, key, '0').setOrigin(origins[0][0], origins[0][1]).setDepth(DEPTH.FX - 30);
  c.own(() => img.destroy());
  const setK = (i: number) => img.setFrame(String(i)).setOrigin(origins[i][0], origins[i][1]);
  const glow = c.soft(at.x, at.y - 195, 'glow', PAL.gold3, 120, 150, 0, 'front');
  const trail = new Sparks(c, 'front');
  const shadow = c.scene.add.image(at.x, at.y + 1, 'hd:shadow').setDepth(DEPTH.SHADOW - 1).setAlpha(0).setDisplaySize(30, 12);
  c.own(() => shadow.destroy());
  c.sound('cardSlide', 0.6, 1.1);
  // appear: a quick scale-in with a white frame, the face hangs for a beat
  await c.run(150, (t) => {
    img.setScale(lerp(0.6, 1, E.outBack(t, 2.2)));
    img.setTintFill(PAL.white).setAlpha(Math.min(1, t * 3));
    if (t > 0.45) img.clearTint();
    glow.setAlpha(0.55 * t);
    glow.setPosition(img.x, img.y - CARD_H / 2);
  });
  img.clearTint();
  await c.sleep(160);
  // fall: accelerate, stretch, tip flat over the last 55 %
  const y0 = img.y;
  await c.run(
    200,
    (t, dt) => {
      const y = lerp(y0, at.y, t);
      img.y = Math.round(y);
      const tilt = Math.max(0, (t - 0.45) / 0.55);
      const fi = Math.min(STEPS - 1, Math.round(tilt * (STEPS - 1)));
      setK(fi);
      img.setScale(fi === 0 ? 1 : 1, fi === 0 ? 1 + 0.08 * t : 1);
      glow.setPosition(img.x, img.y - (fi === 0 ? CARD_H / 2 : 0)).setAlpha(0.55 + 0.3 * t);
      shadow.setAlpha(0.7 * t).setDisplaySize(30 + 40 * t, 12 + 16 * t);
      // gold speed motes peel off the edges
      if (dt > 0 && fi < STEPS - 2)
        for (let i = 0; i < 2; i++)
          trail.add({ x: img.x + c.R(-CARD_W / 2, CARD_W / 2), y: img.y - c.R(0, CARD_H), vy: -c.R(30, 90), life: c.R(160, 300), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], streak: 0.06 });
    },
    E.inQ,
  );
  setK(STEPS - 1);
  img.setPosition(at.x, at.y);
  onContact();
  c.sound('cardSlam', 0.8);
  // contact: squash flat, white flash frame, gold dust ring + sparks
  trail.burst(at.x, at.y, 26, { speed: [90, 240], squash: 0.5, life: 380, lifeR: [240, 460], drag: 3.2, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], streak: 0.035, floor: at.y + 18 });
  img.setTintFill(PAL.white);
  await c.run(50, (t) => img.setScale(lerp(1.16, 1.12, t), lerp(0.7, 0.78, t)));
  img.clearTint();
  await c.run(170, (t) => img.setScale(lerp(1.12, 1, E.outBack(t, 3)), lerp(0.78, 1, E.outBack(t, 3))));
  img.setScale(1);
  void c.run(200, (t) => glow.setAlpha(0.85 * (1 - t))).then(() => glow.destroy());
  void c.run(300, (t) => shadow.setAlpha(0.7 * (1 - t)));
  return {
    img,
    async dissolve(ms: number) {
      // the card's own pixels rise into the light: bright motes from its face, the card burns white and fades
      const flat = warp(face, quad(1));
      const motes = new Sparks(c, 'front');
      for (let i = 0; i < 70; i++) {
        let x = 0;
        let y = 0;
        let col: number | null = null;
        for (let g = 0; g < 12 && col === null; g++) {
          x = Math.floor(c.R(0, flat.pc.w));
          y = Math.floor(c.R(0, flat.pc.h));
          col = flat.pc.get(x, y);
        }
        if (col === null) continue;
        motes.add({ x: at.x + x - flat.ox, y: at.y + y - flat.oy, vy: -c.R(40, 150), vx: c.R(-8, 8), drag: 0.6, age: -c.R(0, ms * 0.6), life: c.R(300, 600), ramp: [PAL.white, PAL.gold4, PAL.gold3, GOLD[1]], streak: 0.05 });
      }
      await c.run(ms, (t) => {
        img.setTintFill(t < 0.5 ? PAL.gold4 : PAL.white);
        img.setAlpha(1 - E.inQ(t));
      });
      img.setVisible(false);
    },
  };
}
