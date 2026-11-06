// Card database: the 20 cards of Neon Düello.
// UI strings and identifiers are English.
// This file is a shared contract — other modules key art, VFX and cinematics by CardId.

export type Attribute = 'LIGHT' | 'DARK' | 'FIRE' | 'WATER' | 'EARTH' | 'WIND';

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  LIGHT: 'LIGHT',
  DARK: 'DARK',
  FIRE: 'FIRE',
  WATER: 'WATER',
  EARTH: 'EARTH',
  WIND: 'WIND',
};

export type MonsterEffect =
  | 'none'
  | 'tributeSummonDestroySpellTrap' // abyss_magus
  | 'summonBurn500' // magma_titan
  | 'piercing' // coral_serpent
  | 'battleDestroyBurn300' // ember_wolf
  | 'defenseAttackedBurn300' // tide_golem
  | 'directAttack' // storm_hawk
  | 'normalSummonGain500' // lumen_sprite
  | 'destroyedByBattleBurn500' // volt_lizard
  | 'flipDestroyMonster' // thorn_lurker
  // ---- batch 1 of the expanded roster (docs/KART_TASLAGI_CANAVAR.md) ----
  | 'ownSpellBurn300' // dusk_sorcerer: while face-up, each Spell its controller activates burns the opponent 300
  | 'declareAtkDebuff400' // grim_warden: the monster it attacks has its ATK lowered by 400 for that battle
  | 'noBattleDamageOnDestroy' // wisp_imp: destroyed in battle -> its controller takes no damage from that battle
  | 'trapLock' // steel_silencer: while face-up, the opponent cannot activate Trap cards
  | 'sealSet' // the five seals: all five distinct pieces in hand = instant win
  | 'summonFreezeAttack' // hourglass_imp: on summon, one opposing monster cannot attack on the opponent's next turn
  | 'summonTurnAtk500' // windmane_knight: +500 ATK while attacking on the turn it was Normal/Tribute Summoned
  | 'defenseAtkDebuff500' // shield_titan: face-up in defense and attacked -> the attacker has -500 ATK in that battle
  | 'windAura300' // wing_lady: the other face-up WIND monsters on its controller's field get +300 ATK
  // ---- batch 2 of the expanded roster (docs/v3/YENI_KARTLAR.md §6) ----
  | 'tidalBayShroud' // tide_harpooner: while Tidal Bay is face-up: cannot be attacked / targeted by the opponent's Spells
  | 'coinWipe' // dial_jester: once per turn, call a coin toss: right = destroy the opponent's monsters, wrong = your own + damage
  | 'jesterAging' // cloud_hatchling: grows (+1200 ATK / +800 DEF, permanent) when a Dial Jester toss is called right
  | 'attackThenDefense' // scrap_raiders: after it declared an attack it turns to defense and is locked until its next turn
  | 'banishGraveBoost400' // hollow_ogre: once per turn banish up to 2 monsters of your graveyard, +400 ATK each this turn
  | 'doubleAttackMonster' // kite_fencer: two attacks per Battle Phase, the second only at a monster
  | 'defenseAttackedPin' // mudgrasp_spirit: attacked in defense -> the attacker turns to defense, locked on its next turn
  | 'magnetPiece' // polar_needle / polar_anvil / polar_coil: the three pieces of Kutup Hükümdarı
  | 'magnetFusion'; // polar_sovereign: Special Summon by tributing the three pieces; destroyed -> the pieces come back

export type SpellEffect =
  | 'destroyOpponentMonster' // judgment_bolt
  | 'gain1000' // healing_spring
  | 'reviveFromGraveyard' // soul_recall
  | 'equipAtk700' // dragon_blade
  | 'fieldVolcano' // volcano_arena
  // ---- spell/trap batch 1 (docs/KART_TASLAGI_BUYU_TUZAK.md) ----
  | 'draw2Discard1' // fate_trade: draw 2, then discard 1
  | 'doubleTribute' // double_offering: this turn a Level 7+ monster needs only 1 tribute
  | 'forceDefense' // kneel_down: an opposing face-up attack-position monster turns to defense and cannot change position next turn
  | 'recycleGraveyard' // cycle_of_graves: shuffle the last 3 cards of your graveyard into your deck, draw 1
  | 'atkBoostTurn' // battle_cry: +1000 ATK until the end phase
  | 'destroyOpponentSpellTrap' // purging_wave: destroy 1 opposing Spell/Trap (field spell included)
  | 'equipPiercing' // piercing_lance: +300 ATK and piercing damage
  | 'equipDestroyShield' // guardian_charm: the equipped monster is not destroyed once; this card is destroyed instead
  | 'fieldTidalBay' // tidal_bay: WATER/WIND +400, FIRE -400
  | 'fieldShadowCavern' // shadow_cavern: DARK/EARTH +300, LIGHT -300
  | 'fieldExtraSummon' // festival_square: its controller may Normal Summon / Set one extra Level <= 4 monster per turn
  // ---- continuous spells ----
  | 'attackLock3' // dawn_swords: reveals the opponent's face-down monsters; while face-up the opponent cannot attack; counter 3, ticks down at the end of each opponent turn
  // ---- spell batch 2 (docs/v3/YENI_KARTLAR.md §7) ----
  | 'draw2' // well_pail: draw 2
  | 'controlUntilEnd' // puppet_string: take control of an opposing monster until the End Phase
  | 'destroyAllMonsters' // void_eye: destroy every monster on the field
  | 'destroyAllOppSpellTrap' // sweeping_gale: destroy every opposing Spell/Trap (field spell included)
  | 'draw3Discard2' // winnow_sieve: draw 3, then discard 2
  | 'destroySpellTrapQuick' // auger_lance (quick): destroy 1 Spell/Trap on the field
  | 'equipControl' // soul_leash: equip to an opposing face-up monster and control it; the owner gains 1000 each Draw Phase
  | 'strawTokens' // straw_decoys (quick): Special Summon Straw Decoy tokens (free zones - 1, at least 1)
  | 'equipAtk800Return' // spite_axe: +800 ATK; leaving the field it goes to the top of its owner's deck instead, owner takes 500
  | 'handRefreshBoth' // page_turner: both players discard their hands and draw as many
  | 'diceBoost100'; // lucky_die: roll a die: your face-up monsters get +100 x the roll ATK/DEF this turn

