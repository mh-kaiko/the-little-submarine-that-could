from kaiko import DT
from kaiko.art import KAIKO
from kaiko.entities import Bullet, Player


class FakeWorld:
    width = 320
    height = 180

    def __init__(self):
        self.shots = []

    def fire_player(self, x, y):
        self.shots.append((x, y))


def test_kaiko_sprite_shape():
    assert (KAIKO.width, KAIKO.height) == (24, 12)
    assert len(KAIKO.frames) == 2


def test_bullet_moves_and_sizes():
    b = Bullet(0, 0, 60, -60, friendly=True)
    b.update(0.5)
    assert (b.x, b.y) == (30.0, -30.0)
    assert b.size() == (6, 2)
    assert Bullet(0, 0, 0, 0).size() == (3, 3)


def test_player_moves_and_clamps():
    w = FakeWorld()
    p = Player(40, 90)
    for _ in range(120):
        p.update(DT, -1, 0, False, w)
    assert p.x == KAIKO.width / 2
    for _ in range(600):
        p.update(DT, 1, 1, False, w)
    assert p.x == w.width - KAIKO.width / 2
    assert p.y == w.height - KAIKO.height / 2


def test_player_fire_rate():
    w = FakeWorld()
    p = Player(40, 90)
    for _ in range(60):
        p.update(DT, 0, 0, True, w)
    assert 7 <= len(w.shots) <= 9
    assert w.shots[0][0] > p.x


def test_player_hit_lives_and_invulnerability():
    p = Player(40, 90)
    assert p.hit() is True
    assert p.lives == 2 and p.invuln > 0
    assert p.hit() is False
    p.invuln = 0
    assert p.hit() is True
    p.invuln = 0
    assert p.hit() is True
    assert p.lives == 0 and not p.alive
    assert p.hit() is False


def test_dead_player_does_not_move_or_fire():
    w = FakeWorld()
    p = Player(40, 90)
    p.alive = False
    p.update(DT, 1, 0, True, w)
    assert p.x == 40 and w.shots == []
