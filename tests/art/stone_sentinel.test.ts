// A3 Y8 — the pilot Taş Muhafız v3 on biped/v1 (src/art/monsters-v3/_stone_sentinel.ts, still
// unregistered): idle f0 is the approved still on v1's outline, P2 is a relight (same silhouette),
// the throw leaves from the rock, every anim (the five base ones and, part 2, the eight extras)
// carries its marks and hold rules, the feet stay planted except for hitHeavy's lifted step, the
// stone death crumbles low and the revive is its own anim; the crumble / reassemble passes (rigkit)
// are pure and mirror each other.

import { describe, expect, it } from 'vitest';
import art, { SENTINEL } from '../../src/art/monsters-v3/_stone_sentinel';
import v1 from '../../src/art/monsters/stone_sentinel';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import { PartComp } from '../../src/art/rigkit/composite';
import { lightOf } from '../../src/art/rigkit/light';
import { CRUMBLE_STONE, crumblePass, drawDebris, reassemblePass } from '../../src/art/rigkit/passes';
import type { AnyMonsterAnim } from '../../src/art/types';
import { drawSentinel } from '../../src/still/sentinel';

const BASE = ['idle', 'guard', 'attack', 'roar', 'hit'] as const;
const EXTRA = ['summon', 'death', 'revive', 'hitHeavy', 'hitMagic', 'toGuard', 'fromGuard', 'victory'] as const;
const ALL: readonly AnyMonsterAnim[] = [...BASE, ...EXTRA];
const specOf = (a: AnyMonsterAnim) => (art.anims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a] ?? art.extraAnims![a as (typeof EXTRA)[number]]!;

describe('stone_sentinel v3 (biped/v1 pilot)', () => {
  it('idle f0 is the approved still on v1\'s outline', () => {
    const a3 = drawFrame(art, 'idle', 0);
    const ref = new PixelCanvas(v1.w, v1.h);
    v1.draw(ref, 'idle', 0);
    const still = new PixelCanvas(64, 64);
    drawSentinel(still);
    const ox = art.anchorX - v1.anchorX;
    const oy = art.anchorY - v1.anchorY;
    let inter = 0;
    let uni = 0;
    let opaque = 0;
    let equal = 0;
    for (let y = -16; y < 80; y++)
      for (let x = -16; x < 80; x++) {
        const a = a3.isOpaque(x + ox, y + oy);
        const b = ref.isOpaque(x, y);
        if (a && b) inter++;
        if (a || b) uni++;
        if (a) {
          opaque++;
          if (still.isOpaque(x, y) && still.get(x, y) === a3.get(x + ox, y + oy)) equal++;
        }
      }
    expect(inter / uni).toBeGreaterThanOrEqual(0.95);
    expect(equal / opaque).toBeGreaterThanOrEqual(0.9);
  });

  it('P2 is a relight: every frame of every anim keeps the P1 silhouette', () => {
    for (const anim of ALL)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const p1 = drawFrame(art, anim, f, 'left');
        const p2 = drawFrame(art, anim, f, 'right');
        let diff = 0;
        let rock = 0;
        const r = art.rig(anim, f).props.rock;
        for (let y = 0; y < art.h; y++)
          for (let x = 0; x < art.w; x++) {
            if (p1.isOpaque(x, y) === p2.isOpaque(x, y)) continue;
            // the boulder is mirrored for P2 (a rock has no handedness): its box (13 × 11, a 2-px smear
            // on the release, the outline) may differ
            if (r && r.show > 0 && Math.abs(x - Math.round(r.at[0])) <= 9 && Math.abs(y - Math.round(r.at[1])) <= 9) rock++;
            else diff++;
          }
        expect(diff, `${anim} f${f}`).toBe(0);
        expect(rock).toBeLessThan(40);
      }
  });

  it('the throw leaves from the rock: muzzle on the boulder until the release, beside the open hand there', () => {
    const s = art.anims.attack;
    const release = s.marks!.release!;
    let shown = 0;
    for (let f = 0; f <= release; f++) {
      const r = art.rig('attack', f).props.rock;
      if (!r || r.show <= 0) continue;
      shown++;
      const m = art.points!('attack', f)!.muzzle!;
      // on the rock (in the floor: on its top above the hole's lip)
      expect(m.x).toBe(Math.round(r.at[0]));
      expect(r.hand === null ? m.y <= Math.round(r.at[1]) : m.y === Math.round(r.at[1])).toBe(true);
    }
    expect(shown).toBeGreaterThanOrEqual(8);
    const hand = art.joints('attack', release).handN;
    const m = art.points!('attack', release)!.muzzle!;
    expect(Math.hypot(m.x - hand.x, m.y - hand.y)).toBeLessThanOrEqual(13);
    for (let f = release + 1; f < s.frames; f++) expect(art.rig('attack', f).props.rock?.show ?? 0, `attack f${f}`).toBe(0);
  });

  it('marks, holds, out and the normal tier (validateArt): clean for every anim', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'projectile' });
    expect(findings.map((x) => `${x.severity} ${x.rule} ${x.anim}: ${x.message}`)).toEqual([]);
    const a = art.anims.attack;
    expect(a.marks!.charge).toBe(0);
    expect(a.holds![a.marks!.release!]).toBeLessThanOrEqual(70);
    const longest = Math.max(...a.holds!);
    expect(a.holds!.indexOf(longest)).toBe(a.marks!.release! - 2); // the overhead hold, then the whip, then the release
  });

  it('pins biped v1, keeps the feet planted and fills its distinction card', () => {
    expect(art.bodyPlan).toEqual({ id: 'biped', version: 1 });
    expect(art.knock).toBe('pose');
    expect(art.passes).toEqual({ death: 'crumble', revive: 'reassemble' });
    const home = [art.rig('idle', 0).footN, art.rig('idle', 0).footF];
    for (const anim of ALL) {
      if (anim === 'hitHeavy') continue;
      for (let f = 0; f < specOf(anim).frames; f++) expect([art.rig(anim, f).footN, art.rig(anim, f).footF], `${anim} f${f}`).toEqual(home);
    }
    // hitHeavy steps back and home: a foot only changes its place while it is in the air (HA-9)
    const n = specOf('hitHeavy').frames;
    let moved = 0;
    for (let f = 1; f < n; f++) {
      const a = art.pose('hitHeavy', f - 1) as unknown as { footN: { step: readonly number[]; lift: number } };
      const b = art.pose('hitHeavy', f) as unknown as { footN: { step: readonly number[]; lift: number } };
      if (a.footN.step[0] === b.footN.step[0] && a.footN.step[1] === b.footN.step[1]) continue;
      moved++;
      expect(a.footN.lift > 0 || b.footN.lift > 0, `hitHeavy f${f - 1}→f${f}: the foot slid`).toBe(true);
    }
    expect(moved).toBeGreaterThanOrEqual(2);
    expect(art.rig('hitHeavy', n - 1).footN).toEqual(home[0]);
    for (const v of Object.values(SENTINEL.distinction)) if (typeof v === 'string') expect(v.length).toBeGreaterThan(40);
  });
});

