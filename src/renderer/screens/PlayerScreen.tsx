import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaState, PlayerCommand } from "../../shared/types.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { buttonAt, drawPlayer, NEEDLE_STEPS, ringFraction, SCENE_SIZE, volumeAt, type ButtonId } from "./playerScene.js";
import { anchorPosition } from "./positionClock.js";
import { advanceSwap, newSwapState, requestSwap, seedOf, swapAt, trackArrived, trackKey } from "./vinylSwap.js";

const FPS = 10;
const NEEDLE_STEP_FRAMES = 2;
const SEEK_STEP_SECONDS = 10;
// Tempo sem tocar (em quadros) antes de a agulha subir sozinha.
const PAUSE_GRACE_FRAMES = 15;
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

  const anim = useRef({ lastFrame: -1, needleStep: 0, spin: 0, positionTicks: 0, silentFrames: 0 });
  const mediaRef = useRef<MediaState | null>(null);
  const playingRef = useRef(false);
  const lastReported = useRef<number | null>(null);
  // volume pedido por clique vale até a fonte confirmar (ou por 3 s)
  const volumeAsked = useRef<{ level: number; until: number } | null>(null);
  const lastAudible = useRef(0.5);
  const swap = useRef({
    ...newSwapState(),
    ready: false,
    key: null as string | null,
    shown: { title: "", artist: "" },
  });
  // pausa de verdade (clique no botão) levanta a agulha na hora; sumiço breve do player não
  const userPaused = useRef<number | null>(null);

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

    // a primeira leitura só ajusta; depois, faixa nova pede troca de vinil.
    // Título vazio (player carregando) não conta: só vale a próxima faixa de verdade.
    if (state.ready && key && key !== state.key) trackArrived(state);
    // a leitura logo depois do clique ainda pode dizer "tocando": só vale a partir de 1,5 s
    if (playingRef.current && userPaused.current !== null && Date.now() - userPaused.current > 1500) userPaused.current = null;
    if (key) state.key = key;
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

  const currentVolume = (): number | null => {
    const asked = volumeAsked.current;
    if (asked && asked.until > Date.now()) return asked.level;
    const reported = mediaRef.current?.volume;
    if (typeof reported === "number" && reported > 0) lastAudible.current = reported;
    return typeof reported === "number" ? reported : null;
  };

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const state = anim.current;
      const current = mediaRef.current;
      const duration = current?.durationSeconds ?? 0;
      const change = swap.current;
      advanceSwap(change, frame);
      const timeline = change.start >= 0 ? swapAt(frame - change.start) : null;

      // o disco velho fica congelado até sair; depois segue a faixa atual
      if (!timeline || (timeline.content === "new" && !change.pending)) change.shown = { title: current?.title ?? "", artist: current?.artist ?? "" };

      if (frame !== state.lastFrame) {
        state.lastFrame = frame;
        // o player some por um instante ao trocar de música: a agulha só sobe se a pausa durar
        state.silentFrames = playingRef.current ? 0 : state.silentFrames + 1;
        const keepsPlaying = userPaused.current === null && (playingRef.current || state.silentFrames < PAUSE_GRACE_FRAMES);
        const target = keepsPlaying && !timeline?.armUp ? NEEDLE_STEPS - 1 : 0;
        if (frame % NEEDLE_STEP_FRAMES === 0 && state.needleStep !== target) {
          state.needleStep += Math.sign(target - state.needleStep);
        }
        // o disco só gira com a agulha em baixo, mas o tempo da música corre sempre que ela toca
        if (keepsPlaying && !timeline?.armUp && state.needleStep === NEEDLE_STEPS - 1) state.spin += 1;
        if (playingRef.current) state.positionTicks += 1;
        if (duration > 0 && state.positionTicks > duration * FPS) state.positionTicks = duration * FPS;
      }

      drawPlayer(ctx, {
        title: notice ?? (change.shown.title || "Nada tocando"),
        artist: notice || !change.shown.title ? "" : change.shown.artist,
        playing: userPaused.current === null && (playingRef.current || state.silentFrames < PAUSE_GRACE_FRAMES),
        positionSeconds: timeline?.ringHidden ? 0 : state.positionTicks / FPS,
        durationSeconds: duration,
        volume: currentVolume(),
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
    const volume = volumeAt(x, y);
    if (volume) {
      const now = currentVolume();
      if (now === null || !mediaRef.current) {
        setNotice("este player não deixa mudar o volume");
        return;
      }
      const level = volume.kind === "level" ? volume.level : now > 0 ? 0 : lastAudible.current;
      volumeAsked.current = { level, until: Date.now() + 3000 };
      send({ type: "volume", level });
      return;
    }

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
    if (released && released === pressed && mediaRef.current) {
      if (released === "next" || released === "previous") requestSwap(swap.current);
      if (released === "toggle") userPaused.current = playingRef.current ? Date.now() : null;
      send(COMMANDS[released]);
    }
    setPressed(null);
  };

  return <PixelScene width={SCENE_SIZE} height={SCENE_SIZE} fps={FPS} draw={draw} onPointerDown={handleDown} onPointerUp={handleUp} label="Player" />;
}
