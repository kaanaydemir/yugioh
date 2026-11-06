// Kutup Hükümdarı — v3 cut-in portrait (200×144, faces right; ?look=v3 only), painted at the cut-in's own density
// (3× the sprite's: every band, rivet and turn is drawn at this density, never the sprite enlarged).
//
// The bust of the fused sovereign, every piece readable: the coil's copper drum as the chest (wound turns, the
// two-colour core window — N fire left, S water right), its magnetite top flange as the collar, the helm with the
// needle's visor point and the two eyes (fire behind, water forward), the spindle pin rising to the compass-rose
// CROWN spinning over it, the needle pauldrons spread wide (fire point at the back shoulder, water at the front),
// and the giant compass SPEAR across the front shoulder, its fire point high at the top right. The band behind is
// split orange / blue (accent / accentDark). One key light from the frame's top-left, flat value planes, 1-px ink
// outline, light (eyes, core, pole tips, crown points) painted after the outline. P2 sees a RELIT set.
//
// Rhythm (holds, played once, last frame held) — the field wakes:
//   f0 dark eyes, the core a dim ember, the crown still · f1 the fire eye lights (click) · f2 the water eye answers,
//   the crown turns · f3 the core seam goes white, the spear's fire point flares · f4 full blaze, crown turning ·
//   f5 held

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import { bands, needle, type Pt, type Tones } from '../monsters-v3/polar_needle-kit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;

interface P {
  eyeN: number;
  eyeS: number;
  core: number;
  crown: number;
  tip: number;
}
const POSES: readonly P[] = [
  { eyeN: 0.3, eyeS: 0.3, core: 0.6, crown: 0, tip: 0.5 },
  { eyeN: 1.2, eyeS: 0.3, core: 1, crown: 0.06, tip: 0.8 },
  { eyeN: 1.4, eyeS: 1.4, core: 1.6, crown: 0.14, tip: 1 },
  { eyeN: 2, eyeS: 2, core: 2.6, crown: 0.24, tip: 2 },
  { eyeN: 2, eyeS: 2, core: 3, crown: 0.34, tip: 2.6 },
  { eyeN: 2, eyeS: 2, core: 3, crown: 0.4, tip: 2.6 },
];
const HOLDS: readonly number[] = [200, 90, 110, 100, 140, 520];

const MAGT: Tones = { H: PAL.stone4, L: PAL.stone3, M: PAL.stone2, S: PAL.stone1 };
const MAGF: Tones = { H: PAL.stone3, L: PAL.stone2, M: PAL.stone1, S: PAL.stone0 };
const GOLDT: Tones = { H: PAL.gold4, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1 };
const CU = [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.skin3] as const;

