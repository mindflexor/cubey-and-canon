// Level 2: Palmshade Ruins — jungle beach landing, ruined jungle path, the tide-king gate (heavy plate + target),
// crumbling-pillar river gorge, temple courtyard ambush, slam-raised stairs, target-locked plate lift up the
// stepped pyramid, a vine rail down to the sanctum, and a 3-wave sanctum arena (Treasure Map piece 2).
import * as T from 'three';
import { MAT } from '../materials.js';
import { box, cyl, sph, rbox, xf } from '../geo.js';
import * as KIT from '../kit.js';
import { Plate, Gate, Mover, Rail, Target, SlamSwitch, Chest, Crumble, RiseBlocks, Barricade } from '../entities.js';
import { Bilgebot, Brute, Bomber, Gull, Turret } from '../enemies.js';
import { beginLevel, finishLevel, arena, mapPiece } from '../levelkit.js';

const { quay, deck, railing, hut, palm, rock, rowboat, brazier, banner, torchPost, barrel, decorCrate } = KIT;

export const info = { name: 'Palmshade Ruins', tag: 'Climb the jungle temple of the ancient tide-kings', golden: 3 };

const KEEP_OUT = [[-17, 17, -80, 26], [-6, 12, -113, -78], [-24, 24, -214, -102], [-21, 21, -279, -228], [-23, -13, -181, -169]];

