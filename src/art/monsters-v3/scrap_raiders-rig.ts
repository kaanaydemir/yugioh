// Hurda Akıncıları v3 — the scrap cart-tank rig: Pose → pixels.
//
// A WIDE, low war cart hammered together from scrap: a patchwork tub of iron and rust plates (a painted flame on
// the front plate), a big rear wheel and a smaller front wheel (wooden spokes, iron tyres, brass hubs), a coal
// stove on the rear deck with its exhaust pipe, a red flag with a brass gear, and a spiked ram (a wooden beam, a
// rusty bumper plate, three steel spikes) pointing at the enemy. Three goblins are crammed inside:
//   - the SLINGER at the back (leather cap with a feather, a slingshot),
//   - the PEDALLER in the middle (goggles, hands on the handlebar, legs hidden in the tub),
//   - the WRENCH goblin at the front (iron pot helmet, a huge wrench).
//
//   - flat polygons shaded by flat value planes measured from their own edges (kit `bands`), no gradients;
//   - every part moves by WHOLE pixels and never rotates as a sprite; wheels turn by redrawing their spokes,
//     a falling wheel flattens to an ellipse on the floor (it never leaves its x span: HA-9);
//   - one key light from the top-left; `light` = the frame edge it comes from ('right' = the P2 relight sheet);
//   - light (eyes, stove door, fire, sparks, flashes, zaps) is painted after the outline, never outlined (IŞ-9);
//     smoke, sweat, debris and the flying bolt are painted after the outline too (small loose things).
// Frame 104×74; 1 art px = 1 game px; R = (RX, GY) the ground point between the wheels.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, type Light } from '../rigkit';
import { BRASS, CLOTH, Comp, IRON, LEATHER, RUST, SKIN, STEEL, WOOD, bands, boxPoly, hash2, lineIn4, tubePoly, type Pt, type Tones } from './scrap_raiders-kit';

export const W = 104;
export const H = 74;
export const RX = 46;
export const GY = 68;

export const enum Part {
  none = 0,
  flag,
  pipe,
  stove,
  crewS,
  crewP,
  crewW,
  tub,
  ram,
  wheelR,
  wheelF,
  heap,
  ground,
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = Math.round;
const fl = Math.floor;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole cart offset: x travel, y lift (+ up). 0 in idle / guard (HA-9) */
  bx: number;
  by: number;
  /** tub + crew sink on the springs (+ down), nose drop at the ram end (+ down, − = wheelie) */
  bob: number;
  tilt: number;
  /** the deck only (crew, stove, pipe, flag, bar) chugs on the engine beat (+ down) — idle */
  deck: number;
  /** wheel spin phases (turns) */
  wr: number;
  wf: number;
  /** front / rear wheel falling flat onto the floor 0 on the axle … 1 flat */
  fwF: number;
  rwF: number;
  /** front wheel wobble on its axle 0/1 (a bolt sparks) */
  wob: number;

  // the PEDALLER (middle): hip offset, head offset, mouth 0 shut 1 open 2 yell, eyes 0 open 1 squint 2 shut 3 white, arms 0 bars 1 up 2 slumped
  pX: number;
  pY: number;
  pHx: number;
  pHy: number;
  pM: number;
  pE: number;
  pArm: number;
  pVis: number;
  /** out of the cart: legs 0 none 2 run, leg phase */
  pLeg: number;
  pLp: number;
  /** death: the ram tears off and drops to the floor 0…1 */
  ramFall: number;
  // the WRENCH goblin (front): hip, head, mouth, eyes, wrench hand (rel. shoulder), wrench angle (rad, 0 = forward), out of the cart 0/1 (kneels on the floor), legs 0 none 1 kneel 2 run 3 stand, leg phase
  wX: number;
  wY: number;
  wHx: number;
  wHy: number;
  wM: number;
  wE: number;
  wAx: number;
  wAy: number;
  wAng: number;
  wLeg: number;
  wLp: number;
  wVis: number;
  // the SLINGER (back): hip, head, mouth, eyes, sling hand (rel. shoulder), pull 0…1, legs, leg phase
  sX: number;
  sY: number;
  sHx: number;
  sHy: number;
  sM: number;
  sE: number;
  sAx: number;
  sAy: number;
  sPull: number;
  sLeg: number;
  sLp: number;
  sVis: number;

  /** smoke 0 none … 1 idle puffs … 3 black clouds; smoke phase (turns) */
  smk: number;
  sm: number;
  /** flag wave phase (turns) and amplitude 0…2 */
  flag: number;
  flagK: number;
  /** stove door glow 0 dark … 3 white-hot; fire burst out of the pipe 0…1 ("vuf") */
  door: number;
  vuf: number;
  /** sweat drops / panting steam phase 0…1 (0 none) */
  sweat: number;
  /** rear wheel sparks 0…1 (the back-pedal) */
  spark: number;
  /** ram impact flash 0…1, flying bolts and gears 0…1 */
  flash: number;
  deb: number;
  /** the idle bolt: −1 none, 0…1 its trip (pops out → caught → shot back in) */
  bolt: number;
  /** hitMagic zaps 0…1, crew lit white 0/1 */
  zap: number;
  white: number;
  /** summon / death scrap heap 0 none … 1 full mound, its lift above the floor (falling pile) */
  heap: number;
  heapY: number;
  /** summon assembly: tub, wheels, ram, stove + pipe + flag shown 0 hidden … 1 in place (between: flying up from the heap) */
  aTub: number;
  aWh: number;
  aRam: number;
  aTop: number;
  /** pipe and flag pole toppling 0 upright … 1 down (death) */
  topple: number;
  /** a hammer-blow spark at the wrench head 0…1 */
  ham: number;
  /** ground dust 0…1 */
  dust: number;
  /** erosion 0…1 (last ~150 ms of the death) */
  diss: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  bx: 0, by: 0, bob: 0, tilt: 0, deck: 0, wr: 0, wf: 0, fwF: 0, rwF: 0, wob: 0,
  pX: 0, pY: 0, pHx: 0, pHy: 0, pM: 0, pE: 0, pArm: 0, pVis: 1, pLeg: 0, pLp: 0, ramFall: 0,
  wX: 0, wY: 0, wHx: 0, wHy: 0, wM: 0, wE: 0, wAx: 3, wAy: -5, wAng: -1.2, wLeg: 0, wLp: 0, wVis: 1,
  sX: 0, sY: 0, sHx: 0, sHy: 0, sM: 0, sE: 0, sAx: 3, sAy: -5, sPull: 0, sLeg: 0, sLp: 0, sVis: 1,
  smk: 1, sm: 0, flag: 0, flagK: 1, door: 1, vuf: 0, sweat: 0, spark: 0, flash: 0, deb: 0, bolt: -1,
  zap: 0, white: 0, heap: 0, heapY: 0, aTub: 1, aWh: 1, aRam: 1, aTop: 1, topple: 0, ham: 0, dust: 0, diss: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

/** body-space anchors (x right, y up = −) */
const REAR_WHEEL: Pt = [-19, -8];
const REAR_R = 8;
const FRONT_WHEEL: Pt = [14, -6];
const FRONT_R = 6;
const TUB: Pt[] = [[-31, -27], [21, -25], [25, -21], [25, -14], [21, -10], [-28, -10], [-31, -14]];
const HIP_S: Pt = [-13, -29];
const HIP_P: Pt = [-2, -23];
const HIP_W: Pt = [11, -27];
const BAR: Pt = [6, -27];
/** the ram's middle spike tip */
export const RAM_TIP: Pt = [42, -17];

export interface Gob {
  hip: Pt;
  head: Pt;
  shF: Pt;
  shB: Pt;
  hand: Pt;
  handB: Pt;
}

export interface Skel {
  R: Pt;
  /** body-space → frame px through the tub (bob + tilt + assembly lift) */
  tub: (x: number, y: number) => Pt;
  deck: (x: number, y: number) => Pt;
  rear: Pt;
  front: Pt;
  ram: Pt;
  stove: Pt;
  pipeBase: Pt;
  pipeTop: Pt;
  poleBase: Pt;
  poleTop: Pt;
  P: Gob;
  Wg: Gob;
  S: Gob;
  core: Pt;
}

/** nose drop at body x (0 at the rear wheel, full at the ram) */
export function tiltAt(o: Pose, x: number): number {
  return o.tilt * clamp((x + 28) / 70, 0, 1);
}

function gob(hip: Pt, hx: number, hy: number, hand: Pt, handB: Pt): Gob {
  const head: Pt = [hip[0] + 1 + hx, hip[1] - 10 + hy];
  return { hip, head, shF: [hip[0] + 2, hip[1] - 5], shB: [hip[0] - 2, hip[1] - 5], hand, handB };
}

export function skeleton(o: Pose): Skel {
  const R: Pt = [RX + o.bx, GY - o.by];
  const lift = (1 - clamp(o.aTub, 0, 1)) * 10;
  const tub = (x: number, y: number): Pt => [R[0] + x, R[1] + y + o.bob + tiltAt(o, x) + lift];
  const fy = Math.min(0, tiltAt(o, FRONT_WHEEL[0]));
  const rear: Pt = [R[0] + REAR_WHEEL[0], R[1] + REAR_WHEEL[1]];
  const front: Pt = [R[0] + FRONT_WHEEL[0], R[1] + FRONT_WHEEL[1] + fy];
  const ram = tub(RAM_TIP[0], RAM_TIP[1]);
  const deck = (x: number, y: number): Pt => tub(x, y + o.deck);
  const stove = deck(-27, -31);
  const pipeBase = deck(-29, -36);
  const tp = o.topple * 1.25;
  const pipeTop: Pt = [pipeBase[0] - Math.sin(tp) * 10, pipeBase[1] - Math.cos(tp) * 10];
  const poleBase = deck(-19, -27);
  // the flag pole falls forward over the wreck (the pipe falls back)
  const poleTop: Pt = [poleBase[0] + Math.sin(tp * 0.95) * 32, poleBase[1] - Math.cos(tp * 0.95) * 32];

  // the pedaller: hands on the bar (or up / slumped)
  const pHip: Pt = o.pLeg > 0 ? [R[0] + o.pX, R[1] + o.pY] : deck(HIP_P[0] + o.pX, HIP_P[1] + o.pY);
  const bar = deck(BAR[0], BAR[1]);
  const pShF: Pt = [pHip[0] + 2, pHip[1] - 5];
  const pHand: Pt = o.pArm === 1 ? [pShF[0] + 2, pShF[1] - 7] : o.pArm === 2 ? [bar[0] - 1, bar[1] + 1] : bar;
  const pHandB: Pt = o.pArm === 1 ? [pShF[0] - 5, pShF[1] - 6] : [bar[0] - 2, bar[1]];
  const P = gob(pHip, o.pHx, o.pHy, pHand, pHandB);

  // the wrench goblin: in the cart he follows the tub; out of it (wLeg > 0) his hip is in frame space over the floor
  const wHome = deck(HIP_W[0], HIP_W[1]);
  const wHip: Pt = o.wLeg > 0 ? [R[0] + o.wX, R[1] + o.wY] : [wHome[0] + o.wX, wHome[1] + o.wY];
  const wSh: Pt = [wHip[0] + 2, wHip[1] - 5];
  const Wg = gob(wHip, o.wHx, o.wHy, [wSh[0] + o.wAx, wSh[1] + o.wAy], [wHip[0] - 3, wHip[1] - 3]);

  // the slinger
  const sHome = deck(HIP_S[0], HIP_S[1]);
  const sHip: Pt = o.sLeg > 0 ? [R[0] + o.sX, R[1] + o.sY] : [sHome[0] + o.sX, sHome[1] + o.sY];
  const sSh: Pt = [sHip[0] + 2, sHip[1] - 5];
  const sHand: Pt = [sSh[0] + o.sAx, sSh[1] + o.sAy];
  const sHandB: Pt = [sHand[0] - 2 - o.sPull * 4, sHand[1] + 1 - o.sPull];
  const S = gob(sHip, o.sHx, o.sHy, sHand, sHandB);

  return { R, tub, deck, rear, front, ram, stove, pipeBase, pipeTop, poleBase, poleTop, P, Wg, S, core: tub(-2, -18) };
}

// ---------------------------------------------------------------- frame

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
}

