import { drawCat } from "../../src/renderer/pixel/cat.js";
import { disc, drawText, ellipse, pixel, rect, ring, type Ctx } from "../../src/renderer/pixel/draw.js";
import { PALETTE } from "../../src/renderer/pixel/palette.js";
import { SCENE_SIZE } from "../../src/renderer/pixel/scale.js";
import { textCenter } from "../../src/renderer/pixel/ui.js";

// As telas que o aparelho mostra sozinho, antes de achar o painel no PC.
export const WAITING = [
  { name: "wifi", frames: 8 },
  { name: "painel", frames: 8 },
  { name: "config", frames: 4 },
  { name: "codigo", frames: 4 },
] as const;

const dots = (frame: number) => ".".repeat((Math.floor(frame / 2) % 3) + 1).padEnd(3, " ");

function title(ctx: Ctx): void {
  textCenter(ctx, "GEEK PANEL", 60, 6, PALETTE.ink);
  rect(ctx, 22, 16, 76, 2, PALETTE.accent);
}

// Três arcos que acendem um a um, como o ícone de sinal.
function wifiIcon(ctx: Ctx, cx: number, cy: number, frame: number): void {
  const step = Math.floor(frame / 2) % 4;
  disc(ctx, cx, cy, 2, PALETTE.ink);
  [8, 15, 22].forEach((radius, index) => {
    const lit = step > index;
    ring(ctx, cx, cy, radius - 1, radius + 1, lit ? PALETTE.ink : PALETTE.surface, (turn) => Math.min(turn, 1 - turn) < 0.1);
  });
}

// Vinil visto de cima, girando em passos de 45°.
function spinningRecord(ctx: Ctx, cx: number, cy: number, frame: number): void {
  disc(ctx, cx, cy, 23, PALETTE.ink);
  const phase = ((frame % 8) / 8) % 1;
  const near = (turn: number, target: number) => Math.min(Math.abs(turn - target) % 1, 1 - (Math.abs(turn - target) % 1)) < 0.06;
  ring(ctx, cx, cy, 11, 22, PALETTE.mid, (turn) => near(turn, phase) || near(turn, phase + 0.5));
  for (const radius of [14, 18, 22]) ring(ctx, cx, cy, radius - 1, radius, PALETTE.surface, (turn) => !(near(turn, phase) || near(turn, phase + 0.5)));
  disc(ctx, cx, cy, 8, PALETTE.surface);
  disc(ctx, cx, cy, 7, PALETTE.bg);
  const angle = phase * Math.PI * 2;
  rect(ctx, cx + Math.round(Math.sin(angle) * 4) - 1, cy - Math.round(Math.cos(angle) * 4) - 1, 2, 2, PALETTE.ink);
  pixel(ctx, cx, cy, PALETTE.ink);
}

function lines(ctx: Ctx, rows: [string, string][], top: number): void {
  rows.forEach(([text, color], index) => textCenter(ctx, text, 60, top + index * 11, color));
}

export function drawWaiting(ctx: Ctx, state: (typeof WAITING)[number]["name"], frame: number): void {
  rect(ctx, 0, 0, SCENE_SIZE, SCENE_SIZE, PALETTE.bg);
  title(ctx);

  if (state === "wifi") {
    wifiIcon(ctx, 60, 58, frame);
    lines(ctx, [[`CONECTANDO`, PALETTE.ink], [`AO WI-FI${dots(frame)}`.padEnd(11, " "), PALETTE.mid]], 72);
  } else if (state === "painel") {
    spinningRecord(ctx, 60, 44, frame);
    lines(
      ctx,
      [
        ["PROCURANDO O", PALETTE.ink],
        [`GEEK PANEL${dots(frame)}`.slice(0, 13), PALETTE.ink],
        ["abra no PC", PALETTE.mid],
      ],
      74,
    );
  } else if (state === "config") {
    lines(
      ctx,
      [
        ["CONFIGURAR", PALETTE.ink],
        ["Entre no Wi-Fi", PALETTE.mid],
        ["GeekPanel", PALETTE.ink],
        ["e abra o site", PALETTE.mid],
        ["192.168.4.1", PALETTE.ink],
      ],
      30,
    );
    if (frame % 2 === 0) rect(ctx, 56, 90, 8, 3, PALETTE.ink);
  } else {
    lines(
      ctx,
      [
        ["CODIGO DE", PALETTE.ink],
        ["PAREAMENTO", PALETTE.ink],
        ["NAO CONFERE", PALETTE.mid],
        ["veja na Config", PALETTE.mid],
        ["do Geek Panel", PALETTE.mid],
      ],
      30,
    );
    if (frame % 2 === 0) {
      ellipse(ctx, 60, 92, 5, 5, PALETTE.ink);
      drawText(ctx, "!", 57, 89, PALETTE.bg);
    }
  }

  // o gato dorme no canto, menos nas telas de instrução
  if (state === "wifi" || state === "painel") drawCat(ctx, { x: 4, y: 101, frame, awake: false });
}
