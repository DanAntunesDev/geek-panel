import { useCallback, useEffect, useState } from "react";
import type { DeviceState } from "../../shared/types.js";
import { FrameTapContext } from "../pixel/FrameTap.js";
import { SCENE_SIZE } from "../pixel/scale.js";
import { AgendaScreen } from "../screens/AgendaScreen.js";
import { ClockScreen } from "../screens/ClockScreen.js";
import { PlayerScreen } from "../screens/PlayerScreen.js";
import { UsageScreen } from "../screens/UsageScreen.js";
import { toIndexed } from "./indexed.js";

// Janela oculta que desenha a tela do aparelho e manda cada quadro para o PC enviar.
export function DeviceApp() {
  const [state, setState] = useState<DeviceState>({ active: false, screen: "clock" });

  useEffect(() => {
    window.painelApi.getDeviceState().then(setState);
    return window.painelApi.onDeviceState(setState);
  }, []);

  const tap = useCallback((ctx: CanvasRenderingContext2D) => {
    window.painelApi.pushDeviceFrame(toIndexed(ctx.getImageData(0, 0, SCENE_SIZE, SCENE_SIZE).data));
  }, []);

  // sem aparelho conectado não há o que desenhar
  if (!state.active) return null;

  return (
    <FrameTapContext.Provider value={tap}>
      {state.screen === "player" ? <PlayerScreen /> : null}
      {state.screen === "usage" ? <UsageScreen /> : null}
      {state.screen === "clock" ? <ClockScreen /> : null}
      {state.screen === "agenda" ? <AgendaScreen /> : null}
    </FrameTapContext.Provider>
  );
}
