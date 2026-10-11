// Kristal Ejder HD — dev contact sheets (pure PixelCanvas, Node or browser). Driven by
// shots.mjs in this folder → shots/hd/crystal_wyrm/*.png. Not used by the trial page.
//
//   animSheet(anim, cols, scale)   every frame of an animation (impact frame marked)
//   compareSheet()                 CURRENT sprite ×3 next to the HD sprite ×2 (same size on a 1080p screen)
//   tileSheet()                    both sprites at 1× on their iso tiles (64×32 / 96×48), then ×3 / ×2
//   mapSheet(anim, kind)           normal maps / emissive masks / CPU re-light of an animation
//   onionSheet(anim, frames)       onion-skin silhouettes of chosen frames (motion arcs)

import { PixelCanvas } from '../../../art/pixel';
import { PAL } from '../../../art/palette';
import { drawGlyph, getFont } from '../../../art/font';
import { monsterArt } from '../../../art/monsters';
import { MONSTER_ANIMS, type MonsterAnim } from '../../../art/types';
import { type HDRenderResult, drawDropShadow, relight } from '../../render';
import art from '../crystal_wyrm';

const BG = PAL.night0;
const PANEL = PAL.night1;

export function label(p: PixelCanvas, text: string, x: number, y: number, color: number = PAL.mist): void {
  const f = getFont('sm');
  let cx = x;
  for (const ch of text) {
    const g = f.glyphs.get(ch.charCodeAt(0)) ?? f.glyphs.get('?'.charCodeAt(0));
    if (!g) {
      cx += f.def.spaceW + 1;
      continue;
    }
    drawGlyph(p, g, f.def.cellH, cx, y, color);
    cx += g.w + 1;
  }
}

const frameOf = (anim: MonsterAnim, f: number) => art.render(anim, f) as HDRenderResult;

/** Alpha-composite src over dst at (dx, dy), nearest-neighbour scaled by k. */
function put(dst: PixelCanvas, src: PixelCanvas, dx: number, dy: number, k = 1): void {
  for (let y = 0; y < src.h * k; y++)
    for (let x = 0; x < src.w * k; x++) {
      const si = (Math.floor(y / k) * src.w + Math.floor(x / k)) * 4;
      const a = src.data[si + 3];
      if (!a) continue;
      const X = dx + x;
      const Y = dy + y;
      if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
      const di = (Y * dst.w + X) * 4;
      const t = a / 255;
      dst.data[di] = Math.round(dst.data[di] * (1 - t) + src.data[si] * t);
      dst.data[di + 1] = Math.round(dst.data[di + 1] * (1 - t) + src.data[si + 1] * t);
      dst.data[di + 2] = Math.round(dst.data[di + 2] * (1 - t) + src.data[si + 2] * t);
      dst.data[di + 3] = 255;
    }
}

export function animSheet(anim: MonsterAnim, cols = 6, k = 1): PixelCanvas {
  const n = art.anims[anim].frames;
  const fw = art.w * k;
  const fh = art.h * k;
  const rows = Math.ceil(n / cols);
  const p = new PixelCanvas(cols * (fw + 4) + 4, rows * (fh + 14) + 18).rect(0, 0, 10000, 10000, BG);
  label(p, `KRISTAL EJDER HD  ${anim.toUpperCase()}  ${n} KARE @${art.anims[anim].fps}`, 4, 3, PAL.gold3);
  let ms = 0;
  for (let f = 0; f < n; f++) {
    const x = 4 + (f % cols) * (fw + 4);
    const y = 16 + Math.floor(f / cols) * (fh + 14);
    p.rect(x, y, fw, fh, PANEL);
    const fr = frameOf(anim, f);
    ms += fr.ms;
    put(p, fr.color, x, y, k);
    // ground line under the anchor
    p.hline(x, x + fw - 1, y + art.anchorY * k, PAL.night2);
    const imp = anim === 'attack' && f === art.attackImpactFrame;
    label(p, `${f}${imp ? ' IMPACT' : ''}`, x + 2, y + fh + 2, imp ? PAL.crim3 : PAL.mist);
    if (imp) p.frame(x - 1, y - 1, fw + 2, fh + 2, PAL.crim3);
  }
  label(p, `${(ms / n).toFixed(1)} MS/KARE`, p.w - 70, 3, PAL.steel);
  return p;
}

export function allSheet(): PixelCanvas {
  const sheets = MONSTER_ANIMS.map((a) => animSheet(a, 9, 1));
  const w = Math.max(...sheets.map((s) => s.w));
  const h = sheets.reduce((s, c) => s + c.h, 0);
  const p = new PixelCanvas(w, h).rect(0, 0, w, h, BG);
  let y = 0;
  for (const s of sheets) {
    p.blit(s, 0, y);
    y += s.h;
  }
  return p;
}

