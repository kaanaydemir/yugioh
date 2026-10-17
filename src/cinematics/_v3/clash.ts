// v3 BATTLE OUTCOME KIT — counter-blow + number timing (docs/v3/A0_ENVANTER.md §6.2 item 3; A0
// §1.2 #7: "the attacker flies home and is hit by nothing; the number pops 0.1–1.0 s before the
// visual blow"). Used by battle/battle.ts under ?look=v3.
//
//   blowFrom(attacker, toGround, fallback)   the blow direction from where the attacker IS at the
//                                            contact frame (an assassin that rose behind its
//                                            target hits it from behind) — not from its home tile
//   backlash(scene, from, to, ramp)          the stronger side's answer to a RANGED attacker: the
//                                            shock runs back along the line of the attack and
//                                            lands on the attacker on the same frame (instant,
//                                            so the attacker is struck at contact, with the number)
//   isMelee(attacker, clash)                 the attacker stands within reach of the clash point
//   declarePoseFrame(u) / strikeStartFrame(u) the attack frame the declaration holds (its 'charge'
//                                            mark) and where a v3 strike should continue from
//
// The rules of the outcome (who is destroyed, how much damage) come from the engine events; this
// only stages them.
//
// For strike authors (registerStrike): when the attacker LOSES (ctx.ev.result is
// 'attackerDestroyed' / 'bothDestroyed') the battle handler answers on the contact frame — the
// counter-hit, the number and then the death (once the strike has resolved). A v3 strike should
// therefore resolve right after s.impact() in that case and leave the sprite where it is (no
// trip home); the handler takes it from the contact pose. Strikes that keep running are waited
// for, and the reaction pose is re-asserted when they send the sprite back to idle.
//
// The declaration (battle/declare.ts, v3) leaves the attacker on its attack anim's 'charge' frame
// (declarePoseFrame). A v3 strike should continue the attack from there instead of restarting it
// at frame 0 (which steps the pose back): `const f0 = strikeStartFrame(u);
// void u.playRange('attack', f0); await wait(scene, u.rangeMs('attack', f0, u.impactFrame));`.

import Phaser from 'phaser';
import { PAL, type Ramp } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { Raster, boltPath, onFrame } from '../../vfx/setpieces';

const ADD = Phaser.BlendModes.ADD;

function norm(a: XY): XY {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
}

/**
 * Direction the blow travels (unit vector, screen space): from the attacker's CURRENT floor point
 * to `toGround` (the target's tile / the duelist's podium). Falls back to `fallback` (the
 * home-tile direction) when the attacker is gone or stands on the target's own point.
 */
export function blowFrom(attacker: MonsterUnit | null, toGround: XY, fallback: XY): XY {
  if (!attacker || attacker.retired || !attacker.sprite.active) return fallback;
  const f = attacker.worldPoint('feet');
  const d = { x: toGround.x - f.x, y: toGround.y - f.y };
  if (Math.hypot(d.x, d.y) < 6) {
    // standing on top of it (a dive): use the core instead, else the fallback
    const c = attacker.core();
    const d2 = { x: toGround.x - c.x, y: toGround.y - 10 - c.y };
    return Math.hypot(d2.x, d2.y) < 6 ? fallback : norm(d2);
  }
  return norm(d);
}

/** Does the attacker stand within reach of the clash point (a melee strike in front of its target)? */
export function isMelee(attacker: MonsterUnit, clash: XY, reach = 44): boolean {
  const c = attacker.core();
  return Math.hypot(c.x - clash.x, c.y - clash.y) <= reach;
}

/**
 * The counter-shock of a ranged clash: a jagged white-hot line from the clash point `from` to the
 * attacker's contact point `to`, fully drawn on the contact frame itself (it holds through the
 * hit-stop), then it drains toward the attacker and goes out (~180 ms of scene time). Pixel
 * lines only (no glow sprite). Resolves when gone.
 */
export function backlash(scene: Phaser.Scene, from: XY, to: XY, ramp: Ramp, ms = 180): Promise<void> {
  const pad = 14;
  const x0 = Math.min(from.x, to.x) - pad;
  const y0 = Math.min(from.y, to.y) - pad;
  const ras = new Raster(scene, x0, y0, Math.abs(to.x - from.x) + pad * 2, Math.abs(to.y - from.y) + pad * 2, DEPTH.FX + 3, ADD);
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const path = boltPath(from, to, Math.min(9, 3 + len * 0.05), 4);
  const n = path.length;
  return new Promise<void>((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      ras.destroy();
      resolve();
    };
    onFrame(scene, (_dt, el) => {
      const t = Math.min(1, el / ms);
      ras.draw((g) => {
        // the line drains toward the attacker: its tail follows the shock
        const i0 = Math.min(n - 2, Math.floor(t * t * (n - 1)));
        const seg = path.slice(i0);
        if (t < 0.45) g.path(seg, ramp[2], 1, 3);
        g.path(seg, t < 0.25 ? PAL.white : ramp[4], 1, t < 0.6 ? 2 : 1);
        if (t < 0.5) g.path(seg, PAL.white, 1, 1);
        // the landing spark on the attacker: a small cross
        const k = Math.round(4 * (1 - t));
        if (k > 0) {
          g.line(to.x - k, to.y, to.x + k, to.y, PAL.white, 1);
          g.line(to.x, to.y - k, to.x, to.y + k, PAL.white, 1);
        }
      });
      if (t >= 1) {
        end();
        return false;
      }
      return true;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, end);
  });
}

/**
 * The pose the attack declaration holds: the attack anim's 'charge' mark (the frame where the
 * strike starts gathering), else its first wind-up frame (frame 1; 0 when the strike lands on 1).
 */
export function declarePoseFrame(u: MonsterUnit): number {
  const spec = u.spec('attack');
  if (!spec) return 0;
  const c = spec.marks?.charge;
  if (typeof c === 'number' && Number.isFinite(c)) return Math.max(0, Math.min(spec.frames - 1, Math.round(c)));
  return Math.max(0, Math.min(1, u.impactFrame - 1));
}

/**
 * The attack frame a strike should start from: the declaration's held pose when the sprite still
 * shows it (a held 'attack' frame), else 0.
 */
export function strikeStartFrame(u: MonsterUnit): number {
  const fi = u.frameInfo();
  return fi.anim === 'attack' && !u.sprite.anims.isPlaying ? fi.frame : 0;
}

/**
 * The v3 declaration's hold (battle/declare.ts) can hand the attacker, still in its charge pose,
 * straight to the strike — no return to idle in between — so a v3 strike continues the attack
 * from there (strikeStartFrame). release() / destroy() give the idle loop back instead (traps, a
 * negated attack).
 */
export interface HandOver {
  handOver(): void;
}

export function canHandOver<T extends object>(h: T | null): h is T & HandOver {
  return !!h && typeof (h as Partial<HandOver>).handOver === 'function';
}
