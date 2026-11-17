import type { Key, WeaponType } from './rig';

export interface AttackDef {
  dur: number;        // duración total (s)
  hit: [number, number]; // ventana activa (s)
  dmg: number;
  range: number;
  arc: number;        // coseno del semiángulo
  knock: number;
  lunge: number;      // impulso hacia delante
  chain: number;      // a partir de cuándo se puede encadenar (s)
  keys: Key[];
  heavy?: boolean;
  breaksGuard?: boolean;
  slam?: boolean;     // onda de choque
}

const P = Math.PI;

// ----------------------------------------------------------------- jugadora
export const PLAYER_COMBOS: Record<Exclude<WeaponType, 'club' | 'centurion'>, AttackDef[]> = {
  fists: [
    {
      dur: 0.34, hit: [0.07, 0.16], dmg: 8, range: 1.55, arc: 0.5, knock: 1.5, lunge: 2.5, chain: 0.14,
      keys: [{ t: 0, p: {} }, { t: 0.25, p: { rShP: 1.55, rEl: 0.1, rShA: 0.1, spineY: 0.45, lShP: 0.9, lEl: 2.1 } }, { t: 0.55, p: { rShP: 1.5, rEl: 0.15, spineY: 0.4 } }, { t: 1, p: {} }],
    },
    {
      dur: 0.36, hit: [0.08, 0.17], dmg: 8, range: 1.55, arc: 0.5, knock: 1.5, lunge: 2.5, chain: 0.15,
      keys: [{ t: 0, p: {} }, { t: 0.25, p: { lShP: 1.55, lEl: 0.1, lShA: 0.05, spineY: -0.45, rShP: 0.9, rEl: 2.1 } }, { t: 0.55, p: { lShP: 1.5, lEl: 0.15, spineY: -0.4 } }, { t: 1, p: {} }],
    },
    {
      dur: 0.55, hit: [0.17, 0.28], dmg: 15, range: 1.7, arc: 0.4, knock: 6, lunge: 3.5, chain: 0.42, heavy: true,
      keys: [{ t: 0, p: {} }, { t: 0.25, p: { bodyY: -0.16, rShP: 0.2, rEl: 1.9, spineX: 0.35, spineY: -0.3, lKnee: 0.7, rKnee: 0.7 } }, { t: 0.45, p: { rShP: 2.7, rEl: 1.0, spineX: -0.25, spineY: 0.3, headX: -0.25, bodyY: 0.04 } }, { t: 0.7, p: { rShP: 2.6, rEl: 1.0, spineX: -0.2 } }, { t: 1, p: {} }],
    },
  ],
  gladius: [
    {
      dur: 0.42, hit: [0.1, 0.22], dmg: 17, range: 2.0, arc: 0.2, knock: 2, lunge: 3, chain: 0.2,
      keys: [{ t: 0, p: {} }, { t: 0.22, p: { rShP: 0.6, rShA: 1.35, rShY: -0.6, rEl: 0.5, rWr: 0.9, spineY: -0.7 } }, { t: 0.5, p: { rShP: 0.4, rShA: 1.35, rShY: 2.0, rEl: 0.15, rWr: 1.1, spineY: 0.65 } }, { t: 0.7, p: { rShA: 1.3, rShY: 2.1, spineY: 0.6 } }, { t: 1, p: {} }],
    },
    {
      dur: 0.42, hit: [0.1, 0.22], dmg: 17, range: 2.0, arc: 0.2, knock: 2, lunge: 3, chain: 0.2,
      keys: [{ t: 0, p: {} }, { t: 0.22, p: { rShP: 0.5, rShA: 1.3, rShY: 2.0, rEl: 0.8, rWr: 1.1, spineY: 0.7 } }, { t: 0.5, p: { rShP: 0.6, rShA: 1.35, rShY: -0.6, rEl: 0.2, rWr: 0.9, spineY: -0.7 } }, { t: 0.7, p: { rShY: -0.7, spineY: -0.7 } }, { t: 1, p: {} }],
    },
    {
      dur: 0.62, hit: [0.2, 0.32], dmg: 28, range: 2.3, arc: 0.55, knock: 7, lunge: 7, chain: 0.5, heavy: true,
      keys: [{ t: 0, p: {} }, { t: 0.3, p: { rShP: 0.4, rEl: 1.9, rWr: 1.4, spineY: -0.55, bodyY: -0.1, lLegP: 0.4, lKnee: 0.6 } }, { t: 0.45, p: { rShP: 1.55, rEl: 0.0, rWr: P / 2, spineY: 0.35, spineX: 0.3, lLegP: 0.7, rLegP: -0.5, lKnee: 0.5, bodyY: -0.14 } }, { t: 0.72, p: { rShP: 1.5, rEl: 0.05, rWr: P / 2, spineX: 0.3, lLegP: 0.7, rLegP: -0.5, bodyY: -0.14 } }, { t: 1, p: {} }],
    },
  ],
  spear: [
    {
      dur: 0.46, hit: [0.13, 0.24], dmg: 20, range: 2.9, arc: 0.75, knock: 3, lunge: 3, chain: 0.24,
      keys: [{ t: 0, p: {} }, { t: 0.25, p: { rShP: 0.3, rEl: 1.6, rWr: 1.45, lShP: 1.0, spineY: -0.2 } }, { t: 0.48, p: { rShP: 1.5, rEl: 0.05, rWr: P / 2, lShP: 1.4, lEl: 0.3, spineY: 0.3, spineX: 0.2 } }, { t: 0.7, p: { rShP: 1.5, rEl: 0.05, rWr: P / 2 } }, { t: 1, p: {} }],
    },
    {
      dur: 0.55, hit: [0.16, 0.3], dmg: 18, range: 2.8, arc: 0.0, knock: 4, lunge: 2, chain: 0.3,
      keys: [{ t: 0, p: {} }, { t: 0.25, p: { rShP: 0.5, rShA: 1.3, rShY: -0.7, rEl: 0.3, rWr: 1.4, spineY: -0.8 } }, { t: 0.55, p: { rShP: 0.4, rShA: 1.35, rShY: 2.2, rEl: 0.1, rWr: 1.5, spineY: 0.8 } }, { t: 0.75, p: { rShY: 2.2, spineY: 0.8 } }, { t: 1, p: {} }],
    },
    {
      dur: 0.75, hit: [0.3, 0.44], dmg: 34, range: 3.2, arc: 0.8, knock: 9, lunge: 9, chain: 0.6, heavy: true,
      keys: [{ t: 0, p: {} }, { t: 0.35, p: { rShP: 0.1, rEl: 1.9, rWr: 1.5, spineY: -0.7, bodyY: -0.15, lKnee: 0.8, rKnee: 0.7, lShP: 1.2 } }, { t: 0.5, p: { rShP: 1.55, rEl: 0.0, rWr: P / 2, spineY: 0.4, spineX: 0.35, lLegP: 0.8, rLegP: -0.6, bodyY: -0.18, lShP: 1.5, lEl: 0.2 } }, { t: 0.78, p: { rShP: 1.5, rWr: P / 2, spineX: 0.35, lLegP: 0.8, rLegP: -0.6, bodyY: -0.18 } }, { t: 1, p: {} }],
    },
  ],
};

