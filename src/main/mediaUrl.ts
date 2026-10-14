// Interpreta links de música, vídeo e playlist e busca título/autor pelo oEmbed
// público de cada serviço (sem login). Só hosts conhecidos são consultados e o
// endereço canônico é reconstruído a partir do ID, nunca reaproveitado do texto.

import type { MediaUrlResult, StreamingServiceId } from "../shared/types.js";

type Kind = Extract<MediaUrlResult, { ok: true }>["kind"];

export interface ParsedMediaUrl {
  service: StreamingServiceId;
  kind: Kind;
  id: string;
  canonicalUrl: string;
}

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const SPOTIFY_KINDS = new Set(["track", "album", "playlist", "episode", "show"]);

export function parseMediaUrl(raw: string): ParsedMediaUrl | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  if (url.hostname === "open.spotify.com") {
    // Aceita o prefixo de idioma (/intl-pt/track/ID).
    const parts = url.pathname.split("/").filter(Boolean).filter((part) => !part.startsWith("intl-"));
    const [kind, id] = parts;
    if (!kind || !id || !SPOTIFY_KINDS.has(kind) || !SPOTIFY_ID.test(id)) return null;
    return { service: "spotify", kind: kind as Kind, id, canonicalUrl: `https://open.spotify.com/${kind}/${id}` };
  }

  if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
  const service: StreamingServiceId = url.hostname === "music.youtube.com" ? "youtubeMusic" : "youtube";
  const origin = service === "youtubeMusic" ? "https://music.youtube.com" : "https://www.youtube.com";

  let videoId: string | null = null;
  if (url.hostname === "youtu.be") videoId = url.pathname.split("/")[1] ?? null;
  else if (url.pathname === "/watch") videoId = url.searchParams.get("v");
  else if (/^\/(shorts|live|embed)\//.test(url.pathname)) videoId = url.pathname.split("/")[2] ?? null;

  if (videoId && YOUTUBE_VIDEO_ID.test(videoId)) {
    return { service, kind: "video", id: videoId, canonicalUrl: `${origin}/watch?v=${videoId}` };
  }

  const list = url.pathname === "/playlist" ? url.searchParams.get("list") : null;
  if (list && YOUTUBE_LIST_ID.test(list)) {
    return { service, kind: "playlist", id: list, canonicalUrl: `${origin}/playlist?list=${list}` };
  }
  return null;
}

type JsonFetch = (url: string) => Promise<{ status: number; json(): Promise<unknown> }>;

function oembedEndpoint(parsed: ParsedMediaUrl): string {
  const encoded = encodeURIComponent(parsed.canonicalUrl);
  // Músicas do YouTube Music usam o mesmo oEmbed do YouTube.
  return parsed.service === "spotify"
    ? `https://open.spotify.com/oembed?url=${encoded}`
    : `https://www.youtube.com/oembed?url=${encoded.replace("music.youtube.com", "www.youtube.com")}&format=json`;
}

export async function resolveMediaUrl(raw: string, fetchImpl: JsonFetch = fetch as unknown as JsonFetch): Promise<MediaUrlResult> {
  const parsed = parseMediaUrl(raw);
  if (!parsed) return { ok: false, reason: "invalid-url" };

  try {
    const response = await fetchImpl(oembedEndpoint(parsed));
    if (response.status === 404 || response.status === 401 || response.status === 403) return { ok: false, reason: "not-found" };
    if (response.status < 200 || response.status >= 300) return { ok: false, reason: "network" };
    const body = (await response.json()) as { title?: unknown; author_name?: unknown };
    if (typeof body.title !== "string" || body.title === "") return { ok: false, reason: "not-found" };
    return {
      ok: true,
      service: parsed.service,
      kind: parsed.kind,
      id: parsed.id,
      title: body.title.slice(0, 200),
      author: typeof body.author_name === "string" ? body.author_name.slice(0, 120) : null,
      canonicalUrl: parsed.canonicalUrl,
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}
