import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigStore, DEFAULT_CONFIG, validateConfig, ConfigValidationError } from "../../src/config/ConfigStore.js";

describe("validateConfig", () => {
  it("aceita a configuração padrão", () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
  });

  it("preenche campos ausentes com o padrão", () => {
    const result = validateConfig({ device: { host: "10.0.0.5" } });
    expect(result.device.host).toBe("10.0.0.5");
    expect(result.device.port).toBe(DEFAULT_CONFIG.device.port);
  });

  it("rejeita host inválido", () => {
    expect(() => validateConfig({ device: { host: "; rm -rf /" } })).toThrow(ConfigValidationError);
  });

  it("rejeita porta fora do intervalo", () => {
    expect(() => validateConfig({ device: { port: 70000 } })).toThrow(ConfigValidationError);
    expect(() => validateConfig({ device: { port: 0 } })).toThrow(ConfigValidationError);
  });

  it("rejeita duração de rotação fora do intervalo", () => {
    expect(() => validateConfig({ rotation: { usageSeconds: 0 } })).toThrow(ConfigValidationError);
  });

  it("rejeita modo de rotação desconhecido", () => {
    expect(() => validateConfig({ rotation: { mode: "invalido" } })).toThrow(ConfigValidationError);
  });

  it("rejeita entrada que não é objeto", () => {
    expect(() => validateConfig(null)).toThrow(ConfigValidationError);
    expect(() => validateConfig("texto")).toThrow(ConfigValidationError);
  });
  it("rejeita estilo de relógio e fuso horário inválidos", () => {
    expect(() => validateConfig({ clock: { style: "neon" } })).toThrow(ConfigValidationError);
    expect(() => validateConfig({ clock: { timezone: "Marte/Olympus" } })).toThrow("fuso");
  });

  it("aceita links do próprio serviço e rejeita outros hosts ou http", () => {
    const withUrl = (service: string, url: string) => ({ media: { sources: { [service]: { enabled: true, url } } } });
    expect(() => validateConfig(withUrl("spotify", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"))).not.toThrow();
    expect(() => validateConfig(withUrl("youtube", "https://youtu.be/dQw4w9WgXcQ"))).not.toThrow();
    expect(() => validateConfig(withUrl("spotify", "https://evil.example/track/x"))).toThrow(ConfigValidationError);
    expect(() => validateConfig(withUrl("youtube", "http://youtu.be/dQw4w9WgXcQ"))).toThrow(ConfigValidationError);
  });

  it("completa fontes e provedores ausentes com o padrão", () => {
    const result = validateConfig({ media: { sources: { spotify: { enabled: true } } }, usage: { providers: { openai: { enabled: true } } } });
    expect(result.media.sources.spotify).toEqual({ enabled: true, url: "" });
    expect(result.media.sources.youtube).toEqual({ enabled: false, url: "" });
    expect(result.usage.providers.openai.enabled).toBe(true);
    expect(result.usage.providers.gemini.enabled).toBe(false);
  });

  it("rejeita ID de aplicativo com caracteres estranhos", () => {
    expect(() => validateConfig({ media: { spotifyClientId: "abc def<script>" } })).toThrow("ID");
  });

  it("aceita provedor personalizado e cria o registro de ativação", () => {
    const custom = { id: "meu-provedor", label: "Meu", baseUrl: "https://api.exemplo.com", path: "/v1/models", authStyle: "bearer" };
    const result = validateConfig({ usage: { customProviders: [custom], providers: { "meu-provedor": { enabled: true }, fantasma: { enabled: true } } } });
    expect(result.usage.providers["meu-provedor"]).toEqual({ enabled: true });
    expect(result.usage.providers.fantasma).toBeUndefined();
    expect(result.usage.providers.openai).toEqual({ enabled: false });
  });

  it("rejeita provedor personalizado inseguro ou repetido", () => {
    const base = { id: "meu-provedor", label: "Meu", baseUrl: "https://api.exemplo.com", path: "/v1/models", authStyle: "bearer" };
    const withProvider = (patch: object) => ({ usage: { customProviders: [{ ...base, ...patch }] } });
    expect(() => validateConfig(withProvider({ baseUrl: "http://api.exemplo.com" }))).toThrow("https");
    expect(() => validateConfig(withProvider({ baseUrl: "https://api.exemplo.com/v1" }))).toThrow("https");
    expect(() => validateConfig(withProvider({ id: "openai" }))).toThrow("repetido");
    expect(() => validateConfig(withProvider({ path: "v1/models" }))).toThrow("rota");
    expect(() => validateConfig(withProvider({ authStyle: "header", headerName: "x y" }))).toThrow("cabeçalho");
  });

});

describe("ConfigStore", () => {
  let dir: string;
  let store: ConfigStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "geek-panel-config-"));
    store = new ConfigStore(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("retorna o padrão quando o arquivo não existe", async () => {
    expect(await store.load()).toEqual(DEFAULT_CONFIG);
  });

  it("salva e recarrega a configuração validada", async () => {
    await store.save({ device: { host: "10.0.0.9", port: 8080, requestTimeoutMs: 2000 } });
    const loaded = await store.load();
    expect(loaded.device.host).toBe("10.0.0.9");
    expect(loaded.device.port).toBe(8080);
  });

  it("salva o arquivo com permissões restritas", async () => {
    await store.save(DEFAULT_CONFIG);
    const stat = await fs.stat(path.join(dir, "config.json"));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("não sobrescreve o arquivo quando a validação falha", async () => {
    await store.save(DEFAULT_CONFIG);
    await expect(store.save({ device: { port: 99999 } })).rejects.toThrow(ConfigValidationError);
    const loaded = await store.load();
    expect(loaded.device.port).toBe(DEFAULT_CONFIG.device.port);
  });
});
