# Pilots, Abilities, and Endings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three pilots (Thomas CEO, Robert CTO, Veerle MD) with distinct specials, a three-card pilot select, and new "couldn't" and victory end screens in the HTML engine.

**Architecture:** Everything lives in the single IIFE in `src/game.js`, following its existing style (terse one-line statements, module-level helpers, `G` session object, `state` string). Deep Thought is a scaled world `dt` inside `update()`. Stay On Topic adds homing and pierce fields to player bullets. End screens are pure functions of `elapsed - G.endAt`, so the frozen `update()` never needs to run for them.

**Tech Stack:** Plain JavaScript and Canvas 2D, no build step. Python with Pillow, numpy and scipy (via `uv run --no-project --with ...`) only for the sprite extraction tool.

**Spec:** `docs/superpowers/specs/2026-09-25-pilots-and-endings-design.md`

## Global Constraints

- Thomas = CEO, Robert = CTO, Veerle = MD. Never the other way round.
- Pilot order everywhere: `thomas`, `robert`, `veerle`. `selected` defaults to `thomas`.
- HOTFIX is removed completely (`p.hotfix`, its fire-rate multiplier, its HUD buff).
- Canvas is 960 by 540 (`W`, `H`). Font is `FONT` (Press Start 2P); use the existing `text()` helper.
- Colours: Thomas `#ffb300`, Robert `#4fd1ff`, Veerle `#c08cff`, blood `#b0101a`, blood shadow `#5a0008`.
- Victory copy, verbatim: "CONGRATULATIONS!", "You've solved healthcare.", "Kaiko is now deployed in every hospital in the EU," / "helping a million clinicians treat millions of patients.", "SCARLET signed off. CE mark obtained."
- Game over copy, verbatim: "THE LITTLE SUBMARINE THAT COULD" + "N'T", "You ran out of funding before solving healthcare."
- No new dependencies, no build step, no test framework. Verification is `node --check src/game.js` plus the browser checks in each task.

## How to verify in the browser

Serve the repo root and open the game:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/?debug=1` (plus any of the existing debug params: `pilot=`, `autostart=1`, `depth=`, `autofire=1`, `turbo=`). With `debug=1`, Task 1 exposes `window.KAIKO` in the devtools console (`KAIKO.G`, `KAIKO.state`, `KAIKO.CHARACTERS`). Use the claude-in-chrome skill if it is available; otherwise ask your human partner to run the check and report back. Hard-refresh (Cmd+Shift+R) after each edit.

## Review Focus

- STAY ON TOPIC with 0 tokens: shots must still fire because they are free (Task 4, Step 4).
- Homing bullets that turn back toward an enemy behind Kaiko must be culled off the left edge, not live forever (Task 4, Step 4).
- Pausing during the 1.5 s delay after SCARLET dies must still end in victory (today's `setTimeout` checks `state === 'play'` and drops the win) (Task 6, Step 4).
- R must restart only on the end screens, never during play, pause, or on the title (Task 5, Step 4).
- A new run after using Deep Thought must start at normal speed with no blue tint, and the tint must not show on the end screens (Task 3, Step 4).

---

### Task 1: Veerle's assets and a debug handle

**Files:**
- Modify: `tools/extract_sprites.py` (the `__main__` block at the bottom)
- Create: `assets/sprites/veerle.png`, `assets/sprites/kaiko_dome.png` (generated)
- Modify: `src/game.js:12` (`SPRITES`), `src/game.js:672-683` (debug hooks at the bottom)

**Interfaces:**
- Produces: `IMG.veerle` (portrait) and `IMG.kaiko_dome` (sub sprite) loaded by `loadAssets`; `window.KAIKO = { G, CHARACTERS, state }` when the URL has `debug=1`.

- [ ] **Step 1: Update the extraction script**

In `tools/extract_sprites.py`, replace the `__main__` block's first five lines:

```python
if __name__ == '__main__':
    portrait('robert')
    portrait('thomas')
    sub = crop_to_content(transparentize('submarine', tol=14))
    Image.fromarray(sub).save(f'{OUT}/kaiko_sub.png')
    print(f'kaiko_sub    {sub.shape[1]}x{sub.shape[0]}')
```

with:

```python
if __name__ == '__main__':
    portrait('robert')
    portrait('thomas')
    portrait('veerle')
    # assets/raw/submarine.png is now the dome sub (ea99889). The committed
    # kaiko_sub.png is the old big sub, so write the dome to its own sprite.
    sub = crop_to_content(transparentize('submarine', tol=14))
    Image.fromarray(sub).save(f'{OUT}/kaiko_dome.png')
    print(f'kaiko_dome   {sub.shape[1]}x{sub.shape[0]}')
```

- [ ] **Step 2: Generate only the two new sprites**

Run from the repo root (this avoids regenerating every sprite):

```bash
uv run --no-project --with pillow --with numpy --with scipy python -c "
import sys; sys.path.insert(0, 'tools')
import extract_sprites as x
from PIL import Image
x.portrait('veerle')
sub = x.crop_to_content(x.transparentize('submarine', tol=14))
Image.fromarray(sub).save(f'{x.OUT}/kaiko_dome.png')
print('kaiko_dome', sub.shape[1], 'x', sub.shape[0])
"
git status --short assets
```

Expected: prints `veerle       256x...` and `kaiko_dome ...`. `git status` shows only `?? assets/sprites/kaiko_dome.png` and `?? assets/sprites/veerle.png`. Open both PNGs (for example with the Read tool) and check that the backgrounds are transparent and the images aren't clipped.

- [ ] **Step 3: Load the sprites**

In `src/game.js`, change line 12 to:

```js
  const SPRITES = ['kaiko_sub', 'kaiko_mini', 'kaiko_dome', 'robert', 'thomas', 'veerle', 'datadesk', 'legal', 'hospital', 'research', 'it', 'regulatory', 'gdpr', 'mdr', 'scarlet'];
