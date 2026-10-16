// Protocolo entre o app (PC) e o GeekMagic. O firmware repete estas constantes em C++.
//
// Descoberta (UDP, porta 4602): o aparelho manda "GPNL?" + versão em broadcast e o
// app responde "GPNL!" + versão + porta TCP (2 bytes). Depois o aparelho abre o TCP.
//
// Fluxo (TCP): mensagens [tipo u8][tamanho u16 BE][corpo]. O PC desenha, o aparelho só exibe.
// Só o processo principal importa este arquivo (usa Buffer); a interface usa deviceConstants.

import { DEVICE_PALETTE, FRAME_SIZE, MESSAGE, PROTOCOL_VERSION, rgb565, SCALE } from "./deviceConstants.js";

export * from "./deviceConstants.js";

export const DISCOVERY_REQUEST = Buffer.from("GPNL?");
export const DISCOVERY_REPLY = Buffer.from("GPNL!");

export function message(type: number, body: Uint8Array = new Uint8Array(0)): Buffer {
  if (body.length > 0xffff) throw new Error("corpo grande demais");
  const out = Buffer.alloc(3 + body.length);
  out[0] = type;
  out.writeUInt16BE(body.length, 1);
  out.set(body, 3);
  return out;
}

export function configMessage(palette: readonly string[] = DEVICE_PALETTE): Buffer {
  const body = Buffer.alloc(4 + palette.length * 2);
  body[0] = FRAME_SIZE;
  body[1] = FRAME_SIZE;
  body[2] = SCALE;
  body[3] = palette.length;
  palette.forEach((hex, index) => body.writeUInt16BE(rgb565(hex), 4 + index * 2));
  return message(MESSAGE.config, body);
}

// RLE: pares [repetições 1..255][índice]. Telas pixel art têm poucos trechos distintos.
export function encodeFrame(pixels: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let index = 0; index < pixels.length; ) {
    const value = pixels[index];
    let run = 1;
    while (index + run < pixels.length && pixels[index + run] === value && run < 255) run += 1;
    out.push(run, value);
    index += run;
  }
  return Uint8Array.from(out);
}

export function decodeFrame(body: Uint8Array, length = FRAME_SIZE * FRAME_SIZE): Uint8Array {
  const pixels = new Uint8Array(length);
  let at = 0;
  for (let index = 0; index + 1 < body.length; index += 2) {
    const run = body[index];
    if (at + run > length) throw new Error("quadro maior que o esperado");
    pixels.fill(body[index + 1], at, at + run);
    at += run;
  }
  if (at !== length) throw new Error("quadro incompleto");
  return pixels;
}

export function frameMessage(pixels: Uint8Array): Buffer {
  return message(MESSAGE.frame, encodeFrame(pixels));
}

export function discoveryReply(tcpPort: number): Buffer {
  const out = Buffer.alloc(DISCOVERY_REPLY.length + 3);
  out.set(DISCOVERY_REPLY, 0);
  out[DISCOVERY_REPLY.length] = PROTOCOL_VERSION;
  out.writeUInt16BE(tcpPort, DISCOVERY_REPLY.length + 1);
  return out;
}

// Lê mensagens de um fluxo TCP que chega em pedaços.
export class MessageReader {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): { type: number; body: Buffer }[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: { type: number; body: Buffer }[] = [];
    while (this.buffer.length >= 3) {
      const size = this.buffer.readUInt16BE(1);
      if (this.buffer.length < 3 + size) break;
      messages.push({ type: this.buffer[0], body: this.buffer.subarray(3, 3 + size) });
      this.buffer = this.buffer.subarray(3 + size);
    }
    return messages;
  }
}
