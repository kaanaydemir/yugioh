// Kadran Soytarısı v3 — the "dial jester" rig: Pose → pixels.
//
// A tiny clockwork harlequin whose whole head is a big round clock dial: a brass bezel round a white enamel face,
// two eyes and a sly grin painted on it, and the clock's two hands standing from the centre pin like eyebrows (10:10
// = the mischievous resting face; they tick, jolt, race and fall off). Two jester's points sprout from the bezel like
// the bells of an alarm clock, each tipped with a turning brass cog. A white ruff, a doublet of midnight / gold
// diamonds, one gold and one midnight leg in curled pointed shoes, white gloves, a wind-up key in the back and a
// gold coin as big as its torso.
//
//   - every part is a flat polygon / tube shaded by flat value planes (lit toward the key light, a shade band away);
//   - parts move by WHOLE pixels; the skeleton can be turned as a whole (the somersault, the death roll) — that is
//     pose geometry re-rasterised every frame, never a rotated sprite; the coin's flip, the cogs, the key and the
//     clock hands are per-phase pixel frames;
//   - ONE key light from the frame's top-left ('left' P1) or top-right ('right' = the P2 relight sheet);
//   - light (eye glints, cog / coin glints, ticks, the projected floor dial, flare, sparks) is painted after the
//     outline and never outlined (IŞ-9).
// Frame 72×84; 1 art px = 1 game px; the root R (RX, GY) is the ground point between the feet.

import { PAL } from '../palette';
import { PixelCanvas, bezier } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import {
  Comp, DEG, ENAMEL, GOLD, GOLD_FAR, NIGHT, NIGHT_FAR, STEEL, TAU, bands, clamp, cleanCrumbs, clockDir, cog, coin, floorDial, hash2, planes,
  rnd, rotv, taperPoly, type Pt, type Tones,
} from './dial_jester-kit';

export const W = 72;
export const H = 84;
export const RX = 28;
export const GY = 78;
/** coin face radius */
export const COIN_R = 6;
/** dial radius (bezel outer) and enamel face radius */
export const DIAL_R = 9;
const FACE_R = 6.6;

export const enum Part {
  none = 0,
  floor,
  hornB,
  armF,
  legF,
  key,
  legN,
  torso,
  ruff,
  coinF,
  head,
  hornF,
  armN,
  coin,
  debris,
}

const fl = Math.floor;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** body sink (px, + down: the knees take it), pelvis x shift, height off the ground (px) */
  py: number;
  bx: number;
  air: number;
  /** chest offset over the pelvis (lean toward the foe) and the breath (+ down) */
  lean: number;
  ty: number;
  /** dial offset over the ruff; neck = spring-neck stretch (px up) */
  hx: number;
  hy: number;
  neck: number;
  /** whole-body turn (deg, + = forward somersault), about the mid-body; tuck 0…1 folds the legs to the chest */
  spin: number;
  tuck: number;
  /** extra turn of the dial alone (the death roll), deg */
  hspin: number;
  /** hands' targets relative to R (+bx, −air): near (coin) hand and far hand */
  nx: number;
  ny: number;
  fx: number;
  fy: number;
  /** feet (grounded only): x shifts and lifts */
  nfx: number;
  nfl: number;
  ffx: number;
  ffl: number;
  /** coin: 0 in the near hand, 1 in the far hand, 2 free at (cx, cy) rel R (+bx, −air), 3 gone; flip cw (cos) */
  cmode: number;
  cx: number;
  cy: number;
  cw: number;
  /** clock hands (clock deg): the short hand (left brow) and the long hand (right brow); hands 0 on, 1 the long one gone */
  hour: number;
  min: number;
  handsOff: number;
  /** eyes: lid 0 open, 1 half, 2 shut, 3 = X (dazed); glow 0…2; look (px, + toward the foe); mouth 0 grin, 1 open O, 2 wince, 3 wide laugh */
  lid: number;
  eye: number;
  look: number;
  mouth: number;
  /** the dial's enamel blazes (hitMagic / special) 0…1 */
  blaze: number;
  /** wind-up key turn (deg) and the horn cogs' turn (turns) */
  key: number;
  gear: number;
  /** horn tip sway (px): back (left) and front (right) points */
  h1x: number;
  h1y: number;
  h2x: number;
  h2y: number;
  /** summon: the coil spring under the soles (0 none / 1), the floor dial (presence 0…1), its hands (deg), midnight flash */
  spring: number;
  floor: number;
  fHour: number;
  fMin: number;
  bell: number;
  /** death: glass crack 0…3, springs flying 0…1, cogs rolling 0…1, the long hand flying 0…1, dial drop (px) */
  crack: number;
  springs: number;
  gears: number;
  flyHand: number;
  hdrop: number;
  /** effects: release smear (coin edge), contact flare at the coin edge 0…1, sparks phase, tick spark 0…1, plate tremble, hand whirl */
  smear: number;
  flare: number;
  spark: number;
  tick: number;
  shake: number;
  whirl: number;
  /** a speed arc behind the somersault (0 none) */
  arc: number;
  /** dissolve front 0…1; gather = dissolve backwards (revive) */
  diss: number;
  gather: boolean;
  /** the anim's metal glint at the coin rim: 0 none, 1 = 1 px, 2 = cross */
  glint: number;
  /** the key is being wound: turn marks round its bow (0 none, 1) */
  keyFx: number;
  /** summon: the jester still inside the floor dial (only the light layer is drawn) */
  hide: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  py: 0, bx: 0, air: 0, lean: 0, ty: 0, hx: 0, hy: 0, neck: 0, spin: 0, tuck: 0, hspin: 0,
  nx: 11, ny: -17, fx: 4, fy: -19,
  nfx: 0, nfl: 0, ffx: 0, ffl: 0,
  cmode: 0, cx: 0, cy: 0, cw: 1,
  hour: 300, min: 60, handsOff: 0,
  lid: 0, eye: 1, look: 0, mouth: 0, blaze: 0,
  key: 0, gear: 0, h1x: 0, h1y: 0, h2x: 0, h2y: 0,
  spring: 0, floor: 0, fHour: 0, fMin: 0, bell: 0,
  crack: 0, springs: 0, gears: 0, flyHand: 0, hdrop: 0,
  smear: 0, flare: 0, spark: 0, tick: 0, shake: 0, whirl: 0, arc: 0,
  diss: 0, gather: false, glint: 0, keyFx: 0, hide: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  pel: Pt;
  nk: Pt;
  hc: Pt;
  /** mid-body (the turn's centre) and the whole-body turn (deg) */
  bc: Pt;
  ang: number;
  /** the dial's own turn (deg) = ang + hspin */
  hang: number;
  sh1: Pt;
  sh2: Pt;
  el1: Pt;
  el2: Pt;
  w1: Pt;
  w2: Pt;
  hip1: Pt;
  hip2: Pt;
  kn1: Pt;
  kn2: Pt;
  an1: Pt;
  an2: Pt;
  /** sole rows (the ground when standing) */
  sole1: number;
  sole2: number;
  grounded: boolean;
  /** the key's stem point on the back, horn tips, the coin centre */
  kc: Pt;
  tip1: Pt;
  tip2: Pt;
  hb1: Pt;
  hb2: Pt;
  coinC: Pt;
}

