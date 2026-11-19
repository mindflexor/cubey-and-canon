// Level 4: Cinderpeak Forge — a volcanic island where the Rustwake orcs cast their cannons.
// Lava replaces water as the main hazard; flame vents, crumbling basalt, a heavy-plate forge lift,
// a target-raised bridge, a slam-switch path, a caldera-rim grind rail and a forge-floor arena.
import * as T from 'three';
import { MAT } from '../materials.js';
import { box, cyl, sph, rbox, xf } from '../geo.js';
import * as KIT from '../kit.js';
import { Barricade, Plate, Mover, Rail, Target, SlamSwitch, Crumble, RiseBlocks, Hazard, FlameJet } from '../entities.js';
import { Bilgebot, Brute, Bomber, Gull, Turret } from '../enemies.js';
import { beginLevel, finishLevel, arena, mapPiece } from '../levelkit.js';

const { quay, deck, railing, wallSegment, lamp, barrel, decorCrate, rock, brazier, banner, pipe, torchPost, cannonProp, ballPile, crane } = KIT;

// Local stairs (kit.stairs currently makes every step a full-height block): one slice per step,
// ascending toward `dir`, each slice solid down to y0 - 1.
function stairs(K, x0, x1, z0, z1, y0, y1, dir, mat = MAT.flagstone) {
  const n = Math.max(1, Math.ceil((y1 - y0) / 0.3)), dh = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, top = y0 + dh * (i + 1);
    let a, b;
    if (dir === '-z') { a = [x0, y0 - 1, z1 - (z1 - z0) * t1]; b = [x1, top, z1 - (z1 - z0) * t0]; }
    else if (dir === '+z') { a = [x0, y0 - 1, z0 + (z1 - z0) * t0]; b = [x1, top, z0 + (z1 - z0) * t1]; }
    else if (dir === '-x') { a = [x1 - (x1 - x0) * t1, y0 - 1, z0]; b = [x1 - (x1 - x0) * t0, top, z1]; }
    else { a = [x0 + (x1 - x0) * t0, y0 - 1, z0]; b = [x0 + (x1 - x0) * t1, top, z1]; }
    K.B.add(xf(rbox(b[0] - a[0], b[1] - a[1], b[2] - a[2], 0.04), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), mat, 2);
    K.W.add(a, b);
  }
}

// gameplay corridor kept free of palms / jungle scatter
const KEEP_OUT = [[-36, 36, -366, -26], [-16, 16, -27, 30]];

export const info = { name: 'Cinderpeak Forge', tag: 'Shut down the orcs’ cannon forge inside the volcano', golden: 3 };

