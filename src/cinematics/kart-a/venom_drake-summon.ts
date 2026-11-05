// Zehir Ejderi (venom_drake) — the signature entrance "Zehirli Sis" (the poison mist) and its flip, docs/v3/kart-a/
// venom_drake.md §5.1. v3 look only (the v1 look keeps the generic summon). After the shared tribute stream:
//   0–260      the DARK void circle opens; GAS TONGUES roll in along the floor from the tile's four corners
//              (stepped leaf0 / leaf1 puffs, void1 edges, a 50 % Bayer pattern — never a solid wash) and heap
//              into a low dome over the tile; the sustained hiss + boil rises
//   260 (f0)   the pose starts curled under the dome; two lights in the fog: the eye slit and the bulb
//   f4 land    the knuckles slam: wet dust puffs, the circle pulses, 1 px of shake
//   f6–f8      INHALE: the gas spirals into the mouth in three waves while the dome dithers out 50 → 25 → 0 %
//   f9 peak    the tail unfurls, THE BULB IGNITES: a leaf3 light at the bulb and a plus glint (its centre the one
//              gold4 pixel)
//   f10 hold   the cut-in (the band passes under the tile); the bulb pulses under it
//   finale     "Zehirli Toprak", hand-made (no S.finale's generic three rings): ONE etch ring spreads from the feet
//              in three steps (a jagged iso ring of night0 cracks with a leaf1 lip, inside the slot border), a
//              medium shake, the badge pops, a brief scar on its own tile
// Flip: three drops roll off the card's front edge onto the tile (brief pits) with a falling drip ladder; the
// body forms in its guard pose and rises (the shared v3 flip, flipV3With, no generic burst).
// Whole pixels, palette tones only, stepped light, no camera.

import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, TILE_H, TILE_W, type XY } from '../../view/layout';
import { shake } from '../../vfx/core';
import { registerCardHook } from '../api';
import { fade, panAt, play, soundsOfUnit, start, atFrame, atMark } from '../_v3/sound';
import { flipV3With, type FlipAccentFn } from '../summon-b/flip';
import { Sparks, currentPixels, layer, onFrame, overlay } from '../strikes-a/_kit';
import { PixelCanvas } from '../../art/pixel';
import { unitFrame } from '../../duel/unit-variant';
import type { Px } from '../../vfx/combat';
import { RR, bg, clamp, holdFrame, lightFlash, lightPool, playFrom, signatureSummon, untilFrame, type Stage } from '../summon-a/_kit';
import { etchDot, scarTile, zoneKey } from './venom_drake-acid';

const r = Math.round;
const SX = (v: number) => Math.round((v * TILE_W) / 64);
const SY = (v: number) => Math.round((v * TILE_H) / 32);
const LAND_F = 4;
const INHALE_F = 6;
const PEAK_F = 9;
const HOLD_F = 10;

/** a Px layer the stage disposes of */
function lay(S: Stage, depth: number): Px {
  const px = layer(S.scene, depth);
  S.own({ destroy: () => px.g.destroy() });
  return px;
}

/** The world point of a named art point on the shown frame. */
function pt(u: MonsterUnit, name: 'staff' | 'head' | 'muzzle' | 'core'): XY {
  const fi = u.frameInfo();
  const p = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame)[name] : undefined;
  if (!p) return u.core();
  const w = u.framePoint(p.x, p.y);
  return { x: r(w.x), y: r(w.y) };
}

/** One gas lobe: an iso blob centre / radii. */
type Lobe = readonly [cx: number, cy: number, rx: number, ry: number];

/**
 * The gas as ONE rolling body (crit r1 #4: no dither checker — it read as a texture fault): the union of its
 * lobes in 3 flat stepped bands measured from each column's top — a flat 2-px leaf3 top rim, a leaf2 band,
 * the leaf1 body — a leaf0 floor row and a 1-px void1 edge round the whole.
 */
