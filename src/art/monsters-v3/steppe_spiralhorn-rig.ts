// Bozkır Boynuzlusu v3 — the saiga rig: Pose → pixels.
//
// A bespoke QUADRUPED (there is no quadruped plan; ember_wolf is v1 only): "a box on stilts with two corkscrews".
//   - a heavy barrel body (capsule between the hip and the shoulder, so the rear-up pitches it), long thin legs with
//     two-joint IK to the hoof plus a cannon of its own angle (front: elbow behind, hind: stifle forward, hock back),
//     a thick neck with a grass mane (leaf teeth ≥ 2 px that ripple behind the motion), a short leaf tail tuft;
//   - a big saiga head with the drooping, bulbous NOSE (earth1/2, nostril earth0) — the unique profile —, an ear that
//     flicks, a big dark eye with the key light's catchlight;
//   - TWO very tall upright spiral horns (~15 px), waxy earth4/earth3 with earth2 thread dashes and gold3/gold4 tips:
//     rasterised per DISCRETE head angle (the head and the horns are a rigid map per angle: they never rotate by a
//     fraction of a pixel, IŞ-12; anims only use the angles of HEAD_ANGLES);
//   - white / mist flash patches: belly, rump, throat (the brightest coat planes); hooves stone1 / stone2.
// One key light from the screen's top-left: `light` = the frame edge it comes from ('left' P1, 'right' = the P2 relight
// sheet; mirrored by flipX it is top-left again). Planes are measured per light, never mirrored (IŞ-2). Far legs are one
// value darker (HIDE_FAR). Light (catchlight, horn glints, wind curls, grass, seeds) is painted after the outline and
// never outlined (IŞ-9): see steppe_spiralhorn-fx.ts.
// Frame 92×84; 1 art px = 1 game px; the anchor (AX, GY) is the floor point between the hooves.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, run, type Light } from '../rigkit';
import { Comp, bands, clamp, planes, rnd, rt, tube, type Pt, type Tones } from './steppe_spiralhorn-kit';
import { drawFx, deathPasses } from './steppe_spiralhorn-fx';

export const W = 92;
export const H = 84;
export const AX = 42;
export const GY = 81;

export const enum Part {
  none = 0,
  hornF,
  tail,
  legHF,
  legFF,
  body,
  mane,
  neck,
  legHN,
  legFN,
  ear,
  head,
  hornN,
}

/** The only head angles the anims use (degrees, + = nose down): every angle is one rigid head + horn map. */
export const HEAD_ANGLES = { sky: -45, up: -22, level: 0, down: 24, toss: 42, low: 50, drive: 70, pike: 78, ram: 92 } as const;

// ---------------------------------------------------------------- pose

export interface Leg {
  /** hoof target relative to the anchor (px); y 0 = standing on the floor */
  x: number;
  y: number;
  /** cannon angle (deg): 0 = the cannon hangs straight down from the knee / hock; + swings the hoof backward */
  a: number;
}

