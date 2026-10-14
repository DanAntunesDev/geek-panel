// Lê, valida e salva a configuração local do aplicativo.
// O arquivo fica fora do versionamento (ver .gitignore) e nunca guarda segredos.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { BUILTIN_PROVIDERS, PROVIDER_ID_PATTERN } from "../shared/providers.js";
import { ACCENT_PATTERN, DEFAULT_THEME } from "../shared/theme.js";
import type { AppConfig, ProviderSpec, StreamingServiceId } from "../shared/types.js";

export const DEFAULT_CONFIG: AppConfig = {
  device: {
    host: "192.168.1.5",
    port: 80,
    requestTimeoutMs: 1500,
    autoConnect: true,
    brightness: 60,
    pairingCode: "",
  },
  rotation: {
    mode: "automatic",
    playerSeconds: 30,
    usageSeconds: 10,
    clockSeconds: 30,
    agendaSeconds: 20,
    enabled: { player: true, usage: true, clock: true, agenda: true },
  },
  clock: {
    timezone: "America/Sao_Paulo",
    showDate: true,
    style: "digital",
    showSeconds: true,
    hour12: false,
    city: "",
  },
  theme: DEFAULT_THEME,
  app: {
    startWithSystem: false,
  },
  agenda: {
    enabled: false,
    reminders: [10, 5],
    notify: true,
    googleClientId: "",
  },
  media: {
    pollIntervalMs: 1000,
    artworkPath: null,
    gifPath: null,
    systemPlayers: true,
    spotifyClientId: "",
    googleClientId: "",
    sources: {
      spotify: { enabled: false, url: "" },
      youtubeMusic: { enabled: false, url: "" },
      youtube: { enabled: false, url: "" },
    },
  },
  usage: {
    providers: {
      openai: { enabled: false },
      anthropic: { enabled: false },
      gemini: { enabled: false },
    },
    customProviders: [],
    limits: { openai: 0, anthropic: 0, gemini: 0 },
  },
};

// Mescla um registro de objetos chave a chave com os padrões (ignora chaves desconhecidas).
function mergeEach<T extends object>(defaults: Record<string, T>, input: Partial<Record<string, Partial<T>>> | undefined): Record<string, T> {
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...input?.[key] }]));
}

// Configs antigas tinham a tela de rede: o modo vira "automatic" e o tempo some.
function migrateRotation(rotation: Partial<AppConfig["rotation"]> | undefined): Partial<AppConfig["rotation"]> {
  const { networkSeconds: _removed, ...rest } = (rotation ?? {}) as Partial<AppConfig["rotation"]> & { networkSeconds?: number };
  return (rest.mode as string) === "network" ? { ...rest, mode: "automatic" } : rest;
}

