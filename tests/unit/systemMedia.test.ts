import { describe, expect, it } from "vitest";
import { pickActivePlayer, toMediaState } from "../../src/main/systemMedia.js";

describe("toMediaState", () => {
  it("normaliza metadados MPRIS (artistas em lista, microssegundos, BigInt)", () => {
    const state = toMediaState({
      status: "Playing",
      metadata: { "xesam:title": "Faixa", "xesam:artist": ["A", "B"], "xesam:album": "Álbum", "mpris:length": 214_000_000n, "mpris:artUrl": "https://x/y.jpg" },
      positionMicros: 42_500_000,
    });
    expect(state).toMatchObject({ title: "Faixa", artist: "A, B", album: "Álbum", durationSeconds: 214, positionSeconds: 42, status: "Playing", artworkUrl: "https://x/y.jpg" });
  });

  it("tolera campos ausentes e status desconhecido", () => {
    const state = toMediaState({ status: "???" });
    expect(state).toMatchObject({ title: "", artist: "", durationSeconds: 0, status: "Unknown", artworkUrl: null });
  });
});

describe("pickActivePlayer", () => {
  const player = (name: string, status: "Playing" | "Paused" | "Stopped", title = "x") => ({ name, media: toMediaState({ status, metadata: { "xesam:title": title } }) });

  it("prefere quem toca, depois pausado com faixa, senão nada", () => {
    expect(pickActivePlayer([player("a", "Paused"), player("b", "Playing")])?.name).toBe("b");
    expect(pickActivePlayer([player("a", "Stopped"), player("b", "Paused")])?.name).toBe("b");
    expect(pickActivePlayer([player("a", "Stopped"), player("b", "Paused", "")])).toBeNull();
  });
});
