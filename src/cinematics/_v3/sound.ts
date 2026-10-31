// v3 SOUND KIT (docs/ANIMASYON_PLANI.md §5b): every slice sound is fired from the animation mark
// it belongs to, and the character / material tables pick WHICH sound. ?look=v3 only — the old
// look never calls in here (its cinematics keep their own sound calls, unchanged).
//
//   atFrame(u, 'attack', relF, () => play('wyrmBreathFire'))   — on the frame the sprite shows it
//   atMark(u, 'death', 'dissolve', () => …)                      — the same, by the anim's mark
//   const h = start('wyrmBreathCharge'); …; h.stop(80)           — a sustained sound ends on a mark
//   quietCombat(() => combatImpact(…))                           — a shared combat effect without
//                                                                  its generic sound (we score it)
//   hitSoundFor(u, { kind, heavy })                              — the struck body's material
//
// Sync: atFrame listens to the sprite's own ANIMATION_UPDATE, so the sound starts in the very tick
// the mark frame is set on the sprite (it is on screen at that tick's render): drift 0 frames.
// Speed: marks follow the scene clock, so at 2× / 3× every sound still starts on its frame;
// sustained sounds are faded on the mark that ends their picture (never outlive it).

import type Phaser from 'phaser';
import { sfx, type SfxHandle, type SfxName, type SfxOpts } from '../../audio/sfx';
import type { AnimMark, AnyMonsterAnim } from '../../art/types';
import type { CardId } from '../../data/cards';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { LOOK_V3 } from '../../view/layout';
import { setCombatSfx } from '../../vfx/combat';
import { hitSfxName } from '../../audio/v3/materials';
import { HARPOONER_VOICE } from '../../audio/v3/tide_harpooner';
import { voiceSounds } from '../../audio/v3/voices';
import type { MaterialId } from '../../art/materials';
import { v3Recipe } from '../../presentation/registry';
import type { BlowKind } from './blow';

// ================================================================ play

/** Play a sound (never throws). */
export function play(name: SfxName, opts?: SfxOpts): void {
  try {
    sfx.play(name, opts);
  } catch {
    /* audio never breaks a cinematic */
  }
}

const NO_HANDLE: SfxHandle = { stop: () => undefined };

/** Start a sustained sound; its handle fades it out (stop(ms)) on the mark that ends its picture. */
export function start(name: SfxName, opts?: SfxOpts): SfxHandle {
  try {
    return sfx.start(name, opts);
  } catch {
    return NO_HANDLE;
  }
}

/** Run `fn` with these sounds skipped (a shared effect inside it would play them; we score the beat). */
export function hush<T>(names: readonly SfxName[], fn: () => T): T {
  return sfx.hush(names, fn);
}

/** Fade out the still playing voices of these sounds (a character's own sound takes the beat over). */
export function fade(names: readonly SfxName[], ms?: number): void {
  try {
    sfx.fade(names, ms);
  } catch {
    /* audio never breaks a cinematic */
  }
}

/**
 * Run `fn` (a synchronous call into vfx/combat: impact(), blockClang()...) with combat's own sound
 * beats off: their sfx.play happens synchronously at the call, so it is skipped and nothing else.
 */
export function quietCombat<T>(fn: () => T): T {
  setCombatSfx(false);
  try {
    return fn();
  } finally {
    setCombatSfx(true);
  }
}

// ================================================================ marks

/**
 * Call `cb` in the tick unit `u` shows frame `frame` (or later) of `anim`. Already there: at once
 * (unless `late: false`). Cancelled when the sprite goes, when another anim replaces this one after
 * it had started (it never reached the frame), or after `maxMs` of scene time. Returns a canceller.
 */
export function atFrame(u: MonsterUnit, anim: AnyMonsterAnim, frame: number, cb: () => void, o: { late?: boolean; maxMs?: number } = {}): () => void {
  const s = u.sprite;
  let done = false;
  let seen = false;
  const fire = () => {
    if (done) return;
    finish();
    try {
      cb();
    } catch (e) {
      console.error('[sound] atFrame', e);
    }
  };
  const check = (): boolean => {
    const fi = u.frameInfo();
    if (fi.anim === anim) {
      if (fi.frame >= frame) {
        if (seen || o.late !== false) fire();
        else finish();
        return true;
      }
      seen = true;
    } else if (seen) {
      finish(); // replaced before it reached the frame
      return true;
    }
    return false;
  };
  const onUpdate = () => {
    if (!done) check();
  };
  let timer: Phaser.Time.TimerEvent | null = null;
  const finish = () => {
    if (done) return;
    done = true;
    s.off('animationupdate', onUpdate);
    s.off('animationstart', onUpdate);
    s.off('destroy', finish);
    timer?.remove(false);
  };
  if (!s.active) return () => undefined;
  if (check()) return () => undefined;
  s.on('animationupdate', onUpdate);
  s.on('animationstart', onUpdate);
  s.once('destroy', finish);
  try {
    timer = s.scene.time.delayedCall(o.maxMs ?? 6000, finish);
  } catch {
    timer = null;
  }
  return finish;
}

