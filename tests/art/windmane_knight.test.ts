// Fırtına Şövalyesi (windmane_knight, v3 art, lane F): every anim exists with its marks and holds, validateArt
// (normal tier) reports no errors, the art is registered, the death ends in its own "hollow armour" ending (low pile,
// the helm off, the lance lying flat), P2 is a relight of the same silhouette, the card art and the cut-in stay in
// their kit budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/windmane_knight';
import card from '../../src/art/cardart-v3/windmane_knight';
import cutinFactory from '../../src/art/cutins-v3/windmane_knight';
import { KIT } from '../../src/art/cutins/index';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import type { AnimSpec, AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'special', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
const spec = (a: AnyMonsterAnim): AnimSpec => ((art.anims as Record<string, AnimSpec>)[a] ?? (art.extraAnims as Record<string, AnimSpec>)[a])!;

describe('windmane_knight', () => {
  it('has every anim with holds and the marks the cinematics sync to', () => {
    for (const a of ALL) {
      expect(spec(a), a).toBeTruthy();
      expect(spec(a).holds?.length, a).toBe(spec(a).frames);
    }
    expect(spec('attack').marks).toMatchObject({ charge: 1, release: 5, impact: 5, contact: 6, recover: 8 });
    expect(spec('special').marks).toMatchObject({ charge: 1, release: 11, impact: 11, contact: 12, recover: 14 });
    expect(spec('roar').marks).toMatchObject({ release: 5, impact: 5 });
    expect(spec('summon').marks?.land).toBe(6);
    expect(spec('revive').marks?.land).toBe(7);
    expect(spec('death').marks).toMatchObject({ impact: 0, contact: 0, dissolve: 4 });
    expect(art.attackImpactFrame).toBe(spec('attack').marks!.release);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
    expect(typeof art.portrait).toBe('function');
  });

  it('validateArt (normal tier, melee) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.frame ?? ''} ${f.message}`)).toEqual([]);
  });

  it('is registered under the v3 look and fits its budget (an ace: ≤ 137 frames by its own cap, ≤ 7 MB)', async () => {
    const frames = ALL.reduce((n, a) => n + spec(a).frames, 0);
    expect(frames).toBeLessThanOrEqual(137);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(7_000_000);
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readdirSync(p: string): string[] };
    const src = fs.readdirSync('src/art/monsters-v3');
    expect(src).toContain('windmane_knight.ts');
    expect(src).not.toContain('_windmane_knight.ts');
  });

  it('draws deterministically, P2 keeps the silhouette, every frame keeps 2 px of margin', () => {
    for (const a of ALL)
      for (let f = 0; f < spec(a).frames; f++) {
        const p = drawFrame(art, a, f, 'left');
        const q = drawFrame(art, a, f, 'left');
        expect(p.data.every((v: number, i: number) => v === q.data[i]), `${a} ${f}`).toBe(true);
        const r = drawFrame(art, a, f, 'right');
        let diff = 0;
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
        expect(diff, `${a} ${f} P2 silhouette`).toBe(0);
        const b = p.bounds()!;
        expect(Math.min(b.x, b.y, p.w - b.x - b.w, p.h - b.y - b.h), `${a} ${f} margin`).toBeGreaterThanOrEqual(2);
      }
  });

  it('uses no player / spell / trap colours in the body', () => {
    const banned = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4, PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4]);
    for (const a of ALL) {
      const p = drawFrame(art, a, 0, 'left');
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) expect(banned.has(p.get(x, y)!), `${a} ${x},${y}`).toBe(false);
    }
  });

  it('dies its own way: the hollow armour — a low pile with the lance lying flat and no mane on the crest', () => {
    const n = spec('death').frames;
    const last = drawFrame(art, 'death', n - 1, 'left');
    const b = last.bounds()!;
    expect(b.y).toBeGreaterThanOrEqual(art.anchorY - 34);
    expect(b.w).toBeGreaterThanOrEqual(70);
    const pts = art.points!('death', n - 1);
    // the lance lies flat: its tip on the floor band, far in front of the anchor
    expect(pts.muzzle!.y).toBeGreaterThanOrEqual(art.anchorY - 6);
    expect(pts.muzzle!.x).toBeGreaterThan(art.anchorX + 30);
    // the calm: frame 2 still has the mane up, its pixels frozen from f2 to the snap
    const f2 = drawFrame(art, 'death', 2, 'left');
    let earth = 0;
    for (let y = 0; y < 40; y++) for (let x = 0; x < f2.w; x++) if (f2.get(x, y) === PAL.earth3) earth++;
    expect(earth).toBeGreaterThan(40);
    let earthLast = 0;
    for (let y = 0; y < art.anchorY - 12; y++) for (let x = 0; x < last.w; x++) if (last.get(x, y) === PAL.earth3 || last.get(x, y) === PAL.earth4) earthLast++;
    expect(earthLast).toBe(0);
  });

  it('death shows the empty boots STANDING (open dark tops) when the pennon lands, then they tip over; the revive is its own gust assembly, not a rewind', () => {
    const n = spec('death').frames;
    // round 2 #8: the boots stand on the pennon's frame (f9); the last two frames are the greaves tipping over
    const last = drawFrame(art, 'death', 9, 'left');
    const end = drawFrame(art, 'death', n - 1, 'left');
    let upright = 0;
    for (let x = art.anchorX - 16; x <= art.anchorX + 12; x++)
      for (let y = art.anchorY - 30; y < art.anchorY - 14; y++) if (end.get(x, y) === PAL.night0) { upright++; break; }
    expect(upright).toBeLessThan(2);
    // two upright greaves standing ≥ 18 px tall near the anchor, each with an open night0 top
    let tops = 0;
    for (let x = art.anchorX - 16; x <= art.anchorX + 12; x++)
      for (let y = art.anchorY - 30; y < art.anchorY - 14; y++) if (last.get(x, y) === PAL.night0) { tops++; break; }
    expect(tops).toBeGreaterThanOrEqual(4);
    const deaths = Array.from({ length: n }, (_, f) => drawFrame(art, 'death', f, 'left'));
    for (let f = 0; f < spec('revive').frames - 1; f++) {
      const r = drawFrame(art, 'revive', f, 'left');
      for (const d of deaths) expect(r.data.every((v: number, i: number) => v === d.data[i]), `revive ${f}`).toBe(false);
    }
  });

  it('paints the card picture at both sizes within the kit budgets, and the cut-in at its own density in both lights', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall!]] as const) {
        const st = artStats(l, px, focus);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.focusOk).toBe(true);
      }
    }
    expect(card.small).toBeTypeOf('function');
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('windmane_knight');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    expect(cut.holds!.length).toBe(cut.frames);
    expect(cut.p2).toBe('relight');
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
