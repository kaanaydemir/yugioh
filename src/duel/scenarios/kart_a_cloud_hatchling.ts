// QA scenarios for Bulut Yavrusu (cloud_hatchling) — the baby and its permanent GROWN form, lane A
// (docs/v3/kart-a/cloud_hatchling.md §8.5). Film every moment of the card:
//   node tools/shot.mjs "?dev=duel&s=kaChAtk&look=v3" --fresh --film 20 --every 100 --start 200 --cols 5 --out …
// Stage rng 12345: the next coin lands on YAZI ('tails'), so callCoin 'tails' wins (b2.ts header).
// A grown hatchling is staged with { id: 'cloud_hatchling', permAtk: 1200, permDef: 800 } (MonSpec, §8.4).
// Keys (all kaCh*):
//   summon / flip / revive / position     kaChSummon(P2) kaChFlip kaChRevive kaChPos
//   its attack (baby)                     kaChAtk(P2) kaChAtkWeak kaChDefWin kaChDirect(P2) kaChBlocked kaChLose(P2) kaChTie
//   struck (baby)                         kaChHit kaChKill(P2) kaChKillPhys kaChGuardKill kaChBolt
//   the growth                            kaChGrow(P2) kaChGrowFast (film with &speed=3) kaChGrowDef kaChGrowTwo
//                                         kaChGrowWipe3 kaChGrowLose kaChGrowBorrowed kaChRewound kaChGrownRewound
//   the grown form                        kaChGrownIdle(P2) kaChGrownAtk(P2) kaChGrownDirect kaChGrownBlocked
//                                         kaChGrownLose kaChGrownKill kaChGrownGuardKill kaChGrownHit kaChGrownPos
//   the grown form vs the rest of the game kaChGrownControl kaChGrownResync kaChGrownChains kaChGrownEquip
//                                         kaChGrownVenomHit kaChGrownAshenKill kaChGrownHat kaChGrownBounce
//                                         kaChGrownVoid kaChGrownMirror kaChGrownRevive kaChGrownBond
//   victory                               kaChWinBaby kaChWinGrown
import type { CardId } from '../../data/cards';
import type { Action, GameState, PlayerId, ZoneRef } from '../../engine/types';
import type { MonSpec, STSpec } from '../scenario';
import type { Scenario, Step } from '../scenarios';

const N = null;
const pad = <T,>(xs: (T | null)[]): (T | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => pad(xs);
const fiveST = (...xs: (STSpec | null)[]): (STSpec | null)[] => pad(xs);

const CH = 'cloud_hatchling' as const;
/** a staged grown hatchling (the slot a won jester coin leaves behind) */
const GROWN: MonSpec = { id: CH, permAtk: 1200, permDef: 800 };
const GROWN_DEF: MonSpec = { id: CH, permAtk: 1200, permDef: 800, position: 'defense' };

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });
const respond = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) });
const mon = (player: PlayerId, index: number): ZoneRef => ({ player, zone: 'monster', index });
const spellOn = (p: PlayerId, id: CardId, target: ZoneRef, zone?: number): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid(id, p), ...(zone !== undefined ? { zone } : {}), target: { kind: 'monster', ref: target } }) as Action;
const act = (p: PlayerId, id: CardId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid(id, p) }) as Action;
const recall = (p: PlayerId, owner: PlayerId, toZone: number): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('soul_recall', p), target: { kind: 'graveyard', uid: D.uid(CH, owner), toZone } }) as Action;
const endTurn = (p: PlayerId): Action => ({ type: 'endTurn', player: p });
const battle = (p: PlayerId): Action => ({ type: 'enterBattle', player: p });
const jester = (p: PlayerId, zone: number, call: 'heads' | 'tails' = 'tails'): Step[] => [{ type: 'activateMonster', player: p, zone }, { type: 'callCoin', player: p, call }];
type Qa = { state(): GameState };
/** the attacker's pick of the hat over the real monster (magic_hat) */
const realHat = (att: PlayerId): Step => (D) => {
  const s = (D as unknown as Qa).state();
  const def: PlayerId = att === 0 ? 1 : 0;
  const zone = s.players[def].monsters.findIndex((m) => m?.hat === 'real');
  return zone < 0 ? null : ({ type: 'chooseTarget', player: att, target: mon(def, zone) } as Action);
};

