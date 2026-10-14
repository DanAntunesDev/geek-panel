import { drawDigits, GLYPH_ROWS } from "../pixel/bigDigits.js";
import { drawMask, drawText, rect, sprite, textMask, maskInkWidth, type Ctx } from "../pixel/draw.js";
import { PALETTE, SPRITE_COLORS } from "../pixel/palette.js";
import type { PixelGrid } from "../pixel/PixelCanvas.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import { panel, textCenter, textRight, titleBand, truncate, wrap } from "../pixel/ui.js";
import type { AgendaEvent, AgendaState } from "../../shared/types.js";

export interface AgendaView {
  state: AgendaState;
  now: number;
  frame: number;
}

const BELL: PixelGrid = ["....K....", "...KSK...", "..KSSSK..", "..KSSSK..", ".KSSSSSK.", ".KSSSSSK.", "KKKKKKKKK", "...KMK..."];

const MINUTE = 60_000;

function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dayLabel(iso: string, now: number): string {
  const today = new Date(now).toDateString();
  if (new Date(iso).toDateString() === today) return "HOJE";
  return new Date(iso).toDateString() === new Date(now + 24 * 3600_000).toDateString() ? "AMANHA" : "DEPOIS";
}

// Faltam 10 min, 5 min, 1 min ou já começou: quanto maior o nível, mais forte o alerta.
export function alertLevel(event: AgendaEvent, now: number): number {
  const remaining = new Date(event.start).getTime() - now;
  if (remaining <= MINUTE) return 3;
  if (remaining <= 5 * MINUTE) return 2;
  if (remaining <= 10 * MINUTE) return 1;
  return 0;
}

function countdown(event: AgendaEvent, now: number): string {
  const remaining = new Date(event.start).getTime() - now;
  if (remaining <= 0) return "AGORA";
  const minutes = Math.ceil(remaining / MINUTE);
  return minutes < 60 ? `EM ${minutes} MIN` : dayLabel(event.start, now);
}

// Eventos que ainda não acabaram, em ordem; os de dia inteiro ficam por último.
export function upcomingEvents(events: AgendaEvent[], now: number): AgendaEvent[] {
  const live = events.filter((event) => new Date(event.end).getTime() > now);
  return [...live.filter((event) => !event.allDay), ...live.filter((event) => event.allDay)];
}

function drawMessage(ctx: Ctx, title: string, detail: string, frame: number): void {
  panel(ctx, 4, 20, 112, 86);
  sprite(ctx, BELL, SPRITE_COLORS, 56 + (frame % 20 < 3 ? 1 : 0), 30);
  textCenter(ctx, title, 60, 52, PALETTE.ink);
  wrap(detail, 13)
    .slice(0, 3)
    .forEach((line, index) => textCenter(ctx, line, 60, 66 + index * 10, PALETTE.mid));
}

function drawNextCard(ctx: Ctx, event: AgendaEvent, view: AgendaView): void {
  const level = alertLevel(event, view.now);
  const inverted = level >= 2 && view.frame % 6 < 3;
  const ink = inverted ? PALETTE.bg : PALETTE.ink;
  const soft = inverted ? PALETTE.surface : PALETTE.mid;

  panel(ctx, 4, 17, 112, 50);
  if (inverted) rect(ctx, 5, 18, 110, 48, PALETTE.ink);

  drawText(ctx, countdown(event, view.now), 9, 21, ink);
  if (level > 0) {
    // o sino balança mais rápido quanto mais perto do início
    const sway = [0, -1, 0, 1][(view.frame >> (level >= 3 ? 0 : 1)) % 4];
    const colors = inverted ? { ...SPRITE_COLORS, K: PALETTE.bg, S: PALETTE.ink, M: PALETTE.surface } : SPRITE_COLORS;
    sprite(ctx, BELL, colors, 98 + sway, 34);
  }

  if (event.allDay) drawText(ctx, "DIA INTEIRO", 9, 34, ink);
  else drawDigits(ctx, localTime(event.start), 9, 30, { cell: 3, gap: 0, color: ink, shadow: soft }, 3);

  const titleMask = textMask(event.title);
  const titleWidth = maskInkWidth(titleMask);
  const left = 9;
  const right = 111;
  const titleY = 30 + GLYPH_ROWS * 3 + 5;
  if (titleWidth <= right - left) {
    drawMask(ctx, titleMask, left, titleY, ink);
  } else {
    const loop = titleWidth + 20;
    const shift = view.frame % loop;
    drawMask(ctx, titleMask, left - shift, titleY, ink, left, right);
    drawMask(ctx, titleMask, left - shift + loop, titleY, ink, left, right);
  }
}

function drawList(ctx: Ctx, events: AgendaEvent[], now: number): void {
  events.slice(0, 3).forEach((event, index) => {
    const y = 71 + index * 12;
    const label = event.allDay ? dayLabel(event.start, now) : localTime(event.start);
    drawText(ctx, label, 5, y, PALETTE.mid);
    drawText(ctx, truncate(event.title, 7), 5 + 6 * 8 + 3, y, PALETTE.ink);
    for (let x = 5; x < 115; x += 2) rect(ctx, x, y + 9, 1, 1, PALETTE.surface);
  });
}

export function drawAgenda(ctx: Ctx, view: AgendaView): void {
  rect(ctx, 0, 0, SCENE_SIZE, SCENE_SIZE, PALETTE.bg);
  titleBand(ctx, SCENE_SIZE, "AGENDA");
  const today = new Date(view.now);
  textRight(ctx, `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`, 116, 3, PALETTE.bg);

  const { state } = view;
  if (!state.connected) {
    drawMessage(ctx, "SEM CONTA", "Conecte o Google na Config", view.frame);
    return;
  }
  if (state.error && state.events.length === 0) {
    drawMessage(ctx, "ERRO", state.error, view.frame);
    return;
  }
  const upcoming = upcomingEvents(state.events, view.now);
  if (upcoming.length === 0) {
    drawMessage(ctx, "SEM EVENTOS", "nas proximas 36 horas", view.frame);
    return;
  }

  drawNextCard(ctx, upcoming[0], view);
  drawList(ctx, upcoming.slice(1), view.now);
  if (state.updatedAt) drawText(ctx, `SYNC ${localTime(state.updatedAt)}`, 5, 108, PALETTE.mid);
  if (state.error) drawText(ctx, "!", 112, 108, PALETTE.ink);
}
