// Card database: the 20 cards of Neon Düello.
// UI strings are Turkish; identifiers are English.
// This file is a shared contract — other modules key art, VFX and cinematics by CardId.

export type Attribute = 'LIGHT' | 'DARK' | 'FIRE' | 'WATER' | 'EARTH' | 'WIND';

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  LIGHT: 'IŞIK',
  DARK: 'KARANLIK',
  FIRE: 'ATEŞ',
  WATER: 'SU',
  EARTH: 'TOPRAK',
  WIND: 'RÜZGAR',
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
  /** Effect text (Turkish). Empty for normal monsters. */
  text: string;
  /** Flavor text shown for normal monsters (Turkish). */
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
const SEAL_TEXT = 'Beş Mühür: elinde beş parçanın hepsi varsa düelloyu hemen kazanırsın.';
const SEAL_PIECES: readonly [MonsterId, string, number, number, number][] = [
  ['seal_head', 'Mühürlü Baş', 3, 1000, 1000],
  ['seal_arm_r', 'Sağ Kol Mührü', 1, 200, 300],
  ['seal_arm_l', 'Sol Kol Mührü', 1, 200, 300],
  ['seal_leg_r', 'Sağ Bacak Mührü', 1, 200, 300],
  ['seal_leg_l', 'Sol Bacak Mührü', 1, 200, 300],
];

const MONSTERS: MonsterCardDef[] = [
  {
    id: 'crystal_wyrm',
    kind: 'monster',
    name: 'Kristal Ejder',
    attribute: 'LIGHT',
    race: 'Ejderha',
    level: 7,
    atk: 2800,
    def: 2300,
    effect: 'none',
    text: '',
    flavor: 'Kristal pulları ışığı kırarak gökyüzünü gökkuşağına boğar.',
    ace: true,
  },
  {
    id: 'abyss_magus',
    kind: 'monster',
    name: 'Uçurum Büyücüsü',
    attribute: 'DARK',
    race: 'Büyücü',
    level: 6,
    atk: 2300,
    def: 2000,
    effect: 'tributeSummonDestroySpellTrap',
    text: 'Kurbanla Çağrıldığında: rakibin 1 Büyü/Tuzak kartını yok et.',
    flavor: '',
    ace: true,
  },
  {
    id: 'magma_titan',
    kind: 'monster',
    name: 'Magma Titanı',
    attribute: 'FIRE',
    race: 'Alev',
    level: 5,
    atk: 2100,
    def: 1500,
    effect: 'summonBurn500',
    text: 'Çağrıldığında: rakibe 500 hasar ver.',
    flavor: '',
    ace: true,
  },
  {
    id: 'coral_serpent',
    kind: 'monster',
    name: 'Mercan Yılanı',
    attribute: 'WATER',
    race: 'Deniz Yılanı',
    level: 5,
    atk: 2000,
    def: 1600,
    effect: 'piercing',
    text: 'Savunmadaki bir canavara saldırırsa, ATK değeri DEF değerini aştığı kadar delici hasar verir.',
    flavor: '',
    ace: true,
  },
  {
    id: 'ember_wolf',
    kind: 'monster',
    name: 'Kor Kurdu',
    attribute: 'FIRE',
    race: 'Canavar',
    level: 4,
    atk: 1700,
    def: 1000,
    effect: 'battleDestroyBurn300',
    text: 'Savaşta bir canavarı yok ettiğinde: rakibe 300 hasar ver.',
    flavor: '',
    ace: false,
  },
  {
    id: 'tide_golem',
    kind: 'monster',
    name: 'Gelgit Golemi',
    attribute: 'WATER',
    race: 'Su',
    level: 4,
    atk: 1100,
    def: 2000,
    effect: 'defenseAttackedBurn300',
    text: 'Savunma pozisyonundayken saldırıya uğrarsa: saldıran oyuncuya 300 hasar ver.',
    flavor: '',
    ace: false,
  },
  {
    id: 'storm_hawk',
    kind: 'monster',
    name: 'Fırtına Atmacası',
    attribute: 'WIND',
    race: 'Kanatlı Canavar',
    level: 3,
    atk: 1000,
    def: 800,
    effect: 'directAttack',
    text: 'Rakibin canavarı olsa bile doğrudan saldırabilir.',
    flavor: '',
    ace: false,
  },
  {
    id: 'stone_sentinel',
    kind: 'monster',
    name: 'Taş Muhafız',
    attribute: 'EARTH',
    race: 'Kaya',
    level: 4,
    atk: 500,
    def: 2100,
    effect: 'none',
    text: '',
    flavor: 'Bin yıllık kaleyi tek başına koruyan taş dev. Hiç geri adım atmadı.',
    ace: false,
  },
  {
    id: 'lumen_sprite',
    kind: 'monster',
    name: 'Işık Perisi',
    attribute: 'LIGHT',
    race: 'Peri',
    level: 2,
    atk: 400,
    def: 600,
    effect: 'normalSummonGain500',
    text: 'Normal Çağrıldığında: 500 LP kazan.',
    flavor: '',
    ace: false,
  },
  {
    id: 'shade_assassin',
    kind: 'monster',
    name: 'Gölge Suikastçı',
    attribute: 'DARK',
    race: 'Savaşçı',
    level: 4,
    atk: 1900,
    def: 400,
    effect: 'none',
    text: '',
    flavor: 'Gölgeden gölgeye atlar. Hançerini gören kimse hikâyesini anlatamadı.',
    ace: false,
  },
  {
    id: 'volt_lizard',
    kind: 'monster',
    name: 'Şimşek Kertenkelesi',
    attribute: 'LIGHT',
    race: 'Gök Gürültüsü',
    level: 4,
    atk: 1500,
    def: 1200,
    effect: 'destroyedByBattleBurn500',
    text: 'Savaşta yok edildiğinde: rakibe 500 hasar ver.',
    flavor: '',
    ace: false,
  },
  {
    id: 'thorn_lurker',
    kind: 'monster',
    name: 'Dikenli Pusucu',
    attribute: 'EARTH',
    race: 'Bitki',
    level: 2,
    atk: 600,
    def: 800,
    effect: 'flipDestroyMonster',
    text: 'ÇEVİR: Rakibin 1 canavarını yok et.',
    flavor: '',
    ace: false,
  },
];

