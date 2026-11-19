import * as T from 'three';
const V = new T.Vector3();

export class CamRig {
  constructor(camera) {
    this.cam = camera; this.yaw = 0; this.pitch = 0.3; this.dist = 6; this.shoulder = 0;
    this.look = new T.Vector3(); this.shakeAmt = 0; this.snap = true; this.fov = 62;
    this.dir = new T.Vector3(); this.pitchAim = 0; this.lookY = 0;
  }
  forward(out) { return out.copy(this.dir).negate(); }
  update(dt, inp, hero, world, aiming) {
    if (inp) { this.yaw -= inp.lookX; this.pitch += inp.lookY; }
    this.pitch = Math.max(-0.55, Math.min(1.25, this.pitch));
    const p = hero.body.pos;
    const goalY = p.y + (hero.kind === 'canon' ? 1.75 : 1.55);
    if (this.snap) { this.look.set(p.x, goalY, p.z); this.lookY = goalY; }
    else {
      this.look.x += (p.x - this.look.x) * (1 - Math.exp(-14 * dt));
      this.look.z += (p.z - this.look.z) * (1 - Math.exp(-14 * dt));
      const ky = hero.body.grounded || hero.rail ? 10 : 3.5;
      this.lookY += (goalY - this.lookY) * (1 - Math.exp(-ky * dt));
      if (Math.abs(goalY - this.lookY) > 3) this.lookY += (goalY - this.lookY) * 0.2;
      this.look.y = this.lookY;
    }
    const wantD = aiming ? 2.5 : 4.3, wantS = aiming ? 0.95 : 0.78;
    this.dist += (wantD - this.dist) * (1 - Math.exp(-10 * dt));
    this.shoulder += (wantS - this.shoulder) * (1 - Math.exp(-10 * dt));
    const cp = Math.cos(this.pitch);
    this.dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const base = V.copy(this.look);
    // shoulder offset to the right (clamped so it never pokes into a wall)
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const sh = world.raycast(this.look, { x: rx, y: 0, z: rz }, this.shoulder + 0.35, s => s.cam && s.tag !== 'cube');
    const shoulder = sh.solid ? Math.max(0, sh.dist - 0.35) : this.shoulder;
    base.x += rx * shoulder; base.z += rz * shoulder;
    base.y += 0.12;
    if (aiming) base.y += 0.15;
    const hit = world.raycast(base, this.dir, this.dist + 0.4, s => s.cam && s.tag !== 'cube');
    let d = this.dist;
    if (hit.solid) d = Math.max(0.6, hit.dist - 0.35);
    this.cam.position.copy(base).addScaledVector(this.dir, d);
    if (this.cam.position.y < 0.6) this.cam.position.y = 0.6;
    this.cam.lookAt(base);
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * this.shakeAmt * 0.35;
      this.cam.position.x += (Math.random() - 0.5) * s; this.cam.position.y += (Math.random() - 0.5) * s;
      this.cam.rotation.z += (Math.random() - 0.5) * s * 0.1;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    }
    const wantFov = aiming ? 50 : 62;
    this.fov += (wantFov - this.fov) * (1 - Math.exp(-8 * dt));
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
    this.pitchAim = -this.pitch + 0.06;
    this.snap = false;
  }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
}
