import { describe, expect, it } from "vitest";
import { advanceSwap, SWAP_FRAMES, seedOf, swapAt, swapDone, trackKey } from "../../src/renderer/screens/vinylSwap.js";

describe("swapAt", () => {
  it("levanta a agulha antes de mexer no disco", () => {
    expect(swapAt(0)).toMatchObject({ armUp: true, vinylOffset: 0, content: "old" });
    expect(swapAt(5)).toMatchObject({ armUp: true, vinylOffset: 0, content: "old" });
  });

  it("o disco velho sai pela esquerda até sumir do prato", () => {
    const offsets = Array.from({ length: 5 }, (_, index) => swapAt(6 + index).vinylOffset);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets).toEqual([...offsets].sort((a, b) => b - a));
    expect(offsets[4]).toBeLessThanOrEqual(-60);
    expect(swapAt(6).content).toBe("old");
  });

  it("o disco novo entra pela direita e assenta no centro", () => {
    expect(swapAt(11)).toMatchObject({ content: "new", vinylOffset: 65, armUp: true });
    expect(swapAt(15).vinylOffset).toBeGreaterThan(0);
    expect(swapAt(16)).toMatchObject({ vinylOffset: 0, armUp: false, ringHidden: false });
  });

  it("some o anel de progresso enquanto o prato está trocando", () => {
    expect(swapAt(8).ringHidden).toBe(true);
    expect(swapAt(13).ringHidden).toBe(true);
    expect(swapAt(2).ringHidden).toBe(false);
  });

  it("termina depois de 16 quadros", () => {
    expect(swapDone(SWAP_FRAMES - 1)).toBe(false);
    expect(swapDone(SWAP_FRAMES)).toBe(true);
  });
});

describe("advanceSwap", () => {
  it("faixa nova começa a troca na hora", () => {
    const state = { start: -1, pending: true };
    advanceSwap(state, 40);
    expect(state).toEqual({ start: 40, pending: false });
  });

  it("outra faixa antes do disco velho sair usa a mesma troca", () => {
    const state = { start: 40, pending: true };
    advanceSwap(state, 44);
    expect(state).toEqual({ start: 40, pending: false });
  });

  it("outra faixa com o disco novo já entrando espera e ganha a própria troca completa", () => {
    const state = { start: 40, pending: true };
    advanceSwap(state, 52);
    expect(state).toEqual({ start: 40, pending: true });
    advanceSwap(state, 40 + SWAP_FRAMES);
    expect(state).toEqual({ start: 40 + SWAP_FRAMES, pending: false });
  });
});

describe("trackKey e seedOf", () => {
  it("sem título não há faixa", () => {
    expect(trackKey("", "x")).toBeNull();
    expect(trackKey("A", "B")).toBe("A|B");
  });

  it("o desenho do disco é estável por faixa e varia entre faixas", () => {
    expect(seedOf("Faixa", "Banda")).toBe(seedOf("Faixa", "Banda"));
    const seeds = new Set(["a", "b", "c", "d", "e", "f"].map((title) => seedOf(title, "x") % 12));
    expect(seeds.size).toBeGreaterThan(2);
  });
});
