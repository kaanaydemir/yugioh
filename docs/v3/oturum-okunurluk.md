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

### Açık konular
- Film kapıları ve palcheck bu adımdan sonra çalıştırılmadı (sahip kararı).
- Ekran görüntüleri yük altında bazen `__neon.ready` zaman aşımına düşüyor, görüntü yine de yazılıyor.
- Sahibin geri bildirimi bekleniyor (hangi bölge hedefe benzemedi).

## Kontrol Kapıları (Gates)
- `npm run typecheck`: Temiz (0 hata)
- `node tools/palcheck.mjs docs/v3/ref/okunurluk-sonrasi.png`: `PASS` (`off 43.39% <= 50%`, `white 0.88% <= 1.5%`)
- `node tools/palcheck.mjs shots/ok/final-film.png`: `PASS` (`off 41.44% <= 50%`, `white 1.13% <= 1.5%`)
- `npx vitest run tests/art/arena-nt-*.test.ts`: 22/22 test geçti
- `v1` ve `a6v1` `filmdiff`: 17/17 ve 26/26 `IDENTICAL`
