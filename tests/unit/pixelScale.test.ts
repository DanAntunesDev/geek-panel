import { describe, expect, it } from "vitest";
import { cssPerLogicalPixel, FRAME_SIZE, pickScale } from "../../src/renderer/pixel/scale.js";

describe("pickScale", () => {
  it("usa fator inteiro em 100%", () => {
    expect(pickScale(540, 540, 1)).toBe(4);
    expect(pickScale(660, 700, 1)).toBe(5);
  });

  it("calcula em pixels físicos com DPR fracionário", () => {
    expect(pickScale(540, 540, 1.25)).toBe(5);
    expect(pickScale(540, 540, 1.5)).toBe(6);
  });

  it("limita pelo menor lado e nunca fica abaixo de 1", () => {
    expect(pickScale(2000, 330, 1)).toBe(2);
    expect(pickScale(100, 100, 1)).toBe(1);
  });

  it("gera tamanhos CSS que fecham em pixels de dispositivo inteiros", () => {
    for (const dpr of [1, 1.25, 1.5, 2]) {
      const scale = pickScale(540, 540, dpr);
      const cssPerPixel = cssPerLogicalPixel(scale, dpr);
      expect(Math.round(FRAME_SIZE * cssPerPixel * dpr)).toBe(FRAME_SIZE * scale);
    }
  });
});
