// Lane A5-A (docs/v3/A5_PLAN.md §6.5). Step A-1: the shared kit — the motif contract S-12
// (src/art/spellmotifs-v3.ts, read by lane A5-B's card art) and the pure helpers of the effect kit
// (src/cinematics/_v3/spellfx.ts). Step A-3: Volkan Arenası — the lava front's timing against the calm
// arena's own crack field, the beat spacing, the v3 ambience (palette pixels only, no full-screen
// object, nothing left behind) and the v3 field auras' cleanup. Step A-3b: the generic statChange's
// beats (≥ 150 ms apart). Step A-4: Ayna Kalkanı — the big dome (user decision 24 Oct: every pixel of
// the old dome's shells, see-through: palette-only seams and a quarter-step tint, under half over its row), the reflection order
// (by distance), the beam schedule (220 ms after each contact; graveyard landings ≥ 150 ms apart) and the
// old beats (build, ripple, charge, break). Step A-5: Yer Yarığı — the beat times (crack ≈ 150 ms, ≤ 250 ms
// run, the old under-cracks / open / shut), the whole-pixel fall, the wide abyss (as wide as the old one),
// its lip and drawing (palette only), the trap card's landing after the victim's (≥ 150 ms).
// Fix round 1: the eruption at v1's footprint, the mirror's faster schedule, the chasm's sink-driven shut,
// the crack watch of the equip / field card, Ruh Çağrısı's sigil, column and attribute ring at ≥ v1 size.
// Later steps add their checks here.

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import * as M from '../../src/art/spellmotifs-v3';
import { fxCount, fxRng, nearestDir, stepDown, swordFor } from '../../src/cinematics/_v3/spellfx';
import { SLAB_RECT, buildCrackField, tileDV } from '../../src/art/arena';
import { zoneCell, zoneXY } from '../../src/view/layout';
import { TEX } from '../../src/vfx/core';
import {
  AMBIENCE_COUNTS,
  FRONT_DIST,
  FRONT_MOST,
  FRONT_SPREAD_MS,
  beatTimes,
  frontArrivalMs,
  frontMsAt,
  frontSchedule,
  volcanoAmbienceOnV3,
  volcanoAmbienceProbe,
  volcanoAmbienceV3,
} from '../../src/cinematics/spells/_volcano_v3';
import { flameAuraV3, steamAuraV3 } from '../../src/duel/auras-v3';
import type { MonsterUnit } from '../../src/duel/MonsterUnit';

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

// ================================================================== A-3: Volkan Arenası

/** A stand-in scene for the v3 ambience / auras: images, canvas textures and the update loop, counted. */
interface FakeObj {
  key: string;
  x: number;
  y: number;
  depth: number;
  tint: number | null;
  sx: number;
  sy: number;
  visible: boolean;
  alive: boolean;
}
type Handler = { fn: (...a: unknown[]) => unknown; ctx?: unknown };
function fakeScene() {
  const objs: FakeObj[] = [];
  const updates = new Set<Handler>();
  const shutdowns = new Set<Handler>();
  const textures = new Map<string, unknown>();
  const isShutdown = (k: unknown) => String((k as { toString(): string }).toString()).endsWith('SHUTDOWN');
  const image = (x: number, y: number, key: string) => {
    const o: FakeObj = { key, x, y, depth: 0, tint: null, sx: 1, sy: 1, visible: true, alive: true };
    objs.push(o);
    const api = {
      active: true,
      get depth() {
        return o.depth;
      },
      setOrigin: () => api,
      setBlendMode: () => api,
      setDepth: (d: number) => ((o.depth = d), api),
      setPosition: (px: number, py: number) => ((o.x = px), (o.y = py), api),
      setTint: (c: number) => ((o.tint = c), api),
      setVisible: (v: boolean) => ((o.visible = v), api),
      setScale: (a: number, b?: number) => ((o.sx = a), (o.sy = b ?? a), api),
      destroy: () => {
        o.alive = false;
        api.active = false;
      },
    };
    return api;
  };
  const scene = {
    add: { image },
    events: {
      on: (k: unknown, fn: Handler['fn'], ctx?: unknown) => (isShutdown(k) ? shutdowns : updates).add({ fn, ctx }),
      once: (k: unknown, fn: Handler['fn'], ctx?: unknown) => (isShutdown(k) ? shutdowns : updates).add({ fn, ctx }),
      off: (_k: unknown, fn: Handler['fn']) => {
        for (const set of [updates, shutdowns]) for (const h of [...set]) if (h.fn === fn) set.delete(h);
      },
    },
    tweens: { timeScale: 1 },
    time: { timeScale: 1 },
    textures: {
      createCanvas: (key: string) => {
        const t = { context: { putImageData: () => undefined }, refresh: () => undefined };
        textures.set(key, t);
        return t;
      },
      exists: (k: string) => textures.has(k),
      remove: (k: string) => textures.delete(k),
    },
    sys: { isActive: () => true },
  };
  const DT = 1000 / 60;
  const step = (ms: number) => {
    for (let t = 0; t < ms; t += DT) for (const h of [...updates]) h.fn.call(h.ctx, 0, DT);
  };
  return { scene: scene as unknown as Phaser.Scene, objs, updates, textures, step, live: () => objs.filter((o) => o.alive) };
}

/** A stand-in sprite: an opaque w × h block (feet at x, y; origin 0.5 / 1), readable like a canvas frame. */
function fakeSprite(x: number, y: number, w = 20, h = 24) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([120, 120, 140, 255], i * 4);
  const image = { getContext: () => ({ getImageData: () => ({ data }) }) };
  return {
    active: true,
    visible: true,
    alpha: 1,
    depth: 120,
    x,
    y,
    width: w,
    height: h,
    originX: 0.5,
    originY: 1,
    scaleX: 1,
    scaleY: 1,
    flipX: false,
    frame: { texture: { key: 'fake' }, name: 'f0', cutX: 0, cutY: 0, cutWidth: w, cutHeight: h, x: 0, y: 0, realWidth: w, realHeight: h, source: { image } },
  };
}

// node has no ImageData (Raster uploads through one); a minimal stand-in
if (typeof (globalThis as { ImageData?: unknown }).ImageData === 'undefined') {
  (globalThis as { ImageData?: unknown }).ImageData = class {
    constructor(
      public data: Uint8ClampedArray,
      public width: number,
      public height: number,
    ) {}
  };
}

