import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig } from "../../shared/types.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import { clockParts, drawClock, newFlipState } from "./clockScene.js";

const FPS = 10;

const FALLBACK_CLOCK_CONFIG: AppConfig["clock"] = {
  timezone: "America/Sao_Paulo",
  showDate: true,
  style: "digital",
  showSeconds: true,
  hour12: false,
  city: "",
};

export function ClockScreen() {
  const [clockConfig, setClockConfig] = useState<AppConfig["clock"]>(FALLBACK_CLOCK_CONFIG);
  const flip = useRef(newFlipState());

  useEffect(() => {
    const load = () => window.painelApi.getConfig().then((config) => setClockConfig(config.clock));
    void load();
    // todo salvamento da Config avisa por aqui; assim estilo e cidade mudam sem reabrir a tela
    return window.painelApi.onThemeUpdate(() => void load());
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      drawClock(ctx, {
        style: clockConfig.style,
        parts: clockParts(new Date(), clockConfig.timezone),
        showSeconds: clockConfig.showSeconds,
        showDate: clockConfig.showDate,
        hour12: clockConfig.hour12,
        timezone: clockConfig.timezone,
        city: clockConfig.city,
        frame,
        flip: flip.current,
      });
    },
    [clockConfig],
  );

  return <PixelScene width={SCENE_SIZE} height={SCENE_SIZE} fps={FPS} draw={draw} label="Relógio" />;
}
