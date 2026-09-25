from kaiko.game import Game
from kaiko.music import Music, track_for


def test_track_for_each_state():
    assert track_for("title", False) == "level"
    assert track_for("playing", False) == "level"
    assert track_for("playing", True) == "boss"
    assert track_for("gameover", True) is None


def test_game_switches_to_boss_track_when_boss_spawns():
    g = Game([])
    g.state = "playing"
    assert g.track() == "level"
    g.director.boss = object()
    assert g.track() == "boss"


def test_missing_files_are_silent_and_warn_once(tmp_path):
    logs = []
    m = Music(music_dir=tmp_path, log=logs.append)
    for name in ("level", "level", None, "level"):
        m.play(name)
    assert m.current == "level"
    assert sum("level" in line for line in logs) == 1
