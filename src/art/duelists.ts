// Duelist avatars — the two players standing on their podiums behind the back rows
// (layout.duelistXY). Code-drawn pixel art, readable at 1×.
//
//   P1 (id 0): cyan-coated hero — spiky brown hair, long cyan coat, cyan duel disk.
//   P2 (id 1): crimson-coated rival — swept silver hair, high-collared crimson coat, crimson disk.
//
// Both wear a glowing duel disk on the LEFT forearm (the near arm, since they face right).
// BOTH ARE DRAWN FACING RIGHT. The view mirrors player 2 (sprite.setFlipX(true) with the
// origin mirrored: originX = 1 - DUELIST_ANCHOR.x / DUELIST_W), so the two face each other
// across the board — see src/duel/DuelistView.ts.
//
// Textures: `duelist:<p>` (frames '<anim>:<i>'), animations `duelist:<p>:<anim>`:
//   idle     8f @ 7 fps loop — breathing, coat-tail flutter, disk glow pulse
//   command  6f @ 12 fps     — wind-up, thrust the disk arm forward (summons / attacks), hold, ease
//   hurt     4f @ 10 fps     — recoil when taking damage, eyes shut, then recover
//   defeat   6f @ 8 fps      — stagger, knees buckle, kneel with the head down (hold last frame)
//   victory  6f @ 10 fps     — dip, fist thrust up, coat flares (hold last frame, fist up)
// Textures + animations are built by src/boot/25-cutins.ts from duelistFrame().

import type { PlayerId } from '../engine/types';
import { PAL } from './palette';
import { PixelCanvas } from './pixel';

export type DuelistAnim = 'idle' | 'command' | 'hurt' | 'defeat' | 'victory';
export const DUELIST_ANIMS: DuelistAnim[] = ['idle', 'command', 'hurt', 'defeat', 'victory'];

/** Frame size (all frames). */
export const DUELIST_W = 32;
export const DUELIST_H = 40;
/** Ground point between the feet (frame px) — placed on layout.duelistXY. */
export const DUELIST_ANCHOR = { x: 13, y: 39 };
export const DUELIST_ANCHOR_X = DUELIST_ANCHOR.x;
export const DUELIST_ANCHOR_Y = DUELIST_ANCHOR.y;
/** Where the duel disk sits in the idle pose (frame px, facing right) — glow / card-launch point. */
export const DUELIST_DISK = { x: 19, y: 25 };
/** Chest point (frame px) in the idle pose. */
export const DUELIST_CHEST = { x: 13, y: 20 };

export const DUELIST_SPECS: Record<DuelistAnim, { frames: number; fps: number; loop: boolean }> = {
  idle: { frames: 8, fps: 7, loop: true },
  command: { frames: 6, fps: 12, loop: false },
  hurt: { frames: 4, fps: 10, loop: false },
  defeat: { frames: 6, fps: 8, loop: false },
  victory: { frames: 6, fps: 10, loop: false },
};

export function duelistTextureKey(p: PlayerId): string {
  return `duelist:${p}`;
}

export function duelistAnimKey(p: PlayerId, anim: DuelistAnim): string {
  return `duelist:${p}:${anim}`;
}

export function duelistFrameName(anim: DuelistAnim, frame: number): string {
  return `${anim}:${frame}`;
}

// ================================================================== looks

interface Look {
  coat: [number, number, number, number]; // shadow, base, light, trim
  coatIn: number; // lining
  shirt: number;
  shirtHi: number;
  pants: number;
  pantsHi: number;
  boots: number;
  bootsHi: number;
  hair: [number, number, number]; // dark, mid, light
  glow: [number, number, number]; // disk glow dim, mid, hot
  /**
   * Head stamps (10×10, facing right). 1/2/3 hair dark/mid/light · s skin · S skin shade ·
   * e eye · w eye light · b brow · m mouth (open variant only) · n nose shade.
   * `head` normal, `shut` eyes closed, `shout` mouth open, `down` head bowed.
   */
  heads: Record<'head' | 'shut' | 'shout' | 'down', string[]>;
  /** rival: high coat collar */
  collar: boolean;
}

