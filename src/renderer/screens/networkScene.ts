import { drawText, rect, type Ctx } from "../pixel/draw.js";
import { PALETTE } from "../pixel/palette.js";
import { led, panel, textCenter, textRight, titleBand, wrap } from "../pixel/ui.js";
import type { NetworkState, NetworkStateOrUnavailable } from "../../shared/types.js";

export const NETWORK_SCENE_SIZE = 156;

const formatMs = (value: number | null) => (value === null ? "--" : `${value.toFixed(1)}ms`);
const formatDbm = (value: number | null) => (value === null ? "--" : `${value.toFixed(1)}dBm`);

function signalLevel(state: NetworkStateOrUnavailable): number {
  if (!state.available) return 0;
  if (state.status === "ONLINE") return 3;
  if (state.status === "DEGRADED") return 2;
  if (state.status === "OFFLINE") return 0;
  return 1;
}

function drawSignal(ctx: Ctx, x: number, y: number, level: number): void {
  [4, 7, 10].forEach((height, index) => {
    rect(ctx, x + index * 5, y + 10 - height, 4, height, index < level ? PALETTE.bg : PALETTE.mid);
  });
}

function drawRow(ctx: Ctx, label: string, value: string, y: number): void {
  drawText(ctx, label, 8, y, PALETTE.ink);
  textRight(ctx, value, 148, y, PALETTE.ink);
  for (let x = 8; x < 148; x += 2) rect(ctx, x, y + 10, 1, 1, PALETTE.mid);
}

function drawUnavailable(ctx: Ctx, frame: number): void {
  panel(ctx, 8, 26, 140, 100);
  rect(ctx, 76, 48, 4, 26, PALETTE.ink);
  rect(ctx, 70, 74, 16, 3, PALETTE.ink);
  rect(ctx, 74, 42, 8, 6, PALETTE.ink);
  if (frame % 6 < 3) {
    rect(ctx, 64, 42, 3, 3, PALETTE.mid);
    rect(ctx, 89, 42, 3, 3, PALETTE.mid);
  } else {
    rect(ctx, 60, 38, 3, 3, PALETTE.mid);
    rect(ctx, 93, 38, 3, 3, PALETTE.mid);
  }
  textCenter(ctx, "SEM SINAL", 78, 88, PALETTE.ink);
  wrap("Monitor de rede nao encontrado", 16).forEach((line, index) => textCenter(ctx, line, 78, 102 + index * 10, PALETTE.mid));
}

function drawAvailable(ctx: Ctx, state: NetworkState, frame: number): void {
  panel(ctx, 4, 20, 148, 30);
  led(ctx, 14, 35, state.status === "ONLINE" ? frame % 10 < 7 : frame % 4 < 2);
  drawText(ctx, state.status, 24, 26, PALETTE.ink);
  const reason = wrap(state.reason || "sem detalhes", 17)[0] ?? "";
  drawText(ctx, reason, 24, 37, PALETTE.mid);

  let y = 58;
  drawRow(ctx, "GATEWAY", formatMs(state.gatewayLatencyMs), y);
  y += 14;
  drawRow(ctx, "INTERNET", formatMs(state.externalAvgLatencyMs), y);
  y += 14;
  drawRow(ctx, "PERDA", state.externalLossPct === null ? "--" : `${state.externalLossPct.toFixed(1)}%`, y);
  if (state.onu?.enabled) {
    y += 14;
    drawRow(ctx, "ONU RX", formatDbm(state.onu.rxDbm), y);
    y += 14;
    drawRow(ctx, "ONU TX", formatDbm(state.onu.txDbm), y);
    y += 14;
    drawRow(ctx, "TEMP", state.onu.temperatureC === null ? "--" : `${state.onu.temperatureC.toFixed(1)}C`, y);
  }
}

export function drawNetwork(ctx: Ctx, state: NetworkStateOrUnavailable, frame: number): void {
  rect(ctx, 0, 0, NETWORK_SCENE_SIZE, NETWORK_SCENE_SIZE, PALETTE.bg);
  titleBand(ctx, NETWORK_SCENE_SIZE, "REDE");
  drawSignal(ctx, 136, 2, signalLevel(state));
  if (state.available) drawAvailable(ctx, state, frame);
  else drawUnavailable(ctx, frame);
}
