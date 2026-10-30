// Neon Tower layer: SCREENS (portrait screens) — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2, §7, §10).
// The two big digital screens hanging in the wall bays (layout-nt.ts SCREENS, 90×62 with frame, 80×56
// picture): the player's (blue frame, brown-haired boy in the blue coat) and the opponent's (crimson frame,
// white-haired boy in the red coat), pixel-art portraits baked in src/art/arena-nt/portraits.ts, with a name
// plate (OYUNCU 1 / OYUNCU 2, or BİLGİSAYAR in a vs-CPU duel; Turkish text through the UI text API).
//
// Alive, calm (every motion is a function of the arena clock, see src/art/arena-nt/screens-anim.ts):
//   idle      blink, hair sway, a 1-px scan row, a lit sweep column now and then, a one-frame flicker, a rare
//             sideways tear, the inactive side's neon line breathing; the active side's frame is one tone brighter
//   reaction  damage: the face winces (eyes shut), the picture jolts 1 px, one lit flash frame, a slipped band on a
//             big hit, the neon goes hot; healing: a smile and a lit band climbing the picture; a summon: a sweep
//             column; game over: the winner keeps smiling, the loser winces and the picture keeps tearing
//   power     lights out → the screens are dark (frame only); lights on → the picture is drawn in from the top row by
//             row behind a bright edge (≈ 0.4 s)
// ~9 game objects per screen, no tweens, no timers (the whole layer runs on tick()). Depth: NT_DEPTH.screens.

import type Phaser from 'phaser';
import {
  NT_SCREENS_KEY,
  PIC_AT,
  type ScreenOverlayKind,
  frameName,
  litName,
  overlayName,
  picName,
  screensBake,
} from '../../art/arena-nt/screens';
import { blinkAt, breathAt, flickerAt, scanAt, sweepAt, swayAt, tearAt } from '../../art/arena-nt/screens-anim';
import { PORTRAIT_H, PORTRAIT_W } from '../../art/arena-nt/portraits';
import { PAL, RAMPS } from '../../art/palette';
import type { GameEvent, PlayerId } from '../../engine/types';
import { measureText, pixelText, textMetrics } from '../../ui/text';
import { wait } from '../../vfx/core';
import { NT_DEPTH, SCREENS } from './layout-nt';
import type { NtCtx, NtLayer } from './layer';
import { ensureNtTexture } from './textures';

/** Sub-depths inside NT_DEPTH.screens (11 … 12; wallLights start at 12). */
const Z = {
  pic: NT_DEPTH.screens,
  patch: NT_DEPTH.screens + 0.1,
  tear: NT_DEPTH.screens + 0.2,
  lit: NT_DEPTH.screens + 0.3,
  frame: NT_DEPTH.screens + 0.5,
  plate: NT_DEPTH.screens + 0.6,
} as const;

