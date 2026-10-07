// Kor Kurdu (ember_wolf) — FIRE beast, 64×64, side profile facing right.
//
// An ash-charcoal wolf whose mane, tail and paws are living flame. Anatomy: a deep chest that
// drops well below the belly line, a tucked waist, a muscular shoulder hump under the mane;
// front legs = upper arm → straight forearm → forward-angled pastern, hind legs = heavy thigh →
// gaskin → back-angled hock → near-vertical metatarsus. Both leg chains are IK'd from the paw
// targets, so the body can crouch, fly and land while the paws stay planted.
//
// Lighting: top-left key light (stone3 rim on the topline, stone2 back / top planes, stone1
// flanks, stone0 underside) plus a warm underlight from the burning paws (fire2 rim along the
// belly, brisket and leg fronts) so the dark body separates from the night board. Three
// deliberate ember seams (shoulder blade, haunch, spine) glow fire3 in fire2 lips.
//
// Flames are light (no outline): every flame is a few shaped tongues — curved teardrops nested
// fire2 → fire3 → fire4 → gold4 root — that sway per frame and stream back with the wind of the
// wolf's motion. Behind-the-body tongues only fill empty pixels. Lunge afterimages are whole
// wolf silhouettes in translucent fire, offset back along the travel.
//
// Rig: every frame is a Pose (numbers); drawWolf() paints back-to-front (far legs → tail →
// body → near thigh/legs → head) with ink separation between parts, outlines, then the light.

import { PAL } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 64;
const H = 64;
const TAU = Math.PI * 2;
const GROUND = 59;

// ---------------------------------------------------------------- pose

interface Ghost {
  dx: number;
  dy: number;
  /** Opacity 0..1. */
  a: number;
}

interface Pose {
  /** Body root = middle of the torso at spine-to-belly center (frame px). */
  x: number;
  y: number;
  /** Body pitch (rad, + = chest up) and chest push (px, the brisket swells forward/out — howl). */
  tilt: number;
  chest: number;
  /** Neck direction (screen rad) and length; head pitch (rad, + = nose up). */
  na: number;
  nl: number;
  hp: number;
  /** Jaw opening (rad, ~0.55 = wide), ears 0 (pricked) .. 1 (flat), snarl 0..1, eye 0 (shut) .. 2 (blazing). */
  jaw: number;
  ears: number;
  snarl: number;
  eye: number;
  /** Paw ground points: front near/far, hind near/far. */
  fn: Pt;
  ff: Pt;
  hn: Pt;
  hf: Pt;
  /** Front pastern angle (paw → wrist, rad) and hind metatarsus angle (paw → hock, rad). */
  fpa: number;
  hna: number;
  /** Tail stub direction (rad), sway phase, sway amplitude. */
  tail: number;
  tw: number;
  ta: number;
  /** Flame size/heat ~0.5..1.7, wind 0..1 (flames stream back horizontally). */
  fl: number;
  wind: number;
  /** Lunge afterimages, fire trail along the ground, landing ember/dust puff (0..1). */
  ghosts: Ghost[];
  trail: number;
  puff: number;
  /** Flicker phase (integer steps loop). */
  t: number;
}

const N: Pose = {
  x: 30,
  y: 38,
  tilt: 0,
  chest: 0,
  na: -0.92,
  nl: 10,
  hp: 0.05,
  jaw: 0.1,
  ears: 0,
  snarl: 0,
  eye: 1,
  fn: [42, GROUND],
  ff: [38, GROUND],
  hn: [19, GROUND],
  hf: [15, GROUND],
  fpa: -2.05,
  hna: -2.0,
  tail: Math.PI + 1.0,
  tw: 0,
  ta: 1,
  fl: 1,
  wind: 0,
  ghosts: [],
  trail: 0,
  puff: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU);
  const pant = f % 2; // quick panting, two pants per breath
  return P({
    // breathing at 1px resolution: the chest lifts first, the head follows a frame later
    y: N.y + Math.round(-0.6 * s),
    na: N.na + 0.05 * Math.round(Math.sin((t - 0.125) * TAU)),
    jaw: pant ? 0.27 : 0.14,
    hp: N.hp + (pant ? -0.04 : 0),
    tail: N.tail + Math.sin(t * TAU) * 0.1,
    tw: t,
    fl: 1 + 0.08 * Math.sin(t * TAU * 2),
    // an ear flick and a slow blink keep the loop from feeling mechanical
    ears: f === 4 ? 0.35 : 0,
    eye: f === 6 ? 0.5 : 1,
    t,
  });
}

