// Renderiza as cenas com dados de exemplo e salva PNGs ampliados.
// Uso: node scripts/render-scenes.mjs <pasta-de-saida> [escala] [arquivo-de-cenas.json]
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const out = path.resolve(process.argv[2] ?? "scenes");
const scale = Number(process.argv[3] ?? 4);
mkdirSync(out, { recursive: true });

await build({ entryPoints: ["scripts/scenes-entry.ts"], bundle: true, format: "iife", outfile: path.join(out, "scenes.js"), logLevel: "error" });
const font = readFileSync("src/renderer/assets/fonts/PressStart2P-Regular.ttf").toString("base64");

// CHROME_PATH aponta para um Chromium já instalado, se o do Playwright não estiver.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(`<style>@font-face{font-family:"Press Start 2P";src:url(data:font/ttf;base64,${font})}</style><canvas id="c" width="120" height="120"></canvas>`);
await page.addScriptTag({ path: path.join(out, "scenes.js") });
await page.evaluate(() => Scenes.ensureFont());

const shots = JSON.parse(readFileSync(process.argv[4] ?? "scripts/scene-shots.json", "utf-8"));
for (const shot of shots) {
  const dataUrl = await page.evaluate(
    ({ shot, scale }) => {
      const canvas = document.getElementById("c");
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const now = Date.parse(shot.now ?? "2026-10-14T14:00:00-03:00");
      const minutes = (value) => new Date(now + value * 60000).toISOString();
      const events = (shot.events ?? []).map((e, i) => ({
        id: "e" + i, title: e.title, start: minutes(e.in), end: minutes(e.in + (e.len ?? 30)), allDay: !!e.allDay, location: null, link: null,
      }));
      if (shot.scene === "player") Scenes.drawPlayer(ctx, shot.view);
      if (shot.scene === "usage") Scenes.drawUsage(ctx, shot.view);
      if (shot.scene === "agenda") Scenes.drawAgenda(ctx, { state: { ...shot.state, events }, now, frame: shot.frame ?? 0 });
      if (shot.scene === "clock") {
        const flip = Scenes.newFlipState();
        const view = { ...shot.view, parts: Scenes.clockParts(new Date(now), shot.view.timezone), flip };
        Scenes.drawClock(ctx, view);
      }
      const big = document.createElement("canvas");
      big.width = big.height = 120 * scale;
      const bctx = big.getContext("2d");
      bctx.imageSmoothingEnabled = false;
      bctx.drawImage(canvas, 0, 0, 120 * scale, 120 * scale);
      return big.toDataURL("image/png");
    },
    { shot, scale },
  );
  writeFileSync(path.join(out, `${shot.name}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
}
await browser.close();
console.log(`${shots.length} cenas em ${out}`);
