import math

from kaiko import DT, HEIGHT, WIDTH
from kaiko.api import Enemy, Sprite
from kaiko.entities import Bullet
from kaiko.world import World, overlaps

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})


def make(**attrs):
    cls_name = attrs.pop("cls_name", "Dummy")
    return type(cls_name, (Enemy,), {"sprite": SPR, **attrs})


def quiet_world(**kw):
    logs = []
    w = World(seed=1, log=lambda *a, **k: logs.append(a), **kw)
    return w, logs


def test_overlaps():
    assert overlaps((0, 0, 2, 2), (1, 1, 2, 2))
    assert not overlaps((0, 0, 2, 2), (2, 0, 2, 2))
    assert not overlaps((0, 0, 2, 2), (5, 5, 2, 2))


def test_spawn_calls_on_spawn_and_returns_instance():
    seen = []
    Cls = make(on_spawn=lambda self, world: seen.append((self.x, self.y)))
    w, _ = quiet_world()
    e = w.spawn(Cls, 100, 50)
    assert e in w.enemies and seen == [(100.0, 50.0)]


def test_fire_adds_enemy_bullet():
    w, _ = quiet_world()
    w.fire(10, 20, -5, 0, damage=2)
    b = w.enemy_bullets[0]
    assert (b.x, b.y, b.vx, b.damage, b.friendly) == (10, 20, -5, 2, False)


def test_player_bullet_kills_enemy_scores_and_calls_hooks():
    calls = []
    Cls = make(
        hp=1,
        score=50,
        on_hit=lambda self, world, dmg: calls.append(("hit", dmg)),
        on_death=lambda self, world: calls.append(("death",)),
    )
    w, _ = quiet_world()
    e = w.spawn(Cls, 100, 90)
    e.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert not e.alive and e not in w.enemies
    assert w.score == 50 and w.player_bullets == []
    assert calls == [("hit", 1), ("death",)]


def test_hit_without_death_flashes_and_keeps_enemy():
    w, _ = quiet_world()
    e = w.spawn(make(hp=3), 100, 90)
    e.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert e.alive and e.hp == 2 and e.flash > 0 and w.score == 0


def test_enemy_bullet_costs_life():
    w, _ = quiet_world()
    w.fire(w.player.x, w.player.y, 0, 0)
    w.update(DT)
    assert w.player.lives == 2 and w.enemy_bullets == []


def test_contact_costs_one_life_per_invulnerability_window():
    w, _ = quiet_world()
    e = w.spawn(make(), w.player.x, w.player.y)
    e.vx = 0
    for _ in range(10):
        w.update(DT)
    assert w.player.lives == 2 and e.alive


def test_offscreen_removal_and_boss_exemption():
    w, _ = quiet_world()
    left = w.spawn(make(), -49, 90)
    right = w.spawn(make(), WIDTH + 97, 90)
    below = w.spawn(make(), 100, HEIGHT + 65)
    boss_right = w.spawn(make(boss=True), WIDTH + 200, 90)
    boss_left = w.spawn(make(boss=True), -49, 90)
    for e in (left, right, below, boss_right, boss_left):
        e.vx = 0
    w.update(DT)
    assert w.enemies == [boss_right]


def test_non_finite_position_removes_enemy():
    def bad_update(self, dt, world):
        self.x = math.nan

    w, _ = quiet_world()
    w.spawn(make(update=bad_update), 100, 90)
    w.update(DT)
    assert w.enemies == []


def test_hook_error_is_isolated_and_logged_once_per_class():
    def boom(self, dt, world):
        raise RuntimeError("boom")

    Cls = make(update=boom, cls_name="Boomer")
    w, logs = quiet_world()
    w.spawn(Cls, 100, 90)
    w.spawn(Cls, 100, 100)
    w.update(DT)
    assert w.enemies == []
    assert len(w.errors) == 2 and w.errors[0][0] == "Boomer" and "boom" in w.errors[0][1]
    assert len(logs) == 1


def test_spawn_of_non_enemy_is_recorded_not_raised():
    w, _ = quiet_world()
    e = w.spawn(make(on_spawn=lambda self, world: world.spawn(int, 0, 0)), 100, 90)
    assert w.errors and e is not None
    assert w.enemies == [e]


def test_broken_constructor_returns_none():
    class Bad(Enemy):
        sprite = SPR

        def __init__(self, x, y):
            raise ValueError("nope")

    w, _ = quiet_world()
    assert w.spawn(Bad, 0, 0) is None
    assert w.errors[0][0] == "Bad"


def test_spawn_during_on_death_keeps_children():
    Child = make(tier=0)

    def split(self, world):
        world.spawn(Child, self.x, self.y - 10)
        world.spawn(Child, self.x, self.y + 10)

    w, _ = quiet_world()
    parent = w.spawn(make(hp=1, on_death=split), 100, 90)
    parent.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert len(w.enemies) == 2 and all(isinstance(e, Child) for e in w.enemies)


def test_death_spawns_particles():
    w, _ = quiet_world()
    e = w.spawn(make(hp=1), 100, 90)
    e.vx = 0
    w.player_bullets.append(Bullet(100, 90, 0, 0, friendly=True))
    w.update(DT)
    assert w.particles