/** Idle frame 0 — the one-shots start from it and settle back into it (no pop between anims). */
const IDLE0 = idlePose(0, 8);
const I0 = (o: Partial<Pose>): Pose => ({ ...IDLE0, ...o });

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar ("uluma"): dip the head and gather (anticipation) → rear the chest out, front legs
  // braced forward, hind legs sunk; the neck stretches up and the muzzle points ~65° to the sky
  // with the lower jaw dropped, throat glowing → hold the howl while mane and tail erupt → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      I0({ t: 0 }),
      P({ y: 39, tilt: -0.05, na: -0.62, hp: -0.4, jaw: 0.04, ears: 0.35, fl: 0.85, tail: N.tail - 0.15, tw: 0.1, t: 0.1 }),
      P({ y: 38, tilt: 0.08, chest: 1, na: -1.2, nl: 10.5, hp: 0.55, jaw: 0.22, fn: [43, GROUND], fpa: -1.95, fl: 1.2, tail: N.tail + 0.2, tw: 0.2, t: 0.2 }),
      P({ y: 38, tilt: 0.14, chest: 2, na: -1.42, nl: 11, hp: 1.1, jaw: 0.5, eye: 0.4, ears: 0.15, fn: [45, GROUND], ff: [41, GROUND], fpa: -2.15, fl: 1.55, tail: N.tail + 0.4, tw: 0.3, t: 0.3 }),
      P({ y: 38, tilt: 0.15, chest: 2, na: -1.45, nl: 11, hp: 1.15, jaw: 0.56, eye: 0.4, ears: 0.15, fn: [45, GROUND], ff: [41, GROUND], fpa: -2.15, fl: 1.7, tail: N.tail + 0.45, tw: 0.4, t: 0.4 }),
      P({ y: 38, tilt: 0.15, chest: 2, na: -1.45, nl: 11, hp: 1.15, jaw: 0.54, eye: 0.4, ears: 0.15, fn: [45, GROUND], ff: [41, GROUND], fpa: -2.15, fl: 1.65, tail: N.tail + 0.45, tw: 0.5, t: 0.5 }),
      P({ y: 38, tilt: 0.14, chest: 2, na: -1.43, nl: 11, hp: 1.1, jaw: 0.5, eye: 0.5, ears: 0.15, fn: [45, GROUND], ff: [41, GROUND], fpa: -2.15, fl: 1.55, tail: N.tail + 0.4, tw: 0.6, t: 0.6 }),
      P({ y: 38, tilt: 0.08, chest: 1, na: -1.2, nl: 10.5, hp: 0.5, jaw: 0.25, eye: 1.2, fn: [43, GROUND], fpa: -1.95, fl: 1.3, tail: N.tail + 0.25, tw: 0.7, t: 0.7 }),
      P({ y: 38, tilt: 0.03, na: -1.0, hp: 0.15, jaw: 0.15, eye: 1.4, fl: 1.12, tail: N.tail + 0.1, tw: 0.8, t: 0.8 }),
      I0({ fl: 1.05, tw: 0.9, t: 0.9 }),
    ],
  },

  // Attack ("Kor Dişi"): crouch back, coiled and snarling (anticipation) → push off, hind legs
  // driving, fire trail streaming back along the ground → IMPACT: flying gallop, straight spine,
  // front legs reaching for the target, hind legs fully back, jaws wide, two fire afterimages →
  // chomp → landing squash with an ember puff → rebound → settle. Torso length never changes:
  // the stretch comes from the legs.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      I0({ t: 0 }),
      P({ x: 30, y: 40, tilt: -0.06, na: -0.72, hp: -0.25, jaw: 0.18, ears: 0.7, snarl: 0.8, eye: 1.5, fn: [41, GROUND], ff: [37, GROUND], hna: -2.1, fl: 1.1, wind: 0.1, tail: Math.PI + 0.85, tw: 0.1, t: 0.1 }),
      P({ x: 29, y: 42, tilt: -0.09, na: -0.55, nl: 9.2, hp: -0.32, jaw: 0.25, ears: 1, snarl: 1, eye: 1.8, fn: [40, GROUND], ff: [36, GROUND], hn: [19, GROUND], hf: [15, GROUND], hna: -2.35, fpa: -1.95, fl: 1.3, tail: Math.PI + 0.95, tw: 0.2, t: 0.2 }),
      P({ x: 29, y: 43, tilt: -0.1, na: -0.52, nl: 9, hp: -0.34, jaw: 0.3, ears: 1, snarl: 1, eye: 2, fn: [40, GROUND], ff: [36, GROUND], hn: [19, GROUND], hf: [15, GROUND], hna: -2.45, fpa: -2.0, fl: 1.5, tail: Math.PI + 1.0, tw: 0.25, t: 0.25 }),
      P({ x: 29, y: 37, tilt: 0.12, na: -0.62, hp: -0.05, jaw: 0.35, ears: 1, snarl: 1, eye: 2, fn: [45, 48], ff: [42, 50], fpa: -2.7, hn: [15, GROUND], hf: [11, 57], hna: -2.45, fl: 1.45, wind: 0.7, tail: Math.PI + 0.6, tw: 0.3, ta: 0.6,
        ghosts: [{ dx: -5, dy: 4, a: 0.8 }], trail: 0.6, t: 0.3 }),
      P({ x: 28, y: 33, tilt: 0, na: -0.45, nl: 9.4, hp: 0.1, jaw: 0.6, ears: 1, snarl: 1, eye: 2, fn: [50, 39], ff: [47, 41], fpa: Math.PI + 0.25, hn: [7, 44], hf: [4, 46], hna: -0.35, fl: 1.6, wind: 1, tail: Math.PI + 0.62, tw: 0.4, ta: 0.4,
        ghosts: [{ dx: -10, dy: 8, a: 0.55 }, { dx: -5, dy: 4, a: 1 }], trail: 1, t: 0.4 }),
      P({ x: 28, y: 35, tilt: -0.05, na: -0.5, nl: 9.4, hp: -0.06, jaw: 0.04, ears: 1, snarl: 1, eye: 2, fn: [48, 47], ff: [45, 49], fpa: -2.6, hn: [9, 49], hf: [6, 51], hna: -0.9, fl: 1.5, wind: 0.8, tail: Math.PI + 0.6, tw: 0.5, ta: 0.7,
        ghosts: [{ dx: -5, dy: 3, a: 0.6 }], trail: 0.7, t: 0.5 }),
      P({ x: 30, y: 41, tilt: -0.08, na: -0.72, nl: 9.3, hp: -0.15, jaw: 0.12, ears: 0.6, snarl: 0.6, eye: 1.6, fn: [43, GROUND], ff: [39, GROUND], fpa: -2.15, hn: [19, GROUND], hf: [15, GROUND], hna: -2.2, fl: 1.3, wind: 0.35, tail: Math.PI + 0.6, tw: 0.6, puff: 1, trail: 0.35, t: 0.6 }),
      P({ x: 30, y: 37, tilt: 0.04, na: -0.98, jaw: 0.15, ears: 0.3, snarl: 0.3, eye: 1.3, fl: 1.15, wind: 0.1, tail: N.tail + 0.05, tw: 0.7, puff: 0.5, t: 0.7 }),
      I0({ tw: 0.8, t: 0.8 }),
    ],
  },

  // Hit: yelp — jerked back, front paw lifts, head flung up, eyes squeezed, ears flat, flames
  // gutter and blow back; recover. The tail flame angles up-left and stays inside the frame.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ x: 28, y: 39, tilt: 0.16, na: -1.35, nl: 9.5, hp: 0.6, jaw: 0.42, ears: 1, eye: 0, fn: [40, 54], ff: [37, GROUND], hn: [18, GROUND], hf: [14, GROUND], fl: 0.6, wind: 0.3, tail: Math.PI + 1.25, ta: 0.4, tw: 0.1, t: 0.1 }),
      P({ x: 28, y: 39, tilt: 0.1, na: -1.2, hp: 0.35, jaw: 0.28, ears: 1, eye: 0, fn: [41, GROUND], ff: [37, GROUND], hn: [18, GROUND], hf: [14, GROUND], fl: 0.7, wind: 0.15, tail: Math.PI + 1.2, ta: 0.5, tw: 0.2, t: 0.2 }),
      P({ x: 29, y: 38, tilt: 0.05, na: -1.05, hp: 0.15, jaw: 0.18, ears: 0.6, eye: 0.6, fn: [42, GROUND], ff: [38, GROUND], hn: [18, GROUND], fl: 0.85, tail: Math.PI + 1.1, tw: 0.3, t: 0.3 }),
      I0({ x: 29, ears: 0.2, fl: 0.95, tw: 0.4, t: 0.4 }),
    ],
  },

  // Guard: low crouch, head down and forward, ears flat, lips curled in a snarl, flames banked
  // low; the tail is held up like a torch so its flame stays well inside the frame.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        x: 28,
        y: 43 - Math.round(0.6 * s),
        tilt: -0.06,
        na: -0.5,
        nl: 9,
        hp: -0.2,
        jaw: 0.14 + 0.05 * s,
        ears: 1,
        snarl: 1,
        eye: 1.6,
        fn: [41, GROUND],
        ff: [37, GROUND],
        fpa: -2.0,
        hn: [17, GROUND],
        hf: [13, GROUND],
        hna: -2.3,
        tail: Math.PI + 1.15,
        tw: t,
        ta: 0.5,
        fl: 0.62 + 0.08 * s,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- helpers

