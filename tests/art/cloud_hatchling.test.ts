// Bulut Yavrusu (cloud_hatchling, v3 art — docs/v3/kart-a/cloud_hatchling.md §9.4): the baby and its
// permanent GROWN form. ONE pose table compiled with two hold tables: equal frame counts and marks in both
// arts, the blueprint holds, validateArt (normal tier, projectile attack) clean but for the declared
// growth exceptions, the special's last frame pixel-identical to the grown idle f0 (P1 and P2, both arts:
// the variant hand-off), the grown palette shares, colours per frame, margins and determinism.

import { describe, expect, it } from 'vitest';
import art, { DISTINCTION, HATCH_MOUTH } from '../../src/art/monsters-v3/cloud_hatchling';
import { HATCH_GROWN_VARIANT, cloudHatchlingGrown as grown } from '../../src/art/monsters-v3/cloud_hatchling-grown';
import { BABY_HOLDS, GROWN_HOLDS, framePuffs } from '../../src/art/monsters-v3/cloud_hatchling-anims';
import { PAL } from '../../src/art/palette';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim, MonsterArt } from '../../src/art/types';
import type { PixelCanvas } from '../../src/art/pixel';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'toGuard', 'fromGuard', 'attack', 'roar', 'hit', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special', 'victory'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: MonsterArt, an: AnyMonsterAnim): Spec => (a.anims as Record<string, Spec>)[an] ?? (a.extraAnims as Record<string, Spec>)[an];
const same = (a: PixelCanvas, b: PixelCanvas) => a.data.every((v, i) => v === b.data[i]);
const sum = (h: readonly number[]) => h.reduce((x, y) => x + y, 0);

