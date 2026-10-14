// Expõe somente comandos tipados ao renderer via contextBridge (seção 17.4).

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipcChannels.js";
import type {
  AppConfig,
  AuthService,
  AuthStatus,
  KeyCheck,
  MediaUrlResult,
  AgendaReminder,
  AgendaState,
  DeviceCheck,
  UsageCard,
  SecretStatus,
  PlaybackState,
  PlayerCommand,
} from "../shared/types.js";

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.getConfig),
  saveConfig: (config: AppConfig): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.saveConfig, config),
  getServerStatus: (): Promise<{ address: string; port: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.getServerStatus),
  getAgenda: (): Promise<AgendaState> => ipcRenderer.invoke(IPC_CHANNELS.getAgenda),
  refreshAgenda: (): Promise<AgendaState> => ipcRenderer.invoke(IPC_CHANNELS.refreshAgenda),
  onAgendaUpdate: (callback: (state: AgendaState) => void): (() => void) => {
    const listener = (_event: unknown, state: AgendaState) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.agendaUpdated, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.agendaUpdated, listener);
  },
  onAgendaReminder: (callback: (reminder: AgendaReminder) => void): (() => void) => {
    const listener = (_event: unknown, reminder: AgendaReminder) => callback(reminder);
    ipcRenderer.on(IPC_CHANNELS.agendaReminder, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.agendaReminder, listener);
  },
  getUsage: (): Promise<UsageCard[]> => ipcRenderer.invoke(IPC_CHANNELS.getUsage),
  refreshUsage: (): Promise<UsageCard[]> => ipcRenderer.invoke(IPC_CHANNELS.refreshUsage),
  onUsageUpdate: (callback: (cards: UsageCard[]) => void): (() => void) => {
    const listener = (_event: unknown, cards: UsageCard[]) => callback(cards);
    ipcRenderer.on(IPC_CHANNELS.usageUpdated, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.usageUpdated, listener);
  },
  testDevice: (): Promise<DeviceCheck> => ipcRenderer.invoke(IPC_CHANNELS.testDevice),
  getPlayback: (): Promise<PlaybackState> => ipcRenderer.invoke(IPC_CHANNELS.getPlayback),
  onPlaybackUpdate: (callback: (state: PlaybackState) => void): (() => void) => {
    const listener = (_event: unknown, state: PlaybackState) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.playbackUpdated, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.playbackUpdated, listener);
  },
  controlPlayback: (command: PlayerCommand): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.controlPlayback, command),
  playUrl: (url: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.playUrl, url),
  getSecretStatus: (name: string): Promise<SecretStatus> => ipcRenderer.invoke(IPC_CHANNELS.secretStatus, name),
  setSecret: (name: string, value: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.secretSet, name, value),
  clearSecret: (name: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.secretClear, name),
  validateProvider: (id: string): Promise<KeyCheck> => ipcRenderer.invoke(IPC_CHANNELS.providerValidate, id),
  getAuthStatus: (service: AuthService): Promise<AuthStatus> => ipcRenderer.invoke(IPC_CHANNELS.authStatus, service),
  login: (service: AuthService): Promise<AuthStatus> => ipcRenderer.invoke(IPC_CHANNELS.authLogin, service),
  logout: (service: AuthService): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.authLogout, service),
  resolveMediaUrl: (url: string): Promise<MediaUrlResult> => ipcRenderer.invoke(IPC_CHANNELS.resolveMediaUrl, url),
  minimizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.windowMinimize),
  toggleMaximizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.windowToggleMaximize),
  closeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.windowClose),
};

export type PainelApi = typeof api;

contextBridge.exposeInMainWorld("painelApi", api);
