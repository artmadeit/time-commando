import * as THREE from 'three';

// Texturas procedurales generadas en canvas: color + mapa de relieve.
// Así el juego no depende de assets externos y pesa muy poco.

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

export function rng(seed: number): Rand {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

function grain(ctx: Ctx, size: number, amount: number, r: Rand) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h},${s}%,${l}%)`;
}

function gray(v: number, a = 1) {
  v = Math.max(0, Math.min(255, v | 0));
  return `rgba(${v},${v},${v},${a})`;
}

/** Dibuja en c (color) y h (altura) de forma envolvente (tileable) */
function wrapDraw(size: number, x: number, y: number, w: number, hgt: number, fn: (ox: number, oy: number) => void) {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      if (x + ox + w < 0 || x + ox > size || y + oy + hgt < 0 || y + oy > size) continue;
      fn(ox, oy);
    }
  }
}

function stains(c: Ctx, size: number, r: Rand, count: number, color: string, maxR: number) {
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rad = (0.2 + r()) * maxR;
    wrapDraw(size, x - rad, y - rad, rad * 2, rad * 2, (ox, oy) => {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
}

export interface TexPair { map: THREE.Texture; bump: THREE.Texture }

function finish(color: HTMLCanvasElement, height: HTMLCanvasElement): TexPair {
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(height);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
  }
  return { map, bump };
}

const S = 512;

/** Bloques de piedra / sillería */
export function stoneBlocks(hue: number, sat: number, light: number, rows: number, cols: number, seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = hsl(hue, sat * 0.6, light * 0.55);
  c.fillRect(0, 0, S, S);
  h.fillStyle = gray(30);
  h.fillRect(0, 0, S, S);
  const bh = S / rows, bw = S / cols, m = 3;
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + off + (r() - 0.5) * 4;
      const y = row * bh;
      const l = light + (r() - 0.5) * 12;
      c.fillStyle = hsl(hue + (r() - 0.5) * 8, sat, l);
      c.fillRect(x + m, y + m, bw - m * 2, bh - m * 2);
      const g = h.createLinearGradient(x, y, x, y + bh);
      const base = 150 + r() * 60;
      g.addColorStop(0, gray(base + 30));
      g.addColorStop(0.15, gray(base));
      g.addColorStop(0.85, gray(base - 10));
      g.addColorStop(1, gray(base - 50));
      h.fillStyle = g;
      h.fillRect(x + m, y + m, bw - m * 2, bh - m * 2);
      // desgaste en esquinas
      if (r() < 0.4) {
        c.fillStyle = hsl(hue, sat * 0.5, l - 18);
        c.beginPath();
        c.arc(x + m + r() * bw, y + m + r() * bh, 3 + r() * 8, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  stains(c, S, r, 30, 'rgba(40,25,10,0.18)', 60);
  stains(c, S, r, 20, 'rgba(255,240,210,0.12)', 50);
  grain(c, S, 22, r);
  grain(h, S, 30, r);
  return finish(cc, hc);
}

/** Adoquines irregulares */
export function cobbles(seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = '#3a3128';
  c.fillRect(0, 0, S, S);
  h.fillStyle = gray(20);
  h.fillRect(0, 0, S, S);
  const n = 9;
  const cell = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = (i + 0.5) * cell + (r() - 0.5) * cell * 0.25;
      const cy = (j + 0.5) * cell + (r() - 0.5) * cell * 0.25;
      const rx = cell * (0.4 + r() * 0.08), ry = cell * (0.38 + r() * 0.08), rot = r() * Math.PI;
      const l = 38 + r() * 18;
      const hue = 25 + r() * 15;
      wrapDraw(S, cx - cell, cy - cell, cell * 2, cell * 2, (ox, oy) => {
        c.fillStyle = hsl(hue, 14, l);
        c.beginPath();
        c.ellipse(cx + ox, cy + oy, rx, ry, rot, 0, Math.PI * 2);
        c.fill();
        const g = h.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rx);
        g.addColorStop(0, gray(230));
        g.addColorStop(0.7, gray(170));
        g.addColorStop(1, gray(40));
        h.fillStyle = g;
        h.beginPath();
        h.ellipse(cx + ox, cy + oy, rx, ry, rot, 0, Math.PI * 2);
        h.fill();
      });
    }
  }
  stains(c, S, r, 25, 'rgba(20,15,5,0.25)', 70);
  grain(c, S, 26, r);
  grain(h, S, 20, r);
  return finish(cc, hc);
}

/** Estuco / revoque con manchas y grietas */
export function plaster(hue: number, sat: number, light: number, seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = hsl(hue, sat, light);
  c.fillRect(0, 0, S, S);
  h.fillStyle = gray(140);
  h.fillRect(0, 0, S, S);
  stains(c, S, r, 40, `hsla(${hue},${sat}%,${light - 15}%,0.25)`, 90);
  stains(c, S, r, 30, `hsla(${hue},${sat}%,${light + 12}%,0.25)`, 70);
  stains(h, S, r, 40, 'rgba(255,255,255,0.15)', 50);
  // desconchones que muestran ladrillo
  for (let i = 0; i < 4; i++) {
    const x = r() * S, y = r() * S, w = 20 + r() * 50, hh = 12 + r() * 30;
    c.fillStyle = hsl(12, 45, 38);
    c.fillRect(x, y, w, hh);
    c.strokeStyle = hsl(15, 20, 60);
    for (let k = 0; k < hh; k += 8) {
      c.beginPath();
      c.moveTo(x, y + k);
      c.lineTo(x + w, y + k);
      c.stroke();
    }
    h.fillStyle = gray(70);
    h.fillRect(x, y, w, hh);
  }
  // grietas
  c.strokeStyle = `hsla(${hue},20%,${light - 30}%,0.6)`;
  h.strokeStyle = gray(40);
  for (let i = 0; i < 6; i++) {
    let x = r() * S, y = r() * S;
    c.beginPath(); h.beginPath();
    c.moveTo(x, y); h.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (r() - 0.5) * 30;
      y += r() * 20;
      c.lineTo(x, y); h.lineTo(x, y);
    }
    c.stroke(); h.stroke();
  }
  grain(c, S, 14, r);
  grain(h, S, 40, r);
  return finish(cc, hc);
}

/** Tejas romanas (tegulae) */
export function roofTiles(seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = '#5a2414';
  c.fillRect(0, 0, S, S);
  h.fillStyle = gray(30);
  h.fillRect(0, 0, S, S);
  const cols = 8, rows = 10;
  const w = S / cols, hh = S / rows;
  for (let j = rows; j >= -1; j--) {
    for (let i = 0; i < cols; i++) {
      const x = i * w + (j % 2 ? w / 2 : 0);
      const y = j * hh;
      const l = 34 + r() * 14;
      wrapDraw(S, x, y, w, hh * 1.3, (ox, oy) => {
        const g = c.createLinearGradient(x + ox, 0, x + ox + w, 0);
        g.addColorStop(0, hsl(14, 55, l - 12));
        g.addColorStop(0.5, hsl(16, 60, l + 6));
        g.addColorStop(1, hsl(14, 55, l - 12));
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(x + ox + w / 2, y + oy + hh * 0.6, w / 2 - 1, hh * 0.7, 0, 0, Math.PI * 2);
        c.fill();
        const gh = h.createLinearGradient(x + ox, 0, x + ox + w, 0);
        gh.addColorStop(0, gray(60));
        gh.addColorStop(0.5, gray(240));
        gh.addColorStop(1, gray(60));
        h.fillStyle = gh;
        h.beginPath();
        h.ellipse(x + ox + w / 2, y + oy + hh * 0.6, w / 2 - 1, hh * 0.7, 0, 0, Math.PI * 2);
        h.fill();
      });
    }
  }
  stains(c, S, r, 25, 'rgba(30,40,20,0.25)', 60);
  grain(c, S, 20, r);
  return finish(cc, hc);
}

/** Arena / tierra */
export function sand(hue: number, sat: number, light: number, seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = hsl(hue, sat, light);
  c.fillRect(0, 0, S, S);
  h.fillStyle = gray(128);
  h.fillRect(0, 0, S, S);
  stains(c, S, r, 60, `hsla(${hue},${sat}%,${light - 12}%,0.3)`, 80);
  stains(c, S, r, 40, `hsla(${hue + 5},${sat}%,${light + 10}%,0.3)`, 60);
  stains(h, S, r, 80, 'rgba(255,255,255,0.12)', 40);
  stains(h, S, r, 80, 'rgba(0,0,0,0.12)', 40);
  // piedrecitas
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = 1 + r() * 3.5;
    c.fillStyle = hsl(hue + (r() - 0.5) * 20, sat * 0.6, light + (r() - 0.6) * 30);
    c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    h.fillStyle = gray(220);
    h.beginPath(); h.arc(x, y, rad, 0, Math.PI * 2); h.fill();
  }
  grain(c, S, 30, r);
  grain(h, S, 50, r);
  return finish(cc, hc);
}

/** Mármol con vetas */
export function marble(light: number, seed: number, tiles = 0): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = hsl(40, 12, light);
  c.fillRect(0, 0, S, S);
  h.fillStyle = gray(200);
  h.fillRect(0, 0, S, S);
  stains(c, S, r, 30, `hsla(35,15%,${light - 10}%,0.3)`, 90);
  c.filter = 'blur(1.2px)';
  for (let i = 0; i < 14; i++) {
    let x = r() * S, y = r() * S;
    let a = r() * Math.PI * 2;
    c.strokeStyle = `hsla(30,10%,${light - 35 - r() * 15}%,${0.25 + r() * 0.35})`;
    c.lineWidth = 0.6 + r() * 2;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 40; k++) {
      a += (r() - 0.5) * 0.6;
      x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.filter = 'none';
  if (tiles > 0) {
    const t = S / tiles;
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        c.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '120,100,80'},${0.05 + r() * 0.08})`;
        c.fillRect(i * t, j * t, t, t);
      }
    }
    c.strokeStyle = 'rgba(60,50,40,0.55)';
    h.strokeStyle = gray(40);
    c.lineWidth = h.lineWidth = 3;
    for (let i = 0; i <= tiles; i++) {
      for (const ctx of [c, h]) {
        ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * t); ctx.lineTo(S, i * t); ctx.stroke();
      }
    }
  }
  grain(c, S, 8, r);
  grain(h, S, 12, r);
  return finish(cc, hc);
}

