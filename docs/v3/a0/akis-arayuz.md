# A0 — Akış ve küçük arayüz olayları envanteri

Kapsam: düello açılışı, karıştırma, kart çekme, tur / aşama geçişleri, kurban (malzemenin ayrılışı),
kapalı koyma, pozisyon değişimi, çevirme, hedef seçme ve geçersiz hedef, saldırı ilanı, saldırının
geçersiz kılınması, varsayılan savaş sunumu, hasar sayıları + LP, LP kazancı, istatistik değişimi,
yok edilme → mezarlık yolculuğu, elden atma, deste bitmesi, oyun sonu, karar / "Geç", eldeki kartın
üzerine gelme / seçme / oynama, InspectPanel, deste ve mezarlık yığınları (PileView), mezarlık inceleme
paneli, gizli bilgi kuralları.

Aşama: **A0, envanter ve ölçüm.** Kaynak kodda değişiklik yapılmadı. Ölçütler: `docs/ANIMASYON_PLANI.md`
§4 (hareket kuralları) ve §5 (süre bütçesi); yer yer `docs/GAME_DESIGN.md` §5–6.

---

## 0. Yöntem ve kanıt dosyaları

**Süre ölçümü.** `tools/shot.mjs --eval` ile sayfaya bir ölçüm kancası takıldı
(`registerObserver` → her olayın başladığı an; sahnenin `postupdate` olayında
`__neon.duel.busy()` → girdinin oyuncuya geri döndüğü an). Oyun saati `__neon.freeze()` ile dondurulup
1/60 sn adımlarla ilerletildi; `Date.now` sanallaştırıldığı için süreler CPU yükünden bağımsız ve
tekrarlanabilir. Hit-stop ve ağır çekim (slowMo) süreye dahildir (oyuncunun gördüğü süre). Hepsi
normal hız (1×), varsayılan arena (v1), sıcak koltuk (hot-seat), perde kapalı (`curtain: false`)
aksi yazılmadıkça. Bir olayın süresi = sonraki olayın başlangıcına (ya da `busy=false`) kadar geçen süre;
bir işleyicinin tükettiği (consume) olaylar ayrıca görünmez. Ölçüm kancası yalnızca karalama
alanındadır (`…/scratchpad/v3/a0/flow-ui/measure.js`), depoya girmedi.

**Arayüz denetimi.** `tools/playtest.mjs` ile gerçek fare / klavye girdisi (Playwright) verildi:
üzerine gelme, tıklama, menü, hedef seçme, geçersiz tıklama, mezarlık tıklama, Ruh Çağrısı seçicisi,
tuzak sorusu, sıcak koltuk perdesi, bilgisayara karşı (vsBot) rakip turu.

**Ölçülmeyenler:** `?arena=v2` ve sakin arena (`src/still/`), gerçek tarayıcıda kare süresi / bellek
(başsız tarayıcı yazılım çiziciyle çalışıyor), 2× / 3× hızlar, uzun oturum.

**Film ve görüntüler** (`shots/v3/a0/flow-ui/`; `ui/` alt klasörü arayüz denemeleri):

| Dosya | İçerik |
|---|---|
| `opening.png` | açılış, 30 kare × 200 ms (0–5,8 sn) |
| `flowTurnP2.png`, `flowTurnP1.png`, `flowEndPhase.png` | tur sonu → tur başı → çekme → ana aşama |
| `turn-zoom.png`, `phasebar-zoom.png`, `phasebar-battle.png` | tur pankartı ve aşama çubuğu yakın plan |
| `draw-zoom.png` | kart çekme, 40 ms aralık, 2× |
| `flowBattle.png` | Savaş Aşamasına geçiş |
| `smbSetMonster.png`, `smbSetP2.png` | kapalı canavar + kapalı büyü/tuzak koyma (P1 / P2), 80 ms, 2× |
| `setAndFlip.png` | koyma → çevirerek çağırma → Dikenli Pusucu hedefi |
| `smbPos.png` | saldırı → savunma, savunma → saldırı, 80 ms, 2× |
| `smbFlipAttacked.png` | saldırıya uğrayan kapalı canavarın açılması + geri tepme hasarı |
| `tributeWyrm.png`, `suTributeSet.png` | kurbanlı çağırma ve kurbanla kapalı koyma (hayalet kart kontrolü) |
| `play-from-hand.png` | elden sahaya kart oynama, 50 ms, 2× |
| `atkTargetDestroyed.png`, `atkTD-zoom.png`, `atkTD-hud.png` | saldırı ilanı → savaş → hasar sayısı → yok edilme → mezarlık; LP paneli 3× |
| `atkDirectHawk.png`, `atkBlocked.png`, `trapDecline.png`, `trapChains.png` | doğrudan saldırı, savunmaya çarpma, tuzak penceresi + "Geç", Işık Zincirleri + geçersiz kılma |
| `lumenGain.png`, `flowStatUp.png` | LP kazancı, istatistik artışı |
| `flowDiscard.png`, `flowDiscardP2.png` | el sınırı atması (P1 / P2) |
| `flowDeckOut.png`, `flowLethal.png`, `flowSurrender.png` | deste bitmesi, bitirici darbe + zafer, teslim olma |
| `piles-zoom.png`, `hand-zoom.png` | yığınlar ve el yelpazesi 3× (piksel dili kontrolü) |
| `ui/ui-hand-target.png` | el hover / seçme / menü / hedef seçme / geçersiz tıklama |
| `ui/ui-inspect-grave.png` | InspectPanel, kapalı kart gizliliği, mezarlık / deste tıklama, Ruh Çağrısı seçicisi |
| `ui/ui-battle-pick.png` | saldıran ve hedef seçme, geçersiz tıklamalar |
| `ui/ui-trap-prompt.png`, `ui/ui-hotseat-trap.png` | tuzak sorusu; sıcak koltuk perdesi |
| `ui/ui-vsbot-turn.png`, `ui/ui-vsbot-hidden.png` | bilgisayarın gizli elden oynaması |

---

## 1. Ölçüm özeti (normal hız, oyun saati)

