// Player characters: movement, abilities, and follow-the-leader AI.
import * as T from 'three';
import { Body, moveBody } from './physics.js';
import { buildCubey, buildCanon } from './characters.js';
import { Cube } from './entities.js';
import { MAT } from './materials.js';
import { rbox } from './geo.js';

const V = new T.Vector3(), V2 = new T.Vector3(), V3 = new T.Vector3();
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const MAX_CUBES = 4;

export class Hero {
  constructor(G, kind) {
    this.G = G; this.kind = kind; this.name = kind === 'cubey' ? 'Cubey' : 'Canon';
    this.model = kind === 'cubey' ? buildCubey() : buildCanon();
    G.scene.add(this.model.root);
    this.body = new Body(kind === 'cubey' ? 0.42 : 0.45, kind === 'cubey' ? 1.6 : 1.9);
    this.maxHp = 8; this.hp = 8; this.facing = Math.PI; this.visFacing = Math.PI; this.inv = 0;
    this.jumps = 0; this.coyote = 0; this.buffer = 0; this.wasGrounded = true;
    this.rail = null; this.railT = 0; this.railSpeed = 0; this.railCd = 0;
    this.shield = false; this.aiming = false; this.charge = 0; this.fireCd = 0; this.slamming = false; this.placeCd = 0;
    this.safe = new T.Vector3(); this.safeT = 0; this.stuck = 0; this.t = 0; this.speed = 0;
    this.aimPitch = null;
    if (kind === 'cubey') {
      this.shieldGroup = new T.Group();
      for (let i = 0; i < 6; i++) {
        const m = new T.Mesh(rbox(0.52, 0.52, 0.4, 0.05, 2), [MAT.cement, MAT.cementLight, MAT.cementWarm][i % 3]);
        m.castShadow = true; m.userData.keep = true; m.userData.home = new T.Vector3((i % 3 - 1) * 0.58, 0.32 + Math.floor(i / 3) * 0.56, 0.95);
        m.position.copy(m.userData.home); m.position.y -= 1; m.scale.setScalar(0.01);
        this.shieldGroup.add(m);
      }
      this.model.root.add(this.shieldGroup); this.shieldAmt = 0;
    }
  }
  get pos() { return this.body.pos; }
  place(x, y, z, facing) { this.body.pos.set(x, y, z); this.body.vel.set(0, 0, 0); this.facing = this.visFacing = facing; this.safe.set(x, y, z); this.rail = null; }

