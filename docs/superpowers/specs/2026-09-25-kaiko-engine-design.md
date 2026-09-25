# Kaiko the Game: engine design

Date: 2026-09-25. Context: a two-hour vibe-coding jam with 2 to 4 people.
Kaiko, a submarine, flies right and shoots healthcare problems. The engine
must be finished in about 40 minutes so the rest of the team spends the
remaining time building enemies in parallel against a written contract.

## Goals

- A horizontal-scrolling 2D pixel-art shooter in Python, full screen.
- A small, stable enemy contract (`kaiko.api`) documented in `ENEMY_SPEC.md`.
- Enemies are self-contained folders under `enemies/`. Merging is adding a
  folder. Contributors never edit engine files.
- One contributor's broken enemy never breaks the game or anyone else's work.

Out of scope: audio, pickup powerups, multiple levels, high-score
persistence, gamepad input, scripted waves. Character abilities, the final
boss, and the end screens are specified in
`2026-09-25-characters-and-endings-design.md`, which supersedes this
document where they disagree.

## Stack

- Python 3.13, managed with `uv` (`pyproject.toml`, console script `kaiko`).
- `pygame-ce` for window, input, surfaces, and timing.
- `pytest` for tests. Tests and the validator run headless via
  `SDL_VIDEODRIVER=dummy`.

## Repository layout

```
kaiko_the_game/
  pyproject.toml
  README.md                 how to install, run, and contribute
  ENEMY_SPEC.md             the contract contributors build against
  kaiko/
    __init__.py
    __main__.py             CLI: --windowed, --only NAME, --seed N
    api.py                  Enemy, Sprite, World protocol (public surface)
    sprites.py              Sprite loading from text grids and PNG strips
    entities.py             Player, Bullet
    world.py                World: entity lists, fire(), spawn(), collisions
    director.py             time-based spawner
    registry.py             discovers enemies/*/ and isolates failures
    render.py               canvas scaling, background, HUD
    game.py                 main loop and states
    validate.py             `python -m kaiko.validate`
  enemies/
    _template/__init__.py   copy-and-rename starter (ignored by registry)
    paperwork_blob/__init__.py  worked example shipped with the engine
  tests/
```

Folders under `enemies/` whose name starts with `_` are skipped by the
registry.

## Rendering and coordinates

- Internal canvas: 320 by 180 pixels. Rendered each frame to a Surface and
  integer-scaled (nearest neighbour) to the largest multiple that fits the
  desktop resolution, centred with black letterboxing.
- Full screen by default. `--windowed` opens a 1280 by 720 window with the
  same integer scaling.
- Fixed timestep: 60 updates per second, `dt = 1/60`. Rendering happens once
  per update.
- Coordinates are floats. Origin is top left, x grows right, y grows down.
  Units are canvas pixels and seconds. An entity's `(x, y)` is the centre of
  its sprite.

## Public API (`kaiko/api.py`)

Everything a contributor may import or touch. Anything not listed is
private and may change.

### `Sprite`

- `Sprite.from_text(frames, palette, fps=0)`. `frames` is either a list of
  strings (one frame) or a list of lists of strings (several frames). Every
  row in a frame has the same length and every frame has the same size.
  `palette` maps single characters to hex colour strings like `"#ff8800"`.
  The character `.` is always transparent. Unknown characters raise
  `ValueError` at load time.
- `Sprite.from_png(path, frame_w=None, fps=0)`. `path` is relative to the
  calling enemy's folder. The image is a horizontal strip; `frame_w` is the
  width of one frame, defaulting to the full image width (one frame).
- `fps` is the animation rate; `0` means static. Animation loops.
- `sprite.width`, `sprite.height` give the frame size.
- Enemies face left as drawn. The engine never flips sprites.

### `Enemy`

Class attributes (defaults shown):

| attribute | default | meaning |
| --- | --- | --- |
| `name` | class name | display name, used in logs and the validator |
| `tier` | `1` | `1` (easy) to `5` (hard). `0` means never auto-spawned; only reachable via `world.spawn` |
| `weight` | `1.0` | relative spawn frequency within its tier, must be > 0 |
| `boss` | `False` | spawned alone at boss milestones, only removed off the left edge |
| `hp` | `1` | hit points; player bullets deal 1 |
| `score` | `100` | points awarded on death |
| `sprite` | required | a `Sprite` |
| `hitbox` | `None` | `(w, h)` centred on `(x, y)`; `None` means the sprite size |
| `contact_damage` | `1` | damage dealt to the player on body contact |

Instance attributes set by the engine: `x`, `y`, `vx` (default `-40`),
`vy` (default `0`), `hp` (copied from the class), `age` (seconds since
spawn), `alive`.

Hooks, all optional:

- `on_spawn(self, world)`: called once after `x`, `y` are set.
- `update(self, dt, world)`: called every tick. The default integrates
  `x += vx * dt` and `y += vy * dt`. Overrides that want that behaviour call
  `super().update(dt, world)`.
