// Environment kit: architecture and set dressing, merged into static batches.
import * as T from 'three';
import { MAT } from './materials.js';
import { box, rbox, cyl, sph, torus, lathe, xf, sagRope, gearGeo, Batch } from './geo.js';
import { fbm } from './textures.js';

export let rand = mulberry(1234);
export function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function reseed(s) { rand = mulberry(s); }
const pick = arr => arr[Math.floor(rand() * arr.length)];

export function prism(len, hw, h) {
  let g = cyl(1, 1, len, 3);
  g = g.toNonIndexed(); xf(g, 0, 0, 0, -Math.PI / 2, 0, 0);
  g.scale(hw / 0.866, h / 1.5, 1); g.translate(0, h / 3, 0);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------ ground masses
export function quay(K, x0, x1, z0, z1, top, o = {}) {
  const { B, W } = K, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, bottom = o.bottom ?? -3;
  B.box(o.topMat || MAT.flagstone, w, 0.3, d, cx, top - 0.15, cz, 0, o.topScale || 3);
  B.box(o.wallMat || MAT.brick, w - 0.1, top - 0.3 - bottom, d - 0.1, cx, (top - 0.3 + bottom) / 2, cz, 0, 3);
  // coping stones along the edges
  if (o.coping !== false) {
    const edges = o.edges || 'nsew';
    const cope = (len, x, z, ry) => { for (let s = 0; s < len - 0.01; s += 1.5) { const l = Math.min(1.5, len - s) - 0.04; B.add(xf(rbox(l, 0.22, 0.55, 0.05), x + (ry ? 0 : -len / 2 + s + l / 2 + 0.02), top - 0.1, z + (ry ? -len / 2 + s + l / 2 + 0.02 : 0), 0, ry ? Math.PI / 2 : 0, 0), MAT.flagstone, 1.5); } };
    if (edges.includes('n')) cope(w, cx, z0 + 0.22, false);
    if (edges.includes('s')) cope(w, cx, z1 - 0.22, false);
    if (edges.includes('w')) cope(d, x0 + 0.22, cz, true);
    if (edges.includes('e')) cope(d, x1 - 0.22, cz, true);
  }
  // waterline grime band + seaweed-dark lower stones
  if (bottom < 0.5) B.box(MAT.brickDark, w + 0.02, 1.0, d + 0.02, cx, 0.1, cz, 0, 3);
  return W.add([x0, bottom, z0], [x1, top, z1]);
}

export function deck(K, x0, x1, z0, z1, top, o = {}) {
  const { B, W } = K, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.box(MAT.planks, w, 0.22, d, cx, top - 0.11, cz, 0, 2.5, o.along === 'x');
  // edge beams
  B.box(MAT.woodDark, 0.25, 0.35, d, x0 + 0.12, top - 0.38, cz, 0, 2);
  B.box(MAT.woodDark, 0.25, 0.35, d, x1 - 0.12, top - 0.38, cz, 0, 2);
  B.box(MAT.woodDark, w, 0.35, 0.25, cx, top - 0.38, z0 + 0.12, 0, 2);
  B.box(MAT.woodDark, w, 0.35, 0.25, cx, top - 0.38, z1 - 0.12, 0, 2);
  if (o.posts !== false) {
    const bottom = o.postBottom ?? -2;
    for (let x = x0 + 0.3; x <= x1 - 0.2; x += Math.max(1, (w - 0.6) / Math.max(1, Math.round((w - 0.6) / 3)))) {
      for (let z = z0 + 0.3; z <= z1 - 0.2; z += Math.max(1, (d - 0.6) / Math.max(1, Math.round((d - 0.6) / 3)))) {
        if (x > x0 + 0.5 && x < x1 - 0.5 && z > z0 + 0.5 && z < z1 - 0.5) continue;
        B.add(xf(cyl(0.2, 0.22, top - bottom, 10), x, (top + bottom) / 2 - 0.2, z), MAT.woodDark, 'keep');
        B.add(xf(cyl(0.23, 0.23, 0.1, 10), x, 0.6, z), MAT.ironDark, 1);
      }
    }
  }
  return W.add([x0, top - 0.6, z0], [x1, top, z1], { surface: 'wood' });
}

export function stairs(K, x0, x1, z0, z1, y0, y1, dir, mat = MAT.flagstone) {
  // dir: '+z','-z','+x','-x' = direction of ascent
  const { B, W } = K, n = Math.max(1, Math.ceil((y1 - y0) / 0.3)), dh = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, top = y0 + dh * (i + 1);
    let a, b;
    if (dir === '-z') { a = [x0, y0 - 1, z1 - (z1 - z0) * t1]; b = [x1, top, z1 - (z1 - z0) * t0]; }
    else if (dir === '+z') { a = [x0, y0 - 1, z0 + (z1 - z0) * t0]; b = [x1, top, z0 + (z1 - z0) * t1]; }
    else if (dir === '-x') { a = [x1 - (x1 - x0) * t1, y0 - 1, z0]; b = [x1 - (x1 - x0) * t0, top, z1]; }
    else { a = [x0 + (x1 - x0) * t0, y0 - 1, z0]; b = [x0 + (x1 - x0) * t1, top, z1]; }
    if (dir === '-z') b[2] = z1; if (dir === '+z') a[2] = z0; if (dir === '-x') b[0] = x1; if (dir === '+x') a[0] = x0;
    B.add(xf(rbox(b[0] - a[0], b[1] - a[1], b[2] - a[2], 0.04), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), mat, 2);
    W.add(a, b);
  }
}

