# Okunurluk ve Renk Oturumu (`gemini/okunurluk`)

## Başlangıç ve Baz Çekimler
- Dal: `gemini/okunurluk`
- Öncesi ekran görüntüsü: `docs/v3/ref/okunurluk-oncesi.png` (`?dev=duel&s=a6Hover&look=v3`)
- Sonrası ekran görüntüsü: `docs/v3/ref/okunurluk-sonrasi.png` (`?dev=duel&s=a6Hover&look=v3`)
- Hedef referans: `docs/v3/ref/hedef-gorunum-2.png`
- `v1` film bazları: `shots/v3/a3/baseline/v1films` (17/17 film)
- `a6v1` film bazları: `shots/v3/a56/baseline/a6v1films` (26/26 film)

## Yapılan Değişiklikler (`?look=v3`)

### 1. Hologram Heykeller (`src/art/arena-nt/holo-bake.ts`, `src/view/board-nt/holograms.ts`)
- Orijinal `crystal_wyrm` (sol) ve `abyss_magus` (sağ) hologram heykellerinin bütünlüğü korundu (delikli dither kaldırıldı).
- Renk rampaları parlak beyaz (`PAL.white`) yerine sakin arduvaz-mavi (`night0..steel..mist`) ve arduvaz-mor (`night0..void0..void2..steel`) tonlarına çekildi.
- `src/view/board-nt/holograms.ts` içinde heykeller, kaideler ve ışık konileri yarı saydam (`alpha: 0.28..0.55`) yapılarak sisin içinde sakin biçimde oturmaları sağlandı.

### 2. Sahaya Sol Üstten Vuran Sıcak Anahtar Işık (`src/view/light/LightLayer.ts`, `src/art/arena-nt/platform.ts`)
- `src/art/arena-nt/platform.ts` içinde platformun sol üst kenar pervazları (`RIM`, `RIM2`, `RIM3`) sıcak kehribar/taş tonlarıyla (`PAL.earth2`, `PAL.earth1`, `PAL.stone2`) aydınlatıldı.
- `src/view/light/LightLayer.ts` (`ensureKeyLightTex`) içinde platform sekizgenine kırpılmış yumuşak radyal sıcak altın-kehribar ışık yıkaması (`rgba(252, 196, 114, alpha)`) eklendi.

### 3. Sahadaki Noktaların / Gürültünün Temizlenmesi ve Pürüzsüz Arduvaz Zemin (`src/art/arena-nt/platform.ts`, `src/art/arena-nt/floor.ts`)
- Platform üst yüzeyindeki ve kare içlerindeki tüm rastgele nokta/dither gürültüleri (`hash01` benekleri) tamamen kaldırıldı; zemin pürüzsüz koyu arduvaz (`G[1]` / `PAL.stone1`) olarak boyandı.

### 4. Keskin, Temiz 1-Piksel Kare Çizgileri (`src/art/arena-nt/floor.ts`, `src/art/arena-nt/platform.ts`)
- `src/art/arena-nt/floor.ts` içinde kare kenarlarını kalınlaştıran 3-piksel geçiş halkası kaldırılarak yalnızca 1-piksel izometrik elmas çizgisi (`isLine`) bırakıldı (P1 için sakin camgöbeği `PAL.cyan1`, P2 için sakin kızıl `PAL.crim1`).
- Oyun alanı dışındaki sütunlarda (`col = 0`, `col = 6`) fazladan çizilen soluk kare izleri kaldırıldı.

### 5. Oyuncu 1 ve Oyuncu 2 Arasındaki Orta Şeridin Temizlenmesi (`src/art/arena-nt/platform.ts`, `src/view/board-nt/floor.ts`)
- `row === 2` orta şeridindeki oluk çizgileri, kesikli çizgiler (`dashes`) ve orta amblem (`emblem`) kaldırılarak iki oyuncu arasındaki alan pürüzsüz koyu arduvaz (`G[1]`) haline getirildi.

