import { BrowserWindow } from "electron";
import type { YouTubePage } from "./youtubeSource.js";

// janela oculta e sem permissões, só para o áudio
export function createYouTubePage(): YouTubePage {
  const window = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: {
      partition: "geek-panel-youtube",
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required",
      backgroundThrottling: false,
    },
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  let origin = "";
  window.webContents.on("will-navigate", (event, url) => {
    if (!origin || !url.startsWith(origin)) event.preventDefault();
  });

  return {
    async load(url) {
      origin = new URL(url).origin;
      await window.loadURL(url);
    },
    run: (script) => window.webContents.executeJavaScript(script),
    destroy: () => {
      if (!window.isDestroyed()) window.destroy();
    },
    alive: () => !window.isDestroyed(),
  };
}