describe('A-3 Volkan Arenası: the lava front', () => {
  it("the front table is the calm arena's own crack field (buildCrackField, default seed; seam ring of each zone)", () => {
    const W = SLAB_RECT.w;
    for (const origin of [0, 1] as const) {
      const f = buildCrackField(zoneCell(origin, 'field'));
      expect(FRONT_MOST[origin]).toBe(f.mostDist);
      const ring = (p: { x: number; y: number }) => {
        let best = Infinity;
        for (let k = 0; k < f.core.length; k++) {
          const i = f.core[k];
          const d = tileDV((i % W) + SLAB_RECT.x - (p.x - 32), Math.floor(i / W) + SLAB_RECT.y - (p.y - 16));
          if (d >= -1 && d < 1.5) best = Math.min(best, f.coreDist[k]);
        }
        return best;
      };
      for (const player of [0, 1] as const)
        for (let zone = 0; zone < 3; zone++) expect(FRONT_DIST[origin][player][zone], `origin ${origin} → P${player + 1} m${zone}`).toBe(ring(zoneXY(player, 'monster', zone)));
    }
  });

  it('arrival follows the spread (Sine.Out over 900 ms to mostDist), mirrored for P2, never past the spread', () => {
    expect(frontMsAt(0, 187)).toBe(0);
    expect(frontMsAt(187, 187)).toBe(FRONT_SPREAD_MS);
    expect(frontMsAt(400, 187)).toBe(FRONT_SPREAD_MS);
    let last = -1;
    for (let d = 0; d <= 187; d += 3) {
      const t = frontMsAt(d, 187);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
    for (let zone = 0; zone < 3; zone++) {
      // each origin mirrors the other (P2's field is P1's, turned round the board centre)
      expect(FRONT_DIST[1][1][zone]).toBe(FRONT_DIST[0][0][zone]);
      expect(FRONT_DIST[1][0][zone]).toBe(FRONT_DIST[0][1][zone]);
      for (const origin of [0, 1] as const) for (const player of [0, 1] as const) expect(frontArrivalMs(origin, player, zone)).toBeLessThanOrEqual(FRONT_SPREAD_MS);
    }
    // the zone next to the field pad is reached at once, the far corner last
    expect(frontArrivalMs(0, 0, 0)).toBe(0);
    expect(frontArrivalMs(0, 1, 0)).toBe(Math.max(...[0, 1].flatMap((p) => [0, 1, 2].map((z) => frontArrivalMs(0, p as 0 | 1, z)))));
  });

  it('beats come by distance, ≥ 150 ms apart, never before their own arrival', () => {
    const arrivals = [300, 0, 300, 120, 900, 95];
    const t = beatTimes(arrivals);
    t.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(arrivals[i]));
    const sorted = [...t].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(150);
    // the order of arrival is kept (ties: input order)
    expect(t[1]).toBeLessThan(t[5]);
    expect(t[5]).toBeLessThan(t[3]);
    expect(t[0]).toBeLessThan(t[2]);
    // spVolcano (wolf + golem on the caster's side, serpent + titan across): the last beat lands inside the spread
    const sp = beatTimes([frontArrivalMs(0, 0, 0), frontArrivalMs(0, 0, 1), frontArrivalMs(0, 1, 0), frontArrivalMs(0, 1, 1)]);
    expect(Math.max(...sp)).toBeLessThanOrEqual(FRONT_SPREAD_MS);
  });

  // fix round 2 (A5A-C2-01): the beats are spaced by what the player sees — a FIRE beat's number comes on its
  // edge's top frame (117 ms in), a WATER beat's at once — so the NUMBERS are ≥ 150 ms apart, the beat sounds
  // ≥ 100 ms apart and the first beat ≥ 150 ms after the eruption
  it('front beats: numbers ≥ 150 ms apart, sounds ≥ 100 ms apart, the first ≥ 150 ms after the eruption', () => {
    const FIRE = 133;
    const check = (items: { arrival: number; lead: number }[]) => {
      const b = frontSchedule(items, { first: 150 });
      b.forEach((x, i) => {
        expect(x.start).toBeGreaterThanOrEqual(items[i].arrival);
        expect(x.start).toBeGreaterThanOrEqual(150);
        expect(x.show - x.start).toBe(items[i].lead);
      });
      const shows = b.map((x) => x.show).sort((a, c) => a - c);
      for (let i = 1; i < shows.length; i++) expect(shows[i] - shows[i - 1]).toBeGreaterThanOrEqual(150);
      const starts = b.map((x) => x.start).sort((a, c) => a - c);
      for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(100);
      // by distance: an earlier arrival never shows its number later than a later one
      const byArr = items.map((it, i) => ({ a: it.arrival, s: b[i].show, i })).sort((p, q) => p.a - q.a || p.i - q.i);
      for (let i = 1; i < byArr.length; i++) expect(byArr[i].s).toBeGreaterThan(byArr[i - 1].s);
      return b;
    };
    // spVolcano: wolf (FIRE, P1 zone 0), golem (WATER, P1 zone 1), serpent (WATER, P2 zone 0), titan (FIRE, P2 zone 1)
    const sp = check([
      { arrival: frontArrivalMs(0, 0, 0), lead: FIRE },
      { arrival: frontArrivalMs(0, 0, 1), lead: 0 },
      { arrival: frontArrivalMs(0, 1, 0), lead: 0 },
      { arrival: frontArrivalMs(0, 1, 1), lead: FIRE },
    ]);
    // the critic's case: the WATER number no longer lands 16–67 ms after the FIRE one
    expect(sp[1].show - sp[0].show).toBeGreaterThanOrEqual(150);
    expect(sp[2].show - sp[3].show).toBeGreaterThanOrEqual(150);
    // spVolcanoP2: titan (FIRE, P2 zone 1), serpent (WATER, P1 zone 1), wolf (FIRE, P1 zone 2)
    check([
      { arrival: frontArrivalMs(1, 1, 1), lead: FIRE },
      { arrival: frontArrivalMs(1, 0, 1), lead: 0 },
      { arrival: frontArrivalMs(1, 0, 2), lead: FIRE },
    ]);
    // a5VolcanoSlice / spVolcanoReplace-like pairs, and a WATER before a FIRE
    check([
      { arrival: frontArrivalMs(0, 0, 1), lead: FIRE },
      { arrival: frontArrivalMs(0, 1, 0), lead: 0 },
    ]);
    check([
      { arrival: 0, lead: 0 },
      { arrival: 20, lead: FIRE },
      { arrival: 40, lead: 0 },
      { arrival: 60, lead: FIRE },
      { arrival: 600, lead: 0 },
    ]);
    // the last number still shows inside the scene (the creep stops ≥ 120 ms after it): ≤ 0.9 s + a little
    expect(Math.max(...sp.map((x) => x.show))).toBeLessThanOrEqual(FRONT_SPREAD_MS);
  });

  it('a beat number never slams over a number already up (numberSpot reserves the slam box)', async () => {
    const { numberSpot, numbersClash, numberBox } = await import('../../src/cinematics/spells/volcano_arena');
    expect(numberBox('+500')).toEqual({ w: 33, h: 14 });
    expect(numberBox('-300')).toEqual({ w: 32, h: 14 });
    // the critic's two pairs (spVolcano: wolf +500 then golem −300; titan +500 then serpent −300)
    for (const [a, b] of [
      [
        { x: 257, y: 106, t: '+500' },
        { x: 290, y: 120, t: '-300' },
      ],
      [
        { x: 352, y: 77, t: '+500' },
        { x: 374, y: 89, t: '-300' },
      ],
    ] as const) {
      const spots: { x: number; y: number; w: number }[] = [];
      const p = numberSpot(spots, a.x, a.y, a.t);
      expect(p).toMatchObject({ x: a.x, y: a.y });
      const q = numberSpot(spots, b.x, b.y, b.t);
      expect(numbersClash({ ...q, w: numberBox(b.t).w }, spots[0])).toBe(false);
      // moved the least: a few px, never off its monster
      expect(Math.abs(q.x - b.x) + Math.abs(q.y - b.y)).toBeLessThanOrEqual(30);
    }
  });
});

