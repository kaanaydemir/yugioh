// Taş Muhafız — recipe hooks (A3_MIMARI §6.2; in the pilot's ≤ 250-line ornament budget with
// setpieces/rockAssembly.ts and projectiles/boulder.ts). The art draws the dig, the tear, the crater, the dirt
// and the dust in its own frame; these add what a frame cannot hold:
//   onCharge   (the dig, f3, is the declaration's held charge: its crunch opens the voice's charge) RIP (f5): torn
//              stone (the voice's own 'rip': a tearing crack, a scrape, grit), a shake, clods past the frame; hold
//              (f10): the eye's light on the floor. From f6 the art's OWN crater pixels
//              lie on the floor under the sprite (the frame's crater ends at 1 340 ms: the hand-over cannot be
//              seen), kept for the scene (ctx.keep: the batch), then the dirt slides back in palette steps
//   onContact  floor cracks round the struck body (outside its card) or under the duelist's podium; none on a
//              guard (the rock shatters on the shield); kept like the crater
//   onDeath    floor cracks round the heap, outside the card
// Beats are the art's (stone_sentinel-anims.ts), kept true by tests/presentation/sentinel.test.ts.

import { PAL } from '../../../art/palette';
import { mulberry32 } from '../../../art/pixel';
import { monsterFrame } from '../../../art/textures';
import { DIG_AT } from '../../../art/monsters-v3/stone_sentinel-fx';
import type { MonsterUnit } from '../../../duel/MonsterUnit';
import type { RecipeHooks } from '../../../presentation/types';
import { lightFlash } from '../../../view/light';
import { shake } from '../../../vfx/core';
import { Sparks } from '../../../vfx/combat';
import { Raster } from '../../../vfx/setpieces';
import type { CinematicContext } from '../../_core/types';
import { voiceSounds } from '../../../audio/v3/voices';
import { atFrame, panAt, play, soundsOf } from '../../_v3/sound';
import { floorCracks, keepDecal } from '../setpieces/rockAssembly';

/** The art's attack beats: the dig, the rip, the hold, the last frame that draws the crater. */
export const BEATS = { dig: 3, rip: 5, hold: 10, crater: 17 } as const;
/** The crater's box in the frame (round the dig spot; clear of the body on BEATS.crater). */
export const CRATER_BOX = { x0: DIG_AT[0] - 8, x1: DIG_AT[0] + 5, y0: DIG_AT[1] - 3, y1: DIG_AT[1] + 3 } as const;

/** The art's crater, pixel for pixel, on the floor under the sprite (a P2 sprite shows it mirrored). */
function craterDecal(ctx: CinematicContext, u: MonsterUnit): void {
  const pc = monsterFrame(u.cardId, 'attack', BEATS.crater);
  const b = CRATER_BOX;
  const flip = u.sprite.flipX ? 1 : 0;
  const p = u.framePoint(b.x0, b.y0);
  const q = u.framePoint(b.x1 + 1, b.y1 + 1);
  const r = new Raster(u.scene, Math.min(p.x, q.x), Math.min(p.y, q.y), Math.abs(q.x - p.x), Math.abs(q.y - p.y), u.sprite.depth - 0.5);
  keepDecal(ctx, `sentinel:crater:${u.uid}`, r, (step) =>
    r.draw(() => {
      for (let y = b.y0; y <= b.y1; y++)
        for (let x = b.x0; x <= b.x1; x++) {
          const c = pc.get(x, y);
          if (c === null) continue;
          const w = u.framePoint(x + flip, y);
          // the dirt slides back in: the pit fills with loose earth, then the heap thins out
          const k = step === 0 ? c : c === PAL.ink ? PAL.earth0 : c === PAL.earth0 ? PAL.earth1 : c;
          r.dpx(Math.round(w.x), Math.round(w.y), k, [1, 1, 0.5, 0.25][step]);
        }
    }),
  );
}

const hooks: RecipeHooks = {
  onCharge({ s }) {
    const u = s.attacker;
    const sc = s.scene;
    const late = { late: false, maxMs: 3000 };
    atFrame(u, 'attack', BEATS.rip, () => {
      void shake(sc, 110, 1);
      const rip = soundsOf(u.cardId) ? voiceSounds(u.cardId)?.rip : null;
      if (rip) play(rip, { volume: 1, pan: panAt(u.home.x) });
      // clods thrown past the frame, bouncing on the floor round the hole
      const d = u.framePoint(DIG_AT[0] + (u.sprite.flipX ? 1 : 0), DIG_AT[1]);
      const side = u.sprite.flipX ? 1 : -1;
      const rnd = mulberry32(u.uid * 31 + 5);
      const sp = new Sparks(sc, u.sprite.depth + 1);
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + side * (0.2 + rnd() * 1.1);
        const vv = 50 + rnd() * 80;
        sp.add({ x: Math.round(d.x + rnd() * 6 - 3), y: Math.round(d.y) - 2, vx: Math.cos(a) * vv, vy: Math.sin(a) * vv * 1.3, ay: 520, life: 380 + rnd() * 220, colors: [PAL.earth4, PAL.earth3, PAL.earth2, PAL.earth1], shape: i % 3 ? 'sq' : 'px', size: i % 2 ? 2 : 1, floor: Math.round(d.y) + 1 + Math.round(rnd() * 2), bounce: 0.3, fadeAt: 1 });
      }
      sp.release();
    }, late);
    atFrame(u, 'attack', BEATS.rip + 1, () => craterDecal(s.ctx, u), { maxMs: 3000 });
    atFrame(u, 'attack', BEATS.hold, () => {
      const p = u.art.points?.('attack', BEATS.hold).head;
      const eye = p ? u.framePoint(p.x, p.y) : u.core();
      void lightFlash(sc, Math.round(eye.x), Math.round(eye.y), PAL.gold4, 20, 300, { floorY: u.home.y, intensity: 0.7 });
    }, late);
  },
  onContact({ s }) {
    if (s.blocked) return;
    const tile = !s.direct && s.target;
    const at = tile ? tile.home : s.toGround;
    // round a monster they start outside its card's diamond (the card lies over them), else under the podium
    floorCracks(s.ctx, { x: Math.round(at.x), y: Math.round(at.y) }, s.attacker.uid * 7 + 3, { n: 7, len: 16, from: tile ? 18 : 0, key: `sentinel:cracks:${s.attacker.uid}` });
  },
  onDeath({ ctx, unit }) {
    floorCracks(ctx, { x: Math.round(unit.home.x), y: Math.round(unit.home.y) }, unit.uid * 11 + 1, { n: 6, len: 13, from: 18, key: `sentinel:heap:${unit.uid}` });
  },
};

export default hooks;
