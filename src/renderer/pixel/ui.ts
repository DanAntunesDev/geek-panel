import { disc, drawMask, maskInkWidth, rect, textMask, type Ctx } from "./draw.js";
import { PALETTE } from "./palette.js";

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, pressed = false): void {
  rect(ctx, x, y, w, h, PALETTE.ink);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, PALETTE.surface);
  if (pressed) {
    rect(ctx, x + 1, y + 1, w - 2, 1, PALETTE.mid);
    rect(ctx, x + 1, y + 1, 1, h - 2, PALETTE.mid);
  } else {
    rect(ctx, x + 1, y + 1, w - 2, 1, PALETTE.bg);
    rect(ctx, x + 1, y + 1, 1, h - 3, PALETTE.bg);
    rect(ctx, x + 1, y + h - 2, w - 2, 1, PALETTE.mid);
    rect(ctx, x + w - 2, y + 2, 1, h - 3, PALETTE.mid);
  }
}

export function screenWell(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, PALETTE.ink);
  rect(ctx, x + 1, y + 1, w - 2, 1, PALETTE.mid);
  rect(ctx, x + 1, y + 1, 1, h - 2, PALETTE.mid);
}

export function chamfer(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  for (const [cx, cy] of [
    [x, y],
    [x + w - 1, y],
    [x, y + h - 1],
    [x + w - 1, y + h - 1],
  ]) {
    rect(ctx, cx, cy, 1, 1, color);
  }
}

export function titleBand(ctx: Ctx, width: number, title: string, height = 14): void {
  rect(ctx, 0, 0, width, height, PALETTE.ink);
  rect(ctx, 0, height, width, 1, PALETTE.mid);
  drawMask(ctx, textMask(title), 4, Math.floor((height - 8) / 2), PALETTE.bg);
}

export function textRight(ctx: Ctx, text: string, rightX: number, y: number, color: string): void {
  const mask = textMask(text);
  drawMask(ctx, mask, rightX - maskInkWidth(mask), y, color);
}

export function textCenter(ctx: Ctx, text: string, centerX: number, y: number, color: string): void {
  const mask = textMask(text);
  drawMask(ctx, mask, centerX - Math.floor(maskInkWidth(mask) / 2), y, color);
}

export function segmentedBar(ctx: Ctx, x: number, y: number, w: number, h: number, percentage: number, segments: number, fill: string = PALETTE.bg): void {
  rect(ctx, x, y, w, h, PALETTE.ink);
  const innerW = w - 2;
  const gap = 1;
  const segW = Math.floor((innerW - gap * (segments - 1)) / segments);
  const filled = Math.round((Math.max(0, Math.min(100, percentage)) / 100) * segments);
  for (let i = 0; i < segments; i += 1) {
    const color = i < filled ? fill : PALETTE.mid;
    rect(ctx, x + 1 + i * (segW + gap), y + 1, segW, h - 2, color);
  }
}

export function led(ctx: Ctx, cx: number, cy: number, on: boolean): void {
  disc(ctx, cx, cy, 2, PALETTE.ink);
  disc(ctx, cx, cy, 1, on ? PALETTE.bg : PALETTE.mid);
}

export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function truncate(text: string, maxChars: number): string {
  return text.slice(0, maxChars).trimEnd();
}
