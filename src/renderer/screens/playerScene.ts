import {
  bayerThreshold,
  disc,
  drawMask,
  drawText,
  ellipse,
  ellipseRing,
  line,
  maskInkWidth,
  pixel,
  rect,
  sprite,
  textMask,
  type Ctx,
} from "../pixel/draw.js";
import { PALETTE, SPRITE_COLORS } from "../pixel/palette.js";
import type { PixelGrid } from "../pixel/PixelCanvas.js";
import { drawCat } from "../pixel/cat.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import { led, screenWell } from "../pixel/ui.js";

export { SCENE_SIZE };

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
  x: 4 + index * 23,
  y: 102,
  w: 20,
  h: 16,
}));

export function buttonAt(x: number, y: number): ButtonId | null {
  const hit = BUTTONS.find((box) => x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h);
  return hit?.id ?? null;
}

// Posições do braço: 0 = repouso, último = agulha sobre o disco.
const ARM_ANGLES = [0, 21, 42, 63];
const ARM_LENGTHS = [33, 35, 37, 40];
export const NEEDLE_STEPS = ARM_ANGLES.length;

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
  // Deslocamento do vinil na troca de disco (0 = no prato).
  vinylOffset: number;
  // Muda o desenho do disco (sulcos e selo) a cada faixa.
  seed: number;
}

const GROOVE_SETS = [
  [0.46, 0.6, 0.74, 0.88],
  [0.42, 0.56, 0.7, 0.84],
  [0.5, 0.64, 0.78, 0.9],
];

// Desenho do selo por faixa: liso, risco, dois pontos ou anel.
function drawLabelPattern(ctx: Ctx, cx: number, cy: number, seed: number): void {
  const variant = seed % 4;
  if (variant === 1) rect(ctx, cx - 5, cy, 11, 1, PALETTE.mid);
  else if (variant === 2) {
    pixel(ctx, cx - 4, cy, PALETTE.ink);
    pixel(ctx, cx + 4, cy, PALETTE.ink);
  } else if (variant === 3) ellipseRing(ctx, cx, cy, 7, 3, 0.45, 0.62, PALETTE.mid);
}

const MARQUEE = { left: 4, right: 116, textY: 3 };
const PLATTER = { x: 36, y: 41, rx: 31, ry: 18 };
const PIVOT = { x: 88, y: 24 };
const EQ_WELL = { x: 44, y: 67, w: 49, h: 11 };
const EQ_BARS = 12;
const SPIN_STEP_TURNS = 20 / 360;

function triangle(base: "left" | "right", height: number): string[] {
  const widest = Math.ceil(height / 2);
  return Array.from({ length: height }, (_, row) => {
    const width = widest - Math.abs(row - Math.floor(height / 2));
    const filled = "K".repeat(width);
    return base === "left" ? filled.padEnd(widest, ".") : filled.padStart(widest, ".");
  });
}

const join = (...parts: string[][]): PixelGrid => parts[0].map((_, row) => parts.map((part) => part[row]).join(""));
const bar = (width: number, height: number) => Array.from({ length: height }, () => "K".repeat(width));
const gap = (width: number, height: number) => Array.from({ length: height }, () => ".".repeat(width));