function gas(px: Px, lobes: readonly Lobe[]): XY[] {
  const rim: XY[] = [];
  if (!lobes.length) return rim;
  let x0 = 1e9;
  let x1 = -1e9;
  let y0 = 1e9;
  let y1 = -1e9;
  for (const [cx, cy, rx, ry] of lobes) {
    if (rx <= 0 || ry <= 0) continue;
    x0 = Math.min(x0, cx - rx - 1);
    x1 = Math.max(x1, cx + rx + 1);
    y0 = Math.min(y0, cy - ry - 1);
    y1 = Math.max(y1, cy + ry + 1);
  }
  if (x1 < x0) return rim;
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const m = new Uint8Array(W * H);
  for (const [cx, cy, rx, ry] of lobes) {
    if (rx <= 0 || ry <= 0) continue;
    for (let y = -ry; y <= ry; y++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.4) * (ry + 0.4)))));
      for (let x = -w; x <= w; x++) m[(cy + y - y0) * W + (cx + x - x0)] = 1;
    }
  }
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
  for (let x = 0; x < W; x++) {
    let top = -1;
    let bot = -1;
    for (let y = 0; y < H; y++)
      if (at(x, y)) {
        if (top < 0) top = y;
        bot = y;
      }
    if (top < 0) continue;
    for (let y = top; y <= bot; y++) {
      if (!at(x, y)) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      const d = y - top;
      const c = edge && d > 0 ? PAL.void1 : y === bot ? PAL.leaf0 : d < 2 ? PAL.leaf3 : d < 5 ? PAL.leaf2 : PAL.leaf1;
      px.dot(x + x0, y + y0, c);
    }
    px.dot(x + x0, top + y0 - 1, PAL.void1);
    rim.push({ x: x + x0, y: top + y0 });
  }
  return rim;
}

/**
 * Crit r2 #3: life on the dome at rest — a gold3 glint (2 px, a leaf3 tail) sliding along the rim every
 * ~1.1 s, and three bubble slots that bulge from the rim, swell to a 3×3 leaf3 ring round a leaf1 eye and
 * pop into two leaf2 flecks (stepped 80 ms phases, never in step with each other). `rim` is the top pixel of
 * every column of the gas (left → right), `el` the dome's clock.
 */
function domeLife(px: Px, rim: readonly XY[], el: number): void {
  const n = rim.length;
  if (n < 8) return;
  // the glint: steps 1 column per 34 ms over the rim, then rests out of sight for ~10 columns
  const gi = Math.floor(el / 34) % (n + 10);
  if (gi >= 1 && gi < n - 1) {
    const a = rim[gi];
    const b = rim[gi - 1];
    px.dot(a.x, a.y, PAL.gold3).dot(rim[gi + 1].x, rim[gi + 1].y, PAL.gold3).dot(b.x, b.y, PAL.leaf3);
  }
  // the bubbles: slot s lives on the column at fraction F[s] of the rim, a 6-step cycle (80 ms each)
  const F = [0.28, 0.62, 0.45];
  for (let s = 0; s < 3; s++) {
    const ph = Math.floor((el + s * 190) / 80) % 6;
    const c = rim[Math.round(F[s] * (n - 1))];
    if (!c) continue;
    if (ph === 0) px.dot(c.x, c.y - 1, PAL.leaf3);
    else if (ph === 1 || ph === 2) {
      const y = c.y - 1 - ph; // it rises 1 px per step
      px.dot(c.x, y - 1, PAL.leaf3).dot(c.x - 1, y, PAL.leaf3).dot(c.x + 1, y, PAL.leaf3).dot(c.x, y + 1, PAL.leaf2).dot(c.x, y, PAL.leaf1);
      px.dot(c.x - 1, y - 1, PAL.void1).dot(c.x + 1, y - 1, PAL.void1);
      if (ph === 2) px.dot(c.x, y - 1, PAL.gold3); // the bubble's skin catches the bulb's light at its peak
    } else if (ph === 3) px.dot(c.x - 2, c.y - 5, PAL.leaf2).dot(c.x + 2, c.y - 4, PAL.leaf2);
  }
  // the boil inside the body: two leaf3 caps (a leaf2 eye, a leaf0 shadow under) rising through the leaf1 body toward the rim (1 px per 90 ms),
  // bursting as a leaf3 dot under the top band
  for (const [fx, off] of [[0.36, 0], [0.71, 300]] as const) {
    const c = rim[Math.round(fx * (n - 1))];
    if (!c) continue;
    const ph = Math.floor((el + off) / 90) % 6;
    if (ph >= 4) {
      if (ph === 4) px.dot(c.x, c.y + 4, PAL.leaf3);
      continue;
    }
    const y = c.y + 9 - ph;
    px.dot(c.x - 1, y, PAL.leaf3).dot(c.x + 1, y, PAL.leaf3).dot(c.x, y - 1, PAL.leaf3).dot(c.x, y, PAL.leaf2).dot(c.x, y + 1, PAL.leaf0).dot(c.x - 1, y + 1, PAL.leaf0).dot(c.x + 1, y + 1, PAL.leaf0);
  }
}

