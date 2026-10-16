// Art Lab C — "Kristal Ejder" (variant C "Orijinal Neon, Yüksek Detay"): the ORIGINAL Neon Düello
// crystal wyrm (src/art/monsters/crystal_wyrm.ts) redrawn with variant A's craft.
//
// Identity kept from the original: a white / steel crystal dragon standing upright on its hind
// legs, torso leaning forward from the hip, a long neck rising to an angular flat-planed head
// with one gold horn swept back off the crown and a gold cheek spur, a glowing cyan eye, the near
// forearm raised in front, cyan glass wings with white finger struts (the near wing big and
// behind the back, the far wing rising behind the neck), cyan crystal spikes down the neck, back
// and tail, a long tail curling back to a crystal blade. Same pose language, same colours (steel →
// white hide, cyan glass, gold horn); every proportion is the original's ×1.2.
//
// What changed is the craft: the dragon's own ramps derived from the neon palette (7 hide tones,
// 8 glass tones, dragon-palette.ts), faceted crystal planes quantized into clean tone bands with
// hand-placed facet lines and glints (the automatic base is cleaned, the hand detail never is), a
// selective outline (ink on the shadow side and the ground, a coloured line on the lit edges) and
// the original's reflected cyan rim on the shadow-side edges, hand-authored head maps with eye /
// mouth expressions (dragon-head.ts), hand-drawn claws, wing joints (arm bone, wrist knuckle,
// finger struts, an elbow spur), per-frame holds and drawn squash (the hip sinks, the knees
// bend, the torso leans) — the sprite is never scaled or rotated.
//
// Drawn facing RIGHT, 1 art px = 1 game px. A frame is a POSE (numbers, in the original's units)
// mapped into this frame by T() (×1.2 around the anchor between the planted hind feet).

import { PixelCanvas } from '../../art/pixel';
import { PAL } from '../../art/palette';
import type { DragonAnim, LabAnim, LabFramePoints, LabMonsterArt } from '../types';
import { C_GLASS, C_GOLD, C_HIDE, C_INK, C_MOUTH } from './dragon-palette';
import {
  DEG, Layer, type Mat, type V2, addV, bezier, clamp, composite, floorV, ik, lenV, lerp, lerpV, line4Pixels,
  linePixels, mulV, normV, paintLine, polar, registerColor, registerRamp, rimLight, rotV, roundV, samplePath,
  selectiveOutline, stampMap, subV,
} from './dragon-rig';
import { EYES, HEAD_BREATH, HEAD_GRIT, HEAD_KEY, HEAD_OPEN, HEAD_ROAR, HEAD_SIDE, type EyeKind, type HeadMap } from './dragon-head';

// ------------------------------------------------------------------ frame
//
// Frame 134×128 (the original is 96×96). Measured over every frame of every anim (union of the
// opaque pixels: x 2..131, y 2..125): the idle pose alone is 103×108; the Prizma Nefesi breath
// stretches the neck forward and up until the open jaws reach x 131 (60 px in front of the
// anchor); the victory rear-up and the summon unfurl fling the near wing back to x 2; the summon
// cocoon starts 34 px above the tile (its top at y 2). So this is the smallest frame in which no
// pose is clipped (1 px to spare); it is a bigger drawing SURFACE, 1 art pixel is still 1 game px.
// The anchor sits between the planted hind feet (the original's x = 50, near foot x 66..82 on the
// sole row, the far foot 3 rows higher behind it).

const W = 134;
const H = 128;
/** last solid row of the planted soles (claw tips) */
const GY = 124;
/** anchor column (the original's x = 50, between the planted hind feet) */
const AX = 71;
/** the original's proportions ×1.2 */
const K = 1.2;
/** original units → frame px */
const T = (v: V2, lift = 0): V2 => [AX + (v[0] - 50) * K, GY + (v[1] - 90) * K + lift];
const L = (n: number) => n * K;

// ------------------------------------------------------------------ materials

const HIDE = C_HIDE;
const GLASS = C_GLASS;
const GOLD = C_GOLD;
const INK = C_INK.ink;

registerRamp(HIDE, C_INK.litHide, INK);
registerRamp(GLASS, PAL.cyan1, INK);
registerRamp(GOLD, GOLD[1], INK);
registerRamp(C_MOUTH, INK, INK);
registerColor(C_INK.navy, INK, INK);
registerColor(INK, INK, INK);

const M = { HIDE: 0, HIDE_FAR: 1, GLASS: 2, GLASS_FAR: 3, CRYS: 4, GOLD: 5 } as const;
const HIDE_TH = [-0.5, -0.26, -0.02, 0.22, 0.5, 0.72] as const;
const MATS: Mat[] = [];
MATS[M.HIDE] = { ramp: HIDE, th: HIDE_TH };
MATS[M.HIDE_FAR] = { ramp: HIDE, th: HIDE_TH, shift: -1 };
MATS[M.GLASS] = { ramp: GLASS };
MATS[M.GLASS_FAR] = { ramp: GLASS, shift: -1 };
MATS[M.CRYS] = { ramp: GLASS };
MATS[M.GOLD] = { ramp: GOLD, th: [-0.6, -0.2, 0.15, 0.6] };

const newLayer = () => new Layer(W, H, MATS);

/** reflected neon rim: shadow-side hide tones → cyan (the original's arena-light edge) */
const RIM = new Map<number, number>([
  [HIDE[0], PAL.cyan1],
  [HIDE[1], PAL.cyan2],
  [HIDE[2], PAL.cyan2],
  [HIDE[3], GLASS[4]],
]);

// ------------------------------------------------------------------ pose

interface Wing {
  /** humerus, forearm and first finger angles (deg, screen space) */
  a1: number;
  a2: number;
  a3: number;
  /** finger fan step (deg) */
  fan: number;
  /** bone length multiplier */
  span: number;
  /** where the inner membrane meets the body, in torso space (original units) */
  at?: V2;
}

interface Pose {
  /** whole-body vertical offset in frame px (summon descent, victory hop); feet move with it */
  lift: number;
  /** hip offset (original units); + y sinks the hip = knees bend (squash) */
  hx: number;
  hy: number;
  /** torso rotation around the hip (rad, − = rear up) */
  lean: number;
  /** head pivot offset from neutral (original units) */
  headX: number;
  headY: number;
  head: HeadKind;
  eyes: EyeKind;
  /** prism light: 0 none; closed jaws: a thread of light between the lips (> 0.3); open jaws: the
   *  throat glow (1 / 2 = two sizes that alternate while the breath is held) */
  mouthLight: number;
  nw: Wing;
  fw: Wing;
  /** tail sway phase (0..1), amplitude (deg) and curl (deg, + lifts the tip) */
  tail: number;
  tailAmp: number;
  tailLift: number;
  /** forearm raise (deg) */
  arm: number;
  /** S-coil of the neck (original units): the lower neck bulges forward, the upper neck back */
  coil: number;
  /** crystal energy 0..1 (spikes, veins) */
  glow: number;
  /** glint band position across the wing glass (0..1; < 0 none) */
  glint: number;
  /** glass flash: every wing panel lifted this many tones (the summon's unfurl) */
  flash: number;
  /** crystal twinkles: [anchor, size 1|2] (0/1/3 near-wing glass, 2 far wing, 4 tail blade) */
  sparkles: [number, number][];
  /** summon cocoon: both wings wrapped forward around the body */
  guard: boolean;
  /** airborne: the hind feet hang this far (original units) toward the hip instead of standing */
  tuck: number;
}

