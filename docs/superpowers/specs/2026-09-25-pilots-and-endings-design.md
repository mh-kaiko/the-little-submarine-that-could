# Pilots, abilities, and endings: design

Date: 2026-09-25. Applies to the HTML engine (`index.html`, `src/game.js`)
on the `game-mechanism` branch. Replaces the earlier pygame-era draft
(`feat/start-death-screens`, commit `4b314e0`).

The game is "The Little Submarine That Could". Funding is HP: dying means
running out of funding before healthcare is solved. Winning means
beating the final boss SCARLET at 4000 m, which the engine already does.
This change adds a third pilot, fixes the pilots' roles, gives each pilot
a distinct special, puts the pilot's face in the submarine, and rewrites
both end screens.

## Pilots

`CHARACTERS` becomes three entries, in select-screen order:

| key | name | title | sub sprite | colour | stats | special |
| --- | --- | --- | --- | --- | --- | --- |
| `thomas` | THOMAS | CEO | `kaiko_sub` | `#ffb300` | today's `robert` stats (width 150, speed 230, funding 120, tokens 100, fireRate 0.22, tokenRegen 11, bulletDmg 1.2) | FUNDRAISE |
| `robert` | ROBERT | CTO | `kaiko_mini` | `#4fd1ff` | today's `thomas` stats (width 110, speed 310, funding 85, tokens 120, fireRate 0.16, tokenRegen 14, bulletDmg 1) | DEEP THOUGHT |
| `veerle` | VEERLE | MD | `kaiko_dome` | `#c08cff` | width 130, speed 270, funding 100, tokens 110, fireRate 0.19, tokenRegen 12, bulletDmg 1 | STAY ON TOPIC |

In short: Thomas takes over what the engine called Robert (big sub, CEO,
FUNDRAISE); Robert takes the mini scout sub with a new special; HOTFIX
is removed.

Blurbs (three lines each, as today):

- Thomas: "The big Kaiko sub." / "More funding, tougher hull," / "a bit slower."
- Robert: "The nimble scout sub." / "Faster, cheaper shots," / "thinner hull."
- Veerle: "The clinical sub." / "Balanced hull and speed." / "Keeps everyone on topic."

`selected` defaults to `thomas`.

## Specials

All specials keep the engine's model: Shift activates, it costs tokens,
and `specialCd` starts at activation. Duration-based specials store their
remaining time on the player and show up in the HUD buff list.

**FUNDRAISE (Thomas).** Unchanged: cost 40, cooldown 12. Pitch wave that
hits every enemy (3 damage, 6 to bosses), clears enemy bullets, and adds
30 funding.

**DEEP THOUGHT (Robert).** Cost 35, cooldown 15, duration 4 s
(`p.deep`). While active, the world runs at 30% speed and Kaiko does not.
Description lines: "Slow the whole ocean to 30%" / "for 4 seconds." /
"Kaiko keeps full speed."

In `update(dt)`, compute `const wdt = p.deep > 0 ? dt * 0.3 : dt;` and use
`wdt` for:

- depth descent and `scrollX`;
- spawn timers (`spawnT`, `hazardT`, `pickupT`);
- enemy movement, `e.t`, `e.flash`, and enemy/boss shoot timers;
- enemy bullets, hazards, pickups;
- particles and bubbles.

Everything else keeps `dt`: player movement and tilt, all player timers
(`fireCd`, `invuln`, `shield`, `opus`, `vortex`, `deep`, `onTopic`,
`specialCd`), token regen, player bullets, floating texts, banners, and
`G.time`. Enemy burst patterns that use `setTimeout` (GDPR binary, boss
volleys) keep real-time spacing between shots. That is accepted; the
bullets themselves still move slowly.

A translucent blue overlay (`rgba(70,130,255,0.14)`) is drawn over the
play field (below the HUD) while active.

**STAY ON TOPIC (Veerle).** Deliberately overtuned. Cost 30, cooldown 12,
duration 8 s (`p.onTopic`). Description lines: "8 seconds of free," /
"homing, piercing shots." / "Nobody wanders off."

While active, every shot fired by `shoot()` (not VORTEX shots):

- costs no tokens;
- uses `fireCd = c.fireRate * 0.66` (roughly 1.5 times the fire rate);
- is created with `homing: true` and `pierceLeft: 1`.

Homing, in the player-bullet loop: find the nearest living enemy; turn the
bullet's velocity toward it by at most 12.6 rad/s (about 720 degrees per
second), keeping its speed. With no enemy alive it flies straight.
Pierce: on a hit, if `b.pierceLeft > 0` it decrements and the bullet
continues; a `hitSet` prevents hitting the same enemy twice (same pattern
as VORTEX). Bullets already fired keep homing and pierce after the
special ends. Homing bullets are drawn in Veerle's colour.

Opus 6 still triples the shots during STAY ON TOPIC; each gets homing
and pierce.

**Removed:** HOTFIX, `p.hotfix`, the hotfix fire-rate multiplier, and its
HUD buff entry.

## Faces in the submarines

Assets:

- Copy `data/thomas.png`, `data/robert.png`, `data/veerle.png` from `main`
  to `assets/faces/<key>.png`, downscaled to 256 by 256 with nearest
  neighbour. They are square pixel-art headshots on a navy background.
- Copy `data/submarine.png` from `main` to `assets/raw/kaiko_dome.png`
  and add it to `tools/extract_sprites.py`, producing
  `assets/sprites/kaiko_dome.png` (transparent, cropped).