export type TrapEffect =
  | 'attackDestroyAllAttackPosition' // mirror_barrier
  | 'attackNegateEndBattle' // chains_of_light
  | 'summonDestroy1000Plus' // chasm_trap
  // ---- spell/trap batch 1 (docs/KART_TASLAGI_BUYU_TUZAK.md) ----
  | 'spellActivateNegate' // spell_seal: negate a Spell activation and destroy that Spell
  | 'summonDestroy1800Plus' // toppling_tower: a Normal/Tribute/Special Summon with ATK >= 1800 is destroyed
  | 'attackBounceAttacker' // homecoming: negate the attack, the attacker returns to its owner's hand
  | 'attackRedirect' // decoy_target: the defender picks another own monster to take the attack
  | 'lpBelow1500Gain1500' // last_breath: LP dropped below 1500 by the opponent's damage -> gain 1500
  | 'attackNegateAllDefense' // sandstorm: negate the attack; the attacker's controller's attack-position monsters turn to defense
  | 'attackedBoost1000' // hidden_reinforcement: the attacked monster gets +1000 ATK/DEF this battle
  | 'hatShuffle'; // magic_hat: the attacked monster + up to 2 decoy tokens are hidden under shuffled hats; the attacker picks one

/** 'continuous' (additive): stays face-up in a spell/trap zone with a counter (dawn_swords). */
/** 'quick' (additive): a Quick-Play spell — from hand in your Main Phase, or set and activated after its set turn in your Main Phase or in answer to an opponent's attack declaration / summon. */
export type SpellType = 'normal' | 'equip' | 'field' | 'continuous' | 'quick';

export type MonsterId =
  | 'crystal_wyrm'
  | 'abyss_magus'
  | 'magma_titan'
  | 'coral_serpent'
  | 'ember_wolf'
  | 'tide_golem'
  | 'storm_hawk'
  | 'stone_sentinel'
  | 'lumen_sprite'
  | 'shade_assassin'
  | 'volt_lizard'
  | 'thorn_lurker'
  // batch 1 of the expanded roster (original designs; the roles echo well-known duel monsters)
  | 'dusk_sorcerer'
  | 'ashen_drake'
  | 'grim_warden'
  | 'venom_drake'
  | 'wisp_imp'
  | 'steel_silencer'
  | 'seal_head'
  | 'seal_arm_r'
  | 'seal_arm_l'
  | 'seal_leg_r'
  | 'seal_leg_l'
  | 'hourglass_imp'
  | 'windmane_knight'
  | 'shield_titan'
  | 'wing_lady'
  // batch 2 (docs/v3/YENI_KARTLAR.md §6)
  | 'tide_harpooner'
  | 'dial_jester'
  | 'cloud_hatchling'
  | 'reflection_archer'
  | 'scrap_raiders'
  | 'hollow_ogre'
  | 'crag_axeman'
  | 'reed_heron'
  | 'kite_fencer'
  | 'mudgrasp_spirit'
  | 'steppe_spiralhorn'
  | 'polar_needle'
  | 'polar_anvil'
  | 'polar_coil'
  | 'polar_sovereign'
  /** Token of straw_decoys: outside the pool (never in ALL_CARDS / decks), only ever created on the field. */
  | 'straw_decoy_token';

export type SpellId =
  | 'judgment_bolt'
  | 'healing_spring'
  | 'soul_recall'
  | 'dragon_blade'
  | 'volcano_arena'
  // spell/trap batch 1
  | 'fate_trade'
  | 'double_offering'
  | 'kneel_down'
  | 'cycle_of_graves'
  | 'battle_cry'
  | 'purging_wave'
  | 'piercing_lance'
  | 'guardian_charm'
  | 'tidal_bay'
  | 'shadow_cavern'
  | 'festival_square'
  | 'dawn_swords'
  // spell batch 2 (docs/v3/YENI_KARTLAR.md §7)
  | 'well_pail'
  | 'puppet_string'
  | 'void_eye'
  | 'sweeping_gale'
  | 'winnow_sieve'
  | 'auger_lance'
  | 'soul_leash'
  | 'straw_decoys'
  | 'spite_axe'
  | 'page_turner'
  | 'lucky_die';

export type TrapId =
  | 'mirror_barrier'
  | 'chains_of_light'
  | 'chasm_trap'
  // spell/trap batch 1
  | 'spell_seal'
  | 'toppling_tower'
  | 'homecoming'
  | 'decoy_target'
  | 'last_breath'
  | 'sandstorm'
  | 'hidden_reinforcement'
  | 'magic_hat';

