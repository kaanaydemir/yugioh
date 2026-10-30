// Sol Kol Mührü (seal_arm_l, v3 art, registered): every anim of the v3 contract exists with holds and marks, validateArt (normal
// tier) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette, the piece is an open hand on a diagonal arm
// (wide, with five fingers), the anchor floor point and the idle float never move, every frame keeps its margin, the idle's
// travelling light reaches the fingertips, and the card picture (both sizes, living frames) and the cut-in (both lights) paint
// within the kit's budgets with palette tones only.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/seal_arm_l';
import card from '../../src/art/cardart-v3/seal_arm_l';
import cutinFactory from '../../src/art/cutins-v3/seal_arm_l';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

describe('seal_arm_l', () => {
  it('has every anim with holds and marks, a relit P2 and the floater class', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    const m = spec('attack').marks!;
    expect([m.charge, m.release, m.impact, m.contact, m.recover]).toEqual([1, 5, 5, 6, 8]);
    expect(spec('roar').marks).toMatchObject({ charge: 1, release: 4, impact: 4, recover: 7 });
    expect(spec('summon').marks?.land).toBe(7);
    expect(spec('death').marks?.dissolve).toBe(5);
    expect(spec('idle').frames).toBe(15);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('floater');
    expect(art.hover).toBe(5);
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

  it('is an open hand on a diagonal arm: wide, five fingertips, the palm disc at the muzzle', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    const b = f.bounds()!;
    expect(b.w).toBeGreaterThanOrEqual(52);
    expect(b.h).toBeGreaterThanOrEqual(38);
    const pt = art.points!('idle', 0);
    expect(pt.muzzle!.x).toBeGreaterThan(b.x + b.w * 0.45);
    expect(pt.muzzle!.y).toBeLessThan(b.y + b.h * 0.75);
    expect(pt.claw!.x).toBeGreaterThan(pt.muzzle!.x);
    // the seal's hot pixel (mag4) is somewhere in the glyph
    let hot = 0;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.get(x, y) === PAL.mag4) hot++;
    expect(hot).toBeGreaterThan(0);
    expect(hot).toBeLessThanOrEqual(6);
  });

  it('keeps the floor point fixed and every frame inside the frame', () => {
    for (const a of ALL) for (let k = 0; k < spec(a).frames; k++) {
      const f = drawFrame(art, a, k, 'left');
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 1 || y < 1 || x > f.w - 2 || y > f.h - 2)) throw new Error(`${a} f${k} touches the frame edge at ${x},${y}`);
    }
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(art.points!(a, k).feet).toEqual({ x: art.anchorX, y: art.anchorY });
  });

  it('runs the seal light from the palm to the fingertips once per idle loop', () => {
    const hotCount = (k: number) => {
      const f = drawFrame(art, 'idle', k, 'left');
      let n = 0;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.get(x, y) === PAL.mag4) n++;
      return n;
    };
    // a hot pixel outside the disc (a fingertip) shows up in the middle of the loop, none at the start
    const early = hotCount(0);
    const mid = Math.max(...[5, 6, 7, 8, 9].map(hotCount));
    expect(mid).toBeGreaterThan(early);
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
        expect(st.colors).toBeLessThanOrEqual(24);
      }
    }
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('seal_arm_l');
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
