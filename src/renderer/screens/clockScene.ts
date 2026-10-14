import { digitsWidth, drawDigit, drawDigits, GLYPH_ROWS } from "../pixel/bigDigits.js";
import { disc, drawText, line, rect, type Ctx } from "../pixel/draw.js";
import { PALETTE } from "../pixel/palette.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import { panel, screenWell, segmentedBar, textCenter } from "../pixel/ui.js";
import type { ClockStyle } from "../../shared/types.js";

export interface ClockParts {
  hour: number;
  minute: number;
  second: number;
  millis: number;
  weekdayIndex: number; // 0 = domingo
  weekday: string;
  day: string;
  month: string;
  year: string;
}

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export function clockParts(now: Date, timeZone: string): ClockParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(now)) values[part.type] = part.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  return {
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
    millis: now.getMilliseconds(),
    weekdayIndex,
    weekday: WEEKDAYS[weekdayIndex] ?? "---",
    day: values.day,
    month: values.month,
    year: values.year,
  };
}

interface FlipCardState {
  value: string;
  from: string;
  start: number;
}

export interface FlipState {
  hours: FlipCardState;
  minutes: FlipCardState;
}

export function newFlipState(): FlipState {
  return {
    hours: { value: "", from: "", start: -100 },
    minutes: { value: "", from: "", start: -100 },
  };
}

export interface ClockView {
  style: ClockStyle;
  parts: ClockParts;
  timezone: string;
  showSeconds: boolean;
  showDate: boolean;
  hour12: boolean;
  frame: number;
  flip: FlipState;
}

const pad = (value: number) => String(value).padStart(2, "0");

function displayHour(view: ClockView): number {
  return view.hour12 ? view.parts.hour % 12 || 12 : view.parts.hour;
}

function dateText(view: ClockView): string {
  const { weekday, day, month, year } = view.parts;
  return `${weekday} ${day}/${month}/${year}`;
}

// "America/Sao_Paulo" vira "SAO PAULO".
function cityLabel(timezone: string): string {
  return (timezone.split("/").pop() ?? timezone).replace(/_/g, " ").toUpperCase().slice(0, 14);
}

function drawWeekdayStrip(ctx: Ctx, view: ClockView, y: number): void {
  ["D", "S", "T", "Q", "Q", "S", "S"].forEach((letter, index) => {
    const x = 5 + index * 16;
    const active = index === view.parts.weekdayIndex;
    rect(ctx, x, y, 14, 12, PALETTE.ink);
    rect(ctx, x + 1, y + 1, 12, 10, active ? PALETTE.ink : PALETTE.surface);
    drawText(ctx, letter, x + 4, y + 2, active ? PALETTE.bg : PALETTE.mid);
  });
}

function drawDigital(ctx: Ctx, view: ClockView): void {
  panel(ctx, 4, 4, 112, 62);
  screenWell(ctx, 8, 8, 104, 54);

  const text = `${pad(displayHour(view))}:${pad(view.parts.minute)}`;
  const cell = 4;
  const spacing = 3;
  const x = 8 + Math.floor((104 - digitsWidth(text, cell, spacing)) / 2);
  const y = 12;

  // matriz de LED: pontos apagados em mid, acesos em bg
  drawDigits(ctx, "88:88", x, y, { cell, gap: 3, color: PALETTE.mid }, spacing);
  let cursor = x;
  for (const char of text) {
    const width = digitsWidth(char, cell, 0);
    if (char !== ":" || view.parts.millis < 500) drawDigit(ctx, char, cursor, y, { cell, gap: 1, color: PALETTE.bg });
    cursor += width + spacing;
  }

  const baseY = y + GLYPH_ROWS * cell + 6;
  if (view.hour12) drawText(ctx, view.parts.hour >= 12 ? "PM" : "AM", 12, baseY, PALETTE.bg);
  if (view.showSeconds) {
    const seconds = pad(view.parts.second);
    drawDigits(ctx, seconds, 108 - digitsWidth(seconds, 2, 2), baseY, { cell: 2, gap: 0, color: PALETTE.bg }, 2);
  }

  if (view.showDate) textCenter(ctx, dateText(view), 60, 71, PALETTE.ink);
  drawWeekdayStrip(ctx, view, 84);
  textCenter(ctx, cityLabel(view.timezone), 60, 104, PALETTE.mid);
}

function polar(cx: number, cy: number, turn: number, length: number): [number, number] {
  const angle = turn * Math.PI * 2;
  return [Math.round(cx + Math.sin(angle) * length), Math.round(cy - Math.cos(angle) * length)];
}

