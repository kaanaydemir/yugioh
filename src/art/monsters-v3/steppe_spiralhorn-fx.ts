// Bozkır Boynuzlusu v3 — the light / effect layer of the saiga rig and its own death finale (YENI_KARTLAR §5.2:
// "tohum / çimen bulutu rüzgarla").
//
// Everything here is painted in palette steps only (no alpha), and everything but the death's grass transform is LIGHT:
// drawn after the outline, never outlined (IŞ-9).
//   catchlight   1 px white in the eye, on the key light's side
//   horn curls   the visual "whistle": two tiny spiral hooks (3×3, leaf4 → leaf3) peel off the horn tips and drift back
//   horn glint   hitMagic: both tips ring (white core, gold4 arms); roar: one tip twinkle (1 → 3 px cross → 1)
//   grass wake   blades rooted in the floor (leaf2 / leaf3, leaf4 tips, a white seedhead): a take-off fan bending away
//                from the hooves, or the landing crescent that flattens outward and springs back. Never a ring (§0.4.1).
//   dust ticks   2-px earth specks at the hoof tips
//   seed burst   feather-grass (Stipa) seeds: an earth3 shaft + a white / mist plume (2 drawn spin states) spraying up
//                and out from the horn tips, then gliding
//   death        matter pass (before the outline): the coat turns to grass from the hooves up (earth → leaf, a leaf3
//                front band) and the wind erases the mound from the windward side in 2×2 clusters; light pass: blades
//                poke out of the grass mound, the erased clusters ride a curving, climbing stream of seeds and blades
//                leeward, and the horns — last — become two long seed plumes that lift away. Revive runs it backwards.

import { PAL } from '../palette';
import { AX, GY, H, Part, W, type Frame } from './steppe_spiralhorn-rig';
import { clamp, hash2, rnd } from './steppe_spiralhorn-kit';

const TAU = Math.PI * 2;
const M = 2; // frame margin the effects keep (Sİ-2)

function put(f: Frame, x: number, y: number, c: number): void {
  if (x < M || y < M || x >= W - M || y >= H - M) return;
  f.p.set(x, y, c);
}

// ---------------------------------------------------------------- small motifs

/** A feather-grass seed: a 2-px earth shaft and a 2-px white plume pair (+ a mist tip); `spin` picks one of two drawn
 *  plume states (lying / standing). Compact clusters, so a cloud of seeds stays inside the noise budget (IŞ-10). */
function seed(f: Frame, x: number, y: number, spin: number, dir = 1): void {
  put(f, x, y, PAL.earth3);
  put(f, x, y + 1, PAL.earth3);
  if (spin & 1) {
    put(f, x - dir, y - 1, PAL.white);
    put(f, x - dir * 2, y - 1, PAL.white);
    put(f, x - dir * 3, y - 1, PAL.mist);
  } else {
    put(f, x - dir, y - 1, PAL.white);
    put(f, x - dir, y - 2, PAL.white);
    put(f, x - dir * 2, y - 2, PAL.mist);
  }
}

/** A grass blade bit (2 px of one tone + a step), slanted. */
function blade(f: Frame, x: number, y: number, k: number): void {
  const c = k & 1 ? PAL.leaf3 : PAL.leaf2;
  put(f, x, y, c);
  put(f, x + 1, y, c);
  put(f, x + 2, y - 1, c);
  put(f, x + 3, y - 1, c);
}

/** A rooted floor blade: 1 px wide, base leaf2, body leaf3, tip leaf4 (a white seedhead on some). */
function floorBlade(f: Frame, x: number, h: number, bend: number, head: boolean): void {
  if (h <= 0) return;
  const n = Math.max(1, rnd(h));
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / n;
    const xx = rnd(x + bend * k * k);
    const yy = GY - 1 - i;
    put(f, xx, yy, i < 2 ? PAL.leaf2 : i === n - 1 ? PAL.leaf4 : PAL.leaf3);
  }
  if (head && n >= 3) put(f, rnd(x + bend) + (bend > 0 ? 1 : bend < 0 ? -1 : 0), GY - n, PAL.white);
}

