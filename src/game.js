// Game state: heroes, projectiles, enemies, entities, events.
import * as T from 'three';
import { World } from './physics.js';
import { FX } from './fx.js';
import { Hero } from './hero.js';
import { CamRig } from './camera.js';
import { Gear, HealthOrb, GoldenGear } from './entities.js';
import { Bilgebot, Gull, Brute, Bomber } from './enemies.js';
import { MAT } from './materials.js';

const V = new T.Vector3(), V2 = new T.Vector3();
const ballGeo = new T.SphereGeometry(0.2, 16, 12), boltGeo = new T.SphereGeometry(0.16, 10, 8), bombGeo = new T.SphereGeometry(0.35, 14, 10);

export class Game {
  constructor(R, audio, hud, levelIndex = 1, mod) {
    this.levelIndex = levelIndex; this.diff = levelIndex; this.levelInfo = mod.info;
    this.R = R; this.scene = R.scene; this.audio = audio; this.hud = hud;
    this.world = new World(); this.fx = new FX(this.scene);
    this.cam = new CamRig(R.camera);
    this.time = 0; this.gears = 0; this.golden = new Set(); this.goldenTotal = mod.info.golden ?? 3;
    this.entities = []; this.enemies = []; this.cubes = []; this.rails = []; this.projectiles = []; this.trail = []; this.updaters = [];
    this.stats = { kills: 0, cubes: 0, crates: 0, start: performance.now() };
    this.over = false; this.won = false; this.boss = null;
    this.heroes = [new Hero(this, 'cubey'), new Hero(this, 'canon')];
    this.activeIndex = 0;
    this.level = mod.build(this);
    const s = this.level.start;
    this.heroes[0].place(s.x, s.y, s.z, Math.PI);
    this.heroes[1].place(s.x + 1.2, s.y, s.z + 1.6, Math.PI);
    this.checkpoint = { pos: new T.Vector3(s.x, s.y, s.z), ry: Math.PI };
    this.cam.yaw = 0; this.cam.snap = true;
    this.hudDirty = true;
  }
  get active() { return this.heroes[this.activeIndex]; }
  get partner() { return this.heroes[1 - this.activeIndex]; }

  swap() {
    if (this.active.rail || this.over) return;
    const old = this.active; old.shield = false; old.aiming = false; old.charge = 0;
    this.activeIndex = 1 - this.activeIndex; this.trail.length = 0;
    this.audio.play('swap', { vol: 0.7 });
    this.fx.puff(V.copy(this.active.pos).setY(this.active.pos.y + 1), 6, 0.5, 0.8, [1, 0.95, 0.85]);
    this.hud.swap(this.active);
    if (!this.seenSwap) { this.seenSwap = true; }
  }