export function railing(K, pts, h = 1.0, collide = true) {
  const { B, W } = K;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new T.Vector3(...pts[i]), b = new T.Vector3(...pts[i + 1]), len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / 2));
    for (let k = 0; k <= n; k++) {
      if (k === n && i < pts.length - 2) continue;
      const p = new T.Vector3().lerpVectors(a, b, k / n);
      B.add(xf(cyl(0.07, 0.09, h, 8), p.x, p.y + h / 2, p.z), MAT.woodDark, 'keep');
      B.add(xf(sph(0.1, 8, 6), p.x, p.y + h + 0.04, p.z), MAT.brass, 1);
    }
    for (let k = 0; k < n; k++) {
      const p0 = new T.Vector3().lerpVectors(a, b, k / n), p1 = new T.Vector3().lerpVectors(a, b, (k + 1) / n);
      p0.y += h * 0.85; p1.y += h * 0.85;
      B.add(sagRope(p0, p1, 0.18, 0.035), MAT.rope, 'keep');
      p0.y -= h * 0.4; p1.y -= h * 0.4;
      B.add(sagRope(p0, p1, 0.12, 0.03), MAT.rope, 'keep');
    }
    if (collide) {
      const mn = [Math.min(a.x, b.x) - 0.12, a.y, Math.min(a.z, b.z) - 0.12], mx = [Math.max(a.x, b.x) + 0.12, a.y + h + 0.2, Math.max(a.z, b.z) + 0.12];
      W.add(mn, mx, { cam: false, blocksShots: false, walkable: false });
    }
  }
}

// ------------------------------------------------------------ buildings
const WALLS = () => [MAT.plaster, MAT.plasterBlue, MAT.plasterPeach, MAT.plasterMint, MAT.plasterYellow];
export function house(K, x, z, w, d, floors, ry = 0, o = {}) {
  const { B, W } = K, g = o.ground ?? 2.2, fh = 3, h = floors * fh + 0.6, wall = o.wall || pick(WALLS()), roofMat = o.roof || (rand() < 0.8 ? MAT.roof : MAT.roofBlue);
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, g + ly, z - lx * s + lz * c];
  const add = (geo, mat, lx, ly, lz, rx = 0, rry = 0, rz = 0, uv = 1.5, swap = false) => { const p = P(lx, ly, lz); B.add(xf(geo, p[0], p[1], p[2], rx, ry + rry, rz), mat, uv, swap); };
  add(box(w + 0.16, 1.0, d + 0.16), MAT.brick, 0, 0.5, 0, 0, 0, 0, 3);
  add(box(w, h - 1, d), wall, 0, 0.5 + h / 2, 0, 0, 0, 0, 3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(0.24, h - 1, 0.24), MAT.woodDark, sx * w / 2, 0.5 + h / 2, sz * d / 2, 0, 0, 0, 1);
  for (let f = 1; f < floors; f++) {
    add(box(w + 0.1, 0.2, 0.14), MAT.woodDark, 0, f * fh + 0.6, d / 2); add(box(w + 0.1, 0.2, 0.14), MAT.woodDark, 0, f * fh + 0.6, -d / 2);
    add(box(0.14, 0.2, d + 0.1), MAT.woodDark, w / 2, f * fh + 0.6, 0); add(box(0.14, 0.2, d + 0.1), MAT.woodDark, -w / 2, f * fh + 0.6, 0);
  }
  const shutter = pick([MAT.paintTeal, MAT.paintRed, MAT.woodHull, MAT.paintYellow]);
  const facade = (len, depth, rotY, doorOk) => {
    const n = Math.max(1, Math.floor((len - 0.6) / 2.3));
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
      const lx = -len / 2 + (i + 0.5) * len / n, ly = f * fh + 2.0;
      const door = doorOk && f === 0 && i === Math.floor(n / 2);
      const cR = Math.cos(rotY), sR = Math.sin(rotY);
      const L = (ax, ay, az) => [ax * cR + az * sR, ay, -ax * sR + az * cR];
      const put = (geo, mat, ax, ay, az, uv = 1) => { const q = L(ax, ay, az); add(geo, mat, q[0], q[1], q[2], 0, rotY, 0, uv); };
      if (door) {
        put(box(1.3, 2.4, 0.16), MAT.woodDark, lx, 1.2 + 0.0, depth + 0.04);
        put(box(1.05, 2.2, 0.1), MAT.woodHull, lx, 1.1, depth + 0.1, 1.2);
        put(sph(0.06, 8, 6), MAT.brass, lx + 0.35, 1.1, depth + 0.17);
        put(box(1.6, 0.18, 0.7), MAT.flagstone, lx, 0.09, depth + 0.35, 1.5);
        put(box(0.5, 0.35, 0.3), MAT.iron, lx, 2.65, depth + 0.18);
        put(box(0.36, 0.2, 0.2), MAT.lamp, lx, 2.65, depth + 0.3);
        continue;
      }
      if (f === 0 && ly < 1.6) continue;
      const lit = rand() < 0.35;
      put(box(1.0, 1.35, 0.14), MAT.woodDark, lx, ly, depth + 0.03);
      put(box(0.8, 1.15, 0.06), lit ? MAT.window : MAT.windowDark, lx, ly, depth + 0.07);
      put(box(0.06, 1.15, 0.05), MAT.woodDark, lx, ly, depth + 0.11); put(box(0.8, 0.06, 0.05), MAT.woodDark, lx, ly + 0.1, depth + 0.11);
      put(box(1.2, 0.12, 0.3), MAT.flagstone, lx, ly - 0.72, depth + 0.12, 1);
      if (rand() < 0.75) { put(box(0.48, 1.3, 0.06), shutter, lx - 0.78, ly, depth + 0.08); put(box(0.48, 1.3, 0.06), shutter, lx + 0.78, ly, depth + 0.08); }
      if (rand() < 0.4) {
        put(box(0.95, 0.28, 0.32), MAT.woodHull, lx, ly - 0.52, depth + 0.3);
        for (let k = 0; k < 4; k++) put(sph(0.16 + rand() * 0.06, 8, 6), rand() < 0.5 ? MAT.leaf : MAT.leafDark, lx - 0.33 + k * 0.22, ly - 0.32, depth + 0.32);
      }
    }
  };
  facade(w, d / 2, 0, o.door !== false);
  facade(w, d / 2, Math.PI, false);
  facade(d, w / 2, Math.PI / 2, false);
  facade(d, w / 2, -Math.PI / 2, false);
  // gable roof (ridge along local x)
  const rh = Math.min(3, d * 0.42), ang = Math.atan2(rh, d / 2), slope = Math.hypot(d / 2 + 0.5, rh + 0.35);
  for (const sz of [-1, 1]) {
    const geo = box(w + 0.8, 0.2, slope);
    add(geo, roofMat, 0, h + 0.5 + rh / 2 - 0.1, sz * (d / 4 + 0.12), sz * ang, 0, 0, 2.5, Math.abs(Math.sin(ry)) > 0.7);
  }
  add(prism(w - 0.02, d / 2, rh), wall, 0, h + 0.5, 0, 0, Math.PI / 2, 0, 3);
  add(cyl(0.16, 0.16, w + 0.9, 8), MAT.roof, 0, h + 0.5 + rh + 0.05, 0, 0, 0, Math.PI / 2, 'keep');
  if (o.chimney !== false) {
    const cxl = (rand() - 0.5) * w * 0.6;
    add(box(0.8, 2.2, 0.8), MAT.brick, cxl, h + 0.5 + rh * 0.6 + 0.6, -d * 0.18, 0, 0, 0, 2);
    add(box(1.0, 0.18, 1.0), MAT.flagstone, cxl, h + 0.5 + rh * 0.6 + 1.75, -d * 0.18, 0, 0, 0, 1);
    K.chimneys?.push(new T.Vector3(...P(cxl, h + 0.5 + rh * 0.6 + 2, -d * 0.18)));
  }
  const ext = Math.abs(c) > 0.7 ? [w / 2, d / 2] : [d / 2, w / 2];
  if (o.collide !== false) W.add([x - ext[0], g - 1, z - ext[1]], [x + ext[0], g + h + 0.5 + rh, z + ext[1]]);
  return h + 0.5 + rh + g;
}

