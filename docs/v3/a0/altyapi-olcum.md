# A0 — Altyapı haritası ve başlangıç ölçümleri

Neon Düello v3 planının (`docs/ANIMASYON_PLANI.md`) A0 aşaması için altyapı envanteri ve ölçüm raporu.
Bu aşamada kaynak kodda değişiklik yapılmadı. Yalnızca kod okundu, araçlar çalıştırıldı, çekim
yapıldı ve ölçüm alındı.

**Ölçüm ortamı:** 4 CPU, başsız Chromium 1194 (`--use-angle=swiftshader`, yani yazılımsal GPU),
Vite geliştirme sunucusu (ayrıca bir kez üretim derlemesi). Aynı makinede başka ajanlar da çekim
yapıyordu. İlk soak sırasında yük ortalaması 13–21, ikinci soak sırasında 3–6 idi.
**Buradaki kare süreleri kullanıcının cihazını temsil etmez.** Kare hızını yazılımsal GPU belirliyor
(4–20 FPS). Anlamlı olan JS süresi/kare, sıçramaların hangi olayda geldiği ve **oyun zamanı**
cinsinden sinematik süreleri. Oyun zamanı ölçümleri deterministik: dondurulmuş döngü 1/60 sn
adımlarla ilerletildi, render açık ya da kapalı aynı sonucu verdi.

Ham çıktılar `shots/v3/a0/perf/` altında: `boot-profile.txt`, `boot.json`, `bootcmp.json`, `soak.json`,
`soak-stdout.txt`, `soak-2.json`, `soak-2-stdout.txt`, `durations.json`, `durations-stdout.txt`,
`opening.txt`, `tabreturn.json`, `tabreturn.txt`, `texcat.txt`, `typecheck.txt`, `vitest.txt`.
Çekimler `shots/v3/a0/infra-perf/` altında. Ölçüm betikleri karalama alanında
(`…/scratchpad/v3/a0/infra-perf/durations.mjs`, `tabreturn.mjs`, `bootcmp.mjs`, `anims.ts`,
`stillcost.ts`).

---

## 0. Kısa sonuç

- **Temel durum:** `npm run typecheck` temiz (17 sn). `npm test` 6 dosyada 96/96 test geçti (7,8 sn).
  3+2 demo oyununda hata, watchdog aşımı ve sayfa hatası çıkmadı.
- **Süre bütçesi:** Normal çağırma, kart çekme, aşama geçişleri ve oyun sonu bütçe içinde.
  **Saldırı (3,1–5,1 sn ölçüldü, bütçe 1,6–2,2), doğrudan saldırı (2,8–3,3 / ~1,6), tuzak
  (4,2–5,2 / 1,5–2,0), kurbanlı çağırma (3,7–5,8 / 2,5–3,0), diriltme (3,0–3,1 / ~2,0), kapalı
  koyma, pozisyon, çevirme, sıra başlangıcı ve Savaş Aşamasına giriş** bütçenin 1,5–3 katı.
  En büyük kalem ölüm + kartın mezarlığa gidişi (`destroy` 1,6–2,4 sn).
- **Kesirli zoom:** Bugün tek bir boğaz noktası var: `CameraRig.focus`. 30 dosyadan 46 çağrı
  1,03–1,08 zoom istiyor. Tek dosyada düzeltilebilir. Kesirli **sprite** ölçeklemesi ise
  dağınık: canavar sprite’ında 28 satırda squash/stretch, 13 satırda döndürme var.
- **Sözleşme:** Phaser 3.90 kare başına süreyi doğal olarak destekliyor (cut-in’ler zaten
  kullanıyor). Ek animasyonlar, ağırlık sınıfı ve kare başına noktalar `src/art/types.ts`’e
  isteğe bağlı alanlarla eklenebilir. Asıl risk P2 ışığı: P2 sprite’ı `flipX` ile aynalandığı için
  sol üstten çizilen ışık P2’de sağ üstten geliyor.
- **Sakin arena:** v1 geometrisi aynı ve `drawArena` 25 ms’de çiziliyor. Bugünkü v1 arena dokuları
  ise 661 ms ve 15,1 MB tutuyor. BoardViewV2’deki temsilci (delegate) kalıbı tekrar kullanılabilir.
- **Zaman:** Hız ve hit-stop Phaser’ın üç saatini ve özel kare saatlerini ortak yönetiyor. Ama
  kamera sarsıntısı, hologram tarama çizgileri ve müzik bu ortak saatin dışında. Gerçek bir
  “duraklat” yok, menü sinematiği durdurmuyor. Gizli sekmeden dönüşte olaylar topluca tetiklenmiyor.
  Ancak Phaser dönüşten sonra 120 kare boyunca deltayı 16,7 ms’ye kırpıyor, bu da yavaş cihazda
  ağır çekim etkisi yaratıyor.

---

## 1. Altyapı haritası

### 1.1 Açılış zinciri ve doku üretimi

`src/main.ts` Phaser oyununu kuruyor (`pixelArt`, `roundPixels`, `Scale.NONE`, `zoom: fitZoom()`).
`BootScene.create` (`src/scenes/BootScene.ts:15-32`), `src/boot/*.ts` adımlarını `order` sırasıyla
**eşzamanlı** çalıştırıyor.

| Adım | Ne üretir | Maliyet (geliştirme, profil: `boot-profile.txt`) |
|---|---|---|
| 05-core | `fx:px1…ring9` | 3 ms |
| 10-fonts | piksel fontlar | 21 ms |
| 12-vfx-summon | Hologram PostFX boru hattı (önceden ısıtılmış havuz) ve çağırma dokuları | 33 ms |
| 13-vfx-combat / 14-vfx-set | savaş ve set-piece dokuları | 21 / 3 ms |
| 15-arena | v1: `buildArenaTextures` (62 doku, **15,1 MB**). v2: `buildArenaV2Textures` | **661 ms** |
| 16-light | yalnız v2: ışık dokuları. Parıltı sayfaları sonradan 16 ms aralıklarla üretilir | v1’de 0 |
| 20-monsters | `buildAllMonsters` (`src/art/textures.ts:210-240`) | 27 ms eşzamanlı, boyama ertelenmiş |
| 25-cutins | düellocular eşzamanlı. Cut-in portreleri 10 ms’lik dilimlerle, tamamlanınca kayıt | 27 ms + ~0,6 sn arka planda |
| 30-cards | kart yüzleri, arka yüz, izometrik varyantlar | **446 ms** |
| 40-ui | arayüz dokuları | 13 ms |

- **Canavar sayfaları** (`textures.ts:106-240`): Her canavar için `mon:<id>` dokusu boş bir tuval olarak
  açılır. Kare dikdörtgenleri `<anim>:<i>` adıyla ve animasyonlar `mon:<id>:<anim>` adıyla hemen kaydedilir.
  Boyama 6 ms’lik `setTimeout` dilimleriyle arkadan gelir. `textures.get('mon:<id>')` kancalıdır
  (`textures.ts:200-208`): henüz boyanmamış bir sayfaya erişilirse **o sayfanın tamamı eşzamanlı
  boyanır** (`finishSheet`). `?test` (çekim araçları) her şeyi açılışta eşzamanlı üretir.
