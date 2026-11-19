import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Esqueleto procedural: personajes construidos con primitivas y animados con
// poses por código (sin archivos externos). Ejes: el personaje mira hacia +Z.
// ---------------------------------------------------------------------------

export interface Pose {
  bodyY: number; roll: number; lean: number;
  spineX: number; spineY: number; spineZ: number; headX: number; headY: number;
  lShP: number; lShA: number; lShY: number; lEl: number; lWr: number;
  rShP: number; rShA: number; rShY: number; rEl: number; rWr: number;
  shield: number;
  lLegP: number; lLegA: number; lKnee: number;
  rLegP: number; rLegA: number; rKnee: number;
}
export type PoseKey = keyof Pose;

export function basePose(): Pose {
  return {
    bodyY: 0, roll: 0, lean: 0, spineX: 0, spineY: 0, spineZ: 0, headX: 0, headY: 0,
    lShP: 0, lShA: 0.12, lShY: 0, lEl: 0.15, lWr: 0,
    rShP: 0, rShA: 0.12, rShY: 0, rEl: 0.15, rWr: 0, shield: 0,
    lLegP: 0, lLegA: 0.04, lKnee: 0.05, rLegP: 0, rLegA: 0.04, rKnee: 0.05,
  };
}
export const POSE_KEYS = Object.keys(basePose()) as PoseKey[];

export function copyPose(out: Pose, src: Pose) {
  for (const k of POSE_KEYS) out[k] = src[k];
}
export function assign(out: Pose, p: Partial<Pose>, w = 1) {
  for (const k in p) {
    const key = k as PoseKey;
    out[key] += ((p[key] as number) - out[key]) * w;
  }
}

export interface Key { t: number; p: Partial<Pose> }

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Interpola keyframes (t normalizado 0..1) sobre la pose base `out` */
export function sampleKeys(keys: Key[], t: number, out: Pose) {
  if (t <= keys[0].t) { assign(out, keys[0].p); return; }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const u = smooth((t - a.t) / Math.max(1e-4, b.t - a.t));
      const seen = new Set<string>();
      for (const k of [...Object.keys(a.p), ...Object.keys(b.p)]) {
        if (seen.has(k)) continue;
        seen.add(k);
        const key = k as PoseKey;
        const va = a.p[key] ?? out[key];
        const vb = b.p[key] ?? out[key];
        out[key] = va + (vb - va) * u;
      }
      return;
    }
  }
  assign(out, keys[keys.length - 1].p);
}

export type RigKind = 'agent' | 'legionary' | 'brute' | 'retiarius' | 'centurion' | 'statue' | 'caveman' | 'sloth';
export type WeaponType = 'fists' | 'gladius' | 'spear' | 'club' | 'trident' | 'centurion' | 'garrote' | 'flintspear' | 'claws';

/** Interfaz común a humanoides y cuadrúpedos */
export interface Body {
  root: THREE.Group; pose: Pose; weapon: THREE.Group | null; cape: THREE.Mesh | null;
  bladeBase: THREE.Object3D; bladeTip: THREE.Object3D;
  apply(): void; flash(v: number, color?: number): void; telegraph(v: number): void; setOpacity(o: number): void;
}

export interface RigLook {
  skin: THREE.MeshStandardMaterial;
  suit: THREE.MeshStandardMaterial;    // ropa base
  armor: THREE.MeshStandardMaterial;   // armadura
  accent: THREE.MeshStandardMaterial;  // detalle (emisivo en la agente)
  leather: THREE.MeshStandardMaterial;
}

function cap(r: number, len: number) {
  return new THREE.CapsuleGeometry(r, len, 4, 12);
}

export class Rig {
  root = new THREE.Group();
  lean = new THREE.Group();
  rollG = new THREE.Group();
  off = new THREE.Group();
  hips = new THREE.Group();
  spine = new THREE.Group();
  chest = new THREE.Group();
  head = new THREE.Group();
  lSh = new THREE.Group(); lEl = new THREE.Group(); lHand = new THREE.Group();
  rSh = new THREE.Group(); rEl = new THREE.Group(); rHand = new THREE.Group();
  lHip = new THREE.Group(); lKnee = new THREE.Group();
  rHip = new THREE.Group(); rKnee = new THREE.Group();
  pose = basePose();
  mats: THREE.MeshStandardMaterial[] = [];
  private baseEmissive: THREE.Color[] = [];
  weapon: THREE.Group | null = null;
  weaponMats: THREE.MeshStandardMaterial[] = [];
  bladeBase = new THREE.Object3D();
  bladeTip = new THREE.Object3D();
  cape: THREE.Mesh | null = null;
  shield: THREE.Group | null = null;
  kind: RigKind;

