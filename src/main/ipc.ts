// Ponte IPC mínima e tipada (seção 17.4 da spec). O renderer nunca recebe
// child_process, filesystem ou APIs do Electron diretamente.

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { ConfigStore, ConfigValidationError } from "../config/ConfigStore.js";
import { IPC_CHANNELS } from "../shared/ipcChannels.js";
import type { RunningServer } from "./httpServer.js";

function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  if (event.sender !== window.webContents) {
    throw new Error("remetente IPC não autorizado");
  }
}

export function registerIpcHandlers(window: BrowserWindow, configStore: ConfigStore, server: RunningServer): void {
  ipcMain.handle(IPC_CHANNELS.getConfig, async (event) => {
    assertTrustedSender(event, window);
    return configStore.load();
  });

  ipcMain.handle(IPC_CHANNELS.saveConfig, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    try {
      return await configStore.save(input);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw new Error(`configuração inválida: ${error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.getServerStatus, async (event) => {
    assertTrustedSender(event, window);
    return { address: server.address, port: server.port };
  });
}
