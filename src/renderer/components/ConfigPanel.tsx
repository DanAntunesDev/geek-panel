import { useEffect, useState } from "react";
import type { AppConfig, ClockStyle, ManualMode } from "../../shared/types.js";
import { AgendaModule } from "./config/AgendaModule.js";
import { DeviceModule } from "./config/DeviceModule.js";
import { MediaModule } from "./config/MediaModule.js";
import { ThemeModule } from "./config/ThemeModule.js";
import { ProvidersModule } from "./config/ProvidersModule.js";
import { Check, Divider, Field, Module, Segmented } from "./config/ui.js";

const ROTATION_MODES: { value: ManualMode; label: string }[] = [
  { value: "automatic", label: "AUTO" },
  { value: "player", label: "PLAYER" },
  { value: "usage", label: "TOKENS" },
  { value: "clock", label: "RELÓGIO" },
  { value: "agenda", label: "AGENDA" },
];

const CLOCK_STYLES: { value: ClockStyle; label: string }[] = [
  { value: "digital", label: "DIGITAL" },
  { value: "analog", label: "ANALÓGICO" },
  { value: "flip", label: "FLIP" },
];

type RotationKey = "playerSeconds" | "usageSeconds" | "clockSeconds" | "agendaSeconds";

const ROTATION_FIELDS: { key: RotationKey; label: string }[] = [
  { key: "playerSeconds", label: "Player (s)" },
  { key: "usageSeconds", label: "Tokens (s)" },
  { key: "clockSeconds", label: "Relógio (s)" },
  { key: "agendaSeconds", label: "Agenda (s)" },
];

export function ConfigPanel() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<{ address: string; port: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.painelApi.getConfig().then(setConfig);
    window.painelApi.getServerStatus().then(setStatus);
  }, []);

  if (!config) return <p className="cfg">Carregando configuração…</p>;

  const update = (next: AppConfig) => {
    setConfig(next);
    setSaved(false);
  };

  async function persist(next: AppConfig = config!) {
    setConfig(await window.painelApi.saveConfig(next));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await persist();
      setSaved(true);
    } catch (err) {
      setError((err instanceof Error ? err.message : "erro desconhecido").replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }

  return (
    <div className="cfg">
      <div className="cfg-inner">
        <Module title="DISPLAY REMOTO">
          <DeviceModule config={config} setConfig={update} persist={() => persist()} />
        </Module>

        <Divider />

        <Module title="APARÊNCIA">
          <ThemeModule config={config} setConfig={update} />
        </Module>

        <Divider />

        <Module title="SERVIDOR LOCAL">
          <Check checked={config.server.lanMode} onChange={(value) => update({ ...config, server: { ...config.server, lanMode: value } })}>
            Aceitar conexões de outros aparelhos da rede (modo LAN)
          </Check>
          {config.server.lanMode ? (
            <div className="cfg-row">
              <Field label="Interface de rede">
                <input
                  className="px-input"
                  value={config.server.lanInterface ?? ""}
                  onChange={(event) => update({ ...config, server: { ...config.server, lanInterface: event.target.value || null } })}
                />
              </Field>
            </div>
          ) : null}
          {status ? <p className="cfg-note">Ativo em {status.address}:{status.port}</p> : null}
        </Module>

        <Divider />

        <Module title="ROTAÇÃO DAS TELAS">
          <Segmented
            label="Modo"
            value={config.rotation.mode}
            options={ROTATION_MODES}
            onChange={(mode) => update({ ...config, rotation: { ...config.rotation, mode } })}
          />
          <h3 className="cfg-sub">TEMPO EM CADA TELA</h3>
          <div className="cfg-row">
            {ROTATION_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <input
                  className="px-input"
                  type="number"
                  value={config.rotation[field.key]}
                  onChange={(event) => update({ ...config, rotation: { ...config.rotation, [field.key]: Number(event.target.value) } })}
                />
              </Field>
            ))}
          </div>
        </Module>

        <Divider />

        <Module title="RELÓGIO">
          <Segmented
            label="Estilo"
            value={config.clock.style}
            options={CLOCK_STYLES}
            onChange={(style) => update({ ...config, clock: { ...config.clock, style } })}
          />
          <div className="cfg-row" style={{ marginTop: 12 }}>
            <Field label="Fuso horário">
              <input className="px-input" value={config.clock.timezone} onChange={(event) => update({ ...config, clock: { ...config.clock, timezone: event.target.value } })} />
            </Field>
          </div>
          <Check checked={config.clock.showDate} onChange={(value) => update({ ...config, clock: { ...config.clock, showDate: value } })}>
            Mostrar data e dia da semana
          </Check>
          <Check checked={config.clock.showSeconds} onChange={(value) => update({ ...config, clock: { ...config.clock, showSeconds: value } })}>
            Mostrar segundos
          </Check>
          <Check checked={config.clock.hour12} onChange={(value) => update({ ...config, clock: { ...config.clock, hour12: value } })}>
            Formato de 12 horas (AM/PM)
          </Check>
        </Module>

        <Divider />

        <Module title="AGENDA">
          <AgendaModule config={config} setConfig={update} persist={() => persist()} />
        </Module>

        <Divider />

        <Module title="MÚSICA E VÍDEO">
          <MediaModule config={config} setConfig={update} persist={() => persist()} />
        </Module>

        <Divider />

        <Module title="PROVEDORES DE TOKENS">
          <ProvidersModule config={config} setConfig={update} persist={persist} />
        </Module>

        <Divider />

        <button className="px-btn px-btn-primary" type="button" onClick={handleSave}>
          SALVAR CONFIGURAÇÃO
        </button>
        {saved ? <p className="cfg-note">OK: configuração salva.</p> : null}
        {error ? <p className="cfg-note">ERRO: {error}</p> : null}
      </div>
    </div>
  );
}
