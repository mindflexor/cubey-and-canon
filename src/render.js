import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TEX } from './materials.js';
import { Water } from 'three/addons/objects/Water.js';
import { ISLANDS, COAST_GLSL } from './islands.js';

const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`;
const SKY_FS = `
varying vec3 vDir;
uniform vec3 sunDir, zenith, horizon, ground, sunCol; uniform float time;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(horizon, zenith, pow(clamp(h,0.,1.), .5));
  col = mix(col, ground, smoothstep(0.0, -0.2, h));
  float sd = max(dot(d, sunDir), 0.);
  col += sunCol * (pow(sd, 1400.) * 40. + pow(sd, 18.) * .45 + pow(sd, 4.) * .18);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + .1) * .9 + vec2(time * .006, time * .002);
    float c = fbm(uv * 1.3) * .65 + fbm(uv * 4.1) * .35;
    float cov = smoothstep(.48, .78, c) * smoothstep(0.0, .18, h);
    float lit = fbm(uv * 1.3 + sunDir.xz * .12);
    vec3 cc = mix(vec3(1.05, 1.02, .98), vec3(.62, .68, .8), smoothstep(.35,.75,lit) * .7);
    cc += sunCol * pow(sd, 5.) * .6;
    col = mix(col, cc * 1.4, cov * .92);
  }
  gl_FragColor = vec4(col, 1.);
}`;

export const MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
export function createRenderer(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2400);

  // sky
  const sunDir = new T.Vector3(-0.5, 0.62, -0.6).normalize();
  const skyU = {
    sunDir: { value: sunDir }, zenith: { value: new T.Color(0x1f6fe0) }, horizon: { value: new T.Color(0xbfe8f2) },
    ground: { value: new T.Color(0x6d9ab8) }, sunCol: { value: new T.Color(1.0, 0.86, 0.62) }, time: { value: 0 },
  };
  const skyMat = new T.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, fog: false });
  const sky = new T.Mesh(new T.SphereGeometry(900, 48, 24), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;

  // environment map from the sky for reflections
  const pmrem = new T.PMREMGenerator(renderer);
  const envScene = new T.Scene(); envScene.add(sky);
  const env = pmrem.fromScene(envScene, 0.02, 1, 2000).texture;
  envScene.remove(sky);
  scene.add(sky);
  scene.environment = env;
  const refreshEnv = () => { scene.remove(sky); sky.position.set(0, 0, 0); envScene.add(sky); const old = scene.environment; scene.environment = pmrem.fromScene(envScene, 0.02, 1, 2000).texture; old?.dispose?.(); envScene.remove(sky); scene.add(sky); };
  scene.environmentIntensity = 0.85;
  scene.fog = new T.Fog(0xbfe8f2, 180, 1300);

  const hemi = new T.HemisphereLight(0xc4e2ff, 0x9a7a52, 0.8);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffdcb0, 3.7);
  sun.position.copy(sunDir).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // ocean: three.js Water (jbouny/ocean, MIT) with real planar reflections + tropical shallows patch
  const ocean = makeWater(sunDir, scene);

  // post
  const rt = new T.WebGLRenderTarget(innerWidth, innerHeight, { type: T.HalfFloatType, samples: MOBILE ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.7;
  ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.2, thickness: 1, scale: 1, samples: 12, distanceFallOff: 1 });
  // keep the sky dome, ocean and transparent FX out of the AO depth/normal pass
  const noAO = o => o === sky || o === ocean.mesh || o.userData.noAO || (o.material && o.material.transparent);
  const ov = ao._overrideVisibility.bind(ao), rv = ao._restoreVisibility.bind(ao), hidden = [];
  ao._overrideVisibility = () => { ov(); scene.traverse(o => { if (o.visible && noAO(o)) { hidden.push(o); o.visible = false; } }); };
  ao._restoreVisibility = () => { rv(); for (const o of hidden) o.visible = true; hidden.length = 0; };
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
  if (!MOBILE) composer.addPass(ao);
  const bloom = new UnrealBloomPass(new T.Vector2(innerWidth / 2, innerHeight / 2), 0.42, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, vig: { value: 0.22 }, flash: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, vig, flash; varying vec2 vUv;
      void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,sat);
      c=(c-.5)*1.04+.5; float v=smoothstep(.95,.25,length((vUv-.5)*vec2(1.15,1.))); c*=mix(1.-vig,1.,v);
      c=mix(c, vec3(1.,.35,.25), flash*(1.-v)*.8); gl_FragColor=vec4(c,1.); }`,
  });
  composer.addPass(grade);

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  return {
    renderer, scene, camera, composer, sun, sky, skyU, ocean, grade, bloom, ao, refreshEnv,
    update(dt, focus, t) {
      skyU.time.value = t;
      sky.position.copy(camera.position);
      sun.position.copy(focus).addScaledVector(sunDir, 90);
      sun.target.position.copy(focus);
      // stabilize shadow map texels
      ocean.update(dt, camera.position, t);
    },
    render() { composer.render(); },
  };
}

