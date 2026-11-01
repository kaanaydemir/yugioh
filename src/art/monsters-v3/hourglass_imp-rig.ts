// Kum Saati Cücesi v3 — the rig: Pose → pixels (docs/v3/oturum-f/hourglass_imp.md §2–§3, §0.9 rev. 1).
//
// "Kum Cücesi": a stubby desert imp whose head is as big as his torso — a big round nose, one long pointed ear swept
// back, two gold pin-point eyes — under ONE soft maroon felt cone that flops backward and ends in a sand tassel (no
// jester points: C2 dial_jester owns those). A short indigo night-coat with a brass buckle, flat wrapped desert sandals
// (no curled toes). He stands beside an hourglass TALLER than his body (./hourglass_imp-glass.ts), his near arm round
// it, cheek to its upper bulb: a vertical X standing on the floor at his side (C2 holds a disc in front of himself).
//
//   - the imp is posed parts (feet, coat, far / near arm, head, ear, hat) shaded with flat bands toward the key light;
//   - ONE key light: 'left' (P1) or 'right' (P2 relight); the silhouette never depends on it;
//   - the light (eyes, the sand stream, the landing grain, the jet, the summon pour, the death ribbon, the hitMagic
//     sparks) is painted after the outline and never outlined.
// Frame 60×64; the anchor (AX, GY) is the ground point between his feet.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import { BRASS, COAT, COAT_FAR, Comp, FELT, SKIN, SKIN_FAR, TO_SAND, WOOD, bands, type Tones } from './hourglass_imp-kit';
import { GLASS0, glassPoints, paintGlass, type GlassPose } from './hourglass_imp-glass';

export const W = 60;
export const H = 64;
export const AX = 24;
export const GY = 60;

type Pt = readonly [number, number];
const rnd = Math.round;

const enum Part {
  none = 0,
  armF,
  footF,
  footN,
  coat,
  head,
  hat,
  glass,
  armN,
  fx,
}

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole-body offset (coat, head, arms; not the feet) and the crouch (body sinks, feet stay) */
  bx: number;
  by: number;
  crouch: number;
  /** chest breath (shoulders, arms, head) and forward lean of the upper body (px) */
  cy: number;
  lean: number;
  /** head offset relative to the chest */
  hx: number;
  hy: number;
  /** eyes: 0 open · 1 closed (blink) · 2 squeezed · 3 wide · 4 squint (one shut, aiming) · 5 hidden (hat over them) */
  eye: number;
  /** mouth: 0 smile · 1 big grin · 2 "o" · 3 flat · 4 gritted */
  mouth: number;
  /** ear: 0 rest · 1 twitch (tip up 1) · 2 straight up (alarm) · 3 drooped */
  ear: number;
  /** the anim's one twinkle: a skin4 glint on the nose */
  glint: number;
  /** hat: 0 on the head · 1 slid over the eyes · 2 pushed back · 3 off (drawn at hax, hay, angle hang) */
  hat: number;
  hax: number;
  hay: number;
  hang: number;
  /** hat-tip lag (px) */
  tx: number;
  ty: number;
  /** hands (frame coords) and grips: 0 palm · 1 fist · 2 one finger up · 3 hidden */
  nhx: number;
  nhy: number;
  ngrip: number;
  fhx: number;
  fhy: number;
  fgrip: number;
  /** feet: x shifts and lifts (near, far) */
  nfx: number;
  nfl: number;
  ffx: number;
  ffl: number;
  /** 1 the imp is drawn, 0 not (the glass alone) */
  body: number;
  /** rows sandTop…sandBot of the imp are dry sand (summon sculpt, death drying) */
  sandTop: number;
  sandBot: number;
  /** summon: the sand cone instead of the body (height px; 0 none) and a heap at the feet (px; 0 none) */
  cone: number;
  heap: number;
  /** summon: the pour from above lands at x (0 none) */
  pour: number;
  /** death: the body runs into the glass as a ribbon (0 none, 1…3 its stage) */
  ribbon: number;
  /** the hourglass */
  g: GlassPose;
  /** 0 the glass is hidden (summon before the catch) */
  gShow: number;
  /** 1: the glass is drawn in front of the near arm too (guard: he hides behind it) */
  gFront: number;
  /** fx: dust puffs at the glass foot (size), hitMagic spark ticks on the hat (phase), sneeze puff (size) */
  puff: number;
  spark: number;
  sneeze: number;
  /** grains shaken off the body (hitHeavy / blocked), phase (0 none) */
  grains: number;
}

