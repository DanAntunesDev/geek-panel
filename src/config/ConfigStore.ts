// Lê, valida e salva a configuração local do aplicativo.
// O arquivo fica fora do versionamento (ver .gitignore) e nunca guarda segredos.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { AppConfig } from "../shared/types.js";

export const DEFAULT_CONFIG: AppConfig = {
  device: {
    host: "192.168.1.100",
    port: 80,
    requestTimeoutMs: 1500,
  },
  server: {
    lanMode: false,
    lanInterface: null,
    port: 4600,
  },
  rotation: {
    mode: "automatic",
    playerSeconds: 30,
    usageSeconds: 10,
    clockSeconds: 30,
  },
  clock: {
    timezone: "America/Sao_Paulo",
    showDate: true,
  },
  media: {
    pollIntervalMs: 1000,
    artworkPath: null,
    gifPath: null,
  },
  usage: {
    source: "file",
    path: "~/.config/geek-panel/usage.json",
  },
};

const HOST_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/;

export class ConfigValidationError extends Error {}

// Valida somente os campos que o editor visual permite alterar (seção 11 da spec).
// Rejeita valores fora dos limites em vez de tentar "corrigir" silenciosamente.
export function validateConfig(input: unknown): AppConfig {
  if (typeof input !== "object" || input === null) {
    throw new ConfigValidationError("configuração deve ser um objeto");
  }
  const candidate = input as Partial<AppConfig>;
  const merged: AppConfig = {
    device: { ...DEFAULT_CONFIG.device, ...candidate.device },
    server: { ...DEFAULT_CONFIG.server, ...candidate.server },
    rotation: { ...DEFAULT_CONFIG.rotation, ...candidate.rotation },
    clock: { ...DEFAULT_CONFIG.clock, ...candidate.clock },
    media: { ...DEFAULT_CONFIG.media, ...candidate.media },
    usage: { ...DEFAULT_CONFIG.usage, ...candidate.usage },
  };

  if (!HOST_PATTERN.test(merged.device.host)) {
    throw new ConfigValidationError("host inválido");
  }
  if (!Number.isInteger(merged.device.port) || merged.device.port < 1 || merged.device.port > 65535) {
    throw new ConfigValidationError("porta do display fora do intervalo permitido");
  }
  if (!Number.isInteger(merged.server.port) || merged.server.port < 1 || merged.server.port > 65535) {
    throw new ConfigValidationError("porta do servidor local fora do intervalo permitido");
  }
  if (merged.device.requestTimeoutMs < 100 || merged.device.requestTimeoutMs > 10_000) {
    throw new ConfigValidationError("timeout de requisição fora do intervalo permitido");
  }
  for (const seconds of [merged.rotation.playerSeconds, merged.rotation.usageSeconds, merged.rotation.clockSeconds]) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) {
      throw new ConfigValidationError("duração de rotação fora do intervalo permitido");
    }
  }
  if (!["player", "usage", "clock", "automatic"].includes(merged.rotation.mode)) {
    throw new ConfigValidationError("modo de rotação inválido");
  }

  return merged;
}

export class ConfigStore {
  private readonly filePath: string;

  constructor(configDir: string) {
    this.filePath = path.join(configDir, "config.json");
  }

  async load(): Promise<AppConfig> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return validateConfig(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return DEFAULT_CONFIG;
      }
      throw error;
    }
  }

  async save(input: unknown): Promise<AppConfig> {
    const validated = validateConfig(input);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(validated, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
    return validated;
  }
}
