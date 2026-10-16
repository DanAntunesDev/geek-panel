// Ponto de entrada do processo principal: janela, bandeja e IPC.

import { app, BrowserWindow, Menu, safeStorage, shell } from "electron";
import * as os from "node:os";
import * as path from "node:path";
import { ConfigStore } from "../config/ConfigStore.js";
import { applyAutostart, HIDDEN_FLAG, installLinuxLauncher, type AutostartDeps } from "./autostart.js";
import { migrateLegacyConfig } from "./legacyConfig.js";
import { OAuthManager } from "./oauth.js";
import { SecretStore, type Cipher } from "./secretStore.js";
import { registerIpcHandlers } from "./ipc.js";
import { createTray } from "./tray.js";
import { createMainWindow } from "./window.js";

const APP_ID = "com.geekpanel.app";
// Nome sem espaços: no Linux vira o WM_CLASS da janela, que precisa bater
// com StartupWMClass do .desktop para o GNOME agrupar/identificar o app.
app.setName(APP_ID);
// no Windows é o que agrupa o app na barra de tarefas e libera as notificações
app.setAppUserModelId(APP_ID);

// uma instância só: abrir de novo (ou o início com o sistema) só traz a janela para a frente
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

// PAINEL_CONFIG_DIR: pasta alternativa, usada nos testes visuais
const configDir = process.env.PAINEL_CONFIG_DIR ?? app.getPath("userData");
const legacyDir = path.join(os.homedir(), ".config", "geek-panel");
const configStore = new ConfigStore(configDir);
const startHidden = process.argv.includes(HIDDEN_FLAG);

const autostartDeps = (): AutostartDeps => ({
  platform: process.platform,
  isPackaged: app.isPackaged,
  execPath: process.execPath,
  appPath: app.getAppPath(),
  appImage: process.env.APPIMAGE,
  portableExe: process.env.PORTABLE_EXECUTABLE_FILE,
  setLoginItem: (settings) => app.setLoginItemSettings(settings),
});

// no Linux, "basic_text" não protege nada: recusamos
const secretCipher: Cipher = {
  isAvailable: () =>
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"),
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (data) => safeStorage.decryptString(data),
};
const secretStore = new SecretStore(configDir, secretCipher);
const oauthManager = new OAuthManager({
  store: secretStore,
  openUrl: (url) => shell.openExternal(url),
});

// sem subpixel no texto, senão as bordas saem da paleta
app.commandLine.appendSwitch("disable-lcd-text");

let mainWindow: BrowserWindow | undefined;
let isQuitting = false;

async function bootstrap(): Promise<void> {
  Menu.setApplicationMenu(null);

  if (!process.env.PAINEL_CONFIG_DIR) await migrateLegacyConfig(legacyDir, configDir);
  const config = await configStore.load();
  // mantém o sistema de acordo com a opção salva (ex.: o app foi movido de lugar)
  await applyAutostart(config.app.startWithSystem, autostartDeps()).catch(() => undefined);
  await installLinuxLauncher(autostartDeps(), path.join(__dirname, "../../assets/pixel/icon-512.png")).catch(() => undefined);

  mainWindow = createMainWindow(!startHidden);
  createTray(mainWindow);
  registerIpcHandlers(mainWindow, configStore, {
    secrets: secretStore,
    oauth: oauthManager,
    autostart: (enabled) => applyAutostart(enabled, autostartDeps()),
  });

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

if (gotLock) app.whenReady().then(bootstrap);

app.on("second-instance", () => {
  mainWindow?.show();
  mainWindow?.focus();
});

app.on("window-all-closed", () => {
  // O aplicativo permanece na bandeja; sair é uma ação explícita do menu.
});

app.on("activate", () => {
  mainWindow?.show();
});
