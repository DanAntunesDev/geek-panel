import { useEffect, useState, type ReactNode } from "react";
import { Help } from "./Help.js";
import type { HELP } from "./helpTopics.js";

export function Module({ title, help, children }: { title: string; help?: keyof typeof HELP; children: ReactNode }) {
  return (
    <section>
      <h2 className="cfg-title">
        {title}
        {help ? <Help topic={help} /> : null}
      </h2>
      {children}
    </section>
  );
}

export function Divider() {
  return <div className="cfg-divider" role="separator" />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="cfg-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return (
    <label className="px-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="px-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ tone = "ink", children }: { tone?: "ink" | "mid" | "off"; children: ReactNode }) {
  const className = tone === "off" ? "px-chip px-chip-off" : tone === "mid" ? "px-chip px-chip-mid" : "px-chip";
  return <span className={className}>{children}</span>;
}

// Número digitado como texto: dá para apagar tudo e escrever de novo, sem o zero grudado.
export function NumberField({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const [text, setText] = useState(String(value));

  // mudança vinda de fora (carregar, salvar) atualiza o texto, menos enquanto o campo está vazio
  useEffect(() => {
    setText((current) => (current !== "" && Number(current) === value ? current : String(value)));
  }, [value]);

  return (
    <input
      className="px-input"
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 9).replace(/^0+(?=\d)/, "");
        setText(digits);
        if (digits !== "") onChange(Math.min(max, Math.max(min, Number(digits))));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

// Controle deslizante de 0 a 100, com o número ao lado.
export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="cfg-slider">
      <span>{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output>{value}</output>
    </label>
  );
}