const layer = () => new PixelCanvas(W, H);
const ptI = (a: Pt): Pt => [rnd(a[0]), rnd(a[1])];

// ---------------------------------------------------------------- wheels

function drawWheel(f: Frame, c: Pt, r: number, flat: number, spin: number, near: boolean, part: number, wob: number): void {
  const { light } = f;
  const ry = Math.max(3, r - (r - 3) * flat);
  const rx = r;
  // a flattening wheel keeps its bottom on the floor and its x span (HA-9)
  const cx = rnd(c[0]);
  const cy = flat > 0 ? rnd(c[1] + r - ry) : rnd(c[1]);
  const q = layer();
  q.ellipse(cx + 0.5, cy + 0.5, rx + 0.5, ry + 0.5, PAL.stone1);
  bands(q, { L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.ink }, light, 1, 1);
  // wheel face: dark wood disc inside the iron tyre
  const irx = rx - 1.6;
  const iry = ry - 1.6;
  if (irx > 0.5 && iry > 0.5) {
    for (let y = fl(cy - iry); y <= cy + iry + 1; y++)
      for (let x = fl(cx - irx); x <= cx + irx + 1; x++) {
        const dx = (x - cx) / (irx + 0.3);
        const dy = (y - cy) / (iry + 0.3);
        if (dx * dx + dy * dy <= 1 && q.isOpaque(x, y)) q.set(x, y, near ? PAL.earth0 : PAL.ink);
      }
    // spokes: 4 (rear) / 4 (front), turning with the spin phase
    const n = 4;
    for (let k = 0; k < n; k++) {
      const a = spin * TAU + (k / n) * Math.PI;
      const ex = Math.cos(a) * (irx + 0.3);
      const ey = Math.sin(a) * (iry + 0.3);
      const lit = Math.cos(a) * light.side < 0 ? 0 : 1;
      lineIn4(q, rnd(cx - ex), rnd(cy - ey), rnd(cx + ex), rnd(cy + ey), lit ? (near ? WOOD.S : WOOD.D) : near ? WOOD.M : WOOD.S);
    }
  }
  // tread lugs on the tyre: two bright notches turning with the wheel
  for (let k = 0; k < 3; k++) {
    const a = spin * TAU + (k / 3) * TAU;
    for (const da of [0, 0.16]) {
      const x = rnd(cx + Math.cos(a + da) * (rx - 0.3));
      const y = rnd(cy + Math.sin(a + da) * (ry - 0.3));
      if (q.isOpaque(x, y) && q.get(x, y) !== PAL.earth0) q.set(x, y, PAL.stone3);
    }
  }
  // brass hub
  const hubX = wob > 0 ? cx + 1 : cx;
  if (ry >= 3) {
    q.set(hubX, cy, BRASS.M).set(hubX - 1, cy, light.side < 0 ? BRASS.L : BRASS.S).set(hubX + 1, cy, light.side < 0 ? BRASS.S : BRASS.L);
    q.set(hubX, cy - 1, BRASS.L).set(hubX, cy + 1, BRASS.D);
  } else q.set(hubX, cy, BRASS.M).set(hubX + 1, cy, BRASS.S);
  f.comp.add(q, part, { out: PAL.ink });
}

