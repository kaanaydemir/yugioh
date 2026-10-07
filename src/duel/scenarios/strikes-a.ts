// QA scenarios for the strikes-a cinematics (crystal_wyrm, abyss_magus, magma_titan,
// coral_serpent, ember_wolf, tide_golem): every attack case (vs ATK, vs DEF / face-down, blocked,
// direct, player 2), the monster effects and the flavoured deaths.
//
//   node tools/shot.mjs "?dev=duel&s=saWyrmAtk" --film 30 --every 100 --cols 6
import type { CardId } from '../../data/cards';
import type { Action, PlayerId } from '../../engine/types';
import type { Scenario, Step } from '../scenarios';
import type { MonSpec, StageSpec } from '../scenario';

const atk = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });

const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

/** One attack: p0 (or p1 with p2=true) attacks from zone 1 into zone `tz` of the other side. */
function duel(desc: string, attacker: MonSpec, defender: MonSpec | null, o: { p2?: boolean; tz?: number | null; az?: number; extra?: Partial<StageSpec> } = {}): Scenario {
  const p2 = !!o.p2;
  const az = o.az ?? 1;
  const tz = o.tz === undefined ? (defender ? 1 : null) : o.tz;
  const mine: (MonSpec | null)[] = [null, null, null];
  mine[az] = attacker;
  const theirs: (MonSpec | null)[] = [null, null, null];
  if (defender && tz !== null) theirs[tz] = defender;
  const p0 = { monsters: p2 ? theirs : mine };
  const p1 = { monsters: p2 ? mine : theirs };
  const stage: StageSpec = {
    ...(o.extra ?? {}),
    phase: 'battle',
    active: p2 ? 1 : 0,
    p0: { ...p0, ...(o.extra?.p0 ?? {}), monsters: o.extra?.p0?.monsters ?? p0.monsters },
    p1: { ...p1, ...(o.extra?.p1 ?? {}), monsters: o.extra?.p1?.monsters ?? p1.monsters },
  };
  return { desc, stage, steps: [atk(az, tz, p2 ? 1 : 0)] };
}

const def = (id: CardId, faceUp = true): MonSpec => ({ id, position: 'defense', faceUp });