export interface Pose {
  /** hip and shoulder (barrel ends) relative to the anchor */
  hipX: number;
  hipY: number;
  shX: number;
  shY: number;
  /** breath: the back line rises 1 px */
  br: number;
  /** the poll (head pivot, where the horns grow) relative to the shoulder; head angle (deg, one of HEAD_ANGLES) */
  hdx: number;
  hdy: number;
  ha: number;
  /** the four hooves: front near / far, hind near / far */
  fn: Leg;
  ff: Leg;
  hn: Leg;
  hf: Leg;
  /** ear 0 up-back · 1 flicked · 2 flat back */
  ear: number;
  /** nostril flare 0 / 1 / 2 (snort); nose bulb wobble (px down) */
  sniff: number;
  nose: number;
  /** eye 0 open · 1 half · 2 shut · 3 wide (white rim) */
  blink: number;
  /** mane ripple phase (0…1) and amplitude (px); tail 0 rest · 1 flick up · 2 clamped down · 3 streaming back */
  mane: number;
  maneK: number;
  tail: number;
  /** coat goes rigid (hitMagic): the mane teeth stand straight up, a stiff tail */
  rigid: number;
  /** the honk: the mouth opens under the nose (0 / 1) */
  mouth: number;
  // ---- light / effect fields (steppe_spiralhorn-fx.ts)
  /** horn-tip wind curls: phase 0…1 (−1 none) */
  curl: number;
  /** horn glint: 0 none · 1 tips ring (hitMagic) · 2 the roar's single tip twinkle */
  glint: number;
  /** grass-wake fan at the hooves: phase 0…1 (−1 none), centre x rel. anchor, 1 = take-off fan (bending away), 2 = landing crescent */
  wake: number;
  wakeX: number;
  wakeK: number;
  /** dust ticks at the hoof tips: phase (−1 none) */
  dust: number;
  /** seed burst at the horn tips: phase 0…1 (−1 none) */
  seeds: number;
  /** death: grass front 0…1 (coat → grass from the hooves up), wind 0…1 (the mound blows apart from the windward
   *  side into a curving stream), plume 0…1 (the horns → two long seed plumes that lift away); gather = revive */
  grass: number;
  wind: number;
  plume: number;
  gather: boolean;
  /** death: the horns laid down along the floor (absolute angle of the near horn, deg; 0 = carried by the head) */
  hornLay: number;
  /** death: the far horn's lay angle relative to the near one (deg); the laid horns' bases shifted (px, frame space:
   *  dx back away from the killer, dy down to the floor line) as the mound under them blows away */
  hornLayF: number;
  hornDx: number;
  hornDy: number;
  /** death: the wind presses the windward (front) edge of the grass mound down before it erodes (0…1) */
  press: number;
  /** global phase 0…1 (one-shots wrap it to 0 on their last frame) */
  t: number;
}

export const LEG_FN: Leg = { x: 9, y: 0, a: 0 };
export const LEG_FF: Leg = { x: 13, y: 0, a: 2 };
export const LEG_HN: Leg = { x: -12, y: 0, a: -12 };
export const LEG_HF: Leg = { x: -8, y: 0, a: -10 };

