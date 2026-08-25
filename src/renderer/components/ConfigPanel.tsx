import { useEffect, useState } from "react";
import type { AppConfig } from "../../shared/types.js";

// Editor visual da configuração (seção 11 da spec). Campos de host/porta
// são realmente editáveis e validados pelo processo principal ao salvar.
export function ConfigPanel() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<{ address: string; port: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.painelApi.getConfig().then(setConfig);
    window.painelApi.getServerStatus().then(setStatus);
  }, []);

  if (!config) {
    return <p style={{ padding: 16 }}>Carregando configuração…</p>;
  }

  async function handleSave() {
    if (!config) return;
    setError(null);
    setSaved(false);
    try {
      const result = await window.painelApi.saveConfig(config);
      setConfig(result);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro desconhecido");
    }
  }

  return (
    <section style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: 14, margin: 0 }}>Configuração</h2>

      <label>
        Host do display
        <input
          value={config.device.host}
          onChange={(event) => setConfig({ ...config, device: { ...config.device, host: event.target.value } })}
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Porta do display
        <input
          type="number"
          value={config.device.port}
          onChange={(event) =>
            setConfig({ ...config, device: { ...config.device, port: Number(event.target.value) } })
          }
          style={{ width: "100%" }}
        />
      </label>

      <fieldset>
        <legend>Rotação (segundos)</legend>
        <label>
          Player
          <input
            type="number"
            value={config.rotation.playerSeconds}
            onChange={(event) =>
              setConfig({ ...config, rotation: { ...config.rotation, playerSeconds: Number(event.target.value) } })
            }
          />
        </label>
        <label>
          Uso
          <input
            type="number"
            value={config.rotation.usageSeconds}
            onChange={(event) =>
              setConfig({ ...config, rotation: { ...config.rotation, usageSeconds: Number(event.target.value) } })
            }
          />
        </label>
        <label>
          Relógio
          <input
            type="number"
            value={config.rotation.clockSeconds}
            onChange={(event) =>
              setConfig({ ...config, rotation: { ...config.rotation, clockSeconds: Number(event.target.value) } })
            }
          />
        </label>
      </fieldset>

      <label>
        Fuso horário
        <input
          value={config.clock.timezone}
          onChange={(event) => setConfig({ ...config, clock: { ...config.clock, timezone: event.target.value } })}
          style={{ width: "100%" }}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={config.server.lanMode}
          onChange={(event) => setConfig({ ...config, server: { ...config.server, lanMode: event.target.checked } })}
        />
        Habilitar modo LAN (o servidor fica acessível a outros dispositivos da rede)
      </label>

      {config.server.lanMode ? (
        <label>
          Interface de rede
          <input
            value={config.server.lanInterface ?? ""}
            onChange={(event) =>
              setConfig({ ...config, server: { ...config.server, lanInterface: event.target.value || null } })
            }
            style={{ width: "100%" }}
          />
        </label>
      ) : null}

      <button onClick={handleSave}>Salvar</button>
      {saved ? <p style={{ color: "green", fontSize: 12 }}>Configuração salva.</p> : null}
      {error ? <p style={{ color: "crimson", fontSize: 12 }}>{error}</p> : null}

      {status ? (
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Servidor local ativo em {status.address}:{status.port}
        </p>
      ) : null}
    </section>
  );
}