export const NEUTRAL: Pose = {
  bx: 0, by: 0, crouch: 0, cy: 0, lean: 0, hx: 0, hy: 0, eye: 0, mouth: 0, ear: 0, glint: 0,
  hat: 0, hax: 0, hay: 0, hang: 0, tx: 0, ty: 0,
  nhx: 31, nhy: 50, ngrip: 0, fhx: 15, fhy: 53, fgrip: 1,
  nfx: 0, nfl: 0, ffx: 0, ffl: 0,
  body: 1, sandTop: 99, sandBot: -1, cone: 0, heap: 0, pour: 0, ribbon: 0,
  g: GLASS0, gShow: 1, gFront: 0, puff: 0, spark: 0, sneeze: 0, grains: 0,
};

export const pose = (o: Partial<Pose>, g: Partial<GlassPose> = {}): Pose => ({ ...NEUTRAL, ...o, g: { ...GLASS0, ...(o.g ?? {}), ...g } });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  /** shoulder line y, hem y */
  sy: number;
  hem: number;
  /** head centre */
  Hc: Pt;
  Sn: Pt;
  Sf: Pt;
  elN: Pt;
  elF: Pt;
  wN: Pt;
  wF: Pt;
  footN: Pt;
  footF: Pt;
  /** hat brim anchor (on the head) */
  brim: Pt;
}

const UPPER = 4.6;
const FORE = 4.4;

function reach(S: Pt, T: Pt, bend: number): { el: Pt; w: Pt } {
  const el = ik2(S as [number, number], T as [number, number], UPPER, FORE, bend) as Pt;
  const dx = T[0] - el[0];
  const dy = T[1] - el[1];
  const l = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, FORE / l);
  return { el, w: [el[0] + dx * k, el[1] + dy * k] };
}

export function skeleton(o: Pose): Skel {
  const down = o.by + o.crouch;
  const sy = 46 + down + o.cy;
  const hem = 56 + o.by + Math.min(o.crouch, 2);
  const Hc: Pt = [21 + o.bx + o.lean + o.hx, 41 + down + o.cy + o.hy];
  const Sn: Pt = [24 + o.bx + o.lean * 0.6, sy + 1.5];
  const Sf: Pt = [17.5 + o.bx + o.lean * 0.6, sy + 1.5];
  const n = reach(Sn, [o.nhx, o.nhy], o.nhy > Sn[1] + 2 ? 1 : -1);
  const f = reach(Sf, [o.fhx, o.fhy], o.fhy > Sf[1] + 2 ? 1 : -1);
  return {
    sy, hem, Hc, Sn, Sf, elN: n.el, wN: n.w, elF: f.el, wF: f.w,
    footN: [24 + o.nfx, GY - o.nfl], footF: [17 + o.ffx, GY - o.ffl],
    brim: [Hc[0] - 0.5, Hc[1] - 5.2],
  };
}

// ---------------------------------------------------------------- parts

const layer = () => new PixelCanvas(W, H);

