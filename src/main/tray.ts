// Ícone na bandeja com menu mínimo (mostrar janela / sair).

import { app, BrowserWindow, Menu, Tray } from "electron";
import * as path from "node:path";

export function createTray(window: BrowserWindow): Tray {
  const tray = new Tray(path.join(__dirname, "../../assets/pixel/tray.png"));
  tray.setToolTip("Geek Painel");

  const menu = Menu.buildFromTemplate([
    {
      label: "Mostrar janela",
      click: () => {
        window.show();
        window.focus();
      },
    },
    { type: "separator" },
    {
      label: "Sair",
      click: () => app.quit(),
    },
  ]);
  tray.setContextMenu(menu);

  tray.on("click", () => {
    if (window.isVisible()) {
      window.hide();
    } else {
      window.show();
      window.focus();
    }
  });

  return tray;
}