const LOOKS: Record<PlayerId, Look> = {
  0: {
    coat: [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4],
    coatIn: PAL.night2,
    shirt: PAL.night2,
    shirtHi: PAL.night3,
    pants: PAL.night2,
    pantsHi: PAL.night3,
    boots: PAL.night1,
    bootsHi: PAL.steel,
    hair: [PAL.earth0, PAL.earth2, PAL.earth3],
    glow: [PAL.cyan2, PAL.cyan3, PAL.cyan4],
    // spiky shonen hair: spikes up and back
    heads: {
      head: ['..3..3....', '.323323.3.', '1222222232', '1222222222', '12222b2b2.', '1222sswes.', '.122ssssss', '.12Ssssss.', '..1SSsss..', '....SS....'],
      shut: ['..3..3....', '.323323.3.', '1222222232', '1222222222', '12222b2b2.', '1222sssSs.', '.122ssssss', '.12Ssssss.', '..1SSsss..', '....SS....'],
      shout: ['..3..3....', '.323323.3.', '1222222232', '1222222222', '12222bbb2.', '1222sswes.', '.122ssssss', '.12Sssmms.', '..1SSsms..', '....SS....'],
      down: ['..........', '..3..3....', '.323323.3.', '1222222232', '1222222222', '122222222.', '1222ssS22.', '.122sSssS.', '..1SSssS..', '....SS....'],
    },
    collar: false,
  },
  1: {
    coat: [PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4],
    coatIn: PAL.night1,
    shirt: PAL.night1,
    shirtHi: PAL.night2,
    pants: PAL.night1,
    pantsHi: PAL.night2,
    boots: PAL.night0,
    bootsHi: PAL.night3,
    hair: [PAL.steel, PAL.mist, PAL.white],
    glow: [PAL.crim2, PAL.crim3, PAL.crim4],
    // swept-back silver hair with a long fringe
    heads: {
      head: ['...1111...', '.11222211.', '1223333221', '122222222.', '12222bb2..', '122ssswes.', '.12sssssss', '.1Ssssss..', '..SSsss...', '...SS.....'],
      shut: ['...1111...', '.11222211.', '1223333221', '122222222.', '12222bb2..', '122sssSSs.', '.12sssssss', '.1Ssssss..', '..SSsss...', '...SS.....'],
      shout: ['...1111...', '.11222211.', '1223333221', '122222222.', '12222bbb..', '122ssswes.', '.12sssssss', '.1Ssssmm..', '..SSssm...', '...SS.....'],
      down: ['..........', '...1111...', '.11222211.', '1223333221', '122222222.', '12222222..', '122sssS2..', '.12ssSssS.', '..SSssS...', '...SS.....'],
    },
    collar: true,
  },
};

// ================================================================== rig

type Pt = [number, number];

interface Pose {
  /** hip position (frame px) */
  hip: Pt;
  /** torso lean (px the shoulders shift right of the hip) */
  lean: number;
  /** torso length (hip → neck) */
  torso: number;
  /** head offset from the neck + tilt (-1 down/back, 0, 1 up) */
  head: Pt;
  headTilt: number;
  /** eyes: 'open' | 'shut' | 'fierce'; mouth open? */
  eyes: 'open' | 'shut' | 'fierce';
  mouth: boolean;
  /** near (disk) arm: elbow and hand offsets from the shoulder */
  nElbow: Pt;
  nHand: Pt;
  /** far arm */
  fElbow: Pt;
  fHand: Pt;
  /** feet (frame px) and knees offsets */
  nFoot: Pt;
  fFoot: Pt;
  nKnee: Pt;
  fKnee: Pt;
  /** coat hem flutter: back-tail offset (x, y) and hem wave phase */
  tail: Pt;
  wave: number;
  /** disk glow 0 dim, 1 lit, 2 flash */
  glow: number;
  /** a fist (closed hand) on the near arm */
  fist?: boolean;
}

