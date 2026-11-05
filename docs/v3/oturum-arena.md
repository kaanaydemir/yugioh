# Oturum: v3 ARENA görsel turu (hedef-gorunum-3)

Dal `claude/kart-a`. Hedef: `?dev=duel&s=a6Hover&look=v3` ≈ `docs/v3/ref/hedef-gorunum-3.png`. Kapsam: yalnız ARENA_NT
(v3) kodu; v1 görünüm dokunulmadı (değişen tüm dosyalar yalnız `?look=v3` + NT altında çalışır).

## Madde "Sahne bloğu" (2026-11-05)

Önce: `shots/arena/stage-before.png`, yan yana `shots/arena/stage-before-sbs.png`, kırpım `shots/arena/stage-before-crop.png`,
duvar yakın `shots/arena/stage-before-wallL.png`.

Saptanan farklar (yalnız bu madde):
1. P1 kürsüsü sahne kenarından ~5 px kopuk, havada (yakın-sol kenar satır payı 0.375 karo).
2. Yan duvarlar neredeyse siyah lacivert (night0 ağırlıklı), derzler okunmuyor, ~33 px geniş paneller, ışıklı pencere yok
   denecek kadar az; köşelerde üst yüzeye taşan sütun başlıkları.
3. Üst pah: kahve 3 px bant yalnız ışıklı kenarlarda; yakın kenarlarda soğuk gri; içte oyuncu renkli oluk çizgisi.
4. Yere düşen gölge yok: apron gölgesi `ink` ile boyanıyordu, apron'un "lift" eşlemesi (calm-remap) onu night2'ye
   açıyordu; duvar dibinde açık renk bir kaide halkası vardı.

Yapılanlar (her adımdan sonra ekran görüntüsü alındı ve bakıldı):
1. `src/view/board-nt/layout-nt.ts`: satır payı 0.375 → 0.5625 karo (`PLATE_R0/R1` −1.0625 / 5.0625), sütun payı 0.375 aynı.
   Bu değer kürsünün arka kenarını sahne kenarına tam yaslar (P1 önde, P2 arkada; pad'in arka kenarı sahne kenarına
   paralel). Pah: `PLATE_X0/X1` 108/532 (uçtan 10 px), `PLATE_Y0/Y1` 58/262 (uçtan 9 px), yakın düz kenar 328..364
   (lights.ts mavi/kırmızı ayrımı x 364 korunur). Alt kenar 262 + FACE_H 58 = 320. → `stage-1-geom(-crop).png`
2. `src/art/arena-nt/platform.ts` duvar ressamı yeniden yazıldı: pah dudağı 3, üst panel bandı 15, mürekkep derz, ışık
   kanalı 3 (oyuncu renginde tek çizgi), ana panel bandı (çift ışıklı pencere / tek pencereli düz panel / kaburga çifti /
   havalandırma ızgarası; panel başına sabit hash), kemer + oyuncu renkli işaret ışığı, taban. Paneller ~22 px, her derz
   1 px ink + 1 px aydınlık. Pencereler eksen-hizalı 2 px (kesme yok), çerçeveli, üst satır cyan3/crim3, alt cyan2/crim2,
   altında sönük taşma çizgisi. Renk: P1 (yakın-sol + yakın düz + sağ duvarın yakın yarısı) camgöbeği, sağ duvarın uzak
   yarısı kırmızı, orta nötr. Köşe sütunları başlıksız, duvarla aynı hizada 4 px direk. → `stage-2-wall*.png`,
   `stage-3-wall*.png` (noktalı doku satırı geri alındı, pencereler sıklaştı)
3. Üst pah: tek ince sıcak çizgi tüm kenar boyunca (`earth2`, gölgeli yakın-sağ kenarlarda `earth1`), içte 1 px taş dudak,
   sonra koyu oluk; oyuncu renkli oluk kaldırıldı.
