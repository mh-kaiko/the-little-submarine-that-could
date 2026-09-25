# Kaiko Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pygame engine, enemy plugin contract, validator, example enemies, and contributor spec for the Kaiko scrolling shooter in about 40 minutes.

**Architecture:** A `kaiko/` package owns the loop, rendering, world simulation, spawning and plugin discovery. Enemies are folders under `enemies/` that subclass `kaiko.api.Enemy`; the registry imports them by path and isolates failures. Everything contributors touch is in `kaiko/api.py` and `ENEMY_SPEC.md`.

**Tech Stack:** Python 3.13, `uv`, `pygame-ce`, `pytest`.

**Spec:** `docs/superpowers/specs/2026-09-25-kaiko-engine-design.md`

## Global Constraints

- Canvas is 320 by 180 pixels, integer-scaled to the display, fixed `dt = 1/60`.
- Enemy folders under `enemies/` whose name starts with `_` are skipped.
- Contributors import only from `kaiko.api`; everything else is private.
- No audio. No edits to engine files by enemy contributors.
- A broken enemy (import error, bad attribute, raising hook) is logged and skipped or killed; the game keeps running.
- Tests and the validator run headless with `SDL_VIDEODRIVER=dummy`.
- Commits are small and use plain messages, no attribution lines.

## Review Focus

Spec-implied inputs no task's tests cover unless pinned here. Each has a test added in its owning task.

1. An enemy `update` sets `x` or `y` to NaN or infinity. Expected: the enemy is removed, rendering does not crash on `round(nan)`. Test in Task 5.
2. `world.spawn` is called with something that is not an `Enemy` subclass. Expected: recorded as that enemy's error, game continues. Test in Task 5.
3. A text sprite with an empty row or zero rows. Expected: `ValueError` at load, not a zero-size surface later. Test in Task 2.
4. `--only somefolder` names a folder that does not exist. Expected: the CLI lists available folders and exits 1 without opening a window. Test in Task 10.
5. A boss with the default `vx = -40` drifts off the left edge. Expected: it is removed like any enemy once it passes the left cull line, so regular spawning resumes. Test in Task 5.

---

### Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`, `kaiko/__init__.py`, `tests/conftest.py`, `tests/test_smoke.py`

**Interfaces:**
- Produces: constants `kaiko.WIDTH = 320`, `kaiko.HEIGHT = 180`, `kaiko.FPS = 60`, `kaiko.DT = 1/60`.

- [ ] **Step 1: Write pyproject and package init**

`pyproject.toml`:

```toml
[project]
name = "kaiko-the-game"
version = "0.1.0"
description = "Kaiko the submarine solves healthcare, one enemy at a time."
requires-python = ">=3.12"
dependencies = ["pygame-ce>=2.5"]

[project.scripts]
kaiko = "kaiko.__main__:main"

[dependency-groups]
dev = ["pytest>=8"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["kaiko"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

`kaiko/__init__.py`:

```python
"""Kaiko the Game: a pixel-art scrolling shooter engine."""

WIDTH = 320
HEIGHT = 180
FPS = 60
DT = 1.0 / FPS
```

`tests/conftest.py`:

```python
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame  # noqa: E402

pygame.init()
```

`tests/test_smoke.py`:

```python
import pygame

import kaiko


def test_constants():
    assert (kaiko.WIDTH, kaiko.HEIGHT) == (320, 180)
    assert abs(kaiko.DT - 1 / 60) < 1e-9


def test_pygame_importable():
    assert pygame.version.vernum[0] >= 2
```

- [ ] **Step 2: Install and run**

Run: `uv sync && uv run pytest -q`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml uv.lock kaiko/__init__.py tests/conftest.py tests/test_smoke.py
git commit -m "Scaffold kaiko package with pygame-ce and pytest"
```

---

### Task 2: Sprites

**Files:**
- Create: `kaiko/sprites.py`
- Test: `tests/test_sprites.py`

**Interfaces:**
- Produces: `Sprite(frames: list[pygame.Surface], fps: float = 0)`, `Sprite.from_text(frames, palette, fps=0)`, `Sprite.from_png(path, frame_w=None, fps=0)`, attributes `width`, `height`, `frames`, `fps`, methods `frame_index(t) -> int`, `frame_at(t) -> Surface`, `flash_at(t) -> Surface`.

- [ ] **Step 1: Write the failing tests**

`tests/test_sprites.py`:

```python
import importlib.util

import pygame
import pytest

from kaiko.sprites import Sprite

PAL = {"#": "#ffffff", "o": "#ff0000"}


def test_from_text_single_frame_size_and_pixels():
    s = Sprite.from_text(["#..", ".o."], PAL)
    assert (s.width, s.height) == (3, 2)
    assert len(s.frames) == 1
    f = s.frames[0]
    assert f.get_at((0, 0)) == (255, 255, 255, 255)
    assert f.get_at((1, 0)).a == 0
    assert f.get_at((1, 1)) == (255, 0, 0, 255)


def test_from_text_multi_frame_animates():
    s = Sprite.from_text([["#."], [".#"]], PAL, fps=2)
    assert len(s.frames) == 2
    assert s.frame_at(0.0) is s.frames[0]
    assert s.frame_at(0.5) is s.frames[1]
    assert s.frame_at(1.0) is s.frames[0]


def test_static_sprite_ignores_time():
    s = Sprite.from_text([["#."], [".#"]], PAL, fps=0)
    assert s.frame_at(123.4) is s.frames[0]


def test_flash_is_white_silhouette():
    s = Sprite.from_text(["o."], PAL)
    f = s.flash_at(0)
    assert f.get_at((0, 0)) == (255, 255, 255, 255)
    assert f.get_at((1, 0)).a == 0


@pytest.mark.parametrize(
    "frames",
    [
        ["##", "#"],  # ragged
        ["#x"],  # unknown char
        [],  # no frames
        [""],  # empty row
        [["#"], ["##"]],  # frames differ in size
    ],
)
def test_bad_text_sprites_rejected(frames):
    with pytest.raises(ValueError):
        Sprite.from_text(frames, PAL)


def test_from_png_strip(tmp_path):
    surf = pygame.Surface((6, 2), pygame.SRCALPHA)
    surf.set_at((0, 0), (10, 20, 30, 255))
    surf.set_at((3, 1), (40, 50, 60, 255))
    path = tmp_path / "strip.png"
    pygame.image.save(surf, str(path))
    s = Sprite.from_png(str(path), frame_w=3, fps=5)
    assert (s.width, s.height) == (3, 2)
    assert len(s.frames) == 2
    assert s.frames[0].get_at((0, 0)) == (10, 20, 30, 255)
    assert s.frames[1].get_at((0, 1)) == (40, 50, 60, 255)


def test_from_png_relative_to_calling_module(tmp_path):
    surf = pygame.Surface((4, 4), pygame.SRCALPHA)
    pygame.image.save(surf, str(tmp_path / "me.png"))
    (tmp_path / "mod.py").write_text(
        "from kaiko.sprites import Sprite\nSPR = Sprite.from_png('me.png')\n"
    )
    spec = importlib.util.spec_from_file_location("tmp_sprite_mod", tmp_path / "mod.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert (mod.SPR.width, mod.SPR.height) == (4, 4)


def test_from_png_bad_frame_width(tmp_path):
    surf = pygame.Surface((5, 2), pygame.SRCALPHA)
    pygame.image.save(surf, str(tmp_path / "odd.png"))
    with pytest.raises(ValueError):
        Sprite.from_png(str(tmp_path / "odd.png"), frame_w=2)
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_sprites.py -q`
Expected: errors with `ModuleNotFoundError: kaiko.sprites`.

- [ ] **Step 3: Implement**

`kaiko/sprites.py`:

```python
"""Sprite loading from text grids and PNG strips."""

from __future__ import annotations

import sys
from pathlib import Path

import pygame

TRANSPARENT = "."


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
            if any(len(r) != w for r in rows):
                raise ValueError("every row of a frame must have the same length")
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
    def from_png(cls, path: str, frame_w: int | None = None, fps: float = 0) -> "Sprite":
        """Load a horizontal strip. A relative path is resolved next to the
        file that calls this function."""
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
        return cls(frames, fps)

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
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_sprites.py -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add kaiko/sprites.py tests/test_sprites.py
git commit -m "Add Sprite loading from text grids and PNG strips"
```

---

### Task 3: Public API: Enemy base class

**Files:**
- Create: `kaiko/api.py`
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: `kaiko.sprites.Sprite`.
- Produces: `Enemy` with class attrs `name, tier, weight, boss, hp, score, sprite, hitbox, contact_damage, folder`; `__init__(x, y)`; instance attrs `x, y, vx, vy, hp, age, alive, flash`; hooks `on_spawn(world)`, `update(dt, world)`, `on_hit(world, damage)`, `on_death(world)`; methods `kill()`, `size() -> (w, h)`, `rect() -> (x, y, w, h)`, classmethod `display_name()`. Protocols `WorldView`, `PlayerView` for type hints.

- [ ] **Step 1: Write the failing tests**

`tests/test_api.py`:

