// Procedural, tileable PBR texture sets (color + normal + roughness) generated at load time.
import * as T from 'three';

const hash = (x, y, s) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const mod = (a, p) => ((a % p) + p) % p;
const sm = t => t * t * (3 - 2 * t);
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
  const x0 = mod(xi, p), x1 = mod(xi + 1, p), y0 = mod(yi, p), y1 = mod(yi + 1, p);
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// u,v in [0,1); p = base lattice period (integer) -> tileable
export function fbm(u, v, p, oct = 4, s = 0) {
  let sum = 0, amp = 0.5, norm = 0, f = p;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(u * f, v * f, f, s + o * 31); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
const W = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 };
export function worley(u, v, p, s) {
  const x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y);
  W.f1 = 9; W.f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = mod(cx, p), wy = mod(cy, p);
    const px = cx + 0.15 + 0.7 * hash(wx, wy, s), py = cy + 0.15 + 0.7 * hash(wx, wy, s + 7);
    const d = Math.hypot(px - x, py - y);
    if (d < W.f1) { W.f2 = W.f1; W.f1 = d; W.id = hash(wx, wy, s + 13); W.cx = px / p; W.cy = py / p; }
    else if (d < W.f2) W.f2 = d;
  }
  return W;
}

function dataTex(data, N, srgb) {
  const t = new T.DataTexture(data, N, N, T.RGBAFormat);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.magFilter = T.LinearFilter;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// fn(u, v, o) must set o.h (height 0..1), o.r o.g o.b (0..1 sRGB), o.m (roughness 0..1)
function build(N, fn, strength = 3) {
  const H = new Float32Array(N * N), col = new Uint8Array(N * N * 4), rgh = new Uint8Array(N * N * 4), nrm = new Uint8Array(N * N * 4);
  const o = { h: 0, r: 0, g: 0, b: 0, m: 0.5 };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    o.h = 0.5; o.m = 0.8;
    fn((x + 0.5) / N, (y + 0.5) / N, o);
    H[i] = o.h;
    col[i * 4] = clamp(o.r) * 255; col[i * 4 + 1] = clamp(o.g) * 255; col[i * 4 + 2] = clamp(o.b) * 255; col[i * 4 + 3] = 255;
    const m = clamp(o.m) * 255; rgh[i * 4] = m; rgh[i * 4 + 1] = m; rgh[i * 4 + 2] = m; rgh[i * 4 + 3] = 255;
  }
  const s = strength * N / 256;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const dx = H[y * N + ((x + 1) % N)] - H[y * N + ((x - 1 + N) % N)];
    const dy = H[((y + 1) % N) * N + x] - H[((y - 1 + N) % N) * N + x];
    let nx = -dx * s, ny = -dy * s, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    nrm[i * 4] = (nx * 0.5 + 0.5) * 255; nrm[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; nrm[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; nrm[i * 4 + 3] = 255;
  }
  return { map: dataTex(col, N, true), normalMap: dataTex(nrm, N, false), roughnessMap: dataTex(rgh, N, false) };
}
const rgb = (o, r, g, b) => { o.r = r; o.g = g; o.b = b; };

// ---------------------------------------------------------------- generators
const GEN = {
  concrete: [512, (u, v, o) => {
    const n = fbm(u, v, 4, 5, 1), fine = fbm(u, v, 48, 3, 2), st = fbm(u, v, 3, 4, 9);
    const w = worley(u, v, 40, 3);
    const pore = w.id > 0.55 ? sstep(0.16, 0.02, w.f1) : 0;
    const w2 = worley(u, v, 9, 5);
    const pebble = w2.id > 0.75 ? sstep(0.3, 0.1, w2.f1) * 0.35 : 0;
    o.h = n * 0.35 + fine * 0.35 - pore * 0.7 + pebble;
    let g = 0.66 + (n - 0.5) * 0.16 + (fine - 0.5) * 0.1 - sstep(0.45, 0.75, st) * 0.12 - pore * 0.25 + pebble * 0.08;
    rgb(o, g * 1.02, g, g * 0.95);
    o.m = 0.82 + fine * 0.12 - pebble * 0.2;
  }, 4],
  flagstone: [512, (u, v, o) => {
    const rows = 3, row = Math.floor(v * rows), off = row % 2 ? 0.5 : 0;
    const cols = 3, uu = u * cols + off + hash(row, 0, 3) * 0.3, col = Math.floor(uu);
    const lu = uu - col, lv = v * rows - row;
    const warp = (fbm(u, v, 8, 3, 4) - 0.5) * 0.06;
    const e = Math.min(lu, 1 - lu, lv, 1 - lv) + warp;
    const id = hash(mod(col, cols * 2), row, 11);
    const n = fbm(u, v, 6, 5, 12), fine = fbm(u, v, 64, 2, 13);
    const bevel = sstep(0.0, 0.06, e);
    o.h = bevel * (0.7 + n * 0.2 + fine * 0.1);
    const t = 0.58 + (id - 0.5) * 0.14 + (n - 0.5) * 0.18;
    const mortar = 1 - sstep(0.01, 0.035, e);
    rgb(o, mix(t * 1.03, 0.36, mortar), mix(t * 0.98, 0.34, mortar), mix(t * 0.9, 0.3, mortar));
    o.m = mix(0.78 + fine * 0.15, 0.95, mortar);
  }, 3],
  brick: [512, (u, v, o) => {
    const rows = 6, row = Math.floor(v * rows), off = row % 2 ? 0.5 : 0;
    const cols = 2, uu = u * cols + off, col = Math.floor(uu);
    const lu = (uu - col) * 2.1, lv = v * rows - row;
    const warp = (fbm(u, v, 10, 3, 4) - 0.5) * 0.08;
    const e = Math.min(lu, 2.1 - lu, lv, 1 - lv) + warp;
    const id = hash(mod(col, cols), row, 21);
    const n = fbm(u, v, 8, 5, 22), fine = fbm(u, v, 64, 2, 23);
    const bulge = sstep(0.0, 0.18, e);
    o.h = bulge * (0.6 + n * 0.3) + fine * 0.1;
    const t = 0.55 + (id - 0.5) * 0.18 + (n - 0.5) * 0.2;
    const mortar = 1 - sstep(0.02, 0.06, e);
    const moss = sstep(0.55, 0.75, fbm(u, v, 4, 4, 29)) * mortar;
    rgb(o, mix(mix(t * 1.06, 0.62, mortar), 0.32, moss), mix(mix(t * 0.97, 0.58, mortar), 0.42, moss), mix(mix(t * 0.86, 0.52, mortar), 0.22, moss));
    o.m = mix(0.8 + fine * 0.15, 0.95, mortar);
  }, 3],
  cobble: [512, (u, v, o) => {
    const w = worley(u, v, 10, 41);
    const edge = w.f2 - w.f1;
    const n = fbm(u, v, 16, 4, 42);
    const stone = sstep(0.02, 0.22, edge);
    o.h = stone * (0.6 + 0.4 * sstep(0, 0.4, edge)) + n * 0.1;
    const t = 0.5 + (w.id - 0.5) * 0.2 + (n - 0.5) * 0.15;
    rgb(o, mix(0.28, t * 1.04, stone), mix(0.27, t * 0.98, stone), mix(0.24, t * 0.9, stone));
    o.m = mix(0.95, 0.7 + n * 0.2, stone);
  }, 4],
  planks: [512, (u, v, o) => {
    const n = 5, pi = Math.floor(v * n), lv = v * n - pi;
    const joint = hash(pi, 0, 51), uj = mod(u - joint, 1);
    const ej = Math.min(uj, 1 - uj) * 8;
    const gap = Math.min(lv, 1 - lv);
    const id = hash(pi, 1, 52);
    const warp = fbm(u * 0.25, v, 2, 3, 53 + pi);
    const grain = Math.sin((lv * 9 + warp * 6 + Math.sin(u * 6.283 * 2 + pi) * 0.3) * 6.283) * 0.5 + 0.5;
    const fine = fbm(u, v, 64, 2, 54);
    const nail = (Math.hypot((uj < 0.5 ? uj : uj - 1) * 8 * 0.4, (lv - 0.5) * 1.3) < 0.08 || Math.hypot((uj < 0.5 ? uj : uj - 1) * 8 * 0.4 - 0.25, (lv - 0.5) * 1.3) < 0.08) ? 1 : 0;
    const groove = sstep(0.0, 0.07, gap) * sstep(0.0, 0.05, ej);
    o.h = groove * (0.75 + grain * 0.1 + fine * 0.1) - nail * 0.1;
    const t = 0.55 + (id - 0.5) * 0.22;
    const weather = fbm(u, v, 3, 4, 55);
    const r = t * (0.62 + grain * 0.12), g = t * (0.45 + grain * 0.08), b = t * (0.3 + grain * 0.05);
    const gray = (r + g + b) / 3 * 1.1;
    const wt = sstep(0.45, 0.8, weather) * 0.5;
    rgb(o, mix(mix(r, gray, wt), 0.15, 1 - groove) - nail * 0.2, mix(mix(g, gray, wt), 0.12, 1 - groove) - nail * 0.2, mix(mix(b, gray * 0.95, wt), 0.1, 1 - groove) - nail * 0.15);
    o.m = 0.72 + fine * 0.2 - nail * 0.3;
  }, 3],
  wood: [256, (u, v, o) => {
    const warp = fbm(u, v * 0.25, 4, 4, 61);
    const ring = Math.sin((u * 14 + warp * 4) * 6.283) * 0.5 + 0.5;
    const fine = fbm(u, v, 64, 2, 62);
    const knot = worley(u, v, 3, 63);
    const k = knot.id > 0.7 ? sstep(0.18, 0.04, knot.f1) : 0;
    o.h = ring * 0.25 + fine * 0.4 - k * 0.3;
    const t = 0.5 + ring * 0.1 + (fine - 0.5) * 0.1 - k * 0.2;
    rgb(o, t * 0.95, t * 0.68, t * 0.42);
    o.m = 0.65 + fine * 0.25;
  }, 2],
  iron: [256, (u, v, o) => {
    const n = fbm(u, v, 4, 5, 71), fine = fbm(u, v, 48, 3, 72);
    const w = worley(u, v, 24, 73), pit = w.id > 0.6 ? sstep(0.15, 0.03, w.f1) : 0;
    const rust = sstep(0.62, 0.8, fbm(u, v, 6, 5, 74));
    o.h = n * 0.3 + fine * 0.3 - pit * 0.5 + rust * 0.15;
    const g = 0.3 + (n - 0.5) * 0.12 + (fine - 0.5) * 0.06 - pit * 0.08;
    rgb(o, mix(g, 0.5, rust), mix(g * 1.02, 0.27, rust), mix(g * 1.08, 0.14, rust));
    o.m = mix(0.42 + fine * 0.2, 0.9, rust);
  }, 2],
  brass: [256, (u, v, o) => {
    const n = fbm(u, v, 4, 5, 81), fine = fbm(u, v, 64, 3, 82);
    const tarnish = sstep(0.5, 0.85, fbm(u, v, 5, 5, 83));
    o.h = fine * 0.3 + n * 0.2;
    rgb(o, mix(0.92, 0.55, tarnish) * (0.95 + n * 0.1), mix(0.7, 0.45, tarnish) * (0.95 + n * 0.1), mix(0.36, 0.3, tarnish));
    o.m = 0.22 + tarnish * 0.35 + fine * 0.15;
  }, 1],
  roof: [512, (u, v, o) => {
    const rows = 8, row = Math.floor(v * rows), lv = v * rows - row;
    const off = row % 2 ? 0.5 : 0, cols = 6, uu = u * cols + off, ci = Math.floor(uu), lu = uu - ci;
    const id = hash(mod(ci, cols), row, 91);
    const curve = Math.sin(lu * Math.PI);
    const n = fbm(u, v, 8, 4, 92);
    const edge = sstep(0.0, 0.08, Math.min(lu, 1 - lu));
    o.h = (lv * 0.8 + curve * 0.25) * edge;
    const t = 0.62 + (id - 0.5) * 0.2 + (n - 0.5) * 0.15;
    const shade = mix(0.55, 1, sstep(0, 0.35, lv)) * mix(0.6, 1, edge);
    const moss = sstep(0.62, 0.8, fbm(u, v, 3, 4, 93)) * 0.6;
    rgb(o, mix(t * 0.86, 0.35, moss) * shade, mix(t * 0.42, 0.4, moss) * shade, mix(t * 0.28, 0.2, moss) * shade);
    o.m = 0.6 + n * 0.25;
  }, 4],
  plaster: [512, (u, v, o) => {
    const n = fbm(u, v, 4, 6, 101), fine = fbm(u, v, 48, 3, 102);
    const patch = sstep(0.7, 0.72, fbm(u, v, 3, 4, 103));
    const w = worley(u, v, 6, 104);
    const brick = patch * sstep(0.02, 0.08, w.f2 - w.f1);
    o.h = n * 0.3 + fine * 0.3 - patch * 0.4 + brick * 0.2;
    const g = 0.88 + (n - 0.5) * 0.12 + (fine - 0.5) * 0.06;
    rgb(o, mix(g, 0.62, patch), mix(g * 0.97, 0.38, patch), mix(g * 0.9, 0.28, patch));
    o.m = 0.9;
  }, 2],
  rock: [512, (u, v, o) => {
    const warp = fbm(u, v, 3, 4, 111);
    const strata = Math.sin((v * 7 + warp * 2.5) * 6.283) * 0.5 + 0.5;
    const w = worley(u, v, 6, 112), crack = sstep(0.06, 0.0, w.f2 - w.f1);
    const n = fbm(u, v, 8, 6, 113);
    o.h = n * 0.5 + strata * 0.25 - crack * 0.5 + w.f1 * 0.3;
    const t = 0.45 + (n - 0.5) * 0.25 + strata * 0.08 - crack * 0.2 + (w.id - 0.5) * 0.08;
    rgb(o, t * 1.05, t * 0.95, t * 0.84);
    o.m = 0.85;
  }, 5],
  grass: [512, (u, v, o) => {
    const n = fbm(u, v, 4, 5, 121), fine = fbm(u, v, 96, 2, 122);
    const blades = vnoise(u * 160, v * 40, 160, 123);
    const dirt = sstep(0.6, 0.75, fbm(u, v, 3, 5, 124));
    o.h = blades * 0.4 + n * 0.3 + fine * 0.3;
    const t = 0.75 + (n - 0.5) * 0.3 + (blades - 0.5) * 0.25;
    rgb(o, mix(0.36 * t, 0.48, dirt), mix(0.62 * t, 0.38, dirt), mix(0.2 * t, 0.24, dirt));
    o.m = 0.92;
  }, 2],
  sand: [256, (u, v, o) => {
    const n = fbm(u, v, 4, 4, 131), fine = vnoise(u * 128, v * 128, 128, 132);
    const ripple = Math.sin((u * 6 + fbm(u, v, 3, 3, 133) * 2) * 6.283) * 0.5 + 0.5;
    o.h = ripple * 0.3 + fine * 0.3 + n * 0.2;
    const t = 0.82 + (n - 0.5) * 0.12 + (fine - 0.5) * 0.08;
    rgb(o, t, t * 0.86, t * 0.64);
    o.m = 0.95;
  }, 2],
  rope: [256, (u, v, o) => {
    const s = mod(u * 4 + v * 4, 1), strand = Math.sin(s * Math.PI);
    const fib = vnoise(u * 64, v * 256, 64, 141);
    o.h = strand * 0.8 + fib * 0.2;
    const t = 0.55 + strand * 0.3 + (fib - 0.5) * 0.1;
    rgb(o, t * 0.86, t * 0.72, t * 0.5);
    o.m = 0.95;
  }, 3],
  canvas: [256, (u, v, o) => {
    const wx = Math.sin(u * 128 * Math.PI) * 0.5 + 0.5, wy = Math.sin(v * 128 * Math.PI) * 0.5 + 0.5;
    const weave = (Math.floor(u * 128) + Math.floor(v * 128)) % 2 ? wx : wy;
    const dirt = fbm(u, v, 4, 5, 151);
    const seam = sstep(0.008, 0.0, Math.abs(mod(u * 3, 1) - 0.5) - 0.49);
    o.h = weave * 0.4 + seam * 0.3;
    const t = 0.9 - sstep(0.45, 0.85, dirt) * 0.2 - weave * 0.05 - seam * 0.1;
    rgb(o, t, t * 0.95, t * 0.86);
    o.m = 0.95;
  }, 1.5],
  paint: [256, (u, v, o) => {
    const n = fbm(u, v, 4, 5, 161), fine = fbm(u, v, 64, 2, 162);
    const chip = sstep(0.66, 0.7, fbm(u, v, 6, 5, 163));
    const scratch = sstep(0.985, 1, Math.abs(Math.sin((u * 3 + v * 11 + fbm(u, v, 4, 2, 164)) * 20)));
    const bare = Math.max(chip, scratch * 0.8);
    o.h = 0.7 - bare * 0.3 + fine * 0.1;
    const g = 0.92 + (n - 0.5) * 0.08;
    const rust = chip * sstep(0.4, 0.7, fbm(u, v, 12, 3, 165));
    rgb(o, mix(g, mix(0.55, 0.5, rust), bare), mix(g, mix(0.55, 0.28, rust), bare), mix(g, mix(0.58, 0.15, rust), bare));
    o.m = mix(0.38 + fine * 0.15, 0.6, bare);
  }, 2],
  plate: [512, (u, v, o) => {
    const gx = mod(u * 2, 1), gy = mod(v * 2, 1);
    const e = Math.min(gx, 1 - gx, gy, 1 - gy);
    const seam = sstep(0.0, 0.02, e);
    const rx = Math.min(gx, 1 - gx), ry = Math.min(gy, 1 - gy);
    let rivet = 0;
    for (const t of [0.12, 0.37, 0.62, 0.88]) {
      const d1 = Math.hypot(rx - 0.05, gy - t), d2 = Math.hypot(gx - t, ry - 0.05);
      rivet = Math.max(rivet, sstep(0.025, 0.012, Math.min(d1, d2)));
    }
    const n = fbm(u, v, 6, 4, 171), fine = fbm(u, v, 64, 2, 172);
    o.h = seam * 0.6 + rivet * 0.4 + n * 0.1;
    const g = 0.85 + (n - 0.5) * 0.12;
    const grime = (1 - sstep(0.0, 0.08, e)) * 0.3;
    rgb(o, g - grime, g - grime, g * 1.02 - grime);
    o.m = 0.4 + fine * 0.2 + grime;
  }, 3],
  dirt: [256, (u, v, o) => {
    const n = fbm(u, v, 4, 5, 181), w = worley(u, v, 16, 182);
    const peb = w.id > 0.5 ? sstep(0.25, 0.1, w.f1) : 0;
    o.h = n * 0.5 + peb * 0.4;
    const t = 0.45 + (n - 0.5) * 0.2 + peb * 0.1;
    rgb(o, t * 0.95, t * 0.78, t * 0.58);
    o.m = 0.95;
  }, 3],
};

// Simple soft round sprite for particles
export function softSprite(N = 64) {
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1, r = Math.hypot(dx, dy);
    const n = fbm(x / N, y / N, 4, 3, 7);
    const a = clamp(1 - r) ** 1.6 * (0.7 + 0.6 * n);
    const i = (y * N + x) * 4; d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = clamp(a) * 255;
  }
  const t = new T.DataTexture(d, N, N); t.needsUpdate = true; t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; return t;
}
export function waterNormals(N = 256) {
  const o = build(N, (u, v, o) => {
    o.h = fbm(u, v, 6, 5, 191) * 0.6 + fbm(u + 0.3, v * 1.0, 12, 3, 192) * 0.4; rgb(o, 0, 0, 0); o.m = 0;
  }, 6);
  o.map.dispose(); o.roughnessMap.dispose();
  return o.normalMap;
}

export async function generateTextures(onProgress) {
  const out = {};
  const keys = Object.keys(GEN);
  for (let i = 0; i < keys.length; i++) {
    const [N, fn, str] = GEN[keys[i]];
    out[keys[i]] = build(N, fn, str);
    onProgress?.((i + 1) / keys.length, keys[i]);
    await new Promise(r => setTimeout(r, 0));
  }
  out.water = waterNormals();
  out.soft = softSprite();
  return out;
}
