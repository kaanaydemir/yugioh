# Yapay zekâ ile kart resmi (sahip kararı, 2026-11-01)

Kart yüzleri artık kodla değil, sahibin bir resim aracıyla ürettiği yüksek çözünürlüklü piksel-art
resimlerle yapılacak. SAHİP KARARI: "dışarıdan resim yok" kuralı YALNIZ kart resimleri için kalktı.
Sahadaki canavar sprite'ları, efektler ve sesler kodla yapılmaya devam eder.

## Akış (kart başına)
1. Claude oyundaki canavarın sprite'ını (`?dev=monster&id=<id>&look=v3`, 4× büyütülmüş) ve TEK PARÇA promptu verir.
2. Sahip resim aracına 2 referans ekler: (1) oyundaki sprite (tasarım/renk), (2) Kristal Ejder kartı
   (`assets/cardart-ai/art/crystal_wyrm-src-fullcard.png`, stil ve detay seviyesi). Sıra önemli.
3. Resim kare (1:1, 1024×1024), yazısız, çerçevesiz sahne olarak gelir → `assets/cardart-ai/art/<id>.png`.
4. Claude çerçeveye yerleştirir, yazıları ekler, oyuna bağlar.

## Prompt kalıbı (tek parça; yalnız Subject/Background/Palette değişir)
```
Detailed high-resolution PIXEL ART illustration for a premium fantasy trading card,
same art style and detail level as the second reference image (the crystal dragon card):
fine pixel detail, visible but small crisp pixels (like a 512x512 pixel canvas),
rich cel-shaded lighting, clean dark outlines, dramatic composition.
NO smooth gradients, NO painterly blur, NO frame, NO border, NO text, NO letters,
NO numbers — only the scene, full-bleed. Square 1:1, 1024x1024.

Use the FIRST reference image (small game sprite) ONLY for the creature's design,
silhouette and colors — do NOT copy its low resolution; redraw it as an epic,
detailed version.

Subject: ... (facing RIGHT)
Background: ...
Palette: ...
```
Ders: "match the reference exactly" + "chunky pixels" → model küçük sprite'ı büyütüp kopyalıyor (kötü).
Stil referansı + "do NOT copy its low resolution" ile çözüldü.

## Kart düzeni (onaylı, sahip "OK")
- Oran Yu-Gi-Oh! ile aynı: 59×86 mm → 1086×1583 (0.686).
- Ana çerçeve: `assets/cardart-ai/frame-monster.png` (Kristal Ejder kartından çıkarıldı, düz kısımlar
  uzatıldı; resim penceresi şeffaf). Pencere: x 52–1034, y 192–1055. Yazı kutusu ≈ y 1154–1453.
- Nitelik rengi: çerçevedeki turkuaz taşların tonu kayar (Işık turkuaz, Karanlık mor = hue +0.27,
  Ateş kırmızı, Su mavi, Rüzgâr yeşil, Toprak kehribar). Büyü yeşil-altın, tuzak bordo-altın tonlanacak.
- İsim: SADE — koyu kahve (38,24,14) tek renk piksel yazı, efektsiz, bant ortası (x≈470, y≈120).
  (Altın geçişli/kenarlı başlıklar sahip tarafından reddedildi.)
- Yıldızlar: elle piksel yıldız (9×9, ×4), yazı kutusunun üstünde.
- Tür satırı, açıklama, çizgi, ATK/DEF: piksel yazı, koyu mürekkep.
- Dil: SAHİP KARARI (2026-11-01) — oyunun TAMAMI İngilizce olacak; kartlar İngilizce yazılır.
- Maket araçları: `tools/cardart-ai/kart4.py` (son hal; kart2/kart3 önceki denemeler; yollar scratchpad'e
  göredir, çalıştırmadan önce düzelt). Son maket: `assets/cardart-ai/mockup-v4.png`.

## Durum
- Kristal Ejder: resim tamam (tam-kart kaynaktan kırpılıyor; ileride kare sahne olarak yeniden üretilebilir).
- Kül Ejderi: resim tamam (`ashen_drake.png`).
- Uçurum Büyücüsü: taslak 1 çok sprite-gibi; yeni promptla tekrar üretilecek.
- Sırada: Hortlak Muhafız, Kabuk Zıpkıncı, sonra diğer canavarlar, en son büyü/tuzak.

## Oyuna bağlama — SAHİP: Perşembe (2026-11-05, 23:00 TR) haftalık sıfırlamadan SONRA bakılacak
- İnceleme panelinde tam kart, ekran çözünürlüğünde (kamera/oyun 640×360 değişmez).
- Elde/sahada: sahnenin canavar bölümü küçültülmüş kırpım.
- Steam: yapay zekâ içeriği mağaza sayfasında beyan edilmeli.
