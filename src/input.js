// Keyboard + mouse (pointer lock) + gamepad.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, b0: false, b2: false, p0: false, r0: false };
    this.locked = false; this.sens = 0.0022; this.invertY = false;
    this.padPrev = {}; this.kind = 'keys';
    addEventListener('keydown', e => {
      if (e.code === 'Tab' && this.wantLock) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code); this.kind = 'keys';
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.b0 = this.mouse.b2 = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', e => {
      if (performance.now() - (this.lastTouch || -9999) < 1200) return;
      this.kind = 'keys';
      // clicking the game captures the mouse (that first click doesn't fire); retried on every click
      if (!this.locked && this.wantLock) { this.requestLock(); if (!this.lockFailed) return; }
      if (e.button === 0) { this.mouse.b0 = true; this.mouse.p0 = true; }
      if (e.button === 2) this.mouse.b2 = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) { if (this.mouse.b0) this.mouse.r0 = true; this.mouse.b0 = false; }
      if (e.button === 2) this.mouse.b2 = false;
    });
    // Mouse look: pointer-locked when the browser allows it, otherwise free-cursor look (+ edge turning)
    addEventListener('touchstart', () => { this.lastTouch = performance.now(); }, { passive: true, capture: true });
    addEventListener('touchend', () => { this.lastTouch = performance.now(); }, { passive: true, capture: true });
    addEventListener('mousemove', e => {
      if (performance.now() - (this.lastTouch || -9999) < 1200) return; // ignore emulated mouse after taps
      this.mx = e.clientX / innerWidth; this.my = e.clientY / innerHeight;
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      // captured: normal mouse look. Only when the browser refuses capture (e.g. embedded panes) fall back to free-cursor look.
      if (this.locked || (this.wantLock && this.lockFailed)) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    addEventListener('keydown', e => { if (this.wantLock && !this.locked && e.code !== 'Escape' && !this.lockFailed) this.requestLock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) this.lockFailed = false;
      if (!this.locked) { this.mouse.b0 = this.mouse.b2 = false; this.onUnlock?.(); }
    });
    this.wantLock = false;
  }
  requestLock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    const fail = err => { if (err && err.name === 'WrongDocumentError') this.lockFailed = true; };
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p?.catch) p.catch(() => { try { const q = this.canvas.requestPointerLock(); q?.catch?.(fail); } catch (e) { fail(e); } });
    } catch (e) { try { this.canvas.requestPointerLock(); } catch (e2) { fail(e2); } }
  }
  lock() { this.wantLock = true; this.requestLock(); }
  rumble(strength = 0.5, ms = 120) {
    try { this.pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, strength * 0.7) }); } catch { }
    if (this.kind === 'touch' && navigator.vibrate) try { navigator.vibrate(Math.min(60, ms * strength)); } catch { }
  }
  unlock() { this.wantLock = false; if (this.locked) document.exitPointerLock?.(); }
  sample(dt) {
    const k = c => this.keys.has(c), p = c => this.pressed.has(c);
    const s = {
      mx: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0),
      mz: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0),
      lookX: this.mouse.dx * this.sens, lookY: this.mouse.dy * this.sens * (this.invertY ? -1 : 1),
      jump: p('Space'), jumpHeld: k('Space'),
      primary: this.mouse.p0 || p('KeyE'), primaryHeld: this.mouse.b0 || k('KeyE'), primaryUp: this.mouse.r0 || (this.pressedUp?.has('KeyE') ?? false),
      secondaryHeld: this.mouse.b2 || k('KeyF') || k('ShiftLeft'),
      swap: p('KeyQ') || p('Tab'), recall: p('KeyR'), pause: p('Escape') || p('KeyP'),
      confirm: false,
    };
    if (!this.locked && this.wantLock && this.mx != null) { const ex = this.mx < 0.03 ? -1 : this.mx > 0.97 ? 1 : 0; s.lookX += ex * 2.2 * dt; }
    if (this._eHeld && !k('KeyE')) s.primaryUp = true;
    this._eHeld = k('KeyE');
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const dz = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
      const lx = dz(gp.axes[0]), ly = dz(gp.axes[1]), rx = dz(gp.axes[2]), ry = dz(gp.axes[3]);
      const b = i => !!gp.buttons[i]?.pressed, val = i => gp.buttons[i]?.value || 0;
      const pr = this.padPrev, edge = i => b(i) && !pr[i];
      if (lx || ly || rx || ry || gp.buttons.some(x => x.pressed)) this.kind = 'pad';
      if (lx || ly) { s.mx = lx; s.mz = -ly; }
      // response curve for precise aiming with the right stick
      const curve = v => Math.sign(v) * Math.pow(Math.abs(v), 1.6);
      s.lookX += curve(rx) * 3.4 * dt; s.lookY += curve(ry) * 2.2 * dt * (this.invertY ? -1 : 1);
      if (edge(0)) { s.jump = true; s.confirm = true; } if (b(0)) s.jumpHeld = true;
      if (edge(5)) s.primary = true; if (b(5)) s.primaryHeld = true; else if (pr[5]) s.primaryUp = true;
      // menu navigation: d-pad or left stick flicks
      const ny = ly < -0.6 ? -1 : ly > 0.6 ? 1 : 0;
      if (edge(12) || (ny === -1 && pr.ny !== -1)) s.navUp = true;
      if (edge(13) || (ny === 1 && pr.ny !== 1)) s.navDown = true;
      pr.ny = ny; this.pad = gp;
      if (val(7) > 0.4 && !(pr.rt)) s.primary = true;
      if (val(7) > 0.4) s.primaryHeld = true; else if (pr.rt) s.primaryUp = true;
      if (val(6) > 0.4 || b(4)) s.secondaryHeld = true;
      if (edge(3)) s.swap = true; if (edge(2)) s.recall = true; if (edge(9)) s.pause = true;
      if (edge(1)) s.back = true;
      for (let i = 0; i < gp.buttons.length; i++) pr[i] = b(i);
      pr.rt = val(7) > 0.4;
      break;
    }
    // touchscreen
    if (this.touch?.enabled) {
      const t = this.touch.consume();
      if (t.mx || t.mz) { s.mx = t.mx; s.mz = t.mz; this.kind = 'touch'; }
      s.lookX += t.lookX; s.lookY += t.lookY;
      if (t.pressed.jump) s.jump = true; if (t.held.jump) s.jumpHeld = true;
      if (t.pressed.primary) s.primary = true; if (t.held.primary) s.primaryHeld = true; if (t.released.primary) s.primaryUp = true;
      if (t.held.secondary) s.secondaryHeld = true;
      if (t.pressed.swap) s.swap = true; if (t.pressed.recall) s.recall = true; if (t.pressed.pause) s.pause = true;
      if (Object.keys(t.pressed).length || t.lookX || t.mx) this.kind = 'touch';
    }
    const l = Math.hypot(s.mx, s.mz); if (l > 1) { s.mx /= l; s.mz /= l; }
    this.mouse.dx = this.mouse.dy = 0; this.mouse.p0 = false; this.mouse.r0 = false; this.pressed.clear();
    return s;
  }
}