async function venomMistV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const home = S.home;
  const pan = panAt(home.x);
  const n = u.frameCount('summon');
  const holdF = Math.min(n - 1, HOLD_F);
  let gone = false;
  const live = () => !gone && !u.retired && u.sprite.active;

  // ---- 0–260: the circle, the gas rolls in
  fade(['summonCharge'], 160);
  S.openCircle({ appearMs: 200 });
  const arrive = start('venomArrive', { volume: 0.9, pan });
  const pool = S.glow({ color: PAL.leaf3, spill: PAL.leaf2, radius: 30, intensity: 0.1, anim: 'flicker', fadeIn: 0 });
  pool.setIntensity(0.5, 260);
  const floorL = lay(S, DEPTH.SHADOW - 1);
  const domeL = lay(S, S.depth + 0.5);
  const corners: XY[] = [
    { x: home.x - SX(30), y: home.y },
    { x: home.x + SX(30), y: home.y },
    { x: home.x, y: home.y - SY(15) },
    { x: home.x, y: home.y + SY(15) },
  ];
  let el = 0;
  let dome = 4; // dome coverage in quarters (driven down by the inhale)
  let domeOn = false;
  let tonguesOn = true;
  onFrame(sc, (dt) => {
    el += dt;
    floorL.clear();
    domeL.clear();
    if (gone) return false;
    const k = clamp(el / 260, 0, 1);
    const lobes: Lobe[] = [];
    if (tonguesOn) {
      // four tongues: a train of lobes from each corner toward the centre, their heads reaching it at 240 ms,
      // each lobe rolling (a stepped 1-px bob) as it comes
      for (const [ci, c] of corners.entries()) {
        for (let j = 0; j < 4; j++) {
          const q = clamp(k - j * 0.12, 0, 1);
          if (q <= 0) continue;
          const wob = Math.floor((el + ci * 40 + j * 30) / 70) % 2;
          const x = r(c.x + (home.x - c.x) * q * 0.85);
          const y = r(c.y + (home.y - c.y) * q * 0.85) - wob;
          lobes.push([x, y, 7 - (j >> 1), 3]);
        }
      }
    }
    // the dome heaps on the tile (≈ 30×22); the inhale rolls it OUTWARD and DOWN (lower, wider) until it is a
    // floor lip, never a dither fade
    if (dome >= 0 && (domeOn || k >= 0.45)) {
      const g = domeOn ? 1 : (k - 0.45) / 0.55;
      const [hk, wk] = dome >= 4 ? [1, 1] : dome === 2 ? [0.62, 1.18] : dome === 1 ? [0.36, 1.34] : [0.16, 1.5];
      const roll = Math.floor(el / 90) % 3;
      // the lobes roll: the side ones step outward and down in a 3-step cycle, the crown one bobs
      for (const [dx, dy, rx, ry, side] of [[0, -8, 16, 8, 0], [-13, -3, 10, 5, -1], [13, -4, 10, 5, 1], [-4 + (roll === 1 ? 2 : 0), -13, 9, 5, 0], [6, -11, 8, 5, 1], [-7, -1, 9, 4, -1]] as const) {
        const ox = side * (roll === 2 ? 1 : 0);
        lobes.push([home.x + r((dx + ox) * wk), home.y + r(dy * g * hk) + (side && roll === 2 ? 1 : 0), r(rx * g * wk), Math.max(1, r(ry * g * hk))]);
      }
    }
    const rim = gas(domeL, lobes);
    if (domeOn && dome >= 4) domeLife(domeL, rim, el);
    return true;
  });
  await S.wait(260);
  tonguesOn = false;
  domeOn = true;

  // ---- 260: the pose starts, curled in the fog (driven: an ace with a cut-in stops ON the hold frame)
  holdFrame(u, 'summon', 0);
  u.showSprite();
  // crit r1 #3: the body rises OUT of the gas (no pop): 4 steps of 40 ms, rows revealed from its feet up, the
  // gas clinging to the cut row (a leaf3 rim row, a leaf2 checker row over the body above it)
  void riseIn(S, u);
  if (S.cutIn) bg(u.playRange('summon', 0, holdF));
  else bg(playFrom(u, 'summon', 0));
  // the two lights in the fog: the eye slit and the bulb
  const bulbL = lightPool(sc, home.x, home.y, { color: PAL.leaf3, radius: 8, floorY: home.y, air: 0.7, intensity: 0.5, fadeIn: 0 }).follow(() => (live() ? pt(u, 'staff') : null), { floorY: home.y });
  S.own({ destroy: () => void bulbL.fadeOut(120) });

  atMark(u, 'summon', 'land', () => {
    if (!live()) return;
    arrive.stop(120);
    play('venomLand', { volume: 0.9, pan });
    S.circle?.pulse(140);
    bg(shake(sc, 120, 1));
    // wet dust: seven night3 / leaf1 puffs pushed out along the floor from the knuckles
    const sp = new Sparks(sc, DEPTH.SHADOW - 1);
    for (let i = 0; i < 7; i++) {
      const s = i % 2 ? 1 : -1;
      sp.add({ x: home.x + S.dir * 6 + s * RR(2, 6), y: home.y + RR(-1, 2), vx: s * RR(30, 60), vy: RR(-12, -4), ay: 30, drag: 3, life: RR(260, 420), colors: i % 3 ? [PAL.night3, PAL.night2] : [PAL.leaf1, PAL.leaf0], shape: 'sq', size: 2, fadeAt: 1 });
    }
    sp.release();
  }, { maxMs: 3000 });

  // ---- f6–f8: the inhale — the gas spirals into the mouth, the dome thins with the sac swelling
  atFrame(u, 'summon', INHALE_F, () => {
    if (!live()) return;
    play('venomInhale', { volume: 0.9, pan });
    pool.setIntensity(0.3, 250);
    const sp = new Sparks(sc, S.depth + 0.6);
    const mouth = pt(u, 'head');
    for (let w = 0; w < 3; w++)
      for (let i = 0; i < 7; i++) {
        const a = RR(0, Math.PI * 2);
        sp.add({ x: r(home.x + Math.cos(a) * RR(10, 18)), y: r(home.y - 8 + Math.sin(a) * RR(4, 9)), tx: mouth.x, ty: mouth.y, curl: S.dir * 0.8, life: 200, delay: w * 80 + i * 10, colors: i % 3 ? [PAL.leaf1, PAL.leaf2] : [PAL.leaf2, PAL.leaf3], shape: 'px', fadeAt: 1 });
      }
    sp.release();
  }, { maxMs: 3000 });
  for (const [f, lvl] of [[INHALE_F, 2], [INHALE_F + 1, 1], [INHALE_F + 2, 0]] as const) atFrame(u, 'summon', f, () => (dome = lvl), { maxMs: 3000 });

  // ---- f9: the bulb ignites
  atFrame(u, 'summon', PEAK_F, () => {
    if (!live()) return;
    domeOn = false;
    dome = -1; // the gas is gone into the drake
    const b = pt(u, 'staff');
    void lightFlash(sc, b.x, b.y, PAL.leaf3, 22, 280, { floorY: home.y, intensity: 1 });
    bulbL.setIntensity(1, 80).setRadius(14, 7, 80);
    glint(S, u);
    // the circle closes on the ignition: the finale's etch ring owns a clean floor
    if (S.circle) bg(S.circle.dismiss(360));
    if (S.cutIn) play('venomDrip', { volume: 0.5, pan });
    else play('venomRoar', { volume: 0.8, pan });
  }, { maxMs: 3500 });

  // ---- f10: the cut-in on the hold (an ace's tribute summon); the bulb pulses under the band
  if (S.cutIn) {
    await untilFrame(u, 'summon', holdF);
    let holding = true;
    let pk = 0;
    onFrame(sc, (dt) => {
      if (!holding || !live()) return false;
      pk += dt;
      bulbL.setIntensity(Math.floor(pk / 140) % 2 ? 0.7 : 1);
      return true;
    });
    await S.climax();
    holding = false;
    if (live()) bg(playFrom(u, 'summon', holdF + 1));
  } else await untilFrame(u, 'summon', Math.min(n - 1, PEAK_F));

  // ---- the finale: Zehirli Toprak (one etch ring, a medium shake, the badge, a brief scar)
  if (live()) {
    play('venomScar', { volume: 0.8, pan });
    void lightFlash(sc, home.x, home.y, PAL.leaf3, 34, 300, { intensity: 0.9 });
    bg(shake(sc, 170, 2));
    bg(u.badge.pop());
    etchRing(S);
    scarTile(sc, zoneKey(S.player, S.ev.zone), home, { level: 1, life: 'brief' });
  }
  void bulbL.setIntensity(0.4, 300);
  void pool.fadeOut(300);
  await S.wait(120);
  bg(S.wait(400).then(() => (gone = true)));
}