// ---------------------------------------------------------------- effects

function catchlight(f: Frame): void {
  const { o, sk, light } = f;
  if (o.blink === 2 || o.grass > 0.55 || o.wind > 0 || o.plume > 0) return;
  const ex = rnd(sk.eye[0]);
  const ey = rnd(sk.eye[1]);
  if (f.comp.at(ex, ey + 1) !== Part.head) return;
  f.p.set(light.side < 0 ? ex : ex + 1, o.blink === 1 ? ey + 1 : ey, PAL.white);
  if (o.blink === 3) f.p.set(light.side < 0 ? ex + 1 : ex, ey, PAL.mist);
}

/** The wind curls peel off both horn tips and drift back (−x) and a little up: the visible whistle. */
function curls(f: Frame): void {
  const { o, sk } = f;
  if (o.curl < 0) return;
  const ph = o.curl;
  const shapes: (readonly (readonly [number, number])[])[] = [
    [[0, 1], [1, 0], [2, 0], [3, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 1], [1, 2], [0, 2]],
    [[0, 1], [1, 2], [2, 2], [3, 1], [2, 0]],
  ];
  const tips = [sk.hornN.tip, sk.hornF.tip];
  tips.forEach((tp, i) => {
    const k = clamp(ph - i * 0.18, 0, 1);
    if (ph - i * 0.18 < 0) return;
    const x = rnd(tp[0] - 3 - k * 9);
    const y = rnd(tp[1] - 1 - k * 3 + Math.sin(k * TAU) * 1.2);
    const s = shapes[Math.min(2, Math.floor(k * 3))];
    const c = k < 0.45 ? PAL.leaf4 : PAL.leaf3;
    if (k > 0.85) {
      put(f, x + 1, y + 1, PAL.leaf3);
      put(f, x + 2, y + 1, PAL.leaf3);
      return;
    }
    for (const [dx, dy] of s) put(f, x + dx, y + dy, c);
    // a 2-px tail back toward the horn tip
    if (k < 0.6) {
      put(f, x + 4, y + 1, PAL.leaf3);
      put(f, x + 5, y + 1, PAL.leaf3);
    }
  });
}

function glint(f: Frame): void {
  const { o, sk } = f;
  if (o.glint <= 0) return;
  const step = Math.floor(o.t * 12) % 3;
  const tips = o.glint === 1 ? [sk.hornN.tip, sk.hornF.tip] : [sk.hornN.tip];
  tips.forEach((tp, i) => {
    const x = rnd(tp[0]);
    const y = rnd(tp[1]);
    f.p.set(x, y, PAL.white);
    const big = o.glint === 1 ? (step + i) % 2 === 0 : step === 1;
    if (big) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) f.p.set(x + dx, y + dy, PAL.gold4);
    if (o.glint === 1 && big) for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3]] as const) put(f, x + dx, y + dy, PAL.gold3);
  });
}

/** Grass wake at the floor: kind 1 = the take-off fan (blades bend away, behind the hooves); 2 = the landing crescent. */
function wake(f: Frame): void {
  const { o } = f;
  if (o.wake < 0) return;
  const ph = o.wake;
  const cx = AX + o.wakeX;
  const grow = ph < 0.25 ? 0.55 + ph * 1.8 : 1 - (ph - 0.25) * 0.9;
  if (o.wakeK === 1) {
    // 6 blades behind / under the hind hooves, bending back (−x) and springing up as the phase runs
    const xs = [-9, -6, -3, 0, 3, 6];
    xs.forEach((dx, i) => {
      const h = (3 + ((i * 5) % 4)) * grow * (i === 0 || i === 5 ? 0.7 : 1);
      const bend = -(4 - i * 0.4) * (1 - ph) - 1;
      floorBlade(f, cx + dx, h, bend, i === 2 || i === 4);
    });
  } else {
    // the crescent: blades flattened outward from the landing point, both sides, then springing back
    const flat = 1 - clamp(ph * 1.4, 0, 1);
    const xs = [-14, -10, -7, -4, 4, 7, 10, 14];
    xs.forEach((dx, i) => {
      const side = dx < 0 ? -1 : 1;
      const h = (2.5 + ((i * 3) % 3)) * (0.5 + 0.6 * (1 - flat)) * (ph > 0.75 ? 1 - (ph - 0.75) * 3 : 1);
      floorBlade(f, cx + dx, h, side * (1 + 5 * flat), i === 1 || i === 6);
    });
  }
}

