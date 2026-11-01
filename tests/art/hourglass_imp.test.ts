// Kum Saati Cücesi (hourglass_imp) v3 — a hand-built rig (docs/v3/oturum-f/hourglass_imp.md §2–§6, §0.9 rev. 1): the
// art registers under ?look=v3 (no exclusion left), validateArt (normal tier) is clean, every anim exists with its
// marks, the points sit on every frame, P2 is a relight of the same silhouette, the palette keeps gold3 / gold4 for the
// light and never uses cyan / crim / teal / mag / water, the sand stream marches in idle and FREEZES in hitMagic (then
// drops as a lump), the glass and the feet stay planted in idle / guard / every hit f0, the attack hefts the glass so
// its stopper (the muzzle) points ahead of the body, the death ends on the hourglass LYING low with the imp gone, the
// summon starts as a sand cone with no imp and no glass, and the card picture paints at both sizes within the budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/hourglass_imp';
import indexSrc from '../../src/art/monsters/index.ts?raw';
import card from '../../src/art/cardart-v3/hourglass_imp';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { framePose } from '../../src/art/monsters-v3/hourglass_imp-anims';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const BASE = ['idle', 'guard', 'attack', 'roar', 'hit'] as const;
const EXTRA = ['summon', 'death', 'revive', 'special', 'hitHeavy', 'hitMagic', 'victory', 'toGuard', 'fromGuard'] as const;
const ALL: readonly AnyMonsterAnim[] = [...BASE, ...EXTRA];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const specOf = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const T = 60000;

const opaque = (p: PixelCanvas): number => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};
const count = (p: PixelCanvas, c: number): number => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) && p.get(x, y) === c) n++;
  return n;
};
const PALETTE = new Set<number>(Object.values(PAL));
const FORBIDDEN = new Set<number>(
  (['cyan', 'crim', 'teal', 'mag', 'water'] as const).flatMap((r) => [0, 1, 2, 3, 4].map((i) => (PAL as Record<string, number>)[`${r}${i}`])),
);