/** Current (96×96, ×3) vs HD (192×192, ×2): both as they appear on a 1080p screen. */
export function compareSheet(pairs: [MonsterAnim, number, number][] = [
  ['idle', 0, 0],
  ['attack', 5, 7],
  ['roar', 4, 6],
  ['guard', 0, 0],
]): PixelCanvas {
  const cur = monsterArt('crystal_wyrm');
  const cw = cur.w * 3;
  const hw = art.w * 2;
  const p = new PixelCanvas(pairs.length * (cw + hw + 24) + 8, Math.max(cur.h * 3, art.h * 2) + 24).rect(0, 0, 100000, 1000, BG);
  pairs.forEach(([anim, fc, fh], i) => {
    const x = 8 + i * (cw + hw + 24);
    const c = new PixelCanvas(cur.w, cur.h);
    cur.draw(c, anim, fc);
    // align both anchors on the same ground line
    const gy = 18 + art.h * 2 - 10;
    p.rect(x, 18, cw, p.h - 22, PANEL);
    put(p, c, x + Math.round(cw / 2 - cur.anchorX * 3), gy - cur.anchorY * 3, 3);
    p.rect(x + cw + 4, 18, hw, p.h - 22, PANEL);
    put(p, frameOf(anim, fh).color, x + cw + 4 + Math.round(hw / 2 - art.anchorX * 2), gy - art.anchorY * 2, 2);
    label(p, `ŞU AN ${anim} ${fc}`, x + 2, 6);
    label(p, `HD ${anim} ${fh}`, x + cw + 6, 6, PAL.gold3);
  });
  return p;
}

function isoTile(p: PixelCanvas, cx: number, cy: number, tw: number, th: number, fill: number, line: number): void {
  for (let y = -th / 2; y <= th / 2; y++) {
    const hw = Math.round((tw / 2) * (1 - Math.abs(y) / (th / 2)));
    if (hw <= 0) continue;
    p.hline(cx - hw, cx + hw - 1, cy + y, fill);
    p.set(cx - hw, cy + y, line);
    p.set(cx + hw - 1, cy + y, line);
  }
}

/** In-game scale: each sprite at 1× on its own tile, plus the same scene magnified to a 1080p screen. */
export function tileSheet(anim: MonsterAnim = 'idle', fh = 0): PixelCanvas {
  const cur = monsterArt('crystal_wyrm');
  // 1× scenes
  const sc = new PixelCanvas(150, 120).rect(0, 0, 150, 120, PAL.night1);
  isoTile(sc, 75, 112, 64, 32, PAL.night2, PAL.cyan1);
  isoTile(sc, 75 - 64, 112 - 16, 64, 32, PAL.night2, PAL.night3);
  const cc = new PixelCanvas(cur.w, cur.h);
  cur.draw(cc, anim, 0);
  drawDropShadow(sc, [75, 112], 18, 6);
  put(sc, cc, 75 - cur.anchorX, 112 - cur.anchorY);
  const sh = new PixelCanvas(225, 200).rect(0, 0, 225, 200, PAL.night1);
  isoTile(sh, 112, 188, 96, 48, PAL.night2, PAL.cyan1);
  isoTile(sh, 112 - 96, 188 - 24, 96, 48, PAL.night2, PAL.night3);
  drawDropShadow(sh, [112, 188], 27, 9);
  put(sh, frameOf(anim, fh).color, 112 - art.anchorX, 188 - art.anchorY);
  const p = new PixelCanvas(8 + 150 + 8 + 225 + 8 + 450 + 8 + 450 + 8, 420).rect(0, 0, 10000, 1000, BG);
  label(p, 'ŞU AN 1×', 8, 4);
  put(p, sc, 8, 16);
  label(p, 'HD 1×', 166, 4, PAL.gold3);
  put(p, sh, 166, 16);
  label(p, 'ŞU AN ×3 (1080P)', 399, 4);
  put(p, sc.crop(0, 0, 150, 120), 399, 16, 3);
  label(p, 'HD ×2 (1080P)', 857, 4, PAL.gold3);
  put(p, sh, 857, 16, 2);
  return p;
}

export type MapKind = 'normal' | 'emissive' | 'relit';