export const NEUTRAL: Pose = {
  hipX: -10,
  hipY: -29,
  shX: 8,
  shY: -30,
  br: 0,
  hdx: 8,
  hdy: -11,
  ha: 0,
  fn: LEG_FN,
  ff: LEG_FF,
  hn: LEG_HN,
  hf: LEG_HF,
  ear: 0,
  sniff: 0,
  nose: 0,
  blink: 0,
  mane: 0,
  maneK: 1,
  tail: 0,
  rigid: 0,
  mouth: 0,
  curl: -1,
  glint: 0,
  wake: -1,
  wakeX: 0,
  wakeK: 1,
  dust: -1,
  seeds: -1,
  grass: 0,
  wind: 0,
  plume: 0,
  gather: false,
  hornLay: 0,
  hornLayF: -26,
  hornDx: 0,
  hornDy: 0,
  press: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- tones

export const COAT: Tones = { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 };
export const COAT_FAR: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
const NOSE: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
const MANE: Tones = { L: PAL.leaf3, M: PAL.leaf2, S: PAL.leaf1, D: PAL.leaf0 };
const CREST: Tones = { L: PAL.leaf2, M: PAL.leaf1, S: PAL.leaf0, D: PAL.leaf0 };
const HOOF: Tones = { L: PAL.stone2, M: PAL.stone1, S: PAL.stone1, D: PAL.stone0 };

// ---------------------------------------------------------------- skeleton

export interface LegSk {
  top: Pt;
  mid: Pt;
  knee: Pt;
  hoof: Pt;
}

export interface Skel {
  H: Pt;
  S: Pt;
  u: Pt;
  v: Pt;
  L: number;
  /** body-local (along the barrel from the hip, across toward the belly) → frame px */
  bl: (a: number, b: number) => Pt;
  poll: Pt;
  ha: number;
  /** head-local → frame px */
  hl: (x: number, y: number) => Pt;
  fn: LegSk;
  ff: LegSk;
  hn: LegSk;
  hf: LegSk;
  hornN: { base: Pt; tip: Pt; ang: number; len: number };
  hornF: { base: Pt; tip: Pt; ang: number; len: number };
  eye: Pt;
  core: Pt;
  nose: Pt;
}

const HORN_N_ANG = -112;
const HORN_F_ANG = -93;
const HORN_N_LEN = 20;
const HORN_F_LEN = 19;

function legSk(top: Pt, hoofT: Leg, l1: number, l2: number, lc: number, bend: number): LegSk {
  const a = (hoofT.a * Math.PI) / 180;
  const hoof0: Pt = [AX + hoofT.x, GY + hoofT.y];
  // cannon top (knee / hock): hoof = knee + lc·(−sin a, cos a)
  let knee: Pt = [hoof0[0] + lc * Math.sin(a), hoof0[1] - lc * Math.cos(a)];
  const dx = knee[0] - top[0];
  const dy = knee[1] - top[1];
  const d = Math.hypot(dx, dy);
  const reach = l1 + l2 - 0.4;
  if (d > reach) knee = [top[0] + (dx / d) * reach, top[1] + (dy / d) * reach];
  const hoof: Pt = [knee[0] - lc * Math.sin(a), knee[1] + lc * Math.cos(a)];
  const mid = ik2(top, knee, l1, l2, bend) as Pt;
  return { top, mid, knee, hoof };
}

export function skeleton(o: Pose): Skel {
  const Hh: Pt = [AX + o.hipX, GY + o.hipY];
  const S: Pt = [AX + o.shX, GY + o.shY];
  const dx = S[0] - Hh[0];
  const dy = S[1] - Hh[1];
  const L = Math.hypot(dx, dy) || 1;
  const u: Pt = [dx / L, dy / L];
  const v: Pt = [-u[1], u[0]];
  const bl = (a: number, b: number): Pt => [Hh[0] + u[0] * a + v[0] * b, Hh[1] + u[1] * a + v[1] * b];
  const poll: Pt = [rnd(S[0] + o.hdx), rnd(S[1] + o.hdy)];
  const ha = o.ha;
  const hl = (x: number, y: number): Pt => rt([x, y], ha, poll[0], poll[1]);
  const fn = legSk(bl(L - 1, 3), o.fn, 8, 11, 8, 1);
  const ff = legSk(bl(L + 1, 3), o.ff, 8, 11, 8, 1);
  const hn = legSk(bl(0, 2), o.hn, 9, 11, 9, -1);
  const hf = legSk(bl(3, 2), o.hf, 9, 11, 9, -1);
  const horn = (bx: number, by: number, len: number, local: number, lay: number) => {
    const b0 = hl(bx, by);
    const base: Pt = o.hornLay !== 0 ? [b0[0] + o.hornDx, b0[1] + o.hornDy] : b0;
    const ang = o.hornLay !== 0 ? o.hornLay + lay : local + ha;
    const r = (ang * Math.PI) / 180;
    return { base, tip: [base[0] + Math.cos(r) * len, base[1] + Math.sin(r) * len] as Pt, ang, len };
  };
  return {
    H: Hh, S, u, v, L, bl, poll, ha, hl, fn, ff, hn, hf,
    hornN: horn(1, -0.5, HORN_N_LEN, HORN_N_ANG, 0),
    hornF: horn(4, 0, HORN_F_LEN, HORN_F_ANG, o.hornLayF),
    eye: hl(4, 3),
    core: bl(L / 2, 0),
    nose: hl(15, 8),
  };
}

// ---------------------------------------------------------------- frame

export interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  /** death / revive: the wind-stream clusters the matter pass erased (read by the light pass) */
  motes: { x: number; y: number; k: number; i: number }[];
}

const layer = () => new PixelCanvas(W, H);

// ---------------------------------------------------------------- parts

