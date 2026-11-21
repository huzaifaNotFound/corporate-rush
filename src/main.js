import "./style.css";

(() => {
  'use strict';

  const W = 720, H = 260;       
  const GROUND = 216;          
  const GRAVITY = 0.6;
  const JUMP = -11.8;
  const START_SPEED = 6;
  const MAX_SPEED = 13;
 
  const ASSETS = {
    background: { src: 'assets/background.png' },
    road:       { src: 'assets/road.png' },
    player:     { src: 'assets/player.png',  w: 33, h: 48 },
    monitor:    { src: 'assets/monitor.png', w: 42, h: 36 },
    cabinet:    { src: 'assets/cabinet.png', w: 24, h: 39 },
    paper:      { src: 'assets/paper.png',   w: 36, h: 21 },
    ball:       { src: 'assets/ball.png',    w: 24, h: 24 }   
  };

  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const pad = n => String(Math.floor(n)).padStart(5, '0');

  const IMG = {};
  const loading = Object.entries(ASSETS).map(([name, a]) => new Promise(done => {
    const im = new Image();
    im.onload = im.onerror = done;
    im.src = a.src;
    IMG[name] = im;
  }));

  function drawImg(name, x, y, w, h) {
    const im = IMG[name];
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, Math.round(x), Math.round(y), w, h);
  }

  let state = 'ready';       
  let score = 0, best = +store.get('cr_best') || 0;
  let speed = START_SPEED, dist = 0, gap = 260;
  let hold = false, buffer = 0, deadAt = 0, last = 0;
  let obstacles = [];
  const player = { x: 70, w: ASSETS.player.w, h: ASSETS.player.h, y: 0, vy: 0, onGround: true };
  player.y = GROUND - player.h;

  function start() {
    obstacles = [];
    score = 0; dist = 0; gap = 260; speed = START_SPEED; buffer = 0;
    player.y = GROUND - player.h; player.vy = 0; player.onGround = true;
    state = 'run';
    $('ov').classList.add('hidden');
  }

  function die() {
    state = 'dead';
    deadAt = performance.now();
    if (Math.floor(score) > best) { best = Math.floor(score); store.set('cr_best', best); }
    $('ttl').textContent = 'GAME OVER';
    $('msg').textContent = 'SCORE ' + pad(score);
    $('ov').classList.remove('hidden');
  }

  function jump() { player.vy = JUMP; player.onGround = false; }

  function press() {
    hold = true;
    if (state === 'ready') start();
    else if (state === 'dead') { if (performance.now() - deadAt > 400) start(); }
    else if (player.onGround) jump();
    else buffer = 8;            
  }

  function addObstacle(type, x) {
    const a = ASSETS[type];
    const o = { type, x, w: a.w, h: a.h, y: GROUND - a.h, vy: 0 };
    if (type === 'ball') o.y = GROUND - a.h - 50;
    obstacles.push(o);
  }

  function spawn() {
    const r = Math.random();
    let type = r < .3 ? 'monitor' : r < .5 ? 'cabinet' : r < .7 ? 'paper' : 'ball';
    if (type === 'ball' && score < 60) type = 'monitor';      
    const x = W + 20;
    if (score > 200 && Math.random() < .25) {                 
      addObstacle('cabinet', x);
      addObstacle('monitor', x + ASSETS.cabinet.w + 8);
    } else addObstacle(type, x);
    gap = speed * (24 + Math.random() * 26) + 60;            
  }

  function update(dt) {
    if (state !== 'run') return;

    speed = Math.min(MAX_SPEED, START_SPEED + score / 250);
    score += speed * dt * 0.03;
    dist += speed * dt;
    if (dist > gap) { dist = 0; spawn(); }


    let g = GRAVITY;
    if (player.vy < 0 && !hold) g = 1.3;
    player.vy += g * dt;
    player.y += player.vy * dt;
    const floor = GROUND - player.h;
    if (player.y >= floor) {
      const landed = !player.onGround;
      player.y = floor; player.vy = 0; player.onGround = true;
      if (landed && buffer > 0) { buffer = 0; jump(); }
    } else player.onGround = false;
    buffer = Math.max(0, buffer - dt);

    const px = player.x + 6, py = player.y + 5, pw = player.w - 12, ph = player.h - 8;
    for (const o of obstacles) {
      o.x -= (speed + (o.type === 'ball' ? 2 : 0)) * dt;
      if (o.type === 'ball') {                                 
        o.vy += 0.5 * dt; o.y += o.vy * dt;
        if (o.y > GROUND - o.h) { o.y = GROUND - o.h; o.vy = -(8 + Math.random() * 3); }
      }
      const ox = o.x + 3, oy = o.y + 3, ow = o.w - 6, oh = o.h - 6;
      if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) { die(); return; }
    }
    obstacles = obstacles.filter(o => o.x + o.w > -30);
  }

  function draw() {
    ctx.fillStyle = '#9bdcff'; ctx.fillRect(0, 0, W, H);                    
    drawImg('background', 0, 0, W, H);
    ctx.fillStyle = '#3a3f5e'; ctx.fillRect(0, GROUND, W, H - GROUND);      
    drawImg('road', 0, GROUND, W, H - GROUND);
    for (const o of obstacles) drawImg(o.type, o.x, o.y, o.w, o.h);
    drawImg('player', player.x, player.y, player.w, player.h);
    $('score').textContent = pad(score);
    $('best').textContent = pad(best);
  }

  function loop(now) {
    const dt = Math.min(3, (now - last) / 16.667);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  addEventListener('keydown', e => {
    if (JUMP_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) press(); }
  });
  addEventListener('keyup', e => { if (JUMP_KEYS.includes(e.code)) hold = false; });
  $('wrap').addEventListener('pointerdown', e => { e.preventDefault(); press(); });
  addEventListener('pointerup', () => { hold = false; });

  Promise.all(loading).then(() => {
    last = performance.now();
    requestAnimationFrame(loop);
  });
})();
