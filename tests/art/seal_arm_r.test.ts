// Sağ Kol Mührü (seal_arm_r, v3 art, registered): every anim of the v3 contract exists with holds and marks, validateArt (normal
// tier) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette, the piece is a fist on a column rising from a
// crack (nothing sinks through the frame edge), the crack point never moves, the rhythm is its own (three strain cycles, a long
// coil and a one-frame release, a downward-first roar), the stud flares on every strain peak, and the card picture (both sizes, living frames) and the cut-in (both lights) paint
// within the kit's budgets with palette tones only.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/seal_arm_r';
import card from '../../src/art/cardart-v3/seal_arm_r';
import cutinFactory from '../../src/art/cutins-v3/seal_arm_r';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

describe('seal_arm_r', () => {
  it('has every anim with holds and marks, a relit P2 and the heavy class', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    const m = spec('attack').marks!;
    expect([m.charge, m.release, m.impact, m.contact, m.recover]).toEqual([1, 5, 5, 6, 8]);
    expect(spec('roar').marks).toMatchObject({ charge: 1, release: 4, impact: 4, recover: 6 });
    expect(spec('summon').marks?.land).toBe(7);
    expect(spec('death').marks?.dissolve).toBe(5);
    expect(spec('idle').frames).toBe(21);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
    expect(art.hover).toBe(0);
  });

  it('validateArt (normal tier) has no errors', () => {
    const left = validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error');
    expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    for (const [a, k] of [['idle', 3], ['attack', 5], ['death', 7]] as const) {
      const x = drawFrame(art, a, k, 'left');
      const y = drawFrame(art, a, k, 'left');
      expect(x.data.every((v: number, i: number) => v === y.data[i])).toBe(true);
      const r = drawFrame(art, a, k, 'right');
      let diff = 0;
      for (let j = 0; j < x.h; j++) for (let i = 0; i < x.w; i++) if (x.isOpaque(i, j) !== r.isOpaque(i, j)) diff++;
      // the relit twin shares the silhouette except the violet spill pixels of the glyph light
      expect(diff, `${a} ${k}`).toBeLessThanOrEqual(2);
    }
  });

  it('is a fist on a column rising from a crack: tall, narrow, the stud under the fist, the crack at the anchor', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    const hotF = drawFrame(art, 'idle', 3, 'left');
    const b = f.bounds()!;
    expect(b.h).toBeGreaterThanOrEqual(60);
    expect(b.h).toBeGreaterThan(b.w);
    const pt = art.points!('idle', 0);
    // the stud (core) sits under the fist (hand) and over the crack (feet)
    expect(pt.core!.y).toBeGreaterThan(pt.hand!.y);
    expect(pt.core!.y).toBeLessThan(pt.feet!.y - 20);
    // the seal's hot pixel (mag4) is somewhere in the glyph
    let hot = 0;
    for (let y = 0; y < hotF.h; y++) for (let x = 0; x < hotF.w; x++) if (hotF.get(x, y) === PAL.mag4) hot++;
    expect(hot).toBeGreaterThan(0);
    expect(hot).toBeLessThanOrEqual(8);
  });

  it('keeps the crack fixed and every frame inside the frame (nothing sinks through the bottom edge)', () => {
    for (const a of ALL) for (let k = 0; k < spec(a).frames; k++) {
      const f = drawFrame(art, a, k, 'left');
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 1 || y < 1 || x > f.w - 2 || y > f.h - 2)) throw new Error(`${a} f${k} touches the frame edge at ${x},${y}`);
    }
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(art.points!(a, k).feet).toEqual({ x: art.anchorX, y: art.anchorY });
  });

  it('has its own rhythm: three strain cycles of seven frames, a long coil then a one-frame release, a downward-first roar', () => {
    expect(spec('idle').holds!.length).toBe(21);
    const atk = spec('attack');
    // the coil (frames 1-4) is long, the release frame short
    const coil = atk.holds!.slice(1, 5).reduce((a, b) => a + b, 0);
    expect(coil).toBeGreaterThanOrEqual(500);
    expect(atk.holds![5]).toBeLessThanOrEqual(50);
    // the arm sinks first in the attack and in the roar, then surges above its rest height
    const y = (a: AnyMonsterAnim, k: number) => art.points!(a, k).core!.y;
    expect(y('attack', 3)).toBeGreaterThan(y('attack', 0) + 6);
    expect(y('attack', 5)).toBeLessThan(y('attack', 0) - 12);
    expect(y('roar', 3)).toBeGreaterThan(y('roar', 0) + 6);
    expect(y('roar', 5)).toBeLessThan(y('roar', 0) - 6);
  });

  it('flares the seal on the strain peak of every idle cycle and rests between', () => {
    const hotCount = (k: number) => {
      const f = drawFrame(art, 'idle', k, 'left');
      let n = 0;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.get(x, y) === PAL.mag4) n++;
      return n;
    };
    for (const c of [0, 7, 14]) expect(hotCount(c + 3)).toBeGreaterThan(hotCount(c));
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
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('seal_arm_r');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    expect(cut.holds!.length).toBe(cut.frames);
    expect(cut.accent).toBe(PAL.mag3);
    const palette = new Set<number>(Object.values(PAL) as number[]);
    for (const light of ['left', 'right'] as const)
      for (let f = 0; f < cut.frames; f++) {
        const p = new PixelCanvas(cut.w, cut.h);
        cut.draw(p, f, { lightFrom: light });
        let n = 0;
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { n++; expect(palette.has(p.get(x, y)!)).toBe(true); }
        expect(n, `${light} ${f}`).toBeGreaterThan(4000);
      }
  });
});
