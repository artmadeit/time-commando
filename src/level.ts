import * as THREE from 'three';
import type { Mats } from './materials';
import { energyMaterial } from './fx';
import { rng } from './textures';
import { Rig, basePose, type RigLook } from './rig';

// ---------------------------------------------------------------------------
// ERA I · ROMA — un nivel lineal en tres zonas a lo largo de +Z:
//   0) Afueras en ruinas (z -6..44)   1) Calle del mercado (z 44..112)
//   2) Túnel + Arena (centro z = 150)
// ---------------------------------------------------------------------------

export interface OBB { x: number; z: number; hx: number; hz: number; c: number; s: number; on: boolean }

export interface Gate {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  cols: OBB[];
  state: 'closed' | 'open';
  fade: number;
}

const TILE = 4;

function boxUV(geo: THREE.BufferGeometry, w: number, h: number, d: number) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / TILE, (uv.getY(k) * dims[f][1]) / TILE);
    }
  }
}
function scaleUV(geo: THREE.BufferGeometry, sx: number, sy: number) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
}

export function resolveCircle(pos: THREE.Vector3, r: number, cols: OBB[]) {
  for (const o of cols) {
    if (!o.on) continue;
    const dx = pos.x - o.x, dz = pos.z - o.z;
    if (Math.abs(dx) > o.hx + o.hz + r + 1 && Math.abs(dz) > o.hx + o.hz + r + 1) continue;
    let lx = dx * o.c - dz * o.s;
    let lz = dx * o.s + dz * o.c;
    const px = Math.max(-o.hx, Math.min(o.hx, lx));
    const pz = Math.max(-o.hz, Math.min(o.hz, lz));
    const ex = lx - px, ez = lz - pz;
    const d2 = ex * ex + ez * ez;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      lx += ex * push;
      lz += ez * push;
    } else {
      // dentro: sacar por el eje de menor penetración
      const penX = o.hx - Math.abs(lx), penZ = o.hz - Math.abs(lz);
      if (penX < penZ) lx = Math.sign(lx || 1) * (o.hx + r);
      else lz = Math.sign(lz || 1) * (o.hz + r);
    }
    pos.x = o.x + lx * o.c + lz * o.s;
    pos.z = o.z - lx * o.s + lz * o.c;
  }
}

export class Level {
  group = new THREE.Group();
  cols: OBB[] = [];
  gates: Gate[] = [];
  flames: THREE.Vector3[] = [];
  weaponSpots: { type: 'gladius' | 'spear'; pos: THREE.Vector3 }[] = [];
  springs: { pos: THREE.Vector3; mats: THREE.ShaderMaterial[]; glow: number }[] = [];
  crowd: THREE.InstancedMesh | null = null;
  private crowdBase: { x: number; y: number; z: number; ph: number; s: number }[] = [];
  private flameMeshes: THREE.Mesh[] = [];
  private banners: THREE.Mesh[] = [];
  arenaCenter = new THREE.Vector3(0, 0, 150);
  arenaR = 24;
  tunnelRoof: THREE.Mesh | null = null;
  private r = rng(1234);

  constructor(private m: Mats, statueLook: RigLook) {
    this.ground();
    this.outskirts(statueLook);
    this.street();
    this.arena();
    this.backdrop();
  }

