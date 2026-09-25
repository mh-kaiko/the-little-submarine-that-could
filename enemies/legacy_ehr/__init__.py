"""Legacy EHR: the boss. A beige CRT that parks on the right and sprays error dialogs."""

import math

from kaiko.api import Enemy, Sprite

PALETTE = {"b": "#d8cfb4", "d": "#a89f86", "k": "#1a1f1a", "g": "#39ff7a", "e": "#1f7a3c", "r": "#e05a4f"}

W = 40


def _row(inner: str) -> str:
    """Bezel + 36-wide screen row + bezel = 40 px."""
    return "bbk" + inner[:34].ljust(34, "e") + "kbb"


def _screen(cursor: str) -> list[str]:
    rows = [
        "..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
        ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
        "bbkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkbb",
        _row(""),
        _row("egggggggg"),
        _row(""),
        _row("eggggggggggggg"),
        _row(""),
        _row("egggggg"),
        _row(""),
        _row("eggggggggggggggggggggggg"),
        _row(""),
        _row("egggggggg"),
        _row(""),
        _row(""),
        _row("errrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"),
        _row(""),
        _row("e" + cursor),
        _row(""),
        "bbkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkbb",
        ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
        ".bbbbbbbbbbbbbbbbrrbbbbbbbbbbbbbbbbbbbb.",
        "..dddddddddddddddddddddddddddddddddddd..",
        "..........dddddddddddddddddd............",
        "..........dddddddddddddddddd............",
        "......dddddddddddddddddddddddddd........",
    ]
    return [r[:W].ljust(W, ".") for r in rows]


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
        self.park_x = min(world.width - 32, self.x)  # park at the right edge, or where we are
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