type HeadKind = 'side' | 'open' | 'breath' | 'roar' | 'grit';
const HEADS: Record<HeadKind, HeadMap> = { side: HEAD_SIDE, open: HEAD_OPEN, breath: HEAD_BREATH, roar: HEAD_ROAR, grit: HEAD_GRIT };

const NEUTRAL: Pose = {
  lift: 0,
  hx: 0,
  hy: 0,
  lean: 0,
  headX: 0,
  headY: 0,
  head: 'side',
  eyes: 'open',
  mouthLight: 0,
  nw: { a1: -108, a2: -138, a3: -118, fan: -40, span: 1 },
  fw: { a1: -84, a2: -110, a3: -92, fan: -28, span: 1 },
  tail: 0,
  tailAmp: 4,
  tailLift: 0,
  arm: 0,
  coil: 0,
  glow: 0.3,
  glint: -1,
  flash: 0,
  sparkles: [],
  guard: false,
  tuck: 0,
};

type PoseKey = Partial<Omit<Pose, 'nw' | 'fw'>> & { nw?: Partial<Wing>; fw?: Partial<Wing> };

function pose(d: PoseKey): Pose {
  return { ...NEUTRAL, ...d, nw: { ...NEUTRAL.nw, ...(d.nw ?? {}) }, fw: { ...NEUTRAL.fw, ...(d.fw ?? {}) } };
}

// ------------------------------------------------------------------ skeleton (original units)

const FOOT_NEAR: V2 = [52, 88];
const ANKLE_NEAR: V2 = [44.5, 83];
const FOOT_FAR: V2 = [62, 85];
const ANKLE_FAR: V2 = [55, 80];
const NEAR_FINGERS = [19.5, 22.5, 19];
const FAR_FINGERS = [17.5, 16, 12.5];

interface Rig {
  hip: V2;
  chest: V2;
  tAng: number;
  att: (o: V2) => V2;
  neck0: V2;
  head: V2;
}

function rig(P: Pose): Rig {
  const hip: V2 = [42 + P.hx, 66 + P.hy];
  const tAng = -0.95 + P.lean;
  const chest = addV(hip, [Math.cos(tAng) * 18, Math.sin(tAng) * 18]);
  const att = (o: V2): V2 => addV(chest, rotV(o, P.lean));
  return { hip, chest, tAng, att, neck0: att([3, -5]), head: addV(chest, [14 + P.headX, -28 + P.headY]) };
}

interface WingRig {
  S: V2;
  E: V2;
  Wr: V2;
  tips: V2[];
  attach: V2;
}

function wingRig(S: V2, w: Wing, fingers: number[], l1: number, l2: number, attach: V2): WingRig {
  const E = addV(S, polar(w.a1, l1 * w.span));
  const Wr = addV(E, polar(w.a2, l2 * w.span));
  const tips = fingers.map((fl, i) => addV(Wr, polar(w.a3 + w.fan * i, fl * w.span)));
  return { S, E, Wr, tips, attach };
}

function wings(P: Pose): { far: WingRig; near: WingRig } {
  const { hip, chest, att } = rig(P);
  const backAttach = addV(lerpV(hip, chest, 0.3), rotV([-8, -5], P.lean));
  const far = wingRig(att([1, -8]), P.fw, FAR_FINGERS, 11, 13, att(P.fw.at ?? [-6, -4]));
  const near = wingRig(att([-6, -6]), P.nw, NEAR_FINGERS, 13, 16, P.nw.at ? att(P.nw.at) : backAttach);
  if (P.guard) {
    near.attach = addV(hip, [0, 8]);
    far.attach = att([12, 10]);
  }
  return { far, near };
}

/** the side of a tangent that faces up-left (dorsal side of an upright neck / tail) */
function dorsal(t: V2): V2 {
  const a: V2 = [-t[1], t[0]];
  const b: V2 = [t[1], -t[0]];
  const ref: V2 = [-0.45, -0.89];
  return a[0] * ref[0] + a[1] * ref[1] > b[0] * ref[0] + b[1] * ref[1] ? a : b;
}

// ------------------------------------------------------------------ crystal shard

/**
 * A faceted crystal spike from `base` along `dir` (frame px): two flat facets split down the
 * ridge — the one facing the key light takes the bright tone, the other the deep tone — and a
 * darker root where it grows out of the hide. `glow` (0..1) lifts both facets a step.
 */
function shard(g: Layer, base: V2, dir: V2, length: number, hw: number, z: number, glow: number): void {
  const d = normV(dir);
  const p: V2 = [-d[1], d[0]];
  const tip = addV(base, mulV(d, length));
  const b0 = subV(base, mulV(d, 2));
  const l = addV(b0, mulV(p, hw));
  const r = subV(b0, mulV(p, hw));
  const up = glow >= 0.75 ? 1 : 0;
  if (length < 5.5) {
    g.poly([l, tip, r], M.CRYS, 4 + up, z);
    return;
  }
  const sl = addV(addV(base, mulV(p, hw * 0.85)), mulV(d, length * 0.45));
  const sr = addV(subV(base, mulV(p, hw * 0.85)), mulV(d, length * 0.45));
  const litLeft = p[0] * -0.5 + p[1] * -0.74 > 0;
  g.poly([l, sl, tip, b0], M.CRYS, (litLeft ? 5 : 3) + up, z);
  g.poly([b0, tip, sr, r], M.CRYS, (litLeft ? 3 : 5) + up, z);
}

// ------------------------------------------------------------------ hand stamps

const CLAW_KEY: Record<string, number> = { w: PAL.white, '0': HIDE[0], '6': HIDE[6], '5': HIDE[5], '4': HIDE[4], '3': HIDE[3], '2': HIDE[2], '1': HIDE[1] };
/** Hind feet, hand-drawn (planted, so they never need another angle): a lit instep, the heel
 *  pad behind, and three toes on the sole row ending in 2-px claws (lit root → bright tip),
 *  parted by 1-px gaps so the outline wraps every claw. Column 6 = the foot centre, last row =
 *  the sole row. The far foot is one tone darker with two toes showing. */
const FOOT_NEAR_MAP = [
  '....3455........',
  '...234565.......',
  '..22345565544...',
  '..123344444455..',
  '...12233344444556',
  '....12_56__56_56',
];
const FOOT_FAR_MAP = [
  '...2344.....',
  '..123454....',
  '..1223344...',
  '...112233445',
  '....1_45_345',
];

