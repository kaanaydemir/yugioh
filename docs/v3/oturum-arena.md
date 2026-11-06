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

#### Düellocu kürsüleri — eleştiri turu 2/3 düzeltmeleri (2026-11-05)
Önce: `shots/arena/pod-6.png`, `pod-6-p1z.png`, `pod-6-p2z.png`, `pod-6-pz.png`.
Tek dosyada (`art/arena-nt/pads.ts`; görüntü konumu `PAD_CANVAS` üzerinden, `view/board-nt/pads.ts` değişmedi), sahne
`platform.ts`'ye dokunmadan:
1. **#1 P2 boşlukta** (geçerli): yeni `paintBase` — kürsünün altında sahnenin arka-sağ kenarından dışarı çıkan taş çıkıntı
   (üst yüz stone2 = tahta tonu, dış üç kenarında sahnenin altın pervazı: aydınlık kenarlar gold2 + her 6 px gold3 + earth1 +
   stone0, gölgeli sağ kenar gold1/stone1/night0; görünen sağ yan duvar şeridi sahne üst yüzünün arkasında kesiliyor).
   Birleştiği yerde sahnenin kendi pervaz satırlarını örtüyor → sahne tek blok + çıkıntı okunuyor.
2. **#2 P1 ön duvarın üstünde** (geçerli): aynı `paintBase`, P1 için sahnenin sol-ön duvarından dışarı çıkan blok: üstü sahne
   üstüyle aynı hizada, üç dış kenarında altın pervaz, altında 46 px'lik duvar (ön yüz aydınlık, sağ yüz gölgeli; sahne
   `paintFace` satır düzeni: kaplama, üst panel bandı, camgöbeği kanal, ana bant, kemer), ortada panel dikişi, iki çift küçük
   camgöbeği pencere, zeminde ink + stone0 temas çizgisi. Kürsü artık tamamen taş üstünde; duelistXY/layout değişmedi.
3. **#3 ışıma yalnız çizgi** (geçerli): basamak üstleri oyuncu rengine bir ton (üst basamak yüzü ramp[0..1], alt basamağın iç
   satırları ramp[0..2]); ayak çevresinde iki satırlık DÜZ (dither yok) oyuncu renkli ışık bandı; ayak altı temas lekesi ink +
   stone0 (sert).
4. **#4 alt basamak dar** (geçerli): `DAIS.stepW/stepH` 9/4 → 12/6; alt basamağın açık stone2 üst yüzü ~6 satır görünüyor.
5. **#5 nabız sönük** (geçerli): nabız artık kenar + iç bant + yüz tonu + ayak bandı birlikte (seviye 0: ramp[0] yüz / bant, tepe:
   ramp[1] yüz + ramp[2] bant). Film: `pod-7-film1.png` (P1), `pod-7-film2.png` (P2) — açıkça nefes alıyor.
6. **#6 P2 solundaki meşale halesi** — bu maddenin dışı (duvar meşaleleri / ışık katmanı sahibi); dokunulmadı.
Tuval 70×46 → 96×98 (ayak noktası aynı). Sonra: `pod-7.png`, `pod-7-pz.png` (üst biz / alt hedef), `pod-7-sbs.png`.
Kapılar: typecheck temiz, palcheck `pod-7.png` PASS, vitest: 5 kırmızı test yalnız canavar/kart dosyalarında (başkasının işi).
v1: atlas yalnız ARENA_NT yolunda (boot 29 kapılı).
Kalan farklar: P1 kürsüsü hedefte tahta üstünde, bizde (sabit duelistXY yüzünden) sahneden çıkan bir çıkıntı üstünde;
hedefte kürsü çevresindeki ışık havuzu daha geniş ve yumuşak (bizde 2 satırlık düz bant); P2 alt basamak yüzleri hedefte
lacivert-gri, bizde arduvaz gri.

#### Düellocu kürsüleri — eleştiri turu 3/3 düzeltmeleri (2026-11-05)
Önce: `shots/arena/pod-8.png`, `pod-8-pz.png` (üst biz / alt hedef; sol P1, sağ P2). Tek dosya: `art/arena-nt/pads.ts`.
1. **#1 / #4 P1 çıkıntısı ve P2 pervazı büyük** (geçerli): kürsü hedefin ölçüsüne küçültüldü — `PAD_HALF` 20×10 → 16×8, `DAIS.stepW/stepH`
   12/6 → 8/4 (üst 32 px, alt basamak 48 px; hedef ≈30 / ≈50). Çıkıntı payı `m` 3 → 1. Taban artık alt basamak + 5 satır (3 satır
   pervaz + ışık havuzu); P1 çıkıntısı ~2 satır, P2 pervazı da ona göre küçüldü (`pod-9`, son hali `pod-17`). Çıkıntıyı tamamen
   kaldırmak duelistXY'yi taşımayı ister (dondurulmuş) → çentik küçüldü ama duruyor.
   Ara deneme REDDEDİLDİ: taban payı yalnız +2/+1 (`pod-10`) — havuz için yer kalmadı, alt basamak doğrudan altın pervaza oturdu.
2. **#2 ışıma sert** (geçerli): üst kenar tek ince çizgi ramp[2] (tepede ramp[3]), iç bantlar ve basamak yüzü tonu kaldırıldı
   (yüzler düz stone2); alt basamağın ön kenarı ramp[1] ince çizgi; ayak bandı TEK satır; çevresine düz, basamaklı ışık havuzu
   (dither yok): bant ramp[1|2] → 1.5 satır ramp[0|1] → 1.5 satır ramp[0|1]. Havuz tabanın taşına (altın çizgi kalır) ve P2'nin
   önünde çıplak tahta üstüne basılıyor (kırmızı karolara değmiyor, `pod-14-p2z`). Paletin içinde stone2 üstüne "yumuşak camgöbeği"
   ton yok (stepped ışık tablosu da stone2+camgöbeği → cyan1 veriyor), o yüzden havuz koyu doygun halkalar olarak okunuyor.
3. **#3 temas gölgesi** (geçerli): döküm gölgesi ve ayak lekesi yalnız stone0 (ink yok), gölge kayması (+4,+2) → (+2,+1).
4. **#5 P2 basamak yüzleri** (kısmen): gölgeli yükseltiler night3. Aydınlık yüzlerde night4 denendi → fazla mavi, REDDEDİLDİ (`pod-15-p2z`);
   son `pod-16-p2z`.
5. **#6 P2 arkasındaki dither sis / düz lacivert duvar**: bu maddenin dışı → duvar / sis sahibine bırakıldı.
Nabız filmi: `pod-16-film1.png` (P1), `pod-16-film2.png` (P2) — hafif (kenar + bant + havuz birlikte bir ton).
Kapılar: typecheck temiz, palcheck `pod-17.png` PASS, vitest arena-nt/board-nt/board-calm 37/37. v1: atlas yalnız ARENA_NT yolunda.
Kalan farklar: P1 hâlâ sahne kenarından çıkan küçük bir blok üstünde (duelistXY); havuz hedefteki gibi yumuşak değil (palet sınırı);
nabız sakin, bazı karelerde zor seçiliyor.

