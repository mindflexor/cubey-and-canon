// Axis-aligned collision world with ramps, moving solids and a kinematic character controller.
import * as T from 'three';

export const GRAVITY = 30;

export class Solid {
  constructor(min, max, o = {}) {
    this.min = new T.Vector3(...min); this.max = new T.Vector3(...max);
    this.ramp = o.ramp || null; // {axis:'x'|'z', dir:1|-1} rising toward +axis if dir=1
    this.tag = o.tag || 'static';
    this.owner = o.owner || null;
    this.active = true;
    this.delta = new T.Vector3();
    this.blocksShots = o.blocksShots ?? true;
    this.cam = o.cam ?? true; // camera collides
    this.walkable = o.walkable ?? true;
    this.height = o.height || null; // heightfield function (terrain)
    this.surface = o.surface || 'stone';
  }
  topAt(x, z) {
    if (this.height) return this.height(x, z);
    if (!this.ramp) return this.max.y;
    const r = this.ramp, lo = r.axis === 'x' ? this.min.x : this.min.z, hi = r.axis === 'x' ? this.max.x : this.max.z;
    let t = ((r.axis === 'x' ? x : z) - lo) / (hi - lo);
    t = Math.min(1, Math.max(0, t)); if (r.dir < 0) t = 1 - t;
    return this.min.y + (this.max.y - this.min.y) * t;
  }
  moveBy(dx, dy, dz) {
    this.min.x += dx; this.min.y += dy; this.min.z += dz;
    this.max.x += dx; this.max.y += dy; this.max.z += dz;
    this.delta.x += dx; this.delta.y += dy; this.delta.z += dz;
  }
  center(out) { return out.addVectors(this.min, this.max).multiplyScalar(0.5); }
}

export class World {
  constructor() { this.solids = []; }
  add(min, max, o) { const s = new Solid(min, max, o); this.solids.push(s); return s; }
  box(cx, cy, cz, w, h, d, o) { return this.add([cx - w / 2, cy - h / 2, cz - d / 2], [cx + w / 2, cy + h / 2, cz + d / 2], o); }
  remove(s) { const i = this.solids.indexOf(s); if (i >= 0) this.solids.splice(i, 1); }
  clearDeltas() { for (const s of this.solids) s.delta.set(0, 0, 0); }

