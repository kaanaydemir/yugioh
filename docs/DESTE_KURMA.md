# Deste kurma (DESTE KUR) — tasarım notu

Ana menüde **DESTE KUR** (3 maç kipinin altında, Nasıl Oynanır'ın üstünde). Kart havuzu `COLLECTIBLE_CARDS`'tan (= `ALL_CARDS` eksi emekli
kartlar) **çalışma anında** okunur: kart sayısı hiçbir yerde yazılı değildir; 35 kart da, 80 kart da aynı ekranda kayar. Kodlar: `src/scenes/deck/**`,
kurallar ve hazır desteler `src/data/decks.ts`, kayıt `src/scenes/deck/store.ts`, testler `tests/deck/**`.

## Kurallar (`validateDeck`, Türkçe gerekçelerle)
- Deste **en az 40, en çok 80 kart** (`DECK_MIN`, `DECK_MAX`).
- Her karttan **en çok 3 kopya** (`MAX_COPIES`); Beş Mühür parçalarından (`seal_head`, `seal_arm_r`, `seal_arm_l`, `seal_leg_r`,
  `seal_leg_l`) **her biri en çok 1** (`maxCopies`). Fazla kopya "Çok kopya: ..." diye işaretlenir.
- Boyuta göre ölçeklenen oranlar (`minMonsters`, `maxHigh`; küçük deste en az 40 kart gibi sayılır): **canavar en az %40**
  (40 kartta 16, 80 kartta 32), **Seviye 7+ canavar en çok %20** (40 kartta 8, 80 kartta 16; kurbanlı çağırma ağır).
- Bilinmeyen kart kimliği (oyundan kalkmış kart) "Eksik kart" diye işaretlenir; deste yüklenirken kart düşürülür.
- **Emekli kartlar** (`cards.ts` içinde `retired: true`; bugün yalnız **Akşam Büyücüsü** `dusk_sorcerer`, sahip kararı): kart
  verisi ve resmi paylaşılan sözleşme olduğu için silinmez, ama hiçbir yerde sunulmaz: kurucu ızgarası, hazır desteler, CPU /
  `?deck=expanded` örnekleyicisi, "Rastgele doldur". `addBlocker` "Bu kart artık oyunda yok" der, `validateDeck` onu "Eksik
  kart" sayar. Kayıtlı bir destede (v1 veya v2) her kopyası yüklenirken **benzeriyle değiştirilir** (`RETIRED_SUBSTITUTES`:
  Kül Ejderi → Kristal Ejder → Fırtına Şövalyesi, sonra aynı türden / aynı seviye bandından herhangi biri); deste boyu, canavar
  ve Sv7+ sayısı korunur, deste geçerli kalır. Kurucu bunu "Oyundan kalkan kart: N kopya benzeriyle değişti" diye yazar
  (`SavedDeck.replaced`; kaydedince kalkar).
- Bu kurallar yalnız **kurucu / deste seçici** içindir: motor (`newGame({decks})`) her desteyle oyun başlatabilir; eski 20 kartlık
  yardımcılı testler ve `DEFAULT_DECK` (20 kart) aynen çalışır.
- Beş Mühür: 5 parça kartta küçük **zincir simgesi**; üzerine gelince ipucu: "Beş Mühür: 5 parça elde birleşirse kazanırsın".
- Eksik / geçersiz deste **kaydedilebilir** (taslak), ama maçta seçilemez (seçicide soluk, gerekçesi yazılı).
- `autoFillDeck(mevcut, tohum, havuz, hedef)`: kurallara uyan, tohumlu "Rastgele doldur"; önce az kopyalı kartları seçer
  (hedef 40..80; kurucuda hedef = en az 40, bugünkü kart sayısı büyükse o). `repairDeck`: bilinmeyenleri ve limit üstü kopyaları
  atar, emekli kartları yerinde değiştirir (`replaced`), 80'de keser. `addBlocker`: bir kart eklenemiyorsa Türkçe nedeni.

## Ekranlar
- **Kurucu** (`Deck` sahnesi, `?dev=deck`): solda oyunun kendi inspect paneli (büyük kart + metin) ve kısayol / mühür plakası;
  ortada süzgeç çipleri (Tümü / Canavar / Büyü / Tuzak, 6 element) + sıralama (Seviye / ATK / Ad) + kayan 3 sütunlu kart
  ızgarası (44x34 resim, ad, ATK/DEF, element damlası, seviye); sağda 5 kayıt yuvası, deste adı, **sayaç `N/40-80`**
  (40 altı / 80 üstü kırmızı, aralıkta ama kural bozuk sarı, geçerli yeşil), **kayan deste listesi** (her kart bir satır:
  `xN` kopya sayısı, ad, Sv, ATK, satır başı **-** / **+** düğmeleri, sağda kaydırma çubuğu; 20 satır görünür, 80 kart = en
  çok 55 farklı kart), seviye eğrisi, canavar/büyü/tuzak sayıları, kırmızı gerekçe satırları ve düğmeler (Kaydet, Rastgele,
  Hazır, Sıfırla, Temizle, Ad Ver).
- Kopya ekleme: havuzda karta **tıkla = +1 kopya** (hücrede `xN` rozeti ve resmin altında **-** düğmesi var), listede **+ / -**.
  3 kopyaya (Mühür 1) ulaşınca ek sınırı kırmızı mesajla söylenir. Fare tekerleği: solda ızgara, sağ panelde liste kayar.
