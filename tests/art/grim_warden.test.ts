// Hortlak Muhafız (grim_warden, v3 art, registered): every anim the v3 contract needs exists with holds and marks,
// validateArt (normal tier) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette, the knight is a
// tall wide-shouldered biped with a long diagonal blade (not a quadruped, not a robed caster), the blade's point and the
// feet never move in idle / guard / transitions (HA-9), every frame keeps its margin, the cut-in and both card pictures
// paint within the kit's budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/grim_warden';
import card from '../../src/art/cardart-v3/grim_warden';
import cutinFactory from '../../src/art/cutins-v3/grim_warden';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];
const spec = (a: AnyMonsterAnim) => ((art.anims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a] ?? (art.extraAnims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a]);

describe('grim_warden', () => {
  it('has every anim with holds, marks and the contact mark of the pounce', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks?.release).toBeDefined();
    expect(spec('attack').marks?.contact).toBe(6);
    expect(spec('death').marks?.dissolve).toBeDefined();
    expect(art.p2).toBe('relight');
  });

  it('validateArt (normal tier) has no errors beyond the death continuing the reaction', () => {
    const left = validateArt(art, { tier: 'normal' }).filter((f) => !(f.rule === 'HA-1' && f.anim === 'death'));
    expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 3, 'left');
    const b = drawFrame(art, 'idle', 3, 'left');
    expect(a.data.length === b.data.length && a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 3, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('is a tall, wide-shouldered knight of a large mass with a long diagonal blade', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    let x0 = 999, x1 = -1, y0 = 999, y1 = -1, n = 0;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); n++; }
    expect(x1 - x0 + 1).toBeGreaterThanOrEqual(90);
    expect(y1 - y0 + 1).toBeGreaterThanOrEqual(83);
    expect(n).toBeGreaterThan(4000);
    // the muzzle is the blade's point, far right of the body and on the floor line
    const pt = art.points!('idle', 0);
    expect(pt.muzzle!.x).toBeGreaterThan(105);
    expect(pt.muzzle!.y).toBeGreaterThan(100);
  });

  it('keeps the feet and the blade point planted and every frame inside the frame', () => {
    const lowRows = (a: AnyMonsterAnim, fr: number) => {
      const f = drawFrame(art, a, fr, 'left');
      let x0 = 999, x1 = -1, edge = 0;
      for (let y = art.anchorY - 6; y < art.anchorY; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 1 || y < 1 || x > f.w - 2 || y > f.h - 2)) edge++;
      return { x0, x1, edge };
    };
    const ref = lowRows('idle', 0);
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(lowRows(a, k), `${a} ${k}`).toMatchObject({ x0: ref.x0, x1: ref.x1 });
    for (const a of ALL) for (let k = 0; k < spec(a).frames; k++) expect(lowRows(a, k).edge, `${a} ${k}`).toBe(0);
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
    expect(cut.id).toBe('grim_warden');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    expect(cut.holds!.length).toBe(cut.frames);
    const palette = new Set<number>(Object.values(PAL) as number[]);
    for (const light of ['left', 'right'] as const)
      for (let f = 0; f < cut.frames; f++) {
        const p = new PixelCanvas(cut.w, cut.h);
        cut.draw(p, f, { lightFrom: light });
        let n = 0;
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { n++; expect(palette.has(p.get(x, y)!)).toBe(true); }
        expect(n, `${light} ${f}`).toBeGreaterThan(5000);
      }
  });
});
