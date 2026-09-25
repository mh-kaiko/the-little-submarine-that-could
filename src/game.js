// Kaiko: The Little Submarine That Could — side-scrolling shooter.
// HP = funding, mana = token limit. Game over = you ran out of funding.
(() => {
  'use strict';
  const W = 960, H = 540;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const FONT = "'Press Start 2P', 'Courier New', monospace";

  // ------------------------------------------------------------ assets
  const IMG = {};
  const SPRITES = ['kaiko_sub', 'kaiko_mini', 'robert', 'thomas', 'datadesk', 'legal', 'hospital', 'research', 'it', 'regulatory', 'gdpr', 'mdr', 'scarlet'];
  function loadAssets(done) {
    let left = SPRITES.length + 1;
    const one = () => { if (--left === 0) done(); };
    SPRITES.forEach(n => { const i = new Image(); i.onload = one; i.onerror = one; i.src = `assets/sprites/${n}.png`; IMG[n] = i; });
    const o = new Image(); o.onload = one; o.onerror = one; o.src = 'assets/raw/ocean.png'; IMG.ocean = o;
  }
  const spriteH = (name, w) => { const i = IMG[name]; return i && i.naturalWidth ? w * i.naturalHeight / i.naturalWidth : w * 0.8; };

  // ------------------------------------------------------------ helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
  function hitRect(a, b) { // entities with x,y (centre), hw,hh (half-size hitbox)
    return Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;
  }
  function weightedPick(list) { // [{w, v}]
    let total = list.reduce((s, e) => s + e.w, 0), r = Math.random() * total;
    for (const e of list) { if ((r -= e.w) <= 0) return e.v; }
    return list[list.length - 1].v;
  }

  // ------------------------------------------------------------ definitions
  const CHARACTERS = {
    robert: {
      key: 'robert', name: 'ROBERT', title: 'CEO', sprite: 'kaiko_sub', portrait: 'robert', color: '#ffb300',
      hatch: { x: 0.53, y: 0.225, size: 0.2 }, // where the pilot pokes out: fraction of sprite w/h, head width as fraction of w
      width: 150, hitScale: 0.55, speed: 230, funding: 120, tokens: 100, fireRate: 0.22, tokenRegen: 11, bulletDmg: 1.2,
      blurb: ['The big Kaiko sub.', 'More funding, tougher hull,', 'a bit slower.'],
      special: { name: 'FUNDRAISE', cost: 40, cooldown: 12, desc: ['Pitch wave hits every enemy', 'on screen and converts', '40 tokens into 30 funding.'] },
    },
    thomas: {
      key: 'thomas', name: 'THOMAS', title: 'CTO', sprite: 'kaiko_mini', portrait: 'thomas', color: '#4fd1ff',
      hatch: { x: 0.48, y: 0.36, size: 0.26 },
      width: 110, hitScale: 0.55, speed: 310, funding: 85, tokens: 120, fireRate: 0.16, tokenRegen: 14, bulletDmg: 1,
      blurb: ['The nimble scout sub.', 'Faster, cheaper shots,', 'thinner hull.'],
      special: { name: 'HOTFIX', cost: 35, cooldown: 12, desc: ['Invincible for 5 seconds', 'and double fire rate.', 'Ship it.'] },
    },
  };

  const ENEMIES = {
    datadesk:   { sprite: 'datadesk',   w: 72,  hp: 2,  speed: 110, move: 'sine',   amp: 45, freq: 2.0, shoot: 2.6, bullet: 'doc',    score: 100, name: 'Datadesk' },
    it:         { sprite: 'it',         w: 72,  hp: 2,  speed: 150, move: 'zigzag', amp: 0,  freq: 0,   shoot: 0,   bullet: null,     score: 120, name: 'IT' },
    legal:      { sprite: 'legal',      w: 78,  hp: 3,  speed: 95,  move: 'sine',   amp: 60, freq: 1.4, shoot: 2.2, bullet: 'para',   score: 150, name: 'Legal' },
    research:   { sprite: 'research',   w: 74,  hp: 3,  speed: 120, move: 'chase',  amp: 0,  freq: 0,   shoot: 2.0, bullet: 'flask',  score: 180, name: 'Research' },
    hospital:   { sprite: 'hospital',   w: 96,  hp: 5,  speed: 60,  move: 'hover',  amp: 30, freq: 0.8, shoot: 2.4, bullet: 'doc3',   score: 250, name: 'Dept. Hospital' },
    regulatory: { sprite: 'regulatory', w: 100, hp: 6,  speed: 75,  move: 'sine',   amp: 70, freq: 1.0, shoot: 1.9, bullet: 'para2',  score: 300, name: 'Regulatory' },
    gdpr:       { sprite: 'gdpr',       w: 92,  hp: 6,  speed: 85,  move: 'drift',  amp: 15, freq: 3.0, shoot: 1.6, bullet: 'binary', score: 300, name: 'GDPR' },
    mdr:        { sprite: 'mdr',        w: 230, hp: 80, speed: 0,   move: 'boss',   amp: 0,  freq: 0,   shoot: 0,   bullet: null,     score: 3000, name: 'MDR', boss: true },
    scarlet:    { sprite: 'scarlet',    w: 250, hp: 120, speed: 0,  move: 'boss',   amp: 0,  freq: 0,   shoot: 0,   bullet: null,     score: 6000, name: 'SCARLET', boss: true },
  };

  // Depth zones: enemies are introduced gradually so every element can be seen.
  const ZONES = [
    { depth: 0,    name: 'SUNLIT ZONE',    sub: 'Onboarding',        enemies: [['datadesk', 3], ['it', 2]] },
    { depth: 700,  name: 'TWILIGHT ZONE',  sub: 'Hospital rounds',   enemies: [['datadesk', 2], ['it', 2], ['legal', 3], ['research', 2], ['hospital', 1]] },
    { depth: 1600, name: 'MIDNIGHT ZONE',  sub: 'Compliance trench', enemies: [['legal', 2], ['research', 2], ['hospital', 2], ['regulatory', 3], ['gdpr', 3]] },
    { depth: 2600, name: 'BOSS',           sub: 'MDR audit',         boss: 'mdr' },
    { depth: 2601, name: 'ABYSSAL ZONE',   sub: 'Certification run', enemies: [['it', 2], ['legal', 2], ['hospital', 2], ['regulatory', 3], ['gdpr', 3], ['research', 2]] },
    { depth: 4000, name: 'FINAL BOSS',     sub: 'SCARLET review',    boss: 'scarlet' },
  ];
  const MAX_DEPTH = 4000;
  const DESCENT_RATE = 22; // metres per second

  const POWERUPS = {
    opus6:   { label: 'OPUS 6',       color: '#ff7ad9', text: 'OPUS 6! Triple projectiles',    w: 4 },
    vortex3: { label: 'VORTEX 3',     color: '#7dffb3', text: 'VORTEX 3! OP weapon online',    w: 2 },
    shield:  { label: 'INVINCIBLE',   color: '#ffe066', text: 'INVINCIBLE!',                    w: 3 },
    funding: { label: 'SERIES C',     color: '#5cff5c', text: '+30 funding',                    w: 4 },
    tokens:  { label: 'TOKEN TOP-UP', color: '#6ec6ff', text: '+50 tokens',                     w: 4 },
    deal:    { label: 'INVESTOR DEAL', color: '#ffb347', text: '+45 funding, -40 tokens',       w: 2 },
    credits: { label: 'AZURE CREDITS', color: '#8fb3ff', text: '+70 tokens, -15 funding',       w: 2 },
    mdrcert: { label: 'MDR CERT',     color: '#ffd700', text: 'MDR CERTIFIED! +25% damage',     w: 0 }, // only dropped by the MDR boss
  };

  // MDR boss: an audit in stages, keyed to hp. Each threshold ticks a checklist item.
  const MDR_CHECKS = ['CLINICAL EVIDENCE', 'RISK FILE', 'POST-MARKET'];
  const MDR_THRESHOLDS = [0.7, 0.4, 0.15];

  // ------------------------------------------------------------ state
  let TURBO = 1, GOD = false; // debug: ?turbo=n fast-forwards, ?god=1 makes the pilot unhurtable
  let state = 'title';
  let selected = 'robert';
  let keys = {};
  let lastTime = 0, elapsed = 0;
  let shake = 0, flash = 0;
  const G = {}; // game session

  function newGame(charKey) {
    const c = CHARACTERS[charKey];
    G.char = c;
    G.player = {
      x: 160, y: H / 2, vx: 0, vy: 0, w: c.width, h: spriteH(c.sprite, c.width),
      hw: c.width * c.hitScale / 2, hh: spriteH(c.sprite, c.width) * c.hitScale / 2,
      funding: c.funding, maxFunding: c.funding, tokens: c.tokens, maxTokens: c.tokens,
      fireCd: 0, invuln: 0, shield: 0, opus: 0, vortex: 0, hotfix: 0, specialCd: 0, tilt: 0,
    };
    G.bullets = []; G.ebullets = []; G.enemies = []; G.hazards = []; G.pickups = []; G.beams = [];
    G.particles = []; G.texts = []; G.bubbles = [];
    G.depth = 0; G.score = 0; G.time = 0; G.kills = 0;
    G.spawnT = 1.5; G.hazardT = 6; G.pickupT = 8; G.zoneIdx = -1; G.banner = null;
    G.boss = null; G.bossDefeated = {}; G.scrollX = 0; G.wave = null;
    for (let i = 0; i < 40; i++) G.bubbles.push({ x: rand(0, W), y: rand(0, H), r: rand(1, 4), s: rand(15, 45) });
  }

  // ------------------------------------------------------------ input
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    Sound.init(); Sound.resume();
    if (keys[e.code]) return; keys[e.code] = true;
    onKey(e.code);
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('pointerdown', e => {
    Sound.init(); Sound.resume();
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    if (state === 'title') {
      if (y > 150 && y < 440) { selected = x < W / 2 ? 'robert' : 'thomas'; Sound.play('select'); }
      if (y >= 450) startGame();
    } else if (state === 'gameover' || state === 'win') { state = 'title'; }
  });
  function onKey(code) {
    if (code === 'KeyM') { Sound.toggleMute(); return; }
    if (state === 'title') {
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'Digit1') { selected = 'robert'; Sound.play('select'); }
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'Digit2') { selected = 'thomas'; Sound.play('select'); }
      if (code === 'Enter' || code === 'Space') startGame();
    } else if (state === 'play') {
      if (code === 'KeyP' || code === 'Escape') state = 'paused';
      if (code === 'ShiftLeft' || code === 'ShiftRight') useSpecial();
    } else if (state === 'paused') {
      if (code === 'KeyP' || code === 'Escape' || code === 'Enter') state = 'play';
    } else if (state === 'gameover' || state === 'win') {
      if (code === 'Enter' || code === 'Space') state = 'title';
    }
  }
  function startGame() { newGame(selected); state = 'play'; Sound.startMusic(); Sound.play('select'); }

  // ------------------------------------------------------------ spawning
  function currentZone() {
    let z = ZONES[0];
    for (const zone of ZONES) if (G.depth >= zone.depth) z = zone;
    return z;
  }
  function spawnEnemy(typeKey, opts = {}) {
    const d = ENEMIES[typeKey];
    const h = spriteH(d.sprite, d.w);
    const e = {
      type: typeKey, d, x: opts.x ?? W + d.w, y: opts.y ?? rand(70, H - 70), w: d.w, h,
      hw: d.w * 0.36, hh: h * 0.36, hp: d.hp, maxHp: d.hp, t: rand(0, 6.28), baseY: 0,
      shootT: rand(0.5, d.shoot || 1), dir: Math.random() < 0.5 ? 1 : -1, flash: 0, phase: 0,
    };
    e.baseY = e.y;
    G.enemies.push(e);
    return e;
  }
  function spawnHazard() {
    const kind = Math.random() < 0.65 ? 'mine' : 'azure';
    if (kind === 'mine') G.hazards.push({ kind, x: W + 40, y: rand(60, H - 60), r: 22, hw: 18, hh: 18, t: rand(0, 6), vx: -rand(60, 110) });
    else G.hazards.push({ kind, x: W + 90, y: rand(80, H - 80), r: 60, hw: 70, hh: 40, t: 0, vx: -rand(35, 55) });
  }
  function spawnPickup(x, y, kind) {
    kind = kind || weightedPick(Object.entries(POWERUPS).filter(([, v]) => v.w > 0).map(([k, v]) => ({ w: v.w, v: k })));
    G.pickups.push({ kind, x, y, hw: 16, hh: 16, t: 0, vx: -50, vy: 0 });
  }
  function spawnBoss(key) {
    const b = spawnEnemy(key, { x: W + 200, y: H / 2 });
    b.hw = b.w * 0.34; b.hh = b.h * 0.34; b.phase = 0; b.shootT = 1.5; b.entering = true;
    if (key === 'mdr') { b.stage = 0; b.checks = [false, false, false]; b.gapRow = 3; b.wallT = 0; b.spiral = 0; b.minionT = 8; b.cycle = 0; }
    G.boss = b;
    G.banner = { title: key === 'mdr' ? 'WARNING: MDR AUDIT' : 'FINAL REVIEW: SCARLET', sub: key === 'mdr' ? 'Prove your device is safe.' : 'Get that CE mark.', t: 3.2, boss: true };
    Sound.play('special');
  }

  // ------------------------------------------------------------ actions
  function shoot() {
    const p = G.player, c = G.char;
    if (p.fireCd > 0) return;
    const mult = p.certified ? 1.25 : 1;
    if (p.vortex > 0) {
      p.fireCd = 0.28;
      G.bullets.push({ x: p.x + p.w * 0.45, y: p.y + 4, vx: 520, vy: 0, r: 22, dmg: 6 * mult, pierce: true, kind: 'vortex', t: 0 });
      Sound.play('vortex'); return;
    }
    const cost = 3;
    if (p.tokens < cost) { if (Math.random() < 0.3) addText(p.x, p.y - 50, 'TOKEN LIMIT!', '#ff6b6b'); Sound.play('denied'); p.fireCd = 0.25; return; }
    p.tokens -= cost;
    p.fireCd = c.fireRate * (p.hotfix > 0 ? 0.5 : 1);
    const angles = p.opus > 0 ? [-0.22, 0, 0.22] : [0];
    for (const a of angles) G.bullets.push({ x: p.x + p.w * 0.45, y: p.y + 4, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 5, dmg: c.bulletDmg * mult, pierce: false, kind: p.opus > 0 ? 'opus' : 'token', t: 0 });
    Sound.play('shoot');
  }
  function useSpecial() {
    const p = G.player, s = G.char.special;
    if (p.specialCd > 0 || p.tokens < s.cost) { Sound.play('denied'); addText(p.x, p.y - 50, p.specialCd > 0 ? 'COOLDOWN' : 'NOT ENOUGH TOKENS', '#ff6b6b'); return; }
    p.tokens -= s.cost; p.specialCd = s.cooldown;
    Sound.play('special');
    if (G.char.key === 'robert') {
      G.wave = { x: p.x, t: 0 };
      p.funding = Math.min(p.maxFunding, p.funding + 30);
      addText(p.x, p.y - 60, 'FUNDRAISE! +30 funding', '#5cff5c');
      for (const e of G.enemies) { damageEnemy(e, e.d.boss ? 6 : 3, true); }
      for (const b of G.ebullets) b.dead = true;
    } else {
      p.hotfix = 5; p.shield = Math.max(p.shield, 5);
      addText(p.x, p.y - 60, 'HOTFIX DEPLOYED', '#4fd1ff');
    }
  }
  function addText(x, y, text, color, big) { G.texts.push({ x, y, text, color, t: 0, life: 1.4, big }); }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(speed * 0.3, speed); G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), t: 0, color, size: rand(3, 7) }); }
  }
  function damageEnemy(e, dmg, silent) {
    if (e.type === 'mdr') dmg *= mdrGuard(e); // MDR only takes full damage while distracted by its own paperwork
    e.hp -= dmg; e.flash = 0.08;
    if (!silent) Sound.play('hit');
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; G.kills++;
      G.score += e.d.score;
      addText(e.x, e.y - e.h / 2, '+' + e.d.score, '#ffe066');
      burst(e.x, e.y, '#ffb347', e.d.boss ? 90 : 18, e.d.boss ? 400 : 220);
      burst(e.x, e.y, '#ff5c5c', e.d.boss ? 60 : 10, e.d.boss ? 300 : 160);
      if (e.d.boss) {
        Sound.play('bigExplode'); shake = 0.8; flash = 0.5;
        G.bossDefeated[e.type] = true; G.boss = null; G.beams = [];
        if (e.type === 'mdr') {
          for (const o of G.enemies) if (!o.d.boss && !o.dead) { o.dead = true; burst(o.x, o.y, '#ffb347', 12, 200); }
          spawnPickup(e.x - 60, e.y, 'mdrcert'); spawnPickup(e.x + 10, e.y - 50, 'funding'); spawnPickup(e.x + 10, e.y + 50, 'tokens');
        } else {
          for (let i = 0; i < 3; i++) spawnPickup(e.x - 60 + i * 60, e.y, ['funding', 'tokens', 'opus6'][i]);
        }
        if (e.type === 'scarlet') { setTimeout(() => { if (state === 'play') { state = 'win'; Sound.stopMusic(); Sound.play('win'); } }, 1500); }
        else G.banner = { title: 'AUDIT PASSED', sub: 'Descending further...', t: 2.5 };
      } else {
        Sound.play('explode'); shake = Math.max(shake, 0.12);
        if (Math.random() < 0.22) spawnPickup(e.x, e.y);
      }
    }
  }
  function hurtPlayer(amount, reason) {
    const p = G.player;
    if (p.invuln > 0 || p.shield > 0 || GOD) return;
    p.funding -= amount; p.invuln = 1.0; shake = Math.max(shake, 0.25); flash = 0.25;
    Sound.play('hurt');
    addText(p.x, p.y - 55, `-${amount} funding` + (reason ? ` (${reason})` : ''), '#ff6b6b');
    burst(p.x, p.y, '#ffb347', 12, 180);
    if (p.funding <= 0) { p.funding = 0; state = 'gameover'; Sound.stopMusic(); Sound.play('gameover'); burst(p.x, p.y, '#ffb300', 60, 300); }
  }
  function applyPickup(k) {
    const p = G.player, def = POWERUPS[k];
    switch (k) {
      case 'opus6': p.opus = 12; break;
      case 'vortex3': p.vortex = 8; break;
      case 'shield': p.shield = 6; break;
      case 'funding': p.funding = Math.min(p.maxFunding, p.funding + 30); break;
      case 'tokens': p.tokens = Math.min(p.maxTokens, p.tokens + 50); break;
      case 'deal': p.funding = Math.min(p.maxFunding, p.funding + 45); p.tokens = Math.max(0, p.tokens - 40); break;
      case 'credits': p.tokens = Math.min(p.maxTokens, p.tokens + 70); p.funding = Math.max(1, p.funding - 15); break;
      case 'mdrcert': p.certified = true; break;
    }
    G.score += 50;
    addText(p.x, p.y - 60, def.text, def.color, true);
    Sound.play(k === 'opus6' || k === 'vortex3' || k === 'shield' || k === 'mdrcert' ? 'powerup' : 'pickup');
    burst(p.x, p.y, def.color, 16, 160);
  }

  // ------------------------------------------------------------ enemy bullets
  function fireEnemy(e) {
    const p = G.player, kind = e.d.bullet;
    const aim = Math.atan2(p.y - e.y, p.x - e.x);
    const push = (a, sp, k, r) => G.ebullets.push({ x: e.x - e.w * 0.3, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: k || kind, r: r || 7, hw: r || 7, hh: r || 7, t: 0, dmg: 10 });
    switch (kind) {
      case 'doc': push(Math.PI, 240); break;
      case 'para': push(aim, 260); break;
      case 'flask': push(aim, 220); break;
      case 'doc3': [-0.3, 0, 0.3].forEach(a => push(Math.PI + a, 220)); break;
      case 'para2': [-0.15, 0.15].forEach(a => push(aim + a, 270)); break;
      case 'binary': for (let i = 0; i < 3; i++) setTimeout(() => { if (!e.dead && state === 'play') push(Math.PI + rand(-0.1, 0.1), 300, 'binary', 6); }, i * 120); break;
    }
  }
  function bossAttack(b) {
    const p = G.player;
    const push = (x, y, a, sp, k, r, dmg) => G.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: k, r, hw: r, hh: r, t: 0, dmg: dmg || 12 });
    const aim = Math.atan2(p.y - b.y, p.x - b.x);
    const enraged = b.hp < b.maxHp * 0.4;
    b.phase = (b.phase + 1) % 3;
    if (b.type === 'mdr') return mdrAttack(b, push);
    { // scarlet
      if (b.phase === 0) { for (let i = -4; i <= 4; i++) push(b.x - 90, b.y, Math.PI + i * 0.16, 260, 'stamp', 9, 14); }
      else if (b.phase === 1) { for (let i = 0; i < (enraged ? 7 : 4); i++) setTimeout(() => { if (G.boss === b && state === 'play') push(b.x - 90, b.y + rand(-80, 80), Math.atan2(p.y - b.y, p.x - b.x) + rand(-0.1, 0.1), 340, 'para', 7); }, i * 120); }
      else { for (let i = 0; i < 8; i++) { const a = Math.PI + (i - 3.5) * 0.28; push(b.x - 60, b.y, a, 180, 'alarm', 9); } if (enraged && Math.random() < 0.5) spawnEnemy('legal', { x: W + 40, y: rand(80, H - 80) }); }
    }
  }
  // MDR stages from hp: 0 documentation request, 1 conformity test, 2 non-conformity (enraged), 3 final warning.
  function mdrThink(b, dt) {
    const frac = b.hp / b.maxHp;
    let stage = 0; while (stage < 3 && frac < MDR_THRESHOLDS[stage]) stage++;
    if (stage !== b.stage) {
      for (let i = b.stage; i < stage; i++) b.checks[i] = true;
      addText(b.x - 140, b.y - b.h / 2 - 16, `${MDR_CHECKS[stage - 1]}: REVIEWED`, '#ffe066', true);
      Sound.play('special'); shake = Math.max(shake, 0.3);
      if (stage >= 2 && b.stage < 2) {
        G.banner = { title: 'NON-CONFORMITY FOUND', sub: 'MDR calls in Regulatory. Siren on.', t: 2.5, boss: true };
        for (let i = 0; i < 2; i++) spawnEnemy('regulatory', { x: W + 60 + i * 90, y: 110 + i * (H - 220) });
        b.minionT = 8;
      }
      b.stage = stage; b.shootT = Math.min(b.shootT, 0.6);
    }
    b.wallT -= dt;
    if (b.stage >= 2) {
      b.minionT -= dt;
      if (b.minionT <= 0 && G.enemies.filter(e => !e.d.boss && !e.dead).length < 2) { spawnEnemy('regulatory', { x: W + 60, y: rand(80, H - 80) }); b.minionT = 8; }
    }
  }
  // Damage multiplier: full while a document wall is out, half while scanning, 70% otherwise.
  function mdrGuard(b) { return b.wallT > 0 ? 1 : G.beams.length ? 0.5 : 0.7; }
  function mdrAttack(b, push) {
    const p = G.player;
    const wall = (gapRows) => { // a wall of documents with a gap that shifts each volley
      const rows = 9, y0 = 40, dy = (H - 80) / (rows - 1);
      b.gapRow = clamp(b.gapRow + pick([-2, -1, 1, 2]), 0, rows - gapRows);
      for (let i = 0; i < rows; i++) if (i < b.gapRow || i >= b.gapRow + gapRows) push(b.x - 70, y0 + i * dy, Math.PI, 260, 'doc', 8);
      b.wallT = 3.2;
    };
    const aimed = (n) => { for (let i = 0; i < n; i++) setTimeout(() => { if (G.boss === b && state === 'play') push(b.x - 80, b.y + rand(-40, 40), Math.atan2(p.y - b.y, p.x - b.x), 320, 'para', 7); }, i * 160); };
    const fan = (n, spread) => { for (let i = -n; i <= n; i++) push(b.x - 80, b.y, Math.PI + i * spread, 230, 'alarm', 8); };
    const scan = () => G.beams.push({ x: b.x - 110, w: 26, warm: 0.7, speed: b.stage >= 2 ? 420 : 330, t: 0 });
    const spiral = () => { b.spiral += 0.45; for (let i = 0; i < 8; i++) push(b.x - 40, b.y, b.spiral + i * Math.PI / 4, 200, 'alarm', 8); };
    const step = b.cycle++;
    if (b.stage === 0) { if (step % 2 === 0) { wall(2); return 2.6; } aimed(2); return 1.3; }
    if (b.stage === 1) { const s = step % 3; if (s === 0) { scan(); return 2.2; } if (s === 1) { fan(3, 0.18); return 1.4; } aimed(3); return 1.4; }
    const fast = b.stage === 3 ? 0.7 : 0.9, s = step % 4;
    if (s === 0 || s === 2) { spiral(); return fast; }
    if (s === 1) { scan(); return 1.6; }
    wall(1); return 2.2;
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    elapsed += dt;
    if (state !== 'play') return;
    const p = G.player, c = G.char;
    G.time += dt;

    // depth & zones
    if (!G.boss) G.depth = Math.min(MAX_DEPTH, G.depth + DESCENT_RATE * dt);
    G.scrollX += (G.boss ? 40 : 90) * dt;
    const zone = currentZone();
    const zi = ZONES.indexOf(zone);
    if (zi !== G.zoneIdx) {
      G.zoneIdx = zi;
      if (zone.boss) { if (!G.bossDefeated[zone.boss]) spawnBoss(zone.boss); }
      else G.banner = { title: `${zone.name} — ${Math.round(zone.depth)}m`, sub: zone.sub, t: 3 };
    }
    if (zone.boss && !G.boss && !G.bossDefeated[zone.boss]) spawnBoss(zone.boss);
    const difficulty = clamp(G.depth / MAX_DEPTH, 0, 1);
    Sound.setTempoDepth(difficulty);
    Sound.setTrack(G.boss ? 'boss' : 'level');

    // player movement
    let ax = 0, ay = 0;
    if (keys.ArrowLeft || keys.KeyA) ax -= 1;
    if (keys.ArrowRight || keys.KeyD) ax += 1;
    if (keys.ArrowUp || keys.KeyW) ay -= 1;
    if (keys.ArrowDown || keys.KeyS) ay += 1;
    const slowed = G.hazards.some(h => h.kind === 'azure' && hitRect(p, h)) ? 0.55 : 1;
    p.vx = lerp(p.vx, ax * c.speed * slowed, 1 - Math.pow(0.001, dt));
    p.vy = lerp(p.vy, ay * c.speed * slowed, 1 - Math.pow(0.001, dt));
    p.x = clamp(p.x + p.vx * dt, p.w / 2 - 10, W - p.w / 2);
    p.y = clamp(p.y + p.vy * dt, p.h / 2, H - p.h / 2);
    p.tilt = lerp(p.tilt, p.vy / c.speed * 0.18, 1 - Math.pow(0.01, dt));
    p.fireCd -= dt; p.invuln -= dt; p.shield -= dt; p.opus -= dt; p.vortex -= dt; p.hotfix -= dt; p.specialCd -= dt;
    p.tokens = Math.min(p.maxTokens, p.tokens + c.tokenRegen * dt);
    if (keys.Space) shoot();
    // azure drains tokens
    for (const h of G.hazards) if (h.kind === 'azure' && hitRect(p, h)) { p.tokens = Math.max(0, p.tokens - 25 * dt); if (Math.random() < dt * 2) addText(p.x, p.y - 50, 'AZURE OUTAGE: tokens draining', '#8fb3ff'); }

    // spawn enemies
    if (!zone.boss) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) {
        const interval = lerp(2.4, 0.9, difficulty);
        G.spawnT = interval * rand(0.7, 1.3);
        spawnEnemy(weightedPick(zone.enemies.map(([k, w]) => ({ w, v: k }))));
        if (difficulty > 0.35 && Math.random() < 0.3) spawnEnemy(weightedPick(zone.enemies.map(([k, w]) => ({ w, v: k }))));
      }
      G.hazardT -= dt;
      if (G.hazardT <= 0) { G.hazardT = lerp(7, 3.5, difficulty) * rand(0.7, 1.3); spawnHazard(); }
    }
    G.pickupT -= dt;
    if (G.pickupT <= 0) { G.pickupT = rand(8, 13); spawnPickup(W + 20, rand(60, H - 60)); }

    // enemies
    for (const e of G.enemies) {
      e.t += dt; e.flash -= dt;
      const d = e.d;
      switch (d.move) {
        case 'sine': e.x -= d.speed * dt; e.y = e.baseY + Math.sin(e.t * d.freq) * d.amp; break;
        case 'drift': e.x -= d.speed * dt; e.y = e.baseY + Math.sin(e.t * d.freq) * d.amp; break;
        case 'zigzag': e.x -= d.speed * dt; e.y += e.dir * 140 * dt; if (e.y < 50 || e.y > H - 50) e.dir *= -1; break;
        case 'chase': e.x -= d.speed * dt; e.y = lerp(e.y, p.y, 1 - Math.pow(0.35, dt)); break;
        case 'hover': if (e.x > W - 160) e.x -= d.speed * 2 * dt; else e.x -= d.speed * 0.25 * dt; e.y = e.baseY + Math.sin(e.t * d.freq) * d.amp; break;
        case 'boss': {
          if (e.entering) { e.x -= 120 * dt; if (e.x <= W - 170) e.entering = false; }
          else { e.y = H / 2 + Math.sin(e.t * 0.9) * 150; e.x = W - 170 + Math.sin(e.t * 0.4) * 30; }
          break;
        }
      }
      e.y = clamp(e.y, 30, H - 30);
      if (d.boss) {
        if (e.type === 'mdr' && !e.entering) mdrThink(e, dt);
        if (!e.entering) { e.shootT -= dt; if (e.shootT <= 0) { const next = bossAttack(e); e.shootT = next || (e.hp < e.maxHp * 0.4 ? 1.1 : 1.6); } }
      } else if (d.shoot && e.x < W - 40 && e.x > 60) {
        e.shootT -= dt; if (e.shootT <= 0) { e.shootT = d.shoot * rand(0.8, 1.2) * lerp(1.2, 0.8, difficulty); fireEnemy(e); }
      }
      if (e.x < -e.w) e.dead = true;
      if (!e.dead && hitRect(e, p)) { hurtPlayer(d.boss ? 20 : 15, d.name); if (!d.boss) damageEnemy(e, 2); }
    }
    // bullets
    for (const b of G.bullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x > W + 40 || b.y < -20 || b.y > H + 20) b.dead = true;
      if (b.dead) continue;
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (Math.abs(b.x - e.x) < e.hw + b.r && Math.abs(b.y - e.y) < e.hh + b.r) {
          if (b.kind === 'vortex') { if (!b.hitSet) b.hitSet = new Set(); if (b.hitSet.has(e)) continue; b.hitSet.add(e); }
          damageEnemy(e, b.dmg); burst(b.x, b.y, '#ffe066', 4, 120);
          if (!b.pierce) { b.dead = true; break; }
        }
      }
      if (b.dead) continue;
      for (const h of G.hazards) if (h.kind === 'mine' && !h.dead && dist2(b.x, b.y, h.x, h.y) < (h.r + b.r) ** 2) { h.dead = true; b.dead = !b.pierce; burst(h.x, h.y, '#ff5c5c', 20, 220); Sound.play('explode'); G.score += 40; addText(h.x, h.y, 'DEBT CLEARED +40', '#ffe066'); }
    }
    for (const b of G.ebullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -20 || b.x > W + 60 || b.y < -20 || b.y > H + 20) b.dead = true;
      if (!b.dead && hitRect(b, p)) { b.dead = true; if (p.shield > 0) burst(b.x, b.y, '#ffe066', 5, 100); else hurtPlayer(b.dmg); }
    }
    // conformity scan beams: telegraph, then sweep left draining tokens
    for (const bm of G.beams) {
      bm.t += dt;
      if (bm.warm > 0) { bm.warm -= dt; continue; }
      bm.x -= bm.speed * dt;
      if (bm.x < -bm.w) bm.dead = true;
      if (Math.abs(bm.x - p.x) < bm.w / 2 + p.hw) {
        p.tokens = Math.max(0, p.tokens - 45 * dt);
        if (!bm.said) { bm.said = true; addText(p.x, p.y - 50, 'SCANNED: tokens draining', '#ff9b9b'); Sound.play('denied'); }
      }
    }
    // hazards
    for (const h of G.hazards) {
      h.t += dt; h.x += h.vx * dt;
      if (h.kind === 'mine') { h.y += Math.sin(h.t * 2) * 20 * dt; if (hitRect(h, p)) { h.dead = true; burst(h.x, h.y, '#ff5c5c', 24, 240); hurtPlayer(20, 'tech debt'); } }
      if (h.x < -120) h.dead = true;
    }
    // pickups
    for (const k of G.pickups) {
      k.t += dt; k.x += k.vx * dt; k.y += Math.sin(k.t * 3) * 25 * dt;
      if (k.x < -30) k.dead = true;
      if (hitRect(k, p)) { k.dead = true; applyPickup(k.kind); }
    }
    // pitch wave
    if (G.wave) { G.wave.t += dt; if (G.wave.t > 0.8) G.wave = null; }
    // particles / texts / bubbles
    for (const q of G.particles) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; if (q.t > q.life) q.dead = true; }
    for (const t of G.texts) { t.t += dt; t.y -= 30 * dt; if (t.t > t.life) t.dead = true; }
    for (const b of G.bubbles) { b.y -= b.s * dt; b.x -= 20 * dt; if (b.y < -10) { b.y = H + 10; b.x = rand(0, W); } if (b.x < -10) b.x = W + 10; }
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2);

    // cleanup
    G.enemies = G.enemies.filter(e => !e.dead);
    G.bullets = G.bullets.filter(b => !b.dead);
    G.ebullets = G.ebullets.filter(b => !b.dead);
    G.hazards = G.hazards.filter(h => !h.dead);
    G.beams = G.beams.filter(b => !b.dead);
    G.pickups = G.pickups.filter(k => !k.dead);
    G.particles = G.particles.filter(q => !q.dead);
    G.texts = G.texts.filter(t => !t.dead);
  }

  // ------------------------------------------------------------ drawing
  function drawBackground(depthFrac, scrollX, dim) {
    const img = IMG.ocean;
    ctx.fillStyle = '#0a1a4a'; ctx.fillRect(0, 0, W, H);
    if (img && img.naturalWidth) {
      const scale = 1700 / img.naturalHeight; const iw = img.naturalWidth * scale, ih = 1700;
      const oy = -depthFrac * (ih - H);
      const ox = -(scrollX % iw);
      ctx.drawImage(img, ox, oy, iw, ih); ctx.drawImage(img, ox + iw, oy, iw, ih);
    }
    ctx.fillStyle = `rgba(2,4,20,${(0.05 + 0.25 * depthFrac) * dim})`; ctx.fillRect(0, 0, W, H);
  }
  function drawBubbles() {
    ctx.fillStyle = 'rgba(160,220,255,0.35)';
    for (const b of G.bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); }
  }
  function drawSprite(name, x, y, w, h, flipX, rot) {
    const img = IMG[name]; if (!img || !img.naturalWidth) { ctx.fillStyle = '#f0f'; ctx.fillRect(x - w / 2, y - h / 2, w, h); return; }
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  }
  function text(str, x, y, size, color, align, shadow) {
    ctx.font = `${size}px ${FONT}`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    if (shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(str, x + 2, y + 2); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function bar(x, y, w, h, frac, color, label, value) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#1a2340'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
    for (let i = 1; i < 10; i++) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + (w / 10) * i, y, 1, h); }
    text(label, x, y - 10, 8, '#cfe3ff', 'left');
    text(value, x + w, y - 10, 8, color, 'right');
  }

  function drawPlayer() {
    const p = G.player, c = G.char;
    if (p.invuln > 0 && Math.floor(elapsed * 20) % 2 === 0 && p.shield <= 0) return; // blink
    // engine bubbles
    if (Math.random() < 0.5) G.particles.push({ x: p.x - p.w * 0.45, y: p.y + rand(-8, 8), vx: -rand(40, 90), vy: rand(-20, 20), life: 0.5, t: 0, color: 'rgba(180,230,255,0.6)', size: 3 });
    if (p.shield > 0) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(elapsed * 12); ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 0.6, p.h * 0.75, 0, 0, 6.283); ctx.stroke(); ctx.restore();
    }
    drawPilotHead(p, c);
    drawSprite(c.sprite, p.x, p.y, p.w, p.h, false, p.tilt);
    if (p.opus > 0) { ctx.save(); ctx.globalAlpha = 0.6; text('OPUS 6', p.x, p.y - p.h / 2 - 12, 8, POWERUPS.opus6.color, 'center'); ctx.restore(); }
    if (p.vortex > 0) { ctx.save(); ctx.globalAlpha = 0.7; text('VORTEX 3', p.x, p.y - p.h / 2 - 24, 8, POWERUPS.vortex3.color, 'center'); ctx.restore(); }
  }
  // The chosen pilot's portrait, drawn behind the sub and clipped to the hull
  // line so only the head pokes out of the hatch. Follows the sub's tilt.
  function drawPilotHead(p, c) {
    const h = c.hatch, img = IMG[c.portrait];
    if (!h || !img || !img.naturalWidth) return;
    const size = p.w * h.size, ph = size * img.naturalHeight / img.naturalWidth;
    const lx = (h.x - 0.5) * p.w, ly = (h.y - 0.5) * p.h; // hatch point relative to sub centre
    const bob = Math.sin(elapsed * 5) * size * 0.04;
    ctx.save(); ctx.translate(p.x, p.y); if (p.tilt) ctx.rotate(p.tilt);
    ctx.beginPath(); ctx.rect(lx - size, ly - size * 2, size * 2, size * 2 + size * 0.1); ctx.clip();
    ctx.drawImage(img, lx - size / 2, ly - ph * 0.74 + bob, size, ph);
    ctx.restore();
  }
  function drawBeams() {
    for (const bm of G.beams) {
      ctx.save();
      if (bm.warm > 0) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(bm.t * 30); ctx.fillStyle = '#ff3b3b'; ctx.fillRect(bm.x - 1, 46, 2, H - 46);
        text('CONFORMITY SCAN', bm.x, 66, 8, '#ff9b9b', 'center');
      } else {
        const g = ctx.createLinearGradient(bm.x - bm.w, 0, bm.x + bm.w, 0);
        g.addColorStop(0, 'rgba(255,60,60,0)'); g.addColorStop(0.5, 'rgba(255,80,80,0.55)'); g.addColorStop(1, 'rgba(255,60,60,0)');
        ctx.fillStyle = g; ctx.fillRect(bm.x - bm.w, 46, bm.w * 2, H - 46);
        ctx.fillStyle = 'rgba(255,230,230,0.9)'; ctx.fillRect(bm.x - 1.5, 46, 3, H - 46);
      }
      ctx.restore();
    }
  }
  function drawEnemies() {
    for (const e of G.enemies) {
      const bob = e.d.boss ? 0 : Math.sin(e.t * 3) * 3;
      if (e.type === 'mdr' && e.stage >= 2) { // siren glow once non-conformity is found
        ctx.save(); ctx.globalAlpha = Math.floor(e.t * 6) % 2 === 0 ? 0.55 : 0.2; ctx.fillStyle = '#ff2020';
        ctx.beginPath(); ctx.arc(e.x + e.w * 0.02, e.y - e.h * 0.4, e.stage === 3 ? 36 : 26, 0, 6.283); ctx.fill(); ctx.restore();
      }
      ctx.save();
      if (e.flash > 0) ctx.filter = 'brightness(3)';
      drawSprite(e.d.sprite, e.x, e.y + bob, e.w, e.h, false, e.d.move === 'chase' ? Math.sin(e.t * 4) * 0.08 : 0);
      ctx.restore();
      if (!e.d.boss && e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 22, e.y - e.h / 2 - 8, 44, 5);
        ctx.fillStyle = '#ff5c5c'; ctx.fillRect(e.x - 22, e.y - e.h / 2 - 8, 44 * e.hp / e.maxHp, 5);
      }
    }
  }
  function drawBullets() {
    for (const b of G.bullets) {
      if (b.kind === 'vortex') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 12);
        for (let i = 0; i < 3; i++) { ctx.rotate(2.094); ctx.fillStyle = i === 0 ? '#7dffb3' : i === 1 ? '#4fd1ff' : '#ffffff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(b.r * 0.8, -b.r * 0.6, b.r * 1.2, b.r * 0.3); ctx.quadraticCurveTo(b.r * 0.4, b.r * 0.4, 0, 0); ctx.fill(); }
        ctx.restore();
      } else {
        ctx.fillStyle = b.kind === 'opus' ? '#ff7ad9' : '#ffe066';
        ctx.fillRect(b.x - 8, b.y - 3, 16, 6);
        ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 2, b.y - 2, 6, 4);
      }
    }
    for (const b of G.ebullets) {
      ctx.save(); ctx.translate(b.x, b.y);
      switch (b.kind) {
        case 'doc': ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-6, -8, 12, 16); ctx.fillStyle = '#4a6bd6'; for (let i = 0; i < 3; i++) ctx.fillRect(-4, -5 + i * 4, 8, 2); break;
        case 'para': ctx.rotate(b.t * 6); text('§', 0, 0, 16, '#ff4d4d', 'center'); break;
        case 'flask': ctx.fillStyle = '#39e6a0'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#b3ffe0'; ctx.fillRect(-2, -9, 4, 6); break;
        case 'binary': text(Math.floor(b.t * 8) % 2 ? '1' : '0', 0, 0, 12, '#6ec6ff', 'center'); break;
        case 'alarm': ctx.fillStyle = Math.floor(b.t * 10) % 2 ? '#ff3b3b' : '#ffb3b3'; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.283); ctx.fill(); break;
        case 'stamp': ctx.rotate(b.t * 4); ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ffd700'; ctx.fillRect(-4, -4, 8, 8); break;
        default: ctx.fillStyle = '#fff'; ctx.fillRect(-4, -4, 8, 8);
      }
      ctx.restore();
    }
  }
  function drawHazards() {
    for (const h of G.hazards) {
      ctx.save(); ctx.translate(h.x, h.y);
      if (h.kind === 'mine') {
        ctx.rotate(h.t);
        ctx.fillStyle = '#2b2f3a'; ctx.beginPath(); ctx.arc(0, 0, h.r, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#6b7280'; for (let i = 0; i < 8; i++) { const a = i * 0.785; ctx.fillRect(Math.cos(a) * h.r - 3, Math.sin(a) * h.r - 3, 7, 7); }
        ctx.fillStyle = Math.floor(h.t * 4) % 2 ? '#ff3b3b' : '#7a1a1a'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.283); ctx.fill();
        ctx.rotate(-h.t); text('TECH DEBT', 0, h.r + 12, 7, '#ff9b9b', 'center');
      } else {
        const puff = (dx, dy, r) => { ctx.beginPath(); ctx.arc(dx, dy, r, 0, 6.283); ctx.fill(); };
        ctx.fillStyle = 'rgba(80,120,220,0.55)'; puff(-35, 0, 30); puff(0, -12, 38); puff(35, 0, 30); puff(0, 14, 32);
        ctx.fillStyle = 'rgba(140,180,255,0.6)'; puff(-30, -4, 22); puff(5, -16, 26); puff(32, -2, 20);
        text('!', 0, -8, 22, '#ff3b3b', 'center'); text('AZURE OUTAGE', 0, 32, 7, '#dfe8ff', 'center');
      }
      ctx.restore();
    }
  }
  function drawPickups() {
    for (const k of G.pickups) {
      const def = POWERUPS[k.kind];
      ctx.save(); ctx.translate(k.x, k.y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = def.color; ctx.fillRect(-13, -13, 26, 26);
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(k.t * 8); ctx.fillRect(-13, -13, 26, 4); ctx.globalAlpha = 1;
      const glyph = { opus6: 'O6', vortex3: 'V3', shield: '+', funding: '$', tokens: 'T', deal: '$?', credits: 'AZ', mdrcert: 'CE' }[k.kind];
      text(glyph, 0, 1, 10, '#0b1020', 'center', false);
      text(def.label, 0, 26, 7, def.color, 'center');
      ctx.restore();
    }
  }
  function drawEffects() {
    for (const q of G.particles) { ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    ctx.globalAlpha = 1;
    for (const t of G.texts) { ctx.globalAlpha = clamp(1 - (t.t / t.life - 0.6) / 0.4, 0, 1); text(t.text, t.x, t.y, t.big ? 12 : 9, t.color, 'center'); }
    ctx.globalAlpha = 1;
    if (G.wave) { const r = G.wave.t / 0.8; ctx.save(); ctx.globalAlpha = 1 - r; ctx.strokeStyle = '#5cff5c'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(G.wave.x, G.player.y, r * 1100, -1, 1); ctx.stroke(); ctx.restore(); }
  }
  function drawHUD() {
    const p = G.player, c = G.char;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, 46);
    bar(16, 22, 220, 12, p.funding / p.maxFunding, p.funding < p.maxFunding * 0.3 ? '#ff5c5c' : '#5cff5c', 'FUNDING (HP)', `${Math.ceil(p.funding)}/${p.maxFunding}`);
    bar(262, 22, 220, 12, p.tokens / p.maxTokens, '#6ec6ff', 'TOKEN LIMIT (MANA)', `${Math.floor(p.tokens)}/${p.maxTokens}`);
    // special
    const sp = c.special, ready = p.specialCd <= 0 && p.tokens >= sp.cost;
    bar(508, 22, 200, 12, p.specialCd > 0 ? 1 - p.specialCd / sp.cooldown : 1, ready ? c.color : '#777', `SHIFT: ${sp.name}`, ready ? 'READY' : p.specialCd > 0 ? `${Math.ceil(p.specialCd)}s` : `${sp.cost} TOK`);
    text(`SCORE ${G.score}`, W - 16, 14, 10, '#ffe066', 'right');
    text(`DEPTH ${Math.floor(G.depth)}m`, W - 16, 32, 10, '#cfe3ff', 'right');
    // active buffs
    let bx = 16, by = 60;
    const buffs = [['OPUS 6', p.opus, POWERUPS.opus6.color], ['VORTEX 3', p.vortex, POWERUPS.vortex3.color], ['INVINCIBLE', p.shield, POWERUPS.shield.color], ['HOTFIX', p.hotfix, '#4fd1ff']];
    for (const [n, t, col] of buffs) if (t > 0) { text(`${n} ${Math.ceil(t)}s`, bx, by, 8, col, 'left'); by += 14; }
    if (p.certified) { text('MDR CERTIFIED +25% DMG', bx, by, 8, POWERUPS.mdrcert.color, 'left'); by += 14; }
    // depth gauge on the right
    const gx = W - 14, gy = 60, gh = H - 120;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(gx - 4, gy, 8, gh);
    for (const z of ZONES) { const yy = gy + gh * z.depth / MAX_DEPTH; ctx.fillStyle = z.boss ? '#ff5c5c' : '#6ec6ff'; ctx.fillRect(gx - 6, yy - 1, 12, 2); }
    ctx.fillStyle = c.color; ctx.fillRect(gx - 7, gy + gh * G.depth / MAX_DEPTH - 3, 14, 6);
    // boss bar
    if (G.boss) {
      const b = G.boss;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 202, H - 62, 404, 20);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(W / 2 - 200, H - 60, 400 * Math.max(0, b.hp) / b.maxHp, 16);
      text(`${b.d.name}`, W / 2, H - 52, 9, '#fff', 'center');
      if (b.type === 'mdr') { // audit checklist and current damage guard
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(W / 2 - 360, 50, 720, 40);
        MDR_CHECKS.forEach((n, i) => { const done = b.checks[i]; text(`[${done ? 'X' : ' '}] ${n}`, W / 2 + (i - 1) * 230, 62, 7, done ? '#5cff5c' : '#cfe3ff', 'center'); });
        const g = mdrGuard(b);
        text(g >= 1 ? 'DISTRACTED BY PAPERWORK: FULL DAMAGE' : g <= 0.5 ? 'REVIEWING: HALF DAMAGE' : 'GUARDED: 70% DAMAGE', W / 2, 80, 7, g >= 1 ? '#5cff5c' : g <= 0.5 ? '#ff5c5c' : '#ffe066', 'center');
      }
    }
    // banner
    if (G.banner) {
      const a = clamp(Math.min(G.banner.t, 0.5) * 2, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = G.banner.boss ? 'rgba(120,0,0,0.6)' : 'rgba(0,0,0,0.55)'; ctx.fillRect(0, H / 2 - 50, W, 100);
      text(G.banner.title, W / 2, H / 2 - 12, 20, G.banner.boss ? '#ff5c5c' : '#fff', 'center');
      text(G.banner.sub, W / 2, H / 2 + 20, 10, '#cfe3ff', 'center');
      ctx.restore();
    }
  }

  function drawTitle() {
    drawBackground(0.15, elapsed * 25, 1);
    // slow bubbles
    ctx.fillStyle = 'rgba(160,220,255,0.3)';
    for (let i = 0; i < 25; i++) { const y = (H - ((elapsed * 30 + i * 97) % (H + 20))), x = (i * 137 + Math.sin(elapsed + i) * 10) % W; ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, 6.283); ctx.fill(); }
    text('KAIKO', W / 2, 52, 34, '#ffb300', 'center');
    text('THE LITTLE SUBMARINE THAT COULD', W / 2, 88, 12, '#cfe3ff', 'center');
    text('CHOOSE YOUR PILOT', W / 2, 130, 12, '#fff', 'center');
    for (const [i, key] of [['0', 'robert'], ['1', 'thomas']]) {
      const c = CHARACTERS[key], cx = i === '0' ? W / 4 : 3 * W / 4, sel = selected === key;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.35)'; ctx.fillRect(cx - 200, 150, 400, 295);
      if (sel) { ctx.strokeStyle = c.color; ctx.lineWidth = 4; ctx.strokeRect(cx - 200, 150, 400, 295); }
      // pilot portrait (pixel-art headshot) on the left, their sub on the right
      const px = cx - 110, py = 222, ps = 124;
      ctx.fillStyle = '#0a1a4a'; ctx.fillRect(px - ps / 2, py - ps / 2, ps, ps);
      drawSprite(c.portrait, px, py, ps, ps);
      ctx.strokeStyle = sel ? c.color : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.strokeRect(px - ps / 2, py - ps / 2, ps, ps);
      const sw = c.width * 0.85;
      drawSprite(c.sprite, cx + 75, 222 + Math.sin(elapsed * 2 + (sel ? 0 : 1)) * 5, sw, spriteH(c.sprite, sw));
      text(`${c.name} (${c.title})`, cx, 300, 13, c.color, 'center');
      c.blurb.forEach((l, j) => text(l, cx, 322 + j * 14, 8, '#dfe8ff', 'center'));
      text(`FUNDING ${c.funding}  TOKENS ${c.tokens}  SPEED ${c.speed}`, cx, 372, 7, '#9fc3ff', 'center');
      text(`SPECIAL: ${c.special.name}`, cx, 392, 9, '#ffe066', 'center');
      c.special.desc.forEach((l, j) => text(l, cx, 408 + j * 11, 7, '#dfe8ff', 'center'));
    }
    if (Math.floor(elapsed * 2) % 2 === 0) text('PRESS ENTER TO DIVE', W / 2, 468, 12, '#fff', 'center');
    text('Left/Right to choose  ·  Shoot: Space  ·  Special: Shift  ·  Enemies fire back, hazards drain you.', W / 2, 495, 7, '#9fc3ff', 'center');
    text('Funding = HP. Tokens = ammo (they regenerate). Run out of funding and it is game over.', W / 2, 512, 7, '#9fc3ff', 'center');
  }

  function drawEnd(win) {
    ctx.fillStyle = win ? 'rgba(0,40,20,0.75)' : 'rgba(40,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    text(win ? 'CE MARK OBTAINED!' : 'YOU RAN OUT OF FUNDING', W / 2, H / 2 - 80, win ? 26 : 22, win ? '#5cff5c' : '#ff5c5c', 'center');
    text(win ? 'SCARLET signed off. Kaiko surfaces certified.' : 'The investors have left the building.', W / 2, H / 2 - 40, 10, '#fff', 'center');
    text(`SCORE ${G.score}`, W / 2, H / 2 + 5, 16, '#ffe066', 'center');
    text(`DEPTH REACHED ${Math.floor(G.depth)}m   ·   ENEMIES DEFEATED ${G.kills}   ·   TIME ${Math.floor(G.time)}s`, W / 2, H / 2 + 38, 8, '#cfe3ff', 'center');
    if (Math.floor(elapsed * 2) % 2 === 0) text('PRESS ENTER TO TRY AGAIN', W / 2, H / 2 + 90, 11, '#fff', 'center');
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 14);
    if (state === 'title') { drawTitle(); ctx.restore(); return; }
    drawBackground(clamp(G.depth / MAX_DEPTH, 0, 1), G.scrollX, 1);
    drawBubbles();
    drawHazards();
    drawBeams();
    drawPickups();
    drawEnemies();
    if (state !== 'gameover') drawPlayer();
    drawBullets();
    drawEffects();
    if (flash > 0) { ctx.fillStyle = `rgba(255,80,80,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    drawHUD();
    if (state === 'paused') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); text('PAUSED', W / 2, H / 2 - 10, 24, '#fff', 'center'); text('Press P to resume', W / 2, H / 2 + 25, 10, '#cfe3ff', 'center'); }
    if (state === 'gameover') drawEnd(false);
    if (state === 'win') drawEnd(true);
    ctx.restore();
  }

  // ------------------------------------------------------------ loop
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0); lastTime = ts;
    for (let i = 0; i < TURBO; i++) update(dt); render();
    requestAnimationFrame(frame);
  }
  ctx.fillStyle = '#0a1a4a'; ctx.fillRect(0, 0, W, H);
  text('LOADING...', W / 2, H / 2, 14, '#fff', 'center');
  // Debug/testing hooks: ?pilot=robert|thomas&autostart=1&depth=2600&autofire=1&turbo=30&god=1
  const Q = new URLSearchParams(location.search);
  TURBO = clamp(parseInt(Q.get('turbo') || '1', 10) || 1, 1, 200);
  GOD = !!Q.get('god');
  loadAssets(() => {
    if (Q.get('autostart')) {
      selected = CHARACTERS[Q.get('pilot')] ? Q.get('pilot') : selected;
      startGame();
      if (Q.get('depth')) G.depth = clamp(parseFloat(Q.get('depth')) || 0, 0, MAX_DEPTH);
      if (Q.get('autofire')) keys.Space = true;
    }
    requestAnimationFrame(frame);
  });
})();