function drawLeg(f: Frame, which: 'fn' | 'ff' | 'hn' | 'hf'): void {
  const { sk, light } = f;
  const g = sk[which];
  const near = which === 'fn' || which === 'hn';
  const front = which === 'fn' || which === 'ff';
  const t = near ? COAT : COAT_FAR;
  const part = which === 'fn' ? Part.legFN : which === 'ff' ? Part.legFF : which === 'hn' ? Part.legHN : Part.legHF;
  const q = layer();
  if (front) {
    // shoulder mass (near only) → upper arm → forearm → cannon
    q.poly(tube(g.top, g.mid, 6, 4.5, 0, 0), t.M);
    q.poly(tube(g.mid, g.knee, 4, 3, 0.5, 0.5), t.M);
  } else {
    // ham (near only) → thigh → gaskin → cannon
    q.poly(tube(g.top, g.mid, 7, 5, 1, 0), t.M);
    q.poly(tube(g.mid, g.knee, 4, 3, 0.5, 0.5), t.M);
  }
  q.poly(tube(g.knee, [g.hoof[0], g.hoof[1] - 1.5], 2.6, 2.2, 0, 0), t.M);
  bands(q, t, light, { top: 0, lit: 1, diag: 2, bottom: 0, away: 1 });
  f.comp.add(q, part, near ? { out: PAL.ink, outSkip: [Part.tail, Part.hornF] } : {});
  // hoof: a 3-px block with the toe forward, stone
  const hq = layer();
  const hx = rnd(g.hoof[0]);
  const hy = rnd(g.hoof[1]);
  hq.rect(hx - 1, hy - 2, 3, 1, near ? HOOF.L : HOOF.M).rect(hx - 1, hy - 1, 4, 1, HOOF.M);
  f.comp.add(hq, part, {});
}

/** An ellipse as a polygon: centre c, its own axis angle (rad), radii along / across. */
function ellPts(c: Pt, ang: number, rx: number, ry: number, n = 24): Pt[] {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca] as Pt;
  });
}

/** The barrel's two masses: the haunch (pitches only half as far, bunches when he rears) and the chest (follows the
 *  shoulder), joined by the back and the belly line — so a rear BENDS the body instead of tilting a rigid capsule. */
interface Mass {
  c: Pt;
  ang: number;
  rx: number;
  ry: number;
}
function masses(sk: Skel, br: number): { hq: Mass; ch: Mass } {
  const pitch = Math.atan2(sk.u[1], sk.u[0]);
  const rear = clamp(-pitch / 0.75, 0, 1);
  const hAng = pitch * 0.45;
  const lift = br * 0.5;
  // the haunch: centred a little ahead of the hip; rearing bunches it (shorter, deeper, lower)
  const hc = sk.bl(1.5 - rear * 1.5, 0.5 + rear * 1.5);
  const hq: Mass = { c: [hc[0], hc[1] - lift], ang: hAng, rx: 9 - rear * 1.5, ry: 8 + lift + rear * 1.2 };
  const cc = sk.bl(sk.L - 0.5, 0.5);
  const ch: Mass = { c: [cc[0], cc[1] - lift], ang: pitch, rx: 7.5, ry: 8 + lift };
  return { hq, ch };
}
const massAt = (m: Mass, x: number, y: number): { r: number; nx: number; ny: number } => {
  const dx = x + 0.5 - m.c[0];
  const dy = y + 0.5 - m.c[1];
  const ca = Math.cos(m.ang);
  const sa = Math.sin(m.ang);
  const lx = (dx * ca + dy * sa) / m.rx;
  const ly = (-dx * sa + dy * ca) / m.ry;
  const r = Math.hypot(lx, ly) || 1e-6;
  // outward normal in screen space
  const nlx = lx / m.rx;
  const nly = ly / m.ry;
  const nl = Math.hypot(nlx, nly) || 1;
  return { r, nx: (nlx * ca - nly * sa) / nl, ny: (nlx * sa + nly * ca) / nl };
};