const factory: CutinFactory = () => {
  function part(p: PixelCanvas, pts: readonly Pt[], t: Tones, light: ReturnType<typeof lightOf>, litW = 6, shW = 7): PixelCanvas {
    const q = new PixelCanvas(W, H);
    q.poly(pts as Pt[], t.M);
    bands(q, t, light, litW, shW, { top: 3, bottom: 3 });
    p.blit(q, 0, 0);
    return q;
  }

  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const left = (o?.lightFrom ?? 'left') === 'left';
    const light = lightOf(left ? 'left' : 'right');
    const P_ = POSES[Math.min(frame, POSES.length - 1)];
    const ls = left ? -1 : 1;

    // ---- the back (far) pauldron: a compass needle across the back shoulder, fire point out
    const pf = new PixelCanvas(W, H);
    needle(pf, { c: [44, 96], d: [-0.9, -0.44], lenN: 40, lenS: 22, hw: 11, band: 9, collar: true, far: true }, light);
    p.blit(pf, 0, 0);

    // ---- the chest: the coil drum (wound copper turns, cylinder planes by column) under the collar flange
    const cx = 100;
    const rx = 56;
    for (let x = cx - rx; x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / (rx + 0.5);
      const sag = Math.round(5 * Math.sqrt(Math.max(0, 1 - u * u)));
      const t = u * ls;
      const band = t > 0.3 ? 3 : t > -0.45 ? 2 : 1;
      const spec = t > 0.42 && t < 0.72;
      for (let y = 104; y < H; y++) {
        const r = y - 104 - sag + 30;
        const row = ((r % 9) + 9) % 9;
        let c: number = row < 3 ? CU[band - 1] : row < 6 ? CU[band] : spec ? CU[4] : CU[Math.min(4, band)];
        if (Math.abs(u) > 0.94) c = row < 3 ? CU[0] : CU[1];
        p.set(x, y, c);
      }
    }
    // the core window: a recessed dark well across the drum, its slit lit later
    for (let x = cx - rx + 8; x <= cx + rx - 8; x++) {
      const u = (x + 0.5 - cx) / (rx + 0.5);
      const sag = Math.round(5 * Math.sqrt(Math.max(0, 1 - u * u)));
      for (let y = 120 + sag; y < 129 + sag; y++) p.set(x, y, Math.abs(u) > 0.7 ? PAL.stone1 : PAL.stone0);
    }

    // ---- collar: the top flange (magnetite disc, gold front lip)
    const fl = new PixelCanvas(W, H);
    fl.ellipse(cx, 100, 66, 10, MAGT.M);
    fl.rect(cx - 66, 100, 133, 7, MAGT.M);
    fl.ellipse(cx, 107, 66, 10, MAGT.M);
    bands(fl, MAGT, light, 9, 9, { top: 3, bottom: 3 });
    for (let x = cx - 62; x <= cx + 62; x++) {
      const u = (x + 0.5 - cx) / 66;
      const y = Math.round(107 + 10 * Math.sqrt(Math.max(0, 1 - u * u)));
      for (let k = -3; k <= -1; k++) if (fl.isOpaque(x, y + k)) fl.set(x, y + k, k === -3 ? GOLDT.L : GOLDT.M);
    }
    p.blit(fl, 0, 0);

    // ---- the spindle pin and its gold knob (the crown pin)
    part(p, [[96, 44], [104, 44], [104, 18], [96, 18]], MAGT, light, 3, 3);
    part(p, [[92, 12], [108, 12], [112, 17], [108, 22], [92, 22], [88, 17]], GOLDT, light, 3, 3);

    // ---- the helm: the coil's dome given the needle's visor point toward the foe
    part(p, [[66, 46], [126, 42], [138, 50], [144, 60], [170, 70], [146, 78], [142, 94], [64, 96], [58, 74], [60, 54]], MAGT, light, 8, 9);
    // visor well, gold brow, crown circlet
    p.rect(92, 64, 56, 12, PAL.stone0).rect(144, 67, 12, 6, PAL.stone0);
    for (let x = 64; x < 146; x++) {
      if (p.get(x, 57) !== null) p.set(x, 57, x < 100 ? GOLDT.L : GOLDT.M).set(x, 58, GOLDT.M).set(x, 59, GOLDT.S);
      if (p.get(x, 48) !== null) p.set(x, 48, x < 96 ? GOLDT.H : GOLDT.L).set(x, 49, GOLDT.M);
    }
    // rivet pair on the cheek
    p.rect(70, 82, 4, 3, PAL.stone3).rect(80, 82, 4, 3, PAL.stone3);

    // ---- the near (front) pauldron: compass needle, water point out
    const pn = new PixelCanvas(W, H);
    needle(pn, { c: [158, 98], d: [0.9, -0.44], lenN: 40, lenS: 22, hw: 12, band: 9, collar: true, flip: true, pivot: 6 }, light);
    p.blit(pn, 0, 0);

    // ---- the compass spear across the front shoulder, its fire point high at the top right
    const sp = new PixelCanvas(W, H);
    needle(sp, { c: [168, 92], d: [0.3, -0.954], lenN: 90, lenS: 70, hw: 7, band: 10, collar: true, pivot: 0 }, light);
    p.blit(sp, 0, 0);

    p.outline(PAL.ink);

    // ---------------- light (never outlined)
    // the crown: a gold dial ring floating over the pin, four points turning (N fire, S water, E / W magnetite)
    const ccx = 100;
    const ccy = 14;
    const crx = 52;
    const cry = 9;
    for (let i = 0; i < 260; i++) {
      const a = (i / 260) * Math.PI * 2;
      const sy = Math.sin(a);
      const x = Math.round(ccx + Math.cos(a) * crx);
      const y = Math.round(ccy + sy * cry);
      if (y < 1) continue;
      if (sy < 0 && p.get(x, y) !== null) continue;
      p.set(x, y, sy > 0 ? (Math.cos(a) * ls > 0.2 ? PAL.gold4 : PAL.gold3) : PAL.gold2);
      if (sy > 0.3) p.set(x, y + 1, PAL.gold2);
    }
    const ptCols = [[PAL.fire4, PAL.fire3], [PAL.stone4, PAL.stone3], [PAL.water4, PAL.water3], [PAL.stone4, PAL.stone3]] as const;
    for (let k = 0; k < 4; k++) {
      const phi = (P_.crown + k / 4 + 0.08) * Math.PI * 2;
      const L = (crx + 10) * (k % 2 ? 0.7 : 1);
      const tx = ccx + Math.cos(phi) * L;
      const ty = ccy + Math.sin(phi) * L * (cry / crx);
      const n = Math.round(L);
      for (let i = 4; i < n; i++) {
        const x = Math.round(ccx + (tx - ccx) * (i / n));
        const y = Math.round(ccy + (ty - ccy) * (i / n));
        if (y < 1 || y >= H) continue;
        const w = Math.max(1, Math.round(3 * (1 - i / n)));
        for (let d = -w; d <= w; d++) if (y + d >= 1) p.set(x, y + d, d < 0 ? ptCols[k][0] : ptCols[k][1]);
      }
    }
    // eyes: the N eye (fire) behind, the S eye (water) forward
    const eye = (x: number, lv: number, hot: number, mid: number, dim: number) => {
      p.rect(x, 67, 10, 6, lv >= 1.8 ? mid : lv >= 1 ? mid : dim);
      if (lv >= 1) p.rect(x + 2, 68, 6, 4, lv >= 1.8 ? PAL.white : hot);
    };
    eye(108, P_.eyeN, PAL.fire4, PAL.fire3, PAL.fire1);
    eye(128, P_.eyeS, PAL.water4, PAL.water3, PAL.water1);
    if (P_.eyeS >= 1.4) p.rect(140, 70, 12, 2, PAL.water2);
    // the core slit: N fire left half, S water right half, the seam white at full charge
    const lv = P_.core;
    for (let x = cx - rx + 10; x <= cx + rx - 10; x++) {
      const u = (x + 0.5 - cx) / (rx + 0.5);
      const sag = Math.round(5 * Math.sqrt(Math.max(0, 1 - u * u)));
      const north = x < cx;
      const ramp = north ? [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] : [PAL.water1, PAL.water2, PAL.water3, PAL.water4];
      const edge = Math.abs(u) > 0.6;
      const k = Math.max(0, Math.min(3, Math.floor(lv) - (edge ? 1 : 0)));
      p.rect(x, 123 + sag, 1, 3, ramp[k]);
      if (lv >= 2 && !edge) p.set(x, 124 + sag, north ? PAL.gold4 : PAL.water4);
      if (lv >= 2.5 && Math.abs(x - cx) <= 3) p.rect(x, 122 + sag, 1, 5, PAL.white);
    }
    // the spear's fire point and water butt, the pauldron tips
    const tip = (x: number, y: number, lvl: number, hot: number, cool: number) => {
      if (lvl <= 0.2) return;
      p.rect(x - 1, y - 1, 3, 3, lvl >= 2 ? PAL.white : hot);
      if (lvl >= 2.4) for (let i = 2; i <= 6; i++) for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]] as const) if (y + dy >= 1) p.set(x + dx, y + dy, i < 4 ? hot : cool);
    };
    tip(Math.round(168 + 0.3 * 86), Math.round(92 - 0.954 * 86), P_.tip, PAL.fire4, PAL.gold4);
    tip(Math.round(44 - 0.9 * 36), Math.round(96 - 0.44 * 36), P_.tip * 0.6, PAL.fire4, PAL.fire3);
    tip(Math.round(158 + 0.9 * 36), Math.round(98 - 0.44 * 36), P_.tip * 0.6, PAL.water4, PAL.water3);
  }
  return { id: 'polar_sovereign', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.fire3, accentDark: PAL.water2, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