/** The 3-frame plus glint on the bulb (its centre the one gold4 pixel, the arms gold3). */
function glint(S: Stage, u: MonsterUnit): void {
  const px = lay(S, S.depth + 0.7);
  let el = 0;
  onFrame(S.scene, (dt) => {
    el += dt;
    px.clear();
    const f = Math.floor(el / 34);
    if (f >= 3 || !u.sprite.active) return false;
    const b = pt(u, 'staff');
    const L = f === 1 ? 3 : 2;
    for (let i = 1; i <= L; i++) px.dot(b.x - i, b.y, PAL.gold3).dot(b.x + i, b.y, PAL.gold3).dot(b.x, b.y - i, PAL.gold3).dot(b.x, b.y + i, PAL.gold3);
    px.dot(b.x, b.y, PAL.gold4);
    return true;
  }, () => px.g.destroy());
}

/**
 * The body rises out of the gas: for 4 steps of 34 ms the sprite is hidden and an overlay in its exact frame
 * space shows only the rows from its feet up to a rising cut, the gas clinging to the cut (a leaf3 rim row, a
 * leaf2 checker row over the body above it); then the sprite shows again.
 */
async function riseIn(S: Stage, u: MonsterUnit): Promise<void> {
  const spr = u.sprite;
  const STEPS = [0.28, 0.52, 0.76];
  const shown = () => {
    const fi = u.frameInfo();
    return fi.anim ? unitFrame(u, fi.anim, fi.frame) : currentPixels(u).pc;
  };
  const pc0 = shown();
  const ov = overlay(u, new PixelCanvas(pc0.w, pc0.h));
  spr.setVisible(false);
  try {
    for (const k of STEPS) {
      if (!spr.active || u.retired) break;
      const pc = shown();
      let ty = pc.h;
      let by = -1;
      for (let y = 0; y < pc.h; y++)
        for (let x = 0; x < pc.w; x++)
          if (pc.isOpaque(x, y)) {
            ty = Math.min(ty, y);
            by = Math.max(by, y);
            break;
          }
      if (by < 0) break;
      const cut = Math.round(by - (by - ty) * k);
      const out = new PixelCanvas(pc.w, pc.h);
      for (let y = cut; y < pc.h; y++)
        for (let x = 0; x < pc.w; x++) {
          const c = pc.get(x, y);
          if (c === null) continue;
          out.set(x, y, y === cut ? PAL.leaf3 : y === cut + 1 && (x + y) % 2 === 0 ? PAL.leaf2 : c);
        }
      ov.redraw(out);
      await S.wait(34);
    }
  } finally {
    ov.destroy();
    if (spr.active && !u.retired) spr.setVisible(true);
  }
}

