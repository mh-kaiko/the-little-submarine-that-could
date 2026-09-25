from kaiko import DT
from kaiko.api import Enemy, Sprite
from kaiko.render import Renderer
from kaiko.world import World

SPR = Sprite.from_text(["####"] * 4, {"#": "#ffffff"})
Dummy = type("Dummy", (Enemy,), {"sprite": SPR})


def test_windowed_scale_and_offset():
    r = Renderer(windowed=True)
    assert r.scale == 4 and r.offset == (0, 0)
    assert r.canvas.get_size() == (320, 180)


def test_draw_every_state_without_error():
    r = Renderer(windowed=True)
    w = World(seed=0, log=lambda *a: None)
    e = w.spawn(Dummy, 200, 90)
    e.flash = 0.05
    w.fire(150, 90, -10, 0)
    w.player.invuln = 0.5
    w.update(DT, 0, 0, True)
    for state in ("title", "playing", "gameover"):
        r.draw(w, state)
    assert r.canvas.get_at((round(e.x), round(e.y)))[:3] == (255, 255, 255)
