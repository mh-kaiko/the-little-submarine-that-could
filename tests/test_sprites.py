import importlib.util

import pygame
import pytest

from kaiko.sprites import Sprite

PAL = {"#": "#ffffff", "o": "#ff0000"}


def test_from_text_single_frame_size_and_pixels():
    s = Sprite.from_text(["#..", ".o."], PAL)
    assert (s.width, s.height) == (3, 2)
    assert len(s.frames) == 1
    f = s.frames[0]
    assert f.get_at((0, 0)) == (255, 255, 255, 255)
    assert f.get_at((1, 0)).a == 0
    assert f.get_at((1, 1)) == (255, 0, 0, 255)


def test_from_text_multi_frame_animates():
    s = Sprite.from_text([["#."], [".#"]], PAL, fps=2)
    assert len(s.frames) == 2
    assert s.frame_at(0.0) is s.frames[0]
    assert s.frame_at(0.5) is s.frames[1]
    assert s.frame_at(1.0) is s.frames[0]


def test_static_sprite_ignores_time():
    s = Sprite.from_text([["#."], [".#"]], PAL, fps=0)
    assert s.frame_at(123.4) is s.frames[0]


def test_flash_is_white_silhouette():
    s = Sprite.from_text(["o."], PAL)
    f = s.flash_at(0)
    assert f.get_at((0, 0)) == (255, 255, 255, 255)
    assert f.get_at((1, 0)).a == 0


@pytest.mark.parametrize(
    "frames",
    [
        ["##", "#"],
        ["#x"],
        [],
        [""],
        [["#"], ["##"]],
    ],
)
def test_bad_text_sprites_rejected(frames):
    with pytest.raises(ValueError):
        Sprite.from_text(frames, PAL)


def test_from_png_strip(tmp_path):
    surf = pygame.Surface((6, 2), pygame.SRCALPHA)
    surf.set_at((0, 0), (10, 20, 30, 255))
    surf.set_at((3, 1), (40, 50, 60, 255))
    path = tmp_path / "strip.png"
    pygame.image.save(surf, str(path))
    s = Sprite.from_png(str(path), frame_w=3, fps=5)
    assert (s.width, s.height) == (3, 2)
    assert len(s.frames) == 2
    assert s.frames[0].get_at((0, 0)) == (10, 20, 30, 255)
    assert s.frames[1].get_at((0, 1)) == (40, 50, 60, 255)


def test_from_png_relative_to_calling_module(tmp_path):
    surf = pygame.Surface((4, 4), pygame.SRCALPHA)
    pygame.image.save(surf, str(tmp_path / "me.png"))
    (tmp_path / "mod.py").write_text("from kaiko.sprites import Sprite\nSPR = Sprite.from_png('me.png')\n")
    spec = importlib.util.spec_from_file_location("tmp_sprite_mod", tmp_path / "mod.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert (mod.SPR.width, mod.SPR.height) == (4, 4)


def test_from_png_bad_frame_width(tmp_path):
    surf = pygame.Surface((5, 2), pygame.SRCALPHA)
    pygame.image.save(surf, str(tmp_path / "odd.png"))
    with pytest.raises(ValueError):
        Sprite.from_png(str(tmp_path / "odd.png"), frame_w=2)


def test_from_png_trim_and_height(tmp_path):
    surf = pygame.Surface((40, 20), pygame.SRCALPHA)
    pygame.draw.rect(surf, (200, 100, 50, 255), (10, 5, 20, 10))
    path = tmp_path / "big.png"
    pygame.image.save(surf, str(path))
    trimmed = Sprite.from_png(str(path), trim=True)
    assert (trimmed.width, trimmed.height) == (20, 10)
    small = Sprite.from_png(str(path), trim=True, height=5)
    assert (small.width, small.height) == (10, 5)
    assert small.frames[0].get_at((5, 2)).a > 0


def test_from_data_loads_shared_artwork():
    s = Sprite.from_data("submarine.png", height=20, trim=True)
    assert s.height == 20 and 30 <= s.width <= 45