/** atFrame on a named mark of the anim (MonsterUnit.markFrame; `fallback` frame without one). */
export function atMark(u: MonsterUnit, anim: AnyMonsterAnim, mark: AnimMark, cb: () => void, o: { fallback?: number; late?: boolean; maxMs?: number } = {}): () => void {
  return atFrame(u, anim, u.markFrame(anim, mark, o.fallback), cb, o);
}

// ================================================================ characters

/** A monster's own sounds (its parameter set over the v3 recipes, src/audio/v3/slice.ts). */
export interface CharacterSounds {
  /** The cut-in's eye flare / a roar of the summon reveal. */
  roar: SfxName;
  /** Summon: the entrance opening (a presence / the light column arriving). */
  arrive: SfxName;
  /** Summon 'land' mark. */
  land: SfxName;
  /** Strike: the gathering (sustained; stopped on 'release'). */
  charge: SfxName;
  /** Strike: the frame before the release (a swing smear), if any. */
  swing?: SfxName;
  /** Strike 'release' mark. */
  release: SfxName;
  /** Strike: the attack's own accent on the contact frame (the struck body adds its material). */
  impact: SfxName;
  /** Death: the second frame (the first beat of the death itself, after the blow's own sound). */
  deathStart?: SfxName;
  /** Death 'dissolve' mark. */
  dissolve: SfxName;
  /** Death: frames after 'dissolve' with their own beat ([offset from dissolve, sound, volume]). */
  afterDissolve?: readonly (readonly [number, SfxName, number])[];
  /** Death: the body breaks (the material burst; replaces the generic shatter sound). */
  burst: SfxName;
  /** Revive: the gathering (sustained; stopped on 'land'). */
  reviveGather: SfxName;
  /** Revive 'land' mark. */
  reviveLand: SfxName;
}

export const CHARACTER_SOUNDS: Partial<Record<CardId, CharacterSounds>> = {
  tide_harpooner: HARPOONER_VOICE,
  crystal_wyrm: {
    roar: 'wyrmRoar',
    arrive: 'wyrmChime',
    land: 'wyrmLand',
    charge: 'wyrmBreathCharge',
    release: 'wyrmBreathFire',
    impact: 'wyrmBreathImpact',
    deathStart: 'wyrmCrack',
    dissolve: 'wyrmDrain',
    burst: 'wyrmShatter',
    reviveGather: 'wyrmReviveGather',
    reviveLand: 'wyrmReviveLock',
  },
  abyss_magus: {
    roar: 'magusCall',
    arrive: 'magusPresence',
    land: 'magusLand',
    charge: 'magusCharge',
    swing: 'magusSwing',
    release: 'magusOrbRelease',
    impact: 'magusOrbBurst',
    dissolve: 'magusCollapse',
    // the staff hits the floor (dissolve + 1), its orb end bounces and lies (dissolve + 3)
    afterDissolve: [
      [1, 'magusStaffDrop', 0.9],
      [3, 'magusStaffDrop', 0.4],
    ],
    burst: 'magusDissolve',
    reviveGather: 'magusReviveGather',
    reviveLand: 'magusReviveSettle',
  },
};

/**
 * The character sound set of a card (v3 look only; null: it keeps the generic sounds). A3 bridge
 * (A3_MIMARI §6.4): a monster with v3 art and a recipe speaks with its recipe's voice — a VoicePreset's
 * generated role set (src/audio/v3/voices.ts), or the hand-made set it names (`{ custom }`, the aces);
 * otherwise today's table.
 */
export function soundsOf(id: CardId | null | undefined): CharacterSounds | null {
  if (!LOOK_V3 || !id) return null;
  const v = v3Recipe(id)?.voice;
  if (v && !('custom' in v)) return voiceSounds(id);
  return CHARACTER_SOUNDS[(v?.custom ?? id) as CardId] ?? null;
}

/** The card of a blow's source (react.ts `by`: a unit, a monster art, `{ art }`, a weight class). */
export function sourceCard(by: unknown): CardId | null {
  if (!by || typeof by !== 'object') return null;
  const o = by as { cardId?: unknown; id?: unknown; art?: { id?: unknown } };
  const id = typeof o.cardId === 'string' ? o.cardId : typeof o.id === 'string' ? o.id : typeof o.art?.id === 'string' ? o.art.id : null;
  return (id as CardId | null) ?? null;
}

// ================================================================ the held charge (declare → strike)

/**
 * The declaration shows the strike's own charge pose (battle/declare.ts) and holds it until the
 * battle starts: the character's charge sound starts on THAT frame (sound QA S3: it started 10
 * frames later, with the strike) and the strike takes the very voice over (takeCharge), so the
 * gathering is one sound from the first charge frame to the release.
 */
interface HeldCharge {
  h: SfxHandle;
  name: SfxName;
  /** Scene time it started. */
  at: number;
}
const held = new Map<number, HeldCharge>();
/** A strike takes the declaration's charge over only when it follows at once (≤ this, scene ms). */
const TAKE_MS = 320;

