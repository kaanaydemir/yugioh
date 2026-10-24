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
};

export default PACK;
