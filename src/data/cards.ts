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
  | 'windAura300'; // wing_lady: the other face-up WIND monsters on its controller's field get +300 ATK

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
  | 'fieldExtraSummon'; // festival_square: its controller may Normal Summon / Set one extra Level <= 4 monster per turn

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
  | 'attackedBoost1000'; // hidden_reinforcement: the attacked monster gets +1000 ATK/DEF this battle

export type SpellType = 'normal' | 'equip' | 'field';

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
  | 'wing_lady';

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
  | 'festival_square';

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
  | 'hidden_reinforcement';

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
}

export interface SpellCardDef {
  id: SpellId;
  kind: 'spell';
  spellType: SpellType;
  name: string;
  effect: SpellEffect;
  text: string;
}

export interface TrapCardDef {
  id: TrapId;
  kind: 'trap';
  name: string;
  effect: TrapEffect;
  text: string;
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
    text: "Rakibin açık saldırı pozisyonundaki 1 canavarını hedef al: savunma pozisyonuna geçer ve bir sonraki turunda pozisyonunu değiştiremez.",
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
];

/** The 20 original cards (DEFAULT_DECK) followed by the expanded roster; new cards are only ever appended. */
export const ALL_CARDS: CardDef[] = [...MONSTERS, ...SPELLS, ...TRAPS, ...MONSTERS_B1, ...SPELLS_B1, ...TRAPS_B1];

export const CARDS: Record<CardId, CardDef> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c])) as Record<
  CardId,
  CardDef
>;

export const MONSTER_IDS: MonsterId[] = [...MONSTERS, ...MONSTERS_B1].map((m) => m.id);
export const SPELL_IDS: SpellId[] = [...SPELLS, ...SPELLS_B1].map((s) => s.id);
export const TRAP_IDS: TrapId[] = [...TRAPS, ...TRAPS_B1].map((t) => t.id);
export const ALL_CARD_IDS: CardId[] = ALL_CARDS.map((c) => c.id);

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
