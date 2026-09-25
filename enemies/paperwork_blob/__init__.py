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