export type CardId = MonsterId | SpellId | TrapId;

export interface MonsterCardDef {
  id: MonsterId;
  kind: 'monster';
  name: string;
  attribute: Attribute;
  race: string;
  level: number;
  atk: number;
  def: number;
  effect: MonsterEffect;
  /** Effect text (English). Empty for normal monsters. */
  text: string;
  /** Flavor text shown for normal monsters (English). */
  flavor: string;
  /** Ace monsters get a full-screen cut-in when summoned. */
  ace: boolean;
  /** Retired (owner decision): kept for art / old saves, but never offered (pool, builder, presets, CPU). */
  retired?: boolean;
  /** A token (straw_decoy_token): created on the field by an effect; never in ALL_CARDS, a deck or a graveyard. */
  token?: boolean;
}

export interface SpellCardDef {
  id: SpellId;
  kind: 'spell';
  spellType: SpellType;
  name: string;
  effect: SpellEffect;
  text: string;
  /** Retired (owner decision): kept for art / old saves, but never offered (pool, builder, presets, CPU). */
  retired?: boolean;
}

export interface TrapCardDef {
  id: TrapId;
  kind: 'trap';
  name: string;
  effect: TrapEffect;
  text: string;
  /** Retired (owner decision): kept for art / old saves, but never offered (pool, builder, presets, CPU). */
  retired?: boolean;
}

export type CardDef = MonsterCardDef | SpellCardDef | TrapCardDef;

/** The five seal pieces (sealSet): one card each; all five in a hand win the duel. */
export const SEAL_IDS = ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r', 'seal_leg_l'] as const satisfies readonly MonsterId[];
const SEAL_TEXT = 'Five Seals: if all five pieces are in your hand, you win the duel at once.';
const SEAL_PIECES: readonly [MonsterId, string, number, number, number][] = [
  ['seal_head', 'Sealed Head', 3, 1000, 1000],
  ['seal_arm_r', 'Right Arm Seal', 1, 200, 300],
  ['seal_arm_l', 'Left Arm Seal', 1, 200, 300],
  ['seal_leg_r', 'Right Leg Seal', 1, 200, 300],
  ['seal_leg_l', 'Left Leg Seal', 1, 200, 300],
];

const MONSTERS: MonsterCardDef[] = [
  {
    id: 'crystal_wyrm',
    kind: 'monster',
    name: 'Crystal Wyrm',
    attribute: 'LIGHT',
    race: 'Dragon',
    level: 7,
    atk: 2800,
    def: 2300,
    effect: 'none',
    text: '',
    flavor: 'Its crystal scales split the light and drown the sky in rainbows.',
    ace: true,
  },
  {
    id: 'abyss_magus',
    kind: 'monster',
    name: 'Abyss Magus',
    attribute: 'DARK',
    race: 'Spellcaster',
    level: 6,
    atk: 2300,
    def: 2000,
    effect: 'tributeSummonDestroySpellTrap',
    text: 'When Tribute Summoned: destroy 1 Spell/Trap your opponent controls.',
    flavor: '',
    ace: true,
  },
  {
    id: 'magma_titan',
    kind: 'monster',
    name: 'Magma Titan',
    attribute: 'FIRE',
    race: 'Pyro',
    level: 5,
    atk: 2100,
    def: 1500,
    effect: 'summonBurn500',
    text: 'When Summoned: deal 500 damage to your opponent.',
    flavor: '',
    ace: true,
  },
  {
    id: 'coral_serpent',
    kind: 'monster',
    name: 'Coral Serpent',
    attribute: 'WATER',
    race: 'Sea Serpent',
    level: 5,
    atk: 2000,
    def: 1600,
    effect: 'piercing',
    text: 'When it attacks a defender, deal its ATK over that DEF as piercing damage.',
    flavor: '',
    ace: true,
  },
  {
    id: 'ember_wolf',
    kind: 'monster',
    name: 'Ember Wolf',
    attribute: 'FIRE',
    race: 'Beast',
    level: 4,
    atk: 1700,
    def: 1000,
    effect: 'battleDestroyBurn300',
    text: 'When it destroys a monster by battle: deal 300 damage to your opponent.',
    flavor: '',
    ace: false,
  },
  {
    id: 'tide_golem',
    kind: 'monster',
    name: 'Tide Golem',
    attribute: 'WATER',
    race: 'Aqua',
    level: 4,
    atk: 1100,
    def: 2000,
    effect: 'defenseAttackedBurn300',
    text: 'If attacked in Defense Position: deal 300 damage to the attacking player.',
    flavor: '',
    ace: false,
  },
  {
    id: 'storm_hawk',
    kind: 'monster',
    name: 'Storm Hawk',
    attribute: 'WIND',
    race: 'Winged Beast',
    level: 3,
    atk: 1000,
    def: 800,
    effect: 'directAttack',
    text: 'Can attack directly even if your opponent controls a monster.',
    flavor: '',
    ace: false,
  },
  {
    id: 'stone_sentinel',
    kind: 'monster',
    name: 'Stone Sentinel',
    attribute: 'EARTH',
    race: 'Rock',
    level: 4,
    atk: 500,
    def: 2100,
    effect: 'none',
    text: '',
    flavor: 'Alone, it guarded a fortress for a thousand years. It never stepped back.',
    ace: false,
  },
  {
    id: 'lumen_sprite',
    kind: 'monster',
    name: 'Lumen Sprite',
    attribute: 'LIGHT',
    race: 'Fairy',
    level: 2,
    atk: 400,
    def: 600,
    effect: 'normalSummonGain500',
    text: 'When Normal Summoned: gain 500 LP.',
    flavor: '',
    ace: false,
  },
  {
    id: 'shade_assassin',
    kind: 'monster',
    name: 'Shade Assassin',
    attribute: 'DARK',
    race: 'Warrior',
    level: 4,
    atk: 1900,
    def: 400,
    effect: 'none',
    text: '',
    flavor: 'It leaps from shadow to shadow. No one who saw its dagger lived to tell the tale.',
    ace: false,
  },
  {
    id: 'volt_lizard',
    kind: 'monster',
    name: 'Volt Lizard',
    attribute: 'LIGHT',
    race: 'Thunder',
    level: 4,
    atk: 1500,
    def: 1200,
    effect: 'destroyedByBattleBurn500',
    text: 'When destroyed by battle: deal 500 damage to your opponent.',
    flavor: '',
    ace: false,
  },
  {
    id: 'thorn_lurker',
    kind: 'monster',
    name: 'Thorn Lurker',
    attribute: 'EARTH',
    race: 'Plant',
    level: 2,
    atk: 600,
    def: 800,
    effect: 'flipDestroyMonster',
    text: 'FLIP: Destroy 1 monster your opponent controls.',
    flavor: '',
    ace: false,
  },
];