- Izgara düzeni: sütun sayısı `floor(4096 / w)`. 12 canavar toplam 436 kare ve 9,3 MB (`anims.ts` çıktısı).
  En geniş sayfa Kristal Ejder: 4032×192.
- **P2 için ayrı doku yok.** `MonsterUnit.applyFacing` (`src/duel/MonsterUnit.ts:691-695`)
  `setFlipX(player === 1)` yapıyor ve orijini ayna simetriğine alıyor. `setController` da
  (`MonsterUnit.ts:574-579`, Ruh Çağrısı ile taraf değiştirince) aynı yoldan geçiyor.
- Kart dokuları (30-cards) canavar karelerini `monsterFrame()` önbelleğinden okuyor
  (`textures.ts:61-73`, `frameCache`). Bu önbellek sayfa boyamasıyla paylaşılıyor.
- Açılışta üretilmeyip **ilk kullanımda** üretilen dokular soak `--detail` ile ölçüldü:
  - `shatter:<canavar>`: her canavarın ilk ölümünde 97–438 kare.
  - `ui:panel` (oyun başına 24–30), `tilecard:live`, `duel:shadow` (`MonsterUnit.ts:48-68`),
    `duel:badge`, `spells:rune`, `flow:chev2`, `set:vignette`, `set:ghost`, `arena:lava`.
  - Başlık ekranına her dönüşte `title:logo` (33) ve `title:icon` (10).
  - Plan §3 “ilk çağırma / ilk saldırıda donma yok” diyor. Bu liste ona aykırı adayları gösteriyor
    (bkz. §6.3 sıçramalar).

Kategoriye göre doku belleği (`texcat.txt`, açılıştan hemen sonra, `?test` eşzamanlı):

| Kategori | Doku | MB | Kare |
|---|---|---|---|
| arena (v1) | 62 | 15,11 | 44 |
| mon | 12 | 9,31 | 436 |
| cutin | 4 | 2,64 | 24 |
| card | 136 | 2,10 | 127 |
| (uuid: RenderTexture vb.) | 7 | 1,72 | — |
| ui | 75 | 1,41 | 60 |
| diğer (font, duelist, fx, set) | 37 | 0,88 | — |
| **Toplam** | **338** | **33,2** | 85 animasyon |

### 1.2 MonsterArt sözleşmesi (bugün)

`src/art/types.ts`: `MonsterAnim = idle | roar | attack | hit | guard`. Her biri
`AnimSpec { frames, fps, loop }`. Ek alanlar: `attackImpactFrame`, sabit `muzzle` ve `core` noktaları,
`draw(p, anim, frame)`, isteğe bağlı `portrait`. Bugünkü değerler (`anims.ts`):

| Canavar | Kare | hover | idle | roar | attack (darbe) | hit | guard |
|---|---|---|---|---|---|---|---|
| crystal_wyrm | 96×96 | 0 | 12f@10 L | 10f@10 | 10f@10 (5 → 500 ms) | 4f@10 | 8f@6 L |
| abyss_magus | 80×80 | 6 | 8f@8 L | 10f@10 | 10f@10 (5 → 500 ms) | 4f@10 | 4f@5 L |
| magma_titan / coral_serpent | 80×80 | 0 | 8f@7–8 L | 10f@10 | 10f@12 (5 → 417 ms) | 4f@10 | 4f@4 L |
| ember_wolf / tide_golem / volt_lizard | 64×64 | 0 | 8f@8 L | 10f@10 | 10f@12 (5 → 417 ms) | 4f@10 | 4f@5 L |
| stone_sentinel | 64×64 | 0 | 8f@6 L | 10f@10 | 10f@12 (6 → 500 ms) | 4f@10 | 4f@4 L |
| shade_assassin | 64×64 | 0 | 8f@8 L | 10f@12 | 9f@12 (5 → 417 ms) | 4f@10 | 4f@5 L |
| storm_hawk | 48×48 | 10 | 8f@12 L | 10f@12 | 10f@12 (5 → 417 ms) | 4f@10 | 4f@5 L |
| lumen_sprite | 48×48 | 12 | 8f@10 L | 10f@12 | 9f@12 (5 → 417 ms) | 4f@10 | 4f@4 L |
| thorn_lurker | 48×48 | 0 | 8f@8 L | 9f@10 | 9f@12 (4 → 333 ms) | 4f@10 | 4f@4 L |

**Gözlem:** Tablo şablon gibi. Bütün `hit` animasyonları aynı (4 kare, 10 fps, 400 ms). Saldırıların
hepsi 9–10 kare ve darbe karesi 4–6. Ağırlık farkı karelerin içinde değil, sinematik kodun
içinde (tween süreleri) taşınıyor. Kare başına bekleme olmadığı için “uzun hazırlık, kısa darbe”
yalnızca aynı pozu birden çok kare çizerek ya da `setFrame` ile elle tutarak yapılabiliyor.

### 1.3 MonsterUnit animasyonu nasıl oynatıyor

- `rest()` (`MonsterUnit.ts:353-362`): idle/guard döngüsü, rastgele başlangıç karesiyle.
- `play(anim)` (`:369-401`): tek seferlik oynatır, bitince `rest()`. Emniyet süresi
  `(frames/fps)·1,6 + 300 ms`. `playToFrame` (`:406-435`) `ANIMATION_UPDATE` dinler.
- `attackToImpact()` ve `impactMs` (`:438-446`) `attackImpactFrame / fps` ile hesaplanıyor.
- Savunma kuralı: `UnitSprite.play/setFrame` (`:103-126`) savunmadaki birimde `hit` karelerini
  guard pozuyla değiştiriyor.
- **Elle poz yardımcısı beş ayrı kopya olarak duruyor:** `strikes-a/_kit.ts:179`, `summon-a/_kit.ts:122`,
  `strikes-b/_kit.ts:117`, `summon-b/_kit.ts:133`, `battle/_kit.ts:164`. Ayrıca `strikes-b/_kit.ts:124-129`
  `playFrom` var (`anims.timeScale` ile). 13 dosyada 37 satır `fps`, `frames`,
  `attackImpactFrame` ya da `impactMs` değerlerinden süre hesaplıyor (`MonsterUnit`, `_defaults/strikes.ts`,
  `strikes-a/_kit.ts`, `strikes-a/abyss_magus.ts`, `strikes-a/crystal_wyrm.ts`, `summon-a/_kit.ts`,
  `summon-a/magma_titan.ts`, `summon-b/_kit.ts`, `strikes-b/_kit.ts`, `traps/mirror_barrier.ts`,
  `traps/chains_of_light.ts`, `vfx/setpieces.ts`, `cinematics/api.ts`).
