// Particle effects: smoke, sparks, debris chunks, shockwaves, flashes.
import * as T from 'three';
import { TEX, MAT } from './materials.js';

const VS = `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC;
void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize = size * (600.0 / -mv.z); gl_Position=projectionMatrix*mv; }`;
const FS = `uniform sampler2D map; varying float vA; varying vec3 vC;
void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA);
#include <fog_fragment>
}`;

class PointPool {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0;
    this.p = new Float32Array(n * 3); this.c = new Float32Array(n * 3); this.s = new Float32Array(n); this.a = new Float32Array(n);
    this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grow = new Float32Array(n);
    this.s0 = new Float32Array(n); this.drag = new Float32Array(n); this.grav = new Float32Array(n); this.a0 = new Float32Array(n);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.p, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('color', new T.BufferAttribute(this.c, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('size', new T.BufferAttribute(this.s, 1).setUsage(T.DynamicDrawUsage));
    g.setAttribute('alpha', new T.BufferAttribute(this.a, 1).setUsage(T.DynamicDrawUsage));
    const m = new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { map: { value: TEX.soft } }]),
      vertexShader: VS.replace('void main(){', '#include <fog_pars_vertex>\nvoid main(){').replace('gl_Position=projectionMatrix*mv; }', 'gl_Position=projectionMatrix*mv;\nvec4 mvPosition=mv;\n#include <fog_vertex>\n}'),
      fragmentShader: '#include <fog_pars_fragment>\n' + FS,
      transparent: true, depthWrite: false, fog: true,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
    });
    m.uniforms.map.value = TEX.soft;
    this.points = new T.Points(g, m); this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, size, life, r, g, b, o = {}) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
    this.s[i] = this.s0[i] = size; this.life[i] = this.max[i] = life; this.grow[i] = o.grow ?? 1;
    this.drag[i] = o.drag ?? 1; this.grav[i] = o.grav ?? 0; this.a[i] = this.a0[i] = o.alpha ?? 1;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.a[i]) this.a[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.max[i], k = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt; this.v[i * 3 + 2] *= k;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.s[i] = this.s0[i] * (1 + (this.grow[i] - 1) * t);
      this.a[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9) * (this.life[i] > 0 ? 1 : 0);
    }
    const at = this.points.geometry.attributes;
    at.position.needsUpdate = at.color.needsUpdate = at.size.needsUpdate = at.alpha.needsUpdate = true;
  }
}

