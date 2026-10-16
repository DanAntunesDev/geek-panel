import type { PixelColorMap, PixelGrid } from "./PixelCanvas.js";

export type Ctx = CanvasRenderingContext2D;

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Elipse cheia (perspectiva: círculo visto de cima e de lado).
export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  const reach = Math.ceil(ry);
  for (let dy = -reach; dy <= reach; dy += 1) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const half = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

// Anel elíptico entre dois raios normalizados (1 = borda); keep filtra por ângulo.
export function ellipseRing(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  inner: number,
  outer: number,
  color: string,
  keep?: (turn: number) => boolean,
): void {
  ctx.fillStyle = color;
  const reachX = Math.ceil(rx * outer);
  const reachY = Math.ceil(ry * outer);
  for (let dy = -reachY; dy <= reachY; dy += 1) {
    for (let dx = -reachX; dx <= reachX; dx += 1) {
      const u = dx / rx;
      const v = dy / ry;
      const n = Math.hypot(u, v);
      if (n > outer || n <= inner) continue;
      if (keep && !keep((Math.atan2(u, -v) / (Math.PI * 2) + 1) % 1)) continue;
      ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}

export function pixel(ctx: Ctx, x: number, y: number, color: string): void {
  rect(ctx, x, y, 1, 1, color);
}

export function disc(ctx: Ctx, cx: number, cy: number, radius: number, color: string): void {
  ctx.fillStyle = color;
  const limit = radius * radius + radius;
  for (let dy = -radius; dy <= radius; dy += 1) {
    let half = 0;
    while ((half + 1) * (half + 1) + dy * dy <= limit) half += 1;
    if (dy * dy > limit) continue;
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, thickness = 1): void {
  ctx.fillStyle = color;
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  const offset = Math.floor((thickness - 1) / 2);
  let error = dx + dy;
  for (;;) {
    ctx.fillRect(x - offset, y - offset, thickness, thickness);
    if (x === endX && y === endY) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}

export function sprite(ctx: Ctx, grid: PixelGrid, colors: PixelColorMap, x: number, y: number): void {
  for (let row = 0; row < grid.length; row += 1) {
    const cells = grid[row];
    for (let col = 0; col < cells.length; col += 1) {
      const color = colors[cells[col]];
      if (color) pixel(ctx, x + col, y + row, color);
    }
  }
}

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function bayerThreshold(x: number, y: number): number {
  return (BAYER_4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

// texto: rasteriza a fonte uma vez e binariza (sem tom intermediário)
const FONT_FAMILY = "Press Start 2P";
const GLYPH_SIZE = 8;
// folga para til e cedilha não cortarem
const PAD_TOP = 3;
const PAD_BOTTOM = 3;

export interface TextMask {
  width: number;
  height: number;
  padTop: number;
  bits: Uint8Array;
}

const maskCache = new Map<string, TextMask>();
let scratch: HTMLCanvasElement | undefined;

export function ensureFont(): Promise<void> {
  return document.fonts.load(`${GLYPH_SIZE}px "${FONT_FAMILY}"`).then(() => undefined);
}

export function textMask(text: string): TextMask {
  const cached = maskCache.get(text);
  if (cached) return cached;

  const width = Math.max(1, text.length * GLYPH_SIZE);
  scratch ??= document.createElement("canvas");
  scratch.width = width;
  const height = GLYPH_SIZE + PAD_TOP + PAD_BOTTOM;
  scratch.height = height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2d indisponível");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.font = `${GLYPH_SIZE}px "${FONT_FAMILY}"`;
  ctx.textBaseline = "top";
  ctx.fillText(text, 0, PAD_TOP);

  const data = ctx.getImageData(0, 0, width, height).data;
  const bits = new Uint8Array(width * height);
  for (let i = 0; i < bits.length; i += 1) {
    bits[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
  }
  const mask = { width, height, padTop: PAD_TOP, bits };
  if (document.fonts.check(`${GLYPH_SIZE}px "${FONT_FAMILY}"`)) maskCache.set(text, mask);
  return mask;
}

export function maskInkWidth(mask: TextMask): number {
  for (let x = mask.width - 1; x >= 0; x -= 1) {
    for (let y = 0; y < mask.height; y += 1) {
      if (mask.bits[y * mask.width + x]) return x + 1;
    }
  }
  return 0;
}

export function drawMask(ctx: Ctx, mask: TextMask, x: number, y: number, color: string, clipLeft = -Infinity, clipRight = Infinity): void {
  ctx.fillStyle = color;
  for (let row = 0; row < mask.height; row += 1) {
    for (let col = 0; col < mask.width; col += 1) {
      if (!mask.bits[row * mask.width + col]) continue;
      const px = x + col;
      if (px < clipLeft || px >= clipRight) continue;
      ctx.fillRect(px, y + row - mask.padTop, 1, 1);
    }
  }
}

export function drawText(ctx: Ctx, text: string, x: number, y: number, color: string): number {
  const mask = textMask(text);
  drawMask(ctx, mask, x, y, color);
  return maskInkWidth(mask);
}
