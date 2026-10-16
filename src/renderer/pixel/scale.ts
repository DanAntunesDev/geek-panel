// A cena tem 120x120: no GeekMagic (240x240) cada pixel lógico vira 2x2 exato.
// A moldura do aparelho fica ao redor e só existe na janela do app.

export const SCENE_SIZE = 120;
export const FRAME_PAD = 4;
export const FRAME_SIZE = SCENE_SIZE + FRAME_PAD * 2;

export function pickScale(availableCssWidth: number, availableCssHeight: number, dpr: number): number {
  const physicalWidth = Math.floor(availableCssWidth * dpr + 1e-6);
  const physicalHeight = Math.floor(availableCssHeight * dpr + 1e-6);
  const fit = Math.min(Math.floor(physicalWidth / FRAME_SIZE), Math.floor(physicalHeight / FRAME_SIZE));
  return Math.max(1, fit);
}

export function cssPerLogicalPixel(scale: number, dpr: number): number {
  return scale / dpr;
}