/**
 * Forepaw claws, hand-placed: three hooked claws on the front of the palm, each a lit root pixel
 * and a curled tip one pixel further and lower, stacked with a 1-px gap so the outline wraps each
 * claw. The set follows the forearm: in front of the palm for a forward / up-forward hand, over
 * the top of it for a hand thrown up.
 */
const CLAWS_FWD: readonly [number, number, boolean][] = [[3, -2, true], [4, -1, false], [3, 0, true], [4, 1, false], [2, 2, true], [3, 3, false]];
const CLAWS_UP: readonly [number, number, boolean][] = [[-2, -3, true], [-1, -4, false], [0, -3, true], [1, -4, false], [2, -2, true], [3, -3, false]];
function handClaws(c: PixelCanvas, palm: V2, ang: number, far: boolean): void {
  const root = far ? HIDE[4] : HIDE[6];
  const tip = far ? HIDE[2] : HIDE[4];
  const set = ang < -62 ? CLAWS_UP : CLAWS_FWD;
  const o = roundV(palm);
  for (const [dx, dy, isRoot] of set) {
    const x = o[0] + dx;
    const y = o[1] + dy;
    if (c.isOpaque(x, y) && !isRoot) continue;
    c.set(x, y, isRoot ? root : tip);
  }
}

/**
 * Ventral plates of a neck / tail tube: at each fraction of the path a 1-px seam crosses the
 * light belly band from near the tube's axis to its ventral edge, one tone down (only over the
 * lighter hide tones, so the seams never touch the crystal spikes or the shadowed back).
 */
function scutes(c: PixelCanvas, path: readonly V2[], at: readonly number[], w0: number, w1: number): void {
  for (const k of at) {
    const s = samplePath(path, k);
    const ven = mulV(dorsal(s.tan), -1);
    const r = lerp(w0, w1, k) / 2;
    const a = addV(s.p, mulV(ven, r * 0.45));
    const b = addV(s.p, mulV(ven, r + 0.5));
    for (const [x, y] of line4Pixels(a, b)) {
      const cur = c.get(x, y);
      if (cur === null) continue;
      const i = (HIDE as readonly number[]).indexOf(cur);
      if (i >= 3) c.set(x, y, HIDE[i - 1]);
    }
  }
}

// ------------------------------------------------------------------ the dragon

