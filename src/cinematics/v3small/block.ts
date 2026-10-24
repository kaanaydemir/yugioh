// v3 lane A6-B (B4) — the block's readability layer (docs/v3/A6_PLAN.md §3 F6 "Engelleme / blok") behind
// V3_A6_B. A wrapper on the `damage` event ("damage olayına sarmalayıcı"): registered only under the flag
// (v1 and a6=off|a register nothing), at priority 10 so it runs before tb:damage and hands over to it at
// once — the body's reaction stays in the A2 / A3 hit kit, the recoil's LP fall stays tb:damage's (the
// attacker's owner's panel counts down on its odometer, F3: "hasar kime gitti" is read on the panel).
//
// A block = a battle into a DEFENCE-position monster whose DEF is higher than the attacker's ATK (result
// noDestroy): its recoil damage hits the attacker's owner and is played by the battle handler on the
// contact frame (hints.battle). On that first frame:
//   0        ui3Block (A2's own shieldBlock / impact sounds already ring on this frame: no fallback
//            sound while lane A6-A's recipe is silent — nothing doubles)
//   0        a 9×10 shield appears over the defender's DEF digits (2 px above its badge): one white
//            frame, then the defender's tone (body, a lit left edge, a white rib); beside it "BLOK"
//            stamped one letter a frame (each letter one white frame, then the defender's light tone)
//   0–260    the shield holds; 260–293 two palette steps down; gone
//   0–400    "BLOK" holds; 400–433 two palette steps down; gone
// ATK = DEF (no damage event) shows nothing, as today. Whole pixels, palette only, no alpha / ADD /
// scale; no camera call (KO-1 … KO-4, KO-10). Reduced motion: no stamping (the word at once).

import type Phaser from 'phaser';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { digitsWidth } from '../../art/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { V3_A6_B } from '../../view/v3flags';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { canvasTexture, glyphTexture, hex, layoutLine, ui3Sfx } from '../../view/v3/hudSkin';
import { registerEvent } from '../api';
import type { CinematicContext } from '../_core/types';

type DamageCtx = CinematicContext<Extract<GameEvent, { type: 'damage' }>>;
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

const FRAME = 1000 / 60;

/** The block layer's timings (ms at 1×, scene clock) and geometry (px). */
export const BLOCK_V3 = Object.freeze({
  shieldHoldMs: 260,
  wordHoldMs: 400,
  /** Two palette steps out, two frames each. */
  stepMs: FRAME,
  /** The shield's bottom row sits this many px above the badge's top row. */
  gapBadge: 2,
  wordGap: 2,
  depth: DEPTH.FX_TOP + 30,
  priority: 10,
});

/** The block's battle for a damage event (the recoil of a blocked attack), or null. Pure (tests). */
export function blockOf(events: readonly GameEvent[], index: number, ev: Extract<GameEvent, { type: 'damage' }>): BattleEv | null {
  if (ev.source !== 'battle') return null;
  for (let i = index - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type !== 'battle') continue;
    const blocked = e.result === 'noDestroy' && e.targetPosition === 'defense' && e.targetUid !== null && (e.targetValue ?? 0) > e.attackerAtk;
    return blocked && ev.player === e.player ? e : null;
  }
  return null;
}

// ---------------------------------------------------------------- the shield (9 × 10)

const SHIELD = [
  '.OOOOOOO.',
  'OHHHHHHLO',
  'OHLLWLLMO',
  'OHLLWLLMO',
  'OHLLWLLMO',
  'OLLLWLLDO',
  '.OLLLLDO.',
  '.OMLLMDO.',
  '..OMMDO..',
  '...OOO...',
];
export const SHIELD_W = 9;
export const SHIELD_H = 10;

/** The shield in the defender's ramp at a fade step (0 = rest, 1 / 2 = one / two steps down), or all white. */
export function shieldCanvas(ramp: Ramp, step: 0 | 1 | 2 | 'white'): PixelCanvas {
  const p = new PixelCanvas(SHIELD_W, SHIELD_H);
  const k = step === 'white' ? 0 : step;
  const tone = (i: number) => ramp[Math.max(0, i - k)];
  const map: Record<string, number> =
    step === 'white'
      ? { O: PAL.ink, H: PAL.white, L: PAL.white, M: PAL.white, D: PAL.white, W: PAL.white }
      : { O: PAL.ink, H: tone(4), L: tone(3), M: tone(2), D: tone(1), W: k === 0 ? PAL.white : tone(4) };
  SHIELD.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = map[row[x]];
      if (c !== undefined) p.set(x, y, c);
    }
  });
  return p;
}