type Canvas = PixelCanvas;

/** Draw into a fresh layer, then composite with an ink separation line where it overlaps. */
function layer(p: Canvas, fn: (q: Canvas) => void, sep: number | null = PAL.ink): Canvas {
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
  return q;
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

function FIRE_RANK(c: number | null): number {
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
    case PAL.white:
      return 6;
    default:
      return 0;
  }
}

/** True if (x, y) or a 4-neighbour is opaque in m (the part plus its outline ring). */
function near4(m: Canvas, x: number, y: number): boolean {
  return m.isOpaque(x, y) || m.isOpaque(x - 1, y) || m.isOpaque(x + 1, y) || m.isOpaque(x, y - 1) || m.isOpaque(x, y + 1);
}

/**
 * A flame tongue: a curved teardrop (broad root → 1px tip) with nested heat — fire2 fringe →
 * fire3 body → fire4 core → gold4 at the root when hot. Light: no outline, single stray pixels
 * dropped, never paints a cooler flame tone over a hotter one. `curl` bends the tongue along its
 * length (rad, − = curls back/left for an upward tongue), `ph` sways it. The tongue shortens
 * itself to stay 2px inside the frame. `behind`: skip pixels covered by that canvas (+ outline).
 */
function tongue(p: Canvas, base: Pt, dir: number, len: number, wid: number, curl: number, ph: number, heat: number, behind: Canvas | null): void {
  if (len < 2) return;
  let C: Pt[] = [];
  let n = 4;
  for (let tries = 0; tries < 8; tries++) {
    n = Math.max(4, Math.ceil(len / 1.4));
    C = [];
    let a = dir + Math.sin(ph * TAU) * 0.12;
    let [x, y] = base;
    for (let i = 0; i <= n; i++) {
      C.push([x, y]);
      a += curl / n + Math.sin((ph - i / n) * TAU) * 0.05;
      x += (Math.cos(a) * len) / n;
      y += (Math.sin(a) * len) / n;
    }
    // the whole tongue (centerline ± its half-width) must stay 2px inside the frame
    const inside = C.every(([cx, cy], i) => {
      const hw = (wid / 2) * (1 - i / n) + 2;
      return cx >= hw && cx <= p.w - 1 - hw && cy >= hw;
    });
    if (inside || len < 2.5) break;
    len *= 0.85;
  }
  if (len < 2) return;
  const shape = (k: number, wk: number): Pt[] => {
    const m = Math.max(2, Math.round(n * k));
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= m; i++) {
      const f = i / m;
      const [x0, y0] = C[Math.max(0, i - 1)];
      const [x1, y1] = C[Math.min(m, i + 1)];
      const d = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / d;
      const ny = (x1 - x0) / d;
      const w = ((wid * wk) / 2) * (f < 0.3 ? 0.85 + f * 0.5 : Math.pow((1 - f) / 0.7, 0.8));
      left.push([C[i][0] + nx * w, C[i][1] + ny * w]);
      right.push([C[i][0] - nx * w, C[i][1] - ny * w]);
    }
    return [...left, ...right.reverse()];
  };
  const t = new PixelCanvas(p.w, p.h);
  t.poly(shape(1, 1), heat > 0.35 ? PAL.fire2 : PAL.fire1);
  if (len > 3) t.poly(shape(0.72, 0.6), heat > 0.35 ? PAL.fire3 : PAL.fire2);
  if (len > 4.5 && heat > 0.55) t.poly(shape(0.42, 0.34), heat > 1.35 ? PAL.gold4 : PAL.fire4);
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      const c = t.get(x, y);
      if (c === null) continue;
      if (!t.isOpaque(x - 1, y) && !t.isOpaque(x + 1, y) && !t.isOpaque(x, y - 1) && !t.isOpaque(x, y + 1)) continue;
      if (behind && near4(behind, x, y)) continue;
      // unoutlined light never touches the outermost frame pixels (no hard cut)
      if (x < 1 || y < 1 || x > p.w - 2) continue;
      const cur = p.get(x, y);
      if (cur !== null && FIRE_RANK(cur) > FIRE_RANK(c)) continue;
      p.set(x, y, c);
    }
}