function makeWater(sunDir, scene) {
  const normals = new T.TextureLoader().load('./textures/waternormals.jpg', t => { t.wrapS = t.wrapT = T.RepeatWrapping; });
  normals.wrapS = normals.wrapT = T.RepeatWrapping;
  const geo = new T.PlaneGeometry(6000, 6000);
  const water = new Water(geo, {
    textureWidth: MOBILE ? 256 : 512, textureHeight: MOBILE ? 256 : 512, waterNormals: normals, sunDirection: sunDir.clone(),
    sunColor: 0xfff2d8, waterColor: 0x064a63, distortionScale: 2.6, fog: true, alpha: 1,
  });
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0, -150);
  water.material.uniforms.size.value = 1.6;
  const U = water.material.uniforms;
  U.uIsl = { value: Array.from({ length: 16 }, () => new T.Vector4(0, 0, 0, 0)) };
  U.uSeed = { value: new Float32Array(16) };
  water.material.fragmentShader = water.material.fragmentShader
    .replace('varying vec4 worldPosition;', 'varying vec4 worldPosition;\nuniform vec4 uIsl[16]; uniform float uSeed[16];' + COAST_GLSL)
    .replace('vec3 outgoingLight = albedo;', `
      float eMin = 99.0;
      for (int i = 0; i < 16; i++) { if (uIsl[i].z <= 0.0) continue; eMin = min(eMin, islandE(worldPosition.xz, uIsl[i], uSeed[i])); }
      float shallow = 1.0 - smoothstep(1.0, 1.55, eMin);
      vec3 lagoon = mix(vec3(0.05, 0.42, 0.52), vec3(0.22, 0.86, 0.80), smoothstep(1.5, 1.02, eMin));
      vec3 shallowCol = lagoon * (0.55 + 0.6 * diffuseLight) + specularLight * 0.6 + reflectionSample * 0.12;
      albedo = mix(albedo, shallowCol, shallow * (1.0 - reflectance * 0.55));
      float surfN = getNoise(worldPosition.xz * 2.0).x;
      float band = 0.03 + 0.012 * sin(time * 1.3 + eMin * 40.0);
      float foam = smoothstep(band + 0.03, band, abs(eMin - 1.0 - 0.025 - 0.015 * sin(time * 0.9 + worldPosition.x * 0.08)) ) * smoothstep(-0.6, 0.4, surfN + 0.2);
      foam += smoothstep(0.06, 0.0, abs(eMin - 1.09 - 0.02 * sin(time * 0.7))) * 0.35 * smoothstep(0.0, 0.5, surfN + 0.3);
      albedo = mix(albedo, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
      vec3 outgoingLight = albedo;`);
  scene.add(water);
  // Hide small dynamic clutter from the reflection pass to keep it cheap
  const orig = water.onBeforeRender;
  water.onBeforeRender = function (renderer, sc, cam, ...rest) {
    const hidden = [];
    sc.traverse(o => { if (o.visible && (o.isPoints || o.isInstancedMesh || o.userData.noReflect)) { hidden.push(o); o.visible = false; } });
    orig.call(this, renderer, sc, cam, ...rest);
    for (const o of hidden) o.visible = true;
  };
  return {
    mesh: water, level: 0,
    syncIslands() { ISLANDS.slice(0, 16).forEach((I, i) => { U.uIsl.value[i].set(I.cx, I.cz, I.rx, I.rz); U.uSeed.value[i] = I.seed; }); water.material.needsUpdate = true; },
    update(dt, cam, t) { U.time.value = t * 0.6; },
  };
}
