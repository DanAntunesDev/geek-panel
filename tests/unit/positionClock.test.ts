import { describe, expect, it } from "vitest";
import { anchorPosition } from "../../src/renderer/screens/positionClock.js";

const base = { local: 42, lastReported: 40, reported: 41, duration: 200, playing: true, newTrack: false };

describe("anchorPosition", () => {
  it("segue a leitura quando ela avança", () => {
    expect(anchorPosition(base)).toBe(41);
  });

  it("mantém o relógio local quando a fonte repete a posição", () => {
    expect(anchorPosition({ ...base, lastReported: 0, reported: 0, local: 17 })).toBe(17);
  });

  it("aceita a posição repetida se estiver pausado", () => {
    expect(anchorPosition({ ...base, playing: false, lastReported: 41, local: 55 })).toBe(41);
  });

  it("começa a faixa nova na posição lida", () => {
    expect(anchorPosition({ ...base, newTrack: true, local: 180, reported: 3 })).toBe(3);
  });

  it("zera se a faixa nova vier com posição da antiga", () => {
    expect(anchorPosition({ ...base, newTrack: true, reported: 300 })).toBe(0);
  });
});
