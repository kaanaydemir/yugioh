// Kor Kurdu HD — dev contact sheets (pure PixelCanvas, Node or browser). Driven by shots.mjs in
// this folder → shots/hd/ember_wolf/*.png. Not used by the trial page.
//
//   animSheet(anim, cols, k)     every frame of an animation (impact frame marked)
//   compareSheet()               CURRENT sprite ×3 next to the HD sprite ×2 (same size on a 1080p screen)
//   tileSheet()                  both sprites at 1× on their iso tiles (64×32 / 96×48), then ×3 / ×2
//   mapSheet(anim, kind)         normal maps / emissive masks / CPU re-light
//   onionSheet(anim, frames)     onion-skin silhouettes (motion arcs)
//   zoomSheet / cropSheet / currentZoom

import { PixelCanvas } from '../../../art/pixel';
import { PAL } from '../../../art/palette';
import { drawGlyph, getFont } from '../../../art/font';
import { monsterArt } from '../../../art/monsters';
import { MONSTER_ANIMS, type MonsterAnim } from '../../../art/types';
import { type HDRenderResult, drawDropShadow, relight } from '../../render';
import art from '../ember_wolf';

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
  label(p, `KOR KURDU HD  ${anim.toUpperCase()}  ${n} KARE @${art.anims[anim].fps}`, 4, 3, PAL.gold3);
  let ms = 0;
  for (let f = 0; f < n; f++) {
    const x = 4 + (f % cols) * (fw + 4);
    const y = 16 + Math.floor(f / cols) * (fh + 14);
    p.rect(x, y, fw, fh, PANEL);
    const fr = frameOf(anim, f);
    ms += fr.ms;
    p.hline(x, x + fw - 1, y + art.anchorY * k, PAL.night2);
    put(p, fr.color, x, y, k);
    const imp = anim === 'attack' && f === art.attackImpactFrame;
    label(p, `${f}${imp ? ' IMPACT' : ''}`, x + 2, y + fh + 2, imp ? PAL.crim3 : PAL.mist);
    if (imp) {
      p.frame(x - 1, y - 1, fw + 2, fh + 2, PAL.crim3);
      const m = art.muzzle;
      p.set(x + m.x * k, y + m.y * k, PAL.cyan3);
    }
  }
  label(p, `${(ms / n).toFixed(1)} MS/KARE`, p.w - 70, 3, PAL.steel);
  return p;
}