/** Batch 1 of the expanded roster (not in DEFAULT_DECK; played through the 'expanded' pool, src/data/decks.ts). */
const MONSTERS_B1: MonsterCardDef[] = [
  {
    id: 'dusk_sorcerer',
    kind: 'monster',
    name: 'Dusk Sorcerer',
    attribute: 'DARK',
    race: 'Spellcaster',
    level: 7,
    atk: 2500,
    def: 2100,
    effect: 'ownSpellBurn300',
    text: 'While face-up, each Spell you activate deals 300 damage to your opponent.',
    flavor: '',
    ace: true,
    // removed from the game (owner decision): saved decks swap it for RETIRED_SUBSTITUTES (src/data/decks.ts)
    retired: true,
  },
  {
    id: 'ashen_drake',
    kind: 'monster',
    name: 'Ashen Drake',
    attribute: 'DARK',
    race: 'Dragon',
    level: 7,
    atk: 2400,
    def: 2000,
    effect: 'none',
    text: '',
    flavor: 'A black dragon born in a rain of ash. Its breath darkens the sky.',
    ace: true,
  },
  {
    id: 'grim_warden',
    kind: 'monster',
    name: 'Grim Warden',
    attribute: 'DARK',
    race: 'Fiend',
    level: 6,
    atk: 2500,
    def: 1200,
    effect: 'declareAtkDebuff400',
    text: 'When it declares an attack: the target loses 400 ATK during that battle.',
    flavor: '',
    ace: true,
  },
  {
    id: 'venom_drake',
    kind: 'monster',
    name: 'Venom Drake',
    attribute: 'DARK',
    race: 'Dragon',
    level: 5,
    atk: 2000,
    def: 1500,
    effect: 'none',
    text: '',
    flavor: 'The venom seeping from its scales leaves no ground it crosses green again.',
    ace: true,
  },
  {
    id: 'wisp_imp',
    kind: 'monster',
    name: 'Wisp Imp',
    attribute: 'DARK',
    race: 'Fiend',
    level: 1,
    atk: 300,
    def: 200,
    effect: 'noBattleDamageOnDestroy',
    text: 'If destroyed by battle, its controller takes no damage from that battle.',
    flavor: '',
    ace: false,
  },
  {
    id: 'steel_silencer',
    kind: 'monster',
    name: 'Steel Silencer',
    attribute: 'DARK',
    race: 'Machine',
    level: 6,
    atk: 2400,
    def: 1500,
    effect: 'trapLock',
    text: 'While face-up, your opponent cannot activate Trap cards.',
    flavor: '',
    ace: true,
  },
  ...SEAL_PIECES.map(
    ([id, name, level, atk, def]): MonsterCardDef => ({
      id,
      kind: 'monster',
      name,
      attribute: 'DARK',
      race: 'Spellcaster',
      level,
      atk,
      def,
      effect: 'sealSet',
      text: SEAL_TEXT,
      flavor: '',
      ace: false,
    }),
  ),
  {
    id: 'hourglass_imp',
    kind: 'monster',
    name: 'Hourglass Imp',
    attribute: 'LIGHT',
    race: 'Spellcaster',
    level: 2,
    atk: 500,
    def: 400,
    effect: 'summonFreezeAttack',
    text: 'When Summoned: 1 opposing monster cannot attack on its next turn.',
    flavor: '',
    ace: false,
  },
  {
    id: 'windmane_knight',
    kind: 'monster',
    name: 'Windmane Knight',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 7,
    atk: 2300,
    def: 2100,
    effect: 'summonTurnAtk500',
    text: '+500 ATK while attacking on the turn it was Normal Summoned.',
    flavor: '',
    ace: true,
  },
  {
    id: 'shield_titan',
    kind: 'monster',
    name: 'Shield Titan',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 4,
    atk: 100,
    def: 2600,
    effect: 'defenseAtkDebuff500',
    text: 'While in Defense Position, a monster that attacks it loses 500 ATK.',
    flavor: '',
    ace: false,
  },
  {
    id: 'wing_lady',
    kind: 'monster',
    name: 'Wing Lady',
    attribute: 'WIND',
    race: 'Winged Beast',
    level: 4,
    atk: 1300,
    def: 1400,
    effect: 'windAura300',
    text: 'Other face-up WIND monsters you control gain 300 ATK.',
    flavor: '',
    ace: false,
  },
];