## Arka duvar (madde "Back wall") — 2026-11-05
Ne: lacivert reaktör kulesi + mavi panel duvar yerine hedef-gorunum-3'teki koyu tuğla duvar.
- Yeni `src/art/arena-nt/brickwall.ts`: tek tam genişlik opak doku (656×110): tavan kemeri + borular, taş korniş,
  tuğla alanı (her tuğlanın tonu en yakın aplik meşaleye uzaklığa göre seçilir → sıcak havuz tuğla sınırlarında
  basamaklanır; dither/gradyan yok; ton merdiveni night1 → stone0/earth0 → skin0 → skin0+skin1 → skin1+skin2),
  kapitelli taş sütunlar (6), amblem arkasında çerçeveli taş levha, sağda duvar boruları, LED'li küçük kutular, süpürgelik.
  Kendi katman adı ('brickwall') — duvarın lacivert lift remap'i (calm-remap LIFT_LAYERS) dokunmuyor.
- `src/view/board-nt/wall.ts`: panel şeridi, kule, eski metal sütunlar, tavan lambaları, ekran-arkası dither ışığı,
  kule LED/veri panelleri ve neon bayraklar kaldırıldı; amblem levhada kalıyor. İki kızıl bayrak (altın kanatlı-V
  mührü, `backhall.ts` paintBanner) sallanıyor; LED'ler yavaş ve ayrı ritimlerle yanıp sönüyor; her meşalenin havuzu
  ara sıra bir kademe genişliyor (opak palet kaplama, alfa yok) → ışık nefes alıyor.
- `src/view/board-nt/lights.ts`: aplik meşaleler artık duvara/sütuna oturmuş BRICK_TORCHES noktalarında
  (119,58 sütun · 251,44 · 389,44 · 501,68); apliklerin noktalı dither halesi gizlendi (ışık tuğlaya pişmiş). Direkli mangallar değişmedi.
Önce/sonra: shots/arena/wall-before-stack.png → shots/arena/wall-07-stack.png (+ -sbs), yakın: wall-before-clipL.png → wall-05-clipL.png,
titreşim filmi wall-06-film.png. typecheck temiz, palcheck PASS, vitest arena-nt 22/22. v1: doku yalnız ARENA_NT yolunda.
Kalan farklar: meşale alevleri hedefe göre küçük (sprite lights.ts paintTorch, mangallarla ortak — dokunulmadı);
hedefte havuzlar daha yumuşak/geniş; tavan kemerleri sade; sağdaki borular/kutular HUD ve hologram altında az görünüyor;
yukarı kaydırılan kamerada (intro) eski panel karoları duruyor.

#### Arka duvar — eleştiri turu 1/3 düzeltmeleri (2026-11-05)
Önce: `shots/arena/bw2-0.png` (+ `bw2-0-sbs.png`, üst biz / alt hedef). Dosyalar: `art/arena-nt/brickwall.ts`, `view/board-nt/wall.ts`, `view/board-nt/lights.ts`.
1. **#3 tuğla fazla sıcak/doygun** (geçerli): uzak alan stone0 (+ night1 varyant) — soğuk lacivert-gri; ışık havuzu yarıçapı
   64×46 → 34×28 px (`POOL_RX/RY`), merdiven stone0 → stone0/skin0 → skin0 → skin1 → skin2 (`bw2-1`).
2. **#1 meşaleler zayıf** (geçerli): mangaldan ayrı, duvara özel meşale sprite'ı `paintWallTorch` (9×24: 5×9 alev, 3 kare
   titreşim — dik / sola / sağa, altın-kenarlı demir kap, sap, perçinli duvar plakası); ışık artık PİKSEL başına basamaklı
   (alevin çevresinde düz eşmerkezli bantlar, dither yok; tuğla deseni kalır) → tuğla kutusu şeklindeki havuz yerine yuvarlak
   sıcak ışık (`bw2-2`, `bw2-3-z`). Sütun yüzleri de aynı bantlarla sıcak aydınlanıyor (`bw2-5-z`).
3. **#4 iç meşale konumları** (geçerli): 251/389 → amblem sütunlarının yüzüne 276,40 / 364,40 (sağdaki artık kırmızı ekranın
   dibinde değil; amblemi iki yandan sarıyor) (`bw2-4`).
4. **#6 amblem** (kısmen): navy çerçeve stone rampına yeniden boyandı (lift remap'siz) → çelik-gri duvar süsü (`bw2-6-z`).
   %20 küçültme REDDEDİLDİ: tam sayı olmayan ölçek piksel dilini bozar; yeniden çizim gerekir.
5. **#2 tavan / intro panelleri** (geçerli kısmı): kameranın yukarı kaydığı intro'da eski lacivert paneller yerine aynı koyu
   tonoz karosu `paintBrickVault` (kaburga + kemer + boru) (`bw2-7-up.png`). Dinlenme kamerasında 0–17 px tavan zaten var,
   HUD altında kalıyor (hedefte de) → değiştirilmedi.
6. **#5 bayraklar** REDDEDİLDİ: kumaş zaten 12 px (16 px sprite), hedefte de sağ bayrak daha alçakta (y≈52–90) — mevcut hali hedefe uyuyor.
7. **#7 LED kutusu** REDDEDİLDİ: x≈575–590 bandı mor hologramın arkasında; hologram ile HUD arasında görünür boş duvar yok.
Titreşim filmi `bw2-8-film.png`. Son: `bw2-6.png`, `bw2-final-sbs.png`. typecheck temiz, palcheck PASS; vitest'te 5 kırmızı
yalnız kart/canavar testlerinde (bu işin dışı). v1: yalnız ARENA_NT yolu.
Kalan farklar: meşale braketi hedefteki gibi yana kıvrık değil (önden plaka); havuz bantları hedefin yumuşak halesine göre sert.

#### Arka duvar — eleştiri turu 2/3 düzeltmeleri (2026-11-05)
Önce: `shots/arena/bw3-0.png` (+ `bw3-0-sbs.png` üst biz / alt hedef, yakın `bw3-0-zl.png`). Dosyalar: `art/arena-nt/brickwall.ts`, `view/board-nt/backhall.ts`.
1. **#1 havuzlar koyu disk** (geçerli): ton merdiveni yalnız AYDINLATIYOR — kenar halkası skin0 (+ stone1 varyant), sonra
   skin0/earth1 (harç earth0), earth2/skin1, alevin dibinde earth3/earth2 (üst kenar earth4). Koyulaştıran basamak yok; havuz
   yarıçapı 34×28 aynı, turuncu çekirdek eşikleri 0.3/0.52 → 0.22/0.46 (turuncu yalnız alevin yanında) (`bw3-1`).
2. **#2 sütunlar okunmuyor** (geçerli): sütunlar vardı ama tuğla merdiveniyle aydınlanıp tuğla gibi görünüyordu. Artık
   tuğladan KOYU: yüz night0 (havuzda earth0), sağ üçte bir ink, 1 px aydınlık sol kenar (stone1 → havuzda skin0/skin1),
   başlık + kaide bandı ve ince yatay derzler kalıyor. İç meşaleler (276/364) sütun yüzlerinde okunuyor (`bw3-1-zl`, `bw3-2-zc`).
   Konum 68/316/604 önerisi REDDEDİLDİ: hedefteki sütunlar ≈109 ve amblemin iki yanında (mevcut 109/268/356); 316 amblemin ortası,
   68 ve 604 ejderha/mor hologramın arkasında kalıyor.