### 6. Birimlerin Altındaki Yumuşak Gölgeler ve Işık Havuzları (`src/view/light/LightLayer.ts`)
- `SteppedUnitLight` içinde birimlerin altındaki noktalı dither gölge gizlenerek yerine iki katmanlı yumuşak radyal gölge (`ensureFloorShadowTex` ile kart/birim çevresinde geniş taban gölgesi + `ensureFootTex` ile birim ayaklarının altında koyu temas gölgesi ve hafif sıcak ışık havuzu) eklendi.
- Birimlerin sol üst kenarına `ensureRimTex` ile hafif kenar ışığı (`PAL.skin3`) eklendi.

### 7. Sahadaki Deste Yığınlarının 3B Görünümü (`src/duel/PileView.ts`)
- `src/duel/PileView.ts` içinde `v3` görünümünde sahadaki deste yığınlarının az kartlı test senaryolarında bile dolgun 3B kağıt katmanlarıyla (`V3_MAX_LAYERS = 8`) görünmesi sağlandı.

### 8. Düellocu Podyumları ve Gölgeleri (`src/art/arena-nt/pads.ts`, `src/view/light/LightLayer.ts`)
- `src/art/arena-nt/pads.ts` içinde düellocu podyumlarının üst yüzeyi açık arduvaz (`G[2]`) yapılarak düellocunun ayaklarının altındaki koyu eliptik temas gölgesinin (`NT_PAL.ink` -> `N[0]`) net biçimde okunması sağlandı.
- `src/view/light/LightLayer.ts` içinde her iki düellocu podyumunun altına yumuşak taban gölgesi ve ayak gölgesi eklendi.

### 9. Sıcak Titreşen Meşaleler ve Radyal Işık Haleleri (`src/art/arena-nt/lights.ts`, `src/view/board-nt/lights.ts`)
- `src/art/arena-nt/lights.ts` içinde koyu demir şamdan/mangal gövdeli ve çok tonlu canlı alevli (`white` -> `gold4` -> `gold3` -> `fire3` -> `fire2`) 3 karelik meşale piksel sanatı çizildi.
- `src/view/board-nt/lights.ts` içinde hedef görseldeki 6 konuma (`(115, 52)`, `(254, 46)`, `(384, 46)`, `(508, 82)`, `(148, 282)`, `(554, 242)`) meşaleler ve arkalarına yumuşak radyal sıcak kehribar-turuncu ışık haleleri (`TORCH_GLOW_KEY`) yerleştirildi.

### 10. Katmanlı, Yumuşak Süzülen Sis Bulutları (`src/view/board-nt/lights.ts`)
- `src/view/board-nt/lights.ts` içinde çok loblu yumuşak radyal gradyanlı sis dokuları (`FOG_BANK_KEY`, `FOG_WISP_KEY`) oluşturularak sol/sağ hologram heykellerinin çevresinde, tribünlerin üzerinde ve platformun alt köşelerinde yavaşça süzülen katmanlı sis bulutları oluşturuldu.

### 11. Arka Plan ve HUD İnceltmeleri (`src/art/arena-nt/wall.ts`, `stands.ts`, `screens.ts`, `apron.ts`, `src/view/v3/hudSkin.ts`)
- Tribünler, arka duvar, makineler ve platform çevresi koyulaştırıldı ve kontrastı düşürüldü.
- HUD panelleri ve butonlarının çerçeveleri inceltildi, neon parlamaları azaltıldı.

## Oturum 2 (2026-11-02) — devam, küçük adımlar

