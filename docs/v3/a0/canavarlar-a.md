# A0 — Canavar envanteri, Grup A

Kristal Ejder (`crystal_wyrm`), Uçurum Büyücüsü (`abyss_magus`), Magma Titanı (`magma_titan`),
Mercan Yılanı (`coral_serpent`), Kor Kurdu (`ember_wolf`), Gelgit Golemi (`tide_golem`).

Aşama: **A0, envanter ve ölçüm**. Kaynak kodda değişiklik yapılmadı. Bu belge her canavarın bugünkü
yaşam döngüsünü (çizim, çağırma, bekleme, savunma, saldırı, hasar, ölüm, kart etkisi, kart resmi ve
giriş portresi) ölçülmüş süreler ve çekim kanıtlarıyla listeler. Ölçütler: `docs/ANIMASYON_PLANI.md`
§4 hareket kuralları ve §5 süre bütçesi.

---

## 0. Yöntem ve kanıt dosyaları

**Çizim ölçümü.** Her karenin `MonsterArt.draw()` çıktısı Node.js üzerinde (vite-node) yeniden
çizildi: kare boyu, anim başına kare sayısı / fps, bütün karelerin birleşik sınır kutusu (kare
kenarına değen poz = kırpılma riski), ardışık kareler arasında değişen piksel oranı, tek seferlik
animlerin ilk / son karesinin `idle` kare 0'a göre farkı (anim geçişinde poz sıçraması).

**Süre ölçümü.** `tools/shot.mjs --eval` ile sayfaya bir ölçüm kancası takıldı: `Director.runEvent`
(olay başı / sonu), `sfx.play` (darbe sesleri = temas anı), `HudView.setLp` (LP akışının başı),
hasar sayısı kabı (derinlik `DEPTH.FX_TOP + 50 = 1150`) ilk göründüğü an, her birimin
anim / kare değişimi ve kameranın en büyük `zoom` değeri. Oyun saati dondurulup 1/60 sn adımlarla
ilerletildi: ölçüm CPU yükünden bağımsız ve tekrarlanabilir. Hepsi normal hızda (1×), varsayılan
arena (v1), aksi yazılmadıkça saldıran Oyuncu 1. Tablolardaki süreler **oyun saati, ms**.
"Temas" = ilk darbe sesi (`impactHeavy` / `impactLight` / `shieldBlock` / `directHit`) karesi.

**Ölçülmeyenler:** Oyuncu 2 (aynalı) sürümleri, `?arena=v2`, gerçek tarayıcıda kare süresi ve bellek
(başsız tarayıcı yazılım çiziciyle çalışıyor), Büyücü / Yılan / Kurt / Golem için Ruh Çağrısı (mekanizma
ejder ve titanla aynı, G10), `saMagusEffectField`, `saTitanEqual`, `saCoralBlocked`, `saWolfDef`,
`saGolemDef` senaryoları.

**Filmler ve çizim sayfaları** (hepsi `shots/v3/a0/monsters-a/`):

| Dosya | İçerik |
|---|---|
| `rig-<id>.png` | 2× çizim sayfası, satır sırası: idle, roar, attack, hit, guard (6 kare / satır, uzun animler alt satıra taşar; darbe karesi kırmızı çerçeveli, kırmızı nokta = `muzzle`) |
| `rig-<id>-portrait.png` | kart resmi penceresi (44×34) 6× |
| `diff-<id>-hit.png` | üst sıra: idle 0 → hit 0–3 → idle 0; alt sıra: kırmızı = önceki hücreye göre değişen piksel |
| `diff-wyrm-idle.png`, `diff-magus-attack.png` | aynı yöntemle idle / attack karşılaştırması |
| `su-wyrm.png`, `su-wyrm-reveal.png` | Kristal Ejder kurbanlı çağırma (160 ms aralık) ve ejderin göründüğü son 1,2 sn (50 ms, 2×) |
| `su-wolf.png`, `su-golem.png` | normal çağırmalar, 80 ms aralık |
| `sa-<kısa>-atk.png` | altı imza saldırısı, 550 ms'den itibaren 67 ms aralık (bildirim → temas → hasar sayısı) |
| `death-<kısa>.png` | altı ölüm, 100–120 ms aralık |
| `effect-magus.png`, `effect-titan.png`, `effect-wolf.png`, `effect-golem.png`, `effect-coral-pierce.png` | kart etkileri |
| `guard-position.png`, `revive-wyrm.png` | pozisyon değişimi; Ruh Çağrısı ile diriltme |
| `cutins-grid.png`, `cutin-wyrm-sheet.png`, `cardart.png` | giriş portreleri ve kart resimleri |

---

## 1. Grubun ortak bulguları

Bu maddeler altı canavarın hepsinde aynı; tablolarda tekrar edilmez, numarayla anılır (G1…G16).