export const KICK: AttackDef = {
  dur: 0.52, hit: [0.17, 0.28], dmg: 9, range: 1.9, arc: 0.4, knock: 8, lunge: 3, chain: 0.45, breaksGuard: true, heavy: true,
  keys: [{ t: 0, p: {} }, { t: 0.3, p: { rLegP: 0.9, rKnee: 1.9, spineX: -0.15, lKnee: 0.25, lShP: 0.5, rShP: 0.3, lShA: 0.5, rShA: 0.5 } }, { t: 0.48, p: { rLegP: 1.6, rKnee: 0.05, spineX: -0.35, lKnee: 0.2, lShA: 0.7, rShA: 0.7 } }, { t: 0.65, p: { rLegP: 1.5, rKnee: 0.1, spineX: -0.3 } }, { t: 1, p: {} }],
};

// ----------------------------------------------------------------- enemigos
export const LEGION_ATTACKS: AttackDef[] = [
  {
    dur: 1.0, hit: [0.5, 0.64], dmg: 8, range: 1.9, arc: 0.3, knock: 3, lunge: 3, chain: 9,
    keys: [{ t: 0, p: {} }, { t: 0.42, p: { rShP: 2.2, rShA: 0.7, rEl: 1.4, rWr: 0.4, spineX: -0.2, spineY: -0.4, shield: 0.4 } }, { t: 0.62, p: { rShP: 0.9, rShA: 0.2, rEl: 0.1, rWr: 1.3, spineX: 0.35, spineY: 0.3, lLegP: 0.4 } }, { t: 0.8, p: { rShP: 0.8, rEl: 0.1, spineX: 0.3 } }, { t: 1, p: {} }],
  },
  {
    dur: 1.0, hit: [0.52, 0.64], dmg: 10, range: 2.1, arc: 0.6, knock: 4, lunge: 5, chain: 9,
    keys: [{ t: 0, p: {} }, { t: 0.45, p: { rShP: 0.3, rEl: 1.9, rWr: 1.4, spineY: -0.5, bodyY: -0.08, shield: 0.6 } }, { t: 0.62, p: { rShP: 1.5, rEl: 0.0, rWr: P / 2, spineY: 0.3, spineX: 0.3, lLegP: 0.6, rLegP: -0.4, bodyY: -0.12 } }, { t: 0.85, p: { rShP: 1.4, rWr: P / 2, spineX: 0.25 } }, { t: 1, p: {} }],
  },
];

