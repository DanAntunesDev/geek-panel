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

describe("som do lembrete", () => {
  it("vem ligado, com o som pixel", () => {
    expect(validateConfig({}).agenda.sound).toEqual({ enabled: true, id: "pixel", volume: 70, deviceId: "" });
  });

  it("aceita trocar som, volume e saída", () => {
    const sound = validateConfig({ agenda: { sound: { id: "bell", volume: 30, deviceId: "abc" } } }).agenda.sound;
    expect(sound).toMatchObject({ id: "bell", volume: 30, deviceId: "abc" });
  });

  it("recusa som que não existe e volume fora da faixa", () => {
    expect(() => validateConfig({ agenda: { sound: { id: "outro" } } })).toThrow(/som do lembrete/);
    expect(() => validateConfig({ agenda: { sound: { volume: 150 } } })).toThrow(/som do lembrete/);
  });
});
