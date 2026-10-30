# Büyü / Tuzak taslağı — 1. parti (18 özgün kart)

> Durum: veri + motor + bot + yer tutucu kart resimleri + senaryolar + testler kodda (`src/data/cards.ts`, `src/engine/**`, `src/art/cardart/*.ts`,
> `src/duel/scenarios/st1.ts`, `tests/engine/st1.test.ts`). Sinematikler **varsayılan** yoldan oynar; imza sinematikler için aşağıdaki son sütuna bakın.
> Kurallar sabit: 4000 LP, 20 kartlık deste, 3+3 ya da 5+5 alan (+1 alan büyüsü bölgesi), el sınırı 6, turda 1 Normal Çağırma, mevcut kurban kuralları
> (Sv 1–4: 0, 5–6: 1, 7+: 2 kurban). Yeni faz yok; her kart mevcut motor + küçük, eklemeli şablonlarla çalışır.
> Dağılım: **11 büyü** (6 normal, 2 ekipman, 3 alan) + **7 tuzak**. (İstenen "en az 2 alan büyüsü" fazlasıyla karşılandı: 3 alan büyüsü, Volkan ile 4.)

## 1. Kart tablosu

Tür sütunu: **Büyü** (normal, elden / kapalı koyup aktive), **Ekipman**, **Alan**, **Tuzak** (kapalı konur, bir sonraki turdan itibaren yanıt verir).

### Büyüler

| id | Ad | Tür | Tetik | Etki (Türkçe kart metni) | Denge notu | Şablon | İmza sinematik ne gösterir |
|---|---|---|---|---|---|---|---|
| `fate_trade` | Kader Takası | Büyü | Ana Aşama, elden | 2 kart çek, sonra elinden 1 kart at. (Destede ≥3 kart varsa aktive edilir.) | Net kart kazancı 0, kalite süzgeci: yalnızca "kötü" kartı iyiye çevirir; deste bitme riskini artırır. Tek kopya. | `draw2Discard1` (çekme + mevcut `discard` kararı, Ana Aşamada) | Kartın ortasında altın bir kitap açılır, iki kart uçarak ele düşer; atılan kart kırmızı kıvılcımla dağılır. |
| `double_offering` | Çifte Kurban | Büyü | Ana Aşama, elden | Bu tur Seviye 7 ya da daha yüksek bir canavarı **tek** kurbanla çağırabilirsin (o tur yalnızca tek kurban seçeneği vardır; 2 kurban seçilemez). | Yalnızca elinde Sv 7+ canavar, sahanda ≥1 canavar ve çağırma hakkın varken oynanabilir. Sv 5–6 değişmez. Kurban yine kaybolur (tempo kazancı 1 canavar). | `doubleTribute` (oyuncuda `tributeHelperTurn`) | İki alev halkası tek kurban canavarın üstünde birleşir, sunak ışığı çift parlar. |
| `kneel_down` | Diz Çöktürme | Büyü | Ana Aşama, hedefli | Rakibin saldırı pozisyonundaki 1 canavarı hedef al: savunmaya geçer, sonraki turunda pozisyon değiştiremez. | Yok etmez; rakibin sonraki turdaki saldırısını susturur, bu tur savunmadaki hedefe karşı DEF ile savaşırsın. Kısa süreli kontrol. | `forceDefense` (slotta `lockPositionTurn`) | Hedefin üstüne ağır bir mühür damgası düşer, canavar yavaşça diz çöker. |
| `cycle_of_graves` | Devir Daim | Büyü | Ana Aşama, elden | Mezarlığındaki son 3 kartı desteye karıştır, sonra 1 kart çek. (Mezarlığında ≥3 kart varsa.) | Deste-bitme koruması ve eski büyüleri geri getirir; net kart +0 (1 harca, 1 çek). Döngü yok: aynı kartı tekrar çekmek rastgeledir. | `recycleGraveyard` (yeni olaylar `toDeck`, `shuffle`) | Mezarlık yığınından 3 ruh küresi yükselir, desteye spiral olarak girer, deste parlar. |
| `battle_cry` | Savaş Narası | Büyü | Ana Aşama, hedefli | Sahandaki 1 açık canavarını hedef al: bu tur (Bitiş Aşamasına kadar) ATK +1000. | Tek tur gücü, kalıcı ekipman (+700) kadar değerli değil ama ölümcül hasar / tek vuruş kırma sağlar. | `atkBoostTurn` (slotta `boostAtk/boostTurn`) | Canavarın çevresinde kızıl bir bağırış halkası genişler, ATK rozeti yukarı yuvarlanır. |
| `purging_wave` | Arınma Dalgası | Büyü | Ana Aşama, hedefli | Rakibin sahasındaki 1 Büyü/Tuzak kartını (alan büyüsü dahil) hedef al ve yok et. | Hedef kapalıysa kör nişan; ama ekipman / alan büyüsü ya da tuzak için en temiz cevap. 1'e 1 takas. | `destroyOpponentSpellTrap` (yeni hedef türü `card`) | Beyaz-mavi bir dalga sahayı süpürür, hedef kart cam gibi çatlayıp dağılır. |

