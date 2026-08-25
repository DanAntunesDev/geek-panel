import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpApp, resolveBindHost } from "../../src/main/httpServer.js";
import { DEFAULT_CONFIG } from "../../src/config/ConfigStore.js";
import { PROTOCOL_VERSION } from "../../src/shared/protocol.js";

function testApp() {
  return createHttpApp(() => DEFAULT_CONFIG);
}

describe("GET /api/health", () => {
  it("responde 200 com status genérico, sem detalhes do sistema", async () => {
    const res = await request(testApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/state", () => {
  it("responde com o contrato versionado e dados fictícios", async () => {
    const res = await request(testApp()).get("/api/state");
    expect(res.status).toBe(200);
    expect(res.body.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(res.body).toHaveProperty("player");
    expect(res.body).toHaveProperty("usage");
    expect(res.body).toHaveProperty("clock");
    expect(typeof res.body.sequence).toBe("number");
  });

  it("incrementa o sequence a cada chamada, para o firmware descartar respostas antigas", async () => {
    const app = testApp();
    const first = await request(app).get("/api/state");
    const second = await request(app).get("/api/state");
    expect(second.body.sequence).toBeGreaterThan(first.body.sequence);
  });
});

describe("rotas desconhecidas", () => {
  it("responde 404 sem vazar stack trace", async () => {
    const res = await request(testApp()).get("/api/nao-existe");
    expect(res.status).toBe(404);
  });
});

describe("rate limit", () => {
  it("responde 429 após exceder o limite por IP", async () => {
    const app = testApp();
    let lastStatus = 200;
    for (let i = 0; i < 25; i += 1) {
      const res = await request(app).get("/api/health");
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("resolveBindHost", () => {
  it("usa loopback quando o modo LAN está desligado", () => {
    expect(resolveBindHost(DEFAULT_CONFIG)).toBe("127.0.0.1");
  });

  it("cai para loopback quando o modo LAN está ligado sem interface válida", () => {
    const config = { ...DEFAULT_CONFIG, server: { ...DEFAULT_CONFIG.server, lanMode: true, lanInterface: "interface-inexistente" } };
    expect(resolveBindHost(config)).toBe("127.0.0.1");
  });
});
