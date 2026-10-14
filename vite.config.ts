import react from "@vitejs/plugin-react";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [
    react(),
    electron({
      main: {
        entry: path.join(rootDir, "src/main/app.ts"),
        vite: {
          build: {
            outDir: path.join(rootDir, "dist-electron/main"),
            rollupOptions: {
              external: ["electron", "dbus-next"],
              output: {
                format: "cjs",
                entryFileNames: "app.js",
              },
            },
          },
        },
      },
      preload: {
        input: path.join(rootDir, "src/preload/preload.ts"),
        vite: {
          build: {
            outDir: path.join(rootDir, "dist-electron/preload"),
            rollupOptions: {
              output: {
                format: "cjs",
                entryFileNames: "preload.cjs",
              },
            },
          },
        },
      },
    }),
  ],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
});
