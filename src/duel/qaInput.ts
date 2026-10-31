// QA input: the UI steps of the duel scenarios (src/duel/scenarios.ts UiStep; docs/v3/A6_PLAN.md
// §4.1 "Arayüz adımlı senaryolar"). A step moves the mouse, clicks, presses a key or waits — by
// dispatching synthetic DOM MouseEvents on the game canvas and KeyboardEvents on window, the very
// events a person's mouse and keyboard produce, so every listener (Phaser's input manager, the
// window key handlers of HumanInput, Prompt, ActionMenu, the pause menu) answers as it would to a
// person. Phaser handles DOM mouse events synchronously, and the steps are paced by the game loop's
// own frames (unscaled update deltas), so under the frozen QA clock (tools/shot.mjs --fresh, films,
// measure) a scenario's clicks land on the same frame every run: deterministic.
//
//   await runUiStep(scene, views, { ui: 'move', at: { hand: 2 } });
//   await runUiStep(scene, views, { ui: 'click', at: { zone: [1, 'monster', 1] } });
//   await runUiStep(scene, views, { ui: 'key', key: 'Escape' });
//   await runUiStep(scene, views, { ui: 'wait', ms: 150 });
//
// Written in A56.0 (frozen with UiStep / runSteps): a target that cannot be resolved right now
// (no such hand card, no open menu row, no graveyard panel) skips its step, logged — never throws.

import type Phaser from 'phaser';
import { zoneXY, type XY } from '../view/layout';
import type { UiStep, UiTarget } from './scenarios';
import type { DuelViews } from './types';

/** Resolvers for targets owned by later work (e.g. the graveyard panel, lane A6-A): kind → point. */
const extraTargets = new Map<string, (scene: Phaser.Scene, views: DuelViews, arg: unknown) => XY | null>();

/**
 * Let a lane resolve one more target kind (e.g. `{ panel: i }` → the graveyard panel's card i).
 * Additive: the kinds below are resolved here; an unknown kind without a resolver is skipped.
 */
export function registerUiTarget(kind: string, resolve: (scene: Phaser.Scene, views: DuelViews, arg: unknown) => XY | null): void {
  extraTargets.set(kind, resolve);
}

/** World point → screen (game pixels) through the world camera (zoom 1 in v3). */
function worldToScreen(views: DuelViews, p: XY): XY {
  const cam = views.camera.main;
  return { x: (p.x - cam.worldView.x) * cam.zoom, y: (p.y - cam.worldView.y) * cam.zoom };
}

/** The screen point (game pixels, 640×360) a target means right now, or null. */
export function uiPoint(scene: Phaser.Scene, views: DuelViews, at: UiTarget): XY | null {
  if ('xy' in at) return { x: at.xy[0], y: at.xy[1] };
  if ('hand' in at) {
    const uid = views.hand.uids[at.hand];
    if (uid === undefined) return null;
    return views.hand.cardXY(uid);
  }
  if ('zone' in at) {
    const [p, kind, i] = at.zone;
    return worldToScreen(views, zoneXY(p, kind, i));
  }
  if ('unit' in at) {
    const u = views.field.unitAt(at.unit[0], at.unit[1]);
    return u ? worldToScreen(views, u.core()) : null;
  }
  if ('pile' in at) {
    const pile = views.field.pile(at.pile[0], at.pile[1]);
    return worldToScreen(views, pile.topXY());
  }
  if ('button' in at) {
    const hud = views.hud as unknown as Record<string, unknown>;
    const name = { battle: 'battleButton', endTurn: 'endTurnButton', menu: 'menuButton' }[at.button];
    const b = hud[name] as { x: number; y: number; w: number; h?: number; visible?: boolean } | undefined;
    if (!b) return null;
    return { x: b.x + b.w / 2, y: b.y + (b.h ?? 16) / 2 };
  }
  if ('menu' in at) return views.menu.rowXY(at.menu);
  for (const [kind, resolve] of extraTargets) if (kind in at) return resolve(scene, views, (at as Record<string, unknown>)[kind]);
  return null;
}