describe('hourglass_imp v3', () => {
  it('is registered under v3 (no exclusion left), hand-built, light weight, P2 relight, portrait wired', () => {
    expect(indexSrc).not.toContain("'!../monsters-v3/hourglass_imp.ts'");
    expect(art.id).toBe('hourglass_imp');
    expect(art.bodyPlan).toBeUndefined();
    expect(art.weight).toBe('light');
    expect(art.p2).toBe('relight');
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([60, 64, 24, 60]);
    for (const a of EXTRA) expect(art.extraAnims?.[a], a).toBeDefined();
    const frames = ALL.reduce((n, a) => n + specOf(a).frames, 0);
    expect(frames).toBeLessThanOrEqual(140);
    expect(60 * 64 * 4 * frames).toBeLessThanOrEqual(2.2 * 1024 * 1024);
  });

  it('validateArt (normal tier, projectile attack): no errors', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'projectile' });
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
  }, T);

  it('marks: attack / special / roar charge < release = impact < recover; hits and death on f0; land; dissolve', () => {
    const m = (a: AnyMonsterAnim) => specOf(a).marks ?? {};
    for (const a of ['attack', 'special', 'roar'] as const) {
      expect(m(a).charge, a).toBeLessThan(m(a).release);
      expect(m(a).impact, a).toBe(m(a).release);
      expect(m(a).recover, a).toBeGreaterThan(m(a).release);
    }
    expect(m('attack').contact).toBe(m('attack').release + 1);
    expect(art.attackImpactFrame).toBe(m('attack').release);
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) expect([m(a).impact, m(a).contact], a).toEqual([0, 0]);
    expect(m('death').dissolve).toBeGreaterThan(0);
    expect(m('summon').land).toBeGreaterThan(0);
    expect(m('revive').land).toBeGreaterThan(0);
  });

  it('points on every frame, inside the frame; the attack muzzle (stopper) is ahead of the body at release', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const pt = art.points!(a, f);
        for (const k of ['muzzle', 'core', 'head', 'feet'] as const) {
          const q = pt[k]!;
          expect(q, `${a} f${f} ${k}`).toBeDefined();
          expect(q.x >= 0 && q.x < art.w && q.y >= 0 && q.y < art.h, `${a} f${f} ${k}`).toBe(true);
        }
      }
    const rel = specOf('attack').marks!.release;
    const pt = art.points!('attack', rel);
    expect(pt.muzzle!.x).toBeGreaterThan(pt.core!.x + 15);
    expect(art.points!('idle', 0).muzzle!.y).toBeLessThan(art.points!('idle', 0).core!.y);
  });

  it('palette: PAL only, ≤ 20 body colours (+ the two light tones), no cyan / crim / teal / mag / water; gold3 / gold4 only as light', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const p = drawFrame(art, a, f);
        const cs = new Set<number>();
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) cs.add(p.get(x, y)!);
        for (const c of cs) {
          expect(PALETTE.has(c), `${a} f${f} ${c.toString(16)}`).toBe(true);
          expect(FORBIDDEN.has(c), `${a} f${f} ${c.toString(16)}`).toBe(false);
        }
        cs.delete(PAL.gold3);
        cs.delete(PAL.gold4);
        expect(cs.size, `${a} f${f} body colours`).toBeLessThanOrEqual(20);
      }
    // the stream, the landing grain and the eyes are the only gold3 / gold4 at rest: a handful of pixels
    const idle = drawFrame(art, 'idle', 0);
    expect(count(idle, PAL.gold3) + count(idle, PAL.gold4)).toBeGreaterThan(3);
    expect(count(idle, PAL.gold3) + count(idle, PAL.gold4)).toBeLessThan(20);
  }, T);

  it('P2 is a relight: every frame of every anim keeps the P1 silhouette, and idle f0 really changes its light', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const p1 = drawFrame(art, a, f, 'left');
        const p2 = drawFrame(art, a, f, 'right');
        let diff = 0;
        for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) if (p1.isOpaque(x, y) !== p2.isOpaque(x, y)) diff++;
        expect(diff, `${a} f${f}`).toBe(0);
      }
    expect(frameDelta(drawFrame(art, 'idle', 0, 'left'), drawFrame(art, 'idle', 0, 'right'))).toBeGreaterThan(100);
  }, T);

  it('the sand marches in idle every frame, freezes in hitMagic, then drops as a lump', () => {
    const n = specOf('idle').frames;
    for (let f = 0; f < n; f++) {
      expect(framePose('idle', f).g.flow, `idle f${f}`).toBe(1);
      expect(framePose('idle', f).g.ph).not.toBe(framePose('idle', (f + 1) % n).g.ph);
    }
    const rec = specOf('hitMagic').marks!.recover;
    for (let f = 0; f < rec; f++) expect(framePose('hitMagic', f).g.flow, `hitMagic f${f}`).toBe(2);
    // frozen: the stream pixels do not move between the frozen frames
    const neck = (p: PixelCanvas) => {
      const s: string[] = [];
      for (let y = 40; y < 58; y++) for (let x = 33; x < 41; x++) if (p.get(x, y) === PAL.gold3 || p.get(x, y) === PAL.gold4) s.push(`${x},${y}`);
      return s.join(' ');
    };
    expect(neck(drawFrame(art, 'hitMagic', 1))).toBe(neck(drawFrame(art, 'hitMagic', 3)));
    expect(framePose('hitMagic', rec).g.lump).toBeGreaterThan(0);
  });

  it('the glass and the feet stay planted: the lowest 6 rows never change in idle / guard / toGuard / fromGuard', () => {
    const band = (p: PixelCanvas) => {
      const b = p.bounds()!;
      const bottom = b.y + b.h - 1;
      let x0 = Infinity;
      let x1 = -1;
      for (let y = bottom - 5; y <= bottom; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      return [bottom, x0, x1];
    };
    const ref = band(drawFrame(art, 'idle', 0));
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const)
      for (let f = 0; f < specOf(a).frames; f++) expect(band(drawFrame(art, a, f)), `${a} f${f}`).toEqual(ref);
    // every hit's contact frame keeps the glass where it stands (HA-21: the contact frame is local)
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) {
      const g = framePose(a, 0).g;
      expect([g.a, g.ox, g.oy], a).toEqual([0, 37, 61]);
      expect(frameDelta(drawFrame(art, a, 0), drawFrame(art, 'idle', 0)) / opaque(drawFrame(art, 'idle', 0)), a).toBeLessThan(0.5);
    }
  });

  it('death ends on the hourglass lying low with the imp gone (its own ending); revive starts there', () => {
    const n = specOf('death').frames;
    const last = drawFrame(art, 'death', n - 1);
    const b = last.bounds()!;
    expect(b.y).toBeGreaterThanOrEqual(art.anchorY - 16);
    expect(framePose('death', n - 1).body).toBe(0);
    expect(Math.abs(framePose('death', n - 1).g.a)).toBe(90);
    expect(count(last, PAL.skin2)).toBe(0);
    // dissolve: the body has dried to sand (no skin) and runs into the glass
    const d = drawFrame(art, 'death', specOf('death').marks!.dissolve);
    expect(count(d, PAL.skin2) + count(d, PAL.skin3)).toBe(0);
    expect(frameDelta(drawFrame(art, 'revive', 0), last)).toBe(0);
    expect(frameDelta(drawFrame(art, 'revive', specOf('revive').frames - 1), drawFrame(art, 'idle', 0))).toBe(0);
  });

  it('summon starts as a sand cone (no imp, no glass) and ends on idle f0; the glass is caught on the land frame', () => {
    expect(framePose('summon', 0).body).toBe(0);
    expect(framePose('summon', 0).gShow).toBe(0);
    expect(framePose('summon', 0).cone).toBeGreaterThan(0);
    const land = specOf('summon').marks!.land;
    expect(framePose('summon', land - 1).gShow).toBe(0);
    expect(framePose('summon', land).gShow).toBe(1);
    const s0 = drawFrame(art, 'summon', 0);
    expect(opaque(s0)).toBeLessThan(opaque(drawFrame(art, 'idle', 0)) * 0.3);
    expect(frameDelta(drawFrame(art, 'summon', specOf('summon').frames - 1), drawFrame(art, 'idle', 0))).toBe(0);
  });

  it('is deterministic', () => {
    for (const [a, f] of [['idle', 3], ['attack', 7], ['death', 6], ['summon', 3], ['special', 6]] as const)
      expect(frameDelta(drawFrame(art, a, f), drawFrame(art, a, f))).toBe(0);
  });

  it('paints the card picture at both sizes, every living frame, within the kit budgets; the face shows the small one', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect(r.auto).toBe(false);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall!]] as const) {
        const st = artStats(l, px, focus, true);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.backdropColors).toBeLessThanOrEqual(6);
        expect(st.focusOk).toBe(true);
      }
    }
    const p = new PixelCanvas(44, 34);
    art.portrait!(p);
    expect(frameDelta(p, renderArt(card, 0).smallPx)).toBe(0);
  });
});
