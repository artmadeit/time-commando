import * as THREE from 'three';
import { basePose, type Pose } from './rig';

// ---------------------------------------------------------------------------
// Cuadrúpedo procedural (dientes de sable). Reutiliza el vocabulario de Pose
// del humanoide con este significado:
//   spineX = cabeceo del cuerpo (+ morro abajo)   spineZ = caída lateral
//   headX/headY = cabeza          rWr = apertura de mandíbula
//   lShP/rShP + lEl/rEl = patas delanteras   lLegP/rLegP + lKnee/rKnee = traseras
//   spineY = latigazo de la cola
// ---------------------------------------------------------------------------

export interface BeastLook {
  fur: THREE.MeshStandardMaterial;
  belly: THREE.MeshStandardMaterial;
  fang: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
}

export class Quadruped {
  root = new THREE.Group();
  lean = new THREE.Group();
  rollG = new THREE.Group();
  off = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  jaw = new THREE.Group();
  tail = new THREE.Group();
  legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  pose: Pose = basePose();
  mats: THREE.MeshStandardMaterial[] = [];
  private baseEmissive: THREE.Color[] = [];
  weaponMats: THREE.MeshStandardMaterial[] = [];
  weapon: THREE.Group | null = null;
  cape: THREE.Mesh | null = null;
  bladeBase = new THREE.Object3D();
  bladeTip = new THREE.Object3D();
  readonly quadruped = true;

  constructor(look: BeastLook, scale = 1) {
    const L = { fur: look.fur.clone(), belly: look.belly.clone(), fang: look.fang.clone(), dark: look.dark.clone(), eye: look.eye };
    this.mats.push(L.fur, L.belly, L.dark);
    this.baseEmissive = this.mats.map((m) => m.emissive.clone());
    this.weaponMats.push(L.fang);

    this.root.add(this.lean);
    this.lean.add(this.rollG);
    this.rollG.position.y = 0.55;
    this.rollG.add(this.off);
    this.off.position.y = -0.55;
    this.off.add(this.body);
    this.body.position.y = 0.78;
    this.root.scale.setScalar(scale);

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // tronco: pecho robusto y cuarto trasero más bajo
    const torso = add(this.body, new THREE.CapsuleGeometry(0.27, 0.75, 6, 14), L.fur, 0, 0, -0.02);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(1, 1, 1.12);
    add(this.body, new THREE.SphereGeometry(0.34, 16, 12), L.fur, 0, 0.04, 0.38).scale.set(1, 1.05, 1.1);
    add(this.body, new THREE.SphereGeometry(0.29, 16, 12), L.fur, 0, -0.02, -0.42);
    const belly = add(this.body, new THREE.CapsuleGeometry(0.2, 0.6, 4, 10), L.belly, 0, -0.12, 0);
    belly.rotation.x = Math.PI / 2;
    // cresta del lomo
    add(this.body, new THREE.BoxGeometry(0.1, 0.06, 0.9), L.dark, 0, 0.27, 0);

    // cabeza
    this.body.add(this.head);
    this.head.position.set(0, 0.2, 0.62);
    add(this.head, new THREE.CylinderGeometry(0.15, 0.2, 0.3, 12), L.fur, 0, -0.05, -0.05).rotation.x = -0.9;
    const skull = add(this.head, new THREE.SphereGeometry(0.2, 18, 14), L.fur, 0, 0.06, 0.12);
    skull.scale.set(1, 0.85, 1.05);
    const snout = add(this.head, new THREE.BoxGeometry(0.2, 0.13, 0.2), L.fur, 0, 0.0, 0.3);
    snout.rotation.x = 0.1;
    add(this.head, new THREE.BoxGeometry(0.08, 0.05, 0.05), L.dark, 0, 0.06, 0.4); // nariz
    for (const s of [-1, 1]) {
      const ear = add(this.head, new THREE.ConeGeometry(0.06, 0.1, 6), L.fur, s * 0.12, 0.24, 0.05);
      ear.rotation.z = -s * 0.4;
      const eye = add(this.head, new THREE.SphereGeometry(0.028, 8, 6), L.eye, s * 0.1, 0.12, 0.27);
      eye.castShadow = false;
      // colmillos de sable
      const fang = add(this.head, new THREE.ConeGeometry(0.026, 0.26, 8), L.fang, s * 0.06, -0.15, 0.33);
      fang.rotation.x = Math.PI - 0.15;
    }
    // mandíbula inferior
    this.head.add(this.jaw);
    this.jaw.position.set(0, -0.05, 0.16);
    add(this.jaw, new THREE.BoxGeometry(0.16, 0.06, 0.24), L.belly, 0, -0.04, 0.1);

    // patas
    const leg = (x: number, z: number, front: boolean) => {
      const hip = new THREE.Group();
      hip.position.set(x, -0.02, z);
      this.body.add(hip);
      add(hip, new THREE.CapsuleGeometry(front ? 0.095 : 0.11, 0.26, 4, 10), L.fur, 0, -0.18, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.38;
      hip.add(knee);
      add(knee, new THREE.CapsuleGeometry(0.07, 0.24, 4, 10), L.fur, 0, -0.15, 0);
      const paw = add(knee, new THREE.SphereGeometry(0.09, 10, 8), L.fur, 0, -0.33, 0.04);
      paw.scale.set(1, 0.6, 1.3);
      for (let i = -1; i <= 1; i++) {
        const claw = add(paw, new THREE.ConeGeometry(0.015, 0.06, 5), L.fang, i * 0.04, -0.02, 0.09);
        claw.rotation.x = Math.PI / 2 + 0.4;
      }
      this.legs.push({ hip, knee });
      return knee;
    };
    const lfKnee = leg(0.17, 0.42, true);
    leg(-0.17, 0.42, true);
    leg(0.16, -0.46, false);
    leg(-0.16, -0.46, false);
    // la estela del zarpazo sale de la pata delantera izquierda
    this.bladeBase.position.set(0, -0.25, 0);
    this.bladeTip.position.set(0, -0.4, 0.12);
    lfKnee.add(this.bladeBase, this.bladeTip);

    // cola corta
    this.body.add(this.tail);
    this.tail.position.set(0, 0.12, -0.68);
    const tl = add(this.tail, new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), L.fur, 0, 0, -0.14);
    tl.rotation.x = Math.PI / 2 + 0.5;

    // manchas tenues
    for (let i = 0; i < 10; i++) {
      const spot = add(this.body, new THREE.SphereGeometry(0.05 + Math.random() * 0.03, 6, 4), L.dark, (Math.random() < 0.5 ? -1 : 1) * 0.26, 0.05 + Math.random() * 0.15, -0.5 + Math.random() * 1.0);
      spot.scale.set(0.3, 1, 1.3);
      spot.castShadow = false;
    }
    this.apply();
  }

