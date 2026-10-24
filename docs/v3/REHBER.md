# Neon Düello v3 — Stil ve Hareket Rehberi (A3)

Bu belge, A4–A7'de ve sonraki yüzlerce kartta yapılan her canavarın, kartın ve efektin **neye göre
yapıldığını ve neye göre yargılandığını** belirler. Kurallar genel tavsiye değildir: A2 dikey
diliminin (Kristal Ejder `crystal_wyrm`, Uçurum Büyücüsü `abyss_magus`, Yıldırım Hükmü, Işık
Zincirleri) koddaki ve ölçümdeki gerçek değerlerinden çıkarıldı. Her kural ×3 sayfaya bakarak ya da
bir sayıyla denetlenebilir. Kanıtlar `shots/v3/a2/`, `shots/v3/a2f/` ve
`<scratch>/v3/a3/guide/` (A3 için yeniden üretilen sayfalar) altında.

- **Öncelik sırası:** CLAUDE.md altın kuralları > bu rehber > `docs/ANIMASYON_PLANI.md` §4–§5 >
  `docs/GAME_DESIGN.md` §4–§5. Çakışmalar §0.3'te listeli.
- **"Taslak (A4'te doğrulanacak)"** yazan kurallar dilimde bulunmayan malzeme ya da gövde
  tiplerinden mantıkla türetildi. İlk kullanan canavar onları doğrular ya da düzeltir. Düzeltme bu
  belgeye yazılır.
- Kod kimlikleri ve dosya yolları İngilizcedir. "Dilim" sütunu A2'de ölçülen değerdir.

---

## 0. Nasıl kullanılır

### 0.1 Kural kimlikleri

| Önek | Alan | Bölüm |
|---|---|---|
| IŞ | ışık, düzlem, kontur, gürültü, palet | §1 |
| MA | malzemeler | §2 |
| Sİ | silüet, oran, kare | §3 |
| HA | hareket | §4 |
| SÜ | süreler | §5 |
| EF | efektler ve ışık katmanı | §6 |
| SE | ses | §7 |
| KK | kalite kapıları | §8 |

İnceleme notlarında kural kimliği verilir ("IŞ-9 ihlali: kanat içinde ink çizgi").

### 0.2 Katmanlar (as / normal / sıradan)

Katmanlar **kuralları değiştirmez**. Kalite kapıları üç katmanda da aynıdır (§8). Katman yalnız ne
kadar özel kod yazılacağını ve kaç özel poz çizileceğini belirler.

| Katman | Tanım | Örnek |
|---|---|---|
| **As** | Tamamen özel rig, elle yerleştirilmiş parça haritaları, karta özgü sinematik ve cut-in. | Kristal Ejder, Uçurum Büyücüsü |
| **Normal** | Gövde tipi rig'i, kendi parçaları ve oranları, en az bir imza pozu ya da eklentisi, sunum tarifi ve gerekirse karta özgü bir vuruş. | A4 canavarlarının çoğu |
| **Sıradan** | Gövde tipi, oranlar, malzeme ve palet, sunum tarifi. Özel kod yok. | ileride gelecek yüzlerce kart |

Her canavar her an tamamen özel koda geçebilir. Yapı paylaşılır, görünüş paylaşılmaz (§8.2).

### 0.3 Eski kurallarla çakışmalar (v3 görünümünde bu rehber geçerlidir)

| Eski kural | v3 kuralı |
|---|---|
| GAME_DESIGN §5.2: "hedefin 1–2 kare **beyaz silüet** flaşı" | Flaş silüetin en çok %45'i, yalnız temas bölgesinde. Açık renkli gövdede kenar flaşı kullanılır (EF-3). |
| GAME_DESIGN §5.3: "kart %15 ezilir, canavar zıplarken uzar, sayılar büyüyüp küçülür" | Kesirli ölçek ve döndürme yok. Sayı tek kare bir boy büyük çıkar (EF-9), esneme pozun içinde çizilir (HA-14). |
| GAME_DESIGN §5.4: "kamera 1.0 → 1.08 zoom" | Zoom her zaman 1, yalnız tam sayı kaydırma (EF-8; 23 Ekim kullanıcı kararı). |
| GAME_DESIGN §4: "bloom bunları öne çıkarır" | Bloom yok, yumuşak parıltı dokusu yok. Basamaklı ışık kullanılır (EF-6). |
| GAME_DESIGN §5.7 süre tablosu | Plan §5 + §5 (bu belge). |
| Plan §3: "pozlar kabaca saniyede 8–16" (62–125 ms) | Kare bekleme süresi 40–200 ms (HA-2). Dilimde 264 karenin 45'i 62 ms'den kısa, 39'u 125 ms'den uzun. |

---

## 1. Işık ve düzlem planı

Bu kuralları bugün dilimin kodu uyguluyor: `src/art/monsters-v3/crystal_wyrm-gbuf.ts`
(G-buffer → değer düzlemleri) ve `abyss_magus-rig.ts` / `abyss_magus-maps.ts` (elle haritalar +
kumaş bantları). Bu yardımcılar şu an canavar dosyalarının içinde. A3 mimarisi onları ortak
modüle taşır; yeni canavar kopyalamaz, paylaşılanı kullanır.

