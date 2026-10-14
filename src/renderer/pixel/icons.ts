import type { PixelGrid } from "./PixelCanvas.js";

export function windowCloseIcon(): PixelGrid {
  return ["K......K", "KK....KK", ".KK..KK.", "..KKKK..", "..KKKK..", ".KK..KK.", "KK....KK", "K......K"];
}

export function windowMinimizeIcon(): PixelGrid {
  return ["........", "........", "........", "........", ".KKKKKK.", ".KKKKKK.", "........", "........"];
}

export function windowMaximizeIcon(): PixelGrid {
  return ["........", ".KKKKKK.", ".K....K.", ".K....K.", ".K....K.", ".K....K.", ".KKKKKK.", "........"];
}