const reach = (a: Pt, b: Pt, len: number): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
};
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function skeleton(o: Pose): Skel {
  const grounded = o.air <= 0 && o.tuck <= 0;
  const pel: Pt = [RX + o.bx, GY - 12 + o.py - o.air];
  const nk: Pt = [pel[0] + o.lean, pel[1] - 11 + o.ty];
  const hc: Pt = [nk[0] + 1 + o.hx, nk[1] - 8 - o.neck + o.hy + o.hdrop];
  const bc: Pt = [pel[0], pel[1] - 7];
  const ang = o.spin;
  const R = (q: Pt): Pt => (ang ? add(bc, rotv([q[0] - bc[0], q[1] - bc[1]], ang)) : q);
  // shoulders hang on the ruff
  const sh1 = R([nk[0] + 3, nk[1] + 2]);
  const sh2 = R([nk[0] - 2, nk[1] + 1]);
  const base: Pt = [RX + o.bx, GY - o.air];
  const w1 = reach(sh1, R([base[0] + o.nx, base[1] + o.ny]), 10.4);
  const w2 = reach(sh2, R([base[0] + o.fx, base[1] + o.fy]), 10.4);
  const el1 = ik2(sh1, w1, 5.4, 5.4, 1) as Pt;
  const el2 = ik2(sh2, w2, 5.4, 5.4, 1) as Pt;
  const hip1 = R([pel[0] + 2, pel[1] + 1]);
  const hip2 = R([pel[0] - 2, pel[1] + 1]);
  let an1: Pt;
  let an2: Pt;
  if (grounded) {
    an1 = [RX + 4 + o.nfx, GY - 2 - o.nfl];
    an2 = [RX - 3 + o.ffx, GY - 2 - o.ffl];
  } else {
    an1 = R(add(pel, lerp([3, 10.5], [6, 2], o.tuck)));
    an2 = R(add(pel, lerp([-3, 10.5], [3, 4], o.tuck)));
  }
  const kn1 = ik2(hip1, an1, 6, 6, -1) as Pt;
  const kn2 = ik2(hip2, an2, 6, 6, -1) as Pt;
  const hang = ang + o.hspin;
  const H = (v: Pt): Pt => add(hc, rotv(v, hang));
  const hcR = R(hc);
  const HR = (v: Pt): Pt => add(hcR, rotv(v, hang));
  void H;
  const tip1 = add(HR([-12, -12]), [o.h1x, o.h1y]);
  const tip2 = add(HR([12, -13]), [o.h2x, o.h2y]);
  const kc = R([nk[0] - 7, nk[1] + 4]);
  let coinC: Pt;
  if (o.cmode === 0) coinC = add(w1, rotv([1, -6], ang));
  else if (o.cmode === 1) coinC = add(w2, rotv([1, -6], ang));
  else coinC = [base[0] + o.cx, base[1] + o.cy];
  return {
    pel: R(pel), nk: R(nk), hc: hcR, bc, ang, hang, sh1, sh2, el1, el2, w1, w2, hip1, hip2, kn1, kn2, an1, an2,
    sole1: grounded ? GY - o.nfl : an1[1] + 2, sole2: grounded ? GY - o.ffl : an2[1] + 2, grounded,
    kc, tip1, tip2, hb1: HR([-4, -7.5]), hb2: HR([3, -8.5]), coinC,
  };
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
const OUT = PAL.night0;

// ---------------------------------------------------------------- parts

function drawLeg(f: Frame, near: boolean): void {
  const { sk, o, light } = f;
  const hip = near ? sk.hip1 : sk.hip2;
  const kn = near ? sk.kn1 : sk.kn2;
  const an = near ? sk.an1 : sk.an2;
  // harlequin split: the near leg gold, the far leg midnight
  const t: Tones = near ? GOLD : NIGHT_FAR;
  const q = layer();
  q.poly(taperPoly(hip, kn, 3.6, 3), t.M);
  q.poly(taperPoly(kn, an, 3, 2.6), t.M);
  bands(q, t, light, 1, 1);
  f.comp.add(q, near ? Part.legN : Part.legF, { out: OUT });
  // curled pointed shoe (midnight on the near foot, gold-trimmed), toe curling up to a bell
  const s = layer();
  const st: Tones = near ? NIGHT : NIGHT_FAR;
  const ax = an[0];
  const ay = an[1];
  const sole = near ? sk.sole1 : sk.sole2;
  const dir = sk.grounded ? 1 : Math.cos(sk.ang * DEG) >= 0 ? 1 : -1;
  if (sk.grounded) {
    s.poly([[ax - 2, ay - 0.5], [ax + 2, ay - 0.5], [ax + 4.5, sole - 2], [ax + 6.5, sole - 4.5], [ax + 7.5, sole - 3], [ax + 6, sole], [ax - 2.5, sole]], st.M);
  } else {
    const fwd = rotv([1, 0], sk.ang);
    const dn = rotv([0, 1], sk.ang);
    const P = (u: number, v: number): Pt => [ax + fwd[0] * u * dir + dn[0] * v, ay + fwd[1] * u * dir + dn[1] * v];
    s.poly([P(-2, -0.5), P(2, -0.5), P(4.5, 0.5), P(6.5, -2), P(7.5, -0.6), P(6, 2), P(-2.5, 2)], st.M);
  }
  bands(s, st, light, 1, 1);
  // gold welt along the sole
  planes(s, (x, y, src) => (!src.isOpaque(x, y + 1) && src.isOpaque(x, y - 1) ? (near ? GOLD.M : GOLD_FAR.M) : null));
  f.comp.add(s, near ? Part.legN : Part.legF, { out: OUT });
}

function drawTorso(f: Frame): void {
  const { sk, o, light } = f;
  const q = layer();
  const pel = sk.pel;
  const nk = sk.nk;
  const ang = sk.ang;
  const P = (base: Pt, u: number, v: number): Pt => add(base, rotv([u, v], ang));
  // doublet: shoulders, waist, a zig-zag peplum
  q.poly([
    P(nk, -4.5, 1), P(nk, 4.5, 1), P(pel, 4, -4), P(pel, 6, 1.5), P(pel, 4, 3.5), P(pel, 2, 1.5), P(pel, 0, 3.5), P(pel, -2, 1.5), P(pel, -4, 3.5), P(pel, -6, 1.5), P(pel, -4, -4),
  ], NIGHT.M);
  const c = add(lerp(pel, nk, 0.5), [0, 0]);
  const ls = light.side;
  planes(q, (x, y, src) => {
    const [u, v] = rotv([x + 0.5 - c[0], y + 0.5 - c[1]], -ang);
    const a = fl((u + v + 40) / 3.4);
    const b = fl((u - v + 40) / 3.4);
    const gold = ((a + b) & 1) === 0;
    const t = gold ? GOLD : NIGHT;
    // flat value planes: the third of the doublet facing the key light is lit, the far third in shade
    const facing = (x + 0.5 - c[0]) * ls;
    const toL = src.isOpaque(x + ls, y) && src.isOpaque(x, y - 1);
    const away = src.isOpaque(x - ls, y) && src.isOpaque(x - ls * 2, y);
    if (!toL || facing > 1.6) return t.L;
    if (!away || facing < -2.2 || !src.isOpaque(x, y + 1)) return t.S;
    return t.M;
  });
  // a row of two gold buttons down the front
  const b1 = P(nk, 2.2, 3.5);
  const b2 = P(nk, 2.6, 7);
  void o;
  q.set(rnd(b1[0] - 0.5), rnd(b1[1] - 0.5), GOLD.H);
  q.set(rnd(b2[0] - 0.5), rnd(b2[1] - 0.5), GOLD.L);
  f.comp.add(q, Part.torso, { out: OUT });
}

function drawRuff(f: Frame): void {
  const { sk, light } = f;
  const q = layer();
  const pts: Pt[] = [];
  const c: Pt = add(sk.nk, rotv([0, 0.5], sk.ang));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const r = i % 2 ? 4.2 : 6.6;
    pts.push(add(c, rotv([Math.cos(a) * r, Math.sin(a) * r * 0.42], sk.ang)));
  }
  q.poly(pts, ENAMEL.M);
  bands(q, ENAMEL, light, 2, 1);
  f.comp.add(q, Part.ruff, { out: OUT });
}