const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{0,128}$/;

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
    rotation: {
      ...DEFAULT_CONFIG.rotation,
      ...migrateRotation(candidate.rotation),
      enabled: { ...DEFAULT_CONFIG.rotation.enabled, ...candidate.rotation?.enabled },
    },
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...candidate.theme,
      tokens: [...(candidate.theme?.tokens ?? DEFAULT_CONFIG.theme.tokens)],
      clock: { ...DEFAULT_CONFIG.theme.clock, ...candidate.theme?.clock },
    },
    app: { ...DEFAULT_CONFIG.app, ...candidate.app },
    agenda: { ...DEFAULT_CONFIG.agenda, ...candidate.agenda },
    clock: { ...DEFAULT_CONFIG.clock, ...candidate.clock },
    media: {
      ...DEFAULT_CONFIG.media,
      ...candidate.media,
      sources: mergeEach(DEFAULT_CONFIG.media.sources, candidate.media?.sources),
    },
    usage: {
      ...DEFAULT_CONFIG.usage,
      ...candidate.usage,
      customProviders: candidate.usage?.customProviders ?? [],
      limits: {},
      providers: {},
    },
  };
  validateCustomProviders(merged.usage.customProviders);
  const providerIds = [...Object.keys(DEFAULT_CONFIG.usage.providers), ...merged.usage.customProviders.map((provider) => provider.id)];
  merged.usage.providers = Object.fromEntries(
    providerIds.map((id) => [id, { enabled: candidate.usage?.providers?.[id]?.enabled === true }]),
  );
  merged.usage.limits = Object.fromEntries(providerIds.map((id) => [id, validLimit(candidate.usage?.limits?.[id])]));

  if (!HOST_PATTERN.test(merged.device.host)) {
    throw new ConfigValidationError("host inválido");
  }
  if (!Number.isInteger(merged.device.port) || merged.device.port < 1 || merged.device.port > 65535) {
    throw new ConfigValidationError("porta do display fora do intervalo permitido");
  }
  if (merged.device.requestTimeoutMs < 100 || merged.device.requestTimeoutMs > 10_000) {
    throw new ConfigValidationError("timeout de requisição fora do intervalo permitido");
  }
  for (const seconds of [
    merged.rotation.playerSeconds,
    merged.rotation.usageSeconds,
    merged.rotation.clockSeconds,
    merged.rotation.agendaSeconds,
  ]) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) {
      throw new ConfigValidationError("duração de rotação fora do intervalo permitido");
    }
  }
  const enabledScreens = Object.values(merged.rotation.enabled);
  if (enabledScreens.some((value) => typeof value !== "boolean")) {
    throw new ConfigValidationError("opção de tela ativa inválida");
  }
  if (!enabledScreens.some(Boolean)) {
    throw new ConfigValidationError("deixe pelo menos uma tela ativa no rodízio");
  }
  if (typeof merged.device.autoConnect !== "boolean") {
    throw new ConfigValidationError("opção de conexão automática inválida");
  }
  if (!Number.isInteger(merged.device.brightness) || merged.device.brightness < 0 || merged.device.brightness > 100) {
    throw new ConfigValidationError("brilho fora do intervalo permitido");
  }
  if (typeof merged.device.pairingCode !== "string" || !/^[0-9A-Za-z]{0,16}$/.test(merged.device.pairingCode)) {
    throw new ConfigValidationError("código de pareamento inválido (até 16 letras ou números)");
  }
  if (typeof merged.theme.accent !== "string" || !ACCENT_PATTERN.test(merged.theme.accent)) {
    throw new ConfigValidationError("cor de destaque inválida (use #RRGGBB)");
  }
  validateTheme(merged.theme);
  if (typeof merged.app.startWithSystem !== "boolean") {
    throw new ConfigValidationError("opção de iniciar com o sistema inválida");
  }
  validateAgenda(merged.agenda);
  merged.agenda.reminders = [...merged.agenda.reminders].sort((a, b) => b - a);
  validateMedia(merged.media);
  if (!["digital", "analog", "flip"].includes(merged.clock.style)) {
    throw new ConfigValidationError("estilo de relógio inválido");
  }
  if (typeof merged.clock.showSeconds !== "boolean" || typeof merged.clock.hour12 !== "boolean") {
    throw new ConfigValidationError("opções de relógio inválidas");
  }
  if (typeof merged.clock.city !== "string" || merged.clock.city.length > 24) {
    throw new ConfigValidationError("nome da cidade inválido (até 24 letras)");
  }
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: merged.clock.timezone });
  } catch {
    throw new ConfigValidationError("fuso horário inválido");
  }
  if (!["player", "usage", "clock", "agenda", "automatic"].includes(merged.rotation.mode)) {
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

const SERVICE_HOSTS: Record<StreamingServiceId, string[]> = {
  spotify: ["open.spotify.com"],
  youtubeMusic: ["music.youtube.com", "www.youtube.com", "youtube.com", "youtu.be"],
  youtube: ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"],
};

function validateMedia(media: AppConfig["media"]): void {
  if (typeof media.systemPlayers !== "boolean") {
    throw new ConfigValidationError("opção de players do sistema inválida");
  }
  if (!CLIENT_ID_PATTERN.test(media.spotifyClientId) || !CLIENT_ID_PATTERN.test(media.googleClientId)) {
    throw new ConfigValidationError("ID de aplicativo inválido");
  }
  for (const [service, source] of Object.entries(media.sources) as [StreamingServiceId, AppConfig["media"]["sources"][StreamingServiceId]][]) {
    if (typeof source.enabled !== "boolean" || typeof source.url !== "string" || source.url.length > 300) {
      throw new ConfigValidationError(`fonte ${service} inválida`);
    }
    if (source.url === "") continue;
    let parsed: URL;
    try {
      parsed = new URL(source.url);
    } catch {
      throw new ConfigValidationError(`link de ${service} inválido`);
    }
    if (parsed.protocol !== "https:" || !SERVICE_HOSTS[service].includes(parsed.hostname)) {
      throw new ConfigValidationError(`link de ${service} deve ser https e do próprio serviço`);
    }
  }
}

const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]{1,40}$/;

