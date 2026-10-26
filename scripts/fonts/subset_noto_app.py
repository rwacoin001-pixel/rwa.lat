"""Cut each Noto Sans SC slice down to the characters the app's own copy uses.

usage: python subset_noto_app.py REPO
Writes public/fonts/noto-sans-sc-app/NNN.woff2 (only slices that hold app characters) and
styles/noto-sans-sc-app.css: family 'A-REIT Sans SC', one face per slice, unicode-range = exactly the kept characters.
The full slices stay as the fallback for everything else (names, news, notices from the server).
Re-run after adding Chinese copy; scripts/check... is not needed because missing characters just fall back.
"""
import os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

repo = sys.argv[1]
os.chdir(repo)
chars = set()
for base in ('components', 'app', 'lib', 'hooks'):
    for d, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(('.ts', '.tsx', '.json', '.mjs')):
                text = open(os.path.join(d, f), encoding='utf-8', errors='ignore').read()
                chars.update(ord(c) for c in text if ord(c) >= 0x2000)
src_dir = 'public/fonts/noto-sans-sc'
out_dir = 'public/fonts/noto-sans-sc-app'
os.makedirs(out_dir, exist_ok=True)
for old in os.listdir(out_dir):
    os.remove(os.path.join(out_dir, old))


def ranges(cps):
    cps = sorted(cps)
    out, start, prev = [], cps[0], cps[0]
    for c in cps[1:]:
        if c == prev + 1:
            prev = c
            continue
        out.append((start, prev)); start = prev = c
    out.append((start, prev))
    return ', '.join(f'U+{a:x}' if a == b else f'U+{a:x}-{b:x}' for a, b in out)


faces, total_in, total_out, kept_chars = [], 0, 0, 0
for name in sorted(n for n in os.listdir(src_dir) if n.endswith('.woff2')):
    path = os.path.join(src_dir, name)
    font = TTFont(path)
    have = set(font.getBestCmap())
    want = have & chars
    if not want:
        continue
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(want))
    sub.subset(font)
    out = os.path.join(out_dir, name)
    font.flavor = 'woff2'
    font.save(out)
    total_in += os.path.getsize(path); total_out += os.path.getsize(out); kept_chars += len(want)
    faces.append(f"@font-face{{font-family:'A-REIT Sans SC';font-style:normal;font-weight:400 700;font-display:swap;src:url('/fonts/noto-sans-sc-app/{name}') format('woff2');unicode-range:{ranges(want)}}}")

head = ("/* Noto Sans SC (SIL OFL 1.1) cut down to the characters in the app's own copy (scripts/fonts/subset_noto_app.py).\n"
        "   Comes before the full 'Noto Sans SC' slices in --pa-sans, so the app's text loads a few small files; anything else\n"
        "   (names, news, server notices) falls through to the full slices. Re-run the script after adding Chinese copy. */\n")
open('styles/noto-sans-sc-app.css', 'w', encoding='utf-8', newline='\n').write(head + '\n'.join(faces) + '\n')
print({'chars': len(chars), 'kept': kept_chars, 'files': len(faces), 'fullKB': total_in // 1024, 'appKB': total_out // 1024})