function drawKey(f: Frame): void {
  const { sk, o, light } = f;
  const q = layer();
  const [kx, ky] = [rnd(sk.kc[0]), rnd(sk.kc[1])];
  // stem from the back
  q.rect(kx + 1, ky, 4, 2, GOLD.S);
  // the bow: two loops seen at the key's turn (a per-phase pixel frame: width |cos|)
  const cw = Math.cos(o.key * DEG);
  const hw = Math.max(0, rnd(Math.abs(cw) * 3));
  const top = ky - 5;
  const bot = ky + 5;
  q.rect(kx - hw, top, hw * 2 + 1, 3, GOLD.M);
  q.rect(kx - hw, bot - 2, hw * 2 + 1, 3, GOLD.M);
  q.rect(kx, top, 1, bot - top + 1, GOLD.M);
  if (hw >= 1) {
    q.set(kx, top + 1, GOLD.S);
    q.set(kx, bot - 1, GOLD.S);
  }
  bands(q, GOLD, light, 1, 1);
  f.comp.add(q, Part.key, { out: OUT });
}

function drawArm(f: Frame, near: boolean): void {
  const { sk, light } = f;
  const sh = near ? sk.sh1 : sk.sh2;
  const el = near ? sk.el1 : sk.el2;
  const w = near ? sk.w1 : sk.w2;
  // sleeves: the near arm midnight, the far arm gold (the split crosses the body)
  const t: Tones = near ? NIGHT : GOLD_FAR;
  const q = layer();
  q.poly(taperPoly(sh, el, 3.2, 2.8), t.M);
  q.poly(taperPoly(el, w, 2.8, 2.4), t.M);
  bands(q, t, light, 1, 1);
  // white glove
  const g = layer();
  g.disc(w[0], w[1], 1.7, near ? ENAMEL.L : ENAMEL.M);
  const cuff = lerp(el, w, 0.72);
  g.disc(cuff[0], cuff[1], 1.3, near ? ENAMEL.M : ENAMEL.S);
  q.blit(g, 0, 0);
  f.comp.add(q, near ? Part.armN : Part.armF, { out: OUT });
}

