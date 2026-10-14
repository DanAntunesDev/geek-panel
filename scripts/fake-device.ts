// GeekMagic de mentira: acha o app por UDP, conecta e salva os quadros recebidos em PNG.
import * as dgram from "node:dgram";
import { mkdirSync, writeFileSync } from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { decodeFrame, DISCOVERY_PORT, MESSAGE, message, MessageReader } from "../src/shared/deviceProtocol.js";
import { png } from "./png.js";

const [outDir = "frames", seconds = "8", host = "255.255.255.255", code = ""] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

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
