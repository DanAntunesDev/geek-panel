import { ipcMain, Notification, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { ConfigStore, ConfigValidationError } from "../config/ConfigStore.js";
import { IPC_CHANNELS } from "../shared/ipcChannels.js";
import { allProviders, isSecretName } from "../shared/providers.js";
import type { AuthService, PlaybackState, PlayerCommand } from "../shared/types.js";
import { AgendaService } from "./agendaSource.js";
import { createDeviceSystem, type DeviceSystem } from "./deviceSystem.js";
import { probeDevice } from "./deviceProbe.js";
import type { RunningServer } from "./httpServer.js";
import { resolveMediaUrl } from "./mediaUrl.js";
import type { OAuthManager } from "./oauth.js";
import { callDevice } from "./deviceAdmin.js";
import { createPlayback } from "./playbackSetup.js";
import { validateProviderKey } from "./providerValidation.js";
import { UsageService } from "./usageSource.js";
import { SecretStore, SecretStoreUnavailableError } from "./secretStore.js";

const AUTH_SERVICES: readonly string[] = ["spotify", "google", "calendar"];
const NO_PLAYBACK: PlaybackState = { available: false, source: null, player: null, media: null, warning: null };

export interface IpcDependencies {
  secrets: SecretStore;
  oauth: OAuthManager;
  autostart: (enabled: boolean) => Promise<void>;
}

function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  if (event.sender !== window.webContents) throw new Error("remetente IPC não autorizado");
}

function assertString(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new Error("argumento inválido");
  return value;
}

function parseCommand(value: unknown): PlayerCommand {
  const command = value as { type?: unknown; seconds?: unknown };
  if (command?.type === "playPause" || command?.type === "next" || command?.type === "previous") {
    return { type: command.type };
  }
  if ((command?.type === "seekBy" || command?.type === "seekTo") && typeof command.seconds === "number" && Number.isFinite(command.seconds)) {
    return { type: command.type, seconds: command.seconds };
  }
  if (command?.type === "volume" && typeof (value as { level?: unknown }).level === "number" && Number.isFinite((value as { level: number }).level)) {
    return { type: "volume", level: Math.min(1, Math.max(0, (value as { level: number }).level)) };
  }
  throw new Error("comando inválido");
}

function publicMessage(error: unknown): string {
  return error instanceof Error ? error.message : "falha desconhecida";
}

