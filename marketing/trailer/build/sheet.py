#!/usr/bin/env python3
"""Contact sheet of captured frames: sheet.py DIR [--every K] [--cols C] [--from A] [--to B] [--scale S] [--out F]
Tiles every K-th PNG of DIR (labelled with its frame number) → DIR.sheet.png (or --out)."""
import argparse, glob, os, re
from PIL import Image, ImageDraw
ap = argparse.ArgumentParser()
ap.add_argument('dir'); ap.add_argument('--every', type=int, default=1); ap.add_argument('--cols', type=int, default=4)
ap.add_argument('--from', dest='a', type=int, default=0); ap.add_argument('--to', dest='b', type=int, default=10**9)
ap.add_argument('--scale', type=float, default=0.5); ap.add_argument('--out')
o = ap.parse_args()
fs = []
for p in sorted(glob.glob(os.path.join(o.dir, 'f*.png'))):
    n = int(re.search(r'f(\d+)\.png$', p).group(1))
    if o.a <= n <= o.b: fs.append((n, p))
fs = fs[::o.every]
w, h = int(640 * o.scale), int(360 * o.scale)
rows = (len(fs) + o.cols - 1) // o.cols
sheet = Image.new('RGB', (o.cols * (w + 2), rows * (h + 2)), (0, 0, 0))
d = ImageDraw.Draw(sheet)
for i, (n, p) in enumerate(fs):
    x, y = (i % o.cols) * (w + 2), (i // o.cols) * (h + 2)
    sheet.paste(Image.open(p).convert('RGB').resize((w, h), Image.NEAREST if o.scale >= 1 else Image.BILINEAR), (x, y))
    d.rectangle([x, y, x + 34, y + 11], fill=(0, 0, 0)); d.text((x + 2, y), str(n), fill=(255, 255, 0))
out = o.out or o.dir.rstrip('/') + '.sheet.png'
sheet.save(out); print(out, len(fs), 'tiles')
