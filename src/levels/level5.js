// Level 5: Skullrock Fortress — storm-lit siege of Admiral Ironclaw's stronghold and the final boss.
import * as T from 'three';
import { MAT } from '../materials.js';
import { cyl, sph, box, rbox, xf } from '../geo.js';
import * as KIT from '../kit.js';
import { Barricade, Plate, Gate, Mover, Rail, Target, Crumble, RiseBlocks, FlameJet, Trigger } from '../entities.js';
import { Bilgebot, Brute, Bomber, Gull, Turret, Ironclaw } from '../enemies.js';
import { beginLevel, finishLevel, arena } from '../levelkit.js';

const { quay, deck, stairs, railing, tower, wallSegment, lamp, barrel, decorCrate, rock, ship, rowboat, brazier, banner, cannonProp, ballPile, torchPost } = KIT;
const KEEP_OUT = [[-8, 8, -2, 32], [-30, 30, -330, -38]];

export const info = { name: 'Skullrock Fortress', tag: 'Storm Ironclaw’s stronghold and end the Rustwake for good', golden: 3 };

export function build(G) {
  const L = beginLevel(G, {
    seed: 77, keepOut: KEEP_OUT,
    sky: { zenith: 0x231c48, horizon: 0xd9805e, fog: 0x7a5a74, ground: 0x2a2c3a, sun: 0xffa060, sunI: 2.6, hemi: 0.55, water: 0x08283a, exposure: 0.95, fogNear: 120, fogFar: 900 },
  });
  const { K, E, EN, crate } = L;
  const hAt = L.hAt;

  // ================================================================ ISLANDS
  L.island({ cx: 0, cz: 16, rx: 26, rz: 17, seed: 3.7, peak: 3, hills: 0.4, flats: [[-6, 6, 8, 30, 1.0, 3]] });
  L.island({
    cx: 0, cz: -175, rx: 82, rz: 140, seed: 7.7, peak: 40, cliffs: 4,
    flats: [[-26, 26, -92, -40, 1.4, 6], [-24, 24, -142, -96, 1.4, 4], [-26, 26, -230, -186, 1.4, 4], [-14, 14, -252, -226, 1.4, 2], [-27, 27, -322, -278, 6.0, 5], [-60, 60, -184, -146, -2.6, 3]],
  });

  // ================================================================ 1. LANDING DOCK ON THE REEF
  deck(K, -3, 3, 8, 28, 1.6);
  railing(K, [[-2.8, 1.6, 27.8], [2.8, 1.6, 27.8]]);
  rowboat(K, 4.5, 0, 22, 0.3, 0.05); rowboat(K, -5, 0, 14, -0.4, 0.05);
  for (const z of [24, 14]) lamp(K, -2.6, 1.6, z, Math.PI / 2);
  crate(1.6, 1.6, 18); crate(-1.6, 1.6, 12, 'health');
  L.hint(0, 22, 4, 'This is it — Ironclaw’s fortress. Expect heavy resistance and fewer supplies!', 'l5intro');
  ship(K, 22, 0.8, 30, 0.4, 1.3, { sail: MAT.canvasRed });

  // ================================================================ 2. STORMY CROSSING (raft, buoys, crumbling posts)
  E(new Mover(G, [0, 1.0, 5.5], [0, 1.0, -15], 4, 4, 7, { kind: 'barge' }));
  E(new Mover(G, [-1.6, 1.4, -19.5], [-1.6, 1.4, -19.5], 2.2, 2.2, 5, { kind: 'buoy', bob: 0.6, phase: 0.1 }));
  E(new Mover(G, [1.6, 1.4, -24], [1.6, 1.4, -24], 2.2, 2.2, 5, { kind: 'buoy', bob: 0.6, phase: 0.55 }));
  for (const [x, z] of [[-0.8, -28.5], [0.8, -32.5]]) { E(new Crumble(G, x, 1.5, z, 2.0, 2.0, MAT.planks)); K.B.add(xf(cyl(0.2, 0.25, 4, 8), x, -0.5, z), MAT.woodDark, 'keep'); }
  EN(new Gull(G, -6, 8, -22)); EN(new Gull(G, 6, 9, -28));
  L.hint(0, 6, 3, 'Ride the raft, hop the buoys, and keep moving — those posts will not hold your weight for long!', 'l5cross');

  // ================================================================ 3. BEACH GAUNTLET (bombers on the cliffs)
  L.checkpoint(0, hAt(0, -42), -42);
  for (const [x, z, s] of [[-7, -58, 1.6], [6, -64, 1.8], [-3, -74, 1.5], [9, -80, 1.4], [-10, -84, 1.7]]) {
    rock(K, x, 1.2, z, s * 1.2, s, s * 1.1, x * 3 + z, MAT.rockDark); K.W.add([x - s, 0, z - s * 0.9], [x + s, 1.2 + s * 0.9, z + s * 0.9]);
  }
  for (const sx of [-1, 1]) { quay(K, sx * 16 - 3, sx * 16 + 3, -74, -66, 6.5, { topMat: MAT.basalt, wallMat: MAT.rockDark, coping: false }); EN(new Bomber(G, sx * 16, 6.5, -70)); }
  EN(new Bilgebot(G, -5, 1.6, -62)); EN(new Bilgebot(G, 5, 1.6, -68)); EN(new Bilgebot(G, 0, 1.6, -80)); EN(new Brute(G, 0, 1.6, -86));
  crate(-12, 1.6, -60); crate(12, 1.6, -78); crate(-9, 1.6, -76, 'boom');
  // golden gear #1: a sea-stack ledge that needs two stacked cubes
  quay(K, -24, -20, -66, -60, 5.6, { topMat: MAT.basalt, wallMat: MAT.rockDark, coping: false });
  L.golden(-22, 5.6, -63, 'l5stack');

  // ================================================================ 4. SEA WALL (iron gate under turret fire)
  wallSegment(K, -44, -3.2, -97, -92, 10, 1.4); wallSegment(K, 3.2, 44, -97, -92, 10, 1.4);
  tower(K, -5.5, -94.5, 2.6, 11, { ground: 1.4 }); tower(K, 5.5, -94.5, 2.6, 11, { ground: 1.4 });
  K.B.box(MAT.brick, 6.4, 3.2, 5, 0, 8.4, -94.5, 0, 3); K.W.add([-3.2, 6.8, -97], [3.2, 10, -92]);
  EN(new Turret(G, -12, 10, -93.6, 0)); EN(new Turret(G, 12, 10, -93.6, 0));
  const seaGate = E(new Barricade(G, 0, 1.4, -94.5, 6.2, 5.2, true, 0));
  seaGate.onBreak = () => G.objective('Open the inner gate');
  for (const x of [-20, -12, 12, 20]) banner(K, x, 9.5, -91.9, 0, 4, MAT.flag);
  L.hint(0, -88, 5, 'Turrets on the wall! Cover Canon with Cubey’s shield, then swap and charge a HEAVY shot at the iron gate.', 'l5gate');
  L.trigger(0, -46, 6, g => g.objective('Break through the sea wall'));

  // ================================================================ 5. LOWER BAILEY (two heavy plates + target-raised stairs)
  L.checkpoint(0, 1.4, -100);
  wallSegment(K, -26, -24, -142, -97, 9, 1.4); wallSegment(K, 24, 26, -142, -97, 9, 1.4);
  wallSegment(K, -26, -3.2, -146, -142, 10, 1.4); wallSegment(K, 3.2, 26, -146, -142, 10, 1.4);
  K.B.box(MAT.brick, 6.4, 3.4, 4, 0, 8.3, -144, 0, 3); K.W.add([-3.2, 6.6, -146], [3.2, 10, -142]);
  // gun platform (3.2 m) with the second heavy plate on top
  quay(K, 7, 13, -132, -124, 4.6, { topMat: MAT.flagstone, coping: true });
  cannonProp(K, 12, 4.6, -125, Math.PI); ballPile(K, 8, 4.6, -131);
  const pA = E(new Plate(G, -9, 1.4, -128, 2)), pB = E(new Plate(G, 10, 4.6, -128, 2));
  const steps = E(new RiseBlocks(G, [[2.7, 2.3, -128, 1.4, 0.9, 2.2], [4.1, 3.2, -128, 1.4, 1.8, 2.2], [5.5, 4.1, -128, 1.4, 2.7, 2.2], [6.6, 4.6, -128, 0.9, 3.2, 2.2]], MAT.brick));
  E(new Target(G, -20, 1.4, -134, Math.PI / 2, g => { steps.trigger(); g.hint('Stone steps rose up to the gun platform!', 3, 'l5steps'); }));
  const innerGate = E(new Gate(G, 0, 1.4, -144, 6, 6, [pA, pB]));
  innerGate.onOpen = () => G.objective('Cross the burning causeway');
  L.hint(0, -112, 7, 'BOTH plates are heavy (2 cubes each) — that is all four of your cubes. Shoot the TARGET on the west wall to raise steps to the gun platform.', 'l5plates');
  EN(new Bilgebot(G, -6, 1.4, -112)); EN(new Bilgebot(G, 6, 1.4, -118)); EN(new Bomber(G, -14, 1.4, -136)); EN(new Brute(G, 2, 1.4, -134));
  crate(-20, 1.4, -104, 'health'); crate(18, 1.4, -110);
  // golden gear #2: alcove behind a second iron barricade
  quay(K, -34, -26, -124, -112, 1.4, { coping: false });
  wallSegment(K, -34, -26, -125, -124, 5.5, 1.4, false); wallSegment(K, -34, -26, -112, -111, 5.5, 1.4, false); wallSegment(K, -35, -34, -125, -111, 5.5, 1.4, false);
  E(new Barricade(G, -25.4, 1.4, -118, 4, 3, true, Math.PI / 2));
  L.golden(-30, 1.4, -118, 'l5alcove');

  // ================================================================ 6. BURNING CAUSEWAY (flame jets + crumbling spans over the channel)
  quay(K, -2.2, 2.2, -150, -146, 1.4, { coping: false });
  const span = [[-150, -155, 'stone'], [-155, -158, 'crumble'], [-158, -165, 'stone'], [-165, -168, 'crumble'], [-168, -174, 'stone'], [-174, -177, 'crumble'], [-177, -186, 'stone']];
  for (const [z1, z0, kind] of span) {
    if (kind === 'stone') { quay(K, -2.2, 2.2, z0, z1, 1.4, { coping: false }); for (const sx of [-1, 1]) K.B.add(xf(cyl(0.6, 0.8, 5, 10), sx * 1.6, -1.3, (z0 + z1) / 2), MAT.brickDark, 2); }
    else E(new Crumble(G, 0, 1.4, (z0 + z1) / 2, 4.0, z1 - z0, MAT.flagstone));
  }
  [-152, -161, -170.5, -181].forEach((z, i) => E(new FlameJet(G, (i % 2 ? 1 : -1) * 0.9, 1.4, z, 2.6, i * 0.27)));
  EN(new Gull(G, -8, 7, -165)); EN(new Gull(G, 8, 8, -175));
  L.hint(0, -147, 3, 'Watch the jets — time your run between bursts, and do not stop on the cracked spans!', 'l5causeway');

  // ================================================================ 7. INNER YARD (arena)
  L.checkpoint(0, 1.4, -189);
  wallSegment(K, -27, -25, -232, -186, 10, 1.4); wallSegment(K, 25, 27, -232, -186, 10, 1.4);
  for (const [x, z] of [[-18, -200], [18, -214], [-14, -222], [12, -196]]) { decorCrate(K, x, 1.4, z, 1.3, 0.3); barrel(K, x + 1.4, 1.4, z + 0.2); }
  for (const [x, z] of [[-22, -190], [22, -190], [-22, -228], [22, -228]]) brazier(K, x, 1.4, z);
  crate(-8, 1.4, -204, 'health'); crate(9, 1.4, -224, 'boom'); crate(-16, 1.4, -214);
  // the keep and its lift (needs a heavy plate)
  quay(K, -12, 12, -252, -232, 13.6, { topMat: MAT.flagstone, wallMat: MAT.brick });
  for (let x = -11; x <= 11; x += 2) K.B.add(xf(rbox(0.9, 0.8, 0.6, 0.06), x, 14.0, -232.4), MAT.brick, 1.5);
  const liftPlate = E(new Plate(G, 17.5, 1.4, -222, 2));
  E(new Mover(G, [15, 1.4, -233.5], [15, 13.6, -233.5], 3.2, 3.2, 4.5, { kind: 'lift', control: () => liftPlate.on }));
  K.B.add(xf(box(0.3, 13, 0.3), 16.8, 7.5, -235.2), MAT.ironDark, 1); K.B.add(xf(box(0.3, 13, 0.3), 13.2, 7.5, -235.2), MAT.ironDark, 1);
  K.B.add(xf(box(4, 0.4, 0.4), 15, 14.4, -235.2), MAT.ironDark, 1);
  const yardDone = { v: false };
  arena(G, L, {
    x: 0, z: -192, r: 6, title: 'Assault wave',
    onStart: g => g.objective('Survive the fortress garrison'),
    waves: [
      () => [new Bilgebot(G, -8, 1.4, -206), new Bilgebot(G, 8, 1.4, -210), new Bilgebot(G, 0, 1.4, -218), new Brute(G, 0, 1.4, -224)],
      () => [new Bomber(G, -18, 1.4, -224), new Bomber(G, 18, 1.4, -224), new Gull(G, -6, 9, -212), new Gull(G, 6, 9, -212), new Bilgebot(G, -10, 1.4, -200), new Bilgebot(G, 10, 1.4, -200)],
      () => [new Brute(G, -8, 1.4, -220), new Brute(G, 8, 1.4, -220), new Bomber(G, 0, 1.4, -228), new Bilgebot(G, -14, 1.4, -206), new Bilgebot(G, 14, 1.4, -206)],
    ],
    onDone: g => { yardDone.v = true; g.objective('Weigh down the lift plate and ride up the keep'); g.hud.banner('Yard cleared!', 'Two cubes on the lift plate will raise it'); },
  });
  EN(new Turret(G, -8, 13.6, -233, 0)); EN(new Turret(G, 8, 13.6, -233, 0));

  // ================================================================ 8. KEEP ROOF + RAIL TO THE SKULL COURTYARD
  L.checkpoint(0, 13.6, -240);
  quay(K, -12, -9, -251, -247, 16.6, { topMat: MAT.flagstone, coping: false });
  L.golden(-10.5, 16.6, -249, 'l5keep');
  for (const x of [-6, 6]) cannonProp(K, x, 13.6, -250, Math.PI);
  G.rails.push(new Rail(G, [[0, 14.3, -251.5], [0, 13.8, -256], [-10, 12.2, -263], [-18, 10.4, -272], [-10, 8.6, -281], [0, 7.4, -285], [0, 7.2, -288]]));
  L.hint(0, -246, 4, 'Jump on the rail and ride it down to Ironclaw’s courtyard!', 'l5rail');

  // ================================================================ 9. SKULL COURTYARD (final boss)
  quay(K, -26, 26, -322, -280, 6.5, { topMat: MAT.cobble, wallMat: MAT.brickDark });
  L.checkpoint(0, 6.5, -285);
  for (const [x, z] of [[-24, -282], [24, -282], [-24, -320], [24, -320]]) tower(K, x, z, 2.4, 9, { ground: 6.5 });
  for (const [x, z] of [[-21, -296], [21, -296], [-21, -312], [21, -312]]) E(new FlameJet(G, x, 6.5, z, 3.4, (x + z) * 0.01));
  for (const x of [-18, -9, 9, 18]) banner(K, x, 14, -321.8, 0, 5, MAT.flag);
  for (const [x, z] of [[-12, -284], [12, -284]]) brazier(K, x, 6.5, z);
  crate(-18, 6.5, -290, 'health'); crate(18, 6.5, -290, 'health');
  const boss = EN(new Ironclaw(G, 0, 6.5, -304));
  boss.bounds = [-19, 19, -316, -290];
  L.trigger(0, -287, 6, g => {
    boss.active = true; g.boss = boss; g.hud.bossBar(boss); g.objective('Defeat Admiral Ironclaw');
    g.hud.banner('Admiral Ironclaw', 'Master of the Rustwake — final battle'); g.audio.play('boss', { vol: 0.9 });
    g.hint('Dodge the mortar circles and block the broadsides with Cubey. When Ironclaw vents, blast the glowing core!', 6, 'boss');
  }, 5.5);

  // the great skull carved into the mountain behind the courtyard
  skull(G, K, 0, 6, -352);
  // dressing
  for (const [x, z] of [[-14, 0], [14, -4]]) torchPost(K, x, hAt(x, z), z);
  for (const [x, z] of [[-20, -50], [21, -54]]) ship(K, x * 2.2, -0.6, z, x > 0 ? 2.4 : -0.8, 0.9, { sail: MAT.flag, flags: false }).rotation.z = x > 0 ? 0.3 : -0.25;

  // storm: lightning flashes + thunder
  let nextBolt = 6;
  G.updaters.push((dt, g) => {
    nextBolt -= dt;
    if (nextBolt <= 0) {
      nextBolt = 7 + Math.random() * 9;
      const hemi = g.R.scene.children.find(o => o.isHemisphereLight);
      if (hemi) { hemi.intensity = 2.2; setTimeout(() => { hemi.intensity = 0.55; }, 90); setTimeout(() => { hemi.intensity = 1.6; }, 160); setTimeout(() => { hemi.intensity = 0.55; }, 260); }
      setTimeout(() => g.audio.boom(1.6), 400 + Math.random() * 900);
    }
  });

  finishLevel(G, L, { palms: 0.45, foliage: 0.6, ships: 2, gulls: 6 });
  G.objective('Land on Skullrock');
  return { start: { x: 0, y: 1.6, z: 24 } };
}

