# A6 — Küçük oyun olayları, HUD, açılış ve mezarlık paneli: yapım planı

`docs/ANIMASYON_PLANI.md` §6 A6. Durum: **plan, revize 1** (23 Ekim 2026, A5 / A6 incelemesinden sonra; değiştirilerek
uygulanan bulgular §9'da). Bu belge iki paralel yapım şeridinin (**A6-A:** kart nesnesi, el, yığınlar, mezarlık paneli,
arayüz sesleri; **A6-B:** HUD, akış, levhalar, hedefleme, geri bildirim, açılış) iş tanımıdır. A5 ile birlikte tek ortak
ön adım (A56.0), bir kontrol noktası (A56.K) ve tek ortak kapanışla (A56.Z) yürür; ortak düzen §5.0'dadır ve `A5_PLAN.md`
§5.0 ile birebir aynıdır. Kod kimlikleri İngilizce, metin Türkçe. Öncelik: kullanıcı kararları > CLAUDE.md altın kuralları >
`docs/v3/REHBER.md` > bu belge. REHBER EF-8'in "büyük anlarda 2× yakın çekim" izni bu iş için geçersizdir (kullanıcı:
"Kamerayı değiştirme, böyle iyi"); orkestratör EF-8'i ve ANIMASYON_PLANI §3'ü şeritler başlamadan günceller. Envanter kaynağı
`docs/v3/A0_ENVANTER.md` §3.1, §3.2, §4 ve `docs/v3/a0/akis-arayuz.md`.

**Orkestratör kararı (23 Ekim, kullanıcının "kamerayı değiştirme" sözüne göre; S6 kapandı):** bugünkü kamera davranışı v3'te
**aynen kalır**. §0'da "v3'te kalkanlar" denen deste bitmesi (`flow/end.ts:39`) ve oyun sonu (`flow/end.ts:140`) eğilmeleri
de **kalır**: yeni v3 gövdeleri bugünkü eğilmeyi aynı hedefe ve aynı ana karşılık gelen vuruşta çağırır. Yeni kamera hareketi
eklenmez, var olan kaldırılmaz. Kamera kapısı: `focusCalls` ve `maxScrollPx` ortak tabana **eşit** (± bir kare).

Bu planın kanıtları (bugünkü v3 görünümünün filmleri, kırpımları ve arayüz denemesi)
`shots/v3/a56/a6plan/` altındadır (git dışı): `v3-<senaryo>.png` (36 kare × 50 ms, `--fresh`),
`v3-opening.png` (açılış, 30 kare × 200 ms), `z-*.png` (kırpım / büyütme), `ui/*.png` (gerçek fare ile arayüz durumları).
Süreler `shots/v3/a3/baseline/measure-v3-pilot.json`'dan ve açılış için `shots/v3/a0/perf/opening.txt`'ten (oyun saati,
1×, deterministik) okundu.

---

## 0. Bağlayıcı kararlar ve sınırlar

| Konu | Karar |
|---|---|
| Kamera | **Sabit (kullanıcı kararı).** A6 kodu hiçbir `focus` / `ctx.focus`, `closeUp`, zoom, kaydırma, takip, yumruk (punch-in) ya da letterbox çağrısı **eklemez**. Eklenebilecek tek çağrı bugünkü `unfocus` güvenliğidir (ekran uzayında kart uçurmadan önce kamera dinlenmiyorsa geri alır; dinleniyorsa işlemsiz); v3 gövdeleri onu bugünkü yerlerinde aynen çağırır (`flow/draw.ts:23`, `flow/turn.ts:38`, `flow/discard.ts:114`, `summon-b/set.ts:35`, `flow/end.ts:84, :116, :170`). **Olduğu gibi kalanlar** (A6 dokunmaz): açılışın inişi (`CameraRig.descend`) ve yazı-tura eğilmesi (`flow/opening.ts:163`) — F0'ın kancaları bu kodun dışındadır; ilan ve savaş eğilmeleri (`battle/declare.ts:81, :389`; `battle/battle.ts:111, :380`); tuzak açılışının eğilmesi ve 1 px sarsıntısı (`traps/_opening.ts:469`); çağırma çemberi eğilmesi (`_core/helpers.ts:373`); A2 dilim ve eski canavar sahnelerinin eğilmeleri; bugünkü küçük sarsıntı ve hit-stop'lar. **v3'te kalkanlar** (yeniden yazılan akışlarla birlikte; v1'de aynen durur): deste bitmesi (`flow/end.ts:39`) ve oyun sonu (`flow/end.ts:140`) eğilmeleri; A5'te Kılıç, Volkan, Ayna ve Yarık eğilmeleri (A5 §0 K1). Kullanıcıya A56.Z paketinde açıkça söylenir (açık soru S6). Kapı §6.3. |
| Büyük fark nereden gelir | Kamera değil; sabit kadrenin içinde çizim, hareket, efekt, ışık ve ses. Oyuncunun **sürekli gördüğü** şeyler: HUD (ekranın ≈ dörtte biri), el, sahadaki kapalı kartlar, kart yolculukları, sıra / aşama, LP, hedefleme ve geri bildirim; ve her oyunun ilk ekranı olan açılış. |
| Piksel dili | 640×360, tam sayı konum, 1 px kontur, palet (`src/art/palette.ts`), basamaklı ışık (REHBER EF-6). HD / 3B / yumuşak / yuvarlak görünüm yok (REHBER §0.3, EF-4, EF-7, EF-14 bağlayıcı). HUD, kart ve arka yüz tek dilde: `src/art/frame-v3.ts` (A56.0, sözleşme S-1). |
| v1 | Piksel ve zaman olarak birebir aynı kalır. Bütün yeni davranış şerit bayrağının arkasında (`V3_A6_A`, `V3_A6_B`; `src/view/v3flags.ts`); `LOOK_V3` tek başına yeni davranış açmaz; v1'de A6 işleyicisi kaydolmaz, A6 dokusu üretilmez. |
| Canavarlar | A4'ün kalan yedi canavarı beklemede. A6 hiçbir canavar çizimine dokunmaz (`sheet-hash` v1 / v3 değişmez). Canavar gövdesi kullanan küçük olaylar (kurban, zafer) gövdeyi yalnız mevcut animlerle ve kontur / ışık katmanıyla sunar. |
| Diğer iş akışları | A5 (büyü / tuzak sinematikleri, kart yüzleri ve resimleri, girişler) ile dosya sınırı ve sözleşmeler §5.0.4 / §5.0.7'de. A4.1 benzerlik kapısı (`tools/sameness.ts`, `tools/lib/sameness-metrics.ts`, `src/art/monsters-v3/_magma_titan.ts`, `_coral_serpent.ts`) asla planlanmaz, dokunulmaz. İptal edilen sinematik kamera denemesinin ağaçta izi olmaması A56.0'ın önkoşuludur (§5.0.1). |

---

## 1. Hedef ve "büyük fark" ölçütü

### 1.1 Oyuncunun ilk bakışta fark etmesi gerekenler (telefonda, 1×)

| # | İlk bakış | Bugün (v3 = v1) | A6 sonrası |
|---|---|---|---|
| G0 | **Açılış bant değil, yerinde bir an** | İniş ve yazı-tura iyi; 3,8 sn'de düz beyaz tam genişlik bant, 3,8–5,2 sn altın tam genişlik "DÜELLO!" bandı ve odak çizgileri, dağıtım bandın altında; HUD tek karede beliriyor; hemen ardından kızıl tam genişlik "OYUNCU 2 · TUR 1" bandı (`v3-opening.png` #19–#29). | İniş, düellocular ve yazı-tura aynen (kamera dahil). "DÜELLO!" küçük altın levhada harf harf damgalanır; zeminde basamaklı ışık dalgası; HUD kenarlardan tam piksel kayarak gelir; dağıtım açıkta; ilk tur küçük tur levhasıyla başlar (F0, F1). |
| G1 | **Sahayı kapatan pankart yok** | Her tur başında ~1 sn tam genişlik camgöbeği / kızıl bant (`z-turnP1-a.png`, `z-turnP2.png`); Savaş Aşaması'nda kızıl bant + HUD dahil kırmızı kenar vinyeti (`z-battle.png`); zaferde tam ekran ışınlar (`z-victory.png`). | Olay, sahibinin tarafında küçük bir levha (≈ 112×20 px) + sahada basamaklı ışık dalgası olarak okunur. Tam genişlik bant, tam ekran karartma ve ışın yok. |
| G2 | **El yeni görünüyor** | Döndürülmüş yelpaze (kesirli döndürme, testere kenar), ADD parıltı halkası, 150 ms kalkış (`ui/03-hover.png`). | Dik, keskin kartlar; yalnız y eğrisiyle yelpaze; her kart 1 px nefes alır; oynanabilir kart 1 px kenar + kenarda koşan ışık düğümü; üzerine gelince ön-hazırlıklı kalkış ve tam piksel oturma; elin üstünden geçerken nota merdiveni. |
| G3 | **Kartlar katı nesneler olarak yolculuk eder; sahadaki kapalı kart yeni** | Çekmede döndürülmüş kart arkası, oynamada her karede yeniden örneklenen gürültülü yüz (`z-normal.png` #2–#3), koymada camgöbeği dolu ped (`z-set.png` #6–#8); kapalı kart deste ikonuyla karışıyor. | Tek kart dili: tam piksel yay, sadeleştirilmiş hareket kareleri, zeminde titrek (dither) gölge, sahip tonunda kısa iz, inişte 2 karelik 1 px kenar + toz + pedde bir ton ışık. Sahip tonlu v3 arka yüz **A6-A'nın ilk adımında** her yerde birden: el, mini el, saha, yığınlar, açılışlar (S-2). |
| G4 | **Her küçük olay zemini aydınlatır** | Işık katmanı v3'te açık ama küçük olaylar v1 çağrıları (ADD parıltılar). | Deste pedi çekmede, ped koymada, mezarlık pedi kabulde, taraf pedleri tur başında **bir ton** yükselir (basamaklı, yerel). |
| G5 | **LP sayacı mekanik bir sayaç gibi döner** | Panel tamamen pembe / yeşil boyanıyor, "-500" çipi, toplu sayı (`z-atkTD.png` #20). | Hane hane dönen odometre (tam piksel), çubuk 4 px basamaklarla erir, yalnız panel kenarı 2 kare yanar, ≤ 400 ms. |
| G6 | **Her tıklama tıklanan yerde yanıt alır** | Geçersiz tıklamada yalnız alt satırdaki metin değişiyor (`ui/06-invalid-40ms.png`, `ui/12-attack-invalid.png`); hedefte canavarın kendisi işaretlenmiyor (`ui/05-target-pick.png`). | Aday canavarlarda nefes alan nişan köşeleri; imleç altındakinde kilit; onayda köşeler gövdeye kapanır; geçersizde tıklanan yerde kızıl ret damgası + 2 px sarsıntı. |
| G7 | **Tutarlı bir arayüz ses ailesi** | Ortak v1 sesleri (`uiHover`, `cardPlace`, `lpTick`…). | Tek tınıda (neon cam + keçe) kısa, sessiz, kareye bağlı 30 civarı ses; karakter seslerinden ayrışır. |
| G8 | **HUD yeni görünüyor** | İki LP paneli, aşama çubuğu, SAVAŞ / TURU BİTİR, araç çubuğu ve ipucu satırı v1 dilinde: bevel'li parlak gövde, ADD parlama, dolu renkli paneller; ekranın ≈ dörtte biri (`ui/01-idle.png`). | Kartlarla aynı dil: koyu gövde + tek trim (`frame-v3.ts`), ink kontur, keskin basma; etkin oyuncunun panelinde trim boyunca koşan ışık düğümü (F10). |

Mezarlık inceleme paneli (yeni) bu listeye işlev olarak eklenir: bugün mezarlığa tıklamak hiçbir şey
yapmıyor (`ui/09-grave-click.png`), üst kart dışındakiler görülemiyor.

### 1.2 v3'te artık olmayacaklar (yasak listesi)

Küçük olaylarda, açılışta ve A6'nın dokunduğu her görünümde: tam genişlik bant / pankart (açılıştaki "DÜELLO!" bandı
dahil); ekranın tamamını ya da HUD'u boyayan flaş, vinyet, karartma, ışın; kesirli ölçekli ya da döndürülmüş kart / sprite;
ADD parıltı dokusu ve yumuşak hale; canavar sprite'ını baştan sona tek renge boyama (`addGlow`, `setTintFill` ile "hazır" /
"kurban" parlaması); beyaz dolu kart karesi; HUD'un tek karede belirmesi; yeni kamera hareketi.

### 1.3 Ölçülebilir hedefler (bugünkü v3 → A6)

| Olay (senaryo) | Bugün | Hedef | Girdiyi kilitleyen kısım |
|---|---|---|---|
| `gameStart` (açılış filmi, `?mode=hotseat&seed=1&holdIntro=1`) | 5333 ms | **≤ 5333 ms** (A0 hedefi ≤ 5,5 sn) | açılış (bugünkü gibi atlanabilir, ×4) |
| `skipIntro` açılışı + ilk tur | 2750 ms | ≤ 2750 ms | — |
| HUD gelişi (`hudIn`) | 1 kare | 160–240 ms tam piksel kayma | kilitlemez |
| Tur sonu → yeni oyuncuda girdi (`flowTurnP1`, `flowEndPhase`) | 2033 ms | **≤ 1250 ms** | — |
| `turnStart` | 1166 ms | ≤ 600 ms | ≤ 450 ms |
| `phaseChange` çekme / ana / bitiş | 150–183 ms | ≤ 150 ms | ≤ 120 ms |
| `phaseChange` savaş (`flowBattle`) | 1216 ms | ≤ 300 ms | ≤ 300 ms (+ ≤ 250 ms süs kuyruğu) |
| `draw` | 366 ms | 330–360 ms | ≤ 330 ms (bugünkü gibi) |
| `setMonster` / `setSpellTrap` (`smbSetMonster`) | 766 / 767 ms | ≤ 400 ms | ≤ 400 ms (+ ≤ 200 ms kuyruk) |
| Kurbanla koyma (`smbSetTribute`) | 433 + 767 ms | ≤ 500 + 400 ms | — |
| `discard` 1 / 2 kart (`flowDiscard`, `flowDiscard2`) | 983 / ~1166 ms | ≤ 800 / ≤ 950 ms | — |
| `lpGain` (`lumenGain`, `spHeal`) | 583 ms | ≤ 400 ms | — |
| LP akışı (`damage`) | ≤ 400 ms (A2) | ≤ 400 ms | — |
| Karar, **çağırma** penceresi, CPU / senaryo yanıtı (`tbChasm`: çağırma sonu → activate) | 317 ms (bütün kapalı kartlar işaretlenir) | **≤ 120 ms**, işaretleme yok (`A6_MS.decisionFast`, S-15) | ≤ 120 ms |
| Karar, saldırı penceresi ya da insan yanıtı | 317 ms | ≤ 300 ms (işaretleme kalır) | ≤ 300 ms |
| `deckOut` (`flowDeckOut`) | 2650 ms | ≤ 1400 ms | — |
| `gameOver` (`flowLethal`, `flowSurrender`) | 3450 ms | 3000–3500 ms | — |
| Hedef seçme: adaylar görünür | < 1 kare (yalnız zemin) | ≤ 100 ms (gövde köşeleri) | kilitlemez |
| Geçersiz tıklama yanıtı | yok (yalnız metin) | 1 kare içinde başlar, ≤ 180 ms | kilitlemez |
| Mezarlık paneli aç / kapa | yok | ≤ 220 / ≤ 140 ms | panel kipi |

