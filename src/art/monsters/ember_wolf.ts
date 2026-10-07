// Kor Kurdu (ember_wolf) — FIRE beast, 64×64, side profile facing right.
//
// A sleek charcoal wolf whose mane, tail and paws are living flame. Parametric rig: every frame
// is a Pose (numbers) and drawWolf() paints the body back-to-front (far legs → torso → near
// legs → neck → head) with ink separation between parts, outlines the solid body, then paints
// the flames as light: tongues that only fill empty pixels sit BEHIND the body (no outline,
// they glow against the night), a few front tongues lick over the neck. Every tongue flickers
// per frame (length, sway, heat) and streams back with the wind of the wolf's motion.

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 64;
const H = 64;
const TAU = Math.PI * 2;
const GROUND = 59;

// ---------------------------------------------------------------- pose

interface Ghost {
  dx: number;
  dy: number;
  /** 0..1 strength */
  k: number;
}

interface Pose {
  /** Body root = middle of the torso (frame px). */
  x: number;
  y: number;
  /** Body pitch (rad, + = chest up) and stretch (1 = normal length). */
  tilt: number;
  st: number;
  /** Neck direction (rad, screen space) and length; head pitch (rad, + = nose up). */
  na: number;
  nl: number;
  hp: number;
  /** Jaw 0..1, ears 0 (pricked) .. 1 (flat back), snarl 0..1 (lip curled), eye 0 (shut) .. 2 (blazing). */
  jaw: number;
  ears: number;
  snarl: number;
  eye: number;
  /** Paws (ground contact points): front near/far, hind near/far. */
  fn: Pt;
  ff: Pt;
  hn: Pt;
  hf: Pt;
  /** Hind metatarsus angle (paw → hock, rad). */
  hna: number;
  hfa: number;
  /** Tail base direction (rad), wave phase, wave amplitude. */
  tail: number;
  tw: number;
  ta: number;
  /** Flame size/heat 0.4..1.7, and wind 0..1 (flames stream back horizontally). */
  fl: number;
  wind: number;
  /** Lunge afterimages (flame silhouettes) and fire trail on the ground. */
  ghosts: Ghost[];
  trail: number;
  /** Flicker phase (any number; integer steps loop). */
  t: number;
}

