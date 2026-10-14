import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

// A interface roda no navegador: não pode importar o que usa Buffer ou módulos do Node.
describe("imports da interface", () => {
  const sources = files("src/renderer").map((file) => ({ file, text: readFileSync(file, "utf-8") }));

  it("não importa o protocolo que usa Buffer", () => {
    const offenders = sources.filter(({ text }) => /from\s+["'][^"']*shared\/deviceProtocol\.js["']/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("não importa módulos do Node", () => {
    const offenders = sources.filter(({ text }) => /from\s+["']node:/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
