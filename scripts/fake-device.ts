// GeekMagic de mentira: acha o app por UDP, conecta e salva os quadros recebidos em PNG.
import * as dgram from "node:dgram";
import { mkdirSync, writeFileSync } from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { decodeFrame, DEVICE_PALETTE, DISCOVERY_PORT, FRAME_SIZE, MESSAGE, message, MessageReader, SCALE } from "../src/shared/deviceProtocol.js";

const [outDir = "frames", seconds = "8", host = "255.255.255.255", code = ""] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

function png(pixels: Uint8Array): Buffer {
  const size = FRAME_SIZE * SCALE;
  const rgb = DEVICE_PALETTE.map((hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)));
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x += 1) {
      const color = rgb[pixels[Math.floor(y / SCALE) * FRAME_SIZE + Math.floor(x / SCALE)]];
      raw.set(color, row + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function discover(): Promise<{ address: string; port: number }> {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  await new Promise<void>((resolve) => socket.bind(0, () => resolve()));
  socket.setBroadcast(true);
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      socket.send(Buffer.from("GPNL?\x01"), DISCOVERY_PORT, host);
      const reply = await new Promise<{ data: Buffer; address: string } | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 1000);
        socket.once("message", (data, remote) => {
          clearTimeout(timer);
          resolve({ data, address: remote.address });
        });
      });
      if (reply?.data.subarray(0, 5).toString() === "GPNL!") return { address: reply.address, port: reply.data.readUInt16BE(6) };
    }
    throw new Error("o app não respondeu à descoberta");
  } finally {
    socket.close();
  }
}

const found = await discover();
console.log(`app em ${found.address}:${found.port}`);

const socket = net.connect(found.port, found.address);
const reader = new MessageReader();
let frames = 0;
let bytes = 0;
const types: Record<string, number> = {};
socket.on("connect", () => socket.write(message(MESSAGE.hello, Buffer.concat([Buffer.from([1, code.length]), Buffer.from(code)]))));
socket.on("data", (chunk) => {
  bytes += chunk.length;
  for (const item of reader.push(chunk)) {
    types[item.type] = (types[item.type] ?? 0) + 1;
    if (item.type === MESSAGE.frame) {
      frames += 1;
      if (frames === 1 || frames % 25 === 0) writeFileSync(path.join(outDir, `frame-${String(frames).padStart(4, "0")}.png`), png(decodeFrame(item.body)));
    }
  }
});
const ping = setInterval(() => socket.write(message(MESSAGE.ping)), 2000);

await new Promise((resolve) => setTimeout(resolve, Number(seconds) * 1000));
clearInterval(ping);
socket.destroy();
console.log(JSON.stringify({ seconds: Number(seconds), frames, kbPerSecond: Math.round(bytes / 1024 / Number(seconds)), mensagens: types }));