4. `src/art/arena-nt/apron.ts`: gölge `PAL.stone0` (night merdiveninde değil → lift onu açmaz), duvar dibinden başlar
   (aydınlık kaide halkası kaldırıldı): 8 px düz, sonra dama dither, sonra seyrek 1/4 dither (yalnız saha dışı).
   → `stage-4-shadow.png` (etkisiz: lift), `stage-5-shadow.png`
5. Duvar tonları bir basamak açıldı (ışıklı yüz ana gövde night2, gölgeli night1) — hedefteki gri-lacivert duvara daha
   yakın. → `stage-6.png`, `stage-6-crop.png`, `stage-6-far.png`

Testler: `tests/art/arena-nt-platform.test.ts` (yeni sekizgen örnek noktaları; duvar: FACE_H boyu, ≥5 ton, her yerde sıcak
pah, ≥6 panel derzi, P1 duvarında cyan3 pencere, sağ duvarın uzak yarısında crim3, P1 duvarında kırmızı yok) ve
`tests/view/board-nt-layout.test.ts` (sıkı: ızgara köşesinden pay ≤ 24/12 px; her kürsü sahne kenarına YASLI: arka kenarı
plakada, 2 px içerisi ve merkezi plakada değil). İkisi de geçiyor (12/12). Tam vitest: yalnız bilinen ilgisiz 5 hata.
`npm run typecheck` temiz. `node tools/palcheck.mjs shots/arena/stage-6.png` PASS.

Hedeften kalan farklar (bu madde): duvar hâlâ hedeften koyu/daha lacivert (ışık katmanı mavi tonluyor); hedefin pahı
parlak altın, bizimki sahip isteğiyle sönük; hedefte köşelerde küp kasalar ve büyük pahlar var (bilerek yok); kürsüler
basamaklarını her yöne açıyor — P2 kürsüsünün alt basamakları sahne üstüne biniyor, P1'inki duvarın önünde asılı
duruyor (kürsü maddesi: basamaklar yalnız dışa, kürsü gövdesi yere/duvara inmeli); duvar boyu FACE_H 58 ile sınırlı
(hedef ~3×; ekrana sığmıyor).

### Sahne bloğu — eleştiri turu 1/3 düzeltmeleri (2026-11-05)

