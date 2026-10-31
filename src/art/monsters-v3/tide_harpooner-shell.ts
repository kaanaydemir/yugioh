// Kabuk Zıpkıncı v3 — the CONCH: a rigid stamped map (IŞ-12), built once per orientation × light and cached.
//
// The shell is authored in its own axis frame: s runs along the spire axis (apex +s, siphonal canal −s), t runs
// across it (+t is the aperture side). Upright, the apex points up-left and the aperture opens to the right, so the
// crab's front comes out facing right. The map is rasterised from that geometry at a FEW fixed orientations only
// (upright 0°, tipped back −8°, 45°, on its side 90° and the roll steps of the death) — never a fractional rotation of
// a stamped sprite — and every orientation gets its own value planes from the one key light (IŞ-2: planes are
// chosen per light, the P2 relight is drawn, not mirrored).
//
// Layers (back to front): apex → whorl 3 → whorl 2 → whorl 1 → body whorl (+ shoulder knobs); each larger whorl is
// laid over the smaller one with a 1-px earth1 suture under it. Then the siphonal canal, the aperture well
// (night0 + a water0 depth band, MA-4) and the flared NACRE LIP (water3 / water4 / white, three flat bands — the
// "iridescence" without gradients). Spiral cords are 1-px seams in the mid / shade planes only (MA-2). Mussels and
// coral sprigs are per-frame overlays (they move), placed through shellPt().

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { bands, Comp, ellPoly, type Pt, type Tones } from './tide_harpooner-kit';

/** Local canvas of one shell map (the centre O is the body whorl's centre). */
export const SW = 88;
export const SO = 44;

export const SHELL: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
const SHELL_FAR: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };

const U0: Pt = [-0.42, -0.9075];
const V0: Pt = [0.9075, -0.42];

/** Local (s, t) → offset from the shell centre for an orientation `rot` (degrees, clockwise on screen). */
export function shellPt(s: number, t: number, rot: number): Pt {
  const x = U0[0] * s + V0[0] * t;
  const y = U0[1] * s + V0[1] * t;
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const n = Math.sin(r);
  return [x * c - y * n, x * n + y * c];
}

/** Offset → local (s, t) (inverse of shellPt). */
function localOf(dx: number, dy: number, rot: number): Pt {
  const r = (-rot * Math.PI) / 180;
  const c = Math.cos(r);
  const n = Math.sin(r);
  const x = dx * c - dy * n;
  const y = dx * n + dy * c;
  return [x * U0[0] + y * U0[1], x * V0[0] + y * V0[1]];
}

/** An ellipse in (s, t) as a polygon in local canvas pixels. */
function whorlPoly(s: number, t: number, as: number, at: number, rot: number, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [dx, dy] = shellPt(s + Math.cos(a) * as, t + Math.sin(a) * at, rot);
    out.push([SO + dx, SO + dy]);
  }
  return out;
}
function localPoly(pts: readonly Pt[], rot: number): Pt[] {
  return pts.map(([s, t]) => {
    const [dx, dy] = shellPt(s, t, rot);
    return [SO + dx, SO + dy] as Pt;
  });
}

const layer = () => new PixelCanvas(SW, SW);

export interface ShellMap {
  px: PixelCanvas;
  /** 1 where the pixel is nacre lip (recoloured when the lip brightens / flashes) */
  lip: Uint8Array;
  /** 1 where the pixel is the aperture well (the crab sits in it) */
  well: Uint8Array;
}

const CACHE = new Map<string, ShellMap>();

/**
 * The shell map for an orientation and a light. `rot` is one of the few authored orientations (any number works,
 * but the anims only use a handful, so the cache stays small).
 */
