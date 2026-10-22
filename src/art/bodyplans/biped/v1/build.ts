// biped v1 — the BUILD: one member's proportions and slot variants (docs/v3/A3_MIMARI.md §4.2).
//
// A build is plain data. The plan resolves it once into a REST skeleton (restOf); every BipedPose
// field is an OFFSET from that rest (0 = rest), so the same pose on two builds moves the same joints
// by the same pixels — the sameness gate's cross-build control (b) relies on it (§9.2).
//
// Frame px of the P1 art (facing right: +x forward, +y down). `root` is the ground point the figure
// stands on and must equal the art's anchor (planArt runs checkBuild with the member's frame).
//
// The rest skeleton, bottom-up:
//   feet     on the ground line root.y, `stance` px apart around root.x + stanceAt; `lead` says which
//            foot is forward: 'far' (heavy default: far foot ahead, the chest turned to the viewer, the
//            near side at −x) or 'near' (lithe default: near foot ahead, the near side at +x)
//   pelvis   hip-joint centre `pelvis` px above the ground, hipAt px from the stance centre; hip
//            joints `hip` px apart (near / far by lead)
//   spine    two halves (pelvis → waist → chest), rest lean `spine` rad (+ = forward)
//   head     its top `height` px above the ground; `head` px tall; it sits on the chest at
//            (jut, −(head/2 + neck − headSink) + drop) + headAt, neck = round(0.3 × head),
//            k = hunch / 0.4: drop = k × (head + neck − headSink) (at 0.4 the head top meets the
//            shoulder line), jut = k × head. The torso length follows (the chest sits under the head).
//   shoulders `shoulder` px apart on the chest line (near / far by lead), the far one farRise px higher
//   hands    hanging under their shoulders (hang × arm length; heavy 0.9, lithe 0.8) + hands.N / .F
//
// Plan parameter ceiling (§4.2): ≤ 40 — paramCount() counts the leaves of a full build (30 today).
// The preset only fills geometry defaults (lead, spine, ankle, pelvis, head, hang); it carries no
// motion: there is no default period, pose or rhythm anywhere in the plan (§0 items 1–3).

import type { V } from '../../../rigkit/geom';

export type BipedPreset = 'heavy' | 'lithe';
export type BipedLower = 'legs' | 'spout' | 'skirt';
export type BipedFarArm = 'free' | 'shield' | 'hidden';

export interface BipedBuild {
  /** the ground point the figure stands on, frame px (= the art's anchor) */
  readonly root: readonly [x: number, y: number];
  readonly preset: BipedPreset;
  /** ground → head top at rest (px) */
  readonly height: number;
  /** shoulder-joint span as seen (px) */
  readonly shoulder: number;
  /** hip-joint span as seen (px) */
  readonly hip: number;
  readonly arm: readonly [upper: number, fore: number];
  readonly leg: readonly [thigh: number, shin: number];
  /** feet apart (px) */
  readonly stance: number;
  /** 0 upright … 0.4 head below the shoulder line (the head drops and juts forward) */
  readonly hunch: number;
  /** px the head sits into the shoulders */
  readonly headSink: number;
  /** IK legs | a water-spout column (no legs) | a robe over IK legs */
  readonly lower: BipedLower;
  /** the far arm: free | holding a shield prop (`props.shield`, slot propF) | not drawn */
  readonly farArm: BipedFarArm;

  // ---- optional geometry (A3 Y7 additions; defaults from the preset)
  /** which side's foot is forward (default heavy 'far', lithe 'near') */
  readonly lead?: 'far' | 'near';
  /** hip-joint height above the ground (px); default: the legs at 0.92 (heavy) / 0.78 (lithe) of their reach */
  readonly pelvis?: number;
  /** head size (px); default round(0.24 × height) */
  readonly head?: number;
  /** rest spine lean (rad, + = forward); default heavy 0, lithe 0.45 */
  readonly spine?: number;
  /** extra rest head offset from its derived place (px) */
  readonly headAt?: readonly [x: number, y: number];
  /** stance centre x from the root (px) */
  readonly stanceAt?: number;
  /** pelvis x from the stance centre (px) */
  readonly hipAt?: number;
  /** sole → ankle joint (px); default heavy 3, lithe 2 */
  readonly ankle?: number;
  /** the far shoulder sits this many px higher (3/4 view) */
  readonly farRise?: number;
  /** rest hand offsets from the hanging place (px) */
  readonly hands?: { readonly N: readonly [x: number, y: number]; readonly F: readonly [x: number, y: number] };
  /**
   * (additive, A3 Y9 plan request R1) which way the knees break: −1 forward (default: every v1 member
   * so far), +1 back (v1's bow-legged titan). Only the leg IK reads it; 'spout' builds have no legs.
   */
  readonly knee?: 1 | -1;
}

