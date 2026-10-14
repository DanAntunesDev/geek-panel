// Paleta base do painel; só o destaque e as cores de tokens e relógio mudam pela Config.

import { readableOn, shadeOf } from "../../shared/theme.js";
import type { ThemeConfig } from "../../shared/types.js";

export const PALETTE = {
  bg: "#F7F6F3",
  surface: "#D9D7D2",
  ink: "#1C1C1C",
  // ponto médio entre surface e ink
  mid: "#787877",
  // magenta: só spray, pontas do equalizador, sublinhado do marquee e anel de progresso
  accent: "#E8368F",
  // accent escurecido
  accentShade: "#A5276A",
};

export const SPRITE_COLORS = {
  K: PALETTE.ink,
  W: PALETTE.bg,
  S: PALETTE.surface,
  M: PALETTE.mid,
  A: PALETTE.accent,
  B: PALETTE.accentShade,
  ".": null,
} as Record<string, string | null>;

// Cores escolhidas na Config; null deixa a cena com o visual original.
export const THEME: Pick<ThemeConfig, "tokens" | "clock"> = {
  tokens: [null, null],
  clock: { hour: null, minute: null, second: null, date: null, weekday: null, city: null },
};

export const colorOr = (chosen: string | null, fallback: string): string => chosen ?? fallback;

// As cenas leem a paleta e o tema a cada quadro, então pegam a troca na hora.
export function applyTheme(theme: ThemeConfig): void {
  PALETTE.accent = theme.accent;
  PALETTE.accentShade = shadeOf(theme.accent);
  SPRITE_COLORS.A = PALETTE.accent;
  SPRITE_COLORS.B = PALETTE.accentShade;
  THEME.tokens = [...theme.tokens];
  THEME.clock = { ...theme.clock };
  const root = document.documentElement.style;
  root.setProperty("--accent", PALETTE.accent);
  root.setProperty("--accent-shade", PALETTE.accentShade);
  root.setProperty("--on-accent", readableOn(PALETTE.accent));
}
