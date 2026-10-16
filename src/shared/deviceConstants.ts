// Constantes do protocolo do aparelho, sem nada do Node: a interface também importa daqui.

export const PROTOCOL_VERSION = 1;
export const TCP_PORT = 4601;
export const DISCOVERY_PORT = 4602;

// Corpo do hello: [versão][tamanho do código][código em ASCII].
export const HELLO_WAIT_MS = 3000;

export const FRAME_SIZE = 120;
export const SCALE = 2;

export const MESSAGE = {
  // aparelho -> PC
  hello: 0x10,
  // PC -> aparelho
  config: 0x01,
  frame: 0x02,
  brightness: 0x04,
  // PC -> aparelho: código de pareamento errado (corpo: 1 byte de motivo)
  reject: 0x05,
  // nos dois sentidos
  ping: 0x03,
} as const;

// Ordem da paleta = índice do pixel no quadro. Espelha renderer/pixel/palette.ts.
export const DEVICE_PALETTE = ["#F7F6F3", "#D9D7D2", "#787877", "#1C1C1C", "#E8368F", "#A5276A"] as const;

export function rgb565(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
}