function drawBody(f: Frame): void {
  const { sk, o, light } = f;
  const L = sk.L;
  const { hq, ch } = masses(sk, o.br);
  const q = layer();
  const ca = (m: Mass, lx: number, ly: number): Pt => [m.c[0] + lx * Math.cos(m.ang) - ly * Math.sin(m.ang), m.c[1] + lx * Math.sin(m.ang) + ly * Math.cos(m.ang)];
  q.poly(ellPts(hq.c, hq.ang, hq.rx, hq.ry), COAT.M);
  q.poly(ellPts(ch.c, ch.ang, ch.rx, ch.ry), COAT.M);
  // the back and the belly between them (the belly tucks up 1 px behind the girth: a curve, not a ruler line)
  q.poly([ca(hq, 0, -hq.ry), ca(ch, -1, -ch.ry), ca(ch, -1, ch.ry - 0.5), ca(ch, -5, ch.ry - 0.2), ca(hq, 3, hq.ry - 1.2), ca(hq, 0, hq.ry - 0.5)], COAT.M);
  const ls = light.side;
  const lv: Pt = [light.v2[0], light.v2[1]];
  // the shoulder blade: a slanted lit plate on the upper chest
  const sp: Mass = { c: [ch.c[0] - sk.u[0] * 1 + sk.v[0] * -2, ch.c[1] - sk.u[1] * 1 + sk.v[1] * -2], ang: ch.ang + 1.15, rx: 6.5, ry: 3.6 };
  const dot = (m: { nx: number; ny: number }, a: Pt) => m.nx * a[0] + m.ny * a[1];
  planes(q, (x, y, src) => {
    const up = run(src, x, y, 0, -1, 3);
    const dn = run(src, x, y, 0, 1, 4);
    const tl = run(src, x, y, ls, 0, 3);
    const aw = run(src, x, y, -ls, 0, 3);
    const ax = (x + 0.5 - sk.H[0]) * sk.u[0] + (y + 0.5 - sk.H[1]) * sk.u[1];
    const H = massAt(hq, x, y);
    const C = massAt(ch, x, y);
    const B = massAt(sp, x, y);
    // the flash patches: the white belly (an earth2 flank line over it), the rump
    if (dn < 3 && ax > 3 && ax < L + 1) return dn < 1 ? PAL.mist : ls < 0 && ax < L * 0.45 ? PAL.mist : PAL.white;
    if (ax < -5.5 && dn > 1 && up > 1) return ls < 0 ? PAL.white : PAL.mist;
    if (dn === 3 && ax > 4 && ax < L - 1) return COAT.S;
    // the back line and the lit edge
    if (up < 1 || (up < 2 && tl < 3) || tl < 1) return COAT.L;
    // the haunch's front crease (top-front around to the stifle), its lowest pixels earth1
    if (H.r < 1 && H.r > 0.84 && dot(H, sk.u) > 0.25 && dot(H, sk.v) > -0.75 && C.r > 1 && up > 1 && dn > 0) return dot(H, sk.v) > 0.6 ? COAT.D : COAT.S;
    // the shoulder blade's back edge and the elbow line behind the chest
    if (B.r < 1.12 && B.r > 0.86 && dot(B, sk.u) < -0.2 && up > 1) return COAT.S;
    if (C.r < 1 && C.r > 0.84 && dot(C, sk.u) < -0.45 && dot(C, sk.v) > 0.1 && H.r > 1 && dn > 0) return COAT.S;
    // the lit muscle masses: the round of the haunch, the shoulder blade
    if (H.r < 0.86 && H.r > 0.3 && dot(H, lv) > 0.3) return COAT.L;
    if (B.r < 0.86 && dot(B, lv) > -0.1) return COAT.L;
    // the shade side and the underside
    if (aw < 2 || dn < 2) return COAT.S;
    return COAT.M;
  });
  f.comp.add(q, Part.body, { out: PAL.earth0, outSkip: [Part.tail, Part.legFN, Part.legHN] });
}

/** Cast shadows (after the parts are laid): the barrel darkens the tops of the legs under it, the jaw the throat. */
function castShadow(f: Frame): void {
  const { comp, p } = f;
  const b = p.bounds();
  if (!b) return;
  const legs = [Part.legFN, Part.legFF, Part.legHN, Part.legHF];
  const out: [number, number, number][] = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const part = comp.at(x, y);
      const c = p.get(x, y);
      if (c === null || c === PAL.ink || c === PAL.earth0) continue;
      if (legs.includes(part)) {
        const near = part === Part.legFN || part === Part.legHN;
        const rows = near ? 1 : 2;
        for (let k = 1; k <= rows; k++)
          if (comp.at(x, y - k) === Part.body) {
            out.push([x, y, near ? COAT.D : COAT_FAR.D]);
            break;
          }
      } else if (part === Part.neck && comp.at(x, y - 1) === Part.head && c !== PAL.white && c !== PAL.mist) out.push([x, y, COAT.D]);
    }
  for (const [x, y, c] of out) p.set(x, y, c);
}