/** Batch 2 of the expanded roster (docs/v3/YENI_KARTLAR.md §6, owner decisions 2026-10-31). */
const MAGNET_TEXT = (a: string, b: string) => `Polar piece. Tribute it with ${a} and ${b} to Summon Polar Sovereign.`;
const MONSTERS_B2: MonsterCardDef[] = [
  {
    id: 'tide_harpooner',
    kind: 'monster',
    name: 'Shell Harpooner',
    attribute: 'WATER',
    race: 'Aqua',
    level: 5,
    atk: 1700,
    def: 1500,
    effect: 'tidalBayShroud',
    text: 'While the Field Spell Tidal Bay is face-up: your opponent cannot attack this card or target it with Spells. If you have no other monster they can attack, they may attack directly.',
    flavor: '',
    ace: true,
  },
  {
    id: 'dial_jester',
    kind: 'monster',
    name: 'Dial Jester',
    attribute: 'LIGHT',
    race: 'Spellcaster',
    level: 2,
    atk: 700,
    def: 300,
    effect: 'coinWipe',
    text: 'Once per turn, in your Main Phase, while your opponent controls a monster: call Heads or Tails and toss a coin. Right: destroy all monsters your opponent controls. Wrong: destroy all monsters you control (this card included) and take damage equal to half their total ATK.',
    flavor: '',
    ace: false,
  },
  {
    id: 'cloud_hatchling',
    kind: 'monster',
    name: 'Cloud Hatchling',
    attribute: 'WIND',
    race: 'Dragon',
    level: 3,
    atk: 1100,
    def: 900,
    effect: 'jesterAging',
    text: 'If a Dial Jester toss is called right while this card is face-up on your field: it grows for good, +1200 ATK and +800 DEF (once per Cloud Hatchling).',
    flavor: '',
    ace: false,
  },
  {
    id: 'reflection_archer',
    kind: 'monster',
    name: 'Reflection Archer',
    attribute: 'LIGHT',
    race: 'Spellcaster',
    level: 4,
    atk: 1800,
    def: 1000,
    effect: 'none',
    text: '',
    flavor: 'Even where there is no lake, it has a reflection. The reflection shoots first.',
    ace: false,
  },
  {
    id: 'scrap_raiders',
    kind: 'monster',
    name: 'Scrap Raiders',
    attribute: 'FIRE',
    race: 'Warrior',
    level: 4,
    atk: 2000,
    def: 0,
    effect: 'attackThenDefense',
    text: 'After this card attacks, if it is still on the field when the Battle Phase ends, it switches to Defense and cannot change position on your next turn.',
    flavor: '',
    ace: false,
  },
  {
    id: 'hollow_ogre',
    kind: 'monster',
    name: 'Hollow Ogre',
    attribute: 'EARTH',
    race: 'Beast-Warrior',
    level: 4,
    atk: 1400,
    def: 900,
    effect: 'banishGraveBoost400',
    text: 'Once per turn, in your Main Phase: banish up to 2 monsters from your Graveyard. This card gains 400 ATK this turn for each monster banished.',
    flavor: '',
    ace: false,
  },
  {
    id: 'crag_axeman',
    kind: 'monster',
    name: 'Crag Axeman',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 4,
    atk: 1600,
    def: 1300,
    effect: 'none',
    text: '',
    flavor: 'They say one swing is enough to split a mountain. He never needed a second.',
    ace: false,
  },
  {
    id: 'reed_heron',
    kind: 'monster',
    name: 'Reed Heron',
    attribute: 'WATER',
    race: 'Winged Beast',
    level: 4,
    atk: 1400,
    def: 1500,
    effect: 'none',
    text: '',
    flavor: 'It waits on one leg in the mist. Its beak strikes without breaking the water.',
    ace: false,
  },
  {
    id: 'kite_fencer',
    kind: 'monster',
    name: 'Kite Fencer',
    attribute: 'WIND',
    race: 'Warrior',
    level: 3,
    atk: 900,
    def: 600,
    effect: 'doubleAttackMonster',
    text: 'This card can attack twice each Battle Phase. Its second attack must target a monster.',
    flavor: '',
    ace: false,
  },
  {
    id: 'mudgrasp_spirit',
    kind: 'monster',
    name: 'Mudgrasp Spirit',
    attribute: 'EARTH',
    race: 'Fiend',
    level: 4,
    atk: 700,
    def: 1800,
    effect: 'defenseAttackedPin',
    text: 'If attacked in Defense Position: after the battle, the attacker changes to Defense Position and cannot change position during its controller\'s next turn.',
    flavor: '',
    ace: false,
  },
  {
    id: 'steppe_spiralhorn',
    kind: 'monster',
    name: 'Steppe Spiralhorn',
    attribute: 'WIND',
    race: 'Beast',
    level: 4,
    atk: 1500,
    def: 1400,
    effect: 'none',
    text: '',
    flavor: 'The steppe wind follows its tracks and whistles through its spiral horns.',
    ace: false,
  },
  {
    id: 'polar_needle',
    kind: 'monster',
    name: 'Polar Needle',
    attribute: 'EARTH',
    race: 'Rock',
    level: 4,
    atk: 1500,
    def: 1100,
    effect: 'magnetPiece',
    text: MAGNET_TEXT('Polar Anvil', 'Polar Coil'),
    flavor: '',
    ace: false,
  },
  {
    id: 'polar_anvil',
    kind: 'monster',
    name: 'Polar Anvil',
    attribute: 'EARTH',
    race: 'Rock',
    level: 4,
    atk: 1100,
    def: 1700,
    effect: 'magnetPiece',
    text: MAGNET_TEXT('Polar Needle', 'Polar Coil'),
    flavor: '',
    ace: false,
  },
  {
    id: 'polar_coil',
    kind: 'monster',
    name: 'Polar Coil',
    attribute: 'EARTH',
    race: 'Rock',
    level: 4,
    atk: 1300,
    def: 1400,
    effect: 'magnetPiece',
    text: MAGNET_TEXT('Polar Needle', 'Polar Anvil'),
    flavor: '',
    ace: false,
  },
  {
    id: 'polar_sovereign',
    kind: 'monster',
    name: 'Polar Sovereign',
    attribute: 'EARTH',
    race: 'Rock',
    level: 8,
    atk: 3000,
    def: 2800,
    effect: 'magnetFusion',
    text: 'Cannot be Normal Summoned or Set. Special Summon from your hand by Tributing Polar Needle, Polar Anvil and Polar Coil on your field. When destroyed: if all three are in your Graveyard and you have 3 free Monster Zones, Special Summon them in Defense Position.',
    flavor: '',
    ace: true,
  },
];

