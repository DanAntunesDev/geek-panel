// MPRIS (D-Bus): só Linux

import type { MediaState, PlaybackStatus, PlayerCommand } from "../shared/types.js";
import type { PlaybackSource } from "./playback.js";

const MPRIS_PREFIX = "org.mpris.MediaPlayer2.";
const MPRIS_PATH = "/org/mpris/MediaPlayer2";
const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";

interface RawPlayerProps {
  status?: unknown;
  metadata?: Record<string, unknown>;
  positionMicros?: unknown;
  canControl?: unknown;
  canGoNext?: unknown;
  canGoPrevious?: unknown;
}

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

// pode vir como number ou BigInt
const asNumber = (value: unknown): number => (typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0);

export function toPlaybackStatus(raw: unknown): PlaybackStatus {
  return raw === "Playing" || raw === "Paused" || raw === "Stopped" ? raw : "Unknown";
}

export function toMediaState(props: RawPlayerProps, now = new Date()): MediaState {
  const metadata = props.metadata ?? {};
  const artists = metadata["xesam:artist"];
  const status = toPlaybackStatus(props.status);
  return {
    source: "desktop-player",
    title: asString(metadata["xesam:title"]),
    artist: Array.isArray(artists) ? artists.map(asString).filter(Boolean).join(", ") : asString(artists),
    album: asString(metadata["xesam:album"]),
    artworkUrl: asString(metadata["mpris:artUrl"]) || null,
    status,
    positionSeconds: Math.max(0, Math.floor(asNumber(props.positionMicros) / 1_000_000)),
    durationSeconds: Math.max(0, Math.floor(asNumber(metadata["mpris:length"]) / 1_000_000)),
    canPlay: props.canControl !== false,
    canPause: props.canControl !== false,
    canNext: props.canGoNext !== false,
    canPrevious: props.canGoPrevious !== false,
    updatedAt: now.toISOString(),
  };
}

export function pickActivePlayer<T extends { media: MediaState }>(players: T[]): T | null {
  return (
    players.find((player) => player.media.status === "Playing") ??
    players.find((player) => player.media.status === "Paused" && player.media.title !== "") ??
    null
  );
}

type Variant = { value: unknown };
const unwrap = (value: unknown): unknown => (value && typeof value === "object" && "value" in value ? (value as Variant).value : value);

function unwrapMetadata(raw: unknown): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries((unwrap(raw) as Record<string, unknown>) ?? {})) metadata[key] = unwrap(value);
  return metadata;
}

export class SystemMediaReader {
  private bus: import("dbus-next").MessageBus | null = null;
  private active: string | null = null;
  private lastPosition = 0;
  identity: string | null = null;

  async read(): Promise<MediaState | null> {
    if (process.platform !== "linux") return null;
    try {
      const chosen = pickActivePlayer(await this.listPlayers());
      this.active = chosen?.name ?? null;
      this.identity = chosen?.identity ?? null;
      this.lastPosition = chosen?.media.positionSeconds ?? 0;
      return chosen?.media ?? null;
    } catch {
      this.close();
      return null;
    }
  }

  async control(command: PlayerCommand): Promise<void> {
    if (!this.bus || !this.active) return;
    const proxy = await this.bus.getProxyObject(this.active, MPRIS_PATH);
    const player = proxy.getInterface(PLAYER_IFACE) as unknown as Record<string, (arg?: bigint) => Promise<void>>;
    if (command.type === "playPause") await player.PlayPause();
    else if (command.type === "next") await player.Next();
    else if (command.type === "previous") await player.Previous();
    else {
      const seconds = command.type === "seekBy" ? command.seconds : command.seconds - this.lastPosition;
      await player.Seek(BigInt(Math.round(seconds * 1_000_000)));
    }
  }

  close(): void {
    this.bus?.disconnect();
    this.bus = null;
  }
  private async listPlayers(): Promise<{ name: string; identity: string; media: MediaState }[]> {
    // em CommonJS a API vem em .default
    const loaded = (await import("dbus-next")) as typeof import("dbus-next") & { default?: typeof import("dbus-next") };
    const dbus = "sessionBus" in loaded && typeof loaded.sessionBus === "function" ? loaded : (loaded.default as typeof import("dbus-next"));
    this.bus ??= dbus.sessionBus();
    const bus = this.bus;
    const daemon = await bus.getProxyObject("org.freedesktop.DBus", "/org/freedesktop/DBus");
    const names = ((await (daemon.getInterface("org.freedesktop.DBus") as unknown as { ListNames(): Promise<string[]> }).ListNames()) ?? []).filter(
      (name) => name.startsWith(MPRIS_PREFIX),
    );

    const players = [];
    for (const name of names) {
      try {
        const proxy = await bus.getProxyObject(name, MPRIS_PATH);
        const props = proxy.getInterface("org.freedesktop.DBus.Properties") as unknown as {
          GetAll(iface: string): Promise<Record<string, unknown>>;
          Get(iface: string, name: string): Promise<unknown>;
        };
        const all = await props.GetAll(PLAYER_IFACE);
        const position = await props.Get(PLAYER_IFACE, "Position").catch(() => 0);
        const identity = asString(unwrap(await props.Get("org.mpris.MediaPlayer2", "Identity").catch(() => "")));
        players.push({
          name,
          identity: identity || name.slice(MPRIS_PREFIX.length),
          media: toMediaState({
            status: unwrap(all.PlaybackStatus),
            metadata: unwrapMetadata(all.Metadata),
            positionMicros: unwrap(position),
            canControl: unwrap(all.CanControl),
            canGoNext: unwrap(all.CanGoNext),
            canGoPrevious: unwrap(all.CanGoPrevious),
          }),
        });
      } catch {
        // player que sumiu entre a listagem e a leitura
      }
    }
    return players;
  }
}

export function systemSource(reader: SystemMediaReader, isEnabled: () => Promise<boolean>): PlaybackSource {
  return {
    id: "system",
    get label() {
      return reader.identity ?? "Sistema";
    },
    intervalMs: 1000,
    enabled: isEnabled,
    poll: () => reader.read(),
    control: (command) => reader.control(command),
  };
}
