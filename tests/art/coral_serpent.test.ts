// A4.1 step 2 — Mercan Yılanı v3 (src/art/monsters-v3/_coral_serpent.ts, NOT registered yet) on the
// single-file 'serpent' type: idle f0 is the approved still on v1's outline, the part maps cover the
// still exactly, P2 is a relight (same silhouette, every frame), the jet's root is the mouth on every
// frame, the five base anims (+ the drafted guard transitions) carry their marks and hold rules, the coil
// base stays planted, a resting serpent is struck in whatever idle frame it shows (HA-21 phase) while the
// idle stays alive (HA-18), and the distinction card is filled.

import { describe, expect, it } from 'vitest';
import art, { CORAL } from '../../src/art/monsters-v3/_coral_serpent';
import v1 from '../../src/art/monsters/coral_serpent';
import { PixelCanvas } from '../../src/art/pixel';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import { SERPENT_KEY, SERPENT_MAP } from '../../src/still/serpent-map';
import { OWNER, stillAt } from '../../src/art/monsters-v3/coral_serpent-maps';
import { OX, OY } from '../../src/art/monsters-v3/coral_serpent-build';
import type { AnyMonsterAnim } from '../../src/art/types';
import { litBias } from '../../src/dev/relight-shim';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const specOf = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
/** The §4.9 extras part 2 draws (death / revive / summon / hitHeavy / hitMagic): known gaps of part 1. */
const PART2 = new Set(['hitHeavy', 'hitMagic', 'summon', 'death', 'revive']);

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

  it('marks, holds and the normal tier (validateArt): clean but for the part-2 extras', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'beam' }).filter((x) => !(x.rule === '§4.9' && x.anim && PART2.has(x.anim)));
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

  it('the coil is planted: the feet band of idle f0 holds in every idle, guard and guard-transition frame', () => {
    const home = feet(drawFrame(art, 'idle', 0));
    for (const anim of ['idle', 'guard', 'toGuard', 'fromGuard'] as const)
      for (let f = 0; f < specOf(anim).frames; f++) expect(feet(drawFrame(art, anim, f)), `${anim} f${f}`).toEqual(home);
  });

  it('HA-21 phase: every idle frame stays within 50 % of the struck f0, and the idle stays alive (HA-18)', () => {
    const n = specOf('idle').frames;
    for (const side of ['left', 'right'] as const) {
      const idle = Array.from({ length: n }, (_, k) => drawFrame(art, 'idle', k, side));
      const op = idle[0].coverage();
      const f0 = drawFrame(art, 'hit', 0, side);
      for (let k = 0; k < n; k++) expect(frameDelta(idle[k], f0) / op, `${side} idle f${k} → hit f0`).toBeLessThan(0.5);
      const ds = idle.map((p, k) => frameDelta(idle[(k + n - 1) % n], p));
      const mean = ds.reduce((s, d) => s + d, 0) / n;
      expect(mean / op, side).toBeGreaterThanOrEqual(0.15);
      expect(Math.max(...ds) / mean, side).toBeLessThanOrEqual(1.8);
    }
  });

  it('is the serpent type v1 with a pose knock and a filled distinction card', () => {
    expect(art.bodyPlan).toEqual({ id: 'serpent', version: 1 });
    expect(art.knock).toBe('pose');
    for (const v of Object.values(CORAL.distinction)) if (typeof v === 'string') expect(v.length).toBeGreaterThan(40);
  });
});
