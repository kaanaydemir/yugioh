// Calm arena (look v3, A1 item 8): the in-game layers must compose to exactly the still preview's
// arena (src/still/arena.ts drawArena) over the 640×360 frame, build fast and stay small.
import { describe, expect, it } from 'vitest';
import { PixelCanvas } from '../../src/art/pixel';
import { drawArena } from '../../src/still/arena';
import { CALM_BG_PARTS, CALM_BG_TONE, CALM_T, buildCalmArt, calmColorAt, calmTextureBytes, calmZones } from '../../src/view/board-calm/art';
import { GAME_H, GAME_W, zoneCell, isoToScreen } from '../../src/view/layout';

/** Compose the calm layers the way BoardViewCalm stacks them (ink base, tinted bg masks, slab). */
function compose(): PixelCanvas {
  const a = buildCalmArt();
  const out = new PixelCanvas(GAME_W, GAME_H);
  out.rect(0, 0, GAME_W, GAME_H, CALM_T.sky);
  for (const part of CALM_BG_PARTS)
    for (const L of a.bg[part])
      for (let j = 0; j < L.canvas.h; j++)
        for (let i = 0; i < L.canvas.w; i++) if (L.canvas.isOpaque(i, j)) out.set(L.x + i, L.y + j, CALM_BG_TONE[part]);
  out.blit(a.slab.canvas, a.slab.x, a.slab.y);
  // pads and trims sit on top in their still tones: they must not change a pixel
  for (const p of a.pads.values()) out.blit(p.canvas, p.x, p.y);
  for (const tr of a.trims) {
    const tone = (tr.back ? CALM_T.trimBack : CALM_T.trim)[tr.side];
    for (const q of tr.px) out.set(q.x, q.y, tone);
  }
  return out;
}

describe('calm arena art', () => {
  it('composes pixel-identical to the still drawArena() over the 640×360 frame', () => {
    const ref = new PixelCanvas(GAME_W, GAME_H);
    drawArena(ref);
    const got = compose();
    let diff = 0;
    let first = '';
    for (let y = 0; y < GAME_H; y++)
      for (let x = 0; x < GAME_W; x++)
        if (ref.get(x, y) !== got.get(x, y)) {
          if (!diff) first = `(${x}, ${y}) still ${ref.get(x, y)?.toString(16)} calm ${got.get(x, y)?.toString(16)}`;
          diff++;
        }
    expect(diff, first).toBe(0);
    // (the composite is exact, so the slab crop region clipped nothing)
    // the colour lookup used by the lava halos agrees
    const a = buildCalmArt();
    for (let y = 0; y < GAME_H; y += 7) for (let x = 0; x < GAME_W; x += 5) expect(calmColorAt(a, x, y)).toBe(ref.get(x, y));
  });

  it('has 20 zone pads, ordered trim paths and the shared zone masks', () => {
    const a = buildCalmArt();
    expect(a.pads.size).toBe(20);
    for (const z of calmZones()) {
      const c = zoneCell(z.player, z.spot, z.index);
      const s = isoToScreen(c.col, c.row);
      const p = a.pads.get(`${z.player}:${z.spot}:${z.index}`)!;
      expect([p.x, p.y]).toEqual([s.x - 32, s.y - 16]);
      // the line pixel at the zone's top tip carries the player colour
      expect(p.canvas.get(31, 2)).toBe(CALM_T.line[z.player]);
    }
    // the masks hold exactly one diamond: the zone's own pixels (not its neighbours' box corners)
    expect(a.masks.fill.coverage()).toBeGreaterThan(500);
    expect(a.masks.fill.isOpaque(0, 0) || a.masks.fill.isOpaque(63, 31) || a.masks.line.isOpaque(1, 1)).toBe(false);
    expect(a.masks.tile.coverage()).toBeLessThanOrEqual(1024);
    expect(a.masks.fill.isOpaque(32, 16)).toBe(true);
    expect(a.masks.line.coverage()).toBe(a.linePath.length);
    for (const side of [0, 1] as const) {
      const P = a.paths[side];
      expect(P.px.length).toBeGreaterThan(300);
      for (let i = 1; i < P.px.length; i++) expect(Math.max(Math.abs(P.px[i].x - P.px[i - 1].x), Math.abs(P.px[i].y - P.px[i - 1].y))).toBe(1);
      expect(P.podium).toBeGreaterThan(0);
      expect(P.podium).toBeLessThan(P.len);
    }
    // every trim piece is monotonic in x along its path (the ignition reveal crops along x)
    for (const tr of a.trims)
      for (let i = 1; i < tr.px.length; i++) expect((tr.px[i].x - tr.px[i - 1].x) * tr.dirX).toBeGreaterThanOrEqual(0);
  });

  it('stays small (≤ 4 MB of textures) and reports its build time', () => {
    const a = buildCalmArt();
    const bytes = calmTextureBytes(a);
    console.log(`[calm arena] textures ${(bytes / 1048576).toFixed(2)} MB, trims ${a.trims.length}, build ms ${JSON.stringify(a.ms)}`);
    expect(bytes).toBeLessThanOrEqual(4 * 1048576);
  });
});
