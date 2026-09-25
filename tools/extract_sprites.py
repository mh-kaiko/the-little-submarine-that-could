"""Extract transparent sprites from the raw pixel-art sheets.

- Flood-fills the background from the image border (tolerance based) so dark
  pixels *inside* a sprite are kept.
- Splits the enemy sheets into individual sprites by looking for empty columns.
"""
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


if __name__ == '__main__':
    sub = crop_to_content(transparentize('submarine', tol=14))
    Image.fromarray(sub).save(f'{OUT}/kaiko_sub.png')
    print(f'kaiko_sub    {sub.shape[1]}x{sub.shape[0]}')
    split_sheet('enemies1', ['kaiko_mini', 'datadesk', 'legal', 'hospital', 'research', 'it'], tol=30, label_top=540)
    split_sheet('enemies2', ['regulatory', 'gdpr', 'mdr', 'scarlet'], tol=30, label_top=590)
