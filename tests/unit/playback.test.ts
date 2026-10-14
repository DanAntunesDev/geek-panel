import { describe, expect, it } from "vitest";
import { PlaybackManager, pickActive, type PlaybackSource } from "../../src/main/playback.js";
import type { MediaState, PlaybackSourceId, PlayerCommand } from "../../src/shared/types.js";

const media = (status: MediaState["status"], title = "Faixa"): MediaState => ({
  source: "desktop-player",
  title,
  artist: "",
  album: "",
  artworkUrl: null,
  status,
  positionSeconds: 0,
  durationSeconds: 100,
  canPlay: true,
  canPause: true,
  canNext: true,
  canPrevious: true,
  updatedAt: "",
});

function fakeSource(id: PlaybackSourceId, current: MediaState | null) {
  const commands: PlayerCommand[] = [];
  const source: PlaybackSource = {
    id,
    label: id,
    intervalMs: 60_000,
    enabled: async () => true,
    poll: async () => current,
    control: async (command) => {
      commands.push(command);
    },
  };
  return { source, commands };
}

describe("pickActive", () => {
  const order: PlaybackSourceId[] = ["youtube", "spotify", "system"];

  it("prefere quem toca e respeita a ordem no empate", () => {
    const latest = new Map<PlaybackSourceId, MediaState | null>([
      ["system", media("Playing")],
      ["spotify", media("Playing")],
    ]);
    expect(pickActive(order, latest, null)).toBe("spotify");
  });

  it("não troca de fonte enquanto a atual continua tocando", () => {
    const latest = new Map<PlaybackSourceId, MediaState | null>([
      ["youtube", media("Playing")],
      ["system", media("Playing")],
    ]);
    expect(pickActive(order, latest, "system")).toBe("system");
  });

  it("cai para pausado com faixa e ignora pausado vazio", () => {
    expect(pickActive(order, new Map([["system", media("Paused")]]), null)).toBe("system");
    expect(pickActive(order, new Map([["system", media("Paused", "")]]), null)).toBeNull();
  });
});

describe("PlaybackManager", () => {
  it("manda o comando para a fonte ativa", async () => {
    const spotify = fakeSource("spotify", media("Playing"));
    const system = fakeSource("system", media("Paused"));
    const manager = new PlaybackManager([spotify.source, system.source], () => undefined);
    await manager.pollSource(spotify.source);
    await manager.pollSource(system.source);
    await manager.control({ type: "next" });
    expect(spotify.commands).toEqual([{ type: "next" }]);
    expect(system.commands).toEqual([]);
  });

  it("avisa só quando o estado muda", async () => {
    const system = fakeSource("system", media("Playing"));
    const seen: string[] = [];
    const manager = new PlaybackManager([system.source], (state) => seen.push(state.source ?? "nada"));
    await manager.pollSource(system.source);
    await manager.pollSource(system.source);
    expect(seen).toEqual(["system"]);
  });

  it("pausa quem toca ao dar a vez a outra fonte", async () => {
    const system = fakeSource("system", media("Playing"));
    const youtube = fakeSource("youtube", null);
    const manager = new PlaybackManager([youtube.source, system.source], () => undefined);
    await manager.pollSource(system.source);
    await manager.takeOver("youtube");
    expect(system.commands).toEqual([{ type: "playPause" }]);
  });

  it("recusa controlar quando nada toca", async () => {
    const manager = new PlaybackManager([fakeSource("system", null).source], () => undefined);
    await expect(manager.control({ type: "playPause" })).rejects.toThrow("nada tocando");
  });
});