| # | Kural | Nasıl denetlenir | Dilim / kod |
|---|---|---|---|
| IŞ-1 | **Tek anahtar ışık, ekranın sol üstünden.** Vektör (−0,5; −0,74; 0,46): sol üst, biraz izleyiciye doğru. Canavar sağa bakarak çizilir. Her v3 canavarı `p2: 'relight'` taşır: P2 sayfası `{ lightFrom: 'right' }` ile çizilir ve `flipX` ile aynalanınca ışık yine ekranın sol üstündedir. | `monster-sheet --p2`: sayfa ekrandaki gibi aynalı gösterir. İki sayfada da aydınlık düzlemler ekranın sol üstüne bakar. | `LIGHT_LEFT/RIGHT`, `setLight` (gbuf); `drawMagus(p, pose, light)` |
| IŞ-2 | **Işık kararı ışığa göre verilir, sonradan aynalanmaz.** Elle çizilmiş parça haritalarının iki sürümü olur (`_L` P1, `_R` P2). Kendi ışığı olan pikseller (göz, küre, mühür) iki sürümde de aynıdır. | P2 sayfasında hiçbir parçada "ters" aydınlık bant yok. Boyun / kumaş bandı ışık tarafındaki kenarda. | `abyss_magus-maps.ts` (`HELM_R` / `_L` …); ejder boyun bantları `neckTone` |
| IŞ-3 | **Her biçimde aydınlık / orta / gölge düzlemi.** Gerekirse bir de alta dönen 4. ton. Tonlar normal ve ışıktan eşiklerle seçilir (deri: `th [−0,62; −0,28; 0,14; 0,56]`) ya da kenardan ölçülen düz bantlarla verilir (kumaş). Satır satır gradyan, dither ve `PixelCanvas.bevel()` kullanılmaz. Bir düzlem bandı ≥ 2 px'tir. 1 px yalnız kenar çizgilerinde olur (kenar ışığı, vurgu, dikiş). | ×3 sayfada her parça 2–4 düz bant olarak okunur. Gövdenin en büyük düzlemi aydınlık düzlemdir (ejderin "geniş sakin beyaz düzlemi"). | `MATS`, `G.render`; kumaş: cape bantları (`distPoly`) |
| IŞ-4 | **Ton kırıntısı yok.** Nicemlemeden sonra 4 komşulu temizleme yapılır (2 geçiş). Son bir geçiş de gövde içinde yalnız kalan 1 px tonları çevresine katar. Kasıtlı tek pikseller (göz, parıltı) korunur. | ×3 sayfada gövde içinde rastgele tek pikseller yok. Sayısal karşılığı IŞ-10. | `despeckle`, `cleanCrumbs` (+`KEEP` maskesi) |
| IŞ-5 | **Eklem (kıvrım) gölgesi.** Bir parça diğerinin üstüne binince arkadaki yüzeyde bant açılır: üstte 1 px, yanlarda 1–2 px, altta 2–3 px (uyluk karın üstünde: 1 / 2 / 3). Renk arkadaki yüzeyin 1–2 rampa adım koyusudur (`CREASE`). Temas dikişi 1 px ve 1 adım koyudur (`SEAM`). Arkadaki uzuv bir değer koyu malzemeyle çizilir (`HIDE_FAR`) ve gövdeyle arasında tek night1 çizgi olur. | ×3: kol, bacak, kanat kökü ve boyun dibinde koyu bant görülür. Bant ink değildir (ink yalnız dış konturda olur). | `composite(…, crease, Fold)`, `FOLD_LEG` |
| IŞ-6 | **Düşen gölge.** Öndeki parça (kaldırılmış kol, omuzluk) arkadaki yüzeye 1 adım koyu gölge düşürür. Gölge yalnız var olan piksellerin üstüne boyanır, silüeti büyütmez. | ×3: kalkık kolun altında gövdede gölge lekesi var. | `castShadow` (iki rig'de de) |
| IŞ-7 | **Kenar ışığı.** Arenanın soğuk yansıması gölge tarafındaki silüet kenarına düşer: boşluğa bakan kenarda tek sürekli 1 px çizgidir (ejder derisinde `cyan2`). Koyu gövdede ışığa bakan kumaş kenarı 1 px `steel` / `mist` olur (P1), P2'de `void3`. Malzeme başına en çok bir kenar ışığı rengi kullanılır. | ×3: gölge tarafında kesintisiz tek çizgi. Kesik kesik noktalar olmaz. | `rimLight`; büyücü cape kenarı `sp.l[y] − 1` |
| IŞ-8 | **Seçici vurgu.** 1 px kenar vurgusu yalnız ışığa bakan kenarlarda olur (yön · ışık ≥ 0,35). Koyu kenar alt yüzde olur (≤ −0,35). **Parıltı:** anim başına en çok 1 tane, ışıklı kenardaki bir faset köşesinde. Sabit bir pikselde 3 kare sürer: 1 px → 3 px haç → 1 px. Metalde plaka grubu başına tek parıltı olur. | Anim şeridinde parıltı sayısı ≤ 1 ve yer değiştirmiyor. | `edgePaint`, `twinkle`, `GLINT_REF`; büyücü ferrule `mist` pikseli |
| IŞ-9 | **Kontur.** Madde en son 1 px `PAL.ink` dış konturla, 4 komşulu çevrilir (`outline(PAL.ink)`, köşesiz). İç çizgi varsayılan olarak ink değildir: üst üste binmede arkadaki yüzeyin bir adım koyusu kullanılır. Ink iç ayrım yalnız benzer değerdeki iki parça birbirine karışacaksa kullanılır (asa, küre, kafa). **Işık madde değildir:** şarj ışığı, göz parlaması ve boşluk alevi konturdan sonra çizilir ve konturlanmaz. | ×3: iç alanlarda ink yalnız gerekçeli ayrımlarda. Işık pikselleri konturun dışına taşabilir, konturlanmaz. | `p.outline(PAL.ink)` (rig sonu); `comp(…, { out: PAL.ink })`; `glowPass`, ağız ışığı |
| IŞ-10 | **Gürültü bütçesi.** Ölçü: yalıtık piksel oranı = aynı renkte 4 komşusu olmayan opak piksel ÷ opak piksel (`monster-sheet` "isolated" sütunu). Sınırlar: idle ortalaması ≤ %10; gövde karelerinde (idle, guard, hit\*, toGuard / fromGuard, roar, victory) her kare ≤ %15; efekt taşıyan karelerde (attack ve special bırakma, summon / death / revive çözülme) ≤ %20. Referans kareye göre idle f0 ≤ 1,1 × referans. | `monster-sheet` JSON → kare başına `isolated / opaque` (§9.1). | Dilim (P1 / P2): idle %6,6–7,1 (ejder) / %8,2–9,2 (büyücü); gövde en çok %14,7 (büyücü toGuard / guard, kalkan kabuğu); efekt en çok %19,0 (büyücü death / summon). Still: %6,0 / %8,3 |
| IŞ-11 | **Palet.** Renkler yalnız `PAL` / `RAMPS` (`src/art/palette.ts`) içinden gelir. Bir karede gövde için ≤ 20 renk kullanılır. Malzeme başına ≤ 5 ton (cam 6: `cyan0…white`). `ATTRIBUTE_RAMP` yalnız nitelik vurgusunda kullanılır (göz, mücevher, büyü ışığı, çağırma ışığı, madde tonları `MATTER_RAMP`). Gövde rengini malzeme rampası verir. P1 / P2 renkleri (cyan / kızıl) gövdeye girmez. | `monster-sheet --still` "colours"; ×3'te gövdede oyuncu rengi yok. | Dilim idle f0: 17 / 18 renk. Ejder: deri `night2…white`, cam `cyan0…white`, boynuz `gold1…gold4` (IŞIK niteliği). Büyücü: kumaş `void1…void3` + `night3/4`, zırh `night1…mist`, göz `mag1…mag4` |
| IŞ-12 | **Sert parçalar tam pikselle hareket eder.** Kask, plaka, boynuz ve mücevher harita ya da sabit damgadır: kesirli döndürülmez, kaydırılırken gölgelemesi "kaymaz". Idle'da hiçbir parça yarım piksel dönmez: parçalar ya birlikte hareket eder ya da durur. | Ardışık idle karelerinde sert parçanın iç pikselleri aynı, yalnız konumu değişiyor. | `stampMap`, `rigid()`; ejder idle notu "nothing rotates by a fraction of a pixel" |

---

## 2. Malzemeler

### 2.1 Genel malzeme kuralları

- **MA-1 Bir malzeme dört şeyi birlikte tanımlar:** çizim (rampa, ton eşikleri, vurgu biçimi,
  doku yoğunluğu), ölüm (kırılma ön ayarı ve aksanı), darbe (flaş tonu, kıvılcım) ve ses (darbe
  tarifi). Bugün bunlar dört ayrı tabloda duruyor: rig'deki `Mat` / harita anahtarları,
  `vfx/shatter.ts SHATTER_MATERIALS`, `_v3/presets.ts DEATH_PRESETS` / `MATTER_RAMP` ve
  `_v3/sound.ts materialOf` + `audio/v3/slice.ts MATERIALS`. Dördü tanımlanmadan bir malzeme
  "var" sayılmaz. Birleşik tanımı A3 mimarisi yapar.
- **MA-2 Doku, ton bandıyla verilir, gürültüyle verilmez.** Pul, tuğla, tüy ve kürk gibi
  dokular 1 px dikiş çentikleriyle ya da ≥ 2 px'lik dişlerle çizilir. Dokular orta ve gölge
  düzleminde yoğunlaşır. Aydınlık düzlem sakin kalır.
- **MA-3 Metal, kumaş ve büyü ayrı okunur:** metalde keskin kırılma ve tek parıltı, kumaşta
  geniş bant olur ve krom vurgu olmaz, büyü ise küçük, doygun ve kontursuz ışıktır (plan §3).
- **MA-4 Saydamlık yoktur.** Su, cam ve ışık gibi geçirgen malzemeler arkadaki koyu bandı
  göstererek taklit edilir. Alfa kullanılmaz.

### 2.2 Dilimden çıkan malzemeler (bağlayıcı)

| Malzeme | Rampa / ton | Düzlem kuralı | Vurgu biçimi | Doku yoğunluğu | Ölüm / darbe / ses |
|---|---|---|---|---|---|
| **Kristal / cam** (ejder kanadı, sırt dikenleri) | `cyan0…cyan4 + white` (6), uzak kanat `night1…cyan4` | Düz hücreler (fasetler). Hücre başına 2 ton olur: ışıklı ön faset ve bir değer koyu arka yaprak. Yaprak başına **tek** katlanma çizgisi çizilir. Kemik bir orta ton çubuktur, bir kenarı aydınlık, bir kenarı koyu olur. | Serbest arka kenarda 1 px çizgi: ışığa bakan `white`, öbürü `cyan4`. Sırt dikenleri iki değerlidir ve koyu `cyan0` kanalda durur. | Hücre ≥ 5–6 px. Hücre içinde ton değişmez. | Ölüm `crystal`: hücre 6 px, iki tonlu fasetler, `night1` kenar, kırılmadan önce ışık söner (`drainLight`), çatlaklar düzlem kırıklarında düz çizgidir ve ışıklı dudakları vardır. Ses: serbest çubuk modları (1 : 2,756 : 5,404 : 8,933), üst modlar önce söner. |
| **Pullu deri (açık)** (ejder gövdesi) | `night2, night3, steel, mist, white` (5); uzak taraf bir değer koyu | Büyük, sakin beyaz aydınlık düzlem olur. Işıklı / orta kırığına `cyan2` omurga çizgisi gelir. Plaka çentikleri yalnız gölge düzleminde `night3` dikiştir. | Kenar vurgusu `edgePaint` ile, kenar ışığı `cyan2` (IŞ-7) | Çentik aralığı ≥ 3 px, yalnız orta / gölge düzleminde. | Darbe ve ses: kristal (gövde camdır). |
| **Kumaş** (büyücü pelerini, cüppe, kolluklar) | `void1…void3` + `night3/night4` | Bantlar parçanın kendi kenarından ölçülür: ışığa bakan kenarda aydınlık bant (≤ ~4,6 px), gövde tonu, aşağı açılan kıvrım vadisi. Başka parçanın üstüne binen yerde 1 px ayrım olur. Kumaş gövdeden 1–2 kare geç oturur ("drape"). | Kumaşta krom vurgu yok. Yalnız dönük kenarda 1 px kenar ışığı olur. | Etek ve pelerin uçları **≥ 2 px genişlikte dişlerdir**, düz iki tonludur. 1 px uç ve üçüncü tonda benek olmaz (`widenTeeth`). | Ölüm `shadow`. Ses: kumaş + gölge (perde çırpması, pembe nefes, çınlama yok). |
| **Metal / zırh** (büyücü kaskı, göğüslük, omuzluk, eldiven) | `night1…mist` (kayrak) | Elle yerleştirilmiş harita. Düzlem kırıkları keskindir. Işıklı ve gölgeli plakalar ışığa göre plaka plaka değiştirilir (IŞ-2). | Plaka grubu başına tek parıltı (`mist`). | Plaka iç dokusu yok. | Ses: FM 1,41 tıngırtı (`clank`). Fiziksel darbede gövde "metal" çalar. |
| **Büyü ışığı** (küre, göz, mühür, prizma ışığı) | Nitelik rampası (`void3/4`, `mag2…4`, `cyan3/4 + white`) | Küçük ve doygundur. Beyaz çekirdek yalnız tam şarjda olur. En çok **bir** sert halka kullanılır (kafes = halka). İkinci şarj halkası, üst üste halkalar ve dither'lı yumuşak parıltı olmaz. | Işık konturdan sonra çizilir, konturlanmaz (IŞ-9). | Şarj, ışığı referans boyutun üstüne büyütmez (küre ≤ 7×8). | Şarj sesi `charge` işaretinde başlar, `release` işaretinde söner. |
| **Gölge / boşluk** (büyücü ölümü, yarık) | `void0…void4`, `ink` | Beyaz yok. Çözülme parça uzayında ≥ 2 px kümelerle olur ve önce kask ile omuzları alır. | — | Kümeler ≥ 2 px. | Ölüm `shadow`: parçalar kararır ve zemin noktasına çekilir (`attract 900`). |

### 2.3 Dilimde olmayan malzemeler — **taslak, A4'te doğrulanacak**

Mantık dilimle aynıdır: rampa başına 3 düzlem, en çok 1 kıvrım tonu ve 1 vurgu, dokular dikişle,
ışık konturdan sonra çizilir.

| Malzeme (A4'te ilk kullanan) | Rampa | Düzlem ve doku | Vurgu | Ölüm ön ayarı (bugün) | Ses (taslak) |
|---|---|---|---|---|---|
| **Taş** (Taş Muhafız, Titan gövdesi) | `stone0…stone4` | Blok başına 3 ton: aydınlık üst, orta yan, gölge. Bloklar arasında `stone0` kıvrım vardır. Çatlak düz 1 px `stone0` çizgidir, alt dudağı `stone3` olur. Benek dokusu olmaz. Yosun ya da rün ≤ 3 küme ve her küme ≥ 2×2 px olur. | Blok kenarında 1 px `stone4`, yalnız ışığa bakan kenarlarda. | `stone` (sıçrar, moloz olur) | Alçak gümbürtü + çakıl (kahverengi gürültü, çınlama yok) |
| **Lav / ateş** (Titan çekirdeği, Kor Kurdu alevleri) | `fire0…fire4` | Çatlaktaki `fire3/4` ışıktır, konturlanmaz. Çatlağa bakan taş kenarı `fire1/2` yansıma kenarı alır (ejderin `cyan2` kuralının sıcak eşi). Alev dilleri 2–3 düz tondur (`fire2` dış, `fire3`, `fire4` çekirdek). Bir idle döngüsünde ≥ 3 farklı alev silüeti olur. Alfa yerine basamak kullanılır. | Kor 1 px: `fire4 → fire2 → stone1` diye soğur. | `fire` (közler küle döner) | Çıtırtı (`crackle`) + hışırtı |
| **Su** (Gelgit Golemi, Mercan Yılanı jeti) | `water0…water4` | 3 bant olur, iç derinliği koyu bant gösterir (MA-4). Akıntı çizgileri 1 px `water4`'tür ve akış boyunca karede ≥ 1 px ilerler (A0 §1.3 "iç akıntılar" korunur). Köpük `white/water4`, kümeler ≥ 2 px. | Islak kenar parıltısı 1 px, IŞ-8 sayısıyla. | `water` (sıçrama) | Çarpma gürültüsü + kabarcık tınısı |
| **Tüy** (Fırtına Atmacası) | nitelik / tür rampası | Birincil tüyler 2–3 px genişlikte şeritlerdir. Tüy başına 2 ton ve aralarında 1 px koyu ayrım olur. Uç 2 px'ten incelmez. Tüy uçları omuzdan 1–2 kare geç gelir. | Tüy üst kenarında 1 px aydınlık çizgi. | bugün `plant` (yerine `feather` gerekir) | Yumuşak, yüksek çırpınma |
| **Kürk** (Kor Kurdu) | tür rampası + alev | Silüet kenarında ≥ 2 px dişler olur (kumaş etek kuralı). 3 ton bant. Tek tek 1 px kıl çizilmez. Sırttaki alevler ışıktır (A0 §1.3). | Sırt çizgisinde 1 px kenar vurgusu. | `fire` | Kısa, kuru çarpma + hırıltı |
| **Pullu deri (koyu / renkli)** (Mercan Yılanı, Şimşek Kertenkelesi) | tür rampası | Pul sıraları yalnız orta ve gölge düzleminde 1 px dikiş çentiğidir, aralık 3–4 px. Aydınlık düzlem sakin kalır (ejderle aynı). | IŞ-8 | `water` / `light` | — |
| **Elektrik** (Şimşek Kertenkelesi) | `white` çekirdek + `cyan3/gold3` | 1 px zikzak, konturlanmaz. Aynı şekil en çok 2 kare durur. Çatallar 1 px'tir (Yıldırım Hükmü'nün dili). | — | `light` + `crystal` aksan | Cızırtı + çatırtı (`boltCrackle`) |
| **Bitki** (Dikenli Pusucu) | `leaf0…leaf4` + `earth` | Yaprak 2 tondur, orta damar boyunca ayrılır. Sarmaşık ≥ 2 px kalınlıktadır ve 1 px aydınlık kenarı vardır. Diken 2 px diştir. | — | `plant` (solar) | Kopma + hışırtı |
| **Işık varlığı** (Işık Perisi) | `gold1…gold4 + white` | Küçük gövde, ışıklı çekirdek. Kanat hücreleri cam kuralıyla çizilir. | IŞ-8 parıltı kuralı | `light` (zerreler yükselir) | Çan benzeri sinüs pırıltısı |

**A4.1 sabit kare kararları (Magma Titanı ve Mercan Yılanı, 23 Ekim 2026).** Sabit kareler
`src/still/titan-map.ts` ve `src/still/serpent-map.ts`. Malzeme tanımları bu kararlarla güncellenir:

- **Bazalt (Titan):** taştan bir değer koyu. Cam kenar `stone3`, en çok 4 px'lik parçalar halinde, yalnız
  büyük yakın blokların ışığa bakan kenarında. Tek parıltı `stone4`. Mavi (`steel`) kenar kullanılmaz:
  canavarı mavi golem gibi gösteriyordu.
- **Bazaltın uzak yüzü:** gölge düzlemleri `stone0`. Gölgeye bakan konturun hemen içinde 1 px `stone1`
  arka kenar vardır, böylece koyu gövde koyu zeminden 1×'te ayrılır. `night0` yalnız 1–2 px'lik
  kesiklerde kullanılır. Tabanlar temas gölgesi olarak `stone0` kalır.
- **Lav:** dinlenmede çekirdekte tam bir `gold4` parıltı vardır. Daha fazla altın ya da beyaz yalnız tam
  ısıda (hazırlığın tepesi, temas) görünür. Çatlaklar çekirdekten dışa doğru kırık çizgiler olarak açılır.
  Düz "+" biçimli dikişler kullanılmaz; bunlar taş duvar örgüsü gibi okunur.
- **Pullu deri (Yılan):** pul sıraları yalnız orta ve gölge düzleminin sınırında, yaklaşık 5 px arayla
  2 px'lik dişlerdir. Aydınlık düzlem sakin kalır. Bu, yukarıdaki satırın "1 px çentik, 3–4 px aralık"
  kuralını yılan için düzeltir.

---

## 3. Silüet ve oran

| # | Kural | Denetim | Dilim |
|---|---|---|---|
| Sİ-1 | **Kare = v1 karesi + kenar payı.** 1 sanat pikseli = 1 oyun pikseli. Karakterin boyu değişmez. Pay, hiçbir pozun kenara değmemesi için verilir (`OX/OY`). | `MonsterArt.w/h`, `OX/OY` sabitleri | Ejder 96×96 → **116×104** (10, 8). Büyücü 80×80 → **112×116** (10, 14; nişan için sağda 22 px, yerdeki asa için altta 25 px). |
| Sİ-2 | **Kenar payı ≥ 2 px, her animin her karesinde.** Kare dışına çizim yok. | `monster-sheet` "margin" sütunu ≥ 2, "edge px" 0. Değen kenar sayfada `crim3` çizilir. | En küçük pay: ejder 2 (roar f4), büyücü 3 (death / revive) |
| Sİ-3 | **Çapa.** Yürüyen canavarda çapa iki ayağın arasındaki zemin çizgisidir. Süzülende yer noktasıdır (`hover` px yukarıda). Çapa poz boyunca sabittir; ayaklar için HA-11'e bakılır. | `anchorX/Y`, `points().feet` | Ejder (60, 99), hover 0. Büyücü (49, 91), hover 6. |
| Sİ-4 | **Boy sınıfı korunur.** (Kare v1 değeridir; v3 karesi bunun üstüne pay ekler.) | v1 ↔ v3 idle f0 bbox ve opak piksel sayısı (aşağıdaki tablo) | Ejder 3400 / 3404 px, büyücü 2089 / 2094 px |
| Sİ-5 | **"Aynı karakter" kuralı (eski canavarın yeni stile geçişi).** Idle f0 silüeti çapaya hizalanınca referansla IoU ≥ 0,95 olur, opak piksel ±%3 içinde kalır. Bakış yönü, çapa, hover, boy sınıfı, tanıtıcı parçalar (boynuz, asa, kanat sayısı) ve renk aileleri korunur. Referans dilimde onaylı sabit görseldi (`src/still/*-map.ts`). A4'te referans v1 idle f0'dır. **Referans kare kapısı:** A4 canavarı önce tek bir yeni stil idle f0 olarak çizilir ve onaylanır, anim ondan sonra çizilir. Bilinçli yeniden tasarımda IoU < 0,95 olabilir, ama yalnız kullanıcı onayıyla. | `monster-sheet --still` (IoU, renk, yalıtık) ya da v1 ile v3 sayfası yan yana | IoU 0,996 (ejder), 0,962 (büyücü) |
| Sİ-6 | **1× okunabilirlik (sakin arena).** Silüet tek başına tanınır. Gözler ve enerji noktaları en parlak tondur. Temas karesi (hit f0) tek başına "vuruldu" diye okunur. Komşu karodaki canavarla silüet karışmaz. | `shot.mjs --film` 1× (ölçeksiz) kareleri | `saWyrmAtk` filmi: nefes ağızdan çıkıyor, büyücünün temas pozu tek karede okunuyor. |
| Sİ-7 | **Büyük gövde karoyu taşar ama kareden taşmaz.** Karo 64×32. Ejder 85 px genişliğindedir. Cut-in bandı ve efektler bu gövdeyi örtmez (EF-10). | film | — |

**Boy sınıfı tablosu** (v1 idle f0, `monsterArt()` ile ölçüldü; A4 canavarları da dahil):

| Sınıf (GAME_DESIGN §4) | Canavar | v1 kare | idle f0 bbox | opak px | hover | ağırlık |
|---|---|---|---|---|---|---|
| As (96) | Kristal Ejder | 96×96 | 85×91 | 3404 | 0 | mediumHeavy |
| Büyük (80) | Uçurum Büyücüsü | 80×80 | 54×71 | 2094 | 6 | caster |
| Büyük (80) | Magma Titanı | 80×80 | 58×64 | 2575 | 0 | heavy |
| Büyük (80) | Mercan Yılanı | 80×80 | 61×69 | 1953 | 0 | medium |
| Orta (64) | Gelgit Golemi | 64×64 | 54×54 | 1706 | 0 | heavy |
| Orta (64) | Taş Muhafız | 64×64 | 48×49 | 1806 | 0 | heavy |
| Orta (64) | Kor Kurdu | 64×64 | 58×51 | 1421 | 0 | mediumLight |
| Orta (64) | Şimşek Kertenkelesi | 64×64 | 57×42 | 1410 | 0 | mediumLight |
| Orta (64) | Gölge Suikastçı | 64×64 | 48×45 | 953 | 0 | mediumLight |
| Küçük (48) | Dikenli Pusucu | 48×48 | 40×33 | 929 | 0 | medium |
| Küçük (48) | Fırtına Atmacası | 48×48 | 38×35 | 743 | 10 | light |
| Küçük (48) | Işık Perisi | 48×48 | 33×36 | 533 | 12 | floater |

Üç ağır insansının (Titan 58×64, Golem 54×54, Muhafız 48×49) bugün bile farklı boyları var.
Gövde tipi bunları aynı ölçüye çekmemelidir (§8.2).

---

## 4. Hareket

### 4.1 Evreler ve işaretler (marks)

Plan §4'teki zincir şudur: hazırlık → bırakma → temas → ikincil hareket → toparlanma. Bu zincir
`AnimSpec.marks` ile kareye bağlanır. Sinematik, ses ve sayı yalnız işaretten zamanlanır (`atMark`,
`markFrame`, `markMs`).

| İşaret | Anlamı | Hangi animlerde (zorunlu) | Dilim |
|---|---|---|---|
| `charge` | hazırlığın ilk karesi. İlan bu karede bekler. | attack, roar, special | f1 (60–80 ms) |
| `release` / `impact` | bırakma karesi (mermi çıkar, nefes açılır) | attack, roar, special | ejder attack f5 (520 ms), büyücü attack f6 (560 ms), special f6 (590 ms) |
| `contact` | gövde ya da ışın hedefe **anim içinde** değer | attack (yakın dövüş / ışın), hit\*, death | ejder attack f6. Mermide temas sinematiğe aittir (uçuş süresi), anime değil. |
| `impact` = `contact` = 0 | tepkinin temas karesi; hit-stop bu kareyi tutar | hit, hitHeavy, hitMagic, death | f0 |
| `recover` | toparlanmanın ilk karesi | attack, roar, special, hit\* | ejder attack f10 (980 ms), büyücü attack f8 (710 ms) |
| `land` | ayaklar ya da süzülme yere oturur | summon, revive | ejder summon f3 (260 ms), revive f4 (330 ms); büyücü summon f6 (480 ms), revive f5 (450 ms) |
| `dissolve` | aşınma ve aksan başlar | death | f4 (300–310 ms) |

- **HA-1** Yukarıdaki zorunlu işaretler her canavarda vardır. Death animinde `impact` ve
  `contact` ikisi de f0'dadır. (Ejder death'te `contact` eksik, §10.)

