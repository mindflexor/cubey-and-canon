// Shared level-building pipeline used by all five levels.
import * as T from 'three';
import { MAT } from './materials.js';
import { Batch, box, gearGeo } from './geo.js';
import * as KIT from './kit.js';
import { Crate, Checkpoint, Trigger, GoldenGear, Hint } from './entities.js';
import { Foliage, foliageUniforms } from './foliage.js';
import { Island, terrainMaterial } from './islands.js';
import { MOBILE } from './render.js';

// ------------------------------------------------------------------ begin / finish
export function beginLevel(G, o = {}) {
  KIT.reseed(o.seed ?? 42);
  const K = { B: new Batch(), W: G.world, scene: G.scene, flags: [], chimneys: [], fountains: [], fires: [], farIslands: [] };
  const L = {
    K, keepOut: o.keepOut || [], islands: [], TM: terrainMaterial(),
    E: e => (G.entities.push(e), e),
    EN: e => (G.enemies.push(e), e),
  };
  L.crate = (x, y, z, t = 'gear') => L.E(new Crate(G, x, y, z, t));
  L.island = opts => { const I = new Island(opts); I.build(G.scene, G.world, L.TM); L.islands.push(I); return I; };
  L.hAt = (x, z) => { let h = -9; for (const I of L.islands) h = Math.max(h, I.height(x, z)); return h; };
  L.checkpoint = (x, y, z, ry = Math.PI) => L.E(new Checkpoint(G, x, y, z, ry));
  L.hint = (x, z, r, text, key, cond) => L.E(new Hint(G, x, z, r, text, key, cond));
  L.trigger = (x, z, r, fn, yMin) => L.E(new Trigger(G, x, z, r, fn, yMin));
  L.golden = (x, y, z, id) => L.E(new GoldenGear(G, x, y, z, id));
  if (o.sky) setSky(G, o.sky);
  G.isl = L.islands;
  return L;
}

export function finishLevel(G, L, o = {}) {
  const { K } = L;
  backdrop(G, K, L.TM, o.far, o.ships ?? 3, o.gulls ?? 14);
  const dens = o.palms ?? 1;
  for (const I of L.islands) junglePalms(K, I, (MOBILE ? 0.6 : 1) * dens, L.keepOut, o.palmMat);
  for (const I of K.farIslands) junglePalms(K, I, (MOBILE ? 0.15 : 0.35) * dens, L.keepOut, o.palmMat);
  G.R.ocean.syncIslands();
  K.B.build(G.scene);
  const F = new Foliage(G.scene, G.world, MAT.leaf);
  const fd = o.foliage ?? 1;
  for (const I of [...L.islands, ...K.farIslands]) jungleGround(F, I, (I.far ? 0.25 : 1) * (MOBILE ? 0.45 : 1) * fd, L.keepOut);
  o.foliageExtra?.(F);
  F.finish();
  G.updaters.push((dt, g) => { foliageUniforms.uTime.value = g.time; });
  G.updaters.push((dt, g) => {
    for (const f of K.fires) if (Math.random() < dt * 14 && f.distanceToSquared(g.active.pos) < 2500) {
      g.fx.glow.emit(f.x + (Math.random() - 0.5) * 0.4, f.y, f.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 1.8 + Math.random(), (Math.random() - 0.5) * 0.4, 0.55, 0.6, 1, 0.5, 0.15, { grow: 0.2, drag: 1 });
      if (Math.random() < 0.3) g.fx.smoke.emit(f.x, f.y + 0.6, f.z, 0, 1.2, 0, 0.6, 1.6, 0.3, 0.28, 0.27, { grow: 2.5, alpha: 0.35 });
    }
    if (Math.random() < dt * 4) {
      const c = K.chimneys[Math.floor(Math.random() * K.chimneys.length)];
      if (c && c.distanceTo(g.active.pos) < 90) g.fx.smoke.emit(c.x, c.y, c.z, 0.4, 1.2, 0.2, 1.1, 4, 0.82, 0.8, 0.78, { grow: 3, drag: 0.4, alpha: 0.35 });
    }
    for (const f of K.fountains) if (f.distanceTo(g.active.pos) < 50) for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; g.fx.smoke.emit(f.x, f.y - 0.6, f.z, Math.cos(a) * 1.4, 3.5, Math.sin(a) * 1.4, 0.35, 1.0, 0.85, 0.95, 1, { grav: 9, drag: 0.3, grow: 1.4, alpha: 0.6 }); }
  });
  for (const f of K.flags) addFlag(G, f);
  return F;
}

