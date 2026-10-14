import { describe, expect, it } from "vitest";
import { PALETTE } from "../../src/renderer/pixel/palette.js";
import {
  configMessage,
  DEVICE_PALETTE,
  decodeFrame,
  discoveryReply,
  encodeFrame,
  FRAME_SIZE,
  frameMessage,
  MESSAGE,
  message,
  MessageReader,
  rgb565,
} from "../../src/shared/deviceProtocol.js";

describe("paleta do aparelho", () => {
  it("espelha a paleta do app, na mesma ordem dos índices", () => {
    const fromApp = [PALETTE.bg, PALETTE.surface, PALETTE.mid, PALETTE.ink, PALETTE.accent, PALETTE.accentShade].map((hex) => hex.toUpperCase());
    expect([...DEVICE_PALETTE]).toEqual(fromApp);
  });

  it("converte cor para RGB565", () => {
    expect(rgb565("#FFFFFF")).toBe(0xffff);
    expect(rgb565("#000000")).toBe(0);
    expect(rgb565("#FF0000")).toBe(0xf800);
    expect(rgb565("#0000FF")).toBe(0x001f);
  });
});

describe("RLE do quadro", () => {
  it("volta igual ao decodificar, inclusive com trechos maiores que 255", () => {
    const pixels = new Uint8Array(FRAME_SIZE * FRAME_SIZE).fill(0);
    pixels.fill(3, 1000, 1700);
    pixels[5] = 4;
    pixels[14399] = 2;
    expect([...decodeFrame(encodeFrame(pixels))]).toEqual([...pixels]);
  });

  it("um quadro liso cabe em poucos bytes", () => {
    expect(encodeFrame(new Uint8Array(FRAME_SIZE * FRAME_SIZE)).length).toBeLessThan(120);
  });

  it("rejeita quadro com tamanho errado", () => {
    expect(() => decodeFrame(Uint8Array.from([10, 1]))).toThrow("incompleto");
    expect(() => decodeFrame(Uint8Array.from([255, 1]), 100)).toThrow("maior");
  });
});

describe("mensagens", () => {
  it("monta e lê mensagens que chegam quebradas em pedaços", () => {
    const first = message(MESSAGE.ping);
    const second = frameMessage(new Uint8Array(FRAME_SIZE * FRAME_SIZE).fill(1));
    const all = Buffer.concat([first, second]);
    const reader = new MessageReader();
    const seen = [...reader.push(all.subarray(0, 2)), ...reader.push(all.subarray(2, 5)), ...reader.push(all.subarray(5))];
    expect(seen.map((item) => item.type)).toEqual([MESSAGE.ping, MESSAGE.frame]);
    expect([...decodeFrame(seen[1].body)].every((value) => value === 1)).toBe(true);
  });

  it("a configuração leva tamanho, escala e as cores", () => {
    const config = configMessage();
    expect(config[0]).toBe(MESSAGE.config);
    const body = config.subarray(3);
    expect([body[0], body[1], body[2], body[3]]).toEqual([120, 120, 2, 6]);
    expect(body.readUInt16BE(4)).toBe(rgb565(DEVICE_PALETTE[0]));
  });

  it("a resposta da descoberta traz a versão e a porta TCP", () => {
    const reply = discoveryReply(4601);
    expect(reply.subarray(0, 5).toString()).toBe("GPNL!");
    expect(reply.readUInt16BE(6)).toBe(4601);
  });
});
