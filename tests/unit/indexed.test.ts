import { describe, expect, it } from "vitest";
import { toIndexed } from "../../src/renderer/device/indexed.js";

const pixel = (r: number, g: number, b: number) => [r, g, b, 255];

describe("toIndexed", () => {
  it("troca cada cor da paleta pelo seu índice", () => {
    const rgba = Uint8ClampedArray.from([...pixel(0xf7, 0xf6, 0xf3), ...pixel(0x1c, 0x1c, 0x1c), ...pixel(0xe8, 0x36, 0x8f), ...pixel(0x78, 0x78, 0x77)]);
    expect([...toIndexed(rgba)]).toEqual([0, 3, 4, 2]);
  });

  it("uma cor fora da paleta vira a mais próxima", () => {
    expect([...toIndexed(Uint8ClampedArray.from([...pixel(250, 250, 250), ...pixel(10, 10, 10)]))]).toEqual([0, 3]);
  });
});
