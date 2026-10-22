// ?dev=bodyplan&plan=biped — a body plan's paper members side by side (docs/v3/A3_MIMARI.md §2, §14 Y7):
// the four biped skeletons (Taş Muhafız `farArm: 'shield'`, Magma Titanı heavy + hunch, Gelgit
// Golemi `lower: 'spout'`, Gölge Suikastçı `lithe`), each built from its PAPER build (proportions of
// its v1 rig) through planArt with MANNEQUIN parts (flat volumes in the slot order, one material
// each), P1 on top, P2 (relit, flipped) below; over each body its skeleton (bones, joints) and the
// joint tracks of one anim (dots per frame: handN red, handF blue, head gold, hip green, feet grey,
// props violet — what tools/sameness.ts reads).
//
//   ?dev=bodyplan&plan=biped [&anim=attack|idle|guard|roar|hit] [&frame=N] [&bodies=0] [&tracks=0] [&bones=0]
//   (&frame=N also draws the bodies at that frame of the anim instead of idle f0)
//
// The demo keys below are PREVIEW-ONLY paper choreography, so the tracks have something to show;
// they are not plan defaults (the plan has none) and no member may copy them. paperMember() is
// exported for tests/art/biped.test.ts (this module has no Phaser runtime import).

import type { DevPreview } from '../types';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { MONSTER_ANIMS, type AnimSpec, type AnyMonsterAnim, type MonsterAnim, type MonsterAnimExtra } from '../../art/types';
import type { V } from '../../art/rigkit/geom';
import type { AnimDef, Beat, LoopDef } from '../../art/rigkit/anim';
import type { PoseDelta } from '../../art/rigkit/pose';
import { planArt, type PartCtx, type PlanArt, type PlanPose } from '../../art/bodyplans/types';
import { v1 as biped } from '../../art/bodyplans/biped';
import { PAPER, bipedHelpers, handAt, loopTimes, plus, restOf, type BipedMember, type BipedPart, type BipedPose, type BipedRig } from '../../art/bodyplans/biped/v1';
import { pixelText } from '../../ui/text';

export type PaperName = keyof typeof PAPER;
export const PAPER_NAMES: readonly PaperName[] = ['sentinel', 'titan', 'golem', 'assassin'];
type Fx = { eye: number };
type PP = PlanPose<BipedPose, Fx>;
type Ctx = PartCtx<PP, BipedRig>;
export type PaperArt = PlanArt<PP, BipedRig>;

// ------------------------------------------------------------------ mannequin parts

