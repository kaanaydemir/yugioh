# NEON DÜELLO — Oyun Tasarım Belgesi

> İzometrik pixel art, iki kişilik (aynı ekranda) kart düellosu. Öncelik: **mükemmel animasyon**.
> Her kart masaya konduğunda dizideki gibi canavar hologram olarak hayata gelir.

---

## 1. Vizyon

- **Stil:** "Neon Pixel Arena". Gece vakti havada süzülen izometrik bir düello platformu. Koyu lacivert zemin, P1 camgöbeği (cyan), P2 kızıl, büyüler turkuaz, tuzaklar macenta, as kartlar altın.
- **His:** Her hamle küçük bir sinematik. Kart uçar, yere çarpar, büyü çemberi açılır, ışık sütunu yükselir, canavar tarama çizgileriyle belirir ve kükrer. Darbelerde vuruş anı donması (hit-stop), ekran sarsıntısı ve piksel kıvılcımları olur. Yok olan canavar kendi piksellerine ayrılarak dağılır.
- **Teknik:** Phaser 3 + TypeScript + Vite. **Tüm grafikler kodla üretilir** (PixelCanvas). Dışarıdan görsel ya da ses dosyası yoktur, sesler WebAudio ile sentezlenir.
- **Çözünürlük:** 640×360, tam sayı katlarıyla büyütülür (2×, 3×). `pixelArt: true`.

---

## 2. Kurallar (Speed Duel tabanlı, sadeleştirilmiş)

| Kural | Değer |
|---|---|
| Başlangıç LP | 4000 |
| Deste | 20 kart (her oyuncu aynı 20 kartın birer kopyası, karıştırılmış) |
| Başlangıç eli | 4 kart |
| Canavar alanı | 3 |
| Büyü/Tuzak alanı | 3 + 1 Alan Büyüsü bölgesi |
| El sınırı | Bitiş Aşamasında 6 (fazlası atılır) |
| İlk tur | İlk oyuncu kart çekmez ve saldıramaz |

**Tur akışı:** Çekme Aşaması → Ana Aşama → Savaş Aşaması → Bitiş Aşaması. Speed Duel'deki gibi 2. Ana Aşama yoktur.

### Ana Aşama
- **Normal Çağırma / Kapalı Koyma:** Turda 1 kez (ikisi toplam 1 hak). Seviye 1–4 kurbansız, 5–6 için 1 kurban, 7 ve üzeri için 2 kurban.
- **Çevirerek Çağırma:** Daha önceki bir turda kapalı konmuş canavar, açık saldırı pozisyonuna çevrilir.
- **Pozisyon değiştirme:** Açık canavar, sahaya geldiği tur değilse, bu tur saldırmadıysa ve bu tur pozisyonu değişmediyse, turda 1 kez.
- **Büyü/Tuzak koyma:** Boş bir B/T alanına kapalı konur.
- **Büyü aktive etme:** Elden ya da sahadaki kapalı büyüden (koyulduğu tur bile olur).

### Savaş Aşaması
- Açık saldırı pozisyonundaki her canavar turda 1 kez saldırabilir (o tur çağrılmış olsa bile, düellonun ilk turu hariç).
- Rakibin canavarı yoksa doğrudan saldırı yapılır. Fırtına Atmacası her zaman doğrudan saldırabilir.
- **Hasar hesabı:**
  - **Saldırıya karşı saldırı:** Yüksek ATK düşüğü yok eder, fark düşük olanın sahibine hasar olarak gider. Eşitse (>0) ikisi de yok olur ve hasar olmaz. 0'a 0'da bir şey olmaz.
  - **Saldırıya karşı savunma:**
    - ATK > DEF: savunan yok olur, hasar olmaz (delici hasar hariç).
    - ATK < DEF: kimse yok olmaz, saldıran oyuncu DEF − ATK kadar hasar alır.
    - Eşitse bir şey olmaz.
  - **Kapalı savunma canavarı:** Saldırıya uğrayınca hasar hesabından önce açılır (flip). ÇEVİR etkisi savaştan sonra çözülür.

### Tuzaklar
- Kapalı konduğu tur aktive edilemez. Yalnızca rakibin hamlesine yanıt olarak açılır.
- **Yanıt pencereleri:**
  1. Rakip saldırı ilan ettiğinde: Ayna Kalkanı, Işık Zincirleri.
  2. Rakip ATK ≥ 1000 bir canavarı Normal ya da Kurbanla Çağırdığında: Yer Yarığı.