const KA_CH: Record<string, Scenario> = {
  // ---------------------------------------------------------------- summon, flip, revive, position
  kaChSummon: {
    desc: 'Bulut Yavrusu: normal çağırma — Bulut Yumurtası (yumurta düşer, çatlar, yavru takla atar)',
    stage: { zones: 5, p0: { hand: [CH] }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [summon(CH, 2)],
  },
  kaChSummonP2: {
    desc: 'Bulut Yavrusu: Oyuncu 2 çağırır (P2 relight)',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, 'volt_lizard') }, p1: { hand: [CH] } },
    steps: [summon(CH, 2, 1)],
  },
  kaChFlip: {
    desc: 'Bulut Yavrusu: kapalı yavru çevrilerek çağrılır (tarifin çevirme aksanı)',
    stage: { zones: 5, p0: { monsters: five({ id: CH, faceUp: false, position: 'defense' }) }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [{ type: 'flipSummon', player: 0, zone: 0 }],
  },
  kaChRevive: {
    desc: 'Bulut Yavrusu: Ruh Çağrısı ile geri gelir (hayalet → top → kabuk plakaları açılır)',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: [CH] }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [recall(0, 0, 2)],
  },
  kaChPos: {
    desc: 'Bulut Yavrusu: saldırı → savunma, sonraki tur savunma → saldırı (toGuard / fromGuard)',
    stage: { zones: 5, p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }, endTurn(0), endTurn(1), { type: 'changePosition', player: 0, zone: 2 }],
  },

  // ---------------------------------------------------------------- its attack (baby)
  kaChAtk: {
    desc: 'Hıçkırık Halkası: yavru storm_hawk’a saldırır ve kazanır (güç 1)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, 'storm_hawk') } },
    steps: [attack(2, 2)],
  },
  kaChAtkP2: {
    desc: 'Hıçkırık Halkası: Oyuncu 2’nin yavrusu saldırır (aynalı yay)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, 'storm_hawk') }, p1: { monsters: five(N, N, CH) } },
    steps: [attack(2, 2, 1)],
  },
  kaChAtkWeak: {
    desc: 'Hıçkırık Halkası: zayıf wisp_imp’e (güç 3)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, 'wisp_imp') } },
    steps: [attack(2, 2)],
  },
  kaChDefWin: {
    desc: 'Hıçkırık Halkası: savunmadaki wisp_imp ölür',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, { id: 'wisp_imp', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  kaChDirect: {
    desc: 'Hıçkırık Halkası: doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: {} },
    steps: [attack(2, null)],
  },
  kaChDirectP2: {
    desc: 'Hıçkırık Halkası: Oyuncu 2 doğrudan saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: {}, p1: { monsters: five(N, N, CH) } },
    steps: [attack(2, null, 1)],
  },
  kaChBlocked: {
    desc: 'Hıçkırık Halkası: savunmadaki stone_sentinel (2100) halkayı geri seker, LP kaybı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  kaChLose: {
    desc: 'Hıçkırık Halkası: crag_axeman’a (1600) kaybeder — halka söner, yavru yumurtaya döner',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, 'crag_axeman') } },
    steps: [attack(2, 2)],
  },
  kaChLoseP2: {
    desc: 'Hıçkırık Halkası: Oyuncu 2’nin yavrusu kaybeder',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, 'crag_axeman') }, p1: { monsters: five(N, N, CH) } },
    steps: [attack(2, 2, 1)],
  },
  kaChTie: {
    desc: 'Hıçkırık Halkası: tide_golem (1100) ile berabere — ikisi de ölür',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, 'tide_golem') } },
    steps: [attack(2, 2)],
  },

  // ---------------------------------------------------------------- struck (baby)
  kaChHit: {
    desc: 'Yavru savunmada (900), wisp_imp (300) vurur — kalkan tutar',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: CH, position: 'defense' }) }, p1: { monsters: five(N, N, 'wisp_imp') } },
    steps: [attack(2, 2, 1)],
  },
  kaChKill: {
    desc: 'crystal_wyrm yavruyu yok eder (hitMagic → yumurtaya dönüş)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, 'crystal_wyrm') } },
    steps: [attack(2, 2, 1)],
  },
  kaChKillP2: {
    desc: 'crystal_wyrm Oyuncu 2’nin yavrusunu yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'crystal_wyrm') }, p1: { monsters: five(N, N, CH) } },
    steps: [attack(2, 2)],
  },
  kaChKillPhys: {
    desc: 'magma_titan yavruyu yok eder (hitHeavy → yumurtaya dönüş)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, N, 'magma_titan') } },
    steps: [attack(2, 2, 1)],
  },
  kaChGuardKill: {
    desc: 'Savunmadaki yavru crag_axeman’a yenilir (kalkan kırılır → yumurta)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: CH, position: 'defense' }) }, p1: { monsters: five(N, N, 'crag_axeman') } },
    steps: [attack(2, 2, 1)],
  },
  kaChBolt: {
    desc: 'Hüküm Şimşeği yavruyu yok eder (büyü ölümü)',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, CH) }, p1: { hand: ['judgment_bolt'] } },
    steps: [spellOn(1, 'judgment_bolt', mon(0, 2))],
  },

  // ---------------------------------------------------------------- the growth
  kaChGrow: {
    desc: 'Büyüme: Kadran Soytarısı’nın parası doğru tahmin edilir — gökyüzü kadranı, altı büyüme karesi, kükreme',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', CH) }, p1: { monsters: five('magma_titan') } },
    steps: jester(0, 1),
  },
  kaChGrowP2: {
    desc: 'Büyüme: Oyuncu 2’nin yavrusu büyür (P2 relight, büyümüş P2 sayfası)',
    stage: { zones: 5, active: 1, turn: 2, p0: { monsters: five('magma_titan') }, p1: { monsters: five(N, 'dial_jester', CH) } },
    steps: jester(1, 1),
  },
  kaChGrowFast: {
    desc: 'Büyüme (kaChGrow; &speed=3 ile filme alın: kadran vuruşları karelerinde kalır)',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', CH) }, p1: { monsters: five('magma_titan') } },
    steps: jester(0, 1),
  },
  kaChGrowDef: {
    desc: 'Büyüme savunmadan (fromGuard kadranın altında)',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', { id: CH, position: 'defense' }) }, p1: { monsters: five('magma_titan') } },
    steps: jester(0, 1),
  },
  kaChGrowTwo: {
    desc: 'Büyüme: iki açık yavru sırayla büyür, kapalı olan büyümez',
    stage: { zones: 5, p0: { monsters: five(CH, 'dial_jester', CH, { id: CH, faceUp: false, position: 'defense' }) }, p1: { monsters: five('magma_titan') } },
    steps: jester(0, 1),
  },
  kaChGrowWipe3: {
    desc: 'Büyüme: rakipte üç canavar — bakış döngüsü yazı-tura, toplu yok etme ve üç ölüm boyunca donmaz',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', CH) }, p1: { monsters: five('magma_titan', 'reed_heron', 'stone_sentinel') } },
    steps: jester(0, 1),
  },
  kaChGrowLose: {
    desc: 'Yanlış tahmin: yavru paraya bakar, sonra soytarının bedeliyle ölür',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', CH) }, p1: { monsters: five('magma_titan') } },
    steps: jester(0, 1, 'heads'),
  },
  kaChGrowBorrowed: {
    desc: 'Ödünç büyüme: P1 Kukla İpi ile P2’nin yavrusunu alır, parayı kazanır; tur sonunda büyümüş yavru P2’ye döner',
    stage: { zones: 5, p0: { hand: ['puppet_string'], monsters: five(N, 'dial_jester') }, p1: { monsters: five(N, N, CH, 'magma_titan') } },
    steps: [spellOn(0, 'puppet_string', mon(1, 2)), ...jester(0, 1), endTurn(0)],
  },
  kaChRewound: {
    desc: 'P2’nin soytarısı kazanır: P1’in BEBEK yavrusu geri sarılır (çağırma tersten — lane D)',
    stage: { zones: 5, active: 1, turn: 2, p0: { monsters: five(N, N, CH) }, p1: { monsters: five(N, 'dial_jester') } },
    steps: jester(1, 1),
  },
  kaChGrownRewound: {
    desc: 'P2’nin soytarısı kazanır: P1’in BÜYÜMÜŞ yavrusu geri sarılır (special tersten, sonra çağırma tersten)',
    stage: { zones: 5, active: 1, turn: 2, p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, 'dial_jester') } },
    steps: jester(1, 1),
  },

  // ---------------------------------------------------------------- the grown form
  kaChGrownIdle: {
    desc: 'Büyümüş Bulut Yavrusu: kalıcı idle + bel halkası (P1)',
    stage: { zones: 5, p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [],
  },
  kaChGrownIdleP2: {
    desc: 'Büyümüş Bulut Yavrusu: Oyuncu 2 tarafında (P2 relight)',
    stage: { zones: 5, p0: { monsters: five(N, 'volt_lizard') }, p1: { monsters: five(N, N, GROWN) } },
    steps: [],
  },
  kaChGrownAtk: {
    desc: 'Büyümüş Hıçkırık Halkası: magma_titan’a (2100) — büyük halka',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'magma_titan') } },
    steps: [attack(2, 2)],
  },
  kaChGrownAtkP2: {
    desc: 'Büyümüş Hıçkırık Halkası: Oyuncu 2 saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, 'magma_titan') }, p1: { monsters: five(N, N, GROWN) } },
    steps: [attack(2, 2, 1)],
  },
  kaChGrownDirect: {
    desc: 'Büyümüş yavru doğrudan saldırır',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: {} },
    steps: [attack(2, null)],
  },
  kaChGrownBlocked: {
    desc: 'Büyümüş yavru savunmadaki crystal_wyrm’e (2300 = 2300): halka geri seker',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, { id: 'crystal_wyrm', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  kaChGrownLose: {
    desc: 'Büyümüş yavru crystal_wyrm’e (2800) kaybeder: gençleşerek yumurtaya döner',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'crystal_wyrm') } },
    steps: [attack(2, 2)],
  },
  kaChGrownKill: {
    desc: 'crystal_wyrm büyümüş yavruyu yok eder (hitMagic → gençleşme → küçük yumurta)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'crystal_wyrm') } },
    steps: [attack(2, 2, 1)],
  },
  kaChGrownGuardKill: {
    desc: 'Savunmadaki büyümüş yavru (1700) magma_titan’a yenilir',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, GROWN_DEF) }, p1: { monsters: five(N, N, 'magma_titan') } },
    steps: [attack(2, 2, 1)],
  },
  kaChGrownHit: {
    desc: 'Savunmadaki büyümüş yavru crag_axeman’ı (1600) durdurur',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, GROWN_DEF) }, p1: { monsters: five(N, N, 'crag_axeman') } },
    steps: [attack(2, 2, 1)],
  },
  kaChGrownPos: {
    desc: 'Büyümüş yavru: saldırı → savunma (sfenks) ve geri',
    stage: { zones: 5, p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }, endTurn(0), endTurn(1), { type: 'changePosition', player: 0, zone: 2 }],
  },

  // ---------------------------------------------------------------- the grown form vs the rest of the game
  kaChGrownControl: {
    desc: 'Kontrol: P1 Kukla İpi ile P2’nin büyümüş yavrusunu alır, tur sonunda geri döner (P1 ↔ P2 büyümüş sayfaları)',
    stage: { zones: 5, p0: { hand: ['puppet_string'] }, p1: { monsters: five(N, N, GROWN) } },
    steps: [spellOn(0, 'puppet_string', mon(1, 2)), { ui: 'wait', ms: 1200 }, endTurn(0)],
  },
  kaChGrownResync: {
    desc: 'Kalıcılık: büyüme, sonra iki tur sonu — yavru büyümüş kalır',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', CH) }, p1: { monsters: five('magma_titan') } },
    steps: [...jester(0, 1), endTurn(0), endTurn(1)],
  },
  kaChGrownChains: {
    desc: 'Büyümüş yavru saldırır, P2 Işık Zincirleri ile bağlar (zincirler büyümüş bedende)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'volt_lizard'), spellTraps: fiveST('chains_of_light') } },
    steps: [attack(2, 2), respond('chains_of_light', 1)],
  },
  kaChGrownEquip: {
    desc: 'Büyümüş yavruya Ejder Kılıcı kuşatılır (aura büyümüş bedende)',
    stage: { zones: 5, p0: { hand: ['dragon_blade'], monsters: five(N, N, GROWN) }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [spellOn(0, 'dragon_blade', mon(0, 2), 2)],
  },
  kaChGrownVenomHit: {
    desc: 'venom_drake (2000) saldırıdaki büyümüş yavruya (2300) saldırır: hedef yaşar, saldıran ölür',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'venom_drake') } },
    steps: [attack(2, 2, 1)],
  },
  kaChGrownAshenKill: {
    desc: 'ashen_drake (2400) büyümüş yavruyu (2300) yok eder: gençleşerek yumurtaya döner',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'ashen_drake') } },
    steps: [attack(2, 2, 1)],
  },
  kaChGrownHat: {
    desc: 'Sihirli Şapka: P2’nin büyümüş yavrusu şapkaların altına saklanır; açıldığında ilk karesinden büyümüş',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five('magma_titan') }, p1: { monsters: five(GROWN), spellTraps: fiveST('magic_hat') } },
    steps: [attack(0, 0), respond('magic_hat', 1), realHat(0)],
  },
  kaChGrownBounce: {
    desc: 'Eve Dönüş: büyümüş yavru saldırır, ele döner; sonraki tur yeniden çağrılınca bebektir',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'volt_lizard'), spellTraps: fiveST('homecoming') } },
    steps: [attack(2, 2), respond('homecoming', 1), endTurn(0), endTurn(1), summon(CH, 2)],
  },
  kaChGrownVoid: {
    desc: 'Boşluk Gözü: P2 tüm canavarları yok eder (büyümüş yavru dahil)',
    stage: { zones: 5, active: 1, turn: 2, p0: { monsters: five(N, N, GROWN) }, p1: { hand: ['void_eye'], monsters: five(N, 'volt_lizard') } },
    steps: [act(1, 'void_eye')],
  },
  kaChGrownMirror: {
    desc: 'Ayna Bariyeri: büyümüş yavrunun saldırısı yansıtılır (büyümüş nefes korunur)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'volt_lizard'), spellTraps: fiveST('mirror_barrier') } },
    steps: [attack(2, 2), respond('mirror_barrier', 1)],
  },
  kaChGrownRevive: {
    desc: 'Büyümüş yavru ölür, Ruh Çağrısı onu BEBEK olarak geri getirir (büyüme mezarlıkta kalmaz)',
    stage: { zones: 5, phase: 'battle', active: 1, turn: 2, p0: { hand: ['soul_recall'], monsters: five(N, N, GROWN) }, p1: { monsters: five(N, N, 'crystal_wyrm') } },
    steps: [attack(2, 2, 1), endTurn(1), recall(0, 0, 2)],
  },
  kaChGrownBond: {
    desc: 'Ejder Kılıcı bağı: büyümüş yavru victory pozunu oynar',
    stage: { zones: 5, p0: { hand: ['dragon_blade'], monsters: five(N, N, GROWN) }, p1: { monsters: five(N, 'volt_lizard') } },
    steps: [spellOn(0, 'dragon_blade', mon(0, 2), 2)],
  },

  // ---------------------------------------------------------------- victory
  kaChWinBaby: {
    desc: 'Zafer: yavru son darbeyi vurur (victory)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, CH) }, p1: { lp: 1000 } },
    steps: [attack(2, null)],
  },
  kaChWinGrown: {
    desc: 'Zafer: büyümüş yavru son darbeyi vurur (victory)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, GROWN) }, p1: { lp: 1000 } },
    steps: [attack(2, null)],
  },
};

export default KA_CH;
void battle;
