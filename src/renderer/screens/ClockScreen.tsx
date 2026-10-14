import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig } from "../../shared/types.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { CLOCK_SCENE_SIZE, clockParts, drawClock, newFlipState } from "./clockScene.js";

const FPS = 10;

const FALLBACK_CLOCK_CONFIG: AppConfig["clock"] = {
  timezone: "America/Sao_Paulo",
  showDate: true,
  style: "digital",
  showSeconds: true,
  hour12: false,
};

export function ClockScreen({ connected }: { connected: boolean }) {
  const [clockConfig, setClockConfig] = useState<AppConfig["clock"]>(FALLBACK_CLOCK_CONFIG);
  const flip = useRef(newFlipState());

  useEffect(() => {
    window.painelApi.getConfig().then((config) => setClockConfig(config.clock));
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      drawClock(ctx, {
        style: clockConfig.style,
        parts: clockParts(new Date(), clockConfig.timezone),
        showSeconds: clockConfig.showSeconds,
        showDate: clockConfig.showDate,
        hour12: clockConfig.hour12,
        connected,
        frame,
        flip: flip.current,
      });
    },
    [clockConfig, connected],
  );

  return <PixelScene width={CLOCK_SCENE_SIZE} height={CLOCK_SCENE_SIZE} fps={FPS} draw={draw} label="Relógio" />;
}
