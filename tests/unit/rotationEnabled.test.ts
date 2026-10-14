import { describe, expect, it } from "vitest";
import { validateConfig } from "../../src/config/ConfigStore.js";

describe("telas no rodízio", () => {
  it("vêm todas ligadas por padrão", () => {
    expect(validateConfig({}).rotation.enabled).toEqual({ player: true, usage: true, clock: true, agenda: true });
  });

  it("aceita desligar algumas", () => {
    expect(validateConfig({ rotation: { enabled: { usage: false } } }).rotation.enabled.usage).toBe(false);
  });

  it("não deixa desligar todas", () => {
    const off = { player: false, usage: false, clock: false, agenda: false };
    expect(() => validateConfig({ rotation: { enabled: off } })).toThrow(/pelo menos uma tela/);
  });
});