describe('A-3 Volkan Arenası: the v3 ambience and field auras', () => {
  it('the ambience draws only 1-px palette particles (no full-screen wash, no heat raster), bounded, on whole pixels', () => {
    const S = fakeScene();
    void volcanoAmbienceV3(S.scene, true, { pad: 0 });
    expect(volcanoAmbienceOnV3(S.scene)).toBe(true);
    S.step(3000);
    const live = S.live();
    expect(live.length).toBeGreaterThan(AMBIENCE_COUNTS.ash);
    // embers (head + tail), air embers, ash and the pad's pops (head + tail)
    expect(live.length).toBeLessThanOrEqual(2 * AMBIENCE_COUNTS.embers + AMBIENCE_COUNTS.drift + AMBIENCE_COUNTS.ash + 2 * 8);
    expect(S.textures.size).toBe(0); // no canvas textures: no raster of any kind
    for (const o of S.objs) {
      expect(o.key).toBe(TEX.px1);
      if (o.tint !== null) expect(PALETTE.has(o.tint), o.tint.toString(16)).toBe(true);
      expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
      expect([1, 2]).toContain(o.sx);
      expect([1, 2]).toContain(o.sy);
    }
    const probe = volcanoAmbienceProbe(S.scene)!;
    expect(probe.level).toBe(1);
    expect(probe.pad).toEqual({ x: Math.round(zoneXY(0, 'field', 0).x), y: Math.round(zoneXY(0, 'field', 0).y) });
  });

  it('switched off, the ambience cools out and leaves nothing behind (objects, listeners)', async () => {
    const S = fakeScene();
    void volcanoAmbienceV3(S.scene, true, { pad: 1, delayMs: 600 });
    S.step(2500);
    expect(S.live().length).toBeGreaterThan(0);
    let resolved = false;
    void volcanoAmbienceV3(S.scene, false).then(() => (resolved = true));
    S.step(2500);
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(S.live().length).toBe(0);
    expect(S.updates.size).toBe(0);
    expect(volcanoAmbienceOnV3(S.scene)).toBe(false);
    expect(volcanoAmbienceProbe(S.scene)).toBeNull();
  });

  it('the flame tongues and the steam follow the sprite, and are gone after destroy (nothing left)', () => {
    const S = fakeScene();
    const sprite = fakeSprite(200, 150);
    const unit = { sprite, uid: 7, retired: false, home: { x: 200, y: 150 } } as unknown as MonsterUnit;
    const flame = flameAuraV3(S.scene, unit);
    const steam = steamAuraV3(S.scene, unit);
    S.step(1500);
    // the flame aura's two rasters (in front of / behind the body) + the steam raster
    expect(S.textures.size).toBe(3);
    const before = S.live().length;
    // the sprite moves: the rasters move with it (they are redrawn round the top edge every frame)
    sprite.x = 260;
    S.step(200);
    expect(S.live().length).toBe(before);
    expect(S.live().some((o) => o.x >= 260 - 20)).toBe(true);
    flame.destroy();
    steam.destroy();
    S.step(1000);
    expect(S.textures.size).toBe(0);
    expect(S.live().length).toBe(0);
    expect(S.updates.size).toBe(0);
  });

  it('a retired unit takes its auras with it at once', () => {
    const S = fakeScene();
    const sprite = fakeSprite(300, 170);
    const unit = { sprite, uid: 9, retired: false, home: { x: 300, y: 170 } } as unknown as MonsterUnit & { retired: boolean };
    flameAuraV3(S.scene, unit);
    S.step(400);
    expect(S.textures.size).toBe(2);
    (unit as { retired: boolean }).retired = true;
    S.step(50);
    expect(S.textures.size).toBe(0);
    expect(S.updates.size).toBe(0);
  });
});

describe('A-3b generic statChange (v3)', () => {
  it('a group of stat changes beats in order, ≥ 150 ms apart, the first at once', async () => {
    const { statBeatMs, STAT_BEAT_GAP } = await import('../../src/cinematics/flow/stats');
    expect(STAT_BEAT_GAP).toBeGreaterThanOrEqual(150);
    expect(statBeatMs(0)).toBe(0);
    for (let k = 1; k < 6; k++) expect(statBeatMs(k) - statBeatMs(k - 1)).toBeGreaterThanOrEqual(150);
  });
});

