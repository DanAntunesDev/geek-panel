import { useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel.js";
import { ScreenTabs, type TabKey } from "./components/ScreenTabs.js";
import { ClockScreen } from "./screens/ClockScreen.js";
import { NetworkScreen } from "./screens/NetworkScreen.js";
import { PlayerScreen } from "./screens/PlayerScreen.js";
import { UsageScreen } from "./screens/UsageScreen.js";

export function App() {
  const [tab, setTab] = useState<TabKey>("usage");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <ScreenTabs active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "player" ? <PlayerScreen /> : null}
        {tab === "usage" ? <UsageScreen /> : null}
        {tab === "clock" ? <ClockScreen connected={false} /> : null}
        {tab === "network" ? <NetworkScreen /> : null}
        {tab === "config" ? <ConfigPanel /> : null}
      </div>
    </div>
  );
}
