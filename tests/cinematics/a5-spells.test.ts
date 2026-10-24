// Lane A5-A (docs/v3/A5_PLAN.md §6.5). Step A-1: the shared kit — the motif contract S-12
// (src/art/spellmotifs-v3.ts, read by lane A5-B's card art) and the pure helpers of the effect kit
// (src/cinematics/_v3/spellfx.ts). Later steps add the scene checks of §6.5 to this file.

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import * as M from '../../src/art/spellmotifs-v3';
import { fxCount, fxRng, nearestDir, stepDown, swordFor } from '../../src/cinematics/_v3/spellfx';

const PALETTE = new Set<number>(Object.values(PAL));

/** Every opaque pixel is a PAL colour at full alpha (no blends, no alpha: REHBER EF-7, MA-4). */
function paletteOnly(p: PixelCanvas): { ok: boolean; bad: string[] } {
  const bad: string[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const a = p.alpha(x, y);
      if (a === 0) continue;
      const c = p.get(x, y)!;
      if (a !== 255 || !PALETTE.has(c)) bad.push(`${x},${y}:${c.toString(16)}@${a}`);
    }
  return { ok: bad.length === 0, bad: bad.slice(0, 5) };
}

function hash(p: PixelCanvas): string {
  let h = 2166136261;
  for (const v of p.data) h = Math.imul(h ^ v, 16777619) >>> 0;
  return `${p.w}x${p.h}:${h.toString(16)}`;
}

const SWORD_VARIANTS: M.SwordOpts[] = [];
for (const angle of ['up', 'diag', 'flat'] as const)
  for (const facing of [1, -1] as const) {
    SWORD_VARIANTS.push({ angle, facing });
    SWORD_VARIANTS.push({ angle, facing, crack: true });
    SWORD_VARIANTS.push({ angle, facing, glint: 0.3, glintCross: true });
  }
SWORD_VARIANTS.push({ stage: 1 }, { stage: 2 }, { rim: 'white' }, { len: 18 });

