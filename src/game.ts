import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { makeMaterials, type Mats } from './materials';
import { Level, resolveCircle } from './level';
import { Rig, basePose, copyPose, guardPose, locomotion, hitPose, deathPose, sampleKeys, type RigLook, type RigKind, type WeaponType, type Pose, type Body } from './rig';
import { Quadruped, beastIdle, beastGait, beastHit, beastDeath, type BeastLook } from './beast';
import { KICK, LEGION_ATTACKS, SPEAR_ATTACKS, TRIDENT_ATTACKS, BRUTE_ATTACKS, BOSS_ATTACKS, CAVE_ATTACKS, CAT_ATTACKS, SLOTH_ATTACKS, MEGA_ATTACKS, playerCombo, type AttackDef } from './combat';
import { Particles, Trail, Rings, energyMaterial } from './fx';
import { Input } from './input';
import { Audio } from './audio';
import { LEVELS, type EnemyKind, type LevelDef, type SpawnDef, type SkyDef } from './levels';
import { buildValley, buildTarPits } from './prehistory';

type PlayerWeapon = 'fists' | 'gladius' | 'spear' | 'club' | 'trident' | 'garrote' | 'flintspear';

interface Stat {
  hp: number; speed: number; scale: number; radius: number; weapon: WeaponType; shield: boolean; block: number;
  attacks: AttackDef[]; score: number; rig: RigKind | 'beast'; chips: number;
  boss?: string; armored?: boolean; drop?: PlayerWeapon; chestY?: number; reach?: number;
}

const STATS: Record<EnemyKind, Stat> = {
  // Roma
  legionary: { hp: 55, speed: 2.7, scale: 1.0, radius: 0.45, weapon: 'gladius', shield: true, block: 0.4, attacks: LEGION_ATTACKS, score: 100, rig: 'legionary', chips: 1, drop: 'gladius' },
  spearman: { hp: 50, speed: 2.5, scale: 1.0, radius: 0.45, weapon: 'spear', shield: false, block: 0.15, attacks: SPEAR_ATTACKS, score: 120, rig: 'legionary', chips: 1, drop: 'spear' },
  retiarius: { hp: 70, speed: 3.6, scale: 1.0, radius: 0.45, weapon: 'trident', shield: false, block: 0, attacks: TRIDENT_ATTACKS, score: 180, rig: 'retiarius', chips: 2, drop: 'trident' },
  brute: { hp: 160, speed: 2.1, scale: 1.3, radius: 0.6, weapon: 'club', shield: false, block: 0, attacks: BRUTE_ATTACKS, score: 250, rig: 'brute', chips: 3, armored: true, drop: 'club' },
  centurion: { hp: 560, speed: 3.3, scale: 1.18, radius: 0.55, weapon: 'centurion', shield: true, block: 0.35, attacks: BOSS_ATTACKS, score: 2500, rig: 'centurion', chips: 6, boss: 'VARRO, CENTURIÓN DE LA BRECHA' },
  // Prehistoria
  caveman: { hp: 45, speed: 2.8, scale: 1.0, radius: 0.45, weapon: 'garrote', shield: false, block: 0.1, attacks: CAVE_ATTACKS, score: 90, rig: 'caveman', chips: 1, drop: 'garrote' },
  hunter: { hp: 40, speed: 2.7, scale: 1.0, radius: 0.45, weapon: 'flintspear', shield: false, block: 0.1, attacks: SPEAR_ATTACKS, score: 110, rig: 'caveman', chips: 1, drop: 'flintspear' },
  sabertooth: { hp: 70, speed: 5.2, scale: 1.0, radius: 0.65, weapon: 'fists', shield: false, block: 0, attacks: CAT_ATTACKS, score: 200, rig: 'beast', chips: 2, chestY: 0.8, reach: 4.6 },
  sloth: { hp: 180, speed: 1.9, scale: 1.55, radius: 0.75, weapon: 'claws', shield: false, block: 0, attacks: SLOTH_ATTACKS, score: 300, rig: 'sloth', chips: 3, armored: true },
  alphacat: { hp: 430, speed: 6.0, scale: 1.55, radius: 0.95, weapon: 'fists', shield: false, block: 0, attacks: CAT_ATTACKS, score: 2500, rig: 'beast', chips: 6, chestY: 0.8, reach: 4.8, boss: 'GARRA GRIS, DIENTES DE SABLE ALFA' },
  megatherium: { hp: 680, speed: 2.4, scale: 2.3, radius: 1.05, weapon: 'claws', shield: false, block: 0, attacks: MEGA_ATTACKS, score: 3000, rig: 'sloth', chips: 7, armored: true, boss: 'MEGATERIO, EL COLOSO DE LA BREA' },
};

const WEAPON_NAME: Record<PlayerWeapon, string> = { fists: 'PUÑOS', gladius: 'GLADIUS', spear: 'PILUM', club: 'MAZA', trident: 'TRIDENTE', garrote: 'GARROTE', flintspear: 'LANZA DE SÍLEX' };
const WEAPON_LEN: Record<PlayerWeapon, number> = { fists: 0, gladius: 0.85, spear: 1.7, club: 1.0, trident: 1.65, garrote: 0.95, flintspear: 1.6 };
const WEAPON_HINT: Record<PlayerWeapon, string> = {
  fists: '', gladius: 'GLADIUS · combo de tres tajos', spear: 'PILUM · gran alcance',
  club: 'MAZA · lenta, pero rompe guardias', trident: 'TRIDENTE · estocadas rápidas',
  garrote: 'GARROTE · golpes pesados que rompen guardias', flintspear: 'LANZA DE SÍLEX · gran alcance',
};

interface Zone { trigger: number; wallStop: number; gate: number; trap?: number; waves: SpawnDef[][]; started: boolean; wave: number; done: boolean }

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

function angDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function turn(cur: number, target: number, rate: number, dt: number) {
  const d = angDiff(cur, target);
  const step = rate * dt;
  return cur + Math.max(-step, Math.min(step, d));
}
const fwd = (a: number, out = new THREE.Vector3()) => out.set(Math.sin(a), 0, Math.cos(a));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

class Fighter {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  facing = 0;
  hp = 100;
  maxHp = 100;
  radius = 0.45;
  state = 'move';
  t = 0;
  atk: AttackDef | null = null;
  hitSet = new Set<Fighter>();
  flashT = 0;
  stun = 0;
  target: Pose = basePose();
  trail: Trail;
  chestY = 1.25;
  constructor(public rig: Body, trailColor: THREE.Color) {
    this.trail = new Trail(trailColor);
  }
  chest(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY(this.chestY * this.rig.root.scale.y);
  }
}

class Enemy extends Fighter {
  kind: EnemyKind;
  cool = 1;
  blockDur = 0;
  lastSeenAtk = -1;
  strafe = Math.random() < 0.5 ? 1 : -1;
  ringDist = 3 + Math.random() * 1.5;
  removeT = 0;
  slammed = false;
  enraged = false;
  phase = Math.random() * 10;
  constructor(kind: EnemyKind, rig: Body) {
    super(rig, new THREE.Color(STATS[kind].boss ? 0xff5a2a : 0xffa860));
    this.kind = kind;
    const s = STATS[kind];
    this.hp = this.maxHp = s.hp;
    this.radius = s.radius;
    this.chestY = s.chestY ?? 1.25;
    this.state = 'spawn';
    if (s.rig === 'beast') this.ringDist = 4.5 + Math.random() * 2;
  }
  get st() { return STATS[this.kind]; }
  get beast() { return STATS[this.kind].rig === 'beast'; }
  /** distancia a la que decide atacar */
  atkRange() {
    const st = STATS[this.kind];
    if (st.reach) return st.reach * Math.sqrt(st.scale);
    return Math.min(...st.attacks.map((a) => a.range)) * st.scale;
  }
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  sun: THREE.DirectionalLight;
  sunDir = new THREE.Vector3(-0.45, 0.42, 0.78).normalize();
  m: Mats;
  level!: Level;
  input: Input;
  audio = new Audio();
  sparks = new Particles(2500, true);
  dust = new Particles(1200, false);
  rings = new Rings();

  player!: Fighter;
  playerWeapons: PlayerWeapon[] = ['fists'];
  weaponIdx = 0;
  combo = 0;
  queued = false;
  atkId = 0;
  iframes = 0;
  walkPhase = 0;
  lastStep = 0;
  dodgeDir = new THREE.Vector3();

