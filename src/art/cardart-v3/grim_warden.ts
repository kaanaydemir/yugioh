// Card art v3 — Hortlak Muhafız (grim_warden, DARK fiend): the skull-faced knight in the approved v3 language
// (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts). A head-and-shoulders, three-quarter, facing
// right, under ONE key light from the top left:
//   skull    bone on the warm ramp (earth3 shade / earth4 mid / skin4 lit) shaded by flat steps on the dome's
//            normal (never a gradient), a brow ridge, two hollow sockets, a nasal slit and a clenched row of
//            teeth; two long horns swept up and out (three nested strokes: shade, mid, lit edge);
//   iron     the spiked pauldrons in night1 / night2 / night3 with bone thorns, one night4 lit edge;
//   cloak    void0 / void1 behind everything (the black-violet rags), a void2 lit edge on the left;
//   ribs     the rib-cage under the chin, its hollows dark;
//   light    the sockets burn cyan (a cyan3 core in a cyan1 hollow, one white heart) and crackle with 4-connected
//            1-px lightning (the sprite's eye arcs: src/art/monsters-v3/grim_warden-fx.ts) — drawn after the
//            outline, never outlined; the faint rib glow. Living art: 3 frames, the lightning changes shape.
//   ground   the kit's DARK recipe (the eclipse behind the head).
// One painter serves both sizes: every coordinate is in BIG px and scaled by `k` (the small picture is the same
// composition drawn at 1×, not a blind reduction — the kit's 1× corrections are the thinner strokes below).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { arcPath } from '../monsters-v3/grim_warden-fx';
import { paintBackdrop, ink } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const BONE = [PAL.earth3, PAL.earth4, PAL.skin4] as const;
const IRON = [PAL.night1, PAL.night2, PAL.night3] as const;
const KEY_L = [-0.5, -0.74, 0.46] as const;

/** A solid ellipse shaded by flat steps on its dome normal (shade / mid / lit by thresholds). */
function dome(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, tones: readonly [number, number, number], th: readonly [number, number] = [-0.02, 0.5]): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const d = nx * KEY_L[0] + ny * KEY_L[1] + nz * KEY_L[2];
      p.set(x, y, d > th[1] ? tones[2] : d > th[0] ? tones[1] : tones[0]);
    }
}

/** A polygon filled with one tone. */
function poly(p: PixelCanvas, pts: readonly (readonly [number, number])[], c: number): void {
  p.poly(pts.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]), c);
}

/** A horn: nested strokes along a path (shade full width, mid narrower, lit narrower still, shifted to the light). */
function horn(p: PixelCanvas, path: readonly (readonly [number, number])[], w0: number, w1: number, k: number): void {
  const s = (v: number) => v * k;
  const pts = path.map(([x, y]) => [s(x), s(y)] as [number, number]);
  p.stroke(pts, s(w0), Math.max(1, s(w1)), BONE[0]);
  p.stroke(pts.map(([x, y]) => [x - 0.5 * k, y - 0.4 * k] as [number, number]), Math.max(1, s(w0) - 2 * k), Math.max(1, s(w1) - k), BONE[1]);
  p.stroke(pts.map(([x, y]) => [x - 1 * k, y - 0.8 * k] as [number, number]), Math.max(1, s(w0) - 3.4 * k), 1, BONE[2]);
}