// ---------------------------------------------------------------- the cart body

function drawTub(f: Frame): void {
  const { o, sk, light } = f;
  if (o.aTub <= 0) return;
  const q = layer();
  const pts = TUB.map(([x, y]) => sk.tub(x, y));
  q.poly(pts, IRON.M);
  bands(q, IRON, light, 3, 3, { top: 2, bottom: 2 });
  // patchwork: the middle and prow plates are rust (same planes, rust tones)
  const toRust = new Map<number, number>([[IRON.L, RUST.L], [IRON.M, RUST.M], [IRON.S, RUST.S]]);
  const [x0] = sk.tub(-15, 0);
  const [x1] = sk.tub(3, 0);
  const [x2] = sk.tub(15, 0);
  for (let y = 0; y < H; y++)
    for (let x = fl(x0); x < W; x++) {
      const c = q.get(x, y);
      if (c === null) continue;
      const rust = (x >= x0 && x < x1) || x >= x2;
      if (rust) q.set(x, y, toRust.get(c) ?? c);
    }
  // the rim lip (two rows, polished iron) and the seams between the plates
  const lipY = (x: number) => sk.tub(x, -25 - (x < 21 ? (21 - x) * (2 / 52) : 0))[1];
  for (let x = rnd(pts[0][0]) + 1; x <= rnd(pts[1][0]); x++) {
    const bx = x - sk.R[0];
    const y = rnd(lipY(bx));
    if (q.isOpaque(x, y)) q.set(x, y, bx % 5 === 0 ? PAL.stone4 : PAL.stone3);
    if (q.isOpaque(x, y + 1)) q.set(x, y + 1, PAL.stone1);
  }
  for (const sx of [-15, 3, 15]) {
    const [x, ya] = sk.tub(sx, -24);
    for (let y = rnd(ya); y < rnd(sk.tub(sx, -10)[1]); y++) if (q.isOpaque(rnd(x), y)) q.set(rnd(x), y, PAL.stone0);
  }
  {
    // a horizontal seam on the back plate and a patch plate with rivets on the rust middle
    const [ax, ay] = sk.tub(-30, -18);
    for (let x = rnd(ax) + 1; x < rnd(x0); x++) if (q.isOpaque(x, rnd(ay))) q.set(x, rnd(ay), PAL.stone0);
    const [px, py] = ptI(sk.tub(-11, -20));
    for (let y = py; y < py + 5; y++) for (let x = px; x < px + 7; x++) if (q.isOpaque(x, y)) q.set(x, y, y === py ? PAL.stone3 : y === py + 4 ? PAL.stone1 : PAL.stone2);
    for (const [rx, ry] of [[px + 1, py + 1], [px + 5, py + 1], [px + 1, py + 3], [px + 5, py + 3]]) q.set(rx, ry, PAL.stone4);
  }
  // rivets along the plate seams
  for (const sx of [-16, 2, 4, 14, 16]) for (const sy of [-22, -13]) {
    const [x, y] = ptI(sk.tub(sx, sy));
    if (q.isOpaque(x, y)) q.set(x, y, light.side < 0 ? PAL.gold3 : PAL.gold2);
  }
  // the painted flame on the iron plate between the seams (FIRE)
  {
    const [fx, fy] = ptI(sk.tub(5, -14));
    const flame = ['....o..', '...oo..', '..ooy.o', '.oyyoo.', 'ooyyyo.', '.ooooo.'];
    q.stamp(flame, { o: PAL.fire2, y: PAL.fire3 }, fx, fy - 5);
  }
  // a dent on the back plate
  {
    const [dx, dy] = ptI(sk.tub(-25, -14));
    q.set(dx, dy, PAL.stone1).set(dx + 1, dy, PAL.stone1).set(dx + 2, dy - 1, PAL.stone1).set(dx, dy - 1, PAL.stone3);
  }
  f.comp.add(q, Part.tub, { out: PAL.ink });

  // the front axle bracket (seen when the front wheel lies on the floor)
  if (o.fwF > 0) {
    const a = layer();
    const [x, y] = ptI(sk.tub(FRONT_WHEEL[0], -10));
    const ay = Math.min(rnd(sk.front[1]), sk.R[1] - 2);
    a.rect(x - 1, y, 3, Math.max(1, ay - y + 1), PAL.stone1);
    a.rect(x - 1, ay - 1, 3, 2, PAL.stone2);
    a.set(x, ay - 1, BRASS.M);
    f.comp.add(a, Part.tub, { out: PAL.ink });
  }
}

function drawRam(f: Frame): void {
  const { o, sk, light } = f;
  if (o.aRam <= 0) return;
  const lift = (1 - clamp(o.aRam, 0, 1)) * 12;
  // torn off (death): the ram drops forward to the floor, its plate lands on the ground
  const fx = rnd(o.ramFall * 3);
  const drop = rnd(Math.max(0, sk.R[1] - 1 - sk.tub(33, -11)[1]) * o.ramFall);
  const T = (x: number, y: number): Pt => {
    const p = sk.tub(x, y);
    return [p[0] + fx, p[1] + lift + drop];
  };
  // the beam (wood, an iron band)
  const b = layer();
  b.poly(tubePoly(T(22, -17), T(34, -17), 4), WOOD.M);
  bands(b, WOOD, light, 1, 1);
  const [bx] = ptI(T(28, -17));
  for (let y = 0; y < H; y++) if (b.isOpaque(bx, y)) b.set(bx, y, PAL.stone1).set(bx + 1, y, PAL.stone2);
  f.comp.add(b, Part.ram, { out: PAL.ink });
  // the bumper plate
  const pl = layer();
  const [px, py] = ptI(T(33, -24));
  const [, pb] = ptI(T(33, -11));
  pl.poly(boxPoly(px, py, px + 5, pb, 1), RUST.M);
  bands(pl, RUST, light, 1, 1);
  pl.set(px + 2, py + 2, PAL.gold2).set(px + 2, pb - 3, PAL.gold2);
  f.comp.add(pl, Part.ram, { out: PAL.ink });
  // three steel spikes
  const sp = layer();
  for (const yy of [-21, -17, -13]) {
    const [x, y] = ptI(T(38, yy));
    sp.poly([[x - 1, y - 2], [x + 4 + (yy === -17 ? 1 : 0), y], [x + 4 + (yy === -17 ? 1 : 0), y + 1], [x - 1, y + 3]], STEEL.M);
  }
  bands(sp, STEEL, light, 1, 1, { bottom: 1 });
  f.comp.add(sp, Part.ram, { out: PAL.ink });
}

