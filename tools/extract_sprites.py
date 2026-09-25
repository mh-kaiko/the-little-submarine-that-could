"""Extract transparent sprites from the raw pixel-art sheets.

- Flood-fills the background from the image border (tolerance based) so dark
  pixels *inside* a sprite are kept.
- Splits the enemy sheets into individual sprites by looking for empty columns.
"""
import glob
import os

from PIL import Image
import numpy as np
from scipy import ndimage

RAW = 'assets/raw'
OUT = 'assets/sprites'


def key_background(arr, tol):
    """Return alpha mask: 0 where the pixel belongs to the border-connected background."""
    h, w, _ = arr.shape
    rgb = arr[:, :, :3].astype(int)
    # background colour = median of the border pixels
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.abs(rgb - bg).max(axis=2)
    bglike = dist <= tol
    labels, n = ndimage.label(bglike)
    border_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    border_labels.discard(0)
    mask = np.isin(labels, list(border_labels))
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    return alpha


def transparentize(name, tol):
    im = Image.open(f'{RAW}/{name}.png').convert('RGBA')
    arr = np.array(im)
    arr[:, :, 3] = key_background(arr, tol)
    return arr


def crop_to_content(arr, pad=2):
    ys, xs = np.where(arr[:, :, 3] > 0)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, arr.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, arr.shape[1])
    return arr[y0:y1, x0:x1]


def split_sheet(name, labels, tol, label_top):
    """Split a horizontal sheet into len(labels) sprites. label_top = y where the text labels start."""
    arr = transparentize(name, tol)
    body = arr[:label_top]
    col_has = (body[:, :, 3] > 0).sum(axis=0) > 0
    # find runs of non-empty columns
    runs, start = [], None
    for x, v in enumerate(col_has):
        if v and start is None:
            start = x
        elif not v and start is not None:
            runs.append((start, x)); start = None
    if start is not None:
        runs.append((start, len(col_has)))
    # merge small runs into neighbours until we have len(labels) runs
    runs = [list(r) for r in runs]
    while len(runs) > len(labels):
        # merge the run pair with the smallest gap
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        _, i = min(gaps)
        runs[i][1] = runs[i + 1][1]
        del runs[i + 1]
    assert len(runs) == len(labels), (name, runs)
    for (x0, x1), label in zip(runs, labels):
        sprite = crop_to_content(body[:, x0:x1])
        Image.fromarray(sprite).save(f'{OUT}/{label}.png')
        print(f'{label:12s} {sprite.shape[1]}x{sprite.shape[0]}')


def icon(path, tol=24, size=96):
    """Square icon (pickups, mines): crop, fit the longest side to `size` px. Keys out the background only if it is not already transparent."""
    name = os.path.splitext(os.path.basename(path))[0]
    arr = np.array(Image.open(path).convert('RGBA'))
    # art that already has a transparent background keeps it; keying would eat the black outlines
    if not (arr[:, :, 3] == 0).any():
        arr = transparentize(name, tol)
    im = Image.fromarray(crop_to_content(arr))
    s = size / max(im.width, im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    im.save(f'{OUT}/{name}.png')
    print(f'{name:14s} {im.width}x{im.height}')


def portrait(name, tol=24, width=256):
    """Pilot portrait: key out the flat background, crop, shrink for the web."""
    arr = crop_to_content(transparentize(name, tol), pad=0)
    im = Image.fromarray(arr)
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    im.save(f'{OUT}/{name}.png')
    print(f'{name:12s} {width}x{h}')


def cutout(name, out, width, min_alpha=1):
    """Art that already has a transparent background: crop to content and shrink for the web."""
    arr = np.array(Image.open(f'{RAW}/{name}.png').convert('RGBA'))
    arr[:, :, 3] = np.where(arr[:, :, 3] >= min_alpha, arr[:, :, 3], 0)
    arr = crop_to_content(arr, pad=0)
    im = Image.fromarray(arr)
    h = round(im.height * width / im.width)
    im.resize((width, h), Image.LANCZOS).save(f'{OUT}/{out}.png')
    print(f'{out:12s} {width}x{h}')


if __name__ == '__main__':
    cutout('final_boss', 'cancer', 640)
    cutout('final_boss_projectile', 'cancer_cell', 320, min_alpha=40)
    portrait('robert')
    portrait('thomas')
    portrait('veerle')
    # assets/raw/submarine.png is now the dome sub (ea99889). The committed
    # kaiko_sub.png is the old big sub, so write the dome to its own sprite.
    sub = crop_to_content(transparentize('submarine', tol=14))
    Image.fromarray(sub).save(f'{OUT}/kaiko_dome.png')
    print(f'kaiko_dome   {sub.shape[1]}x{sub.shape[0]}')
    split_sheet('enemies1', ['kaiko_mini', 'datadesk', 'legal', 'hospital', 'research', 'it'], tol=30, label_top=540)
    split_sheet('enemies2', ['regulatory', 'gdpr', 'mdr', 'scarlet'], tol=30, label_top=590)
    # assets/raw/pickup_<kind>.png, where <kind> is a POWERUPS key in src/game.js (e.g. pickup_tokens.png)
    for path in sorted(glob.glob(f'{RAW}/pickup_*.png')):
        icon(path)
    icon(f'{RAW}/tech_debt.png', size=128)