export function shellMap(rot: number, lightSide: -1 | 1): ShellMap {
  const key = `${rot}|${lightSide}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const p = new PixelCanvas(SW, SW);
  const comp = new Comp(p);
  const ls = lightSide;
  // whorls, apex first; each larger one over the smaller with a suture
  const whorls: [number, number, number, number, Tones][] = [
    [33.5, 0, 3, 3.6, SHELL_FAR],
    [29, 0, 3.8, 7, SHELL],
    [22.5, 0, 5.2, 10.6, SHELL],
    [14.5, 0, 7.2, 14.6, SHELL],
  ];
  // apex tip
  {
    const q = layer();
    q.poly(localPoly([[38, 0], [33, -2.6], [33, 2.6]], rot), SHELL.M);
    q.poly(whorlPoly(33.5, 0, 3, 3.6, rot, 24), SHELL.M);
    bands(q, SHELL_FAR, ls, { lit: 2, top: 1, shade: 1, bottom: 1 });
    comp.add(q, 1, {});
  }
  for (let i = 1; i < whorls.length; i++) {
    const [s, t, as, at, tn] = whorls[i];
    const q = layer();
    q.poly(whorlPoly(s, t, as, at, rot), tn.M);
    // shoulder knobs on whorl 1 (2-px teeth pointing up the spire)
    if (i === 3)
      for (const kt of [-9, 4]) {
        const se = s + as * Math.sqrt(Math.max(0, 1 - (kt / at) ** 2));
        q.poly(localPoly([[se + 2.2, kt], [se - 1, kt - 2.4], [se - 1, kt + 2.4]], rot), tn.M);
      }
    bands(q, tn, ls, { lit: i === 3 ? 3 : 2, top: 2, shade: 2, bottom: 2 });
    comp.add(q, 2 + i, { out: PAL.earth0 });
  }
  // body whorl + its shoulder knobs + the siphonal canal
  const body = layer();
  body.poly(whorlPoly(0, 0, 15.5, 19, rot, 56), SHELL.M);
  for (const kt of [-13, -4, 5.5]) {
    const se = 15.5 * Math.sqrt(Math.max(0, 1 - (kt / 19) ** 2));
    body.poly(localPoly([[se + 4, kt], [se - 1.5, kt - 3.2], [se - 1.5, kt + 3.2]], rot), SHELL.M);
  }
  body.poly(localPoly([[-8, 2], [-9, 13], [-17, 9.5], [-22.5, 6.5], [-21.5, 3.5], [-15, 1]], rot), SHELL.M);
  bands(body, SHELL, ls, { lit: 4, top: 3, shade: 3, bottom: 2, deep: 2 });
  // spiral cords (1-px seams) in the mid / shade planes only (MA-2)
  {
    const cords = [-3.5, -8.5, -13];
    const b0 = body.clone();
    for (let y = 0; y < SW; y++)
      for (let x = 0; x < SW; x++) {
        const c = b0.get(x, y);
        if (c === null || c === SHELL.L) continue;
        const [s, t] = localOf(x + 0.5 - SO, y + 0.5 - SO, rot);
        if (t > 9) continue; // not across the aperture side
        const bulge = s + 4 * (t / 19) ** 2;
        for (const k of cords)
          if (Math.abs(bulge - k) < 0.55) {
            body.set(x, y, c === SHELL.M ? SHELL.S : PAL.earth0);
            break;
          }
      }
  }
  comp.add(body, 6, { out: PAL.earth0 });

  // aperture well + nacre lip
  const lip = new Uint8Array(SW * SW);
  const well = new Uint8Array(SW * SW);
  {
    const q = layer();
    const lipOuter = whorlPoly(-1.5, 12.2, 15.2, 9.2, rot, 48);
    q.poly(lipOuter, PAL.water3);
    const ap = layer();
    ap.poly(whorlPoly(-3, 9, 12, 5.6, rot, 40), PAL.night0);
    // keep only the lip's outer side (t > 5) and the canal-side tail
    for (let y = 0; y < SW; y++)
      for (let x = 0; x < SW; x++) {
        if (!q.isOpaque(x, y)) continue;
        const [s, t] = localOf(x + 0.5 - SO, y + 0.5 - SO, rot);
        if (t < 5.5 && !ap.isOpaque(x, y)) {
          q.erase(x, y);
          continue;
        }
        if (ap.isOpaque(x, y)) {
          q.erase(x, y);
          continue;
        }
        const r = Math.hypot((s + 3) / 12, (t - 9) / 5.6);
        q.set(x, y, r < 1.2 && t > 6.5 ? PAL.white : r < 1.62 ? PAL.water4 : PAL.water3);
        // the lip's underside, turned from the light, steps down one tone
        if (r >= 1.62 && s < -9) q.set(x, y, PAL.water2);
      }
    comp.add(q, 7, { out: PAL.water1 });
    for (let i = 0; i < SW * SW; i++) if (comp.id[i] === 7) lip[i] = 1;
    // well: night0 core, water0 depth band on its upper (spire) side
    for (let y = 0; y < SW; y++)
      for (let x = 0; x < SW; x++) {
        if (!ap.isOpaque(x, y)) continue;
        const [s, t] = localOf(x + 0.5 - SO, y + 0.5 - SO, rot);
        const r = Math.hypot((s + 3) / 12, (t - 9) / 5.6);
        ap.set(x, y, r > 0.72 && s > -6 ? PAL.water0 : PAL.night0);
      }
    comp.add(ap, 8, {});
    for (let i = 0; i < SW * SW; i++) if (comp.id[i] === 8) well[i] = 1;
  }
  // a 1-px earth4 edge highlight on the lit rims (IŞ-8: only edges facing the light)
  {
    const snap = p.clone();
    for (let y = 1; y < SW - 1; y++)
      for (let x = 1; x < SW - 1; x++) {
        if (snap.get(x, y) !== SHELL.L) continue;
        if (!snap.isOpaque(x + ls, y - 1) && !snap.isOpaque(x, y - 1)) p.set(x, y, PAL.earth4);
      }
  }
  const m: ShellMap = { px: p, lip, well };
  CACHE.set(key, m);
  return m;
}

/** Points of interest on the shell (local s, t). */
export const SHELL_POI = {
  apex: [34, 0] as Pt,
  aperture: [-3, 9] as Pt,
  /** where the crab's carapace sits in the aperture (front of the well) */
  mouth: [-4.5, 10.5] as Pt,
  /** coral sprigs root on the lip's top end */
  coral: [11, 11] as Pt,
  mussels: [[-6, -15] as Pt, [-12, -9] as Pt, [12, -10] as Pt],
  /** bubble vent (lip top end) */
  vent: [3, 13] as Pt,
};