function drawTail(f: Frame): void {
  const { sk, o, light } = f;
  const r = sk.bl(-7, -3);
  const shapes: Record<number, Pt[]> = {
    0: [[0, -1], [-2.5, 0], [-4, 3], [-3, 5], [-1, 4], [0, 2]],
    1: [[0, 0], [-2.5, -2], [-5, -3], [-5, -0.5], [-2.5, 1.5], [0, 2.5]],
    2: [[0, -1], [-2, 1], [-2, 4.5], [-0.5, 5.5], [1, 4], [1, 1]],
    3: [[0, 0], [-3, -1.5], [-5.5, -1], [-5, 1], [-2.5, 2.5], [0, 2.5]],
  };
  const s = shapes[o.tail] ?? shapes[0];
  const q = layer();
  q.poly(s.map(([x, y]) => [r[0] + x, r[1] + y] as Pt), MANE.M);
  bands(q, MANE, light, { top: 1, lit: 1, bottom: 1, away: 1 });
  f.comp.add(q, Part.tail, {});
}

function neckLine(sk: Skel): { top: [Pt, Pt]; bot: [Pt, Pt] } {
  return { top: [sk.bl(sk.L - 3, -7.5), sk.hl(-3, 1)], bot: [sk.bl(sk.L + 6, 0), sk.hl(3, 11)] };
}

function drawNeck(f: Frame): void {
  const { sk, light } = f;
  const n = neckLine(sk);
  const q = layer();
  q.poly([n.top[0], n.top[1], sk.hl(-4, 4), sk.hl(0, 10), n.bot[1], n.bot[0], sk.bl(sk.L + 2, -4)], COAT.M);
  bands(q, COAT, light, { top: 2, lit: 3, diag: 3, bottom: 2, away: 2 });
  // throat flash: the underside of the neck
  const ls = light.side;
  const [b0, b1] = n.bot;
  const ex = b1[0] - b0[0];
  const ey = b1[1] - b0[1];
  const el = Math.hypot(ex, ey) || 1;
  planes(q, (x, y) => {
    // distance from the throat edge (toward the inside)
    const d = ((x + 0.5 - b0[0]) * -ey + (y + 0.5 - b0[1]) * ex) / el;
    const tt = ((x + 0.5 - b0[0]) * ex + (y + 0.5 - b0[1]) * ey) / (el * el);
    if (d > -2.2 && d < 0.5 && tt < 0.72) return ls > 0 ? PAL.white : PAL.mist;
    return null;
  });
  f.comp.add(q, Part.neck, { out: PAL.earth1, outSkip: [Part.legFN] });
}

function drawMane(f: Frame): void {
  const { sk, o, light } = f;
  const a = sk.bl(sk.L - 8, -6.5);
  const b = sk.hl(-3, 1.5);
  const q = layer();
  // a crest of grass teeth from the withers up the neck, leaning back, rippling behind the motion (the lag grows
  // toward the withers); 2-px teeth with 1-px gaps, so each tooth reads at 1×
  const N = 5;
  for (let i = 0; i < N; i++) {
    const k = (i + 0.5) / N;
    const x = a[0] + (b[0] - a[0]) * k;
    const y = a[1] + (b[1] - a[1]) * k + 0.5;
    const sway = o.rigid > 0 ? 1 : rnd(Math.sin((o.mane - k * 0.5) * Math.PI * 2) * o.maneK);
    const hgt = 2 + (i % 2) + (i === 2 ? 1 : 0) + (o.rigid > 0 ? 1 : 0);
    q.poly([[x - 0.8, y + 1.5], [x + 1.2, y + 1.5], [x - 0.8 + sway, y - hgt], [x - 2.3 + sway, y - hgt + 0.5]], CREST.M);
  }
  bands(q, CREST, light, { top: 1, lit: 1, bottom: 0, away: 0 });
  f.comp.add(q, Part.mane, {});
}