  // highest walkable surface under (x,z) within radius, at or below maxY
  groundAt(x, z, r, maxY, ignore) {
    let best = -Infinity, bs = null;
    for (const s of this.solids) {
      if (!s.active || s === ignore || !s.walkable) continue;
      if (x + r <= s.min.x || x - r >= s.max.x || z + r <= s.min.z || z - r >= s.max.z) continue;
      const top = s.topAt(x, z);
      if (top <= maxY && top > best) { best = top; bs = s; }
    }
    return { y: best, solid: bs };
  }
  // ray vs AABBs (for shots and camera); returns distance or Infinity
  raycast(o, d, maxD, filter) {
    let best = maxD, hit = null;
    for (const s of this.solids) {
      if (!s.active || (filter && !filter(s))) continue;
      if (s.height) {
        let prev = 0;
        for (let t = 0; t < best; t += 0.6) {
          const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
          if (x < s.min.x || x > s.max.x || z < s.min.z || z > s.max.z) { prev = t; continue; }
          if (y < s.height(x, z)) { let a = prev, b = t; for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (o.y + d.y * m < s.height(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; } if (a < best) { best = a; hit = s; } break; }
          prev = t;
        }
        continue;
      }
      let t0 = 0, t1 = best, ok = true;
      for (const a of ['x', 'y', 'z']) {
        const v = d[a], lo = s.min[a], hi = s.max[a];
        if (Math.abs(v) < 1e-8) { if (o[a] < lo || o[a] > hi) { ok = false; break; } continue; }
        let ta = (lo - o[a]) / v, tb = (hi - o[a]) / v;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) { best = t0; hit = s; }
    }
    return { dist: best, solid: hit };
  }
  pointInside(p, pad = 0, filter) {
    for (const s of this.solids) {
      if (!s.active || (filter && !filter(s))) continue;
      if (p.x > s.min.x - pad && p.x < s.max.x + pad && p.z > s.min.z - pad && p.z < s.max.z + pad && p.y > s.min.y - pad && p.y < s.topAt(p.x, p.z) + pad) return s;
    }
    return null;
  }
}

// Kinematic body: position is at the feet.
export class Body {
  constructor(r, h) {
    this.pos = new T.Vector3(); this.vel = new T.Vector3();
    this.r = r; this.h = h; this.grounded = false; this.ground = null; this.ignore = null;
    this.step = 0.42; this.lastGroundY = 0; this.landSpeed = 0; this.hitWall = false; this.headBump = false;
  }
}

export function moveBody(world, b, dt, gravity = true) {
  // ride moving platforms
  if (b.grounded && b.ground && (b.ground.delta.x || b.ground.delta.y || b.ground.delta.z)) b.pos.add(b.ground.delta);
  if (gravity) b.vel.y -= GRAVITY * dt;
  if (b.vel.y < -40) b.vel.y = -40;
  const wasGrounded = b.grounded, prevY = b.pos.y;
  b.hitWall = false; b.headBump = false;
  // horizontal, axis-separated, sub-stepped
  const steps = Math.max(1, Math.ceil(Math.hypot(b.vel.x, b.vel.z) * dt / (b.r * 0.8)));
  const sdt = dt / steps;
  for (let k = 0; k < steps; k++) {
    for (const axis of ['x', 'z']) {
      const v = b.vel[axis]; if (!v) continue;
      b.pos[axis] += v * sdt;
      for (const s of world.solids) {
        if (!s.active || s === b.ignore) continue;
        const p = b.pos, r = b.r;
        if (p.x + r <= s.min.x || p.x - r >= s.max.x || p.z + r <= s.min.z || p.z - r >= s.max.z) continue;
        if (p.y + b.h <= s.min.y + 0.01) continue;
        const top = s.topAt(p.x, p.z);
        if (p.y + b.step >= top && s.walkable) continue; // can step onto it
        if (p.y >= top - 0.01) continue;
        if (s.height) { p[axis] -= v * sdt; b.hitWall = true; continue; }
        if (axis === 'x') { if (v > 0) p.x = Math.min(p.x, s.min.x - r - 1e-4); else p.x = Math.max(p.x, s.max.x + r + 1e-4); }
        else { if (v > 0) p.z = Math.min(p.z, s.min.z - r - 1e-4); else p.z = Math.max(p.z, s.max.z + r + 1e-4); }
        b.hitWall = true;
      }
    }
  }
  // vertical
  b.pos.y += b.vel.y * dt;
  b.grounded = false; b.ground = null;
  if (b.vel.y <= 0) {
    const allow = wasGrounded ? b.step : 0.3;
    const g = world.groundAt(b.pos.x, b.pos.z, b.r * 0.85, Math.max(prevY, b.pos.y) + allow, b.ignore);
    const snap = wasGrounded ? 0.35 : 0;
    if (g.solid && g.y >= b.pos.y - snap) {
      b.landSpeed = wasGrounded ? 0 : -b.vel.y;
      b.pos.y = g.y; b.vel.y = 0; b.grounded = true; b.ground = g.solid; b.lastGroundY = g.y;
    }
  } else {
    for (const s of world.solids) {
      if (!s.active || s === b.ignore) continue;
      const p = b.pos, r = b.r * 0.8;
      if (s.height || p.x + r <= s.min.x || p.x - r >= s.max.x || p.z + r <= s.min.z || p.z - r >= s.max.z) continue;
      if (prevY + b.h <= s.min.y + 0.02 && p.y + b.h > s.min.y) { p.y = s.min.y - b.h; b.vel.y = 0; b.headBump = true; }
    }
  }
}
