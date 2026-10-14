import type { MediaState, PlayerCommand } from "../shared/types.js";
import type { PlaybackSource } from "./playback.js";

export interface YouTubePage {
  load(url: string): Promise<void>;
  run(script: string): Promise<unknown>;
  destroy(): void;
  alive(): boolean;
}

export interface YouTubeTarget {
  kind: "video" | "playlist";
  id: string;
}

interface PageState {
  ready: boolean;
  error: number;
  status?: number;
  position?: number;
  duration?: number;
  title?: string;
  author?: string;
}

const ERRORS: Record<number, string> = {
  100: "não encontrei esse vídeo",
  101: "o dono do vídeo não permite tocar fora do YouTube",
  150: "o dono do vídeo não permite tocar fora do YouTube",
};

function toMedia(state: PageState): MediaState | null {
  if (!state.ready || !state.title) return null;
  const status = state.status === 1 || state.status === 3 ? "Playing" : state.status === 0 ? "Stopped" : "Paused";
  return {
    source: "desktop-player",
    title: state.title,
    artist: state.author ?? "",
    album: "",
    artworkUrl: null,
    status,
    positionSeconds: Math.floor(state.position ?? 0),
    durationSeconds: Math.floor(state.duration ?? 0),
    canPlay: true,
    canPause: true,
    canNext: true,
    canPrevious: true,
    updatedAt: new Date().toISOString(),
  };
}

interface Options {
  origin: () => Promise<string>;
  createPage: () => YouTubePage;
  enabled: () => Promise<boolean>;
  settleMs?: number;
}

export class YouTubePlayback implements PlaybackSource {
  readonly id = "youtube" as const;
  readonly label = "YouTube";
  readonly intervalMs = 1000;
  private page: YouTubePage | null = null;

  constructor(private readonly options: Options) {}

  enabled(): Promise<boolean> {
    return this.options.enabled();
  }

  private async state(): Promise<PageState | null> {
    if (!this.page?.alive()) return null;
    return (await this.page.run("window.__yt ? window.__yt.state() : null")) as PageState | null;
  }

  async poll(): Promise<MediaState | null> {
    const state = await this.state();
    return state ? toMedia(state) : null;
  }

  async control(command: PlayerCommand): Promise<void> {
    if (!this.page?.alive()) return;
    const position = ((await this.state())?.position ?? 0) as number;
    const calls = {
      playPause: "window.__yt.playPause()",
      next: "window.__yt.next()",
      previous: "window.__yt.previous()",
      seekBy: `window.__yt.seekTo(${Math.max(0, position + (command.type === "seekBy" ? command.seconds : 0))})`,
      seekTo: `window.__yt.seekTo(${Math.max(0, command.type === "seekTo" ? command.seconds : 0)})`,
    };
    await this.page.run(calls[command.type]);
  }

  async load(target: YouTubeTarget): Promise<void> {
    this.page ??= this.options.createPage();
    const param = target.kind === "playlist" ? "list" : "v";
    await this.page.load(`${await this.options.origin()}/player.html?${param}=${encodeURIComponent(target.id)}`);

    const deadline = Date.now() + (this.options.settleMs ?? 8000);
    while (Date.now() < deadline) {
      const state = await this.state().catch(() => null);
      if (state?.error) throw new Error(ERRORS[state.error] ?? `o YouTube não conseguiu tocar (erro ${state.error})`);
      if (state?.ready && state.title) return;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error("o YouTube demorou demais para responder");
  }

  close(): void {
    this.page?.destroy();
    this.page = null;
  }
}
