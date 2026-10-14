// Abre o app empacotado (dist-electron) e salva um screenshot por aba.
// Uso: node scripts/screenshot.mjs <pasta-de-saida> [dpr]
import { _electron as electron } from "playwright-core";
import * as path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const outDir = path.resolve(process.argv[2] ?? "shots");
const dpr = process.argv[3] ?? "1";
// Estilo do relógio opcional (digital | analog | flip), via config isolada.
const clockStyle = process.argv[4];
mkdirSync(outDir, { recursive: true });

const env = { ...process.env };
const configDir = path.join(outDir, "config");
mkdirSync(configDir, { recursive: true });
// Porta própria para não colidir com uma instância já aberta.
writeFileSync(
  path.join(configDir, "config.json"),
  JSON.stringify({ server: { port: 4700 + Math.floor(Math.random() * 200) }, ...(clockStyle ? { clock: { style: clockStyle } } : {}) }),
);
env.PAINEL_CONFIG_DIR = configDir;
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: [".", "--no-sandbox", `--force-device-scale-factor=${dpr}`],
  env,
});
const page = await app.firstWindow();
await page.waitForLoadState("load");
await page.waitForTimeout(800);

for (const label of ["Player", "Tokens", "Relógio", "Agenda", "Config"]) {
  await page.getByRole("button", { name: label }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `${label.toLowerCase()}-dpr${dpr}${clockStyle ? `-${clockStyle}` : ""}.png`) });
}
console.log(await page.evaluate(() => ({ dpr: window.devicePixelRatio, w: innerWidth, h: innerHeight })));
await app.close();
