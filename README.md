# Kaiko: The Little Submarine That Could

A side-scrolling "space invaders under the sea" game for the Kaiko GAME-ATHON.
Pilot the Kaiko submarine ever deeper while fending off our favourite enemies:
Datadesk, IT, Legal, Dept. Hospital, Research, Regulatory, GDPR, and the bosses MDR and SCARLET.

- **Funding = HP.** Game over means you ran out of funding.
- **Token limit = mana.** Every shot costs tokens. Tokens regenerate.
- **Depth = progress.** The ocean gets darker and enemies get nastier as you descend.

## Play it online

The `game-mechanism` branch is published with GitHub Pages:
**https://mh-kaiko.github.io/the-little-submarine-that-could/**
Every push to that branch redeploys within about a minute. The debug URL parameters below work there too.

## Run it

No build step. Serve the folder with any static file server and open it in a browser:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly also works in most browsers, but a local server is safest.)

Stop the server with Ctrl+C.

### Jump to a zone

With the server running, open one of these links. The game skips the title screen and starts at that depth:

| Zone | Link |
|------|------|
| Sunlit (coral reef) | http://localhost:8000/?autostart=1 |
| Twilight (rocky canyon) | http://localhost:8000/?autostart=1&depth=900 |
| Midnight (caves) | http://localhost:8000/?autostart=1&depth=1600 |
| MDR boss | http://localhost:8000/?autostart=1&depth=2199 |
| Abyssal (trench, vents) | http://localhost:8000/?autostart=1&depth=2300 |
| SCARLET boss | http://localhost:8000/?autostart=1&depth=3199 |
| Hadal, in the dark | http://localhost:8000/?autostart=1&depth=3400 |
| CANCER final boss | http://localhost:8000/?autostart=1&depth=3999 |

