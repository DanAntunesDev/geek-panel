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
ellipse(60, 34, 31, 31, paintFace);
polygon([[29, 36], [91, 36], [90, 52], [85, 65], [76, 76], [67, 83], [60, 86], [53, 83], [44, 76], [35, 65], [30, 52]], paintFace);

// preenchimento cinza liso; a borda ganha um xadrez escuro para dar volume
const eroded = (depth) => {
  let current = face.map((row) => [...row]);
  for (let step = 0; step < depth; step += 1) {
    current = current.map((row, y) => row.map((on, x) => on && face[y]?.[x] && current[y - 1]?.[x] && current[y + 1]?.[x] && current[y][x - 1] && current[y][x + 1]));
  }
  return current;
};
const core = eroded(5);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (face[y][x]) grid[y][x] = core[y][x] ? GRAY : (x + y) % 2 === 0 ? GRAY : BLACK;
  }
}

// luzes: testa, maçãs do rosto (com um brilho branco) e ponte do nariz
ellipse(60, 13, 14, 4, (x, y) => face[y][x] && set(x, y, LIGHT));
for (const cx of [40, 80]) {
  ellipse(cx, 53, 8, 6, (x, y) => set(x, y, LIGHT));
  stroke([[cx - 4, 50], [cx - 2, 48]], 2, WHITE);
}
stroke([[60, 38], [59, 50], [58, 59]], 2, LIGHT);

// sobrancelhas finas e muito arqueadas, com um fio claro por cima
both([[32, 26], [39, 17], [49, 15], [57, 20]], 1, LIGHT);
both([[32, 29], [39, 20], [49, 18], [57, 23]], 4, BLACK);
// olhos: uma fenda estreita, com a pálpebra clara em cima
both([[36, 33], [46, 30], [55, 33]], 1, LIGHT);
polygon([[36, 37], [46, 33], [55, 37], [46, 40]], (x, y) => set(x, y, BLACK));
polygon([[84, 37], [74, 33], [65, 37], [74, 40]], (x, y) => set(x, y, BLACK));

// nariz: narinas escuras
stroke([[54, 62], [57, 65], [60, 64], [63, 65], [66, 62]], 2, BLACK);

// bigode grande, com as pontas virando para cima até as bochechas
both([[60, 71], [51, 73], [43, 71], [36, 64], [32, 54], [33, 46]], 1, LIGHT);
both([[60, 68], [51, 70], [43, 68], [37, 61], [35, 52], [36, 46]], 4, BLACK);
// sorriso largo e o lábio de baixo
stroke([[41, 74], [50, 78], [60, 79], [70, 78], [79, 74]], 3, BLACK);
stroke([[48, 81], [60, 83], [72, 81]], 1, LIGHT);
// cavanhaque
polygon([[54, 82], [66, 82], [63, 92], [57, 92]], (x, y) => set(x, y, LIGHT));
polygon([[56, 83], [64, 83], [62, 90], [58, 90]], (x, y) => set(x, y, BLACK));

// contorno claro em volta do rosto
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
