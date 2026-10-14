import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH, cssPerLogicalPixel, pickScale } from "../../src/renderer/pixel/scale.js";

describe("pickScale", () => {
  it("usa fator inteiro em 100%", () => {
    expect(pickScale(540, 540, 1)).toBe(3);
    expect(pickScale(660, 700, 1)).toBe(4);
  });

  it("calcula em pixels físicos com DPR fracionário", () => {
    expect(pickScale(540, 540, 1.25)).toBe(4);
    expect(pickScale(540, 540, 1.5)).toBe(5);
  });

  it("limita pelo menor lado e nunca fica abaixo de 1", () => {
    expect(pickScale(2000, 330, 1)).toBe(2);
    expect(pickScale(100, 100, 1)).toBe(1);
  });

  it("gera tamanhos CSS que fecham em pixels de dispositivo inteiros", () => {
    for (const dpr of [1, 1.25, 1.5, 2]) {
      const scale = pickScale(540, 540, dpr);
      const cssPerPixel = cssPerLogicalPixel(scale, dpr);
      expect(Number.isInteger(Math.round(BASE_WIDTH * cssPerPixel * dpr * 1e6) / 1e6)).toBe(true);
      expect(Math.round(BASE_HEIGHT * cssPerPixel * dpr)).toBe(BASE_HEIGHT * scale);
    }
  });
});