class Debris {
  constructor(scene, n) {
    this.n = n; this.i = 0;
    const g = new T.BoxGeometry(1, 1, 1);
    this.mesh = new T.InstancedMesh(g, new T.MeshStandardMaterial({ map: TEX.concrete.map, roughness: 0.85 }), n);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.items = Array.from({ length: n }, () => ({ p: new T.Vector3(), v: new T.Vector3(), r: new T.Euler(), w: new T.Vector3(), s: new T.Vector3(), life: 0, floor: 0 }));
    const c = new T.Color(1, 1, 1); for (let i = 0; i < n; i++) this.mesh.setColorAt(i, c);
    this.m = new T.Matrix4(); this.q = new T.Quaternion();
    scene.add(this.mesh);
  }
  emit(p, v, size, color, floor, life = 2.2) {
    const it = this.items[this.i]; this.mesh.setColorAt(this.i, color); this.i = (this.i + 1) % this.n;
    it.p.copy(p); it.v.copy(v); it.r.set(Math.random() * 6, Math.random() * 6, 0);
    it.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
    it.s.set(size * (0.6 + Math.random() * 0.8), size * (0.4 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8));
    it.life = life + Math.random() * 0.6; it.floor = floor;
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      if (it.life <= 0) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); continue; }
      it.life -= dt;
      it.v.y -= 26 * dt; it.p.addScaledVector(it.v, dt);
      if (it.p.y < it.floor + it.s.y / 2) { it.p.y = it.floor + it.s.y / 2; it.v.y *= -0.35; it.v.x *= 0.6; it.v.z *= 0.6; it.w.multiplyScalar(0.6); }
      it.r.x += it.w.x * dt; it.r.y += it.w.y * dt; it.r.z += it.w.z * dt;
      const sc = Math.min(1, it.life / 0.4);
      this.q.setFromEuler(it.r);
      this.m.compose(it.p, this.q, new T.Vector3(it.s.x * sc, it.s.y * sc, it.s.z * sc));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.smoke = new PointPool(scene, 700, false);
    this.glow = new PointPool(scene, 900, true);
    this.debris = new Debris(scene, 260);
    this.rings = [];
    const rg = new T.RingGeometry(0.8, 1, 48); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(rg, new T.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
      m.visible = false; scene.add(m); this.rings.push({ m, t: 0, max: 1, size: 1 });
    }
    this.lights = [];
    for (let i = 0; i < 2; i++) { const l = new T.PointLight(0xffa040, 0, 14, 2); scene.add(l); this.lights.push({ l, t: 0, i0: 0 }); }
    this.li = 0; this.ri = 0;
    this.tmp = new T.Vector3(); this.col = new T.Color();
  }
  flash(p, intensity = 30, dur = 0.12, color = 0xffa040) {
    const L = this.lights[this.li]; this.li = (this.li + 1) % this.lights.length;
    L.l.position.copy(p); L.l.color.set(color); L.i0 = intensity; L.t = L.max = dur; L.l.intensity = intensity;
  }
  ring(p, size = 4, dur = 0.45, color = 0xfff0d0) {
    const R = this.rings[this.ri]; this.ri = (this.ri + 1) % this.rings.length;
    R.m.position.copy(p); R.m.position.y += 0.08; R.t = R.max = dur; R.size = size; R.m.visible = true; R.m.material.color.set(color);
  }
  puff(p, n = 6, spread = 0.5, size = 1.2, col = [0.85, 0.82, 0.78], up = 1, life = 1.2) {
    for (let i = 0; i < n; i++) {
      this.smoke.emit(p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 2, up * (0.5 + Math.random()), (Math.random() - 0.5) * 2, size * (0.7 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.6),
        col[0], col[1], col[2], { grow: 2.4, drag: 2.2, alpha: 0.75 });
    }
  }
  sparks(p, n = 12, speed = 7, col = [1, 0.6, 0.2], size = 0.18, grav = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.2, s = speed * (0.4 + Math.random() * 0.8);
      this.glow.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, size, 0.4 + Math.random() * 0.5, col[0], col[1], col[2], { drag: 1.5, grav, grow: 0.3 });
    }
  }
  explosion(p, scale = 1, floor = p.y - 0.5) {
    this.flash(p, 60 * scale, 0.18);
    this.ring(new T.Vector3(p.x, floor, p.z), 3.2 * scale, 0.4);
    for (let i = 0; i < 14 * scale; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 5;
      this.glow.emit(p.x, p.y, p.z, Math.cos(a) * s, Math.random() * 5, Math.sin(a) * s, 1.4 * scale, 0.25 + Math.random() * 0.2, 1, 0.55, 0.18, { drag: 5, grow: 1.8 });
    }
    this.puff(p, 10 * scale, 0.8 * scale, 1.8 * scale, [0.36, 0.33, 0.31], 1.8, 1.6);
    this.sparks(p, 16 * scale, 9 * scale);
  }
  chunks(p, n, size, color, floor, speed = 5) {
    const c = this.col.set(color);
    for (let i = 0; i < n; i++) {
      this.tmp.set((Math.random() - 0.5) * speed * 1.6, 2 + Math.random() * speed, (Math.random() - 0.5) * speed * 1.6);
      this.debris.emit(new T.Vector3(p.x + (Math.random() - 0.5) * 0.4, p.y + Math.random() * 0.4, p.z + (Math.random() - 0.5) * 0.4), this.tmp, size, c, floor);
    }
  }
  splash(p) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
      this.smoke.emit(p.x, p.y, p.z, Math.cos(a) * s, 4 + Math.random() * 6, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 0.9, 0.9, 0.97, 1, { grav: 14, drag: 0.5, grow: 1.5, alpha: 0.9 });
    }
    this.ring(p, 3, 0.8, 0xffffff);
  }
  update(dt) {
    this.smoke.update(dt); this.glow.update(dt); this.debris.update(dt);
    for (const R of this.rings) {
      if (!R.m.visible) continue;
      R.t -= dt; const k = 1 - R.t / R.max;
      R.m.scale.setScalar(0.2 + k * R.size); R.m.material.opacity = (1 - k) * 0.8;
      if (R.t <= 0) R.m.visible = false;
    }
    for (const L of this.lights) { if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, L.i0 * L.t / L.max); } else L.l.intensity = 0; }
  }
}
void MAT;
