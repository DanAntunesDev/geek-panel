import { describe, expect, it } from "vitest";
import { advanceSwap, newSwapState, requestSwap, SWAP_FRAMES, seedOf, swapAt, swapDone, trackArrived, trackKey } from "../../src/renderer/screens/vinylSwap.js";

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
    const state = { ...newSwapState(), pending: true };
    advanceSwap(state, 40);
    expect(state).toMatchObject({ start: 40, pending: false });
  });

  it("outra faixa antes do disco velho sair usa a mesma troca", () => {
    const state = { ...newSwapState(), start: 40, pending: true };
    advanceSwap(state, 44);
    expect(state).toMatchObject({ start: 40, pending: false });
  });

  it("outra faixa com o disco novo já entrando espera e ganha a própria troca completa", () => {
    const state = { ...newSwapState(), start: 40, pending: true };
    advanceSwap(state, 52);
    expect(state).toMatchObject({ start: 40, pending: true });
    advanceSwap(state, 40 + SWAP_FRAMES);
    expect(state).toMatchObject({ start: 40 + SWAP_FRAMES, pending: false });
  });
});

describe("clique em próxima", () => {
  it("troca na hora e segura o prato vazio até a música nova chegar", () => {
    const state = newSwapState();
    requestSwap(state);
    advanceSwap(state, 100);
    expect(state.start).toBe(100);
    for (let frame = 101; frame < 130; frame += 1) advanceSwap(state, frame);
    // sem música nova, a timeline fica parada no fim da saída do disco velho
    expect(swapAt(129 - state.start).content).toBe("old");
    expect(swapAt(129 - state.start).vinylOffset).toBeLessThanOrEqual(-60);

    trackArrived(state);
    expect(state).toMatchObject({ waiting: false, pending: false });
    advanceSwap(state, 130);
    advanceSwap(state, 131);
    expect(swapAt(131 - state.start).content).toBe("new");
  });

  it("a música nova que chega depois do clique não gera outra troca", () => {
    const state = newSwapState();
    requestSwap(state);
    advanceSwap(state, 10);
    trackArrived(state);
    expect(state.pending).toBe(false);
  });

  it("sem música nova (última faixa), desiste de esperar", () => {
    const state = newSwapState();
    requestSwap(state);
    for (let frame = 0; frame < 100; frame += 1) advanceSwap(state, frame);
    expect(state.waiting).toBe(false);
    expect(state.start === -1 || swapAt(99 - state.start).content === "new").toBe(true);
  });

  it("mudança de faixa que não veio de clique pede troca", () => {
    const state = newSwapState();
    trackArrived(state);
    expect(state.pending).toBe(true);
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