describe('cloud_hatchling (rev. 3, baby + grown)', () => {
  it('both arts: 14 anims, 139 frames each, identical frame counts and marks, the blueprint holds', () => {
    const frames: Record<string, number> = { idle: 18, guard: 8, toGuard: 5, fromGuard: 5, attack: 14, roar: 10, hit: 6, hitHeavy: 7, hitMagic: 7, summon: 14, death: 13, revive: 11, special: 16, victory: 5 };
    for (const a of [art, grown]) {
      let total = 0;
      for (const an of ALL) {
        const s = spec(a, an);
        expect(s, an).toBeTruthy();
        expect(s.frames, an).toBe(frames[an]);
        total += s.frames;
      }
      expect(total).toBe(139);
    }
    for (const an of ALL) {
      expect(spec(grown, an).marks, an).toEqual(spec(art, an).marks);
      expect(spec(art, an).holds, an).toEqual([...BABY_HOLDS[an]]);
      expect(spec(grown, an).holds, an).toEqual([...GROWN_HOLDS[an]]);
    }
    expect(spec(art, 'attack').marks).toMatchObject({ charge: 1, release: 8, impact: 8, recover: 10 });
    expect(spec(art, 'roar').marks).toMatchObject({ charge: 1, release: 4, recover: 6 });
    expect(spec(art, 'special').marks).toMatchObject({ charge: 1, release: 13, impact: 13, recover: 15 });
    for (const an of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) expect(spec(art, an).marks, an).toMatchObject({ impact: 0, contact: 0 });
    expect(spec(art, 'death').marks?.dissolve).toBe(4);
    expect(spec(art, 'summon').marks?.land).toBe(2);
    expect(spec(art, 'revive').marks?.land).toBe(5);
    expect(sum(spec(art, 'attack').holds!)).toBe(1200);
    expect(sum(spec(grown, 'attack').holds!)).toBe(1470);
    expect(sum(spec(art, 'special').holds!)).toBe(1770);
    expect(sum(spec(grown, 'idle').holds!)).toBe(1990);
    expect(art.weight).toBe('mediumLight');
    expect(grown.weight).toBe('mediumHeavy');
    expect(art.p2).toBe('relight');
    expect(grown.p2).toBe('relight');
    expect([art.w, art.h, art.anchorX, art.anchorY, art.hover]).toEqual([grown.w, grown.h, grown.anchorX, grown.anchorY, grown.hover]);
  });

  it('validateArt (normal, projectile) is clean but for the declared growth exceptions', () => {
    // baby: special ends on the GROWN idle f0 (out by design, §4.10); grown: summon / revive are drawn by the
    // baby shell and end on the baby idle f0, special starts from the baby (the rewind contract, §3.3)
    const ok = (a: MonsterArt, f: { rule: string; anim?: AnyMonsterAnim }) =>
      (a === art && f.rule === 'HA-14' && f.anim === 'special') || (a === grown && f.rule === 'HA-14' && (f.anim === 'summon' || f.anim === 'revive'));
    for (const a of [art, grown]) {
      const left = validateArt(a, { tier: 'normal', attack: 'projectile' }).filter((f) => f.severity === 'error' && !ok(a, f));
      expect(left.map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
    }
  });

  it('special f15 is pixel-identical to the grown idle f0 (P1 and P2, both arts): the hand-off never pops', () => {
    for (const light of ['left', 'right'] as const) {
      const g0 = drawFrame(grown, 'idle', 0, light);
      expect(same(drawFrame(art, 'special', 15, light), g0), light).toBe(true);
      expect(same(drawFrame(grown, 'special', 15, light), g0), light).toBe(true);
      // the delegated anims draw the same pixels in both arts
      for (const an of ['summon', 'revive', 'special'] as const)
        for (let f = 0; f < spec(art, an).frames; f++) expect(same(drawFrame(art, an, f, light), drawFrame(grown, an, f, light)), `${an} f${f}`).toBe(true);
    }
  });

  it('every growth frame f6–f11 is a real in-between (no frame copies its neighbour)', () => {
    for (let f = 6; f <= 12; f++) expect(same(drawFrame(art, 'special', f - 1), drawFrame(art, 'special', f)), `f${f}`).toBe(false);
  });

  it('draws deterministically, keeps a 2-px margin and ≤ 20 colours on every frame, both arts', () => {
    expect(same(drawFrame(grown, 'idle', 5), drawFrame(grown, 'idle', 5))).toBe(true);
    for (const a of [art, grown])
      for (const an of ALL)
        for (let f = 0; f < spec(a, an).frames; f++) {
          const p = drawFrame(a, an, f);
          const b = p.bounds();
          if (!b) continue;
          expect(Math.min(b.x, b.y, p.w - b.x - b.w, p.h - b.y - b.h), `${an} f${f}`).toBeGreaterThanOrEqual(2);
          const cols = new Set<number>();
          for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) cols.add(p.get(x, y)!);
          expect(cols.size, `${an} f${f}`).toBeLessThanOrEqual(20);
        }
  });

  it('the grown idle f0: leaf4 ≥ 40 % of the hide, the cloud tones ≥ 35 % of the opaque pixels; the baby head bigger than its body', () => {
    const p = drawFrame(grown, 'idle', 0);
    let hide = 0;
    let l4 = 0;
    let cloud = 0;
    let all = 0;
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        if (!p.isOpaque(x, y)) continue;
        const c = p.get(x, y)!;
        all++;
        if (c === PAL.leaf1 || c === PAL.leaf2 || c === PAL.leaf3 || c === PAL.leaf4) hide++;
        if (c === PAL.leaf4) l4++;
        if (c === PAL.white || c === PAL.mist || c === PAL.steel) cloud++;
      }
    expect(l4 / hide).toBeGreaterThanOrEqual(0.4);
    expect(cloud / all).toBeGreaterThanOrEqual(0.35);
    const b = drawFrame(art, 'idle', 0).bounds()!;
    const g = p.bounds()!;
    expect(g.w).toBeGreaterThan(b.w);
    expect(g.w).toBeGreaterThan(g.h); // a low, wide dome
  });

  it('no cyan / crim / teal / mag in the body; muzzle on every frame', () => {
    const banned = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4, PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4]);
    for (const a of [art, grown])
      for (const an of ALL)
        for (let f = 0; f < spec(a, an).frames; f++) {
          const p = drawFrame(a, an, f);
          for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) expect(banned.has(p.get(x, y)!), `${an} f${f}`).toBe(false);
          expect(a.points!(an, f).muzzle, `${an} f${f}`).toBeTruthy();
          expect(HATCH_MOUTH(an, f)).toBeTruthy();
        }
  });

  it('the waist ring: 12 puffs on grown frames, none on the baby; it advances 1/36 turn per idle frame and wraps', () => {
    expect(framePuffs('idle', 0, true)).toHaveLength(12);
    expect(framePuffs('idle', 0, false)).toHaveLength(0);
    expect(framePuffs('special', 15, false)).toHaveLength(12);
    expect(framePuffs('special', 10, false)).toHaveLength(0);
    const a = framePuffs('idle', 0, true).map((q) => `${q.x},${q.y}`).sort();
    const b = framePuffs('idle', 3, true).map((q) => `${q.x},${q.y}`).sort();
    expect(b).toEqual(a); // 3 frames = one puff spacing: the same pattern
  });

  it('the grown variant record and the distinction card', () => {
    expect(HATCH_GROWN_VARIANT.name).toBe('grown');
    expect(HATCH_GROWN_VARIANT.art()).toBe(grown);
    expect(HATCH_GROWN_VARIANT.rewind).toEqual([
      { anim: 'special', reverse: true },
      { anim: 'summon', reverse: true },
    ]);
    expect(HATCH_GROWN_VARIANT.when({ uid: 1, cardId: 'cloud_hatchling', position: 'attack', faceUp: true, permAtk: 1200 } as never)).toBe(true);
    expect(HATCH_GROWN_VARIANT.when({ uid: 1, cardId: 'cloud_hatchling', position: 'attack', faceUp: true } as never)).toBe(false);
    for (const k of ['silhouette', 'rhythm', 'idle', 'guard', 'signaturePart', 'material', 'signatureMove'] as const) expect(DISTINCTION[k].length).toBeGreaterThan(20);
  });
});
