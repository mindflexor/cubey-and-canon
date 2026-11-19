// Level 1: Saltgear Harbor — pier, market quay, plaza gate puzzle, lagoon crossing,
// fortress battery, grind rail, shipyard arena and the lighthouse cape (Treasure Map piece 1).
import * as T from 'three';
import { MAT } from '../materials.js';
import { box, cyl, sph, rbox, xf, gearGeo, sagRope } from '../geo.js';
import * as KIT from '../kit.js';
import { Barricade, Plate, Gate, Checkpoint, Mover, Rail, GoldenGear, Hint, Trigger, Target, SlamSwitch, Chest } from '../entities.js';
import { Bilgebot, Turret, Gull, Bomber } from '../enemies.js';
import { beginLevel, finishLevel, arena, mapPiece, projBox } from '../levelkit.js';

const { quay, deck, stairs, railing, house, tower, wallSegment, lamp, barrel, decorCrate, bollard, ropeCoil, stall, palm, bunting, rock, ship, crane, lighthouse, fountain } = KIT;
const KEEP_OUT = [[-24, 24, -86, -1], [-8, 8, -2, 27], [-18, 18, -193, -119], [-18, 32, -277, -235], [-17, 17, -330, -290], [-3, 3, -290, -273]];

export const info = { name: 'Saltgear Harbor', tag: 'Reclaim the harbor from the Rustwake pirates', golden: 3 };