function drawDragon(p: PixelCanvas, P: Pose): void {
  const R = rig(P);
  const { hip, chest, tAng, att, neck0, head } = R;
  const { far: farWing, near: nearWing } = wings(P);
  const lift = P.lift;
  const t = (v: V2) => T(v, lift);
  // airborne: the feet hang toward the hip (the legs fold) instead of standing on the floor
  const hang = (v: V2): V2 => addV(v, mulV(subV(hip, v), P.tuck * 0.32));
  const footFar = hang(FOOT_FAR);
  const ankleFar = hang(ANKLE_FAR);
  const footNear = hang(FOOT_NEAR);
  const ankleNear = hang(ANKLE_NEAR);

  paintWing(p, farWing, true, P);

  // ---------------- far leg / far arm (one tone darker)
  {
    const g = newLayer();
    const j = addV(hip, [8, 0]);
    const knee = ik(j, ankleFar, 10.5, 9.5, -1);
    g.tube([t(j), t(knee)], L(10), L(6.5), M.HIDE_FAR, { z: 0 });
    g.tube([t(knee), t(ankleFar)], L(6), L(4.2), M.HIDE_FAR, { z: 1 });
    g.tube([t(ankleFar), t(addV(footFar, [-1, 0]))], L(4.2), L(3.8), M.HIDE_FAR, { z: 2 });
    const c = g.render();
    const f = roundV(t(footFar));
    stampMap(c, FOOT_FAR_MAP, CLAW_KEY, f[0] - 6, Math.round(t(footFar)[1] + L(2)) - FOOT_FAR_MAP.length + 1);
    composite(p, c);
  }
  {
    const g = newLayer();
    const s = att([7, 1]);
    const el = addV(s, polar(72 - P.arm, 7));
    const wa = -35 - P.arm * 1.4;
    const wr = addV(el, polar(wa, 8));
    g.tube([t(s), t(el), t(wr)], L(4.8), L(3.4), M.HIDE_FAR);
    g.ellipsoid(t(addV(wr, polar(wa, 1))), L(2.2), L(1.7), wa * DEG, M.HIDE_FAR, { z: 2 });
    const c = g.render();
    handClaws(c, t(addV(wr, polar(wa, 1))), wa, true);
    composite(p, c);
  }

  // ---------------- tail (+ ridge crystals and the crystal blade)
  {
    const base = [142, 138, 143, 153, 166, 180, 196, 216, 238, 256];
    const pts: V2[] = [addV(hip, rotV([-7, 3], P.lean * 0.4))];
    for (let i = 0; i < base.length; i++) {
      const k = i / (base.length - 1);
      const a = base[i] - P.tailLift * k * k + Math.sin((P.tail - i * 0.07) * Math.PI * 2) * P.tailAmp * (0.3 + k);
      pts.push(addV(pts[i], polar(a, 3.45)));
    }
    const tp = pts.map((q) => t(q));
    const gs = newLayer();
    for (let i = 1; i < tp.length - 2; i += 2) {
      const tan = normV(subV(tp[i + 1], tp[i]));
      const dn = dorsal(tan);
      const k = i / tp.length;
      const r = L(lerp(10, 2.6, k)) / 2;
      shard(gs, addV(tp[i], mulV(dn, r)), addV(dn, mulV(tan, 0.6)), L(lerp(6, 4, k)), L(lerp(2, 1.4, k)), 0, P.glow);
    }
    composite(p, gs.render());
    const g = newLayer();
    g.tube(tp, L(10), L(2.6), M.HIDE, { facets: 4, belly: { from: 0.4, lift: 0.36 } });
    const tip = tp[tp.length - 1];
    const tdir = normV(subV(tip, tp[tp.length - 3]));
    shard(g, subV(tip, tdir), tdir, L(8), L(2.8), 6, P.glow);
    const c = g.render();
    scutes(c, tp, [0.1, 0.22, 0.34, 0.46, 0.58], L(10), L(2.6));
    composite(p, c);
  }

  // ---------------- back crystals + torso
  {
    const gs = newLayer();
    const axis = normV(subV(chest, hip));
    const dn = dorsal(axis);
    const spikes: [number, number, number][] = [
      [1.05, 8, 7],
      [0.74, 9.5, 8.5],
      [0.42, 10, 7],
      [0.1, 9.5, 5],
    ];
    for (const [k, off, l] of spikes) {
      const b = addV(lerpV(hip, chest, k), mulV(dn, off - 1));
      shard(gs, t(b), addV(dn, mulV(axis, -0.6)), L(l), L(l * 0.36), 0, P.glow);
    }
    composite(p, gs.render());
  }
  {
    const g = newLayer();
    g.ellipsoid(t(hip), L(11), L(9.5), tAng * 0.3, M.HIDE, { flat: 1.1, facets: 7 });
    g.ellipsoid(t(chest), L(8.5), L(10), tAng, M.HIDE, { flat: 1.1, facets: 7 });
    g.tube([t(hip), t(chest), t(att([3, -5]))], L(17), L(13), M.HIDE, { flat: 1.1, facets: 4 });
    const c = g.render();
    const onHide = (cur: number) => cur === HIDE[6] || cur === HIDE[5] || cur === HIDE[4];
    paintLine(c, line4Pixels(t(att([-7, 0])), t(att([-3, 8]))), PAL.cyan2, onHide);
    paintLine(c, line4Pixels(t(att([-3, 8])), t(att([1, 10]))), PAL.cyan2, onHide);
    composite(p, c);
  }

  // ---------------- near hind leg
  {
    const g = newLayer();
    const j = addV(hip, [3, 3]);
    const knee = ik(j, ankleNear, 11, 9.5, -1);
    g.tube([t(j), t(knee)], L(13), L(7.5), M.HIDE, { z: 2, flat: 1.2, facets: 3 });
    g.tube([t(knee), t(ankleNear)], L(6.5), L(4.6), M.HIDE, { z: 1, facets: 3 });
    g.tube([t(ankleNear), t(addV(footNear, [-1, 0]))], L(4.6), L(4), M.HIDE, { z: 2 });
    const c = g.render();
    const ax = normV(subV(knee, j));
    const pr: V2 = [-ax[1], ax[0]];
    paintLine(c, line4Pixels(t(addV(lerpV(j, knee, 0.05), mulV(pr, -2.5))), t(addV(lerpV(j, knee, 0.62), mulV(pr, -0.5)))), PAL.cyan2, (cur) => cur === HIDE[6] || cur === HIDE[5] || cur === HIDE[4]);
    const f = roundV(t(footNear));
    stampMap(c, FOOT_NEAR_MAP, CLAW_KEY, f[0] - 6, Math.round(t(footNear)[1] + L(2)) - FOOT_NEAR_MAP.length + 1);
    composite(p, c);
  }

  // ---------------- neck (+ crystal crest)
  const hm = headMap(P);
  const neckPath = bezier(
    t(neck0),
    t(addV(addV(neck0, rotV([-3, -12], P.lean * 0.6)), [P.coil * 1.2, P.coil * 0.3])),
    t(addV(addV(head, mulV(hm.neckDir, 9)), [-P.coil * 1.4, P.coil * 0.5])),
    t(head),
    18,
  );
  {
    const gs = newLayer();
    for (const k of [0.3, 0.45, 0.6, 0.74, 0.87]) {
      const s = samplePath(neckPath, k);
      const dn = dorsal(s.tan);
      const r = L(lerp(10, 7, k)) / 2;
      shard(gs, addV(s.p, mulV(dn, r - 0.5)), addV(dn, mulV(s.tan, -0.55)), L(lerp(8, 5, k)), L(lerp(2.4, 1.7, k)), 0, P.glow);
    }
    composite(p, gs.render());
    const g = newLayer();
    g.tube(neckPath, L(10.5), L(7), M.HIDE, { facets: 4, belly: { from: 0.38, lift: 0.5 } });
    const c = g.render();
    scutes(c, neckPath, [0.12, 0.27, 0.42, 0.57, 0.72], L(10.5), L(7));
    composite(p, c);
  }

  // ---------------- head
  drawHead(p, hm, roundV(t(head)), P);

  // ---------------- near arm
  {
    const g = newLayer();
    const s = att([2, 3]);
    const el = addV(s, polar(68 - P.arm, 7.5));
    const wa = -30 - P.arm * 1.4;
    const wr = addV(el, polar(wa, 9));
    g.ellipsoid(t(addV(s, [0.5, 1])), L(3), L(2.7), 0, M.HIDE, { z: 1, bias: -0.12, facets: 5 });
    g.tube([t(s), t(el), t(wr)], L(5.8), L(4.2), M.HIDE);
    g.ellipsoid(t(addV(wr, polar(wa, 1))), L(2.6), L(2), wa * DEG, M.HIDE, { z: 2, bias: 0.4 });
    const c = g.render();
    handClaws(c, t(addV(wr, polar(wa, 1))), wa, false);
    composite(p, c);
  }

  // ---------------- near wing (in front)
  paintWing(p, nearWing, false, P);

  // ---------------- crystal twinkles
  if (P.sparkles.length) {
    const anchors: V2[] = [
      lerpV(nearWing.Wr, nearWing.tips[0], 0.62),
      lerpV(nearWing.E, nearWing.attach, 0.45),
      lerpV(farWing.Wr, farWing.tips[1], 0.6),
      lerpV(nearWing.Wr, nearWing.tips[1], 0.55),
      addV(hip, [-15, 7]),
    ];
    for (const [ai, size] of P.sparkles) twinkle(p, roundV(t(anchors[ai])), size);
  }

  // flat ground contact: nothing reaches below the sole row
  const ground = Math.round(GY + lift);
  for (let y = ground + 1; y < H; y++) for (let x = 0; x < W; x++) p.erase(x, y);
  rimLight(p, RIM, ground);
  selectiveOutline(p, ground + 1, INK);
}

// ------------------------------------------------------------------ head

function headMap(P: Pose): HeadMap {
  return HEADS[P.head];
}

const MOUTH_DARK = new Set<number>(C_MOUTH);

function drawHead(p: PixelCanvas, h: HeadMap, pivot: V2, P: Pose): void {
  const ox = pivot[0] - h.socket[0];
  const oy = pivot[1] - h.socket[1];
  const c = new PixelCanvas(W, H);
  stampMap(c, h.skull, HEAD_KEY, ox, oy);
  stampMap(c, EYES[P.eyes], HEAD_KEY, ox + h.eyeBox[0], oy + h.eyeBox[1], c);
  const m: V2 = [ox + h.mouth[0], oy + h.mouth[1]];
  if (P.mouthLight >= 1 && h !== HEAD_SIDE && h !== HEAD_GRIT) {
    // prism light welling up in the open jaws: white core, cyan rings, only over the mouth itself
    const big = P.mouthLight >= 2;
    const r = big ? [1.6, 2.8, 4.1, 5.6] : [1.2, 2.3, 3.4, 4.8];
    for (let y = m[1] - 7; y <= m[1] + 7; y++)
      for (let x = m[0] - 9; x <= m[0] + 3; x++) {
        const cur = c.get(x, y);
        if (cur === null || !MOUTH_DARK.has(cur)) continue;
        const d = Math.hypot(x - m[0], y - m[1]);
        const col = d < r[0] ? PAL.white : d < r[1] ? PAL.cyan4 : d < r[2] ? PAL.cyan3 : d < r[3] ? PAL.cyan2 : null;
        if (col !== null) c.set(x, y, col);
      }
  } else if (P.mouthLight > 0.3) {
    // charged lips: a thread of light leaks out along the front of the closed mouth line
    for (let y = m[1] - 2; y <= m[1] + 1; y++)
      for (let x = m[0] - 16; x <= m[0]; x++)
        if (c.get(x, y) === C_INK.navy) c.set(x, y, x > m[0] - 7 && P.mouthLight > 0.6 ? PAL.cyan4 : PAL.cyan3);
  }
  composite(p, c, 1, 2);
}

