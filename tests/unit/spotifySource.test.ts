import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OAuthManager } from "../../src/main/oauth.js";
import { SpotifyPlayback, toMedia } from "../../src/main/spotifySource.js";

describe("toMedia", () => {
  it("converte o estado de reprodução do Spotify", () => {
    const media = toMedia({
      is_playing: true,
      progress_ms: 42_900,
      item: { name: "Faixa", duration_ms: 214_000, artists: [{ name: "A" }, { name: "B" }], album: { name: "Disco", images: [{ url: "https://img/x.jpg" }] } },
    });
    expect(media).toMatchObject({ title: "Faixa", artist: "A, B", album: "Disco", status: "Playing", positionSeconds: 42, durationSeconds: 214, artworkUrl: "https://img/x.jpg" });
  });

  it("devolve null sem item e usa o nome do programa em podcasts", () => {
    expect(toMedia({ is_playing: true, item: null })).toBeNull();
    expect(toMedia({ item: { name: "Episódio", show: { name: "Programa" } } })?.artist).toBe("Programa");
  });
});

describe("SpotifyPlayback", () => {
  let server: http.Server;
  let base: string;
  let calls: { method: string; url: string; body: string }[];
  let reply: { status: number; body?: unknown };

  const oauth = { accessToken: async () => "token-x" } as unknown as OAuthManager;
  const playback = () => new SpotifyPlayback({ oauth, clientId: async () => "id", enabled: async () => true, baseUrl: base });

  beforeEach(async () => {
    calls = [];
    reply = { status: 204 };
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        calls.push({ method: req.method ?? "", url: req.url ?? "", body });
        res.writeHead(reply.status, { "Content-Type": "application/json" }).end(reply.body ? JSON.stringify(reply.body) : "");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  it("lê o estado e devolve null sem aparelho ativo", async () => {
    expect(await playback().poll()).toBeNull();
    reply = { status: 200, body: { is_playing: false, progress_ms: 5000, item: { name: "X", duration_ms: 60_000 } } };
    expect(await playback().poll()).toMatchObject({ title: "X", status: "Paused", positionSeconds: 5 });
  });

  it("alterna pausa e reprodução conforme o último estado", async () => {
    const spotify = playback();
    reply = { status: 200, body: { is_playing: true, item: { name: "X", duration_ms: 60_000 } } };
    await spotify.poll();
    reply = { status: 204 };
    await spotify.control({ type: "playPause" });
    expect(calls.at(-1)).toMatchObject({ method: "PUT", url: "/me/player/pause" });
  });

  it("pula faixas e mexe no progresso respeitando a duração", async () => {
    const spotify = playback();
    reply = { status: 200, body: { is_playing: true, progress_ms: 50_000, item: { name: "X", duration_ms: 60_000 } } };
    await spotify.poll();
    reply = { status: 204 };
    await spotify.control({ type: "next" });
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: "/me/player/next" });
    await spotify.control({ type: "seekBy", seconds: 30 });
    expect(calls.at(-1)?.url).toBe("/me/player/seek?position_ms=60000");
    await spotify.control({ type: "seekBy", seconds: -100 });
    expect(calls.at(-1)?.url).toBe("/me/player/seek?position_ms=0");
  });

  it("toca faixa por uris e álbum por context_uri", async () => {
    await playback().play("track", "4uLU6hMCjMI75M1A2tKUQC");
    expect(JSON.parse(calls.at(-1)!.body)).toEqual({ uris: ["spotify:track:4uLU6hMCjMI75M1A2tKUQC"] });
    await playback().play("album", "4uLU6hMCjMI75M1A2tKUQC");
    expect(JSON.parse(calls.at(-1)!.body)).toEqual({ context_uri: "spotify:album:4uLU6hMCjMI75M1A2tKUQC" });
  });

  it("explica os erros mais comuns", async () => {
    reply = { status: 404 };
    await expect(playback().control({ type: "next" })).rejects.toThrow("abra o Spotify");
    reply = { status: 403 };
    await expect(playback().control({ type: "next" })).rejects.toThrow("Premium");
  });
});
