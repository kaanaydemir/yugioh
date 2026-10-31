// Tüy Hayalet / Down Wisp (wisp_imp, R3 redesign) — v3 sprite rig: every anim with marks and holds,
// validateArt (normal tier) clean, palette-only and deterministic, P2 a relight of the same silhouette,
// a floater whose feet never move, every one-shot (but death) home on idle f0, contact frames local,
// the gold of the eyes used only as light, and the small class budget. The card art has its own test
// (tests/art/wisp_imp-cardart.test.ts).
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/wisp_imp';
import { drawFrame, validateArt } from '../../src/art/rigkit/validate';
import { animSpec } from '../../src/art/animtime';
import { PAL } from '../../src/art/palette';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
const PALETTE = new Set<number>(Object.values(PAL) as number[]);
const px = (c: ReturnType<typeof drawFrame>, x: number, y: number) => (c.isOpaque(x, y) ? c.get(x, y) : null);
const delta = (a: ReturnType<typeof drawFrame>, b: ReturnType<typeof drawFrame>) => {
  let n = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (px(a, x, y) !== px(b, x, y)) n++;
  return n;
};
const opaque = (a: ReturnType<typeof drawFrame>) => {
  let n = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y)) n++;
  return n;
};

describe('wisp_imp v3 art (R3 feather ghost)', () => {
  it('has every anim with holds, the mandatory marks, a floater shell and P2 relight', () => {
    for (const a of ALL) {
      const spec = animSpec(art, a)!;
      expect(spec, a).toBeTruthy();
      expect(spec.holds?.length, a).toBe(spec.frames);
    }
    expect(art.anims.attack.marks).toMatchObject({ charge: 1, release: 5, impact: 5, contact: 6, recover: 8 });
    expect(art.attackImpactFrame).toBe(art.anims.attack.marks!.release);
    expect(art.extraAnims!.special!.marks).toMatchObject({ charge: 1, release: 5, impact: 5, recover: 8 });
    expect(art.extraAnims!.death!.marks).toMatchObject({ impact: 0, contact: 0, dissolve: 4 });
    expect(art.extraAnims!.summon!.marks?.land).toBeDefined();
    expect(art.extraAnims!.revive!.marks?.land).toBeDefined();
    expect(art.anims.idle.frames).toBe(20);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('floater');
    expect(art.hover).toBeGreaterThan(0);
    // death stays inside the sprite budget (the 2 s pillow is the cinematic's)
    expect(art.extraAnims!.death!.holds!.reduce((s, v) => s + v, 0)).toBeLessThanOrEqual(900);
  });

  it('passes validateArt (normal tier) without errors', () => {
    const errs = validateArt(art, { tier: 'normal' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim ?? ''} ${f.message ?? ''}`);
    expect(errs).toEqual([]);
  }, 60000);

  it('fits the small class: ≤ 140 frames, sheet bytes ≤ 2.2 MB per side', () => {
    const frames = ALL.reduce((s, a) => s + animSpec(art, a)!.frames, 0);
    expect(frames).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(2.2e6);
  });

  it('is deterministic, palette-only, gold only as the eye light, and P2 keeps the silhouette', () => {
    for (const [a, f] of [['idle', 0], ['idle', 7], ['attack', 5], ['special', 3], ['death', 6], ['summon', 6]] as const) {
      const p = drawFrame(art, a, f, 'left');
      const q = drawFrame(art, a, f, 'left');
      expect(delta(p, q), `${a} ${f}`).toBe(0);
      const r = drawFrame(art, a, f, 'right');
      let sil = 0;
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++) {
          if (p.isOpaque(x, y) !== r.isOpaque(x, y)) sil++;
          const c = px(p, x, y);
          if (c === null) continue;
          expect(PALETTE.has(c), `${a} ${f} ${x},${y}`).toBe(true);
          expect([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4, PAL.teal3, PAL.mag3].includes(c as never), `${a} ${f}`).toBe(false);
        }
      expect(sil, `${a} ${f} P2 silhouette`).toBe(0);
    }
    // idle f0: gold pixels are only the two dot eyes (≤ 8 px), inside the dark hollow
    const i0 = drawFrame(art, 'idle', 0, 'left');
    let gold = 0;
    for (let y = 0; y < i0.h; y++) for (let x = 0; x < i0.w; x++) if (px(i0, x, y) === PAL.gold4 || px(i0, x, y) === PAL.gold3) gold++;
    expect(gold).toBeGreaterThan(0);
    expect(gold).toBeLessThanOrEqual(8);
  });

  it('every one-shot but death ends on idle f0 (toGuard on guard f0); the floor point never moves', () => {
    const i0 = drawFrame(art, 'idle', 0, 'left');
    const g0 = drawFrame(art, 'guard', 0, 'left');
    for (const a of ALL) {
      const spec = animSpec(art, a)!;
      for (let f = 0; f < spec.frames; f++) expect(art.points!(a, f).feet, `${a} ${f}`).toEqual({ x: art.anchorX, y: art.anchorY });
      if (spec.loop || a === 'death') continue;
      const last = drawFrame(art, a, spec.frames - 1, 'left');
      expect(delta(last, a === 'toGuard' ? g0 : i0), a).toBe(0);
    }
  });

  it('contact frames are local in every idle phase (HA-21 < 50 %)', () => {
    const idle = Array.from({ length: art.anims.idle.frames }, (_, k) => drawFrame(art, 'idle', k, 'left'));
    const o = opaque(idle[0]);
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) {
      const c = drawFrame(art, a, 0, 'left');
      for (let k = 0; k < idle.length; k++) expect(delta(c, idle[k]) / o, `${a} vs idle ${k}`).toBeLessThan(0.5);
    }
  });

  it('keeps a 2-px empty margin on every frame', () => {
    for (const a of ALL) {
      const spec = animSpec(art, a)!;
      for (let f = 0; f < spec.frames; f++) {
        const b = drawFrame(art, a, f, 'left').bounds();
        if (!b) continue;
        expect(b.x, `${a} ${f}`).toBeGreaterThanOrEqual(2);
        expect(b.y, `${a} ${f}`).toBeGreaterThanOrEqual(2);
        expect(art.w - (b.x + b.w), `${a} ${f}`).toBeGreaterThanOrEqual(2);
        expect(art.h - (b.y + b.h), `${a} ${f}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
