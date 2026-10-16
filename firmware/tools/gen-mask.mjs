// Desenha a máscara (estilo V de Vingança) em pixel art e grava firmware/src/rain_mask.h.
// Uso: node firmware/tools/gen-mask.mjs [arquivo-de-prévia.png]
import { crc32, deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 120;
// índices da paleta de espera: 0 branco, 1 cinza claro, 2 cinza, 3 preto
const WHITE = 0;
const LIGHT = 1;
const GRAY = 2;
const BLACK = 3;
const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(BLACK));
const face = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const set = (x, y, color) => {
  if (inside(x, y)) grid[y][x] = color;
};

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

function stroke(points, thick, color) {
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s += 1) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (let dy = 0; dy < thick; dy += 1) for (let dx = 0; dx < thick; dx += 1) set(x - Math.floor(thick / 2) + dx, y - Math.floor(thick / 2) + dy, color);
    }
  }
}

const mirror = (points) => points.map(([x, y]) => [120 - x, y]);
const both = (points, thick, color) => {
  stroke(points, thick, color);
  stroke(mirror(points), thick, color);
};

// rosto: parte de cima redonda e queixo fino
const paintFace = (x, y) => {
  if (inside(x, y)) face[y][x] = true;
};
ellipse(60, 33, 30, 31, paintFace);
polygon([[30, 36], [90, 36], [89, 52], [84, 66], [75, 77], [66, 84], [60, 87], [54, 84], [45, 77], [36, 66], [31, 52]], paintFace);

// preenchimento: xadrez de cinza e preto, para parecer um tom escuro e deixar a chuva aparecer
for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) if (face[y][x]) grid[y][x] = (x + y) % 2 === 0 ? GRAY : BLACK;

// luzes: testa, maçãs do rosto, ponte do nariz
ellipse(60, 15, 15, 5, (x, y) => face[y][x] && set(x, y, (x + y) % 2 === 0 ? LIGHT : GRAY));
ellipse(40, 54, 9, 7, (x, y) => face[y][x] && set(x, y, (x + y) % 2 === 0 ? LIGHT : GRAY));
ellipse(80, 54, 9, 7, (x, y) => face[y][x] && set(x, y, (x + y) % 2 === 0 ? LIGHT : GRAY));
stroke([[60, 36], [59, 50], [58, 58]], 2, LIGHT);

// sobrancelhas grossas e levantadas nas pontas de dentro
both([[34, 28], [41, 20], [50, 19], [57, 24]], 1, LIGHT);
both([[34, 31], [41, 23], [50, 22], [57, 27]], 4, BLACK);
// olhos estreitos, com a pálpebra e a bolsa embaixo
both([[37, 36], [45, 33], [54, 36]], 2, BLACK);
ellipse(45, 37, 7, 2, (x, y) => set(x, y, BLACK));
ellipse(75, 37, 7, 2, (x, y) => set(x, y, BLACK));
both([[39, 42], [45, 44], [52, 42]], 1, GRAY);

// nariz: sombra embaixo e narinas
stroke([[55, 61], [60, 63], [65, 61]], 2, BLACK);
ellipse(56, 62, 1, 1, (x, y) => set(x, y, BLACK));
ellipse(64, 62, 1, 1, (x, y) => set(x, y, BLACK));

// bigode fino, com as pontas viradas para cima
both([[60, 71], [52, 73], [43, 71], [37, 64], [35, 58]], 1, LIGHT);
both([[60, 68], [52, 70], [43, 68], [37, 61], [35, 55]], 3, BLACK);
// sorriso largo e o lábio de baixo
stroke([[44, 73], [52, 77], [60, 78], [68, 77], [76, 73]], 2, BLACK);
stroke([[49, 80], [60, 82], [71, 80]], 1, LIGHT);
// cavanhaque
polygon([[55, 83], [65, 83], [62, 92], [58, 92]], (x, y) => set(x, y, LIGHT));
polygon([[56, 83], [64, 83], [61, 91], [59, 91]], (x, y) => set(x, y, BLACK));

// contorno cinza em volta do rosto
const edge = [];
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (!face[y][x]) continue;
    if (!face[y - 1]?.[x] || !face[y + 1]?.[x] || !face[y][x - 1] || !face[y][x + 1]) edge.push([x, y]);
  }
}
for (const [x, y] of edge) grid[y][x] = LIGHT;

// quadro de 4 bits por pixel, dois pixels por byte (o primeiro nos 4 bits de baixo)
const bytes = [];
for (let at = 0; at < SIZE * SIZE; at += 2) {
  const first = grid[Math.floor(at / SIZE)][at % SIZE];
  const second = grid[Math.floor((at + 1) / SIZE)][(at + 1) % SIZE];
  bytes.push(first | (second << 4));
}
const rows = bytes.reduce((out, value, index) => out + (index % 24 === 0 ? "\n  " : " ") + value + ",", "");
writeFileSync(
  "firmware/src/rain_mask.h",
  `// Gerado por firmware/tools/gen-mask.mjs. Não edite à mão.
// Máscara ao fundo da tela de espera: 120x120, 4 bits por pixel (paleta de espera).
#pragma once
#include <stdint.h>

static const uint8_t RAIN_MASK[${bytes.length}] PROGMEM = {${rows}
};
`,
);

const preview = process.argv[2];
if (preview) {
  const tones = [[247, 246, 243], [217, 215, 210], [120, 120, 119], [28, 28, 28]];
  const scale = 4;
  const side = SIZE * scale;
  const raw = Buffer.alloc((side * 3 + 1) * side);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) raw.set(tones[grid[Math.floor(y / scale)][Math.floor(x / scale)]], y * (side * 3 + 1) + 1 + x * 3);
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
