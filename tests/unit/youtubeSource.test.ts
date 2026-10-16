import { describe, expect, it } from "vitest";
import { startYouTubeHost } from "../../src/main/youtubeHost.js";
import { YouTubePlayback, type YouTubePage } from "../../src/main/youtubeSource.js";

function fakePage(states: unknown[]) {
  const scripts: string[] = [];
  let loaded = "";
  const page: YouTubePage = {
    load: async (url) => {
      loaded = url;
    },
    run: async (script) => {
      scripts.push(script);
      return script.includes("state()") ? (states.length > 1 ? states.shift() : states[0]) : undefined;
    },
    destroy: () => undefined,
    alive: () => true,
  };
  return { page, scripts, loaded: () => loaded };
}

const playback = (page: YouTubePage) =>
  new YouTubePlayback({ origin: async () => "http://127.0.0.1:1", createPage: () => page, enabled: async () => true, settleMs: 600 });

describe("YouTubePlayback", () => {
  it("carrega o vídeo e converte o estado do player", async () => {
    const fake = fakePage([{ ready: true, error: 0, status: 1, position: 12.7, duration: 200, title: "Clipe", author: "Canal" }]);
    const youtube = playback(fake.page);
    await youtube.load({ kind: "video", id: "dQw4w9WgXcQ" });
    expect(fake.loaded()).toBe("http://127.0.0.1:1/player.html?v=dQw4w9WgXcQ");
    expect(await youtube.poll()).toMatchObject({ title: "Clipe", artist: "Canal", status: "Playing", positionSeconds: 12, durationSeconds: 200 });
  });

  it("usa list= para playlists", async () => {
    const fake = fakePage([{ ready: true, error: 0, status: 1, title: "A" }]);
    await playback(fake.page).load({ kind: "playlist", id: "PLabcdefghijkl" });
    expect(fake.loaded()).toContain("player.html?list=PLabcdefghijkl");
  });

  it("traduz o erro de incorporação bloqueada", async () => {
    const fake = fakePage([{ ready: false, error: 101 }]);
    await expect(playback(fake.page).load({ kind: "video", id: "dQw4w9WgXcQ" })).rejects.toThrow("não permite tocar fora");
  });

  it("dá erro de tempo quando o player nunca fica pronto", async () => {
    const fake = fakePage([{ ready: false, error: 0 }]);
    await expect(playback(fake.page).load({ kind: "video", id: "dQw4w9WgXcQ" })).rejects.toThrow("demorou");
  });

  it("converte comandos em chamadas do player", async () => {
    const fake = fakePage([{ ready: true, error: 0, status: 1, position: 50, title: "A" }]);
    const youtube = playback(fake.page);
    await youtube.load({ kind: "video", id: "dQw4w9WgXcQ" });
    await youtube.control({ type: "seekBy", seconds: -10 });
    await youtube.control({ type: "seekTo", seconds: 90 });
    await youtube.control({ type: "playPause" });
    expect(fake.scripts).toContain("window.__yt.seekTo(40)");
    expect(fake.scripts).toContain("window.__yt.seekTo(90)");
    expect(fake.scripts).toContain("window.__yt.playPause()");
  });
});

describe("startYouTubeHost", () => {
  it("serve a página e o script só em loopback, com CSP", async () => {
    const host = await startYouTubeHost();
    try {
      expect(host.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const page = await fetch(`${host.origin}/player.html?v=x`);
      expect(page.status).toBe(200);
      expect(page.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect((await fetch(`${host.origin}/player.js`)).status).toBe(200);
      expect((await fetch(`${host.origin}/outro`)).status).toBe(404);
    } finally {
      await host.close();
    }
  });
});