- **Phaser kare başına süre desteği:** `node_modules/phaser/src/animations/Animation.js:365` ve `:518`
  satırlarında `nextTick = currentFrame.duration || msPerFrame` hesabı yapılıyor. Kare süresi
  `msPerFrame`’in **yerine** geçiyor. İstisna: `play({ frameRate })` ile hız ezilirse kare süreleri yok sayılıyor.
  `anims.globalTimeScale` ve `sprite.anims.timeScale` yine uygulanıyor, yani hız ve hit-stop çalışıyor.
  `Animation.duration` ise kare sürelerinden değil `frameRate`’ten hesaplanıyor, bu yüzden toplam süreye
  güvenilmemeli. Oyunda bunun örneği zaten var: `src/boot/25-cutins.ts:58` cut-in’lere
  `cutinSequence` ile kare başına süre veriyor.

### 1.4 Sinematik katmanı (kısa)

Motor olayları üretiyor. `Director` (`src/cinematics/_core/Director.ts`) her olay için zincir kuruyor
(`registry.ts` `buildChain`: öncelik, sonra kart kancası, sonra son kayıt). Zinciri 20 sn **ölçeksiz**
watchdog ile koruyor (`Director.ts:217-245`) ve her olaydan sonra görünümleri öngörülen duruma
eşitliyor. Gözlemciler (`registerObserver`) her olayın başında çağrılıyor. Bu raporun süre
ölçümleri bu kanca ile alındı.

### 1.5 Kamera

`CameraRig` (`src/duel/CameraRig.ts`) iki kamera kullanıyor: dünya kamerası (`main`) ve zoom’suz arayüz
kamerası (`ui`). Her karede derinliğe göre `cameraFilter` atanıyor (`:105-114`). Sarsıntı yalnız
dünya kamerasında, plan bunu zaten istiyor. Her iki kamerada `setRoundPixels(true)` açık (`:28-29`).
`focus()` zoom değerini 1–1,1 aralığına sıkıştırıp tween’liyor (`:49-56`, `:86-103`).

### 1.6 Arena anahtarı ve ışık katmanı

- `ARENA_VARIANT` (`src/view/layout.ts:41-66`) açılışta bir kez belirleniyor: önce `globalThis.__NEON_ARENA`,
  sonra `?arena=v2`, yoksa **v1 (varsayılan)**. `demo.html` v2’yi zorluyor. Bütün düzen sabitleri
  `byArena(v1, v2)` ile seçiliyor.
- `BoardView` (`src/view/BoardView.ts:264-285`) v2’de bütün çağrıları `BoardViewV2`’ye devrediyor.
  v1 kendi neon parıltılarını taşıyor (ADD karışımlı trim, çekirdek ışını, sis, toz).
- **Işık katmanı (`src/view/light`) yalnız v2’de açık** (`DuelScene.ts:185`, `boot/16-light.ts`). v1’de bütün
  çağrılar etkisiz. Yani varsayılan oyunda hafif ışık katmanı **kapalı**. Katman yumuşak radyal
  dokuları kesirli ölçekleyip ADD/MULTIPLY ile karıştırıyor (`LightLayer.ts:498`, `:710`, `:871`).
  Sakin arenanın düz ton basamaklı ışığından (`src/still/scene.ts:36-103`, LUT ile bir basamak
  kaydırma) farklı bir dil bu.

---

## 2. Sözleşme genişletme önerisi (yalnız ekleme)

Öneri, artlab’de denenmiş modele dayanıyor (`src/artlab/types.ts`: `LabAnim { durations[], loop, marks }`
ve `points(anim, frame)`). Eski canavarlar hiçbir alan eklemeden çalışmaya devam eder.

```ts
// src/art/types.ts — A1 eki (mevcut alanlar aynen kalır)
export type MonsterAnimExtra = 'summon' | 'death' | 'revive' | 'special' | 'hitHeavy' | 'hitMagic' | 'victory';
export const MONSTER_ANIMS_EXTRA: MonsterAnimExtra[] = ['summon', 'death', 'revive', 'special', 'hitHeavy', 'hitMagic', 'victory'];
export type AnyMonsterAnim = MonsterAnim | MonsterAnimExtra;

/** Hareket karakteri: eğriler, hazırlık/toparlanma süreleri, hit-stop, sarsıntı. */
export type WeightClass = 'heavy' | 'mediumHeavy' | 'medium' | 'mediumLight' | 'light' | 'floater' | 'caster';

export type AnimMark = 'impact' | 'release' | 'contact' | 'land' | 'dissolve' | 'recover' | 'charge';

export interface AnimSpec {
  frames: number;
  fps: number;                 // holds yoksa kare süresi = 1000/fps (bugünkü davranış)
  loop: boolean;
  /** İSTEĞE BAĞLI: kare başına bekleme (ms), uzunluğu === frames. Hazırlık uzun, darbe kısa. */
  holds?: number[];
  /** İSTEĞE BAĞLI: adlandırılmış vuruşlar → kare indeksi. 'impact' yoksa attackImpactFrame kullanılır. */
  marks?: Partial<Record<AnimMark, number>>;
}

export interface DrawOpts {
  /** Çizimdeki anahtar ışığın geldiği kare kenarı. P2 sayfası 'right' ile çizilir; aynalanınca ekranda yine sol üstten gelir. */
  lightFrom: 'left' | 'right';
}

export interface MonsterArt {
  // … mevcut alanlar …
  extraAnims?: Partial<Record<MonsterAnimExtra, AnimSpec>>;
  drawExtra?(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts): void;
  /** Yoksa 'medium'. */
  weight?: WeightClass;
  /** Kare başına noktalar (ağız / asa ucu / el / pençe…). Yoksa sabit muzzle/core kullanılır. */
  points?(anim: AnyMonsterAnim, frame: number): Partial<Record<'muzzle' | 'core' | 'head' | 'hand' | 'staff' | 'claw' | 'feet', { x: number; y: number }>>;
  /** 'mirror' (bugünkü flipX) | 'relight' (P2 için ışığı ters çizilmiş ikinci sayfa). Yoksa 'mirror'. */
  p2?: 'mirror' | 'relight';
}
```

`draw` imzasına isteğe bağlı 4. parametre (`o?: DrawOpts`) eklemek de ekleme sayılır. Eski
uygulamalar bu parametreyi görmezden gelir. Yeni animasyonları ayrı `drawExtra` ile çizmek, eski
canavarlarda tanımsız bir animasyonun yanlışlıkla çizdirilmesini önler.

**Doku hattında gerekenler (A1):**
1. `textures.ts` içinde `buildMonster` ve `prepareMonster` (`:85-104`, `:164-198`) şu an `MONSTER_ANIMS`
   üzerinde dönüyor. Bunun yerine `animList(art)` gelmeli: `MONSTER_ANIMS` artı `extraAnims` anahtarları.
   Kare adları (`<anim>:<i>`) değişmez.
2. `scene.anims.create` kare listesine `duration: spec.holds?.[f]` eklenmeli. `frameRate` yedek olarak
   kalmalı. Hiçbir yerde `play({ frameRate })` ile ezilmemeli.
3. Yardımcılar: `animLengthMs(spec)`, `frameStartMs(spec, i)`, `markFrame(spec, mark, fallback)`. Bunlar
   artlab’deki `src/artlab/core/anim.ts` fonksiyonlarının aynısı.