```python
from kaiko.api import Enemy, Sprite

SPR = Sprite.from_text(["####", "####"], {"#": "#ffffff"})


class Blob(Enemy):
    name = "Blob"
    hp = 3
    sprite = SPR


class Unnamed(Enemy):
    sprite = SPR
    hitbox = (2, 2)


def test_defaults_and_instance_state():
    e = Blob(10, 20)
    assert (e.x, e.y, e.vx, e.vy) == (10.0, 20.0, -40.0, 0.0)
    assert e.hp == 3 and Blob.hp == 3
    assert e.alive and e.age == 0.0
    assert Blob.tier == 1 and Blob.weight == 1.0 and Blob.boss is False


def test_instance_hp_does_not_change_class_hp():
    e = Blob(0, 0)
    e.hp -= 1
    assert Blob.hp == 3


def test_default_update_integrates_velocity():
    e = Blob(100, 50)
    e.vy = 10
    e.update(0.5, None)
    assert (e.x, e.y) == (80.0, 55.0)


def test_kill_and_rect():
    e = Blob(10, 20)
    assert e.rect() == (8.0, 19.0, 4, 2)
    e.kill()
    assert not e.alive


def test_hitbox_overrides_sprite_size():
    e = Unnamed(10, 20)
    assert e.size() == (2, 2)
    assert e.rect() == (9.0, 19.0, 2, 2)


def test_display_name_falls_back_to_class_name():
    assert Blob.display_name() == "Blob"
    assert Unnamed.display_name() == "Unnamed"
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_api.py -q`
Expected: `ModuleNotFoundError: kaiko.api`.

- [ ] **Step 3: Implement**

`kaiko/api.py`:

```python
"""The public contract for enemy authors. Import only from here.

    from kaiko.api import Enemy, Sprite
"""

from __future__ import annotations

import random
from typing import Protocol

from kaiko.sprites import Sprite

__all__ = ["Enemy", "Sprite", "WorldView", "PlayerView"]


class PlayerView(Protocol):
    """What enemies may read about Kaiko."""

    x: float
    y: float
    alive: bool


class WorldView(Protocol):
    """What enemies may read and do. Do not mutate anything else."""

    width: int
    height: int
    time: float
    dt: float
    rng: random.Random
    player: PlayerView
    enemies: list["Enemy"]

    def fire(
        self, x: float, y: float, vx: float, vy: float, damage: int = 1, sprite: Sprite | None = None
    ) -> None: ...

    def spawn(self, cls: type["Enemy"], x: float, y: float) -> "Enemy | None": ...


class Enemy:
    """Subclass this in enemies/<your_folder>/__init__.py.

    Set the class attributes, give it a sprite, and override the hooks you
    need. Do not override __init__; use on_spawn instead.
    """

    name: str | None = None
    tier: int = 1
    weight: float = 1.0
    boss: bool = False
    hp: int = 1
    score: int = 100
    sprite: Sprite | None = None
    hitbox: tuple[int, int] | None = None
    contact_damage: int = 1

    folder: str = ""  # set by the registry: the enemies/ folder this came from

    def __init__(self, x: float, y: float):
        self.x = float(x)
        self.y = float(y)
        self.vx = -40.0
        self.vy = 0.0
        self.hp = type(self).hp
        self.age = 0.0
        self.alive = True
        self.flash = 0.0  # seconds of white hit-flash left; set by the engine

    @classmethod
    def display_name(cls) -> str:
        return cls.name or cls.__name__

    # --- hooks: override these -------------------------------------------

    def on_spawn(self, world: WorldView) -> None:
        """Called once, right after x and y are set."""

    def update(self, dt: float, world: WorldView) -> None:
        """Called every tick. Default: move by (vx, vy)."""
        self.x += self.vx * dt
        self.y += self.vy * dt

    def on_hit(self, world: WorldView, damage: int) -> None:
        """Called after hp was reduced by a player bullet."""

    def on_death(self, world: WorldView) -> None:
        """Called once when hp reaches 0. Not called on kill()."""

    # --- helpers -----------------------------------------------------------

    def kill(self) -> None:
        """Remove this enemy without score and without on_death."""
        self.alive = False

    def size(self) -> tuple[int, int]:
        if self.hitbox is not None:
            return tuple(self.hitbox)
        return (self.sprite.width, self.sprite.height)

    def rect(self) -> tuple[float, float, float, float]:
        w, h = self.size()
        return (self.x - w / 2, self.y - h / 2, w, h)
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_api.py -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add kaiko/api.py tests/test_api.py
git commit -m "Add Enemy base class and WorldView protocol"
```

---

### Task 4: Player, bullets and Kaiko art

**Files:**
- Create: `kaiko/art.py`, `kaiko/entities.py`
- Test: `tests/test_entities.py`

**Interfaces:**
- Consumes: `Sprite`.
- Produces: `art.KAIKO: Sprite` (24 by 12, two frames, fps 8). `Bullet(x, y, vx, vy, damage=1, friendly=False, sprite=None)` with `alive`, `age`, `size()`, `rect()`, `update(dt)`. `Player(x, y)` with `lives`, `alive`, `invuln`, `cooldown`, `age`, `sprite`, `update(dt, dx, dy, firing, world)` where `world` has `width`, `height`, `fire_player(x, y)`; `hit(damage=1) -> bool`; `size()`, `rect()`. Constants `Player.SPEED = 120`, `FIRE_RATE = 8`, `BULLET_SPEED = 220`, `INVULN = 1.0`, `LIVES = 3`.

- [ ] **Step 1: Write the failing tests**

`tests/test_entities.py`:

```python
from kaiko import DT
from kaiko.art import KAIKO
from kaiko.entities import Bullet, Player


class FakeWorld:
    width = 320
    height = 180

    def __init__(self):
        self.shots = []

    def fire_player(self, x, y):
        self.shots.append((x, y))


def test_kaiko_sprite_shape():
    assert (KAIKO.width, KAIKO.height) == (24, 12)
    assert len(KAIKO.frames) == 2


def test_bullet_moves_and_sizes():
    b = Bullet(0, 0, 60, -60, friendly=True)
    b.update(0.5)
    assert (b.x, b.y) == (30.0, -30.0)
    assert b.size() == (6, 2)
    assert Bullet(0, 0, 0, 0).size() == (3, 3)


def test_player_moves_and_clamps():
    w = FakeWorld()
    p = Player(40, 90)
    for _ in range(120):
        p.update(DT, -1, 0, False, w)
    assert p.x == KAIKO.width / 2
    for _ in range(600):
        p.update(DT, 1, 1, False, w)
    assert p.x == w.width - KAIKO.width / 2
    assert p.y == w.height - KAIKO.height / 2


def test_player_fire_rate():
    w = FakeWorld()
    p = Player(40, 90)
    for _ in range(60):
        p.update(DT, 0, 0, True, w)
    assert 7 <= len(w.shots) <= 9
    assert w.shots[0][0] > p.x  # torpedo leaves from the nose


def test_player_hit_lives_and_invulnerability():
    p = Player(40, 90)
    assert p.hit() is True
    assert p.lives == 2 and p.invuln > 0
    assert p.hit() is False  # invulnerable
    p.invuln = 0
    assert p.hit() is True
    p.invuln = 0
    assert p.hit() is True
    assert p.lives == 0 and not p.alive
    assert p.hit() is False


def test_dead_player_does_not_move_or_fire():
    w = FakeWorld()
    p = Player(40, 90)
    p.alive = False
    p.update(DT, 1, 0, True, w)
    assert p.x == 40 and w.shots == []
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_entities.py -q`
Expected: `ModuleNotFoundError: kaiko.art`.

- [ ] **Step 3: Implement**

`kaiko/art.py`:

```python
"""Engine-owned pixel art: Kaiko herself."""

from kaiko.sprites import Sprite

KAIKO_PALETTE = {
    "y": "#f4c542",  # hull
    "d": "#c48f1f",  # hull shadow
    "w": "#9be7ff",  # porthole
    "g": "#b8c0c8",  # periscope
    "p": "#e8eef2",  # propeller
    "k": "#3a2a10",  # outline bits
}

_FRAME_A = [
    ".........ggg............",
    ".........g..............",
    ".......ggggg............",
    ".....yyyyyyyyyyyy.......",
    "...yyyyyyyyyyyyyyyyy....",
    "p.yyyyyywwyyyyyyyyyyyy..",
    "ppyyyyyywwyyyyyyyyyyyyy.",
    "p.yyyyyyyyyyyyyyyyyyyyyy",
    "..ddddddddddddddddddddd.",
    "...dddddddddddddddddd...",
    ".....ddddddddddddd......",
    ".......kkkkkkkkk........",
]

_FRAME_B = [
    ".........ggg............",
    ".........g..............",
    ".......ggggg............",
    ".....yyyyyyyyyyyy.......",
    "...yyyyyyyyyyyyyyyyy....",
    "..yyyyyywwyyyyyyyyyyyy..",
    "ppyyyyyywwyyyyyyyyyyyyy.",
    "..yyyyyyyyyyyyyyyyyyyyyy",
    "p.ddddddddddddddddddddd.",
    "...dddddddddddddddddd...",
    ".....ddddddddddddd......",
    ".......kkkkkkkkk........",
]

KAIKO = Sprite.from_text([_FRAME_A, _FRAME_B], KAIKO_PALETTE, fps=8)
```

`kaiko/entities.py`:

