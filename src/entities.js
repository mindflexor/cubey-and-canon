// Interactive level objects.
import * as T from 'three';
import { MAT } from './materials.js';
import { rbox, box, cyl, sph, torus, gearGeo, xf, part, lathe, compact, keep, projUV } from './geo.js';

const V = new T.Vector3(), V2 = new T.Vector3();

// ------------------------------------------------------------ gears (currency)
export class Gear {
  constructor(G, p, vel, value = 1) {
    this.G = G; this.value = value;
    const s = value > 1 ? 0.32 : 0.2;
    this.mesh = new T.Mesh(gearGeo(s, value > 1 ? 10 : 8, s * 0.35, 0.32), MAT.gear);
    this.mesh.position.copy(p); this.vel = vel.clone(); this.age = 0; this.spin = Math.random() * 6;
    this.mesh.castShadow = false;
    G.scene.add(this.mesh); this.dead = false; this.ground = -99;
  }
  update(dt) {
    const G = this.G, m = this.mesh; this.age += dt;
    let target = null, best = 6.5;
    for (const h of G.heroes) { const d = h.body.pos.distanceTo(m.position); if (d < best && this.age > 0.45) { best = d; target = h; } }
    if (target) {
      V.copy(target.body.pos); V.y += 0.8; V.sub(m.position);
      const d = V.length();
      if (d < 0.6) { this.collect(); return; }
      this.vel.lerp(V.normalize().multiplyScalar(10 + 30 / Math.max(0.5, d)), 1 - Math.exp(-8 * dt));
      m.position.addScaledVector(this.vel, dt);
    } else {
      this.vel.y -= 24 * dt; m.position.addScaledVector(this.vel, dt);
      if (this.age % 0.25 < dt || this.ground === -99) this.ground = G.world.groundAt(m.position.x, m.position.z, 0.1, m.position.y + 0.5).y;
      if (m.position.y < this.ground + 0.25) { m.position.y = this.ground + 0.25; this.vel.y = Math.abs(this.vel.y) * 0.4; this.vel.x *= 0.7; this.vel.z *= 0.7; }
      if (m.position.y < -2) this.remove();
    }
    this.spin += dt * 5; m.rotation.set(0.3, this.spin, 0);
    if (this.age > 30) this.remove();
  }
  collect() { this.G.addGears(this.value, this.mesh.position); this.remove(); }
  remove() { this.dead = true; this.G.scene.remove(this.mesh); }
}

// ------------------------------------------------------------ breakable crate
export class Crate {
  constructor(G, x, y, z, type = 'gear') {
    this.G = G; this.type = type; this.hp = 1;
    const g = this.group = new T.Group(); g.position.set(x, y, z); g.rotation.y = (Math.random() - 0.5) * 0.4;
    const s = 0.9;
    const bodyMat = type === 'health' ? MAT.paintTeal : type === 'boom' ? MAT.paintRed : MAT.wood;
    part(g, rbox(s, s, s, 0.04), bodyMat, 0, s / 2, 0, 0, 0, 0, 0.9);
    for (const sy of [0.06, s - 0.06]) for (const a of [0, 1, 2, 3]) {
      const ang = a * Math.PI / 2;
      part(g, box(s + 0.04, 0.1, 0.06), MAT.ironDark, Math.sin(ang) * s / 2, sy, Math.cos(ang) * s / 2, 0, ang, 0);
    }
    for (const a of [0, 1, 2, 3]) { const ang = a * Math.PI / 2 + Math.PI / 4; part(g, box(0.08, s + 0.04, 0.08), MAT.ironDark, Math.sin(ang) * s * 0.68, s / 2, Math.cos(ang) * s * 0.68, 0, ang, 0); }
    // emblem
    if (type === 'gear') for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) part(g, gearGeo(0.18, 8, 0.03, 0.3), MAT.brass, Math.sin(a) * (s / 2 + 0.01), s / 2, Math.cos(a) * (s / 2 + 0.01), 0, a, 0);
    if (type === 'health') for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { part(g, box(0.4, 0.12, 0.03), MAT.health, Math.sin(a) * (s / 2 + 0.01), s / 2, Math.cos(a) * (s / 2 + 0.01), 0, a, 0); part(g, box(0.12, 0.4, 0.03), MAT.health, Math.sin(a) * (s / 2 + 0.01), s / 2, Math.cos(a) * (s / 2 + 0.01), 0, a, 0); }
    if (type === 'boom') for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) part(g, box(0.5, 0.12, 0.03), MAT.paintYellow, Math.sin(a) * (s / 2 + 0.01), s / 2, Math.cos(a) * (s / 2 + 0.01), 0, a, Math.PI / 4);
    compact(g); G.scene.add(g);
    this.solid = G.world.box(x, y + s / 2, z, s, s, s, { tag: 'crate', owner: this });
    this.center = new T.Vector3(x, y + s / 2, z); this.dead = false; this.r = 0.65;
  }
  hit() { if (!this.dead) this.break(); }
  break() {
    const G = this.G; this.dead = true;
    G.scene.remove(this.group); G.world.remove(this.solid);
    G.fx.chunks(this.center, 14, 0.2, this.type === 'health' ? 0x2f8f8a : 0xb88a62, this.center.y - 0.45, 6);
    G.fx.puff(this.center, 5, 0.6, 1.2, [0.75, 0.68, 0.58]);
    G.audio.sfx('wood_break', { vol: 0.8 });
    if (this.type === 'gear') G.spawnGears(this.center, 6 + Math.floor(Math.random() * 5));
    if (this.type === 'health') G.spawnHealth(this.center);
    if (this.type === 'boom') G.explode(this.center, 2.8, 4, null);
  }
}

