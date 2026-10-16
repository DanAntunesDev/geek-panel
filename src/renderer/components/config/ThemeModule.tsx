import { allProviders } from "../../../shared/providers.js";
import { ACCENT_PATTERN, DEFAULT_ACCENT } from "../../../shared/theme.js";
import type { AppConfig, ThemeConfig } from "../../../shared/types.js";
import { notify } from "./toast.js";
import { Field } from "./ui.js";

const PRESETS = ["#E8368F", "#E8503A", "#E8A317", "#3DAE5C", "#1FA8A0", "#3B7DE0", "#8A5CE0", "#1C1C1C"];

const CLOCK_COLORS: { key: keyof ThemeConfig["clock"]; label: string; fallback: string }[] = [
  { key: "hour", label: "Horas", fallback: "#F7F6F3" },
  { key: "minute", label: "Minutos", fallback: "#F7F6F3" },
  { key: "second", label: "Segundos", fallback: "#F7F6F3" },
  { key: "date", label: "Data (dia e mês)", fallback: "#1C1C1C" },
  { key: "weekday", label: "Dia da semana (D S T Q Q S S)", fallback: "#F7F6F3" },
  { key: "city", label: "Cidade", fallback: "#787877" },
];

// Seletor de cor com "padrão": null devolve a cena ao visual original.
function ColorField({ label, value, fallback, onChange }: { label: string; value: string | null; fallback: string; onChange: (value: string | null) => void }) {
  return (
    <div className="cfg-color">
      <input type="color" aria-label={label} value={value ?? fallback} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      <span>
        {label}
        <small>{value ?? "padrão"}</small>
      </span>
      <button className="px-btn" type="button" disabled={value === null} onClick={() => onChange(null)}>
        PADRÃO
      </button>
    </div>
  );
}

export function ThemeModule({ config, setConfig }: { config: AppConfig; setConfig: (next: AppConfig) => void }) {
  const { theme } = config;
  const setTheme = (patch: Partial<ThemeConfig>) => setConfig({ ...config, theme: { ...theme, ...patch } });
  const accent = theme.accent;

  // os cartões da tela Tokens seguem a ordem dos provedores ligados
  const names = allProviders(config.usage)
    .filter((provider) => config.usage.providers[provider.id]?.enabled)
    .map((provider) => provider.label);
  const setToken = (index: number, value: string | null) => {
    const tokens = [...theme.tokens];
    tokens[index] = value;
    setTheme({ tokens });
  };

  return (
    <>
      <p className="cfg-note">A cor de destaque vale no app inteiro (abas, opções marcadas, anel do player) e no aparelho depois de salvar.</p>
      <div className="cfg-row" style={{ alignItems: "center" }}>
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => setTheme({ accent: color })}
            style={{
              width: 28,
              height: 28,
              background: color,
              border: color.toUpperCase() === accent.toUpperCase() ? "3px solid var(--ink)" : "3px solid var(--surface)",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <div className="cfg-row">
        <Field label="Cor de destaque (#RRGGBB)">
          <input
            className="px-input"
            value={accent}
            spellCheck={false}
            maxLength={7}
            onChange={(event) => setTheme({ accent: event.target.value.trim() })}
            aria-invalid={!ACCENT_PATTERN.test(accent)}
          />
        </Field>
        <button
          className="px-btn"
          type="button"
          onClick={() => {
            setTheme({ accent: DEFAULT_ACCENT });
            notify("ok", "cor padrão escolhida: clique em SALVAR para aplicar");
          }}
        >
          PADRÃO
        </button>
      </div>

      <h3 className="cfg-sub">TELA TOKENS</h3>
      {[0, 1].map((index) => (
        <ColorField
          key={index}
          label={`${index + 1}º provedor${names[index] ? ` (${names[index]})` : ""}`}
          value={theme.tokens[index] ?? null}
          fallback="#E8368F"
          onChange={(value) => setToken(index, value)}
        />
      ))}

      <h3 className="cfg-sub">TELA DO RELÓGIO</h3>
      {CLOCK_COLORS.map((field) => (
        <ColorField
          key={field.key}
          label={field.label}
          value={theme.clock[field.key]}
          fallback={field.fallback}
          onChange={(value) => setTheme({ clock: { ...theme.clock, [field.key]: value } })}
        />
      ))}
    </>
  );
}
