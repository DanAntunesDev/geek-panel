import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface AutostartDeps {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  execPath: string;
  appPath: string;
  home?: string;
  appImage?: string;
  // Windows e macOS: o próprio Electron cuida da entrada de inicialização.
  setLoginItem?: (settings: { openAtLogin: boolean; args: string[] }) => void;
}

export const HIDDEN_FLAG = "--hidden";

export function desktopEntry(exec: string): string {
  return ["[Desktop Entry]", "Type=Application", "Name=Geek Panel", `Exec=${exec}`, "Terminal=false", "X-GNOME-Autostart-enabled=true", ""].join("\n");
}

export function linuxAutostartFile(home = os.homedir()): string {
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "autostart", "geek-panel.desktop");
}

// Liga ou desliga a abertura junto com o sistema. Abre escondido, só na bandeja.
export async function applyAutostart(enabled: boolean, deps: AutostartDeps): Promise<void> {
  if (deps.platform === "linux") {
    const file = linuxAutostartFile(deps.home);
    if (!enabled) {
      await fs.rm(file, { force: true });
      return;
    }
    const program = deps.appImage ?? `"${deps.execPath}"${deps.isPackaged ? "" : ` "${deps.appPath}"`}`;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, desktopEntry(`${program} ${HIDDEN_FLAG}`), "utf-8");
    return;
  }
  // em desenvolvimento o executável seria o do Electron solto: não registra
  if (deps.isPackaged) deps.setLoginItem?.({ openAtLogin: enabled, args: [HIDDEN_FLAG] });
}
