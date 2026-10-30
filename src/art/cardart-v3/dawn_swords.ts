// Şafak Kılıçları (dawn_swords) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// A ring of tall blades planted point-down in dusk-blue ground, a half-sunk dawn behind them and pillars of
// light rising between the blades. No characters. The picture of the continuous spell that locks the foe's
// attacks for three turns: the sword circle IS the lock.
//   backdrop  a spell recipe in dawn colours (custom BackdropRecipe, shape 'sun'): night1 / night2 sky, a stepped
//             gold sun half-sunk at the horizon (gold1 / gold2 / gold3), a night2 dusk floor with a gold2 horizon
//             line; two flat night0 ridges at the horizon edges; the blades' ring as two thin gold arcs on the
//             floor. Backdrop ≤ 6 tones.
//   subject   five blades (matter, ink outlined, one at a time back → front so a front outline covers the back):
//             lit left edge white, mist plane, steel plane, one continuous gold2 rim on the shadow side (the dawn
//             behind them, IŞ-7), gold guard, wrapped grip, round pommel. The far two are one ramp step darker
//             (backlit), the near three full value; the blades are the lightest wide shapes of the picture.
//   light     never outlined: the light pillars between the blades (6 / 4 / 2-px stepped taper, painted only where
//             no blade stands: they rise BEHIND the steel), a teal3 gem in each guard (the spell's colour), one
//             glint sliding down each blade, rising motes and the stars.
// Small (44×34): the same picture drawn again at 1× density (KART_RESIMLERI §1 (2)): 3-px blades, 1-px glints,
// pillars two tiers wide, the same ring, the same sun; hand-corrected where the halved geometry lied.
// Living art: 4 frames × 150 ms, palette only, ≤ 2 px motion: the pillar tops breathe, the sun core pulses
// gold3 ↔ gold4, glints and motes climb, one star twinkles.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rampStep, rim, type BackdropRecipe } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';

/** The picture's focus (the sun's core) in BIG px. */
const FOCUS = [44, 36] as const;

const DAWN: BackdropRecipe = {
  kind: 'SPELL',
  shape: 'sun',
  tones: [PAL.gold1, PAL.gold2, PAL.gold3],
  sky: [PAL.night1, PAL.night2],
  split: 22,
  floor: PAL.night2,
  horizonLine: PAL.gold2,
  rim: PAL.gold2,
};

// ---------------------------------------------------------------- geometry (per size, own pixels)

interface Tier {
  /** blade length (rows) / width (cols) / guard width / grip rows */
  readonly len: number;
  readonly w: number;
  readonly gw: number;
  readonly grip: number;
  /** one ramp step darker (the far blades, backlit) */
  readonly far: boolean;
}

interface Cfg {
  readonly hz: number;
  readonly sun: readonly [number, number, number];
  /** blades back → front: centre x, tip y, tier */
  readonly blades: readonly (readonly [number, number, keyof Cfg['tiers']])[];
  readonly tiers: { readonly far: Tier; readonly mid: Tier; readonly near: Tier };
  /** pillars: centre x, base y, height */
  readonly pillars: readonly (readonly [number, number, number])[];
  readonly ring: readonly [number, number, number, number];
  readonly pw: readonly [number, number];
}

const CFG: Readonly<Record<Size, Cfg>> = {
  big: {
    hz: 40,
    sun: [44, 36, 26],
    tiers: {
      far: { len: 20, w: 4, gw: 10, grip: 4, far: true },
      mid: { len: 24, w: 6, gw: 12, grip: 5, far: false },
      near: { len: 30, w: 6, gw: 16, grip: 6, far: false },
    },
    // five blades on an ellipse (44, 53) 34 × 7: the hero at the front, two pairs behind it
    blades: [
      [24, 47, 'far'],
      [64, 47, 'far'],
      [11, 55, 'mid'],
      [77, 55, 'mid'],
      [44, 60, 'near'],
    ],
    pillars: [
      [17, 52, 38],
      [34, 54, 46],
      [54, 54, 46],
      [71, 52, 38],
    ],
    ring: [44, 53, 34, 7],
    pw: [6, 4],
  },
  small: {
    hz: 20,
    sun: [22, 18, 13],
    tiers: {
      far: { len: 9, w: 3, gw: 5, grip: 2, far: true },
      mid: { len: 10, w: 3, gw: 7, grip: 2, far: false },
      near: { len: 12, w: 3, gw: 7, grip: 3, far: false },
    },
    blades: [
      [12, 23, 'far'],
      [32, 23, 'far'],
      [5, 27, 'mid'],
      [39, 27, 'mid'],
      [22, 30, 'near'],
    ],
    pillars: [
      [9, 25, 15],
      [17, 27, 17],
      [27, 27, 17],
      [35, 25, 15],
    ],
    ring: [22, 26, 17, 3],
    pw: [3, 1],
  },
};

// ---------------------------------------------------------------- blades

