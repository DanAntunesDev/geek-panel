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
  DeviceAdminResult,
  DeviceCheck,
  DeviceLinkStatus,
  DeviceState,
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
  getDeviceLink: (): Promise<DeviceLinkStatus> => ipcRenderer.invoke(IPC_CHANNELS.getDeviceLink),
  onDeviceLinkUpdate: (callback: (status: DeviceLinkStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: DeviceLinkStatus) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.deviceLinkUpdated, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.deviceLinkUpdated, listener);
  },
  // usados só pela janela oculta que alimenta o aparelho
  getDeviceState: (): Promise<DeviceState> => ipcRenderer.invoke(IPC_CHANNELS.getDeviceState),
  onDeviceState: (callback: (state: DeviceState) => void): (() => void) => {
    const listener = (_event: unknown, state: DeviceState) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.deviceStateUpdated, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.deviceStateUpdated, listener);
  },
  onThemeUpdate: (callback: (accent: string) => void): (() => void) => {
    const listener = (_event: unknown, accent: string) => callback(accent);
    ipcRenderer.on(IPC_CHANNELS.themeUpdated, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.themeUpdated, listener);
  },
  pushDeviceFrame: (pixels: Uint8Array): void => ipcRenderer.send(IPC_CHANNELS.deviceFrame, pixels),
  pairDevice: (): Promise<DeviceAdminResult> => ipcRenderer.invoke(IPC_CHANNELS.pairDevice),
  resetDevice: (): Promise<DeviceAdminResult> => ipcRenderer.invoke(IPC_CHANNELS.resetDevice),
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
