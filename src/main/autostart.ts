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
  setLoginItem?: (settings: { openAtLogin: boolean; args: string[]; path?: string }) => void;
  // Windows, versão portátil: o executável de verdade (o do processo fica numa pasta temporária).
  portableExe?: string;
}

export const HIDDEN_FLAG = "--hidden";

const APP_CLASS = "com.geekpanel.app";

export function desktopEntry(exec: string, icon?: string): string {
  const lines = ["[Desktop Entry]", "Type=Application", "Name=Geek Panel", `Exec=${exec}`, "Terminal=false", "X-GNOME-Autostart-enabled=true", `StartupWMClass=${APP_CLASS}`];
  if (icon) lines.push(`Icon=${icon}`);
  return [...lines, ""].join("\n");
}

function launcherProgram(deps: AutostartDeps): string {
  return deps.appImage ?? `"${deps.execPath}"${deps.isPackaged ? "" : ` "${deps.appPath}"`}`;
}

// Sem um .desktop com o mesmo StartupWMClass, o GNOME mostra o ícone genérico na barra de tarefas.
export async function installLinuxLauncher(deps: AutostartDeps, iconSource: string): Promise<void> {
  if (deps.platform !== "linux") return;
  const data = process.env.XDG_DATA_HOME ?? path.join(deps.home ?? os.homedir(), ".local", "share");
  const iconTarget = path.join(data, "icons", "hicolor", "512x512", "apps", `${APP_CLASS}.png`);
  await fs.mkdir(path.dirname(iconTarget), { recursive: true });
  await fs.copyFile(iconSource, iconTarget);

  const entry = path.join(data, "applications", `${APP_CLASS}.desktop`);
  const text = desktopEntry(launcherProgram(deps), iconTarget).replace("Name=Geek Panel", "Name=Painel local").replace("X-GNOME-Autostart-enabled=true\n", "");
  await fs.mkdir(path.dirname(entry), { recursive: true });
  if ((await fs.readFile(entry, "utf-8").catch(() => "")) !== text) await fs.writeFile(entry, text, "utf-8");
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
    const program = launcherProgram(deps);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, desktopEntry(`${program} ${HIDDEN_FLAG}`, APP_CLASS), "utf-8");
    return;
  }
  // em desenvolvimento o executável seria o do Electron solto: não registra
  if (deps.isPackaged) deps.setLoginItem?.({ openAtLogin: enabled, args: [HIDDEN_FLAG], ...(deps.portableExe ? { path: deps.portableExe } : {}) });
}
