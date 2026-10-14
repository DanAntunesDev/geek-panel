// Cria a janela principal com as restrições de segurança da seção 17.4 da spec.

import { BrowserWindow, shell } from "electron";
import * as path from "node:path";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
].join("; ");

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 540,
    height: 650,
    minWidth: 540,
    minHeight: 440,
    title: "Painel local",
    icon: path.join(__dirname, "../../assets/pixel/icon-512.png"),
    frame: false,
    backgroundColor: "#F7F6F3",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  // o CSP não vale no servidor de dev do Vite (HMR)
  if (!devServerUrl) {
    window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [CONTENT_SECURITY_POLICY],
        },
      });
    });
  }

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !(devServerUrl && url.startsWith(devServerUrl))) {
      event.preventDefault();
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url).catch(() => undefined);
    }
    return { action: "deny" };
  });

  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }

  return window;
}
