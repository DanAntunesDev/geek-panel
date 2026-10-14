// Paleta fechada: não adicionar cores

import { shadeOf } from "../../shared/theme.js";

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

export type PaletteKey = keyof typeof PALETTE;

export const SPRITE_COLORS = {
  K: PALETTE.ink,
  W: PALETTE.bg,
  S: PALETTE.surface,
  M: PALETTE.mid,
  A: PALETTE.accent,
  B: PALETTE.accentShade,
  ".": null,
} as Record<string, string | null>;

// Troca o magenta; as cenas leem a paleta a cada quadro, então pegam na hora.
export function applyAccent(accent: string): void {
  PALETTE.accent = accent;
  PALETTE.accentShade = shadeOf(accent);
  SPRITE_COLORS.A = PALETTE.accent;
  SPRITE_COLORS.B = PALETTE.accentShade;
  PALETTE_VALUES.splice(0, PALETTE_VALUES.length, ...Object.values(PALETTE));
  document.documentElement.style.setProperty("--accent", PALETTE.accent);
  document.documentElement.style.setProperty("--accent-shade", PALETTE.accentShade);
}

export const PALETTE_VALUES: string[] = Object.values(PALETTE);
