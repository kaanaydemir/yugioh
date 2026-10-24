// Lane A5-A step A-2 — Ejder Kılıcı v3 (docs/v3/A5_PLAN.md §3.1): the signature great sword (palette,
// size ≥ the old forge's 15×46 sword, stages, rim, crack), the equip anchor and the waist ring, the
// break's shards, the bond pose plan, the flight (path, drawings, the drawing plan with no one-frame
// flicks), the lying card's art window, and when a statChange is a blade's loss.
// (Kept in its own file: tests/cinematics/a5-spells.test.ts is being edited by a parallel step.)

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { ISO_TEX_H, ISO_TEX_W } from '../../src/art/cards';
import { greatSwordMotif, type GreatSwordOpts, type MotifFacing, type SwordAngle } from '../../src/art/spellmotifs-v3';
import { anchorFromFrame, ringPixels, swordShardPoints } from '../../src/duel/auras-v3';
import {
  PLAN_MIN_RUN,
  PLAN_SAMPLES,
  bladeLost,
  bondPosePlan,
  flightDrawing,
  flightEase,
  flightPath,
  flightPlan,
  inArtWindow,
  planAt,
  type FlightDrawing,
  type StatEv,
} from '../../src/cinematics/spells/_blade_v3';
import type { MonsterUnit } from '../../src/duel/MonsterUnit';

const PALETTE = new Set<number>(Object.values(PAL));
const GOLD = new Set<number>([PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4]);

function paletteOnly(p: PixelCanvas): string[] {
  const bad: string[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const a = p.alpha(x, y);
      if (a === 0) continue;
      const c = p.get(x, y)!;
      if (a !== 255 || !PALETTE.has(c)) bad.push(`${x},${y}:${c.toString(16)}@${a}`);
    }
  return bad.slice(0, 5);
}

function count(p: PixelCanvas, c?: number): number {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.alpha(x, y) > 0 && (c === undefined || p.get(x, y) === c)) n++;
  return n;
}

function hash(p: PixelCanvas): string {
  let h = 2166136261;
  for (const v of p.data) h = Math.imul(h ^ v, 16777619) >>> 0;
  return `${p.w}x${p.h}:${h.toString(16)}`;
}

const DRAWINGS: { angle: SwordAngle; facing: MotifFacing }[] = [
  { angle: 'up', facing: 1 },
  { angle: 'diag', facing: 1 },
  { angle: 'diag', facing: -1 },
  { angle: 'flat', facing: 1 },
  { angle: 'flat', facing: -1 },
];

describe('A-2 the great sword (the signature blade)', () => {
  it('every drawing is palette-only, deterministic, and its anchor lies inside it', () => {
    const variants: GreatSwordOpts[] = [{}, { rim: 'white' }, { crack: true }, { runesLit: true }, { glint: 0.5, glintCross: true }, { stage: 1 }, { stage: 2 }];
    for (const d of DRAWINGS)
      for (const v of variants) {
        if (v.stage && d.angle !== 'up') continue;
        const a = greatSwordMotif({ ...v, ...d });
        expect(paletteOnly(a.px)).toEqual([]);
        expect(hash(a.px)).toBe(hash(greatSwordMotif({ ...v, ...d }).px));
        expect(a.ax).toBeGreaterThanOrEqual(0);
        expect(a.ay).toBeGreaterThanOrEqual(0);
        expect(a.ax).toBeLessThan(a.px.w);
        expect(a.ay).toBeLessThan(a.px.h);
      }
  });

  it('is never smaller than the old forge sword (15 × 46) and much bigger than the aura sword', () => {
    const up = greatSwordMotif({});
    expect(up.px.w).toBeGreaterThanOrEqual(15);
    expect(up.px.h).toBeGreaterThanOrEqual(46);
    // the 45° and flat drawings are as long on screen as the upright one (≥ 40 px along their axis)
    const diag = greatSwordMotif({ angle: 'diag', facing: 1 });
    expect(Math.min(diag.px.w, diag.px.h)).toBeGreaterThanOrEqual(30);
    const flat = greatSwordMotif({ angle: 'flat', facing: 1 });
    expect(flat.px.w).toBeGreaterThanOrEqual(46);
  });

  it('forms in three growing stages; the bond rim and the crack add white, the runes light up', () => {
    const s1 = count(greatSwordMotif({ stage: 1 }).px);
    const s2 = count(greatSwordMotif({ stage: 2 }).px);
    const s3 = count(greatSwordMotif({ stage: 3 }).px);
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
    const base = count(greatSwordMotif({}).px, PAL.white);
    expect(count(greatSwordMotif({ rim: 'white' }).px, PAL.white)).toBeGreaterThan(base + 40);
    expect(count(greatSwordMotif({ crack: true }).px, PAL.white)).toBeGreaterThan(base);
    expect(hash(greatSwordMotif({ runesLit: true }).px)).not.toBe(hash(greatSwordMotif({}).px));
    // the mirrored diagonal is a different drawing (the light stays top left), not a flipped copy
    const r = greatSwordMotif({ angle: 'diag', facing: 1 }).px;
    const l = greatSwordMotif({ angle: 'diag', facing: -1 }).px;
    let mirrored = r.w === l.w && r.h === l.h;
    for (let y = 0; mirrored && y < r.h; y++) for (let x = 0; mirrored && x < r.w; x++) if (r.get(x, y) !== l.get(r.w - 1 - x, y)) mirrored = false;
    expect(mirrored).toBe(false);
  });
});

