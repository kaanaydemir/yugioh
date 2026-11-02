# Yol haritası — sahibin 18 maddelik iş listesi (2026-10-31)

Bu dosya, başka bir yapay zekâ ya da geliştirici işi kaldığı yerden devam ettirebilsin diye tutulur.
Her madde tamamlandıkça durum güncellenir ve commit + push yapılır.
Altın kural (CLAUDE.md): her animasyon, VFX ve SFX kart başına unique, çarpıcı, akıcı ve akılda kalıcı.
Kart isimleri ve tasarımları ORİJİNAL olur; Yu-Gi-Oh kartları yalnızca "rol" referansıdır.

| # | İş | Durum |
|---|----|-------|
| 1 | Neon Tower hologramlarını eski hâle (commit bc12475 = oynanabilir sürüm 7) döndür | bitti (587828c, test sürümü 9) |
| 2 | Arenadan seyircileri kaldır (tribün yapısı kalır) | bitti (587828c, test sürümü 9) |
| 3 | Animasyonları yavaşlat (v3 genel tempo çarpanı + kilit anlarda uzun bekleme; v1 aynı) | bitti (587828c, test sürümü 9) |
| 4 | Akşam Büyücüsü (dusk_sorcerer) kartını oyundan çıkar (cards.ts'de "retired", desteler göç eder) | bitti (587828c, test sürümü 9) |
| 5 | Kül Ejderi (ashen_drake) komple yeniden tasarım — altın kural | bitti (şerit A b2fc32e, ana dal bd5cf12, test sürümü 13) |
| 6 | Hortlak Muhafız (grim_warden) yeniden tasarım | bitti (şerit B 09446f8, ana dal bb9e8f6, test sürümü 12) |
| 7 | Pot of Greed rolünde büyü kartı (2 kart çek) — orijinal isim (Kuyu Kovası) | kural bitti (6178b55); sunum: şerit E |
| 8 | Tüy Hayalet yeniden tasarım | şerit B çalışıyor |
| 9 | The Legendary Fisherman rolünde canavar | kural bitti (6178b55, test sürümü 10); sunum: bitti (Kabuk Zıpkıncı, şerit C 67baa70, ana dal 7bae67e, test sürümü 13) |
| 10 | Time Wizard rolünde yeni kart (yazı-tura; doğru: rakip canavarlar yok, yanlış: kendi canavarların yok + yarı ATK hasar) — sahip onayladı | kural bitti (6178b55, test sürümü 10); sunum: şerit D çalışıyor |
| 11 | Baby Dragon rolünde canavar | kural bitti (6178b55, test sürümü 10); sunum: şerit A çalışıyor |
| 12 | Gemini Elf rolünde canavar | kural bitti (6178b55, test sürümü 10); sunum: şerit D çalışıyor |
| 13 | Goblin Attack Force rolünde canavar | kural bitti (6178b55, test sürümü 10); sunum: şerit D çalışıyor |
| 14 | Bazoo the Soul-Eater rolünde canavar | kural bitti (6178b55, test sürümü 10); sunum: şerit B çalışıyor |
| 15 | Axe Raider, Alligator's Sword, Hayabusa Knight, Earthbound Spirit, Gazelle, Alpha/Beta/Gamma Magnet Warrior rollerinde canavarlar | kural bitti (6178b55, test sürümü 10); sunum: şeritler C+B+D çalışıyor |
| 16 | Change of Heart, Dark Hole, Harpie's Feather Duster, Graceful Charity, Swords of Revealing Light, Mystical Space Typhoon, Snatch Steal, Scapegoat, Axe of Despair, Card Destruction, Graceful Dice rollerinde büyüler | kural bitti (6178b55, test sürümü 10); sunum: şerit E çalışıyor |
| 17 | Kristal Ejder + Uçurum Büyücüsü KART resimlerini yenile (yalnız kart görünümü) | şerit E çalışıyor |
| 18 | Saha kalitesi "HD-2D" tarzı — SAHİP KARARI: ŞİMDİLİK PAS. HATIRLATMA: diğer maddeler bitince sahibe tekrar sor (piksel kalır + bloom/derinlik/ışık seçeneği önerildi) | ertelendi |

## Notlar
- Kart sayısı: şu an 55; 4. madde −1, yeni kartlar ≈ +26 → yaklaşık 80 (hedef 60–80 içinde).
- 16. maddedeki birçok etki motor (engine) eklentisi ister: kontrol değiştirme, saha temizleme, jeton (token) çağırma, zar, 3 tur kilit, el yenileme.
- Magnet Warrior üçlüsü: SAHİP ONAYLADI — üç parça sahadayken kurban edilip büyük birleşik canavar çağrılır (imza birleşme animasyonu).
- Her adımda commit + push; oynanabilir sürüm (artifact 81f1C4yX81fc29Z1AHKA8D) düzenli güncellenir.

## Paralel oturumlar (2026-10-31 16:01 UTC)
Kart başına altın kural sunumu 5 bulut oturumunda paralel yürüyor (ayrıntı: docs/v3/PARALEL_OTURUMLAR.md).
Her şerit kendi dalına push eder; ana oturum dalları `claude/yugioh-card-game-tgi7td`'ye birleştirir.
| Şerit | Dal | Oturum |
|---|---|---|
| A | claude/kart-a | session_01Qe4uUJ2dZKvTFhia6rbxti |
| B | claude/kart-b | session_01Qe4uUDSVc9nwVaE4iWUFtx |
| C | claude/kart-c | session_01Qe4uUFQZLLFads5VWWVWXM |
| D | claude/kart-d | session_01Qe4uUGTZwWeKDJrNnCEZ7k |
| E | claude/kart-e | session_01Qe4uUEaufKLqmHJXwp6MbG |

## Şeritlerden sonra (sıra)
1. Birleştirme + toplu kontrol (çakışma, ses dengesi, yeni kartlarla CPU maçları).
2. Arena kalite turu (kule/duvar derinliği, platform malzemesi, bellek bütçesi 42 MB).
3. HD-2D kararı — sahibe tekrar sor (hatırlatma).
4. Düellocular sahnede (4 karakter, kendi animasyonları).
5. Yayın öncesi kalite denetimi (her kartın VFX/SFX'i altın kurala göre; performans, açılış, hatalar).
6. İngilizce (ana dil).
7. Yayın hazırlığı (Steam paketleme, ayarlar, kayıt, mağaza görselleri).

## Ana oturum düzeltmeleri (test sürümü 11, 898dc9d)
- Canavar tıklama çakışması (v3): hedef seçerken adayın görünen gövdesi öncelikli; üzerine gelince ve tıklayınca aynı canavar seçiliyor. Doğrulama: her tahta pikseli doğru (P1 19343/19343, P2 19308/19308).
- Sıra sıra oyunda sağ ekran "OYUNCU 2" (CPU yalnız bilgisayara karşı).
- Deste seçimi: fareyle tıklama seçer; üzerine gelmek seçimi değiştirmez; ikinci tıklama/düğme/Enter ilerletir.
- Saman korkuluk "takılma": oyun hatası değil, test aracının perde geçişini iki kez tıklamasıymış (tools/playtest.mjs passCurtain düzeltildi).

## Haftalık hak kararı (2026-11-01 08:35 TR)
Haftalık kullanım %20'ye düştü. SAHİP KARARI: yalnız A, B, C şeritleri devam; D, E, F DURAKLATILDI
(işlerini push edip kendi oturum-*.md dosyalarına devam talimatı yazdılar). Haftalık sıfırlamadan sonra
D/E/F'ye "devam" mesajı gönderilecek. A/B/C: önce kartları tamamen bitir (kapılar + kart başına commit).
- D (c64b368), E (fda4f8e), F (f776d8e) duraklatıldı; devam talimatları oturum-d/e/f.md'de.
- %92 KARARI (2026-11-01 14:20 TR): B hemen duraklatıldı (4ec15a3); A yalnız Kül Ejderi'ni, C yalnız
  Kabuk Zıpkıncı'yı bitirip duraklatıldı (A 811d832, C 03c8952). İkisi ana dala alındı, test sürümü 13.
  Şu an TÜM şeritler duraklı. Ana dalda yarım işlerden gelen bilinen test hataları: cloud_hatchling (4, şerit A),
  crag_axeman "own voice" (şerit C) — şeritler devam edince düzelecek.
- UYARI: claude/kart-f dalında shield_titan ve hourglass_imp v3 dışlama listesinden çıkarılmış ama eleştiri/kapılardan geçmedi → F devam edip kartlar geçmeden bu dal ana dala BİRLEŞTİRİLMEZ.

## Sahip kararları (2026-11-01 akşam)
- Kart resimleri: yapay zekâ ile (sahip üretir, Claude prompt verir ve oyuna bağlar). Sabit ana çerçeve,
  Yu-Gi-Oh! oranı, sade koyu isim, piksel yazı/yıldız. Ayrıntı: docs/v3/KART_RESIM_AI.md.
  Bu iş Perşembe (2026-11-05 23:00 TR) haftalık sıfırlamadan SONRA ele alınacak.
- Oyunun TAMAMI İngilizce olacak (arayüz, kart adları, kart yazıları). Geçiş haftalık sıfırlamadan sonra
  planlanacak; o zamana kadar mevcut Türkçe metinler kalır.
- Kalan şerit işleri (A–F) yine haftalık sıfırlamadan sonra; şu an yalnız A şeridi (Bulut Yavrusu, Zehir Ejderi) çalışıyor.
- ~~Açık soru: büyük büyülerin süre istisnası~~ → ÇÖZÜLDÜ (aşağıda).
- SAHİP GERİ BİLDİRİMİ (2026-11-01): "her şey birbirine girmiş" (Witchbrook ile karşılaştırma). Okunurluk / sanat
  yönetimi turu planlanacak (haftalık sıfırlamadan sonra, kart resimleriyle birlikte değerlendir):
  1) arka plan katmanı (tribün, hologram, makineler) koyu + az doygun, az detay — sahne ön planda kalsın;
  2) her bölgeye sınırlı palet; neon/doygun renk yalnız odak noktalarında (birimler, seçili kare, düğmeler);
  3) saha zemini birimlerden net ayrışan, sakin, geniş yüzey; ızgara çizgileri inceltilsin;
  4) arayüz: daha az ve daha düzenli panel, sahayı örtmeyen yerleşim, tek yazı boyu düzeni;
  5) ışık yönü + yumuşak gölge ile derinlik. Hızlı maket: arka planı soldurmak tek başına ayrışmayı belirgin artırdı.
