// Desenha o ícone do app em pixel art (32x32) e grava os PNGs ampliados em assets/pixel.
// Uso: node scripts/make-icons.mjs
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 32;
const C = {
  ink: [0x1c, 0x1c, 0x1c],
  mid: [0x78, 0x78, 0x77],
  surface: [0xd9, 0xd7, 0xd2],
  bg: [0xf7, 0xf6, 0xf3],
  accent: [0xe8, 0x36, 0x8f],
  shade: [0xa5, 0x27, 0x6a],
};

const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
const set = (x, y, color) => {
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) grid[y][x] = color;
};
const disc = (cx, cy, r, color) => {
  for (let y = -r; y <= r; y += 1) for (let x = -r; x <= r; x += 1) if (x * x + y * y <= r * r + r * 0.6) set(cx + x, cy + y, color);
};
const ring = (cx, cy, r, color) => {
  for (let y = -r - 1; y <= r + 1; y += 1) {
    for (let x = -r - 1; x <= r + 1; x += 1) {
      const d = x * x + y * y;
      if (d <= r * r + r * 0.6 && d > (r - 1) * (r - 1) + (r - 1) * 0.6) set(cx + x, cy + y, color);
    }
  }
};
const line = (x0, y0, x1, y1, color, thick = 1) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    for (let dy = 0; dy < thick; dy += 1) for (let dx = 0; dx < thick; dx += 1) set(x + dx, y + dy, color);
  }
};

// caixa arredondada: borda escura, fundo claro, brilho em cima e sombra embaixo
const corner = (x, y) => (x < 3 && y < 3 && x + y < 2) || (x > 28 && y < 3 && 31 - x + y < 2) || (x < 3 && y > 28 && x + 31 - y < 2) || (x > 28 && y > 28 && 31 - x + 31 - y < 2);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (corner(x, y)) continue;
    const edge = x === 0 || y === 0 || x === 31 || y === 31;
    set(x, y, edge ? C.ink : y === 1 || x === 1 ? C.bg : y === 30 || x === 30 ? C.mid : C.surface);
  }
}

// disco de vinil com sulcos e selo magenta
const cx = 14;
const cy = 17;
disc(cx, cy, 12, C.ink);
ring(cx, cy, 10, C.mid);
ring(cx, cy, 8, C.mid);
disc(cx, cy, 5, C.accent);
for (const [x, y] of [[-3, -3], [-2, -4], [-4, -2]]) set(cx + x, cy + y, C.bg);
ring(cx, cy, 5, C.shade);
disc(cx, cy, 1, C.bg);
// reflexo do disco
for (const [x, y] of [[-8, -5], [-7, -6], [-6, -7], [7, 5], [6, 6], [5, 7]]) set(cx + x, cy + y, C.surface);

// braço da agulha, sobre o disco
disc(26, 6, 3, C.ink);
disc(26, 6, 1, C.surface);
line(25, 8, 20, 18, C.ink, 2);
line(20, 18, 19, 21, C.ink, 2);
set(21, 17, C.bg);
set(22, 14, C.mid);

const rgba = (scale) => {
  const side = SIZE * scale;
  const out = Buffer.alloc(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const color = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      const at = (y * side + x) * 4;
      if (color) out.set([...color, 255], at);
    }
  }
  return { side, data: out };
};

function png({ side, data }) {
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((side * 4 + 1) * side);
  for (let y = 0; y < side; y += 1) data.copy(rows, y * (side * 4 + 1) + 1, y * side * 4, (y + 1) * side * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

for (const [name, scale] of [["tray.png", 1], ["tray@2x.png", 2], ["icon.png", 8], ["icon-512.png", 16]]) {
  writeFileSync(`assets/pixel/${name}`, png(rgba(scale)));
}
console.log("ícones gravados em assets/pixel");
