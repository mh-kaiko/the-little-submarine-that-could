# Characters, abilities, and endings: design

Date: 2026-09-25. Addendum to `2026-09-25-kaiko-engine-design.md`. Where
the two disagree, this document wins.

The game is called "The Little Submarine That Could". The player's hit
points are Kaiko's funding: dying means running out of funding before
healthcare is solved. Winning means surviving long enough to beat a final
boss. Before a run the player picks one of three Kaiko people as pilot;
each has a unique active ability, and the chosen pilot's face shows in the
submarine's porthole.

## Game flow

States: `title` → `select` → `playing` → `gameover` or `victory`.

| state | keys |
| --- | --- |
| `title` | Space: go to `select` |
| `select` | Left/Right or A/D: move selection. Space: start a run with the highlighted character |
| `playing` | as before, plus E or Left Shift: use ability |
| `gameover`, `victory` | R: new run with the same character. Space: back to `select` |

Esc quits from any state. The selection on `select` defaults to the last
character played (Thomas on first launch).

## Characters (`kaiko/characters.py`)

A `Character` dataclass: `key` (folder-safe id), `name`, `role`,
`ability`, `description`, `duration` (seconds, `0` for instant),
`cooldown` (seconds), `face` (Sprite, about 6 by 6), `portrait` (Sprite,
about 32 by 32). A module-level `CHARACTERS` tuple holds them in select
screen order.

| key | name | role | ability | duration | cooldown |
| --- | --- | --- | --- | --- | --- |
| `thomas` | Thomas | CEO | Pitch Deck | 0 (instant) | 20 s |
| `robert` | Robert | CTO | Deep Thought | 4 s | 20 s |
| `veerle` | Veerle | MD | Stay On Topic | 8 s | 12 s |

Sprites: if `kaiko/assets/characters/<key>/face.png` or `portrait.png`
exists it is loaded with `Sprite.from_png`; otherwise a placeholder
generated in code is used (a solid colour square per character with the
initial drawn on it for the portrait, a flat skin-tone disc with two eye
pixels for the face). Dropping in the PNGs requires no code change.

### Abilities

Pressing the ability key while `cooldown_left == 0` activates it and sets
`cooldown_left = cooldown`. The cooldown counts down in real (unscaled)
time and starts at activation, including for abilities with a duration.
The ability is not usable while the player is dead.

**Pitch Deck (Thomas).** Instant. Removes every enemy bullet, then deals 3
damage to every living enemy whose centre is on the canvas, bosses
included, through `World.damage`. Draws an expanding ring from Kaiko for
0.3 s (cosmetic only).

**Deep Thought (Robert).** For 4 s, `world.time_scale = 0.3`. Everything
except the player and player bullets advances by `dt * time_scale`:
enemy updates and ages, enemy bullets, particles, `world.time`,
`world.dt`, and the director. The player's movement, fire cooldown,
invulnerability and ability timers use unscaled `dt`. A translucent blue
overlay tints the canvas while active.

**Stay On Topic (Veerle).** Deliberately overtuned. For 8 s, player
torpedoes fired during the window:

- are homing: each tick the torpedo turns its velocity toward the nearest
  living enemy at up to 720 degrees per second, keeping its speed
  (220 px/s); with no enemy alive it flies straight;
- pierce once: a torpedo survives its first enemy hit and is removed on
  the second, and never hits the same enemy twice;
- are fired at 12 per second instead of 8.

Torpedoes already in flight when the window ends keep their homing and
pierce.

## Engine changes

- `Player` gains `character`, `cooldown_left`, `active_left`, and
  `use_ability(world) -> bool`. Timers tick on unscaled `dt`.
- `World` gains `time_scale` (default `1.0`). `World.update(dt, ...)`
  applies it as described under Deep Thought.
- `World.damage(enemy, n)`: the hit path extracted from `_collide`. It
  reduces `hp`, sets the flash, runs `on_hit`, and if `hp <= 0` runs the
  death path (score, particles, `on_death`). Hooks keep going through
  `_call`, so an enemy that raises is removed and logged once, never
  crashing the game. Bullet collisions and Pitch Deck both use it.
- `Bullet` gains `homing: bool = False`, `pierce: int = 0`, and
  `hit_ids: set[int]` (enemy `id()`s already hit).
- `ENEMY_SPEC.md` gets one line: `world.time` and `world.dt` slow down
  during Deep Thought, so enemies that move by `dt` slow down for free.
  The enemy contract is otherwise unchanged.

