from kaiko.api import Enemy, Sprite

SPR = Sprite.from_text(["####", "####"], {"#": "#ffffff"})


class Blob(Enemy):
    name = "Blob"
    hp = 3
    sprite = SPR


class Unnamed(Enemy):
    sprite = SPR
    hitbox = (2, 2)


def test_defaults_and_instance_state():
    e = Blob(10, 20)
    assert (e.x, e.y, e.vx, e.vy) == (10.0, 20.0, -40.0, 0.0)
    assert e.hp == 3 and Blob.hp == 3
    assert e.alive and e.age == 0.0
    assert Blob.tier == 1 and Blob.weight == 1.0 and Blob.boss is False


def test_instance_hp_does_not_change_class_hp():
    e = Blob(0, 0)
    e.hp -= 1
    assert Blob.hp == 3


def test_default_update_integrates_velocity():
    e = Blob(100, 50)
    e.vy = 10
    e.update(0.5, None)
    assert (e.x, e.y) == (80.0, 55.0)


def test_kill_and_rect():
    e = Blob(10, 20)
    assert e.rect() == (8.0, 19.0, 4, 2)
    e.kill()
    assert not e.alive


def test_hitbox_overrides_sprite_size():
    e = Unnamed(10, 20)
    assert e.size() == (2, 2)
    assert e.rect() == (9.0, 19.0, 2, 2)


def test_display_name_falls_back_to_class_name():
    assert Blob.display_name() == "Blob"
    assert Unnamed.display_name() == "Unnamed"