/** Geometry defaults of a preset (no motion values). */
export const PRESET_GEOMETRY: Readonly<Record<BipedPreset, { readonly lead: 'far' | 'near'; readonly spine: number; readonly ankle: number; readonly legReach: number; readonly hang: number }>> = Object.freeze({
  heavy: Object.freeze({ lead: 'far' as const, spine: 0, ankle: 3, legReach: 0.92, hang: 0.9 }),
  lithe: Object.freeze({ lead: 'near' as const, spine: 0.45, ankle: 2, legReach: 0.78, hang: 0.8 }),
});

/** The resolved rest skeleton of a build (frame px; offsets as noted). */
export interface BipedRest {
  readonly build: BipedBuild;
  readonly lead: 'far' | 'near';
  /** x sign of the near side (lead 'far' → −1, 'near' → +1) */
  readonly near: -1 | 1;
  readonly root: V;
  readonly ankle: number;
  /** rest sole points */
  readonly footN: V;
  readonly footF: V;
  /** rest hip-joint centre */
  readonly pelvis: V;
  /** hip joints, offsets from the pelvis */
  readonly hipN: V;
  readonly hipF: V;
  readonly spine: number;
  /** pelvis → chest (shoulder centre) along the spine */
  readonly torso: number;
  /** rest shoulder centre */
  readonly chest: V;
  /** shoulder joints, offsets from the chest */
  readonly shoulderN: V;
  readonly shoulderF: V;
  readonly headH: number;
  readonly neck: number;
  /** head centre, offset from the chest */
  readonly headOff: V;
  /** rest hands, offsets from their shoulders */
  readonly handN: V;
  readonly handF: V;
  readonly armReach: number;
  readonly legReach: number;
}

const REST = new WeakMap<BipedBuild, BipedRest>();

/** The rest skeleton of a build (memoised per build object). */
export function restOf(b: BipedBuild): BipedRest {
  const hit = REST.get(b);
  if (hit) return hit;
  const g = PRESET_GEOMETRY[b.preset];
  const lead = b.lead ?? g.lead;
  const near: -1 | 1 = lead === 'far' ? -1 : 1;
  const [rx, ry] = b.root;
  const ankle = b.ankle ?? g.ankle;
  const cx = rx + (b.stanceAt ?? 0);
  const footN: V = [cx + (near * b.stance) / 2, ry];
  const footF: V = [cx - (near * b.stance) / 2, ry];
  const legReach = b.leg[0] + b.leg[1];
  const spread = Math.max(0, (b.stance - b.hip) / 2);
  const pelvisH = b.pelvis ?? Math.round(ankle + Math.sqrt(Math.max(0, (g.legReach * legReach) ** 2 - spread ** 2)));
  const pelvis: V = [cx + (b.hipAt ?? 0), ry - pelvisH];
  const headH = b.head ?? Math.round(0.24 * b.height);
  const neck = Math.round(0.3 * headH);
  const k = Math.max(0, Math.min(0.4, b.hunch)) / 0.4;
  const [ax, ay] = b.headAt ?? [0, 0];
  const headOff: V = [k * headH + ax, -(headH / 2 + neck - b.headSink) + k * (headH + neck - b.headSink) + ay];
  const spine = b.spine ?? g.spine;
  const chestY = ry - b.height + headH / 2 - headOff[1];
  const torso = (pelvis[1] - chestY) / Math.cos(spine);
  const chest: V = [pelvis[0] + Math.sin(spine) * torso, chestY];
  const hang = g.hang * (b.arm[0] + b.arm[1]);
  const hn = b.hands?.N ?? [0, 0];
  const hf = b.hands?.F ?? [0, 0];
  const rest: BipedRest = Object.freeze({
    build: b,
    lead,
    near,
    root: [rx, ry] as V,
    ankle,
    footN,
    footF,
    pelvis,
    hipN: [(near * b.hip) / 2, 0] as V,
    hipF: [(-near * b.hip) / 2, 0] as V,
    spine,
    torso,
    chest,
    shoulderN: [(near * b.shoulder) / 2, 0] as V,
    shoulderF: [(-near * b.shoulder) / 2, -(b.farRise ?? 0)] as V,
    headH,
    neck,
    headOff,
    handN: [hn[0], hang + hn[1]] as V,
    handF: [hf[0], hang + hf[1]] as V,
    armReach: b.arm[0] + b.arm[1],
    legReach,
  });
  REST.set(b, rest);
  return rest;
}

