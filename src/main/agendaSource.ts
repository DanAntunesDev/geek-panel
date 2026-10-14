import type { AgendaEvent, AgendaReminder, AgendaState, AppConfig } from "../shared/types.js";
import type { OAuthManager } from "./oauth.js";

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; json(): Promise<unknown> }>;

interface RawEvent {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  conferenceData?: { entryPoints?: { uri?: string }[] };
}

export function parseEvents(json: unknown): AgendaEvent[] {
  const items = (json as { items?: RawEvent[] })?.items ?? [];
  const events: AgendaEvent[] = [];
  for (const item of items) {
    if (!item.id || item.status === "cancelled") continue;
    // Convites que a pessoa recusou não aparecem.
    if (item.attendees?.some((attendee) => attendee.self && attendee.responseStatus === "declined")) continue;
    const start = item.start?.dateTime ?? item.start?.date;
    const end = item.end?.dateTime ?? item.end?.date;
    if (!start || !end) continue;
    events.push({
      id: item.id,
      title: (item.summary ?? "").trim() || "(sem título)",
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay: !item.start?.dateTime,
      location: item.location?.trim() || null,
      link: item.hangoutLink ?? item.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri ?? null,
    });
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

// Só o limiar mais urgente que já passou dispara; os anteriores contam como avisados.
export function dueReminders(events: AgendaEvent[], now: number, reminders: number[], fired: Set<string>): AgendaReminder[] {
  const thresholds = [...reminders, 0].sort((a, b) => b - a);
  const due: AgendaReminder[] = [];
  for (const event of events) {
    if (event.allDay) continue;
    const start = new Date(event.start).getTime();
    const remaining = start - now;
    // Passou 1 min do início: já não adianta avisar.
    if (remaining < -60_000) continue;
    const reached = thresholds.filter((minutes) => remaining <= minutes * 60_000);
    if (reached.length === 0) continue;
    const keys = reached.map((minutes) => `${event.id}|${event.start}|${minutes}`);
    const pending = keys.filter((key) => !fired.has(key));
    keys.forEach((key) => fired.add(key));
    if (pending.length === 0) continue;
    const minutes = reached[reached.length - 1];
    due.push({ eventId: event.id, title: event.title, start: event.start, minutes });
  }
  return due;
}

interface Options {
  oauth: OAuthManager;
  clientId: () => Promise<string>;
  config: () => Promise<AppConfig>;
  onState: (state: AgendaState) => void;
  onReminder: (reminder: AgendaReminder) => void;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  now?: () => number;
}

const REFRESH_MS = 60_000;
const REMINDER_CHECK_MS = 10_000;
const LOOKAHEAD_MS = 36 * 3600_000;

export class AgendaService {
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly fired = new Set<string>();
  private readonly timers: NodeJS.Timeout[] = [];
  private current: AgendaState = { connected: false, account: null, events: [], updatedAt: null, error: null };

  constructor(private readonly options: Options) {
    this.base = options.baseUrl ?? "https://www.googleapis.com/calendar/v3";
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    this.now = options.now ?? Date.now;
  }

  state(): AgendaState {
    return this.current;
  }

  start(): void {
    void this.refresh();
    this.timers.push(setInterval(() => void this.refresh(), REFRESH_MS));
    this.timers.push(setInterval(() => void this.checkReminders(), REMINDER_CHECK_MS));
  }

  stop(): void {
    this.timers.splice(0).forEach(clearInterval);
  }

  async refresh(): Promise<AgendaState> {
    const config = await this.options.config();
    const status = await this.options.oauth.status("calendar");
    if (!config.agenda.enabled || !status.connected) {
      return this.publish({ connected: status.connected, account: status.account, events: [], updatedAt: null, error: null });
    }
    try {
      const token = await this.options.oauth.accessToken("calendar", await this.options.clientId());
      if (!token) throw new Error("login expirado, conecte de novo");
      const now = this.now();
      const query = new URLSearchParams({
        timeMin: new Date(now).toISOString(),
        timeMax: new Date(now + LOOKAHEAD_MS).toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "25",
        fields: "items(id,summary,status,start,end,location,hangoutLink,attendees(self,responseStatus),conferenceData/entryPoints/uri)",
      });
      const response = await this.fetchImpl(`${this.base}/calendars/primary/events?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 403) throw new Error("a API do Google Agenda não está ativada no projeto");
      if (response.status < 200 || response.status >= 300) throw new Error(`o Google respondeu ${response.status}`);
      return this.publish({
        connected: true,
        account: status.account,
        events: parseEvents(await response.json()),
        updatedAt: new Date(now).toISOString(),
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha ao ler a agenda";
      return this.publish({ ...this.current, connected: true, account: status.account, error: message });
    }
  }

  async checkReminders(): Promise<void> {
    const config = await this.options.config();
    if (!config.agenda.enabled) return;
    for (const reminder of dueReminders(this.current.events, this.now(), config.agenda.reminders, this.fired)) {
      this.options.onReminder(reminder);
    }
  }

  private publish(state: AgendaState): AgendaState {
    this.current = state;
    this.options.onState(state);
    return state;
  }
}
