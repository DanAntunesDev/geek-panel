import { bayerThreshold, disc, drawMask, drawText, line, maskInkWidth, pixel, rect, ring, sprite, textMask, type Ctx } from "../pixel/draw.js";
import { chamfer, led, panel, screenWell } from "../pixel/ui.js";
import { SPRITE_COLORS, PALETTE } from "../pixel/palette.js";
import type { PixelGrid } from "../pixel/PixelCanvas.js";

export const SCENE_SIZE = 156;

export type ButtonId = "previous" | "back" | "toggle" | "forward" | "next";

interface ButtonBox {
  id: ButtonId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BUTTONS: readonly ButtonBox[] = (["previous", "back", "toggle", "forward", "next"] as const).map((id, index) => ({
  id,
  x: 6 + index * 26,
  y: 128,
  w: 22,
  h: 20,
}));

export function buttonAt(x: number, y: number): ButtonId | null {
  const hit = BUTTONS.find((box) => x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h);
  return hit?.id ?? null;
}

// 0 = repouso, último = sobre o disco
export const NEEDLE_ANGLES = [0, 12, 24, 36];

export interface PlayerView {
  title: string;
  artist: string;
  playing: boolean;
  positionSeconds: number;
  durationSeconds: number;
  pressed: ButtonId | null;
  controlsEnabled: boolean;
  needleStep: number;
  spin: number;
  frame: number;
}

const CHASSIS = { x: 3, y: 16, w: 150, h: 94 };
const DISC_CENTER = { x: 49, y: 63 };
const ARM_PIVOT = { x: 100, y: 24 };
const ARM_LENGTH = 40;
const MARQUEE = { left: 6, right: 150, textY: 3 };
const EQ_WELL = { x: 106, y: 62, w: 42, h: 42 };
const EQ = { left: 110, bars: 7, baseline: 102 };
const SPIN_STEP_TURNS = 20 / 360; // 20° por quadro a 10 fps ≈ 33 rpm

function triangle(base: "left" | "right", height = 11): string[] {
  const widest = Math.ceil(height / 2);
  return Array.from({ length: height }, (_, row) => {
    const width = widest - Math.abs(row - Math.floor(height / 2));
    const filled = "K".repeat(width);
    return base === "left" ? filled.padEnd(widest, ".") : filled.padStart(widest, ".");
  });
}

function join(...parts: string[][]): PixelGrid {
  return parts[0].map((_, row) => parts.map((part) => part[row]).join(""));
}

const bar = (width: number, height = 11) => Array.from({ length: height }, () => "K".repeat(width));
const gap = (width: number, height = 11) => Array.from({ length: height }, () => ".".repeat(width));

const ICONS: Record<ButtonId | "play" | "pause", PixelGrid> = {
  previous: join(bar(2), gap(1), triangle("right")),
  next: join(triangle("left"), gap(1), bar(2)),
  back: join(triangle("right", 9), triangle("right", 9)),
  forward: join(triangle("left", 9), triangle("left", 9)),
  toggle: triangle("left"),
  play: triangle("left"),
  pause: join(bar(3), gap(3), bar(3)),
};

function formatTime(seconds: number, unknown = false): string {
  if (unknown) return "--:--";
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function drawMarquee(ctx: Ctx, view: PlayerView): void {
  const mask = textMask(view.artist ? `${view.title} - ${view.artist}` : view.title);
  const textWidth = maskInkWidth(mask);
  const windowWidth = MARQUEE.right - MARQUEE.left;
  if (textWidth <= windowWidth) {
    drawMask(ctx, mask, MARQUEE.left + Math.floor((windowWidth - textWidth) / 2), MARQUEE.textY, PALETTE.ink);
  } else {
    const loop = textWidth + 24;
    const shift = view.frame % loop;
    drawMask(ctx, mask, MARQUEE.left - shift, MARQUEE.textY, PALETTE.ink, MARQUEE.left, MARQUEE.right);
    drawMask(ctx, mask, MARQUEE.left - shift + loop, MARQUEE.textY, PALETTE.ink, MARQUEE.left, MARQUEE.right);
  }
  rect(ctx, MARQUEE.left, 12, windowWidth, 2, PALETTE.accent);
}

function drawSpray(ctx: Ctx): void {
  const cx = 130;
  const cy = 38;
  const radius = 13;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      if (bayerThreshold(cx + dx, cy + dy) < (1 - distance / radius) ** 1.4) pixel(ctx, cx + dx, cy + dy, PALETTE.accent);
    }
  }
}

function circularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 1;
  return Math.min(diff, 1 - diff);
}

function drawTurntable(ctx: Ctx, view: PlayerView): void {
  const { x: cx, y: cy } = DISC_CENTER;
  const progress = view.durationSeconds > 0 ? Math.min(1, view.positionSeconds / view.durationSeconds) : 0;
  const phase = (view.spin * SPIN_STEP_TURNS) % 1;

  disc(ctx, cx, cy, 41, PALETTE.ink);
  disc(ctx, cx, cy, 40, PALETTE.bg);

  ring(ctx, cx, cy, 34, 37, PALETTE.mid);
  if (progress > 0) ring(ctx, cx, cy, 34, 37, PALETTE.accent, (turn) => turn <= progress);

  disc(ctx, cx, cy, 33, PALETTE.ink);

  const inWedge = (turn: number) => circularDistance(turn, phase) < 0.07 || circularDistance(turn, phase + 0.5) < 0.07;
  ring(ctx, cx, cy, 12, 32, PALETTE.mid, inWedge);
  for (const radius of [18, 23, 27, 31]) {
    ring(ctx, cx, cy, radius - 1, radius, PALETTE.surface, inWedge);
    ring(ctx, cx, cy, radius - 1, radius, PALETTE.mid, (turn) => !inWedge(turn));
  }

  disc(ctx, cx, cy, 10, PALETTE.ink);
  disc(ctx, cx, cy, 9, PALETTE.surface);
  ring(ctx, cx, cy, 6, 7, PALETTE.mid);
  const angle = phase * Math.PI * 2;
  rect(ctx, cx + Math.round(Math.sin(angle) * 4) - 1, cy - Math.round(Math.cos(angle) * 4) - 1, 2, 2, PALETTE.ink);
  disc(ctx, cx, cy, 1, PALETTE.ink);
}

function drawChassis(ctx: Ctx, view: PlayerView): void {
  panel(ctx, CHASSIS.x, CHASSIS.y, CHASSIS.w, CHASSIS.h);
  chamfer(ctx, CHASSIS.x, CHASSIS.y, CHASSIS.w, CHASSIS.h, PALETTE.bg);
  for (const [sx, sy] of [
    [CHASSIS.x + 4, CHASSIS.y + 4],
    [CHASSIS.x + CHASSIS.w - 6, CHASSIS.y + 4],
    [CHASSIS.x + 4, CHASSIS.y + CHASSIS.h - 6],
    [CHASSIS.x + CHASSIS.w - 6, CHASSIS.y + CHASSIS.h - 6],
  ]) {
    rect(ctx, sx, sy, 2, 2, PALETTE.mid);
    pixel(ctx, sx, sy, PALETTE.ink);
  }
  led(ctx, 114, 24, view.playing && view.frame % 10 < 6);

  for (let row = 0; row < 3; row += 1) {
    for (let x = EQ_WELL.x + 2 + (row % 2); x < EQ_WELL.x + EQ_WELL.w - 2; x += 3) {
      pixel(ctx, x, 53 + row * 3, PALETTE.mid);
    }
  }
}

function drawTonearm(ctx: Ctx, view: PlayerView): void {
  const theta = (NEEDLE_ANGLES[view.needleStep] * Math.PI) / 180;
  const onRecord = view.playing && view.needleStep === NEEDLE_ANGLES.length - 1;
  const wobble = onRecord && view.frame % 6 < 3 ? 1 : 0;
  const tipX = Math.round(ARM_PIVOT.x - Math.sin(theta) * ARM_LENGTH);
  const tipY = Math.round(ARM_PIVOT.y + Math.cos(theta) * ARM_LENGTH) + wobble;

  line(ctx, ARM_PIVOT.x, ARM_PIVOT.y, tipX, tipY, PALETTE.ink, 3);
  line(ctx, ARM_PIVOT.x, ARM_PIVOT.y, tipX, tipY, PALETTE.surface, 1);

  rect(ctx, tipX - 2, tipY - 1, 5, 5, PALETTE.ink);
  rect(ctx, tipX - 1, tipY, 3, 2, PALETTE.mid);

  disc(ctx, ARM_PIVOT.x, ARM_PIVOT.y, 6, PALETTE.ink);
  disc(ctx, ARM_PIVOT.x, ARM_PIVOT.y, 5, PALETTE.surface);
  disc(ctx, ARM_PIVOT.x, ARM_PIVOT.y, 2, PALETTE.ink);
}