/** The art frame a build is checked against (PlanMonster.frame). */
export interface BipedFrameRef {
  readonly w: number;
  readonly h: number;
  readonly anchor: readonly [number, number];
}

const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Problems of a build (empty = it resolves): ranges, reach at rest, the root on the anchor, the frame margin. */
export function checkBuild(b: BipedBuild, frame?: BipedFrameRef): string[] {
  const out: string[] = [];
  const nums: [string, number][] = [
    ['height', b.height], ['shoulder', b.shoulder], ['hip', b.hip], ['arm[0]', b.arm[0]], ['arm[1]', b.arm[1]], ['leg[0]', b.leg[0]], ['leg[1]', b.leg[1]],
    ['stance', b.stance], ['hunch', b.hunch], ['headSink', b.headSink], ['root.x', b.root[0]], ['root.y', b.root[1]],
  ];
  for (const [n, v] of nums) if (!Number.isFinite(v)) out.push(`${n} is not a finite number`);
  if (out.length) return out;
  for (const [n, v] of [['arm[0]', b.arm[0]], ['arm[1]', b.arm[1]], ['leg[0]', b.leg[0]], ['leg[1]', b.leg[1]], ['height', b.height]] as const) if (v <= 0) out.push(`${n} must be > 0 (got ${v})`);
  for (const [n, v] of [['shoulder', b.shoulder], ['hip', b.hip], ['stance', b.stance]] as const) if (v < 0) out.push(`${n} must be ≥ 0 (got ${v})`);
  if (b.hunch < 0 || b.hunch > 0.4) out.push(`hunch ${b.hunch} outside 0…0.4`);
  if (b.knee !== undefined && b.knee !== 1 && b.knee !== -1) out.push(`knee ${String(b.knee)} is not 1 (back) or −1 (forward)`);
  if (out.length) return out;
  const r = restOf(b);
  if (!(r.torso >= 3)) out.push(`the torso resolves to ${r.torso.toFixed(2)} px (height ${b.height} leaves no room between the pelvis and the head)`);
  if (r.headH <= 0) out.push(`head size ${r.headH}`);
  if (b.lower !== 'spout')
    for (const s of ['N', 'F'] as const) {
      const hip: V = [r.pelvis[0] + r[`hip${s}`][0], r.pelvis[1]];
      const ank: V = [r[`foot${s}`][0], r[`foot${s}`][1] - r.ankle];
      if (dist(hip, ank) > r.legReach - 0.5) out.push(`rest leg ${s} out of reach (${dist(hip, ank).toFixed(2)} > ${(r.legReach - 0.5).toFixed(2)}): lower the pelvis or narrow the stance`);
    }
  for (const s of ['N', 'F'] as const) {
    const h = r[`hand${s}`];
    if (Math.hypot(h[0], h[1]) > r.armReach - 0.25) out.push(`rest hand ${s} out of reach (${Math.hypot(h[0], h[1]).toFixed(2)} > ${(r.armReach - 0.25).toFixed(2)})`);
  }
  if (frame) {
    if (frame.anchor[0] !== b.root[0] || frame.anchor[1] !== b.root[1]) out.push(`root (${b.root}) is not the frame anchor (${frame.anchor})`);
    const pts: [string, V][] = [
      ['head top', [r.chest[0] + r.headOff[0], r.chest[1] + r.headOff[1] - r.headH / 2]],
      ['footN', r.footN], ['footF', r.footF],
      ['shoulderN', [r.chest[0] + r.shoulderN[0], r.chest[1] + r.shoulderN[1]]],
      ['shoulderF', [r.chest[0] + r.shoulderF[0], r.chest[1] + r.shoulderF[1]]],
    ];
    for (const [n, p] of pts) if (p[0] < 2 || p[1] < 2 || p[0] > frame.w - 3 || p[1] > frame.h - 1) out.push(`rest ${n} (${p[0].toFixed(1)}, ${p[1].toFixed(1)}) outside the ${frame.w}×${frame.h} frame's 2 px margin`);
  }
  return out;
}

/** Number of plan parameters of a full build: its leaves (tuples count per element). §4.2: ≤ 40. */
export function paramCount(b: Required<BipedBuild>): number {
  const leaves = (v: unknown): number => (Array.isArray(v) ? v.reduce((s: number, x) => s + leaves(x), 0) : v !== null && typeof v === 'object' ? Object.values(v).reduce((s: number, x) => s + leaves(x), 0) : 1);
  return leaves(b);
}

// ------------------------------------------------------------------ paper members (build fixtures)

