// Definición de eras y niveles: 2 niveles por época.

export type EnemyKind =
  | 'legionary' | 'spearman' | 'retiarius' | 'brute' | 'centurion'
  | 'caveman' | 'hunter' | 'sabertooth' | 'sloth' | 'alphacat' | 'megatherium';

export interface SpawnDef { k: EnemyKind; x: number; z: number }
export interface ZoneDef { trigger: number; wallStop: number; gate: number; trap?: number; waves: SpawnDef[][] }
export interface SkyDef {
  sun: [number, number, number]; turbidity: number; rayleigh: number; mie: number;
  fog: number; fogDensity: number; sunColor: number; sunIntensity: number;
  hemiSky: number; hemiGround: number; hemi: number; exposure: number;
}
export interface LevelDef {
  era: string;
  num: number;
  name: string;
  build: 'rome' | 'valley' | 'tarpits';
  spawn: [number, number];
  wallStart: number;
  wallMax: number;
  closed: number[];
  open: number[];
  zones: ZoneDef[];
  titles: { z: number; text: string }[];
  cams: { z: number; off: [number, number, number] }[];
  portal: [number, number];
  bossCenter: [number, number];
  reinforce: SpawnDef[];
  sky: SkyDef;
  intro: string;
  outro: string;
}

const CAMS_VALLEY: LevelDef['cams'] = [
  { z: -99, off: [3.2, 4.4, -7.2] },
  { z: 50, off: [0, 5.8, -8.2] },
  { z: 104, off: [0, 9.5, -11] },
];

const SKY_ROME: SkyDef = {
  sun: [-0.45, 0.42, 0.78], turbidity: 6, rayleigh: 1.6, mie: 0.006, fog: 0xd8b48c, fogDensity: 0.0065,
  sunColor: 0xffd6a0, sunIntensity: 3.4, hemiSky: 0xcfdcff, hemiGround: 0x6b4f33, hemi: 0.65, exposure: 0.95,
};