function drawStove(f: Frame): void {
  const { o, sk, light } = f;
  if (o.aTop <= 0) return;
  const lift = (1 - clamp(o.aTop, 0, 1)) * 14;
  // the flag (behind everything): pole + red cloth with a brass gear, waving back
  {
    const pb: Pt = [sk.poleBase[0], sk.poleBase[1] + lift];
    const pt: Pt = [sk.poleTop[0], sk.poleTop[1] + lift];
    const q = layer();
    q.poly(tubePoly(pb, pt, 1.6), WOOD.S);
    f.comp.add(q, Part.flag, {});
    const c = layer();
    const [tx, ty] = ptI(pt);
    const dx = sk.poleTop[0] - sk.poleBase[0];
    const lean = dx / 32;
    for (let i = 0; i < 11; i++) {
      const wv = Math.sin(o.flag * TAU - i * 0.7) * o.flagK;
      const yTop = ty + 1 + rnd(wv * (i / 10) + lean * i * 0.4 * -1) + rnd(-lean * i);
      const h = 6 - (i > 7 ? i - 7 : 0);
      const x = tx - 1 - i;
      for (let y = yTop; y < yTop + h; y++) c.set(x, y, CLOTH.M);
    }
    bands(c, CLOTH, light, 1, 1);
    // the brass gear on the cloth (3×3 ring)
    const gx = tx - 6;
    const gy = ty + 3 + rnd(Math.sin(o.flag * TAU - 3.5) * o.flagK * 0.5 - lean * 5);
    for (const [ox, oy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) if (c.isOpaque(gx + ox, gy + oy)) c.set(gx + ox, gy + oy, ox === -1 && oy === -1 ? PAL.gold3 : PAL.gold2);
    if (c.isOpaque(gx, gy)) c.set(gx, gy, PAL.fire1);
    f.comp.add(c, Part.flag, { out: PAL.ink });
  }
  // the pipe (iron) with its cap
  {
    const pb: Pt = [sk.pipeBase[0], sk.pipeBase[1] + lift];
    const pt: Pt = [sk.pipeTop[0], sk.pipeTop[1] + lift];
    const q = layer();
    q.poly(tubePoly(pb, pt, 3, 0, 0), IRON.S);
    const [cx, cy] = ptI(pt);
    q.poly(boxPoly(cx - 3, cy - 2, cx + 3, cy + 1, 0), IRON.S);
    bands(q, { L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.ink }, light, 1, 1, { top: 1 });
    // soot band and a brass clamp
    const [mx, my] = ptI([(pb[0] + pt[0]) / 2, (pb[1] + pt[1]) / 2]);
    for (let x = mx - 2; x <= mx + 2; x++) if (q.isOpaque(x, my)) q.set(x, my, PAL.gold1);
    f.comp.add(q, Part.pipe, { out: PAL.ink });
  }
  // the stove box on the rear deck
  {
    const [sx, sy] = ptI([sk.stove[0], sk.stove[1] + lift]);
    const q = layer();
    q.poly(boxPoly(sx - 4, sy - 5, sx + 5, sy + 4, 1), PAL.stone1);
    bands(q, { L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.ink }, light, 1, 1);
    // the round door well (its glow is light) and the brass rim
    q.disc(sx + 0.5, sy + 0.5, 2.2, PAL.ink);
    q.set(sx - 2, sy, PAL.gold1).set(sx + 2, sy, PAL.gold1).set(sx, sy - 2, PAL.gold2).set(sx, sy + 2, PAL.gold0);
    f.comp.add(q, Part.stove, { out: PAL.ink });
  }
}

// ---------------------------------------------------------------- goblins

const HEAD = ['..aaaa..', '.aaaaaa.', 'aaaaaaaa', 'aaaaaaaaaa', 'aaaaaaaaa.', '.aaaaaa.', '..aaaa..'];

type Hat = 'goggles' | 'pot' | 'cap';

interface GobLook {
  g: Gob;
  hat: Hat;
  part: number;
  legs: number;
  lp: number;
  vest: Tones;
  item: 'wrench' | 'sling' | 'bars';
  ang: number;
  pull: number;
  white: boolean;
}

function drawGoblin(f: Frame, L: GobLook): void {
  const { light } = f;
  const { g, part } = L;
  const sk = L.white ? { L: PAL.white, M: PAL.mist, S: PAL.steel, D: PAL.stone2 } : SKIN;
  const [hx, hy] = ptI(g.hip);
  // legs (out of the cart only)
  if (L.legs > 0) {
    const q = layer();
    const leg = (a: Pt, b: Pt, c: Pt) => {
      q.poly(tubePoly(a, b, 2), sk.S);
      q.poly(tubePoly(b, c, 2), sk.S);
      q.rect(rnd(c[0]) - 1, rnd(c[1]) - 1, 3, 2, PAL.earth1);
    };
    if (L.legs === 1) {
      // kneeling: near knee forward on the floor, far foot planted
      leg([hx + 1, hy], [hx + 4, hy + 3], [hx + 1, hy + 4]);
      leg([hx - 1, hy], [hx - 2, hy + 2], [hx - 4, hy + 4]);
    } else if (L.legs === 2) {
      // running: two legs scissoring with the phase
      const a = L.lp * TAU;
      for (const s of [0, Math.PI]) {
        const k = Math.sin(a + s);
        const foot: Pt = [hx + k * 4, hy + 6 - Math.max(0, Math.cos(a + s)) * 2];
        const knee: Pt = [hx + k * 2 + 1, hy + 3];
        leg([hx, hy], knee, foot);
      }
    } else {
      leg([hx + 1, hy], [hx + 1, hy + 3], [hx + 2, hy + 6]);
      leg([hx - 1, hy], [hx - 2, hy + 3], [hx - 2, hy + 6]);
    }
    f.comp.add(q, part, { out: PAL.ink });
  }
  // back arm
  {
    const q = layer();
    q.poly(tubePoly(g.shB, g.handB, 2), sk.S);
    q.set(rnd(g.handB[0]), rnd(g.handB[1]), sk.M);
    f.comp.add(q, part, { out: PAL.ink });
  }
  // torso (vest)
  {
    const q = layer();
    q.poly(boxPoly(hx - 3, hy - 6, hx + 4, hy + 1, 1), L.white ? PAL.mist : L.vest.M);
    if (!L.white) bands(q, L.vest, light, 1, 1);
    // belt + buckle
    for (let x = hx - 3; x <= hx + 3; x++) if (q.isOpaque(x, hy - 1)) q.set(x, hy - 1, L.white ? PAL.steel : PAL.earth0);
    if (!L.white) q.set(hx + 1, hy - 1, PAL.gold2);
    f.comp.add(q, part, { out: PAL.ink });
  }
  // head
  {
    const [cx, cy] = ptI(g.head);
    const x0 = cx - 4;
    const y0 = cy - 3;
    const q = layer();
    q.stamp(HEAD, { a: sk.M }, x0, y0);
    // the long ear pointing back and up
    q.poly([[x0 + 1, y0 + 2], [x0 - 4, y0 - 1], [x0 - 3, y0 + 1], [x0 + 1, y0 + 4]], sk.M);
    bands(q, sk, light, 1, 1);
    // inner ear and the nose tip
    q.set(x0 - 2, y0 + 1, sk.S).set(x0 - 1, y0 + 2, sk.S);
    q.set(x0 + 9, y0 + 3, sk.L);
    // hats
    if (L.hat === 'pot') {
      const t = L.white ? STEEL : IRON;
      for (let x = x0; x <= x0 + 7; x++) q.set(x, y0 - 1, t.M).set(x, y0, t.M);
      for (let x = x0 + 1; x <= x0 + 6; x++) q.set(x, y0 - 2, t.L);
      for (let x = x0 - 1; x <= x0 + 8; x++) q.set(x, y0 + 1, x === x0 - 1 || x === x0 + 8 ? t.S : t.S);
      q.set(x0 + 2, y0 - 1, t.L).set(x0 + 3, y0 - 2, PAL.stone4);
    } else if (L.hat === 'cap') {
      const t = L.white ? STEEL : LEATHER;
      for (let x = x0 + 1; x <= x0 + 7; x++) q.set(x, y0, t.M).set(x, y0 + 1, x > x0 + 5 ? t.L : t.M);
      for (let x = x0 + 2; x <= x0 + 5; x++) q.set(x, y0 - 1, t.L);
      q.set(x0 + 8, y0 + 1, t.S).set(x0 + 9, y0 + 1, t.S);
      // the feather, back and up
      if (!L.white) q.set(x0, y0 - 1, PAL.fire3).set(x0 - 1, y0 - 2, PAL.fire3).set(x0 - 2, y0 - 3, PAL.fire2).set(x0 - 1, y0 - 3, PAL.fire4);
    } else {
      // goggles strap + two lenses on the forehead
      for (let x = x0; x <= x0 + 7; x++) if (q.isOpaque(x, y0 + 1)) q.set(x, y0 + 1, L.white ? PAL.steel : PAL.stone1);
      q.set(x0 + 4, y0 + 1, PAL.stone2).set(x0 + 5, y0 + 1, PAL.stone2).set(x0 + 6, y0 + 1, PAL.stone2).set(x0 + 7, y0 + 1, PAL.stone2);
      q.set(x0 + 4, y0, PAL.stone1).set(x0 + 5, y0, PAL.stone1).set(x0 + 6, y0, PAL.stone1);
    }
    f.comp.add(q, part, { out: PAL.ink });
  }
  // items + front arm
  const it = layer();
  if (L.item === 'wrench') {
    // a huge wrench: steel shaft from the hand along `ang`, an open jaw at its end
    const [ax, ay] = g.hand;
    const ex = ax + Math.cos(L.ang) * 11;
    const ey = ay + Math.sin(L.ang) * 11;
    const bx = ax - Math.cos(L.ang) * 2;
    const by = ay - Math.sin(L.ang) * 2;
    it.poly(tubePoly([bx, by], [ex, ey], 2), STEEL.S);
    it.disc(ex, ey, 3.1, STEEL.S);
    // the jaw's mouth: a 2-px notch cut deep into the head along the shaft (an open-ended wrench)
    const ux = Math.cos(L.ang);
    const uy = Math.sin(L.ang);
    for (let y = fl(ey - 5); y <= ey + 5; y++)
      for (let x = fl(ex - 5); x <= ex + 5; x++) {
        const dx = x + 0.5 - ex;
        const dy = y + 0.5 - ey;
        const along = dx * ux + dy * uy;
        const across = -dx * uy + dy * ux;
        if (along > -0.6 && Math.abs(across) < 1.05) it.erase(x, y);
      }
    bands(it, STEEL, light, 1, 1, { bottom: 1 });
  } else if (L.item === 'sling') {
    // a Y fork held up at the hand: wooden handle and prongs, the band pulled back to the other hand
    const [ax, ay] = ptI(g.hand);
    it.rect(ax, ay - 1, 1, 3, WOOD.S);
    it.set(ax - 1, ay - 2, WOOD.M).set(ax - 1, ay - 3, WOOD.M).set(ax + 1, ay - 2, WOOD.M).set(ax + 1, ay - 3, WOOD.L);
  }
  if (L.item !== 'bars') f.comp.add(it, part, { out: PAL.ink });
  {
    const q = layer();
    q.poly(tubePoly(g.shF, g.hand, 2), sk.M);
    const [hx2, hy2] = ptI(g.hand);
    q.rect(hx2 - 1, hy2 - 1, 2, 2, sk.M);
    bands(q, sk, light, 1, 0, { bottom: 0 });
    f.comp.add(q, part, { out: PAL.ink });
  }
}

function drawCrew(f: Frame, which: 'S' | 'P' | 'W'): void {
  const { o, sk } = f;
  const white = o.white > 0;
  if (which === 'S' && o.sVis > 0)
    drawGoblin(f, { g: sk.S, hat: 'cap', part: Part.crewS, legs: o.sLeg, lp: o.sLp, vest: CLOTH, item: 'sling', ang: 0, pull: o.sPull, white });
  if (which === 'P' && o.pVis > 0)
    drawGoblin(f, { g: sk.P, hat: 'goggles', part: Part.crewP, legs: o.pLeg, lp: o.pLp, vest: LEATHER, item: 'bars', ang: 0, pull: 0, white });
  if (which === 'W' && o.wVis > 0)
    drawGoblin(f, { g: sk.Wg, hat: 'pot', part: Part.crewW, legs: o.wLeg, lp: o.wLp, vest: IRON, item: 'wrench', ang: o.wAng, pull: 0, white });
}

/** the pedaller's handlebar (a bent iron bar on a post at the tub's rim) */
function drawBar(f: Frame): void {
  const { o, sk } = f;
  if (o.aTub < 1) return;
  const q = layer();
  const [bx, by] = ptI(sk.deck(BAR[0], BAR[1]));
  q.rect(bx + 1, by, 1, 4, PAL.stone1);
  q.rect(bx - 2, by - 1, 4, 1, PAL.stone2);
  q.set(bx - 3, by - 2, PAL.stone2);
  f.comp.add(q, Part.tub, { out: PAL.ink });
}

// ---------------------------------------------------------------- the scrap heap (summon / death)

function drawHeap(f: Frame): void {
  const { o, sk, light } = f;
  if (o.heap <= 0) return;
  const q = layer();
  const cx = sk.R[0] - 3;
  const base = sk.R[1] - rnd(o.heapY);
  const hw = 14 + 12 * o.heap;
  const hh = 5 + 12 * o.heap;
  const pts: Pt[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = cx - hw + u * hw * 2;
    const env = Math.sin(u * Math.PI);
    const jag = (hash2(i, 3, 7) - 0.5) * 4 * o.heap;
    pts.push([x, base - env * hh + jag]);
  }
  pts.push([cx + hw, base + 1], [cx - hw, base + 1]);
  q.poly(pts, IRON.M);
  bands(q, IRON, light, 2, 2);
  // patchwork: rust cells, plate edges, a wheel rim and a pipe end sticking out
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = q.get(x, y);
      if (c === null) continue;
      const cell = hash2(fl((x - cx) / 5), fl((y - base) / 3), 11);
      if (cell < 0.45) q.set(x, y, c === IRON.L ? RUST.L : c === IRON.S ? RUST.S : RUST.M);
      else if (cell > 0.9 && c === IRON.M) q.set(x, y, PAL.stone1);
    }
  for (let i = 0; i < 6; i++) {
    const x = rnd(cx - hw * 0.7 + hash2(i, 9, 1) * hw * 1.4);
    const y = rnd(base - hh * 0.2 - hash2(i, 4, 2) * hh * 0.6);
    if (q.isOpaque(x, y)) q.set(x, y, i % 2 ? PAL.gold2 : PAL.stone4);
  }
  if (o.heapY > 0) {
    // falling: loose pieces tumble above the pile (a plate, a wheel, a pipe end, a bolt box)
    const loose: [number, number, number, number][] = [[-12, 9, 6, 3], [6, 12, 4, 4], [15, 6, 5, 2], [-3, 15, 3, 3]];
    for (const [dx, dy, w, h] of loose) {
      const x = rnd(cx + dx);
      const y = rnd(base - hh - dy);
      q.rect(x, y, w, h, dy > 10 ? RUST.M : IRON.M);
      q.rect(x, y, w, 1, dy > 10 ? RUST.L : IRON.L);
    }
  }
  if (o.heap > 0.35) {
    const wx = rnd(cx + hw * 0.35);
    const wy = rnd(base - hh * 0.55);
    // a wheel lying in the scrap: tyre, spokes, hub
    q.ellipse(wx + 0.5, wy + 0.5, 5, 2.5, PAL.stone1);
    q.ellipse(wx + 0.5, wy + 0.5, 3.4, 1.4, PAL.earth0);
    for (let x = wx - 3; x <= wx + 3; x++) if (q.get(x, wy) === PAL.earth0) q.set(x, wy, WOOD.S);
    q.set(wx, wy - 1, WOOD.S).set(wx, wy + 1, WOOD.S);
    q.set(wx, wy, PAL.gold2);
    q.poly(tubePoly([cx - hw * 0.4, base - hh * 0.5], [cx - hw * 0.65, base - hh * 1.05], 3), PAL.stone1);
  }
  f.comp.add(q, Part.heap, { out: PAL.ink });
}

