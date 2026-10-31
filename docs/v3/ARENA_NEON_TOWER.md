# Neon Tower Arenası — plan + iskelet (v3 görünümü)

Onaylı hedef: `/root/.claude/uploads/.../f954fe03-image.png` (yapay zekâ konsept maketi; gerçek 640×360'ta **daha az ayrıntı**
olacak) ve 4'lü sayfadan 3. tasarım. Bu belge **PLAN + İSKELET** aşamasının çıktısıdır; sayısal tek kaynak
`src/view/board-nt/layout-nt.ts` (belge ondan alıntılar; `?ntdebug=1` aynı dikdörtgenleri oyunun üstüne çizer).
Teknik metin İngilizce, başlıklar Türkçe. Kamera **asla değişmez** (zoom 1, tam sayı 2:1); `layout.ts` yalnız okunur.

## 1. Durum ve anahtar

| Ne | Değer |
|---|---|
| Geliştirme anahtarı | `?look=v3&arena=nt` (veya `globalThis.__NEON_ARENA_NT = true`). `?arena=calm` = kapalı. v1 hiçbir zaman değişmez. |
| Varsayılan çevirme | Yalnız `src/view/board-nt/flag.ts` `DEFAULT_ON` (son aşama, sahip C). `layout.ts` dokunulmadı (`?arena=` orada yalnız v1/v2 okur, v3'te yok sayar). |
| Bağlantı | `BoardView.ts` v3 kolunda `ARENA_NT ? new BoardViewNt : new BoardViewCalm`; alan tipi `ArenaViewApi` (`board-nt/api.ts`); `crowd()` artık calm/NT kolunda isteğe bağlı iletir (calm'de yok = no-op). |
| İskelet davranışı | `BoardViewNt` tüm çağrıları **BoardViewCalm'a devreder** (zemin MOTORU). 9 katman dosyası + boyayıcı + boot adımı var, yer tutucu yalnız `?ntdebug=2`'de görünür. Dondurulmuş saatle `?arena=nt` ↔ calm **piksel-özdeş** (fark kutusu `None`). |
| Hold | Calm'a eklenen tek şey: `BoardViewCalmOptions.skip?: {background?, slab?}` (varsayılan boş = bire bir eski). |

## 2. Referansa bakış ve dürüst kararlar

Referans: koyu lacivert/mor salon, ortada TEK yükseltilmiş metal platform, mavi (yakın/sol-alt) ve kırmızı (uzak/sağ-üst) yarı,
arkada simetrik kule + kanatlı-kalkan amblemi, iki açılı ekran, iki yanda basamaklı tribün, iki köşede holografik yaratık.
Bizim oyunda sabit olan: kare konumları (`zoneXY/isoToScreen`), HUD, 5+5 / 3+3. Bunlar referanstan şu farkları zorunlu kılar:

1. **Platform referanstan çok daha yukarıda**: tepe köşesi (288, 52), sağ uç (536, 176), sol uç (104, 144), yakın köşe (352, 268).
   Kulenin arkasında yalnız ~50 px var → derin koridor yok: amblem plakası y 22..48, koridor bir sığ kemer (y 48..58) ve alt yarısını
   platformun tepe köşesi örter.
2. **Holograflar "üst köşe"ye değil üst-orta köşeye** (ayak çizgisi y 134): sağ üstte P2 paneli (x 488..636, y 4..68) var. Yaratık altta
   hizalıdır (Ejder 91 px, Büyücü 71 px boyunda) ve panelin altında kalır; büyücünün asa ucu panelin 5 px altına girebilir (HUD üstte, hologram arkada).
3. **Sol tribün sağdakinden kısa**: tahta 7×5'tir (çarpık eşkenar dörtgen), sol uç y 144'te sağ uç y 176'dadır; sol hologram + P1 duelist
   tabanı arasında yalnız ~70 px kalır (sağda ~160 px). Simetri yerine "her iki yanda 3 sıra" verilir; sayı ≈27 / ≈55.
4. **Hologram saydamlığı** MA-4 ("alfa yok") ve "yalnız PAL" kuralının bilinçli istisnasıdır (kullanıcı kararı: saydam + titreşim).
   Öneri: alfa YALNIZ hologram yaratık sprite'ında, 3 basamaklı (1.0 / 0.78 / 0.55) ve palcheck'te hologram kutusu dışarıda ölçülür.
   Alternatif (alfasız): 3 önceden pişmiş tarama/stipple maskesi, +0,3 MB. **Karar bekliyor (§15-K1).**

## 3. Ekran haritası (640×360, piksel)

Tahta HER ZAMAN 5+5 için çizilir: sabit 7×5 ızgara, orijin (288, 80) (`ntIso`). v1 3+3 tahtası bu ızgaranın 2..4. sütunlarıdır
(aynı ekran pikselleri; `tests/view/board-nt-layout.test.ts` kanıtlar): 3+3'te dış iki şeridin hücresi boş grafit kalır, slot yalnız
`zoneXY`'nin söylediği yere çizilir. Duelist ve pile konumları değişmez (`duelistXY` P1 (213, 214), P2 (427, 106)).

| Bölge | Dikdörtgen (x, y, w, h) | Not |
|---|---|---|
| Platform üstü | 104, 52, 432×216 | Köşeler: tepe (288,52) sağ (536,176) yakın (352,268) sol (104,144). Çıkıntı yok (sol uç x 104 = inspect paneli sınırı). Duelist tabanları dahil. |
| Platform + zırh | 104, 52, 432×234 | Yan zırh 18 px: kenar 2 + panel 11 + etek 5. En alçak nokta yakın köşede y 286 (ipucu çubuğunun alt kenarı). |
| Temas gölgesi | 88, 140, 464×170 | Ink, basamaklı; HUD altına girebilir, y 140 üstüne çıkmaz. |
| Duelist tabanları | P1 185,200 · P2 399,92 (56×28) | Dikili küçük taban; P1 camgöbeği, P2 kızıl kenar. Duelist sprite'ı aynen kalır. |
| Orta şerit | emblem 312,156 (16×8) | Nötr koyu şerit (no-man's land) + minik özgün işaret. |
| Arka duvar | −8, −8, 656×110 | Kamera payı taşar. Koyu lacivert/mor panel + LED şeritleri. |
| Kule | 236, 0, 168×64 | Simetrik koyu metal kütle; faz çubuğu (160..434, y 4..20) üstünü örter. |
| Amblem plakası | 298, 22, 44×26 | ÖZGÜN kanatlı-kalkan turnuva işareti. Hiçbir ticari kart oyunu logosuna benzemez. |
| Koridor | 306, 48, 28×10 | Sığ kemer; alt yarıyı platform tepe köşesi gizler. |
| Ekranlar | sol 146,20 · sağ 398,20 (90×62) | Çerçeve dahil, iç portre 80×56. Sol (oyuncu, mavi) alt-sağ köşesi platformun sol-üst kenarı `y = 196 − x/2 − 2` boyunca kesik. |
| Hologram kutuları | sol 0,36 · sağ 536,36 (104×104) | 1× tam sayı ölçek, ayak çizgisi y 134. Plinth elipsi: sol (52,136) sağ (588,136), rx 46 ry 10. |
| Tribün blokları | sol ≈62,133 (100×84) · sağ ≈460,137 (174×121) | Ayrıntı §8. Sol: alt-sol kenar boyunca; sağ: alt-sağ kenar boyunca. |

**HUD'a ayrılan alan (arena bunların altına tasarım koymaz; ağır "arka plan kütlesi" HUD'un altına girebilir):** araç çubuğu 4,4 (92×16);
faz çubuğu 160,4 (274×16); P2 paneli 488,4 (148×64) + mini el 540,68 (46×12); inspect 4,24 (100×236, yalnız açıkken); ipucu 174,262 (292×26)
(3+3'te y 252); P1 paneli 4,292 (148×64); el 160,290 (320×70); düğmeler 500,300 (136×56). Testte "clear" bölgeler (ekranlar, amblem, koridor,
duelist tabanları) bu dikdörtgenlerle kesişmez. İzin: hologram/tribün/platform kütlesi inspect ve P2 panelinin ARKASINA girebilir.

## 4. Katman ve derinlik sırası (`NT_DEPTH`, uzak → yakın)

| Derinlik | Katman | İçerik |
|---|---|---|
| 10 | wall | arka duvar, kule, amblem, koridor |
| 11 | screens | iki portre ekranı + tarama çizgisi |
| 12 | wallLights | LED şeritleri, spot konileri (basamaklı düz) |
| 13 / 14 / 15 | holoPed / holo / holoFx | plinth + halka · yaratık · parçacık, tarama süpürmesi, çağırma parlaması |
| 16 / 17 / 18 | stands / crowd / crowdFx | basamaklar · izleyiciler · ışık çubukları, tepki kıvılcımı |
| 19 | shadow | platform altı temas gölgesi |
| 20 / 22 | platform / platformFx | gövde, zırh, üst plaka, enerji şeritleri · şerit koşucusu, köşe parıltısı |
| 29 | pads | duelist tabanları |
| 30 … 32 | floor | slotlar (calm: pad 30, padFill 31, padLine 32) |
| 40 … | floorFx | hover/seçim, flaş (calm hl* 40..43) |
| 100+y | UNIT | canavarlar, duelistler (değişmez) |

Calm'ın kendi numaraları (taban 19.1, bg 19.2, slab 20 …) aynen kalır; NT katmanı calm parçasının yerini aldığında (`skip`) onun bandına oturur.
`SKY 0`/`STADIUM 10` bandları dışında yeni band açılmaz; v2 volkan örtüsü (`STADIUM+4 … PLATFORM−1`) arka plan arkasında gizli kalır (calm kuralı korunur).

## 5. Renk haritası (yalnız `src/art/palette.ts`; rampa EKLENMEDİ)

`src/art/arena-nt/palette.ts` (`NT_PAL`): **metal** `night0…night4 + steel`, tek parıltı `mist`; **grafit üst plaka** `stone0…stone2`;
**mavi yarı** `cyan0…cyan4`; **kırmızı yarı** `crim0…crim4`; **mor** `void0…void4` (sağ hologram, duvar vurguları, bayrak); **kristal hologram**
`cyan0…cyan4 + white`; **beyaz** yalnız 1-px parıltı ve amblem çekirdeği; **tribün/arka** `ink, night0, night1, void0`; izleyici teni `skin0…skin4`,
saç `earth/gold/night/void`. Parlak neon YALNIZ 1-px çizgi: platform kenarı, slot sınırı, ekran çerçevesi, hologram çizgisi. Doldurma hep koyu ton.
Yeni ton gerekirse yalnız ekleyerek ve `tools/palcheck.mjs` ile (şimdilik gerek görülmedi).

## 6. Bütçe (ÖNCE = `shots/v3/arena-nt/before/`)

| Ölçü | ÖNCE (v3 calm) | NT hedefi |
|---|---|---|
| texmem boot toplam / arena kategorisi | 41,36 MB / **1,90 MB** (calm: 3 doku, bg 0,85 MB) | ≤ 42,0 MB / ≤ 2,4 MB (net ≤ +0,5 MB) |
| #doku / gl MB / heap | 568 / 60,48 / 144 | +≤ 12 doku, gl ≤ +1,5 |
| calm arena kurulum (CALM_BUILD.step) | 89,7 ms (topAt 94k çağrı) | NT boot adımları toplamı ≤ 120 ms, hologram pişirme **dilimli** (§9) |
| Sahne nesnesi (z5FullCalm) | 360 | ≤ +140 (kalabalık ≈84, holo ≈14, ışık ≈12, duvar/ekran ≈30) |
| Kare süresi (başsız, gerçek zaman 240 kare) | ortalama 26,8 ms, p50 33,3, p95 33,4, maks 66,7 | ortalama ≤ +2 ms (başsız GL: yalnız göreli) |
| measure (tbMirror/suWyrm/saWyrmAtk/spBolt) | toplam 2583 / 2800 / 2000 / 1316 ms | aynı (±17 ms): arena zamanlamayı etkilemez |

Katman doku tahmini (RGBA): platform ≤ 0,50 MB (464×250 tek doku + şerit maskeleri) · floor ≤ 0,15 (slot 3 durum, merkez, pile, maske) ·
pads ≈ 0,02 · wall ≤ 0,40 (656×110 + kule) · stands ≤ 0,15 · crowd ≤ 0,08 · screens ≤ 0,12 · holograms ≤ 0,60 (Ejder 10 kare ≈0,32 + Büyücü
10 kare ≈0,16 + plinth/halka ≈0,08) → ≈ 2,0 MB; calm'ın 0,85 MB'lık bg maskesi ve slab'ın yerini aldığı oranda düşer (skip ile).
Kalabalık: **tek atlas, tek toplu çizim**, spektatör başına tween YOK; tüm tribün ≤ 4 zamanlayıcı.

## 7. Animasyon envanteri (hiçbir şey statik değil; hepsi sahne saati × timeScale, hit-stop ile durur)

| Öğe | Kare / döngü | Faz ayrımı |
|---|---|---|
| İzleyici (≈84) | 5 poz × 8 görünüm; oturma nefesi 2 kare/1,6–2,4 s; çubuk sallama 3 kare/0,5 s | Her izleyicin tohumlu kendi faz + periyodu (ortak saat yok) |
| Işık çubukları | mavi/kırmızı, 3 kare, satır başına farklı faz | Satır başına |
| Hologram yaratığı | 10 kare idle (≈200 ms/kare, ≈2 s) + 3 basamaklı opaklık titreşimi (1,3–2,9 s, rastgele aralıklı) + tarama süpürmesi (3,4 s) | Sol/sağ farklı periyot (2,0 / 2,3 s) |
| Hologram halkası | 4 kare ışık halkası (0,8 s) + 6 ≤2×2 mote (yukarı, 2–3 s) | Sol/sağ ofset |
| Portre ekranları | tarama çizgisi 1 px, 56 satır/4 s; çerçeve nefesi 2 ton/3 s; göz kırpma 2 kare her 6–9 s | İki ekran farklı |
| Duvar | LED yürüyüşü (1-px, 6 s döngü), amblem nabzı 2 ton/4 s, tek parıltı/çarpık aralık | Parça başına |
| Platform | enerji şeridi koşucusu (calm runner yeniden kullanılır), köşe parıltısı 3 kare / 7 s, havalandırma 2 kare | Köşe başına |
| Slot | sönük → parlak (hover/seçim) basamaklı geçiş (calm `highlightZone`) | — |
| Tepkiler (kısa) | çağırma: o taraf ayağa kalkar + hologram parlaması ≤ 400 ms; saldırı ilanı: öne eğilme; büyük hasar: gasp/dondurma; yıkım: iç çekme; oyun sonu: tam kalkış | Güce göre 0,5…2× |

## 8. Kalabalık tasarımı (sahip B1)

Sprite hücresi **12×16** (ayak altta ortada), **8 görünüm** (saç/ten/üst kombinasyonları, 2'si kırmızı/mavi takım şapkası) × **5 poz**
(oturma, ayakta, alkış ×2 kare, kollar yukarı) + takım rengi ışık çubuğu 3 kare. Tek atlas (≈128×… , ≤ 0,08 MB), önceden pişmiş (tohumlu, `Math.random` yok).
Yerleşim `STANDS`: 3 sıra, satır ayak çizgisi `y = a + slope·x`; sol `y = 118 + x/2` (x 88..156, satır başına 10 px dışa), sağ `y = 470 − x/2`
(x 466..628); her sıra 4 px aşağı, 10 px dışa (tribün yükselir); aralık 9 px ≈ 27 sol + 55 sağ. Sol mavi, sağ kırmızı ışık çubuğu. Hologram plinth'i
izleyicinin ARKASINDA (depth 13–15 < 17) ama çakışmaz: plinth y ≤ 146, sol ilk sıranın baş çizgisi y ≈ 146. Tepki olayları: `crowd(kind, side, power)`
(`cheer|gasp|roar`) + `onGameEvent` (summon, attackDeclare, damage, destroy, gameOver); kısa geçersiz kılma (150–600 ms) sonra döngüye süzülür.
**Olay beslemesi**: sinematik gözlemcisi (`registerObserver`, `50-warm.ts` gibi, yalnız NT) — sinematik dosyalarına DOKUNULMAZ.

## 9. Hologram tekniği (sahip B2)

Her zaman aynı iki yaratık (kullanıcı kararı): sol **Kristal Ejder** (`crystal_wyrm`, mavi-beyaz), sağ **Uçurum Büyücüsü** (`abyss_magus`, mor) — bizim özgün
tasarımlarımız. Teknik: `monsterFrame(id,'idle',i)` v3 idle karelerinin (Ejder 116×104, Büyücü 112×116; opak 85×91 / 54×71) her 2. karesi (10 kare)
tek rampaya (kristal `cyan1…cyan4+white`, büyücü `void1…void4`) yeniden renklendirilir, **her 2. satır boş** (tarama), opak kutuya kırpılıp tek
atlasa pişirilir, **1× tam sayı ölçek** (2× sığmaz: 232 px; dürüst sonuç: hologram oyundaki canavarla AYNI boy, ama köşede yalnız o var). Pişirme boot'ta
değil, ilk karelerden sonra **dilim dilim** (50-warm benzeri, ≤ 4 ms/dilim) ve `whenMonstersBuilt` sonrası. Plinth: 92×20 elips + 4 kare halka, alt
kısımda yatay ışık halkası. Çağırma parlaması: o taraftaki `summon` olayında 3–4 kare 1-px ışık halkası + mote artışı (≤ 400 ms), sonra yavaş idle.
Bloom, mercek parıltısı ve parçacık yağmuru YOK.

## 10. Ekran tekniği (sahip B2)

İki ekran, tam iki karakter: oyuncu (kahverengi saçlı, mavi ceketli çocuk) ve rakip (beyaz saçlı, kırmızı paltolu çocuk). **80×56 portre haritaları**
`src/still/*-map.ts` tarzı karakter haritası (elle yerleştirilmiş, düz bantlar, 1-px kontur), renkler `src/art/duelists.ts`'tekilerle aynı aileden;
çerçeve 90×62 (açılı: sol ekranın alt-sağ köşesi §3'teki doğru boyunca kesik), tarama çizgisi, isim etiketleri (TR: OYUNCU / BİLGİSAYAR; harfler ç ğ ı İ ö ş ü).
Aktif tarafın çerçevesi 1 ton parlak. Aynı portre haritaları ileride HUD paneline (C) küçük basılabilir.

## 11. Işık planı (sahip C; bloom yok, mercek parıltısı yok)

1. **Pişmiş statik ışık** (duvar/tribün/ekran sanatında): spot konileri ve yan ışık havuzları düz basamaklı tonlar, alfasız.
2. **Dinamik, basamaklı yer ışığı** (mevcut `src/view/light` basamaklı mod): slot ve platform üstüne mavi/kırmızı sızıntı, hologram/ekran sızıntısı (düşük seviye),
   çağırmada plinth havuzu (`lightFlash`/`lightPool`, ≤ 400 ms).
3. **Kural**: arka plan hiçbir zaman oyuncu okunurluğuyla yarışmaz — duvar/tribün parlaklığı slot çizgisinden en az 2 ton koyu.
**Engel (R1)**: `stepped.ts` `padColorAt` calm'ın `topAt()`'ına bağlı; C bunu takılabilir yapmalı (`setFloorSampler`, ekleyici) veya A1 slotları calm pad rengiyle uyumlu tutmalı.

## 12. Zemin / slot yeniden kaplama ve hover hizası (sahip A1)

**Karar D1**: slot durum makinesi (hover/seçim `highlightZone`, flaş, nabız, ateşleme, koşucu, volkan teması) **BoardViewCalm'da kalır** (test edilmiş, `zoneAt`/`tileImage`
hizası yapı gereği korunur: işaret maskeleri `mask:fill/line/tile` ve `tip:*` salt 64×32 eşkenar dörtgendir, sanattan bağımsız). Yeniden kaplanan şey SANAT'tır: slab (hull + üst plaka)
ve pad kareleri (`pad:<p>:<spot>:<i>`). Yol: calm'a ekleyici `opts.art?: Partial<CalmArt>` (A1 ekler) — NT `slab`, `pads` (aynı anahtarlar), `trims/paths` (enerji şeridi) verir; `masks, tips,
linePath, kinds` calm'dan kalır. Slot görünümü: boşken **sönük ince parlayan sınır** (ton 1), hover/seçimde 2 ton parlak (calm `step()`), 3 kare; merkez nötr şerit + minik emblem;
field/banish/graveyard/deck tabanları aynı çizgi dilinde. 3+3: aynı platform, slot yalnız `zoneXY` hücrelerinde.
**Riskler**: R2 volkan teması lav boyayıcısı `art.kinds` + `calmColorAt(slab)` kullanır (`FIRE_STEP`) → NT slab tonları o tablodan geçmeli ya da tabloya eklenmeli.

## 13. Entegrasyon ve kapılar

`DuelScene` değişmez (`new BoardView` aynı). `ensureLightLayer(…)` v3'te zaten açık. Boot: `src/boot/21…29-arena-nt-*.ts` (ARENA_NT değilse hemen döner; v1'de hiçbir doku üretilmez).
Dosyalar: `src/view/board-nt/{flag,api,layout-nt,layer,textures,debug,index,platform,floor,pads,wall,stands,crowd,screens,holograms,lights}.ts`,
`src/art/arena-nt/{palette,stub,platform,floor,pads,wall,stands,crowd,screens,holo}.ts`, `tests/view/board-nt-layout.test.ts`.
Kapılar (her aşama sonunda): `npm run typecheck`, `npm test`, `filmdiff --set v1` (17/17) + `--set a6v1` (26/26) IDENTICAL, `measure --camera-gate`, `palcheck`, texmem/measure önce-sonra tablosu,
`?arena=nt` ↔ calm dondurulmuş piksel karşılaştırması (skip bayrakları kapalıyken özdeş), 5+5 ve 3+3 filmleri, HUD (inspect/ipucu/faz/düğme) kapatılmamış denetimi.

## 14. Sahiplik ve aşamalar

| Aşama | Sahip | Dosyalar | Teslim |
|---|---|---|---|
| A (paralel) | **A1** | `platform.ts`, `floor.ts`, `pads.ts`, `art/arena-nt/{platform,floor,pads}*`, boot 21/22/29, calm `opts.art` ekleyicisi | platform + slot + taban; `skip.slab` açılır |
| A (paralel) | **A2** | `wall.ts`, `stands.ts`, `art/arena-nt/{wall,stands}*`, boot 23/24 | duvar + kule + amblem + tribün basamakları; `skip.background` açılır |
| B (paralel) | **B1** | `crowd.ts`, `art/arena-nt/crowd*`, boot 26 | ≈84 izleyici + tepkiler |
| B (paralel) | **B2** | `screens.ts`, `holograms.ts`, `art/arena-nt/{screens,holo}*`, boot 27/28 | iki ekran + iki hologram |
| C | **C** | `lights.ts`, `index.ts`, `debug.ts`, `flag.ts` (varsayılan çevirme), `BoardView.ts`, duelist yerleşimi, HUD portre panelleri, entegrasyon | ışık, son kalite, varsayılanı çevir |
`layout-nt.ts`, `api.ts`, `layer.ts` bu aşamadan sonra **donuk** (yalnız ekleyici ve yalnız orkestratör/C). Her sahip yalnız kendi dosyalarını düzenler; `skip` bayrağı çevirmek
`NT_SKIP` (index.ts) tek satırı: sahibi o satırı kendi teslim commit'inde değiştirir.

## 15. Açık kararlar / riskler

- **K1** hologram alfası (§2.4): kullanıcı "saydam + titreşim" dedi, proje "alfa yok / yalnız PAL" diyor. Öneri: yalnız hologram yaratıklarında 3 basamaklı alfa kabul.
- **K2** hologram yüksekliği: ayak y 134 ("üst köşe" yerine üst-orta). P2 paneli taşınmadan daha yukarı olmaz (HUD sözleşmesi); C'de P2 panelini küçültme seçeneği.
- **K3** sol tribün kısa (27 vs 55): platform çarpıklığından. İstenirse C sol hologramı 12 px yukarı alıp sol tribünü ~20 izleyici uzatır.
- **R1** basamaklı ışığın zemin bilgisi calm `topAt`'a bağlı. **R2** volkan lav boyayıcısı calm slab/kinds'e bağlı. **R3** hint çubuğu 3+3'te y 252: platform yakın köşesi (y 286) altında kalır (HUD üstte; kabul).

## 16. J1 — platform, rim, slotlar, 3+3 (güncel durum; §3/§12 bunu geçersiz kılar)

- **Zırh yan yüzü 28 px** (`FACE_H` 18 → 28): alt tüy + kapak (v0–2), üst zırh plakası (v4–10: vida, havalandırma ızgarası, girinti), ışık kanalı (v12–14, enerji şeridi), alt zırh plakası (v16–23: kaymalı derz, lamba, havalandırma), kenar + etek (v24–27). `PLATE_FULL` h 244, en alçak nokta y 296 (HUD üstte çizilir). **Kalabalık/tribün için**: zırh alt çizgisi sol yüzde `y = 120 + x/2`, sağ yüzde `472 − x/2`.
- Üst plaka düz grafit (`stone1`), karolar yalnız 1-px kenarla okunur; yalnız çok seyrek 1-ton benek. Kenar: kapak 2 px + oluk + neon kanalı (calm şeridi 3..4 px içeride) + oluk. Köşe blokları 28×14×10; iç (konkav) köşeye de sütun eklendi; yan etek gölgesi 4 kademe (alfasız damga).
- **Kırmızı kama / dama dokusu nedeni**: `lights.ts` iki taşkın elipsi (rx 150, ry 74) 0,5 yoğunlukta → tüm karolarda Bayer damalama ve ortada üst üste binen kızıl havuz. `FLOOR_POOLS = false`; yarı tonları slot sanatı üstlendi. Basamaklı örnekleyici (flaş, volkan) aynen çalışır.
- **Slot durumları** (`floor.ts`): boş (sönük ince sınır, grafit kuyu), dolu (parlak sınır + koyu mavi/kızıl havuz + halka), yüzü kapalı (dolu + dört köşe saplaması); sıradaki taraf / çağırma-saldırı anında sınır 1 ton yukarı. Durum `scene.views.field` okunarak 120 ms'de bir yenilenir. Calm hover/seçim çizgisi üstte, hizası yapı gereği aynı.
- **3+3**: calm neon şeridi küçük taslağı izlediği için (`skip.trims`) kapatılır, plaka kendi sönük kenar çizgisini boyar (mavi yakın / kızıl uzak).
- **Doku tasarrufu**: NT açıkken calm `slab` + `bg` yüklenmez (`buildCalmTextures(scene, {slab,bg})`): arena kategorisi 2,56 → 1,22 MB.