describe('A-4 Ayna Kalkanı (v3): the big dome, the order, the schedule', () => {
  it('the dome is the old one (user decision 24 Oct): every pixel of the old shells over the defender row, never smaller', async () => {
    const { domeShape, domeField } = await import('../../src/cinematics/traps/_mirror_v3');
    const { BOARD_OX, BOARD_OY, TILE_W, TILE_H } = await import('../../src/view/layout');
    for (const side of [0, 1] as const) {
      const s = domeShape(side);
      const f = domeField(s);
      // the old dome's ray march (./_mirror.ts mirrorDomeTB): glass where a shell crosses the pixel above the floor
      const k = 1 / TILE_H;
      const qa = (k * k) / (s.ra * s.ra) + (k * k) / (s.rb * s.rb) + 1 / (s.rz * s.rz);
      let oldN = 0;
      let newN = 0;
      let miss = 0;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let j = 0; j < f.h; j++)
        for (let i = 0; i < f.w; i++) {
          const sx = s.x0 + i;
          const sy = s.y0 + j;
          const q0 = (sy - BOARD_OY) / (TILE_H / 2);
          const P = (sx + 0.5 - BOARD_OX) / (TILE_W / 2);
          const A0 = (P + q0) / 2 - s.a0;
          const B0 = (q0 - P) / 2 - s.b0;
          const qb = 2 * k * (A0 / (s.ra * s.ra) + B0 / (s.rb * s.rb));
          const qc = (A0 * A0) / (s.ra * s.ra) + (B0 * B0) / (s.rb * s.rb) - 1;
          const disc = qb * qb - 4 * qa * qc;
          const old = disc >= 0 && (-qb + Math.sqrt(disc)) / (2 * qa) >= 0;
          const now = f.near.cell[j * f.w + i] >= 0 || f.far.cell[j * f.w + i] >= 0;
          if (old) {
            oldN++;
            x0 = Math.min(x0, sx);
            x1 = Math.max(x1, sx);
            y0 = Math.min(y0, sy);
            y1 = Math.max(y1, sy);
          }
          if (now) newN++;
          if (old && !now) miss++;
        }
      expect(miss).toBe(0);
      expect(newN).toBe(oldN);
      // ≈ 131 × 119 px on the board: over the whole monster row, far bigger than any monster
      expect(x1 - x0 + 1).toBeGreaterThanOrEqual(120);
      expect(y1 - y0 + 1).toBeGreaterThanOrEqual(110);
    }
  }, 30_000); // two full ray marches (old + new shells, both sides): seconds on a loaded machine

  it('the dome is see-through (EF-2): palette-only 1-px seams and outline, quarter-step glass — under half of its monster row covered, at any heat or glow', async () => {
    const { domeShape, domeField, domeLook, paintDomeShell } = await import('../../src/cinematics/traps/_mirror_v3');
    const f = domeField(domeShape(1));
    const cover = (heat: number, glow = 0) => {
      const L = domeLook(f.cells.length);
      L.heat.fill(heat);
      L.glow.fill(glow);
      const near = new PixelCanvas(f.w, f.h);
      paintDomeShell(near, f, 'near', L);
      const far = new PixelCanvas(f.w, f.h);
      paintDomeShell(far, f, 'far', L);
      expect(paletteOnly(near).ok, `near heat ${heat}`).toBe(true);
      expect(paletteOnly(far).ok, `far heat ${heat}`).toBe(true);
      const again = new PixelCanvas(f.w, f.h);
      paintDomeShell(again, f, 'near', L);
      expect(hash(again)).toBe(hash(near));
      // where the row's monsters stand: the middle of the dome, from their feet up 50 px
      let glass = 0;
      let painted = 0;
      const cx = f.shape.c.x - f.shape.x0;
      const cy = f.shape.c.y - f.shape.y0;
      for (let j = cy - 50; j < cy; j++)
        for (let i = cx - 40; i <= cx + 40; i++) {
          if (f.near.cell[j * f.w + i] < 0) continue;
          glass++;
          if (near.alpha(i, j)) painted++;
        }
      expect(glass).toBeGreaterThan(1000);
      return painted / glass;
    };
    const covers = [0, 1, 2].map((h) => cover(h));
    for (const k of covers) expect(k).toBeLessThan(0.5);
    // and it is glass, not a wire frame: the tint and the glow show (the old dome's pink glass)
    expect(covers[0]).toBeGreaterThan(0.1);
    expect(covers[2]).toBeGreaterThan(covers[0] + 0.1);
    // the ignition (the catch, the charge's hottest cells, the flash): still under half, at every level,
    // and the lit panes fill the glass well beyond the seams' glow
    const glows = [1, 2, 3].map((g) => cover(0, g));
    for (const k of glows) expect(k).toBeLessThan(0.5);
    expect(cover(2, 2)).toBeLessThan(0.5);
    expect(glows[1]).toBeGreaterThan(covers[2] + 0.1);
  });

  it('the catch ignites the whole dome (user decision 24 Oct: never duller than the old pink-white glass)', async () => {
    const { domeShape, domeField, domeLook, paintDomeShell, DOME_PX, IGNITE } = await import('../../src/cinematics/traps/_mirror_v3');
    // ≈ 8 frames: held through the 60 ms hit-stop (≈ 4 frames), the panes lit up to IGNITE.lit, then a quarter
    expect(IGNITE.hot).toBeGreaterThanOrEqual(1);
    expect(IGNITE.lit).toBeGreaterThanOrEqual(3);
    expect(IGNITE.fade).toBeGreaterThanOrEqual(IGNITE.lit + 2);
    for (const side of [0, 1] as const) {
      const f = domeField(domeShape(side));
      const L = domeLook(f.cells.length);
      L.glow.fill(2);
      const near = new PixelCanvas(f.w, f.h);
      paintDomeShell(near, f, 'near', L);
      // every cell with a pane lights it (mag4 / mag3), and a lit pane never touches a seam (1-px gap)
      const lit = new Map<number, number>();
      const panes = new Map<number, number>();
      for (let j = 0; j < f.h; j++)
        for (let i = 0; i < f.w; i++) {
          const idx = j * f.w + i;
          const c = f.near.cell[idx];
          if (c < 0 || f.near.kind[idx] !== DOME_PX.glass) continue;
          if (f.near.inset[idx]) panes.set(c, (panes.get(c) ?? 0) + 1);
          const col = near.alpha(i, j) ? near.get(i, j) : null;
          if (col === PAL.mag4 || col === PAL.mag3) {
            expect(f.near.inset[idx], `side ${side}: lit glass next to a seam at ${i},${j}`).toBe(1);
            lit.set(c, (lit.get(c) ?? 0) + 1);
          }
        }
      const big = [...panes].filter(([, n]) => n >= 4).map(([c]) => c);
      expect(big.length).toBeGreaterThan(20);
      for (const c of big) expect(lit.get(c) ?? 0, `side ${side}: cell ${c} stays dark`).toBeGreaterThan(0);
      // the lit panes are pink (mag4 / mag3): white only round the struck point (glow 3), EF-4
      let white = 0;
      for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) if (near.alpha(i, j) && near.get(i, j) === PAL.white) white++;
      const L0 = domeLook(f.cells.length);
      const rest = new PixelCanvas(f.w, f.h);
      paintDomeShell(rest, f, 'near', L0);
      let white0 = 0;
      for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) if (rest.alpha(i, j) && rest.get(i, j) === PAL.white) white0++;
      expect(white).toBeLessThanOrEqual(white0 + 60);
    }
  });

  it('one owner\'s victims land in engine order (the pile\'s top card only changes on a landing)', async () => {
    const { engineOrderPerOwner, beamSchedule } = await import('../../src/cinematics/traps/_mirror_v3');
    expect(engineOrderPerOwner([1, 0], [0, 0])).toEqual([0, 1]);
    expect(engineOrderPerOwner([2, 0, 1], [0, 1, 0])).toEqual([0, 2, 1]);
    expect(engineOrderPerOwner([], [])).toEqual([]);
    // ordered: a short death after a long one still lands after it, >= 150 ms later
    const t = beamSchedule([1220, 520], { ordered: true });
    expect(t[1] + 520 - (t[0] + 1220)).toBeGreaterThanOrEqual(150);
  });

  it('the reflections go nearest to the struck point first (ties keep the event order)', async () => {
    const { reflectionOrder } = await import('../../src/cinematics/traps/_mirror_v3');
    const cell = { x: 320, y: 130 };
    expect(reflectionOrder(cell, [{ x: 250, y: 150 }, { x: 290, y: 150 }, { x: 330, y: 170 }])).toEqual([1, 2, 0]);
    expect(reflectionOrder(cell, [{ x: 300, y: 130 }, { x: 340, y: 130 }])).toEqual([0, 1]);
    expect(reflectionOrder(cell, [])).toEqual([]);
  });

  it('each beam leaves 220 ms after the last contact, later only to keep the graveyard landings ≥ 150 ms apart', async () => {
    const { beamSchedule, BEAM_MS, BEAM_GAP, LAND_GAP } = await import('../../src/cinematics/traps/_mirror_v3');
    expect(BEAM_MS).toBe(120);
    expect(BEAM_GAP).toBe(220);
    // equal deaths: exactly the storyboard's rhythm
    expect(beamSchedule([520, 520, 520])).toEqual([0, 340, 680]);
    // mixed deaths (a long v3 death first, then two short ones): every landing keeps clear of the others
    for (const deaths of [[1220, 520, 520], [520, 1220, 520], [1220, 1220], [520, 900, 300, 1100]]) {
      const t = beamSchedule(deaths);
      for (let k = 1; k < t.length; k++) expect(t[k] - t[k - 1]).toBeGreaterThanOrEqual(BEAM_MS + BEAM_GAP);
      const lands = t.map((d, k) => d + BEAM_MS + deaths[k]);
      for (let i = 0; i < lands.length; i++) for (let j = i + 1; j < lands.length; j++) expect(Math.abs(lands[i] - lands[j]), `${deaths} ${i}/${j}`).toBeGreaterThanOrEqual(LAND_GAP);
    }
  });

  it('the old beats come back: the dome is built before the earliest contact; ripple, charge and break as the old dome', async () => {
    const { DOME_AT, BUILD_MS, CATCH_AT, RIPPLE_MS, CHARGE_AT, CHARGE_MS, SHATTER_MS } = await import('../../src/cinematics/traps/_mirror_v3');
    // fix round 1 (C1-02): the build from the stand-up's last frames, a little quicker (was 250 / 380)
    expect(DOME_AT).toBe(220);
    expect(BUILD_MS).toBeGreaterThanOrEqual(300);
    expect(CATCH_AT - DOME_AT).toBeGreaterThanOrEqual(BUILD_MS);
    expect(RIPPLE_MS).toBe(190);
    expect(SHATTER_MS).toBe(340);
    // the first reflection leaves ≤ 180 ms after the catch: the 60 ms hit-stop + the charge
    expect(60 + CHARGE_AT + CHARGE_MS).toBeLessThanOrEqual(180);
  });

  it('fix round 1 (C1-02): after a posed v3 death the next beam may leave 150 ms after the contact; per-victim gaps', async () => {
    const { beamSchedule, BEAM_MS, BEAM_GAP, BEAM_GAP_POSED, LAND_GAP } = await import('../../src/cinematics/traps/_mirror_v3');
    expect(BEAM_GAP_POSED).toBe(150);
    expect(BEAM_GAP_POSED).toBeLessThan(BEAM_GAP);
    // two posed v3 deaths (≈ 1.2 s each): contact + 150, their landings still ≥ 150 ms apart
    const t = beamSchedule([1220, 1220], { gaps: [0, BEAM_GAP_POSED] });
    expect(t).toEqual([0, BEAM_MS + BEAM_GAP_POSED]);
    expect(Math.abs(t[1] - t[0])).toBeGreaterThanOrEqual(LAND_GAP);
    // a per-victim gap never loosens the landing rule
    for (const deaths of [[520, 520], [1220, 520], [520, 1220, 520]]) {
      const gaps = deaths.map(() => BEAM_GAP_POSED);
      const tt = beamSchedule(deaths, { gaps });
      const lands = tt.map((d, k) => d + BEAM_MS + deaths[k]);
      for (let i = 0; i < lands.length; i++) for (let j = i + 1; j < lands.length; j++) expect(Math.abs(lands[i] - lands[j])).toBeGreaterThanOrEqual(LAND_GAP);
    }
  });

  it('fix round 2 (C2-02): the break is front-loaded — a quarter of the dome is gone 50 ms after the sound — and ends as before', async () => {
    const { domeShape, domeField, shatterFront, shatterKey, SHATTER_MS, BREAK_CLEAR } = await import('../../src/cinematics/traps/_mirror_v3');
    expect(BREAK_CLEAR).toBeGreaterThanOrEqual(100);
    // the front is eased out (never behind the old line) and joins the old line after SHATTER_MS
    let last = -1;
    for (let el = 0; el <= SHATTER_MS * 2; el += 17) {
      const f = shatterFront(el);
      expect(f).toBeGreaterThanOrEqual(last);
      expect(f).toBeGreaterThanOrEqual((el / SHATTER_MS) * 1.15 - 1e-9);
      last = f;
    }
    expect(shatterFront(SHATTER_MS * 1.5)).toBeCloseTo(1.15 * 1.5, 6);
    for (const side of [0, 1] as const) {
      const f = domeField(domeShape(side));
      // struck points high on the shell (the attacks meet it at 0.72 rad: v ≈ 0.66)
      const strikes = f.cells.filter((c) => c.cv > 0.55 && c.cv < 0.8);
      expect(strikes.length).toBeGreaterThan(5);
      const goneAt = (s: { cu: number; cv: number }, ms: number) => f.cells.filter((c) => shatterKey(c.brk, Math.hypot(c.cu - s.cu, c.cv - s.cv)) < shatterFront(ms)).length / f.cells.length;
      let worst50 = 1;
      let worstEnd = 0;
      for (const s of strikes) {
        worst50 = Math.min(worst50, goneAt(s, 50));
        // every cell goes, no later than the old linear ramp let it go
        let t = 0;
        while (goneAt(s, t) < 1 && t < 3000) t += 17;
        worstEnd = Math.max(worstEnd, t);
      }
      expect(worst50, `side ${side}`).toBeGreaterThanOrEqual(0.25);
      expect(worstEnd).toBeLessThanOrEqual(3000);
    }
  });

  it('fix round 2 (C2-06): from the catch on, the dome burns white only round the struck point (EF-4)', async () => {
    const { domeShape, domeField, domeLook, paintDomeShell, DOME_PX, WHITE_DISC_R } = await import('../../src/cinematics/traps/_mirror_v3');
    for (const side of [0, 1] as const) {
      const f = domeField(domeShape(side));
      // the hottest frame there is: every seam and pane at full heat / glow (the first departure, the charge's peak)
      const L = domeLook(f.cells.length);
      L.heat.fill(2);
      L.glow.fill(3);
      const hit = f.near.cell.findIndex((c) => c >= 0);
      const hx = f.shape.x0 + Math.round(f.w / 2);
      const hy = f.shape.y0 + Math.round(f.h / 3);
      expect(hit).toBeGreaterThanOrEqual(0);
      L.whiteDisc = { x: hx, y: hy, r2: WHITE_DISC_R * WHITE_DISC_R };
      const near = new PixelCanvas(f.w, f.h);
      paintDomeShell(near, f, 'near', L);
      let inDisc = 0;
      for (let j = 0; j < f.h; j++)
        for (let i = 0; i < f.w; i++) {
          if (!near.alpha(i, j) || near.get(i, j) !== PAL.white) continue;
          const kind = f.near.kind[j * f.w + i];
          if (kind === DOME_PX.spec) continue; // the specular streak stays white (it always was)
          const out = (f.shape.x0 + i - hx) ** 2 + (f.shape.y0 + j - hy) ** 2 > WHITE_DISC_R * WHITE_DISC_R;
          expect(out, `side ${side}: white at ${i},${j} outside the disc`).toBe(false);
          inDisc++;
        }
      // ≤ ~300 px of white round the struck point (the critic's bound), the rest of the glass mag4 / pink
      expect(inDisc).toBeLessThanOrEqual(300);
      expect(inDisc).toBeGreaterThan(20);
    }
  });

  it('fix round 1 (C1-02): the trap card lands clear (≥ 167 ms) of every victim card, never earlier than asked', async () => {
    const { exitLanding, LAND_GAP } = await import('../../src/cinematics/traps/_mirror_v3');
    expect(exitLanding(1000, [])).toBe(1000);
    expect(exitLanding(1000, [600])).toBe(1000);
    expect(exitLanding(1000, [900, 1100])).toBe(1100 + LAND_GAP + 17);
    for (const lands of [[950], [900, 1100, 1300], [1500, 1000]]) {
      const t = exitLanding(1000, lands);
      expect(t).toBeGreaterThanOrEqual(1000);
      for (const l of lands) expect(Math.abs(t - l)).toBeGreaterThanOrEqual(LAND_GAP + 17);
    }
  });
});

