// HD render — demo creature "Küre Gezgini" (orb walker): a brilliant-cut crystal orb on four
// crystal-hide legs, with a charcoal fur ruff, a gold band, a crystal crown, a living flame
// plume, a translucent glass sail fin and a ringed tail with a crystal blade. It exists to
// prove (and document by example) every part of the library:
//
//   rig        Skeleton (anchors), ik2 (planted feet), lagChain (idle tail / fin), springChain (hit tail), poseAt
//   volumes    cutGem, shard, tube (rings, belly), ellipsoid, membrane (translucent), flame, furFringe
//   shading    materials with hue-shifted ramps, spec glints, edge light, emissive heat
//   line work  inner lines, contact shadows, selective outline, drop shadow helper
//   output     HDFrame { color, normal } + emissive mask + debug stages
//
// 192×192 frame (the "As" size), faces right, anchor = ground contact between the feet.

import { PAL } from '../../art/palette';
import { HDRenderer, type HDRenderResult } from './renderer';
import { MAT, farSide, variant } from './materials';
import { type V2, DEG, add, bezier, lerpV, madd, norm, norm3, perp, polar, rotV, sub, wave } from './math';
import { Skeleton, ik2, lagChain, loopPhase, poseAt, springChain, type Key } from './rig';

export const DEMO_W = 192;
export const DEMO_H = 192;
export const DEMO_ANCHOR: V2 = [94, 178];
export const DEMO_IDLE_FRAMES = 12;

export type DemoAnim = 'idle' | 'hit';
export const DEMO_ANIMS: Record<DemoAnim, { frames: number; fps: number; loop: boolean }> = {
  idle: { frames: DEMO_IDLE_FRAMES, fps: 10, loop: true },
  hit: { frames: 8, fps: 12, loop: false },
};

/** Every number that changes over an animation. */
export interface DemoPose extends Record<string, number> {
  /** Body shift (px), bob (px, + = down) and lean (deg). */
  x: number;
  bob: number;
  lean: number;
  /** Loop phase of secondary motion (tail, fin) and of the flame. */
  phase: number;
  /** 0..1 eye openness and core glow. */
  eye: number;
  glow: number;
}

const REST: DemoPose = { x: 0, bob: 0, lean: 0, phase: 0, eye: 1, glow: 0.5 };

// a breathing idle as keyframes: settle (down) → rise → hold; blink on frames 8–9
const IDLE_KEYS: Key<DemoPose>[] = [
  { f: 0, pose: { bob: 0, lean: 0, glow: 0.45 } },
  { f: 3, pose: { bob: 2.2, lean: 1.2, glow: 0.55 }, ease: 'inOutSine' },
  { f: 6, pose: { bob: 0.6, lean: 0.4, glow: 0.7 }, ease: 'inOutSine' },
  { f: 8, pose: { bob: -1.2, lean: -0.8, eye: 0.15, glow: 0.6 }, ease: 'inOutSine' },
  { f: 9, pose: { bob: -1.4, lean: -1, eye: 0.15, glow: 0.55 }, ease: 'linear' },
  { f: 10, pose: { bob: -0.8, lean: -0.6, eye: 1, glow: 0.5 }, ease: 'outQuad' },
];

// hit: snapped back and up (eye squeezed), overshoots forward, settles — anticipation-free by design
const HIT_KEYS: Key<DemoPose>[] = [
  { f: 0, pose: { x: 0, lean: 0 } },
  { f: 1, pose: { x: -7, bob: -3, lean: -12, eye: 0.15, glow: 1 }, ease: 'outExpo' },
  { f: 2.5, pose: { x: -8, bob: -1, lean: -9, eye: 0.15, glow: 0.8 }, ease: 'outQuad' },
  { f: 4.5, pose: { x: 2, bob: 1.5, lean: 4, eye: 1, glow: 0.55 }, ease: 'inOutSine' },
  { f: 6, pose: { x: -0.5, bob: 0, lean: -1, glow: 0.5 }, ease: 'inOutSine' },
  { f: 7.5, pose: { x: 0, bob: 0, lean: 0 }, ease: 'inOutSine' },
];

/** Pose at a (fractional) frame of an animation. */
export function demoPose(frame: number, anim: DemoAnim = 'idle'): DemoPose {
  if (anim === 'hit') return { ...poseAt(REST, HIT_KEYS, frame), phase: (frame / DEMO_ANIMS.hit.frames) * 0.6 };
  const p = poseAt(REST, IDLE_KEYS, frame, DEMO_IDLE_FRAMES);
  return { ...p, phase: loopPhase(frame, DEMO_IDLE_FRAMES) };
}

