# A3 — Ölçeklenebilirlik katmanı: seçilen mimari

Bu belge A3'ün ölçeklenebilirlik katmanının **kararıdır**: iki bağımsız öneri ("en çok yeniden
kullanım" ve "önce kalite") puanlandı, iddiaları koda karşı denetlendi, kazanan omurga yapıldı ve
öbürünün iyi fikirleri eklendi. Ardından belge bir **karşıt inceleme turundan** geçti; bulgular ve
yanıtlar §18'dedir (11 bulgunun hepsi kabul edildi; beşinde çözümün bir parçası kanıtla farklı
yapıldı, gerekçesi orada). Kurallar `docs/v3/REHBER.md`'dedir; bu mimari onlara hizmet eder ve
kural koymaz (benzerlik eşikleri ve vuruş itmesi hariç: onlar REHBER §8.2.1, HA-11, KK-4'e de yazıldı).
Plan: `docs/ANIMASYON_PLANI.md` §3–§6, envanter: `docs/v3/A0_ENVANTER.md` §1.3, §4. Kod kimlikleri ve
yollar İngilizcedir.

---

## 0. Karar özeti (sade dille)

1. Canavarların bütün hareketlerini birkaç ayardan **otomatik üreten** bir makine kurmuyoruz: canavarları birbirine benzetir (eski üç ağır canavar elle yazıldığı hâlde üçü de "kolu kaldır, tepeden vur" hareketine yakınsadı).
2. Her canavarda aynı olan **zanaat bir kez yazılır**: ışık ve gölge, kontur, malzemeler (taş, kristal, su…), darbe ve ölüm efektleri, malzeme sesleri, zamanlama kuralları. A2'de elle yakalanan hataları kod artık kendisi önler ya da denetler.
3. **Gövde tipi** (iki ayaklı, dört ayaklı…) iskeleti ve yere basan ayakları verir; saldırının, darbenin, ölümün ve bekleyişin **nasıl göründüğünü canavarın kendisi** belirler. Bu pozlar elle ayarlanır: kalite orada.
4. Kartın sunumu (saldırı türü, efekt, ses, çağırma / ölüm tarzı) **bir veri dosyasıdır**; varsayılan sinematik ondan kurulur. Normal kart imzasını korumak için ölçülü bir **süs payı** (≤ 250 satır) alır. Ejder ve Büyücü kendi koduyla kalır; her kart her an tamamen özel koda geçebilir.
5. **Benzerlik ölçülür, doğru şeyle:** el, baş, kalça gibi eklemlerin yolu gövde biçiminden bağımsız karşılaştırılır; bekleme ve savunma döngüleri de ölçülür. Ölçü "aynı hareketi başka gövdeye giydirme" denemesini yakalamazsa ölçü değiştirilir. Sınırdaki çiftlere **kör göz testi** yapılır: canavarları çizmeyen ayrı bir inceleyici, adsız, renksiz ve aynı boya getirilmiş görüntüleri ayırır.
6. **Eski oyun ve dilim korunur:** her adımda eski görünümün ve dilimin filmleri piksel piksel karşılaştırılır.
7. İlk gövde tipi **iki ayaklı**; pilot **Taş Muhafız**. Eski kaya fırlatmasının ağırlığı ve ayrıntıları (yerden kaya koparma, krater, dönen kaya, kayan gölge, seken parçalar, toz) bir denetim listesi ve yan yana filmle korunur. Yanında **taslak Magma Titanı** ile oyunun en benzer çifti A3'te ölçülür.
8. **Bellek:** yeni çizimler eskilerden çok büyük (12 canavarın hepsi yeni çizimle, iki oyuncu için ~90 MB; plandaki "+19 MB" tahmini eski kare boyları içindi). A4'ün ilk çiftinde dokular kırpılır ve toplam bellek ölçülür; bu kapı geçilmeden sonraki çifte geçilmez.
9. Kazanç: normal bir canavar ~3.500–3.900 yerine ~1.200–1.400 satır; asıl kazanç düzeltme turlarında.
10. Yan düzeltme: darbe anında kit bütün sprite'ı 1 px itiyor, ekranda temas karesi bu yüzden yerel değil (%74–75); itme temastan sonraki ilk kareye alınır (ölümcül darbe dahil), yeni canavarlarda bir kısmı pozun içine çizilir.
11. A3 bitince kullanıcı pilotun sesli videosunu, eski / yeni kaya fırlatmasını yan yana ve Muhafız–Titan karşılaştırmasını görür; **onay olmadan A4 başlamaz**.

---

## 1. Hakem değerlendirmesi

### 1.1 Puan tablosu (1–5)

| Ölçüt | Yeniden kullanım (`design-reuse.md`) | Önce kalite (`design-quality.md`) | Not |
|---|---|---|---|
| Kalite korunuyor mu (her karede A2 karakteri, kaçış kapıları) | 3 | **5** | Yeniden kullanım önerisi koreografiyi gövde tipine koyar (`StyleRef: 'punch' / 'doubleSlam'…`, beklemeler `MOTION_PROFILES`'tan); riskini kendisi de yazar (§G.1 "ortalama görünüm"). Kalite önerisi koreografiyi canavarda bırakır; v1 ağır üçlünün yakınsaması (§1.2) bunu destekler. |
| A4 + yüzlerce kartta kurtarılan yeniden yazım | **5** | 4 | Yeniden kullanım: normal 600–1.100, sıradan 150–250 satır. Kalite: normal 1.100–1.300, sıradan 250–450. Sıradan katmandaki farkın çoğu "ortak koreografi" kazancıdır, yani benzerlik riskinin kendisi. |
| Mevcut koda uyum (kitler, kayıtlar, sözleşme yalnız ekleme, v1 ve dilim dokunulmaz) | 4,5 | 4,5 | İkisi de `MonsterArt` çıktısını korur, dilimi kopyalar (taşımaz), kayıtları glob ile yapar. Yeniden kullanım `sheet-hash --look v3` eksikliğini doğru yakaladı; kalite `custom` bayraklarıyla as ezmeyi açık yaptı. Yeniden kullanımın `deathPreset` sırası (`tarif ?? tablo`) v1'i etkileyebilirdi (§6.4). |
| A3'te yapılabilirlik / sadelik | 3 | **4** | ~8.800 satıra karşı ~5.600 satır; yeniden kullanım A3'te 11 oyunculuk kalıbı ve 12 tarif ister. |
| Ölçeklenme (açılış, bellek, kimlik) | **5** | 4 | Yeniden kullanım: deste kaydı, işçi havuzu, kırpılmış atlas, `defHash`'li kalıcı önbellek, canavar başına bütçe kapısı. |
| Benzerlik riskinin ele alınması | 4 | **5** | Kalite önerisinin `SI`'si aynı karakteri (0,58–0,61) farklı çiftlerden (en çok 0,46) ayırıyor; yeniden kullanımın ısı haritası (H) ayırmıyor (aynı karakter 0,76, farklı çift 0,78). Yeniden kullanımın ritim imzası (T) v1'in tek zaman şablonunu yakalıyor: alındı. (İnceleme turu `SI`'nin gövde biçimine bağlı olduğunu gösterdi; §9 buna göre değişti.) |
| **Toplam** | 24,5 | **26,5** | Omurga: **önce kalite**. Aşılar: §1.3. |

### 1.2 Koda karşı doğrulanan iddialar

| İddia | Sonuç | Kanıt |
|---|---|---|
| Dilim rig'leri kod paylaşmıyor; zanaat modül tekillerine bağlı | doğru | `crystal_wyrm-gbuf.ts`: modül sabiti `W = 116, H = 104`, tekil `LIGHT`, `MATS: Mat[] = []`; büyücü ayrı `ik`, `comp`, `stampMap`, `castShadow`, `Pose/NEUTRAL/pose()`. |
| Paylaşılabilir pay | iki ölçüm uyumlu | Dilim sanatı 5.776 satır (ejder 3.086, büyücü 2.690). Olduğu gibi %6, mekanik genelleştirmeyle +%18 (yeniden kullanım); malzeme geçişleri de sayılınca ejder %39, büyücü %24 (kalite). Kalan **%61–76 canavarın el işidir**. |
| Eski rig'ler kopyayla aynı kalıpta | doğru | `function ik(` 10 dosyada, `function layer(` 11 dosyada; v1 canavar sanatı toplam 12.633 satır. |
| v1 ağır üçlü aynı saldırıya yakınsamış | doğru | `quality/sheets-v1/*-attack.png` incelendi (bu turda yeniden bakıldı): üçü de f2–f4'te kol(lar)ı başın üstüne kaldırıyor; Golem ve Muhafız iki kolla tepeden indiriyor, Titan tepeden savurup ileri yumruk atıyor. Üçü de 10 kare / 833 ms. |
| **Benzerlik kapısı v1 golem × muhafız yakınsamasını yakalıyor mu** | **hayır** (inceleme) | `judge/calib.txt`: `KEY` 0,658 (UYARI), `SI` 0,307 (GEÇER), `RHYTHM` farklı (charge→release 333 / 417 ms) → eski kurallarla yalnız UYARI. Aynı çift `HEAT`'te 66 çiftin birincisi (0,706). Gövde biçiminden bağımsız hareket yolu vekiliyle (`revise/mot.txt`, §9.2) attack 0,59: 66 çiftin ikincisi. `SI` silüet IoU'suyla çarptığı için farklı gövdeler aynı hareketi maskeliyor. → §9 yeniden tasarlandı. |
| **Bekleme ve savunma döngüleri ölçülüyor mu** | **hayır** (inceleme) | Eski `SI` / `RHYTHM` yalnız tek seferlikleri, `KEY` yalnız idle f0'ı alıyordu. v1 guard döngüleri hareket yolunda 66 çiftte ortanca 0,44, en çok 0,97 (`mot.txt`): A0'daki "1 px'lik ölü döngüler" birbirinin aynısı. → §9.1. |
| Kart başına tablolar kapalı `MonsterId` üzerinde | doğru | `Record<MonsterId,…>`: `DEATH_PRESETS`, `STRIKE_KIND`, `MONSTER_GLOW`, `STRIKE_LIGHT`; `Partial<…>`: `RHYTHM`, `ROAR_PEAK`, `FLIP_RAMP`, `MOUTHS` (iki kopya), `CHARACTER_SOUNDS` (`CardId`). `materialOf()` yalnız iki dilim canavarını tanıyor. |
| **Köprülenen tablolar nerede okunuyor** | tanımlandıkları dosyada **değil** (inceleme) | `STRIKE_LIGHT[…]`: `battle/battle.ts:112,359`, `battle/declare.ts:553`; `MONSTER_GLOW[…]`: `view/light/LightLayer.ts:847,1006`, `view/light/glow.ts:64`; `ROAR_PEAK[…]`: `summon-b/_kit.ts:129`; `FLIP_RAMP[…]`: `summon-b/flip.ts:154,264`. Köprü yalnız tablonun dosyasına yazılsaydı ya hiçbir şey değişmez ya da sahiplik bozulurdu. → §6.4 erişimciler, Y5a. |
| **Kart adına bağlı başka dallar** | envantere eklendi (inceleme) | `traps/chains_of_light.ts:197` `RANGED` kümesi (7 kart, `RANGED.has(u.cardId)` 544); `summon-b/flip.ts` 7 `case` dalı (46–76) + `id === 'thorn_lurker'` (158, 268); `scenes/title/showcase.ts` (412, 458, 460; başlık ekranı vitrini, v1 sanatı, A6/A7'ye kadar dokunulmaz). `MOUTHS` (`_defaults/strikes.ts`) v1 varsayılan vuruşuna aittir, v3 `points()` kullanır: köprülenmez. |
| Kayıt öncelikleri ve `ctx.base()` | doğru | `_core/registry.ts`: yüksek öncelik önce, eşitte kart kancası önce, sonra son kayıt; `ctx.base()` zincirdeki bir sonrakini çalıştırır. Dilim kancaları öncelik 0'da, `LOOK_V3 ? v3 : v1` dalıyla. Yükleyici `cinematics/**` altındaki her dosyayı yükler (`_core`, `_defaults` hariç). |
| `monsters-v3` glob'u yardımcı dosyalara zararsız | doğru | `../monsters-v3/*.ts` (yalnız üst düzey, `_*.ts` hariç) ve yalnız `default.id` taşıyanı kaydeder. Alt klasörler taranmaz; `src/art/drafts/` hiç taranmaz. |
| `sheet-hash` v3'ü kapsıyor | **yanlış** | `tools/sheet-hash.ts` `monsterArt()` ile v1 görünümünü parmak izler; `--look v3` yok. Dilimin "piksel piksel aynı" kapısı için eklenmesi gerekir (§14 Y0). |
| **A2'nin v1 film piksel kapısı A3'te var mı** | **hayır** (inceleme) | A2 kabulü 8 filmi piksel karşılaştırdı (`shots/v3/a2/acceptance/v1films/diff.txt`: hepsi IDENTICAL). A3 §13 yalnız `measure` (olay / ses / kare zamanları) ve `sheet-hash` (sanat kareleri) içeriyordu; sprite konumu ve efekt pikseli denetlenmiyordu. Oysa `MonsterUnit.guardHit` (844–906) v1 ve v3'te ortaktır, Y5 `battle/_kit.ts` ve `view/light/profiles.ts`'e dokunur. → §13. |
| Kitin 1 px itmesi temas karesini bozuyor | doğru | `react.ts knock()`: `s.setPosition(first)` temas karesinde, `knockPx = guardPushPx + 1` (ağır sınıfta bile ≥ 1). Büyücü hit f0: sayfada %41,2–43,6, 1 px itmeyle %74,3–75,4 (`shots/v3/a2f/magus/hit-f0.txt`); oyunda dinlenen hedeflerde %40–66 (`shots/v3/a2f/verify/ingame-contact-change.txt`). |
| **"İtme tepki f1'inde başlar" ölümcül darbede çalışır mı** | **hayır** (inceleme) | `react.ts playRecoil` (309–336): ölümcülde `plan.hold` 0 ise `toDeath()` hemen çağrılır (`LETHAL_HANDOVER_MS` 140), tepkinin f1'i hiç ekrana gelmez. Arkadan darbede tepki pozu hiç oynamaz (`react.ts:420` `side !== 'back'`). `knockPx` güç (1/2/3), taraf ve ağırlığa bağlıdır (75–79); yalnız poza çizilen itme bu farkları kaybederdi. → §10. |
| `ace` kart bayrağı yalnız Ejder ve Büyücü'de | **yanlış** | `cards.ts`: `ace: true` olan dört kart var: Ejder, Büyücü, **Magma Titanı, Mercan Yılanı** (dördünün v1 giriş portresi var). Katman modeli bunu ayırır (§7). |
| **Bellek: plan §3'ün "+~19 MB"ı** | **geçersiz** (inceleme) | Dilim sayfası taraf başına 6,56–6,76 MB (§11.1). `DEFAULT_DECK` = 20 kartın hepsi, iki oyuncu için (`cards.ts:350`); deste kaydı bugün bir şey kazandırmaz. 12 v3 canavarı (v3 kare boyu, ~125 kare) ≈ 46 MB / taraf, P1 + P2 ≈ 92 MB + temel kare önbelleği; arka plan boyaması ≈ 12–15 sn. `?test` altında hepsi açılışta eşzamanlı boyanır (`textures.ts:628–640`); v3 `measure` bugün senaryo başına 14–15 sn. Plan §3'ün tahmini v1 kare boyları içindi. → §11. |
| **`defHash` kod değişikliğini görür mü** | **hayır** (inceleme) | "Tanım JSON özeti" `parts[].paint`, `Beat.key` fonksiyonları, `frames`, `drawAnim`, `post` gibi fonksiyonları düşürür: bir boyacı değişse de özet aynı kalır, A7 önbelleği eski sanatı sunardı. → §3.6. |
| Benzerlik kalibrasyonu | yeniden üretildi | Hakem betiği (`judge/calib.ts`) kalite önerisinin sayılarını aynen verdi (titan×muhafız `sil` 0,721, `SI` 0,459) ve `KEY`'i ekledi; inceleme turunda hareket yolu vekili `revise/mot.ts` eklendi (§9.2). |

### 1.3 Ne nereden alındı

- **Önce kalite (omurga):** üç kat (çekirdek → gövde tipi → canavar dosyası), gövde tipinin koreografi
  üretmemesi, elle yazılmış poz tabloları ve beklemeler, `Fx` kanalları, `retouch` L/R haritaları, L0–L5
  kaçış kapıları ve "%50'den fazlası L3+ ise bilerek özel" kuralı, "ikinci kullanımda çıkar" (tek üyeli
  tipler tek dosya), `biped` + pilot Taş Muhafız, `custom` bayraklı tarifler, `SI` ölçüsü, ayrışma kartı,
  `src/presentation/` konumu (motor sınırının dışında), A4 sırası.
- **Yeniden kullanımdan aşılar:** adlı vuruşlardan işaret üreten ve A2 kurallarını uygulayan **anim
  derleyicisi** (koreografi değil dilbilgisi: idle f0'da başla/bitir, bölge filtreli temas karesi,
  gecikmeli takip, taslak guard geçişleri), `RingSpec` ile sesin veri olması, malzeme köprüleri, adla
  paylaşılan **sahne parçası kütüphanesi** (A0 §1.3 karakterli girişleri korur), plan **sürüm
  sabitleme** ve altın özetler, ritim imzası (`RHYTHM`), ısı haritası bindirmesi,
  `sheet-hash --look v3`, deste kaydı + `defHash` + canavar bütçe kapısı, "plan dosyalarının tek sahibi"
  kuralı, efektlerin motor **eylemine** bağlanması.
- **Hakemin eklediği:** `KEY` silüet ölçüsü (REHBER §8.2'nin üç anahtar pozu), eşiklerin yeniden
  kalibrasyonu, köprü kuralı (tarif yalnız v3 görünümünde ve v3 sanatı olan canavar için okunur),
  `CardDef.ace` ↔ katman ayrımı, vuruş kiti düzeltmesinin tasarımı (§10), taslak Titan ile A3 içinde
  en kötü çiftin ölçülmesi, kapı araçlarının depoya alınması (`monster-gates`, `contact-probe`).
- **İnceleme turundan (§18):** gövde biçiminden bağımsız hareket yolu ölçüsü `MOT` ve negatif kontroller,
  idle / guard döngülerinin kapıya girmesi, kör ve boy normalize göz testi, pilotun süs bütçesi ve
  kaya fırlatma denetim listesi, ortak katmanların pilot hattına devri, tablo erişimcileri (Y5a), v1 ve
  dilim film piksel kapıları, A4.1'de toplam bellek kapısı, açık sürümleme düzeni, ölümcül / arkadan /
  yukarıdan darbede itme, yüzlerce kartta kapı kapsamı, A4 öncesi kullanıcı onayı (Y11).

---

## 2. Modül düzeni

```
src/art/rigkit/                    ÇEKİRDEK — görünüşsüz, saf, Phaser'sız, belirlenimci; dilimden KOPYALANIR
  light.ts       Light {from, v, side, lx()} — DrawOpts.lightFrom'dan; modül tekili yok
  raster.ts      Raster(w,h,light,mats): G-buffer + değer düzlemi nicemleme + ell/tube/facet/shard/poly
  composite.ts   composite(seam, crease, Fold), PartComp (parça kimliği + ayırma çizgisi), castShadow, cleanCrumbs
  edges.ts       edgePaint (seçici vurgu), rimLight, glint/twinkle (anim başına ≤ 1)
  maps.ts        PartMap, MapPair {left,right}, ToneMap (rol harfi → ton, ışığa göre), stamp()
  cloth.ts       kenardan ölçülen kumaş düzlemleri (büyücü tekniği), spans/widenTeeth, sleevePoly
  geom.ts        V işlemleri, ik2, bezier, samplePath/pathU, dorsal, chain() (gecikmeli ikincil zincir)
  pose.ts        definePose → pose/lerp/over/mix(grup gecikmesi)/fromIdle/recoil(struck)/faz sarma/smearFrom
  anim.ts        compileAnims(): vuruşlar → kareler + beklemeler + işaretler; toMonsterArt()
  validate.ts    validateArt(art): HER MonsterArt için REHBER HA-1…HA-5, HA-14 denetimi (dilim dahil)
  passes/        malzeme ölüm/diriltme geçişleri (parça uzayında): cracks, drain, split, gather (kristal),
                 dissolve, motes (gölge), crumble, reassemble (taş; pilotla yeni)…
src/art/materials/
  types.ts  index.ts (glob: defs/*.ts → materialOf(id))  defs/<id>.ts  (malzeme başına 30–50 satır)
src/art/bodyplans/
  types.ts       BodyPlan, PartPainter, PartCtx, PlanMonster, DistinctionCard, planArt()
  biped/index.ts         export { v1 } — sürüm dizinlerini dışa verir (§3.6)
  biped/v1/      build.ts pose.ts skeleton.ts slots.ts helpers.ts index.ts   (A3)
  quadruped/v1/  (A4.2)
src/art/monsters-v3/<id>.ts (+ <id>-parts.ts, <id>-anims.ts, <id>-maps.ts)   kayıt bugünkü glob
src/art/drafts/<id>*.ts            kayıt dışı taslaklar (glob görmez; araçlara --art ile verilir)
src/presentation/                  YALNIZ SUNUM VERİSİ; Phaser'sız; motor içe aktarmaz (test)
  types.ts  registry.ts (glob: cards/*.ts → presentationOf(id))  cards/<id>.ts
src/cinematics/recipe/             tariften varsayılan sinematik (yükleyici glob'u bunu da yükler)
  strike.ts summon.ts death.ts flip.ts install.ts        (A3; effect.ts A4.1'de, ilk kullanıcısı Titan)
  setpieces/<ad>.ts                adla paylaşılan sahne parçaları (registerSetPiece)
  projectiles/<vfx>.ts             fırlatanın kendi mermisi, `attack.vfx` adıyla (registerProjectile; süs bütçesine sayılır)
  hooks/<id>.ts                    kartın süs kancaları (yan etkisiz modül; süs bütçesi §6.2)
src/audio/v3/
  materials.ts   MaterialDef.sound → hit<Malzeme><Light|Heavy|Magic> tarifleri (slice.ts'e dokunmaz)
  voices.ts      VoicePreset → rol tarifleri (roar, arrive, land, charge, release, impact, dissolve…)
tools/
  sheet-hash.ts (+ --look v3)  sameness.ts  monster-gates.ts  contact-probe.mjs  filmdiff.mjs  lib/*.ts
src/dev/previews/bodyplan.ts       ?dev=bodyplan&plan=biped (plan üyeleri yan yana, P1/P2, iskelet, eklem izleri)
src/dev/previews/recipe.ts         ?dev=recipe&id=… (tariften kurulan olaylar, fikstür canavarla)
src/dev/fixtures/rigkit-creature{,-art}.ts   çekirdeğin fikstür yaratığı (geliştirme kaynağı: önizleme ve rigkit testleri buradan alır)
```

Dilim dosyaları (`crystal_wyrm*`, `abyss_magus*`), v1 canavarları ve kitlerin bugünkü davranışı
değişmez. Mevcut dosyalara dokunuşlar **yalnız ekleme** ya da **davranışı koruyan yeniden düzenleme**
(Y5a erişimcileri) niteliğindedir ve §13'teki kapılarla (zaman, sanat karesi ve film pikseli) kanıtlanır.

---

## 3. Arayüzler

### 3.1 Çekirdek (`src/art/rigkit/`)

```ts
// light.ts
export interface Light {
  readonly from: 'left' | 'right';
  readonly v: readonly [number, number, number]; // (−0.5, −0.74, 0.46) mirrored for 'right' (IŞ-1)
  readonly side: -1 | 1;
  lx(dx: number): number;                        // light-relative x offset (wyrm lx)
}
export function lightOf(o?: DrawOpts): Light;

// raster.ts — the wyrm's G-buffer, instance-scoped (no module W/H, LIGHT, MATS)
export class Raster {
  constructor(w: number, h: number, light: Light, mats: MaterialTable, craft?: CraftOpts);
  ell(c: V, rx: number, ry: number, ang: number, mat: MatRef, o?: PrimOpt): void;
  tube(path: readonly V[], w0: number, w1: number, mat: MatRef, o?: TubeOpt): void;
  facet(pts: readonly V[], mat: MatRef, n: N3, z?: number, bias?: Bias): void;
  shard(base: V, dir: V, length: number, hw: number, mat: MatRef, z?: number, glow?: number): void;
  render(into: PixelCanvas): void;               // quantize by the material's thresholds (IŞ-3)
}
/** Behaviour switches of the core. Every field defaults to the A2 behaviour; a new behaviour is
 *  only ever added here as an opt-in (§3.6), so existing arts never change. */
export interface CraftOpts { readonly despecklePasses?: 2; readonly v?: 1 }
export function despeckle(c: PixelCanvas, passes?: number, box?: Box): void;      // IŞ-4
export function materialTable(ids: readonly MaterialId[], light: Light): MaterialTable;

// composite.ts
export type SeamFn = (x: number, y: number, behind: number) => number;
export interface Fold { top: number; side: number; bottom: number }                // IŞ-5 bands
export function composite(dst: PixelCanvas, layer: PixelCanvas, seam: SeamFn, fold?: Fold): void;
export function seamOf(m: MaterialDef): SeamFn;     // one step down the ramp (SEAM)
export function creaseOf(m: MaterialDef): SeamFn;   // 1–2 steps down (CREASE)
export class PartComp { /* the magus' part-id buffer + 1 px separation line */ }
export function castShadow(c: PixelCanvas, caster: Uint8Array, onto: Uint8Array, dir: V, mat: MaterialDef): void; // IŞ-6
export function cleanCrumbs(c: PixelCanvas, keep?: Uint8Array): void;

// maps.ts — hand-painted part maps (helmets, faces, emblems)
export interface PartMap { rows: readonly string[]; ox: number; oy: number }
export interface MapPair { left: PartMap; right: PartMap }          // IŞ-2: lit for P1 and for P2
export interface ToneMap extends PartMap { roles: Readonly<Record<string, 'L' | 'M' | 'S' | 'R' | 'E' | 'K'>> }
export function stamp(c: PixelCanvas, m: PartMap | MapPair | ToneMap, at: V, light: Light, mat?: MaterialDef): number[];
```

Çekirdeğin sözleşmesi: saf ve belirlenimci; kare başına ≤ 8 ms (Node; dilim bugün 6,2–6,8 ms);
A2 zanaat kuralları **varsayılandır** (tek anahtar ışık, düz düzlem bantları, iki geçişli kırıntı
temizliği, kıvrım bantları 1/1–2/2–3 px, seçici kenar boyası, gölge tarafında tek rim çizgisi, anim
başına ≤ 1 parıltı, P2'de ışık yeniden hesaplanır). Kopya sadakati Y2'de bir kez dilimle bayt eşitliği
olarak kanıtlanır; sonra kalıcı test altın özettir (§3.6, §12).

### 3.2 Anim tablosu: elle anahtar, kurallı derleyici

Koreografi canavarındır; derleyici yalnız **dilbilgisini** uygular. Beklemeler elle verilir (normal
katmanda zorunlu): REHBER §10.1 `MOTION_PROFILES` tablosunun dilimin gerçek ritmiyle uyuşmadığını
gösteriyor, bu yüzden varsayılan bekleme tablodan türetilmez.

```ts
// pose.ts
export interface PoseKit<P> {
  neutral: P;
  pose(d: Partial<P>): P;
  lerp(a: P, b: P, t: number): P;                       // numbers, tuples, nested; discrete fields from b
  over(base: P, d: Partial<P>): P;
  mix(a: P, b: P, t: number, lag?: Partial<Record<string, number>>): P;  // per-group lag (wings, cloth…)
  recoil(struck: P, keys: readonly P[], mid?: number): P[];              // HA-22: f1 between struck and swing
}
export function definePose<P extends object>(neutral: P, groups: Record<string, readonly (keyof P)[]>,
  regions: Partial<Record<RegionId, readonly (keyof P)[]>>): PoseKit<P>;

// anim.ts
export type BeatName = 'charge' | 'coil' | 'swing' | 'release' | 'contact' | 'follow' | 'recover'
  | 'settle' | 'land' | 'dissolve' | 'struck' | 'peak';
export interface Beat<P> {
  name?: BeatName;            // marks come from names: charge→charge · release→release+impact ·
                              // contact→contact · recover→recover · land→land · dissolve→dissolve ·
                              // struck→impact+contact (frame 0 of a reaction)
  key: Partial<P> | ((base: P) => P);  // hand-keyed, over the anim's base
  ms: number;                 // hand-set hold (validated against HA-2…HA-5)
  smear?: boolean;            // HA-12: release frame only, 2 px, outlined with the body
}
export interface AnimDef<P> {
  base: 'idle0' | 'guard0' | P;
  beats: readonly Beat<P>[];
  end: 'idle0' | 'guard0' | 'hold';        // the compiler appends the exact end pose → out = 0 (HA-14)
  endMs?: number;
  follow?: readonly { field: keyof P; of: keyof P; lag: 1 | 2 | 3 }[];  // overlap (HA-6)
  struck?: { regions: readonly RegionId[] };  // beat 0 keeps ONLY these regions' fields (HA-21)
  frames?: Record<number, (p: P) => P>;       // escape hatch L2: patch one frame
}
export interface LoopDef<P> { n: number; at(f: number): Partial<P>; holds: readonly number[] }
export type AnimDefs<P> = { idle: LoopDef<P>; guard: LoopDef<P>; attack: AnimDef<P>; roar: AnimDef<P>; hit: AnimDef<P> }
  & Partial<Record<MonsterAnimExtra, AnimDef<P>>>;
export function compileAnims<P>(kit: PoseKit<P>, defs: AnimDefs<P>): CompiledAnims<P>;
export function draftGuardTransitions<P>(kit: PoseKit<P>, idle0: P, guard0: P): { toGuard: AnimDef<P>; fromGuard: AnimDef<P> };

// validate.ts — runs on ANY MonsterArt (the slice too): holds 40–200 ms, mandatory marks (HA-1),
// longest anticipation frame right before release, release ≤ 70, contact 50–90, recovery not
// shortening (HA-3), reaction rhythm (HA-4), uneven holds (HA-5). Returns findings with rule ids.
export function validateArt(art: MonsterArt, o?: { tier?: Tier }): Finding[];
```

`draftGuardTransitions` bir **taslak** üretir (önce kollar, gövde iner, baş en son; 5 kare, ≤ 0,4 sn);
sıradan katman onu kullanabilir, normal katmanda ×3 sayfada incelenip elle düzeltilir.

### 3.3 Gövde tipi

```ts
// src/art/bodyplans/types.ts
export type RegionId = 'head' | 'chest' | 'armN' | 'armF' | 'hips' | 'lower' | 'tail'
  | 'wingN' | 'wingF' | 'propN' | 'propF' | 'extra';

export interface BodyPlan<Build, P, R> {
  readonly id: string;                 // 'biped'
  readonly version: number;            // = the version directory (biped/v1 → 1); set by the directory, never by hand (§3.6)
  neutral(b: Build): P;
  groups: Record<string, readonly (keyof P)[]>;            // lag groups for mix()
  regions: Partial<Record<RegionId, readonly (keyof P)[]>>; // the struck-frame filter
  rig(b: Build, pose: P): R;           // skeleton solve: IK limbs, planted feet, spine, head lag
  order: readonly string[];            // default far → near slot order
  points(b: Build, rig: R, pose: P): MonsterPoints;        // muzzle / core / head / hand / feet / grip…
  joints(b: Build, rig: R, pose: P): Readonly<Record<string, V>>; // handN, handF, head, hip, footN, footF, prop*… (sameness tool, §9)
  poseKnockPx(b: Build, weight: WeightClass): readonly [number, number, number]; // px of body travel the recoil words draw (§10)
  helpers: PlanHelpers<Build, P>;      // VOCABULARY, not choreography; each returns Partial<P>
}

// VOCABULARY rules: no word carries a default period, phase or amplitude. Loop words take them as
// REQUIRED arguments, so two members can never share an idle by omission (§9: loop signature).
export interface PlanHelpers<B, P> {
  breathe(o: { periodMs: number; phase: number; amp: number }): (tMs: number) => Partial<P>;
  weightShift(o: { periodMs: number; phase: number; px: number }): (tMs: number) => Partial<P>;
  plant(foot: 'N' | 'F'): Partial<P>;
  step(foot: 'N' | 'F', dx: number): Partial<P>;
  struck(region: RegionId, power: 1 | 2 | 3): Partial<P>;     // frame 0 of a reaction (region only)
  struckBack(power: 1 | 2 | 3): Partial<P>;                   // forward lean (a blow from behind, HA-23)
  struckAbove(power: 1 | 2 | 3): Partial<P>;                  // hip drops, head bows (a bolt from above)
  recoilPush(weight: WeightClass, power: 1 | 2 | 3): readonly [Partial<P>, Partial<P>, Partial<P>]; // f0/f1/f2
  guardTuck(o: { lead: 'arms' | 'shield'; dropPx: number }): Partial<P>;
  throwArc(o: { from: 'handN' | 'handF'; liftPx: number }): readonly Partial<P>[];
}

export interface PartCtx<P, R> {
  pose: P; rig: R; light: Light; anim: AnyMonsterAnim; frame: number;
  mat(role: string): MaterialDef; raster(): Raster; canvas(): PixelCanvas;
}
export interface PartPainter<P, R> {
  layer: string;                                          // a slot of plan.order (or a new one, L4)
  paint(ctx: PartCtx<P, R>): PixelCanvas | null;          // gbuf part, map stamp or cloth planes
  seam?: 'selout' | 'crease' | SeamFn;
  fold?: Fold;
}
```

### 3.4 Canavar dosyası

```ts
export interface DistinctionCard {           // "ayrışma kartı" — REQUIRED, read by the sameness review
  silhouette: string;   // the silhouette hook: "hunched, shoulder boulders above the head"
  rhythm: string;       // "embers fill: long gather, bursting lunge, stomp"
  idle: string;         // the loop: periods, phases, who leads ("core pulse 2 periods, shoulder rocks +2 frames, breath 2.2 s")
  guard: string;        // the guard loop and how it differs from idle
  signaturePart: string;
  material: string;
  signatureMove: string;
  allow?: readonly { with: string; metric: 'KEY' | 'MOT' | 'SI' | 'RHYTHM' | 'HEAT'; why: string; approvedBy: 'user' }[];
}

export interface PlanMonster<Build, P, R, Fx extends Record<string, number> = {}> {
  id: string;                                   // MonsterId today; string-compatible (§11.3)
  tier: 'normal' | 'common';
  frame: { w: number; h: number; anchor: readonly [number, number]; hover?: number };
  build: Build;                                 // proportions + slot variants
  materials: Record<string, MaterialId>;        // part role → material ('body', 'trim', 'emissive'…)
  parts: Record<string, PartPainter<P & { fx: Fx }, R> | null>;   // null = empty slot
  order?: readonly string[];                    // L4: insert / reorder slots
  anims: AnimDefs<P & { fx: Fx }>;              // hand-keyed (normal) or archetype + overrides (common)
  weight: WeightClass;
  points?: Partial<Record<MonsterPointName, string | ((rig: R, p: P) => { x: number; y: number })>>;
  passes?: { death?: PassId; revive?: PassId };
  drawAnim?: Partial<Record<AnyMonsterAnim, (p: PixelCanvas, f: number, light: Light) => void>>;  // L3
  post?: readonly ((p: PixelCanvas, ctx: PartCtx<P & { fx: Fx }, R>) => void)[];                   // L4
  retouch?: Record<`${AnyMonsterAnim}:${number}`, MapPair>;                                        // L2
  knock?: 'pose' | 'sprite';                    // default 'pose' (§10)
  p2?: 'relight';                               // every v3 monster (IŞ-1)
  portrait?: MonsterArt['portrait'];
  distinction: DistinctionCard;
}
/** The plan VERSION is the one the monster imports (`import { v1 as biped } from '…/bodyplans/biped'`);
 *  planArt copies plan.id / plan.version into MonsterArt.bodyPlan. */
export function planArt<B, P, R, Fx extends Record<string, number>>(
  plan: BodyPlan<B, P, R>, m: PlanMonster<B, P, R, Fx>): MonsterArt;
```

`Fx` canavarın kendi skaler kanallarıdır (Titan: `core`, `seam`, `flare`; Muhafız: `rune`, `slit`;
Golem: `current`, `foam`). Plan bunları tanımaz, yalnız parçalara iletir: plan büyümeden her canavar
kendi ışığını, ifadesini, efektini canlandırır. `planArt` düz bir `MonsterArt` döndürür (`anims`,
`extraAnims`, `draw`, `drawExtra`, `points`, `joints`, `weight`, `p2`, `knock`, `poseKnockPx`, `bodyPlan`,
`attackImpactFrame` = `release` işareti, `muzzle` = o karedeki `points.muzzle`); kayıt, dokular, kitler
ve araçlar farkı görmez.

### 3.5 Sözleşme ekleri (`src/art/types.ts`, yalnız isteğe bağlı alan)

```ts
export interface MonsterArt {
  // …existing fields unchanged…
  /**
   * v3 (A3): how a recoil moves the body (§10). 'sprite' (absent = default): the reaction kit shoves
   * the sprite whole pixels, starting at the first frame change AFTER contact (never on the contact
   * frame). 'pose': the recoil poses draw `poseKnockPx[power]` px of the travel themselves (feet
   * planted, the struck region leads); the kit adds only the rest, by the same trigger.
   */
  knock?: 'sprite' | 'pose';
  /** v3 (A3), with knock 'pose': whole px of body travel the recoil poses draw, for power 1 / 2 / 3. */
  poseKnockPx?: readonly [number, number, number];
  /** v3 (A3): the body plan (and its pinned version) the art was built on (sameness groups, gallery). */
  bodyPlan?: { id: string; version: number };
  /** v3 (A3): rig joints of one frame in art pixels — read by the sameness tool only, never at runtime. */
  joints?(anim: AnyMonsterAnim, frame: number): Readonly<Record<string, { x: number; y: number }>>;
}
```

### 3.6 Sürümleme (plan, çekirdek, malzeme, önbellek anahtarı)

Amaç: bir düzeltme **sessizce** birden çok canavarın pikselini değiştirmesin (R3), ama düzeltme de
engellenmesin.

| Katman | Düzen | Davranış değişikliği nasıl yapılır | Kanıt |
|---|---|---|---|
| Gövde tipi | Sürüm dizinleri: `bodyplans/biped/v1/`, ileride `v2/`. Canavar sürümü **içe aktarmasıyla** sabitler (`import { v1 as biped }`); `bodyPlan.version` dizinden gelir, elle yazılmaz. | **Ekleme** (eski çıktıyı aynen veren varsayılanla yeni parametre, yeni sözcük) mevcut sürüme girer. **Davranış değişikliği** = dizinin kopyası (`v1/` → `v2/`) ve değişiklik yalnız `v2/`'de. Üyeler tek tek geçer; her geçiş o canavar için sanat değişikliğidir (`sheet-hash` farkı, değişen karelerin ×3 incelemesi, `sameness` yeniden). Hiçbir üye `v1`'i içe aktarmayınca `v1/` silinir. | `sheet-hash --look v3` bütün plan üyelerinde (sabitli sürümleriyle) aynı; `tests/art/bodyplan-pins.test.ts` her sürüm dizininin en az bir kullanıcısı olduğunu (ölü kopya kalmadığını) denetler. |
| Çekirdek (`rigkit`) | Dizin sürümü yok (bütün v3 sanatının temeli; kopyalamak pahalı). | Yalnız ekleme. Davranış değişikliği yalnız `CraftOpts`'a **açılır seçenek** olarak girer (eski davranış varsayılan); seçeneği açan canavar için sanat değişikliğidir. | Y2'de bir kez: dilimle bayt eşitliği (kopya kanıtı). Sonra kalıcı test: sabit girdili altın özet `tests/art/fixtures/rigkit-golden.json`; altın yalnız yeni bir seçenek eklenince (eski özetler aynı kalarak) büyür. `sheet-hash --look v3` bütün v3 sanatında aynı. |
| Malzeme | `verified` tanım dondurulur. | Değer değişecekse yeni tanım (`defs/stone@2.ts`, kimlik `stone@2`); kullanıcılar tek tek geçer. `draft` tanım ilk kullanıcısının kabulüne kadar serbesttir. | `tests/art/materials.test.ts`: `verified` tanımların özeti `fixtures/materials-golden.json`'la aynı. |
| Önbellek anahtarı `defHash` (A7) | Kaynak **içeriğinin** özeti: canavarın dosyaları + sabitlediği plan sürüm dizini + `rigkit` + kullandığı malzeme tanımları. Derleme anında bir Vite eklentisi (`virtual:art-hashes`, vite-node'da da aynı) hesaplar; kaynak metni pakete girmez. | — | Tanım JSON özeti **yasak** (fonksiyonları düşürür). Test: fikstür bir boyacının kaynağı değişince özet değişir; aynı kaynakla iki derlemede aynı kalır. Tüketicisi A7 önbelleği olduğu için A7'de yapılır. |

---

## 4. Gövde tipleri ve A4 eşlemesi

### 4.1 Liste

Plan §6 A3 dokuz gövde tipi sayıyor. Hepsini önceden kurmak, tek örnekten genelleştirilmiş sönük
varsayılanlar üretir. Kural: **bir plan, iki gerçek üyesi olduğunda plan olur**; tek üyeli tip,
planın arayüzüne uygun yazılır ama canavarın kendi dosyalarında durur (ikinci üye geldiğinde taşınır,
yeniden yazılmaz). Ortak zanaat zaten çekirdektedir (`rigkit`), tek dosyalı tipler de onu kullanır.

| Gövde tipi | Plan §6'daki karşılığı | Üyeler | Ne zaman kurulur |
|---|---|---|---|
| `biped` (ön ayar `heavy` / `lithe`) | ağır insansı/golem + insansı savaşçı | Taş Muhafız (A3 pilot), Magma Titanı (A3 taslak → A4.1), Gelgit Golemi (`lower: 'spout'`), Gölge Suikastçı (`lithe`) | A3 |
| `quadruped` | dört ayaklı | Kor Kurdu, Şimşek Kertenkelesi | A4.2, **iki üyeyle birlikte** |
| `serpent` (tek dosya, plan biçiminde) | yılan | Mercan Yılanı | A4.1; ikinci yılanda plan olur |
| `avian`, `floater` (tek dosya) + ortak `wing` modülü ve süzülme yardımcıları `rigkit`'te | kuş/uçan, küçük süzülen/peri | Fırtına Atmacası, Işık Perisi | A4.4 (kanat ve süzülme iki üyeden çıkarılır) |
| `rooted` (tek dosya) | bitki | Dikenli Pusucu | A4.5 |
| `dragon`, `caster` | ejder, cüppeli büyücü | Kristal Ejder, Uçurum Büyücüsü (as, dokunulmaz) | ikinci ejder / büyücü kartı gelince, altın kâhinle (§4.4) |

### 4.2 `biped`: üç ağır insansı aynı planda nasıl ayrışır

```ts
// src/art/bodyplans/biped/v1/build.ts
export interface BipedBuild {
  preset: 'heavy' | 'lithe';
  height: number; shoulder: number; hip: number;
  arm: readonly [upper: number, fore: number]; leg: readonly [thigh: number, shin: number];
  stance: number;            // feet apart (px)
  hunch: number;             // 0 upright … 0.4 head below the shoulder line
  headSink: number;          // px the head sits into the shoulders
  lower: 'legs' | 'spout' | 'skirt';   // IK legs | water spout column | robe
  farArm: 'free' | 'shield' | 'hidden';
}
// src/art/bodyplans/biped/v1/pose.ts
export interface BipedPose {
  dx: number; lift: number;                      // whole body px
  hip: { y: number; tilt: number };              // pelvis drop (knees take it)
  lean: number; chestLean: number; twist: number;// spine; struck frame moves chest + head only
  head: { x: number; y: number; a: number; lag: number };
  armN: Arm; armF: Arm;                          // { hand: V, bend: 1 | -1, grip: 'fist' | 'open' | 'hold' }
  footN: Foot; footF: Foot;                      // { step: V, lift: number } — planted unless lifted
  props: Record<string, { at: 'handN' | 'handF' | 'floor' | V; a: number; show: number }>;
  phase: { cloth: number; idle: number };
  pass: Record<PassId, number>;                  // death / revive pass progress
  smearFrom?: Partial<BipedPose>;
}
```

Plan parametre tavanı ~40'tır; ötesi parça (L1/L4) ya da kancadır. "Tek canavar için eklenen
parametre" yoktur.

| Eksen | Magma Titanı | Gelgit Golemi | Taş Muhafız | Planın verdiği |
|---|---|---|---|---|
| Silüet kancası | kambur (`hunch` 0,32); omuz kayaları başın üstünde, yumruklar yere yakın, geniş duruş | **bacak yok**: su hortumu + köpük halkası, fıçı gövde, maske önde | dik dikdörtgen; miğfer omuzlukların arasına gömülü, kule kalkanı uzak tarafı kapatır | iskelet, IK, yere basan ayaklar |
| Malzeme | bazalt + lav dikiş ve göğüs çekirdeği (emisif, konturdan sonra) | su (iç akıntılar) + oyma taş halkalar + mercan | taş örgü + yosun + altın rün | katman sırası, kıvrım bantları |
| Ritim (hepsi `heavy`) | "kor dolar": uzun toplanma, patlayan hamle, ayak vuruşu | "dalga": hortumdan salınır, darbede gövde dalgalanır | "duvar": 0,5 px'lik kıpırtılar, uzun beklemeler | beklemeleri denetler, üretmez |
| Idle döngüsü (ayrışma kartının `idle` alanı) | çekirdek nabzı önde, omuz kayaları gecikmeli; uzun nefes | hortum sürekli akar (kısa periyot), gövde yavaş salınır, maske gecikir | gövde neredeyse durgun; rün ve göz yarığı nabzı, seyrek ağırlık aktarımı | sözcükler; periyot / faz canavarın zorunlu argümanı (§3.3) |
| İmza hareket | tek kol hamle yumruğu (`lunge`) + göğüsten ateş topu | iki kolla dalga çarpması (`slam`) + kolla fırlatılan su topu | yerden kaya koparıp fırlatma (`throw`) + kalkan çarpması | `throwArc`, `plant`, `step` sözcükleri |
| Ölüm | soğuma + moloz (`stone` + `fire` aksanı) | erime + köpük (`water`) | ufalanma (`crumble`) | geçiş çağrısı |
| A4 hedefi (§9.3, mutlak) | titan×muhafız: `MOTsig` < 0,55, `MOTloop` < 0,65, `MOTavg` < 0,45, `SI` < 0,35, `RHYTHM` attack ve idle'da farklı, `KEY` < 0,70 ve < 0,662 | titan×golem: aynı, `KEY` < 0,615 | golem×muhafız: aynı, `KEY` < 0,658 | — |

Neden koreografi planda değil: v1'deki üç rig ayrı ayrı yazılmış olduğu hâlde üçü de f2–f4'te kolu
başın üstüne kaldırıp aynı 833 ms'de vuruyor. Plan bir "attack" kalıbı taşısaydı bu yakınsama kuralın
kendisi olurdu. Plan yalnız sözcük verir; cümleyi canavar kurar. Döngü sözcükleri de varsayılan periyot
taşımaz: aynı periyot ve fazla nefes alan üç komşu ağır canavar da bir tür yakınsamadır.

Golem A4.3'te gelir ama imza hareketi ve ayrışma kartı **A3'te (Y9) yazılır**: üçlünün imzaları Titan
ve Muhafız bitmeden yazılı olur, Golem sonradan "boş kalan yere" sıkışmaz.

### 4.3 Tek üyeli tipler: "ikinci kullanımda çıkar"

Yılan, kuş, peri ve bitki A4'te birer üyeli. Her biri `BodyPlan` arayüzüne uygun (`neutral`, `groups`,
`regions`, `rig`, `order`, `points`, `joints`) ama `src/art/monsters-v3/<id>-rig.ts` içinde yazılır.
İkinci üye geldiğinde dosya `src/art/bodyplans/<tip>/v1/`'e taşınır ve ilk canavarın sayfası
`sheet-hash` ile bit bit aynı kalır (taşıma kanıtı). Ortak kalabilecek alt parçalar (kanat, süzülme,
omurga zinciri) iki üyesi olunca `rigkit`'e çıkar (A4.4'te kanat).

### 4.4 As rig'ler ve ileride plan çıkarma

Ejder ve Büyücü'nün dosyalarına dokunulmaz. İkinci bir ejder ya da cüppeli büyücü kartı gelince
`bodyplans/dragon/v1/` (ya da `caster/v1/`) bu rig'lerin **kopyasından** çıkarılır ve **altın kâhin**
testiyle kabul edilir: ejder parametreleriyle kurulan plan `crystal_wyrm` v3 sayfasının (P1, ek animler,
P2) her karesini aynı üretmeli (`sheet-hash --look v3 --compare` çıkış 0). Yeni ejderler planı
kullanır; as dosyası olduğu gibi kalır. Maliyet yeni bir planın 1,5–2 katı: erken yapılmaz.

---

## 5. Malzeme kütüphanesi

Bir malzeme dört şeyi birlikte tanımlar (REHBER MA-1): çizim, darbe, ölüm/diriltme, ses (+ ışık).
İlk kullanımında kütüphaneye girer; `status` REHBER §2.2 ("bağlayıcı") / §2.3 ("taslak") ayrımını
taşır ve ilk canavarın kabulünde `verified` olur (sonra dondurulur, §3.6). Malzeme **ton ve kural**
paylaşır, **çizim** paylaşmaz: Muhafız'ın tuğla sırası ile Titan'ın kaya parçaları aynı taş ailesinden
ton alır ama ayrı parça boyacılarıdır.

```ts
// src/art/materials/types.ts
export type MaterialId = string;  // 'crystal' | 'hide' | 'metal' | 'cloth' | 'shadow' | 'stone' | 'moss' | 'runeGold' | 'basalt' | 'lava' | 'water' | 'stone@2' …
export type RingSpec =             // sound is data; src/audio/v3/materials.ts interprets it
  | { kind: 'bar'; notes: readonly number[]; dec: number }                    // glass (BAR_MODES)
  | { kind: 'fm'; f: number; ratio: number; index: number; dec: number }      // metal clank
  | { kind: 'flutter'; band: number; dec: number }                            // cloth
  | { kind: 'rumble'; f: number; grit: number }                               // stone / gravel
  | { kind: 'slosh'; f: number; bubbles: number }                             // water
  | { kind: 'crackle'; hp: number; rate: number };                            // fire / electric
export interface MaterialDef {
  id: MaterialId;
  status: 'verified' | 'draft';
  firstUser: string;
  draw: {
    ramp: readonly number[];                 // PAL tones dark → light (IŞ-11: ≤ 5, glass 6)
    th: readonly number[];                   // light thresholds; [] = hand-toned planes (cloth, maps)
    farShift: 0 | 1;                         // far side one value darker (HIDE_FAR)
    seam: 'stepDown' | Readonly<Record<number, number>>;
    crease: 'stepDown2' | Readonly<Record<number, number>>;
    edge: { hi: number | null; lo: number | null; lit: number; dark: number };   // IŞ-8
    rim: number | null;                      // IŞ-7: one rim colour per material
    glint: { tone: number; anchors: 'facet' | 'edge' | 'plate' } | null;
    texture?: { kind: 'facets' | 'courses' | 'chips' | 'scales' | 'currents' | 'feathers' | 'fur' | 'grain'; density: number };
    emissive?: { tones: readonly number[]; pulse: 'breath' | 'flicker' | 'steady' };  // light: after the outline (IŞ-9)
    interior?: 'currents' | 'embers' | null; // moving interior bands (MA-4: no alpha)
    noiseMax: number;                        // IŞ-10 share for this material's frames
  };
  hit: { sparks: readonly number[]; debris: 'shard' | 'chip' | 'drop' | 'leaf' | 'feather' | 'ember' | 'wisp' | null; flash: number };
  death: { shatter: ShatterMaterial; accent: ShatterMaterial; pass: PassId; revive: PassId };
  matter: Ramp;                              // MATTER_RAMP role (holo onsets, light columns, motes)
  sound: { thump: readonly [f0: number, f1: number, g: number, dec: number]; surf: readonly [hz: number, g: number];
           ring: RingSpec; sizzle: number };
  light?: { glow?: number; pool?: number };  // MONSTER_GLOW / STRIKE_LIGHT derive from it
}
```

**Mevcut tablolar nasıl katılır (hiçbiri kırılmaz):**

- `vfx/shatter.ts SHATTER_MATERIALS`: değişmez; `death.shatter` bir anahtardır. Yeni kırılma (`feather`,
  `metal`) gerekince `shatter.ts`'e ve `MATTER_RAMP`'e yalnız ekleme yapılır (ilk ihtiyaç A4.4 tüy:
  REHBER §10.10'daki atmaca/`plant` sapması).
- `_v3/presets.ts DEATH_PRESETS / MATTER_RAMP`, `_v3/sound.ts materialOf()`: 12 kayıt aynen kalır; v3
  görünümünde v3 sanatı olan canavar için önce tarif okunur (§6.4 köprü kuralı).
- `audio/v3/slice.ts MATERIALS` (crystal, metal, cloth) **dokunulmaz**, dilim klipleri bayt bayt aynı.
  Yeni malzemelerin darbe tarifleri `audio/v3/materials.ts`'te aynı `hit<Malzeme><Ağırlık>` biçimiyle
  `RingSpec`'ten üretilir; `sounds.ts` bunları tek satırla ekler. Eski üçü ancak üreteç onları çevrimdışı
  aynı dalga biçimiyle ürettiğinde (analiz kanıtıyla) üretece bağlanabilir; A3'te bağlanmaz.
- **Darbe parçacıkları (sahibi Y5):** `react.ts` bugün `vfx/combat impact` kullanıyor. Y5, `react.ts`'e ve
  `vfx/combat.ts`'e yalnız ekleme yapar: `LOOK_V3` iken ve vurulan canavarın sanatı `bodyPlan` taşıyorsa
  (plan canavarı) `hit.sparks / debris / flash` kıvılcım rengini ve döküntü türünü verir; taşımıyorsa
  (iki as, v1 canavarları) bugünkü çağrı aynen çalışır. Kanıt: dilim filmleri piksel aynı (§13) ve
  `?dev=recipe`'de taş fikstüre fiziksel darbenin temas karesi ×3 filmi (taş kırıntısı, flaş tonu).

A3'te tanımlanan malzemeler: dilimin `crystal`, `hide`, `metal`, `cloth`, `shadow` (`verified`; değerler
ejderin `MATS` ve büyücünün harita tonlarından kopyalanır, test eşitliği doğrular), pilotun `stone`,
`moss`, `runeGold` (`draft` → pilot kabulünde `verified`), taslak Titan'ın `basalt`, `lava` (`draft`).

---

## 6. Sunum tarifleri

### 6.1 Veri biçimi ve yeri

`src/data/cards.ts` kural verisidir ve ortak sözleşmedir; sunum oraya girmez. Her kart için
`src/presentation/cards/<id>.ts` (`export default` bir tarif), kayıt `src/presentation/registry.ts`
`import.meta.glob` ile. Kart başına ayrı dosya, paralel çalışan ajanların aynı dosyada çakışmamasını
sağlar. `src/presentation/**` Phaser içe aktarmaz (Node testlerinde ve erişimcilerde okunur); motor
(`src/engine/**`) bu klasörü asla içe aktarmaz (test).

```ts
// src/presentation/types.ts
export type Tier = 'ace' | 'normal' | 'common';
export type AttackType = 'beam' | 'projectile' | 'throw' | 'lunge' | 'slam' | 'melee' | 'bite' | 'dive' | 'whip' | 'bolt' | 'burrow';
export type EngineAction = 'damage' | 'heal' | 'destroy' | 'negate' | 'counter' | 'statChange' | 'specialSummon';
export interface PresentationRecipe {
  id: string;                                            // card id
  tier: Tier;
  body: { physical: MaterialId; magic?: MaterialId };    // what a blow on this body sounds / sparks like
  attack: {
    type: AttackType; blow: 'physical' | 'magic';        // replaces STRIKE_KIND for this card
    from: MonsterPointName;                              // anatomical origin, followed EVERY frame (HA-25)
    vfx: string; tone?: number;                          // 'boulder' | 'water' | 'fireball' | 'prism' …; STRIKE_LIGHT
    travel?: { ms?: number; arc?: number };
    direct?: AttackType;                                 // a different motion for a direct attack (hawk: dive over)
    blocked?: 'rebound' | 'clang' | 'splash' | 'shatter';
    ranged?: boolean;                                    // replaces chains_of_light RANGED for this card (v3)
  };
  summon: { style: 'column' | 'rift' | 'fissure' | 'vortex' | 'assemble' | 'bloom' | 'swoop' | 'surge' | 'strike' | 'pool';
            matter?: ShatterMaterial; setPiece?: string; roarPeak?: number;
            leadMs?: number; shake?: number };                // 'assemble': gathering before the pose (220), finale shake px (2)
  death: { material: ShatterMaterial; accent: ShatterMaterial; onBurst?: string };  // onBurst: lizard's static ball
  flip?: { accent: 'vines' | 'sparks' | 'dust' | 'mist' | 'drop'; ramp?: string };
  effects?: readonly { on: EngineAction; anim: 'special' | 'roar' | 'attack' | 'death'; from: MonsterPointName;
                       delivery: 'burnFly' | 'healFly' | 'tendril' | 'vineBurst' | 'bolt' | 'shards' | 'sparkle'; vfx?: string }[];
  voice: VoicePreset | { custom: string };               // parameters over audio/v3/kit, or a hand-made set
  light?: { glow?: Partial<MonsterGlow>; strike?: number };
  cutIn?: { rhythm?: Partial<CutInRhythm> };             // only cards with CardDef.ace
  custom?: Partial<Record<'strike' | 'summon' | 'death' | 'flip' | 'effect' | 'revive' | 'position', true>>;
  hooks?: () => Promise<{ default: RecipeHooks }>;       // lazy src/cinematics/recipe/hooks/<id>.ts
}
export interface RecipeHooks {                           // flourishes over the recipe's timeline (§6.2 budget)
  onCharge?: StrikeHook; onRelease?: StrikeHook; onContact?: StrikeHook; onRecover?: StrikeHook;
  onSummonPeak?: SummonHook; onDeath?: DeathHook;
}
export interface VoicePreset {
  palette: 'glass' | 'drone' | 'rumble' | 'growl' | 'crackle' | 'wave' | 'chirp' | 'rustle' | 'chime';
  key: number;                                           // MIDI root (wyrm E, magus D)
  register: 'low' | 'mid' | 'high';
  brightness: number;                                    // 0 dark … 1 bright
  growl?: GrowlParams;
  tail?: 'shimmer' | 'embers' | 'spray' | 'dust' | null;
}
```

Örnek (pilot):

```ts
// src/presentation/cards/stone_sentinel.ts
export default {
  id: 'stone_sentinel', tier: 'normal',
  body: { physical: 'stone' },
  attack: { type: 'throw', blow: 'physical', from: 'hand', vfx: 'boulder', travel: { arc: 18 }, blocked: 'shatter', ranged: true },
  summon: { style: 'assemble', matter: 'stone', setPiece: 'rockAssembly' },  // A0 §1.3: orbiting rocks; the shield slam is the summon pose's peak beat
  death: { material: 'stone', accent: 'stone' },
  flip: { accent: 'dust' },
  voice: { palette: 'rumble', key: 31, register: 'low', brightness: 0.15, tail: 'dust' },
  hooks: () => import('../../cinematics/recipe/hooks/stone_sentinel'),       // dig + crater on charge, ground crack on contact
} satisfies PresentationRecipe;
```

### 6.2 Varsayılan sinematik nasıl kurulur

`src/cinematics/recipe/install.ts` her tarif için yalnız **v3 görünümünde**, yalnız **v3 sanatı olan**
canavar için ve yalnız `custom`'da olmayan parçalar için **öncelik 10** ile kayıt yapar. Yapı taşları
bugün vardır; tarif yalnız seçer ve parametre verir.

| Olay | Yapı taşları (mevcut) | Tariften gelen |
|---|---|---|
| saldırı (`registerStrike`) | `strikeStartFrame` / `declarePoseFrame` (`_v3/clash`), `holdCharge` → `takeCharge` + `atMark` (`_v3/sound`), her karede `points[from]`, `vfx/combat` (`beam`, `projectile`, `lunge`, `bite`, `dive`, `vineWhip`, `lightning`…), temas karesinde `s.impact()` + `contactFlash` + `impactNumber`, `impactLight` (`battle/_kit`), kaybeden menzilliye `backlash` + `isMelee` | `attack.*`, `voice`, `body`, `hooks` |
| çağırma (`summon` kancası) | `poseEntrance(PoseStage)`, `summonPose`, `holoOnset`, `ownerRamp` (`_v3/summon`); kitlerin `finale`; `CardDef.ace` ise `cutInV3` | `summon.*`, `cutIn`, `hooks.onSummonPeak` |
| ölüm (`destroyed`) | `deathV3` (canavarın `death` pozu + `dissolve` işareti), `SHATTER_MATERIALS`, `cardLeaves`, `posematch` girişi | `death.*` |
| darbe | `reactHit` / `reactGuard` (zaten genel) | `body`, `attack.blow` |
| çevirme | `summon-b/flip.ts` vurgusu | `flip.*` |
| diriltme | `soul_recall` v3 yolu (`revive` pozuyla genel) | — |
| etki (**A4.1**) | `burnFly`, `healFly`, `fx.lpPoint` (`vfx/setpieces`), `special` animinin `charge` / `release` işaretleri | `effects[]` |
| pozisyon | `summon-b/position.ts` v3 (`toGuard` / `fromGuard`) | — |

Zaman çizgisi saldırı türünden çıkar: ilan = `charge` karesi (≤ 0,3 sn) → `release` işaretinde köken
noktasının o karedeki yerinden efekt → temas karesinde hit-stop, sayı, malzemenin darbe sesi →
`recover` → eve dönüş; ölüm saldıranın toparlanmasıyla paralel (REHBER SÜ-2). Her saldırı türü
(`strikeOf(type)`) A2'nin zaman kurallarını taşır ve **ilk gerçek kullanıcısıyla birlikte** kendi
referans filmiyle ve `measure` bütçesiyle kabul edilir. Bu yüzden A3 yalnız pilotun kullandığını kurar:
`throw` saldırısı, `assemble` çağırma, ölüm, çevirme, pozisyon, diriltme. `projectile` ve `lunge`
A4.1'de Titan'la, `beam` Yılan'la, etki teslimatları (`effect.ts`) Titan'ın yanma etkisiyle kurulur.

`throw` türünün kendisi şunları taşır (her kullanıcıda ortak, malzemeden parametreli): mermi her karede
`points[from]`'dan çıkar; parabol; dönme; zeminde kayan gölge; temasta malzemenin döküntüsüyle seken
parçalar ve alçak toz; bloklanınca `blocked` biçimi; doğrudan saldırıda düellocuya iniş. **Mermi
fırlatanındır:** `attack.vfx` adıyla kayıtlı bir çizim varsa (`registerProjectile(vfx, draw)`,
`recipe/projectiles/<vfx>.ts`; sanatın kendi parça boyacısıyla çizilir, böylece elde tutulan kaya ile uçan
kaya tek çizimdir; kartın süs bütçesine sayılır) uçan odur, temas yarıçapı onun opak kapsamından gelir;
yoksa malzemenin tonlarında yontulmuş bir kaya (çekirdek incelemesi, bulgu 3).

**Sahne parçaları** (`setpieces/<ad>.ts`, `registerSetPiece(name, fn)`) adla paylaşılan bir kütüphanedir:
lav yarığı, girdap, kaya montajı, tomurcuk kafesi, gölge havuzu (A0 §1.3 "karakterli girişler" korunur).

**Süs bütçesi (normal katman).** Kart başına **≤ 250 satır**: kartın kancaları (`recipe/hooks/<id>.ts`)
ve ilk kullanıcısı olduğu sahne parçalarının toplamı; **olay başına en çok bir sahne parçası**. Sayı her
canavarın satır raporuna yazılır. Bütçeyi aşan kart o olay için `custom`'a geçer (L5, kendi
`registerStrike` / `registerCardHook` dosyası) ve rapor bunu açıkça söyler: katman dürüst kalır, imza
kırpılmaz. Pilotun dağılımı (tahmin): `rockAssembly` ~150 (yörüngede dönen kayalar + montaj; kalkan
çarpması sahne parçası değildir, `summon` pozunun tepe vuruşu + kitin `finale` sarsıntısıdır),
`hooks/stone_sentinel.ts` ~90 (`onCharge`: kazı çatlağı, koparılan kaya, kalan krater; `onContact`:
hedefin altında zemin çatlağı). A0 §4.2'nin "imza vuruşu ve ölüm tadı karta özgü kalır" ilkesi böyle
korunur: türün ortak iskeleti + kartın kendi süsü; süs bütçeye sığmazsa kart o olayda tamamen özel koda
geçer.

**Kaya fırlatma denetim listesi** (A0 §1.3 "en iyi ağırlık hissi"; Y8 kabulü): v1 ve v3 `sbSentinelAtk`
filmleri yan yana (aynı kare aralıkları) ve `sbSentinelBlocked`, `sbSentinelDirect` P1 / P2; her madde
evet / hayır:
1. Kaya kendi elinden çıkar (`from: 'hand'`, `release` karesinde ve uçuşun başında el ile kaya bitişik).
2. Önce yer kazılır, kaya yerden koparılır; çatlak, toprak parçaları, kalan krater görünür.
3. Kaya başın üstünde tutulur ve titrer; en uzun hazırlık karesi bırakmadan hemen öncedir (HA-3).
4. Bırakma karesi ≤ 70 ms; savrulma ara karesi var.
5. Kaya uçuşta döner, gölgesi zeminde kayar.
6. Temasta parçalar zeminde seker, alçak toz bulutu yuvarlanır, hedefin altında zemin çatlar.
7. Bloklanınca kaya kalkanda parçalanır, parçalar geri seker; doğrudan saldırıda kaya düellocuya iner.
8. Süre bütçesi içinde (REHBER §5: saldırı 1,6–2,2 sn; v1'deki çift hazırlık ve 3,73 sn düzeltilmiş).

### 6.3 Ana kart (as) nasıl ezer

1. `custom: { strike: true, … }` → tarif katmanı o parçayı kaydetmez; kartın kendi
   `registerStrike` / `registerCardHook` dosyası çalışır. Ejder ve Büyücü'nün tarifleri her parçayı
   `custom` işaretler: **dilim aynen kalır**; tarifleri kitlerin okuduğu veriyi (ölüm malzemesi, ses,
   ışık, darbe gövdesi) **bugünkü tablo değerleriyle aynen** belgeler ve türetilmiş değer testine
   v3 görünümünde de girer (§6.4).
2. `hooks`: zaman çizgisi tarifte kalır, vuruşlara süs eklenir (Titan'ın göğüs çekirdeği parlaması).
3. Kısmi ezme: bir normal kart tek kancayı elle yazmak isterse aynı kartı **öncelik > 10** ile kaydeder
   ve gerektiğinde `await ctx.base()` ile tarifin varsayılanına düşer. Saldırıda (`registerStrike`) aynı
   iş `return s.base?.()` ile olur: savaş işleyicisi vuruşu `strikeFor(id, genericStrike)` zinciriyle
   çalıştırır; her vuruşun `base()`'i önceliğe göre bir sonrakini, en sonuncununki genel vuruşu çalıştırır
   (çekirdek incelemesi, bulgu 6).

### 6.4 Köprü kuralı ve erişimciler (v1 ve dilim değişmez)

Bütün köprüler tek kurala uyar: **tarif yalnız `LOOK_V3` iken ve canavarın v3 sanatı varken okunur.**
Köprü yalnız **erişimci fonksiyonun içinde** durur ve tablonun her okuması erişimciden geçer. Bugün
tabloların bir kısmı tanımlandıkları dosyanın dışında doğrudan indeksleniyor (§1.2); bu yüzden önce
davranışı değiştirmeyen bir hazırlık adımı (Y5a) her okumayı erişimciye çevirir, köprüyü ancak sonra
Y5 erişimcinin içine ekler.

| Tablo | Erişimci (tablonun kendi dosyasında) | Bugünkü okuma yerleri (Y5a çevirir) |
|---|---|---|
| `STRIKE_LIGHT` (`battle/_kit.ts`) | `strikeLight(id): number \| undefined` | `battle/battle.ts:112,359`, `battle/declare.ts:553` |
| `MONSTER_GLOW` (`view/light/profiles.ts`) | `monsterGlow(id): MonsterGlow \| undefined` | `view/light/LightLayer.ts:847,1006`, `view/light/glow.ts:64` |
| `ROAR_PEAK` (`summon-b/_kit.ts`) | `roarPeak(id): number \| undefined` | `summon-b/_kit.ts:129` |
| `FLIP_RAMP` (`summon-b/flip.ts`) | `flipRamp(id): Ramp \| undefined` | `summon-b/flip.ts:154,264` |
| `RANGED` (`traps/chains_of_light.ts`) | `isRanged(id): boolean` | `traps/chains_of_light.ts:544` |
| `DEATH_PRESETS`, `MATTER_RAMP`, `RHYTHM` (`_v3/presets.ts`) | `deathPreset`, `matterRamp`, `cutInRhythm` (var) | yalnız kendi dosyası |
| `STRIKE_KIND` (`_v3/blow.ts`) | `blowKindOf` (var) | yalnız kendi dosyası |
| `CHARACTER_SOUNDS`, `materialOf` (`_v3/sound.ts`) | `soundsOf`, `materialOf` (var) | yalnız kendi dosyası |

```ts
// e.g. src/cinematics/_v3/presets.ts (additive)
export function deathPreset(id: MonsterId): DeathPreset {
  const r = LOOK_V3 && hasMonsterArtV3(id) ? presentationOf(id)?.death : undefined;
  return r ?? DEATH_PRESETS[id] ?? { material: 'crystal', accent: 'crystal' };
}
```

`deathMaterial` v1'deki eski ölüm tatları tarafından da çağrılıyor; "önce tarif" sırası koşulsuz
olsaydı (yeniden kullanım önerisi) A4.4'te atmacanın tarifi `feather` dediğinde **v1** atmacanın ölümü
değişirdi. `summon-b/flip.ts`'in kart dalları (`case`, `thorn_lurker`) köprülenmez: tarifin `flip`
kancası v3 plan canavarı için öncelik 10'da kaydolur, dallar v1 için kalır. `MOUTHS` v1 varsayılan
vuruşuna aittir ve köprülenmez. Testler: (1) v1 görünümünde 12 kartın, (2) v3 görünümünde
(`globalThis.__NEON_LOOK = 'v3'` içe aktarmadan önce) iki asın her erişimci değeri bugünkü tabloyla
aynı; (3) grep testi: `STRIKE_LIGHT[`, `MONSTER_GLOW[`, `ROAR_PEAK[`, `FLIP_RAMP[`, `RANGED.has(`,
`DEATH_PRESETS[`, `STRIKE_KIND[`, `CHARACTER_SOUNDS[`, `MATTER_RAMP[` kendi erişimci dosyası dışında
geçmiyor (`src/dev/**` ve `src/artlab/**` hariç).

### 6.5 Kapalı `MonsterId` ve plan §8

Yeni katmanda **hiçbir yeni `Record<MonsterId, …>` yoktur**: kayıtlar `Map<string, …>`, aramalar
`presentationOf(id) ?? tablo[id] ?? varsayılan`, dosyalar glob ile bulunur; sınırda `isMonsterId(id)`
ile daraltılır (bugün `registerStrike(monsterId: MonsterId)`). §8'deki veriye dayalı etki sistemi
gelince `MonsterId` tek, koordineli bir değişiklikle markalı `string` olur; o gün tablolar zaten
tarife taşınmış ve her okuma erişimciden geçiyor olur. Tarifteki etkiler motorun etki **adına**
(`summonBurn500`) değil **eylemine** (`damage`, `heal`, `destroy`, `counter`…) bağlıdır: §8'in
tetikleyici → koşul → hedef → eylem yapısıyla bire bir eşleşir, onu engellemez.

---

## 7. Katman modeli (as / normal / sıradan)

Katman kuralları değiştirmez (REHBER §0.2): kalite kapıları üç katmanda da aynıdır. Katman yalnız ne
kadar özel kod yazılacağını söyler. **Kart verisindeki `ace` bayrağı ayrı bir şeydir:** giriş portresi
(cut-in) kural verisidir. Titan ve Yılan `ace: true` kartlardır (cut-in alırlar) ama sanatları
**normal** katmanda gövde tipiyle yapılır; cut-in portreleri (`cutins-v3/<id>.ts`) ve tarifteki
`cutIn` ritmi onlara eklenir.

| Katman | Kim | Sanat | Animasyon | Sinematik | Ses | ~Satır |
|---|---|---|---|---|---|---|
| **As** | Kristal Ejder, Uçurum Büyücüsü | tamamen özel rig (L5) | 14 anim elle | kendi kancaları + cut-in | kendi tarifleri | 4.900–5.050 (bugün) |
| **Normal** | A4'ün 10 canavarı | gövde tipi + kendi parçaları, haritaları, `Fx` kanalları | 14 anim **elle anahtarlanmış**, derleyici denetler | tarif + süs bütçesi ≤ 250 (kancalar + olay başına ≤ 1 sahne parçası); aşan olay `custom` | ses ön ayarı + malzeme | 1.200–1.400 |
| **Sıradan** | ileride yüzlerce vanilla kart | gövde tipi + parça kütüphanesi + malzeme | planın **arketip** koreografisi + en az 3 imza vuruşu üzerine yazılmış (veri) | yalnız tarif | yalnız ön ayar | 300–450 (**koşullu**, aşağıda) |

Sıradan katmanın arketipleri (`biped/archetypes/`: `overheadSlam`, `straightPunch`, `throw`,
`shieldBash`, `stomp`…) **A3'te yazılmaz**: planın en az iki elle anahtarlanmış normal üyesinden
çıkarılır (biped için A4.3 sonrası: dört üye). Arketipin kendisi imza sayılmaz. Arketipi paylaşan
sıradan kartlar hareket yolunda (`MOT`) tasarım gereği birbirine yakın düşer; bu yüzden onların kapısı
§9.6'daki kapsamla ve şu koşulla işler: `KEY` GEÇER (gövde ve parçalar silüeti taşır), `MOTsig`
KALIR değil (imza vuruşları bırakma pozunu ve zamanlamayı gerçekten kaydırır), kör göz testi geçer.
Bu sağlanamıyorsa **kapı gevşetilmez**; kart daha çok elle iş alır. 300–450 satır bir hedeftir, söz
değildir: kalite bağlayıcıdır, satır sayısı değil. Böylece "sıradan kart" ancak plan kanıtlandıktan
sonra ve kapıyı geçerek var olur.

Tasarruf (dürüst): bugün bir v3 canavarı ~4.900–5.050 satır (çizim + sinematik + ses); A2 yöntemiyle
normal bir canavar ~3.500–3.900. Katmanla normal ~1.200–1.400 (rig ve raster yerine parçalar 300–400,
poz tabloları ~500 — **bilerek küçülmeyen kısım**, tarif ~40, süs ≤ 250, ses ön ayarı ~40).
A4 toplamı: katmansız ~36.000 satır, katmanla A3 (~7.400) + A4 (~17.000–20.000; tek dosyalı dört tip
canavar başına ~1.800).

---

## 8. Kaçış kapıları

Her canavar her an bir üst seviyeye çıkabilir; sözleşme (`MonsterArt`) değişmediği için hiçbir şey
kırılmaz.

| Seviye | Ne | Nasıl |
|---|---|---|
| L0 | parametre | `build`, `materials`, `weight`, `Fx` kanalları, tarif alanları |
| L1 | bir parça | `parts.head = myPainter` (kendi `paint`'i: G-buffer, harita ya da kumaş düzlemi) |
| L2 | bir kare | `anims.attack.frames[5] = (p) => over(p, {...})`; elle rötuş `retouch['attack:5'] = { left, right }` (plan §3: kilit pozlar elle rötuşlanır) |
| L3 | bir anim | kendi `AnimDef`'i ya da `drawAnim.special = (p, f, light) => …` (tamamen kendi çizimi) |
| L4 | yeni parça / geçiş | `parts.myCape` + `order`'a ekleme; `post: [glowPass]`; kendi `PassId` geçişi |
| L5 | bütün sanat | düz bir `MonsterArt` (Ejder, Büyücü). Sinematikte: `custom` + kendi kancaları |

Kural: bir canavarın karelerinin %50'den fazlası L3+ ile çiziliyorsa o canavar bilerek **as**
katmanındadır; gövde tipine zorlanmaz (`tools/monster-gates.ts` oranı raporlar).

---

## 9. Benzerlik denetimi

### 9.1 Ölçüler

Hepsi Node'da, oyunun çizim yolundan (`art.draw` / `drawExtra`; plan canavarında `joints`, öteki v3
sanatında `points`), deterministik. **Silüet:** opak maske, çapaya hizalı (çapa → 64×128 ızgarada
(64, 60)), her sanat kendi idle f0 gövde boyu 56 px olacak şekilde en yakın komşuyla ölçeklenir.
**İz:** bir noktanın idle f0'daki yerinden kayması, çapaya göre, idle f0 gövde boyuna bölünmüş;
beklemelere göre 24 zaman örneği. **Ortak animler:** attack, roar, hit, hitHeavy, hitMagic, summon,
death (v3'te; v1'de yalnız attack, roar, hit) ve döngüler idle, guard.

| Kod | Ölçü | Tanım | Rolü |
|---|---|---|---|
| `KEY` | anahtar poz silüeti | idle f0, attack `release` karesi ve hit f0 silüetlerinin IoU ortalaması (REHBER §8.2'nin üç pozu) | **kapı** |
| `MOT` | **hareket yolu, gövde biçiminden bağımsız** | İz kaynağı: plan canavarında `joints()` (handN, handF, head, hip, footN, footF, prop*), öteki v3 sanatında `points()`; v1'de ve noktasız sanatta **silüet vekili** `MOTs` (tepe noktası x/y, ön nokta x/y, arka kenar x, değişen kütle vektörü = idle f0'dan farklı piksellerin ağırlık merkezi kayması × değişen alan payı). **Tek seferlik:** iki canavarın izleri DTW ile hizalanır (bant ±3 örnek ≈ süre ±%12), sonra ortalaması çıkarılmamış kosinüs; eklemler hareket enerjisiyle ağırlıklı; yakın / uzak kol iki eşlemede (N↔N, N↔F) denenir, büyüğü alınır. **Döngü** (idle, guard): DTW yok, döngüsel kaydırmaların en büyüğü (faz bağımsız). Çift değerleri: `MOTsig` = imza animlerinin (attack, roar; ikisinde de varsa special) en büyüğü; `MOTloop` = idle ve guard'ın en büyüğü (döngüler küçük genlikli olduğu için ayrı eşik); `MOTavg` = bütün ortak animlerin ortalaması | **kapı** |
| `SI` | silüetli hareket benzerliği | her ortak anim için [beklemelere göre 8 zaman örneğinde silüet IoU ortalaması × max(0, hareket eğrisi Pearson r)]; idle ve guard'da döngüsel kaydırmaların en büyüğü; animler üzerinden ortalama. Aynı gövdeyi aynı hareketle yakalar, farklı gövdede kördür (§9.2) | kapı |
| `RHYTHM` | ritim imzası | attack / roar / special: [charge→release, release→recover, toplam]; hit / hitHeavy / hitMagic: [impact→recover, toplam]; death: [impact→dissolve, toplam]; **döngü imzası** idle / guard: [toplam, baş izinin baskın periyodu, gövde (kalça) izinin baskın periyodu, baş gecikmesi] ms (HA-6; periyot otokorelasyonla). Bir animin bütün bileşenleri max(40 ms, %8) içindeyse o animde "aynı ritim" | kapı (birleşik) |
| `SIL0` | idle f0 silüeti | yalnız idle f0 IoU | rapor + uyarı (A4'te v1'den miras: REHBER Sİ-5 idle f0'ı v1'e ≥ 0,95 bağlar) |
| `HEAT` | nerede hareket ediyor | attack ve hit'in herhangi bir karesinde idle f0'dan farklı piksellerin maskesi, IoU | rapor + birleşik kural (§9.3) + bindirme PNG'si |
| `PAL` | palet | idle f0 değer (6 kutu) ve ton (8 kutu) histogramı L1 | rapor |

Eski `PTS` (nokta yörüngesi) `MOT`'un iz kaynağı olarak ona katıldı.

### 9.2 Kalibrasyon

**Silüet ölçüleri** (hakem, `judge/calib.txt`; 12 v1 canavarı + dilim):

| Çift | `KEY` | `SI` | `SIL0` | `HEAT` |
|---|---|---|---|---|
| Ejder v1 → v3 (aynı karakter, yeniden çizildi) | 0,880 | 0,613 | 0,997 | 0,833 |
| Büyücü v1 → v3 (aynı karakter) | 0,830 | 0,579 | 0,955 | 0,819 |
| **Titan × Muhafız** (aynı plan) | **0,662** | **0,459** | 0,721 | 0,652 |
| Golem × Muhafız (aynı plan) | 0,658 | 0,307 | 0,651 | **0,706** |
| Titan × Golem (aynı plan) | 0,615 | 0,357 | 0,646 | 0,631 |
| Kurt × Kertenkele (aynı plan) | 0,545 | 0,360 | 0,555 | 0,582 |
| Muhafız × Pusucu (farklı plan) | 0,650 | 0,401 | 0,708 | 0,599 |
| Ejder v3 × Büyücü v3 | 0,509 | 0,199 | 0,526 | 0,524 |
| 66 v1 çifti: medyan / p90 / en çok | 0,448 / 0,555 / 0,662 | 0,120 / 0,284 / 0,459 | 0,474 / 0,573 / 0,721 | 0,541 / 0,640 / 0,706 |

**Hareket yolu, silüet vekili `MOTs`** (bu tur, `revise/mot.ts` → `revise/mot.txt`; attack / roar /
hit DTW kosinüsü; idle / guard döngüsel; `MOTsig` = max(attack, roar), `MOTloop` = max(idle, guard),
`MOTavg` = beşinin ortalaması):

| Çift | attack | roar | hit | idle | guard | `MOTsig` | `MOTloop` | `MOTavg` |
|---|---|---|---|---|---|---|---|---|
| Negatif kontrol (c): her sanat × kendisi, beklemeler ±60 ms (14 sanat) | 0,99–1,00 | 1,00 | 1,00 | 0,87–0,98 | 0,99–1,00 | 1,00 | ≥ 0,99 | 0,974–0,996 |
| Ejder v1 → v3 (aynı karakter) | 0,93 | 0,84 | 0,86 | 0,75 | 1,00 | 0,932 | 0,996 | 0,875 |
| Büyücü v1 → v3 (aynı karakter) | 0,83 | 0,94 | 0,75 | 0,44 | 0,98 | 0,939 | 0,985 | 0,789 |
| **Golem × Muhafız** | **0,59** (66 çiftin 2.'si) | 0,05 | 0,55 | 0,43 | −0,04 | 0,593 | 0,434 | 0,316 |
| Titan × Muhafız | 0,42 | −0,20 | 0,12 | 0,08 | −0,62 | 0,418 | 0,075 | −0,041 |
| Titan × Golem | 0,21 | 0,69 | −0,19 | 0,22 | 0,59 | 0,691 | 0,591 | 0,304 |
| Kurt × Kertenkele | 0,40 | 0,60 | 0,12 | 0,30 | 0,56 | 0,597 | 0,562 | 0,396 |
| Ejder v3 × Büyücü v3 (kullanıcının onayladığı ayrı çift) | 0,20 | 0,35 | 0,86 | 0,16 | 0,61 | 0,347 | 0,612 | 0,436 |
| 66 v1 çifti: medyan / p90 / en çok | 0,27 / 0,48 / 0,875 | — | — | 0,21 / 0,55 / 0,70 | 0,44 / 0,68 / 0,97 | 0,42 / 0,68 / 0,875 | 0,46 / 0,69 / 0,97 | 0,29 / 0,51 / 0,62 |

Ritim: v1'de 12 canavarın 6'sı attack 10 kare / 833 ms / darbe 417 ms; 12'sinin de hit'i 4 kare / 400
ms (A0'daki "tek zaman şablonu"). `RHYTHM` bunları "aynı" sayar. Golem × Muhafız ise attack'ta
"farklı"dır (charge→release 333 / 417 ms, fark 83 ms > max(40 ms, %8)). Dilim: ejder [460, 460, 1350],
büyücü [500, 150, 1180] → farklı.

Gözlemler:
1. `KEY` ve `SI` aynı karakteri farklı canavarlardan ayırıyor (aynı karakter `KEY` ≥ 0,83, `SI` ≥ 0,58).
2. **`SI` gövde biçimine bağlı:** silüet IoU'suyla çarptığı için farklı gövdeler aynı hareketi maskeliyor.
   Gözle aynı tepeden indirmeyi yapan Golem × Muhafız `SI` 0,307 ile GEÇER; `MOTs` aynı çifti attack'ta 66
   çiftin ikincisi (0,59), `HEAT` birincisi (0,706) buluyor.
3. Hareket eğrisinin **Pearson** korelasyonu her tek seferlikte yüksek (idle'dan çıkıp ona döner; enerji
   r medyanı 0,87); `MOT`'un **ortalaması çıkarılmamış kosinüsü** yönü ve zamanlamayı birlikte tartar ve
   ayırıyor (66 çiftte attack medyanı 0,27, aynı karakter 0,83–0,93).
4. `MOT` bekleme oynatmayla kaçılamıyor (±60 ms'de tek seferlik ≥ 0,99, döngü ≥ 0,87).
5. **v1 guard döngüleri birbirinin aynısı** (66 çiftte en çok 0,97, ortanca 0,44): A0'nun "ölü döngüleri".
   Döngüler kapıya girmeden bu yakınsama görünmez kalırdı.
6. Silüet vekili plan dışı çiftlerde yanlış alarm veriyor (büyücü × yılan attack 0,87; titan × pusucu
   ort. 0,75): vekil silüetten türediği için. Bu yüzden kapı plan üyelerinde **eklem izleriyle**, öteki v3
   sanatında **nokta izleriyle** ölçülür; `MOTs` yalnız v1 kalibrasyonu ve plan dışı rapor içindir.
7. Seçilen "anahtar pozlar" arasında hit f0 yerel olduğu için (REHBER HA-21) idle f0'a yakın kalır;
   `KEY`'i asıl düşürecek olan attack `release` pozunun tasarımıdır.

**Kalibrasyonun kabul ölçütü** (Y6 vekil ve nokta izleriyle, Y9 eklem izleriyle; biri tutmazsa
**ölçünün tanımı** değişir, kontrol değil):
- (a) **Renk değişimi** (bir sanatın paleti kaydırılmış kopyası) → `KEY` ≈ 1, `MOT` ≈ 1: **KALIR**.
- (b) **Muhafız'ın `anims`'i Titan'ın `build` / `parts`'ıyla** (`planArt` ile kurulan sentetik üye) Muhafız'a
  karşı → `MOTsig` ≥ 0,80 ve `MOTloop` ≥ 0,85: **KALIR** (silüet farklı olduğu hâlde; eski `SI` bunu kaçırırdı).
- (c) (b)'nin beklemeleri ±60 ms oynatılmış hâli → yine **KALIR** (vekilde her sanatın kendisiyle: `MOTsig`
  1,00, `MOTloop` ≥ 0,99, `MOTavg` ≥ 0,97).
- (d) Aynı karakter v1 → v3 (ejder, büyücü) → `MOTavg` ≥ 0,70 (vekil: 0,875 / 0,789).
- (e) Bilinen yakınsama: v1 golem × muhafız GEÇER **olamaz** (vekil: `MOTsig` 0,593 → UYARI; `HEAT` ile KALIR).
- (f) Yanlış alarm payı: 66 v1 çiftinin medyanı üç `MOT` değerinde de GEÇER bandında (vekil: 0,42 / 0,46 / 0,29).
- (g) Kullanıcının ayrı bulduğu dilim çifti (ejder v3 × büyücü v3) üç `MOT` değerinde de GEÇER (vekil:
  0,347 / 0,612 / 0,436).

### 9.3 Eşikler (aynı gövde tipi ya da aynı arketipi kullanan her çift)

`MOT` eşikleri **geçicidir** (silüet vekilinden); Y6 ve Y9 kalibrasyonu kesinleştirir, sonuç REHBER
§8.2.1'e yazılır.

| Ölçü | GEÇER | UYARI | KALIR |
|---|---|---|---|
| `KEY` | < 0,62 | 0,62 – 0,70 | ≥ 0,70 |
| `MOTsig` | < 0,55 | 0,55 – 0,80 | ≥ 0,80 |
| `MOTloop` | < 0,65 | 0,65 – 0,85 | ≥ 0,85 |
| `MOTavg` | < 0,45 | 0,45 – 0,70 | ≥ 0,70 |
| `SI` | < 0,35 | 0,35 – 0,50 | ≥ 0,50 |
| `RHYTHM` | farklı | attack'ta ya da idle döngüsünde aynı | attack'ta aynı **ve** (`MOT` attack ≥ 0,55 ya da `SI` ≥ 0,35 ya da `KEY` ≥ 0,62); ya da idle'da aynı **ve** `MOT` idle ≥ 0,65 |
| `HEAT` | — | ≥ 0,70: bindirmeye bakılır | ≥ 0,70 **ve** `MOT` attack ≥ 0,55 (geçici; Y6 kalibrasyonu tutar ya da kaldırır) |
| `SIL0` | < 0,70 | ≥ 0,70 | ≥ 0,80, yalnız v1 referansı olmayan (yeni) kartlarda |

Sınama (v1 ağır üçlü, vekil izlerle): golem × muhafız → `HEAT` 0,706 ve `MOT` attack 0,59 → **KALIR**;
titan × golem → `RHYTHM` aynı + `SI` 0,357 → **KALIR** (`MOTsig` 0,691 de UYARI); titan × muhafız → `KEY`
0,662, `SI` 0,459 → UYARI. Yani yeni kurallar v1 üçlüsünün yakınsamasını yakalıyor; eski kurallarda golem ×
muhafız yalnız UYARI'ydı. Dağılım (vekil, 66 v1 çifti, çoğu plan dışı): `MOTsig` 15 UYARI / 3 KALIR
(üçü de plan dışı, vekilin bilinen yanlış alarm türü, gözlem 6), `MOTloop` 8 UYARI / 3 KALIR (üçü de v1'in
"ölü" guard döngüleri: ejder × yılan 0,97, ejder × kurt 0,96, yılan × kurt 0,92), `MOTavg` 13 UYARI / 0 KALIR.
v1 tek zaman şablonuyla yapıldığı için bu kadar UYARI beklenir; v3 çiftleri bu dağılımla değil kendi
kalibrasyonuyla (Y6, Y9, A4.1) değerlendirilir.

- **UYARI** = iki iş zorunlu: (a) canavar dosyasındaki **ayrışma kartı** (silüet, ritim, idle, guard,
  imza parça, malzeme, imza hareket) dolu ve inceleme notunda okunmuş; (b) **kör göz testi** (§9.5)
  geçmiş. Göz testi kalırsa çift KALIR sayılır.
- **KALIR** = çift kabul edilmez. Tek istisna ayrışma kartındaki `allow` kaydıdır (gerekçe +
  **kullanıcı onayı**; ör. bilerek "kardeş" tasarlanmış kartlar).
- **A4 hedefi (ağır üçlü), mutlak:** her çift `MOTsig` < 0,55, `MOTloop` < 0,65, `MOTavg` < 0,45, `SI` < 0,35, `RHYTHM`
  attack'ta ve idle döngüsünde farklı, `HEAT` birleşik kuralı tetiklenmemiş, `KEY` < 0,70 **ve** kendi v1
  değerinin altında; kör göz testi %100. `KEY`'in UYARI bandında kalmasına izin vardır (idle f0 silüeti
  Sİ-5 gereği v1'den miras, titan × muhafız `SIL0` 0,72); ayrışma imza pozlarında, harekette ve
  döngülerdedir.
- **Plan dışı çiftler** (`--against all`): aynı ölçüler raporlanır; KALIR eşiği burada UYARI sayılır
  (kör göz testi), engellemez.
- Eşikler A3 (pilot + taslak Titan, kontroller) ve A4.1 sonunda v3 çiftleriyle yeniden kalibre edilir;
  gevşetme kullanıcı onayı ister, sıkılaştırma REHBER §8.2.1'e yazılarak yapılır.

### 9.4 Araç

```sh
npx vite-node tools/sameness.ts --look v3 --plan biped [--ids a,b] [--against all] \
  [--art src/art/drafts/magma_titan.ts] [--anims attack,roar,hit,idle,guard] [--controls] \
  [--blind DIR] [--out DIR] [--json]
npx vite-node tools/sameness.ts --score DIR/answers.json --key KEYDIR/key.json
```

- Grupları `MonsterArt.bodyPlan.id`'den bulur; `--art` kayıt dışı taslağı katar (`monster-sheet --art` gibi).
- Çıktı: çift matrisi (`KEY / MOTsig / MOTloop / MOTavg / SI / RHYTHM / SIL0 / HEAT / PAL`, GEÇER / UYARI / KALIR),
  anim başına `MOT` ve ritim tablosu, JSON; her UYARI ve KALIR çifti için anahtar poz silüet bindirmeleri
  (kırmızı / mavi, ×3), ısı haritası bindirmesi ve **eklem izi bindirmesi** (iki canavarın el / baş /
  kalça yolları normalize zamanda, ×3). Üretilen PNG'lere bakılır (CLAUDE.md).
- `--controls`: (a) renk değişimi, (c) ±60 ms beklemeler; plan üyesi varsa (b) çapraz kurulum
  (bir üyenin `anims`'i öbürünün `build` / `parts`'ıyla). Kontrollerden biri KALIR çıkmazsa çıkış 3
  ("ölçü kör"): kapı o tanımla kullanılamaz.
- Çıkış kodu 0 / 1 (UYARI var) / 2 (KALIR var) / 3 (kontrol tutmadı). Metrik fonksiyonları
  `tools/lib/sameness-metrics.ts`'te, birim testli (`tests/tools/sameness.test.ts`); tam tarama yavaş
  olduğu için `npm test`'e girmez.
- Ne zaman: plandan ikinci canavar çıktığında ve sonra her yenisinde, §9.6 kapsamıyla; her A4
  çiftinin doğrulama adımında `--against all` ile.

### 9.5 Kör göz testi

Göz testi, sayıların tek başına karar veremediği yerde karar verir; bu yüzden **kör** ve **boy
normalize** yapılır.

1. `sameness.ts --blind DIR` yazar:
   - `ref.png`: her üyenin **adlı** idle f0'ı, renksiz (tek ton), boyu 56 px'e normalize, ×3. Tanıma için tek
     referans budur.
   - `sil.png`: karıştırılmış, **kodlu** kareler: her üyenin attack `release`, roar tepesi, hit f0, guard f0
     silüetleri; renksiz, 56 px normalize, ×3.
   - `motion.png`: kodlu **çiftler**; her çift iki şerittir: attack (ve ayrı satırda idle döngüsü) her
     üyenin **eklem izlerinden ortak, nötr bir çöp gövde** üzerinde çizilmiş hâli (aynı yapı, aynı boy;
     yalnız hareket farklı). Çiftlerin bir kısmı **kontrol**: aynı üyenin iki şeridi (biri ±60 ms beklemeli).
   - `form.json`: boş cevap formu (kod → üye adı; çift → "aynı" / "farklı").
   - Cevap anahtarı `key.json` **ayrı bir dizine** (`--key-out`) yazılır.
2. İnceleyici, **canavarları yapmayan ayrı bir ajandır** (orkestratör başlatır). Ona yalnız `ref.png`,
   `sil.png`, `motion.png`, `form.json` ve üye adları verilir; depodaki sanat dosyalarına, ayrışma
   kartlarına ve anahtara erişmez.
3. `sameness.ts --score form.json --key key.json` puanlar ve sonucu inceleme notuna yazar:
   - Silüet: her çift için kodların **%100**'ü doğru üyeye atanmış (A'nın karesi B diye etiketlenmemiş).
   - Hareket: farklı üye çiftlerinin **hepsi** "farklı"; kontrol çiftlerinin ≥ %80'i "aynı" (hepsine
     "farklı" diyen inceleyiciyi eler).
4. Kalan çift KALIR sayılır; düzeltme sanata yazılır, test yeni bir kör sayfa ve (mümkünse) yeni bir
   inceleyiciyle tekrarlanır.

### 9.6 Yüzlerce kartta kapsam

- **Ölçü hesabı bütün çiftlerdedir.** Ucuzdur: canavar başına maskeler ve izler bir kez çıkarılır ve
  önbelleğe alınır; 300 kartta ~45.000 çift yalnız vektör işlemidir.
- **Kapı kapsamı:** plan üyesi ≤ 8 iken yeni canavar × aynı plandaki bütün üyeler. Sonra: aynı arketipi
  kullananlar + `KEY` ya da `MOTsig`'e göre **en yakın 4** + aynı sette ya da hazır destede yan yana
  çıkabilecekler.
- **Göz testi** yalnız kapsamdaki UYARI çiftlerine, yeni canavar başına **tek** kör sayfayla yapılır;
  insan / ajan işi canavar sayısıyla doğrusal büyür, çift sayısıyla değil.
- Sıradan katman kuralı §7'dedir. Ses ayrışması (REHBER SE-4) aynı kapsamla ölçülür.

---

## 10. Vuruş kiti düzeltmesi: ekranda temas karesi

**Sorun.**
1. `_v3/react.ts knock()` temas karesinin kendisinde bütün sprite'ı 1 px kaydırıyor
   (`s.setPosition(first)`; `knockPx = guardPushPx + 1`, ağır sınıfta bile ≥ 1). 1 px kayma tek başına
   büyücünün piksellerinin %60–62'sini değiştirir. Sonuç: sayfada %41–44 olan hit f0 değişimi ekranda
   %74–75 olur; oyunda dinlenen hedeflerde %40–66 ölçüldü. REHBER HA-21 ("temas karesi yerel, < %50")
   ekranda tutmuyor (REHBER §10.3). Ayrıca yere basan bir canavarda bütün sprite'ı itmek ayakları 1 px
   kaydırır (HA-9).
2. İtmeyi "tepki animinin f1'ine" bağlamak yetmez: ölümcül darbede `playRecoil` (309–336) `plan.hold`
   0 iken ölüme hemen devreder, tepkinin f1'i hiç görünmez; arkadan darbede tepki pozu hiç oynamaz
   (`react.ts:420`).
3. İtmeyi yalnız poza çizmek güç (1/2/3), taraf ve ağırlık farkını kaybettirir (`knockPx`, `react.ts:75–79`):
   arkadan darbe hiç itmez, yukarıdan gelen yıldırım aşağı değil geri iter.

**Tasarım.**

1. **Tetik (bütün v3 canavarları, sanat değişmeden):** temas karesinde sprite kımıldamaz. İtme
   **temastan sonraki ilk kare değişiminde** başlar, ekranda hangi anim varsa: tepkinin f1'i, ölümcül
   devirde ölüm animinin ilk değişen karesi ya da `posematch` giriş karesi. Hit-stop + f0 beklemesi +
   1 tık içinde kare değişmezse (tutulan poz) o anda başlar. Toplam ≤ 4 px, `knockPx(güç, taraf)`,
   sınıfın dönüş eğrisiyle; ölümcülde `hold` (ölüm itilmiş yerde sürer). Uygulama: `afterContact(u, cb)`
   sprite'ın `animationupdate` olayını temastan sonra bir kez dinler.
2. **`knock: 'pose'` karmadır** (plan canavarlarında varsayılan): tepki pozları vurulan bölgenin geri
   tepmesini ve gövdenin `poseKnockPx[güç]` kadarlık yolunu çizer (f0'da yalnız vurulan bölge; f1–f2'de
   gövde ve kalça takip eder; ayaklar basılı kalır ya da hitHeavy'de bir adım geri basar, HA-9, HA-23).
   Kit kalan `max(0, knockPx − poseKnockPx[güç])` tam pikseli aynı tetikle ekler. Böylece güç ve taraf
   farkı korunur; ağır sınıfta kalan çoğunlukla 0'dır (güç 3'te 1), orta ve hafif sınıfta 1–3 px.
   Gövde tipi bunu sözcük olarak verir: `helpers.recoilPush(weight, power)` (f0 / f1 / f2) ve
   `plan.poseKnockPx(build, weight)`.
   **Çekirdek incelemesi düzeltmeleri.** (a) Çizilen yol **ölçülür**: kit, oynayan tepkinin (`hitAnimFor`:
   türe ve ağırlığa göre seçilir, güce göre değil) kendi rig'inde çizdiği kalça yolunu çıkarır
   (`_v3/blow.ts poseTravelPx`: `joints().hip`, f1–f2'de f0'a göre en büyük geri kayma); `joints()`
   vermeyen sanatta beyan edilen `poseKnockPx[güç]` geçerlidir (bulgu 4; pilotta beyan 1/1/1, ölçülen
   hit 1, hitHeavy 3, hitMagic 0 px). (b) **Ölümcül darbede** ölüm pozu tepkinin çizdiği yolu taşımaz:
   ölüm tepkinin yerini vurulma f0'ından alıyorsa (planlı giriş `hold 0`, HA-24) ya da giriş planı yoksa
   (tepki dinlenme pozunda biter) kit `knockPx`'in **tamamını** ekler ve tutar; yalnız ölüm tepkinin
   sonraki bir karesinden devam ediyorsa (piksel eşli giriş, `hold > 0`) o karenin çizdiği yolu düşer
   (bulgu 1; ağır pilot eskiden ölümcül darbede hiç itilmiyordu).
3. **Arkadan darbe** (`side 'back'`): plan sözcüğü `struckBack` varsa 1–2 karelik öne eğilme oynar;
   kit ileri itmeyi aynı tetikle yapar. **Yukarıdan darbe** (`side 'above'`, yıldırım): `struckAbove`
   (kalça iner, baş eğilir); kit itmesi geri değil **aşağı**dır (güç 3'te 1 px, bugünkü `knockPx`).
4. **Savunma** (`MonsterUnit.guardHit`): itme temas karesinden sonra başlar; `brace()` pozu temas yüzünü
   zaten açıyor. Değişiklik **yalnız `LOOK_V3` dalında**; v1 yolu bayt bayt aynı kalır (film kapısı:
   `tbBlocked`, `tbFaceDown`, `tbDefHold`, §13).
5. **Dilim:** dosyaları değişmez (`knock` yok = `'sprite'`); madde 1 ile ekrandaki temas karesi
   sayfadakine iner, itme bir kare sonra görünür.

**Ölçü ve kabul.** Yeni `tools/contact-probe.mjs`: bir senaryoyu donmuş saatte oynatır, temas
karesinde ve bir önceki gösterilen karede hedefin kutusunu kırpar, değişen piksel ÷ opak pikseli yazar
(A2'nin karalama ölçüsünün depo sürümü). Kabul:
- A2 dilim senaryolarında (`saWyrmAtk`, `saWyrmDef`, `saWyrmBlocked`, `sliceMagusHitWolf`,
  `sliceMagusHitTitan`, `sliceMagusHitTitanP2`, `spBoltAce`, `sliceBoltMagus`, `sliceBoltWyrmP2`,
  `saMagusBlocked`'ın savunan tarafı) **dinlenen** hedeflerde ekrandaki değişim < %50 ve sayfa değerinin
  en çok 5 puan üstünde.
- Temas karesinde sprite konumu dinlenme konumuna eşit (birim test: düz, ölümcül, arkadan, yukarıdan,
  savunma; sahte birimle).
- İtme görünür: ×3 filmlerde f1–f3'te; **ölümcül** `sliceMagusHitTitan` / `sliceMagusHitTitanP2`'de ölüm
  animinin ilk kare değişiminde; yukarıdan `spBoltAce`'te aşağı.
- `measure --look v3` olay zamanları ±17 ms aynı (yalnız itme zamanı değişir); v1 `measure --compare`,
  `sheet-hash` ve **v1 film piksel kapısı** aynı.
- Kendi pozunun ortasında vurulan saldıran (`saMagusBlocked` `attack:6 → death:0`) bu ölçünün dışındadır;
  o geçiş `posematch` giriş maliyetiyle denetlenir. Idle fazından gelen fark (süzülenlerde `bobShift` zaten
  hizalıyor) ayrıca raporlanır; < %50'yi aşan bir faz kalırsa düzeltmesi sanata (idle genliği) yazılır,
  kite değil.
- REHBER HA-11, HA-21, §10.3 ve KK-4 bu tasarıma göre güncellendi: KK-4 artık sayfa değeriyle birlikte
  **ekrandaki** `contact-probe` değerini ister.
- **Dilim muafiyeti** (çekirdek incelemesi, bulgu 2; Y1b ölçüsü `shots/v3/a3/y1b/probe-y1b.txt`). Dilimin
  vurulma f0'ı idle f0'a karşı çizilmiştir; dinlenen hedef ise idle'ın ortasında vurulur ve dilim sanatı
  donmuştur. Y1b'nin temas öncesi idle yerleştirmesi (`_v3/posematch.ts settleBefore`: idle döngüsünü
  ±%35 hızla vurulma f0'ına yakın bir hedef kareye getirir) on kabul temasından üçünü sınırın altına
  indirdi: `saWyrmBlocked` P2 %48,1, `spBoltAce` %48,1, `sliceBoltWyrmP2` %47,9 (sayfa %43,8). Kalan yedisi
  dilim için **muaftır**; ekrandaki değerleri kayıttır: `saWyrmAtk` büyücü %68,0, `saWyrmDef` ejder %63,1,
  `sliceMagusHitWolf` %67,1, `sliceMagusHitTitan` %66,7, `sliceMagusHitTitanP2` %69,7, `sliceBoltMagus`
  %74,3 — bu altısında hazırlık süresi bir hedef kareye ±%35 içinde ulaşmaya yetmez (gereken döngü hızı
  ×1,68–×3,17) — ve `saMagusBlocked`'ın savunan ejderi %55,7 (büyücünün küre vuruşu `contact` işareti
  yayımlamaz, yerleştirme zamanlanamaz; döngü ×0,93 ile ulaşabilirdi: açık iş, dilim film tabanı
  yenilenerek yapılabilir). Bu yedisinin sayfa değerleri sınırın içindedir (HA-21 %38–44).
- **Yeni canavarlarda kapı sanattadır:** `monster-gates` satırı **HA-21 phase** = her idle karesi k için
  en büyük `Δ(idle k, vurulma f0) / idle f0 opak` < %50 (hit, hitHeavy, hitMagic ve temas işaretli death;
  P1 ve P2). Dinlenen hedef idle'ın herhangi bir karesinde vurulabildiği için ekrandaki değer bununla
  sınırlanır (yerleştirme yalnız uzun hazırlıkta yardım eder). Dilimde bu değer ejderde %67,9 (idle f14),
  büyücüde %74,3'tür (idle f6; `contact-probe`'un `sliceBoltMagus` ekran değeriyle aynı) ve "known"
  yazılır. Pilot ve A4 canavarları bu satırı geçmeden kabul edilmez (düzeltme sanattadır: idle genliği
  ya da vurulan bölgelerin idle fazıyla uyumu).

---

## 11. Ölçeklenme

### 11.1 Ölçümler ve yansıtma

| Sanat | Kare | ms / kare (Node) | Sayfa (RGBA, taraf başına) | Kare kutusuna kırpılmış |
|---|---|---|---|---|
| v3 Ejder (116×104) | 136 | 6,6–6,8 | 6,56 MB | 3,91–4,10 MB (−%38) |
| v3 Büyücü (112×116) | 130 | 6,2–6,6 | 6,76 MB | 2,05–2,19 MB (−%68) |
| v1 canavarlar | 34–44 | 1,2–5,6 | 0,31–1,62 MB | — |

**A4 sonu yansıtması** (v3 karesi = v1 karesi + dilim oranında pay; normal katman ~125 kare; ms / kare
alanla orantılı):

| Boy sınıfı | Kimler | v3 kare (tahmin) | Taraf başına | Toplam / taraf |
|---|---|---|---|---|
| As (96 / 80) | Ejder, Büyücü | ölçülü | 6,56 / 6,76 MB | 13,3 MB |
| Büyük (80) | Titan, Yılan | ~100×96 | ~4,8 MB | ~9,6 MB |
| Orta (64) | Golem, Muhafız, Kurt, Kertenkele, Suikastçı | ~84×80 | ~3,4 MB | ~16,8 MB |
| Küçük (48) | Pusucu, Atmaca, Peri | ~64×64 | ~2,0 MB | ~6,1 MB |
| **Toplam** | 12 v3 canavarı | | | **~46 MB / taraf → P1 + P2 ~92 MB** |

Üstüne: temel kare önbelleği (`textures.ts frameCache`, P1 temel animlerinin her karesi ayrı bir
`PixelCanvas`) ~+20 MB ve GPU kopyaları. Arka plan boyaması ~6 sn / taraf, ~12–15 sn toplam. `?test`
altında hepsi açılışta eşzamanlı boyanır (`textures.ts:628–640`): her film / `measure` / `clip`
sayfası ~10 sn yavaşlar (v3 `measure` bugün senaryo başına 14–15 sn, 300+ senaryo). `DEFAULT_DECK`
20 kartın hepsi olduğu için (`cards.ts:350`) deste kaydı bugün hiçbir şey kazandırmaz.
**Plan §3'ün "A2 pozlarıyla ~+19 MB" tahmini v1 kare boyları içindi ve geçersizdir;** bu tablo onun yerine
geçer (plan dosyasının güncellenmesi orkestratörün işi).

### 11.2 Strateji ve zamanlaması

| Önlem | Ne | Ne zaman |
|---|---|---|
| Canavar bütçe kapısı | ≤ 140 kare, ≤ 8 ms / kare (Node), **kırpılmamış gerçek** sayfa baytı / taraf boy sınıfına göre: as ≤ 7 MB, büyük ≤ 5 MB, orta ≤ 3,6 MB, küçük ≤ 2,2 MB; `monster-gates` denetler | **A3** (pilottan itibaren her canavar) |
| A3 bellek raporu | pilotun ve taslak Titan'ın gerçek baytı ve boyama süresi + yukarıdaki yansıtmanın ölçümle güncellenmesi | **A3** (Y10) |
| `?test`'te yalnız sahnelenenler | senaryonun sahnelediği ve destesindeki canavarların sayfaları açılışta; geri kalanı ilk ihtiyaçta eşzamanlı (donmuş saatte belirlenimci) | **A4.1 ön adımı** |
| Kırpılmış atlas | Phaser trim'li kare verisi, çapa korunur (−%38…−68) | **A4.1 ön adımı** |
| Temel kare önbelleği sınırı | sayfa yüklendikten sonra kareler bırakılır; yalnız kırılma ve kart resminin istediği kareler (idle f0, death son kare) tutulur, gerisi istenince yeniden çizilir | **A4.1 ön adımı** |
| **Toplam bellek ve boyama kapısı** | tarayıcıda ölçülür (yeni `tools/texmem.mjs`: `mon:*` dokularının bayt toplamı P1 + P2, toplam arka plan boyaması, longtask): iki taraf toplamı ≤ 64 MB, arka plan boyaması ≤ 8 sn, `?test` açılışı A3 tabanının ≤ +%20'si; KK-13 `soak`'ta (> 50 ms donma yok). Gevşetme kullanıcı onayı ister | **A4.1 sonu**, sonra her çiftte |
| String anahtarlı kayıtlar | malzeme, tarif, sahne parçası, ses ön ayarı `Map<string,…>` | **A3** |
| Deste kaydı | `buildDeckMonsters(ids)`: yalnız iki destedekiler; tembel glob (`eager: false`) sanat + tarif | kart sayısı ~30'u geçince (A7 / §8) |
| Öncelikli boyama | el + saha önce; ek animler ihtiyaç anında (bugünkü `warmPoses` / `warmMonsterSheet` temeli) | A7 |
| LRU tahliye | elde / sahada / mezarlık üstünde olmayanın sayfası bırakılır; Ruh Çağrısı hedef seçiminde `revive` ısıtılır | A7 (gerçek cihazda bütçe, öneri 48 MB) |
| İşçi havuzu | çekirdek saf `PixelCanvas`: 2–3 Web Worker; `?test` eşzamanlı kalır | gerekirse A7 |
| Kalıcı önbellek | IndexedDB, anahtar `id : defHash : look : lightFrom` (§3.6 içerik özeti); ikinci açılışta yalnız çözme | A7 / §8 (derlemede PNG'ye pişirme yok: "bütün sanat kodla çizilir") |

A3'te `?test` maliyeti küçüktür: kayda yalnız Muhafız girer (taslak Titan `src/art/drafts/`'tadır, glob
görmez), v3 `?test` açılışına ~+1 sn ekler; v1 testleri değişmez. Bu yüzden `?test` ve atlas işleri
A4.1'in **ilk** işidir, A3'ün değil.

### 11.3 Kimlikler

§6.5: yeni katman `string` ile çalışır, sınırda daraltır; yeni kapalı tablo yok; mevcut 9 tablo v3'te
`tarif ?? tablo` ile ve yalnız erişimciden okunur; `MonsterId` → `string` geçişi §8 ile tek değişiklik.

---

## 12. Testler (vitest; `npm test`)

- **Çekirdek:** Y2'de bir kez kopya kanıtı: sabit girdilerde `Raster` + ilkel çizimler + `composite` +
  `edgePaint` + `rimLight` çıktısı `crystal_wyrm-gbuf.ts` karşılıklarıyla bayt bayt aynı (iki ışık yönü);
  `stamp` / `PartComp` / kumaş düzlemleri büyücü yardımcılarıyla aynı. Kalıcı test: aynı girdilerin altın
  özeti (`tests/art/fixtures/rigkit-golden.json`, §3.6). `despeckle` iki kez uygulanınca değişmez.
- **Poz cebiri:** `lerp` uçlarda kimlik; `mix` grup gecikmesi; `recoil` f0 = struck.
- **Anim derleyicisi:** kare = bekleme sayısı; işaretler aralıkta ve vuruş adlarından doğru; tek
  seferlikler idle f0 pozunda biter (poz eşitliği); `toGuard` guard f0'da; `struck` f0 yalnız bölge
  alanlarını değiştirir; `validateArt` bilinen ihlalleri yakalar (sentetik art) ve dilimde yalnız
  REHBER §10'da yazılı sapmaları raporlar.
- **Gövde tipi (biped):** ayak noktası adım yokken sabit; IK çözümü dört kâğıt üyesinde (Muhafız, Titan,
  Golem `spout`, Suikastçı `lithe`) NaN'siz ve uzuv boyu korunur; `joints()` her karede tanımlı;
  parametre sayısı ≤ 40; döngü sözcükleri periyot / faz / genlik olmadan çağrılamaz (tip testi,
  `// @ts-expect-error`); her sürüm dizininin en az bir kullanıcısı var.
- **Pilot sayfası (yavaş takım):** her kare çizilir; kenar payı ≥ 2, kenar pikseli 0; gürültü bütçesi;
  `out ≤ 1,2`; hit f0 < %50; kare ≤ 8 ms; kırpılmamış bayt boy sınıfı bütçesinde.
- **Malzemeler:** her tanımın rampası `PAL`'dan, `SHATTER_MATERIALS` anahtarı var, ses parametreleri
  geçerli; dilim malzemeleri dilim tablolarına eşit; `verified` tanımlar altın özetle aynı.
- **Tarifler ve erişimciler:** kimlik `CARDS`'ta; `attack.from` noktası `release` karesinde var;
  `weight` sanatla uyumlu; ses, sahne parçası, malzeme, kanca adları çözülür; erişimci değerleri v1'de 12
  kartta ve v3'te (`__NEON_LOOK = 'v3'`) iki asta bugünkü tablolarla aynı; tablo indeksleme grep testi
  (§6.4); `src/engine/**` hiçbir dosyası `src/presentation/**`'ı, `src/presentation/**` Phaser'ı içe
  aktarmıyor.
- **Vuruş kiti:** temas karesinde sprite konumu = dinlenme konumu (düz, ölümcül, arkadan, yukarıdan,
  savunma); itme temastan sonraki ilk kare değişiminde başlıyor (ölüm animi dahil); `knock: 'pose'` iken
  kitin eklediği = `knockPx − ` oynayan tepkinin ölçülen yolu (ölçü yoksa `poseKnockPx[güç]`); ölümcül
  darbede (ağır ve orta sınıf) tutulan itme `knockPx`; yukarıdan darbe aşağı itiyor; v1'de `guardHit` aynı.
- **Benzerlik metrikleri:** IoU simetrik; sentetik izlerde `MOT` bilinen değerler; DTW ±60 ms'de
  değişmez; döngüsel kaydırma faz bağımsız; `RHYTHM` tolerans sınırları ve döngü imzası; kör sayfa
  anahtarıyla puanlama (sentetik form).

---

## 13. Değişmezlik kapıları (her yapım adımının sonunda)

- `npm run typecheck` temiz, `npm test` geçiyor.
- **v1 sanat:** `npx vite-node tools/sheet-hash.ts --compare shots/v3/a3/baseline/sheet-hashes-v1.json` çıkış 0.
- **v3 sanat:** `npx vite-node tools/sheet-hash.ts --look v3 --compare shots/v3/a3/baseline/sheet-hashes-v3.json`:
  `crystal_wyrm`, `abyss_magus` P1 + ek animler + P2 özetleri aynı (dilim dosyaları dokunulmaz, çekirdek
  kopyadır); Y8'den sonra plan üyeleri de (sabitli sürümleriyle) bu tabana eklenir.
- **v1 zaman:** `node tools/measure.mjs --scenarios all --jobs 2 --compare shots/v3/a3/baseline/measure-v1.json` çıkış 0.
- **v1 film pikseli (yeni, A2 kabulündeki gibi):** `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films`
  (her senaryo `shot.mjs --fresh --film`; piksel karşılaştırma, hepsi IDENTICAL). Küme: A2'nin 8 filmi
  (`saWyrmAtk`, `saMagusEffect`, `saTitanP2Blocked`, `smbPosAce`, `spBoltAce`, `suRevive`, `suWyrm`,
  `tbChains`) + savunmada darbe `tbBlocked`, `tbFaceDown`, `tbDefHold` + her köprü yeri için bir film:
  `sbSentinelAtk` (`STRIKE_LIGHT`, ilan), `sbSentinelAtk&arena=v2` (`MONSTER_GLOW`, ışık katmanı v1'de
  yalnız v2 arenada açılır), `smbSentinel` (`ROAR_PEAK`), `smbFlipThorn` ve `smbFlipHawk` (`FLIP_RAMP` ve
  çevirme dalları), `sbSentinelDies` (ölüm tatları, `deathMaterial`).
- **Dilim film pikseli (yeni):** `node tools/filmdiff.mjs --set slice --base <taban>` `?look=v3` ile:
  `saWyrmAtk`, `saMagusAtk`, `saWyrmBlocked`, `suWyrm`, `suMagus`, `sliceMagusHitTitan`, `spBoltAce`,
  `sliceChainsWyrm`, `sliceMagusRevive`, `sliceWyrmPos`, `sliceMagusFlip`. Taban: Y0'ınki; **Y1** itmeyi
  bilerek değiştirdiği için bu kapıdan muaftır ve kabulünden sonra tabanı yeniler
  (`shots/v3/a3/baseline/slicefilms-y1/`); sonraki her adım o tabana karşı ölçer.
- **Dilim zamanı:** dilim senaryolarının v3 `measure` zamanlamaları ±17 ms aynı (Y1'de yalnız itme
  zamanı değişir, olay zamanları aynı kalır).
- **Dilim sesi:** tarif adları ve kodu değişmez (`slice.ts` dokunulmaz).
- **Kod kuralı:** `src/duel/MonsterUnit.ts`'teki her değişiklik `LOOK_V3` dalındadır (inceleme notunda
  satır satır gösterilir); paylaşılan v1 + v3 kod yollarına (`battle/_kit.ts`, `view/light/*`,
  `summon-b/*`, `traps/chains_of_light.ts`) yalnız erişimci çevirisi (Y5a) ve `LOOK_V3`'lü köprü (Y5) girer.

`filmdiff.mjs` Y0'da yazılır: `shot.mjs`'i çağıran ince bir sarmalayıcı + PNG piksel karşılaştırması
(A2 kabulünde elle yapılan işin depo sürümü).

---

## 14. A3 yapım planı

Sıra ve paralellik: **Y0** → (**Y1** ∥ **Y2** ∥ **Y4** ∥ **Y6**) → **Y3** (Y2'den sonra) ∥ **Y5a** (Y1'den
sonra) → **Y5** (Y1, Y4, Y5a'dan sonra) → **Y7** (Y3, Y4'ten sonra) → **devir** (Y2–Y5 bitince) →
**Y8** (Y5, Y7'den sonra) ∥ **Y9** (Y6, Y7'den sonra) → **Y10** → **Y11**.

Her adım yalnız kendi dosyalarına yazar. **Devir:** Y2–Y5 bitince `src/art/rigkit/**`,
`src/art/bodyplans/**`, `src/art/materials/{types,index}.ts` ve `defs/{crystal,hide,metal,cloth,shadow,stone,moss,runeGold}.ts`,
`src/presentation/{types,registry}.ts`, `src/cinematics/recipe/**`, `src/audio/v3/{materials,voices}.ts`
ve `src/cinematics/_v3/react.ts`'in malzeme kablolaması **Y7/Y8 hattının tek yazarına** geçer. Y9 bu
dosyalarda değişiklik gerekirse istek iletir (orkestratör üzerinden); Y8 hattı uygular, plan için
gerekirse sürüm kuralıyla (§3.6). Y8 hattının ortak katmana her dokunuşu §13 kapılarının hepsini
(dilim film pikseli dahil) yeniden çalıştırır.

| # | İş | Sahip olunan dosyalar | Bitti ölçütü | Doğrulama | Bağımlı |
|---|---|---|---|---|---|
| **Y0** | Taban çizgileri, `sheet-hash --look v3`, film karşılaştırıcı | `tools/sheet-hash.ts` (ekleme: `--look v3` → v3 sanatı olanların base + extra + p2 parmak izi), `tools/filmdiff.mjs` (yeni), `shots/v3/a3/baseline/**` | v1 ve v3 parmak izleri, v1 `measure` (all), v3 dilim `measure`, **v1 film kümesi** ve **dilim film kümesi** (§13) tabanları yazıldı; her `--compare` / `filmdiff` kendi tabanına karşı çıkış 0 | her aracı iki kez çalıştırıp özetlerin ve filmlerin aynı olduğu; `typecheck` | — |
| **Y1** | Vuruş kiti düzeltmesi (§10) | `src/cinematics/_v3/react.ts` (itme bölümü), `src/art/types.ts` (yalnız `knock?`, `poseKnockPx?`, `bodyPlan?`, `joints?`), `src/duel/MonsterUnit.ts` (yalnız `guardHit`'in `LOOK_V3` dalı), `tools/contact-probe.mjs`, `tests/cinematics/v3-knock.test.ts` | §10 kabulü: dinlenen hedeflerde ekranda < %50 ve sayfanın ≤ +5 puanı; temas karesinde sprite dinlenme konumunda (düz / ölümcül / arkadan / yukarıdan / savunma); itme ilk kare değişiminde görünür (ölümcül dahil); v1 film kümesi aynı; dilim film tabanı yenilendi | `contact-probe` raporu, ×3 temas filmleri P1/P2 (bakıldı; ölümcül `sliceMagusHitTitan`, yukarıdan `spBoltAce`), `measure --look v3`, §13 (dilim filmi hariç) | Y0 |
| **Y2** | Çekirdek: çizim zanaatı (dilimden **kopya** + genelleştirme) | `src/art/rigkit/{light,raster,composite,edges,maps,cloth,geom}.ts`, `src/art/rigkit/passes/*.ts`, `tests/art/rigkit-*.test.ts`, `tests/art/fixtures/rigkit-golden.json` | kopya sadakati testi bayt bayt geçti (bir kez), sonra altın özet testi yazıldı; modül düzeyinde değişebilir tekil yok; `CraftOpts` varsayılanı A2 davranışı; test yaratığı (`tests/art/fixtures/`) ≤ 8 ms / kare ve IŞ-10 gürültü bütçesi içinde | `npm test`, sabit girdiyle ×3 PNG (bakıldı), §13 | Y0 |
| **Y3** | Çekirdek: poz cebiri + anim derleyicisi + `validateArt` | `src/art/rigkit/{pose,anim,validate}.ts`, `tests/art/rigkit-anim.test.ts` | §12'deki derleyici testleri; `validateArt` dilim üzerinde yalnız REHBER §10'da yazılı sapmaları (ör. ejder death `contact` yok) bulur; `draftGuardTransitions` 5 kare ≤ 0,4 sn | `npm test`; dilim raporu `shots/v3/a3/validate-slice.txt` | Y2 |
| **Y4** | Malzeme kütüphanesi + malzeme sesleri | `src/art/materials/{types,index}.ts`, `src/art/materials/defs/{crystal,hide,metal,cloth,shadow,stone,moss,runeGold}.ts`, `src/audio/v3/materials.ts`, `src/audio/sounds.ts` (tek satır ekleme), `src/audio/sfx.ts` (yalnız ad türüne şablon üyeleri), `tests/art/materials.test.ts`, `tests/art/fixtures/materials-golden.json` | bütünlük testleri; dilim malzemeleri dilim tablolarına eşit; `stone` darbe tarifleri çevrimdışı işlenir: tepe ≤ −1 dBFS, mevcut üç malzemeyle LSD ≥ 9 dB (SE-5) | A2 ses analiz betikleri (çevrimdışı), `clip.mjs` ile tek ses, v1 sesleri değişmedi (§13) | Y0 |
| **Y5a** | Tablo erişimcileri (davranışı koruyan hazırlık, §6.4) | erişimciler tablolarının dosyasında: `src/cinematics/battle/_kit.ts` (`strikeLight`), `src/view/light/profiles.ts` (`monsterGlow`), `src/cinematics/summon-b/_kit.ts` (`roarPeak`), `src/cinematics/summon-b/flip.ts` (`flipRamp`), `src/cinematics/traps/chains_of_light.ts` (`isRanged`); okuma yerleri: `src/cinematics/battle/{battle,declare}.ts`, `src/view/light/{LightLayer,glow}.ts`; `tests/presentation/table-access.test.ts` (grep testi) | §6.4 tablosundaki her okuma erişimciden geçiyor; grep testi geçer; köprü **yok** (erişimci bugünkü değeri döndürür) | §13'ün hepsi: v1 film kümesi ve dilim film kümesi (Y1 tabanı) aynı, v1 / v3 `measure` aynı | Y1 |
| **Y5** | Sunum tarifleri + varsayılan sinematik (yalnız pilotun kullandığı) + köprüler + sesler + darbe parçacıkları | `src/presentation/{types,registry}.ts`, `src/presentation/cards/{crystal_wyrm,abyss_magus}.ts` (hepsi `custom`, değerler bugünkü tablolarla aynı), `src/cinematics/recipe/{strike,summon,death,flip,install}.ts` (saldırı türü yalnız `throw`), `src/audio/v3/voices.ts`, köprüler yalnız erişimcilerin içinde: `src/cinematics/_v3/{presets,sound,blow}.ts`, `src/view/light/profiles.ts`, `src/cinematics/battle/_kit.ts`, `src/cinematics/summon-b/{_kit,flip}.ts`, `src/cinematics/traps/chains_of_light.ts`; darbe parçacıkları (ekleme, `LOOK_V3` + `bodyPlan`): `src/cinematics/_v3/react.ts`, `src/vfx/combat.ts`; `src/dev/previews/recipe.ts` (fikstür canavarla); `tests/presentation/*.test.ts` | erişimci testi v1'de 12 kart + v3'te iki as bugünküyle aynı; motor sınırı testi; `?dev=recipe&id=…` önizlemesinde `throw`, `assemble` çağırma, ölüm, çevirme çalışıyor; taş gövdeye fiziksel darbenin temas karesi ×3 filmde taş kırıntısı ve flaş tonu; **ses:** `rumble` paletinin rolleri (roar, arrive, land, charge, release, impact, dissolve, burst, reviveGather, reviveLand) çevrimdışı işlendi, tepe ≤ −1 dBFS, iki dilim paletine karşı SE-4 (LSD ortanca ≥ 15 dB, en az ≥ 10 dB) | `npm test`, önizleme filmleri (bakıldı), ses analizi raporu, §13 (dilim filmi aynı) | Y1, Y4, Y5a |
| **Y6** | Benzerlik aracı + kapı araçları | `tools/sameness.ts`, `tools/lib/{framelib,sameness-metrics,tracks}.ts`, `tools/monster-gates.ts` (`monster-sheet` JSON → KK-3…KK-6 geçer / kalır tablosu: pay, kenar, gürültü, out/in, dikiş, canlılık, guard oranı, hit f0 %, ayak satırı, P2 `litBias`, L3+ oranı, kare / ms / kırpılmamış bayt bütçesi), `tests/tools/*.test.ts` | §9.2 değerlerini ±0,005 yeniden üretir (titan×muhafız `KEY` 0,662 / `SI` 0,459; ejder v1→v3 `KEY` 0,880; golem×muhafız `MOTs` attack 0,59 ±0,02); kontroller (a), (c), (d), (e), (f), (g) tutuyor; dilim çiftinde nokta izli `MOT` (vekil değil) da (g)'yi geçiyor; `--blind` sayfaları ve ayrı anahtar yazılıyor, `--score` sentetik formu doğru puanlıyor; sentetik KALIR çiftinde çıkış 2, kör ölçüde 3; `monster-gates` dilimde A2 kabul değerlerini verir | çalıştırma + PNG'lere bakıldı (bindirmeler, kör sayfalar); `npm test` | Y0 |
| **Y7** | `biped` gövde tipi, sürüm `v1` | `src/art/bodyplans/types.ts`, `src/art/bodyplans/biped/index.ts`, `src/art/bodyplans/biped/v1/{build,pose,skeleton,slots,helpers,index}.ts`, `src/dev/previews/bodyplan.ts`, `tests/art/biped.test.ts`, `tests/art/bodyplan-pins.test.ts` | dört kâğıt üyesinin (`build` fikstürleri: Muhafız, Titan, Golem `spout`, Suikastçı `lithe`; oranlar v1 rig'lerinden) iskeleti çözülür, ayak değişmezleri geçer; `joints()` ve `poseKnockPx()` var; döngü sözcüklerinde varsayılan periyot yok; parametre ≤ 40 | `?dev=bodyplan&plan=biped` ekran görüntüsü (dört iskelet + eklem izleri + P1/P2; bakıldı), `npm test` | Y3, Y4 |
| **Y8** | **Pilot: Taş Muhafız** (normal katman, A2 kalitesinde, tam yaşam döngüsü) — devirden sonra ortak katmanların tek yazarı | kendi: `src/art/monsters-v3/stone_sentinel{,-parts,-anims,-maps}.ts`, `src/presentation/cards/stone_sentinel.ts`, `src/cinematics/recipe/setpieces/rockAssembly.ts`, `src/cinematics/recipe/hooks/stone_sentinel.ts`, `src/art/rigkit/passes/{crumble,reassemble}.ts`, `shots/v3/a3/sentinel/**`; devirle: §14 başındaki ortak katman dosyaları | REHBER §8.1 KK-1…KK-15'in hepsi **evet** (önce referans kare kapısı: v1 idle f0 ile IoU ≥ 0,95; ≥ 3 eleştiri turu ×3 P1/P2; filmler; bütçeler; demo oyunlar; sesli MP4); **kaya fırlatma denetim listesi** (§6.2) 8/8 ve v1 / v3 filmleri yan yana; `knock: 'pose'` + `poseKnockPx`; ayrışma kartı (idle ve guard dahil) dolu; **süs bütçesi ≤ 250 satır** (kancalar + `rockAssembly`), olay başına ≤ 1 sahne parçası; katman başına satır sayımı raporu; kırpılmamış bayt orta sınıf bütçesinde | `monster-sheet --look v3 --anims all --scale 3 [--p2]`, `monster-gates`, `contact-probe`, `measure --look v3`, `shot --film` (v1 / v3 yan yana), `clip.mjs`, `demo-qa` v3, §13 | Y5, Y7 (+ devir) |
| **Y9** | **Taslak Magma Titanı** + benzerlik kapısı + Golem'in ayrışma kartı | `src/art/drafts/magma_titan{,-parts,-anims}.ts`, `src/art/materials/defs/{basalt,lava}.ts`, `src/art/drafts/tide_golem-distinction.ts` (yalnız `DistinctionCard` + attack / roar / idle anahtar poz listesi, metin), `shots/v3/a3/titan-draft/**` | taslak kapsamı: referans kare kapısı (v1 idle f0 IoU ≥ 0,95), idle ve guard döngüleri, attack (bütün kareler, beklemeler, işaretler), hit, roar anahtar pozları; **kontrol (b) ve (c)** (Muhafız `anims` × Titan gövdesi) KALIR çıkıyor; `sameness --plan biped --art src/art/drafts/magma_titan.ts`: titan×muhafız A4 hedefine (§9.3, mutlak) karşı raporlandı, kalan farkın listesi A4.1'e devredildi; Golem'in imza hareketi Titan'ınkiyle ve Muhafız'ınkiyle çakışmıyor (metin + Titan release pozu karşılaştırması); plan değişikliği gerekirse Y8 hattına iletilip uygulandı | `sameness` raporu + PNG'ler (bindirmeler, eklem izleri), `monster-sheet --art` ×3 (bakıldı) | Y6, Y7 |
| **Y10** | A3 kabulü | `shots/v3/a3/acceptance/**` (belgeler orkestratörde: REHBER §2.3 durumları, §8.2.1 eşikleri, plan §9) | §13'ün hepsi; Y1 ve Y8 kabulleri yeniden ölçüldü; **kör göz testi** Muhafız × taslak Titan için, ayrı bir inceleyici ajanla (§9.5), puanı nota yazıldı; benzerlik eşikleri vekil + nokta + eklem izleriyle kesinleşti (REHBER §8.2.1 önerisi); bellek raporu: pilotun ve taslağın gerçek baytı, boyama süresi, §11.1 yansıtmasının güncellemesi; satır / süre raporu | araç çıktıları + bakılan PNG / MP4 listesi | Y8, Y9 |
| **Y11** | **Kullanıcı onay kapısı** | `shots/v3/a3/user/**` | kullanıcıya gönderildi: pilotun sesli MP4'leri (çağırma, saldırı, bloklanan saldırı, ölüm, diriltme), v1 / v3 kaya fırlatması yan yana, Muhafız–Titan karşılaştırma sayfası (renksiz silüetler + eklem izleri), karar özeti (§0); **kullanıcı onayı alındı** (onaysız A4 başlamaz; istenen düzeltmeler Y8 / Y9'a döner) | onay mesajı orkestratörün notunda | Y10 |

**Pilot neden Taş Muhafız (Titan değil):**

1. Muhafız'ın kart etkisi ve giriş portresi yok (`effect: 'none'`, `ace: false`). Yüzlerce kartın
   izleyeceği **varsayılan yolu** (gövde tipi + tarif + süs bütçesi içinde kanca ve sahne parçası)
   saf hâliyle kanıtlar. Titan `ace: true` (cut-in) ve `summonBurn500` (etki) ister ve emisif lav taşır:
   bunlar kaçış kapılarını sınar, planın kendisini değil; pilotun sonucunu bulanıklaştırır.
2. Ağır üçlünün en küçüğü ve en diki (idle f0 48×49, 1.806 px): en temiz iki ayaklı tabanı; kule
   kalkanı (`farArm: 'shield'`) eşya yuvasını erkenden sınar; savunma kimliği guard animlerini zorlar.
3. v1'deki kaya fırlatması oyunun "en iyi ağırlık hissi" (A0 §1.3): tariften kurulan `throw` vuruşu için
   en yüksek çıta; denetim listesi ve yan yana film bu çıtayı ölçülebilir yapar. Kaya kendi elinden
   çıkmalı (`from: 'hand'` her karede).
4. Oyunun en benzer çifti titan×muhafız (`KEY` 0,662, `SI` 0,459; 66 çiftin birincisi). Pilot Muhafız +
   taslak Titan, en kötü durumu A3'ün içinde ölçer; taslak A4.1'in başlangıcı olur ve planın ilk A4
   çifti (Titan + Yılan) korunur.
5. Malzeme ailesi ortak: taş / yosun / rün pilotla doğrulanır; bazalt ve lav taslakta başlar.

**Tahmini büyüklük:** Y1 ~250, Y2 ~1.250, Y3 ~450, Y4 ~650, Y5a ~200, Y5 ~1.100 (yalnız `throw` + parçacık
kablolaması ~80), Y6 ~950, Y7 ~800, Y8 ~1.150 + süs ≤ 250, Y9 ~550, testler ~750: toplam ~7.400 satır
(dilimin yalnız sanatı 5.776 satırdı).

---

## 15. A4 planı

İlke: her çift **en çok bir yeni gövde tipi** kurar; plan ancak iki gerçek üyesiyle plan olur; her
çift kendi sesleri, malzemeleri ve tarifleriyle ayrı commit'tir; her çiftin doğrulamasında REHBER §8.1
kapıları + `sameness --against all` + kapsamdaki UYARI çiftleri için kör göz testi; yeni saldırı
türü ve etki teslimatı ilk kullanıcısıyla ve kendi referans filmiyle kurulur. A4, Y11 onayından sonra
başlar.

| Aşama | Çift | Gövde tipi işi | Yeni yapı taşları | Benzerlik kapısı |
|---|---|---|---|---|
| **A4.1** | **Ön adım: ölçeklenme** → Magma Titanı + Mercan Yılanı | Titan taslaktan tamamlanır (`biped/v1`, `heavy`); Yılan `serpent` tek dosya (`geom.chain` omurga + `tube`) | ön adım (§11.2): `?test`'te yalnız sahnelenen sayfalar, kırpılmış atlas, temel kare önbelleği sınırı, `tools/texmem.mjs`; malzemeler `basalt`, `lava` (doğrulanır), `water`, `scale`; saldırı türleri `lunge`, `projectile` (Titan'ın ateş topu), `beam` (su jeti), her biri referans filmiyle; `recipe/effect.ts` + etki `damage` (Titan çağrılınca göğüs çekirdeğinden `burnFly`), delici hasar (Yılan); ikisi de `ace: true` → v3 cut-in portreleri; eşikler v3 çiftleriyle yeniden kalibre | titan×muhafız (mutlak hedef §9.3); Golem'in A3 ayrışma kartına karşı Titan'ın son release pozu; yılan raporla; **toplam bellek kapısı** (§11.2) A4.1 sonunda geçer, yoksa A4.2 başlamaz |
| **A4.2** | Kor Kurdu + Şimşek Kertenkelesi | `quadruped/v1` **iki üyeyle birlikte** kurulur (tek canavarın şekline göre değil, ikisinin parametre uzayından); döngü sözcükleri periyotsuz | `fur`, `fire`, `electric`, koyu `scale`; `bite`, `bolt`; etkiler: savaş sonrası `damage` (Kurt), ölümde `onBurst` statik top → boşalma (Kertenkele) | kurt×kertenkele (v1 `KEY` 0,545, `SI` 0,360, `MOTs` sig 0,597 → `SI` < 0,35, `MOTsig` < 0,55, `MOTloop` < 0,65, döngü ritmi farklı) |
| **A4.3** | Gelgit Golemi + Gölge Suikastçı | `biped` esneme: `lower: 'spout'`, `lithe` ön ayar + atkı zinciri; davranış değişikliği gerekirse `biped/v2/` kopyası (§3.6), Titan ve Muhafız `v1`'de kalır (`sheet-hash` aynı) | `slam`, `melee` (arkadan darbe: `blowSide 'back'`, `struckBack`); `counter` etkisi (Golem: kolla su topu); suyun iç akıntıları | **ağır üçlünün üç çifti** mutlak hedefle + üçlü kör göz testi + suikastçı × üçlü; sonra `biped` arketip çıkarımı kararı (dört üye) → sıradan katman açılır |
| **A4.4** | Fırtına Atmacası + Işık Perisi | `avian` ve `floater` tek dosya; kanat modülü ve süzülme yardımcıları iki üyeden `rigkit`'e çıkar | `feather` malzemesi + `feather` kırılma ön ayarı (REHBER §10.10), `light`; `dive` + doğrudan saldırı (`attack.direct`); `heal` etkisi (`healFly` / parıltı) | atmaca × peri raporla (plan farklı) |
| **A4.5** | Dikenli Pusucu (+ çapraz tur) | `rooted` tek dosya | `plant` doğrulanır; `whip` / `burrow` (topraktan ilerleyen saldırı); ÇEVİR etkisi `destroy` (kök → yeraltı sırtı → sarma) | 12 canavarlık çapraz benzerlik raporu (muhafız × pusucu v1'de 0,650 / 0,401!), toplam bellek kapısının yeniden ölçümü (12 v3 sayfası), `quadruped` arketip kararı |

Plandaki sıradan farkı (plan: Titan+Yılan; Kurt+Golem; Atmaca+Muhafız; Peri+Suikastçı; Kertenkele+
Pusucu): Muhafız A3'e çekildi; dört ayaklı tip iki üyesiyle aynı çiftte kurulsun diye Kertenkele Kurt'un
yanına geldi; Golem iki ayaklının esneme testine Suikastçı ile girdi (imzası ve ayrışma kartı A3'te
yazılı, böylece üçüncü ağır canavar "boş kalan yere" sıkışmaz); iki uçan aynı çiftte kanat ve süzülme
dilini birlikte çıkarır; Pusucu çapraz turla tek kalır. Bellek kapısı A4.1'e çekildi: ilk iki büyük
sayfa eklendiğinde ölçülür, 12 sayfa birikmeden.

---

## 16. Riskler

| # | Risk | Kaliteye etkisi | Önlem |
|---|---|---|---|
| R1 | Gövde tipinin varsayılanları görünüşe dönüşür (hepsi aynı duruş, aynı nefes) | yüksek | koreografi planda değil; döngü sözcüklerinde varsayılan periyot yok; beklemeler elle; ayrışma kartı (idle, guard dahil); `KEY` / `MOT` / `SI` / `RHYTHM` kapısı döngüler dahil; ağır üçlü mutlak hedefleri |
| R2 | Tek pilottan genelleme: `biped` Muhafız şeklinde kalır | yüksek | dört üyeye karşı kâğıt denetimi (Y7); taslak Titan A3'te (Y9); Golem'in ayrışma kartı A3'te; API değişikliği tek kullanıcı varken ucuz |
| R3 | Toplu gerileme: plan ya da çekirdek düzeltmesi N canavarın pikselini birden değiştirir | yüksek | sürüm dizinleri ve kopyala-yükselt (§3.6); çekirdekte yalnız açılır seçenek; `sheet-hash --look v3` bütün v3 sanatında; ortak katmanların tek yazarı |
| R4 | Çekirdek çıkarımı dilimi bozar | yüksek | kopya, taşıma değil; `sheet-hash --look v3` ve dilim film kapısı; ileride geçiş yalnız altın kâhinle |
| R5 | Tariften kurulan sinematik elle yapılandan sönük | yüksek | saldırı türleri ilk kullanıcısıyla referans film + bütçe ile kabul; süs bütçesi; sahne parçası kütüphanesi; kaya fırlatma denetim listesi ve yan yana film; asların kendi kodu |
| R6 | Kaçış kapıları her yerde kullanılır, plan ölü ağırlık olur | orta | L3+ oranı raporlanır; > %50 ise canavar bilerek as |
| R7 | Ses ön ayarları birbirine benzer | orta | anahtar / tını / parlaklık farkı zorunlu; SE-4 / SE-5 LSD ölçüsü (kapsamla); Y5'te `rumble` paleti dilime karşı ölçülür; her çift için sesli MP4, son karar kullanıcının kulağı |
| R8 | Genel boru hattı yavaşlar | orta | ≤ 8 ms / kare kapısı (`monster-gates`); tipli diziler ve havuzlar (dilimdeki gibi) |
| R9 | Ölçüte göre sanat: eşiği geçmek iyi olmak değildir | orta | ölçü yalnız işaretler; karar ×3 sayfa + film + kör göz testi; negatif kontroller ölçünün kör kalmadığını kanıtlar |
| R10 | Yüzlerce kartta bellek ve boyama süresi | yüksek (takılma) | canavar bütçesi A3'ten (gerçek bayt); toplam kapı A4.1'de; atlas, önbellek sınırı, `?test` sahnelenenler A4.1 ön adımı; deste kaydı, LRU, önbellek §11.2 takvimiyle |
| R11 | Tek üyeli tipte katman maliyeti kazancı aşar | orta | "ikinci kullanımda çıkar" |
| R12 | Taslak Titan plana Muhafız'ın aleyhine baskı yapar | orta | Y9 planı değiştirmez, istek iletir; değişiklik Y8 hattının sürüm kuralıyla |
| R13 | Göz testi yanlı: inceleyen şekilleri tanıyor, boy farkı ele veriyor | yüksek | kör protokol (§9.5): ayrı ajan, adsız kodlar, 56 px normalize, renksiz, ayrı anahtar, kontrol çiftleri |
| R14 | Köprü sahip olunmayan okuma yerlerinde sessizce işlemez ya da sahipliği bozar | orta | Y5a erişimcileri; grep testi; v1 ve dilim film kapıları |
| R15 | Tek yazar darboğazı: devirden sonra bütün ortak katmanlar Y8 hattında | orta | Y9 yalnız taslak ve kendi malzemeleri; istekler orkestratör üzerinden sıraya girer; Y9 istek beklerken kontrol ve ölçüm işlerini yürütür |

---

## 17. Kanıt

- Öneriler: `<scratch>/v3/a3/design-reuse.md`, `<scratch>/v3/a3/design-quality.md` (ölçüm betikleri ve
  sayfalar `reuse/`, `quality/` altında; v1 attack sayfaları `quality/sheets-v1/*-attack.png` incelendi).
- Hakem kalibrasyonu: `<scratch>/v3/a3/judge/calib.ts`, `calib2.ts` (anahtar pozlar ayrı ayrı) ve
  çıktıları `calib.txt`, `calib2.txt` (`cd /home/user/yugioh && npx vite-node <betik>`).
- İnceleme turu: hareket yolu vekili ve negatif kontrol (c) `<scratch>/v3/a3/revise/mot.ts` → `mot.txt`
  (aynı komutla; ~1 dk).
- Vuruş kiti: `shots/v3/a2f/magus/hit-f0.txt`, `shots/v3/a2f/verify/{ingame-contact-change,hit-steps}.txt`;
  `src/cinematics/_v3/react.ts` 75–79 (`knockPx`), 242 (`LETHAL_HANDOVER_MS`), 309–336 (`playRecoil`), 420.
- A2 v1 film kapısı: `shots/v3/a2/acceptance/v1films/diff.txt`. v3 `measure` süresi:
  `shots/v3/a2/acceptance/measure-v3.log` (senaryo başına 14–15 sn).
- Kod: `src/cinematics/_v3/{react,presets,blow,sound,posematch}.ts`, `src/duel/{MonsterUnit,motion}.ts`,
  `src/cinematics/_core/registry.ts`, `src/cinematics/index.ts`, `src/art/{types,textures}.ts`,
  `src/art/monsters/index.ts`, `src/audio/v3/slice.ts`, `tools/sheet-hash.ts`, `src/data/cards.ts`,
  `src/cinematics/battle/{battle,declare,_kit}.ts`, `src/view/light/{LightLayer,glow,profiles,index}.ts`,
  `src/cinematics/summon-b/{_kit,flip}.ts`, `src/cinematics/traps/chains_of_light.ts`,
  `src/cinematics/strikes-b/stone_sentinel.ts` (v1 fırlatmanın vuruşları, başlık yorumu).

`<scratch>` = `/tmp/claude-0/-home-user-yugioh/ddad49c9-4c8a-50de-b30a-2b20a3666243/scratchpad`.

---

## 18. Eleştiri yanıtları

Karşıt incelemenin 11 bulgusu ve karar. "Kabul" = tasarım bulgunun önerdiği yönde değişti; "kabul,
değiştirilmiş çözümle / zamanlamayla" = sorun kabul edildi ama önerilen çözümün bir parçası kanıtla farklı
ya da başka bir aşamada yapılıyor; gerekçe aşağıda. Reddedilen bulgu yok.

| # | Bulgu (özet) | Karar | Nerede |
|---|---|---|---|
| 1 | Benzerlik kapısı v1 "kolu kaldır, vur" yakınsamasını kaçırıyor (`SI` gövde biçimine bağlı) | kabul, değiştirilmiş çözümle | §9.1–§9.3, §9.4 `--controls`, §12, REHBER §8.2.1 |
| 2 | Idle ve guard döngüleri hiçbir ölçüye girmiyor | kabul | §3.3 (periyotsuz sözcükler), §3.4 (`idle`, `guard`), §9.1, §9.3 |
| 3 | Göz testi kör değil, boy normalize değil | kabul, değiştirilmiş çözümle | §9.5, REHBER §8.2 / §8.2.1 |
| 4 | Pilot v1 fırlatmanın karakterini kendi bütçesiyle koruyamaz; `projectile` / `lunge` A3'te kullanıcısız | kabul | §6.1, §6.2 (süs bütçesi, denetim listesi, yalnız `throw`), §7, §14 Y5 / Y8, §15 A4.1 |
| 5 | Pilot ortak katmanları düzeltemez; darbe parçacıkları ve seslerin sahibi yok | kabul | §5, §14 (devir, Y5) |
| 6 | v1 kimlik kapılarında piksel denetimi yok | kabul | §13, §14 Y0 / Y1 / Y5a |
| 7 | 12 relit v3 canavarı A4'te gelir, bellek önlemleri A7'de | kabul, değiştirilmiş zamanlamayla | §11, §15 A4.1, REHBER KK-13 |
| 8 | Köprülenen tablolar Y5'in sahip olmadığı dosyalarda okunuyor | kabul, değiştirilmiş çözümle | §1.2, §6.4, §14 Y5a |
| 9 | Sürümlemenin mekanizması yok, `defHash` kodu görmüyor | kabul, değiştirilmiş zamanlamayla | §3.6, §12, §14 Y2 / Y7 |
| 10 | Ölümcül darbede itme kaybolur; `'pose'` güç ve yönü düşürür | kabul | §3.3, §3.5, §10, REHBER HA-11 / HA-21 / §10.3 / KK-4 |
| 11 | Sıradan katman ve çift çift kapılar yüzlerce kartta ölçeklenmez | kabul | §7, §9.6, REHBER SE-4 |
| — | Karar notu: A4 öncesi kullanıcı onay kapısı | kabul | §0 madde 11, §14 Y11 |

**Önerinin farklı yapılan kısımları ve kanıtı:**

1. **Bulgu 1: Pearson ya da DTW yerine "DTW + ortalaması çıkarılmamış kosinüs"; `PTS` ayrı kapı değil.**
   Bulgu eklem izlerinde "Pearson ya da DTW" önerdi. Pearson ortalamayı çıkarır; hakem kalibrasyonu
   hareket eğrisinin Pearson'ının her tek seferlikte yüksek çıktığını gösterdi (§9.2 gözlem 3: idle'dan
   çıkıp ona dönen her anim, enerji r medyanı 0,87). DTW zamanı hizalar, benzerliği ölçmez. Bu turda
   denenen ölçü (DTW hizalaması + kosinüs) hem ayırıyor (66 v1 çiftinde attack medyanı 0,27, aynı karakter
   0,83–0,93) hem de bekleme oynatmasına dayanıklı (±60 ms'de ≥ 0,99) (`revise/mot.txt`). `PTS` ayrı bir
   ölçü olarak bırakılmadı; nokta izleri `MOT`'un v3 iz kaynağı oldu (aynı bilgi, tek eşik takımı).
   **`HEAT` tek başına kapı olmadı**, birleşik kurala girdi: tek başına aynı karakteri farklı çiftten
   ayırmıyor (aynı karakter 0,82–0,83, farklı çift 0,71'e kadar, §9.2), ama `MOT` attack UYARI'yla
   birlikte golem × muhafızı KALIR'a çeviriyor.
2. **Bulgu 3: "100% doğru etiket" silüet için tutuldu; hareket için "aynı / farklı" çiftleri.**
   Adla etiketlemek bir referans ister; hareket şeritlerinde referans hareketin kendisi olurdu ve test
   ezberden geçilirdi. Bu yüzden silüette adlı tek referans (idle f0) + kodlu kareler, harekette ortak
   nötr gövde üzerinde çiftler ve kontrol çiftleri kullanıldı (§9.5). Kontrol çiftleri "her şeye farklı
   de" stratejisini eler.
3. **Bulgu 7: `?test`'te yalnız sahnelenen sayfalar ve atlas A3'te değil, A4.1'in ön adımında.**
   A3'te kayda yalnız Muhafız girer; taslak Titan `src/art/drafts/` altındadır ve
   `../monsters-v3/*.ts` glob'u onu görmez (§1.2), yani A3'ün `?test` maliyeti ~+1 sn'dir ve v1 testleri
   değişmez. Bu işler `textures.ts`'in paylaşılan yolunu değiştirir; v1 film kapısıyla A4.1'in başında,
   ilk iki büyük sayfa eklenmeden yapılır. Bulgunun asıl isteği (toplam kapının A7'den A4.1'e alınması,
   gerçek baytla canavar kapısı) aynen kabul edildi.
4. **Bulgu 8: erişimciler tek bir köprü dosyasında değil, tablonun kendi dosyasında.**
   Tek dosya (`src/presentation/bridge.ts` gibi) `battle/_kit.ts`, `view/light/profiles.ts` gibi Phaser'a
   bağlı modülleri içe aktarırdı; `src/presentation/**` Phaser'sız kalmalı (Node testleri ve motor sınırı
   testi, §6.1). `view/light/*`'ın `cinematics/_v3/*`'a bağımlı olması da katman yönünü ters çevirirdi.
   Erişimci tablonun yanında, köprü erişimcinin içinde; grep testi aynı güvenceyi verir.
5. **Bulgu 9: `defHash` A3'ten A7'ye taşındı.** Tüketicisi yalnız A7'nin kalıcı önbelleği; içerik özeti
   bir derleme eklentisi ister (`vite.config`), A3'te kullanılmayan bir şey için bunu yazmak gereksiz
   risk. Tanım (içerik özeti, JSON yasak) ve testi şimdiden §3.6'da sabit.
6. **Bulgu 11** metni incelemede SE-4 cümlesinin ortasında kesilmişti; çözüm bulgunun görünen
   kısmından çıkarıldı: kapı kapsamı (§9.6), sıradan katmanın koşulu (§7) ve SE-4 kapsamı
   (REHBER SE-4). Eksik bir istek varsa bir sonraki inceleme turunda ele alınır.

**Kabul edilen ama sınırı çizilen noktalar:**

- **Bulgu 6:** dilim film piksel kapısı Y1 dışındaki her adımda uygulanır; Y1 itmeyi bilerek değiştirdiği
  için muaftır ve kabulünden sonra tabanı yeniler. v1 film kapısı **hiçbir** adımda muaf değildir.
- **Bulgu 10:** "pose karma" ağır sınıfta pratikte bugünkü kadar küçük kalır (kitin kalanı çoğunlukla
  0); orta ve hafif sınıfta kitin eklediği 1–3 px ayakları kaydırır. Bu HA-9'a aykırı değildir: HA-9
  idle, guard ve geçişleri bağlar; darbe itmesi HA-11'in izin verdiği tek sprite hareketidir ve artık
  temas karesinde değil, poz zaten büyük değişirken başlar.
