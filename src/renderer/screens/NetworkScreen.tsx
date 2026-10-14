import { useCallback, useEffect, useState } from "react";
import type { NetworkStateOrUnavailable } from "../../shared/types.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { drawNetwork, NETWORK_SCENE_SIZE } from "./networkScene.js";

const FPS = 10;

export function NetworkScreen() {
  const [state, setState] = useState<NetworkStateOrUnavailable>({ available: false });

  useEffect(() => {
    let cancelled = false;
    window.painelApi.getNetworkState().then((initial) => {
      if (!cancelled) setState(initial);
    });
    const unsubscribe = window.painelApi.onNetworkStateUpdate((update) => setState(update));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => drawNetwork(ctx, state, frame), [state]);

  return <PixelScene width={NETWORK_SCENE_SIZE} height={NETWORK_SCENE_SIZE} fps={FPS} draw={draw} label="Rede" />;
}
