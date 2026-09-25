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
        world.update(DT)  # let it reposition on its first frame
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
