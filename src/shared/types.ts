// Tipos compartilhados entre processo principal, renderer e servidor local.

// Cores em #RRGGBB; null deixa a tela com o visual original.
export interface ThemeConfig {
  // Destaque do app e do aparelho.
  accent: string;
  // Cor de cada um dos dois primeiros provedores na tela Tokens.
  tokens: (string | null)[];
  clock: {
    hour: string | null;
    minute: string | null;
    second: string | null;
    date: string | null;
    weekday: string | null;
    city: string | null;
  };
}

export type DisplayMode = "player" | "usage" | "clock" | "agenda";

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
  // 0 a 1; null quando o player não deixa mexer no volume
  volume?: number | null;
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
  // Motivo quando não há dado (ex.: sem chave de administração).
  note: string | null;
}

export type StreamingServiceId = "spotify" | "youtubeMusic" | "youtube";

export type AuthStyle = "bearer" | "x-api-key" | "header";

export interface ProviderSpec {
  id: string;
  label: string;
  baseUrl: string;
  // Rota de leitura usada só para testar a chave.
  path: string;
  authStyle: AuthStyle;
  headerName?: string;
  extraHeaders?: Record<string, string>;
  invalidStatuses?: number[];
}

export interface StreamingSourceConfig {
  enabled: boolean;
  // Link opcional de música, vídeo ou playlist (validado ao salvar).
  url: string;
}

export type ClockStyle = "digital" | "analog" | "flip";

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
    // Aceita o aparelho assim que ele aparecer na rede.
    autoConnect: boolean;
    brightness: number;
    // Código que o aparelho precisa informar para receber as telas (vazio = qualquer um).
    pairingCode: string;
  };
  rotation: {
    mode: ManualMode;
    playerSeconds: number;
    usageSeconds: number;
    clockSeconds: number;
    agendaSeconds: number;
    // Telas que entram no rodízio automático.
    enabled: Record<DisplayMode, boolean>;
  };
  clock: {
    timezone: string;
    showDate: boolean;
    style: ClockStyle;
    showSeconds: boolean;
    hour12: boolean;
    // Nome da cidade na tela; vazio usa o nome do fuso.
    city: string;
  };
  theme: ThemeConfig;
  app: {
    // Abre escondido, na bandeja, quando o computador liga.
    startWithSystem: boolean;
  };
  agenda: {
    enabled: boolean;
    // Minutos antes do início em que o lembrete dispara (ex.: 10 e 5).
    reminders: number[];
    notify: boolean;
    // Aplicativo Google só da agenda; pode ser de outra conta que a do YouTube.
    googleClientId: string;
  };
  media: {
    pollIntervalMs: number;
    artworkPath: string | null;
    gifPath: string | null;
    // Detecta o que está tocando nos players abertos nesta máquina.
    systemPlayers: boolean;
    // IDs públicos de aplicativo; segredos ficam no armazenamento seguro.
    spotifyClientId: string;
    googleClientId: string;
    sources: Record<StreamingServiceId, StreamingSourceConfig>;
  };
  usage: {
    providers: Record<string, { enabled: boolean }>;
    customProviders: ProviderSpec[];
    // Limite mensal de tokens por provedor, definido por você (0 = sem limite).
    limits: Record<string, number>;
  };
}

// O que a janela oculta deve desenhar para o aparelho.
export interface DeviceState {
  active: boolean;
  screen: DisplayMode;
}

export interface DeviceLinkStatus {
  running: boolean;
  connected: boolean;
  address: string | null;
  since: string | null;
  framesSent: number;
  error: string | null;
  // Endereço do último aparelho recusado por código errado.
  rejected: string | null;
}

export interface DeviceAdminResult {
  ok: boolean;
  // código HTTP da resposta; 0 quando o aparelho nem respondeu
  status: number;
  host: string;
  message: string;
}

export type DeviceCheck =
  | { ok: true; model: string; version: string; freeBytes: number | null; status: number }
  // status é o código HTTP da última resposta, quando houve resposta
  | { ok: false; reason: "timeout" | "unreachable" | "not-geekmagic"; status?: number };

export interface AgendaEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  link: string | null;
}

export interface AgendaState {
  connected: boolean;
  account: string | null;
  events: AgendaEvent[];
  updatedAt: string | null;
  error: string | null;
}

export interface AgendaReminder {
  eventId: string;
  title: string;
  start: string;
  // 0 = começa agora.
  minutes: number;
}

// Resultado da validação de uma chave de provedor (nunca carrega a chave).
export type KeyCheck =
  | { state: "valid" }
  | { state: "limited" }
  | { state: "invalid" }
  | { state: "error"; reason: string };

export interface SecretStatus {
  configured: boolean;
  // Máscara com os 4 últimos caracteres; nunca o segredo inteiro.
  hint: string | null;
}

export type AuthService = "spotify" | "google" | "calendar";

export interface AuthStatus {
  connected: boolean;
  account: string | null;
}

export type MediaUrlResult =
  | {
      ok: true;
      service: StreamingServiceId;
      kind: "track" | "album" | "playlist" | "episode" | "show" | "video";
      id: string;
      title: string;
      author: string | null;
      canonicalUrl: string;
    }
  | { ok: false; reason: "invalid-url" | "not-found" | "network" };

export type PlaybackSourceId = "system" | "spotify" | "youtube";

export interface PlaybackState {
  available: boolean;
  source: PlaybackSourceId | null;
  player: string | null;
  media: MediaState | null;
  // Aviso quando há player mas o sistema não deixa ler.
  warning: string | null;
}

export type PlayerCommand =
  | { type: "playPause" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "seekBy"; seconds: number }
  | { type: "seekTo"; seconds: number }
  | { type: "volume"; level: number };
