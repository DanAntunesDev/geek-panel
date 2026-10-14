import type { MediaState, PlaybackSourceId, PlaybackState, PlayerCommand } from "../shared/types.js";

export interface PlaybackSource {
  id: PlaybackSourceId;
  label: string;
  intervalMs: number;
  enabled(): Promise<boolean>;
  warning?(): string | null;
  poll(): Promise<MediaState | null>;
  control(command: PlayerCommand): Promise<void>;
}

const EMPTY: PlaybackState = { available: false, source: null, player: null, media: null, warning: null };

export function pickActive(
  order: PlaybackSourceId[],
  latest: Map<PlaybackSourceId, MediaState | null>,
  current: PlaybackSourceId | null,
): PlaybackSourceId | null {
  const playing = order.filter((id) => latest.get(id)?.status === "Playing");
  if (current && playing.includes(current)) return current;
  if (playing.length > 0) return playing[0];
  return order.find((id) => latest.get(id)?.status === "Paused" && latest.get(id)?.title) ?? null;
}

export class PlaybackManager {
  private readonly latest = new Map<PlaybackSourceId, MediaState | null>();
  private readonly timers: NodeJS.Timeout[] = [];
  private active: PlaybackSourceId | null = null;
  private lastSent = "";
  // fonte que acabou de receber um link ganha até aparecer ou estourar o prazo
  private preferred: { id: PlaybackSourceId; until: number } | null = null;

  constructor(
    private readonly sources: PlaybackSource[],
    private readonly onChange: (state: PlaybackState) => void,
  ) {}

  start(): void {
    for (const source of this.sources) {
      void this.pollSource(source);
      this.timers.push(setInterval(() => void this.pollSource(source), source.intervalMs));
    }
  }

  stop(): void {
    this.timers.splice(0).forEach(clearInterval);
  }

  state(): PlaybackState {
    const preferred = this.preferred && this.preferred.until > Date.now() && this.latest.get(this.preferred.id)?.title ? this.preferred.id : null;
    this.active = preferred ?? pickActive(this.sources.map((source) => source.id), this.latest, this.active);
    const source = this.sources.find((item) => item.id === this.active);
    if (!source) {
      const warning = this.sources.map((item) => item.warning?.() ?? null).find(Boolean) ?? null;
      return { ...EMPTY, available: this.sources.length > 0, warning };
    }
    return { available: true, source: source.id, player: source.label, media: this.latest.get(source.id) ?? null, warning: null };
  }

  async control(command: PlayerCommand): Promise<void> {
    const source = this.sources.find((item) => item.id === this.state().source);
    if (!source) throw new Error("nada tocando para controlar");
    await source.control(command);
    setTimeout(() => void this.pollSource(source), 300);
  }

  async takeOver(id: PlaybackSourceId): Promise<void> {
    for (const source of this.sources) {
      if (source.id !== id && this.latest.get(source.id)?.status === "Playing") {
        await source.control({ type: "playPause" }).catch(() => undefined);
      }
    }
    this.preferred = { id, until: Date.now() + 15_000 };
    const source = this.sources.find((item) => item.id === id);
    if (source) setTimeout(() => void this.pollSource(source), 800);
  }

  async pollSource(source: PlaybackSource): Promise<void> {
    let media: MediaState | null = null;
    try {
      media = (await source.enabled()) ? await source.poll() : null;
    } catch {
      media = null;
    }
    this.latest.set(source.id, media);
    const state = this.state();
    const serialized = JSON.stringify(state, (key, value) => (key === "updatedAt" ? undefined : value));
    if (serialized !== this.lastSent) {
      this.lastSent = serialized;
      this.onChange(state);
    }
  }
}