const FAR = -0.35;
function solid(ctx: Ctx, far: boolean, fill: (r: ReturnType<Ctx['raster']>, m: number) => void): PixelCanvas {
  const r = ctx.raster();
  fill(r, ctx.ref('body'));
  return r.render(ctx.canvas(), { shift: far ? FAR : 0 });
}
function mannequin(name: PaperName): Record<string, BipedPart<Fx> | null> {
  const b = PAPER[name].build;
  const k = b.preset === 'heavy' ? 1 : 0.6;
  const limb = (w: number) => Math.max(2, w * k);
  const leg = (side: 'N' | 'F'): BipedPart<Fx> => ({
    layer: side === 'N' ? 'legN' : 'legF',
    seam: 'crease',
    paint: (c) =>
      solid(c, side === 'F', (r, m) => {
        const l = side === 'N' ? c.rig.legN : c.rig.legF;
        const foot = side === 'N' ? c.rig.footN : c.rig.footF;
        r.tube([l.root, l.mid, l.end], limb(5), limb(4), m);
        r.ell([foot[0] + 1.5, foot[1] - 1.5], limb(4), 1.8, 0, m, { z: 2 });
      }),
  });
  const arm = (side: 'N' | 'F'): BipedPart<Fx> => ({
    layer: side === 'N' ? 'armN' : 'armF',
    paint: (c) =>
      solid(c, side === 'F', (r, m) => {
        const l = side === 'N' ? c.rig.armN : c.rig.armF;
        r.tube([l.root, l.mid, l.end], limb(4.5), limb(3.5), m);
        r.ell(l.end, limb(2.6), limb(2.6), 0, m, { z: 3 });
      }),
  });
  const pauldron = (side: 'N' | 'F'): BipedPart<Fx> | null =>
    b.preset === 'heavy'
      ? {
          layer: side === 'N' ? 'shoulderN' : 'shoulderF',
          paint: (c) => solid(c, side === 'F', (r, m) => r.ell(side === 'N' ? c.rig.shoulderN : c.rig.shoulderF, b.shoulder * 0.17, b.shoulder * 0.14, 0, m, { z: 4 })),
        }
      : null;
  return {
    legF: b.lower === 'spout' ? null : leg('F'),
    armF: b.farArm === 'hidden' ? null : arm('F'),
    shoulderF: pauldron('F'),
    legN: b.lower === 'spout' ? null : leg('N'),
    lower:
      b.lower === 'spout'
        ? { layer: 'lower', paint: (c) => solid(c, false, (r, m) => c.rig.spout && r.tube([[c.rig.spout.base[0], c.rig.spout.base[1] - 4], c.rig.spout.mid, c.rig.spout.top], 9, 6, m)) }
        : null,
    torso: {
      layer: 'torso',
      paint: (c) =>
        solid(c, false, (r, m) => {
          r.tube([c.rig.pelvis, c.rig.waist, c.rig.chest], Math.max(4, b.hip * 0.9), Math.max(4, b.shoulder * 0.62), m);
        }),
    },
    head: { layer: 'head', paint: (c) => solid(c, false, (r, m) => r.ell(c.rig.head, c.rig.headH / 2, c.rig.headH / 2, c.rig.headA, m, { z: 5 })) },
    propF:
      b.farArm === 'shield'
        ? {
            layer: 'propF',
            paint: (c) => {
              const s = c.rig.props.shield;
              if (!s || s.show <= 0) return null;
              return solid(c, false, (r, m) => {
                const [x, y] = s.at;
                r.facet([[x - 6, y - 12], [x + 6, y - 12], [x + 6, y + 10], [x - 6, y + 10]], m, [-0.25, -0.1, 1]);
              });
            },
          }
        : null,
    armN: arm('N'),
    shoulderN: pauldron('N'),
    glow: {
      layer: 'glow',
      paint: (c) => {
        if (c.pose.fx.eye <= 0) return null;
        const p = c.canvas();
        const [x, y] = c.rig.head;
        p.set(Math.round(x + c.rig.headH * 0.25), Math.round(y - 1), c.pose.fx.eye > 1 ? PAL.gold4 : PAL.gold3);
        return p;
      },
    },
  };
}

// ------------------------------------------------------------------ preview-only demo keys

type D = PoseDelta<PP>;
const loop = (holds: readonly number[], at: (tMs: number, f: number) => D): LoopDef<PP> => {
  const t = loopTimes(holds).at;
  return { n: holds.length, holds, at: (f) => at(t[f], f) };
};
const beat = (ms: number, key: D, name?: Beat<PP>['name']): Beat<PP> => ({ ms, key, ...(name ? { name } : {}) });
const once = (beats: readonly Beat<PP>[], extra: Partial<AnimDef<PP>> = {}): AnimDef<PP> => ({ base: 'idle0', beats, end: 'idle0', ...extra });