```

- [ ] **Step 4: Add the debug handle**

At the bottom of `src/game.js`, replace:

```js
  // Debug/testing hooks: ?pilot=robert|thomas&autostart=1&depth=2600&autofire=1&turbo=30
  const Q = new URLSearchParams(location.search);
  TURBO = clamp(parseInt(Q.get('turbo') || '1', 10) || 1, 1, 200);
```

with:

```js
  // Debug/testing hooks: ?pilot=thomas|robert|veerle&autostart=1&depth=2600&autofire=1&turbo=30&debug=1
  const Q = new URLSearchParams(location.search);
  TURBO = clamp(parseInt(Q.get('turbo') || '1', 10) || 1, 1, 200);
  if (Q.get('debug')) window.KAIKO = { G, CHARACTERS, get state() { return state; } };
```

- [ ] **Step 5: Verify**

Run: `node --check src/game.js`. Expected: no output, exit 0.

Browser: open `http://localhost:8000/?debug=1`. In the console, `KAIKO.state` returns `'title'`. `[IMG]` isn't exposed, so check the Network tab instead: `kaiko_dome.png` and `veerle.png` load with status 200. The title screen still works as before.

- [ ] **Step 6: Commit**

```bash
git add tools/extract_sprites.py assets/sprites/veerle.png assets/sprites/kaiko_dome.png src/game.js
git commit -m "Add Veerle's portrait and the dome sub sprite; expose a debug handle"
```

---

### Task 2: Three pilots, roles fixed, HOTFIX removed, three-card select

**Files:**
- Modify: `src/game.js`: `CHARACTERS` (lines 37-52), `selected` (line 91), `newGame` player fields (line 104), pointer handler (lines 122-130), `onKey` title branch (lines 133-136), `shoot` (line 195), `useSpecial` (lines 200-215), update timers (line 331), HUD buffs (in `drawHUD`), `drawTitle` card loop (lines 613-629)

**Interfaces:**
- Consumes: `IMG.veerle`, `IMG.kaiko_dome` (Task 1).
- Produces: `CHARACTERS.thomas|robert|veerle` with `special.duration` (seconds) on Robert and Veerle; `PILOTS` (array of keys in select order); player fields `p.deep` and `p.onTopic` (seconds remaining, count down on unscaled `dt`). Tasks 3 and 4 give those timers their effects.

- [ ] **Step 1: Replace `CHARACTERS`**

Replace the whole `const CHARACTERS = { ... };` block with:

```js
  const CHARACTERS = {
    thomas: {
      key: 'thomas', name: 'THOMAS', title: 'CEO', sprite: 'kaiko_sub', portrait: 'thomas', color: '#ffb300',
      hatch: { x: 0.53, y: 0.225, size: 0.2 }, // where the pilot pokes out: fraction of sprite w/h, head width as fraction of w
      width: 150, hitScale: 0.55, speed: 230, funding: 120, tokens: 100, fireRate: 0.22, tokenRegen: 11, bulletDmg: 1.2,
      blurb: ['The big Kaiko sub.', 'More funding, tougher hull,', 'a bit slower.'],
      special: { name: 'FUNDRAISE', cost: 40, cooldown: 12, desc: ['Pitch wave hits every enemy', 'on screen and converts', '40 tokens into 30 funding.'] },
    },
    robert: {
      key: 'robert', name: 'ROBERT', title: 'CTO', sprite: 'kaiko_mini', portrait: 'robert', color: '#4fd1ff',
      hatch: { x: 0.48, y: 0.36, size: 0.26 },
      width: 110, hitScale: 0.55, speed: 310, funding: 85, tokens: 120, fireRate: 0.16, tokenRegen: 14, bulletDmg: 1,
      blurb: ['The nimble scout sub.', 'Faster, cheaper shots,', 'thinner hull.'],
      special: { name: 'DEEP THOUGHT', cost: 35, cooldown: 15, duration: 4, desc: ['Slow the whole ocean to 30%', 'for 4 seconds.', 'Kaiko keeps full speed.'] },
    },
    veerle: {
      key: 'veerle', name: 'VEERLE', title: 'MD', sprite: 'kaiko_dome', portrait: 'veerle', color: '#c08cff',
      hatch: { x: 0.62, y: 0.3, size: 0.22 },
      width: 130, hitScale: 0.55, speed: 270, funding: 100, tokens: 110, fireRate: 0.19, tokenRegen: 12, bulletDmg: 1,
      blurb: ['The clinical sub.', 'Balanced hull and speed.', 'Keeps everyone on topic.'],
      special: { name: 'STAY ON TOPIC', cost: 30, cooldown: 12, duration: 8, desc: ['8 seconds of free,', 'homing, piercing shots.', 'Nobody wanders off.'] },
    },
  };
  const PILOTS = Object.keys(CHARACTERS); // select-screen order
```

