// Uso: node scripts/fake-device.mjs <pasta> [segundos] [host-da-descoberta] [código-de-pareamento]
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const out = path.join(mkdtempSync(path.join(tmpdir(), "fake-device-")), "fake-device.mjs");
await build({ entryPoints: ["scripts/fake-device.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
await import(pathToFileURL(out).href);
