"""Engine-owned pixel art: Kaiko herself."""

from kaiko.sprites import Sprite

KAIKO_PALETTE = {
    "y": "#f4c542",  # hull
    "d": "#c48f1f",  # hull shadow
    "w": "#9be7ff",  # porthole
    "g": "#b8c0c8",  # periscope
    "p": "#e8eef2",  # propeller
    "k": "#3a2a10",  # keel
}

_FRAME_A = [
    ".........ggg............",
    ".........g..............",
    ".......ggggg............",
    ".....yyyyyyyyyyyy.......",
    "...yyyyyyyyyyyyyyyyy....",
    "p.yyyyyywwyyyyyyyyyyyy..",
    "ppyyyyyywwyyyyyyyyyyyyy.",
    "p.yyyyyyyyyyyyyyyyyyyyyy",
    "..ddddddddddddddddddddd.",
    "...dddddddddddddddddd...",
    ".....ddddddddddddd......",
    ".......kkkkkkkkk........",
]

_FRAME_B = [
    ".........ggg............",
    ".........g..............",
    ".......ggggg............",
    ".....yyyyyyyyyyyy.......",
    "...yyyyyyyyyyyyyyyyy....",
    "..yyyyyywwyyyyyyyyyyyy..",
    "ppyyyyyywwyyyyyyyyyyyyy.",
    "..yyyyyyyyyyyyyyyyyyyyyy",
    "p.ddddddddddddddddddddd.",
    "...dddddddddddddddddd...",
    ".....ddddddddddddd......",
    ".......kkkkkkkkk........",
]

KAIKO_PIXEL = Sprite.from_text([_FRAME_A, _FRAME_B], KAIKO_PALETTE, fps=8)

# The real ship artwork lives in data/submarine.png (faces right, transparent
# background). Shrink it to 20 px tall for the 320x180 canvas. Fall back to
# the hand-drawn sprite if the file is missing.
try:
    KAIKO = Sprite.from_data("submarine.png", height=20, trim=True)
except Exception as exc:  # noqa: BLE001
    print(f"[kaiko] data/submarine.png not usable ({exc}); using pixel fallback")
    KAIKO = KAIKO_PIXEL