function drawFoot(cp: Comp, sk: Skel, near: boolean, light: Light): void {
  const [fx, fy] = near ? sk.footN : sk.footF;
  const t: Tones = near ? SKIN : SKIN_FAR;
  const q = layer();
  // the stubby foot (toes forward), flat sole
  q.poly([[fx - 3, fy - 2], [fx + 1, fy - 3], [fx + 4, fy - 1], [fx + 4, fy + 1], [fx - 3, fy + 1]], t.M);
  // the short leg into the coat
  q.rect(fx - 2, fy - 5, 3, 3, near ? COAT.S : COAT_FAR.S);
  bands(q, t, light, 1, 1);
  cp.add(q, near ? Part.footN : Part.footF, { out: near ? PAL.skin1 : PAL.earth0 });
  // the sandal: a flat earth1 sole, two wrapped thongs over the instep (earth2), no curled toe
  const s = layer();
  s.hline(fx - 3, fx + 4, fy, WOOD.M);
  s.set(fx - 1, fy - 1, WOOD.L).set(fx - 1, fy - 2, WOOD.L).set(fx + 2, fy - 1, WOOD.L);
  s.set(fx - 2, fy - 3, WOOD.M).set(fx - 1, fy - 3, WOOD.L).set(fx, fy - 3, WOOD.M);
  cp.add(s, near ? Part.footN : Part.footF, {});
}

function drawArm(cp: Comp, sk: Skel, o: Pose, light: Light, near: boolean): void {
  const S = near ? sk.Sn : sk.Sf;
  const el = near ? sk.elN : sk.elF;
  const w = near ? sk.wN : sk.wF;
  const grip = near ? o.ngrip : o.fgrip;
  const t = near ? COAT : COAT_FAR;
  const q = layer();
  q.thickLine(S[0], S[1], el[0], el[1], 3.2, t.M);
  q.thickLine(el[0], el[1], w[0], w[1], 2.8, t.M);
  q.disc(S[0], S[1], 1.8, t.M);
  bands(q, t, light, 1, 1);
  cp.add(q, near ? Part.armN : Part.armF, { out: near ? PAL.night1 : undefined });
  if (grip === 3) return;
  const s = near ? SKIN : SKIN_FAR;
  const h = layer();
  const dx = w[0] - el[0];
  const dy = w[1] - el[1];
  const l = Math.hypot(dx, dy) || 1;
  const hx = w[0] + (dx / l) * 1.2;
  const hy = w[1] + (dy / l) * 1.2;
  h.disc(hx, hy, grip === 0 ? 1.9 : 1.6, s.M);
  if (grip === 2) h.thickLine(hx, hy, hx + (dx / l) * 0.5, hy - 3, 1, s.M); // one finger up
  if (grip === 0) h.rect(rnd(hx + (dx / l) * 1.5) - 1, rnd(hy) - 1, 2, 3, s.M); // fingers splayed on the glass
  bands(h, s, light, 1, 1);
  cp.add(h, near ? Part.armN : Part.armF, { out: near ? PAL.skin1 : undefined });
}

function drawCoat(cp: Comp, sk: Skel, o: Pose, light: Light): void {
  const x0 = o.bx;
  const top = sk.sy;
  const hem = sk.hem;
  const l = o.lean * 0.6;
  const q = layer();
  q.poly([
    [16.5 + x0 + l, top + 1], [19 + x0 + l, top], [24 + x0 + l, top], [26.5 + x0 + l, top + 2],
    [27.5 + x0, hem - 3], [28.5 + x0, hem + 1], [14 + x0, hem + 1], [15 + x0, hem - 4],
  ], COAT.M);
  bands(q, COAT, light, 2, 2);
  // the coat's front edge (a 1-px darker fold), the belt + brass buckle
  const belt = rnd(top + (hem - top) * 0.55);
  for (let x = 13; x <= 30; x++) if (q.isOpaque(x + x0, belt)) q.set(x + x0, belt, PAL.earth1);
  q.rect(rnd(23 + x0 + l * 0.5), belt - 1, 2, 3, PAL.gold2).set(rnd(24 + x0 + l * 0.5), belt, PAL.gold1);
  for (let y = belt + 1; y <= hem; y++) {
    const x = rnd(25 + x0 + (y - belt) * 0.3);
    if (q.isOpaque(x, y)) q.set(x, y, COAT.S);
  }
  // hem: a lighter turned-up band
  for (let x = 13 + x0; x <= 30 + x0; x++) if (q.isOpaque(x, hem) && q.isOpaque(x, hem - 1)) q.set(x, hem, light.side < 0 ? (x < 22 + x0 ? COAT.L : COAT.M) : x > 20 + x0 ? COAT.L : COAT.M);
  cp.add(q, Part.coat, { out: PAL.night1 });
}

