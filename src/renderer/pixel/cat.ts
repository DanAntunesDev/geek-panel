import { pixel, rect, sprite, type Ctx } from "./draw.js";
import { PALETTE } from "./palette.js";
import type { PixelGrid } from "./PixelCanvas.js";

// Gato sentado: silhueta em ink com realces em mid.
const HEAD: PixelGrid = [
  "..K.......K..",
  "..KK.....KK..",
  "..KMK...KMK..",
  "..KKKKKKKKK..",
  ".KMKKKKKKKKK.",
  ".KKKKKKKKKKK.",
  "MKKKKKMKKKKKM",
  ".KKKKKKKKKKK.",
  "..KKKKKKKKK..",
];
const BODY: PixelGrid = [".KKKKKKKKKKK.", "KKKKKMKKKKKKK", "KKKKKKKKKKKKK", "KKKMKKKKKMKKK", "KKKKKKKKKKKKK"];
const TAIL: PixelGrid[] = [
  ["....", "....", "....", "..K.", ".KK.", "KK.."],
  ["....", "....", "..KK", "..K.", ".KK.", "KK.."],
  ["...K", "..KK", "..K.", ".KK.", ".K..", "KK.."],
  ["....", "..KK", "..K.", ".KK.", ".K..", "KK.."],
];

export const CAT_WIDTH = 13;
export const CAT_HEIGHT = 14;

interface CatOptions {
  x: number;
  y: number;
  frame: number;
  // Acordado: pisca e balança a cabeça no ritmo. Dormindo: respira, com zZz.
  awake: boolean;
}

export function drawCat(ctx: Ctx, { x, y, frame, awake }: CatOptions): void {
  const colors = { K: PALETTE.ink, M: PALETTE.mid };

  const beat = awake && Math.floor(frame / 3) % 2 === 0 ? 1 : 0;
  const breath = !awake && Math.floor(frame / 12) % 2 === 0 ? 1 : 0;
  const headY = y + beat + breath;

  sprite(ctx, TAIL[Math.floor(frame / (awake ? 2 : 8)) % TAIL.length], colors, x + 13, y + 9);
  sprite(ctx, BODY, colors, x, y + 9);
  sprite(ctx, HEAD, colors, x, headY);

  if (awake && frame % 47 >= 2) {
    pixel(ctx, x + 4, headY + 5, PALETTE.bg);
    pixel(ctx, x + 8, headY + 5, PALETTE.bg);
  } else if (!awake) {
    rect(ctx, x + 3, headY + 5, 2, 1, PALETTE.mid);
    rect(ctx, x + 8, headY + 5, 2, 1, PALETTE.mid);
  }
  // a orelha mexe de vez em quando
  if (frame % 61 < 2) pixel(ctx, x + 10, headY, PALETTE.ink);

  if (!awake) {
    for (let index = 0; index < 2; index += 1) {
      const t = (Math.floor(frame / 2) + index * 8) % 16;
      if (t > 13) continue;
      sprite(ctx, ["KKK", ".K.", "KKK"], { K: PALETTE.mid }, x + 11 + (t % 4 < 2 ? 0 : 1), y - 2 - Math.floor(t / 2));
    }
  }
}
