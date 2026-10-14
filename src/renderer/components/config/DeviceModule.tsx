import { useState } from "react";
import type { AppConfig, DeviceCheck } from "../../../shared/types.js";
import { Chip, Field } from "./ui.js";

function bytes(value: number | null): string {
  return value === null ? "" : ` · ${(value / 1_048_576).toFixed(1)} MB livres`;
}

const FAILURES = {
  timeout: "SEM RESPOSTA",
  unreachable: "INACESSÍVEL",
  "not-geekmagic": "NÃO PARECE UMA GEEKMAGIC",
} as const;

export function DeviceModule({ config, setConfig, persist }: { config: AppConfig; setConfig: (next: AppConfig) => void; persist: () => Promise<void> }) {
  const [result, setResult] = useState<DeviceCheck | "testing" | null>(null);

  async function test() {
    setResult("testing");
    try {
      await persist();
      setResult(await window.painelApi.testDevice());
    } catch {
      setResult({ ok: false, reason: "unreachable" });
    }
  }

  return (
    <>
      <p className="cfg-note">Endereço IP do GeekMagic na sua rede (aparece na tela dele ao ligar, ou no painel do roteador).</p>
      <div className="cfg-row">
        <Field label="Endereço IP">
          <input
            className="px-input"
            value={config.device.host}
            spellCheck={false}
            placeholder="192.168.1.5"
            onChange={(event) => setConfig({ ...config, device: { ...config.device, host: event.target.value.trim() } })}
          />
        </Field>
        <Field label="Porta">
          <input
            className="px-input"
            type="number"
            value={config.device.port}
            onChange={(event) => setConfig({ ...config, device: { ...config.device, port: Number(event.target.value) } })}
          />
        </Field>
        <button className="px-btn px-btn-primary" type="button" disabled={result === "testing"} onClick={test}>
          {result === "testing" ? "TESTANDO…" : "TESTAR CONEXÃO"}
        </button>
      </div>
      {result && result !== "testing" ? (
        <p className="cfg-note">
          {result.ok ? (
            <Chip>
              CONECTADO: {result.model} {result.version}
              {bytes(result.freeBytes)}
            </Chip>
          ) : (
            <Chip tone="off">{FAILURES[result.reason]}</Chip>
          )}
        </p>
      ) : null}
    </>
  );
}
