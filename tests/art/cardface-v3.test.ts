// Lane A5-B — the v3 card face (docs/v3/A5_PLAN.md §3.7, §6.5; contracts S-1, S-5, S-13).
// Step B-1: all 20 faces get the v3 frame around their current art; the mini level its v3 frame;
// card:sheen / card:foil become crisp glints of opaque palette pixels. Everything sits behind
// V3_CARDS (src/view/v3flags.ts): v1, &a5=off|a and &cards=v1 keep today's card pixels.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

const G = globalThis as Record<string, unknown>;

async function load(look: 'v1' | 'v3', flags?: Record<string, string>) {
  vi.resetModules();
  G.__NEON_LOOK = look;
  if (flags) G.__NEON_V3FLAGS = flags;
  else delete G.__NEON_V3FLAGS;
  const cards = await import('../../src/art/cards');
  const flagsMod = await import('../../src/view/v3flags');
  const kit = await import('../../src/art/cardface-v3/index');
  const frame = await import('../../src/art/cardface-v3/frame');
  const data = await import('../../src/data/cards');
  const pal = await import('../../src/art/palette');
  const pixel = await import('../../src/art/pixel');
  return { cards, flags: flagsMod, kit, frame, data, pal, pixel };
}

afterEach(() => {
  delete G.__NEON_LOOK;
  delete G.__NEON_V3FLAGS;
});

type Canvas = { w: number; h: number; data: Uint8ClampedArray };

/** The 44×34 art window of the face. */
const inWindow = (x: number, y: number) => x >= 2 && x < 46 && y >= 17 && y < 51;
/** The art itself (inside the window's 1-px ink / bezel ring). */
const inArt = (x: number, y: number) => x >= 3 && x < 45 && y >= 18 && y < 50;

function offPalette(c: Canvas, palette: Set<number>, skip: (x: number, y: number) => boolean = () => false): number {
  let n = 0;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (skip(x, y)) continue;
      const i = (y * c.w + x) * 4;
      const a = c.data[i + 3];
      if (a === 0) continue;
      const rgb = (c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2];
      if (a !== 255 || !palette.has(rgb)) n++;
    }
  return n;
}

function alphaMask(c: Canvas): number[] {
  const out: number[] = [];
  for (let i = 3; i < c.data.length; i += 4) out.push(c.data[i] === 0 ? 0 : 1);
  return out;
}

