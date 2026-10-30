// Card art v3 — Zehir Ejderi (venom_drake, DARK dragon): a hissing head-and-neck bust in the approved language
// (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts). Not wired into the game yet (the card face's
// v3 registry is empty by design until A5-B step B-2), like the three prototypes before it.
//
// The head is the SPRITE's own head (src/art/monsters-v3/venom_drake-head.ts: the same facets, normals and
// horns), drawn here at card density (scale 2.2 of the sprite's head-local units, ×1 for the small picture's
// 1.1) under the card's key light from the top left: black-green scale planes (night0 underside, leaf0
// shadow, leaf1 mid, leaf2 lit top plane, leaf3 1-px edge), ivory horns and fangs, a venom-yellow slit eye,
// the jaws open on a venom-lit throat (leaf2 / leaf3 / leaf4), a drop swelling on the front fang. The neck
// drops down and left out of the frame: dorsal spikes behind it, bone-yellow throat plates in front, the
// snaking venom vein. Backdrop: the kit's DARK recipe (the void eclipse); the card's rim colour is its void3.
// Living art: the eye's glint and the fang's drop cycle (6 frames; f0 is the reduced-motion frame).
// Colours only from PAL; one key light; light layer after the outline, never outlined (IŞ-9).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';
import { BROW, FACE, HORN_FAR, HORN_LOW, HORN_MAIN, JOWL, TOP, FANGS } from '../monsters-v3/venom_drake-head';

type V = readonly [number, number];
const N0 = PAL.night0;
const G0 = PAL.leaf0;
const G1 = PAL.leaf1;
const G2 = PAL.leaf2;
const G3 = PAL.leaf3;
const G4 = PAL.leaf4;
const BONE = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4];
const L: readonly [number, number, number] = [-0.5, -0.74, 0.46];
const HEAD_RAMP = [N0, G0, G1, G2];
const TH = [-0.3, 0.18, 0.54];

const tone = (ramp: readonly number[], I: number, th: readonly number[] = TH): number => {
  let k = 0;
  while (k < th.length && I >= th[k]) k++;
  return ramp[Math.min(k, ramp.length - 1)];
};

interface Set {
  /** px per head-local unit */
  readonly hs: number;
  /** the head joint (the origin of head-local space) in this size's px */
  readonly o: V;
  /** the head axis, radians (+ = snout down) */
  readonly a: number;
  /** jaw opening, radians */
  readonly jaw: number;
}
const HINGE: V = [2, 3.5];
const BIG: Set = { hs: 2.2, o: [36, 35], a: 0.26, jaw: 0.4 };
const SMALL: Set = { hs: 1.1, o: [18, 17.5], a: 0.26, jaw: 0.4 };

function at(S: Set, p: V, jaw = false): [number, number] {
  let [x, y] = p;
  if (jaw) {
    const c = Math.cos(S.jaw);
    const s = Math.sin(S.jaw);
    [x, y] = [HINGE[0] + (x - HINGE[0]) * c - (y - HINGE[1]) * s, HINGE[1] + (x - HINGE[0]) * s + (y - HINGE[1]) * c];
  }
  const ca = Math.cos(S.a);
  const sa = Math.sin(S.a);
  return [S.o[0] + (x * ca - y * sa) * S.hs, S.o[1] + (x * sa + y * ca) * S.hs];
}
function facet(c: PixelCanvas, S: Set, pts: readonly V[], n: readonly [number, number, number], ramp: readonly number[], o: { jaw?: boolean; bias?: number; th?: readonly number[] } = {}): void {
  const a = S.a + (o.jaw ? S.jaw : 0);
  const nx = n[0] * Math.cos(a) - n[1] * Math.sin(a);
  const ny = n[0] * Math.sin(a) + n[1] * Math.cos(a);
  const I = nx * L[0] + ny * L[1] + n[2] * L[2] + (o.bias ?? 0);
  c.poly(pts.map((p) => at(S, p, o.jaw)), tone(ramp, I, o.th));
}

function horn(c: PixelCanvas, S: Set, spine: readonly (readonly [number, number, number])[], dark: number): void {
  const up: V[] = [];
  const dn: V[] = [];
  const mid: V[] = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(spine.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const [x, y, w] = spine[i];
    up.push([x - (ty / l) * w, y + (tx / l) * w]);
    dn.push([x + (ty / l) * w, y - (tx / l) * w]);
    mid.push([x, y]);
  }
  const th = [-0.35, 0.1, 0.45, 0.8];
  facet(c, S, [...up, ...mid.slice().reverse()], [0, -0.75, 0.65], BONE, { th, bias: -dark });
  facet(c, S, [...mid, ...dn.slice().reverse()], [0, 0.75, 0.65], BONE, { th, bias: -dark });
}

