// A56.0 S-2: the one card-back source. v1 keeps today's single back for both players (same key,
// same mip object); v3 keeps one back per player (card:back:p2, its own mip) — and while lane A6-A
// is empty (the A56.0 stub) both players' backs are today's pixels, byte for byte.

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
  const flagsMod = await import('../../src/view/v3flags');
  return { cards, back, flags: flagsMod };
}

afterEach(() => {
  delete G.__NEON_LOOK;
  delete G.__NEON_V3FLAGS;
});

describe('S-2 card back source', () => {
  it('v1: one back, one key, one mip for both players', async () => {
    const { cards, flags } = await load('v1');
    expect(flags.V3_A6_A).toBe(false);
    expect(cards.cardBackKey(0)).toBe(cards.CARD_BACK);
    expect(cards.cardBackKey(1)).toBe(cards.CARD_BACK);
    expect(cards.cardBackCanvas(1)).toBe(cards.cardBackCanvas(0));
    expect(cards.cardMip('back', 1)).toBe(cards.cardMip('back', 0));
    expect(cards.cardMip('back')).toBe(cards.cardMip('back', 0));
  });

  it('v3 (all lanes on, A6-A filled in step A1): per-player key and mip, each player\'s back from cardBackV3', async () => {
    // (A56.0 asserted today's pixels here while A6-A was the stub; lane A6-A's step A1 paints the
    // owner-toned v3 back — tests/v3/a6-cards.test.ts covers the source in full.)
    const v1 = await load('v1');
    const todayBack = v1.cards.cardBackCanvas(0).data.slice();
    const { cards, back, flags } = await load('v3');
    expect(flags.V3_A6_A).toBe(true);
    expect(cards.cardBackKey(0)).toBe('card:back');
    expect(cards.cardBackKey(1)).toBe('card:back:p2');
    for (const p of [0, 1] as const) {
      expect(cards.cardBackCanvas(p)).toBe(back.cardBackV3(p));
      expect(cards.cardBackCanvas(p).data).not.toEqual(todayBack);
      expect(cards.cardMip('back', p).levels.slice(1)).toEqual(back.cardBackMipV3(p)!.levels);
    }
    expect(cards.cardMip('back', 1)).not.toBe(cards.cardMip('back', 0));
    expect(cards.cardBackCanvas(1).data).not.toEqual(cards.cardBackCanvas(0).data);
  });

  it('v3 with A6-A off: the per-player keys stay, the pixels are today\'s back', async () => {
    const v1 = await load('v1');
    const todayBack = v1.cards.cardBackCanvas(0).data.slice();
    const { cards, flags } = await load('v3', { a6: 'b' });
    expect(flags.V3_A6_A).toBe(false);
    expect(cards.cardBackKey(1)).toBe('card:back:p2');
    expect(cards.cardBackCanvas(1).data).toEqual(todayBack);
  });
});
