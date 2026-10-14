import { drawText, rect, sprite, type Ctx } from "../pixel/draw.js";
import { REFRESH_FRAMES } from "../pixel/icons.js";
import { PALETTE, SPRITE_COLORS } from "../pixel/palette.js";
import type { PixelGrid } from "../pixel/PixelCanvas.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import { panel, segmentedBar, textRight, titleBand, truncate, wrap } from "../pixel/ui.js";
import type { UsageCard } from "../../shared/types.js";

const BAND = 16;
export const REFRESH_BOX = { x: 104, y: 1, w: 13, h: 13 };
const CARDS_PER_PAGE = 2;
const PAGE_FRAMES = 40;
const SLIDE_FRAMES = 4;

export function isRefreshHit(x: number, y: number): boolean {
  return x >= REFRESH_BOX.x && x < REFRESH_BOX.x + REFRESH_BOX.w && y >= REFRESH_BOX.y && y < REFRESH_BOX.y + REFRESH_BOX.h;
}

export interface UsageView {
  cards: UsageCard[];
  spinning: boolean;
  updatedAtLabel: string | null;
  frame: number;
}

// 1.2K, 12.4M, 3.1B
export function compact(value: number): string {
  if (value < 1000) return String(value);
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (value >= size) {
      const scaled = value / size;
      return `${scaled < 100 ? scaled.toFixed(1).replace(/\.0$/, "") : Math.round(scaled)}${suffix}`;
    }
  }
  return String(value);
}

const COIN: PixelGrid = ["..KKKK..", ".KSSSSK.", "KSSMMSSK", "KSMKKMSK", "KSMKKMSK", "KSSMMSSK", ".KSSSSK.", "..KKKK.."];

const STATUS_LABEL: Record<UsageCard["status"], string> = { ok: "OK", stale: "ANTIGO", unavailable: "OFF" };

function drawCard(ctx: Ctx, card: UsageCard, x: number, y: number, frame: number): void {
  panel(ctx, x, y, 112, 40);
  sprite(ctx, COIN, SPRITE_COLORS, x + 5, y + 4);
  drawText(ctx, truncate(card.label.toUpperCase(), 7), x + 16, y + 4, PALETTE.ink);

  const label = STATUS_LABEL[card.status];
  const chipW = label.length * 8 + 4;
  const chipX = x + 108 - chipW;
  rect(ctx, chipX, y + 3, chipW, 10, PALETTE.ink);
  if (card.status !== "ok") rect(ctx, chipX + 1, y + 4, chipW - 2, 8, card.status === "stale" && frame % 10 < 5 ? PALETTE.surface : PALETTE.mid);
  drawText(ctx, label, chipX + 2, y + 4, card.status === "ok" ? PALETTE.bg : PALETTE.ink);

  if (card.status === "unavailable") {
    wrap(card.note ?? "sem dados", 13)
      .slice(0, 2)
      .forEach((line, index) => drawText(ctx, line, x + 5, y + 18 + index * 10, PALETTE.mid));
    return;
  }

  const used = compact(card.used);
  drawText(ctx, card.limit > 0 ? `${used}/${compact(card.limit)}` : `${used} TOKENS`, x + 5, y + 15, PALETTE.ink);
  if (card.limit > 0) textRight(ctx, `${card.percentage}%`, x + 108, y + 15, PALETTE.ink);
  segmentedBar(ctx, x + 5, y + 26, 102, 8, card.limit > 0 ? card.percentage : 0, 20);
}

export function drawUsage(ctx: Ctx, view: UsageView): void {
  rect(ctx, 0, 0, SCENE_SIZE, SCENE_SIZE, PALETTE.bg);
  titleBand(ctx, SCENE_SIZE, "TOKENS", BAND);

  panel(ctx, REFRESH_BOX.x, REFRESH_BOX.y, REFRESH_BOX.w, REFRESH_BOX.h, view.spinning);
  sprite(ctx, REFRESH_FRAMES[view.spinning ? (view.frame >> 1) % 4 : 0], SPRITE_COLORS, REFRESH_BOX.x + 2, REFRESH_BOX.y + 2);

  const pages = Math.max(1, Math.ceil(view.cards.length / CARDS_PER_PAGE));
  const page = Math.floor(view.frame / PAGE_FRAMES) % pages;
  const inPage = view.frame % PAGE_FRAMES;
  // a página nova entra deslizando da direita em 4 passos
  const offset = pages > 1 && inPage < SLIDE_FRAMES ? (SLIDE_FRAMES - inPage) * 28 : 0;

  view.cards.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE).forEach((card, index) => {
    drawCard(ctx, card, 4 + offset, BAND + 4 + index * 44, view.frame);
  });
  if (view.cards.length === 0) {
    panel(ctx, 4, 24, 112, 60);
    drawText(ctx, "SEM PROVEDOR", 12, 46, PALETTE.ink);
    drawText(ctx, "ative na Config", 12, 58, PALETTE.mid);
  }

  if (view.updatedAtLabel) drawText(ctx, `SYNC ${view.updatedAtLabel}`, 4, 109, PALETTE.mid);
  // pontos de página
  for (let index = 0; index < pages && pages > 1; index += 1) {
    rect(ctx, 116 - (pages - index) * 6, 110, 4, 4, index === page ? PALETTE.ink : PALETTE.surface);
  }
}
