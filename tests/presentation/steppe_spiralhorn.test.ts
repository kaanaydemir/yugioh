// Bozkır Boynuzlusu — the presentation contract of the card (src/presentation/cards/steppe_spiralhorn.ts,
// src/audio/v3/steppe_spiralhorn.ts, src/duel/scenarios/steppe_spiralhorn.ts): the recipe draws strike / summon itself
// and leaves death / flip on the recipe layer (decorated by the card's own priority-20 hook); its voice resolves to the
// hand-made set and every role names a registered ssh sound; none of the lane-wide banned shared recipes is a role;
// the flute pitches of the three bounds rise 880 / 988 / 1175 Hz; the scenario keys of the lane brief exist.

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { SFX_NAMES } from '../../src/audio/sfx';
import { APEX_PITCH, SPIRALHORN_VOICE, V3_SPIRALHORN_RECIPES } from '../../src/audio/v3/steppe_spiralhorn';
import { CHARACTER_SOUNDS } from '../../src/cinematics/_v3/sound';
import { presentationOf } from '../../src/presentation/registry';
import scenarios from '../../src/duel/scenarios/steppe_spiralhorn';
import { strikeStop } from '../../src/cinematics/kartc/steppe_spiralhorn-fx';
import { framePoints } from '../../src/art/monsters-v3/steppe_spiralhorn-anims';
import { AX } from '../../src/art/monsters-v3/steppe_spiralhorn-rig';

describe('steppe_spiralhorn presentation', () => {
  it('draws its strike and summon itself; death and flip stay on the recipe layer', () => {
    const r = presentationOf('steppe_spiralhorn');
    expect(r).toBeTruthy();
    expect(r!.custom).toEqual({ strike: true, summon: true });
    expect(r!.voice).toEqual({ custom: 'steppe_spiralhorn' });
    // §5.2: the seed / grass cloud on the wind — never a stone, fire or shadow end
    expect(['stone', 'fire', 'shadow']).not.toContain(r!.death.material);
  });

  it('speaks with its own voice: every role is a registered ssh sound', () => {
    expect(CHARACTER_SOUNDS.steppe_spiralhorn).toBe(SPIRALHORN_VOICE);
    const names = new Set<string>(SFX_NAMES);
    const roles: [string, unknown][] = [];
    for (const [role, v] of Object.entries(SPIRALHORN_VOICE) as [string, unknown][]) {
      if (Array.isArray(v)) for (const x of v as readonly (readonly [number, string, number])[]) roles.push([role, x[1]]);
      else roles.push([role, v]);
    }
    for (const [role, name] of roles) {
      expect(names.has(name as string), role).toBe(true);
      expect(String(name).startsWith('ssh'), role).toBe(true);
    }
    for (const k of Object.keys(V3_SPIRALHORN_RECIPES)) {
      expect(names.has(k), k).toBe(true);
      expect(k.startsWith('ssh'), k).toBe(true);
    }
  });

  it('raises the flute over the three bounds: 880 → 988 → 1175 Hz', () => {
    const hz = APEX_PITCH.map((p) => Math.round(880 * p));
    expect(hz).toEqual([880, 988, 1175]);
  });

  it('lands the strike between home and the target, the horn tip just short of it — as P1 and as P2', () => {
    const tipDx = framePoints('attack', 14).muzzle!.x - AX;
    // the 5-zone board, zone 2 against zone 2 (measured live): P1 home (288,176) → target (352,144), P2 the mirror
    const cases = [
      { sgn: 1 as const, home: { x: 288, y: 176 }, aim: { x: 352, y: 144 }, front: 334 },
      { sgn: -1 as const, home: { x: 352, y: 144 }, aim: { x: 288, y: 176 }, front: 308 },
    ];
    for (const c of cases) {
      const stop = strikeStop(c.aim, c.front, c.sgn * tipDx, c.sgn);
      const lo = Math.min(c.home.x, c.aim.x);
      const hi = Math.max(c.home.x, c.aim.x);
      expect(stop.x, `x ${c.sgn}`).toBeGreaterThanOrEqual(lo);
      expect(stop.x, `x ${c.sgn}`).toBeLessThanOrEqual(hi);
      expect(Math.abs(stop.y - c.aim.y), `row ${c.sgn}`).toBeLessThanOrEqual(4);
      // the levelled horn tip lands 3 px short of the target's facing side
      expect((stop.x + c.sgn * tipDx - c.front) * c.sgn, `tip ${c.sgn}`).toBe(-3);
    }
  });

  it('covers the scenarios of the lane brief', () => {
    for (const k of ['sshSummon', 'sshSummonP2', 'sshAttack', 'sshAttackP2', 'sshDirect', 'sshHit', 'sshKill', 'sshKillP2', 'sshGuard', 'sshBlocked', 'sshLoser'])
      expect(scenarios[k], k).toBeTruthy();
    for (const s of Object.values(scenarios)) expect(s.stage?.zones).toBe(5);
  });
});
