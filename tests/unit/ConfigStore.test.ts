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

  it("migra config antiga com a tela de rede", () => {
    const old = { rotation: { mode: "network", networkSeconds: 20, playerSeconds: 15 } };
    const result = validateConfig(old);
    expect(result.rotation.mode).toBe("automatic");
    expect(result.rotation.playerSeconds).toBe(15);
    expect("networkSeconds" in result.rotation).toBe(false);
  });

  it("valida os lembretes da agenda e ordena do maior para o menor", () => {
    expect(validateConfig({ agenda: { reminders: [5, 15, 10] } }).agenda.reminders).toEqual([15, 10, 5]);
    expect(() => validateConfig({ agenda: { reminders: [0] } })).toThrow("lembretes");
    expect(() => validateConfig({ agenda: { reminders: [5, 5] } })).toThrow("lembretes");
    expect(() => validateConfig({ agenda: { reminders: [1, 2, 3, 4, 5] } })).toThrow("lembretes");
    expect(() => validateConfig({ agenda: { enabled: "sim" } })).toThrow("agenda");
  });

  it("valida as opções do aparelho: brilho, conexão automática e código de pareamento", () => {
    expect(validateConfig({ device: { brightness: 100, autoConnect: false, pairingCode: "482915" } }).device).toMatchObject({ brightness: 100, autoConnect: false, pairingCode: "482915" });
    expect(() => validateConfig({ device: { brightness: 101 } })).toThrow("brilho");
    expect(() => validateConfig({ device: { brightness: 50.5 } })).toThrow("brilho");
    expect(() => validateConfig({ device: { autoConnect: "sim" } })).toThrow("conexão");
    expect(() => validateConfig({ device: { pairingCode: "tem espaço" } })).toThrow("pareamento");
    expect(() => validateConfig({ device: { pairingCode: "x".repeat(17) } })).toThrow("pareamento");
  });

  it("iniciar com o sistema começa desligado e só aceita verdadeiro ou falso", () => {
    expect(validateConfig({}).app.startWithSystem).toBe(true);
    expect(validateConfig({ app: { startWithSystem: true } }).app.startWithSystem).toBe(true);
    expect(() => validateConfig({ app: { startWithSystem: 1 } })).toThrow("sistema");
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
    await store.save({ device: { host: "10.0.0.9", port: 8080 } });
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
