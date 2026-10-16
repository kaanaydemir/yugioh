# A0 — Envanter ve ölçüm (birleşik belge)

Neon Düello v3 planı (`docs/ANIMASYON_PLANI.md`), aşama **A0**. Bu belge beş alan raporunu tek bir
envanterde birleştirir. Ayrıntılar, ölçüm yöntemleri ve kare kare kanıtlar eklerdeki raporlardadır
(bkz. **Ekler**). A0'da kaynak kodda değişiklik yapılmadı. Belge bir tamlık denetiminden geçti;
eklenen ve düzeltilen yerler §7'de listeli.

Ölçüt: plan §4 (hareket kuralları) ve §5 (süre bütçesi). Süreler aksi yazılmadıkça **oyun saati**,
normal hız (1×), varsayılan arena (v1). Oyun saati dondurulup 1/60 sn adımlarla ilerletildi; süreler
CPU yükünden bağımsız ve tekrarlanabilir. Kare süresi ve bellek başsız tarayıcıda (swiftshader,
paylaşılan 4 CPU) ölçüldü ve gerçek cihazı temsil etmez (A7'de gerçek tarayıcıda yeniden ölçülecek).

Birleştirme sırasında şu kanıtlara yeniden bakıldı ve raporlarla tutarlı bulundu:
`monsters-a/sa-titan-atk.png`, `monsters-a/su-wyrm.png`, `monsters-b/close-sbShadeAtk-contact.png`,
`monsters-b/film-sbHawkDies.png`, `spells-traps/spRecall.png`, `spells-traps/tbMirror-reflect-zoom.png`,
`flow-ui/atkTD-zoom.png`, `flow-ui/hand-zoom.png`, `infra-perf/saWyrmAtk-zoom-crop.png`
(hepsi `shots/v3/a0/` altında).

---

## 1. Özet

### 1.1 Oyunun durumu (10 satır)

1. Oyun uçtan uca oynanabiliyor ve kararlı: `npm run typecheck` temiz, `npm test` 96/96. Demo oyunlarında ve ölçülen bütün senaryolarda işleyici hatası ya da watchdog aşımı yok. Animasyonlar gizli kartı hiçbir yerde göstermiyor.
2. 20 kartın hepsinin kendine özgü sinematiği var. 12 canavarın imza girişi, imza vuruşu ve ölüm "tadı" var, 8 büyü / tuzağın da kendi set-piece'i. Fikirler çoğunlukla karakterli.
3. Bedenin hareketi efektlerin gerisinde kalıyor. Sözleşme 5 animle sınırlı (`idle/roar/attack/hit/guard`), kare başına süre yok ve 12 canavar aynı zaman şablonunu kullanıyor. Çağırma, ölüm, diriltme, efekt ve savunmaya geçiş bütün sprite'ı kaydırarak, ölçekleyerek ve boyayarak taklit ediliyor.
4. Rig'ler sağlam bir temel. Hepsi parametrik ve çoğunda gecikmeli ikincil parçalar var (atkı, pelerin, kanat, kuyruk, IK bacak). Yeni pozlar bu rig'lerden çizilebilir.
5. Süreler bütçenin 1,5–3 katı. Saldırı 3,1–5,1 sn, tuzak 2,9–5,0 sn, kurbanlı çağırma 3,7–5,75 sn, diriltme 2,9–5,1 sn. En büyük iki kalem ölüm + mezarlığa gidiş (1,5–2,4 sn) ve sabit 0,55 sn'lik saldırı ilanı. Normal çağırma, çekme, aşama geçişi ve oyun sonu bütçe içinde.
6. Piksel dilini üç şey bozuyor: kesirli kamera yakınlaşması (1,03–1,08; 30 dosyada 46 çağrı, hepsi tek boğaz noktası `CameraRig.focus`'tan geçiyor), sprite'ta kesirli ölçek / döndürme (41 satır) ve döndürülerek uçan kartlar.
7. Tam ekran flaşlar, pankartların ilk karesindeki tam genişlik beyaz bant ve sahayı örten pankartlar plan §3'ü ("aynı anda bütün ekran parlamaz") ihlal ediyor.
8. Işık katmanı varsayılan (v1) oyunda kapalı. Hedef görünüm olan sakin arena (`src/still/`) henüz oyunda değil. P2 tek sayfa + `flipX` ile çizildiği için "ekranda sol üst ışık" kuralı P2'de ters dönüyor.
9. Altyapı sağlam ama tek bir gösteri saati yok: sarsıntı ve hologram bu saatin dışında, iki ayrı hit-stop uygulaması var, duraklatma yok. Açılış 2,05 sn (üretim derlemesi), doku belleği 33 MB, JS süresi ~4–4,5 ms/kare.
10. Arayüz çalışıyor ve metinler Türkçe. Ancak mezarlık inceleme paneli yok, geçersiz hedefe görsel tepki yok ve InspectPanel hızlı taramada tutarsız.

### 1.2 Bütün oyundaki en önemli 15 zayıflık (önem sırasıyla)

| # | Zayıflık | Kanıt (rapor · film) | Öncelik | Aşama |
|---|---|---|---|---|
| 1 | **Poz ve zaman sözleşmesi yetersiz.** Yalnız 5 anim var ve kare başına bekleme yok. 12 canavar tek şablonda: `hit` herkeste 4 kare / 400 ms, `attack` 9–10 kare ve darbe karesi 4–6. Ağır Titan / Golem ejderden hızlı vuruyor. Eksik pozların yerine `roar` her işe koşuluyor: büyücünün hedef göstermesi, Titan'ın ve Perinin art arda ikinci kükremesi, savunma → saldırı, Pusucu'nun ÇEVİR'i. | A G1, G7 · B §1 · altyapı §1.2 | yüksek | A1 |
| 2 | **Süre bütçesi.** Canavara saldırı 3,13–5,08 sn (bütçe 1,6–2,2), doğrudan saldırı 2,55–3,3 (~1,6), tuzak 2,9–3,5 sn aktivasyondan, eylemden girdiye 4,2–5,0 (1,5–2,0), kurbanlı çağırma 3,7–3,8, etkiyle 5,75–6,8 (2,5–3,0), diriltme 2,9–5,1 (~2,0). Küçük olaylar 1,6–4×: tur başı 1,17, Savaş Aşamasına giriş 1,23, koyma 0,77, pozisyon 0,63 / 1,1, çevirme 1,0 sn. | altyapı §7 · B §4 · akış §1 | yüksek | A1–A6 |
| 3 | **Kesirli ölçekleme.** Kamera yakınlaşması 46 çağrıda (darbe karesinde 1,08 "punch"). Sprite'ta squash/stretch 28 satırda, döndürme 13 satırda (ör. golem ölümü 1,22 × 0,62, atmaca dalışında `setAngle`). Kartlarda döndürme ve 0,26–2 arası ölçek. | `infra-perf/saWyrmAtk-zoom-crop.png` · `flow-ui/hand-zoom.png` · altyapı §3 | yüksek | A1 (kamera), A2–A6 |
| 4 | **Ölüm.** Gövde `hit` karesinde donuk kalıyor; işi renk, ölçek ve parçacık yapıyor. Ardından gelen ortak `shatter` sonrası ~300–400 ms boş sahne var, sonra kart boşluktan doğup mezarlığa uçuyor. Yıldırım Hükmü canavarın kendi ölümünü bastırıyor. Oyun sonunda bütün canavarlar aynı glitch ile çöküyor. | A G12 · B §1 · `flow-ui/atkTD-zoom.png` #14–#21 · `spBoltAce.png` | yüksek | A2, A4 |
| 5 | **Diriltme = imza girişinin tekrarı.** Ruh Çağrısı hayaleti karoya getiriyor, hayalet sütunda eriyor, sonra canavarın normal girişi baştan oynuyor. Bu, plan §4'ün doğrudan ihlali. | `spRecall.png` #13–#23 = `cmp-normalSummon-wolf.png` · `film-smbRecall.png` | yüksek | A2 |
| 6 | **Darbe tepkisi.** Tek tür ve yönsüz: hafif / ağır ya da fiziksel / büyüsel ayrımı yok ve gövdenin %88–106'sı tek karede değişiyor. Suikastçı arkadan vurduğunda hedef ona doğru savruluyor. Savunmada `guardHit` ağırlığa bakmadan bütün sprite'ı 2–3 px itiyor. Darbe efekti hedefin silüetini örtüyor (G5). | A G4, G5 · `close-sbShadeAtk-contact.png` #4–#6 · `sa-titan-atk.png` #12–#15 | yüksek | A1 (ağırlık), A2 |
| 7 | **Neden–sonuç ve sayı zamanı.** Saldıran kaybettiğinde savunan kıpırdamıyor; saldıran evine dönüyor ve orada boşluktan vuruluyor. Sayı bu görsel darbeden 0,1–1,0 sn **önce** çıkıyor. Normal saldırıda sayı temastan 2–8 kare sonra çıkıyor, golem karşı etkisinde 684 ms sonra. | B §7.1 · A G6 · `film-sbHawkDies.png` #15–#21 | yüksek | A2 |
| 8 | **Çağırmada karakter geç görünüyor.** Beden ancak son %20–30'da katı ve okunur hale geliyor; öncesi hologram, maske, kırpma ya da efekt. Ejderin 3,8 sn'lik girişinde gerçek renkli beden yalnız son ~0,5 sn'de var; cut-in ~1,5 sn sürüyor. Hiçbir canavarın çağırma pozu yok. | `su-wyrm.png` #9–#23 · `film-smbHawk.png` #11–#17 | yüksek | A2, A4 |
| 9 | **Poz geçişleri.** Bekleme ↔ savunma tek karede değişiyor (600–1650 px) ve ayaklar 2–4 px kayıyor. Vuruş sonundan beklemeye dönüşte %30–41 sıçrama var. Yakın dövüşte ayaklar kayıyor ve canavar eve geri geri zıplayarak dönüyor (Titan, Kurt). Menzilli canavarlar mermi varmadan beklemeye dönüyor. Savunma döngüleri ölü (≈1 px bob, Muhafız'da 3 benzersiz kare). | A G8, G13 · B §2 · `sa-titan-atk.png` #7–#10, #17–#23 | yüksek | A2, A4 |
| 10 | **Tam ekran parlamalar (HUD dahil).** Yıldırım 220 ms boyunca %78 beyaz. Çağırmada ve vuruşta kertenkele cyan, ejder prizma, Mercan jeti, Volkan ateşi tüm ekranı boyuyor. Pankartların ilk karesi tam genişlik düz bant. Doğrudan saldırıda bütün ekran kırmızı vinyetle boyanıyor. | A G15 · tuzak §4.3 · akış §3.3 · `spBolt-strike-zoom.png` #2–#4 | yüksek | A1 (mekanizma), A2–A6 |
| 11 | **Büyü ve tuzak açılışları.** Beş büyüde birebir aynı ~0,8 sn ve 2× kart tahtanın ortasını kapatıyor. Tuzak açılışı ~1,1 sn, üçünde aynı ve "TUZAK!" pankartlı. Ayna Kalkanı'nda iki öldürme arası 34 ms, ölümler üst üste, tuzak çıkışı da sonuçla aynı anda. | tuzak §2A–B, §3J · `tbMirror-reflect-zoom.png` #3–#15 | yüksek | A2, A5 |
| 12 | **Efekt bedenin yerine geçiyor.** Golem karşı darbede hiç kıpırdamıyor. Büyücü asasıyla hedef göstermiyor; dokunaç havuzdan çıkıyor. Kılıç canavarı deliyor (saldırı gibi okunuyor). Yer Yarığı çağırmayı kesmiyor, giriş bitince yutuyor. Hedef tepkileri (kilit, zincir çekişi, uçuruma düşüş) bütün sprite boyama ya da kaydırma. | A §3, §7 · tuzak §3H, §3L · `effect-golem.png` · `spBlade-impact-zoom.png` | yüksek | A2, A4, A5 |
| 13 | **Pankartlar sahayı örtüyor.** Tur pankartı ~1,2 sn, Savaş Aşaması pankartı ~1,0 sn. Işık Zincirleri'nde 3,8 sn içinde üç tam genişlik pankart var. Açılışta kart dağıtımı "DÜELLO!" bandının altında kalıyor. | akış §2.4, §2.6, §3.4 · `turn-zoom.png` · `tbChains.png` | yüksek | A6 |
| 14 | **Arayüz eksikleri.** Mezarlık inceleme paneli yok. Geçersiz hedefe tıklayınca yalnız metin ve ses var. InspectPanel isim ve resmi ~300 ms farklı kartlardan gösteriyor. Tuzak istemi tahtayı karartıyor ve kartları ~0,6 sn geç açıyor. Sıcak koltukta tuzak penceresinde de "SIRA DEĞİŞİYOR" yazıyor. | akış §2.13, §2.15, §2.26, §2.28 · `ui/ui-inspect-grave.png` #5–#6 | yüksek | A6 |
| 15 | **Altyapı eksikleri.** Işık katmanı v1'de kapalı ve sakin arena oyunda değil. Tek gösteri saati yok: sarsıntı ve hologram saat dışında, iki hit-stop var, duraklatma yok. P2 ışığı `flipX` yüzünden ters. Bazı dokular ilk kullanımda üretiliyor (`shatter:<id>`, `finishSheet`), bu da ilk ölümde / ilk çağırmada takılma riski taşıyor. | altyapı §1.6, §4.1, §8 (R2, R5, R6) | yüksek / orta | A1 |

### 1.3 Güçlü olan ve korunacak şeyler

Plan gereği iyi animasyonlar gereksiz yere yeniden yazılmaz. Aşağıdakiler korunur; zayıf yanlar bunların
üstüne eklenerek düzeltilir.

- **Mimari:** kural ile sunum ayrımı, `registry` / `Director` / kart kancaları / gözlemciler. Kurban ve yok etmede hayalet kart yok (`views.sync`). Sahne kapanışında temizlik çalışıyor (oyun başı nesne sayısı sabit). Gizli sekmeden dönüşte birikmiş olaylar topluca tetiklenmiyor. Sarsıntı yalnız dünya kamerasını etkiliyor, HUD ayrı kamerada.
- **Rig'ler** (yeni pozlar bunlardan çizilir):
  - Gölge Suikastçı: IK uzuvlar ve gecikmeli atkı zinciri.
  - Şimşek Kertenkelesi: menteşeli çene ve sırt dikenlerinde enerji dalgası.
  - Fırtına Atmacası: gerçekten ayrı hareket eden kanatlar.
  - Işık Perisi: 4 görünüm, gecikmeli saç ve etek.
  - Kor Kurdu: patilerden IK ve ışık olarak çizilen alevler.
  - Magma Titanı: IK kol / bacak; `I0` ile geçişler temiz (%0–3 fark).
  - Kristal Ejder: parça başına ışık hattı.
  - Gelgit Golemi: iç akıntılar.
- **Canlı bekleme döngüleri:** atmaca, peri, suikastçı, kertenkele, kurt (alevler), golem (akıntı).
- **İyi vuruşlar:**
  - Taş Muhafız kaya fırlatma: en iyi ağırlık hissi; kaya kendi elinden çıkıyor.
  - Şimşek Kertenkelesi: en hızlı ve en net vuruş; şarj okunuyor, şimşek çeneden çıkıyor.
  - Gölge Suikastçı: 70 ms'lik kare tutuşları.
  - Dikenli Pusucu: saldırı topraktan ilerliyor.
  - Kristal Ejder: ışın ağızdan çıkıyor (`CRYSTAL_WYRM_MOUTH`).
  - Magma Titanı: ateş topu göğüs çekirdeğinden çıkıyor.
- **Karakterli girişler:**
  - Dikenli Pusucu'nun tomurcuk kafesi.
  - Şimşek Kertenkelesi: beden şimşeğin içinde silüet olarak beliriyor.
  - Gölge Suikastçı: havuzda açılıp kırpan gözler.
  - Taş Muhafız'ın kalkan çarpması.
  - Çevirmede önce sarmaşıkların çıkması.
- **Ölüm "tatları":** kristal çatlak, boşluğa çekilme, soğuma ve moloz, köpük, alevin sönmesi, erime, kısa devre, solma, tüy fırtınası, gölge havuzu. Fikirler karaktere özgü ve korunur; altlarına çizilmiş beden pozu eklenecek.
- **Okunan neden–sonuç zincirleri:**
  - Mercan Yılanı'nın delici jeti savunanı geçip düelloya ulaşıyor.
  - Pusucu ÇEVİR'i: kök → yeraltı sırtı → sarma.
  - Kertenkele: ölüm → statik top → boşalma (süreklilik).
  - Etki teslimatları LP paneline gidiyor: `burnFly`, `healFly`, `lpPoint`.
- **Akış ve arayüz:**
  - Elden atma (`flow/discard.ts emberStream`): kartın pikselleri mezarlığa akıyor; ölüm → mezarlık sürekliliğinin örneği.
  - Aşama çubuğu (`HudView.setPhase`): hazırlık, uzama, varış.
  - Açılıştaki yazı-tura sahnesi.
  - Tam sayı ölçekli piksel hasar rakamları.
  - Hızlı ve canlı el hover'ı.
  - Ölüm → mezarlık sonrası üst kart güncellemesi.
- **Doğru teknik temeller:**
  - `TileCard` kartı her karede 3B'den piksel tamponuna rasterlıyor; v3 kart yolculuklarının doğru temeli.
  - Cut-in portresi tam sayı ölçekli.
  - Ayna Kalkanı her canavarın kendi `destroyed` ölümünü kullanıyor (mekanizma doğru, sıralama yanlış).
  - Yer Yarığı'nda `sourceOwnsDeath`.
  - Büyü açılışında elden / kapalı karodan ayrımı (sütun + dikilme).
- **Oyunda olmayan ama A2'ye girdi olacak hazır çalışmalar** (eleştirmen turunda eklendi; oyun bunları içe aktarmıyor):
  - `src/still/` (hedef görünüm): sakin arena + elle boyanmış Ejder ve Büyücü idle f0 haritaları (`wyrm-map.ts`, `magus-map.ts`; büyücü haritası P2 aynası için zaten kare içinde sağ üstten ışıklı). Yalnız tek kare; animasyon yok.
  - `src/artlab/variant-a|b|c` (`?dev=art-lab`): aynı iki canavarın yeniden çizilmiş ve canlandırılmış sürümleri. Ejder: `idle / hit / attack / summon / victory` (ölüm yok); Büyücü: `idle / summon / attack / hit / death`. `LabAnim { durations[], marks }` kare başına süreler, kare başına noktalar (`LabFramePoints`: `core`, `muzzle`…) ve tek saat modeli (`src/artlab/core/lab.ts`). A2 pozları ve §5.4 sözleşmesi için başvuru; stil hedefi yine `src/still/`.
  - `src/hd/`: reddedilen HD denemesi (CLAUDE.md); kullanılmaz.
- **Bütçe içinde olanlar:**
  - Normal çağırmalar 1,25–1,57 sn.
  - Kart çekme 366 ms.
  - Çekme / ana / bitiş aşama geçişleri 150–200 ms.
  - Saldırıya uğrayınca açılma 583 ms.
  - Oyun sonu 3,3–3,5 sn.

---

## 2. Kart × olay matrisi

Not: iyi / orta / zayıf / yok. Not v3 hedefine göre verildi; "orta" çoğunlukla "fikir karakterli ama
beden / teknik zayıf" demektir. `—` = bu kart için geçerli değil.

**Kaynak:** hücrelerdeki süreler ve kare kanıtları canavarlar için `a0/canavarlar-a.md` §2–§7 ve
`a0/canavarlar-b.md` §3.1–§3.6, büyü / tuzaklar için `a0/buyu-tuzak.md` §3 E–L'den alındı (oyun saati,
1×, v1). 20 kartın 20'si de matriste (12 canavar + 5 büyü + 3 tuzak; `src/data/cards.ts` ile karşılaştırıldı).
Dört as (Ejder Svy 7, Büyücü Svy 6, Titan ve Yılan Svy 5) yalnız kurbanla çağrılabildiği için "çağırma"
hücreleri `— (as)`; kurbansız normal çağırma motorda mümkün değil (`cards.ts tributesFor`: Svy 5–6 → 1,
Svy ≥7 → 2 kurban; `legal.ts:53`).

**Kısaltmalar:** `art` = `src/art/monsters/<id>.ts` · `sA/` `sB/` `kA/` `kB/` `sp/` `tr/` =
`src/cinematics/summon-a/`, `summon-b/`, `strikes-a/`, `strikes-b/`, `spells/`, `traps/` · `ci/` =
`src/art/cutins/` · `ca/` = `src/art/cardart/` · `RÇ` = `sp/soul_recall.ts` · `hR` =
`_core/helpers.ts hitReact` + `MonsterUnit.guardHit` · `fD` = `flavoredDeath` (kitte) + `vfx/shatter.ts`.

**Büyü / tuzak satırlarında sütunlar şöyle okunur:**
- çağırma = kartın açılışı (elden / kapalı karodan)
- bekleme = sahada kalıcı hali
- hasar = hedefin tepkisi
- ölüm = hedefin ölümü ve kartın gidişi
- efekt = kartın ana etkisi

| Kart | çağırma | kurbanlı | özel-diriltme | bekleme | savunma | saldırı | hasar | ölüm | efekt | kart resmi | portre |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kristal Ejder | — (as) | orta · `sA/crystal_wyrm` (3,78 sn; beden son 0,5 sn) | zayıf · `RÇ` | orta · `art` (bacak hiç oynamıyor) | zayıf · `art` guard (4/8 kare aynı) | orta · `kA/crystal_wyrm` (kaynak doğru, hazırlık durağan) | zayıf · `art` hit + `hR` | orta · `kA/crystal_wyrm` (çatlak iyi, beden donuk) | — (yok; plana uygun) | orta · `art portrait()` (sprite'tan farklı stil) | orta · `ci/crystal_wyrm` (ortak ritim) |
| Uçurum Büyücüsü | — (as) | orta · `sA/abyss_magus` | zayıf · `RÇ` | orta · `art` | zayıf · `art` guard | orta · `kA/abyss_magus` (yalnız asa döner, erken dönüş) | zayıf · `hR` | orta · `kA/abyss_magus` (cüppe çökmesi yok) | zayıf · `kA/abyss_magus` (roar 3'te ~1,5 sn donuk, 2,65 sn) | orta · `art` | orta · `ci/abyss_magus` |
| Magma Titanı | — (as) | orta · `sA/magma_titan` (etkiyle 5,75 sn) | zayıf · `RÇ` | zayıf · `art` (neredeyse durağan) | zayıf · `art` guard | zayıf · `kA/magma_titan` (ayak kayması, geri zıplama) | zayıf · `hR` | orta · `kA/magma_titan` (soğuma iyi) | orta · `kA/magma_titan` (kaynak doğru, roar tekrarı) | orta · `art` | orta · `ci/magma_titan` |
| Mercan Yılanı | — (as) | orta · `sA/coral_serpent` | zayıf · `RÇ` | orta · `art` | zayıf · `art` guard | orta · `kA/coral_serpent` | zayıf · `hR` | orta · `kA/coral_serpent` (köpük okunur) | orta · `kA/coral_serpent` delici (yol iyi, tam ekran flaş) | orta · `art` | orta · `ci/coral_serpent` |
| Kor Kurdu | orta · `sA/ember_wolf` (2 kare "koşu") | — | zayıf · `RÇ` | iyi · `art` (alevler) | zayıf · `art` guard (kazanınca kıpırdamıyor) | orta · `kA/ember_wolf` (ısırma ağızdan, uzatma ölçeği) | zayıf · `hR` | orta · `kA/ember_wolf` (alevin sönmesi) | zayıf · `kA/ember_wolf` (uluma 1,8 sn geç) | orta · `art` | — |
| Gelgit Golemi | orta · `sA/tide_golem` (ortak tarama) | — | zayıf · `RÇ` | iyi · `art` (akıntı) | zayıf · `sB/position` (roar ile 1,1 sn) | orta · `kA/tide_golem` (dalga varmadan döner) | zayıf · `hR` | orta · `kA/tide_golem` (erime 1,22×0,62 ölçekle) | zayıf · `kA/tide_golem` (beden oynamıyor, sayı 684 ms geç) | orta · `art` | — |
| Fırtına Atmacası | orta · `sB/storm_hawk` (son 250 ms görünür) | — | zayıf · `RÇ` | iyi · `art` | zayıf · `art` guard (1 px bob) | zayıf · `kB/storm_hawk` (döndürme, siluet kayboluyor, 3,55 sn) | zayıf · `hR` | zayıf · `kB/storm_hawk` (boşluktan vurulma, sprite düşüşü) | orta · `kB/storm_hawk` direct (aşma okunur, 3,2 sn) | orta · `art` | — |
| Taş Muhafız | orta · `sB/stone_sentinel` (kalkan çarpması iyi) | — | zayıf · `RÇ` | zayıf · `art` (6/8 kare aynı) | zayıf · `art` guard (3 benzersiz kare; kimliği bu) | iyi · `kB/stone_sentinel` (ağırlık iyi; çift hazırlık, 3,73 sn) | zayıf · `hR` (ağır ama itiliyor) | orta · `kB/stone_sentinel` | — (yok; "savunma kimliği") | orta · `art` | — |
| Işık Perisi | orta · `sB/lumen_sprite` (ilk 1,08 sn yok) | — | zayıf · `RÇ` | iyi · `art` | zayıf · `art` guard (1 px bob) | orta · `kB/lumen_sprite` (1–2 px mermiler, 4,07 sn) | zayıf · `hR` | zayıf · `kB/lumen_sprite` (alfa yanıp sönme) | orta · `kB/lumen_sprite` +500 (yağmur okunur, roar tekrarı) | orta · `art` | — |
| Gölge Suikastçı | orta · `sB/shade_assassin` (gözler iyi, kırpmalı yükselme) | — | zayıf · `RÇ` | iyi · `art` | orta · `art` guard (atkı canlı, geçiş sıçrar) | orta · `kB/shade_assassin` (keskin, yön hatası, 4,15 sn) | zayıf · `hR` | orta · `kB/shade_assassin` | — (yok) | orta · `art` | — |
| Şimşek Kertenkelesi | orta · `sB/volt_lizard` (fikir iyi, tam ekran flaş) | — | zayıf · `RÇ` | iyi · `art` | orta · `art` guard (canlı, geçiş sıçrar) | iyi · `kB/volt_lizard` (en net vuruş; tam ekran flaş) | zayıf · `hR` | orta · `kB/volt_lizard` | orta · `kB/volt_lizard` boşalma (süreklilik iyi, 2,9 sn ardışık) | orta · `art` | — |
| Dikenli Pusucu | iyi · `sB/thorn_lurker` (en karakterli giriş) | — | zayıf · `RÇ` | orta · `art` (sol kenar kesik) | orta · `art` guard | orta · `kB/thorn_lurker` (okunur; ince sarmaşık) | zayıf · `hR` | orta · `kB/thorn_lurker` | orta · `kB/thorn_lurker` ÇEVİR (zincir iyi, 3,1–3,9 sn) | orta · `art` | — |
| Yıldırım Hükmü | orta · `sp/_kit` açılış (ortak 0,8 sn) | — | — | — | — | — | zayıf · `vfx/setpieces stormStrike` (dolgu + 1 px) | zayıf · `sp/judgment_bolt` (`destroys` karakter ölümünü bastırıyor) | orta · `sp/judgment_bolt` (%78 beyaz 220 ms, kurban örtülü) | orta · `ca/judgment_bolt` | — |
| Şifa Pınarı | orta · `sp/_kit` | — | — | — | — | — | orta · `battle/damage` lpGain (850 ms) | orta · `sendResolved` | orta · `sp/healing_spring`, `_fountain` (canavarın üstüne fışkırıyor) | iyi · `ca/healing_spring` | — |
| Ruh Çağrısı | orta · `sp/_kit` | — | zayıf · `RÇ` (normal girişi tekrar oynatıyor) | — | — | — | — | zayıf · `RÇ` (kart sütun yükselirken gidiyor) | zayıf · `RÇ` (3,0–5,1 sn) | orta · `ca/soul_recall` ("çocuksu" dil) | — |
| Ejder Kılıcı | orta · `sp/_kit` | — | — | zayıf · `goldAura` (soluk halka, bağ yok) | — | — | zayıf · `sp/dragon_blade` (siluet boyama) | orta · `burstAura` (kırılma) | zayıf · `sp/dragon_blade` (kılıç deliyor) | orta · `ca/dragon_blade` (yoğun dither) | — |
| Volkan Arenası | orta · `sp/_kit` | — | — | orta · `BoardView.setTheme` (gök tamamen kırmızı) | — | — | zayıf · `sp/volcano_arena` heatUp/coolDown (5 sayı üst üste) | orta · eski alanın yanması | orta · `sp/volcano_arena` (lav cephesi iyi; flaş, 1,15 sn sarsıntı) | zayıf · `ca/volcano_arena` (gürültü sınırı aşılıyor) | — |
| Ayna Kalkanı | zayıf · `tr/_opening` (~1,1 sn, ortak) | — | — | — | — | — | orta · canavarların kendi `destroyed` ölümü (ama aynı anda) | zayıf · `trapExit` sonuçla üst üste | zayıf · `tr/_mirror` (34 ms arayla, kubbe çok büyük) | orta · `ca/mirror_barrier` | — |
| Işık Zincirleri | zayıf · `tr/_opening` | — | — | — | — | — | zayıf · `tr/_chains` (tek kare + kayma) | orta · `trapExit` | orta · `tr/_chains`, `tr/chains_of_light` (zincir savunandan geçiyor; 3 pankart) | orta · `ca/chains_of_light` (kalabalık) | — |
| Yer Yarığı | zayıf · `tr/_opening` | — | — | — | — | — | zayıf · `setpieces.chasm` (maskeyle kayma) | orta · `fx.cardToGraveyard` | orta · `tr/chasm_trap` (yarık okunur, çağırmayı kesmiyor) | zayıf · `ca/chasm_trap` (fikir okunmuyor) | — |

**Matristen çıkanlar:**
- **Bütün satırlarda zayıf:** 12 canavarın "hasar" ve "özel-diriltme" hücrelerinin hepsi zayıf. İkisi de ortak koddan geliyor (`hR`, `RÇ`); bir kez düzeltilince 12 canavar birden iyileşir.
- **Savunma:** 12'nin 9'unda zayıf. Nedeni çoğunlukla geçiş pozunun olmaması ve ölü döngü.
- **Ölüm:** hiçbiri "iyi" değil; çizilmiş bir ölüm pozu hiçbirinde yok.
- **Çevirme ve kapalı koyma** (ayrıntı §2.1): kapalı koyma bütün kartlarda ortak `sB/set.ts` ile yapılıyor (doğru olarak kimlik gizli, ama 767 ms). Çevirme ortak `sB/flip.ts`; beş B canavarında (Atmaca, Muhafız, Peri, Suikastçı, Kertenkele) küçük bir `accent` var, Pusucu'da `accent` yerine önce `vineCage` çıkıyor (iyi). Altı A canavarında yalnız element patlaması var (`flip.ts:32` yorumu: "others get the attribute burst only"). Çevirme çağrısı 983–1033 ms (bütçe 0,6 sn). *(Eleştirmen düzeltmesi: önceki sürüm "altı B canavarında accent" diyordu.)*
- **Yer Yarığı'nın çağırmayı kesmesi** (`suChasm`, `smbChasm`, `tbChasmBig`): giriş baştan sona oynuyor, ardından yutuluyor. Kurbanlı Titan'da toplam 8,0 sn.

### 2.1 Canavarlar için ek sütunlar: kapalı koyma, çevirme, pozisyon, doğrudan saldırı

Ana matriste sütunu olmayan canavar olayları (eleştirmen turunda eklendi). Değerler oyun saati, 1×, v1;
kaynak: `a0/canavarlar-a.md`, `a0/canavarlar-b.md` §3–§4, `a0/akis-arayuz.md` §1, `a0/altyapi-olcum.md` §7.
Kapalı koyma kimlikten bağımsızdır (`setMonster` olayında `cardId` yok, `types.ts:174`), bu yüzden "ortak, 767 ms"
bütün canavarlar için geçerli (ölçüm: Golem `smbSetMonster`, Pusucu `smbSetP2`). "ölçülmedi" = A0'da bu canavar için ayrı ölçüm yok; mekanizma ortak olduğu için değer büyük olasılıkla
aynı aralıkta, ama **doğrulanmadı**.

| Canavar | Kapalı koyma (`sB/set.ts`) | Çevirerek çağırma (`sB/flip.ts`) | Saldırıya uğrayıp açılma | Pozisyon: saldırı → savunma / savunma → saldırı (`sB/position.ts`) | Doğrudan saldırı, ilan dahil (bütçe ~1,6 sn) |
|---|---|---|---|---|---|
| Kristal Ejder | ortak, 767 ms; kurbanla koyma ölçülmedi (Titan'da kurban 433 + koyma 784) | yalnız element patlaması; ölçülmedi | ölçülmedi | 633 ms (`smbPosAce`, eleştirmen ölçümü) / ölçülmedi | 3,12 sn (`saWyrmDirect`) |
| Uçurum Büyücüsü | ortak, 767 ms | yalnız element patlaması; ölçülmedi (etki yalnız kurbanlı çağırmada tetiklenir, `rules.ts:575`) | ölçülmedi | ölçülmedi (senaryo yok) | 3,50 sn (`saMagusDirect`) |
| Magma Titanı | 767–784 ms; kurbanla koyma 433 + 784 = 1217 ms (`suTributeSet`) | 1033 ms + yanma etkisi 2067 ms (`saTitanFlip`) | ölçülmedi | ölçülmedi | 3,15 sn (`saTitanDirect`) |
| Mercan Yılanı | ortak, 767 ms | yalnız element patlaması; ölçülmedi | ölçülmedi | ölçülmedi | **ölçülmedi** (`saCoralDirect` senaryosu var, A raporu ölçmemiş) |
| Kor Kurdu | ortak, 767 ms | yalnız element patlaması; ölçülmedi | ölçülmedi | ölçülmedi | 2,80 sn (`saWolfDirect`) |
| Gelgit Golemi | 767 ms (`smbSetMonster`) | yalnız element patlaması; ölçülmedi | `saWyrmDef` içinde; ayrı değer yok | ölçülmedi / 1100 ms, tam `roar` (`smbPos`) | 3,50 sn (`saGolemDirect`) |
| Fırtına Atmacası | ortak, 767 ms | 983 ms, `accent` yaprak (`smbFlipHawk`) | ölçülmedi | 633 ms (`smbPosP2`) / ölçülmedi | 3,22 sn (`sbHawkDirect`) |
| Taş Muhafız | ortak, 767 ms | `accent` kaya; ölçülmedi | 583 ms (`smbFlipAttacked`) | 633 ms (`smbPos`) / ölçülmedi | 2,97 sn (`sbSentinelDirect`) |
| Işık Perisi | ortak, 767 ms | `accent` parıltı; ölçülmedi (etki yalnız Normal Çağırmada, doğru) | ölçülmedi | ölçülmedi / 933–950 ms (`smbPosAce`; 12 fps `roar`) | 2,97 sn (`sbLumenDirect`) |
| Gölge Suikastçı | ortak, 767 ms | `accent` gölge buğusu; ölçülmedi | 583 ms (`smbFlipAttackedP2`) | ölçülmedi | 3,23 sn (`sbShadeDirect`) |
| Şimşek Kertenkelesi | ortak, 767 ms | 1033 ms, `accent` + cyan (`smbFlipP2`) | ölçülmedi | ölçülmedi / 1100 ms (`smbPosP2`) | 2,62 sn (`sbVoltDirect`) |
| Dikenli Pusucu | 767 ms (`smbSetP2`; kimlik gizli, ÇEVİR sürprizi için doğru) | 1033 ms, önce `vineCage` (`smbFlipThorn`) + ÇEVİR etkisi 3,1–3,9 sn | `smbFlipAttackedThorn` var; ayrı değer yok | ölçülmedi | 2,55 sn (`sbThornDirect`) |

Sonuç: kapalı koyma ve pozisyon değişimi 12 canavarda **aynı ortak kodla** yapılıyor; çevirmede karaktere
özgü olan yalnız B grubunun `accent` / `vineCage`'i. Doğrudan saldırıların hepsi bütçenin 1,6–2,2 katı.
Ölçülmemiş hücreler A1'deki `tools/measure.mjs` ile doldurulmalı (§6.1 madde 1).

---

## 3. Olay listesi

### 3.1 Motor olayları (`src/engine/types.ts` `GameEvent`, 28 tür)

28 türün 28'i de tabloda (eleştirmen turunda `types.ts:152-251` ile tek tek karşılaştırıldı); 28'inin de
`registerEvent` ile varsayılan işleyicisi var (`_defaults/{flow,summon,battle}.ts`, `battle/*`). Plan §2'deki
alt türler ayrı satırlarda: `summon` el (normal / kurbanlı) / mezarlık (özel) / saha (çevirme, `from: 'field'`);
`flip` çevirme çağrısı / saldırıya uğrama; `activate` büyü / tuzak / canavar efekti.

**Ölçüm kaynakları:** akış olayları (`gameStart`, `shuffle`, `draw`, `turnStart`, `phaseChange`, `tribute`,
`setMonster` / `setSpellTrap`, `positionChange`, `flip`, `attackDeclare`, `attackNegated`, `damage`, `lpGain`,
`statChange`, `discard`, `decision`, `responseDeclined`, `deckOut`, `gameOver`) → `a0/akis-arayuz.md` §1 ve §2.x;
`summon`, canavar efekti, `battle`, `destroy` → `a0/canavarlar-a.md` / `a0/canavarlar-b.md` tabloları ve
`a0/altyapi-olcum.md` §7 (`shots/v3/a0/perf/durations.json`); büyü / tuzak `activate`, `target`, `equip`,
`fieldSpell`, `toGraveyard` → `a0/buyu-tuzak.md` §1–§4. Hepsi oyun saati, 1×, v1.

| Olay | Bugün (dosya) | Ölçülen → bütçe | Zayıf yan (kanıt) | v3 hedefi | Öncelik | Aşama |
|---|---|---|---|---|---|---|
| `gameStart` | `flow/opening.ts`: kamera inişi, düellocular ışınla, holografik yazı-tura, "DÜELLO!", 8 kart dağıtımı | 5,3 sn (+ `turnStart` = 6,75; `skipIntro` 2,75) → ≤6 sn (GAME_DESIGN) ✓ | "DÜELLO!" ilk karesi tam genişlik beyaz bant; HUD tek karede beliriyor; dağıtım bandın altında kalıyor; para sahnesinde 1,06 zoom (`opening.png` #19, #22–#25) | dağıtım açıkta, yerel parlama, HUD kayarak gelir, tam sayı kamera; ≤5,5 sn | orta | A6 |
| `shuffle` | `flow/opening.ts riffle` (iki izometrik hayalet kart) | 400 ms (açılışın içinde) | yığının kendisi oynamıyor; para ile aynı anda oynadığı için gözden kaçıyor | kendi anı olan 3–4 karelik riffle | düşük | A6 |
| `draw` | `flow/draw.ts` + `HandView.addCard` | 366 ms → 0,3–0,5 ✓ | izometrik hayalet → dik kart geçişi kopuk; döndürme ve kesirli ölçek; çevirmede beyaz şerit karesi (`draw-zoom.png` #5–#11) | tek nesne, tam sayı ölçek; 0,35–0,45 sn | orta | A6 (yardımcı A1) |
| `turnStart` | `flow/turn.ts` + `turnBanner`, `pulseSide` | 1167 ms → 600 ✗ 2× | pankart 1,2 sn boyunca orta bandı örtüyor, harfler seyrek beliriyor (`turn-zoom.png`) | ≤600 ms; bilgi sahada (kenar neonu, düellocu pozu), pankart kenarda | yüksek | A6 |
| `phaseChange` çekme / ana / bitiş | `HudView.setPhase` | 150–200 ms (+ ~480 ms kuyruk) → 300 ✓ | iyi; yalnız çubuk ekranın tepesinde, göz sahadayken zor fark ediliyor | korunur | düşük | — |
| `phaseChange` savaş | `flow/turn.ts` `phaseBanner` + `edgePulse` | 1233 ms → 300 ✗ 4× | pankart ~1 sn sahayı örtüyor; ilk karelerde HUD dahil kırmızı vinyet; "hazır" parlaması bütün sprite boyama (`flowBattle.png`) | ≤300 ms; çubuk kızıla döner, saldırabilecek canavarlarda kısa "hazır" pozu | yüksek | A6 |
| `tribute` | `sA/tribute.ts` `pixelStream` | 1067–1133 ms (kurbanla koymada 433) | kurban tepki vermeden piksellere ayrılıyor, tam beyaz siluet; mezarlığa giden kartlar döndürülüp küçülüyor. Hayalet kart yok (iyi) | kurbanın 2–3 pozluk tepkisi + malzemeye özgü ayrışma; ≤0,8 sn | orta | A2 (ejder) / A6 |
| `summon` normal | `sB/_kit entrance` + `sA/_kit runSummon` + kartın girişi | 1250–1567 ms → 1,2–1,6 ✓ | beden son %20–30'da katı; çağırma pozu yok; hologram / maske / kırpma (`film-smbHawk.png` #11–#17) | `summon` pozu; beden sürenin ≥%50'sinde okunur; efekt silüetin en çok yarısını ve ≤150 ms örter | yüksek | A2 (taban), A4 |
| `summon` kurbanlı (as) | `sA/*` + `cutIn` | 3,67–3,78 sn (Titan etkiyle 5,75; Büyücü karar + etkiyle 6,8) → 2,5–3,0 ✗ | ejderin gerçek rengi son ~0,5 sn'de; cut-in ~1,5 sn; tam ekran beyaz (`su-wyrm.png` #17) | ≤3,0 sn (etkiyle ≤3,5); cut-in ≤1,0 sn; çizilmiş iniş pozu | yüksek | A2 / A4 |
| `summon` özel (mezarlıktan) | `RÇ` → imza girişi `ctx.play(si, {noCard, ghost})` | 2,87–3,12 sn (Titan etkiyle 5,1) → ~2,0 ✗ | normal girişin tekrarı; hayalet karoda eriyor, canavar başka yerden geliyor (`spRecall.png`) | `revive` pozu (ölümün tersi), tek akış; ~2,0 sn | yüksek | A2 |
| `summon` flip | `sB/flip.ts` tüketiyor | `flip` satırına bakın | — | — | — | — |
| `setMonster` / `setSpellTrap` | `sB/set.ts` `slamCard` | 767–784 ms → 400 ✗ 2× | kart döndürülüp kesirli ölçekle uçuyor; kapalı karo boş pedle karışıyor (`smbSetMonster.png` #1) | ≤400 ms; mühür ve parlaklık kuyrukta (girdiyi bekletmeden); tam sayı kart | orta | A6 |
| `positionChange` | `sB/position.ts` | saldırı → savunma 633 ms (Kristal Ejder dahil); savunma → saldırı 1100 ms (Golem, Kertenkele; Işık Perisi 933–950 ms) → 400 ✗ 1,6–2,8× *(düzeltme: önceki "as 933" yanlış atanmıştı; `smbPosAce`'te 633 ms Ejder'in savunmaya geçişi, 933–950 ms Perinin saldırıya dönüşü — eleştirmen ölçümü)* | `setScale(1.08, 0.86)` ezme; idle → guard tek karede (600–1650 px), ayak 2–4 px kayıyor; saldırıya dönüş tam bir roar (`smbPos.png`) | `toGuard` / `fromGuard` 3–4 kare; ölçek yok; ≤0,4 sn | yüksek | A1 (sözleşme), A2 / A4 |
| `flip` çevirerek çağırma | `sB/flip.ts` + `accent` / `vineCage` | 983–1033 ms → 600 ✗ | "pop-out" ölçek; sütun bedeni ~%65 süre örtüyor; normal çağırmadan ayırt edilmiyor | karaktere özgü "pusudan çıkış" pozu; ≤0,6 sn | orta | A4 |
| `flip` saldırıya uğrama | aynı | 583–717 ms → 600 ✓ | kısa ve okunur | korunur | düşük | — |
| `activate` büyü | `sp/_kit.ts spellOpening` + kart | toplam 2,28–2,5 sn → 1,2–2,0 ✗; bırakmaya kadar ~0,8 sn, beşinde aynı | 2× kart tahtanın ortasını kapatıyor; uçuşta 1 → 2 kesirli ölçek + 1,03 itme; düellocunun pozu kartla eşlenmiyor (`spBoltSet-opening.png`) | açılış ≤0,45 sn; karta özgü bırakma; düellocuda kısa büyü pozu | yüksek | A2 (Yıldırım), A5 |
| `activate` tuzak | `tr/_opening.ts` `trapOpening` / `trapExit` | açılış ≈1,1 sn; aktivasyondan bitişe 2,9–3,5 sn (eylemden 4,2–5,0) → 1,5–2,0 ✗ | üçünde aynı; "TUZAK!" ~0,6 sn ortayı kapatıyor; çıkış sonuçla üst üste | açılış ≤0,6 sn; pankart yerel ya da ≤0,35 sn; çıkış sonuçtan sonra | yüksek | A2 (Zincirler), A5 |
| `activate` canavar efekti | `kA/*`, `kB/*` `registerCardHook('effect')` | Büyücü 2650, Titan 2067, Golem 2100, Peri 1883, Kurt 1783, Kertenkele 1283, Pusucu 3067–3933 ms → ≈1,2–2,0 ✗ çoğu | roar tekrarı; golemin bedeni oynamıyor; kaynak anatomik değil (büyücüde dokunaç havuzdan çıkıyor) | `special` pozu, anatomik kaynak (`points()`); ≤1,2–1,6 sn | yüksek | A2 (büyücü), A4 |
| `target` | varsayılan: `_defaults/battle.ts:448` (`lockOn` nişan halkaları + 260 ms bekleme; kancası olmayan her hedefleme bunu oynar); kart kancaları (Yıldırım `brace`, Büyücü kilidi), `_defaults/flow.ts` (`decision chooseTarget` nabzı) | `chooseTarget` 450 ms | kilit bütün sprite'ın dolgusu + 1 px titreme | hedef canavarda nişan köşeleri, parça bazlı irkilme | orta | A2 / A6 |
| `attackDeclare` | `battle/declare.ts` | 550 ms sabit | bütün sprite 1,05 / 0,93 ezme, ±0,5 px titreme, 1,05 zoom; hemen ardından imza vuruşu kendi hazırlığını oynuyor (çift hazırlık) | ilan = vuruşun ilk hazırlık pozu; tam sayı konum; ≤0,3 sn | orta | A2 |
| `attackNegated` | `battle/declare.ts` + Zincirler `negate` kancası | 917 ms | "SAVAŞ BİTTİ" bandı iki kez beyaz kare; geri itilme bütün sprite (`trapChains.png` #25, #28) | engelleme saldıranın bedeninde okunur; kısa sonuç, aşama çubuğuna bağlı | orta | A2 |
| `battle` | `battle/battle.ts` + 12 `registerStrike` | ilan dahil 3,13–5,08 sn → 1,6–2,2 ✗; doğrudan 2,55–3,3 → ~1,6 ✗ | kesirli zoom + 1,08 punch; doğrudan saldırıda HUD dahil kırmızı vinyet; efekt silüeti örtüyor; saldıran kaybedince karşı darbe boşluktan geliyor | tam sayı kamera; temas → tepki → sayı aynı karede; boşluklar kısalır | yüksek | A1 / A2 |
| `damage` | `battle/damage.ts`, `vfx/numbers.ts`, `HudView.setLp` | sayı temastan 2–8 kare sonra (40–134 ms); saldıran kaybedince 0,1–1,0 sn ÖNCE; golem karşı etkisinde 684 ms sonra; LP akışı 480–800 ms (tavan 1100) → ~400 ✗ | aynı bilgi üç kez (sahadaki sayı, panel çipi, akan LP); çip rozetin üstüne biniyor; panel tamamen pembeye boyanıyor (`atkTD-hud.png`) | sayı temas karesinde; LP ≤400 ms; panel flaşı yalnız kenarda | yüksek | A2 |
| `lpGain` | `battle/damage.ts:67` (düellocu `command` pozu, sonra `ctx.base()`) → `_defaults/battle.ts:248` `healFly` / `presentHeal` | 684 / 850 ms → ~400 ✗ | "+500" panelin dışında; panel tamamen yeşile boyanıyor (`lumenGain.png`) | ~400 ms; teslimatla panelin varışı tek vuruş | düşük | A6 |
| `destroy` | `_defaults/battle.ts shatterUnit`, kartların `destroyed` / `destroys` kancaları, `fD` | 1,53–2,4 sn (canavara saldırının yaklaşık yarısı) | beden donuk; ~300–400 ms boş sahne; Yıldırım karakterin ölümünü bastırıyor; çoklu ölümler üst üste (`death-magus.png` #14–#16) | `death` pozu + malzemeye göre parçalanma; ≤1,2–1,4 sn; kart son kareden doğar | yüksek | A2 (taban), A4 |
| `toGraveyard` | `_core/helpers.ts cardToGraveyard`, `tileToGraveyard` | uçuş 380 ms; kart ölümden ~300 ms sonra boşluktan beliriyor | döndürme + 0,42 → 0,26 kesirli ölçek; yığında kartın kimliği okunmuyor; kuşanmalı hedefte üç kart aynı anda uçuyor (`spBoltAce.png` #10–#13) | tek nesne, tam sayı ölçek, sıralı | yüksek | A2 (süreklilik), A6 |
| `equip` | `sp/dragon_blade.ts` `forge()` | kılıç teması 1983; toplam 2433 ms → 2,0 ✗ | kılıç canavarı deliyor; tutma noktası yok; kalıcı bağ soluk; "+700" temastan ~1,2 sn sonra | kart kılıca dönüşür, canavar yakalar (`points().grip`); +700 bağlanma karesinde | orta | A5 |
| `fieldSpell` | `sp/volcano_arena.ts`, `BoardView.setTheme`, `auras.ts` | toplam 2283 (değiştirmede 2483) ms → 2,0 ✗ | bütün gökyüzü kırmızı; tam ekran ateş flaşı; 1,15 sn sarsıntı; tema geçişinde ağır kareler | sakin arenada ton basamaklı lav; ≤2,0 sn | orta | A5 |
| `statChange` | `flow/stats.ts` + `StatBadge` | artış 500, azalış 766 ms | Volkan'da 5 sayı 1,4–2,2 sn üst üste; canavar beyaz silüete dönüyor; aynı değer iki yerde (`spVolcano-stats-zoom.png`) | sıralı (≥150 ms aralık), tek sayı, kısa "güç aldı" pozu | düşük–orta | A5 |
| `discard` | `flow/discard.ts` `emberStream` | 983 / 1167 ms | iyi ve süreklilikli; P2'de közler pankartla çakışıyor | korunur; ~0,8 sn | düşük | A6 |
| `decision` (`trapResponse` / `chooseTarget` / `discard`) | `battle/declare.ts` işareti + `Prompt.trapResponse`; `chooseTarget` nabzı `_defaults/flow.ts:225`; el sınırı seçimi `HumanInput` `discard` modu (görseli çekilmedi, **doğrulanmadı**) | işaret 300–317 ms (+ oyuncunun kararı) | istem tahtayı karartıyor; kartlar ~0,6 sn kapalı; sıcak koltukta "SIRA DEĞİŞİYOR"; pencerenin varlığı uygun bir tuzak olduğunu ele veriyor (`ui/ui-trap-prompt.png`, `ui/ui-hotseat-trap.png`) | sahne görünür kalır; kartlar ≤0,3 sn'de açılır; doğru başlık; sızıntı için tasarım kararı | orta | A6 |
| `responseDeclined` | `battle/declare.ts` | 316 ms | "Geç" savunan canavarın başının yanında çıkıyor, ona aitmiş gibi okunuyor (`tbDecline-zoom.png`) | B/T hizasında, oyuncu renginde; ≤0,3 sn | düşük | A6 |
| `deckOut` | `flow/end.ts` | 2650 ms | asıl olay 10 px boyunda ve 400 ms; pankart 1,6 sn, pembe bantla başlıyor | 2× tam sayı yakın çekim; kısa pankart | düşük | A6 |
| `gameOver` | `flow/end.ts` (+ bitirici darbe gözlemcisi `flow/turn.ts`) | 3,27–3,48 sn → 3–4 ✓; bitirici darbe ilan → gameOver 3,65 sn (≤3,5, sınırda) | çöküş her canavarda aynı glitch; düellocular ~20 px; sarı bant; sebep satırı yok | kaybedenler kendi `death` pozlarıyla düşer; kazanan imza kükremesi; sebep satırı | orta | A6 / A7 |

### 3.2 Arayüz olayları

Plan §2'nin arayüz olayları (kart seçme / hover, hedef seçme, geçersiz hedef) ve A6 listesinin motor olayı
olmayan kalemleri (hover, oynama, mezarlık inceleme paneli) aşağıda; A6'nın diğer kalemleri (çekme, kapalı koyma /
açma, pozisyon, engelleme, atma, kurban, mezarlığa gitme, karıştırma, sıra / aşama, LP, zafer / yenilgi) §3.1'deki
motor olayı satırlarında. Kaynak: `a0/akis-arayuz.md` §2.11–§2.30; son üç satır eleştirmen turunda koddan eklendi.

| Olay | Bugün (dosya) | Ölçülen | Zayıf yan (kanıt) | v3 hedefi | Öncelik | Aşama |
|---|---|---|---|---|---|---|
| El: üzerine gelme / seçme | `src/view/HandView.ts`, `CardSprite.hoverLift` | kalkış 150 ms, komşular 220 ms | yelpazedeki kartlar döndürülmüş, kenarlar testere (`hand-zoom.png`); menü ipucu satırına biniyor (`ui/ui-hand-target.png` #6–#7) | dönmesiz yelpaze (yalnız y dalgası) ya da önceden çizilmiş eğik kareler; menü sabit bir yerde | yüksek | A6 |
| Elden kart oynama | `fx.takeHandCard`, `slamToZone`, `TileCard.slamIn`, `spellShowcase` | kart ~250 ms'de karoda | dik kart döndürülüp kesirli küçülüyor; büyü vitrini kartı kesirli 2× büyütüyor (`play-from-hand.png`) | tek bir "kart yolculuğu" yardımcısı (TileCard rasterlayıcısı, 1× / 2×) | orta | A1 (yardımcı), A6 |
| Hedef seçme | `src/duel/HumanInput.ts` (`pickZone` / `pickTributes` / `pickOne`), `BoardView.highlightZone` | tepki < 1 kare | vurgu yalnız karo çerçevesinde, canavarda nişan yok; talimat çubuğu ile ipucu satırı aynı şeyi söylüyor | aday canavarlarda nefes alan nişan köşeleri, imleç altındakinde kilit; tek talimat satırı | orta | A6 |
| Geçersiz hedef | `HudView.flashHint` + `sfx uiError` | metin 1,2–2,6 sn görünüyor | tıklanan yerde görsel tepki yok; metin ekranın en altında (`ui/ui-hand-target.png` #9–#10, `ui/ui-battle-pick.png` #4–#6) | tıklanan karoda 2–3 karelik kırmızı "ret" darbesi + yatay sarsıntı, seçili saldıranda "hayır" pozu; metin korunur | yüksek | A6 |
| Mezarlık inceleme paneli | **yok** (`HumanInput` boşta `graveyard` tıklamasını işlemiyor; `CardPicker` yalnız Ruh Çağrısı'nda) | — | üst kart dışındaki kartlar Ruh Çağrısı oynamadan hiçbir yoldan görülemiyor (`ui/ui-inspect-grave.png` #5–#6); üst kart yalnız yığında (~16 px) ve hover'da InspectPanel'de (`HumanInput.ts:1027`) görünüyor *(düzeltme: önceki sürüm "mezarlıktaki kartlar … hiçbir yoldan" diyordu)* | yığından yelpazeyle açılan salt-okunur panel; üzerine gelince InspectPanel; Esc / sağ tık kapatır | yüksek | A6 |
| InspectPanel | `src/view/InspectPanel.ts` | ilk hover'da kart ~300 ms kenardan görünüyor | hızlı taramada isim ve resim farklı kartlardan; desteye ve rakibin mini eline gelince hiçbir şey yok (`ui/ui-hand-target.png` #3–#8) | isim ve resim aynı karede değişir (≤120 ms); sayı balonu | orta | A6 |
| Deste / mezarlık yığınları | `src/duel/PileView.ts` | `set()` anlık | yığın yüksekliği animasyonsuz değişiyor; mezarlığın üst kartı ~16 px, okunmuyor (`piles-zoom.png`) | yeni katman kayarak oturur; üst kart okunur boyutta | orta | A6 |
| Ruh Çağrısı seçicisi | `src/duel/CardPicker.ts` | açılış ~220 + 50·n ms | kartlar ekranın ortasında, mezarlıkla bağsız | kartlar kendi yığınlarından uçar; mezarlık paneliyle aynı bileşen | düşük | A6 |
| Sıcak koltuk perdesi | `src/view/Prompt.ts passDevice` | giriş ~600 ms | tuzak penceresinde de "SIRA DEĞİŞİYOR"; giriş sırasında tıklama yutuluyor | bağlama göre başlık; giriş sırasında tıklama kabul edilir | düşük | A6 |
| Hız kontrolü (1× / 2× / 3×, basılı tutunca ×3) | `src/duel/speed.ts` `SpeedControl` (HUD düğmesi × `FAST_FORWARD` = 3; Space ya da boş yerde ≥220 ms basılı tutma), `core.setSpeed` | ölçülmedi | hızlandırma sarsıntıyı ve hologram taramasını etkilemiyor (§5.2); hızlanma / yavaşlama anlık, görsel geri bildirim yalnız düğme | tek gösteri saati üstünden (A1 madde 6); hızlandırma sırasında küçük bir `▶▶` göstergesi | orta | A1 / A6 |
| Düello menüsü (Esc / ≡) ve duraklatma | `HumanInput.requestMenu` / `pauseMenu` (`:280-327`): Devam Et / Teslim Ol / Ana Menüye Dön | ölçülmedi | menü açıkken sinematik ve oyun saati akmaya devam ediyor (gerçek duraklatma yok; kod okundu) | menü açılınca gösteri saati durur, arka plan bir ton kararır | orta | A1 (saat), A6 (görsel) |
| El sınırı atma seçimi (`decision discard`) | `HumanInput` `discard` modu (`:202`, `:789`) + ardından `flow/discard.ts emberStream` | ölçülmedi | seçim ekranı A0'da çekilmedi — **doğrulanmadı** (`flowDiscard*` filmleri yalnız atma animasyonunu gösteriyor) | seçilen kartlar elde işaretlenir; onayla birlikte közleşme başlar | düşük | A6 |

### 3.3 Ölçüm notları (raporlar arası farklar)

- **Hasar sayısı gecikmesi:** canavar raporları sayıyı darbe sesinden itibaren sayıyor (+133 ms, sayı kabının ilk göründüğü an); akış raporu görsel temastan ilk rakama kadar sayıyor (40–80 ms). Bu belgede ikisi "2–8 kare" olarak birleştirildi. `sa-titan-atk.png`'de beyaz flaş 1354 ms'de, "−1" 1488 ms'de görülüyor; gecikme ~134 ms. Hedef: aynı kare.
- **Tuzak ve büyü süreleri iki farklı sınırla ölçüldü:** aktivasyondan görsel bitişe (büyü-tuzak raporu) ve eylemin başından girdinin geri dönmesine (altyapı raporu: Ayna 5,03, Yer Yarığı 4,22 sn). İkisi de bütçenin 1,5–2,5 katı.
- **Büyü açılışı:** bırakmaya kadar ~0,8 sn (filmden). `activate` olayının başlangıcından bir sonraki olaya kadar 1,03–1,62 sn (olay kırılımı).

---

## 4. Ortak bileşenler

### 4.1 Ortak yapılacaklar (bir kez yapılır, bütün kartlar kazanır)

| Ortak bileşen (v3) | Bugün nerede (kopyalar) | Kapsadığı yer | Karta özgü kalan kısım | Aşama |
|---|---|---|---|---|
| **Poz / zaman yardımcıları** (`pose`, `playRange`, `animLengthMs`, `frameStartMs`, `markFrame`) | 5 kopya poz yardımcısı (`kA/_kit.ts:179`, `sA/_kit.ts:122`, `kB/_kit.ts:117`, `sB/_kit.ts:133`, `battle/_kit.ts:164`) + 4 `playFrom` kopyası (`kA/_kit.ts:183`, `sA/_kit.ts:126`, `kB/_kit.ts:124`, `sB/_kit.ts:140`) + 13 dosyada `fps`'ten süre hesaplayan 37 satır | bütün sinematikler | — | A1 |
| **Ağırlık profili** (`src/duel/motion.ts`, `MonsterArt.weight`) | tween süreleri sinematiklere dağılmış; `guardHit` itmesi ağırlığa bakmıyor | 12 canavar: hazırlık süresi, bırakma eğrisi, temas hit-stop, sarsıntı, toparlanma, savunmada itme | sınıf ataması (heavy / mediumHeavy / medium / mediumLight / light / floater / caster) | A1 |
| **Çağırma tabanı** | iki ayrı kit: `sA/_kit runSummon/Stage` ve `sB/_kit entrance/finale` | kart çarpması, mühür, beden kurulumu (kısa hologram), finale, rozet; kural: beden ≥%50 sürede görünür | girişin set-piece'i + `summon` pozu | A2 |
| **Diriltme akışı** | `RÇ` + imza girişinin tekrarı | 12 canavar | `revive` pozu ve malzemenin toplanması (ölümün tersi: kristal kırıklar, gölge parçaları, ışık zerreleri, kuru tohum…) | A2 |
| **Darbe tepkisi kiti** | `hitReact`, `guardReact`, `MonsterUnit.guardHit`, `battle.ts blow` (yön saldıranın ev karosundan hesaplanıyor) | hit / hitHeavy / hitMagic × yön × savunma × ağırlık; flaş silüetin en çok yarısı | tepki pozlarının çizimi; malzeme parçacıkları (tüy, kaya kırıntısı, damla, yaprak) | A2 |
| **Ölüm kiti + kart sürekliliği** | `kA/_kit flavoredDeath`, `kB/_kit flavoredDeath`, `vfx/shatter.ts`, `cardToGraveyard`, `_defaults/battle.ts shatterUnit` | 12 canavar + büyü / tuzak `destroys` kancaları + oyun sonu çöküşü | `death` pozu, tat efekti, malzeme ön ayarı (kristal, taş, ışık, gölge, bitki, ateş, su) | A2 |
| **Savaş sonucu: karşı darbe + sayı zamanı** | `battle/battle.ts`, `battle/damage.ts`, `_core/helpers.ts presentDamage` | her saldırı (özellikle saldıranın kaybettiği ve bloklanan saldırılar) | — | A2 |
| **İlan = hazırlık** | `battle/declare.ts` (ezme + yarım piksel titreme) | her saldırı | ilanın pozu = vuruşun ilk hazırlık kareleri (`marks.charge`) | A2 |
| **Pozisyon geçişi** | `sB/position.ts` (`squash`, `hexGuard`) | 12 canavar | `toGuard` / `fromGuard` pozları | A1 (sözleşme), A2 / A4 |
| **Kart yolculuğu** | `CardSprite.flyTo` (döndürme + kesirli ölçek), `TileCard` raster (doğru temel), `emberStream` (doğru örnek) | çekme, oynama, koyma, kurban, mezarlık, atma, vitrin, seçici, mezarlık paneli | — | A1 (yardımcı), A6 |
| **Büyü açılışı** | `sp/_kit.ts spellOpening` | 5 büyü | bırakma biçimi: buluta (Yıldırım), zemine (Pınar), mezarlığa (Ruh Çağrısı), kılıca (Kılıç), alana (Volkan) | A2 / A5 |
| **Tuzak açılışı / çıkışı** | `tr/_opening.ts` | 3 tuzak | açılıştaki ayrıntı (zincir şıkırtısı, ayna yüzeyinin parlaması, zemin titremesi) | A2 / A5 |
| **Işık darbeleri** | `vfx/core.ts flash` (DEPTH.OVERLAY, HUD'u da boyuyor), kitlerde `screenFlash`, `lightFlash/lightPool/lightBeam` (v1'de etkisiz) | her olay | renk ve şekil | A1 (mekanizma) |
| **Etki teslimatları** | `burnFly`, `healFly`, `fx.lpPoint` | Titan, Kurt, Golem, Kertenkele, Peri, Pınar | teslimat nesnesi (ateş topu, ruh, su, şimşek, parıltı, damla) | korunur |
| **Pankart politikası** | `vfx/banners.ts` | akış, tuzak, oyun sonu | — | A6 (ilk kare bandı A1'de giderilebilir) |
| **Hedef kilidi** | `lockOn`, `brace`, `setCardPulse`, `highlightZone` | hedef seçme, `target`, `decision` | — | A6 |
| **Kamera** | `CameraRig.focus` (46 çağrı) | hepsi | — | A1 |

### 4.2 Karta özgü kalmalı

- **Canavar başına:**
  - Çizimin kendisi ve bütün pozlar (bugünkü 5 anim + yeni `summon / death / revive / special / hitHeavy / hitMagic / toGuard / fromGuard`).
  - İmza vuruşu (`registerStrike`) ve ölüm tadı.
  - Girişin set-piece'i: prizma sütunu, boşluk yarığı, lav yarığı, girdap, ateş halkası, su hortumu, rüzgâr mührü, kaya montajı, ışık huzmesi, gölge havuzu, şimşek çarpması, sarmaşık kafesi.
  - Çevirme `accent`'i.
  - Kart resmi (`portrait()`).
- **As canavarlar:** cut-in portresi ve kendi ritmi (bugün dördü aynı `cutinSequence`'i oynuyor).
- **Canavar etkileri:**
  - Büyücü: dokunaç / ışın asadan çıkmalı.
  - Titan: göğüs çekirdeğinden ateş topu.
  - Kurt: uluma ve alev ruhu.
  - Golem: kolla fırlatılan su topu.
  - Mercan Yılanı: delici jet.
  - Peri: parıltı yağmuru.
  - Kertenkele: statik top ve boşalma.
  - Pusucu: yeraltı sırtı ve sarma.
- **Büyü / tuzak set-piece'leri:**
  - `stormStrike`, `healingFountain`, mezarlık açılışı + hayalet, `forge`, Volkan teması, ayna kubbesi, zincirler, yarık.

---

## 5. Altyapı ve ölçümler (`a0/altyapi-olcum.md`'den özet)

### 5.1 Temel durum ve açılış

| Ölçüm | Değer | Kaynak (`a0/altyapi-olcum.md` · ham dosya `shots/v3/a0/perf/`) |
|---|---|---|
| `npm run typecheck` / `npm test` | temiz (17 sn) / 96/96 (6 dosya, 7,8 sn) | §0 · `typecheck.txt`, `vitest.txt` |
| Başlık ekranı etkileşime hazır | üretim derlemesi 2,05–2,16 sn; geliştirme sunucusu 2,39–3,35 sn | §6.1 · `boot.json`, `bootcmp.json` |
| En uzun görev (`BootScene.create`, eşzamanlı) | 0,91–1,09 sn. En büyük kalemler: v1 arena **661 ms / 15,1 MB** (62 doku), kartlar **446 ms** | §1.1, §6.1 · `boot-profile.txt` |
| Doku belleği | 338 doku / 33,2 MB (arena 15,1 · canavar 9,3 · cut-in 2,6 · kart 2,1 · arayüz 1,4) | §1.1 (toplam satırı) · `texcat.txt` (eleştirmen dosyayı okudu: arena 15,11 / canavar 9,31 / cut-in 2,64 / kart 2,10 / arayüz 1,41 MB tutuyor) |
| JS heap (açılış + 8 sn) | üretimde 48 MB; geliştirmede 79–91 MB | §6.1 · `boot.json`, `bootcmp.json` |
| Soak, demo hız 3, düşük yük | JS ortalama 4,0–4,5 ms/kare; >50 ms sıçrama yok. Yük altında sıçramalar `destroy` (ilk `shatter:<id>`), `summon` (`finishSheet` / yeni doku) ve `phaseChange` sırasında | §6.2 · `soak.json`, `soak-2.json` (swiftshader; gerçek cihazı temsil etmez) |
| Ekrana çizilen kare süresi / FPS | **doğrulanmadı.** Başsız Chromium + swiftshader'da 4–20 FPS (yazılımsal GPU belirliyor); plan §7 gereği 60 FPS burada garanti edilemez. Anlamlı olan JS süresi/kare (yukarıda). | §0, §6.2 · R11; gerçek tarayıcı ölçümü A7 |
| Anim kare süreleri (sanat) | 12 canavarın hepsinde `hit` 4 kare @10 fps = 400 ms; `attack` 9–10 kare @10–12 fps (darbe karesi 4–6); `roar` 9–10 kare @10–12; `idle` 8–12 kare @6–12; `guard` 4–8 kare @4–6. Kare başına süre yok. | §1.2; eleştirmen `monsterArt()` üzerinden yeniden döktü (vite-node), değerler tutuyor |
| Açılış sinematiği | `gameStart` 5,33 + `turnStart` 1,17 = 6,75 sn (`skipIntro` 2,75) | §6.1 · `opening.txt` |
| İlk kullanımda üretilen dokular | `shatter:<id>` (97–438 kare), `ui:panel`, `tilecard:live`, `duel:shadow`, `duel:badge`, `spells:rune`, `flow:chev2`, `set:vignette`, `set:ghost`, `arena:lava`; başlık ekranına her dönüşte `title:logo`, `title:icon` | §1.1 (kod okuması; doku boyutları ayrıca ölçülmedi) |

### 5.2 Zaman ve temizlik

- **Saatler:**
  - Tween, sahne saati, sprite animleri ve özel kare saatleri hızı ve hit-stop'u izliyor.
  - **Kamera sarsıntısı** (`core.ts:58-64`, gerçek ms) ve **hologram `uTime`** (`hologram.ts:299`) izlemiyor: 3×'te sarsıntı aksiyona göre 3 kat uzun sürüyor, hit-stop sırasında tarama çizgileri akmaya devam ediyor.
  - Müzik saat dışında (bilinçli).
- **Hit-stop iki ayrı uygulama:**
  - `core.hitStop` iç içe kullanıma güvenli değil.
  - `combat.stopTime` iç içe güvenli, ama donmuş saat içinde başlarsa 1×'e geri yükleyip bir karelik hız sapması yaratıyor.
- **Duraklatma yok:** Esc menüsü açılıyor ama sinematik arkada sürüyor.
- **Sekmeden dönüş:** biriken zaman topluca tetiklenmiyor (iyi). Ancak Phaser dönüşten sonra 120 kare boyunca ve pencere odakta değilken deltayı 16,7 ms'ye kırpıyor; 30 FPS'lik cihazda bu ağır çekim etkisi yaratır. 20 FPS'in altında 50 ms kırpma yüzünden oyun zamanı gerçek zamandan yavaş akıyor.
- **Temizlik:** 63 SHUTDOWN kancası var; nesne sayısı oyundan oyuna sabit (532 / 530 / 520). Durdurulan düellonun `play()` sözü çözülmüyor, bu da doğru: eski sinematik yeni görünüme dokunamıyor.
- **Heap:** oyun başlarında 82 → 92 → 98 MB arttı. Sızıntı mı önbellek mi belirsiz; A7'de `--repeat --snap` ile izlenecek.
- **Tohumlar:** modül düzeyindeki rastgele tohumlar yeniden başlatmada sıfırlanmıyor (`MonsterUnit.ts:83`, `kB/_kit.ts:85`, `sB/_kit.ts:72`, `flow/_kit.ts:48`, `battle/_kit.ts:47`, `LightLayer.ts:222`). Restart sonrası filmler birebir aynı değil.

### 5.3 Kesirli zoom / ölçek / döndürme listesi

- **Kamera zoom'u** (tek boğaz noktası: `CameraRig.ts:49-56` `focus`, tween `:86-103`, `setZoom :98`). 30 dosyada 46 çağrı (eleştirmen turunda yeniden sayıldı; `_core/Director.ts:358` yalnız `ctx.focus` → `camera.focus` aktarıcısı, `src/artlab` ve `src/hd` sayılmadı); aralık 1,03–1,08 (`zoom` verilmezse `focus()` varsayılanı 1,06), darbede +0,02 punch (`battle/battle.ts:114,121`). Dosyalar:
  - `_core/helpers.ts:274`
  - `_defaults/battle.ts:70,150`
  - `battle/battle.ts:73,114,121`, `battle/declare.ts:63`
  - `flow/end.ts:39,140`, `flow/opening.ts:163`
  - `spells/_kit.ts:599`, `dragon_blade.ts:260`, `judgment_bolt.ts:73`, `soul_recall.ts:316`, `volcano_arena.ts:249`
  - `strikes-a/*` (15 çağrı: `abyss_magus` 3, `coral_serpent` 3, `tide_golem` 3, `crystal_wyrm` / `ember_wolf` / `magma_titan` 2'şer; düzeltme: önceki sürüm 14 diyordu, toplam 46 ancak 15 ile tutuyor), `strikes-b/_kit.ts:384`, `shade_assassin.ts:115`, `storm_hawk.ts:243,259`, `thorn_lurker.ts:591,606,624`
  - `summon-a/{abyss_magus,coral_serpent,crystal_wyrm,magma_titan}.ts`, `summon-b/_kit.ts:499`
  - `traps/_opening.ts:148`, `chains_of_light.ts:53`, `chasm_trap.ts:148`, `mirror_barrier.ts:57`

  Dünya → ekran çeviren kodlar (`kB/_kit.ts:369`, `_core/helpers.ts:558`, `kA/_kit.ts:168`, `HumanInput.ts:971`) zoom değişince kendiliğinden uyum sağlar. **Öneri:** `focus()` yalnız tam sayı kaydırma yapsın; `closeUp: true` verilirse tween'siz, kesmeyle **2× tam sayı** yakın çekime geçsin. Böylece 46 çağrı tek dosyadan düzelir.
- **Canavar sprite'ında kesirli ölçek (28 satır):**
  - `vfx/combat.ts:2330`, `vfx/setpieces.ts:2773,2787`
  - `_defaults/battle.ts:68`, `battle/declare.ts:76,198`
  - `traps/chains_of_light.ts:63,68`, `spells/soul_recall.ts:170`
  - `summon-a/{crystal_wyrm:286, ember_wolf:193, magma_titan:293}`
  - `summon-b/position.ts:29,44`, `summon-b/flip.ts:97`, `summon-b/storm_hawk.ts:250`
  - `strikes-a/{abyss_magus:532, crystal_wyrm:288,304, tide_golem:349, ember_wolf:142, magma_titan:220, coral_serpent:345}`
  - `strikes-b/{stone_sentinel:224, shade_assassin:193, storm_hawk:196,218,391, thorn_lurker:538,550,554,670}`

  Art görüntüleri de (afterimage) bu kesirli ölçeği taşıyor: `kA/_kit.ts`, `vfx/shatter.ts:125,126,192`, `MonsterUnit.ts:167,179`, kitler.
- **Canavar sprite'ında döndürme (13 satır):** `strikes-b/storm_hawk.ts:218,318,327,337,342,380,423`, `thorn_lurker.ts:671`, `strikes-a/ember_wolf.ts:216`, `magma_titan.ts:245`, `vfx/combat.ts:2908,2928`.
- **Kart, karo ve arayüz:**
  - `CardSprite.flyTo` ölçekleri: `_core/helpers.ts`, `spells/_kit.ts`, `flow/discard.ts`, `HandView.ts:293-304`, `summon-a/tribute.ts:103`.
  - `scaleX` ile kart çevirme (`CardSprite.ts:500-516`); `flow/draw.ts:56-57`.
  - `TileCard.ts:399-401,703,710,846,862`.
  - `StatBadge.ts:112-152`, `vfx/numbers.ts:172,249`, `vfx/banners.ts` harfleri, `vfx/cutin.ts:421-433` başlığı.
  - Yazı-tura (`flow/opening.ts:181-266`); ayna (`traps/_mirror.ts:268,272`).
- **Yumuşak parıltı dokuları** (`AK.glow`, `LightLayer.ts:498,710,850,871`): sprite değil, ama "düz ton bandı" hedefiyle çelişiyor.
- **Tuval ölçeği:** `main.ts:37-40` `fitZoom()` pencere 640×360'tan küçükse kesirli ölçek veriyor. Bilinçli bir taviz; korunur.

### 5.4 Sözleşme genişletme önerisi (yalnız ekleme; `src/artlab/types.ts` `LabAnim` modeline dayanır)

```ts
// src/art/types.ts — A1 eki (mevcut alanlar aynen kalır)
export type MonsterAnimExtra = 'summon' | 'death' | 'revive' | 'special' | 'hitHeavy' | 'hitMagic' | 'victory'
  | 'toGuard' | 'fromGuard';                       // ← akış / B raporlarının istediği geçişler
export type AnyMonsterAnim = MonsterAnim | MonsterAnimExtra;
export type WeightClass = 'heavy' | 'mediumHeavy' | 'medium' | 'mediumLight' | 'light' | 'floater' | 'caster';
export type AnimMark = 'impact' | 'release' | 'contact' | 'land' | 'dissolve' | 'recover' | 'charge';

export interface AnimSpec {
  frames: number; fps: number; loop: boolean;
  holds?: number[];                                // kare başına ms (uzunluk === frames); yoksa 1000/fps
  marks?: Partial<Record<AnimMark, number>>;       // 'impact' yoksa attackImpactFrame
}
export interface DrawOpts { lightFrom: 'left' | 'right' }   // P2 relight için
export interface MonsterArt {
  // … mevcut alanlar …
  extraAnims?: Partial<Record<MonsterAnimExtra, AnimSpec>>;
  drawExtra?(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts): void;
  weight?: WeightClass;                            // yoksa 'medium'
  points?(anim: AnyMonsterAnim, frame: number): Partial<Record<
    'muzzle' | 'core' | 'head' | 'hand' | 'staff' | 'claw' | 'feet' | 'grip', { x: number; y: number }>>;
  p2?: 'mirror' | 'relight';                       // yoksa 'mirror' (bugünkü flipX)
}
```

Notlar:
- `toGuard` / `fromGuard` ve `grip` noktası, altyapı raporundaki öneriye canavar-B, akış ve büyü-tuzak raporlarının istekleri doğrultusunda eklendi.
- **Phaser 3.90 kare başına süreyi doğal olarak destekliyor** (`Animation.js:365,518`: `currentFrame.duration || msPerFrame`). Tek istisna: `play({ frameRate })` ile hız ezilirse kare süreleri yok sayılıyor. Ayrıca `Animation.duration` kare sürelerinden hesaplanmıyor; toplam süreye güvenilmemeli. Cut-in'ler bu özelliği zaten kullanıyor (`boot/25-cutins.ts:58`).
- **Doku hattı:**
  - `textures.ts`'te `buildMonster` / `prepareMonster` `animList(art)` üzerinde dönmeli.
  - `anims.create` kare listesine `duration: holds[f]` eklenmeli.
  - `MonsterUnit.play` `AnyMonsterAnim` kabul etmeli; anim yoksa `false` döndürmeli ve çağıran bugünkü yedeğe düşmeli (eski canavarlar değişmeden çalışır).
- **Bellek:** canavar başına ~40 ek kare toplamı 9,3 MB'tan ~19 MB'a çıkarır; P2 relight ile ~38 MB. Sakin arenaya geçiş ~12 MB kazandırır. Önerilenler: önce destedeki canavarları boyamak, animasyon bazında tembel boyama.

### 5.5 Sakin arenanın oyuna alınması

- **Uyum:** `src/still/arena.ts` v1 geometrisini kullanıyor (`zoneXY`, `isoToScreen` ve `cellKind` `layout.ts`'ten geliyor). Yani `layout.ts` değişmeden kalır.
- **Maliyet:** `drawArena` 640×360'ı 25 ms'de çiziyor; bölge maskeleri ve ışık basamaklarıyla tahmini 3–4 MB. Bugünkü v1 arena 661 ms ve 15,1 MB.
- **Önerilen yol:**
  1. Görünüm anahtarı `?look=v3` / `globalThis.__NEON_LOOK`; arena varyantından ayrı ve v1 geometrisini zorlar.
  2. `15-arena.ts` v3 açıkken sakin dokuları üretir: `calm:bg`, `calm:slab`, 20 bölge maskesi (`calm:pad:*`), taraf şeritleri (`calm:trim:*`) ve ışık basamakları.
  3. `src/view/board-calm/BoardViewCalm.ts`, `BoardView`'daki v2 delegasyon kalıbının üçüncü kolu olarak eklenir. Uygulanması gereken API: `zoneAt`, `tileImage`, `highlightZone`, `clearHighlights`, `flashTile`, `pulseSide`, `setActivePlayer`, `setTheme('volcano')`, `setLights`, `setTurn`, `destroy`.
- **Bağımlılık:** dört kit v1 arena dokularını doğrudan içe aktarıyor (`AK.glow`, `AK.mote`: `_core/helpers.ts:33`, `spells/_kit.ts:31`, `summon-a/_kit.ts:24`, `strikes-a/_kit.ts:13`). Bu dokular v1 üreticisinden ayrılıp her görünümde üretilmeli.
- **Işık:** v2'nin yumuşak `LightLayer`'ı ya kapalı kalmalı ya da "basamaklı" moda alınmalı: ped maskesi içinde tek ton kaydırma, alfa karışımı yok.
- **HUD:** v1 HUD mu `hudv2` mi kullanılacağı karara bağlanmalı.

### 5.6 Riskler (özet)

| # | Risk | Öncelik |
|---|---|---|
| R1 | Yeni pozlar eklendikçe süreler daha da uzayabilir (bugün 1,5–3× aşım) | yüksek |
| R2 | P2 ışığı: tek sayfa + `flipX` yüzünden "sol üst ışık" P2'de ters dönüyor; çözüm ikinci sayfa ise canavar dokusu iki katına çıkar. **A2'den önce karar** | yüksek |
| R3 | Kesirli zoom 46 çağrıda (tek dosyadan düzelir); sprite ölçek ve döndürme 41 satıra dağılmış | yüksek (zoom A1) / orta |
| R4 | Kare süreleri `fps`'ten türetiliyor (37 satır, 5 kopya): kare başına bekleme gelince darbe zamanlaması kayabilir | yüksek (A1) |
| R5 | Tek gösteri saati yok | orta |
| R6 | İlk kullanımda doku üretimi ve `finishSheet`'in eşzamanlı boyaması; sayfalar büyüyünce ilk çağırmada donma riski artar | orta |
| R7 | Canavar dokuları ~19 MB, relight ile ~38 MB'a çıkar | orta |
| R8 | Kitler `AK.glow` / `AK.mote`'a bağlı; sakin arena bunları üretmezse doku eksik çıkar | orta |
| R9 | Odak dışı pencerede ve sekmeden dönüşte Phaser'ın delta kırpması | düşük–orta |
| R10 | Tohumlar yeniden başlatmada sıfırlanmıyor | düşük |
| R11 | Ölçüm ortamı (swiftshader) gerçek cihazı temsil etmiyor | bilgi |
| R12 | Oyunlar arasında heap artışı (sızıntı mı önbellek mi belirsiz) | düşük |

---

## 6. A1 ve A2 için somut iş listesi

Ortak kabul ölçütleri (her madde için geçerli):
- `npm run typecheck` temiz ve `npm test` geçiyor.
- Anahtar olmadan (v1) oyun görsel olarak değişmiyor; tek beklenen istisna A1.2'deki kamera.
- İlgili senaryolar `tools/shot.mjs --film` ile çekilip **bakılıyor**.
- Demo oyunlarda hata ve watchdog aşımı yok.

### 6.1 A1 — Altyapı (sırayla)

1. **Ölçüm aracını depoya almak.**
   - Dosya: `tools/measure.mjs` (yeni). A0'da karalama alanında yazılan kancaların birleşimi: `registerObserver` olay zaman çizelgesi, darbe sesi = temas, hasar sayısının ilk göründüğü an, en büyük zoom, `busy` → girdi.
   - Bitti ölçütü: 10 referans senaryoda (`saWyrmAtk`, `saWyrmBlocked`, `saMagusAtk`, `saMagusEffect`, `suWyrm`, `suRevive`, `spBolt`, `tbChains`, `smbPos`, `flowTurnP1`) A0 tablosundaki değerleri ±1 kare tutarlılıkla üretiyor ve JSON yazıyor. A2'den sonra her aşamada regresyon kapısı olarak kullanılıyor.
2. **Tam sayı kamera.**
   - Dosyalar: `src/duel/CameraRig.ts` (`focus :49-56`, tween `:86-103`) ve `src/cinematics/battle/battle.ts:114,121` (punch → sarsıntı / hit-stop).
   - Yapılacak: `focus()` yalnız tam sayı kaydırma yapar; `closeUp: true` ile tween'siz, kesmeyle 2× yakın çekime geçer.
   - Bitti ölçütü: `measure.mjs` bütün senaryolarda en büyük zoom ∈ {1, 2}. `saWyrmAtk-zoom-crop` yeniden çekilince ızgara düzgün. v1 ve v2 çalışıyor.
3. **Sözleşme eki ve doku hattı.**
   - Dosyalar: `src/art/types.ts` (§5.4, yalnız ekleme), `src/art/textures.ts` (`animList`, `duration: holds[f]`, anim bazında tembel boyama) ve yeni `src/art/animtime.ts` (`animLengthMs`, `frameStartMs`, `markFrame`; `src/artlab/core/anim.ts`'ten taşınır).
   - Bitti ölçütü: 12 canavarın sayfaları önce ve sonra piksel olarak birebir aynı (hash). Eski canavarların `measure.mjs` süreleri değişmiyor. Deneme amaçlı `holds` verilen bir anim `?dev=monster` içinde kare başına doğru sürelerle oynuyor.
4. **MonsterUnit zamanlama birliği.**
   - Dosyalar: `src/duel/MonsterUnit.ts` (`play`, `playToFrame`, `impactMs :438-446`, emniyet süreleri `:397,:433,:540`, yeni `pose` / `playRange`, `play(AnyMonsterAnim): boolean`); 5 kit kopyası ince sarmalayıcıya çevrilir (`kA/_kit.ts:179`, `sA/_kit.ts:122`, `kB/_kit.ts:117`, `sB/_kit.ts:133`, `battle/_kit.ts:164`) ve 4 `playFrom` kopyası (`kA/_kit.ts:183`, `sA/_kit.ts:126`, `kB/_kit.ts:124`, `sB/_kit.ts:140`); `fps`'ten süre hesaplayan 37 satır yardımcılara bağlanır.
   - Bitti ölçütü: bütün senaryolar hatasız ve watchdog'suz. `measure.mjs` farkı 0 (eski canavarlarda darbe kareleri kaymadı).
5. **Ağırlık profili.**
   - Dosyalar: yeni `src/duel/motion.ts` (§altyapı 2.5 tablosu), `_core/helpers.ts hitReact/guardReact`, `MonsterUnit.guardHit`.
   - Bitti ölçütü: `guardHit` itmesi heavy sınıfta ≤1 px, light sınıfta 3 px. `sbHawkBlocked` filminde Taş Muhafız kıpırdamıyor. Profil tablosu için birim testi var.
6. **Tek gösteri saati ve duraklatma.**
   - Dosyalar: yeni `src/duel/showclock.ts`; `src/vfx/core.ts` (`hitStop` ve `shake` yeni saate delege eder, API korunur), `src/vfx/combat.ts stopTime`, `src/duel/speed.ts`, `src/vfx/hologram.ts:299` (`uTime`), `HumanInput.ts:280-327` (menü açılınca duraklat).
   - Bitti ölçütü: iç içe hit-stop için vitest geçiyor. 3×'te sarsıntı süresi 1/3'e iniyor. Hit-stop sırasında hologram donuyor. Esc menüsü açıkken oyun saati ilerlemiyor.
7. **Görünüm anahtarı.**
   - Dosyalar: `src/view/layout.ts`'e ek olarak `LOOK` (`?look=v3` / `__NEON_LOOK`, v1 geometrisini zorlar); yeni çizimi olan canavar onu, olmayan eskisini kullanır.
   - Bitti ölçütü: `?look=v3` ile ~79 senaryonun hepsi çalışıyor. Anahtar yokken v1 çekimleri birebir aynı.
8. **Sakin arena oyunda.**
   - Dosyalar: `src/boot/15-arena.ts`, yeni `src/view/board-calm/BoardViewCalm.ts`, `src/view/BoardView.ts` (üçüncü delegasyon kolu), `src/still/*`'in yeniden kullanımı. `AK.glow` / `AK.mote` ortak bir boot adımına taşınır; dört kitin içe aktarması değişir (`_core/helpers.ts:33`, `spells/_kit.ts:31`, `summon-a/_kit.ts:24`, `strikes-a/_kit.ts:13`).
   - Bitti ölçütü: tahta çekimi `src/still` hedefiyle yan yana tutarlı. Arena boot adımı <100 ms ve arena dokuları ≤4 MB. §5.5'teki BoardView API'lerinin hepsi çalışıyor; `tools/playtest.mjs` tıklamaları (hedef, mezarlık, menü) geçiyor.
9. **Işık katmanının basamaklı modu ve yerel flaş.**
   - Dosyalar: `src/view/light/LightLayer.ts` (basamaklı mod: ped maskesi içinde LUT ile ton kaydırma, alfa yok), `src/vfx/core.ts flash`'a ek seçenek (yalnız dünya; HUD hariç, varsayılan bu olur).
   - Bitti ölçütü: `spBolt`, `saWyrmAtk`, `smbVolt`, `saCoralPierce` ve `flowBattle` filmlerinde HUD pikselleri flaştan etkilenmiyor. v3'te çağırma ve saldırıda zemine yerel ışık havuzu düşüyor.
10. **P2 ışığı kararı.**
    - Dosyalar: `MonsterUnit.applyFacing` / `setController` (`:574-579`, `:691-695`), `textures.ts` (`mon:<id>:p2`).
    - Yapılacak: `p2: 'relight'`, sabit görselde sağ üstten ışıklandırılmış büyücü haritasıyla (`still/magus-map.ts`) denenir.
    - Bitti ölçütü: P2 filmlerinde (`saMagusP2`, `suWyrmP2`) ışık ekranda sol üstten geliyor. Bellek farkı ölçüldü. Karar `docs/ANIMASYON_PLANI.md`'ye yazıldı.
11. **Doku ısıtma (orta öncelik).**
    - Yapılacak: `shatter:<id>` ve `ui:panel` gibi dokular açılışta ya da boşta, destedeki canavarlar için önceden üretilir; `finishSheet` anim bazında boyar.
    - Bitti ölçütü: düşük yükte soak'ta ilk çağırma ve ilk ölümde >50 ms sıçrama yok.
12. **Tohum sıfırlama (düşük öncelik).**
    - Yapılacak: §5.2'deki altı modül tohumu düello başında sıfırlanır.
    - Bitti ölçütü: aynı senaryo restart sonrası piksel olarak aynı filmi veriyor.

### 6.2 A2 — Dikey dilim (onay kapısı; sırayla)

Ön koşul: başlamak için A1'in 1–7. ve 10. maddeleri; **teslim (onay kapısı) için 8. ve 9. maddeler de** bitmiş
olmalı, çünkü dilim hedef görünümde (sakin arena + hafif ışık, plan §0 ve §6 A2 "yeni stilde") onaylanacak.
11–12 isteğe bağlı. *(Eleştirmen düzeltmesi: önceki sürüm yalnız 1–7 ve 10'u şart koşuyordu.)*

**Plan uyumu notları (eleştirmen turunda eklendi):**
- **"Çağırma (normal + kurbanlı)":** iki dilim canavarı da yalnız kurbanla çağrılabiliyor (Ejder Svy 7 → 2 kurban,
  Büyücü Svy 6 → 1 kurban; `cards.ts tributesFor`). Kurbansız "normal" çağırma motorda yok. Önerilen karşılık:
  (a) kurbanlı çağırma (`summon method: 'tribute'`), (b) kurbanla kapalı koyma → çevirerek çağırma
  (`setMonster` + `summon method: 'flip', from: 'field'`), (c) Ruh Çağrısı ile özel çağırma. Bu yorumu
  kullanıcı onaylamalı; (b) için bugün dilim canavarlı senaryo yok.
- **Dilim canavarlarını kapsamayan senaryolar:** bugünkü senaryolarda Büyücü'nün Ruh Çağrısı ile dirilmesi,
  Büyücü'nün pozisyon değişimi, Büyücü'nün Yıldırım Hükmü kurbanı olması, Büyücü'nün fiziksel darbe alması ve
  Ejder / Büyücü'nün Işık Zincirleri ile durdurulması **yok** (`spBolt` kurbanı Gölge Suikastçı, `spBoltP2` Magma
  Titanı; `tbChains` Kor Kurdu, `tbChainsP2` Magma Titanı, `tbChainsDirect` Fırtına Atmacası; `suRevive` ve
  `spRecallSet` yalnız Ejder). A2 bunları yeni bir senaryo paketiyle ekler (ör. `src/duel/scenarios/slice.ts`;
  aşağıda "yeni:" diye işaretli).

**Ortak kitler:**

1. **Darbe tepkisi kiti.**
   - Dosyalar: `_core/helpers.ts` (`hitReact`, `guardReact`), `MonsterUnit.guardHit`, `battle/battle.ts blow` (yön, saldıranın o anki dünya konumundan hesaplanır).
   - Yapılacak: güce ve kaynağa göre `hit` / `hitHeavy` / `hitMagic` seçilir; yeni poz yoksa bugünkü `hit`'e düşülür. Flaş silüetin en çok yarısını örter.
   - Bitti ölçütü: `sbShadeAtk`'ta hedef suikastçıdan uzağa savruluyor. `sbShadeBlocked`'ta parıltı arka yüzde çıkıyor. Dilim canavarlarında temas bölgesi önce tepki veriyor (fark haritasında hit f0 < %50).
2. **Ölüm kiti ve kart sürekliliği.**
   - Dosyalar: `kA/_kit.ts` + `kB/_kit.ts` `flavoredDeath` tek modülde birleşir; `vfx/shatter.ts` malzeme ön ayarlarını alır; `_defaults/battle.ts`, `_core/helpers.ts cardToGraveyard`.
   - Yapılacak: `death` pozu varsa o oynar; kart ölümün son karesinde karonun üstünde doğar ve tam sayı ölçekle mezarlığa gider.
   - Bitti ölçütü: `saWyrmAtk` ve `saWyrmBlocked` filmlerinde (bugünkü kanıt: `flow-ui/atkTD-zoom.png` #14–#21) ölüm ile kart arasında boş kare yok. Dilim canavarlarında `destroy` ≤1,4 sn.
3. **Karşı darbe ve sayı zamanı.**
   - Dosyalar: `battle/battle.ts`, `battle/damage.ts`, `_core/helpers.ts presentDamage`.
   - Yapılacak: sayı `marks.contact` karesinde çıkar. Saldıran kaybettiğinde hedefin önünde temas anında geri teper (ya da hedef kısa bir karşı vuruş yapar); sayı ve ölüm o anda başlar. LP akışının tavanı 400 ms.
   - Bitti ölçütü: `measure.mjs` ile sayı karesi = temas karesi ±1 (`saWyrmAtk`, `saWyrmBlocked`, `saMagusBlocked`, `saTitanP2Blocked`).
4. **Çağırma tabanı ve ilan.**
   - Dosyalar: `sA/_kit.ts runSummon` (ve paylaşılan kısmı `sB/_kit.ts entrance` ile ortak), `battle/declare.ts`.
   - Yapılacak: `summon` pozu varsa hologram ≤300 ms ve beden sürenin ≥%50'sinde görünür. Cut-in ≤1,0 sn. İlan, vuruşun `charge` karelerini kullanır; ölçek ve yarım piksel yok.
   - Bitti ölçütü: `suWyrm` ≤3,0 sn ve ejder 1,5 sn'den itibaren gerçek renkte. İlan ≤0,3 sn.
5. **Diriltme.**
   - Dosya: `sp/soul_recall.ts`.
   - Yapılacak: `revive` pozu varsa `ctx.play(si, {noCard, ghost})` çağrılmaz. Hayalet karoya süzülür, beden ölümün tersiyle toplanır. Harcanan kart diriltme bittikten sonra gider.
   - Bitti ölçütü: `suRevive` ve `spRecallSet` (Kristal Ejder) ve yeni: Büyücü diriltme senaryosu ≤2,1 sn. Filmde giriş set-piece'i (altın çember, prizma sütunu, boşluk yarığı) tekrar oynamıyor. Dirilen Büyücü'nün büyü / tuzak yok etme etkisi tetiklenmiyor (motor kuralı: yalnız kurbanlı çağırma, `rules.ts:575`); sunum da etki ya da cut-in göstermiyor.
6. **Pozisyon geçişi.**
   - Dosya: `sB/position.ts`.
   - Yapılacak: `toGuard` / `fromGuard` varsa o pozlar oynar; `setScale` ve roar yok.
   - Bitti ölçütü: `smbPosAce` (Ejder → savunma; bugün 633 ms) ve yeni: Büyücü savunma ↔ saldırı senaryosunda dilim canavarlarının iki yöndeki geçişi ≤0,4 sn ve ayak bandında kayma 0. *(Düzeltme: önceki sürüm `saWyrmDef`'i örnek veriyordu; o bir saldırı senaryosudur, pozisyon değişimi içermez.)*

**Dilim içeriği:**

7. **Kristal Ejder (orta-ağır).**
   - Dosyalar: `src/art/monsters/crystal_wyrm.ts` ya da görünüm anahtarının arkasında yeni bir v3 dosyası (stil kuralları `src/still/*-map.ts`'ten), `sA/crystal_wyrm.ts`, `kA/crystal_wyrm.ts`, `ci/crystal_wyrm.ts` + `ci/index.ts` (karta özgü cut-in ritmi).
   - Pozlar: idle (baş / kanat / kuyruk farklı periyotlarda, bacakta ağırlık), `guard` döngüsü (bugün 8 karenin 4'ü aynı; kanat zarı nefes alır), `toGuard` / `fromGuard`, attack + `holds` (çömelme, boyunda S kıvrımı, kanatlar geride → atılma; ışın süresince göğüs titreşimi), `hit` / `hitHeavy` / `hitMagic`, `summon` (kanatlara sarılı iniş ve açılış), `death` (çatlak, diz, kanat düşüşü, ışık kaybı), `revive` (kırıkların yeniden birleşmesi). Kesirli ölçek kullanılmaz; kare kenarına değen poz kalmaz.
   - Bitti ölçütü:
     - Sayfa `?dev=monster&id=crystal_wyrm` içinde ×3 ölçekte incelendi; hiçbir kare kenara değmiyor.
     - Anim sonu → idle farkı ≤ idle ortalama Δ × 1,2.
     - `saWyrmAtk` ≤2,2 sn, `saWyrmDirect` ≤1,6 sn, `suWyrm` ≤3,0 sn.
     - P1 ve P2 filmleri incelendi.
   - **Giriş portresi (plan A2'nin açık kalemi):** `ci/crystal_wyrm.ts` (`CutinArt`) yeni stilde yeniden çizilir; bugün portre ve kart resmi sprite'tan farklı, daha keskin bir stilde (`a0/canavarlar-a.md` §2). Ritim karta özgü olur (bugün dört as aynı `cutinSequence`: f0 400 ms, f1–f3 70 / 70 / 130 ms, sonra f4 / f5 83 ms'lik ileri-geri döngü; `src/art/cutins/index.ts`, `a0/canavarlar-a.md` G14). Bitti: `?dev=cutin` ve `suWyrm` filminde portre ≤1,0 sn, sprite ile aynı ışık / düzlem dili, titreşim gibi okunan iki karelik döngü yok. Kart resmi (`portrait()`) A5'e kalabilir.
   - Başvuru: `src/artlab/variant-*/dragon.ts` (`summon`, `attack`, `hit`, `victory` pozları ve `LabAnim` süreleri); stil kaynağı yine `src/still/wyrm-map.ts`.
8. **Uçurum Büyücüsü (süzülen büyücü).**
   - Dosyalar: `src/art/monsters/abyss_magus.ts` (v3), `sA/abyss_magus.ts`, `kA/abyss_magus.ts`.
   - Yapılacak: koyu zeminde okunur bir kenar ışığı. Kare başına `points().staff`. `special` pozu (asa hedefe döner, nişan alır; dokunaç / ışın asadan çıkar). `death` içinde cüppe çökmesi ve asanın düşmesi. Küre varana kadar asa hedefi göstermeye devam eder.
   - Pozların tamamı (eleştirmen turunda Ejder listesiyle eşitlendi): idle (gecikmeli süzülme, cüppe ucu dalgası, gölge yüksekliği değişir), `guard` döngüsü + `toGuard` / `fromGuard` (asa / cüppe ile kapanma; bugün idle → guard fark %101), attack + `holds` (ağırlık arka ayağa, asa yay çizer, cüppe gecikir; bugün f1 → f2'de küre tek karede yer değiştiriyor), `hit` / `hitHeavy` / `hitMagic`, `summon` (yarıktan önce miğfer, cüppe açılarak yükselme), `death`, `revive` (karanlık zerrelerin toplanması), `special`. Kesirli ölçek yok (bugün ölümde `setScale(1,06, 0,90)`).
   - Etkinin hedefi: yok edilen büyü / tuzak kartı karoda çatlar (`crackCard`) ve ölümle süreklilik kuralına göre tam sayı ölçekle mezarlığa gider; alan büyüsü hedeflenirse (`saMagusEffectField`, Volkan Arenası) arena sakin temaya döner. Rakipte büyü / tuzak yoksa etki hiç açılmaz (`suMagusP2`); sunum boşa poz oynatmaz.
   - Giriş portresi: Büyücü'nün cut-in'i de kurbanlı çağırmada oynuyor; dilimde eski stilde kalırsa göze batar. Karar: ya Ejder'le birlikte yeni stile alınır ya da dilim süresince kısa tutulur (A5'e not).
   - Başvuru: `src/artlab/variant-*/wizard.ts` (`summon`, `attack`, `hit`, `death`), stil kaynağı `src/still/magus-map.ts` (P2 için kare içinde sağ üstten ışıklı).
   - Bitti ölçütü: `saMagusEffect` içinde etki ≤1,6 sn ve dokunacın kaynağı asa ucu. `saMagusEffectField` ve `saMagusEffectP2` hatasız ve aynı dilde. `saMagusAtk` ≤2,2 sn, `saMagusDirect` ≤1,6 sn. `suMagus` ≤3,0 sn (karar + etki ≤3,5). Sayfa `?dev=monster&id=abyss_magus` ×3'te incelendi; kenara değen kare yok (bugün x = 80, y = 0). Anim sonu → idle farkı ≤ idle ortalama Δ × 1,2. P1 ve P2 filmleri incelendi.
9. **Yıldırım Hükmü.**
   - Dosyalar: `sp/_kit.ts` (açılış ≤0,45 sn, tam sayı ölçek, kart oyuncunun tarafına yakın), `sp/judgment_bolt.ts`, `vfx/setpieces.ts stormStrike`.
   - Yapılacak:
     - Bulut ≤0,4 sn içinde toplanır. Yıldırımın tam parlaklığı ≤120 ms sürer; yerel ışık yalnız hedef şeridinde, HUD sabit kalır.
     - 60–100 ms hit-stop, ardından kurbanda `hitMagic`.
     - **Canavarın kendi ölümü** oynar; `destroys` kancası ölümü sahiplenmez, yalnız elektrik tonu ekler.
     - Kartlar sırayla mezarlığa gider.
   - Bitti ölçütü: `spBolt` ≤2,0 sn. `spBoltAce`'te ejder kristal ölümüyle ölüyor ve üç kart sırayla gidiyor (bugün `spBoltAce.png` #3 tam ekran beyaz, #10–#13 üç kart aynı anda). Yeni: Büyücü'nün kurban olduğu senaryoda cüppe çökmesi okunuyor. Tam ekran beyaz yok.
10. **Işık Zincirleri.**
    - Dosyalar: `tr/_opening.ts` (açılış ≤0,6 sn, karta özgü zincir şıkırtısı), `tr/_chains.ts`, `tr/chains_of_light.ts`, `battle/declare.ts` (`negate`).
    - Yapılacak: zincirler savunanın etrafından dolaşarak çıkar. Saldıran atılmanın ortasında yakalanır, parça bazlı direnir, çekilirken ayakları yere basar (her adımda toz). Pankartlar teke iner: kısa "TUZAK!" + sonuç olarak "SAVAŞ BİTTİ"; ikisi birden tam genişlik olmaz.
    - Bitti ölçütü: `tbChains` aktivasyondan bitişe ≤2,0 sn. Zincir hiçbir karede savunanın gövdesinden geçmiyor. Tam genişlik beyaz bant yok. Yeni: saldıranın Kristal Ejder (nefes şarjı kesilir) ve Uçurum Büyücüsü (küre fırlatılmadan asa bağlanır) olduğu iki senaryo; bugünkü üç senaryo dilim dışı canavarlarla (Kurt, Titan, Atmaca).
11. **Doğrulama ve teslim.**
    - Filmler: P1 / P2, normal / kurbanlı / diriltme, hafif / ağır ve fiziksel / büyüsel darbe. Senaryolar: `suWyrm`, `suWyrmP2`, `suMagus`, `suMagusP2`, `suRevive`, `spRecallSet`, `smbPosAce`, `saWyrmAtk`, `saWyrmBlocked`, `saWyrmDirect`, `saWyrmDef`, `saMagusAtk`, `saMagusBlocked`, `saMagusDirect`, `saMagusEffect`, `saMagusEffectField`, `saMagusEffectP2`, `saMagusP2`, `saTitanP2Blocked`, `spBolt`, `spBoltAce`, `spBoltP2`, `tbChains`, `tbChainsP2` + yeni: Büyücü diriltme, Büyücü pozisyon, Büyücü Yıldırım kurbanı, Ejder / Büyücü Işık Zincirleri, kurbanla koyulmuş Ejder / Büyücü'nün çevrilmesi, Büyücü'ye fiziksel darbe.
    - Darbe türü eşlemesi (bugünkü senaryolarla): büyüsel ağır = `saWyrmAtk` (prizma nefesi → Büyücü), `spBoltAce` (yıldırım → Ejder); büyüsel = `saMagusBlocked` (küre → Ejder); fiziksel ağır, savunmada = `saTitanP2Blocked` (Titan yumruğu → savunmadaki Ejder); su / karşı etki = `saWyrmDef` (golem sıçraması → Ejder). Büyücü'nün fiziksel darbe aldığı senaryo yok (yeni).
    - `measure.mjs` tablosu bütçeyle karşılaştırılır (§5).
    - `?look=v3` ile 2 demo oyun oynatılır.
    - Teslim: oynanabilir adres + kısa gösteri kaydı (filmstrip).
    - **Kullanıcı onayı olmadan A3'e geçilmez.**

---

## 7. Tamlık denetimi (eleştirmen turu)

Bu bölüm birleşik belgenin kaynak gerçeğe (`src/data/cards.ts`, `src/engine/types.ts`, plan §2 / §6) ve koda
karşı denetimini kaydeder. Kaynak kodda değişiklik yapılmadı; yalnız okundu, bir senaryo yeniden ölçüldü
(`shots/v3/a0/critic/smbPosAce.png`, zaman çizelgesi `shots/v3/a0/critic/smbPosAce-timing.txt`) ve çekime bakıldı.

### 7.1 Kapsam

| Kontrol | Sonuç |
|---|---|
| 20 kartın matris satırı | 20 / 20 (12 canavar, 5 büyü, 3 tuzak; adlar `cards.ts` ile aynı). Canavarlar için matriste olmayan olaylar (kapalı koyma, çevirme, saldırıya uğrayıp açılma, pozisyon, doğrudan saldırı) §2.1'e eklendi. |
| `GameEvent` türleri | 28 / 28 (`types.ts:152-251`); 28'inin de varsayılan işleyicisi var. Plan §2'deki alt türler (summon el / mezarlık / saha, flip iki neden, activate üç tür) ayrı satırlarda. `decision`'ın üçüncü türü `discard` eklendi. |
| Plan §2 arayüz olayları | kart seçme / hover, hedef seçme, geçersiz hedef: 3 / 3. A6'nın motor dışı kalemleri (oynama, mezarlık paneli) var; hız kontrolü, Esc menüsü / duraklatma ve el sınırı seçimi satırları eklendi. |
| Ölçüm kaynakları | §2, §2.1, §3.1, §3.2 ve §5.1'e kaynak notu / sütunu eklendi. Ham dosyalar `shots/v3/a0/perf/` (kalıcı); senaryo zaman günlüklerinin çoğu oturumun karalama alanında (kalıcı değil) — A1 madde 1 bu yüzden önemli. |
| Kanıt PNG'leri | Belgede anılan 38 farklı PNG'nin hepsi `shots/v3/a0/**` altında var. `spBoltAce.png` açılıp bakıldı: #3 tam ekran beyaz, #10–#13 üç kart aynı anda uçuyor (iddialarla tutarlı). |
| Senaryo anahtarları | Belgede ve eklerde anılan bütün senaryo anahtarları `src/duel/scenarios*.ts` içinde var. |
| A1 kapsamı (plan §6) | sözleşme eki (madde 3), görünüm anahtarı (7), sakin arena (8), tam sayı kamera (2), hafif ışık (9): hepsi var. Ek olarak ölçüm aracı (1), zamanlama birliği (4), ağırlık (5), gösteri saati (6), P2 ışığı (10). |
| A2 kapsamı (plan §6) | çağırma, bekleme, savunma, saldırı, hasar (hafif / ağır, fiziksel / büyüsel), ölüm, Ruh Çağrısı ile diriltme, büyücünün büyü / tuzak yok etmesi, ejderin giriş portresi, Yıldırım Hükmü, Işık Zincirleri: hepsi listede. Eksikler eklendi: ejder cut-in'inin yeni stilde çizimi ve ritmi, Büyücü'nün tam poz listesi, etki hedefinin (kart / alan / hedefsiz) sunumu, dilim canavarlarını kapsayan yeni senaryolar, "normal çağırma" yorum notu, teslim için A1 8–9 şartı. |

### 7.2 Koda karşı denetlenen iddialar

| # | İddia (belgedeki yer) | Sonuç | Dayanak |
|---|---|---|---|
| 1 | `hit` 12 canavarda 4 kare / 400 ms; `attack` 9–10 kare, darbe karesi 4–6 (§1.2 #1) | ✓ | `monsterArt()` vite-node dökümü (Titan / Golem `attack` @12, Ejder @10) |
| 2 | `CameraRig.focus :49-56`, tween `:86-103` (§5.3) | ✓ | `src/duel/CameraRig.ts` |
| 3 | 30 dosyada 46 `focus` çağrısı, 1,03–1,08 (§5.3) | ✓ toplam; ✗ `strikes-a` 14 değil 15 → düzeltildi | `grep -rn "\.focus("` |
| 4 | Darbe "punch" `battle/battle.ts:114,121` | ✓ | kaynak |
| 5 | 5 poz yardımcısı kopyası (§4.1) | ✓; ✗ `playFrom` 1 değil 4 kopya → düzeltildi | `kA:183`, `sA:126`, `kB:124`, `sB:140` |
| 6 | `AK` içe aktarmaları 4 kitte (§5.5, A1.8) | ✓ | `helpers.ts:33`, `spells/_kit.ts:31`, `summon-a/_kit.ts:24`, `strikes-a/_kit.ts:13` |
| 7 | Sarsıntı `core.ts:58-64`, hologram `uTime` `hologram.ts:299` oyun saati dışında (§5.2) | ✓ | `cameras.main.shake`, `game.loop.time` |
| 8 | `flash` HUD'u da boyuyor (§4.1) | ✓ | `DEPTH.OVERLAY` ≥ `DEPTH.HUD` → UI kamerası (`CameraRig.assignAll`) |
| 9 | Işık katmanı v1'de kapalı (§1.1 #8) | ✓ | `view/light/index.ts:75-79` (`!ARENA_V2` → `null`) |
| 10 | Mezarlık tıklaması işlenmiyor; `CardPicker` yalnız Ruh Çağrısı (§3.2) | ✓; ✗ "kartlar hiçbir yoldan görülemiyor" → üst kart hover'da görünüyor, düzeltildi | `HumanInput.ts:520`, `:1027` |
| 11 | Esc menüsü oyunu durdurmuyor (§5.2) | ✓ | `HumanInput.pauseMenu` saat / hız dokunmuyor |
| 12 | Phaser kare başına süreyi destekliyor (§5.4) | ✓ | `Animation.js:365,518` |
| 13 | 63 SHUTDOWN kancası; 6 modül tohumu (§5.2) | ✓ | `grep` (artlab / hd hariç 63); tohum satırları birebir |
| 14 | Sprite kesirli ölçek / döndürme satırları (§5.3) | ✓ 11 satır örneklendi | `crystal_wyrm:288,304`, `tide_golem:349`, `magma_titan:245`, `storm_hawk:218`, `thorn_lurker:671`, `flip.ts:97`, `soul_recall:170`, `chains_of_light:63`, `declare.ts:76`, `_defaults/battle.ts:68` |
| 15 | Çevirmede "altı B canavarında `accent`" (§2) | ✗ beş + Pusucu'da `vineCage` → düzeltildi | `summon-b/flip.ts:32-59` |
| 16 | `positionChange` "as 933" (§3.1) | ✗ Ejder → savunma 633 ms; 933–950 ms Perinin saldırıya dönüşü → düzeltildi | eleştirmen ölçümü `smbPosAce` |
| 17 | `lpGain` işleyicisi (§3.1) | eksik → `battle/damage.ts:67` (düellocu `command` pozu) eklendi | kaynak |
| 18 | `target` işleyicisi (§3.1) | eksik → varsayılan `_defaults/battle.ts:448` `lockOn` eklendi | kaynak |
| 19 | Kart kesirli ölçek / `scaleX` çevirme `flow/draw.ts:56-57`, `main.ts:37-40 fitZoom` | ✓ | kaynak |
| 20 | Kertenkele tam ekran `flash` satırları (`summon-b/volt_lizard.ts:290`, `strikes-b/volt_lizard.ts:239,492`) | ✓ | kaynak |
| 21 | Dört as aynı `cutinSequence`'i kullanıyor; `boot/25-cutins.ts:58` kare süresi veriyor | ✓ | kaynak |
| 22 | Yıldırım Hükmü kurbanın kendi ölümünü bastırıyor (`destroys` kancası) | ✓ | `judgment_bolt.ts:226`; kurbanın ölümü `sourceOwnsDeath` (`kB/_kit.ts:393`, `kA/_kit.ts:706`) ile çekiliyor |
| 23 | Büyücü etkisi yalnız kurbanlı çağırmada | ✓ | `rules.ts:575-579` |
| 24 | InspectPanel desteye gelince boş | ✓ | `HumanInput` hover: `deck` dalı yok → `back()` |

### 7.3 Doğrulanmadı (yeniden ölçülmedi ya da kanıtı kalıcı değil)

- §3.1, §2 ve §2.1'deki süreler (eleştirmenin yeniden ölçtüğü `smbPosAce` dışında) ek raporlardan alındı; ham
  zaman günlükleri çoğunlukla oturumun karalama alanında, depoda değil. A1 madde 1 (`tools/measure.mjs`) bunları
  depoda tekrarlanabilir kılmalı.
- Ölçülmemiş hücreler: Mercan Yılanı doğrudan saldırısı (`saCoralDirect` var, ölçülmemiş), A grubunun çevirme
  çağrıları (Titan hariç), Büyücü / Yılan / Kurt / Golem diriltmeleri (mekanizma Ejder ile aynı, ~3,0 sn tahmini),
  el sınırı seçim ekranı, hız kontrolü, Esc menüsü.
- Çizim ölçümleri (ayak bandı = 0 piksel değişim, `hit` f0 %88–106, guard benzersiz kare sayıları) eklerin
  betikleriyle üretildi; eleştirmen yalnız kare / fps değerlerini yeniden döktü, piksel farklarını yeniden hesaplamadı.
- InspectPanel'in ~300 ms tutarsızlığı, Ayna Kalkanı'nda iki ölüm arası 34 ms, heap artışının (82 → 98 MB) nedeni
  ve 60 FPS: kanıt eklerde; bu turda yeniden üretilmedi. 60 FPS bu ortamda doğrulanamaz (plan §7).

---

## Ekler — alan raporları ve kanıtlar

| Rapor | Kapsam | Kanıt klasörü |
|---|---|---|
| [`a0/canavarlar-a.md`](a0/canavarlar-a.md) | Kristal Ejder, Uçurum Büyücüsü, Magma Titanı, Mercan Yılanı, Kor Kurdu, Gelgit Golemi; ortak bulgular G1–G16 | `shots/v3/a0/monsters-a/` |
| [`a0/canavarlar-b.md`](a0/canavarlar-b.md) | Fırtına Atmacası, Taş Muhafız, Işık Perisi, Gölge Suikastçı, Şimşek Kertenkelesi, Dikenli Pusucu; çizim ölçümleri (Δ, rigidRes, ayak teması) | `shots/v3/a0/monsters-b/` |
| [`a0/buyu-tuzak.md`](a0/buyu-tuzak.md) | 5 büyü, 3 tuzak, ortak açılışlar, karar / "Geç", kart resimleri, stat sunumu | `shots/v3/a0/spells-traps/` |
| [`a0/akis-arayuz.md`](a0/akis-arayuz.md) | akış olayları, küçük olaylar, el / hedef / InspectPanel / yığınlar / mezarlık, gizli bilgi denetimi | `shots/v3/a0/flow-ui/` (+ `ui/`) |
| [`a0/altyapi-olcum.md`](a0/altyapi-olcum.md) | açılış zinciri, sözleşme, kamera, saatler, temizlik, kesirli liste, sakin arena yolu, açılış / bellek / soak, süre bütçesi, riskler | `shots/v3/a0/perf/`, `shots/v3/a0/infra-perf/` |
| §7 (bu belge) | eleştirmen turu: kapsam, koda karşı denetim, yeniden ölçüm (`smbPosAce`), doğrulanmayanlar | `shots/v3/a0/critic/` |
