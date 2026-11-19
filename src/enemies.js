// Enemy crew of the Rustwake pirates: Bilgebots, deck turrets, gull drones and the Ironclaw boss.
import * as T from 'three';
import { Body, moveBody } from './physics.js';
import { MAT } from './materials.js';
import { rbox, box, cyl, sph, torus, lathe, part, pivot, gearGeo, compact, keep, RoundedBoxGeometry } from './geo.js';

const V = new T.Vector3(), V2 = new T.Vector3();
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
function flashMats(root) {
  const list = []; root.traverse(o => { if (o.isMesh && o.material && !o.material.emissiveIntensity !== undefined) list.push(o); });
  return list;
}
const WHITE = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });

class Enemy {
  constructor(G, x, y, z) {
    this.G = G; this.dead = false; this.flashT = 0; this.stun = 0; this.t = Math.random() * 10;
    this.root = new T.Group(); this.root.position.set(x, y, z); G.scene.add(this.root);
    this.home = new T.Vector3(x, y, z); this.r = 0.7; this.flying = false; this.gearDrop = 6;
  }
  get pos() { return this.root.position; }
  center(out) { return out.copy(this.root.position).setY(this.root.position.y + this.cy); }
  setupFlash() { compact(this.root); this.meshes = flashMats(this.root); this.mats = this.meshes.map(m => m.material); }
  flash(on) { this.meshes.forEach((m, i) => m.material = on ? WHITE : this.mats[i]); }
  hit(dmg, from) {
    if (this.dead) return;
    this.hp -= dmg; this.flashT = 0.1; this.flash(true);
    this.G.audio.play('hit', { vol: 0.7 });
    this.G.fx.sparks(this.center(V), 8, 5);
    if (from && this.body) { const d = V2.subVectors(this.pos, from).setY(0).normalize(); this.body.vel.addScaledVector(d, 5 + dmg); this.body.vel.y = 4; this.body.grounded = false; }
    this.aggro = true;
    if (this.hp <= 0) this.die();
  }
  die() {
    const G = this.G; this.dead = true;
    const c = this.center(V).clone();
    G.fx.explosion(c, 0.8, this.pos.y);
    G.fx.chunks(c, 14, 0.16, 0x8a4a30, this.pos.y, 6);
    G.audio.boom(0.7);
    G.spawnGears(c, this.gearDrop);
    G.scene.remove(this.root);
    if (this.solid) G.world.remove(this.solid);
    G.stats.kills++;
  }
  tickFlash(dt) { if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash(false); } }
  target() { return this.G.active; }
}

// ------------------------------------------------------------------ ORC PIRATE (melee)
// Hulking orc deckhand: green hide, tusked underbite, heavy brow, glowing eyes, bandana or tricorn, cutlass.
// ---- sculpting helpers for the goblin-orcs (high-poly, smooth shaded)
const gss = x => Math.exp(-x * x);
const sst3 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function sculptHead(r = 0.42) {
  const g = new T.SphereGeometry(r, 64, 48), p = g.attributes.position, v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)); const d = v.clone().normalize();
    let x = v.x * 1.16, y = v.y * 0.9, z = v.z;
    const front = sst3(0.1, 0.8, d.z);
    // wide heavy jaw + cheeks
    const low = sst3(0.0, -0.75, d.y);
    x *= 1 + 0.16 * low; z += r * 0.16 * low * Math.max(0, d.z);
    y -= r * 0.08 * low;
    // flat-ish back of the skull, slight hunch-forward forehead
    if (d.z < -0.3) z *= 0.92;
    // angry V brow ridge
    const browY = 0.22 + 0.2 * Math.abs(d.x) - 0.06;
    const brow = gss((d.y - browY) / 0.09) * front * sst3(0.75, 0.2, Math.abs(d.x));
    z += r * 0.3 * brow; y += r * 0.05 * brow;
    // deep eye sockets under the brow
    for (const sx of [-1, 1]) { const e = gss(Math.hypot(d.x - sx * 0.33, d.y - (browY - 0.17)) / 0.13); z -= r * 0.1 * e * front; }
    // cheekbones
    for (const sx of [-1, 1]) z += r * 0.06 * gss(Math.hypot(d.x - sx * 0.48, d.y + 0.02) / 0.16) * front;
    // mouth groove and jutting underbite lip
    const mouth = gss((d.y + 0.36) / 0.045) * front * sst3(0.62, 0.3, Math.abs(d.x));
    z -= r * 0.05 * mouth;
    const lip = gss((d.y + 0.47) / 0.08) * front * sst3(0.66, 0.25, Math.abs(d.x));
    z += r * 0.07 * lip;
    // bumpy skin
    const bump = Math.sin(v.x * 37) * Math.sin(v.y * 29) * Math.sin(v.z * 31);
    const s = 1 + bump * 0.008;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  g.computeVertexNormals();
  return g;
}
function taperTube(pts, r0, r1, seg = 16, rs = 10) {
  const curve = new T.CatmullRomCurve3(pts.map(q => new T.Vector3(...q)));
  const g = new T.TubeGeometry(curve, seg, 1, rs, false), p = g.attributes.position;
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg), rr = r0 + (r1 - r0) * Math.pow(i / seg, 0.8);
    for (let j = 0; j <= rs; j++) { const k = i * (rs + 1) + j; p.setXYZ(k, c.x + (p.getX(k) - c.x) * rr, c.y + (p.getY(k) - c.y) * rr, c.z + (p.getZ(k) - c.z) * rr); }
  }
  g.computeVertexNormals();
  return g;
}
function earGeo(len = 0.95, w = 0.3, inner = false) {
  const s = new T.Shape();
  s.moveTo(0, -w * 0.5);
  s.bezierCurveTo(len * 0.35, -w * 0.55, len * 0.75, -w * 0.25, len, w * 0.05);
  s.bezierCurveTo(len * 0.7, w * 0.22, len * 0.3, w * 0.5, 0, w * 0.5);
  s.lineTo(0, -w * 0.5);
  const g = new T.ExtrudeGeometry(s, { depth: inner ? 0.005 : 0.035, bevelEnabled: true, bevelThickness: inner ? 0.004 : 0.018, bevelSize: inner ? 0.004 : 0.02, bevelSegments: 3, curveSegments: 24 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + Math.pow(x / len, 2) * 0.16); p.setZ(i, p.getZ(i) - Math.sin(x / len * Math.PI) * 0.05 + Math.abs(p.getY(i)) * 0.15); }
  g.computeVertexNormals();
  return g;
}
function cleaverGeo() {
  const s = new T.Shape();
  const P = [[-0.05, 0], [0.07, 0.02], [0.12, 0.2], [0.17, 0.32], [0.14, 0.36], [0.2, 0.48], [0.22, 0.62], [0.18, 0.66], [0.22, 0.74], [0.2, 0.86], [0.13, 0.95], [0.02, 1.0], [-0.03, 0.9], [-0.04, 0.84], [-0.08, 0.8], [-0.07, 0.62], [-0.1, 0.56], [-0.08, 0.4], [-0.07, 0.2]];
  s.moveTo(...P[0]); for (let i = 1; i < P.length; i++) s.lineTo(...P[i]); s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.016, bevelSegments: 3, curveSegments: 6 });
  const p = g.attributes.position; // curve the blade
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) - Math.pow(y, 2) * 0.22); }
  g.computeVertexNormals();
  return g;
}

