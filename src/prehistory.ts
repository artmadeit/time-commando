import * as THREE from 'three';
import type { Level } from './level';

// ---------------------------------------------------------------------------
// ERA I · PREHISTORIA
//   Nivel 1: El Valle de los Colmillos (pradera, campamento, claro de menhires)
//   Nivel 2: Los Pozos de Brea (llanura volcánica, brea y lava, cráter)
// Mismo trazado lineal en ambos: explanada (z -8..50) → cañón (z 50..100)
// → claro circular (centro z = 124, radio 17).
// ---------------------------------------------------------------------------

export const CLEARING = new THREE.Vector3(0, 0, 124);
const CR = 17;

function fern(L: Level, x: number, z: number, s = 1) {
  const mat = L.m.leaves.clone();
  mat.color.setHex(0x3d5a26);
  mat.side = THREE.DoubleSide;
  mat.flatShading = false;
  const g = new THREE.Group();
  const n = 7 + Math.floor(L.r() * 4);
  for (let i = 0; i < n; i++) {
    const geo = new THREE.PlaneGeometry(0.35 * s, 1.5 * s, 1, 4);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) / (1.5 * s) + 0.5;
      p.setZ(k, -y * y * 0.7 * s);
      p.setX(k, p.getX(k) * (1 - y * 0.7));
    }
    geo.translate(0, 0.75 * s, 0);
    const leaf = new THREE.Mesh(geo, mat);
    leaf.rotation.y = (i / n) * Math.PI * 2 + L.r() * 0.3;
    leaf.rotation.x = 0.5 + L.r() * 0.3;
    leaf.rotation.order = 'YXZ';
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  L.group.add(g);
}

function araucaria(L: Level, x: number, z: number) {
  const h = 9 + L.r() * 5;
  L.cyl(0.18, 0.32, h, L.m.wood(), x, h / 2, z, 7);
  for (let i = 0; i < 3; i++) {
    const r = 2.6 - i * 0.7;
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, 1.4, 9), L.m.leaves);
    c.position.set(x, h - 0.6 + i * 0.9, z);
    c.castShadow = true;
    L.group.add(c);
  }
}

function cycad(L: Level, x: number, z: number) {
  const h = 1.2 + L.r() * 1.4;
  L.cyl(0.28, 0.35, h, L.m.wood(), x, h / 2, z, 8);
  fern(L, x, z, 1.4);
  L.group.children[L.group.children.length - 1].position.y = h - 0.2;
}

function tent(L: Level, x: number, z: number, hue: number) {
  const fur = L.m.fur(hue, 30, 38);
  const t = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 9, 1, true), fur);
  t.position.set(x, 1.6, z);
  t.material.side = THREE.DoubleSide;
  t.castShadow = t.receiveShadow = true;
  L.group.add(t);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pole = L.cyl(0.03, 0.03, 1.2, L.m.wood(), x + Math.cos(a) * 0.15, 3.5, z + Math.sin(a) * 0.15, 5);
    pole.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
  }
  L.box(0.8, 1.6, 0.05, L.m.voidDark, x, 0.8, z + 1.35, 0, false, false);
  L.col(x, z, 1.4, 1.4);
}

function campfire(L: Level, x: number, z: number, light: boolean) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    L.rock(x + Math.cos(a) * 0.7, z + Math.sin(a) * 0.7, 0.22);
  }
  for (let i = 0; i < 3; i++) {
    const log = L.cyl(0.07, 0.07, 1, L.m.wood(), x, 0.15, z, 6);
    log.rotation.set(Math.PI / 2, i, 0);
    log.rotation.order = 'YXZ';
  }
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), L.m.flame);
  fl.position.set(x, 0.55, z);
  L.group.add(fl);
  L.flameMeshes.push(fl);
  L.flames.push(new THREE.Vector3(x, 0.4, z));
  L.smoke.push(new THREE.Vector3(x, 1.2, z));
  if (light) {
    const pl = new THREE.PointLight(0xff8a3a, 30, 16, 1.8);
    pl.position.set(x, 1.4, z);
    L.group.add(pl);
  }
  L.col(x, z, 0.8, 0.8);
}