function barHeightSegments(index: number, tick: number): number {
  const hash = Math.imul((index + 1) * 2654435761, (tick + 3) * 40503) >>> 0;
  return 1 + ((hash >>> 7) % 8);
}

function drawEqualizer(ctx: Ctx, view: PlayerView): void {
  screenWell(ctx, EQ_WELL.x, EQ_WELL.y, EQ_WELL.w, EQ_WELL.h);
  const tick = view.frame >> 1;
  for (let index = 0; index < EQ.bars; index += 1) {
    const segments = view.playing ? barHeightSegments(index, tick) : 1;
    const x = EQ.left + index * 5;
    for (let segment = 0; segment < segments; segment += 1) {
      const top = segment === segments - 1;
      rect(ctx, x, EQ.baseline - 3 - segment * 4, 4, 3, top ? PALETTE.accent : PALETTE.bg);
    }
  }
}

const NOTE: PixelGrid = ["..KK.", "..K.K", "..K..", "..K..", "KKK..", "KKK.."];

function drawNotes(ctx: Ctx, view: PlayerView): void {
  if (!view.playing) return;
  for (let index = 0; index < 3; index += 1) {
    const travel = (view.frame + index * 12) % 36;
    const x = 112 + index * 13 + (Math.floor(travel / 6) % 2);
    const y = 60 - travel;
    sprite(ctx, NOTE, { K: index % 2 === 0 ? PALETTE.ink : PALETTE.mid }, x, y);
  }
}

const LEAVES = [
  "...KK...KK..",
  "..KSSK.KSSK.",
  ".KSSSMKSSSMK",
  ".KSSMK.KSMK.",
  "..KKK.K.KK..",
  ".....KK.....",
  ".....K......",
  ".....K......",
];

function drawPlant(ctx: Ctx, frame: number): void {
  const sway = (frame >> 2) % 2;
  LEAVES.forEach((row, index) => {
    const shift = index < 5 ? sway : 0;
    sprite(ctx, [row], SPRITE_COLORS, 138 + shift, 134 + index);
  });
  rect(ctx, 139, 142, 10, 8, PALETTE.ink);
  rect(ctx, 140, 143, 8, 6, PALETTE.mid);
  rect(ctx, 140, 143, 8, 1, PALETTE.surface);
}

function drawButton(ctx: Ctx, box: ButtonBox, icon: PixelGrid, pressed: boolean, enabled: boolean): void {
  const { x, y, w, h } = box;
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
  const offset = pressed ? 1 : 0;
  const iconX = x + Math.floor((w - icon[0].length) / 2) + offset;
  const iconY = y + Math.floor((h - icon.length) / 2) + offset;
  sprite(ctx, icon, enabled ? SPRITE_COLORS : { ...SPRITE_COLORS, K: PALETTE.mid }, iconX, iconY);
}

export function drawPlayer(ctx: Ctx, view: PlayerView): void {
  rect(ctx, 0, 0, SCENE_SIZE, SCENE_SIZE, PALETTE.bg);

  drawMarquee(ctx, view);
  drawChassis(ctx, view);
  drawSpray(ctx);
  drawTurntable(ctx, view);
  drawEqualizer(ctx, view);
  drawNotes(ctx, view);
  drawTonearm(ctx, view);
  drawPlant(ctx, view.frame);

  drawText(ctx, formatTime(view.positionSeconds), 6, 114, PALETTE.ink);
  const total = formatTime(view.durationSeconds, view.durationSeconds <= 0);
  const totalMask = textMask(total);
  drawMask(ctx, totalMask, 150 - maskInkWidth(totalMask), 114, PALETTE.ink);

  for (const box of BUTTONS) {
    const icon = box.id === "toggle" && view.playing ? ICONS.pause : ICONS[box.id];
    drawButton(ctx, box, icon, view.pressed === box.id && view.controlsEnabled, view.controlsEnabled);
  }
}

// fração (0 a 1) a partir do topo, sentido horário
export function ringFraction(x: number, y: number): number | null {
  const dx = x - DISC_CENTER.x;
  const dy = y - DISC_CENTER.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 33 || distance > 38.5) return null;
  return (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1;
}
