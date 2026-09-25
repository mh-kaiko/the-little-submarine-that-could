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