function mammothSkeleton(L: Level, x: number, z: number, rot: number, sunk = 0) {
  const g = new THREE.Group();
  const bone = L.m.bone;
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 4.2, 8), bone);
  spine.rotation.z = Math.PI / 2;
  spine.position.y = 2.1;
  g.add(spine);
  for (let i = 0; i < 9; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.1 - Math.abs(i - 4) * 0.08, 0.06, 6, 14, Math.PI), bone);
    rib.position.set(-1.6 + i * 0.4, 2.1, 0);
    rib.rotation.set(Math.PI, Math.PI / 2, 0);
    rib.castShadow = true;
    g.add(rib);
  }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), bone);
  skull.position.set(2.6, 1.9, 0);
  skull.scale.set(1, 1.1, 0.9);
  skull.castShadow = true;
  g.add(skull);
  for (const s of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 6, 16, Math.PI * 0.9), bone);
    tusk.position.set(3.0, 1.2, s * 0.35);
    tusk.rotation.set(0, 0, -Math.PI * 0.95);
    tusk.castShadow = true;
    g.add(tusk);
  }
  g.position.set(x, -sunk, z);
  g.rotation.y = rot;
  L.group.add(g);
  L.col(x, z, 2.4, 1.1, rot);
}

function bones(L: Level, x: number, z: number) {
  for (let i = 0; i < 4; i++) {
    const b = L.cyl(0.05, 0.05, 0.6 + L.r() * 0.5, L.m.bone, x + (L.r() - 0.5) * 1.2, 0.05, z + (L.r() - 0.5) * 1.2, 6);
    b.rotation.set(Math.PI / 2, L.r() * 3, 0);
    b.rotation.order = 'YXZ';
  }
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), L.m.bone);
  sk.position.set(x, 0.12, z);
  sk.castShadow = true;
  L.group.add(sk);
}

function menhir(L: Level, x: number, z: number, h: number) {
  const geo = new THREE.BoxGeometry(0.9, h, 0.6, 2, 4, 2);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h + 0.5;
    const k = 1 - y * 0.35 + Math.sin(p.getX(i) * 9 + p.getY(i) * 3) * 0.05;
    p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, L.m.rock());
  m.position.set(x, h / 2, z);
  m.rotation.y = Math.atan2(x - CLEARING.x, z - CLEARING.z);
  m.castShadow = m.receiveShadow = true;
  L.group.add(m);
}

function deadTree(L: Level, x: number, z: number) {
  const h = 3 + L.r() * 3;
  const t = L.cyl(0.1, 0.22, h, L.m.darkIron, x, h / 2, z, 6);
  t.rotation.z = (L.r() - 0.5) * 0.3;
  for (let i = 0; i < 3; i++) {
    const b = L.cyl(0.04, 0.07, 1.4, L.m.darkIron, x, h * (0.5 + i * 0.15), z, 5);
    b.rotation.set(0, L.r() * 6, 0.9 + L.r() * 0.4);
    b.rotation.order = 'YXZ';
  }
}

/** Bordes de roca y colisiones del trazado común */
function layout(L: Level, cliffMat: 'rock' | 'dark') {
  const big = (x: number, z: number, s: number) => {
    const r = L.rock(x, z, s);
    r.scale.y = 1.6 + L.r() * 1.2;
    if (cliffMat === 'dark') r.material = L.m.darkStone();
  };
  // explanada
  L.col(-13, 21, 1, 30); L.col(13, 21, 1, 30); L.col(0, -9, 13, 1);
  for (let z = -8; z < 50; z += 3.6) for (const s of [-1, 1]) big(s * (13.5 + L.r() * 1.5), z + L.r() * 2, 1.6 + L.r() * 1.4);
  for (let x = -12; x <= 12; x += 3.5) big(x, -10 - L.r(), 1.8 + L.r());
  // estrechamiento hacia el cañón
  for (const s of [-1, 1]) {
    L.col(s * 10.5, 50, 2.6, 1);
    for (let x = 8.5; x < 13.5; x += 2) big(s * x, 50.5, 1.8 + L.r());
    L.col(s * 9, 77, 1, 31);
    for (let z = 51; z < 108; z += 3.2) big(s * (9.4 + L.r()), z + L.r(), 1.7 + L.r() * 1.3);
  }
  // claro circular
  const GAP = 0.5;
  const SEG = 40;
  for (let i = 0; i < SEG; i++) {
    const th = (i / SEG) * Math.PI * 2;
    if (Math.abs(th - Math.PI) < GAP) continue;
    const x = CLEARING.x + Math.sin(th) * (CR + 0.8), z = CLEARING.z + Math.cos(th) * (CR + 0.8);
    L.col(x, z, ((Math.PI * 2 * (CR + 1)) / SEG) * 0.6, 0.8, th);
    big(CLEARING.x + Math.sin(th) * (CR + 2), CLEARING.z + Math.cos(th) * (CR + 2), 2 + L.r() * 1.5);
  }
  L.gate(0, 50, 16, 5);
  L.gate(0, 100, 16, 5);
}

