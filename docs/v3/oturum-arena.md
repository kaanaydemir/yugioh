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

### Sahne bloğu — eleştiri turu 2/3 düzeltmeleri (2026-11-05)

Önce: `shots/arena/r3-0.png`, `shots/arena/r3-0-sbs.png`, `shots/arena/r3-0-wall.png`. Her adımdan sonra görüntü alındı ve bakıldı:
1. **#1 Pah (ışıklı üst kenarlar)** — `platform.ts` RIM: sol-üst, sağ-üst, uzak düz ve sol kapak `earth3` → `gold2`
   (hedefteki görünür sıcak altın kenar), yakın/gölgeli kenarlar aynı (earth2 / earth1); çizgi hâlâ 1 px.
   → `r3-1-bevel.png`, `r3-1-bevelz.png`
2. **#3 Duvar sakinliği** — duvar panelleri bir stone basamağı koyu (ışıklı yüz gövde stone1 / vurgu stone2; gölgeli yüz
   gövde stone0 / vurgu stone1; derzler ink). Pencereler: her 3 panelden birinde bir pencere çifti (`pi % 3 === 1`);
   havalandırma paneli o yere düşerse pencere bir panel kayar (yoksa P2 yüzünde hiç kırmızı pencere kalmıyordu). "Düz panel"
   türündeki tek küçük pencere kaldırıldı. Kanal şeridi (tek cyan/kırmızı ışık hattı) korundu. → `r3-2-wall.png`,
   `r3-2-wallz.png`, `r3-2-sbs.png`, son hâli `r3-4-wallz.png`
3. **#5 Gölge kenarı** — `apron.ts`: saçağın hemen dışında 1 px açık zemin tonu (metal N1) halkası, gölgenin kenarı okunsun
   diye; düz stone0 bandı aynı. → `r3-3-shadow.png`, `r3-3-shadowz.png`, `r3-3-diff.png` (kırmızı = değişen pikseller)

Reddedilen / devredilen (gerekçeli):
- **#2 tahta üstü sıcak kahve**: `platform.ts` üst tonları zaten yalnız `stone1`/`stone0` (graphite = stone0..2); `earth`
  yalnız kenar çizgisinde. Örnek piksel: tahta sol yarısı #69685b (stone1 #393846'nın üstüne ışık katmanının sıcak
  anahtar-ışık yıkaması + `view/board-nt/floor.ts` taş-döşeme örtüsü). Tahta üstü / ışık katmanı maddesine devredildi.
- **#3 "sağ yüzdeki gürültü"**: yakın çekimde (`r3-0-wall.png`) sağ duvar yüzü düz ton + ink derz; x ~520+ noktalı desen
  zemin/sis katmanına ait (bu maddenin dosyası değil).
- **#4**: yakın alt köşe HUD ipucu plakasının altında kalıyor, altından taşmıyor; değişiklik gerekmedi.
- **#6 kürsü örtüşmesi** kürsü maddesine (pads.ts), **#7 çevre rengi** zemin/duvar maddelerine.
- **#8 v1 kapısı**: `tools/shot.mjs` durağan görüntü ve `--film` aynı kodla iki koşuda bile farklı çıkıyor (film: koşu-koşu
  121k–157k farklı piksel > şimdi/taban 70k; `r3-v1-film-now*.png`, `r3-v1-film-base.png`), yani piksel kanıtı bu araçla
  verilemez. Yapısal kanıt: bu turda değişen `platform.ts` / `apron.ts` yalnız `src/boot/21-arena-nt-platform.ts`
  (ARENA_NT = ?look=v3&arena=nt, başka sayfada hiçbir şey kurmuyor) tarafından çağrılıyor.