// ---------------------------------------------------------------- fur shading

/** Base fill color for fur parts before shading (replaced by the shading passes). */
const FUR = PAL.stone1;

/**
 * Cylinder shading for the torso/neck, per pixel column: stone3 rim on the topline, stone2 back
 * plane, stone1 flank, stone0 underside and a fire2 underlight on the belly/brisket edge (the
 * burning paws light it from below). Left silhouette edges catch the key light too.
 */
function shadeBody(q: Canvas, warmFrom: number, warmTo: number): void {
  const src = q.clone();
  for (let x = 0; x < q.w; x++) {
    let y = 0;
    while (y < q.h) {
      if (!src.isOpaque(x, y)) {
        y++;
        continue;
      }
      const top = y;
      while (y < q.h && src.isOpaque(x, y)) y++;
      const bot = y - 1;
      const L = bot - top + 1;
      for (let yy = top; yy <= bot; yy++) {
        if (src.get(x, yy) !== FUR) continue;
        const d = (yy - top) / Math.max(1, L - 1);
        let c: number = PAL.stone1;
        if (yy === top) c = PAL.stone3;
        else if (d < 0.55) c = PAL.stone2;
        else if (yy === bot && x >= warmFrom && x <= warmTo && L >= 5) c = PAL.fire2;
        else if (d > 0.84 && L >= 6) c = PAL.stone0;
        if (c === PAL.stone1 && !src.isOpaque(x - 1, yy)) c = PAL.stone2;
        q.set(x, yy, c);
      }
    }
  }
}

/**
 * Leg shading: lit back/left edge, dark front/right edge — except near the paw, where the front
 * edge catches the paw fire (fire2 underlight, fire3 right above the flames).
 */
function shadeLeg(q: Canvas, near: boolean, pawY: number): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (src.get(x, y) !== FUR) continue;
      const left = !src.isOpaque(x - 1, y);
      const right = !src.isOpaque(x + 1, y);
      const up = !src.isOpaque(x, y - 1);
      // near legs: lit stone2 with a stone3 back edge; far legs one step darker (depth)
      let c: number = near ? PAL.stone2 : PAL.stone1;
      if (left || up) c = near ? PAL.stone3 : PAL.stone2;
      else if (right) c = pawY - y <= 5 && pawY - y >= 0 ? (pawY - y <= 2 && near ? PAL.fire3 : PAL.fire2) : near ? PAL.stone1 : PAL.stone0;
      q.set(x, y, c);
    }
}

// ---------------------------------------------------------------- the rig

/** Body silhouette, body-local (x forward, y down): croup, loin, shoulder hump, deep chest, tuck. */
const BODY: Pt[] = [
  [-16.5, -3.4],
  [-14, -6],
  [-10, -6.4],
  [-5, -5.6],
  [0, -6],
  [4, -7.6],
  [7, -9.2],
  [10, -8.5],
  [12.5, -6],
  [14.5, -2.5],
  [15, 0.5],
  [14, 4],
  [11.5, 7.2],
  [8, 8.6],
  [4, 8],
  [0.5, 6],
  [-2.5, 3.4],
  [-6, 1.8],
  [-9.5, 1.9],
  [-12.5, 2.6],
  [-16, 1],
  [-17, -1],
];

/** Body scale (body-local units → px) and head scale (head-local units → px). */
const BK = 1.2;
const HS = 1.2;
const UPPER_ARM = 8;
const FOREARM = 9.5;
const PASTERN = 4.3;
const THIGH = 10.5;
const GASKIN = 9;
const META = 7;

/** Pose → transforms + skeleton. */
function rig(o: Pose) {
  const ca = Math.cos(-o.tilt);
  const sa = Math.sin(-o.tilt);
  /** Body-local (x forward, y down) → frame px. */
  const B = (x: number, y: number): Pt => [o.x + (x * ca - y * sa) * BK, o.y + (x * sa + y * ca) * BK];
  const neckBase = B(9.5, -5.5);
  const head: Pt = [neckBase[0] + Math.cos(o.na) * o.nl, neckBase[1] + Math.sin(o.na) * o.nl];
  const hc = Math.cos(-o.hp);
  const hs = Math.sin(-o.hp);
  /** Head-local (u toward the nose, v down; origin = skull center) → frame px. */
  const Hd = (u: number, v: number): Pt => [head[0] + (u * hc - v * hs) * HS, head[1] + (u * hs + v * hc) * HS];
  // lower jaw: hinged under the ear, rotates down by o.jaw
  const jc = Math.cos(o.jaw);
  const js = Math.sin(o.jaw);
  const J = (u: number, v: number): Pt => {
    const du = u + 1.5;
    const dv = v - 1.6;
    return Hd(-1.5 + du * jc - dv * js, 1.6 + du * js + dv * jc);
  };
  // legs
  const front = (sh: Pt, pw: Pt) => {
    const wrist: Pt = [pw[0] - 0.5 + Math.cos(o.fpa) * PASTERN, pw[1] - 1.6 + Math.sin(o.fpa) * PASTERN];
    const [el, wr] = ik(sh[0], sh[1], wrist[0], wrist[1], UPPER_ARM, FOREARM, 1);
    return { sh, el, wr, pw };
  };
  const hind = (hip: Pt, pw: Pt, ma: number) => {
    const hock: Pt = [pw[0] - 0.5 + Math.cos(ma) * META, pw[1] - 1.6 + Math.sin(ma) * META];
    const [knee, hk] = ik(hip[0], hip[1], hock[0], hock[1], THIGH, GASKIN, -1);
    return { hip, knee, hk, pw };
  };
  const FN = front(B(9.5, -0.5), o.fn);
  const FF = front(B(7, -0.5), o.ff);
  const HN = hind(B(-11.5, -2.5), o.hn, o.hna);
  const HF = hind(B(-13.5, -2.5), o.hf, o.hna - 0.05);
  return { B, Hd, J, head, hc, hs, FN, FF, HN, HF };
}

type Rig = ReturnType<typeof rig>;

