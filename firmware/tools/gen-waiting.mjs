// Gera firmware/src/waiting_frames.h com as telas de espera (RLE, na paleta do aparelho).
// Uso: CHROME_PATH=<chromium> node firmware/tools/gen-waiting.mjs [pasta-da-prévia]
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const work = mkdtempSync(path.join(tmpdir(), "gen-waiting-"));
await build({ entryPoints: ["firmware/tools/entry.ts"], bundle: true, format: "iife", outfile: path.join(work, "entry.js"), logLevel: "error" });
await build({ entryPoints: ["firmware/tools/encode.ts"], bundle: true, format: "esm", platform: "node", outfile: path.join(work, "encode.mjs"), logLevel: "error" });
const { encodeFrame, png } = await import(pathToFileURL(path.join(work, "encode.mjs")).href);

const font = readFileSync("src/renderer/assets/fonts/PressStart2P-Regular.ttf").toString("base64");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(`<style>@font-face{font-family:"Press Start 2P";src:url(data:font/ttf;base64,${font})}</style><canvas id="c" width="120" height="120"></canvas>`);
await page.addScriptTag({ path: path.join(work, "entry.js") });
await page.evaluate(() => Waiting.ensureFont());

const states = await page.evaluate(() => Waiting.WAITING.map((item) => ({ ...item })));
const frames = [];
for (const state of states) {
  for (let frame = 0; frame < state.frames; frame += 1) {
    const pixels = await page.evaluate(
      ({ name, frame }) => {
        const ctx = document.getElementById("c").getContext("2d");
        Waiting.drawWaiting(ctx, name, frame);
        return Array.from(Waiting.toIndexed(ctx.getImageData(0, 0, 120, 120).data));
      },
      { name: state.name, frame },
    );
    frames.push({ state: state.name, frame, pixels: Uint8Array.from(pixels), rle: encodeFrame(Uint8Array.from(pixels)) });
  }
}
await browser.close();

const offsets = [0];
const data = [];
for (const item of frames) {
  data.push(...item.rle);
  offsets.push(data.length);
}
const rows = (values, width) => values.reduce((out, value, index) => out + (index % width === 0 ? "\n  " : " ") + value + ",", "");
const header = `// Gerado por firmware/tools/gen-waiting.mjs. Não edite à mão.
#pragma once
#include <Arduino.h>

#define WAIT_STATES ${states.length}
static const uint8_t WAIT_FRAME_COUNT[WAIT_STATES] = {${states.map((item) => item.frames).join(", ")}};
static const uint8_t WAIT_FIRST_FRAME[WAIT_STATES] = {${states.map((_, index) => states.slice(0, index).reduce((sum, item) => sum + item.frames, 0)).join(", ")}};
${states.map((item, index) => `#define WAIT_${item.name.toUpperCase()} ${index}`).join("\n")}

static const uint32_t WAIT_OFFSET[] PROGMEM = {${rows(offsets, 12)}
};

static const uint8_t WAIT_DATA[] PROGMEM = {${rows(data, 24)}
};
`;
writeFileSync("firmware/src/waiting_frames.h", header);

const preview = process.argv[2];
if (preview) {
  mkdirSync(preview, { recursive: true });
  for (const item of frames.filter((entry) => entry.frame === 0 || entry.frame === 3)) writeFileSync(path.join(preview, `${item.state}-${item.frame}.png`), png(item.pixels));
}
const kb = (data.length / 1024).toFixed(1);
console.log(`${frames.length} quadros, ${kb} KB de dados -> firmware/src/waiting_frames.h`);