// ------------------------------------------------------------ barricade (wood / iron)
export class Barricade {
  constructor(G, x, y, z, w, h, iron = false, ry = 0) {
    this.G = G; this.iron = iron; this.dead = false;
    const g = this.group = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const n = Math.round(w / 0.45);
    for (let i = 0; i < n; i++) {
      const lx = -w / 2 + (i + 0.5) * w / n, hh = h * (0.85 + Math.random() * 0.2);
      part(g, rbox(w / n - 0.04, hh, 0.16, 0.03), MAT.wood, lx, hh / 2, (Math.random() - 0.5) * 0.05, 0, 0, (Math.random() - 0.5) * 0.06, 1.5);
      part(g, box(0.08, 0.15, 0.08), MAT.woodDark, lx, hh - 0.05, 0.1, 0, 0, 0.6);
    }
    for (const yy of [0.35, h - 0.5]) part(g, rbox(w + 0.2, 0.22, 0.14, 0.03), MAT.woodDark, 0, yy, 0.15, 0, 0, (Math.random() - 0.5) * 0.12, 1.5);
    part(g, rbox(Math.hypot(w, h * 0.7), 0.2, 0.12, 0.03), MAT.woodDark, 0, h * 0.5, 0.2, 0, 0, Math.atan2(h * 0.7, w), 1.5);
    if (iron) {
      for (const yy of [0.6, h * 0.5, h - 0.7]) {
        part(g, box(w + 0.24, 0.24, 0.08), MAT.iron, 0, yy, 0.25);
        for (let i = 0; i < 6; i++) part(g, sph(0.05, 6, 4), MAT.brass, -w / 2 + (i + 0.5) * w / 6, yy, 0.3);
      }
      part(g, box(0.9, 0.9, 0.05), MAT.paintYellow, 0, h * 0.5, 0.31, 0, 0, Math.PI / 4);
      part(g, box(0.6, 0.6, 0.06), MAT.paintDark, 0, h * 0.5, 0.32, 0, 0, Math.PI / 4);
    } else {
      part(g, box(0.7, 0.7, 0.05), MAT.paintRed, 0, h * 0.62, 0.25, 0, 0, Math.PI / 4);
    }
    compact(g); G.scene.add(g);
    const c = Math.abs(Math.cos(ry)) > 0.5;
    const ex = c ? w / 2 : 0.4, ez = c ? 0.4 : w / 2;
    this.solid = G.world.add([x - ex, y, z - ez], [x + ex, y + h, z + ez], { tag: 'barricade', owner: this, walkable: false });
    this.center = new T.Vector3(x, y + h / 2, z); this.r = Math.max(ex, ez) + 0.5; this.w = w; this.h = h;
  }
  hit(dmg, at, charged) {
    if (this.dead) return;
    if (this.iron && !charged) {
      this.G.fx.sparks(this.center, 10, 6); this.G.audio.sfx('metal_clang', { vol: 0.7 });
      this.G.hint('This barricade is iron-banded. Hold fire to charge a heavy shot.', 3.5, 'ironhint');
      return;
    }
    this.dead = true;
    const G = this.G;
    G.scene.remove(this.group); G.world.remove(this.solid);
    for (let i = 0; i < 4; i++) G.fx.chunks(V.copy(this.center).add(V2.set((Math.random() - 0.5) * this.w, (Math.random() - 0.5) * this.h, 0)), 8, 0.28, i % 2 ? 0x6e4c34 : 0xb88a62, this.center.y - this.h / 2, 8);
    G.fx.puff(this.center, 16, this.w * 0.5, 2.2, [0.7, 0.64, 0.55]);
    G.audio.sfx('wood_break', { vol: 1, rate: 0.8 }); G.shake(0.4);
    G.spawnGears(this.center, 8);
    this.onBreak?.();
  }
}