const BASE: Pose = {
  hip: [13, 27],
  lean: 0,
  torso: 10,
  head: [0, 0],
  headTilt: 0,
  eyes: 'open',
  mouth: false,
  nElbow: [1, 5],
  nHand: [4, 9],
  fElbow: [-2, 5],
  fHand: [-1, 9],
  nFoot: [16, 39],
  fFoot: [10, 39],
  nKnee: [15, 33],
  fKnee: [11, 33],
  tail: [0, 0],
  wave: 0,
  glow: 1,
};

const pose = (o: Partial<Pose>): Pose => ({ ...BASE, ...o });

function framePose(anim: DuelistAnim, f: number): Pose {
  switch (anim) {
    case 'idle': {
      // breathing: shoulders rise on frames 2–5; hem flutters through the loop
      const br = [0, 0, 1, 1, 1, 1, 0, 0][f];
      return pose({
        torso: 10 + br,
        hip: [13, 27],
        nHand: [4, 9 - br],
        fHand: [-1, 9 - br],
        wave: f / 8,
        tail: [Math.round(Math.sin((f / 8) * Math.PI * 2) * 1), 0],
        glow: f === 3 || f === 4 ? 2 : 1,
      });
    }
    case 'command': {
      const P: Pose[] = [
        // wind-up: lean back, disk arm cocked back across the chest
        pose({ lean: -1, nElbow: [-2, 4], nHand: [1, 3], fElbow: [-3, 4], fHand: [-3, 8], tail: [1, 0], wave: 0.1, glow: 1 }),
        // THRUST: lean in, arm fully extended, coat tails whip back
        pose({ lean: 2, hip: [13, 27], nElbow: [5, 1], nHand: [10, 0], fElbow: [-3, 4], fHand: [-5, 6], tail: [-3, -1], wave: 0.3, glow: 2, mouth: true, eyes: 'fierce', nFoot: [17, 39], nKnee: [16, 33] }),
        pose({ lean: 2, nElbow: [5, 1], nHand: [10, -1], fElbow: [-3, 4], fHand: [-5, 6], tail: [-2, -1], wave: 0.45, glow: 2, mouth: true, eyes: 'fierce', nFoot: [17, 39], nKnee: [16, 33] }),
        pose({ lean: 2, nElbow: [5, 1], nHand: [10, 0], fElbow: [-3, 4], fHand: [-4, 7], tail: [-2, 0], wave: 0.6, glow: 2, eyes: 'fierce', nFoot: [17, 39], nKnee: [16, 33] }),
        pose({ lean: 1, nElbow: [4, 3], nHand: [8, 4], tail: [-1, 0], wave: 0.75, glow: 1, eyes: 'fierce' }),
        pose({ lean: 0, nElbow: [2, 5], nHand: [5, 8], tail: [0, 0], wave: 0.9, glow: 1 }),
      ];
      return P[f];
    }
    case 'hurt': {
      const P: Pose[] = [
        pose({ lean: -3, hip: [12, 27], head: [-1, 1], headTilt: -1, eyes: 'shut', mouth: true, nElbow: [3, 2], nHand: [5, -2], fElbow: [-4, 3], fHand: [-6, 6], tail: [3, -1], wave: 0.2, glow: 0, nFoot: [15, 39], nKnee: [14, 33] }),
        pose({ lean: -2, hip: [12, 27], head: [-1, 0], headTilt: -1, eyes: 'shut', nElbow: [2, 3], nHand: [5, 1], fElbow: [-3, 4], fHand: [-5, 7], tail: [2, 0], wave: 0.4, glow: 1, nFoot: [15, 39], nKnee: [14, 33] }),
        pose({ lean: -1, head: [0, 0], nElbow: [1, 4], nHand: [5, 6], tail: [1, 0], wave: 0.6, glow: 1 }),
        pose({ wave: 0.8 }),
      ];
      return P[f];
    }
    case 'defeat': {
      const P: Pose[] = [
        pose({ lean: -2, hip: [12, 27], head: [-1, 1], headTilt: -1, eyes: 'shut', mouth: true, nElbow: [2, 4], nHand: [4, 5], fElbow: [-3, 4], fHand: [-4, 8], tail: [2, 0], glow: 0 }),
        pose({ lean: 0, hip: [12, 30], head: [0, 1], headTilt: -1, eyes: 'shut', nElbow: [2, 5], nHand: [3, 9], fElbow: [-2, 5], fHand: [-2, 9], nKnee: [16, 35], fKnee: [10, 35], tail: [1, 1], glow: 0 }),
        pose({ lean: 2, hip: [12, 32], head: [1, 2], headTilt: -1, eyes: 'shut', nElbow: [2, 5], nHand: [4, 8], fElbow: [-1, 5], fHand: [0, 9], nKnee: [17, 34], nFoot: [17, 39], fKnee: [10, 38], fFoot: [6, 39], tail: [0, 2], glow: 0 }),
        pose({ lean: 3, hip: [12, 33], head: [1, 3], headTilt: -1, eyes: 'shut', nElbow: [2, 5], nHand: [5, 7], fElbow: [0, 5], fHand: [1, 9], nKnee: [18, 34], nFoot: [17, 39], fKnee: [10, 38], fFoot: [5, 39], tail: [0, 3], glow: 0 }),
        pose({ lean: 3, hip: [12, 33], head: [1, 3], headTilt: -1, eyes: 'shut', nElbow: [2, 5], nHand: [5, 7], fElbow: [0, 5], fHand: [1, 9], nKnee: [18, 34], nFoot: [17, 39], fKnee: [10, 38], fFoot: [5, 39], tail: [0, 3], glow: 0, wave: 0.5 }),
        pose({ lean: 3, hip: [12, 33], head: [1, 3], headTilt: -1, eyes: 'shut', nElbow: [2, 5], nHand: [5, 7], fElbow: [0, 5], fHand: [1, 9], nKnee: [18, 34], nFoot: [17, 39], fKnee: [10, 38], fFoot: [5, 39], tail: [0, 3], glow: 0, wave: 0.7 }),
      ];
      return P[f];
    }
    case 'victory': {
      const P: Pose[] = [
        pose({ hip: [13, 28], torso: 9, head: [0, 1], nElbow: [1, 5], nHand: [3, 7], nKnee: [16, 34], fKnee: [10, 34], glow: 1, fist: true }),
        pose({ hip: [13, 27], lean: 1, nElbow: [4, -1], nHand: [8, -5], tail: [-1, 0], wave: 0.2, glow: 2, fist: true, eyes: 'fierce' }),
        pose({ hip: [13, 26], torso: 11, lean: 0, head: [0, -1], headTilt: 1, nElbow: [5, -4], nHand: [7, -12], tail: [-3, -2], wave: 0.4, glow: 2, fist: true, mouth: true, eyes: 'fierce', nFoot: [17, 39], fFoot: [9, 39] }),
        pose({ hip: [13, 26], torso: 11, head: [0, -1], headTilt: 1, nElbow: [5, -4], nHand: [7, -12], tail: [-2, -1], wave: 0.6, glow: 2, fist: true, mouth: true, eyes: 'fierce', nFoot: [17, 39], fFoot: [9, 39] }),
        pose({ hip: [13, 26], torso: 11, head: [0, -1], headTilt: 1, nElbow: [5, -4], nHand: [7, -12], tail: [-3, -1], wave: 0.8, glow: 2, fist: true, eyes: 'fierce', nFoot: [17, 39], fFoot: [9, 39] }),
        pose({ hip: [13, 26], torso: 11, head: [0, -1], headTilt: 1, nElbow: [5, -4], nHand: [7, -12], tail: [-2, -1], wave: 0.95, glow: 2, fist: true, eyes: 'fierce', nFoot: [17, 39], fFoot: [9, 39] }),
      ];
      return P[f];
    }
  }
}