  // ------------------------------------------------------------------ main update
  update(dt, inp, leader) {
    const G = this.G, b = this.body;
    this.t += dt; this.inv = Math.max(0, this.inv - dt); this.fireCd -= dt; this.placeCd -= dt; this.railCd -= dt;
    let wish = V3.set(0, 0, 0), jump = false, jumpHeld = false;
    if (inp) {
      const cam = G.cam, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      wish.set(rx * inp.mx + fx * inp.mz, 0, rz * inp.mx + fz * inp.mz);
      jump = inp.jump; jumpHeld = inp.jumpHeld;
      this.abilities(dt, inp);
    } else {
      const ai = this.follow(dt, leader); wish.copy(ai.wish); jump = ai.jump; jumpHeld = ai.held;
      this.shield = false; this.aiming = false; this.charge = 0;
    }
    if (this.rail) { this.rideRail(dt, jump); this.animate(dt); return; }

    // movement
    let max = this.kind === 'cubey' ? 7.4 : 6.8;
    if (!inp && leader) max *= 1.15;
    if (this.shield) max *= 0.32; else if (this.aiming || this.charge > 0.15) max *= 0.62;
    const ac = b.grounded ? 60 : 24;
    for (const k of ['x', 'z']) {
      const tgt = wish[k] * max, d = tgt - b.vel[k], s = ac * dt;
      b.vel[k] += Math.max(-s, Math.min(s, d));
    }
    if (this.slamming) { b.vel.x *= 0.9; b.vel.z *= 0.9; }
    // facing
    const wl = Math.hypot(wish.x, wish.z);
    if (inp && (this.aiming || this.kind === 'canon')) this.facing = angLerp(this.facing, Math.atan2(-Math.sin(G.cam.yaw), -Math.cos(G.cam.yaw)), Math.min(1, dt * 18));
    else if (wl > 0.1 && !this.shield) this.facing = Math.atan2(wish.x, wish.z);
    else if (this.shield && wl > 0.1 && inp) this.facing = angLerp(this.facing, Math.atan2(wish.x, wish.z), Math.min(1, dt * 3));
    // jumping
    if (b.grounded) { this.coyote = 0.12; this.jumps = 0; } else this.coyote -= dt;
    if (jump) this.buffer = 0.13; else this.buffer -= dt;
    if (this.buffer > 0 && !this.slamming && !this.shield) {
      if (this.coyote > 0 && this.jumps === 0) {
        b.vel.y = 9.6; this.jumps = 1; this.coyote = 0; this.buffer = 0; b.grounded = false;
        this.model.jump(); G.audio.play('jump', { vol: 0.5 });
      } else if (jump && this.jumps < 2 && !b.grounded) {
        b.vel.y = 8.4; this.jumps = 2; this.buffer = 0;
        this.model.jump(); G.audio.play('jump', { vol: 0.5, rate: 1.25 });
        G.fx.puff(V.copy(b.pos), 4, 0.4, 0.7, [0.95, 0.95, 0.95], 0.2, 0.5);
      }
    }
    if (!jumpHeld && b.vel.y > 2 && this.jumps === 1) b.vel.y -= 34 * dt; // variable height
    const wasG = b.grounded;
    moveBody(G.world, b, dt);
    if (b.grounded && !wasG) this.landed(b.landSpeed);
    // rails
    if (!b.grounded && this.railCd <= 0) for (const r of G.rails) {
      const n = r.nearest(V.copy(b.pos).setY(b.pos.y + 0.1));
      if (n.d < 0.85 && n.t < 0.97) { this.attachRail(r, n.t); break; }
    }
    // safe ground for water respawn
    this.safeT -= dt;
    if (b.grounded && b.ground?.tag === 'static' && this.safeT <= 0) { this.safe.copy(b.pos); this.safeT = 0.25; }
    if (b.pos.y < -1.1) this.fellInWater();
    this.speed = Math.hypot(b.vel.x, b.vel.z);
    this.animate(dt);
  }

  landed(v) {
    const G = this.G;
    this.model.land(v);
    if (v > 11) { G.fx.puff(V.copy(this.body.pos), 6, 0.6, 0.9, [0.85, 0.82, 0.76], 0.4, 0.7); G.audio.play('land', { vol: 0.5 }); }
    if (this.slamming) {
      this.slamming = false;
      const p = V.copy(this.body.pos);
      G.fx.ring(p, 5, 0.4); G.fx.chunks(p.clone().setY(p.y + 0.2), 10, 0.18, 0xcfcac2, p.y, 6); G.fx.puff(p, 10, 1.2, 1.4, [0.82, 0.8, 0.76], 0.6);
      G.shake(0.45); G.audio.play('break', { vol: 0.8, rate: 0.6 }); G.audio.boom(0.5);
      G.slamAt(p, 2.8);
    }
  }