export const LEVELS: LevelDef[] = [
  // ------------------------------------------------------------ ERA I · PREHISTORIA
  {
    era: 'ERA I · PREHISTORIA', num: 1, name: 'El Valle de los Colmillos', build: 'valley',
    spawn: [0, 2], wallStart: -9, wallMax: 104, closed: [0, 1], open: [],
    zones: [
      { trigger: 14, wallStop: -4, gate: 0, waves: [[{ k: 'caveman', x: -3, z: 28 }, { k: 'caveman', x: 3, z: 32 }]] },
      {
        trigger: 56, wallStop: 52, gate: 1,
        waves: [
          [{ k: 'hunter', x: -3, z: 68 }, { k: 'caveman', x: 3, z: 70 }, { k: 'caveman', x: 0, z: 76 }],
          [{ k: 'sabertooth', x: -2, z: 88 }, { k: 'sabertooth', x: 3, z: 92 }, { k: 'hunter', x: 0, z: 95 }],
        ],
      },
      { trigger: 110, wallStop: 102, gate: -1, trap: 1, waves: [[{ k: 'alphacat', x: 0, z: 131 }, { k: 'caveman', x: -6, z: 126 }, { k: 'caveman', x: 6, z: 126 }]] },
    ],
    titles: [{ z: 52, text: 'EL CAÑÓN' }, { z: 106, text: 'EL CLARO DE LOS MENHIRES' }],
    cams: CAMS_VALLEY,
    portal: [0, 127], bossCenter: [0, 124],
    reinforce: [{ k: 'sabertooth', x: -10, z: 132 }, { k: 'sabertooth', x: 10, z: 132 }],
    sky: {
      sun: [0.5, 0.55, 0.66], turbidity: 4, rayleigh: 1.2, mie: 0.005, fog: 0xa9bdb2, fogDensity: 0.0038,
      sunColor: 0xfff0d8, sunIntensity: 3.2, hemiSky: 0xd8e8ff, hemiGround: 0x4d5a2e, hemi: 0.7, exposure: 1.0,
    },
    intro: 'Hace 15.000 años. Pelea a puño limpio y quítales las armas a los cavernícolas.',
    outro: 'Garra Gris ha caído y el valle queda en calma.',
  },
  {
    era: 'ERA I · PREHISTORIA', num: 2, name: 'Los Pozos de Brea', build: 'tarpits',
    spawn: [0, 2], wallStart: -9, wallMax: 104, closed: [0, 1], open: [],
    zones: [
      { trigger: 14, wallStop: -4, gate: 0, waves: [[{ k: 'caveman', x: -3, z: 26 }, { k: 'hunter', x: 3, z: 30 }, { k: 'sabertooth', x: 0, z: 38 }]] },
      {
        trigger: 56, wallStop: 52, gate: 1,
        waves: [
          [{ k: 'sloth', x: 0, z: 76 }, { k: 'caveman', x: -3, z: 68 }, { k: 'caveman', x: 3, z: 69 }],
          [{ k: 'sabertooth', x: -3, z: 88 }, { k: 'sabertooth', x: 3, z: 90 }, { k: 'hunter', x: 0, z: 95 }, { k: 'sloth', x: 0, z: 97 }],
        ],
      },
      { trigger: 110, wallStop: 102, gate: -1, trap: 1, waves: [[{ k: 'megatherium', x: 0, z: 133 }, { k: 'caveman', x: -6, z: 126 }, { k: 'hunter', x: 6, z: 126 }]] },
    ],
    titles: [{ z: 52, text: 'LA GARGANTA DE CENIZA' }, { z: 106, text: 'EL CRÁTER' }],
    cams: CAMS_VALLEY,
    portal: [0, 127], bossCenter: [0, 124],
    reinforce: [{ k: 'sabertooth', x: -10, z: 132 }, { k: 'sabertooth', x: 10, z: 132 }],
    sky: {
      sun: [-0.3, 0.13, 0.95], turbidity: 12, rayleigh: 3, mie: 0.02, fog: 0x5e3a2c, fogDensity: 0.0075,
      sunColor: 0xff9a60, sunIntensity: 2.8, hemiSky: 0xa07a6a, hemiGround: 0x2a1a14, hemi: 0.6, exposure: 1.05,
    },
    intro: 'La brea atrapa a quien la pisa: evita los pozos negros.',
    outro: 'El Megaterio se hunde en la ceniza. Próxima parada: Roma.',
  },
  // ------------------------------------------------------------ ERA II · ROMA
  {
    era: 'ERA II · ROMA', num: 1, name: 'Las Puertas de Roma', build: 'rome',
    spawn: [0, 2], wallStart: -9, wallMax: 100, closed: [0, 1], open: [2],
    zones: [
      { trigger: 17, wallStop: -4, gate: 0, waves: [[{ k: 'legionary', x: -3, z: 29 }, { k: 'legionary', x: 3.5, z: 33 }]] },
      {
        trigger: 54, wallStop: 46, gate: -1,
        waves: [
          [{ k: 'legionary', x: -3, z: 66 }, { k: 'spearman', x: 3, z: 68 }, { k: 'brute', x: 0, z: 74 }],
          [{ k: 'spearman', x: -3.5, z: 84 }, { k: 'retiarius', x: 0, z: 80 }, { k: 'legionary', x: 3.5, z: 86 }, { k: 'spearman', x: 0, z: 92 }],
        ],
      },
    ],
    titles: [{ z: 46, text: 'VÍA DEL MERCADO' }],
    cams: [{ z: -99, off: [3.2, 4.4, -7.2] }, { z: 44, off: [0, 5.8, -8.2] }],
    portal: [0, 100], bossCenter: [0, 80],
    reinforce: [],
    sky: SKY_ROME,
    intro: 'Roma, año 80. Los legionarios atrapados en la brecha no te dejarán pasar.',
    outro: 'La Vía del Mercado está despejada. El anfiteatro espera.',
  },
  {
    era: 'ERA II · ROMA', num: 2, name: 'El Anfiteatro', build: 'rome',
    spawn: [0, 100], wallStart: 90, wallMax: 112, closed: [], open: [0, 1, 2],
    zones: [
      { trigger: 129, wallStop: 112, gate: -1, trap: 2, waves: [[{ k: 'centurion', x: 0, z: 160 }, { k: 'retiarius', x: -6, z: 155 }, { k: 'retiarius', x: 6, z: 155 }]] },
    ],
    titles: [{ z: 114, text: 'EL ANFITEATRO' }],
    cams: [{ z: -99, off: [0, 5.8, -8.2] }, { z: 112, off: [0, 3.6, -6.5] }, { z: 126, off: [0, 9.0, -10.5] }],
    portal: [0, 152], bossCenter: [0, 150],
    reinforce: [{ k: 'brute', x: -12, z: 158 }, { k: 'spearman', x: 12, z: 158 }],
    sky: SKY_ROME,
    intro: 'Recarga el flujo en el manantial antes de entrar en la arena.',
    outro: 'Has sellado la brecha de Roma.<br><i>Próxima era: el Japón feudal…</i>',
  },
];