/** Where the shield's top-left goes: centred over the DEF digits of the unit's badge (whole pixels). */
export function shieldXY(badge: { x: number; y: number }, atk: number, def: number): XY {
  const aw = digitsWidth(String(Math.max(0, atk)));
  const dw = digitsWidth(String(Math.max(0, def)));
  const W = 3 + aw + 5 + dw + 3;
  const left = badge.x - W / 2;
  const defCx = left + 3 + aw + 5 + dw / 2;
  const top = badge.y - 9 / 2;
  return { x: Math.round(defCx - SHIELD_W / 2), y: Math.round(top - BLOCK_V3.gapBadge - SHIELD_H) };
}

// ---------------------------------------------------------------- the handler

/** Show the shield + "BLOK" over the defender (runs on its own; never awaited by the damage). */
export function showBlock(scene: Phaser.Scene, unit: MonsterUnit, defender: PlayerId): void {
  const badge = unit.badge;
  if (!badge.image.active) return;
  const R: Ramp = PLAYER_RAMP[defender];
  const at = shieldXY({ x: badge.image.x, y: badge.image.y }, badge.atk, badge.def);
  const key = (s: 0 | 1 | 2 | 'white') => canvasTexture(scene, `ui3:block:shield:${hex(R[3])}:${s}`, () => shieldCanvas(R, s));
  const shield = scene.add.image(at.x, at.y, key('white')).setOrigin(0, 0).setDepth(BLOCK_V3.depth);
  // "BLOK": one glyph image per letter, stamped one a frame (a letter's first frame white, 1 px high)
  const L = layoutLine('BLOK', 'sm');
  const wx = at.x + SHIELD_W + BLOCK_V3.wordGap;
  const wy = at.y + Math.round((SHIELD_H - L.h) / 2);
  const word = L.glyphs.map((g) => scene.add.image(wx + g.x, wy, glyphTexture(scene, g.code, 'sm', PAL.white)).setOrigin(0, 0).setDepth(BLOCK_V3.depth).setVisible(false));
  const tones = [R[4], R[3], R[2]];
  let el = 0;
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    scene.events.off('update', tick);
    scene.events.off('shutdown', end);
    if (shield.active) shield.destroy();
    for (const w of word) if (w.active) w.destroy();
  };
  const tick = (_t: number, dt: number) => {
    el += dt * scene.tweens.timeScale;
    // the shield: one white frame, the tone, then two steps down and gone
    const s = BLOCK_V3.shieldHoldMs;
    if (el >= s + 2 * BLOCK_V3.stepMs) shield.setVisible(false);
    else shield.setTexture(key(el < FRAME - 0.5 ? 'white' : el < s ? 0 : el < s + BLOCK_V3.stepMs ? 1 : 2));
    // the word: stamped one letter a frame, held, two steps down
    const w = BLOCK_V3.wordHoldMs;
    word.forEach((img, i) => {
      const from = REDUCED_MOTION ? 0 : i * FRAME;
      const on = el >= from - 0.5 && el < w + 2 * BLOCK_V3.stepMs;
      img.setVisible(on);
      if (!on) return;
      const fresh = !REDUCED_MOTION && el < from + FRAME - 0.5;
      const tone = fresh ? PAL.white : el < w ? tones[0] : el < w + BLOCK_V3.stepMs ? tones[1] : tones[2];
      const g = L.glyphs[i];
      img.setTexture(glyphTexture(scene, g.code, 'sm', tone));
      img.y = fresh ? wy - 1 : wy;
    });
    if (el >= Math.max(s, w) + 2 * BLOCK_V3.stepMs) end();
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', end);
  tick(0, 0);
}

/** The `damage` wrapper: the block's layer on the contact frame, then today's damage handler. */
export async function blockV3(ctx: DamageCtx): Promise<void> {
  const b = blockOf(ctx.events, ctx.index, ctx.ev);
  if (b && b.targetUid !== null) {
    const unit = ctx.unit(b.targetUid);
    if (unit && !unit.retired) {
      ui3Sfx('ui3Block', { volume: 0.8 }, null);
      showBlock(ctx.scene, unit, b.player === 0 ? 1 : 0);
    }
  }
  return ctx.base();
}

if (V3_A6_B) registerEvent('damage', blockV3, { name: 'a6:block', priority: BLOCK_V3.priority });
