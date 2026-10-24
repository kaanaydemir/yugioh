// Lane A5-A step A-2 — Ejder Kılıcı v3 (docs/v3/A5_PLAN.md §3.1): the signature great sword motif (palette,
// size ≥ the old forge's 15×46 sword, stages, rim, crack), the equip anchor and the waist ring, the
// break's shards, the bond pose plan, the forged sword of the forge (bigsword step, the user's rule of
// 24 Oct: the old forge path in v3 pixels — never smaller than the old 30×92 / 15×46 sword; turns, looks,
// the old size choice, the layout, the beats), the lying card's art window, and when a statChange is a
// blade's loss.
// (Kept in its own file: tests/cinematics/a5-spells.test.ts is being edited by a parallel step.)

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { ISO_TEX_H, ISO_TEX_W } from '../../src/art/cards';
import { greatSwordMotif, type GreatSwordOpts, type MotifFacing, type SwordAngle } from '../../src/art/spellmotifs-v3';
import { BOND_RING_RX, BREAK_CRACK_FRAMES, anchorFromFrame, breakRing, ringPixels, swordShardPoints } from '../../src/duel/auras-v3';
import { BREAK, DRAW_STEPS, FORGE, SINK_COOL_FRAMES, bladeLost, bondPosePlan, forgeLayout, inArtWindow, numberSpot, shardTone, sinkLook, type StatEv } from '../../src/cinematics/spells/_blade_v3';
import { FORGE_OLD, TURN_K, forgeSizeFor, forgeSwordChunks, forgeSwordGeom, forgeSwordMotif, turnAt, type ForgeSize, type ForgeSwordOpts, type ForgeTurn } from '../../src/cinematics/spells/_blade_sword';
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