export function buildOrc(o = {}) {
  const R = new T.Group(), body = pivot(R, 0, 0, 0);
  const skin = o.dark ? MAT.orcSkinDark : MAT.orcSkin, hairMat = o.hairMat || MAT.hair;
  const cap = (r, len) => new T.CapsuleGeometry(r, len, 10, 24);
  // ---- legs: short, bowed, leather-wrapped, big clawed feet
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = pivot(body, sx * 0.22, 0.56, 0); hip.rotation.z = sx * 0.12;
    part(hip, cap(0.15, 0.12), MAT.leather, 0, -0.12, 0);
    const knee = pivot(hip, 0, -0.27, 0.03); knee.rotation.z = -sx * 0.2;
    for (let k = 0; k < 4; k++) part(knee, new T.TorusGeometry(0.135 - k * 0.006, 0.022, 8, 24), k % 2 ? MAT.leatherDark : MAT.leather, 0, 0.03 - k * 0.055, 0, Math.PI / 2, 0, k * 0.25);
    part(knee, cap(0.115, 0.1), skin, 0, -0.1, 0);
    const foot = pivot(knee, 0, -0.27, 0.04);
    part(foot, sph(0.16, 28, 20), skin, 0, 0.02, 0.04).scale.set(1.15, 0.62, 1.35);
    part(foot, new T.TorusGeometry(0.12, 0.025, 8, 24), MAT.leatherDark, 0, 0.1, 0, Math.PI / 2);
    for (const t of [-1, 0, 1]) {
      const toe = pivot(foot, t * 0.085, 0.0, 0.2); toe.rotation.y = t * 0.25;
      part(toe, sph(0.055, 16, 12), skin, 0, 0, 0).scale.set(1, 0.8, 1.2);
      part(toe, new T.ConeGeometry(0.04, 0.12, 14), MAT.ivory, 0, -0.01, 0.07, Math.PI / 2 + 0.35, 0, 0);
    }
    legs.push({ hip, knee });
  }
  // ---- leather kilt + belt
  const hips = pivot(body, 0, 0.6, 0);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, flap = part(hips, rbox(0.16, 0.3, 0.03, 0.012, 2), i % 3 ? MAT.leather : MAT.leatherDark, Math.sin(a) * 0.3, -0.1, Math.cos(a) * 0.27, -0.12 * Math.cos(a), a, 0);
    flap.rotation.order = 'YXZ'; flap.rotation.x = -0.15;
  }
  // ---- hunched barrel torso
  const torso = pivot(body, 0, 0.58, -0.02); torso.rotation.x = 0.28;
  part(torso, cap(0.34, 0.16), skin, 0, 0.3, 0).scale.set(1.25, 1, 0.95);
  part(torso, sph(0.3, 32, 24), skin, 0, 0.12, 0.08).scale.set(1.1, 0.85, 0.95);           // gut
  for (const sx of [-1, 1]) part(torso, sph(0.17, 28, 20), skin, sx * 0.17, 0.42, 0.22).scale.set(1.15, 0.8, 0.55); // pecs
  part(torso, new T.TorusGeometry(0.4, 0.05, 10, 40), MAT.leatherDark, 0, 0.05, 0.02, Math.PI / 2).scale.set(1.05, 0.92, 1);
  part(torso, rbox(0.16, 0.13, 0.05, 0.02, 3), MAT.gold, 0, 0.05, 0.38);
  const strap = part(torso, new T.TorusGeometry(0.44, 0.04, 10, 48), MAT.leather, 0, 0.32, 0.0, Math.PI / 2, 0.8, 0); strap.scale.set(1, 0.85, 1);
  part(torso, rbox(0.14, 0.16, 0.08, 0.03, 3), MAT.leatherDark, -0.3, 0.02, 0.24, 0, 0.5, 0);   // pouch
  // ---- the big head
  const head = pivot(torso, 0, 0.62, 0.16); head.rotation.x = -0.28;
  part(head, sculptHead(0.42), skin, 0, 0.05, 0);
  // big angular nose
  const noseG = new RoundedBoxGeometry(0.17, 0.3, 0.2, 4, 0.05); { const p = noseG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.15; p.setX(i, p.getX(i) * (0.55 + 0.45 * (1 - y) / 2 + 0.25)); p.setZ(i, p.getZ(i) + (1 - y) * 0.05); } noseG.computeVertexNormals(); }
  part(head, noseG, skin, 0, -0.03, 0.43, -0.18, 0, 0);
  for (const sx of [-1, 1]) part(head, sph(0.04, 12, 10), MAT.orcSkinDark, sx * 0.045, -0.15, 0.5).scale.set(1, 0.6, 0.6);  // nostrils
  for (const sx of [-1, 1]) {
    part(head, sph(0.06, 16, 12), MAT.black, sx * 0.145, 0.07, 0.36).scale.set(1.2, 0.7, 0.6);
    const eye = keep(part(head, sph(0.024, 16, 12), MAT.eyeRed, sx * 0.145, 0.06, 0.385)); eye.scale.set(1.3, 0.6, 0.8); eye.userData.eye = true;
    // tusks & teeth jutting up from the underbite
    part(head, new T.ConeGeometry(0.035, 0.13, 14), MAT.ivory, sx * 0.21, -0.16, 0.38, 0.1, 0, -sx * 0.18);
    part(head, rbox(0.045, 0.06, 0.03, 0.01, 2), MAT.ivory, sx * 0.07, -0.17, 0.43, 0, 0, sx * 0.1);
    // long flat ears
    const ear = pivot(head, sx * 0.44, 0.08, -0.04); ear.rotation.set(0, sx > 0 ? -0.15 : Math.PI + 0.15, sx * 0.08);
    part(ear, earGeo(0.95, 0.3), skin, 0, 0, 0);
    part(ear, earGeo(0.75, 0.17, true), MAT.orcSkinDark, 0.05, 0.02, 0.045);
    if (sx > 0) part(ear, new T.TorusGeometry(0.03, 0.008, 6, 16), MAT.gold, 0.3, -0.07, 0.02, 0, Math.PI / 2, 0);
    for (let k = 0; k < 2; k++) part(ear, sph(0.012, 8, 6), MAT.orcSkinDark, 0.2 + k * 0.25, 0.04 + k * 0.03, 0.05);
  }
  // braided beard from the chin
  const beard = pivot(head, 0, -0.32, 0.3); beard.rotation.x = 0.25;
  for (let i = 0; i < 7; i++) { const b = part(beard, sph(0.075 - i * 0.006, 20, 14), hairMat, 0, -i * 0.075, -i * 0.01); b.scale.set(1, 1.25, 0.8); b.rotation.z = (i % 2 ? 0.35 : -0.35); }
  part(beard, new T.TorusGeometry(0.05, 0.014, 8, 20), MAT.leatherDark, 0, -0.16, -0.01, Math.PI / 2);
  part(beard, new T.TorusGeometry(0.04, 0.012, 8, 20), MAT.gold, 0, -0.37, -0.03, Math.PI / 2);
  part(beard, new T.ConeGeometry(0.05, 0.16, 14), hairMat, 0, -0.56, -0.07, Math.PI, 0, 0);
  for (const sx of [-1, 1]) part(head, taperTube([[sx * 0.22, -0.18, 0.33], [sx * 0.18, -0.3, 0.33], [sx * 0.08, -0.36, 0.3]], 0.045, 0.01, 10, 10), hairMat);
  // shaggy swept-back hair
  for (let i = 0; i < 16; i++) {
    const a = (i / 15 - 0.5) * 2.4, ry = 0.36 + (i % 3) * 0.02;
    const sx = Math.sin(a) * 0.3, sz = -0.05 - Math.cos(a) * 0.08;
    const len = 0.45 + (i % 4) * 0.08;
    part(head, taperTube([[sx * 0.6, ry, sz + 0.12], [sx, ry + 0.08, sz - 0.12], [sx * 1.25, ry - len * 0.4, sz - 0.32], [sx * 1.4 + Math.sin(i) * 0.05, ry - len, sz - 0.3]], 0.07, 0.008, 14, 10), hairMat);
  }
  if (o.hat === 'tricorn') {
    const hat = pivot(head, 0, 0.42, -0.04);
    part(hat, cyl(0.5, 0.5, 0.05, 3), MAT.paintDark, 0, 0, 0, 0, Math.PI, 0);
    part(hat, cyl(0.24, 0.28, 0.22, 24), MAT.paintDark, 0, 0.11, 0);
    part(hat, cyl(0.285, 0.285, 0.04, 24), MAT.gold, 0, 0.03, 0);
  } else if (o.bandana) {
    part(head, new T.SphereGeometry(0.44, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.33), o.bandana, 0, 0.06, -0.03).scale.set(1.17, 0.95, 1.03);
  }
  // ---- arms: big forearms, clawed hands; left arm wears a wooden plank bracer
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 0.47, 0.44, 0.02);
    part(sh, sph(0.17, 28, 20), skin, 0, 0, 0);
    part(sh, cap(0.12, 0.2), skin, sx * 0.02, -0.18, 0);
    const el = pivot(sh, sx * 0.02, -0.36, 0);
    part(el, cap(0.14, 0.18), skin, 0, -0.14, 0).scale.set(1.1, 1, 1);   // popeye forearm
    if (sx < 0) {
      for (let k = 0; k < 5; k++) { const a = -1.1 + k * 0.55; part(el, rbox(0.1, 0.42, 0.05, 0.02, 3), MAT.planks, Math.sin(a) * 0.18, -0.14, Math.cos(a) * 0.18, 0, a, (k - 2) * 0.03); }
      for (const y of [-0.0, -0.28]) part(el, new T.TorusGeometry(0.2, 0.018, 8, 28), MAT.rope, 0, y, 0, Math.PI / 2);
      for (let k = 0; k < 4; k++) part(el, sph(0.014, 8, 6), MAT.ironDark, Math.sin(-0.55 + k * 0.4) * 0.215, -0.14, Math.cos(-0.55 + k * 0.4) * 0.215);
    } else {
      for (let k = 0; k < 3; k++) part(el, new T.TorusGeometry(0.15, 0.022, 8, 24), MAT.leatherDark, 0, -0.17 - k * 0.05, 0, Math.PI / 2);
    }
    const hand = pivot(el, 0, -0.38, 0.02);
    part(hand, sph(0.12, 24, 18), skin, 0, 0, 0).scale.set(1.1, 0.9, 1);
    for (const f of [-1, 0, 1]) {
      const fg = pivot(hand, f * 0.065, -0.08, 0.06); fg.rotation.x = 0.5;
      part(fg, cap(0.034, 0.06), skin, 0, -0.04, 0);
      part(fg, new T.ConeGeometry(0.026, 0.07, 12), MAT.ivory, 0, -0.11, 0.01, Math.PI, 0, 0);
    }
    arms.push({ sh, el, hand });
  }
  // ---- huge jagged cleaver with a red-rope grip
  const sword = pivot(arms[1].hand, 0, 0, 0.05); sword.rotation.x = Math.PI / 2;
  part(sword, cyl(0.032, 0.035, 0.3, 14), MAT.woodDark, 0, 0.0, 0);
  for (let i = 0; i < 6; i++) part(sword, new T.TorusGeometry(0.037, 0.011, 6, 16), MAT.clothRed, 0, -0.11 + i * 0.04, 0, Math.PI / 2);
  part(sword, taperTube([[0, -0.12, 0], [0.04, -0.25, 0.03], [0.02, -0.38, 0.0]], 0.012, 0.006, 10, 6), MAT.clothRed);
  part(sword, rbox(0.12, 0.04, 0.07, 0.015, 2), MAT.ironDark, 0, 0.16, 0);
  part(sword, cleaverGeo(), MAT.steel, -0.02, 0.17, -0.02).scale.set(1.15, 0.95, 1);
  for (let i = 0; i < 3; i++) part(sword, sph(0.016, 8, 6), MAT.brass, -0.05, 0.3 + i * 0.22, 0.03);
  R.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { root: R, body, torso, head, legs, arms, sword };
}

