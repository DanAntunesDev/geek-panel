import { useEffect, useState } from "react";
import { allProviders, BUILTIN_PROVIDERS, USAGE_PROVIDERS } from "../../../shared/providers.js";
import type { AppConfig, AuthStyle, KeyCheck, ProviderSpec, SecretStatus } from "../../../shared/types.js";
import { Check, Chip, Field, Segmented } from "./ui.js";

type Verdict = KeyCheck | "checking" | null;

function VerdictChip({ verdict, status }: { verdict: Verdict; status: SecretStatus }) {
  if (verdict === "checking") return <Chip tone="mid">TESTANDO…</Chip>;
  if (verdict?.state === "valid") return <Chip>CHAVE VÁLIDA</Chip>;
  if (verdict?.state === "limited") return <Chip tone="mid">VÁLIDA, COM LIMITE</Chip>;
  if (verdict?.state === "invalid") return <Chip tone="off">CHAVE RECUSADA</Chip>;
  if (verdict?.state === "error") return <Chip tone="off">ERRO: {verdict.reason.toUpperCase()}</Chip>;
  return status.configured ? <Chip tone="mid">GUARDADA {status.hint ?? ""}</Chip> : <Chip tone="off">SEM CHAVE</Chip>;
}

function ProviderRow({
  id,
  label,
  enabled,
  onEnabled,
  onRemove,
  limit,
  onLimit,
}: {
  id: string;
  label: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  onRemove?: () => Promise<void>;
  limit: number;
  onLimit: (value: number) => void;
}) {
  const supportsUsage = USAGE_PROVIDERS.includes(id);
  const usageName = `usage:${id}`;
  const [usageStatus, setUsageStatus] = useState<SecretStatus>({ configured: false, hint: null });
  const [usageInput, setUsageInput] = useState("");
  const secretName = `provider:${id}`;
  const [status, setStatus] = useState<SecretStatus>({ configured: false, hint: null });
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.painelApi.getSecretStatus(secretName).then(setStatus).catch(() => undefined);
    if (supportsUsage) window.painelApi.getSecretStatus(usageName).then(setUsageStatus).catch(() => undefined);
  }, [secretName, usageName, supportsUsage]);

  async function saveUsageKey() {
    setError(null);
    try {
      await window.painelApi.setSecret(usageName, usageInput);
      setUsageStatus(await window.painelApi.getSecretStatus(usageName));
      setUsageInput("");
    } catch (err) {
      setError((err instanceof Error ? err.message : "falha").replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }

  async function clearUsageKey() {
    await window.painelApi.clearSecret(usageName);
    setUsageStatus({ configured: false, hint: null });
  }

  async function validate() {
    setVerdict("checking");
    try {
      setVerdict(await window.painelApi.validateProvider(id));
    } catch {
      setVerdict({ state: "error", reason: "falha ao testar" });
    }
  }

  async function save() {
    setError(null);
    try {
      await window.painelApi.setSecret(secretName, input);
      setStatus(await window.painelApi.getSecretStatus(secretName));
      setInput("");
      await validate();
    } catch (err) {
      setVerdict(null);
      setError((err instanceof Error ? err.message : "falha").replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }

  async function remove() {
    await window.painelApi.clearSecret(secretName);
    setStatus({ configured: false, hint: null });
    setVerdict(null);
  }

  return (
    <div className="cfg-service">
      <div className="cfg-service-head">
        <h4>{label.toUpperCase()}</h4>
        <VerdictChip verdict={verdict} status={status} />
      </div>
      <Check checked={enabled} onChange={onEnabled}>
        Acompanhar uso deste provedor
      </Check>
      <div className="cfg-row">
        <Field label={status.configured ? "Substituir chave (API key)" : "Chave (API key)"}>
          <input
            className="px-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </Field>
        <button className="px-btn px-btn-primary" type="button" disabled={input.trim() === ""} onClick={save}>
          GUARDAR E TESTAR
        </button>
      </div>
      <div className="cfg-row">
        <button className="px-btn" type="button" disabled={!status.configured || verdict === "checking"} onClick={validate}>
          TESTAR CHAVE GUARDADA
        </button>
        <button className="px-btn" type="button" disabled={!status.configured} onClick={remove}>
          APAGAR CHAVE
        </button>
        {onRemove ? (
          <button className="px-btn" type="button" onClick={onRemove}>
            REMOVER PROVEDOR
          </button>
        ) : null}
      </div>
      {supportsUsage ? (
        <>
          <h3 className="cfg-sub">CONSUMO NA TELA TOKENS</h3>
          <p className="cfg-note">Para ler o consumo, o provedor exige uma chave de administração (diferente da chave comum e só para contas de organização).</p>
          <div className="cfg-row">
            <Field label={usageStatus.configured ? `Chave de administração (guardada ${usageStatus.hint ?? ""})` : "Chave de administração"}>
              <input
                className="px-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={usageInput}
                onChange={(event) => setUsageInput(event.target.value)}
              />
            </Field>
            <button className="px-btn px-btn-primary" type="button" disabled={usageInput.trim() === ""} onClick={saveUsageKey}>
              GUARDAR
            </button>
            {usageStatus.configured ? (
              <button className="px-btn" type="button" onClick={clearUsageKey}>
                APAGAR
              </button>
            ) : null}
          </div>
          <div className="cfg-row">
            <Field label="Limite mensal de tokens (0 = sem limite)">
              <input
                className="px-input"
                type="number"
                min={0}
                value={limit}
                onChange={(event) => onLimit(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
              />
            </Field>
          </div>
        </>
      ) : null}
      {error ? <p className="cfg-note">ERRO: {error}</p> : null}
    </div>
  );
}

const AUTH_STYLES: { value: AuthStyle; label: string }[] = [
  { value: "bearer", label: "BEARER" },
  { value: "x-api-key", label: "X-API-KEY" },
  { value: "header", label: "OUTRO CABEÇALHO" },
];

const EMPTY_DRAFT = { label: "", baseUrl: "https://", path: "/v1/models", authStyle: "bearer" as AuthStyle, headerName: "" };

function slugify(label: string, taken: string[]): string {
  const base = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);
  const slug = base.length >= 3 ? base : `provedor-${taken.length + 1}`;
  let id = slug;
  for (let n = 2; taken.includes(id); n += 1) id = `${slug}-${n}`;
  return id;
}

function AddProvider({ config, persist }: { config: AppConfig; persist: (next: AppConfig) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const spec: ProviderSpec = {
      id: slugify(draft.label, allProviders(config.usage).map((provider) => provider.id)),
      label: draft.label.trim(),
      baseUrl: draft.baseUrl.trim(),
      path: draft.path.trim(),
      authStyle: draft.authStyle,
      ...(draft.authStyle === "header" ? { headerName: draft.headerName.trim() } : {}),
    };
    try {
      await persist({ ...config, usage: { ...config.usage, customProviders: [...config.usage.customProviders, spec] } });
      setDraft(EMPTY_DRAFT);
      setOpen(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "falha");
    }
  }

  if (!open) {
    return (
      <button className="px-btn" type="button" onClick={() => setOpen(true)}>
        + ADICIONAR PROVEDOR
      </button>
    );
  }
  return (
    <div className="cfg-service">
      <div className="cfg-row">
        <Field label="Nome">
          <input className="px-input" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
        </Field>
      </div>
      <div className="cfg-row">
        <Field label="Endereço da API (https)">
          <input className="px-input" value={draft.baseUrl} spellCheck={false} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
        </Field>
        <Field label="Rota de teste">
          <input className="px-input" value={draft.path} spellCheck={false} onChange={(event) => setDraft({ ...draft, path: event.target.value })} />
        </Field>
      </div>
      <p className="cfg-label">Como a chave é enviada</p>
      <Segmented label="Autenticação" value={draft.authStyle} options={AUTH_STYLES} onChange={(authStyle) => setDraft({ ...draft, authStyle })} />
      {draft.authStyle === "header" ? (
        <div className="cfg-row" style={{ marginTop: 12 }}>
          <Field label="Nome do cabeçalho">
            <input className="px-input" value={draft.headerName} spellCheck={false} onChange={(event) => setDraft({ ...draft, headerName: event.target.value })} />
          </Field>
        </div>
      ) : null}
      <div className="cfg-row" style={{ marginTop: 12 }}>
        <button className="px-btn px-btn-primary" type="button" disabled={draft.label.trim() === ""} onClick={add}>
          ADICIONAR
        </button>
        <button className="px-btn" type="button" onClick={() => setOpen(false)}>
          CANCELAR
        </button>
      </div>
      {error ? <p className="cfg-note">ERRO: {error}</p> : null}
    </div>
  );
}

export function ProvidersModule({
  config,
  setConfig,
  persist,
}: {
  config: AppConfig;
  setConfig: (next: AppConfig) => void;
  persist: (next: AppConfig) => Promise<void>;
}) {
  const builtinIds = BUILTIN_PROVIDERS.map((provider) => provider.id);

  async function removeCustom(id: string) {
    await window.painelApi.clearSecret(`provider:${id}`).catch(() => undefined);
    const { [id]: _removed, ...providers } = config.usage.providers;
    await persist({ ...config, usage: { ...config.usage, providers, customProviders: config.usage.customProviders.filter((provider) => provider.id !== id) } });
  }

  return (
    <>
      <p className="cfg-note">As chaves ficam no cofre do sistema e nunca voltam para esta tela.</p>
      {allProviders(config.usage).map((provider) => (
        <ProviderRow
          key={provider.id}
          id={provider.id}
          label={provider.label}
          enabled={config.usage.providers[provider.id]?.enabled ?? false}
          limit={config.usage.limits[provider.id] ?? 0}
          onLimit={(value) => setConfig({ ...config, usage: { ...config.usage, limits: { ...config.usage.limits, [provider.id]: value } } })}
          onRemove={builtinIds.includes(provider.id) ? undefined : () => removeCustom(provider.id)}
          onEnabled={(value) =>
            setConfig({ ...config, usage: { ...config.usage, providers: { ...config.usage.providers, [provider.id]: { enabled: value } } } })
          }
        />
      ))}
      <AddProvider config={config} persist={persist} />
    </>
  );
}
