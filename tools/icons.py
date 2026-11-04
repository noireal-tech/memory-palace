# Draws the app icons (icons/*.png): a pagoda keep in silhouette against a dusk sky, windows lit gold.
from PIL import Image, ImageDraw, ImageFilter
import os
def icon(size, safe):
    S = 1024; im = Image.new('RGB', (S, S)); d = ImageDraw.Draw(im)
    for y in range(S):
        t = y / S; a = (24, 26, 58); b = (214, 140, 72); k = max(0, min(1, (t - 0.25) / 0.6)) ** 1.6
        d.line([(0, y), (S, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3)))
    glow = Image.new('L', (S, S)); ImageDraw.Draw(glow).ellipse([332, 440, 692, 800], fill=255); glow = glow.filter(ImageFilter.GaussianBlur(70))
    im.paste(Image.new('RGB', (S, S), (255, 214, 140)), (0, 0), glow.point(lambda v: int(v * 0.8)))
    cx = S / 2
    def P(x, y): return (cx + (x - 512) * safe, 512 + (y - 512) * safe)
    ink = (20, 16, 14); gold = (232, 190, 96)
    tiers = [(610, 330, 230, 120), (470, 260, 170, 105), (345, 195, 120, 95), (235, 140, 80, 80)]
    d.polygon([P(250, 730), P(774, 730), P(820, 880), P(204, 880)], fill=ink)
    for (ye, he, hw, wh) in tiers:
        d.rectangle([P(512 - hw, ye), P(512 + hw, ye + wh)], fill=ink)
        d.polygon([P(512 - he - 30, ye - 34), P(512 - he + 20, ye + 4), P(512, ye + 6), P(512 + he - 20, ye + 4), P(512 + he + 30, ye - 34), P(512 + hw * 0.6, ye - 70), P(512 - hw * 0.6, ye - 70)], fill=ink)
        for k in range(3):
            x = 512 - hw + (k + 0.5) * (2 * hw / 3)
            d.rectangle([P(x - 14, ye + wh * 0.35), P(x + 14, ye + wh * 0.75)], fill=gold)
    d.polygon([P(417, 165), P(607, 165), P(512, 95)], fill=ink)
    d.rectangle([P(470, 790), P(554, 880)], fill=gold)
    return im.resize((size, size), Image.LANCZOS)
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
icon(512, 1.0).save(os.path.join(here, 'icon-512.png')); icon(192, 1.0).save(os.path.join(here, 'icon-192.png')); icon(512, 0.74).save(os.path.join(here, 'maskable-512.png'))
