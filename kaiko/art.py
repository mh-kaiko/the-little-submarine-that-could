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

KAIKO = Sprite.from_text([_FRAME_A, _FRAME_B], KAIKO_PALETTE, fps=8)