/** Solid wolf (no light): far legs, tail stub, body, near legs, head. Returns the body+head masks. */
function drawBody(p: Canvas, o: Pose, R: Rig, silhouette: boolean): { body: Canvas; head: Canvas; nearLegs: Canvas; tailTip: Pt; tailPts: Pt[] } {
  const { B, Hd, J, head, hc, hs, FN, FF, HN, HF } = R;
  const sep = silhouette ? null : PAL.ink;

  // ------------------------------------------------ legs
  const paw = (q: Canvas, pw: Pt, near: boolean) => {
    q.ellipse(pw[0] + 0.7, pw[1] - 1.5, 3.1, 1.7, FUR);
    return near;
  };
  const shadePaw = (q: Canvas, pw: Pt, near: boolean) => {
    // toes glow from the flames licking out between them
    const y = Math.round(pw[1] - 1);
    for (let x = Math.round(pw[0] - 2); x <= pw[0] + 3; x++) if (q.isOpaque(x, y) && !q.isOpaque(x, y + 1)) q.set(x, y, near ? PAL.fire2 : PAL.fire1);
    q.paint(Math.round(pw[0] + 2.6), Math.round(pw[1] - 1.4), near ? PAL.fire3 : PAL.fire2);
  };
  const frontLeg = (q: Canvas, g: Rig['FN'], near: boolean, withUpper: boolean) => {
    if (withUpper) q.stroke([g.sh, g.el], 7, 5.4, FUR);
    q.stroke([g.el, g.wr], 4.4, 3.1, FUR);
    q.stroke([g.wr, [g.pw[0] - 0.2, g.pw[1] - 1.5]], 3, 2.7, FUR);
    paw(q, g.pw, near);
    // elbow point and wrist knob give the leg its angles
    q.disc(g.el[0] - 0.8, g.el[1] + 0.3, 2.3, FUR);
    q.disc(g.wr[0], g.wr[1], 1.5, FUR);
    if (!silhouette) {
      shadeLeg(q, near, g.pw[1] - 1);
      shadePaw(q, g.pw, near);
    }
  };
  const hindLeg = (q: Canvas, g: Rig['HN'], near: boolean, withThigh: boolean) => {
    if (withThigh) {
      // heavy haunch → stifle
      q.stroke([g.hip, g.knee], 10, 6, FUR);
      q.disc(g.hip[0] - 0.5, g.hip[1] + 0.5, 5, FUR);
    }
    q.stroke([g.knee, g.hk], 5, 3, FUR);
    // hock: the heel point juts back
    const [hx, hy] = g.hk;
    const ux = g.hk[0] - g.knee[0];
    const uy = g.hk[1] - g.knee[1];
    const ul = Math.hypot(ux, uy) || 1;
    q.tri(hx - 1.5, hy - 1.5, hx + 1.5, hy + 1, hx + (ux / ul) * 2.4 - 0.5, hy + (uy / ul) * 2.4, FUR);
    q.stroke([g.hk, [g.pw[0] - 0.2, g.pw[1] - 1.5]], 2.9, 2.6, FUR);
    paw(q, g.pw, near);
    if (!silhouette) {
      shadeLeg(q, near, g.pw[1] - 1);
      shadePaw(q, g.pw, near);
      if (withThigh && near) {
        // haunch ember seam: an arc over the top of the haunch and down the front of the thigh
        const b = lerpPt(g.hip, g.knee, 0.5);
        const c = lerpPt(g.hip, g.knee, 0.8);
        seam(q, [
          [g.hip[0] - 2, g.hip[1] - 3.4],
          [g.hip[0] + 1.6, g.hip[1] - 2.8],
          [b[0] + 2.4, b[1]],
          [c[0] + 1.2, c[1] + 0.6],
        ], o.fl);
      }
    }
  };

  layer(p, (q) => hindLeg(q, HF, false, true), sep);
  layer(p, (q) => frontLeg(q, FF, false, true), sep);

  // ------------------------------------------------ tail stub (charcoal, catching fire at the tip)
  const tailRoot = B(-16, -3.5);
  const tailPts: Pt[] = [tailRoot];
  {
    let [x, y] = tailRoot;
    for (let i = 1; i <= 4; i++) {
      const f = i / 4;
      const a = o.tail + Math.sin((o.tw - f * 0.5) * TAU) * 0.25 * o.ta * f;
      x += Math.cos(a) * 1.8;
      y += Math.sin(a) * 1.8;
      tailPts.push([x, y]);
    }
  }
  layer(
    p,
    (q) => {
      q.stroke(tailPts, 5.2, 3.6, FUR);
      if (!silhouette) {
        shadeLeg(q, true, -99);
        q.paint(tailPts[3][0], tailPts[3][1], PAL.fire2);
        q.paint(tailPts[4][0], tailPts[4][1], PAL.fire3);
      }
    },
    sep,
  );

  // ------------------------------------------------ body: torso + neck + chest ruff
  const chest = o.chest;
  const body = layer(
    p,
    (q) => {
      q.poly(
        BODY.map(([x, y]) => (x > 9 ? B(x + chest * Math.max(0, 1 - Math.abs(y - 1) / 7), y + (y > 4 ? chest * 0.4 : 0)) : B(x, y))),
        FUR,
      );
      // thick neck from the shoulder hump to the skull
      const n0 = B(9, -4);
      const n1: Pt = Hd(-1.5, 0.8);
      q.stroke([n0, lerpPt(n0, n1, 0.5), n1], 11.5, 8.5, FUR);
      // throat / chest ruff: jagged tufts pointing down-back
      for (const [x, y] of [
        [13.4 + chest, -3.2],
        [14.6 + chest, 0.6],
        [13.6 + chest, 4.2],
      ] as const) {
        const [rx, ry] = B(x, y);
        q.tri(rx - 1.5, ry - 1.4, rx + 1.6, ry + 0.2, rx - 0.6, ry + 2.6, FUR);
      }
      // belly tufts
      for (const [x, y] of [
        [3, 6.6],
        [-1.5, 4.4],
      ] as const) {
        const [a, b] = [B(x, y), B(x - 2, y - 0.6)];
        q.tri(a[0], a[1] - 0.6, b[0], b[1] - 0.6, a[0] - 1.6, a[1] + 1.6, FUR);
      }
      if (!silhouette) {
        const [wx0] = B(-6, 0);
        const [wx1] = B(15, 0);
        shadeBody(q, Math.round(wx0), Math.round(wx1));
        // muscle: the shoulder blade and upper arm catch the light, crease behind the elbow
        const sh = FN.sh;
        for (let k = 0; k <= 6; k++) {
          const an = lerp(Math.PI * 1.05, Math.PI * 1.45, k / 6) - o.tilt;
          const px = sh[0] - 1 + Math.cos(an) * 4.5;
          const py = sh[1] + Math.sin(an) * 4.5;
          if (q.get(px, py) === PAL.stone1) q.set(px, py, PAL.stone2);
        }
        // ember seams: along the shoulder blade and the spine
        seam(q, [B(3.6, -6.4), B(6, -4.2), B(8.4, -1.6), B(10.4, 1.2)], o.fl);
        seam(q, [B(-9, -4.6), B(-5.5, -4), B(-2, -4.4)], o.fl * 0.9);
        // the mane's glow warms the crest
        for (let k = 0; k <= 8; k++) {
          const [x, y] = lerpPt(Hd(-3, -3.4), B(5, -8.2), k / 8);
          for (let d = -2; d < 4; d++)
            if (q.isOpaque(x, y + d) && !q.isOpaque(x, y + d - 1)) {
              q.set(x, y + d, o.fl > 1.2 ? PAL.fire3 : PAL.fire2);
              break;
            }
        }
      }
    },
    sep,
  );

  // ------------------------------------------------ near legs (in front)
  const nearLegs = layer(p, (q) => hindLeg(q, HN, true, true), sep).clone();
  nearLegs.blit(layer(p, (q) => frontLeg(q, FN, true, false), sep), 0, 0);

  // ------------------------------------------------ head
  const headMask = layer(
    p,
    (q) => {
      // far ear (behind the skull)
      const ear = (du: number, col: number) => {
        // set back on the skull with a narrow base, so the domed forehead shows in front of it
        const tip = Hd(lerp(-3.4, -9, o.ears) + du * 0.5, lerp(-8.6, -4.4, o.ears));
        const a = Hd(-4.6 + du, -2.4);
        const b = Hd(-1.2 + du, -4.2);
        const m = Hd(lerp(-4.6, -6.4, o.ears) + du, lerp(-6, -3.2, o.ears));
        q.poly([a, m, tip, b], col);
        return { a, b, tip };
      };
      ear(1.4, PAL.stone0);
      // skull, muzzle (stop → nose)
      // domed skull with a clear stop, then a long tapering muzzle
      q.ellipse(...Hd(-0.8, -0.7), 4.7 * HS, 4.3 * HS, FUR);
      q.poly([Hd(2, -3.3), Hd(4, -2.6), Hd(7, -2.1), Hd(9.8, -1.4), Hd(11, -0.6), Hd(11.2, 0.6), Hd(10.4, 1.4), Hd(6, 1.8), Hd(1, 2.4), Hd(-1, 1)], FUR);
      // open mouth: a furnace between the jaws
      const open = o.jaw > 0.08;
      if (open) {
        q.poly([Hd(-0.5, 1.2), Hd(10.4, 1.4), J(9.6, 1.8), J(0, 1.8)], PAL.fire2);
        q.poly([Hd(0.5, 1.6), Hd(7.5, 1.8), J(7, 2.1), J(0.5, 2.1)], PAL.fire3);
        if (o.jaw > 0.3) q.poly([Hd(-0.5, 1.6), Hd(3.5, 1.9), J(3, 2.1), J(-0.5, 2)], PAL.fire4);
      }
      // lower jaw
      q.poly([J(-2, 1.5), J(9.4, 1.9), J(9.2, 2.7), J(6, 3.3), J(2, 3.9), J(-1.5, 4.2), J(-2.8, 3.4)], FUR);
      // cheek ruff behind the jaw: shaggy tufts sweeping back
      q.ellipse(...Hd(-1.8, 1.8), 3 * HS, 2.5 * HS, FUR);
      q.tri(...Hd(-4.4, 0.2), ...Hd(-2, 2.6), ...Hd(-6.2, 3), FUR);
      q.tri(...Hd(-3.4, 2.2), ...Hd(-0.6, 4), ...Hd(-4.6, 5.6), FUR);
      const E = ear(0, FUR);
      if (silhouette) return;
      // shading: crown and muzzle bridge lit, jaw in shadow, warm underlight on the jaw line
      {
        const src = q.clone();
        const up = (x: number, y: number) => !src.isOpaque(x, y - 1);
        for (let y = 0; y < q.h; y++)
          for (let x = 0; x < q.w; x++) {
            if (src.get(x, y) !== FUR) continue;
            // position in head space (rotate back)
            const dx = x + 0.5 - head[0];
            const dy = y + 0.5 - head[1];
            const v = (-dx * hs + dy * hc) / HS;
            let c: number = PAL.stone1;
            if (up(x, y)) c = PAL.stone3;
            else if (v < 0.4) c = PAL.stone2;
            else if (!src.isOpaque(x, y + 1)) c = open ? PAL.fire2 : PAL.stone0;
            else if (v > 2.6) c = PAL.stone0;
            if (c === PAL.stone1 && !src.isOpaque(x - 1, y)) c = PAL.stone2;
            q.set(x, y, c);
          }
      }
      // ear interiors glow from the mane
      {
        const i0 = lerpPt(lerpPt(E.a, E.b, 0.55), E.tip, 0.2);
        const i1 = lerpPt(i0, E.tip, 0.45);
        q.paint(i0[0], i0[1], o.fl > 0.75 ? PAL.fire2 : PAL.fire1);
        q.paint(i1[0], i1[1], PAL.fire1);
      }
      // mouth line when shut, teeth when open, snarl wrinkles
      if (!open) {
        q.line(...Hd(4, 1.9), ...Hd(10, 1.5), PAL.ink);
        q.paint(...Hd(3.4, 2.1), PAL.fire2);
      } else {
        // fangs: upper canine hangs down, lower canine points up
        q.set(...Hd(9.2, 2.1), PAL.white);
        if (o.jaw > 0.25) q.set(...Hd(9.2, 2.9), PAL.stone4);
        q.set(...J(8.8, 1.6), PAL.white);
      }
      if (o.snarl > 0.4) {
        for (let u = 5; u <= 8.5; u += 1.75) q.paint(...Hd(u, 1.6), PAL.stone4);
        q.paint(...Hd(6.2, -2), PAL.stone0);
        q.paint(...Hd(7.4, -1.6), PAL.stone0);
      }
      // nose
      const ns = Hd(10.8, -0.4);
      q.set(ns[0], ns[1], PAL.ink).set(ns[0] - 1, ns[1], PAL.ink).set(ns[0], ns[1] + 1, PAL.ink);
      // brow + glowing amber eye
      const eyeP = Hd(2.6, -1.6);
      const ex = Math.round(eyeP[0]);
      const ey = Math.round(eyeP[1]);
      q.set(ex - 2, ey - 1, PAL.stone0).set(ex - 1, ey - 1, PAL.ink).set(ex, ey - 1, PAL.ink).set(ex + 1, ey - 1, PAL.stone0);
      if (o.eye < 0.2) {
        q.set(ex - 1, ey, PAL.ink).set(ex, ey, PAL.ink).set(ex + 1, ey, PAL.fire2);
      } else if (o.eye < 0.8) {
        q.set(ex - 1, ey, PAL.ink).set(ex, ey, PAL.gold3).set(ex + 1, ey, PAL.fire3);
      } else {
        q.set(ex - 1, ey, PAL.fire3).set(ex, ey, o.eye > 1.5 ? PAL.white : PAL.gold4).set(ex + 1, ey, PAL.gold3);
        q.set(ex, ey + 1, PAL.ink);
      }
    },
    sep,
  );

  return { body, head: headMask, nearLegs, tailTip: tailPts[tailPts.length - 1], tailPts };
}

