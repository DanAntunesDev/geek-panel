import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { ConfigStore, ConfigValidationError } from "../config/ConfigStore.js";
import { IPC_CHANNELS } from "../shared/ipcChannels.js";
import { allProviders, isSecretName } from "../shared/providers.js";
import type { AuthService, PlaybackState, PlayerCommand } from "../shared/types.js";
import type { RunningServer } from "./httpServer.js";
import { resolveMediaUrl } from "./mediaUrl.js";
import { readNetworkState, watchNetworkState } from "./networkState.js";
import type { OAuthManager } from "./oauth.js";
import { createPlayback } from "./playbackSetup.js";
import { validateProviderKey } from "./providerValidation.js";
import { SecretStore, SecretStoreUnavailableError } from "./secretStore.js";

const AUTH_SERVICES: readonly string[] = ["spotify", "google"];
const NO_PLAYBACK: PlaybackState = { available: false, source: null, player: null, media: null, warning: null };

export interface IpcDependencies {
  secrets: SecretStore;
  oauth: OAuthManager;
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

  ipcMain.handle(IPC_CHANNELS.getConfig, trusted(() => configStore.load()));

  ipcMain.handle(
    IPC_CHANNELS.saveConfig,
    trusted(async (input: unknown) => {
      try {
        return await configStore.save(input);
      } catch (error) {
        if (error instanceof ConfigValidationError) throw new Error(`configuração inválida: ${error.message}`);
        throw error;
      }
    }),
  );

  ipcMain.handle(IPC_CHANNELS.getServerStatus, trusted(() => ({ address: server.address, port: server.port })));

  ipcMain.handle(IPC_CHANNELS.getNetworkState, trusted(() => readNetworkState()));
  const stopNetworkWatch = watchNetworkState((state) => {
    if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.networkStateUpdated, state);
  });
  window.on("closed", stopNetworkWatch);

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
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.playbackUpdated, state);
    },
  });
  playback.manager.start();
  window.on("closed", () => playback.stop());

  ipcMain.handle(IPC_CHANNELS.getPlayback, trusted(() => latest));
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
      } catch (error) {
        if (error instanceof SecretStoreUnavailableError) throw new Error(error.message);
        throw new Error("não foi possível guardar o segredo");
      }
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.secretClear,
    trusted(async (name: unknown) => {
      await deps.secrets.delete(await secretName(name));
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
  ipcMain.handle(IPC_CHANNELS.authLogout, trusted((service: unknown) => deps.oauth.logout(authService(service))));
  ipcMain.handle(
    IPC_CHANNELS.authLogin,
    trusted(async (service: unknown) => {
      const name = authService(service);
      const { media } = await configStore.load();
      try {
        return await deps.oauth.login(name, name === "spotify" ? media.spotifyClientId : media.googleClientId);
      } catch (error) {
        throw new Error(publicMessage(error));
      }
    }),
  );
}