```python
"""Player and bullets. Engine-internal."""

from __future__ import annotations

from dataclasses import dataclass

from kaiko.art import KAIKO
from kaiko.sprites import Sprite

PLAYER_BULLET_SIZE = (6, 2)
ENEMY_BULLET_SIZE = (3, 3)
DIAGONAL = 0.7071


@dataclass
class Bullet:
    x: float
    y: float
    vx: float
    vy: float
    damage: int = 1
    friendly: bool = False
    sprite: Sprite | None = None
    alive: bool = True
    age: float = 0.0

    def size(self) -> tuple[int, int]:
        if self.sprite is not None:
            return (self.sprite.width, self.sprite.height)
        return PLAYER_BULLET_SIZE if self.friendly else ENEMY_BULLET_SIZE

    def rect(self) -> tuple[float, float, float, float]:
        w, h = self.size()
        return (self.x - w / 2, self.y - h / 2, w, h)

    def update(self, dt: float) -> None:
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.age += dt


class Player:
    SPEED = 120.0
    FIRE_RATE = 8.0
    BULLET_SPEED = 220.0
    INVULN = 1.0
    LIVES = 3
    sprite = KAIKO

    def __init__(self, x: float, y: float):
        self.x = float(x)
        self.y = float(y)
        self.lives = self.LIVES
        self.alive = True
        self.invuln = 0.0
        self.cooldown = 0.0
        self.age = 0.0

    def update(self, dt: float, dx: float, dy: float, firing: bool, world) -> None:
        self.age += dt
        self.invuln = max(0.0, self.invuln - dt)
        self.cooldown = max(0.0, self.cooldown - dt)
        if not self.alive:
            return
        if dx and dy:
            dx *= DIAGONAL
            dy *= DIAGONAL
        hw, hh = self.sprite.width / 2, self.sprite.height / 2
        self.x = min(max(self.x + dx * self.SPEED * dt, hw), world.width - hw)
        self.y = min(max(self.y + dy * self.SPEED * dt, hh), world.height - hh)
        if firing and self.cooldown <= 0:
            world.fire_player(self.x + hw, self.y + 1)
            self.cooldown = 1.0 / self.FIRE_RATE

    def hit(self, damage: int = 1) -> bool:
        """Apply a hit. Returns False if it was ignored (dead or invulnerable)."""
        if not self.alive or self.invuln > 0 or damage <= 0:
            return False
        self.lives -= damage
        self.invuln = self.INVULN
        if self.lives <= 0:
            self.lives = 0
            self.alive = False
        return True

    def size(self) -> tuple[int, int]:
        return (self.sprite.width - 6, self.sprite.height - 4)

    def rect(self) -> tuple[float, float, float, float]:
        w, h = self.size()
        return (self.x - w / 2, self.y - h / 2, w, h)
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_entities.py -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add kaiko/art.py kaiko/entities.py tests/test_entities.py
git commit -m "Add player, bullets and Kaiko sprite"
```

---

### Task 5: World simulation

**Files:**
- Create: `kaiko/world.py`
- Test: `tests/test_world.py`

**Interfaces:**
- Consumes: `Enemy`, `Bullet`, `Player`, `Sprite`, constants from `kaiko`.
- Produces: `overlaps(a, b) -> bool` for `(x, y, w, h)` tuples. `Particle(x, y, vx, vy, life, color)`. `World(width=320, height=180, seed=None, log=print)` with `time, dt, rng, player, enemies, enemy_bullets, player_bullets, particles, score, errors: list[tuple[str, str]]`; contract methods `fire(x, y, vx, vy, damage=1, sprite=None)` and `spawn(cls, x, y) -> Enemy | None`; engine methods `fire_player(x, y)`, `update(dt=DT, dx=0, dy=0, firing=False)`.

- [ ] **Step 1: Write the failing tests**

`tests/test_world.py`:

```python
import math

from kaiko import DT, HEIGHT, WIDTH
from kaiko.api import Enemy, Sprite
from kaiko.entities import Bullet
from kaiko.world import World, overlaps

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})


def make(**attrs):
    cls_name = attrs.pop("cls_name", "Dummy")
    return type(cls_name, (Enemy,), {"sprite": SPR, **attrs})


def quiet_world(**kw):
    logs = []
    w = World(seed=1, log=lambda *a, **k: logs.append(a), **kw)
    return w, logs


def test_overlaps():
    assert overlaps((0, 0, 2, 2), (1, 1, 2, 2))
    assert not overlaps((0, 0, 2, 2), (2, 0, 2, 2))  # touching edges do not count
    assert not overlaps((0, 0, 2, 2), (5, 5, 2, 2))


def test_spawn_calls_on_spawn_and_returns_instance():
    seen = []
    Cls = make(on_spawn=lambda self, world: seen.append((self.x, self.y)))
    w, _ = quiet_world()
    e = w.spawn(Cls, 100, 50)
    assert e in w.enemies and seen == [(100.0, 50.0)]


def test_fire_adds_enemy_bullet():
    w, _ = quiet_world()
    w.fire(10, 20, -5, 0, damage=2)
    b = w.enemy_bullets[0]
    assert (b.x, b.y, b.vx, b.damage, b.friendly) == (10, 20, -5, 2, False)


def test_player_bullet_kills_enemy_scores_and_calls_hooks():
    calls = []
    Cls = make(
        hp=1,
        score=50,
        on_hit=lambda self, world, dmg: calls.append(("hit", dmg)),
        on_death=lambda self, world: calls.append(("death",)),
    )
    w, _ = quiet_world()
    e = w.spawn(Cls, 100, 90)
    e.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert not e.alive and e not in w.enemies
    assert w.score == 50 and w.player_bullets == []
    assert calls == [("hit", 1), ("death",)]


def test_hit_without_death_flashes_and_keeps_enemy():
    w, _ = quiet_world()
    e = w.spawn(make(hp=3), 100, 90)
    e.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert e.alive and e.hp == 2 and e.flash > 0 and w.score == 0


def test_enemy_bullet_costs_life():
    w, _ = quiet_world()
    w.fire(w.player.x, w.player.y, 0, 0)
    w.update(DT)
    assert w.player.lives == 2 and w.enemy_bullets == []


def test_contact_costs_one_life_per_invulnerability_window():
    w, _ = quiet_world()
    e = w.spawn(make(), w.player.x, w.player.y)
    e.vx = 0
    for _ in range(10):
        w.update(DT)
    assert w.player.lives == 2 and e.alive


def test_offscreen_removal_and_boss_exemption():
    w, _ = quiet_world()
    left = w.spawn(make(), -49, 90)
    right = w.spawn(make(), WIDTH + 97, 90)
    below = w.spawn(make(), 100, HEIGHT + 65)
    boss_right = w.spawn(make(boss=True), WIDTH + 200, 90)
    boss_left = w.spawn(make(boss=True), -49, 90)
    for e in (left, right, below, boss_right, boss_left):
        e.vx = 0
    w.update(DT)
    assert w.enemies == [boss_right]


def test_non_finite_position_removes_enemy():
    def bad_update(self, dt, world):
        self.x = math.nan

    w, _ = quiet_world()
    w.spawn(make(update=bad_update), 100, 90)
    w.update(DT)
    assert w.enemies == []


def test_hook_error_is_isolated_and_logged_once_per_class():
    def boom(self, dt, world):
        raise RuntimeError("boom")

    Cls = make(update=boom, cls_name="Boomer")
    w, logs = quiet_world()
    w.spawn(Cls, 100, 90)
    w.spawn(Cls, 100, 100)
    w.update(DT)
    assert w.enemies == []
    assert len(w.errors) == 2 and w.errors[0][0] == "Boomer" and "boom" in w.errors[0][1]
    assert len(logs) == 1


def test_spawn_of_non_enemy_is_recorded_not_raised():
    w, _ = quiet_world()
    e = w.spawn(make(on_spawn=lambda self, world: world.spawn(int, 0, 0)), 100, 90)
    assert w.errors and e is not None
    assert w.enemies == [e]


def test_broken_constructor_returns_none():
    class Bad(Enemy):
        sprite = SPR

        def __init__(self, x, y):
            raise ValueError("nope")

    w, _ = quiet_world()
    assert w.spawn(Bad, 0, 0) is None
    assert w.errors[0][0] == "Bad"


def test_spawn_during_on_death_keeps_children():
    Child = make(tier=0)

    def split(self, world):
        world.spawn(Child, self.x, self.y - 10)
        world.spawn(Child, self.x, self.y + 10)

    w, _ = quiet_world()
    parent = w.spawn(make(hp=1, on_death=split), 100, 90)
    parent.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert len(w.enemies) == 2 and all(isinstance(e, Child) for e in w.enemies)


def test_death_spawns_particles():
    w, _ = quiet_world()
    e = w.spawn(make(hp=1), 100, 90)
    e.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert w.particles
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_world.py -q`
Expected: `ModuleNotFoundError: kaiko.world`.

- [ ] **Step 3: Implement**

`kaiko/world.py`:

```python
"""World simulation: entities, collisions, culling, and enemy error isolation."""

from __future__ import annotations

import math
import random
import traceback
from dataclasses import dataclass

from kaiko import DT, HEIGHT, WIDTH
from kaiko.api import Enemy
from kaiko.entities import Bullet, Player
from kaiko.sprites import Sprite

CULL_LEFT = 48
CULL_RIGHT = 96
CULL_VERTICAL = 64
FLASH_SECONDS = 0.08


def overlaps(a, b) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


@dataclass
class Particle:
    x: float
    y: float
    vx: float
    vy: float
    life: float
    color: tuple[int, int, int]


class World:
    def __init__(self, width: int = WIDTH, height: int = HEIGHT, seed: int | None = None, log=print):
        self.width = width
        self.height = height
        self.time = 0.0
        self.dt = DT
        self.rng = random.Random(seed)
        self.player = Player(40, height / 2)
        self.enemies: list[Enemy] = []
        self.enemy_bullets: list[Bullet] = []
        self.player_bullets: list[Bullet] = []
        self.particles: list[Particle] = []
        self.score = 0
        self.errors: list[tuple[str, str]] = []
        self._log = log
        self._reported: set[type] = set()

    # --- contract used by enemies ------------------------------------------

    def fire(self, x, y, vx, vy, damage: int = 1, sprite: Sprite | None = None) -> None:
        self.enemy_bullets.append(Bullet(float(x), float(y), float(vx), float(vy), damage, False, sprite))

    def spawn(self, cls, x, y) -> Enemy | None:
        if not (isinstance(cls, type) and issubclass(cls, Enemy)):
            raise TypeError(f"world.spawn needs an Enemy subclass, got {cls!r}")
        try:
            enemy = cls(x, y)
        except Exception:
            self._record(cls, traceback.format_exc())
            return None
        self.enemies.append(enemy)
        self._call(enemy, "on_spawn", self)
        return enemy

    # --- engine side ---------------------------------------------------------

    def fire_player(self, x, y) -> None:
        self.player_bullets.append(Bullet(float(x), float(y), Player.BULLET_SPEED, 0.0, 1, True))

    def update(self, dt: float = DT, dx: float = 0.0, dy: float = 0.0, firing: bool = False) -> None:
        self.time += dt
        self.dt = dt
        self.player.update(dt, dx, dy, firing, self)
        for e in list(self.enemies):
            if not e.alive:
                continue
            e.age += dt
            e.flash = max(0.0, e.flash - dt)
            self._call(e, "update", dt, self)
        for b in self.enemy_bullets:
            b.update(dt)
        for b in self.player_bullets:
            b.update(dt)
        for p in self.particles:
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.life -= dt
        self._collide()
        self._cull()

    def _collide(self) -> None:
        for b in self.player_bullets:
            if not b.alive:
                continue
            br = b.rect()
            for e in list(self.enemies):
                if e.alive and overlaps(br, e.rect()):
                    b.alive = False
                    e.hp -= b.damage
                    e.flash = FLASH_SECONDS
                    self._call(e, "on_hit", self, b.damage)
                    if e.alive and e.hp <= 0:
                        self._die(e)
                    break
        p = self.player
        if not p.alive:
            return
        pr = p.rect()
        for b in self.enemy_bullets:
            if b.alive and overlaps(pr, b.rect()):
                b.alive = False
                p.hit(b.damage)
        for e in list(self.enemies):
            if e.alive and overlaps(pr, e.rect()):
                p.hit(e.contact_damage)

    def _die(self, e: Enemy) -> None:
        e.alive = False
        self.score += e.score
        self._burst(e.x, e.y)
        self._call(e, "on_death", self)

    def _burst(self, x, y, n: int = 10) -> None:
        for _ in range(n):
            a = self.rng.uniform(0, math.tau)
            s = self.rng.uniform(20, 70)
            c = self.rng.choice([(255, 255, 255), (255, 220, 120), (255, 140, 80)])
            self.particles.append(Particle(x, y, math.cos(a) * s, math.sin(a) * s, self.rng.uniform(0.2, 0.5), c))

    def _offscreen(self, e: Enemy) -> bool:
        if not (math.isfinite(e.x) and math.isfinite(e.y)):
            return True
        if e.x < -CULL_LEFT:
            return True
        if e.boss:
            return False
        return e.x > self.width + CULL_RIGHT or e.y < -CULL_VERTICAL or e.y > self.height + CULL_VERTICAL

    def _cull(self) -> None:
        self.enemies = [e for e in self.enemies if e.alive and not self._offscreen(e)]
        w, h = self.width, self.height

        def on_canvas(b: Bullet) -> bool:
            x, y, bw, bh = b.rect()
            return b.alive and x + bw > 0 and x < w and y + bh > 0 and y < h and math.isfinite(x) and math.isfinite(y)

        self.enemy_bullets = [b for b in self.enemy_bullets if on_canvas(b)]
        self.player_bullets = [b for b in self.player_bullets if on_canvas(b)]
        self.particles = [p for p in self.particles if p.life > 0]

    # --- error isolation -----------------------------------------------------

    def _call(self, enemy: Enemy, hook: str, *args) -> None:
        try:
            getattr(enemy, hook)(*args)
        except Exception:
            self._record(type(enemy), traceback.format_exc())
            enemy.kill()

    def _record(self, cls: type, tb: str) -> None:
        self.errors.append((cls.__name__, tb))
        if cls not in self._reported:
            self._reported.add(cls)
            self._log(f"[kaiko] {cls.__name__} raised and was removed:\n{tb}")
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_world.py -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add kaiko/world.py tests/test_world.py
git commit -m "Add World simulation with collisions, culling and error isolation"
```

---

### Task 6: Registry

**Files:**
- Create: `kaiko/registry.py`
- Test: `tests/test_registry.py`

**Interfaces:**
- Consumes: `Enemy`, `Sprite`.
- Produces: `check_class(cls) -> list[str]` (contract problems, empty when fine). `Registry` dataclass with `classes: list[type[Enemy]]` and `failures: list[tuple[str, str]]`. `discover(enemies_dir: Path | None = None, log=print) -> Registry`. `ENEMIES_DIR` constant pointing at `<repo>/enemies`. Each registered class gets `cls.folder = "<folder name>"`.

- [ ] **Step 1: Write the failing tests**

`tests/test_registry.py`:

```python
import textwrap

from kaiko.api import Enemy, Sprite
from kaiko.registry import check_class, discover

GOOD = textwrap.dedent(
    """
    from kaiko.api import Enemy, Sprite

    class {name}(Enemy):
        tier = {tier}
        sprite = Sprite.from_text(["##", "##"], {{"#": "#ffffff"}})
    """
)


def write(root, folder, text):
    d = root / folder
    d.mkdir()
    (d / "__init__.py").write_text(text)


def test_discover_loads_good_skips_underscore_and_isolates_failures(tmp_path):
    write(tmp_path, "good", GOOD.format(name="Good", tier=1))
    write(tmp_path, "_template", GOOD.format(name="Template", tier=1))
    write(tmp_path, "broken", "raise RuntimeError('boom')\n")
    write(tmp_path, "nosprite", "from kaiko.api import Enemy\nclass NoSprite(Enemy):\n    pass\n")
    (tmp_path / "notapkg").mkdir()
    (tmp_path / "stray.py").write_text("x = 1\n")
    logs = []
    reg = discover(tmp_path, log=lambda *a: logs.append(a))
    assert [c.__name__ for c in reg.classes] == ["Good"]
    assert reg.classes[0].folder == "good"
    folders = sorted(f for f, _ in reg.failures)
    assert folders == ["broken", "nosprite"]
    assert any("boom" in msg for _, msg in reg.failures)
    assert any("sprite" in msg for _, msg in reg.failures)
    assert len(logs) == 2


def test_discover_registers_every_subclass_in_module_and_supports_relative_imports(tmp_path):
    d = tmp_path / "pack"
    d.mkdir()
    (d / "parts.py").write_text(GOOD.format(name="Minion", tier=0))
    (d / "__init__.py").write_text(
        "from .parts import Minion\n" + GOOD.format(name="Big", tier=2)
    )
    reg = discover(tmp_path, log=lambda *a: None)
    names = sorted(c.__name__ for c in reg.classes)
    assert names == ["Big", "Minion"]  # classes from the folder's submodules count too
    assert all(c.folder == "pack" for c in reg.classes)
    assert reg.failures == []


def test_discover_missing_dir_is_empty(tmp_path):
    reg = discover(tmp_path / "nothing", log=lambda *a: None)
    assert reg.classes == [] and reg.failures == []


SPR = Sprite.from_text(["#"], {"#": "#ffffff"})


def bad(**attrs):
    return type("X", (Enemy,), {"sprite": SPR, **attrs})


def test_check_class_accepts_minimal():
    assert check_class(bad()) == []


def test_check_class_rejects_bad_values():
    assert check_class(type("X", (Enemy,), {}))  # no sprite
    assert any("tier" in p for p in check_class(bad(tier=6)))
    assert any("tier" in p for p in check_class(bad(tier=True)))
    assert any("weight" in p for p in check_class(bad(weight=0)))
    assert any("hp" in p for p in check_class(bad(hp=0)))
    assert any("score" in p for p in check_class(bad(score=-1)))
    assert any("hitbox" in p for p in check_class(bad(hitbox=(0, 4))))
    assert any("hitbox" in p for p in check_class(bad(hitbox=5)))
    assert any("boss" in p for p in check_class(bad(boss=1)))
    assert any("contact_damage" in p for p in check_class(bad(contact_damage=-1)))
    big = Sprite.from_text(["#" * 97], {"#": "#ffffff"})
    assert any("96" in p for p in check_class(bad(sprite=big)))
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_registry.py -q`
Expected: `ModuleNotFoundError: kaiko.registry`.

- [ ] **Step 3: Implement**

`kaiko/registry.py`:

```python
"""Discovers enemy plugins in enemies/<folder>/__init__.py and isolates failures."""

from __future__ import annotations

import importlib.util
import sys
import traceback
import types
from dataclasses import dataclass, field
from pathlib import Path

from kaiko.api import Enemy
from kaiko.sprites import Sprite

ENEMIES_DIR = Path(__file__).resolve().parent.parent / "enemies"
PACKAGE = "kaiko_enemies"
MAX_SPRITE = 96


@dataclass
class Registry:
    classes: list[type[Enemy]] = field(default_factory=list)
    failures: list[tuple[str, str]] = field(default_factory=list)


def check_class(cls: type) -> list[str]:
    """Return a list of contract violations. Empty means the class is fine."""
    problems = []
    sprite = getattr(cls, "sprite", None)
    if not isinstance(sprite, Sprite):
        problems.append("sprite must be a kaiko.api.Sprite (use Sprite.from_text or Sprite.from_png)")
    elif sprite.width > MAX_SPRITE or sprite.height > MAX_SPRITE:
        problems.append(f"sprite is {sprite.width}x{sprite.height}; the maximum is {MAX_SPRITE}x{MAX_SPRITE}")

    def is_int(v):
        return isinstance(v, int) and not isinstance(v, bool)

    if not is_int(cls.tier) or not 0 <= cls.tier <= 5:
        problems.append(f"tier must be an int from 0 to 5, got {cls.tier!r}")
    if isinstance(cls.weight, bool) or not isinstance(cls.weight, (int, float)) or cls.weight <= 0:
        problems.append(f"weight must be a number > 0, got {cls.weight!r}")
    if not is_int(cls.hp) or cls.hp < 1:
        problems.append(f"hp must be an int >= 1, got {cls.hp!r}")
    if not is_int(cls.score) or cls.score < 0:
        problems.append(f"score must be an int >= 0, got {cls.score!r}")
    if not isinstance(cls.boss, bool):
        problems.append(f"boss must be True or False, got {cls.boss!r}")
    if not is_int(cls.contact_damage) or cls.contact_damage < 0:
        problems.append(f"contact_damage must be an int >= 0, got {cls.contact_damage!r}")
    hb = cls.hitbox
    if hb is not None:
        ok = isinstance(hb, (tuple, list)) and len(hb) == 2 and all(isinstance(v, (int, float)) and v > 0 for v in hb)
        if not ok:
            problems.append(f"hitbox must be None or (width, height) with positive numbers, got {hb!r}")
    return problems


def _ensure_parent_package(root: Path) -> None:
    if PACKAGE not in sys.modules:
        pkg = types.ModuleType(PACKAGE)
        pkg.__path__ = [str(root)]
        sys.modules[PACKAGE] = pkg


def _import_folder(folder: Path) -> types.ModuleType:
    modname = f"{PACKAGE}.{folder.name}"
    spec = importlib.util.spec_from_file_location(
        modname, folder / "__init__.py", submodule_search_locations=[str(folder)]
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[modname] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(modname, None)
        raise
    return module


def discover(enemies_dir: Path | None = None, log=print) -> Registry:
    root = Path(enemies_dir) if enemies_dir is not None else ENEMIES_DIR
    reg = Registry()
    if not root.is_dir():
        return reg
    _ensure_parent_package(root)
    for folder in sorted(root.iterdir()):
        if not folder.is_dir() or folder.name.startswith(("_", ".")):
            continue
        if not (folder / "__init__.py").is_file():
            continue
        try:
            module = _import_folder(folder)
        except Exception:
            tb = traceback.format_exc()
            reg.failures.append((folder.name, tb))
            log(f"[kaiko] could not import enemies/{folder.name}:\n{tb}")
            continue
        for obj in list(vars(module).values()):
            if not (isinstance(obj, type) and issubclass(obj, Enemy) and obj is not Enemy):
                continue
            if not (obj.__module__ == module.__name__ or obj.__module__.startswith(module.__name__ + ".")):
                continue  # imported from somewhere else, not this folder's code
            problems = check_class(obj)
            if problems:
                msg = f"{obj.__name__}: " + "; ".join(problems)
                reg.failures.append((folder.name, msg))
                log(f"[kaiko] skipped enemies/{folder.name} {msg}")
                continue
            obj.folder = folder.name
            reg.classes.append(obj)
    return reg
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_registry.py -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add kaiko/registry.py tests/test_registry.py
git commit -m "Add enemy plugin registry with contract checks"
```

---

### Task 7: Director

**Files:**
- Create: `kaiko/director.py`
- Test: `tests/test_director.py`

**Interfaces:**
- Consumes: `World.spawn`, `World.rng`, `World.time`, `Enemy` class attrs.
- Produces: `Director(classes, only=False)` with `regular`, `bosses`, `boss`, `timer`, `next_boss`, methods `unlocked_tiers(t) -> list[int]`, `interval(t) -> float`, `pick(t, rng) -> type[Enemy] | None`, `update(dt, world)`. Constants `TIER_SECONDS = 20`, `MAX_INTERVAL = 1.5`, `MIN_INTERVAL = 0.5`, `RAMP_SECONDS = 120`, `BOSS_EVERY = 60`, `ONLY_INTERVAL = 0.7`.

- [ ] **Step 1: Write the failing tests**

`tests/test_director.py`:

```python
import random

from kaiko import DT
from kaiko.api import Enemy, Sprite
from kaiko.director import Director
from kaiko.world import World

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})


def make(name, **attrs):
    return type(name, (Enemy,), {"sprite": SPR, **attrs})


T1 = make("T1", tier=1)
T2 = make("T2", tier=2)
T3 = make("T3", tier=3)
T0 = make("T0", tier=0)
BOSS = make("Boss", boss=True, tier=1)


def world():
    return World(seed=3, log=lambda *a: None)


def test_pools_exclude_tier_zero_and_split_bosses():
    d = Director([T1, T2, T0, BOSS])
    assert d.regular == [T1, T2] and d.bosses == [BOSS]


def test_tier_unlock_schedule():
    d = Director([T1, T2, T3])
    assert d.unlocked_tiers(0) == [1]
    assert d.unlocked_tiers(19.9) == [1]
    assert d.unlocked_tiers(20) == [1, 2]
    assert d.unlocked_tiers(40) == [1, 2, 3]


def test_interval_ramps_and_only_mode():
    d = Director([T1])
    assert d.interval(0) == 1.5
    assert abs(d.interval(60) - 1.0) < 1e-9
    assert d.interval(120) == 0.5
    assert d.interval(999) == 0.5
    assert Director([T1], only=True).interval(0) == 0.7


def test_pick_respects_unlocked_tiers_and_weights():
    rng = random.Random(0)
    d = Director([T1, T2, T3])
    assert all(d.pick(0, rng) is T1 for _ in range(30))
    picks = {d.pick(40, rng).__name__ for _ in range(200)}
    assert picks == {"T1", "T2", "T3"}
    assert Director([]).pick(0, rng) is None


def test_update_spawns_immediately_then_waits_for_interval():
    w = world()
    d = Director([T1])
    d.update(DT, w)
    assert len(w.enemies) == 1
    e = w.enemies[0]
    assert e.x > w.width and SPR.height / 2 <= e.y <= w.height - SPR.height / 2
    for _ in range(int(1.4 / DT)):
        w.update(DT)
        d.update(DT, w)
    assert len(w.enemies) == 1
    for _ in range(int(0.2 / DT)):
        w.update(DT)
        d.update(DT, w)
    assert len(w.enemies) == 2


def test_no_classes_means_no_spawns_no_crash():
    w = world()
    d = Director([])
    for _ in range(100):
        d.update(DT, w)
    assert w.enemies == []


def test_boss_pauses_regular_spawns_and_reschedules_after_death():
    w = world()
    d = Director([T1, BOSS])
    w.time = 60.0
    d.update(DT, w)
    assert len(w.enemies) == 1 and isinstance(w.enemies[0], BOSS)
    boss = w.enemies[0]
    assert boss.y == w.height / 2
    for _ in range(300):
        w.time += DT
        d.update(DT, w)
    assert w.enemies == [boss]
    boss.kill()
    w.update(DT)
    d.update(DT, w)
    assert d.boss is None
    assert d.next_boss > w.time + 50
    assert all(not isinstance(e, BOSS) for e in w.enemies)


def test_only_mode_spawns_boss_quickly():
    w = world()
    d = Director([BOSS], only=True)
    for _ in range(int(1.2 / DT)):
        w.update(DT)
        d.update(DT, w)
    assert any(isinstance(e, BOSS) for e in w.enemies)
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_director.py -q`
Expected: `ModuleNotFoundError: kaiko.director`.

- [ ] **Step 3: Implement**

`kaiko/director.py`:

```python
"""Time-based spawner: unlocks tiers, ramps spawn rate, schedules bosses."""

from __future__ import annotations

import random

from kaiko.api import Enemy


class Director:
    TIER_SECONDS = 20.0
    MAX_INTERVAL = 1.5
    MIN_INTERVAL = 0.5
    RAMP_SECONDS = 120.0
    BOSS_EVERY = 60.0
    ONLY_INTERVAL = 0.7

    def __init__(self, classes: list[type[Enemy]], only: bool = False):
        self.regular = [c for c in classes if c.tier >= 1 and not c.boss]
        self.bosses = [c for c in classes if c.boss]
        self.only = only
        self.timer = 0.0
        self.next_boss = 1.0 if only else self.BOSS_EVERY
        self.boss: Enemy | None = None

    def unlocked_tiers(self, t: float) -> list[int]:
        return sorted({c.tier for c in self.regular if (c.tier - 1) * self.TIER_SECONDS <= t})

    def interval(self, t: float) -> float:
        if self.only:
            return self.ONLY_INTERVAL
        f = min(1.0, max(0.0, t / self.RAMP_SECONDS))
        return self.MAX_INTERVAL + (self.MIN_INTERVAL - self.MAX_INTERVAL) * f

    def pick(self, t: float, rng: random.Random) -> type[Enemy] | None:
        tiers = self.unlocked_tiers(t)
        if not tiers:
            return None
        tier = rng.choices(tiers, weights=tiers)[0]
        pool = [c for c in self.regular if c.tier == tier]
        return rng.choices(pool, weights=[c.weight for c in pool])[0]

    def update(self, dt: float, world) -> None:
        if self.boss is not None:
            if self.boss.alive and self.boss in world.enemies:
                return
            self.boss = None
            self.next_boss = world.time + (2.0 if self.only else self.BOSS_EVERY)
        if self.bosses and world.time >= self.next_boss:
            cls = world.rng.choice(self.bosses)
            self.boss = world.spawn(cls, world.width + cls.sprite.width / 2, world.height / 2)
            if self.boss is None:
                self.next_boss = world.time + self.BOSS_EVERY
            return
        self.timer -= dt
        if self.timer <= 0:
            cls = self.pick(world.time, world.rng)
            if cls is not None:
                sw, sh = cls.sprite.width, cls.sprite.height
                lo, hi = sh / 2, max(sh / 2, world.height - sh / 2)
                world.spawn(cls, world.width + sw / 2, world.rng.uniform(lo, hi))
            self.timer = self.interval(world.time)
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_director.py -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add kaiko/director.py tests/test_director.py
git commit -m "Add Director spawner with tiers, ramp and bosses"
```

---

### Task 8: Template and example enemies

**Files:**
- Create: `enemies/_template/__init__.py`, `enemies/paperwork_blob/__init__.py`, `enemies/fax_machine/__init__.py`, `enemies/legacy_ehr/__init__.py`
- Test: `tests/test_examples.py`

**Interfaces:**
- Consumes: `kaiko.api.Enemy`, `Sprite`, `WorldView`.
- Produces: three shipped example folders that pass `check_class` and demonstrate sine movement plus aimed shots, minion spawning on death, and a boss.