function volcano(L: Level, x: number, z: number, active: boolean) {
  const v = new THREE.Mesh(new THREE.ConeGeometry(90, 70, 24, 4, true), L.m.hills.clone());
  (v.material as THREE.MeshStandardMaterial).color.setHex(active ? 0x3a2c26 : 0x5f5446);
  v.position.set(x, 30, z);
  L.group.add(v);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(16, 20), new THREE.MeshBasicMaterial({ color: 0xff6a20 }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 64.5, z);
  L.group.add(glow);
  L.smoke.push(new THREE.Vector3(x, 66, z));
}

function mountains(L: Level, snowy: boolean) {
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const h = 40 + L.r() * 50;
    const m = new THREE.Mesh(new THREE.ConeGeometry(35 + L.r() * 30, h, 7, 2), L.m.hills.clone());
    (m.material as THREE.MeshStandardMaterial).color.setHex(snowy ? 0x6d6a5a : 0x3b302a);
    m.position.set(side * (90 + L.r() * 70), h / 2 - 3, -40 + i * 30);
    L.group.add(m);
    if (snowy) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(12, h * 0.28, 7), new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.6, flatShading: true }));
      cap.position.set(m.position.x, h * 0.86 - 3, m.position.z);
      L.group.add(cap);
    }
  }
}

// ---------------------------------------------------------------------------
export function buildValley(L: Level) {
  const m = L.m;
  L.crowdCenter = null;
  L.ground(m.grassland());
  L.floor(m.dirt(), -3.5, 3.5, -8, 112, 0.004);
  L.floor(m.dirt(), -CR, CR, CLEARING.z - CR, CLEARING.z + CR, 0.003);
  layout(L, 'rock');

  // campamento cavernícola
  tent(L, -8.5, 18, 28);
  tent(L, -9, 30, 18);
  campfire(L, -5.5, 24, true);
  mammothSkeleton(L, 6.5, 14, 0.4);
  bones(L, 3, 33);
  bones(L, -2, 8);
  // pared con pinturas rupestres
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), m.painting);
  wall.position.set(12.3, 2.3, 30);
  wall.rotation.y = -Math.PI / 2;
  L.group.add(wall);
  L.box(1, 5, 9, m.rock(), 12.9, 2.5, 30, 0, false);
  L.spring(6, 40);

  // cañón
  campfire(L, 4.5, 70, true);
  tent(L, 6, 82, 35);
  const log = L.cyl(0.4, 0.45, 7, m.wood(), -4.5, 0.4, 64, 10);
  log.rotation.set(0, 0.5, Math.PI / 2);
  log.rotation.order = 'YXZ';
  L.col(-4.5, 64, 3.4, 0.5, 0.5 + Math.PI / 2);
  bones(L, 2, 58);
  bones(L, -3, 88);
  L.spring(-5, 92);

  // claro de menhires
  for (let i = 0; i < 12; i++) {
    const th = (i / 12) * Math.PI * 2 + 0.26;
    if (Math.abs(th - Math.PI) < 0.6) continue;
    menhir(L, CLEARING.x + Math.sin(th) * (CR - 2), CLEARING.z + Math.cos(th) * (CR - 2), 2.6 + L.r() * 1.6);
  }
  campfire(L, -8, CLEARING.z + 4, true);
  campfire(L, 8, CLEARING.z + 4, false);
  bones(L, 4, CLEARING.z - 6);
  bones(L, -5, CLEARING.z + 9);
  // boca de la cueva al fondo
  const cave = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.voidDark);
  cave.position.set(0, 0, CLEARING.z + CR + 2.5);
  cave.scale.set(1, 1.1, 0.4);
  L.group.add(cave);

  // vegetación
  for (let i = 0; i < 60; i++) {
    const z = -6 + L.r() * 140;
    const x = (L.r() - 0.5) * (z < 50 ? 22 : z < 104 ? 14 : 30);
    if (Math.abs(x) < 2.5 || (z > 104 && Math.hypot(x, z - CLEARING.z) > CR - 1)) continue;
    fern(L, x, z, 0.7 + L.r() * 0.6);
  }
  for (let i = 0; i < 26; i++) {
    const side = L.r() < 0.5 ? -1 : 1;
    araucaria(L, side * (17 + L.r() * 30), -10 + L.r() * 160);
    if (i % 2) cycad(L, side * (15 + L.r() * 8), -6 + L.r() * 150);
  }
  volcano(L, -110, 300, false);
  mountains(L, true);
}

