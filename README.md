# The Little Submarine That Could

Kaiko, a submarine, flies right and shoots the problems we see in
healthcare every day. A pixel-art scrolling shooter in Python, built at a
two-hour jam. Each enemy is a self-contained plugin folder so the team can
build them in parallel and merge without conflicts.

## Play

```bash
uv sync
uv run kaiko                 # full screen
uv run kaiko --windowed      # 1280x720 window
```

Arrows or WASD move, space fires, Esc quits, R restarts after game over.

## Build an enemy

Read `ENEMY_SPEC.md`. Short version:

```bash
cp -r enemies/_template enemies/my_enemy
# edit enemies/my_enemy/__init__.py
uv run python -m kaiko.validate
uv run kaiko --only my_enemy --windowed
```

Open a PR that adds your folder.

## Other commands

```bash
uv run kaiko --list          # what loaded, from which folder
uv run kaiko --seed 7        # reproducible run
uv run pytest -q             # engine tests, includes the validator over enemies/
```

## Layout

```
kaiko/          engine (do not edit for an enemy)
  api.py        the public contract: Enemy, Sprite, WorldView
  world.py      simulation, collisions, error isolation
  director.py   who spawns when
  registry.py   finds enemies/*/ and skips broken ones
  render.py     320x180 canvas, integer-scaled to the screen
  validate.py   python -m kaiko.validate
enemies/        one folder per enemy; _template is the starter
tests/          pytest, headless
docs/superpowers/   design spec and build plan
```