// ------------------------------------------------------------------ sky themes
export function setSky(G, s) {
  const U = G.R.skyU, sc = G.R.scene;
  if (s.zenith != null) U.zenith.value.set(s.zenith);
  if (s.horizon != null) { U.horizon.value.set(s.horizon); sc.fog.color.set(s.fog ?? s.horizon); }
  if (s.ground != null) U.ground.value.set(s.ground);
  if (s.sun != null) { U.sunCol.value.set(s.sun); G.R.sun.color.set(s.sun); }
  if (s.sunI != null) G.R.sun.intensity = s.sunI;
  if (s.hemi != null) { const h = sc.children.find(o => o.isHemisphereLight); if (h) h.intensity = s.hemi; }
  if (s.fogNear != null) { sc.fog.near = s.fogNear; sc.fog.far = s.fogFar ?? sc.fog.far; }
  if (s.water != null) G.R.ocean.mesh.material.uniforms.waterColor.value.set(s.water);
  if (s.exposure != null) G.R.renderer.toneMappingExposure = s.exposure;
  G.R.refreshEnv?.();
}

// ------------------------------------------------------------------ arena waves
// waves: array of () => [enemies]; trigger area at (x,z,r); calls onDone when cleared
export function arena(G, L, { x, z, r = 6, yMin = -99, waves, onStart, onDone, title = 'Wave' }) {
  let wave = -1, list = [], on = false;
  const next = () => {
    wave++;
    if (wave >= waves.length) { on = false; onDone?.(G); return; }
    list = waves[wave]().map(e => { e.aggro = true; G.enemies.push(e); G.fx.puff(e.pos.clone().setY(e.pos.y + 1), 10, 1, 1.6, [0.9, 0.9, 0.9]); return e; });
    G.hud.toast(`${title} ${wave + 1} of ${waves.length}`); G.audio.play('boss', { vol: 0.4, rate: 1.3 });
  };
  L.trigger(x, z, r, g => { on = true; onStart?.(g); setTimeout(next, 900); }, yMin);
  G.updaters.push(() => { if (on && list.length && list.every(e => e.dead)) { list = []; setTimeout(next, 1400); } });
}

// ------------------------------------------------------------------ end-of-level treasure map piece
export function mapPiece(G, L, x, y, z, label = 'Treasure Map Piece') {
  const g = new T.Group(); g.position.set(x, y + 1.3, z); G.scene.add(g);
  const scroll = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 1.2, 20), MAT.canvas); scroll.rotation.z = Math.PI / 2; g.add(scroll);
  for (const sx of [-1, 1]) { const cap = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.08, 20), MAT.gold); cap.rotation.z = Math.PI / 2; cap.position.x = sx * 0.62; g.add(cap); }
  const sheet = new T.Mesh(box(1.0, 0.7, 0.02), MAT.canvas); sheet.position.set(0, -0.5, 0.05); g.add(sheet);
  const x1 = new T.Mesh(box(0.3, 0.05, 0.03), MAT.paintRed); x1.rotation.z = 0.8; x1.position.set(0.15, -0.55, 0.07); g.add(x1);
  const x2 = x1.clone(); x2.rotation.z = -0.8; g.add(x2);
  const beam = new T.Mesh(new T.CylinderGeometry(0.7, 1.0, 40, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  beam.position.y = 18; g.add(beam);
  let done = false;
  const ent = {
    dead: false,
    update(dt) {
      g.rotation.y += dt * 1.2; g.position.y = y + 1.3 + Math.sin(G.time * 2) * 0.15;
      if (Math.random() < dt * 8) G.fx.glow.emit(x + (Math.random() - 0.5) * 1.5, y + 1 + Math.random(), z + (Math.random() - 0.5) * 1.5, 0, 0.8, 0, 0.3, 1, 1, 0.85, 0.35);
      if (done) return;
      for (const h of G.heroes) if (Math.hypot(h.pos.x - x, h.pos.z - z) < 1.5 && Math.abs(h.pos.y - y) < 2.5) {
        done = true; this.dead = true; G.scene.remove(g);
        G.fx.sparks(new T.Vector3(x, y + 1.3, z), 50, 7, [1, 0.85, 0.3]);
        G.hud.banner(label + ' found!', 'Level complete'); G.win();
        break;
      }
    },
  };
  return L.E(ent);
}

// ------------------------------------------------------------------ helpers
export function projBox(w, h, d, s) { const g = box(w, h, d); const uv = g.attributes.uv, p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const u = ay > 0.5 ? p.getX(i) : ax > 0.5 ? p.getZ(i) : p.getX(i); const v = ay > 0.5 ? p.getZ(i) : p.getY(i); uv.setXY(i, u / s, v / s); } return g; }

