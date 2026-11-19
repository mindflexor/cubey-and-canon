// Instanced, wind-swayed foliage: grass clumps, ferns, flowers and bushes.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm } from './textures.js';

const U = { uTime: { value: 0 } };
export const foliageUniforms = U;

function canvasTex(N, draw) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); draw(g, N);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
function grassTex() {
  return canvasTex(256, (g, N) => {
    let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = 10 + r() * (N - 20), h = N * (0.45 + r() * 0.55), w = 4 + r() * 6, lean = (r() - 0.5) * 60;
      const grd = g.createLinearGradient(0, N, 0, N - h);
      const l = 30 + r() * 20;
      grd.addColorStop(0, `hsl(${95 + r() * 15},55%,${l * 0.45}%)`); grd.addColorStop(0.6, `hsl(${85 + r() * 15},55%,${l}%)`); grd.addColorStop(1, `hsl(${70 + r() * 15},65%,${l + 18}%)`);
      g.fillStyle = grd; g.beginPath(); g.moveTo(x - w, N);
      g.quadraticCurveTo(x - w * 0.3 + lean * 0.3, N - h * 0.5, x + lean, N - h);
      g.quadraticCurveTo(x + w * 0.3 + lean * 0.3, N - h * 0.5, x + w, N); g.fill();
    }
  });
}
function flowerTex() {
  return canvasTex(128, (g, N) => {
    g.strokeStyle = '#3d7a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(N / 2, N); g.quadraticCurveTo(N / 2 - 8, N * 0.7, N / 2, N * 0.38); g.stroke();
    g.fillStyle = '#4f9a36'; g.beginPath(); g.ellipse(N / 2 - 14, N * 0.72, 14, 6, -0.5, 0, 7); g.fill();
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.ellipse(N / 2 + Math.cos(a) * 15, N * 0.3 + Math.sin(a) * 15, 13, 8, a, 0, 7); g.fill(); }
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(N / 2, N * 0.3, 9, 0, 7); g.fill();
  });
}
function leafTex() {
  return canvasTex(128, (g, N) => {
    const grd = g.createLinearGradient(0, 0, N, 0); grd.addColorStop(0, '#2f6a28'); grd.addColorStop(0.5, '#5aa83c'); grd.addColorStop(1, '#2f6a28');
    g.fillStyle = grd; g.beginPath(); g.moveTo(N / 2, 0);
    for (let i = 0; i <= 10; i++) { const y = i / 10 * N, w = Math.sin(i / 10 * Math.PI) * N * 0.45; g.lineTo(N / 2 + w + (i % 2 ? 6 : -2), y); }
    for (let i = 10; i >= 0; i--) { const y = i / 10 * N, w = Math.sin(i / 10 * Math.PI) * N * 0.45; g.lineTo(N / 2 - w - (i % 2 ? 6 : -2), y); }
    g.fill(); g.strokeStyle = 'rgba(200,240,150,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(N / 2, 0); g.lineTo(N / 2, N); g.stroke();
  });
}

