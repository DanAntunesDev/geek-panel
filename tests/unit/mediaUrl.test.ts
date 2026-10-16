import { describe, expect, it } from "vitest";
import { parseMediaUrl, resolveMediaUrl } from "../../src/main/mediaUrl.js";

describe("parseMediaUrl", () => {
  it("reconhece links do Spotify, inclusive com prefixo de idioma", () => {
    expect(parseMediaUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc")).toMatchObject({ service: "spotify", kind: "track", id: "4uLU6hMCjMI75M1A2tKUQC" });
    expect(parseMediaUrl("https://open.spotify.com/intl-pt/album/4uLU6hMCjMI75M1A2tKUQC")?.kind).toBe("album");
  });

  it("separa YouTube de YouTube Music e entende youtu.be e playlists", () => {
    expect(parseMediaUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ service: "youtubeMusic", kind: "video" });
    expect(parseMediaUrl("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ service: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseMediaUrl("https://www.youtube.com/playlist?list=PLabcdefghijklmnop")).toMatchObject({ kind: "playlist" });
  });

  it("rejeita http, hosts desconhecidos e IDs malformados", () => {
    expect(parseMediaUrl("http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeNull();
    expect(parseMediaUrl("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseMediaUrl("https://www.youtube.com/watch?v=curto")).toBeNull();
    expect(parseMediaUrl("não é link")).toBeNull();
  });

  it("reconstrói o endereço canônico a partir do ID", () => {
    expect(parseMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x&t=10")?.canonicalUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

describe("resolveMediaUrl", () => {
  it("devolve título e autor do oEmbed", async () => {
    let requested = "";
    const result = await resolveMediaUrl("https://youtu.be/dQw4w9WgXcQ", async (url) => {
      requested = url;
      return { status: 200, json: async () => ({ title: "Faixa", author_name: "Artista" }) };
    });
    expect(result).toMatchObject({ ok: true, title: "Faixa", author: "Artista" });
    expect(requested).toContain("youtube.com/oembed");
  });

  it("consulta o oEmbed do YouTube para links do YouTube Music", async () => {
    let requested = "";
    await resolveMediaUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ", async (url) => {
      requested = url;
      return { status: 200, json: async () => ({ title: "Faixa" }) };
    });
    expect(requested).toContain("www.youtube.com%2Fwatch");
  });

  it("classifica falhas", async () => {
    expect(await resolveMediaUrl("lixo")).toEqual({ ok: false, reason: "invalid-url" });
    expect(await resolveMediaUrl("https://youtu.be/dQw4w9WgXcQ", async () => ({ status: 404, json: async () => ({}) }))).toEqual({ ok: false, reason: "not-found" });
    expect(
      await resolveMediaUrl("https://youtu.be/dQw4w9WgXcQ", async () => {
        throw new Error("offline");
      }),
    ).toEqual({ ok: false, reason: "network" });
  });
});