  constructor(kind: RigKind, look: RigLook, scale = 1) {
    this.kind = kind;
    // Clonamos materiales para poder hacer destellos por personaje
    const L: RigLook = {
      skin: look.skin.clone(), suit: look.suit.clone(), armor: look.armor.clone(),
      accent: look.accent.clone(), leather: look.leather.clone(),
    };
    for (const m of [L.skin, L.suit, L.armor, L.leather]) this.mats.push(m);
    if (kind !== 'agent') this.mats.push(L.accent);
    this.baseEmissive = this.mats.map((m) => m.emissive.clone());

    this.root.add(this.lean);
    this.lean.add(this.rollG);
    this.rollG.position.y = 0.55;
    this.rollG.add(this.off);
    this.off.position.y = -0.55;
    this.off.add(this.hips);
    this.hips.position.y = 0.95;
    this.root.scale.setScalar(scale);

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    const glad = kind === 'brute' || kind === 'retiarius';
    const bare = glad;
    const furry = kind === 'sloth';
    const limbArm = kind === 'agent' || kind === 'statue' || furry ? L.suit : L.skin;
    const limbLeg = kind === 'agent' || kind === 'statue' || furry ? L.suit : L.skin;

    // --- Pelvis
    add(this.hips, new THREE.BoxGeometry(0.32, 0.16, 0.2), kind === 'agent' ? L.suit : L.leather, 0, 0, 0);
    if (kind === 'legionary' || kind === 'centurion') {
      // falda de la túnica + pteruges
      const skirt = add(this.hips, new THREE.CylinderGeometry(0.19, 0.27, 0.32, 14, 1, true), L.suit, 0, -0.14, 0);
      skirt.scale.z = 0.8;
      for (let i = 0; i < 7; i++) {
        add(this.hips, new THREE.BoxGeometry(0.045, 0.24, 0.015), L.leather, -0.15 + i * 0.05, -0.1, 0.17);
      }
    } else if (glad) {
      const skirt = add(this.hips, new THREE.CylinderGeometry(0.2, 0.26, 0.3, 12, 1, true), L.leather, 0, -0.12, 0);
      skirt.scale.z = 0.8;
      add(this.hips, new THREE.TorusGeometry(0.19, 0.035, 6, 18), L.armor, 0, 0.05, 0).rotation.x = Math.PI / 2;
    } else if (kind === 'agent') {
      add(this.hips, new THREE.BoxGeometry(0.34, 0.05, 0.22), L.accent, 0, 0.06, 0);
    } else if (kind === 'caveman' || kind === 'sloth') {
      const skirt = add(this.hips, new THREE.CylinderGeometry(0.2, 0.3, kind === 'sloth' ? 0.3 : 0.36, 9, 1, true), L.suit, 0, -0.15, 0);
      skirt.scale.z = 0.85;
      if (kind === 'caveman') add(this.hips, new THREE.TorusGeometry(0.19, 0.025, 5, 14), L.leather, 0, 0.03, 0).rotation.x = Math.PI / 2;
    }

    // --- Columna / torso
    this.hips.add(this.spine);
    this.spine.position.y = 0.08;
    const torso = add(this.spine, cap(0.165, 0.26), bare ? L.skin : L.suit, 0, 0.24, 0);
    torso.scale.set(1.3, 1, 0.82);
    this.spine.add(this.chest);
    this.chest.position.y = 0.42;

    if (kind === 'agent') {
      const plate = add(this.spine, new THREE.BoxGeometry(0.4, 0.26, 0.08), L.armor, 0, 0.32, 0.11);
      plate.rotation.x = -0.1;
      add(this.spine, new THREE.BoxGeometry(0.03, 0.2, 0.01), L.accent, 0.09, 0.31, 0.155);
      add(this.spine, new THREE.BoxGeometry(0.03, 0.2, 0.01), L.accent, -0.09, 0.31, 0.155);
      add(this.spine, new THREE.BoxGeometry(0.36, 0.25, 0.06), L.armor, 0, 0.3, -0.13);
      // núcleo cronal a la espalda
      const core = add(this.spine, new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), L.armor, 0, 0.32, -0.19);
      core.rotation.x = Math.PI / 2;
      const ring = add(this.spine, new THREE.TorusGeometry(0.075, 0.015, 8, 24), L.accent, 0, 0.32, -0.28);
      ring.castShadow = false;
    } else if (kind === 'legionary' || kind === 'centurion' || kind === 'statue') {
      // lorica segmentata: bandas metálicas
      for (let i = 0; i < 4; i++) {
        const band = add(this.spine, new THREE.CylinderGeometry(0.205 - i * 0.004, 0.215 - i * 0.004, 0.065, 16), L.armor, 0, 0.13 + i * 0.07, 0);
        band.scale.z = 0.78;
      }
      const top = add(this.spine, new THREE.CylinderGeometry(0.17, 0.2, 0.12, 16), L.armor, 0, 0.42, 0);
      top.scale.z = 0.78;
      if (kind === 'centurion') {
        for (let i = 0; i < 5; i++) {
          const ph = add(this.spine, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12), L.accent, -0.1 + (i % 3) * 0.1, 0.2 + Math.floor(i / 3) * 0.1, 0.175);
          ph.rotation.x = Math.PI / 2;
        }
      }
    } else if (kind === 'caveman') {
      // piel cruzada sobre un hombro
      const pelt = add(this.spine, new THREE.BoxGeometry(0.2, 0.62, 0.36), L.suit, 0.06, 0.25, 0);
      pelt.rotation.z = -0.55;
      add(this.spine, new THREE.CylinderGeometry(0.2, 0.22, 0.2, 10), L.suit, 0, 0.1, 0).scale.z = 0.85;
      add(this.spine, new THREE.SphereGeometry(0.035, 6, 5), L.accent, -0.05, 0.42, 0.14); // collar de colmillo
    } else if (kind === 'sloth') {
      add(this.spine, new THREE.SphereGeometry(0.3, 16, 12), L.suit, 0, 0.12, 0.04).scale.set(1.15, 1.1, 1.05);
      add(this.spine, new THREE.SphereGeometry(0.26, 16, 12), L.suit, 0, 0.42, -0.04).scale.set(1.3, 0.9, 1);
    } else if (glad) {
      const strap = add(this.spine, new THREE.BoxGeometry(0.06, 0.55, 0.02), L.leather, 0, 0.27, 0.13);
      strap.rotation.z = 0.6;
      const strap2 = add(this.spine, new THREE.BoxGeometry(0.06, 0.55, 0.02), L.leather, 0, 0.27, -0.13);
      strap2.rotation.z = 0.6;
    }

    // --- Cabeza
    this.chest.add(this.head);
    this.head.position.y = 0.07;
    add(this.head, new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), L.skin, 0, 0.02, 0);
    const skull = add(this.head, new THREE.SphereGeometry(0.115, 20, 16), kind === 'agent' || furry ? L.suit : L.skin, 0, 0.16, 0.01);
    skull.scale.set(0.9, 1.05, 1);
    if (kind !== 'agent') {
      add(this.head, new THREE.BoxGeometry(0.05, 0.03, 0.04), L.skin, 0, 0.15, 0.115); // nariz
    }
    if (kind === 'agent') {
      const helm = add(this.head, new THREE.SphereGeometry(0.135, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), L.armor, 0, 0.17, 0);
      helm.scale.set(0.95, 1.05, 1.08);
      const visor = add(this.head, new THREE.BoxGeometry(0.2, 0.045, 0.06), L.accent, 0, 0.165, 0.1);
      visor.castShadow = false;
      add(this.head, new THREE.BoxGeometry(0.16, 0.06, 0.05), L.armor, 0, 0.09, 0.08);
    } else if (kind === 'legionary' || kind === 'centurion' || kind === 'statue') {
      const helm = add(this.head, new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), kind === 'statue' ? L.armor : L.accent, 0, 0.18, 0);
      helm.scale.z = 1.05;
      const neckGuard = add(this.head, new THREE.CylinderGeometry(0.13, 0.16, 0.05, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), kind === 'statue' ? L.armor : L.accent, 0, 0.12, 0);
      neckGuard.rotation.y = Math.PI;
      add(this.head, new THREE.BoxGeometry(0.02, 0.09, 0.07), kind === 'statue' ? L.armor : L.accent, 0.11, 0.13, 0.05);
      add(this.head, new THREE.BoxGeometry(0.02, 0.09, 0.07), kind === 'statue' ? L.armor : L.accent, -0.11, 0.13, 0.05);
      if (kind === 'centurion') {
        // cresta transversal
        const crest = add(this.head, new THREE.BoxGeometry(0.34, 0.12, 0.04), L.suit, 0, 0.33, 0);
        crest.scale.y = 1;
        add(this.head, new THREE.BoxGeometry(0.03, 0.08, 0.03), L.accent, 0, 0.29, 0);
      } else if (kind === 'legionary') {
        add(this.head, new THREE.SphereGeometry(0.025, 8, 6), L.accent, 0, 0.32, 0);
      } else {
        add(this.head, new THREE.BoxGeometry(0.04, 0.12, 0.3), L.armor, 0, 0.33, 0);
      }
    } else if (kind === 'caveman') {
      const hair = add(this.head, new THREE.IcosahedronGeometry(0.14, 1), L.leather, 0, 0.21, -0.025);
      hair.scale.set(1.05, 0.85, 1.05);
      const beard = add(this.head, new THREE.IcosahedronGeometry(0.09, 1), L.leather, 0, 0.07, 0.07);
      beard.scale.set(1.1, 1.1, 0.7);
      add(this.head, new THREE.BoxGeometry(0.2, 0.025, 0.04), L.leather, 0, 0.2, 0.09); // ceja
    } else if (kind === 'sloth') {
      const snout = add(this.head, new THREE.CapsuleGeometry(0.075, 0.14, 4, 10), L.suit, 0, 0.12, 0.13);
      snout.rotation.x = Math.PI / 2 + 0.3;
      add(this.head, new THREE.SphereGeometry(0.04, 8, 6), L.leather, 0, 0.09, 0.24);
      for (const sd of [-1, 1]) {
        add(this.head, new THREE.SphereGeometry(0.035, 8, 6), L.suit, sd * 0.09, 0.24, -0.02);
        add(this.head, new THREE.SphereGeometry(0.018, 6, 5), L.accent, sd * 0.06, 0.19, 0.1).castShadow = false;
      }
    } else if (kind === 'retiarius') {
      const hair = add(this.head, new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), L.leather, 0, 0.175, -0.005);
      hair.scale.set(0.95, 1.0, 1.05);
      const band = add(this.head, new THREE.TorusGeometry(0.11, 0.012, 6, 20), L.suit, 0, 0.19, 0.01);
      band.rotation.x = Math.PI / 2;
    } else if (kind === 'brute') {
      const helm = add(this.head, new THREE.SphereGeometry(0.145, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), L.armor, 0, 0.17, 0);
      helm.scale.set(1, 1.05, 1.08);
      const brim = add(this.head, new THREE.CylinderGeometry(0.22, 0.22, 0.02, 18), L.armor, 0, 0.13, 0);
      brim.scale.z = 1.1;
      const grill = add(this.head, new THREE.BoxGeometry(0.16, 0.12, 0.03), L.leather, 0, 0.16, 0.13);
      grill.castShadow = false;
      add(this.head, new THREE.BoxGeometry(0.03, 0.2, 0.32), L.armor, 0, 0.3, -0.01);
    }

    // --- Brazos
    const arm = (side: 1 | -1, sh: THREE.Group, el: THREE.Group, hand: THREE.Group) => {
      this.chest.add(sh);
      sh.position.set(0.215 * side, -0.02, 0);
      add(sh, cap(0.056, 0.2), limbArm, 0, -0.15, 0);
      // hombrera
      if (kind === 'agent') {
        const pad = add(sh, new THREE.SphereGeometry(0.085, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), L.armor, 0.01 * side, 0.0, 0);
        pad.scale.set(1.1, 0.9, 1.1);
        add(sh, new THREE.BoxGeometry(0.012, 0.12, 0.03), L.accent, 0.06 * side, -0.17, 0);
      } else if (kind === 'legionary' || kind === 'centurion' || kind === 'statue') {
        for (let i = 0; i < 3; i++) {
          const p = add(sh, new THREE.SphereGeometry(0.09 - i * 0.008, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), L.armor, 0.01 * side, -0.02 - i * 0.045, 0);
          p.scale.set(1.05, 0.7, 1.05);
        }
      } else if (kind === 'retiarius' && side === 1) {
        // manica y galerus (hombrera alta) en el brazo izquierdo
        for (let i = 0; i < 5; i++) add(sh, new THREE.CylinderGeometry(0.066, 0.064, 0.05, 10), L.armor, 0, -0.04 - i * 0.05, 0);
        const gal = add(sh, new THREE.BoxGeometry(0.03, 0.22, 0.2), L.armor, 0.09, 0.08, 0);
        gal.rotation.z = -0.25;
      } else if (kind === 'brute' && side === -1) {
        // manica en el brazo del arma
        for (let i = 0; i < 4; i++) add(sh, new THREE.CylinderGeometry(0.07, 0.068, 0.05, 10), L.armor, 0, -0.06 - i * 0.055, 0);
      }
      sh.add(el);
      el.position.y = -0.3;
      add(el, cap(0.05, 0.18), limbArm, 0, -0.13, 0);
      if (kind === 'agent') add(el, new THREE.CylinderGeometry(0.062, 0.058, 0.14, 12), L.armor, 0, -0.16, 0);
      if (kind === 'legionary' || kind === 'centurion' || glad) add(el, new THREE.CylinderGeometry(0.058, 0.055, 0.1, 10), L.leather, 0, -0.2, 0);
      el.add(hand);
      hand.position.y = -0.28;
      add(hand, new THREE.SphereGeometry(0.055, 10, 8), kind === 'agent' ? L.armor : furry ? L.suit : L.skin, 0, 0, 0.01).scale.set(0.9, 1, 1.1);
      if (furry) {
        // garras largas
        for (let i = -1; i <= 1; i++) {
          const claw = add(hand, new THREE.ConeGeometry(0.018, 0.2, 6), L.accent, i * 0.03, -0.1, 0.05);
          claw.rotation.x = Math.PI - 0.5;
        }
      }
    };
    arm(1, this.lSh, this.lEl, this.lHand);
    arm(-1, this.rSh, this.rEl, this.rHand);

    // --- Piernas
    const leg = (side: 1 | -1, hip: THREE.Group, knee: THREE.Group) => {
      this.hips.add(hip);
      hip.position.set(0.1 * side, -0.05, 0);
      add(hip, cap(0.078, 0.28), limbLeg, 0, -0.21, 0);
      if (kind === 'agent') {
        add(hip, new THREE.BoxGeometry(0.1, 0.22, 0.06), L.armor, 0, -0.2, 0.06);
        add(hip, new THREE.BoxGeometry(0.012, 0.18, 0.012), L.accent, 0.075 * side, -0.2, 0);
      }
      hip.add(knee);
      knee.position.y = -0.43;
      add(knee, cap(0.062, 0.3), limbLeg, 0, -0.2, 0);
      if (kind === 'agent') {
        add(knee, new THREE.BoxGeometry(0.11, 0.28, 0.1), L.armor, 0, -0.24, 0.02);
      } else if (kind === 'legionary' || kind === 'centurion' || glad) {
        // greaves / sandalias
        add(knee, new THREE.CylinderGeometry(0.07, 0.06, 0.22, 10), glad ? L.leather : L.armor, 0, -0.26, 0.01);
      }
      const foot = add(knee, new THREE.BoxGeometry(0.1, 0.07, 0.24), kind === 'agent' ? L.armor : L.leather, 0, -0.44, 0.05);
      foot.castShadow = true;
    };
    leg(1, this.lHip, this.lKnee);
    leg(-1, this.rHip, this.rKnee);

    if (kind === 'centurion') {
      // capa roja
      const geo = new THREE.PlaneGeometry(0.5, 1.05, 4, 8);
      geo.translate(0, -0.52, 0);
      const capeMat = L.suit.clone();
      capeMat.side = THREE.DoubleSide;
      this.mats.push(capeMat);
      this.baseEmissive.push(capeMat.emissive.clone());
      this.cape = add(this.chest, geo, capeMat, 0, 0.02, -0.17);
      this.cape.rotation.x = 0.15;
    }
    this.apply();
  }

  setWeapon(type: WeaponType, mats: { metal: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial; leather: THREE.MeshStandardMaterial; gold: THREE.MeshStandardMaterial; glow: THREE.MeshStandardMaterial; stone?: THREE.MeshStandardMaterial }) {
    if (this.weapon) this.rHand.remove(this.weapon);
    this.weapon = null;
    this.weaponMats = [];
    if (type === 'fists' || type === 'claws') {
      this.bladeBase.position.set(0, 0, 0.05);
      this.bladeTip.position.set(0, 0, 0.12);
      this.rHand.add(this.bladeBase, this.bladeTip);
      return;
    }
    const g = new THREE.Group();
    const metal = mats.metal.clone();
    const glow = mats.glow;
    this.weaponMats.push(metal);
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    if (type === 'gladius' || type === 'centurion') {
      const len = type === 'centurion' ? 0.72 : 0.6;
      mk(new THREE.CylinderGeometry(0.02, 0.022, 0.12, 8), mats.leather, 0, 0, 0).rotation.x = Math.PI / 2;
      mk(new THREE.SphereGeometry(0.035, 10, 8), mats.gold, 0, 0, -0.08);
      mk(new THREE.BoxGeometry(0.11, 0.03, 0.04), mats.gold, 0, 0, 0.07);
      const blade = mk(new THREE.BoxGeometry(0.055, 0.008, len), metal, 0, 0, 0.09 + len / 2);
      blade.castShadow = true;
      const tip = mk(new THREE.ConeGeometry(0.039, 0.1, 4), metal, 0, 0, 0.09 + len + 0.04);
      tip.rotation.x = Math.PI / 2;
      tip.rotation.y = Math.PI / 4;
      tip.scale.set(1, 1, 0.2);
      // filo luminoso de la agente
      if (this.kind === 'agent') {
        const edge = mk(new THREE.BoxGeometry(0.008, 0.012, len), glow, 0.028, 0, 0.09 + len / 2);
        edge.castShadow = false;
      }
      this.bladeBase.position.set(0, 0, 0.12);
      this.bladeTip.position.set(0, 0, 0.12 + len);
    } else if (type === 'spear') {
      mk(new THREE.CylinderGeometry(0.018, 0.018, 2.0, 8), mats.wood, 0, 0, 0.35).rotation.x = Math.PI / 2;
      const head = mk(new THREE.ConeGeometry(0.04, 0.32, 4), metal, 0, 0, 1.5);
      head.rotation.x = Math.PI / 2;
      mk(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8), mats.gold, 0, 0, 1.32).rotation.x = Math.PI / 2;
      if (this.kind === 'agent') {
        const ring = mk(new THREE.TorusGeometry(0.03, 0.008, 6, 14), glow, 0, 0, 1.2);
        ring.castShadow = false;
      }
      this.bladeBase.position.set(0, 0, 0.9);
      this.bladeTip.position.set(0, 0, 1.66);
    } else if (type === 'garrote') {
      mk(new THREE.CylinderGeometry(0.035, 0.03, 0.8, 7), mats.wood, 0, 0, 0.3).rotation.x = Math.PI / 2;
      const knob = mk(new THREE.IcosahedronGeometry(0.11, 0), mats.wood, 0, 0, 0.72);
      knob.scale.set(1, 1, 1.6);
      for (let i = 0; i < 3; i++) mk(new THREE.TorusGeometry(0.04, 0.008, 4, 10), mats.leather, 0, 0, 0.02 + i * 0.03);
      this.weaponMats.push(metal);
      this.bladeBase.position.set(0, 0, 0.45);
      this.bladeTip.position.set(0, 0, 0.9);
    } else if (type === 'flintspear') {
      mk(new THREE.CylinderGeometry(0.02, 0.022, 1.9, 7), mats.wood, 0, 0, 0.3).rotation.x = Math.PI / 2;
      const tip = mk(new THREE.OctahedronGeometry(0.07, 0), mats.stone ?? metal, 0, 0, 1.33);
      tip.scale.set(0.7, 0.35, 2.2);
      mk(new THREE.TorusGeometry(0.025, 0.01, 4, 10), mats.leather, 0, 0, 1.2);
      this.bladeBase.position.set(0, 0, 0.9);
      this.bladeTip.position.set(0, 0, 1.5);
    } else if (type === 'trident') {
      mk(new THREE.CylinderGeometry(0.018, 0.02, 1.9, 8), mats.wood, 0, 0, 0.3).rotation.x = Math.PI / 2;
      mk(new THREE.BoxGeometry(0.26, 0.025, 0.03), metal, 0, 0, 1.26);
      for (const x of [-0.12, 0, 0.12]) {
        const prong = mk(new THREE.ConeGeometry(0.018, 0.34, 6), metal, x, 0, 1.43);
        prong.rotation.x = Math.PI / 2;
      }
      if (this.kind === 'agent') {
        const ring = mk(new THREE.TorusGeometry(0.03, 0.008, 6, 14), glow, 0, 0, 1.15);
        ring.castShadow = false;
      }
      this.bladeBase.position.set(0, 0, 0.9);
      this.bladeTip.position.set(0, 0, 1.6);
    } else if (type === 'club') {
      mk(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 8), mats.wood, 0, 0, 0.3).rotation.x = Math.PI / 2;
      const head = mk(new THREE.CylinderGeometry(0.12, 0.1, 0.32, 10), metal, 0, 0, 0.8);
      head.rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = mk(new THREE.ConeGeometry(0.03, 0.09, 5), metal, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.8);
        sp.rotation.z = a - Math.PI / 2;
      }
      this.bladeBase.position.set(0, 0, 0.5);
      this.bladeTip.position.set(0, 0, 0.98);
    }
    g.add(this.bladeBase, this.bladeTip);
    this.weapon = g;
    this.rHand.add(g);
  }

  addShield(mat: THREE.MeshStandardMaterial, boss: THREE.MeshStandardMaterial) {
    const s = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.75, 0.75, 0.95, 20, 1, true, -0.42, 0.84);
    const sh = new THREE.Mesh(geo, mat);
    sh.castShadow = true;
    sh.material.side = THREE.DoubleSide;
    sh.position.z = -0.7;
    s.add(sh);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), boss);
    b.rotation.x = Math.PI / 2;
    b.position.z = 0.06;
    s.add(b);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.95, 0.02), boss);
    rim.position.set(0, 0, 0.02);
    s.add(rim);
    s.position.set(0.17, 0.0, 0.3);
    s.rotation.y = -0.3;
    this.spine.add(s);
    this.shield = s;
  }

  apply() {
    const p = this.pose;
    this.off.position.y = -0.55 + p.bodyY;
    this.rollG.rotation.x = p.roll;
    this.lean.rotation.x = p.lean;
    this.spine.rotation.set(p.spineX, p.spineY, p.spineZ);
    this.head.rotation.set(p.headX, p.headY, 0);
    this.lSh.rotation.set(-p.lShP, -p.lShY, p.lShA);
    this.rSh.rotation.set(-p.rShP, p.rShY, -p.rShA);
    this.lEl.rotation.x = -p.lEl;
    this.rEl.rotation.x = -p.rEl;
    this.lHand.rotation.x = p.lWr;
    this.rHand.rotation.x = p.rWr;
    this.lHip.rotation.set(-p.lLegP, 0, p.lLegA);
    this.rHip.rotation.set(-p.rLegP, 0, -p.rLegA);
    this.lKnee.rotation.x = p.lKnee;
    this.rKnee.rotation.x = p.rKnee;
    if (this.shield) {
      this.shield.position.set(0.17 - p.shield * 0.12, p.shield * 0.18, 0.3 + p.shield * 0.08);
      this.shield.rotation.set(-0.05 * p.shield, -0.3 + p.shield * 0.25, 0);
    }
    if (this.cape) this.cape.rotation.x = 0.15 + Math.max(0, -this.pose.spineX) * 0.5;
  }

  flash(v: number, color = 0xffffff) {
    const c = new THREE.Color(color);
    this.mats.forEach((m, i) => {
      m.emissive.copy(this.baseEmissive[i]).lerp(c, v);
    });
  }

  telegraph(v: number) {
    for (const m of this.weaponMats) {
      m.emissive.setRGB(1.0 * v * 2.5, 0.35 * v * 2.5, 0.05 * v);
    }
  }

  setOpacity(o: number) {
    for (const m of [...this.mats, ...this.weaponMats]) {
      m.transparent = o < 1;
      m.opacity = o;
    }
  }
}

