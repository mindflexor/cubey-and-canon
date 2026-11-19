import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { RoundedBoxGeometry };
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();

export function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  g.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
  return g;
}

// Box-projected UVs (uses current vertex positions, so call after transforming to world for continuous tiling)
export function projUV(g, scale = 1, swap = false) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = ny > 0 ? -z : z; if (swap) { const t = u; u = v; v = t; } }
    else if (ax >= az) { u = nx > 0 ? -z : z; v = y; }
    else { u = nz > 0 ? x : -x; v = y; }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  return g;
}
export function scaleUV(g, su, sv = su) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

export const box = (w, h, d) => new T.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = 0.04, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const cyl = (rt, rb, h, seg = 16, hs = 1, open = false) => new T.CylinderGeometry(rt, rb, h, seg, hs, open);
export const sph = (r, ws = 16, hs = 12) => new T.SphereGeometry(r, ws, hs);
export const torus = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => new T.TorusGeometry(r, t, rs, ts, arc);
export function lathe(pts, seg = 24) { return new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg); }

// Merge many static geometries per material into a handful of draw calls
export class Batch {
  constructor() { this.map = new Map(); }
  add(g, mat, uvScale = 1, swap = false) {
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (uvScale !== 'keep') projUV(g, uvScale, swap);
    else if (!g.attributes.uv) projUV(g, 1);
    g.clearGroups();
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
    return g;
  }
  box(mat, w, h, d, x, y, z, ry = 0, uv = 1, swap = false) { return this.add(xf(box(w, h, d), x, y, z, 0, ry, 0), mat, uv, swap); }
  rbox(mat, w, h, d, x, y, z, ry = 0, r = 0.05, uv = 1) { return this.add(xf(rbox(w, h, d, r, 2), x, y, z, 0, ry, 0), mat, uv); }
  build(parent, cast = true, receive = true) {
    const meshes = [];
    for (const [mat, list] of this.map) {
      for (let i = 0; i < list.length; i += 120) {
        const merged = mergeGeometries(list.slice(i, i + 120), false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const m = new T.Mesh(merged, mat);
        m.castShadow = cast; m.receiveShadow = receive; m.matrixAutoUpdate = false; m.updateMatrix();
        parent.add(m); meshes.push(m);
      }
      list.forEach(g => g.dispose());
    }
    this.map.clear();
    return meshes;
  }
}

// Merge the leaf meshes under every node (grouped by material) to cut draw calls on rigs/props.
export function compact(root) {
  const nodes = [];
  root.traverse(o => nodes.push(o));
  for (const g of nodes) {
    const leaves = g.children.filter(c => c.isMesh && !c.isInstancedMesh && c.children.length === 0 && !c.userData.keep);
    const byMat = new Map();
    for (const m of leaves) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m); }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map(m => {
        m.updateMatrix();
        let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
        if (!geo.attributes.uv) geo.setAttribute('uv', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        geo.clearGroups();
        return geo.applyMatrix4(m.matrix);
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new T.Mesh(merged, mat);
      mesh.castShadow = list.some(m => m.castShadow); mesh.receiveShadow = true;
      g.add(mesh); list.forEach(m => g.remove(m));
    }
  }
  return root;
}
export function keep(m) { m.userData.keep = true; return m; }

// mesh helper for animated rigs
export function part(parent, g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, uv = null) {
  if (uv) projUV(g, uv);
  const m = new T.Mesh(g, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g;
}

// Cog / gear geometry (extruded with bevel)
const gearCache = new Map();
export function gearGeo(r = 0.2, teeth = 10, th = 0.06, hole = 0.35) {
  const key = r + '/' + teeth + '/' + th + '/' + hole;
  if (gearCache.has(key)) return gearCache.get(key);
  const s = new T.Shape(), ri = r * 0.78;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2, rr = (i % 4 < 2) ? r : ri;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  s.closePath();
  const h = new T.Path(); h.absarc(0, 0, r * hole, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new T.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * 0.3, bevelSize: r * 0.05, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -th / 2); g.computeVertexNormals();
  gearCache.set(key, g);
  return g;
}

// Tube along points (ropes, rails)
export function tube(points, r = 0.03, seg = 32, rs = 6) {
  const curve = new T.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new T.Vector3(...p)));
  return new T.TubeGeometry(curve, seg, r, rs, false);
}
// Rope sagging between two points
export function sagRope(a, b, sag = 0.4, r = 0.025) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, p = new T.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag; pts.push(p);
  }
  return tube(pts, r, 16, 5);
}