/** Batch 1 of the expanded roster (not in DEFAULT_DECK; played through the 'expanded' pool, src/data/decks.ts). */
const MONSTERS_B1: MonsterCardDef[] = [
  {
    id: 'dusk_sorcerer',
    kind: 'monster',
    name: 'Akşam Büyücüsü',
    attribute: 'DARK',
    race: 'Büyücü',
    level: 7,
    atk: 2500,
    def: 2100,
    effect: 'ownSpellBurn300',
    text: 'Sahadayken senin büyü kartların aktive edildiğinde rakibe 300 hasar.',
    flavor: '',
    ace: true,
    // removed from the game (owner decision): saved decks swap it for RETIRED_SUBSTITUTES (src/data/decks.ts)
    retired: true,
  },
  {
    id: 'ashen_drake',
    kind: 'monster',
    name: 'Kül Ejderi',
    attribute: 'DARK',
    race: 'Ejderha',
    level: 7,
    atk: 2400,
    def: 2000,
    effect: 'none',
    text: '',
    flavor: 'Kül yağmurunun içinden doğan kara ejder. Nefesi gökyüzünü karartır.',
    ace: true,
  },
  {
    id: 'grim_warden',
    kind: 'monster',
    name: 'Hortlak Muhafız',
    attribute: 'DARK',
    race: 'Şeytan',
    level: 6,
    atk: 2500,
    def: 1200,
    effect: 'declareAtkDebuff400',
    text: "Saldırı ilan ettiğinde hedef canavarın ATK'si bu savaş boyunca 400 azalır.",
    flavor: '',
    ace: true,
  },
  {
    id: 'venom_drake',
    kind: 'monster',
    name: 'Zehir Ejderi',
    attribute: 'DARK',
    race: 'Ejderha',
    level: 5,
    atk: 2000,
    def: 1500,
    effect: 'none',
    text: '',
    flavor: 'Pullarından sızan zehir, geçtiği toprağı bir daha yeşertmez.',
    ace: true,
  },
  {
    id: 'wisp_imp',
    kind: 'monster',
    name: 'Tüy Hayalet',
    attribute: 'DARK',
    race: 'Şeytan',
    level: 1,
    atk: 300,
    def: 200,
    effect: 'noBattleDamageOnDestroy',
    text: 'Savaşta yok olursa sahibi o savaştan hasar almaz.',
    flavor: '',
    ace: false,
  },
  {
    id: 'steel_silencer',
    kind: 'monster',
    name: 'Çelik Susturucu',
    attribute: 'DARK',
    race: 'Makine',
    level: 6,
    atk: 2400,
    def: 1500,
    effect: 'trapLock',
    text: 'Sahadayken rakip tuzak kartları aktive edemez.',
    flavor: '',
    ace: true,
  },
  ...SEAL_PIECES.map(
    ([id, name, level, atk, def]): MonsterCardDef => ({
      id,
      kind: 'monster',
      name,
      attribute: 'DARK',
      race: 'Büyücü',
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
    name: 'Kum Saati Cücesi',
    attribute: 'LIGHT',
    race: 'Büyücü',
    level: 2,
    atk: 500,
    def: 400,
    effect: 'summonFreezeAttack',
    text: "Çağrıldığında rakibin 1 canavarı bir sonraki turunda saldıramaz.",
    flavor: '',
    ace: false,
  },
  {
    id: 'windmane_knight',
    kind: 'monster',
    name: 'Fırtına Şövalyesi',
    attribute: 'EARTH',
    race: 'Savaşçı',
    level: 7,
    atk: 2300,
    def: 2100,
    effect: 'summonTurnAtk500',
    text: "Normal çağrıldığı tur saldırırken ATK +500.",
    flavor: '',
    ace: true,
  },
  {
    id: 'shield_titan',
    kind: 'monster',
    name: 'Kalkan Devi',
    attribute: 'EARTH',
    race: 'Savaşçı',
    level: 4,
    atk: 100,
    def: 2600,
    effect: 'defenseAtkDebuff500',
    text: "Savunma pozisyonundayken, saldıran canavarın ATK'si 500 düşer.",
    flavor: '',
    ace: false,
  },
  {
    id: 'wing_lady',
    kind: 'monster',
    name: 'Kanat Hanımı',
    attribute: 'WIND',
    race: 'Kanatlı',
    level: 4,
    atk: 1300,
    def: 1400,
    effect: 'windAura300',
    text: "Sahandaki diğer RÜZGAR canavarlarının ATK'si +300.",
    flavor: '',
    ace: false,
  },
];

/** Batch 2 of the expanded roster (docs/v3/YENI_KARTLAR.md §6, owner decisions 2026-10-31). */
const MAGNET_TEXT = (a: string, b: string) => `Kutup parçası. ${a} ve ${b} ile birlikte Kutup Hükümdarı'nı çağırmak için kurban edilebilir.`;
const MONSTERS_B2: MonsterCardDef[] = [
  {
    id: 'tide_harpooner',
    kind: 'monster',
    name: 'Kabuk Zıpkıncı',
    attribute: 'WATER',
    race: 'Su',
    level: 5,
    atk: 1700,
    def: 1500,
    effect: 'tidalBayShroud',
    text: 'Gelgit Körfezi alan büyüsü sahadayken: rakip bu karta saldıramaz ve rakibin Büyü kartları bu kartı hedef alamaz. Rakibin saldırabileceği başka canavarın yoksa rakip doğrudan saldırabilir.',
    flavor: '',
    ace: true,
  },
  {
    id: 'dial_jester',
    kind: 'monster',
    name: 'Kadran Soytarısı',
    attribute: 'LIGHT',
    race: 'Büyücü',
    level: 2,
    atk: 700,
    def: 300,
    effect: 'coinWipe',
    text: "Turda 1 kez, Ana Aşamanda, rakibin sahasında canavar varken: Yazı ya da Tura seç ve para at. Bilirsen: rakibin sahasındaki tüm canavarları yok et. Bilemezsen: kendi sahandaki tüm canavarları yok et (bu kart dahil) ve yok olan canavarların toplam ATK'sinin yarısı kadar hasar al.",
    flavor: '',
    ace: false,
  },
  {
    id: 'cloud_hatchling',
    kind: 'monster',
    name: 'Bulut Yavrusu',
    attribute: 'WIND',
    race: 'Ejderha',
    level: 3,
    atk: 1100,
    def: 900,
    effect: 'jesterAging',
    text: "Kadran Soytarısı'nın yazı-turası bilindiğinde bu kart sahanda açıksa: büyür ve kalıcı olarak ATK +1200, DEF +800 kazanır (her Bulut Yavrusu için 1 kez).",
    flavor: '',
    ace: false,
  },
  {
    id: 'reflection_archer',
    kind: 'monster',
    name: 'Yansıyan Okçu',
    attribute: 'LIGHT',
    race: 'Büyücü',
    level: 4,
    atk: 1800,
    def: 1000,
    effect: 'none',
    text: '',
    flavor: 'Gölü olmayan yerde de bir yansıması vardır. Okunu ilk o atar.',
    ace: false,
  },
  {
    id: 'scrap_raiders',
    kind: 'monster',
    name: 'Hurda Akıncıları',
    attribute: 'FIRE',
    race: 'Savaşçı',
    level: 4,
    atk: 2000,
    def: 0,
    effect: 'attackThenDefense',
    text: 'Bu kart saldırı ilan ettikten sonra, savaş aşaması bittiğinde hâlâ sahadaysa savunma pozisyonuna geçer ve senin bir sonraki turunda pozisyon değiştiremez.',
    flavor: '',
    ace: false,
  },
  {
    id: 'hollow_ogre',
    kind: 'monster',
    name: 'Kovuk Devi',
    attribute: 'EARTH',
    race: 'Canavar-Savaşçı',
    level: 4,
    atk: 1400,
    def: 900,
    effect: 'banishGraveBoost400',
    text: 'Turda 1 kez, Ana Aşamanda: mezarlığından en çok 2 canavarı oyundan çıkar. Bu kart bu tur, çıkarılan her canavar için +400 ATK kazanır.',
    flavor: '',
    ace: false,
  },
  {
    id: 'crag_axeman',
    kind: 'monster',
    name: 'Kaya Baltacı',
    attribute: 'EARTH',
    race: 'Savaşçı',
    level: 4,
    atk: 1600,
    def: 1300,
    effect: 'none',
    text: '',
    flavor: 'Dağı ikiye yarmak için tek bir savuruş yeter derler. O hiç ikinciye gerek duymadı.',
    ace: false,
  },
  {
    id: 'reed_heron',
    kind: 'monster',
    name: 'Sazlık Balıkçılı',
    attribute: 'WATER',
    race: 'Kanatlı Canavar',
    level: 4,
    atk: 1400,
    def: 1500,
    effect: 'none',
    text: '',
    flavor: 'Sisin içinde tek ayak üstünde bekler. Gagası suyu bozmadan iner.',
    ace: false,
  },
  {
    id: 'kite_fencer',
    kind: 'monster',
    name: 'Uçurtma Eskrimci',
    attribute: 'WIND',
    race: 'Savaşçı',
    level: 3,
    atk: 900,
    def: 600,
    effect: 'doubleAttackMonster',
    text: 'Bu kart her Savaş Aşamasında iki kez saldırabilir. İkinci saldırı yalnızca bir canavara yapılabilir.',
    flavor: '',
    ace: false,
  },
  {
    id: 'mudgrasp_spirit',
    kind: 'monster',
    name: 'Çamur Pençe Ruhu',
    attribute: 'EARTH',
    race: 'Şeytan',
    level: 4,
    atk: 700,
    def: 1800,
    effect: 'defenseAttackedPin',
    text: 'Savunma pozisyonundayken saldırıya uğrarsa: savaştan sonra saldıran canavar savunma pozisyonuna geçer ve sahibinin bir sonraki turunda pozisyon değiştiremez.',
    flavor: '',
    ace: false,
  },
  {
    id: 'steppe_spiralhorn',
    kind: 'monster',
    name: 'Bozkır Boynuzlusu',
    attribute: 'WIND',
    race: 'Canavar',
    level: 4,
    atk: 1500,
    def: 1400,
    effect: 'none',
    text: '',
    flavor: 'Bozkırın rüzgarı onun izinden eser. Sarmal boynuzlarından geçerken ıslık çalar.',
    ace: false,
  },
  {
    id: 'polar_needle',
    kind: 'monster',
    name: 'Kutup İğnesi',
    attribute: 'EARTH',
    race: 'Kaya',
    level: 4,
    atk: 1500,
    def: 1100,
    effect: 'magnetPiece',
    text: MAGNET_TEXT('Kutup Örsü', 'Kutup Bobini'),
    flavor: '',
    ace: false,
  },
  {
    id: 'polar_anvil',
    kind: 'monster',
    name: 'Kutup Örsü',
    attribute: 'EARTH',
    race: 'Kaya',
    level: 4,
    atk: 1100,
    def: 1700,
    effect: 'magnetPiece',
    text: MAGNET_TEXT('Kutup İğnesi', 'Kutup Bobini'),
    flavor: '',
    ace: false,
  },
  {
    id: 'polar_coil',
    kind: 'monster',
    name: 'Kutup Bobini',
    attribute: 'EARTH',
    race: 'Kaya',
    level: 4,
    atk: 1300,
    def: 1400,
    effect: 'magnetPiece',
    text: MAGNET_TEXT('Kutup İğnesi', 'Kutup Örsü'),
    flavor: '',
    ace: false,
  },
  {
    id: 'polar_sovereign',
    kind: 'monster',
    name: 'Kutup Hükümdarı',
    attribute: 'EARTH',
    race: 'Kaya',
    level: 8,
    atk: 3000,
    def: 2800,
    effect: 'magnetFusion',
    text: "Normal Çağrılamaz ve kapalı konamaz. Sahandaki Kutup İğnesi, Kutup Örsü ve Kutup Bobini'ni kurban ederek elinden Özel Çağrılır. Bu kart yok edildiğinde: mezarlığında Kutup İğnesi, Kutup Örsü ve Kutup Bobini varsa ve sahanda 3 boş canavar alanı varsa, üçünü savunma pozisyonunda Özel Çağır.",
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
    name: 'Saman Korkuluk',
    attribute: 'EARTH',
    race: 'Bitki',
    level: 1,
    atk: 0,
    def: 0,
    effect: 'none',
    text: 'Saman Korkuluklar jetonu. Kurban edilemez.',
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
    name: 'Yıldırım Hükmü',
    effect: 'destroyOpponentMonster',
    text: 'Rakibin 1 canavarını hedef al ve yok et.',
  },
  {
    id: 'healing_spring',
    kind: 'spell',
    spellType: 'normal',
    name: 'Şifa Pınarı',
    effect: 'gain1000',
    text: '1000 LP kazan.',
  },
  {
    id: 'soul_recall',
    kind: 'spell',
    spellType: 'normal',
    name: 'Ruh Çağrısı',
    effect: 'reviveFromGraveyard',
    text: 'Herhangi bir mezarlıktan 1 canavarı hedef al ve saldırı pozisyonunda sahana Özel Çağır.',
  },
  {
    id: 'dragon_blade',
    kind: 'spell',
    spellType: 'equip',
    name: 'Ejder Kılıcı',
    effect: 'equipAtk700',
    text: 'Sahandaki 1 açık canavara kuşan. Kuşanan canavar +700 ATK kazanır.',
  },
  {
    id: 'volcano_arena',
    kind: 'spell',
    spellType: 'field',
    name: 'Volkan Arenası',
    effect: 'fieldVolcano',
    text: 'Sahadaki tüm ATEŞ canavarlar +500 ATK, tüm SU canavarlar -300 ATK kazanır.',
  },
];

const TRAPS: TrapCardDef[] = [
  {
    id: 'mirror_barrier',
    kind: 'trap',
    name: 'Ayna Kalkanı',
    effect: 'attackDestroyAllAttackPosition',
    text: 'Rakibin canavarı saldırı ilan ettiğinde: rakibin saldırı pozisyonundaki tüm canavarlarını yok et.',
  },
  {
    id: 'chains_of_light',
    kind: 'trap',
    name: 'Işık Zincirleri',
    effect: 'attackNegateEndBattle',
    text: 'Rakibin canavarı saldırı ilan ettiğinde: saldırıyı geçersiz kıl ve Savaş Aşamasını bitir.',
  },
  {
    id: 'chasm_trap',
    kind: 'trap',
    name: 'Yer Yarığı',
    effect: 'summonDestroy1000Plus',
    text: 'Rakip ATK değeri 1000 veya daha yüksek bir canavarı Normal Çağırdığında: o canavarı yok et.',
  },
];


/** Spell/trap batch 1 (docs/KART_TASLAGI_BUYU_TUZAK.md): 11 spells (2 equip, 3 field) and 7 traps; original names. */
const SPELLS_B1: SpellCardDef[] = [
  {
    id: 'fate_trade',
    kind: 'spell',
    spellType: 'normal',
    name: 'Kader Takası',
    effect: 'draw2Discard1',
    text: '2 kart çek, sonra elinden 1 kart at. (Destende en az 3 kart olmalı.)',
  },
  {
    id: 'double_offering',
    kind: 'spell',
    spellType: 'normal',
    name: 'Çifte Kurban',
    effect: 'doubleTribute',
    text: 'Bu tur Seviye 7 veya daha yüksek bir canavarı tek kurbanla çağırabilirsin.',
  },
  {
    id: 'kneel_down',
    kind: 'spell',
    spellType: 'normal',
    name: 'Diz Çöktürme',
    effect: 'forceDefense',
    text: "Rakibin saldırı pozisyonundaki 1 canavarı hedef al: savunmaya geçer, sonraki turunda pozisyon değiştiremez.",
  },
  {
    id: 'cycle_of_graves',
    kind: 'spell',
    spellType: 'normal',
    name: 'Devir Daim',
    effect: 'recycleGraveyard',
    text: 'Mezarlığındaki son 3 kartı desteye karıştır, sonra 1 kart çek.',
  },
  {
    id: 'battle_cry',
    kind: 'spell',
    spellType: 'normal',
    name: 'Savaş Narası',
    effect: 'atkBoostTurn',
    text: "Sahandaki 1 açık canavarı hedef al: bu tur ATK'si +1000.",
  },
  {
    id: 'purging_wave',
    kind: 'spell',
    spellType: 'normal',
    name: 'Arınma Dalgası',
    effect: 'destroyOpponentSpellTrap',
    text: "Rakibin sahasındaki 1 Büyü/Tuzak kartını (alan büyüsü dahil) hedef al ve yok et.",
  },
  {
    id: 'piercing_lance',
    kind: 'spell',
    spellType: 'equip',
    name: 'Delici Mızrak',
    effect: 'equipPiercing',
    text: 'Sahandaki 1 açık canavara kuşan. Kuşanan canavar +300 ATK kazanır ve delici hasar verir.',
  },
  {
    id: 'guardian_charm',
    kind: 'spell',
    spellType: 'equip',
    name: 'Koruyucu Tılsım',
    effect: 'equipDestroyShield',
    text: 'Sahandaki 1 açık canavara kuşan. Kuşanan canavar yok edilecek olursa, bunun yerine bu kart yok olur.',
  },
  {
    id: 'tidal_bay',
    kind: 'spell',
    spellType: 'field',
    name: 'Gelgit Körfezi',
    effect: 'fieldTidalBay',
    text: "Sahadaki tüm SU ve RÜZGAR canavarlar +400 ATK, tüm ATEŞ canavarlar -400 ATK kazanır.",
  },
  {
    id: 'shadow_cavern',
    kind: 'spell',
    spellType: 'field',
    name: 'Gölge Mağarası',
    effect: 'fieldShadowCavern',
    text: "Sahadaki tüm KARANLIK ve TOPRAK canavarlar +300 ATK, tüm IŞIK canavarlar -300 ATK kazanır.",
  },
  {
    id: 'festival_square',
    kind: 'spell',
    spellType: 'field',
    name: 'Şenlik Meydanı',
    effect: 'fieldExtraSummon',
    text: 'Normal Çağırma hakkın bittiyse, turda 1 kez daha Seviye 4 veya daha düşük bir canavarı Normal Çağırabilir ya da kapalı koyabilirsin.',
  },
  {
    id: 'dawn_swords',
    kind: 'spell',
    spellType: 'continuous',
    name: 'Şafak Kılıçları',
    effect: 'attackLock3',
    text: 'Rakibin tüm kapalı canavarlarını aç. Bu kart sahadayken rakibin canavarları saldıramaz. Rakibin 3. turunun sonunda bu kart yok olur.',
  },
];

const TRAPS_B1: TrapCardDef[] = [
  {
    id: 'spell_seal',
    kind: 'trap',
    name: 'Büyü Mührü',
    effect: 'spellActivateNegate',
    text: 'Rakip bir Büyü kartı aktive ettiğinde: aktivasyonu geçersiz kıl ve o büyüyü yok et.',
  },
  {
    id: 'toppling_tower',
    kind: 'trap',
    name: 'Devrilen Kule',
    effect: 'summonDestroy1800Plus',
    text: 'Rakip ATK değeri 1800 veya daha yüksek bir canavarı Normal, Kurbanla ya da Özel Çağırdığında: o canavarı yok et.',
  },
  {
    id: 'homecoming',
    kind: 'trap',
    name: 'Eve Dönüş',
    effect: 'attackBounceAttacker',
    text: 'Rakibin canavarı saldırı ilan ettiğinde: saldırıyı geçersiz kıl ve o canavarı sahibinin eline geri gönder.',
  },
  {
    id: 'decoy_target',
    kind: 'trap',
    name: 'Sahte Hedef',
    effect: 'attackRedirect',
    text: 'Rakibin canavarı saldırı ilan ettiğinde: kendi sahandaki başka bir canavarı seç; saldırı ona yönelir.',
  },
  {
    id: 'last_breath',
    kind: 'trap',
    name: 'Son Nefes',
    effect: 'lpBelow1500Gain1500',
    text: "Rakibin verdiği hasar LP'ni 1500'ün altına düşürdüğünde (0 değilse): 1500 LP kazan.",
  },
  {
    id: 'sandstorm',
    kind: 'trap',
    name: 'Kum Fırtınası',
    effect: 'attackNegateAllDefense',
    text: "Rakibin canavarı saldırı ilan ettiğinde: saldırıyı geçersiz kıl ve rakibin saldırı pozisyonundaki tüm canavarlarını savunma pozisyonuna çevir.",
  },
  {
    id: 'hidden_reinforcement',
    kind: 'trap',
    name: 'Gizli Takviye',
    effect: 'attackedBoost1000',
    text: "Rakibin canavarı sana ait bir canavara saldırı ilan ettiğinde: saldırılan canavarın ATK ve DEF'i bu savaş boyunca +1000.",
  },
  {
    id: 'magic_hat',
    kind: 'trap',
    name: 'Sihirli Şapka',
    effect: 'hatShuffle',
    text: 'Rakibin canavarı saldırı ilan edince: saldırılan canavarını ve 2 sahte şapkayı kapalı karıştır; rakip birini seçip saldırır.',
  },
];

/** Spell batch 2 (docs/v3/YENI_KARTLAR.md §7; owner decision: no Yaldızlı Kafes). */
const SPELLS_B2: SpellCardDef[] = [
  {
    id: 'well_pail',
    kind: 'spell',
    spellType: 'normal',
    name: 'Kuyu Kovası',
    effect: 'draw2',
    text: '2 kart çek. (Destende en az 2 kart olmalı.)',
  },
  {
    id: 'puppet_string',
    kind: 'spell',
    spellType: 'normal',
    name: 'Kukla İpi',
    effect: 'controlUntilEnd',
    text: 'Rakibin sahasındaki 1 canavarı hedef al (jeton hariç): Bitiş Aşamasına kadar onun kontrolünü al. (Sahanda boş canavar alanı olmalı.)',
  },
  {
    id: 'void_eye',
    kind: 'spell',
    spellType: 'normal',
    name: 'Boşluk Gözü',
    effect: 'destroyAllMonsters',
    text: 'Sahadaki tüm canavarları yok et.',
  },
  {
    id: 'sweeping_gale',
    kind: 'spell',
    spellType: 'normal',
    name: 'Süpürge Rüzgarı',
    effect: 'destroyAllOppSpellTrap',
    text: 'Rakibin sahasındaki tüm Büyü ve Tuzak kartlarını (alan büyüsü dahil) yok et.',
  },
  {
    id: 'winnow_sieve',
    kind: 'spell',
    spellType: 'normal',
    name: 'Harman Eleği',
    effect: 'draw3Discard2',
    text: '3 kart çek, sonra elinden 2 kart at. (Destende en az 3 kart olmalı.)',
  },
  {
    id: 'auger_lance',
    kind: 'spell',
    spellType: 'quick',
    name: 'Burgu Mızrağı',
    effect: 'destroySpellTrapQuick',
    text: 'Hızlı Büyü. Sahadaki 1 Büyü/Tuzak kartını hedef al ve yok et. (Kapalı koyduğun turdan sonra, rakibin saldırı ilanında ya da canavar çağırmasında da aktive edebilirsin.)',
  },
  {
    id: 'soul_leash',
    kind: 'spell',
    spellType: 'equip',
    name: 'Ruh Tasması',
    effect: 'equipControl',
    text: 'Rakibin açık 1 canavarına kuşan (jeton hariç): bu kart sahadayken onun kontrolü sende. Rakibin her Çekme Aşamasında rakip 1000 LP kazanır.',
  },
  {
    id: 'straw_decoys',
    kind: 'spell',
    spellType: 'quick',
    name: 'Saman Korkuluklar',
    effect: 'strawTokens',
    text: "Hızlı Büyü. Boş canavar alanı sayısının 1 eksiği kadar (en az 1) 'Saman Korkuluk' jetonunu (Sv1, 0/0) savunma pozisyonunda Özel Çağır. Jetonlar kurban edilemez. Bu kartı kendi turunda aktive ettiysen o tur başka canavar çağıramazsın.",
  },
  {
    id: 'spite_axe',
    kind: 'spell',
    spellType: 'equip',
    name: 'Hınç Baltası',
    effect: 'equipAtk800Return',
    text: 'Sahandaki 1 açık canavara kuşan: +800 ATK. Bu kart sahadan mezarlığa gönderilecek olursa, bunun yerine sahibinin destesinin en üstüne konur ve sahibi 500 hasar alır.',
  },
  {
    id: 'page_turner',
    kind: 'spell',
    spellType: 'normal',
    name: 'Sayfa Çeviren',
    effect: 'handRefreshBoth',
    text: 'Her iki oyuncu elindeki tüm kartları mezarlığa gönderir, sonra gönderdiği kadar kart çeker.',
  },
  {
    id: 'lucky_die',
    kind: 'spell',
    spellType: 'normal',
    name: 'Talih Zarı',
    effect: 'diceBoost100',
    text: "Bir zar at: sahandaki tüm açık canavarların ATK ve DEF'i bu tur, gelen sayı × 100 artar.",
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