export function tower(K, x, z, r, h, o = {}) {
  const { B, W } = K, g = o.ground ?? 2.2;
  B.add(xf(cyl(r, r * 1.08, h, 20), x, g + h / 2, z), MAT.brick, 3);
  B.add(xf(cyl(r + 0.25, r + 0.25, 0.5, 20), x, g + h + 0.25, z), MAT.flagstone, 1.5);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; B.add(xf(box(0.6, 0.7, 0.5), x + Math.cos(a) * (r + 0.05), g + h + 0.85, z + Math.sin(a) * (r + 0.05), 0, -a, 0), MAT.brick, 1.5); }
  if (o.roof !== false) {
    B.add(xf(cyl(0.02, r + 0.6, r * 1.6, 20), x, g + h + 0.6 + r * 0.8, z), MAT.roofBlue, 'keep');
    B.add(xf(sph(0.2, 8, 6), x, g + h + 0.7 + r * 1.6, z), MAT.brass, 1);
    K.flags?.push({ x, y: g + h + 0.7 + r * 1.6, z });
  }
  if (o.collide !== false) W.add([x - r, g - 1, z - r], [x + r, g + h + 1, z + r]);
}

export function wallSegment(K, x0, x1, z0, z1, top, g = 2.2, battlements = true) {
  const { B, W } = K, w = x1 - x0, d = z1 - z0;
  B.box(MAT.brick, w, top - g + 1, d, (x0 + x1) / 2, (top + g - 1) / 2, (z0 + z1) / 2, 0, 3);
  B.box(MAT.flagstone, w + 0.3, 0.3, d + 0.3, (x0 + x1) / 2, top + 0.15, (z0 + z1) / 2, 0, 2);
  if (battlements) {
    const along = w > d, len = along ? w : d;
    for (let s = 0.5; s < len - 0.4; s += 1.6) {
      for (const side of [-1, 1]) {
        const px = along ? x0 + s + 0.4 : (side < 0 ? x0 + 0.25 : x1 - 0.25), pz = along ? (side < 0 ? z0 + 0.25 : z1 - 0.25) : z0 + s + 0.4;
        B.add(xf(rbox(along ? 0.8 : 0.5, 0.7, along ? 0.5 : 0.8, 0.04), px, top + 0.65, pz), MAT.brick, 1.5);
      }
    }
  }
  W.add([x0, g - 1, z0], [x1, top + 1, z1]);
}

// ------------------------------------------------------------ props
export function lamp(K, x, y, z, ry = 0) {
  const { B } = K;
  B.add(xf(cyl(0.18, 0.24, 0.4, 10), x, y + 0.2, z), MAT.ironDark, 1);
  B.add(xf(cyl(0.06, 0.08, 3.2, 8), x, y + 1.8, z), MAT.ironDark, 1);
  for (let i = 0; i < 3; i++) B.add(xf(torus(0.08, 0.02, 6, 12), x, y + 0.6 + i * 1.1, z, Math.PI / 2), MAT.brass, 1);
  const ax = Math.sin(ry) * 0.45, az = Math.cos(ry) * 0.45;
  B.add(xf(box(0.06, 0.06, 0.9), x + ax / 2, y + 3.35, z + az / 2, 0, ry, 0), MAT.ironDark, 1);
  const lx = x + ax, lz = z + az;
  B.add(xf(cyl(0.16, 0.22, 0.12, 6), lx, y + 3.3, lz), MAT.ironDark, 1);
  B.add(xf(cyl(0.17, 0.13, 0.42, 6), lx, y + 3.02, lz), MAT.lamp, 1);
  B.add(xf(cyl(0.05, 0.2, 0.1, 6), lx, y + 2.78, lz), MAT.ironDark, 1);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.add(xf(box(0.025, 0.42, 0.025), lx + Math.cos(a) * 0.17, y + 3.02, lz + Math.sin(a) * 0.17), MAT.ironDark, 1); }
  B.add(xf(sph(0.06, 6, 4), lx, y + 3.42, lz), MAT.brass, 1);
  K.W.add([x - 0.2, y, z - 0.2], [x + 0.2, y + 3.4, z + 0.2], { walkable: false, cam: false });
}

