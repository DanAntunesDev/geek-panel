import { describe, expect, it } from "vitest";
import { cleanTitle, pickActivePlayer, toMediaState } from "../../src/main/systemMedia.js";

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

  const withLength = (name: string, status: "Playing" | "Paused", title: string, length: bigint) => ({
    name,
    media: toMediaState({ status, metadata: { "xesam:title": title, "mpris:length": length } }),
  });

  it("prefere quem toca, depois pausado com mídia de verdade, senão nada", () => {
    expect(pickActivePlayer([player("a", "Paused"), player("b", "Playing")])?.name).toBe("b");
    expect(pickActivePlayer([player("a", "Stopped"), withLength("b", "Paused", "Faixa", 100_000_000n)])?.name).toBe("b");
    expect(pickActivePlayer([player("a", "Stopped"), player("b", "Paused", "")])).toBeNull();
  });

  it("ignora aba pausada sem duração nem artista (ex.: WhatsApp)", () => {
    const players = [withLength("zap", "Paused", "(3) WhatsApp", 0n), withLength("yt", "Paused", "Clipe - YouTube", 200_000_000n)];
    expect(pickActivePlayer(players)?.name).toBe("yt");
    expect(pickActivePlayer([players[0]])).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("tira contador de notificações e sufixo do site", () => {
    expect(cleanTitle("(6) Criolo : Tiny Desk Brasil - YouTube")).toBe("Criolo : Tiny Desk Brasil");
    expect(cleanTitle("Faixa - YouTube Music")).toBe("Faixa");
    expect(cleanTitle("Título normal")).toBe("Título normal");
  });
});
