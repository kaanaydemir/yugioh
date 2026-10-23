// A3 Y8 — Taş Muhafız on the default recipe path (docs/v3/A3_MIMARI.md §6.1, §6.2, §14 Y8). The pilot's
// recipe file builds every part through the recipe layer (no `custom`); its flourishes — the hooks, the
// 'rockAssembly' set piece and the 'boulder' projectile — stay within the normal tier's ornament budget
// (≤ 250 lines); the hooks' frame beats are the art's; the crater decal is the art's own crater, so the
// hand-over from the frame to the decal cannot be seen: on every frame that draws the crater the sprite
// covers each decal pixel, the frame after the last one draws none, and P1 / P2 frames carry the same
// crater pixels; the thrown boulder breaks into its own matter (earth + moss), not the body's grey stone.

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { artFrame } from '../../src/art/textures';
import art from '../../src/art/monsters-v3/stone_sentinel';
import { presentationOf } from '../../src/presentation/registry';
import { voiceSounds } from '../../src/audio/v3/voices';
import { projectileMatter, projectileOf } from '../../src/cinematics/recipe/strike';
import '../../src/cinematics/recipe/projectiles/boulder';
import hooks, { BEATS, CRATER_BOX } from '../../src/cinematics/recipe/hooks/stone_sentinel';

const spec = art.anims.attack as { frames: number; holds?: number[]; marks?: Record<string, number> };
const frame = (f: number, p2 = false) => artFrame(art, 'attack', f, { lightFrom: p2 ? 'right' : 'left' });
const inBox = (fn: (x: number, y: number) => void) => {
  for (let y = CRATER_BOX.y0; y <= CRATER_BOX.y1; y++) for (let x = CRATER_BOX.x0; x <= CRATER_BOX.x1; x++) fn(x, y);
};
const CRATER_TONES = new Set<number>([PAL.ink, PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4]);
/** The pilot's ornament files (A3_MIMARI §6.2 budget). */
const ORNAMENT = import.meta.glob<string>(['/src/cinematics/recipe/hooks/stone_sentinel.ts', '/src/cinematics/recipe/setpieces/rockAssembly.ts', '/src/cinematics/recipe/projectiles/boulder.ts'], { query: '?raw', import: 'default', eager: true });

describe('Taş Muhafız on the default recipe path (A3 Y8)', () => {
  it('its recipe draws no part itself: throw from the rock, assemble with rockAssembly, a rumble voice', () => {
    const r = presentationOf('stone_sentinel')!;
    expect(r.tier).toBe('normal');
    expect(r.custom).toBeUndefined();
    expect(r.attack).toMatchObject({ type: 'throw', blow: 'physical', from: 'muzzle', vfx: 'boulder', blocked: 'shatter', ranged: true });
    expect(r.summon).toMatchObject({ style: 'assemble', setPiece: 'rockAssembly' });
    expect(r.death).toEqual({ material: 'stone', accent: 'stone' });
    expect('palette' in r.voice && r.voice.palette).toBe('rumble');
    const voice = voiceSounds('stone_sentinel')!;
    expect(Object.keys(voice).filter((k) => k !== 'afterDissolve' && k !== 'rip')).toHaveLength(10);
    expect(voice.rip).toBe('voice:stone_sentinel:rip');
    // the helm hits the floor 3 frames after the crumble starts and bounces on the next (pilot fix)
    expect(voice.afterDissolve).toEqual([[3, voice.land, 0.5], [4, voice.land, 0.2]]);
    expect(Object.keys(hooks).sort()).toEqual(['onCharge', 'onContact', 'onDeath']);
  });

  it("the hooks' beats are the art's: the dig is the charge, the rip one fast frame, the hold the longest beat before the release", () => {
    const holds = spec.holds!;
    const rel = spec.marks!.release;
    expect(spec.frames).toBe(19);
    expect(spec.marks!.charge).toBe(BEATS.dig);
    expect(BEATS.dig).toBeLessThan(BEATS.rip);
    expect(holds[BEATS.rip]).toBeLessThanOrEqual(60);
    // the hold: three tremble beats (pilot fix) — together the longest beat of the wind-up
    const hold = holds.slice(BEATS.hold, BEATS.hold + 3).reduce((x, y) => x + y, 0);
    const others = holds.slice(0, rel).filter((_, f) => f < BEATS.hold || f >= BEATS.hold + 3);
    expect(hold).toBeGreaterThan(Math.max(...others));
    expect(BEATS.crater).toBeLessThan(spec.frames - 1);
  });

  it('the crater decal is the art\'s own crater: covered while the frames draw it, alone after them', () => {
    const src = frame(BEATS.crater);
    let px = 0;
    inBox((x, y) => {
      const c = src.get(x, y);
      if (c === null) return;
      px++;
      // only crater tones in the box (the body is clear of it on that frame)
      expect(CRATER_TONES.has(c), `(${x},${y})`).toBe(true);
      // every frame from the one after the rip to the last crater frame covers the decal's pixel
      for (let f = BEATS.rip + 1; f <= BEATS.crater; f++) expect(frame(f).isOpaque(x, y), `f${f} (${x},${y})`).toBe(true);
      // the same pixel on the P2 sheet (shown mirrored, as the decal is)
      expect(frame(BEATS.crater, true).get(x, y)).toBe(c);
    });
    expect(px).toBeGreaterThan(30);
    // the frame after the last crater frame draws nothing there: from then on the decal alone shows it
    inBox((x, y) => expect(frame(BEATS.crater + 1).isOpaque(x, y), `(${x},${y})`).toBe(false));
  });

  it('the thrown boulder is its own drawing and breaks into its own matter (earth, moss), not the body\'s stone', () => {
    expect(projectileOf('boulder')).not.toBeNull();
    const m = projectileMatter('boulder')!;
    expect(m.tones).toEqual([PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4]);
    const moss: readonly number[] = [PAL.leaf1, PAL.leaf2, PAL.leaf3];
    expect(m.accent?.every((c) => moss.includes(c))).toBe(true);
  });

  it('the ornament budget: hooks + set piece + projectile ≤ 250 lines (A3_MIMARI §6.2)', () => {
    expect(Object.keys(ORNAMENT)).toHaveLength(3);
    const lines = Object.values(ORNAMENT).reduce((n, src) => n + src.split('\n').length - 1, 0);
    expect(lines).toBeLessThanOrEqual(250);
  });
});
