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
            if not (math.isfinite(x) and math.isfinite(y)):
                return False
            return b.alive and x + bw > 0 and x < w and y + bh > 0 and y < h

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
