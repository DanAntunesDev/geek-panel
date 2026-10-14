import { DEVICE_PALETTE } from "../../shared/deviceConstants.js";

const PALETTE_RGB = DEVICE_PALETTE.map((hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff] as const;
});

const lookup = new Map<number, number>(PALETTE_RGB.map(([r, g, b], index) => [(r << 16) | (g << 8) | b, index]));

function nearest(r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  PALETTE_RGB.forEach(([pr, pg, pb], index) => {
    const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

// Converte os pixels do canvas em índices da paleta do aparelho. Cor fora da paleta vira a mais próxima.
export function toIndexed(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let pixel = 0; pixel < out.length; pixel += 1) {
    const r = rgba[pixel * 4];
    const g = rgba[pixel * 4 + 1];
    const b = rgba[pixel * 4 + 2];
    const key = (r << 16) | (g << 8) | b;
    let index = lookup.get(key);
    if (index === undefined) {
      index = nearest(r, g, b);
      lookup.set(key, index);
    }
    out[pixel] = index;
  }
  return out;
}