| Olay | Ölçülen | Plan bütçesi (§5) | Durum |
|---|---|---|---|
| Düello açılışı (`gameStart`, karıştırma + 8 başlangıç kartı dahil) | 5300 ms | (GAME_DESIGN ≤ 6 sn) | uygun |
| Kart çekme (`draw`, tur başı) | 366 ms | 300–500 ms | uygun |
| Tur başlangıcı (`turnStart`) | 1167 ms | 600 ms | **~2× aşım** |
| Aşama geçişi bitiş / çekme / ana | 150 / 150 / 200 ms (çubuk animasyonu ~480 ms kuyrukla sürer) | 300 ms | uygun |
| Savaş Aşamasına geçiş (`phaseChange battle`) | 1233 ms | 300 ms | **~4× aşım** |
| Tur sonu → yeni oyuncuda kontrol (bitiş + tur + çekme + ana) | 2033 ms | parçaların toplamı 0,3 + 0,6 + 0,3 + 0,3–0,5 + 0,3 ≈ 1,8–2,0 sn | sınırda; dağılım yanlış (tur başı uzun) |
| Kapalı canavar / büyü-tuzak koyma | 767–784 ms (kart 240 ms'de yerde) | 400 ms | **~2× aşım** |
| Pozisyon: saldırı → savunma / savunma → saldırı | 633 / 1117 ms | 400 ms | **1,6× / 2,8× aşım** |
| Çevirerek çağırma (`flip` + tüketilen `summon`) | 1033 ms | 600 ms | **1,7× aşım** |
| Saldırıya uğrayınca açılma (`flip attacked`) | 583 ms | 600 ms | uygun |
| Kurban (malzemenin ayrılışı, çağırmadan önce) | 1067–1133 ms | (kurbanlı çağırma toplam 2,5–3,0 sn) | — |
| Kurbanlı ana canavar çağırma, toplam (Kristal Ejder) | 3783 ms | 2500–3000 ms | aşım (summon-a alanı) |
| Kurbanla kapalı koyma (kurban 433 + koyma 784) | 1217 ms | — | — |
| Saldırı ilanı (`attackDeclare`) | 550 ms | (saldırının içinde) | — |
| Canavara saldırı, yok etme dahil (ilan → girdi) | 3850 ms | 1600–2200 ms | **1,8× aşım** |
| Savunmaya çarpıp geri tepme (ilan → girdi) | 3400 ms | 1600–2200 ms | aşım |
| Doğrudan saldırı (ilan → girdi) | 3233 ms | ~1600 ms | **2× aşım** |
| Tuzak penceresi (`decision trapResponse`) / "Geç" (`responseDeclined`) | 317 / 316 ms (+ insan kararı) | — | uygun |
| Işık Zincirleri: tuzak açılışı + `attackNegated` | 1983 + 917 ms | tuzak 1500–2000 ms | sınırda |
| Hasar sayısı: görsel temas → ilk rakam | ~40–80 ms | "temas anında" | uygun |
| LP akışı: 400 / 500 / 1000 / 1700 hasar | ~480 / ~480 / ~640 / ~800 ms (formül `min(1100, max(420, 320 + 0,32·miktar))`) | ~400 ms | aşım (büyük hasarda 2×) |
| LP kazancı (`lpGain`): Işık Perisi 500 / Şifa Pınarı 1000 | 684 / 850 ms | ~400 ms | aşım |
| İstatistik değişimi (`statChange`) artış / azalış | 500 / 766 ms | — | — |
| Yok edilme başlangıcı → kartın mezarlığa varması (Uçurum Büyücüsü) | ~1940 ms (kart 2960 ms'de belirir, 3350 ms'de varır) | — | kopuk (bkz. 3.9) |
| Elden atma (`discard`) 1 kart / 2 kart | 983 / 1167 ms | — | — |
| Deste bitmesi (`deckOut`) | 2650 ms | — | — |
| Oyun sonu (`gameOver`) | 3450–3483 ms | 3000–4000 ms | uygun |
| Bitirici darbe: ilan → `gameOver` başlangıcı (Fırtına Atmacası, 900 LP) | 3650 ms (darbe hasarı 1817 → 3650, ağır çekim) | ≤ 3500 ms | sınırda aşım |
| Elden sahaya kart (normal çağırmanın kart kısmı) | kart ~250 ms'de karoya iner | — | uygun |

---

## 2. Envanter (olay başına)

Her blok istenen sütunları sırasıyla verir: **Olay / kart · Mevcut animasyon (dosya) · Ölçülen süre ·
Zayıf / eksik (kanıt) · Ortak bileşen · Karta özgü kısım · v3 hedefi · Öncelik**.

### 2.1 Düello açılışı (`gameStart`)

| Alan | |
|---|---|
| Olay / kart | `gameStart` (+ tükettiği `shuffle` ve 8 `draw initial`) |
| Mevcut animasyon | `src/cinematics/flow/opening.ts` (`_defaults/flow.ts` içindeki eski sürüm −100 öncelikle yedekte). 0–1,4 sn kamera gökten iner (`CameraRig.descend`), stadyum ışıkları yanar; 0,95 sn düellocular ışın + hologramla belirir, disk kaldırır; 1,5–3,6 sn holografik yazı-tura (20 karelik dönme sayfası, zıplama, ezilme), "OYUNCU n BAŞLIYOR!" harf harf; para kuyruklu yıldız olup düellocuya uçar; desteler iki tur karılır; 3,8 sn HUD açılır, "DÜELLO!" pankartı; 4,2–5,3 sn kartlar sırayla ellere dağıtılır. Tıklama / Enter / Space / Esc kalanı 4× hızlandırır ("Atlamak için tıkla"). |
| Ölçülen süre | 5300 ms (bkz. `opening.png`) |
| Zayıf / eksik | (1) 3,8 sn'de "DÜELLO!" bandı ilk karede tam genişlikte düz beyaz bir şerit (`opening.png` #19) — tüm ekranı tek karede parlatıyor. (2) HUD tek karede birden beliriyor (#18 → #19), giriş animasyonu yok. (3) Dağıtım "DÜELLO!" bandının altında oynuyor (#22–#25): kartların desteden kalkışı bant tarafından örtülüyor, yalnızca ele varış görünüyor. (4) Para sahnesi kesirli yakınlaşma (1,06) kullanıyor; kamera inişi ise tam sayı kaydırma (doğru). (5) Düellocular ~20 px; ışınla belirmeleri okunuyor ama "disk kaldırma" pozu 1× ölçekte seçilmiyor. Yazı-tura kendisi iyi: hazırlık (70 ms çökme), yay, ezilme / sekme, sonuç flaşı. |
| Ortak bileşen | `beamDrop`, `coinTexture` (`flow/_kit.ts`), `materialize` (`vfx/hologram.ts`), `duelStart` → `banner('big')` (`vfx/banners.ts`), `riffle`, `HandView.addCard` |
| Karta özgü kısım | yok |
| v3 hedefi | Sakin arenada tam sayı kamera (iniş = kaydırma, yakınlaşma yok ya da tam 2× kesme). Dağıtım pankarttan sonra ve açıkta: desteden kalkış → yay → ele iniş okunur. Pankart girişinde tam genişlik beyaz kare yerine dar, yerel parlama. HUD panelleri kenardan kayarak gelir. Toplam ≤ 5,5 sn, atlama korunur. |
| Öncelik | orta |

### 2.2 Karıştırma (`shuffle`)

| Alan | |
|---|---|
| Olay / kart | `shuffle` (motor yalnızca açılışta üretir; açılış işleyicisi tüketir) |
| Mevcut animasyon | `flow/opening.ts` `riffle`: destenin üst iki izometrik kartı (`isoGhost`) iki yana ayrılıp kalkar, yer değiştirip geri iner (2 tur × 200 ms), yığın `bump()` ile 1 px seker. |
| Ölçülen süre | 400 ms (açılışın içinde, para uçarken) |
| Zayıf / eksik | Yığının kendisi hareket etmiyor; yalnızca iki hayalet kart sağa-sola kayıyor. Açılışta para ve "OYUNCU n BAŞLIYOR" ile aynı anda oynadığı için gözden kaçıyor (`opening.png` #16–#18, çok küçük). |
| Ortak bileşen | `isoGhost`, `PileView.bump` |
| Karta özgü kısım | yok |
| v3 hedefi | 3–4 karelik el çizimi "riffle" pozu (yığın ikiye ayrılır, kartlar şelale gibi birleşir), kendi anına sahip, ses ile eşleşmiş. |
| Öncelik | düşük |

### 2.3 Kart çekme (`draw`, başlangıç ve tur başı)

| Alan | |
|---|---|
| Olay / kart | `draw` (initial = açılışta dağıtım; tur başında tek kart) |
| Mevcut animasyon | `flow/draw.ts`: yığın 1 azalır ve seker, üst kart bir izometrik hayalet olarak 11 px kalkar (oyuncu renginde parıltı, 6 kıvılcım, v2'de ışık), 20 ms sonra `HandView.addCard` dik bir `CardSprite` uçurur (yay 54 px, uçuşta dönerek açılır, el yeniden yelpazelenir, varışta "punch"). Rakibin kartı kapalı kalır ve mini ele küçülerek girer. |
| Ölçülen süre | 366 ms (`flowTurnP1`, `flowEndPhase`); açılışta 8 kart × 80 ms aralıkla |
| Zayıf / eksik | (1) İzometrik hayalet → dik kart geçişi kopuk: 1640 ms'de küçük izometrik kart, 1680 ms'de aynı yerde yarım boy dik kart sırtı belirir (`draw-zoom.png` #5 → #6). (2) Uçan kart döndürülüyor (yaslanma ≤ 0,32 rad) ve kesirli ölçekleniyor (0,5 → 1): döndürülmüş piksel sanatı testere kenarı. (3) Açılma flip'i 1840 ms'de düz beyaz bir şerit karesine dönüşüyor (#10–#11). Bütçe içinde, okunur bir yay var. |
| Ortak bileşen | `isoGhost` (`flow/_kit.ts`), `HandView.addCard`, `CardSprite.flyTo` / `flip` |
| Karta özgü kısım | yok (çekilen kart gizli olabilir; kart kancası yok) |
| v3 hedefi | Desteden kalkan kart tek nesne olarak sürer: izometrik → dik dönüş birkaç el çizimi ara kareyle (TileCard'ın 3B rasterı gibi her karede yeniden rasterlanan kart), tam sayı ölçek adımları, dönme yok ya da önceden çizilmiş eğik kareler. Süre 0,35–0,45 sn. |
| Öncelik | orta |

### 2.4 Tur başlangıcı (`turnStart`)

| Alan | |
|---|---|
| Olay / kart | `turnStart` |
| Mevcut animasyon | `flow/turn.ts`: sıcak koltukta önce perde (`ViewerPolicy.ensureViewer` → `Prompt.passDevice`), sonra aktif tarafın kenar ışıkları (`setActivePlayer`), düellocu kürsüsünden yayılan karo dalgası (`pulseSide`), dalga geçerken o oyuncunun canavarları parlar, düellocu "command" pozu, "OYUNCU n · TUR t" çapraz şeritli pankart oyuncunun tarafından süpürülür (`turnBanner`), HUD paneli ışıklanır, SIRA çipi kayar, tur sayısı döner. |
| Ölçülen süre | 1167 ms (`flowTurnP2`, `flowTurnP1`, `flowEndPhase`, `endTurnDraw` hepsinde aynı) |
| Zayıf / eksik | (1) Bütçenin ~2 katı (600 ms). (2) Pankart 100–1300 ms boyunca sahanın orta bandını (P2 canavar sırası dahil) örtüyor (`turn-zoom.png` #2–#13). (3) Harfler süpürmede tek tek seyrek beliriyor ("O Y U N C U   1" `turn-zoom.png` #3, #12); okunur hâl ~300 ms. (4) Karo dalgası ve canavar parlaması pankartın altında kalıyor. |
| Ortak bileşen | `turnBanner` / `sweepBanner` (`vfx/banners.ts`), `BoardView.pulseSide`, `HudView.setActive/setTurn`, `addGlow` |
| Karta özgü kısım | yok |
| v3 hedefi | ≤ 600 ms: pankart ekranın üst / kenar şeridinde (sahayı örtmeden) ya da çok kısa merkez darbesi; asıl bilgi sahanın kendisinde (aktif tarafın kenar neonunun yanması, düellocunun pozu). |
| Öncelik | yüksek |

### 2.5 Aşama geçişi (`phaseChange` çekme / ana / bitiş)

| Alan | |
|---|---|
| Olay / kart | `phaseChange` (draw, main, end) |
| Mevcut animasyon | `flow/turn.ts` + `HudView.setPhase`: üstteki aşama çubuğunda işaretçi "tırtıl" gibi uzayıp büzülerek kayar (öncü kenar Back.Out 200 ms, artçı 240 ms), hız çizgileri, varışta beyaz flaş + etiket zıplaması + kıvılcım; yeni turda işaretçi BİTİŞ'ten sola çıkıp soldan geri girer. Müzik yoğunluğu ayarlanır. |
| Ölçülen süre | bitiş 150, çekme 150, ana 200 ms (işleyici); çubuk animasyonu ~480 ms kuyrukla sürer (`phasebar-zoom.png`) |
| Zayıf / eksik | Kısa ve net, el işçiliği iyi (hazırlık–uzama–varış). Yalnızca işaretçi kuyruğu oyuncu kontrolü aldıktan sonra da sürüyor; sorun değil. Çubuk ekranın en üstünde, göz sahadayken fark edilmesi zor. |
| Ortak bileşen | `HudView.setPhase`, `streaks`, `arrivalSparks` |
| Karta özgü kısım | yok |
| v3 hedefi | Korunur; sakin arenada sahaya küçük bir yansıma (aktif aşamanın rengi kenar şeridinde) eklenebilir. |
| Öncelik | düşük |

### 2.6 Savaş Aşamasına geçiş (`phaseChange battle`)

| Alan | |
|---|---|
| Olay / kart | `phaseChange` (battle) |
| Mevcut animasyon | `flow/turn.ts`: müzik yükselir, "SAVAŞ AŞAMASI" kızıl şeritli pankart + ekran kenarlarında iki kırmızı darbe (`edgePulse`), düellocu "command", v2'de arena kararır; pankart çıkarken saldırı pozisyonundaki canavarlar sırayla kızıl parlar (980 ms'den sonra, 90 ms arayla). |
| Ölçülen süre | 1233 ms (`flowBattle.png`) |
| Zayıf / eksik | (1) Bütçenin 4 katı (300 ms). (2) Pankart 100–1100 ms sahanın ortasını örtüyor (`flowBattle.png` #1–#11). (3) İlk karelerde (#1–#3) tüm ekran kırmızı kenar vinyetiyle boyanıyor (HUD dahil). (4) "Saldırmaya hazır" parlaması tek kare beyaz-pembe silüet (whole-sprite tint), canavarın bedeninde hazırlık hareketi yok. |
| Ortak bileşen | `phaseBanner`, `edgePulse` (`vfx/banners.ts`), `addGlow`, `lightDimFor` |
| Karta özgü kısım | yok |
| v3 hedefi | ≤ 300 ms ana vuruş + sahada süren ipucu: aşama çubuğu kızıla döner, saldırabilecek canavarlar kısa bir "hazır" pozu / göz parlaması alır (karakter rigiyle), pankart ya hiç ya da üst şeritte. |
| Öncelik | yüksek |

### 2.7 Kurban (`tribute`, malzemenin ayrılışı)

| Alan | |
|---|---|
| Olay / kart | `tribute` (+ tükettiği `toGraveyard`, kuşanma kuralı `destroy`'ları) — her kurbanlı çağırma ve kurbanla kapalı koyma |
| Mevcut animasyon | `src/cinematics/summon-a/tribute.ts`: çağrılan kart elden kalkıp hedef karonun üstünde süzülür; her kurban beyaz parlar, hologram gibi titrer ve kendi piksellerinden bir şerit olarak yay çizip karta akar (`pixelStream`), kart her pikselle parlar, eski karo kartları yanarak söner, kartları mezarlığa uçar; kart son ışığı yutar (beyaz darbe), kısa bir kalkış (hazırlık) ve karoya çarpma; ardından imza çağırması (`ctx.play(summon, { tribute, noCard })`). Kapalı koymada akış oyuncu renginde ve doğrudan karoya. |
| Ölçülen süre | kurban kısmı 1067–1133 ms; kurbanla kapalı koyma kurban kısmı 433 ms (`suTributeSet.png`) |
| Zayıf / eksik | Hayalet kart yok: `field.release` + `forget` + Director'ın her olaydan sonra `views.sync` ile uzlaştırması, kurbanların karoları ve birimleri kayboluyor (`tributeWyrm.png` #8, `suTributeSet.png` #7–#17 boş karo). Zayıflık: kurbanın beyaz parlaması tam silüet beyazı (`suTributeSet.png` #1), beden tepki vermeden doğrudan piksellere ayrılıyor (karakter hareketi yok). Mezarlığa giden küçük kartlar kesirli ölçek + dönmeyle uçuyor. |
| Ortak bileşen | `pixelStream`, `tileStream`, `cardToGraveyard`, `takeHandCard`, `TileCard.slamIn` |
| Karta özgü kısım | çağrılan canavarın `tribute` kancası ve imza girişi (summon-a); `tributed` kancası tanımlı ama kullanılmıyor |
| v3 hedefi | Kurban önce kendi karakteriyle tepki verir (diz çökme / başını eğme, 2–3 poz), sonra ayrışma; ayrışma o canavarın malzemesine özgü (kristal kırık, alev söner, taş toz). Kart tek bir tam sayı ölçekte süzülür. |
| Öncelik | orta |

### 2.8 Kapalı canavar / büyü-tuzak koyma (`setMonster`, `setSpellTrap`)

| Alan | |
|---|---|
| Olay / kart | `setMonster`, `setSpellTrap` |
| Mevcut animasyon | `src/cinematics/summon-b/set.ts`: kart elden KAPALI uçar (`takeHandCard(…, null)` → kimliği yüklenmez), karoya yan (canavar) ya da dik (büyü/tuzak) çarpar (340 ms, darbe %74'te), oyuncu renginde bir elmas mühür karonun kenarına kapanır, yumuşak "set" sesi, toz, iki halkalı oyuncu darbesi, kart sırtında parlaklık süpürmesi. |
| Ölçülen süre | 767–784 ms (kart 240 ms'de yerde; geri kalanı mühür, darbe, parlaklık) — `smbSetMonster.png`, `smbSetP2.png` |
| Zayıf / eksik | (1) Bütçenin ~2 katı (400 ms). (2) Elden çıkan kart el boyunda, döndürülmüş ve kesirli ölçekli uçuyor (`smbSetMonster.png` #1, `smbSetP2.png` #1), sonra izometrik karoya dönüşüyor. (3) Kapalı kartlar sahada mor "göz" desenli karolara benziyor; boş bölge pedleriyle karışabiliyor (`piles-zoom.png`). |
| Ortak bileşen | `slamCard` (`summon-b/_kit.ts`), `TileCard.slamIn/dust/pulse/playSheen`, `setPulse` |
| Karta özgü kısım | yok (gizli; kart kancası bilerek yok) |
| v3 hedefi | ≤ 400 ms: kalkış → yay → yumuşak iniş; mühür ve parlaklık kuyrukta (girdiyi bekletmeden). Kart uçuşu tam sayı ölçek / dönmesiz. Kapalı kart sırtı sakin arenada boş bölgeden açıkça ayrılan bir siluet ve kenar ışığı. |
| Öncelik | orta |

### 2.9 Pozisyon değişimi (`positionChange`)

| Alan | |
|---|---|
| Olay / kart | `positionChange` |
| Mevcut animasyon | `src/cinematics/summon-b/position.ts`: saldırı → savunma: sprite ayaklarından ezilir (1,08 × 0,86), `guard` döngüsüne geçer, karo kartı 90° döner, önünde mavi altıgen kalkan (beyaz ilk kare, bal peteği, kademeli sönme). Savunma → saldırı: çömelme, uzayarak zıplama, kart dikleşir, `roar` zirvesinde kükreme sesi + oyuncu renginde halka + ATK/DEF rozeti zıplar. Kapalı canavarda yalnızca kart döner. |
| Ölçülen süre | saldırı → savunma 633 ms, savunma → saldırı 1117 ms (`smbPos.png`) |
| Zayıf / eksik | (1) Bütçe 400 ms; 1,6× ve 2,8×. (2) Geçişin taşıyıcısı bütün sprite'ın ölçeklenmesi (ezilme / uzama, `smbPos.png` #1–#2, #9–#10) — §4 "bütün sprite'ı ölçeklemek tek başına animasyon sayılmaz". `idle` → `guard` arasında ara poz yok: poz bir karede değişiyor. (3) Kalkan altıgeni canavarın önünde ama bedeni örtüyor (#3–#6). |
| Ortak bileşen | `squash/unsquash`, `hexGuard`, `TileCard.rotateTo`, `MonsterUnit.setPosition`, `roarPeak` |
| Karta özgü kısım | her canavarın `guard` ve `roar` animleri (canavar ajanları) |
| v3 hedefi | Karaktere özgü 3–5 karelik "savunmaya geçiş" ve "ayağa kalkış" pozları (sözleşmeye eklenecek isteğe bağlı pozlar); ölçekleme yalnızca ikincil. Süre ≤ 400 ms (kükreme kuyrukta). |
| Öncelik | orta |

### 2.10 Çevirme (`flip`: çevirerek çağırma / saldırıya uğrama)

| Alan | |
|---|---|
| Olay / kart | `flip` (cause `flipSummon` → eşli `summon` tüketilir; cause `attacked`) |
| Mevcut animasyon | `src/cinematics/summon-b/flip.ts`: kart oyuncu renginde titrer (150 ms hazırlık), zıplayıp döner (TileCard 3B, 360 ms), element patlaması (`flipBurst`) + v2 ışığı, canavar "kartın içinden fırlar" (ezilme → uzama → oturma ölçekleri + hızlı hologram), kükreme zirvesinde şok halkası + rozet. Saldırıya uğramada daha kısa, doğrudan `guard`. Dikenli Pusucu'da önce sarmaşık kafes yerden çıkar; summon-b'nin altı canavarına küçük vurgular (yaprak, taş, parıltı, gölge, şimşek). |
| Ölçülen süre | çevirerek çağırma 1033 ms; saldırıya uğrama 583 ms (`setAndFlip.png`, `smbFlipAttacked.png`) |
| Zayıf / eksik | (1) Çevirerek çağırma bütçenin 1,7 katı. (2) "Fırlama" yine bütün sprite ölçeği + `materialize`; beden ve uzuvlar ayrı hareket etmiyor. (3) Altın ışık sütunu (`setAndFlip.png` #14–#16) normal çağırmanın diliyle aynı — çevirme ile çağırma ayırt edilmiyor. Saldırıya uğramada kısa ve okunur. |
| Ortak bileşen | `flipBurst`, `materialize`, `popOut`, `roar`, `TileCard.flipUp/rotateTo` |
| Karta özgü kısım | `accent()` (summon-b'nin altı canavarı), Dikenli Pusucu `vineCage`; diğer altı canavar yalnızca element patlaması |
| v3 hedefi | ≤ 600 ms; kartın dönmesi + canavarın karaktere özgü "pusudan çıkış" pozu (sözleşmedeki yeni isteğe bağlı poz); çağırmadan farklı, daha ani bir dil. |
| Öncelik | orta |

### 2.11 Elden kart oynama (çağırma / büyü / koyma için ortak kısım)

| Alan | |
|---|---|
| Olay / kart | `summon` / `activate` / `set*` başlangıcı — kartın elden ayrılması |
| Mevcut animasyon | `fx.takeHandCard` (izleyicinin elindeki gerçek `CardSprite`, rakipte mini elde kapalı yeni kart), `fx.slamToZone` / `TileCard.slamIn` (yay, yana bükülme, darbe %74'te, ezilme, karo flaşı) ya da büyüde `spellShowcase` (kart ortaya 2× büyüyerek çıkar). |
| Ölçülen süre | kart ~250 ms'de karoya iner (`play-from-hand.png`) |
| Zayıf / eksik | Hızlı ve okunur. Ancak dik kart döndürülerek (yaslanma) ve kesirli küçültülerek uçuyor (`play-from-hand.png` #1–#3); büyü vitrini kartı kesirli 2× büyütüyor. |
| Ortak bileşen | `takeHandCard`, `slamToZone`, `CardSprite.flyTo`, `TileCard.slamIn`, `spellShowcase` |
| Karta özgü kısım | ardından gelen imza girişleri (canavar / büyü ajanları) |
| v3 hedefi | Dik kart → izometrik karo dönüşümü TileCard'ın rasterlayıcısıyla tek nesnede; ölçek adımları 1× / 2×; bütün kart uçuşları için ortak bir "kart yolculuğu" yardımcısı. |
| Öncelik | orta |

### 2.12 Hedef seçme (insan girdisi, vurgular)

| Alan | |
|---|---|
| Olay / kart | `HumanInput.pickZone` / `pickTributes` / `pickOne`; motorun `decision chooseTarget` olayı |
| Mevcut animasyon | `src/duel/HumanInput.ts`: aday bölgeler altın çerçeveyle yanar, imlecin altındaki beyaz olur (+ hover sesi), üstte talimat çubuğu ("Yıldırım Hükmü: yok edilecek rakip canavarı seç · İPTAL"), altta ipucu satırı; saldıran canavarın karosu altın. Kurban seçiminde seçilen karolar beyaz. `decision chooseTarget` olayında adaylar oyuncu renginde bir kez nabız atar (`_defaults/flow.ts`, 450 ms). |
| Ölçülen süre | anlık (tepki < 1 kare); `decision chooseTarget` 450 ms |
| Zayıf / eksik | Çalışıyor ve açık (`ui/ui-hand-target.png` #8, `ui/ui-battle-pick.png` #2–#3). Zayıflık: vurgu yalnızca karo çerçevesi; hedef canavarın kendisinde kilit / nişan yok (bölgeyi değil canavarı seçtiğini söyleyen görsel yok). Talimat çubuğu ve ipucu satırı aynı şeyi iki kez söylüyor. |
| Ortak bileşen | `BoardView.highlightZone/clearHighlights`, `Prompt.instruction`, `HudView.setHint` |
| Karta özgü kısım | yok |
| v3 hedefi | Aday canavarların üzerinde küçük, nefes alan nişan köşeleri (`lockOn` dilinin hafif sürümü), imleç altındakinde kilitlenme; tek talimat satırı. |
| Öncelik | orta |

### 2.13 Geçersiz hedef geri bildirimi

| Alan | |
|---|---|
| Olay / kart | seçim sırasında aday olmayan yere tıklama; boşta yanlış nesneye tıklama |
| Mevcut animasyon | Var ama yalnızca metin + ses: `uiError` sesi ve ipucu satırında `flashHint` ("Parlayan alanlardan birine tıkla", "Önce saldıracak kendi canavarına tıkla", "Kapalı canavar saldıramaz (Ana Aşamada çevirebilirsin)" …). Menüde pasif satırlar sebebini balonla açıklar. |
| Ölçülen süre | metin 1200–2600 ms görünür |
| Zayıf / eksik | Tıklanan yerde hiçbir görsel tepki yok (`ui/ui-hand-target.png` #9–#10, `ui/ui-battle-pick.png` #4–#6): karo sallanmıyor, kırmızı çarpı / "olmaz" işareti yok. Metin ekranın altında; göz tıklanan yerde. +150 ms'de ipucu satırı bir an boş görünüyor (#9). Açıklama metinleri ise iyi ve Türkçe. |
| Ortak bileşen | `HudView.flashHint`, `sfx uiError` |
| Karta özgü kısım | yok |
| v3 hedefi | Tıklanan karoda 2–3 karelik kırmızı "ret" darbesi + küçük yatay sarsıntı (karo / kart), seçili saldıranın "hayır" başı sallaması; metin korunur. |
| Öncelik | yüksek (plan A6 "geçersiz hedef" istiyor) |

### 2.14 Saldırı ilanı (`attackDeclare`)

| Alan | |
|---|---|
| Olay / kart | `attackDeclare` (saldıranın `attackDeclare` kancası olabilir; yok) |
| Mevcut animasyon | `src/cinematics/battle/declare.ts`: kamera iki canavarın arasına 1,05 yakınlaşır, düellocu "command", saldıran kendi tarafına 2 px çekilip ezilir (0,93 / 1,05), oyuncu renginde parlama, yerde halka ve yükselen zerreler; ok yay çizerek hedefe uzanır, hedefte dönen köşeli nişan; hedef savunmadaysa altıgen parıltı, saldırıdaysa 1,5 px irkilme, doğrudan saldırıda karşı düellocu sarsılır. Ok + nişan + gerilmiş poz bir "AttackHold" olarak tuzak kararı boyunca tutulur (saldıran 90 ms'lik adımla titrer). |
| Ölçülen süre | 550 ms |
| Zayıf / eksik | Okunur ve hızlı (`atkTargetDestroyed.png` #1–#5, `atkDirectHawk.png` #2–#6). Zayıflıklar: hazırlık yine bütün sprite'ın kayması + ezilmesi (rig pozu yok); titreme yarım piksellik x kayması (`s.x = coilXY.x ± 0,5`) — kesirli konum; kamera yakınlaşması kesirli. |
| Ortak bileşen | `attackArrow`, `lockOn`, `blockClang` (`vfx/combat.ts`), `floorRing`, `hexGlint`, `AttackHold` (`battle/_kit.ts`) |
| Karta özgü kısım | yok (her saldıranda aynı) |
| v3 hedefi | Saldıranın karaktere özgü "hazırlan" pozu (anim sözleşmesine eklenecek `ready` / attack'ın ilk kareleri bekletilerek), tam sayı konumlar, kamera yalnızca kaydırma. |
| Öncelik | orta |

### 2.15 Karar ve "Geç" (`decision`, `responseDeclined`) + tuzak sorusu

| Alan | |
|---|---|
| Olay / kart | `decision` (trapResponse / chooseTarget / discard), `responseDeclined` |
| Mevcut animasyon | `battle/declare.ts`: savunanın bütün kapalı büyü/tuzak kartları macenta nefes alır (seçenek olmayanlar dahil), sıra boyunca macenta halkalar; "Geç" kartların üstünde küçük, ezilip açılan yazı. İnsan savunanda `Prompt.trapResponse`: "TUZAK FIRSATI" paneli, seçenek kartları, AÇ / GEÇ (1–9, Enter, Esc). Sıcak koltukta savunana perde ("SIRA DEĞİŞİYOR · OYUNCU 2'NİN SIRASI · Hazır olunca tıkla") ve karar sonrası saldırana tekrar perde. |
| Ölçülen süre | `decision` 317 ms, `responseDeclined` 316 ms; panel 300 ms'de kayar, kart açılması ~600 ms'de |
| Zayıf / eksik | (1) Tuzak sorusunda kart ilk ~600 ms kapalı / kenardan görünüyor (`ui/ui-trap-prompt.png` #1–#2): oyuncu hangi tuzağı açacağını hemen göremiyor. (2) Panel bütün sahayı karartıyor: karar verirken saldırı (ok, hedef) görünmüyor. (3) Sıcak koltukta tuzak penceresi için de "SIRA DEĞİŞİYOR / OYUNCU 2'NİN SIRASI" yazıyor (`ui/ui-hotseat-trap.png` #4–#9) — sıra değişmiyor, yanlış ifade; perdeye ilk tıklama giriş animasyonu sırasında yutuluyor (#5). (4) Gizli bilgi: pencerenin açılması ve "Geç" yazısı, savunanda uygun bir tuzak olduğunu ele veriyor (motorun pencere tasarımından gelen sızıntı; vsBot'ta bilgisayar her seferinde 380 ms "düşünüp" "Geç" diyor). |
| Ortak bileşen | `setCardPulse` (`battle/_kit.ts`), `Prompt.trapResponse`, `Prompt.passDevice`, `floorRing` |
| Karta özgü kısım | yok |
| v3 hedefi | Tuzak kartı panelde ilk karede açık; panel sahanın bir kenarında, saldırı görünür kalır. Tuzak penceresinin perdesi "Oyuncu 2: tepki zamanı" gibi ayrı bir başlıkla. Gizli bilgi için (tasarım kararı gerekir): tuzak olmasa da kapalı kartı olan her savunana kısa bir pencere / sahte bekleme seçeneği. |
| Öncelik | orta |

### 2.16 Saldırının geçersiz kılınması (`attackNegated`)

| Alan | |
|---|---|
| Olay / kart | `attackNegated` (`negate` kancası: Işık Zincirleri `traps/chains_of_light.ts` saldıranı zaten bağladıysa yalnızca "SAVAŞ BİTTİ" + günlük satırı, değilse genel sürüm) |
| Mevcut animasyon | `battle/declare.ts` genel sürüm: ok yayı boyunca kırılır, nişan patlar, saldıran 60 ms'de bırakılır, macenta "çın" + ışık, `hit` animi, 4 px geri itilip Back.Out ile döner, kamera açılır, "SAVAŞ BİTTİ" (trap stili harf harf çarpma). |
| Ölçülen süre | 917 ms (`trapChains`: Işık Zincirleri `negate` kancası, yalnızca pankart) |
| Zayıf / eksik | "SAVAŞ BİTTİ" bandı iki kez tam genişlikte düz beyaz kare (`trapChains.png` #25, #28) ve sahayı örtüyor; "TUZAK!" ile birlikte bu tek tuzakta ~2,5 sn pankart. Geri itme bütün sprite'ın kayması. |
| Ortak bileşen | `blockClang`, `banner('trap')`, `takeAttack` / `AttackHold.shatterMarks` |
| Karta özgü kısım | Işık Zincirleri'nin bağlama sahnesi ve `negate` kancası (tuzak ajanı) |
| v3 hedefi | Engelleme saldıranın bedeninde okunur (çekilme / sendeleme pozu); "SAVAŞ BİTTİ" kısa ve aşama çubuğuna bağlı. |
| Öncelik | orta |

### 2.17 Varsayılan savaş sunumu (`battle`)

| Alan | |
|---|---|
| Olay / kart | `battle` (12 canavarın hepsinde `registerStrike` var; çerçeve ortak) |
| Mevcut animasyon | `src/cinematics/battle/battle.ts`: kamera çarpışmaya 1,05–1,065 yaklaşır, v2'de arena kararır; vuruş (`strikeFor` ya da `genericStrike`) `impact()` çağırınca: darbe karesinde 70 ms kamera "punch" (1,08'e kadar), yer ışığı, hedefin tepkisi (saldırıda `hitReact`: kıvılcım + beyaz silüet + `hit` + hit-stop; savunmada `guardReact`: altıgen + 2–3 px geri itme; engellemede "çın" ve saldıranın flaşı), hasar sayısı temas noktasının üstünde, yok etme +110 ms (savunmada +130–190 ms); sonra canavar etkileri (`playBattleTriggers`) aynı kamera odağında. |
| Ölçülen süre | ilan → girdi: hedefi yok etme 3850, engelleme 3400, doğrudan 3233, tuzak reddi + doğrudan 3433, açılan kapalı canavara çarpma 3000 ms; iki tarafın da yok olduğu + iki tetik 6250 ms |
| Zayıf / eksik | (1) Bütçenin ~1,6–2 katı. (2) Kesirli kamera yakınlaşması ve darbe "punch"ı her saldırıda piksel ızgarasını bozuyor (`atkTargetDestroyed.png` #12–#14). (3) Doğrudan saldırıda bütün ekran (HUD dahil) kırmızı vinyetle boyanıyor (`atkDirectHawk.png` #20–#21, `trapDecline.png` #17–#20) — §3 "aynı anda bütün ekran parlamaz". (4) Hedefin tepkisi bütün sprite'ın beyaz silüeti + geri itilmesi; temas bölgesinden yayılan tepki yok (bu kısım canavar ajanlarının `hit` animi). İyi yanı: hasar sayısı temasla eşzamanlı, tetikler ölü boşluk bırakmadan oynuyor. |
| Ortak bileşen | `battle/battle.ts`, `fx.hitReact`, `guardReact`, `blockClang`, `directHit`, `whiteFlash`, `impactLight`, `playBattleTriggers` |
| Karta özgü kısım | vuruş hareketi (`registerStrike`, strikes-a/b), ölüm (`destroyed` kancaları), etkiler |
| v3 hedefi | Tam sayı kamera (büyük anlarda 2× kesme ya da yalnızca kaydırma); doğrudan darbede yalnızca savunan tarafın kenarı / düellocu çevresi kızarır; toplam 1,6–2,2 sn içinde kalmak için ilan + vuruş + sonuç arası boşluklar kısalır. |
| Öncelik | yüksek |

### 2.18 Hasar sayısı ve LP değişimi (`damage`)

| Alan | |
|---|---|
| Olay / kart | `damage` (`damage` kancası kaynağa göre; etki hasarında teslimat `burnFly` vb.) |
| Mevcut animasyon | `battle/damage.ts` + `vfx/numbers.ts` + `HudView.setLp`: kalın, konturlu kendi piksel rakamları; ilk 50 ms beyaz flaş, harf harf (28 ms) taşma ile büyüyüp oturma, sarsıntı, yükselip 1,25 sn'de söner; ≥ 1000 hasarda 2× tam sayı ölçek. Sayıdan LP paneline kızıl kıvılcımlar akar; 120 ms sonra panel kırmızı flaş + sarsıntı, "−N" çipi, LP tık sesleriyle akar (Cubic.Out), çubukta beyaz → kızıl "hayalet" geç süzülür; düellocu "hurt" + sarsılma. Etki hasarı teslimatsızsa varsayılan ateş topu. |
| Ölçülen süre | temas → ilk rakam ~40–80 ms; LP akışı 500 hasarda ~480 ms, 1700 hasarda ~800 ms, en fazla 1100 ms (`atkTD-hud.png`, `atkBlocked.png` #20–#28) |
| Zayıf / eksik | (1) Büyük hasarda LP akışı bütçenin (~400 ms) 2 katı. (2) Aynı bilgi üç kez: sahadaki "−500", paneldeki "−500" çipi ve akan LP; çip panelin oyuncu numarası rozetinin üstüne biniyor (`atkTD-hud.png` #4–#11). (3) Panel flaşı tüm paneli pembe tek renge boyuyor (#3). (4) Saldıran kaybedince sayı düellocunun başında, sahadan uzak (`atkBlocked.png` #20). Rakamlar tam sayı ölçekli ve okunur — iyi. |
| Ortak bileşen | `damageNumber`, `HudView.setLp/shake/chip`, `presentDamage` (`_core/helpers.ts`) |
| Karta özgü kısım | etki hasarı teslimatları (Magma Titanı ateş topu, Kor Kurdu ruhu, Şimşek Kertenkelesi şimşeği, Gelgit Golemi su) |
| v3 hedefi | LP akışı ~400 ms sabit tavan; panel çipi ya kaldırılır ya da rozetle çakışmayan yere; panel flaşı kenar çizgisinde. |
| Öncelik | orta |

### 2.19 LP kazancı (`lpGain`)

| Alan | |
|---|---|
| Olay / kart | `lpGain` (`lpGain` kancası kaynağa göre) |
| Mevcut animasyon | `battle/damage.ts` (düellocu "command") → `_defaults/battle.ts`: teslimat yoksa `healFly` (yeşil-altın parıltılar panele akar), sonra `presentHeal`: yeşil "+N", panel yeşil parlama, yükselen parıltılar, LP yukarı akar. |
| Ölçülen süre | Işık Perisi 684 ms, Şifa Pınarı 850 ms (`lumenGain.png`) |
| Zayıf / eksik | Bütçenin 1,7–2 katı. "+500" sayısı panelin solunda, panelin dışında (#16–#23); panel tüm yüzeyiyle yeşile boyanıyor (#14–#15). |
| Ortak bileşen | `healFly`, `presentHeal`, `damageNumber('heal')`, `HudView.setLp` |
| Karta özgü kısım | Işık Perisi parıltıları, Şifa Pınarı damlaları (büyü / canavar ajanları) |
| v3 hedefi | ~400 ms akış, teslimat ile panelin varışı tek vuruş. |
| Öncelik | düşük |

### 2.20 İstatistik değişimi (`statChange`, rozetler)

| Alan | |
|---|---|
| Olay / kart | `statChange` (ardışık olanlar gruplanır) |
| Mevcut animasyon | `src/cinematics/flow/stats.ts`: artışta yeşil parlama + gövdeden yükselen ▲ çubukları, azalmada 120 ms sonra kademeli kızıl boyama + düşen ▼; `StatBadge` değeri akar ve zıplar; tek değişimde baş üstünde `statPop` (rakam akar → yeşil / kızıl pop, "+700", oklar), çoklu değişimde yalnızca fark sayısı. Volkan auraları senkron. |
| Ölçülen süre | artış 500 ms, azalış 766 ms (`flowStatUp.png`) |
| Zayıf / eksik | Okunur. Zayıflık: başlangıçta canavar tamamen beyaz silüete dönüyor (`flowStatUp.png` #17, kılıcın inişiyle) ve rozet ile baş üstü sayısı aynı değeri iki yerde gösteriyor. Rozet rakamları küçük (4 px). |
| Ortak bileşen | `chevronTexture`, `statPop`, `StatBadge`, `addGlow` |
| Karta özgü kısım | Ejder Kılıcı / Volkan Arenası sahneleri (büyü ajanı) |
| v3 hedefi | Gövdede güç ışığı ikincil hareketle (karakterin kısa "güç aldı" pozu); tek sayı. |
| Öncelik | düşük |

### 2.21 Yok edilme → mezarlık (`destroy`, `toGraveyard`)

| Alan | |
|---|---|
| Olay / kart | `destroy` (+ aynı kartın `toGraveyard`'ı tüketilir), tek başına `toGraveyard` |
| Mevcut animasyon | `_defaults/battle.ts`: canavar `shatterUnit` (beyaz flaş + `hit` + kendi piksellerine dağılma) ya da kart kancasının ölümü; karo kartı 220 ms sonra yanarak söner; büyü/tuzak önce açılır, beyaz darbe, yanar; sonra `cardToGraveyard`: 0,42 ölçekli küçük kart yeniden yaratılır, iz bırakarak 34 px yayla (380 ms) mezarlığa uçar, varışta yığın sayısı + üst kart güncellenir, yığın seker, kıvılcım, kart 120 ms'de söner. |
| Ölçülen süre | Uçurum Büyücüsü: `destroy` 1417 ms'de başlar, ölüm ~2,6 sn'de biter, kart 2,96 sn'de BELİRİR, ~3,35 sn'de varır (`atkTD-zoom.png` #18–#23) |
| Zayıf / eksik | (1) Süreklilik yok: canavar söndükten ~300 ms sonra kart boşluktan tam boyda "pat" diye çıkıyor (#20 → #21); plan §4 "ölüm … kartın doğru bölgeye gidişiyle süreklidir" kuralına aykırı. (2) Uçan kart döndürülüyor ve kesirli küçülüyor (0,42 → 0,26). (3) Mezarlık yığınının tepesi çok küçük izometrik kart; yeni gelen kartın kimliği yığında okunmuyor (`piles-zoom.png`). Hayalet kart yok: `field.release` + `forget` + `sync`. |
| Ortak bileşen | `shatterUnit`, `cardToGraveyard`, `tileToGraveyard`, `TileCard.dissolve`, `PileView.set/bump` |
| Karta özgü kısım | `destroyed` / `destroys` kancaları (karakter ölümleri, Yer Yarığı) |
| v3 hedefi | Ölümün son karesinden kart doğar (örn. dağılan pikseller karonun üstünde kartta toplanır), kart karodan kalkıp yığına iner ve yığın bir kat yükselir; tek nesne, tam sayı ölçek. |
| Öncelik | yüksek |

### 2.22 Elden atma (`discard`)

| Alan | |
|---|---|
| Olay / kart | `discard` (+ `toGraveyard from hand` tüketilir; ardışık atmalar 190 ms arayla) |
| Mevcut animasyon | `src/cinematics/flow/discard.ts`: kart elden 24 px kalkar (gizli eldeyse mini elden çıkıp açılır — atma herkese açık), titreyip alt kenarından tutuşur (turuncu flaş), alttan yukarı yanarken kendi pikselleri yay çizerek mezarlığa akar (`emberStream`), ilk közler varınca yığın güncellenir, oyuncu renginde flaş + kıvılcım. |
| Ölçülen süre | 1 kart 983 ms, 2 kart 1167 ms (`flowDiscard.png`, `flowDiscardP2.png`) |
| Zayıf / eksik | Güzel ve süreklilikli (kartın pikselleri mezarlığa gidiyor — 2.21'in hedefine örnek). Zayıflık: P2'de közler bütün sahayı çapraz geçiyor ve yeni turun pankartıyla çakışıyor (`flowDiscardP2.png` #16–#17); seçim sırasında atılacak kart yalnızca 9–14 px kalkıyor. |
| Ortak bileşen | `emberStream`, `burnAway`, `takeCard`, `PileView` |
| Karta özgü kısım | yok |
| v3 hedefi | Korunur; süre ~800 ms, sonraki olay közler inince başlar. |
| Öncelik | düşük |

### 2.23 Deste bitmesi (`deckOut`)

| Alan | |
|---|---|
| Olay / kart | `deckOut` |
| Mevcut animasyon | `src/cinematics/flow/end.ts`: kamera boş desteye 1,07 yaklaşır, düellocu elini uzatır, desteden bir kart oluşmaya çalışır ama kızıl parazitle yırtılır ve dağılır, karo üç kez kızıl yanar, yanıp sönen "0", düellocu irkilir, "DESTE BİTTİ!" kızıl büyük pankart. |
| Ölçülen süre | 2650 ms (`flowDeckOut.png`) |
| Zayıf / eksik | Asıl olay (destede kart oluşamaması) P2 destesi için ekranın en tepesinde, ~10 px boyunda ve 400 ms sürüyor (#3–#5); pankart 1,6 sn boyunca ekranın ortasını kaplıyor ve ilk karesi tam genişlik düz pembe bant (#9). Kesirli kamera. |
| Ortak bileşen | `banner('big')`, `BoardView.flashTile`, `Sparks` |
| Karta özgü kısım | yok |
| v3 hedefi | Tam sayı 2× yakın çekimle destenin boşluğu okunur; pankart daha kısa. |
| Öncelik | düşük |

### 2.24 Oyun sonu (`gameOver`: zafer / yenilgi)

| Alan | |
|---|---|
| Olay / kart | `gameOver` (bitirici darbe gözlemcisi: `flow/turn.ts` `registerObserver` — LP 0'a inen hasarda 0,35 ağır çekim, müzik kesilir) |
| Mevcut animasyon | `flow/end.ts`: kaybedenin tarafı kararır, hologramları sırayla `glitch` + `dematerialize` ile çöker, kaybeden diz çöker; kamera kazanana 1,07 döner, altın ışın kürsüye iner, kazanan yumruk kaldırır, saldırıdaki canavarları kükrer; zafer müziği ve "KAZANAN: OYUNCU n" altın pankart + havai fişekler; ardından "TEKRAR OYNA / ANA MENÜ" istemi. |
| Ölçülen süre | 3450–3483 ms; bitirici darbe ilan → gameOver 3650 ms (`flowLethal.png`, `flowSurrender.png`) |
| Zayıf / eksik | (1) Çöküş bütün canavarlar için aynı (glitch blokları + dağılma, `flowSurrender.png` #1–#4) — karaktere özgü ölüm yok. (2) Düellocular ~20 px; diz çökme / yumruk pozları 1× okunmuyor (#5–#6). (3) Pankart girişinde tam genişlik düz sarı bant karesi (`flowLethal.png` #17, `flowSurrender.png` #7); sonra ekran tamamen pankart + fişek; saha görünmez. (4) Teslim olmada sebep pankartta yok. Süre bütçe içinde. |
| Ortak bileşen | `collapse` (`glitch`, `dematerialize`), `beamDrop`, `victory` (`vfx/banners.ts`), `Prompt.gameOver` |
| Karta özgü kısım | yok (kart kancası yok; `destroyed` ölümleri burada kullanılmıyor) |
| v3 hedefi | Kaybedenin canavarları kendi ölüm animleriyle (A4'te çizilecek karakter ölümleri) sırayla düşer; kazanan canavar(lar) imza kükremesi; düellocular yakın çekimle okunur; sebep satırı ("Deste bitti", "Teslim oldu"). |
| Öncelik | orta |

### 2.25 El: üzerine gelme ve seçme (`HandView`)

| Alan | |
|---|---|
| Olay / kart | el kartı hover / tıklama / klavye 1–9; oynanabilir kart vurgusu |
| Mevcut animasyon | `src/view/HandView.ts`: geniş yayda yelpaze (dış kartlar ≤ 7 px iner, kart başına ≤ 0,05 rad dönme); üzerine gelinen kart düzleşir, 14 + 6 px yükselir (Back.Out 150 ms), komşular 13 px açılır; hover sesi; oynanabilir kartlar oyuncu renginde noktalı çerçeve, seçili kart altın; tıklamada 0,1'lik "punch"; mini elde rakip kart sayısı (kapalı küçük kartlar). |
| Ölçülen süre | yükselme 150 ms, komşular 220 ms |
| Zayıf / eksik | (1) Yelpazedeki kartlar döndürülmüş piksel sanatı: kenarlarda basamaklı testere, iç piksellerde bozulma (`hand-zoom.png`). (2) Menü açılınca menü kutusu ipucu satırının üstüne biniyor ("…apacağını seç · Esc: vazgeç" kesik, `ui/ui-hand-target.png` #6–#7; `ui/ui-inspect-grave.png` #12). Hover tepkisi hızlı ve canlı. |
| Ortak bileşen | `HandView`, `CardSprite.hoverLift/punch/setHighlight`, `ActionMenu` |
| Karta özgü kısım | yok |
| v3 hedefi | Dönmesiz yelpaze (yalnızca y dalgası + üst üste binme) ya da önceden çizilmiş eğik kart kareleri; menü ipucu satırıyla çakışmayan sabit yerde. |
| Öncelik | yüksek (piksel dili) |

### 2.26 InspectPanel

| Alan | |
|---|---|
| Olay / kart | sahada / elde / mezarlıkta üzerine gelme; menü açıkken sabitleme |
| Mevcut animasyon | `src/view/InspectPanel.ts` (v1): sol üstte 2× kart, aura, süzülen zerreler; panel kayarak girer (260 ms Back.Out), kart dönerek açılır, metin harf harf yazılır; kart değişince kart kenarından döner (70 + 140 ms), istatistikler yeniden akar. Kapalı kart için "Kapalı Kart · Gizli". |
| Ölçülen süre | ilk hover'da kart ~300 ms sonra hâlâ kenardan görünüyor; isim ve resim ~300 ms tutarsız |
| Zayıf / eksik | (1) Hızlı tarama sırasında geride kalıyor: Kor Kurdu'nun üzerindeyken panel 60 ms boyunca "Yıldırım Hükmü" yazıyor ve resim yok (`ui/ui-hand-target.png` #4); resim Yıldırım Hükmü iken isim Kor Kurdu (#6); resim Magma Titanı iken isim Yıldırım Hükmü (#8). (2) İlk girişte kart 300 ms boyunca kenardan ince beyaz çizgi (#3; `ui/ui-inspect-grave.png` #2). (3) Desteye / rakibin mini eline gelince hiçbir şey yok (sayı ipucu yok, #7–#8). Gizlilik doğru (bkz. bölüm 4). |
| Ortak bileşen | `InspectPanel` (v1 / v2), `CardSprite` |
| Karta özgü kısım | yok |
| v3 hedefi | İsim + resim aynı karede değişir (dönme ≤ 120 ms ya da anlık kesme + küçük parlama); desteye / mini ele gelince sayı balonu. |
| Öncelik | orta |

### 2.27 Deste ve mezarlık yığınları (`PileView`)

| Alan | |
|---|---|
| Olay / kart | yığın sayısı, üst kart, kart varış / ayrılış |
| Mevcut animasyon | `src/duel/PileView.ts`: her ~2 kart için 1 px'lik izometrik katman (en çok 9), üst katman kart sırtı (deste) ya da son kartın yüzü (mezarlık), alt katmanlar karartılmış kenar; karonun ön köşesinde küçük sayı etiketi (destede ≤ 3 kızıl); `bump()` 1 px seker, `flash()` 90 ms renk. |
| Ölçülen süre | `set()` anlık (bütün katmanlar yok edilip yeniden kuruluyor) |
| Zayıf / eksik | Yığın yüksekliği değişimi animasyonsuz (katman bir karede eklenir / silinir); 6 kartlık mezarlık 3 px yüksekliğinde, üst kart ~16 px'lik izometrik resim — hangi kart olduğu sahadan okunmuyor (`piles-zoom.png`). Sayı etiketi 4 px rakam. |
| Ortak bileşen | `PileView` |
| Karta özgü kısım | yok |
| v3 hedefi | Varışta yeni katman kayarak oturur; mezarlığın üst kartı okunur boyutta (ya da yığının yanında küçük dik kart); deste azaldıkça yığın inceldiği görülür. |
| Öncelik | orta |

### 2.28 Mezarlık inceleme paneli (tıklama)

| Alan | |
|---|---|
| Olay / kart | mezarlığa tıklama (plan A6: "mezarlığı tıklayınca inceleme paneli (yoksa eklenir)") |
| Mevcut animasyon | **Yok.** `HumanInput` boşta yalnızca `monster` / `spellTrap` / `field` tıklamalarını işliyor; `graveyard` tıklaması hiçbir şey yapmıyor. Üzerine gelince InspectPanel yalnızca ÜST kartı gösteriyor. `CardPicker` (`src/duel/CardPicker.ts`) var ama yalnızca Ruh Çağrısı hedeflemesinde açılıyor (karartılmış ekran, yelpaze, "SENİN / RAKİBİN" alt yazısı, İPTAL / Esc). |
| Ölçülen süre | — |
| Zayıf / eksik | Kendi / rakip mezarlığına tıklama: mod `idle`, ekranda değişiklik yok (`ui/ui-inspect-grave.png` #5–#6). Mezarlıktaki diğer kartlar hiçbir yoldan görülemiyor (Ruh Çağrısı oynamadan). |
| Ortak bileşen | `CardPicker` (salt-okunur sürümü yapılabilir), `InspectPanel` |
| Karta özgü kısım | yok |
| v3 hedefi | Mezarlığa tıklayınca (ve klavyeyle) yığından yelpazeyle açılan, kaydırılabilir salt-okunur panel: kartlar yığından kalkıp açılır, üzerine gelince InspectPanel; Esc / sağ tık kapatır, kartlar yığına geri iner. Her iki oyuncunun mezarlığı açık bilgidir. |
| Öncelik | yüksek |

### 2.29 Ruh Çağrısı kart seçicisi (`CardPicker`)

| Alan | |
|---|---|
| Olay / kart | `soul_recall` hedefi (mezarlıktan canavar) |
| Mevcut animasyon | `src/duel/CardPicker.ts`: ekran %70 kararır, kartlar sırayla (50 ms) Back.Out ile gelir, üzerine gelince kalkar + altın çerçeve + alt satırda isim / ATK / DEF, 1–9, İPTAL. |
| Ölçülen süre | açılış ~220 + 50·n ms |
| Zayıf / eksik | Kartlar mezarlıkla bağsız: ekranın ortasında beliriyor, hangi yığından geldiği yalnızca "SENİN / RAKİBİN" yazısında (`ui/ui-inspect-grave.png` #9–#10). |
| Ortak bileşen | `CardPicker`, `CardSprite` |
| Karta özgü kısım | yok |
| v3 hedefi | Kartlar kendi mezarlık yığınlarından kalkıp yelpazeye uçar; mezarlık inceleme paneliyle aynı bileşen. |
| Öncelik | düşük |

### 2.30 Sıcak koltuk perdesi (`Prompt.passDevice`)

| Alan | |
|---|---|
| Olay / kart | tur değişimi ve tuzak penceresinde cihazın el değiştirmesi |
| Mevcut animasyon | `src/view/Prompt.ts`: oyuncu renginde çapraz şeritli tam ekran perde silmeyle gelir, letterbox çubukları, kayan eğik çizgiler, ortada "SIRA DEĞİŞİYOR · OYUNCU n'NİN SIRASI · Hazır olunca tıkla", dev hayalet numara; perde altındayken el değiştirilir (`HandView.setOwner`: eski el dalga hâlinde düşer, yenisi yükselir), sonra eli yüzü açık dalgayla çevrilir. |
| Ölçülen süre | kullanıcı bekler; giriş ~600 ms |
| Zayıf / eksik | Gizlilik doğru. Zayıflık: tuzak penceresi için de "SIRA DEĞİŞİYOR" (2.15); giriş animasyonu sırasında tıklama yutuluyor (`ui/ui-hotseat-trap.png` #5). |
| Ortak bileşen | `Prompt.passDevice`, `ViewerPolicy.ensureViewer`, `HandView.setOwner/setFaceDown` |
| Karta özgü kısım | yok |
| v3 hedefi | Başlık bağlama göre ("Oyuncu 2: tepki"), giriş sırasında da tıklama kabul edilir (girişi tamamlar). |
| Öncelik | düşük |

---

## 3. Ortak (kesişen) sorunlar

1. **Kesirli kamera yakınlaşması.** `ctx.focus` 1,04–1,08 değerleriyle: saldırı ilanı (1,05), savaş (1,05 / 1,065, darbe karesinde 1,08'e "punch"), açılışta para (1,06), deste bitmesi (1,07), oyun sonu (1,07), büyük çağırmalar (1,05). Plan §3 bunu yasaklıyor; kanıt `atkTargetDestroyed.png` #12–#14. Akış dosyalarındaki çağrılar: `flow/opening.ts` (coinToss), `flow/end.ts` (deckOut, gameOver), `battle/declare.ts`, `battle/battle.ts`.
2. **Kart sprite'ları döndürülüp kesirli ölçekleniyor.** `HandView` yelpazesi (≤ 0,05 rad), `CardSprite.flyTo` yaslanması (≤ 0,32 rad) ve `spin`, ölçekler 0,26 / 0,42 / 0,5 / 0,8 / 2. Kartın kendisi her karede yeniden rasterlanmıyor; Phaser en yakın komşu ile döndürüyor → testere kenar (`hand-zoom.png`, `play-from-hand.png`, `smbSetMonster.png` #1). Buna karşılık `TileCard` kartı her karede 3B'den piksel tamponuna rasterlıyor — v3 kart yolculukları için doğru temel bu.
3. **Tam ekran parlamalar.** Çarpma stili pankartların ilk karesi tam genişlik düz beyaz / renkli bant (DÜELLO!, TUZAK!, SAVAŞ BİTTİ (iki kez), DESTE BİTTİ!, KAZANAN); doğrudan saldırıda bütün ekran (HUD dahil) kırmızı vinyet; Savaş Aşamasında kenar vinyeti. Plan §3 "aynı anda bütün ekran parlamaz".
4. **Pankartlar sahayı örtüyor.** Her tur ~1,0 sn tur pankartı + savaşa girişte ~1,0 sn; tuzakta "TUZAK!" + "SAVAŞ BİTTİ" ~2,5 sn. Pankart altında oynayan sahne (açılış dağıtımı, karo dalgası, saldıranların parlaması) görünmüyor.
5. **Bütün-sprite hareketi ana taşıyıcı.** Pozisyon değişimi, saldırı ilanı hazırlığı, çevirmede fırlama, geri itilme ve parlamalar sprite'ın kendisini kaydırma / ölçekleme / tek renge boyama ile yapılıyor; poz geçişlerinde ara kare yok (§4 ihlali). Bunu çözmek sözleşmeye yeni isteğe bağlı pozlar (`ready`, `toGuard`, `rise`, `flipOut`) eklemeyi gerektirir (A1).
6. **Süre bütçesi.** Küçük işlemler büyük olaylar kadar uzun: tur başı 1,17 sn, savaşa giriş 1,23 sn, koyma 0,78 sn, pozisyon 0,63–1,12 sn; savaş 3,2–3,9 sn. Tur değişimi toplamı (2,03 sn) bütçe toplamına denk ama zamanın yarısından fazlası tur pankartında.
7. **Süreklilik kopuklukları.** Ölüm → mezarlık (kart boşluktan doğuyor), çekmede izometrik hayalet → dik kart, oynamada dik kart → izometrik karo nesne değişimi. Elden atma (`emberStream`) ise doğru örnek.
8. **Düellocular çok küçük.** Doğrudan darbenin hedefi, "hurt", "defeat", "victory", "command" pozları 1× ölçekte ~20 px ve okunmuyor; birçok akış anı (tur başı, zafer) bu pozlara yaslanıyor.

---

## 4. Gizli bilgi kuralları (denetim)

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Rakibin çektiği kart | kapalı kalır (`HandView.addCard` rakipte `CardSprite(…, null)`) | kod; `ui/ui-vsbot-turn.png` |
| Kapalı koyma (canavar / büyü / tuzak) | uçuşta kart kimliği yüklenmez (`takeHandCard(…, null)`), kart kancası yok | `summon-b/_kit.ts slamCard`; `smbSetP2.png` |
| Kurbanla kapalı koyma | akış oyuncu renginde, özellik renginde değil | `summon-a/tribute.ts`; `suTributeSet.png` |
| Kapalı kartın üzerine gelme | rakibin kapalı canavarı / büyü-tuzağı "Kapalı Kart · Gizli"; kendi kapalı kartını sahibi görür | `ui/ui-hand-target.png` #10–#11, `ui/ui-inspect-grave.png` #1–#3 |
| El kapalıyken InspectPanel | `null` gösterir | `HumanInput` |
| Savaş günlüğü | kapalı / çekilen kart adı yazmaz | `engine/describe.ts` |
| Rakibin elden oynadığı büyü / çağırma | yalnızca açıldığında görünür (vitrinde) | `ui/ui-vsbot-hidden.png` #2–#5 |
| Yok edilen / atılan kapalı kart | açılarak mezarlığa gider — kurallara göre açık bilgi | `_defaults/battle.ts destroy`, `flow/discard.ts` |
| Sıcak koltuk, perde açık | tur başında ve tuzak penceresinde perde, el perde altında değişir; açılış eli kapalı başlar | `ui/ui-hotseat-trap.png`; `DuelScene` (`faceDown: hotseat && curtain`) |
| Sıcak koltuk, perde kapalı (ayar) | ilk oyuncu kim olursa olsun açılışta P1'in eli açık dağıtılır (ayarın doğal sonucu) | `opening.png` #26 |
| Tuzak penceresi | savunanın bütün kapalı büyü/tuzakları nabız atar (seçenek olanı ele vermez) ama pencerenin açılması + "Geç", uygun bir tuzak olduğunu söyler (vsBot dahil) | `battle/declare.ts`, `trapDecline.png` #5–#10 — **orta** |
| `decision chooseTarget` varsayılanı | adayları nabızlar (açık bilgi) | `_defaults/flow.ts` |

Sonuç: animasyonların hiçbiri gizli bir kartı göstermedi. Tek sızıntı tasarım düzeyinde (tuzak penceresinin varlığı).

---

## 5. En zayıf 10 nokta

1. **Mezarlık inceleme paneli yok** (plan zorunlu): mezarlığa tıklamak hiçbir şey yapmıyor, yalnızca üst kart hover'da görünüyor; `CardPicker` sadece Ruh Çağrısında. — `ui/ui-inspect-grave.png` #5–#6 · yüksek
2. **Kesirli kamera yakınlaşması** (1,04–1,08) her saldırı ilanında, her savaşta (darbe karesinde 1,08 punch), açılışta, deste bitmesinde ve oyun sonunda piksel ızgarasını bozuyor. — `atkTargetDestroyed.png` #12–#14 · yüksek
3. **Kartlar döndürülüp kesirli ölçekleniyor** (el yelpazesi, çekme, oynama, koyma, mezarlık yolculuğu, vitrin): testere kenar, bozuk iç pikseller. — `hand-zoom.png`, `play-from-hand.png` · yüksek
4. **Süre bütçesi aşımları**: Savaş Aşamasına giriş 1233 ms (bütçe 300), tur başı 1167 ms (600), koyma ~780 ms (400), pozisyon 633 / 1117 ms (400), çevirerek çağırma 1033 ms (600), canavara saldırı 3850 ms (1600–2200), doğrudan saldırı 3233 ms (~1600). · yüksek
5. **Ölüm → mezarlık kopuk**: canavar söndükten ~300 ms sonra kart boşluktan tam boyda belirip uçuyor; yok edilme başladıktan ~1,5 sn sonra. — `atkTD-zoom.png` #20–#23 · yüksek
6. **Tam ekran parlamalar**: pankartların ilk karesi tam genişlik düz bant (6 pankartta), doğrudan saldırıda HUD dahil bütün ekran kırmızı. — `opening.png` #19, `trapChains.png` #12/#25/#28, `atkDirectHawk.png` #20–#21 · yüksek
7. **Pankartlar sahanın ortasını örtüyor**: her tur ~1 sn + savaşa girişte ~1 sn; açılışta kart dağıtımı "DÜELLO!" bandının altında kayboluyor. — `turn-zoom.png`, `flowBattle.png`, `opening.png` #22–#25 · yüksek
8. **Geçersiz hedef geri bildirimi yalnızca metin + ses**: tıklanan yerde görsel tepki yok, metin ekranın en altında. — `ui/ui-hand-target.png` #9–#10, `ui/ui-battle-pick.png` #4–#6 · yüksek
9. **Küçük işlemlerin hareketi bütün sprite ile yapılıyor**: pozisyon değişimi, ilan hazırlığı, çevirmede fırlama, geri itilme = sprite ezme / kaydırma / tek renk; `idle` ↔ `guard` geçişinde ara poz yok; oyun sonu çöküşü her canavar için aynı glitch. — `smbPos.png` #1–#2 / #9–#10, `flowSurrender.png` #1–#4 · orta-yüksek
10. **InspectPanel geride kalıyor ve geçici olarak tutarsız**: hızlı taramada isim ile resim ~300 ms farklı kartları gösteriyor, ilk hover'da kart 300 ms kenardan görünüyor; tuzak sorusunda kart ilk ~600 ms kapalı. — `ui/ui-hand-target.png` #3–#8, `ui/ui-trap-prompt.png` #1–#2 · orta