/** The tube of the neck: from the head joint down and back; per pixel the cylinder normal under the key light. */
function neck(c: PixelCanvas, S: Set, path: readonly V[], r0: number, r1: number): void {
  const pts: V[] = [];
  for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < 12; k++) pts.push([path[i][0] + ((path[i + 1][0] - path[i][0]) * k) / 12, path[i][1] + ((path[i + 1][1] - path[i][1]) * k) / 12]);
  pts.push(path[path.length - 1]);
  const N = pts.length;
  const sx = S.hs / 2.2;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      let best = Infinity;
      let bi = 0;
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(x + 0.5 - pts[i][0], y + 0.5 - pts[i][1]);
        if (d < best) {
          best = d;
          bi = i;
        }
      }
      const u = bi / (N - 1);
      const r = (r0 + (r1 - r0) * u) * sx;
      if (best > r) continue;
      const a = pts[Math.max(0, bi - 1)];
      const b = pts[Math.min(N - 1, bi + 1)];
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      // signed lateral offset: + toward the throat (down-right of the path)
      const nxs = ty / tl;
      const nys = -tx / tl;
      let lat = ((x + 0.5 - pts[bi][0]) * nxs + (y + 0.5 - pts[bi][1]) * nys) / r;
      const side = nxs * 0.5 + nys * 0.8 > 0 ? 1 : -1; // which lateral sign faces the throat
      lat *= side;
      const nz = Math.sqrt(Math.max(0, 1 - lat * lat));
      const nx = lat * side * nxs;
      const ny = lat * side * nys;
      const I = nx * L[0] + ny * L[1] + nz * L[2];
      let col = tone(HEAD_RAMP, I, [-0.2, 0.4, 0.86]);
      // throat plates: the front band, seams every 3 px of the path
      if (lat > 0.42 && u > 0.12) col = (Math.floor(bi / 4) % 2 === 0 ? BONE[3] : BONE[2]) as number;
      // the vein: a 1-px line snaking along the shadow flank
      const vc = 0.3 * Math.sin(bi * 0.21 + 0.6) - 0.1;
      if (lat < 0.42 && Math.abs(lat - vc) * r < 0.55) col = G3;
      c.set(x, y, col);
    }
}

function spikes(c: PixelCanvas, S: Set, path: readonly V[], r0: number, r1: number): void {
  const sx = S.hs / 2.2;
  for (let i = 3; i < path.length * 12 - 14; i += 11) {
    const k = Math.floor(i / 12);
    const f = (i % 12) / 12;
    const p: V = [path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f];
    const q = path[Math.min(path.length - 1, k + 1)];
    const tx = q[0] - path[k][0];
    const ty = q[1] - path[k][1];
    const l = Math.hypot(tx, ty) || 1;
    // the dorsal side is up / left of the path
    let nx = ty / l;
    let ny = -tx / l;
    if (nx * -0.5 + ny * -0.8 < 0) {
      nx = -nx;
      ny = -ny;
    }
    const u = i / (path.length * 12);
    const r = (r0 + (r1 - r0) * u) * sx;
    const base: V = [p[0] + nx * r * 0.8, p[1] + ny * r * 0.8];
    const h = (5.5 + 3 * Math.sin(u * 3)) * sx;
    const tip: V = [base[0] + nx * h + (tx / l) * -h * 0.5, base[1] + ny * h + (ty / l) * -h * 0.5];
    const w = 2.2 * sx;
    c.poly([[base[0] - (tx / l) * w, base[1] - (ty / l) * w], tip, [base[0] + (tx / l) * w, base[1] + (ty / l) * w]], G1);
    c.poly([[base[0] - (tx / l) * w, base[1] - (ty / l) * w], tip, base], G2);
  }
}