describe('A-2 the equip anchor, the waist ring, the shards', () => {
  // a 30 × 40 frame: an opaque body x 8…21, y 6…39 (feet at the bottom)
  const frame = {
    w: 30,
    h: 40,
    isOpaque: (x: number, y: number) => x >= 8 && x <= 21 && y >= 6 && y <= 39,
    bounds: () => ({ x: 8, y: 6, w: 14, h: 34 }),
  };
  const art = { w: 30, h: 40, anchorX: 15, anchorY: 39, core: { x: 17, y: 25 } };

  it('sits behind the back at 42 % of the body height, mirrored for P2; the ring on the core', () => {
    const p1 = anchorFromFrame(frame, art, false);
    // guard row 6 + round(34 × 0.42) = 20; back edge x 8 → 4 px outside it
    expect(p1).toEqual({ dx: 8 - 4 - 15, dy: 20 - 39, ringDx: 2, ringDy: 25 - 39, rx: 10, ry: 5, side: -1 });
    const p2 = anchorFromFrame(frame, art, true);
    expect(p2.dx).toBe(-p1.dx);
    expect(p2.ringDx).toBe(-p1.ringDx);
    expect(p2.dy).toBe(p1.dy);
    expect(p2.side).toBe(1);
    // a wide body: the ring grows with it but never past 24
    const wide = anchorFromFrame({ ...frame, w: 90, isOpaque: (x, y) => x >= 4 && x <= 85 && y >= 6 && y <= 39, bounds: () => ({ x: 4, y: 6, w: 82, h: 34 }) }, { ...art, w: 90 }, false);
    expect(wide.rx).toBe(24);
    expect(wide.ry).toBe(12);
  });

  it('the ring: each pixel once, on the 2:1 ellipse, clockwise on screen from its start', () => {
    for (const [rx, ry] of [
      [10, 5],
      [24, 12],
      [34, 17],
    ] as const) {
      const pts = ringPixels(100, 80, rx, ry, 0);
      expect(new Set(pts.map((q) => `${q.x},${q.y}`)).size).toBe(pts.length);
      expect(pts[0]).toEqual({ x: 100 + rx, y: 80 });
      // clockwise on screen (y down): from the right-hand point the ring goes down first
      const next = pts.find((q) => q.y !== 80)!;
      expect(next.y).toBeGreaterThan(80);
      for (const q of pts) {
        const e = ((q.x - 100) / rx) ** 2 + ((q.y - 80) / ry) ** 2;
        expect(Math.abs(e - 1)).toBeLessThan(0.45);
      }
      // closed: it reaches every quadrant
      expect(pts.some((q) => q.x < 100 && q.y < 80) && pts.some((q) => q.x > 100 && q.y > 80)).toBe(true);
    }
  });

  it("the break's blade shards: 7 (aura sword) / 8 (great sword), gold tones only, on the sword", () => {
    for (const great of [false, true]) {
      const pts = swordShardPoints(200, 120, 5, great);
      expect(pts.length).toBe(great ? 8 : 7);
      for (const q of pts) {
        expect(GOLD.has(q.c)).toBe(true);
        expect(Math.abs(q.x - 200)).toBeLessThanOrEqual(great ? 9 : 5);
        expect(q.y).toBeGreaterThanOrEqual(120 - (great ? 36 : 16));
        expect(q.y).toBeLessThanOrEqual(120 + (great ? 14 : 8));
      }
      expect(swordShardPoints(200, 120, 5, great)).toEqual(pts);
    }
  });
});