describe('bigsword: the forged sword (the old forge path in v3 pixels)', () => {
  const SIZES: ForgeSize[] = ['big', 'mid'];
  const VARIANTS: Omit<ForgeSwordOpts, 'size'>[] = [
    {},
    { runesLit: true },
    { glint: 0.5 },
    { turn: 1 },
    { turn: 2 },
    { turn: 3 },
    { back: true },
    { turn: 1, back: true },
    { turn: 2, back: true },
    { look: 'hot' },
    { look: 'cool' },
    { look: 'ember' },
    { look: 'ghost' },
  ];
  const width = (p: PixelCanvas): number => {
    const b = p.bounds();
    return b ? b.w : 0;
  };

  it('every drawing is palette-only, deterministic and keeps its size canvas and anchor (turns never move it)', () => {
    for (const size of SIZES) {
      const g = forgeSwordGeom(size);
      for (const v of VARIANTS) {
        const m = forgeSwordMotif({ size, ...v });
        expect(paletteOnly(m.px)).toEqual([]);
        expect(hash(m.px)).toBe(hash(forgeSwordMotif({ size, ...v }).px));
        expect([m.px.w, m.px.h, m.ax, m.ay]).toEqual([g.w, g.h, g.cx, 0]);
      }
    }
  });

  it('is at least the old forge sword in each of its sizes (30×92 at ×2, 15×46 at ×1) — the big one twice the old v3 great sword', () => {
    for (const size of SIZES) {
      const b = forgeSwordMotif({ size }).px.bounds()!;
      expect(b.w).toBeGreaterThanOrEqual(FORGE_OLD[size].w);
      expect(b.h).toBeGreaterThanOrEqual(FORGE_OLD[size].h);
    }
    const big = forgeSwordMotif({ size: 'big' }).px.bounds()!;
    const great = greatSwordMotif({}).px.bounds()!;
    expect(big.w * big.h).toBeGreaterThanOrEqual(great.w * great.h * 3);
    // point down: the white point is the lowest drawn pixel above the outline, the gem pommel at the top
    const full = forgeSwordMotif({ size: 'big' }).px;
    const g = forgeSwordGeom('big');
    expect(full.get(g.cx, g.tipRow)).toBe(PAL.white);
    expect(full.get(g.cx, g.tipRow + 1)).toBe(PAL.ink);
  });

  it('the spin: turns narrow to edge-on, the back face drops the gems, the looks step the ramp without ink', () => {
    for (const size of SIZES) {
      const w = [0, 1, 2, 3].map((t) => width(forgeSwordMotif({ size, turn: t as ForgeTurn }).px));
      for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
      expect(w[3]).toBeLessThanOrEqual(5);
      const crim = (p: PixelCanvas) => [PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4].reduce((n, c) => n + count(p, c), 0);
      const front = forgeSwordMotif({ size }).px;
      const back = forgeSwordMotif({ size, back: true }).px;
      // the grip stays crimson; the pommel gem, the guard gem and the runes do not show on the back
      expect(crim(back)).toBeLessThan(crim(front));
      expect(width(back)).toBe(width(front));
      for (const look of ['hot', 'cool', 'ember', 'ghost'] as const) expect(count(forgeSwordMotif({ size, look }).px, PAL.ink)).toBe(0);
      expect(count(forgeSwordMotif({ size, look: 'hot' }).px, PAL.white)).toBeGreaterThan(count(front, PAL.white) * 4);
      expect(count(forgeSwordMotif({ size, runesLit: true }).px, PAL.white)).toBeGreaterThan(count(front, PAL.white));
      expect(hash(forgeSwordMotif({ size, glint: 0.5 }).px)).not.toBe(hash(front));
    }
  });

  it('the spin picks the pre-drawn turn nearest |cos| (back face while cos < 0): the old 1.5 turns from the back to the face', () => {
    expect(turnAt(Math.PI)).toEqual({ turn: 0, back: true });
    expect(turnAt(Math.PI * 4)).toEqual({ turn: 0, back: false });
    expect(turnAt(Math.PI * 1.5).turn).toBe(3);
    expect(turnAt(Math.PI * 2.25)).toEqual({ turn: 1, back: false });
    expect(turnAt(Math.PI * 1.25)).toEqual({ turn: 1, back: true });
    for (let a = 0; a < Math.PI * 4; a += 0.05) {
      const d = turnAt(a);
      expect(Math.abs(TURN_K[d.turn] - Math.abs(Math.cos(a)))).toBeLessThanOrEqual(0.17 + 1e-9);
    }
  });

  it("the old forge's size choice: ×2 for a body ≥ 40 px with ≥ 30 px to plunge, else ×1 (P2's back row)", () => {
    expect(forgeSizeFor({ top: 140, h: 52 })).toBe('big');
    expect(forgeSizeFor({ top: 140, h: 36 })).toBe('mid');
    expect(forgeSizeFor({ top: 64, h: 50 })).toBe('mid');
  });

  it('the layout: the ring a halo over the head as wide as the old outer ring, the point just over it, the stab in the body middle', () => {
    for (const box of [
      { cx: 292, top: 140, h: 52 },
      { cx: 318, top: 96, h: 86 },
      { cx: 352, top: 64, h: 50 },
    ]) {
      const L = forgeLayout(box);
      expect(L.rx * 2).toBe(L.size === 'big' ? 88 : 72);
      expect(L.ry).toBe(Math.round(L.rx * 0.32));
      expect(L.ringY).toBe(Math.max(22, Math.round(box.top - 8)));
      expect(L.top).toBeGreaterThanOrEqual(15);
      // the point hovers just over the ring's centre (the old: 4 px over it), above the head
      expect(L.top + L.tipRow).toBeLessThanOrEqual(Math.max(L.ringY, L.tipRow + 16));
      expect(L.stabTop + L.tipRow).toBe(Math.round(box.top + box.h * 0.5));
      // it plunges down a fair way (the old: ≥ 30 px for the ×2 sword)
      expect(L.stabTop - (L.top - 13)).toBeGreaterThanOrEqual(L.size === 'big' ? 30 : 20);
    }
  });

  it('the beats are the old forge’s (834 ms from the runes to the stab, the runes a little quicker); the sink steps down the ramp to light', () => {
    const toStab = FORGE.runes + FORGE.orbit + FORGE.converge + DRAW_STEPS * FORGE.drawStep + FORGE.cool + FORGE.spin + FORGE.hang + FORGE.plunge;
    // the draw-in, the cooling, the spin, the hang and the plunge are the old ones exactly
    expect([DRAW_STEPS * FORGE.drawStep, FORGE.cool, FORGE.spin, FORGE.hang, FORGE.plunge, FORGE.stop, FORGE.sink]).toEqual([64, 33, 210, 60, 70, 70, 230]);
    expect(toStab).toBeGreaterThanOrEqual(780);
    expect(toStab).toBeLessThanOrEqual(870);
    // (fix round 2: the stab's white-hot flash cools through SINK_COOL_FRAMES of gold4 first, so the sink
    // itself goes planes → light: full, ember, ghost, gone)
    const seq = [0, 0.2, 0.4, 0.6, 0.8, 0.95].map(sinkLook);
    expect(seq).toEqual(['full', 'full', 'full', 'ember', 'ghost', null]);
    expect(SINK_COOL_FRAMES).toBe(2);
  });
});