export function addFlag(G, f) {
  const geo = new T.PlaneGeometry(f.big ? 3 : 1.6, f.big ? 1.8 : 1, 10, 4); geo.translate(f.big ? 1.5 : 0.8, 0, 0);
  const m = new T.Mesh(geo, f.big ? MAT.flag : MAT.canvasRed); m.castShadow = true;
  if (f.obj) { m.position.copy(f.local); f.obj.add(m); } else { m.position.set(f.x, f.y - (f.big ? 0.9 : 0.5), f.z); G.scene.add(m); }
  const base = geo.attributes.position.array.slice(), ph = Math.random() * 6;
  G.updaters.push((dt, g) => {
    const p = geo.attributes.position, t = g.time * 7 + ph;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(t - x * 2.4) * 0.14 * x); }
    p.needsUpdate = true; geo.computeVertexNormals();
  });
  if (f.big) { const em = new T.Mesh(gearGeo(0.45, 10, 0.02, 0.3), MAT.paintWhite); em.position.set(1.4, 0, 0.03); m.add(em); }
}

const FAR_DEFAULT = [[-175, -120, 42, 30, 14, 5.5], [180, -60, 36, 48, 13, 6.7], [160, -300, 52, 40, 20, 7.9], [-200, -330, 64, 52, 26, 8.3], [40, -640, 150, 115, 75, 9.1], [-95, 175, 46, 36, 12, 3.3], [125, 165, 38, 30, 10, 2.7], [-320, -520, 90, 70, 38, 6.1], [330, -480, 80, 90, 34, 5.2]];
export function backdrop(G, K, TM, far = FAR_DEFAULT, ships = 3, gulls = 14) {
  for (const [cx, cz, rx, rz, peak, seed] of far) {
    const I = new Island({ cx, cz, rx, rz, peak, seed, res: rx > 80 ? 6 : 3.5, cliffs: 1.5 }); I.far = true;
    I.build(G.scene, G.world, TM); K.farIslands.push(I);
  }
  const gullGeo = new T.BufferGeometry();
  gullGeo.setAttribute('position', new T.Float32BufferAttribute([-0.9, 0.15, 0, 0, 0, 0.12, 0, 0, -0.2, 0.9, 0.15, 0, 0, 0, 0.12, 0, 0, -0.2], 3));
  gullGeo.computeVertexNormals();
  const gullMat = new T.MeshStandardMaterial({ color: 0xffffff, side: T.DoubleSide, roughness: 0.8 });
  for (let i = 0; i < gulls; i++) {
    const m = new T.Mesh(gullGeo.clone(), gullMat); G.scene.add(m);
    const cx = (Math.random() - 0.5) * 80, cz = -Math.random() * 300, R = 8 + Math.random() * 20, h = 14 + Math.random() * 20, sp = 0.3 + Math.random() * 0.3, ph = Math.random() * 6;
    const pos = m.geometry.attributes.position;
    G.updaters.push((dt, gg) => {
      const a = gg.time * sp + ph; m.position.set(cx + Math.cos(a) * R, h + Math.sin(a * 2) * 1.5, cz + Math.sin(a) * R); m.rotation.y = -a; m.rotation.z = 0.3;
      const f = Math.sin(gg.time * 8 + ph) * 0.35; pos.setY(0, f); pos.setY(3, f); pos.needsUpdate = true;
    });
  }
  for (let i = 0; i < ships; i++) {
    const s = KIT.ship(K, 0, 0.4, 0, 0, 1.4, { sail: i % 2 ? MAT.canvasRed : MAT.canvas, flags: false });
    const R = 120 + i * 50, sp = 0.008 + i * 0.003, off = i * 2.5;
    G.updaters.push((dt, gg) => { const a = gg.time * sp + off; s.position.set(Math.cos(a) * R, 0.4 + Math.sin(gg.time * 0.8 + i) * 0.15, Math.sin(a) * R - 150); s.rotation.y = -a; s.rotation.z = Math.sin(gg.time * 0.7 + i) * 0.03; });
  }
}