## Final boss and victory

- The director tracks survival on `world.time` (so Deep Thought stretches
  it). At `FINAL_BOSS_AT = 180` seconds it stops scheduling regular
  bosses, waits until no boss is alive, then spawns the final boss at
  `x = width + sprite.width / 2`, `y = height / 2`. Regular spawns pause
  while it is alive, as for any boss.
- The final boss is never culled, whatever its position.
- When the final boss dies (by torpedo or Pitch Deck), `world.won` becomes
  `True` and the game enters `victory`. If the player dies first, it is
  `gameover` as usual.
- `--only NAME` disables the final boss so contributor play-testing is
  endless.

**Open decision: who owns the final boss.** Either the engine (a class in
`kaiko/final_boss.py`) or a contributor (a new `final = True` class
attribute in the enemy contract). Until decided, the engine ships a
simple placeholder in `kaiko/final_boss.py`: tier 0, `boss = True`, hp 60,
parks at `x = width - 40` and bobs vertically while firing aimed bullets
every 0.8 s. Swapping it later only changes which class the director
spawns. `FINAL_BOSS_AT` is also provisional.

## HUD (`playing`)

- Top left: `SCORE 000000`.
- Top right: `FUNDING` followed by one € icon per remaining life
  (replaces the submarine life icons).
- Below funding: the ability name and a cooldown bar. While the ability
  is active the bar shows remaining duration in the character's colour;
  when ready it blinks.
- Bottom: a thin "deployment" progress bar filling from 0 to
  `FINAL_BOSS_AT`; it reads `FINAL BOSS` once the final boss is out.

## Submarine porthole

The `KAIKO` sprite is redrawn with a round porthole about 6 by 6 pixels in
place of the current 2 by 2 one. The renderer blits the selected
character's `face` into the porthole after drawing the hull, following
the invulnerability blink.

## Screens

Canvas is 320 by 180; the small font fits about 50 characters per line,
so longer text is wrapped by a small helper.

**Title.** "THE LITTLE SUBMARINE THAT COULD" (big font), "press SPACE".

**Select.** Heading "CHOOSE YOUR PILOT". Three cards about 100 px wide:
portrait, name, role, ability name, one-line description. The
highlighted card has a bright border and a slight bob. Descriptions:

- Thomas: "Shockwave that wipes enemy bullets and hits everything."
- Robert: "Slow the whole ocean down. Kaiko keeps full speed."
- Veerle: "Every torpedo homes in and pierces. Nobody wanders off."

**Game over (the little submarine that couldn't).** The last frame of
play stays visible under a dark red tint. Then:

- "THE LITTLE SUBMARINE THAT COULD" in HUD white;
- directly after it, on its own line and larger, "N'T" in blood red
  (`#b0101a`) with pixel drips: a handful of 1 to 2 px wide columns under
  the letters that grow downward over about 2 s to random lengths, each
  ending in a slightly wider drop;
- "You ran out of funding before solving healthcare.";
- `score N`;
- "R retry   SPACE change pilot   ESC quit".

**Victory.** Confetti particles fall across the screen. The submarine
with the pilot's face bobs in the centre. Text:

- "CONGRATULATIONS!" (big font);
- "You've solved healthcare.";
- "Kaiko is now deployed in every hospital in the EU, helping a million
  clinicians treat millions of patients." (wrapped);
- `score N   time M:SS`;
- "R play again   SPACE change pilot   ESC quit".

## Testing

pytest, headless:

- Deep Thought: with `time_scale = 0.3`, an enemy moves 30% as far as the
  player over the same ticks, and `world.time` advances by `0.3 * dt`.
- Pitch Deck: clears enemy bullets, deals 3 damage to every on-canvas
  enemy, awards score for kills, and an enemy whose `on_hit` raises is
  removed without the exception escaping.
- Stay On Topic: a homing torpedo fired straight right turns toward an
  enemy above it; a piercing torpedo kills two 1-hp enemies in a row and
  does not hit the same enemy twice; fire rate is 12 per second while
  active.
- Ability gating: a second activation during cooldown does nothing; dead
  players cannot activate.
- Game states: select → playing carries the chosen character; R from
  `gameover` keeps it; Space returns to `select`.
- Final boss: spawns once at `FINAL_BOSS_AT`, is never culled, its death
  sets `world.won` and the game enters `victory`; `--only` never spawns
  it.
- Character sprites: missing PNGs fall back to placeholders.