/**
 * ONE etch ring spreads from the feet (crit r1 #5: it read thin and dim at 1×): two growth steps of 60 ms, then
 * the PEAK held 100 ms — a 2-px ring of night0 cracks with a leaf3 lip and three gold3 glyph ticks — then it
 * cools in 4 steps of 80 ms (leaf2 lip, leaf1, the cracks only, broken).
 */
function etchRing(S: Stage): void {
  // the back half under the drake, the front half over its feet (the floor in front of the body)
  const back = lay(S, S.depth - 0.5);
  const front = lay(S, S.depth + 0.5);
  const { x: cx, y: cy } = S.home;
  let el = 0;
  onFrame(S.scene, (dt) => {
    el += dt;
    back.clear();
    front.clear();
    // phases: 0 (0–60) R0, 1 (60–120) R1, 2 = peak (120–220), 3…6 cooling (80 ms each)
    const ph = el < 60 ? 0 : el < 120 ? 1 : el < 220 ? 2 : 3 + Math.floor((el - 220) / 80);
    if (ph > 6) return false;
    const step = Math.min(2, ph);
    const R = [SX(13), SX(20), SX(27)][step];
    const peak = ph === 2;
    const N = 64;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const px = Math.sin(a) > 0 ? front : back;
      const jag = ((i * 7) % 5) - 2;
      const rr = R + jag * 0.6;
      const x = r(cx + Math.cos(a) * rr);
      const y = r(cy + Math.sin(a) * rr * 0.5);
      if (ph >= 5 && (i + ph) % 3 === 0) continue;
      const ox = Math.cos(a) > 0 ? 1 : -1;
      const oy = Math.sin(a) > 0 ? 1 : -1;
      // the crack: 2 px wide (3 at the peak, one row thicker)
      const crack = ph >= 5 ? PAL.leaf0 : PAL.night0;
      px.dot(x, y, crack).dot(x - ox, y, crack);
      if (peak) px.dot(x, y - oy, crack);
      // the lit acid lip on its outer side: leaf3 while it spreads and peaks (2 px at the peak), cooling after
      if (ph <= 4) {
        const lip = ph <= 2 ? PAL.leaf3 : ph === 3 ? PAL.leaf2 : PAL.leaf1;
        px.dot(x + ox, y + oy, lip).dot(x, y + oy, ph <= 2 ? PAL.leaf2 : PAL.leaf1);
        if (peak) px.dot(x + ox, y + oy * 2, PAL.leaf3).dot(x + ox * 2, y + oy, PAL.leaf2);
      }
      // short radial forks every 4th crack
      if (i % 4 === 0 && ph <= 4) px.dot(r(cx + Math.cos(a) * (rr - 2)), r(cy + Math.sin(a) * (rr - 2) * 0.5), PAL.night0);
    }
    // three gold3 glyph ticks on the ring at the peak (a 3-px radial bar with an ink foot)
    if (peak || ph === 3) {
      // (back left, back right, front left — clear of the stat badge under the feet)
      for (const a of [-2.3, -0.6, 2.55]) {
        const px = Math.sin(a) > 0 ? front : back;
        const c = peak ? PAL.gold3 : PAL.leaf2;
        const gx = r(cx + Math.cos(a) * (R + 3));
        const gy = r(cy + Math.sin(a) * (R + 3) * 0.5);
        // a small upright glyph: a 3-px stem with a 1-px foot to each side, an ink cap
        px.dot(gx, gy - 4, PAL.ink).dot(gx, gy - 3, c).dot(gx, gy - 2, c).dot(gx, gy - 1, c).dot(gx - 1, gy, c).dot(gx + 1, gy, c).dot(gx, gy, PAL.ink);
      }
    }
    return true;
  });
}