Kural: **hiçbir olay girdiyi bugünden uzun kilitlemez.** Süslü kuyruklar girdi döndükten sonra en çok
250 ms sürer ve bir sonraki eylemle iptal edilebilir (KO-6). Tablonun tamamı A56.0'da `A6_MS`'e (testli) yazılır.

### 1.4 Yan yana ilk bakış testi (eski | yeni)

A56.0'da çekilen "önce" kareleri (`shots/v3/a56/before/`) ile "sonra" karelerinden aynı oyun anındaki 11 kare,
**1× (640×360, büyütmesiz)** yan yana konur (`tools/sbs.mjs --x1 --page`):

0. açılış (+3,9 sn, "DÜELLO!" anı); 1. ana aşamada boşta el + HUD; 2. bir kartın üzerine gelme (+120 ms); 3. tur başı
(+300 ms); 4. Savaş Aşaması (+150 ms); 5. LP kaybı (rulo ortası); 6. hedef seçme (adaylar + imleç altı); 7. geçersiz
tıklama (+60 ms); 8. kapalı koyma (iniş +40 ms); 9. mezarlık paneli açık; 10. zafer (+1,2 sn).

**Geçme:** bağımsız bir eleştirmen (ajan) her çiftte 1×'te **en az 3 somut fark** sayar ve **yeni kareyi tercih eder**.
Geçmeyen çift düzeltilmeden kullanıcıya gitmez. "Yeni kareyi bulabilmek" ölçüt değildir (her değişiklik bunu sağlar).
Çiftler 1, 2, 3, 8 ve 5 kontrol noktasında (A56.K, §5.0.5) erkenden gider; tam sayfa ve sesli MP4'ler A56.Z ile gider.
Son karar kullanıcının.

### 1.5 Telefonda okunurluk

Telefon yatay ekranında oyun ≈ 1,1–1,5× görünür. Kurallar: metin en az `sm` boy, koyu zemin üstünde
açık ton ve 1 px mürekkep kontur; bilgi yalnız renkle verilmez (biçim + metin); hedef köşelerinin bacağı
≥ 4 px; dokunma hedefleri ≥ 24×20 oyun pikseli (mezarlık paneli kapat düğmesi 32×20); levhalar ≥ 12 px
yüksek; hiçbir okunur öğe 1 kareden kısa görünüp kaybolmaz (en az 3 kare).

---

## 2. Envanter: bugünkü v3 durumu

### 2.1 Girdi kilidi nasıl işliyor

