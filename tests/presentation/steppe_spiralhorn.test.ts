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

  it('covers the scenarios of the lane brief', () => {
    for (const k of ['sshSummon', 'sshSummonP2', 'sshAttack', 'sshAttackP2', 'sshDirect', 'sshHit', 'sshKill', 'sshKillP2', 'sshGuard', 'sshBlocked', 'sshLoser'])
      expect(scenarios[k], k).toBeTruthy();
    for (const s of Object.values(scenarios)) expect(s.stage?.zones).toBe(5);
  });
});