export function islandPoints(I, n, rnd, keepOut = []) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 1.15;
    const x = I.cx + Math.cos(a) * r * I.rx, z = I.cz + Math.sin(a) * r * I.rz;
    if (keepOut.some(([a0, b0, c0, d0]) => x > a0 && x < b0 && z > c0 && z < d0)) continue;
    const h = I.height(x, z); if (h < 0.35) continue;
    const slope = Math.abs(I.height(x + 1, z) - h) + Math.abs(I.height(x, z + 1) - h);
    pts.push({ x, z, h, slope, e: I.e(x, z) });
  }
  return pts;
}
export function junglePalms(K, I, dens, keepOut, palmMat) {
  const rnd = KIT.mulberry(Math.floor(I.seed * 1000));
  const n = Math.floor(I.rx * I.rz * 0.05 * dens);
  for (const p of islandPoints(I, n, rnd, keepOut)) {
    if (p.slope > 1.1) continue;
    const beach = p.h < 1.45;
    if (beach && rnd() < 0.5) continue;
    const toSea = Math.atan2(p.x - I.cx, p.z - I.cz);
    KIT.palm(K, p.x, p.h - 0.1, p.z, 6 + rnd() * 4, beach ? 0.8 + rnd() * 0.5 : 0.2 + rnd() * 0.4, beach ? toSea : rnd() * 6.28);
  }
  for (const p of islandPoints(I, Math.floor(n * 0.4), rnd, keepOut)) if (p.slope > 0.6 || (p.h < 0.9 && rnd() < 0.3)) KIT.rock(K, p.x, p.h, p.z, 0.8 + rnd() * 1.8, 0.6 + rnd(), 0.8 + rnd() * 1.6, Math.floor(rnd() * 100), rnd() < 0.5 ? MAT.rock : MAT.rockDark);
  void palmMat;
}
export function jungleGround(F, I, dens, keepOut) {
  const rnd = KIT.mulberry(Math.floor(I.seed * 777));
  const n = Math.floor(I.rx * I.rz * 2.2 * dens);
  const c = new T.Color();
  for (const p of islandPoints(I, n, rnd, keepOut)) {
    if (p.slope > 1.2) continue;
    if (p.h < 1.35) { if (p.h > 0.9 && rnd() < 0.25) F.put(F.tall, p.x, p.h, p.z, 0.6 + rnd() * 0.4, c.setHSL(0.17, 0.4, 0.55)); continue; }
    const k = rnd();
    c.setHSL(0.23 + rnd() * 0.07, 0.5, 0.36 + rnd() * 0.18);
    if (k < 0.6) F.put(F.grass, p.x, p.h, p.z, 0.9 + rnd() * 0.8, c);
    else if (k < 0.75) F.put(F.tall, p.x, p.h, p.z, 0.8 + rnd() * 0.7, c);
    else if (k < 0.87) F.put(F.fern, p.x, p.h, p.z, 0.9 + rnd() * 0.9, c);
    else if (k < 0.95) F.put(F.bush, p.x, p.h - 0.1, p.z, 0.8 + rnd() * 1.4, c);
    else F.put(F.flower, p.x, p.h, p.z, 0.9, c.setHSL([0, 0.9, 0.12, 0.8][Math.floor(rnd() * 4)], 0.85, 0.62));
  }
}
void Batch;
