import * as dgram from "node:dgram";
import * as net from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeviceLink } from "../../src/main/deviceLink.js";
import { decodeFrame, FRAME_SIZE, MESSAGE, message, MessageReader } from "../../src/shared/deviceProtocol.js";

const pixels = (value: number) => new Uint8Array(FRAME_SIZE * FRAME_SIZE).fill(value);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Aparelho falso: conecta, manda o hello e guarda o que recebe.
function hello(code = ""): Buffer {
  return message(MESSAGE.hello, Buffer.concat([Buffer.from([1, code.length]), Buffer.from(code)]));
}

async function fakeDevice(port: number, code = "") {
  const received: { type: number; body: Buffer }[] = [];
  const socket = net.connect(port, "127.0.0.1");
  const reader = new MessageReader();
  socket.on("data", (chunk) => received.push(...reader.push(chunk)));
  socket.on("error", () => undefined);
  await new Promise<void>((resolve) => socket.once("connect", () => resolve()));
  socket.write(hello(code));
  return { socket, received, closed: new Promise<void>((resolve) => socket.once("close", () => resolve())) };
}

describe("DeviceLink", () => {
  let link: DeviceLink;

  beforeEach(async () => {
    link = new DeviceLink({ tcpPort: 0, discoveryPort: 0, keepAliveMs: 200, idleTimeoutMs: 700 });
    await link.start();
  });

  afterEach(() => link.stop());

  it("responde à descoberta com a porta TCP", async () => {
    const client = dgram.createSocket("udp4");
    const reply = await new Promise<Buffer>((resolve) => {
      client.once("message", resolve);
      client.send(Buffer.from("GPNL?\x01"), link.ports().discovery, "127.0.0.1");
    });
    client.close();
    expect(reply.subarray(0, 5).toString()).toBe("GPNL!");
    expect(reply.readUInt16BE(6)).toBe(link.ports().tcp);
  });

  it("ignora pacotes que não são da descoberta", async () => {
    const client = dgram.createSocket("udp4");
    let answered = false;
    client.on("message", () => (answered = true));
    client.send(Buffer.from("lixo"), link.ports().discovery, "127.0.0.1");
    await wait(150);
    client.close();
    expect(answered).toBe(false);
  });

  it("manda a configuração e o quadro atual ao conectar, e só reenvia quando muda", async () => {
    link.setFrame(pixels(1));
    const device = await fakeDevice(link.ports().tcp);
    await wait(150);
    expect(device.received[0].type).toBe(MESSAGE.config);
    const frames = () => device.received.filter((item) => item.type === MESSAGE.frame);
    expect(frames()).toHaveLength(1);
    expect([...decodeFrame(frames()[0].body)].every((value) => value === 1)).toBe(true);

    link.setFrame(pixels(1));
    await wait(80);
    expect(frames()).toHaveLength(1);

    link.setFrame(pixels(3));
    await wait(120);
    expect(frames()).toHaveLength(2);
    expect(link.status()).toMatchObject({ connected: true, address: "127.0.0.1" });
    device.socket.destroy();
  });

  it("repassa o brilho e mantém a ligação viva com pings", async () => {
    const device = await fakeDevice(link.ports().tcp);
    link.setBrightness(150);
    await wait(500);
    expect(device.received.find((item) => item.type === MESSAGE.brightness)?.body[0]).toBe(100);
    expect(device.received.filter((item) => item.type === MESSAGE.ping).length).toBeGreaterThanOrEqual(1);
    device.socket.destroy();
  });

  it("o aparelho mais novo substitui o antigo", async () => {
    const first = await fakeDevice(link.ports().tcp);
    await wait(80);
    const second = await fakeDevice(link.ports().tcp);
    await first.closed;
    link.setFrame(pixels(2));
    await wait(120);
    expect(second.received.some((item) => item.type === MESSAGE.frame)).toBe(true);
    second.socket.destroy();
  });

  it("derruba o aparelho que fica calado e avisa a mudança de estado", async () => {
    const states: boolean[] = [];
    link.on("status", (status) => states.push(status.connected));
    const device = await fakeDevice(link.ports().tcp);
    await device.closed;
    await wait(100);
    expect(states).toEqual([true, false]);
    expect(link.status().connected).toBe(false);
  });

  it("com código de pareamento, recusa o código errado e aceita o certo", async () => {
    await link.stop();
    link = new DeviceLink({ tcpPort: 0, discoveryPort: 0, keepAliveMs: 200, idleTimeoutMs: 700, helloWaitMs: 300, pairingCode: () => "482915" });
    await link.start();

    const wrong = await fakeDevice(link.ports().tcp, "000000");
    await wrong.closed;
    expect(wrong.received.map((item) => item.type)).toEqual([MESSAGE.reject]);
    expect(link.status()).toMatchObject({ connected: false, rejected: "127.0.0.1" });

    link.setFrame(pixels(1));
    const right = await fakeDevice(link.ports().tcp, "482915");
    await wait(150);
    expect(right.received[0].type).toBe(MESSAGE.config);
    expect(link.status()).toMatchObject({ connected: true, rejected: null });
    right.socket.destroy();
  });

  it("descarta quem conecta e não se apresenta", async () => {
    await link.stop();
    link = new DeviceLink({ tcpPort: 0, discoveryPort: 0, helloWaitMs: 200 });
    await link.start();
    const mute = net.connect(link.ports().tcp, "127.0.0.1");
    mute.on("error", () => undefined);
    await new Promise<void>((resolve) => mute.once("close", () => resolve()));
    expect(link.status().connected).toBe(false);
  });

  it("avisa quando a porta já está em uso", async () => {
    const other = new DeviceLink({ tcpPort: link.ports().tcp, discoveryPort: 0 });
    await expect(other.start()).rejects.toBeDefined();
    expect(other.status().error).toContain("em uso");
  });
});
