import wave

from kaiko.game import Game
from kaiko.music import BUILTIN_DIR, Music, track_for, track_path


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


def test_builtin_tracks_are_valid_wavs():
    for name in ("level", "boss"):
        with wave.open(str(BUILTIN_DIR / f"{name}.wav")) as w:
            assert w.getnframes() / w.getframerate() > 10


def test_local_mp3_overrides_builtin(tmp_path):
    empty = tmp_path / "none"
    assert track_path("level", music_dir=empty) == BUILTIN_DIR / "level.wav"
    (tmp_path / "level.mp3").write_bytes(b"")
    assert track_path("level", music_dir=tmp_path) == tmp_path / "level.mp3"


def test_missing_files_are_silent_and_warn_once(tmp_path):
    logs = []
    m = Music(music_dir=tmp_path, builtin_dir=tmp_path, log=logs.append)
    for name in ("level", "level", None, "level"):
        m.play(name)
    assert m.current == "level"
    assert sum("level" in line for line in logs) == 1
