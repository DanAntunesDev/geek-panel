import { useEffect, useRef } from "react";
import { useCssPerPixel } from "./PixelScale.js";

export type PixelGrid = string[];
export type PixelColorMap = Record<string, string | null>;

interface PixelCanvasProps {
  grid: PixelGrid;
  colors: PixelColorMap;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PixelCanvas({ grid, colors, scale = 1, className, style }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cssPerPixel = useCssPerPixel();
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const factor = Math.max(1, Math.round(scale)) * cssPerPixel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cols, rows);
    for (let y = 0; y < rows; y += 1) {
      const line = grid[y];
      for (let x = 0; x < cols; x += 1) {
        const color = colors[line[x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }, [grid, colors, rows, cols]);

  return (
    <canvas
      ref={canvasRef}
      width={cols}
      height={rows}
      className={className}
      style={{
        width: cols * factor,
        height: rows * factor,
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}
