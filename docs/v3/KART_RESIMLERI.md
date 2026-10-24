# Kart Resimleri v3 — Stil Sayfası

Kullanıcı: "kartların üzerindeki resimler çok kötü görünüyor". Ölçülen nedenler: resim penceresi 44×34;
inceleme paneli kartı 2× gösteriyor, her resim pikseli 2×2 blok oluyor; arka planlar dither'lı gradyan
(bugünkü büyü / tuzak resimleri: 54–155 ton, yalıtık piksel %23–56, damalı alan %1,7–9,9); canavar
resimleri eski sprite kırpımları. **Karar:** her resim iki kez çizilir: 88×68 (2× yoğunluk, büyük
görünümde ekranda 1:1) ve elle ayarlanmış 44×34. Dil, onaylı sabit karelerin dilidir
(`src/still/*-map.ts` başlıkları, REHBER §1–§3). Sözleşme: `src/art/cardart-v3/_types.ts`
(`CardArtV3`, `ART_BIG`, `ART_SMALL`). Kit: `src/art/cardart-v3/_kit.ts`. Render betiği: §9.

## 1. Boyutlar

| Sürüm | Boyut | Nerede görünür | Yoğunluk |
|---|---|---|---|
| **big** | 88×68 | İnceleme panelinin 2× kartı, galeri sahnesi, kartı 2× gösteren her yer | ekranda 1:1 |
| **small** | 44×34 | 1× yüz: el, seçici, uçan kart, galeri ızgarası | ekranda 1:1 |

- big'in 1 pikseli tahtadaki canavarın 1 pikselidir: gerçek 1 px detay, hiçbir yerde 2×2 blok yok.
- Üç katman: `backdrop` (bantlar + ışık şekli) → `subject` (madde, ink konturlu) → `light` (göz,
  kıvılcım, çekirdek, büyü; konturdan sonra çizilir, konturlanmaz).
- **small'ın yapılışı (tercih sırasıyla):** (1) *aynı resim, daha yakın:* big'in kaynağının 1:1 daha
  sıkı kırpımı (v3 canavarda sabit kare pikselleri: yüz + çekirdek); (2) *aynı geometri 1×
  yoğunlukta yeniden çizilir* (kodla çizilen efektler, motiflerin küçük sürümleri: zincirin `'sm'`
  halkası); (3) *indirgeme + elle düzeltme:* `reduceSubject` başlangıçtır, betik sonucu ASCII harita
  olarak döker, harita elle düzeltilip `patch` ile basılır. Kör küçültme (`autoSmall`) yalnız
  taslaktır (betik "OTOMATİK" der). Her small 1×'te ve ×6'da kontrol edilir.
- İki sürümde odak, tarif ve ışık şekli aynıdır. Elde küçük, panelde büyük açılan kart aynı resim
  olarak tanınmalıdır.

## 2. Kompozisyon ızgarası ve güvenli paylar (big; small = yarısı, sabitler `_types.ts`'te)

- **Çerçeve payı:** v3 çerçevesi dış halkayı örter: 1×'te 1 px (x 0 / 43 ink, y 0 aydınlık, y 33
  koyu bezel), 2×'te 2 px. Görünen alan big 84×64 (2,2), small 42×32 (1,1). Halkaya da arka plan
  boyanır; oraya önemli hiçbir şey konmaz.
- **Ufuk** (zemin bandının ilk satırı) varsayılan big y 48 / small y 24. **Üçte birler:** x 30 / 58,
  y 22 / 44.
- **Odak kutusu** (göz, çekirdek, efektin sıcak noktası): big x 12–75, y 8–53; small x 6–37, y 4–26.
  Painter odağı `focus` ile (small kırpımı farklıysa `focusSmall` ile) bildirir; betik denetler.
- **Özne:** sınır kutusu görünen alanın %60–75'i (big). Alttan ve arka (sol) kenardan taşabilir; baş
  ve odak hiç kesilmez; başın üstünde ve önünde ≥ 4 px (small 2) hava.
- **Teğet yok:** kenara 1–3 px uzaklıkta paralel kontur olmaz: ya ≥ 4 px uzak ya kararlı taşma.
- **Işık şekli** odağı çerçeveler: merkezi odakta ya da 2–6 px arkasında.

## 3. Işık, düzlem, kontur (REHBER §1'in kartta uygulanışı)

- **Işık:** tek anahtar ışık, sol üst (IŞ-1). Kart P1 / P2'de yeniden ışıklandırılmaz. Canavar sağa bakar.
- **Düzlemler:** her biçimde 2–4 düz değer düzlemi (aydınlık / orta / gölge, gerekirse alta dönen
  ton). Bant big'de ≥ 2 px; 1 px yalnız kenar ışığı, vurgu ve dikişte (IŞ-3). Malzeme tonları ve
  değer kararları stillerdeki gibidir (`titan-map.ts` / `serpent-map.ts` başlıkları).
- **Kıvrım bantları (IŞ-5):** üstte duran parçanın arkasında, arkadaki yüzeyin 1–2 ton koyusu (ink
  değil). Öndeki parça arkadakine 1 ton koyu gölge düşürür (IŞ-6).
