import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Partículas (chispas, polvo, energía)
// ---------------------------------------------------------------------------

const PVERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
uniform float uScale;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, a);
}`;

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; r: number; g: number; b: number; grav: number; drag: number }

export class Particles {
  points: THREE.Points;
  private list: P[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private geo: THREE.BufferGeometry;
  constructor(private max = 3000, additive = true) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: PVERT,
      fragmentShader: PFRAG,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    if (!additive) {
      mat.fragmentShader = PFRAG.replace('gl_FragColor = vec4(vColor * a, a);', 'gl_FragColor = vec4(vColor, a);');
    }
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setScale(h: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h * 0.5;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: THREE.Color, grav = 0, drag = 1) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x, y, z, vx, vy, vz, life, max: life, size, r: color.r, g: color.g, b: color.b, grav, drag });
  }

  burst(at: THREE.Vector3, n: number, color: THREE.Color, speed: number, life: number, size: number, grav = -9, up = 0.5, spread = 1) {
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.emit(
        at.x, at.y, at.z,
        Math.sin(ph) * Math.cos(th) * sp * spread,
        Math.abs(Math.cos(ph)) * sp * up + sp * 0.3 * up,
        Math.sin(ph) * Math.sin(th) * sp * spread,
        life * (0.5 + Math.random() * 0.5), size * (0.5 + Math.random() * 0.8), color, grav, 2,
      );
    }
  }

  update(dt: number) {
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.grav * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.grav < 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      L[w++] = p;
    }
    L.length = w;
    for (let i = 0; i < w; i++) {
      const p = L[i];
      const k = p.life / p.max;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r; this.col[i * 3 + 1] = p.g; this.col[i * 3 + 2] = p.b;
      this.size[i] = p.size * (0.4 + 0.6 * k);
      this.alpha[i] = Math.min(1, k * 2.5);
    }
    this.geo.setDrawRange(0, w);
    for (const n of ['position', 'aColor', 'aSize', 'aAlpha']) (this.geo.getAttribute(n) as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Estela del arma
// ---------------------------------------------------------------------------

export class Trail {
  mesh: THREE.Mesh;
  private n: number;
  private hist: THREE.Vector3[] = [];
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private al: Float32Array;
  active = false;
  private fade = 0;
  constructor(color: THREE.Color, n = 14) {
    this.n = n;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.al = new Float32Array(n * 2);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color } },
      vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA=aAlpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor=vec4(uColor*vA*1.6, vA);} `,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
  }

  update(base: THREE.Vector3, tip: THREE.Vector3, dt: number) {
    if (this.active) {
      this.fade = 1;
      this.hist.unshift(base.clone(), tip.clone());
      if (this.hist.length > this.n * 2) this.hist.length = this.n * 2;
    } else {
      this.fade = Math.max(0, this.fade - dt * 6);
      if (this.hist.length > 2) this.hist.splice(this.hist.length - 2, 2);
      if (this.fade <= 0) this.hist.length = 0;
    }
    const pairs = this.hist.length / 2;
    for (let i = 0; i < this.n; i++) {
      const j = Math.min(i, pairs - 1);
      const b = this.hist[j * 2], t = this.hist[j * 2 + 1];
      if (!b) { this.al[i * 2] = this.al[i * 2 + 1] = 0; continue; }
      this.pos.set([b.x, b.y, b.z], i * 6);
      this.pos.set([t.x, t.y, t.z], i * 6 + 3);
      const k = (1 - i / (this.n - 1)) * this.fade * (i < pairs ? 1 : 0);
      this.al[i * 2] = k * 0.1;
      this.al[i * 2 + 1] = k * 0.85;
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Material de energía temporal (brecha, puertas, portal)
// ---------------------------------------------------------------------------

const NOISE = /* glsl */ `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
`;

export function energyMaterial(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, mode: 0 | 1 | 2 = 0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) },
      uOpacity: { value: 1 }, uMode: { value: mode },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uOpacity; uniform int uMode;
      varying vec2 vUv;
      void main(){
        vec2 uv = vUv;
        float alpha; vec3 col;
        if (uMode == 2) {
          // portal: remolino polar
          vec2 c = uv - 0.5; float r = length(c) * 2.0; float ang = atan(c.y, c.x);
          float sw = fbm(vec2(ang * 2.0 + r * 4.0 - uTime * 2.0, r * 3.0 - uTime));
          float ring = smoothstep(1.0, 0.85, r) * smoothstep(0.0, 0.4, r);
          col = mix(uA, uB, sw) * (0.6 + 1.6 * sw) + vec3(1.0) * smoothstep(0.3, 0.0, r) * 0.8;
          alpha = (ring * (0.4 + sw) + smoothstep(0.35, 0.0, r)) * smoothstep(1.0, 0.92, r);
        } else if (uMode == 1) {
          // barrera: rejilla hexagonal-ish
          vec2 g = uv * vec2(14.0, 8.0);
          g.x += mod(floor(g.y), 2.0) * 0.5;
          vec2 f = abs(fract(g) - 0.5);
          float line = smoothstep(0.42, 0.5, max(f.x, f.y));
          float n = fbm(uv * 5.0 + vec2(0.0, -uTime * 0.7));
          float scan = smoothstep(0.02, 0.0, abs(fract(uv.y - uTime * 0.25) - 0.5) - 0.01);
          col = mix(uA, uB, n) * (0.5 + line * 2.2 + scan * 1.5);
          alpha = (0.18 + line * 0.6 + n * 0.3 + scan * 0.4) * smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.9, uv.y);
        } else {
          // muro de la brecha: distorsión turbulenta
          float n = fbm(vec2(uv.x * 6.0, uv.y * 3.0 - uTime * 0.6) + fbm(uv * 4.0 + uTime * 0.2));
          float bands = sin(uv.y * 30.0 + n * 9.0 - uTime * 4.0) * 0.5 + 0.5;
          col = mix(uA, uB, n) * (0.5 + bands * 1.1);
          alpha = (0.3 + 0.6 * n) * smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.55, uv.y);
        }
        gl_FragColor = vec4(col, alpha * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------------------
// Ondas de choque en el suelo
// ---------------------------------------------------------------------------

export class Rings {
  group = new THREE.Group();
  private items: { m: THREE.Mesh; t: number; max: number; r: number }[] = [];
  private geo = new THREE.RingGeometry(0.85, 1, 48);
  spawn(at: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, dur = 0.5) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at);
    m.position.y = 0.06;
    this.group.add(m);
    this.items.push({ m, t: 0, max: dur, r: radius });
  }
  update(dt: number) {
    this.items = this.items.filter((it) => {
      it.t += dt;
      const k = it.t / it.max;
      if (k >= 1) {
        this.group.remove(it.m);
        (it.m.material as THREE.Material).dispose();
        return false;
      }
      it.m.scale.setScalar(0.2 + it.r * (1 - (1 - k) * (1 - k)));
      (it.m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
      return true;
    });
  }
}