/** 4-point star glint drawn only over the body (never spills past the silhouette). */
function twinkle(p: PixelCanvas, at: V2, size: number): void {
  const put = (dx: number, dy: number, col: number) => {
    const x = at[0] + dx;
    const y = at[1] + dy;
    if (p.isOpaque(x, y)) p.set(x, y, col);
  };
  put(0, 0, PAL.white);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    put(dx, dy, size >= 2 ? PAL.white : PAL.cyan4);
    if (size >= 2) put(dx * 2, dy * 2, PAL.cyan4);
  }
}

// ------------------------------------------------------------------ wing

function distSeg(q: V2, a: V2, b: V2): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const k = clamp(((q[0] - a[0]) * abx + (q[1] - a[1]) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(q[0] - a[0] - abx * k, q[1] - a[1] - aby * k);
}

function distPoly(q: V2, pts: readonly V2[]): number {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distSeg(q, pts[i - 1], pts[i]));
  return d;
}

/**
 * Crystal wing: every membrane panel between two finger struts is cut into a bright leading facet
 * and a deeper trailing facet (the outer panel is the brightest glass), the trailing edge carries
 * one continuous bright rim line, veins run from the wrist into each pleat, the finger struts are
 * two-tone spars, the arm bones are hide with knuckled joints and a crystal spur at the elbow.
 */
function paintWing(p: PixelCanvas, wr0: WingRig, far: boolean, P: Pose): void {
  const lift = P.lift;
  const t = (v: V2) => T(v, lift);
  const S = t(wr0.S);
  const E = t(wr0.E);
  const Wr = t(wr0.Wr);
  const tips = wr0.tips.map((q) => t(q));
  const attach = t(wr0.attach);
  const g = newLayer();
  const glass = far ? M.GLASS_FAR : M.GLASS;
  const hide = far ? M.HIDE_FAR : M.HIDE;
  const n = tips.length;
  const shield = P.guard && !far;
  const levels: [number, number][] = shield ? [[3, 2], [3, 2], [3, 2]] : [[5, 4], [5, 3], [4, 3]];
  const valleys: V2[] = [];
  const curves: V2[][] = [];
  // the glint: a 2-px diagonal band sweeping across the glass (lifts the glass one tone)
  const gx = lerp(-30, 200, P.glint);
  const glintAt = (x: number, y: number) => (P.glint >= 0 && x + y - gx >= 0 && x + y - gx < 2 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = tips[i];
    const inner = i + 1 >= n;
    const b = inner ? attach : tips[i + 1];
    const hub = inner ? lerpV(Wr, E, 0.5) : Wr;
    const curve = bezier(a, lerpV(lerpV(a, b, 0.5), hub, inner ? 0.42 : 0.62), b, b, 10);
    valleys.push(curve[5]);
    curves.push(curve);
    const [lead, trail] = levels[Math.min(i, levels.length - 1)];
    // a cut-glass panel: the glass along the leading strut catches the light (+1), the glass near
    // the wrist root sits deeper (−1)
    const tone = (base: number, strut: boolean) => (x: number, y: number) => {
      const q: V2 = [x + 0.5, y + 0.5];
      let v = base;
      if (strut && distSeg(q, Wr, a) < 2.1) v += 1;
      if (lenV(subV(q, Wr)) < L(4.2)) v -= 1;
      return v + glintAt(x, y) + P.flash;
    };
    g.poly([Wr, ...curve.slice(0, 6)], glass, tone(lead, true), 0);
    if (!inner) g.poly([Wr, ...curve.slice(5)], glass, tone(trail, false), 0);
    else {
      // the broad arm membrane: a second facet behind the elbow vein, a step deeper toward the body
      const root = lerpV(E, Wr, 0.3);
      const vEnd = curve[7];
      const deep = (x: number, y: number) => {
        const cr = (vEnd[0] - root[0]) * (y + 0.5 - root[1]) - (vEnd[1] - root[1]) * (x + 0.5 - root[0]);
        return tone(trail, false)(x, y) - (cr > 0 ? 1 : 0);
      };
      g.poly([Wr, ...curve.slice(5), S, E], glass, deep, 0);
    }
  }
  g.tube([S, E, Wr], L(4.8), L(3.6), hide, { z: 4, flat: 1.2 });
  g.ellipsoid(Wr, L(2.5), L(2.5), 0, hide, { z: 5 });
  g.ellipsoid(E, L(2.7), L(2.7), 0, hide, { z: 5 });
  const out = normV(addV(normV(subV(E, S)), normV(subV(E, Wr))));
  if (!far) shard(g, E, out, L(6), L(1.8), 7, P.glow);
  const c = g.render();

  // trailing-edge rim
  const rim = far || shield ? PAL.cyan3 : PAL.white;
  const glassCols = new Set<number>(GLASS);
  const hits: V2[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (col === null || !glassCols.has(col)) continue;
      if (c.isOpaque(x - 1, y) && c.isOpaque(x + 1, y) && c.isOpaque(x, y - 1) && c.isOpaque(x, y + 1)) continue;
      const q: V2 = [x + 0.5, y + 0.5];
      if (curves.some((cv) => distPoly(q, cv) < 1.6)) hits.push([x, y]);
    }
  for (const [x, y] of hits) c.set(x, y, rim);

  // veins from the wrist down every pleat valley
  const vein = far ? PAL.cyan3 : P.glow > 0.75 ? PAL.white : PAL.cyan4;
  const onGlass = (cur: number) => glassCols.has(cur) && cur !== rim;
  if (!shield) for (let i = 0; i < n; i++) paintLine(c, linePixels(lerpV(Wr, valleys[i], 0.25), lerpV(Wr, valleys[i], 0.8)), vein, onGlass);
  if (!shield) {
    // the broad arm membrane gets one more vein fanning from the elbow
    const root = lerpV(E, Wr, 0.3);
    const inner = curves[n - 1];
    paintLine(c, linePixels(lerpV(root, inner[7], 0.15), lerpV(root, inner[7], 0.8)), vein, onGlass);
  }

  // finger struts: two-tone spar thinning to one bright line
  const boneHi = far ? HIDE[4] : HIDE[6];
  const boneLo = far ? HIDE[2] : HIDE[4];
  for (let i = 0; i < n; i++) {
    const tp = tips[i];
    if (shield) {
      // folded into the cocoon the struts are plain 1-px ribs that stay inside the glass
      paintLine(c, linePixels(lerpV(Wr, tp, 0.2), lerpV(Wr, tp, 0.86)), i === 0 ? HIDE[6] : HIDE[4]);
      continue;
    }
    const dir = normV(subV(tp, Wr));
    const side: V2 = Math.abs(dir[0]) > Math.abs(dir[1]) ? [0, 1] : [dir[1] > 0 ? -1 : 1, 0];
    const mid = lerpV(Wr, tp, 0.55);
    const a = floorV(Wr);
    const b = floorV(mid);
    const e = floorV(tp);
    for (const [x, y] of linePixels(a, b)) c.set(x, y, boneHi);
    for (const [x, y] of linePixels(addV(a, side), addV(b, side))) c.set(x, y, boneLo);
    for (const [x, y] of linePixels(b, e)) c.set(x, y, i === 0 ? boneHi : boneLo);
  }
  composite(p, c, 1, 2);
}