/** The planes of a blade's width, left (lit) → right (shadow); the rim recolours the last column afterwards. */
function planes(w: number, big: boolean): readonly number[] {
  if (big) {
    if (w >= 6) return [PAL.white, PAL.mist, PAL.mist, PAL.steel, PAL.steel, PAL.night4];
    if (w === 4) return [PAL.white, PAL.mist, PAL.steel, PAL.night4];
    return [PAL.mist, PAL.steel];
  }
  if (w >= 3) return [PAL.mist, PAL.steel, PAL.night4];
  return [PAL.mist];
}

/** One blade, point down at (cx, tip), ink outlined, on its own canvas. */
function blade(size: Size, cx: number, tip: number, t: Tier): PixelCanvas {
  const big = size === 'big';
  const p = new PixelCanvas(big ? 88 : 44, big ? 68 : 34);
  const dark = (c: number) => (t.far ? rampStep(c, -1) : c);
  // the blade: a long taper at the point (big: 2-2-4-4 then full; small: 1-1 then full)
  const taper = big ? [2, 2, 4, 4] : [1, 1];
  for (let r = 0; r < t.len; r++) {
    const w = r < taper.length ? taper[r] : t.w;
    const x0 = big ? cx - w / 2 : cx - (w - 1) / 2;
    const pl = planes(w, big);
    for (let i = 0; i < w; i++) p.set(x0 + i, tip - r, dark(pl[Math.min(i, pl.length - 1)]));
  }
  // the fuller: a 1-px steel groove down the lit side of a wide blade
  if (t.w >= 6) for (let r = 6; r < t.len - 2; r++) p.set(cx - 1, tip - r, dark(PAL.steel));
  rim(p, PAL.gold2);
  // guard, grip, pommel (above the blade)
  const top = tip - t.len; // the first row above the blade
  const gy = top - (big ? 1 : 0);
  const gw = t.gw;
  const gx = big ? cx - gw / 2 : cx - (gw - 1) / 2;
  if (big) {
    p.hline(gx, gx + gw - 1, gy, PAL.gold3);
    p.set(gx, gy, PAL.gold4);
    p.hline(gx, gx + gw - 1, gy - 1, PAL.gold2);
    p.set(gx, gy - 1, PAL.gold3);
    p.set(gx + gw - 1, gy - 1, PAL.gold1);
    for (let r = 0; r < t.grip; r++) p.hline(cx - 1, cx, gy - 2 - r, r % 2 ? PAL.gold0 : PAL.gold1);
    const py = gy - 2 - t.grip;
    p.hline(cx - 1, cx, py, PAL.gold3);
    p.hline(cx - 2, cx + 1, py - 1, PAL.gold3);
    p.set(cx - 2, py - 1, PAL.gold4);
    p.hline(cx - 1, cx, py - 2, PAL.gold2);
  } else {
    p.hline(gx, gx + gw - 1, gy, PAL.gold3);
    p.set(gx, gy, PAL.gold4);
    p.set(gx + gw - 1, gy, PAL.gold2);
    for (let r = 0; r < t.grip; r++) p.set(cx, gy - 1 - r, r % 2 ? PAL.gold0 : PAL.gold1);
    const py = gy - 1 - t.grip;
    p.hline(cx - 1, cx, py, PAL.gold3);
    p.hline(cx - 1, cx, py - 1, PAL.gold2);
  }
  if (t.far) {
    // the far blades' gold takes the same step down (they stand against the sun)
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const c = p.get(x, y);
        if (c !== null && (c === PAL.gold4 || c === PAL.gold3)) p.set(x, y, rampStep(c, -1));
      }
  }
  return ink(p);
}

/** Top row of the pommel (for the gem / glint placement): guard y and blade rows of one blade. */
function bladeRows(size: Size, tip: number, t: Tier): { guardY: number; bladeTop: number } {
  const big = size === 'big';
  const top = tip - t.len;
  return { guardY: top - (big ? 1 : 0), bladeTop: tip - t.len + 1 };
}

// ---------------------------------------------------------------- light

