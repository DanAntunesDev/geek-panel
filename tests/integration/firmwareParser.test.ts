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

describe.skipIf(!hasCompiler)("chuva da tela de espera (C++)", () => {
  const source = `
#include <stdio.h>
#include "rain.h"
int main() {
  static uint8_t frame[7200];
  static uint8_t before[7200];
  rainReset(7);
  rainMessage(1);
  unsigned counts[16] = {0};
  unsigned changed = 0;
  unsigned decodedAt = 0;
  for (int n = 1; n <= 400; n++) {
    for (int i = 0; i < 7200; i++) before[i] = frame[i];
    rainStep(frame);
    for (int i = 0; i < 7200; i++) {
      counts[frame[i] & 15]++;
      counts[frame[i] >> 4]++;
      if (frame[i] != before[i]) changed++;
    }
    if (!decodedAt && rainLocked() == rainTotal()) decodedAt = n;
  }
  printf("%u %u %u %u %u %u %u %u %u\\n", counts[0], counts[1], counts[2], counts[3], counts[4] + counts[5], counts[15], changed > 0, decodedAt, rainTotal());
}`;

  it("usa só as cores da tela de espera, anima, tem a máscara na frente e decifra a mensagem inteira", () => {
    writeFileSync(path.join(work, "rain_test.cpp"), source);
    const binary = path.join(work, "rain_test");
    execFileSync("g++", ["-std=c++17", "-Wall", "-Wextra", "-Werror", "-Ifirmware/src", "-o", binary, path.join(work, "rain_test.cpp"), "firmware/src/rain.cpp"]);
    const [white, light, gray, black, red, transparent, animated, decodedAt, total] = execFileSync(binary).toString().trim().split(" ").map(Number);
    // o índice 15 (transparente) só existe na máscara e nunca chega ao quadro; o vermelho é da máscara e do "SAFE"
    expect(transparent).toBe(0);
    expect(red).toBeGreaterThan(0);
    expect(animated).toBe(1);
    expect(white).toBeGreaterThan(0);
    expect(light).toBeGreaterThan(0);
    expect(gray).toBeGreaterThan(0);
    // "NO SYSTEM IS SAFE", "PROCURANDO GEEK" e "PANEL... ABRA NO PC", sem os espaços
    expect(total).toBe(14 + 14 + 16);
    // a chuva decifra tudo antes do tempo limite, sem precisar do empurrão final
    expect(decodedAt).toBeGreaterThan(0);
    expect(decodedAt).toBeLessThanOrEqual(220);
    // há fundo preto de sobra em volta da máscara
    expect(black).toBeGreaterThan(white / 2);
  });
});
