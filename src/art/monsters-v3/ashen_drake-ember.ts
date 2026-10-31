// Kül Ejderi (ashen_drake) v3 — the light pass (docs/v3/kart-a/ashen_drake.md §1.3, §4.1): drawn AFTER
// the ink outline and never outlined (IŞ-9). The drake's only real light lives (a) inside the rib
// cage (the ember heart and its leaks through the gaps), (b) on the cloak's hem (the ember lip on the
// row inside the outline), (c) in the eyes and the throat, (d) at the tail's brazier.
//   heart   rest 3×3 fire3 + 1 fire4 + the ONE gold4; LUB 5×4 fire4 + gold4; DUB 4×3; relax fire2 only;
//           heat 2 = a white core with a fire4 ring
//   leaks   cavity pixels near the heart step fire2 → fire1 with distance (+1 tone on a beat)
//   hem     a fire1 lip with fire2 steps travelling along it (the shimmer), dark gaps between embers
//   eyes    1 px fire3 (2 = blaze fire4 / white)
//   brazier a constant fire3 count, 3 silhouettes + 1 low a cycle
//   spill   two 2-px streams out of the lowest rib gaps, grains down the talons, the cooled fan

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { add, lerpV, type Light, type V } from '../rigkit';
import { GY, W, H, hash } from './ashen_drake-gbuf';
import type { CloakDraw } from './ashen_drake-cloak';
import { skullPt, type AshenPose, type Rig } from './ashen_drake-rig';

export interface EmberCtx {
  readonly P: AshenPose;
  readonly R: Rig;
  readonly light: Light;
  /** rib cavity pixels still showing (night0) */
  readonly cavity: Uint8Array;
  readonly near: CloakDraw;
  readonly far: CloakDraw;
  /** pixels the crumb cleaner must not touch */
  readonly keep: Uint8Array;
}

function put(p: PixelCanvas, keep: Uint8Array, x: number, y: number, c: number) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  p.set(x, y, c);
  keep[y * W + x] = 1;
}