export function build(G) {
  const L = beginLevel(G, { seed: 42, keepOut: KEEP_OUT });
  const { K, E, EN, crate } = L;

  // ================================================================ ISLANDS (walkable terrain, beaches, jungle hills)
  const lagoon = [-13, 13, -118, -87, -2.6, 3];
  const isl = {
    town: L.island({ cx: -2, cz: -42, rx: 66, rz: 46, seed: 1.3, peak: 26, flats: [[-23, 23, -82, -2, 1.7, 6], lagoon] }),
    fort: L.island({ cx: 0, cz: -160, rx: 34, rz: 37, seed: 4.1, peak: 6, hills: 0.4, flats: [[-17, 17, -190, -138, 1.4, 4], lagoon, [-14, 14, -236, -200, -2.4, 3]] }),
    cape: L.island({ cx: 0, cz: -292, rx: 46, rz: 58, seed: 2.2, peak: 34, cliffs: 2, flats: [[-17, 31, -276, -236, 1.0, 4], [-21, 21, -333, -287, 3.0, 6], [-50, 50, -287, -275, -2.6, 2.5], [-14, 14, -236, -205, -2.4, 3]] }),
  };
  const hAt = L.hAt;

  // ================================================================ 1. START PIER
  deck(K, -6, 6, 14, 26, 1.6);
  deck(K, -3, 3, -0.6, 14, 1.6);
  stairs(K, -3, 3, -2.0, -0.6, 1.6, 2.2, '-z');
  railing(K, [[-5.8, 1.6, 25.8], [5.8, 1.6, 25.8]]);
  railing(K, [[-5.8, 1.6, 25.8], [-5.8, 1.6, 14.2], [-2.8, 1.6, 14.2], [-2.8, 1.6, 0]]);
  railing(K, [[5.8, 1.6, 25.8], [5.8, 1.6, 21]]);
  railing(K, [[5.8, 1.6, 15.5], [5.8, 1.6, 14.2], [2.8, 1.6, 14.2], [2.8, 1.6, 0]]);
  // the heroes' ship, the Mortar Queen, moored alongside
  ship(K, 13.5, 0.9, 18, 0.0, 1.2, { sail: MAT.canvas });
  K.B.box(MAT.planks, 4.2, 0.12, 1.1, 8.0, 1.75, 18.2, 0, 1.5);
  for (const sz of [-1, 1]) K.B.add(xf(cyl(0.05, 0.05, 4.2, 6), 8.0, 2.3, 18.2 + sz * 0.5, 0, 0, Math.PI / 2), MAT.rope, 'keep');
  // cargo stack (teaches cube climbing)
  K.W.add([-5.9, 1.6, 15.2], [-3.1, 4.6, 19.0]);
  for (const [x, y, z, s] of [[-5.15, 1.6, 15.95, 1.5], [-3.85, 1.6, 15.95, 1.3], [-5.15, 1.6, 17.6, 1.5], [-3.85, 1.6, 17.6, 1.5], [-4.5, 3.1, 16.8, 1.5], [-5.2, 3.1, 18.2, 1.4], [-3.8, 3.1, 18.2, 1.4], [-4.5, 3.1, 15.8, 1.4]]) decorCrate(K, x, y, z, s, (x * 7) % 0.4, false);
  K.B.box(MAT.planks, 2.8, 0.1, 3.8, -4.5, 4.55, 17.1, 0, 2);
  crate(-4.5, 4.6, 17.1);
  crate(1.5, 1.6, 10); crate(2.0, 1.6, 5); crate(-1.8, 1.6, 7); crate(4.5, 1.6, 23);
  for (const z of [20, 12, 5]) { lamp(K, -2.55, 1.6, z, Math.PI / 2); }
  lamp(K, 5.5, 1.6, 24.5, -Math.PI / 2);
  barrel(K, 4.8, 1.6, 15.2); barrel(K, 4.0, 1.6, 15.0, 0.9); barrel(K, 2.3, 1.6, 2.3, 0.9);
  ropeCoil(K, -1.8, 1.6, 22); ropeCoil(K, 2.2, 1.6, 12.5);
  bollard(K, 5.4, 1.6, 20.2); bollard(K, 5.4, 1.6, 16.3);
  for (const [x, z] of [[-8, 10], [-7, 2], [7, 4], [8, 30], [-9, 28]]) { K.B.add(xf(cyl(0.3, 0.35, 5, 10), x, 0.5, z, 0.05, 0, 0.04), MAT.woodDark, 'keep'); K.B.add(xf(cyl(0.36, 0.36, 0.15, 10), x, 2.8, z), MAT.ironDark, 1); }
  E(new Hint(G, 0, 22, 4, 'WASD to move · Mouse to look · SPACE to jump (press again in the air to double jump)', 'move'));
  E(new Hint(G, -3, 17, 3.2, 'As Cubey, CLICK to place a cement cube. Stack cubes to reach high places! (R recalls them)', 'cube', g => g.active.kind === 'cubey'));
  E(new Hint(G, 0, 9, 3, 'CLICK while in the air with Cubey to ground-slam crates and enemies.', 'slam', g => g.active.kind === 'cubey'));

  // ================================================================ 2. MARKET QUAY
  quay(K, -12, 10, -31, -2.0, 2.2, { edges: 'se' });
  railing(K, [[9.6, 2.2, -2.5], [9.6, 2.2, -11]]);
  railing(K, [[9.6, 2.2, -16], [9.6, 2.2, -30.6]]);
  for (const [z, f] of [[-5.5, 3], [-12, 2], [-18.5, 3], [-25, 2]]) house(K, -9.5, z, 6.2, 5, f, Math.PI / 2, { ground: 2.2 });
  stall(K, -4.8, 2.2, -9, Math.PI / 2); stall(K, -4.8, 2.2, -21, Math.PI / 2);
  for (const z of [-6, -14, -22, -29]) lamp(K, 8.9, 2.2, z, -Math.PI / 2);
  for (const z of [-10, -18, -26]) bollard(K, 9.3, 2.2, z);
  palm(K, -5.6, 2.2, -3.6, 6.5, 0.4); palm(K, -5.4, 2.2, -27.5, 7, 0.5); palm(K, 7.8, 2.2, -2.8, 6, 0.5, -0.8);
  K.B.add(xf(cyl(0.9, 0.8, 0.6, 16), -5.6, 2.5, -3.6), MAT.brick, 2); K.B.add(xf(cyl(0.9, 0.8, 0.6, 16), -5.4, 2.5, -27.5), MAT.brick, 2);
  barrel(K, -6, 2.2, -15.5); barrel(K, -6.3, 2.2, -16.4, 0.9); barrel(K, 6.5, 2.2, -12); decorCrate(K, 7.2, 2.2, -13.3, 1.0, 0.3);
  ropeCoil(K, 8.2, 2.2, -19);
  ship(K, 16, 0.6, -14, Math.PI, 0.9, { sail: MAT.canvasRed });
  bunting(K, [-7, 8.2, -8.5], [8.9, 5.6, -6]); bunting(K, [-7, 7.6, -15.5], [8.9, 5.6, -14]); bunting(K, [-7, 8.2, -22], [8.9, 5.6, -22]);
  crate(6, 2.2, -8); crate(6.8, 2.2, -9.4); crate(-3.2, 2.2, -17); crate(5, 2.2, -27, 'health'); crate(-3, 2.2, -28.5); crate(3.5, 2.2, -20, 'boom');
  EN(new Bilgebot(G, 2, 2.2, -14)); EN(new Bilgebot(G, -1.5, 2.2, -23));
  E(new Trigger(G, 0, -4, 4, g => g.objective('Find a way into the town plaza')));

  // ================================================================ 3. ALLEY + BARRICADE
  quay(K, -12, 10, -44, -31, 2.2, { topMat: MAT.cobble, coping: false });
  house(K, -7.5, -37.5, 9, 12.6, 3, 0, { ground: 2.2 });
  house(K, 6.5, -37.5, 7, 12.6, 2, 0, { ground: 2.2 });
  bunting(K, [-3, 9, -34], [3, 7.5, -36]); bunting(K, [-3, 9, -40], [3, 7.5, -41]);
  const bar1 = E(new Barricade(G, 0, 2.2, -31.6, 6, 3.4, false));
  bar1.onBreak = () => G.objective('Explore the town plaza');
  E(new Hint(G, 0, -27, 4.5, 'A barricade! Press Q to swap to Canon, then CLICK to fire cannonballs.', 'swap', g => g.active.kind === 'cubey'));
  E(new Hint(G, 0, -27, 4.5, 'CLICK to fire. Hold RIGHT MOUSE to aim over the shoulder.', 'fire', g => g.active.kind === 'canon'));

  // ================================================================ 4. TOWN PLAZA (pressure-plate gate)
  quay(K, -22, 22, -74, -44, 2.2, { topMat: MAT.cobble, coping: false });
  K.B.box(MAT.flagstone, 28, 0.04, 2, 0, 2.22, -45, 0, 3);
  for (const [z, f] of [[-50, 3], [-57.5, 2], [-65.5, 3]]) house(K, -18, z, 7, 7, f, Math.PI / 2, { ground: 2.2 });
  for (const [z, f] of [[-46.8, 2], [-57.5, 3], [-66, 2]]) house(K, 18, z, z === -46.8 ? 6 : 7, 7, f, -Math.PI / 2, { ground: 2.2 });
  // corner fillers so the plaza feels enclosed
  house(K, -16, -46, 4, 3.8, 2, 0, { ground: 2.2, door: false }); house(K, 16, -71.5, 4.5, 3.8, 2, Math.PI, { ground: 2.2, door: false });
  // balcony secret (needs one cube)
  K.W.add([11, 2.2, -52.5], [14.5, 5.4, -48.5]);
  K.B.box(MAT.planks, 3.5, 0.25, 4, 12.75, 5.27, -50.5, 0, 2);
  for (const z of [-52.2, -48.8]) for (const x of [11.3]) K.B.add(xf(cyl(0.15, 0.15, 3.1, 8), x, 3.7, z), MAT.woodDark, 'keep');
  K.B.box(MAT.brick, 3.0, 3.0, 3.6, 13, 3.7, -50.5, 0, 2.5);
  railing(K, [[11.15, 5.4, -48.7], [14.4, 5.4, -48.7]], 0.9, false);
  E(new GoldenGear(G, 12.8, 5.4, -50.5, 'balcony'));
  // town wall + gatehouse
  wallSegment(K, -22, -3, -78, -74, 9.5, 2.2); wallSegment(K, 3, 22, -78, -74, 9.5, 2.2);
  tower(K, -5, -76, 2.2, 10, { ground: 2.2 }); tower(K, 5, -76, 2.2, 10, { ground: 2.2 });
  K.B.box(MAT.brick, 6.4, 2.0, 4, 0, 8.7, -76, 0, 3); K.W.add([-3.2, 7.7, -78], [3.2, 9.7, -74]);
  K.B.box(MAT.flagstone, 6.6, 0.4, 4.2, 0, 7.6, -76, 0, 2);
  for (const sx of [-1, 1]) K.B.add(xf(box(0.6, 0.6, 0.12), sx * 1.8, 8.6, -73.9, 0, 0, Math.PI / 4), MAT.brass, 1);
  K.B.add(xf(gearGeo(0.8, 12, 0.2, 0.3).clone(), 0, 8.7, -73.85), MAT.brass, 1);
  fountain(K, 0, 2.2, -58);
  stall(K, -9, 2.2, -50, 0); stall(K, 9, 2.2, -60, Math.PI);
  for (const [x, z] of [[-11.5, -47], [11.5, -47], [-11.5, -70], [11.5, -70]]) lamp(K, x, 2.2, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
  palm(K, -11, 2.2, -60, 6.5, 0.3); palm(K, 11, 2.2, -53, 6.5, 0.3, 2);
  bunting(K, [-14.5, 9.5, -50], [14.5, 8.6, -57.5]); bunting(K, [-14.5, 8.6, -57.5], [14.5, 9.5, -66]); bunting(K, [-14.5, 9.5, -66], [14.5, 9.2, -47]);
  barrel(K, -12.5, 2.2, -55); barrel(K, 12.6, 2.2, -63); decorCrate(K, -12.6, 2.2, -63.5, 1.1, 0.2); decorCrate(K, -12.4, 2.2, -64.8, 0.9, 0.5);
  // bandstand: the second plate sits 2.6 m up (stack a cube to climb), the first plate is heavy (2 cubes)
  K.B.add(xf(cyl(1.7, 1.9, 2.6, 10), 8, 3.5, -66), MAT.brick, 2); K.B.add(xf(cyl(2.05, 2.05, 0.25, 10), 8, 4.72, -66), MAT.flagstone, 1.5);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; K.B.add(xf(cyl(0.08, 0.08, 3.2, 8), 8 + Math.cos(a) * 1.85, 6.4, -66 + Math.sin(a) * 1.85), MAT.paintWhite, 1); }
  K.B.add(xf(cyl(0.05, 2.5, 1.3, 6), 8, 8.6, -66), MAT.roofBlue, 'keep'); K.B.add(xf(sph(0.18, 8, 6), 8, 9.3, -66), MAT.brass, 1);
  K.W.add([8 - 1.75, 2.2, -66 - 1.75], [8 + 1.75, 4.84, -66 + 1.75]);
  const pA = E(new Plate(G, -8, 2.2, -67, 2)), pB = E(new Plate(G, 8, 4.84, -66, 1));
  const gate1 = E(new Gate(G, 0, 2.2, -75, 6, 5.5, [pA, pB]));
  gate1.onOpen = () => { G.objective('Cross the canal'); G.hint('The gate is open!', 3, 'gateopen'); };
  E(new Checkpoint(G, 0, 2.2, -47, Math.PI));
  E(new Hint(G, 0, -62, 7, 'The gate needs BOTH plates held down. The left plate is HEAVY (2 cubes) and the other is up on the bandstand. You only have 4 cubes, so plan it out!', 'plates'));
  E(new Trigger(G, 0, -50, 5, g => g.objective('Weigh down both pressure plates to open the gate')));
  crate(-6, 2.2, -48.5); crate(6.5, 2.2, -51); crate(-12.5, 2.2, -68.5); crate(4, 3.0, -55.2, 'gear'); crate(12.5, 2.2, -69, 'health');
  EN(new Bilgebot(G, -6, 2.2, -56)); EN(new Bilgebot(G, 6, 2.2, -62)); EN(new Bilgebot(G, 0, 2.2, -68));
  EN(new Gull(G, -5, 7, -62)); EN(new Gull(G, 6, 7.5, -53));

  // ================================================================ 5. CANAL CROSSING
  quay(K, -8, 8, -84, -78, 2.2, { edges: 'nwe' });
  railing(K, [[-7.6, 2.2, -78.5], [-7.6, 2.2, -83.6], [-2.5, 2.2, -83.6]]);
  railing(K, [[7.6, 2.2, -78.5], [7.6, 2.2, -83.6], [2.5, 2.2, -83.6]]);
  E(new Checkpoint(G, 0, 2.2, -81, Math.PI));
  const barge = E(new Mover(G, [0, 1.6, -88.2], [0, 1.6, -99.8], 4, 4, 8, { kind: 'barge', active: false }));
  E(new Target(G, 0.5, 2.0, -104.6, 0, g => { barge.active = true; g.hint('The barge is free! Hop on and ride it across.', 4, 'bargefree'); }));
  K.B.add(sagRope(new T.Vector3(0, 1.9, -90.2), new T.Vector3(0.3, 2.4, -103.4), 1.4, 0.04), MAT.rope, 'keep');
  E(new Hint(G, 0, -82, 4, 'The barge is moored to the far pylon. Shoot the TARGET with Canon to cut it loose!', 'moored'));
  quay(K, -1.1, 1.1, -105.1, -102.9, 2.0, { coping: false, topMat: MAT.flagstone });
  K.B.add(xf(cyl(0.5, 0.5, 0.3, 12), 0, 2.15, -104), MAT.iron, 1);
  E(new Mover(G, [-1.2, 1.7, -108.6], [-1.2, 1.7, -108.6], 2.2, 2.2, 6, { kind: 'buoy', bob: 0.5, phase: 0 }));
  E(new Mover(G, [1.2, 1.7, -113.1], [1.2, 1.7, -113.1], 2.2, 2.2, 6, { kind: 'buoy', bob: 0.5, phase: 0.33 }));
  E(new Mover(G, [-1.2, 1.7, -117.6], [-1.2, 1.7, -117.6], 2.2, 2.2, 6, { kind: 'buoy', bob: 0.5, phase: 0.66 }));
  E(new Hint(G, 0, -84, 4, 'Time your jumps onto the barge and the bobbing buoys!', 'canal'));

  // ================================================================ 6. FORTRESS BATTERY
  deck(K, -6, 6, -136, -121, 1.6);
  railing(K, [[-5.7, 1.6, -121.4], [-5.7, 1.6, -135.6]]); railing(K, [[5.7, 1.6, -121.4], [5.7, 1.6, -135.6]]);
  stairs(K, -4, 4, -140, -136, 1.6, 4.2, '-z');
  for (const sx of [-1, 1]) { K.B.box(MAT.brick, 2, 3.6, 4, sx * 5, 2.4, -138, 0, 2.5); K.W.add([sx * 5 - 1, 0, -140], [sx * 5 + 1, 4.2 + 1.2, -136]); K.B.box(MAT.flagstone, 2.2, 0.3, 4.2, sx * 5, 4.35, -138, 0, 2); }
  quay(K, -14, 14, -172, -140, 4.2, { coping: false });
  wallSegment(K, -15, -14, -172, -152, 7.2, 4.2); wallSegment(K, -15, -14, -146, -140, 7.2, 4.2);
  wallSegment(K, 14, 15, -172, -140, 7.2, 4.2);
  wallSegment(K, -15, -6, -141, -140, 6.2, 4.2, false); wallSegment(K, 6, 15, -141, -140, 6.2, 4.2, false);
  // secret alcove behind iron barricade
  quay(K, -20, -14, -153, -145, 4.2, { coping: false });
  wallSegment(K, -20, -14, -154, -153, 7.2, 4.2); wallSegment(K, -20, -14, -145, -144, 7.2, 4.2); wallSegment(K, -21, -20, -154, -144, 7.2, 4.2);
  K.B.box(MAT.planks, 6, 0.3, 9, -17, 7.3, -149, 0, 2); K.W.add([-20, 7.1, -153.5], [-14, 7.5, -144.5]);
  E(new Barricade(G, -14.4, 4.2, -149, 4.6, 3.0, true, Math.PI / 2));
  E(new GoldenGear(G, -17.5, 4.2, -149, 'alcove'));
  barrel(K, -19, 4.2, -152); barrel(K, -19.2, 4.2, -146.2, 0.9);
  // cover
  for (const [x, z, w] of [[-6, -150, 3.5], [6, -156, 3.5], [0, -162, 4.5], [-8, -165, 2.5], [9, -166, 2.5]]) {
    K.B.add(xf(rbox(w, 1.1, 0.8, 0.12), x, 4.75, z), MAT.brick, 2); K.W.add([x - w / 2, 4.2, z - 0.4], [x + w / 2, 5.3, z + 0.4], { walkable: true });
    K.B.add(xf(rbox(w + 0.2, 0.16, 1.0, 0.06), x, 5.35, z), MAT.flagstone, 1.5);
  }
  for (const [x, z] of [[-11, -144], [11, -144], [-11, -169], [11, -169]]) lamp(K, x, 4.2, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const [x, z] of [[-12, -158], [12.3, -150], [12, -160]]) { decorCrate(K, x, 4.2, z, 1.1, 0.3); }
  K.B.add(xf(cyl(0.5, 0.5, 2.6, 10), 12, 5.5, -147), MAT.iron, 1);
  for (let i = 0; i < 5; i++) K.B.add(xf(sph(0.3, 10, 8), 11 + (i % 3) * 0.6, 4.5 + Math.floor(i / 3) * 0.5, -152.5), MAT.ironDark, 1);
  crate(-3, 4.2, -146); crate(4, 4.2, -150); crate(-10, 4.2, -160, 'health'); crate(10, 4.2, -170); crate(-2.5, 4.2, -168, 'boom');
  E(new Checkpoint(G, 0, 4.2, -142, Math.PI));
  EN(new Bilgebot(G, -4, 4.2, -158)); EN(new Bilgebot(G, 5, 4.2, -164));
  // rampart (3.2 m high: needs a cube)
  quay(K, -15, 15, -186, -172, 7.4, { edges: 's' });
  for (let x = -14; x <= 14; x += 2) K.B.add(xf(rbox(0.9, 0.7, 0.6, 0.06), x, 7.75, -172.4), MAT.brick, 1.5);
  EN(new Turret(G, -7, 7.4, -174.6, 0)); EN(new Turret(G, 7, 7.4, -174.6, 0));
  tower(K, -15, -186, 3, 7, { ground: 4.2 }); tower(K, 15, -186, 3, 7, { ground: 4.2 });
  K.B.add(xf(cyl(0.1, 0.12, 6, 8), -6, 10.4, -182), MAT.woodDark, 'keep');
  K.flags.push({ x: -6, y: 13.2, z: -182, big: true });
  E(new Hint(G, 0, -146, 6, 'Deck turrets ahead! Cubey can hold RIGHT MOUSE to raise a cube shield, and placed cubes make good cover.', 'shield'));
  E(new Hint(G, 0, -168, 4, 'The rampart is too tall to jump. Stack a cube against the wall and climb!', 'rampart'));
  E(new Trigger(G, 0, -142, 5, g => g.objective('Silence the deck turrets and scale the rampart')));
  // iron barricade to the rail platform
  deck(K, -2.5, 2.5, -192, -186, 7.4, { posts: false });
  K.B.add(xf(cyl(0.3, 0.35, 9, 10), -2.2, 3.5, -191.6), MAT.woodDark, 'keep'); K.B.add(xf(cyl(0.3, 0.35, 9, 10), 2.2, 3.5, -191.6), MAT.woodDark, 'keep');
  const ironBar = E(new Barricade(G, 0, 7.4, -185.2, 5, 3.0, true, 0));
  ironBar.onBreak = () => G.objective('Grind the rail to the shipyard');
  E(new Hint(G, 0, -180, 4, 'Canon: HOLD fire to charge a heavy shot. It breaks iron-banded barricades.', 'charge'));

  // ================================================================ 7. GRIND RAIL
  G.rails.push(new Rail(G, [[0, 8.0, -190.5], [0, 7.6, -196], [5, 6.6, -204], [11, 5.6, -213], [10, 5.0, -222], [4, 4.4, -230], [0, 3.9, -236.5], [0, 3.8, -240.5]]));
  E(new Hint(G, 0, -189, 3, 'JUMP onto the rail to grind. Press SPACE to hop off.', 'rail'));

  // ================================================================ 8. SHIPYARD ARENA
  deck(K, -16, 16, -274, -238, 3.0);
  railing(K, [[-15.7, 3, -238.4], [-15.7, 3, -273.6]]); railing(K, [[15.7, 3, -238.4], [15.7, 3, -255]]); railing(K, [[15.7, 3, -262], [15.7, 3, -273.6]]);
  railing(K, [[-15.7, 3, -273.6], [-3, 3, -273.6]]); railing(K, [[3, 3, -273.6], [15.7, 3, -273.6]]);
  crane(K, -12.5, 3, -242, 0.4); crane(K, 12.5, 3, -244, -0.9);
  // drydock hull skeleton
  for (let i = 0; i < 9; i++) {
    const z = -244 - i * 3, s = 1 - Math.pow((i - 4) / 5, 2) * 0.6;
    K.B.add(xf(new T.TorusGeometry(3.2 * s, 0.18, 6, 20, Math.PI), 22, 3.2, z, 0, 0, Math.PI), MAT.wood, 1.5);
  }
  K.B.add(xf(box(0.5, 0.5, 28), 22, 0.0, -256), MAT.woodDark, 2);
  quay(K, 16, 30, -274, -238, 1.0, { topMat: MAT.planks, coping: false });
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) K.B.add(xf(rbox(0.4, 2, 0.4, 0.04), 18 + j * 8, 2, -240 - i * 4.5), MAT.woodDark, 1);
  // scaffold tower w/ golden gear (two stacked cubes)
  K.W.add([-15.5, 3, -272], [-11.5, 7.2, -267]);
  for (const [x, z] of [[-15.3, -271.8], [-11.7, -271.8], [-15.3, -267.2], [-11.7, -267.2]]) K.B.add(xf(box(0.3, 4.2, 0.3), x, 5.1, z), MAT.woodDark, 1.5);
  K.B.box(MAT.planks, 4.2, 0.3, 5.2, -13.5, 7.05, -269.5, 0, 2);
  K.B.box(MAT.woodHull, 4.0, 3.9, 4.8, -13.5, 4.95, -269.5, 0, 2);
  for (let i = 0; i < 4; i++) K.B.add(xf(box(4.2, 0.12, 0.12), -13.5, 3.6 + i * 1, -267.05, 0, 0, i % 2 ? 0.5 : -0.5), MAT.woodDark, 1);
  E(new GoldenGear(G, -13.5, 7.2, -269.5, 'scaffold'));
  for (const [x, z] of [[-9, -250], [9, -262], [-4, -266], [7, -248]]) { barrel(K, x, 3, z); barrel(K, x + 0.8, 3, z + 0.3, 0.9); }
  for (const [x, z] of [[10, -268], [-8, -258]]) { decorCrate(K, x, 3, z, 1.2, 0.2); decorCrate(K, x + 1.3, 3, z + 0.2, 1.0, 0.5); }
  for (const [x, z] of [[-15, -256], [15, -258.5]]) lamp(K, x, 3, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
  bunting(K, [-12.5, 11.5, -242], [12.5, 11.5, -244]);
  ship(K, -26, 0.4, -256, 0.1, 1.1, { sail: MAT.canvasRed });
  crate(-5, 3, -246, 'health'); crate(5, 3, -270, 'health'); crate(0, 3, -255); crate(-12, 3, -262); crate(12, 3, -250, 'boom');
  E(new Checkpoint(G, 0, 3.0, -243, Math.PI));
  // drawbridge to the lighthouse
  const bridgePivot = new T.Group(); bridgePivot.position.set(0, 3.0, -273.8); G.scene.add(bridgePivot);
  const bridge = new T.Group(); bridgePivot.add(bridge);
  const bm = new T.Mesh(projBox(5, 0.35, 14.4, 2.5), MAT.planks); bm.position.set(0, -0.18, -7.2); bm.castShadow = bm.receiveShadow = true; bridge.add(bm);
  for (const sx of [-1, 1]) { const r = new T.Mesh(projBox(0.3, 0.6, 14.4, 2), MAT.woodDark); r.position.set(sx * 2.4, 0.1, -7.2); r.castShadow = true; bridge.add(r); }
  for (let i = 0; i < 6; i++) { const s = new T.Mesh(projBox(5.2, 0.12, 0.3, 1), MAT.ironDark); s.position.set(0, 0.02, -1 - i * 2.4); bridge.add(s); }
  bridgePivot.rotation.x = 1.35;
  const bridgeSolid = G.world.add([-2.5, 2.4, -288.2], [2.5, 3.0, -273.8]); bridgeSolid.active = false;
  for (const sx of [-1, 1]) { K.B.add(xf(cyl(0.35, 0.4, 7, 10), sx * 3, 5.5, -273.4), MAT.woodDark, 'keep'); K.B.add(xf(sph(0.45, 10, 8), sx * 3, 9.2, -273.4), MAT.brass, 1); }
  let bridgeDown = false, bridgeT = 0;
  G.updaters.push(dt => {
    if (bridgeDown && bridgeT < 1) { bridgeT = Math.min(1, bridgeT + dt * 0.5); bridgePivot.rotation.x = 1.35 * (1 - (bridgeT * bridgeT * (3 - 2 * bridgeT))); if (bridgeT >= 1) { bridgeSolid.active = true; G.shake(0.5); G.audio.play('land', { vol: 1, rate: 0.5 }); } }
  });
  // arena waves
  const waves = [
    () => [new Bilgebot(G, -6, 3, -256), new Bilgebot(G, 6, 3, -258), new Bilgebot(G, 0, 3, -266)],
    () => [new Gull(G, -8, 9, -255), new Gull(G, 8, 9, -262), new Gull(G, 0, 10, -268), new Bilgebot(G, -9, 3, -265), new Bilgebot(G, 9, 3, -252)],
    () => [new Bilgebot(G, -10, 3, -250), new Bilgebot(G, 10, 3, -268), new Bilgebot(G, -3, 3, -270), new Bilgebot(G, 3, 3, -248), new Gull(G, 0, 10, -258)],
  ];
  let wave = -1, waveList = [], arenaOn = false;
  const spawnWave = () => {
    wave++;
    if (wave >= waves.length) { arenaOn = false; bridgeDown = true; G.objective('Cross the drawbridge to the lighthouse'); G.hud.banner('Shipyard cleared!', 'The drawbridge is lowering'); G.audio.play('levelup', { vol: 0.7 }); return; }
    waveList = waves[wave]().map(e => { e.aggro = true; G.enemies.push(e); G.fx.puff(e.pos.clone().setY(e.pos.y + 1), 10, 1, 1.6, [0.9, 0.9, 0.9]); return e; });
    G.hud.toast(`Wave ${wave + 1} of ${waves.length}`); G.audio.play('boss', { vol: 0.4, rate: 1.3 });
  };
  E(new Trigger(G, 0, -246, 6, g => { arenaOn = true; g.objective('Defeat the Rustwake crew'); setTimeout(spawnWave, 900); }, 2.5));
  G.updaters.push(() => { if (arenaOn && waveList.length && waveList.every(e => e.dead)) { waveList = []; setTimeout(spawnWave, 1500); } });

  // ================================================================ 9. LIGHTHOUSE CLIFF (boss)
  for (const [x, z, s] of [[-18, -300, 1.4], [18, -297, 1.2], [-17, -320, 1.6], [17, -318, 1.5]]) rock(K, x, 3.3, z, s, s * 0.8, s, x * z, MAT.rock);
  for (const [x, z] of [[-16, -292], [17, -308], [-18, -312]]) palm(K, x, 3, z, 7, 0.5);
  const beacon = lighthouse(K, 0, 3, -324);
  for (const [x, z] of [[-8, -320], [8, -320]]) { house(K, x * 1.6, z - 2, 6, 5, 1, 0, { ground: 3.0 }); }
  railing(K, [[-20.5, 3, -288.5], [-3, 3, -288.5]]); railing(K, [[3, 3, -288.5], [20.5, 3, -288.5]]);
  E(new Checkpoint(G, 0, 3.0, -291, Math.PI));
  arena(G, L, { x: 0, z: -295, r: 7, yMin: 2.5, title: 'Lighthouse guards', waves: [
    () => [new Bilgebot(G, -7, 3, -306), new Bilgebot(G, 7, 3, -306), new Bilgebot(G, 0, 3, -312), new Gull(G, 0, 9, -308)],
  ], onStart: g => g.objective('Drive the Rustwake guards off the cape'),
  onDone: g => { g.objective('Grab the treasure map piece'); g.hud.banner('Cape secured!', 'The map piece is by the lighthouse'); mapPiece(g, L, 0, 3, -316, 'Treasure Map Piece 1'); } });
  // rotating beacon beam
  const beamMat = new T.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  const beamG = new T.Group(); beamG.position.copy(beacon); beamG.visible = false; G.scene.add(beamG);
  for (const s of [1, -1]) { const b = new T.Mesh(new T.ConeGeometry(4, 60, 24, 1, true), beamMat); b.rotation.z = s * Math.PI / 2; b.position.x = s * 30; beamG.add(b); }
  G.updaters.push(dt => { beamG.rotation.y += dt * 0.4; });

  // ================================================================ DRESSING PASS (density like the PS3 reference shots)
  const { cannonProp, ballPile, banner, brazier, pipe, lanternString } = KIT;
  // quay: lantern strings, pipes along house fronts, planters
  lanternString(K, [-6.9, 6.0, -2.6], [-6.9, 6.0, -28.5], 0.5);
  pipe(K, [[-6.85, 2.3, -9.5], [-6.85, 5.5, -9.5], [-6.85, 5.5, -15.5], [-6.85, 2.3, -15.5]], 0.1);
  // plaza: banners on the city wall, lantern strings, pipes to the gatehouse machinery
  for (const x of [-16, -10, 10, 16]) banner(K, x, 8.6, -73.85, 0, 4.2, x < 0 ? MAT.canvasRed : MAT.canvasStripe);
  lanternString(K, [-14.4, 7.4, -46], [-3, 7.0, -73.8], 0.8); lanternString(K, [14.4, 7.4, -46], [3, 7.0, -73.8], 0.8);
  pipe(K, [[-3.4, 2.3, -73.7], [-3.4, 7.2, -73.7]], 0.14); pipe(K, [[3.4, 2.3, -73.7], [3.4, 7.2, -73.7]], 0.14);
  pipe(K, [[-8, 2.3, -73.7], [-8, 3.2, -73.7], [-8, 3.2, -68.2]], 0.1, MAT.brass); pipe(K, [[8, 2.3, -73.7], [8, 3.2, -73.7], [8, 3.2, -68.2]], 0.1, MAT.brass);
  // fortress: cannons, shot piles, banners, braziers
  for (const x of [-11, -3.5, 3.5, 11]) cannonProp(K, x, 7.4, -182.5, Math.PI);
  for (const [x, z] of [[-12.5, -152], [12.5, -163], [-6, -170.8], [6, -170.8]]) ballPile(K, x, 4.2, z);
  for (const x of [-12, -4, 4, 12]) banner(K, x, 7.0, -171.75, 0, 2.4, MAT.canvasRed);
  for (const z of [-146, -160]) { banner(K, -13.95, 6.8, z, Math.PI / 2, 2.2, MAT.canvasStripe); banner(K, 13.95, 6.8, z, -Math.PI / 2, 2.2, MAT.canvasStripe); }
  for (const [x, z] of [[-3.5, -141.5], [3.5, -141.5], [-13, -171], [13, -171]]) brazier(K, x, 4.2, z);
  brazier(K, -3, 7.4, -189); brazier(K, 3, 7.4, -189);
  // arena + lighthouse
  lanternString(K, [-12.5, 9, -242], [-15.7, 4.2, -273.4], 0.7); lanternString(K, [12.5, 9, -244], [15.7, 4.2, -273.4], 0.7);
  for (const [x, z] of [[-6, -292], [6, -292]]) brazier(K, x, 3, z);
  for (const [x, z] of [[-14, -318], [14, -318]]) brazier(K, x, 3, z);

  // ================================================================ BACKDROP + VISTA
  // ================================================================ CARIBBEAN BEACHES
  const { hut, rowboat, driftwood, torchPost } = KIT;
  for (const [x, z, ry] of [[-16, 3.5, 0.2], [17, 2.5, -0.3], [-30, -10, Math.PI / 2], [26, -100, 2.6], [-24, -98, 3.4]]) hut(K, x, hAt(x, z), z, ry);
  for (const [x, z, ry, t] of [[-9, 9, 0.6, 0.15], [9.5, 8, -0.4, -0.1], [13, -128, 1.2, 0.12], [-28, -250, 0.4, 0.1]]) rowboat(K, x, Math.max(0, hAt(x, z)) - 0.15, z, ry, t);
  for (let i = 0; i < 18; i++) { const a = i * 2.4, x = Math.cos(a) * 40, z = -42 + Math.sin(a) * 38; const h = hAt(x, z); if (h > 0.2 && h < 1.4) driftwood(K, x, h, z, a); }
  for (const [x, z] of [[-13, 5.5], [14, 5], [-6, -84.5], [6, -84.5]]) torchPost(K, x, hAt(x, z), z);
  // shipwreck on the reef east of town
  { const wreck = ship(K, 36, -0.8, -12, 2.2, 1.0, { sail: MAT.canvasRed, flags: false }); wreck.rotation.z = 0.32; wreck.rotation.x = -0.12; }
  // buried treasure: Cubey must ground-slam the stomp switch
  { const cx = -20, cz = -1, cy = hAt(cx, cz); const chest = E(new Chest(G, cx - 2.2, hAt(cx - 2.2, cz - 1.5), cz - 1.5, 0.5, 40)); E(new SlamSwitch(G, cx, cy, cz, () => chest.unlock())); }

  finishLevel(G, L, { foliageExtra: F => {
  // tufts at the base of walls and in paving cracks
  F.edge(-6.9, -2.2, -6.9, -30.5, 2.2, 3); F.edge(9.4, -2.5, 9.4, -30.5, 2.2, 1.5);
  F.edge(-14.3, -44.5, -14.3, -73.5, 2.2, 3); F.edge(14.3, -44.5, 14.3, -73.5, 2.2, 3); F.edge(-21.5, -73.6, -3.2, -73.6, 2.2, 3); F.edge(3.2, -73.6, 21.5, -73.6, 2.2, 3);
  F.edge(-13.8, -140.5, -13.8, -171.5, 4.2, 3); F.edge(13.8, -140.5, 13.8, -171.5, 4.2, 3); F.edge(-14, -171.7, 14, -171.7, 4.2, 3);
  F.edge(-3, -30.9, -3, -44, 2.2, 2); F.edge(3, -30.9, 3, -44, 2.2, 2);
  F.edge(-7.8, -78.3, -7.8, -83.8, 2.2, 3); F.edge(7.8, -78.3, 7.8, -83.8, 2.2, 3);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; F.edge(Math.cos(a) * 3.3, -58 + Math.sin(a) * 3.3, Math.cos(a + 0.16) * 3.3, -58 + Math.sin(a + 0.16) * 3.3, 2.2, 6, 0.3); }
  // planters & bushes
  for (const [x, z] of [[-5.6, -3.6], [-5.4, -27.5]]) F.planter(x, 2.8, z, 0.9);
  F.bushes([[-12.8, 2.2, -47.5, 1.0], [12.8, 2.2, -72.5, 1.1], [-12.8, 2.2, -72.6, 1.2], [-13.2, 4.2, -141.8, 1.0], [13.2, 4.2, -141.8, 1.0], [-6.8, 2.2, -79, 0.9], [6.8, 2.2, -79, 0.9],
    [-4.8, 1.6, -136.5, 0.9], [4.8, 1.6, -136.5, 0.9], [-17, 3, -290, 1.3], [16, 3, -291, 1.1], [-19, 3, -305, 1.4], [19, 3, -312, 1.3], [-6.5, 2.2, -1.9, 0.8], [6.5, 2.2, -1.9, 0.8]]);
  } });
  G.objective('Head into Saltgear Harbor');
  return { start: { x: 0, y: 1.6, z: 21 } };
}