### 4.2 Bekleme süreleri (holds)

- **HA-2** Kare bekleme süresi 40–200 ms'dir. 200 ms'nin üstü yalnız tutulan son pozda
  (victory 400 ms) ya da sinematiğin uzatabileceği nişan beklemesinde (special f8, 200 ms) olur.
  Dilim: 264 karede en kısa 40, en uzun 200 ms, ortanca 90–100 ms.
- **HA-3 Uzun hazırlık, kısa vuruş:**
  - Saldırının en uzun karesi bırakmadan hemen önceki tam sarılma karesidir (ejder f3 160 ms,
    büyücü f3 170 ms).
  - Bırakma karesi ≤ 70 ms'dir (dilim 50–70).
  - Bırakmanın hemen öncesinde ≤ 60 ms'lik bir "savrulma" ara karesi olabilir (büyücü f5 50 ms,
    `magusSwing`).
  - Temas karesi 50–90 ms'dir.
  - Toparlanma kareleri 100 → 140 ms diye uzar (beklemelerle yavaşlayan çıkış).
- **HA-4 Tepkinin ritmi:**
  - Temas karesi (f0) 40–60 ms'dir. Hit-stop onu ayrıca tutar.
  - Sonraki kare 40–70 ms'dir.
  - Ardından 70–150 ms'lik toparlanma gelir. `recover` 240–370 ms'dedir.
- **HA-5** Bekleme dizisi tek düze değildir. Bir one-shot animde tüm kareler aynı süreyi
  taşımaz (dilimde hiçbiri taşımıyor). Idle'da hafif yumuşatma yapılır (büyücü 110–150 ms: tepede
  ve dipte oyalanır).

**Dilim ölçüleri (saldırı ailesi):**

| | ejder attack | büyücü attack | büyücü special | ejder roar | büyücü roar |
|---|---|---|---|---|---|
| kare / süre | 13 f / 1350 ms | 12 f / 1180 ms | 12 f / 1290 ms | 12 f / 1160 ms | 11 f / 1190 ms |
| charge → release | 460 ms | 500 ms | 520 ms | 330 ms | 240 ms |
| hazırlığın en uzun karesi | f3 160 ms (tam sarılma) | f3 170 ms | f3 170 ms (sonra f8 200 ms nişan tutuşu) | f2 160 ms | f1 180 ms |
| bırakma karesi | 70 ms | 70 ms | 70 ms | 110 ms (patlama) | 90 ms |
| bırakmadan sona | 830 ms | 620 ms | 700 ms | 760 ms | 870 ms |
| bekleme dizisi | 60 90 100 160 110 70 90 100 100 100 110 120 140 | 60 90 100 170 90 50 70 80 100 110 120 140 | 70 110 110 170 50 80 70 90 200 100 110 130 | 70 110 160 60 110 70 70 80 100 100 110 120 | 80 180 60 90 90 90 100 110 120 130 140 |

### 4.3 Örtüşme (overlap) ve periyotlar

- **HA-6** Idle'da şunlar sağlanır:
  - ≥ 3 parçanın kendi fazı vardır.
  - ≥ 2 farklı periyot vardır (tam sayı oranında olabilir, ama aynı fazda olamaz).
  - Takipçiler gövdeden 1–3 kare geç gelir.
  - Hiçbir kare bütün parçaları birlikte kıpırdatmaz.
  - Denetim: ×3 idle şeridinde ardışık karelerde hangi parçanın kıpırdadığı sayılır.

| Canavar / anim | Gövde | Takipçiler (gecikme) | Periyotlar |
|---|---|---|---|
| Ejder idle (20 f, 1,98 s) | kalça nefeste 1 px iner (f4–7, f14–17), dizler yükü alır | baş ve yakın kanat eli +1 kare, uzak el ve kuyruk ucu +2 kare; kanat omuz → önkol → parmak uçları +1 / +2 / +3; zarlar daha geç; uzak kanat yakından +1 kare | nefes 10 kare, kuyruk dalgası 20 kare, baş salınımı döngüde 1, göz kırpma döngüde 1 |
| Ejder guard (8 f, 1,26 s) | **her karede tek parça:** zar dolar → göğüs / uyluk 1 px iner → kanatlar +1 → baş +1 | kuyruk ortası / ucu +1 / +2 | 8 kare |
| Büyücü idle (16 f, 1,94 s) | süzülme ±1 px (tam piksel, beklemelerle yumuşar) | kask +1 kare; asa ve yumruk +2 kare ve yalnız tepelerde (16 karenin 3 yukarı 3 aşağısı); küre yuvasında ±1 px; etek 0,22 döngü geç; pelerin 0,3; kollukların çanı 0,3 / 0,4 | süzülme 1, etek dalgası 2, mühür 2, göz nabzı 1, küre parıltısı 1 |
| Büyücü vuruşlar | gövde | cüppe gövdeden 1–2 kare sonra eve döner ("drape") | — |

- **HA-7** One-shot animlerin kumaş ve kuyruk fazları anim boyunca bir kez döner ve son karede
  0'a sarar. Kumaş hiçbir zaman donmaz. Döngü dikişi temiz kalır.

### 4.4 Ağırlık sınıfları (`src/duel/motion.ts`)

