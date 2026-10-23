// A4.1 step 2 — Mercan Yılanı v3 (src/art/monsters-v3/_coral_serpent.ts, NOT registered yet) on the
// single-file 'serpent' type: idle f0 is the approved still on v1's outline, the part maps cover the
// still exactly, P2 is a relight (same silhouette on every frame of every anim), the jet's root is the
// mouth on every frame, the base anims and the part-2 extras carry their marks and hold rules (the
// normal tier of validateArt is clean), the coil base stays planted, a resting serpent is struck in
// whatever idle frame it shows (HA-21 phase: hit, hitHeavy, hitMagic, death) while the idle stays alive
// (HA-18), every one-shot hands back to its rest pose without a pop, the water death melts down to a
// puddle the revive starts from, the summon rises out of a whirl and lights the eye last, and the
// distinction card is filled. The fix round adds: no pose and no relight adds crumbs, the head turns
// (rear, aim, blow), the guard tucks the snout, and the recoils draw the knock themselves.

import { describe, expect, it } from 'vitest';
import art, { CORAL } from '../../src/art/monsters-v3/_coral_serpent';
import v1 from '../../src/art/monsters/coral_serpent';
import { PixelCanvas } from '../../src/art/pixel';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import { SERPENT_KEY, SERPENT_MAP } from '../../src/still/serpent-map';
import { OWNER, stillAt } from '../../src/art/monsters-v3/coral_serpent-maps';
import { BUILD, OX, OY } from '../../src/art/monsters-v3/coral_serpent-build';
import { PAL } from '../../src/art/palette';
import type { AnyMonsterAnim } from '../../src/art/types';
import { litBias } from '../../src/dev/relight-shim';
import { poseTravelPx } from '../../src/cinematics/_v3/blow';

