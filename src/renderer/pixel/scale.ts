// Tudo é desenhado na resolução base e ampliado por fator inteiro de pixels físicos

export const BASE_WIDTH = 160;
export const BASE_HEIGHT = 160;

export function pickScale(availableCssWidth: number, availableCssHeight: number, dpr: number): number {
  const physicalWidth = Math.floor(availableCssWidth * dpr + 1e-6);
  const physicalHeight = Math.floor(availableCssHeight * dpr + 1e-6);
  const fit = Math.min(Math.floor(physicalWidth / BASE_WIDTH), Math.floor(physicalHeight / BASE_HEIGHT));
  return Math.max(1, fit);
}

export function cssPerLogicalPixel(scale: number, dpr: number): number {
  return scale / dpr;
}