// ------------------------------------------------------------ pressure plate
export class Plate {
  constructor(G, x, y, z, need = 1) {
    this.G = G; this.need = need; this.on = false; this.press = 0;
    const g = this.group = new T.Group(); g.position.set(x, y, z);
    part(g, cyl(1.05, 1.15, 0.12, 24), MAT.flagstone, 0, 0.06, 0, 0, 0, 0, 1);
    this.ring = keep(part(g, torus(0.9, 0.06, 8, 32), MAT.plateGlowOff, 0, 0.12, 0, Math.PI / 2));
    this.top = pivot0(g);
    part(this.top, cyl(0.82, 0.86, 0.14, 24), MAT.brass, 0, 0.13, 0);
    part(this.top, box(0.9, 0.03, 0.9), MAT.ironDark, 0, 0.21, 0, 0, Math.PI / 4);
    for (let i = 0; i < need; i++) part(this.top, box(0.18, 0.04, 0.18), MAT.plateGlowOff, (i - (need - 1) / 2) * 0.3, 0.22, 0);
    this.pips = this.top.children.slice(2);
    G.scene.add(g);
    G.world.add([x - 0.85, y - 0.5, z - 0.85], [x + 0.85, y + 0.12, z + 0.85]);
    this.x = x; this.y = y; this.z = z;
  }
  weight() {
    let w = 0;
    for (const c of this.G.cubes) {
      const p = c.solid; const cx = (p.min.x + p.max.x) / 2, cz = (p.min.z + p.max.z) / 2;
      if (Math.hypot(cx - this.x, cz - this.z) < 1.05 && p.min.y < this.y + 2.6) w += 1;
    }
    for (const h of this.G.heroes) if (h.body.grounded && Math.hypot(h.body.pos.x - this.x, h.body.pos.z - this.z) < 1.0 && Math.abs(h.body.pos.y - this.y) < 0.5) w += 1;
    return w;
  }
  update(dt) {
    const w = this.weight(), on = w >= this.need;
    this.press += ((w > 0 ? 1 : 0) - this.press) * Math.min(1, dt * 10);
    this.top.position.y = -this.press * 0.08;
    this.pips.forEach((p, i) => p.material = i < w ? MAT.plateGlowOn : MAT.plateGlowOff);
    if (on !== this.on) {
      this.on = on; this.ring.material = on ? MAT.plateGlowOn : MAT.plateGlowOff;
      this.G.audio.sfx('switch', { vol: 0.6, rate: on ? 1 : 0.8 });
      if (on) this.G.fx.sparks(V.set(this.x, this.y + 0.3, this.z), 10, 4, [0.3, 1, 0.5]);
    }
  }
}
function pivot0(parent) { const g = new T.Group(); parent.add(g); return g; }

// ------------------------------------------------------------ portcullis gate
export class Gate {
  constructor(G, x, y, z, w, h, plates, ry = 0) {
    this.G = G; this.plates = plates; this.open = 0; this.h = h;
    const g = this.group = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    this.grid = pivot0(g);
    for (let i = 0; i <= Math.round(w / 0.5); i++) part(this.grid, box(0.1, h, 0.1), MAT.iron, -w / 2 + i * 0.5, h / 2, 0);
    for (let j = 0; j < Math.round(h / 0.6); j++) part(this.grid, box(w, 0.1, 0.12), MAT.iron, 0, 0.3 + j * 0.6, 0);
    for (let i = 0; i <= Math.round(w / 0.5); i++) part(this.grid, cyl(0.001, 0.07, 0.25, 6), MAT.iron, -w / 2 + i * 0.5, -0.1, 0, Math.PI);
    compact(g); G.scene.add(g);
    const c = Math.abs(Math.cos(ry)) > 0.5;
    this.solid = G.world.add([x - (c ? w / 2 : 0.3), y, z - (c ? 0.3 : w / 2)], [x + (c ? w / 2 : 0.3), y + h, z + (c ? 0.3 : w / 2)], { walkable: false });
    this.wasOpen = false; this.forced = false;
  }
  update(dt) {
    const want = this.forced || this.plates.every(p => p.on);
    this.open = Math.max(0, Math.min(1, this.open + (want ? dt * 0.9 : -dt * 1.5)));
    this.grid.position.y = this.open * (this.h - 0.3);
    this.solid.active = this.open < 0.7;
    if (want !== this.wasOpen) {
      this.wasOpen = want; this.G.audio.play('powerup', { vol: 0.6, rate: want ? 1 : 0.7 });
      if (want) { this.G.shake(0.2); this.onOpen?.(); }
    }
  }
}

// ------------------------------------------------------------ checkpoint lantern
export class Checkpoint {
  constructor(G, x, y, z, ry = 0) {
    this.G = G; this.pos = new T.Vector3(x, y, z); this.ry = ry; this.lit = false;
    const g = this.group = new T.Group(); g.position.set(x + 1.6 * Math.cos(ry), y, z - 1.6 * Math.sin(ry));
    part(g, cyl(0.3, 0.4, 0.3, 8), MAT.flagstone, 0, 0.15, 0);
    part(g, cyl(0.08, 0.1, 2.4, 8), MAT.woodDark, 0, 1.4, 0);
    part(g, box(0.7, 0.08, 0.08), MAT.woodDark, 0.3, 2.5, 0);
    this.lamp = keep(part(g, cyl(0.2, 0.16, 0.45, 6), MAT.lampOff, 0.6, 2.15, 0));
    part(g, cyl(0.24, 0.24, 0.07, 6), MAT.brass, 0.6, 2.42, 0);
    part(g, cyl(0.04, 0.2, 0.1, 6), MAT.brass, 0.6, 1.88, 0);
    compact(g); G.scene.add(g);
    this.flame = new T.PointLight(0xffaa50, 0, 7, 2); this.flame.position.set(0.6, 2.15, 0); g.add(this.flame);
  }
  update(dt) {
    if (this.lit) return;
    const a = this.G.active.body.pos;
    if (Math.hypot(a.x - this.pos.x, a.z - this.pos.z) < 4 && Math.abs(a.y - this.pos.y) < 3) {
      this.lit = true; this.lamp.material = MAT.lamp; this.flame.intensity = 0;
      this.G.setCheckpoint(this);
      this.G.fx.sparks(this.lamp.getWorldPosition(V), 20, 4, [1, 0.8, 0.3]);
    }
  }
}