function demoAnims(name: PaperName): BipedMember<Fx>['anims'] {
  const b = PAPER[name].build;
  const h = bipedHelpers(b);
  const L = restOf(b).armReach;
  /** the hand offset that puts a hand at (fx, fy) × the arm's reach from its shoulder */
  const at = (side: 'N' | 'F', fx: number, fy: number): V => handAt(b, side, [fx * L, fy * L]);
  const idleHolds: Record<PaperName, readonly number[]> = {
    sentinel: [220, 200, 200, 240, 220, 200, 200, 260],
    titan: [160, 140, 140, 160, 180, 140, 140, 180, 160, 140],
    golem: [110, 110, 110, 110, 110, 110, 110, 110],
    assassin: [90, 90, 110, 90, 90, 110],
  };
  const holds = idleHolds[name];
  const T = loopTimes(holds).total;
  const breathe = h.breathe({ periodMs: T, phase: 0, amp: name === 'titan' ? 1.5 : 1 });
  const shift = h.weightShift({ periodMs: name === 'golem' ? T / 2 : T, phase: 0.25, px: name === 'golem' ? 1.5 : 0.5 });
  const idle = loop(holds, (t, f) => ({ ...plus(breathe(t), shift(t)), fx: { eye: f === 3 ? 2 : 1 } }));
  const guard = loop([200, 220, 200, 240], (t) => plus(h.guardTuck({ lead: b.farArm === 'shield' ? 'shield' : 'arms', dropPx: 2 }), h.breathe({ periodMs: 860, phase: 0.5, amp: 0.5 })(t)));
  const [s0, s1, s2] = h.recoilPush(name === 'assassin' ? 'mediumLight' : 'heavy', 2);
  const hit = once([beat(90, s0, 'struck'), beat(80, s1), beat(110, s2), beat(140, { hip: { x: -1 } }, 'recover')], { struck: { regions: ['chest', 'head'] } });
  // arms up (the shield arm stays down: a raised tower shield leaves the frame)
  const up = (k: number): D => ({ armN: { hand: at('N', -0.2 * k, -0.7 * k + 0.6 * (1 - k)) }, ...(b.farArm === 'shield' ? {} : { armF: { hand: at('F', 0.25 * k, -0.7 * k + 0.6 * (1 - k)) } }) });
  const roar = once([
    beat(160, { hip: { y: 2 }, lean: 0.06, head: { y: 1 } }, 'charge'),
    beat(90, plus(up(0.8), { lean: -0.08, chestLean: -0.08, head: { y: -2, a: -0.2 } }), 'release'),
    beat(320, { ...plus(up(1), { lean: -0.1, chestLean: -0.1, head: { y: -2, a: -0.25 } }), fx: { eye: 2 } }, 'peak'),
    beat(180, plus(up(0.3), { lean: -0.03, head: { y: -1 } }), 'recover'),
  ]);
  let attack: AnimDef<PP>;
  if (name === 'sentinel') {
    const arc = h.throwArc({ from: 'handN', liftPx: 3 });
    attack = once([
      beat(140, plus(arc[0], { hip: { x: -1, y: 1 }, twist: -0.3, lean: -0.05 })),
      beat(240, plus(arc[1], { hip: { x: -2, y: 2 }, twist: -0.4, lean: -0.1 }), 'charge'),
      beat(60, plus(arc[2], { hip: { x: 0, y: 1 }, twist: 0, lean: 0.02 })),
      beat(60, plus(arc[3], { hip: { x: 2 }, twist: 0.8, lean: 0.12 }), 'release'),
      beat(80, plus(arc[4], { hip: { x: 2 }, twist: 0.6, lean: 0.1, footF: { step: [2, 0], lift: 0 } }), 'contact'),
      beat(200, plus(arc[4], { hip: { x: 1 }, twist: 0.2, lean: 0.04, footF: { step: [2, 0], lift: 0 } }), 'recover'),
    ]);
  } else if (name === 'titan') {
    attack = once([
      beat(180, { hip: { x: -2, y: 2 }, twist: -0.4, lean: -0.1, armN: { hand: at('N', -0.1, -0.4) } }, 'charge'),
      beat(200, { hip: { x: -3, y: 2 }, twist: -0.5, lean: -0.12, armN: { hand: at('N', -0.15, -0.45) }, footF: { step: [1, 0], lift: 2 } }),
      beat(60, { hip: { x: 3 }, twist: 0.6, lean: 0.12, armN: { hand: at('N', 0.85, -0.3) }, footF: { step: [4, 0], lift: 0 }, slots: { head: 'head.front' } }, 'release'),
      beat(80, { hip: { x: 4 }, twist: 1, lean: 0.16, armN: { hand: at('N', 0.93, -0.25) }, footF: { step: [4, 0], lift: 0 }, slots: { head: 'head.front' } }, 'contact'),
      beat(220, { hip: { x: 2 }, twist: 0.4, lean: 0.06, armN: { hand: at('N', 0.5, 0.45) }, footF: { step: [4, 0], lift: 0 } }, 'recover'),
      beat(160, { footF: { step: [2, 0], lift: 2 } }),
    ]);
  } else if (name === 'golem') {
    attack = once([
      beat(220, { hip: { y: 2 }, lean: -0.1, armN: { hand: at('N', 0.15, -0.9) }, armF: { hand: at('F', 0.1, -0.9) } }, 'charge'),
      beat(70, { hip: { y: -1 }, lean: 0.04, armN: { hand: at('N', 0.55, -0.7) }, armF: { hand: at('F', 0.35, -0.7) } }),
      beat(60, { hip: { y: 3, x: 1 }, lean: 0.14, armN: { hand: at('N', 0.85, 0.35) }, armF: { hand: at('F', 0.45, 0.6) } }, 'release'),
      beat(90, { hip: { y: 3, x: 1 }, lean: 0.15, armN: { hand: at('N', 0.85, 0.4) }, armF: { hand: at('F', 0.45, 0.65) } }, 'contact'),
      beat(240, { hip: { y: 1, x: 1 }, lean: 0.06, armN: { hand: at('N', 0.4, 0.75) }, armF: { hand: at('F', 0.35, 0.75) } }, 'recover'),
    ]);
  } else {
    attack = once([
      beat(120, { hip: { y: 3 }, lean: 0.12, armN: { hand: at('N', -0.3, 0.6) } }, 'charge'),
      beat(50, { dx: 4, lift: 2, lean: 0.2, armN: { hand: at('N', 0.6, -0.4) }, armF: { hand: at('F', 0.5, -0.3) }, footN: { step: [2, 0], lift: 2 } }),
      beat(50, { dx: 8, lean: 0.25, armN: { hand: at('N', 0.95, -0.1) }, armF: { hand: at('F', 0.85, 0) }, footN: { step: [3, 0], lift: 0 } }, 'release'),
      beat(80, { dx: 8, hip: { y: 2 }, lean: 0.28, armN: { hand: at('N', 0.95, 0) }, armF: { hand: at('F', 0.85, 0.1) }, footN: { step: [3, 0], lift: 0 } }, 'contact'),
      beat(120, { dx: 5, lift: 2, lean: 0.12, footN: { step: [1, 0], lift: 2 } }, 'recover'),
      beat(100, { dx: 1, hip: { y: 1 } }),
    ]);
  }
  return { idle, guard, attack, roar, hit };
}

