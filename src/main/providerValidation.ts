// Testa a chave de um provedor com uma chamada de leitura. A chave nunca
// aparece em retorno nem em mensagem de erro.

import type { KeyCheck, ProviderSpec } from "../shared/types.js";

type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number }>;

export interface ValidateOptions {
  fetchImpl?: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
}

function authHeaders(spec: ProviderSpec, key: string): Record<string, string> {
  const headers: Record<string, string> = { ...spec.extraHeaders };
  if (spec.authStyle === "bearer") headers.Authorization = `Bearer ${key}`;
  else if (spec.authStyle === "x-api-key") headers["x-api-key"] = key;
  else headers[spec.headerName ?? "x-api-key"] = key;
  return headers;
}

export async function validateProviderKey(spec: ProviderSpec, key: string, options: ValidateOptions = {}): Promise<KeyCheck> {
  const trimmed = key.trim();
  if (trimmed === "") return { state: "invalid" };

  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

  try {
    const response = await fetchImpl(`${options.baseUrl ?? spec.baseUrl}${spec.path}`, {
      headers: authHeaders(spec, trimmed),
      signal: controller.signal,
    });
    if (response.status >= 200 && response.status < 300) return { state: "valid" };
    if (response.status === 401 || response.status === 403 || spec.invalidStatuses?.includes(response.status)) {
      return { state: "invalid" };
    }
    // 429: a chave vale, só bateu no limite.
    if (response.status === 429) return { state: "limited" };
    return { state: "error", reason: `resposta inesperada (${response.status})` };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { state: "error", reason: timedOut ? "tempo esgotado" : "sem conexão com o provedor" };
  } finally {
    clearTimeout(timer);
  }
}