describe('A-1 motifs (S-12): palette, determinism, contract', () => {
  it('every sword drawing is palette-only, deterministic, and has an ink outline (white on the bond frame)', () => {
    for (const o of SWORD_VARIANTS) {
      const a = M.swordMotif(o);
      const b = M.swordMotif(o);
      expect(hash(a.px), JSON.stringify(o)).toBe(hash(b.px));
      const pc = paletteOnly(a.px);
      expect(pc.ok, `${JSON.stringify(o)} ${pc.bad.join(' ')}`).toBe(true);
      // anchor inside the canvas
      expect(a.ax).toBeGreaterThanOrEqual(0);
      expect(a.ay).toBeGreaterThanOrEqual(0);
      expect(a.ax).toBeLessThan(a.px.w);
      expect(a.ay).toBeLessThan(a.px.h);
    }
    const ink = M.swordMotif({});
    const white = M.swordMotif({ rim: 'white' });
    let inkCount = 0;
    let whiteCount = 0;
    for (let y = 0; y < ink.px.h; y++)
      for (let x = 0; x < ink.px.w; x++) {
        if (ink.px.get(x, y) === PAL.ink) inkCount++;
        if (white.px.get(x, y) === PAL.white) whiteCount++;
      }
    expect(inkCount).toBeGreaterThan(20);
    expect(whiteCount).toBeGreaterThan(inkCount); // the outline turned white (plus the blade's white edge)
  });

  it('the aura sword is about 7×20 (A5 §3.1): the upright drawing ≈ 9 × 21 with its outline', () => {
    const b = M.swordMotif({}).px.bounds()!;
    expect(b.w).toBeGreaterThanOrEqual(8);
    expect(b.w).toBeLessThanOrEqual(10);
    expect(b.h).toBeGreaterThanOrEqual(19);
    expect(b.h).toBeLessThanOrEqual(23);
  });

  it('the P2 drawings are their own drawings, not mirrors (light stays at the screen top left)', () => {
    for (const angle of ['diag', 'flat'] as const) {
      const p1 = M.swordMotif({ angle, facing: 1 }).px;
      const p2 = M.swordMotif({ angle, facing: -1 }).px;
      expect(hash(p2), angle).not.toBe(hash(p1.flippedX()));
    }
    // the upright sword is lit from the left for both players: one drawing
    expect(hash(M.swordMotif({ angle: 'up', facing: -1 }).px)).toBe(hash(M.swordMotif({ angle: 'up', facing: 1 }).px));
  });

  it('honeycomb: the 2-3-2 panel is 25×24, shared edges coincide (one frame line), faces never overlap', () => {
    const p = new PixelCanvas(40, 40);
    M.paintHoneycomb(p, 2, 2, M.HONEYCOMB_7.map(() => ({})), M.HONEYCOMB_7, { outline: false });
    const b = p.bounds()!;
    expect([b.w, b.h]).toEqual([M.HONEYCOMB_7_SIZE.w, M.HONEYCOMB_7_SIZE.h]);
    expect(paletteOnly(p).ok).toBe(true);
    // a face pixel of one cell is never inside another cell's face
    const faces = new Map<string, number>();
    M.HONEYCOMB_7.forEach((c, i) => {
      for (const q of M.hexFacePixels()) {
        const k = `${c.x + q.x},${c.y + q.y}`;
        expect(faces.has(k), `cell ${i} overlaps cell ${faces.get(k)} at ${k}`).toBe(false);
        faces.set(k, i);
      }
    });
    // neighbouring cells share their edge: the centre cell's frame pixels are all mag2 (no double lines)
    let frame = 0;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === PAL.mag2) frame++;
    expect(frame).toBeGreaterThan(60);
    expect(frame).toBeLessThan(140);
    // ring distances: the centre's neighbours are ring 1, the far cells ring 2
    const ring = M.HONEYCOMB_7.map((c) => Math.round(M.hexRing(M.HONEYCOMB_7[3], c)));
    expect(ring).toEqual([1, 1, 1, 0, 1, 1, 1]);
    expect(Math.round(M.hexRing(M.HONEYCOMB_7[0], M.HONEYCOMB_7[6]))).toBe(2);
  });

  it('chain links, columns, flames, chasm and crack are palette-only and deterministic', () => {
    for (const size of ['sm', 'lg'] as const)
      for (const angle of [0, 45, 90, 135] as const)
        for (const face of [true, false]) {
          const m = M.chainLinkMotif({ angle, size, face });
          expect(paletteOnly(m.px).ok, `${size} ${angle} ${face}`).toBe(true);
          expect(hash(m.px)).toBe(hash(M.chainLinkMotif({ angle, size, face }).px));
        }
    const draw = (f: (p: PixelCanvas) => void) => {
      const a = new PixelCanvas(120, 80);
      const b = new PixelCanvas(120, 80);
      f(a);
      f(b);
      expect(hash(a)).toBe(hash(b));
      const pc = paletteOnly(a);
      expect(pc.ok, pc.bad.join(' ')).toBe(true);
      return a;
    };
    draw((p) => {
      for (const ph of [0, 1, 2]) M.paintSpringColumn(p, 10 + ph * 12, 70, 34, { phase: ph });
      M.paintPool(p, 70, 72, 14);
    });
    draw((p) => {
      for (const ph of [0, 1, 2]) M.paintLavaColumn(p, 12 + ph * 14, 70, 24, { phase: ph });
      for (const f of [0, 1, 2]) M.paintFlameTongue(p, 70 + f * 8, 60, f);
      for (const c of [1, 2, 3] as const) M.paintFlameTongue(p, 70 + c * 8, 75, 0, { cool: c });
    });
    draw((p) => {
      for (const step of [0, 1, 2] as const) M.paintChasm(p, 20 + step * 40, 40, 18, 9, { step, crack: 1 });
      M.paintCrack(p, M.crackPath({ x: 2, y: 78 }, { x: 110, y: 60 }, 3), 999);
    });
    draw((p) => M.paintChain(p, 4, 4, 100, 60, { glintAt: 2 }));
  });

  it('the column heights of the storyboards fit (spring 34 px, 5 wide; lava 24 px, 8 wide) and h 0 draws nothing', () => {
    const p = new PixelCanvas(40, 60);
    M.paintSpringColumn(p, 20, 50, 34, { crown: false });
    const b = p.bounds()!;
    expect(b.h).toBe(34);
    expect(b.w).toBe(M.SPRING_W + 2); // + the 1-px foam lip on each side at the base
    const q = new PixelCanvas(40, 60);
    M.paintLavaColumn(q, 20, 50, 0);
    expect(q.bounds()).toBeNull();
  });

  it('the crack path is connected, whole-pixel and runs end to end', () => {
    const a = { x: 3, y: 40 };
    const b = { x: 120, y: 7 };
    const path = M.crackPath(a, b, 11, 3);
    expect(path[0]).toEqual(a);
    expect(path[path.length - 1]).toEqual(b);
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i].x - path[i - 1].x) <= 1 && Math.abs(path[i].y - path[i - 1].y) <= 1, `gap at ${i}`).toBe(true);
    }
    expect(M.crackPath(a, b, 11, 3)).toEqual(path);
  });

  it('chasm geometry: closed has no hole, the hole opens in steps, the lip runs left → right past the pad', () => {
    const g0 = M.chasmGeometry(100, 50, 26, 13, 0);
    const g1 = M.chasmGeometry(100, 50, 26, 13, 1);
    const g2 = M.chasmGeometry(100, 50, 26, 13, 2);
    expect(g0.hole.rx).toBe(0);
    expect(g1.hole.rx).toBeGreaterThan(0);
    expect(g2.hole.rx).toBeGreaterThan(g1.hole.rx);
    expect(g2.slabs.length).toBe(3);
    const lip = g2.lip;
    for (let i = 1; i < lip.length; i++) expect(lip[i].x).toBeGreaterThanOrEqual(lip[i - 1].x);
    expect(lip[0].x).toBeLessThan(100 - 26);
    expect(lip[lip.length - 1].x).toBeGreaterThan(100 + 26);
  });
});

describe('A-1 effect kit: pure helpers', () => {
  it('nearest pre-drawn angle (no fractional rotation): travel picks up / 45° / flat for both facings', () => {
    expect(swordFor(0, -10)).toEqual({ angle: 'up', facing: 1 });
    expect(swordFor(10, -10)).toEqual({ angle: 'diag', facing: 1 });
    expect(swordFor(-10, -9)).toEqual({ angle: 'diag', facing: -1 });
    expect(swordFor(10, 1)).toEqual({ angle: 'flat', facing: 1 });
    expect(swordFor(-10, 2)).toEqual({ angle: 'flat', facing: -1 });
    expect(nearestDir(0, 0, [{ x: 1, y: 0 }])).toBe(0);
  });

  it('reduced motion halves particles (never to 0), the seeded stream repeats, palette steps go down a ramp', () => {
    expect(fxCount(8, false)).toBe(8);
    expect(fxCount(8, true)).toBe(4);
    expect(fxCount(1, true)).toBe(1);
    expect(fxCount(0, true)).toBe(0);
    const a = fxRng(42);
    const b = fxRng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
    const ramp = [PAL.gold1, PAL.gold2, PAL.gold3];
    expect(stepDown(ramp, PAL.gold3)).toBe(PAL.gold2);
    expect(stepDown(ramp, PAL.gold1)).toBeNull();
  });
});