function drawCoin(f: Frame, part: Part): void {
  const { sk, o, light } = f;
  if (o.cmode === 3) return;
  const q = layer();
  coin(q, { cx: sk.coinC[0], cy: sk.coinC[1], r: COIN_R, w: o.cw }, light);
  if (o.smear > 0) {
    // HA-12: the release smear — the coin's edge stretched 2 px back along the swing
    const g = layer();
    coin(g, { cx: sk.coinC[0] - 2, cy: sk.coinC[1] + 1, r: COIN_R, w: o.cw }, light);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!q.isOpaque(x, y) && g.isOpaque(x, y)) q.set(x, y, GOLD.S);
  }
  f.comp.add(q, part, { out: OUT });
  if (o.cmode <= 1) {
    // the fingers over the coin's lower rim
    const w = o.cmode === 0 ? sk.w1 : sk.w2;
    const g = layer();
    g.rect(rnd(w[0] - 1), rnd(w[1] - 2), 2, 2, o.cmode === 0 ? ENAMEL.L : ENAMEL.M);
    f.comp.add(g, part, {});
  }
}

function drawHorn(f: Frame, front: boolean): void {
  const { sk, o, light } = f;
  const b = front ? sk.hb2 : sk.hb1;
  const tip = front ? sk.tip2 : sk.tip1;
  const up = rotv([0, -1], sk.hang);
  const mid: Pt = [b[0] + (tip[0] - b[0]) * 0.25 + up[0] * 7, b[1] + (tip[1] - b[1]) * 0.25 + up[1] * 7];
  const path = bezier(b, mid, tip, undefined, 14);
  const t: Tones = front ? GOLD : NIGHT;
  const q = layer();
  q.stroke(path, 4.6, 1.6, t.M);
  bands(q, t, light, 1, 1);
  // a band of the other colour at the base
  {
    // a cuff of the other colour round the base, just above the bezel
    const u = rotv([0, -1], sk.hang);
    const cc: Pt = [b[0] + u[0] * 2.2, b[1] + u[1] * 2.2];
    planes(q, (x, y) => (Math.hypot(x + 0.5 - cc[0], y + 0.5 - cc[1]) < 1.7 ? (front ? NIGHT.L : GOLD.M) : null));
  }
  f.comp.add(q, front ? Part.hornF : Part.hornB, { out: OUT });
  if (o.gears <= 0) {
    const g = layer();
    cog(g, tip[0], tip[1], 2, 8, o.gear * (front ? 1 : -1), front ? GOLD : GOLD_FAR);
    f.comp.add(g, front ? Part.hornF : Part.hornB, { out: OUT });
  }
}