### Başlangıç durumu
- Dalda önceki oturumdan 5 commit vardı (`9d18b3b` … `2b39735`) + 18 dosyada commit edilmemiş deneme
  (sıcak erik-arduvaz `PAL.slate*` tonları, kart quantizer'ında `ARENA_ONLY_COLORS` filtresi, kalibre değişmiş
  zemin, kalabalık blitter'ı gizleme …). Bu deneme `src/art/cards.ts` / `src/art/palette.ts` gibi görev dışı
  dosyalara dokunduğu için **silinmedi, `git stash`'e alındı**: `stash@{0}` "okunurluk: uncommitted WIP from earlier
  session (18 files)". Gerekirse `git stash show -p 'stash@{0}'` ile incelenebilir.
- `npm install` (exit 0), `npx playwright install chromium` (exit 0; chromium-1194 = playwright-core 1.56.1).
  Not: Windows PowerShell'de `npm.ps1` engelli → `npm.cmd` / `npx.cmd` kullanıldı.
- **v1 bazları dokunulmamış taban commit'te yeniden çekildi** (`d5dc22b`, `git checkout d5dc22b` → `--write` → dala
  dönüş): `shots/v3/a3/baseline/v1films` 17 film yazıldı, `shots/v3/a56/baseline/a6v1films` 26 film yazıldı
  (ikisi de exit 0; manifest `git.head = d5dc22b…`, `srcDirty: false`). Önceki oturumun bazları
  `v1films.prev-earlier` / `a6v1films.prev-earlier` adıyla kenara alındı.
- HEAD `2b39735` kapıları: `tsc` temiz, v1 **17/17 IDENTICAL**, a6v1 **26/26 IDENTICAL**,
  palcheck (`shots/ok/head-2b39735.png`) PASS (off 43.03 %, white 0.88 %).

### Adım 1 — platform yan zırhındaki neon şeritler bir ton kısıldı (`src/art/arena-nt/platform.ts`)
- `STRIP_TONES` (P1 cyan / P2 crim): `cyan0..cyan2` → `night1/cyan0..cyan1` (kırmızı aynı biçimde). Yan duvarda
  parlak neon boru yerine soluk oyuncu renkli bir derz kalıyor (hedefte platform yanı koyu ve sakin).
- Köşe sütunlarının şerit/kapak vurgusu `ramp[1]` → `ramp[0]`.
- Görüntü: `shots/ok/s1-strips.png` (öncesi `shots/ok/head-2b39735.png`).
- `tests/art/arena-nt-*.test.ts`: 17/17 geçti.
- Kapılar: `tsc` temiz, v1 17/17, a6v1 26/26 IDENTICAL, palcheck PASS (off 43.35 %, white 0.87 %). Commit `7aedab2`.

### Adım 2 — oyuncu panellerinin çerçevesi bir ton sakinleşti (`src/view/v3/hudV3.ts`)
- Panelin dinlenme çerçevesi (`restTrim`): aktif `cyan2/cyan3` → `cyan1/cyan2`, pasif `cyan1/cyan2` → `cyan0/cyan1`
  (P2 kırmızı aynı biçimde). Açılış merdiveni (`stage`) ve `wake 'up'` aynı oranda bir ton aşağı kaydırıldı;
  beyaz flaş ve `trimOverride` değişmedi. Konum, boyut, yazı aynı. Paylaşılan `styleTrim` / `FRAME_V3` sabitleri
  (testlerde sabitlenmiş) **değişmedi**; yalnızca panelin istediği kaldırma (lift) değeri değişti.
- Görüntü: `shots/ok/s2-hudpanel.png` (öncesi `shots/ok/s1-strips.png`, yakın plan `shots/ok/hud-bl.png`).
- tsc temiz, vitest (HUD + arena-nt) 102/102. Film kapıları yarıda kesildi (v1 ilk 4 film IDENTICAL). Commit `e85231b`.

### Sahip kararı (2026-11-02): kontroller atlanıyor, doğrudan hedefe benzetme
Sahip: "hiçbir kontrol yapma, arenayı direkt hedef görsele benzet, neresi olmadı ben söylerim". Bu andan sonra
**film kapıları (v1 / a6v1), vitest ve palcheck çalıştırılmadı**; yalnızca `tsc` ve her adımda bir ekran görüntüsü.
Claude birleştirmeden önce kapıları çalıştırmalı.

### Adım 3 — arka plan gri taşa, zemin taşa, sis griye (mevcut paletle, A seçeneği)
- `src/view/board-nt/calm-remap.ts` (yeni) + `src/view/board-nt/textures.ts`: arka plan katmanlarının
  (wall, stands, crowd, platform, apron, pads) dokuları kayıt anında bir PAL→PAL tablosundan geçiyor:
  lacivert `night*` / `steel` / `mist` / `void*` → `stone0..3`; neon `cyan/crim/mag/teal/water` iki ton aşağı.
  Sıcak tonlar (gold, fire, earth, skin) olduğu gibi → meşaleler ve sıcak ışık sıcak kalıyor.
  Yalnızca Neon Tower (v3) dokuları; v1 arenası bu yoldan geçmiyor.
