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
  const SPRITES = ['kaiko_sub', 'kaiko_mini', 'kaiko_dome', 'robert', 'thomas', 'veerle', 'datadesk', 'legal', 'hospital', 'research', 'it', 'regulatory', 'gdpr', 'mdr', 'scarlet'];
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
      hatch: { x: 0.73, y: 0.3, size: 0.2 }, // right of the periscope, before the front dome
      gear: { art: 'scalpel', x: 0.5, y: 0.17, px: 1 / 65 }, // mounted under the dome: centre offset and pixel size as fractions of sub width
      width: 130, hitScale: 0.55, speed: 270, funding: 100, tokens: 110, fireRate: 0.19, tokenRegen: 12, bulletDmg: 1,
      blurb: ['The clinical sub.', 'Balanced hull and speed.', 'Keeps everyone on topic.'],
      special: { name: 'STAY ON TOPIC', cost: 30, cooldown: 12, duration: 8, desc: ['8 seconds of free,', 'homing, piercing shots.', 'Nobody wanders off.'] },
    },
  };
  const PILOTS = Object.keys(CHARACTERS); // select-screen order

  // Pixel art drawn in code, pointing right. '.' is transparent.
  const GEAR = {
    scalpel: {
      pal: { k: '#1b2330', g: '#9aa7b8', G: '#6b7788', w: '#f4f8ff', s: '#c9d3e0' },
      rows: [
        'kkkkkkkkkkkkkkkkkkkkkkkkk...',
        'kgggggggggggggggkwwwwwwwwkk.',
        'kgGgGgGgGgGgGgGgkswwwwwwwwwk',
        'kGGGGGGGGGGGGGGGksssswwwwkk.',
        'kkkkkkkkkkkkkkkkkkkssssskk..',
        '...................kkkkk....',
      ],
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
  const WAVE_TIME = 2.2, WAVE_REACH = 1100; // FUNDRAISE: seconds for the pitch wave to cross the screen
  const SLOWMO_TIME = 0.7, SLOWMO_SCALE = 0.25; // boss kill: real seconds of slow motion and the speed during it
  const LETTERBOX_TIME = 2.5;                   // boss entrance: seconds of cinematic bars
  const DEEP_SCALE = 0.3;   // DEEP THOUGHT: world speed while active; Kaiko keeps full speed
  const TOPIC_FIRE = 0.66;  // STAY ON TOPIC: fire cooldown multiplier (about 1.5x the fire rate)
  const HOMING_TURN = 12.6; // rad/s a homing shot can turn (about 720 degrees per second)

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

  // Corners cut: startup shortcuts chosen before the dive. Each makes Kaiko stronger and the ocean
  // deadlier. The number taken is the risk level, which multiplies score. apply(m) edits the run's
  // modifier set (see neutralMods); anything only a multiplier needs no other code.
  const RISKS = [
    { key: 'noeval',      tag: 'NO EVAL',     label: 'NO QUANTITATIVE EVALUATION', up: 'Speed +50%',               down: 'All damage taken is doubled',
      apply: m => { m.speed *= 1.5; m.dmgTaken *= 2; } },
    { key: 'noclin',      tag: 'NO CLINICAL', label: 'SKIP CLINICAL VALIDATION',   up: 'Your shots do +50% damage', down: 'Bosses have +60% hp',
      apply: m => { m.bulletDmg *= 1.5; m.bossHp *= 1.6; } },
    { key: 'nodata',      tag: 'DATA GRAB',   label: 'TRAIN ON UNCONSENTED DATA',  up: 'Pickups twice as often',    down: 'GDPR and Legal spawn double and hit double',
      apply: m => { m.pickupRate *= 2; m.enemyWeight.gdpr *= 2; m.enemyWeight.legal *= 2; m.enemyDmg.gdpr *= 2; m.enemyDmg.legal *= 2; } },
    { key: 'oneregion',   tag: 'ONE REGION',  label: 'SINGLE AZURE REGION',        up: 'Token pool and regen +60%', down: 'Outages twice as common and drain funding',
      apply: m => { m.maxTokens *= 1.6; m.tokenRegen *= 1.6; m.hazardRate *= 2; m.azureFunding = true; } },
    { key: 'hotfix',      tag: 'HOTFIX PROD', label: 'HOTFIX STRAIGHT TO PROD',    up: 'Shots cost zero tokens',    down: '8% of shots misfire and cost 5 funding',
      apply: m => { m.tokenCost = 0; m.misfire = 0.08; } },
    { key: 'overpromise', tag: 'OVERPROMISE', label: 'OVERPROMISE TO INVESTORS',   up: 'Start with 200% funding',   down: 'Funding burns 2 per second, live on Series C',
      apply: m => { m.fundingStart *= 2; m.burn += 2; } },
    { key: 'nosec',       tag: 'NO SECURITY', label: 'SKIP SECURITY REVIEW',       up: 'Special has no cooldown',   down: 'Tech debt mines home in on you',
      apply: m => { m.specialCd = 0; m.homingMines = true; } },
  ];
  const RISK_LEVELS = [['SAFE', 1, '#9fc3ff'], ['BOLD', 1.3, '#5cff5c'], ['RECKLESS', 1.7, '#ffe066'], ['YOLO', 2.2, '#ff8a3d'], ['UNINSURABLE', 3, '#ff4d4d']];
  function riskLevel(n) { const [name, mult, color] = RISK_LEVELS[Math.min(n, RISK_LEVELS.length - 1)]; return { name, mult, color }; }
  function neutralMods() {
    const enemyWeight = {}, enemyDmg = {};
    for (const k of Object.keys(ENEMIES)) { enemyWeight[k] = 1; enemyDmg[k] = 1; }
    return { speed: 1, dmgTaken: 1, bulletDmg: 1, tokenCost: 3, tokenRegen: 1, maxTokens: 1, fundingStart: 1, bossHp: 1, pickupRate: 1, hazardRate: 1,
      specialCd: 1, enemyWeight, enemyDmg, azureFunding: false, misfire: 0, burn: 0, homingMines: false };
  }
  const RISK_Y0 = 104, RISK_ROW = 44; // risk screen row layout, shared by drawing and pointer input

  // Obstacle themes per depth. gap = tunnel height range, slope = max wall rise per px scrolled,
  // tunnel/open = section lengths in px, rock/crate/vent = feature odds, chamber = odds of a wide room.
  const THEMES = [
    { key: 'reef',   depth: 0,    ceiling: false, gap: [0, 0],     slope: 0.35, noise: 6,  tunnel: [1400, 2200], open: [500, 900], rock: 0,    crate: 0.5,  vent: 0,   chamber: 0,
      wall: '#b8935a', inner: '#8a6a3c', edge: '#e8cf94', accent: ['#ff7a59', '#ff4f8b', '#ffb347'], box: { label: 'BACKLOG', hp: 3, score: 60 } },
    { key: 'wreck',  depth: 700,  ceiling: true,  gap: [300, 400], slope: 0.5,  noise: 3,  tunnel: [1600, 2600], open: [500, 800], rock: 0.35, crate: 0.35, vent: 0,   chamber: 0.3,
      wall: '#34405e', inner: '#232c45', edge: '#6a7ba3', accent: ['#b0643a', '#8a4a2a'], box: { label: 'NDA', hp: 5, score: 80 } },
    { key: 'cave',   depth: 1600, ceiling: true,  gap: [240, 330], slope: 0.7,  noise: 12, tunnel: [2000, 3000], open: [400, 700], rock: 0.4,  crate: 0.3,  vent: 0,   chamber: 0.35,
      wall: '#2e2446', inner: '#1c1530', edge: '#6b58a0', accent: ['#8e7bd1', '#b8a6ff'], box: { label: 'RED TAPE', hp: 6, score: 100 } },
    { key: 'trench', depth: 2600, ceiling: true,  gap: [200, 290], slope: 0.85, noise: 8,  tunnel: [2400, 3600], open: [300, 600], rock: 0.25, crate: 0.25, vent: 0.55, chamber: 0.35,
      wall: '#1e1719', inner: '#110c0e', edge: '#4a3a3c', accent: ['#ff5a1f', '#ffb347'], box: { label: 'LEGACY', hp: 8, score: 120 } },
  ];

  // MDR boss: an audit in stages, keyed to hp. Each threshold ticks a checklist item.
  const MDR_CHECKS = ['CLINICAL EVIDENCE', 'RISK FILE', 'POST-MARKET'];
  const MDR_THRESHOLDS = [0.7, 0.4, 0.15];

  // ------------------------------------------------------------ state
  let TURBO = 1, GOD = false; // debug: ?turbo=n fast-forwards, ?god=1 makes the pilot unhurtable
  let START_DEPTH = 0; // debug: ?depth=N starts every run (select, R retry, autostart) at N metres
  let state = 'title';
  let selected = 'thomas';
  let riskSel = new Set(), riskCursor = 0; // chosen shortcuts persist across retries
  let keys = {};
  let lastTime = 0, elapsed = 0;
  let shake = 0, flash = 0;
  const G = {}; // game session

  function newGame(charKey) {
    const c = CHARACTERS[charKey];
    G.char = c;
    const m = neutralMods();
    G.risks = RISKS.filter(r => riskSel.has(r.key));
    for (const r of G.risks) r.apply(m);
    G.mods = m; G.riskMult = riskLevel(G.risks.length).mult;
    const funding = Math.round(c.funding * m.fundingStart), tokens = Math.round(c.tokens * m.maxTokens);
    G.player = {
      x: 160, y: H / 2, vx: 0, vy: 0, w: c.width, h: spriteH(c.sprite, c.width),
      hw: c.width * c.hitScale / 2, hh: spriteH(c.sprite, c.width) * c.hitScale / 2,
      funding, maxFunding: funding, tokens, maxTokens: tokens,
      fireCd: 0, invuln: 0, shield: 0, opus: 0, vortex: 0, deep: 0, onTopic: 0, specialCd: 0, tilt: 0, drain: 0,
    };
    G.bullets = []; G.ebullets = []; G.enemies = []; G.hazards = []; G.pickups = []; G.beams = [];
    G.particles = []; G.texts = []; G.bubbles = []; G.drain = []; G.bills = []; G.fly = [];
    G.hud = { fundGlow: 0, tokGlow: 0, tokEmpty: 0, chunk: null }; G.ripple = null; G.slowmo = 0; G.focus = null; G.letterbox = 0;
    G.depth = START_DEPTH; G.score = 0; G.time = 0; G.kills = 0;
    G.spawnT = 1.5; G.hazardT = 6; G.pickupT = 8; G.zoneIdx = -1; G.banner = null;
    G.boss = null; G.bossDefeated = {}; G.scrollX = 0; G.wave = null; G.endAt = 0; G.drips = []; G.winAt = 0; G.confetti = [];
    for (let i = 0; i < 40; i++) G.bubbles.push({ x: rand(0, W), y: rand(0, H), r: rand(1, 4), s: rand(15, 45) });
    newTerrain();
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
      if (y > 150 && y < 440) { selected = PILOTS[clamp(Math.floor(x / (W / PILOTS.length)), 0, PILOTS.length - 1)]; Sound.play('select'); }
      if (y >= 450) { state = 'risks'; Sound.play('select'); }
    } else if (state === 'risks') {
      const i = Math.floor((y - RISK_Y0 + 18) / RISK_ROW);
      if (i >= 0 && i < RISKS.length && x > 60 && x < W - 60) { riskCursor = i; toggleRisk(i); }
      else if (y >= 470) startGame();
    } else if (state === 'gameover' || state === 'win') toTitle();
  });
  function onKey(code) {
    if (code === 'KeyM') { Sound.toggleMute(); return; }
    if (state === 'title') {
      const i = PILOTS.indexOf(selected), n = PILOTS.length;
      if (code === 'ArrowLeft' || code === 'KeyA') { selected = PILOTS[(i + n - 1) % n]; Sound.play('select'); }
      if (code === 'ArrowRight' || code === 'KeyD') { selected = PILOTS[(i + 1) % n]; Sound.play('select'); }
      if (/^Digit[1-9]$/.test(code) && PILOTS[+code.slice(5) - 1]) { selected = PILOTS[+code.slice(5) - 1]; Sound.play('select'); }
      if (code === 'Enter' || code === 'Space') { state = 'risks'; Sound.play('select'); }
    } else if (state === 'risks') {
      const n = RISKS.length;
      if (code === 'ArrowUp' || code === 'KeyW') { riskCursor = (riskCursor + n - 1) % n; Sound.play('select'); }
      if (code === 'ArrowDown' || code === 'KeyS') { riskCursor = (riskCursor + 1) % n; Sound.play('select'); }
      if (code === 'Space') toggleRisk(riskCursor);
      if (/^Digit[1-9]$/.test(code) && RISKS[+code.slice(5) - 1]) toggleRisk(+code.slice(5) - 1);
      if (code === 'Enter') startGame();
      if (code === 'Escape' || code === 'Backspace') state = 'title';
    } else if (state === 'play') {
      if (code === 'KeyP' || code === 'Escape') state = 'paused';
      if (code === 'ShiftLeft' || code === 'ShiftRight') useSpecial();
    } else if (state === 'paused') {
      if (code === 'KeyP' || code === 'Escape' || code === 'Enter') state = 'play';
    } else if (state === 'gameover' || state === 'win') {
      if (code === 'Enter' || code === 'Space') toTitle();
      if (code === 'KeyR') startGame();
    }
  }
  function toTitle() { state = 'title'; shake = 0; flash = 0; } // the game-over shake must not follow you to the title
  function toggleRisk(i) { const k = RISKS[i].key; if (riskSel.has(k)) riskSel.delete(k); else riskSel.add(k); Sound.play('select'); }
  function startGame() { newGame(selected); state = 'play'; Sound.startMusic(); Sound.play('select'); }

  // ------------------------------------------------------------ spawning
  const pickZoneEnemy = (zone) => weightedPick(zone.enemies.map(([k, w]) => ({ w: w * G.mods.enemyWeight[k], v: k })));
  function currentZone() {
    let z = ZONES[0];
    for (const zone of ZONES) if (G.depth >= zone.depth) z = zone;
    return z;
  }
  function spawnEnemy(typeKey, opts = {}) {
    const d = ENEMIES[typeKey];
    const h = spriteH(d.sprite, d.w), x = opts.x ?? W + d.w;
    const e = {
      type: typeKey, d, x, y: opts.y ?? randInGap(x, d.w * 0.36, h * 0.36, 70), w: d.w, h,
      hw: d.w * 0.36, hh: h * 0.36, hp: d.hp, maxHp: d.hp, t: rand(0, 6.28), baseY: 0,
      shootT: rand(0.5, d.shoot || 1), dir: Math.random() < 0.5 ? 1 : -1, flash: 0, phase: 0,
    };
    e.baseY = e.y;
    G.enemies.push(e);
    return e;
  }
  function spawnHazard() {
    const kind = Math.random() < 0.65 ? 'mine' : 'azure';
    if (kind === 'mine') G.hazards.push({ kind, x: W + 40, y: randInGap(W + 40, 18, 18, 60), r: 22, hw: 18, hh: 18, t: rand(0, 6), vx: -rand(60, 110) });
    else G.hazards.push({ kind, x: W + 90, y: randInGap(W + 90, 70, 40, 80), r: 60, hw: 70, hh: 40, t: 0, vx: -rand(35, 55) });
  }
  function spawnPickup(x, y, kind) {
    kind = kind || weightedPick(Object.entries(POWERUPS).filter(([, v]) => v.w > 0).map(([k, v]) => ({ w: v.w, v: k })));
    G.pickups.push({ kind, x, y: safeY(x, 16, y ?? randInGap(x, 16, 16, 60), 16), hw: 16, hh: 16, t: 0, vx: -50, vy: 0 });
  }

  // ------------------------------------------------------------ terrain
  // Walls are columns every TSTEP world px: `top` is the ceiling edge, `bot` the floor edge.
  // Gaps never drop below TMIN and every feature leaves TPASS of open water, so all pickups stay reachable.
  const TSTEP = 24, TMIN = 180, TPASS = 150, SCROLL = 90, VENT_PERIOD = 3.4;
  const OPEN_TOP = -60, OPEN_BOT = H - 18;
  function newTerrain() {
    G.cols = []; G.blocks = []; G.wtime = 0;
    G.gen = { wx: -TSTEP, top: OPEN_TOP, bot: OPEN_BOT, tTop: OPEN_TOP, tBot: OPEN_BOT, mode: 'open', left: 600, hold: 0, held: false };
  }
  function terrainTheme(depth) { let t = THEMES[0]; for (const th of THEMES) if (depth >= th.depth) t = th; return t; }
  function genColumn() {
    const g = G.gen;
    // depth this column will be at when it reaches the player; walls recede before boss fights
    const depth = G.depth + Math.max(0, g.wx - G.scrollX - 160) / SCROLL * DESCENT_RATE;
    const th = terrainTheme(depth);
    const calm = G.boss || (!G.bossDefeated.mdr && G.depth <= 2600 && depth > 2450) || depth > MAX_DEPTH - 150;
    g.left -= TSTEP;
    if (calm) { g.mode = 'open'; g.left = Math.max(g.left, 300); }
    else if (g.left <= 0 && g.hold === 0) {
      g.mode = g.mode === 'open' ? 'tunnel' : 'open';
      g.left = rand(...th[g.mode]);
      if (g.mode === 'tunnel') pickTarget(th);
    }
    if (g.mode === 'open') { g.tTop = OPEN_TOP; g.tBot = OPEN_BOT; g.hold = 0; }
    else if (g.hold > 0) g.hold--;
    else if (Math.abs(g.top - g.tTop) < 1 && Math.abs(g.bot - g.tBot) < 1) {
      if (g.held || !placeFeature(th)) pickTarget(th);
      g.held = g.hold > 0;
    }
    const step = th.slope * TSTEP;
    g.top += clamp(g.tTop - g.top, -step, step);
    g.bot += clamp(g.tBot - g.bot, -step, step);
    const n = g.hold > 0 ? 0 : g.mode === 'open' ? 2 : th.noise;
    let top = g.top + rand(0, n), bot = g.bot - rand(0, n);
    if (bot - top < TMIN) { const m = (top + bot) / 2; top = m - TMIN / 2; bot = m + TMIN / 2; }
    G.cols.push({ wx: g.wx, top, bot, th, seed: Math.random() });
    g.wx += TSTEP;
  }
  function pickTarget(th) {
    const g = G.gen;
    g.chamber = th.ceiling && Math.random() < th.chamber;
    if (!th.ceiling) { g.tTop = OPEN_TOP; g.tBot = rand(H - 200, H - 50); return; }
    const gap = g.chamber ? rand(400, 460) : rand(th.gap[0], th.gap[1]);
    const c = rand(gap / 2 - 20, H + 10 - gap / 2);
    g.tTop = c - gap / 2; g.tBot = c + gap / 2;
  }
  // Rocks, crates and vents sit on a flat stretch of wall (held for the feature's width).
  function placeFeature(th) {
    const g = G.gen, top = Math.max(g.top, 46), gap = g.bot - top, r = Math.random() * (g.chamber ? th.vent + th.rock : 1);
    const hold = (w) => { g.hold = Math.ceil(w / TSTEP) + 4; return g.wx + TSTEP + w / 2; };
    if (r < th.vent && gap >= TPASS + 60) {
      G.blocks.push({ kind: 'vent', th, wx: hold(44), y: g.bot, hw: 18, hh: 0, maxH: Math.min(gap * 0.5, gap - TPASS), off: rand(0, VENT_PERIOD) });
      return true;
    }
    if (r < th.vent + th.rock && gap >= 2 * TPASS + 50) {
      const bw = rand(50, 90), bh = rand(50, Math.min(120, gap - 2 * TPASS));
      const pts = []; for (let i = 0; i < 9; i++) pts.push(rand(0.95, 1.12));
      G.blocks.push({ kind: 'rock', th, wx: hold(bw), y: rand(top + TPASS + bh / 2, g.bot - TPASS - bh / 2), hw: bw / 2, hh: bh / 2, pts });
      return true;
    }
    if (r < th.vent + th.rock + th.crate && gap >= TPASS + 60) {
      const ch = rand(56, Math.min(110, gap - TPASS)), onCeil = th.ceiling && g.top > 60 && Math.random() < 0.4;
      G.blocks.push({ kind: 'crate', th, wx: hold(56), y: onCeil ? g.top + ch / 2 - 4 : g.bot - ch / 2 + 4, hw: 28, hh: ch / 2, hp: th.box.hp, maxHp: th.box.hp, flash: 0 });
      return true;
    }
    return false;
  }
  function edgesAt(sx) {
    const c = G.cols;
    if (c.length < 2) return { top: OPEN_TOP, bot: OPEN_BOT };
    const f = (sx + G.scrollX - c[0].wx) / TSTEP, i = clamp(Math.floor(f), 0, c.length - 2), t = clamp(f - i, 0, 1);
    return { top: lerp(c[i].top, c[i + 1].top, t), bot: lerp(c[i].bot, c[i + 1].bot, t) };
  }
  function gapRange(x0, x1) { // tightest ceiling/floor over a horizontal span
    const a = edgesAt(x0), b = edgesAt(x1), c = G.cols;
    let top = Math.max(a.top, b.top), bot = Math.min(a.bot, b.bot);
    if (c.length) {
      const i1 = Math.min(c.length - 1, Math.floor((x1 + G.scrollX - c[0].wx) / TSTEP));
      for (let i = Math.max(0, Math.ceil((x0 + G.scrollX - c[0].wx) / TSTEP)); i <= i1; i++) { top = Math.max(top, c[i].top); bot = Math.min(bot, c[i].bot); }
    }
    return { top, bot };
  }
  function keepInGap(x, hw, y, hh) {
    const g = gapRange(x - hw, x + hw), lo = g.top + hh, hi = g.bot - hh;
    return hi < lo ? (g.top + g.bot) / 2 : clamp(y, lo, hi);
  }
  function randInGap(x, hw, hh, margin) {
    const g = gapRange(x - hw, x + hw);
    const lo = Math.max(margin, g.top + hh + 8), hi = Math.min(H - margin, g.bot - hh - 8);
    return hi > lo ? rand(lo, hi) : (Math.max(g.top, 0) + Math.min(g.bot, H)) / 2;
  }
  // Pickups avoid walls, rocks, crates and vent plumes so they can always be collected.
  function safeY(x, hw, y, hh) {
    const pad = 6, g = gapRange(x - hw, x + hw);
    const lo = Math.max(60, g.top + hh + pad), hi = g.bot - hh - pad;
    if (hi < lo) return (g.top + g.bot) / 2;
    y = clamp(y, lo, hi);
    for (const b of G.blocks) {
      const dx = b.wx - G.scrollX - x;
      if (b.dead || dx <= -(hw + b.hw + pad) || dx >= hw + b.hw + 50) continue;
      const by = b.kind === 'vent' ? b.y - b.maxH / 2 : b.y, bh = b.kind === 'vent' ? b.maxH / 2 : b.hh;
      if (Math.abs(y - by) >= hh + bh + pad) continue;
      const up = by - bh - hh - pad, dn = by + bh + hh + pad, upOk = up >= lo, dnOk = dn <= hi;
      if (upOk && (!dnOk || y - up < dn - y)) y = up; else if (dnOk) y = dn;
    }
    return y;
  }
  function solidAt(x, y) { // 'wall', a rock/crate, or null
    const e = edgesAt(x);
    if (y < e.top || y > e.bot) return 'wall';
    for (const b of G.blocks) if (!b.dead && b.kind !== 'vent' && Math.abs(x - (b.wx - G.scrollX)) < b.hw && Math.abs(y - b.y) < b.hh) return b;
    return null;
  }
  const ventCycle = (v) => (G.wtime + v.off) % VENT_PERIOD;
  const ventHeight = (v) => { const c = ventCycle(v); return c < 2.5 ? 0 : v.maxH * Math.min(1, (c - 2.5) / 0.15); };
  function damageBlock(b, dmg) {
    b.hp -= dmg; b.flash = 0.08;
    if (b.hp > 0 || b.dead) return;
    const x = b.wx - G.scrollX;
    b.dead = true;
    addText(x, b.y - b.hh, `${b.th.box.label} CLEARED +${addScore(b.th.box.score)}`, '#ffe066');
    burst(x, b.y, b.th.edge, 22, 220); burst(x, b.y, '#ffffff', 8, 160);
    Sound.play('explode');
    if (Math.random() < 0.3) spawnPickup(x, b.y);
  }
  function updateTerrain(dt) { // dt is world time, so DEEP THOUGHT slows vents too
    G.wtime += dt;
    while (G.gen.wx < G.scrollX + W + 400) genColumn();
    while (G.cols.length > 2 && G.cols[1].wx < G.scrollX - TSTEP) G.cols.shift();
    G.blocks = G.blocks.filter(b => !b.dead && b.wx - G.scrollX > -150);
    const p = G.player;
    for (const b of G.blocks) {
      b.flash -= dt;
      const bx = b.wx - G.scrollX;
      if (b.kind === 'vent') {
        const h = ventHeight(b);
        if (h > 0 && Math.abs(p.x - bx) < p.hw + b.hw && p.y + p.hh > b.y - h) { hurtPlayer(15, 'burn rate'); p.vy = Math.min(p.vy, -200); }
        continue;
      }
      const ox = p.hw + b.hw - Math.abs(p.x - bx), oy = p.hh + b.hh - Math.abs(p.y - b.y);
      if (ox <= 0 || oy <= 0) continue;
      hurtPlayer(b.kind === 'rock' ? 10 : 8, b.kind === 'rock' ? 'rock' : b.th.box.label.toLowerCase());
      if (oy < ox || p.x - ox < p.w / 2 - 10) { // push over or under, whichever side has room
        const g = gapRange(p.x - p.hw, p.x + p.hw), up = b.y - b.hh - p.hh, dn = b.y + b.hh + p.hh;
        const upOk = up - p.hh >= g.top, dnOk = dn + p.hh <= g.bot;
        p.y = upOk && (!dnOk || p.y < b.y) ? up : dnOk ? dn : up; p.vy = 0;
      } else { p.x += p.x < bx ? -ox : ox; p.vx = 0; }
    }
    const g = gapRange(p.x - p.hw, p.x + p.hw);
    if (p.y - p.hh < g.top) { p.y = g.top + p.hh; p.vy = Math.max(p.vy, 150); hurtPlayer(8, 'hull scrape'); }
    else if (p.y + p.hh > g.bot) { p.y = g.bot - p.hh; p.vy = Math.min(p.vy, -150); hurtPlayer(8, 'hull scrape'); }
  }
  function spawnBoss(key) {
    const b = spawnEnemy(key, { x: W + 200, y: H / 2 });
    b.hw = b.w * 0.34; b.hh = b.h * 0.34; b.phase = 0; b.shootT = 1.5; b.entering = true;
    b.hp = b.maxHp = Math.round(b.d.hp * G.mods.bossHp);
    if (key === 'mdr') { b.stage = 0; b.checks = [false, false, false]; b.gapRow = 3; b.wallT = 0; b.spiral = 0; b.minionT = 8; b.cycle = 0; }
    G.boss = b; G.letterbox = LETTERBOX_TIME;
    G.banner = { title: key === 'mdr' ? 'WARNING: MDR AUDIT' : 'FINAL REVIEW: SCARLET', sub: key === 'mdr' ? 'Prove your device is safe.' : 'Get that CE mark.', t: 3.2, boss: true };
    Sound.play('special');
  }

  // ------------------------------------------------------------ actions
  function shoot() {
    const p = G.player, c = G.char;
    if (p.fireCd > 0) return;
    const m = G.mods, mult = (p.certified ? 1.25 : 1) * m.bulletDmg;
    if (p.vortex > 0) {
      p.fireCd = 0.28;
      G.bullets.push({ x: p.x + p.w * 0.45, y: p.y + 4, vx: 520, vy: 0, r: 22, dmg: 6 * mult, pierce: true, kind: 'vortex', t: 0 });
      Sound.play('vortex'); return;
    }
    const topic = p.onTopic > 0, cost = topic ? 0 : m.tokenCost;
    if (p.tokens < cost) { // dry fire: the gun sputters a grey puff and the empty token bar blinks
      if (Math.random() < 0.15) addText(p.x, p.y - 50, 'TOKEN LIMIT!', '#ff6b6b');
      for (let i = 0; i < 5; i++) G.particles.push({ x: p.x + p.w * 0.45, y: p.y + 4, vx: rand(20, 70), vy: rand(-40, 10), life: rand(0.4, 0.7), t: 0, color: 'rgba(170,180,195,0.8)', size: rand(3, 6) });
      G.hud.tokEmpty = 0.5; Sound.play('denied'); p.fireCd = 0.25; return;
    }
    p.tokens -= cost;
    if (m.misfire && Math.random() < m.misfire) { // HOTFIX STRAIGHT TO PROD: the shot blows up in the tube
      p.fireCd = 0.35; burst(p.x + p.w * 0.45, p.y, '#ff8a3d', 14, 200); Sound.play('denied');
      drainFunding(5, 'MISFIRE! -5 funding'); return;
    }
    p.fireCd = c.fireRate * (topic ? TOPIC_FIRE : 1);
    const angles = p.opus > 0 ? [-0.22, 0, 0.22] : [0];
    for (const a of angles) G.bullets.push({ x: p.x + p.w * 0.45, y: p.y + 4, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 5, dmg: c.bulletDmg * mult, pierce: false, kind: topic ? 'topic' : p.opus > 0 ? 'opus' : 'token', t: 0, homing: topic, pierceLeft: topic ? 1 : 0 });
    Sound.play('shoot');
  }
  // Turn a homing shot toward the nearest living enemy it has not hit yet, keeping its speed.
  function waveRadius(wv) { const k = clamp(wv.t / WAVE_TIME, 0, 1); return WAVE_REACH * (1 - (1 - k) ** 2); } // eases out: a steady, heavy push
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
  function useSpecial() {
    const p = G.player, c = G.char, s = c.special;
    if (p.specialCd > 0 || p.tokens < s.cost) { Sound.play('denied'); addText(p.x, p.y - 50, p.specialCd > 0 ? 'COOLDOWN' : 'NOT ENOUGH TOKENS', '#ff6b6b'); return; }
    p.tokens -= s.cost; p.specialCd = s.cooldown * G.mods.specialCd;
    Sound.play('special');
    if (c.key === 'thomas') {
      G.wave = { x: p.x, y: p.y, t: 0, hit: new Set() }; // damage lands as the wave front reaches each enemy
      p.funding = Math.min(p.maxFunding, p.funding + 30);
      addText(p.x, p.y - 60, 'FUNDRAISE! +30 funding', '#5cff5c');
    } else if (c.key === 'robert') {
      p.deep = s.duration; G.ripple = { x: p.x, y: p.y, t: 0 };
      addText(p.x, p.y - 60, 'DEEP THOUGHT...', c.color);
    } else {
      p.onTopic = s.duration;
      addText(p.x, p.y - 60, 'STAY ON TOPIC!', c.color);
    }
  }
  function addText(x, y, text, color, big) { G.texts.push({ x, y, text, color, t: 0, life: 1.4, big }); }
  function addScore(n) { const s = Math.round(n * (G.riskMult || 1)); G.score += s; return s; } // risk level multiplies every score gain
  // Funding loss without the hit reaction (no invulnerability window): misfires, burn rate, outage drain.
  function drainFunding(amount, message) {
    const p = G.player;
    if (GOD || state !== 'play') return;
    p.funding -= amount;
    if (message) addText(p.x, p.y - 55, message, '#ff6b6b');
    if (p.funding <= 0) { p.funding = 0; endRun(false); burst(p.x, p.y, '#ffb300', 60, 300); }
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(speed * 0.3, speed); G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), t: 0, color, size: rand(3, 7) }); }
  }
  function damageEnemy(e, dmg, silent) {
    if (e.type === 'mdr') dmg *= mdrGuard(e); // MDR only takes full damage while distracted by its own paperwork
    e.hp -= dmg; e.flash = 0.08;
    if (!silent) Sound.play('hit');
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; G.kills++;
      addText(e.x, e.y - e.h / 2, '+' + addScore(e.d.score), '#ffe066');
      burst(e.x, e.y, '#ffb347', e.d.boss ? 90 : 18, e.d.boss ? 400 : 220);
      burst(e.x, e.y, '#ff5c5c', e.d.boss ? 60 : 10, e.d.boss ? 300 : 160);
      if (e.d.boss) {
        Sound.play('bigExplode'); shake = 0.8; flash = 0.5; G.slowmo = SLOWMO_TIME; G.focus = { x: e.x, y: e.y };
        G.bossDefeated[e.type] = true; G.boss = null; G.beams = [];
        if (e.type === 'mdr') {
          for (const o of G.enemies) if (!o.d.boss && !o.dead) { o.dead = true; burst(o.x, o.y, '#ffb347', 12, 200); }
          spawnPickup(e.x - 60, e.y, 'mdrcert'); spawnPickup(e.x + 10, e.y - 50, 'funding'); spawnPickup(e.x + 10, e.y + 50, 'tokens');
        } else {
          for (let i = 0; i < 3; i++) spawnPickup(e.x - 60 + i * 60, e.y, ['funding', 'tokens', 'opus6'][i]);
        }
        if (e.type === 'scarlet') G.winAt = G.time + 1.5; // let the explosion play; paused time does not count
        else G.banner = { title: 'AUDIT PASSED', sub: 'Descending further...', t: 2.5 };
      } else {
        Sound.play('explode'); shake = Math.max(shake, 0.12);
        if (Math.random() < 0.22) spawnPickup(e.x, e.y);
      }
    }
  }
  const BLOOD = '#b0101a';
  function makeDrips() {
    const n = 7 + Math.floor(Math.random() * 4);
    return Array.from({ length: n }, () => ({ fx: rand(0.05, 0.95), w: rand(3, 6), max: rand(25, 90), speed: rand(25, 60) }));
  }
  function makeConfetti() {
    const colors = [...PILOTS.map(k => CHARACTERS[k].color), '#5cff5c', '#ffffff'];
    return Array.from({ length: 120 }, () => ({ x: rand(0, W), y0: rand(-H, -10), vy: rand(60, 140), sway: rand(10, 40), f: rand(1, 3), spin: rand(2, 8), size: rand(5, 9), color: pick(colors) }));
  }
  // The single way a run ends: freezes play and stamps the time the end screen animates from.
  function endRun(win) {
    state = win ? 'win' : 'gameover'; G.endAt = elapsed;
    Sound.stopMusic(); Sound.play(win ? 'win' : 'gameover');
    G.drips = win ? [] : makeDrips();
    G.confetti = win ? makeConfetti() : [];
  }
  // HUD bar geometry, shared by the bars and the effects that fly into or fall off them.
  const HUD_BARS = { funding: { x: 16, y: 22, w: 220, h: 12 }, tokens: { x: 262, y: 22, w: 220, h: 12 } };
  const barFrac = (k) => k === 'funding' ? G.player.funding / G.player.maxFunding : G.player.tokens / G.player.maxTokens;
  // Money leaving the company: € bills flutter off the sub and a chunk breaks off the funding bar.
  function fundingLossFx(amount, prevFrac) {
    const p = G.player, n = clamp(Math.round(amount / 5), 2, 7);
    for (let i = 0; i < n; i++) G.bills.push({ x: p.x + rand(-p.w, p.w) * 0.25, y: p.y - p.h * 0.2, vx: rand(-90, 60), vy: rand(-160, -60), rot: rand(0, 6.28), vr: rand(-6, 6), ph: rand(0, 6.28), t: 0, life: rand(1.0, 1.5) });
    G.hud.chunk = { from: prevFrac, to: barFrac('funding'), t: 0 };
  }
  // Something good arriving: a glowing orb flies from the sub into its HUD bar, which glows on arrival.
  function flyToBar(kind, color) {
    const p = G.player;
    G.fly.push({ kind, color, x: p.x, y: p.y, t: 0, life: 0.55 });
  }
  function hurtPlayer(amount, reason) {
    const p = G.player;
    if (p.invuln > 0 || p.shield > 0 || GOD) return;
    amount = Math.round(amount * G.mods.dmgTaken);
    const before = p.funding / p.maxFunding;
    p.funding -= amount; p.invuln = 1.0; shake = Math.max(shake, 0.25); flash = 0.25;
    fundingLossFx(amount, before);
    Sound.play('hurt');
    addText(p.x, p.y - 55, `-${amount} funding` + (reason ? ` (${reason})` : ''), '#ff6b6b');
    burst(p.x, p.y, '#ffb347', 12, 180);
    if (p.funding <= 0) { p.funding = 0; endRun(false); burst(p.x, p.y, '#ffb300', 60, 300); }
  }
  function applyPickup(k) {
    const p = G.player, def = POWERUPS[k], fundBefore = p.funding / p.maxFunding;
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
    addScore(50);
    addText(p.x, p.y - 60, def.text, def.color, true);
    Sound.play(k === 'opus6' || k === 'vortex3' || k === 'shield' || k === 'mdrcert' ? 'powerup' : 'pickup');
    burst(p.x, p.y, def.color, 16, 160);
    if (k === 'funding' || k === 'deal') flyToBar('funding', '#5cff5c');
    if (k === 'tokens' || k === 'credits') flyToBar('tokens', '#6ec6ff');
    if (k === 'credits') fundingLossFx(15, fundBefore);
  }

  // ------------------------------------------------------------ enemy bullets
  function fireEnemy(e) {
    const p = G.player, kind = e.d.bullet;
    const aim = Math.atan2(p.y - e.y, p.x - e.x);
    const push = (a, sp, k, r) => G.ebullets.push({ x: e.x - e.w * 0.3, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: k || kind, r: r || 7, hw: r || 7, hh: r || 7, t: 0, dmg: 10, src: e.type });
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
    const push = (x, y, a, sp, k, r, dmg) => G.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: k, r, hw: r, hh: r, t: 0, dmg: dmg || 12, src: b.type });
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
    if (G.winAt && G.time >= G.winAt) { endRun(true); return; }
    const wdt = p.deep > 0 ? dt * DEEP_SCALE : dt; // world time; player systems keep dt

    // depth & zones
    if (!G.boss) G.depth = Math.min(MAX_DEPTH, G.depth + DESCENT_RATE * wdt);
    G.scrollX += (G.boss ? 40 : SCROLL) * wdt;
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
    const slowed = G.hazards.some(h => h.kind === 'azure' && hitRect(p, h)) ? 0.55 : 1, spd = c.speed * G.mods.speed;
    p.vx = lerp(p.vx, ax * spd * slowed, 1 - Math.pow(0.001, dt));
    p.vy = lerp(p.vy, ay * spd * slowed, 1 - Math.pow(0.001, dt));
    p.x = clamp(p.x + p.vx * dt, p.w / 2 - 10, W - p.w / 2);
    p.y = clamp(p.y + p.vy * dt, p.h / 2, H - p.h / 2);
    updateTerrain(wdt);
    p.tilt = lerp(p.tilt, p.vy / spd * 0.18, 1 - Math.pow(0.01, dt));
    p.fireCd -= dt; p.invuln -= dt; p.shield -= dt; p.opus -= dt; p.vortex -= dt; p.deep -= dt; p.onTopic -= dt; p.specialCd -= dt;
    p.tokens = Math.min(p.maxTokens, p.tokens + c.tokenRegen * G.mods.tokenRegen * dt);
    if (G.mods.burn) drainFunding(G.mods.burn * dt); // OVERPROMISE: constant burn rate
    if (keys.Space) shoot();
    // azure drains tokens (or funding, with a single region): chips stream out of the sub and get swallowed by the cloud
    p.drain = Math.max(0, p.drain - dt);
    for (const h of G.hazards) if (h.kind === 'azure' && hitRect(p, h)) {
      const fund = G.mods.azureFunding, left = fund ? p.funding : p.tokens;
      if (left > 0) { p.drain = 0.25; h.gulp = 0.25; if (Math.random() < dt * 16) G.drain.push({ x: p.x + rand(-p.w, p.w) * 0.3, y: p.y + rand(-p.h, p.h) * 0.3, h, t: 0, life: rand(0.5, 0.8), wob: rand(-1, 1), color: fund ? '#5cff5c' : '#6ec6ff' }); }
      if (fund) { drainFunding(12 * dt); if (Math.random() < dt * 2) addText(p.x, p.y - 50, 'AZURE OUTAGE: funding draining', '#ff8080'); }
      else { p.tokens = Math.max(0, p.tokens - 25 * dt); if (Math.random() < dt * 2) addText(p.x, p.y - 50, 'AZURE OUTAGE: tokens draining', '#8fb3ff'); }
    }
    for (const d of G.drain) { d.t += dt; if (d.t >= d.life) d.dead = true; }
    for (const q of G.bills) { q.t += dt; q.vy += 140 * dt; q.vx *= 0.98; q.x += (q.vx + Math.sin(q.t * 9 + q.ph) * 45) * dt; q.y += q.vy * dt; q.rot += q.vr * dt; if (q.t > q.life) q.dead = true; }
    for (const f of G.fly) { f.t += dt; if (f.t >= f.life) { f.dead = true; G.hud[f.kind === 'funding' ? 'fundGlow' : 'tokGlow'] = 0.5; } }
    const hd = G.hud; hd.fundGlow = Math.max(0, hd.fundGlow - dt); hd.tokGlow = Math.max(0, hd.tokGlow - dt); hd.tokEmpty = Math.max(0, hd.tokEmpty - dt);
    if (hd.chunk && (hd.chunk.t += dt) > 0.8) hd.chunk = null;
    if (G.ripple && (G.ripple.t += dt) > 1.4) G.ripple = null;
    G.letterbox = Math.max(0, G.letterbox - dt);

    // spawn enemies
    if (!zone.boss) {
      G.spawnT -= wdt;
      if (G.spawnT <= 0) {
        const interval = lerp(2.4, 0.9, difficulty);
        G.spawnT = interval * rand(0.7, 1.3);
        spawnEnemy(pickZoneEnemy(zone));
        if (difficulty > 0.35 && Math.random() < 0.3) spawnEnemy(pickZoneEnemy(zone));
      }
      G.hazardT -= wdt;
      if (G.hazardT <= 0) { G.hazardT = lerp(7, 3.5, difficulty) * rand(0.7, 1.3) / G.mods.hazardRate; spawnHazard(); }
    }
    G.pickupT -= wdt;
    if (G.pickupT <= 0) { G.pickupT = rand(8, 13) / G.mods.pickupRate; spawnPickup(W + 20); }

    // enemies
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
      if (!d.boss) { const y = keepInGap(e.x, e.hw, e.y, e.hh); if (y !== e.y) { if (d.move === 'zigzag') e.dir = y > e.y ? 1 : -1; e.y = y; } }
      if (d.boss) {
        if (e.type === 'mdr' && !e.entering) mdrThink(e, wdt);
        if (!e.entering) { e.shootT -= wdt; if (e.shootT <= 0) { const next = bossAttack(e); e.shootT = next || (e.hp < e.maxHp * 0.4 ? 1.1 : 1.6); } }
      } else if (d.shoot && e.x < W - 40 && e.x > 60) {
        e.shootT -= wdt; if (e.shootT <= 0) { e.shootT = d.shoot * rand(0.8, 1.2) * lerp(1.2, 0.8, difficulty); fireEnemy(e); }
      }
      if (e.x < -e.w) e.dead = true;
      if (!e.dead && hitRect(e, p)) { hurtPlayer((d.boss ? 20 : 15) * G.mods.enemyDmg[e.type], d.name); if (!d.boss) damageEnemy(e, 2); }
    }
    // bullets
    for (const b of G.bullets) {
      b.t += dt;
      if (b.homing) steer(b, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.homing) { (b.trail || (b.trail = [])).push(b.x, b.y); if (b.trail.length > 16) b.trail.splice(0, 2); } // last 8 positions
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
      if (b.dead) continue;
      const s = solidAt(b.x, b.y);
      if (s && s.kind === 'crate') {
        if (b.kind === 'vortex') { if (!b.hitSet) b.hitSet = new Set(); if (!b.hitSet.has(s)) { b.hitSet.add(s); damageBlock(s, b.dmg); } }
        else { b.dead = true; damageBlock(s, b.dmg); burst(b.x, b.y, '#ffe066', 4, 120); Sound.play('hit'); continue; }
      } else if (s && b.kind !== 'vortex') { b.dead = true; burst(b.x, b.y, '#cfd8e8', 3, 90); continue; }
      for (const h of G.hazards) if (h.kind === 'mine' && !h.dead && dist2(b.x, b.y, h.x, h.y) < (h.r + b.r) ** 2) { h.dead = true; b.dead = !b.pierce; burst(h.x, h.y, '#ff5c5c', 20, 220); Sound.play('explode'); addText(h.x, h.y, 'DEBT CLEARED +' + addScore(40), '#ffe066'); }
    }
    for (const b of G.ebullets) {
      b.t += wdt; b.x += b.vx * wdt; b.y += b.vy * wdt;
      if (b.x < -20 || b.x > W + 60 || b.y < -20 || b.y > H + 20) b.dead = true;
      if (!b.dead && solidAt(b.x, b.y)) { b.dead = true; burst(b.x, b.y, '#9aa3ad', 3, 80); continue; }
      if (!b.dead && hitRect(b, p)) { b.dead = true; if (p.shield > 0) burst(b.x, b.y, '#ffe066', 5, 100); else hurtPlayer(b.dmg * (G.mods.enemyDmg[b.src] || 1)); }
    }
    // conformity scan beams: telegraph, then sweep left draining tokens
    for (const bm of G.beams) {
      bm.t += wdt;
      if (bm.warm > 0) { bm.warm -= wdt; continue; }
      bm.x -= bm.speed * wdt;
      if (bm.x < -bm.w) bm.dead = true;
      if (Math.abs(bm.x - p.x) < bm.w / 2 + p.hw) {
        p.tokens = Math.max(0, p.tokens - 45 * dt);
        if (!bm.said) { bm.said = true; addText(p.x, p.y - 50, 'SCANNED: tokens draining', '#ff9b9b'); Sound.play('denied'); }
      }
    }
    // hazards
    for (const h of G.hazards) {
      h.t += wdt; h.x += h.vx * wdt; if (h.gulp) h.gulp = Math.max(0, h.gulp - dt);
      h.y = keepInGap(h.x, h.hw, h.y, h.hh);
      if (h.kind === 'mine' && G.mods.homingMines) h.y += clamp(p.y - h.y, -110 * wdt, 110 * wdt); // NO SECURITY: mines seek you
      if (h.kind === 'mine') { h.y += Math.sin(h.t * 2) * 20 * wdt; if (hitRect(h, p)) { h.dead = true; burst(h.x, h.y, '#ff5c5c', 24, 240); hurtPlayer(20, 'tech debt'); } }
      if (h.x < -120) h.dead = true;
    }
    // pickups
    for (const k of G.pickups) {
      k.t += wdt; k.x += k.vx * wdt; k.y += Math.sin(k.t * 3) * 25 * wdt;
      k.y = lerp(k.y, safeY(k.x, k.hw, k.y, k.hh), 1 - Math.pow(1e-6, dt));
      if (k.x < -30) k.dead = true;
      if (hitRect(k, p)) { k.dead = true; applyPickup(k.kind); }
    }
    // pitch wave
    if (G.wave) {
      const wv = G.wave; wv.t += dt;
      const r = waveRadius(wv), r2 = r * r;
      for (const e of G.enemies) if (!e.dead && !wv.hit.has(e) && dist2(e.x, e.y, wv.x, wv.y) < r2) { wv.hit.add(e); damageEnemy(e, e.d.boss ? 6 : 3, true); burst(e.x, e.y, '#5cff5c', 10, 160); }
      for (const b of G.ebullets) if (dist2(b.x, b.y, wv.x, wv.y) < r2) b.dead = true;
      for (const b of G.blocks) if (b.kind === 'crate' && !b.dead && !wv.hit.has(b) && dist2(b.wx - G.scrollX, b.y, wv.x, wv.y) < r2) { wv.hit.add(b); damageBlock(b, 3); }
      if (wv.t > WAVE_TIME) G.wave = null;
    }
    // particles / texts / bubbles
    for (const q of G.particles) { q.t += wdt; q.x += q.vx * wdt; q.y += q.vy * wdt; q.vx *= 0.96; q.vy *= 0.96; if (q.t > q.life) q.dead = true; }
    for (const t of G.texts) { t.t += dt; t.y -= 30 * dt; if (t.t > t.life) t.dead = true; }
    for (const b of G.bubbles) { b.y -= b.s * wdt; b.x -= 20 * wdt; if (b.y < -10) { b.y = H + 10; b.x = rand(0, W); } if (b.x < -10) b.x = W + 10; }
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
    G.drain = G.drain.filter(d => !d.dead); G.bills = G.bills.filter(q => !q.dead); G.fly = G.fly.filter(f => !f.dead);
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
    drawGear(p, c);
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
  // Pilot-specific gear bolted onto the sub (Veerle's scalpel). Follows the sub's tilt.
  function drawGear(p, c) {
    const g = c.gear, art = g && GEAR[g.art];
    if (!art) return;
    const px = p.w * g.px, rw = art.rows[0].length * px, rh = art.rows.length * px;
    ctx.save(); ctx.translate(p.x, p.y); if (p.tilt) ctx.rotate(p.tilt);
    ctx.translate(g.x * p.w - rw / 2, g.y * p.w - rh / 2);
    art.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') { ctx.fillStyle = art.pal[row[i]]; ctx.fillRect(i * px, j * px, px + 0.5, px + 0.5); } });
    ctx.restore();
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
      } else if (b.kind === 'topic') {
        if (b.trail) { ctx.save(); ctx.strokeStyle = CHARACTERS.veerle.color; ctx.lineCap = 'round'; for (let i = 2; i < b.trail.length; i += 2) { ctx.globalAlpha = 0.5 * i / b.trail.length; ctx.lineWidth = 1 + 3 * i / b.trail.length; ctx.beginPath(); ctx.moveTo(b.trail[i - 2], b.trail[i - 1]); ctx.lineTo(b.trail[i], b.trail[i + 1]); ctx.stroke(); } ctx.restore(); }
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = CHARACTERS.veerle.color; ctx.fillRect(-8, -3, 16, 6);
        ctx.fillStyle = '#fff'; ctx.fillRect(-2, -2, 6, 4);
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
        if (h.gulp > 0) { const g = 1 + 0.07 * Math.sin(elapsed * 22); ctx.scale(g, 2 - g); } // swallowing wobble
        ctx.fillStyle = 'rgba(80,120,220,0.55)'; puff(-35, 0, 30); puff(0, -12, 38); puff(35, 0, 30); puff(0, 14, 32);
        ctx.fillStyle = 'rgba(140,180,255,0.6)'; puff(-30, -4, 22); puff(5, -16, 26); puff(32, -2, 20);
        text('!', 0, -8, 22, '#ff3b3b', 'center'); text('AZURE OUTAGE', 0, 32, 7, '#dfe8ff', 'center');
      }
      ctx.restore();
    }
  }
  function poly(pts, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); ctx.fill();
  }
  function drawTerrain() {
    const c = G.cols;
    for (let i = 0; i < c.length - 1; i++) {
      const a = c[i], b = c[i + 1], x0 = a.wx - G.scrollX, x1 = b.wx - G.scrollX + 0.5, th = a.th;
      if (x1 < 0 || x0 > W) continue;
      if (a.top > -20 || b.top > -20) {
        poly([x0, -1, x1, -1, x1, b.top, x0, a.top], th.wall);
        poly([x0, -1, x1, -1, x1, b.top - 14, x0, a.top - 14], th.inner);
        ctx.strokeStyle = th.edge; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, a.top); ctx.lineTo(x1, b.top); ctx.stroke();
      }
      poly([x0, a.bot, x1, b.bot, x1, H + 1, x0, H + 1], th.wall);
      poly([x0, a.bot + 14, x1, b.bot + 14, x1, H + 1, x0, H + 1], th.inner);
      ctx.strokeStyle = th.edge; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, a.bot); ctx.lineTo(x1, b.bot); ctx.stroke();
      // per-theme decoration, deterministic per column
      const s = a.seed, col = th.accent[Math.floor(s * 97) % th.accent.length];
      if (th.key === 'reef') {
        if (s < 0.45) { ctx.fillStyle = col; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x0 + 4 + k * 7, a.bot + 3 - k % 2 * 3, 4 + (s * 10 + k) % 4, 0, 6.283); ctx.fill(); } }
        else if (s > 0.8) { ctx.strokeStyle = 'rgba(80,190,110,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + 12, a.bot); for (let k = 1; k <= 4; k++) ctx.lineTo(x0 + 12 + Math.sin(elapsed * 2 + s * 9 + k) * 4, a.bot - k * 5); ctx.stroke(); }
      } else if (th.key === 'wreck') {
        ctx.fillStyle = col; if (s < 0.5) { ctx.fillRect(x0 + 8, a.bot + 7, 4, 4); if (a.top > 0) ctx.fillRect(x0 + 8, a.top - 11, 4, 4); }
      } else if (th.key === 'cave') {
        if (s < 0.3 && a.top > 0) { ctx.fillStyle = col; ctx.fillRect(x0 + 10, a.top + 2 + (elapsed * 30 + s * 200) % 40, 2, 4); }
      } else if (th.key === 'trench' && s < 0.5) {
        ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(elapsed * 3 + s * 20); ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, a.bot + 6); ctx.lineTo(x0 + 10, a.bot + 12); ctx.lineTo(x1, b.bot + 8); ctx.stroke();
        if (a.top > 0) { ctx.beginPath(); ctx.moveTo(x0, a.top - 6); ctx.lineTo(x0 + 12, a.top - 12); ctx.lineTo(x1, b.top - 7); ctx.stroke(); }
        ctx.restore();
      }
    }
    for (const b of G.blocks) {
      const x = b.wx - G.scrollX, th = b.th;
      if (b.kind === 'vent' || x < -b.hw || x > W + b.hw) continue;
      if (b.kind === 'rock') {
        ctx.fillStyle = th.wall; ctx.strokeStyle = th.edge; ctx.lineWidth = 3; ctx.beginPath();
        b.pts.forEach((r, k) => { const an = k / b.pts.length * 6.283; ctx.lineTo(x + Math.cos(an) * b.hw * r, b.y + Math.sin(an) * b.hh * r); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = th.inner; ctx.beginPath(); ctx.ellipse(x + b.hw * 0.15, b.y + b.hh * 0.2, b.hw * 0.45, b.hh * 0.4, 0, 0, 6.283); ctx.fill();
        continue;
      }
      drawCrate(b, x);
    }
  }
  function drawCrate(b, x) {
    const l = x - b.hw, t = b.y - b.hh, w = b.hw * 2, h = b.hh * 2;
    switch (b.th.key) {
      case 'reef': // pile of tickets
        for (let yy = t; yy < t + h - 2; yy += 9) { ctx.fillStyle = '#f1efe6'; ctx.fillRect(l + (yy % 3), yy, w - 2, 8); ctx.fillStyle = '#4a6bd6'; ctx.fillRect(l + 6, yy + 3, w - 16, 2); }
        break;
      case 'wreck': // filing cabinet
        ctx.fillStyle = '#8f98a3'; ctx.fillRect(l, t, w, h);
        for (let yy = t + 4; yy < t + h - 10; yy += 26) { ctx.fillStyle = '#6b7380'; ctx.fillRect(l + 4, yy, w - 8, 22); ctx.fillStyle = '#d9dee5'; ctx.fillRect(x - 8, yy + 9, 16, 4); }
        break;
      case 'cave': // box wrapped in red tape
        ctx.fillStyle = '#8a5a3a'; ctx.fillRect(l, t, w, h);
        ctx.fillStyle = '#d0142c'; ctx.fillRect(x - 5, t, 10, h); ctx.fillRect(l, b.y - 5, w, 10);
        break;
      default: // legacy server rack
        ctx.fillStyle = '#1f2430'; ctx.fillRect(l, t, w, h); ctx.fillStyle = '#3a4152';
        for (let yy = t + 4; yy < t + h - 8; yy += 12) {
          ctx.fillStyle = '#3a4152'; ctx.fillRect(l + 4, yy, w - 8, 8);
          ctx.fillStyle = Math.floor(elapsed * 3 + yy) % 3 ? '#39e67a' : '#ff3b3b'; ctx.fillRect(l + w - 12, yy + 2, 4, 4);
        }
    }
    ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 2; ctx.strokeRect(l, t, w, h);
    if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(l, t, w, h); }
    text(b.th.box.label, x, b.y, 7, '#fff', 'center');
    if (b.hp < b.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 22, t - 8, 44, 5);
      ctx.fillStyle = '#ffb347'; ctx.fillRect(x - 22, t - 8, 44 * b.hp / b.maxHp, 5);
    }
  }
  // "Burn rate" vents: rumble, then erupt; drawn above the darkness so they always read as a warning.
  function drawVents() {
    for (const v of G.blocks) {
      const x = v.wx - G.scrollX;
      if (v.kind !== 'vent' || x < -40 || x > W + 40) continue;
      const c = ventCycle(v), h = ventHeight(v), warn = c >= 1.8 && c < 2.5;
      if (h > 0) {
        const grd = ctx.createLinearGradient(0, v.y, 0, v.y - h);
        grd.addColorStop(0, 'rgba(255,200,80,0.95)'); grd.addColorStop(1, 'rgba(255,90,31,0.15)');
        ctx.fillStyle = grd;
        for (let yy = 0; yy < h; yy += 8) { const wob = Math.sin(elapsed * 20 + yy * 0.3) * 4; ctx.fillRect(x - v.hw + wob, v.y - yy - 8, v.hw * 2, 8); }
      } else if (warn) {
        ctx.fillStyle = 'rgba(255,180,100,0.7)';
        for (let k = 0; k < 5; k++) { const yy = ((elapsed * 90 + k * 23) % 60); ctx.beginPath(); ctx.arc(x + Math.sin(k * 2 + elapsed * 6) * 8, v.y - 10 - yy, 3, 0, 6.283); ctx.fill(); }
      }
      poly([x - 22, v.y + 4, x - 14, v.y - 16, x + 14, v.y - 16, x + 22, v.y + 4], '#2a2224');
      ctx.fillStyle = warn || h > 0 ? '#ff5a1f' : '#7a3a1a'; ctx.fillRect(x - 14, v.y - 18, 28, 4);
      if (h === 0) text('BURN RATE', x, v.y - 28, 6, '#ffb347', 'center');
    }
  }
  const darkCv = document.createElement('canvas'); darkCv.width = W; darkCv.height = H;
  const dctx = darkCv.getContext('2d');
  function drawDarkness() { // the abyss closes in, the sub's headlight cuts through
    const a = clamp((G.depth - 3000) / 800, 0, 1) * (G.boss ? 0.35 : 0.72);
    if (a < 0.01) return;
    const p = G.player;
    dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, W, H);
    dctx.fillStyle = `rgba(0,0,6,${a})`; dctx.fillRect(0, 0, W, H);
    dctx.globalCompositeOperation = 'destination-out';
    const grd = dctx.createRadialGradient(p.x + 80, p.y, 60, p.x + 80, p.y, 360);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = grd; dctx.fillRect(0, 0, W, H);
    ctx.drawImage(darkCv, 0, 0);
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
    for (const q of G.bills) { // € bills
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.t * 7)); ctx.globalAlpha = clamp(1.5 - q.t / q.life * 1.5, 0, 1);
      ctx.fillStyle = '#2e7d32'; ctx.fillRect(-9, -5, 18, 10); ctx.fillStyle = '#7ddc7f'; ctx.fillRect(-7, -3, 14, 6);
      ctx.fillStyle = '#1b4d1e'; ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
    if (G.ripple) { // DEEP THOUGHT: slow concentric rings spreading from Robert
      const rp = G.ripple; ctx.save(); ctx.strokeStyle = '#9fd4ff';
      for (let i = 0; i < 3; i++) { const k = clamp((rp.t - i * 0.25) / 1.1, 0, 1); if (k <= 0 || k >= 1) continue; ctx.globalAlpha = 0.6 * (1 - k); ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(rp.x, rp.y, 30 + k * 700, 0, 6.283); ctx.stroke(); }
      ctx.restore();
    }
    // token chips being sucked into an azure cloud: accelerate toward its centre on a curling path, shrinking
    for (const d of G.drain) {
      const k = clamp(d.t / d.life, 0, 1), e = k * k * k;
      const x = lerp(d.x, d.h.x, e) + Math.sin(k * Math.PI) * 26 * d.wob, y = lerp(d.y, d.h.y, e) - Math.sin(k * Math.PI) * 18;
      const r = 5 * (1 - 0.7 * k);
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#e6f6ff'; ctx.fillRect(x - r * 0.4, y - r * 0.6, r * 0.5, r * 0.5);
    }
    for (const q of G.particles) { ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    ctx.globalAlpha = 1;
    for (const t of G.texts) { ctx.globalAlpha = clamp(1 - (t.t / t.life - 0.6) / 0.4, 0, 1); text(t.text, t.x, t.y, t.big ? 12 : 9, t.color, 'center'); }
    ctx.globalAlpha = 1;
    if (G.wave) { const wv = G.wave, r = waveRadius(wv), a = 1 - wv.t / WAVE_TIME; ctx.save(); ctx.strokeStyle = '#5cff5c'; ctx.globalAlpha = a; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(wv.x, wv.y, r, -1.1, 1.1); ctx.stroke(); ctx.globalAlpha = a * 0.35; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(wv.x, wv.y, r * 0.8, -1.1, 1.1); ctx.stroke(); ctx.restore(); }
  }
  function drawHUD() {
    const p = G.player, c = G.char;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, 46);
    bar(16, 22, 220, 12, p.funding / p.maxFunding, p.funding < p.maxFunding * 0.3 ? '#ff5c5c' : '#5cff5c', 'FUNDING (HP)', `${Math.ceil(p.funding)}/${p.maxFunding}`);
    bar(262, 22, 220, 12, p.tokens / p.maxTokens, '#6ec6ff', 'TOKEN LIMIT (MANA)', `${Math.floor(p.tokens)}/${p.maxTokens}`);
    const hd = G.hud, outline = (b, color, alpha) => { ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.restore(); };
    if ((p.drain > 0 || hd.tokEmpty > 0) && Math.floor(elapsed * 10) % 2 === 0) outline(HUD_BARS.tokens, '#ff5c5c', 1);
    if (hd.fundGlow > 0) outline(HUD_BARS.funding, '#5cff5c', hd.fundGlow * 2);
    if (hd.tokGlow > 0) outline(HUD_BARS.tokens, '#6ec6ff', hd.tokGlow * 2);
    if (hd.chunk) { // the lost slice of the funding bar breaks off and drops
      const b = HUD_BARS.funding, k = hd.chunk.t / 0.8, x = b.x + b.w * clamp(hd.chunk.to, 0, 1), w = b.w * Math.max(0, hd.chunk.from - hd.chunk.to);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(x + w / 2, b.y + b.h / 2 + k * k * 60); ctx.rotate(k * 0.6); ctx.fillStyle = '#ff5c5c'; ctx.fillRect(-w / 2, -b.h / 2, w, b.h); ctx.restore();
    }
    for (const f of G.fly) { // pickups flying into their bar
      const b = HUD_BARS[f.kind], k = f.t / f.life, e = k * k, tx = b.x + b.w * clamp(barFrac(f.kind), 0, 1), ty = b.y + b.h / 2;
      const x = lerp(f.x, tx, e), y = lerp(f.y, ty, e) - Math.sin(k * Math.PI) * 60;
      ctx.save(); ctx.fillStyle = f.color; ctx.shadowColor = f.color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, 7 - 3 * k, 0, 6.283); ctx.fill(); ctx.restore();
    }
    // special
    const sp = c.special, ready = p.specialCd <= 0 && p.tokens >= sp.cost;
    bar(508, 22, 200, 12, p.specialCd > 0 ? 1 - p.specialCd / sp.cooldown : 1, ready ? c.color : '#777', `SHIFT: ${sp.name}`, ready ? 'READY' : p.specialCd > 0 ? `${Math.ceil(p.specialCd)}s` : `${sp.cost} TOK`);
    text(`SCORE ${G.score}`, W - 16, 14, 10, '#ffe066', 'right');
    text(`DEPTH ${Math.floor(G.depth)}m`, W - 16, 32, 10, '#cfe3ff', 'right');
    // active buffs
    let bx = 16, by = 60;
    const buffs = [['OPUS 6', p.opus, POWERUPS.opus6.color], ['VORTEX 3', p.vortex, POWERUPS.vortex3.color], ['INVINCIBLE', p.shield, POWERUPS.shield.color], ['DEEP THOUGHT', p.deep, CHARACTERS.robert.color], ['STAY ON TOPIC', p.onTopic, CHARACTERS.veerle.color]];
    for (const [n, t, col] of buffs) if (t > 0) { text(`${n} ${Math.ceil(t)}s`, bx, by, 8, col, 'left'); by += 14; }
    if (p.certified) { text('MDR CERTIFIED +25% DMG', bx, by, 8, POWERUPS.mdrcert.color, 'left'); by += 14; }
    if (G.risks.length) { const lvl = riskLevel(G.risks.length); text(`${lvl.name} x${lvl.mult}: ${G.risks.map(r => r.tag).join(' / ')}`, bx, by, 7, lvl.color, 'left'); by += 14; }
    if (G.mods.burn) { text(`BURN RATE -${G.mods.burn}/s`, bx, by, 7, '#ff8080', 'left'); by += 14; }
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
    PILOTS.forEach((key, i) => {
      const c = CHARACTERS[key], cx = 160 + i * 320, sel = selected === key;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.35)'; ctx.fillRect(cx - 150, 150, 300, 295);
      if (sel) { ctx.strokeStyle = c.color; ctx.lineWidth = 4; ctx.strokeRect(cx - 150, 150, 300, 295); }
      // pilot portrait (pixel-art headshot) on the left, their sub on the right
      const px = cx - 80, py = 222, ps = 96;
      ctx.fillStyle = '#0a1a4a'; ctx.fillRect(px - ps / 2, py - ps / 2, ps, ps);
      ctx.save(); ctx.beginPath(); ctx.rect(px - ps / 2, py - ps / 2, ps, ps); ctx.clip(); // keep the aspect ratio, crop to the square
      const ph = spriteH(c.portrait, ps); drawSprite(c.portrait, px, py - ps / 2 + ph / 2, ps, ph); ctx.restore();
      ctx.strokeStyle = sel ? c.color : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.strokeRect(px - ps / 2, py - ps / 2, ps, ps);
      const sw = c.width * 0.7;
      const sy = 222 + Math.sin(elapsed * 2 + (sel ? 0 : 1)) * 5;
      drawSprite(c.sprite, cx + 70, sy, sw, spriteH(c.sprite, sw));
      drawGear({ x: cx + 70, y: sy, w: sw }, c);
      text(`${c.name} (${c.title})`, cx, 300, 13, c.color, 'center');
      c.blurb.forEach((l, j) => text(l, cx, 322 + j * 14, 8, '#dfe8ff', 'center'));
      text(`FUNDING ${c.funding}  TOKENS ${c.tokens}  SPEED ${c.speed}`, cx, 372, 7, '#9fc3ff', 'center');
      text(`SPECIAL: ${c.special.name}`, cx, 392, 9, '#ffe066', 'center');
      c.special.desc.forEach((l, j) => text(l, cx, 408 + j * 11, 7, '#dfe8ff', 'center'));
    });
    if (Math.floor(elapsed * 2) % 2 === 0) text('PRESS ENTER TO CONTINUE', W / 2, 468, 12, '#fff', 'center');
    text('Left/Right to choose  ·  Shoot: Space  ·  Special: Shift  ·  Enemies fire back, hazards drain you, walls scrape the hull.', W / 2, 495, 7, '#9fc3ff', 'center');
    text('Funding = HP. Tokens = ammo (they regenerate). Run out of funding and it is game over.', W / 2, 512, 7, '#9fc3ff', 'center');
  }

  // Second title step: pick the corners to cut before diving.
  function drawRisks() {
    drawBackground(0.25, elapsed * 25, 1);
    text('CUT CORNERS?', W / 2, 40, 22, '#ffb300', 'center');
    text('Every shortcut makes Kaiko stronger, the ocean deadlier, and the score bigger.', W / 2, 70, 8, '#cfe3ff', 'center');
    const x0 = 90, w = W - 2 * x0;
    RISKS.forEach((r, i) => {
      const y = RISK_Y0 + i * RISK_ROW, on = riskSel.has(r.key), cur = i === riskCursor;
      ctx.fillStyle = cur ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.35)'; ctx.fillRect(x0 - 10, y - 18, w + 20, RISK_ROW - 4);
      if (cur) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 10, y - 18, w + 20, RISK_ROW - 4); }
      text(`[${on ? 'X' : ' '}]`, x0, y - 4, 12, on ? '#5cff5c' : '#9fc3ff', 'left');
      text(r.label, x0 + 50, y - 6, 10, on ? '#fff' : '#dfe8ff', 'left');
      text('+ ' + r.up, x0 + 50, y + 10, 7, '#5cff5c', 'left');
      text('- ' + r.down, x0 + 400, y + 10, 7, '#ff8080', 'left');
    });
    const lvl = riskLevel(riskSel.size), c = CHARACTERS[selected];
    text(`RISK LEVEL: ${lvl.name}   ·   SCORE x${lvl.mult}`, W / 2, 432, 12, lvl.color, 'center');
    text(`PILOT: ${c.name} (${c.title})`, W / 2, 454, 8, c.color, 'center');
    if (Math.floor(elapsed * 2) % 2 === 0) text('ENTER: DIVE', W / 2, 486, 12, '#fff', 'center');
    text('Up/Down or click to move  ·  Space or 1-7 to toggle  ·  Esc: back to pilots', W / 2, 512, 7, '#9fc3ff', 'center');
  }

  function drawRunStats(y) {
    text(`SCORE ${G.score}`, W / 2, y, 16, '#ffe066', 'center');
    text(`DEPTH REACHED ${Math.floor(G.depth)}m   ·   ENEMIES DEFEATED ${G.kills}   ·   TIME ${Math.floor(G.time)}s`, W / 2, y + 33, 8, '#cfe3ff', 'center');
    if (G.risks.length) { const lvl = riskLevel(G.risks.length); text(`CORNERS CUT (${lvl.name}, score x${lvl.mult}): ${G.risks.map(r => r.tag).join(', ')}`, W / 2, y + 50, 7, lvl.color, 'center'); }
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
    // the cause of death, spelled out: big headline plus an empty funding bar
    ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6);
    text('YOU RAN OUT OF FUNDING', W / 2, H / 2 - 18, 24, '#ffffff', 'center');
    ctx.restore();
    bar(W / 2 - 160, H / 2 + 14, 320, 12, 0, '#ff5c5c', 'FUNDING', `0/${G.player.maxFunding}`);
    text('before you could solve healthcare.', W / 2, H / 2 + 44, 10, '#ffb3b3', 'center');
    drawRunStats(H / 2 + 72);
    drawEndPrompt(H / 2 + 135, 'RETRY');
  }
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
    drawGear(sub, c);
    text('CONGRATULATIONS!', W / 2, H / 2 - 62, 26, '#5cff5c', 'center');
    text("You've solved healthcare.", W / 2, H / 2 - 28, 12, '#fff', 'center');
    text('Kaiko is now deployed in every hospital in the EU,', W / 2, H / 2 - 4, 9, '#dfe8ff', 'center');
    text('helping a million clinicians treat millions of patients.', W / 2, H / 2 + 12, 9, '#dfe8ff', 'center');
    text('SCARLET signed off. CE mark obtained.', W / 2, H / 2 + 34, 8, '#9fc3ff', 'center');
    drawRunStats(H / 2 + 65);
    drawEndPrompt(H / 2 + 130, 'PLAY AGAIN');
  }
  function drawEnd(win) {
    ctx.fillStyle = win ? 'rgba(0,40,20,0.75)' : 'rgba(40,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    if (win) drawVictory(); else drawCouldnt();
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 14);
    if (state === 'title') { drawTitle(); ctx.restore(); return; }
    if (state === 'risks') { drawRisks(); ctx.restore(); return; }
    ctx.save();
    if (G.slowmo > 0 && G.focus) { const z = 1 + 0.12 * Math.sin(Math.PI * G.slowmo / SLOWMO_TIME); ctx.translate(G.focus.x, G.focus.y); ctx.scale(z, z); ctx.translate(-G.focus.x, -G.focus.y); } // push in on the boss kill
    drawBackground(clamp(G.depth / MAX_DEPTH, 0, 1), G.scrollX, 1);
    drawBubbles();
    drawTerrain();
    drawHazards();
    drawBeams();
    drawEnemies();
    drawDarkness();
    drawVents();
    drawPickups();
    if (state !== 'gameover') drawPlayer();
    drawBullets();
    drawEffects();
    ctx.restore();
    if (G.letterbox > 0) { const k = Math.min(1, G.letterbox * 2, (LETTERBOX_TIME - G.letterbox) * 4), bh = 48 * k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh); } // boss entrance
    if (flash > 0) { ctx.fillStyle = `rgba(255,80,80,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    if (G.player.deep > 0 && (state === 'play' || state === 'paused')) { ctx.fillStyle = 'rgba(70,130,255,0.14)'; ctx.fillRect(0, 0, W, H); }
    drawHUD();
    if (state === 'paused') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); text('PAUSED', W / 2, H / 2 - 10, 24, '#fff', 'center'); text('Press P to resume', W / 2, H / 2 + 25, 10, '#cfe3ff', 'center'); }
    if (state === 'gameover') drawEnd(false);
    if (state === 'win') drawEnd(true);
    ctx.restore();
  }

  // ------------------------------------------------------------ loop
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0); lastTime = ts;
    const slow = G.slowmo > 0 && state === 'play'; // boss kill slow motion runs on real time
    if (G.slowmo > 0) G.slowmo -= dt;
    for (let i = 0; i < TURBO; i++) update(slow ? dt * SLOWMO_SCALE : dt); render();
    requestAnimationFrame(frame);
  }
  ctx.fillStyle = '#0a1a4a'; ctx.fillRect(0, 0, W, H);
  text('LOADING...', W / 2, H / 2, 14, '#fff', 'center');
  // Debug/testing hooks: ?pilot=thomas|robert|veerle&autostart=1&depth=2600&autofire=1&turbo=30&god=1&debug=1&risks=noeval,hotfix
  const Q = new URLSearchParams(location.search);
  TURBO = clamp(parseInt(Q.get('turbo') || '1', 10) || 1, 1, 200);
  GOD = !!Q.get('god');
  START_DEPTH = clamp(parseFloat(Q.get('depth')) || 0, 0, MAX_DEPTH);
  for (const k of (Q.get('risks') || '').split(',')) if (RISKS.some(r => r.key === k)) riskSel.add(k);
  if (Q.get('debug')) window.KAIKO = { G, CHARACTERS, get state() { return state; } };
  loadAssets(() => {
    if (Q.get('autostart')) {
      selected = CHARACTERS[Q.get('pilot')] ? Q.get('pilot') : selected;
      startGame();
      if (Q.get('autofire')) keys.Space = true;
    }
    requestAnimationFrame(frame);
  });
})();
