// Phone only: a finger swipe scrolls like the mouse wheel, with iOS-like momentum.
//
// The game's scrollable panels (the gallery pages, the deck picker's card strip, the graveyard panel)
// listen to the scene's POINTER_WHEEL event. On a phone there is no wheel, so this turns a swipe into
// those same wheel events: every STEP_PX of finger travel emits one "notch" (±100, a mouse wheel's
// unit), and a flick keeps emitting notches while it slows down. Finger up / left = scroll forward.
// The deck builder has its own richer touch controls (src/scenes/deck/touch.ts) and is not hooked.

import Phaser from 'phaser';

/** Finger travel (game px) per wheel notch, and before a press counts as a swipe. */
const STEP_PX = 26;
const SLOP = 6;
const FRICTION = 0.92;
const MIN_V = 0.04;

function attach(scene: Phaser.Scene): void {
  const inp = scene.input;
  let down = false;
  let swiping = false;
  let sx = 0;
  let sy = 0;
  let last = 0;
  let lastT = 0;
  let axis: 'x' | 'y' = 'y';
  let acc = 0;
  let vel = 0;
  let coast = 0;
  let ptr: Phaser.Input.Pointer | null = null;

  const emit = (d: number): void => {
    acc += d;
    while (Math.abs(acc) >= STEP_PX) {
      const s = Math.sign(acc);
      acc -= s * STEP_PX;
      // dx and dy both carry the notch: a handler reads whichever axis it scrolls on
      inp.emit(Phaser.Input.Events.POINTER_WHEEL, ptr, [], s * 100, s * 100, 0);
    }
  };
  const onDown = (p: Phaser.Input.Pointer): void => {
    down = true;
    swiping = false;
    coast = 0;
    acc = 0;
    vel = 0;
    sx = p.x;
    sy = p.y;
    ptr = p;
  };
  const onMove = (p: Phaser.Input.Pointer): void => {
    if (!down || !p.isDown) return;
    if (!swiping) {
      const dx = p.x - sx;
      const dy = p.y - sy;
      if (Math.hypot(dx, dy) < SLOP) return;
      swiping = true;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      last = axis === 'x' ? p.x : p.y;
      lastT = p.event?.timeStamp ?? scene.time.now;
      return;
    }
    const v = axis === 'x' ? p.x : p.y;
    const now = p.event?.timeStamp ?? scene.time.now;
    const d = last - v;
    vel = vel * 0.4 + (d / Math.max(1, now - lastT)) * 0.6;
    last = v;
    lastT = now;
    emit(d);
  };
  const onUp = (p: Phaser.Input.Pointer): void => {
    if (!down) return;
    down = false;
    if (!swiping) return;
    const now = p.event?.timeStamp ?? scene.time.now;
    coast = now - lastT > 80 ? 0 : Math.max(-2, Math.min(2, vel));
  };
  const onUpdate = (_t: number, dt: number): void => {
    if (!coast) return;
    emit(coast * dt);
    coast *= Math.pow(FRICTION, dt / 16.7);
    if (Math.abs(coast) < MIN_V) coast = 0;
  };
  inp.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  inp.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  inp.on(Phaser.Input.Events.POINTER_UP, onUp);
  inp.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    inp.off(Phaser.Input.Events.POINTER_DOWN, onDown);
    inp.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    inp.off(Phaser.Input.Events.POINTER_UP, onUp);
    inp.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
  });
}

/** Hook swipe scrolling into these scenes every time they are created (call once, after boot config). */
export function installSwipeWheel(game: Phaser.Game, keys: readonly string[]): void {
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const key of keys) {
      const sc = game.scene.getScene(key);
      sc?.events.on(Phaser.Scenes.Events.CREATE, () => attach(sc));
    }
  });
}
