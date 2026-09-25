"""Generate the built-in chiptune tracks: kaiko/assets/{level,boss}.wav.

Original compositions in a dark, driving castle-fight mood. Standard library
only and deterministic, so regenerating gives the same files:

    python tools/make_music.py
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parent.parent / "kaiko" / "assets"

NOTE_INDEX = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
    "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}
TRIADS = {"m": (0, 3, 7), "M": (0, 4, 7)}

# chords: one per bar, root + quality (m/M). lead: one string per bar, note/beats.
# bass: semitone offsets per eighth. arp: indices into (root, 3rd, 5th, octave).
# drums: 16th-note grids; fill replaces the snare on every 8th bar.
TRACKS = {
    "level": {
        "bpm": 144,
        "chords": "Cm Cm AbM BbM Cm Cm DbM GM Fm Fm Cm Cm AbM BbM DbM GM",
        "lead": [
            "C5/1 C5/.5 Eb5/.5 G5/1 F5/.5 Eb5/.5",
            "D5/.5 Eb5/.5 D5/.5 C5/.5 B4/1 G4/1",
            "Ab4/1 C5/.5 Eb5/.5 Ab5/1.5 G5/.5",
            "F5/1 D5/1 Bb4/1 D5/1",
            "C5/.5 G4/.5 C5/.5 Eb5/.5 G5/1 C6/1",
            "B5/.5 C6/.5 G5/1 Eb5/1 C5/1",
            "Db5/1 F5/1 Ab5/1 Db6/1",
            "B5/1.5 Ab5/.5 G5/1 F5/.5 D5/.5",
            "F5/1.5 Ab5/.5 C6/1 Ab5/1",
            "G5/.5 F5/.5 Eb5/.5 F5/.5 C5/2",
            "Eb5/1 G5/1 C6/.5 Bb5/.5 G5/1",
            "Eb5/1 D5/.5 C5/.5 D5/2",
            "C5/.5 Eb5/.5 Ab5/1 G5/.5 Ab5/.5 C6/1",
            "D6/1.5 C6/.5 Bb5/1 F5/1",
            "F5/.5 Ab5/.5 Db6/1 C6/.5 Db6/.5 F6/1",
            "D6/1 B5/1 G5/1 B4/1",
        ],
        "bass": [0, 0, 12, 0, 0, 12, 0, 7],
        "arp_step": 0.5,
        "arp": [0, 1, 2, 1],
        "kick": "x.....x.x.......",
        "snare": "....x.......x...",
        "hat": "x.x.x.x.x.x.x.x.",
        "fill": "....x...x.x.xxxx",
    },
    "boss": {
        "bpm": 176,
        "chords": "Cm Cm GbM GbM Cm Cm AbM GM Cm DbM Cm DbM AbM GbM FM GM",
        "lead": [
            "C5/.5 C5/.5 C5/.5 Eb5/.5 D5/.5 C5/.5 B4/1",
            "C5/.5 G5/.5 F#5/.5 G5/.5 Eb5/1 C5/1",
            "Gb5/1 Bb5/.5 Db6/.5 C6/.5 Bb5/.5 Gb5/1",
            "F5/.5 Gb5/.5 F5/.5 Eb5/.5 Db5/1 Bb4/1",
            "C6/.5 B5/.5 C6/.5 G5/.5 Eb5/.5 G5/.5 C5/1",
            "Eb5/.5 F5/.5 F#5/.5 G5/.5 Bb5/.5 B5/.5 C6/1",
            "C6/1 Ab5/1 Eb5/1 C5/1",
            "D5/.5 F5/.5 Ab5/.5 B5/.5 D6/1 B5/1",
            "G5/1.5 Eb5/.5 C5/1 G4/1",
            "Ab5/1.5 F5/.5 Db5/1 Ab4/1",
            "G5/.5 Ab5/.5 G5/.5 F5/.5 Eb5/.5 D5/.5 C5/1",
            "Db5/.5 F5/.5 Ab5/.5 Db6/.5 C6/1 Ab5/1",
            "Eb6/1 C6/.5 Ab5/.5 Eb6/1 C6/1",
            "Db6/1 Bb5/.5 Gb5/.5 Db6/1 Bb5/1",
            "C6/.5 A5/.5 F5/.5 A5/.5 C6/.5 Eb6/.5 D6/1",
            "B5/.5 D6/.5 F6/.5 Ab6/.5 G6/2",
        ],
        "bass": [0, 12, 0, 12, 0, 12, 0, 12],
        "arp_step": 0.25,
        "arp": [0, 1, 2, 3, 2, 1],
        "kick": "x...x...x...x.x.",
        "snare": "....x.......x...",
        "hat": "xxxxxxxxxxxxxxxx",
        "fill": "....x...xxxxxxxx",
    },
}


def midi(name: str) -> int:
    return 12 * (int(name[-1]) + 1) + NOTE_INDEX[name[:-1]]


def hz(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def pulse(duty: float):
    return lambda phase: 1.0 if phase % 1.0 < duty else -1.0


class Mix:
    """Sample buffer that wraps around, so tails past the end land at the
    start and the loop point is seamless."""

    def __init__(self, seconds: float):
        self.buf = [0.0] * round(seconds * RATE)
        self.rng = random.Random(7)

    def _add(self, i: int, v: float) -> None:
        self.buf[i % len(self.buf)] += v

    def tone(self, t0, dur, freq, gain, shape, gate=0.9, vibrato=False) -> None:
        i0, n = round(t0 * RATE), int(dur * gate * RATE)
        attack, release, vib_delay = 0.003 * RATE, 0.012 * RATE, 0.15 * RATE
        phase = 0.0
        for k in range(n):
            env = min(1.0, k / attack, (n - k) / release)
            self._add(i0 + k, gain * env * shape(phase))
            wobble = 0.006 * math.sin(2 * math.pi * 6 * k / RATE) if vibrato and k > vib_delay else 0.0
            phase += freq * (1 + wobble) / RATE

    def kick(self, t0, gain) -> None:
        i0, phase = round(t0 * RATE), 0.0
        for k in range(int(0.14 * RATE)):
            t = k / RATE
            phase += (45 + 110 * math.exp(-t * 30)) / RATE
            self._add(i0 + k, gain * math.exp(-t * 22) * math.sin(2 * math.pi * phase))

    def noise(self, t0, gain, seconds, decay, highpass=False, body_hz=0.0) -> None:
        i0, prev = round(t0 * RATE), 0.0
        for k in range(int(seconds * RATE)):
            t = k / RATE
            x = self.rng.uniform(-1, 1)
            s = x - prev if highpass else x
            prev = x
            if body_hz:
                s = 0.7 * s + 0.5 * math.sin(2 * math.pi * body_hz * t)
            self._add(i0 + k, gain * math.exp(-t * decay) * s)

    def master(self) -> list[float]:
        a = 1 - math.exp(-2 * math.pi * 7000 / RATE)
        y, out = 0.0, []
        for x in self.buf:
            y += a * (x - y)
            out.append(math.tanh(1.2 * y))
        peak = max(abs(v) for v in out) or 1.0
        return [0.89 * v / peak for v in out]


def render(spec: dict) -> list[float]:
    beat = 60 / spec["bpm"]
    chords = spec["chords"].split()
    if len(spec["lead"]) != len(chords):
        raise ValueError("need one lead bar per chord")
    mix = Mix(len(chords) * 4 * beat)
    lead, bass, arp = pulse(0.25), pulse(0.5), pulse(0.125)
    for bar, (chord, line) in enumerate(zip(chords, spec["lead"])):
        bar_t = bar * 4 * beat
        t = bar_t
        for token in line.split():
            note, beats = token.split("/")
            dur = float(beats) * beat
            mix.tone(t, dur, hz(midi(note)), 0.22, lead, gate=0.92, vibrato=dur >= beat)
            t += dur
        if abs(t - bar_t - 4 * beat) > 1e-9:
            raise ValueError(f"lead bar {bar + 1} is not 4 beats: {line!r}")

        root = NOTE_INDEX[chord[:-1]]
        for i, off in enumerate(spec["bass"]):
            mix.tone(bar_t + i * beat / 2, beat / 2, hz(36 + root + off), 0.2, bass, gate=0.8)
        third, fifth = TRIADS[chord[-1]][1:]
        tones = [60 + root, 60 + root + third, 60 + root + fifth, 72 + root]
        step = spec["arp_step"] * beat
        for i in range(round(4 / spec["arp_step"])):
            note = tones[spec["arp"][i % len(spec["arp"])]]
            mix.tone(bar_t + i * step, step, hz(note), 0.06, arp, gate=0.6)

        snare = spec["fill"] if bar % 8 == 7 else spec["snare"]
        sixteenth = beat / 4
        for i in range(16):
            at = bar_t + i * sixteenth
            if spec["kick"][i] == "x":
                mix.kick(at, 0.55)
            if snare[i] == "x":
                mix.noise(at, 0.22, 0.14, 25, body_hz=190)
            if spec["hat"][i] == "x":
                mix.noise(at, 0.05 if spec["hat"].count("x") <= 8 else 0.035, 0.03, 120, highpass=True)
    return mix.master()


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", round(v * 32767)) for v in samples))


def main() -> None:
    for name, spec in TRACKS.items():
        path = OUT / f"{name}.wav"
        samples = render(spec)
        write_wav(path, samples)
        print(f"wrote {path} ({len(samples) / RATE:.1f}s loop)")


if __name__ == "__main__":
    main()