3. **#3 tuğla tabanını bir ton koyulaştır** REDDEDİLDİ: uzak alan zaten en koyu taş (stone0 + night1); hedeften örneklenen tuğla
   (≈#322433) bizimkinden açık. Sıcaklık artık yalnız havuzların içinde.
4. **#4 meşale küçük** (geçerli): yeni sprite 11×24 — 7×11 alev, gold4 beyaz-sarı çekirdek, 3 kare (dik/sola/sağa), altın
   ağızlı demir kap, soldaki perçinli duvar kayışından çıkan yan kol + altında kıvrık demir sarmal (`bw3-2-zc`, film `bw3-4-film`).
5. **#5 amblem** (kısmen): levhanın girintisine 1 px pah (alt/sağ dudak stone1, üst/sol gölgede) → gömme çerçeve okunuyor.
   Küçültülmüş amblem REDDEDİLDİ (yine): hedefteki amblem ≈45×23, bizimki 54×25 — fark küçük; tam sayı ölçekte yeniden çizim bu turun dışı.
6. **#6 bayraklar** (geçerli, küçük): kumaş 4 px uzadı (16×46 → 16×50), mevcut V çentikli kuyruk korunuyor (`bw3-3`).
7. **#7** sahne/zemin maddesi — bu maddenin dışı.
Son: `bw3-3.png`, `bw3-3-sbs.png`, `bw3-3-zl.png`. typecheck temiz, palcheck PASS, vitest arena-nt/board-nt/board-calm 37/37.
v1: değişiklikler yalnız v3 tuğla duvar dokusu/sprite'ı ve yalnız v3 duvarın kullandığı bayrakta.
Kalan farklar: havuzlar hedefin yumuşak halesine göre hâlâ basamaklı disk (palet + dither yasağı); sağ dış sütunlar HUD/hologram altında.

#### Arka duvar — eleştiri turu 3/3 düzeltmeleri (2026-11-05)
Önce: `shots/arena/bw4-0.png` (+ `bw4-0-sbs.png` üst biz / alt hedef, yakın `bw4-0-z.png`, hedef yakın `bw4-tgt-z.png`).
Dosyalar: `art/arena-nt/brickwall.ts`, `view/board-nt/wall.ts`, `view/board-nt/backhall.ts`.
1. **#1 havuzlar düz disk** (geçerli): havuz bantlarının sınırları 4×4 sıralı dither ile çapraz taranıyor (`bay()`, genişlik
   yarıçapın 0.16'sı; yalnız duvarda, tahta üstünde değil) → kenar halka yerine tuğlaya eriyen hale (`bw4-1-z`). Sütunlar da aynı dither'ı kullanır.
2. **#2 sütunlar okunmuyor** (geçerli): sütunlar artık tuğladan BİR TON AÇIK yontma taş (yüz stone1, sol kenar stone2, sağ üçte
   bir stone0, ink derzler; havuzda skin0/skin1/skin2), başlık/kaide üst 2 sırası parlak dudak + altında gölge → kapitel bandı
   net (`bw4-2-z`). "Tuğladan %15 koyu" önerisi REDDEDİLDİ: tuğla alanı zaten en koyu taş (stone0); daha koyu sütun turda 2'de
   boşluk/yarık gibi okunuyordu. Konumlar aynı (iç meşaleler 268/356 sütun yüzlerinde).
3. **#3 amblem** (kısmen): çelik eşleme bir kademe koyu (night1→night0, night2→stone0, night3→stone1, night4→stone2) → gömme,
   üst barla yarışmıyor (`bw4-3-z`). 44×22'ye küçültme REDDEDİLDİ (yine): tam sayı olmayan ölçek piksel dilini bozar; yeniden çizim ayrı iş.
4. **#4 meşale** (geçerli): sprite 11×24 → 15×28: alev 7×13 (daha uzun, 3 kare dik/sola/sağa), alevi saran 1 px açık hale
   (earth3, uçta gold1), kâse 2 px daha geniş + bir sıra derin, 4 px perçinli duvar kayışı + belirgin yan kol (`bw4-4-z`, film `bw4-7-film`).
5. **#5 bayrak kontrastı** (geçerli): kumaşa 1 px aydınlık sol kenar (crim3), altın şerit gold1→gold2, V mührü gold2/3/4 (`bw4-5-z`).
   Bu bayrak sprite'ı yalnız v3 tuğla duvarda kullanılıyor.
6. **#6 duvar tekdüze** (geçerli): uzak alanda seyrek koyu (night0) ve aşınmış açık (stone1) tuğla varyantları; amblem sütunlarının
   iki yanında birer ızgaralı havalandırma + altında oyuncu renginde yanan gösterge (sol camgöbeği, sağ kızıl) (`bw4-6-z`).
7. **#7** sahne/zemin/mangal — bu maddenin dışı (sahne ve zemin maddelerine bırakıldı).
Son: `bw4-6.png`, `bw4-6-sbs.png`. typecheck temiz, palcheck PASS, vitest arena-nt + board-nt 34/34. v1: dokunulan her şey yalnız ARENA_NT v3 duvarında.
Kalan farklar: hedefin duvarı daha büyük, daha açık mor-gri taş bloklar; havuzlar hâlâ hedeften daha geniş/turuncu; amblem hedeften ~%20 büyük.

#### Zemin ve mangallar (2026-11-06)
Önce: `shots/arena/fl-0.png` (+ `fl-0-sbs.png`, yakın `fl-0-zl.png` / `fl-0-zr.png`, sissiz `fl-0-nofog.png`).
Tespit edilen farklar: (1) zemin navy lift ile night3/night4'e kalkmış parlak mavi, hedef koyu lacivert-arduvaz (night1/night2);
(2) zeminde hedefteki perçinli levhalar / ızgaralar / boru yok — yerine apron'a boyanmış eski raylar, bloklar, babalar ve
wall katmanının eski hatch/vent/cable blitter'ı (`FLOOR_PROPS`) ile `nt:hall:pipes` plakası; (3) mangallar ince demir direk
üstünde küçük kâse (82,212 / 566,222), hedefte ~27×44 taş kaide (kaide + gövde + başlık + altın ağızlı kâse) 141,~250 ve
514,~222'de; (4) mangal ışığı noktalı dither halesi, hedefte zemine yayılan sıcak turuncu havuz.
Yapılanlar (her adım ekran görüntüsüyle bakıldı):
1. Yeni `src/art/arena-nt/hallfloor.ts`: zemin deseni son renklerle (taban night2, derz night0, sol-üst kenarda 1 px night3
   dudak, seyrek çizik), 4 perçinli yükseltilmiş levha + 4 ızgara (1 px kalkık, ink alt kenar), yerde yatan borular (8 px kesit,
   dirsek, kızıl kelepçe, zemine giren flanş), mangal havuzları (3 basamak skin0/skin1/earth2, bant sınırında 4×4 dither — yalnız
   zeminde). `apron.ts` yalnız `panel()`'in taban rengini buradan alıyor; raylar/bloklar/babalar artık boyanmıyor (tanımlayıcıları
   testler ve gizli katman için duruyor); havuzlar sahnenin düşen gölgesini (stone0) de ısıtıyor (`warmPixel`). Gölge kodu değişmedi.
2. Apron `apron-v3` katman adıyla kaydediliyor (navy lift dışı, tuğla duvar gibi) → `fl-1`.
3. Eski zemin süsleri kaldırıldı: `wall.ts` `floorProp` blitter karelerini atlıyor, `backhall.ts` `HALL_PIPES = []` (`fl-3`).
4. Ton ayarı: taban night1 → night2, derz ink → night0 (hedefte derzler yumuşak), borular/levhalar bir ton koyu (`fl-4`, `fl-5`).
5. Mangal sprite'ı `paintBrazier` (28×52, 6 alev karesi: boy 12–15 nefes, uç salınımı, her iki karede yükselen kıvılcım):
   kaide stone1/stone0, gövde stone2/stone1 + her yüzde gömme panel içinde oyulmuş kanatlı-V, başlığın alt kenarında
   ateşten altın bant, altın ağızlı kâse + kor. `view/board-nt/lights.ts` direkli meşaleleri bu sprite ile çiziyor
   (dither halesi kapalı; ışık zemine pişmiş). Konumlar `BRAZIERS`: sol 141,284 (alev ≈141,252), sağ 540,260 — hedefin 514'ü
   bizim sahnenin sağ duvar köşesine biniyordu, 26 px sağa alındı (`fl-6` → `fl-7`).