// ------------------------------------------------------------ moving platform (barge / buoy)
export class Mover {
  constructor(G, a, b, w, d, period, o = {}) {
    this.G = G; this.a = new T.Vector3(...a); this.b = new T.Vector3(...b); this.period = period; this.t = o.phase || 0; this.w = w; this.d = d;
    this.bob = o.bob || 0;
    const g = this.group = new T.Group(); g.position.copy(this.a);
    const kind = o.kind || 'barge';
    if (kind === 'barge') {
      part(g, rbox(w, 0.7, d, 0.15), MAT.woodHull, 0, -0.45, 0, 0, 0, 0, 1.5);
      part(g, box(w - 0.2, 0.12, d - 0.2), MAT.planks, 0, -0.06, 0, 0, 0, 0, 2);
      for (const sx of [-1, 1]) part(g, box(0.16, 0.25, d), MAT.woodRed, sx * (w / 2 - 0.08), 0.05, 0, 0, 0, 0, 1);
      part(g, cyl(0.3, 0.3, 0.6, 10), MAT.wood, w / 2 - 0.6, 0.3, d / 2 - 0.6);
      for (let i = 0; i < 4; i++) part(g, torus(0.42, 0.08, 8, 16), MAT.paintWhite, (i % 2 ? 1 : -1) * (w / 2 + 0.05), -0.3, (i < 2 ? 1 : -1) * d * 0.25, 0, Math.PI / 2, 0);
    } else if (kind === 'buoy') {
      part(g, cyl(w / 2, w / 2 * 0.8, 1.4, 20), MAT.paintRed, 0, -0.7, 0);
      part(g, cyl(w / 2 + 0.02, w / 2 + 0.02, 0.35, 20), MAT.paintWhite, 0, -0.35, 0);
      part(g, cyl(w / 2 - 0.05, w / 2 - 0.05, 0.08, 20), MAT.plate, 0, 0, 0);
      part(g, torus(w / 2, 0.06, 6, 24), MAT.ironDark, 0, 0.0, 0, Math.PI / 2);
      for (let i = 0; i < 3; i++) { const an = i / 3 * Math.PI * 2; part(g, cyl(0.04, 0.04, 1.2, 5), MAT.ironDark, Math.cos(an) * 0.4, 0.6, Math.sin(an) * 0.4, Math.sin(an) * 0.25, 0, -Math.cos(an) * 0.25); }
      this.light = part(g, sph(0.16, 10, 8), MAT.lamp, 0, 1.25, 0);
    } else if (kind === 'lift') {
      part(g, rbox(w, 0.4, d, 0.08), MAT.plate, 0, -0.2, 0, 0, 0, 0, 2);
      part(g, box(w - 0.4, 0.05, d - 0.4), MAT.planks, 0, 0.01, 0, 0, 0, 0, 2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, cyl(0.06, 0.06, 0.25, 6), MAT.brass, sx * (w / 2 - 0.15), 0.1, sz * (d / 2 - 0.15));
    }
    compact(g); G.scene.add(g);
    this.solid = G.world.add([this.a.x - w / 2, this.a.y - 0.5, this.a.z - d / 2], [this.a.x + w / 2, this.a.y, this.a.z + d / 2], { tag: 'mover' });
    this.prev = this.a.clone(); this.active = o.active ?? true; this.control = o.control || null;
  }
  update(dt) {
    let k;
    if (this.control) { const want = this.control() ? 1 : 0; this.kk = this.kk ?? 0; this.kk += Math.max(-dt / this.period, Math.min(dt / this.period, want - this.kk)); k = this.kk * this.kk * (3 - 2 * this.kk); }
    else { if (this.active) this.t += dt / this.period; k = 0.5 - 0.5 * Math.cos(this.t * Math.PI * 2); }
    const p = V.lerpVectors(this.a, this.b, k);
    if (this.bob) p.y += Math.sin(this.t * Math.PI * 2 * 2.3) * this.bob;
    this.solid.moveBy(p.x - this.prev.x, p.y - this.prev.y, p.z - this.prev.z);
    this.prev.copy(p); this.group.position.copy(p);
    this.group.rotation.z = Math.sin(this.G.time * 1.3 + this.a.x) * 0.02;
  }
}

// ------------------------------------------------------------ grind rail
export class Rail {
  constructor(G, pts) {
    this.G = G;
    this.curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p)), false, 'centripetal');
    this.len = this.curve.getLength();
    this.samples = this.curve.getSpacedPoints(Math.ceil(this.len * 3));
    const tube = new T.Mesh(new T.TubeGeometry(this.curve, Math.ceil(this.len * 3), 0.07, 8, false), MAT.brass);
    tube.castShadow = true; G.scene.add(tube);
    // support posts
    for (let i = 0; i < this.samples.length; i += 12) {
      const p = this.samples[i];
      const post = new T.Mesh(cyl(0.08, 0.12, p.y + 1.5, 8), MAT.ironDark); post.position.set(p.x, (p.y - 1.5) / 2 - 0.05, p.z); post.castShadow = true; G.scene.add(post);
      const clamp = new T.Mesh(sph(0.13, 8, 6), MAT.brass); clamp.position.copy(p); G.scene.add(clamp);
    }
    this.spark = 0;
  }
  nearest(p) {
    let best = 1e9, bi = -1;
    for (let i = 0; i < this.samples.length; i++) { const d = this.samples[i].distanceToSquared(p); if (d < best) { best = d; bi = i; } }
    return { d: Math.sqrt(best), t: bi / (this.samples.length - 1) };
  }
}

