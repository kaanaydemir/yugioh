// Short Turkish battle-log lines for engine events, with proper suffix harmony on card names
// ("Kor Kurdu'nu çağırdı", "Taş Muhafız'a saldırıyor"). Hidden information (drawn cards, set
// cards) is never revealed. Returns null for events that should not appear in the log.
//
// `state` is used only to resolve card names (state.cards never changes during a game), so
// either the state before or after the action works.

import { CARDS, type CardId } from '../data/cards';
import type { GameEvent, GameState, PendingDecision, PlayerId, Uid, ZoneRef } from './types';
import { uidAt } from './query';

/** Card names whose last word carries the 3rd-person possessive (compound nouns): buffer "n". */
const POSSESSIVE_NAMES: ReadonlySet<CardId> = new Set<CardId>([
  'abyss_magus', // Uçurum Büyücüsü
  'magma_titan', // Magma Titanı
  'coral_serpent', // Mercan Yılanı
  'ember_wolf', // Kor Kurdu
  'tide_golem', // Gelgit Golemi
  'storm_hawk', // Fırtına Atmacası
  'lumen_sprite', // Işık Perisi
  'volt_lizard', // Şimşek Kertenkelesi
  'judgment_bolt', // Yıldırım Hükmü
  'healing_spring', // Şifa Pınarı
  'soul_recall', // Ruh Çağrısı
  'dragon_blade', // Ejder Kılıcı
  'volcano_arena', // Volkan Arenası
  'mirror_barrier', // Ayna Kalkanı
  'chains_of_light', // Işık Zincirleri
  'chasm_trap', // Yer Yarığı
]);

const VOWELS = 'aeıioöuü';

function lastVowel(word: string): string {
  const w = word.toLocaleLowerCase('tr');
  for (let i = w.length - 1; i >= 0; i--) if (VOWELS.includes(w[i])) return w[i];
  return 'e';
}

/** Two-way harmony (a/e). */
function h2(v: string): string {
  return 'aıou'.includes(v) ? 'a' : 'e';
}

/** Four-way harmony (ı/i/u/ü). */
function h4(v: string): string {
  if ('aı'.includes(v)) return 'ı';
  if ('ei'.includes(v)) return 'i';
  if ('ou'.includes(v)) return 'u';
  return 'ü';
}

export type GrammaticalCase = 'nom' | 'acc' | 'dat' | 'gen' | 'loc' | 'abl';

/** A word with a case suffix after an apostrophe, e.g. inflect('Kor Kurdu', 'acc', true) → "Kor Kurdu'nu". */
export function inflect(name: string, kase: GrammaticalCase, possessive = false): string {
  if (kase === 'nom') return name;
  const lower = name.toLocaleLowerCase('tr');
  const endsVowel = VOWELS.includes(lower[lower.length - 1]);
  const v = lastVowel(lower);
  const lastChar = lower[lower.length - 1];
  const hard = 'fstkçşhp'.includes(lastChar);
  let suffix: string;
  switch (kase) {
    case 'acc':
      suffix = (endsVowel ? (possessive ? 'n' : 'y') : '') + h4(v);
      break;
    case 'dat':
      suffix = (endsVowel ? (possessive ? 'n' : 'y') : '') + h2(v);
      break;
    case 'gen':
      suffix = (endsVowel ? 'n' : '') + h4(v) + 'n';
      break;
    case 'loc':
      suffix = (endsVowel && possessive ? 'n' : '') + (hard ? 't' : 'd') + h2(v);
      break;
    case 'abl':
      suffix = (endsVowel && possessive ? 'n' : '') + (hard ? 't' : 'd') + h2(v) + 'n';
      break;
  }
  return `${name}'${suffix}`;
}

/** Card name in a grammatical case. */
export function cardName(id: CardId, kase: GrammaticalCase = 'nom'): string {
  return inflect(CARDS[id].name, kase, POSSESSIVE_NAMES.has(id));
}

/** "Oyuncu 1" / "Oyuncu 2" with case suffixes (numbers read "bir" / "iki"). */
export function playerName(p: PlayerId, kase: GrammaticalCase = 'nom'): string {
  const n = p + 1;
  const base = `Oyuncu ${n}`;
  if (kase === 'nom') return base;
  // bir → bire, birin, birde, birden; iki → ikiye, ikinin, ikide, ikiden
  const sfx: Record<Exclude<GrammaticalCase, 'nom'>, [string, string]> = {
    acc: ['i', 'yi'],
    dat: ['e', 'ye'],
    gen: ['in', 'nin'],
    loc: ['de', 'de'],
    abl: ['den', 'den'],
  };
  return `${base}'${sfx[kase][n === 1 ? 0 : 1]}`;
}

