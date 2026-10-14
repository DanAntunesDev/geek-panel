import * as http from "node:http";
import type { AddressInfo } from "node:net";

const PAGE = `<!doctype html><meta charset="utf-8"><title>player</title><div id="p"></div><script src="/player.js"></script>`;

const SCRIPT = `
const q = new URLSearchParams(location.search);
let player, ready = false, error = 0;
window.onYouTubeIframeAPIReady = () => {
  const vars = { autoplay: 1, controls: 0, disablekb: 1, rel: 0, playsinline: 1, origin: location.origin };
  const list = q.get("list");
  if (list) { vars.listType = "playlist"; vars.list = list; }
  player = new YT.Player("p", {
    width: 320, height: 180, videoId: q.get("v") || undefined, playerVars: vars,
    events: { onReady: (e) => { ready = true; e.target.playVideo(); }, onError: (e) => { error = e.data; } },
  });
};
const api = document.createElement("script");
api.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(api);
window.__yt = {
  state() {
    if (!ready) return { ready: false, error };
    const data = player.getVideoData() || {};
    const list = player.getPlaylist ? player.getPlaylist() : null;
    return { ready: true, error, status: player.getPlayerState(), position: player.getCurrentTime(),
      duration: player.getDuration(), title: data.title || "", author: data.author || "",
      index: player.getPlaylistIndex(), count: list ? list.length : 0 };
  },
  playPause() { player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); },
  seekTo(seconds) { player.seekTo(seconds, true); },
  next() { player.nextVideo(); },
  previous() {
    if (player.getPlaylistIndex() > 0 && player.getCurrentTime() < 3) player.previousVideo();
    else player.seekTo(0, true);
  },
};
`;

const CSP = [
  "default-src 'none'",
  "script-src 'self' https://www.youtube.com https://www.google.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "img-src https://i.ytimg.com data:",
  "style-src 'unsafe-inline'",
].join("; ");

export interface YouTubeHost {
  origin: string;
  close(): Promise<void>;
}

export async function startYouTubeHost(): Promise<YouTubeHost> {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const body = path === "/player.html" ? PAGE : path === "/player.js" ? SCRIPT : null;
    if (req.method !== "GET" || body === null) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": path === "/player.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
    });
    res.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
