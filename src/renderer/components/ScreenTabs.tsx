import { PALETTE } from "../pixel/palette.js";

export type TabKey = "player" | "usage" | "clock" | "network" | "config";

const TABS: { key: TabKey; label: string }[] = [
  { key: "player", label: "Player" },
  { key: "usage", label: "Tokens" },
  { key: "clock", label: "Relógio" },
  { key: "network", label: "Rede" },
  { key: "config", label: "Config" },
];

export function ScreenTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav style={{ display: "flex", background: PALETTE.bg, borderBottom: `2px solid ${PALETTE.ink}`, flexShrink: 0 }}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className="pixel-text"
          onClick={() => onChange(tab.key)}
          style={{
            flex: 1,
            padding: "10px 4px",
            border: "none",
            background: "transparent",
            color: PALETTE.ink,
            borderBottom: active === tab.key ? `3px solid ${PALETTE.accent}` : "3px solid transparent",
            fontSize: 8,
            cursor: "pointer",
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