- [ ] **Step 2: Default pilot and player fields**

Change `let selected = 'robert';` to `let selected = 'thomas';`.

In `newGame`, change the line

```js
      fireCd: 0, invuln: 0, shield: 0, opus: 0, vortex: 0, hotfix: 0, specialCd: 0, tilt: 0,
```

to

```js
      fireCd: 0, invuln: 0, shield: 0, opus: 0, vortex: 0, deep: 0, onTopic: 0, specialCd: 0, tilt: 0,
```

- [ ] **Step 3: Select input for three pilots**

In the `pointerdown` handler, replace

```js
      if (y > 150 && y < 440) { selected = x < W / 2 ? 'robert' : 'thomas'; Sound.play('select'); }
```

with

```js
      if (y > 150 && y < 440) { selected = PILOTS[clamp(Math.floor(x / (W / PILOTS.length)), 0, PILOTS.length - 1)]; Sound.play('select'); }
```

In `onKey`, replace the two title lines

```js
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'Digit1') { selected = 'robert'; Sound.play('select'); }
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'Digit2') { selected = 'thomas'; Sound.play('select'); }
```

with

```js
      const i = PILOTS.indexOf(selected), n = PILOTS.length;
      if (code === 'ArrowLeft' || code === 'KeyA') { selected = PILOTS[(i + n - 1) % n]; Sound.play('select'); }
      if (code === 'ArrowRight' || code === 'KeyD') { selected = PILOTS[(i + 1) % n]; Sound.play('select'); }
      if (/^Digit[1-9]$/.test(code) && PILOTS[+code.slice(5) - 1]) { selected = PILOTS[+code.slice(5) - 1]; Sound.play('select'); }
```

- [ ] **Step 4: Remove HOTFIX from shooting and specials**

In `shoot()`, change `p.fireCd = c.fireRate * (p.hotfix > 0 ? 0.5 : 1);` to `p.fireCd = c.fireRate;`.

Replace the body of `useSpecial()` after `Sound.play('special');` so the function reads:

```js
  function useSpecial() {
    const p = G.player, c = G.char, s = c.special;
    if (p.specialCd > 0 || p.tokens < s.cost) { Sound.play('denied'); addText(p.x, p.y - 50, p.specialCd > 0 ? 'COOLDOWN' : 'NOT ENOUGH TOKENS', '#ff6b6b'); return; }
    p.tokens -= s.cost; p.specialCd = s.cooldown;
    Sound.play('special');
    if (c.key === 'thomas') {
      G.wave = { x: p.x, t: 0 };
      p.funding = Math.min(p.maxFunding, p.funding + 30);
      addText(p.x, p.y - 60, 'FUNDRAISE! +30 funding', '#5cff5c');
      for (const e of G.enemies) { damageEnemy(e, e.d.boss ? 6 : 3, true); }
      for (const b of G.ebullets) b.dead = true;
    } else if (c.key === 'robert') {
      p.deep = s.duration;
      addText(p.x, p.y - 60, 'DEEP THOUGHT...', c.color);
    } else {
      p.onTopic = s.duration;
      addText(p.x, p.y - 60, 'STAY ON TOPIC!', c.color);
    }
  }
```

- [ ] **Step 5: Timers and HUD buffs**

In `update`, change

```js
    p.fireCd -= dt; p.invuln -= dt; p.shield -= dt; p.opus -= dt; p.vortex -= dt; p.hotfix -= dt; p.specialCd -= dt;
```

to

```js
    p.fireCd -= dt; p.invuln -= dt; p.shield -= dt; p.opus -= dt; p.vortex -= dt; p.deep -= dt; p.onTopic -= dt; p.specialCd -= dt;
```

In `drawHUD`, change the `buffs` line to:

```js
    const buffs = [['OPUS 6', p.opus, POWERUPS.opus6.color], ['VORTEX 3', p.vortex, POWERUPS.vortex3.color], ['INVINCIBLE', p.shield, POWERUPS.shield.color], ['DEEP THOUGHT', p.deep, CHARACTERS.robert.color], ['STAY ON TOPIC', p.onTopic, CHARACTERS.veerle.color]];
```

- [ ] **Step 6: Three cards on the title screen**

In `drawTitle`, replace the whole `for (const [i, key] of [['0', 'robert'], ['1', 'thomas']]) { ... }` loop with:

```js
    PILOTS.forEach((key, i) => {
      const c = CHARACTERS[key], cx = 160 + i * 320, sel = selected === key;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.35)'; ctx.fillRect(cx - 150, 150, 300, 295);
      if (sel) { ctx.strokeStyle = c.color; ctx.lineWidth = 4; ctx.strokeRect(cx - 150, 150, 300, 295); }
      // pilot portrait (pixel-art headshot) on the left, their sub on the right
      const px = cx - 80, py = 222, ps = 96;
      ctx.fillStyle = '#0a1a4a'; ctx.fillRect(px - ps / 2, py - ps / 2, ps, ps);
      drawSprite(c.portrait, px, py, ps, ps);
      ctx.strokeStyle = sel ? c.color : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.strokeRect(px - ps / 2, py - ps / 2, ps, ps);
      const sw = c.width * 0.7;
      drawSprite(c.sprite, cx + 70, 222 + Math.sin(elapsed * 2 + (sel ? 0 : 1)) * 5, sw, spriteH(c.sprite, sw));
      text(`${c.name} (${c.title})`, cx, 300, 13, c.color, 'center');
      c.blurb.forEach((l, j) => text(l, cx, 322 + j * 14, 8, '#dfe8ff', 'center'));
      text(`FUNDING ${c.funding}  TOKENS ${c.tokens}  SPEED ${c.speed}`, cx, 372, 7, '#9fc3ff', 'center');
      text(`SPECIAL: ${c.special.name}`, cx, 392, 9, '#ffe066', 'center');
      c.special.desc.forEach((l, j) => text(l, cx, 408 + j * 11, 7, '#dfe8ff', 'center'));
    });
```