| Sınıf (A4 ataması) | Hazırlık (tablo) | Bırakma eğrisi | Temas hit-stop | Sarsıntı | Toparlanma | Savunmada itme (güç 1/2/3) |
|---|---|---|---|---|---|---|
| heavy (Titan, Golem, Muhafız) | 280–360 ms | `Cubic.In` | 100–130 ms | 3–4 px | 450 ms, "settle" | 0 / 0 / 1 px |
| mediumHeavy (Ejder) | 220–300 ms | `Quad.In` | 80–110 ms | 3 px | 350 ms, "settle" | 1 / 1 / 2 |
| medium (Yılan, Pusucu) | 160–220 ms | `Quad.Out` | 60–80 ms | 2 px | 280 ms, "steady" | 2 / 2 / 3 |
| mediumLight (Kurt, Suikastçı, Kertenkele) | 90–150 ms | `Expo.Out` | 40–60 ms | 1–2 px | 200 ms, "snap" | 2 / 3 / 3 |
| light (Atmaca) | 120–180 ms | `Quad.In` (dalış) | 40 ms | 1 px | 260 ms, "glide" | 3 / 3 / 3 |
| floater (Peri) | 160–240 ms | `Sine.InOut` | 30–40 ms | 0–1 px | 300 ms, "spring" | 3 / 3 / 3 |
| caster (Büyücü) | 300–380 ms | `Expo.Out` | 60 ms | 1–2 px | 320 ms, "drape" | 2 / 2 / 3 |

- **HA-8 Ritim imzası beklemelerde durur.** Tablodaki hit-stop, sarsıntı ve itme kod tarafından
  kullanılır. Hazırlık ve bırakma eğrisi ise anim beklemelerinde karşılık bulur:
  - Ağır sınıfta hazırlık daha uzun, bırakma daha geç hızlanan (son karelerde kısalan) olur.
  - Hafif sınıfta hazırlık kısa ve keskin olur.
  - Dilimde charge→release ejderde 460 ms, büyücüde 500 ms'dir; tablonun 1,5–2 katı (§10.1).
  - A4'te ölçü sırası şudur: aynı sınıftaki canavarlar arasında charge→release sırası ağırlık
    sırasını izler (heavy ≥ mediumHeavy ≥ medium > mediumLight).

### 4.5 Ayak, süzülme ve sprite dönüşümleri

- **HA-9 Ayaklar kaymaz.** Yürüyen canavarda ayakların alt satırı ve x aralığı idle, guard,
  toGuard ve fromGuard'ın her karesinde aynıdır.
  - Dilim (ejder): y 99, x 54..77, 42 karenin hepsinde (`shots/v3/a2/acceptance/position-feet.txt`).
  - Ayak yalnız havadayken yer değiştirir: hitHeavy'de kalkar, bir adım geride basar, sonra
    kalkıp eve döner.
  - Bacaklar ayağa IK ile ulaşır.
- **HA-10 Süzülen canavar.** Yer noktası sabittir. Süzülme taban çizgisi ±1 px'tir. Her one-shot
  süzülme tabanından (bob 0) başlar, böylece her idle karesinden ≤ 1 px'lik bir başlangıç olur.
  Pozisyon geçişlerinde `dx = 0` kalır (dilim: büyücü toGuard / fromGuard).