4. `MonsterUnit` tarafı:
   - Emniyet süreleri (`:397`, `:433`, `:540`) ve `impactMs` (`:444-446`) bu yardımcıları kullanmalı.
   - Tek bir `pose(anim, frame)` / `playRange(anim, from, to)` gelmeli ve beş kit kopyası buna dönmeli.
   - `play()` `AnyMonsterAnim` kabul etmeli ve yoksa `false` döndürmeli. Bu durumda çağıran bugünkü
     yedeğe düşer (hologram çağırma, `shatter` ölümü).
5. Ağırlık sınıfı: yeni `src/duel/motion.ts`’te `motionProfile(art)`. Önerilen başlangıç değerleri
   A2’de ayarlanacak:

| Sınıf | Canavarlar (plan §2) | Hazırlık | Bırakma eğrisi | Temas hit-stop | Sarsıntı | Toparlanma |
|---|---|---|---|---|---|---|
| heavy | Magma Titanı, Gelgit Golemi, Taş Muhafız | 280–360 ms, ağırlık aşağı | in-cubic, geç hızlanma | 100–130 ms | 3–4 px | 450+ ms, yere oturma |
| mediumHeavy | Kristal Ejder | 220–300 ms | in-quad | 80–110 ms | 3 px | 350 ms |
| medium | Mercan Yılanı, Dikenli Pusucu | 160–220 ms | out-quad | 60–80 ms | 2 px | 280 ms |
| mediumLight | Kor Kurdu, Gölge Suikastçı, Şimşek Kertenkelesi | 90–150 ms, keskin | out-expo | 40–60 ms | 1–2 px | 200 ms |
| light | Fırtına Atmacası | kalkış + süzülme | dalış (in-quad) | 40 ms | 1 px | süzülerek |
| floater | Işık Perisi | sinüs salınım | yumuşak | 30–40 ms | 0–1 px | yaylanarak |
| caster | Uçurum Büyücüsü | toplama 300 ms + kanal | ani salım | 60 ms | 1–2 px | cüppe gecikmeli oturur |

6. **P2 ışığı (önemli):** Sabit görselde büyücü, aynalanacağı bilindiği için *kare sağ üstünden*
   ışıklandırılarak çizildi (`src/still/magus-map.ts:6-8`). Oyunda ise her canavar iki tarafta da olabiliyor,
   Ruh Çağrısı ile oyun ortasında taraf da değiştirebiliyor. `p2: 'relight'` ile ikinci sayfa
   (`mon:<id>:p2`) üretilirse `applyFacing` ve `setController` dokuyu oyuncuya göre seçer.
   `monsterTextureKey(id)` varsayılanı P1 olarak kalır. Shatter, cut-in yedeği ve kart resmi bu anahtara bağlı.
7. **Bellek ve açılış tahmini:** Canavar başına yaklaşık 40 ek kare (summon ~10, death ~10, revive ~8,
   special ~8, hitHeavy 4) bugünkü 436 kareyi kabaca ikiye katlar: ~19 MB. P2 relight ile ~38 MB.
   Ertelenmiş boyama süresi de 2–4 katına çıkar.
   - `finishSheet` ilk erişimde bütün sayfayı eşzamanlı boyuyor. Sayfa büyüyünce ilk çağırmada donma riski artıyor.
   - Öneriler: önce destedeki canavarları boyamak, animasyon bazında tembel boyama, gerekirse
     OffscreenCanvas işçisi.
   - v1 arena dokusundan sakin arenaya geçince açılan ~12 MB (bkz. §5) bu artışı büyük ölçüde karşılıyor.

---

## 3. Kesirli ölçek / zoom listesi

Kanıt: `shots/v3/a0/infra-perf/saWyrmAtk-zoom-crop.png`. Solda zoom 1,0, sağda 1,08 (t = 1320 ms).
Bölge çizgileri ve dither desenleri düzensiz piksel genişliğine bölünüyor. Bazı satırlar ve sütunlar
iki piksel oluyor. Tam kare film: `saWyrmAtk-full.png` (her 160 ms’de bir, tahta zoom ile büyüyor,
HUD sabit kalıyor).

**3.1 Kamera zoom’u (tek boğaz noktası).** `CameraRig.ts:49-56` (`focus`, 1–1,1 sıkıştırma) ve
`:86-103` (tween, `setZoom(o.z)` `:98`) üzerinden geçiyor. Çağıranlar (46 çağrı, 30 dosya):

- `_core/helpers.ts:274`
- `_defaults/battle.ts:70,150`
- `battle/battle.ts:73,114,121`
  - 114 ve 121: 70 ms’lik +0,02 “zoom vuruşu”
- `battle/declare.ts:63`
- `flow/end.ts:39,140`
- `flow/opening.ts:163`
- `spells/_kit.ts:599`
- `spells/dragon_blade.ts:260`
- `spells/judgment_bolt.ts:73`
- `spells/soul_recall.ts:316`
- `spells/volcano_arena.ts:249`
- `strikes-a/abyss_magus.ts:188,224,326`
- `strikes-a/coral_serpent.ts:210,228,281`
- `strikes-a/crystal_wyrm.ts:281,306`
- `strikes-a/ember_wolf.ts:148,277`
- `strikes-a/magma_titan.ts:228,327`
- `strikes-a/tide_golem.ts:136,210,245`
- `strikes-b/_kit.ts:384`
- `strikes-b/shade_assassin.ts:115`
- `strikes-b/storm_hawk.ts:243,259`
- `strikes-b/thorn_lurker.ts:591,606,624`
- `summon-a/abyss_magus.ts:250`
- `summon-a/coral_serpent.ts:173`
- `summon-a/crystal_wyrm.ts:245`
- `summon-a/magma_titan.ts:235`
- `summon-b/_kit.ts:499`
- `traps/_opening.ts:148`
- `traps/chains_of_light.ts:53`
- `traps/chasm_trap.ts:148`
- `traps/mirror_barrier.ts:57`

Zoom değerine göre dünya koordinatından ekran koordinatına çeviren kodlar otomatik uyum sağlar:
`strikes-b/_kit.ts:369`, `_core/helpers.ts:558`, `strikes-a/_kit.ts:168`, `HumanInput.ts:971`.

**Öneri (A1):** `focus()` varsayılan olarak yalnız tam sayı kaydırma yapsın. Zoom isteğini yok saysın
ya da `closeUp: true` ile **2× tam sayı** kesmeye çevirsin. 2× kesme tween’lenmez, kesme ya da silme
geçişiyle yapılır. Böylece 46 çağrı tek dosyada düzelir.

**3.2 Tuval ölçeği:** `main.ts:37-40` `fitZoom()` pencere 640×360’tan büyükse tam sayı, **küçükse kesirli**
ölçek veriyor. Pencere 640×360 altında bilinçli bir taviz.

**3.3 Canavar sprite’ında kesirli ölçek (squash/stretch, 28 satır):**