// ------------------------------------------------------------------ animations

interface AnimDef {
  keys: PoseKey[];
  durations: number[];
  loop: boolean;
  marks?: Record<string, number>;
}

/** frame px → original units (so 1-px offsets stay whole pixels after T) */
const px = (n: number) => n / K;

// wings flung wide (roar): the far wing turns toward the viewer behind the neck and reads bigger
const FW_SPREAD: Partial<Wing> = { a1: -40, a2: -14, a3: -56, fan: 33, span: 1.3, at: [7, 3] };
const NW_SPREAD: Partial<Wing> = { a1: -120, a2: -144, a3: -110, fan: -46, span: 1.05 };
// the summon cocoon: both wings wrapped forward around the curled body
const COCOON: PoseKey = {
  guard: true, hy: 3, lean: 0.16, headX: -6, headY: 17, coil: 2, eyes: 'closed',
  nw: { a1: -64, a2: 40, a3: 76, fan: 21 }, fw: { a1: -50, a2: 60, a3: 85, fan: 15 },
  tailLift: -14, tailAmp: 2, arm: 24, glow: 0.8, tuck: 1,
};

// idle: breathing (the hip rises a pixel on the in-breath, the torso leans back a hair), the head
// follows a frame late, the wings lag the breath (shoulder, then forearm, then fingers, the far
// wing a frame behind the near one), the tail sways on its own slower phase, a glint travels
// across the near wing's glass and twinkles at the tip, and one blink.
const I_HY = [0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0];
const I_LEAN = [0, 0, -0.012, -0.022, -0.022, -0.018, -0.008, 0, 0.008, 0.01, 0.01, 0.008, 0.004, 0];
const I_HEAD = [0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0];
const I_WING = [0, -1, -2.5, -4, -4.5, -4, -2.5, -0.5, 1.5, 2.5, 3, 2.5, 1.5, 0.5];
const I_EYES: EyeKind[] = ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'half', 'closed', 'half', 'open'];
const I_GLINT = [-1, -1, -1, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, -1, -1, -1, -1, -1];
const I_SPARK: [number, number][][] = [[], [], [], [], [], [], [], [[0, 1]], [[0, 2]], [[0, 1]], [], [], [[4, 1]], []];
const lag = (arr: readonly number[], f: number, k: number) => arr[(f - k + arr.length * 4) % arr.length];

function idleKey(f: number): PoseKey {
  const n = I_HY.length;
  return {
    hy: px(I_HY[f]),
    lean: I_LEAN[f],
    headY: px(I_HEAD[f]),
    eyes: I_EYES[f],
    nw: { a1: NEUTRAL.nw.a1 + lag(I_WING, f, 0), a2: NEUTRAL.nw.a2 + lag(I_WING, f, 1), a3: NEUTRAL.nw.a3 + lag(I_WING, f, 2) },
    fw: { a1: NEUTRAL.fw.a1 + lag(I_WING, f, 1), a2: NEUTRAL.fw.a2 + lag(I_WING, f, 2), a3: NEUTRAL.fw.a3 + lag(I_WING, f, 3) },
    tail: f / n,
    glow: 0.3 + 0.18 * Math.sin(((f - 3) / n) * Math.PI * 2),
    glint: I_GLINT[f],
    sparkles: I_SPARK[f],
  };
}