/** Register the screens' atlas texture + frames once (boot step 27 and, as a fallback, the layer). */
export function ensureScreenTextures(scene: Phaser.Scene): void {
  const bake = screensBake();
  ensureNtTexture(scene, 'screens', NT_SCREENS_KEY, () => bake.canvas);
  const tex = scene.textures.get(NT_SCREENS_KEY);
  for (const [name, r] of Object.entries(bake.frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

/** A crop of the lit picture shown over the base picture. */
interface LitCrop {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A running reaction of one screen. */
interface Reaction {
  kind: 'hurt' | 'glad';
  start: number;
  until: number;
  power: number;
}

/** The names the plates show: the vs-CPU duel names the computer's side BİLGİSAYAR (as the HUD does). */
function plateNames(scene: Phaser.Scene): [string, string] {
  const names: [string, string] = ['OYUNCU 1', 'OYUNCU 2'];
  try {
    const d = scene.sys.settings.data as { mode?: string; botPlayer?: PlayerId } | undefined;
    if (d?.mode === 'vsBot') names[d.botPlayer ?? 1] = 'BİLGİSAYAR';
  } catch {
    /* no launch data (previews): the defaults */
  }
  return names;
}

export function createScreensLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureScreenTextures(scene);
  const bake = screensBake();
  const names = plateNames(scene);

  interface Screen {
    who: 0 | 1;
    px: number;
    py: number;
    pic: Phaser.GameObjects.Image;
    swayImg: Phaser.GameObjects.Image;
    patch: Phaser.GameObjects.Image;
    tear: Phaser.GameObjects.Image;
    litA: Phaser.GameObjects.Image;
    litB: Phaser.GameObjects.Image;
    frame: Phaser.GameObjects.Image;
    plate: Phaser.GameObjects.Rectangle[];
    text: Phaser.GameObjects.BitmapText;
    // last applied state (skip redundant Phaser calls)
    last: { frame: number; patch: string; sway: number; jx: number; litA: string; litB: string; tear: string; reveal: number; textTone: number };
    rx: Reaction | null;
    /** when the last summon sweep started (ms) or −1 */
    kick: number;
    /** power-on progress 0..PORTRAIT_H rows (−1 = dark) */
    rows: number;
  }

  const screens: Screen[] = ([0, 1] as const).map((who) => {
    const r = SCREENS[who];
    const px = r.x + PIC_AT.x;
    const py = r.y + PIC_AT.y;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => ctx.add(o);
    const img = (frame: string, z: number): Phaser.GameObjects.Image => add(scene.add.image(px, py, NT_SCREENS_KEY, frame).setOrigin(0).setDepth(z));
    const pic = img(picName(who), Z.pic);
    const swayImg = img(overlayName(who, 'swayP'), Z.patch).setVisible(false);
    const patch = img(overlayName(who, 'blink'), Z.patch + 0.05).setVisible(false);
    const tear = img(picName(who), Z.tear).setVisible(false);
    const litA = img(litName(who), Z.lit).setVisible(false);
    const litB = img(litName(who), Z.lit + 0.01).setVisible(false);
    const frame = add(scene.add.image(r.x, r.y, NT_SCREENS_KEY, frameName(who, false)).setOrigin(0).setDepth(Z.frame));

    // ---- name plate: a 1-px neon border round an ink field, the name in the player's tone
    const R = who === 0 ? RAMPS.cyan : RAMPS.crim;
    const tw = measureText(names[who], 'sm', undefined, false).w;
    const pw = tw + 7;
    const ph = 9;
    const plx = who === 0 ? px + 3 : px + PORTRAIT_W - 3 - pw;
    const ply = py + PORTRAIT_H - 3 - ph;
    const border = add(scene.add.rectangle(plx, ply, pw, ph, R[1]).setOrigin(0).setDepth(Z.plate));
    const field = add(scene.add.rectangle(plx + 1, ply + 1, pw - 2, ph - 2, PAL.ink).setOrigin(0).setDepth(Z.plate + 0.01));
    const m = textMetrics('sm', false);
    const text = add(pixelText(scene, plx + 4, ply + 1 + Math.floor((ph - 2 - m.capHeight) / 2) - m.capTop, names[who], { size: 'sm', color: R[3], outline: false }).setDepth(Z.plate + 0.02));
    return {
      who,
      px,
      py,
      pic,
      swayImg,
      patch,
      tear,
      litA,
      litB,
      frame,
      plate: [border, field],
      text,
      last: { frame: 0, patch: '', sway: 0, jx: 0, litA: '', litB: '', tear: '', reveal: -2, textTone: 3 },
      rx: null,
      kick: -1,
      rows: PORTRAIT_H,
    };
  });

  let now = 0;
  let active: PlayerId | null = null;
  /** game over: who won (the winner keeps smiling, the loser keeps wincing) */
  let over: PlayerId | null = null;
  /** power-on progress (rows drawn per screen); a lights-out screen is dark (−1) */
  let rising = false;
  let powerRun = 0;

  function react(who: 0 | 1, kind: Reaction['kind'], power: number): void {
    const ms = Math.round((kind === 'hurt' ? 420 : 640) * power);
    screens[who].rx = { kind, start: now, until: now + ms, power };
  }

  /** A column (5 px) of the lit picture, clipped to the picture; null when fully outside. */
  function column(x: number): LitCrop | null {
    const x0 = Math.max(0, x);
    const w = Math.min(PORTRAIT_W, x + 5) - x0;
    return w > 0 ? { key: `col${x}`, x: x0, y: 0, w, h: PORTRAIT_H } : null;
  }

  // ---- one screen, one tick
  function update(s: Screen, t: number): void {
    const { who } = s;
    const L = s.last;
    const rows = s.rows < 0 ? -1 : Math.floor(s.rows);

    // dark / drawing-in: the picture is revealed from the top, a bright lit edge under the last row
    if (rows < PORTRAIT_H) {
      if (L.reveal !== rows) {
        L.reveal = rows;
        s.pic.setVisible(rows > 0);
        if (rows > 0) s.pic.setCrop(0, 0, PORTRAIT_W, rows);
        const edge = rows > 0;
        s.litB.setVisible(edge);
        if (edge) s.litB.setCrop(0, Math.max(0, rows - 2), PORTRAIT_W, Math.min(2, rows)).setPosition(s.px, s.py + Math.max(0, rows - 2));
        for (const o of [s.litA, s.swayImg, s.patch, s.tear, s.text, ...s.plate]) o.setVisible(false);
        L.litA = L.litB = L.tear = '';
        L.patch = '#';
        L.sway = 9;
      }
      if (L.frame !== -1) {
        L.frame = -1;
        s.frame.setFrame(frameName(who, false));
      }
      return;
    }
    if (L.reveal !== PORTRAIT_H) {
      L.reveal = PORTRAIT_H;
      s.pic.setVisible(true).setCrop();
      s.text.setVisible(true);
      for (const o of s.plate) o.setVisible(true);
      L.frame = -1;
    }

    const rx = s.rx && t < s.rx.until ? s.rx : null;
    if (!rx) s.rx = null;
    const ago = rx ? t - rx.start : 0;

    // ---- jolt (whole pixels): a hit shakes the picture inside its frame
    const jx = rx && rx.kind === 'hurt' && ago < 160 ? [1, -1, 1, 0][Math.floor(ago / 40)] : 0;
    if (jx !== L.jx) {
      L.jx = jx;
      s.pic.setX(s.px + jx);
    }

    // ---- hair sway (still while the face winces)
    const sway = rx && rx.kind === 'hurt' ? 0 : swayAt(who, t);
    if (sway !== L.sway) {
      L.sway = sway;
      if (sway === 0) s.swayImg.setVisible(false);
      else s.swayImg.setFrame(overlayName(who, sway < 0 ? 'swayN' : 'swayP')).setVisible(true);
    }
    if (sway !== 0) {
      const at = bake.overlayAt[overlayName(who, sway < 0 ? 'swayN' : 'swayP')];
      s.swayImg.setPosition(s.px + at.x + jx, s.py + at.y);
    }

    // ---- mood patch: the reaction face (game over: held), else a blink
    let mood: ScreenOverlayKind | '' = '';
    if (over !== null) mood = over === who ? 'glad' : 'hurt';
    else if (rx) mood = rx.kind;
    else if (blinkAt(who, t)) mood = 'blink';
    if (mood !== L.patch) {
      L.patch = mood;
      if (mood === '') s.patch.setVisible(false);
      else s.patch.setFrame(overlayName(who, mood)).setVisible(true);
    }
    if (mood !== '') {
      const at = bake.overlayAt[overlayName(who, mood)];
      s.patch.setPosition(s.px + at.x + jx, s.py + at.y);
    }

    // ---- lit overlays. A: hit flash / heal bands / summon sweep / flicker / idle sweep column; B: the scan row
    let a: LitCrop | null = null;
    if (rx && rx.kind === 'hurt' && ago < 70) a = { key: 'flash', x: 0, y: 0, w: PORTRAIT_W, h: PORTRAIT_H };
    else if (rx && rx.kind === 'glad') {
      // a lit band climbs the picture, then another (6 px high, ≈ 260 ms per pass)
      const y = Math.round((PORTRAIT_H - 6) * (1 - (ago % 260) / 260));
      a = { key: `band${y}`, x: 0, y, w: PORTRAIT_W, h: 6 };
    } else if (s.kick >= 0 && t - s.kick < 360) a = column(Math.round(-5 + ((PORTRAIT_W + 5) * (t - s.kick)) / 360));
    else if (flickerAt(who, t)) a = { key: 'flash', x: 0, y: 0, w: PORTRAIT_W, h: PORTRAIT_H };
    else {
      const x = sweepAt(who, t);
      if (x !== null) a = column(x);
    }
    const aKey = a ? a.key : '';
    if (aKey !== L.litA) {
      L.litA = aKey;
      if (!a) s.litA.setVisible(false);
      else s.litA.setCrop(a.x, a.y, a.w, a.h).setVisible(true);
    }
    if (a) s.litA.setPosition(s.px + a.x + (a.key === 'flash' ? jx : 0), s.py + a.y);

    const row = scanAt(who, t);
    if (`r${row}` !== L.litB) {
      L.litB = `r${row}`;
      s.litB.setCrop(0, row, PORTRAIT_W, 1).setPosition(s.px, s.py + row).setVisible(true);
    }

    // ---- tear: a band slipped sideways (idle: rare; big hit and the loser at game over: stronger)
    let tr = tearAt(who, t);
    if (rx && rx.kind === 'hurt' && rx.power > 1.2 && ago >= 40 && ago < 170) tr = { y: 14 + (Math.floor(ago / 40) % 3) * 11, h: 5, dx: ago < 100 ? 3 : -2 };
    if (over !== null && over !== who && Math.floor(t / 90) % 11 === 0) tr = { y: 10 + (Math.floor(t / 990) % 4) * 11, h: 4, dx: 3 };
    const tKey = tr ? `${tr.y}:${tr.h}:${tr.dx}` : '';
    if (tKey !== L.tear) {
      L.tear = tKey;
      if (!tr) s.tear.setVisible(false);
      else s.tear.setCrop(0, tr.y, PORTRAIT_W, tr.h).setPosition(s.px + tr.dx, s.py + tr.y).setVisible(true);
    }

    // ---- frame: the active side's neon is bright, the inactive one breathes, a reaction goes hot
    const fk = active === who || breathAt(who, t) || !!rx || over === who ? 1 : 0;
    if (fk !== L.frame) {
      L.frame = fk;
      s.frame.setFrame(frameName(who, fk === 1));
    }
    // the name plate's text one tone up on the active side
    const tone = active === who ? 4 : 3;
    if (tone !== L.textTone) {
      L.textTone = tone;
      s.text.setTint((who === 0 ? RAMPS.cyan : RAMPS.crim)[tone]);
    }
  }

  /** Lights out → dark frames; lights on → the pictures are drawn in (~0.4 s). */
  function setPower(on: boolean, animate: boolean): Promise<void> {
    const run = ++powerRun;
    if (!on) {
      for (const s of screens) s.rows = -1;
      rising = false;
      return Promise.resolve();
    }
    for (const s of screens) s.rows = animate ? 0 : PORTRAIT_H;
    if (!animate) {
      rising = false;
      return Promise.resolve();
    }
    // the picture starts after the floor lines are lit (~160 ms), then 0.36 s of drawing-in
    return wait(scene, 160)
      .then(() => {
        if (run === powerRun) rising = true;
        return wait(scene, 360);
      })
      .then(() => undefined);
  }

  return {
    name: 'screens',
    owner: 'B2',
    tick(dt: number, t: number): void {
      now = t;
      if (rising) {
        let busy = false;
        for (const s of screens)
          if (s.rows >= 0 && s.rows < PORTRAIT_H) {
            s.rows = Math.min(PORTRAIT_H, s.rows + (dt * PORTRAIT_H) / 360);
            busy = busy || s.rows < PORTRAIT_H;
          }
        rising = busy;
      }
      for (const s of screens) update(s, t);
    },
    setLights(on: boolean, animate: boolean): Promise<void> {
      return setPower(on, animate);
    },
    setActivePlayer(p: PlayerId | null): void {
      active = p;
    },
    onGameEvent(ev: GameEvent): void {
      switch (ev.type) {
        case 'damage':
          react(ev.player, 'hurt', ev.amount >= 2000 ? 1.7 : ev.amount >= 1000 ? 1.3 : 1);
          break;
        case 'lpGain':
          react(ev.player, 'glad', 1);
          break;
        case 'summon':
          screens[ev.player].kick = now;
          break;
        case 'gameOver':
          over = ev.winner;
          break;
        default:
          break;
      }
    },
    destroy(): void {
      /* objects are owned by the view (ctx.add) */
    },
  };
}

