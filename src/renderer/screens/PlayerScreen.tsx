import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaState, PlayerCommand } from "../../shared/types.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { buttonAt, drawPlayer, NEEDLE_STEPS, ringFraction, SCENE_SIZE, type ButtonId } from "./playerScene.js";
import { anchorPosition } from "./positionClock.js";
import { seedOf, SKIP_OUT_FRAMES, swapAt, swapDone, trackKey } from "./vinylSwap.js";

const FPS = 10;
const NEEDLE_STEP_FRAMES = 2;
const SEEK_STEP_SECONDS = 10;
const NOTICE_MS = 4000;
// Evita trocar de disco várias vezes seguidas quando o título pisca ao carregar.
const MIN_FRAMES_BETWEEN_SWAPS = 25;

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
  const lastReported = useRef<number | null>(null);
  const swap = useRef({
    ready: false,
    key: null as string | null,
    pending: false,
    skipOut: false,
    start: -1,
    lastStart: -1000,
    shown: { title: "", artist: "" },
  });

  const applyMedia = useCallback((next: MediaState | null) => {
    mediaRef.current = next;
    playingRef.current = next?.status === "Playing";
    const key = next ? trackKey(next.title, next.artist) : null;
    const state = swap.current;

    // a posição real chega a cada leitura; entre elas o relógio local avança
    const reported = next?.positionSeconds ?? 0;
    anim.current.positionTicks =
      anchorPosition({
        local: anim.current.positionTicks / FPS,
        lastReported: lastReported.current,
        reported,
        duration: next?.durationSeconds ?? 0,
        playing: playingRef.current,
        newTrack: key !== state.key,
      }) * FPS;
    lastReported.current = next ? reported : null;

    // a primeira leitura só ajusta; depois, faixa nova pede troca de vinil
    if (state.ready && key && key !== state.key) {
      state.pending = true;
      state.skipOut = state.key === null;
    }
    state.key = key;
    state.ready = true;
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
      const change = swap.current;
      if (change.pending && frame - change.lastStart > MIN_FRAMES_BETWEEN_SWAPS) {
        change.pending = false;
        change.lastStart = frame;
        change.start = frame - (change.skipOut ? SKIP_OUT_FRAMES : 0);
      }
      if (change.start >= 0 && swapDone(frame - change.start)) change.start = -1;
      const timeline = change.start >= 0 ? swapAt(frame - change.start) : null;

      // o disco velho fica congelado até sair; depois segue a faixa atual
      if (!timeline || timeline.content === "new") change.shown = { title: current?.title ?? "", artist: current?.artist ?? "" };

      if (frame !== state.lastFrame) {
        state.lastFrame = frame;
        const target = playingRef.current && !timeline?.armUp ? NEEDLE_STEPS - 1 : 0;
        if (frame % NEEDLE_STEP_FRAMES === 0 && state.needleStep !== target) {
          state.needleStep += Math.sign(target - state.needleStep);
        }
        if (playingRef.current && !timeline?.armUp && state.needleStep === NEEDLE_STEPS - 1) {
          state.spin += 1;
          state.positionTicks += 1;
        }
        if (duration > 0 && state.positionTicks > duration * FPS) state.positionTicks = duration * FPS;
      }

      drawPlayer(ctx, {
        title: notice ?? (change.shown.title || "Nada tocando"),
        artist: notice || !change.shown.title ? "" : change.shown.artist,
        playing: playingRef.current,
        positionSeconds: timeline?.ringHidden ? 0 : state.positionTicks / FPS,
        durationSeconds: duration,
        vinylOffset: timeline?.vinylOffset ?? 0,
        seed: seedOf(change.shown.title, change.shown.artist),
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