function drawAnalog(ctx: Ctx, view: ClockView): void {
  const cx = 60;
  const cy = 56;
  disc(ctx, cx, cy, 51, PALETTE.ink);
  disc(ctx, cx, cy, 49, PALETTE.surface);
  disc(ctx, cx, cy, 45, PALETTE.ink);
  disc(ctx, cx, cy, 44, PALETTE.bg);

  for (let tick = 0; tick < 12; tick += 1) {
    const quarter = tick % 3 === 0;
    const [x, y] = polar(cx, cy, tick / 12, 38);
    const size = quarter ? 4 : 2;
    rect(ctx, x - Math.floor(size / 2), y - Math.floor(size / 2), size, size, PALETTE.ink);
  }
  for (let minute = 0; minute < 60; minute += 1) {
    if (minute % 5 === 0) continue;
    const [x, y] = polar(cx, cy, minute / 60, 41);
    rect(ctx, x, y, 1, 1, PALETTE.mid);
  }

  screenWell(ctx, cx - 10, cy + 14, 20, 11);
  drawText(ctx, view.parts.day, cx - 8, cy + 16, PALETTE.bg);

  const { hour, minute, second } = view.parts;
  // ponteiros andam em degraus: hora e minuto a cada minuto, segundos a cada segundo
  const hourTurn = Math.floor((((hour % 12) + minute / 60) / 12) * 144) / 144;
  const minuteTurn = minute / 60;
  for (const [turn, length] of [
    [hourTurn, 22],
    [minuteTurn, 34],
  ] as const) {
    const [ex, ey] = polar(cx, cy, turn, length);
    line(ctx, cx + 1, cy + 1, ex + 1, ey + 1, PALETTE.mid, 3);
    line(ctx, cx, cy, ex, ey, PALETTE.ink, 3);
  }
  if (view.showSeconds) {
    const [ex, ey] = polar(cx, cy, second / 60, 40);
    const [tx, ty] = polar(cx, cy, second / 60 + 0.5, 9);
    line(ctx, tx, ty, ex, ey, PALETTE.mid, 1);
  }
  disc(ctx, cx, cy, 3, PALETTE.ink);
  disc(ctx, cx, cy, 1, PALETTE.surface);

  if (view.showDate) textCenter(ctx, `${view.parts.weekday} ${view.parts.day}/${view.parts.month}`, 60, 109, PALETTE.ink);
}

function advanceCard(card: FlipCardState, value: string, frame: number): number {
  if (card.value !== value) {
    card.from = card.value || value;
    card.value = value;
    card.start = frame;
  }
  return frame - card.start;
}

function drawFlipCard(ctx: Ctx, x: number, y: number, w: number, h: number, card: FlipCardState, frame: number, value: string): void {
  const t = advanceCard(card, value, frame);
  const flipping = t >= 0 && t < 4;
  const half = Math.floor(h / 2);
  const center = y + half;
  const cell = 4;
  const spacing = 3;
  const digitsX = x + Math.floor((w - digitsWidth("00", cell, spacing)) / 2);
  const digitsY = y + Math.floor((h - GLYPH_ROWS * cell) / 2);
  const style = (clipTop: number, clipBottom: number) => ({ cell, gap: 0, color: PALETTE.ink, shadow: PALETTE.mid, clipTop, clipBottom });

  panel(ctx, x, y, w, h);
  const draw = (text: string, clipTop: number, clipBottom: number) => drawDigits(ctx, text, digitsX, digitsY, style(clipTop, clipBottom), spacing);

  if (!flipping) {
    draw(value, y + 1, y + h - 1);
  } else {
    const flapTop = t === 0 ? half - 1 : t === 1 ? Math.floor(half / 2) : 0;
    const flapBottom = t <= 1 ? 0 : t === 2 ? Math.floor(half / 2) : half - 1;

    draw(value, y + 1, center);
    if (flapTop > 0) {
      rect(ctx, x + 2, center - flapTop, w - 4, flapTop, PALETTE.surface);
      draw(card.from, center - flapTop, center);
      rect(ctx, x + 2, center - flapTop, w - 4, 1, PALETTE.mid);
    }
    draw(card.from, center, y + h - 1);
    if (flapBottom > 0) {
      rect(ctx, x + 2, center, w - 4, flapBottom, PALETTE.surface);
      draw(value, center, center + flapBottom);
      rect(ctx, x + 2, center + flapBottom, w - 4, 1, PALETTE.mid);
    }
  }

  rect(ctx, x + 1, center, w - 2, 1, PALETTE.ink);
  rect(ctx, x, center - 1, 2, 3, PALETTE.ink);
  rect(ctx, x + w - 2, center - 1, 2, 3, PALETTE.ink);
}

function drawFlip(ctx: Ctx, view: ClockView): void {
  drawFlipCard(ctx, 4, 6, 52, 52, view.flip.hours, view.frame, pad(displayHour(view)));
  drawFlipCard(ctx, 64, 6, 52, 52, view.flip.minutes, view.frame, pad(view.parts.minute));

  if (view.parts.millis < 500) {
    rect(ctx, 58, 22, 4, 4, PALETTE.ink);
    rect(ctx, 58, 36, 4, 4, PALETTE.ink);
  }

  if (view.hour12) drawText(ctx, view.parts.hour >= 12 ? "PM" : "AM", 6, 62, PALETTE.ink);
  if (view.showSeconds) segmentedBar(ctx, 4, 64, 112, 8, ((view.parts.second + 1) / 60) * 100, 12);
  if (view.showDate) textCenter(ctx, dateText(view), 60, 77, PALETTE.ink);
  drawWeekdayStrip(ctx, view, 90);
  textCenter(ctx, cityLabel(view.timezone), 60, 106, PALETTE.mid);
}

export function drawClock(ctx: Ctx, view: ClockView): void {
  rect(ctx, 0, 0, SCENE_SIZE, SCENE_SIZE, PALETTE.bg);
  if (view.style === "analog") drawAnalog(ctx, view);
  else if (view.style === "flip") drawFlip(ctx, view);
  else drawDigital(ctx, view);
}
