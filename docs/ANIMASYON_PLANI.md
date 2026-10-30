# Neon Düello — Görsel Geçiş ve Animasyon Planı (v3)

Bu belge hem iş tanımı hem ilerleme dosyasıdır. Her aşama bitince durum tablosu (en altta)
güncellenir ve iş commit + push edilir.

## 0. Alınan kararlar

| Konu | Karar |
|---|---|
| Fusion / Extra Deck / oyun dışı / ele-desteye dönme | Bu planın **dışında**. Sonra ayrı bir oyun tasarımı işi olarak ele alınacak (kurallar, kartlar, yapay zekâ, arayüz). |
| Commit | Her aşama sonunda commit + push (`claude/yugioh-card-game-tgi7td`). |
| Arena | Sabit görseldeki **sakin arena** (`src/still/`) temel alınır: v1 geometrisi, koyu mat zemin, ince cyan / kırmızı bölge çizgileri, tek neon kenar şeridi. |
| Sıra | Önce görsel geçiş, sonra çıkış. Oyun her aşamada oynanabilir ve çıkarılabilir kalır. |
| Hedef (24 Ekim, kullanıcı) | Oyun **en kısa sürede Steam'de** çıkacak. Önce eldeki işler biter, sonra ön sürüm (pre-release); kart sayısı 60–80'e çıkmalı. Token bütçesi dikkatli kullanılır. |
| 3D (24 Ekim, kullanıcı) | **3D yok.** Görünüm 2.5D (izometrik) piksel sanatı olarak kalır. 3D ancak oyun para kazanırsa yeniden düşünülür. |
| Saha ve arka plan (30 Ekim, kullanıcı) | Saha 5 canavar + 5 büyü/tuzak alanına çıkar (7×5 ızgara, `?zones=5`, şimdilik isteğe bağlı; efektler 5 alana uyarlandıktan sonra varsayılan olur). **Arka plan ve sahanın görünümü beğenilmedi: yeniden tasarlanacak** (karar ve yön sonra konuşulacak; A7'den önce, 5+5 saha oturduktan sonra planlanır). | 

## 1. Altın kural

Her önemli aksiyon, karaktere veya karta özel, akıcı, okunabilir ve tatmin edici bir animasyonla
karşılık bulur. Akıcılık "daha çok kare" ya da "daha uzun tween" değildir: hazırlık → ağırlık
aktarımı → bırakma → temas → ikincil hareket → toparlanma okunmalıdır. Piksel dili korunur
(640×360, tam sayı ölçek, 1 px kontur, sınırlı palet); kesirli ölçekleme ve yumuşak geçişle
"akıcılık taklidi" yapılmaz. Başarı ölçütü efekt ya da kare sayısı değil, her aksiyonun
karakterli ve okunur olmasıdır.

## 2. Kapsam: oyundaki gerçek kartlar

### Canavarlar (12)

| Canavar | Oyundaki efekt | Animasyon anlamı | Ağırlık sınıfı (öneri) |
|---|---|---|---|
| Kristal Ejder | yok | güçlü çağırma, nefes saldırısı, kristal ölüm | orta-ağır |
| Uçurum Büyücüsü | Kurbanla çağrılınca rakibin 1 büyü/tuzağını yok eder | hedefli yok etme (asadan) | süzülen büyücü |
| Magma Titanı | Çağrılınca rakibe 500 hasar | çağırma anında hasar | ağır |
| Mercan Yılanı | Delici hasar | savunmayı delen saldırı | orta |
| Kor Kurdu | Savaşta yok edince rakibe 300 hasar | zafer sonrası ek darbe | orta-hafif |
| Gelgit Golemi | Savunmada saldırıya uğrarsa saldırana 300 hasar | karşı darbe | ağır |
| Fırtına Atmacası | Doğrudan saldırabilir | canavarların üstünden aşan saldırı | hafif (uçan) |
| Taş Muhafız | yok | savunma kimliği | ağır |
| Işık Perisi | Normal çağrılınca 500 LP | iyileştirme | hafif (süzülen) |
| Gölge Suikastçı | yok | hızlı, keskin hareket dili | orta-hafif |
| Şimşek Kertenkelesi | Savaşta yok edilince rakibe 500 hasar | ölüm anında boşalma | orta-hafif |
| Dikenli Pusucu | ÇEVİR: rakibin 1 canavarını yok et | kapalı karttan baskın | orta |

### Büyüler (5) ve tuzaklar (3)

| Kart | Etki | Animasyon anlamı |
|---|---|---|
| Yıldırım Hükmü | Rakibin 1 canavarını yok eder | kaynak → yol → temas → yok oluş |
| Şifa Pınarı | 1000 LP kazan | kontrollü iyileştirme akışı |
| Ruh Çağrısı | Herhangi bir mezarlıktan 1 canavarı Özel Çağırır | diriltme (mezarlık → saha bağı, yeniden birleşme) |
| Ejder Kılıcı | Kuşanılır, +700 ATK; sahada kalır | güçlendirme, silahın bedene bağlanması |
| Volkan Arenası | Alan: ATEŞ +500, SU −300; sahada kalır | kontrollü zemin dönüşümü, iki yönlü güç değişimi |
| Ayna Kalkanı (tuzak) | Saldırı ilanında rakibin saldırı pozisyonundaki tüm canavarlarını yok eder | çok hedef, okunur sıra |
| Işık Zincirleri (tuzak) | Saldırıyı geçersiz kılar, Savaş Aşamasını bitirir | engelleme |
| Yer Yarığı (tuzak) | 1000+ ATK Normal Çağrıyı yok eder | çağırmanın kesilmesi |

Oyunda **olmayanlar** (uydurulmayacak): kart çekme büyüsü, susturma, dönüşüm, gerçek kalkan,
geri gönderme, Fusion. Kristal Ejder'in özel efekti yoktur; yaşam döngüsünde onun yerine
ana canavar giriş portresi (cut-in) kullanılır.

### Motorun ürettiği olaylar (hepsi sunulacak)

gameStart, shuffle, draw, turnStart, phaseChange, tribute, summon (el / mezarlık / saha kaynaklı),
setMonster, setSpellTrap, positionChange, flip (çevirme çağrısı / saldırıya uğrama), activate
(büyü / tuzak / canavar efekti), target, attackDeclare, attackNegated, battle, damage, lpGain,
destroy, toGraveyard, equip, fieldSpell, statChange, discard, decision, responseDeclined,
deckOut, gameOver. Arayüz tarafında: kart seçme / hover, hedef seçme, geçersiz hedef.

## 3. Yöntem ve mimari

- **Kurallar ile sunum ayrı kalır.** Motor sonuçları üretir; sunum mevcut sinematik kayıt
  sistemiyle (olay işleyicileri + kart kancaları, `src/cinematics/_core/registry.ts`) yapılır.
  Hasar, ölüm ve kart taşıma bir kez işlenir; görsel kopyalar gerçek durumdan ayrı tutulur
  (kurban / yok etme yarıda kesilirse sahada hayalet kart kalmaz).
- **Yan sürüm değil, oyunun kendisi.** Geliştirme sırasında yeni görünüm tek bir anahtarla
  açılır; yeni çizimi biten canavar yenisini, bitmeyen eskisini kullanır. Dikey dilim
  onaylanınca yeni görünüm varsayılan olur, eski hal yedek kalır.
- **Stil koda taşınır.** Sabit görseldeki elle boyanmış kareler (`src/still/*-map.ts`) referanstır;
  kurallar (ekranda sol üst ışık, her parçada aydınlık / orta / gölge düzlemi, eklem gölgeleri,
  metal / kumaş / büyü ayrımı, gürültü sınırı) canavarların poz çizim koduna taşınır ki her
  kare aynı kaliteyi alsın. Yalnızca kilit pozlar elle rötuşlanır.
- **Sözleşme yalnızca genişletilir.** `src/art/types.ts` bozulmadan isteğe bağlı alanlar eklenir:
  kare başına bekleme süreleri (hazırlık uzun, darbe kısa), yeni çizilmiş pozlar (çağırma,
  ölüm, diriltme, özel efekt). Eski canavarlar değişmeden çalışmaya devam eder.
- **Poz hızı ve ekran hızı ayrı.** Ekran 60 FPS; pozlar değişken sürelerle (kabaca saniyede 8–16);
  efektler her karede güncellenir. Sprite konumları tam sayı piksel.
- **Kamera.** Bugünkü 1.06–1.08 kesirli yakınlaşma piksel ızgarasını bozar; v3'te kaldırıldı.
  23 Ekim kullanıcı kararı ("Kamerayı değiştirme böyle iyi"): zoom her zaman 1, yeni yakın çekim,
  kaydırma ya da takip eklenmez; bugünkü kamera davranışı olduğu gibi kalır. Sarsıntı yalnızca
  dünya kamerasını etkiler, arayüz sabit kalır.
- **Zaman.** Tek gösteri saati: duraklatma, hız (1× / 2× / 3×, basılı tutunca hızlandırma) ve
  hit-stop her alt sistemi aynı etkiler; sekmeden dönünce biriken zaman efektleri topluca
  tetiklemez; sahne kapanınca zamanlayıcı, tween, dinleyici ve parçacıklar temizlenir.
- **Kaynaklar** açılışta üretilir (ilk çağırma / ilk saldırıda donma yok); açılış süresi ve
  doku belleği bütçelenir.
- **Işık katmanı** hafif tutulur: dar, kontrollü neon yayılması; saldırı ve çağırmada kısa yerel
  aydınlatma; bloom yok, aynı anda bütün ekran parlamaz.
- **P2 ışığı (A1 kararı).** Varsayılan `p2: 'mirror'` kalır: P2 aynı sayfayı `flipX` ile gösterir,
  bugünkü 12 canavar birebir aynı çalışır. Yeni çizilen canavar `p2: 'relight'` derse ikinci bir
  sayfa (`mon:<id>:p2`, `DrawOpts.lightFrom = 'right'`) üretilir; `MonsterUnit` sayfayı denetleyen
  oyuncuya göre seçer (`applyFacing` / `setController`, Ruh Çağrısı ile taraf değişince de), anim
  anahtarları ve olaylar değişmez. Yalnız geliştirmeye ait şimle (`?dev=relight`; büyücünün P2
  idle'ı `still/magus-map.ts` karesi) P2'de ışık ekranda sol üste geçti (iç gölgeleme ölçütü
  `litBias`: aynalı −45,5 → relight +19,6; `shots/v3/a1/relight/`). Bedel: canavar başına kendi
  sayfası kadar doku (büyücü 2880×80 = 0,9 MB; 12 canavarın hepsi bugünkü sayfalarla +9,3 MB, A2
  pozlarıyla ~+19 MB) ve o kadar arka plan boyaması (büyücü eşzamanlı 236 ms; ertelenmiş kayıt
  4,6 ms, P2 sayfaları P1'lerden sonra boyanır). **Karar:** A2'den itibaren yeni çizilen canavarlar
  `relight` kullanır (sakin arenanın kazandırdığı ~12 MB bunu karşılar); eski stildeki canavarlar
  `mirror` kalır. `shatter` P2 sayfasındaki kareyi ışığı çevrilmiş çizer; cut-in portresi, kart
  resmi, hayalet (`set:ghost`) ve v2 ışık katmanının kare analizi henüz P1 sayfasını kullanıyor
  (A2/A5'te ele alınacak).

## 4. Hareket kuralları

- Bütün sprite'ı kaydırmak / sallamak / ölçeklemek tek başına animasyon sayılmaz.
- Baş, gövde, kol, kanat, kuyruk, asa ve cüppe gecikmeli hareket eder; yaylar doğaldır.
- Ayaklar kaymaz; hacim ve tasarım kareler arasında korunur; detaylar yüzeyde yüzmez.
- Bekleme ↔ saldırı ↔ darbe ↔ bekleme geçişlerinde poz sıçraması olmaz.
- Her hareket aynı hız eğrisini kullanmaz; ağır, hafif, süzülen ve büyücü karakterleri farklı
  ritimde hareket eder (yukarıdaki ağırlık sınıfları).
- Saldırı kaynağı anatomik noktayı izler: ışın ağızdan, büyü asa veya elden, pençe izi pençenin
  gerçek yayından. Hasar sayısı görsel temas anında çıkar.
- Hasar tepkisi yönü, şiddeti (hafif / ağır), fiziksel / büyüsel oluşu ve savunma pozisyonunu
  yansıtır; önce temas bölgesi, sonra diğer uzuvlar tepki verir.
- Ölüm karaktere özgüdür (kristal: çatlak ve ışık kaybı; büyücü: cüppe çökmesi ve karanlık
  çözülme; ateş: alevin sönmesi ve közler...) ve kartın doğru bölgeye gidişiyle süreklidir.
- Diriltme normal çağırmanın aynısı değildir ve onunla üst üste oynatılmaz.
- Efekt, eksik beden hareketini örtmek için kullanılmaz; ana karakterin silüeti sürekli kapanmaz.

## 5. Süre bütçesi (öneri, normal hız)

| Olay | Süre |
|---|---|
| Kart çekme | 0,3–0,5 sn |
| Kapalı koyma / pozisyon değişimi | 0,4 sn |
| Çevirme | 0,6 sn |
| Normal çağırma | 1,2–1,6 sn |
| Kurbanlı (ana canavar) çağırma | 2,5–3,0 sn |
| Diriltme | ~2,0 sn |
| Saldırı (canavara) | 1,6–2,2 sn |
| Doğrudan saldırı | ~1,6 sn |
| Bitirici saldırı | ≤ 3,5 sn |
| Büyü | 1,2–2,0 sn |
| Tuzak | 1,5–2,0 sn |
| LP değişimi | ~0,4 sn |
| Aşama geçişi / sıra başlangıcı | 0,3 / 0,6 sn |
| Oyun sonu | 3–4 sn |

Küçük işlemler kısa ve net, önemli çağırmalar ve bitirici saldırılar gösterişli. Hızlandırma
seçenekleri korunur; normal hızdaki sanat kalitesi düşürülmez.

## 5b. Ses (kullanıcı isteğiyle eklendi)

Oyunda 59 sentezlenmiş ses var (WebAudio; kayıtlı ses dosyası kullanılmaz, CLAUDE.md). Bugün çoğu
ortak: her canavar aynı `impactHeavy`, `roarBig`, `shatter`... sesini kullanıyor. v3 hedefi:

- **Animasyonla senkron:** her ses pozun işaretine bağlanır (hazırlık sesi `charge` karesinde,
  bırakma sesi `release`, darbe sesi `contact` karesinde, ölüm sesi `dissolve` ile). Ses ile görsel
  arasında kayma ≤ 1 kare.
- **Karaktere özgü ses kimliği:** her canavarın kendi tınısı (kristal ejder: cam / kristal
  rezonansı, derin kükreme; büyücü: alçak uğultu, asa vınlaması, karanlık nabız; ateş: çıtırtı;
  su: dalga; taş: gürleme...). Ortak sentez tarifleri parametreli olur, her canavar kendi
  parametre setini taşır (`src/audio`'da yalnız ekleme; `sfx.ts` API'si korunur).
- **Malzemeye göre darbe:** kristal, taş, metal, kumaş, su, ateş, gölge darbeleri ayrı tınıda.
  Hafif / ağır / büyüsel darbe ses olarak da ayrışır.
- **Karışım:** aynı anda çalan sesler birbirini boğmaz; büyük anlarda müzik kısılır (ducking);
  kırpılma yok; ses seviyeleri dengeli; hızlandırmada sesler bozulmadan kısalır.
- **Doğrulama:** ajanlar sesi duyamaz. Ses zamanlaması `tools/measure.mjs` ile ölçülür; tını,
  seviye ve kırpılma çevrimdışı işlenmiş dalga / spektrum analiziyle kontrol edilir. Son karar
  kullanıcının kulağındadır: her aşamada oyun içinden **sesli kısa video (MP4)** gönderilir
  (kareler + aynı zaman çizelgesinin çevrimdışı işlenmiş sesi, ffmpeg ile birleştirilir).
- **Zamanlama:** A2'nin sonunda dilim için ses geçişi (Ejder + Büyücü + Yıldırım + Zincirler) ve
  sesli video aracı; A4'te her canavar çifti kendi sesleriyle; A5 büyü / tuzak sesleri; A6 arayüz
  sesleri; A7 genel karışım ve seviye kontrolü.

## 6. Aşamalar

Her aşama: iş → çekim şeritleri (filmstrip) ve oynanış üzerinden eleştiri / düzeltme turları →
doğrulama → commit + push → bu dosyadaki durum güncellenir.

- **A0 — Envanter ve ölçüm.** 20 kart × bütün olaylar için tablo: mevcut animasyon, zayıf yan,
  ortak bileşen, karta özgü kısım, hedef. Başlangıç ölçümleri: kare süreleri, açılış süresi,
  bellek.
- **A1 — Altyapı.** Sözleşme ekleri (kare süreleri, yeni pozlar), yeni görünüm anahtarı, sakin
  arenanın oyuna alınması, tam sayı kamera, hafif ışık katmanı ayarı.
- **A2 — Dikey dilim (onay kapısı).** Kristal Ejder + Uçurum Büyücüsü yeni stilde ve tam yaşam
  döngüsünde: çağırma (normal + kurbanlı), bekleme, savunma, saldırı, hasar (hafif / ağır,
  fiziksel / büyüsel), ölüm, Ruh Çağrısı ile diriltme, büyücünün büyü / tuzak yok etme efekti,
  ejderhanın giriş portresi. Yanında örnek büyü (Yıldırım Hükmü) ve örnek tuzak (Işık
  Zincirleri). Teslim: oynanabilir adres + kısa gösteri kaydı. **Kullanıcı onayı olmadan
  sonraki aşamaya geçilmez.**
- **A3 — Stil ve hareket rehberi + ölçeklenebilirlik katmanı.** Dilimden çıkarılan kurallar (ışık,
  düzlem planı, malzemeler, gürültü sınırı, hareket karakterleri, süreler, ses, ×3 karşılaştırma
  ölçütleri) ve yüzlerce karta büyüyebilmek için: **gövde tipi kütüphanesi** (ejder, cüppeli büyücü,
  ağır insansı/golem, dört ayaklı, yılan, kuş/uçan, küçük süzülen/peri, bitki, insansı savaşçı —
  her biri bütün pozlarını parametrelerden üretir; yeni canavar = gövde tipi + oranlar + malzeme /
  palet + parçalar + gerekirse özel eklentiler), **malzeme kütüphanesi** (çizim, ölüm efekti, darbe
  efekti ve ses aynı tanımdan beslenir) ve **sunum tarifleri** (kart verisinde saldırı türü, efekt
  ve ses ön ayarı, çağırma / ölüm tarzı; varsayılan sinematik bunlardan kurulur, özel kod yalnız
  ana kartlarda). Kalite kapıları değişmez; aynı gövde tipinden çıkan canavarların silüet ve hareket
  farkı ayrıca ölçülür. Ana kartlar (Ejder, Büyücü gibi) tamamen özel kalır.
- **A4 — Kalan canavarlar, ikişer ikişer (A3 katmanının üzerine; A3 mimarisi §15).** Taş Muhafız
  A3'ün pilotu olarak yapılır. A4.1: ölçeklenme ön adımı (kırpılmış dokular, toplam bellek kapısı) +
  Magma Titanı + Mercan Yılanı; A4.2: Kor Kurdu + Şimşek Kertenkelesi (dört ayaklı tip iki üyesiyle
  birlikte kurulur); A4.3: Gelgit Golemi + Gölge Suikastçı (ağır üçlünün benzerlik denetimi); A4.4:
  Fırtına Atmacası + Işık Perisi; A4.5: Dikenli Pusucu + 12 canavarlık çapraz benzerlik turu. Her çift:
  yeni stil + tam yaşam döngüsü + efektler + sesler; her çift ayrı commit. A4, A3 sonundaki kullanıcı
  onayından sonra başlar.
- **A5 — Kalan büyü ve tuzaklar** (Şifa Pınarı, Ruh Çağrısı, Ejder Kılıcı, Volkan Arenası,
  Ayna Kalkanı, Yer Yarığı) + kart resimleri ve giriş portrelerinin yeni stile geçişi.
- **A6 — Küçük oyun olayları:** çekme, hover, oynama, kapalı koyma / açma, pozisyon, hedef seçme,
  geçersiz hedef, engelleme, atma, kurban, mezarlığa gitme, karıştırma, sıra / aşama, LP,
  zafer / yenilgi; mezarlığı tıklayınca inceleme paneli (yoksa eklenir).
- **A7 — Bütünlük ve çıkış adayı:** sakin zemin + ışıkla genel kontrol, performans, uzun oturum
  testi, demo oyunlar, çıkış kontrol listesi.

## 7. Doğrulama

- Bütün canavar yaşam döngüleri çalışıyor mu; her büyü / tuzak doğru animasyona bağlı mı?
- Geçişlerde poz sıçraması veya ayak kayması var mı; mermi kaynakları doğru uzvu izliyor mu?
- Hasar ile görsel temas eşleşiyor mu; kartlar doğru bölgelere gidiyor mu?
- Gizli kartlar yanlışlıkla açılıyor mu; tekrarlı kullanımda efekt veya kaynak birikiyor mu?
- Hızlandırma ve duraklatma olay sırasını bozuyor mu; ilk çağırma / saldırıda donma var mı?
- Araçlar: deterministik çekim şeritleri (`tools/shot.mjs --film`), senaryo paketleri, demo
  oyunlar, uzun oturum testi, `npm run typecheck`, `npm test`.
- Kare süreleri gerçek tarayıcıda ölçülür. Bu ortamdaki başsız tarayıcı ölçümü kullanıcının
  cihazını tam temsil etmez; 60 FPS doğrulanamıyorsa garanti verilmez.

## 8. Kapsam dışı

Fusion / Extra Deck / oyun dışı alanı / ele veya desteye dönme (sonraki tasarım işi), yeni kart
tasarımı, çevrimiçi oyun, kural değişiklikleri.

**Sonraki iş (A7'den sonra, yeni kart eklemeden önce): veriye dayalı etki sistemi + Fusion.** Bugün
her kart etkisi kural motorunda ve bilgisayar rakipte adıyla yazılmış özel bir durum
(`summonBurn500` gibi). Yüzlerce kart için etkiler yapı taşlarından kurulmalı: tetikleyici → koşul →
hedef → eylem (hasar, iyileştirme, yok etme, özel çağırma, güç değişimi, engelleme, kart çekme…);
bilgisayar rakip de kartın adına değil yapı taşlarına göre karar vermeli. Fusion / Extra Deck de
motor değişikliği gerektirdiği için ikisi birlikte tasarlanır.

## 9. Durum

| Aşama | Durum | Not |
|---|---|---|
| Sabit görsel (stil hedefi) | tamam | `src/still/`, `tools/neon-still.ts` |
| A0 Envanter ve ölçüm | tamam | `docs/v3/A0_ENVANTER.md` + `docs/v3/a0/*.md` |
| A1 Altyapı | tamam | `?look=v3`, sakin arena, tam sayı kamera, kare süreleri + yeni poz türleri, P2 yeniden ışık, ağırlık profilleri, tek gösteri saati, basamaklı ışık; `tools/measure.mjs`, `tools/sheet-hash.ts`; kabul: 2. tur geçti |
| A2 Dikey dilim | tamam | Kristal Ejder + Uçurum Büyücüsü yeni stil ve tam yaşam döngüsü, ortak v3 kitleri, Yıldırım Hükmü, Işık Zincirleri, yeni giriş portreleri, dilim sesleri (`src/audio/v3/`), `tools/clip.mjs`; kabul: 11/11 (madde 1 düzeltme turuyla) |
| A3 Rehber + ölçeklenebilirlik katmanı | tamam | rehber (`docs/v3/REHBER.md`), mimari (`docs/v3/A3_MIMARI.md`), çekirdek (rigkit, malzemeler, `biped/v1`, sunum tarifleri, darbe kiti, araçlar), pilot Taş Muhafız oyunda; kabul özeti `docs/v3/A3_KABUL.md` (bütün kapılar geçti; bilinen açıklar orada) |
| A4 Kalan canavarlar | kısmen, beklemede | A4.1: ölçeklenme ön adımı tamam (kırpılmış atlas, aşamalı boyama, `tools/texmem.mjs`); Magma Titanı ve Mercan Yılanı çizimleri tamam (13 anim, eleştiri + düzeltme, benzerlik kapısı), oyuna henüz bağlanmadı (`src/art/monsters-v3/_magma_titan.ts`, `_coral_serpent.ts`). 23 Ekim kullanıcı kararı: kalan 7 canavarın yeniden çizimi bekletiliyor, A5 ve A6 öne alındı |
| A5 Büyü / tuzak / kart resimleri | sürüyor | plan `docs/v3/A5_PLAN.md`. Tamam: ortak kit, motifler, 23 ses tarifi, Volkan Arenası, v3 kart çerçevesi. Sürüyor: Ayna, Yarık, Kılıç, Şifa, Ruh Çağrısı + ses geçişi. 24 Ekim kullanıcı isteği: kart resimleri daha kaliteli olacak; yeni tarz (88×68 büyük + elle düzeltilmiş 44×34 küçük resim, `docs/v3/KART_RESIMLERI.md`) üç denemeyle sınanıyor, onaydan sonra bütün kartlara |
| A6 Küçük olaylar | sürüyor | plan `docs/v3/A6_PLAN.md`. Tamam: HUD kabuğu, tur levhası, v3 kart nesnesi + arka yüz, el + inceleme paneli (kontrol noktası A56.K kullanıcıya gitti, yön onaylandı). Sürüyor: açılış, LP sayacı, hedefleme, tuzak istemi, perde, zafer; elin hafif yayı geri geliyor (24 Ekim kullanıcı kararı). Sırada: çekme, koyma, kurban, mezarlık paneli, arayüz sesleri |
| A7 Bütünlük / çıkış adayı | bekliyor | 24 Ekim kullanıcı kararı: eldeki işler bitince en kısa sürede bir ön sürüm (pre-release) hazırlanacak; kart sayısı 20'den 60–80'e çıkmalı (plan sonra, kullanıcıyla); token bütçesi dikkatli kullanılacak |

## Not: Düellocu karakterleri (kullanıcı isteği, plana alındı)

- 4 oyuncu (düellocu) karakteri yapılacak; her birinin kendine özel animasyonları olacak.
- Örnek: "Kara Büyücü" tipi bir düellocu canavar çağırırken, tuzak tetiklerken, büyü oynarken, hasar alırken ve kazanırken kendi kişisel hareketini yapar.
- Kapsam (konuşulacak): karakter görünüşü (sahada/HUD'da nerede durur), çağırma / büyü / tuzak / hasar / zafer / yenilgi animasyonları, ses, deste seçimiyle eşleşme.
- Kurallar aynı: kamera değişmez, 640×360 piksel dili, palet, özgün tasarım, v1 görünümü aynı kalır.
- Sıra: arena/saha yeniden tasarımıyla birlikte konuşulacak; şimdilik yalnızca not.