function dust(f: Frame): void {
  const { o, sk } = f;
  if (o.dust < 0) return;
  const ph = o.dust;
  const hooves = [sk.fn.hoof, sk.ff.hoof, sk.hn.hoof, sk.hf.hoof].filter((h) => h[1] >= GY - 2);
  hooves.forEach((h, i) => {
    const side = i % 2 ? 1 : -1;
    const x = rnd(h[0] + side * (2 + ph * 5));
    const y = GY - 2 - rnd(ph * 3);
    const c = ph < 0.5 ? PAL.earth3 : PAL.earth2;
    put(f, x, y, c);
    put(f, x + side, y, c);
  });
}

/** The seed burst at the horn tips: ~14 seeds up and out, then a glide drifting away from the attacker (+x). */
function seeds(f: Frame): void {
  const { o, sk } = f;
  if (o.seeds < 0) return;
  const ph = o.seeds;
  const [tx, ty] = sk.hornN.tip;
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * (0.18 + 0.64 * hash2(i, 3, 41));
    const sp = 9 + hash2(i, 7, 43) * 13;
    const up = Math.min(ph, 0.35) / 0.35;
    const glide = Math.max(0, ph - 0.35);
    const x = rnd(tx + Math.cos(a) * sp * up + glide * (10 + i * 0.9));
    const y = rnd(ty + Math.sin(a) * sp * up + glide * glide * 30 + Math.sin(glide * 9 + i) * 1.2);
    seed(f, x, y, i + Math.floor(ph * 8), 1);
    if (ph < 0.18 && i % 3 === 0) put(f, x + 1, y - 1, PAL.gold4);
  }
}

// ---------------------------------------------------------------- death / revive

function frontY(f: Frame, x: number, y: number): boolean {
  const { o } = f;
  if (o.grass <= 0) return false;
  const thr = (GY - y) / 60 + 0.12 * hash2(x >> 1, y >> 1, 77);
  return thr < o.grass * 1.12;
}

function windGone(f: Frame, x: number, y: number, x0: number, span: number): number {
  const { o } = f;
  if (o.wind <= 0) return -1;
  const u = (x - x0) / span;
  const thr = u * 0.8 + 0.2 * hash2(x >> 1, y >> 1, 91) + (GY - y) * 0.002;
  return thr < o.wind ? o.wind - thr : -1;
}

const TO_GRASS: Record<number, number> = {
  [PAL.earth4]: PAL.leaf3,
  [PAL.earth3]: PAL.leaf2,
  [PAL.earth2]: PAL.leaf1,
  [PAL.earth1]: PAL.leaf1,
  [PAL.earth0]: PAL.leaf0,
  [PAL.white]: PAL.leaf4,
  [PAL.mist]: PAL.leaf3,
  [PAL.stone1]: PAL.leaf1,
  [PAL.stone2]: PAL.leaf1,
  [PAL.stone0]: PAL.leaf0,
  [PAL.leaf3]: PAL.leaf3,
  [PAL.leaf2]: PAL.leaf2,
  [PAL.leaf1]: PAL.leaf1,
};