function drawHead(cp: Comp, sk: Skel, o: Pose, light: Light): void {
  const [hx, hy] = sk.Hc;
  const q = layer();
  q.disc(hx, hy, 5.5, SKIN.M);
  // chubby cheek + jaw forward
  q.poly([[hx - 3, hy + 2], [hx + 4.5, hy + 1], [hx + 5, hy + 4], [hx + 2, hy + 5.6], [hx - 2, hy + 5]], SKIN.M);
  bands(q, SKIN, light, 2, 2);
  // the big round nose
  const nz = layer();
  nz.disc(hx + 5.6, hy + 1.2, 2, SKIN.M);
  bands(nz, SKIN, light, 1, 1);
  if (o.glint) nz.set(rnd(hx + 5.6) - 1, rnd(hy + 1.2) - 1, PAL.skin4);
  // mouth
  const mx = rnd(hx + 2);
  const my = rnd(hy + 3.6);
  if (o.mouth === 0) q.hline(mx, mx + 2, my, PAL.skin1).set(mx + 3, my - 1, PAL.skin1);
  else if (o.mouth === 1) q.hline(mx - 1, mx + 2, my, PAL.earth0).hline(mx, mx + 2, my + 1, PAL.skin4).set(mx + 3, my - 1, PAL.earth0);
  else if (o.mouth === 2) q.rect(mx + 1, my, 2, 2, PAL.earth0);
  else if (o.mouth === 3) q.hline(mx, mx + 2, my, PAL.skin1);
  else q.hline(mx - 1, mx + 2, my, PAL.skin4).hline(mx - 1, mx + 2, my + 1, PAL.earth0);
  // brows (skin1) over the eyes, tilted by the expression
  const ey = rnd(hy - 1.5);
  const e0 = rnd(hx + 1);
  const e1 = rnd(hx + 4);
  if (o.eye !== 5) {
    const bl = o.eye === 3 ? -1 : o.eye === 2 || o.eye === 4 ? 1 : 0;
    q.hline(e0 - 1, e0, ey - 2 + bl, PAL.earth0).hline(e1, e1 + 1, ey - 2 + (o.eye === 4 ? 0 : bl), PAL.earth0);
    if (o.eye === 1 || o.eye === 2) {
      q.hline(e0 - (o.eye === 2 ? 1 : 0), e0, ey + 1, PAL.earth0).hline(e1, e1 + (o.eye === 2 ? 1 : 0), ey + 1, PAL.earth0);
    } else if (o.eye === 4) q.hline(e0 - 1, e0, ey + 1, PAL.earth0);
    // eye sockets (the gold dots are light)
    if (o.eye === 0 || o.eye === 3 || o.eye === 4) {
      if (o.eye !== 4) q.rect(e0 - 1, ey, 2, 2, PAL.earth0);
      q.rect(e1 - 1, ey, 2, 2, PAL.earth0);
      if (o.eye === 3) q.rect(e0 - 1, ey, 1, 2, PAL.earth0).rect(e1 + 1, ey, 1, 2, PAL.earth0);
    }
  }
  cp.add(q, Part.head, { out: PAL.skin1 });
  cp.add(nz, Part.head, { out: PAL.skin1 });
  // the long pointed ear, swept back (tip lags)
  const e = layer();
  const tip: Pt = o.ear === 2 ? [hx - 7, hy - 9] : o.ear === 3 ? [hx - 10, hy + 1] : [hx - 10, hy - 4 - (o.ear === 1 ? 1 : 0)];
  e.poly([[hx - 3.5, hy - 2], [hx - 2.5, hy + 2.2], tip], SKIN.M);
  bands(e, SKIN, light, 1, 1);
  e.line(rnd(hx - 3.5), rnd(hy), rnd((hx - 3.5 + tip[0] * 2) / 3), rnd((hy + tip[1] * 2) / 3), PAL.skin1);
  cp.add(e, Part.head, { out: PAL.skin1 });
}