function nameOf(state: GameState, uid: Uid, kase: GrammaticalCase = 'nom'): string {
  const card = state.cards[uid];
  return card ? cardName(card.cardId, kase) : '?';
}

function refName(state: GameState, ref: ZoneRef): string | null {
  const uid = uidAt(state, ref);
  if (uid === null) return null;
  const ps = state.players[ref.player];
  const slot = ref.zone === 'monster' ? ps.monsters[ref.index] : ref.zone === 'spellTrap' ? ps.spellTraps[ref.index] : ps.fieldSpell;
  if (!slot || !slot.faceUp) return ref.zone === 'monster' ? 'kapalı canavar' : 'kapalı kart';
  return nameOf(state, uid);
}

function isFaceDownMonster(state: GameState, uid: Uid): boolean {
  for (const ps of state.players) for (const m of ps.monsters) if (m && m.uid === uid) return !m.faceUp;
  return false;
}

const WIN_REASON: Record<string, string> = {
  lp: 'LP sıfırlandı',
  deckout: 'deste bitti',
  surrender: 'rakip teslim oldu',
};

/**
 * One short Turkish log line for `ev`, or null if the event should not be logged.
 * `batch` (optional): the event list `ev` belongs to (e.g. the events of one apply). With it the
 * describer can look ahead — an attacked face-down target is not named before its flip, and a
 * target that the same batch destroys is still named.
 */
