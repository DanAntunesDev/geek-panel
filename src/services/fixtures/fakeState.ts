// Dados fictícios usados na entrega 1 (feature/local-shell) para exercitar
// o servidor e as telas simuladas antes de existir um adaptador real.
// Nenhum nome de serviço real deve aparecer aqui (seção 1 da spec).

import type { ClockState, MediaState, UsageCard } from "../../shared/types.js";

type ClockConfig = { timezone: string; showDate: boolean };

export function buildFakeMediaState(): MediaState {
  return {
    source: "desktop-player",
    title: "Faixa de demonstração",
    artist: "Artista fictício",
    album: "Álbum de teste",
    artworkUrl: null,
    status: "Playing",
    positionSeconds: 42,
    durationSeconds: 214,
    canPlay: true,
    canPause: true,
    canNext: true,
    canPrevious: true,
    updatedAt: new Date().toISOString(),
  };
}

export function buildFakeUsageCards(): UsageCard[] {
  const now = new Date().toISOString();
  return [
    {
      id: "card-a",
      label: "Uso A",
      period: "sessão atual",
      used: 3200,
      limit: 5000,
      remaining: 1800,
      percentage: 64,
      resetAt: null,
      status: "ok",
      updatedAt: now,
    },
    {
      id: "card-b",
      label: "Uso B",
      period: "mês atual",
      used: 900,
      limit: 2000,
      remaining: 1100,
      percentage: 45,
      resetAt: null,
      status: "ok",
      updatedAt: now,
    },
  ];
}

export function buildFakeClockState(config: ClockConfig): ClockState {
  const now = new Date();
  return {
    time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: config.timezone }),
    date: config.showDate ? now.toLocaleDateString("pt-BR", { timeZone: config.timezone }) : null,
    timezone: config.timezone,
  };
}

export function buildFakeSnapshot(clockConfig: ClockConfig, sequence: number) {
  const media = buildFakeMediaState();
  const [primaryUsage] = buildFakeUsageCards();
  const clock = buildFakeClockState(clockConfig);

  return {
    mode: "player" as const,
    sequence,
    sentAt: new Date().toISOString(),
    player: {
      title: media.title,
      artist: media.artist,
      status: media.status,
      positionSeconds: media.positionSeconds,
      durationSeconds: media.durationSeconds,
      artworkKey: null,
    },
    usage: {
      used: primaryUsage.used,
      limit: primaryUsage.limit,
      remaining: primaryUsage.remaining,
      percentage: primaryUsage.percentage,
      status: primaryUsage.status,
    },
    clock: {
      time: clock.time,
      date: clock.date,
    },
  };
}