export function deathPasses(f: Frame, stage: 'matter' | 'light'): void {
  const { o, p, comp } = f;
  if (o.grass <= 0 && o.wind <= 0 && o.plume <= 0) return;
  if (stage === 'matter') {
    const motes = f.motes;
    motes.length = 0;
    const b = p.bounds();
    if (!b) return;
    const x0 = b.x;
    const span = Math.max(20, b.w);
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        if (!p.isOpaque(x, y)) continue;
        const part = comp.at(x, y);
        const horn = part === Part.hornN || part === Part.hornF;
        if (!horn && frontY(f, x, y)) {
          const c = p.get(x, y)!;
          // the transform front: a 2-px leaf3 band
          const nearFront = !frontY(f, x, y - 2);
          // tufts: every third 2-px column steps one tone darker (grass texture by tone bands, MA-2)
          const g = TO_GRASS[c] ?? PAL.leaf2;
          const tuft = ((x >> 1) + (y >> 3)) % 3 === 0;
          p.set(x, y, nearFront ? PAL.leaf3 : tuft ? (g === PAL.leaf3 ? PAL.leaf2 : g === PAL.leaf2 ? PAL.leaf1 : g) : g);
        }
        if (horn) continue;
        const k = windGone(f, x, y, x0, span);
        if (k >= 0) {
          p.erase(x, y);
          comp.id[y * W + x] = Part.none;
          if ((x & 1) === 0 && (y & 1) === 0 && hash2(x >> 1, y >> 1, 13) < 0.16) motes.push({ x, y, k, i: (x * 7 + y * 3) & 255 });
        }
      }
    return;
  }
  // light: blades poking out of the grass mound's top edge
  if (o.grass > 0.3 && o.wind < 0.9) {
    const b = p.bounds();
    if (b)
      for (let x = b.x + 1; x < b.x + b.w - 1; x += 3) {
        let y = b.y;
        while (y < b.y + b.h && !(p.isOpaque(x, y) && p.get(x, y) !== PAL.ink)) y++;
        if (y >= b.y + b.h - 1 || !frontY(f, x, y + 1)) continue;
        const part = comp.at(x, y + 1);
        if (part === Part.hornN || part === Part.hornF) continue;
        const hgt = 2 + ((x * 5) % 3);
        const lean = (x >> 2) % 2 ? 1 : 0;
        for (let i = 1; i <= hgt; i++) put(f, x + (i > 1 ? lean : 0), y - i, i === hgt ? PAL.leaf4 : PAL.leaf3);
      }
  }
  // the stream: erased clusters ride the wind leeward (+x), climbing on a curve
  for (const m of f.motes) {
    const k = m.k;
    const x = rnd(m.x + 4 + k * 95 + Math.sin(k * 5 + m.i) * 2);
    const y = rnd(m.y - 2 - k * 14 - k * k * 30 + Math.sin(k * 7 + m.i * 0.3) * 1.5);
    if (m.i % 3 === 0) blade(f, x, y, m.i);
    else seed(f, x, y, m.i + rnd(k * 6), -1);
  }
  // the horns become two long seed plumes that lift and drift away
  if (o.plume > 0) {
    const k = o.plume;
    const hs = [f.sk.hornN, f.sk.hornF];
    hs.forEach((h, j) => {
      const lift = k * (16 + j * 4);
      const dx = k * (12 + j * 8);
      const len = h.len + 2;
      const a0 = (h.ang * Math.PI) / 180;
      const a = a0 + (0 - a0) * Math.min(1, k * 1.3) * 0.6;
      const bx = h.base[0] + dx;
      const by = h.base[1] - lift;
      for (let s = 0; s <= len; s++) {
        const x = rnd(bx + Math.cos(a) * s + Math.sin(s * 0.9 + k * 6) * 0.6);
        const y = rnd(by + Math.sin(a) * s);
        const tipish = s > len - 4;
        put(f, x, y, s < 3 ? PAL.earth3 : PAL.white);
        if (s > 3 && s % 3 === 0 && !tipish) {
          put(f, x - 1, y + 1, PAL.mist);
          put(f, x - 2, y + 1, PAL.mist);
        }
      }
    });
  }
}

export function drawFx(f: Frame): void {
  catchlight(f);
  wake(f);
  dust(f);
  curls(f);
  glint(f);
  seeds(f);
}
