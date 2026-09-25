# Music

The game ships with original chiptune tracks in `kaiko/assets/`
(regenerate with `python tools/make_music.py`). To swap in your own music
locally, drop an mp3 here with the matching name:

| File        | Plays                          |
| ----------- | ------------------------------ |
| `level.mp3` | title screen and normal play   |
| `boss.mp3`  | while a boss is on screen      |

Everything in this folder except this README is git-ignored, because most
music is copyrighted and the repo is public. Both tracks loop, and the music
fades out on game over.