// ------------------------------------------------------------ golden gear (secret)
export class GoldenGear {
  constructor(G, x, y, z, id) {
    this.G = G; this.id = id; this.dead = false;
    const g = this.group = new T.Group(); g.position.set(x, y + 1.1, z);
    this.gear = part(g, gearGeo(0.55, 12, 0.18, 0.3), MAT.goldGear, 0, 0, 0);
    part(this.gear, gearGeo(0.25, 8, 0.24, 0.25), MAT.brass, 0, 0, 0);
    const beam = new T.Mesh(new T.CylinderGeometry(0.6, 0.9, 30, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.y = 14; g.add(beam);
    G.scene.add(g); this.base = y + 1.1;
  }
  update(dt) {
    const t = this.G.time; this.gear.rotation.y = t * 1.6; this.group.position.y = this.base + Math.sin(t * 2) * 0.15;
    if (Math.random() < dt * 6) this.G.fx.glow.emit(this.group.position.x + (Math.random() - 0.5), this.group.position.y + (Math.random() - 0.5), this.group.position.z + (Math.random() - 0.5), 0, 0.6, 0, 0.25, 1, 1, 0.8, 0.3);
    for (const h of this.G.heroes) if (h.body.pos.distanceTo(V.copy(this.group.position).setY(this.group.position.y - 0.9)) < 1.3) { this.collect(); break; }
  }
  collect() {
    this.dead = true; this.G.scene.remove(this.group);
    this.G.collectGolden(this.id, this.group.position);
  }
}

export class HealthOrb {
  constructor(G, p) {
    this.G = G; this.dead = false; this.age = 0;
    this.mesh = new T.Mesh(new T.OctahedronGeometry(0.22, 0), MAT.health); this.mesh.position.copy(p);
    this.vel = new T.Vector3((Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 3);
    G.scene.add(this.mesh);
  }
  update(dt) {
    this.age += dt; const m = this.mesh, G = this.G;
    const h = G.active, d = V.copy(h.body.pos).setY(h.body.pos.y + 0.8).sub(m.position);
    if (this.age > 0.5 && d.length() < 5) { m.position.addScaledVector(d.normalize(), dt * 12); if (d.length() < 0.5 || m.position.distanceTo(V2.copy(h.body.pos).setY(h.body.pos.y + 0.8)) < 0.6) { G.heal(h, 2); this.dead = true; G.scene.remove(m); return; } }
    else { this.vel.y -= 20 * dt; m.position.addScaledVector(this.vel, dt); const gy = G.world.groundAt(m.position.x, m.position.z, 0.1, m.position.y + 0.3).y; if (m.position.y < gy + 0.4) { m.position.y = gy + 0.4; this.vel.set(0, 0, 0); } }
    m.rotation.y += dt * 3;
    if (this.age > 25) { this.dead = true; G.scene.remove(m); }
  }
}

// ------------------------------------------------------------ placeable cement cube
export class Cube {
  constructor(G, x, y, z) {
    this.G = G; this.dead = false; this.age = 0; this.vy = 0;
    this.mesh = new T.Group();
    const m = part(this.mesh, rbox(0.98, 0.98, 0.98, 0.07, 3), MAT.cement, 0, 0.49, 0, 0, 0, 0, 2.2);
    // seams / pour lines on the cube
    part(this.mesh, box(1.0, 0.04, 1.0), MAT.cementDark, 0, 0.33, 0);
    part(this.mesh, box(0.2, 0.2, 0.04), MAT.cementLight, 0.2, 0.72, 0.495);
    part(this.mesh, box(0.04, 0.2, 0.2), MAT.cementLight, -0.495, 0.68, -0.15);
    void m;
    this.mesh.position.set(x, y, z); this.mesh.scale.setScalar(0.1);
    G.scene.add(this.mesh);
    this.solid = G.world.add([x - 0.49, y, z - 0.49], [x + 0.49, y + 0.98, z + 0.49], { tag: 'cube', owner: this });
    this.landed = false;
  }
  update(dt) {
    const G = this.G; this.age += dt;
    const s = this.age < 0.25 ? (1 - Math.pow(1 - this.age / 0.25, 3)) * 1.08 : 1 + (0.08 * Math.exp(-(this.age - 0.25) * 12)) * Math.cos((this.age - 0.25) * 30);
    this.mesh.scale.setScalar(Math.max(0.1, s));
    const S = this.solid, cx = (S.min.x + S.max.x) / 2, cz = (S.min.z + S.max.z) / 2;
    // gravity / riding
    const g = G.world.groundAt(cx, cz, 0.4, S.min.y + 0.05, S);
    if (g.solid && g.solid.delta.lengthSq() > 0 && Math.abs(g.y - S.min.y) < 0.06) S.moveBy(g.solid.delta.x, g.solid.delta.y, g.solid.delta.z);
    const gy = g.solid ? g.y : -50;
    if (S.min.y > gy + 0.01) {
      this.vy -= 30 * dt;
      const ny = Math.max(gy, S.min.y + this.vy * dt);
      S.moveBy(0, ny - S.min.y, 0);
      if (ny <= gy + 1e-4) { if (this.vy < -4) { G.fx.puff(V.set(cx, gy + 0.1, cz), 6, 0.8, 0.9, [0.8, 0.78, 0.74]); G.audio.play('land', { vol: 0.6, rate: 0.7 }); } this.vy = 0; }
    } else this.vy = 0;
    this.mesh.position.set(cx, S.min.y, cz);
    if (S.min.y < -1) { G.fx.splash(V.set(cx, 0.2, cz)); this.crumble(true); }
  }
  crumble(silent) {
    if (this.dead) return;
    this.dead = true; const G = this.G;
    G.world.remove(this.solid); G.scene.remove(this.mesh);
    const c = V.set((this.solid.min.x + this.solid.max.x) / 2, this.solid.min.y + 0.5, (this.solid.min.z + this.solid.max.z) / 2);
    if (!silent) { G.fx.chunks(c, 12, 0.22, 0xcfcac2, this.solid.min.y, 4); G.fx.puff(c, 6, 0.7, 1.2, [0.85, 0.83, 0.8]); G.audio.play('break', { vol: 0.5, rate: 1.3 }); }
  }
}

export class Hint {
  constructor(G, x, z, r, text, key, cond) { this.G = G; this.x = x; this.z = z; this.r = r; this.text = text; this.key = key; this.cond = cond; this.dead = false; }
  update() {
    const p = this.G.active.body.pos;
    if (Math.hypot(p.x - this.x, p.z - this.z) < this.r && (!this.cond || this.cond(this.G))) { this.G.hint(this.text, 6, this.key); this.dead = true; }
  }
}

export class Trigger {
  constructor(G, x, z, r, fn, yMin = -99) { this.G = G; this.x = x; this.z = z; this.r = r; this.fn = fn; this.dead = false; this.yMin = yMin; }
  update() { const p = this.G.active.body.pos; if (p.y > this.yMin && Math.hypot(p.x - this.x, p.z - this.z) < this.r) { this.dead = true; this.fn(this.G); } }
}
void lathe; void xf;

// ------------------------------------------------------------ bullseye target (Canon puzzles)
export class Target {
  constructor(G, x, y, z, ry = 0, onHit) {
    this.G = G; this.dead = false; this.done = false; this.onHit = onHit;
    const g = this.group = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    part(g, cyl(0.08, 0.1, 2.2, 8), MAT.woodDark, 0, 1.1, -0.1);
    this.face = new T.Group(); this.face.position.set(0, 2.2, 0); g.add(this.face);
    const rings = [[0.6, MAT.paintWhite], [0.46, MAT.paintRed], [0.32, MAT.paintWhite], [0.18, MAT.paintRed]];
    rings.forEach(([r, m], i) => part(this.face, cyl(r, r, 0.08 + i * 0.012, 24), m, 0, 0, 0.0 + i * 0.006, Math.PI / 2));
    part(this.face, torus(0.6, 0.04, 6, 24), MAT.ironDark, 0, 0, 0);
    compact(g); G.scene.add(g);
    this.center = new T.Vector3(x, y + 2.2, z); this.r = 0.8; this.shootable = true;
  }
  hit() {
    if (this.done) return;
    this.done = true; const G = this.G;
    G.audio.sfx('metal_clang', { vol: 0.9 }); G.audio.sfx('switch', { vol: 0.8 });
    G.fx.sparks(this.center, 24, 6, [1, 0.9, 0.4]); G.addGears(10, this.center);
    this.onHit?.(G);
  }
  update(dt) { if (this.done && this.face.rotation.x > -Math.PI / 2) this.face.rotation.x -= dt * 6; }
}

// ------------------------------------------------------------ slam switch (Cubey puzzles)
export class SlamSwitch {
  constructor(G, x, y, z, onSlam) {
    this.G = G; this.dead = false; this.done = false; this.onSlam = onSlam;
    const g = this.group = new T.Group(); g.position.set(x, y, z);
    part(g, cyl(0.95, 1.05, 0.18, 8), MAT.ironDark, 0, 0.09, 0);
    this.cap = new T.Group(); g.add(this.cap);
    part(this.cap, cyl(0.7, 0.75, 0.22, 8), MAT.plateRust, 0, 0.26, 0);
    part(this.cap, box(1.0, 0.05, 0.2), MAT.paintYellow, 0, 0.38, 0, 0, Math.PI / 4, 0);
    part(this.cap, box(1.0, 0.05, 0.2), MAT.paintYellow, 0, 0.38, 0, 0, -Math.PI / 4, 0);
    compact(g); G.scene.add(g);
    G.world.add([x - 0.9, y - 0.3, z - 0.9], [x + 0.9, y + 0.36, z + 0.9]);
    this.center = new T.Vector3(x, y + 0.3, z);
  }
  slam() {
    if (this.done) return;
    this.done = true; this.cap.position.y = -0.18;
    this.G.audio.sfx('switch', { vol: 1, rate: 0.8 }); this.G.audio.sfx('metal_clang', { vol: 0.6, rate: 0.7 });
    this.G.fx.sparks(this.center, 20, 5, [1, 0.8, 0.3]);
    this.onSlam?.(this.G);
  }
  update() {
    if (this.done || this.hinted) return;
    const p = this.G.active.pos;
    if (p.distanceTo(this.center) < 4) { this.hinted = true; this.G.hint('A rusty stomp switch! Jump with Cubey and CLICK in the air to ground-slam it.', 5, 'slamswitch'); }
  }
}

// ------------------------------------------------------------ treasure chest
export class Chest {
  constructor(G, x, y, z, ry = 0, gears = 30) {
    this.G = G; this.dead = false; this.open = false; this.gears = gears;
    const g = this.group = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    part(g, rbox(1.1, 0.6, 0.7, 0.05), MAT.woodHull, 0, 0.3, 0);
    for (const sx of [-0.45, 0, 0.45]) part(g, box(0.08, 0.62, 0.72), MAT.brass, sx, 0.31, 0);
    this.lid = new T.Group(); this.lid.position.set(0, 0.6, -0.35); g.add(this.lid);
    const lg = new T.CylinderGeometry(0.35, 0.35, 1.1, 14, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2);
    part(this.lid, lg, MAT.woodHull, 0, 0, 0.35);
    part(this.lid, box(0.2, 0.2, 0.06), MAT.gold, 0, -0.02, 0.72);
    G.scene.add(g);
    this.solid = G.world.add([x - 0.6, y, z - 0.45], [x + 0.6, y + 0.65, z + 0.45]);
    this.center = new T.Vector3(x, y + 0.6, z);
  }
  unlock() {
    if (this.open) return; this.open = true;
    this.G.audio.sfx('chest_open', { vol: 0.9 }); this.G.audio.play('powerup', { vol: 0.6 });
    this.G.spawnGears(this.center, this.gears); this.G.fx.sparks(this.center, 30, 5, [1, 0.85, 0.3]);
  }
  update(dt) { if (this.open && this.lid.rotation.x > -1.9) this.lid.rotation.x -= dt * 4; }
}

// ------------------------------------------------------------ hazard zone (lava / spikes / deep water): hurts + returns hero to safe ground
export class Hazard {
  constructor(G, x0, x1, z0, z1, y, kind = 'lava') {
    this.G = G; this.dead = false; this.r = [x0, x1, z0, z1]; this.y = y; this.kind = kind;
    if (kind === 'lava') {
      const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0, 1, 1), MAT.lava); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      m.userData.noAO = true; G.scene.add(m); this.mesh = m;
      const tex = MAT.lava.emissiveMap; this.tex = tex;
    } else if (kind === 'spikes') {
      const g = new T.Group(); G.scene.add(g);
      for (let x = x0 + 0.25; x < x1; x += 0.5) for (let z = z0 + 0.25; z < z1; z += 0.5) { const s = new T.Mesh(new T.ConeGeometry(0.12, 0.5, 6), MAT.iron); s.position.set(x + (Math.random() - 0.5) * 0.1, y + 0.25, z + (Math.random() - 0.5) * 0.1); g.add(s); }
      compact(g);
    }
  }
  update(dt) {
    if (this.tex && this.kind === 'lava') { this.tex.offset.x += dt * 0.02; this.tex.offset.y += dt * 0.013; }
    const [x0, x1, z0, z1] = this.r, G = this.G;
    if (this.kind === 'lava' && Math.random() < dt * 3) G.fx.glow.emit(x0 + Math.random() * (x1 - x0), this.y + 0.1, z0 + Math.random() * (z1 - z0), 0, 1.5, 0, 0.4, 0.9, 1, 0.45, 0.1, { grav: 2 });
    for (const h of G.heroes) {
      const p = h.pos;
      if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1 && p.y < this.y + (this.kind === 'spikes' ? 0.45 : 0.15)) {
        if (G.active === h) {
          G.fx.puff(V.copy(p).setY(p.y + 0.5), 10, 0.6, 1.2, this.kind === 'lava' ? [0.4, 0.3, 0.25] : [0.8, 0.8, 0.8]);
          G.audio.sfx(this.kind === 'lava' ? 'explosion' : 'metal_clang', { vol: 0.5 });
          h.hp = Math.max(0, h.hp - 1); G.damageFlash();
          if (h.hp <= 0) { G.onDeath(); return; }
          h.body.pos.copy(h.safe); h.body.vel.set(0, 0, 0); h.inv = 1.2; G.cam.snap = true;
          G.partner.teleportBehind(h);
        } else h.teleportBehind(G.active);
      }
    }
  }
}