function drawHead(f: Frame): void {
  const { sk, o, light } = f;
  const [cx, cy] = sk.hc;
  const q = layer();
  q.disc(cx, cy, DIAL_R, GOLD.M);
  const lv = light.v2;
  const blaze = o.blaze;
  planes(q, (x, y, src) => {
    const vx = x + 0.5 - cx;
    const vy = y + 0.5 - cy;
    const d = Math.hypot(vx, vy);
    const dl = (vx * lv[0] + vy * lv[1]) / Math.max(1, d);
    if (d > FACE_R) {
      // brass bezel: a lit arc toward the light, a shade arc away, a 1-px inner lip
      if (d < FACE_R + 1) return dl > 0.2 ? GOLD.M : GOLD.S;
      if (!src.isOpaque(x - Math.sign(lv[0]), y) || !src.isOpaque(x, y - 1)) return dl > 0.1 ? GOLD.H : GOLD.L;
      return dl > 0.35 ? GOLD.L : dl < -0.45 ? GOLD.S : GOLD.M;
    }
    if (blaze > 0.5) return d < FACE_R - 1.5 ? PAL.white : PAL.gold4;
    // enamel: white toward the light, mist, a steel crescent away from it (the dial's curved glass)
    return dl > -0.1 || d < 2.5 ? ENAMEL.L : dl < -0.45 && d > 4 ? ENAMEL.S : ENAMEL.M;
  });
  // 12 ticks round the face (quarter ticks 2 px)
  const ha = sk.hang;
  const P = (u: number, v: number): Pt => add(sk.hc, rotv([u, v], ha));
  const put = (u: number, v: number, c: number) => {
    const [x, y] = P(u, v);
    q.set(rnd(x - 0.5), rnd(y - 0.5), c);
  };
  for (let i = 0; i < 12; i++) {
    const [ux, uy] = clockDir(i * 30);
    const quarter = i % 3 === 0;
    if (!quarter) continue; // only the quarter marks: the face carries the eyes and the grin
    put(ux * 5.6, uy * 5.6, NIGHT.M);
    if (i === 0) put(ux * 4.6, uy * 4.6, NIGHT.M);
  }
  // face: the pin sits between the eyes, the hands are the brows
  const pin: Pt = [1, -3];
  const eyes: Pt[] = [[-2 + o.look, 0], [3 + o.look, 0]];
  for (const [ex, ey] of eyes) {
    if (o.lid >= 3) {
      // squeezed shut: a little arch (4-connected)
      put(ex - 1, ey + 1, PAL.ink);
      put(ex - 1, ey, PAL.ink);
      put(ex, ey, PAL.ink);
      put(ex + 1, ey, PAL.ink);
      put(ex + 1, ey + 1, PAL.ink);
    } else if (o.lid === 2) {
      put(ex - 1, ey + 0.5, NIGHT.S);
      put(ex, ey + 0.5, NIGHT.S);
      put(ex + 1, ey + 0.5, NIGHT.S);
    } else if (o.lid === 1) {
      put(ex, ey + 0.5, PAL.ink);
      put(ex + 1, ey + 0.5, PAL.ink);
    } else {
      // tall oval eyes (2×3)
      for (let dy = -1; dy <= 1; dy++) {
        put(ex, ey + dy, PAL.ink);
        put(ex + 1, ey + dy, PAL.ink);
      }
    }
  }
  // mouth
  const m = o.mouth;
  if (m === 0) {
    for (const [u, v] of [[-3, 2.5], [-2, 3.5], [-1, 3.5], [0, 3.5], [1, 3.5], [2, 3.5], [3, 3.5], [4, 2.5]] as const) put(u + o.look, v, PAL.ink);
    put(4 + o.look, 1.5, PAL.ink);
  } else if (m === 1) {
    for (const [u, v] of [[0, 2.5], [1, 2.5], [-0.5, 3.5], [1.5, 3.5], [0, 4.5], [1, 4.5]] as const) put(u + o.look, v, PAL.ink);
    put(0.5 + o.look, 3.5, PAL.crim1);
  } else if (m === 2) {
    for (const [u, v] of [[-2, 3.5], [-1, 2.5], [0, 3.5], [1, 2.5], [2, 3.5], [3, 2.5]] as const) put(u + o.look, v, PAL.ink);
  } else {
    for (let u = -3; u <= 4; u++) put(u + o.look, 2.5, PAL.ink);
    for (let u = -2; u <= 3; u++) put(u + o.look, 3.5, u === 0 || u === 1 ? PAL.crim1 : PAL.ink);
    for (let u = -1; u <= 2; u++) put(u + o.look, 4.5, PAL.ink);
  }
  // the hands (brows): short = hour (left), long = minute (right); a whirl paints ghost hands
  const stair = (u0: number, v0: number, u1: number, v1: number, c: number, c0 = c) => {
    // a 4-connected stair line in dial space (no lone diagonal pixels)
    const [x0, y0] = P(u0, v0);
    const [x1, y1] = P(u1, v1);
    let x = rnd(x0 - 0.5);
    let y = rnd(y0 - 0.5);
    const tx = rnd(x1 - 0.5);
    const ty = rnd(y1 - 0.5);
    const ux = x1 - x0;
    const uy = y1 - y0;
    if (c0 !== c) q.set(x, y, c0);
    let guard = 0;
    while ((x !== tx || y !== ty) && guard++ < 24) {
      const ex = tx - x;
      const ey = ty - y;
      if (Math.abs(ex) * Math.abs(uy) >= Math.abs(ey) * Math.abs(ux) ? ex !== 0 : ey === 0) x += Math.sign(ex);
      else y += Math.sign(ey);
      q.set(x, y, c);
    }
  };
  const hand = (a: number, L: number, c: number) => {
    const [ux, uy] = clockDir(a);
    stair(pin[0], pin[1], pin[0] + ux * L, pin[1] + uy * L, c);
  };
  if (o.whirl > 0) {
    for (let i = 1; i <= 2; i++) hand(o.min - i * 40, 5, PAL.mist);
  }
  hand(o.hour, 3.2, NIGHT.S);
  if (o.handsOff < 1) hand(o.min, 4.4, NIGHT.M);
  put(pin[0], pin[1], GOLD.M);
  // glass cracks
  if (o.crack > 0) {
    const cr: [number, number, number, number][] = [[-5, -4, 2, 3], [2, 3, 6, -1], [-1, 1, -5, 4], [3, -4, 5, -6], [0, -5, -2, -1]];
    const n = o.crack >= 3 ? 5 : o.crack >= 2 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const [x0, y0, x1, y1] = cr[i];
      stair(x0, y0, x1, y1, NIGHT.L, PAL.steel);
    }
  }
  f.comp.add(q, Part.head, { out: OUT });
}