function bust(S: Set, path: readonly V[], r0: number, r1: number): PixelCanvas {
  const c = new PixelCanvas(S === BIG ? 88 : 44, S === BIG ? 68 : 34);
  spikes(c, S, path, r0, r1);
  neck(c, S, path, r0, r1);
  horn(c, S, HORN_FAR, 0.35);
  horn(c, S, HORN_LOW, 0.15);
  horn(c, S, HORN_MAIN, 0);
  // the mouth's inside, the lower jaw (turned open), the skull
  c.poly([at(S, [2, 2.4]), at(S, [21.5, 2.4]), at(S, [20.5, 3.8], true), at(S, [2, 3.8], true)], N0);
  facet(c, S, [[0, 3.6], [12, 3.4], [20.8, 3.6], [20.2, 5.8], [12, 6.4], [4, 7.4], [-1, 6.6]], [0, 0.3, 0.9], HEAD_RAMP, { jaw: true, bias: -0.08 });
  facet(c, S, [[-1, 6.4], [4, 7.2], [12, 6.2], [20.2, 5.8], [19.4, 7], [11.5, 7.6], [4, 8.6], [-1.5, 7.8]], [0, 0.85, 0.5], HEAD_RAMP, { jaw: true });
  facet(c, S, FACE, [0, 0.05, 1], HEAD_RAMP);
  facet(c, S, JOWL, [0, 0.7, 0.7], HEAD_RAMP);
  facet(c, S, TOP, [0.1, -0.85, 0.5], HEAD_RAMP, { bias: 0.1 });
  facet(c, S, BROW, [0.3, 0.5, 0.8], HEAD_RAMP, { bias: -0.15 });
  // fangs: the upper two hang from the lip, the lower tusk rises from the jaw
  for (const f of FANGS) facet(c, S, [[f[0] - 1.5, f[1]], [f[0] + 1.5, f[1]], [f[2], f[3]]], [0.2, 0, 1], [BONE[2], BONE[3], BONE[4]], { th: [0.2, 0.55] });
  facet(c, S, [[17.7, 3.6], [20.7, 3.6], [19.6, -0.6]], [0.2, 0, 1], [BONE[2], BONE[3], BONE[4]], { jaw: true, th: [0.2, 0.55] });
  // the nostril
  const nose = at(S, [19, -1]);
  c.set(Math.round(nose[0]), Math.round(nose[1]), N0);
  return c;
}

const NECK_BIG: readonly V[] = [[34, 36], [24, 44], [14, 53], [4, 61], [-6, 67]];
const NECK_SMALL: readonly V[] = [[17, 18], [12, 22], [7, 26.5], [2, 30.5], [-3, 33.5]];

function lightLayer(S: Set, l: PixelCanvas, f: number): void {
  const k = S.hs / 2.2;
  // the eye: a venom-yellow slit under the brow
  const e = at(S, [8, -2.5]);
  const ex = Math.round(e[0]) - 1;
  const ey = Math.round(e[1]);
  const w = k >= 1 ? 4 : 3;
  for (let i = 0; i < w; i++) l.set(ex + i, ey, i === w - 2 ? PAL.gold4 : PAL.gold3);
  l.set(ex + 1, ey + 1, N0);
  if (k >= 1) l.set(ex + 2, ey + 1, PAL.gold3);
  const pulse = [PAL.white, PAL.white, PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold4][f % 6];
  l.set(ex + w - 2, ey, pulse);
  // the throat: venom light between the jaws (a stepped glow, bright at the root of the tongue)
  const rows: [number, number, number][] = k >= 1 ? [[4.5, 13, G2], [5, 10, G3], [5.5, 7, G4]] : [[4.5, 12, G2], [5, 8, G3]];
  for (const [a, b, col] of rows) {
    const p0 = at(S, [a, 2.9]);
    const p1 = at(S, [b, 2.9]);
    const p2 = at(S, [b, 3.3], true);
    const p3 = at(S, [a, 3.5], true);
    l.poly([p0, p1, p2, p3], col);
  }
  // the drop on the front fang: swells, falls (6 frames)
  const tip = at(S, [FANGS[0][2], FANGS[0][3]]);
  const dy = [0, 1, 2, 4, 7, 11][f % 6] * k;
  const dx = Math.round(tip[0]);
  const dyy = Math.round(tip[1]) + 1 + Math.round(dy);
  l.set(dx, dyy, G3);
  if (f % 6 >= 2 && k >= 1) l.set(dx, dyy + 1, G2);
  // glow dots at the base of the dorsal spikes
  const path = k >= 1 ? NECK_BIG : NECK_SMALL;
  for (let i = 1; i < path.length - 1; i++) l.set(Math.round(path[i][0] - 3 * k), Math.round(path[i][1] - 3 * k), i % 2 ? G3 : G2);
}

const FOCUS: readonly [number, number] = [Math.round(at(BIG, [8, -2.5])[0]), Math.round(at(BIG, [8, -2.5])[1])];

const art: CardArtV3 = {
  id: 'venom_drake' as CardArtV3['id'],
  focus: FOCUS,
  frames: 6,
  holdMs: 150,
  big(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [FOCUS[0] + 4, FOCUS[1] + 6], radius: 30, horizon: 56 });
    const b = bust(BIG, NECK_BIG, 8, 6);
    l.subject.blit(b, 0, 0);
    rim(l.subject, PAL.void3, { skip: [G3, G4, PAL.gold3, PAL.gold4] });
    ink(l.subject);
    lightLayer(BIG, l.light, f);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [Math.round(FOCUS[0] / 2) + 2, Math.round(FOCUS[1] / 2) + 3], radius: 15, horizon: 28 });
    const b = bust(SMALL, NECK_SMALL, 4, 3);
    l.subject.blit(b, 0, 0);
    rim(l.subject, PAL.void3, { skip: [G3, G4, PAL.gold3, PAL.gold4] });
    ink(l.subject);
    lightLayer(SMALL, l.light, f);
  },
};

export default art;