export function barrel(K, x, y, z, s = 1, mat = MAT.wood, collide = true) {
  const { B } = K, h = 1.0 * s, r = 0.38 * s;
  B.add(xf(lathe([[0, 0], [r * 0.85, 0], [r, h * 0.25], [r * 1.05, h * 0.5], [r, h * 0.75], [r * 0.85, h], [0, h]], 16), x, y, z, 0, rand() * 6, 0), mat, 0.8);
  for (const t of [0.12, 0.35, 0.65, 0.88]) {
    const rr = r * (t < 0.5 ? 0.85 + t * 0.6 : 0.85 + (1 - t) * 0.6) + 0.012;
    B.add(xf(torus(rr, 0.022 * s, 4, 18), x, y + h * t, z, Math.PI / 2), MAT.ironDark, 1);
  }
  if (collide) K.W.add([x - r, y, z - r], [x + r, y + h, z + r]);
}

export function decorCrate(K, x, y, z, s = 1, ry = 0, collide = true) {
  const { B } = K;
  B.add(xf(rbox(s, s, s, 0.04 * s), x, y + s / 2, z, 0, ry, 0), MAT.wood, s * 0.9);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const c = Math.cos(ry + a), sn = Math.sin(ry + a);
    B.add(xf(box(s * 0.96, 0.1 * s, 0.05 * s), x + sn * s * 0.5, y + s * 0.08, z + c * s * 0.5, 0, ry + a, 0), MAT.woodDark, 1);
    B.add(xf(box(s * 0.96, 0.1 * s, 0.05 * s), x + sn * s * 0.5, y + s * 0.92, z + c * s * 0.5, 0, ry + a, 0), MAT.woodDark, 1);
    B.add(xf(box(s * 1.2, 0.09 * s, 0.05 * s), x + sn * s * 0.5, y + s * 0.5, z + c * s * 0.5, 0, ry + a, Math.PI / 4), MAT.woodDark, 1);
  }
  if (collide) { const e = s * 0.55; K.W.add([x - e, y, z - e], [x + e, y + s, z + e]); }
}

export function bollard(K, x, y, z) {
  const { B } = K;
  B.add(xf(lathe([[0, 0], [0.22, 0], [0.2, 0.3], [0.15, 0.45], [0.24, 0.55], [0.24, 0.62], [0, 0.65]], 14), x, y, z), MAT.iron, 1);
  for (let i = 0; i < 3; i++) B.add(xf(torus(0.24 + i * 0.01, 0.04, 6, 16), x, y + 0.1 + i * 0.08, z, Math.PI / 2, 0, i * 0.3), MAT.rope, 'keep');
  K.W.add([x - 0.25, y, z - 0.25], [x + 0.25, y + 0.65, z + 0.25]);
}
export function ropeCoil(K, x, y, z) {
  for (let i = 0; i < 4; i++) K.B.add(xf(torus(0.32 - i * 0.03, 0.05, 6, 18), x, y + 0.05 + i * 0.09, z, Math.PI / 2), MAT.rope, 'keep');
}

export function stall(K, x, y, z, ry = 0) {
  const { B } = K, c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lx, lz] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) { const p = P(lx, lz); B.add(xf(cyl(0.07, 0.07, 2.6, 8), p[0], y + 1.3, p[1]), MAT.woodDark, 'keep'); }
  let p = P(0, 0.4); B.add(xf(box(3, 1.0, 1.0), p[0], y + 0.5, p[1], 0, ry, 0), MAT.woodHull, 1.5);
  p = P(0, 0.4); B.add(xf(box(3.1, 0.08, 1.15), p[0], y + 1.04, p[1], 0, ry, 0), MAT.wood, 1.5);
  for (let i = 0; i < 6; i++) {
    const lx = -1.5 + 0.25 + i * 0.5; p = P(lx, 0);
    B.add(xf(box(0.5, 0.06, 2.4), p[0], y + 2.75, p[1], 0.32, ry, 0), i % 2 ? MAT.canvas : MAT.canvasRed, 1);
    p = P(lx, 1.15); B.add(xf(box(0.5, 0.3, 0.04), p[0], y + 2.45, p[1], 0, ry, 0), i % 2 ? MAT.canvas : MAT.canvasRed, 1);
  }
  // wares: fruit / fish / pots
  for (let i = 0; i < 7; i++) { p = P(-1.2 + i * 0.4, 0.35); B.add(xf(sph(0.11, 8, 6), p[0], y + 1.17, p[1]), pick([MAT.paintRed, MAT.paintYellow, MAT.leaf, MAT.copper]), 1); }
  K.W.add([Math.min(P(-1.5, -0.1)[0], P(1.5, 0.9)[0]), y, Math.min(P(-1.5, -0.1)[1], P(1.5, 0.9)[1])], [Math.max(P(-1.5, -0.1)[0], P(1.5, 0.9)[0]), y + 1.08, Math.max(P(-1.5, -0.1)[1], P(1.5, 0.9)[1])]);
}

export function palm(K, x, y, z, h = 6, lean = 0.3, ry = rand() * 6) {
  const { B } = K, segs = 9;
  let px = x, pz = z, py = y;
  const dx = Math.sin(ry), dz = Math.cos(ry);
  for (let i = 0; i < segs; i++) {
    const t = i / segs, r = 0.24 - t * 0.1, sh = h / segs;
    const off = Math.pow(t, 1.8) * lean * h * 0.4;
    const nx = x + dx * off, nz = z + dz * off;
    const ang = Math.atan2(Math.hypot(nx - px, nz - pz), sh);
    B.add(xf(cyl(r * 0.92, r, sh * 1.05, 10), (px + nx) / 2, py + sh / 2, (pz + nz) / 2, ang * dz, 0, -ang * dx), MAT.palmTrunk, 'keep');
    B.add(xf(torus(r * 0.95, 0.04, 4, 12), nx, py + sh, nz, Math.PI / 2), MAT.palmTrunk, 1);
    px = nx; pz = nz; py += sh;
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + rand() * 0.3, len = 2.6 + rand() * 0.8;
    const g = new T.PlaneGeometry(len, 0.7, 8, 2);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const u = (pos.getX(k) + len / 2) / len, vy = pos.getY(k);
      pos.setY(k, vy * (1 - u * 0.75) * (1 - u * u * 0.2));
      pos.setZ(k, -u * u * 1.5 + Math.abs(vy) * 0.5);
      pos.setX(k, u * len);
    }
    g.computeVertexNormals();
    xf(g, 0, 0, 0, Math.PI / 2 - 0.25, 0, 0);
    xf(g, px, py, pz, 0, a, 0);
    B.add(g, rand() < 0.5 ? MAT.leaf : MAT.leafDark, 1.2);
  }
  for (let i = 0; i < 3; i++) B.add(xf(sph(0.14, 8, 6), px + Math.cos(i * 2) * 0.2, py - 0.2, pz + Math.sin(i * 2) * 0.2), MAT.woodDark, 1);
  K.W.add([x - 0.25, y, z - 0.25], [x + 0.25, y + 3, z + 0.25], { walkable: false, cam: false });
}

