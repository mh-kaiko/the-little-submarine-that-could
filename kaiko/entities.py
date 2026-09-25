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