function pillar(l: ArtLayers, mask: PixelCanvas, size: Size, cx: number, base: number, h: number): void {
  const big = size === 'big';
  const L = l.light;
  const at = (x: number, y: number, c: number) => {
    if (mask.get(x, y) === null) L.set(x, y, c);
  };
  for (let r = 0; r < h; r++) {
    const y = base - r;
    const f = r / h;
    // a beam, not a column: 4 px wide below, 2 px on top; the core steps down gold3 → gold2 → gold1 with height
    const core = f < 0.35 ? PAL.gold3 : f < 0.7 ? PAL.gold2 : PAL.gold1;
    if (big) {
      if (f < 0.25) {
        at(cx - 3, y, PAL.gold1);
        at(cx - 2, y, PAL.gold2);
        at(cx - 1, y, core);
        at(cx, y, core);
        at(cx + 1, y, PAL.gold2);
        at(cx + 2, y, PAL.gold1);
      } else if (f < 0.7) {
        at(cx - 2, y, PAL.gold1);
        at(cx - 1, y, core);
        at(cx, y, core);
        at(cx + 1, y, PAL.gold1);
      } else {
        at(cx - 1, y, core);
        at(cx, y, core);
      }
    } else if (f < 0.6) {
      at(cx - 1, y, PAL.gold1);
      at(cx, y, f < 0.3 ? PAL.gold3 : PAL.gold2);
      at(cx + 1, y, PAL.gold1);
    } else at(cx, y, PAL.gold2);
  }
  // the landing: where the light meets the floor
  if (big) {
    for (let x = cx - 5; x <= cx + 4; x++) at(x, base + 1, PAL.gold2);
    for (let x = cx - 3; x <= cx + 2; x++) at(x, base + 2, PAL.gold1);
  } else for (let x = cx - 2; x <= cx + 2; x++) at(x, base + 1, PAL.gold1);
}

// ---------------------------------------------------------------- painters

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const [fx, fy] = FOCUS;
  // 1. backdrop: dawn recipe, the sun's core pulses
  const recipe: BackdropRecipe = f % 4 >= 2 ? { ...DAWN, tones: [PAL.gold1, PAL.gold2, PAL.gold4] } : DAWN;
  paintBackdrop(l.backdrop, recipe, { focus: [fx, fy], horizon: 40, radius: 26 });
  // two low ridges at the horizon edges (flat night0 steps, behind the floor line)
  const hz = C.hz;
  const ridge = big
    ? [
        [0, 10, 4],
        [10, 20, 2],
        [68, 78, 2],
        [78, 88, 4],
      ]
    : [
        [0, 5, 2],
        [5, 10, 1],
        [34, 39, 1],
        [39, 44, 2],
      ];
  for (const [x0, x1, h] of ridge) l.backdrop.rect(x0, hz - h, x1 - x0, h, PAL.night0);
  // the ring on the floor: gold1 arc, the lit gold2 front
  const [rx, ry, rrx, rry] = C.ring;
  l.backdrop.ellipseRing(rx + 0.5, ry + 0.5, rrx, rry, PAL.gold1);
  if (big) l.backdrop.ellipseRing(rx + 0.5, ry + 0.5, rrx - 6, rry - 2, PAL.gold1);
  // 2. the blades, back to front
  const tips: { x: number; tip: number; t: Tier }[] = [];
  for (const [x, tip, k] of C.blades) {
    const t = C.tiers[k];
    l.subject.blit(blade(size, x, tip, t), 0, 0);
    tips.push({ x, tip, t });
  }
  // 3. light: pillars behind the steel, gems, glints, motes, stars
  const breathe = [0, -1, 0, 1][f % 4];
  C.pillars.forEach(([x, y, h], i) => pillar(l, l.subject, size, x, y, h + (i % 2 ? -breathe : breathe) * (big ? 2 : 1)));
  tips.forEach(({ x, tip, t }, i) => {
    const { guardY, bladeTop } = bladeRows(size, tip, t);
    // the gem: the spell's teal in the guard's centre
    if (big) {
      l.light.set(x - 1, guardY - 1, PAL.teal3);
      l.light.set(x, guardY - 1, PAL.teal4);
    } else l.light.set(x, guardY, PAL.teal3);
    // one glint sliding down each blade
    const span = t.len - 4;
    const gy = bladeTop + ((f * 3 + i * 4) % Math.max(1, span));
    const gx = big ? x - 3 : x - 1;
    if (gy < tip - 3) l.light.set(gx, gy, PAL.white);
  });
  // motes climbing the pillars
  const motes: readonly (readonly [number, number])[] = big
    ? [
        [28, 36],
        [60, 38],
        [18, 34],
        [70, 33],
        [44, 48],
      ]
    : [
        [14, 15],
        [30, 16],
        [9, 14],
        [35, 13],
      ];
  motes.forEach(([x, y], i) => {
    const up = ((f + i) % 4) * (big ? 2 : 1);
    if (l.subject.get(x + 4, y - up) === null) l.light.set(x + 4, y - up, i % 2 ? PAL.gold4 : PAL.gold3);
  });
  // stars (hand placed, one twinkles)
  const stars: readonly (readonly [number, number])[] = big
    ? [
        [8, 6],
        [24, 11],
        [60, 5],
        [78, 12],
        [44, 4],
      ]
    : [
        [4, 3],
        [11, 5],
        [30, 2],
        [39, 6],
      ];
  stars.forEach(([x, y], i) => {
    if (i === 1 + (f % 2) && f >= 2) return;
    l.backdrop.set(x, y, i % 2 ? PAL.mist : PAL.white);
  });
}

const art: CardArtV3 = {
  id: 'dawn_swords',
  focus: FOCUS,
  frames: 4,
  holdMs: 150,
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paint('small', l, f),
};

export default art;
