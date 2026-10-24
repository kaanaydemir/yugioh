// Scenario pack of lane A5-A (docs/v3/A5_PLAN.md §5.1): the spell / trap scenes' new keys (e.g. a5MirrorTriple, a5ChasmWyrm).
// A56.0: created empty so the pack exists from day one; the lane fills it (Action steps and / or UI
// steps: src/duel/scenarios.ts UiStep). Shared UI scenarios live in ./a6-base.ts (frozen).
import type { Scenario } from '../scenarios';

const PACK: Record<string, Scenario> = {
  // A-3 (§3.2): the v3-drawn slice monsters (Taş Muhafız EARTH, Kristal Ejder LIGHT, Uçurum Büyücüsü
  // DARK) take no beat; the old-art Kor Kurdu (FIRE) and Gelgit Golemi (WATER) do — the edge light,
  // the steam threads and the auras on bodies the effect never poses, tints or moves.
  a5VolcanoSlice: {
    desc: 'Volkan Arenası over the v3 slice: Muhafız / Ejder / Büyücü no beat, Kurt (FIRE) + Golem (WATER) beats',
    stage: { p0: { hand: ['volcano_arena'], monsters: ['stone_sentinel', 'ember_wolf', 'crystal_wyrm'] }, p1: { monsters: ['tide_golem', 'abyss_magus'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('volcano_arena', 0) })],
  },
  // A-4 (§3.3): Ayna Kalkanı over the v3 slice. P2's Kristal Ejder attacks P1's Taş Muhafız; P1 springs
  // the mirror: both of P2's attack-position monsters — the Ejder and Uçurum Büyücüsü, v3 art — die
  // their own v3 deaths, one after the other (nearest to the panel first), 220 ms between contacts.
  a5MirrorSlice: {
    desc: 'Ayna Kalkanı (P1) vs P2 Kristal Ejder: P2 Ejder + Büyücü (attack) die their v3 deaths in order',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm', 'abyss_magus'] }, p0: { monsters: [null, 'stone_sentinel'], spellTraps: [null, 'mirror_barrier'] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 0, targetZone: 1 }, (D) => ({ type: 'respond', player: 0, uid: D.uid('mirror_barrier', 0) })],
  },
  // A-4 (§3.3, §6.3): three victims — the 2.6 s ceiling. P1's Suikastçı (the declared attacker, centre
  // lane, melee: its lunge into the panel is in plain sight) attacks P2's Taş Muhafız; Kor Kurdu and
  // Volt Kertenkele stand next to it, all three in attack position, so all three are reflected.
  a5MirrorTriple: {
    desc: 'Ayna Kalkanı vs three attack-position monsters (Kurt, Suikastçı, Kertenkele): three reflections in order, ≤ 2.6 s',
    stage: { phase: 'battle', active: 0, p0: { monsters: ['ember_wolf', 'shade_assassin', 'volt_lizard'] }, p1: { monsters: [{ id: 'tide_golem', position: 'defense' }, 'stone_sentinel'], spellTraps: [null, 'mirror_barrier'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }, (D) => ({ type: 'respond', player: 1, uid: D.uid('mirror_barrier', 1) })],
  },
  // A-5 (§3.4): Yer Yarığı on a v3-drawn victim. P1 tribute-summons Kristal Ejder (2 tributes) into the
  // middle zone; P2's Yer Yarığı (middle S/T) answers: the crack runs straight down the board, the wyrm
  // takes its hitHeavy struck frame as the floor gives way and sinks behind the hole's front lip.
  a5ChasmWyrm: {
    desc: 'Yer Yarığı (P2) swallows a tribute-summoned Kristal Ejder: v3 struck frame, the fall behind the lip',
    stage: { p0: { hand: ['crystal_wyrm'], monsters: ['stone_sentinel', null, 'lumen_sprite'] }, p1: { spellTraps: [null, 'chasm_trap'] } },
    steps: [
      (D) => ({ type: 'normalSummon', player: 0, uid: D.uid('crystal_wyrm', 0), zone: 1, tributes: [D.uid('stone_sentinel', 0), D.uid('lumen_sprite', 0)] }),
      (D) => ({ type: 'respond', player: 1, uid: D.uid('chasm_trap', 1) }),
    ],
  },
  // A-5 (§3.4, P2 mirrored): P2 tribute-summons Uçurum Büyücüsü (v3 art); P1's Yer Yarığı swallows it before
  // its tribute effect (destroy a spell / trap) can resolve — the trap window comes first (engine).
  a5ChasmMagusP2: {
    desc: 'P2 tribute-summons Uçurum Büyücüsü, P1 Yer Yarığı swallows it (mirrored; its effect never resolves)',
    stage: { active: 1, p1: { hand: ['abyss_magus'], monsters: [null, null, 'thorn_lurker'] }, p0: { spellTraps: [null, null, 'chasm_trap'] } },
    steps: [
      (D) => ({ type: 'normalSummon', player: 1, uid: D.uid('abyss_magus', 1), zone: 1, tributes: [D.uid('thorn_lurker', 1)] }),
      (D) => ({ type: 'respond', player: 0, uid: D.uid('chasm_trap', 0) }),
    ],
  },
  // A-2 (§3.1): Ejder Kılıcı on v3-drawn monsters. P2 equips its Kristal Ejder from the hand (mirrored:
  // the great sword rises from P2's far spell zone, binds behind the wyrm's back on the screen's right,
  // the wyrm's victory peak is held; its drawings stay lit from the screen's top left).
  a5BladeWyrmP2: {
    desc: 'P2 Ejder Kılıcı on its Kristal Ejder (mirrored; v3 bond pose, the sword on the right)',
    stage: { active: 1, p1: { hand: ['dragon_blade'], monsters: [null, null, 'crystal_wyrm'] }, p0: { monsters: [null, 'ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 1, uid: D.uid('dragon_blade', 1), zone: 2, target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 2 } } })],
  },
  // A-2 (§3.1): P1 equips Uçurum Büyücüsü (v3 art: its own victory peak, the orb star) from the hand.
  a5BladeMagus: {
    desc: 'Ejder Kılıcı from the hand on Uçurum Büyücüsü (v3 bond pose)',
    stage: { p0: { hand: ['dragon_blade'], monsters: [null, 'abyss_magus'] }, p1: { monsters: [null, 'tide_golem'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('dragon_blade', 0), zone: 1, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 1 } } })],
  },
};

export default PACK;
