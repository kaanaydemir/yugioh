// Batch-2 cards (docs/v3/YENI_KARTLAR.md) — staged boards for the hot-seat playtest of the new decisions and the
// placeholder presentation (src/cinematics/b2/). Every stage is a 5 + 5 board; most have no steps: a person plays
// them with the mouse (?dev=duel&s=<name>&look=v3), the "…Auto" twins play the same moves by dispatch (films).
//   node tools/shot.mjs "?dev=duel&s=b2WipeAuto&look=v3" --fresh --film 24 --every 120 --cols 6 --out shots/eng/b2-wipe.png
// rng 12345 (the stage default): the next coin lands on YAZI ('tails'), the next die rolls 6.
import type { Scenario, Step } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { Action, GameState, PlayerId } from '../../engine/types';
import type { MonSpec, STSpec } from '../scenario';

type Qa = { state(): GameState };
const N = null;
const pad = <T,>(xs: (T | null)[]): (T | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => pad(xs);
const fiveST = (...xs: (STSpec | null)[]): (STSpec | null)[] => pad(xs);
const st = (D: unknown): GameState => (D as Qa).state();
const act = (p: PlayerId, id: CardId, extra: Record<string, unknown> = {}): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid(id, p), ...extra }) as Action;
/** The first zone of `p` holding `id`. */
const zoneOf = (s: GameState, p: PlayerId, id: CardId): number => s.players[p].monsters.findIndex((m) => m && s.cards[m.uid].cardId === id);

