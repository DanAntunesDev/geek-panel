import { describe, expect, it } from "vitest";
import { validateConfig, DEFAULT_CONFIG } from "../../src/config/ConfigStore.js";
import { DEVICE_PALETTE } from "../../src/shared/deviceConstants.js";
import { configMessage } from "../../src/shared/deviceProtocol.js";
import { applyContrast, DEFAULT_THEME, PALETTE_SIZE, shadeOf, themePalette } from "../../src/shared/theme.js";

describe("tema", () => {
  it("a sombra do magenta padrão é a da paleta original", () => {
    expect(shadeOf("#E8368F")).toBe(DEVICE_PALETTE[5]);
  });

  it("troca só o destaque e a sombra", () => {
    const palette = themePalette({ ...DEFAULT_THEME, accent: "#3b7de0" });
    expect(palette.slice(0, 4)).toEqual([...DEVICE_PALETTE.slice(0, 4)]);
    expect(palette[4]).toBe("#3B7DE0");
    expect(palette).toHaveLength(PALETTE_SIZE);
  });

  it("a mensagem de configuração leva a paleta pedida", () => {
    const body = configMessage(themePalette({ ...DEFAULT_THEME, accent: "#3B7DE0" })).subarray(3);
    expect(body[3]).toBe(PALETTE_SIZE);
    expect(body.readUInt16BE(4 + 4 * 2)).toBe(((0x3b & 0xf8) << 8) | ((0x7d & 0xfc) << 3) | (0xe0 >> 3));
  });

  it("valida a cor da config", () => {
    expect(validateConfig({ theme: { accent: "#3b7de0" } }).theme.accent).toBe("#3B7DE0");
    expect(validateConfig({}).theme.accent).toBe(DEFAULT_CONFIG.theme.accent);
    expect(() => validateConfig({ theme: { accent: "azul" } })).toThrow(/cor de destaque/);
  });

  it("cores escolhidas entram na paleta, as outras viram o tom do texto", () => {
    const theme = { ...DEFAULT_THEME, tokens: ["#e8a317", null], clock: { ...DEFAULT_THEME.clock, hour: "#3b7de0" } };
    const palette = themePalette(theme);
    expect(palette[6]).toBe("#E8A317");
    expect(palette[7]).toBe(DEVICE_PALETTE[3]);
    expect(palette[8]).toBe("#3B7DE0");
  });

  it("valida e normaliza o tema inteiro", () => {
    const saved = validateConfig({ theme: { tokens: ["#e8a317"], clock: { hour: "#3b7de0", city: "" } } });
    expect(saved.theme.tokens).toEqual(["#E8A317", null]);
    expect(saved.theme.clock.hour).toBe("#3B7DE0");
    expect(saved.theme.clock.city).toBeNull();
    expect(() => validateConfig({ theme: { clock: { hour: "verde" } } })).toThrow(/cor inválida/);
  });

  it("contraste 50 não muda a cor; mais afasta do cinza médio e menos aproxima", () => {
    expect(applyContrast("#1C1C1C", 50)).toBe("#1C1C1C");
    expect(applyContrast("#F7F6F3", 50)).toBe("#F7F6F3");
    expect(applyContrast("#F7F6F3", 100)).toBe("#FFFFFF");
    expect(applyContrast("#1C1C1C", 100)).toBe("#000000");
    expect(applyContrast("#F7F6F3", 0)).toBe("#BCBBBA");
    expect(applyContrast("#808080", 0)).toBe("#808080");
  });

  it("valida o contraste da config", () => {
    expect(validateConfig({}).device.contrast).toBe(50);
    expect(validateConfig({ device: { contrast: 80 } }).device.contrast).toBe(80);
    expect(() => validateConfig({ device: { contrast: 101 } })).toThrow(/contraste/);
    expect(() => validateConfig({ device: { contrast: 1.5 } })).toThrow(/contraste/);
  });
});