export class Orc extends Enemy {
  constructor(G, x, y, z) {
    super(G, x, y, z);
    const D = G.diff || 1; this.D = D;
    this.hp = 3 + Math.ceil(D / 2); this.speed = 3.5 + D * 0.2; this.windup = 0.56 - D * 0.03;
    this.cy = 0.85; this.r = 0.7; this.state = 'idle'; this.timer = 0; this.facing = Math.random() * 6; this.aggro = false;
    this.body = new Body(0.55, 1.6); this.body.pos.set(x, y, z); this.body.step = 0.35;
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const rig = buildOrc({ hat: Math.random() < 0.25 ? 'tricorn' : null, bandana: Math.random() < 0.35 ? pick([MAT.clothRed, MAT.clothBlue]) : null, hairMat: pick([MAT.hair, MAT.hairDark]), pants: pick([MAT.clothTan, MAT.clothBlue]), dark: Math.random() < 0.4 });
    this.root.add(rig.root); this.rig = rig;
    this.eyes = []; rig.root.traverse(m => { if (m.userData.eye) this.eyes.push(m); });
    this.setupFlash();
  }
  hit(dmg, from) { super.hit(dmg, from); if (!this.dead) this.G.audio.sfx('orc_grunt', { vol: 0.6 }); }
  die() { this.G.audio.sfx('orc_die', { vol: 0.7 }); super.die(); }
  update(dt) {
    const G = this.G, b = this.body, h = this.target(), hp = h.body.pos, rig = this.rig;
    this.t += dt; this.tickFlash(dt);
    const dx = hp.x - b.pos.x, dz = hp.z - b.pos.z, d = Math.hypot(dx, dz), dy = Math.abs(hp.y - b.pos.y);
    let wish = 0;
    const R = rig.arms[1];
    if (this.stun > 0) { this.stun -= dt; this.state = 'idle'; }
    else {
      if (!this.aggro && d < 13 && dy < 4) { this.aggro = true; G.audio.sfx('orc_grunt', { vol: 0.5, rate: 0.9 }); }
      if (this.aggro && (d > 26 || b.pos.distanceTo(this.home) > 30)) this.aggro = false;
      if (this.state === 'windup') {
        this.timer -= dt; this.facing = angLerp(this.facing, Math.atan2(dx, dz), dt * 6);
        const k = 1 - this.timer / this.windup;
        R.sh.rotation.set(-2.6 * k, 0, 0.4 * k); this.eyes.forEach(e => e.scale.setScalar(1.3 + Math.sin(this.t * 40) * 0.3));
        if (this.timer <= 0) {
          this.state = 'strike'; this.timer = 0.5; R.sh.rotation.set(0.5, 0, -0.2);
          G.audio.play('throw', { vol: 0.6 });
          const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
          if (d < 2.3 && dy < 1.4 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.2) h.hurt(1, b.pos);
        }
      } else if (this.state === 'strike') {
        this.timer -= dt; R.sh.rotation.x *= 0.9;
        if (this.timer <= 0) this.state = 'idle';
      } else if (this.aggro) {
        if (d < 1.9 && dy < 1.4) { this.state = 'windup'; this.timer = this.windup; }
        else { wish = 1; this.facing = angLerp(this.facing, Math.atan2(dx, dz), dt * 5); }
      } else {
        const hx = this.home.x + Math.sin(this.t * 0.4) * 2.5 - b.pos.x, hz = this.home.z + Math.cos(this.t * 0.31) * 2.5 - b.pos.z;
        if (Math.hypot(hx, hz) > 0.4) { wish = 0.35; this.facing = angLerp(this.facing, Math.atan2(hx, hz), dt * 2); }
      }
    }
    const sp = this.speed * wish, ac = b.grounded ? 20 : 4;
    b.vel.x += (Math.sin(this.facing) * sp - b.vel.x) * Math.min(1, ac * dt);
    b.vel.z += (Math.cos(this.facing) * sp - b.vel.z) * Math.min(1, ac * dt);
    moveBody(G.world, b, dt);
    if (b.pos.y < -0.5) { G.fx.splash(V.copy(b.pos).setY(0.2)); this.die(); return; }
    this.root.position.copy(b.pos); this.root.rotation.y = this.facing;
    const mv = Math.min(1, Math.hypot(b.vel.x, b.vel.z) / 3.9), ph = this.t * 9;
    rig.body.position.y = Math.abs(Math.sin(ph)) * 0.06 * mv;
    rig.torso.rotation.set(0.28 + 0.1 * mv + (this.state === 'windup' ? -0.15 : 0), Math.sin(ph) * 0.15 * mv, Math.sin(ph) * 0.06 * mv);
    rig.head.rotation.set(-0.28 - 0.06 * mv, Math.sin(this.t * 1.7) * 0.3 * (this.aggro ? 0.2 : 1), 0);
    rig.legs.forEach((L, i) => { const p = Math.sin(ph + (i ? Math.PI : 0)); L.hip.rotation.x = p * 0.6 * mv; L.knee.rotation.x = Math.max(0, -Math.cos(ph + (i ? Math.PI : 0))) * 0.8 * mv; });
    rig.arms[0].sh.rotation.set(-Math.sin(ph) * 0.5 * mv, 0, -0.25); rig.arms[0].el.rotation.x = -0.5;
    if (this.state === 'idle') { R.sh.rotation.set(Math.sin(ph) * 0.4 * mv - 0.3, 0, 0.25); R.el.rotation.x = -0.6; }
    if (!this.aggro) this.eyes.forEach(e => e.scale.setScalar(1));
  }
}
export { Orc as Bilgebot };


