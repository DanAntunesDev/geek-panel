// Comandos do app para o firmware do painel: enviar o código e apagar tudo.

export type DeviceAdminResult = { ok: boolean; status: number; host: string; message: string };

type FetchLike = (url: string, init: { method: string; body: string; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number }>;

const MESSAGES: Record<number, string> = {
  401: "o aparelho já tem outro código; abra a página dele e use \"Apagar tudo e recomeçar\"",
  404: "esse aparelho não tem o firmware do painel",
};

export async function callDevice(
  host: string,
  path: "/pair" | "/reset" | "/display",
  form: Record<string, string>,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 5000,
): Promise<DeviceAdminResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`http://${host}${path}`, {
      method: "POST",
      body: new URLSearchParams(form).toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    const ok = response.status >= 200 && response.status < 300;
    return { ok, status: response.status, host, message: ok ? "feito" : (MESSAGES[response.status] ?? `o aparelho respondeu ${response.status}`) };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "AbortError";
    return { ok: false, status: 0, host, message: timeout ? "o aparelho não respondeu a tempo" : "não consegui falar com o aparelho" };
  } finally {
    clearTimeout(timer);
  }
}
