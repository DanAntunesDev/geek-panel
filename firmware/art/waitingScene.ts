import { drawText, rect, type Ctx } from "../../src/renderer/pixel/draw.js";
import { PALETTE } from "../../src/renderer/pixel/palette.js";
import { SCENE_SIZE } from "../../src/renderer/pixel/scale.js";
import { textCenter } from "../../src/renderer/pixel/ui.js";

// A tela que o aparelho mostra sozinho, antes de achar o painel no PC: letras caindo ao fundo
// (desenhadas no aparelho, veja src/rain.cpp) e, por cima, uma caixa com o que está acontecendo.
export const WAITING = [
  { name: "wifi", frames: 4 },
  { name: "painel", frames: 4 },
  { name: "config", frames: 2 },
  { name: "codigo", frames: 2 },
] as const;

type Line = [text: string, tone: "ink" | "mid"];

const CONTENT: Record<(typeof WAITING)[number]["name"], Line[]> = {
  wifi: [["CONECTANDO", "ink"], ["AO WI-FI", "mid"]],
  painel: [["PROCURANDO", "ink"], ["GEEK PANEL", "ink"], ["abra no PC", "mid"]],
  config: [["CONFIGURAR", "ink"], ["Entre no Wi-Fi", "mid"], ["GeekPanel", "ink"], ["e abra o site", "mid"], ["192.168.4.1", "ink"]],
  codigo: [["CODIGO DE", "ink"], ["PAREAMENTO", "ink"], ["NAO CONFERE", "mid"], ["veja na Config", "mid"], ["do Geek Panel", "mid"]],
};

// Cor que o gerador troca por "transparente" (índice 15) no aparelho.
export const TRANSPARENT = "#FF00FF";

const dots = (frame: number) => ".".repeat((frame % 3) + 1);

// Caixa preta de borda branca no meio da tela; o texto é claro, e a última linha ganha um cursor piscando.
export function drawWaiting(ctx: Ctx, state: (typeof WAITING)[number]["name"], frame: number): void {
  rect(ctx, 0, 0, SCENE_SIZE, SCENE_SIZE, TRANSPARENT);
  const lines = CONTENT[state];
  const height = lines.length * 11 + 14;
  const top = Math.floor((SCENE_SIZE - height) / 2);

  rect(ctx, 2, top, 116, height, PALETTE.bg);
  rect(ctx, 3, top + 1, 114, height - 2, PALETTE.ink);
  rect(ctx, 5, top + 3, 110, height - 6, PALETTE.mid);
  rect(ctx, 6, top + 4, 108, height - 8, PALETTE.ink);

  lines.forEach(([text, tone], index) => {
    const shown = state === "wifi" && index === 1 ? `${text}${dots(frame)}` : text;
    const y = top + 8 + index * 11;
    textCenter(ctx, shown.padEnd(text.length, " "), 60, y, tone === "ink" ? PALETTE.bg : PALETTE.surface);
  });

  // cursor piscando embaixo, como num terminal
  if (frame % 2 === 0) drawText(ctx, "_", 56, top + height - 11, PALETTE.bg);
}