export function bunting(K, a, b, sag = 0.8) {
  const { B } = K, A = new T.Vector3(...a), Bv = new T.Vector3(...b);
  B.add(sagRope(A, Bv, sag, 0.02), MAT.rope, 'keep');
  const n = Math.floor(A.distanceTo(Bv) / 0.6), cols = [MAT.canvasRed, MAT.paintYellow, MAT.canvasStripe, MAT.canvas];
  const dir = new T.Vector3().subVectors(Bv, A).normalize();
  for (let i = 1; i < n; i++) {
    const t = i / n, p = new T.Vector3().lerpVectors(A, Bv, t); p.y -= Math.sin(t * Math.PI) * sag;
    const g = new T.BufferGeometry();
    const l = dir.clone().multiplyScalar(0.2);
    g.setAttribute('position', new T.Float32BufferAttribute([p.x - l.x, p.y, p.z - l.z, p.x + l.x, p.y, p.z + l.z, p.x, p.y - 0.45, p.z], 3));
    g.computeVertexNormals();
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
    const g2 = g.clone(); const idx = g2.attributes.position; const tmp = [idx.getX(0), idx.getY(0), idx.getZ(0)];
    idx.setXYZ(0, idx.getX(1), idx.getY(1), idx.getZ(1)); idx.setXYZ(1, tmp[0], tmp[1], tmp[2]); g2.computeVertexNormals();
    const m = cols[i % cols.length];
    B.add(g, m, 'keep'); B.add(g2, m, 'keep');
  }
}

export function rock(K, x, y, z, sx, sy = sx, sz = sx, seed = 1, mat = MAT.rock) {
  const g = new T.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const n = fbm((v.x + 2) * 0.25 + seed * 0.13, (v.z + 2) * 0.25 + v.y * 0.2, 4, 4, seed);
    v.multiplyScalar(0.75 + n * 0.55);
    if (v.y > 0.55) v.y = 0.55 + (v.y - 0.55) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  xf(g, x, y, z, 0, seed, 0, sx, sy, sz);
  K.B.add(g, mat, 3);
}

export function cliff(K, x0, x1, z0, z1, top, seed = 3) {
  // rocky mass beneath a plateau
  const w = x1 - x0, d = z1 - z0;
  const n = Math.ceil((w + d) / 5);
  for (let i = 0; i < n; i++) {
    const t = i / n, side = i % 4;
    let x, z;
    if (side === 0) { x = x0 + t * w; z = z0; } else if (side === 1) { x = x1; z = z0 + t * d; } else if (side === 2) { x = x1 - t * w; z = z1; } else { x = x0; z = z1 - t * d; }
    rock(K, x + (rand() - 0.5) * 2, top * 0.35, z + (rand() - 0.5) * 2, 3 + rand() * 2, top * 0.75, 3 + rand() * 2, seed + i, rand() < 0.5 ? MAT.rock : MAT.rockDark);
  }
}

