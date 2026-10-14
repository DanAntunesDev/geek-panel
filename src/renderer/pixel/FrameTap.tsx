import { createContext, useContext } from "react";
import type { Ctx } from "./draw.js";

// Quem fornece isto recebe cada quadro pintado (usado pela janela que alimenta o aparelho).
export type FrameTap = (ctx: Ctx, width: number, height: number) => void;

export const FrameTapContext = createContext<FrameTap | null>(null);

export function useFrameTap(): FrameTap | null {
  return useContext(FrameTapContext);
}