describe('fix round 2: the break (the forged blade tears out, cracks and shatters) and the number', () => {
  const SIZES: ForgeSize[] = ['big', 'mid'];
  const mask = (p: PixelCanvas): string => {
    let s = '';
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) s += p.alpha(x, y) > 0 ? '1' : '0';
    return s;
  };

  it('the cracked drawing: palette-only, deterministic, the same silhouette as the sword, white crack lines with dark lips', () => {
    for (const size of SIZES) {
      const full = forgeSwordMotif({ size }).px;
      const cracked = forgeSwordMotif({ size, crack: true }).px;
      expect(paletteOnly(cracked)).toEqual([]);
      expect(hash(cracked)).toBe(hash(forgeSwordMotif({ size, crack: true }).px));
      expect(mask(cracked)).toBe(mask(full));
      expect(count(cracked, PAL.white)).toBeGreaterThan(count(full, PAL.white) + (size === 'big' ? 20 : 8));
      expect(count(cracked, PAL.gold1)).toBeGreaterThan(count(full, PAL.gold1));
      expect(count(cracked, PAL.ink)).toBe(count(full, PAL.ink));
    }
  });

  it('the chunks tile the cracked drawing exactly (every pixel once, its own colour), 3–8 px chips, deterministic', () => {
    for (const size of SIZES) {
      const m = forgeSwordMotif({ size, crack: true }).px;
      const chunks = forgeSwordChunks(size, 7);
      const seen = new Map<string, number>();
      for (const ch of chunks)
        for (const q of ch.px) {
          const k = `${q.x},${q.y}`;
          expect(seen.has(k)).toBe(false);
          seen.set(k, q.c);
          expect(m.get(q.x, q.y)).toBe(q.c);
        }
      expect(seen.size).toBe(count(m));
      // a fair number of pieces: the big blade breaks into tens of chips, the small one into ≥ 12
      expect(chunks.length).toBeGreaterThanOrEqual(size === 'big' ? 30 : 12);
      const sizes = chunks.map((c) => c.px.length).sort((a, b) => a - b);
      expect(sizes[Math.floor(sizes.length / 2)]).toBeGreaterThanOrEqual(size === 'big' ? 15 : 8);
      for (const c of chunks) expect(c.bottom).toBe(Math.max(...c.px.map((q) => q.y)));
      expect(JSON.stringify(forgeSwordChunks(size, 7))).toBe(JSON.stringify(chunks));
      // a coarser cut (reduced motion) gives fewer pieces
      expect(forgeSwordChunks(size, 7, 3).length).toBeLessThan(chunks.length);
    }
  });

  it('the pieces fade by palette steps (white → gold, the crimson grip down its ramp, ink holds) and go out after 4 steps', () => {
    expect(shardTone(PAL.white, 0)).toBe(PAL.white);
    expect(shardTone(PAL.white, 1)).toBe(PAL.gold4);
    expect(shardTone(PAL.gold4, 2)).toBe(PAL.gold2);
    expect(shardTone(PAL.crim4, 1)).toBe(PAL.crim3);
    expect(shardTone(PAL.ink, 3)).toBe(PAL.ink);
    for (const c of [PAL.white, PAL.gold2, PAL.crim2, PAL.ink]) expect(shardTone(c, 4)).toBeNull();
    for (let k = 0; k < 4; k++) for (const c of [PAL.white, PAL.gold3, PAL.crim1]) expect(PALETTE.has(shardTone(c, k)!)).toBe(true);
  });

  it('the break beat: out of the body, a hang, the crack — ≤ 260 ms to the shatter at 1×; the ring flares to the bond size', () => {
    const toShatter = BREAK.eject + (BREAK.hangFrames + BREAK_CRACK_FRAMES) * (1000 / 60);
    expect(toShatter).toBeGreaterThanOrEqual(150);
    expect(toShatter).toBeLessThanOrEqual(260);
    expect(breakRing({ rx: 12 })).toEqual({ rx: BOND_RING_RX, ry: Math.round(BOND_RING_RX / 2) });
    expect(breakRing({ rx: 40 }).rx).toBe(40);
    expect(breakRing({ rx: 12 }).rx * 2).toBeGreaterThanOrEqual(64);
  });

  it('the number beside the sword: off the blade where its slam misses the guard, off the guard where it reaches it, on screen', () => {
    const big = forgeSwordGeom('big');
    const mid = forgeSwordGeom('mid');
    // P1, big: the guard far above the head (the old placement: blade edge + 36)
    const a = numberSpot({ x: 300, swordTop: 60, headY: 150, side: 1, travel: 20, geo: big });
    expect(a).toEqual({ x: 300 + big.bladeHw + 36, y: 146 });
    // P2, mid: the slam's rows reach the guard's band → off the guard's edge (no contact even at 2×)
    const top = 100;
    const headY = top + mid.guardRow + 4;
    const b = numberSpot({ x: 400, swordTop: top, headY, side: -1, travel: 10, geo: mid });
    expect(b.x).toBe(400 - (mid.guardHw + 36 + 2));
    // the slammed number's ink (measured in game: 31 px left of its x, 33 px right — the glyph cells'
    // outline / shadow sit right) keeps the same 3 px of air from the guard's ink on either side
    const c = numberSpot({ x: 400, swordTop: top, headY, side: 1, travel: 10, geo: mid });
    const airLeft = 400 - (mid.guardHw + 1) - (b.x + 33) - 1;
    const airRight = c.x - 31 - (400 + mid.guardHw + 1) - 1;
    expect(airLeft).toBe(3);
    expect(airRight).toBe(3);
    // kept on screen
    expect(numberSpot({ x: 620, swordTop: 60, headY: 150, side: 1, geo: big }).x).toBeLessThanOrEqual(604);
    expect(numberSpot({ x: 10, swordTop: 60, headY: 150, side: -1, geo: big }).x).toBeGreaterThanOrEqual(36);
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
