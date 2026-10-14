// Paleta fechada: não adicionar cores

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
} as const;

export type PaletteKey = keyof typeof PALETTE;

export const SPRITE_COLORS = {
  K: PALETTE.ink,
  W: PALETTE.bg,
  S: PALETTE.surface,
  M: PALETTE.mid,
  A: PALETTE.accent,
  B: PALETTE.accentShade,
  ".": null,
} as const;

export const PALETTE_VALUES: readonly string[] = Object.values(PALETTE);