- `src/view/board-nt/lights.ts`: sis gradyanı mavi → nötr gri.
- `src/art/arena-nt/holo-bake.ts`: iki hologram heykel gri taş tonlarında (büyücüde bir tutam `void1`).
- `src/art/arena-nt/platform.ts`: üst plaka tek sakin taş tonu (`stone1`), yalnızca uzak sağ-alt köşe `stone0`.
- `src/art/arena-nt/floor.ts`: slot içleri saydam (yalnızca 1-px çizgi), plaka ve ışık altından görünüyor.
- `src/view/board-calm/BoardViewCalm.ts` (+ `skip.pads`, ek alan) ve `src/view/board-nt/index.ts` (`NT_SKIP.pads`):
  sakin tahtanın kendi lacivert pad görselleri v3 Neon Tower'da alpha 0.
- `src/view/light/LightLayer.ts`: sol üst sıcak anahtar ışık tüm plakayı kapsıyor, daha geniş ve daha sıcak
  (`ensureKeyLightTex`, doku plaka boyutunda).
- Görüntüler: `shots/ok/s3-grey.png` → `s5-pads.png` → `s6-key.png` → `s7-statue.png` (son hâl).
- `docs/v3/ref/okunurluk-sonrasi.png` = `s7-statue.png`. `okunurluk-oncesi.png` (taban `d5dc22b`) değişmedi.

### Adım 4 — hedef-1 renkleri + hedef-2 sisi; yumuşak kare çizgileri, plaka dokusu, düşen gölgeler (commit `65324b0`)
- Gri remap kapatıldı (`calm-remap.ts` `CALM_LAYERS` boş), hologramlar yeniden mavi/mor ve parlak (alpha 0.72).
- `src/view/board-nt/floor.ts`: slot çizgileri 2D canvas ile yumuşak (anti-alias) çiziliyor; plaka üstüne taş plaka dokusu.
- `src/view/light/LightLayer.ts`: birimlerin altında sağ-alta düşen uzun gölge (`ensureCastShadowTex`).
- **Not**: bu yumuşak katmanlar paletin dışında → palcheck FAIL (aşağıda). Hedef-3 adımlarında basamaklı/dither'a çevrilecek.

### Adım 5 — seyirci + tribün katmanları kaldırıldı (commit `fb7243b`, `src/view/board-nt/index.ts`)

## Oturum 3 — hedef-gorunum-3 (sahip, 2026-11-02)

### Adım 0 — mevcut işi it (push)
- `git pull`: güncel (yerel dal uzaktakinin 11 commit önünde; `8ff6b78` uzaktaki hedef-3 dokümanlarını birleştirdi).
- Sahip kararı: palcheck FAIL olsa da mevcut iş itilsin, log'a yazılsın.
- Kapılar (`8ff6b78`):
  - `npm run typecheck`: temiz.
  - `npx vitest run`: 8 başarısız / 1448 geçti. 6'sı bilinen (cardface-v3 G1, cloud_hatchling "no cyan", dusk_ashen,
    hourglass_imp, shield_titan, crag_axeman "own voice"); 2'si yük altında 5 s zaman aşımı (hollow_ogre,
    mudgrasp_spirit — film kapısı paralel çalışırken). Yeni gerçek hata yok.
  - palcheck (`shots/ok/s10-nostands.png`): **FAIL — off 57.99 % > 50 %** (yumuşak slot çizgisi, doku, sis, gölge
    gradyanları). Hedef-3 adımlarında düzeltilecek.
  - filmdiff v1 / a6v1: bkz. aşağıdaki sonuç satırı.
- Not: görüntüleyicim bu oturumda resim göstermeyi reddediyor ("media omitted"); ekran görüntülerini sahip inceliyor.