- **Deste seç** (`DeckPick` sahnesi): 2 Oyuncu'da Oyuncu 1 sonra Oyuncu 2; Bilgisayara Karşı'da sen, sonra rakip
  ("Rastgele" = hazır desteler arasından biri, ya da herhangi bir hazır deste). Liste: Klasik, 6 hazır deste, dolu yuvalar.
  Varsayılan seçili olan **son kullanılan** deste. Sağda destenin **farklı kartları** (5x4 küçük resim, `xN` rozeti; 20'den
  fazlaysa PgUp/PgDn ya da tekerlekle kayar), eğri, sayılar, seçili kartın metni.
- Hepsi fare **ve** klavye ile tam çalışır (aşağıda); üzerine gelme / basma geri bildirimi, odak çerçevesi; `prefers-reduced-motion`
  veya `?motion=reduced` iken (iki görünümde de) kayma / uçuş / yanıp sönme yok.

## Klavye
Ok tuşları gez · Enter/Boşluk havuzda **+1 kopya**, deste listesinde **-1 kopya** · Del/Backspace/**-** kopya çıkar · **=** / **+** kopya
ekle (listede → da ekler) · Tab alan değiştir (havuz/deste) · PgUp/PgDn kaydır (odaktaki alan) · 1–5 yuva ·
K kaydet · R rastgele doldur · H hazır deste (sırayla) · D klasik desteyi yükle · X temizle · N ad yaz (ilk harf eski adı siler) ·
F tür süzgeci · E element süzgeci · O sıralama · Esc geri (kaydedilmemiş değişiklikte ikinci Esc ile çıkılır).

## Hazır desteler (`PRESET_DEFS`, `buildPreset`)
Ateş Saldırı, Su Kontrol, Işık Destek, Karanlık Mühür (5 mühür + destek), Toprak Savunma, Dengeli. Hepsi **40 kart**. Her biri bir
tarif: birkaç sabit kart (`pins`, ikişer kopya; mühürler birer) + güncel havuzdan role göre puanlanmış deterministik seçim
(güçlü kartlar 2-3 kopya, Sv7+ tek kopya, arka sıra hedefi `backRow x 2`); en az 10 düşük seviyeli canavar, hep geçerli.
Yeni kart gelince puanlamaya girer. `tests/deck/rules.test.ts` her hazır destenin geçerli olduğunu ve her `pin`'in havuzda
durduğunu denetler (kart kimliği kaybolursa test **yüksek sesle** kırılır). CPU rakip desteleri de bunlardır.
**Klasik Deste** = özgün 20 kartın iki katı (`classicDeck()`, 40 kart, her karttan 2). CPU örnekleyici `expandedDeck` (`?deck=expanded`):
tohumlu 40 kart = 24 canavar + 16 büyü/tuzak (tüm büyü/tuzaklardan çeker; Sv7+ ve mühür tek kopya, diğerleri en çok 2).

## Kayıt (`DeckStore`)
`localStorage` anahtarı `neon-duello:decks`: `{v:2, slots:[5], last:{p1,p2,cpu,edit}}`. Her erişim `try/catch` içinde; depolama
kapalı/dolu/bozuk ise bellekte devam eder (`persisted=false`, kullanıcıya söylenir). Bozuk JSON yok sayılır. Kayıtlı deste
yüklenirken bilinmeyen kimlikler ve limit üstü kopyalar atılır (`missing` sayılır), 80'den uzunsa kesilir.
**Eski kayıt göçü:** `v` < 2 olan (20 kartlık tek kopya) bir yuvada 10+ kart varsa deste iki katına çıkarılır (mühürler tek kalır),
kalan boşluk tohumlu `autoFillDeck` ile 40'a tamamlanır ve `migrated` işaretlenir; sonraki kayıtta `v:2` yazılır. 10 karttan azsa taslak
olarak kalır (geçersiz, seçilemez). Hiçbir durumda çökmez.

## Maça bağlama
`DuelLaunch.decks?: [CardId[], CardId[]]` → `scene.start('Duel', launch)` → `DuelScene` zaten `newGame({decks})` veriyor
(motor anlamı değişmedi). İki taraf da Klasik ise `decks` **hiç verilmez**: oyun eskisi gibi `DEFAULT_DECK` (20 kart; veya `?deck=expanded`, 40)
ile başlar; `?mode=…` URL'leri ve tüm senaryolar zaten bu yolu kullanır (v1 filmdiff aynı). Başka bir eşleşmede (ör. Klasik'e karşı hazır deste) tam 40-80 kartlık desteler verilir. Rövanşta seçilen desteler korunur.

## Bilinen eksikler
- Kurucu, tek seferde bir yuvayı düzenler; yuvalar arası kart kopyalama / deste dışa aktarma kodu yok.
- Seviye 7+ havuzda 3 farklı kart var (Akşam Büyücüsü emekli): 40 kartta üst sınır (8) 3'er kopyayla (9) aşılabilir, test bunu doğrular.
- Klasik'e karşı Klasik (iki taraf da varsayılan) motorun 20 kartlık `DEFAULT_DECK`'iyle oynanır (eski akış / `?mode=` URL'leri ve
  v1 filmdiff aynı kalsın diye); Klasik Deste başka bir desteye karşı seçilince 40 kartlık hâli oynanır.
- Havuzda sağ tık ile kopya çıkarma yok (tarayıcı bağlam menüsü); onun yerine hücredeki **-** düğmesi / Del kullanılır.