/** speed streaks over the falling pile (light pass) */
function fallLight(f: Frame): void {
  const { o, sk } = f;
  if (o.heap <= 0 || o.heapY <= 0) return;
  const cx = sk.R[0] - 3;
  const top = sk.R[1] - rnd(o.heapY) - (5 + 12 * o.heap) - 16;
  for (const [dx, len] of [[-16, 7], [-8, 10], [0, 6], [9, 11], [17, 7]] as const)
    for (let i = 0; i < len; i++) put(f, cx + dx, top - i, i < 3 ? PAL.stone3 : PAL.stone2);
}

// ---------------------------------------------------------------- light and loose things (after the outline)

function put(f: Frame, x: number, y: number, c: number, behind = false): void {
  const { p } = f;
  x = rnd(x);
  y = rnd(y);
  if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
  if (behind && p.isOpaque(x, y)) return;
  p.set(x, y, c);
}

function eyes(f: Frame): void {
  const { o, sk } = f;
  const one = (g: Gob, e: number, m: number, vis: number) => {
    if (vis <= 0) return;
    const [cx, cy] = ptI(g.head);
    const x0 = cx - 4;
    const y0 = cy - 3;
    const ey = y0 + 2;
    const white = o.white > 0 || e === 3;
    if (e === 1) {
      f.p.set(x0 + 4, ey, PAL.leaf0).set(x0 + 5, ey, PAL.leaf0).set(x0 + 7, ey, PAL.leaf0);
    } else if (e === 2) {
      f.p.set(x0 + 4, ey - 1, PAL.leaf0).set(x0 + 5, ey, PAL.leaf0).set(x0 + 6, ey - 1, PAL.leaf0).set(x0 + 7, ey, PAL.leaf0);
    } else {
      f.p.set(x0 + 4, ey, white ? PAL.white : PAL.gold4).set(x0 + 5, ey, PAL.ink);
      f.p.set(x0 + 6, ey, white ? PAL.white : PAL.gold4).set(x0 + 7, ey, PAL.ink);
    }
    // mouth: 0 a grin line, 1 open with a tooth, 2 a yell (red tongue)
    const my = y0 + 5;
    if (m <= 0) f.p.set(x0 + 5, my, PAL.leaf0).set(x0 + 6, my, PAL.leaf0).set(x0 + 7, my - 1, PAL.leaf0);
    else if (m === 1) f.p.set(x0 + 5, my, PAL.ink).set(x0 + 6, my, PAL.white).set(x0 + 7, my, PAL.ink).set(x0 + 6, my - 1, PAL.ink);
    else {
      f.p.set(x0 + 5, my - 1, PAL.ink).set(x0 + 6, my - 1, PAL.white).set(x0 + 7, my - 1, PAL.ink).set(x0 + 8, my - 1, PAL.white);
      f.p.set(x0 + 5, my, PAL.ink).set(x0 + 6, my, PAL.fire1).set(x0 + 7, my, PAL.fire1).set(x0 + 5, my + 1, PAL.ink).set(x0 + 6, my + 1, PAL.ink);
    }
    // goggles glint
    if (g === sk.P && !white) f.p.set(x0 + 6, y0, PAL.white);
  };
  one(sk.S, o.sE, o.sM, o.sVis);
  one(sk.P, o.pE, o.pM, o.pVis);
  one(sk.Wg, o.wE, o.wM, o.wVis);
}

