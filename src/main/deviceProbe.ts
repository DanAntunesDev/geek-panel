import type { DeviceCheck } from "../shared/types.js";

type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

// Lê /v.json do firmware de fábrica da GeekMagic: {"m": "SmallTV-Ultra", "v": "Ultra-V9.0.51"}.
export async function probeDevice(host: string, port: number, fetchImpl: FetchLike = fetch as unknown as FetchLike, timeoutMs = 3000): Promise<DeviceCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base = `http://${host}:${port}`;
  try {
    const response = await fetchImpl(`${base}/v.json`, { signal: controller.signal });
    if (response.status !== 200) return { ok: false, reason: "not-geekmagic" };
    const info = (await response.json().catch(() => null)) as { m?: unknown; v?: unknown } | null;
    if (typeof info?.m !== "string" || typeof info.v !== "string") return { ok: false, reason: "not-geekmagic" };

    let freeBytes: number | null = null;
    try {
      const space = (await (await fetchImpl(`${base}/space.json`, { signal: controller.signal })).json()) as { free?: unknown };
      if (typeof space.free === "number") freeBytes = space.free;
    } catch {
      // espaço livre é só informativo
    }
    return { ok: true, model: info.m, version: info.v, freeBytes };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
