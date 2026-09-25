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