6. Havuz çekirdeği kaidenin dışına taşacak kadar büyütüldü, borular havuzdan sonra boyanıyor (ısıtılınca tahta gibi okunuyordu),
   sol boru tek dirseğe sadeleşti, ızgara sağ havuzdan uzaklaştı (`fl-8`).
Son: `shots/arena/fl-8.png`, `fl-8-sbs.png`, `fl-8-zl.png`, `fl-8-zr.png`, alev filmi `fl-8-film.png`.
typecheck temiz, palcheck PASS (`fl-8.png`), vitest arena-nt platform/wall/screens 14/14. v1: dokunulan her şey yalnız ARENA_NT (v3) yolunda.
Kalan farklar: hedefin havuzu yumuşak hale, bizimki basamaklı (palet + dither kuralı); sol üst zemin (levha/ızgara) sis bankının
altında kaldığı için az okunuyor (sis maddesi); hedefteki duvara yükselen dikey borular yok; mangal alevinin çevresindeki ince
sıcak hale yok (dither halesi noktalı okunduğu için kapatıldı); sağ mangal hedeften 26 px sağda (sahne geometrisi farkı).

#### Zemin ve mangallar — eleştiri turu 1/3 düzeltmeleri (2026-11-06)
Önce: `shots/arena/fr1-0.png` (+ `fr1-0-sbs.png`, sissiz `fr1-0-nofog.png`, `fr1-0-zl-nofog.png`). Dosya: yalnız `src/art/arena-nt/hallfloor.ts`.
Sissiz görüntüler: `--eval` ile `arena-nt:lights` atlasının `fog*` kareleri gizlenerek çekildi (yalnız inceleme için).
0. Yarım kalmış önceki düzenleme `PIPES` dizisini bozmuştu (eski dizinin kuyruğu kalmıştı) → onarıldı, typecheck temiz.
1. **#1 zeminde yoğun ekran-kapısı dither** — REDDEDİLDİ (bu maddenin dışı): zemin dokusunun kendisinde dither yok (`fr1-3-nofog.png`
   temiz düz levhalar). Görülen yoğun dither, `view/board-nt/lights.ts`'teki sis atlasının (`fogFront`/`fogBack`/`fogWisp`) koyu
   sıralı-dither bankaları; zeminin neredeyse tamamını (sol 0–240, sağ 400–640) örtüyor ve hedefin açık-gri yumuşak sisi gibi değil
   koyu leke gibi okunuyor. Sis maddesine bildirildi; sise dokunmadım (sahibi başka, sahip sisi çok seviyor).
2. **#2 levha/ızgara okunmuyor** (geçerli): levhalar ~1.5× (hw 24–32), üst yüz zeminden bir ton açık (night3), uzak kenarlar night4,
   yakın kenar 1 px + 2 px ink yan; ızgara açık çerçeve içinde koyu yarıklar + aydınlık çubuk. Havuza düşen levha (106,262; ısınınca
   "paspas" gibi okunuyordu) 72,236'ya, ızgarayı kesen sol boru yukarı (y 185) alındı (`fr1-7-zl.png`).
3. **#3 borular ince** (geçerli): 8 px kesit (ink / night4 parlak bant / gövde / night1-night0 gölge bandı / ink), kızıl kelepçeler
   büyüdü, HUD ve el altından çıkarıldı; iki dikey yükselen boru (sol hologram kaidesine, sağ duvara doğru) eklendi (`fr1-9-nofog.png`).
4. **#4 sağ mangal** (geçerli): 540,260 → 522,248 (hedef 514,222'ye ~18 px yaklaştı; sahnenin sağ köşesine yaslanıyor, hedefteki gibi).
   Daha yukarısı sahne duvarının içine giriyordu (`fr1-8-zr.png`).
5. **#5 havuz** (geçerli): 3 temiz basamak (dış skin0 sıcak koyu / orta skin1 amber / kaide dibinde earth3 parlak halka), basamak
   sınırı dither'ı 0.08 → 0.04 (dar), basamaklar 1 / 0.6 / 0.38 (`fr1-5-pool.png`). Sahne gölgesi (stone0) artık havuz içinde açık
   zeminle aynı ısıtılıyor → havuzu kesen düz koyu kenar ("dikdörtgen yama") kalktı; sağ mangal gölgeye yakın olduğu için bu şart.
6. **#6 alev küçük, hale yok** (geçerli): alev boyu 14–17, karın genişliği 9 px; alevin silüetini saran 2 kademeli palet halesi
   (fire1 bitişik, fire0 bir dış halka; kâse ve taşın üstüne binmez), alev kareleriyle birlikte hareket ediyor — noktalı halka değil (`fr1-4-flame.png`).
7. **#7 zemin tonu** — REDDEDİLDİ: hedef zemin örnekleri #1f2044 / #202347 (640×360'a ölçeklenmiş); bizim taban night2 #1b2352 en yakın
   palet tonu, bir üst ton night3 #28356f belirgin daha açık-mavi. Derzler zaten 1 px (üst kenar night3 dudak, alt kenar night0).
   "Daha mavi/koyu" algısı üstteki koyu sis dither'ından geliyor (bkz. 1).
Son: `shots/arena/fr1-9.png`, `fr1-9-sbs.png`, sissiz `fr1-9-nofog.png`; yakınlar `fr1-5-pool.png`, `fr1-7-zl.png`, `fr1-8-zr.png`, film `fr1-4-flame.png`.
typecheck temiz, palcheck PASS (`fr1-9.png`), vitest arena-nt/board-nt geçti (5 başarısız test canavar/kart dosyalarında, bu işle ilgisiz).
v1: değişiklik yalnız `hallfloor.ts` (yalnız v3 zemin/mangal yolu).
Kalan farklar: sis açıkken zemin detayı (levha, ızgara, boru) koyu sis dither'ı altında kayboluyor — sis maddesi; sahnenin L-çentiği
ve geniş düşen gölgesi sol zemini boş gösteriyor — sahne/podyum maddesi; havuz hedefin yumuşak halesine göre hâlâ basamaklı.

#### Zemin ve mangallar — eleştiri turu 2/3 düzeltmeleri (2026-11-06)
Önce: `shots/arena/fr2-0.png` (+ `fr2-0-sbs.png`, sissiz `fr2-0-nofog.png`; hedef yakınları `fr2-tgt-l.png`, `fr2-tgt-r.png`). Dosya: yalnız `src/art/arena-nt/hallfloor.ts`.
1. **#4 sağ mangal** (geçerli): kaide 3 px yukarı (522,248 → 522,245); sahne duvarına girmiyor (`fr2-1-zr.png`).
2. **#3 havuz düz** (geçerli): havuz bir basamak genişledi — 1.36×rx'te soluk dış basamak (zemin night2 → stone1, gölge stone0 → stone1:
   ışığın arduvaz üstünde sönen gri-sıcak ucu); dither sınırı yine dar (0.04). Havuz artık 4 basamaklı, hedefteki yumuşak geniş haleye
   daha yakın (`fr2-2-zl.png`, `fr2-2-zr.png`).
