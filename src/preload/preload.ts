// Expõe somente comandos tipados ao renderer via contextBridge (seção 17.4).

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipcChannels.js";
import type { AppConfig } from "../shared/types.js";

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.getConfig),
  saveConfig: (config: AppConfig): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.saveConfig, config),
  getServerStatus: (): Promise<{ address: string; port: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.getServerStatus),
};

export type PainelApi = typeof api;

contextBridge.exposeInMainWorld("painelApi", api);