/** The hat in its own frame: anchor = the brim's centre, `ang` its tilt (deg, + = back), tip lag (tx, ty). */
function hatShape(q: PixelCanvas, ax: number, ay: number, ang: number, tx: number, ty: number, light: Light): void {
  const r = (ang * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const P = (x: number, y: number): [number, number] => [ax + x * c + y * s, ay - x * s + y * c];
  const cone = layer();
  cone.poly([P(-7, 1.2), P(-6, -1), P(-3.5, -7), P(-1.5, -10), P(1, -9), P(3, -5), P(6.5, 0), P(6.5, 1.2)], FELT.M);
  // the flop: the cone's upper third bends back and down
  const tip = P(-8 + tx, -8 + ty);
  const mid = P(-3.5 + tx * 0.4, -11 + ty * 0.3);
  cone.thickLine(P(-0.5, -9.4)[0], P(-0.5, -9.4)[1], mid[0], mid[1], 3.4, FELT.M);
  cone.thickLine(mid[0], mid[1], tip[0], tip[1], 2.4, FELT.M);
  bands(cone, FELT, light, 2, 2);
  // the felt crease where it flops
  const k = P(-1.5, -8);
  cone.set(rnd(k[0]), rnd(k[1]), FELT.S);
  // the brass band: the two brim rows
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cone.isOpaque(x, y)) continue;
      const lx = (x + 0.5 - ax) * c - (y + 0.5 - ay) * s;
      const ly = (x + 0.5 - ax) * s + (y + 0.5 - ay) * c;
      if (ly > -1.1 && ly < 1.3 && lx > -7.5 && lx < 7) cone.set(x, y, (lx < 0) === light.side < 0 ? BRASS.L : BRASS.S);
    }
  q.blit(cone, 0, 0);
  // the sand tassel hanging from the tip
  const tx0 = rnd(tip[0]) - 1;
  const ty0 = rnd(tip[1]) + 1;
  q.rect(tx0, ty0, 2, 3, PAL.earth3).set(light.side < 0 ? tx0 : tx0 + 1, ty0, PAL.earth4).set(light.side < 0 ? tx0 : tx0 + 1, ty0 + 1, PAL.earth4);
}

function drawHat(cp: Comp, sk: Skel, o: Pose, light: Light): void {
  const q = layer();
  if (o.hat === 3) hatShape(q, o.hax, o.hay, o.hang, o.tx, o.ty, light);
  else {
    const [bx, by] = sk.brim;
    const dy = o.hat === 1 ? 3 : o.hat === 2 ? -1 : 0;
    const dx = o.hat === 1 ? 1 : o.hat === 2 ? -1.5 : 0;
    hatShape(q, bx + dx, by + dy, o.hat === 2 ? 14 + o.hang : o.hang, o.tx, o.ty, light);
  }
  cp.add(q, Part.hat, { out: PAL.fire0 });
}

// ---------------------------------------------------------------- frame