- HEDEF GÖRÜNÜM (sahip onayı bekliyor): docs/v3/ref/hedef-gorunum-1.png (ChatGPT ile şimdiki ekrandan
  — docs/v3/ref/simdiki-gorunum-1.png — üretildi). Alınacaklar: koyu/sakin arka plan + sıcak meşale ışık
  noktaları, düz sakin arduvaz saha + ince ızgara, sol üstten tek ışık + birim altı gölgeler, daha az parlak arayüz.
  Alınmayacaklar: piksel yoğunluğu (resim 640×360 ızgarasında değil, yumuşak) ve değişmiş birim çizimleri.
- HEDEF GÖRÜNÜM v2 (SAHİP BEĞENDİ, ana referans): docs/v3/ref/hedef-gorunum-2.png — canavarlar korunarak
  yalnız arka plan/ışık/arayüz değişti. Sahip özellikle SİS'i sevdi: arka planda katmanlı, yavaş sürüklenen
  sis + soluk hologramlar + sıcak meşale ışık noktaları korunacak. Saha zemini sakin arduvaz, ince ızgara,
  sol üstten tek ışık, birim altı gölge.
- SAHİP KARARI (2026-11-01 21:00 TR): animasyonlar için SABİT SÜRE SINIRI YOK. Süreleri Claude belirler.
  REHBER §5 × 1.45 (docs/v3/TEMPO.md) artık sert bir kapı değil, yalnız yol gösterici; bir an daha
  etkileyici ve okunur oluyorsa daha uzun olabilir (ör. Boşluk Gözü ~5,4 sn kabul). Ölçüt: akıcı, okunur,
  oyunu yavaşlatmayan tempo — sık görülen anlar (sıradan saldırı/çağırma) kısa kalır, nadir/büyük anlar uzar.
- Bulut Yavrusu (cloud_hatchling) BİTTİ: şerit A 3cd1647, ana dal 03b0221, test sürümü 14. Sırada Zehir Ejderi (şerit A çalışıyor).
- Zehir Ejderi (venom_drake) BİTTİ: şerit A dd6ce16, test sürümü 15. ŞERİT A TAMAMEN BİTTİ (Kül Ejderi,
  Bulut Yavrusu, Zehir Ejderi). Özet ve açık şeritler-arası notlar: docs/v3/oturum-a.md "LANE A DONE".
- SAHİP KARARI (2026-11-02, Gemini okunurluk sonucu üzerine): hologramlar PARLAK kalır (soluklaştırılmaz) ve
  arka plandaki tribünler KALDIRILMIŞ hâliyle kalır — ikisi de sahibin isteği. Düzeltilecekler: havada asılı
  meşaleler (duvara/direğe oturacak) ve sis/ışığın piksel-net + yalnız palet renkleriyle yapılması.