  // ---------------- helpers
  col(x: number, z: number, hx: number, hz: number, rot = 0): OBB {
    const o = { x, z, hx, hz, c: Math.cos(rot), s: Math.sin(rot), on: true };
    this.cols.push(o);
    return o;
  }
  box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rotY = 0, collide = false, shadow = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    boxUV(geo, w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (collide) this.col(x, z, w / 2, d / 2, rotY);
    return mesh;
  }
  cyl(rt: number, rb: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 18, open = false) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
    scaleUV(geo, (Math.PI * 2 * Math.max(rt, rb)) / TILE, h / TILE);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  column(x: number, z: number, h: number, mat: THREE.Material, broken = false, r = 0.42, collide = true) {
    this.box(r * 2.7, 0.35, r * 2.7, mat, x, 0.175, z);
    this.cyl(r * 1.2, r * 1.3, 0.2, mat, x, 0.45, z, 20);
    const shaftH = broken ? h * (0.3 + this.r() * 0.4) : h;
    const shaft = this.cyl(r * 0.9, r, shaftH, mat, x, 0.55 + shaftH / 2, z, 20);
    if (broken) shaft.rotation.z = (this.r() - 0.5) * 0.06;
    if (!broken) {
      this.cyl(r * 1.25, r * 0.9, 0.3, mat, x, 0.55 + h + 0.15, z, 20);
      this.box(r * 2.8, 0.25, r * 2.8, mat, x, 0.55 + h + 0.42, z);
    }
    if (collide) this.col(x, z, r * 1.35, r * 1.35);
  }
  rock(x: number, z: number, s: number) {
    const geo = new THREE.IcosahedronGeometry(s, 2);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const seed = this.r() * 100;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      // desplazamiento determinista por posición: sin grietas entre caras
      const n = Math.sin(vx * 2.1 + seed) * Math.cos(vz * 1.7 + seed) * 0.18 + Math.sin(vy * 3.3 + vx + seed) * 0.08;
      const k = 1 + n;
      p.setXYZ(i, vx * k * 1.2, vy * k * 0.65, vz * k);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.m.rock());
    mesh.position.set(x, s * 0.15, z);
    mesh.rotation.y = this.r() * 6;
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  cypress(x: number, z: number, h = 7) {
    this.cyl(0.12, 0.16, 1.2, this.m.wood(), x, 0.6, z, 6);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.9 + this.r() * 0.3, h, 8, 3), this.m.leaves);
    const p = c.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const bulge = 1 + Math.sin(((y / h) + 0.5) * Math.PI) * 0.35;
      p.setXYZ(i, p.getX(i) * bulge * (0.9 + this.r() * 0.2), y, p.getZ(i) * bulge * (0.9 + this.r() * 0.2));
    }
    c.geometry.computeVertexNormals();
    c.position.set(x, 1 + h / 2, z);
    c.castShadow = true;
    this.group.add(c);
  }
  pine(x: number, z: number) {
    const h = 5 + this.r() * 2;
    const t = this.cyl(0.14, 0.22, h, this.m.wood(), x, h / 2, z, 7);
    t.rotation.z = (this.r() - 0.5) * 0.2;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), this.m.leaves);
    crown.scale.set(1.3, 0.5, 1.3);
    crown.position.set(x, h + 0.4, z);
    crown.castShadow = true;
    this.group.add(crown);
  }
  /** Muro con arco (extruido en Z, centrado en x) */
  archWall(width: number, height: number, depth: number, openW: number, openH: number, mat: THREE.Material, x: number, z: number) {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(width / 2, height);
    s.lineTo(-width / 2, height);
    s.lineTo(-width / 2, 0);
    const hole = new THREE.Path();
    const rr = openW / 2;
    hole.moveTo(-rr, 0);
    hole.lineTo(-rr, openH - rr);
    hole.absarc(0, openH - rr, rr, Math.PI, 0, true);
    hole.lineTo(rr, 0);
    hole.lineTo(-rr, 0);
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
    geo.translate(0, 0, -depth / 2);
    scaleUV(geo, 1 / TILE, 1 / TILE);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    const side = (width - openW) / 4;
    this.col(x - openW / 2 - side, z, side, depth / 2);
    this.col(x + openW / 2 + side, z, side, depth / 2);
    return mesh;
  }
  gate(x: number, z: number, w: number, h: number, closed = true): Gate {
    const mat = energyMaterial(0x2bd8ff, 0xffb347, 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, h / 2, z);
    mesh.renderOrder = 5;
    this.group.add(mesh);
    const col = this.col(x, z, w / 2, 0.4);
    const g: Gate = { mesh, mat, cols: [col], state: closed ? 'closed' : 'open', fade: closed ? 1 : 0 };
    if (!closed) { col.on = false; mesh.visible = false; }
    this.gates.push(g);
    return g;
  }
  torch(x: number, y: number, z: number, light: boolean, big = false) {
    if (big) {
      // brasero
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = this.cyl(0.03, 0.03, 1.2, this.m.darkIron, x + Math.cos(a) * 0.25, 0.6, z + Math.sin(a) * 0.25, 6);
        leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      }
      this.cyl(0.55, 0.3, 0.35, this.m.bronze, x, 1.25, z, 16);
      this.col(x, z, 0.45, 0.45);
    } else {
      this.box(0.08, 0.5, 0.08, this.m.darkIron, x, y - 0.25, z, 0, false, false);
      this.cyl(0.12, 0.06, 0.18, this.m.darkIron, x, y, z, 8);
    }
    const fy = big ? 1.55 : y + 0.2;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.4 : 0.12, big ? 0.9 : 0.35, 8), this.m.flame);
    fl.position.set(x, fy + (big ? 0.3 : 0.1), z);
    this.group.add(fl);
    this.flameMeshes.push(fl);
    this.flames.push(new THREE.Vector3(x, fy, z));
    if (light) {
      const pl = new THREE.PointLight(0xff8a3a, big ? 40 : 14, big ? 18 : 10, 1.8);
      pl.position.set(x, fy + 0.6, z);
      this.group.add(pl);
    }
  }
  /** Manantial temporal: aquí se canjean los chips por flujo de tiempo */
  spring(x: number, z: number) {
    const m = this.m;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 8, 32), m.marble());
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, 0.14, z);
    rim.castShadow = rim.receiveShadow = true;
    this.group.add(rim);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      this.box(0.25, 0.9, 0.25, m.marble(), x + Math.cos(a) * 1.25, 0.45, z + Math.sin(a) * 1.25, a);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0x061a1e, emissive: 0x46f2ff, emissiveIntensity: 3 }));
      gem.position.set(x + Math.cos(a) * 1.25, 1.02, z + Math.sin(a) * 1.25);
      this.group.add(gem);
    }
    const discMat = energyMaterial(0x46f2ff, 0x2c7bff, 2);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.12, z);
    this.group.add(disc);
    const colMat = energyMaterial(0x2c7bff, 0x46f2ff, 0);
    colMat.uniforms.uOpacity.value = 0.45;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 5, 24, 1, true), colMat);
    col.position.set(x, 2.5, z);
    this.group.add(col);
    this.springs.push({ pos: new THREE.Vector3(x, 0, z), mats: [discMat, colMat], glow: 0 });
  }

  amphora(x: number, z: number, s = 1, tilt = 0) {
    const pts: THREE.Vector2[] = [];
    const prof = [[0, 0], [0.06, 0.02], [0.1, 0.15], [0.17, 0.4], [0.19, 0.55], [0.16, 0.7], [0.07, 0.82], [0.055, 0.98], [0.075, 1.0]];
    for (const [a, b] of prof) pts.push(new THREE.Vector2(a * s, b * s));
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), this.m.terra());
    mesh.position.set(x, 0, z);
    mesh.rotation.z = tilt;
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  // ---------------- construcción
  private ground() {
    const g = new THREE.PlaneGeometry(800, 800);
    scaleUV(g, 800 / 6, 800 / 6);
    const mesh = new THREE.Mesh(g, this.m.dirt());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.02, 100);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private floor(mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, y = 0) {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d);
    scaleUV(g, w / TILE, d / TILE);
    const mesh = new THREE.Mesh(g, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private outskirts(statueLook: RigLook) {
    const m = this.m;
    this.floor(m.sand(), -11, 11, -8, 44, 0.0);
    // límites laterales: acantilados y ruinas
    this.col(-11.5, 18, 1, 30);
    this.col(11.5, 18, 1, 30);
    this.col(0, -8.5, 12, 1);
    for (let z = -8; z < 44; z += 4.5) {
      for (const side of [-1, 1]) {
        const s = 1.6 + this.r() * 1.6;
        this.rock(side * (11.8 + this.r() * 1.5), z + this.r() * 2, s);
      }
    }
    for (let x = -10; x <= 10; x += 4) this.rock(x + this.r(), -9, 2 + this.r());

    // templo en ruinas a la izquierda
    this.box(5, 0.4, 30, m.sandstone(), -7.5, 0.2, 22, 0, false);
    this.col(-7.5, 22, 2.5, 15);
    const heights = [7, 7, 3, 7, 2, 7];
    heights.forEach((h, i) => this.column(-6.5, 9 + i * 5.4, 6.2, m.marble(), h < 5, 0.42, false));
    this.box(1.2, 0.8, 9, m.marble(), -6.5, 7.6, 11.7);
    // columna caída
    const fallen = this.cyl(0.4, 0.42, 6, m.marble(), 4.5, 0.42, 27, 20);
    fallen.rotation.set(0, 0.5, Math.PI / 2);
    this.col(4.5, 27, 3, 0.45, 0.5 + Math.PI / 2);
    this.box(1.2, 0.35, 1.2, m.marble(), 6.5, 0.17, 30.5, 0.3);
    // muretes rotos
    this.box(4, 1.1, 0.7, m.sandstone(), 7.5, 0.55, 8, 0.1, true);
    this.box(2.5, 0.6, 0.7, m.sandstone(), 8.5, 0.3, 36, -0.2, true);
    this.box(3, 1.4, 0.7, m.sandstone(), -2, 0.7, 39, 0, true);

    // pedestal vacío y primer manantial temporal
    this.box(1.2, 1, 1.2, m.marble(), 3, 0.5, 14, 0.2, true);
    this.spring(4.5, 38);

    // estatua derribada del fundador
    const statue = new Rig('statue', statueLook, 1.6);
    const sp = basePose();
    sp.rShP = 2.8; sp.rEl = 0.2; sp.lShP = 0.4; sp.lEl = 0.6; sp.lLegP = 0.25; sp.rLegP = -0.15; sp.headX = -0.15;
    Object.assign(statue.pose, sp);
    statue.apply();
    statue.root.position.set(-7.5, 0.4, 33);
    statue.root.rotation.y = Math.PI / 2 + 0.3;
    this.group.add(statue.root);
    this.box(2, 0.6, 2, m.marble(), -7.5, 0.1, 33, 0.3);

    // árboles fuera del límite
    for (let z = -6; z < 44; z += 6) {
      this.cypress(-15 - this.r() * 4, z + this.r() * 3, 6 + this.r() * 3);
      this.cypress(15 + this.r() * 4, z + this.r() * 3, 6 + this.r() * 3);
    }
    this.pine(18, 10);
    this.pine(-19, 30);

    // muralla de la ciudad con puerta
    this.archWall(46, 9, 3, 8, 6.5, m.sandstone(), 0, 44);
    for (const s of [-1, 1]) {
      this.box(5, 13, 5, m.sandstone(), s * 7, 6.5, 44, 0, true);
      for (let i = 0; i < 3; i++) this.box(1, 1, 5.2, m.sandstone(), s * 7 - 2 + i * 2, 13.5, 44);
      this.box(0.5, 1.6, 0.2, m.voidDark, s * 7, 9, 41.45);
    }
    for (let x = -22; x <= 22; x += 2) if (Math.abs(x) > 10) this.box(1, 1, 3.1, m.sandstone(), x, 9.5, 44);
    // estandartes
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4, 1, 6), m.cloth(0, 70, 34));
      b.position.set(s * 3.2, 6, 42.4);
      this.group.add(b);
      this.banners.push(b);
    }
    this.gate(0, 44, 8, 6.5);
    this.torch(-5, 4, 42.3, false);
    this.torch(5, 4, 42.3, false);
  }

  private house(side: 1 | -1, z0: number, len: number, h: number) {
    const m = this.m;
    const mats = [m.ochre(), m.cream(), m.terra()];
    const mat = mats[Math.floor(this.r() * 3)];
    const depth = 7;
    const xc = side * (7 + depth / 2);
    const zc = z0 + len / 2;
    this.box(depth, h, len, mat, xc, h / 2, zc, 0, true);
    // tejado con alero
    const roof = this.box(depth + 1.2, 0.35, len + 0.2, m.roof(), xc - side * 0.5, h + 0.15, zc);
    roof.rotation.z = side * 0.12;
    this.box(0.3, 0.3, len, m.wood(), side * 6.6, h - 0.2, zc, 0, false, false);
    // fachada: tiendas (tabernae) en planta baja
    const fx = side * 6.98;
    const shops = Math.max(1, Math.floor(len / 3.6));
    for (let i = 0; i < shops; i++) {
      const z = z0 + (i + 0.5) * (len / shops);
      if (this.r() < 0.7) {
        this.box(0.1, 2.4, 2.2, m.voidDark, fx, 1.2, z, 0, false, false);
        this.box(0.25, 0.25, 2.6, m.wood(), fx - side * 0.05, 2.5, z, 0, false, false);
      } else {
        this.box(0.12, 2.2, 1.2, m.wood(), fx, 1.1, z, 0, false, false);
      }
      // ventanas en pisos superiores
      for (let y = 4; y < h - 1; y += 2.8) {
        if (this.r() < 0.8) {
          this.box(0.1, 1.1, 0.8, m.voidDark, fx, y, z, 0, false, false);
          this.box(0.18, 0.12, 1.0, m.sandstone(), fx - side * 0.04, y - 0.6, z, 0, false, false);
        }
      }
    }
    // balcón
    if (h > 6.5 && this.r() < 0.6) {
      const bz = z0 + len / 2;
      this.box(1.1, 0.15, len * 0.6, m.wood(), side * 6.4, 3.4, bz);
      this.box(0.06, 0.8, len * 0.6, m.wood(), side * 5.88, 3.85, bz, 0, false, false);
      for (let k = -1; k <= 1; k++) this.box(0.1, 3.4, 0.1, m.wood(), side * 5.95, 1.7, bz + k * len * 0.28, 0, false, false);
      this.col(side * 5.95, bz, 0.12, len * 0.3);
      if (this.r() < 0.7) {
        const hue = [0, 210, 45, 120][Math.floor(this.r() * 4)];
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2, 1, 5), m.cloth(hue, 60, 38));
        b.position.set(side * 5.84, 2.3, bz + 0.3);
        b.rotation.y = side * Math.PI / 2;
        this.group.add(b);
        this.banners.push(b);
      }
    } else if (this.r() < 0.7) {
      // toldo
      const hue = [0, 30, 200, 45][Math.floor(this.r() * 4)];
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(1.8, len * 0.7), m.cloth(hue, 55, 45, true));
      aw.rotation.set(-Math.PI / 2, side * 0.45, 0);
      aw.rotation.order = 'YXZ';
      aw.rotation.set(-Math.PI / 2 + 0.0, 0, 0);
      aw.position.set(side * 6.2, 2.9, zc);
      aw.rotateY(-side * 0.42);
      aw.castShadow = true;
      this.group.add(aw);
    }
  }

  private stall(x: number, z: number, side: 1 | -1) {
    const m = this.m;
    this.box(1.2, 0.9, 2.4, m.wood(), x, 0.45, z, 0, true);
    for (const dz of [-1.1, 1.1]) for (const dx of [-0.55, 0.55]) this.box(0.08, 2.2, 0.08, m.wood(), x + dx, 1.1, z + dz, 0, false);
    const hue = [5, 40, 210, 140][Math.floor(this.r() * 4)];
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.8), m.cloth(hue, 60, 45, true));
    roof.rotation.order = 'YXZ';
    roof.rotation.set(-Math.PI / 2, 0, 0);
    roof.rotateY(side * 0.25);
    roof.position.set(x, 2.25, z);
    roof.castShadow = true;
    this.group.add(roof);
    // mercancía
    const fruitCols = [0xc23a1a, 0xe0a020, 0x6a8a2a, 0x7a2a6a];
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: fruitCols[i % 4], roughness: 0.6 }));
      f.position.set(x + (this.r() - 0.5) * 0.8, 0.98, z + (this.r() - 0.5) * 2);
      f.castShadow = true;
      this.group.add(f);
    }
    this.amphora(x - side * 0.2, z + 1.6, 0.9);
    this.amphora(x + side * 0.3, z + 1.8, 0.8, 0.1);
  }

  private street() {
    const m = this.m;
    this.floor(m.cobble(), -7, 7, 44, 112, 0.005);
    // aceras
    for (const s of [-1, 1]) this.box(1.2, 0.18, 66, m.sandstone(), s * 6.4, 0.09, 79, 0, false, false);
    for (const side of [-1, 1] as const) {
      let z = 45.6;
      while (z < 108) {
        const len = Math.min(108 - z, 6.5 + this.r() * 4.5);
        if (len < 3) break;
        this.house(side, z, len, 6 + this.r() * 4.5);
        z += len;
      }
      this.col(side * 10.5, 78, 3.5, 34);
    }
    this.stall(5.2, 56, 1);
    this.stall(-5.2, 66, -1);
    this.stall(5.2, 80, 1);
    this.stall(-5.2, 96, -1);
    // manantiales temporales de la calle
    this.spring(-4.4, 76);
    this.spring(0, 106);
    // cajas y ánforas
    for (const [x, z] of [[-6, 60], [6, 70], [-6.2, 86], [6.1, 92], [6, 104], [-6, 104]]) {
      this.box(0.8, 0.8, 0.8, m.wood(), x, 0.4, z, this.r(), true);
      if (this.r() < 0.6) this.box(0.6, 0.6, 0.6, m.wood(), x + 0.05, 1.1, z + 0.05, this.r(), false);
      this.amphora(x, z + 0.9, 0.85);
    }
    // carro volcado
    this.box(2.6, 0.7, 1.4, m.wood(), 3.5, 0.6, 88, 0.6, true).rotation.z = 0.25;
    const wheel = this.cyl(0.6, 0.6, 0.12, m.wood(), 4.6, 0.6, 87, 14);
    wheel.rotation.set(Math.PI / 2, 0, 0.6);
    // cuerdas con tela cruzando la calle
    for (const z of [62, 84, 100]) {
      const hue = [0, 45, 210][Math.floor(this.r() * 3)];
      const c = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 0.9, 12, 1), m.cloth(hue, 65, 42));
      const p = c.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - Math.cos((p.getX(i) / 13.5) * Math.PI) * 0.6);
      c.position.set(0, 5.6, z);
      this.group.add(c);
    }
    for (const z of [52, 72, 90, 106]) {
      this.torch(-6.8, 3.2, z, false);
      this.torch(6.8, 3.2, z + 6, false);
    }
  }

  private arena() {
    const m = this.m;
    const C = this.arenaCenter;
    const R = this.arenaR;
    const OUT = 38;
    const GAP = 0.14;
    // fachada exterior curva con arcos
    const outer = new THREE.CylinderGeometry(OUT, OUT, 24, 96, 1, true, Math.PI + 0.09, Math.PI * 2 - 0.18);
    scaleUV(outer, (Math.PI * 2 * OUT) / TILE, 24 / TILE);
    const outerMesh = new THREE.Mesh(outer, m.sandstone());
    outerMesh.position.set(C.x, 12, C.z);
    outerMesh.castShadow = outerMesh.receiveShadow = true;
    outerMesh.material.side = THREE.DoubleSide;
    this.group.add(outerMesh);
    for (let tier = 0; tier < 3; tier++) {
      const n = 40;
      for (let i = 0; i < n; i++) {
        const th = Math.PI + (i - n / 2 + 0.5) * 0.06 * (1 + tier * 0);
        if (Math.abs(th - Math.PI) < 0.1) continue;
        const ax = C.x + Math.sin(th) * (OUT + 0.02), az = C.z + Math.cos(th) * (OUT + 0.02);
        const a = this.box(1.4, 3.6, 0.1, m.voidDark, ax, 2.8 + tier * 6.5, az, th, false, false);
        a.rotation.y = th;
        this.box(2.1, 0.4, 0.6, m.sandstone(), ax, 5 + tier * 6.5, az, th, false, false);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(OUT + 0.25, 0.3, 6, 96, Math.PI * 2 - 0.18), m.sandstone());
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = -Math.PI / 2 + 0.09 + Math.PI;
      ring.position.set(C.x, 6 + tier * 6.5, C.z);
      this.group.add(ring);
    }
    // portada de entrada
    this.archWall(12, 12, 3, 6, 6.5, m.sandstone(), 0, C.z - OUT + 0.6);
    this.box(14, 1.2, 3.4, m.marble(), 0, 12.5, C.z - OUT + 0.6, 0, false);
    this.box(6, 0.8, 0.2, m.gold, 0, 9, C.z - OUT - 0.95, 0, false, false);
    // muros de la plaza frente a la arena
    this.box(1, 7, 6, m.sandstone(), -7.5, 3.5, 109, 0, true);
    this.box(1, 7, 6, m.sandstone(), 7.5, 3.5, 109, 0, true);
    this.gate(0, C.z - OUT + 0.6, 6, 6.5);

    // túnel
    const t0 = C.z - OUT + 2, t1 = C.z - R - 0.5;
    const tl = t1 - t0;
    this.floor(m.darkStone(), -3, 3, t0 - 2, t1 + 0.5, 0.006);
    for (const s of [-1, 1]) this.box(1, 6, tl, m.darkStone(), s * 3.5, 3, t0 + tl / 2, 0, true);
    this.tunnelRoof = this.box(8, 1, tl, m.darkStone(), 0, 6.5, t0 + tl / 2, 0, false);
    this.torch(-2.9, 3, t0 + tl * 0.3, true);
    this.torch(2.9, 3, t0 + tl * 0.75, true);
    // trampa: se cierra detrás del jugador
    this.gate(0, t1 - 0.6, 6, 6, false);

    // suelo de arena
    const fl = new THREE.CircleGeometry(R + 0.5, 64);
    scaleUV(fl, (R * 2) / TILE, (R * 2) / TILE);
    const floor = new THREE.Mesh(fl, m.sand());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(C.x, 0.01, C.z);
    floor.receiveShadow = true;
    this.group.add(floor);

    // muro del podio
    const wall = new THREE.CylinderGeometry(R + 0.5, R + 0.5, 3.4, 96, 1, true, Math.PI + GAP, Math.PI * 2 - GAP * 2);
    scaleUV(wall, (Math.PI * 2 * R) / TILE, 3.4 / TILE);
    const wm = new THREE.Mesh(wall, m.darkStone());
    wm.material.side = THREE.DoubleSide;
    wm.position.set(C.x, 1.7, C.z);
    wm.receiveShadow = wm.castShadow = true;
    this.group.add(wm);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(R + 0.55, 0.18, 6, 96, Math.PI * 2 - GAP * 2), m.marble());
    cap.rotation.x = Math.PI / 2;
    cap.rotation.z = Math.PI / 2 + GAP;
    cap.position.set(C.x, 3.45, C.z);
    this.group.add(cap);
    for (const sx of [-1, 1]) this.col(sx * 4.6, C.z - R - 0.6, 1.2, 1.4);
    const SEG = 48;
    for (let i = 0; i < SEG; i++) {
      const th = (i / SEG) * Math.PI * 2;
      if (Math.abs(th - Math.PI) < GAP + 0.03) continue;
      const len = ((Math.PI * 2 * (R + 1)) / SEG) * 0.6;
      this.col(C.x + Math.sin(th) * (R + 1), C.z + Math.cos(th) * (R + 1), len, 0.6, th);
    }
    // gradas (torno escalonado)
    const pts: THREE.Vector2[] = [new THREE.Vector2(R + 0.5, 3.4)];
    let rr = R + 0.5, yy = 3.4;
    while (rr < OUT - 1) {
      rr += 1.1;
      pts.push(new THREE.Vector2(rr, yy));
      yy += 0.9;
      pts.push(new THREE.Vector2(rr, yy));
    }
    pts.push(new THREE.Vector2(OUT, yy), new THREE.Vector2(OUT, yy + 3));
    const st = new THREE.LatheGeometry(pts, 96, Math.PI + GAP, Math.PI * 2 - GAP * 2);
    scaleUV(st, 60, 16);
    const stands = new THREE.Mesh(st, m.sandstone());
    stands.material.side = THREE.DoubleSide;
    stands.position.copy(C);
    stands.receiveShadow = true;
    stands.castShadow = true;
    this.group.add(stands);

    // público
    const n = 1400;
    const geo = new THREE.BoxGeometry(0.42, 0.75, 0.32);
    geo.translate(0, 0.37, 0);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
    const dummy = new THREE.Object3D();
    const cols = [0xd8cfc0, 0x9b2a20, 0x2a4f8b, 0xc79b3b, 0x5e7a3a, 0xe8e2d0, 0x7a4a8a];
    const steps = (pts.length - 2) / 2;
    for (let i = 0; i < n; i++) {
      const sIdx = Math.floor(this.r() * steps);
      const th = Math.PI + GAP + 0.04 + this.r() * (Math.PI * 2 - GAP * 2 - 0.08);
      const rad = R + 0.5 + (sIdx + 0.5) * 1.1;
      const y = 3.4 + sIdx * 0.9;
      const b = { x: C.x + Math.sin(th) * rad, y, z: C.z + Math.cos(th) * rad, ph: this.r() * 10, s: 0.9 + this.r() * 0.25 };
      this.crowdBase.push(b);
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.y = th + Math.PI;
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, new THREE.Color(cols[Math.floor(this.r() * cols.length)]));
    }
    im.castShadow = false;
    im.receiveShadow = true;
    this.group.add(im);
    this.crowd = im;
    // palco y estandartes
    this.box(8, 3, 3, m.marble(), C.x, 5, C.z + R + 3, 0, false);
    this.box(8.6, 0.4, 3.6, m.gold, C.x, 6.7, C.z + R + 3, 0, false);
    const vel = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.5), m.cloth(0, 70, 30));
    vel.position.set(C.x, 9, C.z + R + 1.6);
    vel.rotation.y = Math.PI;
    this.group.add(vel);
    this.banners.push(vel);
    for (let i = 0; i < 16; i++) {
      const th = (i / 16) * Math.PI * 2 + 0.2;
      if (Math.abs(th - Math.PI) < 0.3) continue;
      const x = C.x + Math.sin(th) * (OUT - 0.5), z = C.z + Math.cos(th) * (OUT - 0.5);
      this.cyl(0.12, 0.15, 10, m.wood(), x, yy + 5, z, 6);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4, 1, 6), m.cloth(i % 2 ? 0 : 45, 70, 38));
      b.position.set(x * 0.985 + C.x * 0.015, yy + 7, z * 0.985 + C.z * 0.015);
      b.rotation.y = th;
      this.group.add(b);
      this.banners.push(b);
    }
    // braseros
    for (const th of [Math.PI * 0.5, Math.PI * 1.5]) this.torch(C.x + Math.sin(th) * (R - 2), 0, C.z + Math.cos(th) * (R - 2), true, true);
    for (const th of [0.4, -0.4]) this.torch(C.x + Math.sin(th) * (R - 2), 0, C.z + Math.cos(th) * (R - 2), false, true);
    // columnas decorativas rotas en la arena
    this.column(-9, C.z + 6, 4, m.marble(), true, 0.5);
    this.column(10, C.z - 8, 4, m.marble(), true, 0.5);
  }

  private backdrop() {
    const m = this.m;
    // acueducto lejano
    for (let z = -60; z < 220; z += 7) {
      this.box(2, 16, 2, m.sandstone(), -48, 8, z, 0, false, false);
      this.box(1.6, 8, 1.6, m.sandstone(), -48, 20, z, 0, false, false);
    }
    this.box(2.4, 1.6, 280, m.sandstone(), -48, 16.8, 80, 0, false, false);
    this.box(2.2, 1.4, 280, m.sandstone(), -48, 24.7, 80, 0, false, false);
    // colinas
    for (let i = 0; i < 14; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), m.hills);
      const side = i % 2 ? 1 : -1;
      h.scale.set(40 + this.r() * 50, 12 + this.r() * 20, 40 + this.r() * 40);
      h.position.set(side * (110 + this.r() * 60), -4, -60 + i * 25);
      this.group.add(h);
    }
    for (let i = 0; i < 40; i++) {
      const side = this.r() < 0.5 ? -1 : 1;
      this.cypress(side * (24 + this.r() * 40), -30 + this.r() * 120, 6 + this.r() * 4);
    }
    // tejados de la ciudad tras las casas
    for (let i = 0; i < 30; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (16 + this.r() * 18), z = 46 + this.r() * 60;
      const h = 5 + this.r() * 8;
      this.box(5 + this.r() * 4, h, 5 + this.r() * 4, [m.ochre(), m.cream(), m.terra()][i % 3], x, h / 2, z, this.r() * 0.3, false, false);
    }
  }

  // ---------------- animación
  update(t: number) {
    for (const sp of this.springs) {
      for (const mt of sp.mats) mt.uniforms.uTime.value = t * (1 + sp.glow * 3);
      sp.mats[1].uniforms.uOpacity.value = 0.45 + sp.glow * 0.8;
    }
    for (const g of this.gates) {
      g.mat.uniforms.uTime.value = t;
      if (g.state === 'open' && g.fade > 0) {
        g.fade = Math.max(0, g.fade - 0.02);
        if (g.fade === 0) g.mesh.visible = false;
      } else if (g.state === 'closed' && g.fade < 1) {
        g.mesh.visible = true;
        g.fade = Math.min(1, g.fade + 0.04);
      }
      g.mat.uniforms.uOpacity.value = g.fade;
    }
    this.flameMeshes.forEach((f, i) => {
      const k = 1 + Math.sin(t * 13 + i * 3) * 0.12 + Math.sin(t * 7.3 + i) * 0.1;
      f.scale.set(1, k, 1);
    });
    this.banners.forEach((b, i) => {
      b.rotation.x = Math.sin(t * 1.3 + i) * 0.06;
    });
  }

  updateCrowd(t: number, excite: number) {
    if (!this.crowd) return;
    const d = new THREE.Object3D();
    const C = this.arenaCenter;
    for (let i = 0; i < this.crowdBase.length; i++) {
      const b = this.crowdBase[i];
      const jump = Math.max(0, Math.sin(t * (4 + excite * 6) + b.ph)) * (0.05 + excite * 0.3);
      d.position.set(b.x, b.y + jump, b.z);
      d.rotation.y = Math.atan2(C.x - b.x, C.z - b.z);
      d.scale.setScalar(b.s);
      d.updateMatrix();
      this.crowd.setMatrixAt(i, d.matrix);
    }
    this.crowd.instanceMatrix.needsUpdate = true;
  }

  openGate(i: number) { const g = this.gates[i]; g.state = 'open'; for (const c of g.cols) c.on = false; }
  closeGate(i: number) { const g = this.gates[i]; g.state = 'closed'; g.mesh.visible = true; for (const c of g.cols) c.on = true; }
}
