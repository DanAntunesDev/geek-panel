// Ponto de entrada do processo principal: janela, bandeja, servidor local e IPC.

import { app, BrowserWindow } from "electron";
import * as os from "node:os";
import * as path from "node:path";
import { ConfigStore } from "../config/ConfigStore.js";
import { registerIpcHandlers } from "./ipc.js";
import { startHttpServer } from "./httpServer.js";
import { createTray } from "./tray.js";
import { createMainWindow } from "./window.js";

const APP_ID = "com.geekpanel.app";
// Nome sem espaços: no Linux vira o WM_CLASS da janela, que precisa bater
// com StartupWMClass do .desktop para o GNOME agrupar/identificar o app.
app.setName(APP_ID);
if (process.platform === "linux") {
  app.setAppUserModelId(APP_ID);
}

const configDir = path.join(os.homedir(), ".config", "geek-panel");
const configStore = new ConfigStore(configDir);

let mainWindow: BrowserWindow | undefined;
let isQuitting = false;

async function bootstrap(): Promise<void> {
  const config = await configStore.load();
  const server = await startHttpServer(() => config);

  mainWindow = createMainWindow();
  createTray(mainWindow);
  registerIpcHandlers(mainWindow, configStore, server);

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  // O aplicativo permanece na bandeja; sair é uma ação explícita do menu.
});

app.on("activate", () => {
  mainWindow?.show();
});
