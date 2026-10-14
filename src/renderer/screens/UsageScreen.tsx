import { useCallback, useEffect, useRef } from "react";
import { PixelScene } from "../pixel/PixelScene.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import type { UsageCard } from "../../shared/types.js";
import { drawUsage, isRefreshHit } from "./usageScene.js";

const FPS = 10;
const SPIN_FRAMES = 8;

const clock = (date: Date) => date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function UsageScreen() {
  const cards = useRef<UsageCard[]>([]);
  const updatedAt = useRef<Date | null>(null);
  const spinUntil = useRef(-1);
  const frameRef = useRef(0);

  useEffect(() => {
    const apply = (next: UsageCard[]) => {
      cards.current = next;
      updatedAt.current = new Date();
    };
    window.painelApi.getUsage().then(apply);
    return window.painelApi.onUsageUpdate(apply);
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    frameRef.current = frame;
    drawUsage(ctx, {
      cards: cards.current,
      spinning: frame < spinUntil.current,
      updatedAtLabel: updatedAt.current ? clock(updatedAt.current) : null,
      frame,
    });
  }, []);

  return (
    <PixelScene
      width={SCENE_SIZE}
      height={SCENE_SIZE}
      fps={FPS}
      draw={draw}
      onPointerDown={(x, y) => {
        if (!isRefreshHit(x, y)) return;
        spinUntil.current = frameRef.current + SPIN_FRAMES;
        void window.painelApi.refreshUsage();
      }}
      label="Tokens"
    />
  );
}
