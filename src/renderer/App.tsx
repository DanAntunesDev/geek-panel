import { useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel.js";
import { ScreenTabs, type TabKey } from "./components/ScreenTabs.js";
import { TitleBar } from "./components/TitleBar.js";
import { DeviceFrame } from "./pixel/DeviceFrame.js";
import { ClockScreen } from "./screens/ClockScreen.js";
import { PlayerScreen } from "./screens/PlayerScreen.js";
import { UsageScreen } from "./screens/UsageScreen.js";

export function App() {
  const [tab, setTab] = useState<TabKey>("player");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <TitleBar />
      <ScreenTabs active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {tab === "config" ? (
          <ConfigPanel />
        ) : (
          <DeviceFrame>
            {tab === "player" ? <PlayerScreen /> : null}
            {tab === "usage" ? <UsageScreen /> : null}
            {tab === "clock" ? <ClockScreen /> : null}
          </DeviceFrame>
        )}
      </div>
    </div>
  );
}