// ---------------------------------------------------------------------------
// Poses compartidas
// ---------------------------------------------------------------------------

export function guardPose(p: Pose, weapon: WeaponType, t: number, blocking = false) {
  const br = Math.sin(t * 2.2) * 0.03;
  p.spineX = 0.08 + br;
  p.headX = -0.06 - br;
  p.lLegP = 0.18; p.rLegP = -0.12; p.lKnee = 0.25; p.rKnee = 0.3; p.bodyY = -0.03;
  p.lLegA = 0.1; p.rLegA = 0.1;
  switch (weapon) {
    case 'fists':
      p.lShP = 0.75; p.lEl = 2.0; p.lShA = 0.25;
      p.rShP = 0.55; p.rEl = 2.1; p.rShA = 0.25; p.rWr = 0;
      p.spineY = 0.2;
      break;
    case 'gladius':
    case 'centurion':
      p.lShP = 0.5; p.lEl = 1.3; p.lShA = 0.2;
      p.rShP = 0.45; p.rEl = 1.1; p.rShA = 0.18; p.rWr = 0.25;
      p.spineY = 0.15;
      break;
    case 'spear':
    case 'trident':
    case 'flintspear':
      p.lShP = 0.9; p.lEl = 0.9; p.lShA = 0.1;
      p.rShP = 0.3; p.rEl = 1.25; p.rShA = 0.25; p.rWr = 1.25;
      p.spineY = 0.35;
      break;
    case 'claws':
      p.lShP = 0.5; p.lEl = 0.6; p.lShA = 0.25;
      p.rShP = 0.5; p.rEl = 0.6; p.rShA = 0.25;
      p.spineX = 0.45 + br; p.headX = -0.4;
      break;
    case 'club':
    case 'garrote':
      p.lShP = 0.6; p.lEl = 1.2; p.lShA = 0.2;
      p.rShP = 0.35; p.rEl = 1.4; p.rShA = 0.25; p.rWr = -0.3;
      p.spineY = 0.1;
      break;
  }
  if (blocking) {
    if (weapon === 'fists') {
      p.lShP = 1.4; p.lEl = 2.3; p.rShP = 1.35; p.rEl = 2.3; p.lShA = 0.35; p.rShA = 0.35; p.headX = 0.2;
    } else {
      p.rShP = 1.1; p.rEl = 1.4; p.rShA = 0.55; p.rShY = 0.6; p.rWr = 1.2;
      p.lShP = 1.0; p.lEl = 1.6; p.lShA = 0.2;
    }
    p.spineX = 0.18; p.bodyY = -0.08; p.lKnee = 0.45; p.rKnee = 0.45;
  }
}