const DEFS: Record<DragonAnim, AnimDef> = {
  idle: {
    loop: true,
    durations: [150, 120, 120, 130, 140, 170, 140, 120, 120, 120, 60, 80, 60, 150],
    keys: I_HY.map((_, f) => idleKey(f)),
  },

  // hit: the bolt lands on frame 1 — the head and neck snap back with a grimace and squeezed eyes,
  // the torso rears back and the hip sinks (knees bend: the body compresses), the wings flinch in
  // toward the body, the tail kicks up; f2 the follow-through drives the weight down; from f3 it
  // recovers, overshoots forward (f4), shakes its head (f6/f7) and settles. Feet never move.
  hit: {
    loop: false,
    marks: { impact: 1, recover: 3 },
    durations: [50, 170, 110, 90, 90, 110, 70, 70, 140],
    keys: [
      { eyes: 'half', headX: px(-1) },
      { hx: -3, hy: 1.5, lean: -0.24, headX: -9, headY: -3, head: 'grit', eyes: 'squeeze', nw: { a1: -92, a2: -114, a3: -118, fan: -28 }, fw: { a1: -98, a2: -124, fan: -20 }, tailLift: 6, arm: 30, glow: 0.05 },
      { hx: -4, hy: 2.5, lean: -0.12, headX: -6, headY: 2, head: 'grit', eyes: 'squeeze', nw: { a1: -100, a2: -126, a3: -114, fan: -35 }, fw: { a1: -92, fan: -24 }, tailLift: -2, arm: 14, glow: 0.15, tail: 0.2 },
      { hx: -2, hy: 1, lean: -0.03, headX: -1, headY: 1, eyes: 'half', nw: { a1: -104, a2: -133 }, fw: { a1: -86 }, glow: 0.25, tail: 0.35, arm: 6 },
      { hx: 1, lean: 0.05, headX: 2, eyes: 'open', nw: { a1: -112, a2: -142, a3: -120 }, fw: { a1: -88, a2: -113 }, glow: 0.3, tail: 0.45, arm: -4 },
      { hx: px(1), lean: 0.02, headX: 1, nw: { a1: -110, a2: -140 }, fw: { a1: -85 }, tail: 0.55, arm: -1 },
      { headX: px(-1), eyes: 'closed', nw: { a1: -107 }, tail: 0.65 },
      { headX: px(1), eyes: 'half', nw: { a1: -109 }, tail: 0.8 },
      {},
    ],
  },

  // attack "Prizma Nefesi": the weight goes back, the neck coils (head pulled back and down)
  // while the crystals light up and prism light leaks between the lips (held 250 ms); a whip
  // in-between with the jaws parting; the neck stretches forward and UP toward the wizard, jaws
  // wide (fire..fireEnd: the throat light swells / ebbs, the head kicks back a pixel, the wings
  // flare and sweep), the jaws close, the body settles back into the idle pose.
  attack: {
    loop: false,
    marks: { fire: 5, fireEnd: 8 },
    durations: [110, 120, 250, 60, 70, 130, 130, 130, 120, 90, 100, 110, 160],
    keys: [
      { hx: -1, lean: -0.05, headX: -3, headY: 1, eyes: 'fierce', nw: { a1: -112, a2: -143 }, fw: { a1: -88 }, glow: 0.45, tailLift: 3, arm: 6 },
      { hx: -2, hy: 1, lean: -0.12, headX: -8, headY: 3, coil: 3, eyes: 'fierce', mouthLight: 0.45, nw: { a1: -118, a2: -150, a3: -110, fan: -46 }, fw: { a1: -92, a2: -118 }, glow: 0.7, tailLift: 8, arm: 14, sparkles: [[3, 1]] },
      { hx: -3, hy: 1.5, lean: -0.2, headX: -12, headY: 4, coil: 5, eyes: 'fierce', mouthLight: 0.8, nw: { a1: -124, a2: -156, a3: -103, fan: -52 }, fw: { a1: -96, a2: -122, a3: -86 }, glow: 1, tailLift: 11, arm: 24, sparkles: [[0, 2], [2, 1]] },
      { hx: -1, hy: 0.5, lean: -0.02, headX: -2, headY: -3, head: 'open', eyes: 'fierce', mouthLight: 1, nw: { a1: -128, a2: -162, a3: -108, fan: -48 }, fw: { a1: -100, a2: -126 }, glow: 1, tailLift: 4, arm: 6 },
      { hx: 1, hy: 0.5, lean: 0.1, headX: 6, headY: -6, head: 'breath', eyes: 'fierce', mouthLight: 1, nw: { a1: -132, a2: -167, a3: -112, fan: -46 }, fw: { a1: -104, a2: -130, a3: -84, fan: -34 }, glow: 1, tailLift: -4, tail: 0.15, tailAmp: 6, arm: -12 },
      { hx: 1, hy: 1, lean: 0.12, headX: 8, headY: -7, head: 'breath', eyes: 'fierce', mouthLight: 2, nw: { a1: -126, a2: -158, a3: -100, fan: -52 }, fw: { a1: -100, a2: -126, a3: -82, fan: -34 }, glow: 1, tailLift: -6, tail: 0.2, tailAmp: 6, arm: -14 },
      { hx: 1, hy: 1, lean: 0.1, headX: 7, headY: -6, head: 'breath', eyes: 'fierce', mouthLight: 1, nw: { a1: -122, a2: -154, a3: -98, fan: -54 }, fw: { a1: -98, a2: -124, a3: -82, fan: -36 }, glow: 1, tailLift: -2, tail: 0.32, tailAmp: 5, arm: -10 },
      { hx: 1, hy: 1, lean: 0.11, headX: 8, headY: -7, head: 'breath', eyes: 'fierce', mouthLight: 2, nw: { a1: -124, a2: -156, a3: -100, fan: -53 }, fw: { a1: -99, a2: -125, a3: -82, fan: -35 }, glow: 1, tailLift: -4, tail: 0.45, tailAmp: 5, arm: -12 },
      { hx: 0.5, hy: 0.5, lean: 0.07, headX: 5, headY: -4, head: 'open', eyes: 'fierce', mouthLight: 1, nw: { a1: -116, a2: -148 }, fw: { a1: -92, a2: -118 }, glow: 0.7, tail: 0.6, arm: -6 },
      { lean: 0.03, headX: 2, headY: -1, nw: { a1: -110, a2: -140 }, fw: { a1: -86 }, glow: 0.5, tail: 0.7, arm: -2 },
      { lean: -0.01, headX: -1, headY: 1, nw: { a1: -106 }, glow: 0.4, tail: 0.8 },
      { headX: px(-1), glow: 0.35, tail: 0.9 },
      {},
    ],
  },

  // summon: it appears high above its tile wrapped in its folded crystal wings (a glowing cocoon
  // that sinks), the cocoon cracks and the wings are flung open with a glass flash sweeping the
  // panels, it drops with the wings raised and the legs unfolding, LANDS (f10: the hip sinks, the
  // knees fold, the wings slam down, eyes shut), rebounds, roars with the wings spread wide and a
  // trembling body, and settles into the idle pose (the far wing folds back through an in-between).
  summon: {
    loop: false,
    marks: { land: 10 },
    durations: [70, 70, 130, 70, 85, 80, 70, 60, 60, 60, 120, 100, 90, 80, 80, 80, 80, 160],
    keys: [
      { ...COCOON, lift: -34 },
      { ...COCOON, lift: -30 },
      { ...COCOON, lift: -27, glow: 1, sparkles: [[1, 2]] },
      { lift: -23, hy: 2, lean: 0.06, headX: -4, headY: 9, coil: 2, eyes: 'closed', nw: { a1: -72, a2: -98, a3: -148, fan: -14, span: 0.95 }, fw: { a1: -62, a2: -88, a3: -122, fan: -12, span: 0.9 }, tailLift: -8, tailAmp: 2, arm: 20, tuck: 0.9, glow: 1, glint: 0.42, sparkles: [[0, 2]] },
      { lift: -19, lean: -0.2, headX: -4, headY: 2, eyes: 'open', flash: 2, nw: { a1: -124, a2: -150, a3: -112, fan: -48, span: 1.05 }, fw: FW_SPREAD, tailLift: 6, arm: 30, tuck: 0.7, glow: 1, glint: 0.55, sparkles: [[0, 2], [2, 2]] },
      { lift: -14, lean: -0.25, headX: -5, headY: 1, eyes: 'open', flash: 1, nw: { a1: -128, a2: -154, a3: -110, fan: -50, span: 1.05 }, fw: FW_SPREAD, tailLift: 8, arm: 34, tuck: 0.5, glow: 0.9, glint: 0.68, sparkles: [[1, 2], [3, 1]] },
      { lift: -10, lean: -0.15, headX: -3, headY: 1, nw: { a1: -130, a2: -160, a3: -116 }, fw: { a1: -76, a2: -60, a3: -70, fan: 6, span: 1.15, at: [4, 1] }, tailLift: 6, arm: 20, tuck: 0.35, glow: 0.8 },
      { lift: -6, lean: -0.08, headX: -2, nw: { a1: -126, a2: -152, a3: -114 }, fw: { a1: -96, a2: -118 }, tailLift: 3, arm: 10, tuck: 0.2, glow: 0.7 },
      { lift: -3, lean: -0.02, headX: -1, nw: { a1: -112, a2: -138, a3: -122 }, fw: { a1: -88 }, arm: 4, tuck: 0.08, glow: 0.6 },
      { lift: -1, lean: 0.03, nw: { a1: -100, a2: -128, a3: -126, fan: -34 }, fw: { a1: -80, a2: -106 }, arm: -2, glow: 0.6 },
      { hx: 0.5, hy: 3, lean: 0.12, headX: 1, headY: 5, eyes: 'closed', nw: { a1: -92, a2: -118, a3: -128, fan: -30 }, fw: { a1: -76, a2: -104, a3: -96, fan: -22 }, tailLift: -6, arm: -8, glow: 0.7 },
      { hy: -1, lean: -0.06, headX: -1, headY: -2, eyes: 'open', nw: { a1: -112, a2: -142 }, fw: { a1: -86 }, tailLift: 4, arm: 8, glow: 0.5 },
      { hy: 1, lean: 0.04, headY: 3, eyes: 'fierce', nw: { a1: -104, a2: -130 }, fw: { a1: -82 }, glow: 0.6, arm: 2 },
      { hy: -1, lean: -0.3, headX: -5, head: 'roar', eyes: 'fierce', nw: NW_SPREAD, fw: FW_SPREAD, tailLift: 10, arm: 40, glow: 1, sparkles: [[0, 2]] },
      { hx: 0.8, hy: -1, lean: -0.28, headX: -4, head: 'roar', eyes: 'fierce', nw: { ...NW_SPREAD, a1: -117 }, fw: { ...FW_SPREAD, a1: -37 }, tailLift: 9, arm: 36, glow: 1, tail: 0.2, sparkles: [[3, 2]] },
      { hx: -0.8, hy: -1, lean: -0.29, headX: -5, head: 'roar', eyes: 'fierce', nw: NW_SPREAD, fw: FW_SPREAD, tailLift: 10, arm: 38, glow: 0.9, tail: 0.4, sparkles: [[2, 1]] },
      { lean: -0.1, headX: -1, head: 'open', nw: { a1: -112, a2: -141 }, fw: { a1: -70, a2: -70, a3: -56, fan: -22, span: 1.08, at: [1, -2] }, tailLift: 4, arm: 12, glow: 0.5, tail: 0.6 },
      {},
    ],
  },

  // victory: a crouch (anticipation) → it rears up on its hind legs, wings flung wide, the head
  // thrown back in a roar (the body trembles, crystals twinkle) → one big wing beat → it settles
  // down from the rear-up into a proud chest-out pose held for half a second → eases into idle.
  victory: {
    loop: false,
    durations: [100, 80, 100, 80, 110, 100, 140, 110, 110, 520, 120, 110, 140],
    keys: [
      { hy: 2, lean: 0.07, headY: 4, eyes: 'fierce', nw: { a1: -100, a2: -122, a3: -128, fan: -26 }, fw: { a1: -92, a2: -116, a3: -100, fan: -20 }, tailLift: -5, arm: -6, glow: 0.4 },
      { hy: 3, lean: 0.12, headX: -1, headY: 7, eyes: 'closed', nw: { a1: -96, a2: -118, a3: -132, fan: -22 }, fw: { a1: -94, a2: -118, a3: -104, fan: -18 }, tailLift: -8, arm: -12, glow: 0.55 },
      { hy: -2, lean: -0.47, headX: -7, headY: 3, head: 'roar', eyes: 'fierce', nw: { ...NW_SPREAD, a1: -124, fan: -49 }, fw: { ...FW_SPREAD, a1: -44 }, tailLift: 16, arm: 62, glow: 1, tail: 0.1, sparkles: [[0, 2], [2, 1]] },
      { hx: 1, hy: -1, lean: -0.42, headX: -6, headY: 2, head: 'roar', eyes: 'fierce', nw: NW_SPREAD, fw: FW_SPREAD, tailLift: 13, arm: 55, glow: 1, tail: 0.25, sparkles: [[0, 1], [1, 2]] },
      { hx: -1, hy: -1, lean: -0.43, headX: -7, headY: 2, head: 'roar', eyes: 'fierce', nw: { ...NW_SPREAD, a1: -118 }, fw: { ...FW_SPREAD, a1: -38 }, tailLift: 14, arm: 58, glow: 0.8, tail: 0.4, sparkles: [[1, 1], [3, 2]] },
      { hx: 1, hy: -1, lean: -0.42, headX: -6, headY: 2, head: 'roar', eyes: 'fierce', nw: NW_SPREAD, fw: FW_SPREAD, tailLift: 13, arm: 55, glow: 1, tail: 0.55, sparkles: [[3, 1], [2, 2]] },
      { lean: -0.36, headX: -5, headY: 2, head: 'roar', eyes: 'fierce', nw: { a1: -102, a2: -126, a3: -128, fan: -32 }, fw: { a1: -60, a2: -40, a3: -80, fan: 20, span: 1.2, at: [6, 2] }, tailLift: 11, arm: 45, glow: 0.8, tail: 0.7 },
      { lean: -0.34, headX: -5, headY: 2, head: 'open', eyes: 'fierce', nw: NW_SPREAD, fw: FW_SPREAD, tailLift: 12, arm: 48, glow: 0.9, tail: 0.8, sparkles: [[0, 2]] },
      { lean: -0.18, headX: -2, eyes: 'open', nw: { a1: -116, a2: -142, a3: -112, fan: -44 }, fw: { a1: -72, a2: -80, a3: -74, fan: -18, span: 1.06, at: [1, -2] }, tailLift: 6, arm: 22, glow: 0.6, tail: 0.9 },
      { lean: -0.1, headX: -1, headY: -2, eyes: 'open', nw: { a1: -114, a2: -141, a3: -114, fan: -42 }, fw: { a1: -86, a2: -110, a3: -92, fan: -28 }, tailLift: 4, arm: 12, glow: 0.5, sparkles: [[0, 1]] },
      { lean: -0.05, headY: -1, nw: { a1: -110, a2: -139 }, fw: { a1: -82, a2: -106 }, tailLift: 2, arm: 6, glow: 0.4 },
      { lean: -0.02, nw: { a1: -108 }, arm: 2, glow: 0.35 },
      {},
    ],
  },
};