- `vfx/combat.ts:2330` (`lunge` hazırlık/hamle)
- `vfx/setpieces.ts:2773,2787` (sarmaşık sıkması hedefi)
- `_defaults/battle.ts:68`
- `battle/declare.ts:76,198`
- `traps/chains_of_light.ts:63,68`
- `spells/soul_recall.ts:170` (hayalet kopya)
- `summon-a/crystal_wyrm.ts:286`, `summon-a/ember_wolf.ts:193`, `summon-a/magma_titan.ts:293` (iniş titreşimi)
- `summon-b/position.ts:29,44`
- `summon-b/flip.ts:97`
- `summon-b/storm_hawk.ts:250`
- `strikes-a/abyss_magus.ts:532`
- `strikes-a/crystal_wyrm.ts:288,304`
- `strikes-a/tide_golem.ts:349`
- `strikes-a/ember_wolf.ts:142`
- `strikes-a/magma_titan.ts:220`
- `strikes-a/coral_serpent.ts:345`
- `strikes-b/stone_sentinel.ts:224`
- `strikes-b/shade_assassin.ts:193`
- `strikes-b/storm_hawk.ts:196,218,391`
- `strikes-b/thorn_lurker.ts:538,550,554,670`

Kopya / iz görüntüleri (afterimage), sprite’ın kesirli ölçeğini taşıyor:

- `strikes-a/_kit.ts:244,249,506,507,582,664`
- `vfx/shatter.ts:125,126,192`
- `vfx/setpieces.ts:722`
- `MonsterUnit.ts:167,179`
- `summon-a/_kit.ts:189`
- `strikes-b/_kit.ts:236`
- `summon-b/_kit.ts:236`

Hareket kuralı da “bütün sprite’ı ölçeklemek tek başına animasyon sayılmaz” diyor. Bunların yerini
çizilmiş squash/stretch kareleri almalı.

**3.4 Canavar sprite’ında döndürme (13 satır, piksel ızgarasını bozar):**

- `strikes-b/storm_hawk.ts:218,318,327,337,342,380,423`
- `strikes-b/thorn_lurker.ts:671`
- `strikes-a/ember_wolf.ts:216`
- `strikes-a/magma_titan.ts:245`
- `vfx/combat.ts:2908,2928`

Toplam 37 `setAngle` / `setRotation` çağrısı var. Geri kalanları efekt ve kart üzerinde.

**3.5 Kart, karo ve arayüzde kesirli ölçek:**

- **Kartlar:**
  - `CardSprite.flyTo` ölçekleri: `_core/helpers.ts:133,159,162,168,322,364,387,395,402`,
    `spells/_kit.ts:438,443,450,553,592,638,643,644,656,666`, `flow/discard.ts:36,49,67`,
    `HandView.ts:293,296,304`, `summon-a/tribute.ts:103`
  - `scaleX` ile kart çevirme: `CardSprite.ts:500-516` (0,045’e kadar)
  - `flow/draw.ts:56-57` (iç kart `scaleY` 0,35 → 1)
- **Karolar:** `TileCard.ts:399-401,703,710,846,862`, `strikes-a/abyss_magus.ts:149,446`
- **Rozet ve sayılar:**
  - `StatBadge.ts:112-152` (0,2 → 1,35 → 1)
  - `vfx/numbers.ts:172,249` (hasar sayısı patlaması)
- **Afiş harfleri:** `vfx/banners.ts:203,333,375,448,450,469,492`. Cut-in başlığı: `vfx/cutin.ts:421-433`.
  Cut-in portresinin kendisi tam sayı ölçekli (`cutin.ts:252`) ✓.
- **Para atma:** `flow/opening.ts:181-266`, `_defaults/flow.ts:49-73`
- **Kalkan / ayna:** `traps/_mirror.ts:268,272`, `vfx/setpieces.ts:3236,3239`

**3.6 Yumuşak parıltı dokularının kesirli ölçeği** (v3 “düz ton bandı” hedefiyle çelişir, ama sprite değil):

- `AK.glow`: `_core/helpers.ts:331,363,376,413`, `summon-a/_kit.ts:210,217`, `strikes-a/_kit.ts:130,139`,
  `spells/_kit.ts:385,560,561,627`, `strikes-a/*` içinde halo/heart (örn. `abyss_magus.ts:99,345`,
  `crystal_wyrm.ts:76,99,404`, `tide_golem.ts:109,235`, `magma_titan.ts:341`), `BoardView.ts:737,1283`
- Işık katmanı: `LightLayer.ts:498,710,850,871`, `board-v2/*`

Ek not: Tween’lerle taşınan sprite konumları çoğu yerde kesirli (örn. `battle/declare.ts:76`). Kamera
`roundPixels` ile render sırasında yuvarladığı için zoom 1’de sorun çıkmıyor. Kesirli zoom’da ise
titreşime katkı yapıyor.

---

## 4. Zaman ve temizlik

### 4.1 Saatler

| Saat | Kaynak | Hız / hit-stop izliyor mu? |
|---|---|---|
| Phaser TweenManager | `Date.now()`, `tweens.timeScale` | evet (`setSpeed`, `core.ts:90-94`) |
| Sahne saati (`scene.time`) | döngü deltası × `time.timeScale` | evet |
| Sprite animasyonları | `anims.globalTimeScale` | evet |
| Özel kare saatleri | `combat.ts:82` (`onFrame/animate/sleep`, delta 50 ms ile kırpılmış), `particles.ts:76,635-657`, `setpieces.ts:139`, `BoardView.ts:1102`, `BoardViewV2.ts:928`, `LightLayer.ts:1128`, `HudView.ts:1445`, `InspectPanel.ts:366,837`, `Prompt.ts:263,770`, `strikes-b/lumen_sprite.ts:82` | evet (timeScale ile çarpılıyor) |
| `realWait`, `stopTime` geri sayımı, Director watchdog | ölçeksiz döngü deltası | hayır (bilinçli) |
| **Kamera sarsıntısı** | Phaser kamera efekti, gerçek ms (`core.ts:58-64`) | **hayır.** 3×’te sarsıntı aksiyona göre 3 kat uzun sürüyor, hit-stop sırasında da sürüyor |
| **Hologram `uTime`** | `game.loop.time` (`hologram.ts:299`) | **hayır.** Tarama çizgisi ve glitch hit-stop’ta donmuyor, hızlandırmada hızlanmıyor |
| Müzik / ses | AudioContext, `music.ts` 25 ms `setInterval` ile ileriye bakış | hayır. Hızlandırma müziği etkilemiyor (makul) |

- **Hit-stop iki uygulama olarak duruyor:**
  - `core.hitStop` (`core.ts:76-87`): iç içe kullanıma güvenli değil. İkinci çağrı 0 değerini kaydedip
    geri yükleyebilir. Şu an yalnız `summon.ts:169-170` korumayla çağırıyor.
  - `combat.stopTime` (`combat.ts:157-194`): iç içe güvenli. Ama donmuş bir saat içinde başlarsa 1×’e
    geri yüklüyor. Hızlandırmayı `SpeedControl` bir sonraki `PRE_UPDATE`’te yeniden uyguluyor
    (`speed.ts:89-94`), yani bir karelik hız sapması var.
  - A1’de bunlar tek bir “gösteri saati” modülünde birleşmeli: hız, hit-stop, duraklatma ve ağır çekim
    (`SpeedControl.slowMo`) birlikte. Sarsıntı ve hologram zamanı da bu saate bağlanmalı.