function drawSpring(f: Frame): void {
  const { o, sk } = f;
  if (o.spring <= 0) return;
  const top = Math.min(sk.sole1, sk.sole2);
  const bot = GY - 3;
  if (bot - top < 2) return;
  const q = layer();
  const cx = RX + rnd(o.bx);
  const n = 5;
  const pts: Pt[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const y = bot - ((bot - top) * i) / (n * 2);
    pts.push([cx + (i % 2 ? 3 : -3), y]);
  }
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    q.line(rnd(ax), rnd(ay), rnd(bx), rnd(by), i % 2 ? STEEL.L : STEEL.S);
  }
  // a base cup on the floor dial's pin
  q.rect(cx - 2, bot, 5, 2, GOLD.M);
  q.set(cx - 2, bot, GOLD.L);
  f.comp.add(q, Part.floor, { out: OUT });
}

/** Death debris drawn as matter (outlined): the springs that burst out, the hand that flew, the cogs rolling. */
function drawDebris(f: Frame): void {
  const { o, sk } = f;
  const q = layer();
  if (o.springs > 0) {
    const s = o.springs;
    const dirs: [number, number, number][] = [[-1, -1.1, 0], [1.1, -1.3, 1], [0.2, -1.6, 2]];
    for (const [dx, dy, k] of dirs) {
      const d = 10 + 15 * s;
      let x = sk.hc[0] + dx * d * 0.8;
      let y = sk.hc[1] + dy * d * 0.7 + 30 * s * s;
      const floorY = GY - 3 - k;
      if (y > floorY) y = floorY;
      x = clamp(x, 7, W - 8);
      y = clamp(y, 5, H - 5);
      // a coil spring: a 7-px zig-zag 4 px wide (stretched while it flies, lying on the floor at the end)
      const len = s < 0.7 ? 8 : 6;
      const horiz = y >= floorY;
      let prev: Pt | null = null;
      for (let i = 0; i <= len; i++) {
        const u = i - len / 2;
        const v = i % 2 ? 1.6 : -1.6;
        const cur: Pt = horiz ? [rnd(x + u), rnd(y + v * 0.6)] : [rnd(x + v + u * 0.25 * dx), rnd(y + u)];
        if (prev) q.line(prev[0], prev[1], cur[0], cur[1], i % 2 ? STEEL.L : STEEL.M);
        prev = cur;
      }
    }
  }
  if (o.flyHand > 0) {
    const s = o.flyHand;
    const x = sk.hc[0] + 4 + s * 16;
    const y = Math.min(GY - 3, sk.hc[1] - 6 - s * 10 + s * s * 40);
    const a = s * 900;
    const [ux, uy] = clockDir(a);
    for (let i = -2; i <= 2; i++) q.set(rnd(x + ux * i), rnd(y + uy * i), NIGHT.M);
  }
  if (o.gears > 0) {
    const g = o.gears;
    for (const [tip, dir, k] of [[sk.tip2, 1, 0], [sk.tip1, -1, 1]] as const) {
      const fall = clamp(g * 2.6, 0, 1);
      const roll = clamp((g - 0.38) / 0.62, 0, 1);
      let x = tip[0] + dir * (2 + 4 * fall + roll * (k ? 10 : 18));
      const floorY = GY - 2 - k;
      // falls, bounces once, rolls
      const yFall = tip[1] + (floorY - tip[1]) * fall * fall;
      const bounce = roll > 0 && roll < 0.3 ? -Math.sin((roll / 0.3) * Math.PI) * 3 : 0;
      const y = fall < 1 ? yFall : floorY + bounce;
      x = clamp(x, 6, W - 7);
      cog(q, x, y, 2, 8, g * 3 * dir, k ? GOLD_FAR : GOLD);
    }
  }
  f.comp.add(q, Part.debris, { out: OUT });
}

// ---------------------------------------------------------------- light layer

function eyeLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.lid >= 2 || o.diss > 0.6) return;
  const g = o.eye;
  if (g <= 0.05) return;
  for (const ex of [-2 + o.look, 3 + o.look]) {
    const [x, y] = add(sk.hc, rotv([ex, -1], sk.hang));
    const c = g >= 1.6 ? PAL.white : g >= 1 ? PAL.gold4 : PAL.gold3;
    if (o.lid === 0) p.set(rnd(x - 0.5), rnd(y - 0.5), c);
    if (g >= 1.8) p.set(rnd(x + 0.5), rnd(y + 0.5), PAL.gold4);
  }
}