  enemies: Enemy[] = [];
  pickups: { kind: 'weapon' | 'chip' | 'heal'; weapon?: PlayerWeapon; mesh: THREE.Object3D; pos: THREE.Vector3; t: number; vel?: THREE.Vector3 }[] = [];
  chips = 0;
  private depositT = 0;
  private playerSlammed = false;
  zones: Zone[] = [];
  looks!: Record<'agent' | EnemyKind, RigLook>;
  beastLooks!: Record<'sabertooth' | 'alphacat', BeastLook>;
  weaponMats!: Parameters<Rig['setWeapon']>[1];
  shieldMat!: THREE.MeshStandardMaterial;

  riftWall: THREE.Mesh;
  riftMat: THREE.ShaderMaterial;
  wallZ = -9;
  flux = 100;
  score = 0;
  comboCount = 0;
  comboTimer = 0;
  elapsed = 0;
  state: 'menu' | 'play' | 'pause' | 'over' | 'win' = 'menu';
  hitstop = 0;
  timeScale = 1;
  slowT = 0;
  shake = 0;
  time = 0;
  portal: THREE.Group | null = null;
  portalMat: THREE.ShaderMaterial | null = null;
  bossRef: Enemy | null = null;
  reinforced = false;
  shownTitles = new Set<string>();
  levelIdx = 0;
  def: LevelDef = LEVELS[0];
  levelScore = 0;
  sky = new Sky();
  envSky = new Sky();
  envScene = new THREE.Scene();
  pm!: THREE.PMREMGenerator;
  envRT: THREE.WebGLRenderTarget | null = null;
  hemi = new THREE.HemisphereLight(0xcfdcff, 0x6b4f33, 0.65);
  overT = -1;
  noRender = false;

  camPos = new THREE.Vector3(0, 6, -10);
  camLook = new THREE.Vector3();
  camOff = new THREE.Vector3(4.5, 5, -8.5);
  private hud: Record<string, HTMLElement> = {};
  private msgTimer = 0;
  private titleTimer = 0;
  private isMobile = matchMedia('(pointer: coarse)').matches;
  private low = new URLSearchParams(location.search).get('q') === 'low';

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.low ? 0.6 : Math.min(devicePixelRatio, this.isMobile ? 1.25 : 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 5000);
    this.scene.fog = new THREE.FogExp2(0xd8b48c, 0.0065);