/** Tablones de madera */
export function wood(seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  const planks = 6;
  const pw = S / planks;
  for (let i = 0; i < planks; i++) {
    const l = 26 + r() * 10;
    c.fillStyle = hsl(26, 45, l);
    c.fillRect(i * pw, 0, pw, S);
    h.fillStyle = gray(180);
    h.fillRect(i * pw, 0, pw, S);
    for (let k = 0; k < 30; k++) {
      const x = i * pw + r() * pw;
      c.strokeStyle = hsl(24, 40, l - 8 + r() * 6);
      c.lineWidth = 0.5 + r() * 1.5;
      c.beginPath();
      c.moveTo(x, 0);
      c.bezierCurveTo(x + (r() - 0.5) * 8, S * 0.3, x + (r() - 0.5) * 8, S * 0.7, x, S);
      c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(i * pw, 0, 3, S);
    h.fillStyle = gray(20);
    h.fillRect(i * pw, 0, 3, S);
  }
  grain(c, S, 16, r);
  return finish(cc, hc);
}

/** Tela tejida (toldos, banderas) */
export function cloth(hue: number, sat: number, light: number, seed: number, stripes = false): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(256);
  const [hc, h] = makeCanvas(256);
  c.fillStyle = hsl(hue, sat, light);
  c.fillRect(0, 0, 256, 256);
  if (stripes) {
    for (let i = 0; i < 256; i += 64) {
      c.fillStyle = hsl(45, 30, 80);
      c.fillRect(i, 0, 22, 256);
    }
  }
  h.fillStyle = gray(128);
  h.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    h.fillStyle = gray(y % 4 ? 150 : 100);
    h.fillRect(0, y, 256, 1);
  }
  stains(c, 256, r, 20, `hsla(${hue},${sat}%,${light - 15}%,0.3)`, 50);
  grain(c, 256, 18, r);
  const p = finish(cc, hc);
  return p;
}