### Sahip kararları (hedef-3 için)
- Sahne ana hatları: karo satırlarına paralel sıkı dikdörtgen (küçük pah köşeler); iki düellocu sahneye bitişik
  ayrı kürsülerde. `tests/view/board-nt-layout.test.ts` "tek dışbükey sekizgen iki pedi içerir" testi bu tasarıma
  göre güncellenecek.
- Yan duvar: `FACE_H` testi 45..60 px ve sahne altı ≤ y 320 ile sınırlı; yakın kenar y 262'de. "3 kat" sığmıyor →
  sığan en yüksek (≈ 56–60 px) + daha belirgin derz/ışıklar.

- Adım 0 sonucu: v1 film kapısı 16/17 IDENTICAL + `spBoltAce` ERROR (yük altında yakalama zaman aşımı, piksel farkı
  değil). a6v1 yarıda kesildi. Mevcut iş `8dec27b` olarak itildi.

### Sahip kararı (2026-11-02, ikinci kez): test yok, doğrudan kod — sahip test edip sonucu söyleyecek
Bu andan sonra hiçbir kapı (tsc hariç, o da arka planda) ve ekran görüntüsü alınmadı; adımlar commit + push.

### h3-a — kalın sahne duvarı (`5380fac`)
- `layout-nt.ts` `FACE_H` 52 → 58 (test sınırı 45..60, sahne altı y 320). `platform.ts`: yüz satırları `FACE_H`'den
  üretiliyor (`faceRows`): sıcak üst pah (`earth2`/`earth1`), 16 px üst zırh (perçinler), ışık kanalı, ana panel
  (dikey kaburga çifti / havalandırma / lamba varyantları), her panelin kemerinde oyuncu renginde küçük lamba.
  `PLATFORM_BOX.h` 284 → 290. `apron.ts`: zemin gölgesi 14 → 30 px, basamaklı (ink → iki ton aşağı → 2×2 dither).

### h3-b — karo satırlarına paralel sıkı sahne (`904eb81`)
- `PLATE_R0/R1` −1.9375/5.9375 → −0.875/4.875 (her yanda 0.375 karo pay). Sekizgen: küçük pah (uç/uç 6–10 px).
  Yakın-sağ köşe x 364 korunuyor (lights.ts ayrımı). Köşe küpleri kaldırıldı.
- `tests/view/board-nt-layout.test.ts`: "sekizgen iki pedi içerir" → "karo ızgarasını içerir; her kürsü sahneye
  değer" (sahip kararı).

### h3-c + d — sığ gömme karolar, plaka dokusu, basamaklı kürsüler (`c227a97`)
- `art/arena-nt/floor.ts`: slot = 1-px cyan2/crim2 kenar (dolu/sıradaki tarafta bir ton yukarı), uzak kenarlarda
  2 px koyu iç duvar (ink + night0), yakın kenarda 1 px parlak dudak, iç zemin 2×2 dither; dolu slotta oyuncu tonu.
  `view/board-nt/floor.ts`: yumuşak canvas slotları ve doku kapatıldı (palet kuralı) → piksel atlas.
- `platform.ts` `topTone`: piksel taş plakalar (yarım karo üzerinde ink derz + stone2 dudak, plaka başına ton/dither).
- `art/arena-nt/pads.ts`: kürsü = 3 basamak (her basamak 6×3 px geniş, 4 px yüksek), her yükseltinin ilk satırı oyuncu
  renginde ışık çizgisi (seviyeye göre parlar). `PAD_CANVAS` 58×35 → 86×52 (merkez = ayaklar, konum aynı).

### h3-e — duvar şamdanları, direk üstü mangallar, salon sütunları/sancaklar, borular, alçak sis (bu commit)
- `art/arena-nt/lights.ts`: `paintMountedTorch('sconce' | 'post')` (demir kol + duvar plakası / taş direk + kaide),
  `paintTorchGlow` (sıralı dither, `fire1`/`earth1`/`earth0`, alfasız; titreme = kare değişimi).