  // ------------------------------------------------------------------ abilities
  abilities(dt, inp) {
    const G = this.G, b = this.body;
    if (this.kind === 'cubey') {
      this.shield = inp.secondaryHeld && b.grounded && !this.slamming;
      if (inp.primary) {
        if (!b.grounded && !this.slamming && b.pos.y > b.lastGroundY + 0.6) {
          this.slamming = true; b.vel.y = -24; this.model.action('slam', 0.6);
          G.audio.play('throw', { vol: 0.6, rate: 0.7 });
        } else if (b.grounded && this.placeCd <= 0 && !this.shield) this.placeCube();
      }
      if (inp.recall && G.cubes.length) { for (const c of G.cubes) c.crumble(); G.cubes.length = 0; G.audio.play('swap', { vol: 0.6, rate: 0.8 }); }
    } else {
      this.aiming = inp.secondaryHeld;
      if (inp.primaryHeld && this.fireCd <= 0) this.charge = Math.min(1.2, this.charge + dt);
      if (this.charge > 0 && (inp.primaryUp || !inp.primaryHeld)) {
        this.fire(this.charge >= 0.85);
        this.charge = 0;
      }
      if (this.charge > 0.85 && Math.random() < dt * 30) {
        this.model.emberWorld(V); G.fx.glow.emit(V.x, V.y, V.z, (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.15, 0.4, 1, 0.6, 0.2, { grav: 6 });
      }
    }
  }

  // Where the next cube would land (used for placement and the ghost preview)
  // Cell under the crosshair (third-person-shooter style placement), within reach of Cubey
  aimCell() {
    const G = this.G, b = this.body, cam = G.R.camera, dir = G.cam.forward(new T.Vector3());
    const hit = G.world.raycast(cam.position, dir, 30, s => (s.walkable || s.height) && s.tag !== 'mover');
    if (!hit.solid) return null;
    const p = cam.position.clone().addScaledVector(dir, hit.dist + 0.02);
    const top = G.world.groundAt(p.x, p.z, 0.05, p.y + 0.3);
    if (!top.solid || p.y > top.y + 0.12) p.addScaledVector(dir, -0.55); // hit a wall face: step back toward the camera
    const d = Math.hypot(p.x - b.pos.x, p.z - b.pos.z);
    if (d < 0.75 || d > 6.5) return null;
    const cx = Math.floor(p.x) + 0.5, cz = Math.floor(p.z) + 0.5;
    for (const h of G.heroes) if (Math.abs(h.pos.x - cx) < 0.5 + h.body.r - 0.05 && Math.abs(h.pos.z - cz) < 0.5 + h.body.r - 0.05) return null;
    const g = G.world.groundAt(cx, cz, 0.45, Math.max(b.pos.y + 2.2, p.y + 0.2));
    if (!g.solid || g.y > b.pos.y + 2.25 || g.y < b.pos.y - 5) return null;
    if (G.world.pointInside(V.set(cx, g.y + 0.5, cz), -0.06) || G.world.pointInside(V.set(cx, g.y + 0.95, cz), -0.06)) return null;
    return { cx, y: g.y, cz };
  }
  findCell() {
    if (this.G.active === this) { const a = this.aimCell(); if (a) return a; }
    const G = this.G, b = this.body, fx = Math.sin(this.facing), fz = Math.cos(this.facing);
    for (const dist of [1.3, 1.9, 0.9]) {
      const cx = Math.floor(b.pos.x + fx * dist) + 0.5, cz = Math.floor(b.pos.z + fz * dist) + 0.5;
      let blocked = false;
      for (const h of G.heroes) if (Math.abs(h.pos.x - cx) < 0.5 + h.body.r - 0.05 && Math.abs(h.pos.z - cz) < 0.5 + h.body.r - 0.05) blocked = true;
      if (blocked) continue;
      const g = G.world.groundAt(cx, cz, 0.45, b.pos.y + 2.2);
      const y = g.solid ? g.y : -6;
      if (G.world.pointInside(V.set(cx, y + 0.5, cz), -0.06)) continue;
      if (G.world.pointInside(V.set(cx, y + 0.95, cz), -0.06)) continue;
      return { cx, y, cz };
    }
    return null;
  }
  placeCube() {
    const G = this.G, c = this.findCell();
    if (!c) { G.audio.play('ui', { vol: 0.4, rate: 0.6 }); return false; }
    const { cx, y, cz } = c;
    this.facing = Math.atan2(cx - this.body.pos.x, cz - this.body.pos.z);
    for (const e of G.enemies) if (!e.dead && !e.flying && Math.abs(e.pos.x - cx) < 0.9 && Math.abs(e.pos.z - cz) < 0.9 && Math.abs(e.pos.y - y) < 1.2) e.hit(4, V2.set(cx, y + 1, cz));
    G.cubes.push(new Cube(G, cx, y, cz));
    if (G.cubes.length > MAX_CUBES) G.cubes.shift().crumble();
    this.placeCd = 0.28; this.model.action('place', 0.32);
    G.fx.puff(V.set(cx, y + 0.3, cz), 6, 0.8, 1.0, [0.86, 0.84, 0.8], 0.6, 0.6);
    G.audio.sfx('stone_place', { vol: 0.8 });
    G.stats.cubes++;
    return true;
  }

  fire(charged) {
    const G = this.G;
    if (this.fireCd > 0) return;
    this.fireCd = charged ? 0.7 : 0.36;
    const target = G.aimPoint(this);
    const origin = V.copy(this.body.pos); origin.y += 1.78;
    const dir = V2.subVectors(target, origin).normalize();
    this.facing = Math.atan2(dir.x, dir.z); this.visFacing = this.facing;
    this.model.root.rotation.y = this.facing;
    origin.addScaledVector(dir, 0.75);
    G.spawnCannonball(origin, dir, charged, this);
    this.model.fire(charged ? 2 : 1);
    G.fx.flash(origin, charged ? 80 : 40, 0.1);
    G.fx.puff(origin, charged ? 10 : 5, 0.3, charged ? 1.3 : 0.9, [0.75, 0.73, 0.7], 0.5, 0.8);
    for (let i = 0; i < 8; i++) G.fx.glow.emit(origin.x, origin.y, origin.z, dir.x * 8 + (Math.random() - 0.5) * 3, dir.y * 8 + (Math.random() - 0.5) * 3, dir.z * 8 + (Math.random() - 0.5) * 3, charged ? 0.9 : 0.6, 0.12, 1, 0.6, 0.2, { drag: 6 });
    G.audio.sfx('cannon_fire', { vol: charged ? 1 : 0.75, rate: charged ? 0.85 : 1 }); G.audio.boom(charged ? 0.5 : 0.25);
    G.shake(charged ? 0.35 : 0.12);
    this.body.vel.addScaledVector(dir, charged ? -5 : -1.5);
  }

  // ------------------------------------------------------------------ rails
  attachRail(r, t) {
    this.rail = r; this.railT = t; this.railSpeed = Math.max(11, Math.hypot(this.body.vel.x, this.body.vel.z) + 2);
    this.slamming = false; this.jumps = 0; this.G.audio.play('land', { vol: 0.7, rate: 1.4 });
  }
  rideRail(dt, jump) {
    const r = this.rail, b = this.body, G = this.G;
    const tan = r.curve.getTangentAt(Math.min(0.999, this.railT));
    this.railSpeed = Math.min(16, this.railSpeed + (-tan.y * 14 + 1) * dt);
    this.railT += this.railSpeed * dt / r.len;
    const p = r.curve.getPointAt(Math.min(1, this.railT));
    b.pos.copy(p); b.pos.y += 0.06;
    this.facing = Math.atan2(tan.x, tan.z);
    b.vel.copy(tan).multiplyScalar(this.railSpeed);
    if (Math.random() < dt * 40) G.fx.glow.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 3 - tan.x * 3, Math.random() * 3, (Math.random() - 0.5) * 3 - tan.z * 3, 0.14, 0.35, 1, 0.75, 0.3, { grav: 12 });
    if (jump || this.railT >= 1) {
      this.rail = null; this.railCd = 0.5; b.grounded = false; this.jumps = jump ? 1 : 1;
      if (jump) { b.vel.y = 9; this.model.jump(); G.audio.play('jump', { vol: 0.5 }); }
    }
    this.speed = 5;
  }

