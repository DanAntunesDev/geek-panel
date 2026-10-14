import { useEffect, useState } from "react";
import type { AgendaState, AppConfig, SecretStatus } from "../../../shared/types.js";
import { CALENDAR_SECRET } from "../../../shared/providers.js";
import { AuthControls, describeError, NoticeLine, useAuth, type Notice } from "./auth.js";
import { notify } from "./toast.js";
import { Check, Field } from "./ui.js";

const REMINDER_CHOICES = [30, 15, 10, 5, 2, 1];

export function AgendaModule({ config, setConfig, persist }: { config: AppConfig; setConfig: (next: AppConfig) => void; persist: () => Promise<void> }) {
  const auth = useAuth("calendar", persist);
  const [secret, setSecret] = useState<SecretStatus>({ configured: false, hint: null });
  const [agenda, setAgenda] = useState<AgendaState | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [secretNotice, setSecretNotice] = useState<Notice>(null);

  useEffect(() => {
    window.painelApi.getSecretStatus(CALENDAR_SECRET).then(setSecret).catch(() => undefined);
    window.painelApi.getAgenda().then(setAgenda).catch(() => undefined);
    return window.painelApi.onAgendaUpdate(setAgenda);
  }, []);

  async function saveSecret() {
    if (secretInput.trim() === "") return notify("err", "digite o segredo antes de guardar");
    try {
      await window.painelApi.setSecret(CALENDAR_SECRET, secretInput);
      setSecret(await window.painelApi.getSecretStatus(CALENDAR_SECRET));
      setSecretInput("");
      setSecretNotice({ tone: "ok", text: "segredo da agenda guardado no cofre do sistema" });
      notify("ok", "segredo da agenda guardado no cofre do sistema");
    } catch (error) {
      setSecretNotice({ tone: "err", text: describeError(error) });
      notify("err", describeError(error));
    }
  }

  async function clearSecret() {
    try {
      await window.painelApi.clearSecret(CALENDAR_SECRET);
      setSecret({ configured: false, hint: null });
      notify("ok", "segredo da agenda removido");
    } catch (error) {
      notify("err", describeError(error));
    }
  }

  const setAgendaConfig = (patch: Partial<AppConfig["agenda"]>) => setConfig({ ...config, agenda: { ...config.agenda, ...patch } });

  function toggleReminder(minutes: number, on: boolean) {
    const next = on ? [...config.agenda.reminders, minutes] : config.agenda.reminders.filter((item) => item !== minutes);
    setAgendaConfig({ reminders: next.sort((a, b) => b - a).slice(0, 4) });
  }

  let status = "";
  if (agenda?.connected && config.agenda.enabled) {
    status = agenda.error ? `Problema ao ler: ${agenda.error}` : `${agenda.events.length} evento(s) nas próximas 36 horas.`;
  }

  return (
    <>
      <p className="cfg-note">A agenda tem o próprio aplicativo Google, separado do YouTube: você pode usar um e-mail aqui e outro na música.</p>
      <div className="cfg-service">
        <AuthControls
          auth={auth}
          ready={config.agenda.googleClientId.trim() !== "" && secret.configured}
          readyHint="Informe o ID e guarde o segredo do aplicativo Google desta agenda (campos abaixo) e ative a API do Google Agenda."
        />
        <div className="cfg-row">
          <Field label="ID do aplicativo Google (Client ID)">
            <input className="px-input" value={config.agenda.googleClientId} spellCheck={false} onChange={(event) => setAgendaConfig({ googleClientId: event.target.value })} />
          </Field>
        </div>
        <div className="cfg-row">
          <Field label={secret.configured ? `Segredo do aplicativo (guardado ${secret.hint ?? ""})` : "Segredo do aplicativo (Client Secret)"}>
            <input
              className="px-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={secretInput}
              placeholder={secret.configured ? "digite para substituir" : ""}
              onChange={(event) => setSecretInput(event.target.value)}
            />
          </Field>
          <button className="px-btn" type="button" onClick={saveSecret}>
            GUARDAR
          </button>
          {secret.configured ? (
            <button className="px-btn" type="button" onClick={clearSecret}>
              REMOVER
            </button>
          ) : null}
        </div>
        <NoticeLine notice={secretNotice} />
        <Check checked={config.agenda.enabled} onChange={(value) => setAgendaConfig({ enabled: value })}>
          Mostrar a agenda no painel
        </Check>
        {status ? <NoticeLine notice={{ tone: agenda?.error ? "err" : "ok", text: status }} /> : null}
      </div>

      <h3 className="cfg-sub">LEMBRETES ANTES DO INÍCIO</h3>
      {REMINDER_CHOICES.map((minutes) => (
        <Check
          key={minutes}
          checked={config.agenda.reminders.includes(minutes)}
          onChange={(on) => toggleReminder(minutes, on)}
        >
          {minutes} min antes
        </Check>
      ))}
      <p className="cfg-note">O painel também avisa na hora em que o evento começa. No máximo 4 lembretes.</p>
      <Check checked={config.agenda.notify} onChange={(value) => setAgendaConfig({ notify: value })}>
        Avisar também com notificação do computador
      </Check>
    </>
  );
}