  update(dt, inp) {
    this.time += dt;
    this.world.clearDeltas();
    for (const u of this.updaters) u(dt, this);
    for (const e of this.entities) if (!e.dead && e.update) e.update(dt);
    if (inp.swap) this.swap();
    const A = this.active, P = this.partner;
    A.update(dt, inp, null);
    // leader trail
    if (!A.rail) {
      const last = this.trail[this.trail.length - 1];
      if (!last || last.distanceTo(A.pos) > 0.6) { this.trail.push(A.pos.clone()); if (this.trail.length > 90) this.trail.shift(); }
    } else this.trail.length = 0;
    P.update(dt, null, A);
    // hero overlap separation
    const dx = P.pos.x - A.pos.x, dz = P.pos.z - A.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.8 && d > 0.001 && Math.abs(P.pos.y - A.pos.y) < 1.2) { P.pos.x += dx / d * (0.8 - d); P.pos.z += dz / d * (0.8 - d); }
    for (const c of this.cubes) c.update(dt);
    this.cubes = this.cubes.filter(c => !c.dead);
    for (const e of this.enemies) if (!e.dead || e.dying > 0) e.update(dt);
    // enemy-hero body separation
    for (const e of this.enemies) {
      if (e.dead || e.flying || !e.body) continue;
      for (const h of this.heroes) {
        const ex = h.pos.x - e.pos.x, ez = h.pos.z - e.pos.z, ed = Math.hypot(ex, ez), m = 0.95;
        if (ed < m && ed > 0.001 && Math.abs(h.pos.y - e.pos.y) < 1.3) { h.pos.x += ex / ed * (m - ed) * 0.6; h.pos.z += ez / ed * (m - ed) * 0.6; e.body.pos.x -= ex / ed * (m - ed) * 0.4; e.body.pos.z -= ez / ed * (m - ed) * 0.4; }
      }
    }
    this.updateProjectiles(dt);
    this.updateGhost();
    this.fx.update(dt);
    this.entities = this.entities.filter(e => !e.dead || e.keep);
    this.cam.update(dt, inp, A, this.world, A.aiming);
    // adaptive music: explore -> combat when enemies engage (with a cool-down), boss during the fight
    this.musicT = (this.musicT || 0) - dt;
    if (this.musicT <= 0 && !this.won) {
      this.musicT = 0.4;
      if (this.enemies.some(e => !e.dead && e.aggro && e.pos.distanceTo(A.pos) < 22)) this.lastThreat = this.time;
      const st = this.boss && this.boss.active && !this.boss.dead ? 'boss' : this.time - (this.lastThreat ?? -99) < 4 ? 'combat' : 'explore';
      this.audio.setMusic(st);
    }
    this.hud.update(this);
  }

  // translucent preview of where Cubey's next cube will land
  updateGhost() {
    if (!this.ghost) {
      const geo = new T.BoxGeometry(0.98, 0.98, 0.98); geo.translate(0, 0.49, 0);
      this.ghost = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.18, depthWrite: false }));
      this.ghost.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: 0xe8fdff, transparent: true, opacity: 0.85 })));
      this.ghost.userData.noReflect = true; this.ghost.userData.noAO = true; this.scene.add(this.ghost);
    }
    const A = this.active, c = A.kind === 'cubey' && A.body.grounded && !A.shield && !this.over ? A.findCell() : null;
    this.ghost.visible = !!c && c.y > -5;
    if (this.ghost.visible) { this.ghost.position.set(c.cx, c.y + 0.01, c.cz); this.ghost.children[0].material.opacity = 0.6 + Math.sin(this.time * 6) * 0.25; }
  }

  // ------------------------------------------------------------------ aiming
  aimPoint(hero) {
    const cam = this.R.camera, o = V.copy(cam.position), dir = this.cam.forward(V2).clone();
    const skip = cam.position.distanceTo(V.copy(hero.pos).setY(hero.pos.y + 1.5)) + 0.6;
    o.copy(cam.position);
    let best = 90, point = null;
    // aim assist toward enemies near the reticle
    let assist = null, bestAng = 0.13;
    for (const e of this.enemies) {
      if (e.dead || (e.active === false)) continue;
      const c = e.center(new T.Vector3()); const to = c.clone().sub(o); const dd = to.length();
      if (dd < skip || dd > 45) continue;
      const ang = to.normalize().angleTo(dir);
      if (ang < bestAng) {
        const from = V.copy(hero.pos).setY(hero.pos.y + 1.5), ld = c.clone().sub(from), ll = ld.length();
        const hit = this.world.raycast(from, ld.normalize(), ll - e.r, s => s.blocksShots && s.owner !== e);
        if (!hit.solid) { bestAng = ang; assist = c; }
      }
    }
    if (assist) return assist;
    const start = o.clone().addScaledVector(dir, skip);
    const hit = this.world.raycast(start, dir, best, s => s.blocksShots);
    point = start.clone().addScaledVector(dir, hit.solid ? hit.dist : best);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const c = e.center(V); const t = c.clone().sub(start).dot(dir);
      if (t > 0 && t < (hit.solid ? hit.dist : best)) { const cl = start.clone().addScaledVector(dir, t); if (cl.distanceTo(c) < e.r) { point = c.clone(); break; } }
    }
    return point;
  }

  // ------------------------------------------------------------------ projectiles
  spawnCannonball(o, dir, charged, owner) {
    const m = new T.Mesh(ballGeo, MAT.iron); m.scale.setScalar(charged ? 1.7 : 1); m.position.copy(o); m.castShadow = true;
    this.scene.add(m);
    this.projectiles.push({ kind: 'ball', m, vel: dir.clone().multiplyScalar(charged ? 34 : 40), charged, life: 2.5, owner });
  }
  spawnBolt(o, dir, speed, owner) {
    const m = new T.Mesh(boltGeo, MAT.eyeRed); m.position.copy(o); this.scene.add(m);
    this.projectiles.push({ kind: 'bolt', m, vel: dir.clone().multiplyScalar(speed), life: 3, owner });
  }
  spawnBomb(o, target, T_) {
    const m = new T.Mesh(bombGeo, MAT.ironDark); m.position.copy(o); m.castShadow = true; this.scene.add(m);
    const vel = new T.Vector3((target.x - o.x) / T_, 0, (target.z - o.z) / T_);
    vel.y = (target.y - o.y + 0.5 * 26 * T_ * T_) / T_;
    const ring = new T.Mesh(new T.RingGeometry(1.6, 2.0, 32), new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(target).setY(target.y + 0.06); this.scene.add(ring);
    const fill = new T.Mesh(new T.CircleGeometry(2.0, 32), new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.18, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.copy(ring.position); this.scene.add(fill);
    this.projectiles.push({ kind: 'bomb', m, vel, life: T_ + 1, target: target.clone(), ring, fill, t0: T_, age: 0 });
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.life -= dt;
      const m = p.m;
      if (p.kind === 'ball') {
        p.vel.y -= 6 * dt;
        const step = p.vel.length() * dt, dir = V2.copy(p.vel).normalize();
        const hit = this.world.raycast(m.position, dir, step + 0.2, s => s.blocksShots && s.tag !== 'cube');
        let enemy = null, et = step + 0.2; this._shotEnt = null;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const c = e.center(new T.Vector3()), t = c.clone().sub(m.position).dot(dir);
          if (t > -0.3 && t < et && m.position.clone().addScaledVector(dir, Math.max(0, t)).distanceTo(c) < e.r + 0.25) { enemy = e; et = t; }
        }
        for (const e of this.entities) {
          if (!e.shootable || e.done) continue;
          const t = e.center.clone().sub(m.position).dot(dir);
          if (t > -0.3 && t < et && m.position.clone().addScaledVector(dir, Math.max(0, t)).distanceTo(e.center) < e.r + 0.25) { enemy = null; et = t; this._shotEnt = e; }
        }
        if (this._shotEnt && (!hit.solid || et <= hit.dist)) { const at = m.position.clone().addScaledVector(dir, Math.max(0, et)); this._shotEnt.hit(3, at, p.charged); this._shotEnt = null; this.explode(at, p.charged ? 3.6 : 2.4, p.charged ? 9 : 3, p.charged, false); p.dead = true; }
        else if (enemy && (!hit.solid || et <= hit.dist)) { const at = m.position.clone().addScaledVector(dir, Math.max(0, et)); this.hitEnemy(enemy, p, at); this.explode(at, p.charged ? 3.6 : 2.4, p.charged ? 9 : 3, p.charged, false, enemy); p.dead = true; }
        else if (hit.solid) {
          const at = m.position.clone().addScaledVector(dir, hit.dist);
          if (hit.solid.owner?.hit) hit.solid.owner.hit(p.charged ? 9 : 3, at, p.charged, at);
          this.explode(at, p.charged ? 3.6 : 2.4, p.charged ? 9 : 3, p.charged, false, hit.solid.owner);
          p.dead = true;
        } else m.position.addScaledVector(p.vel, dt);
        if (Math.random() < 0.9) this.fx.smoke.emit(m.position.x, m.position.y, m.position.z, 0, 0.3, 0, p.charged ? 0.8 : 0.45, 0.5, 0.82, 0.8, 0.78, { grow: 2, drag: 2, alpha: 0.5 });
        if (p.charged) this.fx.glow.emit(m.position.x, m.position.y, m.position.z, 0, 0, 0, 0.8, 0.15, 1, 0.5, 0.15);
        if (m.position.y < 0) { this.fx.splash(m.position.clone().setY(0.1)); p.dead = true; }
      } else if (p.kind === 'bolt') {
        const step = p.vel.length() * dt, dir = V2.copy(p.vel).normalize();
        const hit = this.world.raycast(m.position, dir, step, s => s.blocksShots && s !== p.owner.solid);
        // Cubey's shield wall
        let blocked = false;
        for (const h of this.heroes) {
          if (!h.shield) continue;
          const fx = Math.sin(h.facing), fz = Math.cos(h.facing), rx = m.position.x - h.pos.x, rz = m.position.z - h.pos.z;
          const fwd = rx * fx + rz * fz, side = rx * fz - rz * fx, up = m.position.y - h.pos.y;
          if (fwd > 0.4 && fwd < 1.5 && Math.abs(side) < 1.2 && up > -0.2 && up < 1.6) blocked = true;
        }
        const A = this.active, ap = V.copy(A.pos);
        const toHero = Math.hypot(m.position.x - ap.x, m.position.z - ap.z) < A.body.r + 0.25 && m.position.y > ap.y - 0.1 && m.position.y < ap.y + A.body.h;
        if (blocked || hit.solid) {
          this.fx.sparks(m.position, 8, 4, [1, 0.4, 0.2]); if (blocked) this.audio.play('hit', { vol: 0.4, rate: 0.8 }); p.dead = true;
          if (hit.solid?.tag === 'cube') this.fx.puff(m.position, 2, 0.2, 0.5);
        } else if (toHero) { A.hurt(1, m.position); this.fx.sparks(m.position, 8, 4, [1, 0.4, 0.2]); p.dead = true; }
        else m.position.addScaledVector(p.vel, dt);
        if (Math.random() < 0.7) this.fx.glow.emit(m.position.x, m.position.y, m.position.z, 0, 0, 0, 0.45, 0.2, 1, 0.3, 0.15);
      } else if (p.kind === 'bomb') {
        p.age += dt; p.vel.y -= 26 * dt;
        m.position.addScaledVector(p.vel, dt);
        const k = Math.min(1, p.age / p.t0);
        p.ring.scale.setScalar(1.2 - k * 0.2); p.fill.material.opacity = 0.1 + k * 0.3;
        p.ring.material.opacity = 0.5 + Math.sin(p.age * 25) * 0.3;
        if (Math.random() < 0.8) this.fx.smoke.emit(m.position.x, m.position.y, m.position.z, 0, 0, 0, 0.6, 0.6, 0.3, 0.28, 0.27, { grow: 2, alpha: 0.6 });
        const hit = p.age > 0.3 && this.world.pointInside(m.position, 0, s => s.blocksShots && s.tag !== 'mover' && !(s.owner && s.owner.name));
        if (p.age >= p.t0 || hit) {
          this.explode(m.position.clone(), 2.2, 2, false, true);
          p.dead = true; this.scene.remove(p.ring); this.scene.remove(p.fill);
        }
      }
      if (p.life <= 0 && !p.dead) { p.dead = true; if (p.ring) { this.scene.remove(p.ring); this.scene.remove(p.fill); } }
      if (p.dead) this.scene.remove(m);
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }
  hitEnemy(e, p, at) { e.hit(p.charged ? 9 : 3, at, p.charged, at); }

  explode(p, radius, dmg, charged, fromEnemy, skip) {
    this.fx.explosion(p, radius / 2.4, p.y - 0.4);
    this.audio.sfx('explosion', { vol: Math.min(1, radius / 3) }); this.audio.boom(radius / 6);
    this.shake(radius / 8);
    if (fromEnemy) {
      for (const h of this.heroes) if (h.pos.distanceTo(p) < radius + 0.3) h.hurt(dmg, p);
      for (const c of this.cubes) { const cp = c.solid; if (V.set((cp.min.x + cp.max.x) / 2, cp.min.y + 0.5, (cp.min.z + cp.max.z) / 2).distanceTo(p) < 1.0) c.crumble(); }
      return;
    }
    for (const e of this.enemies) {
      if (e.dead || e === skip || e.name) continue;
      const d = e.center(V).distanceTo(p);
      if (d < radius + e.r * 0.5) e.hit(Math.ceil(dmg * (1 - d / (radius + e.r)) + 0.5), p);
    }
    for (const e of this.entities) {
      if (e.dead || !e.hit || e === skip || e.name) continue;
      if (e.center && e.center.distanceTo(p) < radius + (e.r || 0.5)) e.hit(dmg, p, charged);
    }
  }
  slamAt(p, r) {
    for (const e of this.enemies) if (!e.dead && !e.name && e.center(V).distanceTo(p) < r + 0.8 && Math.abs(e.pos.y - p.y) < 2) { e.hit(2, p, false, null, 'slam'); e.stun = Math.max(e.stun || 0, 1.0); }
    for (const e of this.entities) if (!e.dead && e.hit && e.center && !e.iron && e.center.distanceTo(p) < r && e.constructor.name === 'Crate') e.hit(1);
    for (const e of this.entities) if (!e.dead && e.slam && e.center.distanceTo(p) < r) e.slam();
  }

  // ------------------------------------------------------------------ pickups
  spawnGears(p, n) {
    for (let i = 0; i < n; i++) {
      const big = i === 0 && n >= 8;
      this.entities.push(new Gear(this, V.copy(p), new T.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 4, (Math.random() - 0.5) * 6), big ? 5 : 1));
    }
  }
  spawnHealth(p) { for (let i = 0; i < 2; i++) this.entities.push(new HealthOrb(this, p.clone())); }
  addGears(n, at) {
    this.gears += n; this.audio.sfx('gear_pickup', { vol: 0.35, rate: 1 + Math.min(0.5, (this.gearCombo = (this.gearCombo || 0) + 0.02)) });
    clearTimeout(this._comboT); this._comboT = setTimeout(() => this.gearCombo = 0, 600);
    this.fx.glow.emit(at.x, at.y, at.z, 0, 1, 0, 0.5, 0.25, 1, 0.85, 0.4);
    this.hud.gears(this.gears);
  }
  heal(h, n) { h.hp = Math.min(h.maxHp, h.hp + n); this.partner.hp = Math.min(this.partner.maxHp, this.partner.hp + n); this.audio.play('powerup', { vol: 0.5, rate: 1.4 }); this.fx.sparks(V.copy(h.pos).setY(h.pos.y + 1), 10, 3, [0.3, 1, 0.5]); }
  collectGolden(id, at) {
    this.golden.add(id); this.audio.play('levelup', { vol: 0.8 });
    this.fx.sparks(at, 40, 7, [1, 0.85, 0.3]); this.fx.ring(at.clone().setY(this.active.pos.y), 4, 0.6, 0xffd040);
    this.hud.banner('Golden Gear', `${this.golden.size} of ${this.goldenTotal} found`);
    this.hud.gold(this.golden.size, this.goldenTotal);
    this.addGears(25, at);
  }

  // ------------------------------------------------------------------ flow
  hint(text, dur = 5, key) { if (key) { this.seenHints = this.seenHints || new Set(); if (this.seenHints.has(key)) return; this.seenHints.add(key); } this.hud.hint(text, dur); }
  objective(text) { this.hud.objective(text); }
  shake(a) { this.cam.shake(a); this.input?.rumble(a, 90 + a * 200); }
  damageFlash() { this.hud.damage(); }
  setCheckpoint(cp) {
    this.checkpoint = cp; this.audio.play('checkpoint', { vol: 0.6 });
    this.hud.toast('Checkpoint');
    for (const h of this.heroes) h.hp = Math.max(h.hp, Math.ceil(h.maxHp * 0.75));
  }
  onDeath() {
    if (this.over) return;
    this.over = true; this.audio.play('death', { vol: 0.8 });
    const A = this.active; this.fx.chunks(V.copy(A.pos).setY(A.pos.y + 0.8), 16, 0.2, A.kind === 'cubey' ? 0xcfcac2 : 0x7a5038, A.pos.y, 5);
    A.model.root.visible = false;
    setTimeout(() => this.respawn(), 1600);
    this.hud.fade(true);
  }
  respawn() {
    const c = this.checkpoint, p = c.pos;
    this.heroes[0].place(p.x, p.y, p.z, c.ry || 0);
    this.heroes[1].place(p.x - Math.cos(c.ry || 0) * 1.4, p.y, p.z + Math.sin(c.ry || 0) * 1.4, c.ry || 0);
    for (const h of this.heroes) { h.hp = h.maxHp; h.model.root.visible = true; h.inv = 1.5; }
    for (const c2 of this.cubes) c2.crumble(true); this.cubes.length = 0;
    this.trail.length = 0; this.cam.snap = true; this.cam.yaw = c.ry != null ? c.ry + Math.PI : this.cam.yaw;
    this.over = false; this.hud.fade(false);
    this.level.onRespawn?.(this);
  }
  bossSummon(boss, wave = 1) {
    const p = boss.pos, b = boss.bounds || [p.x - 12, p.x + 12, p.z - 10, p.z + 10];
    const cx = x => Math.max(b[0] + 1, Math.min(b[1] - 1, x)), cz = z => Math.max(b[2] + 1, Math.min(b[3] - 1, z));
    const spawn = e => { e.aggro = true; this.enemies.push(e); this.fx.puff(e.pos.clone().setY(e.pos.y + 1), 10, 1, 1.5); };
    if (wave === 1) { spawn(new Bilgebot(this, cx(p.x - 9), p.y, cz(p.z + 6))); spawn(new Bilgebot(this, cx(p.x + 9), p.y, cz(p.z + 6))); spawn(new Bomber(this, cx(p.x - 14), p.y, cz(p.z - 6))); }
    else { spawn(new Brute(this, cx(p.x - 10), p.y, cz(p.z + 5))); spawn(new Bomber(this, cx(p.x + 14), p.y, cz(p.z - 6))); spawn(new Bomber(this, cx(p.x - 14), p.y, cz(p.z - 6))); }
    for (const dx of [-6, 6]) spawn(new Gull(this, p.x + dx, p.y + 5, p.z));
    this.hint('Ironclaw called in reinforcements!', 3);
  }
  bossDefeated(boss) {
    this.audio.play('boss', { vol: 0.8 });
    setTimeout(() => {
      this.hud.bossBar(null);
      const g = new GoldenGear(this, boss.home.x, boss.home.y, boss.home.z, 'crown');
      g.group.scale.setScalar(1.8); g.collect = () => { g.dead = true; this.scene.remove(g.group); this.win(); };
      this.entities.push(g);
      this.objective("Claim Ironclaw's treasure");
      this.hud.banner('Admiral Ironclaw defeated!', 'Claim his treasure');
    }, 2800);
  }
  win() {
    this.won = true; this.audio.setMusic('victory');
    this.onWin?.();
  }
}
