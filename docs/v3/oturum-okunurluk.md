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

## Kontrol Kapıları (Gates)
- `npm run typecheck`: Temiz (0 hata)
- `node tools/palcheck.mjs docs/v3/ref/okunurluk-sonrasi.png`: `PASS` (`off 43.39% <= 50%`, `white 0.88% <= 1.5%`)
- `node tools/palcheck.mjs shots/ok/final-film.png`: `PASS` (`off 41.44% <= 50%`, `white 1.13% <= 1.5%`)
- `npx vitest run tests/art/arena-nt-*.test.ts`: 22/22 test geçti
- `v1` ve `a6v1` `filmdiff`: 17/17 ve 26/26 `IDENTICAL`