function skull(G, K, x, y, z) {
  const S = 1;
  KIT.rock(K, x, y + 10, z, 46 * S, 42 * S, 26 * S, 91, MAT.rockDark);
  KIT.rock(K, x, y - 6, z + 6, 30 * S, 16 * S, 22 * S, 92, MAT.rockDark);
  for (const sx of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(8, 24, 18), MAT.black); e.position.set(x + sx * 13, y + 16, z + 20); e.scale.set(1, 0.85, 0.5); G.scene.add(e);
    const glow = new T.Mesh(new T.SphereGeometry(2.4, 16, 12), MAT.ember); glow.position.set(x + sx * 13, y + 15, z + 23); G.scene.add(glow);
    K.fires.push(new T.Vector3(x + sx * 13, y + 15, z + 24));
  }
  const nose = new T.Mesh(new T.ConeGeometry(4, 9, 3), MAT.black); nose.position.set(x, y + 5, z + 22); nose.rotation.set(Math.PI, 0, 0); nose.scale.z = 0.5; G.scene.add(nose);
  for (let i = -3; i <= 3; i++) K.B.add(xf(rbox(3.2, 5, 2.5, 0.4), x + i * 3.6, y - 3, z + 24), MAT.ivory, 2);
}
void sph; void stairs; void Trigger; void deck;