- [ ] **Step 7: Verify**

Run: `node --check src/game.js` and `grep -n hotfix src/game.js`. Expected: syntax OK, and grep prints nothing.

Browser, `http://localhost:8000/?debug=1`:
1. Three cards in the order THOMAS (CEO), ROBERT (CTO), VEERLE (MD), each with a portrait and sub, and no text spilling over the card edges. Thomas is selected on load.
2. Right, Right, Right cycles Robert → Veerle → Thomas. Left from Thomas goes to Veerle. The 1, 2 and 3 keys select directly. Clicking each third of the card row selects that card.
3. Pick each pilot in turn and press Enter. The right sub flies, and the pilot's head pokes out of the hatch. For Veerle, check the head sits on the dome sub's hatch. If it doesn't, adjust `CHARACTERS.veerle.hatch` (x and y are fractions of the sprite's width and height) until it does, and note the final values.
4. In a run, Shift triggers FUNDRAISE for Thomas as before. For Robert and Veerle, Shift shows "DEEP THOUGHT..." or "STAY ON TOPIC!" and the HUD buff counts down 4 s or 8 s. There's no gameplay effect yet; that comes in Tasks 3 and 4.

- [ ] **Step 8: Commit**

```bash
git add src/game.js
git commit -m "Three pilots: Thomas CEO, Robert CTO, Veerle MD; remove HOTFIX"
```

---

### Task 3: DEEP THOUGHT slows the world, not Kaiko

**Files:**
- Modify: `src/game.js`: constants near `DESCENT_RATE` (around line 76), `update()` (lines 299-427), `render()` (lines 644-662)

**Interfaces:**
- Consumes: `p.deep` (Task 2).
- Produces: constant `DEEP_SCALE = 0.3`; inside `update`, a local `wdt` (world dt) used by every world system.

- [ ] **Step 1: Add the constant**

Below `const DESCENT_RATE = 22; // metres per second` add:

```js
  const DEEP_SCALE = 0.3; // DEEP THOUGHT: world speed while active; Kaiko keeps full speed
```

- [ ] **Step 2: Compute `wdt` and use it for depth, scroll and spawn timers**

In `update`, directly after `G.time += dt;` add:

```js
    const wdt = p.deep > 0 ? dt * DEEP_SCALE : dt; // world time; player systems keep dt
```

Then change these lines (old → new):

```js
    if (!G.boss) G.depth = Math.min(MAX_DEPTH, G.depth + DESCENT_RATE * wdt);
    G.scrollX += (G.boss ? 40 : 90) * wdt;
```

```js
      G.spawnT -= wdt;
```

```js
      G.hazardT -= wdt;
```

```js
    G.pickupT -= wdt;
```

- [ ] **Step 3: Use `wdt` for enemies, enemy bullets, hazards, pickups, particles and bubbles**

Replace the enemies loop from `for (const e of G.enemies) {` down to and including the `e.y = clamp(e.y, 30, H - 30);` line and the shoot block with:

```js
    for (const e of G.enemies) {
      e.t += wdt; e.flash -= wdt;
      const d = e.d;
      switch (d.move) {
        case 'sine': e.x -= d.speed * wdt; e.y = e.baseY + Math.sin(e.t * d.freq) * d.amp; break;
        case 'drift': e.x -= d.speed * wdt; e.y = e.baseY + Math.sin(e.t * d.freq) * d.amp; break;
        case 'zigzag': e.x -= d.speed * wdt; e.y += e.dir * 140 * wdt; if (e.y < 50 || e.y > H - 50) e.dir *= -1; break;
        case 'chase': e.x -= d.speed * wdt; e.y = lerp(e.y, p.y, 1 - Math.pow(0.35, wdt)); break;
        case 'hover': if (e.x > W - 160) e.x -= d.speed * 2 * wdt; else e.x -= d.speed * 0.25 * wdt; e.y = e.baseY + Math.sin(e.t * d.freq) * d.amp; break;
        case 'boss': {
          if (e.entering) { e.x -= 120 * wdt; if (e.x <= W - 170) e.entering = false; }
          else { e.y = H / 2 + Math.sin(e.t * 0.9) * 150; e.x = W - 170 + Math.sin(e.t * 0.4) * 30; }
          break;
        }
      }
      e.y = clamp(e.y, 30, H - 30);
      if (d.boss) {
        if (!e.entering) { e.shootT -= wdt; if (e.shootT <= 0) { e.shootT = e.hp < e.maxHp * 0.4 ? 1.1 : 1.6; bossAttack(e); } }
      } else if (d.shoot && e.x < W - 40 && e.x > 60) {
        e.shootT -= wdt; if (e.shootT <= 0) { e.shootT = d.shoot * rand(0.8, 1.2) * lerp(1.2, 0.8, difficulty); fireEnemy(e); }
      }
```

