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
};

export default PACK;
