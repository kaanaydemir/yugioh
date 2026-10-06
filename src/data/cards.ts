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
  | 'flipDestroyMonster'; // thorn_lurker

export type SpellEffect =
  | 'destroyOpponentMonster' // judgment_bolt
  | 'gain1000' // healing_spring
  | 'reviveFromGraveyard' // soul_recall
  | 'equipAtk700' // dragon_blade
  | 'fieldVolcano'; // volcano_arena

export type TrapEffect =
  | 'attackDestroyAllAttackPosition' // mirror_barrier
  | 'attackNegateEndBattle' // chains_of_light
  | 'summonDestroy1000Plus'; // chasm_trap

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
  | 'thorn_lurker';

export type SpellId = 'judgment_bolt' | 'healing_spring' | 'soul_recall' | 'dragon_blade' | 'volcano_arena';

export type TrapId = 'mirror_barrier' | 'chains_of_light' | 'chasm_trap';

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

export const ALL_CARDS: CardDef[] = [...MONSTERS, ...SPELLS, ...TRAPS];

export const CARDS: Record<CardId, CardDef> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c])) as Record<
  CardId,
  CardDef
>;

export const MONSTER_IDS: MonsterId[] = MONSTERS.map((m) => m.id);
export const SPELL_IDS: SpellId[] = SPELLS.map((s) => s.id);
export const TRAP_IDS: TrapId[] = TRAPS.map((t) => t.id);
export const ALL_CARD_IDS: CardId[] = ALL_CARDS.map((c) => c.id);

/** Default deck: one copy of each of the 20 cards (both players use it, shuffled). */
export const DEFAULT_DECK: CardId[] = [...ALL_CARD_IDS];

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