- [ ] **Step 1: Write the failing test**

`tests/test_examples.py`:

```python
from kaiko.registry import ENEMIES_DIR, discover


def test_shipped_examples_load():
    reg = discover(ENEMIES_DIR, log=lambda *a: None)
    folders = sorted({c.folder for c in reg.classes})
    assert folders == ["fax_machine", "legacy_ehr", "paperwork_blob"]
    assert reg.failures == []
    assert any(c.boss for c in reg.classes)
    assert any(c.tier == 0 for c in reg.classes)
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_examples.py -q`
Expected: FAIL, folders list is empty.

- [ ] **Step 3: Write the template**

`enemies/_template/__init__.py`:

```python
"""TEMPLATE. Copy this folder:  cp -r enemies/_template enemies/my_enemy

Then edit this file. Folders starting with _ are ignored by the game.
Full contract: ENEMY_SPEC.md. Test with:
    uv run python -m kaiko.validate
    uv run kaiko --only my_enemy --windowed
"""

import math

from kaiko.api import Enemy, Sprite

# Pixel art as text. One character per pixel, "." is transparent.
# Every row must be the same length. Keep enemies around 16 to 32 px.
PALETTE = {
    "r": "#d94f4f",
    "w": "#f4f1e6",
    "k": "#222222",
}

FRAME_A = [
    "....rrrrrrrr....",
    "..rrrrrrrrrrrr..",
    ".rrrkkrrrrkkrrr.",
    ".rrrkkrrrrkkrrr.",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrwwwwwwwwrrrr",
    "rrrrrrrrrrrrrrrr",
    ".rrrrrrrrrrrrrr.",
    "..rrrrrrrrrrrr..",
    "....rrrrrrrr....",
    "................",
]

FRAME_B = [
    "................",
    "....rrrrrrrr....",
    "..rrrrrrrrrrrr..",
    ".rrrkkrrrrkkrrr.",
    ".rrrkkrrrrkkrrr.",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrwwwwwwwwrrrr",
    "rrrrrrrrrrrrrrrr",
    ".rrrrrrrrrrrrrr.",
    "..rrrrrrrrrrrr..",
    "....rrrrrrrr....",
]


class MyEnemy(Enemy):
    name = "My Enemy"  # shown in logs and the validator
    tier = 1  # 1 (easy) .. 5 (hard). 0 = only spawned by other enemies via world.spawn
    weight = 1.0  # how often it is picked relative to others in its tier
    boss = False  # True: spawns alone at boss time, regular spawns pause
    hp = 3  # player torpedoes deal 1
    score = 100
    sprite = Sprite.from_text([FRAME_A, FRAME_B], PALETTE, fps=4)
    # sprite = Sprite.from_png("my_enemy.png", frame_w=16, fps=6)   # PNG strip next to this file
    hitbox = None  # (w, h) to override the sprite size

    def on_spawn(self, world):
        # self.x, self.y are set (just off the right edge). Defaults: vx=-40, vy=0.
        self.base_y = self.y
        self.phase = world.rng.uniform(0, math.tau)
        self.next_shot = world.rng.uniform(1.0, 2.0)

    def update(self, dt, world):
        super().update(dt, world)  # moves by (vx, vy)
        self.y = self.base_y + 10 * math.sin(self.age * 3 + self.phase)
        self.next_shot -= dt
        if self.next_shot <= 0 and self.x < world.width:
            world.fire(self.x - 8, self.y, -100, 0)  # a bullet flying left
            self.next_shot = 2.0

    def on_hit(self, world, damage):
        pass  # e.g. speed up when hurt: self.vx *= 1.2

    def on_death(self, world):
        pass  # e.g. world.spawn(Minion, self.x, self.y) for tier-0 minions
```

- [ ] **Step 4: Write the Paperwork Blob**

`enemies/paperwork_blob/__init__.py`:

```python
"""Paperwork Blob: a wad of forms that drifts in a sine wave and throws paper at Kaiko."""

import math

from kaiko.api import Enemy, Sprite

PALETTE = {"w": "#f4f1e6", "g": "#b9b3a3", "k": "#2b2b2b", "r": "#d94f4f"}

FRAME_A = [
    "....wwwwwwww....",
    "..wwwwwwwwwwww..",
    ".wwwwwwwwwwwwww.",
    ".wwkkwwwwwwkkww.",
    "wwwkkwwwwwwkkwww",
    "wwwwwwwwwwwwwwww",
    "wwggggwwwwggggww",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwrrwwwwwww",
    "wwwwwwrrrrwwwwww",
    ".wwwwwwwwwwwwww.",
    ".wwggggggggggww.",
    "..wwwwwwwwwwww..",
    "...wwwwwwwwww...",
    "....wwwwwwww....",
    "................",
]

FRAME_B = [
    "................",
    "....wwwwwwww....",
    "..wwwwwwwwwwww..",
    ".wwwwwwwwwwwwww.",
    ".wwkkwwwwwwkkww.",
    "wwwkkwwwwwwkkwww",
    "wwwwwwwwwwwwwwww",
    "wwggggwwwwggggww",
    "wwwwwwwrrwwwwwww",
    "wwwwwwrrrrwwwwww",
    "wwwwwwwwwwwwwwww",
    ".wwggggggggggww.",
    ".wwwwwwwwwwwwww.",
    "..wwwwwwwwwwww..",
    "....wwwwwwww....",
    "................",
]

PAPER = Sprite.from_text(["www", "wgw", "www"], PALETTE)


class PaperworkBlob(Enemy):
    name = "Paperwork Blob"
    tier = 1
    weight = 1.0
    hp = 3
    score = 100
    sprite = Sprite.from_text([FRAME_A, FRAME_B], PALETTE, fps=4)

    def on_spawn(self, world):
        self.vx = -35.0
        self.base_y = self.y
        self.phase = world.rng.uniform(0, math.tau)
        self.next_shot = world.rng.uniform(1.0, 2.5)

    def update(self, dt, world):
        super().update(dt, world)
        self.y = self.base_y + 12 * math.sin(self.age * 2 + self.phase)
        self.next_shot -= dt
        if self.next_shot <= 0 and self.x < world.width - 8:
            dx = world.player.x - self.x
            dy = world.player.y - self.y
            d = math.hypot(dx, dy) or 1.0
            world.fire(self.x - 6, self.y, 90 * dx / d, 90 * dy / d, sprite=PAPER)
            self.next_shot = world.rng.uniform(1.5, 3.0)
```

- [ ] **Step 5: Write the Fax Machine**

`enemies/fax_machine/__init__.py`:

```python
"""Fax Machine: a slow brick that bursts into loose fax sheets when destroyed."""

from kaiko.api import Enemy, Sprite

PALETTE = {"g": "#8d949c", "d": "#555c64", "w": "#f4f1e6", "k": "#1e2328", "r": "#e05a4f", "l": "#a9b0b8"}

MACHINE = [
    "..wwwwwwww..........",
    "..wwwwwwww..........",
    "gggggggggggggggggggg",
    "gllllllllllllllllllg",
    "glkkkkkkkkkkkkkkkklg",
    "glkrkkkkkkkkkkkkkklg",
    "gllllllllllllllllllg",
    "gggggggggggggggggggg",
    "gddddddddddddddddddg",
    "gdggggggggggggggggdg",
    "gdggggggggggggggggdg",
    "gddddddddddddddddddg",
    "gggggggggggggggggggg",
    ".dd..............dd.",
]

SHEET_A = [
    "wwwwwwww",
    "wggggggw",
    "wwwwwwww",
    "wggggggw",
    "wwwwwwww",
    "wgggwwww",
    "wwwwwwww",
    "wwwwwwww",
]
SHEET_B = [
    ".wwwwwww",
    ".wggggww",
    "wwwwwwww",
    "wggggggw",
    "wwwwwwww",
    "wgggwwww",
    "wwwwwww.",
    "wwwwwww.",
]


class FaxSheet(Enemy):
    """Tier 0: never picked by the director, only spawned by the Fax Machine."""

    name = "Fax Sheet"
    tier = 0
    hp = 1
    score = 20
    sprite = Sprite.from_text([SHEET_A, SHEET_B], PALETTE, fps=6)

    def on_spawn(self, world):
        self.vx = world.rng.uniform(-90, -50)
        self.vy = world.rng.uniform(-50, 50)

    def update(self, dt, world):
        super().update(dt, world)
        self.vy *= 0.98  # flutter settles


class FaxMachine(Enemy):
    name = "Fax Machine"
    tier = 2
    weight = 1.0
    hp = 6
    score = 250
    sprite = Sprite.from_text(MACHINE, PALETTE)
    hitbox = (20, 12)

    def on_spawn(self, world):
        self.vx = -25.0

    def on_hit(self, world, damage):
        self.vx -= 3.0  # panics and speeds up a bit with each hit

    def on_death(self, world):
        for _ in range(3):
            world.spawn(FaxSheet, self.x, self.y)
```

- [ ] **Step 6: Write the Legacy EHR boss**

`enemies/legacy_ehr/__init__.py`:

