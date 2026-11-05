exec(open('kart2.py').read().split("make('../images/10.webp'")[0])
def title(text,size=16,track=1):
    f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',size)
    # render char by char with tracking, no AA
    ws=[f.getbbox(c)[2] if c!=' ' else size//3 for c in text]
    W=sum(ws)+track*len(text)+8; H=size+10
    m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m); d.fontmode='1'; x=4
    for c,w in zip(text,ws): d.text((x,3),c,font=f,fill=255); x+=w+track
    a=np.array(m)>0
    pad=np.pad(a,2)
    def dil(b):
        o=np.zeros_like(b)
        for dy in(-1,0,1):
            for dx in(-1,0,1): o|=np.roll(np.roll(b,dy,0),dx,1)
        return o
    o1=dil(pad); o2=dil(o1)
    out=np.zeros(pad.shape+(4,),np.uint8)
    out[o2]=(255,226,140,255)       # thin bright outer rim (gold)
    out[o1]=(52,22,6,255)           # dark outline
    sh=np.zeros_like(pad); sh[2:,1:]=pad[:-2,:-1]
    out[sh&~pad]=(110,50,10,255)    # drop shade
    rows=np.where(pad.any(1))[0]; t,b=rows.min(),rows.max()
    ys=(np.arange(pad.shape[0])-t)/max(1,b-t)
    cols=[(255,250,215),(255,222,120),(236,160,40),(190,105,20)]
    for y in range(pad.shape[0]):
        k=min(3,max(0,int(ys[y]*4)))
        out[y][pad[y]]=cols[k]+(255,)
    img=Image.fromarray(out,'RGBA'); return img.resize((img.width*P,img.height*P),Image.NEAREST)
def plain(text,size=15):
    f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',size)
    bb=f.getbbox(text); m=Image.new('RGBA',(bb[2]-bb[0]+4,bb[3]-bb[1]+4),(0,0,0,0)); d=ImageDraw.Draw(m); d.fontmode='1'
    d.text((2-bb[0],2-bb[1]),text,font=f,fill=(38,24,14,255))
    return m.resize((m.width*P,m.height*P),Image.NEAREST)
def make3(art_path,hue,name,sym,level,race,flav,atk,dfn,out):
    import builtins
    f=Image.open('cerceve-uzun.png').convert('RGBA')
    if hue:
        a=np.asarray(f).astype(float)/255; rgb=a[...,:3]
        H,S,V=np.vectorize(colorsys.rgb_to_hsv,otypes=[float]*3)(rgb[...,0],rgb[...,1],rgb[...,2])
        H=np.where((H>0.4)&(H<0.62)&(S>0.2),H+hue,H)
        r,g,b=np.vectorize(colorsys.hsv_to_rgb,otypes=[float]*3)(H,S,V)
        f=Image.fromarray((np.dstack([r,g,b,a[...,3]])*255).astype('uint8'))
    art=Image.open(art_path).convert('RGBA')
    if art.height>art.width*1.2: art=art.crop((52,192,1034,980))
    wx0,wy0,wx1,wy1=52,192,1034,1055; aw,ah=wx1-wx0,wy1-wy0
    s=max(aw/art.width,ah/art.height); A=art.resize((round(art.width*s),round(art.height*s)),Image.LANCZOS)
    A=A.crop(((A.width-aw)//2,(A.height-ah)//2,(A.width-aw)//2+aw,(A.height-ah)//2+ah))
    card=Image.new('RGBA',f.size,(5,6,15,255)); card.paste(A,(wx0,wy0)); card.alpha_composite(f)
    # darken banner slightly behind title for contrast
    paste_c(card,plain(name),470,120)
    paste_c(card,pixtext(sym,20,((250,245,255),(220,200,255)),(30,20,50),font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),975,108)
    st=star(); gap=st.width+16; x0=540-(level-1)*gap/2
    for i in range(level): paste_c(card,st,x0+i*gap,1200)
    ink=((70,48,28),(70,48,28))
    paste_c(card,pixtext(race,9,ink,(225,200,170)),540,1262)
    for i,l in enumerate(flav): paste_c(card,pixtext(l,10,((90,70,50),(90,70,50)),(225,200,170),font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),540,1308+i*42)
    ImageDraw.Draw(card).rectangle((150,1384,930,1387),fill=(150,110,50))
    paste_c(card,pixtext(f'ATK {atk}   DEF {dfn}',13,ink,(225,200,170)),540,1420)
    card.convert('RGB').save(out)
make3('../images/10.webp',0.27,'Ashen Drake','☾',7,'[ Dragon / Dark ]',['A black dragon born from a rain of ash.','Its breath darkens the sky.'],2400,2000,'kul3.png')
make3('../images/7.webp',0,'Crystal Wyrm','☀',7,'[ Dragon / Light ]',['Its crystal scales split the light','and drown the sky in rainbows.'],2800,2300,'kristal3.png')
a=Image.open('kristal3.png'); b=Image.open('kul3.png'); h=1300
a=a.resize((round(a.width*h/a.height),h),Image.LANCZOS); b=b.resize(a.size,Image.LANCZOS)
c=Image.new('RGB',(a.width*2+30,h),(5,6,15)); c.paste(a,(0,0)); c.paste(b,(a.width+30,0)); c.save('kartlar-v4.png')
