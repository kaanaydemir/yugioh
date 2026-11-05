from PIL import Image, ImageDraw, ImageFont
import numpy as np, colorsys, sys
P=4  # pixel size
def pixtext(text, size, fill, outline, font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', shadow=None):
    f=ImageFont.truetype(font,size)
    bb=f.getbbox(text); w,h=bb[2]-bb[0]+4,bb[3]-bb[1]+4
    m=Image.new('L',(w,h),0); d=ImageDraw.Draw(m); d.fontmode='1'
    d.text((2-bb[0],2-bb[1]),text,font=f,fill=255)
    a=np.array(m)>0
    H,W=a.shape; out=np.zeros((H+2,W+2,4),np.uint8)
    # outline (8-neighbour)
    pad=np.pad(a,1); o=np.zeros_like(pad)
    for dy in (-1,0,1):
        for dx in (-1,0,1): o|=np.roll(np.roll(pad,dy,0),dx,1)
    out[o]=outline+(255,)
    if shadow:
        sh=np.zeros_like(pad); sh[1:, :]=pad[:-1,:]
        out[sh & ~pad]=shadow+(255,)
    # fill with 2-tone band (top lighter)
    ys=np.arange(pad.shape[0])[:,None]
    top=fill[0]; bot=fill[1]
    for c in range(3):
        ch=np.where(ys< pad.shape[0]*0.55, top[c], bot[c])
        out[...,c]=np.where(pad,ch,out[...,c])
    out[pad,3]=255
    img=Image.fromarray(out,'RGBA')
    return img.resize((img.width*P,img.height*P),Image.NEAREST)
STAR=["....#....","...###...","...###...","#########",".#######.","..#####..","..##.##..",".##...##.","#.......#"]
def star():
    h,w=len(STAR),len(STAR[0]); a=np.zeros((h+2,w+2,4),np.uint8)
    for y,r in enumerate(STAR):
        for x,c in enumerate(r):
            if c=='#':
                for dy in(-1,0,1):
                    for dx in(-1,0,1):
                        if a[y+1+dy,x+1+dx,3]==0: a[y+1+dy,x+1+dx]=(70,35,5,255)
    for y,r in enumerate(STAR):
        for x,c in enumerate(r):
            if c=='#': a[y+1,x+1]=(255,236,140,255) if y<4 else (240,170,40,255)
    a[2,5]=(255,255,230,255)
    img=Image.fromarray(a,'RGBA'); return img.resize((img.width*P,img.height*P),Image.NEAREST)
def paste_c(card,img,cx,cy): card.alpha_composite(img,(int(cx-img.width/2),int(cy-img.height/2)))
def make(art_path, frame_hue_shift, name, sym, level, race, flav, atk, dfn, out):
    f=Image.open('cerceve-uzun.png').convert('RGBA')
    if frame_hue_shift:
        a=np.asarray(f).astype(float)/255; rgb=a[...,:3]
        H,S,V=np.vectorize(colorsys.rgb_to_hsv,otypes=[float]*3)(rgb[...,0],rgb[...,1],rgb[...,2])
        H=np.where((H>0.4)&(H<0.62)&(S>0.2),H+frame_hue_shift,H)
        r,g,b=np.vectorize(colorsys.hsv_to_rgb,otypes=[float]*3)(H,S,V)
        f=Image.fromarray((np.dstack([r,g,b,a[...,3]])*255).astype('uint8'))
    art=Image.open(art_path).convert('RGBA')
    if art.height>art.width*1.2: art=art.crop((52,192,1034,980))
    wx0,wy0,wx1,wy1=52,192,1034,1055; aw,ah=wx1-wx0,wy1-wy0
    s=max(aw/art.width,ah/art.height); A=art.resize((round(art.width*s),round(art.height*s)),Image.LANCZOS)
    A=A.crop(((A.width-aw)//2,(A.height-ah)//2,(A.width-aw)//2+aw,(A.height-ah)//2+ah))
    card=Image.new('RGBA',f.size,(5,6,15,255)); card.paste(A,(wx0,wy0)); card.alpha_composite(f)
    gold=((255,240,170),(232,178,60)); ink=((70,48,28),(70,48,28))
    paste_c(card,pixtext(name,17,gold,(40,20,8),shadow=(40,20,8)),470,120)
    paste_c(card,pixtext(sym,20,((250,245,255),(220,200,255)),(30,20,50),font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),975,108)
    st=star(); gap=st.width+8; x0=540-(level-1)*gap/2
    for i in range(level): paste_c(card,st,x0+i*gap,1200)
    paste_c(card,pixtext(race,9,ink,(225,200,170)),540,1262)
    for i,l in enumerate(flav): paste_c(card,pixtext(l,8,((90,70,50),(90,70,50)),(225,200,170),font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),540,1312+i*40)
    d=ImageDraw.Draw(card); d.rectangle((150,1384,930,1387),fill=(150,110,50))
    paste_c(card,pixtext(f'ATK {atk}   DEF {dfn}',13,ink,(225,200,170)),540,1420)
    card.convert('RGB').save(out)
make('../images/10.webp',0.27,'Kül Ejderi','☾',7,'[ Ejderha / Karanlık ]',['Kül yağmurunun içinden doğan kara ejder.','Nefesi gökyüzünü karartır.'],2400,2000,'kul2.png')
make('../images/7.webp',0,'Kristal Ejder','☀',7,'[ Ejderha / Işık ]',['Kristal pulları ışığı kırarak','gökyüzünü gökkuşağına boğar.'],2800,2300,'kristal2.png')
a=Image.open('kristal2.png'); b=Image.open('kul2.png'); h=1300
a=a.resize((round(a.width*h/a.height),h),Image.LANCZOS); b=b.resize(a.size,Image.LANCZOS)
c=Image.new('RGB',(a.width*2+30,h),(5,6,15)); c.paste(a,(0,0)); c.paste(b,(a.width+30,0)); c.save('kartlar-v2.png')
