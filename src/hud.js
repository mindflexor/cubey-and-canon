const $ = id => document.getElementById(id);
const GEAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.3 1h3.4l.5 2.6c.7.2 1.4.5 2 .9l2.2-1.5 2.4 2.4-1.5 2.2c.4.6.7 1.3.9 2l2.6.5v3.4l-2.6.5c-.2.7-.5 1.4-.9 2l1.5 2.2-2.4 2.4-2.2-1.5c-.6.4-1.3.7-2 .9l-.5 2.6h-3.4l-.5-2.6c-.7-.2-1.4-.5-2-.9l-2.2 1.5-2.4-2.4 1.5-2.2c-.4-.6-.7-1.3-.9-2L1 13.7v-3.4l2.6-.5c.2-.7.5-1.4.9-2L3 5.6 5.4 3.2l2.2 1.5c.6-.4 1.3-.7 2-.9zM12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>`;

export class HUD {
  constructor(R) {
    this.R = R; this.hintT = 0; this.toastT = 0; this.bannerT = 0; this.flash = 0; this.shownGears = 0; this.targetGears = 0; this.bossRef = null;
    $('gear-icon').innerHTML = GEAR_SVG; $('gold-icon').innerHTML = GEAR_SVG;
  }
  show(on) { $('hud').hidden = !on; }
  swap(h) {
    const c = h.kind === 'cubey';
    $('hero-name').textContent = h.name; $('portrait').className = 'portrait ' + h.kind;
    $('partner').textContent = c ? 'Q · Canon' : 'Q · Cubey';
    this.abil(h);
    $('reticle').classList.add('on'); $('reticle').classList.toggle('mini', c);
    this.buildPips(h);
  }
  abil(h) {
    const c = h.kind === 'cubey', k = this.kind || 'keys';
    const L = {
      keys: c ? '<b>CLICK</b> Place cube <b>RMB</b> Shield <b>R</b> Recall <b>CLICK (air)</b> Slam' : '<b>CLICK</b> Fire <b>HOLD</b> Charge <b>RMB</b> Aim',
      pad: c ? '<b>RT</b> Place cube <b>LT</b> Shield <b>X</b> Recall <b>RT (air)</b> Slam <b>Y</b> Swap' : '<b>RT</b> Fire <b>HOLD RT</b> Charge <b>LT</b> Aim <b>Y</b> Swap',
      touch: '',
    };
    $('abil').innerHTML = L[k]; $('abil').hidden = !L[k];
    document.getElementById('touch')?.setAttribute('data-hero', h.kind);
  }
  buildPips(h) {
    const el = $('pips'); el.innerHTML = '';
    for (let i = 0; i < h.maxHp; i++) { const p = document.createElement('i'); p.className = h.kind; el.append(p); }
    this.lastHp = -1;
  }
  update(G) {
    const dt = 1 / 60, h = G.active;
    if (G.input && G.input.kind !== this.kind) { this.kind = G.input.kind; this.abil(h); }
    if (h.hp !== this.lastHp || this.lastKind !== h.kind) {
      if (this.lastKind !== h.kind) { this.swap(h); this.lastKind = h.kind; }
      const pips = $('pips').children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('off', i >= h.hp);
      $('vitals').classList.toggle('low', h.hp <= 2);
      this.lastHp = h.hp;
    }
    if (this.shownGears !== this.targetGears) {
      this.shownGears += Math.max(1, Math.round((this.targetGears - this.shownGears) * 0.15));
      if (this.shownGears > this.targetGears) this.shownGears = this.targetGears;
      $('gears').textContent = this.shownGears.toLocaleString();
    }
    const r = $('reticle');
    r.classList.toggle('aim', h.aiming); r.style.setProperty('--charge', Math.min(1, h.charge / 0.85));
    r.classList.toggle('full', h.charge >= 0.85);
    if (G.boss && this.bossRef) $('boss-fill').style.transform = `scaleX(${Math.max(0, G.boss.hp / G.boss.maxHp)})`;
    $('cubes').textContent = G.cubes.length;
    $('cube-count').hidden = h.kind !== 'cubey';
    if (this.hintT > 0 && (this.hintT -= dt) <= 0) $('hint').classList.remove('on');
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('toast').classList.remove('on');
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) $('banner').classList.remove('on');
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.R.grade.uniforms.flash.value = this.flash;
  }
  gears(n) { this.targetGears = n; const el = $('gear-box'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  gold(n, t) { $('gold').textContent = `${n}/${t}`; }
  hint(text, dur) {
    const k = this.kind || 'keys';
    const MOVE = 'WASD to move · Mouse to look · SPACE to jump (press again in the air to double jump)';
    if (k === 'pad') text = text.replace(MOVE, 'LEFT STICK to move · RIGHT STICK to look · A to jump (press again in the air to double jump)')
      .replace(/CLICK in the air/g, 'RT in the air').replace(/HOLD fire/g, 'HOLD RT').replace(/RIGHT MOUSE/g, 'LT').replace(/Press Q/g, 'Press Y').replace('(R recalls them)', '(X recalls them)').replace(/CLICK/g, 'RT').replace(/SPACE/g, 'A');
    if (k === 'touch') text = text.replace(MOVE, 'Left thumb to move · drag the right side to look · ▲ to jump (tap again in the air to double jump)')
      .replace(/CLICK in the air/g, '● in the air').replace(/HOLD fire/g, 'HOLD ●').replace(/RIGHT MOUSE/g, '◈').replace(/Press Q/g, 'Tap ⇄').replace('(R recalls them)', '(↺ recalls them)').replace(/CLICK/g, '●').replace(/SPACE/g, '▲');
    $('hint').innerHTML = text.replace(/\b([A-Z]{2,}(?: [A-Z]{4,})?|Q|R)\b/g, '<b>$1</b>'); $('hint').classList.add('on'); this.hintT = dur; }
  toast(text) { $('toast').textContent = text; $('toast').classList.add('on'); this.toastT = 2.2; }
  banner(title, sub) { $('banner-title').textContent = title; $('banner-sub').textContent = sub; $('banner').classList.add('on'); this.bannerT = 3.2; }
  objective(text) { const o = $('objective'); o.classList.remove('new'); void o.offsetWidth; o.textContent = text; o.classList.add('new'); }
  bossBar(b) { this.bossRef = b; $('boss').hidden = !b; if (b) $('boss-name').textContent = b.name; }
  damage() { this.flash = 1; }
  fade(on) { $('fade').classList.toggle('on', on); }
}