- **HA-11 Bütün sprite'ı kaydırmak, ölçeklemek ya da döndürmek animasyon değildir.** Hareketin
  hepsi pozlarda çizilir. Sprite'ın kendisine yalnız şunlar yapılabilir:
  - Darbede tam piksel geri itme (A3'te değişti, `docs/v3/A3_MIMARI.md` §10): **temas karesinde
    sprite kımıldamaz.** İtme temastan sonraki ilk kare değişiminde başlar, ekranda hangi anim varsa
    (tepkinin f1'i, ölümcül devirde ölüm animinin ilk değişen karesi). Toplam ≤ 4 px, güç ve tarafa
    bağlı (`knockPx`; arkadan +1 ve ileri, yukarıdan yalnız güç 3'te 1 px aşağı), sınıfın dönüş
    eğrisiyle eve döner. Plan canavarında (`knock: 'pose'`) itmenin bir kısmını tepki pozları çizer,
    kalanını kit ekler: kit, oynayan tepkinin rig'de ölçülen kalça yolunu düşer (`joints()` yoksa
    `poseKnockPx[güç]`). Ölümcül darbede ölüm pozu bu çizilen yolu taşımaz; kit `knockPx`'in tamamını
    ekler ve ölüm itilmiş yerde sürer (ölüm tepkinin sonraki bir karesinden devam ediyorsa o karenin
    yolu düşülür).
  - Sinematikteki yer değiştirme (atılma, uçuş) tam pikselle ve yalnız pozun kendisi de hareket
    ederken yapılabilir.
  - `setScale` ve `setAngle` kullanılmaz (denetim: değişen dosyalarda `grep -n "setScale\|setAngle"`,
    A2 `review-tech-r3/grep-scale-added.txt`).
- **HA-12 Lekelenme (smear) yalnız bırakma karesinde olur.** Uzunluğu 2 px'tir. Maddeye
  bağlıdır (kafanın ve boynuzun arkasına) ve gövdeyle birlikte konturlanır (ejder attack f5,
  `smearHead`).
- **HA-13 Ara kare.** İki anahtar poz arasında yay üstünde gerçek bir ara konum vardır (ejder
  roar f3 "kalkışta ara kare", toGuard f2 "kanat yolun ortasında"). Kopya ara kare olmaz.
  Denetim: ×3 şeritte büyük bir sıçramanın iki yanındaki kareler.

### 4.6 Poz sıçraması ve döngüler (`monster-sheet` sayıları)

`idleΔ` = ardışık idle kareleri arasında değişen piksel sayısının ortalamasıdır (döngü dikişi
dahil). Dilimde ejder 738,6 px (opağın %21,7'si), büyücü 390,3 px (%18,7).

| # | Ölçü | Sınır | Dilim |
|---|---|---|---|
| HA-14 | **out** = Δ(son kare, idle f0) / idleΔ. toGuard'da guard f0'a göre ölçülür. | ≤ 1,2 | **0** (her one-shot tam idle f0'da biter) |
| HA-15 | **in** = Δ(idle f0, ilk kare) / idleΔ; tepki olmayan, idle'dan başlayan animler (attack, roar, special) | ≤ 2,0 | 0,81–1,6 (victory ölçülmez: oynatan yok, §10.4) |
| HA-16 | Döngü dikişi (seam) idle / guard | ≤ 1,4 | 1,09–1,29 / 1,09–1,40 |
| HA-17 | Idle'da ardışık iki kare arasındaki en büyük Δ / idleΔ (tek karelik sıçrama yok) | ≤ 1,8 | 1,43 / 1,71 |
| HA-18 | **Canlılık:** idle ortalama Δ / opak | ≥ %15 | %21,7 / %18,7 |
| HA-19 | **Savunma ölü değil, sakin:** guard ortalama Δ / idleΔ | 0,3–0,8 | 0,43 / 0,68 (A0'da 1 px'lik "ölü" döngüler vardı) |
| HA-20 | idle f0 ↔ guard f0 Δ ≥ 3 × idleΔ ise toGuard / fromGuard zorunludur ve kesme yasaktır | — | 4,78 / 4,44 → 7 / 5 karelik geçiş, ≤ 0,4 sn |

### 4.7 Darbe tepkisi (hit f0)

- **HA-21 Temas karesi yerel olur.**
  - Ölçü: Δ(hit\* f0, idle f0) ÷ idle f0 opak.
  - Sınır < %50. Dilim **%38–44** (hit, hitHeavy, hitMagic, death f0; P1 ve P2).
  - Önce vurulan bölge tepki verir (baş, göğüs). Kalça, bacaklar, kuyruk, etek ve uzak kol idle
    f0 piksellerinde kalır. Büyücüde değişimin ~%72'si belin üstündedir.
  - Ölçü **sayfa karesinde ve ekranda** yapılır: ekranda `tools/contact-probe.mjs` dinlenen hedefte
    temas karesini bir önceki gösterilen kareyle karşılaştırır; < %50 ve sayfa değerinin en çok 5
    puan üstü (A3'te kit itmesi temas karesinden çıkarıldı, §10.3).
  - **Her idle fazında** < %50: dinlenen hedef idle'ın herhangi bir karesinde vurulur, bu yüzden
    `monster-gates` "HA-21 phase" satırı her idle karesi k için `Δ(idle k, f0) / idle f0 opak` değerinin
    en büyüğünü ister. Dilim bunu geçmez (ejder %67,9, büyücü %74,3) ve donmuş sanatı yüzünden
    muaftır (`docs/v3/A3_MIMARI.md` §10, dilim muafiyeti); yeni canavarlar geçer.
- **HA-22 f1 bir ara karedir:** sıkışmış anahtar poz ile savrulma arasında durur. Böylece
  savrulma temastan sıçramadan yay çizer (`recoil(struck, keys)`: `mix(k0, k1, 0.5, 0.35)`).
- **HA-23 Tepki türü okunur:**
  - **hit:** baş geri, göz kapalı, gövde takip eder.
  - **hitHeavy:** daha sert sıkışma, bir adım geri, diz yükü alır, bir adım ileri; büyücüde
    süzülme çöker.
  - **hitMagic:** omurga ve gözler beyaz yanar, gövde kaskatı olur, 1 px titrer (kanatlar bir kare
    geriden gelir), sonra gevşer.
  - Arkadan gelen darbede canavar geri savrulmaz, ileri itilir (`blowSide 'back'`).
- **HA-24 Ölümcül darbe sıçramadan devreder.** Büyücüde `hitHeavy f0 = death f0` ve `hitMagic f0`
  bunun büyüyle aydınlanmış hâlidir. Ölüm pozu tepkinin devamı olan kareden başlar
  (`_v3/posematch.ts`: `SKIP_COST 0,6 × idleΔ` / atlanan kare, en çok 3 kare atlanır).
  Savunmadaki ölüm `fromGuard f0`'dan kırılır, ayağa kalkmaz (`_v3/guardbreak.ts`,
  `BREAK_WINDOW_MS 150`).
- **HA-25 Kaynak anatomiyi izler.** `points()` her karede şunları verir: `muzzle` (ağız / küre),
  `core` (çökmede iner), `head`, `feet`; anatomisinde varsa `hand / staff / claw`. Mermi, ışın ve
  dokunaç `release` karesinde `muzzle`'dan çıkar. Asa düşerken bile küre `staff` noktasıdır.

### 4.8 Çağırma, ölüm, diriltme, savunma

- **HA-26 Çağırma:** varış (kanatlara sarılı düşüş / yarıktan önce kask) → `land` → açılış
  (büyük vuruş: kanatlar ~45° → tam açık; as'ta cut-in bu vuruşa gelir) → katlanma ve silkinme →
  idle f0. Gövde baştan görünür (hologram ≤ 300 ms, EF-11).
- **HA-27 Ölüm karaktere özgüdür ve tepkinin devamıdır:** vuruldu (f0) → savrulma → çöküş
  (dizler / süzülme çöker) → ikincil hareket (kanat düşer / asa elden kayar ve zeminin 2:1
  köşegeninde kendi karosuna yatar) → `dissolve` ~300 ms'de → son kare alçak ve çökük. Gövde son
  karede malzeme olarak kırılır. Anim 0,69–0,78 sn sürer, yok olma ≤ 1,4 sn'dir (§5).
- **HA-28 Diriltme çağırma değildir:** ölümün tersidir (kristal parçalar toplanıp kilitlenir,
  ışık çekirdekten dolar; cüppe zeminden yukarı yeniden kurulur, asa düşüş yolunun tersinden
  ele kalkar) → `land` → ilk nefes → idle f0. Giriş set-piece'i tekrar oynamaz.
- **HA-29 Savunma geçişi:** toGuard / fromGuard 5–7 kare, ≤ 0,4 sn sürer. Ayaklar sabittir.
  Kanat ya da pelerin süpürmesinde bir ara kare vardır. Baş süpürmenin altında açıkta kalır.
  `toGuard` guard f0'da, `fromGuard` idle f0'da biter.

### 4.9 Katmana göre zorunlu animler

As sütunu dilimde ölçülendir. Normal ve sıradan sütunları **öneridir**: A4'teki ilk normal
canavarla doğrulanır. Süreler katmana göre değişmez (§5 bütçesi). Kare sayısının azalması
beklemeleri 200 ms'nin üstüne itmemelidir (HA-2).

| Anim | As (dilim: ejder / büyücü) | Normal (öneri) | Sıradan (öneri, gövde tipi üretir) |
|---|---|---|---|
| idle (döngü) | 20 f 1,98 sn / 16 f 1,94 sn | ≥ 12 f, 1,6–2,0 sn | ≥ 12 f |
| guard (döngü) | 8 f 1,26 sn / 6 f 0,95 sn | ≥ 6 f | ≥ 6 f |
| toGuard / fromGuard | 7 f 0,39 sn / 5 f 0,36–0,38 sn | ≥ 5 f, ≤ 0,4 sn | ≥ 4 f, ≤ 0,4 sn |
| attack | 13 f 1,35 sn / 12 f 1,18 sn | ≥ 10 f | ≥ 9 f |
| roar | 12 f 1,16 sn / 11 f 1,19 sn | ≥ 9 f | ≥ 8 f |
| hit | 6 f 0,50 / 0,59 sn | 5–6 f | 5–6 f |
| hitHeavy | 8 f 0,68 / 0,74 sn | ≥ 7 f | ≥ 6 f |
| hitMagic | 9 f 0,61 / 8 f 0,66 sn | ≥ 7 f | ≥ 6 f |
| summon | 15 f 1,31 sn / 12 f 1,14 sn | ≥ 10 f | ≥ 8 f |
| death | 10 f 0,69 / 0,78 sn | ≥ 8 f, ≤ 0,9 sn | ≥ 8 f, ≤ 0,9 sn |
| revive | 13 f 1,23 / 12 f 1,21 sn | ≥ 10 f | ≥ 8 f |
| special | — / 12 f 1,29 sn | kartın sahada etkisi varsa ≥ 10 f | etkili kartta gövde tipinin "göster / kanalize et" pozu |
| victory | 8 f 1,01 / 7 f 0,96 sn | isteğe bağlı (bugün oynatan yok, §10.4) | yok |

hit, hitHeavy ve hitMagic **üç katmanda da zorunludur.** Düz `hit`'e düşmek plan §4'ün
"hafif / ağır, fiziksel / büyüsel" ayrımını kaybettirir. summon, death ve revive de zorunludur:
olmazlarsa kitler eski hologram / glitch yollarına düşer.

---

## 5. Süreler

Ölçüm oyun saatiyle yapılır (1×, deterministik): `tools/measure.mjs --look v3` (§9.3). Sınır plan
§5 ile A0 §6.2'dir. "A2" sütunu kabul ölçümüdür (`shots/v3/a2/acceptance/budgets-v3.txt`, son ses
geçişinden sonra `shots/v3/a2f/soundfix/measure-v3.json` ile yeniden doğrulandı).

| Olay (senaryo) | Bütçe | A2 ölçümü | A0'da (v1) |
|---|---|---|---|
| Saldırı, canavara (`saWyrmAtk`, `saMagusAtk`) | 1,6–2,2 sn | 1,98 / 1,53 sn | 3,1–5,1 sn |
| Doğrudan saldırı (`saWyrmDirect`, `saMagusDirect`) | ~1,6 sn | 1,37 / 1,58 sn | 2,6–3,5 sn |
| Saldırı ilanı | ≤ 0,3 sn | 0,233 sn | 0,55 sn |
| Kurbanlı (as) çağırma (`suWyrm`, `suMagus`) | 2,5–3,0 sn | 2,80 / 2,82 sn; büyücü etkiyle 3,27 sn (≤ 3,5) | 3,7–5,75 sn |
| Diriltme (`suRevive`, `sliceMagusRevive`…) | ~2,0 sn (≤ 2,1) | 1,48–1,58 sn | 2,9–5,1 sn |
| Pozisyon değişimi | 0,4 sn | 0,27–0,40 sn | 0,63–1,1 sn |
| Çevirme | 0,6 sn | 0,52 / 0,57 sn | 1,0 sn |
| Yok olma (ölüm + kart mezarlıkta) | ≤ 1,4 sn | 1,07–1,12 sn (savunmada büyü 1,38) | 1,5–2,4 sn |
| Büyücü etkisi (`saMagusEffect*`) | ≤ 1,6 sn | 1,45–1,52 sn | 2,65 sn |
| Büyü (Yıldırım Hükmü) | 1,2–2,0 sn | 1,30–1,90 sn | — |
| Tuzak (Işık Zincirleri, açılıştan sona) | 1,5–2,0 sn | 1,88–1,93 sn | 2,9–5,0 sn |
| LP akışı | ~0,4 sn (≤ 400 ms) | 333–384 ms (iki ölçümde 416 / 450 ms, §10.5) | 850 ms |
| Sayı − temas | ±1 kare (±17 ms) | 0 ms | sayı 0,1–1,0 sn önce |
| Cut-in (as) | ≤ 1,0 sn | ≤ 0,9 sn (`CUTIN_V3_MAX_MS`) | ~1,5 sn |

- **SÜ-1** Yeni canavarın her senaryosu bu tablonun sınırında kalır. A4 çiftleri kendi
  senaryolarıyla ölçülür (summon, attack, direct, blocked, death, revive, position, flip,
  effect).
- **SÜ-2** Anim süresi ile sinematik süresi ayrı sayılır. Anim tablosu §4.9'dadır. Saldırının
  toplamı = ilan (≤ 0,3) + charge→release + uçuş + temas + toparlanma ve ölüm paralel. Ölüm,
  saldıranın toparlanmasıyla paralel yürür (A2 düzeltme r1 #3).
- **SÜ-3** Hızlandırma (2× / 3×) sanat kalitesini düşürmez: kareler atlanmaz, sahne saatiyle
  kısalır. İşaretler ve sesler yine kendi karelerinde gelir (§7).

---

## 6. Efektler ve ışık katmanı

| # | Kural | Denetim | Kod / dilim |
|---|---|---|---|
| EF-1 | **Efekt beden hareketinin yerini tutmaz.** Her efekt vuruşunun bir gövde pozu vardır: büyücü etkisinde `special` pozu nişan alır ve dokunaç varana kadar nişanı tutar. Ejder nefesinde ağız açık kalır, göğüs nabız atar, ışın inceldikçe çene kapanır. | Film: efekt karelerinde gövde de kıpırdıyor. | `strikes-a/abyss_magus.ts` (`AIM_F`), ejder attack f6–f9 |
| EF-2 | **Ana silüet sürekli örtülmez.** Efekt hedefin ya da kaynağın silüetini 2 kareden uzun süre %50'den fazla kapatmaz. İmza efektlerinde (Ayna kubbesi, Yarık uçurumu gibi) bu, efekti küçülterek değil içi görünen desenle sağlanır; imza efekti eski halinden küçük olmaz (kullanıcı kararı, 24 Ekim). | Film | — |
| EF-3 | **Temas flaşı:** yalnız vurulan bölgede, basamaklı bantlarla yapılır (beyaz çekirdek, darbenin ışık tonunda damalı bant, seyrek kenar). Güç 1/2/3 için silüetin **en çok %34 / %40 / %45**'ini kaplar, asla %50'yi geçmez. 2 kare sürer, hit-stop boyunca da yanar. Sprite'ın kendi rengi boyanmaz. **Açık renkli gövdede** (silüetin ≥ %35'i açık tonda, örneğin ejder) beyaz flaş yerine silüetin hemen dışında 1 px ışık kenarı kullanılır. | Temas karesi ×3 kırpma | `_v3/flash.ts` (`FLASH_COVER`, `LIGHT_SHARE 0,35`) |
| EF-4 | **Tam ekran yıkama yok.** Bir karede beyaz piksel (her kanal > 235) ekranın ≤ %1,5'i kadar olur. Hiçbir satırın %60'ından fazlası beyaz olmaz (tam genişlik bant yok). HUD flaştan etkilenmez (`flash(…, { hud: false })`, v3'te varsayılan). Yıldırımın tam parlaklığı ≤ 120 ms'dir ve yalnız hedef şeridini aydınlatır. | `white-check` (A2: en çok %1,21, satır yok, HUD sabit) | `vfx/core.ts flash` |
| EF-5 | **Hit-stop saldıranın sınıfından gelir** (§4.4 tablosu; `reactStopMs`). Büyü / yıldırım 60–100 ms'dir. Kırılma durması 30–50 ms'dir (malzeme ön ayarı). İç içe hit-stop tek gösteri saatinden geçer. | `measure` olay zaman çizelgesi | `motion.ts contactStopMs`, `duel/showclock.ts` |
| EF-6 | **Işık katmanı basamaklıdır** (v3). Işık zemine düz damgalarla düşer: mat ped pikseli ışığın tonuna doğru 1 (çekirdekte 2) ton kayar. Seviyeler çeyrek adımdır. Kesir alfa yerine 2×2 Bayer dither olur. Havada parıltı, hale, tint yıkaması ve bloom yoktur. Saldırı ve çağırmada yerel ışık havuzu kısa sürer, yalnız ilgili karoda olur. | Film: zeminde düz ton basamakları, yumuşak gradyan yok | `view/light/LightLayer.ts` (STEPPED), `stepped.ts` |
| EF-7 | **Efektin kendi piksel dili:** 1 px çizgi, sert kenar, alfa yerine palet basamağı. En çok bir halka. Kesirli ölçek ve döndürme yok. Kırılan parçalar tam pikselle durur. | ×3 film kırpması | `vfx/shatter.ts` malzeme modu (`whole-pixel`, `blinkAt` basamaklı sönme) |
| EF-8 | **Kamera (23 Ekim kullanıcı kararı: "Kamerayı değiştirme böyle iyi"):** zoom her zaman 1; yeni yakın çekim, kaydırma, takip ya da sinema bandı eklenmez. Bugünkü kamera davranışı (açılıştaki iniş, yazı-tura, mevcut küçük kaymalar) olduğu gibi kalır; kaydırma tam sayıdır. Sarsıntı yalnız dünya kamerasında olur, tam piksel ve sınıfa göredir (1–4 px). | `measure` → `zoom.max`, `fracScrollFrames` 0 | `duel/CameraRig.ts` |
| EF-9 | **Sayı temas karesinde çıkar.** Tam pikseldir: 34 ms bir boy büyük, sonra yerine oturur. 50 ms beyaz, sonra kırmızı olur. Hit-stop sırasında kendi saatiyle çizilir. | `measure` → sayı − temas = 0 ±17 ms | `_v3/number.ts impactNumber` |
| EF-10 | **Cut-in bant olarak gelir:** tam ekran karartma ve tam ekran flaş yok. ≤ 0,9 sn sürer. Bant çağrılan canavarın karosunun **altından** geçer (iniş ve silkinme görünür kalır). Ritim asa özgüdür (ejder: flare 320 / slam 410 / exit 740 ms; büyücü: 250 / 320 / 660 ms). Portre doğal piksel yoğunluğunda çizilir (Scale3x yok) ve P2 sürümü ayrı ışıklandırılır (`CutinArt.p2 = 'relight'`; büyücüde eksik, §10.11). | `?dev=cutin`, `suWyrm` filmi | `_v3/cutin.ts`, `_v3/presets.ts cutInRhythm`, `src/art/cutins-v3/*` |
| EF-11 | **Çağırma tabanı:** pozlu çağırmada hologram evresi ≤ 300 ms sürer (gövde alttan üste kurulur, ama zaten hareket ediyordur). Gövde sürenin ≥ %50'sinde gerçek renklerindedir. | film | `_v3/summon.ts` (`HOLO_MAX_MS`, `BODY_MIN_SHARE`) |
| EF-12 | **Ölüm sürekliliği.** Ölüm pozu tepkinin devamıdır (HA-24). `dissolve` işaretinde aksan başlar, son karede gövde malzeme olarak kırılır (hologram glitch yok; kırılmanın ilk karesi gerçek pikselleri yerinde gösterir). Kart **kırılma karesinde** karonun üstünde doğar: iki kare 1 px beyaz çerçeve, bir kare sahibinin tonunda. Kart ölçek 1'de, tam pikselle 200–360 ms'de mezarlığa yay çizer. Ölümle kart arasında boş kare yoktur. | film (A0'da boş kareler `atkTD-zoom` #14–#21) | `_v3/death.ts`, `_v3/card.ts`, `presets.flightMs` |
| EF-13 | **Işın ve mermi:** ışın temastan sonra incelir. Patlama tavanı 150 ms'dir. Kırıklar dışarı uçar. Ranged saldıran kaybettiğinde karşı darbe saldırı çizgisi boyunca geri gelir ve aynı karede vurur (`clash.ts backlash`). | film | Ejder entegrasyon düzeltmesi r1 #3, `_v3/clash.ts` |
| EF-14 | **Pankart:** bir olayda en çok bir tam genişlik pankart olur. İlk karede tam genişlik düz bant olmaz. | film | Işık Zincirleri: kısa "TUZAK!" + "SAVAŞ BİTTİ" |

---

## 7. Ses

| # | Kural | Denetim | Kod / dilim |
|---|---|---|---|
| SE-1 | **Ses işarete bağlanır,** sapma ≤ 1 karedir. `atFrame` / `atMark`, sprite'ın `animationupdate` olayında çalar: ses, karenin ekrana geldiği tıkta başlar. | `measure` `sfx[]` × `anims[]` | A2: 1×'te bütün işaretler d = 0, `magusOrbRelease` d = −1 kare. 3×'te hepsi 0 (`shots/v3/a2f/soundfix/marksync*.txt`) |
| SE-2 | **Sürekli ses resmini aşmaz.** Şarj, ışın ve toplanma sesleri `start()` ile başlar ve resmi bitiren işarette `stop(ms)` ile söner. İlanın şarj sesi aynı sesle saldırıya devredilir (`holdCharge` → `takeCharge`, ≤ 320 ms). | `stops-1x/2x/3x.txt` türü analiz | `_v3/sound.ts`, `V3_SUSTAINED` |
| SE-3 | **Karakter ses kimliği bir parametre setidir** (`audio/v3/kit.ts` blokları + `CHARACTER_SOUNDS` rolleri). Her canavar şu rolleri doldurur: `roar, arrive, land, charge, [swing], release, impact, [deathStart], dissolve, [afterDissolve], burst, reviveGather, reviveLand`. Yeni DSP yazılmaz, parametre eklenir. | rol tablosu dolu | `_v3/sound.ts CHARACTER_SOUNDS` |
| SE-4 | **Karakterler birbirinden ayrışır.** Aynı rolde iki karakterin 1/3 oktav A ağırlıklı profil farkı (LSD) **ortanca ≥ 15 dB, en az ≥ 10 dB** olur. En yakın merkez sınıflamasında ≥ %85'i doğru karaktere düşer. **Kapsam** (yüzlerce kartta sınırlı spektrum alanı yüzünden): katalog ≤ 24 karakter iken bütün çiftler; sonra yeni karakter × aynı ses paletini kullananlar + LSD'ye göre en yakın 4 + aynı sette / hazır destede yan yana çıkabilecekler; geri kalanı rapor. | spektrum analizi | A2: rol çifti LSD ortanca 18,4 dB, en az 11,7 dB; 21/24 doğru (`palette.txt`) |
| SE-5 | **Malzeme darbesi:** çarpan değil, vurulan gövde çalar. Darbe malzeme × Light / Heavy / Magic'tir. Ağır = alt bas + sürüş (drive) + daha uzun. Hafif = kısa ve tiz. Büyü = halka modülasyonlu cızırtı + parlak kuyruk; vuruşu bir oktav yukarıdadır ve kısadır (alt bası büyünün kendi sesi taşır, ikisi birbirini maskelemez). Aynı karede aynı tarif ikinci kez çalmaz (`playHit` ağırlık varyantına geçer, −2 dB). Malzemeler arası LSD ≥ 9 dB olur. | spektrum analizi | `slice.ts materialHit`, `MATERIALS`; A2 LSD: Light 19,5–22,0, Heavy 11,0–13,6, Magic 9,1–16,2 dB |
| SE-6 | **Tepe değer:** kliplerde gerçek tepe ≤ −1 dBFS (MP4 / AAC dahil) olur, kırpılan örnek 0'dır. v3 çıkış tavanı örnek tepesini −1,5 dBFS'e sabitler. | `clip.mjs` seviye satırı | `audio/v3/output.ts V3_CEILING (knee 0,6, top 0,84)`. A2: örnek −1,73…−2,92 dBFS; 4× TP −1,68…−2,92; AAC −1,36…−1,95; bu belgedeki klip −2,2 dBFS, 0 kırpma |
| SE-7 | **Ducking:** büyük vuruşlar müziği kısar (tarif `duck` 0,2–0,8). 0,8'de müzik +50–200 ms'de −7,9 dB'dir, 1,5 sn'de geri gelir. Büyük an (kükreme, yıldırım, ağır darbe) için `duck` ≥ 0,55, küçük darbe için ≤ 0,3. | `duck.txt` türü analiz | A2: `boltStrike` 0,8 → −7,9 dB; `wyrmRoar` 0,65 → −6,5; `hitCrystalHeavy` 0,55 → −4,2; `hitClothLight` 0,25 → −1,5 |
| SE-8 | **Doğrulama:** ajanlar duyamaz. Zamanlama `measure` ile, tını / seviye / maskeleme çevrimdışı işlenmiş dalga ve spektrum analiziyle kontrol edilir. Kullanıcıya her aşamada **sesli MP4** gönderilir (`clip.mjs`, §9.5). Son karar kullanıcının kulağındadır. | MP4 teslim edildi | `tools/clip.mjs` |

**Dilimdeki iki ses paleti** (`audio/v3/slice.ts` başlığı ve `shots/v3/a2f/soundfix/palette.txt`):

| | Kristal Ejder | Uçurum Büyücüsü |
|---|---|---|
| Perde | E: cam, E majör pentatonik E6–B7 (MIDI 88–107); gövde halkası E5 / G#5 / B5 / E6 | D ve tritonu G#: D1 / D2 dron (36,7 / 73,4 Hz) |
| Tını blokları | serbest çubuk modları (`glassBell`, üst modlar önce söner), `glassRain` pırıltı kuyruğu, ters pırıltı; derin formant hırlaması (52–96 Hz ses telleri, formantlar 330 / 760 / 1950 Hz) | ayarı kaydırılmış testere dişi dron; alçak geçiren filtre yavaşça açılır (180 → 700 → 220 Hz); pembe "nefes"; pürüzlü titreşim; FM 1,41 zırh tıngırtısı; kumaş çırpması |
| Zarf | sert atak, yükselen çubuk modları; her büyük vuruş cam pırıltısıyla biter | yavaş atak (sürenin ~%35'i), açılıp kapanan filtre |
| A ağırlıklı merkez (ortanca) | 1758 Hz (1011–3163) | 764 Hz (224–1936) |
| Enerji < 600 Hz / > 1 kHz (A ağırlıklı) | 0,79 / 0,86 | 0,99 / 0,27 |

A4 sesleri (taslak): ateş = çıtırtı + hışırtı, su = çarpma + kabarcık, taş = gümbürtü + çakıl,
tüy = çırpınma, bitki = kopma + hışırtı, ışık = sinüs çan pırıltısı. Malzeme tablosuna
(`MATERIALS`) parametre olarak eklenir. `materialOf` bugün yalnız iki dilim canavarını tanıyor
(§10.10).

---

## 8. Kalite kapıları

### 8.1 Yeni canavarın kabul ölçütleri (A2'nin 11 maddesinin genellemesi)

Her madde **evet / hayır** olarak işaretlenir. Kanıt `shots/v3/<aşama>/<canavar>/` altına konur.

| # | Kapı | Komut / ölçü | Geçer |
|---|---|---|---|
| KK-1 | **Referans kare kapısı:** yeni stil idle f0, referansın (v1 idle f0 ya da onaylı still) yanında ×3 incelendi ve onaylandı. Sonra anim çizildi. | `monster-sheet --still` (still varsa) / v1 ile v3 sayfası yan yana | Sİ-5, IŞ-10, IŞ-11 |
| KK-2 | **×3 sayfalar, P1 + P2,** her animin her karesi en az 3 eleştiri turunda incelendi (sanat, hareket, teknik; A2'deki gibi). Bulgular kural kimliğiyle yazıldı. | `monster-sheet --anims all --scale 3` ve `--p2` | §1, §2, §4 |
| KK-3 | **Sayfa sayıları:** pay ≥ 2, kenar pikseli 0; out ≤ 1,2; in ≤ 2,0; döngü dikişi ≤ 1,4; idle en büyük Δ ≤ 1,8 × idleΔ; canlılık ≥ %15; guard 0,3–0,8 × idleΔ; gürültü bütçesi. | `monster-sheet` .txt / .json | Sİ-2, HA-14…HA-20, IŞ-10 |
| KK-4 | **Temas karesi yerel:** hit / hitHeavy / hitMagic / death f0 sayfada < %50, **her idle fazına karşı** < %50 (`monster-gates` "HA-21 phase") **ve ekranda** (dinlenen hedef) < %50 ve sayfanın ≤ +5 puanı; önce vurulan bölge tepki veriyor (fark haritası); temas karesinde sprite dinlenme konumunda, itme sonraki kare değişiminde (ölümcül darbe dahil, tutulan itme `knockPx`). Dilim, idle fazı ve ekran değerlerinden muaftır; yedi temasın ekran değeri `docs/v3/A3_MIMARI.md` §10'da kayıtlıdır. | `popIn × idleΔ / opaque`, fark haritası; `monster-gates` (HA-21, HA-21 phase, HA-11 travel); `contact-probe` (A3) | HA-11, HA-21 |
| KK-5 | **Ayak ve süzülme:** ayak satırı ve x aralığı idle / guard / geçişlerde sabit; süzülende yer noktası sabit, `dx = 0`. | sayfa kareleri, satır taraması | HA-9, HA-10 |
| KK-6 | **İşaretler ve noktalar:** §4.1'deki zorunlu işaretler var. `points().muzzle` her karede ağız / kaynak üzerinde (`--points` ile ×3'te görülür). | `monster-sheet --points` | HA-1, HA-25 |
| KK-7 | **Süre bütçesi:** canavarın bütün senaryoları (summon, attack, direct, blocked, death, revive, position, flip, effect; P1 ve P2) §5 sınırında. Sayı = temas ±1 kare, yok olma ≤ 1,4 sn, ilan ≤ 0,3 sn, LP ≤ 0,4 sn. | `measure --look v3` + bütçe denetimi | §5 |
| KK-8 | **Filmler incelendi:** P1 / P2; normal / kurbanlı / diriltme; hafif / ağır ve fiziksel / büyüsel darbe; savunmada ölüm; kaybeden saldıran. Boş kare, ayak kayması, tam ekran yıkama ve silüeti örten efekt yok. | `shot --fresh --film`, beyaz denetimi | EF-1…EF-14 |
| KK-9 | **v1 ve dilim değişmedi:** v1'in bütün senaryoları ±17 ms (fark yok), diğer canavarların bütün temel kareleri aynı hash'te, v1 film kümesi ve dilim film kümesi piksel piksel aynı (A2 kabulündeki gibi; küme `docs/v3/A3_MIMARI.md` §13). | `measure --scenarios all --compare <önceki v1>`; `sheet-hash --compare` ve `--look v3` (çıkış 0); `filmdiff` (A3) | — |
| KK-10 | **v3'te bütün senaryolar çalışıyor:** hata, watchdog ve kötü durma yok; zoom her zaman 1. | `measure --scenarios all --look v3` | EF-8 |
| KK-11 | **Demo oyunlar:** `?look=v3` ile 2 CPU'ya karşı CPU oyunu oyun sonuna kadar oynandı (bir 1×/2×, bir 3×), işleyici hatası 0, watchdog 0. | demo-qa (v3 girişi, §10.9) | — |
| KK-12 | **Ses:** işaret senkronu ≤ 1 kare (1× ve 3×), sürekli sesler resmiyle bitiyor, tepe ≤ −1 dBFS, ayrışma (SE-4 / SE-5), kullanıcıya sesli MP4 gönderildi. | `measure` sfx, `clip.mjs` | §7 |
| KK-13 | **Bellek ve açılış:** P2 sayfası tembel boyanıyor. İlk çağırmada ya da ilk ölümde > 50 ms donma yok (`warmPoses`). Canavar bütçesi: ≤ 140 kare, ≤ 8 ms / kare, **kırpılmamış** sayfa baytı / taraf boy sınıfına göre (as ≤ 7 MB, büyük ≤ 5 MB, orta ≤ 3,6 MB, küçük ≤ 2,2 MB). A4.1'den sonra her çiftte **toplam** kapı: iki taraf toplamı ≤ 64 MB (kırpılmış atlasla), arka plan boyaması ≤ 8 sn, `?test` açılışı A3 tabanının ≤ +%20'si. | `monster-gates`; `soak` / longtask; `texmem` (A4.1) | `_v3/warm.ts`; A3_MIMARI §11 |
| KK-14 | **Derleme:** `npm run typecheck` temiz, `npm test` geçiyor. | — | — |
| KK-15 | **Benzerlik denetimi** (§8.2), canavarın gövde tipinde başka canavar varsa: hiçbir kapsamdaki çift KALIR değil; her UYARI çiftinde ayrışma kartı okunmuş ve kör göz testi geçmiş. | `sameness.ts` (`--controls` çıkış ≠ 3), kör sayfa + `--score` (§8.2.1) | §8.2 |

### 8.2 Benzerlik denetimi (sameness) — **sayılar: §8.2.1 (A3 mimarisi)**

**Amaç.** Aynı gövde tipinden üretilen canavarlar (A4'te: Magma Titanı, Gelgit Golemi, Taş
Muhafız — üç ağır insansı; Kor Kurdu, Şimşek Kertenkelesi — iki dört ayaklı) yalnız renkleri
değişmiş kopyalar gibi görünmemeli. Yapı paylaşılır, görünüş ve hareket karakteri paylaşılmaz.

**Ne ölçülecek (niyet):**
- **Silüet:** renksiz (gri ya da tek renk) idle f0, attack bırakma karesi ve hit f0 silüetleri
  çapaya hizalanıp boyca normalize edildiğinde aynı gövde tipindeki her çift için IoU **üst sınırın
  altında** olacak. Eşik: §8.2.1 (`KEY`).
- **Hareket:** aynı rol animlerinin ritim imzası ayrışacak: charge→release süresi, bekleme dizisi,
  işaret zamanları, örtüşme gecikmeleri / periyotları, ağırlık sınıfı. Fark metriği ve eşik:
  §8.2.1 (`SI`, `RHYTHM`).
- **İmza:** her canavarın en az bir kendine özgü pozu / parçası / malzemesi olacak ve okunacak
  (Titan: göğüs çekirdeğinden ateş topu; Golem: iç akıntılar ve kolla su topu; Muhafız: kaya
  fırlatma ve kalkan kimliği; A0 §1.3, §4.2).
- **Bekleme döngüleri:** idle ve guard da ölçülür (faz bağımsız): canavarlar düellonun çoğunu bu
  döngülerde geçirir. Aynı periyot ve fazla nefes alan komşular da "kopya" sayılır.
- **Göz testi (kör):** canavarları yapmayan ayrı bir inceleyici, adları gizli, renksiz ve boyu
  normalize edilmiş silüetleri ve ortak nötr gövdeye aktarılmış hareket şeritlerini ayırabilecek
  (protokol §8.2.1).

**Ne zaman:** gövde tipinden ikinci canavar çıktığında ve sonra her yenisinde, mevcut bütün
kardeşleriyle çift çift (yüzlerce kartta kapsam §8.2.1). İlk canavar o gövde tipinin referansı olur.

#### 8.2.1 Ölçüler ve eşikler (A3 mimarisi, `docs/v3/A3_MIMARI.md` §9)

**Ölçüler.** Hepsi oyunun çizim yolundan, Node'da, deterministik. Silüet = opak maske, çapaya hizalı,
her sanat kendi idle f0 gövde boyu 56 px olacak şekilde en yakın komşuyla ölçeklenmiş. İz = bir noktanın
idle f0'daki yerinden kayması, gövde boyuna bölünmüş, beklemelere göre 24 zaman örneği. Ortak animler:
attack, roar, hit, hitHeavy, hitMagic, summon, death ve döngüler idle, guard.

| Kod | Ne ölçer | Tanım | Rolü |
|---|---|---|---|
| `KEY` | anahtar poz silüeti | idle f0, attack `release` karesi ve hit f0 silüetlerinin IoU ortalaması | kapı |
| `MOT` | hareket yolu, gövde biçiminden bağımsız | iz kaynağı: plan canavarında eklemler (`joints()`: eller, baş, kalça, ayaklar, eşya), öteki v3 sanatında `points()`, v1'de silüet vekili (`MOTs`: tepe, ön, arka, değişen kütle). Tek seferlikte DTW hizalaması (±%12 süre) + ortalaması çıkarılmamış kosinüs; döngüde döngüsel kaydırmaların en büyüğü (faz bağımsız). `MOTsig` = max(attack, roar), `MOTloop` = max(idle, guard), `MOTavg` = bütün ortak animlerin ortalaması | kapı |
| `SI` | silüetli hareket benzerliği | her ortak anim için (idle ve guard dahil, döngüde faz bağımsız): [8 zaman örneğinde silüet IoU ortalaması × max(0, hareket eğrisi Pearson r)]; animler üzerinden ortalama. Farklı gövdede aynı hareketi göremez, bu yüzden `MOT` ile birlikte kullanılır | kapı |
| `RHYTHM` | ritim imzası | attack / roar / special: [charge→release, release→recover, toplam]; hit\*: [impact→recover, toplam]; death: [impact→dissolve, toplam]; idle / guard döngü imzası: [toplam, baş periyodu, gövde periyodu, baş gecikmesi] (HA-6). Bileşenlerin hepsi max(40 ms, %8) içindeyse o animde "aynı ritim" | kapı (birleşik) |
| `SIL0` | yalnız idle f0 silüeti | IoU | rapor + uyarı (A4'te Sİ-5 gereği v1'den miras) |
| `HEAT` | nerede hareket ediyor | attack ve hit'te idle f0'dan farklı piksellerin maskesi, IoU | rapor + birleşik kural + bindirme PNG'si |
| `PAL` | palet | idle f0 değer (6 kutu) ve ton (8 kutu) histogramı L1 | rapor |

**Eşikler** (aynı gövde tipindeki ya da aynı arketip koreografiyi kullanan her çift; `MOT` eşikleri
silüet vekilinden **geçicidir**, A3'te eklem / nokta izleri ve negatif kontrollerle kesinleşir):

| Ölçü | GEÇER | UYARI | KALIR |
|---|---|---|---|
| `KEY` | < 0,62 | 0,62 – 0,70 | ≥ 0,70 |
| `MOTsig` | < 0,55 | 0,55 – 0,80 | ≥ 0,80 |
| `MOTloop` | < 0,65 | 0,65 – 0,85 | ≥ 0,85 |
| `MOTavg` | < 0,45 | 0,45 – 0,70 | ≥ 0,70 |
| `SI` | < 0,35 | 0,35 – 0,50 | ≥ 0,50 |
| `RHYTHM` | farklı | attack'ta ya da idle döngüsünde aynı | attack'ta aynı **ve** (`MOT` attack ≥ 0,55 ya da `SI` ≥ 0,35 ya da `KEY` ≥ 0,62); ya da idle'da aynı **ve** `MOT` idle ≥ 0,65 |
| `HEAT` | — | ≥ 0,70: bindirmeye bakılır | ≥ 0,70 **ve** `MOT` attack ≥ 0,55 (geçici) |
| `SIL0` | < 0,70 | ≥ 0,70 | ≥ 0,80, yalnız v1 referansı olmayan (yeni) kartlarda |

- **UYARI** iki iş ister: (a) canavar dosyasındaki **ayrışma kartı** (silüet kancası, ritim, idle, guard,
  imza parça, malzeme, imza hareket) dolu ve inceleme notunda okunmuş; (b) **kör göz testi** (aşağıda)
  geçmiş. Göz testi kalırsa çift KALIR sayılır.
- **KALIR**: çift kabul edilmez. Tek istisna ayrışma kartındaki `allow` kaydıdır (gerekçe + kullanıcı
  onayı; ör. bilerek "kardeş" tasarlanmış kartlar).
- **Plan dışı çiftler** (`--against all`): aynı ölçüler raporlanır; KALIR eşiği UYARI sayılır (kör göz
  testi), engellemez.
- **A4 hedefi (ağır üçlü), mutlak:** her çift `MOTsig` < 0,55, `MOTloop` < 0,65, `MOTavg` < 0,45, `SI` < 0,35,
  `RHYTHM` attack'ta ve idle'da farklı, `HEAT` birleşik kuralı tetiklenmemiş, `KEY` < 0,70 ve kendi v1
  değerinin altında (Titan × Muhafız 0,662; Golem × Muhafız 0,658; Titan × Golem 0,615), kör göz testi %100.
  Kurt × Kertenkele: `SI` < 0,35, `MOTsig` < 0,55, `MOTloop` < 0,65.
- **Ölçünün kör olmadığı kanıtlanır** (`sameness.ts --controls`, çıkış 3 = ölçü kör): renk değişimi, ±60 ms
  oynatılmış beklemeler ve "bir üyenin hareketleri öbürünün gövdesinde" çapraz kurulumu KALIR çıkmalıdır,
  **adlandırdıkları her bant ölçüsünde KALIR bandının üst yarısında** (değer ≥ eşik + ½ × (1 − eşik): `KEY` ve
  `MOTavg` ≥ 0,85, `MOTsig` ≥ 0,90, `MOTloop` ≥ 0,925; A4.1 sıkılaştırması — çizginin hemen üstündeki bir
  kontrol "neredeyse kör" bir ölçüdür); aynı karakter v1 → v3 `MOTavg` ≥ 0,70; v1 golem × muhafız GEÇER
  olamaz; kullanıcının ayrı bulduğu dilim çifti GEÇER. Biri tutmazsa ölçünün tanımı değişir, kontrol değil.
  §9.2'deki "(c) vekilde `MOTsig` 1,00" bir gözlemdir, tolerans değil: 50–60 ms'lik beklemelerde ±60 ms
  DTW bandını (±3 / 24 örnek ≈ ±%12) aşar; Muhafız'ın 0,986 (eklem) / 0,987 (vekil) değeri ölçünün çalıştığını
  gösterir (bant derinliği 0,92 / 0,91). Gözlem, ölçüldüğü 14 sanatın (12 v1 + dilim) gerileme denetimi
  olarak kalır (A3 açık nokta 3 kapandı).
- Eşikler A3 (pilot + taslak Titan + kontroller) ve A4.1 sonunda v3 çiftleriyle yeniden kalibre edilir.
  Gevşetme kullanıcı onayı ister; sıkılaştırma bu bölüme yazılarak yapılır.
- **A4.1 yeniden kalibrasyonu** (v3 üyeleri: Ejder, Büyücü, Muhafız + kayıt dışı Titan ve Yılan; `sameness.ts
  --calib --art … --cross …`: 121 denetim, 0 kalan; kanıt `shots/v3/a4/sameness/calib/`). Plan dışı = farklı
  gövde tipinden iki üye (ya da plan üyesi × elle yapılmış as); "en düşük / en çok" değerler:

  | Küme | `KEY` | `MOTsig` | `MOTloop` | `MOTavg` | `SI` |
  |---|---|---|---|---|---|
  | Kontroller: (a) renk, (c) ±60 ms; (b) Titan ↔ Muhafız çapraz kurulumu ve ±60 ms'si (yalnız `MOTsig` / `MOTloop`) — en düşük | 1,000 | 0,975 | 0,977 | 0,977 | — |
  | Aynı karakter, hareketi korunan (Ejder, Büyücü v1 → v3) — en düşük | 0,830 | 0,932 | 0,985 | 0,789 | 0,579 |
  | Plan içi farklı çiftler: dilim çifti / Muhafız × Titan | 0,509 / 0,659 | 0,536 / 0,439 | 0,256 / 0,389 | 0,370 / 0,344 | 0,199 / 0,112 |
  | Plan dışı v3 çiftleri (8) — en çok | 0,492 | 0,820 | 0,792 | 0,486 | 0,244 |
  | v3 üyeleri × öteki canavarların v1 sanatı (55, vekil) — en çok | 0,673 | 0,818 | 0,980 | 0,592 | 0,236 |

  Karar: **bantlar korunur, tek sıkılaştırma kontrol kuralıdır** (yukarıda; en yakın kontrol bandın 0,85
  derinliğinde). Bantlar sıkılaştırılamaz: `MOTsig`'in KALIR çizgisini plan dışı v3 kükremeleri zaten aşıyor
  (Titan × Büyücü 0,820, Titan × Yılan 0,810: kükremede "dikilip baş geri, kollar açık" ortak bir dil), `KEY`'in
  UYARI bandı ağır üçlünün mirası (Sİ-5 idle f0 + HA-21 yerel hit f0: Muhafız × Titan 0,659, `SIL0` 0,723);
  `MOTloop`, `MOTavg`, `SI` için plan içinde çizgiye yaklaşan çift yok, sıkılaştırmanın kanıtı da yok.

**Kör göz testi.** `sameness.ts --blind DIR` adlı tek referans satırı (her üyenin idle f0'ı), karıştırılmış
kodlu silüetler (attack `release`, roar tepesi, hit f0, guard f0) ve ortak nötr bir gövdeye aktarılmış
hareket şeridi çiftleri (attack, roar ve idle döngüsü — roar A4.1'de eklendi: `MOTsig` attack ile roar'un
büyüğüdür; her çift kendi ölçü kaynağında; bir kısmı aynı üyenin kontrol çiftleri) yazar; hepsi renksiz, boyu 56 px'e
normalize, ×3. Cevap anahtarı ayrı bir dizine yazılır. İnceleyen, canavarları yapmayan **ayrı bir
ajandır**; sanat dosyalarını, ayrışma kartlarını ve anahtarı görmez. `--score` puanlar: silüet kodlarının
her çift için %100'ü doğru üyeye, farklı üye hareket çiftlerinin hepsi "farklı", kontrol çiftlerinin
≥ %80'i "aynı".

**Kapsam (yüzlerce kart).** Ölçü hesabı bütün çiftlerde yapılır (ucuz). Kapı: plan üyesi ≤ 8 iken bütün
kardeşler; sonra aynı arketipi kullananlar + `KEY` / `MOTsig`'e göre en yakın 4 + aynı sette / hazır
destede yan yana çıkabilecekler. Kör göz testi yalnız kapsamdaki UYARI çiftlerine, yeni canavar başına
tek sayfayla. Sıradan katman: `KEY` GEÇER, `MOTsig` KALIR değil, kör göz testi; sağlanamazsa kapı
gevşetilmez, kart daha çok elle iş alır.

**Kalibrasyon** (12 v1 canavarı + dilim; `<scratch>/v3/a3/judge/calib*.txt`, `<scratch>/v3/a3/revise/mot.txt`):

| Çift | `KEY` | `SI` | `SIL0` | `MOTsig` / `MOTloop` / `MOTavg` (vekil) |
|---|---|---|---|---|
| Ejder v1 → v3 / Büyücü v1 → v3 (aynı karakter, yeniden çizilmiş) | 0,880 / 0,830 | 0,613 / 0,579 | 0,997 / 0,955 | 0,93 / 1,00 / 0,88 — 0,94 / 0,99 / 0,79 |
| Golem × Muhafız (v1) | 0,658 | 0,307 | 0,651 | 0,59 / 0,43 / 0,32 (`HEAT` 0,706) |
| 66 farklı v1 çifti: medyan / p90 / en çok | 0,448 / 0,555 / 0,662 | 0,120 / 0,284 / 0,459 | 0,474 / 0,573 / 0,721 | medyan 0,42 / 0,46 / 0,29 |
| Ejder v3 × Büyücü v3 | 0,509 | 0,199 | 0,526 | 0,35 / 0,61 / 0,44 |

v1'de 12 canavarın 6'sının attack'ı 10 kare / 833 ms / darbe 417 ms, hepsinin hit'i 4 kare / 400 ms:
`RHYTHM` bunları "aynı" sayar. Dilim farklıdır (ejder [460, 460, 1350], büyücü [500, 150, 1180] ms).
`HEAT` tek başına ayırmaz (aynı karakter 0,82, farklı çift 0,71'e kadar), enerji eğrisi korelasyonu
işe yaramaz; `HEAT` yalnız birleşik kuralda kapıdır. v1 guard döngüleri birbirinin aynısıdır (`MOTloop`
66 çiftte en çok 0,97): döngüler bu yüzden kapıdadır.

**Araç.**

```sh
npx vite-node tools/sameness.ts --look v3 --plan biped [--ids a,b] [--against all] [--art <taslak.ts>] \
  [--controls] [--blind DIR] [--out DIR] [--json]
npx vite-node tools/sameness.ts --score DIR/form.json --key <anahtar.json>
```

Çıktı: çift matrisi (GEÇER / UYARI / KALIR), JSON, UYARI ve KALIR çiftleri için anahtar poz silüet
bindirmeleri (×3), ısı haritası ve eklem izi bindirmeleri, kör göz testi sayfaları. Çıkış kodu 0 / 1
(UYARI) / 2 (KALIR) / 3 (kontrol tutmadı). Üretilen PNG'lere bakılır. KK-15 bu bölümle işaretlenir.

---

## 9. Araçlar (bu belge için çalıştırılan komutlar)

Bütün araçlar deterministiktir: oyun saati dondurulur ve adım adım ilerletilir. Çıktılar
`shots/v3/<aşama>/…` ya da karalama dizinine yazılır. **Üretilen PNG'ye her zaman bakılır**
(Read aracı).

### 9.1 `monster-sheet` — kare kare sayfa + sayılar (5–6 sn / canavar)

```sh
npx vite-node tools/monster-sheet.ts --id crystal_wyrm --look v3 --anims all --scale 3 --points --out <dir>
npx vite-node tools/monster-sheet.ts --id abyss_magus --look v3 --anims all --scale 3 --p2 --out <dir>-p2
npx vite-node tools/monster-sheet.ts --id crystal_wyrm,abyss_magus --look v3 --anims none --still --out <dir>
npx vite-node tools/monster-sheet.ts --art <taslak.ts> --look v3 --anims hit,hitHeavy --scale 3 --out <dir>   # kayıt dışı taslak
```

- Çıktılar:
  - `<id>-v3-<anim>.png`: ×3 şerit; başlıkta kare no, bekleme ms ve işaretler; kenara değen kare
    kırmızı çerçeveli.
  - `-all.png`: bütün animler tek sayfada.
  - `.txt` / `.json`: bbox, pay, kenar px, isolated, opaque, Δ, noktalar; idleΔ, in / out, seam.
- Gürültü oranı ve hit f0 yüzdesi JSON'dan şöyle hesaplanır: `info[i].isolated / info[i].opaque`;
  hit f0 % = `popIn × idle.meanDelta / idle f0 opaque`.

### 9.2 `shot` — film şeridi ve tek kareler (~30 sn)

```sh
node tools/shot.mjs "?dev=duel&s=saWyrmAtk&look=v3" --fresh --film 12 --every 100 --start 400 --cols 4 --out <png>
node tools/shot.mjs "?dev=duel&s=saWyrmAtk&look=v3" --fresh --film 8 --every 17 --start 680 --clip 200,80,240,160 --scale 3 --cols 4 --out <png>   # temas anı kare kare, ×3
node tools/shot.mjs "?dev=duel&s=saWyrmAtk&look=v3" --fresh --film 60 --every 17 --frames <dir> --out <png>                  # her kare PNG
node tools/shot.mjs "?dev=monster&id=abyss_magus&look=v3" --scale 3 --out <png>                                                # canlı sayfa
```

- `--fresh`, düelloyu donmuş saatte yeniden başlatır: piksel düzeyinde tekrarlanır.
- Senaryo anahtarları `src/duel/scenarios.ts` ve `src/duel/scenarios/*.ts` içindedir (dilim
  paketi: `slice*`).

### 9.3 `measure` — süreler, temas, sayı, zoom, olaylar (~25 sn / 2 senaryo)

```sh
node tools/measure.mjs --scenarios saMagusAtk,sliceWyrmPos --look v3 --jobs 2 --norender --out <json>
node tools/measure.mjs --scenarios 'slice*,saWyrm*,saMagus*,suWyrm*,suMagus*' --look v3 --jobs 2 --out shots/v3/<aşama>/measure-v3.json
node tools/measure.mjs --scenarios all --jobs 2 --out <v1.json> --compare shots/v3/a2/acceptance/measure-v1.json   # v1 kapısı: 2 = >17 ms kayma
node tools/measure.mjs --diff <eski.json> <yeni.json>
```

- JSON şunları tutar: `events[]` (başlangıç, bitiş, süre), `sfx[]`, `anims[]` (kare kare),
  `contactMs`, `firstNumberMs`, `lp[]`, `zoom`, `busy`, `errors`.
- Bütçe tablosu A2'de karalama betiğiyle (`budget.mjs`) üretildi; depoda yok (§10.9).

### 9.4 `sheet-hash` — eski canavarlar piksel piksel aynı mı (~6 sn)

```sh
npx vite-node tools/sheet-hash.ts --out <json> --compare shots/v3/a2/acceptance/sheet-hashes.json   # "all base frames identical", çıkış 0
```

- `extra` (yeni pozlar) ve `p2` (relight sayfası) ayrı parmak izi taşır. Bir temel kare değişirse
  araç 2 ile çıkar.

### 9.5 `clip` — sesli MP4 (~25 sn; kullanıcıya gönderilecek kanıt)

```sh
node tools/clip.mjs "?dev=duel&s=saMagusAtk&look=v3" --music off --marker magusOrbRelease --out <mp4>
node tools/clip.mjs "?dev=duel&s=suWyrm&look=v3" --out shots/v3/<aşama>/clips/suWyrm.mp4          # müzikli, ducking dahil
```

- Yanında `.wav` (44,1 kHz) ve `.json` (zaman çizelgesi + seviyeler) yazılır.
- Seviye satırını okumak gerekir: tepe dBFS, kırpılan örnek sayısı.
- `--marker`, sesin duyulduğu kareye beyaz kutu çizer (görüntü / ses senkron kontrolü).
- `--solo a,b` tek sesi bağlam içinde dinletir. Bu belge için alınan klipte tepe −2,2 dBFS,
  0 kırpılan örnek, `magusOrbRelease` 750 ms'de (kare 23).

---

## 10. Dilimin plana göre açık noktaları (bilinçli sapmalar ve eksikler)

1. **Hazırlık süresi `motion.ts` tablosundan uzun.**
   - Tablo: mediumHeavy 220–300 ms, caster 300–380 ms.
   - Dilim: charge → release ejderde 460 ms, büyücüde 500 ms. Bunun önüne ilanın 233 ms'lik
     şarj tutuşu da eklenir.
   - Büyücü attack toparlanması 470 ms; tablo 320 ms diyor.
   - Tablonun `anticipationMs` ve `releaseEase` alanlarını kod okumuyor, oynayan beklemelerdir.
   - Tablo dilime göre güncellenmeli ya da sınıf imzası beklemelerden tanımlanmalı (HA-8).
2. **Poz hızı:** plan §3 "kabaca saniyede 8–16" diyor, dilim 40–200 ms kullanıyor (§0.3).
3. **Temas karesi yerelliği yalnız sayfada geçerli.** Kitin `knock()` fonksiyonu temas karesinde
   bütün sprite'ı 1 px kaydırıyor. Bu tek başına büyücünün piksellerinin ~%61'ini değiştirir. Yani
   ekranda < %50 tutmuyor. Ayrıca ölümcül darbede tepki f1'i hiç görünmeden ölüme devrediliyor ve
   arkadan darbede tepki pozu oynamıyor. **A3 çözümü** (`docs/v3/A3_MIMARI.md` §10, yapım adımı Y1):
   temas karesinde sprite kımıldamaz, itme temastan sonraki ilk kare değişiminde başlar (ölüm animi
   dahil); plan canavarlarında itmenin bir kısmını poz çizer. HA-11, HA-21 ve KK-4 buna göre yazıldı;
   KK-4 ekrandaki değeri `contact-probe` ile ister.
4. **victory pozu çizildi ama oynatan yok.** `flow/end.ts` canavarlarda `roar` kullanıyor. Poz
   tutulan bir sonda bitiyor (out 3,5–4,3 × idleΔ). Kullanılacaksa dönüş geçişi gerekir.
5. **LP akışı tavanı (≤ 400 ms):** "tüm senaryolarda en büyük" denetimi 416 ms (`saMagusAtk`) ve
   450 ms (`saWyrmP2`) gösteriyor; A2 kabulünde açık kaldı. Muhtemelen iki LP değişimi tek patlama
   olarak sayılıyor. Doğrulanmadı.
6. **İşaretler tutarsız.** Ejder death'te `contact` yok, büyücüde var. Büyücü attack'ta `contact`
   yok (mermi: temas sinematikte). HA-1 bunu standartlaştırıyor.
7. **Gürültü ölçüsü kaba.** Meşru 1 px köşegenleri de sayıyor: büyücü guard ortalaması %14,5
   (kalkan kabuğu), idle'da %9,2. Bütçe bu yüzden kare sınıfına göre verildi (IŞ-10).
8. **GAME_DESIGN §4–§5 güncellenmedi.** Beyaz silüet flaşı, %15 ezilme, 1,08 zoom ve bloom
   kuralları orada duruyor. v3'te bu rehber geçerli (§0.3).
9. **Kapıların dayandığı bazı araçlar depoda değil, karalamada.** Bütçe denetimi (`budget.mjs`),
   hit f0 fark haritası (`hitf0.py`), ayak satırı (`feet.py`), P2 `litBias` (`p2light.py`), ses
   palet / seviye / maskeleme analizleri (`a2f/soundfix/tools/*.py`) ve `demo-qa`'nın v3 girişi
   (A2 değiştirilmiş bir kopya kullandı). A3 mimari adımında `tools/` altına alınmaları
   öneriliyor.
10. **Ses ve ölüm tabloları iki canavarı adıyla tanıyor.**
    - `materialOf` / `CHARACTER_SOUNDS` yalnız `crystal_wyrm` / `abyss_magus` için dolu. Diğerleri
      genel darbe sesine düşüyor.
    - Fırtına Atmacası'nın tüy fırtınası `plant` ön ayarıyla çiziliyor; `feather` malzemesi yok.
    - Malzeme kütüphanesi bunları birleştirmeli (MA-1).
11. **Kart resmi (`portrait`) hâlâ v1 çizimi** (A5'e kaldı). Cut-in'de P2 ışığı yalnız ejderde
    çözüldü (`p2: 'relight'`). Büyücünün cut-in'inde relight seti yok: P2 aynalı P1 çizimini
    görüyor, ışık ekranın sağ üstünden geliyor (IŞ-1 / EF-10 ihlali, dosyada "A5 için" notu var).
