# Kaiko: The Little Submarine That Could

A side-scrolling "space invaders under the sea" game for the Kaiko GAME-ATHON.
Pilot the Kaiko submarine ever deeper while fending off our favourite enemies:
Datadesk, IT, Legal, Dept. Hospital, Research, Regulatory, GDPR, and the bosses MDR and SCARLET.

- **Funding = HP.** Game over means you ran out of funding.
- **Token limit = mana.** Every shot costs tokens. Tokens regenerate.
- **Depth = progress.** The ocean gets darker and enemies get nastier as you descend.

## Run it

No build step. Serve the folder with any static file server and open it in a browser:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly also works in most browsers, but a local server is safest.)

## Controls

| Action  | Keys                    |
|---------|-------------------------|
| Move    | WASD or Arrow keys      |
| Shoot   | Space (costs 3 tokens)  |
| Special | Shift (costs tokens, has cooldown) |
| Pause   | P or Esc                |
| Mute    | M                       |
| Choose pilot / start | Left/Right + Enter, or click |

## Pilots

- **Robert (CEO)** pilots the big Kaiko sub. More funding, slower. Special **FUNDRAISE**: a pitch wave that damages everything on screen, clears enemy projectiles and converts 40 tokens into 30 funding.
- **Thomas (CTO)** pilots the mini scout sub. Faster, cheaper shots, thinner hull. Special **HOTFIX**: 5 seconds of invincibility and double fire rate.

## Power-ups

| Pickup        | Effect |
|---------------|--------|
| OPUS 6        | Triple projectiles for 12 s |
| VORTEX 3      | OP weapon: piercing vortex shots, free, for 8 s |
| INVINCIBLE    | Shield for 6 s |
| SERIES C      | +30 funding |
| TOKEN TOP-UP  | +50 tokens |
| INVESTOR DEAL | +45 funding, but −40 tokens |
| AZURE CREDITS | +70 tokens, but −15 funding |

## Hazards

- **Tech debt mines** drift towards you. Shoot them for points or eat 20 funding.
- **Azure outage clouds** cannot be destroyed. Inside one you are slowed and your tokens drain.

## Obstacles

Cave sections alternate with open water. Scraping a wall costs 8 funding and bounces you off. Walls block both your shots and enemy shots.
Gaps are never narrower than 180 px and every obstacle leaves 150 px of free water, so pickups are always reachable.
Walls recede before and during boss fights.

| Zone     | Terrain | Obstacles |
|----------|---------|-----------|
| Sunlit   | Coral reef floor, no ceiling | **BACKLOG** ticket piles (destructible) |
| Twilight | Rocky canyon with a ceiling | Rock pillars, **NDA** filing cabinets |
| Midnight | Narrower, spiky caves | More rocks, **RED TAPE** boxes |
| Abyssal  | Tight volcanic trench | **LEGACY** server racks, **BURN RATE** vents that rumble then erupt (15 funding), darkness below 3000 m |

Destructible crates give points and sometimes drop a pickup. Robert's FUNDRAISE hits them too.

## Depth zones (difficulty curve)

| Depth   | Zone                          | New enemies |
|---------|-------------------------------|-------------|
| 0 m     | Sunlit zone: Onboarding       | Datadesk, IT |
| 700 m   | Twilight zone: Hospital rounds| Legal, Research, Dept. Hospital |
| 1600 m  | Midnight zone: Compliance trench | Regulatory, GDPR |
| 2600 m  | **Boss: MDR audit**           | |
| 2600 m+ | Abyssal zone: Certification run | everything, faster |
| 4000 m  | **Final boss: SCARLET review** | Win = CE mark obtained |

Spawn rate and enemy fire rate scale smoothly with depth so every element gets seen before things get hectic.

## Project layout

```
index.html            page shell
src/game.js           game loop, entities, rendering, HUD
src/audio.js          WebAudio synth: underwater waltz loop + sound effects
assets/raw/           original pixel art (submarine, enemy sheets, ocean background)
assets/sprites/       transparent sprites cut from the sheets
tools/extract_sprites.py   regenerates assets/sprites from assets/raw (needs Pillow, numpy, scipy)
```

## Tweaking

All tuning lives at the top of `src/game.js`: `CHARACTERS`, `ENEMIES`, `ZONES`, `POWERUPS`, `THEMES` (obstacles), `DESCENT_RATE`, `MAX_DEPTH`.

## Debug / testing URL parameters

Handy for jumping straight to a section during the hackathon:

```
index.html?autostart=1&pilot=thomas&depth=2599&autofire=1&turbo=1
```

| Param      | Effect |
|------------|--------|
| `autostart=1` | skip the title screen |
| `pilot=robert\|thomas` | choose the pilot |
| `depth=<m>` | start at that depth (e.g. `2599` for the MDR boss, `3999` for SCARLET) |
| `autofire=1` | hold fire automatically |
| `turbo=<n>` | run `n` simulation steps per frame (fast-forward) |
