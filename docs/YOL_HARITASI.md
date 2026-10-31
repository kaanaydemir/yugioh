# Yol haritası — sahibin 18 maddelik iş listesi (2026-10-31)

Bu dosya, başka bir yapay zekâ ya da geliştirici işi kaldığı yerden devam ettirebilsin diye tutulur.
Her madde tamamlandıkça durum güncellenir ve commit + push yapılır.
Altın kural (CLAUDE.md): her animasyon, VFX ve SFX kart başına unique, çarpıcı, akıcı ve akılda kalıcı.
Kart isimleri ve tasarımları ORİJİNAL olur; Yu-Gi-Oh kartları yalnızca "rol" referansıdır.

| # | İş | Durum |
|---|----|-------|
| 1 | Neon Tower hologramlarını eski hâle (commit bc12475 = oynanabilir sürüm 7) döndür | devam ediyor (quick-batch-1) |
| 2 | Arenadan seyircileri kaldır (tribün yapısı kalır) | devam ediyor (quick-batch-1) |
| 3 | Animasyonları yavaşlat (v3 genel tempo çarpanı + kilit anlarda uzun bekleme; v1 aynı) | devam ediyor (quick-batch-1) |
| 4 | Akşam Büyücüsü (dusk_sorcerer) kartını oyundan çıkar (cards.ts'de "retired", desteler göç eder) | devam ediyor (quick-batch-1) |
| 5 | Kül Ejderi (ashen_drake) komple yeniden tasarım — altın kural | bekliyor |
| 6 | Hortlak Muhafız (grim_warden) yeniden tasarım | bekliyor |
| 7 | Pot of Greed rolünde büyü kartı (2 kart çek) — orijinal isim | bekliyor |
| 8 | Tüy Hayalet yeniden tasarım | bekliyor |
| 9 | The Legendary Fisherman rolünde canavar | bekliyor |
| 10 | Time Wizard rolünde kart: şu an yok (Kum Saati Cücesi farklı: dondurma). Sahibe soruldu | soru |
| 11 | Baby Dragon rolünde canavar | bekliyor |
| 12 | Gemini Elf rolünde canavar | bekliyor |
| 13 | Goblin Attack Force rolünde canavar | bekliyor |
| 14 | Bazoo the Soul-Eater rolünde canavar | bekliyor |
| 15 | Axe Raider, Alligator's Sword, Hayabusa Knight, Earthbound Spirit, Gazelle, Alpha/Beta/Gamma Magnet Warrior rollerinde canavarlar | bekliyor |
| 16 | Change of Heart, Dark Hole, Harpie's Feather Duster, Graceful Charity, Swords of Revealing Light, Mystical Space Typhoon, Snatch Steal, Scapegoat, Axe of Despair, Card Destruction, Graceful Dice rollerinde büyüler | bekliyor |
| 17 | İki ikonik kartın KART görünümünü (kart resmi) güncelle | soru (hangi iki kart?) |
| 18 | Saha görünüm kalitesini artır, "HD-2D" tarzı | soru (piksel kuralı ile çelişki) |

## Notlar
- Kart sayısı: şu an 55; 4. madde −1, yeni kartlar ≈ +26 → yaklaşık 80 (hedef 60–80 içinde).
- 16. maddedeki birçok etki motor (engine) eklentisi ister: kontrol değiştirme, saha temizleme, jeton (token) çağırma, zar, 3 tur kilit, el yenileme.
- Magnet Warrior üçlüsü: üç parça + birleşik özel çağırma (Mühür setindeki gibi bir set mekaniği) düşünülüyor.
- Her adımda commit + push; oynanabilir sürüm (artifact 81f1C4yX81fc29Z1AHKA8D) düzenli güncellenir.