/** The three pieces of Kutup Hükümdarı (magnetFusion), in the order they come back when it splits. */
export const MAGNET_PIECE_IDS = ['polar_needle', 'polar_anvil', 'polar_coil'] as const satisfies readonly MonsterId[];

/** Tokens: created on the field only (straw_decoys). In CARDS, never in ALL_CARDS, a deck or a graveyard. */
const TOKENS: MonsterCardDef[] = [
  {
    id: 'straw_decoy_token',
    kind: 'monster',
    name: 'Straw Decoy',
    attribute: 'EARTH',
    race: 'Plant',
    level: 1,
    atk: 0,
    def: 0,
    effect: 'none',
    text: 'Straw Decoys Token. Cannot be Tributed.',
    flavor: '',
    ace: false,
    token: true,
  },
];

const SPELLS: SpellCardDef[] = [
  {
    id: 'judgment_bolt',
    kind: 'spell',
    spellType: 'normal',
    name: 'Judgment Bolt',
    effect: 'destroyOpponentMonster',
    text: 'Target 1 monster your opponent controls; destroy it.',
  },
  {
    id: 'healing_spring',
    kind: 'spell',
    spellType: 'normal',
    name: 'Healing Spring',
    effect: 'gain1000',
    text: 'Gain 1000 LP.',
  },
  {
    id: 'soul_recall',
    kind: 'spell',
    spellType: 'normal',
    name: 'Soul Recall',
    effect: 'reviveFromGraveyard',
    text: 'Target 1 monster in either Graveyard; Special Summon it to your field in Attack Position.',
  },
  {
    id: 'dragon_blade',
    kind: 'spell',
    spellType: 'equip',
    name: 'Dragon Blade',
    effect: 'equipAtk700',
    text: 'Equip to 1 face-up monster you control. It gains 700 ATK.',
  },
  {
    id: 'volcano_arena',
    kind: 'spell',
    spellType: 'field',
    name: 'Volcano Arena',
    effect: 'fieldVolcano',
    text: 'All FIRE monsters on the field gain 500 ATK; all WATER monsters lose 300 ATK.',
  },
];

const TRAPS: TrapCardDef[] = [
  {
    id: 'mirror_barrier',
    kind: 'trap',
    name: 'Mirror Barrier',
    effect: 'attackDestroyAllAttackPosition',
    text: 'When an opponent\'s monster attacks: destroy all Attack Position monsters your opponent controls.',
  },
  {
    id: 'chains_of_light',
    kind: 'trap',
    name: 'Chains of Light',
    effect: 'attackNegateEndBattle',
    text: 'When an opponent\'s monster attacks: negate the attack and end the Battle Phase.',
  },
  {
    id: 'chasm_trap',
    kind: 'trap',
    name: 'Earth Rift',
    effect: 'summonDestroy1000Plus',
    text: 'When your opponent Normal Summons a monster with 1000+ ATK: destroy it.',
  },
];


