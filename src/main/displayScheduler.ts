import type { DisplayMode, ManualMode } from "../shared/types.js";

const ORDER: DisplayMode[] = ["player", "usage", "clock", "agenda"];

export interface SchedulerInputs {
  mode: ManualMode;
  seconds: Record<DisplayMode, number>;
  // Telas com algo para mostrar; o modo automático pula as outras.
  available: Record<DisplayMode, boolean>;
}

interface Options {
  inputs: () => SchedulerInputs;
  onChange: (screen: DisplayMode) => void;
  now?: () => number;
}

// Escolhe a tela do aparelho: a fixa que você escolheu, ou o rodízio automático.
export class DisplayScheduler {
  private readonly now: () => number;
  private screen: DisplayMode | null = null;
  private shownSince = 0;
  private forcedUntil = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: Options) {
    this.now = options.now ?? Date.now;
  }

  current(): DisplayMode {
    return this.screen ?? "clock";
  }

  start(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // Lembrete da agenda: ela fica na frente por um tempo, não importa o modo.
  forceAgenda(durationMs: number): void {
    this.forcedUntil = this.now() + durationMs;
    this.tick();
  }

  tick(): void {
    const next = this.pick();
    if (next === this.screen) return;
    this.screen = next;
    this.shownSince = this.now();
    this.options.onChange(next);
  }

  private pick(): DisplayMode {
    const now = this.now();
    const { mode, seconds, available } = this.options.inputs();
    if (now < this.forcedUntil) return "agenda";
    if (mode !== "automatic") return mode;

    const screens = ORDER.filter((screen) => available[screen]);
    if (screens.length === 0) return "clock";
    const index = this.screen ? screens.indexOf(this.screen) : -1;
    if (this.screen === null || index === -1) return screens[0];
    const stayed = now - this.shownSince;
    if (screens.length === 1 || stayed < Math.max(1, seconds[this.screen]) * 1000) return this.screen;
    return screens[(index + 1) % screens.length];
  }
}