export function build(G) {
  const L = beginLevel(G, {
    seed: 4404, keepOut: KEEP_OUT,
    sky: { zenith: 0x2e2226, horizon: 0xd9824e, fog: 0xa8644a, ground: 0x3a2a26, sun: 0xff9c6a, sunI: 2.7, hemi: 0.55, fogNear: 70, fogFar: 520, water: 0x1c2a2e, exposure: 0.88 },
  });
  const { K, E, EN, crate } = L;
  L.TM.color.set(0x6a605a); // dark volcanic sand / scorched scrub

  // ================================================================ ISLANDS
  // Main island: one long corridor of flats — 1.0 m ground under pads, 0.2 m channels filled with lava.
  const isl = L.island({
    cx: 0, cz: -165, rx: 62, rz: 262, seed: 7.7, peak: 16, hills: 0.9, cliffs: 1.5,
    flats: [
      [-36, 36, -366, 0, 1.0, 6],      // whole gameplay corridor
      [-30, 30, 0, 22, 1.1, 6],        // dark-sand landing beach
      [-50, 50, 29, 80, -2.6, 6],      // open sea off the beach
      [-20, 20, -96, -27, 0.2, 2.5],   // lava river + flame-vent channel
      [-20, 20, -190, -170, 0.2, 2.5], // lava pool (slam path)
      [-32, 32, -256, -214, 0.2, 3],   // caldera lava lake under the rail
      [-34, 34, -364, -256, 0.2, 3],   // lava moat around the forge floor
    ],
  });
  // Cinderpeak itself: a smoking volcano dominating the skyline
  const volc = L.island({ cx: 125, cz: -235, rx: 88, rz: 82, seed: 9.3, peak: 105, hills: 0.6, res: 4, cliffs: 3 });
  const hAt = L.hAt;

  // lava everywhere the corridor drops away
  E(new Hazard(G, -20, 20, -96, -27, 0.7, 'lava'));
  E(new Hazard(G, -12, 12, -134, -122, 1.4, 'lava'));
  E(new Hazard(G, -20, 20, -190, -170, 0.7, 'lava'));
  E(new Hazard(G, -32, 32, -256, -214, 0.7, 'lava'));
  E(new Hazard(G, -34, 34, -364, -256, 0.7, 'lava'));

  const plateFloor = { topMat: MAT.plate, wallMat: MAT.basalt, coping: false };
  const basaltPad = { topMat: MAT.basalt, wallMat: MAT.basalt, coping: false };

  const target = (x, y, z, ry, fn) => {
    const t = E(new Target(G, x, y, z, ry, fn));
    const s = G.world.add([x - 0.62, y + 1.58, z - 0.08], [x + 0.62, y + 2.82, z + 0.08], { walkable: false, cam: false });
    G.updaters.push(() => { if (t.done) s.active = false; });
    return t;
  };

  // ================================================================ 1. LANDING BEACH
  deck(K, -3, 3, 12, 27, 1.6);
  railing(K, [[-2.8, 1.6, 26.8], [-2.8, 1.6, 13]]); railing(K, [[2.8, 1.6, 26.8], [2.8, 1.6, 13]]);
  for (const z of [24, 16]) { lamp(K, -2.55, 1.6, z, Math.PI / 2); }
  for (const [x, z] of [[-9, 8], [10, 6], [-14, 14], [15, 15]]) torchPost(K, x, hAt(x, z), z);
  for (const [x, z, s] of [[-18, 4, 2.2], [19, 9, 2.6], [-24, 16, 3], [24, -4, 2.4]]) rock(K, x, hAt(x, z), z, s, s * 0.8, s, x + z, MAT.basalt);
  barrel(K, 6, hAt(6, 10), 10); barrel(K, 6.8, hAt(6.8, 10.6), 10.6, 0.9); decorCrate(K, -6, hAt(-6, 9), 9, 1.1, 0.3);
  crate(-4, hAt(-4, 4), 4); crate(5, hAt(5, 2), 2); crate(-8, hAt(-8, 12), 12);
  EN(new Bilgebot(G, -5, hAt(-5, 6), 6)); EN(new Bilgebot(G, 6, hAt(6, 4), 4));
  L.hint(0, 20, 5, 'Cinderpeak Forge. The ground past the forge gate is LAVA. One touch burns, so watch your footing!', 'l4intro');
  G.objective('Break into the Cinderpeak forge');

  // ================================================================ 2. FORGE GATE (iron barricade under turret fire)
  stairs(K, -4, 4, 0, 3, 1.1, 2.4, '-z', MAT.basalt);
  quay(K, -14, 14, -26, 0, 2.4, plateFloor);
  wallSegment(K, -16, -3, -28, -25, 6.4, 2.4); wallSegment(K, 3, 16, -28, -25, 6.4, 2.4);
  for (const x of [-16.5, 16.5]) wallSegment(K, x - 0.5, x + 0.5, -26, 0, 4.6, 2.4, false);
  const gateBar = E(new Barricade(G, 0, 2.4, -26.5, 6, 3.6, true, 0));
  gateBar.onBreak = () => { G.objective('Cross the lava river'); G.hint('The gate is down! Beyond lies a river of lava.', 4, 'l4gate'); };
  EN(new Turret(G, -9, 7.4, -26.5, 0)); EN(new Turret(G, 9, 7.4, -26.5, 0));
  for (const [x, z, w] of [[-5, -10, 3.5], [5, -15, 3.5], [0, -20, 4]]) {
    K.B.add(xf(rbox(w, 1.1, 0.8, 0.12), x, 2.95, z), MAT.basalt, 2); K.W.add([x - w / 2, 2.4, z - 0.4], [x + w / 2, 3.5, z + 0.4]);
  }
  crate(-11, 2.4, -6, 'boom'); crate(11, 2.4, -20, 'boom'); crate(-11, 2.4, -22); crate(11, 2.4, -4);
  L.checkpoint(0, 2.4, -3);
  L.hint(0, -4, 5, 'Turrets on the wall! Cubey: hold RIGHT MOUSE to shield or drop cubes as cover. Canon: HOLD fire to charge a heavy shot through the iron gate.', 'l4gatehint');
  banner(K, -8, 6.0, -24.95, 0, 3, MAT.canvasRed); banner(K, 8, 6.0, -24.95, 0, 3, MAT.canvasRed);
  pipe(K, [[-13.5, 2.5, -24.8], [-13.5, 6.0, -24.8], [-3.5, 6.0, -24.8]], 0.13); pipe(K, [[13.5, 2.5, -24.8], [13.5, 6.0, -24.8], [3.5, 6.0, -24.8]], 0.13);

  // ================================================================ 3. LAVA RIVER (crumbling basalt + sliding forge plate)
  E(new Crumble(G, 0, 2.4, -30.5, 2.2, 2.2, MAT.basalt));
  E(new Crumble(G, 1.5, 2.4, -34.6, 2.2, 2.2, MAT.basalt));
  E(new Mover(G, [-5, 2.4, -39.6], [5, 2.4, -39.6], 3, 3, 3.6, { kind: 'lift' }));
  E(new Crumble(G, -1, 2.4, -44.6, 2.2, 2.2, MAT.basalt));
  E(new Crumble(G, 1, 2.8, -48.6, 2.2, 2.2, MAT.basalt));
  E(new Crumble(G, 0, 3.2, -52.6, 2.2, 2.2, MAT.basalt));
  // golden gear 1: jump off the sliding plate at the far end of its run
  quay(K, 9, 11.4, -41.2, -38.8, 4.4, basaltPad);
  L.golden(10.2, 4.4, -40, 'l4_lavapillar');
  L.hint(0, -27, 4, 'Cracked basalt crumbles under your weight. Keep moving and ride the sliding forge plate!', 'l4crumble');
  quay(K, -8, 8, -62, -55, 2.4, basaltPad);
  L.checkpoint(0, 2.4, -57.5);
  brazier(K, -6.5, 2.4, -56); brazier(K, 6.5, 2.4, -56);

  // ================================================================ 4. FLAME-VENT CAUSEWAY (timing gauntlet under bomb fire)
  quay(K, -2.6, 2.6, -95, -62, 2.4, plateFloor);
  [[0, -66, 0], [-1.3, -70, 0.33], [1.3, -74, 0.66], [0, -78, 0.15], [-1.3, -82, 0.5], [1.3, -86, 0.82], [0, -90, 0.3]]
    .forEach(([x, z, ph]) => E(new FlameJet(G, x, 2.4, z, 2.4, ph, 3.2)));
  L.hint(0, -62, 3.5, 'Flame vents puff smoke right before they erupt. Time your dash between the bursts!', 'l4jets');
  quay(K, 6, 9, -99, -96, 4.6, basaltPad);
  EN(new Bomber(G, 7.5, 4.6, -97.5));
  for (let z = -64; z > -94; z -= 6) { K.B.add(xf(cyl(0.1, 0.1, 1.4, 6), -2.45, 3.1, z), MAT.ironDark, 'keep'); K.B.add(xf(cyl(0.1, 0.1, 1.4, 6), 2.45, 3.1, z), MAT.ironDark, 'keep'); }
  // forge chimneys flanking the river
  const chimney = (x, z, h, r = 1.6) => {
    const g = hAt(x, z);
    K.B.add(xf(cyl(r * 0.85, r, h, 14), x, g + h / 2, z), MAT.brickDark, 3);
    K.B.add(xf(cyl(r * 0.95, r * 0.95, 0.5, 14), x, g + h + 0.25, z), MAT.ironDark, 1);
    K.W.add([x - r, g - 1, z - r], [x + r, g + h, z + r]);
    K.chimneys.push(new T.Vector3(x, g + h + 0.6, z));
  };
  chimney(-26, -46, 18); chimney(27, -70, 22); chimney(-27, -88, 16, 1.3); chimney(25, -30, 14, 1.2);

  // ================================================================ 5. HEAVY-PLATE FORGE LIFT (Cubey weight + Canon lock)
  quay(K, -12, 12, -104, -95, 2.4, plateFloor);
  E(new Hazard(G, -12, 12, -108, -104, 1.4, 'lava')); // lift shaft trench
  const heavy = E(new Plate(G, -5, 2.4, -101, 2));
  let liftLock = false;
  target(10.5, 2.4, -101.5, 0, g => { liftLock = true; g.hint('The lift lock is open. Weigh down the heavy plate and ride it up!', 4, 'l4lock'); });
  // rises only while the heavy plate is held AND someone stands on it; drops back when empty
  const lift = E(new Mover(G, [6, 2.4, -105.8], [6, 9.4, -105.8], 3, 3, 3.5, { kind: 'lift', control: () => heavy.on && liftLock && G.heroes.some(h => h.body.grounded && h.body.ground === lift.solid) }));
  for (const sx of [-1, 1]) K.B.add(xf(box(0.3, 9.4, 0.3), 6 + sx * 1.8, 5.7, -105.8), MAT.ironDark, 1);
  K.B.add(xf(box(4, 0.3, 0.4), 6, 10.6, -105.8), MAT.ironDark, 1);
  pipe(K, [[-5, 2.5, -102.2], [-5, 2.5, -103.8], [3.8, 2.5, -103.8], [3.8, 9.0, -107.6]], 0.12, MAT.brass);
  L.hint(-2, -99, 5, 'This forge lift is chained down. Canon must shoot its lock TARGET, and Cubey must hold the HEAVY plate down with 2 stacked cubes.', 'l4lift');
  // golden gear 2: a 4 m ledge that needs two stacked cubes
  quay(K, -12, -9, -100, -96, 6.4, basaltPad);
  L.golden(-10.5, 6.4, -98, 'l4_highledge');
  crate(9, 2.4, -97, 'health'); crate(-10, 2.4, -105);
  EN(new Bilgebot(G, 0, 2.4, -103)); EN(new Bilgebot(G, -6, 2.4, -97));
  cannonProp(K, 9.5, 2.4, -100.5, -0.4); ballPile(K, 10.5, 2.4, -103);

  // ================================================================ 6. UPPER FOUNDRY: TARGET BRIDGE OVER THE CRUCIBLE PIT
  quay(K, -12, 12, -122, -108, 9.4, plateFloor);
  L.checkpoint(-3, 9.4, -111);
  const bridge = E(new RiseBlocks(G, [[0, 9.4, -123.1, 3, 1, 2.1], [0, 9.4, -125.2, 3, 1, 2.1], [0, 9.4, -127.3, 3, 1, 2.1], [0, 9.4, -129.4, 3, 1, 2.1], [0, 9.4, -131.5, 3, 1, 2.1], [0, 9.4, -133.4, 3, 1, 1.8]], MAT.plateRust, 6));
  quay(K, -12, 12, -152, -134, 9.4, plateFloor);
  target(3.5, 9.4, -135.2, 0, () => bridge.trigger());
  L.hint(0, -118, 5, 'A crucible pit! Shoot the TARGET on the far side with Canon to slide out the bridge.', 'l4bridge');
  EN(new Turret(G, -8, 9.4, -147, 0)); EN(new Turret(G, 8, 9.4, -147, 0));
  EN(new Bilgebot(G, -4, 9.4, -142)); EN(new Bilgebot(G, 4, 9.4, -144)); EN(new Brute(G, 0, 9.4, -148));
  crate(-10, 9.4, -137); crate(10, 9.4, -150, 'boom');
  for (const [x, z, w] of [[-6, -139, 3], [6, -140, 3]]) { K.B.add(xf(rbox(w, 1.1, 0.8, 0.12), x, 9.95, z), MAT.plate, 2); K.W.add([x - w / 2, 9.4, z - 0.4], [x + w / 2, 10.5, z + 0.4]); }
  // hanging crucibles of molten metal over the pit
  for (const [x, z] of [[-7, -128], [7, -127]]) {
    K.B.add(xf(cyl(0.05, 0.05, 6, 6), x, 15, z), MAT.ironDark, 'keep');
    K.B.add(xf(cyl(1.0, 0.7, 1.2, 16), x, 11.4, z), MAT.ironDark, 1);
    K.B.add(xf(cyl(0.9, 0.9, 0.1, 16), x, 12.0, z), MAT.lava, 1);
    K.fires.push(new T.Vector3(x, 12.1, z));
  }
  crane(K, -10, 9.4, -116, 0.6);

  // ================================================================ 7. LAVA POOL: SLAM-RAISED STEPPING STONES + BARRICADE
  stairs(K, -3, 3, -160, -152, 4.4, 9.4, '+z', MAT.basalt);
  quay(K, -10, 10, -170, -160, 4.4, basaltPad);
  for (const x of [-10.5, 10.5]) wallSegment(K, x - 0.5, x + 0.5, -170, -152, 7.4, 4.4, false);
  const steps = E(new RiseBlocks(G, [[-2, 4.4, -173, 2, 4.4, 2], [1, 4.4, -177, 2, 4.4, 2], [-1, 4.4, -181, 2, 4.4, 2], [2, 4.4, -185, 2, 4.4, 2], [0, 4.4, -188.6, 2.4, 4.4, 2]], MAT.basalt, 5));
  E(new SlamSwitch(G, 0, 4.4, -165.5, () => { steps.trigger(); G.hint('Basalt pillars rise from the lava!', 3, 'l4steps'); }));
  quay(K, -10, 10, -205, -190, 4.4, basaltPad);
  wallSegment(K, -10, -3, -191.2, -190.2, 8.0, 4.4, false); wallSegment(K, 3, 10, -191.2, -190.2, 8.0, 4.4, false);
  const poolBar = E(new Barricade(G, 0, 4.4, -190.7, 6, 3.4, false, 0));
  poolBar.onBreak = () => G.hint('Path clear! Now raise a way across the lava.', 3, 'l4poolbar');
  L.hint(0, -164, 4, 'Two jobs here: Canon must blast the barricade across the pool, and Cubey must ground-slam the stomp switch.', 'l4pool');
  EN(new Bomber(G, 6, 4.4, -198)); EN(new Bilgebot(G, -5, 4.4, -197));
  L.checkpoint(0, 4.4, -193.5);

  // ================================================================ 8. CALDERA-RIM GRIND RAIL
  quay(K, -6, 6, -214, -205, 7.6, basaltPad);
  L.hint(0, -201, 4, 'The rim is too high to jump. Stack a cube against the wall, then leap onto the grind rail!', 'l4rim');
  G.rails.push(new Rail(G, [[0, 8.2, -209.5], [0, 8.0, -216], [-7, 7.2, -226], [-11, 6.4, -236], [-7, 5.6, -246], [0, 5.0, -253], [0, 4.9, -258.5]]));
  brazier(K, -4.5, 7.6, -206); brazier(K, 4.5, 7.6, -206);
  for (const [x, z, s] of [[-24, -224, 3], [22, -232, 3.6], [-20, -248, 2.6], [25, -246, 2.8]]) rock(K, x, 0.4, z, s, s * 1.6, s, x * z, MAT.basalt);

  // ================================================================ 9. GAUNTLET: BRUTE + BOMBERS + TURRET NEST
  quay(K, -12, 12, -296, -256, 4.4, plateFloor);
  L.checkpoint(0, 4.4, -260.5);
  for (const [x, z, w] of [[-6, -270, 3.5], [6, -276, 3.5], [0, -284, 4], [-8, -288, 2.5], [8, -289, 2.5]]) {
    K.B.add(xf(rbox(w, 1.1, 0.8, 0.12), x, 4.95, z), MAT.basalt, 2); K.W.add([x - w / 2, 4.4, z - 0.4], [x + w / 2, 5.5, z + 0.4]);
  }
  quay(K, -12, 12, -304, -296, 7.4, plateFloor);
  stairs(K, -2, 2, -296, -292, 4.4, 7.4, '-z', MAT.basalt);
  EN(new Turret(G, -8, 7.4, -300, 0)); EN(new Turret(G, 8, 7.4, -300, 0)); EN(new Bomber(G, -3.5, 7.4, -301));
  EN(new Brute(G, 0, 4.4, -280)); EN(new Bilgebot(G, -6, 4.4, -285)); EN(new Bilgebot(G, 6, 4.4, -287));
  crate(-10, 4.4, -262, 'health'); crate(10, 4.4, -266); crate(-10, 4.4, -292, 'boom');
  // golden gear 3: crumbling basalt detour west of the gauntlet
  E(new Crumble(G, -15, 4.4, -262, 2.0, 2.0, MAT.basalt));
  E(new Crumble(G, -19, 4.6, -266, 2.0, 2.0, MAT.basalt));
  E(new Crumble(G, -23, 4.8, -270, 2.0, 2.0, MAT.basalt));
  quay(K, -28.4, -25.6, -275.4, -272.6, 5.0, basaltPad);
  L.golden(-27, 5.0, -274, 'l4_crumblepillar');

  // ================================================================ 10. FORGE FLOOR ARENA
  quay(K, -20, 20, -352, -304, 7.4, plateFloor);
  L.checkpoint(0, 7.4, -307.5);
  for (const [x, z] of [[-17, -320], [17, -324], [-16, -344], [16, -346]]) { cannonProp(K, x, 7.4, z, x < 0 ? Math.PI / 2 : -Math.PI / 2); ballPile(K, x, 7.4, z + 2.5); }
  // cooling cannon molds lying on the forge floor
  for (const [x, z, ry] of [[-11, -330, 0.3], [11, -336, -0.4]]) {
    K.B.add(xf(cyl(0.9, 1.1, 5, 16), x, 8.5, z, 0, ry, Math.PI / 2), MAT.ironDark, 1);
    K.B.add(xf(cyl(0.55, 0.55, 0.05, 16), x + Math.cos(ry) * 2.52, 8.5, z - Math.sin(ry) * 2.52, 0, ry, Math.PI / 2), MAT.lava, 1);
    K.W.add([x - 2.6, 7.4, z - 2.6], [x + 2.6, 9.6, z + 2.6]);
  }
  crane(K, -15, 7.4, -310, 0.8); crane(K, 15, 7.4, -350, -2.3);
  chimney(-24, -330, 20, 1.8); chimney(24, -316, 24, 2); chimney(-23, -356, 18, 1.5); chimney(23, -352, 16, 1.4);
  for (const [x, z] of [[-18, -306], [18, -306], [-18, -350], [18, -350]]) brazier(K, x, 7.4, z);
  banner(K, 0, 13, -352.1, 0, 4.5, MAT.canvasRed);
  K.B.add(xf(box(16, 6, 1), 0, 10.4, -352.6), MAT.brickDark, 3); K.W.add([-8, 7.4, -353.2], [8, 13.4, -352]);
  arena(G, L, {
    x: 0, z: -312, r: 7, yMin: 7, title: 'Forge wave',
    onStart: g => { g.objective('Defend the forge floor'); g.hud.banner('The forge foremen attack!', 'Survive three waves'); },
    waves: [
      () => [new Bilgebot(G, -10, 7.4, -330), new Bilgebot(G, 10, 7.4, -332), new Bilgebot(G, 0, 7.4, -340), new Bomber(G, 0, 7.4, -348)],
      () => [new Brute(G, 0, 7.4, -338), new Bilgebot(G, -12, 7.4, -326), new Bilgebot(G, 12, 7.4, -326), new Gull(G, -8, 14, -330), new Gull(G, 8, 14, -334)],
      () => [new Brute(G, -8, 7.4, -340), new Brute(G, 8, 7.4, -340), new Bomber(G, -14, 7.4, -348), new Bomber(G, 14, 7.4, -348), new Gull(G, 0, 15, -332)],
    ],
    onDone: g => { g.objective('Grab the treasure map piece'); g.hud.banner('The forge falls silent!', 'Map piece 4 is on the anvil'); mapPiece(g, L, 0, 7.4, -344, 'Treasure Map Piece 4'); },
  });

  // ================================================================ VOLCANO, ASH AND EMBERS
  const peakY = volc.height(125, -235);
  const crater = new T.Mesh(sph(14, 20, 12), MAT.lava); crater.scale.set(1, 0.25, 1); crater.position.set(125, peakY - 3, -235); G.scene.add(crater);
  G.updaters.push((dt, g) => {
    // volcanic plume
    if (Math.random() < dt * 6) g.fx.smoke.emit(125 + (Math.random() - 0.5) * 10, peakY, -235 + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 2, 6 + Math.random() * 4, -1, 18 + Math.random() * 10, 9, 0.22, 0.2, 0.2, { grow: 2.5, drag: 0.15, alpha: 0.55 });
    // falling ash + drifting embers around the player
    const p = g.active.pos;
    if (Math.random() < dt * 22) g.fx.smoke.emit(p.x + (Math.random() - 0.5) * 40, p.y + 10 + Math.random() * 6, p.z + (Math.random() - 0.5) * 40, 0.4, -1.2, 0.2, 0.16, 7, 0.32, 0.3, 0.3, { grow: 1, drag: 0.1, alpha: 0.7 });
    if (Math.random() < dt * 10) g.fx.glow.emit(p.x + (Math.random() - 0.5) * 30, p.y - 1 + Math.random() * 4, p.z + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6, 0.12, 3, 1, 0.5, 0.15, { drag: 0.3 });
  });
  for (const [x, z] of [[-30, -110], [30, -150], [-30, -190], [31, -280], [-32, -300]]) chimney(x, z, 12 + Math.abs(x) % 7, 1.3);
  // This level packs many high-poly goblins along one corridor: don't draw the ones far from the player
  G.updaters.push((dt, g) => {
    const p = g.active.pos;
    for (const e of g.enemies) if (e.root && !e.name) e.root.visible = !e.dead && e.root.position.distanceToSquared(p) < 75 * 75;
  });

  finishLevel(G, L, {
    palms: 0.3, foliage: 0.35, ships: 2, gulls: 4,
    far: [[-210, -150, 50, 40, 26, 4.4], [-170, -430, 70, 60, 48, 6.6], [230, 40, 40, 40, 18, 5.1], [300, -480, 90, 80, 60, 3.9]],
  });
  return { start: { x: 0, y: 1.6, z: 23 } };
}
void decorCrate;