Append `&pilot=thomas`, `&pilot=robert` or `&pilot=veerle` to pick a pilot, and `&god=1` to be unhurtable.
See [Debug / testing URL parameters](#debug--testing-url-parameters) for all options.

## Controls

| Action  | Keys                    |
|---------|-------------------------|
| Move    | WASD or Arrow keys      |
| Shoot   | Space (costs 3 tokens)  |
| Special | Shift (costs tokens, has cooldown) |
| Pause   | P or Esc (also pauses when the window loses focus); P, Esc, Enter or a click resumes |
| Mute    | M                       |
| Choose pilot / start | Left/Right or 1/2/3, then Enter, or click |
| Retry after a run | R (same pilot), Enter to choose a pilot |

## Pilots

- **Thomas (CEO)** pilots the big Kaiko sub. More funding, slower. Special **FUNDRAISE**: a pitch wave that damages everything on screen, clears enemy projectiles and converts 40 tokens into 30 funding.
- **Robert (CTO)** pilots the mini scout sub. Faster, cheaper shots, thinner hull. Special **DEEP THOUGHT**: for 4 seconds the whole ocean slows to 30% while Kaiko keeps full speed.
- **Veerle (MD)** pilots the dome sub. Balanced hull and speed. Special **STAY ON TOPIC**: for 8 seconds every shot is free, homes in on the nearest enemy and pierces through one.

Run out of funding and you are the little submarine that couldn't. Put cancer into remission at 4000 m and you have solved healthcare.

## Corners cut (risk level)

After choosing a pilot you can cut corners. Each shortcut makes Kaiko stronger and the ocean deadlier,
and the number you take is your risk level, which multiplies every score gain:
0 SAFE x1, 1 BOLD x1.3, 2 RECKLESS x1.7, 3 YOLO x2.2, 4 or more UNINSURABLE x3.
Up/Down or click to move, Space or 1-7 to toggle, Enter to dive, Esc back to pilots.
Your choices persist across retries.

| Shortcut | Upside | Downside |
|----------|--------|----------|
| NO QUANTITATIVE EVALUATION | Speed +50% | All damage taken doubled |
| SKIP CLINICAL VALIDATION | Your shots +50% damage | Bosses have +60% hp |
| TRAIN ON UNCONSENTED DATA | Pickups twice as often | GDPR and Legal spawn double and hit double |
| SINGLE AZURE REGION | Token pool and regen +60% | Outages twice as common and drain funding instead of tokens |
| HOTFIX STRAIGHT TO PROD | Shots cost zero tokens | 8% of shots misfire and cost 5 funding |
| OVERPROMISE TO INVESTORS | Start with 200% funding | Funding burns 2 per second |
| SKIP SECURITY REVIEW | Special has no cooldown | Tech debt mines home in on you |

To add one, append an entry to `RISKS` in `src/game.js`. If it only needs multipliers, set them on the
modifier object in `apply(m)` (see `neutralMods` for the keys) and you are done; a new flag needs a
matching check in `update`.

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
| MDR CERT      | Dropped by the MDR boss only. Permanent +25% damage for the rest of the run |

Pickup art: drop `assets/raw/pickup_<kind>.png` (kind = the `POWERUPS` key, e.g. `pickup_tokens.png`) and run
`tools/extract_sprites.py`. Pickups without a sprite fall back to a coloured box. The tech debt mine uses `assets/raw/tech_debt.png` the same way.

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

Destructible crates give points and sometimes drop a pickup. Thomas's FUNDRAISE hits them too.

## Depth zones (difficulty curve)

| Depth   | Zone                          | New enemies |
|---------|-------------------------------|-------------|
| 0 m     | Sunlit zone: Onboarding       | Datadesk, IT |
| 700 m   | Twilight zone: Hospital rounds| Legal, Research, Dept. Hospital |
| 1500 m  | Midnight zone: Compliance trench | Regulatory, GDPR |
| 2200 m  | **Boss: MDR audit**           | |
| 2200 m+ | Abyssal zone: Certification run | everything, faster |
| 3200 m  | **Boss: SCARLET review**      | CE mark obtained |
| 3200 m+ | Hadal zone: Deployment        | everything, fastest |
| 4000 m  | **Final boss: CANCER**        | Win = remission |

Spawn rate and enemy fire rate scale smoothly with depth so every element gets seen before things get hectic.

## Final boss: Cancer

A tumour mass with a glowing core, at 4000 m. The mass takes 20% damage. The core (its mouth, facing
you) opens on a cycle: closed 3 s, a white flash for 0.5 s, open 2 s. Plain shots fired at the mouth's
height fly into it while it is open and hit the core for full damage; shots that land during the flash
do triple damage ("early detection"). OPUS 6, VORTEX 3 and STAY ON TOPIC shots always reach the core,
at reduced damage while it is closed.
DEEP THOUGHT doubles the open window. Opening the mouth also spits a fan of spores at you, so do not camp
in front of it. Tentacles sweep up and down in front of it and reach further with every stage.

| Stage | hp | What it does |
|-------|----|--------------|
| Growth | above 70% | Buds tumour cells that drift at you and split once after 5 s. One shot kills a cell; cells sometimes drop OPUS 6 |
| Metastasis | 30 to 70% | Fires fast, weaving metastatic cells that home in on you. Shoot one down (4 hits) or it seeds a tumour in the left third of the screen that grows hp and fires spores at your back |
| Resistance | below 30% | Regrows 6 hp/s whenever it has not been hit for 2 s, the abyss fog closes in, a third tentacle reaches your lane, metastatic cells come in pairs |

Killing it clears everything it spawned and ends the run in remission. Jump straight to it with `?depth=3999`.

## Boss: MDR audit

MDR parks on the right and runs an audit in stages keyed to its hp. Each stage ticks a box on the
checklist at the top of the screen: CLINICAL EVIDENCE at 70%, RISK FILE at 40%, POST-MARKET at 15%.

| Stage | hp | What it does |
|-------|----|--------------|
| Documentation request | above 70% | Walls of documents with a two-row gap that shifts each volley, aimed paragraphs in between |
| Conformity test | 40 to 70% | A telegraphed red scan beam sweeps right to left and drains tokens, then an alarm fan and aimed shots |
| Non-conformity | below 40% | Siren on. Calls in two Regulatory minions and keeps them topped up, rotating alarm spirals, faster scans, one-row walls |
| Final warning | below 15% | Same, faster |

MDR only takes full damage while one of its document walls is on screen ("distracted by paperwork"). It takes
half damage during a scan and 70% otherwise, so attack during the walls. Killing it clears the minions and drops
MDR CERT plus funding and tokens.

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
| `pilot=thomas\|robert\|veerle` | choose the pilot |
| `depth=<m>` | start every run at that depth, with or without `autostart` (e.g. `2199` for MDR, `3199` for SCARLET, `3999` for cancer) |
| `autofire=1` | hold fire automatically |
| `turbo=<n>` | run `n` simulation steps per frame (fast-forward) |
| `god=1` | the pilot cannot be hurt (for checking boss stages) |
| `risks=noeval,hotfix` | pre-select shortcuts by key: `noeval`, `noclin`, `nodata`, `oneregion`, `hotfix`, `overpromise`, `nosec` |
| `debug=1` | exposes game state as `window.KAIKO` in the browser console |