describe('stone_sentinel v3 extras (part 2)', () => {
  const box = (p: PixelCanvas) => p.bounds()!;
  const opaque = (p: PixelCanvas) => p.coverage();

  it('the death crumbles low, from the heavy struck pose, and its edges really break away', () => {
    expect(drawFrame(art, 'death', 0).data).toEqual(drawFrame(art, 'hitHeavy', 0).data); // HA-24: a lethal hitHeavy hands over without a jump
    const s = specOf('death');
    expect(s.marks).toMatchObject({ impact: 0, contact: 0 });
    const last = drawFrame(art, 'death', s.frames - 1);
    const idle = drawFrame(art, 'idle', 0);
    expect(box(last).h).toBeLessThanOrEqual(Math.round(box(idle).h * 0.7)); // REHBER HA-27: the last frame low and collapsed
    expect(opaque(last)).toBeLessThan(opaque(idle) * 0.8);
    // the crumble shed chunks: debris lies on the floor around the heap (nothing under the ground line)
    for (let y = art.anchorY + 2; y < art.h; y++) for (let x = 0; x < art.w; x++) expect(last.isOpaque(x, y), `death f${s.frames - 1} (${x}, ${y})`).toBe(false);
  });

  it('the revive is not the summon: it starts from the heap and lands earlier than the summon', () => {
    const rv = drawFrame(art, 'revive', 0);
    const dl = drawFrame(art, 'death', specOf('death').frames - 1);
    expect(Math.abs(box(rv).h - box(dl).h)).toBeLessThanOrEqual(3);
    const sm = drawFrame(art, 'summon', 0);
    expect(opaque(sm)).toBeLessThan(400); // the summon starts from the floor breaking open
    const landMs = (a: AnyMonsterAnim) => (specOf(a).holds ?? []).slice(0, specOf(a).marks!.land).reduce((x, y) => x + y, 0);
    expect(landMs('revive')).toBeLessThanOrEqual(420); // soul_recall cuts its glide for a land after 330 ms (≤ 2.1 s)
    expect(landMs('summon')).toBeLessThanOrEqual(520);
  });

  it('guard transitions end on their poses within 0.4 s and keep the shield on its footing', () => {
    for (const a of ['toGuard', 'fromGuard'] as const) {
      const s = specOf(a);
      expect(s.frames).toBeGreaterThanOrEqual(5);
      expect((s.holds ?? []).reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(400);
    }
    expect(drawFrame(art, 'toGuard', specOf('toGuard').frames - 1).data).toEqual(drawFrame(art, 'guard', 0).data);
    expect(drawFrame(art, 'fromGuard', specOf('fromGuard').frames - 1).data).toEqual(drawFrame(art, 'idle', 0).data);
  });

  it('every point stays inside the frame and at or above the ground line (the summon comes up out of the floor)', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++)
        for (const [k, v] of Object.entries(art.points!(a, f))) {
          expect(v!.y, `${a} f${f} ${k}`).toBeLessThanOrEqual(art.anchorY);
          expect(v!.x >= 0 && v!.x < art.w && v!.y >= 0, `${a} f${f} ${k}`).toBe(true);
        }
  });
});