    // Cielo de atardecer + iluminación basada en imagen
    this.sky.scale.setScalar(4000);
    this.sky.material.uniforms.mieDirectionalG.value = 0.86;
    this.scene.add(this.sky);
    this.pm = new THREE.PMREMGenerator(this.renderer);
    this.envSky.scale.setScalar(4000);
    this.envScene.add(this.envSky);
    this.scene.environmentIntensity = 0.55;
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd6a0, 3.4);
    this.sun.castShadow = true;
    const sz = this.isMobile || this.low ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -24;
    sc.right = sc.top = 24;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    // Materiales y nivel
    this.m = makeMaterials();
    this.makeLooks();
    this.scene.add(this.sparks.points, this.dust.points, this.rings.group);

    this.riftMat = energyMaterial(0x7a2cff, 0x22e6ff, 0);
    this.riftWall = new THREE.Mesh(new THREE.PlaneGeometry(90, 18), this.riftMat);
    this.riftWall.position.set(0, 9, this.wallZ);
    this.scene.add(this.riftWall);

    // Postproceso: bloom HDR + tonemapping ACES
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: this.isMobile || this.low ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.input = new Input(canvas);
    for (const id of ['chips', 'hp', 'time', 'score', 'weapon', 'combo', 'zoneTitle', 'msg', 'boss', 'bosshp', 'damage', 'hud', 'touch']) {
      this.hud[id] = document.getElementById(id)!;
    }
    addEventListener('resize', () => this.resize());
    this.resize();
    this.loadLevel(0);
  }

  // ------------------------------------------------------------------ niveles
  loadLevel(i: number) {
    this.levelIdx = i;
    this.def = LEVELS[i];
    if (this.level) {
      this.scene.remove(this.level.group);
      this.level.group.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
    }
    const b = this.def.build;
    this.level = b === 'rome' ? new Level(this.m, this.statueLook()) : new Level(this.m, null, b === 'valley' ? buildValley : buildTarPits);
    this.scene.add(this.level.group);
    this.applySky(this.def.sky);
    this.levelScore = this.score;
    this.reset();
  }

  private applySky(k: SkyDef) {
    this.sunDir.set(...k.sun).normalize();
    for (const sk of [this.sky, this.envSky]) {
      const u = sk.material.uniforms;
      u.turbidity.value = k.turbidity;
      u.rayleigh.value = k.rayleigh;
      u.mieCoefficient.value = k.mie;
      u.mieDirectionalG.value = 0.86;
      u.sunPosition.value.copy(this.sunDir);
    }
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pm.fromScene(this.envScene, 0.02);
    this.scene.environment = this.envRT.texture;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setHex(k.fog);
    fog.density = k.fogDensity;
    this.sun.color.setHex(k.sunColor);
    this.sun.intensity = k.sunIntensity;
    this.hemi.color.setHex(k.hemiSky);
    this.hemi.groundColor.setHex(k.hemiGround);
    this.hemi.intensity = k.hemi;
    this.renderer.toneMappingExposure = k.exposure;
  }

  /** botón de la pantalla final: siguiente nivel, reintentar o volver a empezar */
  continueAfterEnd() {
    if (this.state === 'win') {
      if (this.levelIdx < LEVELS.length - 1) this.loadLevel(this.levelIdx + 1);
      else { this.score = 0; this.loadLevel(0); }
    } else {
      this.score = this.levelScore;
      this.reset();
    }
    this.start();
  }

  private makeLooks() {
    const S = (color: number, rough = 0.7, metal = 0, emissive = 0, ei = 1) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei });
    const red = this.m.cloth(0, 70, 30);
    red.side = THREE.FrontSide;
    const deepRed = this.m.cloth(355, 75, 24);
    deepRed.side = THREE.FrontSide;
    this.looks = {
      agent: { skin: S(0xc58c64), suit: S(0x1b2029, 0.55, 0.3), armor: S(0x3c4757, 0.3, 0.8), accent: S(0x061a1e, 0.4, 0, 0x46f2ff, 4), leather: S(0x262a31, 0.6) },
      legionary: { skin: S(0xb8805e, 0.75), suit: red, armor: S(0xa9adb3, 0.3, 0.95), accent: this.m.bronze, leather: S(0x5a3a22, 0.8) },
      spearman: { skin: S(0xb07c5c, 0.75), suit: this.m.cloth(25, 45, 32), armor: S(0x8f949b, 0.4, 0.9), accent: this.m.bronze, leather: S(0x4a3020, 0.8) },
      retiarius: { skin: S(0xc08a64, 0.65), suit: S(0x1d4f8a, 0.8), armor: S(0xb4b9c0, 0.3, 0.95), accent: this.m.bronze, leather: S(0x24160e, 0.9) },
      brute: { skin: S(0xa66d4e, 0.7), suit: S(0x4a3020, 0.8), armor: S(0x45484e, 0.4, 0.9), accent: this.m.bronze, leather: S(0x3e2716, 0.85) },
      centurion: { skin: S(0xb07a58, 0.75), suit: deepRed, armor: S(0xd8dce2, 0.18, 1), accent: this.m.gold, leather: S(0x3a2414, 0.8) },
      caveman: { skin: S(0xa8724e, 0.75), suit: this.m.fur(30, 35, 34), armor: this.m.bone, accent: this.m.bone, leather: S(0x2a1c12, 0.95) },
      hunter: { skin: S(0x9c6a48, 0.75), suit: this.m.fur(35, 12, 52), armor: this.m.bone, accent: this.m.bone, leather: S(0x3a2a1c, 0.95) },
      sloth: { skin: this.m.fur(28, 30, 30), suit: this.m.fur(28, 30, 30), armor: this.m.bone, accent: S(0x1a1410, 0.4), leather: S(0x14100c, 0.6) },
      megatherium: { skin: this.m.fur(20, 22, 22), suit: this.m.fur(20, 22, 22), armor: this.m.bone, accent: S(0x2a1810, 0.4, 0, 0xff5a1a, 0.6), leather: S(0x0e0a08, 0.6) },
      sabertooth: { skin: S(0), suit: S(0), armor: S(0), accent: S(0), leather: S(0) },
      alphacat: { skin: S(0), suit: S(0), armor: S(0), accent: S(0), leather: S(0) },
    };
    const eye = S(0x1a1000, 0.3, 0, 0xffb020, 2.5);
    this.beastLooks = {
      sabertooth: { fur: this.m.fur(34, 45, 46), belly: this.m.fur(38, 30, 66), fang: S(0xf0e8d6, 0.35), dark: S(0x4a3220, 0.9), eye },
      alphacat: { fur: this.m.fur(30, 8, 58), belly: this.m.fur(30, 6, 76), fang: S(0xf6f0e2, 0.3), dark: S(0x2a2624, 0.9), eye: S(0x1a0000, 0.3, 0, 0xff3a20, 3) },
    };
    this.weaponMats = { metal: this.m.iron, wood: this.m.wood(), leather: S(0x3a2414, 0.8), gold: this.m.gold, glow: S(0x061a1e, 0.4, 0, 0x46f2ff, 5), stone: S(0x4a4640, 0.55, 0.1) };
    this.shieldMat = S(0x8e1a16, 0.55, 0.1);
  }

  private statueLook(): RigLook {
    const mm = this.m.marble();
    return { skin: mm, suit: mm, armor: mm, accent: mm, leather: mm };
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 70 : 55;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    const s = h * this.renderer.getPixelRatio();
    this.sparks.setScale(s);
    this.dust.setScale(s);
  }

  // ------------------------------------------------------------------ estado
  reset() {
    for (const e of this.enemies) { this.scene.remove(e.rig.root, e.trail.mesh); }
    this.enemies = [];
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups = [];
    if (this.player) this.scene.remove(this.player.rig.root, this.player.trail.mesh);
    if (this.portal) { this.scene.remove(this.portal); this.portal = null; }

    const rig = new Rig('agent', this.looks.agent, 1);
    this.player = new Fighter(rig, new THREE.Color(0x46f2ff));
    this.player.pos.set(this.def.spawn[0], 0, this.def.spawn[1]);
    this.player.maxHp = this.player.hp = 100;
    rig.setWeapon('fists', this.weaponMats);
    this.scene.add(rig.root, this.player.trail.mesh);
    this.playerWeapons = ['fists'];
    this.weaponIdx = 0;
    this.combo = 0;
    this.iframes = 0;

    this.chips = 0;

    for (const g of this.def.closed) this.level.closeGate(g);
    for (const g of this.def.open) this.level.openGate(g);
    this.zones = this.def.zones.map((z) => ({ ...z, started: false, wave: 0, done: false }));
    this.wallZ = this.def.wallStart;
    this.riftWall.position.z = this.wallZ;
    this.flux = 100;
    this.comboCount = 0;
    this.elapsed = 0;
    this.bossRef = null;
    this.reinforced = false;
    this.shownTitles.clear();
    this.timeScale = 1;
    this.slowT = 0;
    this.overT = -1;
    this.player.facing = 0;
    this.camOff.set(...this.def.cams[0].off);
    this.camPos.copy(this.player.pos).add(this.camOff).add(new THREE.Vector3(0, 6, -6));
    this.camLook.copy(this.player.pos).setY(1.2);
    this.hud.boss.classList.add('hidden');
    this.msgTimer = 0;
    this.hud.msg.style.opacity = '0';
  }

  start() {
    this.audio.init();
    this.audio.startMusic();
    this.state = 'play';
    this.hud.hud.classList.remove('hidden');
    if (this.input.touchEnabled) this.hud.touch.classList.remove('hidden');
    // llegada por la brecha
    this.sparks.burst(this.player.pos.clone().setY(1.2), 120, new THREE.Color(0x46f2ff), 9, 1.2, 0.6, -2, 0.6);
    this.rings.spawn(this.player.pos, 0x46f2ff, 6, 0.8);
    this.audio.portal();
    this.title(this.def.era, `Nivel ${this.def.num} · ${this.def.name}`);
    const lvl = this.levelIdx;
    setTimeout(() => { if (this.levelIdx === lvl) this.message(this.def.intro, 4.5); }, 2400);
  }

  // ------------------------------------------------------------------ HUD
  message(t: string, dur = 3.2) {
    this.hud.msg.textContent = t;
    this.hud.msg.style.opacity = '1';
    this.msgTimer = dur;
  }
  title(t: string, sub = '') {
    this.hud.zoneTitle.innerHTML = sub ? `${t}<small>${sub}</small>` : t;
    this.hud.zoneTitle.style.opacity = '1';
    this.titleTimer = 2.8;
  }

  private updateHud(dt: number) {
    const p = this.player;
    this.hud.hp.style.width = `${(Math.max(0, p.hp) / p.maxHp) * 100}%`;
    this.hud.time.style.width = `${Math.max(0, this.flux)}%`;
    this.hud.time.parentElement!.classList.toggle('low', this.flux < 25);
    this.hud.score.textContent = this.score.toLocaleString('es');
    this.hud.weapon.textContent = WEAPON_NAME[this.playerWeapons[this.weaponIdx]];
    this.hud.chips.textContent = `◆ ${this.chips} CHIPS`;
    if (this.comboCount >= 2 && this.comboTimer > 0) {
      this.hud.combo.textContent = `${this.comboCount} GOLPES`;
      this.hud.combo.style.opacity = '1';
    } else this.hud.combo.style.opacity = '0';
    if (this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) this.hud.msg.style.opacity = '0';
    if (this.titleTimer > 0 && (this.titleTimer -= dt) <= 0) this.hud.zoneTitle.style.opacity = '0';
    if (this.bossRef && this.bossRef.state !== 'dead') {
      this.hud.boss.classList.remove('hidden');
      this.hud.bosshp.style.width = `${(Math.max(0, this.bossRef.hp) / this.bossRef.maxHp) * 100}%`;
    } else this.hud.boss.classList.add('hidden');
    const dmg = parseFloat(this.hud.damage.style.opacity || '0');
    if (dmg > 0) this.hud.damage.style.opacity = String(Math.max(0, dmg - dt * 2));
  }

  // ------------------------------------------------------------------ entidades
  private chipGeo = new THREE.BoxGeometry(0.28, 0.05, 0.2);
  private chipMat = new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x2a9dff, emissiveIntensity: 2.6, roughness: 0.25, metalness: 0.6 });
  private addPickup(kind: 'weapon' | 'chip' | 'heal', pos: THREE.Vector3, weapon?: PlayerWeapon, vel?: THREE.Vector3) {
    let mesh: THREE.Object3D;
    if (kind === 'weapon') {
      const r = new Rig('agent', this.looks.agent);
      r.setWeapon(weapon!, this.weaponMats);
      const w = r.weapon!;
      r.rHand.remove(w);
      const g = new THREE.Group();
      w.rotation.x = -Math.PI / 2;
      w.position.y = -WEAPON_LEN[weapon!] / 2;
      g.add(w);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0x46f2ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -pos.y + 0.05;
      g.add(halo);
      mesh = g;
    } else if (kind === 'chip') {
      mesh = new THREE.Mesh(this.chipGeo, this.chipMat);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0a1a1a, emissive: 0x7dff6a, emissiveIntensity: 3, roughness: 0.2, metalness: 0.3 });
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat);
    }
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.pickups.push({ kind, weapon, mesh, pos, t: Math.random() * 6, vel });
  }

  private spawnEnemy(s: SpawnDef) {
    const st = STATS[s.k];
    let rig: Body;
    if (st.rig === 'beast') {
      rig = new Quadruped(this.beastLooks[s.k as 'sabertooth' | 'alphacat'], st.scale);
    } else {
      const r = new Rig(st.rig, this.looks[s.k], st.scale);
      r.setWeapon(st.weapon, this.weaponMats);
      if (st.shield) r.addShield(this.shieldMat.clone(), this.m.gold);
      rig = r;
    }
    const e = new Enemy(s.k, rig);
    e.pos.set(s.x, 0, s.z);
    e.facing = Math.atan2(this.player.pos.x - s.x, this.player.pos.z - s.z);
    rig.root.scale.setScalar(0.01);
    this.scene.add(rig.root, e.trail.mesh);
    this.enemies.push(e);
    const at = e.pos.clone().setY(1.2);
    this.sparks.burst(at, 70, new THREE.Color(0x9a4dff), 6, 0.9, 0.5, -1, 1);
    this.sparks.burst(at, 30, new THREE.Color(0x46f2ff), 4, 0.7, 0.4, -1, 1);
    this.rings.spawn(e.pos, 0x9a4dff, 3, 0.6);
    this.audio.spawn();
    if (st.boss) {
      this.bossRef = e;
      (this.hud.boss.querySelector('.name') as HTMLElement).textContent = st.boss;
    }
    return e;
  }

  private currentWeapon(): PlayerWeapon { return this.playerWeapons[this.weaponIdx]; }

  // ------------------------------------------------------------------ bucle
  update(rawDt: number) {
    this.time += rawDt;
    this.input.update();
    if (this.input.pressed('pause')) this.setPause(this.state === 'play');
    if (this.state !== 'play' && this.state !== 'over' && this.state !== 'win') {
      this.render(rawDt, 0);
      return;
    }
    if (this.slowT > 0) { this.slowT -= rawDt; this.timeScale = this.slowT > 0 ? 0.3 : 1; }
    let dt = rawDt * this.timeScale;
    if (this.hitstop > 0) { this.hitstop -= rawDt; dt *= 0.06; }

    if (this.state === 'play') {
      this.elapsed += dt;
      this.updatePlayer(dt);
      this.updateZones();
      this.updateFlux(dt);
    } else {
      this.updatePlayerPose(dt);
      if (this.overT >= 0) {
        this.overT += rawDt;
      }
    }
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => {
      if (e.state === 'dead' && e.removeT > 4.5) { this.scene.remove(e.rig.root, e.trail.mesh); return false; }
      return true;
    });
    this.separate();
    this.updatePickups(dt);
    this.updateAmbient(dt);
    this.render(rawDt, dt);
  }

  setPause(p: boolean) {
    if (p && this.state === 'play') {
      this.state = 'pause';
      document.getElementById('pause')!.classList.remove('hidden');
    } else if (!p && this.state === 'pause') {
      this.state = 'play';
      document.getElementById('pause')!.classList.add('hidden');
    }
  }

  private render(rawDt: number, dt: number) {
    this.level.update(this.time);
    const cc = this.level.crowdCenter;
    const inArena = !!cc && this.player.pos.distanceTo(cc) < 40;
    if (inArena) this.level.updateCrowd(this.time, this.bossRef ? 1 : 0.15);
    this.audio.crowd(inArena && this.state === 'play' ? 1 : 0);
    this.riftMat.uniforms.uTime.value = this.time;
    if (this.portalMat) this.portalMat.uniforms.uTime.value = this.time;
    this.sparks.update(dt);
    this.dust.update(dt);
    this.rings.update(dt);
    this.updateCamera(rawDt);
    this.updateHud(rawDt);
    // sombra siguiendo a la jugadora
    this.sun.target.position.copy(this.player.pos);
    this.sun.position.copy(this.player.pos).addScaledVector(this.sunDir, 70);
    if (!this.noRender) this.composer.render();
  }

  // ------------------------------------------------------------------ cámara
  private updateCamera(dt: number) {
    const z = this.player.pos.z;
    const target = new THREE.Vector3();
    let cam = this.def.cams[0];
    for (const c of this.def.cams) if (z >= c.z) cam = c;
    target.set(...cam.off);
    if (this.level.tunnelRoof) this.level.tunnelRoof.visible = z < 125.5;
    if (this.isMobile || innerWidth < innerHeight) target.multiplyScalar(1.15);
    this.camOff.lerp(target, 1 - Math.exp(-dt * 1.6));
    const look = tmpV.copy(this.player.pos).setY(1.3);
    // en la arena, encuadrar también al jefe
    if (this.bossRef && this.bossRef.state !== 'dead' && this.bossRef.pos.distanceTo(this.player.pos) < 28) {
      look.lerp(tmpV2.copy(this.bossRef.pos).setY(1.3), 0.25);
    }
    const desired = tmpV2.copy(this.player.pos).add(this.camOff);
    this.camPos.lerp(desired, 1 - Math.exp(-dt * 4));
    this.camLook.lerp(look, 1 - Math.exp(-dt * 6));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.lookAt(this.camLook);
  }

  // ------------------------------------------------------------------ jugadora
  private updatePlayer(dt: number) {
    const p = this.player;
    const inp = this.input;
    p.t += dt;
    this.iframes -= dt;
    p.flashT = Math.max(0, p.flashT - dt * 4);
    p.rig.flash(p.flashT, 0xff3030);

    // dirección relativa a cámara
    const cf = tmpV.subVectors(this.camLook, this.camera.position).setY(0).normalize();
    const cr = new THREE.Vector3(-cf.z, 0, cf.x);
    const wish = new THREE.Vector3().addScaledVector(cf, inp.moveY).addScaledVector(cr, inp.moveX);
    const wl = Math.min(1, wish.length());
    if (wl > 0.01) wish.normalize();

    const weapon = this.currentWeapon();
    let moveSpeed = 0;

    if (p.state === 'dead') {
      this.updatePlayerPose(dt);
      return;
    }

    if (inp.pressed('switch') && this.playerWeapons.length > 1 && (p.state === 'move' || p.state === 'block')) {
      this.weaponIdx = (this.weaponIdx + 1) % this.playerWeapons.length;
      (p.rig as Rig).setWeapon(this.currentWeapon(), this.weaponMats);
      this.audio.pickup();
    }

    switch (p.state) {
      case 'move':
      case 'block': {
        const blocking = inp.held('block');
        p.state = blocking ? 'block' : 'move';
        moveSpeed = (blocking ? 1.6 : 5.4) * wl * (this.inTar(p.pos) ? 0.45 : 1);
        if (wl > 0.1 && this.inTar(p.pos)) {
          if (Math.random() < 0.3) this.dust.emit(p.pos.x, 0.1, p.pos.z, 0, 0.4, 0, 0.7, 0.3, new THREE.Color(0x0a0806), 0, 2);
          if (!this.shownTitles.has('tar')) { this.shownTitles.add('tar'); this.message('¡Brea! Te mueves mucho más despacio', 2); }
        }
        if (wl > 0.1) p.facing = turn(p.facing, Math.atan2(wish.x, wish.z), blocking ? 4 : 12, dt);
        else if (blocking) this.faceNearest(p, dt, 6);
        if (inp.pressed('attack')) this.startPlayerAttack(playerCombo(weapon)[0], wish, wl), (this.combo = 0);
        else if (inp.pressed('kick')) this.startPlayerAttack(KICK, wish, wl), (this.combo = -1);
        else if (inp.pressed('dodge')) {
          p.state = 'dodge';
          p.t = 0;
          this.dodgeDir.copy(wl > 0.1 ? wish : fwd(p.facing));
          p.facing = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
          this.iframes = 0.38;
          this.audio.roll();
        }
        break;
      }
      case 'attack': {
        const a = p.atk!;
        if (inp.pressed('attack') && p.t > a.hit[0] * 0.5) this.queued = true;
        if (p.t < a.dur * 0.45) {
          const k = 1 - p.t / (a.dur * 0.45);
          p.vel.addScaledVector(fwd(p.facing), a.lunge * k * dt * 6);
        }
        if (p.t >= a.hit[0] && p.t <= a.hit[1]) this.playerHitCheck(a);
        if (a.slam && !this.playerSlammed && p.t >= a.hit[0]) {
          this.playerSlammed = true;
          const at = p.pos.clone().addScaledVector(fwd(p.facing), 1.5);
          this.rings.spawn(at, 0x46f2ff, 3, 0.5);
          this.dust.burst(at.clone().setY(0.2), 30, new THREE.Color(0x8a7458), 5, 0.9, 0.6, -4, 0.5);
          this.audio.slam();
          this.shake = Math.max(this.shake, 0.4);
        }
        p.trail.active = p.t >= a.hit[0] - 0.04 && p.t <= a.hit[1] + 0.04 && weapon !== 'fists';
        const chain = playerCombo(weapon);
        if (this.queued && p.t >= a.chain && this.combo >= 0 && this.combo < chain.length - 1) {
          this.combo++;
          this.startPlayerAttack(chain[this.combo], wish, wl);
        } else if (inp.pressed('kick') && p.t >= a.chain) {
          this.combo = -1;
          this.startPlayerAttack(KICK, wish, wl);
        } else if (p.t >= a.dur) {
          p.state = 'move';
          p.trail.active = false;
        }
        break;
      }
      case 'dodge': {
        const dur = 0.5;
        const k = clamp01(p.t / dur);
        moveSpeed = 0;
        p.pos.addScaledVector(this.dodgeDir, 10 * (1 - k) * dt);
        if (Math.random() < 0.5) this.dust.emit(p.pos.x, 0.1, p.pos.z, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 0.8, 0.5, new THREE.Color(0x8a7458), 0, 2);
        if (p.t >= dur) p.state = 'move';
        if (p.t > 0.25 && inp.pressed('attack')) { this.startPlayerAttack(playerCombo(weapon)[2], wish, wl); this.combo = 2; }
        break;
      }
      case 'hit':
        if (p.t >= p.stun) p.state = 'move';
        break;
    }

    // integrar movimiento
    if (moveSpeed > 0) {
      p.pos.addScaledVector(wish, moveSpeed * dt);
      this.walkPhase += dt * moveSpeed * 1.9;
      const stepIdx = Math.floor(this.walkPhase / Math.PI);
      if (stepIdx !== this.lastStep) {
        this.lastStep = stepIdx;
        this.audio.step();
        this.dust.emit(p.pos.x, 0.05, p.pos.z, 0, 0.3, 0, 0.6, 0.35, new THREE.Color(0x8a7458), 0, 2);
      }
    }
    p.pos.addScaledVector(p.vel, dt);
    p.vel.multiplyScalar(Math.exp(-dt * 9));
    resolveCircle(p.pos, p.radius, this.level.cols);
    p.pos.y = 0;
    p.rig.root.position.copy(p.pos);
    p.rig.root.rotation.y = p.facing;
    this.updatePlayerPose(dt, moveSpeed);
  }

  private updatePlayerPose(dt: number, moveSpeed = 0) {
    const p = this.player;
    const tp = p.target;
    copyPose(tp, basePose());
    const weapon = this.currentWeapon();
    guardPose(tp, weapon, this.time, p.state === 'block');
    let rate = 16;
    if (p.state === 'move' || p.state === 'block') {
      locomotion(tp, this.walkPhase, clamp01(moveSpeed / 5.4), weapon === 'fists' ? 0.3 : 0.5);
    } else if (p.state === 'attack' && p.atk) {
      sampleKeys(p.atk.keys, clamp01(p.t / p.atk.dur), tp);
      rate = 30;
    } else if (p.state === 'dodge') {
      const k = clamp01(p.t / 0.5);
      tp.roll = Math.PI * 2 * Math.min(1, k * 1.15);
      tp.bodyY = -0.35 * Math.sin(k * Math.PI);
      tp.lLegP = tp.rLegP = 1.4; tp.lKnee = tp.rKnee = 2.0; tp.spineX = 0.9; tp.headX = 0.5;
      tp.lShP = tp.rShP = 1.0; tp.lEl = tp.rEl = 1.8;
      p.rig.pose.roll = tp.roll;
      rate = 30;
    } else if (p.state === 'hit') {
      hitPose(tp, 1 - clamp01(p.t / p.stun));
      rate = 25;
    } else if (p.state === 'dead') {
      deathPose(tp, p.t / 0.8);
      rate = 20;
    }
    this.blendPose(p, rate, dt);
    if (p.state !== 'dodge') p.rig.pose.roll = 0;
    p.rig.apply();
    p.rig.root.updateMatrixWorld(true);
    p.trail.update(p.rig.bladeBase.getWorldPosition(new THREE.Vector3()), p.rig.bladeTip.getWorldPosition(new THREE.Vector3()), dt);
  }

  private blendPose(f: Fighter, rate: number, dt: number) {
    const k = 1 - Math.exp(-rate * dt);
    const cur = f.rig.pose as unknown as Record<string, number>;
    const tg = f.target as unknown as Record<string, number>;
    for (const key in tg) cur[key] += (tg[key] - cur[key]) * k;
  }

  private faceNearest(p: Fighter, dt: number, rate: number, maxD = 4, dirHint?: THREE.Vector3) {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'spawn') continue;
      const d = e.pos.distanceTo(p.pos);
      if (dirHint) {
        const dot = tmpV2.subVectors(e.pos, p.pos).normalize().dot(dirHint);
        if (dot < 0.2) continue;
      }
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const a = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
      p.facing = rate > 50 ? a : turn(p.facing, a, rate, dt);
    }
    return best;
  }

  private startPlayerAttack(a: AttackDef, wish: THREE.Vector3, wl: number) {
    const p = this.player;
    if (wl > 0.1) p.facing = Math.atan2(wish.x, wish.z);
    // asistencia de apuntado: orientar hacia el enemigo más cercano
    this.faceNearest(p, 0, 99, 4.2, wl > 0.1 ? wish : fwd(p.facing));
    p.state = 'attack';
    p.atk = a;
    p.t = 0;
    p.hitSet.clear();
    this.playerSlammed = false;
    this.queued = false;
    this.atkId++;
    this.audio.swing(!!a.heavy);
  }

  private playerHitCheck(a: AttackDef) {
    const p = this.player;
    const f = fwd(p.facing);
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'spawn' || p.hitSet.has(e)) continue;
      const d = tmpV.subVectors(e.pos, p.pos);
      const dist = d.length();
      if (dist > a.range + e.radius) continue;
      d.normalize();
      if (dist > 0.9 && d.dot(f) < a.arc) continue;
      p.hitSet.add(e);
      this.hitEnemy(e, a, d);
    }
  }

  private hitEnemy(e: Enemy, a: AttackDef, dir: THREE.Vector3) {
    const st = STATS[e.kind];
    const facingMe = fwd(e.facing).dot(dir) < -0.3;
    const at = e.chest();
    at.addScaledVector(dir, -0.3);
    if (e.state === 'block' && facingMe) {
      if (a.breaksGuard) {
        e.state = 'stagger'; e.t = 0; e.stun = 1.0;
        this.audio.blockBreak();
        this.sparks.burst(at, 40, new THREE.Color(0xffd27a), 8, 0.5, 0.25);
        this.message('¡Guardia rota!', 1.2);
        e.vel.addScaledVector(dir, a.knock * 0.8);
        this.hitstop = 0.08;
      } else {
        this.audio.clang();
        this.sparks.burst(at, 22, new THREE.Color(0xffd27a), 7, 0.35, 0.22);
        e.vel.addScaledVector(dir, 1.5);
        this.hitstop = 0.035;
        if (Math.random() < 0.35) e.blockDur = 0; // contraataque pronto
      }
      return;
    }
    const mult = this.comboCount >= 5 ? 1.15 : 1;
    e.hp -= a.dmg * mult;
    e.flashT = 1;
    this.comboCount++;
    this.comboTimer = 2.2;
    this.score += Math.round(a.dmg * 2 * (1 + Math.min(this.comboCount, 20) * 0.1));
    this.audio.hit(!!a.heavy);
    this.sparks.burst(at, a.heavy ? 40 : 22, new THREE.Color(0xff9a3a), a.heavy ? 9 : 6, 0.45, 0.22);
    this.sparks.burst(at, 12, new THREE.Color(0x46f2ff), 5, 0.35, 0.3, -2);
    this.hitstop = a.heavy ? 0.09 : 0.045;
    this.shake = Math.max(this.shake, a.heavy ? 0.35 : 0.15);
    const knockMul = st.boss ? 0.3 : st.armored ? 0.45 : e.beast ? 0.7 : 1;
    e.vel.addScaledVector(dir, a.knock * knockMul);
    if (e.hp <= 0) { this.killEnemy(e); return; }
    const armored = e.state === 'attack' && (!!st.boss || (!!st.armored && !a.heavy));
    if (!armored) {
      e.state = 'stagger';
      e.t = 0;
      e.stun = (a.heavy ? 0.7 : 0.4) * (e.kind === 'legionary' ? 1 : 0.6);
      e.rig.telegraph(0);
      e.trail.active = false;
    }
    if (st.boss && e.hp < st.hp * 0.5 && !this.reinforced) {
      this.reinforced = true;
      e.enraged = true;
      if (this.def.reinforce.length) {
        this.message(e.beast ? '¡La manada acude a su llamada!' : e.kind === 'centurion' ? '¡Varro llama a su guardia!' : '¡Llegan refuerzos!', 2.5);
        for (const r of this.def.reinforce) this.spawnEnemy(r);
      }
    }
  }

  private killEnemy(e: Enemy) {
    e.state = 'dead';
    e.t = 0;
    e.removeT = 0;
    e.rig.telegraph(0);
    e.trail.active = false;
    this.score += STATS[e.kind].score;
    this.audio.death();
    // chips de memoria temporal
    const nChips = STATS[e.kind].chips + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < nChips; i++) this.addPickup('chip', e.pos.clone().setY(0.9), undefined, new THREE.Vector3((Math.random() - 0.5) * 4, 4 + Math.random() * 2, (Math.random() - 0.5) * 4));
    // su arma cae al suelo
    const drop = STATS[e.kind].drop;
    if (drop && (!this.playerWeapons.includes(drop) || Math.random() < 0.15)) {
      if (e.rig.weapon) e.rig.weapon.visible = false;
      this.addPickup('weapon', e.pos.clone().addScaledVector(fwd(e.facing), -0.6).setY(1.0), drop);
    }
    if (STATS[e.kind].chips >= 2 || Math.random() < 0.25) this.addPickup('heal', e.pos.clone().add(new THREE.Vector3(0.8, 0.8, 0)));
    if (STATS[e.kind].boss) {
      this.slowT = 1.6;
      this.shake = 0.6;
      this.sparks.burst(e.chest(), 200, new THREE.Color(0x9a4dff), 12, 1.5, 0.6, -3);
      this.message(`¡${STATS[e.kind].boss!.split(',')[0]} ha caído! La brecha se debilita…`, 3.5);
      for (const o of this.enemies) if (o !== e && o.state !== 'dead') this.killEnemy(o);
    }
  }

  hurtPlayer(dmg: number, from: THREE.Vector3, a: AttackDef | null) {
    const p = this.player;
    if (p.state === 'dead' || this.iframes > 0 || this.state !== 'play') return;
    const dir = tmpV.subVectors(p.pos, from).setY(0).normalize();
    const facing = fwd(p.facing).dot(dir) < -0.25;
    if (p.state === 'block' && facing && !(a && a.slam)) {
      this.audio.clang();
      this.sparks.burst(p.chest().addScaledVector(dir, -0.4), 24, new THREE.Color(0x9ff8ff), 7, 0.35, 0.22);
      p.vel.addScaledVector(dir, (a?.knock ?? 3) * 0.5);
      p.hp -= dmg * 0.12;
      this.hitstop = 0.04;
      return;
    }
    p.hp -= dmg;
    p.flashT = 1;
    p.vel.addScaledVector(dir, a?.knock ?? 4);
    this.comboCount = 0;
    this.audio.hurt();
    this.shake = Math.max(this.shake, 0.4);
    this.hud.damage.style.opacity = '1';
    this.sparks.burst(p.chest(), 20, new THREE.Color(0xff4040), 5, 0.4, 0.22);
    if (p.hp <= 0) {
      this.playerDie('Tu integridad física ha fallado.');
      return;
    }
    p.state = 'hit';
    p.t = 0;
    p.stun = a?.heavy ? 0.6 : 0.35;
    p.trail.active = false;
    this.iframes = 0.25;
  }

  private playerDie(reason: string) {
    const p = this.player;
    if (p.state === 'dead') return;
    p.state = 'dead';
    p.t = 0;
    p.hp = Math.min(p.hp, 0);
    this.state = 'over';
    this.overT = 0;
    this.audio.death();
    setTimeout(() => this.showEnd(false, reason), 2200);
  }

  showEnd(win: boolean, text: string) {
    const last = this.levelIdx === LEVELS.length - 1;
    const eraEnd = last || LEVELS[this.levelIdx + 1].era !== this.def.era;
    document.getElementById('overTitle')!.textContent = !win ? 'FLUJO COLAPSADO' : eraEnd ? 'ERA COMPLETADA' : 'NIVEL COMPLETADO';
    const mins = Math.floor(this.elapsed / 60), secs = Math.floor(this.elapsed % 60).toString().padStart(2, '0');
    document.getElementById('overText')!.innerHTML = `${text}<br><br>Puntuación: <b>${this.score.toLocaleString('es')}</b> · Tiempo: <b>${mins}:${secs}</b>`;
    document.getElementById('retry')!.textContent = !win ? 'REINTENTAR NIVEL' : last ? 'JUGAR DE NUEVO' : 'SIGUIENTE NIVEL';
    document.getElementById('over')!.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ enemigos
  private updateEnemy(e: Enemy, dt: number) {
    const st = STATS[e.kind];
    const p = this.player;
    e.t += dt;
    e.cool -= dt;
    e.flashT = Math.max(0, e.flashT - dt * 5);
    e.rig.flash(e.flashT * 0.9, 0xffffff);
    e.pos.addScaledVector(e.vel, dt);
    e.vel.multiplyScalar(Math.exp(-dt * 7));

    const toP = tmpV.subVectors(p.pos, e.pos).setY(0);
    const dist = toP.length();
    const angToP = Math.atan2(toP.x, toP.z);
    const playerAlive = p.state !== 'dead';
    let moveSpeed = 0;
    const speed = st.speed * (e.enraged ? 1.2 : 1) * (this.inTar(e.pos) ? 0.45 : 1);
    const tp = e.target;
    copyPose(tp, basePose());
    if (e.beast) beastIdle(tp, this.time + e.phase, e.state === 'chase');
    else {
      guardPose(tp, st.weapon, this.time + e.phase, false);
      tp.shield = 0.2;
    }
    let rate = 14;

    switch (e.state) {
      case 'spawn': {
        const k = clamp01(e.t / 0.6);
        e.rig.root.scale.setScalar(st.scale * (k * k * (3 - 2 * k)) + 0.001);
        e.facing = turn(e.facing, angToP, 4, dt);
        if (e.t > 0.7) { e.state = 'chase'; e.t = 0; e.cool = 0.6 + Math.random(); }
        break;
      }
      case 'chase': {
        if (!playerAlive) { e.facing = turn(e.facing, angToP, 2, dt); break; }
        e.facing = turn(e.facing, angToP, 6, dt);
        const attackers = this.enemies.filter((o) => o.state === 'attack' && !o.st.boss).length;
        const canAttack = e.cool <= 0 && (!!st.boss || attackers < 2);
        const range = e.atkRange();
        const dirTo = toP.clone().normalize();
        const tang = new THREE.Vector3(-dirTo.z, 0, dirTo.x).multiplyScalar(e.strafe);
        const move = new THREE.Vector3();
        if (canAttack) {
          if (dist > range * 0.85) move.add(dirTo);
          else this.startEnemyAttack(e);
        } else {
          const want = e.ringDist;
          if (dist > want + 0.4) move.add(dirTo);
          else if (dist < want - 0.6) move.addScaledVector(dirTo, -0.7);
          move.addScaledVector(tang, 0.55);
          if (Math.random() < dt * 0.3) e.strafe *= -1;
        }
        if (move.lengthSq() > 0.01) {
          move.normalize();
          moveSpeed = speed * (canAttack ? 1 : 0.55);
          e.pos.addScaledVector(move, moveSpeed * dt);
        }
        // reacción defensiva
        if (st.block > 0 && p.state === 'attack' && this.atkId !== e.lastSeenAtk && dist < 3.4) {
          e.lastSeenAtk = this.atkId;
          if (Math.random() < st.block * (e.enraged ? 0.6 : 1)) {
            e.state = 'block';
            e.t = 0;
            e.blockDur = 0.6 + Math.random() * 0.6;
          }
        }
        break;
      }
      case 'attack': {
        const a = e.atk!;
        const k = clamp01(e.t / a.dur);
        if (e.t < a.hit[0] - 0.18) e.facing = turn(e.facing, angToP, st.boss || e.beast ? 5 : 3.2, dt);
        if (e.t > a.hit[0] - 0.12 && e.t < a.hit[1]) {
          e.pos.addScaledVector(fwd(e.facing), a.lunge * dt * (a.lunge > 10 ? 1 : 0.7));
        }
        const tel = e.t < a.hit[0] ? Math.pow(clamp01(e.t / a.hit[0]), 2) : Math.max(0, 1 - (e.t - a.hit[0]) * 5);
        e.rig.telegraph(tel);
        e.trail.active = e.t >= a.hit[0] - 0.05 && e.t <= a.hit[1] + 0.05;
        if (a.slam && !e.slammed && e.t >= a.hit[0]) {
          e.slammed = true;
          const at = e.pos.clone().addScaledVector(fwd(e.facing), 1.4);
          this.rings.spawn(at, 0xffa040, a.range + 0.5, 0.5);
          this.dust.burst(at.clone().setY(0.2), 40, new THREE.Color(0x8a7458), 6, 0.9, 0.7, -4, 0.5);
          this.sparks.burst(at.clone().setY(0.2), 25, new THREE.Color(0xffa040), 7, 0.5, 0.3);
          this.audio.slam();
          this.shake = Math.max(this.shake, 0.5);
        }
        if (e.t >= a.hit[0] && e.t <= a.hit[1] && !e.hitSet.has(p)) {
          const d = tmpV2.subVectors(p.pos, e.pos);
          const dd = d.length();
          const origin = a.slam ? e.pos.clone().addScaledVector(fwd(e.facing), 1.4) : e.pos;
          const ok = a.slam
            ? p.pos.distanceTo(origin) < a.range
            : dd < a.range * st.scale + p.radius && (dd < 0.8 || d.normalize().dot(fwd(e.facing)) >= a.arc);
          if (ok) {
            e.hitSet.add(p);
            this.hurtPlayer(a.dmg, e.pos, a);
          }
        }
        sampleKeys(a.keys, k, tp);
        rate = 26;
        if (e.t >= a.dur) {
          e.trail.active = false;
          e.rig.telegraph(0);
          const idx = st.attacks.indexOf(a);
          if (st.boss && idx === 0 && st.attacks.length > 1 && Math.random() < 0.7) {
            this.startEnemyAttack(e, 1);
          } else {
            e.state = 'chase';
            e.t = 0;
            e.cool = st.boss ? 0.4 + Math.random() * (e.enraged ? 0.4 : 0.9) : e.beast ? 0.8 + Math.random() : 1.0 + Math.random() * 1.4;
          }
        }
        break;
      }
      case 'block': {
        e.facing = turn(e.facing, angToP, 7, dt);
        guardPose(tp, st.weapon, this.time, true);
        tp.shield = 1;
        tp.lShP = 1.2; tp.lEl = 1.4;
        if (e.t > e.blockDur) {
          if (Math.random() < 0.5 && dist < e.atkRange() * 1.2) this.startEnemyAttack(e);
          else { e.state = 'chase'; e.t = 0; }
        }
        break;
      }
      case 'stagger':
        if (e.beast) beastHit(tp, 1 - clamp01(e.t / e.stun) * 0.6);
        else hitPose(tp, 1 - clamp01(e.t / e.stun) * 0.6);
        rate = 22;
        if (e.t >= e.stun) { e.state = 'chase'; e.t = 0; e.cool = Math.min(e.cool, 0.5); }
        break;
      case 'dead':
        e.removeT += dt;
        if (e.beast) beastDeath(tp, e.t / 0.6);
        else deathPose(tp, e.t / 0.7);
        rate = 18;
        if (e.removeT > 2.2) {
          e.rig.root.position.y -= dt * 0.35;
          e.rig.setOpacity(Math.max(0, 1 - (e.removeT - 2.2) / 2));
        }
        break;
    }

    if (e.state === 'chase' || e.state === 'block') {
      if (e.beast) {
        e.phase += dt * moveSpeed * 1.6 / Math.sqrt(st.scale);
        beastGait(tp, e.phase, clamp01(moveSpeed / 4));
      } else {
        e.phase += dt * moveSpeed * 1.9 / Math.sqrt(st.scale);
        locomotion(tp, e.phase, clamp01(moveSpeed / 3), 0.4);
      }
    }

    if (e.state !== 'dead') {
      resolveCircle(e.pos, e.radius, this.level.cols);
      e.pos.y = 0;
      e.rig.root.position.copy(e.pos);
    } else {
      e.rig.root.position.x = e.pos.x;
      e.rig.root.position.z = e.pos.z;
    }
    e.rig.root.rotation.y = e.facing;
    this.blendPose(e, rate, dt);
    e.rig.apply();
    e.rig.root.updateMatrixWorld(true);
    e.trail.update(e.rig.bladeBase.getWorldPosition(new THREE.Vector3()), e.rig.bladeTip.getWorldPosition(new THREE.Vector3()), dt);
    // capa
    if (e.rig.cape) e.rig.cape.rotation.x = 0.2 + Math.min(0.9, moveSpeed * 0.15) + Math.sin(this.time * 3) * 0.04;
  }

  private startEnemyAttack(e: Enemy, idx?: number) {
    const atks = STATS[e.kind].attacks;
    let i = idx ?? 0;
    if (idx === undefined) {
      const d = e.pos.distanceTo(this.player.pos);
      const r = Math.random();
      if (e.kind === 'centurion') {
        i = d > 3.5 && r < 0.6 ? 2 : r < 0.25 ? 3 : 0;
      } else if (e.beast) {
        // de lejos salta, de cerca da zarpazos
        i = d > 2.6 * Math.sqrt(e.st.scale) ? 1 : r < 0.25 ? 1 : 0;
      } else if (e.kind === 'megatherium') {
        i = r < 0.35 ? 2 : 0;
      } else i = Math.floor(r * atks.length);
    }
    e.atk = atks[i];
    e.state = 'attack';
    e.t = 0;
    e.hitSet.clear();
    e.slammed = false;
    this.audio.swing(!!e.atk.heavy);
  }

  private separate() {
    const all: Fighter[] = [this.player, ...this.enemies.filter((e) => e.state !== 'dead' && e.state !== 'spawn')];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const d = tmpV.subVectors(b.pos, a.pos).setY(0);
        const l = d.length();
        const min = a.radius + b.radius;
        if (l < min && l > 1e-4) {
          d.multiplyScalar((min - l) / l);
          if (a === this.player) b.pos.addScaledVector(d, 0.8), a.pos.addScaledVector(d, -0.2);
          else { a.pos.addScaledVector(d, -0.5); b.pos.addScaledVector(d, 0.5); }
        }
      }
    }
  }

  // ------------------------------------------------------------------ zonas, brecha y objetos
  private updateZones() {
    const p = this.player;
    const z = p.pos.z;
    for (const tt of this.def.titles) {
      if (z > tt.z && !this.shownTitles.has(tt.text)) { this.shownTitles.add(tt.text); this.title(tt.text); }
    }

    let fighting = false;
    for (const zone of this.zones) {
      if (zone.done) continue;
      if (!zone.started) {
        if (z > zone.trigger) {
          zone.started = true;
          zone.wave = 0;
          zone.waves[0].forEach((s) => this.spawnEnemy(s));
          if (zone.trap !== undefined) {
            this.level.closeGate(zone.trap);
            this.audio.gate();
            this.message('¡Es una trampa! Derrota al centurión Varro.', 3);
          }
        }
        continue;
      }
      fighting = true;
      const alive = this.enemies.some((e) => e.state !== 'dead');
      if (!alive) {
        zone.wave++;
        if (zone.wave < zone.waves.length) {
          zone.waves[zone.wave].forEach((s) => this.spawnEnemy(s));
          this.message(this.def.build === 'rome' ? '¡Más legionarios atraviesan la brecha!' : '¡Algo se acerca entre las rocas!', 2);
        } else {
          zone.done = true;
          if (zone.gate >= 0) {
            this.level.openGate(zone.gate);
            this.audio.gate();
            this.message('Sello temporal abierto · Avanza', 3);
          } else {
            this.openPortal();
          }
        }
      }
    }
    this.audio.intensity += ((fighting ? 1 : 0.2) - this.audio.intensity) * 0.02;
    if (this.comboTimer > 0) { this.comboTimer -= 1 / 60; if (this.comboTimer <= 0) this.comboCount = 0; }

    // portal de salida
    if (this.portal && p.pos.distanceTo(this.portal.position.clone().setY(0)) < 1.8 && this.state === 'play') {
      this.state = 'win';
      this.audio.portal();
      this.sparks.burst(p.chest(), 200, new THREE.Color(0x46f2ff), 10, 1.5, 0.6, -1);
      p.rig.root.visible = false;
      const bonus = Math.round(this.flux * 30 + Math.max(0, p.hp) * 20);
      this.score += bonus;
      setTimeout(() => this.showEnd(true, `${this.def.outro}<br>Bonus de flujo e integridad: +${bonus.toLocaleString('es')}`), 1200);
    }
  }

  private openPortal() {
    const [px, pz] = this.def.portal;
    const g = new THREE.Group();
    this.portalMat = energyMaterial(0x46f2ff, 0x9a4dff, 2);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), this.portalMat);
    g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.07, 10, 64), new THREE.MeshStandardMaterial({ color: 0x061a1e, emissive: 0x46f2ff, emissiveIntensity: 4 }));
    g.add(ring);
    g.position.set(px, 2.3, pz);
    g.lookAt(this.player.pos.clone().setY(2.3));
    this.scene.add(g);
    this.portal = g;
    this.audio.portal();
    this.message('Entra en el portal para sellar la brecha', 5);
  }

  private updateFlux(dt: number) {
    const p = this.player;
    // el flujo temporal se agota con el tiempo
    this.flux -= dt * (100 / 240);
    if (this.flux <= 0) { this.flux = 0; this.playerDie('El flujo temporal se agotó y la brecha te ha engullido.'); return; }
    // la brecha avanza: nunca más allá del inicio de la zona activa
    let stop = this.def.wallMax;
    for (const z of this.zones) if (!z.done) { stop = z.wallStop; break; }
    if (this.zones.every((z) => z.done)) stop = this.def.wallMax;
    this.wallZ = Math.min(stop, Math.max(this.wallZ + dt * 0.6, p.pos.z - 32));
    this.riftWall.position.z = this.wallZ;
    if (p.pos.z < this.wallZ + 1.2) {
      p.pos.z = Math.max(p.pos.z, this.wallZ + 0.6);
      p.hp -= dt * 25;
      p.flashT = Math.max(p.flashT, 0.6);
      this.hud.damage.style.opacity = '0.7';
      if (Math.random() < 0.3) this.sparks.burst(p.chest(), 3, new THREE.Color(0x9a4dff), 3, 0.5, 0.4);
      if (p.hp <= 0) this.playerDie('La brecha temporal te ha alcanzado.');
    }
    // chispas de la brecha
    for (let i = 0; i < 3; i++) {
      this.sparks.emit(p.pos.x + (Math.random() - 0.5) * 24, Math.random() * 8, this.wallZ + Math.random() * 0.5, (Math.random() - 0.5) * 0.5, Math.random(), 0.5 + Math.random(), 1.2, 0.35, new THREE.Color(Math.random() < 0.5 ? 0x9a4dff : 0x46f2ff), 0, 0.5);
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    this.pickups = this.pickups.filter((it) => {
      it.t += dt;
      if (it.vel) {
        // los chips saltan del enemigo y rebotan
        it.vel.y -= 14 * dt;
        it.pos.addScaledVector(it.vel, dt);
        resolveCircle(it.pos, 0.2, this.level.cols);
        if (it.pos.y < 0.3) {
          it.pos.y = 0.3;
          it.vel.y *= -0.35;
          it.vel.x *= 0.5; it.vel.z *= 0.5;
          if (Math.abs(it.vel.y) < 0.8) it.vel = undefined;
        }
        it.mesh.position.copy(it.pos);
        it.mesh.rotation.x += dt * 8;
      } else {
        it.mesh.rotation.y += dt * 1.8;
        it.mesh.rotation.x *= 0.9;
        it.mesh.position.y = it.pos.y + Math.sin(it.t * 2.5) * (it.kind === 'chip' ? 0.06 : 0.12);
      }
      if (Math.random() < dt * (it.kind === 'chip' ? 2 : 6)) this.sparks.emit(it.pos.x + (Math.random() - 0.5) * 0.4, it.pos.y - 0.2, it.pos.z + (Math.random() - 0.5) * 0.4, 0, 0.8, 0, 0.8, 0.25, new THREE.Color(it.kind === 'heal' ? 0x7dff6a : it.kind === 'chip' ? 0x2a9dff : 0x46f2ff), 0, 1);
      if (p.state === 'dead' || this.state !== 'play') return true;
      const d = Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z);
      // imán suave para chips cercanos
      if (it.kind === 'chip' && !it.vel && d < 2.6 && d > 0.01) {
        const k = Math.min(1, dt * 8 / d);
        it.pos.x += (p.pos.x - it.pos.x) * k;
        it.pos.z += (p.pos.z - it.pos.z) * k;
        it.mesh.position.x = it.pos.x;
        it.mesh.position.z = it.pos.z;
      }
      if (d > (it.kind === 'chip' ? 0.8 : 1.3) || (it.vel && it.kind === 'chip')) return true;
      this.scene.remove(it.mesh);
      if (it.kind === 'weapon' && it.weapon) {
        if (this.playerWeapons.includes(it.weapon)) {
          this.score += 100;
          this.audio.pickup();
          this.message(`${WEAPON_NAME[it.weapon]} ya en tu inventario · +100`, 1.5);
        } else {
          this.playerWeapons.push(it.weapon);
          this.weaponIdx = this.playerWeapons.length - 1;
          (p.rig as Rig).setWeapon(it.weapon, this.weaponMats);
          this.audio.pickup();
          this.message(`${WEAPON_HINT[it.weapon]}${this.playerWeapons.length > 2 ? ' · Q para cambiar' : ''}`, 3);
        }
      } else if (it.kind === 'chip') {
        this.chips++;
        this.score += 25;
        this.audio.chip();
        if (this.chips === 1) this.message('Chip temporal · llévalo a un manantial para ganar tiempo', 3);
      } else {
        p.hp = Math.min(p.maxHp, p.hp + 35);
        this.audio.heal();
      }
      this.sparks.burst(it.pos, it.kind === 'chip' ? 8 : 30, new THREE.Color(it.kind === 'heal' ? 0x7dff6a : 0x46f2ff), 4, 0.6, 0.3, 0);
      return false;
    });
    this.updateSprings(dt);
  }

  /** Manantiales temporales: convierten los chips en flujo de tiempo */
  inTar(p: THREE.Vector3) {
    for (const h of this.level.hazards) if (Math.hypot(p.x - h.x, p.z - h.z) < h.r) return true;
    return false;
  }

  private updateSprings(dt: number) {
    const p = this.player;
    for (const sp of this.level.springs) {
      const d = Math.hypot(p.pos.x - sp.pos.x, p.pos.z - sp.pos.z);
      const inside = d < 1.4 && p.state !== 'dead' && this.state === 'play';
      sp.glow += ((inside ? 1 : 0) - sp.glow) * Math.min(1, dt * 4);
      if (Math.random() < dt * 10) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 1.1;
        this.sparks.emit(sp.pos.x + Math.cos(a) * r, 0.2, sp.pos.z + Math.sin(a) * r, 0, 1.2 + Math.random() * 1.5, 0, 1.6, 0.3, new THREE.Color(0x46f2ff), 0, 0.3);
      }
      if (!inside) continue;
      if (this.chips > 0) {
        this.depositT -= dt;
        if (this.depositT <= 0) {
          this.depositT = 0.12;
          this.chips--;
          this.flux = Math.min(100, this.flux + 7);
          this.score += 40;
          this.audio.chip(true);
          this.sparks.burst(p.chest(), 14, new THREE.Color(0x46f2ff), 4, 0.8, 0.35, 2, 1);
          if (this.chips === 0) this.message('Flujo temporal restaurado', 2);
        }
      } else if (!this.shownTitles.has('springhint') && this.flux < 99) {
        this.shownTitles.add('springhint');
        this.message('Manantial temporal · trae chips para recargar el flujo', 3);
      }
    }
  }

  private updateAmbient(dt: number) {
    const p = this.player;
    // polvo flotante con la luz del atardecer
    if (Math.random() < dt * 20) {
      this.dust.emit(p.pos.x + (Math.random() - 0.5) * 20, Math.random() * 5, p.pos.z + (Math.random() - 0.2) * 20, (Math.random() - 0.5) * 0.2, 0.05, (Math.random() - 0.5) * 0.2, 4, 0.12, new THREE.Color(0xffe2b0), 0, 0.1);
    }
    // humo de hogueras, brea y volcanes
    for (const sm of this.level.smoke) {
      const far = sm.y > 30;
      if (!far && Math.abs(sm.z - p.pos.z) > 35) continue;
      if (Math.random() < dt * (far ? 6 : 3)) {
        this.dust.emit(sm.x + (Math.random() - 0.5) * (far ? 8 : 0.4), sm.y, sm.z + (Math.random() - 0.5) * (far ? 8 : 0.4), (Math.random() - 0.5) * 0.3, far ? 4 : 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, far ? 10 : 3, far ? 30 : 1.1, new THREE.Color(far ? 0x2a2420 : 0x3a3532), 0, 0.2);
      }
    }
    // ascuas de antorchas cercanas
    for (const f of this.level.flames) {
      if (Math.abs(f.z - p.pos.z) > 30) continue;
      if (Math.random() < dt * 8) this.sparks.emit(f.x + (Math.random() - 0.5) * 0.2, f.y + 0.3, f.z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4, 1.5 + Math.random(), (Math.random() - 0.5) * 0.4, 1.2, 0.18, new THREE.Color(0xff8a30), 0.5, 0.6);
    }
    if (this.portal) {
      this.portal.rotation.z += dt * 0.5;
      if (Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2;
        tmpV.set(Math.cos(a) * 2, Math.sin(a) * 2, 0).applyQuaternion(this.portal.quaternion).add(this.portal.position);
        this.sparks.emit(tmpV.x, tmpV.y, tmpV.z, 0, 0.3, 0, 1, 0.3, new THREE.Color(0x46f2ff), 0, 1);
      }
    }
  }
}