// ------------------------------------------------------------------ ORC BRUTE (giant, door-plank shield blocks shots from the front)
export class Brute extends Orc {
  constructor(G, x, y, z) {
    super(G, x, y, z);
    const D = G.diff || 1;
    this.hp = 9 + D * 2; this.speed = 2.4 + D * 0.12; this.windup = 0.85 - D * 0.04; this.cy = 1.25; this.r = 1.0; this.gearDrop = 16;
    this.body.r = 0.75; this.body.h = 2.3;
    this.rig.root.scale.setScalar(1.45);
    this.rig.sword.visible = false;
    const sh = this.shield = new T.Group(); this.rig.arms[0].hand.add(sh); sh.position.set(0.05, 0.05, 0.22);
    for (let i = -2; i <= 2; i++) part(sh, rbox(0.2, 1.0, 0.07, 0.03, 2), MAT.planks, i * 0.2, 0.15, 0, 0, 0, i * 0.02);
    for (const y of [-0.2, 0.5]) part(sh, box(1.08, 0.09, 0.09), MAT.ironDark, 0, y, 0.04);
    for (let i = -2; i <= 2; i++) part(sh, sph(0.025, 6, 4), MAT.brass, i * 0.2, 0.5, 0.09);
    part(sh, box(0.3, 0.3, 0.05), MAT.paintRed, 0, 0.18, 0.06, 0, 0, Math.PI / 4);
    sh.traverse(m => { if (m.isMesh) m.castShadow = true; });
    // spiked club
    const club = new T.Group(); this.rig.arms[1].hand.add(club); club.rotation.x = Math.PI / 2;
    part(club, cyl(0.06, 0.14, 0.9, 12), MAT.woodDark, 0, 0.45, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(club, new T.ConeGeometry(0.035, 0.12, 8), MAT.iron, Math.cos(a) * 0.13, 0.7, Math.sin(a) * 0.13, 0, 0, -Math.PI / 2 + a); }
    this.setupFlash();
  }
  hit(dmg, from, charged, at, src) {
    if (this.dead) return;
    if (src === 'slam') { this.stun = 2.2; this.G.hint('The brute is stunned — its shield is down! Blast it now!', 3, 'brutestun'); return super.hit(dmg, from); }
    if (from && !charged && this.stun <= 0) {
      const fx = Math.sin(this.facing), fz = Math.cos(this.facing), dx = from.x - this.pos.x, dz = from.z - this.pos.z;
      if ((dx * fx + dz * fz) / Math.max(0.01, Math.hypot(dx, dz)) > 0.15) {
        this.G.fx.sparks(V.set(this.pos.x + fx * 0.9, this.pos.y + 1.3, this.pos.z + fz * 0.9), 10, 5, [1, 0.8, 0.4]);
        this.G.audio.sfx('wood_break', { vol: 0.4, rate: 1.4 });
        this.G.hint('Brutes block with their shields! Use a HEAVY shot, hit them from behind, or slam with Cubey to stun them.', 5, 'brute');
        return;
      }
    }
    super.hit(charged ? dmg * 1.5 : dmg, from);
  }
  update(dt) {
    const prevState = this.state;
    super.update(dt);
    if (this.dead) return;
    this.rig.arms[0].sh.rotation.set(-1.2, 0.35, -0.1); this.rig.arms[0].el.rotation.x = -0.7;
    if (this.stun > 0) this.rig.arms[0].sh.rotation.set(0.4, 0, -0.6);
    // heavy ground pound instead of a sword swipe
    if (prevState === 'windup' && this.state === 'strike') {
      const G = this.G, p = this.pos;
      G.fx.ring(p.clone(), 5, 0.4); G.fx.puff(p, 10, 1.2, 1.6, [0.7, 0.65, 0.58]); G.audio.boom(0.7); G.shake(0.35);
      if (G.active.pos.distanceTo(p) < 2.8) G.active.hurt(2, p);
    }
  }
}

