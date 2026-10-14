import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { configMessage, FRAME_SIZE, frameMessage, MESSAGE, message } from "../../src/shared/deviceProtocol.js";

const hasCompiler = spawnSync("g++", ["--version"]).status === 0;
const work = mkdtempSync(path.join(tmpdir(), "firmware-parser-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

// Um quadro com listras e um bloco, para exercitar trechos curtos e longos (> 255).
function pattern(seed: number): Uint8Array {
  const pixels = new Uint8Array(FRAME_SIZE * FRAME_SIZE);
  for (let index = 0; index < pixels.length; index += 1) {
    const x = index % FRAME_SIZE;
    const y = Math.floor(index / FRAME_SIZE);
    pixels[index] = y < 30 ? 0 : x < 60 ? (x + seed) % 6 : y > 90 ? 3 : (y + seed) % 6 < 3 ? 1 : 4;
  }
  return pixels;
}

// O decodificador em C++ do aparelho tem que entender os bytes do código TypeScript do app.
describe.skipIf(!hasCompiler)("leitor de mensagens do firmware (C++)", () => {
  const binary = path.join(work, "parser_test");

  it("compila no computador", () => {
    execFileSync("g++", ["-std=c++17", "-Wall", "-Wextra", "-Werror", "-o", binary, "firmware/test/parser_test.cpp", "firmware/src/parser.cpp"]);
  });

  it("decodifica configuração, quadros, brilho e recusa em pedaços irregulares", () => {
    const last = pattern(2);
    const stream = Buffer.concat([
      configMessage(),
      frameMessage(pattern(1)),
      message(MESSAGE.ping),
      message(MESSAGE.brightness, Uint8Array.of(77)),
      frameMessage(last),
      message(MESSAGE.reject, Uint8Array.of(1)),
    ]);
    const palette = configMessage().subarray(3 + 4, 3 + 4 + 12);
    const expected = Buffer.concat([Buffer.from([2, 77, 1, 6]), palette, Buffer.from(last)]);
    writeFileSync(path.join(work, "input.bin"), stream);
    writeFileSync(path.join(work, "expected.bin"), expected);
    const output = execFileSync(binary, [path.join(work, "input.bin"), path.join(work, "expected.bin")]).toString();
    expect(output).toContain("ok: 2 quadros, brilho 77, 1 recusa(s), paleta de 6 cores");
  });

  it("descarta quadro incompleto sem desenhar", () => {
    const broken = frameMessage(pattern(3)).subarray(0, 40);
    const stream = Buffer.concat([configMessage(), frameMessage(pattern(1)), broken]);
    // 255 = não conferir o brilho (nunca foi enviado)
    const expected = Buffer.concat([Buffer.from([1, 255, 0, 6]), configMessage().subarray(7, 19), Buffer.from(pattern(1))]);
    writeFileSync(path.join(work, "input2.bin"), stream);
    writeFileSync(path.join(work, "expected2.bin"), expected);
    const output = execFileSync(binary, [path.join(work, "input2.bin"), path.join(work, "expected2.bin")]).toString();
    expect(output).toContain("ok: 1 quadros");
  });
});
