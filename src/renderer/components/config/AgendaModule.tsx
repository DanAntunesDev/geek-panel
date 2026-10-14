import { useEffect, useState } from "react";
import type { AgendaState, AppConfig, SecretStatus } from "../../../shared/types.js";
import { AuthControls, NoticeLine, useAuth } from "./auth.js";
import { Check } from "./ui.js";

const REMINDER_CHOICES = [30, 15, 10, 5, 2, 1];

export function AgendaModule({ config, setConfig, persist }: { config: AppConfig; setConfig: (next: AppConfig) => void; persist: () => Promise<void> }) {
  const auth = useAuth("calendar", persist);
  const [secret, setSecret] = useState<SecretStatus>({ configured: false, hint: null });
  const [agenda, setAgenda] = useState<AgendaState | null>(null);

  useEffect(() => {
    window.painelApi.getSecretStatus("google:clientSecret").then(setSecret).catch(() => undefined);
    window.painelApi.getAgenda().then(setAgenda).catch(() => undefined);
    return window.painelApi.onAgendaUpdate(setAgenda);
  }, []);

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
      <p className="cfg-note">Escolha a conta do Google no navegador que abrir; pode ser outra diferente da usada no YouTube.</p>
      <div className="cfg-service">
        <AuthControls
          auth={auth}
          ready={config.media.googleClientId.trim() !== "" && secret.configured}
          readyHint="Informe e guarde o ID e o segredo do aplicativo Google (em Música e vídeo) e ative a API do Google Agenda."
        />
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
