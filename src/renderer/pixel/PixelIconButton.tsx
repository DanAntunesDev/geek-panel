import type { PixelColorMap, PixelGrid } from "./PixelCanvas.js";
import { PixelCanvas } from "./PixelCanvas.js";

interface PixelIconButtonProps {
  grid: PixelGrid;
  colors: PixelColorMap;
  scale?: number;
  onClick?: () => void;
  disabled?: boolean;
  label: string;
}

export function PixelIconButton({ grid, colors, scale = 3, onClick, disabled, label }: PixelIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: "none",
        padding: 6,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        display: "flex",
      }}
    >
      <PixelCanvas grid={grid} colors={colors} scale={scale} />
    </button>
  );
}
