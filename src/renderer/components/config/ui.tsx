import type { ReactNode } from "react";

export function Module({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="cfg-title">{title}</h2>
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