3. **#2 levha/ızgara az** (geçerli, kısmen): ipucu çubuğunun ve sahne gölgesinin altında hiç görünmeyen ızgara (446,272) kaldırıldı,
   sol mangal ile HUD arasına yeni levha (40,282). Denenen iki ek parça (470,292 ızgara; 506,318 levha) sahne gölgesi / SAVAŞ düğmesi
   altında kaldığı için geri alındı (`fr2-3-nofog.png`).
4. **#2 parlak kenarlar** (geçerli): levha/ızgaraların ışığa bakan sol-üst kenarı night4 → steel, sağ-üst night4; perçin başları steel → mist.
   Levhalar sissiz görüntüde açıkça okunuyor (`fr2-4-nofog.png`).
5. **#1 koyu sis bankaları / siyah kamalar** — REDDEDİLDİ (bu maddenin dışı): sissiz görüntüde zemin temiz (`fr2-5-nofog.png`); kara leke
   ve ekran-kapısı dither `view/board-nt/lights.ts` sis atlasından geliyor (sis maddesi). Derz kontrastını artırmak sis altında yine
   görünmez, sissiz hedefe göre de fazla sert olurdu — derzler olduğu gibi kaldı.
6. **#2 sahne tabanı ve arka duvar boyunca borular** — REDDEDİLDİ: sahne tabanı (sahne maddesi) ve arka duvar (duvar maddesi) bu maddenin
   dosyaları değil; zemindeki dört boru (iki yükselen dahil) duruyor.
7. **#7 L-çentik / geniş gölge / sis dither** — kapsam dışı (sahne ve sis maddeleri), bildirildi.
Son: `shots/arena/fr2-5.png`, `fr2-5-sbs.png`, sissiz `fr2-5-nofog.png`. typecheck temiz, palcheck PASS (`fr2-5.png`).
v1: board-nt/arena-nt yalnız v3 yolu; değişiklik yalnız `hallfloor.ts`.
Kalan farklar: sis açıkken zeminin büyük kısmı koyu dither sisi altında (sis maddesi); hedef levhalar zeminden koyu + ince aydınlık kenarlı,
bizimkiler bir ton açık; hedefte sahne tabanı/duvar boruları var.

#### Zemin ve mangallar — eleştiri turu 3/3 düzeltmeleri (2026-11-06)
Önce: `shots/arena/fr3-0.png` (+ `fr3-0-sbs.png`, sol zemin yakını `fr3-0-zl.png`). Dosya: yalnız `src/art/arena-nt/hallfloor.ts`.
1. **#1 zemin tek düz lacivert** (geçerli): her üç döşemeden biri bir palet basamağı koyu (night1, düz, dither yok) → zemin orta-ton
   çeşitlemesi kazandı (`fr3-1-sbs.png`).
2. **#1 levhalar okunmuyor** (geçerli): levha üstü artık zeminden bir basamak KOYU (night1, hedefteki koyu çelik gibi), ışığa bakan
   sol-üst kenar steel / sağ-üst night4 kaldı; levhayı iso eksende ikiye bölen 1 px derz (night0 + night3 alt dudak). Koyu levha +
   aydınlık kenar sis altında da okunuyor (`fr3-2-zl.png`, `fr3-2-sbs.png`).
3. **#4 havuzun dış basamağı gürültülü** (geçerli): en dış soluk basamağın dither sınırı kaldırıldı (tek palet tonu, temiz kenar);
   iç basamaklarda dar dither kaldı (`fr3-3-pool.png`). Kalan noktalı doku sis atlasından (sis maddesi).
4. **#1 yeni parçalar** — KISMEN REDDEDİLDİ: sol bant (x0–140, y190–280) zaten bir ızgara + üç levha taşıyor; sorun sayıları değil
   okunurluklarıydı (2. adımla çözüldü). 58,198 ızgarası sahne gölgesi + koyu sis bankası altında (sis/sahne maddesi). Alt orta
   (x230–330, y320–350) tamamen el kartlarının altında → oraya parça koymak görünmez.
5. **#3 sol mangal konumu** — REDDEDİLDİ: hedefte alev ≈137,252, bizde ≈141,249 (640×360); fark ≤4 px, kural gereği taşınmadı.
6. **#2 sahne tabanı / arka duvar boruları**, **#5 L-çentik ve geniş gölge** — kapsam dışı (sahne ve duvar maddeleri), tekrar bildirildi.
Son: `shots/arena/fr3-3.png`, `fr3-3-sbs.png`, `fr3-3-pool.png`. typecheck temiz, palcheck PASS (`fr3-3.png`),
vitest arena-nt + board-nt 34/34. v1: değişiklik yalnız v3 zemin dokusunda (`hallfloor.ts`).
Kalan farklar: hedef zemin daha gri-mor ve sisle benekli; sol üst zeminin bir kısmı koyu sis dither'ı altında (sis maddesi);
hedefteki sahne tabanı/duvar boruları yok (sahne/duvar maddeleri).

#### Sis — v3 kümülüs sis şeritleri (2026-11-06)
Önce: `shots/arena/fog-0.png` (+ `fog-0-sbs.png`, yakın `fog-0-zl.png` / `fog-0-zr.png`, sissiz `fog-0-nofog.png`).
Boşluklar: sis zeminden KOYU (night0/ink) → kara leke gibi; tüm alanı ekran-kapısı Bayer dither'ı; hologram kaidelerini/zemini
geniş kaplıyor. Hedef: zeminden bir basamak AÇIK, gri-mor, kenarı basamaklı kümülüs şeritleri, açık tepe, dither yok.
Dosyalar: `src/art/arena-nt/lights.ts` (yeni `FOG_BANKS` + `paintFogBank`, `lightFrame.fogBank`), `src/view/board-nt/lights.ts`
(eski fogBack/Front/Wisp yerleşimi yerine 12 şerit).
1. Şerit boyacısı: üst üste binen basık puflar (arkadan öne), gövde night3, pufun sol-üst kapağı geniş stone1 bandı, en üst
   1 px kenar stone2 (ışığa bakan kenar), puflar arası night2 dikiş, alt kenar düz-mercek ve yer yer 1 px kopuk; dither YOK,
   saf palet, opak (`fog-1.png` → `fog-2.png` → `fog-4.png`). İlk deneme 1 px stone1 çizgi kontur gibi okundu → geniş kapak
   bandına çevrildi; stone1 tek başına gölge gibi okundu → stone2 tepe kenarı eklendi.
2. Yerleşim: sol 5 / sağ 7 şerit, zemin kenarlarında, sahne derinliğinin altında (`platform − 0.18`, tahtanın üstüne asla
   çıkmaz), mangal havuzlarının dışında; kaide-arkası (holo üstü) sis kaldırıldı → hologramlar temiz.
3. Salınım: her şerit kendi periyodunda (11–22 s) ±5–10 px yatay, ±0–1 px dikey sinüs (sinüs → döngü dikişi yok);
   büyük şeritler yavaş, ince tüller hızlı → katmanlar birbirinin üstünden kayıyor (`fog-3-film-r.png`, 8 kare × 2.5 s).
Son: `shots/arena/fog-5.png`, `fog-4-sbs.png`, `fog-4-zl.png`, `fog-4-zr.png`. typecheck temiz, palcheck PASS (`fog-5.png`).
v1: board-nt / arena-nt yalnız v3 yolunda. (Eski fogBack/Front/Wisp kareleri atlasta duruyor ama kullanılmıyor.)
Kalan farklar: hedef sis daha yoğun/geniş ve daha yumuşak (çok basamaklı gri-mor geçiş); paletimizde 2a2f54/393e66 yok → gövde
night3 biraz mavi, kapak stone1 biraz gri; sağdaki aynalanmış şeritlerde aydınlık kapak sağ-üstte kalıyor.

