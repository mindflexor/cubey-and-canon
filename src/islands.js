// Tropical island terrain: analytic coastline (shared with the water shader for shallows + surf),
// white-sand beaches, grassy jungle interior, rocky slopes, and flat pads for gameplay areas.
import * as T from 'three';
import { TEX } from './materials.js';
import { fbm } from './textures.js';

export const ISLANDS = []; // {cx, cz, rx, rz, seed}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function coastR(theta, seed) {
  return 1 + 0.11 * Math.sin(3 * theta + seed) + 0.07 * Math.sin(5 * theta + seed * 1.7) + 0.04 * Math.sin(9 * theta + seed * 2.3);
}
export const COAST_GLSL = `
float coastR(float th, float sd){ return 1.0 + 0.11*sin(3.0*th+sd) + 0.07*sin(5.0*th+sd*1.7) + 0.04*sin(9.0*th+sd*2.3); }
float islandE(vec2 p, vec4 I, float sd){ vec2 d = (p - I.xy) / I.zw; return length(d) / coastR(atan(d.y, d.x), sd); }`;

export class Island {
  // o: {cx, cz, rx, rz, seed, peak, beach, flats: [[x0,x1,z0,z1,h,margin]], res, hills}
  constructor(o) {
    Object.assign(this, { peak: 14, beach: 0.22, res: 1.5, flats: [], hills: 1, cliffs: 0 }, o);
    ISLANDS.push({ cx: this.cx, cz: this.cz, rx: this.rx, rz: this.rz, seed: this.seed });
  }
  e(x, z) {
    const dx = (x - this.cx) / this.rx, dz = (z - this.cz) / this.rz;
    return Math.hypot(dx, dz) / coastR(Math.atan2(dz, dx), this.seed);
  }
  raw(x, z) {
    const e = this.e(x, z);
    if (e >= 1) return -Math.min(7, (e - 1) * 14) - 0.2;
    const b0 = 1 - this.beach;
    // beach: gentle shelf from 1.3 m down to the waterline
    let h = e > b0 ? 1.3 * sst(1, b0, e) : 1.3;
    // inland hills / peak with fbm detail
    const inland = sst(b0, b0 - 0.35, e);
    const n = fbm((x / 260) + this.seed * 0.37 % 1, (z / 260) + this.seed * 0.11 % 1, 4, 5, Math.floor(this.seed * 10));
    // jungle ridge rising inland, broken up by noise; plus a gentle volcanic cone toward the center
    const ridge = sst(b0 - 0.05, b0 - 0.5, e) * (0.45 + 0.75 * n);
    const cone = Math.pow(sst(0.75, 0.0, e), 1.8);
    h += inland * (n * 5 * this.hills) + this.peak * (ridge * 0.55 + cone * 0.6);
    if (this.cliffs) h += sst(b0 + 0.06, b0 - 0.04, e) * this.cliffs;
    return h;
  }
  height(x, z) {
    let h = this.raw(x, z);
    for (const [x0, x1, z0, z1, fh, m = 4] of this.flats) {
      const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), d = Math.hypot(dx, dz);
      if (d < m) h = h + (fh - h) * sst(m, 0, d);
    }
    return h;
  }
  build(scene, world, mat) {
    const ext = Math.max(this.rx, this.rz) * 1.35;
    const x0 = this.cx - this.rx * 1.35, z0 = this.cz - this.rz * 1.35, w = this.rx * 2.7, d = this.rz * 2.7;
    const nx = Math.ceil(w / this.res), nz = Math.ceil(d / this.res);
    // cache a height grid for fast physics lookups
    const H = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * (nx + 1) + i] = this.height(x0 + i * w / nx, z0 + j * d / nz);
    const g = new T.PlaneGeometry(w, d, nx, nz); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const i = Math.round((p.getX(k) + w / 2) / (w / nx)), j = Math.round((p.getZ(k) + d / 2) / (d / nz));
      p.setY(k, H[j * (nx + 1) + i]);
      p.setX(k, p.getX(k) + this.cx); p.setZ(k, p.getZ(k) + this.cz);
    }
    g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new T.Mesh(g, mat); mesh.receiveShadow = true; mesh.castShadow = true; mesh.userData.terrain = true;
    scene.add(mesh);
    const sample = (x, z) => {
      const fx = (x - x0) / (w / nx), fz = (z - z0) / (d / nz);
      if (fx < 0 || fz < 0 || fx >= nx || fz >= nz) return -10;
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, R = nx + 1;
      const a = H[j * R + i], b = H[j * R + i + 1], c = H[(j + 1) * R + i], e = H[(j + 1) * R + i + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
    };
    let top = -10; for (const v of H) top = Math.max(top, v);
    this.solid = world.add([x0, -8, z0], [x0 + w, top, z0 + d], { height: sample, cam: true, blocksShots: true, surface: 'sand' });
    this.sample = sample; this.mesh = mesh; void ext;
    return this;
  }
  surfaceAt(x, z) { const h = this.sample(x, z); return h < 1.45 ? 'sand' : 'grass'; }
}

// Splat-mapped terrain material: wet sand -> dry sand -> grass/jungle floor, rock on steep slopes
export function terrainMaterial() {
  const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.tSand = { value: TEX.sand.map }; sh.uniforms.tGrass = { value: TEX.grass.map }; sh.uniforms.tRock = { value: TEX.rock.map }; sh.uniforms.tDirt = { value: TEX.dirt.map };
    sh.uniforms.nSand = { value: TEX.sand.normalMap }; sh.uniforms.nRock = { value: TEX.rock.normalMap };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvTW = (modelMatrix * vec4(transformed,1.0)).xyz; vTN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D tSand, tGrass, tRock, tDirt, nSand, nRock; varying vec3 vTW; varying vec3 vTN;
      float th(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float tn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(th(i),th(i+vec2(1,0)),f.x), mix(th(i+vec2(0,1)),th(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <map_fragment>', `
      vec2 uv = vTW.xz;
      float slope = 1.0 - clamp(vTN.y, 0.0, 1.0);
      float n = tn(uv * 0.15) * 0.6 + tn(uv * 0.6) * 0.4;
      vec3 sand = texture2D(tSand, uv / 3.0).rgb * vec3(1.06, 1.02, 0.95);
      vec3 grass = texture2D(tGrass, uv / 3.5).rgb;
      vec3 dirt = texture2D(tDirt, uv / 3.0).rgb;
      vec3 rockC = texture2D(tRock, vec2(uv.x + vTW.y * 0.6, vTW.y + uv.y * 0.3) / 6.0).rgb;
      grass = mix(grass, dirt, smoothstep(0.55, 0.8, n) * 0.6);
      float sandK = 1.0 - smoothstep(1.0, 1.5, vTW.y + (n - 0.5) * 0.6);
      vec3 col = mix(grass, sand, sandK);
      float rockK = smoothstep(0.5, 0.72, slope + (n - 0.5) * 0.2);
      col = mix(col, rockC, rockK);
      float wet = 1.0 - smoothstep(0.05, 0.55, vTW.y);
      col *= mix(1.0, 0.62, wet * sandK);
      col = mix(col, col * vec3(0.75, 0.9, 0.9), (1.0 - smoothstep(-1.5, 0.0, vTW.y)));
      diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.25, wet * sandK);`);
  };
  m.customProgramCacheKey = () => 'terrain1';
  return m;
}
void fbm;