// ================================================================== drawing

function limb(p: PixelCanvas, a: Pt, b: Pt, c: Pt, w: number, col: number, hi: number) {
  p.thickLine(a[0], a[1], b[0], b[1], w, col);
  p.thickLine(b[0], b[1], c[0], c[1], w, col);
  // lit edge on the top-left side
  p.line(a[0] - 1, a[1], b[0] - 1, b[1], hi);
}

function drawDuelist(p: PixelCanvas, who: PlayerId, P: Pose): void {
  const L = LOOKS[who];
  const [cS, cB, cL, cT] = L.coat;
  const hip = P.hip;
  const neck: Pt = [hip[0] + P.lean, hip[1] - P.torso];
  const shN: Pt = [neck[0] + 2, neck[1] + 2]; // near shoulder (right/front)
  const shF: Pt = [neck[0] - 2, neck[1] + 2]; // far shoulder
  const R = (q: Pt): Pt => [Math.round(q[0]), Math.round(q[1])];

  // ---- far arm (behind everything), darker coat sleeve
  {
    const e = R([shF[0] + P.fElbow[0], shF[1] + P.fElbow[1]]);
    const h = R([shF[0] + P.fHand[0], shF[1] + P.fHand[1]]);
    p.thickLine(shF[0], shF[1], e[0], e[1], 3, cS);
    p.thickLine(e[0], e[1], h[0], h[1], 2.6, cS);
    p.set(h[0], h[1], PAL.skin1).set(h[0], h[1] + 1, PAL.skin1);
  }
  // ---- legs
  const leg = (from: Pt, knee: Pt, foot: Pt, col: number, hi: number, near: boolean) => {
    p.thickLine(from[0], from[1], knee[0], knee[1], 3, col);
    p.thickLine(knee[0], knee[1], foot[0], foot[1] - 2, 2.6, col);
    if (near) p.line(from[0] - 1, from[1] + 1, knee[0] - 1, knee[1], hi);
    // boot
    p.rect(foot[0] - 2, foot[1] - 2, 4, 2, L.boots);
    p.set(foot[0] + 2, foot[1] - 1, L.boots);
    p.set(foot[0] - 1, foot[1] - 2, L.bootsHi);
  };
  leg([hip[0] - 1, hip[1]], P.fKnee, P.fFoot, L.pants, L.pantsHi, false);
  leg([hip[0] + 1, hip[1]], P.nKnee, P.nFoot, L.pants, L.pantsHi, true);

  // ---- neck
  p.rect(neck[0] - 1, neck[1] - 1, 3, 2, PAL.skin2);
  // ---- coat: open at the front (shirt + belt + legs show), long tails flaring behind
  {
    const t = P.tail;
    const wv = (k: number) => Math.round(Math.sin((P.wave + k) * Math.PI * 2) * 0.8);
    const tailY = hip[1] + 9 + t[1];
    const body: Pt[] = [
      [shF[0] - 1, shF[1] - 1],
      [shN[0] + 1, shN[1] - 1],
      [shN[0] + 2, shN[1] + 2],
      [hip[0] + 3, hip[1] - 2],
      [hip[0] + 3, hip[1] + 2 + wv(0.6)],
      [hip[0] - 1, hip[1] + 5 + wv(0.4)],
      [hip[0] - 4 + t[0], tailY + wv(0.2)],
      [hip[0] - 7 + t[0] * 1.5, tailY - 1 + wv(0)],
      [hip[0] - 5 + t[0] * 0.5, hip[1] + 1],
      [shF[0] - 2, shF[1] + 3],
    ];
    p.poly(body, cB);
    // inside of the back tail (lining) where the coat swings open
    p.poly(
      [
        [hip[0] - 1, hip[1] + 5 + wv(0.4)],
        [hip[0] - 4 + t[0], tailY + wv(0.2)],
        [hip[0] - 3 + t[0] * 0.5, hip[1] + 3],
      ],
      L.coatIn,
    );
    // shadow fold down the back, light on the shoulders and the front edge
    p.line(shF[0] - 1, shF[1] + 2, hip[0] - 5 + t[0] * 0.5, hip[1] + 1, cS);
    p.line(hip[0] - 5 + t[0] * 0.5, hip[1] + 1, hip[0] - 7 + t[0] * 1.5, tailY - 1 + wv(0), cS);
    p.line(shF[0], shF[1] - 1, shN[0] + 1, shN[1] - 1, cT);
    p.line(shF[0], shF[1], shN[0], shN[1], cL);
    // hem trim along the tails
    p.line(hip[0] - 1, hip[1] + 5 + wv(0.4), hip[0] - 4 + t[0], tailY + wv(0.2), cT);
    p.line(hip[0] - 4 + t[0], tailY + wv(0.2), hip[0] - 7 + t[0] * 1.5, tailY - 1 + wv(0), cL);
    // shirt (open coat front) + lapel trim
    p.poly(
      [
        [neck[0] + 1, neck[1] + 1],
        [neck[0] + 3, neck[1] + 1],
        [hip[0] + 2, hip[1] - 2],
        [hip[0], hip[1] - 1],
      ],
      L.shirt,
    );
    p.line(neck[0] + 2, neck[1] + 2, hip[0] + 2, hip[1] - 3, L.shirtHi);
    p.line(neck[0] + 1, neck[1] + 1, hip[0] + 0, hip[1] - 1, cT);
    // belt
    p.hline(hip[0] - 2, hip[0] + 3, hip[1] - 1, PAL.night0);
    p.set(hip[0] + 2, hip[1] - 1, PAL.gold3);
    if (L.collar) {
      // the rival's high collar flaring up behind the head
      p.poly(
        [
          [neck[0] - 3, neck[1] + 2],
          [neck[0] - 5, neck[1] - 5],
          [neck[0] - 1, neck[1] - 1],
          [neck[0] + 1, neck[1] + 1],
        ],
        cB,
      );
      p.line(neck[0] - 5, neck[1] - 5, neck[0] - 3, neck[1] + 1, cT);
    }
  }

  // ---- head (stamp)
  {
    const hx = neck[0] - 4 + P.head[0];
    const hy = neck[1] - 9 + P.head[1];
    const stamp = P.headTilt < 0 && P.eyes === 'shut' && P.head[1] >= 2 ? L.heads.down : P.eyes === 'shut' ? L.heads.shut : P.mouth ? L.heads.shout : L.heads.head;
    const key: Record<string, number> = {
      '1': L.hair[0],
      '2': L.hair[1],
      '3': L.hair[2],
      s: PAL.skin3,
      S: PAL.skin2,
      e: PAL.night0,
      w: L.glow[1],
      b: L.hair[0],
      m: PAL.crim0,
      n: PAL.skin2,
    };
    stamp.forEach((r, j) =>
      [...r].forEach((ch, i) => {
        const col = key[ch];
        if (col !== undefined) p.set(hx + i, hy + j + (P.headTilt > 0 ? -1 : 0), col);
      }),
    );
    // fierce brow: the brow line drops onto the eye
    if (P.eyes === 'fierce') {
      const ey = hy + 5 + (P.headTilt > 0 ? -1 : 0);
      p.set(hx + 7, ey - 1, L.hair[0]);
    }
  }

  // ---- near arm + duel disk (in front)
  {
    const e = R([shN[0] + P.nElbow[0], shN[1] + P.nElbow[1]]);
    const h = R([shN[0] + P.nHand[0], shN[1] + P.nHand[1]]);
    p.thickLine(shN[0], shN[1], e[0], e[1], 3, cB);
    p.thickLine(e[0], e[1], h[0], h[1], 2.6, cB);
    p.line(shN[0] - 1, shN[1] - 1, e[0] - 1, e[1] - 1, cL);
    // cuff + hand
    p.set(h[0], h[1], P.fist ? PAL.skin2 : PAL.skin3).set(h[0] + 1, h[1], PAL.skin3);
    if (!P.fist) p.set(h[0] + 1, h[1] + 1, PAL.skin2);
    else p.set(h[0], h[1] - 1, PAL.skin3).set(h[0] + 1, h[1] - 1, PAL.skin3);
    // duel disk on the forearm: a round core plate + the card blade sticking out sideways
    // (perpendicular to the forearm, on its outer side), card slots glowing in the player colour
    const m: Pt = R([e[0] + (h[0] - e[0]) * 0.55, e[1] + (h[1] - e[1]) * 0.55]);
    const dx = h[0] - e[0];
    const dy = h[1] - e[1];
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    // the blade sticks out of the forearm's side that faces forward/down: a hanging arm shows
    // it pointing forward, a thrust arm shows it hanging under the forearm (never across the face)
    const pa: Pt = [uy, -ux];
    const pb: Pt = [-uy, ux];
    const [ox, oy] = pa[0] + pa[1] * 0.6 >= pb[0] + pb[1] * 0.6 ? pa : pb;
    const glowCol = P.glow >= 2 ? L.glow[2] : P.glow >= 1 ? L.glow[1] : L.glow[0];
    const b0: Pt = R([m[0] + ox * 1, m[1] + oy * 1]);
    const b1: Pt = R([m[0] + ox * 7 - ux * 1.5, m[1] + oy * 7 - uy * 1.5]);
    p.thickLine(b0[0], b0[1], b1[0], b1[1], 2.6, PAL.steel);
    const g0: Pt = R([m[0] + ox * 2 + ux * 0.6, m[1] + oy * 2 + uy * 0.6]);
    const g1: Pt = R([m[0] + ox * 6 - ux * 0.6, m[1] + oy * 6 - uy * 0.6]);
    p.line(g0[0], g0[1], g1[0], g1[1], glowCol);
    p.set(b1[0], b1[1], PAL.mist);
    // core plate
    p.disc(m[0] + 0.5, m[1] + 0.5, 2.2, PAL.steel);
    p.set(m[0] - 1, m[1] - 1, PAL.mist);
    p.set(m[0], m[1], P.glow >= 1 ? L.glow[2] : L.glow[0]);
    p.set(m[0] + 1, m[1], glowCol);
  }

  p.outline(PAL.ink);

  // ---- glow (no outline): the disk flares on command / victory
  if (P.glow >= 2) {
    const e = R([shN[0] + P.nElbow[0], shN[1] + P.nElbow[1]]);
    const h = R([shN[0] + P.nHand[0], shN[1] + P.nHand[1]]);
    const m: Pt = R([(e[0] + h[0]) / 2, (e[1] + h[1]) / 2]);
    for (const [ox, oy] of [
      [0, -3],
      [2, -3],
      [-2, -3],
      [3, -2],
    ] as const)
      if (!p.isOpaque(m[0] + ox, m[1] + oy)) p.set(m[0] + ox, m[1] + oy, L.glow[0]);
  }
}

// ================================================================== public

const FRAME_CACHE = new Map<string, PixelCanvas>();

/** Rendered frame (cached), facing right. */
export function duelistFrame(p: PlayerId, anim: DuelistAnim, frame: number): PixelCanvas {
  const k = `${p}|${anim}|${frame}`;
  let pc = FRAME_CACHE.get(k);
  if (!pc) {
    pc = new PixelCanvas(DUELIST_W, DUELIST_H);
    const spec = DUELIST_SPECS[anim];
    drawDuelist(pc, p, framePose(anim, Math.max(0, Math.min(spec.frames - 1, frame))));
    FRAME_CACHE.set(k, pc);
  }
  return pc;
}