- Uygun tuzak varsa motor `trapResponse` kararını açar. Savunan oyuncu bir tuzak seçer ya da "Geç" der.
- Sade zincir: yanıt verilen tuzağa karşı yeniden yanıt verilemez.

### Tetiklenen etkiler — çözülme sırası
1. **Çağırma:** Önce rakibin tuzak penceresi açılır. Canavar hâlâ sahadaysa çağırma etkileri çözülür: Magma Titanı, Işık Perisi, Uçurum Büyücüsü.
2. **Savaştan sonra** sırayla:
   1. Şimşek Kertenkelesi (savaşta yok olduysa)
   2. Kor Kurdu (hedefi yok ettiyse ve kendisi sahadaysa)
   3. Gelgit Golemi (savunmadayken saldırıya uğradıysa)
   4. Dikenli Pusucu ÇEVİR etkisi (saldırıyla açıldıysa)

### Kazanma
- Rakibin LP'si 0 olursa kazanırsın.
- Rakip kart çekmesi gerekirken destesi boşsa kazanırsın.
- Teslim olan kaybeder.
- İki oyuncunun LP'si aynı anda 0 olursa sıra kimdeyse o kazanır.

---

## 3. Kartlar (20)

### Canavarlar (12)
| # | Kart | Element / Tür | Svy | ATK/DEF | Etki | Sprite |
|---|---|---|---|---|---|---|
| 1 | **Kristal Ejder** (`crystal_wyrm`) ★AS | IŞIK / Ejderha | 7 | 2800/2300 | — | 96×96 |
| 2 | **Uçurum Büyücüsü** (`abyss_magus`) ★AS | KARANLIK / Büyücü | 6 | 2300/2000 | Kurbanla Çağrıldığında: rakibin 1 B/T kartını yok et | 80×80 |
| 3 | **Magma Titanı** (`magma_titan`) ★AS | ATEŞ / Alev | 5 | 2100/1500 | Çağrıldığında: rakibe 500 hasar | 80×80 |
| 4 | **Mercan Yılanı** (`coral_serpent`) ★AS | SU / Deniz Yılanı | 5 | 2000/1600 | Delici hasar | 80×80 |
| 5 | **Kor Kurdu** (`ember_wolf`) | ATEŞ / Canavar | 4 | 1700/1000 | Savaşta yok edince: 300 hasar | 64×64 |
| 6 | **Gelgit Golemi** (`tide_golem`) | SU / Su | 4 | 1100/2000 | Savunmadayken saldırılırsa: saldırana 300 hasar | 64×64 |
| 7 | **Fırtına Atmacası** (`storm_hawk`) | RÜZGAR / Kanatlı | 3 | 1000/800 | Doğrudan saldırabilir | 48×48 |
| 8 | **Taş Muhafız** (`stone_sentinel`) | TOPRAK / Kaya | 4 | 500/2100 | — | 64×64 |
| 9 | **Işık Perisi** (`lumen_sprite`) | IŞIK / Peri | 2 | 400/600 | Normal Çağrıldığında: 500 LP kazan | 48×48 |
| 10 | **Gölge Suikastçı** (`shade_assassin`) | KARANLIK / Savaşçı | 4 | 1900/400 | — | 64×64 |
| 11 | **Şimşek Kertenkelesi** (`volt_lizard`) | IŞIK / Gök Gürültüsü | 4 | 1500/1200 | Savaşta yok olunca: rakibe 500 hasar | 64×64 |
| 12 | **Dikenli Pusucu** (`thorn_lurker`) | TOPRAK / Bitki | 2 | 600/800 | ÇEVİR: rakibin 1 canavarını yok et | 48×48 |

**Etki ayrıntıları:**
- **Magma Titanı:** Her açık çağırmada tetiklenir (normal, kurbanlı, özel, çevirme).
- **Işık Perisi:** Yalnızca Normal Çağırmada tetiklenir.
- **Uçurum Büyücüsü:** Yalnızca Kurbanla Çağırmada tetiklenir. Hedef seçenekleri rakibin B/T alanları ve Alan Büyüsü. Rakipte hiç B/T kartı yoksa etki olmaz.

