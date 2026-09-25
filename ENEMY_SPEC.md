# Building an enemy for Kaiko

Kaiko is a submarine that flies right and shoots healthcare problems. You
are going to build one of those problems. One folder, one file, no engine
changes. Merging is adding your folder.

## The four steps

```bash
uv sync                                        # once
cp -r enemies/_template enemies/my_enemy       # snake_case, unique
$EDITOR enemies/my_enemy/__init__.py
uv run python -m kaiko.validate                # contract check, headless
uv run kaiko --only my_enemy --windowed        # play-test, only your enemy, fast spawns
```

Then open a PR that adds only `enemies/my_enemy/`. Full game: `uv run kaiko`.
`uv run kaiko --list` shows everything that loaded.

## Rules of the folder

- Everything you make lives in `enemies/<your_folder>/`. Sprites, helper
  modules, PNGs, all of it.
- Import only from `kaiko.api`. Nothing else in `kaiko/` is stable.
- Do not import other people's enemy folders.
- Folders starting with `_` are ignored by the game.
- Every `Enemy` subclass defined in your folder is registered automatically.
  Helper classes you do not want auto-spawned get `tier = 0`.

## The minimal enemy

```python
from kaiko.api import Enemy, Sprite

PALETTE = {"r": "#d94f4f", "k": "#222222"}
FRAME = [
    "..rrrr..",
    ".rrkkrr.",
    "rrrrrrrr",
    ".rrrrrr.",
]

class Bureaucracy(Enemy):
    name = "Bureaucracy"
    tier = 1
    hp = 2
    score = 100
    sprite = Sprite.from_text(FRAME, PALETTE)
```

That already works: it drifts left at 40 px/s, takes two torpedoes, and
gives 100 points. Everything else is optional.

## Class attributes

| attribute | default | meaning |
| --- | --- | --- |
| `name` | class name | display name in logs and the validator |
| `tier` | `1` | `1` easy to `5` hard. Tier `t` starts appearing at `(t - 1) * 20` seconds. `0` means never auto-spawned, only via `world.spawn` |
| `weight` | `1.0` | relative pick frequency inside its tier, must be > 0 |
| `boss` | `False` | spawns alone every 60 seconds at mid-height; regular spawning pauses while it lives |
| `hp` | `1` | hit points, player torpedoes deal 1 |
| `score` | `100` | points on death |
| `sprite` | required | a `Sprite`, see below |
| `hitbox` | `None` | `(w, h)` centred on the enemy; `None` uses the sprite size |
| `contact_damage` | `1` | lives Kaiko loses on body contact |

## Hooks

All optional. `dt` is seconds per tick, fixed at 1/60.

```python
def on_spawn(self, world):          # once, after x and y are set
def update(self, dt, world):        # every tick; default moves by (vx, vy)
def on_hit(self, world, damage):    # after hp was reduced by a torpedo
def on_death(self, world):          # once when hp hits 0; not on kill()
```

Call `super().update(dt, world)` inside your `update` if you want the
default movement plus your own logic. Do not override `__init__`; put setup
in `on_spawn`.

## Instance state

Set by the engine before `on_spawn`, yours to change afterwards:

- `x, y` centre of the sprite, floats, pixels. Origin top left, y grows down.
- `vx, vy` velocity in px/s, default `(-40, 0)`. Negative `vx` moves toward Kaiko.
- `hp` current hit points.
- `age` seconds since spawn, handy for animation and timers.
- `alive` read it, do not set it. Call `self.kill()` to vanish without score.

## What `world` gives you

Read:

- `world.width`, `world.height`: 320 and 180.
- `world.time`: seconds since the run started.
- `world.rng`: a seeded `random.Random`. Use it instead of `random` so runs
  are reproducible.
- `world.player.x`, `world.player.y`, `world.player.alive`: Kaiko.
- `world.enemies`: the live list. Read only.

Do:

- `world.fire(x, y, vx, vy, damage=1, sprite=None)`: an enemy bullet.
  Default look is a 3 by 3 red square. Pass a small `Sprite` for custom
  projectiles.
- `world.spawn(EnemyClass, x, y)`: another enemy. Use it for minions,
  formations and splitting. Returns the instance, or `None` if its
  constructor failed.

Anything not listed here is private. Touching it may break on merge.

## Sprites

Enemies face left as drawn. The engine never flips or rotates. Typical
size is 16 to 32 pixels, bosses up to 64. Hard limit 96.

Text grid, one character per pixel, `.` is transparent, every row the same
length, every frame the same size:

```python
PALETTE = {"w": "#f4f1e6", "k": "#2b2b2b"}
FRAME_A = ["ww..", "wkw.", "ww.."]
FRAME_B = ["ww..", "wwk.", "ww.."]
sprite = Sprite.from_text(FRAME_A, PALETTE)                 # static
sprite = Sprite.from_text([FRAME_A, FRAME_B], PALETTE, fps=6)  # animated, loops
```

PNG strip, frames side by side, path relative to your `__init__.py`:

```python
sprite = Sprite.from_png("thing.png")                   # one frame
sprite = Sprite.from_png("thing.png", frame_w=16, fps=6) # 16 px wide frames
```

Shared artwork in `data/` (the big generated images, transparent
background). `trim=True` crops empty borders, `height=N` shrinks to N px
tall keeping the aspect ratio. Pick the height for the canvas, not the
file: 24 to 40 px for a regular enemy, up to 64 for a boss.

```python
sprite = Sprite.from_data("enemy_legal.png", height=32, trim=True)
```

Available now: `enemy_data`, `enemy_eu`, `enemy_hospitals`, `enemy_legal`,
`enemy_mdr`, `enemy_other_labs`, `enemy_outage`, `enemy_regulatory`,
`enemy_scarlet`, `projectile_1` to `projectile_3` (all `.png`). The ship
uses `submarine.png` the same way. The enemy images are front-facing, so
they work as-is.

## Engine rules you should know

- Coordinates are canvas pixels on a 320 by 180 canvas, scaled up to the
  screen. Enemies spawn just off the right edge at a random height,
  bosses at mid-height.
- Kaiko has 3 lives. Any enemy bullet or body contact costs one, then one
  second of invulnerability.
- Enemies are removed silently once they pass 48 px left of the screen,
  96 px right of it, or 64 px above or below. Bosses are only removed to
  the left, so keep your boss on screen.
- Spawn interval shrinks from 1.5 s to 0.5 s over two minutes.
- If your hook raises, the traceback is printed once and that instance is
  removed. The game continues. The validator catches this before merge.

## Do not

- Override `__init__`.
- Import from `kaiko.world`, `kaiko.game`, or anything but `kaiko.api`.
- Keep mutable state on the class or module that instances share, unless
  you mean it (a spawn counter is fine, a shared position list is not).
- Block: no `time.sleep`, no network, no file writes in hooks.
- Do heavy work in `update`. It runs 60 times per second per instance.

## Examples in the repo

- `enemies/paperwork_blob/`: sine movement, aimed shots, custom bullet sprite.
- `enemies/fax_machine/`: tier 0 minions spawned on death, hitbox override.
- `enemies/legacy_ehr/`: a boss that parks, bounces, and fires spreads.

## Prompt to paste into Claude Code

> Read `ENEMY_SPEC.md` and `enemies/paperwork_blob/__init__.py` in this
> repo. Build a new enemy folder `enemies/<snake_name>/` for the
> healthcare problem "<describe it>". Draw a 16 to 32 px pixel-art sprite
> as a text grid with two animation frames, give it a movement pattern and
> an attack that fit the theme, pick a sensible tier and hp, then run
> `uv run python -m kaiko.validate` and fix anything it reports. Do not
> edit files outside the new folder.