const ICONS: Record<ButtonId | "play" | "pause", PixelGrid> = {
  previous: join(bar(2, 9), gap(1, 9), triangle("right", 9)),
  next: join(triangle("left", 9), gap(1, 9), bar(2, 9)),
  back: join(triangle("right", 9), triangle("right", 9)),
  forward: join(triangle("left", 9), triangle("left", 9)),
  toggle: triangle("left", 9),
  play: triangle("left", 9),
  pause: join(bar(3, 9), gap(2, 9), bar(3, 9)),
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

const circularDistance = (a: number, b: number) => Math.min(Math.abs(a - b) % 1, 1 - (Math.abs(a - b) % 1));

// Estrelas da janela, piscando fora de fase.
const STARS = [
  { x: 107, y: 22, period: 14, on: 9 },
  { x: 113, y: 27, period: 11, on: 6 },
  { x: 108, y: 34, period: 17, on: 12 },
  { x: 114, y: 40, period: 9, on: 5 },
  { x: 109, y: 43, period: 13, on: 8 },
];

function drawWindow(ctx: Ctx, frame: number): void {
  rect(ctx, 104, 17, 14, 30, PALETTE.ink);
  rect(ctx, 106, 19, 10, 26, PALETTE.ink);
  rect(ctx, 105, 18, 12, 1, PALETTE.mid);
  rect(ctx, 105, 18, 1, 28, PALETTE.mid);
  rect(ctx, 105, 45, 12, 1, PALETTE.surface);
  rect(ctx, 116, 19, 1, 26, PALETTE.surface);
  // lua
  rect(ctx, 111, 21, 3, 1, PALETTE.bg);
  rect(ctx, 110, 22, 2, 3, PALETTE.bg);
  rect(ctx, 111, 25, 3, 1, PALETTE.bg);
  pixel(ctx, 113, 22, PALETTE.surface);
  // travessas
  rect(ctx, 105, 32, 12, 1, PALETTE.mid);
  rect(ctx, 110, 26, 1, 19, PALETTE.mid);
  for (const star of STARS) {
    if ((frame + star.x) % star.period < star.on) pixel(ctx, star.x, star.y, PALETTE.bg);
  }
  // estrela cadente a cada ~9 s
  const run = frame % 90;
  if (run < 6) {
    pixel(ctx, 115 - Math.floor(run * 1.5), 21 + run, PALETTE.bg);
    pixel(ctx, 116 - Math.floor(run * 1.5), 20 + run, PALETTE.surface);
  }
}

function drawSpray(ctx: Ctx): void {
  const cx = 110;
  const cy = 57;
  const radius = 7;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      if (bayerThreshold(cx + dx, cy + dy) < (1 - distance / radius) ** 1.3) pixel(ctx, cx + dx, cy + dy, PALETTE.accent);
    }
  }
}

function drawTable(ctx: Ctx): void {
  rect(ctx, 0, 80, SCENE_SIZE, 10, PALETTE.surface);
  rect(ctx, 0, 80, SCENE_SIZE, 1, PALETTE.ink);
  rect(ctx, 0, 89, SCENE_SIZE, 1, PALETTE.ink);
  for (let x = 6; x < SCENE_SIZE; x += 17) rect(ctx, x, 86, 7, 1, PALETTE.mid);
  for (let x = 14; x < SCENE_SIZE; x += 23) rect(ctx, x, 83, 5, 1, PALETTE.bg);
}

function drawBody(ctx: Ctx, view: PlayerView): void {
  // sombra na mesa
  for (let x = 6; x < 99; x += 1) {
    for (let y = 81; y < 84; y += 1) if (bayerThreshold(x, y) < 0.55) pixel(ctx, x, y, PALETTE.mid);
  }
  rect(ctx, 8, 79, 7, 2, PALETTE.ink);
  rect(ctx, 88, 79, 7, 2, PALETTE.ink);

  // tampo
  rect(ctx, 3, 16, 98, 51, PALETTE.ink);
  rect(ctx, 4, 17, 96, 49, PALETTE.bg);
  rect(ctx, 4, 17, 96, 1, PALETTE.surface);
  rect(ctx, 4, 64, 96, 2, PALETTE.surface);
  // frente
  rect(ctx, 3, 66, 98, 14, PALETTE.ink);
  rect(ctx, 4, 67, 96, 12, PALETTE.surface);
  rect(ctx, 4, 67, 96, 1, PALETTE.bg);
  rect(ctx, 4, 78, 96, 1, PALETTE.mid);

  const NOTCH: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  [12, 21, 30].forEach((kx, index) => {
    disc(ctx, kx, 73, 3, PALETTE.ink);
    disc(ctx, kx, 73, 2, PALETTE.bg);
    const [dx, dy] = NOTCH[(view.playing ? Math.floor(view.frame / 6) + index * 3 : index * 3) % 8];
    pixel(ctx, kx + dx, 73 + dy, PALETTE.ink);
  });
  led(ctx, 97, 73, view.playing && view.frame % 10 < 6);

  for (const [sx, sy] of [
    [6, 19],
    [97, 19],
    [6, 62],
    [97, 62],
  ]) {
    pixel(ctx, sx, sy, PALETTE.mid);
    pixel(ctx, sx + 1, sy + 1, PALETTE.ink);
  }
}

