// Lane A6-A (docs/v3/A6_PLAN.md §6.4): the v3 card object's pure parts — the v3 back (S-2: every
// back path reads one source, per player; off = today's back byte for byte; today's silhouettes
// kept so the overlay textures stay the same), the crisp raster (whole-pixel sizes, 1-px outline
// and trim kept, palette only, deterministic), the sharp turn frames (K2 widths), the motion-LOD
// face, and CardV3's pure helpers.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

const G = globalThis as Record<string, unknown>;

async function load(look: 'v1' | 'v3', flags?: Record<string, string>) {
  vi.resetModules();
  G.__NEON_LOOK = look;
  if (flags) G.__NEON_V3FLAGS = flags;
  else delete G.__NEON_V3FLAGS;
  const cards = await import('../../src/art/cards');
  const back = await import('../../src/view/v3/cardBack');
  const raster = await import('../../src/view/v3/cardRaster');
  const lod = await import('../../src/view/v3/cardLod');
  const flagsMod = await import('../../src/view/v3flags');
  const palette = await import('../../src/art/palette');
  return { cards, back, raster, lod, flags: flagsMod, palette };
}

afterEach(() => {
  delete G.__NEON_LOOK;
  delete G.__NEON_V3FLAGS;
});

type Canvas = { w: number; h: number; data: Uint8ClampedArray };

/** The mini-hand card's scale (9 / 48). */
const MINI_SCALE = 9 / 48;

const rgbAt = (p: Canvas, x: number, y: number): number | null => {
  const i = (y * p.w + x) * 4;
  if (p.data[i + 3] === 0) return null;
  return (p.data[i] << 16) | (p.data[i + 1] << 8) | p.data[i + 2];
};

function offPalette(p: Canvas, pal: Set<number>): number {
  let n = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = rgbAt(p, x, y);
      if (c !== null && !pal.has(c)) n++;
    }
  return n;
}

function alphaMask(p: Canvas): string {
  let s = '';
  for (let i = 3; i < p.data.length; i += 4) s += p.data[i] ? '1' : '0';
  return s;
}