const BASE: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard'];
/** part 2: the §4.9 extras */
const EXTRAS: readonly AnyMonsterAnim[] = ['hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];
const ALL: readonly AnyMonsterAnim[] = [...BASE, ...EXTRAS];
/** the anims a blow lands on (contact at f0) */
const STRUCK: readonly AnyMonsterAnim[] = ['hit', 'hitHeavy', 'hitMagic', 'death'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const specOf = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const lastOf = (a: AnyMonsterAnim, side: 'left' | 'right' = 'left') => drawFrame(art, a, specOf(a).frames - 1, side);
const msOf = (a: AnyMonsterAnim) => specOf(a).holds!.reduce((s, h) => s + h, 0);

/** Bottom opaque row and the x range of the lowest 6 rows (KK-5 HA-9's feet band). */
function feet(p: PixelCanvas): [number, number, number] {
  let bottom = -1;
  for (let y = p.h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) bottom = y;
  let x0 = p.w;
  let x1 = -1;
  for (let y = bottom - 5; y <= bottom; y++)
    for (let x = 0; x < p.w; x++)
      if (p.isOpaque(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  return [bottom, x0, x1];
}

/** Top opaque row. */
function top(p: PixelCanvas): number {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) return y;
  return p.h;
}

/** The eye shows light: any of its px (iris, core, glint — the still's (51…53, 26…27), carried by the head's shift) in a lit tone. */
function eyeLit(a: AnyMonsterAnim, f: number): boolean {
  const p = drawFrame(art, a, f);
  const [sx, sy] = art.rig(a, f).shift;
  const [ex, ey] = BUILD.head.eye;
  for (const [dx, dy] of [[0, 0], [1, 0], [1, -1], [2, 0]]) {
    const c = p.get(ex + sx + dx, ey + sy + dy);
    if (c === PAL.cyan3 || c === PAL.cyan4 || c === PAL.white) return true;
  }
  return false;
}

/** Interior crumbs (IŞ-4): opaque non-ink pixels whose 4 neighbours are all opaque non-ink and none of their colour. */
function crumbs(p: PixelCanvas): number {
  let n = 0;
  const solid = (x: number, y: number) => p.isOpaque(x, y) && p.get(x, y) !== PAL.ink;
  for (let y = 1; y < p.h - 1; y++)
    for (let x = 1; x < p.w - 1; x++) {
      if (!solid(x, y)) continue;
      const c = p.get(x, y);
      let lone = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!solid(x + dx, y + dy) || p.get(x + dx, y + dy) === c) lone = false;
      if (lone) n++;
    }
  return n;
}

describe('coral_serpent v3 (serpent type, A4.1 step 2)', () => {
  it("idle f0 is the approved still on v1's outline (alpha IoU ≥ 0.95, ≥ 95 % of its pixels the still's colour)", () => {
    const a3 = drawFrame(art, 'idle', 0);
    const ref = new PixelCanvas(v1.w, v1.h);
    v1.draw(ref, 'idle', 0);
    const ox = art.anchorX - v1.anchorX;
    const oy = art.anchorY - v1.anchorY;
    let inter = 0;
    let uni = 0;
    let opaque = 0;
    let equal = 0;
    for (let y = -16; y < 96; y++)
      for (let x = -16; x < 96; x++) {
        const a = a3.isOpaque(x + ox, y + oy);
        const b = ref.isOpaque(x, y);
        if (a && b) inter++;
        if (a || b) uni++;
        if (!a) continue;
        opaque++;
        const ch = SERPENT_MAP[y]?.[x];
        if (ch && ch !== '.' && SERPENT_KEY[ch] === a3.get(x + ox, y + oy)) equal++;
      }
    expect(inter / uni).toBeGreaterThanOrEqual(0.95);
    expect(equal / opaque).toBeGreaterThanOrEqual(0.95);
  });

  it('the part maps cover the still exactly: every owned pixel is painted, every painted pixel has an owner', () => {
    expect(OWNER.length).toBe(SERPENT_MAP.length);
    for (let y = 0; y < SERPENT_MAP.length; y++)
      for (let x = 0; x < SERPENT_MAP[y].length; x++) {
        const o = OWNER[y][x];
        const painted = stillAt(x, y) !== null;
        // '.' = empty, 'o' = the outline (redrawn by the outline pass); every other code is a part
        expect(o === '.' ? !painted : painted, `${x},${y} owner '${o}'`).toBe(true);
      }
    // the frame carries the still at (OX, OY): the still's anchor is v1's
    expect([art.anchorX - OX, art.anchorY - OY]).toEqual([v1.anchorX, v1.anchorY]);
  });

  it('P2 is a relight: every frame of every anim keeps the P1 silhouette, and the light reads from the top-left', () => {
    for (const anim of ALL)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const p1 = drawFrame(art, anim, f, 'left');
        const p2 = drawFrame(art, anim, f, 'right');
        let diff = 0;
        for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) if (p1.isOpaque(x, y) !== p2.isOpaque(x, y)) diff++;
        expect(diff, `${anim} f${f}`).toBe(0);
      }
    // relit, not recoloured: P2 steps tones along the still's own ramps (its colours are P1's), and as
    // shown (flipped) it reads lit from the screen's top-left, more so than the plain mirror of P1 (IŞ-1)
    const p1 = drawFrame(art, 'idle', 0, 'left');
    const p2 = drawFrame(art, 'idle', 0, 'right');
    const set = (p: PixelCanvas) => {
      const s = new Set<number>();
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) s.add(p.get(x, y) as number);
      return s;
    };
    const colours = set(p1);
    for (const c of set(p2)) expect(colours.has(c), `P2 colour ${c.toString(16)}`).toBe(true);
    expect(litBias(p1).bias).toBeGreaterThan(0);
    expect(litBias(p2, true).bias).toBeGreaterThan(0);
    expect(litBias(p2, true).bias).toBeGreaterThan(litBias(p1, true).bias);
  });

  it('the jet leaves the mouth: points().muzzle is the open mouth on every frame, and the spout starts there', () => {
    for (const anim of ALL)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const m = art.points!(anim, f)!.muzzle!;
        const r = art.rig(anim, f);
        expect(m, `${anim} f${f}`).toEqual({ x: Math.round(r.mouth[0]), y: Math.round(r.mouth[1]) });
        // between the jaw tips, inside the frame
        expect(Math.hypot(r.mouth[0] - r.upperTip[0], r.mouth[1] - r.upperTip[1])).toBeLessThan(8);
        expect(m.x > 2 && m.x < art.w - 2 && m.y > 2 && m.y < art.h - 2).toBe(true);
      }
    const s = specOf('attack');
    const rel = s.marks!.release;
    const hold = s.marks!.hold;
    for (const f of [rel, hold]) {
      const p = drawFrame(art, 'attack', f);
      const m = art.points!('attack', f)!.muzzle!;
      // the jet's root: water light at the mouth and a run of it ahead of the mouth
      let ahead = 0;
      for (let x = m.x + 1; x <= m.x + 6; x++) if (p.isOpaque(x, m.y)) ahead++;
      expect(p.isOpaque(m.x, m.y), `attack f${f}`).toBe(true);
      expect(ahead, `attack f${f}`).toBe(6);
    }
  });

  it('marks, holds and the normal tier (validateArt): clean, the extras included', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'beam' });
    expect(findings.map((x) => `${x.severity} ${x.rule} ${x.anim}: ${x.message}`)).toEqual([]);
    const a = specOf('attack');
    const m = a.marks!;
    // charge → (long coil-back) → release = impact (≤ 70 ms) → contact (the beam's head at the target) → hold → recover
    expect(m.impact).toBe(m.release);
    expect(m.contact).toBe(m.release + 1);
    expect(m.hold).toBeGreaterThan(m.contact);
    expect(m.recover).toBeGreaterThan(m.hold);
    expect(a.holds![m.release]).toBeLessThanOrEqual(70);
    const longest = Math.max(...a.holds!);
    expect(a.holds!.indexOf(longest)).toBeLessThan(m.release);
    for (const r of ['charge', 'release', 'recover']) expect(specOf('roar').marks![r], `roar ${r}`).toBeDefined();
  });

  it('the coil is planted: the feet band of idle f0 holds in every idle, guard and guard-transition frame; the blows and the victory never slide it', () => {
    const home = feet(drawFrame(art, 'idle', 0));
    for (const anim of ['idle', 'guard', 'toGuard', 'fromGuard', 'hitMagic', 'victory'] as const)
      for (let f = 0; f < specOf(anim).frames; f++) expect(feet(drawFrame(art, anim, f)), `${anim} f${f}`).toEqual(home);
    // the heavy blow squashes the coil (its lowest band spreads ≤ 2 px a side) on the same floor row
    for (let f = 0; f < specOf('hitHeavy').frames; f++) {
      const [bottom, x0, x1] = feet(drawFrame(art, 'hitHeavy', f));
      expect(bottom, `hitHeavy f${f}`).toBe(home[0]);
      expect(Math.abs(x0 - home[1]), `hitHeavy f${f}`).toBeLessThanOrEqual(2);
      expect(Math.abs(x1 - home[2]), `hitHeavy f${f}`).toBeLessThanOrEqual(2);
    }
  });

  it('HA-21 phase: every idle frame stays within 50 % of each struck f0 (hit, hitHeavy, hitMagic, death), and the idle stays alive (HA-18)', () => {
    const n = specOf('idle').frames;
    for (const side of ['left', 'right'] as const) {
      const idle = Array.from({ length: n }, (_, k) => drawFrame(art, 'idle', k, side));
      const op = idle[0].coverage();
      for (const struck of STRUCK) {
        const f0 = drawFrame(art, struck, 0, side);
        for (let k = 0; k < n; k++) expect(frameDelta(idle[k], f0) / op, `${side} idle f${k} → ${struck} f0`).toBeLessThan(0.5);
      }
      const ds = idle.map((p, k) => frameDelta(idle[(k + n - 1) % n], p));
      const mean = ds.reduce((s, d) => s + d, 0) / n;
      expect(mean / op, side).toBeGreaterThanOrEqual(0.15);
      expect(Math.max(...ds) / mean, side).toBeLessThanOrEqual(1.8);
    }
  });

  it('the extras: struck at f0, guard transitions ≤ 0.4 s, every one-shot hands back to its rest pose without a pop, the victory holds', () => {
    for (const a of ['hitHeavy', 'hitMagic', 'death'] as const) {
      const m = specOf(a).marks!;
      expect([m.impact, m.contact], a).toEqual([0, 0]);
    }
    for (const a of ['hitHeavy', 'hitMagic'] as const) expect(specOf(a).marks!.recover, a).toBeGreaterThan(0);
    expect(specOf('death').marks!.dissolve).toBeGreaterThan(0);
    for (const a of ['summon', 'revive'] as const) expect(specOf(a).marks!.land, a).toBeGreaterThan(0);
    for (const a of ['toGuard', 'fromGuard'] as const) expect(msOf(a), a).toBeLessThanOrEqual(400);
    for (const side of ['left', 'right'] as const) {
      const idle0 = drawFrame(art, 'idle', 0, side);
      for (const a of ['attack', 'roar', 'hit', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'revive'] as const)
        expect(frameDelta(lastOf(a, side), idle0), `${side} ${a} → idle f0`).toBe(0);
      expect(frameDelta(lastOf('toGuard', side), drawFrame(art, 'guard', 0, side)), `${side} toGuard → guard f0`).toBe(0);
    }
    // the victory ends on a pose of its own, held longest
    const v = specOf('victory').holds!;
    expect(v[v.length - 1]).toBe(Math.max(...v));
    expect(v[v.length - 1]).toBeGreaterThanOrEqual(300);
    expect(frameDelta(lastOf('victory'), drawFrame(art, 'idle', 0))).toBeGreaterThan(0);
  });

  it('the water death melts down to a puddle (the crown on top), and the revive starts from it', () => {
    const idle0 = drawFrame(art, 'idle', 0);
    const home = feet(idle0);
    const n = specOf('death').frames;
    const d = specOf('death').marks!.dissolve;
    // from the dissolve on the melt line only runs down: the body never gains matter back
    for (let f = d + 1; f < n; f++) expect(drawFrame(art, 'death', f).coverage(), `death f${f}`).toBeLessThanOrEqual(drawFrame(art, 'death', f - 1).coverage());
    const last = lastOf('death');
    expect(last.coverage() / idle0.coverage()).toBeLessThan(0.6);
    expect(top(last)).toBeGreaterThan(top(idle0) + 30);
    // on the same floor row, the puddle spreads past the coil on both sides
    const [bottom, x0, x1] = feet(last);
    expect(bottom).toBe(home[0]);
    expect(x0).toBeLessThan(home[1]);
    expect(x1).toBeGreaterThan(home[2]);
    // the coral crown is stone: it never melts (its tones still stand on the heap)
    let coral = 0;
    for (let y = 0; y < last.h; y++) for (let x = 0; x < last.w; x++) if (last.get(x, y) === PAL.mag4 || last.get(x, y) === PAL.mag3) coral++;
    expect(coral).toBeGreaterThan(10);
    // the revive is the water gathering back from that puddle (not the summon replayed)
    expect(frameDelta(last, drawFrame(art, 'revive', 0))).toBeLessThanOrEqual(16);
    expect(frameDelta(drawFrame(art, 'summon', 0), drawFrame(art, 'revive', 0))).toBeGreaterThan(500);
  });

  it('the summon rises out of a whirl (f0 a few px) and lights the eye last; the revive lights it after its land too', () => {
    expect(drawFrame(art, 'summon', 0).coverage() / drawFrame(art, 'idle', 0).coverage()).toBeLessThan(0.1);
    for (const a of ['summon', 'revive'] as const) {
      const land = specOf(a).marks!.land;
      for (let f = 0; f <= land; f++) expect(eyeLit(a, f), `${a} f${f}`).toBe(false);
      expect(eyeLit(a, specOf(a).frames - 1), a).toBe(true);
    }
    // dead eyes: out from the first frame after the blow (until the melt takes the head: then its foam crest runs there)
    for (let f = 1; f <= specOf('death').marks!.dissolve; f++) expect(eyeLit('death', f), `death f${f}`).toBe(false);
  });

  it('is the serpent type v1 with a pose knock and a filled distinction card', () => {
    expect(art.bodyPlan).toEqual({ id: 'serpent', version: 1 });
    expect(art.knock).toBe('pose');
    for (const v of Object.values(CORAL.distinction)) if (typeof v === 'string') expect(v.length).toBeGreaterThan(40);
  });

  it('fix round: no pose adds crumbs (each frame ≤ 1.3 × the still), the P2 relight adds none either (≤ 1.1 × P1 per anim)', () => {
    const still = crumbs(drawFrame(art, 'idle', 0));
    for (const anim of ALL) {
      const sum = { left: 0, right: 0 };
      for (let f = 0; f < specOf(anim).frames; f++)
        for (const side of ['left', 'right'] as const) {
          const n = crumbs(drawFrame(art, anim, f, side));
          sum[side] += n;
          expect(n, `${side} ${anim} f${f} (still ${still})`).toBeLessThanOrEqual(Math.ceil(1.3 * still));
        }
      expect(sum.right, anim).toBeLessThanOrEqual(Math.ceil(1.1 * sum.left));
    }
  });

  it('fix round: the head turns (roar rears ≥ 30°, the strike aims level ≥ 10° up, the blow throws it back), the guard tucks the snout down and back', () => {
    const deg = (a: AnyMonsterAnim, f: number) => (-art.rig(a, f).turn * 180) / Math.PI;
    const roar = specOf('roar');
    expect(Math.max(...Array.from({ length: roar.frames }, (_, f) => deg('roar', f)))).toBeGreaterThanOrEqual(30);
    expect(deg('attack', specOf('attack').marks!.release)).toBeGreaterThanOrEqual(10);
    expect(deg('hit', 1)).toBeGreaterThanOrEqual(10);
    // the tuck: the snout (the head's frontmost pixel above the coil) ≥ 6 px lower and ≥ 3 px further back than at rest
    const snout = (a: AnyMonsterAnim) => {
      const p = drawFrame(art, a, 0);
      let best: [number, number] = [-1, -1];
      for (let y = 0; y < 62; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) && x > best[0]) best = [x, y];
      return best;
    };
    const [rx, ry] = snout('idle');
    const [gx, gy] = snout('guard');
    expect(gy - ry).toBeGreaterThanOrEqual(6);
    expect(rx - gx).toBeGreaterThanOrEqual(3);
  });

  it('fix round: the recoils draw the knock themselves (hit / hitMagic ≥ 3 px, hitHeavy ≥ 4 px, all ≤ 4 px): the kit never slides the coil for a non-lethal blow', () => {
    for (const [a, min] of [['hit', 3], ['hitMagic', 3], ['hitHeavy', 4]] as const) {
      const t = poseTravelPx(art, a);
      expect(t, a).not.toBeNull();
      expect(t!, a).toBeGreaterThanOrEqual(min);
      expect(t!, a).toBeLessThanOrEqual(4);
    }
  });
});