Leave the last two lines of that loop (`if (e.x < -e.w) ...` and the contact check) and the closing `}` unchanged.

In the enemy-bullet loop, change the first line to:

```js
      b.t += wdt; b.x += b.vx * wdt; b.y += b.vy * wdt;
```

In the hazards loop, change the first two lines to:

```js
      h.t += wdt; h.x += h.vx * wdt;
      if (h.kind === 'mine') { h.y += Math.sin(h.t * 2) * 20 * wdt; if (hitRect(h, p)) { h.dead = true; burst(h.x, h.y, '#ff5c5c', 24, 240); hurtPlayer(20, 'tech debt'); } }
```

In the pickups loop, change the first line to:

```js
      k.t += wdt; k.x += k.vx * wdt; k.y += Math.sin(k.t * 3) * 25 * wdt;
```

Change the particles and bubbles lines to:

```js
    for (const q of G.particles) { q.t += wdt; q.x += q.vx * wdt; q.y += q.vy * wdt; q.vx *= 0.96; q.vy *= 0.96; if (q.t > q.life) q.dead = true; }
```

```js
    for (const b of G.bubbles) { b.y -= b.s * wdt; b.x -= 20 * wdt; if (b.y < -10) { b.y = H + 10; b.x = rand(0, W); } if (b.x < -10) b.x = W + 10; }
```

Everything else in `update` keeps `dt`: player movement, player timers, token regen, the player-bullet loop, `G.wave`, texts, banner, shake and flash.

- [ ] **Step 4: Blue tint while active**

In `render()`, directly after the line `if (flash > 0) { ... }` and before `drawHUD();`, add:

```js
    if (G.player.deep > 0 && (state === 'play' || state === 'paused')) { ctx.fillStyle = 'rgba(70,130,255,0.14)'; ctx.fillRect(0, 0, W, H); }
```

- [ ] **Step 5: Verify**

Run: `node --check src/game.js`. Expected: OK.

Browser, `http://localhost:8000/?debug=1&pilot=robert&autostart=1`:
1. Wait for an enemy, then in the console run
   `(() => { const e = KAIKO.G.enemies[0], x = e.x, d = KAIKO.G.depth; setTimeout(() => console.log('enemy dx', (x - e.x).toFixed(1), 'depth', (KAIKO.G.depth - d).toFixed(1)), 1000); })()`.
   Note the numbers. Press Shift and immediately run it again. The second run's `enemy dx` and `depth` are about 30% of the first (depth is about 22 → about 6.6).
2. While it's active, Kaiko still moves at full speed, the blue tint is visible, and enemy bullets crawl. After 4 s everything is back to normal speed.
3. Review focus: activate Deep Thought and then die (or run `KAIKO.G.player.funding = 1` and touch an enemy). The game-over screen has no blue tint. Press Enter, then start a new Robert run: normal speed, no tint, and `KAIKO.G.player.deep` is `0`.
4. Pause (P) during Deep Thought. The tint stays, and on resume the timer continues.

- [ ] **Step 6: Commit**

```bash
git add src/game.js
git commit -m "DEEP THOUGHT: slow the world to 30% while Kaiko keeps full speed"
```

---

### Task 4: STAY ON TOPIC, with free, homing, piercing shots

**Files:**
- Modify: `src/game.js`: constants (next to `DEEP_SCALE`), `shoot()` (lines 184-199), a new `steer()` helper after `shoot()`, the player-bullet loop in `update()`, `drawBullets()` (lines 504-516)

**Interfaces:**
- Consumes: `p.onTopic` (Task 2).
- Produces: constants `TOPIC_FIRE = 0.66` and `HOMING_TURN = 12.6`; player bullets with `homing: boolean`, `pierceLeft: number` and kind `'topic'`; `steer(b, dt)`.

- [ ] **Step 1: Constants**

Below `DEEP_SCALE` add:

```js
  const TOPIC_FIRE = 0.66;  // STAY ON TOPIC: fire cooldown multiplier (about 1.5x the fire rate)
  const HOMING_TURN = 12.6; // rad/s a homing shot can turn (about 720 degrees per second)
```

- [ ] **Step 2: Free, faster, homing shots**

In `shoot()`, replace everything from `const cost = 3;` to the end of the `for (const a of angles) ...` line with:

```js
    const topic = p.onTopic > 0, cost = topic ? 0 : 3;
    if (p.tokens < cost) { if (Math.random() < 0.3) addText(p.x, p.y - 50, 'TOKEN LIMIT!', '#ff6b6b'); Sound.play('denied'); p.fireCd = 0.25; return; }
    p.tokens -= cost;
    p.fireCd = c.fireRate * (topic ? TOPIC_FIRE : 1);
    const angles = p.opus > 0 ? [-0.22, 0, 0.22] : [0];
    for (const a of angles) G.bullets.push({ x: p.x + p.w * 0.45, y: p.y + 4, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 5, dmg: c.bulletDmg, pierce: false, kind: topic ? 'topic' : p.opus > 0 ? 'opus' : 'token', t: 0, homing: topic, pierceLeft: topic ? 1 : 0 });
```

Directly after the closing `}` of `shoot()`, add:

