import { useEffect, useState } from "react";
import type { AppConfig, DeviceCheck, DeviceLinkStatus } from "../../../shared/types.js";
import { Check, Chip, Field } from "./ui.js";

function newCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

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
  const [link, setLink] = useState<DeviceLinkStatus | null>(null);

  useEffect(() => {
    window.painelApi.getDeviceLink().then(setLink).catch(() => undefined);
    return window.painelApi.onDeviceLinkUpdate(setLink);
  }, []);

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
      <h3 className="cfg-sub">LIGAÇÃO AO VIVO</h3>
      <Check checked={config.device.autoConnect} onChange={(value) => setConfig({ ...config, device: { ...config.device, autoConnect: value } })}>
        Conectar ao aparelho sozinho assim que ele aparecer na rede
      </Check>
      <Check checked={config.app.startWithSystem} onChange={(value) => setConfig({ ...config, app: { ...config.app, startWithSystem: value } })}>
        Abrir o painel na bandeja quando o computador ligar
      </Check>
      <p className="cfg-note">
        {link?.connected ? (
          <Chip>APARELHO CONECTADO: {link.address}</Chip>
        ) : link?.rejected ? (
          <Chip tone="off">APARELHO RECUSADO, CÓDIGO ERRADO: {link.rejected}</Chip>
        ) : link?.error ? (
          <Chip tone="off">ERRO: {link.error}</Chip>
        ) : link?.running ? (
          <Chip tone="mid">AGUARDANDO O APARELHO</Chip>
        ) : (
          <Chip tone="off">LIGAÇÃO DESLIGADA</Chip>
        )}
      </p>
      <div className="cfg-row">
        <Field label="Código de pareamento (digite no aparelho)">
          <input
            className="px-input"
            value={config.device.pairingCode}
            spellCheck={false}
            maxLength={16}
            onChange={(event) => setConfig({ ...config, device: { ...config.device, pairingCode: event.target.value.replace(/[^0-9A-Za-z]/g, "") } })}
          />
        </Field>
        <button className="px-btn" type="button" onClick={() => setConfig({ ...config, device: { ...config.device, pairingCode: newCode() } })}>
          NOVO CÓDIGO
        </button>
      </div>
      <p className="cfg-note">Só o aparelho com este código recebe as telas. Vazio libera qualquer aparelho da rede.</p>
      <div className="cfg-row">
        <Field label="Brilho do aparelho (0 a 100)">
          <input
            className="px-input"
            type="number"
            min={0}
            max={100}
            value={config.device.brightness}
            onChange={(event) =>
              setConfig({ ...config, device: { ...config.device, brightness: Math.max(0, Math.min(100, Math.floor(Number(event.target.value) || 0))) } })
            }
          />
        </Field>
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
