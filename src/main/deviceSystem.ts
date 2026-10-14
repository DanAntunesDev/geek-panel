import { randomInt } from "node:crypto";
import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../shared/ipcChannels.js";
import { PALETTE_SIZE, themePalette } from "../shared/theme.js";
import { FRAME_SIZE } from "../shared/deviceProtocol.js";
import type { AgendaState, AppConfig, DeviceLinkStatus, DeviceState, DisplayMode, PlaybackState } from "../shared/types.js";
import { DeviceLink } from "./deviceLink.js";
import { DisplayScheduler } from "./displayScheduler.js";
import { attachRenderer, PRELOAD_PATH } from "./window.js";

interface Deps {
  config: () => Promise<AppConfig>;
  save: (config: AppConfig) => Promise<AppConfig>;
  playback: () => PlaybackState;
  agenda: () => AgendaState;
  // Avisa a janela principal (status do aparelho na Config).
  notifyMain: (channel: string, payload: unknown) => void;
}

// Tudo o que alimenta o GeekMagic: a ligação, a escolha da tela e a janela oculta que desenha.
export function createDeviceSystem(deps: Deps) {
  let config: AppConfig | null = null;
  const link = new DeviceLink({ pairingCode: () => config?.device.pairingCode ?? "" });

  const window = new BrowserWindow({
    show: false,
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // desenha mesmo sem ninguém olhando, senão o aparelho congelaria
      backgroundThrottling: false,
    },
  });
  attachRenderer(window, "device");

  const scheduler = new DisplayScheduler({
    inputs: () => {
      const current = config;
      const rotation = current?.rotation;
      const on = (screen: DisplayMode) => rotation?.enabled?.[screen] ?? true;
      return {
        mode: rotation?.mode ?? "automatic",
        seconds: {
          player: rotation?.playerSeconds ?? 30,
          usage: rotation?.usageSeconds ?? 10,
          clock: rotation?.clockSeconds ?? 30,
          agenda: rotation?.agendaSeconds ?? 20,
        },
        available: {
          player: deps.playback().media !== null && on("player"),
          usage: Object.values(current?.usage.providers ?? {}).some((provider) => provider.enabled) && on("usage"),
          clock: on("clock"),
          agenda: Boolean(current?.agenda.enabled) && deps.agenda().connected && on("agenda"),
        },
      };
    },
    onChange: () => pushState(),
  });

  function state(): DeviceState {
    return { active: link.status().connected, screen: scheduler.current() };
  }

  function pushState(): void {
    if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.deviceStateUpdated, state());
  }

  link.on("status", (status: DeviceLinkStatus) => {
    pushState();
    deps.notifyMain(IPC_CHANNELS.deviceLinkUpdated, status);
  });

  ipcMain.handle(IPC_CHANNELS.getDeviceState, (event) => {
    if (event.sender !== window.webContents) throw new Error("remetente IPC não autorizado");
    return state();
  });

  ipcMain.on(IPC_CHANNELS.deviceFrame, (event, data: unknown) => {
    if (event.sender !== window.webContents || !ArrayBuffer.isView(data)) return;
    const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (pixels.length !== FRAME_SIZE * FRAME_SIZE) return;
    // índice fora da paleta deixaria o aparelho desenhando cor aleatória
    for (let index = 0; index < pixels.length; index += 1) if (pixels[index] >= PALETTE_SIZE) return;
    link.setFrame(pixels);
  });

  async function applyConfig(next: AppConfig): Promise<void> {
    config = next;
    link.setBrightness(next.device.brightness);
    link.setPalette(themePalette(next.theme));
    scheduler.tick();
    if (next.device.autoConnect) await link.start().catch(() => undefined);
    else if (link.status().running) await link.stop();
  }

  return {
    start: async () => {
      scheduler.start();
      let initial = await deps.config();
      // primeira vez: gera o código que o aparelho vai precisar informar
      if (!initial.device.pairingCode) {
        const pairingCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
        initial = await deps.save({ ...initial, device: { ...initial.device, pairingCode } });
      }
      await applyConfig(initial);
    },
    stop: async () => {
      scheduler.stop();
      await link.stop();
      if (!window.isDestroyed()) window.destroy();
    },
    applyConfig,
    linkStatus: () => link.status(),
    webContents: () => (window.isDestroyed() ? null : window.webContents),
    // Lembrete da agenda: ela aparece no aparelho por pelo menos 30 s.
    forceAgenda: () => scheduler.forceAgenda(Math.max(30, config?.rotation.agendaSeconds ?? 20) * 1000),
  };
}

export type DeviceSystem = ReturnType<typeof createDeviceSystem>;
