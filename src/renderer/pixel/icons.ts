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

// Seta circular 7x7 (atualizar). Girar 90° é sem perda, então o giro fica nítido.
const REFRESH: PixelGrid = ["..KKK..", ".K...K.", "K....KK", "K...KKK", "K......", ".K...K.", "..KKK.."];

function rotate(grid: PixelGrid): PixelGrid {
  const size = grid.length;
  return grid[0].split("").map((_, col) => grid.map((_, row) => grid[size - 1 - row][col]).join(""));
}

export const REFRESH_FRAMES: PixelGrid[] = [0, 1, 2].reduce<PixelGrid[]>((frames) => [...frames, rotate(frames[frames.length - 1])], [REFRESH]);
