import { useEffect, useRef, useState } from "react";
import type { AppConfig, DeviceCheck, DeviceLinkStatus } from "../../../shared/types.js";
import { describeError } from "./auth.js";
import { notify } from "./toast.js";
import { Check, Chip, Field, NumberField, Slider } from "./ui.js";

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
  const [busy, setBusy] = useState<"pair" | "reset" | null>(null);
  const [link, setLink] = useState<DeviceLinkStatus | null>(null);

  useEffect(() => {
    window.painelApi.getDeviceLink().then(setLink).catch(() => undefined);
    return window.painelApi.onDeviceLinkUpdate(setLink);
  }, []);

  // sliders valem na hora: salva só brilho e contraste e manda para o aparelho, sem esperar o botão de salvar
  const [display, setDisplay] = useState<string | null>(null);
  const displayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function changeDisplay(patch: Partial<Pick<AppConfig["device"], "brightness" | "contrast">>) {
    const next = { ...config.device, ...patch };
    setConfig({ ...config, device: next });
    if (displayTimer.current) clearTimeout(displayTimer.current);
    displayTimer.current = setTimeout(async () => {
      try {
        const result = await window.painelApi.applyDisplay(next.brightness, next.contrast);
        setDisplay(result.ok ? `Aplicado no aparelho (HTTP ${result.status}).` : `Salvo, mas o aparelho não recebeu: ${result.message}.`);
      } catch (error) {
        setDisplay(`Não consegui aplicar: ${describeError(error)}`);
      }
    }, 250);
  }

  async function sendCode() {
    setBusy("pair");
    try {
      await persist();
      const result = await window.painelApi.pairDevice();
      if (result.ok) notify("ok", `HTTP ${result.status}: código enviado para ${result.host}; ele reconecta em instantes`);
      else notify("err", `${result.status ? `HTTP ${result.status}: ` : ""}${result.message} (${result.host})`);
    } catch (error) {
      notify("err", describeError(error));
    } finally {
      setBusy(null);
    }
  }

  async function wipe() {
    if (!window.confirm("Apagar o Wi-Fi e o código guardados no aparelho? Ele volta a abrir a rede GeekPanel para configurar de novo.")) return;
    setBusy("reset");
    try {
      const result = await window.painelApi.resetDevice();
      if (result.ok) notify("ok", `HTTP ${result.status}: aparelho apagado; procure a rede GeekPanel no celular`);
      else notify("err", `${result.status ? `HTTP ${result.status}: ` : ""}${result.message} (${result.host})`);
    } catch (error) {
      notify("err", describeError(error));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setResult("testing");
    try {
      await persist();
      const check = await window.painelApi.testDevice();
      setResult(check);
      if (check.ok) notify("ok", `HTTP ${check.status}: ${check.model} ${check.version}`);
      else notify("err", `${FAILURES[check.reason]}${check.status ? ` (HTTP ${check.status})` : ""}`);
    } catch (error) {
      setResult({ ok: false, reason: "unreachable" });
      notify("err", `não consegui testar: ${describeError(error)}`);
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
          <NumberField value={config.device.port} min={1} max={65535} onChange={(port) => setConfig({ ...config, device: { ...config.device, port } })} />
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
      {link?.rejected && !link.connected ? (
        <div className="cfg-alert" role="alert">
          <strong>APARELHO RECUSADO: CÓDIGO ERRADO</strong>
          O aparelho em {link.rejected} mandou um código diferente do que está aqui ({config.device.pairingCode || "vazio"}). Clique em ENVIAR
          CÓDIGO AO APARELHO abaixo para acertar sozinho, ou apague o aparelho para recomeçar.
        </div>
      ) : null}
      <p className="cfg-note">
        {link?.connected ? (
          <Chip>APARELHO CONECTADO: {link.address}</Chip>
        ) : link?.rejected ? (
          <Chip tone="off">RECUSADO: CÓDIGO ERRADO</Chip>
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
        <button className="px-btn" type="button" onClick={() => {
            setConfig({ ...config, device: { ...config.device, pairingCode: newCode() } });
            notify("ok", "código novo gerado: clique em SALVAR e digite no aparelho");
          }}>
          NOVO CÓDIGO
        </button>
      </div>
      <div className="cfg-row">
        <button className="px-btn px-btn-primary" type="button" disabled={busy !== null} onClick={sendCode}>
          {busy === "pair" ? "ENVIANDO…" : "ENVIAR CÓDIGO AO APARELHO"}
        </button>
        <button className="px-btn" type="button" disabled={busy !== null} onClick={wipe}>
          {busy === "reset" ? "APAGANDO…" : "APAGAR WI-FI E CÓDIGO DO APARELHO"}
        </button>
      </div>
      <p className="cfg-note">Só o aparelho com este código recebe as telas. Vazio libera qualquer aparelho da rede.</p>
      <h3 className="cfg-sub">TELA DO APARELHO</h3>
      <Slider label="Brilho" value={config.device.brightness} onChange={(brightness) => changeDisplay({ brightness })} />
      <Slider label="Contraste (50 = normal)" value={config.device.contrast} onChange={(contrast) => changeDisplay({ contrast })} />
      <p className="cfg-note">
        {display ?? "Vale na hora e fica guardado no aparelho, inclusive na tela de espera. Veja o efeito na aba Espera."}
      </p>
      {result && result !== "testing" ? (
        <p className="cfg-note">
          {result.ok ? (
            <Chip>
              OK {result.status} · {result.model} {result.version}
              {bytes(result.freeBytes)}
            </Chip>
          ) : (
            <Chip tone="off">
              ERRO{result.status ? ` ${result.status}` : ""} · {FAILURES[result.reason]}
            </Chip>
          )}
        </p>
      ) : null}
    </>
  );
}