describe('A-5 Yer Yarığı (v3): timing, the wide abyss, the fall', () => {
  it('the crack leaves ≈ 150 ms after activate, runs ≤ 250 ms; the old beats follow (under-cracks, open, fall, shut)', async () => {
    const { CRACK_AT, CRACK_MS, RADIAL_LEAD, RADIAL_MS, OPEN_MS, SHUT_MS, SHUT_FRAMES, SHUT_LEAD, SHUT_AFTER, shutOpenAt } = await import('../../src/cinematics/traps/_chasm_v3');
    // game time = show clock + the opening's burst stop (3 frames) + the destroy's dispatch frame
    const crack = CRACK_AT + 50 + 17;
    expect(crack).toBeLessThanOrEqual(151);
    expect(CRACK_MS).toBeLessThanOrEqual(250);
    expect(RADIAL_LEAD).toBeLessThan(CRACK_MS);
    // the old beats, each readable (the old ones: 300 / 180 / 200 ms)
    expect(RADIAL_MS).toBeGreaterThanOrEqual(150);
    expect(OPEN_MS).toBeGreaterThanOrEqual(150);
    // fix round 1 (C1-05): no empty hold — the shut starts SHUT_LEAD frames before the body is gone (its
    // lip swallowing the rest) and slams SHUT_FRAMES later: ≤ 100 ms after the body's last pixel
    expect(SHUT_MS).toBeLessThanOrEqual(100);
    expect(SHUT_FRAMES).toBeGreaterThanOrEqual(5);
    expect((SHUT_FRAMES * 1000) / 60).toBeLessThanOrEqual(100.1);
    expect(SHUT_LEAD).toBeGreaterThanOrEqual(1);
    expect(SHUT_LEAD).toBeLessThan(SHUT_FRAMES);
    // whole steps, closing from the first frame (no hold), shut on the last
    const steps = Array.from({ length: SHUT_FRAMES }, (_, j) => shutOpenAt(j));
    expect(steps[0]).toBeLessThan(1);
    expect(steps[SHUT_FRAMES - 1]).toBe(0);
    for (let j = 1; j < steps.length; j++) expect(steps[j]).toBeLessThan(steps[j - 1]);
    // the shut lands within 1.0 s of the crack (the old fissure + abyss took ≈ 1.44 s)
    expect(SHUT_AFTER).toBeLessThanOrEqual(1000);
    // the S-15 target: a fast decision (≤ 120 ms) + the crack's start stays within 300 ms of the summon's end
    expect(120 + crack + 17).toBeLessThanOrEqual(300);
  });

  it('the fall is whole pixels, one step per frame, accelerating 2, 4, 7, 11, 16 … (A5 §3.4), deep enough for the tallest body', async () => {
    const { FALL_FRAMES, PRE_FALL_FRAMES, fallOffsets } = await import('../../src/cinematics/traps/_chasm_v3');
    // fix round 2 (C2-08): the struck body holds ≤ 2 frames on the opening pad, then drops visibly from the first frame
    expect(PRE_FALL_FRAMES).toBeLessThanOrEqual(2);
    for (const depth of [110, 140]) {
      const off = fallOffsets(depth);
      expect(off.length).toBe(FALL_FRAMES);
      expect(off.slice(0, 5)).toEqual([2, 4, 7, 11, 16]);
      let reached = -1;
      for (let k = 0; k < off.length; k++) {
        expect(Number.isInteger(off[k])).toBe(true);
        if (k > 0) expect(off[k]).toBeGreaterThanOrEqual(off[k - 1]);
        // accelerating (one px more each frame) until it reaches the depth, then held there
        if (k > 1 && off[k] < depth) expect(off[k] - off[k - 1]).toBe(off[k - 1] - off[k - 2] + 1);
        if (reached < 0 && off[k] === depth) reached = k;
      }
      expect(reached).toBeGreaterThan(0);
      expect(reached).toBeLessThanOrEqual(17);
      expect(off[off.length - 1]).toBe(depth);
    }
  });

  it('the abyss is as wide as the old one (max(30, 0.55 × body width) half width, the same jagged rim)', async () => {
    const { abyssHalfWidth, abyssShape, abyssRim } = await import('../../src/cinematics/traps/_chasm_v3');
    for (const w of [20, 40, 55, 70, 90, 120]) expect(abyssHalfWidth(w)).toBeGreaterThanOrEqual(Math.max(30, Math.round(w * 0.55)));
    for (const w of [40, 60, 90]) {
      const s = abyssShape({ x: 200, y: 120 }, w, 7);
      const rim = abyssRim(s, 1);
      const xs = rim.map((q) => q.x);
      const ys = rim.map((q) => q.y);
      // the old hole: RX × RY scaled by its jag (0.86 … 1.16) — ≥ 1.7 RX across, about half as tall
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(Math.floor(1.7 * Math.max(30, Math.round(w * 0.55))));
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(Math.floor(0.8 * s.ry));
      // the cracks run out to 0.9 … 1.5 half widths
      for (const c of s.cracks) {
        const end = c[c.length - 1];
        const r = Math.hypot(end.x - s.x, (end.y - s.y) * 2);
        expect(r).toBeGreaterThanOrEqual(0.85 * s.rx);
        expect(r).toBeLessThanOrEqual(1.55 * s.rx);
      }
    }
  });

  it('the lip runs left → right past any body; its middle is the hole’s front rim, at the floor line outside it', async () => {
    const { abyssShape, abyssLip } = await import('../../src/cinematics/traps/_chasm_v3');
    const s = abyssShape({ x: 100, y: 50 }, 60, 3);
    const lip = abyssLip(s, 1);
    expect(lip[0].x).toBeLessThanOrEqual(100 - 150);
    expect(lip[lip.length - 1].x).toBeGreaterThanOrEqual(100 + 150);
    for (let i = 1; i < lip.length; i++) expect(lip[i].x).toBeGreaterThanOrEqual(lip[i - 1].x);
    for (const q of lip) expect(q.y).toBeGreaterThanOrEqual(50);
    expect(Math.max(...lip.map((q) => q.y))).toBeGreaterThanOrEqual(50 + Math.floor(0.8 * s.ry));
  });

  it('the abyss drawing is palette-only and deterministic; it opens as wide as its rim; the slam frame lights the cracks white', async () => {
    const { abyssShape, paintAbyss } = await import('../../src/cinematics/traps/_chasm_v3');
    const s = abyssShape({ x: 100, y: 60 }, 56, 11);
    const draw = (look: Parameters<typeof paintAbyss>[2]) => {
      const p = new PixelCanvas(200, 120);
      paintAbyss(p, s, look, 0, 0);
      return p;
    };
    const base = { crack: 1, open: 0, glow: 3, breath: 0, seam: false };
    for (const look of [{ ...base, crack: 0.4 }, base, { ...base, open: 0.5 }, { ...base, open: 1 }, { ...base, open: 1.08, breath: 1 }, { ...base, seam: true }, { ...base, glow: 1 }, { ...base, glow: 0 }]) {
      const p = draw(look);
      expect(paletteOnly(p).ok, JSON.stringify(look)).toBe(true);
      expect(hash(draw(look))).toBe(hash(p));
    }
    // open: the ink hole and its deep glow span ≥ 1.7 half widths along the centre row
    const open = draw({ ...base, crack: 0, open: 1 });
    let xa = Infinity;
    let xb = -Infinity;
    for (let x = 0; x < open.w; x++) if (open.alpha(x, 60)) ((xa = Math.min(xa, x)), (xb = Math.max(xb, x)));
    expect(xb - xa + 1).toBeGreaterThanOrEqual(Math.floor(1.7 * s.rx));
    const tones = new Set<number>();
    for (let y = 0; y < open.h; y++) for (let x = 0; x < open.w; x++) if (open.alpha(x, y)) tones.add(open.get(x, y)!);
    for (const c of [PAL.ink, PAL.mag1, PAL.mag2, PAL.mag3, PAL.steel, PAL.night4]) expect(tones.has(c), c.toString(16)).toBe(true);
    // the slam frame: the closed scar's cracks are white (core) on mag3 lips
    const seam = draw({ ...base, seam: true });
    const seamTones = new Set<number>();
    for (let y = 0; y < seam.h; y++) for (let x = 0; x < seam.w; x++) if (seam.alpha(x, y)) seamTones.add(seam.get(x, y)!);
    expect([...seamTones].sort()).toEqual([PAL.mag3, PAL.white].sort());
    // cooled to bare ink, then gone
    const ink = draw({ ...base, glow: 0 });
    const inkTones = new Set<number>();
    for (let y = 0; y < ink.h; y++) for (let x = 0; x < ink.w; x++) if (ink.alpha(x, y)) inkTones.add(ink.get(x, y)!);
    expect([...inkTones]).toEqual([PAL.ink]);
    const gone = draw({ ...base, glow: -1 });
    expect(gone.bounds()).toBeNull();
  });

  it('the trap card lands ≥ 150 ms after the victim card, never before its own flight allows', async () => {
    const { exitDelay, LAND_GAP } = await import('../../src/cinematics/traps/_chasm_v3');
    expect(LAND_GAP).toBe(150);
    expect(exitDelay(800, 400, null)).toBe(0);
    expect(exitDelay(800, 400, 1100 + LAND_GAP)).toBe(50);
    expect(exitDelay(800, 600, 1100 + LAND_GAP)).toBe(0);
  });

  it('the crack starts just past the trap tile (outside the opening burst), over the floor ring', async () => {
    const { CRACK_DEPTH, PAD_HH, PAD_HW, footOffset } = await import('../../src/cinematics/traps/_chasm_v3');
    const { DEPTH } = await import('../../src/view/layout');
    const s = Math.SQRT1_2;
    for (const u of [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -s, y: s }, { x: s, y: -s }]) {
      const d = footOffset(u);
      // outside the tile's iso diamond (|x| / hw + |y| / hh > 1) by ≥ 1 px, and not far past it
      expect(Math.abs(u.x * d) / (PAD_HW + 1) + Math.abs(u.y * d) / (PAD_HH + 1)).toBeGreaterThan(1);
      expect(d).toBeLessThanOrEqual(PAD_HW + 4);
    }
    expect(footOffset({ x: 0, y: 1 })).toBe(PAD_HH + 3);
    expect(footOffset({ x: 1, y: 0 })).toBe(PAD_HW + 3);
    // above the trap opening's floor ring (DEPTH.SHADOW − 1), below the shadows and every unit
    expect(CRACK_DEPTH).toBeGreaterThan(DEPTH.SHADOW - 1);
    expect(CRACK_DEPTH).toBeLessThan(DEPTH.SHADOW);
  });
});

