// On-screen touch controls: floating move stick (left half), drag-to-look (right half), action buttons.
export class Touch {
  constructor(root) {
    this.enabled = false;
    this.mx = 0; this.mz = 0; this.lookX = 0; this.lookY = 0;
    this.held = {}; this.pressed = {}; this.released = {};
    this.stick = null; this.look = null;
    const el = this.el = document.createElement('div');
    el.id = 'touch';
    el.innerHTML = `
      <div class="t-stick"><div class="t-knob"></div></div>
      <button class="t-btn t-pause" data-b="pause" aria-label="Pause">II</button>
      <button class="t-btn t-swap" data-b="swap" aria-label="Swap hero">⇄</button>
      <button class="t-btn t-recall" data-b="recall" aria-label="Recall cubes">↺</button>
      <button class="t-btn t-alt" data-b="secondary" aria-label="Shield or aim">◈</button>
      <button class="t-btn t-act" data-b="primary" aria-label="Place cube or fire">●</button>
      <button class="t-btn t-jump" data-b="jump" aria-label="Jump">▲</button>`;
    root.append(el);
    this.stickEl = el.querySelector('.t-stick'); this.knob = el.querySelector('.t-knob');
    for (const b of el.querySelectorAll('.t-btn')) {
      const k = b.dataset.b;
      b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); this.held[k] = true; this.pressed[k] = true; b.classList.add('on'); }, { passive: false });
      const up = e => { e.preventDefault(); e.stopPropagation(); if (this.held[k]) this.released[k] = true; this.held[k] = false; b.classList.remove('on'); };
      b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    }
    const canvas = document.getElementById('view');
    canvas.addEventListener('touchstart', e => this.start(e), { passive: false });
    canvas.addEventListener('touchmove', e => this.move(e), { passive: false });
    canvas.addEventListener('touchend', e => this.end(e), { passive: false });
    canvas.addEventListener('touchcancel', e => this.end(e), { passive: false });
    addEventListener('touchstart', () => this.enable(), { passive: true, once: true });
    if (matchMedia('(pointer: coarse)').matches) this.enable();
  }
  enable() { this.enabled = true; document.body.classList.add('touch'); }
  start(e) {
    e.preventDefault(); this.enable();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && !this.stick) {
        this.stick = { id: t.identifier, x: t.clientX, y: t.clientY };
        this.stickEl.style.left = t.clientX + 'px'; this.stickEl.style.top = t.clientY + 'px'; this.stickEl.classList.add('on');
      } else if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
  }
  move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        const R = Math.min(70, innerWidth * 0.09);
        let dx = t.clientX - this.stick.x, dy = t.clientY - this.stick.y; const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        this.mx = dx / R; this.mz = -dy / R;
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (this.look && t.identifier === this.look.id) {
        this.lookX += (t.clientX - this.look.x) * 0.0065; this.lookY += (t.clientY - this.look.y) * 0.0055;
        this.look.x = t.clientX; this.look.y = t.clientY;
      }
    }
  }
  end(e) {
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) { this.stick = null; this.mx = this.mz = 0; this.knob.style.transform = ''; this.stickEl.classList.remove('on'); }
      if (this.look && t.identifier === this.look.id) this.look = null;
    }
  }
  setHero(kind) { this.el.dataset.hero = kind; }
  consume() {
    const out = { mx: this.mx, mz: this.mz, lookX: this.lookX, lookY: this.lookY, held: { ...this.held }, pressed: this.pressed, released: this.released };
    this.lookX = this.lookY = 0; this.pressed = {}; this.released = {};
    return out;
  }
}