function stoveLight(f: Frame): void {
  const { o, sk } = f;
  if (o.aTop < 1 || o.door <= 0) return;
  const [sx, sy] = ptI(sk.stove);
  const lv = clamp(o.door, 0, 3);
  const flick = fl(o.t * 16 + o.sm * 8) % 3;
  const hot = lv >= 2.5 ? PAL.white : lv >= 1.5 ? PAL.fire4 : PAL.fire3;
  const mid = lv >= 1.5 ? PAL.fire3 : PAL.fire2;
  for (let y = -1; y <= 2; y++)
    for (let x = -1; x <= 2; x++) {
      const d = Math.abs(x - 0.5) + Math.abs(y - 0.5);
      if (d > 2) continue;
      f.p.set(sx + x, sy + y, d < 1 ? hot : d < 1.6 ? mid : PAL.fire1);
    }
  if (flick === 1) f.p.set(sx, sy - 1, hot);
  if (lv >= 2) f.p.set(sx + 1, sy + 3, PAL.fire2).set(sx, sy + 3, PAL.fire1);
}

function smokeLight(f: Frame): void {
  const { o, sk } = f;
  if (o.aTop < 1 || o.smk <= 0) return;
  const [cx, cy] = sk.pipeTop;
  const n = 3;
  for (let i = 0; i < n; i++) {
    const u = (o.sm + i / n) % 1;
    const r = 1 + u * (1.4 + o.smk * 0.6);
    const x = cx - u * 9 - Math.sin(u * 5 + i) * 1.2;
    const y = cy - 3 - u * (13 + o.smk * 2);
    if (y - r < 3) continue;
    const dark = o.smk >= 2.5;
    const core = dark ? PAL.stone1 : u < 0.5 ? PAL.stone4 : PAL.stone3;
    const edge = dark ? PAL.stone0 : u < 0.5 ? PAL.stone3 : PAL.stone2;
    for (let yy = fl(y - r - 1); yy <= y + r + 1; yy++)
      for (let xx = fl(x - r - 1); xx <= x + r + 1; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
        if (d <= r - 0.6) put(f, xx, yy, core, false);
        else if (d <= r + 0.4) put(f, xx, yy, edge, false);
      }
  }
}

