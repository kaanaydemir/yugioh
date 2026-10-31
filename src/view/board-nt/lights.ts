// Neon Tower layer: LIGHTS — owner C (docs/v3/ARENA_NEON_TOWER.md §11). Subtle, flat, STEPPED light over the dark hall:
// no bloom, no lens flares, no alpha glow. Two kinds of light, both in the v3 look's own language:
//
//  1. FLOOR light on the slots — the existing stepped light (src/view/light, `addLight`): a blue pool over the player's half
//     and a crimson one over the opponent's, one palette step up on the slot interiors, dithered at the rim. They ignite with
//     the floodlights, rest one step higher on the side to move, and swell with a summon / roar of their side.
//  2. STIPPLE light on everything that is not a slot (this file + src/art/arena-nt/lights.ts): pre-baked ordered-dither
//     stamps in ONE palette tone each (setTint on white texels), faded through three density steps:
//       ceiling spot CONES under the four lamp fixtures · floor POOLS under the two hologram plinths and in front of the two
//       grandstands · a HALO of light around each portrait screen bay · the contact GLOW on the hall floor along the platform's
//       two near faces (blue left, crimson right) — plus the lamp lenses warming up.
//
// Everything runs on the arena clock (tick): a few swell loops with their own periods and phases (calm: each element is lit
// one step most of the time and a second step for a moment), the side-to-move one step brighter, short reactions fed by the
// game events (summon: the side's lights rise and settle · attack declared: a burst in the attacker's colour on its tile and
// the side's cones flare · big damage: the lights of that side dip for a beat, the attacker's side surges · game over: the winner
// stands in full light). REDUCED_MOTION: no swell, no pulses — every element rests at its base step (the ignition still plays).
// Nothing here is ever drawn over a slot, a card, a unit or the HUD: depths are all below the platform (≤ 19.5).