describe('A-2 the bond pose', () => {
  it('victory forward to its peak (each frame ≤ 70 ms), the peak held 160 ms, back down a step of 40 to f0', () => {
    const plan = bondPosePlan([60, 90, 50, 120, 80, 80], 3);
    expect(plan.map((s) => s.f)).toEqual([0, 1, 2, 3, 2, 1, 0]);
    expect(plan.map((s) => s.ms)).toEqual([60, 70, 50, 160, 40, 40, 40]);
    expect(plan[plan.length - 1].f).toBe(0);
    // a peak outside the anim is clamped onto it
    expect(bondPosePlan([60, 60], 9).map((s) => s.f)).toEqual([0, 1, 0]);
    // slow source holds are capped: peak 4 of a slow anim = 4 × 70 forward + 160 + 4 × 40 back
    const long = bondPosePlan(Array(12).fill(200), 4);
    expect(long.reduce((s, x) => s + x.ms, 0)).toBe(4 * 70 + 160 + 4 * 40);
  });
});

describe('A-2 the flight', () => {
  const same = (a: FlightDrawing, b: FlightDrawing) => a.angle === b.angle && (a.angle === 'up' || a.facing === b.facing);
  const runsOf = (plan: FlightDrawing[]) => {
    const runs: { d: FlightDrawing; n: number }[] = [];
    for (const d of plan) {
      const last = runs[runs.length - 1];
      if (last && same(last.d, d)) last.n++;
      else runs.push({ d, n: 1 });
    }
    return runs;
  };

  it('the path runs from the forged sword to the anchor; the ease starts fast and lands at 1', () => {
    const from = { x: 257, y: 190 };
    const to = { x: 278, y: 154 };
    const p = flightPath(from, to, -1);
    expect(p[0]).toEqual(from);
    expect(p[3]).toEqual(to);
    expect(flightEase(0)).toBe(0);
    expect(flightEase(1)).toBe(1);
    expect(flightEase(0.25)).toBeGreaterThan(0.4);
    for (let t = 0.05; t < 1; t += 0.05) expect(flightEase(t)).toBeGreaterThan(flightEase(t - 0.05));
  });

  it('drawings: the closest angle while it rises or crosses; upright while it barely moves or comes down', () => {
    expect(flightDrawing({ x: 0, y: 0 })).toEqual({ angle: 'up', facing: 1 });
    expect(flightDrawing({ x: 6, y: 20 })).toEqual({ angle: 'up', facing: 1 });
    expect(flightDrawing({ x: 0, y: -30 }).angle).toBe('up');
    expect(flightDrawing({ x: 20, y: -20 })).toEqual({ angle: 'diag', facing: 1 });
    expect(flightDrawing({ x: -20, y: -20 })).toEqual({ angle: 'diag', facing: -1 });
    expect(flightDrawing({ x: -30, y: -2 })).toEqual({ angle: 'flat', facing: -1 });
  });

  it('the plan: one drawing per 5 ms, upright at both ends, no drawing shown for less than ≈ 2 frames', () => {
    const cases: [{ x: number; y: number }, { x: number; y: number }, -1 | 1][] = [
      [{ x: 257, y: 175 }, { x: 278, y: 154 }, -1], // the card in front of the monster (Büyücü, Suikastçı)
      [{ x: 290, y: 205 }, { x: 228, y: 148 }, -1], // a card two zones to the right (Kurt, Muhafız)
      [{ x: 150, y: 190 }, { x: 330, y: 120 }, -1], // a card far to the left (the big Ejder)
      [{ x: 390, y: 95 }, { x: 352, y: 108 }, 1], // P2: its card behind the monster row
    ];
    for (const [from, to, side] of cases) {
      const path = flightPath(from, to, side);
      const plan = flightPlan(path, side);
      expect(plan.length).toBe(PLAN_SAMPLES);
      expect(plan[0].angle).toBe('up');
      expect(plan[plan.length - 1]).toEqual({ angle: 'up', facing: 1 });
      const runs = runsOf(plan);
      for (let i = 1; i < runs.length - 1; i++) expect(runs[i].n).toBeGreaterThanOrEqual(PLAN_MIN_RUN);
      expect(planAt(plan, 0)).toBe(plan[0]);
      expect(planAt(plan, 1)).toBe(plan[plan.length - 1]);
    }
    // the short lift in front of the monster rises upright (no one-frame flat flick, no blade into the body)
    const short = flightPlan(flightPath(cases[0][0], cases[0][1], -1), -1);
    expect(short.some((d) => d.angle === 'flat')).toBe(false);
    // the long cross to the left leans left, the way it flies (the blade leads)
    const long = flightPlan(flightPath(cases[1][0], cases[1][1], -1), -1);
    expect(long.some((d) => d.angle !== 'up' && d.facing === -1)).toBe(true);
    expect(long.some((d) => d.angle !== 'up' && d.facing === 1)).toBe(false);
    // the far card: it leans toward the monster on the way and rights itself before its tip reaches the body
    const far = flightPlan(flightPath(cases[2][0], cases[2][1], -1), -1);
    expect(far.some((d) => d.angle !== 'up' && d.facing === 1)).toBe(true);
  });

  it('never points the blade into its holder near the anchor (P1 and the P2 mirror)', () => {
    const reach = { up: 0, diag: 23, flat: 32 } as const;
    const cases: [{ x: number; y: number }, { x: number; y: number }, -1 | 1][] = [
      [{ x: 150, y: 190 }, { x: 330, y: 120 }, -1],
      [{ x: 257, y: 175 }, { x: 278, y: 154 }, -1],
      [{ x: 390, y: 95 }, { x: 352, y: 108 }, 1],
      [{ x: 500, y: 90 }, { x: 352, y: 108 }, 1],
    ];
    for (const [from, to, side] of cases) {
      const path = flightPath(from, to, side);
      const plan = flightPlan(path, side);
      const edge = to.x - side * 4;
      plan.forEach((d, i) => {
        if (d.angle === 'up' || d.facing !== -side) return;
        // where the sword is at that sample (the plan is laid on the eased path)
        const k = flightEase(i / (plan.length - 1));
        const u = 1 - k;
        const x = u * u * u * path[0].x + 3 * u * u * k * path[1].x + 3 * u * k * k * path[2].x + k * k * k * path[3].x;
        // a run absorbing a short one may hold its lean a few samples on: allow the merge's slack
        expect((x + d.facing * reach[d.angle] - edge) * -side).toBeLessThanOrEqual(PLAN_MIN_RUN * 3);
      });
    }
  });
});

