import { useCallback, useRef, useState } from "react";
import { buildFakeUsageCards } from "../../services/fixtures/fakeState.js";
import type { UsageCard } from "../../shared/types.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { drawUsage, isRefreshHit, USAGE_SCENE_SIZE } from "./usageScene.js";

const FPS = 10;
const SPIN_FRAMES = 8;

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function UsageScreen() {
  const [cards, setCards] = useState<UsageCard[]>(() => buildFakeUsageCards());
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const spinUntil = useRef(-1);
  const frameRef = useRef(0);

  function refresh() {
    spinUntil.current = frameRef.current + SPIN_FRAMES;
    // simulado até existir a fonte real de uso
    setCards(
      buildFakeUsageCards().map((card) => {
        const jitter = Math.floor(Math.random() * Math.round(card.limit * 0.05));
        const used = Math.min(card.limit, card.used + jitter);
        return { ...card, used, remaining: card.limit - used, percentage: Math.round((used / card.limit) * 100) };
      }),
    );
    setUpdatedAt(new Date());
  }

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      frameRef.current = frame;
      drawUsage(ctx, {
        cards,
        spinFramesLeft: Math.max(0, spinUntil.current - frame),
        updatedAtLabel: timeLabel(updatedAt),
        frame,
      });
    },
    [cards, updatedAt],
  );

  return (
    <PixelScene
      width={USAGE_SCENE_SIZE}
      height={USAGE_SCENE_SIZE}
      fps={FPS}
      draw={draw}
      onPointerDown={(x, y) => {
        if (isRefreshHit(x, y)) refresh();
      }}
      label="Tokens"
    />
  );
}
