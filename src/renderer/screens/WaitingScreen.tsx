import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyContrast } from "../../shared/theme.js";
import { Segmented } from "../components/config/ui.js";
import { DeviceFrame } from "../pixel/DeviceFrame.js";
import { PixelScene } from "../pixel/PixelScene.js";
import { FRAME, WAITING_PALETTE, WAITING_STATES, WaitingRain } from "../waiting/waitingRain.js";

const FPS = 10;

type State = (typeof WAITING_STATES)[number]["id"];

// A tela que o aparelho mostra quando não acha o painel, desenhada aqui do mesmo jeito e com o contraste atual.
function WaitingScene({ state, contrast }: { state: State; contrast: number }) {
  const rain = useRef(new WaitingRain(Math.floor(Math.random() * 0xffff) + 1));
  const last = useRef(-1);
  const pixels = useRef<Uint8Array>(new Uint8Array(FRAME * FRAME));
  const colors = useMemo(
    () => WAITING_PALETTE.map((hex) => applyContrast(hex, contrast)).map((hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))),
    [contrast],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      // o quadro só avança uma vez por passo do relógio, mesmo que a tela seja redesenhada antes
      rain.current.message(WAITING_STATES.findIndex((item) => item.id === state));
      if (frame !== last.current) {
        last.current = frame;
        pixels.current = rain.current.step();
      }
      const image = ctx.createImageData(FRAME, FRAME);
      for (let at = 0; at < pixels.current.length; at += 1) {
        image.data.set(colors[pixels.current[at]] ?? [0, 0, 0], at * 4);
        image.data[at * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    },
    [colors, state],
  );

  return <PixelScene width={FRAME} height={FRAME} fps={FPS} draw={draw} label="Tela de espera" />;
}

export function WaitingScreen() {
  const [state, setState] = useState<State>("painel");
  const [contrast, setContrast] = useState(50);

  useEffect(() => {
    const load = () => window.painelApi.getConfig().then((config) => setContrast(config.device.contrast));
    void load();
    // todo salvamento (e os controles de brilho e contraste) avisa por aqui
    return window.painelApi.onThemeUpdate(() => void load());
  }, []);

  return (
    <>
      <DeviceFrame>
        <WaitingScene state={state} contrast={contrast} />
      </DeviceFrame>
      <div style={{ padding: "0 16px 16px", flexShrink: 0 }}>
        <p className="cfg-note">É isto que o aparelho mostra quando não acha o painel. Escolha a situação para ver a frase de baixo.</p>
        <Segmented label="Situação" value={state} options={WAITING_STATES.map((item) => ({ value: item.id, label: item.label }))} onChange={setState} />
      </div>
    </>
  );
}