function validateCustomProviders(list: ProviderSpec[]): void {
  if (!Array.isArray(list) || list.length > 20) throw new ConfigValidationError("lista de provedores inválida");
  const seen = new Set(BUILTIN_PROVIDERS.map((provider) => provider.id));
  for (const provider of list) {
    if (typeof provider?.id !== "string" || !PROVIDER_ID_PATTERN.test(provider.id) || seen.has(provider.id)) {
      throw new ConfigValidationError("identificador de provedor inválido ou repetido");
    }
    seen.add(provider.id);
    if (typeof provider.label !== "string" || provider.label.trim() === "" || provider.label.length > 40) {
      throw new ConfigValidationError("nome do provedor inválido");
    }
    let origin: URL;
    try {
      origin = new URL(provider.baseUrl);
    } catch {
      throw new ConfigValidationError("endereço do provedor inválido");
    }
    // Só https puro e sem caminho, para a chave nunca ir em texto aberto.
    if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.username || origin.password) {
      throw new ConfigValidationError("o endereço do provedor deve ser https, sem caminho");
    }
    if (typeof provider.path !== "string" || !/^\/[\w./-]{0,99}$/.test(provider.path)) {
      throw new ConfigValidationError("rota de teste do provedor inválida");
    }
    if (!["bearer", "x-api-key", "header"].includes(provider.authStyle)) {
      throw new ConfigValidationError("tipo de autenticação inválido");
    }
    if (provider.authStyle === "header" && !HEADER_NAME_PATTERN.test(provider.headerName ?? "")) {
      throw new ConfigValidationError("nome do cabeçalho inválido");
    }
  }
}

function validateTheme(theme: AppConfig["theme"]): void {
  theme.accent = theme.accent.toUpperCase();
  const optional = (value: unknown): string | null => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string" || !ACCENT_PATTERN.test(value)) throw new ConfigValidationError("cor inválida (use #RRGGBB)");
    return value.toUpperCase();
  };
  if (!Array.isArray(theme.tokens) || theme.tokens.length > 2) throw new ConfigValidationError("cores de tokens inválidas");
  theme.tokens = [optional(theme.tokens[0]), optional(theme.tokens[1])];
  for (const key of Object.keys(theme.clock) as (keyof AppConfig["theme"]["clock"])[]) theme.clock[key] = optional(theme.clock[key]);
}

function validateAgenda(agenda: AppConfig["agenda"]): void {
  if (typeof agenda.enabled !== "boolean" || typeof agenda.notify !== "boolean") {
    throw new ConfigValidationError("opções da agenda inválidas");
  }
  if (typeof agenda.googleClientId !== "string" || !CLIENT_ID_PATTERN.test(agenda.googleClientId)) {
    throw new ConfigValidationError("ID do aplicativo Google da agenda inválido");
  }
  const { reminders } = agenda;
  const valid =
    Array.isArray(reminders) &&
    reminders.length <= 4 &&
    new Set(reminders).size === reminders.length &&
    reminders.every((minutes) => Number.isInteger(minutes) && minutes >= 1 && minutes <= 120);
  if (!valid) throw new ConfigValidationError("lembretes da agenda inválidos");
}

function validLimit(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1e12) {
    throw new ConfigValidationError("limite mensal inválido");
  }
  return value;
}