/** Spell/trap batch 1 (docs/KART_TASLAGI_BUYU_TUZAK.md): 11 spells (2 equip, 3 field) and 7 traps; original names. */
const SPELLS_B1: SpellCardDef[] = [
  {
    id: 'fate_trade',
    kind: 'spell',
    spellType: 'normal',
    name: 'Fate Trade',
    effect: 'draw2Discard1',
    text: 'Draw 2 cards, then discard 1. (Your Deck must have at least 3 cards.)',
  },
  {
    id: 'double_offering',
    kind: 'spell',
    spellType: 'normal',
    name: 'Double Offering',
    effect: 'doubleTribute',
    text: 'This turn, you can Summon a Level 7 or higher monster with only 1 Tribute.',
  },
  {
    id: 'kneel_down',
    kind: 'spell',
    spellType: 'normal',
    name: 'Kneel Down',
    effect: 'forceDefense',
    text: 'Target 1 opposing Attack Position monster: switch it to Defense; it cannot change position next turn.',
  },
  {
    id: 'cycle_of_graves',
    kind: 'spell',
    spellType: 'normal',
    name: 'Cycle of Graves',
    effect: 'recycleGraveyard',
    text: 'Shuffle the last 3 cards of your Graveyard into your Deck, then draw 1 card.',
  },
  {
    id: 'battle_cry',
    kind: 'spell',
    spellType: 'normal',
    name: 'Battle Cry',
    effect: 'atkBoostTurn',
    text: 'Target 1 face-up monster you control: it gains 1000 ATK this turn.',
  },
  {
    id: 'purging_wave',
    kind: 'spell',
    spellType: 'normal',
    name: 'Purging Wave',
    effect: 'destroyOpponentSpellTrap',
    text: 'Target 1 Spell/Trap your opponent controls (Field Spell included); destroy it.',
  },
  {
    id: 'piercing_lance',
    kind: 'spell',
    spellType: 'equip',
    name: 'Piercing Lance',
    effect: 'equipPiercing',
    text: 'Equip to 1 face-up monster you control. It gains 300 ATK and deals piercing damage.',
  },
  {
    id: 'guardian_charm',
    kind: 'spell',
    spellType: 'equip',
    name: 'Guardian Charm',
    effect: 'equipDestroyShield',
    text: 'Equip to 1 face-up monster you control. If it would be destroyed, destroy this card instead.',
  },
  {
    id: 'tidal_bay',
    kind: 'spell',
    spellType: 'field',
    name: 'Tidal Bay',
    effect: 'fieldTidalBay',
    text: 'All WATER and WIND monsters on the field gain 400 ATK; all FIRE monsters lose 400 ATK.',
  },
  {
    id: 'shadow_cavern',
    kind: 'spell',
    spellType: 'field',
    name: 'Shadow Cavern',
    effect: 'fieldShadowCavern',
    text: 'All DARK and EARTH monsters on the field gain 300 ATK; all LIGHT monsters lose 300 ATK.',
  },
  {
    id: 'festival_square',
    kind: 'spell',
    spellType: 'field',
    name: 'Festival Square',
    effect: 'fieldExtraSummon',
    text: 'Once per turn, after your Normal Summon, you can Normal Summon or Set 1 more Level 4 or lower monster.',
  },
  {
    id: 'dawn_swords',
    kind: 'spell',
    spellType: 'continuous',
    name: 'Swords of Dawn',
    effect: 'attackLock3',
    text: 'Flip opposing Set monsters face-up. Opposing monsters cannot attack. Ends after their 3rd turn.',
  },
];

const TRAPS_B1: TrapCardDef[] = [
  {
    id: 'spell_seal',
    kind: 'trap',
    name: 'Spell Seal',
    effect: 'spellActivateNegate',
    text: 'When your opponent activates a Spell: negate the activation and destroy that Spell.',
  },
  {
    id: 'toppling_tower',
    kind: 'trap',
    name: 'Toppling Tower',
    effect: 'summonDestroy1800Plus',
    text: 'When your opponent Normal, Tribute or Special Summons a monster with 1800+ ATK: destroy it.',
  },
  {
    id: 'homecoming',
    kind: 'trap',
    name: 'Homecoming',
    effect: 'attackBounceAttacker',
    text: 'When an opponent\'s monster attacks: negate the attack and return it to its owner\'s hand.',
  },
  {
    id: 'decoy_target',
    kind: 'trap',
    name: 'Decoy Target',
    effect: 'attackRedirect',
    text: 'When an opponent\'s monster attacks: choose another monster you control to take the attack.',
  },
  {
    id: 'last_breath',
    kind: 'trap',
    name: 'Last Breath',
    effect: 'lpBelow1500Gain1500',
    text: 'When damage from your opponent drops your LP below 1500 (but not to 0): gain 1500 LP.',
  },
  {
    id: 'sandstorm',
    kind: 'trap',
    name: 'Sandstorm',
    effect: 'attackNegateAllDefense',
    text: 'When an opponent\'s monster attacks: negate it; all their Attack Position monsters switch to Defense.',
  },
  {
    id: 'hidden_reinforcement',
    kind: 'trap',
    name: 'Hidden Reinforcements',
    effect: 'attackedBoost1000',
    text: 'When an opponent\'s monster attacks one of yours: the attacked monster gains 1000 ATK and DEF for that battle.',
  },
  {
    id: 'magic_hat',
    kind: 'trap',
    name: 'Magic Hat',
    effect: 'hatShuffle',
    text: 'When your monster is attacked: hide it among 2 decoy hats and shuffle; the attacker picks one.',
  },
];