```js
  // Turn a homing shot toward the nearest living enemy it has not hit yet, keeping its speed.
  function steer(b, dt) {
    let best = null, bd = Infinity;
    for (const e of G.enemies) { if (e.dead || (b.hitSet && b.hitSet.has(e))) continue; const d = dist2(b.x, b.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    if (!best) return;
    const sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx);
    let diff = Math.atan2(best.y - b.y, best.x - b.x) - cur;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to -PI..PI
    const a = cur + clamp(diff, -HOMING_TURN * dt, HOMING_TURN * dt);
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
  }
```

- [ ] **Step 3: Homing, pierce and left-edge cull in the bullet loop**

In `update`, replace the start of the player-bullet loop, from `for (const b of G.bullets) {` down to and including the inner enemy `for` loop's closing `}`, with:

```js
    for (const b of G.bullets) {
      b.t += dt;
      if (b.homing) steer(b, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x > W + 40 || b.x < -40 || b.y < -20 || b.y > H + 20) b.dead = true;
      if (b.dead) continue;
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (Math.abs(b.x - e.x) < e.hw + b.r && Math.abs(b.y - e.y) < e.hh + b.r) {
          if (b.kind === 'vortex' || b.homing) { if (!b.hitSet) b.hitSet = new Set(); if (b.hitSet.has(e)) continue; b.hitSet.add(e); }
          damageEnemy(e, b.dmg); burst(b.x, b.y, '#ffe066', 4, 120);
          if (b.pierce) continue;
          if (b.pierceLeft > 0) { b.pierceLeft--; continue; }
          b.dead = true; break;
        }
      }
```

Leave the following `if (b.dead) continue;`, the mines line and the loop's closing `}` unchanged.

- [ ] **Step 4: Draw topic shots along their heading**

In `drawBullets()`, replace the `else { ... }` branch of the player-bullet loop with:

```js
      } else if (b.kind === 'topic') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = CHARACTERS.veerle.color; ctx.fillRect(-8, -3, 16, 6);
        ctx.fillStyle = '#fff'; ctx.fillRect(-2, -2, 6, 4);
        ctx.restore();
      } else {
        ctx.fillStyle = b.kind === 'opus' ? '#ff7ad9' : '#ffe066';
        ctx.fillRect(b.x - 8, b.y - 3, 16, 6);
        ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 2, b.y - 2, 6, 4);
      }
```

- [ ] **Step 5: Verify**

Run: `node --check src/game.js`. Expected: OK.

Browser, `http://localhost:8000/?debug=1&pilot=veerle&autostart=1&autofire=1`:
1. Before Shift, shots fly straight and tokens drop.
2. Press Shift. Shots turn lavender and curve into enemies above and below Kaiko. A shot passes through its first enemy and hits a second, and never hits the same enemy twice. The token bar stops dropping from shots (it only goes up). Fire is visibly faster.
3. Review focus, free shots: during the special run `KAIKO.G.player.tokens = 0`. Shots keep firing with no "TOKEN LIMIT!" text.
4. Review focus, left-edge cull: during the special, move Kaiko to the right edge so enemies are behind her, and let shots curve back. Run `KAIKO.G.bullets.length` a few times over 5 s. It stays bounded (under about 40) and doesn't keep climbing.
5. After 8 s, new shots are yellow and straight, and shots already in flight keep homing.

- [ ] **Step 6: Commit**

```bash
git add src/game.js
git commit -m "STAY ON TOPIC: 8 s of free, homing, piercing shots"
```

---

### Task 5: The little submarine that couldn't

**Files:**
- Modify: `src/game.js`: `newGame` (reset end fields), `hurtPlayer` (line 248), `onKey` end-screen branch (lines 142-144), `drawEnd` (lines 635-642); add `endRun`, `makeDrips`, `drawRunStats`, `drawEndPrompt`, `drawCouldnt`, `drawVictory`

**Interfaces:**
- Produces: `endRun(win: boolean)`, the single place that enters `gameover` or `win`. It sets `G.endAt = elapsed` and `G.drips`. Also `drawRunStats(y)`, `drawEndPrompt(y, againLabel)`, and `drawVictory()` (a placeholder that Task 6 replaces). The `BLOOD` constant is `'#b0101a'`.

- [ ] **Step 1: End-of-run helpers**

Directly above `function hurtPlayer`, add:

```js
  const BLOOD = '#b0101a';
  function makeDrips() {
    const n = 7 + Math.floor(Math.random() * 4);
    return Array.from({ length: n }, () => ({ fx: rand(0.05, 0.95), w: rand(3, 6), max: rand(25, 90), speed: rand(25, 60) }));
  }
  function endRun(win) {
    state = win ? 'win' : 'gameover'; G.endAt = elapsed;
    Sound.stopMusic(); Sound.play(win ? 'win' : 'gameover');
    G.drips = win ? [] : makeDrips();
  }
```

In `newGame`, append to the line `G.boss = null; G.bossDefeated = {}; G.scrollX = 0; G.wave = null;` so it reads:

```js
    G.boss = null; G.bossDefeated = {}; G.scrollX = 0; G.wave = null; G.endAt = 0; G.drips = [];
```

- [ ] **Step 2: Route death through `endRun`**

In `hurtPlayer`, change

```js
    if (p.funding <= 0) { p.funding = 0; state = 'gameover'; Sound.stopMusic(); Sound.play('gameover'); burst(p.x, p.y, '#ffb300', 60, 300); }
```

to

```js
    if (p.funding <= 0) { p.funding = 0; endRun(false); burst(p.x, p.y, '#ffb300', 60, 300); }
```