function windMat(map, o = {}) {
  const m = new T.MeshStandardMaterial({ map, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.85, color: o.color ?? 0xffffff });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 ip = instanceMatrix[3]; float h = max(0., position.y) * ${(o.amp ?? 0.22).toFixed(2)};
          float w = sin(uTime * 1.9 + ip.x * 0.35 + ip.z * 0.27) + sin(uTime * 3.3 + ip.x * 0.9) * 0.35;
          transformed.x += w * h; transformed.z += cos(uTime * 1.5 + ip.z * 0.4) * h * 0.6; }`);
    if (o.upNormal) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
  };
  return m;
}

function crossQuads(w, h, n = 3, bend = 0.12) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const g = new T.PlaneGeometry(w, h, 1, 3); g.translate(0, h / 2, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) / h; p.setZ(k, y * y * bend * h * 3); }
    g.rotateY(i / n * Math.PI); list.push(g);
  }
  const m = mergeGeometries(list); m.computeVertexNormals(); return m;
}
function fernGeo() {
  const list = [];
  for (let i = 0; i < 7; i++) {
    const len = 0.7 + (i % 3) * 0.15, g = new T.PlaneGeometry(0.28, len, 1, 5);
    g.translate(0, len / 2, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) / len; p.setZ(k, y * y * 0.45); p.setY(k, p.getY(k) * (1 - y * 0.25)); }
    g.rotateX(-0.75); g.rotateY(i / 7 * Math.PI * 2);
    list.push(g);
  }
  const m = mergeGeometries(list); m.computeVertexNormals(); return m;
}
function bushGeo() {
  const g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const n = fbm(v.x * 0.3 + 0.5, v.z * 0.3 + v.y * 0.2 + 0.5, 4, 3, 77);
    v.multiplyScalar(0.8 + n * 0.45); if (v.y < -0.3) v.y = -0.3; p.setXYZ(i, v.x, v.y + 0.3, v.z);
  }
  g.computeVertexNormals(); return g;
}

export class Foliage {
  constructor(scene, world, leafMat) {
    this.world = world; this.scene = scene;
    const mk = (geo, mat, cap, shadow = false) => { const m = new T.InstancedMesh(geo, mat, cap); m.count = 0; m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; };
    this.grass = mk(crossQuads(0.9, 0.55, 3, 0.1), windMat(grassTex(), { upNormal: true, amp: 0.25 }), 14000);
    this.tall = mk(crossQuads(1.0, 1.1, 3, 0.15), windMat(grassTex(), { upNormal: true, amp: 0.3 }), 3000);
    this.flower = mk(crossQuads(0.32, 0.42, 2, 0.05), windMat(flowerTex(), { amp: 0.25 }), 3500);
    this.fern = mk(fernGeo(), windMat(leafTex(), { amp: 0.12 }), 1600, true);
    const bm = leafMat.clone(); bm.side = T.FrontSide;
    this.bush = mk(bushGeo(), bm, 900, true);
    this.m = new T.Matrix4(); this.q = new T.Quaternion(); this.c = new T.Color(); this.e = new T.Euler();
    let s = 99; this.r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }
  put(mesh, x, y, z, s, color) {
    if (mesh.count >= mesh.instanceMatrix.count) return;
    this.q.setFromEuler(this.e.set(0, this.r() * 6.28, 0));
    this.m.compose(new T.Vector3(x, y, z), this.q, new T.Vector3(s, s * (0.8 + this.r() * 0.4), s));
    mesh.setMatrixAt(mesh.count, this.m); if (color) mesh.setColorAt(mesh.count, color); mesh.count++;
  }
  ground(x, z, top) { const g = this.world.groundAt(x, z, 0.02, top ?? 60); return g.solid ? g.y : null; }
  // fill an area (e.g. a grass-topped bank)
  field(x0, x1, z0, z1, dens = 3, o = {}) {
    const r = this.r, n = Math.floor((x1 - x0) * (z1 - z0) * dens);
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), y = o.y ?? this.ground(x, z, (o.top ?? 59) + 0.05);
      if (y == null || (o.top != null && Math.abs(y - o.top) > 0.1)) continue;
      const patch = fbm(x * 0.02 + 10, z * 0.02 + 10, 4, 3, 5);
      if (patch < (o.patchy ?? 0.3)) continue;
      const k = r();
      this.c.setHSL(0.24 + r() * 0.06, 0.45, 0.42 + r() * 0.2);
      if (k < 0.78) this.put(this.grass, x, y, z, 0.8 + r() * 0.7, this.c);
      else if (k < 0.88) this.put(this.tall, x, y, z, 0.7 + r() * 0.6, this.c);
      else if (k < 0.96) this.put(this.flower, x, y, z, 0.8 + r() * 0.6, this.c.setHSL([0, 0.12, 0.9, 0.8, 0.15][Math.floor(r() * 5)], 0.85, 0.65));
      else this.put(this.fern, x, y, z, 0.8 + r() * 0.6, this.c.setHSL(0.27, 0.5, 0.5 + r() * 0.2));
    }
  }
  // tufts sprouting along a wall base / paving edge
  edge(ax, az, bx, bz, y, dens = 2.5, spread = 0.5) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len * dens), r = this.r;
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let i = 0; i < n; i++) {
      const t = r(), off = (r() - 0.5) * spread;
      const x = ax + (bx - ax) * t + nx * off, z = az + (bz - az) * t + nz * off;
      const k = r(); this.c.setHSL(0.24 + r() * 0.06, 0.45, 0.4 + r() * 0.2);
      if (k < 0.7) this.put(this.grass, x, y, z, 0.6 + r() * 0.6, this.c);
      else if (k < 0.85) this.put(this.fern, x, y, z, 0.5 + r() * 0.5, this.c);
      else this.put(this.flower, x, y, z, 0.7 + r() * 0.5, this.c.setHSL([0, 0.12, 0.9, 0.8, 0.15][Math.floor(r() * 5)], 0.85, 0.65));
    }
  }
  bushes(list) { for (const [x, y, z, s] of list) { this.c.setHSL(0.26 + this.r() * 0.05, 0.5, 0.42 + this.r() * 0.15); this.put(this.bush, x, y, z, s, this.c); } }
  planter(x, y, z, r = 0.8) {
    this.bushes([[x, y, z, r * 0.8]]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; this.c.setHSL([0, 0.12, 0.9, 0.8][i % 4], 0.85, 0.65); this.put(this.flower, x + Math.cos(a) * r * 0.75, y, z + Math.sin(a) * r * 0.75, 0.9, this.c); }
  }
  finish() { for (const m of [this.grass, this.tall, this.flower, this.fern, this.bush]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); } }
}
