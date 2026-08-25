// Contrato versionado consultado pelo display (seção 9 da spec).
// O firmware deve ignorar campos desconhecidos e descartar mensagens antigas pelo "sequence".

import type { DisplayMode, PlaybackStatus, UsageStatus } from "./types.js";

export const PROTOCOL_VERSION = 1;

export interface DeviceStateMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  mode: DisplayMode;
  sequence: number;
  sentAt: string;
  player: {
    title: string;
    artist: string;
    status: PlaybackStatus;
    positionSeconds: number;
    durationSeconds: number;
    artworkKey: string | null;
  };
  usage: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    status: UsageStatus;
  };
  clock: {
    time: string;
    date: string | null;
  };
}

export interface HealthResponse {
  status: "ok";
}