### Büyüler (5)
| Kart | Tür | Etki |
|---|---|---|
| **Yıldırım Hükmü** (`judgment_bolt`) | Normal | Rakibin 1 canavarını yok et |
| **Şifa Pınarı** (`healing_spring`) | Normal | 1000 LP kazan |
| **Ruh Çağrısı** (`soul_recall`) | Normal | Herhangi bir mezarlıktan 1 canavarı saldırı pozisyonunda sahana Özel Çağır |
| **Ejder Kılıcı** (`dragon_blade`) | Kuşanma | Kendi açık canavarına +700 ATK. Canavar sahadan ayrılınca kılıç da yok olur. |
| **Volkan Arenası** (`volcano_arena`) | Alan | Tüm ATEŞ canavarlar +500 ATK, tüm SU canavarlar −300 ATK (en az 0). Yeni alan büyüsü eskisini yok eder. |

### Tuzaklar (3)
| Kart | Tetik | Etki |
|---|---|---|
| **Ayna Kalkanı** (`mirror_barrier`) | Rakip saldırı ilan ettiğinde | Rakibin saldırı pozisyonundaki tüm canavarlarını yok et |
| **Işık Zincirleri** (`chains_of_light`) | Rakip saldırı ilan ettiğinde | Saldırıyı geçersiz kıl. Savaş Aşaması biter, tur Bitiş Aşamasına geçer. |
| **Yer Yarığı** (`chasm_trap`) | Rakip ATK ≥ 1000 bir canavarı Normal/Kurbanla Çağırdığında | O canavarı yok et |

---

## 4. Görsel Stil

- **Işık** sol üstten gelir. Gölgeler sağ alta düşer.
- **Kontur:** Her sprite'ın etrafında 1 piksel `PAL.ink` konturu olur (`p.outline(PAL.ink)`).
- **Palet:** Yalnızca `src/art/palette.ts` rampaları kullanılır. Her rampa koyudan açığa 5 tondur. `shade(c, ±n)` aynı rampada ton kaydırır.
- **Sprite yönü:** Canavarlar SAĞA bakar (P1). P2 için oyun `flipX` uygular.
- **Boyut sınıfları:**

  | Sınıf | Seviye | Kare (frame) | Görünen boy |
  |---|---|---|---|
  | Küçük | 1–3 | 48×48 | ~30–38 px |
  | Orta | 4 | 64×64 | ~42–52 px |
  | Büyük | 5–6 | 80×80 | ~58–70 px |
  | As | 7 | 96×96 | ~80 px, kanatlar kareyi doldurur |

- **Okunabilirlik:**
  - Silüet tek başına tanınmalı.
  - Gözler ve enerji noktaları en parlak ton ve tek tek pikseller olmalı.
  - Parlayan kısımlar (çekirdek, damarlar) rampanın 3–4. tonu olur, bloom efekti bunları öne çıkarır.
- **Hologram:** Çağırma ve yok olma anlarında yatay tarama çizgileri, titreme ve renk kayması görülür (shader). Normal hâlde canavarlar katıdır, yalnızca hafif bir rim ışığı vardır.
- **Arena:** Siyah-lacivert yüzen platform ve kenarlarda neon çizgiler. P1 karoları cyan, P2 karoları kızıl yanar. Arkada yıldızlı gökyüzü, uzakta stadyum siluetleri, sis ve süzülen ışık zerreleri olur.

---

## 5. Animasyon İncili (bütün ekip için kurallar)

1. **Hazırlık → Hareket → Takip.**
   - Her hareketten önce bir hazırlık olur: geri çekilme, eğilme ya da güç toplama.
   - Hareket hızlıdır.
   - Sonrasında bir takip gelir: savrulma, toz, geri dönüş.
   - Doğrusal (linear) easing yalnızca ışınlarda ve sabit akışlarda kullanılır.
2. **Darbe anı (impact) kutsaldır.** Her vuruşta şunlar birlikte olur:
   - 60–100 ms hit-stop
   - Hedefin 1–2 kare beyaz silüet flaşı
   - Kıvılcım patlaması
   - Hasarla orantılı ekran sarsıntısı (1–5 px)
   - Hasar sayısının zıplayarak çıkması
3. **Ezilme ve uzama.**
   - Kart yere çarpınca %15 ezilir.
   - Canavar zıplarken uzar.
   - Damage numaraları önce büyüyüp sonra küçülür.