function drawPlatter(ctx: Ctx, view: PlayerView): void {
  const { x: cx, y: cy, rx, ry } = PLATTER;
  const progress = view.durationSeconds > 0 ? Math.min(1, view.positionSeconds / view.durationSeconds) : 0;
  const phase = (view.spin * SPIN_STEP_TURNS) % 1;

  // prato rebaixado
  ellipse(ctx, cx, cy + 1, rx + 1, ry + 1, PALETTE.ink);
  ellipse(ctx, cx, cy, rx + 1, ry + 1, PALETTE.ink);
  ellipse(ctx, cx, cy, rx, ry, PALETTE.surface);
  ellipse(ctx, cx, cy + 1, rx - 1, ry - 1, PALETTE.bg);

  // progresso: trilho mid, avanço magenta, a partir do topo
  ellipseRing(ctx, cx, cy, rx, ry, 0.86, 0.97, PALETTE.mid);
  if (progress > 0) ellipseRing(ctx, cx, cy, rx, ry, 0.86, 0.97, PALETTE.accent, (turn) => turn <= progress);

  // vinil (recortado ao tampo, para entrar e sair na troca de disco)
  const vx = cx + view.vinylOffset;
  ctx.save();
  ctx.beginPath();
  ctx.rect(5, 18, 94, 46);
  ctx.clip();

  ellipse(ctx, vx, cy + 2, 25, 14, PALETTE.mid);
  ellipse(ctx, vx, cy, 25, 14, PALETTE.ink);

  const inWedge = (turn: number) => circularDistance(turn, phase) < 0.07 || circularDistance(turn, phase + 0.5) < 0.07;
  ellipseRing(ctx, vx, cy, 25, 14, 0.3, 0.94, PALETTE.mid, inWedge);
  for (const radius of GROOVE_SETS[view.seed % GROOVE_SETS.length]) {
    ellipseRing(ctx, vx, cy, 25, 14, radius - 0.06, radius, PALETTE.surface, inWedge);
    ellipseRing(ctx, vx, cy, 25, 14, radius - 0.06, radius, PALETTE.mid, (turn) => !inWedge(turn));
  }

  // dois reflexos correndo pela borda
  for (const offset of [0, 0.5]) {
    const glint = (phase * 2 + offset) * Math.PI * 2;
    pixel(ctx, vx + Math.round(Math.sin(glint) * 23.5), cy - Math.round(Math.cos(glint) * 13), PALETTE.bg);
  }

  // selo
  ellipse(ctx, vx, cy, 8, 4, PALETTE.ink);
  ellipse(ctx, vx, cy, 7, 3, PALETTE.surface);
  drawLabelPattern(ctx, vx, cy, view.seed);
  const angle = phase * Math.PI * 2;
  rect(ctx, vx + Math.round(Math.sin(angle) * 4) - 1, cy - Math.round(Math.cos(angle) * 2), 2, 1, PALETTE.ink);
  pixel(ctx, vx, cy, PALETTE.ink);
  ctx.restore();
}

function armTip(step: number): { x: number; y: number } {
  const radians = (ARM_ANGLES[step] * Math.PI) / 180;
  return {
    x: Math.round(PIVOT.x - Math.sin(radians) * ARM_LENGTHS[step]),
    y: Math.round(PIVOT.y + Math.cos(radians) * ARM_LENGTHS[step] * 0.82),
  };
}

const insidePlatter = (x: number, y: number) => ((x - PLATTER.x) / PLATTER.rx) ** 2 + ((y - PLATTER.y) / PLATTER.ry) ** 2 <= 1;

function drawTonearm(ctx: Ctx, view: PlayerView): void {
  const onRecord = view.playing && view.needleStep === NEEDLE_STEPS - 1;
  const wobble = onRecord && Math.floor(view.frame / 3) % 2 === 0 ? 1 : 0;
  const tip = armTip(view.needleStep);
  const tipY = tip.y + wobble;

  // apoio do braço
  rect(ctx, 86, 54, 5, 2, PALETTE.ink);
  rect(ctx, 87, 56, 3, 5, PALETTE.ink);
  rect(ctx, 88, 56, 1, 5, PALETTE.mid);

  // sombra do braço, só sobre o prato
  const steps = 40;
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(PIVOT.x + ((tip.x - PIVOT.x) * i) / steps) + 2;
    const y = Math.round(PIVOT.y + ((tipY - PIVOT.y) * i) / steps) + 3;
    if (insidePlatter(x, y)) pixel(ctx, x, y, PALETTE.mid);
  }

  line(ctx, PIVOT.x, PIVOT.y, tip.x, tipY, PALETTE.ink, 3);
  line(ctx, PIVOT.x, PIVOT.y, tip.x, tipY, PALETTE.surface, 1);
  rect(ctx, tip.x - 2, tipY - 1, 5, 4, PALETTE.ink);
  rect(ctx, tip.x - 1, tipY, 3, 2, PALETTE.mid);

  // base com contrapeso
  rect(ctx, PIVOT.x + 3, PIVOT.y - 4, 5, 6, PALETTE.ink);
  rect(ctx, PIVOT.x + 4, PIVOT.y - 3, 3, 4, PALETTE.mid);
  ellipse(ctx, PIVOT.x, PIVOT.y + 2, 6, 3, PALETTE.ink);
  ellipse(ctx, PIVOT.x, PIVOT.y, 6, 3, PALETTE.ink);
  ellipse(ctx, PIVOT.x, PIVOT.y, 5, 2, PALETTE.surface);
  pixel(ctx, PIVOT.x, PIVOT.y, PALETTE.ink);

  // chiado da agulha
  if (onRecord) {
    for (let k = 0; k < 2; k += 1) {
      const hash = Math.imul((view.frame + 1) * 2654435761 + k * 40503, 1597334677) >>> 0;
      if ((hash >>> 9) % 3 === 0) pixel(ctx, tip.x - 3 + ((hash >>> 3) % 7), tipY - 2 - ((hash >>> 12) % 3), PALETTE.bg);
    }
  }
}