/** A deliberate ember seam: 1px fire3 vein with fire2 lips at its wider middle. */
function seam(q: Canvas, pts: Pt[], fl: number): void {
  const hot = fl > 1.25 ? PAL.fire4 : PAL.fire3;
  const lip = fl < 0.7 ? PAL.fire1 : PAL.fire2;
  const all: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const n = Math.max(1, Math.ceil(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) * 1.5));
    for (let k = 0; k < n; k++) all.push(lerpPt(pts[i], pts[i + 1], k / n));
  }
  all.push(pts[pts.length - 1]);
  all.forEach(([x, y], i) => {
    const f = i / (all.length - 1);
    const mid = f > 0.25 && f < 0.75;
    if (mid) q.paint(x - 1, y, lip);
    q.paint(x, y, f < 0.08 || f > 0.92 ? lip : hot);
  });
}

function drawWolf(p: Canvas, o: Pose): void {
  const R = rig(o);
  const { B, Hd } = R;
  const S = drawBody(p, o, R, false);

  // ------------------------------------------------ outline the solid body
  p.outline(PAL.ink);
  const solid = p.clone();
  /** Flicker 0..1: a flowing wave per tongue plus a little per-frame crackle. */
  const flick = (i: number) => Math.max(0, Math.min(1, 0.5 + 0.36 * Math.sin((o.t * 2 + i * 0.618) * TAU) + 0.24 * (hash(i, Math.round(o.t * 40), 7) - 0.5)));
  const fl = o.fl;
  /** Wind: flames stream back (toward screen-left) as the wolf moves. */
  const windA = (a: number, k = 0.85) => {
    // rotate toward π (back) through the shorter way
    let d = Math.PI - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return a + d * o.wind * k;
  };

  // ------------------------------------------------ lunge afterimages: whole-wolf silhouettes in translucent fire
  for (const g of o.ghosts) {
    const t = new PixelCanvas(p.w, p.h);
    drawBody(t, { ...o, ghosts: [] }, R, true);
    const b = t.bounds();
    if (!b) continue;
    for (let y = 0; y < t.h; y++)
      for (let x = 0; x < t.w; x++) {
        if (!t.isOpaque(x, y)) continue;
        const X = x + g.dx;
        const Y = y + g.dy;
        if (X < 0 || Y < 0 || X >= p.w || Y >= GROUND || solid.isOpaque(X, Y)) continue;
        // fades out toward the tail end and toward the frame's left edge (never a hard cut)
        const f = (x - b.x) / Math.max(1, b.w);
        const k = g.a * Math.min(1, 0.2 + 1.1 * f) * Math.max(0, Math.min(1, (X - 1) / 7));
        // a hot rim around the ghost's silhouette, a dimmer translucent fill inside
        const edge = !t.isOpaque(x, y - 1) || !t.isOpaque(x + 1, y) || !t.isOpaque(x - 1, y) || !t.isOpaque(x, y + 1);
        const nearG = g.a > 0.6;
        const a = Math.round(255 * Math.min(1, edge ? k * 1.1 : k * 0.72));
        if (a < 28) continue;
        p.set(X, Y, edge ? (nearG ? PAL.fire3 : PAL.fire2) : nearG ? PAL.fire2 : PAL.fire1, a);
      }
  }

  // ------------------------------------------------ fire trail streaming back along the ground
  if (o.trail > 0) {
    const x0 = Math.round(Math.min(o.hn[0], o.hf[0]) - 2);
    const len = Math.max(0, Math.min(Math.round(22 * o.trail), x0 - 2));
    for (let i = 0; i < len; i++) {
      const x = x0 - i;
      const k = 1 - i / len;
      if (!solid.isOpaque(x, GROUND - 1)) p.set(x, GROUND - 1, k > 0.6 ? PAL.fire3 : k > 0.25 ? PAL.fire2 : PAL.fire1);
      if (i % 4 === 1 && x >= 7) tongue(p, [x, GROUND - 1], -Math.PI + 0.55, (2.5 + 4 * k) * (0.7 + 0.5 * flick(i + 80)), 2.6, 0.25, o.t * 4 + i * 0.3, k * 1.3, solid);
    }
  }

  // ------------------------------------------------ mane: five shaped tongues along the crest, curling back
  const crest = (f: number): Pt => lerpPt(Hd(-2.8, -3.6), B(5, -8.4), f);
  const mane: [number, number, number, number][] = [
    // [crest pos, length, width, base angle] — tallest in the middle, sweeping back over the shoulders
    [0.0, 10, 5.5, -1.65],
    [0.27, 14.5, 7, -1.9],
    [0.53, 15.5, 7.5, -2.15],
    [0.78, 13.5, 7, -2.4],
    [1.02, 10, 6, -2.65],
  ];
  mane.forEach(([f, L0, wd, a], i) => {
    const L = fl * L0 * (0.84 + 0.28 * flick(i + 1));
    const r = crest(f);
    tongue(p, [r[0], r[1] + 1.5], windA(a + Math.sin((o.t * 2 + i * 0.21) * TAU) * 0.08), L, wd, -0.5 - 0.3 * o.wind, o.t * 2 + i * 0.27, fl * 1.05, S.head);
  });
  // two small front tongues lick over the crest so the mane sits ON the neck
  for (let i = 0; i < 2; i++) {
    const r = crest(0.25 + i * 0.4);
    const L = fl * (3.5 + 2 * flick(i + 60));
    tongue(p, [r[0] + 0.5, r[1] + 2], windA(-2.0 - i * 0.2), L, 3, -0.4, o.t * 3 + i * 0.4 + 0.2, fl * 1.1, S.head);
  }
  // a couple of embers torn off the mane drift up and back
  for (let k = 0; k < 2; k++) {
    const ph = (o.t * 2 + k / 2) % 1;
    const r = crest(0.3 + k * 0.4);
    const ex = Math.round(r[0] - 4 - ph * (5 + o.wind * 8));
    const ey = Math.round(r[1] - 8 - ph * 7 * fl + o.wind * ph * 6);
    if (ex > 1 && ey > 1 && !p.isOpaque(ex, ey) && !p.isOpaque(ex, ey + 1)) {
      p.set(ex, ey, ph < 0.4 ? PAL.fire4 : PAL.fire3);
      p.set(ex, ey + 1, PAL.fire2);
    }
  }

  // ------------------------------------------------ tail plume: three tongues curling up and back
  {
    const tip = S.tailTip;
    // the plume rises from the tail tip and curls back; wind lays it down behind the wolf
    const dir = windA(o.tail + 0.4, 0.5);
    const sway = Math.sin(o.tw * TAU) * 0.12;
    tongue(p, tip, dir + sway, fl * 15 * (0.85 + 0.25 * flick(40)), 6.5, -0.35, o.t * 2 + 0.5, fl * 1.1, null);
    tongue(p, S.tailPts[3], dir + 0.5 + sway, fl * 7.5 * (0.8 + 0.3 * flick(41)), 4, -0.45, o.t * 2 + 0.15, fl, solid);
    tongue(p, S.tailPts[2], dir - 0.55 + sway, fl * 6.5 * (0.8 + 0.3 * flick(42)), 3.6, -0.35, o.t * 2 + 0.8, fl * 0.9, solid);
  }

  // ------------------------------------------------ paws of living flame: tongues wrap each paw and lick up the pastern
  for (const [pw, near] of [
    [o.ff, false],
    [o.hf, false],
    [o.fn, true],
    [o.hn, true],
  ] as const) {
    const k = flick(Math.round(pw[0]) * 3);
    const L = fl * (near ? 6.5 : 5.5) * (0.75 + 0.4 * k);
    // far paws burn behind the near legs; near paws burn over everything
    tongue(p, [pw[0] + 1, pw[1] - 0.5], windA(-Math.PI / 2 - 0.4), L, near ? 4.4 : 3.8, -0.45, o.t * 4 + pw[0] * 0.1, fl * (near ? 1.15 : 0.9), near ? null : S.nearLegs);
    tongue(p, [pw[0] - 1.2, pw[1] - 1], windA(-Math.PI / 2 - 0.85), L * 0.55, 2.8, -0.3, o.t * 4 + pw[0] * 0.1 + 0.4, fl * (near ? 1 : 0.8), near ? null : S.nearLegs);
  }

  // ------------------------------------------------ landing puff: dust kicked sideways, embers popping up
  if (o.puff > 0) {
    const k = o.puff;
    for (const pw of [o.fn, o.ff]) {
      const d = Math.round(3 + 3 * k);
      for (const [dx, dy, c] of [
        [-d - 1, -1, PAL.stone2],
        [-d, -2, PAL.stone3],
        [d + 2, -1, PAL.stone2],
        [d + 3, -2, PAL.stone3],
        [-d + 1, -3 - Math.round(2 * k), PAL.fire3],
        [d + 1, -4 - Math.round(2 * k), PAL.fire4],
      ] as const) {
        const x = Math.round(pw[0] + dx);
        const y = Math.round(pw[1] + dy);
        if (!p.isOpaque(x, y)) p.set(x, y, c);
      }
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
  drawWolf(big, P({ eye: 2, jaw: 0.42, snarl: 1, ears: 0.3, fl: 1.3, t: 0.35, tw: 0.35, na: -0.95, hp: 0.05 }));
  // frame the head: eye at ~2/3 of the width
  const ox = 19;
  const oy = 6;
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
/** Muzzle = between the open jaws (the canines) in the impact frame. */
const MUZZLE = (() => {
  const { Hd, J } = rig(ANIMS.attack.poses[IMPACT_FRAME]);
  const a = Hd(9.2, 2.1);
  const b = J(8.8, 1.6);
  return { x: Math.round((a[0] + b[0]) / 2), y: Math.round((a[1] + b[1]) / 2) };
})();

const art: MonsterArt = {
  id: 'ember_wolf',
  w: W,
  h: H,
  anchorX: 29,
  anchorY: GROUND,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: 30, y: 38 },
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
