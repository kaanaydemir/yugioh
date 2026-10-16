# A0 — Büyü ve tuzak envanteri

Yıldırım Hükmü (`judgment_bolt`), Şifa Pınarı (`healing_spring`), Ruh Çağrısı (`soul_recall`),
Ejder Kılıcı (`dragon_blade`), Volkan Arenası (`volcano_arena`), Ayna Kalkanı (`mirror_barrier`),
Işık Zincirleri (`chains_of_light`), Yer Yarığı (`chasm_trap`).

Aşama: **A0, envanter ve ölçüm**. Kaynak kodda değişiklik yapılmadı. Bu belge sekiz büyü / tuzak
kartının bugünkü sunumunu (elden ve kapalı karodan açılış, ortak açılış kitleri, karta özgü etki,
hedef tepkileri, kartın gittiği yer, stat değişimi, karar / "Geç" işareti, kart resmi) ölçülmüş
süreler ve çekim kanıtlarıyla listeler. Ölçütler: `docs/ANIMASYON_PLANI.md` §4 hareket kuralları ve
§5 süre bütçesi (büyü 1,2–2,0 sn, tuzak 1,5–2,0 sn, diriltme ~2,0 sn, LP değişimi ~0,4 sn).

---

## 0. Yöntem ve kanıt dosyaları