export function drawImp(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right' = 'left'): void {
  const light = lightOf(lightFrom);
  const cp = new Comp(p);
  const sk = skeleton(o);
  const glass = o.gShow ? paintGlass(W, H, o.g, light) : null;
  const lights: number[] = [];

  if (o.body) {
    drawArm(cp, sk, o, light, false);
    drawFoot(cp, sk, false, light);
    drawFoot(cp, sk, true, light);
    drawCoat(cp, sk, o, light);
    drawHead(cp, sk, o, light);
    if (o.hat !== 3) drawHat(cp, sk, o, light);
  }
  if (o.heap > 0) drawHeap(cp, o.heap, light);
  if (o.cone > 0) drawCone(cp, o.cone, light, lights);
  if (glass && !o.gFront) cp.add(glass.layer, Part.glass, {});
  if (o.body) drawArm(cp, sk, o, light, true);
  if (glass && o.gFront) cp.add(glass.layer, Part.glass, {});
  if (o.body && o.gFront && o.ngrip !== 3) {
    // his fingers curl round the glass's post in front
    const q = layer();
    q.rect(rnd(sk.wN[0]), rnd(sk.wN[1]) - 1, 2, 3, SKIN.M);
    bands(q, SKIN, light, 1, 1);
    cp.add(q, Part.armN, { out: PAL.skin1 });
  }
  if (o.hat === 3) drawHat(cp, sk, o, light);

  // dry sand: the imp's rows sandTop…sandBot turn to sand tones (the planes keep their value order)
  if (o.body && o.sandTop <= o.sandBot) {
    for (let y = Math.max(0, o.sandTop); y <= Math.min(H - 1, o.sandBot); y++)
      for (let x = 0; x < W; x++) {
        const id = cp.id[y * W + x];
        if (id === Part.none || id === Part.glass || id === Part.fx) continue;
        if (o.hat === 3 && id === Part.hat) continue;
        const c = p.get(x, y);
        const s = c === null ? undefined : TO_SAND.get(c);
        if (s !== undefined) p.set(x, y, s);
      }
  }
  // clip at the ground line
  for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) p.erase(x, y);

  p.outline(PAL.ink);

  // ---------------- light pass (never outlined)
  if (glass) for (let i = 0; i < glass.light.length; i += 3) setLight(p, glass.light[i], glass.light[i + 1], glass.light[i + 2], true);
  for (let i = 0; i < lights.length; i += 3) setLight(p, lights[i], lights[i + 1], lights[i + 2], false);
  if (o.body) eyes(p, sk, o);
  if (o.pour) pourLight(p, o);
  if (o.ribbon) ribbonLight(p, o, sk);
  if (o.spark) sparks(p, sk, o);
  if (o.puff) puffs(p, o);
  if (o.sneeze) sneeze(p, sk, o);
  if (o.grains) grains(p, sk, o);
}

function setLight(p: PixelCanvas, x: number, y: number, c: number, overInk: boolean): void {
  if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
  if (!overInk && p.get(x, y) === PAL.ink) return;
  p.set(x, y, c);
}

function eyes(p: PixelCanvas, sk: Skel, o: Pose): void {
  if (o.eye === 1 || o.eye === 2 || o.eye === 5) return;
  if (o.sandTop <= sk.Hc[1] && o.sandBot >= sk.Hc[1] - 2) return; // dried: no light in them
  const ey = rnd(sk.Hc[1] - 1.5);
  const e0 = rnd(sk.Hc[0] + 1);
  const e1 = rnd(sk.Hc[0] + 4);
  if (o.eye !== 4) p.rect(e0, ey, 1, 2, PAL.gold4);
  p.rect(e1, ey, 1, 2, PAL.gold4);
}

/** Summon: the sand cone the body is sculpted from (earth3 / earth4 planes, a gold3 crest). */
function drawCone(cp: Comp, h: number, light: Light, lights: number[]): void {
  const q = layer();
  const apex = GY - h;
  const hw = Math.min(10, 2 + h * 0.42);
  q.poly([[AX - 3 - hw, GY + 1], [AX - 3 - 1.2, apex], [AX - 3 + 1.2, apex], [AX - 3 + hw + 1, GY + 1]], PAL.earth3);
  bands(q, { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2 }, light, 2, 2);
  cp.add(q, Part.fx, {});
  lights.push(AX - 4, apex, PAL.gold3, AX - 3, apex, PAL.gold3);
}

/** A low heap of sand round his feet (summon sculpt). */
function drawHeap(cp: Comp, h: number, light: Light): void {
  const q = layer();
  q.poly([[AX - 14, GY + 1], [AX - 8, GY - h + 1], [AX - 1, GY - h], [AX + 5, GY - h + 2], [AX + 7, GY + 1]], PAL.earth3);
  bands(q, { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2 }, light, 2, 1);
  cp.add(q, Part.fx, {});
}

/** Summon: the glowing pour from above onto the cone's crest (2-px column, gold4 head). */
function pourLight(p: PixelCanvas, o: Pose): void {
  const x = AX - 4;
  const apex = o.cone > 0 ? GY - o.cone : rnd(o.pour);
  for (let y = 2; y < apex; y++) {
    const head = y >= apex - 2;
    const gap = (y + o.g.ph) % 6 === 5;
    if (gap && !head) continue;
    p.set(x, y, head ? PAL.gold4 : PAL.gold3);
    if (!head) p.set(x + 1, y, (y + o.g.ph) % 3 === 0 ? PAL.gold4 : PAL.gold3);
  }
  // a grain flicked off the column's side
  const fy = 10 + ((o.g.ph * 7) % 30);
  if (fy < apex - 3) p.set(x + ((o.g.ph % 2) ? 3 : -2), fy, PAL.gold3);
}

