// Janela principal: sem Node no renderer, com CSP e navegação travada.

import { BrowserWindow, shell } from "electron";
import * as path from "node:path";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
].join("; ");

export const PRELOAD_PATH = path.join(__dirname, "../preload/preload.cjs");

// CSP, bloqueio de navegação e carga da interface (com #hash opcional para escolher a tela).
export function attachRenderer(window: BrowserWindow, hash = ""): void {
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

  // a interface não precisa de câmera, microfone nem localização
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

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
    window.loadURL(hash ? `${devServerUrl}#${hash}` : devServerUrl);
  } else {
    window.loadFile(path.join(__dirname, "../../dist/renderer/index.html"), hash ? { hash } : undefined);
  }
}

export function createMainWindow(show = true): BrowserWindow {
  const window = new BrowserWindow({
    show,
    width: 540,
    height: 650,
    minWidth: 540,
    minHeight: 440,
    title: "Geek Painel",
    icon: path.join(__dirname, "../../assets/pixel/icon-512.png"),
    frame: false,
    backgroundColor: "#F7F6F3",
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // o som do lembrete toca mesmo com a janela escondida na bandeja
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  attachRenderer(window);

  return window;
}