const N: Pose = {
  x: 27,
  y: 42,
  tilt: 0.08,
  st: 1,
  na: -0.85,
  nl: 10,
  hp: -0.04,
  jaw: 0.15,
  ears: 0,
  snarl: 0,
  eye: 1,
  fn: [35, GROUND],
  ff: [31, GROUND],
  hn: [20, GROUND],
  hf: [16, GROUND],
  hna: -1.78,
  hfa: -1.75,
  tail: Math.PI + 1.0,
  tw: 0,
  ta: 1,
  fl: 1,
  wind: 0,
  ghosts: [],
  trail: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const pant = f % 2; // two quick pants per beat
  const breath = Math.sin(t * TAU * 2);
  return P({
    y: N.y + (breath > 0.3 ? 1 : 0),
    jaw: pant ? 0.34 : 0.08,
    hp: N.hp + (pant ? -0.04 : 0),
    na: N.na + (breath > 0.3 ? 0.04 : 0),
    tail: N.tail + Math.sin(t * TAU) * 0.18,
    tw: t,
    ta: 1,
    fl: 1 + 0.08 * Math.sin(t * TAU * 2),
    // an ear flick and a slow blink keep the loop from feeling mechanical
    ears: f === 4 ? 0.3 : 0,
    eye: f === 6 ? 0.5 : 1,
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: dip the head (anticipation) → rear the chest up, muzzle to the sky, a long howl while
  // the mane and tail erupt → lower and settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ y: 42, tilt: -0.04, na: -0.7, hp: -0.3, jaw: 0.05, ears: 0.3, fl: 0.8, tail: N.tail - 0.2, tw: 0.1, t: 0.1 }),
      P({ y: 40, tilt: 0.12, na: -1.35, hp: 0.45, jaw: 0.45, fl: 1.15, tail: N.tail + 0.2, tw: 0.2, t: 0.2 }),
      P({ y: 39, tilt: 0.2, na: -1.55, nl: 10, hp: 0.95, jaw: 0.85, eye: 0.4, fl: 1.5, tail: N.tail + 0.45, tw: 0.3, t: 0.3 }),
      P({ y: 39, tilt: 0.21, na: -1.58, nl: 10, hp: 1.0, jaw: 0.9, eye: 0.4, fl: 1.7, tail: N.tail + 0.5, tw: 0.4, t: 0.4 }),
      P({ y: 40, tilt: 0.2, na: -1.56, nl: 10, hp: 0.97, jaw: 0.82, eye: 0.4, fl: 1.65, tail: N.tail + 0.5, tw: 0.5, t: 0.5 }),
      P({ y: 39, tilt: 0.2, na: -1.55, nl: 10, hp: 0.95, jaw: 0.8, eye: 0.5, fl: 1.55, tail: N.tail + 0.45, tw: 0.6, t: 0.6 }),
      P({ y: 40, tilt: 0.12, na: -1.3, hp: 0.5, jaw: 0.4, eye: 1.2, fl: 1.3, tail: N.tail + 0.25, tw: 0.7, t: 0.7 }),
      P({ y: 41, tilt: 0.06, na: -1.08, hp: 0.15, jaw: 0.2, eye: 1.4, fl: 1.1, tail: N.tail + 0.1, tw: 0.8, t: 0.8 }),
      P({ fl: 1.05, tw: 0.9, t: 0.9 }),
    ],
  },

  // Attack ("Kor Dişi"): crouch back, coiled, snarling (anticipation) → explode forward → IMPACT:
  // airborne lunge, jaws wide, afterimages and a fire trail → chomp → land → recover.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ x: 25, y: 44, tilt: -0.06, na: -0.75, hp: -0.25, jaw: 0.25, ears: 0.7, snarl: 0.8, eye: 1.5, hna: -2.15, hfa: -2.1, fl: 1.1, wind: 0.1, tail: N.tail - 0.3, tw: 0.1, t: 0.1 }),
      P({ x: 23, y: 46, tilt: -0.08, st: 0.94, na: -0.55, hp: -0.3, jaw: 0.3, ears: 1, snarl: 1, eye: 1.8, fn: [33, GROUND], ff: [29, GROUND], hn: [20, GROUND], hf: [16, GROUND], hna: -2.45, hfa: -2.4, fl: 1.3, tail: N.tail - 0.5, tw: 0.2, t: 0.2 }),
      P({ x: 22, y: 47, tilt: -0.09, st: 0.93, na: -0.52, hp: -0.32, jaw: 0.36, ears: 1, snarl: 1, eye: 2, fn: [33, GROUND], ff: [29, GROUND], hn: [20, GROUND], hf: [16, GROUND], hna: -2.5, hfa: -2.45, fl: 1.5, tail: N.tail - 0.55, tw: 0.25, t: 0.25 }),
      P({ x: 30, y: 39, tilt: 0.18, st: 1.12, na: -0.6, nl: 10, hp: -0.05, jaw: 0.55, ears: 1, snarl: 1, eye: 2, fn: [44, 47], ff: [41, 50], hn: [15, GROUND], hf: [11, 58], hna: -2.7, hfa: -2.75, fl: 1.4, wind: 0.8, tail: Math.PI + 0.25, tw: 0.3, ta: 0.6,
        ghosts: [{ dx: -8, dy: 1, k: 0.6 }], trail: 0.6, t: 0.3 }),
      P({ x: 32, y: 36, tilt: 0.02, st: 1.16, na: -0.42, nl: 9.5, hp: 0.12, jaw: 1, ears: 1, snarl: 1, eye: 2, fn: [48, 44], ff: [45, 47], hn: [14, 50], hf: [10, 52], hna: -2.95, hfa: -3.0, fl: 1.6, wind: 1, tail: Math.PI + 0.1, tw: 0.4, ta: 0.5,
        ghosts: [{ dx: -15, dy: 2, k: 0.3 }, { dx: -8, dy: 1, k: 0.65 }], trail: 1, t: 0.4 }),
      P({ x: 32, y: 37, tilt: -0.03, st: 1.14, na: -0.45, nl: 9.5, hp: -0.02, jaw: 0.08, ears: 1, snarl: 1, eye: 2, fn: [47, 51], ff: [44, 53], hn: [16, 53], hf: [12, 55], hna: -2.6, hfa: -2.6, fl: 1.5, wind: 0.8, tail: Math.PI + 0.3, tw: 0.5, ta: 0.8,
        ghosts: [{ dx: -7, dy: 0, k: 0.35 }], trail: 0.7, t: 0.5 }),
      P({ x: 31, y: 43, tilt: -0.07, st: 1.02, na: -0.75, hp: -0.1, jaw: 0.15, ears: 0.6, snarl: 0.6, eye: 1.6, fn: [42, GROUND], ff: [38, GROUND], hn: [24, GROUND], hf: [19, GROUND], hna: -2.05, hfa: -2.0, fl: 1.25, wind: 0.4, tail: N.tail + 0.15, tw: 0.6, trail: 0.35, t: 0.6 }),
      P({ x: 28, y: 42, tilt: 0.03, na: -1.0, jaw: 0.15, ears: 0.3, snarl: 0.3, eye: 1.3, fn: [37, GROUND], ff: [33, GROUND], hn: [21, GROUND], hf: [17, GROUND], fl: 1.1, wind: 0.15, tail: N.tail + 0.1, tw: 0.7, t: 0.7 }),
      P({ tw: 0.8, t: 0.8 }),
    ],
  },

  // Hit: yelp — jerked back, head flung up, eyes squeezed, ears flat, flames gutter; recover.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ x: 24, y: 41, tilt: 0.14, na: -1.4, nl: 9, hp: 0.55, jaw: 0.55, ears: 1, eye: 0, fn: [35, 56], ff: [31, 58], hn: [19, GROUND], hf: [15, GROUND], fl: 0.5, wind: 0.6, tail: Math.PI - 0.4, tw: 0.1, t: 0.1 }),
      P({ x: 24, y: 42, tilt: 0.08, na: -1.25, hp: 0.3, jaw: 0.35, ears: 1, eye: 0, fn: [34, GROUND], hn: [19, GROUND], hf: [15, GROUND], fl: 0.6, wind: 0.3, tail: Math.PI - 0.15, tw: 0.2, t: 0.2 }),
      P({ x: 25, y: 42, tilt: 0.05, na: -1.1, hp: 0.12, jaw: 0.2, ears: 0.6, eye: 0.6, hn: [19, GROUND], fl: 0.8, tail: N.tail - 0.15, tw: 0.3, t: 0.3 }),
      P({ x: 26, tw: 0.4, fl: 0.95, ears: 0.2, t: 0.4 }),
    ],
  },

  // Guard: low crouch, head down and forward, ears flat, lips curled in a snarl, flames banked low.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        x: 26,
        y: 46 + (s > 0.5 ? -1 : 0),
        tilt: -0.07,
        st: 0.96,
        na: -0.55,
        nl: 9,
        hp: -0.22,
        jaw: 0.18 + (s > 0.5 ? 0.06 : 0),
        ears: 1,
        snarl: 1,
        eye: 1.6,
        fn: [36, GROUND],
        ff: [32, GROUND],
        hn: [19, GROUND],
        hf: [15, GROUND],
        hna: -2.35,
        hfa: -2.3,
        tail: Math.PI + 0.05,
        tw: t,
        ta: 0.5,
        fl: 0.55 + 0.08 * s,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- helpers

