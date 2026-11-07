#!/usr/bin/env python3
"""multisheet.py OUT DIR... [--every 24] [--n 12] [--scale 0.3]: one row per captured dir (label = dir name)."""
import sys, glob, os, re
from PIL import Image, ImageDraw
args = sys.argv[1:]; out = args.pop(0)
def opt(k, d):
    if k in args:
        i = args.index(k); v = args[i + 1]; del args[i:i + 2]; return type(d)(v)
    return d
every, n, scale, start = opt('--every', 24), opt('--n', 12), opt('--scale', 0.3), opt('--start', 0)
w, h = int(640 * scale), int(360 * scale)
sheet = Image.new('RGB', (n * (w + 2) + 90, len(args) * (h + 2)), (0, 0, 0)); d = ImageDraw.Draw(sheet)
for r, dr in enumerate(args):
    files = {int(re.search(r'f(\d+)', p).group(1)): p for p in glob.glob(os.path.join(dr, 'f*.png'))}
    d.text((2, r * (h + 2) + 4), os.path.basename(dr.rstrip('/'))[:14], fill=(255, 255, 0))
    for i in range(n):
        f = start + i * every
        if f not in files: continue
        x = 90 + i * (w + 2); y = r * (h + 2)
        sheet.paste(Image.open(files[f]).convert('RGB').resize((w, h), Image.BILINEAR), (x, y))
        d.text((x + 2, y + 1), str(f), fill=(255, 255, 0))
sheet.save(out); print(out)
