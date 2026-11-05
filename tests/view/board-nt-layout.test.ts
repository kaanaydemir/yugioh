// Neon Tower layout map (docs/v3/ARENA_NEON_TOWER.md §3): the rects of src/view/board-nt/layout-nt.ts
// must agree with layout.ts (the tiles never move), keep the HUD readable, and the flag stays off
// unless ?look=v3&arena=nt.
import { FRAME_H, FRAME_W, SCREEN_AT } from '../../src/art/arena-nt/screens';
import { describe, expect, it } from 'vitest';
import { ARENA_NT } from '../../src/view/board-nt/flag';
import { DUELIST_PADS, FACE_H, PLATE_FULL, PLATE_TOP, HOLOS, KEEP_OUT, PLATE_CORNERS, PLATE_OUTLINE, SCREENS, STANDS, ntIso, ntRegions, rectsOverlap, standsBounds } from '../../src/view/board-nt/layout-nt';
import { duelistXY, zoneXY } from '../../src/view/layout';

describe('neon tower layout map', () => {
  it('is off by default (v1 look, no ?arena=nt)', () => {
    expect(ARENA_NT).toBe(false);
  });

  it('projects the platform around the existing tiles: the v1 3+3 board is columns 2..4 of the 7×5 grid', () => {
    for (let i = 0; i < 3; i++) {
      for (const player of [0, 1] as const) {
        const a = zoneXY(player, 'monster', i);
        // v1 grid cell of P1 monster i is (1+i, 3) → 7-col cell (2+i, 3); P2 is the 180° rotation
        const b = player === 0 ? ntIso(2 + i, 3) : ntIso(6 - (2 + i), 4 - 3);
        expect(a).toEqual(b);
      }
    }
  });

  // hedef-gorunum-3 (owner decisions 2026-11-02 / arena pass 2026-11-05): the stage is a tight chamfered block around the tiles
  // (no wide empty margins); the duelists stand on their own raised daises ATTACHED to its two long edges (pads layer): each
  // dais's back edge lies flush on the stage edge — its back tip on the plate, its centre and the rest of it off the plate.
  it('is ONE tight chamfered slab: a convex octagon round the tile grid; each duelist dais sits flush against its long edge', () => {
    expect(PLATE_OUTLINE.length).toBe(8);
    const pts = PLATE_OUTLINE.map(([c, r]) => ntIso(c, r));
    // every vertex lands on a whole pixel and the outline is convex (all turns the same way)
    for (const p of pts) {
      expect(Number.isInteger(Math.round(p.x * 1e6) / 1e6)).toBe(true);
      expect(Number.isInteger(Math.round(p.y * 1e6) / 1e6)).toBe(true);
    }
    let sign = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const c = pts[(i + 2) % pts.length];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      expect(cross).not.toBe(0);
      if (sign === 0) sign = Math.sign(cross);
      expect(Math.sign(cross)).toBe(sign);
    }
    const inside = (x: number, y: number): boolean => {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) === -sign) return false;
      }
      return true;
    };
    // the four outer vertices of every tile diamond (7×5 grid, 64×32 cells) and the pad diamonds' vertices
    for (let col = 0; col < 7; col++)
      for (let row = 0; row < 5; row++) {
        const t = ntIso(col, row);
        for (const [dx, dy] of [[-32, 0], [32, 0], [0, -16], [0, 16]]) expect(inside(t.x + dx, t.y + dy), `tile ${col},${row}`).toBe(true);
      }
    // tight: no tile-free margin wider than 0.6 tile on any side (each extreme vertex lies close to the grid's own corner)
    const grid = { left: ntIso(0, 4).x - 32, right: ntIso(6, 0).x + 32, far: ntIso(0, 0).y - 16, near: ntIso(6, 4).y + 16 };
    expect(grid.left - PLATE_TOP.x).toBeLessThanOrEqual(24);
    expect(PLATE_TOP.x + PLATE_TOP.w - grid.right).toBeLessThanOrEqual(24);
    expect(grid.far - PLATE_TOP.y).toBeLessThanOrEqual(12);
    expect(PLATE_TOP.y + PLATE_TOP.h - grid.near).toBeLessThanOrEqual(12);
    // arena pass round 2: an OCTAGON, not a rhombus with nicked tips — big chamfers: both vertical end caps ≥ 16 px tall,
    // the flat far edge ≥ 48 px wide; the flat near edge stays 328..364 (the lighting split)
    const len = (i: number): number => Math.hypot(pts[(i + 1) % 8].x - pts[i].x, pts[(i + 1) % 8].y - pts[i].y);
    expect(pts[0].x).toBe(pts[1].x); // left cap is vertical
    expect(pts[4].x).toBe(pts[5].x); // right cap is vertical
    expect(len(0)).toBeGreaterThanOrEqual(16);
    expect(len(4)).toBeGreaterThanOrEqual(16);
    expect(pts[2].y).toBe(pts[3].y);
    expect(len(2)).toBeGreaterThanOrEqual(48);
    expect([Math.round(pts[7].x), Math.round(pts[6].x)]).toEqual([328, 364]);
    for (const p of [0, 1] as const) {
      const d = duelistXY(p);
      // the 40×20 pad diamond around the feet: its back edge (P1: top → right tip; P2: left → bottom tip, parallel to the stage
      // edge) is on the plate, 2 px further in (towards the pad centre) is already off it — flush, neither floating off the
      // edge nor standing on the stage top
      const back = p === 0 ? { x: d.x, y: d.y - 10 } : { x: d.x, y: d.y + 10 };
      const inward = p === 0 ? 2 : -2;
      expect(inside(back.x, back.y), `dais ${p} back tip on the plate`).toBe(true);
      expect(inside(back.x, back.y + inward), `dais ${p} flush`).toBe(false);
      expect(inside(d.x, d.y), `dais ${p} centre off the plate`).toBe(false);
      expect(inside(d.x + (p === 0 ? 20 : -20), d.y), `dais ${p} back edge's other end`).toBe(true);
      const others = (p === 0 ? [[-20, 0], [0, 10]] : [[20, 0], [0, -10]]).map(([dx, dy]) => inside(d.x + dx, d.y + dy));
      expect(others.some(Boolean), `dais ${p} rest off the plate`).toBe(false);
    }
  });

  it('keeps the platform inside the left panel edge, the HUD hint plate and the frame', () => {
    expect(PLATE_TOP.x).toBeGreaterThanOrEqual(104);
    expect(PLATE_TOP.x + PLATE_TOP.w).toBeLessThanOrEqual(640 - 104);
    expect(PLATE_TOP.y).toBeGreaterThanOrEqual(52);
    expect(PLATE_FULL.y + PLATE_FULL.h).toBeLessThanOrEqual(320);
    // the near-right corner (outline index 6) is where lights.ts splits blue / crimson
    expect(Math.round(ntIso(PLATE_OUTLINE[6][0], PLATE_OUTLINE[6][1]).x)).toBe(364);
    expect(PLATE_CORNERS.left.x).toBe(PLATE_TOP.x);
    expect(PLATE_CORNERS.right.x).toBe(PLATE_TOP.x + PLATE_TOP.w);
  });

  it('gives the platform a THICK armour side (J4: 45..60 px) and a bounding box that includes it', () => {
    expect(FACE_H).toBeGreaterThanOrEqual(45);
    expect(FACE_H).toBeLessThanOrEqual(60);
    expect(PLATE_FULL.y + PLATE_FULL.h).toBe(PLATE_TOP.y + PLATE_TOP.h + FACE_H);
  });

  it('centres each duelist pad on the duelist feet', () => {
    for (const p of [0, 1] as const) {
      const d = duelistXY(p);
      const r = DUELIST_PADS[p];
      expect(Math.abs(r.x + r.w / 2 - d.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.y + r.h / 2 - d.y)).toBeLessThanOrEqual(14);
    }
  });

  it('keeps every readable region clear of the HUD', () => {
    for (const reg of ntRegions()) {
      if (reg.hud !== 'clear') continue;
      for (const [name, k] of Object.entries(KEEP_OUT)) expect(rectsOverlap(reg.rect, k), `${reg.name} vs ${name}`).toBe(false);
    }
  });

  it('keeps the screens, holograms and stands inside the frame and off the platform top edge band', () => {
    for (const s of SCREENS) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(640);
      expect(s.w).toBe(FRAME_W);
      expect(s.h).toBe(FRAME_H);
      expect({ x: s.x, y: s.y }).toEqual(SCREEN_AT[SCREENS.indexOf(s)]);
    }
    for (const h of HOLOS) {
      expect(h.box.x).toBeGreaterThanOrEqual(0);
      expect(h.box.x + h.box.w).toBeLessThanOrEqual(640);
    }
    for (const b of STANDS) {
      const r = standsBounds(b);
      expect(r.x + r.w).toBeLessThanOrEqual(640);
      expect(r.y).toBeGreaterThan(100);
      // clear of the always-visible HUD and of the hologram corners (x<150,y<150 / x>490,y<150)
      for (const k of ['hint', 'p1Panel', 'hand', 'buttons', 'p2Panel', 'toolbar', 'phaseBar']) expect(rectsOverlap(r, KEEP_OUT[k]), `stand ${b.side} vs ${k}`).toBe(false);
    }
  });
});
