// Neon Tower layout map (docs/v3/ARENA_NEON_TOWER.md §3): the rects of src/view/board-nt/layout-nt.ts
// must agree with layout.ts (the tiles never move), keep the HUD readable, and the flag stays off
// unless ?look=v3&arena=nt.
import { FRAME_H, FRAME_W, SCREEN_AT } from '../../src/art/arena-nt/screens';
import { describe, expect, it } from 'vitest';
import { ARENA_NT } from '../../src/view/board-nt/flag';
import { DUELIST_PADS, FACE_H, PLATE_FULL, PLATE_TOP, HOLOS, KEEP_OUT, PLATE_CORNERS, SCREENS, STANDS, ntIso, ntRegions, rectsOverlap, standsBounds } from '../../src/view/board-nt/layout-nt';
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

  it('keeps the calm platform footprint (left tip at x 104, near corner y 268)', () => {
    expect(PLATE_CORNERS.left).toEqual({ x: 104, y: 144 });
    expect(PLATE_CORNERS.bottom).toEqual({ x: 352, y: 268 });
    expect(PLATE_CORNERS.apex).toEqual({ x: 288, y: 52 });
    expect(PLATE_CORNERS.right).toEqual({ x: 536, y: 176 });
  });

  it('gives the platform a thick armour side (J1: 26..32 px) and a bounding box that includes it', () => {
    expect(FACE_H).toBeGreaterThanOrEqual(26);
    expect(FACE_H).toBeLessThanOrEqual(32);
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
