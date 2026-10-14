import * as zlib from "node:zlib";
import { DEVICE_PALETTE, FRAME_SIZE, SCALE } from "../src/shared/deviceConstants.js";

// Quadro indexado (120x120) vira PNG ampliado 2x, como aparece no aparelho.
export function png(pixels: Uint8Array): Buffer {
  const size = FRAME_SIZE * SCALE;
  const rgb = DEVICE_PALETTE.map((hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)));
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x += 1) {
      const color = rgb[pixels[Math.floor(y / SCALE) * FRAME_SIZE + Math.floor(x / SCALE)]];
      raw.set(color, row + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