// ================================================================ the flip

/** Three drops roll off the card's front edge onto the tile (brief pits), a falling drip ladder. */
const venomFlipAccent: FlipAccentFn = (ctx, _id, x, y) => {
  const sc = ctx.scene;
  const pan = panAt(x);
  const sp = new Sparks(sc, DEPTH.FX - 1);
  [1, 0.94, 0.89].forEach((pitch, i) => {
    const dx = (i - 1) * 7;
    sp.add({ x: r(x + dx), y: r(y - 2), vx: dx * 1.5, vy: -30, ay: 520, life: 220, delay: i * 60, colors: [PAL.leaf3, PAL.leaf2], shape: 'px', fadeAt: 1 });
    sc.time.delayedCall(i * 60 + 200, () => {
      play('venomDrip', { volume: 0.6, pitch, pan });
      etchDot(sc, r(x + dx * 1.6), r(y + 4));
    });
  });
  sp.release();
};

if (LOOK_V3) {
  signatureSummon('venom_drake', (S) => S.ctx.base(), { v3: venomMistV3 });
  registerCardHook(
    'venom_drake',
    'flip',
    (ctx) =>
      flipV3With(ctx, (c, id, x, y) => {
        venomFlipAccent(c, id, x, y);
        const ev = ctx.ev;
        c.scene.time.delayedCall(320, () => scarTile(c.scene, zoneKey(ev.player, ev.zone), { x, y }, { level: 1, life: 'brief' }));
      }, {
        burst: false,
        rise: (c, u) => {
          const v = soundsOfUnit(u);
          if (v) play(v.land, { volume: 0.6, pan: panAt(u.home.x) });
          else c.sfx('roarBig', { volume: 0.55 });
        },
      }),
    { name: 'kart-a:venom_drake:flip' },
  );
}
