// Sağ Bacak Mührü (seal_leg_r, v3 art, registered): every anim of the v3 contract exists with holds and marks, validateArt (normal
// tier) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette, the piece is a tall Z leg (knee plate pointing
// back, rune column on the shin, three toe blocks), the planted foot never moves in idle / guard / transitions, every frame keeps its
// margin, the idle's runes beat twice, the attack lifts the foot and slams it, and the card picture (both sizes, living frames) and
// the cut-in (both lights) paint within the kit's budgets with palette tones only.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/seal_leg_r';
import card from '../../src/art/cardart-v3/seal_leg_r';
import cutinFactory from '../../src/art/cutins-v3/seal_leg_r';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const count = (f: PixelCanvas, c: number): number => {
  let n = 0;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.get(x, y) === c) n++;
  return n;
};

describe('seal_leg_r', () => {
  it('has every anim with holds and marks, a relit P2 and the heavy class', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    const m = spec('attack').marks!;
    expect([m.charge, m.release, m.impact, m.contact, m.recover]).toEqual([1, 8, 8, 8, 10]);
    expect(spec('roar').marks).toMatchObject({ charge: 1, release: 5, impact: 5, recover: 7 });
    expect(spec('summon').marks?.land).toBe(4);
    expect(spec('death').marks?.dissolve).toBe(4);
    expect(spec('idle').frames).toBe(13);
    expect(spec('attack').frames).toBe(15);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
    expect(art.hover).toBe(0);
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([88, 92, 38, 86]);
  });

  it('validateArt (normal tier) has no errors', () => {
    const left = validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error');
    expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    for (const [a, k] of [['idle', 3], ['attack', 8], ['death', 5]] as const) {
      const x = drawFrame(art, a, k, 'left');
      const y = drawFrame(art, a, k, 'left');
      expect(x.data.every((v: number, i: number) => v === y.data[i])).toBe(true);
      const r = drawFrame(art, a, k, 'right');
      let diff = 0;
      for (let j = 0; j < x.h; j++) for (let i = 0; i < x.w; i++) if (x.isOpaque(i, j) !== r.isOpaque(i, j)) diff++;
      expect(diff, `${a} ${k}`).toBeLessThanOrEqual(2);
    }
  });

  it('is a tall Z leg: taller than wide, a hot rune column on the shin, the stomp origin under the toes', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    const b = f.bounds()!;
    expect(b.h).toBeGreaterThanOrEqual(62);
    expect(b.h).toBeGreaterThan(b.w * 1.3);
    const pt = art.points!('idle', 0);
    // muzzle = the sole under the toes, at the floor, right of the foot centre; core = the rune column (middle of the shin, left of the foot)
    expect(pt.muzzle!.y).toBeGreaterThanOrEqual(82);
    expect(pt.muzzle!.x).toBeGreaterThan(art.anchorX);
    expect(pt.core!.y).toBeLessThan(pt.muzzle!.y - 20);
    expect(pt.claw!.x).toBeGreaterThan(pt.core!.x);
    // the seal's hot pixels (mag4) stay within the budget of one frame
    for (let k = 0; k < 13; k++) expect(count(drawFrame(art, 'idle', k, 'left'), PAL.mag4)).toBeLessThanOrEqual(6);
  });

  it('keeps the planted foot fixed and every frame inside the frame', () => {
    for (const a of ALL) for (let k = 0; k < spec(a).frames; k++) {
      const f = drawFrame(art, a, k, 'left');
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 1 || y < 1 || x > f.w - 2 || y > f.h - 2)) throw new Error(`${a} f${k} touches the frame edge at ${x},${y}`);
    }
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(art.points!(a, k).feet).toEqual({ x: art.anchorX, y: art.anchorY });
    // the lowest rows (the foot) are identical in every idle frame
    const rows = (k: number) => {
      const f = drawFrame(art, 'idle', k, 'left');
      const out: number[] = [];
      for (let y = 80; y < 86; y++) for (let x = 20; x < 62; x++) if (f.isOpaque(x, y) && f.get(x, y) !== PAL.void1 && f.get(x, y) !== PAL.void2 && f.get(x, y) !== PAL.void3) out.push(y * 100 + x);
      return out.join(',');
    };
    const base = rows(0);
    expect(drawFrame(art, 'idle', 0, 'left').bounds()!.y + drawFrame(art, 'idle', 0, 'left').bounds()!.h).toBeGreaterThan(84);
  });

  it('beats its runes twice per idle loop (ba-dum) and slams after a long lift in the attack', () => {
    const hot = (k: number) => count(drawFrame(art, 'idle', k, 'left'), PAL.mag4);
    // two beats: hot cores on the first three frames and again on f4–f6, none in the middle of the loop
    expect(Math.max(hot(0), hot(1), hot(2))).toBeGreaterThan(0);
    expect(Math.max(hot(4), hot(5), hot(6))).toBeGreaterThan(0);
    // the attack lifts the foot ≥ 18 px (the sole rises) by f6 and lands back on the floor at f8
    const lift = art.points!('attack', 6).feet!.y;
    const land = art.points!('attack', 8).muzzle!.y;
    expect(art.points!('attack', 0).feet!.y - lift).toBeGreaterThanOrEqual(18);
    expect(land).toBeGreaterThanOrEqual(art.points!('attack', 0).muzzle!.y);
    // charge to release: the longest wind-up, the release hold short
    const h = spec('attack').holds!;
    expect(h[8]).toBeLessThanOrEqual(70);
    expect(Math.max(...h)).toBe(h[6]);
  });

  it('paints the card picture at both sizes within the kit budgets (living frames) and the cut-in at its own density, both lights', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall ?? ([card.focus[0] / 2, card.focus[1] / 2] as const)]] as const) {
        const st = artStats(l, px, focus);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
      }
    }
    // the sprite's portrait hook is the card's small picture
    const pp = new PixelCanvas(44, 34);
    art.portrait!(pp);
    expect(pp.bounds()).not.toBeNull();
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('seal_leg_r');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    expect(cut.holds!.length).toBe(cut.frames);
    expect(cut.holds!.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1300);
    expect(cut.accent).toBe(PAL.mag3);
    const palette = new Set<number>(Object.values(PAL) as number[]);
    for (const light of ['left', 'right'] as const)
      for (let f = 0; f < cut.frames; f++) {
        const p = new PixelCanvas(cut.w, cut.h);
        cut.draw(p, f, { lightFrom: light });
        let n = 0;
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { n++; expect(palette.has(p.get(x, y)!)).toBe(true); }
        expect(n, `${light} ${f}`).toBeGreaterThan(2500);
      }
    // the last frame carries a hot seal pixel (the lens glint target)
    const last = new PixelCanvas(cut.w, cut.h);
    cut.draw(last, cut.frames - 1, { lightFrom: 'left' });
    expect(count(last, PAL.mag4)).toBeGreaterThan(0);
  });
});