// ------------------------------------------------------------ crumbling platform: shakes when stood on, falls, then rebuilds
export class Crumble {
  constructor(G, x, y, z, w = 2.2, d = 2.2, mat = MAT.flagstone) {
    this.G = G; this.dead = false; this.home = new T.Vector3(x, y, z); this.state = 'idle'; this.t = 0;
    const g = this.group = new T.Group(); g.position.set(x, y, z);
    part(g, rbox(w, 0.5, d, 0.08, 2), mat, 0, -0.25, 0, 0, 0, 0, 1.5);
    for (let i = 0; i < 3; i++) part(g, box(w * 0.9, 0.03, 0.04), MAT.black, 0, 0.005, -d * 0.3 + i * d * 0.3, 0, (i - 1) * 0.4, 0);
    compact(g); G.scene.add(g);
    this.solid = G.world.add([x - w / 2, y - 0.5, z - d / 2], [x + w / 2, y, z + d / 2], { tag: 'crumble' });
  }
  update(dt) {
    const G = this.G; this.t += dt;
    const stood = G.heroes.some(h => h.body.grounded && h.body.ground === this.solid);
    if (this.state === 'idle' && stood) { this.state = 'shake'; this.t = 0; G.audio.sfx('stone_place', { vol: 0.4, rate: 1.6 }); }
    if (this.state === 'shake') {
      this.group.position.set(this.home.x + (Math.random() - 0.5) * 0.08, this.home.y, this.home.z + (Math.random() - 0.5) * 0.08);
      if (this.t > 0.75 - (G.diff || 1) * 0.06) { this.state = 'fall'; this.t = 0; this.solid.active = false; G.fx.chunks(this.home, 8, 0.25, 0x9c8f82, this.home.y - 3, 4); G.audio.sfx('wood_break', { vol: 0.5, rate: 0.6 }); }
    } else if (this.state === 'fall') {
      this.group.position.y -= dt * (4 + this.t * 20); this.group.rotation.z += dt * 0.6;
      if (this.t > 3.2) { this.state = 'idle'; this.group.position.copy(this.home); this.group.rotation.set(0, 0, 0); this.group.scale.setScalar(0.01); this.solid.active = true; this.t = 0; this.grow = 0; }
    } else if (this.group.scale.x < 1) this.group.scale.setScalar(Math.min(1, this.group.scale.x + dt * 3));
  }
}