- **Duraklatma yok:** Esc / ≡ menüsü (`HumanInput.ts:280-327`) sinematik sırasında (`mode 'off'`) açılıyor
  ama zamanı durdurmuyor, sinematik menünün arkasında sürüyor. Plan §3’teki tek saatli duraklatma
  bugün mevcut değil.
- **Gizli sekmeden dönüş** (`tabreturn.json`; öykünme: `visibilitychange` gönderildi ve RAF 5 sn tutuldu):
  - Gizliyken 1 kare (zaten kuyrukta olan), sonra hiç kare yok. Sinematik duruyor.
  - Dönüşte biriken zaman topluca tetiklenmiyor:
    - `TimeStep.resume → resetDelta`
    - `TweenManager.getDelta` gecikme yumuşatma (`TweenManager.js:643-662`, 500 ms üstü boşlukta 33 ms adım)
    - bizim saatlerde 50 ms kırpma
  - Hata yok, olay sırası aynı (`tribute → summon`).
  - **Ancak** Phaser dönüşten sonra 120 kare boyunca (`panicMax`) ve pencere odakta değilken
    (`!inFocus`) deltayı 16,7 ms’ye kırpıyor (`TimeStep.js:569-574`). Ölçümde dönüşten sonraki
    deltalar `15, 15, 15…` çıktı. 60 FPS’lik cihazda bu fark edilmez. 30 FPS’lik cihazda ise dönüşten
    sonra yaklaşık 4 sn boyunca ve **odak başka penceredeyken sürekli** oyun yarı hızda akar.
    Swiftshader’da (~10 FPS) aynı sahne 4,4 sn yerine 14,9 sn sürdü: 5 sn gizli + ~5,5 sn ağır çekim.
- **Düşük FPS genel olarak:** Bizim saatlerin 50 ms kırpması ve Phaser’ın 5 FPS altı kırpması
  nedeniyle 20 FPS’in altında oyun zamanı gerçek zamandan yavaş akıyor. Aynı tohum (seed 2) yük
  altında 222 sn, düşük yükte 130 sn sürdü.

### 4.2 Sahne kapanışında temizlik

- `restartDuel` (`DuelScene.ts:333-342`) ve Ana Menü yolu (`:323-328`) controller’ı durduruyor,
  saklı tutamaçları bırakıyor ve sahneyi yeniden başlatıyor.
- `Director.stop` SHUTDOWN’a bağlı. Durdurulan düellonun `play()` sözü hiç çözülmüyor
  (`Director.ts:96-103`). Böylece eski sinematik yeni düellonun görünümlerine dokunamıyor.
- Çalışma zamanı kodunda 63 SHUTDOWN kancası var. MonsterUnit, CameraRig, SpeedControl (window
  dinleyicileri dahil), BoardView ve LightLayer kendini temizliyor.
- Soak ölçümleri:
  - Oyun başı nesne sayısı sabit: 532 / 530 / 520 (1. koşu) ve 522 / 519 (2. koşu). Birikim yok.
  - Oyun sonunda tween 5–6, timer 3–5 (oyun sonu ekranı açık).
  - Doku sayısı 336 → 486 (3 oyun ve bir başlık ziyareti). Artış §1.1’deki tembel dokulardan geliyor
    ve başlık ekranına her dönüşte yeniden üretilenler var.
  - Oyun başı JS heap: 82,3 → 91,9 → 98,3 MB (1. koşu) ve 82,9 → 87,3 MB (2. koşu). Önbellek ısınması
    olabilir. Üç oyun sızıntı demek için az. A7’deki uzun oturum testinde `--repeat --snap` ile izlenmeli.
- Modül düzeyindeki rastgele sayı tohumları yeniden başlatmada sıfırlanmıyor:
  `MonsterUnit.ts:83`, `strikes-b/_kit.ts:85`, `summon-b/_kit.ts:72`, `flow/_kit.ts:48`,
  `battle/_kit.ts:47`, `LightLayer.ts:222`. Çekim belirleyiciliği yalnız “taze sayfa yüklemesi” için
  geçerli. Aynı sahne `restart` sonrası birebir aynı görüntüyü vermeyebilir. Bu, regresyon filmleri için önemli.

---

## 5. Sakin arenanın oyuna alınması

- **Uyum:** `src/still/arena.ts` v1 geometrisini kullanıyor. `zoneXY`, `isoToScreen` ve `cellKind`
  `layout.ts`’ten geliyor. Slab ve gövde ölçüleri `arena-geom.ts`’te `art/arena.ts`’ten değer değer
  kopyalanmış. Yani `layout.ts` değişmeden kalır.
- **Maliyet:** `drawArena` 640×360’ı Node’da 25 ms’de çiziyor (ilk çağrı 82 ms). Bugünkü v1 arena
  açılışta 661 ms ve 15,1 MB tutuyor. Tek 640×360 statik görüntü 0,88 MB. Bölge maskeleri ve ışık
  basamakları dahil 3–4 MB tahmin ediliyor.
- **Önerilen yol (A1):**
  1. **Görünüm anahtarı:** `?look=v3` veya `globalThis.__NEON_LOOK`. Arena varyantından ayrı tutulmalı
     ve v1 geometrisini zorlamalı. Plan §3 “yeni görünüm tek anahtarla açılır” diyor.
  2. **Boot adımı:** `15-arena.ts` v3 açıkken sakin dokuları üretir:
     - `calm:bg`: `drawBackground`, yani gökyüzü + stadyum + zemin diski.
     - `calm:slab`: gövde + yan yüzler + üst yüz.
     - `calm:pad:<p>:<spot>:<i>`: 20 bölgenin maskeleri. `topAt` ile `kind === 'pad' | 'pile'` olan
       pikseller. `highlightZone`, `flashTile` ve `tileImage` için gerekli.
     - `calm:trim:<p>`: taraf başına neon şerit maskesi. `setActivePlayer` ve `pulseSide` için gerekli.
     - **Işık basamakları:** her bölge × ışık rengi (cyan, mor, ateş, su…) için bir ton yukarı
       kaydırılmış ped. Bu, `still/scene.ts:36-103`’teki LUT yaklaşımı.
  3. **Görünüm:** `src/view/board-calm/BoardViewCalm.ts`. `BoardView`’daki v2 delegasyon kalıbının
     (`BoardView.ts:266-269`, her public metotta `if (this.v2) return this.v2…`) üçüncü kolu olur.
     - Uygulanması gereken API: `zoneAt` (v1 mantığı aynen), `tileImage`, `highlightZone`,
       `clearHighlights`, `flashTile`, `pulseSide`, `setActivePlayer`, `setTheme('volcano')`
       (sakin lav: ped üzerinde ton basamaklı çatlaklar), `setLights` (açılış), `setTurn`, `destroy`.
     - `crowd` ve `scoreFlash` zaten v1’de etkisiz.
     - Kullanım sayıları: `setTheme` 5, `setLights` 5, `setActivePlayer` 5, `highlightZone` 4,
       `pulseSide` 2, `clearHighlights` 2, `zoneAt` 1, `flashTile` 1. Ayrıca `HumanInput.ts:665,716,948,991`.
     - Ortam hareketi “sakin” olmalı: yavaş trim parıltısı ve birkaç toz zerresi. Sahne zamanı ×
       timeScale ile çalışmalı.
  4. **Bağımlılık:** Dört sinematik kit v1 arena anahtarlarını doğrudan alıyor
     (`import { AK } from '../../art/arena'`: `_core/helpers.ts:33`, `spells/_kit.ts:31`,
     `summon-a/_kit.ts:24`, `strikes-a/_kit.ts:13`; özellikle `AK.glow`, `AK.mote`). Bu ortak efekt
     dokuları v1 arena üreticisinden ayrılıp her görünümde üretilmeli. Aksi halde v3’te ya eksik doku
     çıkar ya da 661 ms’lik v1 üreticisi boşuna çalışır.
  5. **Işık:** v2’nin yumuşak `LightLayer`’ı v3’te ya kapalı kalmalı ya da “basamaklı” moda alınmalı:
     ped maskesi içinde tek ton kaydırma, geçişte 2–3 dither karesi, alfa karışımı yok. Saldırı ve
     çağırmadaki kısa yerel aydınlatma da aynı basamak dilinde olmalı.
  6. **Arayüz:** Sabit görselde HUD yok. v3’te v1 HUD’u mu, `hudv2` mi kullanılacağına karar
     verilmeli. HUD ayrı kamerada olduğu için arena değişikliğinden etkilenmiyor.