export function mapSheet(anim: MonsterAnim, kind: MapKind, frames?: number[]): PixelCanvas {
  const fs = frames ?? Array.from({ length: art.anims[anim].frames }, (_, i) => i);
  const cols = Math.min(6, fs.length);
  const rows = Math.ceil(fs.length / cols);
  const p = new PixelCanvas(cols * (art.w + 4) + 4, rows * (art.h + 4) + 16).rect(0, 0, 10000, 10000, BG);
  label(p, `${anim.toUpperCase()} ${kind.toUpperCase()}`, 4, 3, PAL.gold3);
  fs.forEach((f, i) => {
    const x = 4 + (i % cols) * (art.w + 4);
    const y = 14 + Math.floor(i / cols) * (art.h + 4);
    p.rect(x, y, art.w, art.h, kind === 'relit' ? PAL.night0 : PANEL);
    const fr = frameOf(anim, f);
    let c = fr.color;
    if (kind === 'normal') c = fr.normal;
    else if (kind === 'emissive') {
      c = new PixelCanvas(art.w, art.h);
      for (let j = 0; j < c.data.length; j += 4) {
        const a = fr.emissive.data[j + 3];
        if (!a) continue;
        c.data[j] = fr.emissive.data[j];
        c.data[j + 1] = fr.emissive.data[j + 1];
        c.data[j + 2] = fr.emissive.data[j + 2];
        c.data[j + 3] = a;
      }
    } else if (kind === 'relit') {
      // P1 setup: dim navy ambient, warm key from the upper right, cyan rim from the lower left
      c = relight(
        fr,
        [
          { pos: [170, 30, 90], color: 0xfff2d0, intensity: 0.9 },
          { pos: [-10, 190, 30], color: PAL.cyan3, intensity: 1.1, radius: 260 },
        ],
        0x2a2f55,
        fr.emissive,
      );
    }
    put(p, c, x, y);
  });
  return p;
}

/** Onion skin: the silhouettes of several frames over each other, older ones dimmer. */
export function onionSheet(anim: MonsterAnim, frames: number[]): PixelCanvas {
  const p = new PixelCanvas(art.w * 2, art.h * 2).rect(0, 0, 10000, 10000, BG);
  const cols = [PAL.night3, PAL.night4, PAL.steel, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white];
  frames.forEach((f, i) => {
    const fr = frameOf(anim, f);
    const col = cols[Math.min(cols.length - 1, Math.round((i / Math.max(1, frames.length - 1)) * (cols.length - 1)))];
    const s = new PixelCanvas(art.w, art.h);
    for (let y = 0; y < art.h; y++)
      for (let x = 0; x < art.w; x++) {
        if (!fr.color.isOpaque(x, y)) continue;
        // outline only (edges of the silhouette)
        if (fr.color.isOpaque(x - 1, y) && fr.color.isOpaque(x + 1, y) && fr.color.isOpaque(x, y - 1) && fr.color.isOpaque(x, y + 1)) continue;
        s.set(x, y, col);
      }
    put(p, s, 0, 0, 2);
  });
  label(p, `${anim.toUpperCase()} ${frames.join(',')}`, 4, 4, PAL.gold3);
  return p;
}

/** One frame magnified. */
export function zoomSheet(anim: MonsterAnim, f: number, k = 4): PixelCanvas {
  const p = new PixelCanvas(art.w * k, art.h * k).rect(0, 0, 100000, 100000, PANEL);
  put(p, frameOf(anim, f).color, 0, 0, k);
  return p;
}

/** The CURRENT (shipped) 96×96 sprite magnified. */
export function currentZoom(anim: MonsterAnim, f: number, k = 8): PixelCanvas {
  const cur = monsterArt('crystal_wyrm');
  const c = new PixelCanvas(cur.w, cur.h);
  cur.draw(c, anim, f);
  const p = new PixelCanvas(cur.w * k, cur.h * k).rect(0, 0, 100000, 100000, PANEL);
  put(p, c, 0, 0, k);
  return p;
}

// ------------------------------------------------------------------ surface sampler (dev)

import { HDRenderer, catmull, type V2 } from '../../render';
import { HIDE, HIDE_EDGE, BELLY } from './materials';
import { applyMarks, newMarks, plateEllipsoid, plateTube, type PlateTubeOpts, type PlateEllipsoidOpts } from './plates';

const sr = new HDRenderer(96, 110);

/** A torso-like test volume (tube + haunch) with one surface treatment. */
function sample(t: PlateTubeOpts | null, e: PlateEllipsoidOpts | null, mat = HIDE): PixelCanvas {
  const fr = sr.frame((r) => {
    const p = r.part('t');
    const spine: V2[] = catmull([[30, 95], [40, 80], [52, 58], [60, 30], [62, 14]], 4);
    const rad = (u: number) => [11, 17, 18, 15, 9][Math.min(4, Math.round(u * 4))];
    if (t) {
      const marks = newMarks();
      plateTube(p.g, p.brush({ mat }), spine, rad, { ...t, marks: t.seam || t.lip ? marks : undefined, belly: t.belly ? { ...t.belly, brush: p.brush({ mat: BELLY }) } : undefined });
      if (t.seam || t.lip) applyMarks(p, marks);
    } else p.tube(spine, rad, { mat: HIDE, belly: { from: 0.3, side: 1, mat: BELLY } });
    if (e) {
      const marks = newMarks();
      plateEllipsoid(p.g, p.brush({ mat }), [36, 84], 17, 14, { ...e, marks: e.seam ? marks : undefined });
      if (e.seam) applyMarks(p, marks);
    } else p.ellipsoid([36, 84], 17, 14, { mat: HIDE });
  });
  return fr.color;
}

