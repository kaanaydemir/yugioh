// Sol Bacak Mührü (seal_leg_l, v3 art, registered): every anim of the v3 contract exists with holds and marks, validateArt (normal
// tier) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette, the piece is a LOW wide kneeling sprawl (knee
// plate at the right, thigh up-left, shin along the floor, drag chain and weight block at the far left), the floor contact never
// moves in idle / guard / transitions, every frame keeps its margin, the idle's knee glyph flickers like a failing lamp, the attack
// hauls back and rams the knee plate 20 px along the floor, and the card picture (both sizes, living frames) and the cut-in (both
// lights) paint within the kit's budgets with palette tones only.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/seal_leg_l';
import card from '../../src/art/cardart-v3/seal_leg_l';
import cutinFactory from '../../src/art/cutins-v3/seal_leg_l';
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

describe('seal_leg_l', () => {
  it('has every anim with holds and marks, a relit P2 and the medium class', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    const m = spec('attack').marks!;
    expect([m.charge, m.release, m.impact, m.contact, m.recover]).toEqual([1, 5, 5, 6, 9]);
    expect(spec('roar').marks).toMatchObject({ charge: 1, release: 4, impact: 4, recover: 7 });
    expect(spec('summon').marks?.land).toBe(6);
    expect(spec('death').marks?.dissolve).toBe(5);
    expect([spec('idle').frames, spec('guard').frames, spec('attack').frames, spec('roar').frames]).toEqual([17, 10, 12, 11]);
    expect([spec('hit').frames, spec('hitHeavy').frames, spec('hitMagic').frames]).toEqual([6, 6, 7]);
    expect([spec('summon').frames, spec('death').frames, spec('revive').frames]).toEqual([9, 10, 11]);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('medium');
    expect(art.hover).toBe(0);
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([112, 64, 56, 58]);
  });

  it('validateArt (normal tier) has no errors', () => {
    const left = validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error');
    expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    for (const [a, k] of [['idle', 3], ['attack', 5], ['death', 5]] as const) {
      const x = drawFrame(art, a, k, 'left');
      const y = drawFrame(art, a, k, 'left');
      expect(x.data.every((v: number, i: number) => v === y.data[i])).toBe(true);
      const r = drawFrame(art, a, k, 'right');
      let diff = 0;
      for (let j = 0; j < x.h; j++) for (let i = 0; i < x.w; i++) if (x.isOpaque(i, j) !== r.isOpaque(i, j)) diff++;
      expect(diff, `${a} ${k}`).toBeLessThanOrEqual(2);
    }
  });

  it('is a low wide kneeling sprawl: wider than tall, the knee seal at the right, the grip at the far-left shackle', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    const b = f.bounds()!;
    expect(b.w).toBeGreaterThanOrEqual(62);
    expect(b.h).toBeLessThanOrEqual(46);
    expect(b.w).toBeGreaterThan(b.h * 1.4);
    const pt = art.points!('idle', 0);
    expect(pt.core!.x).toBe(66);
    expect(pt.muzzle!.x).toBeGreaterThan(pt.core!.x + 8);
    expect(pt.grip!.x).toBeLessThan(pt.core!.x - 25);
    expect(pt.head!.y).toBeLessThan(pt.core!.y - 15);
    for (let k = 0; k < 17; k++) expect(count(drawFrame(art, 'idle', k, 'left'), PAL.mag4)).toBeLessThanOrEqual(6);
  });

  it('keeps the floor contact fixed and every frame inside the frame', () => {
    for (const a of ALL) for (let k = 0; k < spec(a).frames; k++) {
      const f = drawFrame(art, a, k, 'left');
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 1 || y < 1 || x > f.w - 2 || y > f.h - 2)) throw new Error(`${a} f${k} touches the frame edge at ${x},${y}`);
    }
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(art.points!(a, k).feet).toEqual({ x: art.anchorX, y: art.anchorY });
    // the lowest body row is the same in every idle / guard frame (the knee, the shin and the chain stay on the floor)
    const low = (a: 'idle' | 'guard', k: number) => {
      const bb = drawFrame(art, a, k, 'left').bounds()!;
      return bb.y + bb.h;
    };
    const base = low('idle', 0);
    for (let k = 0; k < 17; k++) expect(low('idle', k)).toBe(base);
    for (let k = 0; k < 10; k++) expect(low('guard', k)).toBe(base);
  });

  it('flickers its knee glyph like a failing lamp and rams the plate along the floor in the attack', () => {
    const lit = (k: number) => count(drawFrame(art, 'idle', k, 'left'), PAL.mag3);
    // the dip at f6-7, the spark at f11 (the only hot frame), the stutter at f15
    expect(lit(6)).toBeLessThan(lit(0));
    expect(lit(7)).toBeLessThan(lit(0));
    expect(count(drawFrame(art, 'idle', 11, 'left'), PAL.mag4)).toBeGreaterThan(0);
    expect(count(drawFrame(art, 'idle', 0, 'left'), PAL.mag4)).toBe(0);
    expect(lit(15)).toBeLessThan(lit(14));
    // attack: rears on its knee (hip leans back, the plate rises) at f1, rams 20 px forward at the release
    const x = (k: number) => art.points!('attack', k).core!.x;
    expect(art.points!('attack', 1).head!.x).toBeLessThan(art.points!('attack', 0).head!.x);
    expect(art.points!('attack', 1).core!.y).toBeLessThan(art.points!('attack', 0).core!.y);
    expect(x(5) - x(0)).toBeGreaterThanOrEqual(18);
    const h = spec('attack').holds!;
    expect(Math.max(...h.slice(0, 5))).toBe(190);
    expect(h[5]).toBeLessThanOrEqual(80);
    // the roar half-stand: the hip climbs at least 8 px by f3
    expect(art.points!('roar', 0).head!.y - art.points!('roar', 3).head!.y).toBeGreaterThanOrEqual(8);
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
    expect(cut.id).toBe('seal_leg_l');
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
