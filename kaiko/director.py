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
