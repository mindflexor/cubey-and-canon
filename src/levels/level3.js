// Level 3: Smuggler's Reef — crumbling wreck planks, a split-islet sea-gate puzzle, a target-raised sea cave,
// the smugglers' cliff camp (iron barricade + plate lift + slam stairs), a zipline, a raft chain under fire,
// and a beached-galleon arena (Treasure Map piece 3). Golden-hour lighting.
import * as T from 'three';
import { MAT } from '../materials.js';
import { cyl, xf, sagRope } from '../geo.js';
import * as KIT from '../kit.js';
import { Barricade, Plate, Gate, Mover, Rail, Target, SlamSwitch, Crumble, RiseBlocks, Chest } from '../entities.js';
import { Bilgebot, Brute, Bomber, Gull, Turret } from '../enemies.js';
import { beginLevel, finishLevel, arena, mapPiece } from '../levelkit.js';

const { quay, deck, stairs, railing, rock, ship, palm, hut, rowboat, driftwood, torchPost, barrel, decorCrate, lanternString, brazier, banner, tower, ropeCoil, prism } = KIT;

export const info = { name: "Smuggler's Reef", tag: 'Brave the wreck-strewn reef and the smugglers’ caves', golden: 3 };

const KEEP_OUT = [[-10, 10, -16, 20], [-12, 12, -82, -49], [17, 27, -78, -68], [-10, 10, -144, -78], [-17, 17, -190, -134], [-16, 16, -286, -208]];

// Bomber that stays on its rock pillar (it may turn and throw, but won't walk off into the sea)
class PostBomber extends Bomber {
  update(dt) {
    const x = this.body.pos.x, z = this.body.pos.z;
    super.update(dt);
    if (!this.dead && Math.hypot(this.body.pos.x - this.home.x, this.body.pos.z - this.home.z) > 0.7) { this.body.pos.x = x; this.body.pos.z = z; this.body.vel.x = this.body.vel.z = 0; this.root.position.copy(this.body.pos); }
  }
}

// Canvas smuggler tent (A-frame)
function tent(K, x, y, z, ry = 0, mat = MAT.canvas) {
  K.B.add(xf(prism(3.2, 1.5, 1.9), x, y, z, 0, ry, 0), mat, 1.5);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const l of [-1.7, 1.7]) K.B.add(xf(cyl(0.05, 0.05, 2.1, 6), x + s * l, y + 1.05, z + c * l), MAT.woodDark, 'keep');
  K.B.add(xf(cyl(0.04, 0.04, 3.6, 5), x, y + 1.95, z, Math.PI / 2, ry, 0), MAT.woodDark, 'keep');
  const e = Math.abs(c) > 0.7 ? [1.5, 1.7] : [1.7, 1.5];
  K.W.add([x - e[0], y, z - e[1]], [x + e[0], y + 1.6, z + e[1]], { walkable: false });
}
// Rock pillar rising out of the sea with a stone cap you can stand on
function pillar(K, x0, x1, z0, z1, top, seed) {
  quay(K, x0, x1, z0, z1, top, { topMat: MAT.rock, wallMat: MAT.rockDark, coping: false });
  rock(K, (x0 + x1) / 2, top * 0.35, (z0 + z1) / 2, (x1 - x0) * 0.75, top * 0.55, (z1 - z0) * 0.75, seed, MAT.rockDark);
}