/** Head polygon in head-local px (poll at the origin, facing right, level). */
const HEAD: Pt[] = [
  [-3, 2], [-2, 0], [1, -1], [5, -0.5], [8, 0.5], [10, 1.5], [12.5, 2.5], [14.5, 4.5], [15.5, 7.5], [15, 10.5], [13.5, 12.5], [11.5, 13],
  [10, 12], [9, 10.5], [8.5, 11.5], [6, 11.5], [2, 10.5], [-2, 7],
];
const EAR: Record<number, Pt[]> = {
  // up-back · flicked (upright) · flat back — a 3–4 px wide leaf ear behind the horn bases, readable at 1×
  0: [[-0.5, 2], [-3, -0.5], [-6, -2.5], [-8, -2.5], [-7, 0.5], [-4, 3.5], [-0.5, 4.5]],
  1: [[-0.5, 2], [-2, -2], [-3.5, -5.5], [-5.5, -5.5], [-5, -1.5], [-3, 3], [-0.5, 4.5]],
  2: [[-0.5, 3], [-4, 2], [-9, 2.5], [-9.5, 4.5], [-4.5, 6], [-0.5, 5.5]],
};
function drawHead(f: Frame): void {
  const { sk, o, light } = f;
  const ha = sk.ha;
  const q = layer();
  q.poly(HEAD.map(([x, y]) => (x > 9 && y > 2 ? sk.hl(x, y + o.nose) : sk.hl(x, y))), COAT.M);
  bands(q, COAT, light, { top: 2, lit: 2, diag: 3, bottom: 2, away: 2 });
  // the nose bulb (head-local x ≥ 10.5): its own darker material; mouth line; jaw flash
  const r = (-ha * Math.PI) / 180;
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const local = (x: number, y: number): Pt => {
    const dx = x + 0.5 - sk.poll[0];
    const dy = y + 0.5 - sk.poll[1];
    return [dx * cr - dy * sr, dx * sr + dy * cr];
  };
  const ls = light.side;
  planes(q, (x, y, src) => {
    const [lx, ly] = local(x, y);
    if (lx >= 9.5 && ly < 13.5 + o.nose) {
      const up = run(src, x, y, 0, -1, 3);
      const tl = run(src, x, y, ls, 0, 3);
      if (up < 2 || tl < 3) return ls > 0 && tl < 3 ? NOSE.L : NOSE.M;
      if (run(src, x, y, 0, 1, 2) < 1 || run(src, x, y, -ls, 0, 2) < 1) return NOSE.D;
      return NOSE.S;
    }
    return null;
  });
  // nostril (flares on a sniff) and the mouth line under the overhang
  const nos = sk.hl(13.5, 11 + o.nose);
  q.set(rnd(nos[0]), rnd(nos[1]), NOSE.D);
  if (o.sniff >= 1) q.set(rnd(nos[0]) - 1, rnd(nos[1]), NOSE.D);
  if (o.sniff >= 2) q.set(rnd(nos[0]), rnd(nos[1]) - 1, NOSE.D);
  const m0 = sk.hl(7.5, 10.5);
  const m1 = sk.hl(9.5, 10.5);
  q.line(rnd(m0[0]), rnd(m0[1]), rnd(m1[0]), rnd(m1[1]), NOSE.D);
  if (o.mouth > 0) {
    // the open mouth: a dark wedge under the drooping nose (the saiga honk)
    for (const [mx, my] of [[8, 11], [9, 11], [10, 11], [8.5, 12], [9.5, 12]] as const) {
      const m = sk.hl(mx, my);
      q.set(rnd(m[0]), rnd(m[1]), PAL.earth0);
    }
  }
  // the eye: ink, 2 px (half-shut 1 row; shut: a lid line); a dark tear streak under it
  const [ex, ey] = [rnd(sk.eye[0]), rnd(sk.eye[1])];
  if (o.blink === 2) q.set(ex, ey + 1, COAT.D).set(ex + 1, ey + 1, COAT.D);
  else {
    q.set(ex, ey + 1, PAL.ink).set(ex + 1, ey + 1, PAL.ink);
    if (o.blink !== 1) q.set(ex, ey, PAL.ink).set(ex + 1, ey, PAL.ink);
    q.set(ex + 1, ey + 2, COAT.S);
  }
  // the ears: the far one peeks out behind the far horn base (laid before the skull), the near one lies over the skull
  // behind the near horn
  const shape = EAR[o.ear] ?? EAR[0];
  const fq = layer();
  fq.poly(shape.map(([x, y]) => sk.hl(x + 3, y - 1.5)), COAT_FAR.M);
  bands(fq, COAT_FAR, light, { top: 1, lit: 0, bottom: 1, away: 1 });
  f.comp.add(fq, Part.ear, { out: PAL.earth0, outSkip: [Part.hornF, Part.neck, Part.mane, Part.head, Part.body] });
  f.comp.add(q, Part.head, { out: PAL.earth0, outSkip: [Part.hornF, Part.ear] });
  const eq = layer();
  eq.poly(shape.map(([x, y]) => sk.hl(x, y)), COAT.M);
  bands(eq, COAT, light, { top: 1, lit: 1, bottom: 1, away: 1 });
  // the inner ear: an earth1 streak along its lower edge
  planes(eq, (x, y, src) => (run(src, x, y, 0, 1, 2) < 1 && run(src, x, y, light.side, 0, 2) >= 1 ? COAT.D : null));
  f.comp.add(eq, Part.ear, { out: PAL.earth0, outSkip: [Part.hornF] });
}