- `on_hit(self, world, damage)`: called after `hp` is reduced, before death
  is checked.
- `on_death(self, world)`: called once when `hp` reaches 0. Not called on
  `kill()` or off-screen removal.

Methods: `kill()` removes the enemy without score or `on_death`.

### `World` (read and act, never mutate internals)

Read-only: `width` (320), `height` (180), `time` (seconds since the run
started), `dt`, `rng` (a `random.Random` seeded per run), `player` with
`x`, `y`, `alive`, and `enemies` (the live list; do not modify it).

Actions:

- `fire(x, y, vx, vy, damage=1, sprite=None)`: spawns an enemy bullet.
  `sprite=None` uses the default 3 by 3 bullet.
- `spawn(cls, x, y)`: instantiates `cls` (an `Enemy` subclass) at `(x, y)`,
  runs `on_spawn`, and adds it to the world. Returns the instance.

## Engine rules

### Player

- Sprite: Kaiko the submarine, about 24 by 12 pixels, facing right.
- Moves with arrow keys or WASD at 120 px/s, clamped to the canvas.
- Fires torpedoes while space is held: 8 shots per second, 220 px/s
  rightward, 1 damage each.
- Starts with 3 lives. Any hit costs 1 life and grants 1 second of
  invulnerability, shown by blinking. Enemy bullets and enemy bodies both
  count as hits.

### Enemies and bullets

- Player bullets that overlap an enemy's hitbox deal their damage and are
  removed. `on_hit` runs, then if `hp <= 0` the enemy dies: `on_death` runs,
  score is added, a small particle burst plays, and the enemy is removed.
- Collisions are axis-aligned bounding boxes.
- Enemies are removed silently when `x < -48`, `x > width + 96`, or
  `y` is more than 64 outside the canvas. Bosses are exempt from the right
  and vertical margins but are still removed past the left edge, so a boss
  that drifts away cannot block spawning forever.
- Bullets are removed when fully off canvas.
- Hit enemies flash white for a few frames.

### Director

- Tier `t` unlocks at `(t - 1) * 20` seconds, so tier 5 arrives at 80 s.
- Spawn interval starts at 1.5 s and shrinks linearly to 0.5 s at 120 s.
- Each spawn picks a tier among the unlocked ones that have at least one
  enemy, weighting tier `t` by `t` (so tier 1 gets rarer as higher tiers
  unlock), then picks an enemy within that tier by `weight`. If no enemy is
  registered at all, nothing spawns and the game still runs.
- Spawn position: `x = width + sprite.width / 2`, `y` uniform between
  `sprite.height / 2` and `height - sprite.height / 2`. `on_spawn` may
  change it.
- Bosses: if any enemy with `boss = True` exists, one is chosen at random
  every 60 s. While a boss is alive, regular spawning pauses. A boss spawns
  at `x = width + sprite.width / 2`, `y = height / 2`.
- `--only NAME` restricts the pool to that folder's enemies and forces a
  0.7 s spawn interval so contributors see their work immediately.

### Game flow

Superseded by the characters and endings addendum.


- Title screen: press space to start.
- Playing: HUD shows score and lives.
- Game over: shows final score. R restarts, Esc quits. Esc also quits from
  any state.

## Robustness

- The registry imports each `enemies/<name>/__init__.py` with `importlib`.
  An import error is printed with its traceback and the folder is skipped.
- Every `Enemy` subclass defined in that module is registered (subclasses
  imported from elsewhere are not).
- If an enemy hook raises during play, the traceback is printed once per
  class and the instance is killed. The game continues.
- Missing or invalid `sprite` fails validation and the class is skipped at
  load with a message.

## Validator (`python -m kaiko.validate`)

For each discovered enemy class: check required attributes and their
ranges, load the sprite, instantiate it in a headless world, run
`on_spawn` and 120 ticks of `update`, and fire one hit through `on_hit`
and `on_death`. Print a table of name, tier, weight, hp, sprite size, and
PASS or FAIL with the reason. Exit code 1 if any fail. Contributors run
this before opening a PR, and the test suite runs it too.

## Contributor workflow (summarised in `ENEMY_SPEC.md`)

1. `cp -r enemies/_template enemies/my_enemy`, edit `__init__.py`.
2. `uv run python -m kaiko.validate`.
3. `uv run kaiko --only my_enemy --windowed` to play-test.
4. Open a PR that adds only `enemies/my_enemy/`.

## Testing

pytest, headless:

- `Sprite.from_text` parses sizes, palette, transparency, and rejects
  ragged rows and unknown characters.
- Registry discovers the example enemy, skips `_template`, and skips a
  fixture folder that raises on import.
- AABB collision helper: overlapping, touching, and disjoint boxes.
- Director: nothing before tier unlock, tier 2 available at 20 s, boss
  pauses regular spawns, `--only` pool restriction.
- World: player bullet kills an enemy and adds score; enemy bullet costs a
  life; off-screen removal respects the boss exemption.
- Validator passes on every folder in `enemies/`.