// ------------------------------------------------------------ blocks that rise out of the ground (bridges/stairs) when triggered
export class RiseBlocks {
  constructor(G, boxes, mat = MAT.flagstone, depth = 4) {
    this.G = G; this.dead = false; this.on = false; this.k = 0; this.depth = depth; this.items = [];
    for (const [x, y, z, w, h, d] of boxes) {
      const m = new T.Mesh(rbox(w, h, d, 0.06, 2), mat); projUV(m.geometry, 1.5); m.castShadow = m.receiveShadow = true;
      m.position.set(x, y - h / 2 - depth, z); m.visible = false; G.scene.add(m);
      const s = G.world.add([x - w / 2, y - h, z - d / 2], [x + w / 2, y, z + d / 2]); s.active = false;
      this.items.push({ m, s, y, h });
    }
  }
  trigger() { if (this.on) return; this.on = true; this.items.forEach(i => { i.m.visible = true; }); this.G.audio.sfx('stone_place', { vol: 0.8, rate: 0.7 }); this.G.shake(0.3); }
  update(dt) {
    if (!this.on || this.k >= 1) return;
    this.k = Math.min(1, this.k + dt * 0.9);
    this.items.forEach((it, i) => {
      const k = Math.min(1, Math.max(0, this.k * 1.6 - i * 0.12)), e = 1 - Math.pow(1 - k, 3);
      it.m.position.y = it.y - it.h / 2 - this.depth * (1 - e);
      if (k >= 1 && !it.s.active) { it.s.active = true; this.G.fx.puff(it.m.position.clone().setY(it.y), 6, 0.8, 1.2, [0.8, 0.76, 0.7]); }
    });
  }
}

