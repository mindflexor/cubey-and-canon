import * as T from 'three';
import { generateTextures } from './textures.js';

export const TEX = {};
export const MAT = {};

function std(set, o = {}) {
  const m = new (o.physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)({
    color: o.color ?? 0xffffff,
    map: set?.map ?? null,
    normalMap: set?.normalMap ?? null,
    roughnessMap: set?.roughnessMap ?? null,
    roughness: o.rough ?? 1,
    metalness: o.metal ?? 0,
    envMapIntensity: o.env ?? 1,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.ei ?? 1,
    flatShading: o.flat ?? false,
    side: o.side ?? T.FrontSide,
  });
  if (set?.normalMap) m.normalScale.set(o.ns ?? 1, o.ns ?? 1);
  if (o.physical) { m.clearcoat = o.clearcoat ?? 0; m.clearcoatRoughness = o.ccr ?? 0.2; if (o.sheen) { m.sheen = o.sheen; m.sheenRoughness = 0.8; m.sheenColor = new T.Color(0xffffff); } }
  if (o.transparent) { m.transparent = true; m.opacity = o.opacity ?? 1; m.depthWrite = o.depthWrite ?? true; }
  return m;
}

// Break up texture tiling with low-frequency object-space variation, add grime toward the ground
// and a darker, glossier wet band at the waterline.
const MACRO = `
float mh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float mn3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(mh(i),mh(i+vec3(1,0,0)),f.x),mix(mh(i+vec3(0,1,0)),mh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(mh(i+vec3(0,0,1)),mh(i+vec3(1,0,1)),f.x),mix(mh(i+vec3(0,1,1)),mh(i+vec3(1,1,1)),f.x),f.y),f.z); }`;
export function macro(m, strength = 1, wet = true) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP; varying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvObjP = transformed;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP; varying vec3 vWP;' + MACRO)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float mN = mn3(vObjP * 0.13) * 0.6 + mn3(vObjP * 0.47 + 3.1) * 0.4;
        diffuseColor.rgb *= mix(${(1 - 0.2 * strength).toFixed(3)}, ${(1 + 0.12 * strength).toFixed(3)}, mN);
        float wetK = ${wet ? '1.0' : '0.0'} * (1.0 - smoothstep(0.35, 1.25, vWP.y)) * step(-4.0, vWP.y);
        diffuseColor.rgb *= mix(1.0, 0.55, wetK);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.18, wetK);`);
  };
  m.customProgramCacheKey = () => 'macro' + strength + wet;
  return m;
}

export async function initMaterials(onProgress) {
  Object.assign(TEX, await generateTextures(onProgress));
  // Cubey - cement cubes in subtly different pours
  MAT.cement = std(TEX.concrete, { color: 0xd9d6cf, ns: 1.2 });
  MAT.cementLight = std(TEX.concrete, { color: 0xf0ede6, ns: 1.2 });
  MAT.cementDark = std(TEX.concrete, { color: 0xa9a59d, ns: 1.3 });
  MAT.cementWarm = std(TEX.concrete, { color: 0xd8cbb8, ns: 1.2 });
  MAT.rebar = std(TEX.iron, { color: 0xb07a55, metal: 0.8, rough: 0.9 });

  // World surfaces
  MAT.flagstone = std(TEX.flagstone, { color: 0xe8dccb, ns: 1.4 });
  MAT.brick = std(TEX.brick, { color: 0xe6d2b8, ns: 1.4 });
  MAT.brickDark = std(TEX.brick, { color: 0x9c8f82, ns: 1.4 });
  MAT.cobble = std(TEX.cobble, { color: 0xd8cbbb, ns: 1.5 });
  MAT.planks = std(TEX.planks, { color: 0xffffff, ns: 1.2 });
  MAT.wood = std(TEX.wood, { color: 0xb88a62 });
  MAT.woodDark = std(TEX.wood, { color: 0x6e4c34 });
  MAT.woodHull = std(TEX.planks, { color: 0x9a6a48, ns: 1.3 });
  MAT.woodRed = std(TEX.planks, { color: 0xc14a37, ns: 1 });
  MAT.iron = std(TEX.iron, { color: 0xffffff, metal: 0.85, rough: 1, ns: 1 });
  MAT.ironDark = std(TEX.iron, { color: 0x8a8a8a, metal: 0.8, rough: 1 });
  MAT.brass = std(TEX.brass, { color: 0xffffff, metal: 1, rough: 1, env: 1.3 });
  MAT.copper = std(TEX.brass, { color: 0xe8a080, metal: 1, rough: 1 });
  MAT.roof = std(TEX.roof, { color: 0xffffff, ns: 1.5 });
  MAT.roofBlue = std(TEX.roof, { color: 0x7aa6c8, ns: 1.5 });
  MAT.plaster = std(TEX.plaster, { color: 0xfff4e2 });
  MAT.plasterBlue = std(TEX.plaster, { color: 0xb9d8e8 });
  MAT.plasterPeach = std(TEX.plaster, { color: 0xffc9a8 });
  MAT.plasterMint = std(TEX.plaster, { color: 0xc6e8cf });
  MAT.plasterYellow = std(TEX.plaster, { color: 0xffe3a0 });
  MAT.rock = std(TEX.rock, { color: 0xcfc2b0, ns: 1.6 });
  MAT.rockDark = std(TEX.rock, { color: 0x8f8579, ns: 1.6 });
  MAT.grass = std(TEX.grass, { color: 0xffffff });
  MAT.sand = std(TEX.sand, { color: 0xffffff });
  MAT.dirt = std(TEX.dirt, { color: 0xffffff });
  MAT.rope = std(TEX.rope, { color: 0xffffff });
  MAT.canvas = std(TEX.canvas, { color: 0xfff8ea, side: T.DoubleSide, physical: true, sheen: 0.4 });
  MAT.canvasRed = std(TEX.canvas, { color: 0xd8513c, side: T.DoubleSide, physical: true, sheen: 0.4 });
  MAT.canvasStripe = std(TEX.canvas, { color: 0x3b8bb5, side: T.DoubleSide });
  MAT.paintRed = std(TEX.paint, { color: 0xc8402e, rough: 1, physical: true, clearcoat: 0.3 });
  MAT.paintTeal = std(TEX.paint, { color: 0x2f8f8a, rough: 1, physical: true, clearcoat: 0.3 });
  MAT.paintYellow = std(TEX.paint, { color: 0xf0b030, rough: 1, physical: true, clearcoat: 0.3 });
  MAT.paintDark = std(TEX.paint, { color: 0x3b4048, rough: 1 });
  MAT.paintWhite = std(TEX.paint, { color: 0xf2efe8, rough: 1 });
  MAT.plate = std(TEX.plate, { color: 0x9aa3ad, metal: 0.7, rough: 1, ns: 1.2 });
  MAT.plateRust = std(TEX.plate, { color: 0xb07050, metal: 0.6, rough: 1 });
  MAT.black = new T.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.6 });
  MAT.bore = new T.MeshStandardMaterial({ color: 0x050505, roughness: 1, metalness: 0 });

  // Emissive / special
  MAT.window = new T.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xffb04a, emissiveIntensity: 1.6, roughness: 0.3 });
  MAT.windowDark = new T.MeshPhysicalMaterial({ color: 0x1b2a33, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5, clearcoat: 1 });
  MAT.lamp = new T.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb84d, emissiveIntensity: 4 });
  MAT.lampOff = new T.MeshStandardMaterial({ color: 0x665544, emissive: 0x221100, emissiveIntensity: 1, roughness: 0.4 });
  MAT.boreGlow = new T.MeshStandardMaterial({ color: 0x401000, emissive: 0xff4a10, emissiveIntensity: 0.45 });
  MAT.ember = new T.MeshStandardMaterial({ color: 0xff7a20, emissive: 0xff5a10, emissiveIntensity: 6 });
  MAT.eyeRed = new T.MeshStandardMaterial({ color: 0xff2a18, emissive: 0xff1a08, emissiveIntensity: 1.6 });
  MAT.eyeAmber = new T.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff8a10, emissiveIntensity: 5 });
  MAT.glass = new T.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.45, envMapIntensity: 2, clearcoat: 1 });
  MAT.gear = new T.MeshStandardMaterial({ color: 0xffd27a, metalness: 1, roughness: 0.22, map: TEX.brass.map, envMapIntensity: 1.6, emissive: 0x3a2000, emissiveIntensity: 0.4 });
  MAT.goldGear = new T.MeshStandardMaterial({ color: 0xffd040, metalness: 1, roughness: 0.12, envMapIntensity: 2, emissive: 0xff9a00, emissiveIntensity: 0.9 });
  MAT.health = new T.MeshStandardMaterial({ color: 0x80ff9a, emissive: 0x20ff60, emissiveIntensity: 2.5, roughness: 0.2 });
  MAT.plateGlowOff = new T.MeshStandardMaterial({ color: 0x552218, emissive: 0xff3a10, emissiveIntensity: 1.5 });
  MAT.plateGlowOn = new T.MeshStandardMaterial({ color: 0x225533, emissive: 0x30ff70, emissiveIntensity: 2.5 });
  MAT.foam = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  MAT.leaf = std(TEX.grass, { color: 0x6fae4a, side: T.DoubleSide });
  MAT.leafDark = std(TEX.grass, { color: 0x4d8a3a, side: T.DoubleSide });
  MAT.palmTrunk = std(TEX.wood, { color: 0x9a7a58 });
  MAT.bolt = new T.MeshStandardMaterial({ color: 0xffe080, emissive: 0xff8a20, emissiveIntensity: 5 });
  MAT.flag = std(TEX.canvas, { color: 0x222831, side: T.DoubleSide });
  MAT.coat = std(TEX.canvas, { color: 0x8e1a1e, side: T.DoubleSide, physical: true, sheen: 0.6, ns: 0.6 });
  MAT.bootLeather = std(TEX.dirt, { color: 0x221a15, rough: 0.5, ns: 0.5, physical: true, clearcoat: 0.25 });
  MAT.parrotRed = new T.MeshStandardMaterial({ color: 0xe0281e, roughness: 0.6 });
  MAT.parrotBlue = new T.MeshStandardMaterial({ color: 0x1e5fd0, roughness: 0.6 });
  MAT.parrotYellow = new T.MeshStandardMaterial({ color: 0xffc21e, roughness: 0.5 });
  MAT.steel = std(TEX.iron, { color: 0xc9ced4, metal: 0.9, rough: 0.75, env: 1.4 });
  { const lt = TEX.rock.map.clone(); lt.needsUpdate = true; lt.repeat.set(0.25, 0.25);
    MAT.lava = new T.MeshStandardMaterial({ color: 0x220800, emissive: 0xff5a12, emissiveIntensity: 2.2, emissiveMap: lt, roughness: 0.6 }); }
  MAT.basalt = std(TEX.rock, { color: 0x4a4440, ns: 1.6 });
  MAT.ruin = std(TEX.brick, { color: 0xb7b59a, ns: 1.6 });
  MAT.ruinMoss = std(TEX.brick, { color: 0x7f9a62, ns: 1.6 });
  MAT.thatch = std(TEX.grass, { color: 0xd8b070, ns: 1.4 });
  MAT.leather = std(TEX.dirt, { color: 0x6a4228, rough: 0.75, ns: 0.6 });
  MAT.leatherDark = std(TEX.dirt, { color: 0x3a2618, rough: 0.7, ns: 0.6 });
  MAT.orcSkin = std({ normalMap: TEX.concrete.normalMap }, { color: 0xa6c43a, rough: 0.55, ns: 0.25, physical: true, sheen: 0.5, clearcoat: 0.08 });
  MAT.orcSkinDark = std({ normalMap: TEX.concrete.normalMap }, { color: 0x8fb032, rough: 0.62, ns: 0.35, physical: true, sheen: 0.4 });
  MAT.hair = std(TEX.wood, { color: 0xc07a44, rough: 0.8 });
  MAT.hairDark = std(TEX.wood, { color: 0x8a5230, rough: 0.8 });
  MAT.ivory = new T.MeshStandardMaterial({ color: 0xf2e8cc, roughness: 0.35 });
  MAT.clothRed = std(TEX.canvas, { color: 0xc8322a });
  MAT.clothBlue = std(TEX.canvas, { color: 0x2c4c7a });
  MAT.clothTan = std(TEX.canvas, { color: 0xb59a6a });
  MAT.eyeYellow = new T.MeshStandardMaterial({ color: 0xffe060, emissive: 0xffb000, emissiveIntensity: 3 });
  MAT.gold = new T.MeshStandardMaterial({ color: 0xffd060, metalness: 1, roughness: 0.25 });
  // world materials get macro variation; character-ish/emissive ones are left alone
  for (const k of ['basalt', 'ruin', 'ruinMoss', 'thatch', 'flagstone', 'brick', 'brickDark', 'cobble', 'planks', 'wood', 'woodDark', 'woodHull', 'roof', 'roofBlue', 'plaster', 'plasterBlue', 'plasterPeach', 'plasterMint', 'plasterYellow', 'rock', 'rockDark', 'grass', 'sand', 'dirt', 'iron', 'ironDark', 'plate', 'plateRust'])
    macro(MAT[k], ['rock', 'rockDark', 'grass', 'dirt', 'cobble', 'flagstone'].includes(k) ? 1.5 : 1);
}