function eqHeight(index: number, tick: number): number {
  const hash = Math.imul((index + 1) * 2654435761, (tick + 3) * 40503) >>> 0;
  return 1 + ((hash >>> 7) % 8);
}

// Visor do painel frontal: barras com ponta magenta e ponto de pico que cai.
function drawEqualizer(ctx: Ctx, view: PlayerView): void {
  screenWell(ctx, EQ_WELL.x, EQ_WELL.y, EQ_WELL.w, EQ_WELL.h);
  const tick = view.frame >> 1;
  const baseline = EQ_WELL.y + EQ_WELL.h - 2;
  for (let index = 0; index < EQ_BARS; index += 1) {
    const x = EQ_WELL.x + 2 + index * 4;
    if (!view.playing) {
      rect(ctx, x, baseline, 3, 1, PALETTE.mid);
      continue;
    }
    const height = eqHeight(index, tick);
    rect(ctx, x, baseline - height + 1, 3, height, PALETTE.bg);
    rect(ctx, x, baseline - height + 1, 3, 1, PALETTE.accent);
    let peak = height;
    for (let back = 1; back <= 5; back += 1) peak = Math.max(peak, eqHeight(index, tick - back) - back);
    if (peak > height) pixel(ctx, x + 1, baseline - peak, PALETTE.surface);
  }
}

const NOTE: PixelGrid = ["..KK", "..K.", "..K.", "KK..", "KK.."];

function drawNotes(ctx: Ctx, view: PlayerView): void {
  if (!view.playing) return;
  for (let index = 0; index < 2; index += 1) {
    const travel = (view.frame + index * 14) % 28;
    sprite(ctx, NOTE, { K: index === 0 ? PALETTE.ink : PALETTE.mid }, 68 + index * 9 + (Math.floor(travel / 5) % 2), 62 - travel);
  }
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
  drawWindow(ctx, view.frame);
  drawSpray(ctx);
  drawTable(ctx);
  drawCat(ctx, { x: 103, y: 71, frame: view.frame, awake: view.playing });
  drawBody(ctx, view);
  drawPlatter(ctx, view);
  drawEqualizer(ctx, view);
  drawNotes(ctx, view);
  drawTonearm(ctx, view);

  drawText(ctx, formatTime(view.positionSeconds), 4, 92, PALETTE.ink);
  const total = formatTime(view.durationSeconds, view.durationSeconds <= 0);
  const totalMask = textMask(total);
  drawMask(ctx, totalMask, 116 - maskInkWidth(totalMask), 92, PALETTE.ink);

  for (const box of BUTTONS) {
    const icon = box.id === "toggle" && view.playing ? ICONS.pause : ICONS[box.id];
    drawButton(ctx, box, icon, view.pressed === box.id && view.controlsEnabled, view.controlsEnabled);
  }
}

// Clique no anel de progresso: fração (0 a 1) a partir do topo, sentido horário.
export function ringFraction(x: number, y: number): number | null {
  const u = (x - PLATTER.x) / PLATTER.rx;
  const v = (y - PLATTER.y) / PLATTER.ry;
  const n = Math.hypot(u, v);
  if (n < 0.8 || n > 1.04) return null;
  return (Math.atan2(u, -v) / (Math.PI * 2) + 1) % 1;
}
