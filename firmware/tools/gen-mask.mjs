// Desenha a máscara da tela de espera em pixel art e grava firmware/src/rain_mask.h.
// Uso: node firmware/tools/gen-mask.mjs [arquivo-de-prévia.png]
import { crc32, deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 120;
// índices da paleta de espera: 0 branco, 1 cinza claro, 2 cinza, 3 preto, 4 vermelho, 5 vermelho escuro; 15 = transparente
const WHITE = 0;
const LIGHT = 1;
const GRAY = 2;
const BLACK = 3;
const RED = 4;
const DARK_RED = 5;
const CLEAR = 15;
const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(CLEAR));
const face = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const set = (x, y, color) => {
  if (inside(x, y)) grid[y][x] = color;
};
const onFace = (color) => (x, y) => inside(x, y) && face[y][x] && set(x, y, color);

function ellipse(cx, cy, rx, ry, paint) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) paint(x, y);
    }
  }
}

function polygon(points, paint) {
  const ys = points.map((p) => p[1]);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) {
    const cuts = [];
    points.forEach(([x0, y0], index) => {
      const [x1, y1] = points[(index + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) cuts.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    });
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2) for (let x = Math.round(cuts[i]); x <= Math.round(cuts[i + 1]); x += 1) paint(x, y);
  }
}

function stroke(points, thick, color, paint = (x, y) => set(x, y, color)) {
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s += 1) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (let dy = 0; dy < thick; dy += 1) for (let dx = 0; dx < thick; dx += 1) paint(x - Math.floor(thick / 2) + dx, y - Math.floor(thick / 2) + dy);
    }
  }
}

const mirror = (points) => points.map(([x, y]) => [120 - x, y]);
const both = (points, thick, color) => {
  stroke(points, thick, color);
  stroke(mirror(points), thick, color);
};

// rosto: oval alto, de queixo arredondado
const paintFace = (x, y) => {
  if (inside(x, y)) face[y][x] = true;
};
ellipse(60, 42, 29, 30, paintFace);
polygon([[31, 44], [89, 44], [88, 62], [83, 77], [74, 91], [66, 98], [60, 100], [54, 98], [46, 91], [37, 77], [32, 62]], paintFace);
for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) if (face[y][x]) grid[y][x] = WHITE;

// rachaduras finas em cinza, sempre as mesmas (sequência fixa)
let seed = 11;
const random = (limit) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % limit;
};
for (const [x0, y0, dx, dy] of [[34, 30, 1, 1], [86, 34, -1, 1], [40, 90, 1, -1], [80, 86, -1, -1], [60, 14, 0, 1], [88, 60, -1, 0], [32, 62, 1, 0]]) {
  let x = x0;
  let y = y0;
  for (let step = 0; step < 9 + random(6); step += 1) {
    if (inside(x, y) && face[y][x]) grid[y][x] = LIGHT;
    x += dx + (random(3) - 1);
    y += dy + (random(3) - 1);
  }
}

// sobrancelhas vermelhas, grossas e arqueadas
both([[34, 40], [39, 33], [47, 30], [56, 33]], 4, RED);
both([[34, 36], [39, 29], [47, 26], [56, 29]], 1, DARK_RED);
// olhos: amêndoa branca com contorno preto, pupila e um traço preto vertical
for (const cx of [46, 74]) {
  ellipse(cx, 47, 8, 3, (x, y) => set(x, y, BLACK));
  ellipse(cx, 47, 7, 2, (x, y) => set(x, y, WHITE));
  ellipse(cx, 47, 3, 2, (x, y) => set(x, y, BLACK));
}
both([[41, 37], [39, 46], [40, 55]], 2, BLACK);
// nariz: narinas e ponte
both([[56, 52], [55, 62]], 1, GRAY);
stroke([[53, 65], [56, 68], [60, 67], [64, 68], [67, 65]], 2, BLACK);

// sorriso vermelho largo, com uma linha preta no meio
for (let x = 35; x <= 85; x += 1) {
  const t = (x - 60) / 25;
  const middle = 72 + 13 * (1 - t * t);
  const half = 4.5 - 2 * Math.abs(t) * Math.abs(t);
  for (let y = Math.round(middle - half); y <= Math.round(middle + half); y += 1) onFace(RED)(x, y);
  onFace(BLACK)(x, Math.round(middle));
}

// contorno cinza em volta do rosto
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (!face[y][x]) continue;
    if (!face[y - 1]?.[x] || !face[y + 1]?.[x] || !face[y][x - 1] || !face[y][x + 1]) grid[y][x] = GRAY;
  }
}

// quadro de 4 bits por pixel, dois pixels por byte (o primeiro nos 4 bits de baixo)
const bytes = [];
for (let at = 0; at < SIZE * SIZE; at += 2) {
  bytes.push(grid[Math.floor(at / SIZE)][at % SIZE] | (grid[Math.floor((at + 1) / SIZE)][(at + 1) % SIZE] << 4));
}
const rows = bytes.reduce((out, value, index) => out + (index % 24 === 0 ? "\n  " : " ") + value + ",", "");
writeFileSync(
  "firmware/src/rain_mask.h",
  `// Gerado por firmware/tools/gen-mask.mjs. Não edite à mão.
// Máscara da tela de espera: 120x120, 4 bits por pixel (paleta de espera); o índice 15 é transparente.
#pragma once
#include <stdint.h>

static const uint8_t RAIN_MASK[${bytes.length}] PROGMEM = {${rows}
};
`,
);

const preview = process.argv[2];
if (preview) {
  const tones = [[247, 246, 243], [217, 215, 210], [120, 120, 119], [28, 28, 28], [224, 54, 46], [150, 34, 30]];
  const scale = 4;
  const side = SIZE * scale;
  const raw = Buffer.alloc((side * 3 + 1) * side);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const color = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      raw.set(tones[color] ?? [40, 60, 90], y * (side * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 2, 0, 0, 0], 8);
  writeFileSync(preview, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
console.log(`máscara gerada (${bytes.length} bytes) em firmware/src/rain_mask.h`);
