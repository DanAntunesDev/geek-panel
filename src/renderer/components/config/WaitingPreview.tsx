import { useEffect, useRef, useState } from "react";
import { COLS, FRAME, WAITING_PALETTE, WAITING_STATES, WaitingRain } from "../../waiting/waitingRain.js";
import { Modal } from "./Modal.js";
import { Segmented } from "./ui.js";

const FPS = 10;
const ZOOM = 3;

const PALETTE_RGB = WAITING_PALETTE.map((hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)));

// A tela que o aparelho mostra quando não acha o painel, desenhada aqui do mesmo jeito.
export function WaitingPreview({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rain = useRef(new WaitingRain(Math.floor(Math.random() * 0xffff) + 1));
  const [state, setState] = useState<(typeof WAITING_STATES)[number]["id"]>("painel");

  useEffect(() => {
    rain.current.message(WAITING_STATES.findIndex((item) => item.id === state));
  }, [state]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const image = context.createImageData(FRAME, FRAME);
    const timer = setInterval(() => {
      const pixels = rain.current.step();
      for (let at = 0; at < pixels.length; at += 1) {
        image.data.set(PALETTE_RGB[pixels[at]] ?? [0, 0, 0], at * 4);
        image.data[at * 4 + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    }, 1000 / FPS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Modal title="Tela de espera do aparelho" onClose={onClose}>
      <div className="help-body">
        <p className="cfg-note">É isto que o aparelho mostra quando não acha o painel. A frase de baixo muda conforme o que está acontecendo.</p>
        <Segmented label="Situação" value={state} options={WAITING_STATES.map((item) => ({ value: item.id, label: item.label }))} onChange={setState} />
        <canvas
          ref={canvas}
          width={FRAME}
          height={FRAME}
          role="img"
          aria-label="Prévia da tela de espera"
          style={{ display: "block", margin: "16px auto", width: FRAME * ZOOM, height: FRAME * ZOOM, imageRendering: "pixelated", border: "3px solid var(--ink)" }}
        />
        <p className="cfg-note">As letras caem e a frase aparece decifrada em {COLS} colunas, como no aparelho.</p>
      </div>
    </Modal>
  );
}
