// Kaya Baltacı — the presentation contract of the card (src/cinematics/kartc/crag_axeman*.ts, src/audio/v3/crag_axeman.ts,
// src/duel/scenarios/crag_axeman.ts): no recipe (strike / summon / death are its own files; the table rows hold the light and the death
// preset); its voice resolves to the hand-made set and every role names a registered sound; the card's sounds are its own
// (cax prefix, none of the lane-wide banned shared recipes); the scenario keys exist; the Yarık seam line is a clean
// whole-pixel line.

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { SFX_NAMES } from '../../src/audio/sfx';
import { AXEMAN_VOICE, V3_AXEMAN_RECIPES } from '../../src/audio/v3/crag_axeman';
import { CHARACTER_SOUNDS } from '../../src/cinematics/_v3/sound';
import { presentationOf } from '../../src/presentation/registry';
import { DEATH_PRESETS } from '../../src/cinematics/_v3/presets';
import { MONSTER_GLOW } from '../../src/view/light/profiles';
import { PAL } from '../../src/art/palette';
import scenarios from '../../src/duel/scenarios/crag_axeman';
import { linePts } from '../../src/cinematics/kartc/crag_axeman-yarik';
import { BLADE_FRONT, cutPlan } from '../../src/cinematics/kartc/crag_axeman';

describe('crag_axeman presentation', () => {
  it('has no recipe (its strike, summon and death are its own files; the shared table rows carry the rest)', () => {
    expect(presentationOf('crag_axeman')).toBeFalsy();
    // §5.2: never a stone end
    expect(DEATH_PRESETS.crag_axeman.material).not.toBe('stone');
    expect(MONSTER_GLOW.crag_axeman.emissive.map(([c]) => c)).toEqual([PAL.white]);
  });

  it('speaks with its own voice: every role is a registered cax sound', () => {
    expect(CHARACTER_SOUNDS.crag_axeman).toBe(AXEMAN_VOICE);
    const names = new Set<string>(SFX_NAMES);
    // a role is a sound name, or (struck) an object of sound names: check every leaf
    const leaves = (role: string, v: unknown): [string, string][] =>
      v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => leaves(`${role}.${k}`, x)) : [[role, String(v)]];
    for (const [role, name] of Object.entries(AXEMAN_VOICE).flatMap(([r, v]) => leaves(r, v))) {
      expect(names.has(name), role).toBe(true);
      expect(name.startsWith('cax'), role).toBe(true);
    }
    for (const k of Object.keys(V3_AXEMAN_RECIPES)) {
      expect(names.has(k), k).toBe(true);
      expect(k.startsWith('cax'), k).toBe(true);
    }
  });

  it('covers the scenarios of the lane brief', () => {
    for (const k of ['caxSummon', 'caxSummonP2', 'caxAttack', 'caxAttackP2', 'caxDirect', 'caxHit', 'caxKill', 'caxKillP2', 'caxGuard', 'caxBlocked', 'caxLoser'])
      expect(scenarios[k], k).toBeTruthy();
    for (const s of Object.values(scenarios)) expect(s.stage?.zones).toBe(5);
  });

  it('draws the seam as one clean whole-pixel line (a 2:1 iso run steps 2 across per 1 down)', () => {
    const pts = linePts({ x: 10, y: 20 }, { x: 30, y: 10 });
    expect(pts[0]).toEqual({ x: 10, y: 20 });
    expect(pts[pts.length - 1]).toEqual({ x: 30, y: 10 });
    expect(pts.length).toBe(21);
    for (let i = 1; i < pts.length; i++) {
      expect(Math.abs(pts[i].x - pts[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(pts[i].y - pts[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });

  it('the run-up travels: the facing pair (P1 z2 → P2 z2) gives ≥ 20 px over the three steps, long-then-shorter', () => {
    // measured in game: home (288,176), aim (352,144), the target's footprint front 329, the contact frame's reach 23
    const home = { x: 288, y: 176 };
    const aim = { x: 352, y: 144 };
    const plan = cutPlan(home, aim, 329, 1, 23);
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(d(plan.steps[0], plan.steps[3])).toBeGreaterThanOrEqual(20);
    // he still closes in: he plants ahead of home, and the whole run-up (back-step to plant) is a real charge
    expect(d(plan.start, plan.land)).toBeGreaterThanOrEqual(20);
    const legs = [d(plan.steps[0], plan.steps[1]), d(plan.steps[1], plan.steps[2]), d(plan.steps[2], plan.steps[3])];
    expect(legs[0]).toBeGreaterThan(legs[1]);
    expect(legs[1]).toBeGreaterThan(legs[2]);
    // the bite sits a visible stride (10–14 px) in front of the footprint, so the seam is seen RUNNING on the floor;
    // blocked, further short (the seam then runs to the guard and forks)
    // (measured from the buried blade's front horn, BLADE_FRONT px ahead of the edge point)
    expect(329 - plan.bite.x - BLADE_FRONT).toBeGreaterThanOrEqual(10);
    expect(329 - plan.bite.x - BLADE_FRONT).toBeLessThanOrEqual(14);
    expect(329 - cutPlan(home, aim, 329, 1, 23, { blocked: true }).bite.x).toBeGreaterThanOrEqual(18);
  });
});