### Ekipman büyüleri

| id | Ad | Tür | Tetik | Etki | Denge notu | Şablon | İmza sinematik |
|---|---|---|---|---|---|---|---|
| `piercing_lance` | Delici Mızrak | Ekipman | Ana Aşama, hedefli (kendi açık canavarın) | Kuşanan canavar +300 ATK kazanır ve **Delici Hasar** verir. | Delici (Mercan Yılanı'nın etkisi) bir büyü yuvası ister; kaynağı (kart ya da canavar) sahadan çıkınca etki biter. | `equipPiercing` (`+300 ATK`, `hasPiercing` sorgusu) | Mızrak ışık çizgisi olarak canavara saplanır; saldırıda savunmanın arkasından ikinci bir ok izi çıkar. |
| `guardian_charm` | Koruyucu Tılsım | Ekipman | Ana Aşama, hedefli (kendi açık canavarın) | Kuşanan canavar yok edilecek olursa (savaş ya da etki fark etmez) bunun yerine **bu kart** yok olur. | Tek seferlik koruma. Savaş hasarı yine uygulanır; kurban etmek "yok etme" değildir. Birden çok tılsım sırayla tüketilir. | `equipDestroyShield` (`destroyMonster` içinde yakalama) | Canavarın çevresinde altın bir kalkan halkası; yok olma anında halka kırılır, canavar sağ kalır. |

### Alan büyüleri (alan bölgesi, tek aktif; yenisi eskiyi yok eder)

| id | Ad | Tür | Tetik | Etki | Denge notu | Şablon | İmza sinematik |
|---|---|---|---|---|---|---|---|
| `tidal_bay` | Gelgit Körfezi | Alan | Ana Aşama, elden | Sahadaki tüm SU ve RÜZGAR canavarları +400 ATK, tüm ATEŞ canavarları −400 ATK kazanır (iki saha için de). | Volkan Arenası'nın karşıtı: Volkan'ı süpürür ve ATEŞ'e kaybettirir. SU+RÜZGAR toplam 12 canavar, ATEŞ 5. | `fieldTidalBay` (`fieldAtkModifier`) | Saha mavi-yeşile döner, zeminde gelgit dalgaları ve esen sis; ATEŞ canavarlarından buhar çıkar. |
| `shadow_cavern` | Gölge Mağarası | Alan | Ana Aşama, elden | Sahadaki tüm KARANLIK ve TOPRAK canavarları +300 ATK, tüm IŞIK canavarları −300 ATK kazanır. | KARANLIK+TOPRAK en kalabalık havuz (24 canavar) olduğu için bonus 400 değil 300; IŞIK (11) cezalı. TOPRAK'ı Körfez cezalandırmaz ama Mağara besler. | `fieldShadowCavern` | Tavandan sarkıt gölgeleri iner, mor göz çiftleri açılır; IŞIK canavarlarının ışığı söner. |
| `festival_square` | Şenlik Meydanı | Alan | Ana Aşama, elden | **Sen:** Normal Çağırma/Kapalı Koyma hakkın bittiyse, bu tur Seviye 4 ya da daha düşük bir canavarı 1 kez daha Normal Çağırabilir / Kapalı koyabilirsin (kurbansız). | Yalnızca sahibi için, ATK değiştirmez. Alan bölgesini Volkan'la paylaşmak ve yok edilirse kaybetmek bedelidir. Sv ≥5 hâlâ turda 1. | `fieldExtraSummon` (oyuncuda `extraSummonTurn`) | Sahaya fener ve flama dizisi gerilir, ek çağırma anında konfeti. |

### Devamlı büyüler (büyü/tuzak bölgesinde açık kalır, sayaçlı)

| id | Ad | Tür | Tetik | Etki | Denge notu | Şablon | İmza sinematik |
|---|---|---|---|---|---|---|---|
| `dawn_swords` | Şafak Kılıçları | Devamlı | Ana Aşama, elden (boş büyü/tuzak bölgesi ister) ya da kapalı konup aktive | Rakibin tüm kapalı canavarlarını aç (**çevirme etkisi tetiklenmez**). Bu kart sahadayken rakibin canavarları saldıramaz. Rakibin 3. turunun sonunda bu kart yok olur. | Sayaç 3: rakibin her turunun Bitiş Aşamasında 1 azalır, 0'da mezarlığa gider (rakibin sonraki 3 turu kilitli). Kendi canavarların saldırabilir. Sonradan çağrılan canavarlar da saldıramaz. Sahadan erken ayrılırsa (Arınma Dalgası, Büyü Mührü) kilit hemen biter. Tek kopya. | `attackLock3` (`SpellTrapSlot.counter`, `attackLocked()` sorgusu; olaylar: `activate` (zone dolu), `counter`, `flip` `cause:'reveal'`) | Gün doğumu ışığı sahaya vurur, kapalı kartlar ışıkla açılır; rakibin saha kenarında altın kılıç çiti belirir, her tur sonunda bir kılıç sönüp kaybolur. |

### Tuzaklar

| id | Ad | Tür | Tetik | Etki | Denge notu | Şablon | İmza sinematik |
|---|---|---|---|---|---|---|---|
| `spell_seal` | Büyü Mührü | Tuzak | Rakip bir **Büyü** kartı aktive ettiğinde (elden, kapalıdan, ekipman, alan) | Aktivasyonu geçersiz kıl ve o büyüyü yok et. | Efektsiz tek kart değiş tokuşu; ekipman ve alan büyülerini de iptal eder. Canavar ve tuzak etkilerini durdurmaz. Büyüyü iptal etse de aktivasyon gerçekleşmiş sayılır: sahadaki açık Akşam Büyücüsü yine 300 hasar verir. | `spellActivateNegate` (yeni yanıt penceresi `spellActivated`; çözüm `spellResolve` görevine ertelenir) | Büyü kartının ortasında mühür damgası, kart kırık cam olarak dağılır. |
| `toppling_tower` | Devrilen Kule | Tuzak | Rakip ATK ≥ 1800 bir canavarı Normal, Kurbanla **ya da Özel** Çağırdığında | O canavarı yok et. | Yer Yarığı (≥1000, yalnızca Normal/Kurbanla) ile aynı pencerede yarışır; bunun farkı Özel Çağırmayı da (Ruh Çağrısı) yakalaması. Bir pencerede yalnızca biri. | `summonDestroy1800Plus` (özel çağırma penceresi) | Taş bir kule canavarın üstüne devrilir, toz bulutu. |
| `homecoming` | Eve Dönüş | Tuzak | Rakibin canavarı saldırı ilan ettiğinde | O saldırıyı geçersiz kıl ve saldıran canavarı sahibinin eline geri gönder. | Tempo tuzağı: rakip yeniden çağırma hakkını / kurbanı kaybeder (Sv 5+ özellikle acıtır). Ekipmanları düşer. El 6'yı aşarsa Bitiş Aşamasında atar. Beş Mühür parçası ele dönerse set tamamlanabilir (kontrol edilir). | `attackBounceAttacker` (yeni olay `toHand`) | Saldıran canavar mavi bir kapıdan geri çekilir, kart ele uçar. |
| `decoy_target` | Sahte Hedef | Tuzak | Rakibin canavarı saldırı ilan ettiğinde (en az bir başka kendi canavarın varken) | Kendi sahandaki başka bir canavarı seç; saldırı ona yönelir. | Savaş hilesi: savunman güçlü canavarı öne çıkarırsın. Seçim bir `chooseTarget` kararıdır. Doğrudan saldırıyı (Atmaca) da sapıtır. | `attackRedirect` (kuyruktaki `battle` görevinin hedefi değişir) | Saldırganın önünde bir kukla belirir, ok oraya çevrilir. |
| `last_breath` | Son Nefes | Tuzak | Rakibin verdiği hasarla LP'n 1500'ün altına düştüğünde (0 değilse) | 1500 LP kazan. | Yalnızca rakip turunda gelen hasarda; kendi verdiğin hasar tetiklemez. Ölümcül hasarı kurtarmaz (LP 0 olursa tetik yok). Ayna / Zincir gibi tur kurtaran değil, yarı yarıya iyileşme. | `lpBelow1500Gain1500` (yeni pencere `lpLow`) | Kalp atışı gibi iki parlama, yeşil ışık LP panosuna akar. |
| `sandstorm` | Kum Fırtınası | Tuzak | Rakibin canavarı saldırı ilan ettiğinde | O saldırıyı geçersiz kıl; rakibin tüm açık saldırı pozisyonundaki canavarları savunma pozisyonuna geçer. | Işık Zincirleri savaşı bitirir; bu, saldırıyı durdurur ve rakibin saldırmamış canavarlarını da savunmaya yatırır (zayıf düşer). Savaş Aşaması sürer ama kimse saldıramaz. | `attackNegateAllDefense` | Sahayı kum fırtınası kaplar, rakip canavarlar diz çöker. |
| `hidden_reinforcement` | Gizli Takviye | Tuzak | Rakibin canavarı **sana ait bir canavara** saldırı ilan ettiğinde | Saldırılan canavarın ATK ve DEF'i bu savaş boyunca (Bitiş Aşamasına kadar) +1000. | Saldırıyı geri tepen bir pusuya çevirir; doğrudan saldırıda tetiklenmez. Çelik Susturucu varken kapalı kalır. | `attackedBoost1000` (slotta `boostAtk/boostDef`) | Hedefin altında gizli bir rün ağı yanar, canavar altın bir aura ile büyür. |
| `magic_hat` | Sihirli Şapka | Tuzak | Rakibin canavarı **sana ait bir canavara** saldırı ilan ettiğinde (en az bir boş canavar alanın varken; sahada şapka yokken) | Saldırılan canavar ve en fazla 2 sahte şapka ("Şapka Tuzağı" jetonu, ATK 0 / DEF 0, kapalı savunma) kendi canavarının alanı + boş alanlar arasında karıştırılır (alan sayısı kadar sahte: 1 boş alan = 1, 2+ = 2). Saldıranın sahibi bir şapka seçer (`chooseTarget`; CPU rastgele). Sahte şapka: patlar, hasar yok, gerçek canavar kapalı kalır. Gerçek canavar: şapkalar kalkar (kalan sahteler silinir), canavar çevrilir (çevirme etkisi **tetiklenmez**), savaş kapalı savunma sayılarıyla normal çözülür. Tur sonunda kalan sahteler silinir, gizli canavar eski yüz/pozisyonuna döner. | Gerçek canavar şapkada savunma pozisyonuna geçtiği için ATK'sı işe yaramaz (savaş sonrası eski pozisyonuna döner); saldıran şansa güvenir. Jeton mezarlığa gitmez, kurban/mühür/alan etkisi saymaz (kapalı). Çelik Susturucu varken açılamaz. Doğrudan saldırıda açılmaz. | `hatShuffle` (slotta `hat: 'decoy'\|'real'`, `hatOrigin`; olaylar `hatsShuffled`, `hatChosen`, `decoyPopped`, `hatRevealed`, `hatRestore`) | Üç şapka sahnede yer değiştirir, rakip birini seçer; sahte olan konfeti gibi patlar. |

## 2. Ortak kurallar ve uç durumlar

**Zaman çizelgesi.** Büyü: elden ya da kapalıdan aktive edilir, `activate` olayı çıkar, rakibin `spell_seal` penceresi açılır (yalnızca hazır ve kilitsiz tuzak varsa), sonra çözülür ve mezarlığa gider (ekipman/alan sahada kalır).
Tuzaklar kapalı konduğu turda yanıt veremez (mevcut kural). Yanıt pencereleri: saldırı ilanı (Ayna, Zincir, Eve Dönüş, Sahte Hedef, Kum Fırtınası, Gizli Takviye), çağırma (Yer Yarığı, Devrilen Kule),
büyü aktivasyonu (Büyü Mührü), LP < 1500 (Son Nefes). Her pencerede yalnızca bir tuzak (sade zincir).

**5 alanlı saha.** Hiçbir kart alan sayısına bağlı değildir: Sahte Hedef aday listesi 4'e kadar çıkar; Diz Çöktürme / Arınma Dalgası / Savaş Narası hedefleri 5 alanı tarar;
Şenlik Meydanı ve Çifte Kurban `zones` bilmeden çalışır; Ekipman büyüleri 5 B/T alanından birini ister (hepsi doluysa elden aktive edilemez, kapalı koyulmuşsa kendi alanında aktive edilir).

**Çelik Susturucu (trapLock).** Rakibin açık Çelik Susturucu'su varken hiçbir yeni tuzak da yanıt veremez: bütün pencereler `respondableTraps` üzerinden açılır, yani kilit hepsini kapsar (Büyü Mührü, Son Nefes dahil).
Susturucu yok olursa kapalı tuzaklar bir sonraki pencerede yeniden yanıt verebilir.

**Beş Mühür seti.** Çekme (Kader Takası, Devir Daim) ve ele dönüş (Eve Dönüş) `checkSeals` ile anında kontrol edilir; set tamamlanırsa o oyuncu kazanır (sıra oyuncusu önce).
Bot: Kader Takası'nda bir mühür parçasını atmaz (≥2 parça tutuyorsa), Devir Daim'de mezarlıktaki mühür parçalarını desteye karıştırmak kasıtlıdır.

**Kaynak sahadan çıkarsa.** Ekipman büyüleri: kuşanılan canavar sahadan çıkınca mevcut kurala göre düşer (bonus ve Delici biter). Alan büyüleri: yok olunca etki hemen biter (ATK sorgusu sahadan hesaplanır).
Savaş Narası / Gizli Takviye: canavar çıkınca biter. Diz Çöktürme: kilit canavarın slotunda durur, canavar çıkınca biter. Koruyucu Tılsım: canavar çıkarsa tılsım zaten düşer.
Büyü Mührü'nün hedefi (büyü) bu arada sahadan kalkamaz (zincir yok).

**Döngü / tek kartlık zafer yok.** Her kartın destede tek kopyası var; Devir Daim kendini geri karıştıramaz (aktifken henüz mezarlıkta değil); Kader Takası destede ≥3 kart ister;
Çifte Kurban turda 1 çağırma hakkını yine harcar; Şenlik Meydanı yalnızca Sv ≤4 ek çağırma verir.

**Havuz notu.** `EXPANDED_POOL` bu 18 kartı otomatik içerir (havuz `ALL_CARDS`'tan türer). `expandedDeck` ise ilk 8 B/T kartını sabit tuttuğu için yeni kartlar rastgele destelere girmez:
deste kurucu ajanın örnekleyicisi güncellenmeli (bkz. rapor, açık işler).