import type Phaser from 'phaser';
import {
  CONES,
  HALO_M,
  LIGHT_LEVELS,
  NT_LIGHTS_KEY,
  POOLS,
  type LightsBake,
  bakeLights,
  coneBox,
  lightFrame,
} from '../../art/arena-nt/lights';
import { NT_WALL_KEY, WALL_Z } from '../../art/arena-nt/wall';
import { PAL } from '../../art/palette';
import { addLight, attributeLightColor, lightFlash, type LightHandle } from '../light';
import type { Attribute } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { zoneXY } from '../layout';
import { REDUCED_MOTION } from '../v3/motion';
import type { CrowdReaction } from './api';
import { HOLOS, NT_DEPTH, SCREENS } from './layout-nt';
import { type NtCtx, type NtEventInfo, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;
type Side = 0 | 1;

let bakeCache: LightsBake | null = null;
function lightsBake(): LightsBake {
  return (bakeCache ??= bakeLights());
}

/** Register the lights atlas once (boot step 31 and, as a fallback, the layer). */
export function ensureLightsTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'lights', NT_LIGHTS_KEY, () => lightsBake().canvas);
  const tex = scene.textures.get(NT_LIGHTS_KEY);
  for (const [name, r] of Object.entries(lightsBake().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

// ---------------------------------------------------------------------------------------------- placement

/** The four ceiling lamp fixtures (src/art/arena-nt/wall.ts: 12 × 10 at y 3): the lens centre is x + 6, the beam leaves at y 13. */
const LAMPS: readonly { x: number; side: Side; shape: 0 | 1; flip: boolean }[] = [
  { x: 98, side: 0, shape: 0, flip: false },
  { x: 122, side: 0, shape: 1, flip: false },
  { x: 440, side: 1, shape: 1, flip: true },
  { x: 466, side: 1, shape: 0, flip: true },
];
const LAMP_Y = 3;
const LAMP_BEAM_Y = 13;

/** Side tones (palette): the stipple of each element is ONE of these. */
const TONE = {
  cone: [PAL.cyan0, PAL.crim0],
  pool: [PAL.cyan1, PAL.void2],
  stand: [PAL.cyan0, PAL.crim0],
  halo: [PAL.cyan0, PAL.crim0],
} as const;

/** Floor pools in front of the grandstands (centres in screen px). */
const STAND_POOLS: readonly { cx: number; cy: number }[] = [
  { cx: 86, cy: 238 },
  { cx: 556, cy: 252 },
];

interface El {
  side: Side;
  /** Resting step (1…3) and how long its swell loop is / where in it the element starts (ms, 0…1). */
  base: number;
  period: number;
  phase: number;
  /** Ignition delay after the floodlights come on (ms). */
  delay: number;
  /** Peak extra step of the swell (0 = none). */
  swell: number;
  /** The reaction weight: how strongly this element answers the side's pulses (0…1). */
  react: number;
  show(level: number): void;
  last: number;
}

export function createLightsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureLightsTextures(scene);
  const bake = lightsBake();
  const els: El[] = [];
  const add = (e: Omit<El, 'last'>): void => {
    els.push({ ...e, last: -1 });
  };
  const imgLevel = (img: Img, frame: (l: number) => string) => (l: number) => {
    if (l <= 0) img.setVisible(false);
    else img.setFrame(frame(l)).setVisible(true);
  };

  // ---- ceiling cones (under the lamps, over the wall panels, under the screens / decor props)
  const lampLens: Img[] = [];
  LAMPS.forEach((L, i) => {
    const cb = coneBox(CONES[L.shape]);
    const apexX = L.x + 6;
    const x = L.flip ? apexX - (cb.w - cb.ax) : apexX - cb.ax;
    const img = ctx.add(scene.add.image(x, LAMP_BEAM_Y, NT_LIGHTS_KEY, lightFrame.cone(L.shape, 1)).setOrigin(0).setDepth(WALL_Z.decor + 0.04).setFlipX(L.flip).setTint(TONE.cone[L.side]).setVisible(false));
    add({ side: L.side, base: 1, period: 6100 + i * 1370, phase: (i * 0.29) % 1, delay: 220 + i * 190, swell: 1, react: 1, show: imgLevel(img, (l) => lightFrame.cone(L.shape, l)) });
    // the lens warms up with its cone (the wall painted the dim glass; this is the lit twin)
    const lens = ctx.add(scene.add.image(L.x, LAMP_Y, NT_WALL_KEY, 'lamp:1').setOrigin(0).setDepth(WALL_Z.decor + 0.06).setVisible(false));
    lampLens.push(lens);
  });

  // ---- hologram floor pools (under the plinth, over the hall floor)
  HOLOS.forEach((h, i) => {
    const s = POOLS[0];
    const img = ctx.add(
      scene.add.image(h.pedestal.cx - s.rx, h.pedestal.cy + 3 - s.ry, NT_LIGHTS_KEY, lightFrame.pool(0, 1)).setOrigin(0).setDepth(WALL_Z.socle - 0.05).setTint(TONE.pool[i]).setVisible(false),
    );
    add({ side: h.side, base: 1, period: 4300 + i * 1100, phase: 0.2 + i * 0.37, delay: 700 + i * 160, swell: 1, react: 1, show: imgLevel(img, (l) => lightFrame.pool(0, l)) });
  });

  // ---- floor pools in front of the stands
  STAND_POOLS.forEach((p, i) => {
    const s = POOLS[1];
    const img = ctx.add(scene.add.image(p.cx - s.rx, p.cy - s.ry, NT_LIGHTS_KEY, lightFrame.pool(1, 1)).setOrigin(0).setDepth(WALL_Z.floorProp + 0.01).setTint(TONE.stand[i]).setVisible(false));
    add({ side: i as Side, base: 1, period: 7300 + i * 900, phase: 0.55 - i * 0.3, delay: 900 + i * 120, swell: 1, react: 0.6, show: imgLevel(img, (l) => lightFrame.pool(1, l)) });
  });

  // ---- screen halos (a frame of light around each bay, over the panels, under the bay itself)
  SCREENS.forEach((r, i) => {
    const img = ctx.add(
      scene.add.image(r.x - 4 - HALO_M, r.y - 4 - HALO_M, NT_LIGHTS_KEY, lightFrame.halo(1)).setOrigin(0).setDepth(WALL_Z.panel + 0.12).setTint(TONE.halo[i]).setVisible(false),
    );
    // (the bay is the screen frame + 4 px on every side)
    add({ side: i as Side, base: 1, period: 5200 + i * 1700, phase: 0.4 + i * 0.23, delay: 550 + i * 140, swell: 1, react: 0.8, show: imgLevel(img, (l) => lightFrame.halo(l)) });
  });

  // ---- contact glow on the hall floor along the near faces (two blitters of baked sparse tiles)
  const edgeBlit: Phaser.GameObjects.Blitter[] = [0, 1].map((s) => ctx.add(scene.add.blitter(0, 0, NT_LIGHTS_KEY).setDepth(NT_DEPTH.shadow + 0.5).setVisible(false)));
  const edgeBobs: { side: Side; bob: Phaser.GameObjects.Bob; frames: readonly string[] }[] = [];
  for (const t of bake.tiles) edgeBobs.push({ side: t.side, bob: edgeBlit[t.side].create(t.x, t.y, t.frames.find((f) => f) as string), frames: t.frames });
  for (const s of [0, 1] as const)
    add({
      side: s,
      base: 1,
      period: 5600 + s * 1900,
      phase: 0.1 + s * 0.45,
      delay: 1000 + s * 180,
      swell: 1,
      react: 1,
      show: (l) => {
        edgeBlit[s].setVisible(l > 0);
        if (l <= 0) return;
        for (const e of edgeBobs) if (e.side === s) e.bob.setFrame(e.frames[l] || e.frames.find((f) => f) || e.frames[3]);
      },
    });

  // ---- the stepped floor light on the slots (LightLayer: pads only; lit one step at the core, dithered at the rim)
  const floor: LightHandle[] = [];
  const poolAt = (p: PlayerId): { x: number; y: number } => {
    const a = zoneXY(p, 'monster', 2);
    const b = zoneXY(p, 'spellTrap', 2);
    return { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
  };
  const FLOOR_K = 0.5;
  // J1: the two big flood ellipses (rx 150) overlapped across the middle (a crimson wedge over the blue half) and, at half density, dithered
  // every tile. The side tints now live in the slot art (src/art/arena-nt/floor.ts); the stepped sampler itself stays for flashes / volcano.
  const FLOOR_POOLS = false;
  try {
    for (const p of FLOOR_POOLS ? ([0, 1] as const) : []) {
      const c = poolAt(p);
      const h = addLight(scene, { x: c.x, y: c.y, radius: 150, ry: 74, color: p === 0 ? PAL.cyan3 : PAL.crim3, intensity: 0, group: 'flood', anim: 'steady' });
      floor.push(h);
    }
    for (const l of lampLens) l.setVisible(true);
  } catch (e) {
    console.error('[arena-nt] floor light failed', e);
  }

  // ---- state
  let lights = true;
  // lit from the start (a caller that wants the ignition calls setLights(false, false) then setLights(true, true))
  let onAt = -5000;
  let now = 0;
  let active: PlayerId | null = null;
  /** side → reaction: from, ms, peak steps (+ = brighter, − = dip). */
  const pulse: ({ t0: number; ms: number; amt: number } | null)[] = [null, null];
  let floorShown = -1;
  let lensOn = true;

  const startPulse = (side: Side, amt: number, ms: number): void => {
    if (REDUCED_MOTION || !lights) return;
    const cur = pulse[side];
    // a stronger / newer reaction replaces a weaker one that is still running
    if (cur && now - cur.t0 < cur.ms && Math.abs(cur.amt) > Math.abs(amt)) return;
    pulse[side] = { t0: now, ms, amt };
  };
  /** Extra steps a pulse adds at time t: the peak for the first third, one less for the second, then gone. */
  const pulseAt = (side: Side, t: number): number => {
    const p = pulse[side];
    if (!p) return 0;
    const k = (t - p.t0) / p.ms;
    if (k < 0 || k >= 1) {
      pulse[side] = null;
      return 0;
    }
    if (p.amt < 0) return k < 0.6 ? p.amt : 0;
    return k < 0.34 ? p.amt : k < 0.7 ? Math.max(0, p.amt - 1) : 0;
  };
  const frac = (v: number): number => ((v % 1) + 1) % 1;

  const target = (e: El, t: number): number => {
    if (!lights) return 0;
    const k = t - onAt - e.delay;
    if (k < 0) return 0;
    let lv = e.base;
    if (!REDUCED_MOTION && e.swell > 0) {
      const u = frac(t / e.period + e.phase);
      lv += u < 0.46 || u >= 0.78 ? 0 : e.swell;
    }
    if (active === e.side) lv += 1;
    if (!REDUCED_MOTION) lv += Math.round(pulseAt(e.side, t) * e.react);
    lv = Math.max(1, Math.min(LIGHT_LEVELS, lv));
    // the ignition: one density step per 130 ms up to the target
    return Math.min(lv, 1 + Math.floor(k / 130));
  };

  const setFloor = (k: number, ms: number): void => {
    for (const h of floor) h.setIntensity(k, ms);
  };

  const burst = (p: PlayerId, zone: number, color: number): void => {
    if (REDUCED_MOTION) return;
    const c = zoneXY(p, 'monster', zone);
    void lightFlash(scene, c.x, c.y, color, 34, 240, { floorY: c.y });
  };

  const debug = { levels: (): number[] => els.map((e) => e.last), pulse: (s: Side, amt = 2, ms = 500): void => startPulse(s, amt, ms), floor: (): number => floorShown };
  const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
  if (neon) neon.ntLights = debug;

  return {
    name: 'lights',
    owner: 'C',
    setActivePlayer(p) {
      active = p;
    },
    setLights(on, animate) {
      lights = on;
      if (on) onAt = now + (animate ? 0 : -5000);
      else for (const e of els) e.show((e.last = 0));
      lensOn = on && !animate;
      for (const l of lampLens) l.setVisible(lensOn);
      floorShown = -1;
      if (!on) setFloor(0, animate ? 300 : 0);
      else if (!animate) setFloor(FLOOR_K, 0);
      return Promise.resolve();
    },
    crowd(kind: CrowdReaction, side: PlayerId | null, power: number) {
      if (side === null) return;
      const p = Math.max(0.5, Math.min(2, power));
      if (kind === 'roar') startPulse(side, p >= 1.5 ? 3 : 2, 900);
      else if (kind === 'cheer') startPulse(side, 1, 420);
      else startPulse(side, -1, 240);
    },
    onGameEvent(ev: GameEvent, info?: NtEventInfo) {
      switch (ev.type) {
        case 'summon': {
          const big = ev.method === 'tribute' || ev.method === 'special';
          startPulse(ev.player, big ? 2 : 1, big ? 640 : 480);
          break;
        }
        case 'attackDeclare': {
          startPulse(ev.player, 1, 360);
          const attr = info?.attackerAttribute ?? null;
          burst(ev.player, ev.attackerZone, attr ? attributeLightColor(attr as Attribute) : ev.player === 0 ? PAL.cyan3 : PAL.crim3);
          break;
        }
        case 'damage':
          if (ev.amount >= 500 && ev.source === 'battle') {
            startPulse(ev.player, -1, 260);
            startPulse(ev.player === 0 ? 1 : 0, ev.amount >= 1500 ? 2 : 1, 420);
          }
          break;
        case 'destroy':
          if (ev.location === 'monster') startPulse(ev.player, -1, 200);
          break;
        case 'gameOver':
          startPulse(ev.winner, 3, 2400);
          break;
        default:
          break;
      }
    },
    tick(_dt, t) {
      now = t;
      if (lights && !lensOn && t - onAt >= 360) {
        for (const l of lampLens) l.setVisible(true);
        lensOn = true;
      }
      for (const e of els) {
        const lv = target(e, t);
        if (lv !== e.last) {
          e.last = lv;
          e.show(lv);
        }
      }
      // the slots' floor pools: ignite with the floodlights, one swell step up on the side to move / reacting
      if (lights && t - onAt >= 900 && floor.length) {
        const k = (p: PlayerId): number => FLOOR_K * (active === p ? 1.5 : 1) + (REDUCED_MOTION ? 0 : 0.12 * pulseAt(p, t));
        const sig = Math.round(k(0) * 100) * 1000 + Math.round(k(1) * 100);
        if (sig !== floorShown) {
          floorShown = sig;
          floor[0]?.setIntensity(k(0), 220);
          floor[1]?.setIntensity(k(1), 220);
        }
      }
    },
    destroy() {
      for (const h of floor) h.destroy();
      floor.length = 0;
      const n = (globalThis as { __neon?: Record<string, unknown> }).__neon;
      if (n && n.ntLights === debug) delete n.ntLights;
    },
  };
}
