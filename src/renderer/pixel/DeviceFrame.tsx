import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PALETTE } from "./palette.js";
import { PixelScaleContext } from "./PixelScale.js";
import { cssPerLogicalPixel, FRAME_PAD, FRAME_SIZE, pickScale, SCENE_SIZE } from "./scale.js";

// Caixa do aparelho (4 px lógicos) em volta da tela de 120x120.
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

  const px = cssPerPixel;
  const caseStyle: CSSProperties = {
    width: FRAME_SIZE * px,
    height: FRAME_SIZE * px,
    boxSizing: "border-box",
    border: `${px}px solid ${PALETTE.ink}`,
    padding: (FRAME_PAD - 2) * px,
    background: PALETTE.surface,
    flexShrink: 0,
    imageRendering: "pixelated",
  };
  const screenStyle: CSSProperties = {
    width: SCENE_SIZE * px + 2 * px,
    height: SCENE_SIZE * px + 2 * px,
    boxSizing: "border-box",
    border: `${px}px solid ${PALETTE.ink}`,
    background: PALETTE.bg,
    overflow: "hidden",
  };

  return (
    <div ref={hostRef} style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <PixelScaleContext.Provider value={cssPerPixel}>
        <div style={caseStyle}>
          <div style={screenStyle}>{children}</div>
        </div>
      </PixelScaleContext.Provider>
    </div>
  );
}
