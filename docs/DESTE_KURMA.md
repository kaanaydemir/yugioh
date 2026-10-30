# Deste kurma (DESTE KUR) — tasarım notu

Ana menüde **DESTE KUR** (3 maç kipinin altında, Nasıl Oynanır'ın üstünde). Kart havuzu `ALL_CARDS`'tan **çalışma anında**
okunur: kart sayısı hiçbir yerde yazılı değildir; 35 kart da, 80 kart da aynı ekranda kayar. Kodlar: `src/scenes/deck/**`,
kurallar ve hazır desteler `src/data/decks.ts`, kayıt `src/scenes/deck/store.ts`, testler `tests/deck/**`.

## Kurallar (`validateDeck`, Türkçe gerekçelerle)
- Deste **tam 20 kart**; her kart kimliği en çok **1 kez** (tek kopya).
- En az **6 canavar**; en çok **4 canavar Seviye 7 veya üstü** (kurbanlı çağırma ağır).
- Bilinmeyen kart kimliği (oyundan kalkmış kart) "Eksik kart" diye işaretlenir; destesi yüklenirken kart düşürülür.
- Beş Mühür: 5 parça kartta küçük **zincir simgesi**; üzerine gelince ipucu: "Beş Mühür: 5 parça elde birleşirse kazanırsın".
- Eksik / geçersiz deste **kaydedilebilir** (taslak), ama maçta seçilemez (seçicide soluk, gerekçesi yazılı).

## Ekranlar
- **Kurucu** (`Deck` sahnesi, `?dev=deck`): solda oyunun kendi inspect paneli (büyük kart + metin) ve kısayol / mühür plakası;
  ortada süzgeç çipleri (Tümü / Canavar / Büyü / Tuzak, 6 element) + sıralama (Seviye / ATK / Ad) + kayan 3 sütunlu kart
  ızgarası (44x34 resim, ad, ATK/DEF, element damlası, seviye); sağda 5 kayıt yuvası, deste adı, 20 satırlık liste,
  seviye eğrisi, canavar/büyü/tuzak sayıları, kırmızı gerekçe satırları ve düğmeler (Kaydet, Rastgele, Hazır, Sıfırla, Temizle, Ad Ver).
- **Deste seç** (`DeckPick` sahnesi): 2 Oyuncu'da Oyuncu 1 sonra Oyuncu 2; Bilgisayara Karşı'da sen, sonra rakip
  ("Rastgele" = hazır desteler arasından biri, ya da herhangi bir hazır deste). Liste: Klasik, 6 hazır deste, dolu yuvalar.
  Varsayılan seçili olan **son kullanılan** deste. Sağda 20 kartın küçük resimleri, eğri, sayılar, seçili kartın metni.
- Hepsi fare **ve** klavye ile tam çalışır (aşağıda); üzerine gelme / basma geri bildirimi, odak çerçevesi; `prefers-reduced-motion`
  veya `?motion=reduced` iken (iki görünümde de) kayma / uçuş / yanıp sönme yok.

## Klavye
Ok tuşları gez · Enter/Boşluk ekle-çıkar · Del çıkar · Tab alan değiştir (havuz/deste) · PgUp/PgDn kaydır · 1–5 yuva ·
K kaydet · R rastgele doldur · H hazır deste (sırayla) · D klasik desteyi yükle · X temizle · N ad yaz (ilk harf eski adı siler) ·
F tür süzgeci · E element süzgeci · O sıralama · Esc geri (kaydedilmemiş değişiklikte ikinci Esc ile çıkılır).

## Hazır desteler (`PRESET_DEFS`, `buildPreset`)
Ateş Saldırı, Su Kontrol, Işık Destek, Karanlık Mühür (5 mühür + destek), Toprak Savunma, Dengeli. Her biri bir tarif:
birkaç sabit kart (`pins`) + güncel havuzdan role göre puanlanmış deterministik seçim; en az 5 düşük seviyeli canavar,
hep geçerli. Yeni kart gelince puanlamaya girer. `tests/deck/rules.test.ts` her hazır destenin geçerli olduğunu ve her `pin`'in
havuzda durduğunu denetler (kart kimliği kaybolursa test **yüksek sesle** kırılır). CPU rakip desteleri de bunlardır.

## Kayıt (`DeckStore`)
`localStorage` anahtarı `neon-duello:decks`: `{v, slots:[5], last:{p1,p2,cpu,edit}}`. Her erişim `try/catch` içinde; depolama
kapalı/dolu/bozuk ise bellekte devam eder (`persisted=false`, kullanıcıya söylenir). Bozuk JSON yok sayılır. Kayıtlı deste
yüklenirken bilinmeyen kimlikler ve tekrarlar atılır, sayısı `missing` olarak tutulur.

## Maça bağlama
`DuelLaunch.decks?: [CardId[], CardId[]]` → `scene.start('Duel', launch)` → `DuelScene` zaten `newGame({decks})` veriyor
(motor anlamı değişmedi). İki taraf da Klasik ise `decks` **hiç verilmez**: oyun eskisi gibi `DEFAULT_DECK` (veya `?deck=expanded`)
ile başlar; `?mode=…` URL'leri ve tüm senaryolar zaten bu yolu kullanır (v1 filmdiff aynı). Rövanşta seçilen desteler korunur.

## Bilinen eksikler
- Kurucu, tek seferde bir yuvayı düzenler; yuvalar arası kart kopyalama / deste dışa aktarma kodu yok.
- Seviye 7+ sınırı bugünkü havuzda (4 kart) hiç aşılamaz; sınır testi havuz büyüyünce otomatik devreye girer.
- Deste seç ekranında kart okumak için sol/sağ ok ya da fare gerekir; kaydırma yok (en çok ~12 satır).