/** Spell batch 2 (docs/v3/YENI_KARTLAR.md §7; owner decision: no Yaldızlı Kafes). */
const SPELLS_B2: SpellCardDef[] = [
  {
    id: 'well_pail',
    kind: 'spell',
    spellType: 'normal',
    name: 'Well Pail',
    effect: 'draw2',
    text: 'Draw 2 cards. (Your Deck must have at least 2 cards.)',
  },
  {
    id: 'puppet_string',
    kind: 'spell',
    spellType: 'normal',
    name: 'Puppet String',
    effect: 'controlUntilEnd',
    text: 'Take control of 1 opposing non-Token monster until the End Phase. Needs a free Monster Zone.',
  },
  {
    id: 'void_eye',
    kind: 'spell',
    spellType: 'normal',
    name: 'Void Eye',
    effect: 'destroyAllMonsters',
    text: 'Destroy all monsters on the field.',
  },
  {
    id: 'sweeping_gale',
    kind: 'spell',
    spellType: 'normal',
    name: 'Sweeping Gale',
    effect: 'destroyAllOppSpellTrap',
    text: 'Destroy all Spell and Trap cards your opponent controls (Field Spell included).',
  },
  {
    id: 'winnow_sieve',
    kind: 'spell',
    spellType: 'normal',
    name: 'Winnowing Sieve',
    effect: 'draw3Discard2',
    text: 'Draw 3 cards, then discard 2. (Your Deck must have at least 3 cards.)',
  },
  {
    id: 'auger_lance',
    kind: 'spell',
    spellType: 'quick',
    name: 'Auger Lance',
    effect: 'destroySpellTrapQuick',
    text: 'Quick-Play Spell. Target 1 Spell/Trap on the field; destroy it. (After the turn you Set it, you can also activate it when your opponent attacks or Summons.)',
  },
  {
    id: 'soul_leash',
    kind: 'spell',
    spellType: 'equip',
    name: 'Soul Leash',
    effect: 'equipControl',
    text: 'Take control of a face-up opposing non-Token monster. Its owner gains 1000 LP each Draw Phase.',
  },
  {
    id: 'straw_decoys',
    kind: 'spell',
    spellType: 'quick',
    name: 'Straw Decoys',
    effect: 'strawTokens',
    text: "Quick-Play Spell. Special Summon 'Straw Decoy' Tokens (Lv1, 0/0) in Defense Position: 1 fewer than your free Monster Zones (at least 1). They cannot be Tributed. If activated in your turn, you cannot Summon other monsters that turn.",
  },
  {
    id: 'spite_axe',
    kind: 'spell',
    spellType: 'equip',
    name: 'Spite Axe',
    effect: 'equipAtk800Return',
    text: 'Equip to 1 face-up monster you control: +800 ATK. If this card would go from the field to the Graveyard, put it on top of its owner\'s Deck instead; its owner takes 500 damage.',
  },
  {
    id: 'page_turner',
    kind: 'spell',
    spellType: 'normal',
    name: 'Page Turner',
    effect: 'handRefreshBoth',
    text: 'Both players send their whole hand to the Graveyard, then draw that many cards.',
  },
  {
    id: 'lucky_die',
    kind: 'spell',
    spellType: 'normal',
    name: 'Lucky Die',
    effect: 'diceBoost100',
    text: 'Roll a die: all face-up monsters you control gain ATK and DEF equal to the roll × 100 this turn.',
  },
];

/** The 20 original cards (DEFAULT_DECK) followed by the expanded roster; new cards are only ever appended. */
export const ALL_CARDS: CardDef[] = [...MONSTERS, ...SPELLS, ...TRAPS, ...MONSTERS_B1, ...SPELLS_B1, ...TRAPS_B1, ...MONSTERS_B2, ...SPELLS_B2];

/** Every card definition, tokens included (tokens are never in ALL_CARDS). */
export const CARDS: Record<CardId, CardDef> = Object.fromEntries([...ALL_CARDS, ...TOKENS].map((c) => [c.id, c])) as Record<
  CardId,
  CardDef
>;

/** Every monster id (tokens included: they need art); the pool is COLLECTIBLE_CARDS. */
export const MONSTER_IDS: MonsterId[] = [...MONSTERS, ...MONSTERS_B1, ...MONSTERS_B2, ...TOKENS].map((m) => m.id);
export const SPELL_IDS: SpellId[] = [...SPELLS, ...SPELLS_B1, ...SPELLS_B2].map((s) => s.id);
export const TRAP_IDS: TrapId[] = [...TRAPS, ...TRAPS_B1].map((t) => t.id);
export const ALL_CARD_IDS: CardId[] = ALL_CARDS.map((c) => c.id);

/** True for a token card id (straw_decoy_token): it only ever exists on the field. */
export function isTokenId(id: string): boolean {
  const d = (CARDS as Record<string, CardDef | undefined>)[id];
  return !!d && d.kind === 'monster' && d.token === true;
}

/** True for a card that was taken out of the game (`retired`): it exists, but is never offered. */
export function isRetired(id: string): boolean {
  const d = (CARDS as Record<string, CardDef | undefined>)[id];
  return !!d && d.retired === true;
}

/** Every card that can be offered (pool, deck builder, presets, CPU / random decks): ALL_CARDS minus retired. */
export const COLLECTIBLE_CARDS: CardDef[] = ALL_CARDS.filter((c) => !c.retired);
export const COLLECTIBLE_CARD_IDS: CardId[] = COLLECTIBLE_CARDS.map((c) => c.id);

/** Default deck: one copy of each of the 20 original cards (both players use it, shuffled). Never grows. */
export const DEFAULT_DECK: CardId[] = [...MONSTERS, ...SPELLS, ...TRAPS].map((c) => c.id);

export function cardDef(id: CardId): CardDef {
  return CARDS[id];
}

export function isMonster(def: CardDef): def is MonsterCardDef {
  return def.kind === 'monster';
}
export function isSpell(def: CardDef): def is SpellCardDef {
  return def.kind === 'spell';
}
export function isTrap(def: CardDef): def is TrapCardDef {
  return def.kind === 'trap';
}

/** Tributes required to Normal Summon / Set a monster of the given level. */
export function tributesFor(level: number): number {
  if (level >= 7) return 2;
  if (level >= 5) return 1;
  return 0;
}