export function rocky(seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = hsl(32, 14, 52);
  c.fillRect(0, 0, S, S);
  h.fillStyle = gray(128);
  h.fillRect(0, 0, S, S);
  stains(c, S, r, 80, 'rgba(20,15,10,0.25)', 70);
  stains(c, S, r, 80, 'rgba(200,190,170,0.18)', 60);
  stains(h, S, r, 120, 'rgba(255,255,255,0.18)', 50);
  stains(h, S, r, 120, 'rgba(0,0,0,0.18)', 50);
  grain(c, S, 30, r);
  grain(h, S, 60, r);
  return finish(cc, hc);
}

export function repeat(p: TexPair, x: number, y: number): TexPair {
  const map = p.map.clone();
  const bump = p.bump.clone();
  map.repeat.set(x, y);
  bump.repeat.set(x, y);
  map.needsUpdate = bump.needsUpdate = true;
  return { map, bump };
}

/** Pelaje: trazos cortos de pelo */
export function fur(hue: number, sat: number, light: number, seed: number): TexPair {
  const r = rng(seed);
  const [cc, c] = makeCanvas(256);
  const [hc, h] = makeCanvas(256);
  c.fillStyle = hsl(hue, sat, light);
  c.fillRect(0, 0, 256, 256);
  h.fillStyle = gray(128);
  h.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 256, y = r() * 256, len = 4 + r() * 8, a = Math.PI / 2 + (r() - 0.5) * 0.6;
    const l = light + (r() - 0.5) * 22;
    c.strokeStyle = hsl(hue + (r() - 0.5) * 8, sat, l);
    h.strokeStyle = gray(80 + r() * 150);
    c.lineWidth = h.lineWidth = 1 + r();
    for (const ctx of [c, h]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  return finish(cc, hc);
}

/** Lava agrietada: devuelve además un mapa emisivo */
export function lava(seed: number): TexPair & { emissive: THREE.Texture } {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  const [ec, e] = makeCanvas(S);
  const [hc, h] = makeCanvas(S);
  c.fillStyle = '#1a120e';
  c.fillRect(0, 0, S, S);
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);
  h.fillStyle = gray(200);
  h.fillRect(0, 0, S, S);
  stains(c, S, r, 60, 'rgba(60,40,30,0.4)', 70);
  e.filter = 'blur(2px)';
  for (let i = 0; i < 40; i++) {
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    const w = 2 + r() * 5;
    for (const [ctx, col, lw] of [[e, '#ff7a1a', w * 2], [c, '#ff5a10', w], [h, gray(20), w * 1.5]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
    }
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k < 10; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 18; y += Math.sin(a) * 18; pts.push([x, y]); }
    for (const ctx of [e, c, h]) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.stroke();
    }
  }
  e.filter = 'none';
  grain(c, S, 20, r);
  const p = finish(cc, hc);
  const emissive = new THREE.CanvasTexture(ec);
  emissive.colorSpace = THREE.SRGBColorSpace;
  emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
  return { ...p, emissive };
}