/** The attacker's charge pose is on screen (the declaration): its own charge sound starts now. */
export function holdCharge(u: MonsterUnit, o: { volume?: number } = {}): void {
  const C = soundsOf(u.cardId);
  if (!C) return;
  dropCharge(u, 40);
  const h = start(C.charge, { volume: o.volume ?? 0.85, pan: panAt(u.home.x) });
  held.set(u.uid, { h, name: C.charge, at: u.sprite.scene?.time.now ?? 0 });
}

/**
 * The strike's charge sound: the declaration's own voice when the strike follows it at once (the
 * same gathering goes on), else a fresh one (a long hold: a trap prompt, a flip — the declaration's
 * has ended or is faded here).
 */
export function takeCharge(u: MonsterUnit, name: SfxName, opts?: SfxOpts): SfxHandle {
  const c = held.get(u.uid);
  held.delete(u.uid);
  const now = u.sprite.scene?.time.now ?? 0;
  if (c && c.name === name && now - c.at <= TAKE_MS) return c.h;
  c?.h.stop(80);
  return start(name, opts);
}

/** The declaration let go without a strike (released / negated): its charge sound fades. */
export function dropCharge(u: MonsterUnit, ms = 120): void {
  const c = held.get(u.uid);
  if (!c) return;
  held.delete(u.uid);
  c.h.stop(ms);
}

/** Every held charge fades (a trap springs on the declaration: the trap's snap takes the beat). */
export function dropAllCharges(ms = 120): void {
  for (const c of held.values()) c.h.stop(ms);
  held.clear();
}

// ================================================================ struck bodies

/** The game tick of the last time each material recipe was played (playHit). */
const hitTick = new Map<SfxName, number>();

/**
 * Play the struck body's material sound. Two bodies of the same material struck on one frame (a
 * defender and the attacker its counter kills) never ask for the same recipe twice — the engine's
 * 30 ms rule would drop the second one, the louder lethal blow included (sound QA #8): the second
 * takes its weight variant (Heavy when it is heavy, else Light), a different texture on the frame.
 */
export function playHit(scene: Phaser.Scene, name: SfxName, o: { heavy: boolean; volume: number; pan: number }): void {
  let tick = -1;
  try {
    tick = scene.game.loop.frame;
  } catch {
    tick = -1;
  }
  let n = name;
  let volume = o.volume;
  if (tick >= 0 && hitTick.get(n) === tick) {
    const alt = String(n).replace(/(Light|Heavy|Magic)$/, o.heavy ? 'Heavy' : 'Light') as SfxName;
    if (alt !== n && hitTick.get(alt) !== tick) {
      n = alt;
      // (−2 dB: the two bodies' thumps land together; they must not sum into a doubled low end)
      volume *= 0.8;
    }
  }
  if (tick >= 0) hitTick.set(n, tick);
  play(n, { volume, pan: o.pan });
}

// ================================================================ materials

/** A struck body's material: the slice's three, or (A3) any material-library id a recipe names. */
export type Material = 'crystal' | 'metal' | 'cloth' | MaterialId;

/**
 * What a body is made of where a blow lands: the wyrm is crystal; the magus is metal armour to a
 * body blow (helm, breastplate, pauldrons) and cloth + shadow to a spell (the robe, the void).
 * Other monsters: null (the generic impact until A4 gives them theirs). A3 bridge (A3_MIMARI §6.4):
 * in the v3 look a monster with v3 art and a recipe is what its recipe's `body` says (a spell lands
 * on `body.magic` when it names one).
 */
export function materialOf(id: CardId | null | undefined, kind: BlowKind): Material | null {
  const b = v3Recipe(id)?.body;
  if (b) return kind === 'magic' ? (b.magic ?? b.physical) : b.physical;
  if (id === 'crystal_wyrm') return 'crystal';
  if (id === 'abyss_magus') return kind === 'magic' ? 'cloth' : 'metal';
  return null;
}

/**
 * The struck body's impact sound (material × light / heavy / magic), or null for the generic one.
 * The name comes from src/audio/v3/materials.ts hitSfxName: the slice's three materials give exactly
 * the slice names (hitCrystal* / hitMetal* / hitCloth*), a library material its generated hit
 * (A3: hitStone*), one without a hit recipe yet null.
 */
export function hitSoundFor(u: MonsterUnit | null | undefined, o: { kind: BlowKind; heavy: boolean }): SfxName | null {
  if (!LOOK_V3 || !u) return null;
  const m = materialOf(u.cardId, o.kind);
  if (!m) return null;
  try {
    return hitSfxName(m, o.kind === 'magic' ? 'Magic' : o.heavy ? 'Heavy' : 'Light');
  } catch {
    return null; // an unknown material id (tests/presentation/recipes.test.ts keeps them known): the generic impact
  }
}

/** Stereo position of a world x (gentle: ±0.35 at the screen edges). */
export function panAt(x: number): number {
  return Math.max(-0.35, Math.min(0.35, ((x - 320) / 320) * 0.35));
}