/** Game pixel → client coordinates on the page (the centre of that game pixel). */
function toClient(scene: Phaser.Scene, p: XY): { clientX: number; clientY: number } {
  const canvas = scene.game.canvas;
  const r = canvas.getBoundingClientRect();
  const sx = r.width / scene.scale.width;
  const sy = r.height / scene.scale.height;
  return { clientX: r.left + (Math.floor(p.x) + 0.5) * sx, clientY: r.top + (Math.floor(p.y) + 0.5) * sy };
}

function mouse(scene: Phaser.Scene, type: 'mousemove' | 'mousedown' | 'mouseup', p: XY, button: 0 | 2, buttons: number): void {
  const c = toClient(scene, p);
  scene.game.canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: c.clientX, clientY: c.clientY, screenX: c.clientX, screenY: c.clientY, button, buttons }));
}

/** Move the mouse to a game-pixel point. */
export function qaMove(scene: Phaser.Scene, p: XY): void {
  mouse(scene, 'mousemove', p, 0, 0);
}

/** A click (move there, press, release — one frame) at a game-pixel point. */
export function qaClick(scene: Phaser.Scene, p: XY, button: 'left' | 'right' = 'left'): void {
  const b = button === 'right' ? 2 : 0;
  mouse(scene, 'mousemove', p, 0, 0);
  mouse(scene, 'mousedown', p, b, b === 2 ? 2 : 1);
  mouse(scene, 'mouseup', p, b, 0);
}

/** A key press (keydown + keyup on window), e.g. 'Escape', 'Enter', ' ', '1', 'b'. */
export function qaKey(key: string): void {
  const code = key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : key === ' ' ? 'Space' : key;
  const legacy: Record<string, number> = { Escape: 27, Enter: 13, ' ': 32, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Tab: 9 };
  const keyCode = legacy[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
  for (const type of ['keydown', 'keyup'] as const) {
    const e = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
    // Phaser's keyboard plugin reads keyCode (deprecated, not settable through the constructor)
    Object.defineProperty(e, 'keyCode', { get: () => keyCode });
    Object.defineProperty(e, 'which', { get: () => keyCode });
    window.dispatchEvent(e);
  }
}

/** Wait `ms` of game-loop time (unscaled update deltas: the frozen QA clock steps them). */
export function qaWait(scene: Phaser.Scene, ms: number): Promise<void> {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve) => {
    let acc = 0;
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      scene.events.off('update', tick);
      scene.events.off('shutdown', end);
      resolve();
    };
    const tick = (_t: number, dt: number) => {
      acc += dt;
      if (acc >= ms - 0.001) end();
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', end);
  });
}

/** Run one UI step (see the header). Resolves after its `ms` (move / click / key: 0 by default). */
export async function runUiStep(scene: Phaser.Scene, views: DuelViews, step: UiStep): Promise<void> {
  if (step.ui === 'wait') return qaWait(scene, step.ms ?? 0);
  if (step.ui === 'key') {
    if (step.key) qaKey(step.key);
    return qaWait(scene, step.ms ?? 0);
  }
  const p = step.at ? uiPoint(scene, views, step.at) : null;
  if (!p) {
    console.info(`[qaInput] ${step.ui}: target ${JSON.stringify(step.at)} not on screen — step skipped`);
    return qaWait(scene, step.ms ?? 0);
  }
  if (step.ui === 'move') qaMove(scene, p);
  else qaClick(scene, p, step.button ?? 'left');
  return qaWait(scene, step.ms ?? 0);
}

// QA (batch-2 playtest, tools/playtest.mjs scripts): resolve a UI target from the page —
//   window.__neonUiPoint({ menu: 'activateSpell' }) → { x, y } in game pixels, or null.
(globalThis as { __neonUiPoint?: (at: UiTarget) => XY | null }).__neonUiPoint = (at) => {
  const g = (globalThis as { __neon?: { game?: Phaser.Game; duel?: { views: DuelViews } } }).__neon;
  const scene = g?.game?.scene.getScene('Duel');
  return scene && g?.duel ? uiPoint(scene, g.duel.views, at) : null;
};