export function allSheet(): PixelCanvas {
  const sheets = MONSTER_ANIMS.map((a) => animSheet(a, 8, 1));
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

/** Current (64×64, ×3) vs HD (128×128, ×2): both as they appear on a 1080p screen. */
export function compareSheet(
  pairs: [MonsterAnim, number, number][] = [
    ['idle', 0, 0],
    ['attack', 5, 7],
    ['roar', 4, 6],
    ['guard', 0, 0],
  ],
): PixelCanvas {
  const cur = monsterArt('ember_wolf');
  const cw = cur.w * 3;
  const hw = art.w * 2;
  const ph = Math.max(cur.h * 3, art.h * 2);
  const p = new PixelCanvas(pairs.length * (cw + hw + 24) + 8, ph + 26).rect(0, 0, 100000, 1000, BG);
  pairs.forEach(([anim, fc, fh], i) => {
    const x = 8 + i * (cw + hw + 24);
    const c = new PixelCanvas(cur.w, cur.h);
    cur.draw(c, anim, fc);
    const gy = 18 + ph - 14;
    p.rect(x, 18, cw, ph, PANEL);
    put(p, c, x + Math.round(cw / 2 - cur.anchorX * 3), gy - cur.anchorY * 3, 3);
    p.rect(x + cw + 4, 18, hw, ph, PANEL);
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
export function tileSheet(anim: MonsterAnim = 'idle', fc = 0, fh = 0): PixelCanvas {
  const cur = monsterArt('ember_wolf');
  const sc = new PixelCanvas(120, 90).rect(0, 0, 120, 90, PAL.night1);
  isoTile(sc, 60, 70, 64, 32, PAL.night2, PAL.crim1);
  isoTile(sc, 60 - 64, 70 - 16, 64, 32, PAL.night2, PAL.night3);
  const cc = new PixelCanvas(cur.w, cur.h);
  cur.draw(cc, anim, fc);
  drawDropShadow(sc, [60, 70], 16, 5);
  put(sc, cc, 60 - cur.anchorX, 70 - cur.anchorY);
  const sh = new PixelCanvas(180, 135).rect(0, 0, 180, 135, PAL.night1);
  isoTile(sh, 90, 105, 96, 48, PAL.night2, PAL.crim1);
  isoTile(sh, 90 - 96, 105 - 24, 96, 48, PAL.night2, PAL.night3);
  drawDropShadow(sh, [90, 105], 26, 8);
  put(sh, frameOf(anim, fh).color, 90 - art.anchorX, 105 - art.anchorY);
  const p = new PixelCanvas(8 + 120 + 8 + 180 + 8 + 360 + 8 + 360 + 8, 16 + 270 + 8).rect(0, 0, 10000, 1000, BG);
  label(p, 'ŞU AN 1×', 8, 4);
  put(p, sc, 8, 16);
  label(p, 'HD 1×', 136, 4, PAL.gold3);
  put(p, sh, 136, 16);
  label(p, 'ŞU AN ×3 (1080P)', 324, 4);
  put(p, sc, 324, 16, 3);
  label(p, 'HD ×2 (1080P)', 692, 4, PAL.gold3);
  put(p, sh, 692, 16, 2);
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
      // P2 setup: dim navy ambient, crimson side light from the upper right, warm fire light low
      c = relight(
        fr,
        [
          { pos: [140, 10, 60], color: PAL.crim3, intensity: 1.1, radius: 220 },
          { pos: [-20, 40, 80], color: 0xfff2d0, intensity: 0.5 },
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
  const cols = [PAL.night3, PAL.night4, PAL.steel, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.white];
  frames.forEach((f, i) => {
    const fr = frameOf(anim, f);
    const col = cols[Math.min(cols.length - 1, Math.round((i / Math.max(1, frames.length - 1)) * (cols.length - 1)))];
    const s = new PixelCanvas(art.w, art.h);
    for (let y = 0; y < art.h; y++)
      for (let x = 0; x < art.w; x++) {
        if (!fr.color.isOpaque(x, y)) continue;
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
  p.hline(0, art.w * k - 1, art.anchorY * k, PAL.night2);
  put(p, frameOf(anim, f).color, 0, 0, k);
  return p;
}

/** A crop of one frame magnified (x, y, w, h in sprite px). */
export function cropSheet(anim: MonsterAnim, f: number, x: number, y: number, w: number, h: number, k = 6): PixelCanvas {
  const fr = frameOf(anim, f).color;
  const p = new PixelCanvas(w * k, h * k).rect(0, 0, 100000, 100000, PANEL);
  put(p, fr.crop(x, y, w, h), 0, 0, k);
  return p;
}

/** The CURRENT (shipped) 64×64 sprite magnified. */
export function currentZoom(anim: MonsterAnim, f: number, k = 8): PixelCanvas {
  const cur = monsterArt('ember_wolf');
  const c = new PixelCanvas(cur.w, cur.h);
  cur.draw(c, anim, f);
  const p = new PixelCanvas(cur.w * k, cur.h * k).rect(0, 0, 100000, 100000, PANEL);
  put(p, c, 0, 0, k);
  return p;
}

/** Timing report of every frame (ms per frame under the current runtime). */
export function timing(): string[] {
  const out: string[] = [];
  for (const a of MONSTER_ANIMS) {
    const n = art.anims[a].frames;
    let ms = 0;
    let mx = 0;
    for (let f = 0; f < n; f++) {
      const fr = frameOf(a, f);
      ms += fr.ms;
      mx = Math.max(mx, fr.ms);
    }
    out.push(`${a}: ${n} frames, avg ${(ms / n).toFixed(1)} ms, max ${mx.toFixed(1)} ms`);
  }
  return out;
}
