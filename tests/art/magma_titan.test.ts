// A4.1 step 2 — Magma Titanı v3 on biped/v1 (src/art/monsters-v3/_magma_titan.ts, NOT registered yet:
// the registry ignores '_' files): idle f0 is the approved still pixel for pixel (and so v1's outline),
// P2 is a relight (same silhouette, other light), the five base anims carry their marks and hold rules
// (validateArt: only the part-2 extras are missing), the lava keeps its one gold4 glint at rest, a
// resting titan is struck in any idle phase within 50 % (HA-21 phase) while the idle stays alive
// (HA-18), the feet change place only in the air, the punch leaves from the far lava fist, and the
// frames are deterministic.

import { describe, expect, it } from 'vitest';
import art, { TITAN } from '../../src/art/monsters-v3/_magma_titan';
import { MARKS } from '../../src/art/monsters-v3/magma_titan-anims';
import v1 from '../../src/art/monsters/magma_titan';
import { hasMonsterArtV3 } from '../../src/art/monsters';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import type { MonsterAnim } from '../../src/art/types';
import { drawTitan } from '../../src/still/titan';

const BASE: readonly MonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit'];
const specOf = (a: MonsterAnim) => art.anims[a];
const count = (p: PixelCanvas, c: number) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) && p.get(x, y) === c) n++;
  return n;
};