/** A paper member as a planArt input (mannequin parts + preview-only demo keys). */
export function paperMember(name: PaperName): BipedMember<Fx> {
  const p = PAPER[name];
  const mats: Record<PaperName, string> = { sentinel: 'stone', titan: 'stone', golem: 'crystal', assassin: 'hide' };
  return {
    id: p.id,
    tier: 'normal',
    frame: p.frame,
    build: p.build,
    materials: { body: mats[name] },
    fx: { eye: 1 },
    parts: mannequin(name),
    anims: demoAnims(name),
    weight: name === 'assassin' ? 'mediumLight' : 'heavy',
    points: name === 'sentinel' ? { muzzle: 'handN' } : undefined,
    distinction: { silhouette: 'paper', rhythm: 'paper', idle: 'paper', guard: 'paper', signaturePart: 'paper', material: mats[name], signatureMove: 'paper (preview-only demo keys)' },
  };
}

// ------------------------------------------------------------------ the page

const JOINT_COL: Record<string, number> = { handN: PAL.crim3, handF: PAL.water3, head: PAL.gold3, hip: PAL.leaf3, footN: PAL.steel, footF: PAL.steel };
const colOf = (j: string) => JOINT_COL[j] ?? PAL.mag3;

/** Art px → cell px (×s; mirror = the P2 flip). */
const cellXY = (v: V, s: number, w: number, mirror: boolean): [number, number] => [Math.floor((mirror ? w - v[0] : v[0]) * s), Math.floor(v[1] * s)];