Önce: `shots/arena/crit-stage-sbs.png`, `shots/arena/r2-before-sbs.png` (hedef 640×360'a küçültülüp yan yana).
Her adımdan sonra ekran görüntüsü alındı ve bakıldı:
1. **Büyük pahlar (sekizgen)** — `layout-nt.ts`: `PLATE_X0/X1` 108/532 → 118/522 (yan uçlardan 20 px kesim: 20 px boyunda
   dikey kapaklar, dış karo köşelerinden 10 px açık), `PLATE_Y0` 58 → 62 (uzak düz kenar 268..320 = 52 px, uzak karo
   köşesinden 2 px açık). Yakın düz kenar 328..364 aynı (lights.ts ayrımı). Uzun kenarlar değişmedi → kürsüler hâlâ yaslı.
   → `r2-1-chamfer.png`, `r2-1-sbs.png`, `r2-1-crop.png`. Sahne artık eşkenar dörtgen değil, sekizgen okunuyor.
2. **Pah görünürlüğü** — `platform.ts` RIM: ışığa bakan uzak kenarlar (sol-üst, sağ-üst, uzak düz, sol kapak) `earth3`,
   yakın-sol ve yakın düz `earth2`, gölgeli yakın-sağ + sağ kapak `earth1`. Kesintisiz 1 px sıcak çizgi; hâlâ "ince/sönük"
   (sahip kararı) — hedefin parlak altını (gold3) bilerek alınmadı. → `r2-2-bevel.png`, `r2-2-zoom.png`
3. **Duvar tonu + pencereler** — duvar paneli lacivert night merdiveninden gri-arduvaz `stone` merdivenine (ışıklı yüz gövde
   stone2 / vurgu stone3; gölgeli yüz bir basamak koyu), derzler ink. Işık kanalı 2 px görünür akış (cyan2+cyan1 /
   crim2+crim1), pencereler 3×2 / 3×3 cam (üst sıra cyan3 / crim3), panel başına pencere olasılığı arttı; orta nötr paneller
   hedefteki gibi küçük amber (gold2) pencereli. Köşe direkleri de stone. Işık katmanı duvarı ezmiyor (örnek piksel
   stone1 = #393846 aynen geliyor) → katmana dokunulmadı. → `r2-3-wall.png`, `r2-3-crop.png`, `r2-3-wallzoom.png`,
   `r2-4-shade.png`, `r2-4-crop.png` (gölgeli sağ yüz ayrıca bir ton koyu: ışıklı/gölgeli yüz ayrımı)
4. **Yere düşen gölge** — `apron.ts`: gölge alt-sağa kaydırıldı (taban ana hattı (8, 4) px ötelenerek ölçülüyor: sağ
   duvarın sağında / yakın köşenin altında en geniş, ışıklı sol yüzde değişmez), düz stone0 bandı 8 → 12 px, sonrası yalnız
   2 basamak saçak (2 px dama + 2 px seyrek; eskiden 12 px kaba dama bandı). → `r2-5-shadow.png`, `r2-5-cmp.png`,
   `r2-5-diff.png`, `r2-5-right.png`

Reddedilen / ertelenen (gerekçeli):
- **#4 duvar boyu "hedefin 1/3'ü"**: ölçüm yanlış. Hedef 640×360'ta sol duvar üst kenar ~y172 → alt ~y230 ≈ 58 px; bizim
  FACE_H zaten 58 (yakın kenar 262 + 58 = 320, ipucu plakasının üstü). Eski koyu lacivert duvar alt bantta zemine karıştığı
  için kısa görünüyordu; 3. adımdaki açık gri paneller tam boyu okutuyor. Boy değiştirilmedi (PLATE_FULL ≤ 320 HUD sınırı).
- **#6 sağdaki kaba dama**: sahne gölgesindeki 12 px dama bandı kaldırıldı (bkz. 4). Kalan nokta deseni (`r2-5-right.png`,
  x ~530..640) zemin/sis katmanlarına ait (bu maddenin dosyaları değil) — zemin maddesine not.
- **#7 kürsü taşması**: kürsü maddesine (pads.ts) devredildi; bu madde kenarı değiştirmedi.
- Köşe kasaları: isteğe bağlı; eklenmedi (karo payına basarlardı).

Testler yeniden yazıldı: `tests/art/arena-nt-platform.test.ts` (yeni sekizgen örnek noktaları, 20 px kapaklar, eski 10 px
pahın kesildiği nokta boş; earth3 uzak pah / earth1 gölgeli yakın-sağ pah; ışıklı yüzde stone2; P1 duvarının iki yarısında
da cyan3, toplam ≥ 24 cyan3 piksel; uzak sağ duvarda ≥ 6 crim3; P1'de kırmızı yok) ve `tests/view/board-nt-layout.test.ts`
(sekizgen: iki dikey kapak ≥ 16 px, uzak düz kenar ≥ 48 px, yakın düz kenar tam 328..364; kürsüler yaslı). 12/12 geçiyor.
Tam vitest: yalnız bilinen ilgisiz 5 hata (canavar/kart). `npm run typecheck` temiz. `palcheck shots/arena/r2-5-shadow.png`
PASS. v1: değişen dosyaların hepsi yalnız NT/v3 yolunda (layout-nt, arena-nt/platform, arena-nt/apron).

Son: `shots/arena/r2-final-sbs.png`. Kalan farklar: pah hedefin parlak altınından sönük (bilerek); hedefin çevresi sıcak
kahve/kömür, bizimki mavi (zemin/ışık maddeleri); kürsü basamakları kenarı örtüyor (kürsü maddesi).