export const BRUTE_ATTACKS: AttackDef[] = [
  {
    dur: 1.55, hit: [0.86, 0.98], dmg: 18, range: 2.6, arc: 0.4, knock: 9, lunge: 2, chain: 9, slam: true, heavy: true,
    keys: [{ t: 0, p: {} }, { t: 0.5, p: { rShP: 3.0, rEl: 0.5, rWr: -0.2, lShP: 2.8, lEl: 0.6, spineX: -0.35, headX: 0.2, bodyY: 0.03 } }, { t: 0.62, p: { rShP: 0.9, rEl: 0.05, rWr: 0.6, lShP: 0.9, lEl: 0.1, spineX: 0.6, bodyY: -0.2, lKnee: 0.7, rKnee: 0.7, lLegP: 0.4 } }, { t: 0.85, p: { rShP: 0.9, rWr: 0.6, spineX: 0.6, bodyY: -0.2 } }, { t: 1, p: {} }],
  },
  {
    dur: 1.2, hit: [0.62, 0.76], dmg: 14, range: 2.6, arc: -0.1, knock: 6, lunge: 2, chain: 9, heavy: true,
    keys: [{ t: 0, p: {} }, { t: 0.5, p: { rShP: 0.6, rShA: 1.3, rShY: -1.0, rEl: 0.3, rWr: 1.0, spineY: -0.9 } }, { t: 0.66, p: { rShP: 0.5, rShA: 1.3, rShY: 2.2, rEl: 0.1, rWr: 1.1, spineY: 0.8 } }, { t: 0.85, p: { rShY: 2.2, spineY: 0.8 } }, { t: 1, p: {} }],
  },
];

export const BOSS_ATTACKS: AttackDef[] = [
  // combo de dos tajos
  {
    dur: 0.75, hit: [0.36, 0.48], dmg: 13, range: 2.2, arc: 0.2, knock: 3, lunge: 4, chain: 9,
    keys: [{ t: 0, p: {} }, { t: 0.42, p: { rShP: 0.6, rShA: 1.35, rShY: -0.7, rEl: 0.5, rWr: 0.9, spineY: -0.7, shield: 0.3 } }, { t: 0.64, p: { rShP: 0.4, rShA: 1.35, rShY: 2.0, rEl: 0.15, rWr: 1.1, spineY: 0.65 } }, { t: 1, p: { rShY: 2.0, rShA: 1.3, spineY: 0.6 } }],
  },
  {
    dur: 0.7, hit: [0.22, 0.34], dmg: 13, range: 2.2, arc: 0.2, knock: 4, lunge: 4, chain: 9,
    keys: [{ t: 0, p: { rShP: 0.4, rShA: 1.35, rShY: 2.0, rEl: 0.3, rWr: 1.1, spineY: 0.65 } }, { t: 0.45, p: { rShP: 0.6, rShA: 1.35, rShY: -0.7, rEl: 0.2, rWr: 0.9, spineY: -0.7 } }, { t: 0.7, p: { rShY: -0.7, spineY: -0.7 } }, { t: 1, p: {} }],
  },
  // estocada en carga
  {
    dur: 1.3, hit: [0.75, 0.95], dmg: 20, range: 2.4, arc: 0.6, knock: 10, lunge: 16, chain: 9, heavy: true,
    keys: [{ t: 0, p: {} }, { t: 0.5, p: { rShP: 0.2, rEl: 1.9, rWr: 1.4, spineY: -0.6, bodyY: -0.2, lKnee: 0.9, rKnee: 0.8, shield: 0.8, spineX: 0.3 } }, { t: 0.65, p: { rShP: 1.55, rEl: 0.0, rWr: P / 2, spineY: 0.35, spineX: 0.35, lLegP: 0.7, rLegP: -0.6, bodyY: -0.15 } }, { t: 0.85, p: { rShP: 1.5, rWr: P / 2, spineX: 0.3 } }, { t: 1, p: {} }],
  },
  // golpe de escudo al suelo (onda)
  {
    dur: 1.25, hit: [0.68, 0.8], dmg: 16, range: 3.6, arc: -1, knock: 9, lunge: 0, chain: 9, slam: true, heavy: true,
    keys: [{ t: 0, p: {} }, { t: 0.5, p: { rShP: 2.9, rEl: 0.4, rWr: 0.2, spineX: -0.3, shield: 1, bodyY: 0.05 } }, { t: 0.6, p: { rShP: 0.6, rEl: 0.1, rWr: 1.4, spineX: 0.7, bodyY: -0.28, lKnee: 1.0, rKnee: 1.0, shield: 0 } }, { t: 0.85, p: { rShP: 0.6, spineX: 0.6, bodyY: -0.25 } }, { t: 1, p: {} }],
  },
];