  apply() {
    const p = this.pose;
    this.off.position.y = -0.55 + p.bodyY;
    this.rollG.rotation.x = p.roll;
    this.lean.rotation.x = p.lean;
    this.body.rotation.set(p.spineX, 0, p.spineZ);
    this.head.rotation.set(p.headX - p.spineX * 0.6, p.headY, 0);
    this.jaw.rotation.x = Math.max(0, p.rWr) * 0.7;
    const [lf, rf, lb, rb] = this.legs;
    lf.hip.rotation.x = -p.lShP; lf.knee.rotation.x = p.lEl;
    rf.hip.rotation.x = -p.rShP; rf.knee.rotation.x = p.rEl;
    lb.hip.rotation.x = -p.lLegP; lb.knee.rotation.x = p.lKnee;
    rb.hip.rotation.x = -p.rLegP; rb.knee.rotation.x = p.rKnee;
    this.tail.rotation.set(-0.2, p.spineY, 0);
  }

  flash(v: number, color = 0xffffff) {
    const c = new THREE.Color(color);
    this.mats.forEach((m, i) => m.emissive.copy(this.baseEmissive[i]).lerp(c, v));
  }

  telegraph(v: number) {
    for (const m of this.weaponMats) m.emissive.setRGB(2.5 * v, 0.8 * v, 0.1 * v);
  }

  setOpacity(o: number) {
    for (const m of [...this.mats, ...this.weaponMats]) {
      m.transparent = o < 1;
      m.opacity = o;
    }
  }
}

// ---------------------------------------------------------------------------
// Poses de bestia
// ---------------------------------------------------------------------------

export function beastIdle(p: Pose, t: number, stalking: boolean) {
  for (const k of Object.keys(p) as (keyof Pose)[]) p[k] = 0;
  const br = Math.sin(t * 2.4) * 0.015;
  p.bodyY = br + (stalking ? -0.1 : 0);
  p.spineX = stalking ? 0.06 : 0;
  p.headX = stalking ? 0.2 : Math.sin(t * 0.7) * 0.08;
  p.headY = Math.sin(t * 0.5) * 0.2;
  p.spineY = Math.sin(t * 3) * 0.5;
  p.lKnee = p.rKnee = stalking ? 0.5 : 0.15;
  p.lEl = p.rEl = stalking ? 0.4 : 0.05;
  p.lLegP = p.rLegP = stalking ? -0.25 : -0.1;
  p.lShP = p.rShP = stalking ? 0.2 : 0;
  p.rWr = stalking ? 0.25 + Math.sin(t * 5) * 0.1 : 0;
}

/** trote/galope: pares diagonales */
export function beastGait(p: Pose, phase: number, a: number) {
  if (a <= 0.001) return;
  const s = Math.sin(phase), c = Math.cos(phase);
  const amp = 0.55 + a * 0.25;
  p.lShP += s * amp * a;
  p.rLegP += s * amp * a;
  p.rShP -= s * amp * a;
  p.lLegP -= s * amp * a;
  p.lEl += Math.max(0, c) * 0.9 * a;
  p.rKnee += Math.max(0, c) * 0.7 * a;
  p.rEl += Math.max(0, -c) * 0.9 * a;
  p.lKnee += Math.max(0, -c) * 0.7 * a;
  p.bodyY += -Math.abs(c) * 0.05 * a;
  p.spineX += Math.sin(phase * 2) * 0.05 * a;
  p.headX -= 0.1 * a;
}

export function beastHit(p: Pose, k: number) {
  p.spineX -= 0.25 * k;
  p.headX -= 0.4 * k;
  p.bodyY -= 0.06 * k;
  p.rWr = 1 * k;
}

export function beastDeath(p: Pose, k: number) {
  const e = Math.min(1, k);
  const f = e * e;
  p.spineZ = 1.45 * f;
  p.bodyY = -0.42 * f;
  p.headX = 0.3 * f;
  p.rWr = 0.6 * f;
  p.lShP = 0.4 * f; p.rShP = 0.2 * f; p.lLegP = -0.3 * f; p.rLegP = -0.1 * f;
  p.lEl = p.rEl = p.lKnee = p.rKnee = 0.2;
}
