// Hortlak Muhafız v3 — the ANIM TABLES: hand-keyed beats and holds over biped v1 poses.
//
// idle 12 f · guard 8 f · attack "Hortlak Palası" (overhead chop) 13 f · roar "Mezar Çığlığı" 12 f · hit 6 f ·
// hitHeavy 8 f · hitMagic 8 f · summon 14 f (climbs out of its grave) · death 10 f (dissolves into the dark) ·
// revive 12 f · toGuard 5 f · fromGuard 5 f · victory 8 f. Whole pixels only (IŞ-12); every one-shot ends on
// its exact end pose.
//
// Rhythm signature "pusu" (the ambush): long stillness, then a SNAP — a held coil (the longest hold, 190 ms, the
// eyes crackling), a 40 ms drop, a 50 ms release that is already a hit; the lightning leads the steel.

import type { BipedDelta } from '../bodyplans/biped/v1';
import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import type { V } from '../rigkit/geom';
import type { WardenFx } from './grim_warden-build';
import type { Pose } from './grim_warden-parts';

type D = BipedDelta & { fx?: Partial<WardenFx> };
const B = (ms: number, key: D, name?: Beat<Pose>['name'], smear?: boolean): Beat<Pose> => ({ ms, key: key as never, ...(name ? { name } : {}), ...(smear ? { smear } : {}) });
const arm = (x: number, y: number, bend: 1 | -1 = 1, a?: number, w = 1) => ({ hand: [x, y] as V, bend, grip: 'fist' as const, ...(a !== undefined ? { aim: { a, w } } : { aim: { a: 0, w: 0 } }) });

// ------------------------------------------------------------------ idle: the watch (12 f, 1.74 s)
// The skeleton breathes by blocks: the ribs first, the pauldrons a frame after, the skull last; the cloak and the
// rags run their own wave; the far claw flexes; the eyes pulse and, twice a loop, crackle.
const I_CHEST = [0, -1, -1, 0, 0, 0, -1, -1, 0, 0, 0, 0];
const I_PADN = [0, 0, -1, -1, 0, 0, 0, -1, -1, 0, 0, 0];
const I_PADF = [0, 0, 0, -1, -1, 0, 0, 0, -1, -1, 0, 0];
const I_HEAD = [0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0];
const I_HEADX = [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0];
const I_EYE = [1, 1, 1, 1.4, 1.4, 1, 1, 1, 0.6, 1, 1, 1];
const I_ARC = [0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 7, 0];
const I_EDGE = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0];
const I_RIB = [1, 1, 1.4, 1.4, 1, 1, 1, 1.4, 1.4, 1, 1, 1];
const I_CLOAK = [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0];
const I_CLAW = [0, 0, 0, 0, 1, 1, 0, 0, 0, -1, 0, 0];
const I_BLADE = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0];
const idle: LoopDef<Pose> = {
  n: 12,
  holds: [150, 140, 130, 150, 160, 150, 140, 130, 150, 160, 150, 140],
  at: (f) =>
    ({
      head: { x: I_HEADX[f], y: I_HEAD[f], a: 0, lag: 0 },
      armF: arm(0, I_CLAW[f]),
      armN: arm(0, 0),
      clothPhase: f / 12,
      fx: { chestY: I_CHEST[f], padN: I_PADN[f], padF: I_PADF[f], eye: I_EYE[f], arc: I_ARC[f], arcLen: 1, rib: I_RIB[f], edge: I_EDGE[f], cloak: I_CLOAK[f], head2: I_HEADX[(f + 11) % 12] },
    }) as D,
};