Testler: `tests/art/arena-nt-platform.test.ts` yeni şekle göre güncellendi (uzak pah / sol kapak `gold2`; ışıklı yüzde stone1
var, stone3 yok; P1 duvarında cyan3 18..36 piksel — iki yarıda da ≥ 6; P2 uzak sağ duvarda ≥ 6 crim3; P1'de kırmızı yok).
`tests/view/board-nt-layout.test.ts` değişmeden geçiyor. 12/12. `npm run typecheck` temiz. `palcheck r3-4-final.png` PASS.
Son: `shots/arena/r3-4-final.png`, `shots/arena/r3-4-sbs.png`.

### Sahne bloğu — eleştiri turu 3/3 düzeltmeleri (2026-11-05)

Not: önceki turların SBS'leri `--scale` varsayılanı 2 ile alınıp 640'a kırpılmıştı (yarım görüntü); bu turda çekimler
`--scale 1`. Önce: `shots/arena/r4-0.png`, `shots/arena/r4-0-zoom.png`, `shots/arena/r4-0-left.png` (hedef: `r4-tgt-left.png`).
Her adımdan sonra görüntü alındı ve bakıldı:
1. **#3 Duvar boyu** — `layout-nt.ts` FACE_H 58 → 46 (−%21; hedefin tıknaz kaidesi ~35–40 px), kesinti `platform.ts` üst
   panel bandından (UP_N 15 → 11); pencere bandı aynı boy. Kürsüler / gölge FACE_H'yi izliyor, kopma yok. → `r4-1-zoom.png`
2. **#2 Pah** — tek, kesintisiz altın kenar: ışıklı + yakın kenarlar gold2, gölgeli yakın-sağ kenar ve sağ kapak gold1;
   ışıklı kenarlarda her 6 px'te bir gold3 parıltı, içte earth1 alt-gölge satırı (2 px bevel, hâlâ ince). → `r4-2-zoom.png`
3. **#4 Kırmızı pencereler / #5 panel kabartması** — sağ yüzde (P2 + nötr) her iki panelden birinde pencere çifti; P2
   kürsüsü ile ipucu plakası arasındaki açıkta (x ~484–491, y ~222) kırmızı çift görünüyor. Her ikinci panelin üst
   bandında 1 px vurgu satırı. → `r4-3-wall.png`
4. **#3 iki cyan grup** — P1 kürsüsünün solundaki açık bölümde (panel 0..2) yalnız bir grup vardı; panel 0 da yakıldı → iki
   ayrı cyan pencere grubu görünür. → `r4-4-wall.png`
5. **#6 Gölge halkası** — `apron.ts` 3. turdaki 1 px açık zemin halkası kaldırıldı (görünmüyordu). → `r4-5.png`, `r4-5-sbs.png`

Reddedilen (gerekçeli):
- **#1 pah köşeleri / sekizgen**: anahat zaten sekizgen (iki dikey uç kapak + uzak/yakın düz kenar) ve hedefin anahattıyla
  aynı topoloji; "keskin köşe" izlenimi 3. turda kenar çizgisinin uzak/sağ kenarlarda kaybolmasındandı. 2. adımdaki
  kesintisiz altın kenar köşeleri okutuyor (`r4-2-zoom.png`). Ek 45° kesim layout + iki test dosyasının geometri
  sözleşmesini değiştirir, kazanç küçük.
- **#8 sol pay**: yapısal olarak simetrik — en sol karo köşesi x 128, PLATE_X0 118 (10 px); en sağ karo köşesi x 512,
  PLATE_X1 522 (10 px). Algılanan fark sağdaki P2 kürsüsü + hologram çerçevesinden. Karolar / layout taşınamaz.
- **#7 tahta üstü tonu**: tahta üstü / ışık katmanı maddesine ait (önceki turla aynı karar).

Testler: `tests/art/arena-nt-platform.test.ts` yeni şekle göre: altın kenar her kenarda (gold2 uzak/sol kapak/yakın düz,
x%6 parıltı gold3, gold1 yakın-sağ + sağ kapak), görünen açıklıklarda pencere (P1 kürsüsünün solunda iki ayrı cyan grup,
sağ duvarda y 200..250 aralığında ≥ 6 crim3). `tests/view/board-nt-layout.test.ts`: FACE_H 44..50. 34/34 geçiyor
(arena-nt + board-nt). `npm run typecheck` temiz. `palcheck r4-5.png` PASS. v1: FACE_H yalnız NT yolunda kullanılıyor
(LightLayer / cinematics FACE_H okumuyor).
Kalan farklar: tahta üstü hedefe göre sıcak/kahve (tahta/ışık maddesi), çevre maviden kömür-kahveye (zemin/duvar maddeleri),
hedefin P1 duvarındaki amber pencereler (görev tanımı P1'de cyan istediği için bilerek cyan).

### Tahta üstü (board top) — 2026-11-05

Önce: `shots/arena/bt-0.png`, `bt-0-sbs.png`, `bt-0-zoom.png`, `bt-0-z3.png`. Tespit edilen farklar:
(1) karo sınırları 2D-canvas ile çizilmiş yumuşak / kenar yumuşatmalı çizgi + parıltı (bulanık, net değil);
(2) karolar gömük değil, yalnız çerçeve; (3) plaka üstünde yumuşak "taş döşeme" örtüsü (rgba derzler + leke) —
ortada ve kenarlarda hayalet karo ızgarası; (4) ışık katmanının amber anahtar-ışık havuzu (`light:v3keywash`, rgba
radyal, alfa ≤ 0.42) hem plakayı kahverengiye (ölçülen 128/100/84, hedef ≈ 80/68/76) çeviriyordu hem de karoların
ÜSTÜNDE olduğu için neon çizgileri soldururdu; (5) P2 kırmızı çizgileri (crim2) koyu zeminde kayboluyordu.

Adımlar (her adımda görüntü alındı, bakıldı):
1. `view/board-nt/floor.ts`: yumuşak plaka örtüsü ve yumuşak karo çizgileri devreden çıktı (A/B için kod duruyor);
   karolar piksel atlas (`nt:floor`). `art/arena-nt/floor.ts` `slotFrame`: dama/dither yok; 1 px oyuncu çizgisi, uzak
   kenarlarda 2 px koyu iç duvar, yakın kenarlarda 1 px ışıklı dudak (stone2), içi TEK düz ton. → `bt-1.png`, `bt-1-zoom.png`
2. `view/light/LightLayer.ts`: anahtar ışık yıkaması tek düz palet rengi (skin2) + tek düşük alfa (0.22), plaka
   sekizgeninin altın pahın 3 px içine kırpılı, radyal gradyan yok; derinlik karoların ALTINA (NT_DEPTH.platform + 0.6).
   Karo içi stone1 (yıkamasız) → çevreden bir ton koyu gömük okuma; çizgiler saf palet pikseli. Plaka tonu ≈ 88/74/78
   (hedef ≈ 80–89 / 63–74 / 68–81). → `bt-2.png`, `bt-2-zoom.png`
3. Çizgi her iki tarafta ramp[3] (cyan3 / crim3, hedefte ikisi de parlak); sıradaki taraf / dolu karo artık daha parlak
   çizgiyle değil, uzak iç duvarın üst satırında ramp[1] (ince iç ışıma) ile ayrışıyor. → `bt-3.png`, `bt-3-zoom.png`,
   `bt-3-z4.png`, `bt-3-sbs.png`

Kapılar: `npm run typecheck` temiz; `palcheck bt-3.png` PASS (kalan palet dışı = plakanın yumuşak ışık yıkaması,
CLAUDE.md'nin izin verdiği ince ışık katmanı); arena-nt / board-nt testleri geçiyor (kalan 4 hata kart/canavar
testleri, bu maddeyle ilgisiz). v1: değişen kod yalnız NT yolunda (board-nt, arena-nt) ve LightLayer'ın stepped
(v3) dalında; v1 bunlara girmiyor.
Kalan farklar: hedefteki gömme daha derin (≈3 px duvar) ve çizgilerin dışında hafif neon ışıması var (bilerek yok:
"ince sınır"); karo içi stone1 hedefe göre bir tık soğuk/mavi; hedefte tahta üstünün sol üstünde ışık daha belirgin.

### Tahta üstü — eleştiri turu 1/3 düzeltmeleri (2026-11-05)

Önce: `shots/arena/bt2-0.png`, `bt2-0-z.png` (hedef kırpımları: `bt2-tgt-z.png`, `bt2-tgt-zl.png`). Her adımda görüntü alındı, bakıldı:
1. **#1 Gömme zayıf** — `art/arena-nt/floor.ts` `slotFrame`: uzak iç duvar 2 → 3 px ve bir ton koyu (ışıma satırı, ink,
   stone0; eskiden stone0 ×2), yakın dudak bir ton açık (stone2 → stone3). Karo çizgi kapalıyken de çukur okunuyor. → `bt2-1-z.png`
2. **#2 Kırmızı / cyan eşitliği** — çizgi zaten iki tarafta da ramp[3] (crim4 pastel pembe, sınır rengi olamaz). Asıl fark:
   uzak duvarın ışıma satırı yalnız sıradaki tarafta (a6Hover'da P1) çiziliyordu. Artık iki tarafta HER ZAMAN ramp[1]
   (cyan1 / crim1); sıradaki taraf / dolu karo ramp[2] ile ayrışıyor. Kırmızı karolar cyan ile aynı ağırlıkta. → `bt2-2-z.png`,
   `bt2-2-zl.png`, `bt2-2.png`, `bt2-2-sbs.png`
3. **#4 Sol üst anahtar ışık bandı (isteğe bağlı) — denendi, GERİ ALINDI.** `LightLayer` yıkamasında x + 2y = k izometrik
   köşegeninde sert kenarlı ikinci alfa: (a) skin2 0.30 → bant ölçülen 101/81/81, hedefin sol üstü 90/81/86 — daha sıcak /
   kırmızı, eleştirinin istediği "daha soğuk"un tersi (`bt2-3-z2.png`); (b) stone3 0.30 → 82/81/96, belirgin sert ton
   yarığı, tahtayı ikiye bölen çizgi gibi okunuyor (`bt2-4-z2.png`); (c) stone3 0.26 → 78/78/92, parlaklık aynı yalnız ton
   kayması (`bt2-5-z2.png`). Paletin skin2 ile stone3 arasında nötr bir adımı yok; sakin plaka korunarak kod tam eski hâline döndü.

Reddedilen (gerekçeli):
- **#3 köşegen çizgi "çift"**: maske dökümüyle doğrulandı — çizgi her satırda tam 2 px yatay, 2 px kayan temiz 2:1
  izometrik basamak; tepe / yan köşelerde fazladan piksel yok (yan köşe 2 satırlık tek sütun). 2:1 çizginin standart 1 px
  kalınlığı bu; "çift" izlenimi bitişik yakın dudaktan, 1. adımda dudak ayrı bir gri ton olarak okunuyor.
- **#5 altın pah dalgalı / parlak piksel öbeği**: sahne bloğu maddesine ait (3/3 turunda bilerek her 6 px'te gold3 parıltı).
- **#6 karo içi bir ton sıcak**: karo içi stone1 (57/56/70); palette stone0 ile stone1 arasında ya da stone1 yakınında daha
  sıcak nötr yok (tek aday skin0 = kahve). Sıcaklık yalnız ışık yıkamasından gelebilir; yıkama karoların üstüne çıkarsa neon
  çizgileri soldurur (önceki turun kararı). Dokunulmadı.

Kapılar: `npm run typecheck` temiz; arena-nt / board-nt testleri geçiyor (kalan 4 hata kart/canavar testleri, ilgisiz);
`palcheck bt2-6.png` PASS. v1: değişiklik yalnız `art/arena-nt/floor.ts` (NT atlası), v1 yolu kullanmıyor. Son: `bt2-6.png`,
`bt2-6-sbs.png`.
Kalan farklar: hedefte çizgilerin dışında hafif neon ışıması ve tahtanın sol üstünde yumuşak ışık (palet dışı gradyan
gerektirir); kırmızı cyan'dan doğası gereği bir tık koyu (crim3 / cyan3 parlaklığı).

### Tahta üstü — eleştiri turu 2/3 düzeltmeleri (2026-11-05)

Önce: `shots/arena/bt3-0.png`, `bt3-0-sbs.png` (hedef plaka kırpımı `bt3-tgt-board.png`). Her adımda görüntü alındı, bakıldı:
1. **#1 Plaka sıcak mor-kahve (≈ 88/74/78)** — `view/light/LightLayer.ts`: skin2 anahtar ışık yıkaması kapalı
   (`KEY_WASH_ON = false`, kod A/B için duruyor). Plaka ve altın pahın iç bandı artık saf palet taşı; mor dökümü bitti.
   → `bt3-1.png`, `bt3-1-sbs.png` (plaka düz stone1, fazla koyu ve karolarla aynı ton — 2. adım bunu çözüyor).
2. **#2 Işık düşüşü yok** — `art/arena-nt/platform.ts` `topTone`: atlasın kendisinde TEK sert kenarlı bant — x + 2y = k
   izometrik köşegeninin sol üst (anahtar ışık) tarafı stone2, ötesi stone1, en uzak sağ alt köşe stone0 (eskisi gibi).
   Kenar plakanın taş dalgasıyla hafif kırılıyor (dither yok). k = +300 bandı küçük bir köşe gibi okuttu (`bt3-2-z.png`);
   k = +420 plakayı sol üst aydınlık / sağ alt koyu iki yarıya ayırıyor, hedefin hacmi (`bt3-3-z.png`).
3. **#3 Karo gömük değil koyu panel** — `art/arena-nt/floor.ts` `slotFrame`: boş karo zemini stone1 → stone2. Çukur artık
   koyu uzak duvar + ışıklı dudakla okunuyor; karanlık yarıda karo plakadan bir tık açık (hedefte de alt karolar
   ≈ 86/89/111, plaka ≈ 74/67/94). → `bt3-4-z.png`
4. **#4 Kırmızı cyan'dan sönük** — crim3 parlaklığı (luma ≈ 132) cyan3'ten (≈ 177) düşük ve a6Hover'da kırmızı taraf sırada
   olmadığı için uzak duvar ışıma satırı crim1 idi (neredeyse siyah). Kırmızı karoların ışıma satırı bir ramp adımı yukarıda
   (`redLift`: crim2, sıradaysa crim3). Kırmızı çerçeveler cyan ile aynı ağırlıkta. → `bt3-5-z.png`, `bt3-5.png`, `bt3-5-sbs.png`

Reddedilen (gerekçeli):
- **#5 dış neon ışıma halkası (isteğe bağlı)**: "en fazla her ikinci piksel" halkası tahta üstünde dither demek; sahip kararı
  tahta üstünde dither yasak, ve tam 1 px cyan0/crim0 halka çizgiyi kalın gösteriyor ("ince sınır"). Yapılmadı.
- **#6 / #7**: uyum notu / başka maddeler (çevre, sahne bloğu, tahta ölçeği = sabit bölge konumları).

Kapılar: `npm run typecheck` temiz; `palcheck bt3-5.png` PASS (off 6.74 %, tahta artık tamamen palet pikseli);
vitest 1451 geçti, 5 hata kart/canavar/sunum testleri (bu maddeyle ilgisiz). v1: değişiklik yalnız NT atlası
(`art/arena-nt/floor.ts`, `art/arena-nt/platform.ts`) ve LightLayer'ın stepped (v3) dalı.
Kalan farklar: hedefin sol üstündeki ışık hafif sıcak (palette stone2 ile skin arasında nötr yok, soğuk tutuldu); hedefte
çizgilerin dışında yumuşak neon ışıması; hedef tahta daha büyük (sabit bölge konumları).

### Tahta üstü — eleştiri turu 3/3 düzeltmeleri (2026-11-05)

Önce: `shots/arena/bt4-0.png`, `bt4-0-z.png`. Her adımda görüntü alındı, bakıldı:
1. **#1 Karo derinliği 1x'te zayıf** — `art/arena-nt/floor.ts` `slotFrame`: uzak iç duvarın iç satırı bir taş adımı koyu
   (stone0 → ink; duvar artık ışıma satırı + 2 px ink), yakın dudak bir adım açık (stone3 → stone4, hâlâ 1 px). Çukur
   1x'te koyu uzak duvar + parlak dudak olarak okunuyor. → `bt4-1-z.png`, `bt4-1.png`
2. **#2 Plaka ışık düşüşü zayıf** — `art/arena-nt/platform.ts` `KEY_BAND` +420 → +480: stone2 (aydınlık) bölge merkeze
   doğru genişledi; sol üst belirgin aydınlık, sağ alt köşe koyu, bant kenarı daha net. Dither yok. → `bt4-2.png`, `bt4-2-sbs.png`

Reddedilen (gerekçeli):
- **#3 sağdaki kırmızı karoların crim3 satırını yükseltmek**: kırmızı çizgi zaten ramp'in en parlak sınır tonu crim3;
  bir üstü crim4 pastel pembe (tur 1'de sınır rengi olamaz diye reddedildi). Uzak duvar ışıma satırını crim3'e çıkarmak
  çizgiyi 2 px yapar ("ince sınır" kararına aykırı). `redLift` korunuyor.
- **#4 dış neon ışıma** ve **#5 tahta ölçeği**: eleştirmen de kabul ediyor (palette ton yok / sabit bölge konumları).

Kapılar: `npm run typecheck` temiz; `palcheck bt4-2.png` PASS; arena-nt + board-nt testleri 34/34. v1: değişiklik yalnız
NT atlası (`art/arena-nt/floor.ts`, `platform.ts`; v1 yolu bunları çizmiyor). v1 donmuş film karşılaştırması: eski↔eski
iki çekim 17.5k piksel, eski↔yeni 16.5k piksel fark — fark yalnız v1'in kendi canlı öğelerinde (spot, ikon, HUD), yani
v1 önizlemesi çekimler arası deterministik değil; NT değişikliğinden kaynaklı fark yok. Not: platform.ts / LightLayer.ts
tur 2 değişiklikleri `37c582c` checkpoint commit'inde duruyor (kaybolmamış).
Kalan farklar: hedefte çizgilerin dışında yumuşak neon ışıması; hedefte kırmızı biraz daha canlı; hedef tahta daha büyük.

### Düellocu kürsüleri (2026-11-05)

Önce: `shots/arena/pod-0.png`, `pod-0-sbs.png`, `pod-0-pz.png` (kürsü yakın çekimi, solda biz / sağda hedef).
Somut farklar: bizim kürsü 3 ince, düz basamak (lacivert metal), her basamakta neon çizgi → iç içe hedef tahtası gibi
çizgili okunuyordu; hedefte 2 tıknaz taş basamak, kalın yükseltiler, oyuncu rengi yalnız ışık olarak (üst kenar parlıyor,
alt basamağın ön kenarında ince ışık çizgisi).
1. `art/arena-nt/pads.ts` `paintPad` yeniden yazıldı: 2 basamak (`DAIS` steps 2, üst yükselti 5 px, alt 4 px, alt basamak
   her yana 9×4 px geniş), arduvaz taş yüzler (RAMPS.stone; sol yükselti aydınlık, sağ gölgeli, alt basamak ayağı koyu satır),
   üst kenarda oyuncu renginde basamaklı ışıma (kenar + bir satır içte bir ton aşağı), alt basamağın ön kenarlarında ince
   ışık çizgisi, ayak altında koyu temas lekesi. Tuval 86×52 → 64×40 (merkez aynı ayak noktası). → `pod-1-pz.png`
2. Seviye 1'de de iç ışıma satırı (ramp[1]) → `pod-2-pz.png`, nabız filmi `pod-2-film.png`
3. Kenar en düşük seviyede de ramp[3] (sönük dipte bile parlak; nabız iç satır + tepe ramp[4] ile) →
   `pod-3.png`, `pod-3-sbs.png`, `pod-3-film.png` (P2 nabız filmi).
Kapılar: typecheck temiz, palcheck `pod-3.png` PASS. v1: kürsü atlası yalnız ARENA_NT yolunda (boot 29 kapılı).
Kalan farklar: hedefte kürsülerin çevresinde zemine taşan renkli ışık havuzu var (tahta üstünde dither yasak, düz palet
tonu gri zeminde koyu/doygun kalıyor → yapılmadı); duelistXY sabit olduğu için P1 kürsüsü sahne ön kenarına yaslı
(yarısı yan duvarın önünde), P2 arka kenarın arkasında — hedefte ikisi de tahta üstünde; kırmızı ışıma hedeften biraz sönük.

#### Düellocu kürsüleri — eleştiri turu 1/3 düzeltmeleri (2026-11-05)
Önce: `shots/arena/pod-4.png`, `pod-4-pz.png` (üst: biz, alt: hedef; sol P1, sağ P2), `pod-4-p1z.png`.
1. **#1 yumuşak temas gölgesi** (geçerli): kaynak kürsü atlası değil, `view/light/LightLayer.ts` stepped kolundaki iki radyal
   gradyan (`ensureFloorShadowTex 34×18` + `ensureFootTex 14×7`, düellocu başına). `DUELIST_SOFT_SHADOWS = false` ile kapatıldı
   (yalnız v3 stepped kolu; canavar ayak gölgeleri dokunulmadı). Yerine `art/arena-nt/pads.ts` içinde sert, iki düz bantlı
   (ink + stone0) döküm gölgesi: alt basamak elmasının sağ-alta (+4, +rise+2) kaydırılmış kopyası; ayak altı koyu yama aynen.
2. **#2 ışıma ince çizgi** (geçerli): tahta-üstü dither yasağı yüzünden zemin halkası yerine eleştirinin B seçeneği: üst kenar
   artık iki tam bant (kenar + iç satır, her seviyede), alt basamağın dış kenarı da (arka kenarlar bir ton aşağı) ışıyor,
   üst yükseltinin ilk satırı oyuncu renginde (kenardan dökülen ışık). Kenar kalınlığı 2 px ≈ hedefin parlama ağırlığı.
   Zemin halkası REDDEDİLDİ: P2'nin önü ve P1'in sağı tahta üstü; kürsü tuvali altındakini bilmiyor → dither tahtaya taşar.
3. **#3 P2 havada** (geçerli): P2 alt basamak yükseltisi 4 → 6 px, koyu ayak satırı + sert döküm gölgesi → zemine oturuyor.
4. **#4 P1 sol yükseltisi duvarı kesiyor** (kısmen): ölçüm — sahne ön kenarı x=213'te y≈204, P1 ayak noktası (213, 214)
   yani düellocu kenarın ~10 px ÖNÜNDE (layout dondurulmuş). Kırpmak kürsüyü ikiye böler; ink dış çizgi + sağa düşen sert
   döküm gölgesi kürsüyü duvara "çıkıntı/balkon" gibi bağlıyor. Tam çözüm duelistXY taşımayı ister (bu maddenin dışı).
5. **#5 nabız görünmez** (geçerli): periyot 5.6/6.7 s → 2.0/2.3 s, döngü 1-2-1-0 eşit çeyrekler; kenar dipte ramp[2],
   tepede ramp[4] (P1). Aktif oyuncu bir seviye yukarı (+1, en çok 3; eskiden en az 2'ye sabitleniyordu, nabız kayboluyordu).
6. **#6 kırmızı sönük** (geçerli): P2 iç bandı bir ton yukarıda (crim2→crim3), crim4 (pembe) yalnız tepe/tur nabzında.
Tuval 64×40 → 70×46 (merkez/ayak noktası aynı; gölge sağa-aşağı taşar). Sonra: `pod-5.png`, `pod-5-pz.png`, `pod-5-p1z.png`,
nabız filmi `pod-5-film.png`. Kapılar: typecheck temiz, palcheck `pod-5.png` PASS. v1: atlas NT yolunda, LightLayer değişikliği
stepped (= LOOK_V3) kolunda.
Kalan farklar: hedefte kürsü çevresinde zemine yayılan renkli ışık havuzu (bizde yok, gerekçe #2); P1 konumu (#4);
hedefte alt basamağın üst yüzü daha geniş ve aydınlık.
