import { describe, expect, it } from "vitest";
import { SWAP_FRAMES, seedOf, swapAt, swapDone, trackKey } from "../../src/renderer/screens/vinylSwap.js";

describe("swapAt", () => {
  it("levanta a agulha antes de mexer no disco", () => {
    expect(swapAt(0)).toMatchObject({ armUp: true, vinylOffset: 0, content: "old" });
    expect(swapAt(3)).toMatchObject({ armUp: true, vinylOffset: 0, content: "old" });
  });

  it("o disco velho sai pela esquerda até sumir do prato", () => {
    const offsets = Array.from({ length: 6 }, (_, index) => swapAt(4 + index).vinylOffset);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets).toEqual([...offsets].sort((a, b) => b - a));
    expect(offsets[5]).toBeLessThanOrEqual(-60);
    expect(swapAt(4).content).toBe("old");
  });

  it("o disco novo entra pela direita e assenta no centro", () => {
    expect(swapAt(10)).toMatchObject({ content: "new", vinylOffset: 66, armUp: true });
    expect(swapAt(15).vinylOffset).toBeGreaterThan(0);
    expect(swapAt(16)).toMatchObject({ vinylOffset: 0, armUp: false, ringHidden: false });
  });

  it("some o anel de progresso enquanto o prato está trocando", () => {
    expect(swapAt(6).ringHidden).toBe(true);
    expect(swapAt(12).ringHidden).toBe(true);
    expect(swapAt(2).ringHidden).toBe(false);
  });

  it("termina depois de 20 quadros", () => {
    expect(swapDone(SWAP_FRAMES - 1)).toBe(false);
    expect(swapDone(SWAP_FRAMES)).toBe(true);
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
