import textwrap

from kaiko.api import Enemy, Sprite
from kaiko.registry import check_class, discover

GOOD = textwrap.dedent(
    """
    from kaiko.api import Enemy, Sprite

    class {name}(Enemy):
        tier = {tier}
        sprite = Sprite.from_text(["##", "##"], {{"#": "#ffffff"}})
    """
)


def write(root, folder, text):
    d = root / folder
    d.mkdir()
    (d / "__init__.py").write_text(text)


def test_discover_loads_good_skips_underscore_and_isolates_failures(tmp_path):
    write(tmp_path, "good", GOOD.format(name="Good", tier=1))
    write(tmp_path, "_template", GOOD.format(name="Template", tier=1))
    write(tmp_path, "broken", "raise RuntimeError('boom')\n")
    write(tmp_path, "nosprite", "from kaiko.api import Enemy\nclass NoSprite(Enemy):\n    pass\n")
    (tmp_path / "notapkg").mkdir()
    (tmp_path / "stray.py").write_text("x = 1\n")
    logs = []
    reg = discover(tmp_path, log=lambda *a: logs.append(a))
    assert [c.__name__ for c in reg.classes] == ["Good"]
    assert reg.classes[0].folder == "good"
    folders = sorted(f for f, _ in reg.failures)
    assert folders == ["broken", "nosprite"]
    assert any("boom" in msg for _, msg in reg.failures)
    assert any("sprite" in msg for _, msg in reg.failures)
    assert len(logs) == 2


def test_discover_registers_every_subclass_in_folder_and_supports_relative_imports(tmp_path):
    d = tmp_path / "pack"
    d.mkdir()
    (d / "parts.py").write_text(GOOD.format(name="Minion", tier=0))
    (d / "__init__.py").write_text("from .parts import Minion\n" + GOOD.format(name="Big", tier=2))
    reg = discover(tmp_path, log=lambda *a: None)
    names = sorted(c.__name__ for c in reg.classes)
    assert names == ["Big", "Minion"]
    assert all(c.folder == "pack" for c in reg.classes)
    assert reg.failures == []


def test_discover_missing_dir_is_empty(tmp_path):
    reg = discover(tmp_path / "nothing", log=lambda *a: None)
    assert reg.classes == [] and reg.failures == []


SPR = Sprite.from_text(["#"], {"#": "#ffffff"})


def bad(**attrs):
    return type("X", (Enemy,), {"sprite": SPR, **attrs})


def test_check_class_accepts_minimal():
    assert check_class(bad()) == []


def test_check_class_rejects_bad_values():
    assert check_class(type("X", (Enemy,), {}))
    assert any("tier" in p for p in check_class(bad(tier=6)))
    assert any("tier" in p for p in check_class(bad(tier=True)))
    assert any("weight" in p for p in check_class(bad(weight=0)))
    assert any("hp" in p for p in check_class(bad(hp=0)))
    assert any("score" in p for p in check_class(bad(score=-1)))
    assert any("hitbox" in p for p in check_class(bad(hitbox=(0, 4))))
    assert any("hitbox" in p for p in check_class(bad(hitbox=5)))
    assert any("boss" in p for p in check_class(bad(boss=1)))
    assert any("contact_damage" in p for p in check_class(bad(contact_damage=-1)))
    big = Sprite.from_text(["#" * 97], {"#": "#ffffff"})
    assert any("96" in p for p in check_class(bad(sprite=big)))
