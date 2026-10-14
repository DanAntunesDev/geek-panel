import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgendaService, dueReminders, parseEvents } from "../../src/main/agendaSource.js";
import type { OAuthManager } from "../../src/main/oauth.js";
import { DEFAULT_CONFIG } from "../../src/config/ConfigStore.js";
import type { AgendaEvent, AgendaReminder, AgendaState } from "../../src/shared/types.js";

const event = (id: string, startMinutes: number, base: number): AgendaEvent => ({
  id,
  title: `Reunião ${id}`,
  start: new Date(base + startMinutes * 60_000).toISOString(),
  end: new Date(base + (startMinutes + 30) * 60_000).toISOString(),
  allDay: false,
  location: null,
  link: null,
});

describe("parseEvents", () => {
  it("lê eventos do Google, ignora cancelados e recusados, e ordena", () => {
    const events = parseEvents({
      items: [
        { id: "b", summary: "Depois", start: { dateTime: "2026-10-14T15:00:00-03:00" }, end: { dateTime: "2026-10-14T16:00:00-03:00" }, hangoutLink: "https://meet.google.com/x" },
        { id: "a", summary: "Antes", start: { dateTime: "2026-10-14T09:00:00-03:00" }, end: { dateTime: "2026-10-14T09:30:00-03:00" }, location: " Sala 2 " },
        { id: "c", status: "cancelled", summary: "Cancelada", start: { dateTime: "2026-10-14T10:00:00-03:00" }, end: { dateTime: "2026-10-14T11:00:00-03:00" } },
        { id: "d", summary: "Recusei", attendees: [{ self: true, responseStatus: "declined" }], start: { dateTime: "2026-10-14T11:00:00-03:00" }, end: { dateTime: "2026-10-14T12:00:00-03:00" } },
        { id: "e", start: { date: "2026-10-15" }, end: { date: "2026-10-16" } },
      ],
    });
    expect(events.map((item) => item.id)).toEqual(["a", "b", "e"]);
    expect(events[0].location).toBe("Sala 2");
    expect(events[1].link).toBe("https://meet.google.com/x");
    expect(events[2]).toMatchObject({ title: "(sem título)", allDay: true });
  });

  it("tolera resposta vazia ou estranha", () => {
    expect(parseEvents({})).toEqual([]);
    expect(parseEvents(null)).toEqual([]);
  });
});

describe("dueReminders", () => {
  const base = Date.UTC(2026, 9, 14, 12, 0, 0);

  it("dispara 10 min, 5 min e na hora, uma vez cada", () => {
    const events = [event("x", 30, base)];
    const fired = new Set<string>();
    const at = (minutes: number) => dueReminders(events, base + minutes * 60_000, [10, 5], fired).map((item) => item.minutes);
    expect(at(0)).toEqual([]);
    expect(at(19)).toEqual([]);
    expect(at(20)).toEqual([10]);
    expect(at(21)).toEqual([]);
    expect(at(25)).toEqual([5]);
    expect(at(30)).toEqual([0]);
    expect(at(30.5)).toEqual([]);
  });

  it("ao abrir o app em cima da hora avisa só o mais urgente", () => {
    const events = [event("x", 3, base)];
    expect(dueReminders(events, base, [10, 5], new Set()).map((item) => item.minutes)).toEqual([5]);
  });

  it("ignora eventos de dia inteiro e os que já começaram há mais de 1 min", () => {
    const allDay = { ...event("d", 5, base), allDay: true };
    const started = event("s", -5, base);
    expect(dueReminders([allDay, started], base, [10, 5], new Set())).toEqual([]);
  });
});

describe("AgendaService", () => {
  let server: http.Server;
  let base: string;
  let requested: string[];
  let reply: { status: number; body: unknown };

  const config = { ...DEFAULT_CONFIG, agenda: { enabled: true, reminders: [10, 5], notify: true, googleClientId: "id" } };
  const connectedOauth = {
    status: async () => ({ connected: true, account: "eu@exemplo.com" }),
    accessToken: async () => "token-x",
  } as unknown as OAuthManager;

  beforeEach(async () => {
    requested = [];
    reply = { status: 200, body: { items: [] } };
    server = http.createServer((req, res) => {
      requested.push(`${req.url} | ${req.headers.authorization}`);
      res.writeHead(reply.status, { "Content-Type": "application/json" }).end(JSON.stringify(reply.body));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  function service(oauth = connectedOauth, cfg = config) {
    const states: AgendaState[] = [];
    const reminders: AgendaReminder[] = [];
    const agenda = new AgendaService({
      oauth,
      clientId: async () => "id",
      config: async () => cfg,
      onState: (state) => states.push(state),
      onReminder: (reminder) => reminders.push(reminder),
      baseUrl: base,
    });
    return { agenda, states, reminders };
  }

  it("busca os próximos eventos com o token e publica o estado", async () => {
    reply = { status: 200, body: { items: [{ id: "a", summary: "Daily", start: { dateTime: "2099-01-01T10:00:00Z" }, end: { dateTime: "2099-01-01T10:15:00Z" } }] } };
    const { agenda } = service();
    const state = await agenda.refresh();
    expect(state).toMatchObject({ connected: true, account: "eu@exemplo.com", error: null });
    expect(state.events.map((item) => item.title)).toEqual(["Daily"]);
    expect(requested[0]).toContain("/calendars/primary/events?");
    expect(requested[0]).toContain("singleEvents=true");
    expect(requested[0]).toContain("Bearer token-x");
  });

  it("não consulta nada com a agenda desligada ou sem login", async () => {
    await service(connectedOauth, { ...config, agenda: { ...config.agenda, enabled: false } }).agenda.refresh();
    const offline = { status: async () => ({ connected: false, account: null }) } as unknown as OAuthManager;
    const state = await service(offline).agenda.refresh();
    expect(state.connected).toBe(false);
    expect(requested).toEqual([]);
  });

  it("explica o erro 403 e mantém os eventos anteriores", async () => {
    reply = { status: 200, body: { items: [{ id: "a", summary: "Daily", start: { dateTime: "2099-01-01T10:00:00Z" }, end: { dateTime: "2099-01-01T10:15:00Z" } }] } };
    const { agenda } = service();
    await agenda.refresh();
    reply = { status: 403, body: {} };
    const state = await agenda.refresh();
    expect(state.error).toContain("não está ativada");
    expect(state.events).toHaveLength(1);
  });
});
