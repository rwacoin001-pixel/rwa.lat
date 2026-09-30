"""Split a /desktop scene into stage-depth layers (plate / subject / fore) as WebP.

Usage: python scripts/desktop-layers.py <scene> <full.png> <plate.png> <cutout.png> --horizon 0.52 [--fore 0.84]
  cutout.png is the rembg RGBA of full.png (same size), or "-" for a scene without a subject (plate = full image). The subject is clipped above the horizon so the
  reflection stays in the plate; the foreground band is a feathered bottom strip of the full image.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

WIDTH = 2400

ap = argparse.ArgumentParser()
ap.add_argument("scene")
ap.add_argument("full")
ap.add_argument("plate")
ap.add_argument("cutout")
ap.add_argument("--horizon", type=float, required=True, help="subject is kept above this fraction of height")
ap.add_argument("--fore", type=float, default=0.84, help="foreground band starts at this fraction of height")
ap.add_argument("--xmax", type=float, default=1.0, help="drop cutout pixels right of this fraction of width")
ap.add_argument("--keep-reflection", action="store_true", help="rebuild the plate below the horizon from the full image")
args = ap.parse_args()

out = Path(__file__).resolve().parent.parent / "public/media/desktop"
out.mkdir(parents=True, exist_ok=True)

full = Image.open(args.full).convert("RGB")
w, h = full.size
size = (WIDTH, round(WIDTH * h / w))


def ramp(height, start, feather, rising):
    """Vertical alpha ramp: 0 above `start`, 1 below `start + feather` (or the inverse)."""
    y = np.arange(height, dtype=np.float32)[:, None]
    a = np.clip((y - start) / feather, 0, 1)
    return a if rising else 1 - a


# Far plate: the edit model returns a slightly different size, so match the full frame. With --keep-reflection the
# water below the horizon comes from the full image, so the subject keeps its mirror image when it sits on the plate.
plate = (full if args.plate == "-" else Image.open(args.plate).convert("RGB")).resize((w, h), Image.LANCZOS)
if args.keep_reflection:
    below = ramp(h, args.horizon * h, 0.012 * h, rising=True).repeat(w, 1)
    plate = Image.composite(full, plate, Image.fromarray((below * 255).astype(np.uint8)))
plate.resize(size, Image.LANCZOS).save(out / f"{args.scene}-plate.webp", quality=86, method=6)

box = None
# Subject: rembg alpha, clipped above the horizon with a short feather, then cropped to its bbox.
if args.cutout != "-":
  cut = Image.open(args.cutout).convert("RGBA").resize((w, h), Image.LANCZOS)
  alpha = np.asarray(cut.getchannel("A"), dtype=np.float32) / 255
  alpha *= ramp(h, args.horizon * h - 6, 12, rising=False)[:, :1].repeat(w, 1)
  alpha[:, int(args.xmax * w):] = 0
  cut.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
  cut = cut.resize(size, Image.LANCZOS)
  box = cut.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
  cut.crop(box).save(out / f"{args.scene}-subject.webp", quality=88, method=6)

# Foreground band: bottom strip of the full image, fading in over 6% of height.
top = int(args.fore * h)
band = full.crop((0, top, w, h)).convert("RGBA")
fade = ramp(h - top, 0, 0.06 * h, rising=True).repeat(w, 1)
band.putalpha(Image.fromarray((fade * 255).astype(np.uint8)))
band = band.resize((WIDTH, round(WIDTH * (h - top) / w)), Image.LANCZOS)
band.save(out / f"{args.scene}-fore.webp", quality=86, method=6)

# Offsets the page needs to place the subject exactly where it sat in the full frame.
if box:
  print(f"{args.scene}: subject left={100 * box[0] / size[0]:.2f} top={100 * box[1] / size[1]:.2f} width={100 * (box[2] - box[0]) / size[0]:.2f}; fore top={100 * args.fore:.0f}")
else:
  print(f"{args.scene}: no subject; fore top={100 * args.fore:.0f}")
