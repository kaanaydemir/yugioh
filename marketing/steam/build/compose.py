# Integer nearest-neighbour upscales of the 1x layers -> exact Steam capsule sizes.
import numpy as np
from PIL import Image
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..'))
L=os.path.join(ROOT,'marketing/steam/build/layers/')
O=os.path.join(ROOT,'marketing/steam/')
def up(im,k): return im.resize((im.width*k, im.height*k), Image.NEAREST)
def rgb(n): return Image.open(L+n).convert('RGB')

def matte(name):
    B=np.asarray(Image.open(L+name+'_000000.png').convert('RGB'),float)
    W=np.asarray(Image.open(L+name+'_ffffff.png').convert('RGB'),float)
    a=np.clip(1-(W-B)/255.0,0,1).max(axis=2)
    a[a<1/255]=0
    col=np.zeros_like(B)
    nz=a>0
    col[nz]=np.clip(B[nz]/a[nz,None],0,255)
    out=np.dstack([np.round(col),np.round(a*255)]).astype(np.uint8)
    im=Image.fromarray(out,'RGBA')
    return im.crop(im.getbbox())

def save(im,n,size):
    assert im.size==size,(n,im.size,size)
    im.save(O+n, optimize=True); print(n, im.size, im.mode)

save(up(rgb('header.png'),2),'header_capsule_920x430.png',(920,430))
save(up(rgb('small.png'),1),'small_capsule_462x174.png',(462,174))
save(up(rgb('main.png'),2),'main_capsule_1232x706.png',(1232,706))
save(up(rgb('hero.png'),8),'library_hero_3840x1240.png',(3840,1240))
save(up(rgb('icon.png'),2),'community_icon_184x184.png',(184,184))

st=matte('logost'); line=matte('logo')
print('stacked logo', st.size, 'line logo', line.size)
for n,src,k,size,top in [('vertical_capsule_748x896.png','vertical.png',4,(748,896),18),('library_capsule_600x900.png','library.png',3,(600,900),24)]:
    art=up(rgb(src),k).convert('RGBA'); lg=up(st,2)
    x=(art.width-lg.width)//2; x-=x%2
    art.alpha_composite(lg,(x,top)); save(art.convert('RGB'),n,size)
lg=up(line,3)
c=Image.new('RGBA',(1280,720),(0,0,0,0)); c.alpha_composite(lg,((1280-lg.width)//2//3*3,(720-lg.height)//2//3*3))
save(c,'library_logo_1280x720.png',(1280,720))
# preview of the transparent logo over the hero (how Steam shows them)
h=up(rgb('hero.png'),8).convert('RGBA').resize((1920,620),Image.NEAREST)
p=c.resize((640,360),Image.NEAREST); h.alpha_composite(p,(60,130)); h.convert('RGB').save(L+'hero_with_logo_preview.png')
