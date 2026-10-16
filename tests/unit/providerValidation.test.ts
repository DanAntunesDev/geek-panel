import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { validateProviderKey } from "../../src/main/providerValidation.js";
import { BUILTIN_PROVIDERS } from "../../src/shared/providers.js";

const spec = (id: string) => BUILTIN_PROVIDERS.find((provider) => provider.id === id)!;

let server: http.Server | undefined;
let lastHeaders: http.IncomingHttpHeaders = {};

async function start(status: number): Promise<string> {
  server = http.createServer((req, res) => {
    lastHeaders = req.headers;
    res.writeHead(status).end("{}");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)));
  server = undefined;
});

describe("validateProviderKey", () => {
  it("aceita chave com resposta 200 e envia o cabeçalho certo de cada provedor", async () => {
    const base = await start(200);
    expect(await validateProviderKey(spec("openai"), "k1", { baseUrl: base })).toEqual({ state: "valid" });
    expect(lastHeaders.authorization).toBe("Bearer k1");
    await validateProviderKey(spec("anthropic"), "k2", { baseUrl: base });
    expect(lastHeaders["x-api-key"]).toBe("k2");
    expect(lastHeaders["anthropic-version"]).toBeDefined();
    await validateProviderKey(spec("gemini"), "k3", { baseUrl: base });
    expect(lastHeaders["x-goog-api-key"]).toBe("k3");
  });

  it("marca 401 como inválida e 429 como limitada", async () => {
    expect(await validateProviderKey(spec("openai"), "x", { baseUrl: await start(401) })).toEqual({ state: "invalid" });
    await new Promise((resolve) => server!.close(resolve));
    expect(await validateProviderKey(spec("openai"), "x", { baseUrl: await start(429) })).toEqual({ state: "limited" });
  });

  it("trata 400 do Gemini como chave inválida", async () => {
    expect(await validateProviderKey(spec("gemini"), "x", { baseUrl: await start(400) })).toEqual({ state: "invalid" });
  });

  it("não devolve a chave em erros de rede", async () => {
    const result = await validateProviderKey(spec("openai"), "segredo-123", { baseUrl: "http://127.0.0.1:1", timeoutMs: 500 });
    expect(result.state).toBe("error");
    expect(JSON.stringify(result)).not.toContain("segredo-123");
  });

  it("usa o cabeçalho próprio de um provedor personalizado", async () => {
    const base = await start(200);
    const custom = { id: "meu-provedor", label: "Meu", baseUrl: "https://x", path: "/ping", authStyle: "header" as const, headerName: "x-minha-chave" };
    expect(await validateProviderKey(custom, "abc", { baseUrl: base })).toEqual({ state: "valid" });
    expect(lastHeaders["x-minha-chave"]).toBe("abc");
  });

  it("rejeita chave vazia sem chamar a rede", async () => {
    expect(await validateProviderKey(spec("openai"), "  ")).toEqual({ state: "invalid" });
  });
});
