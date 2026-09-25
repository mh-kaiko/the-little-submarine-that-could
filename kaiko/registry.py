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
