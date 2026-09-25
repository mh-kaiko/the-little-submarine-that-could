"""Background music: one looping track per situation, loaded from music/."""

from __future__ import annotations

from pathlib import Path

import pygame

MUSIC_DIR = Path(__file__).resolve().parent.parent / "music"
TRACKS = {"level": "level.mp3", "boss": "boss.mp3"}
FADE_MS = 600


def track_for(state: str, boss_active: bool) -> str | None:
    """Which track should be playing. None means silence."""
    if state == "gameover":
        return None
    if state == "playing" and boss_active:
        return "boss"
    return "level"


class Music:
    """Switches tracks only when the wanted one changes. Missing files or no
    audio device mean silence, never a crash."""

    def __init__(self, music_dir: Path = MUSIC_DIR, log=print):
        self.dir = music_dir
        self.log = log
        self.current: str | None = None
        self.enabled = self._init_mixer()
        self._warned: set[str] = set()

    def _init_mixer(self) -> bool:
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init()
        except pygame.error as exc:
            self.log(f"[kaiko] no audio device, music off ({exc})")
            return False
        return True

    def play(self, name: str | None) -> None:
        if name == self.current:
            return
        self.current = name
        if not self.enabled:
            return
        if name is None:
            pygame.mixer.music.fadeout(FADE_MS)
            return
        path = self.dir / TRACKS[name]
        if not path.is_file():
            if name not in self._warned:
                self._warned.add(name)
                self.log(f"[kaiko] no {name} music at {path}, see music/README.md")
            pygame.mixer.music.stop()
            return
        pygame.mixer.music.load(str(path))
        pygame.mixer.music.play(loops=-1, fade_ms=FADE_MS)
