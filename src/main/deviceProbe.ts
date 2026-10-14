import type { DeviceCheck } from "../shared/types.js";

type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

// Firmware de fábrica da GeekMagic: /v.json -> {"m": "SmallTV-Ultra", "v": "Ultra-V9.0.51"}.
// Firmware do painel: /status -> {"fw": "...", "heap": ...}.
export async function probeDevice(host: string, port: number, fetchImpl: FetchLike = fetch as unknown as FetchLike, timeoutMs = 3000): Promise<DeviceCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base = `http://${host}:${port}`;
  try {
    const response = await fetchImpl(`${base}/v.json`, { signal: controller.signal });
    if (response.status === 200) {
      const info = (await response.json().catch(() => null)) as { m?: unknown; v?: unknown } | null;
      if (typeof info?.m === "string" && typeof info.v === "string") {
        let freeBytes: number | null = null;
        try {
          const space = (await (await fetchImpl(`${base}/space.json`, { signal: controller.signal })).json()) as { free?: unknown };
          if (typeof space.free === "number") freeBytes = space.free;
        } catch {
          // espaço livre é só informativo
        }
        return { ok: true, model: info.m, version: info.v, freeBytes, status: 200 };
      }
    }

    const own = await fetchImpl(`${base}/status`, { signal: controller.signal });
    if (own.status === 200) {
      const info = (await own.json().catch(() => null)) as { fw?: unknown; heap?: unknown } | null;
      if (typeof info?.fw === "string") {
        return { ok: true, model: "GeekPanel", version: info.fw, freeBytes: typeof info.heap === "number" ? info.heap : null, status: 200 };
      }
    }
    return { ok: false, reason: "not-geekmagic", status: own.status === 200 ? response.status : own.status };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