// ------------------------------------------------------------------ guard: the blade across (8 f, 1.2 s)
const G_CHEST = [0, -1, -1, 0, 0, -1, -1, 0];
const G_CLOAK = [1, 1, 2, 2, 2, 1, 1, 0];
const G_ARC = [0, 0, 5, 0, 0, 0, 0, 0];
const G_EYE = [1.2, 1.2, 1.4, 1.2, 1.2, 1.2, 1.4, 1.2];
const GUARD_BASE: D = {
  hip: { x: 1, y: 2, tilt: 0 },
  lean: 0.1,
  chestLean: 0.06,
  head: { x: 1, y: 2, a: 0.1, lag: 0 },
  armN: arm(15, -22, -1, -1.0),
  armF: arm(-4, -22, 1),
};
const guard: LoopDef<Pose> = {
  n: 8,
  holds: [170, 150, 150, 160, 170, 150, 150, 160],
  at: (f) => ({ ...GUARD_BASE, armN: arm(15, -22, -1, -1.0), clothPhase: 0, fx: { chestY: G_CHEST[f], padN: f === 2 || f === 3 ? -1 : 0, padF: f === 5 || f === 6 ? -1 : 0, eye: G_EYE[f], arc: G_ARC[f], rib: 1.6, edge: f === 2 ? 1 : 0, cloak: G_CLOAK[f] } }) as D,
};

// ------------------------------------------------------------------ attack "Hortlak Palası": the overhead chop (13 f)
// charge (the declaration holds f1) → the blade drawn up behind the shoulder, the eyes lighting → the coil (the
// longest hold, 190 ms) → a 40 ms drop of the shoulder → release (the blade comes over, 50 ms, smeared) → contact at
// the floor (70 ms, the dust) → the recover drags the blade up out of the earth.
const attack: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    B(90, { head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { eye: 1.4, edge: 1 } }, 'charge'),
    B(100, { hip: { x: -1, y: 2, tilt: 0 }, lean: -0.12, chestLean: -0.1, armN: arm(-3, -26, 1, -2.2), armF: arm(-3, -6), head: { x: -1, y: 1, a: -0.1, lag: 0 }, fx: { eye: 1.6, edge: 2, arc: 3, arcLen: 1.2, cloak: -2, rib: 1.6 } }),
    B(190, { hip: { x: -1, y: 3, tilt: 0 }, lean: -0.2, chestLean: -0.12, armN: arm(-4, -32, 1, -2.0), armF: arm(-5, -8), head: { x: -1, y: 1, a: -0.18, lag: 0 }, footN: { step: [-1, 0], lift: 0 }, fx: { eye: 2, edge: 2, arc: 6, arcLen: 1.6, cloak: -3, padN: -2, rib: 2, jaw: 1 } }, 'coil'),
    B(40, { hip: { x: 0, y: 3, tilt: 0 }, lean: -0.04, chestLean: 0.06, armN: arm(4, -32, 1, -1.6), armF: arm(-2, -6), head: { x: 1, y: 2, a: 0.1, lag: 0 }, fx: { eye: 2, edge: 3, arc: 2, arcLen: 1.8, cloak: 0, padN: 1 } }, 'swing'),
    B(50, { dx: 3, hip: { x: 3, y: 2, tilt: 0 }, lean: 0.2, chestLean: 0.14, armN: arm(18, -14, 1, -0.3), armF: arm(-6, 0), head: { x: 3, y: 3, a: 0.2, lag: 0 }, footF: { step: [3, 0], lift: 0 }, fx: { eye: 2, edge: 3, arc: 5, arcLen: 1.4, cloak: 3, padN: 2, slash: 1 } }, 'release', true),
    B(70, { dx: 5, hip: { x: 4, y: 4, tilt: 0 }, lean: 0.3, chestLean: 0.18, armN: arm(25, 2, 1, 0.75), armF: arm(-7, 3), head: { x: 4, y: 4, a: 0.25, lag: 0 }, footF: { step: [4, 0], lift: 0 }, fx: { eye: 2, edge: 3, arc: 8, arcLen: 1, cloak: 4, padN: 3, dust: 0.2, chips: 0, rib: 2 } }, 'contact'),
    B(90, { dx: 5, hip: { x: 4, y: 4, tilt: 0 }, lean: 0.3, chestLean: 0.16, armN: arm(25, 4, 1, 0.95), head: { x: 4, y: 4, a: 0.2, lag: 0 }, footF: { step: [4, 0], lift: 0 }, fx: { eye: 1.6, edge: 2, arc: 0, cloak: 3, padN: 2, dust: 0.5, rib: 1.6 } }, 'follow'),
    B(100, { dx: 4, hip: { x: 3, y: 3, tilt: 0 }, lean: 0.24, armN: arm(21, 2, 1, 0.9), head: { x: 3, y: 3, a: 0.15, lag: 0 }, footF: { step: [3, 0], lift: 0 }, fx: { eye: 1.4, edge: 1, cloak: 2, dust: 0.8 } }, 'recover'),
    B(110, { dx: 3, hip: { x: 2, y: 2, tilt: 0 }, lean: 0.16, armN: arm(16, -2, 1, 1.1, 0.8), fx: { eye: 1.2, cloak: 1, edge: 1 } }),
    B(120, { dx: 2, hip: { x: 1, y: 1, tilt: 0 }, lean: 0.1, armN: arm(10, -1, 1, 1.3, 0.6), fx: { eye: 1.1, cloak: 1 } }, 'settle'),
    B(130, { dx: 1, hip: { x: 1, y: 1, tilt: 0 }, lean: 0.05, armN: arm(4, 0, 1, 1.5, 0.3), fx: { cloak: 0 } }),
    B(140, { dx: 0, lean: 0.02, armN: arm(1, 0), fx: {} }),
  ],
  end: 'idle0',
  endMs: 150,
};

