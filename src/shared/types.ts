// Tipos compartilhados entre processo principal, renderer e servidor local.

export type DisplayMode = "player" | "usage" | "clock";

export type ManualMode = DisplayMode | "automatic";

export type PlaybackStatus = "Playing" | "Paused" | "Stopped" | "Unknown";

export interface MediaState {
  source: "desktop-player";
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  status: PlaybackStatus;
  positionSeconds: number;
  durationSeconds: number;
  canPlay: boolean;
  canPause: boolean;
  canNext: boolean;
  canPrevious: boolean;
  updatedAt: string;
}

export type UsageStatus = "ok" | "unavailable" | "stale";

export interface UsageCard {
  id: string;
  label: string;
  period: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetAt: string | null;
  status: UsageStatus;
  updatedAt: string;
}

export interface ClockState {
  time: string;
  date: string | null;
  timezone: string;
}

export interface AppConfig {
  device: {
    host: string;
    port: number;
    requestTimeoutMs: number;
  };
  server: {
    lanMode: boolean;
    lanInterface: string | null;
    port: number;
  };
  rotation: {
    mode: ManualMode;
    playerSeconds: number;
    usageSeconds: number;
    clockSeconds: number;
  };
  clock: {
    timezone: string;
    showDate: boolean;
  };
  media: {
    pollIntervalMs: number;
    artworkPath: string | null;
    gifPath: string | null;
  };
  usage: {
    source: "file";
    path: string;
  };
}

export type ConnectionTestResult =
  | { outcome: "success"; latencyMs: number }
  | { outcome: "timeout" }
  | { outcome: "refused" }
  | { outcome: "dns-error" }
  | { outcome: "invalid-response" };
