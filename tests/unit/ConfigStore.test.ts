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