// ------------------------------------------------------------------ roar "Mezar Çığlığı" (12 f)
const roar: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    B(90, { head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { eye: 0.6, rib: 0.6 } }, 'charge'),
    B(130, { lean: -0.12, chestLean: -0.1, hip: { x: -1, y: 1, tilt: 0 }, head: { x: -1, y: 1, a: 0.05, lag: 0 }, armF: arm(-2, -14), armN: arm(-3, -8), fx: { eye: 0.3, rib: 0.3, cloak: -1, chestY: 1 } }),
    B(170, { lean: -0.2, chestLean: -0.16, hip: { x: -2, y: 2, tilt: 0 }, head: { x: -2, y: 0, a: -0.15, lag: 0 }, armF: arm(-4, -26), armN: arm(-1, -22, 1, -1.7, 1), fx: { eye: 1.5, rib: 2, cloak: -1, chestY: 1, padN: -1, padF: -1, jaw: 2 } }),
    B(60, { lean: 0.02, chestLean: 0.1, hip: { x: 0, y: 1, tilt: 0 }, head: { x: 1, y: -1, a: -0.3, lag: 0 }, armF: arm(-2, -34), armN: arm(2, -26, 1, -2.0), fx: { eye: 2, rib: 2, cloak: 0, jaw: 3, arc: 1, arcLen: 1.5 } }, 'swing'),
    B(110, { lean: -0.08, chestLean: -0.06, head: { x: 1, y: -2, a: -0.35, lag: 0 }, armF: arm(0, -36), armN: arm(4, -28, 1, -1.9), fx: { eye: 2, rib: 2.5, jaw: 4, arc: 4, arcLen: 2, cloak: 3, padN: -2, padF: -2, crackle: 1 } }, 'release'),
    B(120, { lean: -0.08, chestLean: -0.06, head: { x: 1, y: -2, a: -0.35, lag: 0 }, armF: arm(0, -36), armN: arm(4, -28, 1, -1.9), fx: { eye: 2, rib: 2, jaw: 4, arc: 7, arcLen: 2, cloak: 3, crackle: 1 } }),
    B(100, { lean: -0.04, head: { x: 1, y: -1, a: -0.25, lag: 0 }, armF: arm(-1, -28), armN: arm(3, -20, 1, -1.5, 0.8), fx: { eye: 1.6, rib: 2, jaw: 3, arc: 2, arcLen: 1.5, cloak: 2 } }),
    B(100, { lean: 0, head: { x: 0, y: 0, a: -0.1, lag: 0 }, armF: arm(-1, -16), armN: arm(2, -10), fx: { eye: 1.4, rib: 1.6, jaw: 2, cloak: 1 } }, 'recover'),
    B(110, { head: { x: 0, y: 0, a: 0, lag: 0 }, armF: arm(0, -8), armN: arm(1, -4), fx: { eye: 1.2, jaw: 1 } }),
    B(120, { armF: arm(0, -3), armN: arm(0, -1), fx: { jaw: 0 } }),
    B(130, { armF: arm(0, -1), fx: {} }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ hit (6 f)
const hit: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head'] },
  beats: [
    B(50, { head: { x: -2, y: 1, a: -0.2, lag: 0 }, chestLean: -0.1, fx: { eye: 0, chips: 0.15, chipsAt: 0 } }, 'struck'),
    B(70, { lean: -0.08, chestLean: -0.12, head: { x: -3, y: 1, a: -0.25, lag: 0 }, hip: { x: -1, y: 1, tilt: 0 }, armN: arm(-1, -2), fx: { eye: 0, cloak: 2, padN: 1, padF: 1, chips: 0.5, chipsAt: 0, jaw: 1 } }),
    B(120, { lean: -0.05, chestLean: -0.06, head: { x: -2, y: 1, a: -0.12, lag: 0 }, armN: arm(0, -1), fx: { eye: 0.6, cloak: 1, chips: 0.9 } }),
    B(100, { lean: -0.02, head: { x: -1, y: 0, a: -0.05, lag: 0 }, fx: { eye: 1, cloak: 0 } }, 'recover'),
    B(110, { head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { eye: 1.2 } }),
  ],
  end: 'idle0',
  endMs: 120,
};