export function build(G) {
  const L = beginLevel(G, {
    seed: 303, keepOut: KEEP_OUT,
    sky: { zenith: 0x2a4f9a, horizon: 0xffb27a, fog: 0xf2b08a, ground: 0x6a6f8a, sun: 0xffb066, sunI: 3.1, hemi: 0.7, water: 0x0a3a52, fogNear: 150, fogFar: 1100 },
  });
  const { K, E, EN, crate } = L;
  const W = G.world;

  // ================================================================ ISLANDS
  L.island({ cx: 0, cz: 4, rx: 24, rz: 18, seed: 3.1, peak: 6, flats: [[-9, 9, -12, 18, 1.4, 4], [-15, 15, -36, -15, -2.4, 2]] });
  L.island({ cx: 0, cz: -66, rx: 20, rz: 17, seed: 3.7, peak: 4, hills: 0.5, flats: [[-11, 11, -80, -52, 1.5, 3], [-15, 15, -48, -30, -2.4, 3], [13, 32, -84, -60, -2.4, 2], [-15, 15, -100, -82, -2.4, 2]] });
  L.island({ cx: 0, cz: -160, rx: 28, rz: 26, seed: 3.3, peak: 9, cliffs: 3, flats: [[-14, 14, -174, -136, 5.0, 4], [-15, 15, -134, -96, -2.4, 3], [-10, 10, -200, -183, -2.4, 3]] });
  L.island({ cx: 0, cz: -265, rx: 26, rz: 22, seed: 3.9, peak: 2, hills: 0.3, flats: [[-14, 14, -282, -248, 0.6, 3], [-15, 15, -248, -212, -2.4, 3]] });
  // reef framing islets
  L.island({ cx: -46, cz: -110, rx: 18, rz: 26, seed: 4.4, peak: 12 });
  L.island({ cx: 48, cz: -190, rx: 20, rz: 24, seed: 4.8, peak: 10 });
  L.island({ cx: 40, cz: -40, rx: 14, rz: 12, seed: 5.2, peak: 5 });
  const hAt = L.hAt;

  // ================================================================ 1. LANDING SANDBAR
  L.hint(0, 12, 4, "Smuggler's Reef! Old wreck planks CRUMBLE a moment after you land on them, so keep moving.", 'crumble');
  L.trigger(0, 10, 6, g => g.objective('Cross the wreck field to the smugglers’ islet'));
  rowboat(K, -6, hAt(-6, 15) - 0.1, 15, 0.4, 0.12); rowboat(K, 6.5, hAt(6.5, 16) - 0.1, 16, -0.6, -0.1);
  tent(K, -6, 1.4, 4, 0.2); hut(K, 7, 1.4, 6, -0.3);
  for (const [x, z] of [[-4, -4], [4, -6]]) torchPost(K, x, 1.4, z);
  for (const [x, z, s] of [[-7.5, -2, 1.1], [-7.4, -3.3, 0.9], [7.6, -1, 1]]) decorCrate(K, x, 1.4, z, s, x * 0.3);
  barrel(K, -2.8, 1.4, 8); barrel(K, -2.2, 1.4, 9, 0.9); ropeCoil(K, 2.5, 1.4, 9);
  crate(3, 1.4, 2); crate(-3, 1.4, -2); crate(5.5, 1.4, -8, 'boom');
  EN(new Bilgebot(G, 2, 1.4, -6));
  deck(K, -2, 2, -15, -9, 1.4);
  // crumbling wreck planks out to the first hull
  for (const [x, z] of [[0, -18], [1.5, -22.4], [-0.5, -26.8], [0.5, -30.6]]) {
    E(new Crumble(G, x, 1.4, z, 2.2, 2.2, MAT.planks));
    K.B.add(xf(cyl(0.18, 0.22, 2.6, 8), x + 0.8, 0.0, z + 0.8, 0.2, 0, 0.15), MAT.woodDark, 'keep');
  }

  // ================================================================ 2. FIRST WRECK (under turret fire)
  W.add([-2.3, -1, -46], [2.3, 1.8, -32]);
  { const w = ship(K, 0, 1.75, -39, 0, 1.0, { sail: MAT.canvasRed, flags: false }); w.rotation.z = 0.05; }
  pillar(K, 7.6, 10.4, -39.4, -36.6, 2.6, 31);
  EN(new Turret(G, 9, 2.6, -38, -Math.PI / 2));
  crate(0.8, 1.8, -36); crate(-0.8, 1.8, -42);
  E(new Mover(G, [0, 1.6, -48.4], [0, 1.6, -48.4], 2.2, 2.2, 5, { kind: 'buoy', bob: 0.4 }));
  // decorative half-sunk wrecks around the reef
  for (const [x, y, z, ry, s, rz] of [[-22, -0.8, -58, 1.2, 1.1, 0.35], [24, -1.2, -24, -0.6, 1.0, -0.4], [-26, -1, -205, 2.2, 1.2, 0.3], [26, -1.4, -150, 0.9, 1.1, -0.45]]) {
    const w = ship(K, x, y, z, ry, s, { sail: MAT.canvas, flags: false }); w.rotation.z = rz; w.rotation.x = 0.1;
  }

  // ================================================================ 3. SMUGGLERS' ISLET + SEA-GATE PUZZLE (both heroes)
  L.checkpoint(0, 1.5, -54);
  L.trigger(0, -56, 5, g => g.objective('Open the sea gate: weigh down both plates'));
  L.hint(0, -62, 6, 'The sea gate needs BOTH plates: the HEAVY one here (2 cubes) and another on the islet to the east, behind a barricade. Canon can shoot across the water!', 'seagate');
  EN(new Bilgebot(G, -5, 1.5, -66)); EN(new Bilgebot(G, 5, 1.5, -70)); EN(new Bomber(G, 0, 1.5, -78));
  crate(9, 1.5, -57, 'health'); crate(-9, 1.5, -58); crate(-8.8, 1.5, -59.2); crate(6, 1.5, -78);
  tent(K, -8, 1.5, -72, Math.PI / 2, MAT.canvasRed); tent(K, 8, 1.5, -64, -Math.PI / 2);
  for (const [x, z] of [[-9.5, -62], [9.5, -76]]) brazier(K, x, 1.5, z);
  lanternString(K, [-8, 3.4, -72], [8, 3.4, -64], 0.6);
  const pHeavy = E(new Plate(G, -5, 1.5, -76, 2));
  // eastern islet: plate behind a wooden barricade, reached by two buoys
  pillar(K, 19, 25, -76, -70, 1.6, 47);
  const pEast = E(new Plate(G, 22.5, 1.6, -73, 1));
  E(new Barricade(G, 19.6, 1.6, -73, 5.6, 3.0, false, Math.PI / 2));
  for (const [x, ph] of [[14.2, 0], [17.1, 0.5]]) E(new Mover(G, [x, 1.5, -73], [x, 1.5, -73], 2.2, 2.2, 5.5, { kind: 'buoy', bob: 0.35, phase: ph }));
  // causeway + sea gate
  quay(K, -3, 3, -96, -80, 1.8, { edges: 'we' });
  pillar(K, -5.5, -3, -85.2, -82.8, 6.5, 52); pillar(K, 3, 5.5, -85.2, -82.8, 6.5, 53);
  K.B.box(MAT.brickDark, 11, 1.2, 2.4, 0, 7.0, -84, 0, 2);
  const gate = E(new Gate(G, 0, 1.8, -84, 6, 4.6, [pHeavy, pEast]));
  gate.onOpen = () => { G.objective('Cross the sea cave'); G.hint('The sea gate is open!', 3, 'gate3'); };

  // ================================================================ 4. SEA CAVE: shoot targets to raise the bridges
  L.checkpoint(0, 1.8, -93);
  L.hint(0, -92, 4, 'The walkways are sunk! Shoot the TARGETS on the cave ledges with Canon to raise stone bridges.', 'cavetargets');
  quay(K, -3, 3, -112, -106, 1.8, { coping: false, topMat: MAT.flagstone, wallMat: MAT.rockDark });
  quay(K, -3, 3, -128, -122, 1.8, { coping: false, topMat: MAT.flagstone, wallMat: MAT.rockDark });
  quay(K, -4, 4, -140, -128, 5.0, { coping: false, topMat: MAT.flagstone, wallMat: MAT.rockDark });
  const bridge1 = E(new RiseBlocks(G, [[0, 1.8, -101, 3, 1, 10]], MAT.flagstone));
  const bridge2 = E(new RiseBlocks(G, [[0, 1.8, -117, 3, 1, 10]], MAT.flagstone));
  pillar(K, 5, 8, -103, -99, 3.0, 61); E(new Target(G, 6.5, 3.0, -101, -Math.PI / 2, () => bridge1.trigger()));
  pillar(K, -8, -5, -119, -115, 4.0, 62); E(new Target(G, -6.5, 4.0, -117, Math.PI / 2, () => bridge2.trigger()));
  // golden gear #1: high cave shelf next to the middle pad (two stacked cubes)
  pillar(K, -8, -4.5, -112, -107, 5.4, 63);
  L.golden(-6.3, 5.4, -109.5, 'caveShelf');
  L.hint(0, -126, 3, 'The exit ledge is too high. Stack a cube against it with Cubey!', 'caveexit');
  EN(new Gull(G, 0, 6, -104)); EN(new Gull(G, 1, 6.5, -120));
  for (const [x, z] of [[2.4, -109], [-2.4, -125], [2.4, -125]]) torchPost(K, x, 1.8, z);
  // cave walls + roof
  for (let z = -92; z > -142; z -= 5.5) {
    rock(K, -10.5, 3, z, 3.6, 7, 3.6, 70 + z, MAT.rockDark); rock(K, 10.5, 3, z, 3.6, 7, 3.6, 90 + z, MAT.rockDark);
    rock(K, 0, 12.5, z, 11, 2.6, 4.2, 110 + z, MAT.rock);
  }

  // ================================================================ 5. SMUGGLERS' CLIFF CAMP
  L.checkpoint(0, 5.0, -139);
  L.trigger(0, -140, 5, g => g.objective('Raid the smugglers’ camp'), 4);
  EN(new Bilgebot(G, -5, 5, -150)); EN(new Bilgebot(G, 6, 5, -155)); EN(new Brute(G, 0, 5, -163)); EN(new Bomber(G, -8, 5, -166));
  tower(K, 10.5, -158, 1.6, 3.5, { ground: 5.0, roof: false });
  EN(new Turret(G, 10.5, 9.5, -158, Math.PI));
  for (const [x, z, ry, m] of [[-9, -146, 0.3, MAT.canvas], [8, -146, -0.4, MAT.canvasRed], [-6, -160, 1.6, MAT.canvasStripe], [9, -167, -1.2, MAT.canvas]]) tent(K, x, 5.0, z, ry, m);
  for (const [x, z] of [[-3, -144], [3, -144], [-4, -168], [4, -168]]) brazier(K, x, 5.0, z);
  lanternString(K, [-9, 7, -146], [8, 7, -146], 0.6); lanternString(K, [-6, 7, -160], [9, 7, -167], 0.7);
  for (const [x, z] of [[-12, -164], [12.4, -148], [-2, -156]]) { decorCrate(K, x, 5, z, 1.1, x); decorCrate(K, x + 1.2, 5, z + 0.3, 0.9, x + 1); }
  for (const [x, z] of [[11, -170], [-11.5, -151]]) { barrel(K, x, 5, z); barrel(K, x + 0.8, 5, z + 0.4, 0.9); }
  crate(-11, 5, -170, 'health'); crate(2, 5, -160, 'boom'); crate(-2, 5, -149); crate(7, 5, -152);
  banner(K, -8, 9.6, -173.7, 0, 3.4, MAT.flag); banner(K, 8, 9.6, -173.7, 0, 3.4, MAT.flag);
  // secret slam stairs to a lookout (golden gear #2)
  const steps = E(new RiseBlocks(G, [[-12, 6, -145, 2, 1, 2], [-12, 7, -147.2, 2, 1, 2], [-12, 8, -149.4, 2, 1, 2], [-12, 9, -151.6, 2, 1, 2]], MAT.rock));
  E(new SlamSwitch(G, -9.5, 5.0, -141.5, () => { steps.trigger(); G.hint('Hidden steps! Climb to the lookout.', 3, 'steps3'); }));
  pillar(K, -15, -10, -158, -152.6, 9.0, 81);
  L.golden(-12.5, 9.0, -155.3, 'lookout');
  // palisade + iron barricade
  for (const [x0, x1] of [[-14, -2], [2, 14]]) {
    for (let x = x0 + 0.25; x < x1; x += 0.5) K.B.add(xf(cyl(0.22, 0.24, 3.6 + ((x * 7) % 0.6), 7), x, 6.8, -174), MAT.woodDark, 'keep');
    W.add([x0, 5, -174.4], [x1, 9, -173.6], { walkable: false });
  }
  const iron = E(new Barricade(G, 0, 5.0, -174, 4, 3.3, true, 0));
  iron.onBreak = () => G.objective('Ride the lift up to the zipline');
  L.hint(0, -168, 4, 'Iron-banded! Canon must HOLD fire for a heavy shot.', 'iron3');

  // ================================================================ 6. PLATE LIFT + ZIPLINE (both heroes)
  quay(K, -6, 6, -182, -175, 5.0, { coping: false });
  const liftPlate = E(new Plate(G, 4.5, 5.0, -178.5, 1));
  E(new Mover(G, [0, 5.0, -178.5], [0, 9.0, -178.5], 3, 3, 2.5, { kind: 'lift', control: () => liftPlate.on }));
  for (const sx of [-1, 1]) K.B.add(xf(cyl(0.1, 0.1, 5, 8), sx * 1.7, 7.5, -178.5), MAT.iron, 1);
  L.hint(0, -177, 4, 'This lift only rises while its plate is held down. Leave a cube on it, then ride up!', 'lift3');
  deck(K, -3, 3, -188, -180, 9.0);
  railing(K, [[-2.8, 9, -180.2], [-2.8, 9, -187.8]], 1, true); railing(K, [[2.8, 9, -180.2], [2.8, 9, -187.8]], 1, true);
  G.rails.push(new Rail(G, [[0, 9.6, -185.5], [0, 9.2, -191], [-3, 8, -199], [-6, 6, -206], [-8, 3.8, -212], [-8, 2.7, -216.5]]));
  L.hint(0, -185, 3, 'JUMP onto the rail and grind down to the raft dock!', 'zip3');

  // ================================================================ 7. RAFT CHAIN UNDER FIRE
  pillar(K, -11, -5, -220, -212, 2.0, 91);
  L.checkpoint(-8, 2.0, -213.5, Math.PI);
  L.hint(-8, -216, 4, 'Ride the drifting barge, then hop the buoys and crumbling planks to the beached galleon.', 'rafts3');
  L.trigger(-8, -216, 4, g => g.objective('Reach the beached galleon'), 1.5);
  E(new Mover(G, [-8, 1.4, -225], [8, 1.4, -225], 4, 4, 7, { kind: 'barge' }));
  E(new Mover(G, [8, 1.5, -230.5], [8, 1.5, -230.5], 2.2, 2.2, 5, { kind: 'buoy', bob: 0.45 }));
  E(new Mover(G, [5, 1.5, -235.5], [5, 1.5, -235.5], 2.2, 2.2, 5, { kind: 'buoy', bob: 0.45, phase: 0.4 }));
  E(new Crumble(G, 2, 1.4, -240, 2.2, 2.2, MAT.planks)); E(new Crumble(G, 0, 1.5, -244.4, 2.2, 2.2, MAT.planks));
  pillar(K, 11, 14, -237, -233, 3.0, 93); EN(new Turret(G, 12.5, 3.0, -235, -Math.PI / 2));
  pillar(K, -15, -11, -233, -229, 3.0, 94); EN(new PostBomber(G, -13, 3.0, -231));

  // ================================================================ 8. BEACHED GALLEON ARENA
  deck(K, -4.4, 4.4, -277, -249, 2.2, { posts: false });
  { const g = ship(K, 0, 2.15, -263, 0, 1.95, { sail: MAT.canvasRed }); g.rotation.z = 0.035; }
  W.add([-3.9, 2.2, -276.5], [3.9, 5.9, -270]);
  stairs(K, 4.4, 7.4, -262, -258, 0.6, 2.2, '-x', MAT.planks);
  stairs(K, -7.4, -4.4, -268, -264, 0.6, 2.2, '+x', MAT.planks);
  // golden gear #3 on the stern castle roof (3.7 m above the deck: two stacked cubes)
  K.B.box(MAT.planks, 7.9, 0.15, 6.6, 0, 5.95, -273.25, 0, 1.5);
  L.golden(0, 6.0, -273.2, 'sternCastle');
  for (const [x, z] of [[-10, -256], [10, -270], [-9, -276], [11, -252]]) { decorCrate(K, x, hAt(x, z), z, 1.1, x); barrel(K, x + 1.3, hAt(x + 1.3, z), z + 0.4); }
  for (const [x, z] of [[-12, -262], [12, -262]]) torchPost(K, x, hAt(x, z), z);
  K.B.add(sagRope(new T.Vector3(-4, 8, -258), new T.Vector3(-12, hAt(-12, -270) + 0.3, -270), 1, 0.04), MAT.rope, 'keep');
  arena(G, L, {
    x: 0, z: -251, r: 5, yMin: 1.8, title: 'Galleon wave',
    waves: [
      () => [new Bilgebot(G, -2, 2.2, -262), new Bilgebot(G, 2, 2.2, -268), new Bilgebot(G, 10, 0.6, -258), new Bomber(G, -10, 0.6, -272)],
      () => [new Brute(G, 0, 2.2, -266), new Bilgebot(G, -10, 0.6, -262), new Bilgebot(G, 10, 0.6, -266), new Gull(G, -4, 9, -262), new Gull(G, 4, 9, -268)],
      () => [new Brute(G, -9, 0.6, -264), new Brute(G, 9, 0.6, -260), new Bomber(G, 0, 2.2, -273.5), new Bilgebot(G, -2, 2.2, -258), new Bilgebot(G, 2, 2.2, -258)],
    ],
    onStart: g => g.objective('Defeat the galleon crew'),
    onDone: g => { g.objective('Grab treasure map piece 3'); g.hud.banner('Galleon cleared!', 'The map piece is on the sand behind the stern'); mapPiece(g, L, 0, 0.6, -281, 'Treasure Map Piece 3'); },
  });

  // ================================================================ DRESSING
  for (const [x, z] of [[-14, 6], [13, 9], [-15, -62], [14, -58], [-20, -150], [18, -170], [-16, -255], [17, -272]]) { const h = hAt(x, z); if (h > 0.4) palm(K, x, h - 0.1, z, 7, 0.7); }
  for (let i = 0; i < 16; i++) { const a = i * 2.1, x = Math.cos(a) * 20, z = -66 + Math.sin(a) * 15; const h = hAt(x, z); if (h > 0.2 && h < 1.3) driftwood(K, x, h, z, a); }
  for (const [x, z] of [[-14, -40], [15, -100], [-16, -190], [18, -215], [-18, -240]]) rock(K, x, 0, z, 2 + (x % 2), 2.4, 2.2, x * z, MAT.rockDark);

  finishLevel(G, L, {
    ships: 2, palms: 0.6,
    foliageExtra: F => {
      F.edge(-13.8, -137, -13.8, -173, 5.0, 2.5); F.edge(13.8, -137, 13.8, -173, 5.0, 2.5);
      F.bushes([[-12, 5, -140, 1.0], [12, 5, -141, 1.1], [-10, 1.5, -53, 0.9], [10, 1.5, -80, 1.0]]);
    },
  });
  G.objective('Cross the wreck field');
  return { start: { x: 0, y: 1.5, z: 13 } };
}
void Chest;
