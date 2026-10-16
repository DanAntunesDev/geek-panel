// Dígitos 5x7 dos relógios; cada ponto vira um bloco de `cell` px

import { rect, type Ctx } from "./draw.js";

const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["0", "0", "1", "0", "1", "0", "0"],
};

export const GLYPH_ROWS = 7;

export function glyphWidth(char: string): number {
  return GLYPHS[char]?.[0].length ?? 0;
}

export interface DigitStyle {
  cell: number;
  gap: number;
  color: string;
  shadow?: string;
  clipTop?: number;
  clipBottom?: number;
}

export function drawDigit(ctx: Ctx, char: string, x: number, y: number, style: DigitStyle): void {
  const glyph = GLYPHS[char];
  if (!glyph) return;
  const size = style.cell - style.gap;
  const paint = (offset: number, color: string) => {
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] !== "1") continue;
        const top = y + row * style.cell + offset;
        const bottom = top + size;
        const clippedTop = Math.max(top, style.clipTop ?? -Infinity);
        const clippedBottom = Math.min(bottom, style.clipBottom ?? Infinity);
        if (clippedBottom <= clippedTop) continue;
        rect(ctx, x + col * style.cell + offset, clippedTop, size, clippedBottom - clippedTop, color);
      }
    }
  };
  if (style.shadow) paint(1, style.shadow);
  paint(0, style.color);
}

export function drawDigits(ctx: Ctx, text: string, x: number, y: number, style: DigitStyle, spacing: number): number {
  let cursor = x;
  for (const char of text) {
    drawDigit(ctx, char, cursor, y, style);
    cursor += glyphWidth(char) * style.cell + spacing;
  }
  return cursor - x - spacing;
}

export function digitsWidth(text: string, cell: number, spacing: number): number {
  let width = 0;
  for (const char of text) width += glyphWidth(char) * cell + spacing;
  return width - spacing;
}