4. **Tek odak.** Aynı anda tek bir ana olay olur. Kamera hafif zoom ve kaydırma ile odağı gösterir (1.0 → 1.08).
5. **Renk dili:**
   - P1 cyan, P2 kızıl
   - Büyü turkuaz, tuzak macenta, as kart altın
   - Elementler: IŞIK altın-beyaz, KARANLIK mor, ATEŞ turuncu, SU mavi, TOPRAK kahve, RÜZGAR yeşil
6. **Hiçbir şey ölü durmaz.**
   - Canavarlar idle döngüsünde nefes alır.
   - Kapalı kartlarda ara sıra parlama süpürmesi olur.
   - Karolar nabız gibi atar, gökyüzü yıldızları göz kırpar.
7. **Süre bütçesi** (normal hızda):

   | Olay | En fazla |
   |---|---|
   | Kart çekme | 0,35 sn |
   | Normal çağırma | 1,8 sn |
   | Kurbanlı çağırma | 2,5 sn |
   | As + cut-in | 4 sn |
   | Yakın dövüş saldırısı | 2 sn |
   | Işın saldırısı | 2,5 sn |
   | Büyü | 2,5 sn |
   | Tuzak | 3 sn |
   | Tur başı | 1,2 sn |
   | Düello açılışı | 6 sn |

   **Space** ya da basılı tutulan tıklama hızı 3× yapar. Ayarlardan "Hızlı animasyon" 2× seçilebilir.
8. **Ses her darbeye eşlik eder** (WebAudio sentez). Müzik Savaş Aşamasında gerilir.
9. **Durum her zaman doğru kalır.** Sinematik bitince görünümler motor durumuna `sync` edilir, animasyon ne yaparsa yapsın sonuç doğrudur.

---

## 6. Olay → Animasyon

### `gameStart` (≤6 sn, atlanabilir)
1. Gökyüzünden arenaya kamera inişi yapılır. Stadyum ışıkları tek tek yanar.
2. Düellocular belirir.
3. Pixel bir yazı-tura dönerek ilk oyuncuyu seçer.
4. "DÜELLO!" yazısı sarsıntıyla çarpar.
5. Desteler karılır, 4'er kart yay çizerek ele gelir.

### `turnStart`
1. Gizlilik perdesi açıksa önce "Oyuncu 2'nin Turu — hazır olunca dokun" perdesi çıkar.
2. Çapraz şeritli bir pankart kayar: "OYUNCU 2 · TUR 3".
3. Aktif tarafın karoları nabız atar.

### `draw`
1. Kart deste karosundan kalkar.
2. Yay çizerek ele uçar ve dönerek açılır.
3. Eldeki kartlar yeniden yelpazelenir.

### `phaseChange`
- Faz çubuğundaki işaretçi kayar.
- Savaş fazında kırmızı nabız ve "SAVAŞ AŞAMASI" pankartı çıkar, müzik yoğunlaşır.

### `summon`: normal (~1,6 sn)
| Zaman | Ne olur |
|---|---|
| 0 ms | Kart elden kalkar, büyür, oyuncu renginde iz bırakarak yay çizip karoya uçar. |
| 250 ms | **Çarpma:** kart ezilir, karo flaşı, toz halkası, 2 px sarsıntı. |
| 300 ms | Kart izometrik olarak açılır. Element büyü çemberi döne döne genişler. |
| 500 ms | Element renginde ışık sütunu yükselir, kart pikselleri sütuna akar. |
| 700 ms | **Hologram belirme:** shader alttan üste açar, tarama çizgileri, parçacıklar toplanır, canavar `roar` oynar. |
| 1100 ms | Sütun kıvılcımlara dağılır, yerde şok halkası, ATK/DEF rozeti zıplayarak çıkar, ardından `idle`. |

**Element varyantları:**

| Element | Çağırma görüntüsü |
|---|---|
| IŞIK | Altın çember, düşen tüy ve parıltılar, beyaz sütun, lens parlaması |
| KARANLIK | Yerde mor girdap, yükselen gölge dokunaçları. Canavar gölge birikintisinden çıkar. |
| ATEŞ | Karo çatlar, turuncu ışık, alev patlaması, kor ve duman |
| SU | Halka halka dalga, gayzer sütunu, damlalar ve kabarcıklar |
| TOPRAK | Karo çatlar, taşlar yükselip döner, toz bulutu. Canavar yerden yükselir. |
| RÜZGAR | Yapraklı yeşil hortum. Canavar yukarıdan rüzgârla iner. |