- `loadAssets` loads `kaiko_dome` with the other sprites and the three
  faces as `IMG.face_thomas`, `IMG.face_robert`, `IMG.face_veerle`.

Drawing: a `FACE_SPOT` table gives, for each sub sprite, the window
centre and radius as fractions of the sprite's drawn width, relative to
the sprite centre (right-facing). Initial values, to be tuned by eye:

| sprite | window | x | y | r |
| --- | --- | --- | --- | --- |
| `kaiko_sub` | round porthole on the hull | -0.05 | -0.02 | 0.07 |
| `kaiko_mini` | front dome | +0.43 | +0.02 | 0.09 |
| `kaiko_dome` | front dome | +0.40 | +0.03 | 0.09 |

`drawFace(key, x, y, r)` clips to a circle of radius `r`, draws the
centre 70% of the face image (the head, cropping shoulders and
background) scaled to fill the circle, then strokes a 2 px dark rim and a
small white glass highlight. It is called right after the sub sprite,
inside the same translate/rotate so the face follows the sub's tilt and
blink. `drawPlayer`, the select cards, and the victory screen all use it.

If a face image failed to load, `drawFace` draws nothing (the sub's own
window stays visible).

## Title and pilot select

The title screen keeps its layout: "KAIKO", "THE LITTLE SUBMARINE THAT
COULD", "CHOOSE YOUR PILOT", and the blinking "PRESS ENTER TO DIVE".

Cards become three, 290 px wide, centred at x = 160, 480 and 800, from
y 150 to 445. Each card: the pilot's sub with face (bobbing when
selected), `NAME (TITLE)` in the pilot's colour, the three blurb lines,
the stats line, `SPECIAL: NAME`, and the three description lines. The
selected card gets the colour border, as today.

Input: Left/A and Right/D cycle through the three (wrapping). Digit1,
Digit2 and Digit3 pick directly. A click selects by thirds of the canvas
width. Enter or Space starts. The two help lines at the bottom stay as
they are.

## Game over: the little submarine that couldn't

On the transition to `gameover`, record `G.endAt = elapsed` and generate
`G.drips`: 7 to 10 drips, each with an x offset inside the "N'T" text
width, width 3 to 6 px, max length 25 to 90 px, and speed 25 to 60 px/s.
Drips are pure functions of `elapsed - G.endAt`, so the frozen `update()`
does not need to run.

`drawEnd(false)`:

- the existing dark red overlay;
- on one line, centred as a whole at `H/2 - 110`:
  "THE LITTLE SUBMARINE THAT COULD" at 18 px in `#e8f0ff`, immediately
  followed by "N'T" at 34 px in blood red `#b0101a` with a darker
  `#5a0008` shadow;
- the drips hang from the bottom of "N'T": each a vertical rect in
  `#b0101a` of length `min(max, t * speed)` with a slightly wider round
  drop at its tip;
- "You ran out of funding before solving healthcare." at 10 px;
- `SCORE N` and the existing depth, kills and time line;
- blinking "ENTER: CHOOSE PILOT   R: RETRY".

## Victory: you've solved healthcare

On the transition to `win`, record `G.endAt = elapsed` and generate
`G.confetti`: 120 pieces with start x, fall speed, sway, spin and a
colour from the pilots' colours plus white. Positions are functions of
`elapsed - G.endAt`, and pieces wrap back to the top.

`drawEnd(true)`:

- a dark green overlay (as today), then confetti;
- the pilot's sub with face, bobbing, centred at `H/2 - 150`;
- "CONGRATULATIONS!" at 26 px in `#5cff5c`;
- "You've solved healthcare." at 12 px;
- "Kaiko is now deployed in every hospital in the EU," and "helping a
  million clinicians treat millions of patients." at 9 px on two lines;
- "SCARLET signed off. CE mark obtained." at 8 px in `#9fc3ff`;
- `SCORE N` and the stats line;
- blinking "ENTER: CHOOSE PILOT   R: PLAY AGAIN".

## Input on end screens

`gameover` and `win`: Enter or Space goes to `title` (as today). R calls
`startGame()` with the same `selected` pilot. A click still goes to
`title`.

## README

Update the Pilots section to the three pilots, roles, and specials above,
and remove HOTFIX. The debug query string accepts `pilot=veerle`.

## Verification

The HTML engine has no automated test suite, so verification is manual in
the browser through the existing debug query string (`pilot`,
`autostart`, `depth`, `autofire`, `turbo`):

1. The title shows three cards. Arrows, 1/2/3 and clicks select, Enter
   starts, and each pilot flies the right sub with their face in the
   window, following tilt and blink.
2. `?pilot=thomas&autostart=1`: FUNDRAISE behaves as before.
3. `?pilot=robert&autostart=1`: DEEP THOUGHT visibly slows enemies,
   bullets and depth while Kaiko moves at full speed; the HUD shows the
   buff and the blue tint; everything returns to normal after 4 s.
4. `?pilot=veerle&autostart=1&autofire=1`: STAY ON TOPIC bullets curve
   into enemies, pass through the first, cost no tokens, and fire faster.
5. Die on purpose: the "COULDN'T" screen shows, the drips grow and stop,
   R retries with the same pilot, and Enter returns to the title.
6. `?pilot=veerle&autostart=1&depth=3990&autofire=1&turbo=5`: beat
   SCARLET; the victory screen shows confetti, the sub with face, and the
   deployment text; R plays again.
7. No console errors in any of the above.