export function buildTarPits(L: Level) {
  const m = L.m;
  L.crowdCenter = null;
  L.ground(m.ash());
  L.floor(m.rock(), -3.5, 3.5, -8, 112, 0.004);
  layout(L, 'dark');

  const tarPit = (x: number, z: number, r: number) => {
    const t = new THREE.Mesh(new THREE.CircleGeometry(r, 28), m.tar);
    t.rotation.x = -Math.PI / 2;
    t.position.set(x, 0.015, z);
    t.receiveShadow = true;
    L.group.add(t);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 5, 28), m.darkStone());
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, 0.03, z);
    L.group.add(rim);
    L.hazards.push({ x, z, r: r - 0.2 });
    L.smoke.push(new THREE.Vector3(x, 0.3, z));
  };
  tarPit(-5, 14, 2.4);
  tarPit(5.5, 30, 2.8);
  tarPit(-4, 66, 2.2);
  tarPit(3.5, 84, 2.5);
  tarPit(9, CLEARING.z + 3, 2.2);
  tarPit(-8, CLEARING.z - 4, 1.8);
  // un mamut atrapado en la brea
  mammothSkeleton(L, 5.5, 30, -0.6, 0.9);
  deadTree(L, -9, 6); deadTree(L, 9, 22); deadTree(L, -10, 40); deadTree(L, 7, 60); deadTree(L, -7, 96);
  bones(L, 0, 22); bones(L, -2, 74); bones(L, 4, CLEARING.z + 10);
  campfire(L, -8, 34, true);
  L.spring(-6, 44);
  L.spring(5.5, 94);

  // ríos de lava fuera del camino
  for (const s of [-1, 1]) {
    const lv = new THREE.Mesh(new THREE.PlaneGeometry(10, 120), m.lava);
    lv.rotation.x = -Math.PI / 2;
    lv.position.set(s * 22, 0.02, 40);
    L.group.add(lv);
  }
  // cráter: anillo de lava tras las rocas y luces anaranjadas
  const ring = new THREE.Mesh(new THREE.RingGeometry(CR + 3.5, CR + 9, 48), m.lava);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(CLEARING.x, 0.03, CLEARING.z);
  L.group.add(ring);
  L.floor(m.ash(), -CR, CR, CLEARING.z - CR, CLEARING.z + CR, 0.003);
  for (const [x, z] of [[-12, CLEARING.z + 8], [12, CLEARING.z - 6]]) {
    const pl = new THREE.PointLight(0xff5a1a, 45, 22, 1.7);
    pl.position.set(x, 2.5, z);
    L.group.add(pl);
  }
  for (let i = 0; i < 6; i++) {
    const th = (i / 6) * Math.PI * 2 + 0.5;
    L.smoke.push(new THREE.Vector3(CLEARING.x + Math.sin(th) * (CR + 5), 0.5, CLEARING.z + Math.cos(th) * (CR + 5)));
  }
  campfire(L, 0, CLEARING.z + 10, true);
  // pulso de la lava
  L.animated.push((t) => { m.lava.emissiveIntensity = 2 + Math.sin(t * 1.3) * 0.5; });

  volcano(L, -40, 230, true);
  mountains(L, false);
}
