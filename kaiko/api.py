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
