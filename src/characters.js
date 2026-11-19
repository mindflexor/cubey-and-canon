// Hero rigs: Cubey (6 floating concrete cubes) and Canon (pirate-ship columns with a cannon for a head).
import * as T from 'three';
import { MAT } from './materials.js';
import { rbox, box, cyl, sph, torus, lathe, part, pivot, tube, compact, keep } from './geo.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// A chunky concrete block with one chipped corner and a hand-poured wobble
function concreteBlock(s, chip = 0.14) {
  const g = rbox(s, s, s, s * 0.08, 3);
  const p = g.attributes.position;
  const cc = [rnd() < 0.5 ? 1 : -1, 1, rnd() < 0.5 ? 1 : -1];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cut = x * cc[0] + y * cc[1] + z * cc[2] - s * (1.5 - chip);
    if (cut > 0) { x -= cc[0] * cut / 3; y -= cc[1] * cut / 3; z -= cc[2] * cut / 3; }
    const w = Math.sin(x * 9.1 + z * 4.3) * Math.cos(y * 7.7) * s * 0.008;
    p.setXYZ(i, x + w, y + w, z - w);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ CUBEY (exactly 6 floating concrete cubes)
export function buildCubey() {
  seed = 11;
  const root = new T.Group(), body = pivot(root, 0, 0, 0);
  const mk = (parent, s, mat) => part(parent, concreteBlock(s), mat, 0, 0, 0, 0, 0, 0, s * 2.4);
  const torso = pivot(body, 0, 0.86, 0); mk(torso, 0.66, MAT.cement);
  const head = pivot(body, 0, 1.47, 0); mk(head, 0.44, MAT.cementLight).rotation.y = 0.08;
  const hands = [-1, 1].map(sx => { const h = pivot(body, sx * 0.56, 0.8, 0.02); mk(h, 0.25, MAT.cementWarm); return h; });
  const feet = [-1, 1].map(sx => { const f = pivot(body, sx * 0.19, 0.12, 0.03); mk(f, 0.27, MAT.cementDark).scale.set(1.05, 0.85, 1.25); return f; });
  const base = { torso: torso.position.clone(), head: head.position.clone(), hands: hands.map(h => h.position.clone()), feet: feet.map(f => f.position.clone()) };

  const st = { phase: 0, squash: 0, squashV: 0, act: 0, actType: '', dur: 1, blend: 0 };
  function animate(dt, s) {
    const sp = Math.min(1, s.speed / 7);
    st.phase += dt * (5 + s.speed * 1.5);
    const ph = st.phase, t = s.t;
    st.blend = damp(st.blend, s.grounded ? 0 : 1, 12, dt);
    const a = st.blend;
    st.squashV += (-st.squash * 260 - st.squashV * 18) * dt; st.squash += st.squashV * dt;
    const sq = st.squash;
    torso.position.set(base.torso.x, base.torso.y + Math.abs(Math.sin(ph)) * 0.06 * sp + Math.sin(t * 2.4) * 0.025 - sq * 0.25, base.torso.z);
    torso.rotation.set(0.18 * sp + a * 0.12, Math.sin(ph) * 0.12 * sp, Math.sin(ph) * 0.05 * sp);
    torso.scale.set(1 - sq * 0.4, 1 + sq, 1 - sq * 0.4);
    head.position.set(base.head.x, base.head.y + Math.sin(t * 2.4 - 0.6) * 0.035 + Math.abs(Math.sin(ph - 0.4)) * 0.05 * sp - sq * 0.4 + a * 0.06, base.head.z + 0.06 * sp);
    head.rotation.set(-0.08 * sp + Math.sin(t * 1.3) * 0.04, Math.sin(ph - 0.5) * 0.1 * sp, Math.sin(t * 1.1) * 0.05);
    feet.forEach((f, i) => {
      const p = ph + (i ? Math.PI : 0), b = base.feet[i];
      f.position.set(b.x, b.y + Math.max(0, Math.sin(p)) * 0.22 * sp + a * (i ? 0.35 : 0.2) + Math.sin(t * 2.4 + i) * 0.015 * (1 - sp), b.z + Math.cos(p) * 0.32 * sp + a * (i ? -0.12 : 0.15));
      f.rotation.set(-Math.cos(p) * 0.4 * sp - a * 0.3, 0, 0);
    });
    hands.forEach((h, i) => {
      const p = ph + (i ? 0 : Math.PI), b = base.hands[i], sx = i ? 1 : -1;
      h.position.set(b.x + sx * a * 0.12, b.y + Math.sin(t * 2.4 + 1 + i) * 0.04 + a * 0.35 + Math.abs(Math.cos(p)) * 0.05 * sp, b.z + Math.cos(p) * 0.3 * sp);
      h.rotation.set(Math.cos(p) * 0.5 * sp + t * 0.0, Math.sin(t * 0.9 + i) * 0.15, sx * a * 0.4);
    });
    if (st.act > 0) {
      st.act -= dt;
      const k = Math.sin((1 - Math.max(0, st.act) / st.dur) * Math.PI);
      if (st.actType === 'place') {
        hands[1].position.set(base.hands[1].x - 0.2 * k, base.hands[1].y + 0.15 * k, base.hands[1].z + 0.75 * k);
        hands[0].position.z += 0.2 * k; torso.rotation.x += 0.25 * k;
      } else if (st.actType === 'slam') {
        hands.forEach((h, i) => h.position.set(base.hands[i].x * 0.7, base.hands[i].y + 0.9, 0));
        torso.rotation.x = 0.45; feet.forEach(f => { f.position.y += 0.2; });
      }
    }
    if (s.shield) {
      hands.forEach((h, i) => h.position.set(base.hands[i].x * 0.75, base.hands[i].y + 0.25, 0.6));
      torso.position.y -= 0.12; torso.rotation.x = 0.3; head.position.y -= 0.12;
    }
  }
  return {
    root, animate, height: 1.5,
    land(v) { st.squashV -= Math.min(6, v * 0.35); },
    jump() { st.squashV += 3.5; },
    action(type, dur = 0.35) { st.actType = type; st.act = st.dur = dur; },
    handWorld(out) { return hands[1].getWorldPosition(out); },
  };
}

// ------------------------------------------------------------------ CANON
// Turned ship baluster / rail-post profile along +y (0..len)
function column(len, r, seg = 18) {
  const P = [[0, 0], [1.12, 0], [1.12, 0.05], [0.9, 0.07], [1.04, 0.1], [0.82, 0.13], [0.78, 0.2], [1.0, 0.33], [1.08, 0.45], [1.0, 0.56], [0.72, 0.7], [0.66, 0.77], [0.92, 0.81], [0.7, 0.85], [0.82, 0.9], [1.12, 0.93], [1.12, 1], [0, 1]];
  return lathe(P.map(([x, y]) => [x * r, y * len]), seg);
}
const hang = (parent, geo, mat, x, y, z) => part(parent, geo, mat, x, y, z, Math.PI, 0, 0);

export function buildCanon() {
  seed = 5;
  const root = new T.Group(), body = pivot(root, 0, 0, 0);
  const hips = pivot(body, 0, 0.8, 0);
  part(hips, lathe([[0, -0.14], [0.25, -0.14], [0.3, -0.06], [0.31, 0], [0.3, 0.06], [0.25, 0.14], [0, 0.14]], 22), MAT.woodDark, 0, 0, 0);
  for (const y of [-0.09, 0.09]) part(hips, torus(0.3, 0.016, 6, 24), MAT.ironDark, 0, y, 0, Math.PI / 2);
  part(hips, rbox(0.18, 0.14, 0.05, 0.02), MAT.brass, 0, 0.0, 0.3);
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = pivot(hips, sx * 0.17, -0.1, 0);
    part(hip, sph(0.1, 12, 8), MAT.brass, 0, 0, 0);
    hang(hip, column(0.36, 0.095), MAT.wood, 0, -0.02, 0);
    part(hip, torus(0.1, 0.018, 6, 16), MAT.ironDark, 0, -0.06, 0, Math.PI / 2);
    const knee = pivot(hip, 0, -0.38, 0);
    part(knee, sph(0.095, 12, 8), MAT.ironDark, 0, 0, 0);
    part(knee, torus(0.1, 0.02, 6, 16), MAT.brass, 0, 0, 0, Math.PI / 2);
    hang(knee, column(0.3, 0.09), MAT.wood, 0, -0.03, 0);
    part(knee, cyl(0.125, 0.11, 0.26, 14), MAT.bootLeather, 0, -0.2, 0);                 // boot shaft
    part(knee, cyl(0.15, 0.135, 0.1, 14, 1, true), MAT.bootLeather, 0, -0.05, 0);         // folded cuff
    part(knee, torus(0.15, 0.012, 4, 16), MAT.gold, 0, -0.005, 0, Math.PI / 2);
    const boot = pivot(knee, 0, -0.33, 0.05);
    part(boot, rbox(0.22, 0.15, 0.38, 0.07), MAT.bootLeather, 0, -0.02, 0.02);
    part(boot, rbox(0.2, 0.06, 0.09, 0.02), MAT.woodDark, 0, -0.08, -0.13);              // heel
    part(boot, rbox(0.12, 0.08, 0.03, 0.01), MAT.gold, 0, 0.03, 0.2);                    // buckle
    legs.push({ hip, knee, boot });
  }
  // torso: five ship columns lashed together with iron hoops and rope
  const spine = pivot(hips, 0, 0.12, 0);
  for (const [x, z, r] of [[-0.21, 0.08, 0.12], [0, 0.13, 0.135], [0.21, 0.08, 0.12], [-0.12, -0.12, 0.115], [0.12, -0.12, 0.115]]) part(spine, column(0.64, r, 16), MAT.woodHull, x, 0, z);
  for (const [y, sc] of [[0.1, 1], [0.47, 1.06]]) part(spine, torus(0.36 * sc, 0.025, 6, 30), MAT.ironDark, 0, y, 0.01, Math.PI / 2).scale.set(1, 0.78, 1);
  for (let k = 0; k < 3; k++) part(spine, torus(0.355, 0.022, 6, 30), MAT.rope, 0, 0.27 + k * 0.045, 0.01, Math.PI / 2).scale.set(1, 0.8, 1);
  const plate = pivot(spine, 0, 0.38, 0.27); plate.rotation.x = -0.12;
  part(plate, rbox(0.22, 0.2, 0.03, 0.02), MAT.brass, 0, 0, 0);
  part(plate, cyl(0.01, 0.01, 0.12, 6), MAT.ironDark, 0, 0.01, 0.02);
  part(plate, torus(0.04, 0.009, 6, 12, Math.PI), MAT.ironDark, 0, -0.04, 0.02, 0, 0, Math.PI);
  const band = pivot(spine, 0, 0.32, 0.03); band.rotation.z = 0.75;
  part(band, torus(0.37, 0.028, 6, 30), MAT.leather, 0, 0, 0, Math.PI / 2).scale.set(1, 0.8, 1);
  for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; part(band, sph(0.055, 10, 8), MAT.ironDark, Math.sin(a) * 0.38, 0, Math.cos(a) * 0.31); }
  const wheel = pivot(spine, 0, 0.36, -0.27);
  part(wheel, torus(0.17, 0.02, 6, 24), MAT.wood, 0, 0, 0);
  part(wheel, cyl(0.045, 0.045, 0.06, 10), MAT.brass, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    part(wheel, cyl(0.016, 0.01, 0.26, 6), MAT.wood, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0, 0, 0, a - Math.PI / 2);
    part(wheel, sph(0.022, 6, 4), MAT.wood, Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0);
  }
  const mast = pivot(spine, 0.22, 0.55, -0.2);
  part(mast, cyl(0.016, 0.022, 0.8, 6), MAT.woodDark, 0, 0.4, 0);
  part(mast, sph(0.03, 8, 6), MAT.brass, 0, 0.81, 0);
  const pg = new T.BufferGeometry(), flagVerts = [];
  for (let i = 0; i < 6; i++) { const x = i / 5 * 0.36; flagVerts.push(x, 0.13 * (1 - i / 5 * 0.7), 0, x, -0.13 * (1 - i / 5 * 0.7), 0); }
  pg.setAttribute('position', new T.Float32BufferAttribute(flagVerts, 3));
  const idx = []; for (let i = 0; i < 5; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  pg.setIndex(idx); pg.computeVertexNormals();
  const flag = keep(part(mast, pg, MAT.flag, 0, 0.68, 0)); flag.rotation.y = Math.PI * 0.85;
  const flagBase = flagVerts.slice();
  // long red captain's frock coat over the column torso, open at the front, flaring coattails
  const coatProf = [[0.36, 0.64], [0.41, 0.56], [0.415, 0.3], [0.39, 0.08], [0.4, -0.12], [0.46, -0.4], [0.52, -0.62], [0.5, -0.64]];
  const coat = part(spine, new T.LatheGeometry(coatProf.map(([r, y]) => new T.Vector2(r, y)), 30, 0.55, Math.PI * 2 - 1.1), MAT.coat, 0, 0, -0.01);
  coat.scale.set(1.04, 1, 0.86);
  const hem = part(spine, new T.TorusGeometry(0.51, 0.018, 4, 30, Math.PI * 2 - 1.1), MAT.gold, 0, -0.63, -0.01, Math.PI / 2, 0, -Math.PI / 2 + 0.55); hem.scale.set(1.04, 0.86, 1);
  for (const sx of [-1, 1]) {
    const a = sx * 0.55, x = Math.sin(a) * 0.4 * 1.04, z = Math.cos(a) * 0.4 * 0.86;
    part(spine, box(0.028, 1.22, 0.025), MAT.gold, x, 0.0, z - 0.01, 0, a, 0);
    for (let i = 0; i < 4; i++) part(spine, sph(0.022, 6, 4), MAT.gold, x + sx * 0.04, 0.42 - i * 0.14, z, 0, 0, 0);
  }
  part(spine, torus(0.36, 0.05, 6, 28), MAT.clothRed, 0, 0.0, 0.01, Math.PI / 2).scale.set(1.08, 0.86, 1);   // sash
  const tail = part(spine, rbox(0.12, 0.34, 0.03, 0.01), MAT.clothRed, -0.24, -0.16, 0.27, 0.1, -0.3, 0.2);
  part(spine, torus(0.37, 0.03, 4, 28), MAT.bootLeather, 0, 0.08, 0.01, Math.PI / 2).scale.set(1.09, 0.87, 1);  // belt
  part(spine, rbox(0.15, 0.12, 0.03, 0.02), MAT.gold, 0, 0.08, 0.33);
  part(spine, rbox(0.08, 0.05, 0.035, 0.01), MAT.bootLeather, 0, 0.08, 0.34);
  // cutlass in a scabbard at the left hip
  const scab = pivot(spine, -0.38, -0.05, 0.1); scab.rotation.set(0.5, 0, 0.18);
  part(scab, rbox(0.06, 0.62, 0.035, 0.015), MAT.bootLeather, 0, -0.3, 0);
  part(scab, rbox(0.065, 0.06, 0.04, 0.01), MAT.gold, 0, -0.6, 0);
  part(scab, torus(0.06, 0.012, 4, 10, Math.PI), MAT.gold, 0, 0.06, 0, 0, Math.PI / 2, 0);
  part(scab, cyl(0.022, 0.022, 0.14, 6), MAT.woodDark, 0, 0.1, 0);
  part(scab, sph(0.03, 6, 4), MAT.gold, 0, 0.18, 0);
  void tail;
  part(spine, cyl(0.38, 0.36, 0.06, 26), MAT.planks, 0, 0.66, 0).scale.z = 0.8;
  part(spine, torus(0.37, 0.02, 6, 26), MAT.brass, 0, 0.69, 0, Math.PI / 2).scale.y = 0.8;
  const carriage = pivot(spine, 0, 0.69, 0);
  for (const sx of [-1, 1]) {
    part(carriage, rbox(0.07, 0.26, 0.4, 0.02), MAT.woodDark, sx * 0.24, 0.12, 0);
    for (const z of [0.12, -0.12]) part(carriage, sph(0.025, 6, 4), MAT.brass, sx * 0.28, 0.17, z);
    part(carriage, cyl(0.07, 0.07, 0.04, 12), MAT.brass, sx * 0.29, 0.2, 0, 0, 0, Math.PI / 2);
  }
  // the cannon head
  const head = pivot(carriage, 0, 0.21, 0.02);
  const gun = pivot(head, 0, 0, 0);
  const S = 1.18;
  const prof = [[0, -0.47], [0.045, -0.465], [0.058, -0.43], [0.03, -0.39], [0.1, -0.375], [0.165, -0.33], [0.18, -0.25], [0.198, -0.23], [0.198, -0.18], [0.178, -0.16], [0.17, 0.0], [0.188, 0.02], [0.188, 0.07], [0.165, 0.09], [0.14, 0.3], [0.15, 0.335], [0.172, 0.36], [0.2, 0.42], [0.2, 0.47], [0.14, 0.48], [0.125, 0.47]];
  part(gun, lathe(prof.map(([r, y]) => [r * S, y * S]), 36), MAT.iron, 0, 0, 0, Math.PI / 2);
  part(gun, cyl(0.123 * S, 0.123 * S, 0.42, 20, 1, true), MAT.bore, 0, 0, 0.33, Math.PI / 2);
  const glow = keep(part(gun, cyl(0.11 * S, 0.11 * S, 0.01, 20), MAT.boreGlow, 0, 0, 0.12, Math.PI / 2));
  for (const z of [-0.205, 0.045, 0.42]) part(gun, torus(0.2 * S, 0.016, 6, 36), MAT.brass, 0, 0, z * S);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(gun, sph(0.018, 6, 4), MAT.brass, Math.cos(a) * 0.205 * S, Math.sin(a) * 0.205 * S, 0.02 * S); }
  part(gun, cyl(0.05, 0.05, 0.62, 12), MAT.ironDark, 0, 0, -0.02, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) part(gun, torus(0.05, 0.014, 6, 12, Math.PI), MAT.brass, sx * 0.07, 0.2 * S, 0.08, 0, Math.PI / 2, 0);
  // captain's tricorn perched on the barrel
  const hat = pivot(gun, 0, 0.21 * S, -0.14);
  part(hat, cyl(0.3, 0.3, 0.035, 3), MAT.paintDark, 0, 0.02, 0, 0, Math.PI, 0);
  part(hat, cyl(0.14, 0.17, 0.15, 14), MAT.paintDark, 0, 0.1, 0);
  part(hat, new T.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.paintDark, 0, 0.17, 0);
  part(hat, cyl(0.172, 0.172, 0.03, 14), MAT.paintRed, 0, 0.05, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2; part(hat, sph(0.025, 6, 4), MAT.brass, Math.cos(a) * 0.29, 0.04, Math.sin(a) * 0.29); }
  const plume = part(hat, sph(0.06, 8, 6), MAT.canvas, 0.12, 0.22, -0.08); plume.scale.set(0.6, 2.4, 0.6); plume.rotation.z = -0.6;
  part(gun, tube([[0, 0.14, -0.33], [0.01, 0.22, -0.36], [0.05, 0.27, -0.42]], 0.012, 8, 5), MAT.rope);
  const ember = keep(part(gun, sph(0.026, 8, 6), MAT.ember, 0.05, 0.275, -0.425));
  const muzzle = pivot(gun, 0, 0, 0.5 * S + 0.02);
  // arms: ship balusters with iron cuffs and big iron fists
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = pivot(spine, sx * 0.47, 0.52, 0);
    part(sh, new T.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.ironDark, sx * 0.02, 0.0, 0).scale.set(1.05, 0.85, 1.15);
    part(sh, torus(0.17, 0.02, 6, 22), MAT.brass, sx * 0.02, 0.0, 0, Math.PI / 2).scale.set(1.05, 1.15, 1);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; part(sh, sph(0.022, 6, 4), MAT.brass, sx * 0.02 + Math.cos(a) * 0.1, 0.11, Math.sin(a) * 0.1); }
    part(sh, sph(0.09, 10, 8), MAT.brass, 0, -0.04, 0);
    part(sh, cyl(0.15, 0.17, 0.05, 16), MAT.gold, sx * 0.02, 0.12, 0);                      // epaulette
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; part(sh, cyl(0.012, 0.012, 0.09, 4), MAT.gold, sx * 0.02 + Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16); }
    part(sh, cyl(0.12, 0.11, 0.16, 12), MAT.coat, 0, -0.1, 0);                               // short sleeve
    hang(sh, column(0.32, 0.075), MAT.wood, 0, -0.06, 0);
    const el = pivot(sh, 0, -0.39, 0);
    part(el, sph(0.08, 10, 8), MAT.ironDark, 0, 0, 0);
    part(el, torus(0.085, 0.018, 6, 14), MAT.brass, 0, 0, 0, Math.PI / 2);
    hang(el, column(0.27, 0.085), MAT.wood, 0, -0.03, 0);
    part(el, cyl(0.15, 0.12, 0.13, 14), MAT.coat, 0, -0.24, 0);                              // big turned-back cuff
    part(el, torus(0.15, 0.012, 4, 14), MAT.gold, 0, -0.18, 0, Math.PI / 2);
    const hand = pivot(el, 0, -0.38, 0);
    part(hand, rbox(0.22, 0.2, 0.22, 0.06), MAT.iron, 0, 0, 0);
    part(hand, rbox(0.235, 0.07, 0.235, 0.025), MAT.brass, 0, 0.065, 0);
    for (let f = 0; f < 3; f++) part(hand, sph(0.024, 6, 4), MAT.brass, -0.065 + f * 0.065, -0.02, 0.115);
    arms.push({ sh, el, hand });
  }
  const parrot = pivot(arms[0].sh, -0.02, 0.2, -0.02);
  const pb = part(parrot, sph(0.075, 12, 10), MAT.parrotRed, 0, 0.06, 0); pb.scale.set(0.85, 1.25, 0.95);
  for (const sx of [-1, 1]) { const w = part(parrot, sph(0.06, 8, 6), MAT.parrotBlue, sx * 0.06, 0.05, -0.02); w.scale.set(0.35, 1.2, 0.9); }
  part(parrot, rbox(0.05, 0.2, 0.02, 0.01), MAT.parrotBlue, 0, -0.06, -0.08, 0.5, 0, 0);
  part(parrot, rbox(0.035, 0.16, 0.015, 0.008), MAT.parrotYellow, 0.02, -0.05, -0.1, 0.55, 0, 0.1);
  const pHead = pivot(parrot, 0, 0.17, 0.02);
  part(pHead, sph(0.055, 10, 8), MAT.parrotRed, 0, 0, 0);
  part(pHead, cyl(0.001, 0.025, 0.06, 6), MAT.parrotYellow, 0, -0.01, 0.06, Math.PI / 2 + 0.5, 0, 0);
  for (const sx of [-1, 1]) { part(pHead, sph(0.016, 6, 4), MAT.paintWhite, sx * 0.04, 0.015, 0.025); part(pHead, sph(0.008, 4, 4), MAT.black, sx * 0.047, 0.017, 0.032); }
  part(parrot, cyl(0.008, 0.008, 0.05, 4), MAT.parrotYellow, -0.02, -0.03, 0.02); part(parrot, cyl(0.008, 0.008, 0.05, 4), MAT.parrotYellow, 0.02, -0.03, 0.02);
  root.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  ember.castShadow = glow.castShadow = false;
  compact(root);

  let ph0 = 0;
  const st = { phase: 0, squash: 0, squashV: 0, recoil: 0, recoilV: 0, blend: 0 };
  function animate(dt, s) {
    const sp = Math.min(1, s.speed / 7);
    st.phase += dt * (3.6 + s.speed * 1.35);
    const ph = st.phase;
    st.blend = damp(st.blend, s.grounded ? 0 : 1, 12, dt);
    const a = st.blend;
    st.squashV += (-st.squash * 220 - st.squashV * 16) * dt; st.squash += st.squashV * dt;
    body.scale.set(1 - st.squash * 0.5, 1 + st.squash, 1 - st.squash * 0.5);
    st.recoilV += (-st.recoil * 300 - st.recoilV * 20) * dt; st.recoil += st.recoilV * dt;
    gun.position.z = -st.recoil * 0.9; gun.rotation.x = -st.recoil * 1.6;
    const idle = Math.sin(s.t * 1.8);
    body.position.y = (Math.abs(Math.sin(ph)) * 0.06 * sp) * (1 - a) + idle * 0.006;
    body.rotation.z = Math.sin(ph) * 0.05 * sp;
    spine.rotation.y = -Math.sin(ph) * 0.12 * sp;
    spine.rotation.x = 0.08 * sp + st.recoil * 0.8;
    head.rotation.x = s.aimPitch != null ? -s.aimPitch - spine.rotation.x : -0.05 * sp + idle * 0.02;
    pHead.rotation.set(Math.sin(s.t * 3.1) * 0.25, Math.sin(s.t * 0.9) * 0.8, Math.sin(s.t * 2.3) * 0.3);
    parrot.rotation.z = -Math.sin(ph0 = ph0 + dt * (2 + sp * 4)) * 0.1 * (0.3 + sp);
    for (let i = 0; i < 2; i++) {
      const L = legs[i], p = Math.sin(ph + (i ? Math.PI : 0));
      L.hip.rotation.x = p * 0.7 * sp * (1 - a) + a * (i ? 0.45 : -0.6);
      L.knee.rotation.x = Math.max(0, -Math.cos(ph + (i ? Math.PI : 0))) * 1.0 * sp * (1 - a) + a * (i ? 0.3 : 0.9);
      const A = arms[i], k = i ? 1 : -1;
      A.sh.rotation.set(-p * 0.6 * sp * (1 - a) - a * 0.6, 0, k * (0.16 + a * 0.5));
      A.el.rotation.x = -0.3 - 0.35 * sp;
    }
    if (s.aiming) { arms[0].sh.rotation.set(-0.7, 0.3, -0.15); arms[1].sh.rotation.set(-0.7, -0.3, 0.15); arms[0].el.rotation.x = arms[1].el.rotation.x = -0.8; }
    const c = s.charge || 0;
    if (c > 0) { body.position.x = (Math.random() - 0.5) * 0.02 * c; ember.scale.setScalar(1 + c * 2.5); glow.scale.setScalar(1 + c * 0.3); }
    else { ember.scale.setScalar(1 + Math.sin(s.t * 25) * 0.2 + Math.random() * 0.2); glow.scale.setScalar(1); }
    const pos = pg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = flagBase[i * 3]; pos.setZ(i, Math.sin(s.t * 9 - x * 18) * 0.04 * (x / 0.36)); }
    pos.needsUpdate = true;
  }
  return {
    root, animate, height: 1.9,
    land(v) { st.squashV -= Math.min(5, v * 0.3); },
    jump() { st.squashV += 3; },
    fire(power = 1) { st.recoilV += 4 * power; st.squashV -= 1.5 * power; },
    muzzleWorld(out) { return muzzle.getWorldPosition(out); },
    emberWorld(out) { return ember.getWorldPosition(out); },
    action() {},
  };
}
