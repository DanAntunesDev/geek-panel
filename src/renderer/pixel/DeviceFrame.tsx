import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PALETTE } from "./palette.js";
import { PixelScaleContext } from "./PixelScale.js";
import { BASE_HEIGHT, BASE_WIDTH, cssPerLogicalPixel, pickScale } from "./scale.js";

const BORDER = 2;

// Palco de resolução fixa (BASE_WIDTH x BASE_HEIGHT) ampliado por fator inteiro
// de pixels físicos. Filhos medem em pixels lógicos via var(--px).
export function DeviceFrame({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [cssPerPixel, setCssPerPixel] = useState(1);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = host.getBoundingClientRect();
      setCssPerPixel(cssPerLogicalPixel(pickScale(rect.width, rect.height, dpr), dpr));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const stageStyle = {
    "--px": `${cssPerPixel}px`,
    width: BASE_WIDTH * cssPerPixel,
    height: BASE_HEIGHT * cssPerPixel,
    border: `${BORDER * cssPerPixel}px solid ${PALETTE.ink}`,
    background: PALETTE.bg,
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    imageRendering: "pixelated",
  } as CSSProperties;

  return (
    <div
      ref={hostRef}
      style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      <PixelScaleContext.Provider value={cssPerPixel}>
        <div style={stageStyle}>{children}</div>
      </PixelScaleContext.Provider>
    </div>
  );
}