function vufLight(f: Frame): void {
  const { o, sk } = f;
  if (o.vuf <= 0) return;
  const [cx, cy] = sk.pipeTop;
  // the coal stove's "VUF": a fire ball out of the cap, a ring of soot around it
  const r = 1.5 + o.vuf * 5;
  const y = cy - 3 - o.vuf * 7;
  for (let yy = fl(y - r - 2); yy <= y + r + 2; yy++)
    for (let xx = fl(cx - r - 2); xx <= cx + r + 2; xx++) {
      const d = Math.hypot((xx + 0.5 - cx) * 0.9, yy + 0.5 - y);
      const c = d < r * 0.45 ? (o.vuf < 0.5 ? PAL.white : PAL.fire4) : d < r * 0.8 ? PAL.fire3 : d < r ? PAL.fire2 : d < r + 1 && o.vuf > 0.4 ? PAL.stone1 : null;
      if (c !== null) put(f, xx, yy, c);
    }
  if (o.vuf < 0.6) for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45;
    put(f, cx + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3), PAL.fire4);
  }
  f.p.set(rnd(cx), rnd(cy) - 2, PAL.fire4);
}

function sparkLight(f: Frame): void {
  const { o, sk } = f;
  if (o.spark > 0) {
    // the back-pedal: sparks spray off the rear tyre where it grinds the floor
    const x0 = sk.rear[0] - 2;
    const y0 = sk.R[1] - 1;
    for (let i = 0; i < 12; i++) {
      const ph = (o.spark + hash2(i, 2, 5)) % 1;
      const v = 0.6 + hash2(i, 7, 3) * 0.8;
      const x = x0 + ph * 11 * v * (hash2(i, 1, 1) < 0.25 ? 1 : -1);
      const y = y0 - ph * 7 * v + ph * ph * 6;
      const c = ph < 0.3 ? PAL.white : ph < 0.6 ? PAL.gold4 : PAL.fire3;
      put(f, x, y, c);
      if (ph < 0.5) put(f, x + 1, y + 1, PAL.gold3);
    }
  }
  if (o.wob > 0) {
    // the loose front wheel: a bolt pops off its hub with a spark
    const [x, y] = ptI(sk.front);
    put(f, x + 2, y - 3, PAL.white);
    put(f, x + 3, y - 4, PAL.gold4);
    put(f, x + 1, y - 4, PAL.gold3);
    put(f, x + 4, y - 2, PAL.gold3);
  }
  if (o.ham > 0) {
    // a hammer-blow star at the wrench head
    const g = sk.Wg;
    const hx = g.hand[0] + Math.cos(o.wAng) * 12;
    const hy = g.hand[1] + Math.sin(o.wAng) * 12 + 2;
    const r = o.ham > 0.6 ? 4 : 2;
    const low = sk.R[1] - 6;
    const star = (x: number, y: number, c: number) => {
      if (y <= low) put(f, x, y, c);
    };
    for (let i = -r; i <= r; i++) {
      star(hx + i, hy, Math.abs(i) < 2 ? PAL.white : PAL.gold4);
      star(hx, hy + i, Math.abs(i) < 2 ? PAL.white : PAL.gold3);
    }
    if (o.ham > 0.6) for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) star(hx + dx, hy + dy, PAL.gold4);
  }
}

function flashLight(f: Frame): void {
  const { o, sk } = f;
  if (o.flash > 0) {
    // the ram's KLANG: a white core on the spikes, eight fire rays, and a shock arc ")" rolling forward
    const [x, y] = ptI(sk.ram);
    const k = o.flash;
    const core = k > 0.6 ? 3 : 1;
    for (let i = -core; i <= core; i++) for (let j = -core - 1; j <= core + 1; j++) if (Math.abs(i) + Math.abs(j) * 0.7 <= core + 0.6) put(f, x + i, y + j, PAL.white);
    const len = 3 + k * 7;
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * Math.PI * 2 + 0.2;
      const l = r % 2 ? len * 0.6 : len;
      for (let d = core + 1; d <= l; d++) put(f, x + Math.cos(a) * d, y + Math.sin(a) * d, d < l * 0.55 ? PAL.fire4 : d < l * 0.8 ? PAL.fire3 : PAL.fire2);
    }
    if (k > 0.6)
      for (let j = -9; j <= 9; j++) {
        const bow = Math.round(Math.sqrt(Math.max(0, 1 - (j * j) / 90)) * 2);
        put(f, x + 2 + bow, y + j, Math.abs(j) < 4 ? PAL.white : PAL.fire4);
        put(f, x + 1 + bow, y + j, PAL.fire3);
      }
    else
      for (let j = -11; j <= 11; j++) {
        const bow = Math.round(Math.sqrt(Math.max(0, 1 - (j * j) / 132)) * 2);
        if ((j & 1) === 0) put(f, x + 1 + bow, y + j, PAL.fire2);
      }
  }
  if (o.deb > 0) {
    // bolts and gears flung off the ram: up, back over the cart, and down to the floor
    const [x0, y0] = sk.ram;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * (0.1 + hash2(i, 5, 2) * 0.85);
      const v = 10 + hash2(i, 3, 9) * 16;
      const x = x0 - 2 + Math.cos(a) * v * o.deb * (i % 3 === 0 ? 0.6 : 1);
      const y = y0 + Math.sin(a) * v * o.deb + o.deb * o.deb * 20;
      if (y > sk.R[1] - 1) continue;
      if (i % 3 === 0) {
        // a gear: a tiny ring with teeth
        for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) put(f, x + dx, y + dy, dx === -1 && dy === -1 ? PAL.stone4 : PAL.stone3);
        put(f, x, y - 2, PAL.stone2);
        put(f, x + 2, y, PAL.stone2);
        put(f, x, y, PAL.ink);
      } else {
        put(f, x, y, i % 2 ? PAL.gold3 : PAL.mist);
        put(f, x + 1, y, i % 2 ? PAL.gold1 : PAL.steel);
      }
    }
  }
}