- [ ] **Step 3: R retries, only on end screens**

In `onKey`, change the end-screen branch to:

```js
    } else if (state === 'gameover' || state === 'win') {
      if (code === 'Enter' || code === 'Space') state = 'title';
      if (code === 'KeyR') startGame();
    }
```

- [ ] **Step 4: The screen**

Replace the whole `function drawEnd(win) { ... }` with:

```js
  function drawRunStats(y) {
    text(`SCORE ${G.score}`, W / 2, y, 16, '#ffe066', 'center');
    text(`DEPTH REACHED ${Math.floor(G.depth)}m   ·   ENEMIES DEFEATED ${G.kills}   ·   TIME ${Math.floor(G.time)}s`, W / 2, y + 33, 8, '#cfe3ff', 'center');
  }
  function drawEndPrompt(y, again) {
    if (Math.floor(elapsed * 2) % 2 === 0) text(`ENTER: CHOOSE PILOT   R: ${again}`, W / 2, y, 11, '#fff', 'center');
  }
  // "THE LITTLE SUBMARINE THAT COULD" + a bigger, bleeding "N'T".
  function drawCouldnt() {
    const t = elapsed - G.endAt, y = H / 2 - 150, lead = 'THE LITTLE SUBMARINE THAT COULD';
    ctx.font = `18px ${FONT}`; const lw = ctx.measureText(lead).width;
    ctx.font = `34px ${FONT}`; const nw = ctx.measureText("N'T").width;
    const x0 = W / 2 - (lw + nw) / 2, nx = x0 + lw;
    text(lead, x0, y, 18, '#e8f0ff', 'left');
    ctx.font = `34px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a0008'; ctx.fillText("N'T", nx + 3, y + 3);
    ctx.fillStyle = BLOOD; ctx.fillText("N'T", nx, y);
    const top = y + 14; // just above the bottom of the glyphs
    for (const d of G.drips) {
      const len = Math.min(d.max, t * d.speed), dx = nx + d.fx * nw;
      ctx.fillRect(dx - d.w / 2, top, d.w, len);
      ctx.beginPath(); ctx.arc(dx, top + len, d.w * 0.75, 0, 6.283); ctx.fill();
    }
    text('You ran out of funding before solving healthcare.', W / 2, H / 2 - 15, 10, '#fff', 'center');
    drawRunStats(H / 2 + 25);
    drawEndPrompt(H / 2 + 110, 'RETRY');
  }
  function drawVictory() {
    text('CE MARK OBTAINED!', W / 2, H / 2 - 80, 26, '#5cff5c', 'center');
    text('SCARLET signed off. Kaiko surfaces certified.', W / 2, H / 2 - 40, 10, '#fff', 'center');
    drawRunStats(H / 2 + 5);
    drawEndPrompt(H / 2 + 90, 'PLAY AGAIN');
  }
  function drawEnd(win) {
    ctx.fillStyle = win ? 'rgba(0,40,20,0.75)' : 'rgba(40,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    if (win) drawVictory(); else drawCouldnt();
  }
```

- [ ] **Step 5: Verify**

Run: `node --check src/game.js`. Expected: OK.

Browser, `http://localhost:8000/?debug=1&pilot=thomas&autostart=1`, then in the console run `KAIKO.G.player.funding = 1` and fly into an enemy:
1. On one line, "THE LITTLE SUBMARINE THAT COULD" in white, then a bigger blood-red "N'T" with a dark shadow. The drips grow down from "N'T" over about 2 s, stop at different lengths, and don't reach the subtitle.
2. The subtitle, score, stats line and blinking "ENTER: CHOOSE PILOT   R: RETRY" don't overlap anything.
3. R starts a new run with Thomas. Die again, then press Enter: you're back on the title with Thomas still selected.
4. Review focus: press R on the title, during play, and while paused. Nothing restarts.

- [ ] **Step 6: Commit**

```bash
git add src/game.js
git commit -m "Game over: the little submarine that couldn't, with R to retry"
```

---

### Task 6: Victory, you've solved healthcare

**Files:**
- Modify: `src/game.js`: `newGame` (add `G.winAt`, `G.confetti`), `damageEnemy` SCARLET line (line 233), `update` (win check after `G.time += dt`), `endRun`, `drawVictory` (from Task 5); add `makeConfetti`, `drawConfetti`

**Interfaces:**
- Consumes: `endRun`, `drawRunStats`, `drawEndPrompt` (Task 5); `drawPilotHead(p, c)` (existing, `src/game.js:480`).
- Produces: `G.winAt` (game time at which the win fires, `0` = none) and `G.confetti`.

- [ ] **Step 1: Win timing on game time, not `setTimeout`**

In `damageEnemy`, change

```js
        if (e.type === 'scarlet') { setTimeout(() => { if (state === 'play') { state = 'win'; Sound.stopMusic(); Sound.play('win'); } }, 1500); }
```

to

```js
        if (e.type === 'scarlet') G.winAt = G.time + 1.5; // let the explosion play; paused time does not count
```

In `update`, directly after `G.time += dt;`, add:

```js
    if (G.winAt && G.time >= G.winAt) { endRun(true); return; }
```

(Keep the `wdt` line from Task 3 after it.)

In `newGame`, extend the end-fields line from Task 5 to:

```js
    G.boss = null; G.bossDefeated = {}; G.scrollX = 0; G.wave = null; G.endAt = 0; G.drips = []; G.winAt = 0; G.confetti = [];
```

- [ ] **Step 2: Confetti**

Directly above `function endRun`, add:

```js
  function makeConfetti() {
    const colors = [...PILOTS.map(k => CHARACTERS[k].color), '#5cff5c', '#ffffff'];
    return Array.from({ length: 120 }, () => ({ x: rand(0, W), y0: rand(-H, -10), vy: rand(60, 140), sway: rand(10, 40), f: rand(1, 3), spin: rand(2, 8), size: rand(5, 9), color: pick(colors) }));
  }
```

In `endRun`, add a confetti line so it reads:

```js
  function endRun(win) {
    state = win ? 'win' : 'gameover'; G.endAt = elapsed;
    Sound.stopMusic(); Sound.play(win ? 'win' : 'gameover');
    G.drips = win ? [] : makeDrips();
    G.confetti = win ? makeConfetti() : [];
  }
```

- [ ] **Step 3: The screen**

Replace the placeholder `function drawVictory() { ... }` from Task 5 with:

```js
  function drawConfetti() {
    const t = elapsed - G.endAt;
    for (const q of G.confetti) {
      let y = q.y0 + q.vy * t; if (y > H + 10) y = ((y + 10) % (H + 20)) - 10;
      const x = q.x + Math.sin(t * q.f + q.x) * q.sway;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * q.spin);
      ctx.fillStyle = q.color; ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
      ctx.restore();
    }
  }
  function drawVictory() {
    drawConfetti();
    const c = G.char, sw = c.width * 1.2, sh = spriteH(c.sprite, sw);
    const sub = { x: W / 2, y: H / 2 - 150 + Math.sin(elapsed * 2) * 6, w: sw, h: sh, tilt: 0 };
    drawPilotHead(sub, c);
    drawSprite(c.sprite, sub.x, sub.y, sw, sh);
    text('CONGRATULATIONS!', W / 2, H / 2 - 62, 26, '#5cff5c', 'center');
    text("You've solved healthcare.", W / 2, H / 2 - 28, 12, '#fff', 'center');
    text('Kaiko is now deployed in every hospital in the EU,', W / 2, H / 2 - 4, 9, '#dfe8ff', 'center');
    text('helping a million clinicians treat millions of patients.', W / 2, H / 2 + 12, 9, '#dfe8ff', 'center');
    text('SCARLET signed off. CE mark obtained.', W / 2, H / 2 + 34, 8, '#9fc3ff', 'center');
    drawRunStats(H / 2 + 65);
    drawEndPrompt(H / 2 + 130, 'PLAY AGAIN');
  }
```

- [ ] **Step 4: Verify**

Run: `node --check src/game.js`. Expected: OK.

Browser, `http://localhost:8000/?debug=1&pilot=veerle&autostart=1&depth=3990&autofire=1`. SCARLET arrives within a second. To speed up the check, run `KAIKO.G.boss.hp = 1` once it's on screen.
1. About 1.5 s after SCARLET explodes, the victory screen shows: confetti falls in from the top, Veerle's sub bobs in the centre with her head out of the hatch, and all six text lines, the score and stats, and "ENTER: CHOOSE PILOT   R: PLAY AGAIN" are readable without overlaps. The sub doesn't overlap "CONGRATULATIONS!". If it does, move the sub up by lowering its `H / 2 - 150`.
2. R starts a new Veerle run, and Enter goes to the title.
3. Review focus: reload with the same URL, set the boss hp to 1, kill it, and immediately press P. Wait 3 s, then press P again. The victory screen appears about 1.5 s after resuming.
4. Repeat check 1 with `pilot=thomas` and `pilot=robert` so the sub and head look right for each.

- [ ] **Step 5: Commit**

```bash
git add src/game.js
git commit -m "Victory: you've solved healthcare, Kaiko is in every EU hospital"
```

---

### Task 7: README

**Files:**
- Modify: `README.md` (Controls table and Pilots section)

- [ ] **Step 1: Controls**

In the Controls table, replace the row

```
| Choose pilot / start | Left/Right + Enter, or click |
```

with

```
| Choose pilot / start | Left/Right or 1/2/3, then Enter, or click |
| Retry after a run | R (same pilot), Enter to choose a pilot |
```

- [ ] **Step 2: Pilots**

Replace the whole `## Pilots` section (its heading and two bullets) with:

```markdown
## Pilots

- **Thomas (CEO)** pilots the big Kaiko sub. More funding, slower. Special **FUNDRAISE**: a pitch wave that damages everything on screen, clears enemy projectiles and converts 40 tokens into 30 funding.
- **Robert (CTO)** pilots the mini scout sub. Faster, cheaper shots, thinner hull. Special **DEEP THOUGHT**: for 4 seconds the whole ocean slows to 30% while Kaiko keeps full speed.
- **Veerle (MD)** pilots the dome sub. Balanced hull and speed. Special **STAY ON TOPIC**: for 8 seconds every shot is free, homes in on the nearest enemy and pierces through one.

Run out of funding and you are the little submarine that couldn't. Beat SCARLET at 4000 m and you have solved healthcare.
```

- [ ] **Step 3: Verify and commit**

Run: `grep -n -i hotfix README.md`. Expected: no output.

```bash
git add README.md
git commit -m "README: three pilots and their specials"
```