// ---------------------------------------------------------------- ruin helpers
function ruinBlock(K, x, y, z, w, h, d, mat = MAT.ruin, collide = true, o) {
  K.B.box(mat, w, h, d, x, y, z, 0, 2);
  // mossy cap
  K.B.box(MAT.ruinMoss, w + 0.06, 0.12, d + 0.06, x, y + h / 2 + 0.04, z, 0, 2);
  if (collide) K.W.add([x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y + h / 2, z + d / 2], o);
}
function column(K, x, y, z, h, broken = false) {
  K.B.add(xf(rbox(1.1, 0.35, 1.1, 0.06), x, y + 0.17, z), MAT.ruin, 1.5);
  K.B.add(xf(cyl(0.38, 0.42, h, 14), x, y + 0.35 + h / 2, z, broken ? 0.06 : 0, 0, broken ? 0.05 : 0), MAT.ruin, 'keep');
  if (!broken) K.B.add(xf(rbox(1.0, 0.3, 1.0, 0.05), x, y + 0.5 + h, z), MAT.ruinMoss, 1.5);
  else K.B.add(xf(rbox(0.8, 0.5, 0.7, 0.06), x + 1.1, y + 0.25, z + 0.4, 0.3, 0.6, 0.4), MAT.ruin, 1.5);
  K.W.add([x - 0.45, y, z - 0.45], [x + 0.45, y + h + (broken ? 0.3 : 0.65), z + 0.45], { cam: false });
}
// big moss-covered tide-king stone head
function kingHead(K, x, y, z, s = 1, ry = 0) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c * s + lz * sn * s, y + ly * s, z - lx * sn * s + lz * c * s];
  const put = (g, mat, lx, ly, lz) => { const p = P(lx, ly, lz); K.B.add(xf(g, p[0], p[1], p[2], 0, ry, 0, s), mat, 2); };
  put(rbox(3.2, 3.8, 2.6, 0.25), MAT.ruin, 0, 1.9, 0);
  put(rbox(3.6, 0.6, 0.6, 0.15), MAT.ruinMoss, 0, 3.0, 1.2);          // brow
  put(rbox(0.8, 1.5, 0.9, 0.2), MAT.ruin, 0, 2.0, 1.5);               // nose
  put(rbox(2.4, 0.4, 0.5, 0.12), MAT.ruinMoss, 0, 0.8, 1.35);         // lips
  for (const sx of [-1, 1]) { put(box(0.7, 0.4, 0.2), MAT.black, sx * 0.85, 2.55, 1.32); put(rbox(0.9, 2.6, 0.6, 0.15), MAT.ruinMoss, sx * 1.75, 2.0, 0.2); }
  put(rbox(3.8, 0.9, 3.0, 0.2), MAT.ruinMoss, 0, 4.2, 0);             // headdress
  for (let i = -2; i <= 2; i++) put(rbox(0.5, 1.2, 0.5, 0.12), MAT.ruin, i * 0.75, 5.1, 0.3);
  const e = 1.9 * s; K.W.add([x - e, y, z - e], [x + e, y + 5.5 * s, z + e]);
}
// hanging vines on a wall face
function vines(K, x0, x1, z, yTop, len = 3, n = 6, seed = 1) {
  const r = KIT.mulberry(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), l = len * (0.5 + r() * 0.7);
    K.B.add(xf(cyl(0.03, 0.03, l, 5), x, yTop - l / 2, z), MAT.leafDark, 'keep');
    for (let k = 0; k < l / 0.35; k++) K.B.add(xf(sph(0.11 + r() * 0.06, 6, 4), x + (r() - 0.5) * 0.15, yTop - k * 0.35, z + (r() - 0.5) * 0.15, 0, 0, 0, 1, 0.7, 1), r() < 0.5 ? MAT.leaf : MAT.leafDark, 1);
  }
}
function waterfall(G, x, z, w, h, ry) {
  const wc = document.createElement('canvas'); wc.width = 64; wc.height = 256; const g2 = wc.getContext('2d');
  for (let i = 0; i < 120; i++) { g2.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`; g2.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 10 + Math.random() * 40); }
  const wt = new T.CanvasTexture(wc); wt.wrapS = wt.wrapT = T.RepeatWrapping; wt.repeat.set(3, 2);
  const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: wt, transparent: true, opacity: 0.85, color: 0xd8f4ff, depthWrite: false, side: T.DoubleSide }));
  m.position.set(x, h / 2 - 1.5, z); m.rotation.y = ry; m.userData.noAO = true; G.scene.add(m);
  G.updaters.push((dt, g) => { wt.offset.y += dt * 1.1; if (Math.random() < dt * 5 && g.active.pos.distanceTo(m.position) < 90) g.fx.smoke.emit(x + (Math.random() - 0.5) * w, 0.3, z, 0, 1.5, 0, 3, 2, 0.95, 0.97, 1, { grow: 2, alpha: 0.35 }); });
}

export function build(G) {
  const L = beginLevel(G, {
    seed: 202, keepOut: KEEP_OUT,
    sky: { zenith: 0x3f86c4, horizon: 0xd6e6b4, fog: 0xc9d9a6, sun: 0xffdca0, sunI: 3.4, hemi: 0.95, fogNear: 110, fogFar: 900, water: 0x07524f },
  });
  const { K, E, EN, crate } = L;
  const gorge = [-70, 70, -103, -81, -3.2, 3];

  // ================================================================ ISLANDS
  L.island({ cx: 0, cz: -36, rx: 54, rz: 50, seed: 2.6, peak: 22, flats: [[-15, 15, -76, 6, 2.0, 5], gorge] });
  L.island({ cx: 0, cz: -188, rx: 62, rz: 88, seed: 3.7, peak: 26, cliffs: 2, flats: [[-23, 23, -212, -104, 2.0, 4], [-15, 15, -233, -211, 2.5, 4], [-20, 20, -277, -232, 3.0, 5], gorge] });
  const hAt = L.hAt;
  // give bullseye targets a thin shot-blocking face so the crosshair ray lands on them (no aim parallax)
  const target = (x, y, z, ry, fn) => { const t = E(new Target(G, x, y, z, ry, fn)); G.world.box(x, y + 2.2, z, 1.3, 1.3, 0.35, { walkable: false, cam: false }); return t; };
  // enemies spawn as the heroes approach (keeps far-away rigs out of the frame budget)
  const wave = (x, z, r, fn, yMin) => L.trigger(x, z, r, g => { for (const e of fn()) { g.enemies.push(e); g.fx.puff(e.pos.clone().setY(e.pos.y + 1), 6, 0.8, 1.2, [0.85, 0.85, 0.85]); } }, yMin);

  // ================================================================ 1. BEACH LANDING
  deck(K, -3, 3, 4, 24, 2.0);
  railing(K, [[-2.8, 2.0, 23.8], [-2.8, 2.0, 8]]); railing(K, [[2.8, 2.0, 23.8], [2.8, 2.0, 8]]);
  rowboat(K, 5.5, 0, 18, 0.3, 0.05); rowboat(K, -6, hAt(-9, 10) - 0.15, 10, -0.6, 0.12);
  for (const [x, z] of [[-3.5, 4], [3.5, 4]]) torchPost(K, x, 2.0, z);
  hut(K, -13, hAt(-13, 2), 2, 0.4); hut(K, 14, hAt(14, -2), -2, -0.5);
  crate(-5, 2.0, -3); crate(5.5, 2.0, -6); crate(-1, 2.0, -9);
  // golden gear #1 on a ruined pillar (3.9 m: needs TWO stacked cubes)
  ruinBlock(K, 11, 3.95, -8, 2.2, 3.9, 2.2);
  L.golden(11, 5.9, -8, 'pillar');
  L.hint(0, 18, 4, 'Palmshade Ruins! The orcs here are tougher. Keep both heroes alive and look for TWO-cube climbs.', 'l2intro');
  L.hint(7, -6, 4, 'That pillar is almost 4 m tall. Stack TWO cubes against it with Cubey to reach the top.', 'l2pillar', g => g.active.kind === 'cubey');

  // ================================================================ 2. RUINED JUNGLE PATH
  for (const sx of [-1, 1]) {
    for (let z = -12; z > -46; z -= 6.5) ruinBlock(K, sx * 10.5, 2.0 + 1.4, z, 1.6, 2.8 + ((z * 7) % 3 + 3) % 1.2, 5.2);
    vines(K, sx * 9.6, sx * 9.8, -20, 4.8, 2.5, 5, sx + 10);
  }
  for (const [x, z, b] of [[-6.5, -16, false], [6.5, -22, true], [-6.5, -30, true], [6.5, -36, false]]) column(K, x, 2.0, z, 4.2, b);
  ruinBlock(K, 8, 3.2, -37, 4, 2.4, 6); // bomber perch (top 4.4)
  wave(0, -6, 8, () => [new Bilgebot(G, 2, 2.0, -24), new Bilgebot(G, -3, 2.0, -30), new Bilgebot(G, 1, 2.0, -38), new Bomber(G, 8, 4.4, -37)]);
  crate(-5, 2.0, -14); crate(4.5, 2.0, -19); crate(-6, 2.0, -41, 'health');
  L.checkpoint(0, 2.0, -12);
  L.hint(0, -22, 6, 'Orc BOMBERS lob explosives from range. Watch for the red circles and keep moving!', 'bomber');

  // ================================================================ 3. TIDE-KING GATE (heavy plate + target on the wall)
  for (const [x0, x1] of [[-16, -3.2], [3.2, 16]]) ruinBlock(K, (x0 + x1) / 2, 2.0 + 2.1, -70, x1 - x0, 4.2, 2);
  ruinBlock(K, 0, 6.6, -70, 7, 1.2, 2.2); // lintel over the gate
  kingHead(K, -11, 6.2, -70.2, 0.8, 0); kingHead(K, 11, 6.2, -70.2, 0.8, 0);
  for (const x of [-5, 5]) banner(K, x, 6.0, -68.95, 0, 3.0, MAT.canvasStripe);
  const heavy = E(new Plate(G, -6, 2.0, -62, 2));
  const gateTarget = target(6.0, 6.2, -70.2, 0, g => g.hint('Target hit! Now weigh down the heavy plate.', 3, 'gt'));
  const tgtLock = { get on() { return gateTarget.done; } };
  const gate = E(new Gate(G, 0, 2.0, -70, 6, 4.0, [heavy, tgtLock]));
  gate.onOpen = () => { G.objective('Cross the river gorge'); G.hint('The tide-king gate is open!', 3, 'l2gate'); };
  for (const [x, z] of [[-11, -58], [11, -58], [-11, -66], [11, -66]]) brazier(K, x, 2.0, z);
  L.trigger(0, -52, 6, g => g.objective('Open the tide-king gate'));
  L.hint(0, -56, 7, 'The gate needs the HEAVY plate (2 cubes) AND the target on the wall shot by Canon.', 'l2gatehint');
  L.checkpoint(0, 2.0, -50);
  wave(0, -46, 8, () => [new Bilgebot(G, 5, 2.0, -60), new Bilgebot(G, -5, 2.0, -64), new Gull(G, -4, 8, -64)]);

  // ================================================================ 4. RIVER GORGE (crumbling pillars)
  quay(K, -4, 4, -80, -71, 2.0, { topMat: MAT.ruin, wallMat: MAT.ruin, coping: false });
  const crumbles = [[0, -83.2], [-1.5, -87.6], [0.5, -92], [-1, -96.4], [0.5, -100.8]];
  for (const [x, z] of crumbles) {
    E(new Crumble(G, x, 2.0, z, 2.2, 2.2, MAT.ruin));
    K.B.add(xf(cyl(0.7, 0.9, 4.4, 10), x, -1.0, z), MAT.ruinMoss, 'keep'); // pillar (visual only, sunk below the slab)
  }
  // golden gear #2: side branch off the third pillar
  E(new Crumble(G, 5, 2.0, -92, 2.2, 2.2, MAT.ruin));
  K.B.add(xf(cyl(0.7, 0.9, 4.4, 10), 5, -1.0, -92), MAT.ruinMoss, 'keep');
  ruinBlock(K, 9.2, 0.0, -92, 3.2, 6.0, 3.2);
  L.golden(9.2, 3.0, -92, 'gorge');
  quay(K, -4, 4, -110, -103, 2.0, { topMat: MAT.ruin, wallMat: MAT.ruin, coping: false });
  waterfall(G, -26, -92, 12, 16, Math.PI / 2); waterfall(G, 30, -94, 10, 14, -Math.PI / 2);
  L.hint(0, -76, 4, 'These old pillars CRUMBLE when you stand on them. Keep moving!', 'crumble');
  L.checkpoint(0, 2.0, -106);
  wave(0, -76, 6, () => [new Gull(G, 3, 7, -95), new Gull(G, -4, 8, -100)]);

  // ================================================================ 5. TEMPLE COURTYARD AMBUSH
  for (const [x, z, w] of [[-7, -118, 3.5], [6, -122, 3.5], [-2, -128, 4], [8, -133, 2.5], [-9, -134, 2.5]]) ruinBlock(K, x, 2.6, z, w, 1.2, 0.9);
  for (const [x, z] of [[-14, -112], [14, -112], [-14, -128], [14, -128]]) column(K, x, 2.0, z, 5, Math.abs(z) % 3 < 1);
  quay(K, -18, -10, -140, -132, 5.2, { topMat: MAT.ruin, wallMat: MAT.ruin, coping: false }); // turret balcony
  EN(new Turret(G, -14, 5.2, -135.5, 0));
  wave(0, -104, 7, () => [new Bilgebot(G, 3, 2.0, -120), new Bilgebot(G, -4, 2.0, -124), new Bomber(G, 9, 2.0, -136), new Brute(G, 0, 2.0, -136)]);
  crate(10, 2.0, -116); crate(-11, 2.0, -120, 'boom'); crate(12, 2.0, -124);
  L.trigger(0, -110, 6, g => g.objective('Fight through the temple courtyard'));
  L.hint(0, -114, 5, 'A BRUTE! Its plank shield blocks cannonballs from the front. Use a heavy shot, flank it, or ground-slam it with Cubey.', 'brute1');

  // ================================================================ 6. TERRACE + SLAM-RAISED STAIRS
  quay(K, -23, 23, -212, -150, 7.5, { topMat: MAT.ruin, wallMat: MAT.ruin, coping: false });
  vines(K, -22, -3, -149.9, 7.4, 4, 14, 3); vines(K, 3, 22, -149.9, 7.4, 4, 14, 4);
  kingHead(K, -14, 2.0, -147.5, 0.9, 0); kingHead(K, 14, 2.0, -147.5, 0.9, 0);
  const steps = [];
  for (let i = 0; i < 5; i++) { const top = 3.1 + i * 1.1; steps.push([0, top, -143.7 - i * 1.4, 3, top - 1.5, 1.4]); }
  const stair = E(new RiseBlocks(G, steps, MAT.ruin));
  // the stomp switch is sealed in an alcove behind a wooden barricade (Canon first, then Cubey)
  ruinBlock(K, -10.8, 3.6, -146, 0.6, 3.2, 6); ruinBlock(K, -5.2, 3.6, -146, 0.6, 3.2, 6);
  E(new SlamSwitch(G, -8, 2.0, -146, g => { stair.trigger(); g.objective('Climb the temple stairs'); g.hint('Stone stairs rise from the ground!', 3, 'stairs'); }));
  E(new Barricade(G, -8, 2.0, -142.6, 4.6, 3.0, false, 0));
  L.hint(0, -140, 6, 'The terrace is too tall to climb. Something in that sealed alcove might help: break in with Canon, then ground-slam with Cubey.', 'l2stairs');
  L.trigger(0, -141, 5, g => g.objective('Find a way up to the temple terrace'));
  L.checkpoint(0, 7.5, -153.5);

  // ================================================================ 7. STEPPED PYRAMID + TARGET-LOCKED PLATE LIFT
  ruinBlock(K, 0, 5.75, -208.5, 32, 8.5, 21, MAT.ruin);            // tier 1 (top 10)
  ruinBlock(K, 0, 7.5 + 2.5, -207, 22, 5.0, 16, MAT.ruinMoss);      // tier 2 (top 12.5)
  ruinBlock(K, 0, 7.5 + 3.75, -203, 12, 7.5, 16, MAT.ruin);        // summit (top 15)
  for (const x of [-4.5, 4.5]) { brazier(K, x, 15, -198); banner(K, x * 2, 12.3, -198.9, 0, 2.2, MAT.canvasRed); }
  kingHead(K, 0, 15, -208, 0.7, 0);
  const liftPlate = E(new Plate(G, 7, 7.5, -186, 2));
  const liftTarget = target(-13, 10, -198.6, 0, g => g.hint('The lift lock is broken! Now the lift needs weight on its plate.', 4, 'lt'));
  // the lift only climbs while it is unlocked, the plate is weighted, and a hero is riding it
  let lift = null; const riding = () => lift && G.heroes.some(h => h.body.ground === lift.solid || (h.body.grounded && Math.abs(h.pos.x) < 2 && Math.abs(h.pos.z + 192.5) < 2 && h.pos.y > 7.4));
  lift = E(new Mover(G, [0, 7.4, -192.5], [0, 15, -192.5], 4, 4, 4.5, { kind: 'lift', control: () => liftPlate.on && liftTarget.done && riding() }));
  for (const sx of [-1, 1]) { K.B.add(xf(box(0.3, 8.2, 0.3), sx * 2.3, 11.6, -190.3), MAT.woodDark, 1); K.B.add(xf(box(0.3, 8.2, 0.3), sx * 2.3, 11.6, -194.7), MAT.woodDark, 1); }
  K.B.add(xf(cyl(0.4, 0.4, 5.2, 12), 0, 16.2, -192.5, 0, 0, Math.PI / 2), MAT.woodDark, 'keep');
  L.hint(0, -168, 8, 'A rope lift! It is locked by a target up on the pyramid AND needs a HEAVY load on its plate.', 'l2lift');
  L.trigger(0, -160, 6, g => g.objective('Ride the lift to the pyramid summit'));
  wave(0, -153, 8, () => [new Brute(G, -6, 7.5, -178), new Bilgebot(G, 8, 7.5, -170), new Bomber(G, 13, 10, -201), new Gull(G, 6, 13, -180), new Gull(G, -6, 14, -186)], 6.5);
  crate(-18, 7.5, -158); crate(18, 7.5, -165, 'health'); crate(16, 7.5, -196);
  // golden gear #3: shrine sealed by an IRON barricade (heavy shot)
  ruinBlock(K, -18.5, 9.3, -170.9, 5.2, 3.6, 0.6); ruinBlock(K, -18.5, 9.3, -179.1, 5.2, 3.6, 0.6); ruinBlock(K, -20.6, 9.3, -175, 0.6, 3.6, 8.8);
  ruinBlock(K, -18.5, 11.3, -175, 5.6, 0.4, 9.0, MAT.ruinMoss);
  E(new Barricade(G, -15.6, 7.5, -175, 4.4, 3.0, true, Math.PI / 2));
  L.golden(-18.6, 7.5, -175, 'shrine');

  // ================================================================ 8. VINE RAIL DOWN TO THE SANCTUM
  G.rails.push(new Rail(G, [[0, 15.7, -205.5], [0, 15.4, -210.5], [4, 13.2, -222], [6, 9.5, -232], [2, 5.8, -242], [0, 4.1, -248], [0, 4.0, -251]]));
  L.hint(0, -200, 3, 'JUMP onto the vine-wrapped rail to grind down to the sanctum.', 'l2rail');

  // ================================================================ 9. SANCTUM ARENA
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; column(K, Math.cos(a) * 15, 3.0, -256 + Math.sin(a) * 15, 6, i % 4 === 1); }
  kingHead(K, 0, 3.0, -275, 1.4, 0);
  ruinBlock(K, 0, 3.4, -268, 4, 0.8, 3, MAT.ruinMoss);
  for (const [x, z] of [[-6, -262], [6, -262], [-9, -246], [9, -246]]) brazier(K, x, 3.0, z);
  L.checkpoint(0, 3.0, -250.5);
  crate(-10, 3.0, -262, 'health'); crate(11, 3.0, -254);
  arena(G, L, {
    x: 0, z: -254, r: 7, yMin: 2.5, title: 'Sanctum wave',
    onStart: g => { g.objective('Defeat the temple raiders'); g.hud.banner('The Sanctum', 'Defend the tide-king’s altar'); },
    waves: [
      () => [new Bilgebot(G, -7, 3, -262), new Bilgebot(G, 7, 3, -262), new Bilgebot(G, 0, 3, -268), new Bomber(G, 10, 3, -270)],
      () => [new Brute(G, 0, 3, -266), new Bilgebot(G, -9, 3, -258), new Bilgebot(G, 9, 3, -258), new Gull(G, -5, 9, -260), new Gull(G, 5, 9, -260)],
      () => [new Brute(G, -6, 3, -266), new Bomber(G, -11, 3, -270), new Bomber(G, 11, 3, -270), new Bilgebot(G, 4, 3, -262), new Bilgebot(G, -4, 3, -258)],
    ],
    onDone: g => { g.objective('Take the treasure map piece'); g.hud.banner('Sanctum cleared!', 'The map piece lies on the altar'); mapPiece(g, L, 0, 3.8, -268, 'Treasure Map Piece 2'); },
  });

  // ================================================================ DRESSING
  for (const [x, z] of [[-24, -40], [24, -30], [-22, -60], [22, -56]]) { rock(K, x, hAt(x, z), z, 2.5, 2, 2.5, x * z, MAT.rockDark); }
  for (const [x, z] of [[-12, -25], [12, -14], [-13, -44]]) { barrel(K, x * 0.6, 2.0, z); decorCrate(K, x * 0.62, 2.0, z - 1.4, 1.0, 0.3); }
  for (const [x, z] of [[-26, -150], [26, -150], [-25, -180], [25, -185]]) kingHead(K, x, hAt(x, z), z, 0.7, x < 0 ? 0.5 : -0.5);
  for (const [x, z] of [[-30, -120], [30, -115], [-28, -235], [28, -240]]) palm(K, x, hAt(x, z), z, 8, 0.4);
  { const cx = -6, cz = -4; const chest = E(new Chest(G, cx, 2.0, cz - 2.4, 0.3, 30)); E(new SlamSwitch(G, cx, 2.0, cz + 0.4, () => chest.unlock())); }

  finishLevel(G, L, {
    foliageExtra: F => {
      for (const sx of [-1, 1]) F.edge(sx * 9.6, -10, sx * 9.6, -46, 2.0, 4);
      F.edge(-16, -68.9, -3.4, -68.9, 2.0, 4); F.edge(3.4, -68.9, 16, -68.9, 2.0, 4);
      F.edge(-22, -149.7, 22, -149.7, 2.0, 3);
      F.edge(-22, -151, 22, -151, 7.5, 2.5);
      for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; F.edge(Math.cos(a) * 16.5, -256 + Math.sin(a) * 16.5, Math.cos(a + 0.2) * 16.5, -256 + Math.sin(a + 0.2) * 16.5, 3.0, 4, 0.6); }
      F.bushes([[-8, 2.0, -48, 1.1], [8, 2.0, -48, 1.0], [-14, 2.0, -100, 1.2], [-20, 7.5, -158, 1.2], [20, 7.5, -205, 1.3], [-17, 3, -240, 1.2], [17, 3, -238, 1.1]]);
    },
  });
  G.objective('Explore Palmshade Ruins');
  return { start: { x: 0, y: 2.0, z: 19 } };
}