type Canvas = PixelCanvas;

/** Draw into a fresh layer, then composite with an ink separation line where it overlaps. */
function layer(p: Canvas, fn: (q: Canvas) => void, sep: number | null = PAL.ink): void {
  const q = new PixelCanvas(p.w, p.h);
  fn(q);
  if (sep !== null) {
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (q.isOpaque(x, y) || !p.isOpaque(x, y)) continue;
        if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) p.set(x, y, sep);
      }
  }
  p.blit(q, 0, 0);
}

function ik(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: 1 | -1): [Pt, Pt] {
  const dx = hx - sx;
  const dy = hy - sy;
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const a = Math.atan2(dy, dx);
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = a + bend * Math.acos(Math.max(-1, Math.min(1, ca)));
  const el: Pt = [sx + Math.cos(ang) * l1, sy + Math.sin(ang) * l1];
  const fa = Math.atan2(hy - el[1], hx - el[0]);
  return [el, [el[0] + Math.cos(fa) * l2, el[1] + Math.sin(fa) * l2]];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Deterministic hash noise in 0..1. */
function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const FUR_N = [PAL.ink, PAL.night0, PAL.night1, PAL.stone1, PAL.stone2, PAL.stone3] as const;
const isFur = (c: number | null) => c !== null && (FUR_N as readonly number[]).includes(c) && c !== PAL.ink;
const furUp = (c: number) => FUR_N[Math.min(FUR_N.length - 1, (FUR_N as readonly number[]).indexOf(c) + 1)];
const furDn = (c: number) => FUR_N[Math.max(1, (FUR_N as readonly number[]).indexOf(c) - 1)];

/** Light a fur layer from the top-left: lit rim on top/left edges, cool shadow on bottom/right. */
function furLight(q: Canvas, near: boolean, depth = 1): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = src.get(x, y);
      if (c === null || !isFur(c)) continue;
      const up = !src.isOpaque(x, y - 1);
      const left = !src.isOpaque(x - 1, y);
      let down = !src.isOpaque(x, y + 1);
      for (let d = 2; d <= depth && !down; d++) down = !src.isOpaque(x, y + d);
      const right = !src.isOpaque(x + 1, y);
      if (up) {
        let n = furUp(c);
        if (!near && n === PAL.stone3) n = PAL.stone2;
        q.set(x, y, n);
      } else if (left && near) q.set(x, y, furUp(c));
      else if (down || right) q.set(x, y, furDn(c));
    }
}

/**
 * A flame tongue from `base` toward `dir`: tapered, swaying, nested heat (fire1 rim → fire2 →
 * fire3 → fire4 core → gold4 at the root when very hot). `behind` paints only empty pixels.
 */
function flame(p: Canvas, base: Pt, dir: number, len: number, wid: number, ph: number, heat: number, behind: Canvas | null): void {
  if (len < 1.5) return;
  const path = (L: number): Pt[] => {
    const out: Pt[] = [];
    const n = Math.max(3, Math.ceil(L / 1.5));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const wob = Math.sin((ph - f * 0.8) * TAU) * f * f * (wid * 0.55 + L * 0.12);
      out.push([base[0] + Math.cos(dir) * L * f - Math.sin(dir) * wob, base[1] + Math.sin(dir) * L * f + Math.cos(dir) * wob]);
    }
    return out;
  };
  const t = new PixelCanvas(p.w, p.h);
  t.stroke(path(len), wid + 1, 1, PAL.fire1);
  t.stroke(path(len * 0.9), wid, 1, heat > 0.45 ? PAL.fire2 : PAL.fire1);
  if (len > 3) t.stroke(path(len * 0.62), Math.max(1, wid * 0.6), 1, heat > 0.45 ? PAL.fire3 : PAL.fire2);
  if (len > 4.5 && heat > 0.6) t.stroke(path(len * 0.32), Math.max(1, wid * 0.32), 1, heat > 1.35 ? PAL.gold4 : PAL.fire4);
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      const c = t.get(x, y);
      if (c === null) continue;
      if (behind && behind.isOpaque(x, y)) continue;
      // never paint a darker flame tone over a brighter one already there
      const cur = p.get(x, y);
      if (cur !== null && FIRE_RANK(cur) > FIRE_RANK(c)) continue;
      p.set(x, y, c);
    }
}