const B2: Record<string, Scenario> = {
  // ---- quick spells: Oyuncu 2 answers Oyuncu 1's attack / summon with a set quick spell
  b2QuickDecoy: {
    desc: 'Hızlı büyü: P1 doğrudan saldırır, P2 kapalı Saman Korkuluklar ile yanıt verir (jetonlar + yeni hedef seçimi)',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five('crag_axeman', N, 'reflection_archer') },
      p1: { spellTraps: fiveST(N, 'straw_decoys', N, 'auger_lance'), hand: ['reed_heron', 'well_pail'] },
    },
    steps: [],
  },
  b2QuickLance: {
    desc: 'Hızlı büyü: P1 canavar çağırır, P2 kapalı Burgu Mızrağı ile P1’in Ejder Kılıcı’nı yok eder',
    stage: {
      zones: 5,
      p0: { hand: ['steppe_spiralhorn', 'well_pail'], monsters: five(N, 'crag_axeman'), spellTraps: fiveST(N, { id: 'dragon_blade', equippedTo: 1 }, 'mirror_barrier') },
      p1: { spellTraps: fiveST(N, N, 'auger_lance'), monsters: five(N, N, 'reed_heron') },
    },
    steps: [],
  },
  b2QuickOwn: {
    desc: 'Hızlı büyü kendi turunda: P1 elden Saman Korkuluklar açar (jetonlar; bu tur başka çağırma yok)',
    stage: { zones: 5, p0: { hand: ['straw_decoys', 'kite_fencer', 'auger_lance'], monsters: five(N, N, 'hollow_ogre') }, p1: { monsters: five('scrap_raiders'), spellTraps: fiveST(N, 'mirror_barrier') } },
    steps: [],
  },
  // ---- control switch
  b2Control: {
    desc: 'Kontrol değişimi: P1 Kukla İpi ve Ruh Tasması ile P2’nin canavarlarını alır; tur sonunda İp’in canavarı döner',
    stage: {
      zones: 5,
      p0: { hand: ['puppet_string', 'soul_leash', 'spite_axe'], monsters: five(N, 'kite_fencer') },
      p1: { monsters: five(N, 'crystal_wyrm', 'scrap_raiders', { id: 'polar_anvil', position: 'defense' }) },
    },
    steps: [],
  },
  // ---- field wipes
  b2Wipe: {
    desc: 'Toplu yok etme: P1 Boşluk Gözü (tüm canavarlar) ve Süpürge Rüzgarı (rakibin büyü/tuzakları)',
    stage: {
      zones: 5,
      p0: { hand: ['void_eye', 'sweeping_gale', 'page_turner'], monsters: five('crag_axeman', N, 'reed_heron'), spellTraps: fiveST(N, 'guardian_charm') },
      p1: {
        monsters: five(N, 'magma_titan', 'steppe_spiralhorn', { id: 'mudgrasp_spirit', faceUp: false }),
        spellTraps: fiveST('mirror_barrier', 'chasm_trap', N, 'auger_lance'),
        field: 'tidal_bay',
        hand: ['ember_wolf', 'tide_golem', 'storm_hawk'],
      },
    },
    steps: [],
  },
  b2WipeAuto: {
    desc: 'Toplu yok etme (film): Boşluk Gözü',
    stage: {
      zones: 5,
      p0: { hand: ['void_eye'], monsters: five('crag_axeman', N, 'reed_heron') },
      p1: { monsters: five(N, 'magma_titan', 'steppe_spiralhorn', { id: 'mudgrasp_spirit', faceUp: false }) },
    },
    steps: [act(0, 'void_eye')],
  },
  b2GaleAuto: {
    desc: 'Toplu yok etme (film): Süpürge Rüzgarı',
    stage: { zones: 5, p0: { hand: ['sweeping_gale'] }, p1: { spellTraps: fiveST('mirror_barrier', 'chasm_trap', N, 'auger_lance'), field: 'tidal_bay' } },
    steps: [act(0, 'sweeping_gale')],
  },
  // ---- tokens
  b2Tokens: {
    desc: 'Jetonlar: P2 kapalı Saman Korkuluklar ile P1’in saldırısına yanıt verir; jetonlar savaşta yok olur',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five('kite_fencer', 'crag_axeman') },
      p1: { spellTraps: fiveST(N, N, 'straw_decoys'), monsters: five(N, N, N, 'reed_heron') },
    },
    steps: [],
  },
  // ---- coin
  b2Coin: {
    desc: 'Yazı-tura: P1 Kadran Soytarısı etkisi (rng 12345: YAZI gelir — YAZI de: bildi, TURA de: bilemedi)',
    stage: {
      zones: 5,
      p0: { monsters: five(N, 'dial_jester', 'cloud_hatchling', 'crag_axeman') },
      p1: { monsters: five('magma_titan', N, 'reed_heron', 'steppe_spiralhorn'), spellTraps: fiveST(N, 'guardian_charm') },
    },
    steps: [],
  },
  b2CoinWinAuto: {
    desc: 'Yazı-tura (film): bildi',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', 'cloud_hatchling') }, p1: { monsters: five('magma_titan', N, 'reed_heron') } },
    steps: [{ type: 'activateMonster', player: 0, zone: 1 }, { type: 'callCoin', player: 0, call: 'tails' }],
  },
  b2CoinLoseAuto: {
    desc: 'Yazı-tura (film): bilemedi',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', 'cloud_hatchling') }, p1: { monsters: five('magma_titan', N, 'reed_heron') } },
    steps: [{ type: 'activateMonster', player: 0, zone: 1 }, { type: 'callCoin', player: 0, call: 'heads' }],
  },
  // ---- dice
  b2Dice: {
    desc: 'Zar: P1 Talih Zarı (rng 12345: 6 gelir)',
    stage: { zones: 5, p0: { hand: ['lucky_die', 'winnow_sieve', 'well_pail'], monsters: five(N, 'crag_axeman', 'reed_heron'), deck: ['kite_fencer', 'polar_coil', 'spite_axe', 'stone_sentinel', 'page_turner'] }, p1: { monsters: five(N, N, 'magma_titan') } },
    steps: [],
  },
  b2DiceAuto: {
    desc: 'Zar (film): Talih Zarı',
    stage: { zones: 5, p0: { hand: ['lucky_die'], monsters: five(N, 'crag_axeman', 'reed_heron') } },
    steps: [act(0, 'lucky_die')],
  },
  // ---- fusion
  b2Fusion: {
    desc: 'Birleşme: P1 üç Kutup parçasını kurban edip Kutup Hükümdarı’nı çağırır; P2 Boşluk Gözü ile bölebilir',
    stage: {
      zones: 5,
      p0: { hand: ['polar_sovereign', 'well_pail'], monsters: five('polar_needle', N, 'polar_anvil', N, { id: 'polar_coil', position: 'defense' }) },
      p1: { hand: ['void_eye'], monsters: five(N, N, 'crystal_wyrm') },
    },
    steps: [],
  },
  b2FusionAuto: {
    desc: 'Birleşme (film): Kutup Hükümdarı',
    stage: { zones: 5, p0: { hand: ['polar_sovereign'], monsters: five('polar_needle', N, 'polar_anvil', N, 'polar_coil') } },
    steps: [
      (D) => {
        const s = st(D);
        const t = [zoneOf(s, 0, 'polar_needle'), zoneOf(s, 0, 'polar_anvil'), zoneOf(s, 0, 'polar_coil')].map((z) => s.players[0].monsters[z]!.uid).sort((a, b) => a - b);
        return { type: 'specialSummon', player: 0, uid: D.uid('polar_sovereign', 0), zone: 2, tributes: t };
      },
    ],
  },
  b2SplitAuto: {
    desc: 'Bölünme (film): Kutup Hükümdarı Boşluk Gözü ile yok olur, üç parça savunmada döner',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'polar_sovereign'), graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'] }, p1: { hand: ['void_eye'] } },
    steps: [act(1, 'void_eye')],
  },
  // ---- the other new decisions (count, discard cost, hand refresh, the axe)
  b2Ogre: {
    desc: 'Sayı seçimi: P1 Kovuk Devi mezarlıktan 1 ya da 2 canavar çıkarır',
    stage: { zones: 5, p0: { monsters: five(N, 'hollow_ogre'), graveyard: ['ember_wolf', 'storm_hawk', 'judgment_bolt'] }, p1: { monsters: five(N, 'reed_heron') } },
    steps: [],
  },
  b2Hand: {
    desc: 'El kartları: Harman Eleği (3 çek, 2 at), Kuyu Kovası, Sayfa Çeviren',
    stage: {
      zones: 5,
      p0: { hand: ['winnow_sieve', 'well_pail', 'page_turner', 'ember_wolf'], deck: ['kite_fencer', 'polar_coil', 'spite_axe', 'stone_sentinel', 'reed_heron', 'void_eye', 'lucky_die', 'crag_axeman'] },
      p1: { hand: ['tide_golem', 'storm_hawk'] },
    },
    steps: [],
  },
  b2Axe: {
    desc: 'Hınç Baltası: P1 kuşanır ve saldırır; balta yok olunca destenin üstüne döner (500 hasar)',
    stage: { zones: 5, p0: { hand: ['spite_axe'], monsters: five(N, 'reed_heron') }, p1: { monsters: five(N, 'magma_titan'), spellTraps: fiveST(N, 'mirror_barrier') } },
    steps: [],
  },
};

export default B2;
