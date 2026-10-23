# A5 — Büyü / tuzak sahneleri, kart yüzleri ve giriş portreleri (yapım planı)

> **Durum:** plan, **revize 1** (23 Ekim 2026, A5 / A6 incelemesinden sonra; reddedilen ya da değiştirilen bulgular §9'da). A6 (küçük olaylar, HUD, açılış) ayrı planda (`docs/v3/A6_PLAN.md`); iki plan **tek ortak ön adım (A56.0), dört paralel şerit, bir kontrol noktası (A56.K) ve tek ortak kapanışla (A56.Z)** yürür (§5.0, iki planda aynı).
>
> **Kullanıcı kararları (bağlayıcı):**
> - Kalan 7 canavarın yeniden çizimi bekletiliyor. Kurt, Kertenkele, Golem, Suikastçı, Atmaca, Peri ve Pusucu eski çizimde kalıyor. A5 ve A6 öne alındı.
> - "Yeni görünüm eskisinden pek farklı değil." A5 bu yüzden oyuncunun **sürekli gördüğü** yerleri değiştirir: eldeki kartlar, sahadaki kartlar, büyü / tuzak anları ve kalıcı durumlar.
> - "Kamerayı değiştirme, böyle iyi." A5 hiçbir kamera hareketi eklemez; ayrıntı ve kalan / kalkan çağrıların listesi §0 K1'de.
> - **Orkestratör kararı (23 Ekim, kullanıcının "kamerayı değiştirme" sözüne göre; S1 / S6 kapandı):** bugünkü kamera davranışı v3'te **aynen kalır**. §0 K1'de ve storyboard'larda "v3'te kalkar" denen eğilmeler (Kılıç `dragon_blade.ts:260`, Volkan `volcano_arena.ts:249`, Ayna kubbesi `mirror_barrier.ts:57`, Yarık kurbanı `chasm_trap.ts:148`) de **kalır**: yeniden yazılan sahne, bugünkü eğilmeyi aynı hedefe ve aynı ana karşılık gelen vuruşta çağırır. Yeni kamera hareketi eklenmez, var olan kaldırılmaz. Kamera kapısı: `focusCalls` ve `maxScrollPx` ortak tabana **eşit** (± bir kare).
> - HD / 3B / yumuşak görünüm reddedildi. Fark zanaatla, sabit kadrenin içinde yaratılır.
>
> **Öncelik sırası:** kullanıcı kararları > CLAUDE.md > `docs/v3/REHBER.md` > bu belge. REHBER EF-8'in "büyük anlarda 2× yakın çekim" izni ve ANIMASYON_PLANI §3'ün aynı cümlesi bu iş için **geçersizdir**; orkestratör ikisini şeritler başlamadan "yalnız zoom 1; yeni focus / closeUp yok (kullanıcı kararı)" diye günceller (§5.0.1 önkoşul).
>
> **Bağlayıcı belgeler:** CLAUDE.md, `docs/ANIMASYON_PLANI.md` §1–§6, `docs/v3/REHBER.md` (IŞ / HA / SÜ / EF / SE / KK), `docs/v3/A3_MIMARI.md` (§6 tarifler, §13 değişmezlik kapıları), `docs/v3/A0_ENVANTER.md` (§2, §3, §4).
>
> **Bu plan için çekilen kanıt** (`shots/v3/a56/a5plan/`, git dışı; hepsine bakıldı):
> - Büyüler: `spHeal-v3-a.png`, `spHealP2-v3-a.png`, `spRecall-v3-a.png`, `spRecallSet-v3-a.png`, `spBlade-v3-a.png`, `spBladeAce-v3-a.png`, `spVolcano-v3-a.png`
> - Tuzaklar: `tbMirror-v3-a.png`, `tbMirrorP2-v3-a.png`, `tbChasm-v3-a.png`
> - Çıta: `sliceBoltMagus-v3-a.png`, `sliceChainsWyrm-v3-a.png`
> - Kartlar: `cards-all-v3.png`, `cards-art-v3.png`, `hud-v3.png`, `zoom-iso-equip.png`, `zoom-iso-field.png`
>
> Filmler `node tools/shot.mjs "?dev=duel&s=<key>&look=v3" --fresh --film N --every 50 --frames DIR` ile, kareler 50 ms arayla çekildi. Karalama araçları (`compose.py`, `palcheck.py`) `<scratch>/v3/a56/a5plan/tools/` altında.

---

## 0. Özet ve sabit kurallar

**Üç iş paketi:**

1. **Altı büyü / tuzak sahnesi ve sesleri** (şerit A5-A). Ejder Kılıcı, Volkan Arenası, Ayna Kalkanı, Yer Yarığı, Şifa Pınarı ve Ruh Çağrısı'nın kalanları. Yıldırım Hükmü ile Işık Zincirleri A2'den hazırdır; çıta onlardır. A5 onlara yalnız kart resmi verir.
2. **Kart yüzleri** (şerit A5-B).
   - 20 kartın hepsine yeni v3 çerçeve; çerçeve dili ortak `src/art/frame-v3.ts`'tendir (A56.0). v3 arka yüz A6-A'nındır; aynı dili kullanır (§3.7.4).
   - **11 karta** yeni stilde resim: 8 büyü / tuzak + çizimi oyunda olan 3 canavar (Ejder, Büyücü, Muhafız).
   - Sahadaki açık kartlar için elle çizilmiş 16×12 simge (11 kart).
   - Yaşayan kart resmi (S2; 11 kart).
3. **Girişler** (şerit A5-B). Büyücü'nün P2 ışığı (B-9) ve as olmayan normal çağırmaya **zorunlu** "giriş damgası" (B-8).

**A4.1 entegrasyonuna taşınanlar** (kayıtsız Titan / Yılan oyunda görünmediği için; ≈ 11 sa): Titan ve Yılan'ın v3 giriş portreleri, kart resimleri, saha simgeleri ve yaşayan kareleri (§5.4).

**Yapım düzeni (§5.0):** önce ortak ön adım A56.0 (araçlar, kill-switch'ler, dondurulan sözleşmeler, ortak taban). Sonra dört şerit paralel: **A5-A** (sahneler + sesler), **A5-B** (kart yüzleri + girişler), A6-A, A6-B. Şeritlerin ilk görünür adımlarından sonra kullanıcıya kontrol noktası (A56.K), sonda tek ortak kapanış (A56.Z). A5'in payı ≈ 70 ajan-saat (§8).

**Sabit kurallar (A5'in her satırı için):**

- **K1 Kamera sabit (kullanıcı kararı).**
  - A5'in yazdığı kod hiçbir `focus` / `ctx.focus`, `closeUp`, zoom, kaydırma, takip, yumruk (punch-in) ya da letterbox çağrısı **eklemez**. Eklenebilecek tek kamera çağrısı, bugünkü güvenlik `unfocus` / `relax()`'tır: önceki bir eğilmeyi geri alır, kamera dinlenirken işlemsizdir.
  - **Olduğu gibi kalan çağrılar** (A5 dokunmaz): tuzak açılışının eğilmesi ve 140 ms'lik 1 px sarsıntısı (`traps/_opening.ts:469`, `trapOpeningV3`, pan 0,25); ilan ve savaş eğilmeleri (`battle/declare.ts:81, :389`; `battle/battle.ts:111, :380`); çağırma çemberi eğilmesi (`_core/helpers.ts:373`) ve eski imza girişleri (`summon-b/_kit.ts:509`, `summon-a/abyss_magus.ts`); A2 dilim sahnelerinin eğilmeleri (`boltV3` `spells/judgment_bolt.ts:598`, `chainsV3` `traps/chains_of_light.ts:582`, `recallV3` `spells/soul_recall.ts:843`); açılışın inişi ve yazı-tura eğilmesi (`flow/opening.ts:163`); eski çizimli canavarların vuruş eğilmeleri (`strikes-b/**`); ekran uzayı uçuşlarından önceki `unfocus` güvenlikleri; bugünkü küçük sarsıntı ve hit-stop'lar.
  - Not: `spellOpeningV3` kamera çağırmaz (eğilme yok). Eğilen yalnız `trapOpeningV3`'tür; A5'in v3 tuzak sahneleri sonda `ctx.unfocus(320)` ile onu geri alır (bugünkü gibi).
  - **v3'te kalkanlar** (yeniden yazılan sahnelerle birlikte gider; v1'de aynen durur; kullanıcıya A56.Z paketinde açıkça söylenir): Ejder Kılıcı'nın dövme eğilmesi (`spells/dragon_blade.ts:260`), Volkan Arenası'nın patlama eğilmesi (`spells/volcano_arena.ts:249`), Ayna Kalkanı'nın kubbe eğilmesi (`traps/mirror_barrier.ts:57`; tuzak açılışının eğilmesi kalır), Yer Yarığı'nın kurban eğilmesi (`traps/chasm_trap.ts:148`). A6'da kalkanlar: deste bitmesi (`flow/end.ts:39`) ve oyun sonu (`flow/end.ts:140`).
  - Yeni vuruşlarda ekran sarsıntısı yoktur. Sarsıntı gerekiyorsa yerel nesne titremesi kullanılır: karo, kart ya da parça 1 px kayar, tam pikselle.
  - Kapı (§6.4): `measure` kamera alanları (`zoom.max = 1`, `closeUpCalls = 0`, `maxScrollPx` ve `focusCalls` ≤ ortak taban) ve yalnız **eklenen satırlarda** ve yeni dosyalarda kaynak taraması.
- **K2 Piksel dili.**
  - 640×360. Konum ve ölçek tam sayı, kesirli döndürme yok. Açılı nesneler önceden çizilmiş açı kareleriyle gösterilir.
  - Maddede 1 px kontur, düz ton bantları, yalnız `PAL`.
  - Alfa yerine palet basamağı kullanılır.
  - Tam ekran yıkama, karartma ya da renk örtüsü yok (EF-4, EF-6, EF-7). Efekt silüeti 2 kareden uzun süre %50'den fazla örtmez (EF-2).
- **K3 v1 aynı kalır.** Her yeni şey kendi şerit bayrağının arkasındadır (`V3_A5_A`, `V3_A5_B`; `src/view/v3flags.ts`, §5.0.3); `LOOK_V3` tek başına yeni davranış açmaz. v1 filmleri, süreleri, canavar sayfaları ve **kart dokuları** piksel piksel aynı kalır (§6.1).
- **K4 Süreler REHBER §5 sınırındadır.** Aşılan iki bütçe gerekçesiyle yazıldı: Ayna Kalkanı'nda çoklu hedef (§3.3) ve Volkan Arenası'nda "değiştirme" (§3.2).
- **K5 Görünür olan önce.** Şerit sıraları oyuncunun en sık gördüğü değişiklikle başlar: A5-A'da Volkan'ın kalıcı tam ekran tonu, A5-B'de 20 kartın çerçevesi ve saha simgeleri. Oyunda görünmeyen işler (kayıtsız Titan / Yılan) bu işten çıkarıldı.

---

## 1. Hedef ve "büyük fark" ölçütü

### 1.1 Oyuncunun ilk bakışta fark etmesi gerekenler (telefonda, 1×)

**G1 — Eldeki kartlar.**
- **Bugün (v3):** Parlak altın / turkuaz / magenta metal gövde, fırçalanmış metal gürültüsü. Eski, dither'lı resimler. Aslarda yumuşak gökkuşağı folyo.
- **A5 sonrası:**
  - Koyu mat gövde ve tek neon tür çizgisi; bu, sakin arenanın dilidir.
  - 11 kartta yeni resim. Canavar resimleri onaylı sabit karelerden gelir.
  - Resimler yaşar (S2).
- **Ölçü (geçer):**
  - Yan yana 1× (el, 5 kart): bağımsız eleştirmen her çiftte ≥ 3 somut fark sayar ve yeni kareyi seçer (§1.2).
  - Kör test: yalnız 1× resim penceresinden kart adı, yeni resmi görünen 11 kartta ≥ 10 doğru bilinir.
- **Ölçü (yardımcı, piksel; `card-hash` + piksel farkı):**
  - 20 kartın hepsinde **çerçeve bölgesi** (yüz − 44×34 resim penceresi − 1 px dış kontur) piksellerinin ≥ %70'i değişir.
  - Yeni resimli 11 kartta resim penceresinin ≥ %50'si değişir. 7 eski canavarın ve kayıtsız Titan / Yılan'ın resim penceresi **bilerek** aynı kalır (kart resmi canavarın çizim kuşağını izler, §3.7.2); yüzün tamamında %50 şartı bu 9 kart için konmaz.

**G2 — İnceleme paneli (2×).**
- **Bugün:** Ejder'in üstünde yumuşak beyaz-gökkuşağı parlama (`hud-v3.png`), eski resim.
- **A5 sonrası:** v3 yüz 2×'te, keskin 1–2 px parıltı. Bindirmeler NORMAL karışımla, opak palet pikseli olarak basılır (sözleşme S-5, A56.0'da).
- **Ölçü:** Folyo karelerinde kart bölgesinin palet dışı payı ≤ statik kare + 1 puan (`palcheck`). Panelin yumuşak aurası A6-A'nındır (`inspectV3`).

**G3 — Sahadaki açık kartlar** (kuşanma, alan, açılan tuzak, mezarlık üstü).
- **Bugün:** 16×12'ye küçültülmüş resim, turuncu / pembe bir leke (`zoom-iso-equip.png`).
- **A5 sonrası:** Elle çizilmiş 16×12 simge: kılıç, volkan, petek, zincir halkası, yarık, damla, hayalet, şimşek ve 3 canavar başı. 7 eski kart bugünkü küçültmeyle kalır.
- **Ölçü:** Kör test, 1× saha kırpımı: 8 büyü / tuzak simgesinin 8'i de tanınır.

**G4 — Altı büyü / tuzak anı.**
- **Bugün:** v3 açılışının arkasında v1 set-piece'leri. Yumuşak dev kubbe, canavarı tamamen beyaz silüete çeviren kılıç, sürekli tam ekran turuncu ton, 3,0–3,5 sn süren tuzaklar.
- **A5 sonrası:** Her kartın kendi keskin imza karesi, okunur sıra, malzemeye göre ışık ve ses. Yer Yarığı çağırmanın **hemen ardından** gelir (A6 hızlı yoluyla çağırma bitişi → yarığın ilk karesi ≤ 300 ms); girişin yarıda **kesilmesi** bu işin kapsamında değildir (§3.4, §7.1 risk 9).
- **Ölçü:**
  - İmza kareleri yan yana gösterilir (önce | sonra); her çiftte ≥ 3 somut fark ve yeni kare tercih edilir.
  - `palcheck`: efekt bölgesi ≤ kare 0 + 1 puan; > %50 palet dışı kare yok.
  - EF-4 beyaz payı ≤ %1,5.
  - Süreler §6.3 tablosunda.

**G5 — Kalıcı durumlar.**
- **Bugün:**
  - Kuşanma: soluk, kesik altın elips.
  - Volkan: 800 ms'den sonra karelerin **%89–99'u palet dışı** (sürekli tam ekran ton; kaynak §3.2).
- **A5 sonrası:**
  - Kuşanmış canavarın yanında süzülen küçük altın kılıç.
  - ATEŞ canavarında piksel alev dilleri, SU canavarında buhar telleri.
  - Tam ekran ton yok.
- **Ölçü:** `palcheck` ≤ taban + 1 puan. Sahne yeniden kurulunca (`FieldView.sync`) aynı görünür.

**G6 — Ses.**
- **Bugün:** Altı kartın çoğu v1 ortak seslerini çalıyor (`heal`, `equip`, `whoosh`, `shatter`…).
- **A5 sonrası:** Her kartın küçük bir ses paleti var, sesler işaretlere bağlı.
- **Ölçü:**
  - SE-1: ses ile işaret arası ≤ 1 kare (1× ve 3×).
  - SE-6: tepe ≤ −1 dBFS.
  - Kurbanın kendi sesini maskelemez (SE-7 ducking).

**G7 — Girişler.**
- **Bugün:** Büyücü P2'de aynalı, ışığı ekranın sağ üstünden geliyor. As olmayan çağırmada canavarın adı hiçbir yerde görünmüyor.
- **A5 sonrası:** Büyücü P2 ayrı ışıklı (B-9). As olmayan normal çağırmada ≤ 0,4 sn'lik isim damgası (B-8).
- **Ölçü:** `?dev=cutin&id=abyss_magus&player=2` ×2 karesinde aydınlık düzlemler sol üstte; damga `normalSummon` filminde 3+ kare okunur, çağırma süresine eklenmez.

### 1.2 Yan yana (önce | sonra) denetimleri

`tools/sbs.mjs` (A56.0) aynı sorguyu iki kez çeker ve kareleri yan yana dizer:

- **"Önce":** A56.0'ın ortak tabanı (`shots/v3/a56/before/`).
- **"Sonra":** şerit adımı ya da A56.Z.

**Geçme ölçütü (her sayfa):** 1×'te (büyütmesiz) bağımsız bir eleştirmen (ajan) her çiftte en az 3 somut fark sayar ve yeni kareyi tercih eder. Geçmeyen çift düzeltilmeden kullanıcıya gitmez. Piksel ölçüleri (§1.1 "yardımcı") yalnız tanıdır, "farklı" demek "açıkça yeni" demek değildir.

Üretilecek sayfalar (`shots/v3/a5/sbs/`):

- `sbs-hand.png` ve `sbs-hand-p2.png`: elde 5 kart, 1× ve ×3.
- `sbs-inspect.png`: 11 kart, inceleme panelinde 2×.
- `sbs-field.png`: kuşanma + alan + açılan tuzak + mezarlık üst kartı, 1× ve ×4.
- `sbs-cards-all.png`: `?dev=cards`, 20 yüz.
- `sbs-<senaryo>.png`: her büyü / tuzak için 3 anahtar kare (açılış, doruk, sonuç), P1 ve P2.

**Kontrol noktası (A56.K, §5.0.5):** B-1 biter bitmez ortak 1× sayfaya "boşta ekran" ve "el üzerine gelme" çiftleri A5'in yeni çerçevesiyle girer; kullanıcı yönü onaylamadan A5-B'nin görsel dil adımları sürmez.

### 1.3 Neyi değiştirmeyiz

- Oyun kuralları, kart verisi ve motor (`src/engine/**`, `src/data/cards.ts`).
- Kamera (K1).
- Yıldırım Hükmü ve Işık Zincirleri sahneleri. A2 çıtasıdır, yalnız kart resimleri yenilenir.
- 7 eski canavarın resmi. v3 çerçevenin içinde kalır (§3.7.2).
- Titan ve Yılan'ın kart resmi, simgesi ve portresi (A4.1 entegrasyonu, §5.4).

---

## 2. Envanter (bugünkü durum → zayıf yan → hedef)

### 2.1 Büyü / tuzak sahneleri

Süreler activate başlangıcından girdinin geri gelmesine kadardır; `shots/v3/a3/baseline/measure-v3-pilot.json`, parantez içinde `measure-v1.json`.

**Yıldırım Hükmü — çıta.**
- **Kod:** `spells/judgment_bolt.ts` `boltV3`, `setpieces.stormStrike` (v3), `_kit.ts` `spellOpeningV3`.
- **Bugün (film):** kart sahibinin yanında; hedefin üstünde piksel bulut; kartın üst kenarından buluta küre; keskin zikzak; hedefin kendi `hitMagic`'i ve ölüm pozu; kartlar ≥ 150 ms arayla. Sesler: `boltGather` / `boltCrackle` / `lockOn` / `boltStrike`. `sliceBoltMagus-v3-a.png`
- **Süre:** 1,27–1,88 sn (2,42–3,32).
- **Hedef:** yalnız kart resmi (§3.7).

**Işık Zincirleri — çıta.**
- **Kod:** `traps/chains_of_light.ts`, `_chains.ts`, `trapOpeningV3`.
- **Bugün:** kart ayağa kalkar; kısa "TUZAK!"; altın zincirler saldıranı bağlar; "SAVAŞ BİTTİ" plakası; zincirler geri çekilir. `sliceChainsWyrm-v3-a.png`
- **Süre:** 1,88–1,93 sn (2,93).
- **Hedef:** yalnız kart resmi.

**Şifa Pınarı.**
- **Kod:** `spells/healing_spring.ts` → `_fountain.ts` `quickFountain` → `setpieces.healingFountain` (v1).
- **Bugün:**
  - v3 açılışından sonra S/T 1'de 82 px yüksekliğinde, alfalı, yumuşak bir gayzer çıkıyor ve arkadaki Gelgit Golemi'nin alt yarısını örtüyor.
  - Damlalar LP paneline gidiyor; panel tamamen yeşile boyanıyor (A6'nın `lpGain`'i).
  - Düellocu `victory` oynuyor.
  - Ses v1: `waterSplash`, 12× `heal`, `lpTick`.
  - `spHeal-v3-a.png`, `spHealP2-v3-a.png`
- **Süre:** 1,72 sn (2,42–2,53).
- **Zayıf:** su yumuşak ve alfalı; canavarı örtüyor; iyileşme düellocunun üstünde okunmuyor; büyünün kendi sesi yok.
- **Hedef:** §3.5.

**Ruh Çağrısı.**
- **Kod:** `spells/soul_recall.ts` `recallV3` (A2 K5).
- **Bugün:**
  - Açılış; kapalı kart açılırken 260 ms'lik beyaz-cyan **gürültü bloğuna** dönüşüyor (`TileCard.dissolve`).
  - Mezardan cyan hayalet çıkıp karoya süzülüyor.
  - Karoda yeniden kurulma: v3 çizimi olan canavarda `revive` pozu, eskilerde ≤ 300 ms cyan kurulum.
  - Kart mezarlığa gidiyor.
  - Ses: v3 canavarlarda karakter sesleri, eskilerde v1 `revive` / `whoosh` / `materialize`.
  - `spRecallSet-v3-a.png`, `spRecall-v3-a.png`
- **Süre:** 1,45–1,60 sn ✓ (2,9–3,2).
- **Zayıf:** kapalı kart bırakması gürültü bloğu; büyünün kendi sesi yok.
- **Hedef:** §3.6 (kalan küçük işler).

**Ejder Kılıcı.**
- **Kod:** `spells/dragon_blade.ts` `forge` (v1), `setpieces.goldAura`, `auras.ts` `equipAura`.
- **Bugün:**
  - Kart **döndürülerek** S/T karosuna çarpıyor (v1 `slamToZone`).
  - Altın rün halkası; ×2 beyaz kılıç silüeti; kılıç canavarın **içine dalıyor**.
  - Canavar 2–3 kare **tamamen beyaz silüet** (EF-3 ihlali).
  - ATK sayacı başın üstünde 2844 → 3500 akıyor.
  - Kalıcı durum soluk, kesik altın elips.
  - Ses v1: `equip`, `holyChime`, `summonBurst`, `whoosh`.
  - Kamera: dövmede eğilme (`dragon_blade.ts:260`; v3'te kalkar, K1).
  - `spBladeAce-v3-a.png`, `spBlade-v3-a.png`
- **Süre:** 2,00–2,10 sn (2,47–2,50); kırılma (`spBladeBreak`) 2,25.
- **Zayıf:** A0'daki "kılıç canavarı deliyor, saldırı gibi okunuyor" hâlâ duruyor; beyaz silüet; döndürülen kart; bütçe sınırda.
- **Hedef:** §3.1.

**Volkan Arenası.**
- **Kod:** `spells/volcano_arena.ts` (v1 `heatUp` / `coolDown` / `breakOldField`), `BoardViewCalm.setTheme('volcano')` (sakin arenanın lav dikişleri), `setpieces.setVolcanoAmbience`, `auras.ts` `flameAura` / `steamAura`.
- **Bugün:**
  - Kart döndürülerek alan karosuna iniyor; yumuşak turuncu ateş topu patlıyor.
  - Canavarlar beyazımsı silüete dönüyor; 5 sayı üst üste.
  - Bütün dikişler turuncu, çatı pusu kızıl.
  - **800 ms'den sonra karelerin %89–99'u palet dışı**: sürekli tam ekran ton.
  - Kamera: patlamada eğilme (`volcano_arena.ts:249`; v3'te kalkar, K1).
  - `spVolcano-v3-a.png`
- **Tonun kaynağı (inceleme ile doğrulandı):** `setVolcanoAmbience` içindeki `wash` dikdörtgeni (`vfx/setpieces.ts:2466`): tam ekran, ADD karışım, alfa 0,06–0,08, `DEPTH.SHADOW − 3`'te; 57'nin altındaki her şeyi boyar. Üstüne `DEPTH.SHADOW − 2`'deki altı ADD ısı rasterı. Gök / parıltı / alçak rasterlar sakin arenanın arka planının arkasında zaten görünmüyor.
- **Süre:** 1,85–1,92 sn; Replace 2,13; Cool 1,52 (v1: 2,30–2,52 / 3,88).
- **Zayıf:** tam ekran ton; beyaz silüet; sayı yığını; kalıcı auralar v1 ADD parçacığı.
- **Hedef:** §3.2.

**Ayna Kalkanı.**
- **Kod:** `traps/mirror_barrier.ts`, `_mirror.ts` `mirrorDomeTB` (v1), `trapOpeningV3` (+ `mirrorGlint`).
- **Bugün:**
  - "TUZAK!" sonrası savunan tarafın **tamamını örten** dev magenta petek kubbe (ADD, yumuşak).
  - Yumuşak ışınlar; iki saldıranın ölümü **üst üste**.
  - 2000 ms'de **%98 palet dışı tam kare** (tam ekran flaş, EF-4 ihlali).
  - Kamera: tuzak açılışının eğilmesi (kalır) + kubbe eğilmesi (`mirror_barrier.ts:57`; v3'te kalkar).
  - `tbMirror-v3-a.png`, `tbMirrorP2-v3-a.png`
- **Süre:** 3,00–3,15 sn (4,08–4,80).
- **Zayıf:** bütçe 1,5–2,0'ın 1,5 katı; okunur sıra yok; savunanlar görünmüyor.
- **Hedef:** §3.3.

**Yer Yarığı.**
- **Kod:** `traps/chasm_trap.ts` `fissure` + `setpieces.chasm` (maskeyle kayma), `trapOpeningV3` (+ `floorCracks`).
- **Bugün:**
  - Önce çağırma bütünüyle oynuyor (asta cut-in dahil), sonra 317 ms'lik karar sunumu (`tb:decision`, bütün kapalı kartlar işaretlenir), sonra açılış ve yavaş v1 yarık. `tbChasm`: çağırma 1483 ms'de biter, activate 1800 ms'de başlar.
  - Kamera: tuzak açılışının eğilmesi (kalır) + kurban eğilmesi (`chasm_trap.ts:148`; v3'te kalkar).
  - `tbChasm-v3-a.png`
- **Süre:** 3,47–3,52 sn (4,03).
- **Zayıf:** çağırmayla yarık arasında boş bekleme; bütçenin 1,7 katı; v1 yarık.
- **Hedef:** §3.4. Girişin yarıda kesilmesi çağırma tabanı ya da motor değişikliği ister; bu iş A7 / veriye dayalı etki sistemine ertelendi (§7.1 risk 9).

### 2.2 Kart yüzleri (`src/art/cards.ts`, açılışta `src/boot/30-cards.ts` → `buildCardTextures`)

Bugün yüzler v1 koduyla çiziliyor; v3 görünümünde de aynı. Tek istisna: Taş Muhafız'ın resmi v3 karesinden kırpılıyor. v3 cut-in'i kart göstermez (bant + portre + ad plakası, `_v3/cutin.ts`), bu yüzden kart resmi değişikliği cut-in'e yansımaz.

**Yüz (48×68), `card:face:<id>`.**
- **Bugün:** `drawFace`:
  - `drawFrameBody`: dither'lı `vgrad`, rastgele "fırçalanmış metal" çizgileri, bevel.
  - `drawNamePlate`: sözde yazı çubukları; aslarda gökkuşağı folyo `mix()`.
  - `drawArtWindow`: aslarda folyo karışımı.
  - `drawTextBox`.
- **Kullanan:** el, uçan kart, inceleme paneli 2×, seçici, galeri. Hepsi `cardFaceKey` / `cardFaceCanvas` üzerinden.
- **Zayıf:** gürültü ve dither (IŞ-3, IŞ-10); renkler `mix()` ile palet dışına çıkıyor; sakin arenadan ayrı bir dil.
- **Hedef:** v3 çerçeve (§3.7.1).

**Resim penceresi (44×34), `card:art:<id>`.**
- **Bugün:**
  - Büyü / tuzak: `src/art/cardart/*.ts`, `artVGrad` / `artRGrad` / `artGlow` ile (dither'lı gradyan ve parıltı).
  - Canavar: `MonsterArt.portrait()` (v1). v3 Ejder ve Büyücü `portrait: v1.portrait` taşıyor.
  - Taş Muhafız v3'te portresiz: `monsterCropArt` (v3 idle karesi v1 dither'lı zemin üstünde).
  - `cards-art-v3.png`
- **Kullanan:** yüzün içi, galeri, `InspectPanelV2` (v3'te kullanılmıyor).
- **Zayıf:** IŞ-3 ihlali; eski stil; kartla sahne aynı dili konuşmuyor (A0: "sprite'tan farklı stil").
- **Hedef:** §3.7.2.

**Mini seviye (18×26) ve izometrik kart (50×30), `card:iso:<id>:<o>[:p2]`.**
- **Bugün:** `drawMiniFace`: resim 16×12'ye `downsample`; `renderFlat` / `TileCard` mip'i.
- **Kullanan:** sahadaki açık kart, mezarlık üst kartı (`PileView`), mezarlığa uçan kart (`_v3/card.ts`).
- **Zayıf:** leke; kılıç ya da volkan okunmuyor (`zoom-iso-equip.png`).
- **Hedef:** elle çizilmiş simge (§3.7.3).

**Yarım seviye (24×34).**
- **Bugün:** `halve` (2×2 çoğunluk rengi).
- **Kullanan:** küçülen ya da uçan kart (renderCard).
- **Hedef:** v3 yüzden otomatik; değişiklik yok.

**Arka yüz, `card:back` (+ iso `card:iso:back:*`, poz mip'i).**
- **Bugün:** `drawBack` (dither'lı `vgrad` / `rgrad`); iki oyuncu aynı arka yüzü kullanır.
- **Kullanan:** kapalı kartlar (statik iso, 3B poz, `dissolve`), deste ve mezarlık alt katmanları, rakibin mini eli, karıştırma hayaleti, A2 / A5 açılışlarındaki `standUp` / `layDown`. Sahada en sık görülen yüzdür.
- **Hedef:** A56.0 bütün bu yolları tek kaynağa bağlar (`cardBackV3(player)`, sözleşme S-2); A6-A ilk adımında (A1) sahip tonlu v3 arka yüzü çizer ve her yolda birden görünür. A5-B arka yüz satırlarına dokunmaz (§3.7.4).

**Bindirmeler: `card:foil`, `card:sheen`, `card:glow`, `card:glowrun`.**
- **Bugün:** geniş gökkuşağı / beyaz süpürmeler, `CardSprite` ADD ile basıyor (`CardSprite.ts:232`, `:353`).
- **Zayıf:** yumuşak parlama (`hud-v3.png`).
- **Hedef:** `foil` ve `sheen` keskin çizgi olur (§3.7.5); karışım S-5'e göre NORMAL. `glow` / `glowrun` A6-A'nındır.

**Galeri (`scenes/title/gallery.ts`).**
- **Bugün:** `cardArtKey` 1×, yüz 2×.
- **Hedef:** anahtarlar değişmeden yeni yüzleri alır.

### 2.3 Giriş portreleri

- **Kristal Ejder:** `src/art/cutins-v3/crystal_wyrm.ts`, cut-in kitinin ışıklı primitifleriyle; P2 relight var ✓.
- **Uçurum Büyücüsü:** `src/art/cutins-v3/abyss_magus.ts`, elle haritalar, 198×144, 6 kare. **P2 relight yok** (dosya başlığında "Gap (noted for A5)", REHBER §10.11): P2 aynalı P1 çizimini görüyor, ışık ekranın sağ üstünden geliyor (IŞ-1 / EF-10 ihlali). vsBot'ta bilgisayar (P2) Büyücü'yü her kurbanla çağırdığında görünür.
- **Magma Titanı, Mercan Yılanı:**
  - v3'te hâlâ v1 portreleri gösteriliyor (`src/art/cutins/*.ts`).
  - v3 sprite'ları kayıtsız (`src/art/monsters-v3/_magma_titan.ts`, `_coral_serpent.ts`; A4.1 entegrasyonu park hâlinde). Oyunda yeni portre görünemeyeceği için portreleri A4.1 entegrasyonuna taşındı (§5.4).
- **As olmayan çağırmalar:**
  - Cut-in yok. Giriş = canavarın imza girişi (Muhafız: kaya montajı; 7 eski çizim: v1 girişleri).
  - Çağrılan canavarın **adı hiçbir yerde görünmüyor**; oysa büyüler adını plakayla, tuzaklar "TUZAK!" ile söylüyor.

### 2.4 Ölçüm özeti (palet dışı piksel payı)

Ölçü: oyun alanı, y 40–290 kırpımı. Kare 0 tabanı %2,1–2,5'tir: sprite ve HUD'daki `mix()` renkleri.

| Senaryo | Ortalama | En çok | Not |
|---|---|---|---|
| `sliceBoltMagus` (çıta) | %3,3 | %6,7 | yerel, kısa |
| `sliceChainsWyrm` (çıta) | %3,7 | %4,8 | yerel |
| `spHeal` | %3,4 | %7,4 | |
| `spBladeAce` | %3,9 | %8,2 | beyaz silüet |
| `spVolcano` | **%69,9** | **%99,0** | 800 ms'den sonra sürekli tam ekran ton (`wash` + ısı rasterları) |
| `tbMirror` | %8,9 | **%98,2** | 2000 ms'de tek tam ekran kare |
| `tbChasm` | %3,2 | %5,6 | |
| `spRecallSet` | %4,7 | %8,8 | gürültü bloğu |

---

## 3. Storyboard'lar

### 3.0 Bütün sahneler için ortak kurallar

**Zaman.**
- t = 0, activate olayının başıdır (`measure` `events[].start`).
- Bütçe, girdinin geri gelmesine (`inputWaits`) kadar sayılır.
- Bütün süreler 1× içindir.

**Açılışlar.**
- A2 kitleri kullanılır: `spellOpeningV3` ve `trapOpeningV3`.
  - El: kart sahibinin yanına (`castSpot`) gider; plaka ve rün halkası çıkar. Kamera çağrısı yok.
  - Kapalı: karo ayağa kalkar (`TileCard.standUp`; arka yüzü S-2 kaynağından).
  - Tuzakta: ayağa kalkma, patlama, "TUZAK!", kartın kendi aksanı; `trapOpeningV3`'ün bugünkü eğilmesi ve 140 ms 1 px sarsıntısı kalır (K1).
- Açılışın kendisi değişmez. Yalnız eklemeler yapılır (§4.3).

**Kamera.** K1. Sahne kodu kamera çağırmaz; v3 tuzak sahneleri sonda `ctx.unfocus(320)` ile açılışın eğilmesini geri alır, v3 büyü sahneleri `relax()`'ı bugünkü gibi çağırabilir (dinlenirken işlemsiz).

**Işık.**
- Yalnız basamaklı ışık katmanı (`view/light`): `lightPool`, `lightFlash`, `lightBeam`.
- Havada parıltı yok; ışık zemine düz tonla düşer (EF-6).

**Sayılar.**
- Tek sayı, temas ya da bağ karesinde çıkar (EF-9, `_v3/number.ts`).
- Rozet `MonsterUnit.setStats(atk, def, true)` ile ≤ 400 ms'de akar.
- Kılıç ve Volkan kendi `statChange` olaylarını kendi kancalarında tüketir.
- Genel `statChange` sunumunun (`flow/stats.ts`) v3 dalı da A5-A'nındır. Aynı dili kullanır: tek sayı, yalnız kenar ışığı (tüm-sprite boyama yok), vuruşlar ≥ 150 ms arayla. Bkz. A-3b.

**Kart sürekliliği (EF-12).**
- Harcanan kart, kırılma ya da bitiş karesinde doğar ve `cardLeaves` (`_v3/card.ts`, salt okunur; mezarlık sayısı A56.0'dan beri durumdan) ile uçar.
- İki kartın inişi arasında ≥ 150 ms olur.

**Canavarın tepkisi.**
- v3 çizimi olan canavar kendi pozunu oynar (`reactHit`, ölüm kiti, `posematch`).
- Eski çizimli canavarda tüm sprite boyanmaz, ölçeklenmez, kaydırılmaz. Vuruşu sprite'tan bağımsız efekt taşır: dış konturdan 1 px kenar ışığı, buhar, kor.

**P2.**
- Yerleşim aynalanır: `castSpot`, şerit, düellocu, çapa.
- Efekt çizimlerinin ışığı ekranın sol üstünde kalır; efekt çizimleri aynalanmaz, ekran yönünde çizilir.

**Hız 2× / 3×.**
- Tek gösteri saati (A1) kullanılır. Kare atlanmaz, sesler kendi işaretlerinde çalar (SÜ-3, SE-1).
- Çok hedefli aralıklar sahne saatiyle kısalır, sıra korunur.

**Az hareket profili.**
- `REDUCED_MOTION` (`src/view/v3/motion.ts`, A56.0; `prefers-reduced-motion` ve `?motion=reduced`) her sahnede **şimdi** okunur; ayarlar menüsündeki anahtar A7'de gelir.
- Bu dalda: parçacık ×0,5, yerel titreme yok, yaşayan kart resmi f0'da durur. Süreler ≤ normal.
- Kamera zaten sabittir (K1).

**Ses.**
- Tarifler `src/audio/v3/spells.ts` içindedir (§4.6; iskelet ve kayıt A56.0'da).
- `_v3/sound.ts` `play` / `start` / `panAt` ile işarette çalar.
- Sürekli sesler, resmi bitiren işarette `stop()` ile susar (SE-2).
- Ducking: büyük vuruşta `duck` ≥ 0,55, küçükte ≤ 0,3 (SE-7).

Tablolarda **İşaret** sütunu, measure'ın ve sesin bağlandığı adlı anı gösterir.

### 3.1 Ejder Kılıcı (`dragon_blade`): "kart kılıca dönüşür, kılıç canavara bağlanır"

| ms | Vuruş | Poz / kare | Efekt | Işık | Ses | İşaret |
|---|---|---|---|---|---|---|
| 0–200 | Açılış. El: kart sahibinin yanına. Kapalı: karo ayağa kalkar. | düellocu `command` | A2 kiti | — | `spellOpen` | — |
| 200–320 | Tutuş (hold 120) | kart 1 px nefes alır | zerreler kartta toplanır | kart altında | — | — |
| 320–500 | **İNİŞ** (`landV3`). Kart tam pikselle, **döndürülmeden** kendi S/T karosuna uçar, karoda ayakta belirir ve yatar (`TileCard` `standUp` → `layDown`). | — | 1 px iz | karoda 1 ton altın | `cardPlace` (mevcut, kısa) | `land` |
| 500–620 | **DÖVME.** Yatan kartın resminden kılıç yukarı doğru kendini çizer, 3 basamakta: 1 px altın çizgi → kabza + siper → bitmiş kılıç. Kılıç: gold1–gold4 düzlemleri, ışık tarafında beyaz kenar, 1 px ink kontur. Kartın resim penceresi 2 kare sönük tona iner. Kamera eğilmesi yok (bugünkü `:260` eğilmesi v3'te kalkar). | — | 6–8 rün pikseli kılıca akar | karoda altın havuz | `bladeForge` (yükselen metal "şiing") | `forge` |
| 620–820 | **UÇUŞ.** Kılıç önceden çizilmiş 3 açıdan (dik, 45°, yatık) uçuş yönüne en yakını seçilerek canavara doğru bir yay çizer. | — | 2 px altın iz (tam piksel) | — | `bladeFly` | — |
| 820 | **BAĞ.** Kılıç canavarın "kuşanma çapasında" durur (P1: gövde kutusunun sol üstü, sırtın arkası; P2: aynası). 1 karelik beyaz kenar **yalnız kılıçta** yanar. Bel hizasında 1 px altın rün halkası 60 ms'de, 3 adımda saat yönünde kapanır. Aynı karede tek "+700" sayısı; rozet akar. | v3 çizim: `victory` ileri oynar, tepe karesinde 160 ms tutulur, geri f0'a döner (yeni kare yok, poz sıçraması yok). Eski çizim: poz yok. | 4–6 altın kıvılcım | canavar ayağında altın havuz: 2 kare parlak, sonra 1 ton kalıcı | `bladeBond` (örs çınlaması + alçak kabarma, duck 0,45) | `bond` |
| 820–1300 | Yerleşme. Kılıç 1 px aşağı-yukarı süzülmeye başlar (400 ms periyot). | v3: `victory` geri dönüşü | — | — | — | — |
| ≤ 1500 | Girdi geri gelir. | | | | | |

**Kalıcı durum** (v3 aura `equip`; `auras.ts` → `auras-v3.ts`):
- Canavarın yanında küçük süzülen kılıç: yaklaşık 7×20 px, iki ışık tarafı için ayrı çizim.
- 400 ms'de 1 px salınım.
- Yaklaşık 2 sn'de bir kenardan tek bir parıltı iner (IŞ-8: 1 px → haç → 1 px, 3 kare).
- Canavarın ayağında 1 tonluk altın ışık.
- `FieldView.sync` de bu aurayı kurar (aynı `equipAura` fabrikası). Sahneyi yeniden kurmak durumu korur.

**Kırılma** (`destroyed`, v3 dalı):
- Kılıçta 2 karelik beyaz çatlak çizgisi.
- 6–8 tam piksel altın kıymık yere düşer, basamaklı söner (EF-7). Halka kopar.
- Kuşanma kartı karosundan `cardLeaves` ile gider.
- Rozet geri akar; tek "−700" sayısı.
- Ses `bladeBreak`.
- Yıldırım Hükmü bağlı canavarı öldürürse (`spBoltAce`), bolt'un kendi `equipLeaves` sırası korunur. Auranın `dispose`'u kılıcı kıymıklara ayırır.

**Özel durumlar:**
- **Savunmadaki canavar** (`spBladeDef`): poz yok, savunma döngüsü sürer. Halka, ışık ve sayı yine gelir.
- **Kapalı kart** (`spBladeSet`): kart zaten karodadır. İNİŞ yerine karo ayağa kalkar ve yatar, sonra DÖVME gelir.
- **P2** (`spBladeP2`): çapa aynalı, kılıç çizimleri ışığı sol üstte tutar.
- **Hedef süre:** ≤ 1,5 sn (bugün 2,0–2,1). Büyücü etkisiyle kırılma (`spBladeBreak`) ≤ 1,6 sn; Büyücü etkisi bütçesidir.

### 3.2 Volkan Arenası (`volcano_arena`): "zemin kontrollü dönüşür, güç iki yöne değişir"

| ms | Vuruş | Poz / kare | Efekt | Işık | Ses | İşaret |
|---|---|---|---|---|---|---|
| 0–300 | Açılış (alan büyüsü yalnız elden gelir), hold 100 | düellocu `command` | A2 kiti | — | `spellOpen` | — |
| [Değiştirme] 300–600 | Eski alan kartı karosunda 2 kare beyaz çatlak; kül tonlarında tam piksel ufalanır; kartı sahibinin mezarlığına gider (`cardLeaves`). Yeni kart ancak bundan sonra iner; değiştirmede aşağıdaki bütün zamanlar +300 ms kayar. | — | ufalanma | — | `volcanoCool` (kısa) | `replace` |
| 300–480 | **İNİŞ.** Kart döndürülmeden alan karosuna iner ve yatar. Ped 3 kare ateş rampasında yanar. | — | basamaklı karo parlaması | — | `volcanoSlam` | `land` |
| 480 | **PATLAMA.** Pedde kısa lav sütunu: 8 px geniş, 24 px yüksek; 3 kare çıkar, 3 kare iner; fire1–fire4 bantları, 1 px beyaz çekirdek; kontur yok (ışıktır). 6–10 tam piksel lav damlası ≤ 30 px yay çizer. Pedde 2 halkalı basamaklı şok. Sakin arenanın lavı bu karede alan karosundan yayılmaya başlar (`setTheme('volcano', true, oyuncu)`, değişmez). Kamera eğilmesi yok (bugünkü `:249` eğilmesi v3'te kalkar). | — | sütun, damla, şok | `lightFlash` ateş; sonra pedde soluk, kalıcı `lightPool` (`breathe`) | `volcanoErupt` (duck 0,6); `lavaCreep` başlar (sürekli) | `erupt` |
| 480–≈1500 | **CEPHE.** Lav cephesi etkilenen bir canavarın karosuna vardığında o canavarın vuruşu gelir. Sıra uzaklığa göredir; iki vuruş arası en az 150 ms. Vuruşlar aşağıda. | aşağıda | aşağıda | canavar pedinde 1 ton | aşağıda | `front:<uid>` |
| son vuruş + 120 | `lavaCreep` 120 ms'de susar. Girdi geri gelir. | | | | | |

**Cephedeki vuruşlar:**

- **ATEŞ (+500).**
  - Ayaktan başa 3 basamakta 1 px ateş kenarı tırmanır: fire2 → fire3 → fire4. Yalnız silüetin dış kontur maskesindeki kenar pikselleri boyanır, gövde boyanmaz.
  - 4–6 kor pikseli yukarı fırlar.
  - v3 çizimi varsa `roar`'un ilk 2–3 karesi ileri-geri oynar. Eski çizimde poz yok.
  - Kenarın tepe karesinde tek "+500" (buff); rozet akar.
  - Ardından kalıcı v3 alev dilleri başlar.
  - Ses `heatFlare`.
- **SU (−300).**
  - Gövdenin üst kenarından 3–4 buhar teli yükselir: 1 px geniş, 3–5 px boy, steel / mist / white basamakları, tam piksel adımlar.
  - v3 çizimi varsa hafif `hit`'in ilk 2 karesi oynar. Eskide poz yok; tüm-sprite gri parlama **yok**.
  - Tek "−300" (debuff); rozet iner.
  - Ardından kalıcı v3 buhar aurası başlar.
  - Ses `steamHiss`.
- **Diğer nitelikler:** vuruş yok.

**Kalıcı alan durumu:**
- Sakin arenanın lavı kalır (`BoardViewCalm`, değişmez).
- v3 auralar eklenir:
  - Alev dilleri: canavarın üst kenarında 2–3 noktada 3 karelik döngü, fire rampası, tam piksel.
  - Buhar: yaklaşık 600 ms'de bir tel.
- Alan pedinde soluk ateş ışığı kalır.
- **Tam ekran ton yok.** v3'te (`V3_A5_A`) `setVolcanoAmbience` başındaki tek satırlık yönlendirmeyle `spells/_volcano_v3.ts`'e gider: `wash` dikdörtgeni ve altı ADD ısı rasterı **kurulmaz**; yalnız palet renginde, tam piksel kor ve kül parçacıkları çizilir. `volcanoAmbienceOn` sözleşmesi korunur (`DuelScene` her senkronda çağırır).
- Hedef: `palcheck` bugün %89–99 → ≤ taban + 1 puan.

**Serinleme** (`spVolcanoCool`, Büyücü alanı yok eder):
- Lav sakin arenada basamaklarla soğur (değişmez).
- Alev dilleri 3 basamakta küçülüp 2 duman pikseline döner; buhar durur.
- Rozetler tek sayılarla geri akar.
- Ses `volcanoCool`. Hedef ≤ 1,6 sn.

**Hedef süreler ve P2:**
- `spVolcano` ve `spVolcanoP2` ≤ 1,9 sn (4 etkilenen canavar).
- `spVolcanoReplace` ≤ 2,2 sn. **Bütçe artışı +0,2 sn**; gerekçe: iki kartın sürekliliği sırayla görünmeli (eski kart gider, yeni kart iner).
- Vuruşlar lav cephesinin varışına bağlıdır. Cephe hızı ölçülür; bütçe aşılırsa vuruş aralığı 150 ms tabanına çekilir, cephe değiştirilmez.
- P2 aynalıdır; alan karosu P2'nin.

### 3.3 Ayna Kalkanı (`mirror_barrier`): "çok hedef, okunur sıra"

| ms | Vuruş | Poz / kare | Efekt | Işık | Ses | İşaret |
|---|---|---|---|---|---|---|
| 0–300 | Açılış: ayağa kalkma, "TUZAK!", `mirrorGlint`; `trapOpeningV3`'ün eğilmesi (kalır). Saldıran, ilanın şarj tutuşunda bekler (A2 düzeni). | saldıran şarj tutuşunda | A2 kiti | — | `trapOpen` | — |
| 300–520 | **PANEL.** Saldırı şeridinde, savunana yakın üçte birde (doğrudan saldırıda düellocunun önünde) 7 hücreli (2-3-2) dik petek ayna paneli kurulur. Hücreler yaklaşık 9×10 px; ortadan dışa, 4 adımda, 50 ms arayla. Her hücre: 1 px mag2 çerçeve, mag3 yüz, üst-sol kenarlarda 1 px mist / white vurgu, 2×1 beyaz parıltı. Panel ≤ 40 px yüksektir; savunanın silüetini ≤ %50 örter (EF-2). Kubbe eğilmesi yok (bugünkü `:57` eğilmesi v3'te kalkar). | — | hücre hücre kurulum | panel altında magenta havuz | `mirrorRaise` (basamaklı cam tıkırtısı arpeji) | `raise` |
| 520–700 | **YAKALAMA.** Saldıran kendi saldırısını salma karesine kadar oynar (v3: attack işaretleri; eski: `attackImpactFrame`). Mermi ya da gövde panele çarpar. Temas karesinde 60 ms hit-stop. Çarpılan hücre 2 kare beyaz; komşular halka halka bir ton yukarı-aşağı (3 karelik dalga). | saldıranın kendi saldırısı | hücre dalgası | — | `mirrorCatch` (duck 0,45) | `catch` |
| 700… | **YANSIMA, sırayla.** Saldıran tarafta saldırı pozisyonundaki her canavar için, panele en yakın olandan başlayarak: çarpılan hücreden bir ışın çıkar (3 px mag3 gövde, 1 px beyaz çekirdek, sert baş) ve 120 ms'de canavarın çekirdeğine varır. Temas = o canavarın kendi ölümü (destroy → v3 ölüm kiti ya da eski canavarın sınırlı ölümü). Sonraki ışın, bir öncekinin temasından 220 ms sonra çıkar. | kurbanın kendi ölümü | ışın | ışının şeridinde kısa `lightBeam` | `mirrorBeam` (her kurbanda bir basamak yukarı) | `beam:<i>` |
| son temas + 120 | **KIRILMA.** Her hücre 2–3 tam piksel kıymığa bölünür, 8–14 px dışa kayar, basamaklı söner. | — | kıymıklar | — | `mirrorBreak` (duck 0,4) | `break` |
| sonra | Tuzak çıkışı (`trapExitV3`): kart yatar, mezarlığa gider; kamera `ctx.unfocus(320)` ile döner. Son kurbanın kartı indikten ≥ 150 ms sonra; çıkış sonuçtan sonra gelir (A0 §1.2 #11). | | | | | `exit` |

- **Bütçe artışı (adıyla):** Tuzak bütçesi 1,5–2,0 sn. Ayna Kalkanı için: 1 kurban ≤ 2,1 sn; her ek kurban +0,25 sn; en çok 2,6 sn (3 kurban).
  - Gerekçe: her ölüm kendi pozuyla ve kendi kartıyla görünmeli; kartlar ≥ 150 ms arayla inmeli; tuzak kartı sonuçtan sonra gitmeli.
  - Bugün iki ölüm üst üste ve süre 3,0–3,15 sn.
- **Tam ekran flaş yok.** Bugün 2000 ms'de %98 palet dışı tam bir kare var.
- **P2:** panel şeridin aynası.
- **Doğrudan saldırı:** panel düellocunun önünde, tek yansıma.

### 3.4 Yer Yarığı (`chasm_trap`): "çağrılanı yer yutar" (çağırmanın hemen ardından)

**A6 ile birlikte:** CPU ya da senaryo yanıtlı çağırma penceresinde A6-B'nin karar sunumu ≤ 120 ms'dir ve kart işaretlemesi yapmaz (sözleşme S-15, `A6_MS.decisionFast`). Böylece çağırmanın bitişinden yarığın ilk karesine ≤ 300 ms kalır (bugün: çağırma sonu → activate 317 ms, sonra yavaş v1 açılış). İnsan yanıtında (istem) bekleme doğaldır. **Girişin yarıda kesilmesi** bu plan kapsamında değildir: giriş (asta cut-in dahil) karar penceresinden önce oynar; kesmek çağırma tabanı ya da motor değişikliği ister ve A7 / veriye dayalı etki sistemi işine ertelenmiştir.

| ms | Vuruş | Poz / kare | Efekt | Işık | Ses | İşaret |
|---|---|---|---|---|---|---|
| 0–300 | Açılış (`trapOpeningV3`, eğilmesi kalır). `floorCracks` aksanı yarığın başlangıcı olur; ayrı bir vuruş değildir. | — | A2 kiti | — | `trapOpen` | — |
| 150–400 | **YARIK.** Tuzak karosundan kurbanın pedine ≤ 250 ms'de keskin bir yarık koşar: 1 px ink çekirdek çizgi, iki yanında 1 px mag3 ışık pikselleri, tam piksel kırık yol. Başında küçük moloz pikselleri fırlar. | kurban bekler | yarık + moloz | yarık boyunca kısa, basamaklı çizgi ışığı | `chasmCrack` | `crack` |
| 400 | **AÇILMA.** Kurbanın pedi 3 levhaya bölünür: düz tonlu izometrik çokgenler, night2 / night3 yüz, ink yanlar. Levhalar 2 adımda 2–4 px aşağı eğilir. Delik ink; kenarında 1 tonluk magenta ışık. Kurban eğilmesi yok (bugünkü `:148` eğilmesi v3'te kalkar). | v3 çizim: `hitHeavy` vurulma karesi 2 kare tutulur. Eski çizim: v1 `hit` karesi. | levhalar, delik | delikte 1 ton magenta | `chasmOpen` (duck 0,6) + kurbanın malzeme darbesi | `open` |
| 430–730 | **DÜŞÜŞ.** Gövde tam piksel adımlarla düşer (2, 4, 7, 11, 16… px/kare). Ön kenar maskesiyle deliğe girerek kaybolur; solma yok. 4–6 kaya kırığı ardından yuvarlanır. Basamaklı toz, alfa yok. | düşen gövde | kırık + toz | — | `chasmFall` | — |
| 750 | **KAPANMA.** Levhalar 2 adımda yerine oturur. 1 karelik beyaz dikiş çizgisi, 2 basamaklı toz halkası. Karoda yerel 1 px titreme; kamera değil. Kurbanın kartı izde doğar (2 kare 1 px beyaz çerçeve) ve mezarlığa uçar (≈ 1,05–1,1 sn'de iner). | — | dikiş + toz | — | `chasmShut` (duck 0,5) | `shut` |
| ≥ +150 | Tuzak çıkışı (`trapExitV3`, ≈ 1,35 sn'de iner); kamera `ctx.unfocus(320)` ile döner. | | | | | `exit` |

- **Hedef süre:** activate'ten ≤ 1,7 sn (bugün 3,47–3,52).
- **Ölçü (yeni):** `a5ChasmWyrm` ve `tbChasm`'da iki aralık ölçülür: (a) çağırma işleyicisinin bitişi → `crack` işareti ≤ 300 ms (A56.Z'de bütün şeritler açıkken; şerit kapısında A6 kapalıyken bugünkü 317 ms'lik karar bekler, bu beklenir); (b) çağrılanın inişi (çağırmanın `land` işareti) → `crack` işareti: ölçülür ve raporlanır, hedef konmaz (girişin uzunluğuna bağlıdır; kesmek ertelendi).
- **Kurbanın ölümü:** kurbanın kendi `destroyed` kancaları bugünkü gibi çekilir (`sourceOwnsDeath`); kurbanın ölümü düşüştür.
- **P2:** aynalı. Kurbanlı çağrılmış Titan'da (`tbChasmBig`) yanma etkisi hiç çözülmez (motor).

### 3.5 Şifa Pınarı (`healing_spring`): "kontrollü iyileştirme akışı, düellocunun kendisinde"

| ms | Vuruş | Poz / kare | Efekt | Işık | Ses | İşaret |
|---|---|---|---|---|---|---|
| 0–320 | Açılış, hold 120 | düellocu `command` | A2 kiti | — | `spellOpen` | — |
| 320–470 | **BIRAKMA.** 2 karelik beyaz silüet. Küre kartın **alt** kenarından çıkar (`releaseFrom: 'bottom'`, yeni) ve 150 ms'de kartın altındaki rün halkasına (`castFloor`) düşer. Kapalı kartta küre kendi karosuna iner. | — | küre (`energyStreakV3`) | — | `whoosh` (A2) | `release` |
| 470 | **FIŞKIRMA.** Pınar 3 karede 0 → 14 → 26 → 34 px yükselir. Sütun 5 px geniş: 1 px beyaz çekirdek, ekranın solunda water4 / teal4 aydınlık bant, sağda teal2, dış kenar teal1; kontur yok. Tepede 3 damla. Havuz pedde 2 halkalı izometrik elips olarak açılır (teal3 / teal2, basamaklı). | — | sütun + havuz | havuzda `caustic` basamaklı teal ışık | `springRise` (köpüren kabarış + 3 kısa "blip") | `erupt` |
| 520–820 | **DAMLALAR.** Tepeden 50 ms arayla 6 damla (2×2: beyaz çekirdek + water4) kısa yaylarla düellocunun göğsüne düşer. Her inişte düellocuda 1 karelik "+" parıltısı. | düellocu 3. damlada `victory` | damlalar | — | 6× `springDrop` (her damla bir basamak yukarı: "doluyor") | `drop:<i>` |
| 570 | İlk damlada `lpGain` teslim edilir: `ctx.play(li, { delivered: true })` → A6-B'nin LP sunumu (`V3HOOKS.presentHeal`, ≤ 400 ms; sözleşme S-14). | | | | | `heal` |
| 820–1100 | **SÖNME.** Sütun 3 basamakta çöker (34 → 20 → 8 → 0). Havuz 2 halka dışa yayılıp rampada basamak basamak söner. Harcanan kart pedde doğar ve `cardLeaves` ile gider. | — | — | havuz söner | `springSettle` | `settle` |

- **Hedef süre:** ≤ 1,4 sn (bugün 1,72).
- **Yer:** pınar tahtanın dışında, düellocunun yanındadır. Hiçbir canavarı örtmez. Kapalı kartta kartın kendi karosundadır (S/T sırası; sütun ≤ 34 px, arkadaki canavarın ≤ %50'si).
- **P2:** `castSpot` / `castFloor` aynalı (sağ üst); damlalar P2 düellocusuna gider.

### 3.6 Ruh Çağrısı (`soul_recall`): kalan işler

1. **Kapalı karttan bırakma.** `_kit.ts` `release()` içindeki kapalı kart dalında 260 ms'lik `TileCard.dissolve` gürültü bloğu kalkar. Yerine elden bırakmadaki gibi kartın pikselleri küreye akar: `collapseInto`'nun TileCard sürümü, o anki poz piksellerini `TileCard.currentPixels()`'tan alır (sözleşme S-3, A56.0; `TileCard` A6-A'nın dosyasıdır, A5 yalnız çağırır). Etkilenen senaryolar: `spRecallSet`, `spHealSet`, `sliceMagusReviveSet` (yalnız o 260 ms).
2. **Büyünün kendi sesi.** v3'te v1 `revive` / `whoosh` yerine `recallOpen` (mezar açılır: alçak kovuk ses + çan) ve `recallGlide` (havalı süzülme + seyrek pırıltı). v3 canavarlarının karakter sesleri değişmez. `recallV3`'ün eğilmesi (`soul_recall.ts:843`) kalır.
3. **Kart resmi** A5-B'dedir.

Süreler değişmez: 1,45–1,60 sn (≤ 2,1).

### 3.7 Kart yüzü v3 (A5-B)

**3.7.1 Çerçeve (20 kartın hepsi).**

Ölçü ve bölge yerleşimi aynı kalır: 48×68; ad plakası (2,2) 35×8; yıldız / ikon satırı y 11; resim (2,17) 44×34; metin kutusu (2,52) 44×14. Böylece el, `CardSprite`, `TileCard` ve mip geometrisi değişmez.

Çerçevenin tonları ve taban boyacısı ortak `src/art/frame-v3.ts`'tedir (`FRAME_V3`, `frameRectV3`; A56.0, dondurulmuş; sözleşme S-1). A6-A'nın arka yüzü ve A6-B'nin HUD kabuğu aynı boyacıyı kullanır; böylece kart, arka yüz ve HUD tek aile olur. A5-B kartın kendi parçalarını (`cardface-v3/frame.ts`) bunun üstüne kurar:

- **Gövde:**
  - 1 px ink dış kontur, köşeler bugünkü gibi kırpık.
  - İçte iki düz bant: night1 (üst, aydınlık) ve night0.
  - Fırçalanmış metal gürültüsü ve dither yok.
- **Tür çizgisi** (sakin arenanın tek neon kenar şeridi gibi, tek trim):
  - canavar gold2 / gold3, büyü teal2 / teal3, tuzak mag2 / mag3;
  - 1 px; üst ve sol kenarda bir ton açık, alt ve sağda bir ton koyu (ışık sol üstte, IŞ-1).
- **As:** aynı gövde, 2 köşede 3 px'lik altın L süsü. Resim penceresinde gökkuşağı karışımı yok.
- **Ad plakası:**
  - night0 zemin; mist / steel sözde yazı çubukları. 1×'te okunmaz; adı inceleme paneli söyler.
  - Aslarda tek gold3 çizgi.
- **Yıldız / ikon satırı:** bugünkü glifler; ink kontur ve tek ışık pikseli.
- **Resim penceresi:** 1 px ink çerçeve; üst ve sol kenarda tür tonu (aydınlık), alt ve sağda koyu.
- **Metin kutusu:**
  - night0 zemin, night3 sözde satırlar.
  - ATK / DEF rakamları white / mist (bugünkü rakam yazısı); ikonlar fire4 / water3.
- **Renkler yalnız `PAL`'dan.** Testle denetlenir (§6.5; eski resimlerin penceresi hariç).
- Çerçeve tonlarında bir değişiklik gerekirse (örn. kontrol noktasından sonra) `frame-v3.ts`'i orkestratör değiştirir; A5-B kendi dosyasında kopya ton tanımlamaz.

**3.7.2 Resimler (44×34).**

IŞ kuralları uygulanır:
- tek anahtar ışık sol üstte;
- biçim başına 2–4 düz bant; gradyan ve dither yok;
- maddede 1 px ink kontur; ışık konturlanmaz;
- yalnız `PAL`, ≤ 20 renk;
- yalıtık piksel ≤ %10 (IŞ-10).

**Büyü / tuzak (8).** Her biri oyundaki v3 efektiyle aynı imgedir; kart ile sahne tek dili konuşur:

- **Yıldırım Hükmü:** `stormStrike` v3'ün düz tonlu piksel bulutu; 3 px beyaz çekirdekli zikzak ve 1 px çatallar; yere değdiği yerde küçük yıldız.
- **Işık Zincirleri:** `_chains` v3 halkaları (gold2–gold4 düzlemli, ink kontur) bir silüeti çapraz bağlar; arkada 1 ton magenta.
- **Şifa Pınarı:** §3.5'in basamaklı sütunu, havuz, 3 damla.
- **Ruh Çağrısı:** açılmış mezar (taş levha, düz tonlar) ve yükselen cyan hayalet (v3 hayaletinin opak palet tonlarıyla).
- **Ejder Kılıcı:** §3.1'in kılıcı (dik), rün halkası, altın ışık.
- **Volkan Arenası:** sakin arena pedleri izometrik; dikişlerde fire tonlarında lav; ortada kısa lav sütunu.
- **Ayna Kalkanı:** §3.3'ün petek paneli; bir ışın çarpıp yansır.
- **Yer Yarığı:** §3.4'ün 3 levhaya bölünen pedi, delik, düşen bir silüetin kuyruğu.

**Canavarlar (3: Ejder, Büyücü, Muhafız).** Kaynak, onaylı sabit karelerdir: `src/still/{wyrm,magus,sentinel}.ts` (`drawWyrm(p)` …), salt okunur.

- **Yöntem:** 1:1 büst kırpımı (ölçek yok) üstüne v3 kart sahnesi:
  - düz tonlu gece bandı, bir ufuk / ped çizgisi;
  - arkada 2–3 basamaklı nitelik ışığı;
  - gölge tarafında nitelik renginde 1 px kenar ışığı (IŞ-7);
  - kırpma kenarlarına elle rötuş: kesilen uzuv çerçevede biter.
- **Kırpımlar:**
  - Ejder: baş + boyun + kanat kenarı.
  - Büyücü: kask + göğüs + asa küresi.
  - Muhafız: miğfer + omuz + kalkan üstü.

**Kural (yüzlerce karta ölçeklenir): kart resmi, canavarın çizim kuşağını izler.**
- `monsterArtV3(id)` kayıtlıysa v3 resmi (sabit kareden) gösterilir, değilse eski resim.
- 7 eski çizimli canavar ile kayıtsız Titan / Yılan eski resimleriyle v3 çerçevenin içinde kalır. Her canavar kendi kuşağıyla tutarlıdır: tahtadaki eski sprite ↔ eski resim. Çerçeve 20 kartı tek aile yapar; iki stil kırık görünmeden yan yana durur.
- Titan ve Yılan resimleri A4.1 entegrasyonunda, sprite'larıyla aynı gün yapılır (§5.4); yöntem bu varsayılan yoldur.
- İleride gelecek sıradan canavarlar için varsayılan da aynıdır: sabit kare kırpımı + nitelik sahnesi. Elle resim yalnız as ve büyü / tuzaklara yapılır.

**3.7.3 Saha simgeleri (mini seviye, 18×26).**
- 11 kart için elle çizilmiş 16×12 simge:
  - büyü / tuzakta imgenin en okunur parçası: kılıç, volkan, petek, zincir halkası, yarık, damla, hayalet, şimşek;
  - 3 canavarda sabit kareden 1:1 baş kırpımı.
- 7 eski kart (ve Titan / Yılan) bugünkü küçültmeyle kalır.
- Mini çerçeve: night gövde + 1 px tür çizgisi (`FRAME_V3`).
- İzometrik dokular (`card:iso:*`) bu seviyeden üretilir. Mezarlık üst kartı ve mezarlığa uçan kart da otomatik yenilenir.

**3.7.4 Arka yüz (A6-A'nın; tek kaynak).**
- v3 arka yüzü A6-A çizer: `src/view/v3/cardBack.ts` `cardBackV3(player)`, sahip tonlu (A6 planı K4). Kaynağın kendisi (`cardBackCanvas(player)`, `cardBackKey(player)`, `cardMip('back', player)`, oyuncuya göre iso arka yüz) A56.0'da `cards.ts`'e bağlanır ve **dondurulur**; A5-B bu satırlara dokunmaz.
- Arka yüz de `frame-v3.ts`'in dilini kullanır: gövde tonları, trim kuralı, kontur, köşe kırpımı.

**3.7.5 Bindirmeler.**
- `card:foil` (as) gökkuşağı yerine 1–2 px keskin altın / beyaz çapraz parıltı çizgisi olur. Aynı anahtar, aynı kare sayısı (`SHEEN_FRAMES`).
- `card:sheen` 1 px olur.
- Dokular saydam zemin üstünde **opak palet pikselidir**. A56.0, `CardSprite`'ın `sheen` / `foil` görüntüsünü `CARD_OVERLAY_BLEND`'e bağlar: `V3_A5_B` açıkken NORMAL, değilse bugünkü ADD (sözleşme S-5). Böylece G2'nin palet ölçüsü A6'nın sırasına bağlı kalmaz.
- `card:glow` / `card:glowrun` (oynanabilir kart vurgusu) A6-A'nındır; dokunulmaz.

**3.7.6 Yaşayan resim (S2; varsayılan evet).**
- 11 yeni resimde 6–8 karelik döngü, kare başına 125–150 ms bekleme.
- Teknik: palet döngüsü ve ≤ 2 px hareket.
- Kart başına hareket:
  - şimşek titrer; su bantları akar;
  - hayalet 1 px süzülür ve göz kırpar;
  - kılıçtan parıltı iner; lav dikişlerde döner;
  - petek hücreleri sırayla parlar; zincir halkaları sırayla parıldar; yarık nabız atar;
  - Ejder'in gözü ve kristal parıltısı, Büyücü'nün küresi, Muhafız'ın rünü.
- Gösterim:
  - `card:face:<id>` aynı anahtarla `CanvasTexture` olur.
  - Tek bir saat, gösteri saatinden okur; donmuş QA saatinde deterministiktir.
  - Kare değiştiğinde resim penceresini yeniden boyar ve `refresh()` eder. Yalnız kare değişince boyar.
  - Yüzü bu dokudan gösteren her yer (el, inceleme paneli, seçici, galeri) hiçbir görünüm dosyası değişmeden canlanır.
  - A6-A'nın `CardV3`'ü dururken `card:face:<id>` dokusunu gösterir; kendi kopyasını yaparsa A5-B'nin `cardLifeFrame(id, tMs)` ve `cardFaceCanvasAt(id, f)` işlevlerini çağırır (sözleşme S-13).
  - Sahadaki izometrik kart sabit kalır (simge).
- `REDUCED_MOTION`'da f0 gösterilir.

**3.7.7 P1 / P2.** Kart düz bir nesnedir; resim yeniden ışıklandırılmaz, ışık resmin içinde sol üsttedir.

### 3.8 Girişler

**Uçurum Büyücüsü P2 (A5-B, B-9; eski A-9).**
- `cutins-v3/abyss_magus.ts`'e `draw(p, f, { lightFrom: 'right' })` yolu eklenir.
- Her haritalı plakada ışık tarafının tonları yer değiştirir (aydınlık ↔ gölge, IŞ-2: `_L` / `_R`).
- Kendi ışığı olan pikseller (gözler, küre, alev) aynı kalır.
- `p2: 'relight'` eklenir. Boot adımı (`25-cutins.ts`) relit kareleri zaten tembel boyuyor; değişiklik gerekmez.
- Denetim:
  - `?dev=cutin&id=abyss_magus&player=2&look=v3` ×2'de aydınlık düzlemler ekranın sol üstüne bakar.
  - `suMagus`'un P2 çeşidi (`a5MagusCutinP2`) A5-B'nin `a5-cards.ts` paketine eklenir ve filme alınır.

**Magma Titanı ve Mercan Yılanı.** A4.1 entegrasyonuna taşındı (§5.4). Oradaki iş için not: portre cut-in kitinin ışıklı primitifleriyle çizilir (P2 relight bedava gelir), doğal yoğunlukta 198×144, 5–6 kare; Titan ritmi `RHYTHM`'deki 300 / 430 / 740, Yılan için öneri 280 / 380 / 700; kaynak sabit kare haritalarının düzlem kararlarıdır (REHBER §2.3).

**As olmayan normal çağırma: "giriş damgası" (B-8; zorunlu).**
- İnen canavarın adı, büyü plakasıyla aynı dilde (`_kit.ts` `namePlate`, A-1'de dışa aktarılır; sözleşme S-11) karonun altına ≤ 0,4 sn damgalanır:
  - nitelik renginde 1 px çizgi;
  - harfler kare başına bir gelir.
- Karartma yok, bant yok; çağırma süresine eklenmez (girdi kilidi uzamaz).
- Uygulama yeni bir dosyadır (`src/cinematics/_v3/entrystamp.ts`, `registerObserver` ile; `V3_A5_B`). Çağırma tabanına (`_v3/summon.ts`) ve A6'nın dosyalarına dokunmaz. A6'nın kayıt testi yalnız A6'nın işleyici adlarını sayar (A6 §6.4).
- Kapsam: elden normal çağırma ve as olmayan kurbanlı çağırma. As (cut-in'i var), çevirme (kart zaten açılıyor), diriltme ve özel çağırma dahil değildir.
- Gerekçe: oyuncu neyin çağrıldığını büyü / tuzaktaki gibi okur; her as olmayan çağırmada görünür. Kamera ve süre kurallarını bozmaz.

---

## 4. Bir kez yapılacak ortak parçalar

**4.1 `src/cinematics/_v3/spellfx.ts` (yeni, A5-A).** Sahnelerin ortak, sprite'tan bağımsız efektleri:
- basamaklı sütun (su / lav);
- damla yayları;
- dış kontur maskesinden tırmanan 1 px kenar ışığı (eski çizimlerde de çalışır);
- buhar telleri, korlar;
- tam piksel kıymık ve basamaklı sönme;
- önceden çizilmiş açı karelerinden seçim (kesirli döndürme yerine);
- ped levhalarına bölünme + ön kenar maskesi;
- petek hücresi çizimi ve hücre dalgası.

Hepsi `Raster` / `PxSparks` üstünde, tam pikselle, yalnız palet tonlarıyla çalışır.

**4.2 Motifler: `src/art/spellmotifs-v3.ts` (yeni, A5-A; A5-B salt okur; sözleşme S-12).**
- Saf `PixelCanvas` boyacıları: kılıç (3 açı × 2 ışık), petek hücresi, zincir halkası, pınar sütunu, lav sütunu, yarık levhası.
- Sahne ve kart resmi aynı çizimi kullanır.
- A-1'de ilk iş yazılır. A5-B'nin büyü / tuzak resimleri (B-3) buna bağlıdır; B-3 başladığında A-1 bitmiştir (B-1 + B-4 ≈ 6,5 sa, A-1 ≈ 4 sa).

**4.3 `src/cinematics/spells/_kit.ts` ekleri (A5-A).** Bolt ve recall'un bugünkü yolları değişmez.
- `landV3`: döndürmesiz; `TileCard` ile ayakta belirip yatma.
- `releaseFrom: 'bottom'`.
- Kapalı kart bırakmasında piksel akışı (§3.6, `TileCard.currentPixels()`).
- `namePlate` dışa aktarımı (davranış aynı).

**4.4 v3 auralar (A5-A).**
- `src/duel/auras-v3.ts` (yeni) ve `auras.ts`'te `V3_A5_A` yönlendirmesi: `equip` (süzülen kılıç), volcano FIRE (alev dilleri), volcano WATER (buhar telleri).
- `FieldView.sync`, `flow/stats.ts` ve `_defaults/battle.ts` aynı fabrikayı çağırdığı için, onlara dokunmadan v3 aurayı alırlar.

**4.5 `setVolcanoAmbience` v3 dalı (A5-A).**
- `vfx/setpieces.ts`'te bu fonksiyonun başına tek satırlık yönlendirme eklenir: `spells/_volcano_v3.ts`.
- v3 dalı `wash` dikdörtgenini (`setpieces.ts:2466`) ve altı ADD ısı rasterını kurmaz; yalnız palet renginde kor ve kül çizer.
- `volcanoAmbienceOn` sözleşmesi korunur; `DuelScene` her senkronda bunu çağırıyor.

**4.6 Ses modülü: `src/audio/v3/spells.ts` (A5-A doldurur; iskelet ve kayıt satırları A56.0'da).**
- Dışa aktarır: `V3SpellSfxName`, `V3_SPELL_RECIPES`, `V3_SPELL_SUSTAINED`.
- Kayıt dikişleri (`sounds.ts` yayma satırı, `sfx.ts` tip birleşimi + `import type`) A56.0'da bir kez yazılır; A5-A bu iki dosyaya dokunmaz. Ad listesi A56.0'da iskelete yazılır; yeni ad gerekirse A5-A kendi modülünde ekler (birleşim `keyof typeof` ile büyür).
- `audio/v3/kit.ts` blokları kullanılır; yeni DSP yazılmaz (SE-3 ruhu). Eksik küçük bir yardımcı gerekirse `spells.ts` içinde yerel yazılır; `kit.ts`'e (A2) dokunulmaz.

| Ad | An | Tını (kit blokları) | duck |
|---|---|---|---|
| `springRise` | Şifa: fışkırma | köpük `sweep` + 3 sinüs "blip"; La pentatonik A4–E5 (Ejder'in E6–B7 camından uzak) | 0,3 |
| `springDrop` | Şifa: damla (×6) | sinüs "bloop" (perde −%15 düşer); her damla bir basamak yukarı | — |
| `springSettle` | Şifa: sönme | alçak su çarpması (`puff`, lp 900 Hz) + kısa halka | — |
| `recallOpen` | Ruh: mezar açılır | alçak kovuk ses (yumuşak `growl` formantı) + tek çan (`clank`, yumuşak) | 0,3 |
| `recallGlide` | Ruh: süzülme | pembe gürültü `sweep` + seyrek pırıltı | — |
| `bladeForge` | Kılıç: dövme | yükselen metal "şiing" (`clank`, yükselen `sweep`) | 0,2 |
| `bladeFly` | Kılıç: uçuş | `sweep` + metal halka kuyruğu | — |
| `bladeBond` | Kılıç: bağ | örs: `clank` + `thump` + alçak kabarma | 0,45 |
| `bladeBreak` | Kılıç: kırılma | `crack` + `link` tıngırtısı | 0,3 |
| `volcanoSlam` | Volkan: iniş | `thump` + çıtırtı | 0,3 |
| `volcanoErupt` | Volkan: patlama | alçak `thump` + brown gürültü gümbürtüsü + çıtırtılar | 0,6 |
| `lavaCreep` | Volkan: cephe (**sürekli**, son vuruşta `stop`) | alçak gümbürtü + seyrek çıtırtı | — |
| `heatFlare` | Volkan: ATEŞ vuruşu | yanma "fwump" (`sweep` + `puff`) | — |
| `steamHiss` | Volkan: SU vuruşu | beyaz gürültü, düşen filtre | — |
| `volcanoCool` | Volkan: serinleme / eski alanın kırılması | tıslama + taş oturması | 0,3 |
| `mirrorRaise` | Ayna: panel | basamaklı cam tık arpeji (4 nota; tüm ton dizisi, levha tınısı; Ejder'in çubuk modlarından ayrı) | — |
| `mirrorCatch` | Ayna: yakalama | cam vuruşu + halka | 0,45 |
| `mirrorBeam` | Ayna: yansıma (×n) | zap + inen halka; her kurbanda bir basamak yukarı | 0,3 |
| `mirrorBreak` | Ayna: kırılma | cam kırılması + seyrek pırıltı | 0,4 |
| `chasmCrack` | Yarık: koşan yarık | çıtırtı dizisi + yükselen alçak gümbürtü | — |
| `chasmOpen` | Yarık: açılma | derin kovuk "whoomp" + çakıl | 0,6 |
| `chasmFall` | Yarık: düşüş | inen gümbürtü + moloz | — |
| `chasmShut` | Yarık: kapanma | ağır çarpma + toz | 0,5 |

Ayrışma: cam tınılı Ayna sesleri Ejder'in `glassBell` rollerine karşı LSD ≥ 10 dB tutmalıdır. Kurbanın ölüm sesiyle aynı karede çalan sesler bir oktav ayrı ve kısa olur (SE-5 ruhu). A6'nın arayüz sesleri (A6-A, `ui3*`) ayrı bir aileden gelir ("neon cam + keçe"); çakışan adlar yoktur.

**4.7 Kart yüzü kiti (A5-B).**
- `src/art/cardface-v3/`:
  - `index.ts`: kayıt + kapılar: `cardArtV3(id)`, `cardIconV3(id)`, `hasV3Art`.
  - `frame.ts`: kartın çerçeve parçaları, mini seviye, bindirmeler; `frame-v3.ts`'in (S-1) üstüne kurulur.
  - `kit.ts`: düz düzlem, kenar ışığı, kart sahnesi.
  - `icons.ts`, `life.ts`.
- `src/art/cardart-v3/<id>.ts`: 11 resim.
- `cards.ts` kancaları, yalnız `V3_A5_B` dalları: `cardArtCanvas`, `drawFace`, `drawMiniFace`, `buildCardTextures` bindirmeleri. Arka yüz satırları (A56.0) değişmez.
- `types.ts`: isteğe bağlı `CardArtwork` alanları (`life?`, `icon?`).
- `src/boot/31-cardlife.ts`: yaşayan resim saati.
- **QA alt bayrağı `&cards=v1`** (yalnız `V3_A5_B` açıkken anlamlı): v3 görünümünde eski kart dokularını zorlar. A5-B'nin kimlik kapısı buna dayanır (§6.2).

**4.8 Araçlar (A56.0'da, ortak).** `tools/palcheck.mjs`, `tools/sbs.mjs`, `tools/card-hash.ts`, `tools/filmdiff.mjs` (`a5` seti, `--query-suffix`), `tools/measure.mjs` kamera alanları. Ayrıntı §5.0.2. A5 şeritleri araç dosyası düzenlemez.

**4.9 Yeniden kullanılanlar (salt okunur).**
- `spellOpeningV3` / `trapOpeningV3` ve aksanları, `energyStreakV3`, `namePlate` (A-1'de dışa aktarılır).
- `_v3/card.ts` `cardLeaves`, `_v3/react.ts` `reactHit`, `_v3/death.ts`, `_v3/posematch.ts`, `_v3/number.ts`.
- `_v3/sound.ts` (`play` / `start` / `panAt` / `soundsOf`), `view/light`.
- `src/view/v3/motion.ts` (`REDUCED_MOTION`), `src/art/frame-v3.ts`, `src/view/v3flags.ts`.
- Sunum tarifleri (`presentationOf`), cut-in kiti (`src/art/cutins/index.ts` primitifleri).
- `src/still/*.ts`, `MonsterUnit` (`setStats`, `setAura`, `worldPoint`, `core`).

---

## 5. Yapım

### 5.0 Ortak düzen: A56.0 → dört şerit → A56.K → A56.Z

> Bu bölüm (§5.0.1–§5.0.7) `A5_PLAN.md` ile `A6_PLAN.md`'de **birebir aynıdır**. Değişirse ikisi birlikte değişir.

#### 5.0.1 Akış

| Adım | Kim | Ne | Ajan-saat | Duvar |
|---|---|---|---|---|
| Önkoşul | orkestratör | (1) A4.1 benzerlik iş akışı commit edilmiş ve durmuş. (2) İptal edilen sinematik kamera ("cine") denemesinin ağaçta izi yok: `git status` temiz; `src/duel/CameraRig.ts` ve `src/cinematics/**` HEAD ile aynı. (3) REHBER EF-8 ve ANIMASYON_PLANI §3 "Kamera" maddesi "yalnız zoom 1; yeni focus / closeUp yok (kullanıcı kararı)" diye güncellenmiş. | — | — |
| A56.0 | 2 ajan paralel ("araç", "çalışma zamanı"), sonra 1 ajan ("taban") | araçlar, kill-switch'ler, dondurulan sözleşmeler ve taslakları, kancalar, ortak v3 tabanı | ≈ 14 | ≈ 9,5 sa |
| Şeritler | 4 ajan paralel | A5-A, A5-B, A6-A, A6-B | 37,5 / 32,5 / 41 / 41,5 | ≈ 41,5 sa |
| A56.K | 1 ajan + kullanıcı | kontrol noktası (A5-B B-1, A6-A A1–A2, A6-B B0–B1 bitince) | 1,5 | + kullanıcının cevabı |
| A56.Z | 1 ajan | ortak kapanış, tek ardıl taban, kullanıcı paketi | 7 | ≈ 7 sa |

Toplam ≈ 175 ajan-saat; duvar ≈ 58 saat + kontrol noktasında kullanıcı beklemesi. Kritik yol A6-B'dir; eleştiri turlarının çekim ve inceleme kısmı dosya yazmayan bağımsız eleştirmen ajanlarına verilirse ≈ 3 saat kısalır.

#### 5.0.2 A56.0 — ortak ön adım

**Ajan "araç"** (yalnız `tools/**`):
1. `tools/palcheck.mjs`: film karelerinde palet dışı pay, beyaz payı (EF-4) ve satır denetimi; kare 0'a göre fark. `filmdiff.mjs`'teki zlib PNG çözücüsü kopyalanır.
2. `tools/sbs.mjs`: önce | sonra yan yana; `--x1` (1×, büyütmesiz çiftler), `--page` (tek sayfa). Kontrol noktası ve kapanış sayfaları bununla yapılır.
3. `tools/card-hash.ts`: bütün kart dokularının parmak izi (yüz, resim, mini, iso P1 / P2 iki yön, arka yüz P1 / P2, bindirme kareleri); `--look v1|v3`, `--query`, `--compare`.
4. `tools/filmdiff.mjs`: setler `a5` (A5 §5.1 sonu), `a6v1`, `a6v3` (A6 §5.1); `--query-suffix`; film başına tam URL (açılış filmleri `?mode=hotseat&seed=1&holdIntro=1&curtain=0` ve aynısı `&skipIntro=1` ile).
5. `tools/measure.mjs`: senaryo başına `camera.maxScrollPx` (ana kameranın en büyük |scrollX| / |scrollY|'si, tam piksel), `camera.focusCalls`, `camera.closeUpCalls` (sayfa içinde `CameraRig.focus` sarılarak sayılır; oyun kodu değişmez). `--diff` bu alanları da yazar. `--camera-gate <taban.json>`: her senaryoda `zoom.max = 1`, `closeUpCalls = 0`, `maxScrollPx` ve `focusCalls` ≤ taban; aşan varsa çıkış 3.

Bitti: `--help` başlıkları; araçlar bugünkü v1 / v3 tabanlarında değişmeden çalışır.

**Ajan "çalışma zamanı"** (yalnız aşağıdaki `src/**` dosyaları; v1'de ve v3'te davranış bayt bayt aynı kalır, çünkü bütün taslaklar bugünkü yolu döndürür):
1. `src/view/v3flags.ts` (yeni): `V3_A5_A`, `V3_A5_B`, `V3_A6_A`, `V3_A6_B` (`LOOK_V3` ve URL `&a5=off|a|b`, `&a6=off|a|b`; parametre yoksa hepsi açık; `globalThis` geçersiz kılması testler için), `V3_CARDS` (`V3_A5_B` ve `&cards=v1` yok), `CARD_OVERLAY_BLEND` (`V3_CARDS` ise NORMAL, değilse ADD).
2. `src/art/frame-v3.ts` (yeni): `FRAME_V3` tonları ve kuralları (gövde night1 / night0 iki düz bant; 1 px ink dış kontur; köşe kırpımı; tek trim — canavar gold2 / gold3, büyü teal2 / teal3, tuzak mag2 / mag3, P1 `PLAYER_RAMP[0]`, P2 `PLAYER_RAMP[1]`, nötr mist / steel; trim üst-sol bir ton açık, alt-sağ bir ton koyu; as için 3 px altın L köşe) ve taban boyacı `frameRectV3(p, x, y, w, h, trim, opts)`.
3. Tek arka yüz kaynağı: `src/view/v3/cardBack.ts` (yeni taslak: `cardBackV3(player)` bugünkü arka yüzü döndürür). `src/art/cards.ts`'te **yalnız arka yüz satırları**: `cardBackCanvas(player = 0)`, `cardBackKey(player)`, `cardMip('back', player = 0)`, `renderFlat` / `isoCanvas`'ın arka yüzü oyuncuya göre seçmesi; `V3_A6_A` iken kaynak `cardBackV3(player)`. Tüketiciler tek satırla bağlanır: `TileCard` poz mip'i (`TileCard.ts:327` → `cardMip('back', this.player)`), `CardSprite` (`:314` / `:319` → `cardBackKey(player)` / `cardBackCanvas(player)`). Statik iso anahtarı (`TileCard.ts:253`), `dissolve` (`:800`), `PileView.ts:108`, `isoGhost` ve başlık ekranı oyuncuya göre iso anahtarını zaten okur. `buildCardTextures` v3'te P2 arka yüz dokusunu (`card:back:p2`) da ekler; v1'de `cardBackKey(p)` her zaman `card:back` döner, yeni doku eklenmez ve iki oyuncu aynı pikselleri alır (`card-hash` ve `texmem` kanıtlar).
4. `TileCard.currentPixels(): { px: PixelCanvas; x: number; y: number }`: o anki pozun kopyası (poz yoksa statik iso pikseller) ve dünyadaki sol üst köşesi.
5. `CardSprite`: `sheen` / `foil` görüntüsünün karışımı `CARD_OVERLAY_BLEND`'den (v1'de ADD, değişmez).
6. `src/view/v3/motion.ts` (yeni): `REDUCED_MOTION` (`prefers-reduced-motion` + `?motion=reduced`), `A6_MS` (A6 §1.3'ün bütün satırları; yeni `gameStart`, `decisionFast`, `hudIn` dahil; şeritler değiştirmez), tam piksel eğriler (`settle`, `overshoot(px)`, `snap`). A5 de buradan okur.
7. `src/view/v3/ui-kit.ts` (A6 §4.1), `src/cinematics/v3small/_hooks.ts` (`V3HOOKS`) ve A6 §5.1 tablosundaki tek satırlık kancalar (açılışta dört nokta: `riffle`, `deal`, `duelPlate`, `hudIn`; iniş ve yazı-tura koduna dokunulmaz).
8. `src/cinematics/_v3/card.ts`: mezarlık sayısı motor durumundan (A6 §2.3 düzeltmesi) + `V3HOOKS.pileAccept`.
9. Şerit arayüzlerinin taslakları (S-9): `src/view/v3/GravePanel.ts`, `src/view/v3/CardV3.ts` (`createCardV3` bugünkü `CardSprite`'ı döndürür, `flipFrames()`), `src/view/v3/inspectV3.ts` (`showPile`), `HandView.reject` / `HandView.waveFaceDown` (bugünkü `setFaceDown`'a düşer).
10. Ses: `src/audio/v3/spells.ts`, `ui-cards.ts`, `ui-flow.ts` iskeletleri (ad listeleri + boş tarifler). `sounds.ts`'e üç yayma satırı, `sfx.ts`'e üç tip birleşimi + `import type`. Şeritler bu iki kayıt dosyasına dokunmaz.
11. Arayüz adımlı senaryolar: `src/duel/scenarios.ts` (`UiStep` türü), `src/scenes/DuelScene.ts` (`runSteps`), `src/duel/qaInput.ts` (yeni), `src/duel/scenarios/a6-base.ts`; boş şerit paketleri `a5-spells.ts`, `a5-cards.ts`, `a6-cards.ts`, `a6-flow.ts`; `src/dev/previews/a6audit.ts`.

**Ajan "taban"** (ikisi bitince):
1. FAST kapılar. v1 aynılığı: `filmdiff --set v1` 17/17, `measure --scenarios all` (v1) "same", `sheet-hash` v1 / v3 çıkış 0, `card-hash --look v1` (taban `shots/v3/a56/baseline/card-hashes-v1.json` yazılır), `handlers-v1.json`, `texmem` v1 sayısı.
2. v1 film tabanı: `filmdiff --set a6v1 --write` → `shots/v3/a56/baseline/a6v1films/` (iki açılış filmi dahil, 26 film).
3. Ortak v3 tabanı (`shots/v3/a56/baseline/`): `slicefilms-a56-0/`, `measure-v3-a56-0.json` (bütün v3 senaryoları, kamera alanlarıyla), `card-hashes-v3-a56-0.json`, `a5films-0/`, `a6v3films-0/`, açılış kamera izi `opening-camera-0.json` (her karede scroll / zoom); "önce" kareleri `shots/v3/a56/before/`.
4. Belirlenimcilik: `a6Hover`, `a6Grave` ve iki açılış filmi iki kez `--fresh` çekilir, bayt bayt aynı.

Bitti: A56.0'dan sonra hiçbir şerit taban yazmaz; bütün karşılaştırmalar bu tabanladır.

#### 5.0.3 Kill-switch'ler ve şerit kimlik kapıları

- URL: `&a5=off|a|b`, `&a6=off|a|b` (yok = hepsi açık) ve A5-B'nin alt bayrağı `&cards=v1`. Yalnız QA içindir; menüde yoktur.
- Her şeridin yeni davranışı yalnız kendi bayrağına bağlıdır: A5-A `V3_A5_A`, A5-B `V3_A5_B` (dokular `V3_CARDS`), A6-A `V3_A6_A`, A6-B `V3_A6_B`. `LOOK_V3` tek başına yeni davranış açmaz.
- Şeridin kimlik kapısı yalnız o şerit açıkken çalışır ve ortak tabanla karşılaştırır:

| Şerit | Sorgu eki | Beklenen |
|---|---|---|
| A5-A | `&a5=a&a6=off` | yalnız A5-A'nın ilan ettiği filmler / anahtarlar değişir |
| A5-B | `&a5=b&a6=off&cards=v1` | IDENTICAL (dokular eski; giriş damgası ve Büyücü P2 dilim filmlerinde yok) + `card-hash` farkı yalnız A5-B dokularında |
| A6-A | `&a5=off&a6=a` | fark yalnız A6-A öğelerinin piksellerinde (el bandı, kartlar, yığınlar); canavar gövdesi ve büyü / tuzak efektleri aynı |
| A6-B | `&a5=off&a6=b` | fark yalnız A6-B öğelerinde (HUD, levhalar, hedef işaretleri, istemler) |

  - Filmler: `node tools/filmdiff.mjs --set slice --base shots/v3/a56/baseline/slicefilms-a56-0 --query-suffix "<ek>"` (A5'te ayrıca `--set a5 --base …/a5films-0`, A6'da `--set a6v3 --base …/a6v3films-0`). Fark kareleri ve sınır kutuları gözle denetlenir.
  - Süreler: `node tools/measure.mjs --look v3 --query "<ek>" --scenarios <anahtarlar> --compare shots/v3/a56/baseline/measure-v3-a56-0.json` → şeride ait olmayan anahtarlar "same".
- Şeridin kendi öğelerinin görsel ve süre denetimi varsayılanla (dört şerit açık) yapılır.
- Taban yalnız A56.0'da ve A56.Z'de yazılır.

#### 5.0.4 Ortak sözleşmeler (A56.0'da dondurulur)

| # | Sözleşme | Dosya | A56.0'da | İçini dolduran | Kullanan |
|---|---|---|---|---|---|
| S-1 | `FRAME_V3` + `frameRectV3()` | `src/art/frame-v3.ts` | tam; dondurulur (değişiklik yalnız orkestratörle, örn. A56.K sonrası) | — | A5-B kart yüzü, A6-A arka yüz, A6-B HUD |
| S-2 | Tek arka yüz kaynağı `cardBackV3(player)`; `cardBackCanvas / cardBackKey / cardMip('back', p)` | `src/view/v3/cardBack.ts`; `src/art/cards.ts`'in arka yüz satırları (dondurulur) | kablolama tam, boyacı taslak | A6-A (A1) | her arka yüz yolu: el, mini el, saha (statik, 3B poz, `dissolve`), yığınlar, karıştırma hayaleti, A2 / A5 açılışlarının `standUp` / `layDown`'u |
| S-3 | `TileCard.currentPixels()` | `src/view/TileCard.ts` | tam | — | A5-A (A-7) |
| S-4 | `ctx.keep('trapPulse', { destroy(): void })` her tuzak penceresinde (işaretleme yoksa boş nesne) | `battle/declare.ts` (bugün), `v3small/decision.ts` (v3) | belgelenir + test iskeleti | A6-B (B4) | `trapOpeningV3` (değişmez; alır ve `destroy` eder) |
| S-5 | Bindirme karışımı `CARD_OVERLAY_BLEND` | `src/view/v3flags.ts` + `CardSprite.ts` (1 satır) | tam | — | A5-B'nin `card:foil` / `card:sheen` dokuları opak palet pikseli |
| S-6 | `REDUCED_MOTION`, `A6_MS` | `src/view/v3/motion.ts` | tam | — | dört şerit |
| S-7 | Kill-switch'ler | `src/view/v3flags.ts` | tam | — | dört şerit |
| S-8 | `V3HOOKS` + tek satırlık kancalar | `src/cinematics/v3small/_hooks.ts` + A6 §5.1 tablosundaki dosyalar | tam | A6-A / A6-B (kendi kancalarını atar) | — |
| S-9 | Şerit arayüzleri: `openGravePanel(scene, views, player, opts)`, `gravePanelOpen(scene)`, `whenGravePanelClosed(scene)`, `hand.reject(uid)`, `hand.waveFaceDown(down, msPerCard)`, `createCardV3(scene, cardId, opts)` + `CardV3.flipFrames()`, `inspect.showPile(kind, player, count)` | A6-A dosyaları | bugünkü davranışa düşen taslak | A6-A (A1–A2) | A6-B |
| S-10 | UI ses adları (`ui3*`) | `src/audio/v3/ui-cards.ts`, `ui-flow.ts` | ad listesi + boş tarif | A6-A (A7, iki dosya) | A6-A, A6-B |
| S-11 | `namePlate` dışa aktarımı | `spells/_kit.ts` | — | A5-A (A-1) | A5-B (B-8) |
| S-12 | Büyü motifleri | `src/art/spellmotifs-v3.ts` | — | A5-A (A-1) | A5-B (B-3) |
| S-13 | Kart yüzü dokuları (`card:face:<id>`, `cardIsoKey`), `cardLifeFrame(id, tMs)`, `cardFaceCanvasAt(id, f)` | `src/art/cards.ts`, `src/art/cardface-v3/**` | — | A5-B | A6-A (`CardV3`, LOD yüzü) |
| S-14 | Şifa Pınarı'nın `lpGain` teslimi `ctx.play(li, { delivered: true })` → `V3HOOKS.presentHeal` | `_core/helpers.ts` (kanca) | kanca | A6-B (B2) | A5-A (A-6) |
| S-15 | Yarık hızlı yolu: CPU / senaryo yanıtlı **çağırma** penceresinde karar sunumu ≤ 120 ms, kart işaretlemesi yok (`A6_MS.decisionFast`) | `v3small/decision.ts` | tablo satırı | A6-B (B4) | A5-A (A-5 ölçer) |

#### 5.0.5 Kontrol noktası A56.K

- **Ne zaman:** A5-B B-1, A6-A A1 + A2 ve A6-B B0 + B1 bitince (şeritlerin ≈ 10–12. saati).
- **Paket** (1 ajan, ≈ 1,5 sa; `shots/v3/a56/checkpoint/`):
  - `sbs-1x.png`: telefonda tam genişlik okunacak tek sayfa; 5 çift, 1× (640×360), önce | sonra: boşta ekran (el + HUD + saha), el üzerine gelme (+120 ms), tur başı (+300 ms), kapalı koyma (iniş +40 ms; yeni arka yüz), LP kaybı (+150 ms; yeni HUD kabuğu).
  - `checkpoint.mp4`: 30 sn, sesli; bir sıcak koltuk dizisi (`a6Hover` → elden oynama → `smbSetMonster` → tur sonu → `flowTurnP1` → `atkTargetDestroyed`).
  - Bağımsız eleştirmen (ajan): her çiftte 1×'te ≥ 3 somut fark sayar ve yeni kareyi seçer. Geçmeyen çift önce düzeltilir, sonra gönderilir.
- Orkestratör paketi kullanıcıya gönderir. Kullanıcı yönü onaylayana kadar A5-B, A6-A ve A6-B yalnız görsel dili etkilemeyen işleri yapar (senaryolar, testler, mantık, ses tarifleri) ya da bekler; A5-A sürer (büyü / tuzak dili A2 diliminde onaylandı).
- Kullanıcı yönü değiştirirse önce `frame-v3.ts` (orkestratör) ve B-1 / A1–A2 / B0–B1 düzeltilir.

#### 5.0.6 Ortak kapanış A56.Z (1 ajan, ≈ 7 sa)

1. Bütün kapılar (A5 §6, A6 §6): v1 tam; v3 tam (`measure --scenarios all --look v3`, kamera alanlarıyla; hata 0, watchdog 0; `--camera-gate`).
2. Tek ardıl taban (`shots/v3/a56/baseline/`): `slicefilms-a56/`, `measure-v3-a56.json`, `card-hashes-v3-a56.json`, `a5films/`, `a6v3films/`, `opening-camera.json`. `-a56-0` tabanları arşivde kalır.
3. KK-11: `?look=v3` ile iki CPU demo oyunu (biri 1× / 2×, biri 3×) + bir gerçek fare sıcak koltuk oyunu (`playtest.mjs`): hata 0, watchdog 0.
4. `texmem` ve `?test` açılış süresi: A4.1 tabanının ≤ +%5'i.
5. Kullanıcı paketi (`shots/v3/a56/user/`): 1× yan yana sayfalar — A6 §1.4'ün 11 çifti ve A5'in 6 büyü / tuzak imza karesi (A5 §1.2); geçme: bağımsız eleştirmen her çiftte ≥ 3 somut fark sayar ve yeniyi seçer. 6 büyü / tuzak MP4'ü, kart MP4'ü, A6 MP4'leri, 60–90 sn'lik tam oyun MP4'ü. **Kamera açıklaması:** v3'te kalkan altı küçük eğilmenin listesi (A5 §0 K1).
6. `docs/ANIMASYON_PLANI.md` §9 durum satırları ve kısa kabul özeti.

#### 5.0.7 Dört şeridin dosya sahipliği

| Alan | Sahibi | Not |
|---|---|---|
| `tools/**` (palcheck, sbs, card-hash, filmdiff, measure) | A56.0 "araç" | Şeritler araç düzenlemez; gerekirse orkestratör ayrı iş açar. |
| `src/view/v3flags.ts`, `src/art/frame-v3.ts`, `src/view/v3/motion.ts`, `src/view/v3/ui-kit.ts`, `src/cinematics/v3small/_hooks.ts` | A56.0, sonra dondurulur | Değişiklik yalnız orkestratörle. |
| `src/duel/scenarios.ts` (`UiStep`), `src/scenes/DuelScene.ts` (`runSteps`), `src/duel/qaInput.ts`, `src/duel/scenarios/a6-base.ts`, `src/dev/previews/a6audit.ts` | A56.0, sonra dondurulur | |
| `src/audio/sounds.ts`, `src/audio/sfx.ts` | A56.0, sonra dondurulur | Üç yayma satırı ve üç tip birleşimi bir kez yazılır. |
| Tek satırlık kanca dosyaları: `src/cinematics/flow/{draw, discard, opening, turn, end}.ts`, `summon-b/set.ts`, `summon-a/tribute.ts`, `_v3/card.ts`, `battle/declare.ts`, `_defaults/battle.ts`, `_core/helpers.ts` | A56.0, sonra dondurulur | v3 gövdeleri şeritlerin `src/cinematics/v3small/*` dosyalarındadır. `flow/stats.ts` bu listede değildir (A5-A). |
| `src/art/cards.ts` | A5-B | Arka yüz satırları (A56.0) dondurulur; A5-B yalnız `V3_A5_B` kancaları ekler; v1 yolu bayt bayt aynı. |
| `src/view/TileCard.ts`, `src/view/CardSprite.ts` | A6-A | A56.0'ın satırları (`currentPixels`, arka yüz mip'i ve anahtarı, bindirme karışımı) korunur. `standUp` / `layDown` v3'te de değişmez. |
| **A5-A** düzenler: `src/cinematics/spells/{_kit, healing_spring, _fountain, soul_recall, dragon_blade, volcano_arena}.ts`; `src/cinematics/traps/{mirror_barrier, chasm_trap, _opening}.ts` (`_opening.ts`'te yalnız Ayna / Yarık aksanları; `trapOpeningV3`'ün eğilmesi ve Zincirler aksanı değişmez); `src/duel/auras.ts` (yalnız v3 yönlendirmesi); `src/cinematics/flow/stats.ts` (yalnız v3 dalı); `src/vfx/setpieces.ts` (yalnız `setVolcanoAmbience` / `volcanoAmbienceOn` yönlendirme satırları). Yeni: `src/cinematics/_v3/spellfx.ts`, `src/art/spellmotifs-v3.ts`, `src/cinematics/spells/{_blade_v3, _volcano_v3, _spring_v3}.ts`, `src/cinematics/traps/{_mirror_v3, _chasm_v3}.ts`, `src/duel/auras-v3.ts`, `src/audio/v3/spells.ts` (doldurur), `src/duel/scenarios/a5-spells.ts` (doldurur), `src/dev/previews/a5fx.ts`, `tests/cinematics/a5-spells.test.ts`, `tests/audio/a5-sounds.test.ts` | A5-A | |
| **A5-B** düzenler: `src/art/cards.ts` (yukarıdaki kuralla), `src/art/types.ts` (yalnız ek, isteğe bağlı alanlar), `src/dev/previews/cards.ts` (v3 kipleri), `src/art/cutins-v3/abyss_magus.ts` (B-9). Yeni: `src/art/cardface-v3/{index, frame, kit, icons, life}.ts`, `src/art/cardart-v3/*.ts` (11), `src/boot/31-cardlife.ts`, `src/cinematics/_v3/entrystamp.ts`, `src/duel/scenarios/a5-cards.ts` (doldurur), `tests/art/cardface-v3.test.ts`, `tests/art/cutin-magus-relight.test.ts` | A5-B | |
| **A6-A** düzenler (yalnız v3 dalları): `src/view/{CardSprite, HandView, TileCard, InspectPanel}.ts`, `src/duel/{PileView, CardPicker}.ts`. Yeni / doldurur: `src/view/v3/{CardV3, cardRaster, cardLod, cardBack, handV3, inspectV3, shelf, GravePanel}.ts`, `src/cinematics/v3small/{draw, set, discard, opening-cards, tribute, pile}.ts`, `src/audio/v3/{ui-cards, ui-flow}.ts`, `src/duel/scenarios/a6-cards.ts`, `src/dev/previews/cards3.ts`, `tests/v3/a6-cards.test.ts`, `tests/audio/a6-ui.test.ts` | A6-A | |
| **A6-B** düzenler (yalnız v3 dalları): `src/view/{HudView, Prompt, Button}.ts`, `src/duel/{HumanInput, DuelController, viewer}.ts`. Yeni: `src/view/v3/{hudV3, hudSkin, odometer, TurnPlate, TargetMarks, ResultPlate, TrapPromptV3, CurtainV3}.ts`, `src/cinematics/v3small/{turn, end, decision, target, heal, block, opening-flow}.ts`, `src/duel/scenarios/a6-flow.ts`, `src/dev/previews/hud3.ts`, `tests/v3/a6-flow.test.ts` | A6-B | `Button.ts` v3 kabuğu başlık ekranı menülerinde de görünür (v3'te). |
| Hiçbiri düzenlemez (yalnız çağrılır / okunur): `src/duel/CameraRig.ts`; `src/view/board-calm/**`, `src/view/light/**`; `src/view/{ui-textures, ActionMenu, LogView, layout}.ts` (ActionMenu / LogView görünümü A7); `src/vfx/{banners, numbers, core, cutin}.ts`; `src/scenes/**` (A56.0'ın `runSteps`'i dışında); `src/art/duelists.ts`; `src/duel/{FieldView, MonsterUnit, StatBadge, speed, showclock}.ts`; `src/cinematics/_v3/{number, summon, cutin, react, death, posematch, sound, presets}.ts`; A2 çıtası `spells/judgment_bolt.ts`, `traps/chains_of_light.ts`, `traps/_chains.ts`, `setpieces.stormStrike`; `src/still/**`; `src/engine/**`, `src/data/cards.ts` | — | |
| Asla (A4.1 benzerlik iş akışı ve park hâlindeki entegrasyon): `tools/sameness.ts`, `tools/lib/sameness-metrics.ts`, `src/art/monsters-v3/_magma_titan.ts`, `_coral_serpent.ts`, `magma_titan-*.ts`, `coral_serpent-*.ts`, `src/art/drafts/**`, `tests/art/{magma_titan, coral_serpent}*.test.ts` | — | |

Dosya kuralı (AGENT_CONTEXT): bir şerit yalnız kendi satırındaki dosyaları düzenler; başkasının dosyasındaki `tsc` hatası onun yarım işidir, beklenir ve yeniden denenir.

### 5.1 Şerit A5-A: sahneler + sesler (≈ 37,5 sa)

Sahip olunan dosyalar §5.0.7'de. Bütün yeni davranış `V3_A5_A` arkasındadır.

**Sıra (görünür olan önce, K5):**

**A-1. Kit + motifler + ses iskeletinin doldurulması (≈ 4 sa).**
- §4.1, §4.2, §4.3; `spells.ts` tarif tablosunun iskeleti (kayıt A56.0'da).
- `_kit.ts`'teki `namePlate` dışa aktarılır (S-11; davranış aynı).
- Bitti: typecheck; v1 kapıları; kimlik kapısı IDENTICAL (kit henüz hiçbir sahneye bağlı değil).

**A-3. Volkan Arenası + alan auraları + ambiyans (≈ 5,5 sa), §3.2.**
- İlk iş: `setVolcanoAmbience` v3 yönlendirmesi (`wash` ve ısı rasterları yok); kalıcı tam ekran ton gider.
- Senaryolar: `spVolcano`, `spVolcanoP2`, `spVolcanoReplace`, `spVolcanoCool`.
- Yeni: `a5VolcanoSlice` (v3 çizimli Muhafız / Ejder / Büyücü vuruş almaz + Kurt / Golem vuruş alır).

**A-3b. Genel `statChange` v3 (≈ 1,5 sa).**
- `flow/stats.ts` v3 dalı: chevron sütunu ve tüm-sprite yeşil / kırmızı boyama yerine tek sayı, 1 px kenar ışığı, ≥ 150 ms sıra.
- Kılıç kırılması ya da Volkan'ın serinlemesi gibi, bir kancanın tüketmediği bütün `statChange`'ler bunu oynar.
- Senaryolar: `spBladeBreak`, `spVolcanoCool`, `flow` paketindeki `statChange` anahtarları (v1'de değişmez).

**A-4. Ayna Kalkanı (≈ 5 sa), §3.3.**
- Senaryolar: `tbMirror`, `tbMirrorP2`, `tbMirrorDirect`.
- Yeni:
  - `a5MirrorSlice`: P2'nin saldırı pozisyonundaki Ejder + Büyücü'sü; v3 ölümler sırayla.
  - `a5MirrorTriple`: 3 kurban, 2,6 sn tavanı.

**A-5. Yer Yarığı (≈ 5 sa), §3.4.**
- Senaryolar: `tbChasm`, `tbChasmP2`, `tbChasmBig`, `tbDeclineSummon` (değişmemeli).
- Yeni: `a5ChasmWyrm` (kurbanlı Kristal Ejder, v3 düşüş), `a5ChasmMagusP2`.
- Ölçü: çağırma işleyicisinin bitişi → `crack` (A56.Z'de ≤ 300 ms) ve çağrılanın inişi → `crack` (raporlanır), §3.4.

**A-2. Ejder Kılıcı + `equip` aurası (≈ 5 sa), §3.1.**
- Senaryolar: `spBlade`, `spBladeSet`, `spBladeAce`, `spBladeDef`, `spBladeP2`, `spBladeBreak`, `spBoltAce`.
- Yeni senaryolar: `a5BladeWyrmP2`, `a5BladeMagus`.

**A-6. Şifa Pınarı (≈ 3 sa), §3.5.**
- Senaryolar: `spHeal`, `spHealSet`, `spHealP2`, `spHealP2Set`.

**A-7. Ruh Çağrısı kalanları (≈ 1,5 sa), §3.6.**
- Senaryolar: `spRecall*`, `slice*Revive*`, `suRevive`.

**A-8. Ses geçişi + eleştiri + az hareket dalları (≈ 7 sa).**
- 23 tarifin seviye ve ayrışma ayarı; senkron 1× / 3×; ducking.
- `REDUCED_MOTION` dallarının hepsi bağlanır ve filme alınır (`?motion=reduced`).
- İki eleştiri turu:
  - sanat + hareket: ×3 kırpımlar, P1 / P2;
  - ses: MP4 + analiz.
- Bulgular kural kimliğiyle yazılır.

**Her sahne adımının "bitti" ölçütü:**
- (1) v1 kapıları (§6.1).
- (2) Sahnenin v3 senaryoları 0 hata, §6.3 süre tablosunda.
- (3) `palcheck`: ≤ kare 0 + 1 puan; beyaz ≤ %1,5.
- (4) Kamera: `measure --camera-gate shots/v3/a56/baseline/measure-v3-a56-0.json` sahnenin anahtarlarında geçer; eklenen satırlar ve yeni dosyalar taramadan temiz çıkar (§6.4).
- (5) Ses ile işaret arası ≤ 1 kare (1× ve 3×).
- (6) P1 + P2 filmlerine ve imza karesinin ×3 kırpımına bakıldı; imza karesinin önce | sonra çifti ≥ 3 somut fark.
- (7) Kimlik kapısı (`&a5=a&a6=off`, §5.0.3): yalnız ilan edilen filmler değişir (dilim setinde A-2'den sonra `spBoltAce`; `a5` setinde adımın kendi filmleri).

**Teslim edilecek filmler ve MP4'ler:** `shots/v3/a5/lane-a/`
- Her sahne için:
  - P1 ve P2 filmi (`--film 48 --every 50 --cols 12`);
  - imza anının ×3 kırpımı (`--every 17 --clip … --scale 3`);
  - 3× hız filmi (birer büyü ve tuzak).
- `shots/v3/a5/clips/<kart>.mp4` (6 adet): `clip.mjs --music off --marker <imza sesi>`.
- Volkan ve Ayna'nın müzikli birer klibi (ducking).
- `a5-sahneler.mp4`: altı sahne art arda, müzikli; A56.Z ile kullanıcıya gider.

**`a5` film kümesi (A56.0'da):** `spHeal`, `spHealP2Set`, `spRecallSet`, `spBlade`, `spBladeAce`, `spBladeP2`, `spBladeBreak`, `spVolcano`, `spVolcanoReplace`, `spVolcanoCool`, `tbMirror`, `tbMirrorDirect`, `tbMirrorP2`, `tbChasm`, `tbChasmBig`, `tbChasmP2`. Yeni anahtarlar A56.Z'de eklenir.

### 5.2 Şerit A5-B: kart yüzleri + girişler (≈ 32,5 sa)

Sahip olunan dosyalar §5.0.7'de. Bütün yeni davranış `V3_A5_B` (dokular `V3_CARDS`) arkasındadır.

**Sıra (görünür olan önce, K5):**

**B-1. Çerçeve, bindirmeler, `cards.ts` kancaları (≈ 4,5 sa).** → kontrol noktası A56.K
- `frame-v3.ts`'in (S-1) üstüne kartın parçaları (§3.7.1); `foil` / `sheen` (§3.7.5).
- Bitti:
  - `card-hash --look v1` eşleşir;
  - 20 yüzün `?dev=cards` ×2 ve ×3 sayfalarına bakıldı;
  - el / inceleme / saha 1× kareleri çekildi; kontrol noktası paketine "boşta ekran" ve "el üzerine gelme" çiftleri verildi.

**B-4. 11 saha simgesi (≈ 2 sa).**
- Kör test 1× (G3).

**B-3. 8 büyü / tuzak resmi (≈ 9 sa).**
- A-1'in motiflerinden sonra başlar (§4.2).
- Bolt ve Zincirler'in resmi A2 kodundaki imgelerden okunarak çizilir.

**B-2. 3 canavar resmi: Ejder, Büyücü, Muhafız (≈ 3 sa).**
- Sabit karelerden (§3.7.2). Kapı `hasV3Art(id)`.

**B-8. Giriş damgası (≈ 2 sa; zorunlu).**
- §3.8. `namePlate` (S-11) A-1'den.
- Senaryolar: `normalSummon`, `smbSentinel`, `a5-cards` içindeki P2 çeşidi ve kurbanlı as olmayan çeşit.

**B-5. Yaşayan resim: kareler + saat (≈ 4,5 sa).**
- S2; varsayılan evet.
- Determinizm: aynı `--fresh` film iki kez çekilince IDENTICAL.
- Maliyet: kare süresi ve `texmem` farkı raporlanır.

**B-9. Büyücü cut-in P2 relight (≈ 3 sa; eski A-9).**
- §3.8. `a5MagusCutinP2` senaryosu `a5-cards.ts`'e.
- `npm test`: `lightFrom: 'right'` kareleri soldan farklı, gözler aynı.

**B-7. Eleştiri turu ×2 + yan yana sayfalar + filmler (≈ 4 sa).**
- Sanat (IŞ): ×3 sayfalar.
- Okunurluk: 1× kör testler; G1 ve G3 ölçüleri; §1.2 sayfaları ≥ 3 fark ölçütüyle.

**"Bitti" ölçütü (her adım):**
- v1 kapıları (`card-hash` v1 dahil).
- Kimlik kapısı (`&a5=b&a6=off&cards=v1`, §5.0.3) IDENTICAL; `card-hash --look v3 --query "&a5=b&a6=off"` farkı yalnız A5-B'nin dokularında.
- `sheet-hash --look v3` çıkış 0: canavar sayfalarına dokunulmadı.
- Üretilen her PNG'ye bakıldı.

**Teslim edilecekler:**
- `shots/v3/a5/lane-b/`: `cards-v3-x2.png`, `cards-v3-x3.png`, `icons-x4.png`, `hand-1x.png`, `hand-p2-1x.png`, `inspect-<id>.png`, `life-film.png` (24 kare, 50 ms), `cutin-magus-p2-x2.png`, `stamp-normalSummon.png`.
- `shots/v3/a5/clips/kartlar.mp4`: el üstünde gezinme, inceleme paneli, saha simgeleri, yaşayan resim (kaynak `a5Hand` senaryosu, A56.0'ın arayüz adımlarıyla); `cutin-magus-p2.mp4`.

**Yeni senaryolar (`a5-cards.ts`):** `a5Hand` (elde 5 kart, arayüz adımlarıyla üzerine gelme + inceleme), `a5MagusCutinP2` (B-9), `a5StampP2` ve `a5StampTribute` (B-8: P2 normal çağırma ve as olmayan kurbanlı çağırma).

### 5.3 A6 ile sınır ve A6'dan beklenenler

Dosya sınırları §5.0.7'de, arayüzler §5.0.4'te. A5'i doğrudan ilgilendiren sözleşmeler:

1. **S-14:** Şifa Pınarı'nın teslim ettiği `lpGain`'i A6-B'nin `presentHeal` kancası sunar (≤ 400 ms). A5 yalnız teslim anını verir.
2. **S-15:** CPU / senaryo yanıtlı çağırma penceresinde A6-B'nin karar sunumu ≤ 120 ms ve işaretlemesizdir (`A6_MS.decisionFast`, A6 F7, testli). Yarık'ın "çağırmanın hemen ardından" hissi buna dayanır.
3. **S-13:** A6-A'nın `CardV3`'ü dururken `card:face:<id>` dokusunu gösterir; kendi kopyasını yaparsa A5-B'nin `cardLifeFrame` / `cardFaceCanvasAt` işlevlerini kullanır. `cardLod` hareket yüzünü A5-B'nin v3 yüzünden türetir. Sahada duran kart `cardIsoKey` dokusunu (simgeli mini seviye) gösterir.
4. **S-1 / S-2:** v3 arka yüz `frame-v3.ts` dilindedir ve tek kaynaktan bütün yollara gider; A5'in tuzak / büyü açılışlarındaki `standUp` / `layDown` da bu kaynaktan okur.
5. **S-5:** bindirme karışımı A56.0'da NORMAL'e bağlandı (A5-B'nin dokuları açıkken).
6. **S-4:** A6'nın v3 karar sunumu `trapPulse` anahtarını her zaman bırakır; `trapOpeningV3` değişmez.
7. İnceleme panelinin yumuşak aurası A6-A'nındır (`inspectV3`).
8. **S-3:** `TileCard.currentPixels()` A56.0'dadır; `TileCard` A6-A'nın dosyasıdır, A5 yalnız çağırır.

### 5.4 A4.1 entegrasyonuna taşınanlar (bu planın dışı; ≈ 11 sa)

Titan ve Yılan oyuna bağlanmadıkça aşağıdakiler hiçbir oyuncuya görünmez; bu yüzden A5'ten çıkarıldı ve park hâlindeki A4.1 entegrasyon işine eklendi:
- Magma Titanı ve Mercan Yılanı v3 giriş portreleri (eski B-6; ≈ 8 sa), §3.8'deki notla.
- İki kartın v3 resmi (sabit kare kırpımı + nitelik sahnesi; ≈ 2 sa), saha simgeleri (≈ 0,5 sa) ve yaşayan kareleri (≈ 0,8 sa). A5-B'nin kiti (`cardface-v3/**`, `hasV3Art`) bunları kod değişikliği olmadan alır.
- Yılan ritim değeri (`cutIn.rhythm`).

---

## 6. Kapılar

### 6.1 v1 piksel ve zaman olarak aynı (her çalışma zamanı adımında)

- `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` → 17/17 IDENTICAL.
- `npx vite-node tools/sheet-hash.ts --out <scratch>/sh-v1.json --compare shots/v3/a3/baseline/sheet-hashes-v1.json` → çıkış 0.
- `npx vite-node tools/card-hash.ts --look v1 --compare shots/v3/a56/baseline/card-hashes-v1.json` → çıkış 0 (kart dokuları `sheet-hash`'in kapsamında değil).
- `node tools/measure.mjs --scenarios <adımın anahtarları> --jobs 2 --out <scratch>/m-v1.json`, sonra `--diff` ile `shots/v3/a3/baseline/measure-v1.json`'a karşı.
  - Ortak anahtarlar ±17 ms içinde aynı olmalı.
  - A56.Z'de bütün senaryolar ölçülür. Yeni A5 anahtarları v1'de de 0 hatayla çalışmalı ama karşılaştırmaya girmez.

### 6.2 v3 kimlik kapıları (kill-switch'lerle, §5.0.3)

- `sheet-hash --look v3 --compare shots/v3/a3/baseline/sheet-hashes-v3-pilot.json` → çıkış 0. A5 canavar sayfalarına dokunmaz.
- A5-A: `filmdiff --set slice --base shots/v3/a56/baseline/slicefilms-a56-0 --query-suffix "&a5=a&a6=off"` → yalnız ilan edilenler (A-2'den sonra `spBoltAce`: yalnız Ejder'in kuşanma işareti); `measure --look v3 --query "&a5=a&a6=off" --compare …/measure-v3-a56-0.json` → A5-A'ya ait olmayan anahtarlar "same".
- A5-B: `filmdiff --set slice … --query-suffix "&a5=b&a6=off&cards=v1"` → IDENTICAL; `card-hash --look v3 --query "&a5=b&a6=off" --compare …/card-hashes-v3-a56-0.json` → fark yalnız A5-B dokularında (yüz, resim, mini, iso yüz, foil / sheen); arka yüz anahtarları aynı.
- A56.Z: `measure --scenarios all --look v3` (dört şerit açık) → 0 hata, watchdog 0, `--camera-gate` geçer.

### 6.3 v3 süre tablosu (measure, 1×, girdi geri gelene kadar)

| Senaryo | Bugün v3 | Hedef | Bütçe |
|---|---|---|---|
| `spBlade`, `spBladeAce`, `spBladeDef`, `spBladeP2` | 2,10 | ≤ 1,5 | büyü 1,2–2,0 |
| `spBladeSet` | 2,00 | ≤ 1,5 | |
| `spBladeBreak` (Büyücü etkisi) | 2,25 | ≤ 1,6 | büyücü etkisi ≤ 1,6 |
| `spVolcano`, `spVolcanoP2` | 1,92 / 1,85 | ≤ 1,9 | |
| `spVolcanoReplace` | 2,13 | ≤ 2,2 | **+0,2 sn** (§3.2) |
| `spVolcanoCool` | 1,52 | ≤ 1,6 | |
| `tbMirrorDirect` (1 kurban) | 3,15 | ≤ 2,1 | **Ayna: kurban başına +0,25, en çok 2,6** |
| `tbMirror`, `tbMirrorP2` (2 kurban) | 3,03 / 3,00 | ≤ 2,35 | |
| `a5MirrorTriple` (3 kurban) | — | ≤ 2,6 | |
| `tbChasm`, `tbChasmP2`, `tbChasmBig` (activate'ten) | 3,47–3,52 | ≤ 1,7 | tuzak 1,5–2,0 |
| `tbChasm`, `a5ChasmWyrm` (çağırma işleyicisinin bitişi → `crack`) | ≈ 0,47 | ≤ 0,30 (A56.Z, A6 hızlı yoluyla) | — |
| `tbChasm`, `a5ChasmWyrm` (çağrılanın inişi → `crack`) | ölçülmedi | raporlanır (hedef yok) | — |
| `spHeal*` | 1,72 | ≤ 1,4 | |
| `spRecall*`, `slice*Revive*` | 1,45–1,60 | değişmez (≤ 2,1) | diriltme ~2,0 |

Ek ölçüler:
- Sayı ile temas / bağ karesi arası 0 ± 17 ms (EF-9).
- Rozet ≤ 400 ms.
- Ayna ve Yarık'ta kart inişleri ≥ 150 ms arayla.
- Her `lpGain` ≤ 400 ms (A6-B'nin).
- Giriş damgası çağırma süresini uzatmaz (`normalSummon` girdi anı ±17 ms).

### 6.4 Görüntü, kamera ve ses kapıları (A5'in her sahnesi)

- **`palcheck`:** her filmde efekt bölgesinin palet dışı payı ≤ kare 0 + 1 puan; > %50 palet dışı kare yok; beyaz pay ≤ %1,5 (EF-4); hiçbir satırın %60'ı beyaz değil.
- **EF-2:** efekt bir silüetin %50'sinden fazlasını 2 kareden uzun örtmez. Panel / pınar / sütun karelerinde maske ölçümü yapılır.
- **Kamera:**
  - `node tools/measure.mjs --look v3 --scenarios <anahtarlar> --camera-gate shots/v3/a56/baseline/measure-v3-a56-0.json` → her senaryoda `zoom.max = 1`, `closeUpCalls = 0`, `maxScrollPx` ve `focusCalls` ≤ taban (kalkan eğilmeler yüzünden A5 sahnelerinde azalır, artmaz).
  - Kaynak taraması yalnız eklenen satırlarda ve yeni dosyalarda (v1 dallarının `ctx.focus` çağrıları kalmak zorundadır): `git diff -U0 -- <şeridin düzenlediği dosyalar> | grep '^+' | grep -E '\bfocus\(|closeUp|setZoom|\.pan\(|descend\('` → 0 satır; yeni dosyalar için aynı `grep -E` doğrudan dosyalarda → 0 satır. (`\bfocus\(` `unfocus(`'u yakalamaz; `relax()` ve `unfocus` serbesttir.)
- **Ses:**
  - `measure` `sfx[]` × işaretler: d ≤ 1 kare (1× ve 3×).
  - Sürekli `lavaCreep` resmiyle biter (SE-2).
  - `clip.mjs`: tepe ≤ −1 dBFS, kırpılan örnek 0 (SE-6).
  - Ayna'nın cam sesleri Ejder'in rollerine karşı LSD ≥ 10 dB.
  - Kullanıcıya MP4 (SE-8).
- **Az hareket:** `?motion=reduced` ile sahne filmleri; titreme ve aşma yok, süreler ≤ normal.

### 6.5 Testler (`npm run typecheck`, `npm test`)

**Yeni testler:**

`tests/art/cardface-v3.test.ts`:
- 20 v3 yüzünün **çerçeve bölgesi** (yüz − resim penceresi) ve 11 yeni resmin tamamı yalnız `PAL`'da. 9 eski resmin penceresi (7 eski canavar + Titan + Yılan) muaftır: eski kuşaktır (§3.7.2) ve ayrıca sayılır (raporlanır, düşürmez).
- 11 resimde yalıtık piksel ≤ %10 (IŞ-10) ve ≤ 20 renk.
- Ölçüler değişmedi: 48×68, 44×34, 18×26, iso 50×30.
- Kapı kuralı: `hasV3Art` false → eski resim.
- Yaşayan resim kareleri deterministik (iki çizim bayt bayt aynı) ve palet içi.
- `&cards=v1` (`V3_CARDS` kapalı) → v1 yüzüyle bayt bayt aynı.
- Arka yüz satırlarına dokunulmadı: `cardBackCanvas(p)` A5-B açık / kapalı aynı.

`tests/art/cutin-magus-relight.test.ts`:
- Büyücü'nün `lightFrom: 'right'` kareleri soldan farklı, gözler aynı; bütün kareler yalnız palet.

`tests/cinematics/a5-spells.test.ts`:
- Auraların v3 fabrikaları `dispose`'ta temizlenir (nesne sayısı sabit).
- Ayna'nın sırası uzaklığa göre.
- Volkan vuruş aralığı ve genel `statChange` sırası ≥ 150 ms.
- v3 Volkan ambiyansı tam ekran nesne kurmaz (`wash` / ısı rasterı yok).
- `REDUCED_MOTION`'da sahne süreleri ≤ normal.

`tests/audio/a5-sounds.test.ts`:
- 23 tarif çevrimdışı çiziliyor, NaN yok, tepe ≤ −1 dBFS.
- Sürekli liste `V3_SPELL_SUSTAINED` doğru.

**Mevcut testler:** hepsi geçer. A4.1 iş akışının testlerine dokunulmaz.

### 6.6 Tabanlar

- **Ortak taban (A56.0):** `shots/v3/a56/baseline/{slicefilms-a56-0, measure-v3-a56-0.json, card-hashes-v3-a56-0.json, a5films-0}`. A5 şeritleri yalnız bununla karşılaştırır; taban yazmaz.
- **Ardıl taban (A56.Z, tek):** `slicefilms-a56`, `measure-v3-a56.json`, `card-hashes-v3-a56.json`, `a5films`. Bilerek değişenler: kart ön yüzünün göründüğü her film (A5-B); `spBoltAce` (kuşanma işareti); `spHeal*`, `spBlade*`, `spVolcano*`, `tbMirror*`, `tbChasm*`, `spRecallSet`, `spHealSet`, `sliceMagusReviveSet` (bırakma), `spRecall*` ses listeleri; kamera alanlarında A5 sahnelerinin `focusCalls` / `maxScrollPx` düşüşü.
- **`sheet-hashes-v3-pilot.json`:** değişmez.

---

## 7. Riskler ve açık sorular

### 7.1 Riskler

1. **Dört şerit aynı ağaçta.**
   - Önlem: §5.0.7 sahiplik tablosu; kayıt dikişleri, kancalar ve sözleşmeler A56.0'da bir kez yazılıp dondurulur; şeritler arası arayüzler taslakla başlar (S-9, S-11, S-12, S-13).
2. **A5 ve A6 aynı filmleri değiştirir; tabanlar birbirini kirletebilir.**
   - Önlem: kill-switch'ler (§5.0.3), A56.0'dan sonra tek ortak taban, A56.Z'de tek ardıl taban.
3. **v1 kart dokuları bugün hiçbir kapının kapsamında değil.**
   - Önlem: `card-hash` (A56.0). Bütün yeni kod şerit bayrağı arkasında.
4. **Yaşayan resim: determinizm ve maliyet.**
   - Saat gösteri saatinden okur. Yalnız kare değişince 48×68'lik doku yenilenir: 11 doku, ≈ 7 fps.
   - `texmem` ve kare süresi raporlanır. Sorun çıkarsa S2 kapatılır, f0 kalır.
5. **Koyu kart koyu arenada kaybolabilir; yön kullanıcının zevkine bağlı.**
   - Önlem: tek trim + ink kontur; kontrol noktası A56.K B-1'den hemen sonra; kullanıcı onaylamadan resim adımları sürmez.
6. **Eski çizimli canavarlar yeni vuruşlarda.**
   - Poz çizilmez; kenar ışığı, buhar, kor ve düşüş sprite'tan bağımsızdır.
   - Tüm sprite'ı boyayan, ölçekleyen ya da kaydıran yol yasaktır (§3.0).
7. **Ayna paneli savunanı örtebilir.**
   - Yerleşim: şeridin savunana yakın üçte biri, ≤ 40 px. EF-2 ölçümüyle denetlenir.
8. **Cam tınılı Ayna sesleri Ejder'in camına benzeyebilir.** Önlem: farklı dizi ve levha tınısı; LSD ≥ 10 dB kapısı.
9. **Yer Yarığı girişi kesmez.** Giriş (asta cut-in dahil) karar penceresinden önce oynar. Bu planla kazanılan: A6 hızlı yoluyla çağırma bitişi → yarık ≤ 300 ms ve sahnenin kendisi ≤ 1,7 sn. Gerçek kesme çağırma tabanı (`_v3/summon.ts`) ya da motor değişikliği ister; A7 / veriye dayalı etki sistemi işine ertelendi ve kullanıcıya A56.Z'de söylenir.
10. **Kamera eğilmelerinin kalkması "kamerayı değiştirme" olarak okunabilir.** Altı küçük eğilme yeniden yazılan anlarla gider (K1); kalan bütün çağrılar aynıdır. Kullanıcıya açık soru olarak gider (S6); "korunsun" derse aynı çağrılar A5-A'nın v3 sahnelerine aynen geri konur ve `focusCalls` kapısı "= taban" olur.

### 7.2 Açık sorular (varsayılanlarla)

- **S1 — Titan ve Yılan'ın kart resmi ve giriş portresi ne zaman görünsün?** **Karar (inceleme):** sprite'larıyla birlikte, A4.1 entegrasyonunda (§5.4).
- **S2 — Eldeki ve inceleme panelindeki kart resimleri hafifçe canlansın mı?**
  - **Varsayılan:** evet; yalnız 11 yeni resim; ≤ 2 px hareket / palet döngüsü, ≈ 7 fps.
- **S3 — Yeni koyu çerçeve 20 kartın hepsine mi?**
  - **Varsayılan:** evet. En büyük görünür fark budur; eski resimler yeni çerçevenin içinde kalır. A6'nın v3 arka yüzü ve HUD'u aynı aileden gelir. Kontrol noktasında kullanıcı görür.
- **S4 — Ayna Kalkanı'nda bütçe artışı kabul mü?**
  - **Varsayılan:** evet. Kurban başına +0,25 sn, en çok 2,6 sn. Bugün 3,0–3,15 sn.
- **S5 — As olmayan çağırmada ≤ 0,4 sn'lik "isim damgası" olsun mu?** **Karar (inceleme):** evet, zorunlu (B-8).
- **S6 — Yeniden yazılan anlardaki küçük kamera eğilmeleri (Kılıç, Volkan, Ayna, Yarık; A6'da deste bitmesi, oyun sonu) kalksın mı?**
  - **Varsayılan:** kalkar (kamera bu anlarda tamamen sabit); kalan bütün kamera davranışı bugünkü gibi.

---

## 8. Tahmin (ajan-saat)

| Adım | Şerit | Ajan-saat |
|---|---|---|
| A-1 kit + motifler + ses iskeleti | A5-A | 4 |
| A-3 Volkan Arenası + alan auraları + ambiyans | A5-A | 5,5 |
| A-3b genel `statChange` v3 (`flow/stats.ts`) | A5-A | 1,5 |
| A-4 Ayna Kalkanı | A5-A | 5 |
| A-5 Yer Yarığı | A5-A | 5 |
| A-2 Ejder Kılıcı + kuşanma aurası | A5-A | 5 |
| A-6 Şifa Pınarı | A5-A | 3 |
| A-7 Ruh Çağrısı kalanları | A5-A | 1,5 |
| A-8 ses geçişi + 2 eleştiri turu + az hareket dalları + filmler / MP4 | A5-A | 7 |
| **Şerit A5-A** | | **≈ 37,5** |
| B-1 çerçeve, bindirmeler, kancalar (+ kontrol noktası çiftleri) | A5-B | 5 |
| B-4 11 saha simgesi | A5-B | 2 |
| B-3 8 büyü / tuzak resmi | A5-B | 9 |
| B-2 3 canavar resmi | A5-B | 3 |
| B-8 giriş damgası (zorunlu) | A5-B | 2 |
| B-5 yaşayan resim (S2) | A5-B | 4,5 |
| B-9 Büyücü cut-in P2 relight (eski A-9) | A5-B | 3 |
| B-7 2 eleştiri turu + yan yana sayfalar + filmler | A5-B | 4 |
| **Şerit A5-B** | | **≈ 32,5** |
| **A5 şeritleri toplam** | | **≈ 70** |

Ortak adımlar (A56.0 ≈ 14, A56.K ≈ 1,5, A56.Z ≈ 7) ve A6'nın şeritleri (≈ 82,5) A6 planındadır; iki planın toplamı ≈ 175 ajan-saat (önceki iki plan: 87 + 84 = 171). Duvar zamanı §5.0.1'de: ≈ 58 saat + kontrol noktası beklemesi.

Bu revizyonda A5'ten çıkan: Titan / Yılan portreleri ve kart işleri (≈ 11 sa, A4.1 entegrasyonuna). Giren: zorunlu giriş damgası, az hareket dallarının şimdi bağlanması, kontrol noktası payı. Kapsam küçülürse önce düşecek: S2 (4,5 sa).

---

## 9. İnceleme notları

İncelemenin bulgularının hepsi uygulandı; aşağıdakiler değiştirilerek uygulandı ya da kısmen reddedildi (her biri tek satır):

- **Bulgu 1 (kamera):** uygulandı; ek olarak, eğilmelerin kalkması kullanıcının "kamerayı değiştirme" sözüne dokunduğu için açık soru S6 eklendi (varsayılan: kalkar).
- **Bulgu 3 (kill-switch):** `&a5=off` / `&a6=off` yerine şerit düzeyinde `&a5=off|a|b`, `&a6=off|a|b` kullanıldı; aynı plandaki iki şerit de birbirinden ayrılabilsin diye. `&cards=v1` A5-B'nin alt bayrağı olarak kaldı.
- **Bulgu 4 (sıra):** A-9 (Büyücü P2) şerit A5-A'dan A5-B'nin sonuna taşındı (B-9); B-6'nın çıkmasıyla A5-B boşaldı, iki şerit dengelendi.
- **Bulgu 5 (kontrol noktası):** uygulandı; yalnız A5-A yön onayını beklemez (büyü / tuzak dili A2 diliminde kullanıcı onayından geçti), öteki üç şerit onaya kadar görsel dil işi yapmaz.
- **Bulgu 6a (FRAME_V3):** FRAME_V3 "A5 B-1'in dolduracağı taslak" olarak değil, A56.0'da tam ve dondurulmuş olarak yazıldı; çünkü A6-B'nin HUD kabuğu ve A6-A'nın arka yüzü B-1 ile aynı saatte başlıyor.
- **Bulgu 9 (iki geçme ölçütü):** inceleme metni bu bulgunun ortasında kesik geldi; "≥ %50 yüz değişimi" ve "20 yüzün her pikseli palette" ölçütlerinin 9 eski resimli kartta kendiliğinden düştüğü okunarak düzeltildi (§1.1 G1, §6.5).
