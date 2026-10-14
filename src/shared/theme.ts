// Cores do painel: a base é fixa; o destaque, os tokens e o relógio podem ser trocados.
import { DEVICE_PALETTE } from "./deviceConstants.js";
import type { ThemeConfig } from "./types.js";

export const DEFAULT_ACCENT = DEVICE_PALETTE[4];
export const ACCENT_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_THEME: ThemeConfig = {
  accent: DEFAULT_ACCENT,
  tokens: [null, null],
  clock: { hour: null, minute: null, second: null, date: null, weekday: null, city: null },
};

const SHADE = 0.72;

// O magenta padrão mantém a sombra desenhada à mão; as outras cores escurecem na proporção.
export function shadeOf(hex: string): string {
  if (hex.toUpperCase() === DEFAULT_ACCENT) return DEVICE_PALETTE[5];
  const value = Number.parseInt(hex.slice(1), 16);
  const part = (shift: number) =>
    Math.round(((value >> shift) & 0xff) * SHADE)
      .toString(16)
      .padStart(2, "0");
  return `#${part(16)}${part(8)}${part(0)}`.toUpperCase();
}

// Cor de texto legível sobre um fundo qualquer.
export function readableOn(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((value >> 16) & 0xff) + 0.587 * ((value >> 8) & 0xff) + 0.114 * (value & 0xff)) / 255;
  return luminance > 0.6 ? DEVICE_PALETTE[3] : DEVICE_PALETTE[0];
}

// Ordem das cores extras na paleta (depois das 6 de base).
export function themeColors(theme: ThemeConfig): (string | null)[] {
  const { clock } = theme;
  return [theme.tokens[0] ?? null, theme.tokens[1] ?? null, clock.hour, clock.minute, clock.second, clock.date, clock.weekday, clock.city];
}

export const PALETTE_SIZE = 6 + 8;

// Paleta do aparelho: a ordem é o índice do pixel no quadro. Cor não escolhida ocupa o lugar com o tom do texto.
export function themePalette(theme: ThemeConfig): string[] {
  const accent = theme.accent.toUpperCase();
  return [...DEVICE_PALETTE.slice(0, 4), accent, shadeOf(accent), ...themeColors(theme).map((color) => (color ?? DEVICE_PALETTE[3]).toUpperCase())];
}