// ------------------------------------------------------------------ ORC BOMBER (keeps its distance and lobs bombs)
export class Bomber extends Orc {
  constructor(G, x, y, z) {
    super(G, x, y, z);
    const D = G.diff || 1;
    this.hp = 2 + Math.ceil(D / 2); this.gearDrop = 8; this.throwT = 2 + Math.random() * 2;
    this.rig.sword.visible = false;
    const bomb = this.bomb = new T.Group(); this.rig.arms[1].hand.add(bomb); bomb.position.set(0, -0.1, 0.12);
    part(bomb, sph(0.16, 16, 12), MAT.black, 0, 0, 0);
    part(bomb, cyl(0.05, 0.05, 0.06, 10), MAT.brass, 0, 0.16, 0);
    this.fuse = keep(part(bomb, sph(0.03, 8, 6), MAT.ember, 0, 0.21, 0));
    for (const sx of [-1, 1]) { const bag = part(this.rig.torso, sph(0.12, 12, 10), MAT.black, sx * 0.3, 0.05, 0.25); bag.castShadow = true; }
    this.setupFlash();
  }
  update(dt) {
    const G = this.G, b = this.body, hp = G.active.pos;
    const dx = hp.x - b.pos.x, dz = hp.z - b.pos.z, d = Math.hypot(dx, dz);
    if (!this.aggro && d < 18 && Math.abs(hp.y - b.pos.y) < 6) this.aggro = true;
    if (this.aggro && this.stun <= 0) {
      this.facing = angLerp(this.facing, Math.atan2(dx, dz), dt * 6);
      // keep 7..12 m away
      const want = d < 7 ? -1 : d > 12 ? 1 : 0;
      b.vel.x += (Math.sin(this.facing) * 3.2 * want - b.vel.x) * Math.min(1, 12 * dt);
      b.vel.z += (Math.cos(this.facing) * 3.2 * want - b.vel.z) * Math.min(1, 12 * dt);
      this.throwT -= dt;
      const A = this.rig.arms[1];
      if (this.throwT < 0.5) A.sh.rotation.set(-2.8 * (1 - Math.max(0, this.throwT) / 0.5), 0, 0.3);
      if (this.throwT <= 0) {
        this.throwT = 3.6 - (G.diff || 1) * 0.3 + Math.random();
        const from = this.bomb.getWorldPosition(new T.Vector3());
        const tgt = hp.clone().add(V2.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)).addScaledVector(G.active.body.vel, 0.5);
        const g = G.world.groundAt(tgt.x, tgt.z, 0.1, hp.y + 2); tgt.y = g.solid ? g.y : hp.y;
        G.spawnBomb(from, tgt, 1.15);
        G.audio.play('throw', { vol: 0.6, rate: 0.8 });
        A.sh.rotation.set(0.6, 0, 0.2);
      }
      moveBody(G.world, b, dt);
      if (b.pos.y < -0.5) { G.fx.splash(V.copy(b.pos).setY(0.2)); this.die(); return; }
      this.t += dt; this.tickFlash(dt);
      this.root.position.copy(b.pos); this.root.rotation.y = this.facing;
      const mv = Math.min(1, Math.hypot(b.vel.x, b.vel.z) / 3), ph = this.t * 9;
      this.rig.legs.forEach((L, i) => { const p = Math.sin(ph + (i ? Math.PI : 0)); L.hip.rotation.x = p * 0.6 * mv; });
      this.fuse.scale.setScalar(1 + Math.random() * 0.6);
    } else super.update(dt);
  }
}

// ------------------------------------------------------------------ DECK TURRET
export class Turret extends Enemy {
  constructor(G, x, y, z, facing = 0) {
    super(G, x, y, z);
    this.hp = 6; this.cy = 1.2; this.r = 0.9; this.facing = facing; this.cool = 1 + Math.random(); this.burst = 0; this.aggro = false; this.gearDrop = 10;
    const R = this.root;
    part(R, cyl(0.7, 0.85, 0.5, 16), MAT.ironDark, 0, 0.25, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(R, sph(0.05, 6, 4), MAT.brass, Math.cos(a) * 0.72, 0.45, Math.sin(a) * 0.72); }
    const yoke = this.yoke = pivot(R, 0, 0.5, 0);
    part(yoke, cyl(0.5, 0.55, 0.25, 16), MAT.plate, 0, 0.12, 0);
    for (const sx of [-1, 1]) part(yoke, rbox(0.12, 0.7, 0.4, 0.04), MAT.paintDark, sx * 0.38, 0.5, 0);
    const gun = this.gun = pivot(yoke, 0, 0.7, 0);
    part(gun, lathe([[0, -0.4], [0.2, -0.38], [0.24, -0.2], [0.22, 0], [0.16, 0.2], [0.14, 0.75], [0.17, 0.8], [0.17, 0.9], [0.1, 0.9]], 18), MAT.iron, 0, 0, 0, Math.PI / 2);
    part(gun, cyl(0.1, 0.1, 0.02, 12), MAT.bore, 0, 0, 0.91, Math.PI / 2);
    part(gun, torus(0.17, 0.025, 6, 16), MAT.brass, 0, 0, 0.82);
    part(gun, cyl(0.06, 0.06, 0.9, 10), MAT.ironDark, 0, 0, 0, 0, 0, Math.PI / 2);
    // armored shield plate with eye lens
    part(gun, rbox(1.1, 0.8, 0.08, 0.04), MAT.plateRust, 0, 0.05, 0.35);
    part(gun, torus(0.12, 0.03, 8, 16), MAT.brass, 0.32, 0.18, 0.4);
    this.eye = keep(part(gun, sph(0.1, 12, 8), MAT.eyeRed, 0.32, 0.18, 0.4));
    this.muzzle = pivot(gun, 0, 0, 1.0);
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.solid = G.world.add([x - 0.8, y, z - 0.8], [x + 0.8, y + 1.7, z + 0.8], { owner: this, walkable: true });
    this.setupFlash();
  }
  update(dt) {
    const G = this.G, h = this.target(), hp = h.body.pos;
    this.t += dt; this.tickFlash(dt); this.cool -= dt;
    const o = V.copy(this.pos); o.y += 1.2;
    const tgt = V2.copy(hp); tgt.y += 0.9;
    const d = o.distanceTo(tgt);
    let sees = false;
    if (d < 25) {
      const dir = tgt.clone().sub(o).normalize();
      const hit = G.world.raycast(o.clone().addScaledVector(dir, 1.1), dir, d - 1.2, s => s.blocksShots && s !== this.solid);
      sees = !hit.solid;
    }
    if (sees) {
      this.aggro = true;
      const yaw = Math.atan2(tgt.x - o.x, tgt.z - o.z);
      this.facing = angLerp(this.facing, yaw, dt * 3.2);
      const pitch = Math.atan2(tgt.y - o.y, Math.hypot(tgt.x - o.x, tgt.z - o.z));
      this.gun.rotation.x = -pitch;
      if (this.cool < 0.6 && this.cool > 0) this.eye.scale.setScalar(1.3 + Math.sin(this.t * 50) * 0.3);
      if (this.cool <= 0) {
        const D = G.diff || 1; this.burst = 2 + (D >= 4 ? 1 : 0); this.cool = 3.0 - D * 0.18;
      }
    } else { this.facing += dt * 0.3 * Math.sin(this.t * 0.5); this.eye.scale.setScalar(1); }
    if (this.burst > 0) {
      this.burstT = (this.burstT || 0) - dt;
      if (this.burstT <= 0) {
        this.burstT = 0.2; this.burst--;
        const m = this.muzzle.getWorldPosition(new T.Vector3());
        const lead = V2.copy(hp); lead.y += 0.9; lead.addScaledVector(h.body.vel, Math.min(0.5, m.distanceTo(lead) / 16) * 0.6);
        G.spawnBolt(m, lead.sub(m).normalize(), 13 + (G.diff || 1), this);
        G.fx.flash(m, 15, 0.08, 0xff6030); G.audio.play('shot', { vol: 0.3, rate: 1.6 });
        this.gun.position.z = -0.15;
      }
    }
    this.gun.position.z *= 0.85;
    this.yoke.rotation.y = this.facing;
  }
}