/** the heart's cells for a beat: [dx, dy, colour] around its centre */
function heartCells(beat: number, heat: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const box = (w: number, h: number, c: number) => {
    const x0 = -Math.floor((w - 1) / 2);
    const y0 = -Math.floor((h - 1) / 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([x0 + x, y0 + y, c]);
  };
  if (heat >= 1.95) {
    box(4, 4, PAL.fire4);
    box(2, 2, PAL.white);
    return out;
  }
  if (heat <= 0.25) {
    box(2, 2, PAL.fire1);
    return out;
  }
  if (beat === 1) {
    box(5, 4, PAL.fire4);
    out.push([0, 0, PAL.gold4]);
  } else if (beat === 2) {
    box(4, 3, PAL.fire4);
    out.push([0, 0, PAL.gold4]);
  } else if (beat === 3) {
    box(3, 2, PAL.fire2);
  } else if (beat === 4 || heat < 0.7) {
    box(3, 3, PAL.fire2);
    out.push([0, 0, PAL.fire3]);
  } else {
    box(3, 3, PAL.fire3);
    out.push([0, -1, PAL.fire4]);
    out.push([0, 0, PAL.gold4]);
  }
  if (heat >= 1.4 && heat < 1.95) {
    out.length = 0;
    box(5, 4, PAL.fire4);
    box(3, 2, PAL.gold4);
  }
  return out;
}

export function emberPass(p: PixelCanvas, c: EmberCtx) {
  const { P, R, keep } = c;
  const hx = Math.round(R.heart[0] - 0.5);
  const hy = Math.round(R.heart[1] - 0.5);
  const beatUp = P.beat === 1 || P.beat === 2 ? 1 : P.beat === 3 ? -1 : 0;
  const heatUp = Math.max(0, Math.min(2, Math.round((P.heat - 1) * 2)));
  // ---- leaks: the cavity glows round the heart, only where the cavity still shows
  const r1 = P.heat <= 0.25 ? 2 : 4.2 + beatUp * 1.2 + heatUp * 1.5;
  const r2 = P.heat <= 0.25 ? 3.5 : 7.2 + beatUp * 1.5 + heatUp * 2.5;
  for (let y = hy - 12; y <= hy + 12; y++)
    for (let x = hx - 12; x <= hx + 12; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !c.cavity[y * W + x]) continue;
      const cur = p.get(x, y);
      if (cur !== PAL.night0) continue;
      const d = Math.hypot(x - hx, (y - hy) * 0.85);
      if (d < r1) put(p, keep, x, y, heatUp >= 2 ? PAL.fire3 : PAL.fire2);
      else if (d < r2) put(p, keep, x, y, PAL.fire1);
    }
  // ---- the heart itself (only on cavity pixels: the bars stay in front of it)
  for (const [dx, dy, col] of heartCells(P.beat, P.heat)) {
    const x = hx + dx;
    const y = hy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (c.cavity[y * W + x] || P.crumble > 0.4 || (P.heap > 0 && P.boneTop > hy)) put(p, keep, x, y, col);
  }
  // the bars' inner edges catch the light on a beat / at heat
  if (beatUp > 0 || heatUp > 0) {
    for (let y = hy - 9; y <= hy + 9; y++)
      for (let x = hx - 9; x <= hx + 9; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H || c.cavity[y * W + x]) continue;
        const cur = p.get(x, y);
        if (cur !== PAL.stone2 && cur !== PAL.stone1) continue;
        const nearCav = (c.cavity[y * W + x - 1] || c.cavity[y * W + x + 1] || c.cavity[(y - 1) * W + x] || c.cavity[(y + 1) * W + x]) && Math.hypot(x - hx, y - hy) < 5 + heatUp * 2;
        if (nearCav) put(p, keep, x, y, heatUp >= 2 ? PAL.fire3 : PAL.fire2);
      }
  }
  // ---- the cocoon: a 2-px slit of heart glow where the cloaks overlap
  if (P.wingN.cocoon > 0.6 && P.heat > 0.25) {
    const sx = hx + 9;
    const hot = P.beat === 0 ? PAL.fire3 : PAL.fire2;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const x = sx + dx - (dy > 0 ? 1 : 0);
        const y = hy + dy;
        const cur = p.get(x, y);
        if (cur === null || cur === PAL.ink) continue;
        put(p, keep, x, y, dy === 0 && dx === 0 ? PAL.gold4 : Math.abs(dy) <= 1 && dx === 0 ? hot : PAL.fire1);
      }
  }
  // ---- the hem's ember lip: on the tip row inside the outline; embers with dark gaps, a shimmer step
  for (const [k, hem] of [c.near.hem, c.far.hem].entries()) {
    for (let i = 0; i < hem.length; i += 2) {
      const x = hem[i];
      const y = hem[i + 1];
      const cur = p.get(x, y);
      if (cur === null || cur === PAL.ink) continue;
      if (hash(x, 11, k) < 0.16) continue; // eaten gaps
      const sh = (x + Math.floor(P.shimmer * 20)) % 10;
      const col = P.heat <= 0.25 ? PAL.stone1 : sh < 3 ? PAL.fire2 : PAL.fire1;
      put(p, keep, x, y, col);
    }
  }
  // ---- the welds: a plate re-seats with a 1-frame fire2 lip
  for (const cl of [c.near, c.far])
    for (let i = 0; i < cl.welds.length; i += 2) {
      const x = cl.welds[i];
      const y = cl.welds[i + 1];
      if (p.get(x, y) === PAL.ink) continue;
      put(p, keep, x, y, PAL.fire2);
    }
  // ---- hem flakes: 2×2 chips peeling off the hem (stone2, a fire2 lip under them)
  const hemN = c.near.hem;
  if (hemN.length && P.crumble <= 0) {
    for (let k = 0; k < 6; k++) {
      const lift = k < 3 ? P.flakes[k] : P.flakes2[k - 3];
      if (lift <= 0) continue;
      const j = Math.floor(hash(k, 5) * (hemN.length / 2)) * 2;
      const bx = hemN[j];
      const by = hemN[j + 1];
      const x = Math.round(bx - lift * 0.8);
      const y = Math.round(by - 1 - lift);
      put(p, keep, x, y, PAL.stone2);
      put(p, keep, x + 1, y, PAL.stone1);
      put(p, keep, x, y + 1, PAL.fire2);
      put(p, keep, x + 1, y + 1, PAL.fire1);
    }
  }
  // ---- eyes
  if (P.eye > 0 && P.crumble < 0.35) {
    const ex = Math.round(R.eye[0] - 0.5);
    const ey = Math.round(R.eye[1] - 0.5);
    put(p, keep, ex, ey, P.eye >= 2 ? PAL.white : PAL.fire3);
    if (P.eye >= 2) put(p, keep, ex + 1, ey, PAL.fire4);
  }
  // ---- the throat: light between the jaws when they part
  if (P.jaw > 0.3 && P.heat > 0.5) {
    const m: V = lerpV(R.mouth, R.skull, 0.55);
    const col = P.heat >= 1.6 ? PAL.fire4 : PAL.fire3;
    put(p, keep, Math.round(m[0]), Math.round(m[1]), col);
    put(p, keep, Math.round(m[0]) - 1, Math.round(m[1]), PAL.fire2);
  }
  // ---- nostril smoke: one 2-px stone2 curl rising off the snout (not light: stone tones, never outlined)
  if (P.smoke > 0 && P.crumble < 0.3) {
    const n = skullPt(R, 14.5, -2.4);
    const rise = Math.round(P.smoke * 5);
    const bx = Math.round(n[0]) - Math.round(P.smoke * 2);
    const by = Math.round(n[1]) - rise;
    for (const [dx, dy, col] of [[0, 0, PAL.stone2], [1, -1, PAL.stone2], [0, -2, PAL.stone1], [-1, -1, PAL.stone1]] as const) {
      const x = bx + dx;
      const y = by + dy;
      if (p.get(x, y) === null) put(p, keep, x, y, col);
    }
  }
  // ---- brazier: the flame over the tail's cup (outside the outline: never outlined)
  brazier(p, c);
  // ---- the rib spill
  if (P.spill > 0) spill(p, c);
}