// ------------------------------------------------------------------ extras
const hitHeavy: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head'] },
  beats: [
    B(50, { chestLean: -0.2, head: { x: -3, y: 2, a: -0.3, lag: 0 }, fx: { eye: 0, chips: 0.2, chipsAt: 1 } }, 'struck'),
    B(70, { lean: -0.16, chestLean: -0.22, hip: { x: -2, y: 2, tilt: 0 }, head: { x: -4, y: 2, a: -0.35, lag: 0 }, footN: { step: [-2, 0], lift: 2 }, armN: arm(-3, -3), fx: { eye: 0, cloak: 3, padN: 2, padF: 2, chips: 0.5, chipsAt: 1, jaw: 2 } }),
    B(120, { lean: -0.2, chestLean: -0.2, hip: { x: -3, y: 3, tilt: 0 }, head: { x: -3, y: 3, a: -0.2, lag: 0 }, footN: { step: [-3, 0], lift: 0 }, armN: arm(-2, 0), fx: { eye: 0.4, cloak: 2, dust: 0.3, chips: 0.9 } }),
    B(110, { lean: -0.12, chestLean: -0.12, hip: { x: -2, y: 4, tilt: 0 }, head: { x: -2, y: 3, a: -0.1, lag: 0 }, footN: { step: [-3, 0], lift: 0 }, fx: { eye: 0.8, cloak: 1, dust: 0.6 } }, 'recover'),
    B(120, { lean: -0.06, hip: { x: -1, y: 2, tilt: 0 }, footN: { step: [-1, 0], lift: 1 }, fx: { eye: 1.1, dust: 0.9 } }),
    B(120, { lean: -0.02, hip: { x: 0, y: 1, tilt: 0 }, fx: { eye: 1.2 } }),
  ],
  end: 'idle0',
  endMs: 130,
};
const hitMagic: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head'] },
  beats: [
    B(50, { chestLean: -0.08, fx: { flare: 1, crackle: 1, arc: 4, arcLen: 2 } }, 'struck'),
    B(70, { lean: -0.04, chestLean: -0.1, head: { x: -1, y: 0, a: -0.1, lag: 0 }, fx: { flare: 1, crackle: 1, arc: 6, arcLen: 2, rib: 2.5, edge: 3, cloak: 1 } }),
    B(120, { lean: -0.04, chestLean: -0.1, head: { x: -1, y: 0, a: -0.1, lag: 0 }, fx: { flare: 1, crackle: 1, arc: 1, arcLen: 2, rib: 2.5, edge: 3, cloak: 1 } }),
    B(80, { chestLean: -0.06, fx: { flare: 0, eye: 2, arc: 3, arcLen: 1.5, rib: 2, edge: 2 } }, 'recover'),
    B(90, { chestLean: -0.03, fx: { eye: 1.6, arc: 0, rib: 1.6, edge: 1 } }),
    B(110, { fx: { eye: 1.3, rib: 1.3 } }),
    B(120, { fx: {} }),
  ],
  end: 'idle0',
  endMs: 120,
};

const toGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    B(60, { hip: { x: 0, y: 1, tilt: 0 }, armN: arm(8, -8, -1), armF: arm(-2, -8), fx: { eye: 1.2 } }),
    B(60, { hip: { x: 1, y: 1, tilt: 0 }, lean: 0.05, armN: arm(14, -18, -1), armF: arm(-3, -16), fx: { cloak: 1 } }),
    B(70, { hip: { x: 1, y: 2, tilt: 0 }, lean: 0.08, chestLean: 0.04, armN: arm(16, -23, -1), armF: arm(-4, -21), head: { x: 1, y: 1, a: 0.06, lag: 0 }, fx: { rib: 1.4 } }),
    B(80, { ...GUARD_BASE, fx: { rib: 1.6, cloak: 1 } } as D),
  ],
  end: 'guard0',
  endMs: 90,
};
const fromGuard: AnimDef<Pose> = {
  base: 'guard0',
  beats: [
    B(60, { armN: arm(14, -14, -1), armF: arm(-3, -14), head: { x: 0, y: 1, a: 0.05, lag: 0 } } as D),
    B(70, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.03, armN: arm(8, -6, 1), armF: arm(-1, -6), head: { x: 0, y: 0, a: 0, lag: 0 } } as D),
    B(80, { armN: arm(3, -1, 1), armF: arm(0, -2), fx: { cloak: 0 } } as D),
    B(90, { armN: arm(1, 0), fx: {} } as D),
  ],
  end: 'idle0',
  endMs: 100,
};

const summon: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    B(100, { lift: -30, armN: arm(0, -6), armF: arm(0, -8), fx: { pit: 0.35, eye: 0, rib: 0, arc: 0, cloak: -2 } }),
    B(90, { lift: -28, armN: arm(0, -6), armF: arm(0, -10), fx: { pit: 0.7, eye: 0, rib: 0, cloak: -2 } }),
    B(90, { lift: -22, armN: arm(-3, -14), armF: arm(-4, -16), fx: { pit: 1, eye: 0, rib: 0, cloak: -3, dust: 0.2 } }),
    B(90, { lift: -15, armN: arm(-4, -12), armF: arm(-4, -14), fx: { pit: 1, eye: 0.3, rib: 0.3, cloak: -3, dust: 0.4 } }),
    B(90, { lift: -8, hip: { x: 0, y: 1, tilt: 0 }, armN: arm(-2, -8), armF: arm(-2, -9), fx: { pit: 1, eye: 0.6, rib: 0.8, cloak: -2, dust: 0.6 } }),
    B(80, { lift: -3, hip: { x: 0, y: 1, tilt: 0 }, fx: { pit: 1, eye: 0.8, rib: 1, cloak: -1, dust: 0.8 } }),
    B(60, { lift: 0, hip: { x: 0, y: 3, tilt: 0 }, lean: 0.06, armN: arm(3, 2), fx: { pit: 1, eye: 1.4, rib: 1.4, cloak: 2, dust: 1 } }, 'land'),
    B(110, { hip: { x: 0, y: 2, tilt: 0 }, lean: -0.06, chestLean: -0.08, head: { x: -1, y: 0, a: -0.15, lag: 0 }, armN: arm(-3, -10), armF: arm(-3, -12), fx: { pit: 1.3, eye: 2, rib: 2, arc: 4, arcLen: 1.6, cloak: 1, edge: 2 } }, 'peak'),
    B(120, { hip: { x: 0, y: 1, tilt: 0 }, lean: -0.1, chestLean: -0.1, head: { x: -1, y: -1, a: -0.25, lag: 0 }, armN: arm(-5, -16), armF: arm(-4, -18), fx: { pit: 1.6, eye: 2, rib: 2, arc: 7, arcLen: 2, cloak: 0, edge: 3, jaw: 2 } }),
    B(110, { hip: { x: 0, y: 1, tilt: 0 }, lean: -0.04, head: { x: 0, y: 0, a: -0.1, lag: 0 }, armN: arm(-2, -8), armF: arm(-2, -9), fx: { pit: 1.85, eye: 1.6, rib: 1.6, arc: 2, arcLen: 1.2, edge: 1 } }),
    B(110, { lean: 0, armN: arm(0, -3), armF: arm(0, -3), fx: { pit: 1.95, eye: 1.3, rib: 1.3 } }),
    B(110, { armN: arm(0, -1), fx: { eye: 1.2 } }),
  ],
  end: 'idle0',
  endMs: 120,
};

