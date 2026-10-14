import { drawText, rect, sprite, type Ctx } from "../pixel/draw.js";
import { PALETTE, SPRITE_COLORS } from "../pixel/palette.js";
import type { PixelGrid } from "../pixel/PixelCanvas.js";
import { panel, refreshSpinner, segmentedBar, textRight, titleBand, truncate } from "../pixel/ui.js";
import type { UsageCard } from "../../shared/types.js";

export const USAGE_SCENE_SIZE = 156;

export const REFRESH_BOX = { x: 138, y: 1, w: 14, h: 12 };

export function isRefreshHit(x: number, y: number): boolean {
  return x >= REFRESH_BOX.x && x < REFRESH_BOX.x + REFRESH_BOX.w && y >= REFRESH_BOX.y && y < REFRESH_BOX.y + REFRESH_BOX.h;
}

export interface UsageView {
  cards: UsageCard[];
  spinFramesLeft: number;
  updatedAtLabel: string;
  frame: number;
}

const COIN: PixelGrid = [
  "..KKKK..",
  ".KSSSSK.",
  "KSSMMSSK",
  "KSMKKMSK",
  "KSMKKMSK",
  "KSSMMSSK",
  ".KSSSSK.",
  "..KKKK..",
];

const STATUS_LABEL: Record<UsageCard["status"], string> = {
  ok: "OK",
  stale: "ANTIGO",
  unavailable: "OFF",
};

function drawCard(ctx: Ctx, card: UsageCard, y: number, frame: number): void {
  panel(ctx, 4, y, 148, 58);
  sprite(ctx, COIN, SPRITE_COLORS, 9, y + 5);
  drawText(ctx, truncate(card.label, 9).toUpperCase(), 21, y + 5, PALETTE.ink);

  const label = STATUS_LABEL[card.status];
  const chipW = label.length * 8 + 6;
  const chipX = 148 - chipW;
  rect(ctx, chipX, y + 4, chipW, 11, PALETTE.ink);
  if (card.status !== "ok") rect(ctx, chipX + 1, y + 5, chipW - 2, 9, card.status === "stale" && frame % 10 < 5 ? PALETTE.surface : PALETTE.mid);
  drawText(ctx, label, chipX + 3, y + 5, card.status === "ok" ? PALETTE.bg : PALETTE.ink);

  drawText(ctx, `${card.used}/${card.limit}`, 9, y + 20, PALETTE.ink);
  textRight(ctx, `${card.percentage}%`, 147, y + 20, PALETTE.ink);
  drawText(ctx, truncate(card.period, 18), 9, y + 31, PALETTE.mid);
  segmentedBar(ctx, 9, y + 43, 138, 9, card.percentage, 16);
}

export function drawUsage(ctx: Ctx, view: UsageView): void {
  rect(ctx, 0, 0, USAGE_SCENE_SIZE, USAGE_SCENE_SIZE, PALETTE.bg);
  titleBand(ctx, USAGE_SCENE_SIZE, "TOKENS");

  panel(ctx, REFRESH_BOX.x, REFRESH_BOX.y, REFRESH_BOX.w, REFRESH_BOX.h, view.spinFramesLeft > 0);
  refreshSpinner(ctx, REFRESH_BOX.x + 7, REFRESH_BOX.y + 6, view.spinFramesLeft > 0 ? view.frame : 0, PALETTE.ink);

  view.cards.slice(0, 2).forEach((card, index) => drawCard(ctx, card, 20 + index * 62, view.frame));
  if (view.cards.length === 0) drawText(ctx, "SEM DADOS", 40, 70, PALETTE.mid);

  drawText(ctx, `ATUALIZADO ${view.updatedAtLabel}`, 6, 144, PALETTE.mid);
}
