"""Sprite loading from text grids and PNG strips."""

from __future__ import annotations

import sys
from pathlib import Path

import pygame

TRANSPARENT = "."
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _hex_to_rgb(color: str) -> tuple[int, int, int]:
    c = color.strip().lstrip("#")
    if len(c) != 6:
        raise ValueError(f"palette colours must look like '#rrggbb', got {color!r}")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


def _normalise_frames(frames) -> list[list[str]]:
    frames = list(frames)
    if not frames:
        raise ValueError("a sprite needs at least one frame")
    if isinstance(frames[0], str):
        frames = [frames]
    return [list(f) for f in frames]


class Sprite:
    """Equal-sized frames plus an animation rate. fps=0 means static."""

    def __init__(self, frames: list[pygame.Surface], fps: float = 0):
        if not frames:
            raise ValueError("a sprite needs at least one frame")
        size = frames[0].get_size()
        if size[0] == 0 or size[1] == 0:
            raise ValueError("sprite frames must not be empty")
        for f in frames:
            if f.get_size() != size:
                raise ValueError("all frames of a sprite must be the same size")
        self.frames = frames
        self.fps = fps
        self.width, self.height = size
        self._flash: list[pygame.Surface] | None = None

    @classmethod
    def from_text(cls, frames, palette: dict[str, str], fps: float = 0) -> "Sprite":
        """frames: list of rows (one frame) or list of lists of rows (animation).
        palette maps one character to '#rrggbb'. '.' is transparent."""
        surfaces = []
        for rows in _normalise_frames(frames):
            if not rows:
                raise ValueError("a frame needs at least one row")
            h = len(rows)
            w = len(rows[0])
            if w == 0:
                raise ValueError("a frame row must not be empty")
            for i, r in enumerate(rows):
                if len(r) != w:
                    raise ValueError(f"row {i} has length {len(r)}, expected {w} (every row must match)")
            surf = pygame.Surface((w, h), pygame.SRCALPHA)
            for y, row in enumerate(rows):
                for x, ch in enumerate(row):
                    if ch == TRANSPARENT:
                        continue
                    if ch not in palette:
                        raise ValueError(f"character {ch!r} is not in the palette")
                    surf.set_at((x, y), _hex_to_rgb(palette[ch]))
            surfaces.append(surf)
        return cls(surfaces, fps)

    @classmethod
    def from_png(
        cls,
        path: str,
        frame_w: int | None = None,
        fps: float = 0,
        height: int | None = None,
        trim: bool = False,
    ) -> "Sprite":
        """Load a horizontal strip. A relative path is resolved next to the
        file that calls this function.

        trim=True crops away fully transparent borders (same crop for every
        frame). height=N shrinks the frames to N pixels tall, keeping the
        aspect ratio, so large artwork can be used directly.
        """
        p = Path(path)
        if not p.is_absolute():
            caller_file = sys._getframe(1).f_globals.get("__file__")
            base = Path(caller_file).parent if caller_file else Path.cwd()
            p = base / p
        image = pygame.image.load(str(p))
        if pygame.display.get_surface() is not None:
            image = image.convert_alpha()
        w, h = image.get_size()
        fw = frame_w or w
        if fw <= 0 or w % fw != 0:
            raise ValueError(f"image width {w} is not a multiple of frame_w {fw}")
        frames = [image.subsurface((i * fw, 0, fw, h)).copy() for i in range(w // fw)]
        if trim:
            frames = _trim_frames(frames)
        if height is not None:
            frames = _fit_height(frames, height)
        return cls(frames, fps)

    @classmethod
    def from_data(cls, name: str, **kwargs) -> "Sprite":
        """Load `data/<name>` from the repo's shared artwork folder.
        Accepts the same keyword arguments as from_png, e.g.
        Sprite.from_data("enemy_legal.png", height=32, trim=True)."""
        return cls.from_png(str(DATA_DIR / name), **kwargs)

    def frame_index(self, t: float) -> int:
        if self.fps <= 0 or len(self.frames) == 1:
            return 0
        return int(t * self.fps) % len(self.frames)

    def frame_at(self, t: float) -> pygame.Surface:
        return self.frames[self.frame_index(t)]

    def flash_at(self, t: float) -> pygame.Surface:
        """White silhouette of the current frame, for hit flashes."""
        if self._flash is None:
            self._flash = []
            for f in self.frames:
                s = f.copy()
                s.fill((255, 255, 255, 0), special_flags=pygame.BLEND_RGBA_ADD)
                self._flash.append(s)
        return self._flash[self.frame_index(t)]


def _trim_frames(frames: list[pygame.Surface]) -> list[pygame.Surface]:
    """Crop all frames to the union of their opaque bounding boxes."""
    union = None
    for f in frames:
        r = f.get_bounding_rect(min_alpha=1)
        union = r if union is None else union.union(r)
    if union is None or union.width == 0 or union.height == 0:
        raise ValueError("image is fully transparent, nothing to trim to")
    return [f.subsurface(union).copy() for f in frames]


def _fit_height(frames: list[pygame.Surface], height: int) -> list[pygame.Surface]:
    if height <= 0:
        raise ValueError("height must be positive")
    w, h = frames[0].get_size()
    new_w = max(1, round(w * height / h))
    return [pygame.transform.smoothscale(f, (new_w, height)) for f in frames]