/** Ciclo de caminar/correr superpuesto. a = intensidad 0..1 */
export function locomotion(p: Pose, phase: number, a: number, armSwing = 1) {
  if (a <= 0.001) return;
  const s = Math.sin(phase), c = Math.cos(phase);
  const lp = s * 0.65 * a, rp = -s * 0.65 * a;
  p.lLegP = p.lLegP * (1 - a) + lp;
  p.rLegP = p.rLegP * (1 - a) + rp;
  p.lKnee = p.lKnee * (1 - a) + (Math.max(0, c) * 1.1 + 0.15) * a;
  p.rKnee = p.rKnee * (1 - a) + (Math.max(0, -c) * 1.1 + 0.15) * a;
  p.bodyY += (-Math.abs(c) * 0.05 + 0.0) * a;
  p.spineX += 0.12 * a;
  p.spineY += s * 0.12 * a;
  p.lShP += -s * 0.35 * a * armSwing;
  p.rShP += s * 0.35 * a * armSwing;
}

export function hitPose(p: Pose, k: number) {
  p.lean -= 0.18 * k;
  p.spineX -= 0.4 * k;
  p.headX -= 0.35 * k;
  p.lShA += 0.5 * k;
  p.rShA += 0.5 * k;
  p.lKnee += 0.3 * k;
  p.rKnee += 0.3 * k;
  p.bodyY -= 0.05 * k;
}

export function deathPose(p: Pose, k: number) {
  const e = Math.min(1, k);
  const f = e * e;
  p.lean = -1.5 * f;
  p.spineX = -0.2 * f;
  p.headX = -0.3 * f;
  p.lShP = 2.6 * f; p.rShP = 2.4 * f; p.lShA = 0.6 * f; p.rShA = 0.5 * f; p.lEl = 0.3; p.rEl = 0.4;
  p.lLegP = 0.25 * f; p.rLegP = -0.1 * f; p.lKnee = 0.5 * f; p.rKnee = 0.2 * f;
  p.bodyY = 0.12 * f;
}