---

## 6. Ölçümler

### 6.1 Açılış

| Ölçüm | Geliştirme sunucusu | Üretim derlemesi (`vite build` → preview) |
|---|---|---|
| Başlık ekranı etkileşime hazır | 2,39 / 3,35 sn | **2,05 / 2,16 sn** |
| Düello sahnesi aktif (`skipIntro`) | 2,25 sn | 1,88 / 1,95 sn |
| En uzun görev (BootScene.create eşzamanlı) | 0,94–1,09 sn (düşük yük), 1,50–1,55 sn (yük 5–8) | 0,91–1,06 sn |
| JS heap (açılış + 8 sn, GC sonrası) | 79–91 MB | **48 MB** |
| Doku sayısı / MB (`?test` olmadan) | 336–349 / 33,2–35,3 MB | aynı |
| Açılış CPU profili (yük 5–8) | BootScene.create 1259 ms: arena 661, kartlar 446, DuelScene.create 350, PixelCanvas öz süresi 1,9 sn (ertelenmiş boyama dahil) | — |

Açılış sinematiği (oyun zamanı, hız 1): `gameStart` 5,33 sn + `turnStart` 1,17 sn = **6,75 sn**.
`skipIntro` ile 2,75 sn (`opening.txt`).

### 6.2 Soak (demo, hız 3; ilk oyun açılışla)

| Koşu / oyun | Yük | Kare | Ort. JS/kare (update + render) | Maks | >16,7 / >33 / >50 / >100 ms | Oyun başı → sonu nesne | Doku (MB) | Heap MB |
|---|---|---|---|---|---|---|---|---|
| 1 / 0 (seed 1, açılış) | 13–21 | 466 | 5,09 (2,50 + 2,54) | 40,0 | 12 / 2 / 0 / 0 | 532 → 560 | 383 (34,4) | 82,3 → 89,1 |
| 1 / 1 (seed 2, başlık üzerinden) | 13–21 | 1590 | 5,84 (2,96 + 2,85) | 79,4 | 45 / 12 / 3 / 0 | 530 → 846 | 482 (40,1) | 91,9 → 106,3 |
| 1 / 2 (seed 3, açılış) | 13–21 | 666 | 6,33 (3,26 + 3,03) | 105 | 35 / 8 / 3 / 1 | 520 → 651 | 486 (40,2) | 98,3 → 105,3 |
| 2 / 0 (seed 1, açılış) | 3–6 | 544 | **4,04** (2,01 + 1,99) | 22,5 | — / 0 / 0 / 0 | 522 → 559 | 383 (34,4) | 82,9 → 89,0 |
| 2 / 1 (seed 2) | 3–6 | 1756 | **4,54** (2,35 + 2,16) | 36,9 | — / 2+ / 0 / 0 | 519 → 691 | 432 (36,7) | 87,3 → 101,8 |

- Düşük yükte JS bütçesi rahat: ortalama 4–4,5 ms/kare. Ekran hızını yazılımsal GPU belirliyor
  (13–20 FPS). Hata, watchdog aşımı ve takılma yok.
- **Sıçramalar ve hangi olayda geldikleri** (yalnız yük altındaki 1. koşuda, >50 ms):

| ms | update | render | olay | not |
|---|---|---|---|---|
| 105 | 94,3 | 10,7 | destroy (oyun 2, tur 2) | update tarafı: ilk ölüm `shatter:<id>` dokusu (97–438 kare) adayı |
| 79,4 | 72,7 | 6,7 | phaseChange (oyun 1, tur 25) | update tarafı |
| 77,3 | 9,1 | 68,1 | summon (oyun 1, tur 14) | render: yeni PostFX/doku yüklemesi adayı |
| 72,5 | 0,5 | 71,9 | lpGain (oyun 2, tur 1) | render |
| 64,2 | 4,8 | 59,3 | gameOver (oyun 1) | render |
| 63,1 | 52,9 | 10,2 | summon (oyun 2, tur 3) | update: `finishSheet` / ilk kullanım dokusu adayı |

  Yük altında bunlar kesin olarak koda bağlanamıyor. Düşük yükte >50 ms sıçrama görülmedi.
  A7’de gerçek tarayıcıda `--profile` ile tekrar bakılmalı.
- Olay başına gerçek süre (1. koşu, `evTimes`, ms): `activate`, `phaseChange`, `destroy`, `turnStart`
  ve `battle` en çok zaman alan olaylar. Bu, §7’deki süre bütçesi aşımlarıyla uyumlu.

---

## 7. Süre bütçesi karşılaştırması

Ölçümler oyun zamanında, hız 1’de (`durations.json`). Toplam süre, eylemin (dispatch) başından
sinematiğin bitip görünümlerin eşitlenmesine kadar ölçüldü. Parantez içi değerler olay kırılımı
(olayın başlangıcından bir sonrakine).

