from kaiko.api import Enemy, Sprite
from kaiko.validate import main, validate_class

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})


def make(**attrs):
    return type("V", (Enemy,), {"sprite": SPR, **attrs})


def test_good_class_passes():
    assert validate_class(make()) == []


def test_contract_violation_reported():
    assert any("tier" in p for p in validate_class(make(tier=9)))


def test_raising_update_reported():
    def boom(self, dt, world):
        raise RuntimeError("kaboom")

    problems = validate_class(make(update=boom))
    assert problems and "kaboom" in "".join(problems)


def test_broken_on_spawn_reported():
    def boom(self, world):
        raise KeyError("missing")

    assert validate_class(make(on_spawn=boom))


def test_immortal_enemy_reported():
    def heal(self, world, damage):
        self.hp = 99

    problems = validate_class(make(on_hit=heal))
    assert any("die" in p for p in problems)


def test_main_passes_on_shipped_enemies(capsys):
    assert main([]) == 0
    out = capsys.readouterr().out
    assert "PASS" in out and "Paperwork Blob" in out