describe('A-2 the card and the loss', () => {
  it("the lying card's art window: a solid patch inside the iso card texture, for both players", () => {
    for (const player of [0, 1] as const) {
      let n = 0;
      for (let y = 0; y < ISO_TEX_H; y++) for (let x = 0; x < ISO_TEX_W; x++) if (inArtWindow(x, y, player, 'up')) n++;
      // the 16 × 12 art seen flat in iso: about as many pixels as the art (± the projection)
      expect(n).toBeGreaterThan(80);
      expect(n).toBeLessThan(ISO_TEX_W * ISO_TEX_H * 0.6);
      // nothing outside the texture
      expect(inArtWindow(-1, -1, player, 'up')).toBe(false);
      expect(inArtWindow(ISO_TEX_W + 5, ISO_TEX_H + 5, player, 'up')).toBe(false);
    }
  });

  it('a statChange is a blade loss only when ATK drops on an equipped unit that no spell/trap equips any more', () => {
    const u = (o: Partial<{ retired: boolean; aura: boolean }> = {}) => ({ retired: o.retired ?? false, hasAura: (k: string) => k === 'equip' && (o.aura ?? true) }) as unknown as MonsterUnit;
    const e = { type: 'statChange', uid: 5, atk: 1700, prevAtk: 2400, def: 1000, prevDef: 1000 } as StatEv;
    const none = { players: [{ spellTraps: [null, null, null] }, { spellTraps: [null, null, null] }] };
    const still = { players: [{ spellTraps: [null, { equippedTo: 5 }, null] }, { spellTraps: [null, null, null] }] };
    const other = { players: [{ spellTraps: [null, { equippedTo: 9 }, null] }, { spellTraps: [null, null, null] }] };
    expect(bladeLost(none, e, u())).toBe(true);
    expect(bladeLost(other, e, u())).toBe(true);
    expect(bladeLost(still, e, u())).toBe(false);
    expect(bladeLost(none, { ...e, atk: 2400 }, u())).toBe(false);
    expect(bladeLost(none, { ...e, atk: 3100 }, u())).toBe(false);
    expect(bladeLost(none, e, u({ retired: true }))).toBe(false);
    expect(bladeLost(none, e, u({ aura: false }))).toBe(false);
  });
});