| # | Bulgu | Kanıt | Öncelik |
|---|---|---|---|
| G1 | **Sözleşme beş animle sınırlı, kare başına bekleme yok.** `idle / roar / attack / hit / guard`, anim başına tek fps. Çağırma, ölüm, diriltme, etki, savunmaya geçiş, koşu pozu yok; sinematikler bunları `holdFrame` + bütün sprite'ı kaydırma / ölçekleme ile taklit ediyor. Altı canavarın hepsinde attack = 10 kare, darbe karesi = 5, roar = 10 kare @10 fps, hit = 4 kare @10 fps: ağırlık sınıfından bağımsız **tek şablon**. | `src/art/types.ts`; `holdFrame` sayısı: `strikes-a/ember_wolf.ts` 13, `magma_titan.ts` 10. Hazır örnek: `src/artlab/types.ts` `LabAnim { durations[], marks }` + kare başına `points()` | yüksek |
| G2 | **Kesirli ölçek ve döndürme** piksel dilini bozuyor (plan §1). Ezilme / uzama hep `setScale` ile: ejder 0,98/1,04 → 1,05/0,96; kurt koşuda 1,12/0,90; titan 1,04/0,96 ve 0,94/1,06; golem ölümünde 1,22/0,62; büyücü ölümünde 1,06/0,90; yılan ölümünde 0,96/1,07; pozisyon değişiminde herkes 1,07–1,08 / 0,86–0,88. Döndürme: titan 5°, kurt 14°. | `strikes-a/crystal_wyrm.ts:288,304`, `ember_wolf.ts:142,216`, `magma_titan.ts:220,245`, `tide_golem.ts:349`, `abyss_magus.ts:532`, `coral_serpent.ts:345`, `summon-b/position.ts` (`squash`) | yüksek |
| G3 | **Kesirli kamera yakınlaşması** her saldırı, etki ve kurbanlı çağırmada. Ölçülen en büyük `zoom`: kurbanlı çağırma 1,050; saldırı 1,070–1,080; etki 1,070. | ölçüm kancası, `src/duel/CameraRig.ts` `focus()` | yüksek (A1) |
| G4 | **Tek tip hasar tepkisi.** `hit` herkes için 4 kare / 400 ms; `power` 1–3 yalnızca kıvılcım, sarsıntı ve hit-stop'u büyütüyor, kareler aynı. Hafif / ağır, fiziksel / büyüsel ayrımı yok. Temas bölgesi önce tepki vermiyor: hit 0'da gövdenin tamamı birden değişiyor (idle 0'a göre değişen piksel: ejder %88, büyücü %106, titan %88, yılan %90, kurt %91, golem %99). Savunmadaki darbe ortak `MonsterUnit.guardHit`: guard karesi + beyaz flaş + 2–3 px bütün sprite itmesi + altıgen parıltı. | `diff-*-hit.png`; `src/duel/MonsterUnit.ts` `play()` (`power` yalnız guard yolunda), `src/cinematics/_core/helpers.ts` `hitReact` | yüksek |
| G5 | **Efekt, darbe alanın silüetini örtüyor.** Temas anında hedefin hit pozu patlamanın altında kalıyor; tepki okunmuyor. | `sa-wyrm-atk.png` #10–#13, `sa-titan-atk.png` #12–#15, `sa-magus-atk.png` #16–#18, `sa-coral-atk.png` #9–#11 | yüksek |
| G6 | **Hasar sayısı temasla eş değil.** Canavara saldırıda sayı temastan sabit ~133 ms sonra çıkıyor (altısında da); bloklanan saldırıda geri hasar sayısı kalkana temastan ~234 ms sonra; saldıran kaybettiğinde sayı, saldırana gelen karşı darbeden **önce** çıkıyor (ejder 100, yılan 133, golem 183, büyücü 200, kurt 316 ms önce). Doğrudan saldırıda ve delici hasarda aynı kare (doğru). | `saWyrmAtk`, `saWyrmBlocked`, `saMagusBlocked`, `saCoralLose`, `saGolemBlocked`, `saWolfLose`, `saWyrmDirect`, `saCoralPierce` ölçümleri (tablolar) | yüksek |
| G7 | **`roar` her işe koşuluyor:** çağırma finali, savunma → saldırı, büyücünün hedef göstermesi (roar 3. karede donuyor), titanın göğüs vurması (çağırmada bir kez, etkide hemen ardından ikinci kez), kurdun uluması. Karakterin eylemi değişiyor, poz değişmiyor. | `strikes-a/abyss_magus.ts` etki: `u.play('roar', { hold: true })` + `holdFrame(u,'roar',3)`; `suTitan` ölçümü: roar 3167 ve 3683 ms | yüksek |
| G8 | **Anim geçişlerinde poz sıçraması.** Tek seferlik animler bekleme döngüsünün o anki karesinden doğrudan başlıyor (`sprite.play`). idle 0'a göre attack 0 farkı: ejder %26, büyücü %25, yılan %39; son kare → idle 0: ejder roar %35 / attack %36, büyücü %29 / %31, yılan %40 / %40, kurt hit %41, titan hit %38. Titan ve kurt `I0` ile çizilmiş, roar / attack geçişleri temiz (%0–3). Guard → roar ve idle → guard tek karede (tablolardaki savunma satırları). | çizim ölçümü (§0) | orta |
| G9 | **Kare kenarına değen pozlar** (kırpılma): büyücü attack x = 80 / 80 ve roar y = 0, yılan attack x = 80 / 80 (darbe karesinde burun sağ kenarda), golem roar 0..64 ve y = 0 (gayzerler üst kenarda), kurt roar / attack 0..63. | birleşik sınır kutusu; `rig-coral_serpent.png` attack 5, `rig-tide_golem.png` roar 4–5 | orta |
| G10 | **Diriltme = imza çağırmanın tekrarı.** Ruh Çağrısı hayaleti getiriyor, ardından canavarın kendi çağırma girişi (`hints { noCard, ghost }`) aynen oynuyor. Plan §4 ("diriltme normal çağırmanın aynısı değildir") ve §5 (~2,0 sn) ile çelişiyor. | `spells/soul_recall.ts` başlığı; `suRevive` 3067 ms, `revive` (titan) 3033 + 2067 ms | yüksek |
| G11 | **Süre bütçesi aşımları** (§5): kurbanlı as çağırma 3,67–3,78 sn (hedef 2,5–3,0); canavara saldırı + ölüm bildirim dahil 3,77–4,22 sn, savaş olayı tek başına 3,2–3,65 sn (hedef 1,6–2,2); doğrudan saldırı 2,23–2,93 sn (hedef ~1,6); savunma → saldırı 1,10 sn (hedef 0,4); ölüm olayı tek başına ~2,1 sn. Normal çağırmalar (1,57 sn) bütçede. | tablolar | yüksek |
| G12 | **Ölümde beden oynamıyor.** Her canavarın kendine özgü ölüm efekti var (iyi), ama gövde `hit` karesinde donuk kalıyor; işi maske, renk, ölçek ve parçacık yapıyor. Sonra ortak `shatterPx` + kartın mezarlığa uçuşu sırayla geliyor, arada ~0,4 sn boş sahne kalıyor. | `death-*.png`; `death-magus.png` #14–#16 boş; `strikes-a/_kit.ts` `flavoredDeath` | yüksek |
| G13 | **Saldırı sonrası toparlanma zayıf.** Yakın dövüşçüler (titan, kurt) hedefe bakarak **geri geri zıplayıp** dönüyor (dönüş, yürüme / koşu döngüsü yok); menzilliler (golem, büyücü) mermileri daha hedefe varmadan bekleme pozuna dönüyor. | `sa-titan-atk.png` #17–#23, `sa-wolf-atk.png` #14–#17, `sa-golem-atk.png` #9–#16 | orta |
| G14 | **Giriş portreleri ortak zaman çizelgesinde:** dört asın 200×144, 6 karelik portresi aynı diziyi oynuyor (f0 400 ms, f1 70, f2 70, f3 130, sonra f4 / f5 83 ms'lik ileri-geri döngü). İki karelik döngü titreşim gibi okunuyor; karaktere özgü ritim yok. Kor Kurdu ve Gelgit Golemi as değil, portreleri yok (doğru). | `src/art/cutins/index.ts` `cutinSequence`; `cutin-wyrm-sheet.png` | düşük |
| G15 | **Tam ekran flaşlar.** Plan §3 "aynı anda bütün ekran parlamaz" diyor; delici jet (`effect-coral-pierce.png` #10, 1300 ms), prizma ışını darbesi (`sa-wyrm-atk.png` #10–#11, ekran geneli parlama) ve cut-in çıkışı (`su-wyrm.png` #17) bütün ekranı beyazlatıyor. | `screenFlash` çağrıları (`strikes-a/_kit.ts`, `summon-a/_kit.ts`) | orta |
| G16 | **Işık katmanı varsayılan oyunda kapalı.** Sinematiklerdeki `lightPool / lightFlash / lightBeam` çağrıları v1'de etkisiz; zemine düşen ışık yalnız `?arena=v2`'de var. Filmlerde bu yüzden yok. Sakin arena (`src/still/`) oyuna henüz alınmadı. | `src/view/light/index.ts`; `cinematics/summon-a/_kit.ts` yorumu "(arena v2; every call is a no-op in v1)" | orta (A1) |

**Ortak bileşenler** (tablolarda kısaltmayla): `runSummon / Stage` (summon-a kiti: kart çarpması,
gizli birim, sihir çemberi, `climax()` = cut-in, `roar()`, `finale()`), `pixelStream` (kurban),
`cutIn` (`src/vfx/cutin.ts`), hologram (`src/vfx/hologram.ts`, alttan üste tarama), `registerStrike` +
`battle/battle.ts` (bildirim oku, kilit, `s.impact` → `hitReact` / `guardReact`, sayı, LP, ölüm
sırası), `beam / projectile / slash / bite` (`src/vfx/combat.ts`), `flavoredDeath` + `shatterPx` +
`cardToGraveyard`, `burnFly` (etki hasarı LP paneline), `summon-b/position.ts` (pozisyon değişimi),
`spells/soul_recall.ts` (diriltme).

---

## 2. Kristal Ejder (`crystal_wyrm`) — IŞIK, Svy 7, as, ağırlık önerisi: orta-ağır

Çizim: `src/art/monsters/crystal_wyrm.ts` (1483 satır). Saldırı / ölüm: `src/cinematics/strikes-a/crystal_wyrm.ts`.
Çağırma: `src/cinematics/summon-a/crystal_wyrm.ts`. Portre: `src/art/cutins/crystal_wyrm.ts`.

| Olay / kart | Mevcut animasyon (dosya) | Ölçülen süre | Zayıf / eksik (kanıt) | Ortak bileşen | Karta özgü kısım | v3 hedefi | Öncelik |
|---|---|---|---|---|---|---|---|
| Çizim ve rig | 96×96, çapa (50,91), hover 0; idle 12k@10, roar 10k@10, attack 10k@10 (darbe 5), hit 4k@10, guard 8k@6 döngü. Parametrik rig + "ertelenmiş" ışık hattı (parça başına normal, palete nicemleme, temas gölgesi). Bağımsız parçalar: baş, çene, boyun, iki kanat (3 açı + yelpaze), kuyruk fazı, enerji parıltısı. | idle 1,2 sn; roar 1,0; attack 1,0; hit 0,4; guard 1,33 sn | Ayaklar hiçbir animde oynamıyor (ayak bandında değişen piksel = 0): ağırlık aktarımı bacaklardan okunmuyor. roar / attack sol kenara değiyor (x = 0). Sonda idle 0'a dönüş farkı %35–36 (G8). | — | kristal / altın / cam malzemeleri, prizma parıltıları | A2 dilimi: yeni stil + sözleşme ekleriyle kare başına bekleme, bacak / kalça ağırlık aktarımı | yüksek |
| Bekleme (idle) | 12 kare nefes döngüsü | 1,2 sn döngü | Üst gövde, baş ve kanatlar birlikte 1 px kalkıp iniyor; kanatlar ayrı ritimde çırpmıyor, kuyruk küçük. Hareket "bütün üst gövde"; yüzeyde kaynama yok (iyi). `diff-wyrm-idle.png` | — | — | baş, kanat, kuyruk farklı periyotlarda; kanat zarı gecikmeli | orta |
| Kurbanlı çağırma + giriş portresi | `suWyrm`: kurban akışı (`pixelStream`), kart çarpması, altın çember, prizma sütunu, cut-in, ejder sütunda guard pozunda hologram olarak alttan üste kurulur, iner, roar 3'te gökkuşağı parlaması | kurban 0–1167; çağırma 1167–3800 (2633); cut-in ≈1480–2970; roar 3283; **toplam 3783 ms** | Bütçe 2,5–3,0 sn aşılıyor (G11). 3,8 sn'nin yalnız son ~0,5 sn'sinde ejder gerçek renkleriyle görünüyor; öncesi tek renk hologram + tarama + yatay gökkuşağı çizgisi bedeni kesiyor (`su-wyrm-reveal.png` #2–#17). "İniş" guard karesi tutulup sprite kaydırılarak yapılıyor; guard → roar geçişi beyaz flaşla örtülen tek kare sıçrama (#6–#8). | `runSummon`, `pixelStream`, `cutIn`, hologram, `finale` | prizma sütunu, gökkuşağı halkaları, mercek çizgisi | kanatlara sarılı iniş ve açılış **çizilmiş çağırma pozlarıyla**; hologram kısa, beden erken görünür; ≤3,0 sn | yüksek |
| Özel çağırma (Ruh Çağrısı) | `suRevive`: hayalet mezarlıktan süzülür, cyan sütun, ardından aynı "Prizma İnişi" girişi (cut-in yok) | büyü 0–1833; çağırma 1833–3083 (1250); **toplam 3067 ms** | G10: diriltme normal girişin kopyası; bütçe ~2,0 sn. İki sütun art arda: Ruh Çağrısı'nın cyan sütunu söner, hemen ardından girişin altın çemberi ve prizma sütunu yeniden açılır (`revive-wyrm.png` #0–#2 ve #6–#8). | `soul_recall.ts`, summon-a | — | ayrı diriltme dili: kırık kristallerin yeniden birleşmesi, ışığın geri dolması | yüksek |
| Yer Yarığı ile kesilen çağırma | `suChasm`: tam giriş oynar, sonra tuzak | çağırma 3700; tuzak 3983; toplam 8000 ms | Giriş tamamen oynayıp bitiyor, sonra yok ediliyor: çağırmanın "kesilmesi" okunmuyor (motor sırası; sunum tarafında kısaltma yok). | tuzak kiti | — | tuzak penceresi açılacaksa giriş kısaltılır / iniş anında kesilir (traps grubuyla) | orta |
| Savunma (guard) | 8k@6 döngü: kanatlar önde kalkan gibi kapalı, çömelmiş | döngü 1,33 sn; savunmada darbe (`saTitanP2Blocked`): temas 1333, geri hasar sayısı 1567, titanın geri sekmesi 1617, savaş 2067 | 8 karenin 4'ü neredeyse aynı (ardışık değişim %1–3), döngü 3 ve 7. karede sıçrıyor; idle → guard ve guard → roar tek karede (fark %104). Savunmada darbe: G4 ortak itme. | `summon-b/position.ts`, `guardHit` | kanat kalkanı silüeti | savunmaya geçiş / çıkış ara pozları, kanat zarı nefesi | orta |
| Saldırı "Prizma Nefesi" (ışın) | `registerStrike`: attack animi + şarj (ağza akan zerreler, ağız `CRYSTAL_WYRM_MOUTH` tablosuyla izleniyor), 5. karede kalın prizma ışını, geri tepme | `saWyrmAtk`: bildirim 0–550; attack 667; temas 1233; sayı 1367 (+134); hedefin ölümü 1433–3533; **savaş 3283, toplam 3850 ms**; zoom 1,07 | Hazırlık 500 ms boyunca beden neredeyse durağan (yalnız boyun 2 px); ağırlık bacaklara geçmiyor, geri tepme kesirli ölçek + kaydırma (G2). Işın kaynağı doğru (ağız). Bütçe aşımı (G11). | `beam`, `battle.ts`, `crystalBurst` | prizma ışını, kristal kırıkları, ışık çizgileri | çömelme + boyun S kıvrımı + kanat geriye → ileri atılma; ışın süresince göğüs / kanat titreşimi; ≤2,2 sn | yüksek |
| Doğrudan saldırı | aynı ışın düelloya | temas = sayı 1267; savaş 2550; toplam 3117 | Sayı temasla aynı karede (iyi). Bütçe ~1,6 sn aşılıyor. | `directHit` | — | kısa, düelloya odaklı | orta |
| Hasar (hit) | 4k@10: baş ve üst gövde geri | 400 ms | G4: hafif / ağır / büyüsel ayrımı yok; hit 0'da gövdenin %88'i birden değişiyor; dönüşte %30 sıçrama. `diff-crystal_wyrm-hit.png` | `hitReact`, `guardHit` | — | temas bölgesinden yayılan tepki; hafif / ağır ve fiziksel / büyüsel çiftleri | yüksek |
| Ölüm "kristal çatlaması" | `flavoredDeath`: hit 1. karede donar, gövdeden çatlaklar yayılır (piksel yolları), çatlaklardan ışık, ağır çekim, beyaz flaş, cam + piksel saçılması, kart mezarlığa | `saWyrmBlocked`: karşı darbe 1567; ölüm 1783–3883 (**2100 ms**) | Plan §4'teki "çatlak ve ışık kaybı" var (karta özgü, iyi). Ama beden ~600 ms donuk kalıyor, sendeleme / çöküş pozu yok; 1× ölçekte çatlaklar zor seçiliyor (`death-wyrm.png` #6–#9). Sayı (−700) karşı darbeden 100 ms önce (G6). | `flavoredDeath`, `shatterPx`, `cardToGraveyard` | çatlak yolları, kristal ışık sızması | çizilmiş çöküş pozları (diz, kanat düşüşü) + ışığın sönmesi; ölüm ≤1,4 sn | yüksek |
| Kart etkisi | yok (planla uyumlu); yerine giriş portresi | — | — | — | — | — | — |
| Kart resmi + giriş portresi | `portrait()` 44×34: altın zeminde baş yakın planı; cut-in 200×144, 6 kare: göz parlar, çene açılır, ağızda ışık topu | cut-in ≈1,5 sn (G14) | Portre ve kart resmi oyundaki sprite'tan daha detaylı / farklı stil (yüz çizgisi daha keskin); A5'te yeni stile geçecek. Döngü titreşimi (G14). `cutin-wyrm-sheet.png`, `cardart.png` | `cutIn` | portre çizimi | A5: yeni stil; kendi ritmi (nefes alma → kükreme) | düşük |
| Ağırlık sınıfı | orta-ağır | — | Zaman eğrileri büyücüyle aynı şablon (G1); ağırlık bacak ve kalçadan okunmuyor. Kısmen uyumlu. | — | — | A3 rehberinde orta-ağır eğrisi: uzun hazırlık, kısa bırakma, uzun toparlanma | orta |

---

## 3. Uçurum Büyücüsü (`abyss_magus`) — KARANLIK, Svy 6, as, ağırlık önerisi: süzülen büyücü

Çizim: `src/art/monsters/abyss_magus.ts`. Saldırı / etki / ölüm: `strikes-a/abyss_magus.ts`.
Çağırma: `summon-a/abyss_magus.ts`. Portre: `src/art/cutins/abyss_magus.ts`.

| Olay / kart | Mevcut animasyon (dosya) | Ölçülen süre | Zayıf / eksik (kanıt) | Ortak bileşen | Karta özgü kısım | v3 hedefi | Öncelik |
|---|---|---|---|---|---|---|---|
| Çizim ve rig | 80×80, çapa (39,77), hover 6; idle 8k@8, roar 10k@10, attack 10k@10 (darbe 5), hit 4k@10, guard 4k@5. Rig: miğfer + boynuzlar ve omuzluklar damga, pelerin / cüppe / kollar / asa şekilden; pelerin, yen, etek ve küre kendi gecikmeli parametreleriyle (ikincil hareket var). | idle 1,0; roar 1,0; attack 1,0; hit 0,4; guard 0,8 sn | Koyu mor beden koyu lacivert zeminde silüet olarak zor okunuyor (`sa-magus-atk.png`). attack sağ kenara (x = 80), roar üst kenara (y = 0) değiyor (G9). | — | cüppe, asa, küre, rünler | A2: yeni stil, okunur kenar ışığı, kenar payı | yüksek |
| Bekleme (idle) | 8 kare süzülme: küre ve etek salınımı | 1,0 sn döngü | Asa ve küre canlı; gövde / baş az. Süzülme yüksekliği sabit (hover 6), gölge değişmiyor. | — | küre nabzı | yavaş, gecikmeli süzülme; cüppe ucu dalga; nefes | orta |
| Kurbanlı çağırma + giriş portresi | `suMagus`: mor çember, zeminde boşluk yarığı, gölge dokunaçlar, cut-in, büyücü yarıktan yükselir (zemin çizgisinde kırpılmış hologram), roar 3'te yarık kapanır | kurban 0–1083; çağırma 1083–3717 (2633); etki kararı 3717–4167; **toplam 3717 ms** (+ etki) | Bütçe aşımı (G11). Yükselme tek poz + maske; büyücünün kendi "doğuş" pozu yok. | `runSummon`, `cutIn`, hologram | boşluk yarığı, dokunaçlar | yarıktan miğfer önce, cüppe açılarak yükselen çizilmiş pozlar; ≤3,0 sn | yüksek |
| Özel çağırma (Ruh Çağrısı) | ölçülmedi; aynı mekanizma (G10): hayalet + "Boşluk Yarığı" girişi | ≈3,0 sn (ejder / titanla aynı yapı) | G10 | `soul_recall.ts` | — | ayrı diriltme | yüksek |
| Savunma (guard) | 4k@5: asa çaprazda, önde kalkan yayı | 0,8 sn döngü | Ardışık kareler %56–62 değişiyor ama poz aynı; idle → guard fark %101 (tek kare). | `position.ts`, `guardHit` | asa kalkanı | asa / cüppe ile kapanan geçiş pozu | orta |
| Saldırı "Uçurum Küresi" (mermi) | asa geriye savrulur, küre büyür, rünler döner; 5. karede itiş, mor küre uçar; hedefte girdap içe çeker (230 ms), patlar | `saMagusAtk`: attack 667; temas 1617 (anim başından 950); sayı 1750 (+133); kurdun ölümü 1817–3900; **savaş 3650, toplam 4217**; zoom 1,08 | Hazırlıkta yalnız asa dönüyor: f1 → f2 arasında küre başın sağından soluna tek karede geçiyor (ara poz / iz yok), gövde ve kalça 0–4. karelerde neredeyse sabit (`diff-magus-attack.png`). Büyücü küre hedefe varmadan bekleme pozuna dönüyor (G13). Bütçe aşımı (G11). | `projectile('darkOrb')`, `battle.ts` | rünler, girdap, mor çatlaklar | gövde ağırlığı arka ayağa → asa yay çizer → cüppe gecikir; küre varınca asa hâlâ hedefi gösterir | yüksek |
| Doğrudan saldırı | küre düelloya | temas = sayı 1683; savaş 2933; toplam 3500 | Bütçe ~1,6 sn aşılıyor. | `directHit` | — | kısa | orta |
| Hasar (hit) | 4k@10: geri yaslanma | 400 ms | G4; hit 0'da %106 değişim; büyüsel / fiziksel ayrımı yok. `diff-abyss_magus-hit.png` | `hitReact` | — | cüppe ve asa gecikmeli; büyüsel darbede ruhsal sarsılma | yüksek |
| Ölüm "boşluğa çekilme" | altında boşluk havuzu, küre söner, koyu hologram batar (ölçekle ezilir) ve piksellere ayrılıp aşağı emilir | `saMagusBlocked`: karşı darbe 2067 (sayı 1867, 200 ms önce, G6); ölüm 2283–4383 (**2100**) | "Karanlık çözülme" var, **cüppe çökmesi yok**: beden hit karesinde batıyor, `setScale(1,06, 0,90)` (G2). Kartın uçuşundan önce ~0,4 sn boş sahne (`death-magus.png` #14–#16). | `flavoredDeath`, `shatterPx` | boşluk havuzu, sönen küre | cüppenin içine çöktüğü çizilmiş pozlar, asanın düşmesi; ≤1,4 sn | yüksek |
| Kart etkisi: kurbanla çağrılınca 1 büyü / tuzağı yok eder | `registerCardHook('effect')`: roar 3. karede donar (el kalkık, alev), hedefte kilit, zeminde gölge dokunaç kartın altına sürünür, dokunaçlar fışkırır, kart açılır, çatlar, yutulur | `saMagusEffect`: etki 4150–6800 (**2650**), kartın yok olduğu darbe 5650 (etki başından 1500); çağırma + karar + etki toplam **6800 ms** | Plan "asadan hedefli yok etme" diyor: asa hedefi **göstermiyor**, roar 3 pozunda ~1,5 sn donuk (G7, `effect-magus.png` #6–#20). Büyü bütçesi 1,2–2,0 sn aşılıyor. Dokunaç büyücünün altındaki havuzdan çıkıyor, asadan değil. | dokunaç (`tendril`), `crackCard` | dokunaç, kart çatlaması | asanın hedefe dönmesi, nişan, dokunaç / ışın asadan çıkar; ≤1,6 sn | yüksek |
| Kart resmi + giriş portresi | `portrait()` miğferli yakın plan; cut-in 6 kare (göz, el alevi) | G14 | Ortak zaman çizelgesi; portre ile sprite tutarlı. | `cutIn` | — | A5 | düşük |
| Ağırlık sınıfı | süzülen büyücü | — | Süzülme var ama saldırı / hasar zaman eğrileri ejderle aynı (10 fps şablon). Kısmen uyumlu. | — | — | yavaş giriş, ani bırakma, havada asılı toparlanma | orta |

---

## 4. Magma Titanı (`magma_titan`) — ATEŞ, Svy 5, as, ağırlık önerisi: ağır

Çizim: `src/art/monsters/magma_titan.ts`. Saldırı / etki / ölüm: `strikes-a/magma_titan.ts`.
Çağırma: `summon-a/magma_titan.ts`. Portre: `src/art/cutins/magma_titan.ts`.

| Olay / kart | Mevcut animasyon (dosya) | Ölçülen süre | Zayıf / eksik (kanıt) | Ortak bileşen | Karta özgü kısım | v3 hedefi | Öncelik |
|---|---|---|---|---|---|---|---|
| Çizim ve rig | 80×80, çapa (39,77); idle 8k@7, roar 10k@10, attack 10k@**12** (darbe 5), hit 4k@10, guard 4k@4. Rig: kollar ve bacaklar 2 kemikli IK zincirleri, kaya yüzeyler (aydınlık / orta / koyu), lav damarları poza bağlı nabız. `I0` ile tek seferlik animler idle 0'dan başlayıp ona dönüyor. | idle 1,14; roar 1,0; attack 0,83; hit 0,4; guard 1,0 sn | Ağır karakterin attack'ı ejderden **hızlı** (12 fps, 833 ms): ağırlık sınıfı zamanlamaya yansımamış (G1). | — | lav damarları, göğüs çekirdeği | ağır eğri, kare başına bekleme | yüksek |
| Bekleme (idle) | 8 kare nefes, çekirdek nabzı | 1,14 sn döngü | Neredeyse durağan; nefes 1 px, omuz kayaları oynamıyor. | — | çekirdek nabzı | ağır nefes: omuz kalkışı, lav damlası, buhar | orta |
| Kurbanlı çağırma + giriş portresi | `suTitan`: zemin yarılır, lav dolar, cut-in, titan lavdan fışkırır (kırpılmış), soğur, roar 4'te alev halkası, göğüs vurma | kurban 0–1083; çağırma 1083–3683 (2600); **etki 3683–5750 (2067)**; toplam 5750 ms | Çağırma tek başına 3,67 sn (G11); etkiyle 5,75 sn. Roar girişte bir kez, etkide hemen tekrar (G7). Fışkırma tek poz + maske. | `runSummon`, `cutIn`, `geyser` | lav yarığı | lavdan tırmanan çizilmiş pozlar; etkiyle birleşik ≤3,5 sn | yüksek |
| Özel çağırma (Ruh Çağrısı) | `revive`: rakibin Titan'ı diriltilir, aynı giriş + yanma etkisi | büyü 0–1833; çağırma 1833–3050 (1217); etki 3050–5117; toplam 5117 ms | G10; etki tekrar roar. | `soul_recall.ts` | — | ayrı diriltme (soğumuş kayanın yeniden kızarması) | yüksek |
| Çevirerek çağırma | `saTitanFlip`: çevirme + yanma | flip 1033; etki 2067; toplam 3117 ms | Çevirme bütçesi 0,6 sn; etki tekrarı. | `flip` (summon-b) | — | — | orta |
| Savunma (guard) | 4k@4: kollar göğüste çapraz | 1,0 sn döngü | 4 kare neredeyse aynı (%24–26 değişim, çoğu lav nabzı); geçiş tek kare. | `position.ts`, `guardHit` | — | ağır çömelme geçişi | orta |
| Saldırı "Lav Yumruğu" (yakın dövüş) | yükselip yere basar (sarsıntı), yumruk geride, ileri **kayar**, 5. karede yumruk, lav patlaması, geri zıplar | `saTitanAtk`: yere basma 917; adımlar 1200 / 1267; temas 1333; sayı 1467 (+134); yılanın ölümü 1533–3500 (1967); **savaş 3250, toplam 3817**. Bloklanınca (`saTitanBlocked`): temas 1333, sayı 1567, titanın ölümü 2100–4333 (2233), savaş 4083 | Yürüyüş yok: 3. / 4. kare tutulurken sprite kaydırılıyor, ayaklar kayıyor (`sa-titan-atk.png` #7–#10), sinüs zıplama + `setScale(1,04, 0,96)` + 5° döndürme (G2). Ağır titan eve **geri geri zıplıyor** (#17–#23, G13). Yılanın tepkisi lavın altında (G5). | `contactFeet`, `FloorMarks`, `battle.ts` | lav izi, magma damlaları | 2–3 çizilmiş ağır adım (ayak yere basınca toz), yumruğa kalça dönüşü, yavaş toparlanma, dönüp yürüyerek geri | yüksek |
| Doğrudan saldırı | sahayı koşarak geçer | `saTitanDirect`: temas = sayı 1400; savaş 2583; toplam 3150 | Aynı kayma sorunu; bütçe ~1,6 sn aşılıyor. | `directHit` | — | ağır koşu, ≤1,6 sn | orta |
| Hasar (hit) | 4k@10: kol savrulur, kaya parçaları | 400 ms | G4; dönüş %38 sıçrama. `diff-magma_titan-hit.png` | `hitReact` | kaya kırıntısı | ağır karakter az sarsılır, gecikmeli kaya düşmesi | yüksek |
| Ölüm "soğuyup çökme" | lav damarları yukarıdan aşağı söner, buhar, beden molozlara ayrılıp zıplar | `saTitanBlocked`: ölüm olayı 2100–4333 (**2233**); `death-titan.png`: soğuma 2440–2800, moloz 2920–3400 | Plan "alevin sönmesi" ile uyumlu, karta özgü (iyi); beden yine hit karesinde donuk, diz çökme / öne devrilme yok. | `flavoredDeath`, `shatterPx` | soğuma, moloz | çöküş pozları (diz, öne yıkılma) | orta |
| Kart etkisi: çağrılınca rakibe 500 | göğüs vurma (= roar tekrarı), çekirdek beyaz parlar, ateş topu yay çizerek LP paneline, −500 | `suTitan`: etki 2067 ms; hasar olayı 5083 (etki başından 1400) | Kaynak doğru (göğüs çekirdeği). Ama roar tekrarı (G7) ve süre: çağırmaya eklenince 5,75 sn. `effect-titan.png` #2–#7 | `burnFly('fireball')` | çekirdek parlaması | girişin finaliyle birleşen tek hareket (vent patlaması → ateş topu), ≤1,2 sn ek | yüksek |
| Kart resmi + giriş portresi | `portrait()`; cut-in 6 kare | G14 | Ortak zaman çizelgesi. | `cutIn` | — | A5 | düşük |
| Ağırlık sınıfı | ağır | — | **Uyumsuz:** en hızlı attack fps'lerinden biri, hop / zıplama ile yer değiştirme, hızlı geri dönüş. | — | — | yavaş hazırlık, yer sarsan adımlar, uzun toparlanma | yüksek |

---

## 5. Mercan Yılanı (`coral_serpent`) — SU, Svy 5, as, ağırlık önerisi: orta

Çizim: `src/art/monsters/coral_serpent.ts`. Saldırı / delme / ölüm: `strikes-a/coral_serpent.ts`.
Çağırma: `summon-a/coral_serpent.ts`. Portre: `src/art/cutins/coral_serpent.ts`.

| Olay / kart | Mevcut animasyon (dosya) | Ölçülen süre | Zayıf / eksik (kanıt) | Ortak bileşen | Karta özgü kısım | v3 hedefi | Öncelik |
|---|---|---|---|---|---|---|---|
| Çizim ve rig | 80×80, çapa (30,76); idle 8k@8, roar 10k@10, attack 10k@12 (darbe 5), hit 4k@10, guard 4k@4. Rig: tek omurga z-tamponlu tüp (silindirik ışık, karın plakaları), sırt yüzgeci, mercan taç, menteşeli çene. | idle 1,0; roar 1,0; attack 0,83; hit 0,4; guard 1,0 | 1× ölçekte gövde düz mavi bir hortum gibi okunuyor (pul / ton bandı seçilmiyor). Darbe karesinde burun sağ kenarda (x = 80, G9). Son kare → idle %40 sıçrama (G8). | — | mercan taç, fotofor noktaları | daha okunur pul ritmi, kenar payı | orta |
| Bekleme (idle) | 8 kare salınım, damlalar | 1,0 sn | Salınım küçük; kuyruk ucu ve taç az oynuyor. | — | damla | omurga boyunca dalga (baştan kuyruğa gecikmeli) | orta |
| Kurbanlı çağırma + giriş portresi | `suCoral`: havuz, girdap, cut-in, gayzer içinde yükselme, su şeridi gövdeye sarılır, roar 3'te su sütunları | kurban 0–1100; çağırma 1100–3683 (2583); **toplam 3667 ms** | G11. Yükselme maske ile; yılanın kendi kıvrılma pozları yok. | `runSummon`, `geyser`, `cutIn` | girdap, su sarmalı | halkalardan açılarak yükselen çizilmiş pozlar | yüksek |
| Özel çağırma | ölçülmedi; aynı mekanizma (G10) | ≈3,0 sn | G10 | `soul_recall.ts` | — | ayrı diriltme | yüksek |
| Savunma (guard) | 4k@4: halkaya çekilmiş, baş içeride | 1,0 sn | Kareler %17–20 değişiyor (neredeyse sabit); geçiş tek kare (fark %83). | `position.ts` | — | halkaların sıkışma geçişi | orta |
| Saldırı "Gelgit Mızrağı" (ışın / jet) | boyun geri kıvrılır, su ağza spiral çıkar (1–3), baş ileri (4), 5'te dalgalı jet; çene açık nabız | `saCoralAtk`: attack 667; temas 1167 (anim başından 500); sayı 1300 (+133); kurdun ölümü 1367–3450 (2083); yılan idle'a 1867'de döner; **savaş 3200, toplam 3767** | Kıvrılma küçük, gövde halkaları ağırlığı taşımıyor; jet kaynağı doğru (ağız). Kurt beyaz flaş + su patlamasının altında (G5). | `jet`, `waterSplash`, `battle.ts` | dalgalı jet | S kıvrımı geri yay → ileri vuruş, jet sırasında geri tepme gövdede | yüksek |
| Delici hasar (kart etkisi) | `registerCardHook('attack')`: jet savunanı kırar, düelloya kadar delip geçer, hasar orada çıkar | `saCoralPierce`: savunana temas 1067; savunan kırılır 1233; düelloya temas = sayı 1367 (aynı kare, doğru); **savaş 2683, toplam 3250** | Yol okunur: jet savunanı geçip düelloya ulaşıyor (`effect-coral-pierce.png` #8–#13). Zayıf yanlar: 1300 ms'de tam ekran beyaz flaş (G15), savunanın kırılması jetin altında kalıyor (G5); yılanın bedeni jet boyunca durağan. | `battle.ts` yerine kendi `attack` kancası, `directHit` | delen jet | savunanı delip geçen tek, okunur yol; geri tepme gövdede | orta |
| Hasar (hit) | 4k@10 | 400 ms | G4 (%90). | `hitReact` | damla | — | yüksek |
| Ölüm "köpüğe dönüşme" | geri çekilir, gövde halkadan yukarı köpüğe döner, kabarcıklar, beyaz silüet, damla / piksel saçılması | `saCoralLose`: karşı darbe 1533 (sayı 1400, 133 ms önce, G6); ölüm 1750–3700 (**1950**); `death-coral.png`: köpük 1720–2200, saçılma 2320–2800, kart 3280–3520 | Karta özgü, okunur (iyi); beden hit karesinde, `setScale(0,96, 1,07)` (G2). | `flavoredDeath`, `shatterPx` | köpük | çöküp halkaya yığılma pozları | orta |
| Kart resmi + giriş portresi | `portrait()`; cut-in 6 kare (çene, göz) | G14 | Ortak zaman çizelgesi. | `cutIn` | — | A5 | düşük |
| Ağırlık sınıfı | orta | — | Zamanlama şablon (12 fps); yılan bedeninin dalga gecikmesi yok. Kısmen uyumlu. | — | — | omurga boyunca gecikmeli dalga | orta |

---

## 6. Kor Kurdu (`ember_wolf`) — ATEŞ, Svy 4, ağırlık önerisi: orta-hafif

Çizim: `src/art/monsters/ember_wolf.ts`. Saldırı / etki / ölüm: `strikes-a/ember_wolf.ts`.
Çağırma: `summon-a/ember_wolf.ts`. Portre: yok (as değil).

| Olay / kart | Mevcut animasyon (dosya) | Ölçülen süre | Zayıf / eksik (kanıt) | Ortak bileşen | Karta özgü kısım | v3 hedefi | Öncelik |
|---|---|---|---|---|---|---|---|
| Çizim ve rig | 64×64, çapa (29,59); idle 8k@8, roar 10k@10, attack 10k@12 (darbe 5), hit 4k@10, guard 4k@5. Anatomik rig: ön / arka bacak zincirleri pati hedeflerinden IK (patiler yerde sabit kalabiliyor), alevler ışık olarak (kontursuz, rüzgârla akan dilimler), `I0` başlangıç / dönüş. | idle 1,0; roar 1,0; attack 0,83; hit 0,4; guard 0,8 | Koşu / dörtnal döngüsü yok (sözleşmede yok, G1). hit sonu → idle %41 sıçrama. roar / attack kenara değiyor (0..63). | — | alev yele, kuyruk, patiler | koşu döngüsü, iniş pozu | yüksek |
| Bekleme (idle) | 8 kare, solunum + alev dalgası (dil sarkıyor) | 1,0 sn | Alevler canlı (iyi); gövde az. | — | alev | kulak / kuyruk ayrı ritim | düşük |
| Normal çağırma | `suWolf`: ateş halkası, alev hologramı halkada koşar (attack 4 / 5 kareleri 70 ms'de bir değişiyor), sıçrar, iner (attack 7), roar 4'te uluma | **olay 1567 ms** (roar 2050'de biter); bütçe içinde | "Koşu" iki karelik saldırı pozu salınımı + art görüntü; koşarken kurt turuncu bir leke (`su-wolf.png` #8–#11); iniş `setScale` ezilmesi (G2). | `runSummon` | ateş halkası, alev koşusu | çizilmiş dörtnal + iniş pozları | orta |
| Özel çağırma | ölçülmedi; aynı mekanizma (G10) | ≈3,0 sn | G10 | `soul_recall.ts` | — | ayrı diriltme | orta |
| Savunma (guard) | 4k@5: alçak, dişler görünür | 0,8 sn; `saWolfGuard` (saldırıya uğrayıp kazanma): perinin teması 1667, karşı darbe 1883, sayı 1983, uluma 3700, savaş 5283 | Geçiş tek kare (fark %107). Kazanan savunan **hiç kıpırdamıyor**: kurt 3700'e kadar bekleme döngüsünde, karşı darbe yalnız efekt (saldıranı ısırma / itme pozu yok). | `position.ts`, `guardHit` | — | çömelme geçişi | orta |
| Saldırı "Kor Dişi" (ısırma) | çömelir (1), toplanır (2), alevler parlar (3), 4'te alevli yayla atılır (art görüntüler, zeminde ateş izi), 5'te çene açık, 6'da kapanır; iner (7), eve zıplar | `saWolfAtk`: attack 1 pozu 667 (idle 3'ten doğrudan); temas 1133; sayı 1267 (+134); perinin ölümü 1333–2933 (1600); idle 1650; savaş (etki dahil) 4467, toplam 5033. Bloklanınca (`saWolfBlocked`): temas 1133, sayı 1367, savaş 1883 | Atılma = sprite kaydırma + `setScale(1,12, 0,90)` uzama (G2); bloklanınca 14° döndürme. Eve **geri geri** zıplıyor (#14–#17, G13). Isırma kaynağı ağız (iyi). | `bite`, `afterimages`, `FloorMarks`, `battle.ts` | ateş izi, alev patlaması | çizilmiş sıçrama yayı (kalkış–uçuş–ısırma–iniş), dönüp koşarak geri | yüksek |
| Doğrudan saldırı | sahayı koşarak düelloya | `saWolfDirect`: temas = sayı 1183; savaş 2233; toplam 2800 | Koşu döngüsü yok (iki kare + uzatma); bütçe aşımı. | `directHit` | — | dörtnal döngüsü, ≤1,6 sn | orta |
| Hasar (hit) | 4k@10: ön ayaklar kalkar | 400 ms | G4 (%91); dönüş sıçraması %41. `diff-ember_wolf-hit.png` | `hitReact` | — | — | yüksek |
| Ölüm "alevin sönmesi" | yelp, alevler uçlardan söner, köz düşer, duman, gözler kararır, kül renkli piksellere ayrılır | `saWolfLose`: karşı darbe 1683, ölüm 1900–4000 (**2100**); `death-wolf.png`: sönme 1980–2460, kül 2580–3060, kart ≈3540 | Plan "alevin sönmesi ve közler" ile uyumlu (iyi); beden hit karesinde donuk, yere yığılma yok. Sayı (−400) karşı darbeden 316 ms önce (1367 / 1683, G6). | `flavoredDeath`, `shatterPx` | sönen alev | yığılma pozları | orta |
| Kart etkisi: savaşta yok edince 300 | uluma (roar 3–6), zeminde alev halkası, yeleden kopan alev ruhu LP paneline, −300 | `saWolfAtk`: etki 2933–4717 (**1783**); −300 4100'de, ısırmadan **2967 ms** sonra | Ölüm + kartın mezarlığa uçuşu bitene kadar kurt bekliyor; uluma ancak ~1,8 sn sonra başlıyor, "zafer sonrası ek darbe" kopuk okunuyor (`effect-wolf.png` #0–#14 bekleme, #15–#22 uluma ve ruh). roar = uluma (G7, burada anlamlı). | `burnFly('wisp')` | alev ruhu | uluma ölümle örtüşerek başlar; etki ≤1,2 sn | orta |
| Kart resmi | `portrait()`: alev yeleli profil | — | — | — | — | A5 | düşük |
| Ağırlık sınıfı | orta-hafif | — | En uyumlu karakter: hızlı attack (12 fps), kısa atılma. Eksik: koşu döngüsü, gerçek iniş. | — | — | — | orta |

---

## 7. Gelgit Golemi (`tide_golem`) — SU, Svy 4, ağırlık önerisi: ağır

Çizim: `src/art/monsters/tide_golem.ts`. Saldırı / karşı etki / ölüm: `strikes-a/tide_golem.ts`.
Çağırma: `summon-a/tide_golem.ts`. Portre: yok (as değil).

| Olay / kart | Mevcut animasyon (dosya) | Ölçülen süre | Zayıf / eksik (kanıt) | Ortak bileşen | Karta özgü kısım | v3 hedefi | Öncelik |
|---|---|---|---|---|---|---|---|
| Çizim ve rig | 64×64, çapa (30,60); idle 8k@8, roar 10k@10, attack 10k@12 (darbe 5), hit 4k@10, guard 4k@5. Rig: kollar 2 kemikli IK, su gövdesi (ince yerde açık kenar, iç akıntılar, kabarcık), taş halkalar, maske. | idle 1,0; roar 1,0; attack 0,83; hit 0,4; guard 0,8 | Ağır karakterin attack'ı 12 fps (G1). roar 4–5'te gayzerler üst kenara değiyor (y = 0, G9). | — | su gövdesi, taş halkalar | ağır eğri, kenar payı | yüksek |
| Bekleme (idle) | 8 kare, akıntı + kabarcık + çekirdek nabzı | 1,0 sn | İç akıntı canlı (iyi); kollar az. | — | akıntı | — | düşük |
| Normal çağırma | `suGolem`: kart çarpar, içe akan halkalar, su hortumu, golem alttan üste kurulur, roar 4'te kollar yukarı | **olay 1567 ms** (roar 2067'de biter); bütçede | Golemin "sudan oluşması" ortak tarama maskesiyle; kendine özgü kurulma pozu yok (`su-golem.png` #12–#14). | `runSummon`, hologram | su hortumu | sudan toplanan çizilmiş oluşum pozları | orta |
| Özel çağırma | ölçülmedi; aynı mekanizma (G10) | ≈3,0 sn | G10 | `soul_recall.ts` | — | ayrı diriltme | orta |
| Savunma (guard) + pozisyon değişimi | 4k@5: çömelmiş, su halkası. `position`: savunma → saldırı | **1100 ms** (bütçe 0,4) | guard 0 → roar 0 tek karede (733 ms), sonra tam roar (1 sn). Geçiş kendi pozuyla değil, roar ile (G7). | `summon-b/position.ts` | — | kısa kalkış pozu, ≤0,4 sn | yüksek |
| Saldırı "Dalga Darbesi" | çömelir (1), kollar başın üstünde, su yumruklara (2–3), savurur (4), 5'te yere vurur; dalga hedefe yuvarlanır, köpükle çarpar | `saGolemAtk`: attack 667; yere vurma 1100; golem idle'a 1517'de döner; dalga teması 1700 (vuruştan 600 ms sonra); sayı 1833 (+133); perinin ölümü 1900–3500 (1600); **savaş 3250, toplam 3817** | Golem dalga varmadan beklemeye dönüyor (G13); dalga 0,6 sn boyunca tek başına; bütçe aşımı (G11). | `projectile('wave')`, `foamCrash` | dalga | dalgayı "iten" takip pozu, dalga varınca toparlanma | orta |
| Doğrudan saldırı | dalga sahadan düelloya | `saGolemDirect`: yere vurma 1117; düelloya temas = sayı 2067 (dalga 950 ms yolda); savaş 2933; toplam 3500 | Dalga yolculuğu uzun; golem bu sürede bekleme pozunda. | `projectile('wave')`, `directHit` | — | ≤1,6 sn | düşük |
| Hasar (hit) | 4k@10: geri yaslanma, damlalar | 400 ms | G4 (%99). `diff-tide_golem-hit.png` | `hitReact` | damla | su gövdesinde dalgalanma temas noktasından | yüksek |
| Savunmada darbe | `saGolemCounter`: kurt savunmadaki goleme çarpar, ortak `guardHit` | temas 1133; geri hasar sayısı 1367 | G4 ortak itme; golem gövdesi tepki vermiyor. | `guardHit` | — | su kalkanının çökmesi / dalgalanması | orta |
| Ölüm "erime" | sendeler, şeklini kaybeder, birikintiye yayılır, damla, sıçrama | `saGolemBlocked`: karşı darbe 2100 (sayı 1917, 183 ms önce, G6); ölüm 2317–4267 (**1950**); ardından kurdun yanma etkisi 4267–6200; savaş toplam 5950 | Karta özgü (iyi) ama "çökme" `setScale(1,22, 0,62)` ile yapılıyor (G2): piksel dili bozuluyor. | `flavoredDeath` | birikinti | çizilmiş erime kareleri | yüksek |
| Kart etkisi: savunmada saldırılırsa saldırana 300 | bel halkası döner, çekirdek parlar, su topu saldırana fırlar, patlar, sprey LP paneline, −300; golem öldüyse birikintiden gayzer | `saGolemCounter`: etki 1683–3783 (**2100**); topun saldırana çarpması 2483, sayı 3167 (**684 ms sonra**, panelde) | **Golem bedeni hiç oynamıyor** (fırlatma pozu yok, guard döngüsü sürüyor; `effect-golem.png` #12–#20); efekt bedenin yerine geçiyor (plan §4). Etki süresi uzun. | `projectile('water')`, `burnFly` benzeri | su topu | kolla fırlatma pozu, sayı saldıranda temasla | yüksek |
| Kart resmi | `portrait()`: maske + çekirdek yakın plan | — | — | — | — | A5 | düşük |
| Ağırlık sınıfı | ağır | — | Uyumsuz: 12 fps attack, anında toparlanma. | — | — | ağır eğri | orta |

---

## 8. En zayıf 10 nokta (grup A)

1. **Sözleşmede çağırma / ölüm / diriltme / etki / geçiş pozu ve kare başına bekleme yok (G1)**: altı canavar
   aynı 10 karelik, 5. karede vuran şablonda; ağırlık sınıfı zamanlamaya yansımıyor (ağır titan ve golem
   12 fps ile ejderden hızlı). A1 sözleşme eki + `src/artlab` `LabAnim` deseni.
2. **Kesirli `setScale` / `setAngle` ile ezilme, uzama, çökme (G2)**: golem ölümü 1,22 × 0,62, kurt koşusu
   1,12 × 0,90, titan 5°, kurt 14°, pozisyon değişimi 1,08 × 0,86. Çizilmiş pozlarla değiştirilmeli.
3. **Yakın dövüşte ayak kayması ve geri geri zıplayarak dönüş (G13)**: titan tutulan kareyle kayıyor
   (`sa-titan-atk.png` #7–#10), kurt ve titan hedefe bakarak geri zıplıyor; yürüme / koşu döngüsü yok.
4. **Diriltme = imza çağırmanın tekrarı (G10)** ve süre 3,0–3,1 sn (Titan'da etkiyle 5,1 sn).
5. **Tek tip hasar tepkisi (G4) + efektin silüeti örtmesi (G5)**: hafif / ağır, fiziksel / büyüsel ayrımı
   yok, temas bölgesi önce tepki vermiyor, hit pozu patlamanın altında kalıyor.
6. **Süre bütçeleri (G11)**: as çağırma 3,7 sn (Titan etkiyle 5,75 sn, Büyücü etkiyle 6,8 sn), canavara
   saldırı + ölüm 3,8–4,2 sn, doğrudan saldırı 2,2–2,9 sn, savunma → saldırı 1,1 sn.
7. **Ölümde beden donuk (G12)**: çatlak, köpük, sönme, erime efektleri iyi ama gövde `hit` karesinde
   kalıyor; büyücüde "cüppe çökmesi" yok; ölüm olayı ~2,1 sn ve sonunda boş bekleme.
8. **`roar` her işe koşuluyor (G7)**: büyücü asayla hedef göstermiyor, titan art arda iki kez kükrüyor,
   golem karşı darbede hiç kıpırdamıyor.
9. **Hasar sayısı temasla eş değil (G6)**: canavara saldırıda ~133 ms gecikme; saldıran kaybettiğinde sayı
   karşı darbeden 100–316 ms önce; golemin karşı etkisinde topun çarpmasından 684 ms sonra.
10. **As çağırmalarda beden geç görünüyor**: Kristal Ejder'in 3,8 sn'lik girişinde gerçek renkli beden
    yalnız son ~0,5 sn'de; öncesi hologram, tarama, yatay mercek çizgisi ve cut-in. Kesirli kamera
    yakınlaşması (G3) da bu anlarda pikselleri bozuyor.