const scenarios: Record<string, Scenario> = {
  // ---------------------------------------------------------------- Kristal Ejder
  saWyrmAtk: duel('Kristal Ejder prism breath destroys Uçurum Büyücüsü (crystal impact, magus death)', 'crystal_wyrm', 'abyss_magus'),
  saWyrmDef: duel('Kristal Ejder vs a face-down Gelgit Golemi (flip, destroyed, counter-splash 300)', 'crystal_wyrm', def('tide_golem', false)),
  saWyrmBlocked: duel('Kristal Ejder vs a Kristal Ejder with Ejder Kılıcı: attacker destroyed (crystals crack)', 'crystal_wyrm', 'crystal_wyrm', {
    extra: { p1: { spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
  }),
  saWyrmBoth: duel('Kristal Ejder vs Kristal Ejder: both destroyed', 'crystal_wyrm', 'crystal_wyrm'),
  saWyrmDirect: duel('Kristal Ejder direct attack', 'crystal_wyrm', null),
  saWyrmP2: duel('player 2 Kristal Ejder breath on Magma Titanı (mirrored)', 'crystal_wyrm', 'magma_titan', { p2: true }),
  saWyrmP2Direct: duel('player 2 Kristal Ejder direct attack', 'crystal_wyrm', null, { p2: true }),
  saWyrmWide: duel('Kristal Ejder from zone 0 straight across to zone 0 (horizontal beam)', 'crystal_wyrm', 'ember_wolf', { az: 0, tz: 0 }),

  // ---------------------------------------------------------------- Uçurum Büyücüsü
  saMagusAtk: duel('Uçurum Küresi destroys Kor Kurdu (implosion)', 'abyss_magus', 'ember_wolf'),
  saMagusDef: duel('Uçurum Küresi vs a defending Taş Muhafız (2300 > 2100)', 'abyss_magus', def('stone_sentinel')),
  saMagusBlocked: duel('Uçurum Büyücüsü vs Kristal Ejder: orb fizzles, magus destroyed (void death)', 'abyss_magus', 'crystal_wyrm'),
  saMagusDirect: duel('Uçurum Küresi direct attack', 'abyss_magus', null),
  saMagusP2: duel('player 2 Uçurum Küresi on Mercan Yılanı', 'abyss_magus', 'coral_serpent', { p2: true }),
  saMagusEffect: {
    desc: 'Uçurum Büyücüsü tribute summon → shadow tendril swallows a set trap',
    stage: { p0: { hand: ['abyss_magus'], monsters: [null, 'ember_wolf'] }, p1: { spellTraps: [null, 'mirror_barrier', null] } },
    steps: [summon('abyss_magus', 1, ['ember_wolf']), { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 1 } }],
  },
  saMagusEffectField: {
    desc: 'Uçurum Büyücüsü swallows the opponent\'s Volkan Arenası (arena cools, stats return)',
    stage: { p0: { hand: ['abyss_magus'], monsters: [null, null, 'tide_golem'] }, p1: { field: 'volcano_arena', monsters: [null, 'ember_wolf'] } },
    steps: [summon('abyss_magus', 2, ['tide_golem']), { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'field', index: 0 } }],
  },
  saMagusEffectP2: {
    desc: 'player 2 Uçurum Büyücüsü swallows player 1\'s set card',
    stage: { active: 1, p1: { hand: ['abyss_magus'], monsters: [null, 'stone_sentinel'] }, p0: { spellTraps: [null, null, 'judgment_bolt'] } },
    steps: [summon('abyss_magus', 1, ['stone_sentinel'], 1), { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'spellTrap', index: 2 } }],
  },

  // ---------------------------------------------------------------- Magma Titanı
  saTitanAtk: duel('Lav Yumruğu destroys Mercan Yılanı (lava splash, serpent death)', 'magma_titan', 'coral_serpent'),
  saTitanDef: duel('Lav Yumruğu vs a face-down Fırtına Atmacası (flip, destroyed)', 'magma_titan', def('storm_hawk', false)),
  saTitanBlocked: duel('Magma Titanı punches Kristal Ejder: bounced, titan crumbles into cooling rock', 'magma_titan', 'crystal_wyrm'),
  saTitanEqual: duel('Magma Titanı vs a defending Taş Muhafız with equal 2100: nothing breaks', 'magma_titan', def('stone_sentinel')),
  saTitanDirect: duel('Lav Yumruğu direct attack (charges across the field)', 'magma_titan', null),
  saTitanP2: duel('player 2 Lav Yumruğu on Kor Kurdu (mirrored)', 'magma_titan', 'ember_wolf', { p2: true }),
  saTitanWide: duel('Magma Titanı from zone 2 straight up to zone 2 (vertical approach)', 'magma_titan', 'lumen_sprite', { az: 2, tz: 2 }),
  saTitanSummon: {
    desc: 'Magma Titanı tribute summon → chest core blazes, fireball −500',
    stage: { p0: { hand: ['magma_titan'], monsters: [null, 'storm_hawk'] } },
    steps: [summon('magma_titan', 1, ['storm_hawk'])],
  },
  saTitanSummonP2: {
    desc: 'player 2 Magma Titanı summon burn (fireball to player 1)',
    stage: { active: 1, p1: { hand: ['magma_titan'], monsters: ['lumen_sprite'] } },
    steps: [summon('magma_titan', 0, ['lumen_sprite'], 1)],
  },
  saTitanFlip: {
    desc: 'flip summon a face-down Magma Titanı → burn 500',
    stage: { p0: { monsters: [null, null, { id: 'magma_titan', faceUp: false }] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },

  // ---------------------------------------------------------------- Mercan Yılanı
  saCoralAtk: duel('Gelgit Mızrağı destroys Kor Kurdu (water splash, wolf death)', 'coral_serpent', 'ember_wolf'),
  saCoralPierce: duel('Gelgit Mızrağı pierces a defending Işık Perisi into the duelist (1400)', 'coral_serpent', def('lumen_sprite')),
  saCoralPierceFD: duel('Gelgit Mızrağı pierces a face-down Fırtına Atmacası (flip + 1200)', 'coral_serpent', def('storm_hawk', false)),
  saCoralBlocked: duel('Gelgit Mızrağı splashes off a defending Taş Muhafız (100 back)', 'coral_serpent', def('stone_sentinel')),
  saCoralLose: duel('Mercan Yılanı vs Uçurum Büyücüsü: serpent destroyed (foam death)', 'coral_serpent', 'abyss_magus'),
  saCoralDirect: duel('Gelgit Mızrağı direct attack', 'coral_serpent', null),
  saCoralP2: duel('player 2 Gelgit Mızrağı pierces a defending Gölge Suikastçı', 'coral_serpent', def('shade_assassin'), { p2: true }),

  // ---------------------------------------------------------------- Kor Kurdu
  saWolfAtk: duel('Kor Dişi destroys Işık Perisi → howl, flame spirit −300', 'ember_wolf', 'lumen_sprite'),
  saWolfDef: duel('Kor Dişi vs a face-down Fırtına Atmacası → burn 300', 'ember_wolf', def('storm_hawk', false)),
  saWolfBlocked: duel('Kor Kurdu bites a defending Taş Muhafız: bounced, 400 back', 'ember_wolf', def('stone_sentinel')),
  saWolfLose: duel('Kor Kurdu vs Magma Titanı: wolf destroyed (flames gutter out)', 'ember_wolf', 'magma_titan'),
  saWolfDirect: duel('Kor Dişi direct attack', 'ember_wolf', null),
  saWolfP2: duel('player 2 Kor Dişi on Gelgit Golemi (attack position) → burn', 'ember_wolf', 'tide_golem', { p2: true }),
  saWolfGuard: duel('player 2 Işık Perisi attacks Kor Kurdu: the wolf wins as defender and howls', 'lumen_sprite', 'ember_wolf', { p2: true }),

  // ---------------------------------------------------------------- Gelgit Golemi
  saGolemAtk: duel('Dalga Darbesi destroys Işık Perisi (foam crash)', 'tide_golem', 'lumen_sprite'),
  saGolemBlocked: duel('Gelgit Golemi vs Kor Kurdu: wave breaks, golem destroyed (melts)', 'tide_golem', 'ember_wolf'),
  saGolemDef: duel('Dalga Darbesi vs a face-down Işık Perisi (DEF 600)', 'tide_golem', def('lumen_sprite', false)),
  saGolemDirect: duel('Dalga Darbesi direct attack', 'tide_golem', null),
  saGolemP2: duel('player 2 Dalga Darbesi on Fırtına Atmacası', 'tide_golem', 'storm_hawk', { p2: true }),
  saGolemCounter: duel('Kor Kurdu hits a defending Gelgit Golemi: blocked + counter-splash 300', 'ember_wolf', def('tide_golem')),
  saGolemCounterDead: duel('Magma Titanı breaks a defending Gelgit Golemi: counter-splash from its puddle', 'magma_titan', def('tide_golem')),
  saGolemCounterP2: duel('player 2 Kristal Ejder hits player 1\'s face-down Gelgit Golemi: counter-splash', 'crystal_wyrm', def('tide_golem', false), { p2: true }),
};

export default scenarios;