  // ------------------------------------------------------------------ follower AI
  follow(dt, L) {
    const G = this.G, b = this.body, P = b.pos, LP = L.body.pos, out = { wish: new T.Vector3(), jump: false, held: false };
    if (L.rail && !this.rail) {
      const t = Math.max(0, L.railT - 2.2 / L.rail.len);
      G.fx.puff(V.copy(P).setY(P.y + 0.8), 8, 0.6, 1.0); this.attachRail(L.rail, t); this.railSpeed = L.railSpeed;
      return out;
    }
    const dist = P.distanceTo(LP);
    if (dist > 22 || P.y < 0.2 || this.stuck > 2.0) { this.teleportBehind(L); return out; }
    let target = null;
    const trail = G.trail;
    if (L.shield) target = V.set(LP.x - Math.sin(L.facing) * 1.4, LP.y, LP.z - Math.cos(L.facing) * 1.4);
    else {
      while (trail.length && Math.hypot(trail[0].x - P.x, trail[0].z - P.z) < 0.8 && Math.abs(trail[0].y - P.y) < 1.4) trail.shift();
      const close = Math.hypot(LP.x - P.x, LP.z - P.z) < 2.4 && Math.abs(LP.y - P.y) < 1.0;
      if (close) { if (trail.length > 2) trail.splice(0, trail.length - 2); }
      else target = trail[0] || LP;
    }
    if (target) {
      const dx = target.x - P.x, dz = target.z - P.z, d = Math.hypot(dx, dz);
      if (d > 0.05) out.wish.set(dx / d, 0, dz / d).multiplyScalar(Math.min(1, d / 1.0 + 0.35));
      if (b.grounded) {
        if (target.y - P.y > 0.5 && d < 3.4) out.jump = true;
        const ax = P.x + dx / Math.max(d, 0.01) * 0.95, az = P.z + dz / Math.max(d, 0.01) * 0.95;
        const g = G.world.groundAt(ax, az, 0.25, P.y + 0.45);
        if ((!g.solid || g.y < P.y - 1.0) && target.y > P.y - 1.2 && d > 0.6) out.jump = true;
        if (b.hitWall && target.y > P.y + 0.2) out.jump = true;
      } else if (this.jumps === 1 && b.vel.y < 1.5 && target.y > P.y + 0.2) out.jump = true;
      out.held = b.vel.y > 0 || out.jump;
      if (this.speed < 0.6 && out.wish.lengthSq() > 0.2) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt * 2);
    } else this.stuck = 0;
    return out;
  }
  teleportBehind(L) {
    const G = this.G, P = this.body.pos;
    G.fx.puff(V.copy(P).setY(P.y + 0.8), 10, 0.6, 1.2, [0.9, 0.9, 0.9]);
    const LP = L.body.pos;
    let placed = false;
    for (const back of [1.4, 2.0, 0.8]) for (const side of [0, 1, -1]) {
      if (placed) break;
      const a = L.facing + Math.PI + side * 0.9, x = LP.x + Math.sin(a) * back, z = LP.z + Math.cos(a) * back;
      const g = G.world.groundAt(x, z, this.body.r, LP.y + 0.6);
      if (g.solid && Math.abs(g.y - LP.y) < 0.7 && !G.world.pointInside(V2.set(x, g.y + 1, z), -0.1)) { P.set(x, g.y, z); placed = true; }
    }
    if (!placed) P.copy(LP);
    this.body.vel.set(0, 0, 0); this.stuck = 0; this.body.grounded = true; this.body.ground = null;
    G.trail.length = 0;
    G.fx.puff(V.copy(P).setY(P.y + 0.8), 10, 0.6, 1.2, [0.9, 0.9, 0.9]);
    G.audio.play('swap', { vol: 0.3, rate: 1.4 });
  }

  // ------------------------------------------------------------------ damage
  hurt(n, from) {
    const G = this.G;
    if (this.inv > 0 || G.active !== this || G.over) return false;
    if (this.shield && from) {
      const fx = Math.sin(this.facing), fz = Math.cos(this.facing), dx = from.x - this.pos.x, dz = from.z - this.pos.z;
      if ((dx * fx + dz * fz) / Math.max(0.01, Math.hypot(dx, dz)) > 0.3) { G.fx.sparks(V.set(this.pos.x + fx, this.pos.y + 1, this.pos.z + fz), 8, 4, [0.9, 0.9, 0.9]); G.audio.play('hit', { vol: 0.5, rate: 0.7 }); return false; }
    }
    this.hp = Math.max(0, this.hp - n); this.inv = 1.1;
    if (from) { const d = V.subVectors(this.pos, from).setY(0).normalize(); this.body.vel.addScaledVector(d, 7); this.body.vel.y = Math.max(this.body.vel.y, 5); this.body.grounded = false; }
    G.audio.play('hurt', { vol: 0.8 }); G.shake(0.3); G.damageFlash();
    if (this.hp <= 0) G.onDeath();
    return true;
  }
  fellInWater() {
    const G = this.G;
    G.fx.splash(V.copy(this.body.pos).setY(0.1)); G.audio.sfx('splash', { vol: 0.8 });
    if (G.active === this) {
      this.hp = Math.max(0, this.hp - 1); G.damageFlash();
      if (this.hp <= 0) { G.onDeath(); return; }
      this.body.pos.copy(this.safe); this.body.vel.set(0, 0, 0); this.inv = 1.2; this.rail = null;
      G.cam.snap = true;
      const other = G.heroes.find(h => h !== this); other.teleportBehind(this);
    } else this.teleportBehind(G.active);
  }

  // ------------------------------------------------------------------ visuals
  animate(dt) {
    const m = this.model, b = this.body;
    // footsteps that match the surface underfoot
    if (b.grounded && this.speed > 1.2 && !this.rail) {
      this.stepT = (this.stepT || 0) - dt * this.speed;
      if (this.stepT <= 0) {
        this.stepT = this.kind === 'cubey' ? 2.6 : 2.9;
        const s = b.ground?.surface || 'stone', surf = s === 'sand' ? 'step_sand' : s === 'wood' ? 'step_wood' : 'step_stone';
        this.G.audio.sfx(surf, { vol: this.G.active === this ? 0.35 : 0.15, rate: this.kind === 'cubey' ? 0.8 : 1.0, vary: 0.12 });
      }
    }
    m.root.position.copy(b.pos);
    this.visFacing = angLerp(this.visFacing, this.facing, Math.min(1, dt * 16));
    m.root.rotation.y = this.visFacing;
    m.root.rotation.z = this.rail ? Math.sin(this.t * 20) * 0.03 : 0;
    m.root.visible = this.inv <= 0 || Math.floor(this.inv * 14) % 2 === 0 || this.G.active !== this;
    const tracks = this.aiming || (this.kind === 'canon' && this.G.active === this && !this.rail);
    m.animate(dt, { speed: this.speed, grounded: b.grounded || !!this.rail, vy: b.vel.y, t: this.t, shield: this.shield, aiming: this.aiming, charge: this.charge, aimPitch: tracks ? this.G.cam.pitchAim : null });
    if (this.shieldGroup) {
      this.shieldAmt += ((this.shield ? 1 : 0) - this.shieldAmt) * Math.min(1, dt * 14);
      this.shieldGroup.children.forEach((c, i) => {
        const k = Math.max(0, Math.min(1, this.shieldAmt * 1.6 - i * 0.1));
        c.scale.setScalar(Math.max(0.01, k));
        c.position.set(c.userData.home.x, c.userData.home.y - (1 - k) * 1.2 + Math.sin(this.t * 3 + i) * 0.02 * k, c.userData.home.z);
        c.visible = k > 0.02;
      });
    }
  }
}