/** One spiral horn rasterised along its axis: ringed keratin — alternating 2-px ridges (earth4) and grooves (earth2),
 *  slanted like a screw thread, the silhouette stepping out on every ridge (a corkscrew zigzag that reads at 1×), a
 *  shade edge away from the key light and a gold tip. */
function drawHorn(f: Frame, h: Skel['hornN'], far: boolean): void {
  const { light } = f;
  const q = layer();
  const r = (h.ang * Math.PI) / 180;
  const dx = Math.cos(r);
  const dy = Math.sin(r);
  const [bx, by] = h.base;
  const P = 4;
  const x0 = Math.floor(Math.min(bx, h.tip[0]) - 4);
  const x1 = Math.ceil(Math.max(bx, h.tip[0]) + 4);
  const y0 = Math.floor(Math.min(by, h.tip[1]) - 4);
  const y1 = Math.ceil(Math.max(by, h.tip[1]) + 4);
  const ridge = new Set<number>();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - bx;
      const py = y + 0.5 - by;
      const s = px * dx + py * dy;
      const n = -px * dy + py * dx;
      if (s < -0.5 || s > h.len) continue;
      const k = clamp(s / h.len, 0, 1);
      const ph = (((s + 0.55 * n) / P) % 1 + 1) % 1;
      const isRidge = ph < 0.5;
      const hw = 2.05 - 1.3 * k + (isRidge && s < h.len - 4 ? 0.45 : 0);
      if (Math.abs(n) > hw) continue;
      if (s > h.len - 2) q.set(x, y, far ? PAL.gold3 : PAL.gold4);
      else if (s > h.len - 4.5) q.set(x, y, far ? PAL.gold2 : PAL.gold3);
      else {
        q.set(x, y, far ? PAL.earth3 : PAL.earth4);
        if (isRidge && s > 0.8) ridge.add(y * W + x);
      }
    }
  const lit = far ? PAL.earth3 : PAL.earth4;
  const groove = far ? PAL.earth1 : PAL.earth2;
  planes(q, (x, y, src) => {
    const c = src.get(x, y);
    if (c !== lit) return null;
    const shade = run(src, x, y, -light.side, 0, 1) < 1;
    if (ridge.has(y * W + x)) return shade ? (far ? PAL.earth2 : PAL.earth3) : null;
    return shade ? (far ? PAL.earth1 : PAL.earth1) : groove;
  });
  f.comp.add(q, far ? Part.hornF : Part.hornN, far ? {} : { out: PAL.earth1, outSkip: [Part.head, Part.ear, Part.neck, Part.mane] });
}

// ---------------------------------------------------------------- draw

export function drawSpiralhorn(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk, motes: [] };

  const horns = o.plume <= 0;
  if (o.wind < 1) {
    if (horns) drawHorn(f, sk.hornF, true);
    drawTail(f);
    drawLeg(f, 'hf');
    drawLeg(f, 'ff');
    drawLeg(f, 'hn');
    drawLeg(f, 'fn');
    drawBody(f);
    drawNeck(f);
    drawMane(f);
    drawHead(f);
    castShadow(f);
    if (horns) drawHorn(f, sk.hornN, false);
  } else if (horns) {
    drawHorn(f, sk.hornF, true);
    drawHorn(f, sk.hornN, false);
  }
  deathPasses(f, 'matter');
  p.outline(PAL.ink);
  deathPasses(f, 'light');
  drawFx(f);
}