### `tribute` + kurbanlı çağırma
1. Kurban canavar beyaz parlar.
2. Piksel akıntılarına dönüşüp yay çizerek hedef karoya akar.
3. Çağırma daha büyük bir çemberle oynar.
4. Kart as ise cut-in gelir.

### As cut-in (~1,6 sn)
1. Ekran %60 kararır, zaman yavaşlar.
2. Soldan çapraz bir bant kayar: element renginde hız çizgileri.
3. Yakın plan portre paralaks ile girer, gözler parlar (kare animasyonu).
4. İsim pankartı çarpar: "KRİSTAL EJDER!"
5. Beyaz flaş olur ve sahaya dönülür. Dev şok halkası ve 4 px sarsıntı.

### `setMonster` / `setSpellTrap`
- Kart kapalı uçar, yumuşak "set" sesiyle iner, karo oyuncu renginde nabız atar.
- Kapalı kartta ara sıra parlama süpürmesi geçer.

### `flip`
1. Kapalı kart zıplar ve döner.
2. Element patlaması olur, canavar fırlar.
3. Dikenli Pusucu'da önce sarmaşıklar yerden fışkırır.

### `positionChange`
- **Saldırı → savunma:** canavar `guard` pozuna çöker, mavi altıgen kalkan bir an parlar, karodaki kart 90° döner.
- **Savunma → saldırı:** canavar kalkar ve kısa bir kükreme yapar.

### `attackDeclare`
1. Saldırandan hedefe oyuncu renginde bir nişan çizgisi çekilir.
2. Hedefte dönen köşeli bir kilit (reticle) belirir.
3. Saldıran hazırlık pozuna geçer, kamera hafif zoom yapar.

### `battle`
1. Saldırının imza animasyonu oynar (bkz. 7).
2. **Darbe:**
   - Hit-stop
   - Beyaz silüet flaşı
   - Kıvılcımlar
   - Sarsıntı
   - Hasar sayısı (kırmızı, zıplar ve yükselir)
   - LP sayacı tık tık düşer, panel kırmızı flaş ve sarsıntı yapar
3. Saldıran savunmaya çarpıp kaybederse geri seker, kalkan kıvılcımı ve "çın" sesi olur.

### `destroy`
1. Canavar `hit` oynar.
2. Hologram arızası: yatay kayma ve tarama titremesi.
3. Canavarın **kendi pikselleri** parçacık olarak dağılır, element renginde kırıklar eşlik eder.
4. Kart mezarlığa iz bırakarak uçar.

### `damage` / `lpGain`
- **Hasar:** Hasar sayısı çıkar, LP sayacı tik sesleriyle akarak düşer.
- **Etki hasarı:** Bir ateş topu ya da enerji karşı panele uçar.
- **Kazanç:** Yeşil-altın parıltılar panele akar, sayaç akarak artar.

### `statChange`
- ATK rozetindeki sayı akarak değişir: artarsa yeşil, düşerse kırmızı.
- Küçük ok parçacıkları çıkar.

### `discard`
- Kart pikseller hâlinde yukarı doğru yanarak dağılır ve mezarlığa gider.

### `gameOver`
1. LP 0'a iner, ağır çekim başlar.
2. Kaybedenin bütün hologramları arızalanıp çöker.
3. Ekranda xl yazıyla "KAZANAN: OYUNCU 1" çıkar, altın havai fişekler patlar, zafer melodisi çalar.
4. "Tekrar Oyna" seçeneği gelir.

### `decision` (tuzak yanıtı)
1. Savunan oyuncunun kapalı kartları macenta nabız atar.
2. "Oyuncu 2: Tuzak kartı açmak ister misin?" diye sorulur: [Aç] / [Geç].

---

## 7. Kart İmza Animasyonları

### Canavar saldırıları ve etkileri