// ------------------------------------------------------------------ GULL DRONE (flying)
export class Gull extends Enemy {
  constructor(G, x, y, z) {
    super(G, x, y, z);
    this.hp = 2 + Math.floor((G.diff || 1) / 3); this.cy = 0; this.r = 0.75; this.flying = true; this.state = 'hover'; this.timer = 2 + Math.random() * 2; this.aggro = false; this.gearDrop = 5;
    this.vel = new T.Vector3(); this.facing = 0;
    const R = this.root;
    const bod = part(R, sph(0.32, 16, 12), MAT.copper, 0, 0, 0); bod.scale.set(0.9, 0.8, 1.4);
    part(R, cyl(0.001, 0.12, 0.4, 10), MAT.paintYellow, 0, -0.02, 0.55, Math.PI / 2);
    part(R, torus(0.1, 0.025, 6, 14), MAT.brass, 0.15, 0.1, 0.3, 0, 0.5, 0);
    this.eye = part(R, sph(0.07, 10, 8), MAT.eyeRed, 0.16, 0.1, 0.33);
    part(R, torus(0.1, 0.025, 6, 14), MAT.brass, -0.15, 0.1, 0.3, 0, -0.5, 0);
    part(R, sph(0.07, 10, 8), MAT.eyeRed, -0.16, 0.1, 0.33);
    part(R, box(0.04, 0.3, 0.35), MAT.paintDark, 0, 0.2, -0.35, -0.4);
    this.wings = [];
    for (const sx of [-1, 1]) {
      const w = pivot(R, sx * 0.25, 0.05, 0);
      const wing = part(w, rbox(0.9, 0.04, 0.4, 0.015), MAT.canvas, sx * 0.45, 0, 0); wing.material = MAT.plate;
      part(w, rbox(0.5, 0.05, 0.3, 0.015), MAT.paintWhite, sx * 1.0, 0, -0.04, 0, sx * 0.3, 0);
      this.wings.push(w);
    }
    this.prop = pivot(R, 0, 0, -0.5);
    for (let i = 0; i < 3; i++) part(this.prop, box(0.5, 0.03, 0.08), MAT.brass, 0, 0, 0, 0, 0, i * Math.PI / 3 * 2);
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.setupFlash();
  }
  hit(dmg, from) { super.hit(dmg, null); if (!this.dead && from) this.vel.add(V.subVectors(this.pos, from).normalize().multiplyScalar(6)); }
  update(dt) {
    const G = this.G, h = this.target(), hp = h.body.pos;
    this.t += dt; this.tickFlash(dt); this.timer -= dt;
    const p = this.pos, d = p.distanceTo(hp);
    if (!this.aggro && d < 16) this.aggro = true;
    let goal;
    if (this.state === 'dive') {
      goal = V.copy(this.diveTo);
      if (p.distanceTo(goal) < 0.8 || this.timer <= 0) { this.state = 'hover'; this.timer = 2.2 + Math.random() * 1.5; }
      if (p.distanceTo(V2.copy(hp).setY(hp.y + 0.9)) < 1.1 && !this.struck) { this.struck = true; h.hurt(1, p); }
    } else {
      const anchor = this.aggro ? V2.copy(hp) : this.home;
      const a = this.t * 0.9;
      goal = V.set(anchor.x + Math.cos(a) * 4.5, anchor.y + 3.6 + Math.sin(this.t * 1.7) * 0.5, anchor.z + Math.sin(a) * 4.5);
      if (this.aggro && this.timer <= 0) { this.state = 'dive'; this.diveTo = hp.clone().setY(hp.y + 0.9); this.timer = 1.6; this.struck = false; G.audio.play('throw', { vol: 0.4, rate: 1.5 }); }
    }
    const sp = this.state === 'dive' ? 11 : 6;
    const want = V2.copy(goal).sub(p); const l = want.length(); if (l > 0.01) want.multiplyScalar(Math.min(sp, l * 3) / l);
    this.vel.lerp(want, 1 - Math.exp(-3 * dt));
    // avoid solids a bit
    if (G.world.pointInside(V.copy(p).addScaledVector(this.vel, 0.2), 0.2)) this.vel.y += 20 * dt;
    p.addScaledVector(this.vel, dt);
    if (Math.hypot(this.vel.x, this.vel.z) > 0.3) this.facing = angLerp(this.facing, Math.atan2(this.vel.x, this.vel.z), dt * 5);
    this.root.rotation.set(this.state === 'dive' ? 0.6 : -this.vel.y * 0.05, this.facing, 0);
    const flap = Math.sin(this.t * 22) * 0.6;
    this.wings[0].rotation.z = flap; this.wings[1].rotation.z = -flap;
    this.prop.rotation.z += dt * 40;
  }
}