/** Death: his sand runs into the top cap as a curling ribbon (stage 1…3). */
function ribbonLight(p: PixelCanvas, o: Pose, sk: Skel): void {
  const cap = glassPoints(o.g).muzzle;
  const from: Pt = [sk.Hc[0], sk.Hc[1] + 6 + o.ribbon * 2];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (o.ribbon === 3 && t < 0.55) continue;
    if (o.ribbon === 2 && t < 0.2) continue;
    const mx = (from[0] + cap[0]) / 2 - 2;
    const my = Math.min(from[1], cap[1]) - 10;
    const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * mx + t * t * cap[0];
    const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * my + t * t * cap[1];
    const c = i === n ? PAL.gold4 : PAL.gold3;
    setLight(p, rnd(x), rnd(y), c, true);
    if (i % 3 !== 2) setLight(p, rnd(x), rnd(y) + 1, i % 2 ? PAL.gold3 : PAL.earth4, true);
  }
}

/** hitMagic: two 2-px gold4 spark ticks on the hat cone. */
function sparks(p: PixelCanvas, sk: Skel, o: Pose): void {
  const [bx, by] = sk.brim;
  const k = o.spark % 2;
  const a: Pt = k ? [bx - 4, by - 7] : [bx + 3, by - 5];
  const b: Pt = k ? [bx + 1, by - 10] : [bx - 6, by - 3];
  for (const [x, y] of [a, b]) {
    setLight(p, rnd(x), rnd(y), PAL.gold4, true);
    setLight(p, rnd(x) + 1, rnd(y) - 1, PAL.gold3, true);
  }
}

/** Dust puffs either side of the glass's foot (the plant). */
function puffs(p: PixelCanvas, o: Pose): void {
  const b = glassPoints(o.g).base;
  const n = o.puff;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 1 + n; i++) {
      const x = rnd(b[0] + side * (9 + i * 2));
      const y = GY - (i % 2) - (n > 1 && i === 1 ? 1 : 0);
      if (x > 2 && x < W - 2 && !p.isOpaque(x, y)) p.set(x, y, i % 2 ? PAL.earth3 : PAL.earth4);
    }
  }
}

/** Revive: the sneeze — a puff of sand out of the nose. */
function sneeze(p: PixelCanvas, sk: Skel, o: Pose): void {
  const x0 = rnd(sk.Hc[0] + 8);
  const y0 = rnd(sk.Hc[1] + 1);
  for (let i = 0; i < 2 + o.sneeze; i++) {
    const x = x0 + i;
    const y = y0 + ((i * 3) % 3) - 1;
    if (!p.isOpaque(x, y) && x < W - 2) p.set(x, y, i % 2 ? PAL.earth3 : PAL.earth4);
  }
}

/** A few grains shaken off (hitHeavy stagger): whole pixels falling beside him. */
function grains(p: PixelCanvas, sk: Skel, o: Pose): void {
  const x0 = rnd(sk.Hc[0] - 6);
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * 3;
    const y = rnd(sk.Hc[1] + 2 + o.grains * 3 + i * 2);
    if (y < GY && !p.isOpaque(x, y)) p.set(x, y, PAL.earth4);
  }
}

/** Points for the anims. */
export function rigPoints(o: Pose): { muzzle: Pt; neck: Pt; head: Pt; core: Pt; hand: Pt; grip: Pt } {
  const sk = skeleton(o);
  const gp = glassPoints(o.g);
  return { muzzle: gp.muzzle, neck: gp.neck, head: sk.Hc, core: [sk.Hc[0] + 1, sk.Hc[1] + 8], hand: sk.wN, grip: sk.wF };
}