/** Width of the opaque columns' span. */
function opaqueWidth(p: Canvas): number {
  let x0 = Infinity;
  let x1 = -1;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.data[(y * p.w + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  return x1 < 0 ? 0 : x1 - x0 + 1;
}

describe('A6-A A1 — the v3 back is the one back source (S-2)', { timeout: 60_000 }, () => {
  it('lane on: cardBackCanvas / cardMip / isoCanvas all come from cardBackV3 / cardBackMipV3, one per player', async () => {
    const v1 = await load('v1');
    const today = v1.cards.cardBackCanvas(0).data.slice();
    const todayIso = v1.cards.isoCanvas('back', 'up', 0).data.slice();
    const { cards, back, flags } = await load('v3');
    expect(flags.V3_A6_A).toBe(true);
    for (const p of [0, 1] as const) {
      expect(cards.cardBackCanvas(p)).toBe(back.cardBackV3(p));
      const m = cards.cardMip('back', p);
      const v3 = back.cardBackMipV3(p)!;
      expect(m.levels[0]).toBe(back.cardBackV3(p));
      expect(m.levels.slice(1)).toEqual(v3.levels);
      expect(m.levels.map((l) => [l.w, l.h])).toEqual([
        [48, 68],
        [24, 34],
        [18, 26],
      ]);
      expect(m.edge).toBe(v3.edge);
      for (const o of ['up', 'side'] as const) expect(cards.isoCanvas('back', o, p).data).toEqual(cards.renderFlat('back', o, p).data);
      expect(cards.cardBackCanvas(p).data).not.toEqual(today);
      expect(cards.isoCanvas('back', 'up', p).data).not.toEqual(todayIso);
    }
    // owner-toned: the two players' backs differ at every level and on the board
    expect(cards.cardBackCanvas(1).data).not.toEqual(cards.cardBackCanvas(0).data);
    expect(cards.cardMip('back', 1).levels[2].data).not.toEqual(cards.cardMip('back', 0).levels[2].data);
    expect(cards.isoCanvas('back', 'side', 1).data).not.toEqual(cards.isoCanvas('back', 'side', 0).data);
    expect(cards.cardBackKey(1)).toBe('card:back:p2');
  });

  it('lane off (v3 &a6=b) and v1: today\'s back, byte for byte', async () => {
    const v1 = await load('v1');
    const today = v1.cards.cardBackCanvas(0).data.slice();
    const todayMip = v1.cards.cardMip('back', 1).levels.map((l) => l.data.slice());
    const todayIso = ([0, 1] as const).map((p) => (['up', 'side'] as const).map((o) => v1.cards.isoCanvas('back', o, p).data.slice()));
    expect(v1.flags.V3_A6_A).toBe(false);
    expect(v1.cards.cardBackCanvas(1)).toBe(v1.cards.cardBackCanvas(0));
    const off = await load('v3', { a6: 'b' });
    expect(off.flags.V3_A6_A).toBe(false);
    for (const p of [0, 1] as const) {
      expect(off.cards.cardBackCanvas(p).data).toEqual(today);
      expect(off.cards.cardMip('back', p).levels.map((l) => l.data)).toEqual(todayMip);
      expect((['up', 'side'] as const).map((o) => off.cards.isoCanvas('back', o, p).data)).toEqual(todayIso[p]);
    }
  });

  it('keeps today\'s silhouettes: the overlay sources (card:sil / glow / sheen, iso silhouettes) do not change', async () => {
    const v1 = await load('v1');
    const mask = alphaMask(v1.cards.cardBackCanvas(0));
    const isoSil = (['up', 'side'] as const).map((o) => v1.cards.renderFlat('back', o, 0, { solid: 0xffffff, outline: false }).data.slice());
    const isoSilOut = (['up', 'side'] as const).map((o) => v1.cards.renderFlat('back', o, 0, { solid: 0xffffff }).data.slice());
    const v3 = await load('v3');
    for (const p of [0, 1] as const) expect(alphaMask(v3.cards.cardBackCanvas(p))).toBe(mask);
    expect(alphaMask(v3.back.drawBackV3(0, 'mini'))).toBe('1'.repeat(18 * 26));
    expect((['up', 'side'] as const).map((o) => v3.cards.renderFlat('back', o, 0, { solid: 0xffffff, outline: false }).data)).toEqual(isoSil);
    expect((['up', 'side'] as const).map((o) => v3.cards.renderFlat('back', o, 0, { solid: 0xffffff }).data)).toEqual(isoSilOut);
  });

  it('speaks FRAME_V3: palette only, 1-px ink outline with cut corners, ONE owner trim (lit top / left, dark bottom / right)', async () => {
    const { back, palette } = await load('v3');
    const pal = new Set<number>(Object.values(palette.PAL));
    for (const p of [0, 1] as const) {
      const R = palette.PLAYER_RAMP[p];
      for (const level of ['full', 'half', 'mini', 'hand'] as const) expect(offPalette(back.drawBackV3(p, level), pal)).toBe(0);
      for (const level of ['full', 'half', 'hand'] as const) {
        const c = back.drawBackV3(p, level);
        const W = c.w;
        const H = c.h;
        // corners cut, outline ink
        for (const [x, y] of [
          [0, 0],
          [W - 1, 0],
          [0, H - 1],
          [W - 1, H - 1],
        ])
          expect(rgbAt(c, x, y)).toBeNull();
        for (let x = 1; x < W - 1; x++) {
          expect(rgbAt(c, x, 0)).toBe(palette.PAL.ink);
          expect(rgbAt(c, x, H - 1)).toBe(palette.PAL.ink);
        }
        for (let y = 1; y < H - 1; y++) {
          expect(rgbAt(c, 0, y)).toBe(palette.PAL.ink);
          expect(rgbAt(c, W - 1, y)).toBe(palette.PAL.ink);
        }
        // the owner trim one pixel inside
        expect(rgbAt(c, 1, Math.floor(H / 2))).toBe(R[3]);
        expect(rgbAt(c, Math.floor(W / 2), 1)).toBe(R[3]);
        expect(rgbAt(c, W - 2, Math.floor(H / 2))).toBe(R[2]);
        expect(rgbAt(c, Math.floor(W / 2), H - 2)).toBe(R[2]);
      }
      // the board level: the trim on its border pixels (the renderer outlines it)
      const m = back.drawBackV3(p, 'mini');
      expect(rgbAt(m, 0, 13)).toBe(R[3]);
      expect(rgbAt(m, 17, 13)).toBe(R[2]);
      expect(back.backEdgeTone(p)).toBe(R[1]);
    }
  });

  it('is deterministic (a second paint gives the same bytes)', async () => {
    const { back } = await load('v3');
    for (const p of [0, 1] as const)
      for (const level of ['full', 'half', 'mini', 'hand'] as const) expect(back.drawBackV3(p, level).data).toEqual(back.drawBackV3(p, level).data);
  });
});

describe('A6-A A1 — crisp raster (KO-1)', { timeout: 60_000 }, () => {
  it('rasters to whole-pixel sizes, the outline and trim rings stay 1 px and continuous', async () => {
    const { back, raster, palette } = await load('v3');
    const pal = new Set<number>(Object.values(palette.PAL));
    for (const p of [0, 1] as const) {
      const R = palette.PLAYER_RAMP[p];
      const src = back.cardBackV3(p);
      for (const [w, h] of [
        [36, 51],
        [30, 43],
        [24, 34],
        [60, 85],
        [72, 102],
      ]) {
        const c = raster.rasterCard(src, w, h);
        expect([c.w, c.h]).toEqual([w, h]);
        expect(offPalette(c, pal)).toBe(0);
        expect(rgbAt(c, 0, 0)).toBeNull();
        expect(rgbAt(c, w - 1, h - 1)).toBeNull();
        for (let x = 1; x < w - 1; x++) expect(rgbAt(c, x, 0)).toBe(palette.PAL.ink);
        for (let y = 1; y < h - 1; y++) expect(rgbAt(c, w - 1, y)).toBe(palette.PAL.ink);
        for (let y = 2; y < h - 2; y++) {
          expect(rgbAt(c, 1, y)).toBe(R[3]);
          expect(rgbAt(c, w - 2, y)).toBe(R[2]);
        }
        expect(raster.rasterCard(src, w, h).data).toEqual(c.data);
      }
      // same size: an exact copy
      expect(raster.rasterCard(src, 48, 68).data).toEqual(src.data);
    }
  });

  it('turn frames: 48 → 34 → 18 → 4 (edge, a white line) → 18 → 34 → 48; 24 → 17 → 9 → 2 → 9 → 17 → 24', async () => {
    const { back, raster, palette, cards } = await load('v3');
    const face = cards.cardFaceCanvas('crystal_wyrm');
    const f48 = raster.turnFrames(back.cardBackV3(0), face, 48, 68);
    expect(f48.map((f) => [f.w, f.h])).toEqual(Array(6).fill([48, 68]));
    expect(f48.map(opaqueWidth)).toEqual([34, 18, 4, 18, 34, 48]);
    const edge = f48[2];
    let white = 0;
    for (let y = 0; y < 68; y++) for (let x = 0; x < 48; x++) if (rgbAt(edge, x, y) === palette.PAL.white) white++;
    expect(white).toBe(66);
    expect(f48[5].data).toEqual(raster.rasterCard(face, 48, 68).data);
    const f24 = raster.turnFrames(back.cardBackV3(1), face, 24, 34);
    expect(f24.map(opaqueWidth)).toEqual([17, 9, 2, 9, 17, 24]);
    expect(raster.turnWidths(48)).toEqual({ steps: [34, 18], edge: 4 });
  });

  it('display sizes are whole pixels; whole-number scales are recognised', async () => {
    const { raster } = await load('v3');
    expect(raster.displaySize(0.75)).toEqual({ w: 36, h: 51 });
    expect(raster.displaySize(0.5)).toEqual({ w: 24, h: 34 });
    expect(raster.displaySize(MINI_SCALE)).toEqual({ w: 9, h: 13 });
    expect(raster.integerScale(2)).toBe(2);
    expect(raster.integerScale(1)).toBe(1);
    expect(raster.integerScale(1.5)).toBeNull();
    expect(raster.integerScale(1, 2)).toBeNull();
  });
});

describe('A6-A A1 — motion LOD face', { timeout: 60_000 }, () => {
  it('keeps the rings, flattens the portrait into ≤ 3 tones, is cached and deterministic', async () => {
    const { lod, cards, palette } = await load('v3');
    for (const id of ['crystal_wyrm', 'ember_wolf', 'judgment_bolt', 'mirror_barrier'] as const) {
      const face = cards.cardFaceCanvas(id);
      const l = lod.lodFace(id);
      expect([l.w, l.h]).toEqual([48, 68]);
      expect(lod.lodFace(id)).toBe(l);
      expect(lod.deriveLodFace(face).data).toEqual(l.data);
      // outline + trim rings as on the face
      for (let x = 0; x < 48; x++) {
        expect(rgbAt(l, x, 0)).toBe(rgbAt(face, x, 0));
        expect(rgbAt(l, x, 1)).toBe(rgbAt(face, x, 1));
      }
      // the portrait inside its 1-px ink frame: at most 3 tones
      const { art } = lod.FACE_REGIONS;
      const tones = new Set<number>();
      for (let y = art.y + 1; y < art.y + art.h - 1; y++) for (let x = art.x + 1; x < art.x + art.w - 1; x++) tones.add(rgbAt(l, x, y)!);
      expect(tones.size).toBeLessThanOrEqual(3);
      expect(rgbAt(l, art.x, art.y)).toBe(palette.PAL.ink);
      const m = lod.lodMip(id);
      expect(m.levels.map((v) => [v.w, v.h])).toEqual([
        [48, 68],
        [24, 34],
        [18, 26],
      ]);
      expect(m.levels[2]).toBe(cards.cardMip(id).levels[2]);
    }
  });
});

describe('A6-A A1 — CardV3 helpers (S-9)', { timeout: 60_000 }, () => {
  it('cardTurnFrames: from the shown side to the other, last = the other side; unknown card → none', async () => {
    await load('v3');
    const cv3 = await import('../../src/view/v3/CardV3');
    const cards = await import('../../src/art/cards');
    const raster = await import('../../src/view/v3/cardRaster');
    const up = cv3.cardTurnFrames('ember_wolf', false, 1, 48, 68);
    expect(up.length).toBe(6);
    expect(up[5].data).toEqual(raster.rasterCard(cards.cardFaceCanvas('ember_wolf'), 48, 68).data);
    const down = cv3.cardTurnFrames('ember_wolf', true, 1, 48, 68);
    expect(down[5].data).toEqual(cards.cardBackCanvas(1).data);
    expect(cv3.cardTurnFrames(null, false, 0, 48, 68)).toEqual([]);
    // the narrow frame of the face uses the motion LOD (fewer tones than the squeezed face)
    expect(up[3].data).not.toEqual(raster.centreIn(raster.squeezeCard(cards.cardFaceCanvas('ember_wolf'), 18), 48, 68).data);
  });

  it('sideSource: the face, or the owner\'s back level that fits the width', async () => {
    await load('v3');
    const cv3 = await import('../../src/view/v3/CardV3');
    const cards = await import('../../src/art/cards');
    const back = await import('../../src/view/v3/cardBack');
    expect(cv3.sideSource('crystal_wyrm', true, 0, 48)).toBe(cards.cardFaceCanvas('crystal_wyrm'));
    expect(cv3.sideSource('crystal_wyrm', false, 1, 48)).toBe(back.cardBackV3(1));
    expect(cv3.sideSource(null, true, 1, 30)).toBe(back.cardBackV3(1));
    expect([cv3.sideSource(null, false, 0, 20).w, cv3.sideSource(null, false, 0, 20).h]).toEqual([24, 34]);
    expect(cv3.sideSource(null, false, 0, 9)).toBe(back.miniHandBackV3(0));
    const r = cv3.cardRaster(null, false, 0, 36, 51);
    expect(cv3.cardRaster(null, false, 0, 36, 51)).toBe(r);
    expect(cv3.rampOf(cards.cardAccent('crystal_wyrm'))).toBeTruthy();
  });

  it('createCardV3 hands over to today\'s CardSprite with lane A6-A off', async () => {
    await load('v3', { a6: 'b' });
    const cv3 = await import('../../src/view/v3/CardV3');
    expect(cv3.CardV3.prototype).toBeTruthy();
    const flags = await import('../../src/view/v3flags');
    expect(flags.V3_A6_A).toBe(false);
  });
});

// A6-A's own files as text for the §6.4 source scan (vite's raw import: no node types needed).
const A6A_SOURCES = import.meta.glob<string>(
  [
    '/src/view/v3/cardBack.ts',
    '/src/view/v3/cardRaster.ts',
    '/src/view/v3/cardLod.ts',
    '/src/view/v3/CardV3.ts',
    '/src/dev/previews/cards3.ts',
    '/src/view/v3/handV3.ts',
    '/src/view/v3/inspectV3.ts',
    '/src/cinematics/v3small/set.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
);

// §6.3's camera-call pattern, assembled from pieces so this file does not match the same scan itself.
const CAMERA_CALL = new RegExp(['\\bfo' + 'cus\\(', 'close' + 'Up', 'set' + 'Zoom', '\\.pa' + 'n\\(', 'desc' + 'end\\('].join('|'));

describe('A6-A source scan (§6.3 / §6.4)', { timeout: 60_000 }, () => {
  it('no colour constant outside the palette, no ADD blend, no alpha fade, no Math.random, no camera call', async () => {
    const { PAL } = await import('../../src/art/palette');
    const PAL_SET = new Set<number>(Object.values(PAL));
    expect(Object.keys(A6A_SOURCES).length).toBe(8);
    for (const [f, src] of Object.entries(A6A_SOURCES)) {
      const hexes = [...src.matchAll(/0x[0-9a-fA-F]{6}\b/g)].map((m) => Number(m[0]));
      expect(
        hexes.filter((c) => !PAL_SET.has(c)),
        f,
      ).toEqual([]);
      expect(/BlendModes\.ADD|setBlendMode\(/.test(src), `${f}: blend`).toBe(false);
      expect(/\.setAlpha\(/.test(src), `${f}: alpha`).toBe(false);
      expect(/Math\.random/.test(src), `${f}: random`).toBe(false);
      expect(CAMERA_CALL.test(src), `${f}: camera`).toBe(false);
    }
  });
});

// ================================================================ step A2 (K1 hand, K12 inspect)

/** Step a track by game frames and read it as the screen does (whole pixels). */
function trace(track: { step(dt: number): void; value: number; moving: boolean }, ms: number): number[] {
  const out: number[] = [];
  for (let t = 0; t <= ms; t += 1000 / 60) {
    out.push(Math.round(track.value));
    track.step(1000 / 60);
  }
  return out;
}

describe('A6-A A2 — the v3 hand (K1), pure parts', { timeout: 60_000 }, () => {
  it('fan: straight, a y curve only — the outer cards 1–4 px lower, symmetric, deepest at the ends', async () => {
    await load('v3');
    const h = await import('../../src/view/v3/handV3');
    expect(h.fanDip(0, 1)).toBe(0);
    for (let n = 2; n <= 10; n++) {
      const dips = Array.from({ length: n }, (_, i) => h.fanDip(i, n));
      expect(Math.max(...dips), `n=${n}`).toBeLessThanOrEqual(4);
      expect(dips[0], `n=${n}`).toBeGreaterThanOrEqual(1);
      expect(dips[0]).toBe(dips[n - 1]);
      for (let i = 0; i < n; i++) expect(Number.isInteger(dips[i])).toBe(true);
      for (let i = 1; i <= Math.floor((n - 1) / 2); i++) expect(dips[i]).toBeLessThanOrEqual(dips[i - 1]);
    }
  });

  it('hover: the neighbours open ±12 / ±7 / ±4, a 2-px gap never closes, every x a whole pixel', async () => {
    await load('v3');
    const h = await import('../../src/view/v3/handV3');
    expect([1, 2, 3, 4].map((d) => h.spreadOf(5 + d, 5))).toEqual([12, 7, 4, 4]);
    expect([1, 2, 3].map((d) => h.spreadOf(5 - d, 5))).toEqual([-12, -7, -4]);
    const band = { x: 160, w: 320 };
    for (let n = 1; n <= 9; n++) {
      const rest = h.fanXs(n, -1, band, 48);
      for (let hi = -1; hi < n; hi++) {
        const xs = h.fanXs(n, hi, band, 48);
        for (const x of xs) expect(Number.isInteger(x)).toBe(true);
        if (hi < 0) continue;
        expect(xs[hi]).toBe(rest[hi]);
        for (let i = 0; i < n; i++) {
          if (i === hi) continue;
          const moved = xs[i] - rest[i];
          expect(Math.sign(moved), `n=${n} h=${hi} i=${i}`).toBe(Math.sign(i - hi));
          expect(Math.abs(moved)).toBeGreaterThanOrEqual(Math.abs(h.spreadOf(i, hi)) - 1);
        }
        for (let i = 1; i < n; i++) {
          const restGap = rest[i] - rest[i - 1] - 48;
          if (restGap >= 2) expect(xs[i] - xs[i - 1] - 48, `n=${n} h=${hi} gap ${i}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('breathing: 0 / −1 px on a 2400 ms period, the phase 300 ms later per card; none with reduced motion', async () => {
    await load('v3');
    const h = await import('../../src/view/v3/handV3');
    expect(h.HAND3.breathMs).toBe(2400);
    expect(h.HAND3.breathStep).toBe(300);
    const seen = new Set<number>();
    for (let t = 0; t < 2400; t += 50) seen.add(h.breathOf(t, 0, false));
    expect([...seen].sort()).toEqual([-1, 0]);
    expect(h.breathOf(1300, 0, false)).toBe(-1);
    expect(h.breathOf(1300, 300, false)).toBe(0);
    for (let t = 0; t < 2400; t += 50) expect(h.breathOf(t, 0, true)).toBe(0);
  });

  it('reject: x +2 −2 +1 −1 0 in 30 ms steps (150 ms, inside the 180 ms invalid-click budget)', async () => {
    await load('v3');
    const h = await import('../../src/view/v3/handV3');
    const motion = await import('../../src/view/v3/motion');
    expect([0, 30, 60, 90, 120, 150, 400].map((t) => h.rejectOffset(t))).toEqual([2, -2, 1, -1, 0, 0, 0]);
    expect(h.HAND3.rejectStepMs * h.HAND3.reject.length).toBeLessThanOrEqual(motion.A6_MS.invalidClick.max);
  });

  it('lift: hover rises to −18 by 100 ms and settles on −16; select presses to −13, pops to −17, lands on −16; leave has no overshoot', async () => {
    await load('v3');
    const h = await import('../../src/view/v3/handV3');
    const base = 326;
    const rise = new h.Track(base);
    rise.play(h.liftKeys('rest', 'hover', base, false));
    const r = trace(rise, 200);
    expect(Math.min(...r)).toBe(base - 18);
    expect(r[r.length - 1]).toBe(base - 16);
    expect(r.findIndex((v) => v === base - 18) * (1000 / 60)).toBeLessThanOrEqual(110);
    // easeOutCubic over 100 ms: the first frame is the biggest step (8 px), then it slows
    for (let i = 1; i < r.length; i++) expect(Math.abs(r[i] - r[i - 1])).toBeLessThanOrEqual(8);
    const press = new h.Track(base - 16);
    press.play(h.liftKeys('hover', 'select', base, false));
    const p = trace(press, 160);
    expect(Math.max(...p)).toBe(base - 13);
    expect(Math.min(...p)).toBe(base - 17);
    expect(p[p.length - 1]).toBe(base - 16);
    const leave = new h.Track(base - 16);
    leave.play(h.liftKeys('hover', 'rest', base, false));
    const l = trace(leave, 160);
    expect(Math.max(...l)).toBe(base);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThanOrEqual(l[i - 1]);
    const mark = new h.Track(base);
    mark.play(h.liftKeys('rest', 'mark', base, false));
    expect(trace(mark, 140).pop()).toBe(base - 9);
    // reduced motion: one 60 ms move straight onto the lift (no overshoot, no press)
    const red = new h.Track(base);
    red.play(h.liftKeys('rest', 'hover', base, true));
    const rr = trace(red, 120);
    expect(Math.min(...rr)).toBe(base - 16);
    const redSel = h.liftKeys('hover', 'select', base, true);
    expect(redSel.length).toBe(1);
    expect(redSel[0].v).toBe(base - 16);
  });

  it('rims (KO-3): owner tone + node when playable, lit top-left on hover, gold with two nodes when selected, crimson when marked, a tone down and held when locked', async () => {
    await load('v3');
    const h = await import('../../src/view/v3/handV3');
    const { PAL, PLAYER_RAMP } = await import('../../src/art/palette');
    const st = { owner: 0 as const, faceDown: false, playable: true, hover: false, selected: false, marked: false, markColor: PAL.crim3, locked: false };
    const R = PLAYER_RAMP[0];
    expect(h.handRim(st)).toMatchObject({ tl: R[3], br: R[3], nodes: 1 });
    expect(h.handRim({ ...st, owner: 1 })).toMatchObject({ tl: PLAYER_RAMP[1][3], br: PLAYER_RAMP[1][3] });
    expect(h.handRim({ ...st, hover: true })).toMatchObject({ tl: R[4], br: R[3], nodes: 1 });
    expect(h.handRim({ ...st, selected: true })).toMatchObject({ tl: PAL.gold3, br: PAL.gold3, nodes: 2 });
    expect(h.handRim({ ...st, marked: true })).toMatchObject({ tl: PAL.crim3, br: PAL.crim3, nodes: 1 });
    expect(h.handRim({ ...st, locked: true })).toMatchObject({ tl: R[2], br: R[2], nodes: 1, run: false });
    expect(h.handRim({ ...st, faceDown: true })).toBeNull();
    expect(h.handRim({ ...st, playable: false })).toBeNull();
    expect(h.handRim({ ...st, playable: false, hover: true })).toEqual({ tl: PAL.mist, br: null });
  });

  it('hover notes climb an A-minor pentatonic ladder left → right', async () => {
    await load('v3');
    const h = await import('../../src/view/v3/handV3');
    const n = 7;
    const p = Array.from({ length: n }, (_, i) => h.hoverPitch(i, n));
    for (let i = 1; i < n; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
    const semis = p.map((x) => Math.round(12 * Math.log2(x / p[3])));
    expect(semis).toEqual([-7, -5, -2, 0, 3, 5, 7]);
  });
});

describe('A6-A A2 — CardV3 rim ring (KO-3)', { timeout: 60_000 }, () => {
  it('paintRing: 1 px outside the card, corners cut, top + left in tl, bottom + right in br, null edges left out', async () => {
    await load('v3');
    const cv3 = await import('../../src/view/v3/CardV3');
    const { PAL } = await import('../../src/art/palette');
    const p = cv3.paintRing(48, 68, PAL.cyan4, PAL.cyan3) as unknown as Canvas;
    expect([p.w, p.h]).toEqual([50, 70]);
    expect(rgbAt(p, 0, 0)).toBeNull();
    expect(rgbAt(p, 49, 69)).toBeNull();
    expect(rgbAt(p, 10, 0)).toBe(PAL.cyan4);
    expect(rgbAt(p, 0, 10)).toBe(PAL.cyan4);
    expect(rgbAt(p, 10, 69)).toBe(PAL.cyan3);
    expect(rgbAt(p, 49, 10)).toBe(PAL.cyan3);
    expect(rgbAt(p, 10, 10)).toBeNull();
    const strip = cv3.paintRing(48, 68, PAL.mist, null) as unknown as Canvas;
    expect(rgbAt(strip, 10, 0)).toBe(PAL.mist);
    expect(rgbAt(strip, 10, 69)).toBeNull();
    expect(rgbAt(strip, 49, 10)).toBeNull();
  });
});

describe('A6-A A2 — the v3 inspect panel (K12) and its pile view (S-9)', { timeout: 60_000 }, () => {
  it('painters speak FRAME_V3 and the palette only: panel, stepped light, divider, stack, empty slot', async () => {
    const { palette } = await load('v3');
    const iv = await import('../../src/view/v3/inspectV3');
    const PAL_SET = new Set<number>(Object.values(palette.PAL));
    const R = palette.RAMPS.water;
    const all = [iv.paintPanel('monster'), iv.paintPanel('p2'), iv.paintLight(R, 0), iv.paintLight(R, 1), iv.paintDivider(R), iv.paintStack(2, palette.PLAYER_RAMP[0]), iv.paintEmptySlot()];
    for (const c of all) expect(offPalette(c as unknown as Canvas, PAL_SET)).toBe(0);
    const panel = iv.paintPanel('monster') as unknown as Canvas;
    expect(rgbAt(panel, 0, 0)).toBeNull();
    expect(rgbAt(panel, 5, 0)).toBe(palette.PAL.ink);
    expect(rgbAt(panel, 5, 1)).toBe(palette.RAMPS.gold[3]);
    // the light steps down away from the card: ramp[2] on its edge, ramp[1], then ramp[0]
    const l0 = iv.paintLight(R, 0) as unknown as Canvas;
    const l1 = iv.paintLight(R, 1) as unknown as Canvas;
    const mid = Math.floor(l0.w / 2);
    expect([5, 4, 3, 2].map((y) => rgbAt(l0, mid, y))).toEqual([R[2], R[1], R[1], R[0]]);
    expect(rgbAt(l0, mid, 1)).toBeNull();
    expect(rgbAt(l1, mid, 1)).toBe(R[0]);
    expect(rgbAt(l0, mid, 6)).toBeNull();
  });

  it('pile words name counts only (KO-11), in Turkish; a hidden card stays "Kapalı Kart"', async () => {
    await load('v3');
    const iv = await import('../../src/view/v3/inspectV3');
    expect(iv.pileWords('deck', 0, 12).name).toBe('Deste · 12 kart');
    expect(iv.pileWords('hand', 1, 4).name).toBe('Rakibin eli · 4 kart');
    expect(iv.pileWords('graveyard', 0, 3).name).toBe('Mezarlık · 3 kart');
    expect(iv.pileWords('deck', 1, 0).type).toBe('OYUNCU 2');
    const hidden = iv.cardWords(null);
    expect(hidden.name).toBe('Kapalı Kart');
    expect(iv.trimFor(null, 1)).toBe('p2');
    expect(iv.trimFor(null, null)).toBe('neutral');
    expect(iv.trimFor('judgment_bolt', 0)).toBe('spell');
    expect(iv.trimFor('mirror_barrier', 0)).toBe('trap');
    expect(iv.trimFor('crystal_wyrm', 1)).toBe('monster');
  });

  it('showPile hands back false with lane A6-A off (the caller keeps its path), true with it on', async () => {
    await load('v3', { a6: 'b' });
    const off = await import('../../src/view/v3/inspectV3');
    let called = 0;
    const panel = { showPile: () => (++called, true) } as unknown as Parameters<typeof off.showPile>[0];
    expect(off.showPile(panel, 'deck', 0, 3)).toBe(false);
    expect(called).toBe(0);
    await load('v3');
    const on = await import('../../src/view/v3/inspectV3');
    expect(on.showPile(panel, 'deck', 0, 3)).toBe(true);
    expect(called).toBe(1);
  });
});

// ================================================================ K4 set (brought forward to A56.K)

describe('A6-A registration audit (§6.4): lane A fills only its own hooks, only under V3_A6_A', () => {
  const LANE_A_HOOKS = ['draw', 'discard', 'riffle', 'deal', 'set', 'tributeBody', 'pileAccept'];
  async function filled(look: 'v1' | 'v3', a6?: string): Promise<string[]> {
    vi.resetModules();
    G.__NEON_LOOK = look;
    if (a6 !== undefined) G.__NEON_V3FLAGS = { a6 };
    else delete G.__NEON_V3FLAGS;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { loadCinematics } = await import('../../src/cinematics');
    const loaded = await loadCinematics();
    errors.mockRestore();
    expect(loaded.some((p) => p.includes('v3small/set'))).toBe(true);
    const { filledV3Hooks } = await import('../../src/cinematics/v3small/_hooks');
    return filledV3Hooks();
  }

  it('v1: none; v3 lane A on: set (and nothing outside lane A); lane A off: none of A’s', async () => {
    expect(await filled('v1')).toEqual([]);
    const a = await filled('v3', 'a');
    expect(a).toEqual(expect.arrayContaining(['set']));
    expect(a.filter((h) => !LANE_A_HOOKS.includes(h))).toEqual([]);
    for (const a6 of ['off', 'b']) expect((await filled('v3', a6)).filter((h) => LANE_A_HOOKS.includes(h)), `a6=${a6}`).toEqual([]);
  }, 120000);

  it('K4 beats fit A6_MS.set: input ≤ lock (with the tween’s start frame and a whole-frame landing), tail ≤ tail, reduced ≤ reduced', async () => {
    vi.resetModules();
    G.__NEON_LOOK = 'v3';
    G.__NEON_V3FLAGS = { a6: 'a' };
    const { SET_V3_MS } = await import('../../src/cinematics/v3small/set');
    const { A6_MS } = await import('../../src/view/v3/motion');
    const FRAME = 1000 / 60;
    const row = A6_MS.set;
    // the seal closes in three steps before the latch, the latch frame comes before the input
    expect([...SET_V3_MS.seal].every((t, i, a) => i === 0 || t > a[i - 1])).toBe(true);
    expect(SET_V3_MS.inputBack).toBeGreaterThan(SET_V3_MS.seal[SET_V3_MS.seal.length - 1]);
    // the flight, its first frame, the landing frame's rounding and the input-back frame
    const input = SET_V3_MS.flight + SET_V3_MS.inputBack + 3 * FRAME;
    expect(input).toBeLessThanOrEqual(row.lock ?? row.max);
    expect(SET_V3_MS.end - SET_V3_MS.inputBack).toBeLessThanOrEqual(row.tail ?? 250);
    expect(SET_V3_MS.reducedFlight + SET_V3_MS.reducedLanding + 3 * FRAME).toBeLessThanOrEqual(row.reduced ?? row.max);
  }, 60000);
});