// ------------------------------------------------------------ periodic flame jet
export class FlameJet {
  constructor(G, x, y, z, period = 3, phase = 0, h = 3.2) {
    this.G = G; this.dead = false; this.p = new T.Vector3(x, y, z); this.period = period; this.phase = phase; this.h = h;
    const g = new T.Group(); g.position.set(x, y, z);
    part(g, cyl(0.45, 0.55, 0.25, 12), MAT.ironDark, 0, 0.12, 0);
    part(g, cyl(0.25, 0.25, 0.05, 12), MAT.black, 0, 0.26, 0);
    compact(g); G.scene.add(g);
    G.world.add([x - 0.5, y, z - 0.5], [x + 0.5, y + 0.25, z + 0.5]);
  }
  update(dt) {
    const G = this.G, t = (G.time / this.period + this.phase) % 1;
    const warn = t > 0.55 && t < 0.7, on = t >= 0.7;
    if (warn && Math.random() < dt * 20) G.fx.smoke.emit(this.p.x, this.p.y + 0.3, this.p.z, 0, 1.5, 0, 0.4, 0.6, 0.4, 0.38, 0.36, { grow: 2, alpha: 0.5 });
    if (on) {
      for (let i = 0; i < 3; i++) G.fx.glow.emit(this.p.x + (Math.random() - 0.5) * 0.3, this.p.y + 0.3, this.p.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5), 9 + Math.random() * 3, (Math.random() - 0.5), 1.0, 0.35, 1, 0.5 + Math.random() * 0.2, 0.12, { drag: 1.2, grow: 1.6 });
      const a = G.active.pos;
      if (Math.hypot(a.x - this.p.x, a.z - this.p.z) < 0.9 && a.y > this.p.y - 0.3 && a.y < this.p.y + this.h) G.active.hurt(1, this.p);
    }
  }
}