/** Pintura rupestre: manos y animales en ocre sobre roca */
export function cavePainting(seed: number): THREE.Texture {
  const r = rng(seed);
  const [cc, c] = makeCanvas(S);
  c.fillStyle = hsl(30, 18, 46);
  c.fillRect(0, 0, S, S);
  stains(c, S, r, 70, 'rgba(30,20,10,0.25)', 80);
  stains(c, S, r, 50, 'rgba(230,210,180,0.15)', 60);
  const ochre = ['rgba(150,50,25,0.85)', 'rgba(110,40,20,0.8)', 'rgba(40,25,20,0.85)'];
  // manos en negativo
  for (let i = 0; i < 7; i++) {
    const x = 40 + r() * (S - 80), y = 40 + r() * 140;
    c.fillStyle = ochre[Math.floor(r() * 2)];
    c.beginPath(); c.ellipse(x, y, 16, 20, 0, 0, Math.PI * 2); c.fill();
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.38;
      c.beginPath(); c.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 26, 5, 11, a + Math.PI / 2, 0, Math.PI * 2); c.fill();
    }
  }
  // animales: cuerpo, patas, cuernos/colmillos
  for (let i = 0; i < 6; i++) {
    const x = 70 + r() * (S - 140), y = 230 + r() * 220, s = 0.7 + r() * 0.6;
    c.fillStyle = c.strokeStyle = ochre[Math.floor(r() * 3)];
    c.lineWidth = 5 * s;
    c.beginPath(); c.ellipse(x, y, 48 * s, 22 * s, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + 50 * s, y - 14 * s, 14 * s, 11 * s, 0.3, 0, Math.PI * 2); c.fill();
    for (const lx of [-30, -14, 18, 34]) { c.beginPath(); c.moveTo(x + lx * s, y + 12 * s); c.lineTo(x + lx * s + 4, y + 46 * s); c.stroke(); }
    c.beginPath(); c.moveTo(x + 58 * s, y - 6 * s); c.quadraticCurveTo(x + 80 * s, y + 4 * s, x + 74 * s, y + 24 * s); c.stroke();
  }
  // cazadores
  for (let i = 0; i < 5; i++) {
    const x = 40 + r() * (S - 80), y = 300 + r() * 180;
    c.strokeStyle = ochre[2];
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y); c.lineTo(x, y + 26); c.moveTo(x, y + 26); c.lineTo(x - 8, y + 44); c.moveTo(x, y + 26); c.lineTo(x + 8, y + 44);
    c.moveTo(x - 10, y + 8); c.lineTo(x + 12, y + 8); c.moveTo(x + 12, y - 16); c.lineTo(x + 12, y + 40);
    c.stroke();
    c.beginPath(); c.arc(x, y - 6, 5, 0, Math.PI * 2); c.stroke();
  }
  grain(c, S, 20, r);
  const t = new THREE.CanvasTexture(cc);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
