// Players do Windows (Spotify, navegador, etc.) pela API de mídia do sistema, lida com o PowerShell
// que já vem instalado: um processo fica lendo o estado, e cada comando abre outro curto.

import { spawn, type ChildProcess } from "node:child_process";
import type { MediaState, PlaybackStatus, PlayerCommand } from "../shared/types.js";
import { pickActivePlayer, type SystemReader } from "./systemMedia.js";

// Tudo que os dois scripts usam: espera das chamadas assíncronas do Windows e o gerente de sessões.
const PREAMBLE = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Wait-Op($op, $type) { $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$manager = Wait-Op ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
`;

const READ_LOOP = `
${PREAMBLE}
while ($true) {
  $items = @()
  foreach ($session in $manager.GetSessions()) {
    try {
      $info = $session.GetPlaybackInfo()
      $props = Wait-Op ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $timeline = $session.GetTimelineProperties()
      $position = $timeline.Position.TotalSeconds
      if ([int]$info.PlaybackStatus -eq 4) { $position += ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds }
      $items += [pscustomobject]@{
        app = $session.SourceAppUserModelId
        status = [int]$info.PlaybackStatus
        title = $props.Title
        artist = $props.Artist
        album = $props.AlbumTitle
        position = [math]::Max(0, [math]::Floor($position))
        duration = [math]::Max(0, [math]::Floor($timeline.EndTime.TotalSeconds - $timeline.StartTime.TotalSeconds))
        canNext = [bool]$info.Controls.IsNextEnabled
        canPrevious = [bool]$info.Controls.IsPreviousEnabled
        canPlay = [bool]$info.Controls.IsPlayEnabled
        canPause = [bool]$info.Controls.IsPauseEnabled
      }
    } catch { }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject @($items) -Compress -Depth 3))
  Start-Sleep -Milliseconds 1000
}
`;

// 0 = fechado, 1 = aberto, 2 = mudando, 3 = parado, 4 = tocando, 5 = pausado
const STATUS: Record<number, PlaybackStatus> = { 3: "Stopped", 4: "Playing", 5: "Paused" };

export interface WindowsSession {
  app: string;
  status: number;
  title: string;
  artist: string;
  album: string;
  position: number;
  duration: number;
  canNext: boolean;
  canPrevious: boolean;
  canPlay: boolean;
  canPause: boolean;
}

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.slice(0, max) : "");
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

// Uma linha do script vira a lista de sessões; linha quebrada ou sem lista vira lista vazia.
export function parseSessions(line: string): WindowsSession[] {
  let parsed: unknown;
  try {
    // o PowerShell pode abrir a primeira linha com um marcador invisível (BOM)
    parsed = JSON.parse(line.replace(/^\uFEFF/, ""));
  } catch {
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      app: text(item.app, 200),
      status: count(item.status),
      title: text(item.title, 300),
      artist: text(item.artist, 200),
      album: text(item.album, 200),
      position: count(item.position),
      duration: count(item.duration),
      canNext: item.canNext === true,
      canPrevious: item.canPrevious === true,
      canPlay: item.canPlay === true,
      canPause: item.canPause === true,
    }));
}

export function toWindowsMedia(session: WindowsSession, now = new Date()): MediaState {
  return {
    source: "desktop-player",
    title: session.title,
    artist: session.artist,
    album: session.album,
    artworkUrl: null,
    status: STATUS[session.status] ?? "Unknown",
    positionSeconds: session.position,
    durationSeconds: session.duration,
    // o Windows não deixa mexer no volume de outro app por aqui
    volume: null,
    canPlay: session.canPlay,
    canPause: session.canPause,
    canNext: session.canNext,
    canPrevious: session.canPrevious,
    updatedAt: now.toISOString(),
  };
}

// "Spotify.exe" ou "5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App" viram um nome curto.
export function appLabel(appId: string): string {
  const base = appId.split("!")[0].split(/[\\/]/).pop() ?? appId;
  return base.replace(/\.exe$/i, "").replace(/_[a-z0-9]{13}$/i, "") || "Sistema";
}

const encode = (script: string) => Buffer.from(script, "utf16le").toString("base64");

// Comando de teclado de mídia do app escolhido.
export function commandScript(app: string, command: PlayerCommand, currentSeconds: number): string {
  const call = (() => {
    switch (command.type) {
      case "playPause":
        return "Wait-Op ($session.TryTogglePlayPauseAsync()) ([bool])";
      case "next":
        return "Wait-Op ($session.TrySkipNextAsync()) ([bool])";
      case "previous":
        return "Wait-Op ($session.TrySkipPreviousAsync()) ([bool])";
      case "volume":
        return "";
      default: {
        const target = command.type === "seekBy" ? currentSeconds + command.seconds : command.seconds;
        return `Wait-Op ($session.TryChangePlaybackPositionAsync([int64](${Math.max(0, Math.round(target))} * 10000000))) ([bool])`;
      }
    }
  })();
  if (!call || /[\u0000-\u001f]/.test(app)) return "";
  // o id do app entra como texto entre aspas simples; o PowerShell trata aspas "curvas" como simples também
  const id = app.replace(/['\u2018\u2019\u201A\u201B]/g, (quote) => quote + quote);
  return `${PREAMBLE}\n$session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -eq '${id}' } | Select-Object -First 1\nif ($session) { [void](${call}) }`;
}

export class WindowsMediaReader implements SystemReader {
  identity: string | null = null;
  warning: string | null = null;
  private child: ChildProcess | null = null;
  private sessions: WindowsSession[] = [];
  private active: WindowsSession | null = null;
  private buffer = "";

  private start(): void {
    if (this.child) return;
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encode(READ_LOOP)], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() ?? "";
      const last = lines.filter(Boolean).pop();
      if (last) {
        this.sessions = parseSessions(last);
        this.warning = null;
      }
    });
    child.stderr?.on("data", () => {
      this.warning = "não consegui ler os players do Windows";
    });
    child.on("error", () => {
      this.warning = "o PowerShell não abriu; não dá para ler os players do Windows";
      this.child = null;
    });
    child.on("exit", () => {
      this.child = null;
    });
    this.child = child;
  }

  async read(): Promise<MediaState | null> {
    this.start();
    const players = this.sessions.map((session) => ({ session, media: toWindowsMedia(session) }));
    const chosen = pickActivePlayer(players);
    this.active = chosen?.session ?? null;
    this.identity = chosen ? appLabel(chosen.session.app) : null;
    return chosen?.media ?? null;
  }

  async control(command: PlayerCommand): Promise<void> {
    const session = this.active;
    if (!session) return;
    const script = commandScript(session.app, command, session.position);
    if (!script) throw new Error("o Windows não deixa mudar o volume desse player por aqui");
    await new Promise<void>((resolve) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encode(script)], {
        windowsHide: true,
        stdio: "ignore",
      });
      child.on("exit", () => resolve());
      child.on("error", () => resolve());
    });
  }

  close(): void {
    this.child?.kill();
    this.child = null;
  }
}
