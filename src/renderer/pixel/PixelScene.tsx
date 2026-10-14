import { useCallback, useEffect, useRef } from "react";
import { ensureFont, type Ctx } from "./draw.js";
import { useCssPerPixel } from "./PixelScale.js";

interface PixelSceneProps {
  width: number;
  height: number;
  // quadros por segundo (8 a 12 para sprites)
  fps: number;
  // Desenha um quadro completo; `frame` incrementa a cada passo do timer.
  draw: (ctx: Ctx, frame: number) => void;
  // Clique/arrasto em coordenadas lógicas inteiras.
  onPointerDown?: (x: number, y: number) => void;
  onPointerUp?: (x: number, y: number) => void;
  label?: string;
}

// Canvas na resolução lógica da cena, animado por troca de quadro (sem
// transition/easing) e ampliado pela escala inteira do DeviceFrame.
export function PixelScene({ width, height, fps, draw, onPointerDown, onPointerUp, label }: PixelSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const drawRef = useRef(draw);
  const cssPerPixel = useCssPerPixel();

  const paint = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawRef.current(ctx, frameRef.current);
  }, []);

  useEffect(() => {
    drawRef.current = draw;
    paint();
  }, [draw, paint]);

  useEffect(() => {
    let cancelled = false;
    ensureFont().then(() => {
      if (!cancelled) paint();
    });
    const timer = setInterval(() => {
      frameRef.current += 1;
      paint();
    }, Math.round(1000 / fps));
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fps, paint]);

  const toLogical = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const box = event.currentTarget.getBoundingClientRect();
    return [Math.floor((event.clientX - box.left) / cssPerPixel), Math.floor((event.clientY - box.top) / cssPerPixel)];
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown ? (event) => onPointerDown(...toLogical(event)) : undefined}
      onPointerUp={onPointerUp ? (event) => onPointerUp(...toLogical(event)) : undefined}
      style={{ width: width * cssPerPixel, height: height * cssPerPixel, imageRendering: "pixelated", display: "block" }}
    />
  );
}
