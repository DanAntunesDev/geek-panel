import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { probeDevice } from "../../src/main/deviceProbe.js";

let server: http.Server | undefined;

async function start(routes: Record<string, { status?: number; body: string }>): Promise<number> {
  server = http.createServer((req, res) => {
    const route = routes[req.url ?? ""];
    if (!route) return void res.writeHead(404).end("404");
    res.writeHead(route.status ?? 200, { "Content-Type": "application/json" }).end(route.body);
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined))));

describe("probeDevice", () => {
  it("lê modelo, versão e espaço livre", async () => {
    const port = await start({
      "/v.json": { body: '{"m": "SmallTV-Ultra","v":"Ultra-V9.0.51"}' },
      "/space.json": { body: '{"total":3121152,"free":2252300}' },
    });
    expect(await probeDevice("127.0.0.1", port)).toEqual({ ok: true, model: "SmallTV-Ultra", version: "Ultra-V9.0.51", freeBytes: 2252300 });
  });

  it("funciona mesmo sem /space.json", async () => {
    const port = await start({ "/v.json": { body: '{"m":"X","v":"1"}' } });
    expect(await probeDevice("127.0.0.1", port)).toMatchObject({ ok: true, freeBytes: null });
  });

  it("rejeita quem não parece uma GeekMagic", async () => {
    expect(await probeDevice("127.0.0.1", await start({ "/v.json": { body: "<html>oi</html>" } }))).toEqual({ ok: false, reason: "not-geekmagic" });
  });

  it("separa porta fechada de tempo esgotado", async () => {
    expect(await probeDevice("127.0.0.1", 1, undefined, 800)).toEqual({ ok: false, reason: "unreachable" });
    const hang = http.createServer(() => undefined);
    await new Promise<void>((resolve) => hang.listen(0, "127.0.0.1", resolve));
    const result = await probeDevice("127.0.0.1", (hang.address() as AddressInfo).port, undefined, 300);
    hang.closeAllConnections();
    await new Promise((resolve) => hang.close(resolve));
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });
});
