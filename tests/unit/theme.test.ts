import { describe, expect, it } from "vitest";
import { validateConfig, DEFAULT_CONFIG } from "../../src/config/ConfigStore.js";
import { DEVICE_PALETTE } from "../../src/shared/deviceConstants.js";
import { configMessage } from "../../src/shared/deviceProtocol.js";
import { shadeOf, themePalette } from "../../src/shared/theme.js";

describe("tema", () => {
  it("a sombra do magenta padrão é a da paleta original", () => {
    expect(shadeOf("#E8368F")).toBe(DEVICE_PALETTE[5]);
  });

  it("troca só o destaque e a sombra", () => {
    const palette = themePalette("#3b7de0");
    expect(palette.slice(0, 4)).toEqual([...DEVICE_PALETTE.slice(0, 4)]);
    expect(palette[4]).toBe("#3B7DE0");
    expect(palette).toHaveLength(DEVICE_PALETTE.length);
  });

  it("a mensagem de configuração leva a paleta pedida", () => {
    const body = configMessage(themePalette("#3B7DE0")).subarray(3);
    expect(body[3]).toBe(6);
    expect(body.readUInt16BE(4 + 4 * 2)).toBe(((0x3b & 0xf8) << 8) | ((0x7d & 0xfc) << 3) | (0xe0 >> 3));
  });

  it("valida a cor da config", () => {
    expect(validateConfig({ theme: { accent: "#3b7de0" } }).theme.accent).toBe("#3B7DE0");
    expect(validateConfig({}).theme.accent).toBe(DEFAULT_CONFIG.theme.accent);
    expect(() => validateConfig({ theme: { accent: "azul" } })).toThrow(/cor de destaque/);
  });
});