/** 4 flame silhouettes (3 tall + 1 low), each with exactly 3 fire3 pixels */
const FLAMES: readonly (readonly string[])[] = [
  ['..a..', '.aba.', '.bbb.', 'abbba'],
  ['...a.', '..ab.', '.bbb.', '.bbba'],
  ['.a...', '.ba..', '.bbb.', 'abbb.'],
  ['.....', '..a..', '.aba.', 'abbba'],
];

function brazier(p: PixelCanvas, c: EmberCtx) {
  const { P, R } = c;
  if (P.heat <= 0.05) return;
  const tip = R.tail[R.tail.length - 1];
  if (P.crumble >= 0.8) {
    // the brazier has tipped over: 3–4 embers on the floor where it fell
    const n = P.crumble >= 0.99 ? 3 : 4;
    for (let k = 0; k < n; k++) { const x = Math.round(tip[0]) + 2 + k * 3; const col = k === 0 && P.crumble < 0.99 ? PAL.fire2 : PAL.fire1; put(p, c.keep, x, GY, col); put(p, c.keep, x + 1, GY, col); }
    return;
  }
  // no flame without its cup (the summon / revive build the tail first, the crumble takes it)
  if ((P.crumble > 0 || P.boneTop > 0) && !p.isOpaque(Math.round(tip[0] - 0.5), Math.round(tip[1] - 0.5))) return;
  const f = FLAMES[[0, 1, 2, 1, 3][Math.floor(((((P.brazier % 1) + 1) % 1) * 5) + 1e-6) % 5]];
  const x0 = Math.round(tip[0]) - 2;
  const y0 = Math.round(tip[1]) - 2 - f.length;
  let n3 = 0;
  for (let y = 0; y < f.length; y++)
    for (let x = 0; x < 5; x++) {
      const ch = f[y][x];
      if (ch === '.') continue;
      const col = ch === 'a' ? PAL.fire2 : n3 < 3 && y >= 1 ? PAL.fire3 : PAL.fire2;
      if (col === PAL.fire3) n3++;
      if (p.get(x0 + x, y0 + y) === null || p.get(x0 + x, y0 + y) === PAL.ink) put(p, c.keep, x0 + x, y0 + y, col);
    }
}

function spill(p: PixelCanvas, c: EmberCtx) {
  const { P, R } = c;
  // two streams from the lowest two rib gaps (between ribs 3–4 and below rib 4, at the keel side)
  const g1 = lerpV(R.ribs[3][1], R.ribs[4][1], 0.5);
  const g2 = add(R.ribs[4][1], [1, 2.5]);
  if (P.spill < 2.5) {
    for (const [i, g] of [g1, g2].entries()) {
      const x0 = Math.round(g[0]);
      const y0 = Math.round(g[1]);
      const len = P.spill < 1.5 ? 14 + i * 3 : 9;
      const start = P.spill < 1.5 ? 0 : 7;
      for (let k = start; k < len; k++) {
        const y = y0 + k;
        if (y > GY) break;
        const sway = Math.round(Math.sin((k + i * 3) * 0.6) * 0.6) + Math.floor(k / 6);
        const head = k < 2 ? PAL.fire4 : k < 8 ? PAL.fire3 : PAL.fire2;
        put(p, c.keep, x0 + sway, y, head);
        put(p, c.keep, x0 + sway + 1, y, k < 6 ? PAL.fire2 : PAL.fire1);
      }
    }
    // scattered grains round the streams
    for (let k = 0; k < 14; k++) {
      const x = Math.round(g1[0] - 3 + hash(k, 21, P.spill * 10) * 10);
      const y = Math.round(g1[1] + 2 + hash(k, 22, P.spill * 10) * (GY - g1[1] - 2));
      if (y > GY) continue;
      put(p, c.keep, x, y, hash(k, 23) < 0.4 ? PAL.fire3 : PAL.fire2);
    }
  }
  // the fan at the talons (grains landed / cooled)
  if (P.spill >= 2) {
    const fx = Math.round(R.ankleN[0] + 6);
    const cool = P.spill >= 3;
    for (let k = 0; k < 18; k++) {
      const dx = Math.round((hash(k, 31) - 0.35) * 14);
      const dy = Math.round(hash(k, 32) * 2.2);
      const x = fx + dx;
      const y = GY - dy;
      const cur = p.get(x, y);
      if (cur !== null && cur !== PAL.ink && dy > 0) continue;
      put(p, c.keep, x, y, cool ? (hash(k, 33) < 0.3 ? PAL.fire1 : PAL.stone2) : hash(k, 33) < 0.5 ? PAL.fire2 : PAL.fire1);
    }
  }
}
