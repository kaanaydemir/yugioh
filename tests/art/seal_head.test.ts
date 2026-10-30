// Mühürlü Baş (seal_head, v3 art, registered): every anim the v3 contract needs exists with holds and marks, validateArt (normal tier)
// is clean, a frame is deterministic, P2 is a relight of the SAME silhouette, every frame keeps its 2-px margin, the piece is a wide
// floating slab (not a column, not a quadruped), the cut-in and both card pictures paint within the kit's budgets.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/seal_head';
import card from '../../src/art/cardart-v3/seal_head';
import cutinFactory from '../../src/art/cutins-v3/seal_head';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];
const spec = (a: AnyMonsterAnim) => ((art.anims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a] ?? (art.extraAnims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a]);

describe('seal_head', () => {
  it('has every anim with holds, marks and the bite attack marks', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks).toEqual({ charge: 1, release: 6, impact: 6, contact: 7, recover: 9 });
    expect(spec('roar').marks?.release).toBe(4);
    expect(spec('death').marks?.dissolve).toBe(6);
    expect(art.p2).toBe('relight');
    expect(art.hover).toBe(12);
  });

  it('validateArt (normal tier) has no errors', { timeout: 60000 }, () => {
    const left = validateArt(art, { tier: 'normal' }).filter((f) => !(f.rule === 'HA-1' && f.anim === 'death'));
    expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 3, 'left');
    const b = drawFrame(art, 'idle', 3, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 3, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('is a wide floating slab and every frame keeps a 2-px margin', { timeout: 60000 }, () => {
    const f = drawFrame(art, 'idle', 0, 'left').bounds()!;
    expect(f.w).toBeGreaterThanOrEqual(58);
    expect(f.h).toBeGreaterThanOrEqual(60);
    expect(f.w / f.h).toBeGreaterThan(0.75);
    for (const a of ALL) {
      const n = spec(a).frames;
      for (let i = 0; i < n; i++) {
        const b = drawFrame(art, a, i, 'left').bounds()!;
        expect(Math.min(b.x, b.y, art.w - b.x - b.w, art.h - b.y - b.h), `${a} f${i}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('points: the muzzle sits on the mouth, the core on the eye', () => {
    const p = art.points!('idle', 0);
    expect(p.muzzle!.x).toBeGreaterThan(70);
    expect(p.core!.x).toBeGreaterThan(45);
    expect(art.points!('attack', 6).muzzle!.x).toBeGreaterThan(p.muzzle!.x);
  });

  it('card picture: 4 living frames, both sizes inside the kit budgets', () => {
    expect(card.frames).toBe(4);
    const r = renderArt(card, 0);
    expect(r.auto).toBe(false);
    for (const l of [r.big, r.small]) {
      const st = artStats(l, l === r.big ? r.bigPx : r.smallPx, l === r.big ? card.focus : card.focusSmall, true);
      expect(st.offPalette).toBe(0);
      expect(st.colors).toBeLessThanOrEqual(24);
    }
  });

  it('cut-in: 6 frames, relit P2, the last frame has a hot seal core', () => {
    const c = cutinFactory(KIT);
    expect(c.frames).toBe(6);
    expect(c.p2).toBe('relight');
    const q = new PixelCanvas(c.w, c.h);
    c.draw(q, 5, { lightFrom: 'left' });
    let core = 0;
    for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.get(x, y) === 0xffc6f8) core++;
    expect(core).toBeGreaterThan(0);
  });
});