/** The skeleton of one rig drawn at ×s into q: bones (far limbs dimmer), joints as dots. */
function skeleton(q: PixelCanvas, rig: BipedRig, s: number, w: number, mirror: boolean, near: number, far: number): void {
  const line = (a: V, b: V, c: number) => {
    const [x0, y0] = cellXY(a, s, w, mirror);
    const [x1, y1] = cellXY(b, s, w, mirror);
    q.line(x0, y0, x1, y1, c);
  };
  if (rig.spout) {
    line(rig.spout.base, rig.spout.mid, near);
    line(rig.spout.mid, rig.spout.top, near);
  } else {
    line(rig.hipF, rig.legF.mid, far);
    line(rig.legF.mid, rig.legF.end, far);
    line(rig.hipN, rig.legN.mid, near);
    line(rig.legN.mid, rig.legN.end, near);
  }
  line(rig.hipN, rig.hipF, near);
  line(rig.pelvis, rig.waist, near);
  line(rig.waist, rig.chest, near);
  line(rig.shoulderN, rig.shoulderF, near);
  line(rig.chest, rig.head, near);
  if (rig.build.farArm !== 'hidden') {
    line(rig.shoulderF, rig.armF.mid, far);
    line(rig.armF.mid, rig.armF.end, far);
  }
  line(rig.shoulderN, rig.armN.mid, near);
  line(rig.armN.mid, rig.armN.end, near);
}

function dot(q: PixelCanvas, v: V, s: number, w: number, mirror: boolean, c: number, size: number): void {
  const [x, y] = cellXY(v, s, w, mirror);
  q.rect(x - (size >> 1), y - (size >> 1), size, size, c);
}

/** The frame a skeleton ghost shows: &frame=, else the anim's release (or contact / impact) mark, else its middle. */
function keyFrame(art: PaperArt, anim: AnyMonsterAnim, frame: number): number {
  const spec = (art.anims as Record<string, AnimSpec | undefined>)[anim] ?? art.extraAnims?.[anim as never];
  if (!spec) return -1;
  if (frame >= 0) return Math.min(frame, spec.frames - 1);
  return spec.marks?.release ?? spec.marks?.contact ?? spec.marks?.impact ?? Math.floor(spec.frames / 2);
}

