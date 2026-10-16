import type { MediaState, PlayerCommand } from "../shared/types.js";
import type { OAuthManager } from "./oauth.js";
import type { PlaybackSource } from "./playback.js";

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;

interface SpotifyItem {
  name?: string;
  duration_ms?: number;
  artists?: { name?: string }[];
  show?: { name?: string };
  album?: { name?: string; images?: { url?: string }[] };
  images?: { url?: string }[];
}

interface SpotifyPlayer {
  is_playing?: boolean;
  progress_ms?: number;
  device?: { volume_percent?: number | null };
  item?: SpotifyItem | null;
}

export function toMedia(player: SpotifyPlayer): MediaState | null {
  const item = player.item;
  if (!item?.name) return null;
  const artists = item.artists?.map((artist) => artist.name).filter(Boolean).join(", ") ?? "";
  return {
    source: "desktop-player",
    title: item.name,
    artist: artists || item.show?.name || "",
    album: item.album?.name ?? "",
    artworkUrl: item.album?.images?.[0]?.url ?? item.images?.[0]?.url ?? null,
    status: player.is_playing ? "Playing" : "Paused",
    positionSeconds: Math.floor((player.progress_ms ?? 0) / 1000),
    durationSeconds: Math.floor((item.duration_ms ?? 0) / 1000),
    volume: typeof player.device?.volume_percent === "number" ? player.device.volume_percent / 100 : null,
    canPlay: true,
    canPause: true,
    canNext: true,
    canPrevious: true,
    updatedAt: new Date().toISOString(),
  };
}

interface Options {
  oauth: OAuthManager;
  clientId: () => Promise<string>;
  enabled: () => Promise<boolean>;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export class SpotifyPlayback implements PlaybackSource {
  readonly id = "spotify" as const;
  readonly label = "Spotify";
  readonly intervalMs = 2000;
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  private last: MediaState | null = null;

  constructor(private readonly options: Options) {
    this.base = options.baseUrl ?? "https://api.spotify.com/v1";
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  }

  enabled(): Promise<boolean> {
    return this.options.enabled();
  }

  async poll(): Promise<MediaState | null> {
    const response = await this.request("GET", "/me/player");
    if (response.status !== 200) return (this.last = null);
    return (this.last = toMedia((await response.json()) as SpotifyPlayer));
  }

  async control(command: PlayerCommand): Promise<void> {
    if (command.type === "playPause") {
      await this.send("PUT", this.last?.status === "Playing" ? "/me/player/pause" : "/me/player/play");
    } else if (command.type === "next") {
      await this.send("POST", "/me/player/next");
    } else if (command.type === "previous") {
      await this.send("POST", "/me/player/previous");
    } else if (command.type === "volume") {
      await this.send("PUT", `/me/player/volume?volume_percent=${Math.round(command.level * 100)}`);
    } else {
      const target = command.type === "seekBy" ? (this.last?.positionSeconds ?? 0) + command.seconds : command.seconds;
      const duration = this.last?.durationSeconds ?? Infinity;
      const ms = Math.round(Math.min(Math.max(0, target), duration) * 1000);
      await this.send("PUT", `/me/player/seek?position_ms=${ms}`);
    }
  }

  async play(kind: string, id: string): Promise<void> {
    const uri = `spotify:${kind}:${id}`;
    const body = kind === "track" || kind === "episode" ? { uris: [uri] } : { context_uri: uri };
    await this.send("PUT", "/me/player/play", JSON.stringify(body));
  }

  private async request(method: string, path: string, body?: string) {
    const token = await this.options.oauth.accessToken("spotify", await this.options.clientId());
    if (!token) throw new Error("conecte sua conta do Spotify na Config");
    return this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body,
    });
  }

  private async send(method: string, path: string, body?: string): Promise<void> {
    const response = await this.request(method, path, body);
    if (response.status >= 200 && response.status < 300) return;
    if (response.status === 404) throw new Error("abra o Spotify em algum aparelho e tente de novo");
    if (response.status === 403) throw new Error("o Spotify só deixa controlar a reprodução com conta Premium");
    throw new Error(`o Spotify recusou o comando (${response.status})`);
  }
}