#### Sis — eleştiri turu 1/3 düzeltmeleri (2026-11-06)
Önce: `shots/arena/fogc1-0.png` (+ `fogc1-0-sbs.png`, yakın `fogc1-0-zl.png` / `fogc1-0-zr.png`). Dosyalar: `src/art/arena-nt/lights.ts`
(`FOG_BANKS`, `paintFogBank`), `src/view/board-nt/lights.ts` (yerleşim).
1. **#5 eski kareler** (geçerli): fogBack/fogFront/fogWisp kareleri, `Lobe`/`sampleLobes` ve boyacıları atlastan silindi.
2. **#1 gri-kahve bulut kesikleri** (geçerli): tek soğuk aile — gövde night3, ışığa bakan sol-üst kapak ince night4 bandı (2–3 px),
   alt ayak ve puf dikişleri night2 (zemine eriyor); geniş stone1 kapak kaldırıldı. En büyük kabarıkların tepesinde yalnız 1 px stone2
   parıltı (`fogc1-1` → `fogc1-2` → `fogc1-3`). Kapak yalnız altında ≥3 px puf olan yerde → tek piksellik kapak "iğneleri" yok.
3. **#2 seyrek/ince** (geçerli): 1–3 üst üste puf sırası (bankalar kubbeleniyor) + arkada 5 büyük koyu arka banka (night3 gövde, night2
   ayak, kapaksız, dış kenarı 1 px tahta-dışı dama sönümü); sol ejderha kaidesinin dibine bir arka + bir ön banka (`fogc1-4-zl.png`).
   Toplam 16 banka.
4. **#3 damga elipsler** (geçerli): puf yarıçapı k² dağılımlı, aralık 0.55–1.6×rx, her pufun basıklığı ±%15; uçlar 1–2 px gövde tonunda
   kesik kuyruklara sivriliyor; puf-başı night2 alt bantları (pul deseni yapıyordu, `fogc1-1-z4.png`) bankanın tek alt satırına indi.
5. **#4 aynalı sağ şeritler** (geçerli): flipX kaldırıldı; her yerleşimin kendi pişmiş bankası var → tüm kapaklar sol-üstte.
6. Salınım: arka bankalar 23–27 s / ±6–7 px, ön bankalar 12–21 s / ±7–12 px (sinüs → dikiş yok); film `fogc1-4-film-r.png`
   (8 kare × 2.5 s) katmanların birbirinin üstünden kaydığını gösteriyor. Sağ banka 7 mangal havuzuna değdiği için 10 px sağa alındı.
Son: `shots/arena/fogc1-5.png`, `fogc1-5-sbs.png`, `fogc1-5-zr.png`, `fogc1-4-zl.png`. typecheck temiz, palcheck PASS (`fogc1-5.png`).
v1: değişiklik yalnız v3 yolundaki board-nt sis atlas karelerinde.
Kalan farklar: hedef sis daha açık/gri-mor (2a2a48 / 37406b) — paletimizde en yakın night3/night4 biraz mavi; zeminimiz hedeften
mavi olduğundan sis/zemin ayrımı hedeften az (zemin maddesi). a6Hover kart önizlemesi sol sisi filmde örtüyor (sol film sağdan kontrol edildi).

