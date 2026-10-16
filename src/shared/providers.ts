import type { AppConfig, ProviderSpec, StreamingServiceId } from "./types.js";

export const BUILTIN_PROVIDERS: readonly ProviderSpec[] = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com", path: "/v1/models", authStyle: "bearer" },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    path: "/v1/models",
    authStyle: "x-api-key",
    extraHeaders: { "anthropic-version": "2023-06-01" },
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    path: "/v1beta/models",
    authStyle: "header",
    headerName: "x-goog-api-key",
    // Esta API responde 400 para chave inexistente.
    invalidStatuses: [400],
  },
];

export const STREAMING_SERVICES: readonly { id: StreamingServiceId; label: string }[] = [
  { id: "spotify", label: "Spotify" },
  { id: "youtubeMusic", label: "YouTube Music" },
  { id: "youtube", label: "YouTube" },
];

// Só estes provedores expõem consumo por API (e só com chave de administração).
export const USAGE_PROVIDERS: readonly string[] = ["openai", "anthropic"];

export function allProviders(config: Pick<AppConfig["usage"], "customProviders">): ProviderSpec[] {
  return [...BUILTIN_PROVIDERS, ...config.customProviders];
}

// Segredo do aplicativo Google da agenda, separado do usado no YouTube.
export const CALENDAR_SECRET = "calendar:clientSecret";

export const PROVIDER_ID_PATTERN = /^[a-z0-9-]{3,32}$/;

// Chaves aceitas no cofre: segredo do Google, "provider:<id>" (chave comum) e
// "usage:<id>" (chave de administração, só para quem lê consumo).
export function isSecretName(value: string, knownProviderIds: readonly string[]): boolean {
  if (value === "google:clientSecret" || value === CALENDAR_SECRET) return true;
  if (value.startsWith("provider:")) return knownProviderIds.includes(value.slice("provider:".length));
  return value.startsWith("usage:") && USAGE_PROVIDERS.includes(value.slice("usage:".length));
}
