// Sound effects (CC0 Kenney-derived WAVs in public/audio) + synthesized ambience.
const NAMES = ['boss', 'break', 'checkpoint', 'coin', 'death', 'hit', 'hurt', 'jump', 'land', 'levelup', 'place', 'port', 'powerup', 'shot', 'swap', 'throw', 'ui', 'focus', 'campaign'];
export class Audio {
  constructor() { this.ctx = null; this.buf = {}; this.vol = 0.7; this.last = {}; }
  async wake() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    await Promise.all(NAMES.map(async n => {
      try { const r = await fetch('./audio/' + n + '.wav'); this.buf[n] = await this.ctx.decodeAudioData(await r.arrayBuffer()); } catch { /* optional */ }
    }));
    await this.loadExtra(['amb_beach_wind', 'amb_birds', 'amb_ocean', 'amb_gulls', 'amb_jungle', 'cannon_fire', 'explosion', 'splash', 'wood_break', 'stone_place', 'step_sand', 'step_wood', 'step_stone', 'orc_grunt', 'orc_die', 'metal_clang', 'gear_pickup', 'switch', 'chest_open']);
    // layered island ambience: surf + sea breeze + rainforest birds, with random gull calls
    if (!this.loop('amb_ocean', 0.42)) this.ambience();
    this.loop('amb_beach_wind', 0.12);
    this.loop('amb_jungle', 0.3);
    this.loop('amb_birds', 0.08);
    this.gullTimer = setInterval(() => { if (Math.random() < 0.5) this.sfx('amb_gulls', { vol: 0.25, vary: 0.15 }); }, 9000);
  }
  // CC0 real-world recordings (public/audio, see CREDITS_CC0.txt); fall back to the Kenney set when missing
  async loadExtra(names) {
    if (!this.ctx) return;
    await Promise.all(names.map(async n => {
      for (const ext of ['ogg', 'mp3', 'wav']) {
        try { const r = await fetch('./audio/' + n + '.' + ext); if (!r.ok) continue; const ab = await r.arrayBuffer(); if (ab.byteLength < 800) continue; this.buf[n] = await this.ctx.decodeAudioData(ab); break; } catch { /* try next */ }
      }
    }));
  }
  sfx(n, o = {}) {
    if (this.buf[n]) return this.play(n, o);
    const F = { orc_grunt: ['hurt', 0.6], orc_die: ['death', 0.75], cannon_fire: ['shot', 0.9], explosion: ['shot', 0.7], splash: ['land', 0.6], wood_break: ['break', 1], stone_place: ['place', 1], step_sand: ['land', 1.6], step_wood: ['land', 1.8], step_stone: ['land', 2], metal_clang: ['hit', 0.8], gear_pickup: ['coin', 1], switch: ['checkpoint', 1.4] }[n];
    if (F) this.play(F[0], { ...o, rate: (o.rate || 1) * F[1] });
  }
  loop(n, vol = 0.3) {
    if (!this.ctx || !this.buf[n]) return null;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[n]; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g).connect(this.master); s.start(); return g;
  }
  play(n, { vol = 1, rate = 1, vary = 0.08 } = {}) {
    if (!this.ctx || !this.buf[n]) return;
    const now = this.ctx.currentTime; if (this.last[n] && now - this.last[n] < 0.03) return; this.last[n] = now;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[n];
    s.playbackRate.value = rate * (1 + (Math.random() - 0.5) * vary * 2);
    const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g).connect(this.master); s.start();
  }
  boom(size = 1) {
    if (!this.ctx) return;
    const c = this.ctx, len = 0.9 * size, b = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.06 * w) / 1.06; d[i] = last * 6 * Math.pow(1 - i / d.length, 2.2); }
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 0.9 * Math.min(1.4, size); s.connect(f).connect(g).connect(this.master); s.start();
    if (!this.buf.cannon_fire) this.play('shot', { vol: 0.5 * size, rate: 0.8 });
  }

  // ------------------------------------------------------------------ adaptive music
  // States: menu, explore, combat, boss, victory. Uses CC0 tracks from public/audio when present,
  // otherwise the procedural pirate orchestra below in the matching mood.
  setMusic(state) {
    if (!this.ctx || this.musicState === state) return;
    this.musicState = state;
    const c = this.ctx, now = c.currentTime;
    if (!this.musicBus) { this.musicBus = c.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master); }
    if (this.cur) { const old = this.cur; old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.linearRampToValueAtTime(0, now + 1.6); setTimeout(() => old.stop(), 1800); }
    const gain = c.createGain(); gain.gain.value = 0; gain.connect(this.musicBus);
    gain.gain.linearRampToValueAtTime(state === 'victory' ? 1 : 0.9, now + (state === 'combat' || state === 'boss' ? 0.6 : 2.0));
    const buf = this.buf['music_' + state];
    if (buf) {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = state !== 'victory'; s.connect(gain); s.start();
      this.cur = { gain, stop: () => { try { s.stop(); } catch { } } };
    } else this.cur = { gain, ...this.band(state, gain) };
  }
  // Procedural swashbuckling orchestra: D minor, driving 6/8 string ostinato, horn melody, timpani.
  // (Original phrases written for this game; the style is epic-pirate-film, not a copy of any theme.)
  band(state, out) {
    const c = this.ctx;
    const CFG = {
      menu: { epm: 192, gain: 0.9, ost: 'saw', pad: 0.05, horn: 0.075, fiddle: 0, timp: 0.6, snare: 0, crash: 1, choir: 0 },
      explore: { epm: 168, gain: 0.7, ost: 'pizz', pad: 0.035, horn: 0, fiddle: 0.05, timp: 0.25, snare: 0, crash: 0, choir: 0, sparse: true },
      combat: { epm: 228, gain: 1, ost: 'saw', pad: 0.045, horn: 0.06, fiddle: 0, timp: 0.8, snare: 0.11, crash: 1, choir: 0, stabs: true },
      boss: { epm: 240, gain: 1.05, ost: 'saw', pad: 0.05, horn: 0.09, fiddle: 0, timp: 1, snare: 0.13, crash: 1, choir: 0.035, stabs: true, roll: true },
      victory: { epm: 200, gain: 1, ost: 'saw', pad: 0.06, horn: 0.09, fiddle: 0, timp: 0.9, snare: 0.1, crash: 1, choir: 0.03, once: true },
    };
    const M = CFG[state] || CFG.explore;
    const ROOT = 50; // D3
    // progression (bars): i  VI  VII  i  iv  VI  V  i
    const PROG = state === 'victory' ? [8, 10, 0, 0] : state === 'boss' ? [0, 0, 1, 0, 0, 8, 7, 7] : [0, 8, 10, 0, 5, 8, 7, 0];
    const Q = { 0: [0, 3, 7], 5: [0, 3, 7], 7: [0, 4, 7], 8: [0, 4, 7], 10: [0, 4, 7], 1: [0, 4, 7], 3: [0, 4, 7] };
    // original horn melody, [step(0-11), semitone above D4, length in steps] per bar
    const MEL = [
      [[0, 12, 3], [3, 15, 3], [6, 17, 4], [10, 19, 2]],
      [[0, 20, 3], [3, 19, 3], [6, 17, 6]],
      [[0, 19, 2], [2, 20, 2], [4, 22, 2], [6, 24, 6]],
      [[0, 24, 3], [3, 22, 3], [6, 19, 6]],
      [[0, 17, 3], [3, 19, 3], [6, 22, 4], [10, 20, 2]],
      [[0, 19, 3], [3, 17, 3], [6, 15, 6]],
      [[0, 16, 2], [2, 17, 2], [4, 19, 2], [6, 23, 3], [9, 19, 3]],
      [[0, 24, 9], [9, 12, 3]],
    ];
    const VICT = [[[0, 20, 3], [3, 22, 3], [6, 24, 6]], [[0, 22, 3], [3, 24, 3], [6, 26, 6]], [[0, 24, 6], [6, 28, 6]], [[0, 26, 12]]];
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const bus = c.createGain(); bus.gain.value = M.gain; bus.connect(out);
    // a little hall reverb for the orchestra
    const rev = c.createConvolver(); { const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); } rev.buffer = ir; }
    const wet = c.createGain(); wet.gain.value = 0.28; rev.connect(wet).connect(bus);
    const env = (t, a, hold, rel, peak, dest = bus) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); g.connect(dest); if (dest === bus) g.connect(rev); return g; };
    const osc = (type, f, t, end, dest, det = 0) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(dest); o.start(t); o.stop(end); return o; };
    const lp = (f, q = 0.7) => { const x = c.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = f; x.Q.value = q; return x; };
    const noise = c.createBuffer(1, c.sampleRate, c.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const strings = (t, m, len, v, bright = 1600) => { const g = env(t, 0.008, len * 0.4, len * 0.7, v), f = lp(bright, 1.2); f.connect(g); for (const d of [-9, 7]) osc('sawtooth', hz(m), t, t + len * 1.3, f, d); };
    const pizz = (t, m, v) => { const g = env(t, 0.003, 0.02, 0.28, v), f = lp(1800); f.connect(g); osc('triangle', hz(m), t, t + 0.4, f); osc('sine', hz(m) * 2, t, t + 0.25, f); };
    const pad = (t, ms, len, v) => { for (const m of ms) { const g = env(t, 0.35, len * 0.6, 0.8, v), f = lp(1100); f.connect(g); for (const d of [-12, 0, 11]) osc('sawtooth', hz(m), t, t + len + 0.9, f, d); } };
    const horn = (t, m, len, v) => {
      const g = env(t, 0.06, Math.max(0.05, len - 0.1), 0.25, v), f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(2200, t + 0.12); f.frequency.linearRampToValueAtTime(1300, t + len); f.connect(g);
      const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.2; vg.gain.value = 6; vib.connect(vg); vib.start(t); vib.stop(t + len + 0.4);
      for (const [type, d] of [['sawtooth', -5], ['sawtooth', 5], ['square', 0]]) { const o = osc(type, hz(m), t, t + len + 0.4, f, d); vg.connect(o.detune); }
      osc('sawtooth', hz(m - 12), t, t + len + 0.4, f, 3);
    };
    const fiddle = (t, m, len, v) => {
      const g = env(t, 0.05, len * 0.7, 0.3, v), f = c.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = 2500; f.gain.value = 8; const l = lp(3500); f.connect(l).connect(g);
      const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 6; vg.gain.value = 12; vib.connect(vg); vib.start(t); vib.stop(t + len + 0.4);
      vg.connect(osc('sawtooth', hz(m), t, t + len + 0.4, f).detune);
    };
    const choir = (t, ms, len, v) => { for (const m of ms) { const g = env(t, 0.5, len * 0.5, 1, v); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2; f.connect(g); for (const d of [-8, 8]) osc('sawtooth', hz(m), t, t + len + 1.5, f, d); } };
    const timp = (t, m, v) => { const g = env(t, 0.004, 0.05, 0.9, v); const o = c.createOscillator(); o.frequency.setValueAtTime(hz(m) * 1.5, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.08); o.connect(g); o.start(t); o.stop(t + 1.1);
      const s = c.createBufferSource(); s.buffer = noise; const nf = lp(300); const ng = env(t, 0.002, 0.01, 0.12, v * 0.6); s.connect(nf).connect(ng); s.start(t); s.stop(t + 0.2); };
    const snare = (t, v) => { const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; const g = env(t, 0.002, 0.01, 0.13, v); s.connect(f).connect(g); s.start(t); s.stop(t + 0.2); };
    const crash = (t, v) => { const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000; const g = env(t, 0.005, 0.1, 1.8, v); s.connect(f).connect(g); s.start(t); s.stop(t + 2); };

    const st = 60 / M.epm / 2; // one 16th in 6/8
    let next = c.currentTime + 0.12, step = 0, alive = true;
    const tick = () => {
      if (!alive) return;
      while (next < c.currentTime + 0.3) {
        const bar = Math.floor(step / 12), s = step % 12, ch = PROG[bar % PROG.length], tri = Q[ch] || [0, 3, 7];
        if (M.once && bar >= PROG.length) { alive = false; break; }
        const phraseBar = bar % 8;
        // driving ostinato: eighth-note gallop on the chord root with an accent each dotted quarter
        if (s % 2 === 0) {
          const acc = s === 0 || s === 6 ? 1.4 : 1;
          if (M.ost === 'saw') { strings(next, ROOT + ch, st * 1.6, 0.05 * acc); if (s === 0 || s === 6) strings(next, ROOT + ch - 12, st * 2.5, 0.05); }
          else if (s === 0 || s === 4 || s === 6 || s === 10) pizz(next, ROOT + 12 + ch + (s === 4 || s === 10 ? 7 : 0), 0.11);
        }
        if (M.stabs && (s === 0 || s === 6) && bar % 2 === 1) for (const iv of tri) strings(next, ROOT + 12 + ch + iv, st * 1.2, 0.035, 2600);
        // sustained chord pad (+ choir for the boss)
        if (s === 0) { pad(next, tri.map(iv => ROOT + 12 + ch + iv), st * 11, M.pad); if (M.choir) choir(next, tri.map(iv => ROOT + 24 + ch + iv), st * 11, M.choir); }
        // percussion
        if (M.timp && (s === 0 || s === 6)) timp(next, ROOT - 12 + (ch === 7 ? 7 : ch === 5 ? 5 : 0), 0.35 * M.timp);
        if (M.roll && phraseBar === 7 && s >= 6) timp(next, ROOT - 12, 0.18 + (s - 6) * 0.04);
        if (M.snare && (s === 3 || s === 9)) snare(next, M.snare);
        if (M.snare && phraseBar % 4 === 3 && s >= 8) snare(next, M.snare * 0.7);
        if (M.crash && s === 0 && phraseBar === 0) crash(next, 0.05);
        // melody: horns (heroic) or fiddle (exploring, sparser and an octave up)
        const mel = state === 'victory' ? VICT[bar % VICT.length] : MEL[phraseBar];
        const play = !M.sparse || (Math.floor(bar / 8) % 2 === 0 && phraseBar < 4) || phraseBar >= 6;
        for (const [ms, semi, len] of mel) if (ms === s && play) {
          if (M.horn) horn(next, ROOT + 12 + semi - (state === 'boss' ? 0 : 0), len * st, M.horn);
          if (M.fiddle) fiddle(next, ROOT + 24 + semi, len * st, M.fiddle);
        }
        next += st; step++;
      }
    };
    const iv = setInterval(tick, 50); tick();
    return { stop: () => { alive = false; clearInterval(iv); setTimeout(() => bus.disconnect(), 3000); } };
  }
  ambience() {
    const c = this.ctx, len = 4, b = c.createBuffer(2, c.sampleRate * len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
    const s = c.createBufferSource(); s.buffer = b; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = c.createGain(); g.gain.value = 0.18;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.1; lfo.connect(lg).connect(g.gain); lfo.start();
    s.connect(f).connect(g).connect(this.master); s.start();
  }
}