function FIRE_RANK(c: number): number {
  switch (c) {
    case PAL.fire1:
      return 1;
    case PAL.fire2:
      return 2;
    case PAL.fire3:
      return 3;
    case PAL.fire4:
      return 4;
    case PAL.gold4:
      return 5;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------- the rig

/** Body silhouette in body-local space (x forward, y down): level back, deep chest, tucked waist. */
const BODY: Pt[] = [
  ...bezier([-12.5, -5], [-8, -7.5], [-1, -5.5], [7, -8], 8),
  ...bezier([7, -8], [12, -7], [14.5, -1], [12.5, 5], 8).slice(1),
  ...bezier([12.5, 5], [11, 8.5], [6, 9.5], [3, 6.5], 6).slice(1),
  ...bezier([3, 6.5], [0.5, 3.5], [-3, 1.5], [-6, 2.2], 6).slice(1),
  ...bezier([-6, 2.2], [-9, 2.5], [-10.5, 5.5], [-12.5, 4.5], 6).slice(1),
  ...bezier([-12.5, 4.5], [-16, 3], [-16, -3], [-12.5, -5], 8).slice(1),
];

/**
 * Cylinder shading for the torso/neck: per pixel column, a lit band along the top (back, crest),
 * mid fur, and a cool shadow band along the underside (belly, throat).
 */
function volumeShade(q: Canvas): void {
  for (let x = 0; x < q.w; x++) {
    let y = 0;
    while (y < q.h) {
      if (!q.isOpaque(x, y)) {
        y++;
        continue;
      }
      const top = y;
      while (y < q.h && q.isOpaque(x, y)) y++;
      const bot = y - 1;
      const L = bot - top + 1;
      for (let yy = top; yy <= bot; yy++) {
        if (q.get(x, yy) !== PAL.stone1) continue;
        const dTop = yy - top;
        const dBot = bot - yy;
        let c: number = PAL.stone1;
        if (L >= 4 && dTop < 1) c = PAL.stone2;
        else if (L >= 4 && dBot === 0) c = PAL.night0;
        else if (L >= 6 && dBot < 3) c = PAL.night1;
        q.set(x, yy, c);
      }
    }
  }
}

/** Body length squash (body-local x) and head scale. */
const BK = 0.8;
const HS = 1.18;

/** Pose → body-local and head-local transforms. */
function frameOf(o: Pose) {
  const ca = Math.cos(-o.tilt);
  const sa = Math.sin(-o.tilt);
  /** Body-local (x forward, y down) → frame px. */
  const B = (x: number, y: number): Pt => [o.x + x * BK * ca - y * sa, o.y + x * BK * sa + y * ca];
  const neckBase = B(9 * o.st, -4);
  const head: Pt = [neckBase[0] + Math.cos(o.na) * o.nl, neckBase[1] + Math.sin(o.na) * o.nl];
  const hc = Math.cos(-o.hp);
  const hs = Math.sin(-o.hp);
  /** Head-local (u toward the nose, v down) → frame px. */
  const Hd = (u: number, v: number): Pt => [head[0] + (u * hc - v * hs) * HS, head[1] + (u * hs + v * hc) * HS];
  return { B, Hd, head };
}

function drawWolf(p: Canvas, o: Pose, ghost = false): void {
  const st = o.st;
  const { B, Hd, head } = frameOf(o);
  /** Flame flicker 0..1: a flowing wave per tongue plus a little per-frame crackle. */
  const flick = (i: number) => Math.max(0, Math.min(1, 0.5 + 0.36 * Math.sin((o.t * 2 + i * 0.618) * TAU) + 0.28 * (hash(i, Math.round(o.t * 40), 7) - 0.5)));

  // ------------------------------------------------ skeleton
  const shN = B(8 * st, 1);
  const shF = B(6 * st, 1);
  const hipN = B(-9 * st, -1.5);
  const hipF = B(-11 * st, -1.5);
  const tailRoot = B(-13 * st, -4);
  const front = (sh: Pt, paw: Pt) => {
    const [el, wr] = ik(sh[0], sh[1], paw[0] - 0.5, paw[1] - 3.5, 7, 8.5, -1);
    return { el, wr };
  };
  const hind = (hip: Pt, paw: Pt, ma: number) => {
    const hock: Pt = [paw[0] + Math.cos(ma) * 6.5, paw[1] - 1 + Math.sin(ma) * 6.5];
    const [knee, hk] = ik(hip[0], hip[1], hock[0], hock[1], 8.5, 7.5, 1);
    return { knee, hk };
  };
  const FN = front(shN, o.fn);
  const FF = front(shF, o.ff);
  const HN = hind(hipN, o.hn, o.hna);
  const HF = hind(hipF, o.hf, o.hfa);

  // lower legs + paws (the upper bones live inside the body silhouette)
  const paw = (q: Canvas, pw: Pt, base: number, near: boolean) => {
    q.ellipse(pw[0] + 1.5, pw[1] - 1.1, 2.7, 1.6, base);
    if (near) q.set(pw[0] + 3.6, pw[1] - 0.6, PAL.stone3).set(pw[0] + 2.4, pw[1] - 0.2, PAL.stone2);
  };
  const frontLow = (q: Canvas, g: { el: Pt; wr: Pt }, pw: Pt, near: boolean, upper: Pt | null) => {
    const base = near ? PAL.stone1 : PAL.night1;
    if (upper) q.stroke([upper, g.el], 6, 4.5, base);
    q.stroke([g.el, g.wr], 4.8, 3.4, base);
    q.stroke([g.wr, [pw[0] + 0.5, pw[1] - 1.3]], 3.4, 2.8, base);
    paw(q, pw, base, near);
    // elbow tuft
    q.set(g.el[0] - 2.2, g.el[1] + 1.2, base);
    furLight(q, near);
  };
  const hindLow = (q: Canvas, g: { knee: Pt; hk: Pt }, pw: Pt, near: boolean, hip: Pt | null) => {
    const base = near ? PAL.stone1 : PAL.night1;
    if (hip) q.stroke([hip, g.knee], 8, 4.5, base);
    q.stroke([g.knee, g.hk], 5, 3.4, base);
    q.stroke([g.hk, [pw[0] + 0.5, pw[1] - 1.3]], 3.4, 2.8, base);
    paw(q, pw, base, near);
    q.set(g.hk[0] - 1.6, g.hk[1] + 0.4, base);
    furLight(q, near);
  };

  // ------------------------------------------------ far legs (cool shadow side)
  if (!ghost) {
    layer(p, (q) => hindLow(q, HF, o.hf, false, hipF));
    layer(p, (q) => frontLow(q, FF, o.ff, false, shF));
  }

  // ------------------------------------------------ tail root (charcoal, catching fire)
  const tailPts: Pt[] = [tailRoot];
  {
    let [x, y] = tailRoot;
    const n = 6;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const a = o.tail + Math.sin((o.tw - f * 0.6) * TAU) * 0.3 * o.ta * f;
      x += Math.cos(a) * 2.2;
      y += Math.sin(a) * 2.2;
      tailPts.push([x, y]);
    }
  }
  layer(p, (q) => {
    q.stroke(tailPts.slice(0, 4), 4.6, 3, PAL.stone1);
    furLight(q, true);
    q.paint(tailPts[3][0], tailPts[3][1], PAL.fire2);
    q.paint(tailPts[2][0], tailPts[2][1] - 1, PAL.fire1);
  });

  // ------------------------------------------------ body: torso + neck + near thigh + near upper arm
  layer(p, (q) => {
    const fur = PAL.stone1;
    // deep chest, tucked waist, round haunch
    q.poly(BODY.map(([x, y]) => B(x * st, y)), fur);
    // neck rising from the chest into the head
    const n0 = B(7 * st, -2);
    const n1: Pt = [head[0] - 1, head[1] + 1];
    q.stroke([n0, [lerp(n0[0], n1[0], 0.5) + 0.8, lerp(n0[1], n1[1], 0.5)], n1], 11, 7.5, fur);
    // chest ruff: jagged tufts at the throat and brisket
    for (let i = 0; i < 3; i++) {
      const [rx, ry] = B(12.5 * st + (i === 1 ? 0.8 : 0), -0.5 + i * 2.4);
      q.tri(rx - 2, ry - 1.2, rx + 2.2, ry + 0.6, rx - 1.2, ry + 2, fur);
    }
    // shaggy tufts: under the belly, behind the haunch
    for (const [x, y, dx, dy] of [
      [1.5, 4.2, -1.2, 2.2],
      [-2.5, 2.2, -1.4, 2],
      [-14, 1.5, -1.8, 1.6],
      [-14.8, -1.5, -2, 0.8],
    ] as const) {
      const a = B(x * st, y);
      const b = B((x + 1.6) * st, y);
      q.tri(a[0], a[1] - 0.5, b[0], b[1] - 0.5, a[0] + dx, a[1] + dy, fur);
    }
    // near thigh and upper foreleg belong to the body silhouette
    if (!ghost) {
      q.stroke([hipN, HN.knee], 8.5, 4.5, fur);
      q.stroke([shN, FN.el], 6.5, 4.5, fur);
    }
    volumeShade(q);
    furLight(q, true);
    // muscle definition: lit crescents over the haunch and shoulder, stifle crease
    const arc = (c: Pt, r: number, a0: number, a1: number, col: number) => {
      for (let k = 0; k <= 8; k++) {
        const an = lerp(a0, a1, k / 8) - o.tilt;
        q.paint(c[0] + Math.cos(an) * r, c[1] + Math.sin(an) * r, col);
      }
    };
    arc(B(-10 * st, -0.5), 4.2, Math.PI * 1.05, Math.PI * 1.45, PAL.stone2);
    arc(B(8 * st, -0.5), 4.4, Math.PI * 1.1, Math.PI * 1.4, PAL.stone2);
    arc(B(8 * st, -0.5), 4.4, Math.PI * 0.55, Math.PI * 0.85, PAL.night1);
    // fur flow: short strokes sweeping back and down
    for (const [x, y, c] of [
      [5, 2, PAL.night1],
      [-1, 0.5, PAL.night1],
      [-11, 1.5, PAL.night1],
    ] as const) {
      q.paint(...B(x * st, y), c);
      q.paint(...B((x - 1.3) * st, y + 1), c);
    }
    if (!ghost) {
      for (let k = 0; k <= 4; k++) {
        const [x, y] = [lerp(hipN[0], HN.knee[0], 0.35 + k * 0.15) + 2.6, lerp(hipN[1], HN.knee[1], 0.35 + k * 0.15)];
        q.paint(x, y, PAL.night1);
      }
    }
    // smouldering ember cracks in the charcoal coat, flowing with the fur
    const stripes: [Pt, Pt][] = [
      [B(8 * st, -2), B(9.5 * st, 1.5)],
      [B(-7.5 * st, -3.5), B(-6.5 * st, -0.5)],
    ];
    stripes.forEach(([a0, a1], i) => {
      const g = o.fl * (0.65 + 0.5 * flick(i + 20));
      const n = Math.ceil(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) * 2);
      for (let j = 0; j <= n; j++) {
        const f = j / n;
        const hot = g * (1 - Math.abs(f - 0.4) * 1.6);
        q.paint(lerp(a0[0], a1[0], f), lerp(a0[1], a1[1], f), hot > 1.0 ? PAL.fire3 : hot > 0.55 ? PAL.fire2 : PAL.fire1);
      }
    });
    // the mane's glow warms the top of the neck and withers
    for (let k = 0; k <= 6; k++) {
      const [x, y] = lerpPt(Hd(-3, -2.5), B(3 * st, -7), k / 6);
      for (let d = -2; d < 4; d++)
        if (q.isOpaque(x, y + d) && !q.isOpaque(x, y + d - 1)) {
          q.set(x, y + d, o.fl > 1.15 ? PAL.fire2 : PAL.fire1);
          break;
        }
    }
  });

  // ------------------------------------------------ near legs (lower parts, in front)
  if (!ghost) {
    layer(p, (q) => hindLow(q, HN, o.hn, true, null));
    layer(p, (q) => frontLow(q, FN, o.fn, true, null));
  }

  // ------------------------------------------------ head
  layer(p, (q) => {
    const fur = PAL.stone1;
    // ears: wide-based and upright; they flatten back as `ears` → 1
    const ear = (du: number, col: number) => {
      const tip = Hd(lerp(-1.6, -8.6, o.ears) + du * 0.6, lerp(-9, -4.4, o.ears));
      const a = Hd(-3.8 + du, -1.8);
      const b = Hd(1.1 + du, -3.4);
      const m = Hd(lerp(-3.6, -5.6, o.ears) + du, lerp(-5.6, -2.6, o.ears));
      q.poly([a, m, tip, b], col);
      return { a, b, tip };
    };
    ear(2.4, PAL.night1);
    // skull, then the muzzle below a little stop
    q.ellipse(...Hd(0, -0.3), 4.7, 3.9, fur);
    q.poly([Hd(2, -3.2), Hd(4.6, -2.7), Hd(9.4, -1.2), Hd(10.3, 0), Hd(9.8, 1.2), Hd(2, 2.1)], fur);
    // lower jaw, hinged under the ear
    const jo = o.jaw * 0.75;
    const jc = Math.cos(jo);
    const js = Math.sin(jo);
    const J = (u: number, v: number): Pt => {
      const dv = v - 1.6;
      return Hd(u * jc - dv * js, 1.6 + u * js + dv * jc);
    };
    if (o.jaw > 0.1) q.poly([Hd(1.5, 1.1), Hd(9.6, 1.0), J(9, 1.9), J(1.5, 2.2)], PAL.fire2);
    q.poly([J(-0.5, 1.5), J(9.2, 1.7), J(9, 2.8), J(5, 3.5), J(0.5, 4.3)], fur);
    // cheek / jowl ruff
    q.ellipse(...Hd(-0.6, 1.5), 3.3, 2.7, fur);
    q.tri(...Hd(-3.6, 1.5), ...Hd(-1, 3.8), ...Hd(-4.6, 4.6), fur);
    const E = ear(0, fur);
    furLight(q, true);
    // ear interior glows from the mane
    {
      const i0 = lerpPt(E.a, E.b, 0.45);
      const i1 = lerpPt(i0, E.tip, 0.55);
      q.line(i0[0], i0[1], i1[0], i1[1], o.fl > 0.75 ? PAL.fire2 : PAL.fire1);
      q.paint(i0[0], i0[1], PAL.fire1);
    }
    // lit forehead and muzzle bridge
    q.paint(...Hd(-1, -3.6), PAL.stone2);
    q.paint(...Hd(5.5, -2.4), PAL.stone2);
    q.paint(...Hd(7, -2), PAL.stone2);
    // mouth: a dark seam when shut, a furnace when open
    if (o.jaw <= 0.1) q.line(...Hd(3.5, 1.7), ...Hd(9, 1.4), PAL.night0);
    else {
      q.set(...Hd(3, 1.8), o.jaw > 0.5 ? PAL.fire4 : PAL.fire3);
      if (o.jaw > 0.45) {
        q.set(...Hd(4.5, 1.9), PAL.gold4);
        q.set(...Hd(6, 1.9), PAL.fire3);
        q.set(...J(4.5, 2.1), PAL.fire3);
      }
      q.set(...Hd(8.8, 1.6), PAL.white);
      q.set(...J(8.3, 1.9), PAL.stone4);
    }
    // snarl: lip curled back over the teeth, wrinkled muzzle
    if (o.snarl > 0.4) {
      for (let u = 5; u <= 8.5; u += 1.75) q.set(...Hd(u, 1.4), PAL.stone4);
      q.set(...Hd(6, -1.6), PAL.night1);
      q.set(...Hd(7.2, -1.2), PAL.night1);
    }
    // nose
    const ns = Hd(10, -0.5);
    q.set(ns[0], ns[1], PAL.ink).set(ns[0], ns[1] + 1, PAL.ink).set(ns[0] - 1, ns[1], PAL.night0);
    // heavy brow + glowing amber eye
    const eyeP = Hd(3.4, -1.3);
    const ex = Math.round(eyeP[0]);
    const ey = Math.round(eyeP[1]);
    q.set(ex - 1, ey - 1, PAL.ink).set(ex, ey - 1, PAL.ink).set(ex + 1, ey - 1, PAL.night0).set(ex - 2, ey - 1, PAL.night0);
    if (o.eye < 0.2) {
      q.set(ex - 1, ey, PAL.ink).set(ex, ey, PAL.fire2).set(ex + 1, ey, PAL.ink);
    } else if (o.eye < 0.8) {
      q.set(ex - 1, ey, PAL.gold2).set(ex, ey, PAL.gold3).set(ex + 1, ey, PAL.ink);
    } else {
      q.set(ex - 1, ey, PAL.gold3).set(ex, ey, o.eye > 1.5 ? PAL.white : PAL.gold4).set(ex + 1, ey, PAL.ink);
      q.set(ex - 1, ey + 1, PAL.fire2);
    }
  });

  // ------------------------------------------------ outline the solid body
  p.outline(PAL.ink);
  if (ghost) return;
  const body = p.clone();

  // ------------------------------------------------ lunge afterimages: flame silhouettes behind
  for (const g of o.ghosts) {
    const t = new PixelCanvas(p.w, p.h);
    drawWolf(t, { ...o, ghosts: [], trail: 0 }, true);
    for (let y = 0; y < t.h; y++)
      for (let x = 0; x < t.w; x++) {
        const c = t.get(x, y);
        if (c === null || c === PAL.ink) continue;
        const X = x + g.dx;
        const Y = y + g.dy;
        if (p.isOpaque(X, Y)) continue;
        const rim = t.get(x + 1, y) === PAL.ink || t.get(x, y - 1) === PAL.ink || t.get(x, y + 1) === PAL.ink;
        if (rim) p.set(X, Y, g.k > 0.5 ? PAL.fire3 : PAL.fire2);
      }
  }

  // ------------------------------------------------ fire trail scorched along the ground
  if (o.trail > 0) {
    const x0 = Math.min(o.hn[0], o.hf[0]) - 1;
    const len = Math.max(0, Math.min(Math.round(20 * o.trail), x0 - 1));
    for (let i = 0; i < len; i++) {
      const x = x0 - i;
      if (x < 0) break;
      const k = 1 - i / len;
      p.set(x, GROUND - 1, k > 0.5 ? PAL.fire2 : PAL.fire1);
      if (i % 3 === 0) flame(p, [x, GROUND - 1], -Math.PI / 2 - 0.3, (2 + 4 * k) * (0.6 + 0.6 * flick(i + 80)), 2, o.t * 4 + i * 0.3, k * 1.2, body);
    }
  }

  // ------------------------------------------------ flames (light: no outline)
  const fl = o.fl;
  const windA = (a: number) => lerp(a, Math.PI - 0.12, o.wind * 0.8);

  // mane: a ruff of flame rooted along the skull, neck crest and withers, streaming back
  const crest = (f: number): Pt => lerpPt(Hd(-3.2, -2.2), B(2 * st, -7.2), f);
  const mane: [Pt, number, number][] = [
    [Hd(-1.5, -3.5), 0.75, -2.0],
    [crest(0), 1.0, -2.15],
    [crest(0.2), 1.08, -2.28],
    [crest(0.4), 1.0, -2.4],
    [crest(0.6), 0.85, -2.52],
    [crest(0.8), 0.65, -2.65],
    [crest(1), 0.45, -2.78],
  ];
  mane.forEach(([r, k, a], i) => {
    const L = fl * k * 11 * (0.78 + 0.4 * flick(i + 1));
    flame(p, r, windA(a + Math.sin((o.t * 2 + i * 0.13) * TAU) * 0.1), L, 3.4 * Math.min(1.15, 0.55 + k * 0.55), o.t * 3 + i * 0.23, fl * (0.85 + 0.35 * k), body);
  });
  // embers torn off the mane drift up and back
  for (let k = 0; k < 3; k++) {
    const ph = (o.t * 2 + k / 3) % 1;
    const r = crest(0.15 + k * 0.3);
    const ex = Math.round(r[0] - 3 - ph * (5 + o.wind * 8) + Math.sin((ph + k * 0.3) * TAU) * 1.2);
    const ey = Math.round(r[1] - 6 - ph * 9 * fl + o.wind * ph * 6);
    if (!p.isOpaque(ex, ey)) p.set(ex, ey, ph < 0.35 ? PAL.fire4 : ph < 0.7 ? PAL.fire3 : PAL.fire2);
  }
  // a few front tongues lick over the crest
  for (let i = 0; i < 3; i++) {
    const r = crest(0.15 + i * 0.25);
    const L = fl * (3 + 2.5 * flick(i + 60));
    flame(p, [r[0] + 0.5, r[1] + 1.5], windA(-2.25 - i * 0.12), L, 2, o.t * 3 + i * 0.4 + 0.2, fl * 1.15, null);
  }

  // tail plume: tongues along the outer tail, one big torch flame at the tip. The plume leans
  // up more than back so it never runs off the left edge of the frame.
  const windT = (a: number) => lerp(a, Math.PI - 0.5, o.wind * 0.45);
  const fit = (x: number, dir: number, L: number) => (Math.cos(dir) < -0.05 ? Math.min(L, (x - 1) / -Math.cos(dir)) : L);
  for (let i = 3; i < tailPts.length; i++) {
    const f = (i - 3) / (tailPts.length - 4);
    const [x, y] = tailPts[i];
    const dir = windT(-Math.PI / 2 - 0.75 + Math.sin((o.tw + f) * TAU) * 0.18);
    const L = fit(x, dir, fl * (5 + f * 5) * (0.8 + 0.4 * flick(i + 30)));
    flame(p, [x, y], dir, L, 3.4 - f * 0.6, o.t * 3 + i * 0.21, fl * (1.15 - f * 0.25), body);
  }
  {
    const tip = tailPts[tailPts.length - 1];
    const dir = windT(o.tail - 0.35);
    flame(p, tip, dir, fit(tip[0], dir, fl * 6.5 * (0.85 + 0.3 * flick(40))), 3, o.t * 3 + 0.5, fl, body);
  }

  // paws burn
  for (const [pw, near] of [
    [o.ff, false],
    [o.hf, false],
    [o.fn, true],
    [o.hn, true],
  ] as const) {
    for (let k = 0; k < 2; k++) {
      const L = fl * (near ? 4.2 : 3.2) * (0.6 + 0.7 * flick(pw[0] * 3 + k));
      flame(p, [pw[0] + k * 2, pw[1] - 1.2], windA(-Math.PI / 2 - 0.4 - k * 0.15), L, 2.2, o.t * 4 + k * 0.5 + pw[0] * 0.1, fl * (near ? 1 : 0.7), k === 0 || !near ? body : null);
    }
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // ember-red night: a hot halo behind the head, ash ground
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot(x - 27, (y - 14) * 1.1);
      let col: number = PAL.fire0;
      if (d < 16) col = PAL.fire1;
      if (y >= 31) col = PAL.night0;
      p.set(x, y, col);
    }
  const big = new PixelCanvas(W, H);
  drawWolf(big, P({ eye: 2, jaw: 0.55, snarl: 1, ears: 0.3, fl: 1.3, t: 0.35, tw: 0.35, na: -0.95, hp: 0.05 }));
  // frame the head: eye at ~2/3 of the width
  const ox = 13;
  const oy = 9;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const col = big.get(ox + x, oy + y);
      if (col !== null) p.set(x, y, col);
    }
  for (const [x, y, c] of [
    [3, 4, PAL.fire3],
    [8, 1, PAL.fire2],
    [1, 13, PAL.fire4],
    [41, 26, PAL.fire2],
    [39, 3, PAL.fire3],
  ] as const)
    if (p.get(x, y) === PAL.fire0 || p.get(x, y) === PAL.fire1) p.set(x, y, c);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;
/** Muzzle = between the jaws (front teeth) in the impact frame. */
const MUZZLE = (() => {
  const { Hd } = frameOf(ANIMS.attack.poses[IMPACT_FRAME]);
  const [x, y] = Hd(9, 2);
  return { x: Math.round(x), y: Math.round(y) };
})();

const art: MonsterArt = {
  id: 'ember_wolf',
  w: W,
  h: H,
  anchorX: 28,
  anchorY: GROUND,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: 28, y: 40 },
  anims: {
    idle: { frames: ANIMS.idle.poses.length, fps: ANIMS.idle.fps, loop: true },
    roar: { frames: ANIMS.roar.poses.length, fps: ANIMS.roar.fps, loop: false },
    attack: { frames: ANIMS.attack.poses.length, fps: ANIMS.attack.fps, loop: false },
    hit: { frames: ANIMS.hit.poses.length, fps: ANIMS.hit.fps, loop: false },
    guard: { frames: ANIMS.guard.poses.length, fps: ANIMS.guard.fps, loop: true },
  },
  attackImpactFrame: IMPACT_FRAME,
  draw(p, anim, frame) {
    const poses = ANIMS[anim].poses;
    drawWolf(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
