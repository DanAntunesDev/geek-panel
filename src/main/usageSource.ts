import { allProviders, USAGE_PROVIDERS } from "../shared/providers.js";
import type { AppConfig, UsageCard } from "../shared/types.js";
import type { SecretStore } from "./secretStore.js";

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{ status: number; json(): Promise<unknown> }>;

export class UsageError extends Error {}

const MAX_PAGES = 6;

export function monthStart(now: number): Date {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function paged(
  fetchImpl: FetchLike,
  url: URL,
  headers: Record<string, string>,
  pageOf: (body: Record<string, unknown>) => string | null,
): Promise<Record<string, unknown>[]> {
  const bodies: Record<string, unknown>[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetchImpl(url.toString(), { headers });
    if (response.status === 401 || response.status === 403) throw new UsageError("chave admin recusada");
    if (response.status < 200 || response.status >= 300) throw new UsageError(`o provedor respondeu ${response.status}`);
    const body = (await response.json()) as Record<string, unknown>;
    bodies.push(body);
    const next = pageOf(body);
    if (!next) break;
    url.searchParams.set("page", next);
  }
  return bodies;
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export async function anthropicMonthTokens(adminKey: string, since: Date, fetchImpl: FetchLike, baseUrl = "https://api.anthropic.com"): Promise<number> {
  const url = new URL(`${baseUrl}/v1/organizations/usage_report/messages`);
  url.searchParams.set("starting_at", since.toISOString());
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  const bodies = await paged(fetchImpl, url, { "x-api-key": adminKey, "anthropic-version": "2023-06-01" }, (body) =>
    body.has_more === true && typeof body.next_page === "string" ? body.next_page : null,
  );
  let total = 0;
  for (const body of bodies) {
    for (const bucket of (body.data as { results?: Record<string, unknown>[] }[]) ?? []) {
      for (const result of bucket.results ?? []) {
        const cache = (result.cache_creation ?? {}) as Record<string, unknown>;
        total += num(result.uncached_input_tokens) + num(result.cache_read_input_tokens) + num(result.output_tokens);
        total += num(cache.ephemeral_1h_input_tokens) + num(cache.ephemeral_5m_input_tokens);
      }
    }
  }
  return total;
}

export async function openaiMonthTokens(adminKey: string, since: Date, fetchImpl: FetchLike, baseUrl = "https://api.openai.com"): Promise<number> {
  const url = new URL(`${baseUrl}/v1/organization/usage/completions`);
  url.searchParams.set("start_time", String(Math.floor(since.getTime() / 1000)));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  const bodies = await paged(fetchImpl, url, { Authorization: `Bearer ${adminKey}` }, (body) =>
    typeof body.next_page === "string" && body.next_page !== "" ? body.next_page : null,
  );
  let total = 0;
  for (const body of bodies) {
    for (const bucket of (body.data as { results?: Record<string, unknown>[] }[]) ?? []) {
      for (const result of bucket.results ?? []) total += num(result.input_tokens) + num(result.output_tokens);
    }
  }
  return total;
}

interface Options {
  secrets: SecretStore;
  config: () => Promise<AppConfig>;
  onState: (cards: UsageCard[]) => void;
  fetchImpl?: FetchLike;
  baseUrls?: Partial<Record<string, string>>;
  now?: () => number;
}

const REFRESH_MS = 5 * 60_000;

export class UsageService {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly last = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private cards: UsageCard[] = [];

  constructor(private readonly options: Options) {
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    this.now = options.now ?? Date.now;
  }

  state(): UsageCard[] {
    return this.cards;
  }

  start(): void {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refresh(): Promise<UsageCard[]> {
    const config = await this.options.config();
    const since = monthStart(this.now());
    const cards: UsageCard[] = [];

    for (const provider of allProviders(config.usage)) {
      if (!config.usage.providers[provider.id]?.enabled) continue;
      const limit = config.usage.limits[provider.id] ?? 0;
      const base = { id: provider.id, label: provider.label, period: "mês atual", limit, resetAt: null, updatedAt: new Date(this.now()).toISOString() };

      if (!USAGE_PROVIDERS.includes(provider.id)) {
        cards.push({ ...base, used: 0, remaining: 0, percentage: 0, status: "unavailable", note: "sem API de consumo" });
        continue;
      }
      const adminKey = await this.options.secrets.get(`usage:${provider.id}`).catch(() => null);
      if (!adminKey) {
        cards.push({ ...base, used: 0, remaining: 0, percentage: 0, status: "unavailable", note: "falta chave admin" });
        continue;
      }

      try {
        const fetcher = provider.id === "anthropic" ? anthropicMonthTokens : openaiMonthTokens;
        const used = await fetcher(adminKey, since, this.fetchImpl, this.options.baseUrls?.[provider.id]);
        this.last.set(provider.id, used);
        cards.push(this.card(base, used, "ok", null));
      } catch (error) {
        const known = this.last.get(provider.id);
        const note = error instanceof UsageError ? error.message : "sem conexão com o provedor";
        cards.push(known === undefined ? { ...base, used: 0, remaining: 0, percentage: 0, status: "unavailable", note } : this.card(base, known, "stale", note));
      }
    }

    this.cards = cards;
    this.options.onState(cards);
    return cards;
  }

  private card(base: Omit<UsageCard, "used" | "remaining" | "percentage" | "status" | "note">, used: number, status: UsageCard["status"], note: string | null): UsageCard {
    const percentage = base.limit > 0 ? Math.min(100, Math.round((used / base.limit) * 100)) : 0;
    return { ...base, used, remaining: Math.max(0, base.limit - used), percentage, status, note };
  }
}