`DuelController.execute` motor sonucunu uygular, `lock(true)` ile eli (`hand.setEnabled(false)`),
HUD'u (`hud.setLocked`) ve düğmeleri kapatır, `Director.play` ile partinin bütün olaylarını oynatır,
sonra kilidi açar (`src/duel/DuelController.ts`). Bir işleyici bitince kilit değil, sıradaki olay başlar;
girdi partinin son işleyicisi bitince döner (`measure.mjs` → `inputReadyMs`). İşleyiciler süslü
kuyrukları `bg(...)` ile arka planda bırakabilir (ör. `flow:draw` 330 ms'de biter, iniş vuruşu kuyrukta).
Basılı tutunca ×3 hızlandırma yalnız bir sinematik oynarken mümkündür (`SpeedControl.canHold`).
Gösteri saati (`src/duel/showclock.ts`) hız, hit-stop ve duraklatmayı her alt sisteme uygular.

Olay işleyici zincirleri (v3'te `__neon.duel.handlers()`): akış olayları `flow:*` (öncelik 0), set /
çevirme / pozisyon `summon-b:*` (0), karar / Geç / LP `tb:*` (0, `src/cinematics/battle/`), `target`,
`destroy`, `toGraveyard` yalnız varsayılan (−100). Küçük olayların **yalnız** şunlarında v3 dalı var:
`positionChange` (`positionV3`), `responseDeclined` (tam piksel "Geç"), `damage` (`impactNumber`, LP ≤ 400
ms), yok edilme (`destroyV3`: A2 ölüm kiti) ve mezarlığa gidiş (`_v3/card.ts cardLeaves`). El, HUD,
InspectPanel, PileView, CardPicker, Prompt ve akış kiti (`src/cinematics/flow/**`: açılış, çekme, tur, aşama, atma,
deste bitmesi, oyun sonu) v1 ile aynı. Bugünkü varsayılan ekranın 2× görüntüsü:
`shots/v3/a56/a6plan/handlers.png` (sakin arena + v1 HUD + tek kartlık el; kapalı kart ikonu deste ikonuyla aynı).

**Açılış ve karıştırma:** `flow:gameStart` işleyicisi (`flow/opening.ts:327–394`) iki `shuffle` olayını ve açılış
çekmelerini kendisi tüketir; `riffle()`, `duelStart()` ("DÜELLO!" bandı, :383) ve `deal()`'ı çağırır. Motor `shuffle`'ı
yalnız oyun başında yayar (`engine/rules.ts:123`); bu yüzden `flow:shuffle` işleyicisi (:397) gerçek oyunda **hiç
çalışmaz**. A6'nın açılış kancaları bu yüzden `gameStart`'ın içindedir (§5.1).

### 2.2 Öğe envanteri

| # | Öğe | Bugün (dosya : fonksiyon) | Ne görünüyor / duyuluyor (kanıt) | Ölçülen | Zayıf | Hedef |
|---|---|---|---|---|---|---|
| F0 | **Açılış** (gameStart) | `flow/opening.ts flow:gameStart` (`CameraRig.descend`, `duelistEnter`, `coinToss`, `riffle`, `duelStart` bandı, `deal`, `hud.setVisible`) | İniş + ışınla gelen düellocular + holografik yazı-tura iyi; 3,8 sn'de düz beyaz tam genişlik bant (#19), 3,8–5,2 sn altın tam genişlik "DÜELLO!" bandı ve odak çizgileri, dağıtım bandın altında; HUD tek karede beliriyor; hemen ardından kızıl tam genişlik "OYUNCU 2 · TUR 1" (`v3-opening.png`) | 5333 ms (+ `turnStart` 1167) | EF-4 / EF-14 / KO-4 ihlali; HUD pat diye; A0 §3.1'deki hedef (yerel parlama, HUD kayarak, dağıtım açıkta, ≤ 5,5 sn) planlanmamıştı | §3 F0 |
| F10 | **HUD kabuğu** | `HudView` (LP panelleri, aşama çubuğu + tur rozeti, araç çubuğu, ipucu satırı), `Button` (`ui-textures` boyacıları) | v1 dili: bevel'li parlak gövde, ADD sheen, dolu renkli LP panelleri; ekranın ≈ dörtte biri (`ui/01-idle.png`) | — | en çok görülen yüzey; kartlarla ve sakin arenayla aynı dili konuşmuyor | §3 F10 |
| K1 | El: bekleme, üzerine gelme, seçme | `HandView.pose / layout / updateHover`, `CardSprite.hoverLift / setHighlight / punch` | Döndürülmüş yelpaze; oynanabilir kartlarda ADD parıltı + koşan kuyruklu yıldız; kalkış Back.Out 150 ms, komşular 220 ms; seçimde kesirli ezme; `uiHover` (`ui/03-hover.png`, `ui/04-menu.png`) | kalkış 150 ms | kesirli döndürme / ölçek; hale; el durağan (nefes yok) | §3 K1 |
| K2 | Kart çekme (deste → el) | `flow/draw.ts flow:draw` + `HandView.addCard` + `CardSprite.flyTo`; açılışta `opening.ts deal()` | İzometrik hayalet kalkar, döndürülmüş kart arkası parlak izle eli bulur; P2 sıcak koltukta üst desteden bütün sahayı aşarak alta iner (`z-turnP1-end.png`, `z-turnP2.png` #31–#35); `cardDraw`, `cardPlace` | 366 ms | döndürme + kesirli ölçek; açılışta dağıtım bandın altında (A0); P2 yolu uzun ve okunaksız | §3 K2 |
| K3 | Elden oynama (kartın payı) | `fx.takeHandCard`, `summon-b/_kit slamCard`, `TileCard.slamIn` | Kart elden kalkar, 3B raster ile dönerek iner; ara karelerde yüz her karede yeniden örneklendiği için gürültülü; uçuşta %20 büyüme; inişte beyaz tint (`z-normal.png` #1–#7) | karoya ~250 ms | ara kare gürültüsü; beyaz tint; büyüme | §3 K3 |
| K4 | Kapalı koyma | `summon-b/set.ts setCard` (`slamCard`, `sealClose`, `setPulse`, `tile.pulse`, `playSheen`) | Kapalı kart uçar, ped camgöbeği **dolu** yanar, beyaz elmas, mühür; kapalı kart deste / mezarlık ikonuyla karışıyor (`z-set.png` #6–#8, #15); `cardSlide`, `cardSet` | 766 / 767 ms | bütçenin 2 katı; dolu ped flaşı; kimin kartı okunmuyor | §3 K4 |
| K5 | Çevirme (yüzü açma, kartın payı) | `TileCard.flipUp` (+ `summon-b/flip.ts`) | Kart 16 px zıplayarak döner, aksan renginde tint; çevrilen kart ayağa kalkan canavarın altında (`z-flipatk.png` #3–#4) | 583 ms (saldırıya uğrama, A0) | tint yıkaması; zıplama yüksek | §3 K5 |
| K6 | Pozisyon değişimi | `summon-b/position.ts positionV3` + `TileCard.rotateTo` | Gövde A2'de çözüldü (`toGuard`/`fromGuard` ya da yarım turda poz değişimi); kart 90° dönüyor (`z-pos.png`) | 270–400 ms | kart dönüşünde ara kare gürültüsü, sessiz | §3 K6 |
| K7 | Kurban | `summon-a/tribute.ts` (`pixelStream`, `tileStream`, `fx.cardToGraveyard`) | Kurban **tam beyaz silüet**, sonra camgöbeği hologram, piksel akışı (`z-tribset.png` #1–#3) | 433 ms (koyma yolu) | beyaz silüet; **mezarlık sayısı titriyor** (§2.3) | §3 K7 |
| K8 | Elden atma | `flow/discard.ts burnOne` (`emberStream`, `burnAway`) | Kart kalkar, bütün kart altın renge boyanır, alttan yanar, pikselleri mezarlığa akar (`z-discard.png` #3–#11) — fikir güçlü | 983 ms | kesirli flip / ölçek; tüm kart tint; süre | §3 K8 |
| K9 | Mezarlığa gitme | `_v3/card.ts cardLeaves` (A2 sürekliliği) | Kart karosunda doğar, yay çizer, yığına iner, `cardPlace` | uçuş 200–360 ms | sayı `pile.count + 1` ile artırılıyor (§2.3); kabul anı zayıf | §3 K9 |
| K10 | Deste karıştırma | `flow/opening.ts riffle()` (yalnız `gameStart` içinden; `flow:shuffle` işleyicisi hiç çalışmaz) | İki izometrik hayalet kart; yazı-tura ile aynı anda, gözden kaçıyor (A0) | ~400 ms (açılış içinde) | yığının kendisi oynamıyor | §3 K10 |
| K11 | **Mezarlık inceleme paneli** | **yok** (`HumanInput` boşta `graveyard` tıklamasını işlemiyor; üzerine gelince yalnız üst kart InspectPanel'de, `HumanInput.hover`) | Tıklama hiçbir şey yapmıyor (`ui/08-grave-hover.png`, `ui/09-grave-click.png`) | — | işlev eksik | §3 K11 |
| K12 | InspectPanel, Ruh Çağrısı seçicisi | `InspectPanel` (v1 kolu), `CardPicker.pickCard` | Büyük kart + yumuşak aura + metin; hızlı taramada isim ve resim ~300 ms farklı kartlardan (A0); seçici ekranın ortasında, yığınlarla bağsız | — | tutarsız takas; yumuşak aura; bağsız seçici | §3 K12 |
| F1 | Sıra başlangıcı | `flow/turn.ts flow:turnStart` (`turnBanner`, `board.pulseSide`, `addGlow`, düellocu `command`) | Tam genişlik bant ~1 sn, harfler seyrek; canavarlar tüm-sprite parlaması (`z-turnP1-a.png` #4–#24) | 1166 ms | sahayı kapatır; 2× bütçe | §3 F1 |
| F2 | Aşama geçişi | `HudView.setPhase`; savaşta `phaseBanner` + `lightDimFor` + `addGlow` | Çubuk iyi ama tepede; savaşta kızıl bant + kızıl kenar vinyeti (HUD dahil) + saldırı pozisyonundaki canavarlar pembe / beyaz silüet (`z-battle.png` #1–#24) | 150–183 / 1216 ms | savaşta 4× bütçe; EF-4 / EF-14 ihlali | §3 F2 |
| F3 | LP değişimi | `HudView.setLp` (+ `battle/damage.ts tb:damage`, `_core/helpers.ts presentHeal`) | Panel tamamen pembe (kayıp) / yeşil (kazanç) dolu, çip, 2–5 px sarsıntı, `lpTick` (`z-atkTD.png` #18–#22); kazançta v1 `damageNumber` | kayıp ≤ 400, kazanç 583 ms | panel dolgusu; kazanç bütçe dışı | §3 F3 |
| F4 | Hedef seçme | `HumanInput.pickZone / pickOne / pickTributes` → `board.highlightZone` (sakin arenada köşeli zemin vurgusu); motor `target` → `_defaults/battle.ts` `lockOn` | Yalnız zemin vurgusu; canavar gövdesinde işaret yok; üstte talimat çubuğu ile altta ipucu satırı aynı şeyi söylüyor (`ui/05-target-pick.png`, `ui/11-attacker-picked.png`) | < 1 kare | gövde işaretsiz; çift talimat | §3 F4 |
| F5 | Geçersiz hedef / eylem | `HumanInput` → `hud.flashHint(...)` + `uiError` | Tıklanan yerde hiçbir şey yok; yalnız alt satır (`ui/06-invalid-40ms.png`, `ui/12-attack-invalid.png`) | metin 1,2–2,6 sn | yerinde yanıt yok | §3 F5 |
| F6 | Engelleme (blok) | `battle/battle.ts` (A2 v3 vuruş), `battle/damage.ts` | Saldıran geri teper, geri tepme hasarı sahanın tepesinde havada bir sayı (`z-flipatk.png` #7–#11) | — | "blok" okunmuyor; hasar kime gitti belirsiz | §3 F6 |
| F7 | Karar (tuzak penceresi), "Geç", sıcak koltuk perdesi | `battle/declare.ts tb:decision` (`setCardPulse` → `ctx.keep('trapPulse')`, `floorRing`, 300 ms bekleme), `Prompt.trapResponse`, `Prompt.passDevice` | İstem tahtayı karartıyor, kartlar ~0,6 sn kapalı; tuzak penceresinde de "SIRA DEĞİŞİYOR"; perde girerken tıklama yutuluyor (A0); çağırma penceresinde CPU yanıtında bile 317 ms bekleme | 317 / 316 ms | karartma; yanlış başlık; Yarık'ı geciktiriyor | §3 F7 |
| F8 | Deste bitmesi | `flow/end.ts flow:deckOut` (`ctx.focus` 1,07 + pan, hayalet kart, "DESTE BİTTİ!" bandı) | Kamera eğilmesi; kızıl tam genişlik bant (`z-mix2.png` 3. satır) | 2650 ms | bant; süre | §3 F8 |
| F9 | Zafer / yenilgi | `flow/end.ts flow:gameOver` (`ctx.focus`, `collapse` glitch, `beamDrop`, `banners.victory`), `Prompt.gameOver` | Kaybeden canavarlar aynı glitch'le çöker; tam ekran karartma; dev harf damgaları; tam genişlik altın bant + ekranı dolduran ışınlar ve havai fişekler (`z-victory.png`) | 3450 ms | EF-4 / EF-14 ihlali; karaktere özgü ölüm yok | §3 F9 |

### 2.3 Çekimde bulunan hata: mezarlık sayısı titremesi

`suTributeSet` filminde (`z-tribset-pile.png`) mezarlık sayısı 450 ms'de `1`, 750–1200 ms'de `2`,
1350 ms'den sonra yine `1`. Neden: `Director` her olay başladığında görünümleri izdüşen duruma eşitler
(`syncFrontier` → `FieldView` yığın sayısı = durumdaki mezarlık uzunluğu); `setMonster` başlarken yığın zaten
1'dir, kurbanın havadaki kartı inince `cardLeaves` `pile.set(pile.count + 1, cardId)` ile 2 yapar (`_v3/card.ts:154`),
partinin son eşitlemesi 1'e geri çeker.
Düzeltme (A56.0): iniş sayısı, sahibinin mezarlığının motor durumundaki uzunluğundan türetilir
(`ctx.stateNext` / `ctx.after`), körlemesine +1 yapılmaz. Kurbanlı çağırma, Yıldırım + kuşanma ve çoklu
ölümlerde aynı yol kullanıldığı için bu düzeltme bütün v3 mezarlık inişlerini etkiler (bilerek); ortak taban
(A56.0) bu düzeltmeden **sonra** yazılır, böylece hiçbir şerit onu kendi farkı sanmaz.

---

## 3. Öğe öğe storyboard

Her öğe: vuruşlar (ms, 1×), kareler / pozlar / VFX / ışık / ses; P1–P2; hız ×2 / ×3; azaltılmış hareket
(AH, `REDUCED_MOTION`); girdi. Kural kimlikleri §4.4'teki KO-1…KO-12. Bütün hareketler tam piksel; "aşma" (overshoot) en çok
2 px; "ışık +1" = basamaklı ışık katmanında ilgili pedin bir ton yükselmesi (EF-6). Seslerin adları §4.3.

**Hiçbir bütçe yükseltilmedi:** bütün hedefler REHBER §5 ve plan §5'in içinde ya da altında; girdi kilidi her
öğede bugünkü v3 değerine eşit ya da kısa. **Kamera:** hiçbir vuruş kameraya bağlı değil (§0); kamera önceki bir
olaydan eğik kaldıysa ekran uzayındaki kart uçuşlarından önce bugünkü `unfocus` güvenliği çalışır (dinleniyorsa
işlemsiz). Ekran sarsıntısı yok; sarsıntı yalnız HUD paneli / tek kart / ret damgası gibi küçük nesnelerde ve tam piksel.

### F0 — Açılış (gameStart) (şerit B; karıştırma ve dağıtım şerit A)

İniş (`CameraRig.descend`), düellocuların ışınla gelişi, yazı-tura, "OYUNCU n BAŞLIYOR!" yazısı ve yazı-tura eğilmesi
**olduğu gibi kalır** (kamera dahil; kancalar bu kodun dışında, §5.1). Değişenler bugünkü çapalara bağlıdır:

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Karıştırma (A, `V3HOOKS.riffle`) | para eve uçarken (≈ 3,2–3,7 sn) | K10 karıştırması iki destede, P2 60 ms kayık; yazı-tura sonucu göründükten sonra başlar | Deste pedleri +1; `ui3Riffle`, `ui3Shuffle` |
| "DÜELLO!" levhası (B, `V3HOOKS.duelPlate`) | 3,70 → +120 | Tur levhası bileşeninin büyük boyu (≈ 168×28 px; koyu gövde, 1 px altın trim, ink kontur; `frameRectV3`) tahta ortasının üstünde, dağıtım yollarının dışında iki palet basamağıyla belirir; harfler kare başına bir damgalanır. Beyaz ilk kare, tam genişlik bant ve odak çizgisi yok. | `ui3DuelStart` (kısa altın akor); müzik yoğunluğu bugünkü gibi |
| Zemin dalgası (B) | 3,70 → 4,06 | İki tarafın pedleri merkezden dışa bir ton yükselip söner (`pulseSide` + basamaklı ışık); kenar şeridi bir kez koşar | Pedler +1 dalga |
| HUD gelişi (B, `V3HOOKS.hudIn`) | 3,70 → 3,94 | Paneller kendi kenarlarından 2–3 tam piksel adımla kayarak gelir (P1 paneli sol alttan, P2 paneli sağ üstten, aşama çubuğu üstten, düğmeler sağdan), 40 ms kayık; tek karede belirme yok | `ui3PanelIn` (çok hafif) |
| Dağıtım (A, `V3HOOKS.deal`) | +420 ms'den | K2 açılış dağıtımı: 8 kart, oyuncular arasında sırayla 90 ms, toplam ≤ 1,2 sn; levhanın altından geçmez | `ui3Draw` / `ui3Land` |
| Levha çıkışı (B) | dağıtım bitince | Levha iki palet basamağıyla söner; ilk tur levhası (F1) kendi yerinde gelir | — |

Toplam ≤ 5333 ms (bugün). `skipIntro` (QA / "Tekrar Oyna"): tek karıştırma geçişi + dağıtım + HUD gelişi, ilk turla
birlikte ≤ 2750 ms. Atlama (tıklama / tuş → ×4) bugünkü gibi çalışır. AH: levha anında, HUD iki basamakla belirir
(kayma yok), dalga yok. Kamera denetimi: açılış filminin kamera izi (her karede scroll / zoom) `opening-camera-0.json` ile
aynı (dört şerit açıkken de); B'nin kimlik kapısında (`&a5=off&a6=b`) 0–2900 ms kareleri tabanla IDENTICAL (A6-A açıkken
deste yığınları v3 arka yüzü gösterdiği için bu kareler bilerek değişir) (§6.3).

### F10 — HUD v3 kabuğu (şerit B, B0; ilk adım)

HUD'un yerleşimi, boyutları ve tıklama alanları (`layout.ts UI`) değişmez; yalnız kabuk ve durum dili değişir. Dil
`frame-v3.ts`'tir (S-1): koyu gövde (night1 / night0 iki düz bant), 1 px ink dış kontur, köşe kırpımı, tek trim; bevel,
gradyan, dither ve ADD parıltı yok.

| Parça | v3 | Etkileşim / hareket |
|---|---|---|
| LP panelleri (P1 sol alt, P2 sağ üst) | Gövde + oyuncu tonunda trim (P1 camgöbeği, P2 kızıl); "OYUNCU 1" başlığı oyuncu tonunda; LP rakamları white + ink kontur; LP çubuğu oyuncu tonunda düz dolgu, 1 px ink çerçeve; deste / el / mezarlık sayaç ikonları bugünkü glifler, ink kontur | Etkin oyuncunun panelinde trim bir ton parlak ve trim boyunca tek ışık düğümü koşar (sakin arenanın kenar koşucusu dili; 2,4 sn tur); LP değişiminde **yalnız trim** yanar, panel dolgusu yok (odometre B2'de, F3) |
| Aşama çubuğu + tur rozeti | Gövde + nötr trim (mist / steel); hücre yazıları mist; etkin hücre oyuncu tonunda 1 px çerçeveli hap | İşaretçinin kayması F2 (B1) |
| SAVAŞ / TURU BİTİR | Gövde + tek trim (SAVAŞ crim2 / crim3, TURU BİTİR teal2 / teal3); ikon ve yazı trim tonunda | Üzerine gelme: trim bir ton yukarı + 1 kare beyaz trim; basma: 1 px aşağı (tam piksel); kapalı: trim iki ton aşağı, yazı night3; ret: F5 |
| Araç çubuğu (hız, ses, kayıt, menü) | Aynı düğme kabuğu, nötr trim | Aynı |
| İpucu satırı | Koyu levha + nötr trim | Ret flaşı F5 |

Uygulama: yeni `src/view/v3/hudSkin.ts` (`frameRectV3` üstünde panel / düğme / çubuk boyacıları); `HudView.ts` ve
`Button.ts` v3 dalları bunları seçer. `src/view/ui-textures.ts` değişmez. `Button` v3 kabuğu istemlerde, seçicide ve
başlık ekranı menülerinde de görünür (v3'te). ActionMenu ve LogView'un görünümü A7'dedir. AH: koşan düğüm durur.
Girdi: değişmez. Ölçü: kontrol noktasının "boşta ekran" çifti ≥ 3 somut fark; HUD bölgesi `palcheck` %100 palet;
`a6audit` 0; v1 `a6v1` IDENTICAL.

### K1 — El: bekleme, üzerine gelme, seçme (şerit A)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Bekleme | sürekli | Kartlar **dik** (döndürme 0); yelpaze yalnız y eğrisi (dış kartlar 1–4 px aşağı). Her kart 2400 ms periyotla 0 / −1 px nefes alır, faz kart başına 300 ms kayık. | — |
| Oynanabilir | sürekli | Kartın 1 px dışında sahibin tonunda (`PLAYER_RAMP[p][3]`) 1 px kenar; kenarda 3 px'lik ışık düğümü döner (beyaz baş, `ramp[4]`, `ramp[2]` kuyruk; A2 büyü açılışındaki `cardRim` dili). Düğüm fazı kart başına kayık. | — |
| Üzerine gelme | 0–100 | Kart 0 → −18 px (easeOutCubic, tam piksel); üst ve sol kenarda 1 px ışık şeridi (sol üst ışık kuralı). Komşular ±12 / ±7 / ±4 px açılır (120 ms). InspectPanel aynı karede kartı gösterir (K12). | `ui3Hover`: 30 ms yumuşak tık; perde elin içindeki sıraya göre pentatonik merdiven (eli taramak küçük bir arp gibi) |
| Oturma | 100–140 | −18 → −16 px. Kenar 2 kare beyaz, sonra sahip tonunda parlak. | — |
| Ayrılma | 0–100 | −16 → 0, aşma yok (Quad.Out). | — |
| Seçme (tıklama) | 0–40 | Basma: −16 → −13 px, kenar 2 kare beyaz. | `ui3Select` (iki nota yukarı) 0 ms'de |
| | 40–110 | −13 → −17 → −16 px; kenar altın (`PAL.gold3`), iki düğüm. ActionMenu 40 ms'de açılır (mevcut). | — |
| Ret (geçersiz el tıklaması, F5) | 0–150 | `hand.reject(uid)`: x +2, −2, +1, −1, 0 (30 ms adımlar), kenar 2 kare kızıl (`crim3`). | `ui3Error` |
| Kilitli el (sinematik) | sürekli | Kenarlar bir ton söner, düğümler durur; nefes sürer. | — |
| İşaretli (el sınırı atması) | 0–90 | Kart 9 px kalkar, kızıl kenar + düğüm. | `ui3Mark` / `ui3Unmark` |
| Dalga (perde, F7) | kart başına 30 ms | `hand.waveFaceDown(down, 30)`: kartlar sırayla keskin dönüş kareleriyle kapanır / açılır (S-9). | `ui3Flip` (seyrek) |

P2: sıcak koltukta P2 cihazı tutarken aynı el altta, kızıl rampayla. Rakibin mini eli panelinin yanında
kalır; sayı değişince mini kartlar tam piksel kayar; mini kartlar v3 arka yüzü gösterir (S-2). Hız: üzerine gelme / seçme
sahne saatinde (bugünkü gibi); ×3 basılı tutma yalnız sinematikte. AH: nefes, aşma, basma ve düğüm hareketi yok; kalkış
60 ms. Girdi: hiçbir zaman kilitlemez.

### K2 — Kart çekme: deste → el (şerit A)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Kalkış | 0–60 | Deste yığınının üst katmanı 3 px kalkar; sayı etiketi bir hane döner (1 kare beyaz rakam). | Deste pedi ışık +1 (200 ms); `ui3Draw` (kâğıt kayışı) |
| Uçuş | 60–260 | `CardV3` (arka yüz) yay çizer (tepe 20–28 px); döndürme yok, yolun hızlı orta %40'ında yöne doğru 1 px eğik (shear) kare; tahta üstündeyken zeminde titrek gölge; sahip tonunda 3 noktalık iz (30 ms'de bir). El yeniden yayılır (komşular 120 ms). | — |
| Dönüş (yalnız eli gören oyuncu) | 140–260 | Keskin dönüş kareleri: 48 → 34 → 18 → 4 (kenar karesi, 1 px beyaz çizgi) → 18 → 34 → 48 px genişlik, yüz yarıdan sonra; her basamak ≈ 20 ms; inişten önce biter. | `ui3Flip` kenar karesinde |
| İniş | 260–330 | Yuvasının 2 px altına iner, 1 karede yerine oturur; oynanabilirse kenar 2 kare beyazla belirir. İşleyici 330 ms'de biter (bugünkü gibi). | `ui3Land` (keçe tık) |
| Kuyruk | 330–450 | Komşuların son oturması. | — |

P2 / gizli el (vsBot, perdeli sıcak koltuk): kart arka yüzle rakibin mini eline uçar; yolun %60'ında iki
keskin boyut basamağıyla (36×51 → 24×34 raster) mini karta dönüşür; dönüş yok. Sıcak koltukta P2 eli
gördüğünde yol üst desteden alta uzar: uçuş yine 200 ms, gölge sahayı geçer. **Açılış dağıtımı** (`V3HOOKS.deal`, F0):
8 kart, oyuncular arasında sırayla 90 ms aralık, toplam ≤ 1,2 sn, üstünde bant yok. Hız: dönüş kareleri ×3'te
seyrelir, iniş karesi her zaman görünür. AH: 160 ms düz kayış, dönüş 2 kare (kenar, yüz), iz / gölge /
eğiklik yok. Girdi: ≤ 330 ms.

### K3 — Elden oynama, kartın payı (şerit A)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Bırakma | 0–50 | Kart elden 6 px kalkar, kenar 2 kare sahip tonunda. | `ui3Play` |
| Uçuş + yatış | 50–200 | `TileCard.slamIn` v3: 3B yol aynı, ama ara karelerde yüz **sadeleştirilmiş hareket yüzü** (kart çerçevesi + portrenin 3 tonlu düz bloğu + isim şeridi bloğu; "hareket LOD") ile çizilir: büyük düz şekiller döner, ince detay gürültüsü olmaz. Büyüme (`grow`) yok, beyaz tint yok; iz sahip tonunda piksel. | — |
| İniş | 200–240 | Statik izometrik doku; izometrik dış hatta 2 kare 1 px beyaz, 1 kare sahip tonu kenar; 4 tam piksel toz zerresi. Canavarlarda çağırma girişi (A2 / A4) buradan sürer. | Ped ışık +1 (r 24, 220 ms); `ui3Place` (keçe gümlemesi + cam tık) |

Büyü elden: A2 / A5'in v3 açılışı kartı `takeHandCard` ile alır ve kendi yolunu çizer (A6 dokunmaz; kart
`CardV3` olarak gelir, API aynı). P2 gizli el: kart mini elde arka yüzle doğar, uçar; çağırmada karoda açılır,
koymada kapalı kalır. AH: 120 ms düz kayış, LOD ara kareleri yok: 120 ms'de dik karttan izometriğe kesme +
kenar. Girdi: kartın payı çağırma bütçesinin içinde, ek süre yok.

### K4 — Kapalı koyma: `setMonster` / `setSpellTrap` (şerit A)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Uçuş | 0–220 | K3 yolu, arka yüzle; canavar kartı havada 90° döner (LOD kareleri) ve yan iner. | — |
| İniş | 220 | **v3 kapalı arka yüz** (S-2; A1'den beri her yolda): koyu arka yüz + sahibin tonunda 1 px trim ve amblem (deste / mezarlık / boş pedle karışmaz). 2 kare 1 px kenar, 4 toz zerresi. | `ui3Set` (kısa gümleme) |
| Mühür | 220–360 | Ped çizgisi bir ton yükselir; dört köşe işareti (sakin arenanın hedef vurgusundaki köşe dili) 3 px dışarıdan 0'a üç adımda kapanır. **Dolu ped yok.** | Ped ışık +1 |
| Kilit | 360–380 | Dört köşede 1 kare beyaz tık. İşleyici 380 ms'de biter. | `ui3Latch` (mandal tıkı) |
| Kuyruk | 380–560 | Köşe işaretleri iki palet basamağıyla söner; arka yüzde 1 px parlama çizgisi bir kez geçer (60 ms). | — |

Büyü / tuzak kartı dik iner, aynı mühür. Kurbanla koyma: önce K7. P2: ayna, kızıl tonlar. AH: toz ve
parlama yok, mühür yalnız 1 kare köşe tıkı, toplam ≤ 300 ms. Girdi: ≤ 400 ms (bugün 766).

### K5 — Çevirme: yüzü açma, kartın payı (şerit A)

`TileCard.flipUp` v3: 0–40 basma (1 px aşağı); 40–180 uzun kenarı üstünde dönüş (3B raster, LOD yüz),
zıplama 6 px (bugün 16); 180 yüz iner: 2 kare `cardAccent` renginde 1 px kenar + 4 toz zerresi; tint yok.
Toplam ≤ 220 ms; sonra mevcut çevirme akışı (canavar gövdesi A2 / A4) sürer. `flipDown` simetrik. Ayakta
duran kartın açılışı (`standUp` / `layDown`, büyü / tuzak açılışları) **A5'indir, A6 değiştirmez**; arka yüzü S-2 kaynağından
okur. Ses: `ui3Flip` kenar karesinde. AH: basma ve toz yok. Girdi: çevirme bütçesi (≤ 0,6 sn) içinde.

### K6 — Pozisyon değişimi, kartın payı (şerit A)

Gövde A2'nin `positionV3`'ünde kalır. `TileCard.rotateTo` v3: 0–40 kart 3 px kalkar; 40–220 90° döner
(LOD kareleri, son karede ≈ 8° aşma, sonra oturma); 220–260 iner, 2 toz zerresi, ped çizgisinde 1 kare tık.
Ses: `ui3Turn` (40 ms'de kısa hışırtı) + `ui3Land` (220 ms). Toplam ≤ 280 ms, A2'nin ≤ 400 ms'lik
bütçesinin içinde. AH: kalkış yok, dönüş 2 kare.

### K7 — Kurban (şerit A)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Adanma | 0–60 | Kurban edilen birimin **o anki karesinin** etrafında sahip tonunda 1 px kontur (dolgu yok). | Ped ışık +1; `ui3Tribute` (yükselen yumuşak çan) |
| Çözülme | 60–380 | Gövde alttan üste 2 px'lik satırlarla kendi renklerinden sahip rampasına (`ramp[3]` → `ramp[4]` → yok) basamaklanarak sökülür; pikseller yeni karta yay çizer (bugünkü akış hedefi korunur, **beyaz silüet yok**). İki kurban 90 ms kayık. | — |
| Kart | 240+ | Kurbanın kartı karosunda doğar ve mezarlığa uçar (K9; sayı durumdan). | K9 sesleri |

Koyma yolu toplam ≤ 500 ms. As kartların kendi kurban kancaları (`tribute` kart kancası: Kristal Ejder,
Uçurum Büyücüsü) değişmez; yalnız ortak "kurban edilen gövde" görüntüsü v3'te değişir (dilim filmleri
bilerek değişir, §6.2). AH: kontur 1 kare, gövde 3 palet basamağıyla söner, akış yok, kart 160 ms kayar.

### K8 — Elden atma (şerit A)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Kalkış | 0–120 | Kart elden 20 px kalkar (tam piksel). Gizli elin kartı mini elden doğar ve keskin dönüş kareleriyle açılır (atma herkese açık). | `ui3Slide` |
| Tutuşma | 120–220 | Alt kenarda 2 px'lik ateş rampası çizgisi belirir; 2 kare ±1 px titreme. **Bütün kart boyanmaz.** | — |
| Yanma | 220–700 | Mevcut `burnAway` (alttan üste piksel yanması) + `emberStream` (pikseller mezarlığa yay çizer) korunur. | `ui3Burn` (çıtırtı) |
| Kabul | 700–800 | Mezarlık kabul anı (K9). | `ui3PileAccept` |

İki kart: ikincisi 140 ms sonra başlar (toplam ≤ 950 ms). El sınırı seçimi: işaretli kartlar kızıl kenar
+ 9 px kalkık (K1), onay düğmesi. AH: titreme yok, yanma 4 satır basamağı, akış 3 nokta.

### K9 — Mezarlığa gitme, her yerde (şerit A + A56.0 düzeltmesi)

`cardLeaves` (A2) korunur: kart karosunda 2 kare 1 px beyaz kenarla doğar, tam piksel yay çizer, iner.
A6 eki: **sayı durumdan** (§2.3, A56.0); iniş anında üst kart 1 kare beyaz kenarla takas olur, sayı etiketi bir
hane döner (2 kare), mezarlık pedi ışık +1 (160 ms), zerre 6 → 4, ses `cardPlace` yerine `ui3PileAccept`
(yalnız v3, `V3HOOKS.pileAccept`). Aynı anda çok kart (Ayna Kalkanı vb.): inişler ≥ 150 ms aralıklı (EF-12 kuralı aynen).
Uçuş süresi değişmez (200–360 ms).

### K10 — Deste karıştırma (şerit A)

Tek gerçek yol açılıştır (`gameStart` → `riffle()`; §2.1). Kanca `riffle()`'ın ilk satırındadır (`V3HOOKS.riffle`), böylece
açılış, `skipIntro` ve (hiç çalışmayan) `flow:shuffle` aynı v3 yolundan geçer.

0–80 deste yığını ikiye ayrılır (üst yarı 6 px sola, alt yarı 6 px sağa, iki adım); 80–400 dört karıştırma
geçişi, her biri 80 ms: katmanlar yarılar arasında 1 karelik 2 px'lik yayla atlar; 400–480 yarılar birleşir,
1 px aşağı vuruş, ped ışık +1. Ses: `ui3Riffle` (her katmanda tık, toplam 10–12) + `ui3Shuffle` (son vuruş).
İki deste paralel, P2 60 ms kayık. Açılışta yazı-tura sonucu göründükten sonra, para eve uçarken oynar (altında kalmaz).
`skipIntro`'da tek geçiş. AH: 2 geçiş, yay yok.

### K11 — Mezarlık inceleme paneli (yeni; panel şerit A, tıklama bağlantısı şerit B)

**Açma.** Herhangi bir mezarlık yığınına tıklama / dokunma; klavye `M` kendi mezarlığı, `Shift+M` rakibinki;
aynı yığına yeniden tıklama kapatır. Mezarlık herkese açıktır: iki oyuncu da iki mezarlığa bakabilir.
Açılabildiği an: bir sinematik oynamıyorken (boşta, hedef seçimi dahil) ya da oyun bittiğinde; açıkken düello
girdisi panele geçer (`pushUiKeys`). vsBot'ta panel açıkken bilgisayar düşünür ama hamlesini panel kapanana
kadar bekletir (`DuelController`, şerit B). Yalnız v3; v1'de mezarlık tıklaması bugünkü gibi hiçbir şey yapmaz.

**Yerleşim.** Ekranın altında elin üstünü örten 400×150 px'lik koyu levha (`frameRectV3`, sahibin tonunda trim);
başlık "MEZARLIK · OYUNCU 1 · 5 kart" (vsBot'ta "SENİN MEZARLIĞIN" / "RAKİBİN MEZARLIĞI"). Kartlar tam boy
(48×68), yatay sıra, en yeni solda (yığının üstü), her kartın altında küçük sıra numarası. 7'den çok kartta
◀ ▶ okları, fare tekerleği ve yatay sürükleme ile kayar. Kartın üzerine gelme / dokunma → InspectPanel o kartı
gösterir (isim, tür, ATK / DEF, metin). Boş mezarlık: "Mezarlık boş" yazısı.

**Kapatma.** Esc, sağ tık, levhanın dışına tıklama, "KAPAT" düğmesi (32×20, ✕ simgesi) ya da aynı yığın.
Klavye: ← → odak, Enter InspectPanel'e sabitler. Dokunmatik: dokun = incele, dışarı dokun = kapat, kaydır = kay.

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Levha | 0–90 | 4 px'lik çizgiden tam yüksekliğe üç adımda açılır. | Mezarlık pedi ışık +1 (açık kaldıkça) ; `ui3PanelOpen` (çekmece kayışı) |
| Kartlar | 30–220 | Her kart yığının üstünde izometrik doğar, 2 LOD karesiyle dikleşir, yuvasına yay çizer; 30 ms kayık (ilk 7 kart; kaydırma alanındakiler doğrudan yerinde). | her kartta çok hafif `ui3Card` |
| Kapanma | 0–140 | Kartlar tek deste olarak yığına düşer, levha üç adımda kapanır. | `ui3PanelClose` |

Ruh Çağrısı seçicisi (`CardPicker`) aynı raf bileşenini kullanır: kartlar kendi yığınlarından uçar, seçim
açık; sonraki diriltme sinematiği A2 / A5'in. AH: uçuş yok, kartlar iki palet basamağıyla belirir, levha
açılma adımı yok.

### K12 — InspectPanel ve tutarlılık (şerit A)

v3 kolu: isim, tür satırı, ATK / DEF ve resim **aynı karede** değişir (üzerine gelmeden en geç 1 kare sonra);
metin 120 ms'de yazılır (mevcut `typeOn`). İlk görünüşte panel tam piksel 120 ms'de kayar. Yumuşak aura dokusu
yerine kartın arkasında iki tonlu basamaklı ışık dikdörtgeni; zerreler tek piksel. Deste ve rakibin mini eli için
`inspect.showPile(kind, player, count)` (S-9; A6-A doldurur, A6-B'nin `HumanInput.hover`'ı çağırır): "Deste · 12 kart" /
"Rakibin eli · 4 kart" (gizli bilgi açılmaz).

### F1 — Sıra başlangıcı (şerit B)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| (Perde) | — | Sıcak koltukta perde önce gelir (F7). | — |
| Levha | 0–120 | **Tur levhası** (≈ 112×20 px, `frameRectV3`, oyuncu tonunda trim) etkin oyuncunun panelinin yanında dış kenardan 12 px kayarak gelir (P1: sol alt panelin üstü, P2: sağ üst panelin altı); iki palet basamağıyla belirir; harfler kare başına bir harf damgalanır. Metin: sıcak koltuk "OYUNCU 2 · TUR 4", vsBot "SIRA SENDE · TUR 4" / "BİLGİSAYAR · TUR 4". | `ui3TurnStart`: 3 notalık yükselen motif (P1 parlak, P2 bir oktav altı) |
| Taraf dalgası | 0–360 | Sakin arenanın `pulseSide` dalgası (kenar ışığı + pedler basamaklı); dalga geçerken tarafın her canavarında 1 kare oyuncu tonunda **kontur** (tüm-sprite parlaması yok); düellocu 60 ms'de `command`. | Pedler +1 dalga |
| Oturma | 360–450 | Levha 1 px geri oturur; işleyici 450 ms'de biter. | — |
| Kuyruk | ana aşamaya kadar | Levha yerinde kalır; ana aşamada tur rozetine (aşama çubuğundaki TUR) üç adımda büzülür (120 ms), rozet sayısı bir hane döner. | — |

Hız: sahne saatiyle kısalır. AH: kayma yok (iki basamakla belirir), canavar konturları yok. Girdi: tur sonu
→ yeni oyuncuda girdi ≤ 1250 ms (bitiş 120 + tur 450 + çekme aşaması 100 + çekme 330 + ana 120 ≈ 1120 ms,
pay ile). Oyunun ilk turu da bu levhayla başlar (açılıştaki kızıl tam genişlik bandın yerine).

### F2 — Aşama geçişi (şerit B)

Çekme / ana / bitiş: aşama çubuğunun işaretçisi (1 px çerçeveli hap) 0–30 ms 1 px geri çekilir, 30–120 ms tam
piksel kayar (1 px aşma), 120–150 ms oturur; yeni hücrenin yazısı 1 kare beyaz, sonra kendi tonu. Ses
`ui3Phase` (30 ms'de yumuşak tık). İşleyici ≤ 120 ms bekler.

| Savaş vuruşu | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Çubuk | 0–120 | SAVAŞ hücresi iki basamakta kızıla dolar, işaretçi 2 px aşmayla oturur; etkin tarafta kızıl "SAVAŞ AŞAMASI" levhası (F1 bileşeni). | `ui3Battle` (alçak davul + metal halka; `duck` 0,3) |
| Hazır | 60–300 | Saldırı pozisyonundaki her canavarın altında kızıl basamaklı zemin halkası (r 6 → 18 px, 3 adım) + 1 kare kızıl kontur; soldan sağa 60 ms kayık. Düellocu 60 ms'de `command`. | Halkalar zeminde (basamaklı) |
| Kuyruk | 300–900 | Levha aşama çubuğuna büzülür (girdi 300 ms'de döner). | — |

Savaş bitince (bitiş aşamasına geçiş ya da saldırının geçersiz kılınmasıyla) SAVAŞ hücresi iki basamakta
normal tonuna söner. Yok: kızıl bant, kenar vinyeti, arenanın kararması, canavar silüet parlaması. Müzik
yoğunluğu bugünkü gibi değişir. AH: levha kaymaz, halkalar kayıksız.

### F3 — LP değişimi: kayıp / kazanç, sayan haneler (şerit B)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Kenar | 0–34 | Panelin yalnız 1 px trimi 2 kare beyaz, sonra kayıpta kızıl / kazançta yaprak tonu (120 ms). **Panel dolgusu yok.** Kayıpta panel 1–2 px yatay sarsılır (≤ 120 ms, tam piksel; ≥ 1500 hasarda 3 px). | `ui3LpLoss` (kısa ezilme + alçak gümleme) / `ui3LpGain` (yukarı cam çan) |
| Odometre | 0–360 | LP her hanesi 7 px yüksek bir hücrede; değişen haneler tam piksel adımlarla dikey döner (birler en hızlı, üst haneler yalnız değiştiklerinde — mekanik sayaç). Bitişte son hane 1 kare beyaz. | Her hane basamağında `ui3LpTick` (kayıpta perde iner, kazançta çıkar; en çok 34 ms'de bir) |
| Çubuk | 0–360 | Kayıp: kaybedilen dilim 2 kare beyaz, sonra kızıl, 4 px'lik basamaklarla erir (200 ms). Kazanç: yeni dilim 4 px basamaklarla yaprak tonunda dolar, önünde 1 px beyaz kenar; çubuktan 3 piksel yükselir (ADD parıltı yok). | — |
| Düşük LP (< 1000) | sürekli | Haneler 1200 ms'de bir bir ton kızıl nabız; çubuğun kalan dilimi yavaş yanıp söner. | — |

Toplam ≤ 400 ms (REHBER SÜ, KK-7). Kazanç işleyicisi (`presentHeal` v3 kolu, S-14; A5'in Şifa Pınarı teslimini de sunar):
v1 `damageNumber` yerine panel yanında v3 sayı (yaprak tonu, 1 kare bir boy büyük), `lpGain` toplamı ≤ 400 ms (bugün 583).
P2 sağ üst panelde aynı. Hız: rulo sahne saatiyle kısalır, tık akışı seyrelir. AH: haneler 3 adımda değişir (rulo yok),
sarsıntı yok, yalnız kenar rengi.

### F4 — Hedef seçme: adaylar ve onay (şerit B)

İnsan seçimi (`pickZone`, `pickOne`, `pickTributes`, saldırı hedefi):

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| Adaylar | 0–90 | Aday karodaki canavarın opak sınırının 3 px dışında dört **nişan köşesi** (altın `gold3`, 1 px mürekkep kontur, bacak 4 px) 4 px dışarıdan üç adımda gelir; canavarsız aday karolarda sakin arenanın mevcut zemin vurgusu yeterli. | `ui3AimOpen` (yumuşak yükselen tık) |
| Nefes | sürekli | Köşeler 420 ms'de bir 1 px içeri / dışarı, aday başına kayık. Aday olmayanlara dokunulmaz (karartma yok). | — |
| İmleç altı | 0–50 | Köşeler 2 px içeri oturur, 1 kare beyaz; birimin 1 kare altın konturu. | `ui3Aim` (perde aday sırasına göre) |
| Onay (tıklama) | 0–60 | Köşeler iki adımda gövdeye kapanır, 1 kare beyaz kontur, söner. **Eylem 0 ms'de gönderilir**; onay görüntüsü sinematiğin ilk karelerine biner. | `ui3Lock` (tık-tak) |
| Kurban seçimi | — | Seçilen kurbanın köşeleri beyaz, yanında "1/2" küçük sayaç. | `ui3Mark` |

Talimat: üstteki talimat çubuğu kalır, alttaki ipucu satırı aynı şeyi tekrar etmez (talimat açıkken gizlenir).
Motor `target` olayı (kancası olmayan kartlar, `_defaults/battle.ts` varsayılanı): `lockOn` nişan halkaları
yerine aynı köşeler hedeflere iki adımda kapanır, 1 kare beyaz kontur, 240 ms (bugün 260 + nişan). Kart
kancaları (Yıldırım `brace`, Büyücü kilidi vb.) değişmez. AH: köşeler nefes almaz, onay 1 kare.

### F5 — Geçersiz hedef / eylem (şerit B; el reddi şerit A)

| Durum | Görüntü (≤ 180 ms, kilitlemez) | Ses |
|---|---|---|
| Sahada geçersiz karoya / birime tıklama | Tıklanan karonun dış hattı 2 kare kızıl; tıklama noktasında 7×7 px kızıl **ret damgası** (×, 1 px mürekkep kontur) ±2 px yatayda üç kez sallanır (30 ms adımlar) ve iki palet basamağıyla söner; birime tıklandıysa birimin 1 kare kızıl konturu (dolgu yok). | `ui3Error` (iki nota aşağı, keçe vızıltısı, 110 ms; sert değil) |
| Saldıran seçiliyken geçersiz hedef | Yukarıdaki + seçili saldıranın köşeleri 1 kare kızıl. | `ui3Error` |
| Elde oynanamaz karta tıklama | `hand.reject(uid)` (K1). | `ui3Error` |
| Kapalı düğme (ör. ilk turda SAVAŞ) | Düğme 1 px sarsılır, trimi 2 kare kızıl (F10 kabuğu). | `ui3Error` |
| Sıra rakipteyken ele tıklama | Elde reddetme + ipucu "Şu an sıra sende değil" (bugünkü metin). | `ui3Error` (−3 dB) |

Açıklama metni (Türkçe neden) alt ipucu satırında kalır; satırın trimi 2 kare kızıl yanar, 1 px sarsılır.
AH: sallanma yok, yalnız renk.

### F6 — Engelleme / blok (şerit B)

Gövde tepkisi A2 / A3 vuruş kitinde kalır. A6 yalnız okunurluk katmanını ekler (v3, `damage` olayına
sarmalayıcı; geri tepme hasarı vuruş temasında gelir):

- Savunanın DEF rozetinin üstünde 9×10 px **kalkan** simgesi: 1 kare beyaz, sonra savunanın tonu, 260 ms
  tutar, iki karede söner; yanında `sm` boy "BLOK" yazısı 400 ms damgalı durur.
- Geri tepme hasarı saldıranın sahibinin panelinde odometreyle düşer (F3) — "hasar kime gitti" panelde okunur.
- Ses `ui3Block` (metal tın + alçak tok vuruş) hasar olayının ilk karesinde (= temas karesi).
- ATK = DEF (hasar yok) durumunda vurgu yok (bugünkü gibi). Saldırının geçersiz kılınması (`attackNegated`):
  kartın kendi sunumu A2 / A5'te; A6 yalnız SAVAŞ hücresinin sönmesini ekler (F2).

### F7 — Karar (tuzak penceresi), "Geç" ve sıcak koltuk perdesi (şerit B)

**Tuzak penceresi** (`tb:decision` v3 kolu, `V3HOOKS.decision`):
- **Çağırma penceresi + CPU ya da senaryo yanıtı (hızlı yol, S-15):** kart işaretlemesi yapılmaz; karar sunumu
  ≤ 120 ms'de biter (`A6_MS.decisionFast`); tuzak açılışı çağırma işleyicisinin bitişinden ≤ 120 ms sonra başlar. Bu,
  Yer Yarığı'nın çağırmanın hemen ardından gelmesi içindir (A5 §3.4). Girişin kendisi kesilmez (A7 / etki sistemi).
- **Saldırı penceresi ya da insan yanıtı:** savunanın **bütün** kapalı büyü / tuzak kartları (yalnız uygun olanlar
  değil, sızıntıyı artırmamak için) 1 px eflatun kenar + koşan düğümle 300 ms işaretlenir, sahada eflatun
  basamaklı ped ışığı (A2'nin onaylı Zincirler zamanlaması korunur).
- Her iki yolda `ctx.keep('trapPulse', { destroy })` bırakılır (işaretleme yoksa boş nesne); `trapOpeningV3` onu alır ve
  `destroy` eder (S-4).
- `Prompt.trapResponse` v3: tahta **kararmaz**; istem savunanın tarafında küçük bir levha ("Tuzak açılsın mı?" + uygun
  kartlar 48×68: `createCardV3` + `flipFrames()` ile keskin dönüş karelerinde ≤ 300 ms'de açılır; S-9) + "AÇ" (Enter) /
  "GEÇ" (Esc) düğmeleri (F10 kabuğu). "Geç" A2'nin v3 dalıyla aynı kalır. Ses `ui3Decision` (soru tıkı), `ui3Confirm` /
  `ui3Back`.

**Sıcak koltuk perdesi** (`Prompt.passDevice` v3): tahta görünür kalır; el `hand.waveFaceDown(true, 30)` ile dalga halinde
kapanır (S-9), elin bulunduğu bandın üstünde levha: "SIRA: OYUNCU 2 · Hazır olunca dokun" ya da tuzak
penceresinde "TUZAK SORUSU: OYUNCU 2". Herhangi bir tıklama / dokunma / Enter / Boşluk: levha 90 ms'de
katlanır, el `hand.waveFaceDown(false, 30)` ile kart başına 30 ms'lik dalgayla açılır. Levha girerken gelen tıklama kabul
edilir (A0 hatası). Gizlilik: elin yüzü kapalı, sahadaki kapalı kartlar zaten iki taraf için kapalı; başka gizli bilgi
ekranda yok (§7, S1). Ses `ui3PassDevice`. AH: dalgalar yok, levha anında.

### F8 — Deste bitmesi (şerit B)

0–200 boş deste pedinde "0" etiketi kızıllaşır ve 3 kez yanıp söner (2'şer kare), düellocu uzanır
(`command`); 200–700 pedin 8 px üstünde kesik çizgili 1 px kart dış hattı belirir ve 6 kızıl parçaya ayrılıp
düşer; 700–1400 oyuncunun tarafında kızıl "DESTE BİTTİ" levhası. Bant yok. Kamera: bugünkü eğilme (`flow/end.ts:39`)
v3'te yoktur (§0); `unfocus` güvenliği kalır. Ses `ui3DeckOut` (boş tık + alçak gümleme). Sonra F9.

### F9 — Zafer / yenilgi (şerit B)

| Vuruş | ms | Görüntü | Işık / ses |
|---|---|---|---|
| (Son darbe) | — | Bugünkü ağır çekim gözlemcisi aynen (`flow/turn.ts`). | — |
| Kaybeden | 0–400 | Kaybeden tarafın pedleri 2 basamak söner; her kaybeden canavar **kendi ölümünü** oynar (v3 çizimi olanlar `death` animi + `_v3/death.ts`; eskiler malzeme `shatter` ön ayarı — hologram glitch yok), 120 ms kayık; kaybeden düellocu `defeat`. | Basamaklı karartma yalnız o tarafta |
| Kazanan | 300–1000 | Kazanan canavarlar `victory` animini (varsa: A2 / A3 çizimlerinde var, bugün oynatan yok) son karesinde tutarak, yoksa `roar` oynar; düellocu `victory`; kazananın kürsüsünde basamaklı altın ışık havuzu (gökten gelen ışın v3'te basamaklı ve dar). | `ui3Victory` sokması (vsBot yenilgide `ui3Defeat`); müzik fanfarı bugünkü gibi |
| Sonuç levhası | 900–1500 | Ekran ortasının üstünde 220×40 px altın 1 px trimli levha (`frameRectV3`) üç adımda açılır; satır 1 "KAZANAN: OYUNCU 1" (sıcak koltuk / demo) ya da "KAZANDIN!" / "KAYBETTİN" (vsBot), kare başına harf; satır 2 sebep: "Rakibin LP'si sıfırlandı" / "Rakibin destesi bitti" / "Rakip teslim oldu". Kazananın yarısında 3 keskin piksel havai fişek. | — |
| Tutma + düğmeler | 1500–3300 | `Prompt.gameOver` v3: levhanın altında ince düğme sırası "TEKRAR OYNA" / "ANA MENÜ" (F10 kabuğu; ikinci başlık yok). | — |

Yok: tam ekran karartma, dev harf damgaları, tam genişlik bant, ekranı dolduran ışın / fişek, kamera eğilmesi (bugünkü
`flow/end.ts:140` v3'te yok; `unfocus` güvenliği kalır). P2 kazanınca ayna. AH: fişek ve kayıklık yok, levha anında.

---

## 4. Ortak parçalar

### 4.1 Bir kez yapılacaklar

A56.0'ın yaptıkları (ayrıntı §5.0.2) burada A6 açısından:

| Parça | Dosya | Kim | Ne |
|---|---|---|---|
| Kill-switch'ler | `src/view/v3flags.ts` | A56.0 | `V3_A6_A`, `V3_A6_B` (+ A5'inkiler), `CARD_OVERLAY_BLEND` (S-5, S-7). |
| Çerçeve dili | `src/art/frame-v3.ts` | A56.0 | `FRAME_V3` + `frameRectV3()` (S-1): arka yüz, HUD kabuğu, levhalar, mezarlık paneli, istemler aynı boyacıyla. |
| Hareket tercihi + süre tablosu | `src/view/v3/motion.ts` | A56.0 | `REDUCED_MOTION` (`prefers-reduced-motion` + `?motion=reduced`), `A6_MS` (§1.3'ün bütün satırları, testli), tam piksel eğriler (`settle`, `overshoot(px)`, `snap`). A5 de okur. |
| UI çizim kiti | `src/view/v3/ui-kit.ts` | A56.0 | `rimRect` (1 px kenar + koşan düğüm), `brackets` (nişan köşeleri), `plateFrame`, `stampText` (kare başına harf), `contourOf(sprite)` (birimin o anki karesinin 1 px konturu), `rejectStamp`, `paletteSteps`. Yalnız palet. Dondurulur; şeritler ek yardımcıyı kendi dosyalarına yazar. |
| v3 kancaları | `src/cinematics/v3small/_hooks.ts` | A56.0 | `V3HOOKS` nesnesi; kanca dosyalarındaki tek satırlar `const h = V3HOOKS.draw; if (h) return h(ctx);` biçimindedir. Şeritler kendi dosyalarında `if (V3_A6_A) V3HOOKS.draw = drawV3;` yazar (sinematik yükleyici `src/cinematics/**` dosyalarını kendisi içe aktarır); kanca boşsa bugünkü kod çalışır. v1'de hiçbir şey atanmaz, hiçbir işleyici kaydolmaz. Kanca tablosu §5.1. |
| Tek arka yüz kaynağı | `src/view/v3/cardBack.ts` (+ `cards.ts`'in arka yüz satırları, `TileCard` mip satırı, `CardSprite` anahtar satırı) | A56.0 taslak + kablolama; A6-A (A1) çizer | S-2: el, mini el, saha (statik iso, 3B poz, `dissolve`), yığınlar, karıştırma hayaleti, A2 / A5 açılışlarının `standUp` / `layDown`'u aynı kaynaktan. |
| `TileCard.currentPixels()` | `src/view/TileCard.ts` | A56.0 | S-3 (A5-A'nın kapalı karttan bırakması için). |
| Arayüz adımlı senaryolar | `src/duel/scenarios.ts` (ek `UiStep` türü), `src/scenes/DuelScene.ts runSteps`, `src/duel/qaInput.ts` | A56.0 | Senaryo adımları motor eylemine ek olarak arayüz adımı olabilir: `{ ui: 'move' \| 'click' \| 'key' \| 'wait', at: { hand: 2 } \| { zone: [p, 'monster', i] } \| { pile: [p, 'graveyard'] } \| { button: 'battle' }, key?, ms? }`. Sayfa içinde canvas'a sentetik `MouseEvent` / `KeyboardEvent` gönderilir; dondurulmuş saatte deterministiktir (A56.0 iki özdeş çekimle kanıtlar). Böylece `shot --fresh`, `measure`, `clip`, `filmdiff` arayüz olaylarını da çeker / ölçer / seslendirir. |
| Paylaşılan senaryolar | `src/duel/scenarios/a6-base.ts` | A56.0 | `a6Hover` (üç kartın üzerinden geç, birini seç), `a6TargetSpell` (Yıldırım Hükmü'nü elden oyna, hedefi arayüzle seç), `a6Invalid` (hedef seçerken boş kendi karosuna tıkla, sonra geçerli hedef), `a6Grave` (kendi mezarlığına tıkla, ikinci karta gel, Esc), `a6Reject` (Savaş Aşaması'nda ele tıkla). Hepsi v1'de de çalışır: v1 aynılık kapısı için. |
| Ses dosyaları | `src/audio/v3/ui-cards.ts`, `src/audio/v3/ui-flow.ts` | A56.0 iskelet (§4.3'ün bütün adları); **A6-A ikisini de doldurur** | `export const UI_CARD_RECIPES = { … } satisfies Record<string, Recipe>`; ad birliği `keyof typeof` ile büyür. `sounds.ts` / `sfx.ts` kaydı A56.0'da. A6-B sesleri yalnız çağırır. |
| Şerit arayüzleri | `src/view/v3/GravePanel.ts` (`openGravePanel(scene, views, player, opts)`, `gravePanelOpen(scene): boolean`, `whenGravePanelClosed(scene): Promise<void>`), `HandView.reject(uid)`, `HandView.waveFaceDown(down, msPerCard)`, `src/view/v3/CardV3.ts` (`createCardV3(scene, cardId, opts)`, `CardV3.flipFrames()`), `src/view/v3/inspectV3.ts` (`showPile(kind, player, count)`) | A56.0 taslak (bugünkü davranışa düşer); A6-A doldurur | A6-B ilk günden bağlar (`HumanInput`, `DuelController`, `CurtainV3`, `TrapPromptV3`); S-9. |
| Aynılık / denetim araçları | `tools/filmdiff.mjs` (`a6v1`, `a6v3` setleri, açılış filmleri), `tools/sbs.mjs`, `tools/measure.mjs` (kamera alanları), `src/dev/previews/a6audit.ts` (`?dev=a6audit&s=<key>`: her karede `DEPTH.HAND…HUD` aralığındaki görünür görüntülerde döndürme ≠ 0, kesirli ölçek ya da kesirli konum sayar → `__neon.a6audit`) | A56.0 | §6. |
| Kart nesnesi | `src/view/v3/CardV3.ts`, `cardRaster.ts`, `cardLod.ts`, `cardBack.ts` | şerit A | `CardV3 extends CardSprite` (API aynı: `flyTo`, `flip`, `setHighlight`, `hoverLift`, `punch`, `pulse`, `dissolve`). Döndürme yok sayılır, ölçek keskin rasterla (en yakın komşu + yeniden 1 px kontur) tam piksel boyuta oturur, `flip` keskin dönüş kareleri, `setHighlight` 1 px kenar + düğüm, `pulse` kenar flaşı, `punch` 1–2 px düşüş. Hareketsizken statik doku (`card:face:<id>`, A5-B'nin; S-13), hareket ederken tek bir küçük canlı tuval (TileCard'ın yöntemi). `cardLod`: her kart için hareket LOD yüzü (A5-B'nin v3 yüzünden türetilir) ve sahip tonlu v3 arka yüz; ilk kullanımda üretilip önbelleğe alınır (≈ 0,3 MB). |
| HUD kabuğu | `src/view/v3/hudSkin.ts` | şerit B | F10. |
| Levha bileşeni | `src/view/v3/TurnPlate.ts` | şerit B | Tur, savaş, deste bitti, perde, "DÜELLO!" (büyük boy) ve sonuç levhaları aynı bileşen. |
| Nişan / ret | `src/view/v3/TargetMarks.ts` | şerit B | Aday köşeleri, kilit, onay, ret damgası, kalkan simgesi. |
| Odometre | `src/view/v3/odometer.ts` | şerit B | Hane hane dönen sayı (LP, tur rozeti; şerit A yığın sayısında kendi küçük kopyasını kullanır, bağımlılık yok). |

### 4.2 Yeniden kullanılanlar

- A2 v3 kitleri: `_v3/card.ts cardLeaves` (kart sürekliliği), `_v3/death.ts` ve `shatter` malzeme ön ayarları
  (zaferde kaybedenin ölümü), `_v3/number.ts impactNumber` (kazanç sayısı biçimi), `_v3/sound.ts`
  (işarete bağlı ses: `atFrame` / `start().stop()`), A2 büyü açılışının kart dili (`cardRim`, `cardSil` —
  A5'in dosyasında; A6 dili kendi `ui-kit`'inde yeniden kurar, dosyayı düzenlemez).
- Sakin arena (`BoardViewCalm`): `pulseSide`, `highlightZone` (köşeli zemin vurgusu), `setActivePlayer`
  (kenar koşucusu) — A6 çağırır, dosyayı düzenlemez.
- Basamaklı ışık katmanı: `lightFlash`, `lightPool` (`src/view/light`), A6 yalnız çağırır.
- `TileCard` 3B rasterı (kare kare keskin yeniden çizim) — LOD yüzle beslenir.
- `burnAway` / `emberStream` (atma), `pushUiKeys` (modal klavye), `typeOn`, `pixelText`.
- Açılışın `descend` / `duelistEnter` / `coinToss` kodu (değişmez; F0 kancaları onun dışında).
- Ses: `src/audio/v3/kit.ts` blokları (`glassBell`, `thump`, `puff`, `crack`, `link`, `sweep`), `V3_CEILING`.
- Sunum tarifleri katmanı (`src/presentation/**`, `src/cinematics/recipe/**`, A3): A6 tarif eklemez ve
  değiştirmez; zaferde `death` / `victory` animleri tarif yolundaki canavarlar (Taş Muhafız) için de aynı
  birim API'siyle oynar.
- A2 büyü / tuzak açılış kitleri (`spells/_kit.ts spellOpeningV3`, `traps/_opening.ts`): A5'in alanı; A6
  kullanmaz, değiştirmez. Elden büyü oynanınca açılışa giden kart A6'nın `CardV3`'üdür (API aynı).

### 4.3 Arayüz ses paleti

Tek aile: "neon cam + keçe". Ortak perde merkezi A minör pentatonik (karakter paletlerinden ayrı: ejder E,
büyücü D / G#); seviye karakter seslerinin 8–12 dB altında; hepsi ≤ 200 ms (zafer / yenilgi sokması ve `ui3DuelStart`
hariç, ≤ 1,4 sn); kuyruk yok; aynı karede aynı ses ikinci kez çalmaz; perde sapması deterministik tohumla ±2 %.
**İki dosyanın tariflerini de A6-A yazar** (tek ses tasarımı); A6-B çağrıları kareye yerleştirir.

| `ui-cards.ts` | `ui-flow.ts` |
|---|---|
| `ui3Hover` (merdivenli tık), `ui3Select`, `ui3Draw`, `ui3Flip`, `ui3Land`, `ui3Play`, `ui3Place`, `ui3Set`, `ui3Latch`, `ui3Turn`, `ui3Tribute`, `ui3Slide`, `ui3Burn`, `ui3PileAccept`, `ui3Riffle`, `ui3Shuffle`, `ui3Mark`, `ui3Unmark`, `ui3PanelOpen`, `ui3PanelClose`, `ui3Card` | `ui3DuelStart`, `ui3PanelIn`, `ui3TurnStart` (P1 / P2 iki perdede), `ui3Phase`, `ui3Battle`, `ui3LpLoss`, `ui3LpGain`, `ui3LpTick`, `ui3AimOpen`, `ui3Aim`, `ui3Lock`, `ui3Error`, `ui3Block`, `ui3Decision`, `ui3Confirm`, `ui3Back`, `ui3PassDevice`, `ui3DeckOut`, `ui3Victory`, `ui3Defeat` |

Ducking: yalnız `ui3Battle` (0,3) ve `ui3Victory` / `ui3Defeat` (0,55). Doğrulama REHBER SE-1, SE-6, SE-8. A5'in büyü /
tuzak sesleri (`src/audio/v3/spells.ts`) ayrı bir ailedir; ad çakışması yoktur.

### 4.4 Küçük olay kuralları (inceleme notlarında kimlikle anılır)

| # | Kural |
|---|---|
| KO-1 | v3'te kart asla kesirli ölçek ya da döndürmeyle çizilmez: statik doku, keskin raster (`CardV3`) ya da LOD yüzlü 3B raster (`TileCard`). |
| KO-2 | Konumlar tam piksel; aşma en çok 2 px; oturmalar tam piksel basamaklı. |
| KO-3 | Arayüz durumları (oynanabilir, seçili, işaretli, aday, kilit) 1 px kenar / köşe + koşan düğüm dilindedir. Hale, ADD parıltı dokusu, tüm kart / sprite boyama yok; vurgu canavarda yalnız 1 px kontur. |
| KO-4 | Tam genişlik bant, tam ekran karartma / vinyet / ışın yok (açılış dahil). Levhalar küçük ve olayın sahibinin tarafında. Işık yalnız ilgili zeminde ve basamaklı. |
| KO-5 | Her tıklama tıklanan yerde 1 kare içinde yanıt alır (geçerli: kilit / seçim; geçersiz: ret). |
| KO-6 | Girdi bugünden uzun kilitlenmez. Süs kuyrukları ≤ 250 ms ve bir sonraki eylemde güvenle iptal olur (yok edilmiş nesneye dokunmaz). |
| KO-7 | Her olayın bir arayüz sesi vardır; karesine bağlıdır (±1 kare), kısadır, sessiz seviyededir. |
| KO-8 | ×2 / ×3: gösteri saatiyle kısalır; ses kareleri korunur, tık akışları seyrelir; iniş / onay kareleri atlanmaz. |
| KO-9 | Azaltılmış hareket: sarsıntı, aşma, nefes, iz, kayık yok; süreler ≤ normal. |
| KO-10 | Yeni kamera çağrısı yok; yalnız bugünkü `unfocus` güvenliği (§0). |
| KO-11 | Gizli bilgi hiçbir karede açılmaz (kapalı kart, gizli el); mezarlık herkese açıktır. |
| KO-12 | Metinler Türkçe ve doğru harflerle (ç ğ ı İ ö ş ü); telefonda okunur (§1.5). |

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

### 5.1 A6'ya özgü A56.0 ayrıntıları

**Tek satırlık kancalar** (yalnız kanca doluysa etkin; kancayı atayan şerit kendi bayrağıyla atar):

| Dosya | Kanca |
|---|---|
| `src/cinematics/flow/draw.ts` | `V3HOOKS.draw` (A) |
| `src/cinematics/flow/discard.ts` | `V3HOOKS.discard` (A) |
| `src/cinematics/flow/opening.ts` | `V3HOOKS.riffle` (A; `riffle()`'ın ilk satırı — açılış, `skipIntro` ve hiç çalışmayan `flow:shuffle` aynı yoldan geçer), `V3HOOKS.deal` (A; `deal()`'ın ilk satırı), `V3HOOKS.duelPlate` (B; `duelStart(sc)` çağrısının yerine), `V3HOOKS.hudIn` (B; `v.hud.setVisible(true)` çağrılarının yerine, `skipIntro` dalı ve `finally` dahil; boşta işlemsiz). İniş (`CameraRig.descend`), düellocu girişi, yazı-tura ve eğilmesi (`:163`) koduna dokunulmaz. |
| `src/cinematics/summon-b/set.ts` | `V3HOOKS.set` (A) |
| `src/cinematics/summon-a/tribute.ts` | `V3HOOKS.tributeBody` (A) — kurban edilen gövdenin akışı |
| `src/cinematics/_v3/card.ts` | sayı durumdan (§2.3 düzeltmesi) + `V3HOOKS.pileAccept` (A) |
| `src/cinematics/flow/turn.ts` | `V3HOOKS.turnStart`, `V3HOOKS.phaseChange` (B) |
| `src/cinematics/flow/end.ts` | `V3HOOKS.deckOut`, `V3HOOKS.gameOver` (B) |
| `src/cinematics/battle/declare.ts` | `V3HOOKS.decision` (B) — yalnız `trapResponse` dalı; `trapPulse` sözleşmesi S-4 |
| `src/cinematics/_defaults/battle.ts` | `V3HOOKS.target` (B) — varsayılan `target` |
| `src/cinematics/_core/helpers.ts` | `V3HOOKS.presentHeal` (B) |

v3 gövdeleri bugünkü `unfocus` güvenliklerini kendi yerlerinde aynen çağırır (§0); başka kamera çağrısı içermez.

**Film setleri:**
- `a6v1` (v1 görünüm, 26 film): `flowTurnP1`, `flowTurnP2`, `flowBattle`, `flowEndPhase`, `smbSetMonster`, `smbSetP2`,
  `smbSetTribute`, `smbPos`, `normalSummon`, `p2Summon`, `flowDiscard`, `flowDiscardP2`, `atkTargetDestroyed`,
  `atkBlocked`, `trapDecline`, `lumenGain`, `flowDeckOut`, `flowLethal`, `spRecall`, `a6Hover`, `a6TargetSpell`,
  `a6Invalid`, `a6Grave`, `a6Reject`, `opening` (`?mode=hotseat&seed=1&holdIntro=1&curtain=0`, 6000 ms), `openingSkip`
  (aynısı `&skipIntro=1`, 3000 ms).
- `a6v3`: `a6v1` listesi + şerit anahtarları (`a6-cards.ts`, `a6-flow.ts`), v3.
- v1 işleyici zincirleri (`__neon.duel.handlers()`) → `shots/v3/a56/baseline/handlers-v1.json`.

### 5.2 Şerit A6-A — kart nesnesi, el, yığınlar, mezarlık paneli, arayüz sesleri (≈ 41 sa)

Sahip olunan dosyalar §5.0.7'de. Bütün yeni davranış `V3_A6_A` arkasındadır.

| Adım | İş | Kanıt |
|---|---|---|
| A1 | `CardV3` + `cardRaster` + `cardLod` + **v3 arka yüz** (`cardBackV3` doldurulur: el, mini el, saha kapalı kartları, deste / mezarlık katmanları, karıştırma hayaleti, A2 / A5 açılışlarının `standUp` / `layDown`'u bir anda değişir) + `createCardV3` / `flipFrames()` (S-9); `?dev=cards3` sayfaları | ×3 sayfalar (P1 / P2 arka yüz); saha + yığın 1× kareleri (`smbSetMonster`, `smbSetP2`); `card-hash --query "&a5=off&a6=a"` farkı yalnız arka yüz anahtarlarında; birim testleri |
| A2 | El v3 (K1) + InspectPanel v3 (K12, `showPile`) + `hand.reject` + `hand.waveFaceDown` | `a6Hover`, `a6Reject`; kontrol noktası çiftleri (boşta ekran, üzerine gelme, kapalı koyma) |
| — | **Kontrol noktası A56.K** (§5.0.5) | kullanıcı onayı |
| A3 | Çekme (K2; açılış dağıtımı `V3HOOKS.deal` dahil) + yığın v3 (sayı, kabul) + karıştırma (K10, `V3HOOKS.riffle`) | `flowTurnP1`, `flowTurnP2`, `endTurnDraw`, `opening`, `openingSkip` |
| A4 | TileCard v3 (K3, K5, K6) + koyma (K4) | `normalSummon`, `p2Summon`, `smbSetMonster`, `smbSetP2`, `smbFlipAttacked`, `smbFlipHawk`, `smbPos`, `smbPosAce` |
| A5 | Kurban (K7) + atma (K8) + mezarlık kabulü (K9) | `smbSetTribute`, `suTributeSet`, `tributeWyrm`, `flowDiscard`, `flowDiscard2`, `flowDiscardP2`, `atkTargetDestroyed`, `spBoltAce` |
| A6 | Mezarlık paneli (K11) + seçici (`CardPicker` v3) | `a6Grave`, `a6GraveP2`, `a6GraveMany`, `a6GraveEmpty`, `spRecall`, `a6RecallPick` |
| A7 | Arayüz sesleri: `ui-cards.ts` **ve** `ui-flow.ts` (§4.3; A6-B'nin çağırdığı adlar dahil) | ses analizleri (§6.5) |
| A8 | En az 3 eleştiri turu (sanat, hareket, ses) + düzeltmeler | eleştiri notları KO / EF / HA kimlikli |

Yeni senaryolar (`a6-cards.ts`): `a6PlayUi` (elden çağırma arayüzle), `a6SetUi`, `a6DiscardUi` (el sınırı seçimi arayüzle),
`a6GraveP2`, `a6GraveMany` (12 kart, kaydırma), `a6GraveEmpty`, `a6RecallPick` (Ruh Çağrısı seçicisi arayüzle).

Filmler (`--fresh --film 36 --every 50 --cols 12`, P1 ve P2): yukarıdaki anahtarlar + `?mode=vsBot` ile gizli
çekme / atma + açılış (`?mode=hotseat&seed=1&holdIntro=1&curtain=0&look=v3 --film 30 --every 200`). Kare
kare (17 ms) yakın çekim: çekmenin dönüşü, koymanın inişi, kurbanın ilk 6 karesi (×3 kırpım). MP4 (`clip.mjs`,
müzik kapalı ve açık): `a6-el.mp4` (`a6Hover` + `a6PlayUi` + `a6SetUi`), `a6-cekme.mp4` (`flowTurnP1`),
`a6-atma.mp4` (`flowDiscard2`), `a6-mezarlik.mp4` (`a6Grave` + `a6GraveMany`).

**Her adımın "bitti" ölçütü:** v1 kapıları (§6.1); kimlik kapısı `&a5=off&a6=a` (§5.0.3); adımın senaryoları 0 hata ve §1.3
bütçesinde; `a6audit` 0; kamera kapısı (§6.3); üretilen her PNG'ye bakıldı.

### 5.3 Şerit A6-B — HUD, akış, levhalar, hedefleme, geri bildirim, açılış (≈ 41,5 sa)

Sahip olunan dosyalar §5.0.7'de. Bütün yeni davranış `V3_A6_B` arkasındadır.

| Adım | İş | Kanıt |
|---|---|---|
| B0 | **HUD v3 kabuğu** (F10): `hudSkin.ts`, `HudView` + `Button` v3 dalları; LP değişiminde yalnız trim | `?dev=hud3` ×3; kontrol noktası "boşta ekran" ve "LP kaybı" çiftleri; başlık ekranı v3 1× karesi |
| B1 | Tur levhası + tur başı (F1) + aşama / savaş (F2) + aşama çubuğu hareketi | `flowTurnP1`, `flowTurnP2`, `flowBattle`, `flowBattleP2`, `flowEndPhase`, `endTurnDraw`; kontrol noktası "tur başı" çifti |
| — | **Kontrol noktası A56.K** (§5.0.5) | kullanıcı onayı |
| B-open | **Açılış** (F0): `V3HOOKS.duelPlate` (büyük tur levhası, harf damgası, zemin dalgası) + `V3HOOKS.hudIn` | `opening`, `openingSkip` filmleri; açılış kamera izi tabanla aynı; `&a5=off&a6=b` ile 0–2900 ms IDENTICAL; süre ≤ 5333 / 2750 ms |
| B2 | LP odometresi + çubuk + kazanç (F3) + düşük LP | `atkTargetDestroyed`, `saWyrmAtk`, `lumenGain`, `spHeal`, `flowTurnLowLp`, `a6LpBig` |
| B3 | Nişan köşeleri (F4) + ret (F5) + `HumanInput` bağlantıları + mezarlık tıklaması + bot beklemesi + deste / mini el üzerine gelme yönlendirmesi (`showPile`) | `a6TargetSpell`, `a6TargetAttack`, `a6Invalid`, `a6Reject`, `tributeMagus`, `a6Grave` (bağlantı) |
| B4 | Blok (F6) + tuzak penceresi (hızlı yol S-15, `trapPulse` S-4) ve istem + sıcak koltuk perdesi | `atkBlocked`, `smbFlipAttacked`, `a6Block`, `trapDecline`, `tbChasm` (karar ≤ 120 ms), `a6TrapPrompt`, `a6TrapOpen`, `a6Curtain` |
| B5 | Deste bitmesi (F8) + zafer / yenilgi (F9) + sonuç levhası | `flowDeckOut`, `flowDeckOutP1`, `flowLethal`, `flowLethalP2`, `flowSurrender`, `a6Defeat` (vsBot) |
| B7 | En az 3 eleştiri turu + düzeltmeler (sesler A6-A'da yazılır; B çağrı karelerini denetler, KO-7) | notlar |

Yeni senaryolar (`a6-flow.ts`): `a6TargetAttack` (saldıran seç → kendi canavarına geçersiz tık → geçerli hedef),
`a6TrapPrompt` (istem → GEÇ), `a6TrapOpen` (istem → AÇ), `a6Curtain` (perde açık sıcak koltuk: tur sonu →
perde → dokunma), `a6LpBig` (3000 hasar), `a6Block` (geri tepmeli blok), `a6Defeat` (vsBot yenilgi).

Filmler: yukarıdaki anahtarlar P1 / P2; zafer için `--start 1800 --film 24 --every 150`. MP4: `a6-acilis.mp4` (açılış,
müzikli), `a6-sira.mp4` (`flowEndPhase` + `flowBattle`), `a6-lp.mp4` (`atkTargetDestroyed` + `lumenGain`), `a6-hedef.mp4`
(`a6TargetSpell` + `a6Invalid` + `a6TargetAttack`), `a6-tuzak.mp4` (`a6TrapPrompt`), `a6-zafer.mp4` (`flowLethal`, müzikli).

**Her adımın "bitti" ölçütü:** v1 kapıları (§6.1); kimlik kapısı `&a5=off&a6=b` (§5.0.3); adımın senaryoları 0 hata ve §1.3
bütçesinde; `a6audit` 0; kamera kapısı (§6.3); üretilen her PNG'ye bakıldı.

---

## 6. Kapılar

### 6.1 v1 aynılığı (her şerit kontrol noktasında ve A56.Z'de)

- `npm run typecheck`, `npm test`.
- `npx vite-node tools/sheet-hash.ts --compare shots/v3/a3/baseline/sheet-hashes-v1.json` ve `--look v3` →
  çıkış 0 (A6 canavar çizimine dokunmaz).
- `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` → 17/17 IDENTICAL.
- `node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films` → 26/26 IDENTICAL (akış, arayüz ve açılış
  dahil: v1'in el, HUD, InspectPanel, PileView, Prompt, mezarlık tıklaması ve "DÜELLO!" bandı birebir).
- `npx vite-node tools/card-hash.ts --look v1 --compare shots/v3/a56/baseline/card-hashes-v1.json` → çıkış 0 (arka yüz
  kaynağının v1'de değişmediğinin kanıtı).
- `node tools/measure.mjs --scenarios all --jobs 2` (v1) → `shots/v3/a3/baseline/measure-v1.json` ile ortak
  anahtarlarda "same" (±17 ms); A6 anahtarları v1'de 0 hatayla çalışır.
- v1 işleyici zincirleri `handlers-v1.json` ile aynı (A6 dosyaları v1'de kayıt yapmaz).
- v1'de A6 dokusu üretilmez (`tools/texmem.mjs` v1 sayısı değişmez).

### 6.2 v3 kimlik kapıları ve bilerek değişenler

- Şerit kapıları §5.0.3: A6-A `&a5=off&a6=a`, A6-B `&a5=off&a6=b`; `filmdiff --set slice` ve `--set a6v3` ortak tabana
  (`slicefilms-a56-0`, `a6v3films-0`) karşı; fark kareleri ve sınır kutuları yalnız şeridin öğelerinde (canavar gövdeleri,
  büyü / tuzak efektleri aynı). `measure --look v3 --query "<ek>"` → şeride ait olmayan anahtarlar "same".
- A56.0'ın mezarlık sayısı düzeltmesi ortak tabana dahildir; hiçbir şeridin farkı sayılmaz.
- Bilerek değişen v3 filmleri (A56.Z'de tek ardıl tabana yazılır): dilim setinde mezarlık inişi (kabul), LP paneli ve HUD
  kabuğu, kart dönüşü / çevirme, kapalı kart arka yüzü, kurban gövdesi, tur / aşama parçaları; `a6v3` setinin hepsi;
  açılış filmlerinde deste yığınlarının arka yüzü (A6-A, baştan itibaren) ve 2900 ms sonrası (karıştırma, levha, HUD gelişi,
  dağıtım); kamera izi değişmez.
- `measure --look v3` (319 + A5 + A6 anahtarları): akış anahtarlarının süreleri §1.3'e göre değişir; her değişim
  nedeniyle listelenir; hata 0.

### 6.3 Bütçe, görsel ve kamera denetimleri (v3)

- §1.3 tablosu `measure` çıktısından (açılış için A0 `opening.txt` yöntemiyle, `shot.mjs --eval` olay zamanları) üretilir
  ve `A6_MS` ile karşılaştıran küçük betik testlere eklenir. Girdi kilidi hiçbir anahtarda bugünkü v3 değerinden uzun değil.
- **Kamera:** `node tools/measure.mjs --look v3 --scenarios <anahtarlar> --camera-gate shots/v3/a56/baseline/measure-v3-a56-0.json`
  → `zoom.max = 1`, `closeUpCalls = 0`, `maxScrollPx` ve `focusCalls` ≤ taban (`flowDeckOut`, `flowLethal*`'ta bilerek
  düşer). Açılış: kamera izi `opening-camera-0.json` ile her karede aynı (dört şerit açıkken de); `&a5=off&a6=b` ile `opening` filminin 0–2900 ms kareleri IDENTICAL.
  Kaynak taraması yalnız eklenen satırlarda ve yeni dosyalarda: `git diff -U0 -- <şeridin düzenlediği dosyalar> | grep '^+' |
  grep -E '\bfocus\(|closeUp|setZoom|\.pan\(|descend\('` → 0 satır; yeni dosyalarda aynı `grep -E` → 0 satır.
- `?dev=a6audit&s=<key>`: A6 anahtarlarının hepsinde döndürülmüş / kesirli ölçekli / kesirli konumlu görünür kart
  ve UI karesi sayısı **0** (izin listesi: yok).
- Beyaz / bant denetimi (EF-4, EF-14): `a6v3` filmlerinde (açılış dahil) beyaz piksel ≤ %1,5 / kare; hiçbir satırın
  %60'ından fazlası tek renk değil.
- Işık: her küçük olayda en az bir basamaklı zemin ışığı çağrısı (`lightFlash` / `lightPool` sayacı, `measure`
  olay günlüğüne eklenen alan) ve hiçbirinde tam ekran karartma yok.
- Gizli bilgi: `a6Curtain`, `a6TrapPrompt`, vsBot gizli çekme / atma filmlerinde kapalı kart ve gizli el hiçbir
  karede açık değil (A0 §4 denetiminin tekrarı).
- Hız: A6 anahtarlarının ×3 filmleri (`--speed 3`); iniş / onay kareleri görünür, olay sırası aynı.
- AH: `?motion=reduced` ile aynı anahtarlar; sarsıntı / aşma / nefes yok; süreler ≤ normal.

### 6.4 Testler (vitest)

`tests/v3/a6-cards.test.ts`: kart rasterı (boyut, 1 px kontur, yalnız palet renkleri, belirlenimcilik), dönüş
karesi genişlikleri, LOD yüzü, **arka yüz kaynağı** (`V3_A6_A` iken `cardBackCanvas(p)`, `cardMip('back', p)` ve
`isoCanvas('back', o, p)` aynı `cardBackV3(p)`'den; kapalıyken v1 ile bayt bayt aynı), mezarlık rafı sıralaması (en yeni
önce) ve sayfalama, `cardLeaves` sayısının durumdan türetilmesi. `tests/audio/a6-ui.test.ts`: `ui3*` tariflerinin hepsi
çevrimdışı çizilir, NaN yok, tepe ≤ −1 dBFS, ≤ 200 ms (istisnalar hariç). `tests/v3/a6-flow.test.ts`: odometre (hane sırası,
süre ≤ 400 ms, tık aralığı ≥ 34 ms, monotonluk), nişan köşesi geometrisi (ekran içinde, tam piksel), `A6_MS` (AH ≤ normal;
`decisionFast` ≤ 120), karar hızlı yolu (CPU / senaryo + çağırma penceresi → işaretleme yok, `trapPulse` yine bırakılır),
**kayıt denetimi** (v1'de A6 işleyicisi yok; v3'te yalnız A6'nın kendi işleyici adları beklenen sırada — A5'in işleyicileri
ve gözlemcileri, örn. giriş damgası, sayılmaz), A6 dosyalarında palet dışı renk sabiti yok (kaynak taraması).

### 6.5 Ses

REHBER SE-1 (işaret / kare senkronu ±1 kare, `measure sfx[]`), SE-6 (tepe ≤ −1 dBFS, kırpma 0, `clip.mjs` seviye
satırı), SE-7 (ducking yalnız §4.3'tekiler), arayüz seslerinin karakter paletlerinden ve A5'in büyü / tuzak seslerinden
ayrışması (1/3 oktav LSD ortanca ≥ 10 dB, A2 analiz betikleriyle), aynı karede çift ses yok. Kullanıcı MP4'leri dinler;
son karar onun.

### 6.6 Kabul listesi (evet / hayır)

1. §6.1'in hepsi geçti. 2. Yan yana 11 çift: her çiftte ≥ 3 somut fark ve yeni kare tercih edildi (§1.4); kontrol noktası
onaylandı. 3. §1.3 bütçeleri tuttu (açılış ve karar hızlı yolu dahil), girdi hiçbir yerde uzamadı. 4. `a6audit` 0.
5. EF-4 / EF-14 temiz (açılış dahil). 6. Kamera kapısı geçti; kalkan eğilmeler kullanıcıya söylendi. 7. Mezarlık paneli
fare, klavye ve dokunmatikle açılıp kapanıyor, P1 / P2 / boş / 12 kart. 8. Sayı titremesi yok. 9. Testler ve ses kapıları
geçti. 10. İki demo oyun + bir gerçek fare oyunu hatasız. 11. Kullanıcı yan yana sayfayı ve MP4'leri gördü.

---

## 7. Riskler ve kullanıcıya açık sorular

### 7.1 Riskler

| Risk | Önlem |
|---|---|
| `CardSprite`'ı alt sınıflamak çok kullanılan bir sınıfa dokunur (v1 gerileme) | Yalnız `private` → `protected`; `CardV3` yalnız `V3_A6_A`'da üretilir; `a6v1` film seti el / HUD / seçiciyi birebir doğrular. |
| Dört şerit aynı ağaçta (`TileCard`, `CardSprite`, `cards.ts`, `_v3/card.ts`, ses kaydı) | §5.0.7 sahiplik tablosu; A56.0 kancaları, arka yüz kablolamasını, kayıt dikişlerini ve sözleşmeleri şeritlerden önce yazar ve dondurur; şeritler arası arayüzler taslakla başlar (S-9). |
| A5 ve A6 aynı filmleri değiştirir; tabanlar birbirini kirletebilir | Kill-switch'ler (§5.0.3), A56.0'dan sonra tek ortak taban, A56.Z'de tek ardıl taban. |
| HUD kabuğu başlık ekranındaki düğmeleri de değiştirir | Yalnız v3'te; B0'da başlık ekranı v3 1× karesine bakılır; v1 IDENTICAL. |
| Koyu kart + koyu HUD koyu arenada "çamur" olabilir; yön kullanıcının zevkine bağlı | Tek trim + ink kontur + etkin panelde koşan düğüm; kontrol noktası B0–B1 ve A1–A2'den hemen sonra; onaysız devam yok. |
| Arayüz adımlı senaryoların belirlenimciliği (sentetik DOM olayları) | A56.0 iki özdeş çekimle kanıtlar; olmazsa yedek: görünümlere QA giriş yöntemleri (`hand.qaHover`, `input.qaClick`). |
| Dik el "düz" görünebilir | y eğrisi + nefes + kenar düğümleri + üzerine gelme ışık şeridi; kontrol noktasında ilk çiftte kontrol edilir. |
| LOD hareket yüzü "taslak" gibi okunabilir | En çok 3 ara kare; 1× filmde ve kare kare ×3 kırpımda bakılır; kötü okunursa yalnız portre bloğu yerine 2 tonlu küçültülmüş portre. |
| Arayüz sesi yorgunluğu (oyunda yüzlerce kez) | Kısa, sessiz, kuyruksuz; küçük deterministik perde sapması; MP4 ile kullanıcıya sorulur. |
| Kısalan tur döngüsü oyuncuya "aceleci" gelebilir | Süreler REHBER bütçelerinde; levha ana aşamaya kadar yerinde durur (bilgi kaybolmaz). |
| Perde değişikliği gizlilik algısı | Yalnız v3; el kapalı, sahada gizli bilgi yok; S1 ile kullanıcıya sorulur. |
| Mezarlık paneli ve bilgisayarın zamanlaması | Panel açıkken bilgisayar hamlesini bekletir (S3). |
| Kamera eğilmelerinin kalkması "kamerayı değiştirme" olarak okunabilir | Yalnız yeniden yazılan iki akışta (deste bitmesi, oyun sonu); kalan her çağrı aynı; S6 ile kullanıcıya sorulur. "Korunsun" derse aynı iki çağrı v3 gövdelerine aynen konur ve `focusCalls` kapısı "= taban" olur. |

### 7.2 Açık sorular (önerilen varsayılanla; cevap gelmezse varsayılan uygulanır)

| # | Soru | Varsayılan |
|---|---|---|
| S1 | Sıcak koltuk perdesi: tam ekran şerit yerine "tahta görünür, yalnız el kapanır + küçük levha" olsun mu? | **Evet** (yalnız v3). |
| S2 | Azaltılmış hareket: işletim sistemi ayarından (`prefers-reduced-motion`) ve `?motion=reduced`'dan otomatik; ayarlar menüsüne anahtar A7'de mi? | **Evet**, menü anahtarı A7'de. |
| S3 | vsBot'ta mezarlık paneli açıkken bilgisayar hamlesini bekletsin mi? | **Evet.** |
| S4 | HUD'un v3 yeniden çizimi A6'da mı, A7'de mi? | **Karar (inceleme): A6, şerit B'nin ilk adımı (B0).** |
| S5 | Elin üzerinden geçerken nota merdiveni (her kart bir pentatonik nota) kalsın mı? | **Evet**, sessiz seviyede; beğenilmezse tek tık. |
| S6 | Yeniden yazılan anlardaki küçük kamera eğilmeleri (deste bitmesi, oyun sonu; A5'te Kılıç, Volkan, Ayna, Yarık) kalksın mı? | **Kalkar**; kalan bütün kamera davranışı bugünkü gibi. |

(Tuzak penceresinin varlığının "uygun tuzak var" bilgisini sızdırması bir kural / motor konusu; A6 sunumda
sızıntıyı artırmaz — insan yanıtında bütün kapalı kartlar işaretlenir, CPU yanıtında hiçbiri — ve kuralı sonraki
"veriye dayalı etki sistemi" işine not olarak bırakır. Aynı iş Yer Yarığı'nın girişi gerçekten kesmesini de üstlenir.)

---

## 8. Tahmin (ajan-saat)

| Parça | Saat |
|---|---|
| Şerit A6-A: A1 kart nesnesi + v3 arka yüz 6,5 · A2 el + InspectPanel + arayüz taslaklarının içi 5 · A3 çekme + yığın + karıştırma + açılış dağıtımı 4,5 · A4 TileCard v3 + koyma 5 · A5 kurban + atma + mezarlık 3 · A6 mezarlık paneli + seçici 5 · A7 arayüz sesleri (iki dosya) 4 · A8 eleştiri turları + düzeltme 6 · kapılar + MP4 2 | 41 |
| Şerit A6-B: B0 HUD kabuğu 4,5 · B1 tur + aşama 5 · B-open açılış 3,5 · B2 LP 4 · B3 nişan + ret + bağlantılar 6 · B4 blok + tuzak penceresi (hızlı yol) + perde 5,5 · B5 deste bitmesi + zafer 5 · B7 eleştiri turları + düzeltme 6 · kapılar + MP4 2 | 41,5 |
| **A6 şeritleri toplam** | **≈ 82,5** |

Ortak adımlar: A56.0 ≈ 14 (araç 4,5 · çalışma zamanı 7,5 · taban 2), A56.K ≈ 1,5, A56.Z ≈ 7. A5 şeritleri ≈ 70 (A5
planı). İki planın toplamı ≈ 175 ajan-saat (önceki iki plan: 84 + 87 = 171). Takvim §5.0.1: A56.0 (≈ 9,5 sa duvar) →
dört şerit (kritik yol A6-B, ≈ 41,5) → A56.Z (≈ 7) ≈ **58 saat** + kontrol noktasında kullanıcı beklemesi.

Bu revizyonda A6'ya giren: HUD kabuğu (B0, 4,5), açılış (B-open + A3 payı, ≈ 4), karar hızlı yolu (0,5), arayüz
taslaklarının içi (0,5). Ortak adımlara geçen: eski A6.0 ve A6.Z. Dengelemek için `ui-flow` sesleri A6-A'ya geçti; A5'ten
çıkan Titan / Yılan işleri (≈ 11 sa) bu artışı karşılar.

---

## 9. İnceleme notları

İncelemenin bulgularının hepsi uygulandı; aşağıdakiler değiştirilerek uygulandı ya da kısmen reddedildi (her biri tek satır):

- **Bulgu 2 (açılış):** tek bir `V3HOOKS.gameStart` yerine işleyicinin içinde dört kanca noktası (`riffle`, `deal`, `duelPlate`, `hudIn`) kullanıldı; iniş ve yazı-tura kodu hiç dokunulmadan kalsın, kamera değişemesin diye.
- **Bulgu 3 (kill-switch):** `&a6=off` yerine şerit düzeyinde `&a6=off|a|b` (ve `&a5=off|a|b`) kullanıldı; aynı plandaki iki şerit de birbirinden ayrılabilsin diye.
- **Bulgu 4 (HUD ve sıra):** HUD kabuğu önerildiği gibi B0 oldu; ek olarak `ui-flow` seslerinin yazımı A6-B'den A6-A'ya taşındı (A6-B'ye HUD + açılış eklenince kritik yol dengelensin ve arayüz sesleri tek elden çıksın diye).
- **Bulgu 5 (kontrol noktası):** uygulandı; yalnız A5-A yön onayını beklemez (büyü / tuzak dili A2 diliminde kullanıcı onayından geçti), A6'nın iki şeridi onaya kadar görsel dil işi yapmaz.
- **Bulgu 7 (şerit arayüzleri):** iki seçenekten taslak imzalar seçildi (`waveFaceDown`, `createCardV3` + `flipFrames`, `showPile`); perde, istem ve üzerine gelme kendi şeritlerinin alanında kalır.
- **Bulgu 8 (Yer Yarığı):** hızlı yol yalnız CPU / senaryo yanıtlı çağırma pencerelerine uygulandı; saldırı penceresindeki 300 ms işaretleme A2'nin onaylı Zincirler zamanlaması olduğu için korundu.
