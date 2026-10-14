// Cor de destaque: o resto da paleta é fixo, só o magenta (e a sombra dele) muda.
import { DEVICE_PALETTE } from "./deviceConstants.js";

export const DEFAULT_ACCENT = DEVICE_PALETTE[4];
export const ACCENT_PATTERN = /^#[0-9A-Fa-f]{6}$/;

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

// Paleta do aparelho para um destaque; a ordem é o índice do pixel no quadro.
export function themePalette(accent: string): string[] {
  const color = accent.toUpperCase();
  return [...DEVICE_PALETTE.slice(0, 4), color, shadeOf(color)];
}
