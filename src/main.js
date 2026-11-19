import { initMaterials } from './materials.js';
import { createRenderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { Touch } from './touch.js';
import { LEVELS, loadSave, writeSave } from './levels.js';

const $ = id => document.getElementById(id);
const canvas = $('view');
let R, G, input, hud, audio = new Audio(), mode = 'loading', last = performance.now(), menuT = 0;
const params = new URLSearchParams(location.search);
const save = loadSave();
const LEVEL = Math.min(5, Math.max(1, parseInt(params.get('level')) || save.unlocked));
const LV = LEVELS[LEVEL - 1];
const goLevel = (n, play = true) => { location.href = '?level=' + n + (play ? '&play' : ''); };

function buttons(list) {
  const b = $('buttons'); b.innerHTML = ''; b.hidden = false;
  for (const [label, fn, alt] of list) {
    const el = document.createElement('button'); el.textContent = label; if (alt) el.className = 'alt';
    el.onclick = () => { audio.wake(); audio.play('ui', { vol: 0.6 }); fn(); };
    el.onmouseenter = () => audio.play('focus', { vol: 0.3 });
    b.append(el);
  }
}
function showMenu(kind) {
  mode = kind; document.body.classList.remove('playing'); $('menu').style.display = ''; $('menu').classList.remove('hidden'); hud.show(kind === 'paused'); input.unlock();
  $('controls').hidden = true;
  if (kind === 'title') {
    $('menu-sub').textContent = `Level ${LEVEL} · ${LV.name}`;
    buttons([[LEVEL === 1 && save.unlocked === 1 ? 'Set Sail' : `Play Level ${LEVEL}`, start], ['Level Select', () => showMenu('levels'), true], ['Controls', () => { $('controls').hidden = !$('controls').hidden; }, true]]);
  } else if (kind === 'levels') {
    $('menu-sub').textContent = 'Choose an island';
    const list = LEVELS.map(l => {
      const locked = l.n > save.unlocked, g = (save.golden[l.n] || []).length;
      return [`${l.n}. ${l.name}${locked ? '  🔒' : ''}${!locked && g ? `  ·  ${g} golden` : ''}`, () => { if (!locked) goLevel(l.n); else audio.play('ui', { rate: 0.6 }); }, l.n !== LEVEL];
    });
    buttons([...list, ['Back', () => showMenu('title'), true]]);
  } else if (kind === 'paused') {
    $('menu-sub').textContent = 'Paused';
    buttons([['Resume', resume], ['Controls', () => { $('controls').hidden = !$('controls').hidden; }, true], ['Restart Level', () => goLevel(LEVEL), true], ['Level Select', () => showMenu('levels'), true]]);
  } else if (kind === 'won') {
    const t = Math.round((performance.now() - G.stats.start) / 1000);
    const last = LEVEL === 5;
    $('menu-sub').innerHTML = `<div class="stats">${last ? 'The Rustwake is finished — the Caribbean is free!' : `${LV.name} complete! Map piece ${LEVEL} of 4 recovered.`}<br>Gears <b>${G.gears.toLocaleString()}</b> · Golden Gears <b>${G.golden.size}/${G.goldenTotal}</b><br>Pirates scrapped <b>${G.stats.kills}</b> · Cubes poured <b>${G.stats.cubes}</b> · Time <b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b></div>`;
    buttons(last ? [['Play Again', () => goLevel(1)], ['Level Select', () => showMenu('levels'), true]] : [[`Next: ${LEVELS[LEVEL].name}`, () => goLevel(LEVEL + 1)], ['Replay Level', () => goLevel(LEVEL), true], ['Level Select', () => showMenu('levels'), true]]);
  }
}
function start() {
  audio.wake().then(() => audio.setMusic('explore'));
  mode = 'play'; document.body.classList.add('playing'); $('menu').classList.add('hidden'); setTimeout(() => { if (mode === 'play') $('menu').style.display = 'none'; }, 450); $('buttons').hidden = true; hud.show(true); if (params.has('nolock')) { input.wantLock = true; input.lockFailed = true; } else input.lock();
  hud.swap(G.active); G.cam.snap = true; last = performance.now();
  if (!G.started) { G.started = true; G.hud.banner(`Level ${LEVEL}: ${LV.name}`, LV.tag); }
}
function resume() { start(); }

async function boot() {
  try {
    await initMaterials((p, name) => { $('lfill').style.width = (p * 70) + '%'; $('ltext').textContent = 'Mixing ' + name + '…'; });
    R = createRenderer(canvas);
    input = new Input(canvas);
    input.touch = new Touch(document.body);
    hud = new HUD(R);
    $('ltext').textContent = `Building ${LV.name}…`; $('lfill').style.width = '80%';
    const mod = await LV.load();
    await new Promise(r => setTimeout(r, 30));
    G = new Game(R, audio, hud, LEVEL, mod); G.input = input;
    G.onWin = () => {
      save.unlocked = Math.max(save.unlocked, Math.min(5, LEVEL + 1));
      save.golden[LEVEL] = [...new Set([...(save.golden[LEVEL] || []), ...G.golden])];
      save.gears += G.gears; save.best[LEVEL] = Math.max(save.best[LEVEL] || 0, G.gears);
      writeSave(save);
      setTimeout(() => showMenu('won'), 2500);
    };
    $('lfill').style.width = '95%'; $('ltext').textContent = 'Compiling shaders…';
    await new Promise(r => setTimeout(r, 30));
    R.renderer.compile(R.scene, R.camera);
    $('loading').hidden = true;
    input.onUnlock = () => { if (mode === 'play' && !params.has('nolock')) showMenu('paused'); };
    hud.swap(G.active);
    window.__G = G; window.__R = R;
    if (params.has('play')) start(); else showMenu('title');
    const firstGesture = () => { audio.wake().then(() => { if (mode === 'title') audio.setMusic('menu'); }); removeEventListener('pointerdown', firstGesture); removeEventListener('keydown', firstGesture); };
    addEventListener('pointerdown', firstGesture); addEventListener('keydown', firstGesture);
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e); $('fault').hidden = false; $('fault').textContent = 'Failed to start: ' + e.message;
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  const inp = input.sample(dt);
  $('lockhint').hidden = !(mode === 'play' && !input.locked && !input.lockFailed && input.kind === 'keys' && !document.body.classList.contains('touch'));
  if (mode === 'play') {
    if (inp.pause) { showMenu('paused'); }
    else G.update(dt, inp);
  } else {
    // controller / keyboard menu navigation
    const btns = [...$('buttons').querySelectorAll('button')];
    if (btns.length && !$('buttons').hidden) {
      let i = btns.indexOf(document.activeElement);
      if (inp.navDown || inp.navUp) { i = i < 0 ? 0 : (i + (inp.navDown ? 1 : -1) + btns.length) % btns.length; btns[i].focus(); audio.play('focus', { vol: 0.3 }); }
      if (inp.confirm && mode !== 'title') { (btns[i] || btns[0]).click(); }
      if (inp.pause && mode === 'paused') resume();
    }
    menuT += dt;
    // slow orbit around the heroes on menus
    if (mode === 'title') {
      const p = G.active.pos;
      R.camera.position.set(p.x + Math.sin(menuT * 0.12) * 7.5, p.y + 2.6, p.z - 6.5 + Math.cos(menuT * 0.12) * 3);
      R.camera.lookAt(p.x - 1, p.y + 1.3, p.z + 1);
      G.time += dt; for (const h of G.heroes) h.animate(dt); G.fx.update(dt); for (const u of G.updaters) u(dt, G);
      for (const e of G.enemies) if (!e.dead) e.anim?.(dt, 0);
    }
    if (inp.confirm && mode === 'title') { const b = [...$('buttons').querySelectorAll('button')]; const f = b.indexOf(document.activeElement); if (f > 0) b[f].click(); else start(); }
  }
  R.update(dt, G.active.pos, G.time);
  R.render();
}

boot();