// skeleton: the orb core is the root; crown / fin / tail anchors hang off it so lean rotates all
const SK = new Skeleton([
  { name: 'up', length: 40, angle: -90 }, // core → top of the orb
  { name: 'back', length: 30, angle: 210 }, // core → back-top (fin root)
  { name: 'rear', length: 38, angle: 162 }, // core → rear (tail root)
  { name: 'hipNF', length: 26, angle: 62 },
  { name: 'hipNB', length: 27, angle: 118 },
  { name: 'hipFF', length: 22, angle: 50, z: -10 },
  { name: 'hipFB', length: 22, angle: 128, z: -10 },
]);

const FEET = {
  NF: [130, 176] as V2,
  NB: [56, 177] as V2,
  FF: [143, 168] as V2,
  FB: [72, 168] as V2,
};

const HIDE = MAT.iceHide;
const HIDE_FAR = farSide(MAT.iceHide);
const GOLD = MAT.gold;
const ORB = variant(MAT.crystal, { name: 'orb', transmit: 0.6 });

const r = new HDRenderer(DEMO_W, DEMO_H);

/** Render one frame of `anim` (default idle). `stages: true` also returns albedo / normal / lit debug images. */
export function renderDemo(frame: number, o: { stages?: boolean; anim?: DemoAnim } = {}): HDRenderResult {
  const anim = o.anim ?? 'idle';
  const P = demoPose(frame, anim);
  const C: V2 = [92 + P.x, 100 + P.bob];
  const rig = SK.solve({ x: C[0], y: C[1], angle: P.lean });
  r.begin();

  // ---------------- glass sail fin (behind everything): bones lag behind the body (secondary)
  {
    const root = rig.end('back');
    // three rays from one root; each ray trails the previous one by a tenth of the loop
    // (overlapping action: the leading ray moves first, the others follow)
    const tips: V2[] = [];
    for (let i = 0; i < 3; i++) {
      const ang = [-150, -168, 172][i] + wave(P.phase - i * 0.1, 0.1) * (3 + i * 2) + P.lean;
      tips.push(add(root, polar(ang, [44, 50, 40][i])));
    }
    const p = r.part('fin');
    for (let i = 0; i < tips.length - 1; i++) {
      const a = tips[i];
      const b = tips[i + 1];
      const sc = bezier(a, lerpV(lerpV(a, b, 0.5), root, 0.38), b, undefined, 8);
      p.membrane([root, ...sc], { mat: MAT.glass, billow: -0.35, bias: i === 0 ? 0.12 : 0 });
    }
    // the last panel closes onto the orb's back
    const last = tips[tips.length - 1];
    const back2 = add(root, polar(150 + P.lean, 20));
    p.membrane([root, ...bezier(last, lerpV(lerpV(last, back2, 0.5), root, 0.3), back2, undefined, 6)], { mat: MAT.glass, billow: -0.3, bias: -0.08 });
    for (let i = 0; i < tips.length; i++) {
      const mid = madd(lerpV(root, tips[i], 0.5), perp(norm(sub(tips[i], root))), -2.5);
      p.tube(bezier(root, mid, tips[i], undefined, 10), (t) => 2.6 - t * 1.7, { mat: HIDE, z: 3 });
    }
    p.detail((d) => {
      // veins: a thin bright line down the middle of each panel
      for (let i = 0; i < tips.length - 1; i++) {
        const m = lerpV(tips[i], tips[i + 1], 0.5);
        d.line(lerpV(root, m, 0.22), lerpV(root, m, 0.72), PAL.cyan3, { emissive: true });
      }
    });
  }

  // ---------------- tail (behind the body): ringed tube that waves root → tip, crystal blade
  {
    const root = rig.end('rear');
    const TAIL_REST = [8, 6, -4, -12, -16, -18, -18, -16];
    const pts =
      anim === 'idle'
        ? // loop: a sine wave travels root → tip (seamless)
          lagChain({ root, count: 8, seg: 6.2, rootAngle: 168 + P.lean, rest: TAIL_REST, drive: (t) => wave(t) * 7, t: P.phase, lag: 0.07 })
        : // one-shot: a spring chain dragged by the body, simulated from frame 0 (deterministic)
          springChain({
            count: 8,
            seg: 6.2,
            rest: [168 + TAIL_REST[0], ...TAIL_REST.slice(1)],
            anchor: (t) => {
              const q = demoPose(t * DEMO_ANIMS.hit.fps, 'hit');
              const rr = SK.solve({ x: 92 + q.x, y: 100 + q.bob, angle: q.lean });
              return { p: rr.end('rear'), angle: q.lean };
            },
            t: frame / DEMO_ANIMS.hit.fps,
            stiffness: 0.12,
            damping: 0.08,
            gravity: [0, 40],
          });
    const p = r.part('tail');
    p.tube(pts, (t) => 7 - t * 4.6, { mat: HIDE, rings: { every: 5.5, width: 1, bias: -0.3, from: 0.12, to: 0.92 }, belly: { from: 0.45, bias: 0.12, side: -1 } });
    const tip = pts[pts.length - 1];
    const dir = norm(sub(tip, pts[pts.length - 2]));
    p.shard(madd(tip, dir, -2), madd(tip, dir, 16), 4, { mat: MAT.crystal, z: 6 });
  }

  // ---------------- far legs (darker far-side material)
  const leg = (hipBone: string, foot: V2, far: boolean, bend: 1 | -1) => {
    const hip = rig.end(hipBone);
    const ankle = add(foot, [-3, -7]);
    const k = ik2(hip, ankle, 30, 29, bend);
    const p = r.part(far ? 'leg-far' : 'leg');
    const mat = far ? HIDE_FAR : HIDE;
    p.tube([hip, k.joint], [9, 6.5], { mat, z: 2 });
    p.tube([k.joint, ankle], [6, 4.4], { mat, z: 4, rings: { every: 6, width: 1, bias: -0.25, from: 0.25, to: 0.8 } });
    p.ellipsoid(add(foot, [0, -2.5]), 7.5, 4.2, { mat, z: 6 });
    p.tube([ankle, add(foot, [-1, -3])], [4.4, 4.2], { mat, z: 5 });
    // gold knee cap + claws
    p.cutGem(k.joint, 4.2, 4.2, { mat: far ? farSide(GOLD) : GOLD, sides: 6, rings: [[0.55, 3]], z: 9 });
    for (const [dx, a, l] of [
      [5, 18, 7],
      [1, 40, 6],
    ] as const)
      p.shard(add(foot, [dx, 0]), add(add(foot, [dx, 0]), polar(a, l)), 1.8, { mat: far ? farSide(GOLD) : GOLD, z: 8 });
  };
  leg('hipFB', FEET.FB, true, 1);
  leg('hipFF', FEET.FF, true, -1);

  // ---------------- the orb: brilliant-cut crystal body
  {
    const p = r.part('orb');
    p.cutGem(C, 40, 38, { mat: ORB, sides: 14, rings: [[0.84, 11], [0.6, 21], [0.34, 27]], angle: (P.lean + 8) * DEG });
    // inner glow: a few facets lift with the glow level
    p.biasWhere((x, y) => {
      const d = Math.hypot(x + 0.5 - (C[0] + 6), y + 0.5 - (C[1] + 4));
      return d < 15 ? 0.12 + P.glow * 0.15 : 0;
    });
  }

  // ---------------- crown shards + flame plume on top
  {
    const top = rig.end('up');
    const p = r.part('crown');
    p.shard(add(top, [-14, 6]), add(top, polar(-128 + P.lean, 24)), 4.6, { mat: MAT.crystal });
    p.shard(add(top, [12, 6]), add(top, polar(-56 + P.lean, 20)), 4, { mat: MAT.crystal });
    p.shard(add(top, [-2, 5]), add(top, polar(-96 + P.lean, 18)), 5.2, { mat: MAT.crystal, z: 2 });
  }
  {
    const top = add(rig.end('up'), [-1, -4]);
    const p = r.part('flame', { lines: false, shadow: false, outline: false });
    const tip = add(top, polar(-98 + P.lean * 2, 46));
    p.flame({ mat: MAT.flame, spine: bezier(top, add(top, [-4, -18]), add(tip, [6, 10]), tip, 10), width: 10, t: P.phase, seed: 4, sway: 5, turbulence: 0.6, speed: 2 });
  }

  // ---------------- gold band around the orb (front half)
  {
    const band: V2[] = [];
    // a latitude ring on the orb: its ends meet the silhouette, its middle bulges toward us
    const tilt = (-10 + P.lean) * DEG;
    const lat = 9;
    const rx = Math.sqrt(40 * 40 - lat * lat) - 2.5; // ends tuck just inside the cut silhouette
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      band.push(add(C, rotV([Math.cos(a) * rx, lat + Math.sin(a) * 8], tilt)));
    }
    r.part('band').tube(band, 3.2, { mat: GOLD, z: 30, rings: { every: 7, width: 1, bias: -0.35, offset: 3 } });
  }

  // ---------------- the eye: dark socket, glowing iris, slit pupil, catchlight
  {
    const e: V2 = add(C, rotV([16, -6], P.lean * DEG));
    const p = r.part('eye');
    p.ellipsoid(e, 10, 9 * Math.max(0.25, P.eye), { mat: MAT.steel, bias: -0.55, rz: 3, z: 32 });
    if (P.eye > 0.5) p.sphere(add(e, [1, 0.5]), 6.2, { mat: MAT.eyeCyan, heat: 'radial', z: 36 });
    p.detail((d) => {
      if (P.eye <= 0.5) {
        d.line(add(e, [-8, 0]), add(e, [8, 1]), PAL.cyan3, { emissive: true });
        return;
      }
      const c: V2 = add(e, [2, 1]);
      for (let y = -3; y <= 3; y++) d.set(c[0], c[1] + y, Math.abs(y) === 3 ? PAL.cyan1 : PAL.night0);
      d.set(c[0] - 3, c[1] - 3, PAL.white, { emissive: true });
      d.set(c[0] - 2, c[1] - 3, PAL.white, { emissive: true });
      d.set(c[0] - 3, c[1] - 2, PAL.white, { emissive: true });
    });
    // brow plate: a gold facet above the eye
    p.facet3(
      [
        [e[0] - 12, e[1] - 9, 40],
        [e[0] + 2, e[1] - 13, 44],
        [e[0] + 13, e[1] - 9, 40],
        [e[0] + 1, e[1] - 7.5, 46],
      ],
      { mat: GOLD, z: 0 },
    );
  }

  // ---------------- fur ruff under the orb (charcoal fur fringe, two rows)
  {
    const arc = (r0: number, a0: number, a1: number): V2[] => {
      const out: V2[] = [];
      for (let i = 0; i <= 16; i++) out.push(add(C, polar(a0 + ((a1 - a0) * i) / 16 + P.lean, r0)));
      return out;
    };
    // clumps take the orb's surface normal at their root, so the ruff shades as one volume
    const orbNormal = (_t: number, root: V2) => {
      const u = (root[0] - C[0]) / 44;
      const v = (root[1] - C[1]) / 42;
      return norm3([u, v, Math.sqrt(Math.max(0.05, 1 - u * u - v * v))]);
    };
    const p = r.part('ruff');
    p.furFringe(arc(33, 158, 22), { mat: MAT.charcoalFur, count: 15, length: 15, width: 5.2, side: 1, flow: [-0.5, 1], comb: 0.35, seed: 11, bend: 1.5, inset: 4, baseNormal: orbNormal, lean: 0.55 });
    p.furFringe(arc(29, 150, 30), { mat: MAT.charcoalFur, count: 12, length: 11, width: 4.6, side: 1, flow: [-0.6, 1], comb: 0.3, seed: 5, bend: 1, inset: 3, idBase: 100, baseNormal: orbNormal, lean: 0.55 });
  }

  // ---------------- near legs (in front)
  leg('hipNB', FEET.NB, false, 1);
  leg('hipNF', FEET.NF, false, -1);

  // ---------------- light overlay: a 4-point glint travelling across the orb facets
  {
    const s = anim === 'idle' ? Math.floor(P.phase * DEMO_IDLE_FRAMES) : -1;
    const spots: V2[] = [add(C, [-20, -16]), add(C, [-8, -24]), add(C, [6, -26])];
    const at = s >= 2 && s < 5 ? spots[s - 2] : null;
    if (at)
      r.overlay((ov) => {
        const x = Math.round(at[0]);
        const y = Math.round(at[1]);
        ov.set(x, y, PAL.white, { emissive: true, onlyOver: true });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          ov.set(x + dx, y + dy, PAL.cyan4, { emissive: 200, onlyOver: true });
          if (s === 3) ov.set(x + dx * 2, y + dy * 2, PAL.cyan3, { emissive: 160, onlyOver: true });
        }
      });
  }

  return r.finish(o);
}

