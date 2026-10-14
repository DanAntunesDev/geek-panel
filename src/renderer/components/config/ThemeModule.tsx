import type { AppConfig } from "../../../shared/types.js";
import { ACCENT_PATTERN, DEFAULT_ACCENT } from "../../../shared/theme.js";
import { Field } from "./ui.js";

const PRESETS = ["#E8368F", "#E8503A", "#E8A317", "#3DAE5C", "#1FA8A0", "#3B7DE0", "#8A5CE0", "#1C1C1C"];

export function ThemeModule({ config, setConfig }: { config: AppConfig; setConfig: (next: AppConfig) => void }) {
  const accent = config.theme.accent;
  const choose = (value: string) => setConfig({ ...config, theme: { accent: value } });

  return (
    <>
      <p className="cfg-note">Cor de destaque: anel de progresso, equalizador, spray e abas. Vale no app e no aparelho depois de salvar.</p>
      <div className="cfg-row" style={{ alignItems: "center" }}>
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => choose(color)}
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
        <Field label="Cor (#RRGGBB)">
          <input
            className="px-input"
            value={accent}
            spellCheck={false}
            maxLength={7}
            onChange={(event) => choose(event.target.value.trim())}
            aria-invalid={!ACCENT_PATTERN.test(accent)}
          />
        </Field>
        <button className="px-btn" type="button" onClick={() => choose(DEFAULT_ACCENT)}>
          PADRÃO
        </button>
      </div>
    </>
  );
}