describe('magma_titan v3 (biped/v1, A4.1 part 1)', () => {
  it('is not registered yet (step 3 registers it with its recipe)', () => {
    expect(hasMonsterArtV3('magma_titan')).toBe(false);
    expect(art.id).toBe('magma_titan');
  });

  it("idle f0 is the approved still pixel for pixel, on v1's outline", () => {
    const a3 = drawFrame(art, 'idle', 0);
    const still = new PixelCanvas(80, 80);
    drawTitan(still);
    const ref = new PixelCanvas(v1.w, v1.h);
    v1.draw(ref, 'idle', 0);
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([v1.w, v1.h, v1.anchorX, v1.anchorY]);
    let inter = 0;
    let uni = 0;
    let opaque = 0;
    let equal = 0;
    for (let y = 0; y < art.h; y++)
      for (let x = 0; x < art.w; x++) {
        const a = a3.isOpaque(x, y);
        const b = ref.isOpaque(x, y);
        if (a && b) inter++;
        if (a || b) uni++;
        if (a) {
          opaque++;
          if (still.isOpaque(x, y) && still.get(x, y) === a3.get(x, y)) equal++;
        }
      }
    expect(inter / uni).toBe(1);
    expect(equal / opaque).toBe(1);
    expect(opaque).toBe(2575);
  });

  it('P2 is a relight: every frame keeps the P1 silhouette, and idle f0 really changes its light', () => {
    for (const anim of BASE)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const p1 = drawFrame(art, anim, f, 'left');
        const p2 = drawFrame(art, anim, f, 'right');
        let diff = 0;
        for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) if (p1.isOpaque(x, y) !== p2.isOpaque(x, y)) diff++;
        expect(diff, `${anim} f${f}`).toBe(0);
      }
    expect(frameDelta(drawFrame(art, 'idle', 0, 'left'), drawFrame(art, 'idle', 0, 'right'))).toBeGreaterThan(400);
  });

  it('marks, holds and out (validateArt): only the part-2 extras are missing; the attack is stomp → drive → punch', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'melee' });
    expect(findings.filter((x) => x.rule !== '§4.9' || x.severity !== 'error').map((x) => `${x.severity} ${x.rule} ${x.anim}: ${x.message}`)).toEqual([]);
    expect(findings.map((x) => x.anim).sort()).toEqual(['death', 'hitHeavy', 'hitMagic', 'revive', 'summon']);
    const a = art.anims.attack;
    expect(a.marks).toMatchObject({ charge: 0, stomp: 2, drive: 4, release: 6, impact: 6, contact: 6, recover: 8 });
    expect(MARKS.attack).toEqual({ stomp: 2, drive: 4, contact: 6 });
    const rel = a.marks!.release!;
    expect(a.holds![rel]).toBeLessThanOrEqual(70);
    // the drive is the longest hold of the anim (the recipe holds it while the unit travels)
    expect(a.holds![MARKS.attack.drive]).toBe(Math.max(...a.holds!));
    expect(art.anims.roar.marks).toMatchObject({ charge: 0, release: 3, recover: 7 });
    expect(art.anims.hit.marks).toMatchObject({ impact: 0, contact: 0, recover: 3 });
  });

  it('the lava keeps its ONE gold4 glint at rest: idle exactly one, guard and hit never more, no white', () => {
    for (const side of ['left', 'right'] as const) {
      for (let f = 0; f < specOf('idle').frames; f++) {
        const p = drawFrame(art, 'idle', f, side);
        expect(count(p, PAL.gold4), `${side} idle f${f}`).toBe(1);
        expect(count(p, PAL.white), `${side} idle f${f}`).toBe(0);
      }
      for (const anim of ['guard', 'hit'] as const)
        for (let f = 0; f < specOf(anim).frames; f++) {
          const p = drawFrame(art, anim, f, side);
          expect(count(p, PAL.gold4), `${side} ${anim} f${f}`).toBeLessThanOrEqual(1);
          expect(count(p, PAL.white), `${side} ${anim} f${f}`).toBe(0);
        }
      // full heat on the release: the core's white centre and the white-hot fist
      expect(count(drawFrame(art, 'attack', art.anims.attack.marks!.release!, side), PAL.white)).toBeGreaterThan(6);
    }
  });

  it('every idle frame stays within 50 % of the struck f0 (HA-21 phase), and the idle stays alive (HA-18)', () => {
    const n = specOf('idle').frames;
    for (const side of ['left', 'right'] as const) {
      const idle = Array.from({ length: n }, (_, k) => drawFrame(art, 'idle', k, side));
      const op = idle[0].coverage();
      const f0 = drawFrame(art, 'hit', 0, side);
      expect(frameDelta(idle[0], f0) / op).toBeLessThan(0.5);
      for (let k = 0; k < n; k++) expect(frameDelta(idle[k], f0) / op, `${side} idle f${k} → hit f0`).toBeLessThan(0.5);
      const ds = idle.map((p, k) => frameDelta(idle[(k + n - 1) % n], p));
      const mean = ds.reduce((s, d) => s + d, 0) / n;
      expect(mean / op, side).toBeGreaterThanOrEqual(0.15);
      expect(Math.max(...ds) / mean, side).toBeLessThanOrEqual(1.8);
    }
  });

  it('pins biped v1; the feet stay home except the stomp, which moves the far foot only while it is in the air', () => {
    expect(art.bodyPlan).toEqual({ id: 'biped', version: 1 });
    expect(art.knock).toBe('pose');
    const home = [art.rig('idle', 0).footN, art.rig('idle', 0).footF];
    for (const anim of ['idle', 'guard', 'roar', 'hit'] as const)
      for (let f = 0; f < specOf(anim).frames; f++) expect([art.rig(anim, f).footN, art.rig(anim, f).footF], `${anim} f${f}`).toEqual(home);
    const n = specOf('attack').frames;
    let moved = 0;
    for (let f = 0; f < n; f++) expect(art.rig('attack', f).footN, `attack f${f}`).toEqual(home[0]);
    for (let f = 1; f < n; f++) {
      const a = art.pose('attack', f - 1) as unknown as { footF: { step: readonly number[]; lift: number } };
      const b = art.pose('attack', f) as unknown as { footF: { step: readonly number[]; lift: number } };
      if (a.footF.step[0] === b.footF.step[0] && a.footF.step[1] === b.footF.step[1]) continue;
      moved++;
      expect(a.footF.lift > 0 || b.footF.lift > 0, `attack f${f - 1}→f${f}: the far foot slid`).toBe(true);
    }
    expect(moved).toBeGreaterThanOrEqual(2);
    expect(art.rig('attack', n - 1).footF).toEqual(home[1]);
    for (const v of Object.values(TITAN.distinction)) if (typeof v === 'string') expect(v.length).toBeGreaterThan(40);
  });

  it('every point stays in the frame and above the ground; the punch leaves from the far lava fist', () => {
    for (const a of BASE)
      for (let f = 0; f < specOf(a).frames; f++)
        for (const [k, v] of Object.entries(art.points!(a, f))) {
          expect(v!.y, `${a} f${f} ${k}`).toBeLessThanOrEqual(art.anchorY);
          expect(v!.x >= 0 && v!.x < art.w && v!.y >= 0, `${a} f${f} ${k}`).toBe(true);
        }
    const rel = art.anims.attack.marks!.release!;
    const m = art.points!('attack', rel).muzzle!;
    const p = drawFrame(art, 'attack', rel);
    // the muzzle sits on the white-hot knuckles, ahead of the body (P1 faces right)
    expect(m.x).toBeGreaterThan(70);
    let hot = 0;
    for (let y = Math.round(m.y) - 4; y <= Math.round(m.y) + 4; y++) for (let x = Math.round(m.x) - 4; x <= Math.round(m.x) + 1; x++) if (p.get(x, y) === PAL.white) hot++;
    expect(hot).toBeGreaterThan(3);
  });

  it('is deterministic: the same frame twice is the same pixels', () => {
    for (const a of BASE) {
      const f = Math.floor(specOf(a).frames / 2);
      expect(frameDelta(drawFrame(art, a, f), drawFrame(art, a, f)), a).toBe(0);
      expect(frameDelta(drawFrame(art, a, f, 'right'), drawFrame(art, a, f, 'right')), a).toBe(0);
    }
  });
});
