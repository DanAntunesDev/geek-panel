import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAutostart, desktopEntry, installLinuxLauncher, type AutostartDeps } from "../../src/main/autostart.js";
import { migrateLegacyConfig } from "../../src/main/legacyConfig.js";

let home: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "autostart-"));
  vi.stubEnv("XDG_CONFIG_HOME", "");
  delete process.env.XDG_CONFIG_HOME;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

const linux = (extra: Partial<AutostartDeps> = {}): AutostartDeps => ({ platform: "linux", isPackaged: true, execPath: "/opt/geek-panel/geek-panel", appPath: "/opt/geek-panel/resources/app", home, ...extra });
const file = () => path.join(home, ".config", "autostart", "geek-panel.desktop");

describe("applyAutostart (Linux)", () => {
  it("cria a entrada que abre o app escondido e a remove ao desligar", async () => {
    await applyAutostart(true, linux());
    const text = await fs.readFile(file(), "utf-8");
    expect(text).toContain('Exec="/opt/geek-panel/geek-panel" --hidden');
    expect(text).toContain("X-GNOME-Autostart-enabled=true");

    await applyAutostart(false, linux());
    await expect(fs.access(file())).rejects.toBeDefined();
  });

  it("em desenvolvimento aponta para a pasta do app; no AppImage usa o próprio arquivo", async () => {
    await applyAutostart(true, linux({ isPackaged: false, execPath: "/x/electron" }));
    expect(await fs.readFile(file(), "utf-8")).toContain('Exec="/x/electron" "/opt/geek-panel/resources/app" --hidden');
    await applyAutostart(true, linux({ appImage: "/home/u/GeekPanel.AppImage" }));
    expect(await fs.readFile(file(), "utf-8")).toContain("Exec=/home/u/GeekPanel.AppImage --hidden");
  });

  it("desligar sem arquivo não dá erro", async () => {
    await expect(applyAutostart(false, linux())).resolves.toBeUndefined();
  });
});

describe("installLinuxLauncher", () => {
  it("grava o atalho do app com ícone e classe da janela, sem abrir escondido", async () => {
    vi.stubEnv("XDG_DATA_HOME", path.join(home, "data"));
    const icon = path.join(home, "icon.png");
    await fs.writeFile(icon, "png");
    await installLinuxLauncher(linux(), icon);

    const text = await fs.readFile(path.join(home, "data", "applications", "com.geekpanel.app.desktop"), "utf-8");
    expect(text).toContain("Name=Painel local");
    expect(text).toContain('Exec="/opt/geek-panel/geek-panel"\n');
    expect(text).toContain("StartupWMClass=com.geekpanel.app");
    expect(text).toContain(`Icon=${path.join(home, "data", "icons", "hicolor", "512x512", "apps", "com.geekpanel.app.png")}`);
    expect(text).not.toContain("--hidden");
    expect(await fs.readFile(path.join(home, "data", "icons", "hicolor", "512x512", "apps", "com.geekpanel.app.png"), "utf-8")).toBe("png");
  });

  it("não faz nada fora do Linux", async () => {
    await expect(installLinuxLauncher({ platform: "win32", isPackaged: true, execPath: "", appPath: "" }, "/x.png")).resolves.toBeUndefined();
  });
});

describe("applyAutostart (Windows)", () => {
  it("registra a entrada do sistema com o parâmetro de abrir escondido", async () => {
    const setLoginItem = vi.fn();
    await applyAutostart(true, { platform: "win32", isPackaged: true, execPath: "C:\\x.exe", appPath: "", setLoginItem });
    expect(setLoginItem).toHaveBeenCalledWith({ openAtLogin: true, args: ["--hidden"] });
  });

  it("sem pacote (desenvolvimento) não registra nada", async () => {
    const setLoginItem = vi.fn();
    await applyAutostart(true, { platform: "win32", isPackaged: false, execPath: "", appPath: "", setLoginItem });
    expect(setLoginItem).not.toHaveBeenCalled();
  });
});

describe("desktopEntry", () => {
  it("é um .desktop válido", () => {
    expect(desktopEntry("x --hidden").startsWith("[Desktop Entry]\nType=Application")).toBe(true);
  });
});

describe("migrateLegacyConfig", () => {
  it("copia a configuração antiga uma única vez", async () => {
    const legacy = path.join(home, "old");
    const target = path.join(home, "new");
    await fs.mkdir(legacy);
    await fs.writeFile(path.join(legacy, "config.json"), '{"a":1}');
    await fs.writeFile(path.join(legacy, "secrets.json"), "{}");

    expect(await migrateLegacyConfig(legacy, target)).toBe(true);
    expect(await fs.readFile(path.join(target, "config.json"), "utf-8")).toBe('{"a":1}');
    expect(await fs.readFile(path.join(target, "secrets.json"), "utf-8")).toBe("{}");

    await fs.writeFile(path.join(target, "config.json"), '{"a":2}');
    expect(await migrateLegacyConfig(legacy, target)).toBe(false);
    expect(await fs.readFile(path.join(target, "config.json"), "utf-8")).toBe('{"a":2}');
  });

  it("não faz nada sem configuração antiga", async () => {
    expect(await migrateLegacyConfig(path.join(home, "nada"), path.join(home, "novo"))).toBe(false);
  });
});