// ------------------------------------------------------------------ BOSS: IRONCLAW
export class Ironclaw extends Enemy {
  constructor(G, x, y, z) {
    super(G, x, y, z);
    this.maxHp = this.hp = 70 + (G.diff || 1) * 14; this.cy = 2.4; this.r = 2.6; this.name = 'Admiral Ironclaw'; this.active = false;
    this.facing = 0; this.state = 'walk'; this.timer = 3; this.cycle = 0; this.vent = 0; this.summoned = 0; this.gearDrop = 60;
    const R = this.root, body = this.bodyG = pivot(R, 0, 2.1, 0);
    const shell = part(body, sph(1.9, 32, 16), MAT.plateRust, 0, 0, 0); shell.scale.set(1.25, 0.62, 1.0);
    const belly = part(body, sph(1.75, 24, 12), MAT.ironDark, 0, -0.25, 0); belly.scale.set(1.2, 0.5, 0.95);
    part(body, torus(1.9, 0.08, 6, 40), MAT.brass, 0, 0, 0, Math.PI / 2).scale.set(1.25, 1.0, 1);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; part(body, sph(0.08, 6, 4), MAT.brass, Math.cos(a) * 2.37, 0.02, Math.sin(a) * 1.9); }
    // smokestacks
    for (const sx of [-0.6, 0.6]) { part(body, cyl(0.22, 0.28, 1.4, 12), MAT.paintDark, sx, 1.4, -0.6); part(body, torus(0.24, 0.05, 6, 14), MAT.brass, sx, 2.1, -0.6, Math.PI / 2); }
    this.stacks = [new T.Vector3(-0.6, 2.2, -0.6), new T.Vector3(0.6, 2.2, -0.6)];
    // mortar
    this.mortar = pivot(body, 0, 1.0, 0.3);
    part(this.mortar, cyl(0.5, 0.6, 0.4, 16), MAT.iron, 0, 0, 0);
    part(this.mortar, lathe([[0, 0], [0.45, 0], [0.42, 0.6], [0.38, 0.9], [0.45, 1.0], [0.3, 1.0]], 18), MAT.iron, 0, 0.1, 0);
    // cockpit with eye stalks
    for (const sx of [-1, 1]) {
      const st = pivot(body, sx * 0.55, 0.7, 1.4);
      part(st, cyl(0.08, 0.1, 1.0, 8), MAT.ironDark, 0, 0.5, 0);
      part(st, sph(0.25, 14, 10), MAT.brass, 0, 1.05, 0);
      part(st, sph(0.15, 12, 8), MAT.eyeAmber, 0, 1.05, 0.15);
    }
    // the orc admiral rides in a brass-railed cockpit on top
    const cap = this.captain = buildOrc({ hat: 'tricorn', bandana: MAT.clothRed, pants: MAT.clothBlue });
    cap.root.scale.setScalar(1.6); cap.root.position.set(0, 0.6, 0.55); body.add(cap.root);
    part(body, torus(0.75, 0.05, 6, 24), MAT.brass, 0, 1.25, 0.55, Math.PI / 2);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(body, cyl(0.03, 0.03, 0.55, 5), MAT.brass, Math.cos(a) * 0.75, 0.98, 0.55 + Math.sin(a) * 0.75); }
    // core hatch (front)
    this.coreG = pivot(body, 0, -0.3, 1.55);
    this.core = keep(part(this.coreG, sph(0.6, 20, 14), MAT.ember, 0, 0, -0.15));
    this.hatch = pivot(this.coreG, 0, 0.6, 0.25);
    part(this.hatch, rbox(1.5, 1.3, 0.2, 0.08), MAT.plate, 0, -0.62, 0);
    for (let i = 0; i < 4; i++) part(this.hatch, box(1.2, 0.06, 0.05), MAT.ironDark, 0, -0.25 - i * 0.25, 0.11);
    // legs
    this.legs = [];
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1, k = i % 3, z = (k - 1) * 1.2;
      const hip = pivot(body, side * 2.0, -0.3, z);
      hip.rotation.y = side * (Math.PI / 2) + (k - 1) * -0.4 * side;
      const up = pivot(hip, 0, 0, 0);
      part(up, cyl(0.16, 0.2, 1.8, 10), MAT.paintRed, 0, 0, 0.9, Math.PI / 2);
      part(up, sph(0.26, 10, 8), MAT.brass, 0, 0, 0);
      const knee = pivot(up, 0, 0, 1.8);
      part(knee, sph(0.22, 10, 8), MAT.brass, 0, 0, 0);
      part(knee, cyl(0.16, 0.05, 2.4, 10), MAT.ironDark, 0, -1.1, 0.3, 0.25);
      up.rotation.x = -0.5; knee.rotation.x = 0.4;
      this.legs.push({ up, knee, phase: (i % 2) * Math.PI + k * 0.5 });
    }
    // claws
    this.claws = [];
    for (const sx of [-1, 1]) {
      const sh = pivot(body, sx * 1.7, 0.1, 1.2);
      part(sh, sph(0.35, 12, 10), MAT.brass, 0, 0, 0);
      part(sh, cyl(0.22, 0.25, 1.6, 10), MAT.paintRed, 0, 0, 0.8, Math.PI / 2);
      const fore = pivot(sh, 0, 0, 1.6);
      part(fore, sph(0.3, 10, 8), MAT.brass, 0, 0, 0);
      const pinA = part(fore, rbox(0.5, 0.35, 1.5, 0.12), MAT.plateRust, 0, 0.2, 0.75, -0.15);
      const pinB = part(fore, rbox(0.45, 0.28, 1.2, 0.1), MAT.plateRust, 0, -0.2, 0.6, 0.25);
      for (let t = 0; t < 4; t++) part(pinA, cyl(0.001, 0.07, 0.18, 6), MAT.iron, 0, -0.22, -0.4 + t * 0.3, Math.PI);
      sh.rotation.y = -sx * 0.35;
      this.claws.push({ sh, fore, pinA, pinB });
    }
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.solid = G.world.add([x - 2.4, y, z - 2.0], [x + 2.4, y + 3.4, z + 2.0], { owner: this, walkable: false });
    this.setupFlash();
    this.coreMats = new Set([this.core]);
    this.prevPos = this.root.position.clone();
    this.armorHint = false;
  }
  coreWorld(out) { return this.core.getWorldPosition(out); }
  hit(dmg, from, charged, at) {
    if (this.dead || !this.active) return;
    const G = this.G;
    const nearCore = at && this.vent > 0 && at.distanceTo(this.coreWorld(V)) < 1.7;
    if (!nearCore) {
      G.fx.sparks(at || this.center(V), 8, 6, [1, 0.8, 0.4]); G.audio.play('hit', { vol: 0.6, rate: 0.6 });
      if (!this.armorHint) { this.armorHint = true; G.hint('Its armor is too thick! Wait for Ironclaw to vent, then hit the glowing core.', 5, 'bossarmor'); }
      this.hp -= dmg * 0.1;
    } else { this.hp -= dmg; G.shake(0.25); G.fx.explosion(this.coreWorld(V), 0.6); }
    this.flashT = 0.08; this.flash(true);
    if (this.hp <= this.maxHp * 0.5 && this.summoned === 0) { this.summoned = 1; G.bossSummon(this, 1); G.hud.banner('Ironclaw is enraged!', 'Phase 2'); G.shake(0.6); }
    if (this.hp <= this.maxHp * 0.25 && this.summoned === 1) { this.summoned = 2; G.bossSummon(this, 2); }
    if (this.hp <= 0) this.dieBig();
  }
  dieBig() {
    const G = this.G; this.dead = true; this.dying = 2.5;
    G.world.remove(this.solid);
    G.bossDefeated(this);
  }
  update(dt) {
    const G = this.G;
    this.t += dt; this.tickFlash(dt);
    if (this.dead) {
      this.dying -= dt;
      if (Math.random() < dt * 12) { const p = this.center(V).add(V2.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4)); G.fx.explosion(p, 0.9); G.audio.boom(0.6); G.shake(0.2); }
      this.bodyG.position.y = 2.1 - (1 - Math.max(0, this.dying) / 2.5) * 1.6; this.bodyG.rotation.z += dt * 0.1;
      if (this.dying <= 0 && this.root.parent) { G.fx.explosion(this.center(V), 2.5); G.audio.boom(1.6); G.shake(1); G.spawnGears(this.center(V), this.gearDrop); G.scene.remove(this.root); }
      return;
    }
    const h = this.target(), hp = h.body.pos, p = this.root.position;
    const dx = hp.x - p.x, dz = hp.z - p.z, d = Math.hypot(dx, dz);
    // smoke
    if (Math.random() < dt * 8) for (const s of this.stacks) { const w = this.bodyG.localToWorld(V.copy(s)); G.fx.smoke.emit(w.x, w.y, w.z, 0, 2.5, 0, 1.0, 2.0, 0.25, 0.23, 0.22, { grow: 3, drag: 0.6, alpha: 0.7 }); }
    if (!this.active) { this.anim(dt, 0); return; }
    let move = 0;
    this.timer -= dt;
    switch (this.state) {
      case 'walk': {
        this.facing = angLerp(this.facing, Math.atan2(dx, dz), dt * 1.5);
        if (d > 5.5) move = this.hp < this.maxHp * 0.5 ? 3.4 : 2.4;
        if (d < 5 && this.timer < 1.5) { this.state = 'slamWind'; this.timer = 0.9; G.audio.play('boss', { vol: 0.5 }); }
        else if (this.timer <= 0) { this.cycle++; if (this.cycle % 2) { this.state = 'barrage'; this.timer = 0.6; this.shots = this.hp < this.maxHp * 0.5 ? 9 : 6; } else { this.state = 'broadside'; this.timer = 0.8; this.shots = this.hp < this.maxHp * 0.5 ? 5 : 3; } }
        break;
      }
      case 'slamWind': {
        const k = 1 - this.timer / 0.9; this.claws.forEach(c => { c.sh.rotation.x = -k * 1.0; });
        this.facing = angLerp(this.facing, Math.atan2(dx, dz), dt * 2);
        if (this.timer <= 0) {
          this.claws.forEach(c => c.sh.rotation.x = 0.5);
          const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
          const hitP = V.set(p.x + fx * 4.2, p.y, p.z + fz * 4.2);
          G.fx.ring(hitP, 6, 0.5); G.fx.chunks(hitP.clone().setY(p.y + 0.3), 16, 0.3, 0x9c8f82, p.y, 7); G.fx.puff(hitP, 14, 2, 2, [0.6, 0.56, 0.5]);
          G.audio.boom(1.2); G.shake(0.8);
          if (hp.distanceTo(hitP) < 3.2 && hp.y < p.y + 1.5) h.hurt(2, hitP);
          for (const c of G.cubes) if (V2.set((c.solid.min.x + c.solid.max.x) / 2, 0, (c.solid.min.z + c.solid.max.z) / 2).distanceTo(V.clone().setY(0)) < 3) c.crumble();
          this.state = 'recover'; this.timer = 1.0;
        }
        break;
      }
      case 'recover': this.claws.forEach(c => c.sh.rotation.x *= 0.92); if (this.timer <= 0) { this.state = 'walk'; this.timer = 4 + Math.random() * 2; } break;
      case 'barrage': {
        this.mortar.rotation.x = -0.3;
        if (this.timer <= 0 && this.shots > 0) {
          this.shots--; this.timer = 0.32;
          const m = this.bodyG.localToWorld(V.set(0, 2.2, 0.3)).clone();
          const tgt = V2.copy(hp).add(V.set((Math.random() - 0.5) * 7, 0, (Math.random() - 0.5) * 7));
          if (this.shots % 3 === 2) tgt.copy(hp);
          const gy = G.world.groundAt(tgt.x, tgt.z, 0.1, hp.y + 3).y;
          tgt.y = isFinite(gy) && gy > -5 ? gy : hp.y;
          G.spawnBomb(m, tgt, 1.5);
          G.fx.puff(m, 6, 0.4, 1.4, [0.4, 0.38, 0.36], 2); G.audio.boom(0.5);
        }
        if (this.shots <= 0 && this.timer <= 0) { this.state = 'vent'; this.timer = 4.5; this.vent = 4.5; G.audio.play('powerup', { vol: 0.6, rate: 0.6 }); this.mortar.rotation.x = 0; }
        break;
      }
      case 'broadside': {
        this.facing = angLerp(this.facing, Math.atan2(dx, dz), dt * 2.5);
        if (this.timer <= 0 && this.shots > 0) {
          this.shots--; this.timer = 0.55;
          for (const c of this.claws) {
            const m = c.fore.localToWorld(V.set(0, 0, 1.4)).clone();
            for (let i = -2; i <= 2; i++) {
              const dir = V2.set(hp.x - m.x, hp.y + 0.9 - m.y, hp.z - m.z).normalize();
              dir.applyAxisAngle(new T.Vector3(0, 1, 0), i * 0.16);
              G.spawnBolt(m, dir, 13, this);
            }
            G.fx.flash(m, 30, 0.1, 0xff5020);
          }
          G.audio.play('shot', { vol: 0.5, rate: 1.2 });
        }
        if (this.shots <= 0 && this.timer <= 0) { this.state = 'vent'; this.timer = 3.5; this.vent = 3.5; G.audio.play('powerup', { vol: 0.6, rate: 0.6 }); }
        break;
      }
      case 'vent': {
        this.vent = this.timer;
        if (Math.random() < dt * 30) { const w = this.coreWorld(V); G.fx.smoke.emit(w.x + (Math.random() - 0.5), w.y + 0.5, w.z, (Math.random() - 0.5) * 2, 3, 1, 0.9, 1.0, 0.95, 0.95, 0.95, { grow: 2.5, drag: 1, alpha: 0.5 }); }
        if (this.timer <= 0) { this.vent = 0; this.state = 'walk'; this.timer = 5 + Math.random() * 2; }
        break;
      }
    }
    // movement
    if (move) {
      const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
      const nx = p.x + fx * move * dt, nz = p.z + fz * move * dt;
      const b = this.bounds;
      if (!b || (nx > b[0] && nx < b[1] && nz > b[2] && nz < b[3])) { p.x = nx; p.z = nz; }
    }
    this.solid.moveBy(p.x - this.prevPos.x, 0, p.z - this.prevPos.z); this.prevPos.copy(p);
    // separate heroes
    for (const hh of G.heroes) {
      const q = hh.body.pos, ddx = q.x - p.x, ddz = q.z - p.z, dd = Math.hypot(ddx, ddz);
      if (dd < 3.0 && q.y < p.y + 3.2) { q.x = p.x + ddx / dd * 3.0; q.z = p.z + ddz / dd * 3.0; }
    }
    this.root.rotation.y = this.facing;
    this.anim(dt, move);
  }
  anim(dt, move) {
    const k = this.vent > 0 ? 1 : 0;
    const c = this.captain;
    if (c) {
      const busy = this.state === 'barrage' || this.state === 'broadside' || this.state === 'slamWind';
      c.arms[1].sh.rotation.set(busy ? -2.6 + Math.sin(this.t * 10) * 0.3 : -0.4 + Math.sin(this.t * 1.5) * 0.1, 0, 0.3);
      c.arms[0].sh.rotation.set(k ? -1.2 : -0.2, 0, -0.5 - (k ? 0.6 : 0));
      c.torso.rotation.x = k ? 0.5 : 0.1; c.head.rotation.y = Math.sin(this.t * 0.8) * 0.4;
    }
    this.hatch.rotation.x += ((k ? -1.6 : 0) - this.hatch.rotation.x) * Math.min(1, dt * 6);
    this.core.scale.setScalar(1 + Math.sin(this.t * 12) * 0.08 * k);
    this.bodyG.position.y = 2.1 + Math.sin(this.t * (move ? 6 : 1.5)) * (move ? 0.08 : 0.04) - k * 0.4;
    this.bodyG.rotation.x = k * 0.12;
    const ph = this.t * (move ? 5 : 0);
    for (const L of this.legs) {
      L.up.rotation.x = -0.5 + Math.sin(ph + L.phase) * 0.25 * (move ? 1 : 0) + k * 0.2;
      L.up.rotation.z = Math.max(0, Math.cos(ph + L.phase)) * 0.2 * (move ? 1 : 0);
      L.knee.rotation.x = 0.4 - k * 0.15;
    }
    for (const c of this.claws) { c.pinB.rotation.x = 0.25 + Math.max(0, Math.sin(this.t * 3)) * 0.3; if (this.state === 'walk') c.sh.rotation.x += (Math.sin(this.t * 2) * 0.1 - c.sh.rotation.x) * Math.min(1, dt * 3); }
  }
}