export function ship(K, x, y, z, ry = 0, scale = 1, o = {}) {
  // a moored galleon built from a pinched hemisphere hull, masts, sails and rigging
  const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(scale);
  const hull = new T.SphereGeometry(1, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const bow = vz > 0 ? 1 - Math.pow(vz, 2) * 0.75 : 1 - Math.pow(-vz, 3) * 0.25;
    vx *= bow; p.setXYZ(i, vx * 2.4, vy * 2.1, vz * 7.5);
  }
  hull.computeVertexNormals();
  const hullUV = xf(hull, 0, 0, 0);
  const B = new Batch();
  B.add(hullUV, MAT.woodHull, 1.5);
  // deck + bulwarks
  B.add(xf(new T.CylinderGeometry(1, 1, 0.2, 28), 0, -0.05, 0, 0, 0, 0, 2.3, 1, 7.2), MAT.planks, 2.5);
  const rail = new T.CylinderGeometry(1, 1, 0.9, 28, 1, true);
  B.add(xf(rail, 0, 0.4, 0, 0, 0, 0, 2.4, 1, 7.4), MAT.woodRed, 1.5);
  B.add(xf(torus(1, 0.06, 6, 40), 0, 0.85, 0, Math.PI / 2, 0, 0, 2.42, 7.42, 1), MAT.brass, 1);
  B.add(xf(new T.CylinderGeometry(1, 1, 0.25, 28, 1, true), 0, -0.5, 0, 0, 0, 0, 2.43, 1, 7.45), MAT.paintYellow, 1);
  // stern castle
  B.add(xf(rbox(4.0, 2.0, 3.2, 0.1), 0, 0.9, -5.2), MAT.woodHull, 1.5);
  B.add(xf(box(4.2, 0.18, 3.4), 0, 1.95, -5.2), MAT.planks, 2);
  for (let i = 0; i < 3; i++) B.add(xf(box(0.6, 0.7, 0.1), -1.2 + i * 1.2, 1.0, -6.82), MAT.window, 1);
  B.add(xf(box(4.3, 0.2, 0.15), 0, 0.4, -6.85), MAT.brass, 1);
  // gunports
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    const zz = -3 + i * 1.6, wx = 2.4 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, zz / 7.5), 2) * 0.75)) * 0.98;
    B.add(xf(box(0.08, 0.5, 0.6), sx * wx, -0.35, zz), MAT.black, 1);
    B.add(xf(cyl(0.1, 0.13, 0.6, 10), sx * (wx + 0.2), -0.35, zz, 0, 0, Math.PI / 2), MAT.iron, 1);
  }
  // bowsprit
  B.add(xf(cyl(0.12, 0.2, 5, 10), 0, 1.0, 8.4, Math.PI / 2 - 0.35, 0, 0), MAT.woodDark, 'keep');
  // masts + yards + sails
  const masts = o.masts || [[0, 2.5, 13], [0, -1.6, 11]];
  const sailMat = o.sail || MAT.canvas;
  const sails = [];
  for (const [mx, mz, mh] of masts) {
    B.add(xf(cyl(0.12, 0.2, mh, 10), mx, mh / 2, mz), MAT.woodDark, 'keep');
    B.add(xf(cyl(0.45, 0.45, 0.3, 10), mx, mh * 0.72, mz), MAT.woodDark, 1);
    for (const [hy, wy] of [[0.38, 5.2], [0.62, 4.2], [0.84, 3]]) {
      B.add(xf(cyl(0.07, 0.07, wy, 8), mx, mh * hy + 1.6, mz, 0, 0, Math.PI / 2), MAT.woodDark, 'keep');
      const sg = new T.PlaneGeometry(wy * 0.92, 2.6, 8, 6), sp = sg.attributes.position;
      for (let k = 0; k < sp.count; k++) { const u = sp.getX(k) / (wy * 0.46), v = sp.getY(k) / 1.3; sp.setZ(k, (1 - u * u) * (1 - v * v * 0.3) * 0.7); }
      sg.computeVertexNormals(); xf(sg, mx, mh * hy + 0.25, mz + 0.15);
      B.add(sg, sailMat, 3);
      sails.push(sg);
    }
    // shrouds
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) B.add(tube_(new T.Vector3(sx * 2.3, 0.85, mz - 0.9 + k * 0.6), new T.Vector3(mx, mh * 0.72, mz)), MAT.rope, 'keep');
    o.flags !== false && K.flags?.push({ obj: g, local: new T.Vector3(mx, mh + 0.2, mz) });
  }
  B.add(tube_(new T.Vector3(0, 1.8, 10.5), new T.Vector3(0, masts[0][2] * 0.95, masts[0][1])), MAT.rope, 'keep');
  B.build(g);
  K.scene.add(g);
  if (o.collide) {
    g.updateMatrixWorld(true);
    const bb = new T.Box3().setFromObject(g);
    K.W.add([bb.min.x, y - 2, bb.min.z], [bb.max.x, y + 0.9 * scale, bb.max.z], { cam: false });
  }
  return g;
}
function tube_(a, b) { return new T.TubeGeometry(new T.LineCurve3(a, b), 1, 0.025, 4, false); }

export function crane(K, x, y, z, ry = 0) {
  const { B } = K, c = Math.cos(ry), s = Math.sin(ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(xf(box(0.35, 9, 0.35), x + sx * 1.4, y + 4.5, z + sz * 1.4, sz * 0.1, 0, -sx * 0.1), MAT.woodDark, 2);
  B.add(xf(box(3.4, 0.4, 3.4), x, y + 9, z), MAT.planks, 2);
  B.add(xf(box(0.4, 0.4, 9), x + s * 3.5, y + 9.4, z + c * 3.5, 0, ry, 0), MAT.wood, 2);
  B.add(xf(cyl(0.03, 0.03, 4, 5), x + s * 7.5, y + 7.4, z + c * 7.5), MAT.rope, 'keep');
  B.add(xf(torus(0.25, 0.06, 6, 12, Math.PI * 1.4), x + s * 7.5, y + 5.3, z + c * 7.5, 0, ry, 0), MAT.iron, 1);
  K.W.add([x - 1.8, y, z - 1.8], [x + 1.8, y + 9.2, z + 1.8], { cam: false });
}

export function lighthouse(K, x, y, z) {
  const { B } = K, H = 20;
  for (let i = 0; i < 8; i++) {
    const y0 = y + i * H / 8, r0 = 4 - i * 0.25, r1 = 4 - (i + 1) * 0.25;
    B.add(xf(cyl(r1, r0, H / 8, 28), x, y0 + H / 16, z), i % 2 ? MAT.paintRed : MAT.paintWhite, 2);
  }
  B.add(xf(cyl(4.3, 4.3, 1.2, 28), x, y + 0.6, z), MAT.brick, 3);
  B.add(xf(box(1.4, 2.4, 0.4), x, y + 2.2, z + 3.85), MAT.woodHull, 1.2);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; B.add(xf(box(0.7, 1.0, 0.3), x + Math.cos(a) * (3.8 - (i % 3 + 1) * 0.7), y + 4 + i * 2.5, z + Math.sin(a) * (3.8 - (i % 3 + 1) * 0.7), 0, -a + Math.PI / 2, 0), MAT.windowDark, 1); }
  const top = y + H;
  B.add(xf(cyl(3.6, 3.0, 0.5, 28), x, top + 0.25, z), MAT.ironDark, 1);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; B.add(xf(cyl(0.04, 0.04, 1.1, 5), x + Math.cos(a) * 3.45, top + 1.0, z + Math.sin(a) * 3.45), MAT.ironDark, 1); }
  B.add(xf(torus(3.45, 0.05, 5, 40), x, top + 1.55, z, Math.PI / 2), MAT.ironDark, 1);
  B.add(xf(cyl(2.0, 2.0, 2.6, 12, 1, true), x, top + 1.8, z), MAT.glass, 1);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; B.add(xf(box(0.08, 2.6, 0.08), x + Math.cos(a) * 2.0, top + 1.8, z + Math.sin(a) * 2.0), MAT.ironDark, 1); }
  B.add(xf(sph(1.0, 16, 12), x, top + 1.8, z), MAT.lamp, 1);
  B.add(xf(cyl(0.1, 2.6, 1.6, 16), x, top + 3.9, z), MAT.copper, 'keep');
  B.add(xf(sph(0.3, 10, 8), x, top + 4.8, z), MAT.brass, 1);
  K.W.add([x - 4, y, z - 4], [x + 4, y + H + 5, z + 4]);
  return new T.Vector3(x, top + 1.8, z);
}

