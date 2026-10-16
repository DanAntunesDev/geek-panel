import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { rgb565 } from "../../src/shared/deviceConstants.js";
import { WAITING_PALETTE, WaitingRain } from "../../src/renderer/waiting/waitingRain.js";

const hasCompiler = spawnSync("g++", ["--version"]).status === 0;
const work = mkdtempSync(path.join(tmpdir(), "waiting-rain-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const STEPS = 330;
const SEED = 123;

// O app mostra a prévia com a versão em TypeScript; ela precisa gerar, quadro a quadro, o mesmo que o aparelho.
describe.skipIf(!hasCompiler)("tela de espera: app e firmware", () => {
  const binary = path.join(work, "dump");

  it("compila a versão do aparelho no computador", () => {
    writeFileSync(
      path.join(work, "dump.cpp"),
      `#include <stdio.h>
#include <stdlib.h>
#include "rain.h"
int main(int, char** argv) {
  static uint8_t frame[7200];
  rainReset(${SEED});
  rainMessage(atoi(argv[1]));
  for (int n = 0; n < ${STEPS}; n++) {
    rainStep(frame);
    for (int at = 0; at < 14400; at++) putchar(((at & 1) ? frame[at >> 1] >> 4 : frame[at >> 1] & 15) + 'a');
  }
}`,
    );
    execFileSync("g++", ["-std=c++17", "-Wall", "-Wextra", "-Werror", "-Ifirmware/src", "-o", binary, path.join(work, "dump.cpp"), "firmware/src/rain.cpp"]);
  });

  for (const message of [0, 1, 2, 3]) {
    it(`mensagem ${message}: ${STEPS} quadros idênticos`, () => {
      const device = execFileSync(binary, [String(message)], { maxBuffer: 1 << 28 }).toString();
      const rain = new WaitingRain(SEED);
      rain.message(message);
      for (let step = 0; step < STEPS; step += 1) {
        const expected = device.slice(step * 14400, (step + 1) * 14400);
        const actual = Array.from(rain.step(), (index) => String.fromCharCode(index + 97)).join("");
        if (actual !== expected) {
          const at = [...actual].findIndex((char, index) => char !== expected[index]);
          throw new Error(`quadro ${step} difere no pixel ${at} (x ${at % 120}, y ${Math.floor(at / 120)}): app ${actual[at]}, aparelho ${expected[at]}`);
        }
      }
    });
  }

  it("as cores da tela de espera são as mesmas no app e no firmware", () => {
    const source = readFileSync("firmware/src/display.cpp", "utf-8");
    const found = source.match(/WAITING_PALETTE\[6\] = \{([^}]*)\}/)?.[1].split(",").map((value) => Number.parseInt(value.trim(), 16));
    expect(found).toEqual(WAITING_PALETTE.map(rgb565));
  });
});