const ORDER: DragonAnim[] = ['summon', 'idle', 'hit', 'attack', 'victory'];
const ANIMS = Object.fromEntries(
  ORDER.map((a) => [a, { durations: DEFS[a].durations, loop: DEFS[a].loop, ...(DEFS[a].marks ? { marks: DEFS[a].marks } : {}) }]),
) as Record<DragonAnim, LabAnim>;

function poseOf(anim: DragonAnim, f: number): Pose {
  const keys = DEFS[anim].keys;
  return pose(keys[clamp(Math.floor(f), 0, keys.length - 1)]);
}

const dragon: LabMonsterArt<DragonAnim> = {
  id: 'c_dragon',
  name: 'Kristal Ejder',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY + 2,
  hover: 0,
  anims: ANIMS,
  draw(p: PixelCanvas, anim: DragonAnim, f: number) {
    drawDragon(p, poseOf(anim, f));
  },
  points(anim: DragonAnim, f: number): LabFramePoints {
    const P = poseOf(anim, f);
    const R = rig(P);
    const hm = headMap(P);
    const pv = roundV(T(R.head, P.lift));
    const o: V2 = [pv[0] - hm.socket[0], pv[1] - hm.socket[1]];
    const core = roundV(T(lerpV(R.hip, R.chest, 0.45), P.lift));
    const chest = roundV(T(R.chest, P.lift));
    return {
      core: { x: core[0], y: core[1] },
      muzzle: { x: o[0] + hm.mouth[0], y: o[1] + hm.mouth[1] },
      eye: { x: o[0] + hm.eye[0], y: o[1] + hm.eye[1] },
      head: { x: o[0] + hm.eye[0] - 2, y: o[1] + hm.eye[1] + 2 },
      chest: { x: chest[0], y: chest[1] },
    };
  },
};

export default dragon;