function cell(art: PaperArt, name: PaperName, anim: AnyMonsterAnim, frame: number, s: number, p2: boolean, o: { bodies: boolean; tracks: boolean; bones: boolean }): PixelCanvas {
  const w = art.w;
  const body = new PixelCanvas(art.w, art.h);
  if (o.bodies) {
    const opts = { lightFrom: p2 ? ('right' as const) : ('left' as const) };
    const a = frame >= 0 ? anim : 'idle';
    const f = frame >= 0 ? keyFrame(art, anim, frame) : 0;
    if ((MONSTER_ANIMS as readonly string[]).includes(a)) art.draw(body, a as MonsterAnim, f, opts);
    else art.drawExtra?.(body, a as MonsterAnimExtra, f, opts);
  }
  const q = (p2 ? body.flippedX() : body).scaled(s);
  q.frame(0, 0, q.w, q.h, PAL.night3);
  q.hline(1, q.w - 2, art.anchorY * s, PAL.night4);
  dot(q, [art.anchorX, art.anchorY], s, w, p2, PAL.leaf4, 3);
  // the rest skeleton (idle f0) and the key pose of the anim (gold ghost)
  if (o.bones) skeleton(q, art.rig('idle', 0), s, w, p2, PAL.white, PAL.mist);
  const kf = keyFrame(art, anim, frame);
  if (o.bones && kf >= 0) skeleton(q, art.rig(anim, kf), s, w, p2, PAL.gold3, PAL.gold1);
  // joint tracks: every frame of the anim, joined in time order
  const spec = (art.anims as Record<string, AnimSpec | undefined>)[anim] ?? art.extraAnims?.[anim as never];
  if (o.tracks && spec) {
    const frames = Array.from({ length: spec.frames }, (_, f) => art.joints(anim, f));
    for (const k of Object.keys(frames[0])) {
      for (let f = 1; f < frames.length; f++) {
        const a = frames[f - 1][k];
        const b = frames[f][k];
        if (!a || !b) continue;
        const [x0, y0] = cellXY([a.x, a.y], s, w, p2);
        const [x1, y1] = cellXY([b.x, b.y], s, w, p2);
        q.line(x0, y0, x1, y1, colOf(k));
      }
      for (const j of frames) if (j[k]) dot(q, [j[k].x, j[k].y], s, w, p2, colOf(k), 2);
    }
  }
  if (o.bones) for (const [k, v] of Object.entries(art.joints('idle', 0))) dot(q, [v.x, v.y], s, w, p2, colOf(k), 3);
  return q;
}

const preview: DevPreview = {
  name: 'bodyplan',
  description: "a body plan's paper members: &plan=biped &anim=attack|idle|guard|roar|hit &frame=N &bodies=0 &tracks=0 &bones=0",
  create(scene, params) {
    const plan = params.get('plan') ?? 'biped';
    if (plan !== 'biped') throw new Error(`?dev=bodyplan: unknown plan '${plan}' (A3 has biped)`);
    const anim = (params.get('anim') ?? 'attack') as AnyMonsterAnim;
    const frame = Number(params.get('frame') ?? -1);
    const o = { bodies: params.get('bodies') !== '0', tracks: params.get('tracks') !== '0', bones: params.get('bones') !== '0' };
    scene.cameras.main.setBackgroundColor(PAL.night1);
    pixelText(scene, 4, 2, `biped v${biped.version} · ${anim}: beyaz idle f0, altın anahtar poz, renkli eklem izleri · P1 üstte, P2 altta`, { size: 'sm', color: PAL.mist });
    const S = 2;
    PAPER_NAMES.forEach((name, i) => {
      const art = planArt(biped, paperMember(name));
      const b = PAPER[name].build;
      const cx = i * 160 + 80;
      for (const p2 of [false, true]) {
        const q = cell(art, name, anim, frame, S, p2, o);
        const key = `bodyplan:${name}:${p2 ? 'p2' : 'p1'}:${anim}:${frame}:${o.bodies ? 1 : 0}${o.tracks ? 1 : 0}${o.bones ? 1 : 0}`;
        if (!scene.textures.exists(key)) scene.textures.addCanvas(key, q.toCanvas());
        const bottom = p2 ? 346 : 174;
        scene.add.image(Math.round(cx - q.w / 2), bottom - q.h, key).setOrigin(0);
      }
      const tag = `${name} · ${b.preset}${b.lower !== 'legs' ? ' · ' + b.lower : ''}${b.farArm !== 'free' ? ' · ' + b.farArm : ''}`;
      pixelText(scene, cx, 176, tag, { size: 'sm', color: PAL.steel, originX: 0.5 });
      pixelText(scene, cx, 349, `poseKnockPx ${art.poseKnockPx?.join('/')} · L${Math.max(...Object.values(art.levels).map((v) => v ?? 0))}`, { size: 'sm', color: PAL.night4, originX: 0.5 });
    });
  },
};

export default preview;