```python
"""Legacy EHR: the boss. A beige CRT that parks on the right and sprays error dialogs."""

import math

from kaiko.api import Enemy, Sprite

PALETTE = {"b": "#d8cfb4", "d": "#a89f86", "k": "#1a1f1a", "g": "#39ff7a", "e": "#1f7a3c", "r": "#e05a4f"}


def _screen(cursor: str) -> list[str]:
    rows = [
        "..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
        ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
        "bbkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkegggggggeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeggggggggggggeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkegggggeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeggggggggggggggggggeeeeeeeeeeeeeeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkegggggggeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkerrrrrrrrrrrrrrrrrrrrrrrrrrrrrrreeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        f"bbke{cursor}eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekbb",
        "bbkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkbb",
        ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
        ".bbbbbbbbbbbbbbbrrbbbbbbbbbbbbbbbbbbbbb.",
        "..dddddddddddddddddddddddddddddddddddd..",
        "..........dddddddddddddddddd............",
        "..........dddddddddddddddddd............",
        "......dddddddddddddddddddddddddd........",
    ]
    return [r[:40].ljust(40, ".") for r in rows]


DIALOG = Sprite.from_text(["rrrrr", "rkkkr", "rrrrr"], PALETTE)


class LegacyEHR(Enemy):
    name = "Legacy EHR"
    tier = 3
    boss = True
    hp = 60
    score = 2000
    sprite = Sprite.from_text([_screen("g"), _screen("e")], PALETTE, fps=2)
    hitbox = (36, 24)

    def on_spawn(self, world):
        self.vx = -30.0
        self.vy = 35.0
        self.park_x = world.width - 32
        self.next_spread = 1.5

    def update(self, dt, world):
        super().update(dt, world)
        if self.x <= self.park_x:
            self.x = self.park_x
            self.vx = 0.0
        top, bottom = 20, world.height - 20
        if self.y < top:
            self.y, self.vy = top, abs(self.vy)
        elif self.y > bottom:
            self.y, self.vy = bottom, -abs(self.vy)
        if self.vx != 0:
            return
        self.next_spread -= dt
        if self.next_spread <= 0:
            for i in range(-2, 3):
                angle = math.pi + i * 0.22
                world.fire(self.x - 18, self.y, 80 * math.cos(angle), 80 * math.sin(angle), sprite=DIALOG)
            self.next_spread = 1.2 if self.hp > 20 else 0.7
```

- [ ] **Step 7: Run tests**

Run: `uv run pytest tests/test_examples.py -q`
Expected: pass. If `Sprite.from_text` raises on a row length, fix the row in that file (every row in `_screen` must be exactly 40 wide; the helper pads or trims to 40).

- [ ] **Step 8: Commit**

```bash
git add enemies tests/test_examples.py
git commit -m "Add enemy template and three example enemies"
```

---

### Task 9: Validator

**Files:**
- Create: `kaiko/validate.py`
- Test: `tests/test_validate.py`

**Interfaces:**
- Consumes: `discover`, `check_class`, `World`, `Bullet`, `DT`.
- Produces: `validate_class(cls) -> list[str]`, `main(argv=None) -> int` printing a table and returning 1 on any failure.

- [ ] **Step 1: Write the failing tests**

`tests/test_validate.py`:

```python
from kaiko.api import Enemy, Sprite
from kaiko.validate import main, validate_class

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})


def make(**attrs):
    return type("V", (Enemy,), {"sprite": SPR, **attrs})


def test_good_class_passes():
    assert validate_class(make()) == []


def test_contract_violation_reported():
    assert any("tier" in p for p in validate_class(make(tier=9)))


def test_raising_update_reported():
    def boom(self, dt, world):
        raise RuntimeError("kaboom")

    problems = validate_class(make(update=boom))
    assert problems and "kaboom" in "".join(problems)


def test_broken_on_spawn_reported():
    def boom(self, world):
        raise KeyError("missing")

    assert validate_class(make(on_spawn=boom))


def test_immortal_enemy_reported():
    def heal(self, world, damage):
        self.hp = 99

    problems = validate_class(make(on_hit=heal))
    assert any("die" in p for p in problems)


def test_main_passes_on_shipped_enemies(capsys):
    assert main([]) == 0
    out = capsys.readouterr().out
    assert "PASS" in out and "Paperwork Blob" in out
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_validate.py -q`
Expected: `ModuleNotFoundError: kaiko.validate`.

- [ ] **Step 3: Implement**

`kaiko/validate.py`:

```python
"""Checks every enemy under enemies/ against the contract.

    uv run python -m kaiko.validate
"""

from __future__ import annotations

import os
import sys
import traceback

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame  # noqa: E402

from kaiko import DT  # noqa: E402
from kaiko.entities import Bullet  # noqa: E402
from kaiko.registry import check_class, discover  # noqa: E402
from kaiko.world import World  # noqa: E402

TICKS = 120


def validate_class(cls) -> list[str]:
    problems = check_class(cls)
    if problems:
        return problems
    world = World(seed=0, log=lambda *a, **k: None)
    try:
        first = world.spawn(cls, world.width - 40, world.height / 2)
        if first is None:
            return [f"constructor failed:\n{world.errors[-1][1]}"]
        for _ in range(TICKS):
            world.update(DT)
        first.kill()
        world.update(DT)
        victim = world.spawn(cls, world.width / 2, world.height / 2)
        if victim is None:
            return [f"constructor failed:\n{world.errors[-1][1]}"]
        victim.hp = 1
        world.player_bullets.append(Bullet(victim.x, victim.y, 0, 0, friendly=True))
        world.update(DT)
        if victim.alive and not world.errors:
            problems.append(
                "enemy did not die from a 1-damage hit at hp=1 "
                "(does on_hit reset hp, or does update() teleport it away?)"
            )
    except Exception:
        problems.append(traceback.format_exc())
    for name, tb in world.errors:
        problems.append(f"{name} raised:\n{tb}")
    return problems


def main(argv=None) -> int:
    pygame.init()
    reg = discover(log=lambda *a, **k: None)
    rows = []
    failed = 0
    for folder, msg in reg.failures:
        failed += 1
        rows.append((folder, folder, "-", "-", "-", "-", "FAIL", msg))
    for cls in reg.classes:
        problems = validate_class(cls)
        sprite = f"{cls.sprite.width}x{cls.sprite.height}"
        tier = f"{cls.tier}{' boss' if cls.boss else ''}"
        if problems:
            failed += 1
            rows.append((cls.display_name(), cls.folder, tier, cls.weight, cls.hp, sprite, "FAIL", "\n".join(problems)))
        else:
            rows.append((cls.display_name(), cls.folder, tier, cls.weight, cls.hp, sprite, "PASS", ""))
    print(f"{'NAME':<24}{'FOLDER':<20}{'TIER':<8}{'WEIGHT':<8}{'HP':<5}{'SPRITE':<9}RESULT")
    for name, folder, tier, weight, hp, sprite, result, detail in rows:
        print(f"{name:<24}{folder:<20}{tier:<8}{weight!s:<8}{hp!s:<5}{sprite:<9}{result}")
        if detail:
            for line in detail.rstrip().splitlines():
                print("    " + line)
    total = len(rows)
    print(f"\n{total - failed}/{total} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_validate.py -q && uv run python -m kaiko.validate`
Expected: tests pass; the table lists Fax Machine, Fax Sheet, Legacy EHR and Paperwork Blob as PASS.

- [ ] **Step 5: Commit**

```bash
git add kaiko/validate.py tests/test_validate.py
git commit -m "Add enemy validator"
```

---

### Task 10: Renderer, game loop and CLI

**Files:**
- Create: `kaiko/render.py`, `kaiko/game.py`, `kaiko/__main__.py`
- Test: `tests/test_render.py`, `tests/test_cli.py`

**Interfaces:**
- Consumes: `World`, `Director`, `discover`, `Sprite`, constants.
- Produces: `Renderer(windowed: bool)` with `scale`, `offset`, `canvas`, `draw(world, state: str)`; `Background.draw(canvas, t)`. `Game(classes, windowed=False, seed=None, only=False).run()`. `main(argv=None) -> int` with flags `--windowed`, `--only FOLDER`, `--seed N`, `--list`.

- [ ] **Step 1: Write the failing tests**

`tests/test_render.py`:

```python
from kaiko import DT
from kaiko.api import Enemy, Sprite
from kaiko.render import Renderer
from kaiko.world import World

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})
Dummy = type("Dummy", (Enemy,), {"sprite": SPR})


def test_windowed_scale_and_offset():
    r = Renderer(windowed=True)
    assert r.scale == 4 and r.offset == (0, 0)
    assert r.canvas.get_size() == (320, 180)


def test_draw_every_state_without_error():
    r = Renderer(windowed=True)
    w = World(seed=0, log=lambda *a: None)
    e = w.spawn(Dummy, 200, 90)
    e.flash = 0.05
    w.fire(150, 90, -10, 0)
    w.player.invuln = 0.5
    w.update(DT, 0, 0, True)
    for state in ("title", "playing", "gameover"):
        r.draw(w, state)
    assert r.canvas.get_at((round(e.x), round(e.y)))[:3] == (255, 255, 255)
```

`tests/test_cli.py`:

```python
from kaiko.__main__ import main


def test_list_prints_enemies(capsys):
    assert main(["--list"]) == 0
    out = capsys.readouterr().out
    assert "paperwork_blob" in out


def test_only_unknown_folder_fails_fast(capsys):
    assert main(["--only", "does_not_exist"]) == 1
    out = capsys.readouterr().out
    assert "paperwork_blob" in out  # lists what is available
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_render.py tests/test_cli.py -q`
Expected: `ModuleNotFoundError: kaiko.render`.

- [ ] **Step 3: Implement the renderer**

`kaiko/render.py`:

