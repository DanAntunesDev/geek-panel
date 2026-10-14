import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config/ConfigStore.js";
import { anthropicMonthTokens, monthStart, openaiMonthTokens, UsageService } from "../../src/main/usageSource.js";
import type { SecretStore } from "../../src/main/secretStore.js";
import type { UsageCard } from "../../src/shared/types.js";

let server: http.Server;
let base: string;
let calls: { url: string; headers: http.IncomingHttpHeaders }[];
let handler: (url: URL) => { status: number; body: unknown };

beforeEach(async () => {
  calls = [];
  handler = () => ({ status: 200, body: {} });
  server = http.createServer((req, res) => {
    calls.push({ url: req.url ?? "", headers: req.headers });
    const reply = handler(new URL(req.url ?? "/", "http://x"));
    res.writeHead(reply.status, { "Content-Type": "application/json" }).end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => new Promise((resolve) => server.close(resolve)));

const since = new Date(Date.UTC(2026, 9, 1));
const fetchLike = (url: string, init: { headers: Record<string, string> }) => fetch(url, init);

describe("monthStart", () => {
  it("é o primeiro dia do mês, à meia-noite UTC", () => {
    expect(monthStart(Date.UTC(2026, 9, 14, 15, 30)).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("anthropicMonthTokens", () => {
  it("soma entrada, cache e saída de todos os dias, seguindo as páginas", async () => {
    handler = (url) =>
      url.searchParams.get("page")
        ? { status: 200, body: { data: [{ results: [{ uncached_input_tokens: 5, output_tokens: 5 }] }], has_more: false, next_page: null } }
        : {
            status: 200,
            body: {
              data: [{ results: [{ uncached_input_tokens: 100, cache_read_input_tokens: 50, output_tokens: 20, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 5 } }] }, { results: [] }],
              has_more: true,
              next_page: "page_2",
            },
          };
    expect(await anthropicMonthTokens("admin-key", since, fetchLike, base)).toBe(185 + 10);
    expect(calls[0].url).toContain("/v1/organizations/usage_report/messages?starting_at=2026-10-01");
    expect(calls[0].headers["x-api-key"]).toBe("admin-key");
    expect(calls[0].headers["anthropic-version"]).toBe("2023-06-01");
    expect(calls[1].url).toContain("page=page_2");
  });

  it("explica chave recusada", async () => {
    handler = () => ({ status: 403, body: {} });
    await expect(anthropicMonthTokens("x", since, fetchLike, base)).rejects.toThrow("recusada");
  });
});

describe("openaiMonthTokens", () => {
  it("soma entrada e saída e usa start_time em segundos", async () => {
    handler = () => ({ status: 200, body: { data: [{ results: [{ input_tokens: 1000, output_tokens: 250, input_cached_tokens: 400 }] }], next_page: null } });
    expect(await openaiMonthTokens("admin", since, fetchLike, base)).toBe(1250);
    expect(calls[0].url).toContain(`start_time=${Math.floor(since.getTime() / 1000)}`);
    expect(calls[0].headers.authorization).toBe("Bearer admin");
  });
});

describe("UsageService", () => {
  const secrets = (map: Record<string, string>) => ({ get: async (name: string) => map[name] ?? null }) as unknown as SecretStore;
  const config = (limits: Record<string, number> = {}) => ({
    ...DEFAULT_CONFIG,
    usage: { ...DEFAULT_CONFIG.usage, providers: { ...DEFAULT_CONFIG.usage.providers, openai: { enabled: true }, anthropic: { enabled: true }, gemini: { enabled: true } }, limits },
  });

  function service(map: Record<string, string>, limits = {}) {
    const seen: UsageCard[][] = [];
    const usage = new UsageService({
      secrets: secrets(map),
      config: async () => config(limits),
      onState: (cards) => seen.push(cards),
      baseUrls: { openai: base, anthropic: base },
      now: () => Date.UTC(2026, 9, 14),
    });
    return { usage, seen };
  }

  it("monta um cartão por provedor ativo com o motivo quando falta dado", async () => {
    handler = (url) => ({ status: 200, body: url.pathname.includes("anthropic") || url.pathname.includes("organizations") ? { data: [{ results: [{ output_tokens: 300 }] }] } : { data: [] } });
    const { usage } = service({ "usage:anthropic": "k" }, { anthropic: 1000 });
    const cards = await usage.refresh();
    const anthropic = cards.find((card) => card.id === "anthropic")!;
    expect(anthropic).toMatchObject({ used: 300, limit: 1000, percentage: 30, status: "ok" });
    expect(cards.find((card) => card.id === "openai")).toMatchObject({ status: "unavailable", note: "falta chave admin" });
    expect(cards.find((card) => card.id === "gemini")).toMatchObject({ status: "unavailable", note: "sem API de consumo" });
  });

  it("sem limite definido não calcula porcentagem", async () => {
    handler = () => ({ status: 200, body: { data: [{ results: [{ input_tokens: 10, output_tokens: 5 }] }] } });
    const { usage } = service({ "usage:openai": "k" });
    expect((await usage.refresh()).find((card) => card.id === "openai")).toMatchObject({ used: 15, limit: 0, percentage: 0, status: "ok" });
  });

  it("mantém o último valor como 'stale' quando a leitura falha depois", async () => {
    handler = () => ({ status: 200, body: { data: [{ results: [{ input_tokens: 40, output_tokens: 2 }] }] } });
    const { usage } = service({ "usage:openai": "k" });
    await usage.refresh();
    handler = () => ({ status: 500, body: {} });
    const card = (await usage.refresh()).find((item) => item.id === "openai")!;
    expect(card).toMatchObject({ used: 42, status: "stale" });
    expect(card.note).toContain("500");
  });
});