**Süre ölçümü.** Kendi ölçüm betiğim (`measure.mjs`, scratchpad'de; kaynak ağacına girmedi) her
senaryoyu `?dev=duel&s=<anahtar>&test=1` ile açtı, `src/cinematics/_core/registry.ts`'e bir
`registerObserver` gözlemcisi taktı (her olayın başladığı an), oyun saatini dondurup 1/60 sn
adımlarla ilerletti ve `__neon.duel.busy()` 400 ms boyunca boşa düşene kadar saydı. Değerler
**oyun saati, ms**, normal hız (1×), varsayılan arena (v1). "Toplam" = denetleyicinin meşgul kaldığı
süre (kapanış beklemeleri dahil); görsel bitiş filmlerden okundu. Kancanın tükettiği olaylar
(`target`, `toGraveyard`, çoğu `statChange`) gözlemciye düşmüyor; temas anları filmlerden okundu.
41 senaryonun hiçbirinde işleyici hatası ya da bekçi (watchdog) zaman aşımı yok
(`__neon.duel.errors()` boş).

**Ölçülemeyen / güvenilmeyen:** gerçek zamanlı kare süresi. Makinede 4 CPU var, ölçüm sırasında
başka ajanlar da çekim yapıyordu (yük ortalaması 10–18) ve tarayıcı yazılım çizici (swiftshader)
kullanıyor. Aynı senaryoda tekrar eden ağır kare pencereleri yine de not edildi (§4.5), ama sayılar
gerçek cihazı temsil etmez.

**Filmler** (hepsi `shots/v3/a0/spells-traps/`, oyun saati damgalı):

| Dosya | İçerik |
|---|---|
| `spBolt.png` | Yıldırım Hükmü elden, 0–2,3 sn tam ekran |
| `spBolt-strike-zoom.png` | aynı, 1,00–1,90 sn darbe, 2× yakın |
| `spBoltSet-opening.png` | kapalı karodan açılış, 0–0,88 sn |
| `spBoltFaceDown.png` | kapalı savunmadaki canavara yıldırım |
| `spBoltAce.png` | kuşanmalı Kristal Ejder'e yıldırım (kılıç da kırılır) |
| `spBolt-v2.png` | aynı an `?arena=v2` (ışık katmanı açık) |
| `spHeal.png`, `spHeal-fountain-zoom.png` | Şifa Pınarı genel / pınar 2× |
| `spRecall.png` | Ruh Çağrısı (Kor Kurdu, kendi mezarlığı), 0,6–3,1 sn |
| `cmp-normalSummon-wolf.png` | karşılaştırma: Kor Kurdu'nun elden normal çağırması |
| `spRecallEnemy.png` | rakip mezarlığından Magma Titanı + yakma etkisi |
| `spBlade.png`, `spBlade-impact-zoom.png`, `spBlade-after-zoom.png` | Ejder Kılıcı genel / darbe 2× / kalıcı durum |
| `spBladeBreak.png` | kuşanma kartının yok edilmesi (Uçurum Büyücüsü etkisi), aura patlaması |
| `spVolcano.png`, `spVolcano-stats-zoom.png` | Volkan Arenası genel / stat değişimleri 2× |
| `tbMirror.png`, `tbMirror-reflect-zoom.png` | Ayna Kalkanı genel / yansıma ve ölümler 2× |
| `tbMirrorP2.png`, `tbMirrorDirect.png` | P2 aynalı sürüm / doğrudan saldırıya karşı (tek hedef, as) |
| `tbChains.png`, `tbChains-bind-zoom.png` | Işık Zincirleri genel / bağlama 2× |
| `tbChasm.png`, `tbChasm-fall-zoom.png` | Yer Yarığı genel / düşüş 2× |
| `tbDecision-prompt.png`, `tbDecision-prompt-4s.png` | tuzak istemi 1,5 sn ve 4 sn |
| `tbDecline-zoom.png` | karar işareti + "Geç" |
| `cards-art.png`, `cards-big-p3.png` | 20 kart resmi 2× / büyü-tuzak yüzleri 2× |

Ham ölçüm verisi: `/tmp/claude-0/-home-user-yugioh/ddad49c9-4c8a-50de-b30a-2b20a3666243/scratchpad/v3/a0/spells-traps/m-all.json`
(olay zaman çizelgeleri) ve `.../spells-traps/diag.json` (ağır kare pencereleri).

---

## 1. Ölçüm özeti

| Senaryo | Zaman çizelgesi (oyun ms) | Toplam | Bütçe (§5) |
|---|---|---|---|
| `spBolt` (elden) | activate 17 · yıldırım teması = destroy 1133 · kart mezarlığa ~1800–2100 | 2383 | büyü ≤ 2000 |
| `spBoltSet` (kapalı karodan) | destroy 1150 | 2400 | |
| `spBoltFaceDown` | destroy 1133 | 2433 | |
| `spBoltAce` (kuşanmalı as) | destroy ejder 1133 · destroy kılıç 2367 | 3283 | |
| `spHeal` / `spHealSet` | lpGain 1633 / 1700 · LP akışı ~1700–2300 | 2433 / 2500 | LP ~400 |
| `spRecall` (Kor Kurdu) | summon (imza girişi başlar) 1833 | 3083 | diriltme ~2000 |
| `spRecallSet` (Kristal Ejder) | summon 1867 | 3033 | |
| `spRecallEnemy` (Magma Titanı) | summon 1833 · etki 3050 · hasar 4450 | 5083 | |
| `spBlade` / `spBladeSet` | equip 1050 / 1083 · kılıç teması = statChange 1983 / 2017 | 2433 / 2467 | büyü ≤ 2000 |
| `spVolcano` / `spVolcanoReplace` | fieldSpell 1117 / 1333 | 2283 / 2483 | |
| `tbMirror` | ilan 17 · karar 567 · activate 883 · destroy 2933 + 2967 · görsel bitiş ~4350 | 5650 (tuzak ≈ 3,5 sn) | tuzak ≤ 2000 |
| `tbChains` | activate 883 · attackNegated 2850 · phaseChange 3800 · tur pankartı 3840–4640 | 5783 (tuzak ≈ 2,9 sn) | |
| `tbChasm` | summon 17 · karar 1483 · activate 1800 · destroy 2600 · görsel bitiş ~4900 | 5817 (tuzak ≈ 3,1 sn) | |
| `tbChasmBig` | kurbanlı summon 1083 · karar 3650 · activate 3967 · destroy 4767 | 7983 | |
| `tbDecline` | karar 567 · responseDeclined 883 · battle 1200 | "Geç" ≈ 317 | |
| `tbDecision` | karar 567 → istem (insan beklemesi) | işaret 300 | |

Karşılaştırma: Kor Kurdu normal çağırma 1550, Gölge Suikastçı 1450.

**Sonuç:** beş büyünün hepsi 2,3–2,5 sn (bütçeyi 0,3–0,5 sn aşıyor), diriltme 3,0–5,1 sn, tuzaklar
2,9–3,5 sn (bütçenin ~1,5–2 katı).

---

## 2. Ortak bileşenler

### A. Ortak büyü açılışı — elden / kapalı karodan

- **Olay / kart:** `activate` (kind `spell`), beş büyünün hepsi.
- **Mevcut animasyon (dosya):** `src/cinematics/spells/_kit.ts` `spellOpening()`. Elden: kart 50 ms
  aşağı çöker (hazırlık), turkuaz izle 230 ms'de tahtanın ortasına uçar, 2× büyür, ezilerek iner;
  arkasında rün mührü (halka + altıgen yıldız + yörüngede 8 rün) kendini çizer, ad plakası
  ("YILDIRIM HÜKMÜ") harf harf yazılır, kıvılcımlar karta akar, kart ~300 ms süzülür; düellocu
  `command` oynar, kamera 1.03'e iter. Kapalı karodan: karo parlar, ince turkuaz sütun fışkırır,
  kart karo üstünde dikilip açılır (180 ms), sonra ortaya uçar (bekleme 110 ms kısa). Bırakma:
  kart şişip beyazlar, dikey bir ışık şeridine, sonra noktaya çöker; yıldız parlaması, enerji küresi
  (`energyStreak`) hedefe uçar.
- **Ölçülen süre:** her iki yolda bırakma (küre kalkışı) ≈ 800 ms (`spBoltSet-opening.png` #8–#10:
  640 ms beyaz kart, 720 ms şerit, 800 ms mühür çöküşü). Büyü toplamının ~%33'ü.
- **Zayıf / eksik (kanıt):** beş büyüde birebir aynı 0,8 sn (tekdüze; "her aksiyon karta özel"
  kuralına ters). 2× kart tahtanın tam ortasını kapatıyor; hedef çoğu zaman o bölgede. Uçuş
  sırasında ölçek 1→2 arası kesirli (`spBoltSet-opening.png` #3 240 ms), `punch` ezilmesi ve
  bırakmadaki `scaleX 0.1` şeridi de kesirli; kamera itmesi 1.03 kesirli. Düellocunun "komut"
  pozu kartın kalkışıyla eşlenmiyor (hazırlık → bırakma okunmuyor). Elden ile kapalı arasındaki fark
  iyi (sütun + dikilme), ama ikisi de aynı merkez gösterisine bağlanıyor.
- **Ortak bileşen:** `spellOpening`, `makeSeal`, `namePlate`, `starFlare`, `energyStreak`,
  `fx.takeHandCard`, `TileCard.standUp`, `tileFlash`, `floorRing`, `sparkleBurst`, `fx.dim`.
- **Karta özgü kısım:** yalnızca `hold` süresi ve `onHold` (Yıldırım Hükmü fırtınayı bekleme
  sırasında başlatır), bırakma yolu (`line` / `arc` / `dive`) ve küre rengi.
- **v3 hedefi:** açılış ≤ 0,45 sn; kart kimliği okunur kalsın (plaka + 2× tam sayı ölçek tek
  karede, ara ölçek yok), ama gösteri yeri hedefi kapatmasın (oyuncunun kendi tarafına yakın).
  Bırakma karta özgü olsun: yıldırımda kart buluta yükselir, pınarda zemine gömülür, diriltmede
  mezarlığa dalar, kılıçta kılıcın kendisine dönüşür, alanda doğrudan alan bölgesine çakılır.
  Düellocu kısa bir büyü pozu (kol kalkar → kartla aynı karede bırakır). Kamera: kesirli itme
  yok, gerekirse yalnızca kaydırma.
- **Öncelik:** yüksek (her büyüyü etkiler; A2'de Yıldırım Hükmü ile birlikte kurulur).

### B. Ortak tuzak açılışı ve çıkışı

- **Olay / kart:** `activate` (kind `trap`), üç tuzağın hepsi; tuzağın kendi `toGraveyard`'ı.
- **Mevcut animasyon (dosya):** `src/cinematics/traps/_opening.ts` `trapOpening()` /
  `trapExit()`. Kart bastırılıp dik kalkar (250 ms), +60 ms macenta patlama (`trapBurst`: beyaz
  artı parlaması, anime çizgileri, iki zemin halkası, enerji sütunu), tam ekran macenta flaş
  (90 ms, %22), 2 px sarsıntı, 50 ms donma, ×0,35 ağır çekim, kartta macenta aura, sonra tam genişlik
  "TUZAK!" pankartı. Çıkış: ayakta kart beyaz parlar, çözülür (420 ms), küçük kopyası mezarlığa yay
  çizer.
- **Ölçülen süre:** activate 883 → set piece başlangıcı ~1950–2100 (ayna kubbesi 2100, zincir
  lunge 1950); yani açılış ≈ 1,1 sn. Pankart: beyaz bant 1280–1350, harfler 1440–1950
  (`tbChains.png` #8–#12, `tbMirror.png` #9–#13). Çıkış 0,5–0,6 sn.
- **Zayıf / eksik (kanıt):** açılış tek başına tuzak bütçesinin (1,5–2,0) yarısından fazlası.
  Pankart ekranın ortasını ~0,6 sn tamamen kapatıyor, girişinde tam genişlik beyaz bant var.
  Aşamanın tamamı aynı: üç tuzak arasında açılışta fark yok. `trapExit` ana sonuçla üst üste
  biniyor (Ayna Kalkanı'nda ölümler sürerken kart yanıyor, `tbMirror-reflect-zoom.png`
  #9–#15 3360–3900; `tbMirrorDirect.png` #6–#11): tek odak kuralına aykırı.
- **Ortak bileşen:** `trapOpening`, `trapBurst`, `cardAura`, `trapExit`, `banner('TUZAK!')`,
  `stopTime`, `speed.slowMo`, `arenaDim`, `battle/_kit.takeAttack` (saldırıyı askıda tutma).
- **Karta özgü kısım:** yalnızca kamera odak noktası (`focus`).
- **v3 hedefi:** açılış ≤ 0,6 sn: bastırma (2 kare) → kalkış → aşma → oturma; patlama + kısa
  hit-stop; ağır çekim kısa. "TUZAK!" pankartı ya kartın üstünde yerel ve küçük, ya da tam genişlik
  ama ≤ 0,35 sn ve hedef şeridini kapatmadan. Karta özgü bir açılış ayrıntısı (zincir şıkırtısı
  karttan, ayna yüzeyi parlaması, zemin titremesi). Çıkış ana sonuçtan sonra, sırayla.
- **Öncelik:** yüksek (A2'de Işık Zincirleri ile kurulur).

### C. Karar işareti ve tuzak istemi (`decision`)

- **Olay / kart:** `decision` (`pending.kind === 'trapResponse'`).
- **Mevcut animasyon (dosya):** `src/cinematics/battle/declare.ts` `tb:decision` (savunanın
  kapalı kartları macenta nabız atar, B/T sırasında 3 halka dalgası, `lockOn` sesi, 300 ms bekleme);
  ardından `src/view/Prompt.ts` `trapResponse()` istemi ("TUZAK FIRSATI", "Oyuncu 2: Tuzak kartı
  açmak ister misin?", kartlar, AÇ / GEÇ).
- **Ölçülen süre:** işaret 300 ms (567 → 883). İstemde kart yüzleri 1,5 sn'de hâlâ kapalı, 4 sn'de
  açık ve açıklama yazılmış (`tbDecision-prompt.png` / `tbDecision-prompt-4s.png`).
- **Zayıf / eksik (kanıt):** istem tahtayı neredeyse tamamen karartıyor: kararı doğuran saldıran,
  hedef ve ok görünmüyor (`tbDecision-prompt.png`). Kartların yüze dönmesi ve açıklamanın yazılması
  yavaş; oyuncu ilk saniyede yalnızca kart arkası ve ad görüyor. Kapalı kart nabzı iyi ama küçük
  (`tbDecline-zoom.png` 590–800 ms).
- **Ortak bileşen:** `setCardPulse`, `floorRing`, `Prompt` paneli, `CardSprite` (kapalı → açık).
- **Karta özgü kısım:** yok (seçenek kartları ve açıklama metni).
- **v3 hedefi:** istem tahtayı hafif karartsın; saldıran, hedef ve ok vurgulu kalsın (karar bağlamı
  okunur). Kart yüzleri ≤ 0,3 sn'de açılsın. İşaret ≤ 0,3 sn kalsın.
- **Öncelik:** orta (A6 "küçük oyun olayları" kapsamında).

### D. "Geç" (`responseDeclined`)

- **Olay / kart:** `responseDeclined`.
- **Mevcut animasyon (dosya):** `declare.ts` `tb:responseDeclined`: nabız sönümlenir
  (`settle`), B/T sırasının üstünde küçük gri "Geç" yazısı (`md`, mist), `uiBack` sesi.
- **Ölçülen süre:** 317 ms (883 → battle 1200).
- **Zayıf / eksik (kanıt):** yazı savunan canavarın başının yanında çıkıyor, ona aitmiş gibi
  okunabiliyor (`tbDecline-zoom.png` #6–#7 940–1010 ms). Kartların "kapandı" hali zayıf.
- **Ortak bileşen:** `pixelText`, `setCardPulse.settle`.
- **Karta özgü kısım:** yok.
- **v3 hedefi:** kısa kalsın (≤ 0,3 sn). Kapalı kartlar görünür biçimde söner (macenta → gece),
  "Geç" B/T sırasının hizasında ve oyuncu renginde.
- **Öncelik:** düşük.

---

## 3. Kartlar

### E. Yıldırım Hükmü (`judgment_bolt`)

- **Olay / kart:** `activate` + `target` + `destroy` (kancalar `activate`, `destroys`) +
  `toGraveyard{from:'resolved'}`.
- **Mevcut animasyon (dosya):** `src/cinematics/spells/judgment_bolt.ts` +
  `src/vfx/setpieces.ts` `stormStrike()`. Açılışın son 200 ms'sinde fırtına başlar: sahne kararır,
  hedefin üstünde bulut girdabı, kamera hedefe 1.06 yakınlaşır; küre düz çizgide bulut gözüne
  uçar; +520 kilit (hedef turkuaz dolgu + 1 px titreme, `brace()`); darbe: dev zikzak yıldırım,
  85 ms donma, **tam ekran beyaz flaş 220 ms %78**, 5 px / 380 ms sarsıntı; kurban `electrocute()`
  (beyaz ↔ röntgen siluet titremesi, gövdede ark çizgileri) sonra kendi piksellerine dağılır
  (`shatter`), karo çözülür; harcanan kart fırtına gözünden mezarlığa düşer. Kapalı canavar: karo
  açılır ve yanarak çözülür (`spBoltFaceDown.png`). Kuşanmalı hedefte kılıç da altın kırıklarla
  kırılır (`spBoltAce.png`).
- **Ölçülen süre:** temas (destroy) 1133, toplam 2383 (kapalı karodan 2400, kapalı hedef 2433,
  kuşanmalı as 3283).
- **Zayıf / eksik (kanıt):**
  - Tam ekran beyazlama arayüz dahil (`spBolt.png` #12 1200 ms; `spBolt-strike-zoom.png` #2–#4
    1120–1240; v2'de de aynı, `spBolt-v2.png` #5) — "aynı anda bütün ekran parlamaz" kuralına aykırı.
  - Kalın beyaz yıldırım kurbanı ~0,45 sn tamamen kapatıyor (`spBolt-strike-zoom.png` #2–#10
    1120–1600); ölüm parçalanması yıldırım kalıntısının arkasında kalıyor.
  - Kurban tepkisi yalnızca bütün sprite'ı boyama (turkuaz dolgu, beyaz / röntgen titremesi) ve 1 px
    yatay titreme; baş / gövde / uzuvların temas sırasıyla tepkisi yok.
  - `destroys` kancası canavarın kendi ölümünü bastırıyor: Kristal Ejder kristal çatlağı ve ışık
    kaybı yerine genel elektrik + piksel dağılmasıyla ölüyor (`spBoltAce.png` #5–#9 1400–1800);
    §4 "ölüm karaktere özgüdür" kuralına aykırı.
  - Kuşanmalı hedefte ejder kartı, kılıç kartı ve büyü kartı aynı anda (2,0–2,3 sn) mezarlıklara
    uçuyor; okunmuyor (`spBoltAce.png` #10–#13).
  - Süre bütçeyi ~0,4 sn aşıyor.
- **Ortak bileşen:** büyü açılışı (A), `stormStrike`, `shatter`, `sendResolved`, ışık katmanı
  (`lightDim`, `lightPool`, `lightBeam`, `lightFlash`; v1'de etkisiz).
- **Karta özgü kısım:** fırtına girdabı, kilit, zikzak yıldırım, elektrik çarpması ölümü, yanık karo.
- **v3 hedefi (A2 dilimi):** kaynak → yol → temas → yok oluş okunur: bulut toplanır (≤ 0,4 sn) →
  kilit → yıldırım (tam parlaklık ≤ 120 ms, sonra ince ardıl ışık) → temas karesinde yerel beyaz ışık
  (ışık katmanı, yalnız hedef şeridi; arayüz sabit) + 60–100 ms hit-stop → kurbanın parça bazlı
  darbe pozu (baş geri, uzuvlar açılır) → **canavarın kendi ölümü**, üstüne elektrik tonu
  (`destroys` kancası ölümü sahiplenmek yerine canavarın ölümüne bir ipucu verir). Kart mezarlığa
  ölümden sonra. Toplam ≤ 2,0 sn.
- **Öncelik:** yüksek.

### F. Şifa Pınarı (`healing_spring`)

- **Olay / kart:** `activate` + `lpGain` + `toGraveyard{resolved}`.
- **Mevcut animasyon (dosya):** `src/cinematics/spells/healing_spring.ts`, `_fountain.ts` →
  `setpieces.healingFountain()`. Bekleme 190 ms; küre yay çizip oyuncunun B/T bölgesine (elden: orta
  bölge, kapalı: kendi karosu) düşer; dalgalar, turkuaz gayzer fışkırır (dither'lı akış + damla
  çanı), parlayan damlalar LP paneline yay çizer; ilk damlada panel yeşil parlar, "+1000" çıkar, LP
  akar; düellocu `victory` oynayıp `idle`'a döner.
- **Ölçülen süre:** pınar fışkırması ~950–1100, damlalar 1300–1650, lpGain 1633 (kapalı 1700),
  LP akışı 1800 → 2800 ≈ 1700–2300 (~0,6 sn), toplam 2433 / 2500.
- **Zayıf / eksik (kanıt):** pınar B/T orta bölgesinde, yanındaki canavarın (Gelgit Golemi)
  üstüne biniyor (`spHeal-fountain-zoom.png` #2–#10). Damlalar 1–2 px, 1×'te zor okunuyor
  (`spHeal.png` #14–#16). Gayzerin şekli 1230–1650 arasında neredeyse sabit. LP akışı 0,6 sn
  (bütçe ~0,4). Düellocu tepkisi genel `victory` pozu.
- **Ortak bileşen:** büyü açılışı (A), `healingFountain`, `battle/damage.ts` `lpGain`, `sendResolved`.
- **Karta özgü kısım:** gayzer, damla yayları, düellocu sevinci.
- **v3 hedefi:** pınar düellocunun / LP panelinin yanında, canavar karolarından uzakta; "kontrollü
  akış": 3–4 okunur (2–3 px) damla ya da tek akış şeridi panele bağlanır, "+1000" ilk damlanın
  temasında panelde, LP akışı ~0,4 sn. Düellocuya kendi iyileşme pozu. Toplam ≤ 1,6 sn.
- **Öncelik:** orta (A5).

### G. Ruh Çağrısı (`soul_recall`) — diriltme

- **Olay / kart:** `activate` + `target{graveyardUid}` + `summon{from:'graveyard'}` +
  `toGraveyard{resolved}` (+ çağırma etkileri, örn. Magma Titanı'nın yakması).
- **Mevcut animasyon (dosya):** `src/cinematics/spells/soul_recall.ts`. Küre seçilen mezarlığa
  dalar; mezarlık cyan açılır (halka, ruh alevleri), yığın bir kart azalır; canavarın yarı saydam
  cyan hayaleti (`ghostTexture`) yığından yükselir, yankı izleriyle yay çizerek hedef karoya süzülür
  (v1 320 ms); cyan sütun hayaleti yutar (`pillarHandoff`) ve sonra **çağırma olayı canavarın kendi
  imza girişiyle oynatılır**: `ctx.play(si, { noCard: true, ghost: true })` (summon-a / summon-b
  kancaları yalnızca kart uçuşunu atlar ve karo flaşını cyan yapar). `&recall=generic` eski genel
  cyan yeniden belirmeyi açar.
- **Ölçülen süre:** summon olayı 1833'te başlar; toplam 3083 (Kristal Ejder 3033); Magma Titanı
  yakmasıyla 5083.
- **Zayıf / eksik (kanıt):**
  - **Diriltme normal çağırmayla üst üste oynatılıyor.** `spRecall.png` #13–#23 (2030–3130 ms) ile
    `cmp-normalSummon-wolf.png` #3–#11 (330–1210 ms) aynı: ateş halkası, kurdun koşarak gelişi,
    beliriş. §4 "Diriltme normal çağırmanın aynısı değildir ve onunla üst üste oynatılmaz"
    kuralının doğrudan ihlali.
  - Süreklilik kopuyor: hayalet karonun üstünde erir, sonra kurt başka yerden koşarak gelir
    (`spRecall.png` #9–#15).
  - Hayalet bütün sprite'ın saydam kopyası olarak kayıyor; "yeniden birleşme" (parçaların toplanması)
    yok.
  - Harcanan kart sütun yükselirken mezarlığa uçuyor: ikinci odak (`spRecallEnemy.png` #2 2100 ms).
  - 3,0–5,1 sn (bütçe ~2,0).
- **Ortak bileşen:** büyü açılışı (A), `createMagicCircle`, `createPillar`, `shockwave`,
  `ghostTexture`, `materialize` (genel mod), summon-a / summon-b imza girişleri.
- **Karta özgü kısım:** mezarlık açılışı, ruh yükselişi, süzülme, cyan sütun.
- **v3 hedefi (A2 dilimi):** mezarlık → saha bağı tek akış: yığından gerçek kart kalkar, ruha
  dönüşür, karoya süzülür; karoda canavar **ölümünün tersine** yeniden birleşir (kristal ejderde
  kırıklar geri toplanır, büyücüde cüppe karanlıktan dolar) ve yeni bir "diriltme" pozuyla
  (sözleşmeye eklenecek isteğe bağlı poz) uyanır; normal imza girişi oynatılmaz. Harcanan kart
  diriltme bittikten sonra gider. ~2,0 sn; çağırma etkileri ayrı ve kısa.
- **Öncelik:** yüksek.

### H. Ejder Kılıcı (`dragon_blade`) — kuşanma, sahada kalır

- **Olay / kart:** `activate` + `target` + `equip` + `statChange` (+700); yok olunca
  `destroy{location:'spellTrap'}` + kural gereği ATK geri dönüşü.
- **Mevcut animasyon (dosya):** `src/cinematics/spells/dragon_blade.ts` `forge()`. Açılıştan sonra
  kart kendi B/T bölgesine çakılır (yüzü açık kalır); karttan 8 altın rün yay çizerek canavarın
  başı üstündeki altın halkaya akar, omurga olur; kılıç (`set:sword`, tam sayı 1× / 2×) yukarıdan
  aşağı beyaz ışıkla çizilir, altına soğur, 1,5 tur dönerek yükselir, asılır (uç parıltısı) ve
  canavara **saplanır**: 70 ms donma, canavar beyaz → altın siluet, altın halka, kıvılcım, 2 px
  sarsıntı; ATK rozeti yeşil akar; kılıç gövdeye batarak ışık sütununda kaybolur; kalıcı altın aura
  (`goldAura`). Yok olma: kart altın kırılır, aura patlar (`burstAura`, gözlemci ile).
- **Ölçülen süre:** equip 1050, kılıç teması 1983, toplam 2433; sayılar 1900 → 2600 ~1,0 sn akar,
  "+700" ~3200'de (`spBlade-after-zoom.png` #0). Kırılma (`spBladeBreak.png`): büyücü dalı
  5060–6180 (1,1 sn), kırılma 6340, ATK geri dönüşü 6820.
- **Zayıf / eksik (kanıt):**
  - Kılıç canavarı başından / gövdesinden deliyor: güçlendirme değil saldırı gibi okunuyor
    (`spBlade-impact-zoom.png` #0–#2). "Silahın bedene bağlanması" yok: tutma noktası (el / pençe)
    yok.
  - Canavar tepkisi yalnızca siluet boyama (beyaz → altın), poz değişmiyor (güç toplama / ağırlık
    aktarımı yok).
  - Kalıcı bağ zayıf: ayakta soluk noktalı altın halka + rozet (`spBlade-after-zoom.png` #1);
    kuşanma kartı ile canavar arasında görsel bağ yok.
  - Sayı akışı uzun; "+700" farkı temastan ~1,2 sn sonra.
  - Rünlerin halkaya gelişi + çizim + dönüş + asılma ≈ 0,9 sn (darbe öncesi uzun).
- **Ortak bileşen:** büyü açılışı (A) + `op.land()`, `fx.slamToZone`, `goldAura`, `addGlow`,
  `freeze`, `flow/stats.ts` statChange (rozet + `statPop`).
- **Karta özgü kısım:** rün dövme, kılıç çizimi / dönüşü / saplanması, altın aura, aura patlaması.
- **v3 hedefi:** kart kılıca dönüşür, canavar onu **yakalar / kuşanır** (yeni isteğe bağlı nokta,
  ör. `grip`; ejderde ağız / pençe): hazırlık çömelmesi → kalkış → kılıç bağlanır → kısa güç pozu;
  "+700" bağlanma karesinde rozetin yanında, rozet ~0,4 sn akar. Kalıcı göstergeler: rozette küçük
  kılıç işareti, bekleme sırasında hafif altın ışık havuzu (ışık katmanı), kart ile canavar arasında
  üzerine gelince bağ çizgisi. Kırılmada kılıç canavardan kopar. ≤ 2,0 sn.
- **Öncelik:** orta (A5).

### I. Volkan Arenası (`volcano_arena`) — alan büyüsü, sahada kalır

- **Olay / kart:** `activate` + (varsa eski alanın `destroy` + `fieldSpell{active:false}`) +
  `fieldSpell{active:true}` + her etkilenen canavar için `statChange`; ayrılınca ters yön.
- **Mevcut animasyon (dosya):** `src/cinematics/spells/volcano_arena.ts`,
  `src/view/BoardView.ts` `setTheme('volcano')`, `setpieces.setVolcanoAmbience`,
  `src/duel/auras.ts` (`flameAura`, `steamAura`). Kart alan bölgesine çakılır; patlama (beyaz-sıcak
  karo, ateş patlaması, **tam ekran ateş flaşı 110 ms %28**, 1.05 itme); lav çatlakları karo
  aralarında yayılır, gökyüzü kor kırmızısı olur, kül / kor düşer, **2 px / 1150 ms sarsıntı**; lav
  cephesi her canavara ulaşınca ATEŞ canavar alevlenir (ateş patlaması, turuncu parlama, saldırıdaysa
  `roar`, alev aurası, yeşil +500), SU canavar buharlaşır (buhar, gri parlama, buhar aurası, kırmızı
  −300); rozetler akar. Değiştirme: ateş-turkuaz ark eski alan kartını vurur, yanar. Soğuma: ters akış.
- **Ölçülen süre:** fieldSpell 1117, cephe 1200–2100, toplam 2283 (değiştirme 2483).
- **Zayıf / eksik (kanıt):**
  - Beş canavarda aynı anda stat değişimi: "+500" / "−300" sayıları 1,4–2,2 sn boyunca yan yana ve
    üst üste duruyor, hangisinin hangi canavara ait olduğu karışıyor (`spVolcano-stats-zoom.png`
    #2–#7: golemin −300'ü kurdun başı hizasında).
  - Bütün gökyüzü ve arka plan düz kırmızıya dönüyor (`spVolcano.png` #18–#23); "kontrollü zemin
    dönüşümü" yerine ekran boyu ton değişimi. Sakin arena hedefinde (`src/still/`) böyle bir tam
    ekran renk yok.
  - Tepkiler bütün sprite parlaması (turuncu / beyaz siluet); SU canavarın "−300" tepkisi zayıf
    (geri çekilme / küçülme pozu yok).
  - Ağır kare penceresi: tema geçişinde (1583–2483 oyun ms) her kare medyandan 20–40 kat yavaş
    (§4.5; yük altında ölçüldü).
- **Ortak bileşen:** büyü açılışı (A) + `op.land()`, `BoardView.setTheme`, `explosion`,
  `damageNumber`, `MonsterUnit.setStats`, auralar.
- **Karta özgü kısım:** lav ağı, kor gökyüzü, ateş / buhar tepkileri, eski alanı vuran ark.
- **v3 hedefi:** sakin arenada kontrollü dönüşüm: lav dikişleri karo birleşimlerinde 2–3 ton
  bandıyla sürünür, ışık katmanı zemine sıcak havuzlar düşer, gökyüzü yalnızca hafif ısınır.
  Stat tepkileri okunur sırayla (mesafe ya da soldan sağa, ≥ 150 ms aralık), her sayı kendi
  rozetinin yanında, ≤ 0,5 sn görünür. ATEŞ: alev + kükreme pozu; SU: tıslama + parça bazlı
  büzülme pozu. Lav kareleri açılışta üretilir (her kare yeniden boyama yok). ≤ 2,0 sn.
- **Öncelik:** orta (A5).

### J. Ayna Kalkanı (`mirror_barrier`) — çok hedef

- **Olay / kart:** `activate` (saldırı ilanına yanıt) + rakibin saldırı pozisyonundaki her canavar
  için `destroy` + `toGraveyard` + tuzağın `toGraveyard`.
- **Mevcut animasyon (dosya):** `src/cinematics/traps/mirror_barrier.ts`,
  `src/cinematics/traps/_mirror.ts` `mirrorDomeTB()`. Ortak açılış (B), savunanın canavar sırası
  üstünde altıgen hücreli macenta ayna kubbesi hücre hücre belirir; ilan eden saldıran kendi
  `attack` karesinde 8 px öne atılır, ağzından element renginde akış kubbeye çarpar (hit-stop,
  altıgen dalga, kubbe beyaz parlar, sahne mor kararır); kubbe her hedef için bir yansıyan ışın
  atar, her temasta `combat.impact` ve o canavarın kendi ölümü; savunmadakiler korunur; kubbe
  altıgen kırıklara ayrılır, tuzak çıkar.
- **Ölçülen süre:** activate 883, kubbe 2100, saldırı teması ~2550, kubbe flaşı 2730, ışınlar
  2820–2950, destroy 2933 ve 2967, ölümler 3000–3900, görsel bitiş ~4350; tuzak ≈ 3,5 sn.
- **Zayıf / eksik (kanıt):**
  - **Hedef sırası okunmuyor:** iki öldürme arası 34 ms; ışınlar neredeyse aynı karede, iki ölüm
    aynı anda ve üst üste (kurt titanın arkasında) oynuyor (`tbMirror-reflect-zoom.png` #3–#15,
    `tbMirrorP2.png` #4–#11).
  - Tuzak çıkışı ölümlerle aynı anda (iki odak).
  - Kubbe çok büyük: savunanı, tuzak kartını ve tahtanın yarısını kapatıyor; ilk kubbe parlamasında
    ekranın tamamı morlaşıyor (`tbMirror.png` #18 2700 ms, `tbMirrorP2.png` #3).
  - Saldıranın öne atılması bütün sprite kaydırması (8 px) + saldırı karesi.
  - Korunan savunma canavarına "kurtuldu" işareti yok.
- **Ortak bileşen:** tuzak açılışı / çıkışı (B), `takeAttack`, `afterimages`, `combat.impact`,
  canavarların `destroyed` ölümleri.
- **Karta özgü kısım:** altıgen kubbe, yansıma, çoklu ışın.
- **v3 hedefi:** kubbe yalnızca savunanın ön sırasını saran, ince bantlı bir yüzey; yansıyan ışınlar
  belirli sırayla (yakından uzağa ya da soldan sağa), her biri ≥ 200–250 ms arayla: temas → o
  canavarın kendi ölümü → sonraki; kamera sırayı kaydırarak izler; tuzak en son çıkar. Savunmadakiler
  için kısa kalkan parıltısı. Bütçe: tek hedef ≤ 2,0 sn, her ek hedef +0,3 sn (çok hedef istisnası
  plana yazılmalı).
- **Öncelik:** yüksek.

### K. Işık Zincirleri (`chains_of_light`) — geçersiz kıl + savaşı bitir

- **Olay / kart:** `activate` + `attackNegated` (kanca `negate`) + `phaseChange` / `turnStart`.
- **Mevcut animasyon (dosya):** `src/cinematics/traps/chains_of_light.ts`,
  `src/cinematics/traps/_chains.ts` `lightChains()`. Ortak açılış (B); saldıran yine de çömelip
  (120 ms) atılır (`attack` animi, ardıl görüntüler, 320 ms lunge); kartın yüzünden üç altın zincir
  fırlar, havada sarar (asılı saldırı karesinde 1 px kıpırtı), asma kilit işareti + hit-stop, zincirler
  onu kendi karosuna çeker; evde ikinci "tak", beyaz siluet flaşı, altın kıvılcım, `hit`;
  "SAVAŞ BİTTİ" pankartı; tuzak çıkar; motorun bitiş / yeni tur olayları gelir.
- **Ölçülen süre:** activate 883, lunge 1950–2170, kilit ~2410, çekiş 2490–2730, attackNegated
  2850, "SAVAŞ BİTTİ" 2880–3500, phaseChange 3800; tuzak ≈ 2,9 sn.
- **Zayıf / eksik (kanıt):**
  - 3,8 sn içinde üç tam genişlik pankart: "TUZAK!" (1280–1920), "SAVAŞ BİTTİ" (2880–3500), tur
    pankartı (3840–4640) (`tbChains.png`).
  - Zincirler savunan canavarın (Işık Perisi) gövdesinin içinden geçiyor, çünkü kart onun arkasında
    (`tbChains-bind-zoom.png` #4–#11).
  - Saldıran çekilirken tek bir kareye kilitli ve bütün sprite olarak kayıyor (ayak kayması);
    direnme 1 px titreme (`tbChains-bind-zoom.png` #8–#11 2490–2730).
  - Uzak ve küçük: 1×'te zincirler noktalı ince çizgiler.
- **Ortak bileşen:** tuzak açılışı / çıkışı (B), `takeAttack`, `holdFrame`, `afterimages`,
  `whiteFlash`, `banner`.
- **Karta özgü kısım:** zincirler, asma kilit, çekiş, "SAVAŞ BİTTİ".
- **v3 hedefi (A2 dilimi):** zincirler savunanın etrafından dolaşarak çıkar; saldıran lunge
  ortasında yakalanır, parça bazlı direnir (baş savrulur, uzuvlar gerilir), geri çekilirken ayakları
  yere basar / sürtünür (her ayakta toz), kilit "tak"ı tek darbe anı. Pankartlar tek bir kazanca
  indirilir (kısa "TUZAK!" + sonuç olarak "SAVAŞ BİTTİ", ikisi birden tam genişlik değil).
  ≤ 2,0 sn.
- **Öncelik:** yüksek.

### L. Yer Yarığı (`chasm_trap`) — çağırmanın kesilmesi

- **Olay / kart:** `summon` → `decision` → `activate` + `destroy` (kanca `destroys`) +
  `toGraveyard`.
- **Mevcut animasyon (dosya):** `src/cinematics/traps/chasm_trap.ts` (`fissure()`) +
  `setpieces.chasm()`. Ortak açılış (B); tuzak kartından kurbanın karosuna parlayan bir yarık zeminde
  koşar; canavar irkilir (`hit`, saldırı pozisyonundaysa), zemin parlayan bir uçuruma açılır,
  canavar maskeyle aşağı kayar, kayalar düşer, yarık gürleyerek kapanır; kart yaradan çıkıp
  mezarlığa yay çizer; tuzak çıkar.
- **Ölçülen süre:** çağırma 0–1470 (tam imza girişi), karar 1483, activate 1800, yarık 2880–3160,
  açılma 3200–3400, düşüş 3480–3750, kapanış ~3950, kart mezarlığa ~3900–4500, tuzak çıkışı
  4500–4900; tuzak ≈ 3,1 sn. Kurbanlı Titan (`tbChasmBig`): çağırma 3,6 sn + tuzak, toplam 8,0 sn.
- **Zayıf / eksik (kanıt):**
  - "Kesilme" yok: canavarın giriş animasyonu bütünüyle bitiyor, ancak sonra yutuluyor
    (`tbChasm.png` #0–#9).
  - Düşüş bütün sprite'ın maskeyle aşağı kayması; canavar düşerken poz değiştirmiyor (kollar kalkmıyor,
    kenara tutunmuyor) (`tbChasm-fall-zoom.png` #7–#10 3480–3750).
  - Yarık ve çukur iyi okunuyor (dither'lı karanlık + macenta kenar); kayalar küçük.
- **Ortak bileşen:** tuzak açılışı / çıkışı (B), `chasm`, `fx.cardToGraveyard`, `guardRemap`.
- **Karta özgü kısım:** zemin yarığı, uçurum, düşüş, kapanış.
- **v3 hedefi:** karar işareti girişin kuyruğunda başlasın; yarık canavarın kükremesini keser
  (kükreme yarıda kalır, şaşkınlık pozu); düşüşte parça bazlı poz (kollar yukarı, gövde öne
  devrilir), maske + kayalar + kapanış; ≤ 2,0 sn (aktivasyondan).
- **Öncelik:** orta (A5).

---

## 4. Kesişen konular

### 4.1 Kartın gittiği yer

| Kart | Bugün | Kanıt | v3 hedefi |
|---|---|---|---|
| Yıldırım Hükmü | kart fırtına gözünde yeniden belirip mezarlığa düşer (`resolvedToGraveyard`, 360 ms) | `spBolt.png` #19–#21 | ölümden sonra, tek odak |
| Şifa Pınarı | pınarın üstünde belirir, mezarlığa | `spHeal-fountain-zoom.png` #11 | aynı, damlalar bittikten sonra |
| Ruh Çağrısı | sütun yükselirken mezarlığa (ikinci odak) | `spRecallEnemy.png` #2 | diriltme bittikten sonra |
| Ejder Kılıcı | B/T bölgesine çakılır, yüzü açık kalır; kırılınca altın kırıklar + mezarlık | `spBlade.png` #8–#11, `spBladeBreak.png` | kalır; canavarla bağ işareti |
| Volkan Arenası | alan bölgesine çakılır, kalır; eskisi yanar | `spVolcano.png` #8–#10 | kalır; zemin teması sürer |
| Tuzaklar | ayakta kart çözülür, küçük kopyası mezarlığa (`trapExit`) | `tbMirror-reflect-zoom.png` #9–#15 | ana sonuçtan sonra |

Kuşanmalı hedefte üç kart aynı anda mezarlığa uçuyor (`spBoltAce.png` #10–#13). Mezarlığa tıklayınca
inceleme paneli yok (A6).

### 4.2 Stat değişimi sunumu

`src/cinematics/flow/stats.ts` (yeşil / kırmızı parlama, ▲ / ▼ şevronlar, rozet akışı,
`statPop`) + `volcano_arena.ts` `heatUp` / `coolDown` (kendi sayıları). Ejder Kılıcı: temasta mutlak
değer başın üstünde akar (1900 → 2600, ~1 sn), "+700" ~1,2 sn sonra. Volkan: beş sayı aynı anda,
üst üste. Kılıç kırılınca: rozet kırmızı geri akar, küçük aura patlaması. **v3:** fark sayısı temas
karesinde rozetin yanında, rozet ~0,4 sn akar, çoklu değişim sıralı; parlama tüm sprite yerine
canavarın ışık havuzu / kenar ışığı.

### 4.3 Kamera, flaş, ışık

- Kesirli yakınlaşma her büyü / tuzakta: `_kit.ts` 1.03, `judgment_bolt.ts` 1.06, `dragon_blade.ts`
  1.06, `soul_recall.ts` 1.04, `volcano_arena.ts` 1.05, `_opening.ts` 1.06, `chains_of_light.ts`
  1.06, `mirror_barrier.ts` 1.04, `chasm_trap.ts` 1.07, `battle/declare.ts` 1.05. Plan: tam sayı 2× ya
  da yalnızca kaydırma (A1).
- Tam ekran flaşlar (`vfx/core.ts` `flash`, `DEPTH.OVERLAY` → arayüzü de boyar):
  `stormStrike` beyaz 220 ms %78, Volkan ateş 110 ms %28, tuzak açılışı macenta 90 ms %22, ayna
  kubbesi macenta 120 ms %35, pankart girişindeki beyaz bant. **v3:** yerel ışık katmanı flaşı,
  arayüz asla parlamaz.
- Işık katmanı çağrıları büyü / tuzak kodunda zaten var ama v1'de etkisiz (`_kit.ts` başlığı);
  sakin arenaya taşınınca kalibre edilmeli.

### 4.4 Kart resimleri (`src/art/cardart/*.ts`, `cards-art.png`, `cards-big-p3.png`)

- Yıldırım Hükmü: fırtınalı gök + zikzak, figür belirsiz. Şifa Pınarı: yeşil pınar, sade ve okunur.
  Ruh Çağrısı: kollarını kaldırmış çizgi film hayaleti + mezar taşları; diğerlerinden daha "çocuksu"
  bir dil. Ejder Kılıcı: kanatlı altın kılıç, güçlü siluet ama arka plan yoğun dama dither. Volkan
  Arenası: yanardağ, yoğun dama dither (gürültü sınırı aşılıyor). Ayna Kalkanı: pembe altıgen kristal +
  ışın, dither yoğun. Işık Zincirleri: koyu mor mühür üstünde çapraz altın zincirler, kalabalık.
  Yer Yarığı: kahve zemin + macenta bant; çatlak / uçurum fikri zayıf okunuyor.
- Kart yüzündeki ad ve metin alanları yer tutucu çizgiler; adı yalnızca açılıştaki plaka söylüyor.
- **v3 (A5):** temiz ton bantları, sol üst ışık, dither yalnız geçişlerde; her resim 1×'te tek
  okunur siluet (yarık için derin bir V çatlak, diriltme için mezarlıktan yükselen ruh ışığı).

### 4.5 Performans notu (güvenilirliği düşük)

Ölçüm sırasında makine aşırı yüklüydü (yük 10–18 / 4 CPU), sayılar gerçek cihazı temsil etmez.
Tekrarlanan desenler: Volkan teması geçişinde (1583–2483 oyun ms) sürekli ağır kareler; Işık
Zincirleri'nde "SAVAŞ BİTTİ" + kamera geri çekilmesi sırasında (3100–3467) sürekli ağır kareler;
as canavarlı senaryolarda (kuşanmalı ejdere yıldırım, ejder / titan / yılan diriltme) tek seferlik
saniyeler süren kareler. Kontrol (`spBolt`) en fazla 45–151 ms. Olası neden (doğrulanmadı): her
karede CPU'da çizilip yeniden yüklenen `Raster` tuvalleri (`setpieces.ts` `Raster`,
`createCanvas`) ve `BoardView.paintLava`. A7'de gerçek tarayıcıda ölçülmeli.

---

## 5. En zayıf 8 nokta

1. **Ruh Çağrısı normal çağırmayı üst üste oynatıyor** (yüksek). Hayalet + sütundan sonra
   `ctx.play(si, { noCard, ghost })` canavarın tam imza girişini oynatıyor; `spRecall.png`
   2030–3130 ms = `cmp-normalSummon-wolf.png` 330–1210 ms. Süreklilik kopuyor (hayalet karoda erir,
   kurt başka yerden koşar), 3,0–5,1 sn (bütçe ~2,0).
2. **Tuzaklar bütçenin 1,5–2 katı ve pankart yüklü** (yüksek). 2,9–3,5 sn (bütçe 1,5–2,0); ortak
   açılış tek başına ≈ 1,1 sn; Işık Zincirleri'nde 3,8 sn içinde üç tam genişlik pankart
   (`tbChains.png`).
3. **Ayna Kalkanı'nda hedef sırası okunmuyor** (yüksek). İki öldürme 34 ms arayla (2933 / 2967),
   ölümler üst üste, tuzak çıkışı aynı anda (`tbMirror-reflect-zoom.png`, `tbMirrorP2.png`).
4. **Yıldırım Hükmü: tam ekran beyazlama + kurbanın kapanması + karaktersiz ölüm** (yüksek, A2).
   220 ms %78 beyaz arayüz dahil (`spBolt-strike-zoom.png` 1120–1240); yıldırım kurbanı ~0,45 sn
   örtüyor; `destroys` kancası Kristal Ejder'in kristal ölümünü bastırıyor (`spBoltAce.png`).
5. **Hedef tepkileri bütün sprite boyama / kaydırma** (yüksek). Yıldırım kilidi (dolgu + 1 px),
   kılıç (beyaz → altın siluet, `spBlade-impact-zoom.png`), zincir çekişi (tek kare + kayma,
   `tbChains-bind-zoom.png` 2490–2730), uçuruma düşüş (maskeyle kayma, `tbChasm-fall-zoom.png`
   3480–3750), volkan (siluet parlaması). Parça bazlı tepki yok; §4 ilk kuralına aykırı.
6. **Ortak büyü açılışı tekdüze, uzun ve kesirli** (yüksek). Beş büyüde aynı ~0,8 sn (büyü
   süresinin üçte biri), 2× kart tahtanın ortasını kapatıyor, uçuşta kesirli ölçek + 1.03 itme
   (`spBoltSet-opening.png`); bütün büyüler 2,3–2,5 sn (bütçe ≤ 2,0).
7. **Volkan Arenası: okunmayan çoklu stat değişimi, tam ekran kırmızı, ağır kareler** (orta).
   Beş sayı 1,4–2,2 sn üst üste (`spVolcano-stats-zoom.png`), bütün gökyüzü düz kırmızı + 1,15 sn
   sarsıntı, tema geçişinde sürekli ağır kareler.
8. **Ejder Kılıcı'nın anlamı ve bağı** (orta). Kılıç canavarı başından deliyor (saldırı gibi),
   anatomik tutma noktası yok, kalıcı bağ yalnız soluk ayak halkası, "+700" temastan ~1,2 sn sonra
   (`spBlade-impact-zoom.png`, `spBlade-after-zoom.png`).

Listeye girmeyen ama izlenecekler: tuzak istemi tahtayı karartıp karar bağlamını gizliyor
(`tbDecision-prompt.png`, orta); Şifa Pınarı canavarın üstüne fışkırıyor (orta); kart resimlerinde
yoğun dither ve okunmayan Yer Yarığı resmi (orta, A5); kesirli kamera ve tam ekran flaşlar bütün
büyü / tuzaklarda (A1 altyapı işi).
