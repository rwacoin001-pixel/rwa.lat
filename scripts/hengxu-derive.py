"""Build-time WebP derivatives for the 衡序 product imagery.

Reads the originals in public/media/products/hengxu-v2/*.png (never modified) and writes
<name>-<width>.webp into public/media/products/hengxu-v2/derived/. Re-run after replacing an original.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'media' / 'products' / 'hengxu-v2'
OUT = ROOT / 'derived'
WIDTHS = (720, 1440)

OUT.mkdir(exist_ok=True)
for source in sorted(ROOT.glob('*.png')):
    with Image.open(source) as image:
        image = image.convert('RGB')
        for width in WIDTHS:
            height = round(image.height * width / image.width)
            target = OUT / f'{source.stem}-{width}.webp'
            image.resize((width, height), Image.LANCZOS).save(target, 'WEBP', quality=80, method=6)
            print(target.name, f'{target.stat().st_size // 1024} KB')
