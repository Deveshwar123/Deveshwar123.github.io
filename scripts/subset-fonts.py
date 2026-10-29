"""Maintenance: subset the self-hosted variable fonts to the characters the site
uses and the weight range the CSS uses (400-500). Newsreader's optical-size axis is
pinned to its display end (opsz 48), which suits the large headings that use it. Originals stay in
assets/fonts/source/ so this can be re-run.
Usage: python3 scripts/subset-fonts.py   (needs fonttools + brotli)"""
import io, os, shutil
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
fonts = os.path.join(root, 'assets', 'fonts')
src_dir = os.path.join(fonts, 'source')
os.makedirs(src_dir, exist_ok=True)
UNICODES = 'U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2010-2027,U+2030-203A,U+2044,U+2190-2193,U+2122,U+2212'

for name in ['newsreader-latin-var.woff2', 'dm-sans-latin-var.woff2']:
    src = os.path.join(src_dir, name)
    if not os.path.exists(src):
        shutil.copy(os.path.join(fonts, name), src)
    font = TTFont(src)
    limits = {'wght': (400, 500)}
    if 'newsreader' in name:
        limits['opsz'] = 48
    font = instancer.instantiateVariableFont(font, limits)
    buf = io.BytesIO()
    font.save(buf)  # round-trip so the subsetter sees fully loaded tables
    buf.seek(0)
    font = TTFont(buf)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'calt', 'lnum', 'tnum', 'case']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(UNICODES))
    s.subset(font)
    out = os.path.join(fonts, name)
    font.flavor = 'woff2'
    font.save(out)
    print(name, os.path.getsize(src), '->', os.path.getsize(out), 'bytes')
