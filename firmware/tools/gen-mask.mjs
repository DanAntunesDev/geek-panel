// Desenha a máscara da tela de espera em pixel art e grava firmware/src/rain_mask.h e src/shared/waitingMask.ts.
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

// As medidas vêm da imagem de referência (1000x1000, rosto de x 355 a 645 e y 285 a 715): X() e Y()
// levam esses pontos para a grade de 120x120, com o rosto em 60 de largura e 90 de altura.
const X = (rx) => 30 + (rx - 355) * (60 / 290);
const Y = (ry) => 11 + (ry - 285) * (90 / 430);
const map = (points) => points.map(([x, y]) => [Math.round(X(x)), Math.round(Y(y))]);
const mirrored = (points) => points.map(([x, y]) => [1000 - x, y]);
const drawBoth = (points, thick, color) => {
  stroke(map(points), thick, color);
  stroke(map(mirrored(points)), thick, color);
};
const ovalBoth = (cx, cy, rx, ry, color) => {
  ellipse(X(cx), Y(cy), rx * (60 / 290), ry * (90 / 430), (x, y) => set(x, y, color));
  ellipse(X(1000 - cx), Y(cy), rx * (60 / 290), ry * (90 / 430), (x, y) => set(x, y, color));
};

// rosto: oval em formato de ovo, com o queixo afinando
const half = [[500, 285], [455, 291], [412, 308], [380, 338], [362, 380], [357, 430], [358, 490], [364, 535], [376, 575], [392, 620], [414, 658], [445, 690], [478, 708], [500, 715]];
polygon(map([...half, ...[...half].reverse().map(([x, y]) => [1000 - x, y])]), (x, y) => inside(x, y) && (face[y][x] = true));
for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) if (face[y][x]) grid[y][x] = WHITE;

// riscos e falhas na pintura, em cinza claro, sempre os mesmos (sequência fixa)
let seed = 7;
const random = (limit) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % limit;
};
for (const [rx, ry, dx, dy] of [[392, 340, 1, 1], [610, 350, -1, 1], [380, 470, 1, 0], [615, 440, -1, 1], [450, 330, 0, 1], [540, 330, 1, 1], [420, 640, 1, -1], [585, 625, -1, -1]]) {
  let x = X(rx);
  let y = Y(ry);
  for (let step = 0; step < 6 + random(6); step += 1) {
    if (inside(Math.round(x), Math.round(y)) && face[Math.round(y)][Math.round(x)]) grid[Math.round(y)][Math.round(x)] = LIGHT;
    x += dx + (random(3) - 1) * 0.6;
    y += dy + (random(3) - 1) * 0.6;
  }
}

// sobrancelhas vermelhas: dois arcos curtos e grossos no alto da testa
drawBoth([[382, 408], [398, 394], [424, 388], [450, 393], [468, 406]], 3, RED);
// olhos: aro vermelho em volta de uma fenda preta
ovalBoth(437, 490, 38, 17, RED);
ovalBoth(437, 490, 30, 10, BLACK);
// cílios curtos, saindo do canto de fora
drawBoth([[400, 484], [376, 478]], 1, RED);
drawBoth([[398, 493], [372, 496]], 1, RED);
drawBoth([[402, 502], [380, 512]], 1, RED);
// arco preto em cima de cada olho e o traço vertical que atravessa o olho
drawBoth([[376, 436], [398, 427], [424, 424], [452, 432], [480, 454]], 2, BLACK);
drawBoth([[422, 428], [421, 490], [420, 548]], 2, BLACK);

// nariz: contorno fino, ponta e narinas
drawBoth([[484, 520], [474, 556], [470, 578]], 1, GRAY);
stroke(map([[462, 578], [480, 590], [500, 594], [520, 590], [538, 578]]), 2, BLACK);
ovalBoth(478, 574, 8, 6, BLACK);

// sorriso vermelho largo, de bochecha a bochecha, com duas linhas pretas dentro
for (let rx = 380; rx <= 620; rx += 1) {
  const t = (rx - 500) / 120;
  const round = Math.sqrt(Math.max(0, 1 - t ** 8));
  const top = 548 + 50 * (1 - t * t);
  const bottom = 585 + 70 * (1 - t * t);
  const middle = (top + bottom) / 2;
  const reach = ((bottom - top) / 2) * round;
  for (let ry = middle - reach; ry <= middle + reach; ry += 1) {
    const x = Math.round(X(rx));
    const y = Math.round(Y(ry));
    if (inside(x, y) && face[y][x]) grid[y][x] = RED;
  }
}
stroke(map([[402, 590], [430, 615], [470, 632], [500, 636], [530, 632], [570, 615], [598, 590]]), 2, BLACK);
stroke(map([[440, 640], [470, 646], [500, 648], [530, 646], [560, 640]]), 1, BLACK);

// dobras do tecido ao longo do queixo
drawBoth([[385, 595], [402, 640], [430, 678], [470, 704]], 1, GRAY);

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

writeFileSync(
  "src/shared/waitingMask.ts",
  `// Gerado por firmware/tools/gen-mask.mjs. Não edite à mão.
// Máscara da tela de espera (a mesma do firmware): 120x120, 4 bits por pixel, em base64.
export const WAITING_MASK_BASE64 = "${Buffer.from(bytes).toString("base64")}";
`,
);

const preview = process.argv[2];
if (preview) {
  const tones = [[247, 246, 243], [217, 215, 210], [120, 120, 119], [28, 28, 28], [217, 66, 31], [140, 40, 20]];
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
console.log(`máscara gerada (${bytes.length} bytes) em firmware/src/rain_mask.h e src/shared/waitingMask.ts`);
