export type TabKey = "player" | "usage" | "clock" | "config";

const TABS: { key: TabKey; label: string }[] = [
  { key: "player", label: "Player" },
  { key: "usage", label: "Uso" },
  { key: "clock", label: "Relógio" },
  { key: "config", label: "Config" },
];

export function ScreenTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav style={{ display: "flex", borderBottom: "1px solid var(--cor-superficie)" }}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            flex: 1,
            padding: 12,
            border: "none",
            background: "transparent",
            borderBottom: active === tab.key ? "2px solid var(--cor-acento)" : "2px solid transparent",
            fontWeight: active === tab.key ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
