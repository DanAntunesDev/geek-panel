import { describe, expect, it } from "vitest";
import { appLabel, commandScript, parseSessions, toWindowsMedia } from "../../src/main/windowsMedia.js";
import { pickActivePlayer } from "../../src/main/systemMedia.js";

const session = { app: "Spotify.exe", status: 4, title: "Faixa", artist: "Banda", album: "Disco", position: 42, duration: 200, canNext: true, canPrevious: true, canPlay: true, canPause: true };

describe("parseSessions", () => {
  it("lê a lista e ignora o marcador invisível no começo", () => {
    expect(parseSessions(`\uFEFF${JSON.stringify([session])}`)).toEqual([session]);
  });

  it("aceita um objeto solto (o PowerShell tira a lista de um item só)", () => {
    expect(parseSessions(JSON.stringify(session))).toEqual([session]);
  });

  it("linha quebrada vira lista vazia", () => {
    expect(parseSessions("not json")).toEqual([]);
    expect(parseSessions("[]")).toEqual([]);
  });

  it("limpa campos com tipo errado", () => {
    const [clean] = parseSessions(JSON.stringify([{ app: 1, status: "x", title: null, position: -5, canNext: "sim" }]));
    expect(clean).toMatchObject({ app: "", status: 0, title: "", position: 0, canNext: false });
  });
});

describe("toWindowsMedia", () => {
  it("traduz o estado do Windows e deixa o volume de fora", () => {
    expect(toWindowsMedia(session)).toMatchObject({ status: "Playing", title: "Faixa", artist: "Banda", positionSeconds: 42, durationSeconds: 200, volume: null, canNext: true });
    expect(toWindowsMedia({ ...session, status: 5 }).status).toBe("Paused");
    expect(toWindowsMedia({ ...session, status: 0 }).status).toBe("Unknown");
  });

  it("escolhe quem está tocando antes de quem está pausado", () => {
    const paused = { ...session, app: "chrome.exe", status: 5 };
    const players = [paused, session].map((item) => ({ session: item, media: toWindowsMedia(item) }));
    expect(pickActivePlayer(players)?.session.app).toBe("Spotify.exe");
  });
});

describe("appLabel", () => {
  it("deixa um nome curto", () => {
    expect(appLabel("Spotify.exe")).toBe("Spotify");
    expect(appLabel("C:\\Program Files\\Firefox\\firefox.exe")).toBe("firefox");
    expect(appLabel("5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App")).toBe("5319275A.WhatsAppDesktop");
  });
});

describe("commandScript", () => {
  it("monta o comando de cada botão", () => {
    expect(commandScript("Spotify.exe", { type: "next" }, 0)).toContain("TrySkipNextAsync");
    expect(commandScript("Spotify.exe", { type: "playPause" }, 0)).toContain("TryTogglePlayPauseAsync");
    expect(commandScript("Spotify.exe", { type: "seekBy", seconds: 10 }, 30)).toContain("(40 * 10000000)");
    expect(commandScript("Spotify.exe", { type: "seekBy", seconds: -50 }, 30)).toContain("(0 * 10000000)");
  });

  it("volume não existe por aqui", () => {
    expect(commandScript("Spotify.exe", { type: "volume", level: 0.5 }, 0)).toBe("");
  });

  it("o id do app não consegue sair das aspas", () => {
    const script = commandScript("a'; Remove-Item x; '", { type: "next" }, 0);
    expect(script).toContain("-eq 'a''; Remove-Item x; '''");
    expect(commandScript("a\nb", { type: "next" }, 0)).toBe("");
    expect(commandScript("a\u2019b", { type: "next" }, 0)).toContain("a\u2019\u2019b");
  });
});