| Olay | Bütçe (plan §5) | Ölçülen | Durum |
|---|---|---|---|
| Kart çekme | 0,3–0,5 sn | `draw` 0,37 sn | ✓ |
| Kapalı koyma | 0,4 sn | `setMonster` 0,77, `setSpellTrap` 0,77 sn | ✗ ~2× |
| Pozisyon değişimi | 0,4 sn | savunmaya 0,65, saldırıya (roar ile) 1,10 sn | ✗ |
| Çevirme | 0,6 sn | çevirme çağrısı 1,00 sn. Saldırıya uğrayıp açılma 0,58 sn | ✗ / ✓ |
| Normal çağırma | 1,2–1,6 sn | 1,27–1,58 sn (6 canavar ve P2). Işık Perisi + 500 LP: 3,32 sn (summon 1,42 + etki 1,22 + lpGain 0,67) | ✓ (etki ayrı) |
| Kurbanlı çağırma | 2,5–3,0 sn | Ejder 3,73–3,78 (tribute 1,13 + summon 2,58–2,63). Büyücü 4,15 + hedef seçimi sonrası etki 2,65. Titan 5,73–5,75 (+ etki 1,4 + hasar 0,67) | ✗ (çağırma kısmı ~2,6 içinde, kurban 1,1 sn ekliyor) |
| Diriltme | ~2,0 sn | 3,02–3,12 sn (büyü 1,82 + summon 1,18–1,28) | ✗ |
| Saldırı (canavara) | 1,6–2,2 sn | **3,13–5,08 sn** (12 canavar). Kırılım: ilan 0,55 + battle 0,65–1,33 + damage 0,07 + **destroy 1,6–2,4**. Kor Kurdu + yakma: 5,08 | ✗ 1,5–2,3× |
| Doğrudan saldırı | ~1,6 sn | **2,80–3,25 sn** (ilan 0,55 + battle 0,62–1,25 + damage/LP 1,4–1,85) | ✗ ~2× |
| Bitirici saldırı | ≤ 3,5 sn | saldırı kısmı 3,13 / 3,63 sn, ardından gameOver | ✓ / sınırda |
| Büyü | 1,2–2,0 sn | 2,32–2,47 sn (açılış 1,03–1,62 + etki 0,83–1,28) | ✗ biraz fazla |
| Tuzak | 1,5–2,0 sn | Ayna Kalkanı 5,03 (açılış 2,07 + yok etme 2,75). Işık Zincirleri: tuzak kısmı 2,97 (açılış 1,97 + geçersiz kılma 0,95) + sıra değişimi. Yer Yarığı 4,22 (0,77 + yok etme 3,25). Karar ipucu 0,32 | ✗ 2–2,5× |
| LP değişimi | ~0,4 sn | `lpGain` 0,67–0,83 sn. Savaş hasarı olayı 0,07 sn (LP sayacı arkada akıyor) | ~ / ✗ |
| Aşama geçişi | 0,3 sn | end / draw / main 0,15–0,18 sn ✓. **Savaş Aşamasına giriş 1,22 sn** ✗ | karışık |
| Sıra başlangıcı | 0,6 sn | `turnStart` 1,17 sn | ✗ ~2× |
| Oyun sonu | 3–4 sn | `gameOver` 3,27–3,47 sn. Deste bitince önce `deckOut` 2,63 sn | ✓ |
| Atma (bütçede yok) | — | 0,98 sn | — |
| Açılış (bütçede yok) | — | 6,75 sn (`skipIntro` 2,75) | — |

**Yorum:** Saldırı ailesindeki fazla sürenin büyük kısmı “ölüm + kartın mezarlığa gidişi”nden geliyor
(1,6–2,4 sn), bir kısmı da sabit 0,55 sn’lik saldırı ilanından. Bütçeye inmek için ölüm karaktere özgü
ve kısa yapılmalı (plan §4), kart uçuşu ölüm sonuna bindirilmeli, ilan kısaltılmalı. Tuzaklarda ortak
açılış (`traps/_opening.ts`) tek başına ~2 sn ve bütçenin tamamını tüketiyor.

Bu süreler 60 FPS’lik cihazda gerçek zamana birebir karşılık gelir. 20 FPS’in altında 50 ms kırpma
nedeniyle uzarlar (§4.1).

---

## 8. Riskler

| # | Risk | Kanıt | Öncelik |
|---|---|---|---|
| R1 | Saldırı, tuzak, kurban, diriltme ve küçük olaylar bütçenin 1,5–3 katı. Yeni pozlar eklendikçe süre daha da uzayabilir | §7, `durations.json` | **yüksek** |
| R2 | P2 ışığı: tek sayfa + `flipX` yüzünden “ekranda sol üst ışık” kuralı P2’de bozuluyor. Çözüm ikinci sayfa ise canavar dokusu ×2 | `still/magus-map.ts:6-8`, `MonsterUnit.ts:691-695` | **yüksek** (A2’den önce karar) |
| R3 | Kesirli kamera zoom’u 46 çağrıda. Kesirli sprite ölçek/döndürme 41 satırda. Zoom tek dosyada düzelir, sprite deformasyonları kartlara dağılmış | §3, `saWyrmAtk-zoom-crop.png` | **yüksek** (zoom A1), orta (sprite, A2–A4) |
| R4 | Kare süreleri `fps`’ten türetiliyor: 37 satır ve 5 kopya poz yardımcısı var. Kare başına bekleme gelince bu satırların hepsi elden geçmeli, yoksa darbe zamanlaması kayar | §1.3 | **yüksek** (A1) |
| R5 | Tek gösteri saati yok: sarsıntı ve hologram saat dışı, iki hit-stop uygulaması var, duraklatma yok | §4.1 | orta |
| R6 | İlk kullanımda doku üretimi (shatter, ui:panel…) ve `finishSheet`’in eşzamanlı boyaması. Yeni kareler sayfaları büyütünce ilk çağırmada donma riski artar | §1.1, §6.2 | orta |
| R7 | Bellek: canavar sayfaları 9,3 MB’tan ~19 MB’a, relight ile ~38 MB’a çıkar. Sakin arenaya geçiş ~12 MB kazandırır | §1.1, §2.7, §5 | orta |
| R8 | Sinematik kitleri v1 arena anahtarlarına (`AK.glow`, `AK.mote`) doğrudan bağlı. Sakin arena bunları üretmezse eksik doku çıkar | §5.4 | orta |
| R9 | Phaser odak dışı / dönüş kırpması: 60 FPS altındaki cihazda odak başka penceredeyken oyun yavaşlıyor | §4.1, `tabreturn.json` | düşük–orta |
| R10 | Modül düzeyindeki tohumlar yeniden başlatmada sıfırlanmıyor. Restart sonrası filmler birebir aynı değil | §4.2 | düşük |
| R11 | Ölçüm ortamı: swiftshader + paylaşılan CPU. Kare hızı, sıçramalar ve 60 FPS burada doğrulanamaz. Gerçek tarayıcıda (A7) tekrar ölçülmeli | §0 | bilgi |
| R12 | Heap oyun başlarında 82 → 92 → 98 MB arttı (3 oyun). Sızıntı mı önbellek mi belirsiz | §4.2 | düşük (A7’de `--repeat --snap`) |

### Önerilen A1 sırası (bu ölçümlere göre)

1. `CameraRig.focus`: tam sayı kaydırma ve 2× kesme. Tek dosya, R3’ün yarısını kapatır.
2. Sözleşme eki ve doku hattı: `holds`, `marks`, `extraAnims`, `weight`, `points`, `p2`. Yanında
   MonsterUnit zamanlama yardımcıları ve tek `pose`/`playRange` (R4).
3. Görünüm anahtarı (`?look=v3`), `BoardViewCalm` ve ortak efekt dokularının v1 arenadan ayrılması (R8).
4. Gösteri saati modülü: hız, hit-stop, duraklatma; sarsıntı ve hologram zamanı dahil (R5).
5. P2 ışığı kararı ve relight denemesi: A2 dilimindeki iki canavarla (R2).