- `view/board-nt/lights.ts`: 4 şamdan sütunların önünde, 2 mangal sahnenin solunda/sağında zeminde; havada meşale yok.
  Sis: yumuşak canvas sisi kaldırıldı → atlasın dither sisi (`fogBack/fogFront/fogWisp`), alçak, 3 katman, yavaş kayan.
- `view/board-nt/backhall.ts` (yeni) + `wall.ts`: 4 taş sütun (taş sıraları, aydınlık sol yüz), üstlerinde oyuncu
  renginde altın amblemli sallanan sancaklar (3 kare), salon zemininde iki boru + perçinli metal plaka.

## Oturum 4 — hedef-gorunum-3 ile kalan farklar (sahip, 2026-11-02)
Sahip: "sahne, kürsüler ve gömme karolar hedefe uyuyor"; 6 madde, her biri bir commit + push. `git pull`: güncel.

### h4-1 — sahne sıkılaştı (`d077089`)
- `layout-nt.ts`: pay 0.375 karo → **5 px** (dış karo çizgisinden sahne kenarına bir kenar genişliği); köşeler
  uzak (288, 59) / sağ (522, 176) / yakın (352, 261) / sol (118, 144), pah 3–4 px. `PLATE_X0/X1/Y0/Y1` 122/518/62/258.
  `FACE_H` 58 → 60 (test sınırı). Yakın-sağ köşe artık x 358 (lights.ts ayrımı ona göre).
- Kürsüler sahne dışında kalınca: `DAIS_LANDINGS` — her düellocunun altında sahneyle aynı yükseklikte, sahneye bağlı
  bir blok (`platform.ts` `paintLanding`: aynı duvar satırları, derz, oyuncu renginde lamba, taş üst, aydınlık kenar).
- Testler: `tests/view/board-nt-layout.test.ts` (kürsü kendi bloğunda, blok sahneye değer; köşe x 358),
  `tests/art/arena-nt-platform.test.ts` (örnek noktalar yeni geometriye).

### h4-2 — sis geri geldi (`05c068c`)
- `art/arena-nt/lights.ts` `paintFogBand` (320 × 48): uzun yassı lob zinciri, tepe `steel`/`night3`, gövde
  `night2`/`night1`, sıralı dither ile incelir, uçları yumuşar (alfasız, palet). 3 varyant.
- `view/board-nt/lights.ts`: 5 bant — 2'si hologram kaidelerinin yanında (sahnenin arkasında), 3'ü zeminde ve ekranın
  alt kenarında, sahnenin ayağının önünde; zıt yönlerde 14–19 s periyotla yavaş kayıyor. Karoları örtmez (derinlik
  sahnenin altında).

### h4-3 — arka duvar siyahtan çıktı (`fc2159d`)
- `wall-parts.ts` `brickWall`: 7 px'lik taş sıraları, ink harç, aydınlık üst/sol dudak, blok başına 3 loş ton, çatlaklar;
  eski bölmeler koyu niş olarak kaldı.
- `calm-remap.ts` `LIFT_LAYERS` ('wall'): duvar katmanı bir ton yukarı (ink → night0, night0 → night1).
- `backhall.ts`: sancaklar iki tarafta da **kırmızı** (P1'de cyan şerit, P2'de altın); şamdanların duvarda küçük sıcak
  halesi (`paintWallHalo`, dither, 3 titreme seviyesi). Salon parçaları ayrı 'hall' katman adıyla (lift onları etkilemez).

### h4-4 — sahne çevresi zemini + hologram kaideleri (`694327c`)
- `apron.ts` `panel`: düz koyu döşeme yerine iso **metal plakalar** — ink derz, aydınlık uzak dudak, köşe perçinleri;
  her 3 plakadan birinde ızgara, bazılarında kabartmalı (tread) desen. Uzak salon zemini (`paintFloorTile`) de plaka + ızgara.
- `holograms.ts`: kaide opak (0.55 → 1), halka opak, koni 0.28 → 0.5 → kaideler okunur.

