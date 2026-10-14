import { createContext, useContext } from "react";

export const PixelScaleContext = createContext<number>(1);

export function useCssPerPixel(): number {
  return useContext(PixelScaleContext);
}