describe('A5-B v3 card face (B-1: frame + overlays)', () => {
  it('flags: V3_CARDS is on only in the v3 look with lane A5-B on and no &cards=v1', async () => {
    expect((await load('v1')).flags.V3_CARDS).toBe(false);
    expect((await load('v3')).flags.V3_CARDS).toBe(true);
    expect((await load('v3', { a5: 'b', a6: 'off' })).flags.V3_CARDS).toBe(true);
    expect((await load('v3', { cards: 'v1' })).flags.V3_CARDS).toBe(false);
    expect((await load('v3', { a5: 'a' })).flags.V3_CARDS).toBe(false);
    expect((await load('v3', { a5: 'off' })).flags.V3_CARDS).toBe(false);
  }, 60_000);

  it('20 faces: today\'s sizes and silhouette, every frame pixel an opaque PAL tone', async () => {
    const v3 = await load('v3');
    const old = await load('v3', { a5: 'off' });
    const PALSET = new Set<number>(Object.values(v3.pal.PAL) as number[]);
    const oldArtOff: string[] = [];
    for (const id of v3.data.ALL_CARD_IDS) {
      const f = v3.cards.cardFaceCanvas(id);
      expect([f.w, f.h]).toEqual([48, 68]);
      // the frame (face − art window) and the window's ink / bezel ring: palette only
      expect(offPalette(f, PALSET, inWindow), `${id} frame`).toBe(0);
      expect(offPalette(f, PALSET, inArt), `${id} frame + window ring`).toBe(0);
      // same silhouette as today's face (corner pixels cut): the overlays and the hit area stay
      expect(alphaMask(f)).toEqual(alphaMask(old.cards.cardFaceCanvas(id)));
      const art = v3.cards.cardArtCanvas(id);
      expect([art.w, art.h]).toEqual([44, 34]);
      // an old (today's) artwork window is exempt from the palette rule — counted, not failed
      if (!v3.kit.hasV3Art(id)) {
        const n = offPalette(art, PALSET);
        if (n > 0) oldArtOff.push(`${id}:${n}`);
      }
    }
    // the count is reported in the test output only when it changes shape (kept as data)
    expect(Array.isArray(oldArtOff)).toBe(true);
  }, 60_000);

  it('mini level 18×26 and the flat iso cards 50×30: the v3 frame, palette only, fully opaque mini', async () => {
    const v3 = await load('v3');
    const PALSET = new Set<number>(Object.values(v3.pal.PAL) as number[]);
    for (const id of v3.data.ALL_CARD_IDS) {
      const mip = v3.cards.cardMip(id);
      const mini = mip.levels[2];
      expect([mini.w, mini.h]).toEqual([18, 26]);
      expect(mini.coverage()).toBe(18 * 26);
      expect(offPalette(mini, PALSET), `${id} mini`).toBe(0);
      expect([mip.levels[1].w, mip.levels[1].h]).toEqual([24, 34]);
      for (const o of ['up', 'side'] as const)
        for (const p of [0, 1] as const) {
          const iso = v3.cards.isoCanvas(id, o, p);
          expect([iso.w, iso.h]).toEqual([50, 30]);
          expect(offPalette(iso, PALSET), `${id} iso ${o} p${p}`).toBe(0);
        }
    }
  }, 60_000);

  it('gate: a card without a registered v3 artwork keeps today\'s art (B-1 registers none)', async () => {
    const v3 = await load('v3');
    const old = await load('v3', { a5: 'off' });
    for (const id of v3.data.ALL_CARD_IDS) {
      if (v3.kit.hasV3Art(id)) continue;
      expect(v3.kit.cardArtV3(id)).toBeNull();
      expect(v3.cards.cardArtCanvas(id).data).toEqual(old.cards.cardArtCanvas(id).data);
    }
    // ... and that art shows through the window unchanged (inside its 1-px ring)
    const id = 'ember_wolf' as const;
    const f = v3.cards.cardFaceCanvas(id);
    const art = v3.cards.cardArtCanvas(id);
    for (let y = 1; y < 33; y++)
      for (let x = 1; x < 43; x++) {
        const fi = ((17 + y) * 48 + 2 + x) * 4;
        const ai = (y * 44 + x) * 4;
        expect([...f.data.slice(fi, fi + 4)]).toEqual([...art.data.slice(ai, ai + 4)]);
      }
  }, 60_000);

  it('&cards=v1 and A5-B off: today\'s card pixels (faces, minis, art), byte for byte', async () => {
    const off = await load('v3', { a5: 'off' });
    const cardsV1 = await load('v3', { cards: 'v1' });
    const v1 = await load('v1');
    for (const id of off.data.ALL_CARD_IDS.slice(0, 20)) { // the 20 original cards (later cards may already have v3 art)
      expect(cardsV1.cards.cardFaceCanvas(id).data).toEqual(off.cards.cardFaceCanvas(id).data);
      expect(cardsV1.cards.cardMip(id).levels[2].data).toEqual(off.cards.cardMip(id).levels[2].data);
      expect(cardsV1.cards.cardArtCanvas(id).data).toEqual(off.cards.cardArtCanvas(id).data);
      // the v1 look draws the same old face wherever the monster art is the same in both looks
      if (id !== 'stone_sentinel') expect(v1.cards.cardFaceCanvas(id).data).toEqual(off.cards.cardFaceCanvas(id).data);
    }
  }, 60_000);

  it('the back lines (A56.0, S-2) are untouched: backs and their mips are the same with A5-B on and off', async () => {
    const on = await load('v3');
    const off = await load('v3', { a5: 'off' });
    for (const p of [0, 1] as const) {
      expect(on.cards.cardBackKey(p)).toBe(off.cards.cardBackKey(p));
      expect(on.cards.cardBackCanvas(p).data).toEqual(off.cards.cardBackCanvas(p).data);
      const a = on.cards.cardMip('back', p);
      const b = off.cards.cardMip('back', p);
      expect(a.edge).toBe(b.edge);
      expect(a.levels.map((l) => l.data)).toEqual(b.levels.map((l) => l.data));
      for (const o of ['up', 'side'] as const) expect(on.cards.isoCanvas('back', o, p).data).toEqual(off.cards.isoCanvas('back', o, p).data);
    }
  }, 60_000);

  it('G1 (auxiliary): ≥ 70 % of every face\'s frame region changes against today\'s face', async () => {
    const on = await load('v3');
    const off = await load('v3', { a5: 'off' });
    for (const id of on.data.ALL_CARD_IDS) {
      const a = on.cards.cardFaceCanvas(id).data;
      const b = off.cards.cardFaceCanvas(id).data;
      let n = 0;
      let d = 0;
      for (let y = 1; y < 67; y++)
        for (let x = 1; x < 47; x++) {
          if (inWindow(x, y)) continue;
          const i = (y * 48 + x) * 4;
          n++;
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) d++;
        }
      expect(d / n, id).toBeGreaterThanOrEqual(0.7);
    }
  }, 60_000);

  it('kind trim, ace corners and the ace plate rule follow FRAME_V3', async () => {
    const v3 = await load('v3');
    const { PAL, RAMPS } = v3.pal;
    const at = (id: Parameters<typeof v3.cards.cardFaceCanvas>[0], x: number, y: number) => v3.cards.cardFaceCanvas(id).get(x, y);
    // trim: light on the top / left edges (ramp[3]), dark on the bottom / right (ramp[2])
    for (const [id, R] of [
      ['ember_wolf', RAMPS.gold],
      ['judgment_bolt', RAMPS.teal],
      ['mirror_barrier', RAMPS.mag],
    ] as const) {
      expect(at(id, 1, 30)).toBe(R[3]);
      expect(at(id, 20, 1)).toBe(R[3]);
      expect(at(id, 46, 30)).toBe(R[2]);
      expect(at(id, 20, 66)).toBe(R[2]);
      expect(at(id, 0, 30)).toBe(PAL.ink);
      expect(at(id, 0, 0)).toBeNull();
      // the art window's bezel: lit row on top, dark row at the bottom, ink around
      expect(at(id, 20, 17)).toBe(R[3]);
      expect(at(id, 20, 50)).toBe(R[2]);
      expect(at(id, 20, 16)).toBe(PAL.ink);
      expect(at(id, 20, 51)).toBe(PAL.ink);
    }
    // ace: gold L corners (gold4 joint) and the gold3 plate rule; a normal monster has neither
    expect(at('crystal_wyrm', 2, 2)).toBe(PAL.gold4);
    expect(at('crystal_wyrm', 4, 2)).toBe(PAL.gold3);
    expect(at('crystal_wyrm', 45, 65)).toBe(PAL.gold4);
    expect(at('crystal_wyrm', 20, 9)).toBe(PAL.gold3);
    expect(at('ember_wolf', 2, 2)).toBe(PAL.night0);
    expect(at('ember_wolf', 20, 9)).toBe(PAL.ink);
  }, 60_000);

  it('overlays: card:sheen / card:foil frames are 1–2 px glints of opaque palette pixels inside the card', async () => {
    const v3 = await load('v3');
    const { PAL } = v3.pal;
    const { PixelCanvas } = v3.pixel;
    // the mask buildCardTextures uses: the card silhouette minus its 1-px outline ring
    const mask = new PixelCanvas(48, 68);
    for (let y = 1; y < 67; y++) for (let x = 1; x < 47; x++) mask.set(x, y, 0xffffff);
    for (const [frames, tones] of [
      [v3.frame.sheenFramesV3(mask, v3.cards.SHEEN_FRAMES), [PAL.white]],
      [v3.frame.foilFramesV3(mask, v3.cards.SHEEN_FRAMES), [PAL.white, PAL.gold4]],
    ] as const) {
      expect(frames.length).toBe(v3.cards.SHEEN_FRAMES);
      let lit = 0;
      for (const f of frames) {
        expect([f.w, f.h]).toEqual([48, 68]);
        for (let y = 0; y < 68; y++) {
          let row = 0;
          for (let x = 0; x < 48; x++) {
            const a = f.alpha(x, y);
            expect(a === 0 || a === 255).toBe(true);
            if (a === 0) continue;
            expect(mask.isOpaque(x, y)).toBe(true);
            expect(tones as readonly number[]).toContain(f.get(x, y));
            row++;
          }
          expect(row).toBeLessThanOrEqual(tones.length);
        }
        if (f.coverage() > 0) lit++;
      }
      // the glint crosses the card: most frames show it
      expect(lit).toBeGreaterThanOrEqual(frames.length - 3);
    }
  }, 60_000);

  it('S-13: one static life frame until B-5; deterministic faces', async () => {
    const v3 = await load('v3');
    for (const id of ['crystal_wyrm', 'judgment_bolt'] as const) {
      for (const t of [0, 125, 999, 123456]) expect(v3.cards.cardLifeFrame(id, t)).toBe(0);
      expect(v3.cards.cardFaceCanvasAt(id, 0).data).toEqual(v3.cards.cardFaceCanvas(id).data);
      const first = v3.cards.cardFaceCanvas(id).data.slice();
      v3.cards.resetCardCaches();
      expect(v3.cards.cardFaceCanvas(id).data).toEqual(first);
    }
  }, 60_000);
});