describe('rigkit crumble / reassemble passes', () => {
  // a 2-part test slab: a wall of stone3 (part 1) with a stone2 block (part 2) in front of it
  const W = 40;
  const H = 40;
  const make = () => {
    const p = new PixelCanvas(W, H);
    const id = new Uint8Array(W * H);
    for (let y = 8; y < 30; y++)
      for (let x = 8; x < 30; x++) {
        const front = x >= 14 && x < 24 && y >= 14 && y < 24;
        p.set(x, y, front ? PAL.stone2 : PAL.stone3);
        id[y * W + x] = front ? 2 : 1;
      }
    return new PartComp(p, id);
  };
  const base = { restOf: (_part: number, x: number, y: number) => [x, y] as const, light: lightOf('left'), style: CRUMBLE_STONE, floorY: 34, centreX: 19, origin: [19, 19] as const, joint: () => true };

  it('t = 0 changes nothing; the same progress gives the same frame', () => {
    const a = make();
    const before = a.p.clone();
    expect(crumblePass(a, { ...base, t: 0 }).chunks).toEqual([]);
    expect(a.p.data).toEqual(before.data);
    const b = make();
    const c = make();
    crumblePass(b, { ...base, t: 0.7 });
    crumblePass(c, { ...base, t: 0.7 });
    expect(b.p.data).toEqual(c.p.data);
  });

  it('cracks are grooves of the stone ramp; the joint opens on the part behind; chunks fall onto the floor, never under it', () => {
    const f = make();
    const d = crumblePass(f, { ...base, t: 1 });
    const tones = new Set<number>();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f.p.isOpaque(x, y)) tones.add(f.p.get(x, y)!);
    for (const t of tones) expect([PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3]).toContain(t);
    expect(f.p.get(13, 18)).toBe(PAL.stone1); // the wall's pixel against the block in front of it: the joint, two steps down
    expect(d.chunks.length).toBeGreaterThan(0);
    const out = new PixelCanvas(W, H);
    drawDebris(out, d, { floorY: 34 });
    for (let y = 35; y < H; y++) for (let x = 0; x < W; x++) expect(out.isOpaque(x, y)).toBe(false);
  });

  it('reassemble at t is the crumble at 1 − t (with light in the closing cracks), and whole at 1', () => {
    const a = make();
    const b = make();
    reassemblePass(a, { ...base, t: 0.4, glow: 0 });
    crumblePass(b, { ...base, t: 0.6 });
    expect(a.p.data).toEqual(b.p.data);
    const w = make();
    const before = w.p.clone();
    expect(reassemblePass(w, { ...base, t: 1 }).chunks).toEqual([]);
    expect(w.p.data).toEqual(before.data);
    const g = make();
    reassemblePass(g, { ...base, t: 0.2 });
    let gold = 0;
    const golds = new Set<number>([PAL.gold1, PAL.gold2, PAL.gold3]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (golds.has(g.p.get(x, y) as number)) gold++;
    expect(gold).toBeGreaterThan(0);
  });
});