const death: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head'] },
  beats: [
    B(50, { chestLean: -0.2, head: { x: -3, y: 2, a: -0.3, lag: 0 }, fx: { eye: 0, chips: 0.2, chipsAt: 1 } }, 'struck'),
    B(70, { lean: -0.16, chestLean: -0.22, hip: { x: -2, y: 2, tilt: 0 }, head: { x: -4, y: 2, a: -0.35, lag: 0 }, armN: arm(-4, -4), fx: { eye: 0, rib: 0.4, cloak: 3, jaw: 2, chips: 0.6, chipsAt: 1 } }),
    B(130, { lean: -0.22, chestLean: -0.24, hip: { x: -3, y: 4, tilt: 0 }, head: { x: -4, y: 3, a: -0.4, lag: 0 }, armN: arm(-4, -2), armF: arm(-2, -10), fx: { eye: 0, rib: 0, cloak: 2, jaw: 3, arc: 4, arcLen: 1.2, chips: 0.9 } }),
    B(110, { lean: -0.2, hip: { x: -3, y: 5, tilt: 0 }, lift: -2, head: { x: -3, y: 5, a: -0.3, lag: 0 }, armN: arm(-2, 0), armF: arm(-2, -6), footN: { step: [-1, 0], lift: 0 }, fx: { eye: 0.3, rib: 0, cloak: 1, jaw: 3 }, pass: { dissolve: 0.04 } }, 'dissolve'),
    B(90, { lean: -0.16, hip: { x: -3, y: 5, tilt: 0 }, lift: -4, head: { x: -3, y: 7, a: -0.2, lag: 0 }, armN: arm(-2, 3), fx: { eye: 0, cloak: 0, jaw: 2 }, pass: { dissolve: 0.16 } }),
    B(80, { lean: -0.12, hip: { x: -2, y: 5, tilt: 0 }, lift: -6, head: { x: -2, y: 9, a: -0.1, lag: 0 }, fx: { eye: 0, jaw: 1, cloak: 0 }, pass: { dissolve: 0.3 } }),
    B(70, { lean: -0.1, hip: { x: -2, y: 5, tilt: 0 }, lift: -7, head: { x: -2, y: 10, a: -0.05, lag: 0 }, fx: { eye: 0 }, pass: { dissolve: 0.45 } }),
    B(70, { hip: { x: -2, y: 5, tilt: 0 }, lift: -8, head: { x: -2, y: 11, a: 0, lag: 0 }, fx: { eye: 0 }, pass: { dissolve: 0.58 } }),
    B(80, { hip: { x: -2, y: 5, tilt: 0 }, lift: -8, head: { x: -2, y: 11, a: 0, lag: 0 }, fx: { eye: 0 }, pass: { dissolve: 0.7 } }),
    B(120, { hip: { x: -2, y: 5, tilt: 0 }, lift: -8, head: { x: -2, y: 11, a: 0, lag: 0 }, fx: { eye: 0 }, pass: { dissolve: 0.78 } }),
  ],
  end: 'hold',
};

