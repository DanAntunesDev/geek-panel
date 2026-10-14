import { promises as fs } from "node:fs";
import * as path from "node:path";

const FILES = ["config.json", "secrets.json"];

// Versões antigas guardavam tudo em ~/.config/geek-panel; copia para a pasta padrão do sistema.
export async function migrateLegacyConfig(legacyDir: string, targetDir: string): Promise<boolean> {
  if (path.resolve(legacyDir) === path.resolve(targetDir)) return false;
  const exists = (file: string) => fs.access(file).then(() => true, () => false);
  if (await exists(path.join(targetDir, "config.json"))) return false;
  if (!(await exists(path.join(legacyDir, "config.json")))) return false;

  await fs.mkdir(targetDir, { recursive: true, mode: 0o700 });
  for (const name of FILES) {
    if (await exists(path.join(legacyDir, name))) await fs.copyFile(path.join(legacyDir, name), path.join(targetDir, name));
  }
  return true;
}