### h4-5 — mangallar ve meşaleler (`a5f866d`)
- `lights.ts` `paintBrazierPost`: geniş demir kâse (kenar + kor), 11 px kalın kare taş direk (aydınlık sol / gölge sağ,
  blok sıraları), iki basamaklı kaide. `paintTorchPool` (72 × 30): mangalın ayağı etrafında zeminde dither sıcak ışık
  havuzu (`earth1`/`earth0`/`skin0`), alevle birlikte titrer. Şamdanlar: duvarda küçük hale (h4-3).

### h4-6 — sahne ön yan duvarlarında ışıklı pencereler (`f60d2d6`)
- `platform.ts`: havalandırmasız her panelin üst plakasında 4 × 5 px küçük pencere sırası (ink çerçeve, oyuncu renginde
  cam, sol üst piksel en parlak) — P1 tarafında cyan, P2 tarafında kırmızı; kemer lambaları bir ton daha parlak.

### h4-pal — palet kuralı (`2917a45`)
- `LightLayer.ts` `ditherToPalette`: birim gölgesi (düşen + taban) ve ayak havuzu canvas'ta boyanıp **4×4 sıralı dither
  ile palete** (ink / night0 / skin0 / earth1, alfa 255 ya da 0) çevriliyor; sıcak anahtar ışık da `earth1` dither.

### Kapılar (son madde sonrası, `2917a45`)
- `npm run typecheck`: **temiz**.
- `npx vitest run`: 8 başarısız / 1448 geçti — oturum başındakiyle **aynı 8** (6 bilinen + hollow_ogre / mudgrasp_spirit
  5 s zaman aşımı, yük altında). **Yeni hata yok**; arena testleri (güncellenen ikisi dahil) geçiyor.
- `node tools/palcheck.mjs shots/ok/h4-final.png`: **PASS** — off **4.30 %** (önce 57.99 %), white 0.88 %, bands 0.
- `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films --jobs 1`: **17/17 IDENTICAL** (333 s; önceki
  turdaki `spBoltAce` yakalama hatası `--jobs 1` ile yok).
- `node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films --jobs 1`: **26/26 IDENTICAL** (458 s).
  → v1 görünümü piksel piksel aynı.
- `docs/v3/ref/okunurluk-sonrasi.png` = `shots/ok/h4-final.png` (`?dev=duel&s=a6Hover&look=v3`, 640 × 360).
- Not: kapılar sırayla çalıştırıldı (`shots/ok/finalgates.cmd`); paralel çalışınca makine yükünden yakalama zaman aşımı
  oluyor.

### Açık konular
- Görüntüleyicim bu oturumda resim göstermiyor; görsel karşılaştırmayı sahip yapıyor.
- Kapılar (vitest, palcheck, filmdiff v1/a6v1) h3 adımlarında çalıştırılmadı (sahip kararı); Claude birleştirmeden
  önce çalıştırmalı. `tests/art/arena-nt-platform.test.ts` op(213, 232)/op(213, 214)/op(320, 270) örnek noktaları eski
  sekizgene göre — yeni şekle göre güncellenmesi gerekebilir.
- `LightLayer.ts` hâlâ yumuşak (canvas) gölge/anahtar ışık dokuları kullanıyor → palcheck için basamaklıya çevrilmeli.
- Film kapıları ve palcheck bu adımdan sonra çalıştırılmadı (sahip kararı).
- Ekran görüntüleri yük altında bazen `__neon.ready` zaman aşımına düşüyor, görüntü yine de yazılıyor.
- Sahibin geri bildirimi bekleniyor (hangi bölge hedefe benzemedi).

## Kontrol Kapıları (Gates)
- `npm run typecheck`: Temiz (0 hata)
- `node tools/palcheck.mjs docs/v3/ref/okunurluk-sonrasi.png`: `PASS` (`off 43.39% <= 50%`, `white 0.88% <= 1.5%`)
- `node tools/palcheck.mjs shots/ok/final-film.png`: `PASS` (`off 41.44% <= 50%`, `white 1.13% <= 1.5%`)
- `npx vitest run tests/art/arena-nt-*.test.ts`: 22/22 test geçti
- `v1` ve `a6v1` `filmdiff`: 17/17 ve 26/26 `IDENTICAL`