- **Kenar ışığı (IŞ-7):** gölge tarafındaki konturun hemen içinde kesintisiz tek 1 px çizgi, arka plan
  ışığının renginde (tarifin `rim`'i, kit `rim`). Sabit karenin arena kenar ışığı bu renge çevrilir
  (kit `recolor`; ör. ejderin cyan2'si → gold2): büst böyle yeniden ışıklandırılır. Resimde tek
  kenar ışığı rengi olur.
- **Vurgu (IŞ-8):** 1 px yalnız ışığa bakan kenarda (kit `litEdge`); resim başına en çok bir parıltı.
- **Malzemeler (MA-2, MA-3):** taş blok ve çatlakla, metal keskin kırık ve tek parıltıyla, kumaş geniş
  bantla, büyü küçük doygun ışıkla okunur. Doku ton bandıyla verilir, gürültüyle verilmez.
- **Kontur (IŞ-9):** maddenin dış konturu 1 px `PAL.ink`, 4 komşulu (kit `ink`). İç ink yalnız aynı
  değerdeki iki parça karışacaksa. Pencere kenarında kesilen yer ve halka deliği konturlanmaz.
- **Değer sırası:** öznenin aydınlık düzlemleri resmin en açık geniş alanlarıdır; arka plan ışığı
  onlardan koyu kalır; en parlak tek nokta odaktır.

## 4. Arka plan tarifleri (kit `paintBackdrop(p, tür, { focus })`, `BACKDROPS`)

Her tarif: iki düz gökyüzü bandı, zemin bandı, 1 px ufuk çizgisi ve **tek** basamaklı ışık şekli
(basamak big 4–8 px, small 2–4 px). Geniş alanlar rampanın 0–2. tonlarıyla boyanır; 3. ton yalnız
≤ 2 px kenar çizgisinde. Arka plan ≤ 6 ton; dither, gradyan, benek yok.

| Tür | Gökyüzü üst / alt | Zemin + ufuk | Işık şekli | Tonlar (dış → iç) | Kenar ışığı |
|---|---|---|---|---|---|
| IŞIK | night1 / night2 | night0 + gold1 | hale: basamaklı güneş diski + 8 kısa düz ışın | gold1, gold2 | gold2 |
| KARANLIK | night0 / void0 | ink + void1 | tutulma: koyu disk + basamaklı taç | void1, void2, void3 (2 px); merkez night0 | void3 |
| ATEŞ | night0 / fire0 | stone0 + fire1 | ocak: ufuktan yükselen basamaklı kubbe | fire1, fire2 | fire2 |
| SU | water0 / night1 | night0 + water1 | sol üstten odağa inen eğik ışık sütunu | water1, water2 | water3 |
| TOPRAK | earth0 | stone0 + earth1; earth1 basamaklı mesa sırtı | sırtın ardında alçak tozlu güneş | earth2, earth3 | earth3 |
| RÜZGÂR | night0 / leaf0 | night0 + leaf1 | odağı saran, sağa açık iki yay | leaf1, leaf2 | leaf3 |
| BÜYÜ | night0 / night1 | night0 + teal1 | büyü çemberi: kenarı aydınlık koyu kuyu | teal2, teal1, teal0 | teal3 |
| TUZAK | night0 / night1 | night0 + mag1 | basamaklı elmas, kenarı aydınlık | mag2, mag1, mag0 | mag3 |

- **Canavar** ışığın önünde durur: silüeti ışığa karşı okunur. **Büyü / tuzakta** efektin kendisi
  ışıktır: koyu kuyu ve aydınlık kenar onu çerçeveler. Efekt büyük bir ışık kaynağıysa (şimşeğin
  çakması, lav sütunu) `{ shape: false }`: efektin kendi basamaklı ışığı tek ışık şekli olur.
- `{ pool: true }`: ışığın zemindeki basamaklı havuzu (ayakta duran özneler).
- Tonlar karta göre değişebilir; kural değişmez: aynı rampadan 2–3 basamak, en çok 6 ton.

## 5. Canavar resmi ↔ sprite

- **Sabit karesi onaylı v3 canavarlar** (Ejder, Büyücü, Muhafız, Titan, Yılan): big = `src/still/*`
  pikselleri 1:1 (büst ya da tam boy kırpım, ölçek yok), kenar ışığı kart ışığına çevrilmiş (§3).
  small = aynı karenin daha yakın 1:1 kırpımı (yüz + odak), aynı tarif. Özne iyi bir 1:1 kırpımda
  %60'a ulaşmıyorsa (ör. Muhafız 48×49) aşağıdaki kural uygulanır; görüntü asla büyütülmez.
- **Eski çizimli canavarlar** (Kor Kurdu, Gelgit Golemi, Fırtına Atmacası, Işık Perisi, Gölge
  Suikastçı, Şimşek Kertenkelesi, Dikenli Pusucu): sabit karelerin dilinde **yeni bir çizim**, aynı
  karakter. Silüet, parçalar ve dizilişi (boynuz, kanat, kuyruk, silah), oranlar, renk aileleri ve
  bakış yönü korunur; yeniden tasarım yok. Önce v1 idle f0 1:1 incelenir; çizim big boyunda elle
  yerleştirilmiş haritadır (stillerin yöntemi: harita + `KEY`); small haritanın indirgenip elle
  düzeltilmesi ya da ikinci bir küçük haritadır.
- Bu karar, A5_PLAN §3.7.2'deki "eski çizimli canavar eski resmini korur" kuralının yerine geçer.

## 6. Büyü ve tuzak

- Resim, oyundaki v3 efektiyle aynı imgedir (A5_PLAN §3.7.2): big'de `src/art/spellmotifs-v3.ts`
  motifleri sahne yoğunluğunda (1:1); small motiflerin küçük sürümleriyle yeniden çizilir, indirgenmez.
- Sahne öğeleri (bulut, zemin, mezar taşı, levha) düz bantlı ve ink konturlu; efektin ışığı `light`
  katmanında.

## 7. Palet

- Yalnız `PAL` / `RAMPS` (`src/art/palette.ts`); `mix()`, alfa, palet dışı ton yok. Resimde ≤ 20 ton,
  arka planda ≤ 6, malzeme başına ≤ 5. P1 / P2 renkleri (cyan / crim) özneye yalnız malzemesiyse girer
  (ejderin camı). `ATTRIBUTE_RAMP` yalnız nitelik vurgusunda (göz, mücevher, büyü ışığı).

## 8. Yasaklar

- Dither (`dither`, `ditherAt`, Bayer), gradyan (`vgrad`, `rgrad`, `artVGrad`, `artRGrad`), parıltı
  karışımı (`artGlow`, `mix`, alfa < 255), `bevel()`, rastgele benek, `Math.random`.
- Yumuşak / HD / 3B görünüm, ADD karışımı, gökkuşağı folyo, resimde yazı ya da logo.
- 44×34'ü 2× göstermek; sprite'ı ölçekleyip düzeltmeden bırakmak; kesirli ölçek ya da döndürme;
  kör küçültmeyi son ürün saymak.

## 9. Kit ve render betiği

- **Kit** (`_kit.ts`; geometri big pikselinde verilir, small tuvalinde yarıya iner): katmanlar
  `newLayers`, `flatten`, `renderArt`; arka plan `paintBackdrop`, `BACKDROPS`, `bands`, `steppedDisc`,
  `steppedEllipse`, `steppedRing`, `steppedDiamond`, `spikes`, `shape`; özne `ink`, `rim`, `litEdge`,
  `rampStep`, `recolor`, `CARD_LIGHT`; küçültme `reduce2x`, `reduceSubject`, `reduceLight`,
  `autoSmall`, `patch`, `asciiMap`; sayılar `artStats`, `isolatedRatio`, `checkerCount`, `diffRatio`.
- **Render betiği** (iş kopyası, ileride `tools/`'a taşınabilir), `/home/user/yugioh` içinde:
  `S=/tmp/claude-0/-home-user-yugioh/ddad49c9-4c8a-50de-b30a-2b20a3666243/scratchpad/v3/cardart/style`
  `npx vite-node --config $S/vite.config.mjs $S/render.ts -- --painter DOSYA | --id ID | --all | --backdrops [--frame N] [--frames] [--out DİZİN]`
- Çıktılar (varsayılan `shots/v3/cardart/style/`): `-big` ×1/2/3, `-small` ×1/2/3/6; (a) `-inspect`
  inceleme paneli maketi (2× kartta big 1:1); (b) `-hand` 1× yüz; (c) `-vs` bugün | yeni aynı ekran
  boyunda; `-small-subject.txt` ASCII harita; `.json` sayılar.
- Örnek painter'lar `$S/samples/`: `magma_titan` (still 1:1 + yakın kırpım), `crystal_wyrm` (büst),
  `chains_of_light` (motif, iki boyda doğal çizim), `magma_titan_reduce` (indirgeme).

## 10. Kabul (her resim, iki boy)

- **Sayılar** (betik): palet dışı 0; yalıtık piksel ≤ %10 (IŞ-10); damalı 2×2 ≤ görünen alanın
  %0,5'i (dither'ı yakalar; sabit kareler %0,2–0,3); ton ≤ 20 / arka plan ≤ 6; özne doluluğu
  %60–75 (big); dış konturun ≥ %90'ı ink; odak kutuda; small "OTOMATİK" değil.
- **Göz:** big ×1 ve ×3, small ×1 ve ×6, (a), (b), (c): hepsine bakılır. 1×'te silüet, odak ve
  nitelik / tür okunmalı.
- **Yaşayan resim (A5_PLAN §3.7.6):** `frames` / `holdMs`, her kare iki boyda; yalnız palet döngüsü
  ve ≤ 2 px hareket; betik `--frames` ile şerit çıkarır.
- **Entegrasyon:** 2× kart big'i 1:1 göstermeli (2× yüz dokusu ya da pencereye 1:1 resim); 2× bezel
  dış 2 px'i örter. Elde small 1× yüzde durur. Kart yüzleri yalnız `V3_CARDS` altında değişir.