**Kristal Ejder — "Prizma Nefesi"** (ışın)
- **Güç toplama** (500 ms): Baş geriye kalkar, ağızda beyaz-mavi parçacıklar toplanır, yer parlar.
- **Ateş** (400 ms): Hedefe kalın bir prizma ışını gider. Çekirdeği beyaz, kenarları cyan, gökkuşağı piksel saçakları vardır.
- **Darbe:** Kristal kırıklarıyla patlama ve ekran çapında ışık.
- **Sprite pozları:**
  - `attack`: geri çekilme → ağız açık. `attackImpactFrame` ağzın açıldığı karedir, `muzzle` ağızdır.
  - `roar`: şaha kalkar, kanatlar tam açılır.

**Uçurum Büyücüsü — "Uçurum Küresi"** (mermi)
- **Güç toplama:** Asa kalkar, dönen rünlerle mor küre büyür.
- **Atış:** Küre mor iz bırakarak fırlar.
- **Darbe:** Hedefte önce girdap gibi içe çeker, sonra patlar.
- **Etki:** Asa hedef B/T kartını gösterir. Yerden kartın altına gölge dokunaç uzanır, kart çatlar ve boşluğa yutulur.
- **Sprite:** Süzülür (hover 6). `muzzle` asanın küresidir.

**Magma Titanı — "Lav Yumruğu"** (yakın dövüş)
- **Hareket:** Yere basar (sarsıntı), ağır ağır atılır, yumruk atar.
- **Darbe:** Lav patlaması, magma sıçrar, yer çatlakları parlar.
- **Etki:** Göğüs çekirdeği parlar, karşı panele yay çizen bir ateş topu gider: "−500".

**Mercan Yılanı — "Gelgit Mızrağı"** (ışın)
- **Hareket:** Geriye kıvrılır, dalgalı kenarlı yüksek basınçlı su jeti fırlatır.
- **Darbe:** Su sıçraması ve damlalar.
- **Delici hasar:** Jet savunanı delip geçer ve düellocuya çarpar.

**Kor Kurdu — "Kor Dişi"** (yakın dövüş)
- **Hareket:** Çömelir, alev hızıyla atılır (art görüntüler, yerde ateş izi), ısırır.
- **Darbe:** Alev patlaması.
- **Etki:** Yok edince uluma (`roar`) gelir, alev ruhu panele uçar: "−300".

**Gelgit Golemi — "Dalga Darbesi"** (yakın, menzilli dalga)
- **Hareket:** Kollar kalkar, yerde bir dalga hedefe yuvarlanır, köpükle çarpar.
- **Savunmada etki:** Saldırana geri bir su sıçraması gider: "−300".

**Fırtına Atmacası — "Kasırga Dalışı"**
- **Hareket:** Yükselir, spiral çizerek dalar. Beyaz-yeşil rüzgâr kesikleri hedefi yarar, sonra geri döner.
- **Doğrudan saldırı:** Düşman canavarlarının üstünden yay çizerek geçer.

**Taş Muhafız — "Kaya Fırlatma"**
- **Hareket:** Yerden bir kaya kopartır (kaya yükselir), parabol çizerek fırlatır.
- **Darbe:** Kaya parçalanır, toz bulutu kalkar.

**Işık Perisi — "Işık Kıvılcımı"**
- **Hareket:** Döner, 3 küçük parıltı hedefe kavis çizerek gider.
- **Etki:** Parıltılar yukarı yağıp kendi paneline akar: "+500".

**Gölge Suikastçı — "Gölge Adımı"**
1. Gölge birikintisine batar.
2. Birikinti yerde hedefe kayar.
3. Hedefin arkasından çıkar, X şeklinde iki mor kesik atar.
4. Geri döner.

**Şimşek Kertenkelesi — "Şimşek Kuyruğu"**
- **Hareket:** Sırt dikenleri çıtırdar, zikzak şimşek hedefe çakar, ekran titrer.
- **Etki:** Yok olunca kalıntısından rakip paneline şimşek gider: "−500".

**Dikenli Pusucu — "Diken Kırbacı"**
- **Hareket:** Sarmaşıklar yerde uzanıp hedefi kırbaçlar, dikenler saçılır.
- **ÇEVİR etkisi:** Hedef canavarın altından sarmaşıklar fışkırır, sarar ve ezer.

### Büyüler

**Ortak açılış:**
1. Kart sahanın ortasında yükselir ve 2× büyüyerek resmini gösterir.
2. Arkasında turkuaz aura ve dönen rün halkası belirir, kart 500 ms bekler.
3. Kart enerjiye dönüşüp etkinin yerine uçar.