#### Sis — eleştiri turu 2/3 düzeltmeleri (2026-11-06)
Önce: `shots/arena/fogc2-0.png` (+ `fogc2-0-sbs.png`, yakın `fogc2-0-zr.png`). Dosyalar: `src/art/arena-nt/lights.ts`
(`FOG_BANKS`, `paintFogBank`), `src/view/board-nt/lights.ts` (yerleşim). (Not: shot.mjs 1280×720 PNG veriyor; karşılaştırmalar 640×360'a NN küçültülerek.)
1. **#1/#2 görünmüyor / zeminle ton ayrımı yok** (geçerli): ön bankalar bir basamak açıldı — gövde night4, ışık kapağı stone2 (gri-mor),
   en parlak kabarık tepesi 1 px stone3, ayak/puf dikişi night3 (eskiden night3/night4/night2). Arka bankalar: night3 gövde + her
   kabarığın tepesinde 2 px night4 kenar, ayak night2 → arka katman da zeminden okunuyor, ön katmandan koyu kalıyor (`fogc2-1.png`,
   `fogc2-1-zr.png`, `fogc2-1-zl.png`). Paletimizde hedefin 2a2a48/37406b'sine tam karşılık yok; mor (void) aile fazla doygun,
   stone1 night3 zeminle aynı parlaklıkta → night4 + stone2 kapak seçildi.
2. **#3 sahne eteği ve heykel kaideleri boş** (geçerli): 5 yeni banka (toplam 21): sol etek (50,206), ön etek (190,262), sağ-ön etek
   (408,258), sağ hologram kaidesinin dibine bir arka (494,132) + bir ön (540,148); hepsi platform derinliğinin altında, karolara değmiyor
   (`fogc2-2.png`, `fogc2-2-zb.png`, `fogc2-2-zr.png`).
3. **#4 tüylü/benekli kenarlar** (geçerli): uç tüllerdeki rastgele 1 px boşluklar kaldırıldı → kuyruk %70'te temiz bitiyor; dama sönümü
   zaten yalnız arka bankaların en dış satırında (`fogc2-3.png`, `fogc2-3-zl.png`).
4. **#5 kayma doğrulanmadı** (geçerli): film `fogc2-3-film-r.png` (8 kare × 2.5 s, sağ kenar): katmanlar farklı periyotlarla birbirinin
   üstünden kayıyor, sinüs → döngü dikişi yok.
5. **#6 farklı sahne** — bilgi; değişiklik gerekmez.
Son: `shots/arena/fogc2-3.png`, `fogc2-3-sbs.png`, `fogc2-3-zl.png`, `fogc2-2-zr.png`, film `fogc2-3-film-r.png`. typecheck temiz, palcheck PASS.
v1: değişiklik yalnız v3 yolundaki board-nt sis atlas kareleri/yerleşiminde.
Kalan farklar: sis hedeften daha mavi (zemin de hedeften mavi ve açık: zemin maddesi); hedefte sis daha yumuşak çok basamaklı;
ön etek bankasının çoğu ipucu çubuğu / el kartlarının altında kalıyor.

#### Sis — eleştiri turu 3/3 düzeltmeleri (2026-11-06)
Önce: `shots/arena/fogc3-0.png` (+ `fogc3-0-sbs.png`). Dosya: `src/art/arena-nt/lights.ts` (`FOG_BANKS`, `paintFogBank`).
1. **#1 doygun kobalt mavisi** (geçerli): mavi night3/night4 gövde → düşük doygunluklu gri-mor. Ön bankalar: gövde stone1, ışık kenarı
   1 px stone2 + altında stone1/stone2 dama geçiş satırı, alt ayak night2, ayakla gövde arası night2/stone1 dama, puf dikişi night2,
   uç tüller stone1. Arka bankalar: gövde night2/stone1 dama (≈ #2a2d4c ~ hedef 282949), kabarık kenarı stone1, ayak night2
   (`fogc3-1.png`, `fogc3-1-sbs.png`, `fogc3-1-zl.png`).
2. **#2 düz levha / sert kapak** (geçerli): ön bankalar alçaltıldı ve inceltildi (squash ×0.72, en çok 2 sıra → ~4–9 px), yanlarda
   en dış sütun night2/stone1 dama sönümü → pürüzlü tüllü uçlar; alt tarafta 3 basamak (gövde → dama → night2) (`fogc3-2.png`,
   `fogc3-2-zl.png`, `fogc3-2-sbs.png`).
3. **#3 kahverengi kapaklar** (geçerli): mavi gövde gitti → stone2 kenar artık aynı gri-mor ailenin bir basamağı; geniş stone2/stone3
   kapak ve stone3 parıltısı kaldırıldı.
4. **#4 kapsama** — reddedildi/değişiklik yok: eleştirmen sağ kaide bankasını kabul ediyor; etek bankalarının HUD altında kalması
   HUD yerleşimi değişmeden çözülemez.
5. **#5 kayma** — film `fogc3-2-film-r.png` (8 kare × 2.5 s, sağ kenar): yavaş kayma, dikiş/patlama yok.
Son: `shots/arena/fogc3-2.png`, `fogc3-2-sbs.png`, `fogc3-2-zl.png`, `fogc3-2-film-r.png`. typecheck temiz, palcheck PASS,
arena testleri 34/34. v1: değişiklik yalnız v3 board-nt sis atlas karelerinde.
Kalan farklar: zemin hedeften mavi/açık (zemin maddesi) → sis/zemin ayrımı hâlâ hedeften keskin; hedefte sis biraz daha mor (3a3f67),
bizim stone1 gövde biraz daha nötr; ön etek bankası büyük ölçüde ipucu çubuğu / el kartları altında.

#### Piksel uyumu + son cila (2026-11-06)
Önce: `shots/arena/pix-0.png` (+ `pix-0-sbs.png`, palet dışı maske `pix-0-mask.png`, birim yakın `pix-0-units.png`). palcheck PASS ama
kare %6.62 palet dışı. Maske: anahtar ışık, sis, meşale haleleri, zemin gölgesi zaten palet (eski rgba katmanları kapalı / ölü kod);
kalan palet dışı = (a) birim temas + düşen gölgeleri (rgba radyal gradyan), (b) hologramlar (alfa 0.72 yaratık, 0.55 kaide, 0.38 halka,
0.28 koni, 0.32 toz), (c) bizim olmayan: el kartı, yığın sayaç etiketi (#04050d), golem üstü hover parıltısı.
1. **Birim gölgeleri** (`src/view/light/LightLayer.ts` `StepUnitShadow`, `src/view/light/stepped.ts` `stepImgRev`): gradyan dokular
   yerine sert kenarlı basamaklı gölge — altındaki her pikseli (sahne taşı, karo zemini, karo çizgisi, birimin ışık koltuğu) kendi
   PAL rampasında 1 (dış bant + sağ-aşağı düşen gölge) / 2 (temas çekirdeği) ton aşağı çizer; opak, tam piksel, dither yok. Yalnız
   konum ya da alttaki görüntüler değişince yeniden hesaplanır. `pix-1-units.png`: kırmızı çizgi gölge altında crim1'e iniyor.
2. **Hologramlar** (`src/view/board-nt/holograms.ts`): yaratık/yırtık/kaide/halka/toz/flaş alfa → 1; tarama satırı boşlukları zaten
   saydamlık hissini veriyor, hologramlar daha parlak (`pix-2-holoL.png`). Off %6.0 → %0.77 → %0.11.
3. **Koni** (`src/art/arena-nt/holo.ts` `paintCone`): opak çizilince Bayer dama noktalı saçak (`pix-3-holoR.png`), 1 px ışınlar
   zeminde koyu çubuk (`pix-4-holoR`, `pix-5-holos`) gibi okundu → kare boş bırakıldı (atlas düzeni aynı). Geri alınan iki deneme.
4. **Değer dengesi — zemin** (`src/art/arena-nt/hallfloor.ts`): açık zemin bir basamak koyu (BASE night2→night1, dudak night3→night2,
   aşınmış taş/çizik night1→night0); hedef zemini ≈ #1c1c3c night1'e daha yakın. Tahta artık açıkça en parlak kütle (`pix-7-cmp.png`).
5. **Arka zemin şeridi** (`src/view/board-nt/wall.ts`): duvar ile apron arası (y 96…150) yükseltilmiş lacivert karo yerine aynı
   hallfloor taşı (`nt:hall:backfloor`, kaldırma yok) → hologramların arkasındaki parlak mavi bant ve y=150 dikişi gitti (`pix-8-zl.png`).
Son: `shots/arena/pix-8.png`, `pix-8-sbs.png`, `pix-8-zl.png`, film `pix-8-film.png`. palcheck `pix-8.png` PASS, off %0.11 (kalan yalnız
UI/kart/hover). typecheck temiz, vitest tests/view 20/20. v1: board-nt + stepped ışık yalnız LOOK_V3 yolunda.
Kalan farklar: hedefin tahta üstü sıcak gri (≈706b66), bizim stone2 serin ve bir ton koyu (paletde sıcak gri yok); hedef duvarı biraz
daha açık/sıcak; hologram kaideleri hedefte açık gri-mavi halka, bizde koyu lacivert; yaz flaş/hot/beam kareleri artık opak (çağırma
anında daha sert görünebilir, filmde doğrulanmadı).

#### Piksel uyumu + cila — eleştiri turu 1/3 (2026-11-06)
Önce: `shots/arena/pixr1-0.png` (+ yakın `pixr1-0-holoL.png`). Eleştirmen kararı "hedefe uyuyor", yalnız minörler.
1. **#5 hologram kaidesi** (geçerli, yapıldı): `src/art/arena-nt/holo.ts` `paintPed` — üst halka night3/night4 → açık gri-mavi metal:
   dış bant stone3, sol-üst ışıklı yay mist, iç eğim stone2 (sonra night1/night0 yüz), silindirin üst 2 satırı night4/night3 →
   stone2/stone1. Kaide artık sisin önünde okunuyor (`pixr1-1-holoL.png`, `pixr1-1.png`, `pixr1-1-sbs.png`). Yalnız v3 (board-nt).
2. **#1 L çentiği / #2 köşe pahları** — reddedildi (bu maddenin kapsamı değil): sahne ayak izi ve kürsü `platform.ts`/sahne maddesinin;
   aynı anda başka ajanın dosyası, piksel/cila geçişinde blok geometrisi değiştirilmedi. Sahne maddesine devredildi.
3. **#3 tahta üstü sıcak gri** — değişiklik yok: eleştirmen de kabul ediyor, palette sıcak gri yok (stone2 en yakın basamak).
4. **#4 sis kapsamı** — değişiklik yok: sis maddesinin (fogc3) işi; bu turda yeni bank eklemek o maddenin dengesini bozar.
5. **#6 tuğla bir ton açık** — değişiklik yok (isteğe bağlı): tuğla tonları meşale ışığına bağlı bant tablosu (`brickwall.ts`),
   tek ton kaldırma duvarın sıcak/sakin dengesini sahne genelinde değiştirir; duvar maddesine bırakıldı.
Son: `shots/arena/pixr1-1.png`, `pixr1-1-sbs.png`. palcheck PASS, typecheck temiz.

#### Piksel uyumu + cila — eleştiri turu 2/3 (2026-11-06)
Önce: `shots/arena/pixr2-0.png` (+ `pixr2-0-sbs.png`, tahta yakın `pixr2-0-zb.png`, tahta yan yana `pixr2-0-board.png`).
1. **#2 tahta üstü koyu** (kısmen geçerli, yapıldı): ölçüm — karo/levha zaten stone2 (#5d5c6e ≈ hedef #594a53…#6d605e); koyuluğu
   veren, tahtanın ~%40'ını kaplayan stone1 anahtar-ışık bandıydı (P2 yarısı en koyu). `src/art/arena-nt/platform.ts` `KEY_BAND`
   +70 → stone1 yalnız ön-sağ köşede kalır, tahta açıkça en parlak kütle (`pixr2-1.png`, `pixr2-1-sbs.png`). stone3'e yükseltmek
   reddedildi: hedeften çok açık olurdu; palette sıcak gri yok. Düz, dither yok.
2. **#3 sis dama saçağı + yoğunluk** (geçerli, yapıldı): `src/art/arena-nt/lights.ts` `paintFogBank` — arka bankların night2/stone1
   dama gövdesi ve dama dış halkası, ön bankaların stone1/stone2 geçiş satırı, ayak ve yan sütun damaları kaldırıldı → düz bantlar
   (gövde stone1, 1 px night2 dış basamak, 2 px night2 ayak) (`pixr2-2-fogL.png`; arka gövde önce stone1/night2 ikiye bölündü, mavi
   kütle okununca tek stone1 gövdeye çevrildi: `pixr2-3.png`, `pixr2-3-sbs.png`). `src/view/board-nt/lights.ts` `BANKS`: sol-alt
   (-118, 222) ve sağ-alt (512, 236) iki geniş, yavaş (28–29 s) arka bank (`pixr2-4.png`, konum düzeltmesi `pixr2-5.png`,
   önce/sonra `pixr2-5-cmp.png`). Hepsi sahne derinliğinin altında, tahtanın üstüne çıkmaz.
3. **#4 tuğla bir ton açık** (geçerli, yapıldı): `src/art/arena-nt/brickwall.ts` `BRICK[0]` uzak alan stone0/night1 → stone1/stone0
   (ölçüm: bizim ≈ #1b1721, hedef ≈ #393347); seyrek ton tuğlaları night0/stone1 → night1/stone2. Meşale havuzu bantları aynı
   (zaten sıcak, hedefle eşleşiyor) (`pixr2-6.png`, `pixr2-6-sbs.png`, `pixr2-6-wall.png`).
4. **#1 L çentiği / köşe pahları** — reddedildi (kapsam dışı, 1. turdaki gibi): sahne ayak izi ve kürsü geometrisi sahne maddesinin
   (`platform.ts` blok/kürsü); piksel/cila geçişi blok geometrisini değiştirmez. Sahne maddesine devredildi.
5. **#5 kaide dither iç dolgu / #6 mangal havuzu / #7 yan duvarlar** — bilgi, değişiklik yok.
Son: `shots/arena/pixr2-6.png`, `pixr2-6-sbs.png`, film `pixr2-6-film.png` (8 × 2.5 s: sis yavaş kayıyor, dikiş yok). palcheck PASS,
typecheck temiz, vitest tests/view 20/20 (tüm takımdaki 5 hata kart/canavar dosyalarında, bizim değil). v1: yalnız arena-nt / board-nt
(LOOK_V3 yolu).
Kalan farklar: sahne L çentiği ve pahlar (sahne maddesi); tahta hedeften serin (sıcak gri yok); ön etek sisinin çoğu HUD altında.

#### Piksel uyumu + cila — eleştiri turu 3/3 (2026-11-06)
Önce: `shots/arena/pixr3-0.png` (+ `pixr3-0-sbs.png`, sol-alt yakın `pixr3-0-zl.png`).
1. **#1 L çentiği** (geçerli, yapıldı — iki turdur devredilmişti, sahne maddesi kapandığı için burada çözüldü): `src/view/board-nt/layout-nt.ts`
   `PLATE_R1` 5.0625 → 6.0 (yakın-sol kenar 30 px dışarı), anahat köşeleri `ntGrid(118, 187)` ve yakın düz kenar 268..364; `PLATE_CORNERS`
   güncel. P1 kürsüsü artık sahnenin ÜSTÜNDE: `src/art/arena-nt/pads.ts` `paintBase` taban tamamen sahne içindeyse çıkıntı bloğu çizmez
   (yalnız kürsü + ışık havuzu). Sahne tek dışbükey sekizgen, sol kapak 137..187. Tam simetrik büyütme (uzak-sağ kenar da) REDDEDİLDİ:
   uzak uç y≈35'e çıkıp portre ekranlarının, sol/sağ uçlar hologram kaidelerinin üstüne biniyordu (kamera/karolar sabit); P2 çıkıntısı
   uzak kenarın arkasında kaldığı için çentik okunmuyor. Testler yeni geometriye: `tests/view/board-nt-layout.test.ts` (P1 kürsüsünün 4
   ucu sahnede, P2 ön ucu kenarda), `tests/art/arena-nt-platform.test.ts` (sol duvar y = 187 + (x − 118)/2). (`pixr3-1.png`, `pixr3-1-zl.png`)
2. **#2 tahta sıcak gri** — değişiklik yok: palette sıcak gri yok (stone2 en yakın; önceki turlarda ölçüldü).
3. **#4 sütun kabartması** (geçerli, yapıldı): `src/art/arena-nt/brickwall.ts` `paintPillarAt` — ışıksız sütun gövdesi stone1 → stone2,
   gölge stone0 → stone1, sol ışıklı kenar stone2 → stone3 ve 1 px kesintisiz (sıra derzleri artık kesmiyor), gövdedeki derzler ink yerine
   gölge tonu. Sütunlar hedefteki gibi tuğladan açık gri kütle (`pixr3-2-wall.png`, `pixr3-3.png`, `pixr3-3-sbs.png`).
4. **#3 alt kenar sisi** (geçerli, yapıldı): `src/view/board-nt/lights.ts` `BANKS` — sol-alt (46, 236) ve sağ-alt (470, 262) birer ön
   bank daha (yavaş, 20–22 s), sahne derinliğinin altında (`pixr3-4.png`).
5. **#5** bilgi, değişiklik yok.
Son: `shots/arena/pixr3-4.png`. palcheck PASS, typecheck temiz, arena testleri 34/34. v1: değişiklikler yalnız board-nt / arena-nt (v3).
Kalan farklar: tahta hedeften serin; sol kapak uzun (30 px'lik çıkıntıyı yutmak için); kamera sabit olduğundan hedefteki geniş sahne
payları yalnız P1 tarafında; P2 kürsüsü hâlâ uzak kenarın arkasında (hedefte sahnenin üstünde).

#### Arena geçişi kapıları (2026-11-06)
Hiçbir düzeltme gerekmedi; tüm kapılar ilk koşuda yeşil. Kod değişikliği yok.
| Kapı | Sonuç |
|---|---|
| `npm run typecheck` | temiz |
| `npx vitest run` | 1451/1456; 5 hata hepsi bilinen listede (cardface-v3 G1, dusk_ashen, hourglass_imp, shield_titan, crag_axeman ses); cloud_hatchling bu koşuda geçti; arena geometri testleri geçti |
| filmdiff v1 | 17/17 IDENTICAL |
| filmdiff a6v1 | 26/26 IDENTICAL |
| palcheck `shots/arena/gates.png` (a6Hover v3) | PASS (off 0.11 %, white 0.89 %, bands 0) |
| kamera kapısı (`shots/arena/now.json` vs `shots/kart-a/camera-base.json`) | 15 ok, 0 FAIL; measure errors 0 |
| sayfa hataları (a6Hover, spBolt, flowTurnP1, tbMirror; v3) | yok |
