import random

from kaiko import DT
from kaiko.api import Enemy, Sprite
from kaiko.director import Director
from kaiko.world import World

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})


def make(name, **attrs):
    return type(name, (Enemy,), {"sprite": SPR, **attrs})


T1 = make("T1", tier=1)
T2 = make("T2", tier=2)
T3 = make("T3", tier=3)
T0 = make("T0", tier=0)
BOSS = make("Boss", boss=True, tier=1)


def world():
    return World(seed=3, log=lambda *a: None)


def test_pools_exclude_tier_zero_and_split_bosses():
    d = Director([T1, T2, T0, BOSS])
    assert d.regular == [T1, T2] and d.bosses == [BOSS]


def test_tier_unlock_schedule():
    d = Director([T1, T2, T3])
    assert d.unlocked_tiers(0) == [1]
    assert d.unlocked_tiers(19.9) == [1]
    assert d.unlocked_tiers(20) == [1, 2]
    assert d.unlocked_tiers(40) == [1, 2, 3]


def test_interval_ramps_and_only_mode():
    d = Director([T1])
    assert d.interval(0) == 1.5
    assert abs(d.interval(60) - 1.0) < 1e-9
    assert d.interval(120) == 0.5
    assert d.interval(999) == 0.5
    assert Director([T1], only=True).interval(0) == 0.7


def test_pick_respects_unlocked_tiers_and_weights():
    rng = random.Random(0)
    d = Director([T1, T2, T3])
    assert all(d.pick(0, rng) is T1 for _ in range(30))
    picks = {d.pick(40, rng).__name__ for _ in range(200)}
    assert picks == {"T1", "T2", "T3"}
    assert Director([]).pick(0, rng) is None


def test_update_spawns_immediately_then_waits_for_interval():
    w = world()
    d = Director([T1])
    d.update(DT, w)
    assert len(w.enemies) == 1
    e = w.enemies[0]
    assert e.x > w.width and SPR.height / 2 <= e.y <= w.height - SPR.height / 2
    for _ in range(int(1.4 / DT)):
        w.update(DT)
        d.update(DT, w)
    assert len(w.enemies) == 1
    for _ in range(int(0.2 / DT)):
        w.update(DT)
        d.update(DT, w)
    assert len(w.enemies) == 2


def test_no_classes_means_no_spawns_no_crash():
    w = world()
    d = Director([])
    for _ in range(100):
        d.update(DT, w)
    assert w.enemies == []


def test_boss_pauses_regular_spawns_and_reschedules_after_death():
    w = world()
    d = Director([T1, BOSS])
    w.time = 60.0
    d.update(DT, w)
    assert len(w.enemies) == 1 and isinstance(w.enemies[0], BOSS)
    boss = w.enemies[0]
    assert boss.y == w.height / 2
    for _ in range(300):
        w.time += DT
        d.update(DT, w)
    assert w.enemies == [boss]
    boss.kill()
    w.update(DT)
    d.update(DT, w)
    assert d.boss is None
    assert d.next_boss > w.time + 50
    assert all(not isinstance(e, BOSS) for e in w.enemies)


def test_only_mode_spawns_boss_quickly():
    w = world()
    d = Director([BOSS], only=True)
    for _ in range(int(1.2 / DT)):
        w.update(DT)
        d.update(DT, w)
    assert any(isinstance(e, BOSS) for e in w.enemies)
