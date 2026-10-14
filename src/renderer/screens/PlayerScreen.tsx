import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaState, PlayerCommand } from "../../shared/types.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { buttonAt, drawPlayer, NEEDLE_STEPS, ringFraction, SCENE_SIZE, type ButtonId } from "./playerScene.js";

const FPS = 10;
const NEEDLE_STEP_FRAMES = 2;
const SEEK_STEP_SECONDS = 10;
const NOTICE_MS = 4000;

const COMMANDS: Record<ButtonId, PlayerCommand> = {
  previous: { type: "previous" },
  back: { type: "seekBy", seconds: -SEEK_STEP_SECONDS },
  toggle: { type: "playPause" },
  forward: { type: "seekBy", seconds: SEEK_STEP_SECONDS },
  next: { type: "next" },
};

export function PlayerScreen() {
  const [pressed, setPressed] = useState<ButtonId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const anim = useRef({ lastFrame: -1, needleStep: 0, spin: 0, positionTicks: 0 });
  const mediaRef = useRef<MediaState | null>(null);
  const playingRef = useRef(false);

  const applyMedia = useCallback((next: MediaState | null) => {
    mediaRef.current = next;
    playingRef.current = next?.status === "Playing";
    // a posição real chega a cada leitura; entre elas o relógio local avança
    anim.current.positionTicks = (next?.positionSeconds ?? 0) * FPS;
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.painelApi.getPlayback().then((state) => {
      if (!cancelled) applyMedia(state.media);
    });
    const unsubscribe = window.painelApi.onPlaybackUpdate((state) => applyMedia(state.media));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyMedia]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const send = useCallback((command: PlayerCommand) => {
    window.painelApi.controlPlayback(command).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "falha no comando";
      setNotice(message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    });
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const state = anim.current;
      const current = mediaRef.current;
      const duration = current?.durationSeconds ?? 0;
      if (frame !== state.lastFrame) {
        state.lastFrame = frame;
        const target = playingRef.current ? NEEDLE_STEPS - 1 : 0;
        if (frame % NEEDLE_STEP_FRAMES === 0 && state.needleStep !== target) {
          state.needleStep += Math.sign(target - state.needleStep);
        }
        if (playingRef.current && state.needleStep === NEEDLE_STEPS - 1) {
          state.spin += 1;
          state.positionTicks += 1;
        }
        if (duration > 0 && state.positionTicks > duration * FPS) state.positionTicks = duration * FPS;
      }

      drawPlayer(ctx, {
        title: notice ?? (current?.title || "Nada tocando"),
        artist: notice || !current?.title ? "" : current.artist,
        playing: playingRef.current,
        positionSeconds: state.positionTicks / FPS,
        durationSeconds: duration,
        pressed,
        controlsEnabled: current !== null,
        needleStep: state.needleStep,
        spin: state.spin,
        frame,
      });
    },
    [pressed, notice],
  );

  const handleDown = (x: number, y: number) => {
    const fraction = ringFraction(x, y);
    const duration = mediaRef.current?.durationSeconds ?? 0;
    if (fraction !== null && duration > 0) {
      anim.current.positionTicks = fraction * duration * FPS;
      send({ type: "seekTo", seconds: Math.floor(fraction * duration) });
      return;
    }
    setPressed(buttonAt(x, y));
  };

  const handleUp = (x: number, y: number) => {
    const released = buttonAt(x, y);
    if (released && released === pressed && mediaRef.current) send(COMMANDS[released]);
    setPressed(null);
  };

  return <PixelScene width={SCENE_SIZE} height={SCENE_SIZE} fps={FPS} draw={draw} onPointerDown={handleDown} onPointerUp={handleUp} label="Player" />;
}