export function fountain(K, x, y, z) {
  const { B } = K;
  B.add(xf(cyl(3.2, 3.4, 0.8, 32), x, y + 0.4, z), MAT.flagstone, 2);
  B.add(xf(cyl(2.9, 2.9, 0.82, 32, 1, true), x, y + 0.41, z), MAT.brick, 2);
  B.add(xf(cyl(0.8, 1.0, 2.2, 16), x, y + 1.1, z), MAT.brick, 2);
  B.add(xf(cyl(1.4, 1.2, 0.3, 20), x, y + 2.3, z), MAT.flagstone, 2);
  const gg = gearGeo(1.3, 14, 0.35, 0.3).clone();
  B.add(xf(gg, x, y + 3.9, z, 0, 0.6, 0), MAT.brass, 1);
  B.add(xf(gearGeo(0.7, 10, 0.3, 0.3).clone(), x + 0.9, y + 3.0, z - 0.4, 0, 0.6, 0.3), MAT.copper, 1);
  const water = new T.Mesh(new T.CircleGeometry(2.9, 32), new T.MeshPhysicalMaterial({ color: 0x2a8fa0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1, envMapIntensity: 1.5 }));
  water.rotation.x = -Math.PI / 2; water.position.set(x, y + 0.65, z); K.scene.add(water);
  K.W.add([x - 3.2, y, z - 3.2], [x + 3.2, y + 0.8, z + 3.2]);
  K.W.add([x - 1.1, y, z - 1.1], [x + 1.1, y + 5, z + 1.1]);
  K.fountains?.push(new T.Vector3(x, y + 4.8, z));
}

// ------------------------------------------------------------ extra dressing
export function cannonProp(K, x, y, z, ry = 0) {
  const { B } = K, c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  let p = P(0, 0.35, 0); B.add(xf(rbox(0.9, 0.35, 1.5, 0.05), p[0], p[1], p[2], 0, ry, 0), MAT.woodDark, 1);
  for (const sx of [-1, 1]) for (const sz of [-0.5, 0.5]) {
    p = P(sx * 0.52, 0.28, sz); B.add(xf(cyl(0.28, 0.28, 0.12, 14), p[0], p[1], p[2], 0, ry, Math.PI / 2), MAT.wood, 1);
    B.add(xf(torus(0.28, 0.03, 4, 14), p[0], p[1], p[2], 0, ry + Math.PI / 2, 0), MAT.ironDark, 1);
  }
  p = P(0, 0.75, 0.15);
  B.add(xf(lathe([[0, -0.9], [0.17, -0.88], [0.2, -0.7], [0.19, -0.5], [0.15, 0.6], [0.18, 0.7], [0.18, 0.8], [0.1, 0.8]], 16), p[0], p[1], p[2], Math.PI / 2 - 0.12, ry, 0), MAT.iron, 1);
  K.W.add([x - 0.8, y, z - 0.8], [x + 0.8, y + 1.0, z + 0.8]);
}
export function ballPile(K, x, y, z) {
  const r = 0.17;
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3 - l; i++) for (let j = 0; j < 3 - l; j++)
    K.B.add(xf(sph(r, 10, 8), x + (i - (2 - l) / 2) * r * 2, y + r + l * r * 1.5, z + (j - (2 - l) / 2) * r * 2), MAT.ironDark, 1);
}
export function banner(K, x, y, z, ry, h = 3.5, mat = MAT.canvasRed) {
  const { B } = K, c = Math.cos(ry), s = Math.sin(ry);
  B.add(xf(cyl(0.05, 0.05, 1.5, 6), x, y, z, 0, ry, Math.PI / 2), MAT.brass, 1);
  const g = new T.PlaneGeometry(1.2, h, 1, 6); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = p.getY(i); if (v < -h / 2 + 0.01) p.setY(i, v + (Math.abs(p.getX(i)) < 0.01 ? -0.4 : 0)); p.setZ(i, Math.sin((v / h) * 3) * 0.05); }
  g.computeVertexNormals(); xf(g, x + s * 0.06, y - h / 2 - 0.05, z + c * 0.06, 0, ry, 0);
  B.add(g, mat, 1.2);
  B.add(xf(gearGeo(0.35, 10, 0.03, 0.3).clone(), x + s * 0.1, y - h * 0.38, z + c * 0.1, 0, ry, 0), MAT.brass, 1);
}
export function brazier(K, x, y, z) {
  const { B } = K;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; B.add(xf(cyl(0.04, 0.05, 1.1, 6), x + Math.cos(a) * 0.25, y + 0.5, z + Math.sin(a) * 0.25, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25), MAT.ironDark, 1); }
  B.add(xf(lathe([[0, 0], [0.25, 0], [0.45, 0.25], [0.48, 0.3], [0.44, 0.3], [0.22, 0.05], [0, 0.05]], 14), x, y + 1.0, z), MAT.ironDark, 1);
  B.add(xf(sph(0.3, 10, 8), x, y + 1.15, z, 0, 0, 0, 1, 0.5, 1), MAT.ember, 1);
  K.fires?.push(new T.Vector3(x, y + 1.3, z));
  K.W.add([x - 0.4, y, z - 0.4], [x + 0.4, y + 1.3, z + 0.4], { walkable: false, cam: false });
}
export function pipe(K, pts, r = 0.12, mat = MAT.copper) {
  const { B } = K;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new T.Vector3(...pts[i]), b = new T.Vector3(...pts[i + 1]), len = a.distanceTo(b);
    const g = cyl(r, r, len, 10); const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); B.add(g, mat, 'keep');
    for (let t = 0; t <= len; t += 2.5) { const p = a.clone().lerp(b, len ? t / len : 0); const f = cyl(r * 1.4, r * 1.4, 0.1, 10); f.applyQuaternion(q); f.translate(p.x, p.y, p.z); B.add(f, MAT.brass, 1); }
    B.add(xf(sph(r * 1.25, 10, 8), b.x, b.y, b.z), mat, 1);
  }
}
export function lanternString(K, a, b, sag = 0.6) {
  const A = new T.Vector3(...a), Bv = new T.Vector3(...b);
  K.B.add(sagRope(A, Bv, sag, 0.02), MAT.rope, 'keep');
  const n = Math.floor(A.distanceTo(Bv) / 1.6);
  for (let i = 1; i < n; i++) { const t = i / n, p = new T.Vector3().lerpVectors(A, Bv, t); p.y -= Math.sin(t * Math.PI) * sag + 0.2; K.B.add(xf(sph(0.14, 10, 8), p.x, p.y, p.z, 0, 0, 0, 1, 1.25, 1), i % 3 ? MAT.lamp : MAT.window, 1); }
}