```python
"""Draws the world to a 320x180 canvas and integer-scales it to the screen."""

from __future__ import annotations

import random

import pygame

from kaiko import HEIGHT, WIDTH
from kaiko.art import KAIKO

BLACK = (0, 0, 0)
DEEP = (8, 22, 46)
PLAYER_BULLET = (255, 240, 160)
ENEMY_BULLET = (255, 96, 96)
HUD = (220, 236, 255)


class Background:
    def __init__(self, seed: int = 7):
        rng = random.Random(seed)
        self.far = [(rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT - 16)) for _ in range(45)]
        self.near = [(rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT - 16), rng.choice((2, 2, 3))) for _ in range(18)]
        self.rocks = [(rng.uniform(0, WIDTH * 2), rng.randint(4, 14), rng.randint(10, 26)) for _ in range(16)]

    def draw(self, c: pygame.Surface, t: float) -> None:
        for i in range(6):
            pygame.draw.rect(c, (DEEP[0] + i * 2, DEEP[1] + i * 4, DEEP[2] + i * 7), (0, i * 30, WIDTH, 30))
        for x, y in self.far:
            c.set_at((int((x - t * 12) % WIDTH), int(y)), (26, 64, 104))
        for x, y, s in self.near:
            pygame.draw.rect(c, (44, 110, 160), (int((x - t * 36) % WIDTH), int(y), s, s))
        pygame.draw.rect(c, (4, 12, 26), (0, HEIGHT - 10, WIDTH, 10))
        for x, h, w in self.rocks:
            rx = int((x - t * 48) % (WIDTH * 2)) - w
            pygame.draw.rect(c, (6, 16, 32), (rx, HEIGHT - 10 - h, w, h))


class Renderer:
    def __init__(self, windowed: bool):
        if windowed:
            self.screen = pygame.display.set_mode((1280, 720))
        else:
            self.screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
        pygame.display.set_caption("Kaiko")
        pygame.mouse.set_visible(windowed)
        self.canvas = pygame.Surface((WIDTH, HEIGHT))
        sw, sh = self.screen.get_size()
        self.scale = max(1, min(sw // WIDTH, sh // HEIGHT))
        self.offset = ((sw - WIDTH * self.scale) // 2, (sh - HEIGHT * self.scale) // 2)
        self.font = pygame.font.Font(None, 14)
        self.big = pygame.font.Font(None, 26)
        self.background = Background()
        self._life_icon = pygame.transform.scale(KAIKO.frames[0], (12, 6))

    def _blit_centered(self, surf: pygame.Surface, x: float, y: float) -> None:
        self.canvas.blit(surf, (round(x - surf.get_width() / 2), round(y - surf.get_height() / 2)))

    def _text(self, text: str, x: int, y: int, font=None, center=False) -> None:
        img = (font or self.font).render(text, False, HUD)
        if center:
            x -= img.get_width() // 2
        self.canvas.blit(img, (x, y))

    def draw(self, world, state: str) -> None:
        c = self.canvas
        self.background.draw(c, pygame.time.get_ticks() / 1000.0)
        for e in world.enemies:
            frame = e.sprite.flash_at(e.age) if e.flash > 0 else e.sprite.frame_at(e.age)
            self._blit_centered(frame, e.x, e.y)
        for b in world.enemy_bullets:
            if b.sprite is not None:
                self._blit_centered(b.sprite.frame_at(b.age), b.x, b.y)
            else:
                x, y, w, h = b.rect()
                pygame.draw.rect(c, ENEMY_BULLET, (round(x), round(y), w, h))
        for b in world.player_bullets:
            x, y, w, h = b.rect()
            pygame.draw.rect(c, PLAYER_BULLET, (round(x), round(y), w, h))
        p = world.player
        if p.alive and (p.invuln <= 0 or int(p.age * 20) % 2 == 0):
            self._blit_centered(p.sprite.frame_at(p.age), p.x, p.y)
        for pt in world.particles:
            c.set_at((int(pt.x) % WIDTH, int(pt.y) % HEIGHT), pt.color)
        self._text(f"SCORE {world.score:06d}", 4, 3)
        for i in range(p.lives):
            c.blit(self._life_icon, (WIDTH - 16 - i * 14, 4))
        if state == "title":
            self._text("KAIKO", WIDTH // 2, 50, self.big, center=True)
            self._text("solve healthcare", WIDTH // 2, 72, center=True)
            self._text("arrows/WASD move   space fire   esc quit", WIDTH // 2, 110, center=True)
            self._text("press SPACE", WIDTH // 2, 130, center=True)
        elif state == "gameover":
            self._text("GAME OVER", WIDTH // 2, 60, self.big, center=True)
            self._text(f"score {world.score}", WIDTH // 2, 86, center=True)
            self._text("R restart   ESC quit", WIDTH // 2, 110, center=True)
        scaled = pygame.transform.scale(c, (WIDTH * self.scale, HEIGHT * self.scale))
        self.screen.fill(BLACK)
        self.screen.blit(scaled, self.offset)
        pygame.display.flip()
```

- [ ] **Step 4: Implement the game loop and CLI**

`kaiko/game.py`:

```python
"""Main loop and game states."""

from __future__ import annotations

import pygame

from kaiko import DT, FPS
from kaiko.director import Director
from kaiko.render import Renderer
from kaiko.world import World


class Game:
    def __init__(self, classes, windowed: bool = False, seed: int | None = None, only: bool = False):
        self.classes = classes
        self.windowed = windowed
        self.seed = seed
        self.only = only
        self.state = "title"
        self.new_world()

    def new_world(self) -> None:
        self.world = World(seed=self.seed)
        self.director = Director(self.classes, only=self.only)

    def handle_key(self, key: int) -> bool:
        """Returns False when the game should quit."""
        if key == pygame.K_ESCAPE:
            return False
        if self.state == "title" and key == pygame.K_SPACE:
            self.state = "playing"
        elif self.state == "gameover" and key == pygame.K_r:
            self.new_world()
            self.state = "playing"
        return True

    def step(self, keys) -> None:
        if self.state != "playing":
            return
        dx = (keys[pygame.K_RIGHT] or keys[pygame.K_d]) - (keys[pygame.K_LEFT] or keys[pygame.K_a])
        dy = (keys[pygame.K_DOWN] or keys[pygame.K_s]) - (keys[pygame.K_UP] or keys[pygame.K_w])
        self.world.update(DT, dx, dy, bool(keys[pygame.K_SPACE]))
        self.director.update(DT, self.world)
        if not self.world.player.alive:
            self.state = "gameover"

    def run(self) -> None:
        pygame.init()
        renderer = Renderer(self.windowed)
        clock = pygame.time.Clock()
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    running = self.handle_key(event.key)
            self.step(pygame.key.get_pressed())
            renderer.draw(self.world, self.state)
            clock.tick(FPS)
        pygame.quit()
```

`kaiko/__main__.py`:

```python
"""Command line entry point: `uv run kaiko` or `uv run python -m kaiko`."""

from __future__ import annotations

import argparse

from kaiko.registry import discover


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="kaiko", description="Kaiko solves healthcare.")
    parser.add_argument("--windowed", action="store_true", help="1280x720 window instead of full screen")
    parser.add_argument("--only", metavar="FOLDER", help="spawn only the enemies from enemies/FOLDER, fast")
    parser.add_argument("--seed", type=int, default=None, help="random seed for a reproducible run")
    parser.add_argument("--list", action="store_true", help="list discovered enemies and exit")
    args = parser.parse_args(argv)

    reg = discover()
    folders = sorted({c.folder for c in reg.classes})
    if args.list:
        for c in reg.classes:
            kind = "boss" if c.boss else f"tier {c.tier}"
            print(f"{c.folder:<20} {c.display_name():<24} {kind}")
        return 0
    classes = reg.classes
    if args.only:
        classes = [c for c in classes if c.folder == args.only]
        if not classes:
            print(f"No enemies found in enemies/{args.only}. Available: {', '.join(folders) or 'none'}")
            return 1
    print(f"[kaiko] loaded {len(classes)} enemies from {len(folders)} folders")
    from kaiko.game import Game

    Game(classes, windowed=args.windowed, seed=args.seed, only=bool(args.only)).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run tests and a manual smoke run**

Run: `uv run pytest -q`
Expected: all pass.

Run: `uv run kaiko --windowed --seed 1` and play for 30 seconds. Expected: title screen, blobs and fax machines appear, torpedoes kill them, score increases, hits blink Kaiko, Esc quits. Then `uv run kaiko --only legacy_ehr --windowed` and confirm the boss parks and fires spreads.

- [ ] **Step 6: Commit**

```bash
git add kaiko/render.py kaiko/game.py kaiko/__main__.py tests/test_render.py tests/test_cli.py
git commit -m "Add renderer, game loop and CLI"
```

---

### Task 11: Contributor spec and README

**Files:**
- Create: `ENEMY_SPEC.md`, `README.md`

- [ ] **Step 1: Write ENEMY_SPEC.md**

Cover, in this order, each in a short section with a code block where useful: the 4-step workflow (copy template, edit, validate, play-test with `--only`); the folder rule (one folder, only your folder, `_` prefix ignored); the full class attribute table from the spec with defaults; the four hooks with signatures and when they run; what `world` exposes (`width`, `height`, `time`, `dt`, `rng`, `player.x/y/alive`, `enemies`, `fire(...)`, `spawn(...)`); instance state (`x, y, vx, vy, hp, age, alive`, `kill()`); coordinates and units (320x180, centre-based, px/s, y down, enemies enter at the right edge, face left); sprite rules (text grid format with example, PNG strips with `frame_w`, max 96, typical 16 to 32, bosses to 64); engine rules that matter to authors (player torpedo damage 1, contact and bullets each cost a life, removal margins, bosses exempt except to the left, tier unlock times, boss every 60 s); the do-not list (no `__init__` override, no engine imports beyond `kaiko.api`, no importing other enemy folders, no global mutable state shared between instances, no blocking calls, keep `update` cheap); a "prompt to paste into Claude" block that tells an assistant to read `ENEMY_SPEC.md` and `enemies/paperwork_blob/__init__.py` and build a new enemy folder for a named healthcare problem.

- [ ] **Step 2: Write README.md**

Contents: one-paragraph pitch; install (`uv sync`); run (`uv run kaiko`, `--windowed`, `--only`, `--list`, `--seed`); validate (`uv run python -m kaiko.validate`); test (`uv run pytest -q`); pointer to `ENEMY_SPEC.md` for contributors; repo layout.

- [ ] **Step 3: Commit**

```bash
git add ENEMY_SPEC.md README.md
git commit -m "Add contributor spec and README"
```
