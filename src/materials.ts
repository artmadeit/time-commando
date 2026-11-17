import * as THREE from 'three';
import * as T from './textures';

export type Mats = ReturnType<typeof makeMaterials>;

const cache = new Map<string, THREE.MeshStandardMaterial>();
function std(p: T.TexPair, rx: number, ry: number, opts: THREE.MeshStandardMaterialParameters = {}, bumpScale = 2) {
  const key = p.map.uuid + ':' + rx.toFixed(2) + ':' + ry.toFixed(2);
  const hit = cache.get(key);
  if (hit) return hit;
  const m = stdNew(p, rx, ry, opts, bumpScale);
  cache.set(key, m);
  return m;
}
function stdNew(p: T.TexPair, rx: number, ry: number, opts: THREE.MeshStandardMaterialParameters, bumpScale: number) {
  const t = T.repeat(p, rx, ry);
  return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale, roughness: 0.9, metalness: 0, ...opts });
}

export function makeMaterials() {
  const sandstoneT = T.stoneBlocks(36, 32, 62, 6, 3, 11);
  const darkStoneT = T.stoneBlocks(30, 12, 44, 5, 3, 12);
  const ochre = T.plaster(34, 55, 62, 21);
  const cream = T.plaster(40, 35, 76, 22);
  const terra = T.plaster(14, 45, 52, 23);
  const cob = T.cobbles(31);
  const marbleT = T.marble(72, 41);
  const marbleFloorT = T.marble(68, 42, 4);
  const roofT = T.roofTiles(51);
  const sandT = T.sand(34, 38, 58, 61);
  const dirtT = T.sand(30, 28, 42, 62);
  const woodT = T.wood(71);
  const rockT = T.rocky(81);

  return {
    sandstone: (rx = 1, ry = 1) => std(sandstoneT, rx, ry, {}, 3),
    darkStone: (rx = 1, ry = 1) => std(darkStoneT, rx, ry, {}, 3),
    ochre: (rx = 1, ry = 1) => std(ochre, rx, ry, {}, 1.5),
    cream: (rx = 1, ry = 1) => std(cream, rx, ry, {}, 1.5),
    terra: (rx = 1, ry = 1) => std(terra, rx, ry, {}, 1.5),
    cobble: (rx = 1, ry = 1) => std(cob, rx, ry, { roughness: 0.85 }, 4),
    marble: (rx = 1, ry = 1) => std(marbleT, rx, ry, { roughness: 0.35 }, 0.6),
    marbleFloor: (rx = 1, ry = 1) => std(marbleFloorT, rx, ry, { roughness: 0.3 }, 1),
    roof: (rx = 1, ry = 1) => std(roofT, rx, ry, { roughness: 0.75 }, 4),
    sand: (rx = 1, ry = 1) => std(sandT, rx, ry, { roughness: 1 }, 2),
    dirt: (rx = 1, ry = 1) => std(dirtT, rx, ry, { roughness: 1 }, 2),
    wood: (rx = 1, ry = 1) => std(woodT, rx, ry, { roughness: 0.8 }, 1.5),
    rock: (rx = 1, ry = 1) => std(rockT, rx, ry, { roughness: 0.95 }, 4),
    cloth: (hue: number, sat: number, light: number, stripes = false) => {
      const p = T.cloth(hue, sat, light, (hue * 7 + light) | 0, stripes);
      return new THREE.MeshStandardMaterial({ map: p.map, bumpMap: p.bump, bumpScale: 1, roughness: 0.95, side: THREE.DoubleSide });
    },
    bronze: new THREE.MeshStandardMaterial({ color: 0xb37a3c, metalness: 1, roughness: 0.32 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe8b94a, metalness: 1, roughness: 0.25 }),
    iron: new THREE.MeshStandardMaterial({ color: 0xb4b9c0, metalness: 1, roughness: 0.28 }),
    darkIron: new THREE.MeshStandardMaterial({ color: 0x3b3e44, metalness: 0.9, roughness: 0.45 }),
    voidDark: new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x24371f, roughness: 0.9, flatShading: true }),
    grass: new THREE.MeshStandardMaterial({ color: 0x5d6a32, roughness: 1, flatShading: true }),
    hills: new THREE.MeshStandardMaterial({ color: 0x7a7448, roughness: 1, flatShading: true }),
    water: new THREE.MeshStandardMaterial({ color: 0x2a6a78, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffa040 }),
  };
}