/**
 * The four PAPER members of A3 (§14 Y7): their builds, with proportions measured on the v1 rigs
 * (src/art/monsters/{stone_sentinel,magma_titan,tide_golem,shade_assassin}.ts, idle f0). They are the
 * plan's fixtures — its tests and ?dev=bodyplan resolve them — never a member's source: a member
 * writes its own build in its own file (a fixture edit must not move a real monster's pixels).
 */
export interface PaperMember {
  readonly id: string;
  readonly frame: { readonly w: number; readonly h: number; readonly anchor: readonly [number, number] };
  readonly build: BipedBuild;
}

export const PAPER: Readonly<Record<'sentinel' | 'titan' | 'golem' | 'assassin', PaperMember>> = Object.freeze({
  // Taş Muhafız: upright block, helm between the pauldrons, the far arm carries the tower shield.
  // v1: feet 22 / 37, hip joints 25 / 36 at y 49, shoulders 17 / 42 at y 29, helm 11 px (top 15), hand 14,47.
  sentinel: Object.freeze({
    id: 'stone_sentinel',
    frame: { w: 64, h: 64, anchor: [30, 60] as const },
    build: Object.freeze({
      root: [30, 60] as const, preset: 'heavy' as const, height: 45, shoulder: 25, hip: 11, arm: [10, 10] as const, leg: [6, 5] as const,
      stance: 15, hunch: 0, headSink: 0, lower: 'legs' as const, farArm: 'shield' as const,
      pelvis: 11, head: 11, stanceAt: -0.5, hipAt: 1, headAt: [0.5, 0] as const, hands: { N: [-3, 0] as const, F: [4, -2] as const },
    }),
  }),
  // Magma Titanı: hunched (0.32), the head sunk forward between towering shoulders, fists near the ground.
  // v1: feet 28 / 51, hip joints 31 / 45 at y 58, shoulders 21,31 / 50,29 (2.5 px behind the hips: spine −0.09),
  // head 10 px centred 46,33, arms 14 / 13, legs 10 / 9.
  titan: Object.freeze({
    id: 'magma_titan',
    frame: { w: 80, h: 80, anchor: [39, 77] as const },
    build: Object.freeze({
      root: [39, 77] as const, preset: 'heavy' as const, height: 49, shoulder: 29, hip: 14, arm: [14, 13] as const, leg: [10, 9] as const,
      stance: 23, hunch: 0.32, headSink: 0, lower: 'legs' as const, farArm: 'free' as const,
      pelvis: 19, head: 10, ankle: 4, spine: -0.09, stanceAt: 0.5, hipAt: -1.5, headAt: [2.5, 0] as const, farRise: 2, hands: { N: [0, 0] as const, F: [6, -2] as const },
    }),
  }),
  // Gelgit Golemi: no legs — a water-spout column into a foam ring; barrel body, the mask pushed forward.
  // v1: waist 30,43, shoulders 18,25 / 40,23.5, head centre ~40,19, arms 9.5 / 10, near fist 9,48, far fist raised 51,41.
  golem: Object.freeze({
    id: 'tide_golem',
    frame: { w: 64, h: 64, anchor: [30, 60] as const },
    build: Object.freeze({
      root: [30, 60] as const, preset: 'heavy' as const, height: 47, shoulder: 22, hip: 12, arm: [10, 10] as const, leg: [9, 8] as const,
      stance: 14, hunch: 0.1, headSink: 1, lower: 'spout' as const, farArm: 'free' as const,
      pelvis: 17, head: 12, spine: 0.06, headAt: [6.5, 0] as const, farRise: 2, hands: { N: [-5, 1] as const, F: [8, -4] as const },
    }),
  }),
  // Gölge Suikastçı: lithe crouch, spine leaning 0.5 rad, near foot forward, both blades forward.
  // v1: hip 23,43, feet 33 (near, front) / 10 (far, back), spine 17, arms 8.5 / 8, legs 13 / 13, hands 42,38 / 35,42.
  assassin: Object.freeze({
    id: 'shade_assassin',
    frame: { w: 64, h: 64, anchor: [24, 60] as const },
    build: Object.freeze({
      root: [24, 60] as const, preset: 'lithe' as const, height: 40, shoulder: 2, hip: 3, arm: [8.5, 8] as const, leg: [13, 13] as const,
      stance: 23, hunch: 0, headSink: 1, lower: 'legs' as const, farArm: 'free' as const,
      pelvis: 17, head: 10, spine: 0.5, stanceAt: -2.5, hipAt: 1.5, headAt: [5, 0] as const, farRise: 1.5, hands: { N: [12, -7] as const, F: [7, -2] as const },
    }),
  }),
});