export function describeEvent(state: GameState, ev: GameEvent, batch?: readonly GameEvent[]): string | null {
  const later = batch ? batch.slice(batch.indexOf(ev) + 1) : [];
  switch (ev.type) {
    case 'gameStart':
      return `Düello başladı! İlk sıra ${playerName(ev.firstPlayer, 'loc')}.`;
    case 'shuffle':
      return `${playerName(ev.player)} destesini karıştırdı.`;
    case 'draw':
      return ev.initial ? null : `${playerName(ev.player)} bir kart çekti.`;
    case 'turnStart':
      return `Tur ${ev.turn} - ${playerName(ev.player)}`;
    case 'phaseChange':
      if (ev.phase === 'battle') return `${playerName(ev.player)} Savaş Aşamasına geçti!`;
      if (ev.phase === 'end') return `${playerName(ev.player)}: Bitiş Aşaması.`;
      return null;
    case 'tribute':
      return `${playerName(ev.player)}, ${cardName(ev.cardId, 'acc')} kurban etti.`;
    case 'summon':
      switch (ev.method) {
        case 'normal':
          return `${playerName(ev.player)}, ${cardName(ev.cardId, 'acc')} çağırdı.`;
        case 'tribute':
          return `${playerName(ev.player)}, ${cardName(ev.cardId, 'acc')} kurbanla çağırdı!`;
        case 'special':
          return `${playerName(ev.player)}, ${cardName(ev.cardId, 'acc')} mezarlıktan özel çağırdı!`;
        case 'flip':
          return `${playerName(ev.player)}, ${cardName(ev.cardId, 'acc')} çevirerek çağırdı!`;
      }
      return null;
    case 'setMonster':
      return `${playerName(ev.player)} kapalı bir canavar koydu.`;
    case 'setSpellTrap':
      return `${playerName(ev.player)} kapalı bir kart koydu.`;
    case 'positionChange':
      return `${nameOf(state, ev.uid)} ${ev.position === 'defense' ? 'savunma' : 'saldırı'} pozisyonuna geçti.`;
    case 'flip':
      return ev.cause === 'attacked' ? `Kapalı kart açıldı: ${cardName(ev.cardId)}!` : null;
    case 'activate':
      if (ev.kind === 'spell') return `${playerName(ev.player)} büyü kartı açtı: ${cardName(ev.cardId)}!`;
      if (ev.kind === 'trap') return `${playerName(ev.player)} tuzak kartı açtı: ${cardName(ev.cardId)}!`;
      return `${cardName(ev.cardId, 'gen')} etkisi!`;
    case 'target': {
      if (ev.graveyardUid !== undefined) return `Mezarlıktan hedef: ${nameOf(state, ev.graveyardUid)}.`;
      const names = ev.targets
        .map((t) => {
          const gone = later.find(
            (e) => e.type === 'destroy' && e.player === t.player && e.location === t.zone && e.zone === t.index,
          );
          return gone && gone.type === 'destroy' ? cardName(gone.cardId) : refName(state, t);
        })
        .filter((n): n is string => n !== null);
      return names.length ? `Hedef: ${names.join(', ')}.` : null;
    }
    case 'attackDeclare': {
      const a = nameOf(state, ev.attackerUid);
      if (ev.targetUid === null) return `${a} doğrudan saldırıyor!`;
      const flipsLater = later.some((e) => e.type === 'flip' && e.cause === 'attacked' && e.uid === ev.targetUid);
      if (flipsLater || isFaceDownMonster(state, ev.targetUid)) return `${a} kapalı canavara saldırıyor!`;
      return `${a}, ${nameOf(state, ev.targetUid, 'dat')} saldırıyor!`;
    }
    case 'attackNegated':
      return `${nameOf(state, ev.attackerUid, 'gen')} saldırısı geçersiz kılındı!`;
    case 'battle': {
      if (ev.targetUid === null) return null;
      const pos = ev.targetPosition === 'defense' ? 'DEF' : 'ATK';
      return `${nameOf(state, ev.attackerUid)} (ATK ${ev.attackerAtk}) ile ${nameOf(state, ev.targetUid)} (${pos} ${ev.targetValue}) çarpıştı!`;
    }
    case 'damage':
      return `${playerName(ev.player)}, ${ev.amount} hasar aldı! (LP ${ev.lpAfter})`;
    case 'lpGain':
      return `${playerName(ev.player)}, ${ev.amount} LP kazandı. (LP ${ev.lpAfter})`;
    case 'destroy':
      return ev.reason === 'rule' ? `${cardName(ev.cardId)} yok oldu.` : `${cardName(ev.cardId)} yok edildi!`;
    case 'toGraveyard':
      return null;
    case 'equip':
      return `${nameOf(state, ev.targetUid)}, ${nameOf(state, ev.spellUid, 'acc')} kuşandı!`;
    case 'fieldSpell':
      return ev.active ? `Saha dönüştü: ${cardName(ev.cardId)}!` : `${cardName(ev.cardId)} sona erdi.`;
    case 'statChange': {
      const n = nameOf(state, ev.uid);
      const parts: string[] = [];
      if (ev.atk !== ev.prevAtk) parts.push(`ATK ${ev.atk} (${signed(ev.atk - ev.prevAtk)})`);
      if (ev.def !== ev.prevDef) parts.push(`DEF ${ev.def} (${signed(ev.def - ev.prevDef)})`);
      return parts.length ? `${n}: ${parts.join(', ')}.` : null;
    }
    case 'discard':
      return `${playerName(ev.player)} elinden ${cardName(ev.cardId, 'acc')} attı.`;
    case 'decision':
      return null;
    case 'responseDeclined':
      return `${playerName(ev.player)} tuzak açmadı.`;
    case 'deckOut':
      return `${playerName(ev.player, 'gen')} destesi bitti!`;
    case 'gameOver':
      return `${playerName(ev.winner)} kazandı! (${WIN_REASON[ev.reason] ?? ev.reason})`;
  }
  return null;
}

/** Turkish prompt for a pending decision (shown to `pending.player`). */
export function describePending(state: GameState, pd: PendingDecision): string {
  switch (pd.kind) {
    case 'trapResponse':
      return `${playerName(pd.player)}: Tuzak kartı açmak ister misin?`;
    case 'chooseTarget': {
      const card = state.cards[pd.sourceUid];
      const what = pd.candidates.every((c) => c.zone === 'monster') ? 'canavarı' : 'kartı';
      return card ? `${cardName(card.cardId, 'gen')} etkisi: yok edilecek ${what} seç.` : `Yok edilecek ${what} seç.`;
    }
    case 'discard':
      return `${playerName(pd.player)}: El sınırı 6. Elinden ${pd.count} kart at.`;
  }
}

/** Log lines for a batch of events (nulls dropped), with look-ahead context. */
export function describeEvents(state: GameState, events: readonly GameEvent[]): string[] {
  const out: string[] = [];
  for (const ev of events) {
    const line = describeEvent(state, ev, events);
    if (line) out.push(line);
  }
  return out;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