export function registerIpcHandlers(window: BrowserWindow, configStore: ConfigStore, server: RunningServer, deps: IpcDependencies): void {
  const trusted = <T extends unknown[], R>(handler: (...args: T) => Promise<R> | R) =>
    async (event: IpcMainInvokeEvent, ...args: T): Promise<R> => {
      assertTrustedSender(event, window);
      return handler(...args);
    };

  let device: DeviceSystem | null = null;

  // Leitura de dados de exibição: a janela oculta do aparelho também pode pedir.
  const readable = <T extends unknown[], R>(handler: (...args: T) => Promise<R> | R) =>
    async (event: IpcMainInvokeEvent, ...args: T): Promise<R> => {
      if (event.sender !== window.webContents && event.sender !== device?.webContents()) throw new Error("remetente IPC não autorizado");
      return handler(...args);
    };

  ipcMain.handle(IPC_CHANNELS.getConfig, readable(() => configStore.load()));

  ipcMain.handle(
    IPC_CHANNELS.saveConfig,
    trusted(async (input: unknown) => {
      try {
        const saved = await configStore.save(input);
        void agenda.refresh();
        void usage.refresh();
        void device?.applyConfig(saved);
        broadcast(IPC_CHANNELS.themeUpdated, saved.theme);
        void deps.autostart(saved.app.startWithSystem).catch(() => undefined);
        return saved;
      } catch (error) {
        if (error instanceof ConfigValidationError) throw new Error(`configuração inválida: ${error.message}`);
        throw error;
      }
    }),
  );

  ipcMain.handle(IPC_CHANNELS.getServerStatus, trusted(() => ({ address: server.address, port: server.port })));

  // Agenda: lê o Google Agenda e dispara os lembretes (aviso do sistema + tela do app).
  const send = (channel: string, payload: unknown) => {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  };
  // As telas do aparelho (janela oculta) precisam dos mesmos dados da janela principal.
  const broadcast = (channel: string, payload: unknown) => {
    send(channel, payload);
    device?.webContents()?.send(channel, payload);
  };
  const agenda = new AgendaService({
    oauth: deps.oauth,
    clientId: async () => (await configStore.load()).agenda.googleClientId,
    config: () => configStore.load(),
    onState: (state) => broadcast(IPC_CHANNELS.agendaUpdated, state),
    onReminder: (reminder) => {
      send(IPC_CHANNELS.agendaReminder, reminder);
      device?.forceAgenda();
      void configStore.load().then((config) => {
        if (!config.agenda.notify || !Notification.isSupported()) return;
        const time = new Date(reminder.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        new Notification({
          title: reminder.minutes === 0 ? "Começa agora" : `Começa em ${reminder.minutes} min`,
          body: `${reminder.title} · ${time}`,
        }).show();
      });
    },
  });
  agenda.start();
  window.on("closed", () => agenda.stop());
  ipcMain.handle(IPC_CHANNELS.getAgenda, readable(() => agenda.state()));
  ipcMain.handle(IPC_CHANNELS.refreshAgenda, trusted(() => agenda.refresh()));

  const usage = new UsageService({
    secrets: deps.secrets,
    config: () => configStore.load(),
    onState: (cards) => broadcast(IPC_CHANNELS.usageUpdated, cards),
  });
  usage.start();
  window.on("closed", () => usage.stop());
  ipcMain.handle(IPC_CHANNELS.getUsage, readable(() => usage.state()));
  ipcMain.handle(IPC_CHANNELS.refreshUsage, trusted(() => usage.refresh()));

  ipcMain.handle(
    IPC_CHANNELS.testDevice,
    trusted(async () => {
      const { device } = await configStore.load();
      return probeDevice(device.host, device.port);
    }),
  );

  // o aparelho que está falando com o app (ou foi recusado) vale mais que o IP salvo
  async function deviceHost(): Promise<string> {
    const link = device?.linkStatus();
    return link?.address ?? link?.rejected ?? (await configStore.load()).device.host;
  }

  ipcMain.handle(
    IPC_CHANNELS.pairDevice,
    trusted(async () => callDevice(await deviceHost(), "/pair", { code: (await configStore.load()).device.pairingCode })),
  );
  ipcMain.handle(IPC_CHANNELS.resetDevice, trusted(async () => callDevice(await deviceHost(), "/reset", {})));

  ipcMain.on(IPC_CHANNELS.windowMinimize, (event) => {
    assertTrustedSender(event as IpcMainInvokeEvent, window);
    window.minimize();
  });
  ipcMain.on(IPC_CHANNELS.windowToggleMaximize, (event) => {
    assertTrustedSender(event as IpcMainInvokeEvent, window);
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on(IPC_CHANNELS.windowClose, (event) => {
    assertTrustedSender(event as IpcMainInvokeEvent, window);
    window.close();
  });

  // sistema, Spotify e YouTube viram um estado só
  let latest: PlaybackState = NO_PLAYBACK;
  const playback = createPlayback({
    configStore,
    oauth: deps.oauth,
    onChange: (state) => {
      latest = state;
      broadcast(IPC_CHANNELS.playbackUpdated, state);
    },
  });
  playback.manager.start();
  window.on("closed", () => playback.stop());

  device = createDeviceSystem({
    config: () => configStore.load(),
    save: (config) => configStore.save(config),
    playback: () => latest,
    agenda: () => agenda.state(),
    notifyMain: send,
  });
  void device.start();
  window.on("closed", () => void device?.stop());
  ipcMain.handle(IPC_CHANNELS.getDeviceLink, trusted(() => device?.linkStatus()));

  ipcMain.handle(IPC_CHANNELS.getPlayback, readable(() => latest));
  ipcMain.handle(
    IPC_CHANNELS.controlPlayback,
    trusted(async (command: unknown) => {
      await playback.manager.control(parseCommand(command));
    }),
  );
  ipcMain.handle(
    IPC_CHANNELS.playUrl,
    trusted(async (url: unknown) => {
      try {
        await playback.playUrl(assertString(url, 300));
      } catch (error) {
        throw new Error(publicMessage(error));
      }
    }),
  );
  ipcMain.handle(IPC_CHANNELS.resolveMediaUrl, trusted((url: unknown) => resolveMediaUrl(assertString(url, 300))));

  // o renderer grava e limpa segredos, mas nunca lê o valor
  async function secretName(value: unknown): Promise<string> {
    const name = assertString(value, 80);
    const ids = allProviders((await configStore.load()).usage).map((provider) => provider.id);
    if (!isSecretName(name, ids)) throw new Error("segredo desconhecido");
    return name;
  }

  ipcMain.handle(
    IPC_CHANNELS.secretStatus,
    trusted(async (name: unknown) => {
      const key = await secretName(name);
      const configured = await deps.secrets.has(key);
      return { configured, hint: configured && deps.secrets.available ? await deps.secrets.hint(key) : null };
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.secretSet,
    trusted(async (name: unknown, value: unknown) => {
      const key = await secretName(name);
      try {
        await deps.secrets.set(key, assertString(value, 4096).trim());
        if (key.startsWith("usage:")) void usage.refresh();
      } catch (error) {
        if (error instanceof SecretStoreUnavailableError) throw new Error(error.message);
        throw new Error("não foi possível guardar o segredo");
      }
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.secretClear,
    trusted(async (name: unknown) => {
      const key = await secretName(name);
      await deps.secrets.delete(key);
      if (key.startsWith("usage:")) void usage.refresh();
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.providerValidate,
    trusted(async (id: unknown) => {
      const providerId = assertString(id, 32);
      const spec = allProviders((await configStore.load()).usage).find((provider) => provider.id === providerId);
      if (!spec) throw new Error("provedor desconhecido");
      const key = await deps.secrets.get(`provider:${providerId}`).catch(() => null);
      if (!key) return { state: "error", reason: "nenhuma chave guardada" };
      return validateProviderKey(spec, key);
    }),
  );

  function authService(value: unknown): AuthService {
    const name = assertString(value, 16);
    if (!AUTH_SERVICES.includes(name)) throw new Error("serviço desconhecido");
    return name as AuthService;
  }

  ipcMain.handle(IPC_CHANNELS.authStatus, trusted((service: unknown) => deps.oauth.status(authService(service))));
  ipcMain.handle(
    IPC_CHANNELS.authLogout,
    trusted(async (service: unknown) => {
      await deps.oauth.logout(authService(service));
      void agenda.refresh();
    }),
  );
  ipcMain.handle(
    IPC_CHANNELS.authLogin,
    trusted(async (service: unknown) => {
      const name = authService(service);
      const { media, agenda: agendaConfig } = await configStore.load();
      const clientId = name === "spotify" ? media.spotifyClientId : name === "calendar" ? agendaConfig.googleClientId : media.googleClientId;
      try {
        const status = await deps.oauth.login(name, clientId);
        void agenda.refresh();
        return status;
      } catch (error) {
        throw new Error(publicMessage(error));
      }
    }),
  );
}
