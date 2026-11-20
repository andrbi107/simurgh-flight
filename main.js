// ===== سیمرغ: پرواز به قاف — main.js =====
// Vanilla JS canvas game. No external libraries, fonts, or network calls.
// Persian RTL UI. The player is the Simurgh flying upward through the seven
// valleys of Attar's Conference of the Birds toward Mount Qaf.

(function () {
  'use strict';

  // ---------- Palette (Persian miniature) ----------
  const COL = {
    paper:'#F3E7CF', paperHi:'#FBF1D8', paperLo:'#E2CFA0',
    ink:'#1B1F3B', gold:'#C2912B', goldHi:'#E6C25A', goldLo:'#9C7220',
    lapis:'#1F3F8F', turquoise:'#2FA7A0', vermilion:'#D4442E',
    soft:'#5A5470', cloud:'#3A3F52', cloudHi:'#5A6078', cloudDark:'#23263A',
    white:'#FBF6E8'
  };

  // ---------- The seven valleys ----------
  const VALLEYS = [
    { name:'وادی اول: طلب',        accent:'#D98E4A' }, // Quest
    { name:'وادی دوم: عشق',        accent:'#D4442E' }, // Love
    { name:'وادی سوم: معرفت',      accent:'#1F3F8F' }, // Knowledge
    { name:'وادی چهارم: استغنا',   accent:'#2FA7A0' }, // Detachment
    { name:'وادی پنجم: توحید',     accent:'#C2912B' }, // Unity
    { name:'وادی ششم: حیرت',       accent:'#7C6BB0' }, // Bewilderment
    { name:'وادی هفتم: فقر و فنا', accent:'#1B1F3B' }  // Poverty & Annihilation
  ];
  const ENDLESS_NAME = 'پرواز بی‌پایان';

  // ---------- Tunable config ----------
  const CFG = {
    baseScroll: 86,            // px/s world scroll at valley 0
    scrollPerValley: 0.14,     // +14% per valley
    baseSpawn: 920,            // ms between spawns at valley 0
    spawnPerValley: 0.86,      // *0.86 per valley (denser)
    minSpawn: 240,
    spawnJitter: 0.35,
    valleyLen: 2300,           // distance (px) to clear a valley at valley 0
    valleyLenPerValley: 0.12,
    playerR: 13,
    bandTop: 0.44,             // vertical band the Simurgh can move in (fraction of H)
    bandBottom: 0.86,
    maxLives: 5, startLives: 3,
    invulnMs: 1300, driftMs: 680, blinkMs: 90,
    gemPenalty: 0.075, gemScore: 25, featherScoreMax: 12,
    companionScore: 50, companionTtl: 10000,
    feathersPerCompanion: 5, maxCompanions: 6,
    scoreRate: 0.08,           // distance -> score multiplier
    shakeMs: 380, shakeMag: 7,
    fallMs: 1400
  };

  // ---------- DOM refs ----------
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const elHud = $('hud'), elLives = $('lives'), elValley = $('valley'),
        elScore = $('score'), elPause = $('pause');
  const scrStart = $('screen-start'), scrPause = $('screen-pause'),
        scrOver = $('screen-over'), scrVictory = $('screen-victory');
  const elBestStart = $('best-start'), elScoreOver = $('score-over'),
        elBestOver = $('best-over'), elValleyOver = $('valley-over'),
        elScoreVictory = $('score-victory'), elBestVictory = $('best-victory');

  // ---------- Persian digits + best score persistence ----------
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fa = n => String(n).replace(/\d/g, d => FA[+d]);
  const BEST_KEY = 'simurgh.best';
  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) {}

  // ---------- Canvas sizing ----------
  let W = 0, H = 0, dpr = 1, scale = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(0.72, Math.min(1.5, W / 420));
    if (player) {
      player.x = clamp(player.x, CFG.playerR + 12, W - CFG.playerR - 24);
      player.y = clamp(player.y, H * CFG.bandTop, H * CFG.bandBottom);
    }
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function approach(cur, target, step) {
    if (cur < target) return Math.min(cur + step, target);
    return Math.max(cur - step, target);
  }

  // ---------- State ----------
  // state: start | playing | paused | falling | gameover | victory
  let state = 'start', victoried = false;
  let player = null, entities = [], companions = [], particles = [];
  let lives = CFG.startLives, score = 0, valleyIndex = 0, distValley = 0;
  let scrollSpeed = CFG.baseScroll, spawnInterval = CFG.baseSpawn, spawnTimer = 0;
  let feathersCollected = 0, shake = 0, fallT = 0, fallVy = 0, fallRot = 0;
  let featherStreak = 0, lastFeatherT = 0;           // v0.0.2 — feather-streak shield
  let lastT = performance.now(), runTime = 0, worldScroll = 0;
  let bgLayers = [], motes = [];

  function resetGame() {
    player = { x: W / 2, y: H * 0.72, vx: 0, vy: 0, invuln: 0, drift: 0, driftDir: 0, tilt: 0, flap: 0 };
    entities = []; companions = []; particles = [];
    lives = CFG.startLives; score = 0; valleyIndex = 0; distValley = 0;
    scrollSpeed = CFG.baseScroll; spawnInterval = CFG.baseSpawn; spawnTimer = 380;
    feathersCollected = 0; shake = 0; fallT = 0; fallVy = 0; fallRot = 0;
    featherStreak = 0; lastFeatherT = 0;              // v0.0.2 — reset streak
    victoried = false; runTime = 0;
    recomputeValley();
    updateHud();
  }

  function recomputeValley() {
    const v = valleyIndex;
    scrollSpeed = CFG.baseScroll * Math.pow(1 + CFG.scrollPerValley, v);
    spawnInterval = Math.max(CFG.minSpawn, CFG.baseSpawn * Math.pow(CFG.spawnPerValley, v));
  }
  function valleyLength() { return CFG.valleyLen * Math.pow(1 + CFG.valleyLenPerValley, valleyIndex); }
  function valleyName() { return valleyIndex < VALLEYS.length ? VALLEYS[valleyIndex].name : ENDLESS_NAME; }
  function valleyAccent() { return valleyIndex < VALLEYS.length ? VALLEYS[valleyIndex].accent : COL.gold; }

  // ---------- Background decoration (parallax) ----------
  function makeBg() {
    bgLayers = [];
    const palette = [COL.paperLo, '#D8C18C', '#C9AE7C'];
    for (let l = 0; l < 3; l++) {
      const peaks = [];
      const n = 6 + l;
      for (let i = 0; i < n; i++) peaks.push(0.5 + Math.random() * 0.5);
      bgLayers.push({ peaks, speed: 0.10 + l * 0.10, color: palette[l], alpha: 0.32 - l * 0.08, period: 0.55 + l * 0.18, hScale: 0.10 + l * 0.05 });
    }
    motes = [];
    for (let i = 0; i < 26; i++) {
      motes.push({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2, v: 0.25 + Math.random() * 0.9, a: 0.18 + Math.random() * 0.45 });
    }
  }

  // ---------- Input (touch + mouse + keyboard) ----------
  const keys = { left: false, right: false, up: false, down: false };
  const pointer = { active: false, x: 0, y: 0, type: 'mouse' };

  function setKey(code, down) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': keys.left = down; break;
      case 'ArrowRight': case 'KeyD': keys.right = down; break;
      case 'ArrowUp': case 'KeyW': keys.up = down; break;
      case 'ArrowDown': case 'KeyS': keys.down = down; break;
      case 'KeyP': case 'Escape': if (down) togglePause(); break;
      case 'Space':
        if (down && (state === 'start' || state === 'gameover' || state === 'victory')) startGame();
        break;
    }
  }
  addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].indexOf(e.code) !== -1) e.preventDefault();
    setKey(e.code, true);
  }, { passive: false });
  addEventListener('keyup', e => setKey(e.code, false));

  function pointerTarget() {
    const r = canvas.getBoundingClientRect();
    return { x: pointer.x - r.left, y: pointer.y - r.top };
  }
  canvas.addEventListener('pointerdown', e => {
    pointer.type = e.pointerType || 'mouse';
    pointer.active = true; pointer.x = e.clientX; pointer.y = e.clientY;
    if (e.cancelable) e.preventDefault();
    resumeAudio();
  });
  canvas.addEventListener('pointermove', e => {
    pointer.type = e.pointerType || 'mouse';
    if (e.pointerType === 'mouse') pointer.active = true;
    if (pointer.active) { pointer.x = e.clientX; pointer.y = e.clientY; }
  });
  canvas.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') pointer.active = false; });
  canvas.addEventListener('pointercancel', () => { pointer.active = false; });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointer.active = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- v0.0.3 — on-screen joystick (touch devices) ----------
  const coarsePointer = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  const joyEl = document.getElementById('joy');
  const joyKnob = joyEl ? joyEl.querySelector('.joy-knob') : null;
  const joy = { active: false, jx: 0, jy: 0, id: null, cx: 0, cy: 0, radius: 56 };
  function joyMove(e) {
    if (!joy.active || e.pointerId !== joy.id) return;
    var dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    var d = Math.hypot(dx, dy) || 1;
    var clamped = Math.min(d, joy.radius);
    joy.jx = (dx / d) * (clamped / joy.radius);
    joy.jy = (dy / d) * (clamped / joy.radius);
    if (joyKnob) joyKnob.style.transform = 'translate(' + (joy.jx * joy.radius) + 'px,' + (joy.jy * joy.radius) + 'px)';
  }
  function joyStart(e) {
    if (!coarsePointer || !joyEl) return;
    var r = joyEl.getBoundingClientRect();
    joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joy.radius = r.width / 2;
    joy.active = true; joy.id = e.pointerId;
    try { joyEl.setPointerCapture(e.pointerId); } catch (err) {}
    joyMove(e);
    e.preventDefault();
  }
  function joyEnd(e) {
    if (e.pointerId !== joy.id) return;
    joy.active = false; joy.id = null; joy.jx = 0; joy.jy = 0;
    if (joyKnob) joyKnob.style.transform = '';
  }
  if (joyEl) {
    joyEl.addEventListener('pointerdown', joyStart);
    joyEl.addEventListener('pointermove', joyMove);
    joyEl.addEventListener('pointerup', joyEnd);
    joyEl.addEventListener('pointercancel', joyEnd);
  }

  // ---------- Player update ----------
  function updatePlayer(dt) {
    const px = player.x, py = player.y;
    const maxV = 320 * scale;
    let dvx = 0, dvy = 0;
    let kx = 0, ky = 0;
    if (keys.left) kx -= 1;
    if (keys.right) kx += 1;
    if (keys.up) ky -= 1;
    if (keys.down) ky += 1;
    if (kx || ky) {
      dvx = kx * maxV;
      dvy = ky * maxV * 0.82;
    } else if (joy.active) {                 // v0.0.3 — joystick
      dvx = joy.jx * maxV;
      dvy = joy.jy * maxV * 0.82;
    } else if (pointer.active) {
      const t = pointerTarget();
      if (t) {
        dvx = clamp((t.x - px) * 7, -maxV, maxV);
        dvy = clamp((t.y - py) * 7, -maxV * 0.82, maxV * 0.82);
      }
    }
    if (player.drift > 0) dvx += player.driftDir * 170 * scale; // gem distraction

    const acc = 2000 * scale;
    player.vx = approach(player.vx, dvx, acc * dt);
    player.vy = approach(player.vy, dvy, acc * dt);
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    player.x = clamp(player.x, CFG.playerR + 12, W - CFG.playerR - 24);
    player.y = clamp(player.y, H * CFG.bandTop, H * CFG.bandBottom);

    player.tilt = approach(player.tilt, clamp(player.vx / (320 * scale), -0.45, 0.45), 6 * dt);
    player.flap = Math.sin(runTime * 0.012) * 0.5 + (Math.abs(player.vy) > 30 ? 0.25 : 0);

    if (player.invuln > 0) player.invuln -= dt * 1000;
    if (player.drift > 0) player.drift -= dt * 1000;
  }

  // ---------- Spawning ----------
  function maybeSpawn(dt) {
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) {
      spawnEntity();
      spawnTimer = spawnInterval * (1 + (Math.random() * 2 - 1) * CFG.spawnJitter * 0.5);
    }
  }
  function pickType() {
    const v = valleyIndex;
    const w = { cloud: 32, arrow: 8 + v * 5, gem: 24, feather: 8, companion: 3 };
    let total = 0; for (const k in w) total += w[k];
    let r = Math.random() * total;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'cloud';
  }
  function spawnEntity() {
    const t = pickType();
    const margin = 38;
    const x = margin + Math.random() * Math.max(40, W - margin * 2 - 24);
    const e = { type: t, x: x, y: -40, vx: 0, vy: scrollSpeed, r: 14, age: 0, phase: Math.random() * 6.28, rot: 0 };
    if (t === 'cloud') {
      e.r = 20 + Math.random() * 10; e.vy = scrollSpeed; e.sway = 16 + Math.random() * 16; e.puffs = makeCloudPuffs(e.r);
    } else if (t === 'arrow') {
      e.vy = scrollSpeed + 90 + Math.random() * 70; e.r = 8; e.vx = (Math.random() * 2 - 1) * 22;
    } else if (t === 'gem') {
      e.r = 10; e.vy = scrollSpeed * 0.96; e.sway = 22; e.gemCol = Math.random() < 0.5 ? COL.gold : COL.turquoise; e.rot = Math.random() * 6.28;
    } else if (t === 'feather') {
      e.r = 11; e.vy = scrollSpeed * 0.9; e.sway = 18;
    } else if (t === 'companion') {
      e.r = 11; e.vy = scrollSpeed * 0.8; e.sway = 14;
    }
    entities.push(e);
  }
  function makeCloudPuffs(r) {
    const arr = []; const n = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + Math.random() * 0.5;
      const d = r * 0.5;
      arr.push({ ox: Math.cos(a) * d * 0.85, oy: Math.sin(a) * d * 0.45, rr: r * (0.55 + Math.random() * 0.4) });
    }
    return arr;
  }

  // ---------- Entity update + collision ----------
  function updateEntities(dt) {
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      e.age += dt;
      e.y += e.vy * dt;
      e.x += e.vx * dt;
      if (e.sway) e.x += Math.sin(e.age * 1.6 + e.phase) * e.sway * dt;
      if (e.type === 'gem' || e.type === 'feather' || e.type === 'companion') e.rot += dt * 1.6;
      if (e.y > H + 70 || e.x < -90 || e.x > W + 90) { entities.splice(i, 1); continue; }
      if (state === 'playing') checkCollide(e, i);
    }
  }
  function checkCollide(e, i) {
    if (player.invuln > 0 && (e.type === 'cloud' || e.type === 'arrow')) return;
    const dx = e.x - player.x, dy = e.y - player.y;
    const rr = e.r + CFG.playerR;
    if (dx * dx + dy * dy > rr * rr) return;

    if (e.type === 'cloud') {
      loseLife(); burst(e.x, e.y, COL.cloudHi, 12);
    } else if (e.type === 'arrow') {
      loseLife(); burst(e.x, e.y, COL.vermilion, 12); entities.splice(i, 1);
    } else if (e.type === 'gem') {
      score += CFG.gemScore;
      distValley = Math.max(0, distValley - valleyLength() * CFG.gemPenalty);
      player.drift = CFG.driftMs; player.driftDir = Math.random() < 0.5 ? -1 : 1;
      burst(e.x, e.y, e.gemCol, 10); beep('gem'); entities.splice(i, 1);
    } else if (e.type === 'feather') {
      feathersCollected++;
      if (lives < CFG.maxLives) lives++; else score += CFG.featherScoreMax;
      if (feathersCollected % CFG.feathersPerCompanion === 0 && companions.length < CFG.maxCompanions) {
        companions.push({ x: player.x, y: player.y, ttl: -1, permanent: true, fade: 1 });
      }
      // v0.0.2 — feather-streak shield: 3 feathers within 4s grant 4s invulnerability
      const nowF = performance.now();
      if (nowF - lastFeatherT < 4000) featherStreak++; else featherStreak = 1;
      lastFeatherT = nowF;
      if (featherStreak >= 3) {
        player.invuln = Math.max(player.invuln, 4000);
        featherStreak = 0;
        burst(player.x, player.y, COL.gold, 22);
        beep('comp');
        if (window.MUX) MUX.bump();
      }
      burst(e.x, e.y, COL.gold, 10); beep('feather'); entities.splice(i, 1);
    } else if (e.type === 'companion') {
      score += CFG.companionScore;
      if (companions.length < CFG.maxCompanions) companions.push({ x: player.x, y: player.y, ttl: CFG.companionTtl, permanent: false, fade: 1 });
      burst(e.x, e.y, COL.turquoise, 12); beep('comp'); entities.splice(i, 1);
    }
    updateHud();
  }
  function loseLife() {
    lives--;
    player.invuln = CFG.invulnMs;
    shake = 1;
    beep('hit');
    if (window.MUX) MUX.hit();
    if (lives <= 0) startFall();
    updateHud();
  }

  // ---------- Companions (trailing birds) ----------
  function updateCompanions(dt) {
    for (let i = companions.length - 1; i >= 0; i--) {
      const c = companions[i];
      const side = (i % 2 === 0) ? -1 : 1;
      const dist = Math.floor(i / 2) + 1;
      const tx = player.x + side * dist * 14 * scale;
      const ty = player.y + 22 * scale + dist * 9 * scale;
      const k = Math.min(1, 8 * dt);
      c.x += (tx - c.x) * k;
      c.y += (ty - c.y) * k;
      if (!c.permanent) {
        c.ttl -= dt * 1000;
        if (c.ttl <= 0) { c.fade -= dt * 2.2; if (c.fade <= 0) { companions.splice(i, 1); } }
      }
    }
    score += companions.length * dt; // +1/s per companion
  }

  // ---------- Particles ----------
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 40 + Math.random() * 130;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.5 + Math.random() * 0.45, age: 0, color: color, size: 2 + Math.random() * 2.6 });
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.vx *= 0.96;
      if (p.age >= p.life) particles.splice(i, 1);
    }
  }

  // ---------- Game-over fall animation ----------
  function startFall() {
    state = 'falling';
    fallT = 0; fallVy = player.vy; fallRot = player.tilt; shake = 1;
    beep('over');
    saveBest();
  }
  function updateFall(dt) {
    fallT += dt;
    fallVy += 900 * dt;
    player.y += fallVy * dt;
    player.x += player.vx * dt * 0.3;
    player.vx *= 0.98;
    fallRot += dt * 2.4;
    if (fallT > CFG.fallMs / 1000) { state = 'gameover'; showGameOver(); }
  }

  // ---------- Valley progression ----------
  function advanceValley() {
    valleyIndex++;
    distValley = 0;
    recomputeValley();
    if (valleyIndex >= 7 && !victoried) {
      victoried = true;
      saveBest();
      state = 'victory';
      showVictory();
    } else {
      beep('valley');
    }
    updateHud();
  }

  // ---------- Main update ----------
  function update(dt) {
    runTime += dt * 1000;
    const sp = (state === 'playing' || state === 'falling') ? scrollSpeed : scrollSpeed * 0.22;
    worldScroll += sp * dt;

    if (state === 'playing') {
      updatePlayer(dt);
      updateEntities(dt);
      updateCompanions(dt);
      updateParticles(dt);
      maybeSpawn(dt);
      distValley += scrollSpeed * dt;
      score += scrollSpeed * dt * CFG.scoreRate;
      if (distValley >= valleyLength()) advanceValley();
      if (shake > 0) shake = Math.max(0, shake - dt * 1000 / CFG.shakeMs);
    } else if (state === 'falling') {
      updateFall(dt);
      updateEntities(dt);
      updateParticles(dt);
      if (shake > 0) shake = Math.max(0, shake - dt * 1000 / CFG.shakeMs);
    } else if (state === 'start' || state === 'victory') {
      updateParticles(dt);
    }
  }

  // ---------- Rendering ----------
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) {
      const m = CFG.shakeMag * shake;
      ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
    }
    drawBackground();
    drawParallax();
    drawMotes();
    drawMountQaf();
    drawProgressBar();
    for (let i = 0; i < entities.length; i++) drawEntity(entities[i]);
    for (let i = 0; i < companions.length; i++) drawCompanion(companions[i]);
    if (state === 'start') drawIdleSimurgh();
    else if (state === 'victory') drawPerchedSimurgh();
    else if (state === 'falling') drawSimurgh(player.x, player.y, scale, Math.sin(runTime * 0.02), fallRot, 1);
    else if (state === 'playing' || state === 'paused') drawPlayer();
    drawParticles();
    drawBorderFrame();
    ctx.restore();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.paperHi); g.addColorStop(0.5, COL.paper); g.addColorStop(1, COL.paperLo);
    ctx.fillStyle = g; ctx.fillRect(-24, -24, W + 48, H + 48);
    const rg = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.18, W / 2, H * 0.5, Math.max(W, H) * 0.72);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(27,31,59,0.13)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }

  function drawParallax() {
    // repeating dune bands scrolling downward to convey upward flight
    for (let li = 0; li < bgLayers.length; li++) {
      const L = bgLayers[li];
      const periodH = H * L.period;
      const off = ((worldScroll * L.speed) % periodH + periodH) % periodH;
      ctx.globalAlpha = L.alpha;
      ctx.fillStyle = L.color;
      for (let b = -1; b <= 2; b++) {
        const baseY = H * 0.62 + b * periodH + off;
        ctx.beginPath();
        ctx.moveTo(-24, baseY + periodH * 0.5);
        const n = L.peaks.length;
        const step = (W + 48) / n;
        for (let i = 0; i <= n; i++) {
          const x = -24 + i * step;
          const ph = H * L.hScale * L.peaks[i % n];
          ctx.lineTo(x + step * 0.25, baseY - ph);
          ctx.lineTo(x + step * 0.5, baseY - ph * 0.35);
          ctx.lineTo(x + step * 0.75, baseY - ph * 0.8);
          ctx.lineTo(x + step, baseY);
        }
        ctx.lineTo(W + 24, baseY + periodH * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes() {
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      let y = (m.y * H + worldScroll * m.v * 28) % H; if (y < 0) y += H;
      ctx.globalAlpha = m.a; ctx.fillStyle = COL.goldHi;
      ctx.beginPath(); ctx.arc(m.x * W, y, m.s * scale, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBorderFrame() {
    ctx.strokeStyle = 'rgba(194,145,43,0.55)'; ctx.lineWidth = 2 * scale;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.strokeStyle = 'rgba(194,145,43,0.26)'; ctx.lineWidth = 1 * scale;
    ctx.strokeRect(12, 12, W - 24, H - 24);
    ctx.fillStyle = 'rgba(194,145,43,0.5)';
    const cs = 6 * scale;
    const corners = [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]];
    for (let i = 0; i < corners.length; i++) {
      ctx.save(); ctx.translate(corners[i][0], corners[i][1]); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-cs / 2, -cs / 2, cs, cs); ctx.restore();
    }
  }

  function drawMountQaf() {
    const cx = W / 2;
    const prog = Math.min(1, valleyIndex / 6);
    const peakY = H * 0.07;
    const baseW = W * 0.52;
    const baseY = H * 0.24;
    // glow halo
    const glowR = W * 0.42 * (0.7 + prog * 0.35);
    const gg = ctx.createRadialGradient(cx, peakY, 4, cx, peakY, glowR);
    gg.addColorStop(0, 'rgba(230,194,90,' + (0.22 + prog * 0.22) + ')');
    gg.addColorStop(1, 'rgba(230,194,90,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, peakY, glowR, 0, 6.2832); ctx.fill();
    // back peak
    ctx.fillStyle = '#2A3270';
    ctx.beginPath(); ctx.moveTo(cx - baseW * 0.62, baseY); ctx.lineTo(cx - baseW * 0.12, peakY + H * 0.02); ctx.lineTo(cx + baseW * 0.3, baseY); ctx.closePath(); ctx.fill();
    // main peak
    ctx.fillStyle = COL.lapis; ctx.strokeStyle = COL.gold; ctx.lineWidth = 1.6 * scale;
    ctx.beginPath(); ctx.moveTo(cx - baseW / 2, baseY); ctx.lineTo(cx, peakY); ctx.lineTo(cx + baseW / 2, baseY); ctx.closePath(); ctx.fill(); ctx.stroke();
    // snow cap
    ctx.fillStyle = COL.white;
    ctx.beginPath();
    const capH = (baseY - peakY) * 0.34;
    ctx.moveTo(cx - baseW * 0.10, peakY + capH);
    ctx.lineTo(cx, peakY);
    ctx.lineTo(cx + baseW * 0.10, peakY + capH);
    ctx.quadraticCurveTo(cx, peakY + capH * 0.6, cx - baseW * 0.10, peakY + capH);
    ctx.closePath(); ctx.fill();
    // gold rim line on peak
    ctx.strokeStyle = COL.goldHi; ctx.lineWidth = 1.2 * scale;
    ctx.beginPath(); ctx.moveTo(cx, peakY); ctx.lineTo(cx, peakY + capH * 0.5); ctx.stroke();
  }

  function drawProgressBar() {
    const barW = 10;
    const x = W - 24;
    const yTop = H * 0.10, yBot = H * 0.92;
    const totalH = yBot - yTop;
    const gap = 4;
    const segH = (totalH - gap * 6) / 7;
    for (let i = 0; i < 7; i++) {
      const segY = yBot - (i + 1) * segH - i * gap; // valley 0 at bottom, 6 at top
      ctx.strokeStyle = 'rgba(27,31,59,0.32)'; ctx.lineWidth = 1;
      roundRect(x, segY, barW, segH, 3); ctx.stroke();
      let fill = 0;
      if (i < valleyIndex) fill = 1;
      else if (i === valleyIndex) fill = clamp(distValley / valleyLength(), 0, 1);
      if (fill > 0) {
        ctx.fillStyle = i < VALLEYS.length ? VALLEYS[i].accent : COL.gold;
        const fh = segH * fill;
        roundRect(x, segY + segH - fh, barW, fh, 3); ctx.fill();
      }
    }
    // small Qaf marker above the top segment
    ctx.fillStyle = COL.gold;
    ctx.beginPath(); ctx.moveTo(x + barW / 2, yTop - 8); ctx.lineTo(x - 1, yTop - 1); ctx.lineTo(x + barW + 1, yTop - 1); ctx.closePath(); ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawEntity(e) {
    if (e.type === 'cloud') drawCloud(e);
    else if (e.type === 'arrow') drawArrow(e);
    else if (e.type === 'gem') drawGem(e);
    else if (e.type === 'feather') drawFeather(e);
    else if (e.type === 'companion') drawCompanionPickup(e);
  }

  function drawCloud(e) {
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = COL.cloud;
    for (let i = 0; i < e.puffs.length; i++) {
      const p = e.puffs[i];
      ctx.beginPath(); ctx.arc(p.ox, p.oy, p.rr, 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < e.puffs.length; i++) {
      const p = e.puffs[i];
      ctx.beginPath(); ctx.arc(p.ox - p.rr * 0.3, p.oy - p.rr * 0.4, p.rr * 0.5, 0, 6.2832); ctx.fill();
    }
    ctx.strokeStyle = COL.cloudDark; ctx.lineWidth = 1.2;
    for (let i = 0; i < e.puffs.length; i++) {
      const p = e.puffs[i];
      ctx.beginPath(); ctx.arc(p.ox, p.oy, p.rr, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
  }

  function drawArrow(e) {
    ctx.save(); ctx.translate(e.x, e.y);
    const len = 34 * scale;
    ctx.strokeStyle = COL.vermilion; ctx.lineWidth = 2.2 * scale; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -len * 0.5); ctx.lineTo(0, len * 0.4); ctx.stroke();
    ctx.fillStyle = COL.vermilion;
    ctx.beginPath(); ctx.moveTo(0, len * 0.55); ctx.lineTo(-5 * scale, len * 0.3); ctx.lineTo(5 * scale, len * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COL.gold; ctx.lineWidth = 1.4 * scale;
    ctx.beginPath(); ctx.moveTo(0, -len * 0.5); ctx.lineTo(-4 * scale, -len * 0.64);
    ctx.moveTo(0, -len * 0.5); ctx.lineTo(4 * scale, -len * 0.64); ctx.stroke();
    ctx.restore();
  }

  function drawGem(e) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot);
    const s = e.r;
    ctx.fillStyle = e.gemCol; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(s * 0.4, -s * 0.2); ctx.lineTo(-s * 0.2, s * 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFeather(e) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(e.age * 2) * 0.3 - 0.3);
    const s = e.r;
    ctx.fillStyle = COL.gold; ctx.strokeStyle = COL.goldLo; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.3);
    ctx.quadraticCurveTo(s * 0.7, 0, 0, s);
    ctx.quadraticCurveTo(-s * 0.7, 0, 0, -s * 1.3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = COL.goldLo; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(0, s); ctx.stroke();
    ctx.restore();
  }

  function drawCompanionPickup(e) {
    ctx.save(); ctx.translate(e.x, e.y);
    const s = e.r;
    ctx.fillStyle = COL.turquoise; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.6, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.gold;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.1); ctx.quadraticCurveTo(-s * 0.9, -s * 0.6, -s * 1.1, 0); ctx.quadraticCurveTo(-s * 0.6, -s * 0.1, -s * 0.2, s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.turquoise;
    ctx.beginPath(); ctx.arc(s * 0.6, -s * 0.3, s * 0.4, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.white;
    ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.4, s * 0.1, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function drawCompanion(c) {
    const alpha = c.permanent ? 1 : clamp(c.fade, 0, 1);
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(c.x, c.y);
    const s = 7 * scale;
    const col = c.permanent ? COL.gold : COL.turquoise;
    const fl = Math.sin(runTime * 0.02 + c.x) * 0.5;
    ctx.fillStyle = col; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.9, s * 0.6, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.permanent ? COL.goldHi : col;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.6, -s * (0.4 + fl), -s * 1.1, 0); ctx.quadraticCurveTo(-s * 0.5, s * 0.1, 0, 0); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.2, s * 0.4, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------- The Simurgh ----------
  function drawPlayer() {
    const blink = player.invuln > 0 && Math.floor(player.invuln / CFG.blinkMs) % 2 === 0;
    if (blink) return;
    drawSimurgh(player.x, player.y, scale, player.flap, player.tilt, 1);
  }

  function drawIdleSimurgh() {
    const t = runTime * 0.001;
    const x = W / 2, y = H * 0.6 + Math.sin(t * 1.5) * 9 * scale;
    drawSimurgh(x, y, scale * 1.1, Math.sin(t * 4) * 0.5, Math.sin(t * 1.5) * 0.05, 1);
  }

  function drawPerchedSimurgh() {
    const cx = W / 2;
    const y = H * 0.15;
    drawSimurgh(cx, y, scale * 1.0, Math.sin(runTime * 0.004) * 0.18, 0, 1);
  }

  function drawSimurgh(x, y, sc, flap, tilt, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const s = sc;

    // --- Peacock tail fan (behind/below body) ---
    const eyes = [[0.0, 1.0], [0.45, 1.05], [-0.45, 1.05], [0.85, 1.0], [-0.85, 1.0], [0.6, 1.28], [-0.6, 1.28]];
    const tailBaseY = s * 6;
    ctx.strokeStyle = COL.goldLo; ctx.lineWidth = 1;
    for (let i = 0; i < eyes.length; i++) {
      const a = eyes[i][0], d = eyes[i][1];
      const ex = Math.sin(a) * s * 7 * d, ey = tailBaseY + Math.cos(a) * s * 5 * d + s * 2;
      ctx.beginPath(); ctx.moveTo(0, s * 5); ctx.lineTo(ex, ey); ctx.stroke();
    }
    for (let i = 0; i < eyes.length; i++) {
      const a = eyes[i][0], d = eyes[i][1];
      const ex = Math.sin(a) * s * 7 * d, ey = tailBaseY + Math.cos(a) * s * 5 * d + s * 2;
      const rad = s * 3.0 * d * 0.6 + 1.5;
      ctx.fillStyle = COL.turquoise; ctx.beginPath(); ctx.arc(ex, ey, rad, 0, 6.2832); ctx.fill();
      ctx.fillStyle = COL.gold; ctx.beginPath(); ctx.arc(ex, ey, rad * 0.55, 0, 6.2832); ctx.fill();
      ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(ex, ey, rad * 0.3, 0, 6.2832); ctx.fill();
    }

    // --- Wings (spread, flap) ---
    const wingFlap = flap * 0.6;
    for (let sidei = 0; sidei < 2; sidei++) {
      const side = sidei === 0 ? -1 : 1;
      ctx.save(); ctx.scale(side, 1);
      ctx.fillStyle = COL.turquoise; ctx.strokeStyle = COL.lapis; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s * 3, -s * 1);
      ctx.quadraticCurveTo(s * 10, -s * 4 - wingFlap * s * 6, s * 16, s * 1 - wingFlap * s * 8);
      ctx.quadraticCurveTo(s * 14, s * 4, s * 6, s * 3);
      ctx.quadraticCurveTo(s * 4, s * 1, s * 3, -s * 1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = COL.lapis; ctx.lineWidth = 1;
      for (let f = 0; f < 3; f++) {
        ctx.beginPath();
        ctx.moveTo(s * 8 + f * s * 2, 0);
        ctx.quadraticCurveTo(s * 13 + f * s * 1.5, -s * 2 - wingFlap * s * 5 - f * s, s * 16, s * 1 - wingFlap * s * 8 + f * s * 0.5);
        ctx.stroke();
      }
      ctx.fillStyle = COL.gold;
      ctx.beginPath();
      ctx.moveTo(s * 3, -s * 1);
      ctx.quadraticCurveTo(s * 7, -s * 2, s * 9, s * 1);
      ctx.quadraticCurveTo(s * 6, s * 2, s * 3, -s * 1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // --- Body ---
    ctx.fillStyle = COL.gold; ctx.strokeStyle = COL.lapis; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, s * 1, s * 4.5, s * 7, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(-s * 1.5, -s * 1, s * 2, s * 4, 0, 0, 6.2832); ctx.fill();

    // --- Neck + Head ---
    ctx.fillStyle = COL.gold; ctx.strokeStyle = COL.lapis; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-s * 2, -s * 5); ctx.quadraticCurveTo(0, -s * 9, s * 2, -s * 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -s * 9, s * 4, 0, 6.2832); ctx.fill(); ctx.stroke();

    // --- Beak ---
    ctx.fillStyle = COL.vermilion; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -s * 13); ctx.lineTo(-s * 1.6, -s * 9); ctx.lineTo(s * 1.6, -s * 9); ctx.closePath(); ctx.fill(); ctx.stroke();

    // --- Crest ---
    ctx.strokeStyle = COL.vermilion; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let c = -1; c <= 1; c++) {
      ctx.beginPath(); ctx.moveTo(c * s * 1.5, -s * 11); ctx.lineTo(c * s * 3, -s * 14 - c * s * 0.5); ctx.stroke();
    }

    // --- Eye ---
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(s * 1.6, -s * 9.5, s * 0.9, 0, 6.2832); ctx.fill();
    ctx.fillStyle = COL.white; ctx.beginPath(); ctx.arc(s * 1.9, -s * 9.8, s * 0.3, 0, 6.2832); ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  const FEATHER_SVG = '<svg class="flife" viewBox="0 0 16 22" aria-hidden="true">'
    + '<path d="M8 1c5 4 6 10 1 17l-1 3-1-3C2 11 3 5 8 1z" fill="#C2912B" stroke="#9C7220" stroke-width="0.8"/>'
    + '<path d="M8 3v15" stroke="#9C7220" stroke-width="0.7" fill="none"/></svg>';
  function updateHud() {
    elScore.textContent = fa(Math.floor(score));
    let html = '';
    for (let i = 0; i < lives; i++) html += FEATHER_SVG;
    elLives.innerHTML = html;
    elValley.textContent = valleyName();
    elValley.style.color = valleyAccent();
  }

  // ---------- Screens ----------
  function showScreen(which) {
    scrStart.hidden = true; scrPause.hidden = true; scrOver.hidden = true; scrVictory.hidden = true;
    if (which) which.hidden = false;
    if (joyEl) joyEl.classList.toggle('show', state === 'playing' && coarsePointer);   // v0.0.3
  }
  function showStart() {
    state = 'start'; showScreen(scrStart);
    elBestStart.textContent = fa(Math.floor(best));
    elHud.hidden = true;
  }
  function showPause() { showScreen(scrPause); }
  function hideOverlays() { showScreen(null); }
  function showGameOver() {
    showScreen(scrOver);
    elScoreOver.textContent = fa(Math.floor(score));
    elBestOver.textContent = fa(Math.floor(best));
    elValleyOver.textContent = 'رسیده به ' + valleyName();
    if (window.MUX) MUX.over();
  }
  function showVictory() {
    showScreen(scrVictory);
    elScoreVictory.textContent = fa(Math.floor(score));
    elBestVictory.textContent = fa(Math.floor(best));
  }

  function togglePause() {
    if (state === 'playing') { state = 'paused'; showPause(); }
    else if (state === 'paused') { state = 'playing'; hideOverlays(); }
  }

  function startGame() {
    resetGame();
    state = 'playing';
    elHud.hidden = false;
    hideOverlays();
    resumeAudio();
  }
  function continueEndless() {
    state = 'playing';
    elHud.hidden = false;
    hideOverlays();
  }

  function saveBest() {
    const sc = Math.floor(score);
    if (sc > best) { best = sc; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
  }

  // ---------- Audio (WebAudio, no external files) ----------
  let ac = null, gain = null;
  function resumeAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      gain = ac.createGain(); gain.gain.value = 0.25; gain.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  function beep(type) {
    if (!ac) return;
    try {
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(gain);
      let f = 440, dur = 0.12, wave = 'triangle', vol = 0.5;
      if (type === 'feather') { f = 660; dur = 0.14; }
      else if (type === 'gem') { f = 520; dur = 0.16; wave = 'sine'; }
      else if (type === 'comp') { f = 740; dur = 0.2; }
      else if (type === 'hit') { f = 150; dur = 0.22; wave = 'sawtooth'; vol = 0.7; }
      else if (type === 'over') { f = 95; dur = 0.6; wave = 'sawtooth'; vol = 0.6; }
      else if (type === 'valley') { f = 520; dur = 0.45; vol = 0.6; }
      o.type = wave; o.frequency.setValueAtTime(f, t);
      if (type === 'over' || type === 'hit') o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur);
      if (type === 'valley') o.frequency.linearRampToValueAtTime(f * 1.5, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  // ---------- Main loop ----------
  function loop(now) {
    let dt = (now - lastT) / 1000; lastT = now;
    if (dt > 0.05) dt = 0.05;
    if (state !== 'paused' && state !== 'gameover') update(dt);
    render();
    if (state === 'playing') elScore.textContent = fa(Math.floor(score));
    requestAnimationFrame(loop);
  }

  // ---------- Wire up buttons ----------
  $('play').onclick = startGame;
  $('retry').onclick = startGame;
  $('retry-victory').onclick = startGame;
  $('continue-endless').onclick = continueEndless;
  $('resume').onclick = togglePause;
  $('quit').onclick = showStart;
  $('pause').onclick = togglePause;

  // ---------- Init ----------
  function init() {
    resize();
    makeBg();
    resetGame();
    showStart();
    lastT = performance.now();
    requestAnimationFrame(loop);
  }
  addEventListener('resize', resize);
  init();
})();
// ---- v0.0.5 gamekit wiring (splash + menu + stats + leaderboard + auto-update) ----
if (window.GK) {
  GK.boot({ title: "Simurgh Flight", tagline: "Flight through seven valleys", theme: "#06121a" });
  GK.help({ title: "Simurgh Flight", objective: "Guide the Simurgh through the seven valleys. Avoid hazards, collect gems.", controls: ["Touch: on-screen joystick to fly","Mouse: move to guide","Space / click: flap","P: pause","F: fullscreen"], tips: "Gems distract - stay focused on the gaps." });
  GK.exposeState(function () { try { return { score: (window.S && window.S.score) || window.score || 0, mode: (window.S && window.S.mode) || 'play', wave: (window.S && window.S.wave) || 0 }; } catch (e) { return {}; } });
  GK._manualRecord = false;
  setTimeout(function () { GK.ready(); }, 600);
}