describe('fix round 1 (A5-A): the eruption, the recall landing, the crack watch', () => {
  /** Opaque bounding box of a canvas. */
  const bbox = (p: PixelCanvas) => {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++)
        if (p.alpha(x, y) > 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    return x1 < 0 ? { w: 0, h: 0 } : { w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  it('C1-01: the eruption rises 3 steps, holds ≥ 2, falls 3; at its peak ≥ 16 px wide, ≥ 44 px tall, a white core, palette only', () => {
    const S = M.ERUPTION_STEPS;
    expect(S[0].h).toBeLessThan(S[1].h);
    expect(S[1].h).toBeLessThan(S[2].h);
    const held = S.filter((s) => s.h >= 50);
    expect(held.length).toBeGreaterThanOrEqual(2 + 1);
    const peak = S.reduce((k, s, i) => (s.h > S[k].h ? i : k), 0);
    const after = S.slice(peak + 1).map((s) => s.h);
    for (let i = 1; i < after.length; i++) expect(after[i]).toBeLessThanOrEqual(after[i - 1]);
    expect(after[after.length - 1]).toBe(0);
    // ≤ 1.9 s scene: the eruption itself stays short
    expect(S.reduce((n, s) => n + s.ms, 0)).toBeLessThanOrEqual(450);
    for (let k = 3; k <= 6; k++) {
      const p = new PixelCanvas(84, M.ERUPTION_TOP + 18);
      M.paintEruption(p, 42, M.ERUPTION_TOP + 6, k, { phase: k });
      expect(paletteOnly(p).bad).toEqual([]);
      const b = bbox(p);
      expect(b.w, `step ${k}`).toBeGreaterThanOrEqual(16);
      expect(b.h, `step ${k}`).toBeGreaterThanOrEqual(44);
      let white = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.alpha(x, y) && p.get(x, y) === PAL.white) white++;
      expect(white, `step ${k}`).toBeGreaterThanOrEqual(8);
      const q = new PixelCanvas(84, M.ERUPTION_TOP + 18);
      M.paintEruption(q, 42, M.ERUPTION_TOP + 6, k, { phase: k });
      expect(hash(q)).toBe(hash(p));
    }
  });

  it('C1-01: a two-ring floor shock ≥ 90 × 44 and 10–14 gobs on arcs ≤ 40 px', async () => {
    const { SHOCK_RINGS, ERUPT_GOB_GROUPS, ERUPT_GOBS } = await import('../../src/cinematics/spells/volcano_arena');
    expect(SHOCK_RINGS.length).toBe(2);
    const R = Math.max(...SHOCK_RINGS.map((r) => Math.max(...r.rx)));
    expect(R * 2).toBeGreaterThanOrEqual(90);
    expect(R).toBeGreaterThanOrEqual(44);
    expect(ERUPT_GOBS).toBeGreaterThanOrEqual(10);
    expect(ERUPT_GOBS).toBeLessThanOrEqual(14);
    for (const g of ERUPT_GOB_GROUPS) for (const r of g.reach) expect(r).toBeLessThanOrEqual(40);
  });

  it('C1-03 / C1-04: a card tile counts as cracked once it jolts off its home (or is gone)', async () => {
    const { tileShaken } = await import('../../src/cinematics/_v3/spellfx');
    expect(tileShaken(null)).toBe(true);
    expect(tileShaken({ active: false, x: 100, home: { x: 100, y: 0 } })).toBe(true);
    expect(tileShaken({ active: true, x: 100, home: { x: 100, y: 0 } })).toBe(false);
    expect(tileShaken({ active: true, x: 101, home: { x: 100, y: 0 } })).toBe(true);
    expect(tileShaken({ active: true, x: 99, home: { x: 100, y: 0 } })).toBe(true);
  });

  it('C1-07: the recall sigil is ≥ v1’s rune circle (≈ 70 × 35): rings, dial, hexagram, 8 runes; palette only, deterministic', () => {
    const p = new PixelCanvas(96, 52);
    M.paintRecallSigil(p, 48, 26, { step: 3, phase: 5 });
    expect(paletteOnly(p).bad).toEqual([]);
    const b = bbox(p);
    expect(b.w).toBeGreaterThanOrEqual(72);
    expect(b.h).toBeGreaterThanOrEqual(36);
    const q = new PixelCanvas(96, 52);
    M.paintRecallSigil(q, 48, 26, { step: 3, phase: 5 });
    expect(hash(q)).toBe(hash(p));
    // it opens in thirds; the lit pulse lifts it (white lines appear)
    const s1 = new PixelCanvas(96, 52);
    M.paintRecallSigil(s1, 48, 26, { step: 1 });
    expect(bbox(s1).w).toBeLessThan(b.w);
    const lit = new PixelCanvas(96, 52);
    M.paintRecallSigil(lit, 48, 26, { step: 3, phase: 5, lit: true });
    const whites = (c: PixelCanvas) => {
      let n = 0;
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.alpha(x, y) && c.get(x, y) === PAL.white) n++;
      return n;
    };
    expect(whites(p)).toBe(0);
    expect(whites(lit)).toBeGreaterThanOrEqual(16);
  });

  it('C1-07: the landing burst reaches ≥ 80 × 40, its ring stays ≥ 80 × 40; the attribute glyphs are palette only', async () => {
    const R = await import('../../src/cinematics/spells/soul_recall');
    const max = Math.max(...R.RECALL_LAND_RINGS.map((r) => Math.max(...r.rx)));
    expect(max * 2).toBeGreaterThanOrEqual(80);
    expect(max).toBeGreaterThanOrEqual(40);
    expect(R.RECALL_RING_RX * 2).toBeGreaterThanOrEqual(80);
    for (const r of R.RECALL_LAND_RINGS) for (const t of r.tone) expect(t >= 0 && t <= 4).toBe(true);
    // the column: a white core, cyan bands, a cyan1 edge
    expect(R.recallPillarTone(0, 5)).toBe(PAL.white);
    expect(R.recallPillarTone(4, 5)).toBe(PAL.cyan1);
    expect(R.RECALL_PILLAR_H).toBeGreaterThanOrEqual(80);
    const ramps = { FIRE: [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4], WATER: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4], LIGHT: [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4], DARK: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4], EARTH: [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4], WIND: [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4] } as const;
    for (const [attr, ramp] of Object.entries(ramps) as [keyof typeof ramps, readonly number[]][]) {
      for (let f = 0; f < 3; f++) {
        const p = new PixelCanvas(9, 10);
        M.paintRecallFlavour(p, attr, ramp, 4, 8, f);
        expect(paletteOnly(p).bad, `${attr} ${f}`).toEqual([]);
        expect(bbox(p).w, `${attr} ${f}`).toBeGreaterThan(0);
      }
      const gone = new PixelCanvas(9, 10);
      M.paintRecallFlavour(gone, attr, ramp, 4, 8, 0, { cool: 3 });
      expect(paletteOnly(gone).bad).toEqual([]);
    }
  });

  it('C2-05: the landing is at least v1’s water ring (≈ 95 × 45) and WATER throws 20–30 px spouts in drop arcs', async () => {
    const R = await import('../../src/cinematics/spells/soul_recall');
    const max = Math.max(...R.RECALL_LAND_RINGS.map((r) => Math.max(...r.rx)));
    expect(max * 2).toBeGreaterThanOrEqual(96);
    expect(R.RECALL_RING_RX * 2).toBeGreaterThanOrEqual(96);
    expect(R.RECALL_RING_HOLD).toBeGreaterThanOrEqual(760);
    expect(R.RECALL_SPOUTS).toBeGreaterThanOrEqual(3);
    for (const h of R.RECALL_SPOUT_H) {
      expect(h).toBeGreaterThanOrEqual(20);
      expect(h).toBeLessThanOrEqual(30);
    }
    const water = [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4];
    let tallest = 0;
    let drops = 0;
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      const p = new PixelCanvas(30, 40);
      M.paintRecallSpout(p, 15, 36, water, 28, t);
      expect(paletteOnly(p).bad, `t ${t}`).toEqual([]);
      const bb = bbox(p);
      if (bb.w > 0) tallest = Math.max(tallest, bb.h);
      // nothing below the base line, white only on tips / drop tops (a handful of pixels)
      let white = 0;
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++) {
          if (!p.alpha(x, y)) continue;
          expect(y, `t ${t}`).toBeLessThanOrEqual(36);
          if (p.get(x, y) === PAL.white) white++;
        }
      expect(white).toBeLessThanOrEqual(6);
      if (t >= M.RECALL_SPOUT.crest && bb.w >= 9) drops++;
    }
    expect(tallest).toBeGreaterThanOrEqual(28);
    // after the crest the drops arc out to both sides (the spout spans ≥ 9 px on some frames)
    expect(drops).toBeGreaterThan(0);
    // deterministic
    const a = new PixelCanvas(30, 40);
    const b = new PixelCanvas(30, 40);
    M.paintRecallSpout(a, 15, 36, water, 26, 0.6);
    M.paintRecallSpout(b, 15, 36, water, 26, 0.6);
    expect(a.data).toEqual(b.data);
  });

  it('C1-07: the held circle is a double ring with a dial; LIGHT stars keep white to the peak frame’s centre (EF-4)', async () => {
    const R = await import('../../src/cinematics/spells/soul_recall');
    expect(R.RECALL_RING_INNER_RX).toBeLessThanOrEqual(R.RECALL_RING_RX - 6);
    expect(R.RECALL_RING_INNER_RX * 2).toBeGreaterThanOrEqual(60);
    expect(R.RECALL_RING_TICKS).toBeGreaterThanOrEqual(12);
    // LIGHT's ramp ends in white: a ring of 14 stars must not light 14 × 5 white pixels at once
    const light = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4, PAL.white];
    const whites = (f: number) => {
      const p = new PixelCanvas(9, 10);
      M.paintRecallFlavour(p, 'LIGHT', light, 4, 8, f);
      let n = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.alpha(x, y) && p.get(x, y) === PAL.white) n++;
      return n;
    };
    expect([whites(0), whites(1), whites(2)]).toEqual([1, 0, 0]);
  });
});
