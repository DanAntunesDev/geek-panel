import { useCallback, useEffect, useRef } from "react";
import { PixelScene } from "../pixel/PixelScene.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import type { AgendaState } from "../../shared/types.js";
import { drawAgenda } from "./agendaScene.js";

const FPS = 10;

export function AgendaScreen() {
  const state = useRef<AgendaState>({ connected: false, account: null, events: [], updatedAt: null, error: null });

  useEffect(() => {
    window.painelApi.getAgenda().then((initial) => (state.current = initial));
    return window.painelApi.onAgendaUpdate((update) => (state.current = update));
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    drawAgenda(ctx, { state: state.current, now: Date.now(), frame });
  }, []);

  return <PixelScene width={SCENE_SIZE} height={SCENE_SIZE} fps={FPS} draw={draw} label="Agenda" />;
}