const revive: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    B(120, { hip: { x: -2, y: 5, tilt: 0 }, lift: -8, head: { x: -2, y: 11, a: 0, lag: 0 }, fx: { eye: 0, rib: 0, pit: 0.5 }, pass: { dissolve: 0.7 } }),
    B(110, { hip: { x: -2, y: 5, tilt: 0 }, lift: -7, head: { x: -2, y: 10, a: 0, lag: 0 }, fx: { eye: 0.3, rib: 0.3, pit: 0.8 }, pass: { dissolve: 0.58 } }),
    B(100, { hip: { x: -2, y: 5, tilt: 0 }, lift: -6, head: { x: -2, y: 9, a: -0.05, lag: 0 }, fx: { eye: 0.5, rib: 0.5, pit: 1 }, pass: { dissolve: 0.45 } }),
    B(100, { lean: -0.1, hip: { x: -2, y: 5, tilt: 0 }, lift: -4, head: { x: -2, y: 7, a: -0.1, lag: 0 }, fx: { eye: 0.8, rib: 0.8, pit: 1, arc: 5 }, pass: { dissolve: 0.3 } }),
    B(100, { lean: -0.14, hip: { x: -2, y: 5, tilt: 0 }, lift: -2, head: { x: -2, y: 5, a: -0.15, lag: 0 }, fx: { eye: 1.2, rib: 1.2, pit: 1, arc: 2 }, pass: { dissolve: 0.16 } }),
    B(90, { lean: -0.16, hip: { x: -1, y: 5, tilt: 0 }, head: { x: -1, y: 3, a: -0.2, lag: 0 }, armN: arm(-2, -6), fx: { eye: 1.6, rib: 1.6, pit: 1, arc: 6, arcLen: 1.6 }, pass: { dissolve: 0.05 } }),
    B(80, { lean: -0.08, hip: { x: 0, y: 3, tilt: 0 }, armN: arm(-1, -4), fx: { eye: 2, rib: 2, pit: 1.2, arc: 3, arcLen: 1.5, dust: 0.4 } }, 'land'),
    B(110, { lean: -0.04, hip: { x: 0, y: 2, tilt: 0 }, head: { x: 0, y: 1, a: -0.1, lag: 0 }, armN: arm(0, -2), fx: { eye: 1.8, rib: 1.8, pit: 1.6, arc: 0, edge: 1, dust: 0.7 } }),
    B(120, { lean: 0, hip: { x: 0, y: 1, tilt: 0 }, fx: { eye: 1.4, rib: 1.4, pit: 1.9 } }),
    B(120, { fx: { eye: 1.2, rib: 1.2 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

const victory: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    B(100, { lean: -0.04, armN: arm(-2, -10), fx: { eye: 1.4, edge: 1 } }),
    B(110, { lean: -0.08, armN: arm(-3, -26, 1, -1.8, 0.8), head: { x: -1, y: 0, a: -0.1, lag: 0 }, fx: { eye: 1.6, edge: 2, arc: 3, arcLen: 1.4 } }),
    B(120, { lean: -0.1, hip: { x: 0, y: 1, tilt: 0 }, armN: arm(-3, -34, 1, -1.65), armF: arm(-3, -20), head: { x: -1, y: -1, a: -0.2, lag: 0 }, fx: { eye: 2, edge: 3, arc: 6, arcLen: 1.8, rib: 2, jaw: 2 } }),
    B(130, { lean: -0.1, armN: arm(-3, -35, 1, -1.65), armF: arm(-3, -22), head: { x: -1, y: -1, a: -0.25, lag: 0 }, fx: { eye: 2, edge: 3, arc: 2, arcLen: 2, rib: 2, jaw: 3, cloak: 2 } }),
    B(140, { lean: -0.1, armN: arm(-3, -35, 1, -1.65), armF: arm(-3, -22), head: { x: -1, y: -1, a: -0.25, lag: 0 }, fx: { eye: 2, edge: 3, arc: 5, arcLen: 2, rib: 2.5, jaw: 3, cloak: 2 } }),
    B(150, { lean: -0.08, armN: arm(-3, -34, 1, -1.65), armF: arm(-3, -20), head: { x: -1, y: -1, a: -0.2, lag: 0 }, fx: { eye: 1.8, edge: 2, arc: 8, arcLen: 1.6, rib: 2, jaw: 2, cloak: 1 } }),
    B(400, { lean: -0.06, armN: arm(-3, -33, 1, -1.65, 0.9), armF: arm(-2, -16), fx: { eye: 1.6, edge: 2, arc: 0, rib: 1.8, jaw: 1 } }),
  ],
  end: 'hold',
};

export const ANIMS: AnimDefs<Pose> = { idle, guard, attack, roar, hit, hitHeavy, hitMagic, death, summon, revive, toGuard, fromGuard, victory };