// ------------------------------------------------------------ Caribbean dressing
// Stilt beach shack with a thatched hip roof
export function hut(K, x, y, z, ry = 0, w = 4, d = 3.4) {
  const { B } = K, c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const floorY = y + 0.9;
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]]) { const p = P(lx, lz); B.add(xf(cyl(0.11, 0.13, floorY - y + 2.6, 8), p[0], (y + floorY + 2.6) / 2 - 0.1, p[1]), MAT.woodDark, 'keep'); }
  let p = P(0, 0);
  B.add(xf(box(w + 0.3, 0.16, d + 0.3), p[0], floorY, p[1], 0, ry, 0), MAT.planks, 2);
  // plank walls on three sides, open front with a half wall
  p = P(0, -d / 2); B.add(xf(box(w, 2.1, 0.1), p[0], floorY + 1.1, p[1], 0, ry, 0), MAT.woodHull, 1.6);
  for (const sx of [-1, 1]) { p = P(sx * w / 2, 0); B.add(xf(box(0.1, 2.1, d), p[0], floorY + 1.1, p[1], 0, ry, 0), MAT.woodHull, 1.6); }
  p = P(0, d / 2); B.add(xf(box(w, 0.9, 0.1), p[0], floorY + 0.5, p[1], 0, ry, 0), MAT.woodHull, 1.6);
  // thatch roof (4-sided pyramid) + ridge fringe
  p = P(0, 0);
  const roof = new T.ConeGeometry(Math.hypot(w, d) * 0.62, 1.9, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(w / Math.hypot(w, d) * 1.41, 1, d / Math.hypot(w, d) * 1.41);
  B.add(xf(roof, p[0], floorY + 3.1, p[1], 0, ry, 0), MAT.thatch, 1.2);
  const fringe = new T.CylinderGeometry(1, 1, 0.35, 4, 1, true); fringe.rotateY(Math.PI / 4); fringe.scale(w * 0.86, 1, d * 0.86);
  B.add(xf(fringe, p[0], floorY + 2.1, p[1], 0, ry, 0), MAT.thatch, 1);
  // ladder
  p = P(w * 0.25, d / 2 + 0.5);
  for (let i = 0; i < 4; i++) B.add(xf(box(0.7, 0.06, 0.12), p[0], y + 0.2 + i * 0.25, p[1], 0, ry, 0), MAT.wood, 1);
  // hammock between front posts
  const a = P(-w / 2, d / 2 + 0.05), b = P(0, d / 2 + 0.05);
  B.add(sagRope(new T.Vector3(a[0], floorY + 1.6, a[1]), new T.Vector3(b[0], floorY + 1.6, b[1]), 0.7, 0.09), MAT.canvasRed, 'keep');
  const ext = Math.abs(c) > 0.7 ? [w / 2 + 0.2, d / 2 + 0.2] : [d / 2 + 0.2, w / 2 + 0.2];
  K.W.add([x - ext[0], y - 1, z - ext[1]], [x + ext[0], floorY + 3.8, z + ext[1]]);
}

export function rowboat(K, x, y, z, ry = 0, tilt = 0) {
  const g = new T.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { let vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const bow = 1 - Math.pow(Math.abs(vz), 2) * 0.55; p.setXYZ(i, vx * 0.75 * bow, vy * 0.45, vz * 1.9); }
  g.computeVertexNormals();
  K.B.add(xf(g, x, y + 0.42, z, tilt, ry, tilt * 0.5), MAT.woodHull, 1.2);
  K.B.add(xf(torus(1, 0.04, 4, 24), x, y + 0.42, z, Math.PI / 2 + tilt, ry, 0, 0.72, 1.85, 1), MAT.woodDark, 1);
  for (const lz of [-0.6, 0.5]) K.B.add(xf(box(1.2, 0.06, 0.25), x + Math.sin(ry) * lz, y + 0.3, z + Math.cos(ry) * lz, 0, ry, 0), MAT.wood, 1);
  K.B.add(xf(cyl(0.03, 0.03, 2.6, 5), x + 0.3, y + 0.5, z, 0.2, ry, Math.PI / 2 - 0.15), MAT.wood, 'keep');
}

export function driftwood(K, x, y, z, ry) { K.B.add(xf(cyl(0.12, 0.18, 2.4 + rand() * 1.5, 7), x, y + 0.12, z, 0, ry, Math.PI / 2), MAT.palmTrunk, 'keep'); }

export function torchPost(K, x, y, z) {
  K.B.add(xf(cyl(0.06, 0.08, 1.9, 6), x, y + 0.95, z), MAT.woodDark, 'keep');
  K.B.add(xf(cyl(0.14, 0.08, 0.3, 8), x, y + 2.0, z), MAT.thatch, 1);
  K.fires?.push(new T.Vector3(x, y + 2.2, z));
}