function boltLight(f: Frame): void {
  const { o, sk } = f;
  if (o.bolt < 0 || o.sVis <= 0) return;
  const from = sk.tub(-8, -21);
  const hand = sk.S.handB;
  let x: number;
  let y: number;
  const u = o.bolt;
  if (u < 0.35) {
    // pops out of the plate, arcs up to the slinger
    const k = u / 0.35;
    x = from[0] + (hand[0] - from[0]) * k;
    y = from[1] + (hand[1] - from[1]) * k - Math.sin(k * Math.PI) * 10;
  } else if (u < 0.75) {
    x = hand[0];
    y = hand[1];
  } else {
    // shot back into its hole
    const k = (u - 0.75) / 0.25;
    x = hand[0] + (from[0] - hand[0]) * k;
    y = hand[1] + (from[1] - hand[1]) * k - Math.sin(k * Math.PI) * 4;
  }
  put(f, x, y, PAL.gold3);
  put(f, x + 1, y, PAL.gold1);
  if (u >= 0.35 && u < 0.75) {
    // the band drawn from the fork's prongs to the bolt
    const [ax, ay] = sk.S.hand;
    for (const px of [-1, 1]) {
      const n = 5;
      for (let i = 1; i < n; i++) put(f, ax + px + (x - ax - px) * (i / n), ay - 3 + (y - ay + 3) * (i / n), PAL.earth1);
    }
  }
  if (u > 0.94) {
    // tink
    put(f, from[0], from[1] - 1, PAL.white);
    put(f, from[0] - 1, from[1] - 2, PAL.gold4);
    put(f, from[0] + 1, from[1] - 2, PAL.gold4);
  }
}

function sweatLight(f: Frame): void {
  const { o, sk } = f;
  if (o.sweat <= 0) return;
  for (const [g, s] of [[sk.P, 0], [sk.S, 0.5], [sk.Wg, 0.25]] as const) {
    const u = (o.sweat + s) % 1;
    const [cx, cy] = g.head;
    put(f, cx - 3, cy - 4 + u * 7, u < 0.6 ? PAL.water4 : PAL.water3);
    put(f, cx - 3, cy - 5 + u * 7, PAL.water3);
    // panting steam over the head
    if (u > 0.4) put(f, cx + 4 + u * 2, cy - 5 - u * 3, PAL.stone4);
  }
  // a wisp of smoke off the bare front axle
  if (o.fwF > 0.5) {
    const [x, y] = sk.tub(FRONT_WHEEL[0], -9);
    for (let i = 0; i < 3; i++) {
      const u = (o.sweat + i / 3) % 1;
      put(f, x + Math.sin(u * 6 + i) * 1.5 - u * 2, y - 2 - u * 9, u < 0.5 ? PAL.stone3 : PAL.stone2);
    }
  }
}

function zapLight(f: Frame): void {
  const { o, sk, p, comp } = f;
  if (o.zap <= 0) return;
  const ph = fl(o.t * 19);
  const starts: [number, number, number][] = [
    [sk.S.head[0], sk.S.head[1] - 4, -1.6],
    [sk.P.head[0], sk.P.head[1] - 4, -1.4],
    [sk.Wg.head[0], sk.Wg.head[1] - 5, -1.2],
    [sk.ram[0] - 2, sk.ram[1], 0.3],
    [sk.pipeTop[0], sk.pipeTop[1], -2.2],
  ];
  starts.forEach(([x0, y0, a0], k) => {
    const len = rnd(3 + 6 * o.zap);
    let x = x0;
    let y = y0;
    for (let i = 0; i < len; i++) {
      const j = hash2(i, ph, k * 13 + 5);
      const a = a0 + (j - 0.5) * 1.8;
      x += rnd(Math.cos(a) * 1.5);
      y += rnd(Math.sin(a) * 1.5);
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) break;
      if (p.get(rnd(x), rnd(y)) === PAL.ink && comp.id[rnd(y) * W + rnd(x)] !== Part.none) continue;
      p.set(rnd(x), rnd(y), i === 0 ? PAL.white : i % 2 ? PAL.mist : PAL.gold4);
    }
  });
}

function dustLight(f: Frame): void {
  const { o, sk } = f;
  if (o.dust <= 0) return;
  const y = sk.R[1] - 1;
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const v = 0.5 + hash2(i, 4, 4) * 0.8;
    const x = sk.R[0] - 3 + side * (14 + o.dust * 22 * v);
    const yy = y - Math.sin(o.dust * Math.PI) * 4 * v - (i % 3);
    put(f, x, yy, o.dust < 0.5 ? PAL.earth4 : PAL.earth3);
    put(f, x + side, yy, PAL.earth2);
  }
}

/** the last ~150 ms: the body breaks to scrap grit by 2×2 cells */
function dissolvePass(f: Frame): void {
  const { p, comp, o } = f;
  if (o.diss <= 0) return;
  const gone: number[] = [];
  const mark: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y) || comp.id[y * W + x] === Part.none) continue;
      const cx = fl((x - RX) / 2);
      const cy = fl((y - GY) / 2);
      const thr = hash2(cx, cy, 7) * 0.8 + clamp((GY - y) / 40, 0, 1) * 0.2;
      if (thr < o.diss - 0.12) gone.push(x, y);
      else if (thr < o.diss) mark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    comp.id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < mark.length; i += 2) p.set(mark[i], mark[i + 1], (fl((mark[i] - RX) / 2) + fl((mark[i + 1] - GY) / 2)) & 1 ? PAL.earth2 : PAL.stone3);
}

// ---------------------------------------------------------------- draw

export function drawRaiders(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };

  // the wreck (death / revive): the heap is in front of the sinking cart; the summon's heap is behind it
  const wreck = o.topple > 0;
  // crew in front of the cart: everybody while it is not built yet, and anyone fleeing on foot from the wreck
  const front = (which: 'S' | 'P' | 'W'): boolean => {
    if (o.aTub < 1) return true;
    const legs = which === 'S' ? o.sLeg : which === 'P' ? o.pLeg : o.wLeg;
    if (legs <= 0) return false;
    // the slinger thrown off in the charge runs BEHIND the cart
    return which !== 'S' || wreck || o.heap > 0 || o.aTop < 1;
  };
  if (!wreck) drawHeap(f);
  drawStove(f);
  for (const w of ['S', 'P', 'W'] as const) if (!front(w)) drawCrew(f, w);
  drawBar(f);
  drawTub(f);
  drawRam(f);
  if (o.aWh > 0) {
    const lift = -(1 - clamp(o.aWh, 0, 1)) * 12;
    drawWheel(f, [sk.rear[0], sk.rear[1] + lift], REAR_R, o.rwF, o.wr, true, Part.wheelR, 0);
    drawWheel(f, [sk.front[0], sk.front[1] + lift], FRONT_R, o.fwF, o.wf, true, Part.wheelF, o.wob);
  }
  if (wreck) drawHeap(f);
  for (const w of ['S', 'P', 'W'] as const) if (front(w)) drawCrew(f, w);

  p.outline(PAL.ink);
  dissolvePass(f);

  if (o.diss < 0.6) {
    stoveLight(f);
    eyes(f);
  }
  smokeLight(f);
  vufLight(f);
  boltLight(f);
  sparkLight(f);
  flashLight(f);
  sweatLight(f);
  zapLight(f);
  dustLight(f);
  fallLight(f);
}
