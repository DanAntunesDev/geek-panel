// Lê o state.json do Internet Watch (daemon externo)

import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { NetworkStateOrUnavailable } from "../shared/types.js";

const STATE_PATH = path.join(os.homedir(), "internet-monitor", "state.json");

interface RawMetricsBucket {
  avg_ms?: number;
  loss_pct?: number;
}

interface RawState {
  status?: string;
  reason?: string;
  gateway_ping?: { latency_ms?: number | null };
  metrics?: {
    external_60s?: Record<string, RawMetricsBucket>;
  };
  onu?: {
    enabled?: boolean;
    rx_onu_dbm?: number | null;
    tx_onu_dbm?: number | null;
    temperature_c?: number | null;
    uptime?: string | null;
  } | null;
  updated_at?: string;
}

const KNOWN_STATUSES = new Set(["ONLINE", "DEGRADED", "OFFLINE"]);

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function readNetworkState(): Promise<NetworkStateOrUnavailable> {
  let raw: string;
  try {
    raw = await fs.readFile(STATE_PATH, "utf-8");
  } catch {
    return { available: false };
  }

  let parsed: RawState;
  try {
    parsed = JSON.parse(raw) as RawState;
  } catch {
    return { available: false };
  }

  const buckets = Object.values(parsed.metrics?.external_60s ?? {});
  const status = parsed.status && KNOWN_STATUSES.has(parsed.status) ? (parsed.status as "ONLINE" | "DEGRADED" | "OFFLINE") : "UNKNOWN";

  return {
    available: true,
    status,
    reason: parsed.reason ?? "",
    gatewayLatencyMs: parsed.gateway_ping?.latency_ms ?? null,
    externalAvgLatencyMs: average(buckets.map((bucket) => bucket.avg_ms).filter((v): v is number => typeof v === "number")),
    externalLossPct: average(buckets.map((bucket) => bucket.loss_pct).filter((v): v is number => typeof v === "number")),
    onu: parsed.onu
      ? {
          enabled: Boolean(parsed.onu.enabled),
          rxDbm: parsed.onu.rx_onu_dbm ?? null,
          txDbm: parsed.onu.tx_onu_dbm ?? null,
          temperatureC: parsed.onu.temperature_c ?? null,
          uptime: parsed.onu.uptime ?? null,
        }
      : null,
    updatedAt: parsed.updated_at ?? new Date().toISOString(),
  };
}

// sem fs.watch: o daemon troca o arquivo por rename
export function watchNetworkState(onChange: (state: NetworkStateOrUnavailable) => void, intervalMs = 2000): () => void {
  let previousSerialized = "";
  const timer = setInterval(() => {
    readNetworkState()
      .then((state) => {
        const serialized = JSON.stringify(state);
        if (serialized !== previousSerialized) {
          previousSerialized = serialized;
          onChange(state);
        }
      })
      .catch(() => undefined);
  }, intervalMs);
  return () => clearInterval(timer);
}
