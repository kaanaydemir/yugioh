// Kanat Hanımı (wing_lady, v3 art, lane F): every anim exists with its marks and holds, validateArt (normal tier)
// reports no errors, the art is registered, the hover frames keep the head pixel-identical (the kestrel's locked
// head), the death ends in its own "falling cape" ending (flat on the floor, the jewel dark), P2 is a relight of
// the same silhouette, the card art stays in its kit budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/wing_lady';
import card from '../../src/art/cardart-v3/wing_lady';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import { PAL } from '../../src/art/palette';
import type { AnimSpec, AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'special', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
const spec = (a: AnyMonsterAnim): AnimSpec => ((art.anims as Record<string, AnimSpec>)[a] ?? (art.extraAnims as Record<string, AnimSpec>)[a])!;

describe('wing_lady', () => {
  it('has every anim with holds and the marks the cinematics sync to', () => {
    for (const a of ALL) {
      expect(spec(a), a).toBeTruthy();
      expect(spec(a).holds?.length, a).toBe(spec(a).frames);
    }
    expect(spec('attack').marks).toMatchObject({ charge: 1, release: 5, impact: 5, contact: 6, recover: 8 });
    expect(spec('special').marks).toMatchObject({ charge: 1, release: 4, impact: 4, recover: 8 });
    expect(spec('roar').marks).toMatchObject({ charge: 1, release: 3, impact: 3, recover: 5 });
    expect(spec('summon').marks?.land).toBe(7);
    expect(spec('revive').marks?.land).toBe(5);
    // the revive lands by ≈ 450 ms (soul_recall's ghost melts into f0, which lies on the tile)
    expect(spec('revive').holds!.slice(0, 5).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(460);
    expect(spec('death').marks).toMatchObject({ impact: 0, contact: 0, dissolve: 4 });
    expect(art.attackImpactFrame).toBe(spec('attack').marks!.release);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('mediumLight');
    expect(art.hover).toBe(0);
    expect(typeof art.portrait).toBe('function');
  });

  it('validateArt (normal tier, melee) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.frame ?? ''} ${f.message}`)).toEqual([]);
  });

  it('is registered under the v3 look and fits the medium class (≤ 140 frames, ≤ 3.6 MB)', async () => {
    const frames = ALL.reduce((n, a) => n + spec(a).frames, 0);
    expect(frames).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(3_600_000);
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readdirSync(p: string): string[] };
    const src = fs.readdirSync('src/art/monsters-v3');
    expect(src).toContain('wing_lady.ts');
    expect(src).not.toContain('_wing_lady.ts');
    const idx = (fs as unknown as { readFileSync(p: string, e: string): string }).readFileSync('src/art/monsters/index.ts', 'utf8');
    expect(idx).not.toContain('monsters-v3/wing_lady.ts');
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
    for (const a of ALL)
      for (let f = 0; f < spec(a).frames; f++) {
        const p = drawFrame(art, a, f, 'left');
        const cols = new Set<number>();
        for (let y = 0; y < p.h; y++)
          for (let x = 0; x < p.w; x++)
            if (p.isOpaque(x, y)) {
              expect(banned.has(p.get(x, y)!), `${a} ${f} ${x},${y}`).toBe(false);
              cols.add(p.get(x, y)!);
            }
        expect(cols.size, `${a} ${f} colours`).toBeLessThanOrEqual(20);
      }
  });

  it('holds the head still while hovering (attack f2 / f3: only the wings move)', () => {
    const a = art.points!('attack', 2).head!;
    const b = art.points!('attack', 3).head!;
    expect(a).toEqual(b);
    const p = drawFrame(art, 'attack', 2, 'left');
    const q = drawFrame(art, 'attack', 3, 'left');
    // the face block around the jewel (the head map) is pixel-identical
    for (let y = a.y - 2; y <= a.y + 5; y++) for (let x = a.x - 4; x <= a.x + 1; x++) expect(p.get(x, y), `${x},${y}`).toBe(q.get(x, y));
  });

  it('shows ONE lit green jewel at rest, dark in death', () => {
    const count = (anim: AnyMonsterAnim, f: number) => {
      const p = drawFrame(art, anim, f, 'left');
      let n = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === PAL.leaf4) n++;
      return n;
    };
    expect(count('idle', 0)).toBe(1);
    expect(count('death', spec('death').frames - 1)).toBe(0);
  });

  it('dies its own way: the falling cape — flat on the floor under the wings, the head forward', () => {
    const n = spec('death').frames;
    const last = drawFrame(art, 'death', n - 1, 'left');
    const b = last.bounds()!;
    // flat: a low wide body on the floor band
    expect(b.h).toBeLessThanOrEqual(14);
    expect(b.w).toBeGreaterThanOrEqual(34);
    expect(b.y + b.h).toBeGreaterThanOrEqual(art.anchorY);
    // the head lies FORWARD (fell forward, not back) and the wing tones lie over the body
    const head = art.points!('death', n - 1).head!;
    expect(head.x).toBeGreaterThan(art.anchorX + 20);
    let wing = 0;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (last.get(x, y) === PAL.earth3 || last.get(x, y) === PAL.earth4) wing++;
    expect(wing).toBeGreaterThan(40);
    // the cape falls on f2: both wings below the shoulders (no pixel above the head)
    const f2 = drawFrame(art, 'death', 2, 'left');
    const h2 = art.points!('death', 2).head!;
    expect(f2.bounds()!.y).toBeGreaterThanOrEqual(h2.y - 6);
  });

  it('paints the card picture at both sizes within the kit budgets', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall!]] as const) {
        const st = artStats(l, px, focus);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.backdropColors).toBeLessThanOrEqual(6);
        expect(st.subjectFill).toBeGreaterThanOrEqual(0.6);
        expect(st.subjectFill).toBeLessThanOrEqual(0.75);
        expect(st.focusOk).toBe(true);
      }
    }
    expect(card.small).toBeTypeOf('function');
  });
});