| Kart | Animasyon |
|---|---|
| **Yıldırım Hükmü** | Gök kararır, hedefin üstünde fırtına bulutları toplanır, kilitlenir. Dev zikzak yıldırım düşer: beyaz flaş, gök gürültüsü, sarsıntı, hedef parçalanır. |
| **Şifa Pınarı** | Oyuncunun tarafında turkuaz bir pınar fışkırır. Damlalar yay çizerek LP paneline akar, yeşil parıltılar çıkar, "+1000". |
| **Ruh Çağrısı** | Seçilen mezarlık parlar. Canavarın yarı saydam ruhu yükselir ve hedef karoya süzülür. Cyan bir sütun onu tam bir çağırmaya dönüştürür (hologram belirme). |
| **Ejder Kılıcı** | Canavarın üstünde altın rünlerden bir kılıç belirir, döner ve iner. Canavar altın parlar, kalıcı altın aura kazanır, ATK rozeti akarak artar. |
| **Volkan Arenası** | Saha dönüşür: sarsıntı, karo aralarında lav ışığı, kor kırmızısı gökyüzü, süzülen kül ve korlar. ATEŞ canavarlara alev aurası (+500, yeşil), SU canavarlara buhar (−300, kırmızı). Etki kalıcıdır. |

### Tuzaklar

**Ortak açılış:**
1. Kapalı kart dik olarak kalkar, macenta flaş patlar.
2. "TUZAK!" pankartı çarpar, zaman yavaşlar.

| Kart | Animasyon |
|---|---|
| **Ayna Kalkanı** | Savunan tarafın önünde dev bir macenta-beyaz altıgen ayna kubbe oluşur. Saldırı kubbeye çarpar, çok sayıda ışın olarak geri yansır ve saldıranın saldırı pozisyonundaki bütün canavarlarını vurur. Hepsi parçalanır. |
| **Işık Zincirleri** | Karttan parlayan zincirler fırlar, atılmakta olan saldıranı havada sarar. Saldıran kendi karosuna geri çekilir, zincir kilitlenir ("tak"). "SAVAŞ BİTTİ" pankartı çıkar. |
| **Yer Yarığı** | Yeni çağrılan canavarın altındaki zemin çatlar ve parlayan bir uçuruma açılır. Canavar içine düşer (maskeyle aşağı kayar), kayalar düşer, çatlak gürleyerek kapanır. |

---

## 8. Mimari

```
src/
  data/cards.ts            20 kart (sözleşme)
  engine/                  saf kurallar motoru (Phaser yok), types.ts sözleşme
  art/
    palette.ts             renk rampaları
    pixel.ts               PixelCanvas çizim araçları
    types.ts               MonsterArt / CutinArt / CardArtwork sözleşmeleri
    monsters/<id>.ts       canavar sprite'ları (otomatik bulunur)
    cutins/<id>.ts         as cut-in portreleri
    textures.ts            PixelCanvas → Phaser doku + animasyon
  boot/NN-<ad>.ts          açılışta doku üreten adımlar (otomatik bulunur)
  view/layout.ts           izometrik projeksiyon, alan konumları, derinlik bantları
  view/*.ts                tahta, kart, canavar, el, HUD görünümleri
  vfx/core.ts              promise tabanlı tween/wait/shake/flash/hitStop
  vfx/*.ts                 efekt kütüphanesi (çemberler, sütunlar, ışınlar, parçalanma, ...)
  audio/sfx.ts             WebAudio ses efektleri + müzik
  ui/text.ts               pixel font API'si
  cinematics/              olay → sinematik (Director)
  scenes/                  Boot, Dev, Title, Duel
  dev/previews/<ad>.ts     ?dev=<ad> önizleme sayfaları
tools/shot.mjs             headless ekran görüntüsü + filmstrip
```

**Akış:**
1. Oyuncu bir eylem seçer, `engine.apply(state, action)` çağrılır ve `{state, events}` döner.
2. `Director.play(events)` her olayı sırayla sinematik olarak oynatır.
3. Ardından `views.sync(state)` çalışır, oyuncu yeniden kontrolü alır.

**Test:**
- `npm test` (vitest) motoru doğrular.
- `node tools/shot.mjs "?dev=..."` görselleri doğrular. `--film N --every MS` ile animasyon kare kare incelenir.
