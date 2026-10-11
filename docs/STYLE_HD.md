# Neon Düello — HD Neon Stil Rehberi (deneme sürümü)

Amaç: Reddit'te beğenilen oyunun **kamera açısını, kompozisyonunu ve neon atmosferini aynen koruyup** görsel detayı ve animasyon kalitesini belirgin şekilde artırmak. İlham: "Dead Minute" HD-2D rehberi.

## 1. Tek cümlede

**İzometrik HD piksel + neon ışık katmanı:** Hacimden üretilmiş, ışığı hesaplanmış piksel art canavarlar; aynı izometrik neon arena; üstünde tam çözünürlükte akan dinamik ışık, bloom, sis ve hologram efektleri. Canavarlar her zaman keskin.

## 2. Temel ilkeler

- **Kompozisyon değişmez.** 640×360 yerleşim ×1.5 → 960×540. Aynı 5×5 izometrik ızgara, aynı alanlar, aynı yerler (`src/hd/contracts.ts`).
- **Piksel görünümü çizimden gelir, filtreden değil.** En yakın komşu büyütme, kenar yumuşatma kapalı, renk azaltma filtresi yok.
- **Piksel yoğunluğu:** Varsayılan olarak ortam ve canavar aynı yoğunlukta (1 sanat pikseli = 1 HD pikseli = 1080p'de 2 ekran pikseli; şu ankinden 1,5 kat ince). Deneme sayfasında **D** tuşu ortamı 2 kat iri piksele (HD-2D "iki yoğunluk" stili) çevirir; ikisini karşılaştırıp karar vereceğiz.
- **Işık piksel değildir.** Bloom, ışık huzmeleri, sis, ışın parlaması yumuşak ve tam çözünürlüklü; keskin piksellerin üstünden akar.
- **Canavar her zaman net.** Bloom/parlama canavar silüetinin üstüne taşmaz; arka plan (stadyum, gök) hafif yumuşatılabilir.
- **Gradyan yerine ton rampası.** Malzeme başına 5–7 ton. Canavarlarda dither yok (temiz bantlar); ortamda 4×4 düzenli dither serbest.
- **Hacimden üretilen sprite.** Canavarlar elle boyanmaz: kodda iskelet + hacimler (elipsoit, konik tüp, kristal yüzey) → ışık hesaplanır → palet rampalarına oturtulur. Her kare aynı iskeletten çıkar (oranlar kaymaz). Aynı hacimlerden **normal haritası** çıkar → dinamik ışığa tepki.
- **Dinamik ışık.** Işınlar, alevler, çağırma sütunları sahneyi ve canavarları gerçekten aydınlatır.
- **Kenar ışığı sahibinin renginden:** P1 canavarına sol alttan cyan, P2'ninkine sağ üstten kızıl (dinamik). Böylece taraf her an okunur.
- **Detaylı ama 8-bit değil;** silüet tek başına tanınır.
- **Yakın plan = ayrı portre** (sprite asla büyütülmez).
- **Hazır görsel/ses dosyası yok,** her şey kodla üretilir.

## 3. Teknik ölçüler

| Ölçü | Değer |
|---|---|
| Mantıksal çözünürlük | 960×540; 1080p'de 2×, 4K'da 4× tam sayı ölçek |
| Karo | 96×48 izometrik eşkenar dörtgen |
| Canavar kareleri | As 192×192 (Kristal Ejder) · Orta 128×128 (Kor Kurdu); ileride Küçük 96×96, Büyük 160×160 |
| Görünen gövde | As ~150 px · Orta ~85–95 px |
| Ton sayısı | Sprite malzeme başına 5–7, portre 6–9, ortam 3–9 |
| Kontur | 1 px, renkli, asla saf siyah değil; gölge tarafında koyu, ışıklı tarafta yumuşak (seçici kontur) |
| Renk kayması | Gölgeler lacivert/mora, ışıklar sıcak altına |
| İç detay | Parçalar arası 1 px iç çizgi, 2 px temas gölgesi, ayak altında 4 kademeli piksel gölge |
| Animasyon | idle 12 kare/1,2 sn döngü · roar 14 kare/1,0 sn · attack 14–18 kare @14–16 fps · hit 6 kare · guard 8 kare/2 sn döngü |
| Normal haritası | Her kare için; Phaser Light2D |
| Kamera | 2:1 izometrik ortografik; sinematik anlarda 1,0–1,15 zoom/kayma |
| Kadraj | 16:9; büyük anlarda 2.35:1 siyah bantlar kayarak girebilir |
| Parçacıklar | 1–3 px kareler, bloom ile parlar |

## 4. Deneme canavarları

| Canavar | Kimlik | Işık imzası |
|---|---|---|
| **Kristal Ejder** (P1, as) | Beyaz/buz mavisi yüzeyli kristal pullar, sırtta kristal dikenler, uzun boyun ve kristal bıçak uçlu kuyruk, yarı saydam kristal panelli kanatlar (cyan damarlar), altın geriye kıvrık boynuz, parlayan beyaz-cyan gözler | Göz/damar #b6fbff, ışın çekirdeği #f4f7ff, kenar cyan |
| **Kor Kurdu** (P2, orta) | Kömür grisi kürk (temiz ton bantlarıyla kürk tutamları), canlı alevden yele-kuyruk-pençeler (her karede titreşen), amber gözler, keskin silüet | Alev #ff8a1e → #ffda66; yakınını turuncuya boyar |

## 5. Işık

- **Temel:** soğuk lacivert ortam (#12163a) + iki taraf ışığı (P1 cyan #3fe0ea sol alttan, P2 kızıl #ff4d5e sağ üstten).
- **Olay ışığı:** bir olay olduğunda tek bir ışık sahneyi geçici olarak domine eder (çağırma sütunu, ışın, alev). Aynı anda iki baskın ışık yok — tek odak.
- **Renk dili:** turkuaz büyü, macenta tuzak, altın as/kritik an; element renkleri (IŞIK altın-beyaz, KARANLIK mor, ATEŞ turuncu, SU mavi, TOPRAK kahve, RÜZGAR yeşil).
- Toz/zerreler yalnızca ışık huzmelerinde parlar.

## 6. Tema (atmosfer) altyapısı

Arena bir **tema paketi** (`ArenaTheme`, `src/hd/contracts.ts`): gök, stadyum, platform, karolar, ortam canlılığı ve ışık havası. Deneme yalnızca **neon** temasıyla gelir; ileride festival/kar/uzay vb. temalar eklenip seviyeyle açılabilir veya satılabilir. Canavarlar temadan bağımsızdır; temanın ışığı onları kendi rengine boyar.

## 7. Palet (çekirdek)

Varolan `src/art/palette.ts` geçerlidir: mürekkep #07070f, gece #0b0d1f / #12163a / #1b2352 / #28356f, çelik #6578b4, sis #a3b1da, beyaz #f4f7ff, cyan #3fe0ea / #b6fbff, kızıl #ff4d5e / #bd1f3e, altın #ffd447 / #fff4b5, turkuaz #4fe2af, macenta #ff69ef, ateş #ff8a1e / #ffda66.