function subject(p: PixelCanvas, k: number): void {
  const s = (v: number) => v * k;
  // cloak behind everything
  poly(p, [[2, 68], [6, 40], [22, 30], [66, 30], [82, 40], [86, 68]].map(([x, y]) => [s(x), s(y)] as [number, number]), PAL.void1);
  poly(p, [[2, 68], [6, 44], [14, 40], [12, 68]].map(([x, y]) => [s(x), s(y)] as [number, number]), PAL.void2);
  poly(p, [[60, 68], [70, 40], [82, 40], [86, 68]].map(([x, y]) => [s(x), s(y)] as [number, number]), PAL.void0);
  // horns (behind the skull)
  horn(p, [[30, 26], [24, 22], [19, 15], [17, 6]], 5, 1, k);
  horn(p, [[61, 26], [67, 22], [71, 14], [70, 7]], 4.4, 1, k);
  // far pauldron, then the rib-cage and neck
  poly(p, [[60, 52], [66, 42], [80, 44], [86, 56], [84, 68], [62, 68]].map(([x, y]) => [s(x), s(y)] as [number, number]), IRON[1]);
  poly(p, [[66, 42], [80, 44], [84, 50], [68, 48]].map(([x, y]) => [s(x), s(y)] as [number, number]), IRON[2]);
  poly(p, [[74, 68], [86, 56], [84, 68]].map(([x, y]) => [s(x), s(y)] as [number, number]), IRON[0]);
  dome(p, s(46), s(66), s(14), s(15), BONE);
  // rib hollows (dark bands) across the chest
  for (let i = 0; i < 3; i++) p.rect(Math.round(s(36)), Math.round(s(56 + i * 4)), Math.round(s(21)), Math.max(1, Math.round(s(1.5))), PAL.void0);
  p.rect(Math.round(s(45)), Math.round(s(52)), Math.max(1, Math.round(s(2))), Math.round(s(16)), BONE[1]);
  // near pauldron (big, iron, in front) with bone thorns
  poly(p, [[2, 56], [8, 40], [30, 38], [36, 50], [32, 68], [2, 68]].map(([x, y]) => [s(x), s(y)] as [number, number]), IRON[1]);
  poly(p, [[8, 40], [30, 38], [34, 46], [10, 46]].map(([x, y]) => [s(x), s(y)] as [number, number]), IRON[2]);
  poly(p, [[22, 68], [36, 50], [32, 68]].map(([x, y]) => [s(x), s(y)] as [number, number]), IRON[0]);
  p.hline(Math.round(s(9)), Math.round(s(29)), Math.round(s(39)), PAL.night4);
  poly(p, [[11, 40], [13, 31], [16, 40]].map(([x, y]) => [s(x), s(y)] as [number, number]), BONE[1]);
  poly(p, [[20, 39], [23, 28], [26, 39]].map(([x, y]) => [s(x), s(y)] as [number, number]), BONE[2]);
  // skull: cranium, cheek / jaw, brow band
  dome(p, s(46), s(28), s(17), s(17), BONE);
  dome(p, s(46), s(42), s(11.5), s(9), BONE, [-0.1, 0.55]);
  p.rect(Math.round(s(30)), Math.round(s(24)), Math.round(s(32)), Math.max(1, Math.round(s(2.4))), IRON[1]);
  p.rect(Math.round(s(30)), Math.round(s(24)), Math.round(s(32)), Math.max(1, Math.round(s(1))), IRON[2]);
  // sockets, nasal slit, teeth
  for (const cx of [38, 54]) {
    for (let y = Math.round(s(26.5)); y < Math.round(s(34)); y++) for (let x = Math.round(s(cx - 4)); x < Math.round(s(cx + 4)); x++) {
      const nx = (x + 0.5 - s(cx)) / s(4);
      const ny = (y + 0.5 - s(30.5)) / s(3.8);
      if (nx * nx + ny * ny <= 1) p.set(x, y, PAL.void0);
    }
  }
  // the angry slant: the inner top corner of each socket filled with bone
  poly(p, [[37, 26.5], [43, 26.5], [43, 31]].map(([x, y]) => [s(x), s(y)] as [number, number]), BONE[1]);
  poly(p, [[49, 26.5], [55, 26.5], [49, 31]].map(([x, y]) => [s(x), s(y)] as [number, number]), BONE[1]);
  poly(p, [[45, 36], [47, 36], [46.5, 40], [45.5, 40]].map(([x, y]) => [s(x), s(y)] as [number, number]), PAL.ink);
  const ty = Math.round(s(46));
  for (let i = 0; i < 6; i++) {
    const x0 = Math.round(s(37 + i * 3.6));
    p.rect(x0, ty, Math.max(1, Math.round(s(2.6))), Math.max(2, Math.round(s(3))), i < 2 ? BONE[2] : i < 4 ? BONE[1] : BONE[0]);
  }
  p.hline(Math.round(s(36)), Math.round(s(59)), ty - 1, PAL.void0);
  ink(p);
}

function light(p: PixelCanvas, k: number, f: number): void {
  const s = (v: number) => v * k;
  const eyes: [number, number][] = [[Math.round(s(38)), Math.round(s(30.5))], [Math.round(s(54)), Math.round(s(30.5))]];
  const hw = Math.max(1, Math.round(s(2.6)));
  for (const [cx, cy] of eyes) {
    p.rect(cx - hw, cy - hw, hw * 2, Math.round(hw * 1.8), PAL.cyan1);
    p.rect(cx - hw + 1, cy - 1, hw * 2 - 2, Math.max(2, Math.round(hw * 1.2)), PAL.cyan3);
    p.set(cx, cy, PAL.white);
    if (k === 1) p.set(cx + 1, cy, PAL.cyan4);
  }
  // lightning: a main bolt out of each socket, a different shape each frame
  const set = [1, 4, 6][f % 3];
  const len = k === 1 ? 14 + (f % 3) * 3 : 7 + (f % 3);
  eyes.forEach(([cx, cy], i) => {
    const out = i === 0 ? -1 : 1;
    const path = arcPath(set + i * 3, len, out as -1 | 1);
    path.forEach(([dx, dy], j) => p.set(cx + dx, cy - hw - 1 + dy, j >= path.length - 2 ? PAL.cyan4 : PAL.cyan3));
  });
  // the faint rib glow
  for (let i = 0; i < 3; i++) {
    const y = Math.round(s(56 + i * 4)) + (k === 1 ? 0 : 0);
    for (let x = Math.round(s(40)); x < Math.round(s(53)); x += k === 1 ? 1 : 1) if (x % 2 === 0 || k === 1) p.set(x, y, f === 1 ? PAL.cyan2 : PAL.cyan1);
  }
}

const FOCUS = [46, 30] as const;

function paint(l: ArtLayers, f: number, k: number): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: FOCUS, horizon: 70, radius: 26 });
  subject(l.subject, k);
  light(l.light, k, f);
}

const art: CardArtV3 = {
  id: 'grim_warden',
  focus: FOCUS,
  frames: 3,
  holdMs: 160,
  big(l, f) {
    paint(l, f, 1);
  },
  small(l, f) {
    paint(l, f, 0.5);
  },
};
export default art;