export function surfaceSheet(): PixelCanvas {
  const B = { from: 0.3, side: 1 as const, seg: 6 };
  const variants: [string, PlateTubeOpts | null, PlateEllipsoidOpts | null, typeof HIDE?][] = [
    ['SMOOTH', null, null],
    ['FACET4', { seg: 1000, facets: 4, smooth: 0, lean: 0, jitter: 0, belly: B }, { cell: 14, smooth: 0, tilt: 0.12 }],
    ['FACET4 EDGE', { seg: 1000, facets: 4, smooth: 0, lean: 0, jitter: 0, belly: B }, { cell: 14, smooth: 0, tilt: 0.12 }, HIDE_EDGE],
    ['FACET4 BELLYSEAM', { seg: 1000, facets: 4, smooth: 0, lean: 0, jitter: 0, seam: 1, belly: B }, { cell: 14, smooth: 0, tilt: 0.12 }, HIDE_EDGE],
    ['FACET5 EDGE', { seg: 1000, facets: 5, smooth: 0.1, lean: 0, jitter: 0, belly: B }, { cell: 15, smooth: 0.1, tilt: 0.1 }, HIDE_EDGE],
    ['DIAMOND 16', { seg: 16, facets: 3, smooth: 0, vee: 1, point: -1, lean: 0.06, jitter: 0.06, belly: B }, { cell: 15, smooth: 0, tilt: 0.12 }, HIDE_EDGE],
    ['FACET3 EDGE', { seg: 1000, facets: 3, smooth: 0, lean: 0, jitter: 0, belly: B }, { cell: 16, smooth: 0, tilt: 0.12 }, HIDE_EDGE],
  ];
  const k = 3;
  const p = new PixelCanvas(variants.length * (96 * k + 6) + 6, 110 * k + 20).rect(0, 0, 100000, 1000, BG);
  variants.forEach(([name, t, e, m], i) => {
    const x = 6 + i * (96 * k + 6);
    p.rect(x, 16, 96 * k, 110 * k, PANEL);
    put(p, sample(t, e, m ?? HIDE), x, 16, k);
    label(p, name, x, 4);
  });
  return p;
}

/** A crop of one frame magnified (x, y, w, h in sprite px). */
export function cropSheet(anim: MonsterAnim, f: number, x: number, y: number, w: number, h: number, k = 6): PixelCanvas {
  const fr = frameOf(anim, f).color;
  const p = new PixelCanvas(w * k, h * k).rect(0, 0, 100000, 100000, PANEL);
  put(p, fr.crop(x, y, w, h), 0, 0, k);
  return p;
}

/** Frames whose opaque pixels come within `m` px of the frame edge (clipping risk). */
export function edgeReport(m = 2): string[] {
  const out: string[] = [];
  for (const anim of MONSTER_ANIMS)
    for (let f = 0; f < art.anims[anim].frames; f++) {
      const b = frameOf(anim, f).color.bounds();
      if (!b) continue;
      const hits: string[] = [];
      if (b.x < m) hits.push(`left ${b.x}`);
      if (b.y < m) hits.push(`top ${b.y}`);
      if (b.x + b.w > art.w - m) hits.push(`right ${b.x + b.w}`);
      if (b.y + b.h > art.h - m) hits.push(`bottom ${b.y + b.h}`);
      out.push(`${anim}:${f} bounds x${b.x}..${b.x + b.w} y${b.y}..${b.y + b.h}${hits.length ? '  EDGE ' + hits.join(' ') : ''}`);
    }
  return out;
}

/** Pixels that differ between idle frame 0 and the first / last frame of every one-shot (pops). */
export function continuityReport(): string[] {
  const ref = frameOf('idle', 0).color.data;
  const diff = (anim: MonsterAnim, f: number) => {
    const d = frameOf(anim, f).color.data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== ref[i] || d[i + 1] !== ref[i + 1] || d[i + 2] !== ref[i + 2] || d[i + 3] !== ref[i + 3]) n++;
    return n;
  };
  const out: string[] = [];
  for (const anim of ['roar', 'attack', 'hit'] as MonsterAnim[]) out.push(`${anim}: first ${diff(anim, 0)} px, last ${diff(anim, art.anims[anim].frames - 1)} px differ from idle:0`);
  out.push(`idle: last→first ${diff('idle', 11)} px (loop step)`);
  return out;
}