function glintLight(f: Frame): void {
  const { p, o, sk, light } = f;
  // the bezel's one specular pixel (always) and the coin rim glint (anim beats)
  const bz = add(sk.hc, [light.v2[0] * (DIAL_R - 1.5), light.v2[1] * (DIAL_R - 1.5)]);
  if (o.diss < 0.4) p.set(rnd(bz[0] - 0.5), rnd(bz[1] - 0.5), PAL.white);
  if (o.cmode !== 3 && o.diss < 0.4 && Math.abs(o.cw) > 0.3) {
    const r = COIN_R * Math.abs(o.cw) - 1.2;
    const x = rnd(sk.coinC[0] - 0.5 + light.v2[0] * r);
    const y = rnd(sk.coinC[1] - 0.5 + light.v2[1] * (COIN_R - 1.5));
    p.set(x, y, PAL.gold4);
    if (o.glint >= 1) p.set(x, y, PAL.white);
    if (o.glint >= 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) p.set(x + dx, y + dy, PAL.gold4);
  }
  // cog teeth catch the light every other turn step
  if (o.gears <= 0 && o.diss < 0.3) {
    for (const [tip, s] of [[sk.tip1, -1], [sk.tip2, 1]] as const) {
      const ph = ((o.gear * s * 6) % 1 + 1) % 1;
      if (ph < 0.5) p.set(rnd(tip[0] - 0.5) + (light.side < 0 ? -1 : 1), rnd(tip[1] - 0.5) - 2, PAL.gold4);
    }
  }
  // the shoe bells
  if (o.diss < 0.3 && sk.grounded) {
    p.set(RX + 4 + rnd(o.nfx) + 7, GY - 4 - rnd(o.nfl) - 1, PAL.gold4);
  }
}

function tickLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.tick <= 0) return;
  // a tiny "tik" star off the dial's 12 / at the pin
  const top = add(sk.hc, rotv([1, -DIAL_R - 3], sk.hang));
  const [x, y] = [rnd(top[0] - 0.5), rnd(top[1] - 0.5)];
  const ok = (xx: number, yy: number) => xx > 0 && yy > 0 && xx < W - 1 && yy < H - 1 && !p.isOpaque(xx, yy);
  if (ok(x, y)) p.set(x, y, o.tick >= 1 ? PAL.white : PAL.gold4);
  if (o.tick >= 1) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2]] as const) if (ok(x + dx, y + dy)) p.set(x + dx, y + dy, PAL.gold3);
}

function keyLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.keyFx <= 0) return;
  // "cırt": two short turn arcs round the key's bow (they swap sides each wind)
  const [kx, ky] = [rnd(sk.kc[0]), rnd(sk.kc[1])];
  const flip = fl(o.key / 90) % 2 ? 1 : -1;
  const pts: Pt[] = [[-4, -4 * flip], [-5, -3 * flip], [-5, -2 * flip], [3, 4 * flip], [4, 3 * flip]];
  for (const [dx, dy] of pts) {
    const x = kx + dx;
    const y = ky + dy;
    if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && !p.isOpaque(x, y)) p.set(x, y, dx < 0 ? PAL.white : PAL.gold4);
  }
}

function floorLight(f: Frame): void {
  const { p, o } = f;
  if (o.floor <= 0) return;
  floorDial(p, { cx: RX + rnd(o.bx), cy: GY - 3, rx: 21, ry: 4.5, hour: o.fHour, min: o.fMin, k: o.floor, hot: o.bell }, (x, y) => p.isOpaque(x, y));
  if (o.bell > 0) {
    // midnight: a white burst ring out of the dial's centre
    const r = 3 + (1 - o.bell) * 6;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const x = rnd(RX + o.bx + Math.cos(a) * r * 1.6);
      const y = rnd(GY - 4 + Math.sin(a) * r * 0.7 - 2);
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && !p.isOpaque(x, y)) p.set(x, y, o.bell > 0.6 ? PAL.white : PAL.gold4);
    }
  }
}

function flareLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.flare <= 0) return;
  // the coin's edge strikes: a white star at its leading rim
  const x = rnd(sk.coinC[0] - 0.5 + COIN_R * Math.max(0.3, Math.abs(o.cw)) + 1);
  const y = rnd(sk.coinC[1] - 0.5);
  p.rect(x - 1, y - 1, 3, 3, PAL.white);
  const L = o.flare > 0.6 ? 4 : 2;
  for (let i = 2; i <= L; i++) {
    const c = i < 3 ? PAL.gold4 : PAL.gold3;
    p.set(x + i, y, c).set(x, y - i, c).set(x, y + i, c);
    if (x - i >= 0 && !p.isOpaque(x - i, y)) p.set(x - i, y, c);
  }
  if (o.flare > 0.6) p.set(x + 2, y - 2, PAL.white).set(x + 2, y + 2, PAL.gold4);
}

function sparkLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.spark <= 0) return;
  const ph = o.spark;
  const c = o.flare > 0 || o.smear > 0 ? sk.coinC : sk.hc;
  for (let i = 0; i < 6; i++) {
    const a = hash2(i, 3, 5) * TAU;
    const d = 3 + ph * (5 + hash2(i, 9, 4) * 7);
    const x = rnd(c[0] + Math.cos(a) * d);
    const y = rnd(c[1] + Math.sin(a) * d * 0.8 + ph * ph * 5);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
    p.set(x, y, ph < 0.4 ? PAL.white : i % 2 ? PAL.gold4 : PAL.gold3);
    if (ph < 0.7 && !p.isOpaque(x + 1, y)) p.set(x + 1, y, PAL.gold2);
  }
}

function arcLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.arc <= 0) return;
  // the somersault's wake: two dotted arcs behind the turning body (gold outer, mist inner)
  const [cx, cy] = sk.bc;
  for (const [r, c] of [[17, PAL.gold3], [13, PAL.mist]] as const) {
    const a1 = sk.ang - 90 - 25;
    const a0 = a1 - 100 * o.arc;
    for (let a = a0; a <= a1; a += 7) {
      const x = rnd(cx + Math.cos(a * DEG) * r);
      const y = rnd(cy + Math.sin(a * DEG) * r);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || p.isOpaque(x, y)) continue;
      p.set(x, y, a > a1 - 40 ? c : r > 15 ? PAL.gold2 : PAL.steel);
    }
  }
}

function blazeLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.blaze <= 0) return;
  // the dial radiates: 8 short rays out of the bezel
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + o.t * 3;
    for (let s = 0; s < (o.blaze > 0.7 ? 3 : 2); s++) {
      const r = DIAL_R + 2 + s;
      const x = rnd(sk.hc[0] - 0.5 + Math.cos(a) * r);
      const y = rnd(sk.hc[1] - 0.5 + Math.sin(a) * r);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || p.isOpaque(x, y)) continue;
      p.set(x, y, s === 0 ? PAL.white : PAL.gold4);
    }
  }
}

// ---------------------------------------------------------------- dissolve (2×2 clusters from the top: brass crumbs fall)

function dissolvePass(f: Frame): void {
  const { p, comp, o } = f;
  if (o.diss <= 0) return;
  const front = 0.1;
  const gone: number[] = [];
  const mark: number[] = [];
  const debris: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      const rx = x - RX;
      const ry = y - GY;
      const cx = fl(rx / 2);
      const cy = fl(ry / 2);
      const u = clamp((ry + 50) / 52, 0, 1);
      const thr = 0.8 * u + 0.2 * hash2(cx, cy, 7);
      if (thr < o.diss - front) {
        gone.push(x, y);
        if (!o.gather && (rx & 1) === 0 && (ry & 1) === 0 && hash2(cx, cy, 11) < 0.2) {
          const fall = 2 + (o.diss - front - thr) * 60;
          if (fall < 20) {
            const yy = Math.min(GY - 1, y + rnd(fall));
            const h = hash2(cx, cy, 19);
            debris.push(x + rnd(Math.sin(cy * 1.7 + fall * 0.2) * 2), yy, h < 0.5 ? PAL.gold2 : h < 0.8 ? PAL.mist : PAL.night3);
          }
        }
      } else if (thr < o.diss) mark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    comp.id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < mark.length; i += 2) {
    if (p.get(mark[i], mark[i + 1]) === PAL.ink) continue;
    p.set(mark[i], mark[i + 1], o.gather ? PAL.gold4 : PAL.gold3);
  }
  for (let i = 0; i < debris.length; i += 3) if (!p.isOpaque(debris[i], debris[i + 1])) p.rect(debris[i], debris[i + 1], 1, 1, debris[i + 2]);
}

// ---------------------------------------------------------------- draw

export function drawJester(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };
  if (o.hide > 0) {
    floorLight(f);
    tickLight(f);
    return;
  }

  drawSpring(f);
  drawHorn(f, false);
  drawArm(f, false);
  if (o.cmode === 1) drawCoin(f, Part.coinF);
  drawLeg(f, false);
  drawKey(f);
  drawLeg(f, true);
  drawTorso(f);
  drawRuff(f);
  drawHead(f);
  drawHorn(f, true);
  drawArm(f, true);
  if (o.cmode === 0 || o.cmode === 2) drawCoin(f, Part.coin);
  drawDebris(f);
  if (o.shake !== 0) {
    // 1-px tremble: the dial and the points jump (whole px)
    const dy = o.shake > 0 ? -1 : 1;
    const src = p.clone();
    const ids = [Part.head, Part.hornF, Part.hornB];
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) if (ids.includes(comp.id[y * W + x])) p.erase(x, y);
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++)
        if (ids.includes(comp.id[y * W + x])) {
          const c = src.get(x, y);
          if (c !== null) p.set(x, y + dy, c);
        }
  }

  cleanCrumbs(p, (c, x, y) => {
    const id = comp.id[y * W + x];
    return id === Part.head || id === Part.coin || id === Part.coinF || id === Part.debris || c === GOLD.H;
  });
  p.outline(PAL.ink);
  dissolvePass(f);

  floorLight(f);
  if (o.diss < 0.7 || o.gather) {
    eyeLight(f);
    glintLight(f);
  }
  tickLight(f);
  keyLight(f);
  blazeLight(f);
  arcLight(f);
  flareLight(f);
  sparkLight(f);
}
