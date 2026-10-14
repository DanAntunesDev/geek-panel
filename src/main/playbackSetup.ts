import type { ConfigStore } from "../config/ConfigStore.js";
import type { AppConfig, PlaybackState } from "../shared/types.js";
import { parseMediaUrl } from "./mediaUrl.js";
import type { OAuthManager } from "./oauth.js";
import { PlaybackManager } from "./playback.js";
import { SpotifyPlayback } from "./spotifySource.js";
import { SystemMediaReader, systemSource } from "./systemMedia.js";
import { startYouTubeHost, type YouTubeHost } from "./youtubeHost.js";
import { YouTubePlayback } from "./youtubeSource.js";
import { createYouTubePage } from "./youtubeWindow.js";

interface Deps {
  configStore: ConfigStore;
  oauth: OAuthManager;
  onChange: (state: PlaybackState) => void;
}

export function createPlayback({ configStore, oauth, onChange }: Deps) {
  // cache curto para não ler o disco a cada ciclo
  let cached: { at: number; value: Promise<AppConfig> } | null = null;
  const config = () => {
    if (!cached || Date.now() - cached.at > 1500) cached = { at: Date.now(), value: configStore.load() };
    return cached.value;
  };

  let host: Promise<YouTubeHost> | null = null;
  const reader = new SystemMediaReader();

  const spotify = new SpotifyPlayback({
    oauth,
    clientId: async () => (await config()).media.spotifyClientId,
    enabled: async () => (await config()).media.sources.spotify.enabled && (await oauth.status("spotify")).connected,
  });
  const youtube = new YouTubePlayback({
    origin: async () => (await (host ??= startYouTubeHost())).origin,
    createPage: createYouTubePage,
    enabled: async () => {
      const { sources } = (await config()).media;
      return sources.youtube.enabled || sources.youtubeMusic.enabled;
    },
  });
  const system = systemSource(reader, async () => (await config()).media.systemPlayers);

  // a ordem desempata quando mais de uma toca
  const manager = new PlaybackManager([youtube, spotify, system], onChange);

  async function playUrl(raw: string): Promise<void> {
    const parsed = parseMediaUrl(raw);
    if (!parsed) throw new Error("link inválido");
    const { sources } = (await configStore.load()).media;
    cached = null;
    if (!sources[parsed.service].enabled) throw new Error("ative esta fonte na Config antes de tocar");

    if (parsed.service === "spotify") {
      if (!(await oauth.status("spotify")).connected) throw new Error("conecte sua conta do Spotify na Config");
      await spotify.play(parsed.kind, parsed.id);
      await manager.takeOver("spotify");
    } else {
      await youtube.load({ kind: parsed.kind === "playlist" ? "playlist" : "video", id: parsed.id });
      await manager.takeOver("youtube");
    }
  }

  return {
    manager,
    playUrl,
    stop() {
      manager.stop();
      reader.close();
      youtube.close();
      void host?.then((item) => item.close());
    },
  };
}
