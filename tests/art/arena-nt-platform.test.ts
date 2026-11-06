import { describe, expect, it } from 'vitest';
import { RAMPS, PAL } from '../../src/art/palette';
import { buildPlatformArt, PLATFORM_BOX } from '../../src/art/arena-nt/platform';
import { buildFloorArt } from '../../src/art/arena-nt/floor';
import { buildPadsArt } from '../../src/art/arena-nt/pads';
import { APRON_BOX, buildApronArt } from '../../src/art/arena-nt/apron';
import { FACE_H } from '../../src/view/board-nt/layout-nt';

const allowed = new Set<number>(Object.values(PAL));
function offPalette(p: { w: number; h: number; data: Uint8ClampedArray }): number {
  let n = 0;
  for (let i = 0; i < p.w * p.h; i++) {
    if (p.data[i * 4 + 3] === 0) continue;
    if (p.data[i * 4 + 3] !== 255) n++;
    else if (!allowed.has((p.data[i * 4] << 16) | (p.data[i * 4 + 1] << 8) | p.data[i * 4 + 2]) && (p.data[i * 4] & p.data[i * 4 + 1] & p.data[i * 4 + 2]) !== 255) n++;
  }
  return n;
}

describe('neon tower platform painters', () => {
  it('paints only PAL colours, fully opaque, with the plate corners in place', () => {
    void RAMPS;
    const a = buildPlatformArt();
    expect(a.canvas.w).toBe(PLATFORM_BOX.w);
    expect(offPalette(a.canvas)).toBe(0);
    // the slab (hedef-gorunum-3 tight block): opaque inside the chamfered octagon, clear outside it. BIG chamfers (round 2):
    // 20-px tall vertical side caps (left x 118, y 137..157; right x 522, y 163..183) and a 52-px flat far edge (268..320, y 62)
    const op = (x: number, y: number): boolean => a.canvas.isOpaque(x - PLATFORM_BOX.x, y - PLATFORM_BOX.y);
    expect(op(294, 63)).toBe(true); // far flat edge (268..320 at y 62)
    expect(op(294, 60)).toBe(false); // above the flat far edge (the far tip is chamfered off)
    expect(op(270, 63)).toBe(true); // near the far edge's left end: still the plate (a wide flat edge, not a tip)
    expect(op(120, 147)).toBe(true); // just inside the left end cap (x 118)
    expect(op(115, 147)).toBe(false); // left of the end cap
    expect(op(110, 147)).toBe(false); // where the old 10-px chamfer ended: cut away now
    expect(op(119, 139)).toBe(true); // the cap is tall: its upper end (y 137) …
    expect(op(119, 155)).toBe(true); // … and its lower end (y 157) are both plate
    expect(op(520, 173)).toBe(true); // just inside the right end cap (x 522)
    expect(op(525, 173)).toBe(false); // right of it
    expect(op(520, 165)).toBe(true); // the right cap is tall too (y 163..183)
    expect(op(427, 120)).toBe(true); // under the upper-right edge (y = 58 + (x − 312) / 2)
    expect(op(427, 112)).toBe(false); // above it: the P2 dais stands behind the stage, not on it
    expect(op(213, 202)).toBe(true); // the plate top just behind the near-left edge (y 204.5 at x 213)
    expect(op(213, 250)).toBe(true); // the near-left wall under the P1 dais (the dais is attached in front of it)
    expect(op(346, 270)).toBe(true); // the near chamfer face
    expect(a.strips.length).toBeGreaterThan(8);
    expect(a.vents.length).toBeGreaterThan(0);
  });
  it('floor and pads atlases are palette-clean and have their frames', () => {
    const f = buildFloorArt();
    const p = buildPadsArt();
    expect(offPalette(f.atlas.canvas)).toBe(0);
    expect(offPalette(p.atlas.canvas)).toBe(0);
    expect(f.atlas.frames.has('slot:0:main:0:0')).toBe(true);
    expect(f.atlas.frames.has('slot:1:main:2:1')).toBe(true);
    expect(f.atlas.frames.has('slot:0:pile:1:0')).toBe(true);
    expect(p.atlas.frames.has('pad:1:3')).toBe(true);
  });
  it('draws a thick slab: FACE_H-px walls with a warm top bevel, panel seams and small lit windows in the player colours', () => {
    const a = buildPlatformArt();
    const at = (x: number, y: number): number | null => a.canvas.get(x - PLATFORM_BOX.x, y - PLATFORM_BOX.y);
    const op = (x: number, y: number): boolean => a.canvas.isOpaque(x - PLATFORM_BOX.x, y - PLATFORM_BOX.y);
    // the near flat edge (y 262) carries FACE_H rows of wall: last row opaque, the one below clear
    expect(op(346, 262 + FACE_H - 1)).toBe(true);
    expect(op(346, 262 + FACE_H + 1)).toBe(false);
    // the left wall's column at x 200 starts under the plate edge (y = 187 + (x − 118) / 2) and is FACE_H tall
    const top = 187 + (200 - 118) / 2;
    expect(op(200, top + FACE_H - 1)).toBe(true);
    expect(op(200, top + FACE_H + 1)).toBe(false);
    // a banded wall: five or more tones down one column of the lit face
    const tones = new Set<number>();
    for (let y = top; y < top + FACE_H; y++) tones.add(at(200, y) ?? -1);
    expect(tones.size).toBeGreaterThanOrEqual(5);
    // grey-slate armour, not navy; round 3: one step darker (lit face body stone1, stone2 only as a highlight)
    expect(tones.has(PAL.stone1)).toBe(true);
    expect(tones.has(PAL.stone3)).toBe(false);
    // round 4: ONE continuous gold rim on the top edge, all the way round: gold2 on the lit and near edges with a gold3 glint
    // every 6 px on the lit ones, gold1 on the shaded near-right edge (no edge left in dull earth)
    const gold = new Set<number>([PAL.gold2, PAL.gold3]);
    expect(at(295, 62)).toBe(PAL.gold2); // far flat edge
    expect(at(294, 62)).toBe(PAL.gold3); // ... with a glint pixel (x % 6 === 0)
    expect(at(118, 147)).toBe(PAL.gold2); // left end cap
    expect(gold.has(at(200, top - 1) ?? -1)).toBe(true); // near-left edge, right above the wall
    expect(at(346, 261)).toBe(PAL.gold2); // near flat edge
    expect(at(450, 218)).toBe(PAL.gold1); // near-right edge (y = 173 + (542 − x) / 2): shaded, one gold step darker
    expect(at(521, 173)).toBe(PAL.gold1); // right end cap (last plate column)
    // panel seams: ink columns cut the lit wall's upper band at least every ~30 px
    const seamXs: number[] = [];
    for (let x = 122; x < 266; x++) if (at(x, 187 + Math.floor((x + 0.5 - 118) / 2) + 8) === PAL.ink) seamXs.push(x);
    expect(seamXs.length).toBeGreaterThanOrEqual(6);
    // small lit windows: cyan on the P1 (near-left) wall, crimson on the far half of the right wall
    const count = (x0: number, x1: number, c: number): number => {
      let n = 0;
      for (let x = x0; x < x1; x++) for (let y = 140; y < 320; y++) if (at(x, y) === c) n++;
      return n;
    };
    // a calm wall — roughly one lit window pair per 3 panels (3-px panes), so a handful of clear lights on each side
    expect(count(118, 326, PAL.cyan3)).toBeGreaterThanOrEqual(18);
    expect(count(118, 326, PAL.cyan3)).toBeLessThanOrEqual(36);
    expect(count(118, 222, PAL.cyan3)).toBeGreaterThanOrEqual(6); // the far half of the P1 wall is lit as well
    expect(count(222, 326, PAL.cyan3)).toBeGreaterThanOrEqual(6);
    // round 4: lights where they are SEEN — two separate cyan window groups in the open span left of the P1 dais (x < 175,
    // above the hint plate), and a crimson pair on the right wall between the P2 dais and the hint plate
    const countIn = (x0: number, x1: number, y0: number, y1: number, c: number): number => {
      let n = 0;
      for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (at(x, y) === c) n++;
      return n;
    };
    expect(countIn(118, 140, 160, 250, PAL.cyan3)).toBeGreaterThanOrEqual(6);
    expect(countIn(140, 170, 160, 250, PAL.cyan3)).toBeGreaterThanOrEqual(6);
    expect(countIn(470, 522, 200, 250, PAL.crim3)).toBeGreaterThanOrEqual(6);
    expect(count(118, 326, PAL.crim3)).toBe(0);
  });
  it('paints the apron (hall floor around the platform) palette-clean, opaque, with rails and lamps', () => {
    const a = buildApronArt();
    expect(a.canvas.w).toBe(APRON_BOX.w);
    expect(offPalette(a.canvas)).toBe(0);
    let clear = 0;
    for (let i = 0; i < a.canvas.w * a.canvas.h; i++) if (a.canvas.data[i * 4 + 3] === 0) clear++;
    expect(clear).toBe(0);
    expect(a.strips.length).toBeGreaterThan(12);
    expect(a.lamps.length).toBeGreaterThan(4);
    for (const s of a.strips) expect(a.fx.frames.has(s.frame)).toBe(true);
  });
});
